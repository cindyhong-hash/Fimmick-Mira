import assert from "node:assert/strict";
import test from "node:test";
import { anchorShift, autoWidth, shiftRuns, caretAt, caretLines, indexAt, lineOf, selectionSpans, verticalMove, widestLine, wrapRanges } from "./text-caret.ts";
import { layoutText } from "./editable-text.ts";

// 每個字 10 寬（中英文都一樣），方便算
const mono = () => (s: number, e: number) => (e - s) * 10;

test("wrapRanges：只依換行切段；有寬度才自動換行", () => {
  assert.deepEqual(wrapRanges("ab\ncd", null, mono()), [{ start: 0, end: 2 }, { start: 3, end: 5 }]);
  assert.deepEqual(wrapRanges("", null, mono()), [{ start: 0, end: 0 }]);
  // 「ab cd」剛好 50 放得下，下一個空白放不下 → 換行（跟 layoutText 一樣，空白留在下一行開頭）
  assert.deepEqual(wrapRanges("ab cd ef", 50, mono()), [{ start: 0, end: 5 }, { start: 5, end: 8 }]);
});

test("wrapRanges 的斷行跟畫布畫字（layoutText）一模一樣", () => {
  for (const [text, width] of [["hello world foo bar", 70], ["冰箱常備品清單，讓美味即刻上桌", 55], ["STEP.1  不沾水乾刷\n第二行 abc def", 60], ["a\n\nb", 20]] as const) {
    const ranges = wrapRanges(text, width, mono());
    const lines = layoutText(text, width, (t) => t.length * 10).map((l) => l.text);
    assert.deepEqual(ranges.map((r) => text.slice(r.start, r.end)), lines, text);
  }
});

test("caretLines：置中對齊、上下置中，每個字縫都有位置", () => {
  const text = "abcd\nef";
  const lines = caretLines({ text, ranges: wrapRanges(text, null, mono()), w: 100, h: 60, align: "center", lineHeight: 20, vertical: "center", measureRange: mono() });
  assert.deepEqual(lines[0].x, [-20, -10, 0, 10, 20]);
  assert.equal(lines[0].y, -10);
  assert.equal(lines[1].y, 10);
  assert.deepEqual(lines[1].x, [-10, 0, 10]);
  const top = caretLines({ text, ranges: wrapRanges(text, null, mono()), w: 100, h: 60, align: "left", lineHeight: 20, vertical: "top", measureRange: mono() });
  assert.equal(top[0].y, -20);
  assert.equal(top[0].x[0], -50);
});

test("游標、點擊位置、上下鍵", () => {
  const text = "abcd\nef";
  const lines = caretLines({ text, ranges: wrapRanges(text, null, mono()), w: 100, h: 60, align: "center", lineHeight: 20, vertical: "center", measureRange: mono() });
  assert.equal(lineOf(lines, 4), 0);   // 行尾還算第一行
  assert.equal(lineOf(lines, 5), 1);
  assert.deepEqual(caretAt(lines, 2), { x: 0, y: -10 });
  assert.equal(indexAt(lines, 4, -12), 2);
  assert.equal(indexAt(lines, 100, 12), 7);
  assert.equal(verticalMove(lines, 1, 1), 5);    // x=-10 → 下一行最接近 -10 的是 5
  assert.equal(verticalMove(lines, 6, -1), 2);
  assert.equal(verticalMove(lines, 2, -1), 0);   // 第一行按上 → 最前面
  assert.equal(verticalMove(lines, 6, 1), 7);    // 最後一行按下 → 最後面
});

test("選取反白跨行", () => {
  const text = "abcd\nef";
  const lines = caretLines({ text, ranges: wrapRanges(text, null, mono()), w: 100, h: 60, align: "left", lineHeight: 20, vertical: "center", measureRange: mono() });
  assert.deepEqual(selectionSpans(lines, 1, 1), []);
  assert.deepEqual(selectionSpans(lines, 1, 3), [{ x0: -40, x1: -20, y: -10 }]);
  const both = selectionSpans(lines, 2, 6);
  assert.equal(both.length, 2);
  assert.deepEqual(both[0], { x0: -30, x1: -4, y: -10 });   // 包含換行，右邊多 6
  assert.deepEqual(both[1], { x0: -50, x1: -40, y: 10 });
});

test("自動寬度：往對齊方向長，碰到畫布邊就改固定寬度", () => {
  assert.deepEqual(autoWidth({ need: 300, cx: 600, w: 200, docW: 1200, align: "center", rotated: false }), { w: 300, fixed: false });
  assert.deepEqual(autoWidth({ need: 1300, cx: 600, w: 200, docW: 1200, align: "center", rotated: false }), { w: 1200, fixed: true });
  // 靠左：左邊在 100，右邊最多到 1200 → 最多 1100
  assert.deepEqual(autoWidth({ need: 1150, cx: 200, w: 200, docW: 1200, align: "left", rotated: false }), { w: 1100, fixed: true });
  // 置中但靠近右邊：中心 1000，兩邊對稱最多 400
  assert.deepEqual(autoWidth({ need: 500, cx: 1000, w: 200, docW: 1200, align: "center", rotated: false }), { w: 400, fixed: true });
  assert.equal(anchorShift("left", 100, 160), 30);
  assert.equal(anchorShift("right", 100, 160), -30);
  assert.equal(anchorShift("center", 100, 160), 0);
  assert.equal(widestLine([{ start: 0, end: 4 }, { start: 5, end: 7 }], mono()), 40);
});

test("分段樣式跟著字移動", () => {
  const runs = [{ start: 3, end: 6, color: "#e0a052" }];   // 「常備品」
  // 在前面插字：整段往後移
  assert.deepEqual(shiftRuns(runs, "冰箱 常備品清單!", "我的冰箱 常備品清單!"), [{ start: 5, end: 8, color: "#e0a052" }]);
  // 在後面插字：不動
  assert.deepEqual(shiftRuns(runs, "冰箱 常備品清單!", "冰箱 常備品清單好物!"), runs);
  // 刪掉樣式裡的一個字：變短
  assert.deepEqual(shiftRuns(runs, "冰箱 常備品清單!", "冰箱 常品清單!"), [{ start: 3, end: 5, color: "#e0a052" }]);
  // 整段刪掉：消失
  assert.deepEqual(shiftRuns(runs, "冰箱 常備品清單!", "冰箱 清單!"), []);
  // 緊接在樣式後面打字：新字不套樣式
  assert.deepEqual(shiftRuns(runs, "冰箱 常備品清單!", "冰箱 常備品好清單!"), runs);
});

test("自動寬度留邊", () => {
  assert.deepEqual(autoWidth({ need: 1300, cx: 600, w: 200, docW: 1200, align: "center", rotated: false, margin: 40 }), { w: 1120, fixed: true });
});
