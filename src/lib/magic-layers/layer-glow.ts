/* ============================================================
   外光暈（像 PS 圖層樣式的「外光暈」）

   沿著圖層內容的輪廓往外發光：去背的產品照沿著產品邊緣、文字沿著字形、形狀沿著形狀。
   做法是 canvas 陰影不位移、只模糊。為了只留下光暈、不把內容再畫一次，
   先把內容畫到畫面外很遠的地方，再用陰影位移把光暈「搬」回原位。

   size 是畫布上的像素（跟匯出的圖同一個單位）；canvas 的陰影模糊不吃縮放，
   所以要乘上目前的縮放倍率，畫面縮放到 47% 時光暈才不會看起來大一倍。
   ============================================================ */

export type LayerGlow = {
  color: string;       // #rrggbb
  size: number;        // 光暈大小（模糊範圍，px）
  opacity: number;     // 0–1
  strength: number;    // 1–5：疊幾次，越多越濃、越往外擴
};

export const DEFAULT_GLOW: LayerGlow = { color: "#ffe066", size: 24, opacity: 0.8, strength: 2 };

/** #rrggbb＋透明度 → rgba()（canvas 陰影顏色要自己帶透明度）。 */
export function glowColor(color: string, opacity: number): string {
  const m = /^#?([0-9a-f]{6})/i.exec(color);
  const hex = m ? m[1] : "ffe066";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = Math.max(0, Math.min(1, opacity));
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}

/** 疊幾次（1–5 的整數）。 */
export const glowPasses = (strength: number) => Math.max(1, Math.min(5, Math.round(strength || 1)));

/**
 * 在目前的座標系畫出 draw() 內容的外光暈（只有光暈，不含內容本身）。
 * 內容本身由呼叫端之後再正常畫一次，光暈才會在內容底下。
 */
export function drawGlow(ctx: CanvasRenderingContext2D, glow: LayerGlow | null | undefined, draw: () => void) {
  if (!glow || glow.size <= 0 || glow.opacity <= 0) return;
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b) || 1;
  const OFF = 20000;   // 裝置像素：內容畫在畫面外，光暈用位移搬回來
  ctx.save();
  ctx.setTransform(new DOMMatrix().translateSelf(-OFF, 0).multiplySelf(m));
  ctx.shadowColor = glowColor(glow.color, glow.opacity);
  ctx.shadowBlur = glow.size * scale;
  ctx.shadowOffsetX = OFF; ctx.shadowOffsetY = 0;
  for (let i = 0; i < glowPasses(glow.strength); i++) draw();
  ctx.restore();
}

/* ---------- 陰影（像 PS 的投影）：有方向、有距離的影子 ---------- */

export type LayerShadow = {
  color: string;       // #rrggbb
  opacity: number;     // 0–1
  distance: number;    // 影子離物件多遠（畫布 px）
  blur: number;        // 邊緣多柔（畫布 px）
  angle: number;       // 影子往哪個方向落：0＝往右、90＝往下、180＝往左、270＝往上（度）
};

/** 預設往右下落（60°，偏下方）、淡淡的，商品照最常見的樣子。 */
export const DEFAULT_SHADOW: LayerShadow = { color: "#000000", opacity: 0.3, distance: 16, blur: 24, angle: 60 };

/** 影子在畫布上的位移（畫布 px）。方向固定跟畫布走，物件旋轉時影子不會跟著轉（跟 PS 的全域光一樣）。 */
export function shadowOffset(s: Pick<LayerShadow, "distance" | "angle">): { dx: number; dy: number } {
  const r = (s.angle * Math.PI) / 180;
  const round = (v: number) => Math.round(v * 1000) / 1000 + 0;
  return { dx: round(Math.cos(r) * s.distance), dy: round(Math.sin(r) * s.distance) };
}

/**
 * 畫出 draw() 內容的陰影（只有影子，不含內容本身；呼叫端之後再畫內容，影子才會在底下）。
 * 做法跟外光暈一樣：內容畫到畫面外，再用陰影位移搬回來，順便加上影子自己的方向位移。
 * canvas 的陰影位移、模糊都是螢幕像素，不吃縮放，所以要乘上目前的縮放倍率。
 */
export function drawShadow(ctx: CanvasRenderingContext2D, shadow: LayerShadow | null | undefined, draw: () => void) {
  if (!shadow || shadow.opacity <= 0) return;
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b) || 1;
  const OFF = 20000;
  const { dx, dy } = shadowOffset(shadow);
  ctx.save();
  ctx.setTransform(new DOMMatrix().translateSelf(-OFF, 0).multiplySelf(m));
  ctx.shadowColor = glowColor(shadow.color, shadow.opacity);
  ctx.shadowBlur = Math.max(0, shadow.blur) * scale;
  ctx.shadowOffsetX = OFF + dx * scale; ctx.shadowOffsetY = dy * scale;
  draw();
  ctx.restore();
}
