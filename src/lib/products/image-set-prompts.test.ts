import assert from "node:assert/strict";
import test from "node:test";
import { compileImageSetPrompt } from "./image-set-prompts.ts";
import { planImageSetRoles } from "./image-set-roles.ts";
import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
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
  assert.match(prompt, /benefit legible at a glance/i);
  assert.match(prompt, /concrete, recognisable subject matter/i);
  assert.match(prompt, /ribbons, swooshes, light streaks, or swirls/i);
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
  // benefit 不再走「抽象」路線（會生出看不懂的泛用裝飾），改驗它被要求畫具體可辨識的內容。
  assert.match(benefitPrompt, /concrete, recognisable/i);
  assert.match(benefitPrompt, /真實攝影微距的商品材質或表面質地/);
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
