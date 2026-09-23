/* ============================================================
   照參考圖重做 —— 瀏覽器端（只在 client component 用）
   ============================================================ */
import type { LayerData } from "../types.ts";
import { canvasMeasure, fitText, fontFor } from "./fit-text.ts";
import { rebuildToLayers } from "./to-layers.ts";
import type { RebuildResult } from "./types.ts";

/**
 * 上傳前先縮圖：手機照片動輒 4000px、好幾 MB，會超過伺服器的請求大小上限；
 * 伺服器本來也只用到 1600px。
 */
export async function shrinkForUpload(dataUrl: string, maxSide = 1600): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("讀不到這張圖片")); i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && dataUrl.length < 3_000_000) return dataUrl;
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/** 用編輯器實際載入的字體量字，排好每段文字，組成圖層。 */
export async function buildRebuildLayers(result: RebuildResult): Promise<LayerData[]> {
  // 先把用到的字體載進來：中文字體依字元分包，要帶實際文字才會下載對的那包，
  // 沒載好就量，量到的是替代字體的寬度，排出來會歪。
  await Promise.all(result.texts.map((t) => {
    const { family, weight } = fontFor(t);
    return document.fonts.load(`${weight} 40px ${family}`, t.text).catch(() => []);
  }));
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("瀏覽器不支援畫布");
  const measure = canvasMeasure(ctx);
  return rebuildToLayers(result, result.texts.map((t) => fitText(t, measure)));
}
