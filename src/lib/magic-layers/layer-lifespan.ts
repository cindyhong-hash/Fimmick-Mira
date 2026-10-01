/* ============================================================
   物件存在時間（layer lifespan）：這個圖層在這一頁影片的第幾秒出現、第幾秒消失。

   跟動畫是兩回事：動畫（anims）是物件「怎麼動」，存在時間是物件「什麼時候在畫面上」。
   跟 visible 也是兩回事：visible 是使用者把圖層關掉（編輯時也看不到）；
   存在時間只在播放／輸出時生效，編輯時物件一律照常顯示、不會被刪掉或改到 visible。
   沒設（undefined）＝整頁都在。時間單位是秒，以這一頁的開頭為 0。
   ============================================================ */

export type Lifespan = { startTime?: number; endTime?: number };

/** 最短存在多久（拖曳時左右兩端不會疊在一起）。 */
const MIN = 0.1;
const round = (v: number) => Math.round(v * 100) / 100;

/** 第 t 秒這個物件在不在畫面上；t＝null（編輯中、沒在播）一律在。 */
export function aliveAt(l: Lifespan, t: number | null): boolean {
  if (t === null) return true;
  return t >= (l.startTime ?? 0) && t <= (l.endTime ?? Infinity);
}

/** 時間軸要畫的區間（沒設＝整頁），結束時間不超過頁長。 */
export function lifespanOf(l: Lifespan, duration: number): { start: number; end: number } {
  const end = Math.min(duration, l.endTime ?? duration);
  return { start: Math.min(l.startTime ?? 0, Math.max(0, end - MIN)), end };
}

/**
 * 拖時間軸的 bar：move＝整段平移（長度不變，不超出 0～頁長），start／end＝拉左右兩端。
 * s0／e0 是開始拖的那一刻的區間，dt 是拖了幾秒。
 */
export function dragLifespan(mode: "move" | "start" | "end", s0: number, e0: number, dt: number, duration: number): { start: number; end: number } {
  if (mode === "move") {
    const len = e0 - s0, start = Math.max(0, Math.min(duration - len, s0 + dt));
    return { start: round(start), end: round(start + len) };
  }
  if (mode === "start") return { start: round(Math.max(0, Math.min(e0 - MIN, s0 + dt))), end: e0 };
  return { start: s0, end: round(Math.max(s0 + MIN, Math.min(duration, e0 + dt))) };
}

/** 頁長縮短時：超出的結束時間夾回頁長，開始時間也不能晚於結束。沒設的維持沒設。 */
export function clampLifespan(l: Lifespan, duration: number): Lifespan {
  const out: Lifespan = {};
  if (l.endTime !== undefined) out.endTime = round(Math.min(duration, l.endTime));
  if (l.startTime !== undefined) out.startTime = round(Math.min(l.startTime, (out.endTime ?? duration) - MIN));
  return out;
}

/** 讀存檔：不是數字的丟掉；開始晚於結束就整個當沒設。 */
export function readLifespan(v: { startTime?: unknown; endTime?: unknown } | undefined | null): Lifespan {
  if (!v) return {};
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(60, x)) : undefined);
  const startTime = num(v.startTime), endTime = num(v.endTime);
  if (startTime !== undefined && endTime !== undefined && endTime - startTime < MIN) return {};
  return { ...(startTime !== undefined ? { startTime } : {}), ...(endTime !== undefined ? { endTime } : {}) };
}
