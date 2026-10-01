import assert from "node:assert/strict";
import test from "node:test";
import { readTransition, sequenceAt, sequenceLayout, transitionPoses } from "./page-transition.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("整份影片：每頁接在上一頁後面，過場跟上一頁的尾巴重疊", () => {
  const pages = [{ duration: 3 }, { duration: 4, transitionIn: { kind: "fade" as const, duration: 0.5 } }, { duration: 2, transitionIn: null }];
  const L = sequenceLayout(pages);
  assert.deepEqual(L.starts, [0, 2.5, 6.5]);
  assert.deepEqual(L.trans, [0, 0.5, 0]);
  near(L.total, 8.5);
  // 過場太長：夾到前後兩頁各一半以內
  const long = sequenceLayout([{ duration: 1 }, { duration: 6, transitionIn: { kind: "push" as const, duration: 3, dir: "left" as const } }]);
  near(long.trans[1], 0.5);
});

test("第 t 秒在播哪一頁、是不是在過場中", () => {
  const pages = [{ duration: 3 }, { duration: 4, transitionIn: { kind: "fade" as const, duration: 1 } }];
  const L = sequenceLayout(pages);
  assert.deepEqual(sequenceAt(L, pages, 1), { from: { page: 0, local: 1 } });
  const mid = sequenceAt(L, pages, 2.5);
  assert.equal(mid.from.page, 0); near(mid.from.local, 2.5);
  assert.equal(mid.to?.page, 1); near(mid.to!.local, 0.5);
  near(mid.mix!, 0.5);
  const after = sequenceAt(L, pages, 4);
  assert.equal(after.from.page, 1); near(after.from.local, 2); assert.equal(after.to, undefined);
  // 超過結尾停在最後一頁的最後一格
  const end = sequenceAt(L, pages, 99);
  assert.equal(end.from.page, 1); near(end.from.local, 4);
});

test("過場的位置：推移從一邊推進來、掀開從一邊露出來", () => {
  const push0 = transitionPoses({ kind: "push", duration: 0.5, dir: "left" }, 0);
  near(push0.from.dx, 0); near(push0.to.dx, 1);
  const push1 = transitionPoses({ kind: "push", duration: 0.5, dir: "left" }, 1);
  near(push1.from.dx, -1); near(push1.to.dx, 0);
  const up = transitionPoses({ kind: "push", duration: 0.5, dir: "up" }, 0);
  near(up.to.dy, 1);
  const wipe = transitionPoses({ kind: "wipe", duration: 0.5, dir: "left" }, 0.5);
  near(wipe.to.clip!.x0, 0.5); near(wipe.to.clip!.x1, 1);
  const fade = transitionPoses({ kind: "fade", duration: 0.5 }, 0.5);
  near(fade.to.alpha, 0.5); near(fade.from.alpha, 1);
  assert.equal(transitionPoses({ kind: "zoom", duration: 0.5 }, 0.5).toOnTop, false);
});

test("讀存檔：格式不對的過場丟掉、數值夾在範圍內", () => {
  assert.equal(readTransition(null), null);
  assert.equal(readTransition({ kind: "spin" }), null);
  assert.deepEqual(readTransition({ kind: "push", duration: 9, dir: "sideways" }), { kind: "push", duration: 2, dir: "left" });
  assert.deepEqual(readTransition({ kind: "fade" }), { kind: "fade", duration: 0.5 });
});

test("黑場／白場過渡：前半段淡到全黑（全白）、後半段再淡出下一頁", () => {
  const early = transitionPoses({ kind: "dipBlack", duration: 1 }, 0.25);
  assert.equal(early.overlay?.color, "#000"); near(early.overlay!.alpha, 0.5);
  assert.equal(early.to.alpha, 0);
  const mid = transitionPoses({ kind: "dipBlack", duration: 1 }, 0.5);
  near(mid.overlay!.alpha, 1);
  const late = transitionPoses({ kind: "dipWhite", duration: 1 }, 0.75);
  assert.equal(late.overlay?.color, "#fff"); near(late.overlay!.alpha, 0.5);
  assert.equal(late.from.alpha, 0); near(late.to.alpha, 1);
});

test("疊加／非疊加溶解：黑底、下一頁用加亮／變亮混合，中間兩頁都在", () => {
  const add = transitionPoses({ kind: "additive", duration: 1 }, 0.5);
  assert.equal(add.base, "#000"); assert.equal(add.to.blend, "lighter");
  near(add.from.alpha, 1); near(add.to.alpha, 1);
  const end = transitionPoses({ kind: "additive", duration: 1 }, 1);
  near(end.from.alpha, 0); near(end.to.alpha, 1);
  assert.equal(transitionPoses({ kind: "nonAdditive", duration: 1 }, 0.5).to.blend, "lighten");
  // 膠片溶解比交叉溶解早一點亮起來
  assert.ok(transitionPoses({ kind: "filmDissolve", duration: 1 }, 0.3).to.alpha > transitionPoses({ kind: "fade", duration: 1 }, 0.3).to.alpha);
  assert.deepEqual(readTransition({ kind: "dipWhite", duration: 0.8 }), { kind: "dipWhite", duration: 0.8 });
});
