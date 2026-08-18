/**
 * Cell Design Library — 「格內設計變化庫」（規劃層，純資料＋挑選函式）
 * ─────────────────────────────────────────────────────────────────────────────
 * 方向：外框固定用現有 12 個 FB 版型（MULTI_LAYOUTS，可直接上傳），本庫只負責
 *       「同一個固定外框內，每一格要用什麼設計」——依該格特性（主圖/附圖、比例、
 *       內容類型）挑「攝影構圖」＋「平面卡片樣式」，逐格不同 → 同一外框生出多種設計。
 *
 * 不新增外框、不改 Sharp/合成介面、不改 API/Prisma。只提供：
 *   - PHOTO_COMPOSITIONS：攝影構圖預設（餵給 AI 生圖 prompt）
 *   - graphicCandidates()：依格特性回傳合適的圖卡樣式（現成 SubCardVariant）
 *   - assignCellDesigns()：把某個外框的每一格，指派「符合版型特性」的設計（deterministic）
 */

import { getMultiLayout } from "@/types/multiLayout";
import type { SubCardVariant } from "@/lib/composite-multi";

export type CellRole = "main" | "support";
export type ContentType =
  | "product" | "lifestyle" | "promotion" | "tutorial"
  | "before_after" | "testimonial" | "announcement" | "editorial";

/** 比例分桶：wide（橫）/ square（方）/ tall（直） */
export type AspectBucket = "wide" | "square" | "tall";
export function aspectBucket(aspect: string): AspectBucket {
  const [w, h] = (aspect || "1:1").split(":").map(Number);
  if (!w || !h || w === h) return "square";
  return w > h ? "wide" : "tall";
}

// ── 攝影構圖預設（每格的「畫面怎麼拍」）────────────────────────────────────
export type PhotoComposition = {
  id: string;
  name: string;
  roles: CellRole[];
  /** 適合比例桶（空＝通用） */
  buckets?: AspectBucket[];
  contentTypes?: ContentType[];
  /** 餵進 AI 生圖 prompt 的英文構圖指示 */
  promptHint: string;
};

export const PHOTO_COMPOSITIONS: PhotoComposition[] = [
  // 主圖（establishing / 較大）
  { id: "hero-window-lifestyle", name: "窗邊生活情境", roles: ["main"], contentTypes: ["lifestyle", "announcement", "editorial"],
    promptHint: "medium shot, subject by a bright window with soft natural light, aspirational lifestyle mood, generous clean space reserved for a headline" },
  { id: "hero-product-in-hand", name: "手持產品使用中", roles: ["main"], contentTypes: ["product", "promotion"],
    promptHint: "medium close-up, subject holding/using the product naturally, product clearly visible and in focus, clean uncluttered background" },
  { id: "hero-flatlay-topdown", name: "俯拍平擺", roles: ["main"], buckets: ["square", "wide"], contentTypes: ["product", "editorial"],
    promptHint: "top-down flat-lay, product arranged with a few complementary props on a clean surface, balanced negative space" },
  { id: "hero-editorial-negative", name: "雜誌式留白", roles: ["main"], contentTypes: ["editorial", "lifestyle"],
    promptHint: "editorial composition, subject placed off-center with large negative space, calm magazine aesthetic" },
  { id: "hero-scene-wide", name: "寬景情境", roles: ["main"], buckets: ["wide"], contentTypes: ["lifestyle", "announcement"],
    promptHint: "wide environmental shot establishing the scene, subject integrated into a airy real-life setting" },

  // 附圖（detail / support，較小）
  { id: "detail-product-macro", name: "產品微距特寫", roles: ["support"], contentTypes: ["product", "promotion"],
    promptHint: "macro close-up of the product, crisp texture and material detail, shallow depth of field, clean backdrop" },
  { id: "detail-in-use", name: "使用瞬間", roles: ["support"], contentTypes: ["product", "tutorial", "lifestyle"],
    promptHint: "close-up of hands applying/using the product, authentic in-use moment, soft light" },
  { id: "detail-ingredient", name: "成分/質地", roles: ["support"], contentTypes: ["product", "editorial"],
    promptHint: "close-up of the product texture or key ingredient (droplet, cream swatch, botanical), fresh and clean" },
  { id: "detail-lifestyle-vignette", name: "生活小景", roles: ["support"], contentTypes: ["lifestyle", "testimonial", "editorial"],
    promptHint: "small lifestyle vignette, cozy detail of the setting, warm inviting mood" },
  { id: "detail-flatlay-mini", name: "小俯拍", roles: ["support"], buckets: ["square"], contentTypes: ["product", "promotion"],
    promptHint: "compact top-down arrangement of the product with one or two props, tidy and balanced" },
  { id: "detail-portrait-tall", name: "直幅人物", roles: ["support"], buckets: ["tall"], contentTypes: ["lifestyle", "testimonial"],
    promptHint: "vertical portrait of the subject in-scene, head-to-mid framing suited to a tall cell, clean side space for a caption" },
  { id: "detail-before-after", name: "對比細節", roles: ["support"], contentTypes: ["before_after", "tutorial"],
    promptHint: "clear comparison-style detail shot emphasizing a visible difference, neutral consistent framing" },
];

