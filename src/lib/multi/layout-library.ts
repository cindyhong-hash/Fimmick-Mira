/**
 * Layout Library — Phase 1 規劃層（純資料 + helper，不碰生成 / Sharp / API / Prisma）
 * ─────────────────────────────────────────────────────────────────────────────
 * 目的：提供多圖版型的「知識庫」。每個 Layout 描述格子的座標、角色、文字/產品/主體區、
 * 安全區、閱讀方向與適合的內容類型，供未來階段的 recommend / plan 使用。
 *
 * 這一版是「B 務實版」：約 40 個「真正不同」的版型（幾何或用途明確不同），
 * 而非為湊 80-100 而換名。座標一律 normalized 0..1（原點左上），與畫布比例無關。
 *
 * ⚠️ 本檔完全獨立：不 import 既有 MULTI_LAYOUTS，不修改任何生成邏輯。
 *    現有 multiLayout.ts（CSS grid 版型）維持不動；兩者的對接留待後續階段。
 */

// ─── 型別 ────────────────────────────────────────────────────────────────────

export type LayoutCategory =
  | "BASIC_GRID"
  | "HERO"
  | "PRODUCT_COMMERCE"
  | "SOCIAL_CAROUSEL"
  | "TUTORIAL"
  | "BEFORE_AFTER"
  | "EDITORIAL"
  | "INFOGRAPHIC"
  | "LIFESTYLE"
  | "CTA";

export type ContentType =
  | "announcement"
  | "product"
  | "promotion"
  | "tutorial"
  | "before_after"
  | "editorial"
  | "infographic"
  | "lifestyle"
  | "testimonial"
  | "cta"
  | "story";

export type Zone = "top" | "bottom" | "left" | "right" | "center" | "full" | "none";
export type FrameRole = "hero" | "support" | "detail" | "product" | "text" | "cta" | "step" | "quote";
export type ReadingDirection = "Z" | "F" | "vertical" | "horizontal" | "center-out";
export type TextAmount = "low" | "medium" | "high";

export type LayoutFrame = {
  /** 0-based 格子索引 */
  index: number;
  role: FrameRole;
  /** normalized 座標（0..1，原點左上） */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 由 w:h 化簡出的比例字串（例 "1:1"、"2:1"），方便閱讀 */
  proportion: string;
  /** 視覺份量：1（最輕）..5（主導） */
  visualWeight: number;
  /** 此格內文字建議落點 */
  textZone: Zone;
  /** 此格內產品建議落點 */
  productZone: Zone;
  /** 此格內主體（人物/主角）建議落點 */
  subjectZone: Zone;
  /** 安全區提示（避免被裁切/壓字） */
  safeZone: string;
};

export type Layout = {
  id: string;
  name: string;
  category: LayoutCategory;
  frameCount: number;
  /** 建議畫布比例（不限制，只是推薦時加分用） */
  aspectRatios: string[];
  readingDirection: ReadingDirection;
  recommendedContentType: ContentType[];
  /** 適配條件，供 recommendLayouts 計分 */
  fit: { product: boolean; character: boolean; textAmount: TextAmount };
  frames: LayoutFrame[];
};

// ─── 小工具（純函式，無副作用） ──────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
/** 由 normalized w,h 算出化簡比例字串。 */
function ratioStr(w: number, h: number): string {
  const a = Math.round(w * 1000);
  const b = Math.round(h * 1000);
  const g = gcd(a, b) || 1;
  return `${a / g}:${b / g}`;
}

type FrameOpts = Partial<Omit<LayoutFrame, "index" | "x" | "y" | "w" | "h" | "proportion">>;

