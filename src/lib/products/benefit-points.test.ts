import assert from "node:assert/strict";
import test from "node:test";
import { buildBenefitPointsPrompt, buildIconConceptPrompt, composeIconConcept, deriveIconConcepts, iconConceptSubject, isNounPhrase, deriveBenefitPoints, extractBenefitPoints, isDrawableIconConcept, parseBenefitPointsJson } from "./benefit-points.ts";

const realDescription = "賣點： 酵素角質護理，除毛前柔嫩肌膚、帶走老廢角質，讓刮毛更加滑順。\n定位： 專為除毛前打造的肌膚前導保養，提升居家除毛的細緻度與舒適感。";

test("splits the brand's own selling points into short icon titles", () => {
  const points = deriveBenefitPoints(realDescription, ["pre-shaving care"]);
  assert.deepEqual(points.map(({ title }) => title), [
    "酵素角質護理", "除毛前柔嫩肌膚", "帶走老廢角質", "刮毛更加滑順",
  ]);
  for (const { title } of points) assert.ok(title.length <= 8, `標題過長：${title}`);
});

test("field labels and leading connectives are stripped", () => {
  const points = deriveBenefitPoints(realDescription);
  assert.ok(!points.some(({ title }) => title.includes("賣點")), "不該把欄位標籤當成標題");
  assert.ok(!points.some(({ title }) => title.startsWith("讓")), "「讓刮毛更加滑順」的連接詞應該去掉");
});

test("truncated fragments only fill in when complete sentences are too few", () => {
  // 完整句足夠時，不要出現「專為除毛前打造的」這種硬切片段。
  const points = deriveBenefitPoints(realDescription);
  assert.ok(!points.some(({ title }) => title === "專為除毛前打造的"));

  // 只有一句長句時，才允許切出來湊數。
  const long = deriveBenefitPoints("賣點： 一句非常長而且沒有標點符號的描述文字內容佔位、另一句、第三句");
  assert.ok(long.length >= 3);
});

test("fewer than three points means the icon set is skipped entirely", () => {
  assert.deepEqual(deriveBenefitPoints("賣點： 只有一項"), []);
  assert.deepEqual(deriveBenefitPoints(""), []);
  assert.deepEqual(deriveBenefitPoints(null), []);
});

const productForLlm = {
  name: "去角質除毛前乳液",
  category: "保養",
  description: "賣點： 酵素角質護理，除毛前柔嫩肌膚、帶走老廢角質，讓刮毛更加滑順。\n定位： 專為除毛前打造的肌膚前導保養。",
};

test("the extraction prompt carries the product facts and the no-overlap rule", () => {
  const prompt = buildBenefitPointsPrompt(productForLlm);
  assert.match(prompt, /去角質除毛前乳液/);
  assert.match(prompt, /酵素角質護理/);
  // 規則拆解切不出「不同面向」，所以這條規則就是改用 LLM 的全部理由。
  assert.match(prompt, /不同面向/);
  assert.match(prompt, /只輸出 JSON 陣列/);
});

test("model output is validated, not trusted: length, duplicates and count are all enforced", () => {
  // 包在說明文字與 markdown 裡也要挖得出來。
  assert.deepEqual(
    parseBenefitPointsJson('好的，以下是結果：\n```json\n[{"title":"溫和去角質","description":"酵素帶走老廢角質","subject":"a leg","hint":"a soft brush"},{"title":"除毛前準備","description":"幫助肌膚做好前置保養","subject":"a leg","hint":"a water droplet"},{"title":"柔嫩平滑肌膚","description":"提升細緻滑順感","subject":"a leg","hint":"a feather"}]\n```'),
    [
      { title: "溫和去角質", description: "酵素帶走老廢角質", iconConcept: "a leg with a soft brush" },
      { title: "除毛前準備", description: "幫助肌膚做好前置保養", iconConcept: "a leg with a water droplet" },
      { title: "柔嫩平滑肌膚", description: "提升細緻滑順感", iconConcept: "a leg with a feather" },
    ],
  );

  // iconConcept 會進生圖提示詞，夾帶中文就整筆丟掉——那正是圖上出現中文字的原因。
  assert.deepEqual(
    parseBenefitPointsJson('[{"title":"雙重保濕","description":"","subject":"雙重保濕 droplets","hint":""},{"title":"第二個","description":"","subject":"a leaf","hint":""},{"title":"第三個","description":"","subject":"a sun","hint":""}]'),
    [],
  );
  // 完全沒給 iconConcept 也不收：沒有英文描述就不該做這張 icon。
  assert.deepEqual(parseBenefitPointsJson('[{"title":"甲"},{"title":"乙"},{"title":"丙"}]'), []);

  // 過長要截斷；title 與 description 一樣時 description 清空（重複沒有資訊）。
  const [trimmed] = parseBenefitPointsJson('[{"title":"這是一個非常長的賣點標題","description":"這是一個非常長的賣點標題","subject":"a long shape","hint":""},{"title":"第二個","description":"","subject":"a leaf","hint":""},{"title":"第三個","description":"","subject":"a sun","hint":""}]');
  assert.equal(trimmed.title.length, 8);
  assert.equal(trimmed.description, "");

  // 重複的 title 只留一個，剩下不足 3 個就整份作廢。
  assert.deepEqual(parseBenefitPointsJson('[{"title":"去角質","subject":"a brush","hint":""},{"title":"去角質","subject":"a brush","hint":""},{"title":"保濕","subject":"a droplet","hint":""}]'), []);
  // 壞掉的輸出不能讓流程爆炸——回空陣列，呼叫端會退回規則版本。
  assert.deepEqual(parseBenefitPointsJson("模型今天不想回 JSON"), []);
  assert.deepEqual(parseBenefitPointsJson(null), []);
});

