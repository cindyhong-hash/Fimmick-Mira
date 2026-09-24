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
