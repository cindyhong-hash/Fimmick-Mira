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
  productImageUrls?: string[],
  /** 版型類型：只輸出對應 Layout 的規則，避免三套規則互相干擾 */
  layoutType?: "A" | "B" | "C",
  /** 圖片比例（如 "9:16"）：透過 image_config.aspect_ratio 控制 Gemini 輸出尺寸 */
  aspectRatio?: string,
  /** 模型覆寫：不傳則用預設 IMAGE_MODEL（Gemini 3 Pro Image） */
  modelOverride?: string
): Promise<string> {
  const model = modelOverride || IMAGE_MODEL;
  const fallback = `https://picsum.photos/seed/${seed ?? "default"}/1024/1024`;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("[openrouter] No OPENROUTER_API_KEY — using placeholder");
    return fallback;
  }

  console.log(`[openrouter] Generating with ${model}…`);

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

    // 多圖模式：即使有產品圖，也允許帶入 styleReferenceImages 作為視覺錨點
    // 產品圖放前面（告訴 Gemini 產品長什麼樣），風格參考放後面（告訴 Gemini 整體視覺要像什麼）
    const refs = baseImageUrl
      ? []
      : (styleReferenceImages ?? []).slice(0, 2);  // 最多 2 張視覺錨點（hero 色調字體 + 第一張副圖版面）
    if (!baseImageUrl && refs.length > 0) {
      for (const refUrl of refs) {
        const dataUrl = await toBase64DataUrl(refUrl);
        if (dataUrl) {
          contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
          console.log("[openrouter] Added style reference (visual anchor)");
        }
      }
    }

    // 當 prompt 已包含完整指令（如 isStyleRef 模式），不加 editPrefix 避免干擾
    const editPrefix = (baseImageUrl && !prompt.includes("IMAGE 1"))
      ? "You are given an existing advertisement image. Modify it as instructed:\n\n"
      : "";

    const productCount = productImageUrls?.length ?? 0;

    // Layout A 規則：有產品圖時直接畫產品進去，沒產品圖才保留空白右側
    const layoutAProductRule = hasProductImages
      ? `**Layout A (Product Hero):**
- Center or slightly right-heavy composition with ALL ${productCount} product(s) as the hero
- Products arranged naturally on a clean surface: if multiple products, slight height variation and overlapping bases; if single product, centered with breathing room
- Left 40% = typography zone. The contrast for text comes from the NATURAL scene (a softly-lit wall, out-of-focus background, gentle vignette) — NOT from a solid color rectangle or flat panel pasted behind the text
- Right 50% = ALL ${productCount} product(s) placed on a clean surface (marble counter, stone platform), clearly visible and not cropped
- One consistent light source, cast shadows matching the surface
- The entire frame must read as ONE continuous photograph — no abrupt color-block edges anywhere`
      : `**Layout A (Product Hero):**
- Dead center or right-heavy composition, symmetrical balance, clean studio-adjacent background
- Left 45% = typography zone (pre-darkened/vignette naturally by scene lighting)
- RIGHT 45% = STRICTLY EMPTY flat surface — marble counter, wooden shelf, stone platform
- This right zone must look like a product photography surface, naturally lit, with subtle surface texture
- ABSOLUTELY NO product, bottle, object, or prop in the right zone`;

    // Layout B 規則：有產品圖時產品須出現在右側動態場景，沒產品圖才禁止產品
    const layoutBProductRule = hasProductImages
      ? `**Layout B (High Impact):**
- Dynamic, asymmetric, high-contrast composition with strong visual impact
- Left 45% = large bold typography. Achieve text contrast through dramatic scene lighting and shadow falloff (a naturally darker, shadowed part of the SAME scene) — NOT a solid color block, flat panel, or pasted-on colored rectangle behind the text
- Right 45% = ALL ${productCount} product(s) as the hero, shown at a dynamic 3/4 angle with dramatic side lighting and bold cast shadows
- Products must all be clearly visible and identifiable — do NOT crop or omit any product
- Optional: a hand/arm in motion interacting with the product, but the product packaging must stay fully visible
- The whole image is ONE continuous photographic scene with consistent lighting — no hard color-block edges dividing the frame
- Energy: kinetic and confident, like a Nike or Shiseido ULTIMUNE campaign`
      : `**Layout B (High Impact):**
- Dynamic composition, high contrast shadow, strong visual impact
- May include a hand, arm, or body part in action (applying product, water splashing) — but NO product bottle
- Left 45% = large bold typography taking up 35-40% of image height
- RIGHT 40% = empty surface or action scene without identifiable product packaging
- ABSOLUTELY NO product bottle or packaging in right zone`;

    // Layout C 規則：有產品時強調單一連貫場景，避免上下拼接感
    const layoutCProductRule = hasProductImages
      ? `**Layout C (Atmospheric Editorial):**
- ONE unified scene with consistent lighting, perspective, and color grading throughout the ENTIRE image — NO split backgrounds, NO patchwork compositions
- Camera angle: slightly elevated (15-25°), looking down at products on a textured surface (stone, marble, or weathered wood)
- The background behind and above the products naturally blurs into heavy bokeh — this bokeh zone at the top 40% of the frame IS the negative space for typography
- ALL ${productCount} product(s) placed in the lower-center or lower-right of the frame, resting naturally on the surface with cast shadows
- Lifestyle elements (flowers, leaves, branches) arranged AROUND the products in the same scene plane, same light source
- The entire image has ONE consistent light source (e.g. warm side light from the left) — shadows, highlights, and color temperature must match across all elements
- DO NOT create a separate sky/background panel above and a separate product table below — it must feel like ONE photograph taken from a single camera position`
      : `**Layout C (Atmospheric Editorial):**
- Rule of thirds, 50% negative space for typography in upper-left zone
- Cinematic atmosphere, heavy background bokeh, lifestyle props (flowers, towel, plant) are OK
- Lower-right 35% = clean surface where product will be placed in post-production
- ABSOLUTELY NO product bottle in the scene`;

    // 根據 layoutType 只輸出當前 Layout 的規則，避免三套規則互相干擾
    // layoutType 未傳入時才輸出全部（向下相容）
    const activeLayoutRule = layoutType === "A" ? layoutAProductRule
      : layoutType === "B" ? layoutBProductRule
      : layoutType === "C" ? layoutCProductRule
      : `${layoutAProductRule}\n\n${layoutBProductRule}\n\n${layoutCProductRule}`;

    // 有產品圖時不全面禁止產品出現，productPrefix 已有詳細規則
    const criticalProhibition = (hasProductImages)
      ? ``
      : `## CRITICAL PROHIBITION:
DO NOT place any product bottle, skincare container, pump dispenser, or packaging in this image.
The right/lower zone must be completely empty — a beautiful, naturally-lit surface awaiting post-production product compositing.
If you add any product or container, this output is REJECTED and must be regenerated.`;

    // 加入 prompt（文字燒入模式時加入設計師身份指令）
    const systemPrefix = useTextOverlay
      ? `You are a world-class commercial art director and photographer specializing in Asian beauty/lifestyle advertising. Your aesthetic references: Aesop, Jo Malone, SK-II, Shiseido campaign imagery.

## YOUR CORE AESTHETIC PRINCIPLES:

**Commercial Lighting (NOT flat/even light):**
- Beauty/skincare products: soft diffused window light from upper-left, warm golden hour tone, subtle rim light on product right edge
- Create depth through light falloff — bright subject, gradually darker toward edges

**Texture Realism (photographic, not AI-rendered):**
- Surfaces: marble grain visible under gloss, fabric micro-texture, each material rendered with its own true finish (matte stays matte, glossy stays glossy)
- Describe as if directing a real photographer: "captured on 85mm f/1.4, natural window light, shot on Phase One medium format"
- NEVER use: "ultra realistic", "hyperdetailed", "8K" — these trigger AI plasticity

**Editorial Negative Space:**
- MANDATORY: Reserve 40-50% of the frame as clean negative space for typography
- This space must be part of the scene's natural composition (a wall, a counter surface edge, an out-of-focus background zone) — NOT artificially blank

**Typography Integration (the most critical element):**
The text IS the ad — treat it as a core design element, not a label slapped on the image.

DESIGN PRINCIPLE: Every generation should feel visually distinct. Vary your approach:
- Try LARGE single-character decorative element (書、純、夏) behind the text at 8% opacity as texture
- Or split the headline into TWO weight contrasts: one word ultra-bold, the rest light/thin
- Or use a vertical text accent bar (2px colored line) on the left edge of the text block
- Or let the headline letters partially overlap the product for depth

HIERARCHY: Headline dominant (60-70% of text area height). Subtitle restrained — never compete with headline.

COLOR STRATEGY — choose based on what creates the strongest contrast with the background:
- Scene with warm stone/earth tones → white headline with warm amber or gold subtitle
- Scene with cool/blue tones → cream or warm white with thin subtitle
- Dark dramatic scene → bright white headline, colored accent on subtitle only
- Never use black text unless the entire background is pure white

LAYOUT VARIATION — pick ONE per generation, do not repeat the same layout:
Option 1: Left-aligned stacked, headline breaks into 2 lines naturally
Option 2: Large single headline word, subtitle on a separate visual plane (lower, smaller, different weight)
Option 3: Headline centered vertically on the text zone, subtitle below with generous spacing

BREATHING ROOM: Text never touches the frame edge. Padding = at least 8% of image width.

TEXT CONTAINMENT (CRITICAL): If you draw ANY text inside a box, card, banner, pill, or container, EVERY character must stay FULLY INSIDE that container with comfortable padding on all sides — text must NEVER touch, cross, or spill past the container edge. If the text is too long for the container, make the text smaller or make the container larger so it fits; do NOT let it overflow.

NEVER COVER THE SUBJECT (CRITICAL): Text, headlines, badges, pills, and any container/frame must NOT overlap, cover, or sit on top of the product or any person/face/body. Place ALL text and frames only in the empty negative space of the scene (sky, wall, table surface, out-of-focus background). If there is not enough empty space, shrink the text or move it — but keep the product and people fully visible and unobstructed. The text must sit where it is easiest to read (strong contrast, calm background).

NO OVERLAPPING / DUPLICATE TEXT (CRITICAL): Every piece of text appears EXACTLY ONCE. Do NOT stack, repeat, echo, or shadow the headline or any word behind/over itself. Text blocks must not overlap each other — keep clear spacing between headline, subtitle, and any label.

LOGO SPACE (CRITICAL): Keep the TOP-RIGHT corner (roughly the top-right 22% width × 14% height) completely EMPTY and clean — no product, no person, no text — because a real brand logo will be composited there afterward. Also, do NOT draw or render any brand logo, wordmark, or free-floating brand-name text as a design element anywhere in the image (the real logo is added separately; drawing your own causes duplicates). The product's own printed label on its packaging stays as-is — that is fine.

**MULTI-CELL CAROUSEL TYPOGRAPHY TEMPLATE (follow this structure every cell):**
Pick ONE of these layouts per cell — vary across cells but stay within this system:

Layout Option 1 — "Bold Statement":
  [ICON or thin rule 1px]
  [HEADLINE — 2-4 characters, ultra-bold, 60-70% of text zone height]
  [thin horizontal rule]
  [SUBTITLE — 1 line, light weight, 30% opacity contrast]
  Position: left-aligned, left 40% of image

Layout Option 2 — "Product Feature Card":
  [BRAND/PRODUCT NAME — small caps, tracking +200]
  [FEATURE LINE 1 — bold, large]
  [FEATURE LINE 2 — regular, smaller]
  [BADGE — pill shape, contrasting color, price or CTA]
  Position: right-aligned, upper or lower third

Layout Option 3 — "Lifestyle Caption":
  [SCENE HEADLINE — italic or thin weight, 2 lines max]
  [CTA or tag line — small, letter-spaced]
  Position: centered, bottom third with gradient overlay

NEVER: floating text with no visual anchor, text touching the edge, all caps on subtitle if headline is also all caps.

CRITICAL: If a headline text is already burned into the image via the prompt's headline parameter, do NOT generate that same text again anywhere else in the scene. Each text element must appear exactly ONCE.

## LAYOUT-SPECIFIC RULES:

${activeLayoutRule}

${criticalProhibition}

\n\n`
      : "";
    const productPrefix = hasProductImages
      ? `PRODUCT IDENTITY — CRITICAL RULES:
The ${productCount} image(s) sent above show the EXACT physical product(s) to feature in this advertisement. Use them as the primary visual ground truth.

## WHAT YOU ARE FREE TO DO (creative latitude):
- Change the camera angle: show the product from a 3/4 view, slight tilt, top-down, or low angle
- Change the lighting direction and quality (dramatic side light, soft window light, rim light) — but keep it consistent, even studio-quality lighting so color judgments stay reliable
- Show the product rotated up to 45° for a more dynamic composition
- Slightly adjust scale or position to fit the layout composition
- Add natural reflections, cast shadows, or surface gloss consistent with the scene and the product's actual material
- Change props or lifestyle elements around the product (towels, flowers, bags)

DO NOT: Add any product, bottle, lotion, or item that does not appear in the reference images. The ONLY product(s) allowed in this image are the exact ones shown in the reference photo(s). If you add any additional product not in the reference, this output is REJECTED.

## WHAT YOU MUST NEVER CHANGE (brand identity — non-negotiable):
1. BRAND NAME & LOGO: The brand name and logo on the label must be legible and IDENTICAL to the reference — exact spelling, exact characters. Do NOT invent, replace, paraphrase, or omit the brand name.
2. OVERALL SILHOUETTE: The bottle/packaging shape (tall vs. short, wide vs. narrow, round vs. angular) must match. Do NOT change proportions by more than 10%.
3. COLOR PALETTE (ALL colors, not just primary): Match every color visible on the packaging — primary color, secondary/accent colors, and any gradient transitions. If the reference shows a two-tone design or a gradient (e.g. pink fading to white), reproduce the SAME color stops in the SAME positions. Do NOT simplify a gradient into a flat color, and do NOT simplify a two-tone design into a single color. Judge color under neutral, even studio lighting so shadows/warm light don't get mistaken for a color shift.
4. CAP / PUMP / CLOSURE TYPE: If the reference shows a pump dispenser, show a pump — not a cap. Match the closure type, color, and material exactly.
5. PRODUCT COUNT: Show exactly ${productCount} product(s) — the same number as in the reference images. No additional products in foreground, background, or reflections.
6. MATERIAL & SURFACE FINISH: Match the exact material appearance of the reference — glass vs. plastic vs. metal, and glossy vs. matte vs. frosted/satin finish. A glossy glass bottle must stay glossy glass; a matte plastic tube must stay matte plastic. Do NOT change how light interacts with the surface material.
7. SECONDARY LABEL TEXT: Beyond the brand name, preserve all other legible text elements — product name/variant, volume (e.g. "50ml"), and any tagline text — keeping the same layout, color blocks, and typography style as the reference. This text does not need to be pixel-perfect at small sizes, but must remain present, legible, and positioned in roughly the same place. Do NOT remove, blank out, or replace it with placeholder/gibberish text.

## PRIORITY (if any constraints conflict, resolve in this order):
1. Correct product count
2. Accurate closure type and silhouette
3. Brand name/logo fidelity
4. Color palette fidelity (primary + secondary + gradients)
5. Material/finish accuracy
6. Secondary label text legibility

## FAILURE CONDITIONS (output will be rejected if any of these occur):
- Any additional product, bottle, or item appears that was NOT in the reference images (e.g. adding a lotion bottle when only a razor was shown)
- Product looks like a DIFFERENT brand or a generic substitute
- Brand name / logo is missing, blurred, misspelled, or replaced
- Bottle shape is drastically different (e.g., reference is tall & slim → output is short & wide)
- Color is completely wrong, or a two-tone/gradient design is flattened into a single solid color
- Material/finish is wrong (e.g., reference is frosted matte → output is clear glossy, or vice versa)
- Secondary label text (product name, volume, tagline) is missing, blank, or replaced with unreadable text
- Fewer or more products shown than the number of reference images provided (e.g. 3 images sent → must show exactly 3 products)

Think of yourself as a commercial photographer: you choose the angle and light, but the client's product — with its exact branding — must be instantly recognizable.\n\n`
      : "";

    // 有產品圖時：明確區分「產品圖=唯一產品真相」vs「風格圖=只參考美學」，
    // 避免「以這些參考圖的視覺風格生成」這句把產品圖也當成可自由詮釋的風格素材（導致副圖產品走樣）
    const styleRefNote = hasProductImages
      ? `The LAST ${refs.length} reference image(s) are STYLE REFERENCES ONLY — match their color grade, lighting mood, and composition, but do NOT copy, borrow, or reinterpret any product appearance from them (the product in those images may already be slightly altered). The product(s) MUST exactly match the PRODUCT REFERENCE image(s) placed first — same brand, label, shape, color, material, closure. If the style reference shows a product that differs from the product references, follow the product references.`
      : `These images show the brand's visual style. Generate a new image in the SAME visual aesthetic, composition style, color grading, and atmosphere as these reference images.`;
    const fullPrompt = refs.length > 0
      ? `${productPrefix}${systemPrefix}${styleRefNote}\n\n${prompt}`
      : `${productPrefix}${editPrefix}${systemPrefix}${prompt}`;

    contentParts.push({ type: "text", text: fullPrompt });

    // 有產品圖時，在所有圖片「之前」放一段圖片角色標注（產品圖在前、風格圖在後）
    if (hasProductImages) {
      const styleRefCount = refs.length;
      const guide =
`IMAGE REFERENCE GUIDE (read before looking at images):
- Image(s) 1 to ${productCount}: PRODUCT REFERENCE — ground truth for product appearance, packaging, logo, color, silhouette. Reproduce exactly.
${styleRefCount > 0 ? `- Image(s) ${productCount + 1} onward: STYLE REFERENCE ONLY — use only for color temperature, typography style, and layout composition. Ignore the product appearance in these images.` : ""}`;
      contentParts.unshift({ type: "text", text: guide });
    }

    const content = contentParts.length === 1 ? fullPrompt : contentParts;

    // seed 內含 activityId-layoutType，作為 log 標籤
    const tag = seed ?? "default";
    const imageCount = contentParts.filter((p) => p.type === "image_url").length;
    const promptLen = fullPrompt.length;
    console.log(`[openrouter][${tag}] payload: ${imageCount} image(s), prompt ${promptLen} chars, model ${model}`);

    // 比例 → Gemini 支援的 aspect_ratio（4:5 不在原生清單，對應到最接近的 3:4）
    const GEMINI_RATIOS: Record<string, string> = {
      "1:1": "1:1", "4:3": "4:3", "3:4": "3:4", "16:9": "16:9",
      "9:16": "9:16", "3:2": "3:2", "2:3": "2:3", "21:9": "21:9",
      "4:5": "3:4",  // 4:5 → 最接近的直式
    };
    const geminiAspectRatio = aspectRatio ? GEMINI_RATIOS[aspectRatio] : undefined;
    if (aspectRatio) {
      console.log(`[openrouter][${tag}] aspect_ratio=${geminiAspectRatio ?? "(unsupported→default 1:1)"} (requested ${aspectRatio})`);
    }

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
            model,
            messages: [{ role: "user", content }],
            max_tokens: 4096,
            modalities: ["image", "text"],
            ...(geminiAspectRatio
              ? { image_config: { aspect_ratio: geminiAspectRatio } }
              : {}),
          }),
          // 逾時保護：單次呼叫超過 90 秒視為卡住 → 中止（交給重試/降級），避免整個生成無限吊住
          signal: AbortSignal.timeout(90_000),
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