test("extraction falls back to the rule-based split whenever the model is unusable", async () => {
  const good = await extractBenefitPoints(productForLlm, [], async () =>
    '[{"title":"溫和去角質","description":"酵素帶走老廢角質","subject":"a soft brush","hint":""},{"title":"除毛前準備","description":"幫助肌膚前置保養","subject":"a water droplet","hint":""},{"title":"柔嫩平滑肌膚","description":"提升細緻滑順感","subject":"a feather","hint":""}]');
  assert.deepEqual(good.map(({ title }) => title), ["溫和去角質", "除毛前準備", "柔嫩平滑肌膚"]);

  // 賣點決定會生幾張付費圖片，所以 LLM 沒回應或整個拋錯都不能讓功能不能用。
  const modelDown = await extractBenefitPoints(productForLlm, [], async () => null);
  assert.deepEqual(modelDown, deriveBenefitPoints(productForLlm.description, []));
  const modelThrew = await extractBenefitPoints(productForLlm, [], async () => { throw new Error("boom"); });
  assert.deepEqual(modelThrew, deriveBenefitPoints(productForLlm.description, []));
});

test("a product with too little copy makes no icons and never spends an LLM call", async () => {
  let called = 0;
  const points = await extractBenefitPoints({ name: "某商品", description: "好用" }, [], async () => { called += 1; return null; });
  assert.deepEqual(points, []);
  assert.equal(called, 0);
});

test("only ideas with something actually happening are accepted", () => {
  // 沒有形狀的東西擋掉：場景、氛圍、感受。
  assert.equal(isDrawableIconConcept("a cozy bathroom setting with soft towels"), false);
  assert.equal(isDrawableIconConcept("an experience of comfort"), false);
  assert.equal(isDrawableIconConcept(""), false);
  // 但肌膚、毛髮、腿是合法主體——問題從來不是它們出現，而是整句沒有正在發生的事。
  assert.equal(isDrawableIconConcept("a leg with a few small particles lifting away"), true);
  // 商品瓶罐與檯面會被畫成商品插畫，不是 icon。
  assert.equal(isDrawableIconConcept("a bottle of cream next to a razor"), false);
  assert.equal(isDrawableIconConcept("a razor on a platform"), false);
  assert.equal(isDrawableIconConcept("a water droplet on a leaf"), true);
});

test("a benefit becomes exactly one subject plus one supporting hint", () => {
  // 一張 icon 只畫兩個東西。實測畫成「一瓶乳霜＋刮刀＋檯面」就變成商品插畫，
  // 不是 icon；元素一多就看不出重點。
  assert.equal(
    composeIconConcept({ subject: "a leg", hint: "a few small particles lifting away" }),
    "a leg with a few small particles lifting away",
  );
  // 只有主體也可以，但沒有主體就作廢。
  assert.equal(composeIconConcept({ subject: "a water droplet", hint: "" }), "a water droplet");
  assert.equal(composeIconConcept({ subject: "", hint: "a hand stroking it" }), "");

  // 從模型輸出讀取時，三段合起來才是送進生圖的句子。
  const parsed = parseBenefitPointsJson('[{"title":"溫和去角質","subject":"a leg","hint":"a few small particles lifting away"},{"title":"保濕","subject":"a leg","hint":"a water droplet on it"},{"title":"柔嫩","subject":"a leg","hint":"a hand stroking it"}]');
  assert.equal(parsed[0].iconConcept, "a leg with a few small particles lifting away");
  assert.equal(parsed.length, 3);
});

