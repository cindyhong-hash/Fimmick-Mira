/* ============================================================
   PSD → 自由畫布：把 ag-psd 讀出來的結構整理成「幾頁、每頁哪些圖層」。
   這裡只做規劃（純函式，可以單獨測）；真正把像素裁切、套遮色片、上傳，在編輯器裡做。

   對應規則：
   ・PSD 有工作區域（artboard）→ 每個工作區域一頁，頁名、尺寸照工作區域，座標換成工作區域自己的；
     沒有工作區域 → 整份文件一頁。
   ・群組一路往下拆，裡面的圖層都會讀到；同一個群組的圖層設成同一組（可以一起移動）。
     群組隱藏 → 裡面全部隱藏；群組透明度乘到每個子圖層上。
   ・文字圖層 → 可以改字的文字圖層（字、字級、顏色、粗細、對齊、分段樣式）；
     直排、彎曲文字做不出來，改用 PS 存好的點陣圖。
   ・點陣／形狀／智慧型物件 → 圖片圖層（用 PS 存好的像素，看起來跟 PS 一樣）。
   ・調整圖層（色階、曲線…）、空圖層 → 略過，列在報告裡。
   ・圖層遮色片、剪裁遮色片 → 先烤進圖片（在編輯器做），報告裡註明「不能再調」。
   ・混合模式、圖層樣式（陰影以外）→ 照原樣像素，報告裡註明可能不一樣。
   ag-psd 的 children 是由下往上排，跟畫布的圖層順序一樣（第 0 個在最下面）。
   ============================================================ */
import type { TextFx, TextRun } from "./saved-layer.ts";
import type { LayerGlow, LayerShadow } from "./layer-glow.ts";

/** ag-psd Layer 用到的欄位（只寫我們會讀的，型別放寬，方便測試時手做假資料）。 */
export type PsdLayerLike = {
  name?: string;
  top?: number; left?: number; bottom?: number; right?: number;
  hidden?: boolean;
  opacity?: number;            // 0–1
  blendMode?: string;
  clipping?: boolean;
  canvas?: unknown;
  children?: PsdLayerLike[];
  adjustment?: unknown;
  artboard?: { rect?: { top?: number; left?: number; bottom?: number; right?: number }; backgroundType?: number; color?: unknown };
  mask?: { canvas?: unknown; left?: number; top?: number; right?: number; bottom?: number; defaultColor?: number; disabled?: boolean };
  text?: {
    text?: string;
    transform?: number[];
    orientation?: string;
    warp?: { style?: string };
    style?: PsdTextStyle;
    styleRuns?: { length: number; style: PsdTextStyle }[];
    paragraphStyle?: { justification?: string };
  };
  effects?: {
    disabled?: boolean;
    dropShadow?: { enabled?: boolean; color?: unknown; opacity?: number; angle?: number; distance?: { value?: number } | number; size?: { value?: number } | number }[];
    stroke?: { enabled?: boolean; color?: unknown; opacity?: number; size?: { value?: number } | number; position?: string; fillType?: string }[];
    outerGlow?: { enabled?: boolean; color?: unknown; opacity?: number; size?: { value?: number } | number };
    [k: string]: unknown;
  };
};
export type PsdTextStyle = { font?: { name?: string }; fontSize?: number; fillColor?: unknown; fauxBold?: boolean };
export type PsdLike = { width: number; height: number; children?: PsdLayerLike[] };

type Common = { name: string; x: number; y: number; w: number; h: number; opacity: number; visible: boolean; groupId: string | null;
  /** 旋轉（弧度，順時針為正）；只有文字會轉，圖片的像素本來就是轉好的。 */ rotation?: number };
