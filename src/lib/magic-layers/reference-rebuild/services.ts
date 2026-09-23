/* ============================================================
   照參考圖重做 —— 真正打出去的外部服務（只在伺服器用）
   ============================================================ */
import { falRemoveBg } from "@/lib/generate";
import { saveBuffer } from "@/lib/storage";
import type { RebuildDeps } from "./rebuild.ts";

/** 讀版面用的模型。實測 gemini-3.8-flash 框最準、最便宜；要換模型設這個環境變數。 */
const LAYOUT_MODEL = process.env.OPENROUTER_REBUILD_MODEL || "google/gemini-3.8-flash";

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

/**
 * 正常 15 秒內回來，但偶爾會卡住一分多鐘。與其讓使用者乾等，每次最多等 40 秒，
 * 卡住或失敗就重送一次（整個請求的時限由路由控制，外層取消時不再重試）。
 */
async function analyze(imageDataUrl: string, prompt: string, signal?: AbortSignal): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await analyzeOnce(imageDataUrl, prompt, signal); }
    catch (e) { lastError = e; if (signal?.aborted) break; }
  }
  throw lastError instanceof Error && lastError.name !== "TimeoutError" ? lastError : new Error("AI 讀圖太久沒有回應，請再試一次");
}

async function analyzeOnce(imageDataUrl: string, prompt: string, signal?: AbortSignal): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("缺少 OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: withTimeout(signal, 40_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LAYOUT_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const content = data?.choices?.[0]?.message?.content;
  if (!res.ok || typeof content !== "string" || !content.trim()) throw new Error("AI 暫時讀不了這張圖，請稍後再試");
  return content;
}

async function inpaint(imagePng: Buffer, maskPng: Buffer, signal?: AbortSignal): Promise<Buffer> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("缺少 FAL_KEY");
  const res = await fetch("https://fal.run/fal-ai/lama", {
    method: "POST",
    signal: withTimeout(signal, 60_000),
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${imagePng.toString("base64")}`,
      mask_image_url: `data:image/png;base64,${maskPng.toString("base64")}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  const url = data?.image?.url ?? data?.images?.[0]?.url;
  if (!res.ok || typeof url !== "string") throw new Error("補背景失敗，請稍後再試");
  const img = await fetch(url, { signal: withTimeout(signal, 30_000) });
  if (!img.ok) throw new Error("補背景的結果下載失敗");
  return Buffer.from(await img.arrayBuffer());
}

export const rebuildServices: RebuildDeps = {
  analyze,
  removeBackground: (dataUrl, signal) => falRemoveBg(dataUrl, signal),
  inpaint,
  save: (buffer, ext, prefix, signal) => saveBuffer(buffer, ext, prefix, signal),
};
