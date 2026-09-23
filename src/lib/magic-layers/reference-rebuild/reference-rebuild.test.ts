import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseReferenceLayout, type RawShape, type RawText } from "./layout.ts";
import { assignProductPixels, colorDistance, groupProducts, hexToRgb, isHiddenBehindProduct, refineText, shouldRebuildShape, type RgbImage } from "./pixels.ts";
import { fitText, fontFor, FONT_LATIN, FONT_SANS, FONT_SERIF, type Measure } from "./fit-text.ts";
import { rebuildToLayers } from "./to-layers.ts";
import { rebuildReference, type RebuildDeps } from "./rebuild.ts";
import type { RebuildResult, RebuildText } from "./types.ts";

// ---------- 測試用的小工具 ----------
function canvas(W: number, H: number, fill: [number, number, number]): RgbImage {
  const data = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) data.set(fill, i * 3);
  return { data, width: W, height: H };
}
function paint(img: RgbImage, x0: number, y0: number, w: number, h: number, c: (x: number, y: number) => [number, number, number]) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) img.data.set(c(x, y), (y * img.width + x) * 3);
}
/** 用幾個實心方塊當「字」：每個字 w 寬，中間留空隙。 */
function glyphs(img: RgbImage, x0: number, y0: number, count: number, size: number, gap: number, color: [number, number, number]) {
  for (let i = 0; i < count; i++) paint(img, x0 + i * (size + gap), y0, size, size, () => color);
}
const norm = (img: RgbImage, x: number, y: number, w: number, h: number): [number, number, number, number] =>
  [(y / img.height) * 1000, (x / img.width) * 1000, ((y + h) / img.height) * 1000, ((x + w) / img.width) * 1000];
const rawText = (over: Partial<RawText> & Pick<RawText, "box">): RawText => ({
  text: "測試文字", lines: 1, color: "#ffffff", weight: 700, family: "sans", italic: false, align: "center",
  vertical: false, letterSpacing: 0, rotationDeg: 0, behindProduct: false, ...over,
});
const close = (hex: string, rgb: [number, number, number], tol = 30) => colorDistance(hexToRgb(hex), rgb) <= tol;

// ---------- 版面解析 ----------
test("解析模型回覆：包了 ```json 也讀得懂，壞掉的單筆丟掉不影響其他", () => {
  const reply = "```json\n" + JSON.stringify({
    background: "漸層紫",
    texts: [
      { text: "LIVE", box: [100, 200, 300, 500], color: "#FFFFFF", weight: 900, align: "left", behindProduct: true },
      { text: "", box: [0, 0, 10, 10] },                 // 沒字
      { text: "壞框", box: [300, 300, 300, 400] },        // 高度 0
      { text: "出界", box: [-50, 900, 80, 1200] },        // 會被夾回 0–1000
    ],
    products: [{ label: "瓶子", box: [400, 400, 900, 600] }, { label: "壞", box: [1, 2] }],
    shapes: [{ kind: "pill", box: [320, 150, 380, 850], fill: "#ffffff", blurry: false }],
    graphics: [],
  }) + "\n```";
  const L = parseReferenceLayout(reply);
  assert.equal(L.texts.length, 2);
  assert.equal(L.texts[0].color, "#ffffff");
  assert.equal(L.texts[0].align, "left");
  assert.equal(L.texts[0].behindProduct, true);
  assert.deepEqual(L.texts[1].box, [0, 900, 80, 1000]);
  assert.equal(L.products.length, 1);
  assert.equal(L.shapes[0].kind, "pill");
});

test("整份讀不懂才丟錯，而且是使用者看得懂的話", () => {
  assert.throws(() => parseReferenceLayout("抱歉我無法處理"), /看不懂這張圖的版面/);
});