test("an undrawable concept is dropped rather than generated as a mush of colour", () => {
  // 整份都畫不出來 → 回空陣列 → 呼叫端不做這組 icon，不會花錢生色塊。
  assert.deepEqual(
    parseBenefitPointsJson('[{"title":"舒適體驗","subject":"a cozy bathroom setting","hint":""},{"title":"柔嫩","subject":"smooth skin with waves","hint":""},{"title":"保濕","subject":"a droplet","hint":""}]'),
    [],
  );
  // 混合時只留畫得出來的那些（不足 3 個仍視為不可用，維持原規則）。
  // 主體統一之後，區別留在輔助元素上；畫不出來的那一筆整個不收。
  const mixed = parseBenefitPointsJson('[{"title":"保濕","subject":"a leg","hint":"a water droplet"},{"title":"清潔","subject":"a leg","hint":"a soap bar"},{"title":"柔嫩","subject":"a leg","hint":"a feather"},{"title":"舒適","subject":"a cozy room setting","hint":"a towel"}]');
  assert.deepEqual(mixed.map(({ iconConcept }) => iconConcept), [
    "a leg with a water droplet",
    "a leg with a soap bar",
    "a leg with a feather",
  ]);
});

test("the icon idea prompt asks for the three parts and names what is not a subject", () => {
  const prompt = buildIconConceptPrompt(["保濕", "柔嫩"]);
  assert.match(prompt, /subject/);
  assert.match(prompt, /hint/);
  // 商品與檯面要明講不能當主體，否則模型會畫成商品插畫。
  assert.match(prompt, /bottle/);
  assert.match(prompt, /platform/);
  // 肌膚是合法主體，要明講，否則模型會避開它而改畫抽象色塊。
  assert.match(prompt, /a leg/);
  // 氛圍字不是主體。
  assert.match(prompt, /comfort/);
});

test("a hint must be a visible thing, not an action", () => {
  // 實測模型填過 gently applying cream onto skin——那是動作，沒有形狀，
  // 畫出來是一團看不懂的黃色色塊。名詞片語才有東西可畫。
  assert.equal(isNounPhrase("a few small particles"), true);
  assert.equal(isNounPhrase("a simple razor"), true);
  assert.equal(isNounPhrase("two water droplets"), true);
  assert.equal(isNounPhrase("gently applying cream onto skin"), false);
  assert.equal(isNounPhrase("gliding smoothly"), false);

  // 不是名詞片語就當它不存在，只畫主體——總比畫出沒有形狀的東西好。
  assert.equal(
    composeIconConcept({ subject: "a leg", hint: "gently applying cream onto skin" }),
    "a leg",
  );
  assert.equal(
    composeIconConcept({ subject: "a leg", hint: "a simple razor" }),
    "a leg with a simple razor",
  );
});

test("every icon in a set shares one subject so they read as a family", () => {
  // 提示詞已經要求共用主體，但那是「請保持一致」那一類的要求，實測還是跑掉：
  // 三張裡兩張畫腿、一張畫手，並排就不成套。主體改由程式統一。
  const points = parseBenefitPointsJson(JSON.stringify([
    { title: "溫和去角質", subject: "a leg", hint: "a few small particles" },
    { title: "刮毛滑順", subject: "a leg", hint: "a simple razor" },
    { title: "除毛前護理", subject: "a hand", hint: "a water droplet" },
  ]));
  assert.deepEqual(points.map(({ iconConcept }) => iconConcept), [
    "a leg with a few small particles",
    "a leg with a simple razor",
    // 主體被統一成第一個賣點的「腿」，只留下它自己的輔助元素。
    "a leg with a water droplet",
  ]);
  assert.equal(iconConceptSubject("a leg with a simple razor"), "a leg");
});

test("an icon added later reuses the subject the set is already using", async () => {
  const concepts = await deriveIconConcepts(
    ["保濕"],
    async (prompt) => {
      // 主體要寫進提示詞，模型才知道不能自由發揮。
      assert.match(prompt, /主體固定是 a leg/);
      return '[{"index":1,"subject":"a hand","hint":"a water droplet"}]';
    },
    "a leg",
  );
  // 就算模型回了別的主體，也會被換回這一組在用的那個。
  assert.deepEqual(concepts, ["a leg with a water droplet"]);
});
