/**
 * OpenRouter image generation
 * Model: google/gemini-3-pro-image-preview
 *
 * Multimodal support: past post images are sent as visual style references
 * so Gemini can learn the brand's actual composition, color, and aesthetic.
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const IMAGE_MODEL = "google/gemini-3-pro-image-preview";

interface ImageItem {
  type: string;
  image_url?: { url: string };
}

interface OpenRouterResponse {
  choices?: {
    message?: {
      content: string | null;
      images?: ImageItem[];
    };
  }[];
  error?: { message: string };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function toBase64DataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;  // 已是 data URL，直接回傳
    if (url.startsWith("/")) {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      const buf = await readFile(join(process.cwd(), "public", url.replace(/^\//, "")));
      const ext = url.split(".").pop() ?? "jpeg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
    if (url.startsWith("http")) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      return `data:${ct};base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    console.warn("[openrouter] toBase64DataUrl failed:", e);
  }
  return null;
}

async function downloadAndSave(b64: string, ext: string, seed?: string): Promise<string> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = join(process.cwd(), "public/uploads");
  await mkdir(dir, { recursive: true });
  const filename = `ai-${seed ?? Date.now()}.${ext}`;
  await writeFile(join(dir, filename), Buffer.from(b64, "base64"));
  return `/uploads/${filename}`;
}

// ── main export ───────────────────────────────────────────────────────────────

export async function generateImageOpenRouter(
  prompt: string,
  seed?: string,
  /** 過往貼文圖片（最多送 2 張給 Gemini 做視覺參考） */
  styleReferenceImages?: string[],
  /** 啟用文字燒入模式：在 system 層告訴模型產出帶排版的廣告圖 */
  useTextOverlay?: boolean,
  /** 圖片編輯模式：傳入現有圖片 URL，讓 Gemini 在這張圖上做修改 */
  baseImageUrl?: string,
  /** 產品參考圖（支援多張，最多 3 張）：告訴 Gemini 廣告主角產品長什麼樣 */
  productImageUrls?: string[]
): Promise<string> {
  const fallback = `https://picsum.photos/seed/${seed ?? "default"}/1024/1024`;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("[openrouter] No OPENROUTER_API_KEY — using placeholder");
    return fallback;
  }

  console.log(`[openrouter] Generating with ${IMAGE_MODEL}…`);

  try {
    // 建立 multimodal content：先放風格參考圖，再放文字 prompt
    type ContentPart =
      | { type: "image_url"; image_url: { url: string } }
      | { type: "text"; text: string };

    const contentParts: ContentPart[] = [];

    // 圖片編輯模式：把 baseImage 放在最前面（IMAGE 1）
    if (baseImageUrl) {
      const baseDataUrl = await toBase64DataUrl(baseImageUrl);
      if (baseDataUrl) {
        contentParts.push({ type: "image_url", image_url: { url: baseDataUrl } });
        console.log("[openrouter] Added base image for editing (IMAGE 1)");
      }
      // baseImageUrl 模式下也允許加入 styleReferenceImages（IMAGE 2，風格參考）
      if (styleReferenceImages && styleReferenceImages.length > 0) {
        const refDataUrl = await toBase64DataUrl(styleReferenceImages[0]);
        if (refDataUrl) {
          contentParts.push({ type: "image_url", image_url: { url: refDataUrl } });
          console.log("[openrouter] Added style reference image alongside base image (IMAGE 2)");
        }
      }
    }

    // 產品參考圖（支援多張，最多 3 張，不與 baseImage 混用）
    const hasProductImages = !!(productImageUrls?.length && !baseImageUrl);
    if (hasProductImages) {
      const sliced = productImageUrls!.slice(0, 3);
      for (let i = 0; i < sliced.length; i++) {
        const dataUrl = await toBase64DataUrl(sliced[i]);
        if (dataUrl) {
          contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
          console.log(`[openrouter] Added product image ${i + 1}/${sliced.length}`);
        }
      }
    }

    // 加入風格參考圖（最多 2 張，不與 baseImage / productImages 混用）
    const refs = (baseImageUrl || hasProductImages)
      ? []
      : (styleReferenceImages ?? []).slice(0, 2);
    if (!baseImageUrl && !hasProductImages) {
      for (const refUrl of refs) {
        const dataUrl = await toBase64DataUrl(refUrl);
        if (dataUrl) {
          contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
          console.log("[openrouter] Added style reference image");
        }
      }
    }

    // 加入 prompt（文字燒入模式時加入設計師身份指令）
    const systemPrefix = useTextOverlay
      ? `You are a world-class art director specializing in Asian commercial advertising (Ogilvy / Dentsu / BBDO aesthetic).
Generate a PRINT-QUALITY social media advertisement image with these non-negotiable requirements:

TYPOGRAPHY INTEGRATION:
- Chinese text must be BURNED INTO the scene with physically accurate shadows matching the scene's light source
- Use bold 黑體 (Gothic) weight for headlines — NOT Arial fallback
- Text hierarchy must be immediately clear: headline dominates, subtitle supports, CTA converts
- Text must feel like it was composited by a professional designer, NOT pasted on top

PRODUCTION QUALITY:
- The image must be indistinguishable from a real photo shoot + post-production workflow
- Every surface must show real texture: fabric, skin, liquid, metal
- Lighting must be motivated — from a real direction, casting real shadows
- Color grading: cinematic and cohesive, NOT oversaturated

OUTPUT STANDARD: If a creative director at a top ad agency would reject this, regenerate.\n\n`
      : "";

    // 當 prompt 已包含完整指令（如 isStyleRef 模式），不加 editPrefix 避免干擾
    const editPrefix = (baseImageUrl && !prompt.includes("IMAGE 1"))
      ? "You are given an existing advertisement image. Modify it as instructed:\n\n"
      : "";

    const productCount = productImageUrls?.length ?? 0;
    const productPrefix = hasProductImages
      ? `The ${productCount} image(s) above are the EXACT products to feature in this advertisement. ` +
        `You MUST reproduce their appearance pixel-accurately: same shape, same packaging design, same colors, same logo, same proportions. ` +
        `Do NOT invent or generalize the product appearance. ` +
        `CRITICAL: The products in the reference images must appear EXACTLY as photographed — copy the actual packaging, not a generic version. ` +
        `Show ALL ${productCount} product(s) together in the scene.\n\n`
      : "";

    const fullPrompt = refs.length > 0
      ? `${productPrefix}${systemPrefix}These images show the brand's visual style. Generate a new image in the SAME visual aesthetic, composition style, color grading, and atmosphere as these reference images.\n\n${prompt}`
      : `${productPrefix}${editPrefix}${systemPrefix}${prompt}`;

    contentParts.push({ type: "text", text: fullPrompt });

    const content = contentParts.length === 1 ? fullPrompt : contentParts;

    // seed 內含 activityId-layoutType，作為 log 標籤
    const tag = seed ?? "default";
    const imageCount = contentParts.filter((p) => p.type === "image_url").length;
    const promptLen = fullPrompt.length;
    console.log(`[openrouter][${tag}] payload: ${imageCount} image(s), prompt ${promptLen} chars, model ${IMAGE_MODEL}`);

    // ── 重試迴圈：最多嘗試 3 次（1 次原始 + 2 次重試），失敗才降級 ──
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://marketing-tool.local",
            "X-Title": "Marketing Tool",
          },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            messages: [{ role: "user", content }],
            max_tokens: 4096,
          }),
        });

        const rawBody = await res.text();
        let data: OpenRouterResponse;
        try {
          data = JSON.parse(rawBody) as OpenRouterResponse;
        } catch {
          console.error(`[openrouter][${tag}] attempt ${attempt}/${MAX_ATTEMPTS} — non-JSON response (status ${res.status}): ${rawBody.slice(0, 500)}`);
          throw new Error("non-JSON response");
        }

        if (!res.ok || data.error) {
          console.error(
            `[openrouter][${tag}] attempt ${attempt}/${MAX_ATTEMPTS} FAILED\n` +
            `  HTTP status : ${res.status}\n` +
            `  error.message: ${data.error?.message ?? "(none)"}\n` +
            `  body        : ${rawBody.slice(0, 800)}`
          );
          throw new Error(`API error ${res.status}`);
        }

        const images = data.choices?.[0]?.message?.images ?? [];
        const b64Url = images.find((img) => img.type === "image_url")?.image_url?.url ?? "";
        const m = b64Url.match(/^data:image\/(\w+);base64,([\s\S]+)/);

        if (!m) {
          console.error(
            `[openrouter][${tag}] attempt ${attempt}/${MAX_ATTEMPTS} — no image in response.\n` +
            `  finish_reason: ${(data.choices?.[0] as { finish_reason?: string })?.finish_reason ?? "?"}\n` +
            `  text content : ${(data.choices?.[0]?.message?.content ?? "").slice(0, 300)}`
          );
          throw new Error("no image in response");
        }

        const localUrl = await downloadAndSave(m[2], m[1], seed);
        console.log(`[openrouter][${tag}] ✅ Saved (attempt ${attempt}): ${localUrl}`);
        return localUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 餘額/權限類錯誤重試也沒用，直接降級
        if (msg.includes("insufficient") || msg.includes("credit") || msg.includes("402")) {
          console.error(`[openrouter][${tag}] credit/permission error — skipping retries`);
          break;
        }
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 1500; // 1.5s, 3s 漸進延遲
          console.warn(`[openrouter][${tag}] retrying in ${delayMs}ms… (${msg})`);
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          console.error(`[openrouter][${tag}] all ${MAX_ATTEMPTS} attempts failed → fallback`);
        }
      }
    }

    return fallback;

  } catch (err) {
    console.error("[openrouter] Error:", err);
    return fallback;
  }
}