/** 建 frame：只需給座標與角色，其餘有合理預設。（o.role 可覆寫，通常與位置參數相同） */
function f(index: number, role: FrameRole, x: number, y: number, w: number, h: number, o: FrameOpts = {}): LayoutFrame {
  const effRole = o.role ?? role;
  const defaultWeight = effRole === "hero" ? 5 : effRole === "product" ? 4 : effRole === "support" ? 3 : effRole === "cta" || effRole === "quote" ? 3 : 2;
  return {
    index,
    role: effRole,
    x,
    y,
    w,
    h,
    proportion: ratioStr(w, h),
    visualWeight: o.visualWeight ?? defaultWeight,
    textZone: o.textZone ?? "none",
    productZone: o.productZone ?? "none",
    subjectZone: o.subjectZone ?? "center",
    safeZone: o.safeZone ?? "邊緣保留 ~6% 淨空，避免壓字或被裁切",
  };
}

/** 建 layout。 */
function L(
  id: string,
  name: string,
  category: LayoutCategory,
  aspectRatios: string[],
  readingDirection: ReadingDirection,
  recommendedContentType: ContentType[],
  fit: Layout["fit"],
  frames: LayoutFrame[],
): Layout {
  return { id, name, category, frameCount: frames.length, aspectRatios, readingDirection, recommendedContentType, fit, frames };
}

/** 產生等分直欄（n 欄）座標。 */
function cols(n: number, role: FrameRole, o: FrameOpts = {}): LayoutFrame[] {
  return Array.from({ length: n }, (_, i) => f(i, role, i / n, 0, 1 / n, 1, o));
}
/** 產生等分橫列（n 列）座標。 */
function rows(n: number, role: FrameRole, o: FrameOpts = {}): LayoutFrame[] {
  return Array.from({ length: n }, (_, i) => f(i, role, 0, i / n, 1, 1 / n, o));
}
/** 產生 c×r 均等網格。 */
function grid(c: number, r: number, role: FrameRole, o: FrameOpts = {}): LayoutFrame[] {
  const out: LayoutFrame[] = [];
  let idx = 0;
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      out.push(f(idx++, role, col / c, row / r, 1 / c, 1 / r, o));
    }
  }
  return out;
}

// ─── 版型庫（約 40 個） ──────────────────────────────────────────────────────