// ---------- 像素校正 ----------
test("字壓在深色漸層橫條上：只擦字，不能把橫條當成字擦掉", () => {
  // Kessho 那張的坑：整圈取一個背景色時，深藍橫條跟外面的淺底差很多，整條被判成字
  const img = canvas(300, 120, [235, 238, 245]);
  paint(img, 0, 30, 300, 50, (x) => [30 + (x / 300) * 90, 50 + (x / 300) * 90, 110 + (x / 300) * 90]);
  glyphs(img, 60, 45, 6, 20, 10, [255, 255, 255]);
  const ink = new Uint8Array(300 * 120);
  const r = refineText(img, rawText({ box: norm(img, 58, 43, 184, 24) }), ink);
  assert.ok(close(r.color, [255, 255, 255]), `字色應該是白色，得到 ${r.color}`);
  let barInk = 0;
  for (let y = 30; y < 80; y++) for (let x = 0; x < 300; x++) {
    const inGlyph = y >= 45 && y < 65 && x >= 60 && x < 240 && (x - 60) % 30 < 20;
    if (!inGlyph && ink[y * 300 + x]) barInk++;
  }
  assert.equal(barInk, 0, "橫條不能被標成字跡");
});

test("字旁邊的小圓點、圖示不會被吃進字框", () => {
  // LIVE 左上那顆白點：校正放太寬時被當成 L 的一部分，LIVE 被撐大擠到 DAY 旁邊
  const img = canvas(400, 200, [180, 180, 250]);
  paint(img, 20, 40, 18, 18, () => [255, 255, 255]);          // 小圓點
  glyphs(img, 60, 50, 4, 60, 12, [255, 255, 255]);             // LIVE
  const ink = new Uint8Array(400 * 200);
  const r = refineText(img, rawText({ box: norm(img, 60, 50, 276, 60), text: "LIVE" }), ink);
  assert.ok(r.box.x >= 55, `字框左邊不該延伸到圓點（x=${r.box.x}）`);
  for (let y = 40; y < 58; y++) for (let x = 20; x < 38; x++) assert.equal(ink[y * 400 + x], 0, "圓點不能被擦掉");
});

test("背景左右分割（白天／黑夜）時，跨在中間的白字還是白色", () => {
  // PuraVida 那張：只看「框裡數量少的顏色」會把右半邊的夜空判成字色
  const img = canvas(300, 100, [210, 225, 235]);
  paint(img, 150, 0, 150, 100, () => [15, 35, 70]);
  glyphs(img, 70, 40, 6, 20, 8, [250, 252, 255]);
  const ink = new Uint8Array(300 * 100);
  const r = refineText(img, rawText({ box: norm(img, 70, 40, 160, 20), color: "#0e2846" }), ink);
  assert.ok(close(r.color, [250, 252, 255]), `應該是白字，得到 ${r.color}`);
});

test("字框下面緊貼著別段字時，改用框裡數量少的顏色當字色", () => {
  // ORBIS 那張：小灰字底下緊貼大標題，框外取到的「背景」其實是大標題的黑色
  const img = canvas(300, 100, [255, 255, 255]);
  glyphs(img, 60, 20, 6, 10, 20, [140, 140, 140]);
  paint(img, 0, 34, 300, 40, () => [0, 0, 0]);
  const ink = new Uint8Array(300 * 100);
  const r = refineText(img, rawText({ box: norm(img, 60, 20, 160, 10), color: "#000000" }), ink);
  assert.ok(close(r.color, [140, 140, 140], 40), `應該是灰字，得到 ${r.color}`);
});

test("字被產品擋住就判定在產品後面；字壓在產品上看得到就不是", () => {
  // PuraVida 那張：「日夜保養」被罐子蓋住一半。模型兩次給的答案不同，改用像素判斷
  const W = 300, H = 300;
  const behind = canvas(W, H, [180, 200, 220]);
  glyphs(behind, 40, 60, 1, 40, 0, [70, 120, 150]);                 // 露在外面的字
  glyphs(behind, 40, 120, 1, 40, 0, [70, 120, 150]);
  paint(behind, 60, 100, 180, 150, () => [250, 250, 250]);          // 罐子蓋住右半邊
  const alpha = new Uint8Array(W * H);
  for (let y = 100; y < 250; y++) for (let x = 60; x < 240; x++) alpha[y * W + x] = 255;
  const box = { x: 40, y: 60, w: 40, h: 160 };
  assert.equal(isHiddenBehindProduct(behind, box, "#467896", alpha), true);

  const front = canvas(W, H, [180, 200, 220]);
  paint(front, 60, 100, 180, 150, () => [250, 250, 250]);
  glyphs(front, 40, 60, 1, 40, 0, [70, 120, 150]);
  glyphs(front, 40, 120, 1, 40, 0, [70, 120, 150]);                 // 這次字畫在罐子上面
  glyphs(front, 40, 180, 1, 40, 0, [70, 120, 150]);
  assert.equal(isHiddenBehindProduct(front, box, "#467896", alpha), false);
});

