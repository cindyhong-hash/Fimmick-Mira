import { PRODUCT_IDENTITY_RULES, type ImageSetArtDirection } from "./product-visual-analysis.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";
import type { ImageSetRoleSpec } from "./image-set-roles.ts";
import { describeHexColor } from "../color-words.ts";

export type ImageSetPromptProduct = {
  name: string;
  category?: string | null;
  /** 使用者在商品頁填的賣點與定位。賣點視覺需要它才有東西可以表達。 */
  description?: string | null;
};

export type CompileImageSetPromptInput = {
  product: ImageSetPromptProduct;
  profile: ProductVisualProfile;
  artDirection: ImageSetArtDirection;
  role: ImageSetRoleSpec;
};

/**
 * 從商品說明取出可以拿去畫的賣點內容。
 *
 * 會把「賣點：」「定位：」這類欄位標籤剝掉——背景板那次的教訓是：
 * 送進去的欄位標籤本身會被模型當成畫面文字描上去
 * （實際生成出 «Supplied use cases;» 那幾個字）。
 */
export function imageSetBenefitStatement(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(賣點|定位|特色|功效|Selling points?|Positioning)\s*[:：]\s*/i, "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
}

function list(values: string[], fallback: string): string {
  return values.length ? values.join("、") : fallback;
}

// 顏色值整理成適合放進「生圖」prompt 的文字：有效 hex 轉成可讀的色相／明度／彩度，
// 讓模型保留品牌配色差異，但不會把裸色碼當成文字或浮水印畫進圖裡。
function paletteText(values: string[], fallback: string): string {
  const cleaned = [
    ...new Set(
      values
        .map((v) => (v ?? "").trim())
        .filter(Boolean)
        .flatMap((value) => {
          if (value.startsWith("#")) {
            const description = describeHexColor(value);
            return description ? [description] : [];
          }
          return [value];
        }),
    ),
  ];
  return cleaned.length ? cleaned.join("、") : fallback;
}

