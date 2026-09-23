import type { ShapeSpec } from "./saved-layer.ts";

export const EDITABLE_ICON_NAMES = ["star", "heart", "circle", "triangle", "check", "arrow", "plus", "bolt", "water-drop", "spring", "blade", "shield", "sparkle", "leaf", "sun", "clean", "repair", "texture"] as const;

/** 可以填色、可以拿來當遮色片的形狀（線條、圖標只有筆畫，沒有「裡面」）。 */
export const FILLABLE_SHAPE_KINDS = ["rect", "ellipse", "triangle", "diamond", "polygon", "star"] as const;
export const isFillableShape = (sh: ShapeSpec | null | undefined): sh is ShapeSpec =>
  !!sh && ((FILLABLE_SHAPE_KINDS as readonly string[]).includes(sh.kind) || (sh.kind === "path" && !!sh.closed && (sh.points?.length ?? 0) >= 3));

/** 描出鋼筆路徑（以圖層中心為原點）。有把手的線段畫成曲線，沒有的畫直線。 */
function tracePath(ctx: CanvasRenderingContext2D, w: number, h: number, pts: NonNullable<ShapeSpec["points"]>, closed: boolean) {
  const X = (v: number) => v * w, Y = (v: number) => v * h;
  const seg = (a: (typeof pts)[number], b: (typeof pts)[number]) => {
    if (a.ox != null || b.ix != null) ctx.bezierCurveTo(X(a.x + (a.ox ?? 0)), Y(a.y + (a.oy ?? 0)), X(b.x + (b.ix ?? 0)), Y(b.y + (b.iy ?? 0)), X(b.x), Y(b.y));
    else ctx.lineTo(X(b.x), Y(b.y));
  };
  ctx.moveTo(X(pts[0].x), Y(pts[0].y));
  for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i]);
  if (closed) { seg(pts[pts.length - 1], pts[0]); ctx.closePath(); }
}

/**
 * 描出形狀的輪廓（以圖層中心為原點）。填色、漸層、剪裁遮色片都用這一條，
 * 形狀換了、圓角改了，三者才會一致。線條、圖標沒有輪廓，回傳 false。
 */
export function traceShapePath(ctx: CanvasRenderingContext2D, w: number, h: number, sh: ShapeSpec): boolean {
  const x = -w / 2, y = -h / 2, rx = w / 2, ry = h / 2;
  const poly = (n: number, rot: number) => { for (let i = 0; i < n; i++) { const a = rot + i * (2 * Math.PI / n); const px = rx * Math.cos(a), py = ry * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); };
  ctx.beginPath();
  switch (sh.kind) {
    case "rect": {
      const r = Math.min(sh.radius ?? 0, w / 2, h / 2);
      if (r > 0 && typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      return true;
    }
    case "ellipse": ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); return true;
    case "triangle": poly(3, -Math.PI / 2); return true;   // 頂點落在 w×h 外接橢圓上
    case "diamond": poly(4, -Math.PI / 2); return true;
    case "star": {
      const n = Math.max(3, sh.sides ?? 5), inner = 0.42;
      for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * (Math.PI / n); const rr = i % 2 === 0 ? 1 : inner; const px = rx * rr * Math.cos(a), py = ry * rr * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); return true;
    }
    case "polygon": poly(Math.max(3, sh.sides ?? 6), -Math.PI / 2); return true;   // 預設六邊
    case "path":
      if ((sh.points?.length ?? 0) < 2) return false;
      tracePath(ctx, w, h, sh.points!, !!sh.closed && sh.points!.length >= 3);
      return true;
    default: return false;
  }
}

/** 漸層的 canvas 填色（以圖層中心為原點）。 */
export function shapeGradientFill(ctx: CanvasRenderingContext2D, w: number, h: number, g: NonNullable<ShapeSpec["gradient"]>): CanvasGradient {
  const x = w / 2, y = h / 2;
  const grad = g.axis === "horizontal" ? ctx.createLinearGradient(-x, 0, x, 0)
    : g.axis === "diagonal" ? ctx.createLinearGradient(-x, -y, x, y)
    : g.axis === "radial" ? ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(x, y))
    : ctx.createLinearGradient(0, -y, 0, y);
  grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
  return grad;
}

