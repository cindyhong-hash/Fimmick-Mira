import assert from "node:assert/strict";
import test from "node:test";
import { hexToRgb, isEditableInPsd, psdFileName, psdFontName, psdTextEffects, psShadowAngle, styleRunsFor } from "./psd-export.ts";

test("hexToRgb 支援 3/6/8 碼，看不懂給黑色", () => {
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb("#1f4466"), { r: 31, g: 68, b: 102 });
  assert.deepEqual(hexToRgb("#c6bde600"), { r: 198, g: 189, b: 230 });
  assert.deepEqual(hexToRgb("red"), { r: 0, g: 0, b: 0 });
});

test("字型名稱換成 PostScript 名稱", () => {
  assert.equal(psdFontName("'Noto Sans TC',system-ui,sans-serif", 700), "NotoSansTC-Bold");
  assert.equal(psdFontName("'Noto Serif TC',serif", 900), "NotoSerifTC-Black");
  assert.equal(psdFontName("system-ui", 450), "NotoSansTC-Regular");
  assert.equal(psdFontName("Arial, sans-serif", 500), "Arial-Medium");
});

test("分段樣式接成 PS 的 styleRuns，長度加總等於全文", () => {
  const base = { fontSize: 70, color: hexToRgb("#ffffff"), fontWeight: 900 };
  const runs = styleRunsFor("終結「不良口氣」", base, [{ start: 2, end: 8, color: "#ffe94a" }]);
  assert.deepEqual(runs.map((r) => r.length), [2, 6]);
  assert.deepEqual(runs[1].style.color, { r: 255, g: 233, b: 74 });
  assert.equal(runs.reduce((s, r) => s + r.length, 0), 8);
  assert.deepEqual(styleRunsFor("abc", base, undefined), [{ length: 3, style: base }]);
  assert.deepEqual(styleRunsFor("abc", base, [{ start: -5, end: 99, fontSize: 10 }]).map((r) => r.length), [3]);
});

test("陰影角度：畫布 60°（右下）→ PS 120°", () => {
  assert.equal(psShadowAngle(60), 120);
  assert.equal(psShadowAngle(90), 90);
  assert.equal(psShadowAngle(0), 180);
  assert.equal(psShadowAngle(-90), -90);
  assert.equal(psShadowAngle(270), -90);
});

test("漸層字、彎曲字不能做成可編輯文字", () => {
  assert.equal(isEditableInPsd(null), true);
  assert.equal(isEditableInPsd({ strokeW: 0.1 }), true);
  assert.equal(isEditableInPsd({ gradient: ["#fff", "#000"] }), false);
  assert.equal(isEditableInPsd({ warp: "arc-up" }), false);
  assert.equal(isEditableInPsd({ warp: "none" }), true);
});

test("文字的圖層效果：陰影、光暈、描邊", () => {
  assert.equal(psdTextEffects({ fontSize: 50 }), undefined);
  const e = psdTextEffects({
    fontSize: 100, fx: { strokeW: 0.1, strokeColor: "#000000" },
    shadow: { color: "#4b3f7a", opacity: 0.35, distance: 6, blur: 16, angle: 90 },
    glow: { color: "#ffffff", size: 10, opacity: 0.9, strength: 2 },
  }) as unknown as { dropShadow: { angle: number; distance: unknown }[]; stroke: { size: unknown }[]; outerGlow: { opacity: number } };
  assert.equal(e.dropShadow[0].angle, 90);
  assert.deepEqual(e.dropShadow[0].distance, { units: "Pixels", value: 6 });
  assert.deepEqual(e.stroke[0].size, { units: "Pixels", value: 5 });
  assert.equal(e.outerGlow.opacity, 0.9);
});

test("檔名", () => {
  assert.equal(psdFileName("三步驟/範本"), "三步驟 範本.psd");
  assert.equal(psdFileName(""), "設計稿.psd");
});
