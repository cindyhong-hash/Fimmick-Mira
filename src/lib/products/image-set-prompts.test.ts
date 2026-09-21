import assert from "node:assert/strict";
import test from "node:test";
import { compileImageSetPrompt } from "./image-set-prompts.ts";
import { planImageSetRoles, imageSetThemeCatalog } from "./image-set-roles.ts";
import { buildImageSetArtDirection, type ImageSetArtDirection } from "./product-visual-analysis.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";

const product = {
  id: "product-1",
  clientId: "client-1",
  name: "女性電動除毛刀",
  category: "美容儀器",
  primaryColorOverride: null,
  heroImageUrl: "hero.png",
};

const beautyDeviceProfile: ProductVisualProfile = {
  version: 1,
  productType: "女性電動除毛刀",
  productArchetype: "beauty_device",
  confidence: 0.96,
  appearance: {
    shape: "纖長筆型",
    materials: ["霧面塑膠", "金屬刀網"],
    colors: ["白", "冰藍", "銀"],
    distinctiveDetails: ["圓形刀頭", "冰藍按鍵"],
    visibleTextOrLogos: ["Schick"],
  },
  useCases: ["腿部日常修整"],
  suitableScenes: ["明亮浴室"],
  visualMotifs: ["銀藍曲線"],
  prohibitedChanges: ["不得改變刀頭結構"],
  sourceImageCount: 3,
};

const artDirection: ImageSetArtDirection = {
  concept: "女性電動除毛刀的一致產品攝影",
  palette: { dominant: ["白", "冰藍", "銀"], accent: ["#ffeb85"] },
  lighting: "柔和、乾淨的產品攝影光線",
  materials: ["霧面塑膠", "金屬刀網"],
  backgroundLanguage: "明亮浴室",
  cameraLanguage: "清晰產品攝影，保留真實比例",
  consistencyRules: ["所有畫面視為同一產品的不同視角。"],
  mood: ["清新", "可信賴"],
  decorationStyle: ["細緻冰藍線框", "柔和光點"],
};

test("product roles contain identity locks", () => {
  const role = planImageSetRoles(beautyDeviceProfile)[0];
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });

  for (const detail of beautyDeviceProfile.appearance.distinctiveDetails) {
    assert.match(prompt, new RegExp(detail));
  }
  assert.match(prompt, /不得改變|100% unchanged/);
  assert.match(prompt, /\[ROLE OBJECTIVE\][\s\S]*\[PRODUCT FACTS\][\s\S]*\[MUST PRESERVE\][\s\S]*\[SHARED ART DIRECTION\][\s\S]*\[COMPOSITION AND CAMERA\][\s\S]*\[MUST NOT SHOW\]/);
});

test("benefit visuals receive the brand's own benefit wording and are told not to fall back on abstract flourishes", () => {
  const role = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "benefit")!;
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });

  assert.match(prompt, /Supplied use cases: 腿部日常修整/);
  // 原本只給 use cases 又要求「抽象」，生成結果是泛用緞帶，看不出在講什麼賣點。
  // 現在改成餵真正的賣點文字，並明確禁止泛用裝飾。
  // 賣點視覺要「演出功效」而不是給氛圍：驗它被要求畫肌膚效果／作用過程／前後變化，
  // 且抽象球體與飄帶被列為不可當主體。
  assert.match(prompt, /understands what the product does without reading any text/i);
  assert.match(prompt, /close-up of skin|formula visibly at work/i);
  assert.match(prompt, /抽象球體、飄帶/);
  assert.match(prompt, /只有氛圍、看不出在講什麼功效/);
  assert.match(prompt, /actual product|Logo/i);
  assert.doesNotMatch(prompt, /Product name: 女性電動除毛刀/);
  assert.doesNotMatch(prompt, /Visible text or logos: Schick/);
  assert.doesNotMatch(prompt, /\[MUST PRESERVE\]/);
});

test("benefit prompt carries the brand's selling points, with field labels stripped", () => {
  const role = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "benefit")!;
  const withDescription = {
    ...product,
    description: "賣點： 酵素角質護理，除毛前柔嫩肌膚、帶走老廢角質。\n定位： 專為除毛前打造的肌膚前導保養。",
  };
  const prompt = compileImageSetPrompt({ product: withDescription, profile: beautyDeviceProfile, artDirection, role });

  // 這是整個問題的核心：使用者填的賣點原本完全沒有送進提示詞，
  // benefit 只拿到 "Supplied use cases: ..." 幾個字，所以畫不出賣點。
  assert.match(prompt, /酵素角質護理/);
  assert.match(prompt, /帶走老廢角質/);
  // 欄位標籤要剝掉——送進去的標籤會被模型當成畫面文字描上去。
  assert.doesNotMatch(prompt, /賣點：/);
  assert.doesNotMatch(prompt, /定位：/);
});

