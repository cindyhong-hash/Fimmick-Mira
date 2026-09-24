/* ============================================================
   物件對齊／均分（像 Figma、PS 的對齊工具）

   ・只選一個（或一整個群組）：對齊畫布。
   ・選兩個以上：對齊「整個選取範圍」的邊或中線。
   ・選三個以上才能均分：頭尾不動，中間的照順序排，讓每兩個之間的空隙一樣大。

   量的是圖層在畫布上實際佔的範圍（有旋轉、傾斜也算進去），不是原本的寬高。
   同一個群組當成一整塊一起移動，不會被拆散；鎖定的圖層不動。
   ============================================================ */
import { layerCorners, type LayerGeometry } from "./layer-transform.ts";

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "hdistribute" | "vdistribute";
export type AlignItem = LayerGeometry & { id: string; groupId?: string | null; locked?: boolean };
type Box = { x0: number; y0: number; x1: number; y1: number };

function boxOf(items: AlignItem[]): Box {
  const ps = items.flatMap((l) => layerCorners(l));
  return { x0: Math.min(...ps.map((p) => p.x)), y0: Math.min(...ps.map((p) => p.y)), x1: Math.max(...ps.map((p) => p.x)), y1: Math.max(...ps.map((p) => p.y)) };
}

/** 同群組的併成一塊；鎖定的拿掉。 */
function unitsOf(items: AlignItem[]): AlignItem[][] {
  const out: AlignItem[][] = [], byGroup = new Map<string, AlignItem[]>();
  for (const l of items) {
    if (l.locked) continue;
    if (!l.groupId) { out.push([l]); continue; }
    const g = byGroup.get(l.groupId);
    if (g) g.push(l); else { const arr = [l]; byGroup.set(l.groupId, arr); out.push(arr); }
  }
  return out;
}

/** 選取裡有幾塊（群組算一塊、鎖定不算）：1 塊就是對齊畫布。 */
export function unitCount(items: AlignItem[]): number {
  return unitsOf(items).length;
}

/** 這次可以做哪些：均分要三塊以上。 */
export function canDistribute(items: AlignItem[]): boolean {
  return unitsOf(items).length >= 3;
}

/**
 * 算出每個圖層要移動多少（id → dx, dy）；不用動的不會出現在結果裡。
 * canvas 是畫布大小，只選一塊時對齊它。
 */
export function alignOffsets(items: AlignItem[], mode: AlignMode, canvas: { w: number; h: number }): Map<string, { dx: number; dy: number }> {
  const units = unitsOf(items), out = new Map<string, { dx: number; dy: number }>();
  if (!units.length) return out;
  const boxes = units.map(boxOf);
  const move = (i: number, dx: number, dy: number) => {
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
    for (const l of units[i]) out.set(l.id, { dx, dy });
  };

  if (mode === "hdistribute" || mode === "vdistribute") {
    if (units.length < 3) return out;
    const horiz = mode === "hdistribute";
    const order = boxes.map((b, i) => ({ b, i })).sort((a, z) => horiz ? (a.b.x0 + a.b.x1) - (z.b.x0 + z.b.x1) : (a.b.y0 + a.b.y1) - (z.b.y0 + z.b.y1));
    const first = order[0].b, last = order[order.length - 1].b;
    const size = (b: Box) => horiz ? b.x1 - b.x0 : b.y1 - b.y0;
    const span = horiz ? last.x1 - first.x0 : last.y1 - first.y0;
    const gap = (span - order.reduce((s, o) => s + size(o.b), 0)) / (order.length - 1);
    let at = (horiz ? first.x0 : first.y0);
    for (const { b, i } of order) {
      const cur = horiz ? b.x0 : b.y0;
      move(i, horiz ? at - cur : 0, horiz ? 0 : at - cur);
      at += size(b) + gap;
    }
    return out;
  }

  const ref: Box = units.length === 1 ? { x0: 0, y0: 0, x1: canvas.w, y1: canvas.h } : {
    x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
  };
  boxes.forEach((b, i) => {
    switch (mode) {
      case "left": move(i, ref.x0 - b.x0, 0); break;
      case "right": move(i, ref.x1 - b.x1, 0); break;
      case "hcenter": move(i, (ref.x0 + ref.x1) / 2 - (b.x0 + b.x1) / 2, 0); break;
      case "top": move(i, 0, ref.y0 - b.y0); break;
      case "bottom": move(i, 0, ref.y1 - b.y1); break;
      case "vcenter": move(i, 0, (ref.y0 + ref.y1) / 2 - (b.y0 + b.y1) / 2); break;
    }
  });
  return out;
}