export const LAYOUT_LIBRARY: Layout[] = [
  // ── BASIC_GRID（8）──────────────────────────────────────────────
  L("basic-single", "單圖滿版", "BASIC_GRID", ["1:1", "4:5", "9:16", "16:9"], "center-out", ["announcement", "lifestyle", "product"], { product: true, character: true, textAmount: "low" },
    [f(0, "hero", 0, 0, 1, 1, { visualWeight: 5, textZone: "bottom", productZone: "center", subjectZone: "center" })]),
  L("basic-split-2v", "左右兩等分", "BASIC_GRID", ["1:1", "16:9"], "horizontal", ["product", "before_after", "story"], { product: true, character: true, textAmount: "medium" },
    cols(2, "support", { textZone: "bottom" })),
  L("basic-split-2h", "上下兩等分", "BASIC_GRID", ["4:5", "9:16"], "vertical", ["story", "before_after"], { product: true, character: true, textAmount: "medium" },
    rows(2, "support", { textZone: "bottom" })),
  L("basic-thirds-h", "三等分直欄", "BASIC_GRID", ["16:9", "1:1"], "horizontal", ["product", "editorial", "story"], { product: true, character: true, textAmount: "low" },
    cols(3, "support", { textZone: "bottom" })),
  L("basic-thirds-v", "三等分橫列", "BASIC_GRID", ["9:16", "4:5"], "vertical", ["story", "tutorial"], { product: true, character: true, textAmount: "medium" },
    rows(3, "support", { textZone: "left" })),
  L("basic-grid-4", "四宮格", "BASIC_GRID", ["1:1", "4:5"], "Z", ["product", "lifestyle", "announcement"], { product: true, character: true, textAmount: "low" },
    grid(2, 2, "support", { textZone: "bottom" })),
  L("basic-grid-6", "六宮格（3×2）", "BASIC_GRID", ["1:1", "16:9"], "Z", ["product", "lifestyle", "infographic"], { product: true, character: true, textAmount: "low" },
    grid(3, 2, "detail", { textZone: "bottom" })),
  L("basic-grid-9", "九宮格", "BASIC_GRID", ["1:1"], "Z", ["lifestyle", "product", "announcement"], { product: true, character: true, textAmount: "low" },
    grid(3, 3, "detail")),

  // ── HERO（6）────────────────────────────────────────────────────
  L("hero-full", "主視覺滿版＋大標", "HERO", ["1:1", "4:5", "16:9"], "center-out", ["announcement", "promotion", "cta"], { product: true, character: true, textAmount: "medium" },
    [f(0, "hero", 0, 0, 1, 1, { visualWeight: 5, textZone: "top", subjectZone: "center", safeZone: "上 1/3 留給大標，主體置中偏下" })]),
  L("hero-top-2cards", "主視覺上＋兩卡下", "HERO", ["4:5", "1:1"], "F", ["announcement", "product", "story"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 1, 0.6, { visualWeight: 5, textZone: "top", subjectZone: "center" }),
      f(1, "support", 0, 0.6, 0.5, 0.4, { textZone: "bottom" }),
      f(2, "support", 0.5, 0.6, 0.5, 0.4, { textZone: "bottom" }),
    ]),
  L("hero-top-3cards", "主視覺上＋三卡下", "HERO", ["1:1", "4:5"], "F", ["product", "story", "infographic"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 1, 0.58, { visualWeight: 5, textZone: "top" }),
      f(1, "support", 0, 0.58, 1 / 3, 0.42, { textZone: "bottom" }),
      f(2, "support", 1 / 3, 0.58, 1 / 3, 0.42, { textZone: "bottom" }),
      f(3, "support", 2 / 3, 0.58, 1 / 3, 0.42, { textZone: "bottom" }),
    ]),
  L("hero-left-2right", "大左＋右兩小", "HERO", ["16:9", "1:1"], "F", ["product", "editorial", "story"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 0.6, 1, { visualWeight: 5, textZone: "bottom", subjectZone: "center" }),
      f(1, "support", 0.6, 0, 0.4, 0.5, { textZone: "right" }),
      f(2, "support", 0.6, 0.5, 0.4, 0.5, { textZone: "right" }),
    ]),
  L("hero-right-2left", "大右＋左兩小", "HERO", ["16:9", "1:1"], "F", ["product", "editorial", "story"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0.4, 0, 0.6, 1, { visualWeight: 5, textZone: "bottom", subjectZone: "center" }),
      f(1, "support", 0, 0, 0.4, 0.5, { textZone: "left" }),
      f(2, "support", 0, 0.5, 0.4, 0.5, { textZone: "left" }),
    ]),
  L("hero-center-surround", "中央主視覺＋四邊環繞", "HERO", ["1:1"], "center-out", ["announcement", "product", "lifestyle"], { product: true, character: true, textAmount: "low" },
    [
      f(0, "hero", 0.2, 0.2, 0.6, 0.6, { visualWeight: 5, subjectZone: "center", productZone: "center" }),
      f(1, "detail", 0, 0, 1, 0.2, { textZone: "center" }),
      f(2, "detail", 0, 0.8, 1, 0.2, { textZone: "center" }),
      f(3, "detail", 0, 0.2, 0.2, 0.6),
      f(4, "detail", 0.8, 0.2, 0.2, 0.6),
    ]),

  // ── PRODUCT_COMMERCE（5）───────────────────────────────────────
  L("product-hero-benefits3", "產品主圖＋三賣點條", "PRODUCT_COMMERCE", ["4:5", "1:1"], "F", ["product", "promotion"], { product: true, character: false, textAmount: "high" },
    [
      f(0, "product", 0, 0, 1, 0.55, { visualWeight: 5, productZone: "center", textZone: "top" }),
      f(1, "text", 0, 0.55, 1 / 3, 0.45, { role: "text", textZone: "center" }),
      f(2, "text", 1 / 3, 0.55, 1 / 3, 0.45, { textZone: "center" }),
      f(3, "text", 2 / 3, 0.55, 1 / 3, 0.45, { textZone: "center" }),
    ]),
  L("product-2col-specs", "產品左＋規格右", "PRODUCT_COMMERCE", ["1:1", "16:9"], "horizontal", ["product"], { product: true, character: false, textAmount: "high" },
    [
      f(0, "product", 0, 0, 0.5, 1, { visualWeight: 5, productZone: "center" }),
      f(1, "text", 0.5, 0, 0.5, 1, { textZone: "full", subjectZone: "center", safeZone: "右欄整欄放規格/賣點清單" }),
    ]),
  L("product-grid-collection", "產品系列四格", "PRODUCT_COMMERCE", ["1:1", "4:5"], "Z", ["product", "promotion"], { product: true, character: false, textAmount: "low" },
    grid(2, 2, "product", { productZone: "center", textZone: "bottom" })),
  L("product-lifestyle-split", "產品＋情境並置", "PRODUCT_COMMERCE", ["1:1", "16:9"], "horizontal", ["product", "lifestyle"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "product", 0, 0, 0.5, 1, { visualWeight: 4, productZone: "center", textZone: "bottom" }),
      f(1, "support", 0.5, 0, 0.5, 1, { subjectZone: "center", textZone: "bottom" }),
    ]),
  L("product-promo-price", "促銷主視覺＋價格帶", "PRODUCT_COMMERCE", ["4:5", "1:1"], "vertical", ["promotion", "cta"], { product: true, character: false, textAmount: "high" },
    [
      f(0, "product", 0, 0, 1, 0.72, { visualWeight: 5, productZone: "center", textZone: "top" }),
      f(1, "cta", 0, 0.72, 1, 0.28, { role: "cta", textZone: "center", safeZone: "價格/優惠碼置中，字體加粗" }),
    ]),

  // ── SOCIAL_CAROUSEL（4）────────────────────────────────────────
  L("carousel-cover", "輪播封面（大標）", "SOCIAL_CAROUSEL", ["4:5", "1:1", "9:16"], "center-out", ["story", "announcement"], { product: true, character: true, textAmount: "high" },
    [f(0, "hero", 0, 0, 1, 1, { visualWeight: 5, textZone: "center", safeZone: "封面標題置中，主體弱化作背景" })]),
  L("carousel-2seq", "輪播兩段", "SOCIAL_CAROUSEL", ["4:5", "9:16"], "vertical", ["story", "tutorial"], { product: true, character: true, textAmount: "medium" },
    rows(2, "step", { textZone: "bottom" })),
  L("carousel-3seq", "輪播三段", "SOCIAL_CAROUSEL", ["4:5", "9:16"], "vertical", ["story", "tutorial"], { product: true, character: true, textAmount: "medium" },
    rows(3, "step", { textZone: "bottom" })),
  L("carousel-cover-4", "封面＋四格輪播", "SOCIAL_CAROUSEL", ["4:5", "1:1"], "F", ["story", "product", "infographic"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 1, 0.4, { visualWeight: 5, textZone: "center" }),
      f(1, "detail", 0, 0.4, 0.5, 0.3, { textZone: "bottom" }),
      f(2, "detail", 0.5, 0.4, 0.5, 0.3, { textZone: "bottom" }),
      f(3, "detail", 0, 0.7, 0.5, 0.3, { textZone: "bottom" }),
      f(4, "detail", 0.5, 0.7, 0.5, 0.3, { textZone: "bottom" }),
    ]),

  // ── TUTORIAL（4）───────────────────────────────────────────────
  L("tutorial-2steps", "教學兩步驟", "TUTORIAL", ["4:5", "9:16"], "vertical", ["tutorial"], { product: true, character: true, textAmount: "high" },
    rows(2, "step", { textZone: "left", safeZone: "左側放步驟編號＋說明" })),
  L("tutorial-3steps-h", "教學三步驟（橫）", "TUTORIAL", ["16:9", "1:1"], "horizontal", ["tutorial", "infographic"], { product: true, character: true, textAmount: "high" },
    cols(3, "step", { textZone: "bottom", safeZone: "每欄底部放步驟號＋說明" })),
  L("tutorial-4steps-grid", "教學四步驟格", "TUTORIAL", ["1:1", "4:5"], "Z", ["tutorial"], { product: true, character: true, textAmount: "high" },
    grid(2, 2, "step", { textZone: "bottom" })),
  L("tutorial-6steps", "教學六步驟（3×2）", "TUTORIAL", ["1:1"], "Z", ["tutorial", "infographic"], { product: true, character: true, textAmount: "high" },
    grid(3, 2, "step", { textZone: "bottom" })),

  // ── BEFORE_AFTER（3）───────────────────────────────────────────
  L("ba-vertical-split", "前後對比（左右）", "BEFORE_AFTER", ["1:1", "16:9"], "horizontal", ["before_after"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "support", 0, 0, 0.5, 1, { textZone: "top", safeZone: "左＝Before，頂部標記" }),
      f(1, "support", 0.5, 0, 0.5, 1, { textZone: "top", safeZone: "右＝After，頂部標記" }),
    ]),
  L("ba-horizontal-split", "前後對比（上下）", "BEFORE_AFTER", ["4:5", "9:16"], "vertical", ["before_after"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "support", 0, 0, 1, 0.5, { textZone: "left", safeZone: "上＝Before" }),
      f(1, "support", 0, 0.5, 1, 0.5, { textZone: "left", safeZone: "下＝After" }),
    ]),
  L("ba-progress-3", "前中後三段進程", "BEFORE_AFTER", ["16:9", "1:1"], "horizontal", ["before_after", "tutorial"], { product: true, character: true, textAmount: "medium" },
    cols(3, "step", { textZone: "bottom", safeZone: "三欄＝前 / 中 / 後，底部標時間點" })),

  // ── EDITORIAL（4）──────────────────────────────────────────────
  L("editorial-fullbleed", "雜誌滿版留白", "EDITORIAL", ["4:5", "16:9"], "center-out", ["editorial", "lifestyle"], { product: false, character: true, textAmount: "low" },
    [f(0, "hero", 0, 0, 1, 1, { visualWeight: 5, textZone: "left", subjectZone: "right", safeZone: "大量留白，標題壓左側淨空區" })]),
  L("editorial-2-asym", "雜誌不對稱（圖2/3＋文1/3）", "EDITORIAL", ["16:9", "1:1"], "horizontal", ["editorial", "product"], { product: true, character: true, textAmount: "high" },
    [
      f(0, "hero", 0, 0, 0.66, 1, { visualWeight: 5, subjectZone: "center" }),
      f(1, "text", 0.66, 0, 0.34, 1, { textZone: "full", safeZone: "窄欄整欄放標題＋內文" }),
    ]),
  L("editorial-3-mixed", "雜誌混排（大左＋右上下）", "EDITORIAL", ["1:1", "16:9"], "F", ["editorial", "lifestyle"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 0.55, 1, { visualWeight: 5, subjectZone: "center", textZone: "bottom" }),
      f(1, "detail", 0.55, 0, 0.45, 0.45, { textZone: "top" }),
      f(2, "detail", 0.55, 0.55, 0.45, 0.45, { textZone: "bottom", safeZone: "右側中間帶留給引文/標題" }),
    ]),
  L("editorial-cover-quote", "封面＋引文帶", "EDITORIAL", ["4:5", "1:1"], "vertical", ["editorial", "testimonial"], { product: false, character: true, textAmount: "high" },
    [
      f(0, "hero", 0, 0, 1, 0.7, { visualWeight: 5, subjectZone: "center" }),
      f(1, "quote", 0, 0.7, 1, 0.3, { role: "quote", textZone: "center", safeZone: "引文置中，大字重" }),
    ]),

  // ── INFOGRAPHIC（3）────────────────────────────────────────────
  L("info-timeline-v", "垂直時間軸（4 節點）", "INFOGRAPHIC", ["9:16", "4:5"], "vertical", ["infographic", "tutorial"], { product: false, character: false, textAmount: "high" },
    rows(4, "step", { textZone: "right", safeZone: "左側時間軸線＋點，右側說明" })),
  L("info-checklist", "檢查清單", "INFOGRAPHIC", ["4:5", "9:16"], "vertical", ["infographic", "tutorial"], { product: false, character: false, textAmount: "high" },
    [f(0, "text", 0, 0, 1, 1, { role: "text", textZone: "full", visualWeight: 2, safeZone: "整版列點清單，背景弱化" })]),
  L("info-faq-3", "FAQ 三問答", "INFOGRAPHIC", ["4:5", "1:1"], "vertical", ["infographic", "testimonial"], { product: false, character: false, textAmount: "high" },
    rows(3, "text", { role: "text", textZone: "full", safeZone: "每列一組 Q＋A" })),

  // ── LIFESTYLE（3）──────────────────────────────────────────────
  L("lifestyle-full", "生活情境滿版", "LIFESTYLE", ["4:5", "9:16", "1:1"], "center-out", ["lifestyle"], { product: true, character: true, textAmount: "low" },
    [f(0, "hero", 0, 0, 1, 1, { visualWeight: 5, subjectZone: "center", textZone: "bottom", safeZone: "沉浸情境，文字極簡壓底" })]),
  L("lifestyle-2-mood", "情境兩格", "LIFESTYLE", ["1:1", "4:5"], "horizontal", ["lifestyle", "story"], { product: true, character: true, textAmount: "low" },
    cols(2, "support", { subjectZone: "center", textZone: "bottom" })),
  L("lifestyle-4-collage", "情境拼貼（非對稱四格）", "LIFESTYLE", ["1:1", "4:5"], "Z", ["lifestyle", "story"], { product: true, character: true, textAmount: "low" },
    [
      f(0, "hero", 0, 0, 0.6, 0.6, { visualWeight: 5, subjectZone: "center" }),
      f(1, "detail", 0.6, 0, 0.4, 0.6),
      f(2, "detail", 0, 0.6, 0.4, 0.4),
      f(3, "detail", 0.4, 0.6, 0.6, 0.4, { textZone: "bottom" }),
    ]),

  // ── CTA（3）────────────────────────────────────────────────────
  L("cta-hero-band", "主視覺＋行動帶", "CTA", ["4:5", "1:1"], "vertical", ["cta", "promotion"], { product: true, character: true, textAmount: "medium" },
    [
      f(0, "hero", 0, 0, 1, 0.78, { visualWeight: 5, subjectZone: "center", productZone: "center" }),
      f(1, "cta", 0, 0.78, 1, 0.22, { role: "cta", textZone: "center", safeZone: "行動呼籲置中，按鈕感的色塊" }),
    ]),
  L("cta-testimonial", "見證＋行動", "CTA", ["1:1", "16:9"], "horizontal", ["testimonial", "cta"], { product: false, character: true, textAmount: "high" },
    [
      f(0, "support", 0, 0, 0.4, 1, { subjectZone: "center", safeZone: "左側人物頭像/情境" }),
      f(1, "quote", 0.4, 0, 0.6, 1, { role: "quote", textZone: "full", safeZone: "右側引言＋姓名＋行動呼籲" }),
    ]),
  L("cta-promo-code", "優惠碼主視覺", "CTA", ["1:1", "4:5"], "center-out", ["promotion", "cta"], { product: true, character: false, textAmount: "high" },
    [
      f(0, "product", 0, 0, 1, 0.68, { visualWeight: 5, productZone: "center" }),
      f(1, "cta", 0, 0.68, 1, 0.32, { role: "cta", textZone: "center", safeZone: "優惠碼＋期限，高對比色塊" }),
    ]),
];

