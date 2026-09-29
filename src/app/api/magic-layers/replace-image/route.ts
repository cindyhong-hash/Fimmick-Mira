/* ============================================================
   POST /api/magic-layers/replace-image
   自由畫布「AI 換圖」：選一張圖、描述想要的畫面，生成兩張讓使用者挑一張換上。
   Body: { prompt, mode: "edit"|"new", aspect (框的寬/高), cutout?, imageDataUrl? (edit 必填) }
   Returns: { variants: [{ url, width, height }] } | { error }

   會花錢（每次兩張），掛在付費閘後面，額度算「AI 換圖」。
   ============================================================ */
import { NextResponse } from "next/server";
import sharp from "sharp";
import { translateBriefToEnglishPrompt } from "@/lib/generate";
import { removeBackground } from "@/lib/fal";
import { saveBuffer } from "@/lib/storage";
import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { buildReplacePrompt, clampAspect, coverCrop, editExisting, generateNew, type ReplaceMode } from "@/lib/magic-layers/replace-image.ts";

export const maxDuration = 180;

const VARIANTS = 2;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** 生成結果 → 可以直接放回框裡的圖：去背的裁掉透明邊；其餘裁成框的比例。 */
async function finish(buffer: Buffer, aspect: number, cutout: boolean) {
  if (cutout) {
    const cut = await removeBackground(`data:image/png;base64,${(await sharp(buffer).png().toBuffer()).toString("base64")}`);
    if (!cut) throw new Error("新圖去背失敗");
    const png = await sharp(cut).png().trim({ threshold: 5 }).toBuffer();
    const m = await sharp(png).metadata();
    return { url: await saveBuffer(png, "png", "ml-replace-"), width: m.width ?? 0, height: m.height ?? 0 };
  }
  const m = await sharp(buffer).metadata();
  const crop = coverCrop(m.width ?? 1024, m.height ?? 1024, aspect);
  const jpg = await sharp(buffer).extract(crop).jpeg({ quality: 90 }).toBuffer();
  return { url: await saveBuffer(jpg, "jpg", "ml-replace-"), width: crop.width, height: crop.height };
}

export const POST = protectPaidRoute(async (request: Request) => {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "缺少 FAL_KEY（AI 換圖需要）" }, { status: 400 });
    const body = await request.json().catch(() => ({})) as { prompt?: unknown; mode?: unknown; aspect?: unknown; cutout?: unknown; imageDataUrl?: unknown };
    const typed = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 400) : "";
    if (!typed) return NextResponse.json({ error: "請描述想要的畫面" }, { status: 400 });
    const mode: ReplaceMode = body.mode === "edit" ? "edit" : "new";
    const aspect = clampAspect(Number(body.aspect));
    const cutout = body.cutout === true;

    let source: string | null = null;
    if (mode === "edit") {
      const raw = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
      if (!raw.startsWith("data:image/")) return NextResponse.json({ error: "「改這張」需要原圖" }, { status: 400 });
      const buf = Buffer.from(raw.split(",")[1] ?? "", "base64");
      if (!buf.length || buf.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: "原圖太大或讀不到" }, { status: 400 });
      // 去背的圖透明處送進模型會變黑底；先鋪白底，模型才看得出主體輪廓。
      const flat = await sharp(buf).flatten({ background: "#ffffff" }).resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      source = `data:image/jpeg;base64,${flat.toString("base64")}`;
    }

    // 全新生成（FLUX）要英文；改這張（Gemini）直接用原話，見 buildReplacePrompt 的說明。
    const ask = mode === "edit" ? typed : (await translateBriefToEnglishPrompt(typed)) || typed;
    const prompt = buildReplacePrompt(mode, ask, cutout);
    const one = async () => {
      const gen = source ? await editExisting(prompt, source, aspect) : await generateNew(prompt, aspect);
      return finish(gen.buffer, aspect, cutout);
    };
    const settled = await Promise.allSettled(Array.from({ length: VARIANTS }, one));
    const variants = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    if (!variants.length) {
      const first = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
      throw first?.reason ?? new Error("生成失敗");
    }
    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[magic-layers/replace-image] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}, { quota: dailyQuota("replace-image") });
