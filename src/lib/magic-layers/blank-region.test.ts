import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { findBlankRegion } from "./blank-region.ts";

/** 白底畫布，中間放一塊實色——就是「把背景圖縮小」之後的樣子。 */
async function canvasWithInset(colour: { r: number; g: number; b: number }) {
  const inset = await sharp({ create: { width: 40, height: 40, channels: 4, background: { ...colour, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: inset, left: 30, top: 25 }]).png().toBuffer();
}

test("縮小後留下的白邊算成要補，內容範圍抓得準", async () => {
  const { fill, width, content } = await findBlankRegion(await canvasWithInset({ r: 200, g: 80, b: 60 }));
  assert.deepEqual(content, { left: 30, top: 25, width: 40, height: 40 });
  assert.equal(fill[0], 1, "角落是空白");
  assert.equal(fill[50 * width + 50], 0, "中間的內容要保留");
});

test("畫面中間本來就白的東西不會被當成空白", async () => {
  // 白牆、白衣服、反光都是這種情況：只有「連到邊緣」的白才算空白，
  // 否則模型會把畫面裡原本的白色區塊一起重畫。
  const { fill, width, content } = await findBlankRegion(await canvasWithInset({ r: 255, g: 255, b: 255 }));
  // 這塊白被有色邊框包住 → 不連到邊緣 → 要保留
  const framed = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: await sharp({ create: { width: 60, height: 60, channels: 4, background: { r: 30, g: 90, b: 160, alpha: 1 } } }).png().toBuffer(), left: 20, top: 20 },
      { input: await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer(), left: 40, top: 40 },
    ]).png().toBuffer();
  const framedRegion = await findBlankRegion(framed);
  assert.equal(framedRegion.fill[45 * framedRegion.width + 45], 0, "被包住的白色不該被重畫");
  assert.equal(framedRegion.fill[0], 1, "外圈的白仍然是空白");
  // 純白貼純白：整張都連得到邊緣，content 會是 null，呼叫端要自己退回整張畫布
  assert.equal(content, null);
  assert.equal(fill[50 * width + 50], 1);
});

test("透明畫布也算空白", async () => {
  const inset = await sharp({ create: { width: 30, height: 30, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } }).png().toBuffer();
  const img = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inset, left: 25, top: 25 }]).png().toBuffer();
  const { content, fill } = await findBlankRegion(img);
  assert.deepEqual(content, { left: 25, top: 25, width: 30, height: 30 });
  assert.equal(fill[0], 1);
});
