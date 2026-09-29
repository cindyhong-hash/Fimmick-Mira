/* ============================================================
   自由畫布文字：斷行、每個字的位置、游標、選取、點擊位置 → 第幾個字。

   畫布上的字是 canvas 畫的，編輯時輸入交給一個看不見的 textarea（中文輸入法才正常），
   游標、選取反白、輸入法底線都由畫布自己畫。所以這裡算出來的位置要跟畫字時一模一樣：
   ・斷行規則照抄 editable-text.ts 的 layoutText（先整個詞，放不下再逐字）
   ・水平對齊、行高、上下置中（沒有 textLayout 的文字）或靠上（有 textLayout 的）照 drawTextEl
   量字寬交給呼叫端（measureRange(start, end)），分段樣式（某幾個字放大）量出來才會準。
   座標都是圖層自己的座標：原點在圖層中心，x 往右、y 往下。
   索引是 JS 字串索引（跟 textarea 的 selectionStart 一樣）。
   ============================================================ */

export type TextLineRange = { start: number; end: number };
export type CaretLine = TextLineRange & {
  /** 這一行中心的 y。 */
  y: number;
  /** x[k] = 第 start+k 個字前面的位置（長度 end-start+1）。 */
  x: number[];
};

/** 把文字切成行：先依換行切段落；有 maxWidth 就在段落裡自動換行（整個詞放得下就整個放，放不下才逐字拆）。 */
export function wrapRanges(text: string, maxWidth: number | null, measureRange: (start: number, end: number) => number): TextLineRange[] {
  const out: TextLineRange[] = [];
  let p = 0;
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const base = p;
    p += para.length + 1;
    if (!maxWidth || !(maxWidth > 0) || !para) { out.push({ start: base, end: base + para.length }); continue; }
    let ls = base, le = base;   // 目前這一行 [ls, le)
    const words = [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(para)];
    for (const w of words) {
      const ws = base + w.index, we = ws + w.segment.length;
      if (le > ls && measureRange(ls, we) > maxWidth) { out.push({ start: ls, end: le }); ls = le; }
      for (const g of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(w.segment)) {
        const gs = ws + g.index, ge = gs + g.segment.length;
        if (le > ls && measureRange(ls, ge) > maxWidth) { out.push({ start: ls, end: le }); ls = le; }
        le = ge;
      }
    }
    out.push({ start: ls, end: le });
  }
  return out;
}

/**
 * 每一行、每個字前面的位置。
 * vertical："center" = 整塊上下置中（沒有 textLayout 的文字）；"top" = 從框的上緣往下排（有 textLayout 的）。
 */
export function caretLines(input: {
  text: string; ranges: TextLineRange[]; w: number; h: number; align: "left" | "center" | "right";
  lineHeight: number; vertical: "center" | "top"; measureRange: (start: number, end: number) => number;
}): CaretLine[] {
  const { ranges, w, h, align, lineHeight, vertical, measureRange } = input;
  const firstY = vertical === "center" ? -((ranges.length - 1) * lineHeight) / 2 : -h / 2 + lineHeight / 2;
  return ranges.map((r, i) => {
    const width = measureRange(r.start, r.end);
    const x0 = align === "left" ? -w / 2 : align === "right" ? w / 2 - width : -width / 2;
    const x: number[] = [];
    for (let k = r.start; k <= r.end; k++) x.push(x0 + (k === r.start ? 0 : measureRange(r.start, k)));
    return { ...r, y: firstY + i * lineHeight, x };
  });
}

/** 索引落在哪一行：行尾的索引算在這一行（換行字元後面那個才算下一行）。 */
export function lineOf(lines: CaretLine[], index: number): number {
  for (let i = 0; i < lines.length; i++) if (index <= lines[i].end) return i;
  return Math.max(0, lines.length - 1);
}

/** 游標的位置（中心 y）。 */
export function caretAt(lines: CaretLine[], index: number): { x: number; y: number } {
  if (!lines.length) return { x: 0, y: 0 };
  const li = lineOf(lines, index), l = lines[li];
  const k = Math.max(0, Math.min(l.x.length - 1, index - l.start));
  return { x: l.x[k], y: l.y };
}

/** 點在 (x, y) → 最近的字縫索引。 */
export function indexAt(lines: CaretLine[], x: number, y: number): number {
  if (!lines.length) return 0;
  let li = 0, best = Infinity;
  lines.forEach((l, i) => { const d = Math.abs(l.y - y); if (d < best) { best = d; li = i; } });
  return nearestInLine(lines[li], x);
}
function nearestInLine(l: CaretLine, x: number): number {
  let k = 0, best = Infinity;
  l.x.forEach((xx, i) => { const d = Math.abs(xx - x); if (d < best) { best = d; k = i; } });
  return l.start + k;
}

