import type { SavedLayer } from "./saved-layer.ts";

/**
 * 版型設計系統。
 *
 * 前三版的公版做出來像「工程師排元件」：先想一個格子，再把圖片、標題、按鈕
 * 塞進去，四邊留白一樣寬，所有東西置中。問題不在缺功能，在於**沒有先定義
 * 設計決策**——版面只是排列，不是構成。
 *
 * 這個模組把設計決策變成資料與可執行的檢查：每個版型都要先宣告它的構成方式、
 * 視覺層級、視覺重量、閱讀動線與留白比例，並且說得出「為什麼這樣好看」。
 * 宣告完之後，`auditTemplate()` 會拿實際圖層去驗證宣告是否屬實——
 * 宣告 40% 留白但畫面塞滿，或宣告商品是主角但它在畫面上最小，都會被擋下來。
 *
 * 這樣才擋得住「只是把元素排整齊」的版型混進來。
 */

/** 構成方式。不是「格子」，是畫面怎麼被組織起來。 */
export const COMPOSITION_TYPES = [
  "centered-hero", "asymmetrical-hero", "full-bleed-image", "split-screen",
  "diagonal", "editorial", "magazine", "collage", "overlap", "frame-within-frame",
  "large-typography", "typography-as-image", "product-floating", "product-bottom-anchor",
  "product-side-anchor", "product-cluster", "image-cutout", "layered",
  "minimal-negative-space", "dense-information", "dynamic", "luxury-minimal",
  "lifestyle-editorial",
] as const;
export type CompositionType = typeof COMPOSITION_TYPES[number];

/** 設計家族。同一家族共用氣質，但構成方式必須彼此不同。 */
export const TEMPLATE_FAMILIES = [
  "editorial", "luxury", "minimal", "ecommerce", "promotional", "lifestyle",
  "bold-typography", "product-focus", "collage", "magazine", "swiss",
  "dynamic", "organic", "tech", "fashion",
] as const;
export type TemplateFamily = typeof TEMPLATE_FAMILIES[number];

/** 閱讀動線：眼睛進入畫面之後怎麼走。 */
export const READING_DIRECTIONS = [
  "top-left→bottom-right", "top-right→bottom-left", "center→outward",
  "bottom-left→top-right", "top→bottom", "left→right", "z-path",
] as const;
export type ReadingDirection = typeof READING_DIRECTIONS[number];

/** 角色。視覺重量與層級都掛在這上面。 */
export type TemplateRole =
  | "product" | "headline" | "subhead" | "copy" | "cta"
  | "price" | "badge" | "decoration" | "background" | "supportingImage";

/** 留白帶。留白是設計的一部分，不是「還沒放東西」。 */
export type NegativeSpaceBand = "minimal" | "balanced" | "dense";

export function negativeSpaceBand(ratio: number): NegativeSpaceBand {
  if (ratio >= 0.40) return "minimal";
  if (ratio >= 0.25) return "balanced";
  return "dense";
}

export type TemplateArtDirection = {
  name: string;
  family: TemplateFamily;
  composition: CompositionType;
  /** 由主到次，至少三層，不可以每個元素都同等重要。 */
  visualHierarchy: TemplateRole[];
  /** 1–10。主角要明顯重過配角，不是每個都 7 分。 */
  visualWeight: Partial<Record<TemplateRole, number>>;
  readingDirection: ReadingDirection;
  /** 宣告的留白比例，0–1。會拿實際圖層驗證。 */
  negativeSpace: number;
  /** 這個版型為什麼好看。必須講構成關係，不能只說元素放哪。 */
  rationale: string;
  recommendedFor: string;
};

/**
 * 設計理由必須講得出「構成關係」，不能只報位置。
 *
 * 用「有沒有提到關係」來判定，而不是「有沒有提到左右」——好的理由本來就會
 * 講到位置（「錨在左下三分之一」），只擋位置詞會把正確答案一起擋掉。
 */
const RELATIONAL_TERMS = /(動線|對角|張力|層次|呼應|壓住|壓在|破框|錨|重心|節奏|反差|對比|引導|貫穿|留白|視線|平衡|呼吸)/;

