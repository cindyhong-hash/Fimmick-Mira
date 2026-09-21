/**
 * 素材變化（assetSubtype）的前台顯示名稱。
 *
 * 只處理「顯示」：key 一律維持資料庫與 API 既有的 kebab-case 值，
 * 不影響選取邏輯、分類、核心標籤或任何資料結構。
 *
 * 原本畫面直接把 key 去掉連字號當標題（clean cutout / formula texture），
 * 對行銷與電商使用者不好懂。改成中文為主、英文降為輔助資訊。
 */
export type ImageSetSubtypeLabel = {
  /** 主標題：一眼看懂要什麼，不用設計背景 */
  zh: string;
  /** 輔助資訊：讓熟悉原始類型的人對得上 */
  en: string;
  /** 回答「選了這個，AI 可以拿它做什麼」 */
  description: string;
};

const LABELS: Record<string, ImageSetSubtypeLabel> = {
  "clean-cutout": {
    zh: "商品去背",
    en: "Clean Cutout",
    description: "提供透明背景的商品主體，方便 AI 將商品放入不同情境與版型。",
  },
  "alternate-angle": {
    zh: "商品其他角度",
    en: "Alternate Angle",
    description: "提供不同視角的商品圖片，讓 AI 可以呈現更豐富的商品角度。",
  },
  "formula-texture": {
    zh: "成分／質地特寫",
    en: "Formula Texture",
    description: "呈現產品的成分、質地或使用觸感，強化商品細節與特色。",
  },
  "primary-scene": {
    zh: "主要情境",
    en: "Primary Scene",
    description: "提供適合放入廣告版面的主要情境背景，建立整體畫面氛圍。",
  },
  "clean-plate": {
    zh: "乾淨背景",
    en: "Clean Plate",
    description: "提供較少干擾的背景，方便後續放入商品、人物或文字。",
  },
  "benefit-metaphor": {
    zh: "功效視覺",
    en: "Benefit Visual",
    description: "將產品核心功效轉化為容易理解的視覺畫面，幫助強化賣點。",
  },
  "brand-motif": {
    zh: "品牌元素",
    en: "Brand Motif",
    description: "提供符合品牌風格的裝飾與視覺元素，建立一致的品牌識別。",
  },

  // 非保養／彩妝類商品走的質地變化。文案沿用同一套句型：
  // 先說「提供什麼」，再說「AI 可以拿它做什麼」。
  "material-detail": {
    zh: "材質細節",
    en: "Material Detail",
    description: "提供商品材質與表面質感的特寫，讓 AI 可以凸顯做工與用料。",
  },
  "fabric-detail": {
    zh: "布料細節",
    en: "Fabric Detail",
    description: "提供布料織紋與表面細節的特寫，讓 AI 可以呈現質料與觸感。",
  },
  "layout-frame": {
    zh: "版面邊框",
    en: "Layout Frame",
    description: "提供可重複使用的邊框與版面元素，讓整批素材的排版更一致。",
  },
};

/** 未知的變化不會壞掉：把 kebab-case 還原成可讀字樣當作輔助名稱。 */
export function imageSetSubtypeLabel(assetSubtype: string | null | undefined): ImageSetSubtypeLabel {
  const key = assetSubtype?.trim() ?? "";
  const known = LABELS[key];
  if (known) return known;
  // 賣點圖示是一組（benefit-icon-1、-2…）。清單上會改用該筆的 benefitTitle
  // 當主標題——四張都叫「賣點圖示」的話分不出誰是誰。這裡留的是沒有
  // benefitTitle 時的後備名稱（例如舊批次），description 留空讓畫面去顯示 purpose。
  if (/^benefit-icon-\d+$/.test(key)) return { zh: "賣點圖示", en: "Benefit Icon", description: "" };
  const readable = key ? key.replaceAll("-", " ") : "視覺素材";
  return { zh: readable, en: "", description: "" };
}

/**
 * 每個素材類型的示意圖，讓人在挑選之前就知道這一項會生出什麼東西。
 *
 * 這些是固定素材（`public/asset-samples/`），不是該品牌自己的圖——它的作用是
 * 「這一項長這樣」，不是預覽成品。都是實際生成出來的縮圖，240px、每張幾 KB。
 */
const SUBTYPE_SAMPLES: Record<string, string> = {
  "clean-cutout": "/asset-samples/clean-cutout.jpg",
  "alternate-angle": "/asset-samples/alternate-angle.jpg",
  "formula-texture": "/asset-samples/formula-texture.jpg",
  "material-detail": "/asset-samples/formula-texture.jpg",
  "fabric-detail": "/asset-samples/formula-texture.jpg",
  "primary-scene": "/asset-samples/primary-scene.jpg",
  "clean-plate": "/asset-samples/clean-plate.jpg",
  "benefit-metaphor": "/asset-samples/benefit-metaphor.jpg",
  "brand-motif": "/asset-samples/brand-motif.jpg",
  "layout-frame": "/asset-samples/layout-frame.jpg",
};

/** @returns 示意圖網址；沒有對應圖的類型回 null（例如賣點圖示，它有自己的風格縮圖）。 */
export function imageSetSubtypeSample(assetSubtype: string | null | undefined): string | null {
  return SUBTYPE_SAMPLES[assetSubtype?.trim() ?? ""] ?? null;
}