/** 選取反白：每一行一塊（中心 y＋左右 x）。選到換行的那一行，右邊多留一點，看得出換行也被選了。 */
export function selectionSpans(lines: CaretLine[], a: number, b: number, newlineW = 6): { x0: number; x1: number; y: number }[] {
  const s = Math.min(a, b), e = Math.max(a, b);
  if (s === e) return [];
  const out: { x0: number; x1: number; y: number }[] = [];
  lines.forEach((l, i) => {
    const ls = Math.max(s, l.start), le = Math.min(e, l.end);
    if (ls > le) return;
    const x0 = l.x[ls - l.start];
    let x1 = l.x[le - l.start];
    if (e > l.end && i < lines.length - 1) x1 += newlineW;
    if (x1 > x0) out.push({ x0, x1, y: l.y });
  });
  return out;
}

/** 上／下方向鍵：移到上一行／下一行最接近同一個 x 的位置；第一行按上到最前面，最後一行按下到最後面。 */
export function verticalMove(lines: CaretLine[], index: number, dir: -1 | 1, preferredX?: number): number {
  if (!lines.length) return index;
  const li = lineOf(lines, index);
  const x = preferredX ?? caretAt(lines, index).x;
  const target = li + dir;
  if (target < 0) return lines[0].start;
  if (target >= lines.length) return lines[lines.length - 1].end;
  return nearestInLine(lines[target], x);
}

/** 最寬那一行的寬度。 */
export function widestLine(ranges: TextLineRange[], measureRange: (start: number, end: number) => number): number {
  return ranges.reduce((m, r) => Math.max(m, measureRange(r.start, r.end)), 0);
}

/**
 * 自動寬度：文字變長時框跟著變寬。對齊點固定不動（靠左的左邊不動、置中的中心不動、靠右的右邊不動）；
 * 快碰到畫布邊緣就停在那裡，改成固定寬度自動換行。回傳新的寬度與是否要改成固定寬度。
 * 旋轉過的框不算邊界（斜的框碰到哪裡不好算），只限制不超過畫布寬度。
 */
export function autoWidth(input: {
  need: number; cx: number; w: number; docW: number; align: "left" | "center" | "right"; rotated: boolean; min?: number;
  /** 離畫布邊緣留多少（預設 0）。 */
  margin?: number;
}): { w: number; fixed: boolean } {
  const { need, cx, w, docW, align, rotated } = input;
  const min = input.min ?? 20, mg = input.margin ?? 0;
  const left = cx - w / 2, right = cx + w / 2;
  const room = rotated ? docW - 2 * mg
    : align === "left" ? docW - mg - left
    : align === "right" ? right - mg
    : 2 * Math.min(cx - mg, docW - mg - cx);
  const allowed = Math.max(min, room);
  return need > allowed ? { w: allowed, fixed: true } : { w: Math.max(min, need), fixed: false };
}

/** 框寬改變時，照對齊點把中心往哪邊移（在圖層自己的 x 方向上）。 */
export function anchorShift(align: "left" | "center" | "right", oldW: number, newW: number): number {
  return align === "left" ? (newW - oldW) / 2 : align === "right" ? -(newW - oldW) / 2 : 0;
}

/**
 * 文字改了之後，分段樣式（某幾個字放大／換色）要跟著字移動：
 * 比對新舊文字頭尾相同的部分，中間被換掉的那段之後的樣式整段平移；被刪掉的字上的樣式縮短或消失。
 */
export function shiftRuns<R extends { start: number; end: number }>(runs: R[], oldText: string, newText: string): R[] {
  if (oldText === newText) return runs;
  let p = 0;
  const maxP = Math.min(oldText.length, newText.length);
  while (p < maxP && oldText[p] === newText[p]) p++;
  let q = 0;
  while (q < oldText.length - p && q < newText.length - p && oldText[oldText.length - 1 - q] === newText[newText.length - 1 - q]) q++;
  const oldEnd = oldText.length - q, delta = newText.length - oldText.length;
  // 插入點剛好在樣式的尾巴：新打的字不套這段樣式（跟一般文字編輯器一樣，接著打的是一般字）
  const mapPos = (x: number, isEnd: boolean) => (x < p || (isEnd && x === p) ? x : x >= oldEnd ? x + delta : p);
  return runs
    .map((r) => ({ ...r, start: mapPos(r.start, false), end: mapPos(r.end, true) }))
    .filter((r) => r.end > r.start);
}
