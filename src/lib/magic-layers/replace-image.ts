/* ============================================================
   AI 換圖：在自由畫布上選一張圖，描述想要的畫面，就地換掉。

   兩種模式：
   ・edit（改這張）：原圖當參考，只改使用者說的部分（nano-banana edit）。
   ・new（全新生成）：不看原圖，照描述重畫（FLUX.2 pro，可以直接指定長寬）。

   新圖要能直接塞回原本的框：照圖層的長寬比生成，最後再裁成一模一樣的比例；
   原圖是去背的（例如商品）就把新圖也去背，換上去才不會多一塊白底。
   這支只放純函式與呼叫模型的地方，路由在 /api/magic-layers/replace-image。
   ============================================================ */

export type ReplaceMode = "edit" | "new";

/** 長寬比限制在 1:3 ～ 3:1，太極端的框模型畫不好，裁的時候也會丟掉大半張。 */
export function clampAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(3, Math.max(1 / 3, aspect));
}

/** 全新生成時直接要求的尺寸：長邊 1280，兩邊都是 16 的倍數（FLUX 的要求）。 */
export function generationSize(aspect: number): { width: number; height: number } {
  const a = clampAspect(aspect);
  const LONG = 1280;
  const r16 = (n: number) => Math.max(256, Math.round(n / 16) * 16);
  return a >= 1 ? { width: LONG, height: r16(LONG / a) } : { width: r16(LONG * a), height: LONG };
}

/** nano-banana edit 只收固定幾種比例：挑最接近的，之後再裁成精確比例。 */
export const EDIT_RATIOS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"] as const;
export function nearestEditRatio(aspect: number): (typeof EDIT_RATIOS)[number] {
  const a = clampAspect(aspect);
  let best: (typeof EDIT_RATIOS)[number] = "1:1", bestDiff = Infinity;
  for (const r of EDIT_RATIOS) {
    const [w, h] = r.split(":").map(Number);
    const diff = Math.abs(Math.log(w / h) - Math.log(a));
    if (diff < bestDiff) { best = r; bestDiff = diff; }
  }
  return best;
}

/** 把 (w,h) 的圖置中裁成 aspect 的比例：回傳要保留的區塊。 */
export function coverCrop(w: number, h: number, aspect: number): { left: number; top: number; width: number; height: number } {
  const a = clampAspect(aspect);
  if (w / h > a) {
    const width = Math.max(1, Math.round(h * a));
    return { left: Math.round((w - width) / 2), top: 0, width, height: h };
  }
  const height = Math.max(1, Math.round(w / a));
  return { left: 0, top: Math.round((h - height) / 2), width: w, height };
}

/**
 * 模型的提示詞。去背的圖要單色背景，之後去背才乾淨；兩種都不能出現文字。
 *
 * 「改這張」：原話＋寫具體的版本一起給（edit 模型是 Gemini／Seedream，看得懂中文，也不會把中文畫成字）。
 *  踩過的坑：
 *  ・直接把「換成短髮」翻成英文畫面描述，模型照著整張重畫，手上的牙刷都不見了 → 一定要是「編輯指令」。
 *  ・只給原話又一直強調「其他都別動」，「妝容再淡一點」出來跟原圖幾乎一樣 → 先把要求寫具體
 *    （口紅、腮紅、眼影各淡多少），再說「除此之外」保留。
 * 「全新生成」走 FLUX，一定要英文（中文會被畫成字），所以傳進來的是翻好的。
 */
export function buildReplacePrompt(mode: ReplaceMode, request: string, cutout: boolean, detail?: string): string {
  const tail = cutout
    ? "Show the subject alone, fully in frame, isolated on a plain seamless white background. No text, no logo, no watermark."
    : "No text, no logo, no watermark.";
  if (mode === "edit") {
    const what = detail && detail !== request ? `${detail} (The user's original words: "${request}".)` : `The user's request (may be in Chinese): "${request}".`;
    return `Edit this image. ${what} Make this change clearly visible. ` +
      "Apart from that change, keep everything else the same: the same person and face, pose, gesture and action, " +
      `anything they are holding, the framing, camera angle and photographic style. ${tail}`;
  }
  return `${request}. High quality, sharp focus, natural lighting. ${tail}`;
}

/**
 * 把一句簡短的修圖要求寫成具體、看得出差別的英文編輯指令（「妝容再淡一點」→ 口紅、腮紅、眼影各怎麼改）。
 * 沒有 key 或失敗就回傳 null，照原話送。
 */
export async function detailEditRequest(request: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === "your-openrouter-api-key-here") return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Marketing Tool" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_TEXT_MODEL ?? "openai/gpt-5.4-nano",
        max_tokens: 200,
        messages: [
          { role: "system", content: "You turn a short photo-edit request (often Traditional Chinese) into ONE clear English instruction for an image-editing model. " +
            "Make the requested change concrete and clearly visible: spell out exactly what changes and by how much. Do not add unrelated changes. " +
            "Never ask to add text. Output only the instruction, one or two sentences." },
          { role: "user", content: request },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    return out || null;
  } catch { return null; }
}

type Generated = { buffer: Buffer; contentType: string };

async function download(url: string): Promise<Generated> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`圖片下載失敗：${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

async function falPost(model: string, body: unknown, timeoutMs: number): Promise<Generated> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("缺少 FAL_KEY");
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${model} 錯誤 ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  const url = data.images?.[0]?.url ?? data.image?.url;
  if (!url) throw new Error(`${model} 沒有回傳圖片`);
  return download(url);
}

/** 全新生成：FLUX.2 pro，長寬直接照框的比例。 */
export function generateNew(prompt: string, aspect: number): Promise<Generated> {
  return falPost(process.env.FAL_FLUX2_MODEL ?? "fal-ai/flux-2-pro", {
    prompt, image_size: generationSize(aspect), output_format: "jpeg", enable_safety_checker: false,
    seed: Math.floor(Math.random() * 1_000_000_000),
  }, 120_000);
}

/**
 * 改這張：兩張都用 nano-banana-pro，一張改得明顯、一張溫和，讓使用者挑程度（兩張才不會長一樣）。
 * 實測（妝容再淡一點）：nano-banana-pro 改得最明顯、人還是同一個；nano-banana 太保守（幾乎沒變）；
 * Seedream 4.5 在 UI 實測也幾乎沒變；FLUX.2 edit 會把臉改成另一個人。
 */
export const EDIT_MODEL = "fal-ai/nano-banana-pro/edit";
const EDIT_FALLBACK = "fal-ai/nano-banana/edit";
/** 第 i 張的強度說明，接在提示詞後面。 */
export const EDIT_STRENGTHS = [
  "Apply the change strongly so the difference is obvious at a glance.",
  "Apply the change moderately so it looks natural and subtle, but still clearly noticeable.",
] as const;

/** 改這張：第 i 張用 EDIT_STRENGTHS[i] 的強度；pro 失敗就退回 nano-banana。 */
export async function editExisting(prompt: string, imageDataUri: string, aspect: number, i = 0): Promise<Generated> {
  const body = (model: string) => ({
    prompt: `${prompt} ${EDIT_STRENGTHS[i % EDIT_STRENGTHS.length]}`,
    image_urls: [imageDataUri], num_images: 1, aspect_ratio: nearestEditRatio(aspect),
  });
  try {
    return await falPost(EDIT_MODEL, body(EDIT_MODEL), 150_000);
  } catch (e) {
    console.warn(`[replace-image] ${EDIT_MODEL} failed, falling back:`, e instanceof Error ? e.message : e);
    return falPost(EDIT_FALLBACK, body(EDIT_FALLBACK), 120_000);
  }
}
