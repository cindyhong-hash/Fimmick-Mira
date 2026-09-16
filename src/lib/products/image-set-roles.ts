import { PROMO_FIXED, TAIWAN_SEASONAL } from "../calendar/tw-calendar.ts";
import { IMAGE_SET_MAX_ASSETS, type ImageSetCategory, type ImageSetPlanItem } from "./image-set-kit.ts";
import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";

// lifestyle stays accepted for rows created by previous versions. New batches use benefit instead.
export type ImageSetRole = "hero" | "detail" | "lifestyle" | "background" | "benefit" | "decoration";
export type ImageSetGenerationPath = "cutout" | "edit" | "text";

export type ImageSetRoleSpec = {
  role: ImageSetRole;
  label: string;
  usageDescription: string;
  path: ImageSetGenerationPath;
  cutout: boolean;
  sceneCn: string;
  objective: string;
  composition: string;
  mustNotShow: string[];
};

export type ImageSetTheme = { key: string; label: string; kind: "PROMO" | "SEASONAL" };
export type PlanImageSetInput = { profile: ProductVisualProfile; artDirection: ImageSetArtDirection; theme?: ImageSetTheme };
export type PlannedImageSetRole = ImageSetRoleSpec & ImageSetPlanItem;

function first(values: string[]): string | null {
  return values.find((value) => value.trim())?.trim() ?? null;
}

function productContext(profile: ProductVisualProfile): string {
  return [
    first(profile.suitableScenes) && `場景參考：${first(profile.suitableScenes)}`,
    first(profile.useCases) && `使用／賣點參考：${first(profile.useCases)}`,
  ].filter(Boolean).join("；") || "依產品定位建立可合成的廣告素材，不臆測未提供資訊";
}

function normalizedKey(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "evergreen";
}

function assertCatalogTheme(theme: ImageSetTheme): void {
  const known = theme.kind === "PROMO"
    ? PROMO_FIXED.some(([, , label]) => label === theme.label)
    : Object.values(TAIWAN_SEASONAL).flat().some(({ label }) => label === theme.label);
  if (!known) throw new Error("套圖主題不在行銷日曆中");
}

export function imageSetThemeCatalog(): ImageSetTheme[] {
  return [
    ...PROMO_FIXED.map(([month, day, label]) => ({ key: `promo-${month}-${day}`, label, kind: "PROMO" as const })),
    ...Object.entries(TAIWAN_SEASONAL).flatMap(([month, themes]) => themes.map(({ label }, index) => ({
      key: `seasonal-${month}-${index + 1}`,
      label,
      kind: "SEASONAL" as const,
    }))),
  ];
}

export function resolveImageSetTheme(key?: string, kind?: ImageSetTheme["kind"]): ImageSetTheme | null {
  if (!key && !kind) return null;
  if (!key || !kind) throw new Error("套圖主題資料不完整");
  const theme = imageSetThemeCatalog().find((candidate) => candidate.key === key && candidate.kind === kind);
  if (!theme) throw new Error("找不到指定的套圖主題");
  return theme;
}

function withPlanMetadata(
  spec: ImageSetRoleSpec,
  input: { category: ImageSetCategory; assetSubtype: string; purpose: string; core: boolean; themeKey: string },
): PlannedImageSetRole {
  return {
    ...spec,
    id: `${spec.role}-${normalizedKey(input.assetSubtype)}-${input.themeKey}`,
    category: input.category,
    assetRole: spec.role as ImageSetPlanItem["assetRole"],
    assetSubtype: input.assetSubtype,
    purpose: input.purpose,
    core: input.core,
    defaultSelected: input.core,
  };
}

