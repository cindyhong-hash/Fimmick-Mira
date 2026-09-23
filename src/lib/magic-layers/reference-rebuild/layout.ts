/* ============================================================
   照參考圖重做 —— 讓視覺模型把設計圖「讀成」版面說明

   模型只負責「有哪些東西、大概在哪、什麼樣式」；精確的邊界與顏色之後用像素校正。
   實測 gemini-3.8-flash 的框比 gemini-2.5-pro 準很多，費用約十分之一，
   而且會把不同顏色的字（白色 LIVE／深藍 DAY）正確拆成兩段。
   ============================================================ */

/** 0–1000 正規化座標：[ymin, xmin, ymax, xmax]（Gemini 訓練時用的格式，框最準）。 */
export type NormBox = [number, number, number, number];

export type RawText = {
  text: string; box: NormBox; lines: number; color: string; weight: number;
  family: string; italic: boolean; align: "left" | "center" | "right";
  vertical: boolean; letterSpacing: number; rotationDeg: number; behindProduct: boolean;
};
export type RawShape = { kind: string; box: NormBox; fill: string; stroke: string; opacity: number; blurry: boolean };
export type RawLayout = {
  background: string;
  texts: RawText[];
  products: { label: string; box: NormBox }[];
  shapes: RawShape[];
  graphics: { label: string; box: NormBox }[];
};

export const REFERENCE_LAYOUT_PROMPT = `You are a senior graphic designer rebuilding this social-media design as editable layers.
List EVERY visible element. Coordinates are boxes [ymin, xmin, ymax, xmax] normalized 0-1000 of the full image. Be pixel-precise: the box must hug the ink of the element tightly.

Return JSON only:
{
  "background": "one sentence describing the background with all text/products/graphics removed",
  "texts": [ {
     "text": "exact characters, keep line breaks as \\n, keep original language",
     "box": [ymin,xmin,ymax,xmax],
     "lines": number of lines,
     "color": "#hex of the glyph fill",
     "weight": 100-900,
     "family": "sans" | "serif" | "script" | "handwritten" | "rounded",
     "italic": bool,
     "align": "left" | "center" | "right",
     "vertical": bool (true if characters stack top-to-bottom),
     "letterSpacing": number in em (0 normal, 0.3 wide),
     "rotationDeg": number (0 if upright),
     "behindProduct": bool (true if a product overlaps and HIDES part of this text, i.e. the text is layered underneath the product)
  } ],
  "products": [ { "label": "short", "box": [..] } ],
  "shapes": [ {
     "kind": "rect" | "pill" | "circle" | "line" | "frame",
     "box": [..],
     "fill": "#hex" or "none",
     "stroke": "#hex" or "none",
     "strokeWidth": px at 1000-wide scale,
     "opacity": 0-1,
     "blurry": bool (soft glow / frosted look)
  } ],
  "graphics": [ { "label": "logo / sticker / illustration / art lettering / barcode / icon", "box": [..] } ]
}

Rules:
- One text entry per run of identical style. A headline whose words differ in colour or size must be split into separate entries.
- Brand logos drawn as lettering go in "graphics", not "texts".
- Decorative script lettering that is part of the art (not readable copy) goes in "graphics".
- Products: each physically separate product or pack gets its own entry. Text PRINTED ON a product or its packaging is part of the product: never list it in texts or graphics.
- Capsules, pills, droppers and other loose props next to a product are part of the nearest product group.
- Shapes are flat vector-like elements: pills, badges, bars, frames, dividers, corner brackets, dots.`;

const HEX = /^#[0-9a-f]{6}$/i;

function normBox(v: unknown): NormBox | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map((x) => Number(x));
  if (!n.every((x) => Number.isFinite(x))) return null;
  const [y0, x0, y1, x1] = n.map((x) => Math.max(0, Math.min(1000, x)));
  if (y1 - y0 < 1 || x1 - x0 < 1) return null;
  return [y0, x0, y1, x1];
}
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);

/**
 * 解析模型回覆。模型偶爾會包 ```json、漏欄位、給出界的框；
 * 壞掉的單筆直接丟掉，不讓一筆錯誤毀掉整張圖。整份讀不懂才丟錯。
 */
export function parseReferenceLayout(reply: string): RawLayout {
  const cleaned = reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let data: Record<string, unknown>;
  try { data = JSON.parse(cleaned) as Record<string, unknown>; } catch { throw new Error("看不懂這張圖的版面，請換一張再試"); }
  const list = (k: string) => (Array.isArray(data[k]) ? (data[k] as Record<string, unknown>[]) : []);

  const texts: RawText[] = [];
  for (const t of list("texts")) {
    const box = normBox(t.box); const text = str(t.text).trim();
    if (!box || !text) continue;
    const align = t.align === "left" || t.align === "right" ? t.align : "center";
    texts.push({
      text, box, lines: Math.max(1, Math.round(num(t.lines, text.split("\n").length))),
      color: color(t.color, "#222222"), weight: Math.max(100, Math.min(900, num(t.weight, 400))),
      family: str(t.family, "sans"), italic: t.italic === true, align,
      vertical: t.vertical === true, letterSpacing: Math.max(0, Math.min(1, num(t.letterSpacing, 0))),
      rotationDeg: Math.max(-45, Math.min(45, num(t.rotationDeg, 0))), behindProduct: t.behindProduct === true,
    });
  }
  const boxed = (k: string) => list(k).flatMap((g) => { const box = normBox(g.box); return box ? [{ label: str(g.label), box }] : []; });
  const shapes: RawShape[] = list("shapes").flatMap((s) => {
    const box = normBox(s.box); if (!box) return [];
    return [{ kind: str(s.kind, "rect"), box, fill: str(s.fill, "none"), stroke: str(s.stroke, "none"),
      opacity: Math.max(0, Math.min(1, num(s.opacity, 1))), blurry: s.blurry === true }];
  });
  return { background: str(data.background), texts, products: boxed("products"), shapes, graphics: boxed("graphics") };
}
