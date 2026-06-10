/**
 * generate.ts — pluggable text + image generation
 * ─────────────────────────────────────────────────
 * One module behind which the actual provider hides. Swap providers with the
 * `GEN_PROVIDER` env var (no code change):
 *   • "inapp" (default) — OpenRouter free text model + Pollinations.ai images
 *   • "n8n"             — forwards to an n8n webhook (N8N_WEBHOOK_URL)
 *
 * Mirrors the proven OpenRouter `fetch` pattern from
 * src/app/api/components/analyze/route.ts.
 */

const PROVIDER = process.env.GEN_PROVIDER ?? "inapp";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Copy uses a cheap, reliable OpenRouter model (same family as the vision model).
const OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL ?? "openai/gpt-5.4-nano";
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
// Optional free Pollinations token (https://auth.pollinations.ai) — bypasses the
// anonymous queue/rate limit that returns HTTP 402 from shared/datacenter IPs.
const POLLINATIONS_TOKEN = process.env.POLLINATIONS_TOKEN;
// Fallback image provider: Hugging Face Inference (free token at huggingface.co/settings/tokens).
const HF_TOKEN = process.env.HF_TOKEN;
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell";
// fal.ai primary image provider (keyId:keySecret)
const FAL_KEY = process.env.FAL_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GenerateCopyInput {
  subject?: string;
  toneAiPrompt?: string | null;
  toneLabels?: string[];
  notes?: string;
  taboos?: string[];
}

export interface GenerateImageInput {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  contentType: string;
  seed: number;
}

export interface CompilePromptInput {
  subject?: string;
  layoutPrompt?: string | null;
  colorPrompt?: string | null;
  tonePrompt?: string | null;
  backgroundPrompt?: string | null;
  palette?: { hex: string; role?: string; use?: boolean }[];
  notes?: string;
}

// ─── Prompt compilation ─────────────────────────────────────────────────────

/** Build a single positive image prompt from the composer slots + palette + notes. */
export function compileImagePrompt(i: CompilePromptInput): string {
  const parts: string[] = [];
  if (i.subject?.trim()) parts.push(i.subject.trim());
  if (i.layoutPrompt) parts.push(i.layoutPrompt);
  if (i.backgroundPrompt) parts.push(`background: ${i.backgroundPrompt}`);
  if (i.colorPrompt) parts.push(i.colorPrompt);

  const usedColors = (i.palette ?? []).filter((c) => c.use !== false && c.hex);
  if (usedColors.length) {
    parts.push(`color palette: ${usedColors.map((c) => c.hex).join(" ")}`);
  }
  if (i.notes?.trim()) parts.push(i.notes.trim());

  // High-quality marketing visual hint
  parts.push("high quality marketing visual, professional, sharp focus");
  return parts.filter(Boolean).join(", ");
}

/**
 * Build a Traditional-Chinese design brief from the composer fields.
 * This is the human-authored "source of truth"; translateBriefToEnglishPrompt turns it into
 * an English prompt the image model actually understands well.
 */
export interface ChineseBriefInput {
  subject?: string;
  compositionDesc?: string | null;
  backgroundDesc?: string | null;
  toneLabels?: string[];
  palette?: { hex: string; label?: string; role?: string; use?: boolean }[];
  notes?: string;
}

export function compileChineseBrief(i: ChineseBriefInput): string {
  const lines: string[] = [];
  if (i.subject?.trim()) lines.push(`主體：${i.subject.trim()}`);
  if (i.compositionDesc?.trim()) lines.push(`構圖：${i.compositionDesc.trim()}`);
  if (i.backgroundDesc?.trim()) lines.push(`背景：${i.backgroundDesc.trim()}`);
  const used = (i.palette ?? []).filter((c) => c.use !== false && c.hex);
  if (used.length) lines.push(`配色：${used.map((c) => `${c.label ?? ""} ${c.hex}`.trim()).join("、")}`);
  if (i.toneLabels?.length) lines.push(`風格語氣：${i.toneLabels.join("、")}`);
  if (i.notes?.trim()) lines.push(`其他要求：${i.notes.trim()}`);
  return lines.join("\n");
}

/**
 * Translate a (usually Traditional-Chinese) design brief into ONE optimized English prompt for FLUX.
 * Chinese-first authoring, English output — FLUX is trained on English and renders it far better.
 * Falls back to the raw brief if no OpenRouter key (so generation still works).
 */
