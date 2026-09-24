import assert from "node:assert/strict";
import test from "node:test";
import { alignOffsets, canDistribute, type AlignItem } from "./align.ts";

const box = (id: string, x: number, y: number, w: number, h: number, extra: Partial<AlignItem> = {}): AlignItem => ({ id, cx: x + w / 2, cy: y + h / 2, w, h, rotation: 0, ...extra });
const canvas = { w: 1000, h: 800 };

test("只選一個：對齊畫布（水平置中、靠下）", () => {
  const a = box("a", 10, 20, 200, 100);
  assert.deepEqual(alignOffsets([a], "hcenter", canvas).get("a"), { dx: 390, dy: 0 });
  assert.deepEqual(alignOffsets([a], "bottom", canvas).get("a"), { dx: 0, dy: 680 });
});

test("選兩個：對齊彼此的邊，已經對齊的那個不動", () => {
  const a = box("a", 100, 0, 50, 50), b = box("b", 300, 200, 80, 40);
  const left = alignOffsets([a, b], "left", canvas);
  assert.equal(left.has("a"), false);
  assert.deepEqual(left.get("b"), { dx: -200, dy: 0 });
  const right = alignOffsets([a, b], "right", canvas);
  assert.deepEqual(right.get("a"), { dx: 230, dy: 0 });   // 右緣對齊到 380
});

test("旋轉的圖層量的是實際佔的範圍", () => {
  // 100×20 轉 90° → 實際佔 20 寬
  const a = box("a", 0, 0, 100, 20, { rotation: Math.PI / 2 }), b = box("b", 200, 0, 50, 50);
  const off = alignOffsets([a, b], "left", canvas).get("a")!;
  // a 的中心在 x=50，轉完左緣在 40；要對齊的最左邊就是 40，所以 a 不用動、b 移到 40
  assert.equal(off, undefined);
  assert.ok(Math.abs(alignOffsets([a, b], "left", canvas).get("b")!.dx - -160) < 1e-9);
});

test("群組當一整塊：兩個成員移動一樣多，彼此位置不變", () => {
  const g1 = box("g1", 0, 0, 50, 50, { groupId: "G" }), g2 = box("g2", 100, 0, 50, 50, { groupId: "G" });
  const off = alignOffsets([g1, g2], "hcenter", canvas);   // 只有一塊 → 對齊畫布
  assert.deepEqual(off.get("g1"), off.get("g2"));
  assert.deepEqual(off.get("g1"), { dx: 425, dy: 0 });
});

test("鎖定的不動", () => {
  const a = box("a", 0, 0, 50, 50, { locked: true }), b = box("b", 300, 0, 50, 50), c = box("c", 500, 0, 50, 50);
  const off = alignOffsets([a, b, c], "left", canvas);
  assert.equal(off.has("a"), false);
  assert.deepEqual(off.get("c"), { dx: -200, dy: 0 });   // 對齊的是沒鎖的 b、c
});

test("水平均分：頭尾不動，中間的空隙一樣大；兩個以下不能均分", () => {
  const a = box("a", 0, 0, 100, 50), b = box("b", 150, 0, 50, 50), c = box("c", 500, 0, 100, 50);
  // 空隙 = (600 - 250) / 2 = 175 → b 放在 100 + 175 = 275
  const off = alignOffsets([c, a, b], "hdistribute", canvas);
  assert.equal(off.has("a"), false);
  assert.equal(off.has("c"), false);
  assert.deepEqual(off.get("b"), { dx: 125, dy: 0 });
  assert.equal(canDistribute([a, b]), false);
  assert.equal(canDistribute([a, b, c]), true);
  assert.equal(alignOffsets([a, b], "hdistribute", canvas).size, 0);
});