export function compileImageSetPrompt({ product, profile, artDirection, role }: CompileImageSetPromptInput): string {
  const appearance = profile.appearance;
  const productFacts = [
    `Product name: ${product.name}`,
    `Product type: ${profile.productType || product.category || "unspecified"}`,
    `Shape: ${appearance.shape || "only use the supplied reference appearance"}`,
    `Materials: ${list(appearance.materials, "only visibly supported materials")}`,
    `Colors: ${list(appearance.colors, "only visibly supported colors")}`,
    `Visible details: ${list(appearance.distinctiveDetails, "no extra details")}`,
    `Visible text or logos: ${list(appearance.visibleTextOrLogos, "none supplied")}`,
    `Use cases: ${list(profile.useCases, "none supplied")}`,
    `Suitable scenes: ${list(profile.suitableScenes, "none supplied")}`,
  ].join("\n");
  const identityLocks = [
    `不得改變／100% unchanged: ${list([appearance.shape, ...appearance.distinctiveDetails].filter(Boolean), "supplied product identity")}`,
    `Keep visible materials, colors, proportions, structures, text, and logos exactly as supplied.`,
    ...profile.prohibitedChanges,
    ...artDirection.consistencyRules,
  ].join("\n");
  // 背景板不印商品主色。
  //
  // 實測：選 520 告白日，背景語言已經寫了「環境色調以櫻粉為主」，但同一份提示詞
  // 上面還有一行 `dominant palette: light blue`（商品的顏色）。「dominant」字面上
  // 就是主色，模型聽它的，所以背景生出來仍是淡藍，看不出檔期。
  //
  // 背景上本來就不會有商品（商品是後製合成上去的），商品顏色對它沒有意義；
  // 「維持商品顏色」是靠 consistencyRules 保證的，不是靠這一行。與其再補一句去
  // 跟它拉扯，不如把矛盾的來源拿掉，讓背景語言自己說了算。
  const palette = (role.role === "background"
    ? [`accent palette: ${paletteText(artDirection.palette.accent, "none")}; accent only, never dominant.`]
    : [
      `dominant palette: ${paletteText(artDirection.palette.dominant, "product-visible colors only")}`,
      `accent palette: ${paletteText(artDirection.palette.accent, "none")}; accent only, never dominant.`,
    ]).join("\n");
  const productIdentityRules = new Set([...PRODUCT_IDENTITY_RULES, ...profile.prohibitedChanges]);
  // path === "text" 的素材畫面裡沒有商品（商品是後製合成上去的），所以只給檔期與
  // 品牌調性，不給商品身分規則——留著的話等於一邊說「這張是同一個商品的另一個
  // 角度、要維持它的 Logo」，一邊叫它不要畫商品，而負面句對生圖模型沒有作用。
  const campaignRules = role.path === "text"
    ? artDirection.consistencyRules.filter((rule) => !productIdentityRules.has(rule))
    : artDirection.consistencyRules;
  const sharedDirection = [
    `Mood: ${list(artDirection.mood, "clean and consistent")}`,
    ...(role.role === "decoration" ? [`Decoration style: ${list(artDirection.decorationStyle, "minimal non-typographic accents")}`] : []),
    `Campaign consistency rules: ${list(campaignRules, "use the confirmed shared art direction")}`,
  ].join("\n");
  const textSafety = [
    "Do not render new words, letters, numbers, captions, badges with text, or typographic marks.",
    "Preserve genuine logo and packaging label details visible on the supplied product reference.",
  ];
  const exclusions = [
    ...role.mustNotShow,
    ...profile.prohibitedChanges,
    "未提供的成分、功效、認證、安全或醫療宣稱",
    "不得加入任何額外文字、色碼（hex）、數字、標籤或浮水印（產品本身既有的品牌字樣除外）",
    ...textSafety,
  ];
  const physicalDetailGrounding = role.role === "detail" && role.path === "crop"
    ? [
        "The supplied product reference images are the sole source of truth. If metadata or art direction conflicts with visible pixels, follow the reference pixels.",
        "Create a tight macro crop of one genuinely visible existing feature from the supplied product. Show only part of the product; never show the entire product or invent an alternate angle.",
        "Do not redraw, redesign, recolor, replace, enlarge, simplify, or change the finish of the product body, head, controls, seams, logo, or label.",
        "Apply the campaign palette only to the surroundings and background. Never apply campaign colors or materials to the product itself.",
      ]
    : [];

  // Only legacy edit rows use a generated product photograph. New ad-asset roles
  // intentionally receive context without the product identity that would make
  // the model place a bottle into every background, texture, and benefit visual.
  if (role.path === "text") {
    // 背景板刻意不接收任何商品名詞。實測發現送進 "Product positioning: 身體除毛乳液"
    // 之後，模型不但畫出一支乳液軟管，還把欄位標籤本身(«Supplied use cases;»)
    // 當成畫面文字描上去。對圖像模型而言，句中出現的名詞就是要畫的東西，
    // 後面補一句「never depict」沒有作用。背景只需要知道場景。
    // 賣點視覺原本只拿到 "Supplied use cases: pre-shaving care" 三個英文字，
    // 卻被要求「以抽象藝術表現賣點」——沒有東西可以表達，就只會生出
    // 一條泛用緞帶。使用者在商品頁填的賣點（Product.description）
    // 之前完全沒有送進來，這裡補上。
    // 賣點圖示雖然也是 benefit 角色，但它不能收這段中文賣點——它已經有自己的
    // 英文圖示描述，多送中文只會讓模型把那些字畫進圖裡（實測「雙重保濕」被畫出來過）。
    const isBenefitIcon = "assetSubtype" in role && String(role.assetSubtype ?? "").startsWith("benefit-icon");
    const benefitStatement = role.role === "benefit" && !isBenefitIcon
      ? imageSetBenefitStatement(product.description)
      : "";
    const context = role.role === "background" || isBenefitIcon
      // 圖示只需要知道要畫什麼，商品名詞與賣點文字對它沒有用處，只會變成畫面上的字。
      ? isBenefitIcon ? "" : `Setting: ${list(profile.suitableScenes, "a plain, quiet interior")}`
      : [
          `Product positioning (context only; never depict the product): ${profile.productType || product.category || "unspecified"}`,
          `Supplied use cases: ${list(profile.useCases, "none supplied")}`,
          `Suitable scenes: ${list(profile.suitableScenes, "none supplied")}`,
          ...(benefitStatement
            ? [`The specific benefit this image must communicate, in the brand's own words: ${benefitStatement}`]
            : []),
        ].join("\n");
    const formulaTexture = "assetSubtype" in role && role.assetSubtype === "formula-texture";
    const textExclusions = [
      ...role.mustNotShow,
      role.role === "detail"
        ? formulaTexture
          ? "畫面中只能有配方質地與承載它的肌膚或乾淨表面。不得出現任何容器、瓶罐、軟管、按壓頭、出料口或器具——不論有沒有品牌。理由：出現非本商品的容器會被誤認成本商品。"
          : "不得出現完整商品、完整包裝、Logo 或文字；只呈現已提供資訊支持的材質與表面質地"
        : role.role === "background"
          ? "這是一張空景：檯面或平面上完全沒有放任何東西，牆面與背景保持素面無圖案、無字樣。所有入鏡物件都是素面未標示的。"
          : "不得出現任何商品、瓶罐、包裝、Logo 或文字",
      "不得加入未提供的成分、功效、認證、安全或醫療宣稱",
      "不得加入任何色碼（hex）、數字、標籤或浮水印",
      // 只留「不要生字」那條。text-path 沒有商品參考圖，「保留商品既有的 Logo 與
      // 包裝標籤」在這裡是憑空多出來的商品名詞，等於暗示畫面上該有一個有標籤的包裝。
      textSafety[0],
    ];
    return [
      "[ROLE OBJECTIVE]",
      role.objective,
      "[PRODUCT CONTEXT — NOT A SUBJECT]",
      context,
      "[VISUAL DIRECTION]",
      palette,
      `Lighting: ${artDirection.lighting}`,
      `Background language: ${artDirection.backgroundLanguage}`,
      sharedDirection,
      "[COMPOSITION]",
      role.composition,
      `Role scene: ${role.sceneCn}`,
      "[MUST NOT SHOW]",
      textExclusions.join("\n"),
    ].join("\n");
  }

  return [
    "[ROLE OBJECTIVE]",
    role.objective,
    "[PRODUCT FACTS]",
    productFacts,
    "[MUST PRESERVE]",
    identityLocks,
    ...physicalDetailGrounding,
    "[SHARED ART DIRECTION]",
    `Concept: ${artDirection.concept}`,
    palette,
    `Lighting: ${artDirection.lighting}`,
    `Materials language: ${list(artDirection.materials, "visible product materials only")}`,
    `Background language: ${artDirection.backgroundLanguage}`,
    sharedDirection,
    "[COMPOSITION AND CAMERA]",
    role.composition,
    `Camera: ${artDirection.cameraLanguage}`,
    `Role scene: ${role.sceneCn}`,
    "[MUST NOT SHOW]",
    exclusions.join("\n"),
  ].join("\n");
}