/** 以形狀輪廓剪裁接下來畫的東西（剪裁遮色片）。形狀沒有輪廓時不剪、回傳 false。 */
export function clipToShape(ctx: CanvasRenderingContext2D, w: number, h: number, sh: ShapeSpec): boolean {
  if (!isFillableShape(sh) || !traceShapePath(ctx, w, h, sh)) return false;
  ctx.clip();
  return true;
}

export function drawEditableShape(ctx: CanvasRenderingContext2D, w: number, h: number, sh: ShapeSpec) {
  if (sh.kind === "ellipse" && sh.softness && !sh.gradient) {
    ctx.save(); ctx.scale(w/2,h/2);
    const g = ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,sh.fill); g.addColorStop(Math.max(0.05,1-sh.softness),sh.fill); g.addColorStop(1,"transparent");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill(); ctx.restore(); return;
  }
  const doFill = !!sh.gradient || (sh.fill && sh.fill !== "none");
  const doStroke = sh.stroke && sh.stroke !== "none" && sh.strokeWidth > 0;
  if (sh.kind === "line") {
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
    ctx.lineWidth = Math.max(1, sh.strokeWidth); ctx.strokeStyle = sh.stroke || "#111"; ctx.lineCap = "round"; ctx.stroke();
    return;
  }
  if (sh.kind === "icon") { drawIcon(ctx, Math.min(w, h), sh.icon || "star", sh.fill || "#111"); return; }
  if (!traceShapePath(ctx, w, h, sh)) return;
  // 沒封閉的鋼筆路徑只是一條線，沒有「裡面」可以填
  if (doFill && (sh.kind !== "path" || isFillableShape(sh))) { ctx.fillStyle = sh.gradient ? shapeGradientFill(ctx, w, h, sh.gradient) : sh.fill; ctx.fill(); }
  if (doStroke) { ctx.lineWidth = sh.strokeWidth; ctx.strokeStyle = sh.stroke; ctx.lineJoin = "round"; ctx.stroke(); }
}

/** Draw a text layer (with optional 文字特效). ctx already translated to layer centre + rotated.
 *  Per-layer save/restore in the caller resets shadow/letterSpacing state. */
