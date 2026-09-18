import assert from "node:assert/strict";
import test from "node:test";
import { imageSetThemeVisual } from "./image-set-theme-visuals.ts";
import { imageSetThemeCatalog } from "./image-set-roles.ts";

test("distinctive themes carry concrete visual vocabulary, not just a label", () => {
  // 這是整個問題的核心：主題原本只有標籤字串，模型不知道「開學季」長什麼樣子。
  const school = imageSetThemeVisual("開學季");
  assert.ok(school, "開學季應該有視覺詞彙");
  assert.match(school.season, /秋/);
  assert.ok(school.props.length >= 2);
  assert.ok(school.setting.length > 0);
  assert.notDeepEqual(school, imageSetThemeVisual("中秋節"), "不同主題不該共用同一套詞彙");
});

test("shopping festivals fall back to one shared vocabulary", () => {
  const groups = ["雙 11 購物節", "618 年中慶", "99 購物節"].map(imageSetThemeVisual);
  for (const value of groups) assert.ok(value, "購物節應該比對到共用詞彙");
  assert.deepEqual(groups[0], groups[1]);
  assert.deepEqual(groups[1], groups[2]);
});

test("unknown themes degrade to null instead of inventing vocabulary", () => {
  assert.equal(imageSetThemeVisual("某個還沒定義的主題"), null);
  assert.equal(imageSetThemeVisual(""), null);
  assert.equal(imageSetThemeVisual(null), null);
});

test("most catalog themes resolve to vocabulary", () => {
  // 不要求 100%——比對不到會安全降級。但覆蓋率太低就失去意義。
  const all = imageSetThemeCatalog();
  const covered = all.filter(({ label }) => imageSetThemeVisual(label));
  const ratio = covered.length / all.length;
  assert.ok(ratio > 0.8, `主題視覺詞彙覆蓋率只有 ${Math.round(ratio * 100)}%（${covered.length}/${all.length}）`);
});
