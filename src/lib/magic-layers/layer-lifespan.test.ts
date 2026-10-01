import assert from "node:assert/strict";
import test from "node:test";
import { aliveAt, clampLifespan, dragLifespan, lifespanOf, readLifespan } from "./layer-lifespan.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("物件存在時間：沒設＝整頁都在；編輯中（沒在播）一律顯示", () => {
  assert.equal(aliveAt({}, 99), true);
  assert.equal(aliveAt({ startTime: 0.4, endTime: 3.2 }, null), true);
  assert.equal(aliveAt({ startTime: 0.4, endTime: 3.2 }, 0.3), false);
  assert.equal(aliveAt({ startTime: 0.4, endTime: 3.2 }, 0.4), true);
  assert.equal(aliveAt({ startTime: 0.4, endTime: 3.2 }, 3.2), true);
  assert.equal(aliveAt({ startTime: 0.4, endTime: 3.2 }, 3.21), false);
  assert.deepEqual(lifespanOf({}, 6), { start: 0, end: 6 });
  assert.deepEqual(lifespanOf({ startTime: 1, endTime: 9 }, 6), { start: 1, end: 6 });
});

test("拖曳：整段平移不超出 0～頁長、左右兩端不會交叉", () => {
  // 整段往右移 3 秒，但頁長 6：最多移到 [3.2, 6]
  const m = dragLifespan("move", 0.4, 3.2, 3, 6);
  near(m.start, 3.2); near(m.end, 6);
  const back = dragLifespan("move", 0.4, 3.2, -2, 6);
  near(back.start, 0); near(back.end, 2.8);
  // 左端拉過右端：停在右端前 0.1 秒
  near(dragLifespan("start", 0.4, 3.2, 5, 6).start, 3.1);
  near(dragLifespan("end", 0.4, 3.2, -5, 6).end, 0.5);
  near(dragLifespan("end", 0.4, 3.2, 9, 6).end, 6);
});

test("頁長縮短：結束時間跟著夾進來；讀存檔丟掉不合理的值", () => {
  assert.deepEqual(clampLifespan({ startTime: 0.5, endTime: 5.5 }, 4), { startTime: 0.5, endTime: 4 });
  assert.deepEqual(clampLifespan({ startTime: 4.5, endTime: 5.5 }, 4), { startTime: 3.9, endTime: 4 });
  assert.deepEqual(clampLifespan({}, 4), {});
  assert.deepEqual(readLifespan({ startTime: 0.4, endTime: 3.2 }), { startTime: 0.4, endTime: 3.2 });
  assert.deepEqual(readLifespan({ startTime: -1, endTime: "x" }), { startTime: 0 });
  assert.deepEqual(readLifespan({ startTime: 3, endTime: 1 }), {});
});
