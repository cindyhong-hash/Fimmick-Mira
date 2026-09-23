/* ============================================================
   照參考圖重做 —— 像素層的校正（純函式，不碰網路）

   視覺模型給的框「大致對」但不夠貼，顏色也常猜錯；這裡用原圖像素把它們修準，
   並算出要擦掉的範圍。每條規則後面都是實測踩過的坑。
   ============================================================ */
import type { Box } from "./types.ts";
import type { NormBox, RawShape, RawText } from "./layout.ts";

/** 原圖的 RGB 像素（sharp raw，3 channels）。 */
export type RgbImage = { data: Uint8Array; width: number; height: number };
type Rgb = [number, number, number];

export function pixel(img: RgbImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
export const colorDistance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function hexToRgb(hex: string): Rgb {
  const m = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) || 0) as Rgb;
}
export const rgbToHex = (c: readonly number[]) => `#${c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const median = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

export function clampBox(b: Box, W: number, H: number): Box {
  const x = Math.max(0, Math.round(b.x)), y = Math.max(0, Math.round(b.y));
  return { x, y, w: Math.max(0, Math.min(W - x, Math.round(b.w - (x - b.x)))), h: Math.max(0, Math.min(H - y, Math.round(b.h - (y - b.y)))) };
}
export function normToPx([y0, x0, y1, x1]: NormBox, W: number, H: number): Box {
  return clampBox({ x: (x0 / 1000) * W, y: (y0 / 1000) * H, w: ((x1 - x0) / 1000) * W, h: ((y1 - y0) / 1000) * H }, W, H);
}
export const boxesTouch = (a: Box, b: Box) => !(a.x > b.x + b.w || b.x > a.x + a.w || a.y > b.y + b.h || b.y > a.y + a.h);

/**
 * 在字數分布裡找「跟原框重疊最多的連續帶」，容許字與字之間的空隙。
 * 回傳 [起, 迄]（含）。
 */
function band(counts: number[], offset: number, lo: number, hi: number, gapTol: number): [number, number] {
  let best: { a: number; b: number; ov: number } | null = null;
  let cur: { a: number; b: number } | null = null;
  let gap = 0;
  const close = () => {
    if (!cur) return;
    const ov = Math.min(cur.b + offset, hi) - Math.max(cur.a + offset, lo);
    if (!best || ov > best.ov) best = { ...cur, ov };
    cur = null;
  };
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) { if (!cur) cur = { a: i, b: i }; cur.b = i; gap = 0; }
    else if (cur && ++gap > gapTol) { close(); gap = 0; }
  }
  close();
  const b = best as { a: number; b: number; ov: number } | null;
  return b && b.ov > 0 ? [b.a + offset, b.b + offset] : [lo, hi];
}

export type RefinedText = { box: Box; color: string };

/**
 * 校正一段字的框與顏色，並把字跡像素標進 ink（之後要擦掉）。
 *
 * - 背景色逐欄（直排逐列）取框外緊鄰的像素，而不是整圈一個中位色：
 *   字常壓在漸層橫條上，整圈取色會把「橫條」判成字而整條擦掉（Kessho 的藍色橫條）。
 * - 校正只微調（外擴 5%）：放太寬會把旁邊的小圓點吃進來（LIVE 左上那顆點）。
 * - 只把緊框裡的像素標成字跡：框外的 logo、圖示不能被波及。
 * - 字色有兩種算法，依情況選：
 *   框上下邊顏色一致（背景左右分割也算）→ 跟背景比，取最不像背景的那段像素；
 *   上下邊差很多（框外緊貼著別段字）→ 背景估計不可信，改取框裡「數量少的那群顏色」。
 */
export function refineText(img: RgbImage, t: RawText, ink: Uint8Array): RefinedText {
  const { width: W, height: H } = img;
  const raw = normToPx(t.box, W, H);
  if (raw.w < 2 || raw.h < 2) return { box: raw, color: t.color };
  const vertical = t.vertical;
  const edge = Math.max(2, Math.round(Math.min(raw.w, raw.h) * 0.08));
  const pad = Math.max(2, Math.round(Math.min(raw.w, raw.h) * 0.05));
  const zone = clampBox({ x: raw.x - pad, y: raw.y - pad, w: raw.w + pad * 2, h: raw.h + pad * 2 }, W, H);
  const fg = hexToRgb(t.color);
  const topY = Math.max(0, zone.y - edge), botY = Math.min(H - 1, zone.y + zone.h + edge);
  const leftX = Math.max(0, zone.x - edge), rightX = Math.min(W - 1, zone.x + zone.w + edge);
  const localBg = (x: number, y: number): number[] => {
    const [a, b, f] = vertical
      ? [pixel(img, leftX, y), pixel(img, rightX, y), (x - zone.x) / Math.max(1, zone.w)]
      : [pixel(img, x, topY), pixel(img, x, botY), (y - zone.y) / Math.max(1, zone.h)];
    return [0, 1, 2].map((k) => a[k] * (1 - f) + b[k] * f);
  };

  const hits: { x: number; y: number; d: number; c: Rgb }[] = [];
  const rowCount = new Array<number>(zone.h).fill(0), colCount = new Array<number>(zone.w).fill(0);
  for (let y = zone.y; y < zone.y + zone.h; y++) for (let x = zone.x; x < zone.x + zone.w; x++) {
    const c = pixel(img, x, y), bg = localBg(x, y), d = colorDistance(c, bg);
    const nearFg = colorDistance(fg, bg) > 40 && colorDistance(c, fg) < d * 0.9;
    if (!(d > 40 && (nearFg || d > 60))) continue;
    hits.push({ x, y, d, c });
    rowCount[y - zone.y]++; colCount[x - zone.x]++;
  }
  const lineH = vertical ? raw.w : raw.h / Math.max(1, t.lines);
  const [y0, y1] = band(rowCount, zone.y, raw.y, raw.y + raw.h, Math.round(vertical ? lineH * 0.6 : lineH * 0.35));
  const [x0, x1] = band(colCount, zone.x, raw.x, raw.x + raw.w, Math.round(vertical ? lineH * 0.35 : lineH * 1.2));
  const box = hits.length > 20 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : raw;

  const core: { d: number; c: Rgb }[] = [];
  for (const h of hits) if (h.x >= x0 && h.x <= x1 && h.y >= y0 && h.y <= y1) { ink[h.y * W + h.x] = 1; core.push(h); }

  // 算法一：跟背景比
  core.sort((a, b) => b.d - a.d);
  const topCore = core.slice(0, Math.max(1, Math.floor(core.length * 0.4)));
  const byEdge = topCore.length > 30 ? rgbToHex([0, 1, 2].map((k) => median(topCore.map((e) => e.c[k])))) : null;

  // 算法二：框裡分兩群，數量少的那群是字（字永遠比底少）
  const pts: Rgb[] = [];
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) pts.push(pixel(img, x, y));
  const lum = (c: Rgb) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  let A: number[] = pts.reduce((a, c) => (lum(c) < lum(a) ? c : a), pts[0] ?? [0, 0, 0]);
  let B: number[] = pts.reduce((a, c) => (lum(c) > lum(a) ? c : a), pts[0] ?? [255, 255, 255]);
  let ga: Rgb[] = [], gb: Rgb[] = [];
  for (let it = 0; it < 6; it++) {
    ga = []; gb = [];
    for (const c of pts) (colorDistance(c, A) <= colorDistance(c, B) ? ga : gb).push(c);
    const mean = (g: Rgb[], d: number[]) => (g.length ? [0, 1, 2].map((k) => g.reduce((s, c) => s + c[k], 0) / g.length) : d);
    A = mean(ga, A); B = mean(gb, B);
  }
  const [minor, majorC] = ga.length < gb.length ? [ga, B] : [gb, A];
  const far = minor.map((c) => ({ d: colorDistance(c, majorC), c })).sort((a, b) => b.d - a.d).slice(0, Math.max(1, Math.floor(minor.length / 2)));
  const byMinority = far.length > 20 && colorDistance(A, B) > 30 ? rgbToHex([0, 1, 2].map((k) => median(far.map((e) => e.c[k])))) : null;

  let disagree = 0, samples = 0;
  if (!vertical) for (let x = x0; x <= x1; x += 3) { samples++; if (colorDistance(pixel(img, x, topY), pixel(img, x, botY)) > 60) disagree++; }
  else for (let y = y0; y <= y1; y += 3) { samples++; if (colorDistance(pixel(img, leftX, y), pixel(img, rightX, y)) > 60) disagree++; }
  const edgesUnreliable = samples > 0 && disagree / samples > 0.3;
  const color = (edgesUnreliable ? byMinority ?? byEdge : byEdge ?? byMinority) ?? t.color;
  return { box, color };
}

/**
 * 這段字是不是被產品擋住一部分（字在產品後面）。
 *
 * 不能只信視覺模型：同一張圖跑兩次，一次說擋住、一次說沒有。判斷錯的話，
 * 重建的字會蓋在產品上面。所以用像素自己算：字框跟產品重疊的那塊裡，
 * 如果幾乎看不到這段字的顏色（被產品蓋掉了），就是在產品後面。
 */
export function isHiddenBehindProduct(img: RgbImage, box: Box, textColor: string, productAlpha: Uint8Array): boolean {
  const W = img.width, fg = hexToRgb(textColor);
  let overlap = 0, outside = 0, inkIn = 0, inkOut = 0;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
    const isInk = colorDistance(pixel(img, x, y), fg) < 45;
    if (productAlpha[y * W + x] > 128) { overlap++; if (isInk) inkIn++; }
    else { outside++; if (isInk) inkOut++; }
  }
  const area = overlap + outside;
  // 產品常常只蓋到字的一小條（PuraVida 的罐子只遮住「夜」「保」右邊約 5%），門檻不能設高；
  // 但重疊的像素太少時統計不可靠，至少要 200 個。
  if (!area || overlap < 200 || overlap / area < 0.02 || !outside || inkOut / outside < 0.03) return false;
  return inkIn / overlap < (inkOut / outside) * 0.25;
}

/** 色塊內部出現最多的顏色（上面的字是少數，不會影響）。 */
export function dominantColor(img: RgbImage, b: Box): string {
  const inset = Math.max(1, Math.round(Math.min(b.w, b.h) * 0.2));
  const counts = new Map<number, number>();
  for (let y = b.y + inset; y < b.y + b.h - inset; y++) for (let x = b.x + inset; x < b.x + b.w - inset; x++) {
    const [r, g, bl] = pixel(img, x, y);
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = 0, key = 0;
  for (const [k, c] of counts) if (c > best) { best = c; key = k; }
  return rgbToHex([((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4]);
}

/**
 * 哪些色塊要重建成可編輯的向量色塊。其他的留在背景裡：
 * 大底框（超過畫面 25%）、柔光玻璃感、外框、線條（常是虛線，重建會變實線），
 * 以及跟 logo／圖示重疊的——重建的色塊會蓋住烤在背景裡的圖示（太陽、月亮）。
 */
export function shouldRebuildShape(s: RawShape, box: Box, W: number, H: number, graphicBoxes: Box[]): boolean {
  const area = (box.w * box.h) / (W * H);
  const flat = ["rect", "pill", "circle"].includes(s.kind) && !s.blurry && s.fill !== "none" && /^#[0-9a-f]{6}$/i.test(s.fill);
  return flat && area < 0.25 && !graphicBoxes.some((g) => boxesTouch(g, box));
}

/**
 * 把產品框分組：真的疊在一起（重疊超過小的那個的 15%）才併成一組，
 * 疊在一起的產品分開拖會露出彼此的缺口；框角擦到一點不算。
 */
export function groupProducts(boxes: Box[]): number[][] {
  const overlaps = (b: Box, o: Box) => {
    const iw = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x), ih = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y);
    return iw > 0 && ih > 0 && iw * ih > 0.15 * Math.min(b.w * b.h, o.w * o.h);
  };
  const groups: number[][] = boxes.map((_, i) => [i]);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      if (groups[i].some((a) => groups[j].some((b) => overlaps(boxes[a], boxes[b])))) {
        groups[i].push(...groups[j]); groups.splice(j, 1); merged = true; break outer;
      }
    }
  }
  return groups;
}

/**
 * 把去背後的產品像素分給各組，每個像素只屬於一組。
 *
 * 之前每組照自己的框（外擴）去裁，框重疊的地方兩組都拿到同一塊像素：
 * 平常疊起來看不出來，使用者把前面的軟管拖開，後面那層就多出一塊軟管碎片。
 * 規則：落在誰的框裡歸誰；同時落在幾個框裡，歸最小的那個（通常是前面那支）；
 * 都不在框裡（框畫得太緊）歸最近的框。回傳每個像素的組別，-1＝不是產品。
 */
export function assignProductPixels(alpha: Uint8Array, W: number, H: number, groupBoxes: Box[]): Int16Array {
  const owner = new Int16Array(W * H).fill(-1);
  const areas = groupBoxes.map((b) => b.w * b.h);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!alpha[y * W + x]) continue;
    let best = -1, bestArea = Infinity, nearest = -1, nearestD = Infinity;
    groupBoxes.forEach((b, g) => {
      const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
      if (inside && areas[g] < bestArea) { best = g; bestArea = areas[g]; }
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w - 1)), dy = Math.max(b.y - y, 0, y - (b.y + b.h - 1));
      const d = dx * dx + dy * dy;
      if (d < nearestD) { nearestD = d; nearest = g; }
    });
    owner[y * W + x] = best >= 0 ? best : nearest;
  }
  return owner;
}

/** 方形膨脹（二值遮罩）：讓擦除範圍把字的反鋸齒邊緣、產品的陰影邊也吃掉。 */
export function dilate(src: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let last = -1e9;
    for (let x = 0; x < W; x++) { if (src[y * W + x]) last = x; if (x - last <= r) tmp[y * W + x] = 1; }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (src[y * W + x]) last = x; if (last - x <= r) tmp[y * W + x] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; }
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; }
  }
  return out;
}

/** 對每個落在橢圓（box 內切）裡的像素呼叫 fn。 */
export function forEachInEllipse(b: Box, scale: number, fn: (x: number, y: number) => void) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++)
    if (((x - cx) / (b.w / 2)) ** 2 + ((y - cy) / (b.h / 2)) ** 2 <= scale) fn(x, y);
}
