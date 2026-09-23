/* ============================================================
   照參考圖重做 —— 伺服器端主流程

   上傳一張設計圖 → 視覺模型讀版面 → 像素校正 → 產品去背 → 擦字補背景 → 存圖。
   採「混合」做法：使用者會想改的（文字、產品、平面色塊）重建成獨立圖層，
   其他（logo、插圖、柔光玻璃感的標籤）保留原圖像素，這樣最像原圖。

   外部服務都從 deps 注入，測試可以換成假的。

   補背景只用 LaMa（只拿周圍像素補、不吃提示詞）。試過用生成式填色補產品的洞，
   它會在洞裡畫出新的產品，提示詞寫「這裡什麼都不放」也沒用。
   ============================================================ */
import sharp from "sharp";
import { parseReferenceLayout, REFERENCE_LAYOUT_PROMPT, type RawLayout } from "./layout.ts";
import {
  assignProductPixels, clampBox, dilate, dominantColor, forEachInEllipse, groupProducts, isHiddenBehindProduct, normToPx, refineText, shouldRebuildShape, type RgbImage,
} from "./pixels.ts";
import type { Box, RebuildProduct, RebuildResult, RebuildShape, RebuildText } from "./types.ts";

export type RebuildDeps = {
  /** 送圖給視覺模型，回傳原始文字回覆。 */
  analyze: (imageDataUrl: string, prompt: string, signal?: AbortSignal) => Promise<string>;
  /** 去背，回傳透明 PNG（尺寸可以跟輸入不同，會再縮回去）。 */
  removeBackground: (pngDataUrl: string, signal?: AbortSignal) => Promise<Buffer>;
  /** LaMa：白色＝要補的地方。 */
  inpaint: (imagePng: Buffer, maskPng: Buffer, signal?: AbortSignal) => Promise<Buffer>;
  save: (buffer: Buffer, ext: string, prefix: string, signal?: AbortSignal) => Promise<string>;
};

/** 處理用的最長邊：原圖太大會讓擦除與去背變慢、變貴，1600 已經足夠清楚。 */
export const REBUILD_MAX_SIDE = 1600;

const pngDataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
const maskToPng = (m: Uint8Array, W: number, H: number) =>
  sharp(Buffer.from(m.map((v) => (v ? 255 : 0))), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();

export async function rebuildReference(image: Buffer, deps: RebuildDeps, signal?: AbortSignal): Promise<RebuildResult> {
  const working = await sharp(image).rotate()
    .resize({ width: REBUILD_MAX_SIDE, height: REBUILD_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .removeAlpha().png().toBuffer();
  const { data, info } = await sharp(working).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const img: RgbImage = { data: new Uint8Array(data), width: W, height: H };

  // 1. 讀版面
  const analysisJpg = await sharp(working).jpeg({ quality: 90 }).toBuffer();
  const layout: RawLayout = parseReferenceLayout(await deps.analyze(`data:image/jpeg;base64,${analysisJpg.toString("base64")}`, REFERENCE_LAYOUT_PROMPT, signal));
  signal?.throwIfAborted();

  // 2. 文字：校正框與字色，同時標出要擦的字跡
  const ink = new Uint8Array(W * H);
  const texts: RebuildText[] = layout.texts.map((t) => {
    const { box, color } = refineText(img, t, ink);
    return {
      text: t.text, box, color, weight: t.weight,
      family: t.family === "serif" || t.family === "script" || t.family === "handwritten" ? "serif" : "sans",
      italic: t.italic, align: t.align, vertical: t.vertical, letterSpacingEm: t.letterSpacing,
      rotationDeg: t.rotationDeg, behindProduct: t.behindProduct,
    };
  });

  // 3. 色塊
  const graphicBoxes = layout.graphics.map((g) => normToPx(g.box, W, H));
  const shapes: RebuildShape[] = [];
  for (const s of layout.shapes) {
    const box = normToPx(s.box, W, H);
    if (!shouldRebuildShape(s, box, W, H, graphicBoxes)) continue;
    shapes.push({ kind: s.kind as RebuildShape["kind"], box, fill: dominantColor(img, box), opacity: s.opacity });
  }
  const softBadges = layout.shapes.filter((s) => s.blurry && s.kind === "circle").map((s) => normToPx(s.box, W, H));

  // 4. 產品：只對產品框聯集＋外擴去背，大標題、色塊不會被當成主體
  const productAlpha = new Uint8Array(W * H);
  const products: RebuildProduct[] = [];
  const productBoxes = layout.products.map((p) => normToPx(p.box, W, H)).filter((b) => b.w > 4 && b.h > 4);
  if (productBoxes.length) {
    const ux0 = Math.min(...productBoxes.map((b) => b.x)), uy0 = Math.min(...productBoxes.map((b) => b.y));
    const ux1 = Math.max(...productBoxes.map((b) => b.x + b.w)), uy1 = Math.max(...productBoxes.map((b) => b.y + b.h));
    const m = Math.round(Math.max(ux1 - ux0, uy1 - uy0) * 0.06);
    const region = clampBox({ x: ux0 - m, y: uy0 - m, w: ux1 - ux0 + 2 * m, h: uy1 - uy0 + 2 * m }, W, H);
    const crop = await sharp(working).extract({ left: region.x, top: region.y, width: region.w, height: region.h }).png().toBuffer();
    const cut = await deps.removeBackground(pngDataUrl(crop), signal);
    const cutRaw = await sharp(cut).ensureAlpha().resize(region.w, region.h, { fit: "fill" }).raw().toBuffer();
    for (let y = 0; y < region.h; y++) for (let x = 0; x < region.w; x++) {
      const a = cutRaw[(y * region.w + x) * 4 + 3];
      if (a > 40) productAlpha[(region.y + y) * W + region.x + x] = a;
    }
    // 字在不在產品後面：用像素判斷（模型同一張圖兩次答案會不一樣）。
    // 只有產品真的蓋住字的時候才改成 true；模型說在後面、像素卻看得到字，也改回前面。
    for (const t of texts) {
      const overlapsProduct = productBoxes.some((b) => !(t.box.x > b.x + b.w || b.x > t.box.x + t.box.w || t.box.y > b.y + b.h || b.y > t.box.y + t.box.h));
      t.behindProduct = overlapsProduct && isHiddenBehindProduct(img, t.box, t.color, productAlpha);
    }
    // 壓在產品「前面」的東西不是產品：去背會把貼著白瓶子的白字、蓋在盒子上的圓形標籤一起切走，
    // 產品圖層就帶著原本的字，上面又疊一層重建的字 → 雙影。所以把它們從產品輪廓挖掉。
    const front = new Uint8Array(W * H);
    texts.forEach((t) => {
      if (t.behindProduct) return;
      for (let y = t.box.y; y < t.box.y + t.box.h; y++) for (let x = t.box.x; x < t.box.x + t.box.w; x++) if (ink[y * W + x]) front[y * W + x] = 1;
    });
    const frontD = dilate(front, W, H, Math.max(2, Math.round(W / 300)));
    for (let i = 0; i < W * H; i++) if (frontD[i]) productAlpha[i] = 0;
    for (const b of softBadges) forEachInEllipse(b, 1, (x, y) => { productAlpha[y * W + x] = 0; });

    const groups = groupProducts(productBoxes);
    const groupBoxes = groups.map((group) => {
      const x0 = Math.min(...group.map((i) => productBoxes[i].x)), y0 = Math.min(...group.map((i) => productBoxes[i].y));
      const x1 = Math.max(...group.map((i) => productBoxes[i].x + productBoxes[i].w)), y1 = Math.max(...group.map((i) => productBoxes[i].y + productBoxes[i].h));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
    const owner = assignProductPixels(productAlpha, W, H, groupBoxes);
    for (const [gi, group] of groups.entries()) {
      let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (owner[y * W + x] === gi) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      if (maxX < 0) continue;
      const tb: Box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const rgba = Buffer.alloc(tb.w * tb.h * 4);
      for (let y = 0; y < tb.h; y++) for (let x = 0; x < tb.w; x++) {
        const gx = tb.x + x, gy = tb.y + y, si = (gy * W + gx) * 3, o = (y * tb.w + x) * 4;
        rgba[o] = img.data[si]; rgba[o + 1] = img.data[si + 1]; rgba[o + 2] = img.data[si + 2]; rgba[o + 3] = owner[gy * W + gx] === gi ? productAlpha[gy * W + gx] : 0;
      }
      const png = await sharp(rgba, { raw: { width: tb.w, height: tb.h, channels: 4 } }).png().toBuffer();
      products.push({ url: await deps.save(png, "png", "rebuild-product-", signal), box: tb, label: group.map((i) => layout.products[i].label).filter(Boolean).join(" + ") || `產品 ${gi + 1}` });
    }
  }

  // 5. 擦除 → 補背景
  const prodBin = productAlpha.map((a) => (a > 0 ? 1 : 0));
  const inkD = dilate(ink, W, H, Math.max(3, Math.round(W / 250)));
  const prodD = dilate(prodBin, W, H, Math.max(4, Math.round(W / 160)));
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = inkD[i] || prodD[i] ? 1 : 0;
  const sp = Math.max(3, Math.round(W / 300));
  for (const s of shapes) for (let y = Math.max(0, s.box.y - sp); y < Math.min(H, s.box.y + s.box.h + sp); y++)
    for (let x = Math.max(0, s.box.x - sp); x < Math.min(W, s.box.x + s.box.w + sp); x++) mask[y * W + x] = 1;

  let plate = working;
  if (mask.some((v) => v)) {
    plate = await sharp(await deps.inpaint(working, await maskToPng(mask, W, H), signal)).resize(W, H, { fit: "fill" }).png().toBuffer();
  }
  // 產品留下的大洞：LaMa 補大面積容易帶出產品殘影，把範圍擴大到連陰影一起，在已補好字的圖上再補一次。
  // 擴大的範圍不能吃到柔光圓形標籤，不然它們會被補成背景而消失。
  if (products.length) {
    const big = dilate(prodBin, W, H, Math.round(W / 45));
    for (const b of softBadges) forEachInEllipse(b, 1.05, (x, y) => { if (!prodBin[y * W + x]) big[y * W + x] = 0; });
    plate = await sharp(await deps.inpaint(plate, await maskToPng(big, W, H), signal)).resize(W, H, { fit: "fill" }).png().toBuffer();
  }
  const backgroundUrl = await deps.save(await sharp(plate).jpeg({ quality: 92 }).toBuffer(), "jpg", "rebuild-bg-", signal);

  return { docW: W, docH: H, backgroundUrl, shapes, products, texts };
}
