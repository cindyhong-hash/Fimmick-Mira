import assert from "node:assert/strict";
import test from "node:test";
import { buildBenefitPointsPrompt, deriveBenefitPoints, extractBenefitPoints, parseBenefitPointsJson } from "./benefit-points.ts";

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
    parseBenefitPointsJson('好的，以下是結果：\n```json\n[{"title":"溫和去角質","description":"酵素帶走老廢角質","iconConcept":"a soft brush sweeping over skin"},{"title":"除毛前準備","description":"幫助肌膚做好前置保養","iconConcept":"a droplet above smooth skin"},{"title":"柔嫩平滑肌膚","description":"提升細緻滑順感","iconConcept":"a feather touching skin"}]\n```'),
    [
      { title: "溫和去角質", description: "酵素帶走老廢角質", iconConcept: "a soft brush sweeping over skin" },
      { title: "除毛前準備", description: "幫助肌膚做好前置保養", iconConcept: "a droplet above smooth skin" },
      { title: "柔嫩平滑肌膚", description: "提升細緻滑順感", iconConcept: "a feather touching skin" },
    ],
  );

  // iconConcept 會進生圖提示詞，夾帶中文就整筆丟掉——那正是圖上出現中文字的原因。
  assert.deepEqual(
    parseBenefitPointsJson('[{"title":"雙重保濕","description":"","iconConcept":"雙重保濕 droplets"},{"title":"第二個","description":"","iconConcept":"a leaf"},{"title":"第三個","description":"","iconConcept":"a wave"}]'),
    [],
  );
  // 完全沒給 iconConcept 也不收：沒有英文描述就不該做這張 icon。
  assert.deepEqual(parseBenefitPointsJson('[{"title":"甲"},{"title":"乙"},{"title":"丙"}]'), []);

  // 過長要截斷；title 與 description 一樣時 description 清空（重複沒有資訊）。
  const [trimmed] = parseBenefitPointsJson('[{"title":"這是一個非常長的賣點標題","description":"這是一個非常長的賣點標題","iconConcept":"a long shape"},{"title":"第二個","description":"","iconConcept":"a leaf"},{"title":"第三個","description":"","iconConcept":"a wave"}]');
  assert.equal(trimmed.title.length, 8);
  assert.equal(trimmed.description, "");

  // 重複的 title 只留一個，剩下不足 3 個就整份作廢。
  assert.deepEqual(parseBenefitPointsJson('[{"title":"去角質","iconConcept":"a brush"},{"title":"去角質","iconConcept":"a brush"},{"title":"保濕","iconConcept":"a droplet"}]'), []);
  // 壞掉的輸出不能讓流程爆炸——回空陣列，呼叫端會退回規則版本。
  assert.deepEqual(parseBenefitPointsJson("模型今天不想回 JSON"), []);
  assert.deepEqual(parseBenefitPointsJson(null), []);
});

test("extraction falls back to the rule-based split whenever the model is unusable", async () => {
  const good = await extractBenefitPoints(productForLlm, [], async () =>
    '[{"title":"溫和去角質","description":"酵素帶走老廢角質","iconConcept":"a soft brush over skin"},{"title":"除毛前準備","description":"幫助肌膚前置保養","iconConcept":"a droplet above skin"},{"title":"柔嫩平滑肌膚","description":"提升細緻滑順感","iconConcept":"a feather on skin"}]');
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
