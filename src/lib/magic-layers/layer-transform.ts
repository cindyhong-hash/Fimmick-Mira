/* ============================================================
   圖層的座標換算：位置、旋轉、傾斜

   一個圖層在畫布上的樣子＝先傾斜、再旋轉、最後移到 (cx, cy)。
   畫圖（canvas transform）、點選、控制點、縮放、橡皮擦、遮色片、合併都用這一套，
   不然會出現「看起來斜了，但點不到／框對不上」。

   傾斜用角度存（skewX 水平傾斜、skewY 垂直傾斜，-60～60 度）。
   ============================================================ */

export type LayerGeometry = { cx: number; cy: number; w: number; h: number; rotation: number; skewX?: number; skewY?: number };

const tanDeg = (d?: number) => Math.tan(((d ?? 0) * Math.PI) / 180);
export const hasSkew = (l: Pick<LayerGeometry, "skewX" | "skewY">) => !!(l.skewX || l.skewY);

/** 圖層自己的座標（以中心為原點、還沒傾斜旋轉）→ 畫布座標。 */
export function layerToDoc(l: LayerGeometry, px: number, py: number): { x: number; y: number } {
  const tx = tanDeg(l.skewX), ty = tanDeg(l.skewY);
  const sx = px + tx * py, sy = ty * px + py;
  const cos = Math.cos(l.rotation), sin = Math.sin(l.rotation);
  return { x: l.cx + sx * cos - sy * sin, y: l.cy + sx * sin + sy * cos };
}

/** 畫布座標 → 圖層自己的座標（layerToDoc 的反運算）。 */
export function docToLayer(l: LayerGeometry, dx: number, dy: number): { x: number; y: number } {
  const ox = dx - l.cx, oy = dy - l.cy, cos = Math.cos(-l.rotation), sin = Math.sin(-l.rotation);
  const sx = ox * cos - oy * sin, sy = ox * sin + oy * cos;
  const tx = tanDeg(l.skewX), ty = tanDeg(l.skewY), det = 1 - tx * ty;
  if (Math.abs(det) < 1e-6) return { x: sx, y: sy };
  return { x: (sx - tx * sy) / det, y: (sy - ty * sx) / det };
}

/** 把 canvas 座標系換到圖層上（跟 layerToDoc 同一個順序）。 */
export function applyLayerTransform(ctx: CanvasRenderingContext2D, l: LayerGeometry) {
  ctx.translate(l.cx, l.cy);
  ctx.rotate(l.rotation);
  if (hasSkew(l)) ctx.transform(1, tanDeg(l.skewY), tanDeg(l.skewX), 1, 0, 0);
}

/** 圖層四個角在畫布上的位置（左上、右上、右下、左下）。 */
export function layerCorners(l: LayerGeometry) {
  const hw = l.w / 2, hh = l.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => layerToDoc(l, x, y));
}