export async function translateBriefToEnglishPrompt(brief: string): Promise<string> {
  const text = brief.trim();
  if (!text) return "";
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "your-openrouter-api-key-here") {
    return text; // graceful fallback
  }
  const sys =
    "You are an expert prompt engineer for the FLUX text-to-image model. " +
    "You convert marketing-image design briefs (often written in Traditional Chinese) into a single, " +
    "concise, vivid ENGLISH image-generation prompt. Preserve every concrete detail: subject, composition, " +
    "background, mood, and exact color hex codes. Do NOT add people or text unless the brief asks. " +
    "Output ONLY the final English prompt — no quotes, no explanation, no line breaks.";
  const user = `Design brief:\n${text}\n\nEnglish FLUX prompt:`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Marketing Tool",
      },
      body: JSON.stringify({
        model: OPENROUTER_TEXT_MODEL,
        max_tokens: 300,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[translateBrief] OpenRouter error", res.status, await res.text().catch(() => ""));
      return text; // fallback to raw brief
    }
    const data = await res.json();
    const out = (data.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    return out || text;
  } catch (err) {
    console.error("[translateBrief] failed:", err instanceof Error ? err.message : err);
    return text;
  }
}

// ─── Copy generation ──────────────────────────────────────────────────────────

export async function generateCopy(input: GenerateCopyInput): Promise<{ copyText: string }> {
  if (PROVIDER === "n8n") return generateCopyN8n(input);
  return generateCopyInApp(input);
}

function buildCopyPrompt(i: GenerateCopyInput): string {
  return `你是一位資深社群媒體文案師。請根據以下條件，寫一段適合 Facebook / Instagram 貼文的文案。

主體 / 主題：${i.subject?.trim() || "（未指定）"}
語氣風格：${i.toneAiPrompt || i.toneLabels?.join("、") || "標準、自然"}
其他注意事項：${i.notes?.trim() || "無"}
禁忌事項：${i.taboos?.length ? i.taboos.join("、") : "無"}

請輸出（一律用繁體中文・台灣用語，不可簡體或英文）：
主標題：（10字以內）
副標題：（20-30字）
CTA：（5字以內）

只回傳文案內容，不要加任何解釋。`;
}

async function generateCopyInApp(input: GenerateCopyInput): Promise<{ copyText: string }> {
  // Graceful degradation: if no key, return empty so image generation still succeeds.
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "your-openrouter-api-key-here") {
    return { copyText: "" };
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Marketing Tool",
      },
      body: JSON.stringify({
        model: OPENROUTER_TEXT_MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: buildCopyPrompt(input) }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[generateCopy] OpenRouter error", res.status, await res.text().catch(() => ""));
      return { copyText: "" };
    }
    const data = await res.json();
    const copyText = (data.choices?.[0]?.message?.content ?? "").trim();
    return { copyText };
  } catch (err) {
    console.error("[generateCopy] failed:", err instanceof Error ? err.message : err);
    return { copyText: "" };
  }
}

async function generateCopyN8n(input: GenerateCopyInput): Promise<{ copyText: string }> {
  if (!N8N_WEBHOOK_URL) throw new Error("GEN_PROVIDER=n8n 但 N8N_WEBHOOK_URL 未設定");
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "copy", ...input }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`n8n copy webhook 錯誤 ${res.status}`);
  const data = await res.json();
  return { copyText: (data.copyText ?? "").toString() };
}

// ─── Image generation ───────────────────────────────────────────────────────

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  if (PROVIDER === "n8n") return generateImageN8n(input);
  return generateImageInApp(input);
}

/** In-app image: fal.ai (primary) → HuggingFace FLUX (fallback). */
async function generateImageInApp(input: GenerateImageInput): Promise<GeneratedImage> {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  // 1st priority: fal.ai FLUX.1-schnell
  if (FAL_KEY) {
    try {
      return await falAiImage(input, seed);
    } catch (e) {
      console.error("[generateImage] fal.ai failed:", e instanceof Error ? e.message : e);
    }
  }

  // 2nd priority: HuggingFace FLUX (素材生成 / fallback)
  if (HF_TOKEN) {
    try {
      return await huggingFaceImage(input, seed);
    } catch (e) {
      const hfErr = e instanceof Error ? e.message : String(e);
      console.error("[generateImage] HuggingFace failed:", hfErr);
      throw new Error(`圖片生成失敗（fal.ai + HuggingFace 均失敗）：${hfErr}`);
    }
  }

  // Last resort: Pollinations (only when no other provider)
  if (POLLINATIONS_TOKEN || !FAL_KEY) {
    try {
      return await pollinationsImage(input, seed);
    } catch (e) {
      throw new Error(`圖片生成失敗：${e instanceof Error ? e.message : e}`);
    }
  }

  throw new Error("請在 .env.local 設定 FAL_KEY 或 HF_TOKEN 以啟用圖片生成");
}

/**
 * AI product compositing via fal.ai Bria Product Shot (fal-ai/bria/product-shot, ~$0.04/image).
 * Places a product image into an AI-generated scene — either from a reference background image
 * (refImageDataUri) OR a text scene description. Returns the composited image.
 * Images are passed as data URIs so fal's servers don't need to reach our localhost /uploads.
 */
