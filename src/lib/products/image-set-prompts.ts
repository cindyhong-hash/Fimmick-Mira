import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";
import type { ImageSetRoleSpec } from "./image-set-roles.ts";

export type ImageSetPromptProduct = {
  name: string;
  category?: string | null;
};

export type CompileImageSetPromptInput = {
  product: ImageSetPromptProduct;
  profile: ProductVisualProfile;
  artDirection: ImageSetArtDirection;
  role: ImageSetRoleSpec;
};

function list(values: string[], fallback: string): string {
  return values.length ? values.join("、") : fallback;
}

function describeHexColor(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;

  const raw = match[1];
  const expanded = raw.length <= 4
    ? raw.split("").map((part) => `${part}${part}`).join("")
    : raw;
  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  if (hue < 0) hue += 360;

  const alphaWord = alpha < 0.12 ? "near-transparent" : alpha < 0.85 ? "translucent" : alpha < 0.99 ? "slightly translucent" : "";
  if (saturation < 0.12) {
    const neutral = lightness > 0.88 ? "off-white" : lightness > 0.68 ? "light gray" : lightness < 0.22 ? "near-black" : "neutral gray";
    return [alphaWord, neutral].filter(Boolean).join(" ");
  }

  const hueName = hue < 15 || hue >= 345 ? "red"
    : hue < 40 ? "orange"
      : hue < 68 ? "yellow"
        : hue < 155 ? "green"
          : hue < 190 ? "teal"
            : hue < 250 ? "blue"
              : hue < 290 ? "violet"
                : hue < 330 ? "magenta"
                  : "pink";
  const warmth = hue >= 35 && hue < 68 ? "warm" : "";
  const lightnessWord = lightness > 0.86 ? "very light" : lightness > 0.66 ? "light" : lightness < 0.22 ? "deep" : lightness < 0.38 ? "dark" : "";
  const saturationWord = warmth ? "" : saturation > 0.72 ? "vivid" : saturation < 0.35 ? "muted" : "";
  return [alphaWord, warmth, lightnessWord, saturationWord, hueName].filter(Boolean).join(" ");
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
  const palette = [
    `dominant palette: ${paletteText(artDirection.palette.dominant, "product-visible colors only")}`,
    `accent palette: ${paletteText(artDirection.palette.accent, "none")}; accent only, never dominant.`,
  ].join("\n");
  const sharedDirection = [
    `Mood: ${list(artDirection.mood, "clean and consistent")}`,
    ...(role.role === "decoration" ? [`Decoration style: ${list(artDirection.decorationStyle, "minimal non-typographic accents")}`] : []),
    `Campaign consistency rules: ${list(artDirection.consistencyRules, "use the confirmed shared art direction")}`,
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
    const context = role.role === "background"
      ? `Setting: ${list(profile.suitableScenes, "a plain, quiet interior")}`
      : [
          `Product positioning (context only; never depict the product): ${profile.productType || product.category || "unspecified"}`,
          `Supplied use cases: ${list(profile.useCases, "none supplied")}`,
          `Suitable scenes: ${list(profile.suitableScenes, "none supplied")}`,
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
      ...textSafety,
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