// ─── 查詢 helper ─────────────────────────────────────────────────────────────

export function getLayoutById(id: string): Layout | undefined {
  return LAYOUT_LIBRARY.find((l) => l.id === id);
}

export function getLayoutsByCategory(category: LayoutCategory): Layout[] {
  return LAYOUT_LIBRARY.filter((l) => l.category === category);
}

export type RecommendInput = {
  imageCount: number;
  contentType?: ContentType;
  aspectRatio?: string;
  hasProduct?: boolean;
  hasCharacter?: boolean;
  textAmount?: TextAmount;
};

export type RecommendResult = { layout: Layout; score: number; reasons: string[] };

const TEXT_ORDER: TextAmount[] = ["low", "medium", "high"];

/**
 * 依輸入條件計分排序推薦版型（deterministic，無 random）。
 * 計分權重：格數吻合最重（決定可用性），其次內容類型，再來比例/產品/人物/文字量。
 */
export function recommendLayouts(input: RecommendInput, limit = 5): RecommendResult[] {
  const results: RecommendResult[] = LAYOUT_LIBRARY.map((layout) => {
    let score = 0;
    const reasons: string[] = [];

    // 1) 格數吻合（最關鍵）：差 0 大加分、差 1 小加分、差 ≥2 重扣（幾乎排除）
    const diff = Math.abs(layout.frameCount - input.imageCount);
    if (diff === 0) { score += 50; reasons.push("格數完全吻合"); }
    else if (diff === 1) { score += 12; reasons.push("格數相近（差 1）"); }
    else { score -= 100; reasons.push("格數不合"); }

    // 2) 內容類型
    if (input.contentType && layout.recommendedContentType.includes(input.contentType)) {
      score += 25; reasons.push(`適合內容類型：${input.contentType}`);
    }

    // 3) 畫布比例
    if (input.aspectRatio && layout.aspectRatios.includes(input.aspectRatio)) {
      score += 12; reasons.push(`比例吻合：${input.aspectRatio}`);
    }

    // 4) 產品
    if (input.hasProduct !== undefined) {
      if (input.hasProduct && layout.fit.product) { score += 8; reasons.push("支援產品呈現"); }
      else if (input.hasProduct && !layout.fit.product) { score -= 6; reasons.push("此版型不適合放產品"); }
    }

    // 5) 人物
    if (input.hasCharacter !== undefined) {
      if (input.hasCharacter && layout.fit.character) { score += 6; reasons.push("支援人物呈現"); }
      else if (input.hasCharacter && !layout.fit.character) { score -= 4; reasons.push("此版型偏無人物"); }
    }

    // 6) 文字量（完全吻合加分、相鄰略加）
    if (input.textAmount) {
      const d = Math.abs(TEXT_ORDER.indexOf(input.textAmount) - TEXT_ORDER.indexOf(layout.fit.textAmount));
      if (d === 0) { score += 10; reasons.push("文字量吻合"); }
      else if (d === 1) { score += 4; reasons.push("文字量相近"); }
    }

    return { layout, score, reasons };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.layout.id.localeCompare(b.layout.id))
    .slice(0, limit);
}

/** 報表用：各 category 版型數量。 */
export function layoutCountByCategory(): Record<LayoutCategory, number> {
  const out = {} as Record<LayoutCategory, number>;
  for (const l of LAYOUT_LIBRARY) out[l.category] = (out[l.category] ?? 0) + 1;
  return out;
}