/** 畫布做得出來的圖層樣式（陰影、外光暈）。 */
type Fx = { shadow?: LayerShadow; glow?: LayerGlow };
export type ImportImage = Common & Fx & {
  kind: "image";
  /** PS 的「筆畫」樣式：畫布的圖片沒有外框，要先烤進像素（圖層會往外長 size）。 */
  stroke?: { color: string; size: number; opacity: number };
  /** PS 存好的像素（瀏覽器裡是 canvas）。 */
  source: unknown;
  /** 圖層遮色片（要先烤進像素）：座標跟 PSD 文件一樣。 */
  mask?: { source: unknown; left: number; top: number; defaultColor: number };
  /** 剪裁遮色片：只顯示在這一頁第幾個圖層的範圍裡（要先烤進像素）。 */
  clipBase?: number;
  /** 圖層在 PSD 文件裡的左上角（裁切、套遮色片要用原本的座標）。 */
  docLeft: number; docTop: number;
  /** 最底下鋪滿整頁的照片：當成「背景」（生成式填色、換背景只看背景圖層）。 */
  background?: boolean;
};
export type ImportText = Common & Fx & {
  kind: "text";
  text: string; fontSize: number; color: string; fontFamily: string; fontWeight: number;
  align: "left" | "center" | "right";
  runs?: TextRun[];
  fx?: TextFx;
};
export type ImportRect = Common & { kind: "rect"; fill: string; background: true };
export type ImportLayer = ImportImage | ImportText | ImportRect;
export type ImportPage = { name: string; w: number; h: number; layers: ImportLayer[] };
export type ImportNote = { layer: string; reason: string };
export type ImportPlan = { pages: ImportPage[]; skipped: ImportNote[]; approximated: ImportNote[] };

const NORMAL_BLEND = new Set([undefined, "normal", "pass through"]);
const round = (v: number) => Math.round(v * 100) / 100;

/** 色彩 {r,g,b}（0–255）→ #rrggbb；看不懂的給黑色。 */
export function psdColorToHex(c: unknown): string {
  const o = c as { r?: number; g?: number; b?: number } | null;
  if (!o || typeof o !== "object" || typeof o.r !== "number") return "#000000";
  const h = (v: number | undefined) => Math.max(0, Math.min(255, Math.round(v ?? 0))).toString(16).padStart(2, "0");
  return `#${h(o.r)}${h(o.g)}${h(o.b)}`;
}

const WEIGHTS: [RegExp, number][] = [
  [/(ultra|extra)black|heavy|black/i, 900], [/(extra|ultra)bold/i, 800], [/semi\s*bold|demi\s*bold/i, 600],
  [/bold/i, 700], [/medium/i, 500], [/(extra|ultra)light/i, 200], [/light/i, 300], [/thin|hairline/i, 100],
];
/** 常見中文字型的 PostScript 家族名 → 畫布上用的字型名稱（PS 存的是像 NotoSansTC-Bold 這種名稱）。 */
const FAMILY_ALIASES: [RegExp, string][] = [
  [/^(NotoSans(TC|CJKtc|CJKTC|HK|SC|CJKsc)?|SourceHanSans(TC|TW|HK|SC)?|SourceHanSans)$/i, "Noto Sans TC"],
  // 思源黑體的衍生字型、常見的黑體：畫布沒有，換成最像的思源黑體
  [/^(SweiGothic\w*|GenSen\w*|GenJyuu\w*|AdobeFanHeiti\w*|AdobeHeiti\w*|STHeiti\w*|HeitiTC|Heiti\w*|jf-?open\w*|TaipeiSans\w*)$/i, "Noto Sans TC"],
  [/^(SweiSerif\w*|GenWan\w*|AdobeMingStd\w*|STSong\w*|PMingLiU|MingLiU)$/i, "Noto Serif TC"],
  [/^(NotoSerif(TC|CJKtc|CJKTC|SC)?|SourceHanSerif(TC|TW|SC)?)$/i, "Noto Serif TC"],
  [/^PingFang(TC|SC|HK)?$/i, "PingFang TC"],
  [/^(MicrosoftJhengHei|MicrosoftJhengHeiUI)$/i, "Microsoft JhengHei"],
];
const FALLBACK = "'Noto Sans TC',system-ui,sans-serif";

/**
 * PS 的 PostScript 字型名稱（例如 NotoSansTC-Bold）→ 畫布的字型＋粗細。
 * 認得的中文字型換成畫布有的名稱；不認得的照原名（拆成有空格的家族名），後面接預設字型當備胎。
 */
export function fontFromPostScript(name: string | undefined, fauxBold = false): { fontFamily: string; fontWeight: number } {
  const raw = (name ?? "").trim();
  if (!raw) return { fontFamily: FALLBACK, fontWeight: fauxBold ? 700 : 400 };
  const dash = raw.lastIndexOf("-");
  const famPart = dash > 0 ? raw.slice(0, dash) : raw;
  const stylePart = dash > 0 ? raw.slice(dash + 1) : "";
  let weight = 400;
  for (const [re, w] of WEIGHTS) if (re.test(stylePart || raw)) { weight = w; break; }
  if (fauxBold && weight < 700) weight = 700;
  const alias = FAMILY_ALIASES.find(([re]) => re.test(famPart))?.[1];
  if (alias) return { fontFamily: `'${alias}',system-ui,sans-serif`, fontWeight: weight };
  // NotoSansTC → Noto Sans TC：小寫接大寫、連續大寫接大寫小寫的地方補空格
  const spaced = famPart.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").trim();
  return { fontFamily: `'${spaced}',${FALLBACK}`, fontWeight: weight };
}

