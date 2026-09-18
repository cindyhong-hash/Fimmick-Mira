import { PROMO_FIXED, TAIWAN_SEASONAL } from "../calendar/tw-calendar.ts";
import { DEFAULT_BENEFIT_ICON_STYLE, IMAGE_SET_MAX_ASSETS, type BenefitIconStyle, type ImageSetCategory, type ImageSetPlanItem } from "./image-set-kit.ts";
import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";
import type { BenefitPoint } from "./benefit-points.ts";

// lifestyle stays accepted for rows created by previous versions. New batches use benefit instead.
export type ImageSetRole = "hero" | "detail" | "lifestyle" | "background" | "benefit" | "decoration";
export type ImageSetGenerationPath = "cutout" | "crop" | "edit" | "text";

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
export type PlanImageSetInput = {
  profile: ProductVisualProfile;
  artDirection: ImageSetArtDirection;
  theme?: ImageSetTheme;
  /** 賣點圖示：每個功效點一個 icon。空陣列＝不做這組素材。 */
  benefitPoints?: BenefitPoint[];
  /** 賣點圖示的視覺路線；一組套圖只用一種，混用會失去成組感。預設無框線稿。 */
  benefitIconStyle?: BenefitIconStyle;
};
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
  input: {
    category: ImageSetCategory;
    assetSubtype: string;
    purpose: string;
    core: boolean;
    themeKey: string;
    benefitIconStyle?: BenefitIconStyle;
    benefitTitle?: string;
    benefitDescription?: string;
  },
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
    // 只有賣點圖示帶風格與文字；存進 planJson 後，確認階段才還原得出規劃時選的那一種，
    // 排版階段也才有真正的文字可以用字型渲染。
    ...(input.benefitIconStyle ? { benefitIconStyle: input.benefitIconStyle } : {}),
    ...(input.benefitTitle ? { benefitTitle: input.benefitTitle } : {}),
    ...(input.benefitDescription ? { benefitDescription: input.benefitDescription } : {}),
  };
}

