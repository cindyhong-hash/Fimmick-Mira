import assert from "node:assert/strict";
import test from "node:test";
import { boxPercent, buildRefFillPrompt, contextBox } from "./fill-reference.ts";

test("填色＋參考圖：框外多裁一圈、不超出整張圖", () => {
  assert.deepEqual(contextBox({ x: 400, y: 400, w: 200, h: 100 }, 1080, 1080), { left: 300, top: 336, width: 400, height: 228 });
  // 靠邊的框：裁切範圍被整張圖的邊界擋住
  assert.deepEqual(contextBox({ x: 0, y: 1000, w: 100, h: 80 }, 1080, 1080), { left: 0, top: 936, width: 164, height: 144 });
});

test("填色＋參考圖：框在裁切範圍裡的百分比、提示詞要講清楚改哪裡", () => {
  const crop = contextBox({ x: 400, y: 400, w: 200, h: 100 }, 1080, 1080);
  const at = boxPercent({ x: 400, y: 400, w: 200, h: 100 }, crop);
  assert.deepEqual(at, { x0: 25, x1: 75, y0: 28, y1: 72 });
  const p = buildRefFillPrompt("放一束跟參考圖一樣的花", at);
  assert.match(p, /Edit the FIRST image only inside the region from 25% to 75%/);
  assert.match(p, /SECOND image as the visual reference/);
  assert.match(p, /放一束跟參考圖一樣的花/);
  assert.match(buildRefFillPrompt("", at), /main subject of the second image/);
});