test("產品分組：真的疊在一起才併，框角擦到一點不算", () => {
  const boxes = [
    { x: 0, y: 0, w: 100, h: 200 }, { x: 60, y: 50, w: 100, h: 200 },   // 疊很多 → 同一組
    { x: 400, y: 0, w: 100, h: 100 }, { x: 495, y: 95, w: 100, h: 100 }, // 只碰到角 → 分開
  ];
  const groups = groupProducts(boxes).map((g) => [...g].sort());
  assert.deepEqual(groups, [[0, 1], [2], [3]]);
});

test("疊在一起的產品：每個像素只歸一支，拖開前面那支不會在後面留下碎片", () => {
  const W = 100, H = 100, alpha = new Uint8Array(W * H).fill(255);
  const boxes = [{ x: 0, y: 0, w: 70, h: 100 }, { x: 50, y: 20, w: 50, h: 50 }];   // 第二支比較小、疊在前面
  const owner = assignProductPixels(alpha, W, H, boxes);
  assert.equal(owner[30 * W + 60], 1, "重疊的地方歸小的那支");
  assert.equal(owner[10 * W + 10], 0);
  assert.equal(owner[90 * W + 90], 0, "框外的像素歸最近的框");
  assert.ok(owner.every((g) => g === 0 || g === 1), "每個產品像素都有主人");
});

test("只重建平面小色塊；柔光、線條、跟圖示重疊、超大底框都留在背景", () => {
  const shape = (over: Partial<RawShape>): RawShape => ({ kind: "pill", box: [0, 0, 1, 1], fill: "#ffffff", stroke: "none", opacity: 1, blurry: false, ...over });
  const box = { x: 100, y: 100, w: 300, h: 60 };
  assert.equal(shouldRebuildShape(shape({}), box, 1000, 1000, []), true);
  assert.equal(shouldRebuildShape(shape({ blurry: true }), box, 1000, 1000, []), false);
  assert.equal(shouldRebuildShape(shape({ kind: "line" }), box, 1000, 1000, []), false);
  assert.equal(shouldRebuildShape(shape({}), box, 1000, 1000, [{ x: 120, y: 110, w: 40, h: 40 }]), false, "上面有太陽圖示的膠囊按鈕");
  assert.equal(shouldRebuildShape(shape({}), { x: 0, y: 0, w: 900, h: 900 }, 1000, 1000, []), false);
});

// ---------- 排字 ----------
/** 假的量字：每個字 0.9em 寬，字跡上下各 0.4em，照 textAlign 回傳左右範圍。 */
const fakeMeasure: Measure = (font, spacing, align, line) => {
  const fs = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 16);
  const n = [...line].length, w = n * fs * 0.9 + Math.max(0, n - 1) * spacing;
  const left = align === "left" ? 0 : align === "right" ? w : w / 2;
  return { left, right: w - left, ascent: fs * 0.4, descent: fs * 0.4 };
};
const rt = (over: Partial<RebuildText>): RebuildText => ({
  text: "限時優惠", box: { x: 100, y: 200, w: 400, h: 80 }, color: "#111111", weight: 700, family: "sans", italic: false,
  align: "center", vertical: false, letterSpacingEm: 0, rotationDeg: 0, behindProduct: false, ...over,
});
/** 用同一套規則把排好的字畫回去，量出字跡範圍（驗證字跡真的落在原本的位置）。 */
function inkOf(f: ReturnType<typeof fitText>) {
  const lines = f.text.split("\n"), LH = f.fontSize * 1.25, firstY = -((lines.length - 1) * LH) / 2;
  const tx = f.align === "left" ? -f.w / 2 : f.align === "right" ? f.w / 2 : 0;
  let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
  lines.forEach((ln, i) => {
    const m = fakeMeasure(`${f.fontWeight} ${f.fontSize}px x`, f.letterSpacingPx, f.align, ln), y = firstY + i * LH;
    L = Math.min(L, tx - m.left); R = Math.max(R, tx + m.right); T = Math.min(T, y - m.ascent); B = Math.max(B, y + m.descent);
  });
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  return { x: cx + L, y: cy + T, w: R - L, h: B - T };
}