export interface ProductShotInput {
  productDataUri: string;        // the product cutout (data:image/png;base64,...)
  refImageDataUri?: string;      // optional reference background image
  sceneDescription?: string;     // used when no reference image (English works best)
}

export async function falProductShot(i: ProductShotInput): Promise<GeneratedImage> {
  if (!FAL_KEY) throw new Error("FAL_KEY 未設定，無法做 AI 合成");
  const body: Record<string, unknown> = {
    image_url: i.productDataUri,
    num_results: 1,
    placement_type: "original",
    sync_mode: false,
  };
  if (i.refImageDataUri) body.ref_image_url = i.refImageDataUri;
  else if (i.sceneDescription?.trim()) body.scene_description = i.sceneDescription.trim();
  else body.scene_description = "clean professional studio background, soft lighting";

  const res = await fetch("https://fal.run/fal-ai/bria/product-shot", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Bria product-shot 錯誤 ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("Bria product-shot 回應無圖片 URL");
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Bria 圖片下載失敗：${imgRes.status}`);
  const contentType = imgRes.headers.get("content-type") ?? "image/png";
  return { buffer: Buffer.from(await imgRes.arrayBuffer()), contentType, seed: 0 };
}

async function falAiImage(input: GenerateImageInput, seed: number): Promise<GeneratedImage> {
  if (!FAL_KEY) throw new Error("FAL_KEY 未設定");
  const w = input.width ?? 1024;
  const h = input.height ?? 1024;
  const imageSize = w > h ? "landscape_4_3" : h > w ? "portrait_4_3" : "square_hd";

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: input.prompt, image_size: imageSize, num_inference_steps: 4, seed, enable_safety_checker: false }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`fal.ai 錯誤 ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error("fal.ai 回應無圖片 URL");
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`fal.ai 圖片下載失敗：${imgRes.status}`);
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  return { buffer: Buffer.from(await imgRes.arrayBuffer()), contentType, seed };
}

async function pollinationsImage(input: GenerateImageInput, seed: number): Promise<GeneratedImage> {
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;
  const model = input.model ?? "flux";

  let url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(input.prompt)}` +
    `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${model}&referrer=marketing-tool`;
  if (POLLINATIONS_TOKEN) url += `&token=${encodeURIComponent(POLLINATIONS_TOKEN)}`;

  const headers: Record<string, string> = { "User-Agent": "marketing-tool/1.0" };
  if (POLLINATIONS_TOKEN) headers["Authorization"] = `Bearer ${POLLINATIONS_TOKEN}`;

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2500 * attempt);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.startsWith("image/")) {
      return { buffer: Buffer.from(await res.arrayBuffer()), contentType, seed };
    }
    lastErr = `${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`;
    if (res.status === 402 || res.status === 401) break; // hard gate — retry won't help
  }
  throw new Error(lastErr || "未知錯誤");
}

async function huggingFaceImage(input: GenerateImageInput, seed: number): Promise<GeneratedImage> {
  // HF moved serverless inference to the router host; the old api-inference host is gone.
  const url = `https://router.huggingface.co/hf-inference/models/${HF_IMAGE_MODEL}`;
  const body = JSON.stringify({
    inputs: input.prompt,
    parameters: { width: input.width ?? 1024, height: input.height ?? 1024 },
  });

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(4000 * attempt); // HF cold-start can take ~20s
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(90_000),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.startsWith("image/")) {
      return { buffer: Buffer.from(await res.arrayBuffer()), contentType, seed };
    }
    lastErr = `${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`;
    if (res.status !== 503) break; // only cold-start (503) is worth retrying
  }
  throw new Error(lastErr || "未知錯誤");
}

async function generateImageN8n(input: GenerateImageInput): Promise<GeneratedImage> {
  if (!N8N_WEBHOOK_URL) throw new Error("GEN_PROVIDER=n8n 但 N8N_WEBHOOK_URL 未設定");
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "image", ...input, seed }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`n8n image webhook 錯誤 ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  // Webhook may return raw image bytes, or JSON with {imageUrl} / {imageBase64}.
  if (contentType.startsWith("image/")) {
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType, seed };
  }
  const data = await res.json();
  if (data.imageBase64) {
    return { buffer: Buffer.from(data.imageBase64, "base64"), contentType: data.contentType ?? "image/png", seed };
  }
  if (data.imageUrl) {
    const imgRes = await fetch(data.imageUrl, { signal: AbortSignal.timeout(60_000) });
    return {
      buffer: Buffer.from(await imgRes.arrayBuffer()),
      contentType: imgRes.headers.get("content-type") ?? "image/png",
      seed,
    };
  }
  throw new Error("n8n image webhook 回應缺少 imageUrl / imageBase64");
}
