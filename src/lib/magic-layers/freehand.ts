/* ============================================================
   自由繪製（Figma／FigJam Pencil 的邏輯）

   滑鼠軌跡 → 平滑 → 簡化 → 轉成平順曲線，存成向量路徑（跟鋼筆同一種格式），
   縮放不會糊，之後 AI 產生手繪圈選、箭頭也能用同一種資料。

   平滑刻意做得輕：定位是「設計畫布上的標記與裝飾」，使用者畫歪的地方要保留，
   只去掉滑鼠／觸控板的細碎抖動，不幫人把線拉直。
   ============================================================ */
import type { PaintStroke, PathPoint } from "./saved-layer.ts";

export type Pt = { x: number; y: number };

/**
 * 穩定器：每個點跟前後幾個點一起平均（視窗大小隨 amount 變大，0＝原樣）。
 * 前後一起平均能把滑鼠「一上一下」的細碎抖動抵消掉，又不會像只看前面的點那樣讓線條「拖在游標後面」。
 * 靠近頭尾時視窗跟著縮小，頭尾兩點一定保留原位，線頭才對得上游標。
 */
export function stabilize(points: Pt[], amount: number): Pt[] {
  const r = Math.round(Math.max(0, Math.min(1, amount)) * 6);
  if (points.length < 3 || r === 0) return points.slice();
  const n = points.length;
  return points.map((p, i) => {
    const k = Math.min(r, i, n - 1 - i);
    if (k === 0) return p;
    let sx = 0, sy = 0;
    for (let j = i - k; j <= i + k; j++) { sx += points[j].x; sy += points[j].y; }
    return { x: sx / (2 * k + 1), y: sy / (2 * k + 1) };
  });
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 簡化（Ramer–Douglas–Peucker）：偏離不到 epsilon 的點拿掉，頭尾一定保留。 */
export function simplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3 || epsilon <= 0) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = distToSegment(points[i], points[s], points[e]); if (d > maxD) { maxD = d; idx = i; } }
    if (idx >= 0 && maxD > epsilon) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * 把點串接成平順的曲線（Catmull-Rom 轉三次貝茲）：每個點都有進、出把手，
 * 曲線會通過每一個點，不會像多邊形那樣出現尖角。把手是相對於點的位移。
 */
export function toSmoothPath(points: Pt[]): { x: number; y: number; ix?: number; iy?: number; ox?: number; oy?: number }[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const P = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  return points.map((p, i) => {
    const prev = P(i - 1), next = P(i + 1);
    const hx = (next.x - prev.x) / 6, hy = (next.y - prev.y) / 6;
    return {
      x: p.x, y: p.y,
      ...(i > 0 ? { ix: -hx, iy: -hy } : {}),
      ...(i < points.length - 1 ? { ox: hx, oy: hy } : {}),
    };
  });
}

/**
 * 一筆畫的完整處理。smoothing 0–100（預設 50）；zoom 用來讓「去抖動」以螢幕上的像素為準，
 * 放大畫細節時不會被過度簡化。
 */
export function smoothStroke(raw: Pt[], smoothing: number, zoom = 1) {
  const s = Math.max(0, Math.min(100, smoothing)) / 100;
  // 太密的點先合併（同一個像素內的抖動沒有意義）
  const minGap = 0.8 / zoom;
  const dedup: Pt[] = [];
  for (const p of raw) { const last = dedup[dedup.length - 1]; if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minGap) dedup.push(p); }
  if (raw.length && dedup[dedup.length - 1] !== raw[raw.length - 1] && dedup.length > 1) dedup[dedup.length - 1] = raw[raw.length - 1];
  const stable = stabilize(dedup, s * 0.6);
  const simple = simplify(stable, (0.3 + s * 2.2) / zoom);
  return toSmoothPath(simple);
}

/** 以圖層中心為原點、比例座標的路徑 → 取樣成折線（圖層座標），橡皮擦、點選用。 */
export function samplePath(points: PathPoint[], w: number, h: number, steps = 8): Pt[] {
  const out: Pt[] = [];
  const X = (v: number) => v * w, Y = (v: number) => v * h;
  for (let i = 0; i < points.length; i++) {
    const b = points[i];
    if (i === 0) { out.push({ x: X(b.x), y: Y(b.y) }); continue; }
    const a = points[i - 1];
    if (a.ox == null && b.ix == null) { out.push({ x: X(b.x), y: Y(b.y) }); continue; }
    const p0 = { x: X(a.x), y: Y(a.y) }, p1 = { x: X(a.x + (a.ox ?? 0)), y: Y(a.y + (a.oy ?? 0)) };
    const p2 = { x: X(b.x + (b.ix ?? 0)), y: Y(b.y + (b.iy ?? 0)) }, p3 = { x: X(b.x), y: Y(b.y) };
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
  }
  return out;
}

