import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { generateImage, generateCopy, compileChineseBrief, translateBriefToEnglishPrompt, falProductShot, gptImageComposite, falImageEdit, falUpscale, type GeneratedImage } from "@/lib/generate";

const W = 1024;
const H = 1024;

async function saveBuffer(buffer: Buffer, ext: string): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

/** Load an image buffer from a local /uploads path (disk) or a remote URL. */
async function loadImageBuffer(url: string, host: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    return readFile(path.join(process.cwd(), "public", url));
  }
  const abs = url.startsWith("http") ? url : `${host}${url}`;
  const res = await fetch(abs, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`無法載入圖片：${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * POST /api/library/generate
 * Two modes:
 *  • 全 AI 生成: compile prompt from slots/subject/notes → HF image + copy
 *  • 合成 (composite): 去背產品 PNG 疊落「直接使用嘅背景圖」或「AI 生成背景」
 * Saves the result image to public/uploads and records a LibraryImage.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, subject, slots, palette, notes, seed, productImageUrl, productImageUrls, composite, customPrompt, draftOnly, size, engine, upscaleSource, overlay } = body ?? {};
    // Support 1–3 product photos. New clients send productImageUrls[]; keep productImageUrl for back-compat.
    const productUrls: string[] = (Array.isArray(productImageUrls) && productImageUrls.length
      ? productImageUrls
      : (productImageUrl ? [productImageUrl] : [])).slice(0, 3);
    const host = new URL(request.url).origin;

    // Output size: 正方形 1200×1200 or 橫向 1800×1200.
    const outW = size === "landscape" ? 1800 : 1200;
    const outH = 1200;
    const aspectRatio = size === "landscape" ? "3:2" : "1:1";
    // Force the final image to the exact target dimensions (cover) — guarantees the 2 sizes
    // regardless of what each provider returns.
    const fitToSize = async (buf: Buffer) =>
      sharp(buf).resize(outW, outH, { fit: "cover" }).toBuffer();

    // Overlay 主標/副標/CTA as REAL crisp text onto the (final-size) image — sidesteps blurry
    // product labels by putting the key marketing copy on as legible, correct typography.
    const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
    const wrap = (s: string, n: number) => { const o: string[] = []; for (let i = 0; i < s.length; i += n) o.push(s.slice(i, i + n)); return o; };
    const applyTextOverlay = async (buf: Buffer, copyText?: string | null): Promise<Buffer> => {
      if (!overlay?.enabled || !copyText) return buf;
      const pick = (label: string) => (copyText.match(new RegExp(label + "[：:]\\s*(.+)"))?.[1] || "").trim();
      const headline = pick("主標題") || pick("標題");
      const sub = pick("副標題");
      const cta = pick("CTA");
      if (!headline && !sub && !cta) return buf;
      const top = overlay.position === "top";
      const hF = Math.round(outW * 0.066), sF = Math.round(outW * 0.032), cF = Math.round(outW * 0.03);
      const subLines = sub ? wrap(sub, Math.max(8, Math.floor((outW * 0.86) / sF))) : [];
      const bandH = Math.round(hF * 1.5 + subLines.length * sF * 1.35 + (cta ? cF * 2.6 : 0) + outH * 0.07);
      const bandY = top ? 0 : outH - bandH;
      const grad = top
        ? `<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black" stop-opacity="0.6"/><stop offset="1" stop-color="black" stop-opacity="0"/></linearGradient>`
        : `<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity="0.62"/></linearGradient>`;
      const padX = Math.round(outW * 0.07);
      let y = (top ? Math.round(outH * 0.05) : bandY + Math.round(outH * 0.07)) + hF;
      const parts: string[] = [];
      if (headline) { parts.push(`<text x="${padX}" y="${y}" font-size="${hF}" font-weight="700" fill="white" font-family="sans-serif">${escapeXml(headline)}</text>`); y += Math.round(hF * 0.45) + sF; }
      for (const ln of subLines) { parts.push(`<text x="${padX}" y="${y}" font-size="${sF}" fill="white" fill-opacity="0.92" font-family="sans-serif">${escapeXml(ln)}</text>`); y += Math.round(sF * 1.35); }
      if (cta) { const cw = Math.round([...cta].length * cF * 1.05 + cF * 1.8); parts.push(`<rect x="${padX}" y="${y - cF}" width="${cw}" height="${Math.round(cF * 2)}" rx="${cF}" fill="white"/><text x="${padX + cw / 2}" y="${y + Math.round(cF * 0.34)}" font-size="${cF}" font-weight="700" fill="black" text-anchor="middle" font-family="sans-serif">${escapeXml(cta)}</text>`); }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}"><defs>${grad}</defs><rect x="0" y="${bandY}" width="${outW}" height="${bandH}" fill="url(#g1)"/>${parts.join("")}</svg>`;
      return sharp(buf).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
    };

    const copyInput = {
      subject,
      toneAiPrompt: slots?.tone?.aiPromptText,
      toneLabels: slots?.tone?.data?.toneLabels,
      notes,
    };

    // ── Composite mode: place 1–3 products into a scene ──
    if (composite && productUrls.length) {
      let productBuffers = await Promise.all(productUrls.map((u) => loadImageBuffer(u, host)));
      // Opt-in 源圖高清化: faithfully upscale low-res product photos before compositing.
      if (upscaleSource) {
        try {
          productBuffers = await Promise.all(productBuffers.map(async (b) =>
            falUpscale(`data:image/jpeg;base64,${(await sharp(b).jpeg({ quality: 92 }).toBuffer()).toString("base64")}`)));
        } catch (e) {
          console.error("[composite] source upscale failed, using originals:", e instanceof Error ? e.message : e);
        }
      }
      const product = productBuffers[0]; // first product — used by single-product fallbacks (Bria/sharp)
      const bgImageUrl = slots?.background?.data?.imageUrl as string | undefined;

      // Keep the user's original Traditional-Chinese brief for storage/display; translate a separate
      // English copy only to feed the image model (which works best in English).
      const sceneCn = compileChineseBrief({
        compositionDesc: (slots?.layout?.data?.description as string) || slots?.layout?.aiPromptText,
        backgroundDesc: bgImageUrl ? (slots?.background?.name as string | undefined) : undefined,
        toneLabels: slots?.tone?.data?.toneLabels,
        palette,
        notes,
      }) || "簡潔專業棚拍背景、柔光";
      const sceneEn = await translateBriefToEnglishPrompt(sceneCn);

      // Shared inputs as DOWNSCALED JPEG data URIs (≤1024px). Re-encoding a product photo to PNG
      // bloats it to several MB and made the multi-image GPT request time out — JPEG keeps the
      // payload small so the model responds in seconds.
      const toJpegUri = async (buf: Buffer) =>
        `data:image/jpeg;base64,${(await sharp(buf)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()).toString("base64")}`;
      const productDataUris = await Promise.all(productBuffers.map(toJpegUri));
      const productDataUri = productDataUris[0]; // first product — for single-image engines (GPT/Bria)
      // With 3 products, feeding the background as a 4th image overloads the model — use it as
      // TEXT only (its name is already folded into sceneEn via backgroundDesc).
      let refImageDataUri: string | undefined;
      if (bgImageUrl && productUrls.length < 3) {
        refImageDataUri = await toJpegUri(await loadImageBuffer(bgImageUrl, host));
      }

      // Higher-res product (2048) for Bria — more label detail = sharper text.
      const toJpegUriHi = async (buf: Buffer) =>
        `data:image/jpeg;base64,${(await sharp(buf).resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()).toString("base64")}`;

      // Persist a composite result + return the API response.
      const saveComposite = async (img: GeneratedImage, mode: string, promptStr: string, copyText: string | null) => {
        const sized = await applyTextOverlay(await fitToSize(img.buffer), copyText);
        const ext = overlay?.enabled ? "png" : (img.contentType.includes("webp") ? "webp" : img.contentType.includes("jpeg") ? "jpg" : "png");
        const imageUrl = await saveBuffer(sized, ext);
        const row = await db.libraryImage.create({
          data: {
            clientId: clientId ?? null,
            imageUrl,
            prompt: promptStr,
            copyText: copyText || null,
            subject: subject ?? null,
            paramsJson: JSON.stringify({ slots, palette, notes, productImageUrl: productUrls[0], productImageUrls: productUrls, composite: true, mode }),
          },
        });
        return NextResponse.json({ id: row.id, imageUrl, copyText, mode: `ai-composite-${mode}` });
      };

      // ── Text-preserving mode: Bria product-shot (single product only) — keeps the REAL product
      //    (label/Chinese intact), natural placement, clean matte. Multi-product is blocked in the UI. ──
      // ── Engine selection (user-chosen via 合成方式): try the chosen primary, then fall back. ──
      //   • nano  — fal nano-banana (natural, multi-product; may garble text)
      //   • bria  — Bria product-shot (keeps real product/text; single product)
      //   • gpt   — GPT-5.4 image 2 (testing; single product)
      const tryNano = async () => {
        const [img, copy] = await Promise.all([
          falImageEdit({ productDataUris, refImageDataUri, sceneDescription: sceneEn, aspectRatio }),
          generateCopy(copyInput),
        ]);
        return saveComposite(img, "fal-edit", `[AI 合成] ${sceneCn}`, copy.copyText);
      };
      const tryGpt = async () => {
        const [img, copy] = await Promise.all([
          gptImageComposite({ productDataUri, sceneDescription: sceneEn, aspectRatio }),
          generateCopy(copyInput),
        ]);
        return saveComposite(img, "gpt-image", `[AI 合成] ${sceneCn}`, copy.copyText);
      };
      const tryBria = async () => {
        const [img, copy] = await Promise.all([
          falProductShot({ productDataUri: await toJpegUriHi(productBuffers[0]), refImageDataUri, sceneDescription: bgImageUrl ? undefined : sceneEn }),
          generateCopy(copyInput),
        ]);
        return saveComposite(img, "bria-preserve", `[保留文字合成] ${sceneCn}`, copy.copyText);
      };
      // ╔══════════════════════════════════════════════════════════════════════════════════╗
      // ║ 手動改「AI 生圖引擎排序」就改呢個 `order`。                                          ║
      // ║ ────────────────────────────────────────────────────────────────────────────────  ║
      // ║ • 每一行係一個 engine 選擇對應嘅「嘗試次序」(array)。                                ║
      // ║   第 1 個 = 主力；失敗（出錯／timeout）就順序試下一個；全部失敗先去下面 sharp 疊圖。 ║
      // ║ • 三個可用嘗試：tryNano（nano-banana）、tryBria（Bria 保留文字）、tryGpt（GPT image）。║
      // ║                                                                                     ║
      // ║ 例：想 nano-banana 永遠優先、GPT 永不參與 → 全部改成 [tryNano, tryBria]。            ║
      // ║ 例：想預設改用 Bria → 把最後一行（else 分支）改成 [tryBria, tryNano, tryGpt]。       ║
      // ║ 例：加一個新引擎 → 喺上面寫多個 tryXXX() helper，再加入呢度嘅 array。                ║
      // ║ 注意：tryBria / tryGpt 係「單圖」引擎（只用 productBuffers[0]），多產品時 UI 已禁用； ║
      // ║       但佢哋仍可做 fallback（只會用第一件產品）。詳見 docs/AI-ENGINES.md。           ║
      // ╚══════════════════════════════════════════════════════════════════════════════════╝
      const order = engine === "bria" ? [tryBria, tryNano, tryGpt]
        : engine === "gpt" ? [tryGpt, tryNano, tryBria]
        : [tryNano, tryGpt, tryBria];   // 預設（engine 未指定 / "nano"）：nano-banana 行先
      for (const attempt of order) {
        try { return await attempt(); }
        catch (e) { console.error("[composite] engine attempt failed, trying next:", e instanceof Error ? e.message : e); }
      }

      // ── Fallback: mechanical sharp overlay (needs a transparent PNG) ──
      const meta = await sharp(product).metadata();
      if (!meta.hasAlpha) {
        return NextResponse.json(
          { error: "AI 合成失敗，且產品圖唔係透明去背圖。請先去背（remove.bg / photoroom）再上傳，或重試。" },
          { status: 400 },
        );
      }
      let backdrop: Buffer;
      let bgPrompt = "";
      if (bgImageUrl) {
        backdrop = await loadImageBuffer(bgImageUrl, host);
      } else {
        bgPrompt = sceneEn;
        const bgImg = await generateImage({ prompt: bgPrompt, seed });
        backdrop = bgImg.buffer;
      }
      const [bg, prodResized, copy] = await Promise.all([
        sharp(backdrop).resize(W, H, { fit: "cover" }).toBuffer(),
        sharp(product).resize({ width: Math.round(W * 0.62), height: Math.round(H * 0.62), fit: "inside" }).png().toBuffer(),
        generateCopy(copyInput),
      ]);
      const pm = await sharp(prodResized).metadata();
      const left = Math.round((W - (pm.width ?? 0)) / 2);
      const top = Math.round((H - (pm.height ?? 0)) / 2);
      const out = await sharp(bg).composite([{ input: prodResized, left, top }]).png().toBuffer();
      const imageUrl = await saveBuffer(await applyTextOverlay(await fitToSize(out), copy.copyText), "png");
      const row = await db.libraryImage.create({
        data: {
          clientId: clientId ?? null,
          imageUrl,
          prompt: `[疊圖] ${sceneCn}`,
          copyText: copy.copyText || null,
          subject: subject ?? null,
          paramsJson: JSON.stringify({ slots, palette, notes, seed, productImageUrl: productUrls[0], productImageUrls: productUrls, composite: true, mode: "sharp" }),
        },
      });
      return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, mode: "composite-sharp" });
    }

    // ── Full AI generation (Chinese-first) ──
    // The composer sends a Traditional-Chinese design brief as `customPrompt`. If absent,
    // build one from the slots. Then translate it to an optimized English prompt for FLUX.
    const brief = (customPrompt as string | undefined)?.trim() || compileChineseBrief({
      subject,
      compositionDesc: (slots?.layout?.data?.description as string) || slots?.layout?.aiPromptText,
      backgroundDesc: (slots?.background?.data?.description as string) || slots?.background?.aiPromptText,
      toneLabels: slots?.tone?.data?.toneLabels,
      palette,
      notes,
    });

    if (!brief.trim()) {
      return NextResponse.json({ error: "請至少選一個積木、輸入主體，或上傳產品圖" }, { status: 400 });
    }

    // Chinese brief → optimized English FLUX prompt (falls back to brief if no API key).
    const prompt = await translateBriefToEnglishPrompt(brief);

    const [img] = await Promise.all([generateImage({ prompt, seed, width: outW, height: outH })]);
    const ext = img.contentType.includes("png") ? "png" : img.contentType.includes("webp") ? "webp" : "jpg";
    const fitted = await fitToSize(img.buffer);

    // draftOnly: just save the file (no overlay, no DB record) — used for 背景生成 previews.
    if (draftOnly) {
      return NextResponse.json({ imageUrl: await saveBuffer(fitted, ext), seed: img.seed });
    }

    const copy = await generateCopy(copyInput);
    const imageUrl = await saveBuffer(await applyTextOverlay(fitted, copy.copyText), overlay?.enabled ? "png" : ext);
    const row = await db.libraryImage.create({
      data: {
        clientId: clientId ?? null,
        imageUrl,
        // Store the Chinese brief as the human-facing prompt; keep the English render prompt too.
        prompt: brief,
        copyText: copy.copyText || null,
        subject: subject ?? null,
        paramsJson: JSON.stringify({ slots, palette, notes, seed: img.seed, brief, enPrompt: prompt, mode: "flux" }),
      },
    });

    return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, prompt: brief, enPrompt: prompt, seed: img.seed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[library/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