test("排好的字：字跡的高度和中心對齊原本的範圍", () => {
  const f = fitText(rt({}), fakeMeasure);
  const ink = inkOf(f);
  assert.ok(Math.abs(ink.h - 80) < 1, `字高 ${ink.h}`);
  assert.ok(Math.abs(ink.x + ink.w / 2 - 300) < 1 && Math.abs(ink.y + ink.h / 2 - 240) < 1, "中心要對齊");
});

test("左齊的字：字跡左邊貼齊原本的左邊", () => {
  const f = fitText(rt({ align: "left", text: "左齊" }), fakeMeasure);
  assert.ok(Math.abs(inkOf(f).x - 100) < 1);
});

test("寬度放不下時縮小字級，不跟隔壁的字撞在一起", () => {
  const f = fitText(rt({ text: "非常非常長的一段標題文字", box: { x: 0, y: 0, w: 300, h: 80 } }), fakeMeasure);
  assert.ok(inkOf(f).w <= 301);
});

test("原圖字距比較寬：自動把字距加大到原本的寬度", () => {
  // 「3 2 1 ▼ 1 2 3」那種：字距只補到原本的寬度，每個字距最多加 0.6em，避免把字拉得稀稀落落
  const f = fitText(rt({ text: "3 2 1 1 2 3", box: { x: 0, y: 0, w: 600, h: 40 } }), fakeMeasure);
  assert.ok(f.letterSpacingPx > 0);
  assert.ok(Math.abs(inkOf(f).w - 600) < 10, `寬度 ${inkOf(f).w}`);
});

test("直排：一個字一行", () => {
  const f = fitText(rt({ text: "日夜保養", vertical: true, box: { x: 0, y: 0, w: 90, h: 420 } }), fakeMeasure);
  assert.equal(f.text, "日\n夜\n保\n養");
});

test("字體：純英數用 Manrope、襯線用思源宋體，字重選實際載入的那幾種", () => {
  assert.equal(fontFor({ family: "sans", text: "LIVE DAY", weight: 900 }).family, FONT_LATIN);
  assert.equal(fontFor({ family: "sans", text: "熱銷5年", weight: 900 }).family, FONT_SANS);
  assert.equal(fontFor({ family: "serif", text: "瞬間補水", weight: 650 }).family, FONT_SERIF);
  assert.equal(fontFor({ family: "serif", text: "瞬間補水", weight: 650 }).weight, 700);
  assert.equal(fontFor({ family: "sans", text: "小字", weight: 300 }).weight, 400);
});

// ---------- 組圖層 ----------
test("圖層順序：背景、色塊、被擋住的字、產品、其他字", () => {
  const result: RebuildResult = {
    docW: 736, docH: 736, backgroundUrl: "/bg.jpg",
    shapes: [{ kind: "pill", box: { x: 10, y: 10, w: 200, h: 40 }, fill: "#ffffff", opacity: 1 }],
    products: [{ url: "/p.png", box: { x: 200, y: 200, w: 300, h: 300 }, label: "罐子" }],
    texts: [],
  };
  const fitted = [
    fitText(rt({ text: "日夜保養", behindProduct: true }), fakeMeasure),
    fitText(rt({ text: "妝前神器" }), fakeMeasure),
  ];
  const layers = rebuildToLayers(result, fitted);
  assert.deepEqual(layers.map((l) => l.type), ["background", "decoration", "independent_text", "product", "independent_text"]);
  assert.equal((layers[2].meta.style as { text: string }).text, "日夜保養");
  assert.equal(layers.map((l) => l.zIndex).join(), "0,1,2,3,4");
  assert.equal((layers[1].meta.shape as { radius: number }).radius, 20, "膠囊色塊要是圓角");
});

