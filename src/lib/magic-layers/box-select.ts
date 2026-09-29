/* ============================================================
   拉框選取（像 Figma / Photoshop）：在空白處按住拖出一個框，框碰到的圖層都選起來。
   ・碰到就算（不用整個包進去），旋轉、傾斜過的圖層用四個角算外框
   ・鎖定、隱藏、背景不選（背景通常鋪滿整張，選了反而礙事）
   ・群組：碰到其中一個，整組一起選
   ============================================================ */
export type BoxItem = {
  id: string; corners: { x: number; y: number }[];
  locked: boolean; visible: boolean; type: string; groupId?: string | null;
};
export type Box = { x0: number; y0: number; x1: number; y1: number };

export function normBox(b: Box): Box {
  return { x0: Math.min(b.x0, b.x1), y0: Math.min(b.y0, b.y1), x1: Math.max(b.x0, b.x1), y1: Math.max(b.y0, b.y1) };
}

/** 框碰到哪些圖層（依圖層順序，群組整組帶進來）。 */
export function idsInBox(items: BoxItem[], box: Box): string[] {
  const b = normBox(box);
  const hit = new Set<string>();
  for (const it of items) {
    if (it.locked || !it.visible || it.type === "background") continue;
    const xs = it.corners.map((p) => p.x), ys = it.corners.map((p) => p.y);
    if (Math.max(...xs) < b.x0 || Math.min(...xs) > b.x1 || Math.max(...ys) < b.y0 || Math.min(...ys) > b.y1) continue;
    hit.add(it.id);
  }
  const groups = new Set(items.filter((it) => hit.has(it.id) && it.groupId).map((it) => it.groupId));
  return items.filter((it) => hit.has(it.id) || (it.groupId && groups.has(it.groupId) && !it.locked)).map((it) => it.id);
}

/** 可以全選（⌘A）的圖層：沒鎖、看得見、不是背景。 */
export function selectableIds(items: Omit<BoxItem, "corners">[]): string[] {
  return items.filter((it) => !it.locked && it.visible && it.type !== "background").map((it) => it.id);
}