test("only the benefit role receives the selling-point wording", () => {
  const withDescription = { ...product, description: "賣點： 酵素角質護理" };
  for (const want of ["background", "detail"]) {
    const role = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === want)!;
    const prompt = compileImageSetPrompt({ product: withDescription, profile: beautyDeviceProfile, artDirection, role });
    assert.doesNotMatch(prompt, /酵素角質護理/, `${want} 不該收到賣點文字`);
  }
});

test("detail asks for a real photographic product texture while benefit stays conceptual", () => {
  const detail = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "detail")!;
  const benefit = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "benefit")!;
  const detailPrompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role: detail });
  const benefitPrompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role: benefit });

  assert.match(detailPrompt, /photographic macro/i);
  assert.match(detailPrompt, /material|surface detail/i);
  assert.match(detailPrompt, /Product name: 女性電動除毛刀/);
  assert.match(detailPrompt, /圓形刀頭/);
  assert.match(detailPrompt, /\[MUST PRESERVE\]/);
  assert.match(detailPrompt, /reference images are the sole source of truth/i);
  assert.match(detailPrompt, /tight macro crop of one genuinely visible existing feature/i);
  assert.match(detailPrompt, /never show the entire product/i);
  assert.match(detailPrompt, /campaign palette.*surroundings and background/i);
  assert.doesNotMatch(detailPrompt, /dispensed|pump|nozzle|spread on skin|dense foam/i);
  assert.match(detailPrompt, /抽象功效意象/);
  // benefit 不再走抽象路線，改驗它被要求演出功效；
  // 同時確認它與 detail 的分工寫進提示詞（detail 講質地長相，benefit 講功效）。
  assert.match(benefitPrompt, /formula visibly at work|close-up of skin/i);
  assert.match(detailPrompt, /不是在演示功效或前後改善/);
  // 原本靠「禁止真實攝影微距的商品材質」來區隔兩者，但那會連「乳液延展在肌膚上」
  // 這種功效互動一起擋掉——那正是賣點視覺該畫的。改成用職責分工區隔：
  // detail 講「長什麼樣」，benefit 講「做了什麼」。
  assert.match(benefitPrompt, /只有氛圍、看不出在講什麼功效/);
  assert.doesNotMatch(benefitPrompt, /真實攝影微距的商品材質或表面質地/);
});

test("background forbids the product and reserves layout space", () => {
  const role = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "background")!;
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });

  // 背景改用「肯定描述」表達「畫面不能有商品」——純文字生圖對否定指令遵循度差，
  // 說「空的檯面上什麼都沒放」比說「不要有產品」有效。斷言跟著改成驗肯定文案。
  assert.match(prompt, /完全淨空|什麼都沒有放/);
  assert.match(prompt, /留白/);
  assert.match(prompt, /empty set|nothing resting on it/i);
  assert.match(prompt, /composited in later/i);
  assert.doesNotMatch(prompt, /Product name: 女性電動除毛刀/);
  assert.doesNotMatch(prompt, /一致產品攝影/);
});

test("background prompt never names the product", () => {
  const role = planImageSetRoles(beautyDeviceProfile).find(({ role }) => role === "background")!;
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });

  // 實測：把商品名詞送進背景提示詞，模型會照著畫出那個商品，並且把欄位標籤
  // 本身（«Supplied use cases;»）當成畫面文字描上去。名詞就是模型要畫的東西，
  // 補一句「never depict」沒有用。背景板只收場景，不收任何商品資訊。
  assert.doesNotMatch(prompt, /女性電動除毛刀/);
  assert.doesNotMatch(prompt, /Supplied use cases/);
  assert.doesNotMatch(prompt, /Product positioning/);
  assert.match(prompt, /Setting:/);
});

