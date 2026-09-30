/* ============================================================
   自由畫布的圖層動畫（輸出成 MP4 的微動畫：閃光掃過、依序彈跳、呼吸放大、閃爍、漂浮、淡入）。

   每個圖層可以疊好幾個動畫（LayerAnim[]），每個動畫有自己的開始時間、一輪多久、重複幾次。
   這裡只負責「在第 t 秒，這個圖層該怎麼變」（位移、縮放、透明度、光帶跑到哪），
   真正畫出來在編輯器（預覽）和匯出 MP4 時做，兩邊共用這一套，看到的就是輸出的。
   時間單位都是秒；位移是圖層自己的座標（跟著圖層旋轉）、以圖層高度的比例表示。
   ============================================================ */

export type AnimKind = "shine" | "bounce" | "pulse" | "twinkle" | "float" | "fadeIn";
export type ShineDirection = "down" | "up" | "right" | "left" | "downRight" | "downLeft" | "upRight" | "upLeft";

/** 光前進的方向（圖層座標，y 往下為正）。 */
export const SHINE_VECTORS: Record<ShineDirection, [number, number]> = {
  down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0],
  downRight: [1, 1], downLeft: [-1, 1], upRight: [1, -1], upLeft: [-1, -1],
};

export type LayerAnim = {
  id: string;
  kind: AnimKind;
  /** 第幾秒開始。 */
  start: number;
  /** 一輪多久（秒）。 */
  duration: number;
  /** 重複幾次；0 = 一直循環到影片結束。淡入固定只跑一次。 */
  repeat: number;
  /** 每輪之間停多久（秒）：閃光、彈跳這種「一下」的效果，停一下再來比較自然。 */
  gap: number;
  /** 強度 0–1：閃光的亮度、呼吸放大的幅度、彈跳的力道、漂浮的距離、閃爍的深淺。 */
  intensity: number;
  /** 閃光：光從哪個方向掃過去。 */
  direction?: ShineDirection;
  /** 閃光：光帶的寬度（圖層大小的比例 0.1–0.8）。 */
  width?: number;
};

export const ANIM_LABELS: Record<AnimKind, string> = {
  shine: "閃光掃過", bounce: "依序彈跳", pulse: "呼吸放大", twinkle: "閃爍", float: "輕輕漂浮", fadeIn: "淡入",
};

/** 每種動畫的預設值（套上去時用；使用者再自己調）。 */
export function defaultAnim(kind: AnimKind, id: string, start = 0): LayerAnim {
  const base = { id, kind, start, repeat: 0, gap: 0, intensity: 0.6 };
  switch (kind) {
    case "shine": return { ...base, duration: 0.7, gap: 2.3, intensity: 0.75, direction: "down", width: 0.35 };
    case "bounce": return { ...base, duration: 0.5, gap: 2.5, intensity: 0.5 };
    case "pulse": return { ...base, duration: 1.6, intensity: 0.4 };
    case "twinkle": return { ...base, duration: 1.2, intensity: 0.7 };
    case "float": return { ...base, duration: 3, intensity: 0.4 };
    case "fadeIn": return { ...base, duration: 0.8, repeat: 1, intensity: 1 };
  }
}

/** 這個動畫最晚在第幾秒結束（一直循環的回傳 Infinity）。 */
export function animEnd(a: LayerAnim): number {
  if (a.kind === "fadeIn") return a.start + a.duration;
  if (!a.repeat) return Infinity;
  return a.start + a.repeat * a.duration + (a.repeat - 1) * Math.max(0, a.gap);
}

/**
 * 在第 t 秒，這一輪跑到哪裡（0–1）；還沒開始、兩輪之間的空檔、全部跑完都回傳 null。
 * 淡入例外：開始前回傳 0（完全透明）、結束後回傳 1（保持顯示）。
 */