function detailSpec(profile: ProductVisualProfile, context: string): ImageSetRoleSpec & { subtype: string; purpose: string } {
  if (profile.productArchetype === "skincare" || profile.productArchetype === "cosmetics") {
    return {
      role: "detail", label: "質地細節", usageDescription: "呈現產品使用感與質地", path: "text", cutout: false,
      sceneCn: `真實攝影微距的乳液／凝露／泡沫質地：質地抹在肌膚上、或落在乾淨表面的近景。畫面中只有質地本身與承載它的肌膚或表面。這張的重點是「質地長什麼樣」——黏稠度、光澤、顆粒、延展性；不是在演示功效或前後改善，那是賣點視覺的工作；${context}`,
      objective: "Create a real photographic macro texture study of lotion, gel, or foam resting on skin or a clean surface. The frame contains only the formula and the skin or surface holding it. Show only visibly supported texture characteristics.",
      composition: "Photographic macro close-up with visible real texture, natural highlights, and shallow depth of field.",
      mustNotShow: ["抽象液體波浪", "漂浮微粒", "功效意象圖", "任何容器、瓶罐、軟管、按壓頭或出料口", "任何器具或工具", "完整商品", "包裝", "Logo", "文字", "未提供的成分或功效宣稱"],
      subtype: "formula-texture", purpose: "呈現已提供資訊支持的配方質地與使用觸感",
    };
  }
  const hasAppearanceEvidence = profile.appearance.materials.some((value) => value.trim())
    || profile.appearance.distinctiveDetails.some((value) => value.trim());
  const detail = hasAppearanceEvidence && profile.productArchetype === "fashion" ? "布料織紋與表面細節"
    : hasAppearanceEvidence && profile.productArchetype === "food_beverage" ? "食品或飲品本身可見的表面質地"
      : "商品材質與表面質地細節";
  return {
    role: "detail", label: "質地細節", usageDescription: `呈現${detail}`, path: "crop", cutout: false,
    sceneCn: `真實攝影微距的${detail}；只依已提供的外觀資料呈現，不加入不存在的材料或功能。這張的重點是「表面長什麼樣」，不是在演示功效或前後改善，那是賣點視覺的工作；${context}`,
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
      sceneCn: `一個空景：可放置商品的檯面或平面完全淨空，表面上什麼都沒有放，是刻意留空等後製再放入商品的。畫面保留連續文字留白——大片素面牆面或背景，沒有圖案也沒有字樣；${context}`,
      objective: "Photograph an empty set: a bare, completely clear tabletop or surface with nothing resting on it, and a large uninterrupted plain wall or backdrop behind it. The surface is deliberately vacant because a product will be composited in later. Every object in frame is plain and unmarked.",
      composition: "保留連續文案區與清楚商品擺放平面；畫面有乾淨留白與平穩重心，供後續廣告合成。",
      mustNotShow: ["任何商品", "瓶罐", "產品包裝", "Logo", "文字", "人物手持產品", "左右切半畫面", "搶戲的鏡子、水槽或道具"],
    }, { category: "background", assetSubtype: "primary-scene", purpose: `提供主版面合成與文案留白${themePurpose}`, core: true, themeKey }),
    withPlanMetadata({
      role: "benefit", label: "賣點視覺", usageDescription: "將產品賣點轉成視覺素材", path: "text", cutout: false,
      sceneCn: `把賣點具象化成「看得出功效」的畫面。三選一，優先順序如下：①肌膚或使用部位的效果特寫（變平滑、水潤、透亮、柔嫩、淨化）；②質地與功效的互動過程（乳液在肌膚上延展、老廢角質被溫和帶走、水分滲透、泡沫包覆）——要有作用中的過程，不是靜態材質展示；③自然暗示「改善前→改善後」的狀態變化（粗糙轉細緻、暗沉轉透亮、乾燥轉水潤），不要硬切對比圖。不露臉、不誇張、不帶醫美或臨床感；日系簡約的高級保養廣告質感，構圖乾淨並留排版空間；${context}`,
      objective: "Show the stated benefit happening, so a viewer understands what the product does without reading any text. Choose one: a close-up of skin or the treated area showing the result (smoother, hydrated, clarified, softened); the formula visibly at work on skin (spreading, lifting away dead surface cells, absorbing, foaming over residue); or a natural progression from the before state to the improved state within one frame. Photographic and credible, not an illustration. No face, no clinical or medical styling, no exaggerated claims. Never depict the product packaging.",
      composition: "貼近肌膚或使用部位的廣告特寫，主體清楚可辨識；乾淨留白並保留可放置文案或與商品主體合成的空間。",
      mustNotShow: ["實際商品", "瓶罐", "包裝", "Logo", "文字", "抽象球體、飄帶、緞帶、漩渦、光束或純裝飾 3D 物件當成畫面主體", "只有氛圍、看不出在講什麼功效的畫面", "人物臉部", "醫美、診所或臨床器材感", "誇大或未提供的成分、功效、認證或醫療宣稱"],
    }, { category: "benefit", assetSubtype: "benefit-metaphor", purpose: `把賣點具象化成看得出功效的畫面${themePurpose}`, core: true, themeKey }),
    withPlanMetadata({
      role: "decoration", label: "裝飾元素", usageDescription: "增加版面完整度的 PNG 元素", path: "text", cutout: true,
      sceneCn: `單一可獨立疊加的非文字裝飾元素${motif ? `；視覺元素參考：${motif}` : ""}。。用途是排版輔助，不負責說明商品功效——功效交給賣點視覺`,
      objective: "Create one isolated non-typographic decorative overlay element on a plain removable background.",
      composition: "單一元素、清楚輪廓、無完整場景、無文字，方便去背後獨立疊加。",
      mustNotShow: ["商品", "Logo", "文字", "字母", "數字", "完整場景", "產品包裝"],
    }, { category: "decoration", assetSubtype: "brand-motif", purpose: `提供不含文字的品牌裝飾疊加元素${themePurpose}`, core: true, themeKey }),
  ];
}

/**
 * ⚠️ 一致性要靠可執行的數字，不能靠形容詞。
 *
 * 每張 icon 是**獨立一次 API 呼叫**，模型看不到同組的其他張，所以
 * 「請保持風格一致」這種要求本質上不可靠——實測 4 張就有 1 張畫成
 * 攝影棚商品照，加了圓框之後兩張的圓又大小不一。真正有約束力的是
 * 寫死的比例：icon 佔畫布多少百分比、線寬佔畫布多少百分比。
 *
 * 同理，元素數量要釘死。放任模型自由發揮會得到「皮膚輪廓＋波浪＋星點
 * ＋葉子＋水滴」五個元素疊在一起，那已經不是 icon 了。
 */