// ── 平面卡片樣式（每格的「文字/圖卡怎麼排」）──────────────────────────────
// 依 格角色 × 比例桶 × 內容 挑合適的現成 SubCardVariant（不新增卡片，用現有 17 種）
export function graphicCandidates(opts: {
  role: CellRole;
  bucket: AspectBucket;
  contentType?: ContentType;
  hasPrice?: boolean;
}): SubCardVariant[] {
  const { role, bucket, contentType, hasPrice } = opts;

  // 主圖：以大標為主，卡片走「大圖＋頂/底文字」類，不搶版面
  if (role === "main") {
    if (bucket === "wide") return ["photo-full-top-text", "banner-bottom", "gradient-bottom"];
    if (bucket === "tall") return ["photo-full-top-text", "minimal-top-label-card", "gradient-bottom"];
    return ["photo-full-top-text", "title-top-caption-bottom", "gradient-bottom"];
  }

  // 促銷/有價格：優先價格/緞帶類
  if (hasPrice || contentType === "promotion") {
    return ["card-price-bottom", "speech-bubble-price", "diagonal-ribbon-card", "ribbon-top-card"];
  }
  // 見證/敘事：對話泡泡/標題卡
  if (contentType === "testimonial") {
    return ["speech-bubble-price", "title-top-caption-bottom", "corner-label-card"];
  }
  // 教學/前後：標籤/緞帶（帶步驟感）
  if (contentType === "tutorial" || contentType === "before_after") {
    return ["ribbon-tab-card", "corner-label-card", "minimal-top-label-card", "badge-top-left"];
  }

  // 一般附圖：依比例桶挑最貼形狀的
  if (bucket === "wide") return ["banner-bottom", "photo-full-top-text", "gradient-bottom"];
  if (bucket === "tall") return ["side-accent", "split-left-text", "minimal-top-label-card"];
  // square
  return ["badge-top-left", "photo-caption-pill", "title-top-caption-bottom", "ribbon-top-card", "corner-label-card"];
}

// ── 指派：把一個外框的每格，指派「符合版型特性」的設計 ────────────────────
export type CellDesign = {
  cell: number;
  role: CellRole;
  aspect: string;
  bucket: AspectBucket;
  photoCompositionId: string;
  photoPromptHint: string;
  cardVariant: SubCardVariant;
};

export type AssignInput = {
  contentType?: ContentType;
  hasProduct?: boolean;
  hasPrice?: boolean;
  /** 變化用種子（同外框給不同 seed → 得到不同但合理的設計組合）。 */
  seed?: number;
};

/** 簡單穩定 hash（deterministic，不用 Math.random）。 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick<T>(arr: T[], seedKey: string, fallback: T): T {
  if (!arr.length) return fallback;
  return arr[hashStr(seedKey) % arr.length];
}

/**
 * 依外框 id 的每一格特性，指派攝影構圖＋卡片樣式。
 * - 逐格用 seed+cellIndex 挑選 → 同一外框每格設計不同、且換 seed 會整組變化。
 * - 若外框 id 不在 12 個內，回傳空陣列（呼叫端 fallback 現有行為）。
 */
export function assignCellDesigns(layoutId: string, input: AssignInput = {}): CellDesign[] {
  const ml = getMultiLayout(layoutId);
  if (!ml) return [];
  const { contentType, hasPrice, seed = 0 } = input;

  return ml.cells.map((cell, i) => {
    const role: CellRole = cell.main ? "main" : "support";
    const aspect = ml.cellAspects[i] ?? "1:1";
    const bucket = aspectBucket(aspect);

    // 攝影構圖：先依 role 過濾，再依比例桶/內容加權，最後 seeded 挑一個
    const photoPool = PHOTO_COMPOSITIONS.filter((p) => {
      if (!p.roles.includes(role)) return false;
      if (p.buckets && !p.buckets.includes(bucket)) return false;
      if (p.contentTypes && contentType && !p.contentTypes.includes(contentType)) return false;
      return true;
    });
    // 若加了 contentType 過濾後沒得選，放寬（只看 role + bucket）
    const photoPoolSafe = photoPool.length ? photoPool
      : PHOTO_COMPOSITIONS.filter((p) => p.roles.includes(role) && (!p.buckets || p.buckets.includes(bucket)));
    const photo = pick(photoPoolSafe, `${layoutId}-photo-${i}-${seed}`, PHOTO_COMPOSITIONS[role === "main" ? 0 : 5]);

    // 卡片樣式：依格特性取候選，seeded 挑一個
    const cards = graphicCandidates({ role, bucket, contentType, hasPrice });
    const cardVariant = pick(cards, `${layoutId}-card-${i}-${seed}`, "title-top-caption-bottom");

    return { cell: i, role, aspect, bucket, photoCompositionId: photo.id, photoPromptHint: photo.promptHint, cardVariant };
  });
}
