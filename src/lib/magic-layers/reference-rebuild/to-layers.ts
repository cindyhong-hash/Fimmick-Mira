/* ============================================================
   照參考圖重做 —— 組成編輯器的圖層

   圖層順序：背景 → 色塊 → 被產品擋住的字 → 產品 → 其他字。
   被擋住的字放在產品下面，換成使用者自己的產品時，原本被遮住的字會完整露出來。
   格式走 savedToLayerData，跟自由排版精靈、續編草稿交棒給編輯器的是同一種。
   ============================================================ */
import { savedToLayerData, type SavedLayer } from "../saved-layer.ts";
import type { LayerData } from "../types.ts";
import type { FittedText } from "./fit-text.ts";
import type { RebuildResult } from "./types.ts";

export function rebuildToLayers(result: RebuildResult, texts: FittedText[]): LayerData[] {
  return rebuildToSavedLayers(result, texts).map(savedToLayerData);
}

/** 同一份圖層、存檔格式（SavedLayer）：編輯器裡「照參考圖重做」直接放成新頁面時用。 */
export function rebuildToSavedLayers(result: RebuildResult, texts: FittedText[]): SavedLayer[] {
  const out: SavedLayer[] = [];
  const push = (l: Omit<SavedLayer, "zIndex" | "visible" | "opacity" | "locked"> & { opacity?: number }) =>
    out.push({ visible: true, locked: false, opacity: 1, ...l, zIndex: out.length });

  push({ id: "rebuild-bg", type: "background", name: "背景", x: 0, y: 0, w: result.docW, h: result.docH, rotation: 0, image: result.backgroundUrl });
  result.shapes.forEach((s, i) => push({
    id: `rebuild-shape-${i}`, type: "decoration", name: s.kind === "pill" ? "膠囊色塊" : "色塊",
    x: s.box.x, y: s.box.y, w: s.box.w, h: s.box.h, rotation: 0, opacity: s.opacity,
    shape: { kind: s.kind === "circle" ? "ellipse" : "rect", fill: s.fill, stroke: "#00000000", strokeWidth: 0,
      ...(s.kind === "pill" ? { radius: Math.min(s.box.w, s.box.h) / 2 } : {}) },
  }));
  const text = (t: FittedText, i: number) => push({
    id: `rebuild-text-${i}`, type: "independent_text", name: t.text.replace(/\n/g, "").slice(0, 12) || "文字",
    x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation,
    isText: true, text: t.text, color: t.color, fontSize: t.fontSize, fontFamily: t.fontFamily, fontWeight: t.fontWeight, align: t.align,
    fx: { letterSpacing: t.letterSpacingPx, ...(t.italic ? { italic: true } : {}) },
  });
  texts.forEach((t, i) => { if (t.behindProduct) text(t, i); });
  result.products.forEach((p, i) => push({
    id: `rebuild-product-${i}`, type: "product", name: p.label || `產品 ${i + 1}`,
    x: p.box.x, y: p.box.y, w: p.box.w, h: p.box.h, rotation: 0, image: p.url,
  }));
  texts.forEach((t, i) => { if (!t.behindProduct) text(t, i); });
  return out;
}