function detailSpec(profile: ProductVisualProfile, context: string): ImageSetRoleSpec & { subtype: string; purpose: string } {
  if (profile.productArchetype === "skincare" || profile.productArchetype === "cosmetics") {
    return {
      role: "detail", label: "質地細節", usageDescription: "呈現產品使用感與質地", path: "text", cutout: false,
      sceneCn: `真實攝影微距的乳液／凝露／泡沫質地；可拍出無品牌按壓頭正在出料，或質地抹在肌膚上的近景；${context}`,
      objective: "Create a real photographic macro texture study of dispensed lotion, gel, foam, or product spread on skin. Show only visibly supported texture characteristics.",
      composition: "Photographic macro close-up with visible real texture, natural highlights, and shallow depth of field.",
      mustNotShow: ["抽象液體波浪", "漂浮微粒", "功效意象圖", "完整商品", "完整瓶罐或包裝", "Logo", "文字", "未提供的成分或功效宣稱"],
      subtype: "formula-texture", purpose: "呈現已提供資訊支持的配方質地與使用觸感",
    };
  }
  const hasAppearanceEvidence = profile.appearance.materials.some((value) => value.trim())
    || profile.appearance.distinctiveDetails.some((value) => value.trim());
  const detail = hasAppearanceEvidence && profile.productArchetype === "fashion" ? "布料織紋與表面細節"
    : hasAppearanceEvidence && profile.productArchetype === "food_beverage" ? "食品或飲品本身可見的表面質地"
      : "商品材質與表面質地細節";
  return {
    role: "detail", label: "質地細節", usageDescription: `呈現${detail}`, path: "edit", cutout: false,
    sceneCn: `真實攝影微距的${detail}；只依已提供的外觀資料呈現，不加入不存在的材料或功能；${context}`,
    objective: `Create a real photographic macro study of the supplied ${detail}. Do not invent materials, ingredients, controls, or functions.`,
    composition: "Photographic macro close-up with authentic surface detail, natural highlights, and shallow depth of field.",
    mustNotShow: ["抽象功效意象", "完整商品", "未提供的材料、成分或功能"],
    subtype: hasAppearanceEvidence && profile.productArchetype === "fashion" ? "fabric-detail" : "material-detail",
    purpose: `呈現已提供資訊支持的${detail}`,
  };
}

function coreRoles(profile: ProductVisualProfile, themeKey: string, theme?: ImageSetTheme): PlannedImageSetRole[] {
  const context = productContext(profile);
  const motif = first(profile.visualMotifs);
  const detail = detailSpec(profile, context);
  const themePurpose = theme ? `，並呼應「${theme.label}」主題` : "";
  return [
    withPlanMetadata({
      role: "hero", label: "商品主體", usageDescription: "廣告中的主要商品", path: "cutout", cutout: true,
      sceneCn: "直接保留原始商品照的比例、Logo、文字與包裝細節，僅移除背景並輸出透明 PNG。",
      objective: "Create a transparent cutout from the supplied original product photograph. Do not generate or redesign the product.",
      composition: "保留完整商品輪廓與原始比例，方便作為後續廣告合成的主要商品圖層。",
      mustNotShow: ["重新生成商品造型", "改變 Logo、文字、包裝、比例或結構"],
    }, { category: "product", assetSubtype: "clean-cutout", purpose: "提供可重複合成的透明商品主體", core: true, themeKey }),
    withPlanMetadata(detail, { category: "texture", assetSubtype: detail.subtype, purpose: detail.purpose, core: true, themeKey }),
    withPlanMetadata({
      role: "background", label: "情境背景", usageDescription: "後續合成用純背景", path: "text", cutout: false,
      sceneCn: `單一連續的純情境背景，不出現任何產品；保留連續文字留白與清楚可放置商品的檯面或平面；${context}`,
      objective: "Create one coherent product-free advertising background plate with contiguous quiet copy space and a clearly visible product placement plane. Do not depict any product.",
      composition: "保留連續文案區與清楚商品擺放平面；畫面有乾淨留白與平穩重心，供後續廣告合成。",
      mustNotShow: ["任何商品", "瓶罐", "產品包裝", "Logo", "文字", "人物手持產品", "左右切半畫面", "搶戲的鏡子、水槽或道具"],
    }, { category: "background", assetSubtype: "primary-scene", purpose: `提供主版面合成與文案留白${themePurpose}`, core: true, themeKey }),
    withPlanMetadata({
      role: "benefit", label: "賣點視覺", usageDescription: "將產品賣點轉成視覺素材", path: "text", cutout: false,
      sceneCn: `以抽象、藝術化且高級的廣告視覺表現已提供的產品賣點；${context}`,
      objective: "Create a conceptual abstract benefit visual that translates only supplied use cases into artistic imagery. Never depict the actual product.",
      composition: "概念型抽象素材，有層次但保留可放置文案或與商品主體合成的空間。",
      mustNotShow: ["實際商品", "瓶罐", "包裝", "Logo", "文字", "真實攝影微距的商品材質或表面質地", "未提供的成分、功效、認證或醫療宣稱"],
    }, { category: "benefit", assetSubtype: "benefit-metaphor", purpose: `把已提供的賣點轉成可合成的視覺隱喻${themePurpose}`, core: true, themeKey }),
    withPlanMetadata({
      role: "decoration", label: "裝飾元素", usageDescription: "增加版面完整度的 PNG 元素", path: "text", cutout: true,
      sceneCn: `單一可獨立疊加的非文字裝飾元素${motif ? `；視覺元素參考：${motif}` : ""}。`,
      objective: "Create one isolated non-typographic decorative overlay element on a plain removable background.",
      composition: "單一元素、清楚輪廓、無完整場景、無文字，方便去背後獨立疊加。",
      mustNotShow: ["商品", "Logo", "文字", "字母", "數字", "完整場景", "產品包裝"],
    }, { category: "decoration", assetSubtype: "brand-motif", purpose: `提供不含文字的品牌裝飾疊加元素${themePurpose}`, core: true, themeKey }),
  ];
}

