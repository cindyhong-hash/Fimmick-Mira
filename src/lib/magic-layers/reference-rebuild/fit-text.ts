/* ============================================================
   照參考圖重做 —— 在瀏覽器裡算每段文字的字級與位置

   排法完全照編輯器 drawTextEl：以框中心為原點、textBaseline middle、
   行高 1.25 倍字級、左齊／右齊從框邊起算。字級反推成「字跡剛好填滿原本的範圍」，
   這樣重建的字大小、位置才會跟原圖一致。

   量字交給呼叫端（measure），瀏覽器用 canvas，測試用假的——
   所以這支檔案不碰 DOM，伺服器、測試都能 import。
   ============================================================ */
import type { RebuildText } from "./types.ts";

/** 編輯器字體選單裡的值（要一字不差，不然右側面板的下拉會對不上）。 */
export const FONT_SANS = "'Noto Sans TC',system-ui,sans-serif";
export const FONT_SERIF = "'Noto Serif TC',serif";
export const FONT_LATIN = "'Manrope','Noto Sans TC',sans-serif";

/** 各字體實際載入的字重（src/app/layout.tsx），選最接近的，避免瀏覽器自己假粗體。 */
const WEIGHTS: Record<string, number[]> = { [FONT_SANS]: [400, 500, 700, 900], [FONT_SERIF]: [400, 700, 900], [FONT_LATIN]: [400, 700, 800] };

const LATIN_ONLY = /^[\x20-\x7E™®©°·•’“”\s]+$/;

export function fontFor(t: Pick<RebuildText, "family" | "text" | "weight">): { family: string; weight: number } {
  const family = t.family === "serif" ? FONT_SERIF : LATIN_ONLY.test(t.text) ? FONT_LATIN : FONT_SANS;
  const weight = WEIGHTS[family].reduce((a, b) => (Math.abs(b - t.weight) < Math.abs(a - t.weight) ? b : a));
  return { family, weight };
}

/** 一行字以 textAlign 錨點、textBaseline middle 為原點的字跡範圍（canvas measureText 的 actualBoundingBox*）。 */
export type InkMetrics = { left: number; right: number; ascent: number; descent: number };
export type Measure = (font: string, letterSpacingPx: number, align: CanvasTextAlign, line: string) => InkMetrics;

export type FittedText = {
  text: string; x: number; y: number; w: number; h: number;
  fontSize: number; fontFamily: string; fontWeight: number; color: string;
  align: "left" | "center" | "right"; rotation: number; letterSpacingPx: number; italic: boolean; behindProduct: boolean;
};

const LINE_HEIGHT = 1.25;   // 跟編輯器 drawTextEl 一樣

export function fitText(t: RebuildText, measure: Measure): FittedText {
  const text = t.vertical ? [...t.text.replace(/\n/g, "")].join("\n") : t.text;
  const lines = text.split("\n");
  const { family, weight } = fontFor(t);
  const fontStr = (fs: number) => `${t.italic ? "italic " : ""}${weight} ${fs}px ${family}`;

  // 以框中心為原點量整塊字跡（boxW 決定左齊／右齊的錨點位置）
  const inkAt = (fs: number, boxW: number, spacingEm: number) => {
    const LH = fs * LINE_HEIGHT, firstY = -((lines.length - 1) * LH) / 2;
    const tx = t.align === "left" ? -boxW / 2 : t.align === "right" ? boxW / 2 : 0;
    let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
    lines.forEach((line, i) => {
      const m = measure(fontStr(fs), spacingEm * fs, t.align, line), y = firstY + i * LH;
      L = Math.min(L, tx - m.left); R = Math.max(R, tx + m.right);
      T = Math.min(T, y - m.ascent); B = Math.max(B, y + m.descent);
    });
    return { L, R, T, B, w: R - L, h: B - T };
  };

  let spacing = t.letterSpacingEm;
  const probe = inkAt(100, t.box.w, spacing);
  // 高、寬都不能超出原本的範圍：字體換了寬度不同，只對高度會跟隔壁的字撞在一起
  const fs = Math.max(6, Math.min((100 * t.box.h) / Math.max(1, probe.h), (100 * t.box.w) / Math.max(1, probe.w)));

  // 原圖字距比較寬時（「3 2 1 ▼ 1 2 3」、字距拉開的小標），把差額平均加到字距上
  const longest = lines.reduce((a, b) => ([...b].length > [...a].length ? b : a), "");
  const chars = [...longest].length;
  if (!t.vertical && lines.length === 1 && chars > 1) {
    const got = inkAt(fs, t.box.w, spacing).w;
    if (got < t.box.w * 0.92) spacing += Math.min(0.6, (t.box.w - got) / (chars - 1) / fs);
  }

  const boxW = Math.max(t.box.w, inkAt(fs, t.box.w, spacing).w) * 1.04 + 4;
  const ink = inkAt(fs, boxW, spacing);
  const boxH = ink.h * 1.1 + 4;
  // 讓字跡落在原本的位置：左齊對左邊、右齊對右邊、置中對中心；垂直一律對中心
  const targetX = t.align === "left" ? t.box.x : t.align === "right" ? t.box.x + t.box.w : t.box.x + t.box.w / 2;
  const inkX = t.align === "left" ? ink.L : t.align === "right" ? ink.R : (ink.L + ink.R) / 2;
  const cx = targetX - inkX, cy = t.box.y + t.box.h / 2 - (ink.T + ink.B) / 2;

  return {
    text, x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH,
    fontSize: fs, fontFamily: family, fontWeight: weight, color: t.color, align: t.align,
    rotation: (t.rotationDeg * Math.PI) / 180, letterSpacingPx: spacing * fs, italic: t.italic, behindProduct: t.behindProduct,
  };
}

/** 瀏覽器版的 measure：用 canvas 量，跟編輯器畫字用同一套 API。 */
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (font, letterSpacingPx, align, line) => {
    ctx.font = font;
    ctx.letterSpacing = `${letterSpacingPx}px`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    const m = ctx.measureText(line);
    return { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
  };
}