export function animPhase(a: LayerAnim, t: number): number | null {
  const d = Math.max(0.05, a.duration);
  if (a.kind === "fadeIn") return t <= a.start ? 0 : Math.min(1, (t - a.start) / d);
  if (t < a.start) return null;
  const cycle = d + Math.max(0, a.gap);
  const k = Math.floor((t - a.start) / cycle);
  if (a.repeat && k >= a.repeat) return null;
  const within = t - a.start - k * cycle;
  return within <= d ? within / d : null;
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

export type AnimFrame = {
  /** 位移（圖層座標，以圖層高度的比例）。 */
  dx: number; dy: number;
  /** 縮放（1 = 原本大小，以圖層中心）。 */
  scale: number;
  /** 透明度倍數（0–1）。 */
  opacity: number;
  /** 閃光：這一格光帶跑到哪（0–1）＋方向、寬度、亮度；沒有光就沒有這欄。 */
  shines: { progress: number; direction: ShineDirection; width: number; intensity: number }[];
};

export const REST: AnimFrame = { dx: 0, dy: 0, scale: 1, opacity: 1, shines: [] };

/** 把一個圖層的所有動畫在第 t 秒的效果疊起來。 */
export function animFrame(anims: LayerAnim[] | undefined, t: number): AnimFrame {
  if (!anims?.length) return REST;
  const f: AnimFrame = { dx: 0, dy: 0, scale: 1, opacity: 1, shines: [] };
  for (const a of anims) {
    const p = animPhase(a, t);
    if (p === null) continue;
    const k = Math.max(0, Math.min(1, a.intensity));
    switch (a.kind) {
      case "shine":
        f.shines.push({ progress: easeInOut(p), direction: a.direction ?? "down", width: a.width ?? 0.35, intensity: k });
        break;
      case "bounce": {
        // 往上彈一下再落回來，同時微微放大（像參考影片裡的優惠框）
        const up = Math.sin(Math.PI * p);
        f.dy -= up * 0.12 * k;
        f.scale *= 1 + up * 0.12 * k;
        break;
      }
      case "pulse":
        f.scale *= 1 + (1 - Math.cos(2 * Math.PI * p)) / 2 * 0.12 * k;
        break;
      case "twinkle":
        f.opacity *= 1 - (1 - Math.cos(2 * Math.PI * p)) / 2 * 0.85 * k;
        break;
      case "float":
        f.dy += Math.sin(2 * Math.PI * p) * 0.05 * k;
        break;
      case "fadeIn":
        f.opacity *= easeOut(p);
        break;
    }
  }
  return f;
}

/**
 * 光帶在圖層座標裡的位置：回傳漸層的起點、終點（光帶中心從 from 走到 to 的那條線上）。
 * direction 是光前進的方向（見 SHINE_VECTORS），例如 down = 從上往下（光帶是橫的）、upRight = 從左下往右上。
 */
export function shineBand(w: number, h: number, s: { progress: number; direction: ShineDirection; width: number }) {
  const [ax, ay] = SHINE_VECTORS[s.direction] ?? SHINE_VECTORS.down;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len, uy = ay / len;
  // 圖層在這個方向上的總長度＋光帶寬度，讓光從完全在外面走到完全在外面
  const span = Math.abs(ux) * w + Math.abs(uy) * h;
  const band = Math.max(4, s.width * span);
  const travel = span + band;
  const c = -travel / 2 + s.progress * travel;
  return { x0: ux * (c - band / 2), y0: uy * (c - band / 2), x1: ux * (c + band / 2), y1: uy * (c + band / 2) };
}

/** 一次套給好幾個圖層時，自動錯開開始時間（像參考影片那樣一個接一個）。 */
export function staggeredStarts(n: number, first: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round((first + i * step) * 100) / 100);
}

/** 影片長度：使用者設定的優先；沒設就用最晚結束的動畫（循環的不算），至少 3 秒、最多 30 秒。 */
export function videoDuration(allAnims: LayerAnim[], chosen?: number | null): number {
  if (chosen && chosen > 0) return Math.min(30, chosen);
  const ends = allAnims.map(animEnd).filter(Number.isFinite);
  return Math.min(30, Math.max(3, ...ends, 6));
}

/** 讀存檔：格式不對的動畫丟掉，數值夾在合理範圍。 */
export function readAnims(value: unknown): LayerAnim[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kinds: AnimKind[] = ["shine", "bounce", "pulse", "twinkle", "float", "fadeIn"];
  const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
  const out: LayerAnim[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (!kinds.includes(r.kind as AnimKind)) continue;
    const d = defaultAnim(r.kind as AnimKind, typeof r.id === "string" ? r.id : `anim_${out.length}`);
    out.push({
      ...d,
      start: num(r.start, 0, 30, d.start), duration: num(r.duration, 0.1, 10, d.duration),
      repeat: Math.round(num(r.repeat, 0, 50, d.repeat)), gap: num(r.gap, 0, 10, d.gap), intensity: num(r.intensity, 0, 1, d.intensity),
      ...(d.kind === "shine" ? {
        // 舊存檔只有三個方向，「diagonal」就是現在的 ↘
        direction: r.direction === "diagonal" ? "downRight" : typeof r.direction === "string" && Object.hasOwn(SHINE_VECTORS, r.direction) ? (r.direction as ShineDirection) : d.direction,
        width: num(r.width, 0.1, 0.8, d.width ?? 0.35),
      } : {}),
    });
  }
  return out.length ? out : undefined;
}

/**
 * 一次套給好幾個圖層時，哪些要當成「同一個東西」一起動：
 * 外框互相重疊的（例如一格裡的底框、內框、文字、圈圈）、或同一個群組的，併成一組。
 * 回傳每個圖層屬於第幾組，組的順序是由上到下、同一排由左到右（像閱讀順序）。
 */
export function animUnits(items: { id: string; x0: number; y0: number; x1: number; y1: number; groupId?: string | null }[]): Map<string, number> {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      if (overlap || (a.groupId && a.groupId === b.groupId)) join(i, j);
    }
  }
  const groups = new Map<number, { cx: number; cy: number; h: number; ids: string[] }>();
  items.forEach((it, i) => {
    const r = find(i);
    const g = groups.get(r) ?? { cx: 0, cy: 0, h: 0, ids: [] };
    g.ids.push(it.id); g.cx += (it.x0 + it.x1) / 2; g.cy += (it.y0 + it.y1) / 2; g.h = Math.max(g.h, it.y1 - it.y0);
    groups.set(r, g);
  });
  const list = [...groups.values()].map((g) => ({ ...g, cx: g.cx / g.ids.length, cy: g.cy / g.ids.length }));
  // 同一排：中心高度差不到半個物件高就算同一排
  list.sort((a, b) => (Math.abs(a.cy - b.cy) < Math.min(a.h, b.h) / 2 ? a.cx - b.cx : a.cy - b.cy));
  const out = new Map<string, number>();
  list.forEach((g, i) => g.ids.forEach((id) => out.set(id, i)));
  return out;
}
