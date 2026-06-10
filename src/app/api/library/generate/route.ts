import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { generateImage, generateCopy, compileChineseBrief, translateBriefToEnglishPrompt, falProductShot } from "@/lib/generate";

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
    const { clientId, subject, slots, palette, notes, seed, productImageUrl, composite, customPrompt, draftOnly } = body ?? {};
    const host = new URL(request.url).origin;

    const copyInput = {
      subject,
      toneAiPrompt: slots?.tone?.aiPromptText,
      toneLabels: slots?.tone?.data?.toneLabels,
      notes,
    };

    // ── Composite mode: place a product into a scene ──
    if (composite && productImageUrl) {
      const product = await loadImageBuffer(productImageUrl, host);
      const bgImageUrl = slots?.background?.data?.imageUrl as string | undefined;

      // Scene description (English) used when there is no reference background image.
      const sceneEn = await translateBriefToEnglishPrompt(
        compileChineseBrief({
          compositionDesc: (slots?.layout?.data?.description as string) || slots?.layout?.aiPromptText,
          toneLabels: slots?.tone?.data?.toneLabels,
          palette,
          notes,
        }) || "簡潔專業棚拍背景、柔光",
      );

      // ── Primary: AI compositing via Bria Product Shot (relit, blended) ──
      try {
        const productPng = await sharp(product).png().toBuffer();
        const productDataUri = `data:image/png;base64,${productPng.toString("base64")}`;
        let refImageDataUri: string | undefined;
        if (bgImageUrl) {
          const bgBuf = await loadImageBuffer(bgImageUrl, host);
          const bgJpg = await sharp(bgBuf).jpeg({ quality: 90 }).toBuffer();
          refImageDataUri = `data:image/jpeg;base64,${bgJpg.toString("base64")}`;
        }
        const [img, copy] = await Promise.all([
          falProductShot({ productDataUri, refImageDataUri, sceneDescription: bgImageUrl ? undefined : sceneEn }),
          generateCopy(copyInput),
        ]);
        const ext = img.contentType.includes("webp") ? "webp" : img.contentType.includes("jpeg") ? "jpg" : "png";
        const imageUrl = await saveBuffer(img.buffer, ext);
        const row = await db.libraryImage.create({
          data: {
            clientId: clientId ?? null,
            imageUrl,
            prompt: bgImageUrl ? `[AI 合成 over ${bgImageUrl}]` : `[AI 合成] ${sceneEn}`,
            copyText: copy.copyText || null,
            subject: subject ?? null,
            paramsJson: JSON.stringify({ slots, palette, notes, productImageUrl, composite: true, mode: "bria" }),
          },
        });
        return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, mode: "ai-composite" });
      } catch (e) {
        console.error("[composite] Bria failed, falling back to sharp overlay:", e instanceof Error ? e.message : e);
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
      const imageUrl = await saveBuffer(out, "png");
      const row = await db.libraryImage.create({
        data: {
          clientId: clientId ?? null,
          imageUrl,
          prompt: bgImageUrl ? `[疊圖 over ${bgImageUrl}]` : bgPrompt,
          copyText: copy.copyText || null,
          subject: subject ?? null,
          paramsJson: JSON.stringify({ slots, palette, notes, seed, productImageUrl, composite: true, mode: "sharp" }),
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

    const [img] = await Promise.all([generateImage({ prompt, seed })]);
    const ext = img.contentType.includes("png") ? "png" : img.contentType.includes("webp") ? "webp" : "jpg";
    const imageUrl = await saveBuffer(img.buffer, ext);

    // draftOnly: just save the file, no DB record (for GenerateAssetModal preview)
    if (draftOnly) {
      return NextResponse.json({ imageUrl, seed: img.seed });
    }

    const copy = await generateCopy(copyInput);
    const row = await db.libraryImage.create({
      data: {
        clientId: clientId ?? null,
        imageUrl,
        // Store the Chinese brief as the human-facing prompt; keep the English render prompt too.
        prompt: brief,
        copyText: copy.copyText || null,
        subject: subject ?? null,
        paramsJson: JSON.stringify({ slots, palette, notes, seed: img.seed, brief, enPrompt: prompt }),
      },
    });

    return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, prompt: brief, enPrompt: prompt, seed: img.seed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[library/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
