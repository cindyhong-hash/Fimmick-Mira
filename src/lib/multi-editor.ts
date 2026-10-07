/* ============================================================
   多圖微調畫布（MultiEditorCanvas）共用的純邏輯

   多圖的 GeneratedLayout.textLayerJson 原本沒用到（那欄是單圖「底圖模式」的文字層），
   多圖拿來存兩樣「重新拼版時要用、但圖片本身存不下」的設定：
   - collage：生成當下的拼版底色／是否滿版。重新拼版要照這個拼，不然改一格整張底色、格縫就變了。
   - compositeLogos：放在「拼版總覽」上的 LOGO。改任何一格都會從各格重新拼一張，
     不記下來重貼的話 LOGO 就不見了。
   ============================================================ */

export type CompositeLogo = { logoUrl: string; x: number; y: number; scale?: number; shadow?: boolean };
export type CollageStyle = { accentColor?: string | null; fullBleed?: boolean };
export type MultiLayoutMeta = { collage?: CollageStyle; compositeLogos?: CompositeLogo[] };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 讀 textLayerJson；格式不對的部分直接丟掉，永遠回得出一個物件。 */
export function parseMultiLayoutMeta(raw: string | null | undefined): MultiLayoutMeta {
  let v: unknown;
  try { v = JSON.parse(raw || "{}"); } catch { return {}; }
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: MultiLayoutMeta = {};
  if (o.collage && typeof o.collage === "object") {
    const c = o.collage as Record<string, unknown>;
    out.collage = {
      ...(typeof c.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(c.accentColor) ? { accentColor: c.accentColor } : {}),
      ...(c.fullBleed === true ? { fullBleed: true } : {}),
    };
  }
  if (Array.isArray(o.compositeLogos)) {
    out.compositeLogos = o.compositeLogos
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .filter((l) => typeof l.logoUrl === "string" && isNum(l.x) && isNum(l.y))
      .map((l) => ({
        logoUrl: l.logoUrl as string, x: l.x as number, y: l.y as number,
        ...(isNum(l.scale) ? { scale: l.scale } : {}),
        ...(l.shadow === true ? { shadow: true } : {}),
      }));
  }
  return out;
}

/** 把第 from 個搬到第 to 個的位置（其他依序往前／往後挪）。 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/**
 * 「重新生成這一格」給 Gemini 的指令：拿目前這格當 IMAGE 1（風格、文字、產品的依據），
 * 出一張畫面不同、但同一組系列感的新圖。texts 有給（改文字模式讀過）就逐字鎖住。
 */
export function buildRegenerateCellPrompt(opts: { texts?: string[]; instruction?: string; productHint?: string }): string {
  const texts = (opts.texts ?? []).map((t) => t.trim()).filter(Boolean);
  const instruction = opts.instruction?.trim();
  return (
    `IMAGE 1 is one cell of a social media carousel. Create a NEW alternative version of this cell.\n\n` +
    `CHANGE (make it clearly different from IMAGE 1): the photo itself — a different scene, camera angle, composition, pose or props.\n` +
    (instruction ? `THE USER WANTS: ${instruction}\n` : "") +
    `\nKEEP (so it still belongs to the same carousel):\n` +
    `- The exact same product: packaging shape, brand name, logo, label text, colors and material. Do not invent a different product.${opts.productHint ? ` Product: ${opts.productHint}` : ""}\n` +
    `- The same color temperature, lighting mood and overall visual style.\n` +
    `- The same typography style and text container design as IMAGE 1, placed so it stays readable.\n` +
    (texts.length
      ? `- Exactly these text blocks, character by character, and no other text (do not translate or convert Traditional/Simplified Chinese):\n${texts.map((t) => `  • "${t}"`).join("\n")}\n`
      : `- Exactly the same text content as IMAGE 1, character by character (do not translate or convert Traditional/Simplified Chinese). Do not add any other text.\n`) +
    `\nOUTPUT: one finished image with the same aspect ratio as IMAGE 1.`
  );
}
