import assert from "node:assert/strict";
import test from "node:test";
import { distanceToPolyline, samplePath, simplify, smoothStroke, stabilize, toSmoothPath, toSvgPath } from "./freehand.ts";

/** 一條往右畫、每點上下亂抖 ±2px 的線（模擬手抖）。 */
const jittery = Array.from({ length: 60 }, (_, i) => ({ x: i * 4, y: 100 + (i % 2 ? 2 : -2) }));
const wobble = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p.y - pts[i].y), 0);

test("穩定器會壓掉手抖，但線頭尾照原位（線頭要對得上游標）", () => {
  const out = stabilize(jittery, 0.5);
  assert.ok(wobble(out) < wobble(jittery) * 0.5, `抖動 ${wobble(out)} vs ${wobble(jittery)}`);
  assert.deepEqual(out[0], jittery[0]);
  assert.deepEqual(out[out.length - 1], jittery[jittery.length - 1]);
});

test("平滑度 0：幾乎照原樣，不幫人修正筆跡", () => {
  const out = stabilize(jittery, 0);
  assert.deepEqual(out, jittery);
});

test("簡化：直線上多餘的點拿掉，轉折一定留著", () => {
  const corner = [...Array.from({ length: 20 }, (_, i) => ({ x: i * 5, y: 0 })), ...Array.from({ length: 20 }, (_, i) => ({ x: 95, y: (i + 1) * 5 }))];
  const out = simplify(corner, 0.5);
  assert.ok(out.length <= 4, `剩 ${out.length} 個點`);
  assert.ok(out.some((p) => p.x === 95 && p.y === 0), "轉角要保留");
  assert.deepEqual(out[0], corner[0]);
  assert.deepEqual(out[out.length - 1], corner[corner.length - 1]);
});

test("轉成平順曲線：曲線通過每一個點，頭尾沒有多出去的把手", () => {
  const path = toSmoothPath([{ x: 0, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 0 }]);
  assert.equal(path[0].ix, undefined);
  assert.equal(path[2].ox, undefined);
  assert.ok(path[1].ix != null && path[1].ox != null);
  assert.equal(path[1].x, 50);
  // 中間點的進出把手方向相反（平滑、不是尖角）
  assert.ok(Math.abs((path[1].ix ?? 0) + (path[1].ox ?? 0)) < 1e-9);
});

test("一筆完整處理：點數大幅減少、仍然從起點畫到終點", () => {
  const out = smoothStroke(jittery, 50);
  assert.ok(out.length < jittery.length / 3, `剩 ${out.length} 個點`);
  assert.equal(out[0].x, 0);
  assert.equal(out[out.length - 1].x, 236);
});

test("只點一下也要有一筆（畫成一個點）", () => {
  const out = smoothStroke([{ x: 10, y: 10 }], 50);
  assert.equal(out.length, 1);
});

test("取樣與距離：橡皮擦碰到線才算，離很遠不算", () => {
  // 比例座標：從左中到右中的一條曲線
  const pts = [{ x: -0.5, y: 0, ox: 0.2, oy: -0.2 }, { x: 0.5, y: 0, ix: -0.2, iy: -0.2 }];
  const line = samplePath(pts, 200, 100);
  assert.ok(line.length > 5);
  assert.ok(distanceToPolyline({ x: -100, y: 0 }, line) < 0.001, "起點就在線上");
  assert.ok(distanceToPolyline({ x: 0, y: 80 }, line) > 50);
});

test("輸出 SVG path：曲線用 C、直線用 L", () => {
  const d = toSvgPath([{ x: -0.5, y: 0 }, { x: 0, y: 0.5, ix: -0.1, iy: 0 }, { x: 0.5, y: 0 }], 100, 100);
  assert.equal(d, "M-50 0 C-50 0 -10 50 0 50 L50 0");
});