test("brand yellow remains an accent rather than the dominant palette", () => {
  const role = planImageSetRoles(beautyDeviceProfile)[0];
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });

  assert.match(prompt, /dominant.*白.*冰藍.*銀/i);
  // accent 仍要提到、且維持「僅作點綴」語意
  assert.match(prompt, /accent.*never dominant/i);
  // 但品牌色 hex 不得出現在生圖 prompt——否則影像模型會把色碼當文字/浮水印畫出來
  assert.doesNotMatch(prompt, /#[0-9a-f]{3,8}\b/i);
});

test("describes distinct valid brand hex colors without exposing raw color codes", () => {
  const role = planImageSetRoles(beautyDeviceProfile)[0];
  const yellowPrompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });
  const violetPrompt = compileImageSetPrompt({
    product,
    profile: beautyDeviceProfile,
    artDirection: { ...artDirection, palette: { dominant: ["#7c3aed"], accent: ["#ffeb85"] } },
    role,
  });

  assert.match(yellowPrompt, /warm light yellow/i);
  assert.match(violetPrompt, /dominant palette: vivid violet/i);
  assert.match(violetPrompt, /accent palette: warm light yellow/i);
  assert.doesNotMatch(`${yellowPrompt}\n${violetPrompt}`, /#[0-9a-f]{3,8}\b/i);
});

test("handles alpha hex conservatively and drops invalid hash-prefixed colors", () => {
  const role = planImageSetRoles(beautyDeviceProfile)[0];
  const prompt = compileImageSetPrompt({
    product,
    profile: beautyDeviceProfile,
    artDirection: {
      ...artDirection,
      palette: {
        dominant: ["#73ea", "#73ea", "#not-a-color", "冰藍"],
        accent: ["#ffeb8580", "#ffeb8580", "#12345"],
      },
    },
    role,
  });

  assert.match(prompt, /dominant palette: translucent vivid violet、冰藍/i);
  assert.match(prompt, /accent palette: translucent warm light yellow/i);
  assert.doesNotMatch(prompt, /not-a-color|#12345|#[0-9a-f]{3,8}\b/i);
  assert.equal((prompt.match(/translucent vivid violet/gi) ?? []).length, 1);
  assert.equal((prompt.match(/translucent warm light yellow/gi) ?? []).length, 1);
});

test("every role receives confirmed mood, campaign consistency, and text safety rules", () => {
  for (const role of planImageSetRoles(beautyDeviceProfile)) {
    const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection, role });
    assert.match(prompt, /Mood: 清新、可信賴/);
    assert.match(prompt, /Campaign consistency rules: 所有畫面視為同一產品的不同視角。/);
    assert.match(prompt, /Do not render new words, letters, numbers, captions, badges with text, or typographic marks\./);
    assert.match(prompt, /Preserve genuine logo and packaging label details visible on the supplied product reference\./);
    if (role.role === "decoration") assert.match(prompt, /Decoration style: 細緻冰藍線框、柔和光點/);
  }
});


test("choosing a theme changes the background prompt's setting and lighting, not just a label", () => {
  const theme = imageSetThemeCatalog().find(({ label }) => label === "開學季")!;
  const brand = { primaryColor: "#ffeb85", secondaryColor: null, toneLabels: ["清新"], paletteColors: [] };

  const plain = buildImageSetArtDirection(beautyDeviceProfile, brand);
  const themed = buildImageSetArtDirection(beautyDeviceProfile, brand, theme);

  // 主題原本只把標籤塞進 mood，場景與光線完全沒變——所以生成結果沒有主題感。
  assert.notEqual(themed.backgroundLanguage, plain.backgroundLanguage, "主題應該改變場景");
  assert.notEqual(themed.lighting, plain.lighting, "主題應該改變光線");
  assert.match(themed.backgroundLanguage, /書桌|洗手台/);
  assert.match(themed.lighting, /秋/);

  // 而且要真的進到背景板的提示詞裡（Background language / Lighting 兩行）。
  const role = planImageSetRoles({ profile: beautyDeviceProfile, artDirection: themed, theme }).find(({ role }) => role === "background")!;
  const prompt = compileImageSetPrompt({ product, profile: beautyDeviceProfile, artDirection: themed, role });
  assert.match(prompt, /Background language: .*(書桌|洗手台)/);
  assert.match(prompt, /Lighting: .*秋/);
  // 主題不該讓背景重新開始放商品或文字。
  assert.match(prompt, /完全淨空|什麼都沒有放/);
});

