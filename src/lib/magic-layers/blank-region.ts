import sharp from "sharp";

/** alpha 低於這個值就算空白（畫布上沒東西的地方）。 */
const CLEAR_ALPHA = 16;
/** RGB 三個通道都高於這個值就算白底。使用者把圖縮小之後留下的就是這種白。 */
const WHITE_LEVEL = 243;

export type BlankRegion = {
  /** 與畫布邊緣相連的空白：1＝空白（要補），0＝畫面內容（要保留）。 */
  fill: Uint8Array;
  width: number;
  height: number;
  /** 實際有畫面內容的範圍；沒有內容時為 null。 */
  content: { left: number; top: number; width: number; height: number } | null;
};

/**
 * 找出「與畫布邊緣相連的空白區域」。
 *
 * 使用者的實際用法是：把背景圖縮小，想讓 AI 把旁邊空出來的地方補成同一個場景。
 * 那片空白在原畫布**裡面**，而原本的遮罩把整個原畫布都標成「保留」，所以模型
 * 根本不准動它——看起來就像「擴圖只是填白色」。
 *
 * 用 flood fill 從四邊往內找，而不是「只要是白色就補」：畫面中間本來就白的東西
 * （白牆、白衣服、反光）不該被重畫，只有連到邊緣的那圈才是真的空白。
 * 這跟「魔術棒補空白」判斷的是同一件事。
 */
export async function findBlankRegion(src: Buffer): Promise<BlankRegion> {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const fill = new Uint8Array(width * height);
  const isBlank = (i: number) => {
    const o = i * channels;
    if (data[o + 3] < CLEAR_ALPHA) return true;
    return data[o] > WHITE_LEVEL && data[o + 1] > WHITE_LEVEL && data[o + 2] > WHITE_LEVEL;
  };

  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const push = (i: number) => { if (!fill[i] && isBlank(i)) { fill[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < width; x += 1) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width, y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (fill[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const content = maxX < minX || maxY < minY
    ? null
    : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return { fill, width, height, content };
}
