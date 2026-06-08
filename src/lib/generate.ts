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

/** In-app image: Pollinations (primary) → Hugging Face FLUX.1-schnell (fallback). */
async function generateImageInApp(input: GenerateImageInput): Promise<GeneratedImage> {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  // Try Pollinations when we have a token, or as a last resort when HF isn't set
  // either. (Anonymous Pollinations is IP-rate-limited, so skip it when HF is available.)
  const tryPollinations = Boolean(POLLINATIONS_TOKEN) || !HF_TOKEN;

  let pollErr = "";
  if (tryPollinations) {
    try {
      return await pollinationsImage(input, seed);
    } catch (e) {
      pollErr = e instanceof Error ? e.message : String(e);
      console.error("[generateImage] Pollinations failed:", pollErr);
    }
  } else {
    pollErr = "未設定 POLLINATIONS_TOKEN（已略過，直接用 Hugging Face）";
  }

  if (HF_TOKEN) {
    try {
      return await huggingFaceImage(input, seed);
    } catch (e) {
      const hfErr = e instanceof Error ? e.message : String(e);
      console.error("[generateImage] HuggingFace failed:", hfErr);
      throw new Error(`圖片生成失敗。Pollinations：${pollErr} ｜ HuggingFace：${hfErr}`);
    }
  }
  throw new Error(`Pollinations 生成失敗：${pollErr}（可在 .env.local 設定 HF_TOKEN 作為備援圖片來源）`);
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