// 保養類商品：detail 會走 formula-texture 分支，benefit 的規則也以這類商品為主要場景。
const skincareProfile: ProductVisualProfile = {
  ...beautyDeviceProfile,
  productType: "去角質除毛前乳液",
  productArchetype: "skincare",
} as ProductVisualProfile;

test("benefit / decoration / background each state what they are not, so the model does not blur them", () => {
  // 使用者回報三者容易混在一起：賣點視覺生出裝飾意象、背景又像氛圍圖。
  // 各自的提示詞要寫清楚邊界。
  const roles = planImageSetRoles(skincareProfile);
  const promptFor = (name: string) => compileImageSetPrompt({
    product, profile: skincareProfile, artDirection,
    role: roles.find(({ role }) => role === name)!,
  });

  // 賣點視覺＝功效具象化
  const benefit = promptFor("benefit");
  assert.match(benefit, /close-up of skin|formula visibly at work|before state to the improved state/i);
  assert.match(benefit, /抽象球體、飄帶/);

  // 質地細節＝質地長相，不演功效
  assert.match(promptFor("detail"), /不是在演示功效或前後改善/);

  // 裝飾元素＝排版輔助，不說明功效
  assert.match(promptFor("decoration"), /不負責說明商品功效/);

  // 情境背景＝放商品的空間，檯面淨空
  assert.match(promptFor("background"), /完全淨空|什麼都沒有放/);
});

test("benefit icons are one-per-point, text-free, flat white, and visually consistent", () => {
  const points = [
    { title: "酵素角質護理", description: "", iconConcept: "a simple pictogram for xxxxxx" },
    { title: "帶走老廢角質", description: "", iconConcept: "a simple pictogram for xxxxxx" },
    { title: "肌膚更細緻", description: "", iconConcept: "a simple pictogram for xxxxx" },
  ];
  const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: "framed" });
  const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));

  // 每個賣點一張，可以單獨選取與使用。
  assert.equal(icons.length, points.length);
  assert.deepEqual(icons.map(({ assetSubtype }) => assetSubtype), ["benefit-icon-1", "benefit-icon-2", "benefit-icon-3"]);
  // 拿不到透明底：這條路是文字生圖、回傳 JPG，所以底色改用提示詞釘死成純白。
  // 這個旗標曾經寫 true 卻沒有任何地方讀它，等於騙人。
  assert.ok(icons.every(({ cutout }) => !cutout));
  // 預設不勾選——它是一整組，會一次加 3–5 張付費圖片。
  assert.ok(icons.every(({ core }) => !core));

  const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icons[0] });
  // 提示詞只放英文視覺描述。中文標題送進去會被模型直接畫在圖上（實測踩過）。
  assert.doesNotMatch(prompt, /酵素角質護理/);
  assert.match(prompt, new RegExp(points[0].iconConcept));
  assert.equal(icons[0].benefitTitle, "酵素角質護理");
  // icon 本身不能有字：中文交給排版階段用字型渲染，不讓圖像模型畫。
  assert.match(prompt, /No lettering of any kind/i);
  assert.match(prompt, /任何文字、字母、數字/);
  // 整組風格要一致——靠的是「每張都畫同一個外框」這個機械性約束，
  // 不是叫模型自己記住前幾張（每張是獨立一次呼叫，它看不到同組其他張）。
  // 外框改成實心圓底徽章：白色剪影放在填滿的圓裡，整組同一個顏色。
  assert.match(prompt, /solid circular badge/i);
  assert.match(prompt, /plain white silhouette/i);
  assert.match(prompt, /same single colour for every badge/i);
  // 元素數量要釘死，否則會疊成一團而不是 icon。
  // 元素上限由共用規則統一講：整張只畫主體＋一個輔助元素。
  assert.match(prompt, /Draw exactly two things/i);
  // 不要變成情境照或抽象裝飾——那是另外兩個角色的工作。
  assert.match(prompt, /情境照、背景場景、人物/);
  assert.match(prompt, /Emoji、卡通角色/);
});