export function drawIcon(ctx: CanvasRenderingContext2D, size: number, name: string, color: string) {
  const s = size / 24;
  ctx.save();
  ctx.scale(s, s); ctx.translate(-12, -12);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  switch (name) {
    case "water-drop": ctx.moveTo(12,2);ctx.bezierCurveTo(10,7,4,11,4,15);ctx.bezierCurveTo(4,25,20,25,20,15);ctx.bezierCurveTo(20,11,14,7,12,2);ctx.closePath();ctx.stroke();break;
    case "spring": ctx.moveTo(5,3);ctx.lineTo(19,3);for(let y=5;y<21;y+=4){ctx.lineTo(5,y);ctx.lineTo(19,y+2);}ctx.stroke();break;
    case "blade": ctx.rect(3,4,18,16);ctx.moveTo(6,9);ctx.lineTo(18,9);ctx.moveTo(6,15);ctx.lineTo(18,15);ctx.stroke();break;
    case "shield":ctx.moveTo(12,2);ctx.lineTo(21,6);ctx.bezierCurveTo(21,15,18,19,12,22);ctx.bezierCurveTo(6,19,3,15,3,6);ctx.closePath();ctx.stroke();break;
    case "sparkle":ctx.moveTo(12,2);ctx.lineTo(15,9);ctx.lineTo(22,12);ctx.lineTo(15,15);ctx.lineTo(12,22);ctx.lineTo(9,15);ctx.lineTo(2,12);ctx.lineTo(9,9);ctx.closePath();ctx.stroke();break;
    case "leaf":ctx.moveTo(4,20);ctx.bezierCurveTo(0,6,13,3,21,3);ctx.bezierCurveTo(22,16,15,23,4,20);ctx.moveTo(4,20);ctx.lineTo(16,8);ctx.stroke();break;
    case "sun":ctx.arc(12,12,4.5,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.moveTo(12+7*Math.cos(a),12+7*Math.sin(a));ctx.lineTo(12+10*Math.cos(a),12+10*Math.sin(a));}ctx.stroke();break;
    case "clean":ctx.arc(9,14,5,0,Math.PI*2);ctx.moveTo(15,5);ctx.arc(15,5,2.5,0,Math.PI*2);ctx.moveTo(19,11);ctx.arc(19,11,1.5,0,Math.PI*2);ctx.stroke();break;
    case "repair":ctx.arc(12,12,9,0,Math.PI*2);ctx.moveTo(12,7);ctx.lineTo(12,17);ctx.moveTo(7,12);ctx.lineTo(17,12);ctx.stroke();break;
    case "texture":ctx.moveTo(3,7);ctx.bezierCurveTo(7,3,10,11,14,7);ctx.bezierCurveTo(17,4,19,5,21,7);ctx.moveTo(3,12);ctx.bezierCurveTo(7,8,10,16,14,12);ctx.bezierCurveTo(17,9,19,10,21,12);ctx.moveTo(3,17);ctx.bezierCurveTo(7,13,10,21,14,17);ctx.bezierCurveTo(17,14,19,15,21,17);ctx.stroke();break;
    case "heart": ctx.moveTo(12, 21); ctx.bezierCurveTo(12, 21, 3, 14.5, 3, 8.5); ctx.bezierCurveTo(3, 5.5, 5.5, 3, 8.5, 3); ctx.bezierCurveTo(10.5, 3, 12, 4.5, 12, 6); ctx.bezierCurveTo(12, 4.5, 13.5, 3, 15.5, 3); ctx.bezierCurveTo(18.5, 3, 21, 5.5, 21, 8.5); ctx.bezierCurveTo(21, 14.5, 12, 21, 12, 21); ctx.fill(); break;
    case "circle": ctx.arc(12, 12, 9, 0, Math.PI * 2); ctx.fill(); break;
    case "triangle": ctx.moveTo(12, 3); ctx.lineTo(21, 20); ctx.lineTo(3, 20); ctx.closePath(); ctx.fill(); break;
    case "check": ctx.moveTo(5, 12.5); ctx.lineTo(10, 17.5); ctx.lineTo(19, 6.5); ctx.stroke(); break;
    case "arrow": ctx.moveTo(4, 12); ctx.lineTo(20, 12); ctx.moveTo(14, 6); ctx.lineTo(20, 12); ctx.lineTo(14, 18); ctx.stroke(); break;
    case "plus": ctx.moveTo(12, 4); ctx.lineTo(12, 20); ctx.moveTo(4, 12); ctx.lineTo(20, 12); ctx.stroke(); break;
    case "bolt": ctx.moveTo(13, 2); ctx.lineTo(3, 14); ctx.lineTo(12, 14); ctx.lineTo(11, 22); ctx.lineTo(21, 10); ctx.lineTo(12, 10); ctx.closePath(); ctx.fill(); break;
    default: { for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? 10 : 4.2; const a = -Math.PI / 2 + i * Math.PI / 5; const px = 12 + r * Math.cos(a), py = 12 + r * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
export function normalizeShape(value: unknown): ShapeSpec | null {
  if (!value || typeof value !== "object") return null;
  const v = value as ShapeSpec;
  if (!["rect","ellipse","line","icon","triangle","polygon","star","diamond","path"].includes(v.kind) || typeof v.fill !== "string" || typeof v.stroke !== "string" || !Number.isFinite(v.strokeWidth) || v.strokeWidth < 0) return null;
  if (v.softness !== undefined && (!Number.isFinite(v.softness) || v.softness < 0 || v.softness > 1)) return null;
  if (v.gradient && (!["horizontal","vertical","diagonal","radial"].includes(v.gradient.axis) || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v.gradient.from) || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v.gradient.to))) return null;
  if (v.kind === "path") {
    const finite = (n: unknown) => n === undefined || Number.isFinite(n);
    if (!Array.isArray(v.points) || v.points.length < 2 || !v.points.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && finite(p.ix) && finite(p.iy) && finite(p.ox) && finite(p.oy))) return null;
  }
  return { ...v, ...(v.gradient ? { gradient: { ...v.gradient } } : {}), ...(v.points ? { points: v.points.map((p) => ({ ...p })) } : {}) };
}
