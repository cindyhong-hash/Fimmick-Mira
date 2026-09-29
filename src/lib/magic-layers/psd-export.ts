/* ============================================================
   自由畫布 → PSD：換算用的純函式（字型名稱、顏色、分段樣式、陰影角度）。
   真正畫圖層、寫檔在編輯器裡（要用到畫布的繪圖函式），這裡只放可以單獨測的部分。

   做法：
   ・每個圖層一個 PS 圖層，位置、上下順序、透明度、顯示/隱藏照畫布；
     照片、形狀、色塊的陰影／光暈直接畫進像素（看起來跟畫布一樣）。
   ・文字做成 PS 可以改字的文字圖層，陰影、光暈、描邊轉成 PS 的圖層效果；
     另外放一個隱藏的群組，裝每段文字「畫布上的樣子」的圖片版，字型不同時可以對照或直接用。
   ・漸層字、彎曲字 PS 文字圖層做不出來，就只給圖片。
   ============================================================ */
import type { LayerGlow, LayerShadow } from "./layer-glow.ts";
import type { TextFx, TextRun } from "./saved-layer.ts";

export type RGB = { r: number; g: number; b: number };

/** #rgb / #rrggbb / #rrggbbaa → RGB；看不懂的給黑色。 */
export function hexToRgb(hex: string | undefined | null): RGB {
  const m = String(hex ?? "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const WEIGHT_NAMES: [number, string][] = [
  [100, "Thin"], [200, "ExtraLight"], [300, "Light"], [400, "Regular"], [500, "Medium"],
  [600, "SemiBold"], [700, "Bold"], [800, "ExtraBold"], [900, "Black"],
];

/**
 * CSS 字型 → Photoshop 用的 PostScript 名稱（例如 'Noto Sans TC' 700 → NotoSansTC-Bold）。
 * 電腦上沒有這套字 PS 會自己換成別的字，所以這裡只求名稱寫對。
 */
export function psdFontName(fontFamily: string, weight: number): string {
  const first = (fontFamily.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  const generic = !first || /^(system-ui|sans-serif|serif|monospace|cursive|-apple-system)$/i.test(first);
  const family = generic ? "Noto Sans TC" : first;
  const w = WEIGHT_NAMES.reduce((best, cur) => (Math.abs(cur[0] - weight) < Math.abs(best[0] - weight) ? cur : best));
  return `${family.replace(/\s+/g, "")}-${w[1]}`;
}

export type RunStyle = { fontSize: number; color: RGB; fontWeight: number };

/**
 * 分段樣式（只把某幾個字放大／換色）→ PS 的 styleRuns：一段一段接起來、長度加總等於全文。
 * 範圍用 JS 字串的索引（跟畫布的 runs 一樣）。
 */
export function styleRunsFor(text: string, base: RunStyle, runs: TextRun[] | undefined): { length: number; style: RunStyle }[] {
  const n = text.length;
  if (!n) return [];
  const at: RunStyle[] = Array.from({ length: n }, () => base);
  for (const r of runs ?? []) {
    const s = Math.max(0, Math.min(n, Math.floor(r.start))), e = Math.max(s, Math.min(n, Math.floor(r.end)));
    for (let i = s; i < e; i++) {
      at[i] = {
        fontSize: r.fontSize ?? at[i].fontSize,
        color: r.color ? hexToRgb(r.color) : at[i].color,
        fontWeight: r.fontWeight ?? at[i].fontWeight,
      };
    }
  }
  const out: { length: number; style: RunStyle }[] = [];
  for (let i = 0; i < n; i++) {
    const last = out[out.length - 1];
    if (last && same(last.style, at[i])) last.length++;
    else out.push({ length: 1, style: at[i] });
  }
  return out;
}
function same(a: RunStyle, b: RunStyle) {
  return a.fontSize === b.fontSize && a.fontWeight === b.fontWeight && a.color.r === b.color.r && a.color.g === b.color.g && a.color.b === b.color.b;
}

/**
 * 畫布的陰影角度（0° 往右、90° 往下，影子往那個方向落）→ PS 的光源角度
 * （PS 的角度是光從哪裡來，影子落在反方向；120° = 影子往右下）。
 */
export function psShadowAngle(angle: number): number {
  let a = 180 - angle;
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return Math.round(a);
}

/** 文字能不能做成 PS 的可編輯文字圖層：漸層字、彎曲字做不到，只能給圖片。 */
export function isEditableInPsd(fx: TextFx | null | undefined): boolean {
  return !fx?.gradient && (!fx?.warp || fx.warp === "none");
}

const px = (value: number) => ({ units: "Pixels" as const, value: Math.max(0, Math.round(value * 10) / 10) });

/** 文字圖層的 PS 圖層效果：陰影、外光暈、描邊（描邊寬度用實際字級換算）。沒有就回傳 undefined。 */
export function psdTextEffects(input: { shadow?: LayerShadow | null; glow?: LayerGlow | null; fx?: TextFx | null; fontSize: number }) {
  const effects: Record<string, unknown> = {};
  if (input.shadow) {
    effects.dropShadow = [{
      enabled: true, present: true, showInDialog: true, useGlobalLight: false, blendMode: "multiply",
      color: hexToRgb(input.shadow.color), opacity: input.shadow.opacity,
      angle: psShadowAngle(input.shadow.angle), distance: px(input.shadow.distance), size: px(input.shadow.blur),
    }];
  }
  if (input.glow) {
    effects.outerGlow = {
      enabled: true, present: true, showInDialog: true, blendMode: "normal",
      color: hexToRgb(input.glow.color), opacity: input.glow.opacity, size: px(input.glow.size),
    };
  }
  if (input.fx?.strokeW && input.fx.strokeW > 0) {
    // 畫布的描邊是跨在字的邊上（一半在外），PS 的「外側」描邊只算外面那一半
    effects.stroke = [{
      enabled: true, present: true, showInDialog: true, position: "outside", fillType: "color", blendMode: "normal", opacity: 1,
      color: hexToRgb(input.fx.strokeColor || "#ffffff"), size: px((input.fontSize * input.fx.strokeW) / 2),
    }];
  }
  return Object.keys(effects).length ? effects : undefined;
}

/** 下載用的檔名：拿掉檔名不能用的字，空的就叫「設計稿」。 */
export function psdFileName(name: string | undefined | null): string {
  const base = String(name ?? "").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").trim().slice(0, 60) || "設計稿";
  return `${base}.psd`;
}
