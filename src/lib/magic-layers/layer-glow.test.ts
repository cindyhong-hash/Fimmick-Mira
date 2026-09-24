import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SHADOW, glowColor, glowPasses, shadowOffset } from "./layer-glow.ts";

test("光暈顏色：#rrggbb＋透明度 → rgba", () => {
  assert.equal(glowColor("#ff8800", 0.5), "rgba(255,136,0,0.5)");
  assert.equal(glowColor("#ff8800cc", 1), "rgba(255,136,0,1)");   // 帶透明度的 hex 只取顏色
  assert.equal(glowColor("not-a-color", 2), "rgba(255,224,102,1)");   // 亂填給預設黃、透明度夾在 0–1
});

test("強度：1–5 的整數", () => {
  assert.equal(glowPasses(0), 1);
  assert.equal(glowPasses(2.4), 2);
  assert.equal(glowPasses(9), 5);
});

test("陰影方向：0 往右、90 往下、預設往右下", () => {
  assert.deepEqual(shadowOffset({ distance: 10, angle: 0 }), { dx: 10, dy: 0 });
  assert.deepEqual(shadowOffset({ distance: 10, angle: 90 }), { dx: 0, dy: 10 });
  assert.deepEqual(shadowOffset({ distance: 10, angle: 180 }), { dx: -10, dy: 0 });
  const d = shadowOffset(DEFAULT_SHADOW);
  assert.ok(d.dx > 0 && d.dy > 0 && d.dy > d.dx, "預設往右下、偏下方");
});
