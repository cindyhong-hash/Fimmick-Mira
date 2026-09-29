import assert from "node:assert/strict";
import test from "node:test";
import { idsInBox, normBox, selectableIds } from "./box-select.ts";

const rect = (id: string, x: number, y: number, w: number, h: number, over = {}) => ({
  id, corners: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], locked: false, visible: true, type: "object", ...over,
});

test("框碰到就選，往哪個方向拖都一樣", () => {
  const items = [rect("a", 0, 0, 100, 100), rect("b", 200, 0, 100, 100), rect("c", 500, 500, 50, 50)];
  assert.deepEqual(idsInBox(items, { x0: 50, y0: 50, x1: 250, y1: 80 }), ["a", "b"]);
  assert.deepEqual(idsInBox(items, { x0: 250, y0: 80, x1: 50, y1: 50 }), ["a", "b"]);
  assert.deepEqual(idsInBox(items, { x0: 600, y0: 600, x1: 700, y1: 700 }), []);
  assert.deepEqual(normBox({ x0: 5, y0: 9, x1: 1, y1: 2 }), { x0: 1, y0: 2, x1: 5, y1: 9 });
});

test("鎖定、隱藏、背景不選；群組整組帶進來", () => {
  const items = [
    rect("bg", 0, 0, 1000, 1000, { type: "background", locked: true }),
    rect("lock", 10, 10, 20, 20, { locked: true }),
    rect("hid", 10, 10, 20, 20, { visible: false }),
    rect("g1", 10, 10, 20, 20, { groupId: "g" }),
    rect("g2", 800, 800, 20, 20, { groupId: "g" }),
  ];
  assert.deepEqual(idsInBox(items, { x0: 0, y0: 0, x1: 50, y1: 50 }), ["g1", "g2"]);
  assert.deepEqual(selectableIds(items), ["g1", "g2"]);
});
