import assert from "node:assert/strict";
import test from "node:test";
import { deriveBenefitPoints } from "./benefit-points.ts";

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