const BENEFIT_ICON_SPECS: Record<BenefitIconStyle, (title: string) => Pick<ImageSetRoleSpec, "sceneCn" | "objective" | "composition"> & { mustNotShow: string[] }> = {
  // 參考 flaticon「Sir.Vector Outline」那類 64px 格線圖示集：沒有外框，
  // 靠固定線寬與固定佔比成組。單色中性，排版時可以直接換成品牌色，
  // 所以同一組 icon 能套到任何產品與品牌——這是預設值的理由。
  plain: (title) => ({
    sceneCn: `一張扁平向量線稿，純白底，不是照片、不是 3D、不是渲染圖。畫面正中央是一個象徵「${title}」的極簡輪廓圖形，沒有外框。圖形高度佔畫布的 60%，正置中；線條粗細固定為畫布寬度的 3%，端點與轉角都是圓角，整張只有這一種線寬。主體只有一個圖形，最多再加一顆小小的四角星點綴，不能更多。整張圖只有一種線條顏色，中性深灰，沒有填色、沒有陰影、沒有漸層。畫面上沒有文字、沒有商品、沒有情境。`,
    objective: `Draw one minimal flat vector outline icon for "${title}", in the style of a 64px-grid icon set: no frame, no container. One single pictogram centred on a pure white background, its height exactly 60% of the canvas. Uniform stroke width of 3% of the canvas width with rounded caps and joins, one stroke weight throughout. At most one small four-point sparkle as an accent beyond the main shape. Monochrome dark grey strokes only — no fills, shadows or gradients, so the icon can be recoloured to any brand palette later. This is line art, never a photograph, product shot or 3D render. No lettering of any kind, no product, no scene.`,
    composition: "單一輪廓圖形置中，高度佔畫布 60%，無外框；固定線寬，四周均勻留白。",
    mustNotShow: [
      "任何文字、字母、數字",
      "任何外框、圓框、方框或容器",
      "超過一個主體圖形、或一顆以上的星點",
      "填色色塊、陰影、漸層、立體光澤",
      "Emoji、卡通角色、吉祥物",
      "實際商品、瓶罐、包裝、Logo",
      "情境照、背景場景、人物",
      "粗細不一的線條",
    ],
  }),
  framed: (title) => ({
    sceneCn: `一張扁平向量線稿，純白底，不是照片、不是 3D、不是渲染圖。畫面正中央有一個細線條畫的正圓外框，圓的直徑固定為畫布寬度的 70%、正置中——這個比例不能變，整組 icon 的圓要一樣大才能並排。圓框內放一個象徵「${title}」的極簡圖形，圖形高度佔圓直徑的一半，只能有 1 到 2 個元素，寧可太簡單也不要複雜，且完全在圓內、不可碰到或穿出圓框。線條粗細固定為畫布寬度的 2%，端點圓角。除了這個圓框與框內圖形之外，畫面上沒有任何東西：沒有文字、沒有商品、沒有情境、沒有散落的星點。整張只有一種線條顏色，取自品牌點綴色或商品主色。背景整張純白、沒有色塊或漸層。`,
    objective: `Draw one minimal flat vector line icon for "${title}": a perfect circular frame whose diameter is exactly 70% of the canvas width, centred — this ratio is fixed so every icon in the set lines up. Inside it, a simple pictogram of at most two elements, half the circle's diameter tall, fully contained within the circle and never touching or crossing it. Uniform stroke width of 2% of the canvas width with rounded caps, identical across the set. Pure white background, the exact same flat white on every icon, no tint or gradient. Monochrome line art in a single accent colour. This is line art, never a photograph, product shot or 3D render. No lettering of any kind, no product, no scene, no scattered sparkles or filler decoration.`,
    composition: "細線正圓框置中、直徑佔畫布 70%，框內 1–2 個元素且不碰框；整組並排時圓框大小一致。",
    mustNotShow: [
      "任何文字、字母、數字",
      "超過兩個元素、或框外散落的星點與裝飾",
      "圖形穿出或碰到圓框",
      "Emoji、卡通角色、吉祥物",
      "立體光澤、陰影、漸層、3D 或擬真渲染",
      "實際商品、瓶罐、包裝、Logo",
      "情境照、背景場景、人物",
      "與同組其他 icon 不同大小的外框或不同粗細的線條",
    ],
  }),
  soft: (title) => ({
    sceneCn: `一張扁平向量圖示，純白底，不是照片、不是 3D、不是渲染圖。畫面正中央是一個象徵「${title}」的極簡圖形，用柔和的面狀色塊畫成（不是線條輪廓），色塊邊緣是圓潤的幾何形狀。圖形高度佔畫布的 60%，正置中。只能有 1 到 2 個色塊元素，寧可太簡單也不要複雜。整組只用同一組柔和色調，取自品牌點綴色或商品主色，深淺層次最多兩階。畫面上沒有文字、沒有商品、沒有情境、沒有陰影、沒有漸層光澤。`,
    objective: `Draw one minimal flat vector icon for "${title}" built from soft filled colour shapes rather than outlines. One pictogram centred on a pure white background, its height exactly 60% of the canvas, made of at most two rounded geometric shapes. Use a single soft palette drawn from the brand colours with at most two tonal steps, identical across the set so the icons read as one family. Flat fills only — no gradients, gloss, drop shadows or 3D shading. No lettering of any kind, no product, no scene.`,
    composition: "單一面狀色塊圖形置中，高度佔畫布 60%，四周均勻留白；整組並排時大小與色調一致。",
    mustNotShow: [
      "任何文字、字母、數字",
      "超過兩個色塊元素",
      "漸層、光澤、立體陰影、3D 或擬真渲染",
      "線條輪廓風格（這一組是面狀填色）",
      "Emoji、卡通角色、吉祥物",
      "實際商品、瓶罐、包裝、Logo",
      "情境照、背景場景、人物",
      "與同組其他 icon 不同大小或不同色調的圖形",
    ],
  }),
};

