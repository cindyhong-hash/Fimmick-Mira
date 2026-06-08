import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { generateImage, generateCopy, compileImagePrompt } from "@/lib/generate";

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
    const { clientId, subject, slots, palette, notes, seed, productImageUrl, composite } = body ?? {};
    const host = new URL(request.url).origin;

    const copyInput = {
      subject,
      toneAiPrompt: slots?.tone?.aiPromptText,
      toneLabels: slots?.tone?.data?.toneLabels,
      notes,
    };

    // ── Composite mode: real product cutout over a backdrop ──
    if (composite && productImageUrl) {
      const product = await loadImageBuffer(productImageUrl, host);
      const meta = await sharp(product).metadata();
      if (!meta.hasAlpha) {
        return NextResponse.json(
          { error: "產品圖唔係透明去背圖。請先用去背工具（remove.bg / photoroom）去背後再上傳。" },
          { status: 400 },
        );
      }

      // Backdrop: directly-used background image, else AI-generated background.
      const bgImageUrl = slots?.background?.data?.imageUrl as string | undefined;
      let backdrop: Buffer;
      let bgPrompt = "";
      if (bgImageUrl) {
        backdrop = await loadImageBuffer(bgImageUrl, host);
      } else {
        bgPrompt = compileImagePrompt({
          subject: "empty background scene, no product",
          layoutPrompt: slots?.layout?.aiPromptText,
          colorPrompt: slots?.color?.aiPromptText,
          backgroundPrompt: slots?.background?.aiPromptText,
          palette,
          notes,
        });
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
          prompt: bgImageUrl ? `[composite over ${bgImageUrl}]` : bgPrompt,
          copyText: copy.copyText || null,
          subject: subject ?? null,
          paramsJson: JSON.stringify({ slots, palette, notes, seed, productImageUrl, composite: true }),
        },
      });
      return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, mode: "composite" });
    }

    // ── Full AI generation ──
    const prompt = compileImagePrompt({
      subject,
      layoutPrompt: slots?.layout?.aiPromptText,
      colorPrompt: slots?.color?.aiPromptText,
      tonePrompt: slots?.tone?.aiPromptText,
      backgroundPrompt: slots?.background?.aiPromptText,
      palette,
      notes,
    });

    if (!prompt.replace(/high quality marketing visual.*/, "").trim()) {
      return NextResponse.json({ error: "請至少選一個積木、輸入主體，或上傳產品圖" }, { status: 400 });
    }

    const [img, copy] = await Promise.all([generateImage({ prompt, seed }), generateCopy(copyInput)]);

    const ext = img.contentType.includes("png") ? "png" : img.contentType.includes("webp") ? "webp" : "jpg";
    const imageUrl = await saveBuffer(img.buffer, ext);

    const row = await db.libraryImage.create({
      data: {
        clientId: clientId ?? null,
        imageUrl,
        prompt,
        copyText: copy.copyText || null,
        subject: subject ?? null,
        paramsJson: JSON.stringify({ slots, palette, notes, seed: img.seed }),
      },
    });

    return NextResponse.json({ id: row.id, imageUrl, copyText: copy.copyText, prompt, seed: img.seed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[library/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
