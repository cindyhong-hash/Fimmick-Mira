import assert from "node:assert/strict";
import test from "node:test";
import { applyLayerTransform, docToLayer, layerCorners, layerToDoc } from "./layer-transform.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test("沒有傾斜也沒有旋轉：就是平移", () => {
  const l = { cx: 100, cy: 50, w: 40, h: 20, rotation: 0 };
  assert.deepEqual(layerToDoc(l, -20, -10), { x: 80, y: 40 });
  assert.deepEqual(layerCorners(l).map((p) => [p.x, p.y]), [[80, 40], [120, 40], [120, 60], [80, 60]]);
});

test("水平傾斜：上緣往右、下緣往左，變成平行四邊形（像斜的標籤）", () => {
  const l = { cx: 0, cy: 0, w: 100, h: 40, rotation: 0, skewX: 45 };
  const [tl, tr, br, bl] = layerCorners(l);
  assert.ok(near(tl.x, -70) && near(tr.x, 30) && near(br.x, 70) && near(bl.x, -30), JSON.stringify([tl, tr, br, bl]));
  assert.ok(near(tl.y, -20) && near(bl.y, 20), "垂直位置不變");
});

test("畫布座標換回圖層座標：傾斜加旋轉也換得回來（點選、橡皮擦要用）", () => {
  const l = { cx: 300, cy: 200, w: 120, h: 60, rotation: 0.6, skewX: 25, skewY: -15 };
  for (const [px, py] of [[0, 0], [-60, -30], [60, 30], [17, -9]]) {
    const d = layerToDoc(l, px, py), back = docToLayer(l, d.x, d.y);
    assert.ok(near(back.x, px) && near(back.y, py), `${px},${py} → ${back.x},${back.y}`);
  }
});

test("canvas 的變形順序跟 layerToDoc 一致：畫出來的位置就是點得到的位置", () => {
  const l = { cx: 50, cy: 60, w: 80, h: 30, rotation: 0.3, skewX: 20 };
  const calls: [string, number[]][] = [];
  const ctx = { translate: (...a: number[]) => calls.push(["translate", a]), rotate: (...a: number[]) => calls.push(["rotate", a]), transform: (...a: number[]) => calls.push(["transform", a]) } as unknown as CanvasRenderingContext2D;
  applyLayerTransform(ctx, l);
  assert.deepEqual(calls.map((c) => c[0]), ["translate", "rotate", "transform"]);
  // 用同一組矩陣手算一個點，要跟 layerToDoc 一樣
  const [, , [a, b, c, d]] = calls.map((x) => x[1]);
  const px = 40, py = -15, sx = a * px + c * py, sy = b * px + d * py;
  const cos = Math.cos(l.rotation), sin = Math.sin(l.rotation);
  const manual = { x: l.cx + sx * cos - sy * sin, y: l.cy + sx * sin + sy * cos }, viaFn = layerToDoc(l, px, py);
  assert.ok(near(manual.x, viaFn.x) && near(manual.y, viaFn.y));
});

test("沒有傾斜時不多做一次 transform", () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, { get: (_t, k) => () => calls.push(String(k)) }) as CanvasRenderingContext2D;
  applyLayerTransform(ctx, { cx: 0, cy: 0, w: 1, h: 1, rotation: 0 });
  assert.deepEqual(calls, ["translate", "rotate"]);
});
