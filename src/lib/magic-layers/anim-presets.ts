/* ============================================================
   動畫的複製／貼上、動畫公版（像 Lightroom 的「拷貝設定 → 貼上設定」）。

   ・複製：拿一個物件身上的動畫（效果、速度、方向、開始時間…全部照抄）。
     輪播不複製：它是一整組卡片共用的設定（group、焦點），單獨貼到別的物件上沒有意義。
   ・貼上：取代目標物件原本的動畫。貼給好幾個物件時可以「依序錯開」：
     照畫面上由上到下、由左到右的順序，每個晚 step 秒開始（跟套用效果時的錯開一樣自然）。
   ・公版：把一組動畫取名存起來，之後點一下就能套。先存在這台瀏覽器（localStorage），
     不用改資料庫；之後要讓同品牌的人共用再搬進資料庫。
   這裡只放純函式；讀寫 localStorage 的包裝也在這裡（瀏覽器才呼叫）。
   ============================================================ */
import { readAnims, type LayerAnim } from "./layer-animation.ts";

export type AnimPreset = { id: string; name: string; anims: LayerAnim[]; createdAt: number };

export const PRESET_KEY = "mira.animPresets.v1";
/** 公版最多存幾個（太多清單會很長；最舊的會被擠掉）。 */
export const MAX_PRESETS = 30;
/** 依序錯開時每個物件晚幾秒。 */
export const PASTE_STAGGER = 0.3;

/** 可以複製的動畫：拿掉輪播、拿掉只對原本那個物件有意義的欄位（id、時間軸上自己取的名字）。 */
export function copyableAnims(anims: LayerAnim[] | undefined): LayerAnim[] {
  return (anims ?? []).filter((a) => a.kind !== "carousel").map((a) => {
    const { id: _id, label: _label, group: _g, anchorX: _x, steps: _s, ...rest } = a;
    void _id; void _label; void _g; void _x; void _s;
    return { ...rest, id: "" };
  });
}

/**
 * 貼給 n 個物件：每個物件拿一份新的動畫（新的 id）。
 * stagger＞0 時第 i 個（已經照畫面順序排好）晚 i×stagger 秒開始。
 */
export function animsForTargets(src: LayerAnim[], n: number, stagger: number, newId: () => string): LayerAnim[][] {
  return Array.from({ length: n }, (_, i) => src.map((a) => ({ ...a, id: newId(), start: Math.round((a.start + i * stagger) * 100) / 100 })));
}

/** 畫面上的閱讀順序：由上到下、同一列（差不到半個物件高）由左到右。回傳排好的索引。 */
export function readingOrder(boxes: { cx: number; cy: number; h: number }[]): number[] {
  return boxes.map((b, i) => ({ ...b, i })).sort((a, b) => {
    const row = Math.min(a.h, b.h) / 2;
    return Math.abs(a.cy - b.cy) > row ? a.cy - b.cy : a.cx - b.cx;
  }).map((b) => b.i);
}

/** 讀 localStorage 存的公版：格式不對的丟掉，動畫數值也重新檢查一遍。 */
export function parsePresets(raw: string | null): AnimPreset[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((p): AnimPreset[] => {
      if (!p || typeof p.id !== "string" || typeof p.name !== "string") return [];
      const anims = readAnims(p.anims) ?? [];
      return anims.length ? [{ id: p.id, name: p.name.slice(0, 40), anims, createdAt: Number(p.createdAt) || 0 }] : [];
    }).slice(0, MAX_PRESETS);
  } catch { return []; }
}

/** 新增公版：同名的取代掉（當成更新），新的排最前面，超過上限就擠掉最舊的。 */
export function addPreset(list: AnimPreset[], preset: AnimPreset): AnimPreset[] {
  return [preset, ...list.filter((p) => p.name !== preset.name)].slice(0, MAX_PRESETS);
}

export function loadPresets(): AnimPreset[] {
  try { return parsePresets(window.localStorage.getItem(PRESET_KEY)); } catch { return []; }
}
export function savePresets(list: AnimPreset[]): boolean {
  try { window.localStorage.setItem(PRESET_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