/** 點到折線的最短距離。 */
export function distanceToPolyline(p: Pt, line: Pt[]): number {
  if (!line.length) return Infinity;
  if (line.length === 1) return Math.hypot(p.x - line[0].x, p.y - line[0].y);
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, distToSegment(p, line[i - 1], line[i]));
  return d;
}

/** 轉成 SVG path 字串（圖層座標，以中心為原點）：之後匯出 SVG、交給 AI 都用得到。 */
export function toSvgPath(points: PathPoint[], w: number, h: number, closed = false): string {
  if (!points.length) return "";
  const f = (n: number) => Math.round(n * 100) / 100;
  const X = (v: number) => f(v * w), Y = (v: number) => f(v * h);
  let d = `M${X(points[0].x)} ${Y(points[0].y)}`;
  const seg = (a: PathPoint, b: PathPoint) => {
    d += a.ox != null || b.ix != null
      ? ` C${X(a.x + (a.ox ?? 0))} ${Y(a.y + (a.oy ?? 0))} ${X(b.x + (b.ix ?? 0))} ${Y(b.y + (b.iy ?? 0))} ${X(b.x)} ${Y(b.y)}`
      : ` L${X(b.x)} ${Y(b.y)}`;
  };
  for (let i = 1; i < points.length; i++) seg(points[i - 1], points[i]);
  if (closed && points.length > 2) { seg(points[points.length - 1], points[0]); d += " Z"; }
  return d;
}

/* ---------- 圖層內繪製：畫在圖片上的筆畫 ---------- */

/** 筆畫粗細的基準：圖層 (寬＋高)/2。圖片縮放時粗細跟著變，不會放大後線變細。 */
export const paintScale = (w: number, h: number) => (w + h) / 2;

/**
 * 一筆畫（畫布座標、已平滑）→ 掛在圖層上的比例座標。
 * toLocal 把畫布座標換成圖層座標（以中心為原點、已扣掉旋轉和傾斜）。
 */
export function strokeToPaint(
  pts: { x: number; y: number; ix?: number; iy?: number; ox?: number; oy?: number }[],
  toLocal: (x: number, y: number) => Pt, w: number, h: number,
  style: { color: string; width: number; opacity: number },
): PaintStroke {
  const points = pts.map((p) => {
    const a = toLocal(p.x, p.y);
    const out: PathPoint = { x: a.x / w, y: a.y / h };
    if (p.ix != null) { const b = toLocal(p.x + p.ix, p.y + (p.iy ?? 0)); out.ix = b.x / w - out.x; out.iy = b.y / h - out.y; }
    if (p.ox != null) { const b = toLocal(p.x + p.ox, p.y + (p.oy ?? 0)); out.ox = b.x / w - out.x; out.oy = b.y / h - out.y; }
    return out;
  });
  return { points, color: style.color, width: style.width / paintScale(w, h), opacity: style.opacity };
}

/** 在圖層座標系（中心為原點）畫出這張圖片上的筆畫；超出圖片範圍的部分裁掉。 */
export function drawPaint(ctx: CanvasRenderingContext2D, strokes: PaintStroke[] | undefined, w: number, h: number) {
  if (!strokes?.length) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const base = ctx.globalAlpha, k = paintScale(w, h);
  for (const s of strokes) {
    const p = s.points; if (!p.length) continue;
    ctx.globalAlpha = base * s.opacity; ctx.strokeStyle = s.color; ctx.lineWidth = s.width * k;
    ctx.beginPath(); ctx.moveTo(p[0].x * w, p[0].y * h);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (a.ox != null || b.ix != null) ctx.bezierCurveTo((a.x + (a.ox ?? 0)) * w, (a.y + (a.oy ?? 0)) * h, (b.x + (b.ix ?? 0)) * w, (b.y + (b.iy ?? 0)) * h, b.x * w, b.y * h);
      else ctx.lineTo(b.x * w, b.y * h);
    }
    if (p.length === 1) ctx.lineTo(p[0].x * w + 0.01, p[0].y * h);
    ctx.stroke();
  }
  ctx.restore();
}

/** 圖層座標 local 碰到的那幾筆（索引）；橡皮擦、點選用。 */
export function paintHits(strokes: PaintStroke[] | undefined, w: number, h: number, local: Pt, tolerance: number): number[] {
  if (!strokes?.length) return [];
  const k = paintScale(w, h), out: number[] = [];
  strokes.forEach((s, i) => { if (distanceToPolyline(local, samplePath(s.points, w, h)) <= (s.width * k) / 2 + tolerance) out.push(i); });
  return out;
}