function extraRoles(input: PlanImageSetInput, themeKey: string): PlannedImageSetRole[] {
  const { artDirection, theme } = input;
  const extras: PlannedImageSetRole[] = [
    withPlanMetadata({
      role: "hero", label: "商品角度特寫", usageDescription: "補充主商品的構圖選擇", path: "edit", cutout: false,
      sceneCn: "使用供應的商品參考，建立另一個清楚角度；完整保留外觀、標籤與比例。",
      objective: "Create one alternate product angle using the supplied reference while preserving product identity exactly.",
      composition: "乾淨單品特寫，保留後續裁切與排版空間。", mustNotShow: ["改變商品結構", "新增文字", "新增 Logo"],
    }, { category: "product", assetSubtype: "alternate-angle", purpose: "提供主視覺之外的商品構圖備選", core: false, themeKey }),
    withPlanMetadata({
      role: "background", label: "純淨背景", usageDescription: "彈性較高的次要合成背景", path: "text", cutout: false,
      sceneCn: "單一純淨背景與清楚擺放平面，不出現商品或文字。",
      objective: "Create a quiet product-free background plate with generous continuous copy space.",
      composition: "大面積留白、低干擾、可自由裁切。", mustNotShow: ["商品", "包裝", "Logo", "文字", "分割版面"],
    }, { category: "background", assetSubtype: "clean-plate", purpose: "提供跨版型使用的低干擾合成底圖", core: false, themeKey }),
    withPlanMetadata({
      role: "decoration", label: "無文字版型框", usageDescription: "框住商品或賣點區域", path: "text", cutout: true,
      sceneCn: "單一無文字細框或形狀底，輸出為可去背的獨立元素。",
      objective: "Create one isolated text-free layout frame with no letters, numbers, labels, or badges.",
      composition: "乾淨邊界、中央保留透明空間，不含文字。", mustNotShow: ["任何文字", "字母", "數字", "有字標籤", "商品", "完整場景"],
    }, { category: "decoration", assetSubtype: "layout-frame", purpose: `提供不含文字的版型框；風格參考：${first(artDirection.decorationStyle) ?? "簡潔幾何"}`, core: false, themeKey }),
  ];
  if (theme) {
    extras.push(withPlanMetadata({
      role: "decoration", label: theme.kind === "PROMO" ? "主題緞帶" : "季節裝飾", usageDescription: `呼應${theme.label}的可疊加元素`, path: "text", cutout: true,
      sceneCn: `建立呼應「${theme.label}」的單一非文字裝飾元素，不加入節慶名稱、日期或促銷字樣。`,
      objective: "Create one isolated theme-aware decorative overlay without any typographic content.",
      composition: "單一元素、可去背、不含文字，避免搶過商品主體。", mustNotShow: ["商品", "Logo", "文字", "字母", "數字", "價格", "促銷標章"],
    }, {
      category: "decoration", assetSubtype: theme.kind === "PROMO" ? "theme-ribbon" : "seasonal-motif",
      purpose: `提供呼應「${theme.label}」且不含文字的${theme.kind === "PROMO" ? "緞帶或標籤底" : "季節裝飾"}`,
      core: false, themeKey,
    }));
  }
  return extras;
}

export function planImageSetRoles(input: PlanImageSetInput): PlannedImageSetRole[];
export function planImageSetRoles(input: ProductVisualProfile): PlannedImageSetRole[];
export function planImageSetRoles(input: PlanImageSetInput | ProductVisualProfile): PlannedImageSetRole[] {
  const configurable = "profile" in input;
  const profile = configurable ? input.profile : input;
  const theme = configurable ? input.theme : undefined;
  if (theme) assertCatalogTheme(theme);
  const themeKey = normalizedKey(theme?.key ?? "evergreen");
  const core = coreRoles(profile, themeKey, theme);
  if (!configurable) return core;
  return [...core, ...extraRoles(input, themeKey)].slice(0, IMAGE_SET_MAX_ASSETS);
}