test("the soft icon style swaps the visual language but keeps every benefit-icon guarantee", () => {
  const points = [{ title: "酵素角質護理", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "帶走老廢角質", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "肌膚更細緻", description: "", iconConcept: "a simple pictogram for xxxxx" }];
  const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: "soft" });
  const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
  assert.equal(icons.length, points.length);

  const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icons[0] });
  // 幾何填色取代線條輪廓，但一樣靠寫死的佔比撐起成組感。
  assert.match(prompt, /soft flat colour-block icon/i);
  // 決策：柔和插畫感可以留，但要簡化到一眼看得懂——細節與拼貼是被擋掉的那一半。
  assert.match(prompt, /simplify it hard until the meaning is obvious/i);
  assert.match(prompt, /do not add interior lines, seams or texture/i);
  assert.match(prompt, /插畫感的切面拼貼/);
  assert.match(prompt, /45% of the canvas/i);
  assert.doesNotMatch(prompt, /solid circular badge/i);
  // 三種風格都必須是中性可換色的——顏色寫死在圖裡的話，換個品牌就整組報廢。
  // 藍黃配色保留，但是平塗單色，不是拼貼。
  assert.match(prompt, /brand blue/i);
  assert.match(prompt, /a single solid fill/i);
  // 換風格不能換掉任何一條底線：不含文字、元素數量有上限、不出現商品。
  assert.match(prompt, /No lettering of any kind/i);
  assert.match(prompt, /任何文字、字母、數字/);
  // 元素上限現在由共用規則統一講：整張只畫主體＋一個輔助元素。
  assert.match(prompt, /Draw exactly two things/i);
  assert.match(prompt, /實際商品、瓶罐、包裝、Logo/);
});

test("benefit icons default to the frameless plain style, which is the recolourable one", () => {
  const points = [{ title: "酵素角質護理", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "帶走老廢角質", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "肌膚更細緻", description: "", iconConcept: "a simple pictogram for xxxxx" }];
  const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points });
  const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
  assert.ok(icons.length);
  // 風格要跟著計畫存下來，確認階段才還原得出來。
  assert.ok(icons.every(({ benefitIconStyle }) => benefitIconStyle === "plain"));

  const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icons[0] });
  assert.match(prompt, /no frame, no container/i);
  assert.doesNotMatch(prompt, /solid circular badge/i);
  assert.doesNotMatch(prompt, /sphere/i);
  // 單色、無填色＝之後可以整組換成品牌色，所以同一組 icon 能套到任何產品。
  assert.match(prompt, /recoloured to any brand palette/i);
  // 一致性靠寫死的比例，不靠形容詞。
  assert.match(prompt, /45% of the canvas/i);
  assert.match(prompt, /3% of the canvas width/i);
});

test("no benefit icon prompt contains the Chinese benefit wording, only the english concept", () => {
  // 實測踩過：提示詞裡寫 Draw one icon for "雙重保濕"，模型就把那四個字畫進圖裡，
  // 上下各一次。後面補再多「no text」也沒用——這個專案早就驗過否定指令對文字
  // 生圖無效。中文只留在資料裡給排版階段渲染，提示詞一律只用英文視覺描述。
  const points = [
    { title: "雙重保濕", description: "鎖住肌膚水分", iconConcept: "two overlapping water droplets" },
    { title: "溫和去角質", description: "帶走老廢角質", iconConcept: "a soft brush sweeping over skin" },
    { title: "柔嫩平滑肌膚", description: "提升細緻滑順感", iconConcept: "a feather touching smooth skin" },
  ];
  for (const style of ["plain", "framed", "soft"] as const) {
    const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: style });
    const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
    assert.equal(icons.length, points.length, `${style} 少做了 icon`);
    for (const [index, icon] of icons.entries()) {
      const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icon });
      assert.doesNotMatch(prompt, new RegExp(points[index].title), `${style} 把中文標題送進了提示詞`);
      assert.doesNotMatch(prompt, new RegExp(points[index].description), `${style} 把中文說明送進了提示詞`);
      assert.match(prompt, new RegExp(points[index].iconConcept), `${style} 沒有使用英文視覺描述`);
      // 「64px-grid icon set」這個說法讓模型畫出方格紙背景。
      assert.doesNotMatch(prompt, /\bgrid\b/i, `${style} 提示詞含有 grid，會被畫成方格紙`);
    }
    // 中文標題仍要留在資料裡——排版階段要用字型渲染它。
    assert.deepEqual(icons.map(({ benefitTitle }) => benefitTitle), points.map(({ title }) => title));
  }
});

test("a benefit point without an english concept makes no icon at all", () => {
  // 規則拆解只有中文，給不出英文描述。與其把中文送進提示詞，不如不做這張。
  const points = [
    { title: "雙重保濕", description: "", iconConcept: "" },
    { title: "溫和去角質", description: "", iconConcept: "" },
    { title: "柔嫩平滑肌膚", description: "", iconConcept: "a feather touching smooth skin" },
  ];
  const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points });
  const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
  assert.equal(icons.length, 1);
  assert.equal(icons[0].benefitTitle, "柔嫩平滑肌膚");
});