/** 文字變形矩陣的縮放（PS 的字級要乘上它，才是畫面上實際的大小）。 */
const textScale = (t: number[] | undefined) => (t && t.length >= 4 ? Math.hypot(t[0], t[1]) || 1 : 1);

function boundsOf(l: PsdLayerLike) {
  const left = l.left ?? 0, top = l.top ?? 0;
  return { left, top, w: Math.max(0, (l.right ?? left) - left), h: Math.max(0, (l.bottom ?? top) - top) };
}

function textLayer(l: PsdLayerLike, base: Common): ImportText | null {
  const t = l.text!;
  const text = (t.text ?? "").replace(/\r\n?/g, "\n").replace(/\u0003/g, "\n");
  if (!text.trim()) return null;
  const scale = textScale(t.transform);
  const st0 = t.style ?? t.styleRuns?.[0]?.style ?? {};
  const font = fontFromPostScript(st0.font?.name, st0.fauxBold);
  const fontSize = round((st0.fontSize ?? 24) * scale);
  const color = psdColorToHex(st0.fillColor);
  const j = t.paragraphStyle?.justification ?? "left";
  const align: ImportText["align"] = j.startsWith("center") || j === "justify-center" ? "center" : j.startsWith("right") || j === "justify-right" ? "right" : "left";
  // 分段樣式：跟第一段不一樣的字級、顏色、粗細才記
  const runs: TextRun[] = [];
  let at = 0;
  for (const r of t.styleRuns ?? []) {
    const s = r.style ?? {};
    const f = fontFromPostScript(s.font?.name ?? st0.font?.name, s.fauxBold);
    const size = s.fontSize !== undefined ? round(s.fontSize * scale) : undefined;
    const col = s.fillColor !== undefined ? psdColorToHex(s.fillColor) : undefined;
    const run: TextRun = { start: at, end: Math.min(text.length, at + r.length) };
    if (size !== undefined && size !== fontSize) run.fontSize = size;
    if (col && col !== color) run.color = col;
    if (f.fontWeight !== font.fontWeight) run.fontWeight = f.fontWeight;
    if (run.end > run.start && (run.fontSize || run.color || run.fontWeight)) runs.push(run);
    at += r.length;
  }
  const out: ImportText = { ...base, kind: "text", text, fontSize, color, ...font, align, ...(runs.length ? { runs } : {}), ...layerFx(l) };
  // 文字的「筆畫」→ 畫布的文字外框。畫布的外框線是壓在字的邊上（一半在外），所以寬度要兩倍
  const st = strokeOf(l);
  if (st) out.fx = { strokeColor: st.color, strokeW: round((st.size * 2) / Math.max(1, fontSize) * 1000) / 1000 };
  // 字有旋轉：PS 給的範圍是轉完的外框，換回沒轉的大小（中心不變）
  const rot = t.transform && t.transform.length >= 2 ? Math.atan2(t.transform[1], t.transform[0]) : 0;
  if (Math.abs(rot) > 0.002) {
    const c = Math.abs(Math.cos(rot)), si = Math.abs(Math.sin(rot)), det = c * c - si * si;
    if (det > 0.2) {
      const w = (base.w * c - base.h * si) / det, h = (base.h * c - base.w * si) / det;
      if (w > 4 && h > 4) { out.x = round(base.x + (base.w - w) / 2); out.y = round(base.y + (base.h - h) / 2); out.w = round(w); out.h = round(h); }
    }
    out.rotation = round(rot * 1000) / 1000;
  }
  return out;
}

