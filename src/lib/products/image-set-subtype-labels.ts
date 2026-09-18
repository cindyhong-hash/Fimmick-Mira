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
    en: "Benefit Metaphor",
    description: "將產品特色或功效轉化成容易理解的視覺元素，幫助強化賣點。",
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
  // 賣點圖示是一組（benefit-icon-1、-2…），共用同一個顯示名稱。
  // description 留空，讓清單與看板改顯示該筆的 purpose——那裡放的是
  // 這個 icon 對應的賣點標題，使用者才分得出哪個是哪個。
  if (/^benefit-icon-\d+$/.test(key)) return { zh: "賣點圖示", en: "Benefit Icon", description: "" };
  const readable = key ? key.replaceAll("-", " ") : "視覺素材";
  return { zh: readable, en: "", description: "" };
}