/**
 * 賣點圖示：把賣點整理成「Icon＋短標題」的資訊型素材。
 *
 * 與賣點視覺分工明確——賣點視覺用情境把功效演出來，賣點圖示只負責
 * 「快速說清楚有哪些功效」。所以這裡不要情境照、不要商品照。
 *
 * ⚠️ icon 本身不含文字。短標題存在 label／purpose 裡，排版階段才用真正的
 * 字型渲染——圖像模型畫中文很容易缺筆畫或糊掉（這個專案已經踩過）。
 */
/**
 * 三種風格共用的底線。文字類的限制寫得這麼細，是因為賣點圖示的整個設計前提
 * 就是「圖裡不能有字」——中文交給排版階段用字型渲染，影像模型畫中文會缺筆畫。
 * 實測過的失敗長相：標籤上出現「元亮」「歲㤉憦栃」這種亂碼。
 */
const BENEFIT_ICON_TEXT_BAN = "Icon only. No text, no letters, no numbers, no words, no typography, no watermark, no signature, no measurement marks. A single isolated object on a clean, empty background, suitable for dropping into an advertising layout.";

function benefitIconRoles(points: BenefitPoint[], themeKey: string, style: BenefitIconStyle): PlannedImageSetRole[] {
  return points.map((point, index) => {
    const spec = BENEFIT_ICON_SPECS[style](point.title);
    return withPlanMetadata({
      role: "benefit",
      // 主標題直接是賣點名稱——四張都叫「賣點圖示」的話，要往下讀小字才分得出誰是誰。
      label: point.title,
      usageDescription: "可獨立使用的功效 Icon",
      path: "text",
      // 這條路回傳 JPG，拿不到透明底；底色靠提示詞釘死成純白。
      cutout: false,
      ...spec,
      objective: `${spec.objective} ${BENEFIT_ICON_TEXT_BAN}`,
    }, {
      category: "benefit",
      assetSubtype: `benefit-icon-${index + 1}`,
      // purpose 會顯示在清單與看板上，讓使用者知道每個 icon 對應哪個賣點。
      purpose: point.description ? `${point.title}——${point.description}` : point.title,
      core: false,
      themeKey,
      benefitIconStyle: style,
      benefitTitle: point.title,
      benefitDescription: point.description,
    });
  });
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
  // 賣點圖示放在核心之後、其他選配之前——它是一整組，優先順序高於單張選配素材。
  const icons = benefitIconRoles(input.benefitPoints ?? [], themeKey, input.benefitIconStyle ?? DEFAULT_BENEFIT_ICON_STYLE);
  return [...core, ...icons, ...extraRoles(input, themeKey)].slice(0, IMAGE_SET_MAX_ASSETS);
}