const num = (v: { value?: number } | number | undefined, d: number) => (typeof v === "number" ? v : v?.value ?? d);
const on = (v: unknown) => !!v && typeof v === "object" && (v as { enabled?: boolean }).enabled !== false;
/** 陰影、外光暈：畫布有一樣的東西，照數值帶過去。 */
function layerFx(l: PsdLayerLike): Fx {
  const e = l.effects;
  if (!e || e.disabled) return {};
  const out: Fx = {};
  const ds = e.dropShadow?.find(on);
  // PS 的角度是光從哪裡來（120° 影子落在右下）；畫布的角度是影子往哪裡落（0° 往右、90° 往下）
  if (ds) out.shadow = { color: psdColorToHex(ds.color), opacity: ds.opacity ?? 0.75, distance: num(ds.distance, 5), blur: num(ds.size, 5), angle: (((180 - (ds.angle ?? 120)) % 360) + 360) % 360 };
  const og = e.outerGlow;
  if (og && on(og)) out.glow = { color: psdColorToHex(og.color), size: Math.max(2, num(og.size, 10)), opacity: og.opacity ?? 0.75, strength: 2 };
  return out;
}
/** PS 的「筆畫」（只取單色的，漸層／圖樣筆畫畫布做不出來）。 */
function strokeOf(l: PsdLayerLike): { color: string; size: number; opacity: number } | null {
  const e = l.effects;
  if (!e || e.disabled) return null;
  const st = e.stroke?.find((x) => on(x) && (x.fillType ?? "color") === "color");
  return st ? { color: psdColorToHex(st.color), size: Math.max(1, num(st.size, 3)), opacity: st.opacity ?? 1 } : null;
}
const FX_NAMES: Record<string, string> = {
  innerShadow: "內陰影", innerGlow: "內光暈", bevel: "斜角和浮雕", satin: "緞面",
  solidFill: "顏色覆蓋", gradientOverlay: "漸層覆蓋", patternOverlay: "圖樣覆蓋",
};
/** 開著、但畫布做不出來的圖層樣式（列在報告裡）。 */
function unsupportedFx(l: PsdLayerLike): string[] {
  const e = l.effects;
  if (!e || e.disabled) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(e)) {
    if (!FX_NAMES[k]) continue;
    if (Array.isArray(v) ? v.some(on) : on(v)) out.push(FX_NAMES[k]);
  }
  if (e.stroke?.some((x) => on(x) && (x.fillType ?? "color") !== "color")) out.push("漸層／圖樣筆畫");
  return out;
}

/** 一頁的圖層（由下往上）。ox／oy＝這一頁在 PSD 文件裡的左上角。 */
function collect(children: PsdLayerLike[], ox: number, oy: number, plan: ImportPlan, ctx: { hidden: boolean; opacity: number; groupId: string | null }, out: ImportLayer[], groupSeq: { n: number }) {
  let lastBase: number | undefined;   // 剪裁遮色片要貼在「下面最近一個不是剪裁的圖層」上
  for (const l of children) {
    const name = l.name?.trim() || "圖層";
    const hidden = ctx.hidden || !!l.hidden;
    const opacity = ctx.opacity * (l.opacity ?? 1);
    if (l.children) {
      const gid = `psdgroup_${++groupSeq.n}`;
      collect(l.children, ox, oy, plan, { hidden, opacity, groupId: gid }, out, groupSeq);
      lastBase = undefined;
      continue;
    }
    if (l.adjustment) { plan.skipped.push({ layer: name, reason: "調整圖層（色階、曲線、色相等）沒辦法匯入" }); continue; }
    const b = boundsOf(l);
    if (!b.w || !b.h) { plan.skipped.push({ layer: name, reason: "空的圖層" }); continue; }
    const base: Common = { name, x: b.left - ox, y: b.top - oy, w: b.w, h: b.h, opacity: round(opacity), visible: !hidden, groupId: ctx.groupId };
    if (!NORMAL_BLEND.has(l.blendMode)) plan.approximated.push({ layer: name, reason: `混合模式「${l.blendMode}」做不出來，照一般模式顯示` });
    const editableText = l.text && l.text.orientation !== "vertical" && !(l.text.warp?.style && l.text.warp.style !== "none") && !l.clipping && !(l.mask?.canvas && !l.mask.disabled);
    if (editableText) {
      const t = textLayer(l, base);
      if (t) {
        const miss = unsupportedFx(l);
        if (miss.length) plan.approximated.push({ layer: name, reason: `圖層樣式「${miss.join("、")}」沒有帶過來` });
        out.push(t); lastBase = out.length - 1; continue;
      }
    }
    if (!l.canvas) { plan.skipped.push({ layer: name, reason: "讀不到這個圖層的像素" }); continue; }
    if (l.text) plan.approximated.push({ layer: name, reason: "直排／彎曲文字（或有遮色片的文字）改成圖片，不能直接改字" });
    const img: ImportImage = { ...base, kind: "image", source: l.canvas, docLeft: b.left, docTop: b.top, ...layerFx(l) };
    const st = strokeOf(l);
    if (st) {
      // 外框烤進像素：圖層往外長一圈
      img.stroke = st;
      img.x -= st.size; img.y -= st.size; img.w += st.size * 2; img.h += st.size * 2;
    }
    const miss = unsupportedFx(l);
    if (miss.length) plan.approximated.push({ layer: name, reason: `圖層樣式「${miss.join("、")}」沒有帶過來` });
    if (l.mask?.canvas && !l.mask.disabled) {
      img.mask = { source: l.mask.canvas, left: l.mask.left ?? 0, top: l.mask.top ?? 0, defaultColor: l.mask.defaultColor ?? 0 };
      plan.approximated.push({ layer: name, reason: "圖層遮色片已經套進圖片，之後不能再調" });
    }
    if (l.clipping) {
      if (lastBase !== undefined) { img.clipBase = lastBase; plan.approximated.push({ layer: name, reason: "剪裁遮色片已經套進圖片，之後不能再調" }); }
    } else lastBase = out.length;
    out.push(img);
  }
}