// ---------- 整條流程（外部服務換成假的） ----------
test("整條流程：擦字、切產品、補兩次背景；壓在產品前面的字不會被切進產品", async () => {
  const W = 400, H = 400;
  const img = canvas(W, H, [200, 190, 240]);
  paint(img, 150, 150, 100, 200, () => [250, 250, 250]);   // 產品（白瓶子）
  glyphs(img, 60, 40, 5, 30, 10, [40, 40, 110]);           // 標題
  glyphs(img, 170, 240, 2, 20, 10, [120, 120, 120]);        // 印在瓶子前面的字
  const png = await sharp(Buffer.from(img.data), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

  const reply = JSON.stringify({
    background: "紫色背景",
    texts: [
      { text: "五個字標題", box: [100, 150, 175, 500], color: "#282870", weight: 900, lines: 1 },
      { text: "前景", box: [600, 425, 650, 575], color: "#787878", weight: 400, lines: 1 },
    ],
    products: [{ label: "瓶子", box: [375, 375, 875, 625] }],
    shapes: [], graphics: [],
  });
  const inpaintMasks: Buffer[] = [];
  const saved: string[] = [];
  const savedBuffers = new Map<string, Buffer>();
  const deps: RebuildDeps = {
    analyze: async () => reply,
    // 假的去背：亮度很高的像素＝產品（瓶子和上面的灰字都會被當成產品，模擬真實去背的毛病）
    removeBackground: async (dataUrl) => {
      const buf = Buffer.from(dataUrl.split(",")[1], "base64");
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const rgba = Buffer.alloc(info.width * info.height * 4);
      for (let i = 0; i < info.width * info.height; i++) {
        const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
        const isProduct = (r > 245 && g > 245) || (r === 120 && g === 120);
        rgba.set([r, g, b, isProduct ? 255 : 0], i * 4);
      }
      return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    },
    inpaint: async (image, mask) => { inpaintMasks.push(mask); return image; },
    save: async (b, ext, prefix) => { const u = `/mem/${prefix}${saved.length}.${ext}`; saved.push(u); savedBuffers.set(u, b); return u; },
  };
  const result = await rebuildReference(png, deps);

  assert.equal(result.docW, 400);
  assert.equal(result.texts.length, 2);
  assert.equal(result.products.length, 1);
  assert.equal(inpaintMasks.length, 2, "字一次、產品大洞一次");
  assert.match(result.backgroundUrl, /rebuild-bg-/);
  const p = result.products[0].box;
  assert.ok(p.x <= 152 && p.x + p.w >= 248 && p.y <= 152 && p.y + p.h >= 348, `產品範圍 ${JSON.stringify(p)}`);

  // 產品圖層裡，前景字的位置要是透明的（不然會跟重建的字疊成雙影）
  const { data: prod, info: pi } = await sharp(savedBuffers.get(result.products[0].url)!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => prod[((y - p.y) * pi.width + (x - p.x)) * 4 + 3];
  assert.equal(alphaAt(175, 245), 0, "印在瓶子前面的字不能留在產品圖層裡");
  assert.ok(alphaAt(160, 170) > 0, "瓶子本身要在");
  const { data: firstMask, info } = await sharp(inpaintMasks[0]).raw().toBuffer({ resolveWithObject: true });
  const maskAt = (x: number, y: number) => firstMask[(y * W + x) * info.channels];
  assert.ok(maskAt(70, 45) > 0, "標題的位置要被擦掉");
  assert.equal(maskAt(20, 380), 0, "沒有東西的角落不能被擦");
});
