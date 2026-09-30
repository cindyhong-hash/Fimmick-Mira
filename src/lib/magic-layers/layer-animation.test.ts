import assert from "node:assert/strict";
import test from "node:test";
import { animEnd, animFrame, animPhase, defaultAnim, readAnims, shineBand, staggeredStarts, videoDuration } from "./layer-animation.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("animPhase：開始前、空檔、跑完都是 null；循環照 duration＋gap 算", () => {
  const a = { ...defaultAnim("shine", "a", 1), duration: 1, gap: 1, repeat: 2 };
  assert.equal(animPhase(a, 0.5), null);
  near(animPhase(a, 1.5)!, 0.5);
  assert.equal(animPhase(a, 2.5), null);       // 空檔
  near(animPhase(a, 3.25)!, 0.25);              // 第二輪
  assert.equal(animPhase(a, 5), null);          // 兩輪跑完
  assert.equal(animEnd(a), 4);
  const loop = { ...a, repeat: 0 };
  near(animPhase(loop, 9.5)!, 0.5);
  assert.equal(animEnd(loop), Infinity);
});

test("淡入：開始前透明、結束後保持顯示", () => {
  const f = defaultAnim("fadeIn", "f", 1);
  assert.equal(animFrame([f], 0).opacity, 0);
  assert.equal(animFrame([f], 5).opacity, 1);
  assert.ok(animFrame([f], 1.4).opacity > 0 && animFrame([f], 1.4).opacity < 1);
});

test("各種效果：沒動畫時不變；呼吸放大、彈跳、漂浮、閃爍、閃光", () => {
  assert.deepEqual(animFrame(undefined, 3), { dx: 0, dy: 0, scale: 1, opacity: 1, shines: [] });
  const pulse = { ...defaultAnim("pulse", "p"), duration: 2, intensity: 1 };
  near(animFrame([pulse], 0).scale, 1);
  near(animFrame([pulse], 1).scale, 1.12);      // 半輪最大
  const bounce = { ...defaultAnim("bounce", "b"), duration: 1, intensity: 1 };
  assert.ok(animFrame([bounce], 0.5).dy < 0);   // 往上
  const float = { ...defaultAnim("float", "fl"), duration: 4, intensity: 1 };
  near(animFrame([float], 1).dy, 0.05);
  const tw = { ...defaultAnim("twinkle", "t"), duration: 2, intensity: 1 };
  near(animFrame([tw], 1).opacity, 0.15);
  const sh = { ...defaultAnim("shine", "s"), duration: 1, gap: 0 };
  assert.equal(animFrame([sh], 0.5).shines.length, 1);
  // 同一個圖層疊兩個效果：縮放相乘
  near(animFrame([pulse, { ...pulse, id: "p2" }], 1).scale, 1.12 * 1.12);
});

test("光帶：從完全在外面走到完全在外面", () => {
  const start = shineBand(100, 200, { progress: 0, direction: "down", width: 0.3 });
  const end = shineBand(100, 200, { progress: 1, direction: "down", width: 0.3 });
  assert.ok(start.y1 <= -100 + 1e-9);   // 光帶在上緣外面
  assert.ok(end.y0 >= 100 - 1e-9);      // 光帶在下緣外面
  near(start.x0, 0);
  const right = shineBand(100, 200, { progress: 0.5, direction: "right", width: 0.3 });
  near((right.x0 + right.x1) / 2, 0);
});

test("錯開開始時間、影片長度、讀存檔", () => {
  assert.deepEqual(staggeredStarts(3, 0.5, 0.7), [0.5, 1.2, 1.9]);
  assert.equal(videoDuration([], null), 6);
  assert.equal(videoDuration([{ ...defaultAnim("fadeIn", "x", 8) }], null), 8.8);
  assert.equal(videoDuration([], 10), 10);
  assert.equal(videoDuration([], 99), 30);
  assert.equal(readAnims("nope"), undefined);
  const r = readAnims([{ kind: "shine", start: -5, intensity: 3, direction: "up" }, { kind: "bogus" }])!;
  assert.equal(r.length, 1);
  assert.equal(r[0].start, 0);
  assert.equal(r[0].intensity, 1);
  assert.equal(r[0].direction, "down");
});