export function assertValidArtDirection(ad: TemplateArtDirection): void {
  const where = `版型「${ad.name}」`;
  if (ad.visualHierarchy.length < 3) {
    throw new Error(`${where} 的 visualHierarchy 至少要三層——每個元素都同等重要就是沒有層級`);
  }
  if (new Set(ad.visualHierarchy).size !== ad.visualHierarchy.length) {
    throw new Error(`${where} 的 visualHierarchy 有重複角色`);
  }
  const weights = Object.values(ad.visualWeight).filter((w): w is number => typeof w === "number");
  if (weights.some((w) => w < 1 || w > 10)) throw new Error(`${where} 的 visualWeight 必須在 1–10`);
  const [primary] = ad.visualHierarchy;
  const primaryWeight = ad.visualWeight[primary] ?? 0;
  if (primaryWeight < Math.max(...weights)) {
    throw new Error(`${where} 宣告 ${primary} 是主角，但它的 visualWeight 不是最高`);
  }
  if (Math.max(...weights) - Math.min(...weights) < 4) {
    throw new Error(`${where} 的 visualWeight 落差不足 4——主配角分不開，畫面會平`);
  }
  if (ad.negativeSpace <= 0 || ad.negativeSpace >= 1) {
    throw new Error(`${where} 的 negativeSpace 要是 0–1 之間的比例`);
  }
  const rationale = ad.rationale.trim();
  if (rationale.length < 30 || !RELATIONAL_TERMS.test(rationale)) {
    throw new Error(`${where} 的 rationale 只描述了位置——要說明構成關係為什麼成立`);
  }
}

/**
 * 量實際圖層的留白比例。
 *
 * 用格子取樣而不是加總面積：圖層會互相重疊，直接相加會超過 100%。
 * 背景不算佔用——整片底色本來就是留白的載體。
 */
export function measureNegativeSpace(layers: SavedLayer[], canvas: number, grid = 60): number {
  const cell = canvas / grid;
  const covered = new Uint8Array(grid * grid);
  for (const l of layers) {
    if (l.type === "background" || l.visible === false) continue;
    if ((l.opacity ?? 1) < 0.15) continue;
    const x0 = Math.max(0, Math.floor(l.x / cell));
    const y0 = Math.max(0, Math.floor(l.y / cell));
    const x1 = Math.min(grid - 1, Math.ceil((l.x + l.w) / cell) - 1);
    const y1 = Math.min(grid - 1, Math.ceil((l.y + l.h) / cell) - 1);
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) covered[y * grid + x] = 1;
  }
  const used = covered.reduce((n, v) => n + v, 0);
  return 1 - used / (grid * grid);
}

/** 量某個角色在畫面上實際佔多大（最大單一圖層的面積比）。 */
export function measureRoleArea(layers: SavedLayer[], canvas: number, match: (l: SavedLayer) => boolean): number {
  const areas = layers.filter((l) => l.type !== "background" && match(l)).map((l) => (l.w * l.h) / (canvas * canvas));
  return areas.length ? Math.max(...areas) : 0;
}

export type TemplateAudit = { ok: boolean; problems: string[]; measured: { negativeSpace: number } };

/**
 * 拿實際圖層驗證宣告。
 *
 * 宣告是設計意圖，圖層是事實；兩者對不上就是版型沒做到自己說的事。
 * 容許 ±0.12 的誤差，因為圖層框比實際墨水大（文字框、去背圖的透明邊）。
 */
export function auditTemplate(ad: TemplateArtDirection, layers: SavedLayer[], canvas: number): TemplateAudit {
  const problems: string[] = [];
  const measured = measureNegativeSpace(layers, canvas);

  if (Math.abs(measured - ad.negativeSpace) > 0.12) {
    problems.push(`宣告留白 ${(ad.negativeSpace * 100).toFixed(0)}%，實際 ${(measured * 100).toFixed(0)}%`);
  }
  if (ad.visualHierarchy[0] === "product") {
    const product = measureRoleArea(layers, canvas, (l) => !!l.image);
    const headline = measureRoleArea(layers, canvas, (l) => !!l.isText && (l.fontSize ?? 0) >= 80);
    if (product > 0 && headline > product) {
      problems.push("宣告商品是主角，但標題在畫面上比商品大");
    }
  }
  if (layers.filter((l) => l.type !== "background").length < 4) {
    problems.push("元素太少，構成不成立");
  }
  return { ok: problems.length === 0, problems, measured: { negativeSpace: measured } };
}

/**
 * 同一家族內的兩個版型必須真的不同。
 *
 * 「圖左字右」對「圖右字左」不算兩個版型。至少要在構成方式、主角、
 * 留白帶、閱讀動線這四項裡變三項。
 */
export function isDistinctEnough(a: TemplateArtDirection, b: TemplateArtDirection): boolean {
  let changed = 0;
  if (a.composition !== b.composition) changed += 1;
  if (a.visualHierarchy[0] !== b.visualHierarchy[0]) changed += 1;
  if (negativeSpaceBand(a.negativeSpace) !== negativeSpaceBand(b.negativeSpace)) changed += 1;
  if (a.readingDirection !== b.readingDirection) changed += 1;
  return changed >= 3;
}

export function assertFamilyIsVaried(family: TemplateArtDirection[]): void {
  for (let i = 0; i < family.length; i += 1) {
    for (let j = i + 1; j < family.length; j += 1) {
      if (!isDistinctEnough(family[i], family[j])) {
        throw new Error(
          `「${family[i].name}」與「${family[j].name}」差異不足——構成／主角／留白帶／閱讀動線至少要變三項`,
        );
      }
    }
  }
}