/** 工作區域的背景（PS 預設白色；設成透明的就不加）。 */
function artboardBackground(ab: NonNullable<PsdLayerLike["artboard"]>, w: number, h: number): ImportRect | null {
  const t = ab.backgroundType ?? 1;
  if (t === 3) return null;
  const fill = t === 2 ? "#000000" : t === 4 ? psdColorToHex(ab.color) : "#ffffff";
  return { kind: "rect", background: true, fill, name: "背景", x: 0, y: 0, w, h, opacity: 1, visible: true, groupId: null };
}

export function planPsdImport(psd: PsdLike): ImportPlan {
  const plan: ImportPlan = { pages: [], skipped: [], approximated: [] };
  const top = psd.children ?? [];
  const boards = top.filter((l) => l.artboard?.rect);
  const groupSeq = { n: 0 };
  if (boards.length) {
    for (const ab of boards) {
      const r = ab.artboard!.rect!;
      const left = r.left ?? 0, topY = r.top ?? 0;
      const w = Math.max(1, Math.round((r.right ?? left) - left)), h = Math.max(1, Math.round((r.bottom ?? topY) - topY));
      const layers: ImportLayer[] = [];
      const bg = artboardBackground(ab.artboard!, w, h);
      if (bg) layers.push(bg);
      collect(ab.children ?? [], left, topY, plan, { hidden: false, opacity: 1, groupId: null }, layers, groupSeq);
      plan.pages.push({ name: ab.name?.trim() || `工作區域 ${plan.pages.length + 1}`, w, h, layers });
    }
    for (const l of top) if (!l.artboard?.rect) plan.skipped.push({ layer: l.name?.trim() || "圖層", reason: "不在任何工作區域裡" });
  } else {
    const layers: ImportLayer[] = [];
    collect(top, 0, 0, plan, { hidden: false, opacity: 1, groupId: null }, layers, groupSeq);
    plan.pages.push({ name: "", w: Math.max(1, Math.round(psd.width)), h: Math.max(1, Math.round(psd.height)), layers });
  }
  // 從最底下往上、連續鋪滿（85% 以上）的照片都當背景：生成式填色只會把背景送去修，
  // 不標的話只有工作區域的白底是背景，AI 拿到的是一張白紙。
  // 「連續」：實測的 PSD 最底下是一張純白圖層、真正的照片在它上面一層，只標第一張也會拿到白紙。
  for (const p of plan.pages) {
    for (const l of p.layers) {
      if (l.kind === "rect") continue;
      if (l.kind !== "image" || !l.visible) break;
      const ix = Math.max(0, Math.min(p.w, l.x + l.w) - Math.max(0, l.x)), iy = Math.max(0, Math.min(p.h, l.y + l.h) - Math.max(0, l.y));
      if ((ix * iy) / (p.w * p.h) < 0.85) break;
      l.background = true;
    }
  }
  // 只有一個子圖層的群組不用設成群組
  for (const p of plan.pages) {
    const count = new Map<string, number>();
    for (const l of p.layers) if (l.groupId) count.set(l.groupId, (count.get(l.groupId) ?? 0) + 1);
    for (const l of p.layers) if (l.groupId && (count.get(l.groupId) ?? 0) < 2) l.groupId = null;
  }
  return plan;
}

/** PSD 太大就不讀（整份要讀進瀏覽器記憶體）。 */
export const PSD_MAX_BYTES = 200 * 1024 * 1024;