test("the english part of a benefit icon prompt never carries chinese product wording", () => {
  // 上一輪只擋了「標題不要出現在提示詞」，但中文還是從另一條路進來：
  // compileImageSetPrompt 會把商品賣點文字餵給所有 benefit 角色，而賣點圖示
  // 也是 benefit 角色。圖示已經有自己的英文描述，不需要也不該收到中文。
  const withBenefits = { ...product, description: "賣點： 酵素角質護理，除毛前柔嫩肌膚、帶走老廢角質。" };
  const points = [
    { title: "溫和去角質", description: "帶走老廢角質", iconConcept: "a soft brush sweeping over skin" },
    { title: "保濕", description: "鎖住肌膚水分", iconConcept: "two overlapping water droplets" },
    { title: "柔嫩肌膚", description: "提升細緻滑順感", iconConcept: "a feather touching smooth skin" },
  ];
  for (const style of ["plain", "framed", "soft"] as const) {
    const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: style });
    for (const icon of roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"))) {
      const prompt = compileImageSetPrompt({ product: withBenefits, profile: skincareProfile, artDirection, role: icon });
      // 指示模型「畫什麼」的那一段完全不能有中文——中文名詞會被當成要畫的字。
      // （[VISUAL DIRECTION] 的色彩與氛圍詞是中文但不是名詞指示，每個角色都有。）
      const objective = prompt.split("[PRODUCT CONTEXT")[0];
      assert.doesNotMatch(objective, /[\u4e00-\u9fff]/, `${style} 的生圖指示含有中文`);
      // 商品賣點文字整份提示詞都不該出現——那是「賣點視覺」要演出的東西，不是圖示。
      assert.doesNotMatch(prompt, /酵素角質護理|老廢角質/, `${style} 收到了商品賣點文字`);
      assert.doesNotMatch(prompt, new RegExp(points[0].title), `${style} 收到了中文標題`);
    }
  }
});

test("no benefit icon prompt contains a raw hex colour code", () => {
  // 這個專案已經踩過：色碼送進生圖提示詞，模型會把字串本身當畫面文字描上去，
  // 而賣點圖示的整個設計前提就是「圖上不能有字」。既有的 hex 斷言只看核心角色，
  // 所以三種 icon 風格要各自再擋一次。
  const points = [{ title: "酵素角質護理", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "帶走老廢角質", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "肌膚更細緻", description: "", iconConcept: "a simple pictogram for xxxxx" }];
  for (const style of ["plain", "framed", "soft"] as const) {
    const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: style });
    for (const icon of roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"))) {
      const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icon });
      assert.doesNotMatch(prompt, /#[0-9a-f]{3,8}\b/i, `${style} 的提示詞含有色碼`);
    }
  }
});

test("every benefit icon style pins the size ratio, because 'keep it consistent' does not survive separate calls", () => {
  const points = [{ title: "酵素角質護理", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "帶走老廢角質", description: "", iconConcept: "a simple pictogram for xxxxxx" }, { title: "肌膚更細緻", description: "", iconConcept: "a simple pictogram for xxxxx" }];
  for (const style of ["plain", "framed", "soft"] as const) {
    const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: points, benefitIconStyle: style });
    const icons = roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
    assert.ok(icons.every((icon) => icon.benefitIconStyle === style), `${style} 沒有把風格寫進計畫項目`);
    const prompt = compileImageSetPrompt({ product, profile: skincareProfile, artDirection, role: icons[0] });
    assert.match(prompt, /% of the canvas/i, `${style} 沒有釘死尺寸比例`);
    assert.match(prompt, /No lettering of any kind/i, `${style} 少了不可有文字的底線`);
    // 圖裡不能有字是這組素材的設計前提，三種風格都要明確擋掉各種文字形式。
    assert.match(prompt, /no letters, no numbers, no words, no typography/i, `${style} 少了共用的無文字規則`);
    assert.match(prompt, /isolated object/i, `${style} 少了單一物件的構圖要求`);
  }
});

test("no benefit points means no icon roles at all", () => {
  const roles = planImageSetRoles({ profile: skincareProfile, artDirection, benefitPoints: [] });
  assert.equal(roles.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon")).length, 0);
});
