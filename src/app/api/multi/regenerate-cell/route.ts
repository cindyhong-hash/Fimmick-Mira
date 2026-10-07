import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateImageOpenRouter } from "@/lib/openrouter";
import { getMultiLayout } from "@/types/multiLayout";
import { buildRegenerateCellPrompt } from "@/lib/multi-editor";

/* POST /api/multi/regenerate-cell
   { activityId, layoutType, cellIndex, cellUrl, instruction?, texts? } → { imageUrl }
   多圖微調畫布「重新生成這一格」：拿目前這格當參考，出一張畫面不同、同系列感、字一樣的新圖。
   不重跑整組的分鏡流程（那些中間結果沒存，而且一次要好幾分鐘）。 */

export const maxDuration = 120;

async function handlePost(request: Request) {
  try {
    const { activityId, layoutType, cellIndex, cellUrl, instruction, texts } = (await request.json()) as {
      activityId?: string; layoutType?: string; cellIndex?: number; cellUrl?: string; instruction?: string; texts?: string[];
    };
    if (!activityId || !cellUrl || typeof cellIndex !== "number") {
      return NextResponse.json({ error: "activityId, cellIndex, cellUrl are required" }, { status: 400 });
    }
    const activity = await db.activity.findUnique({ where: { id: activityId }, select: { imageModel: true } });
    if (!activity) return NextResponse.json({ error: "找不到這個活動" }, { status: 404 });

    // 每格生成時的比例（主圖常是橫的或直的、副圖是方的），新圖照同一個比例出，拼回去才不會被裁太多
    const aspect = getMultiLayout(layoutType ?? "")?.cellAspects[cellIndex] ?? "1:1";
    const model = activity.imageModel && !activity.imageModel.startsWith("fal-ai/") ? activity.imageModel : undefined;
    const prompt = buildRegenerateCellPrompt({
      texts: Array.isArray(texts) ? texts.filter((t) => typeof t === "string").slice(0, 12) : undefined,
      instruction: typeof instruction === "string" ? instruction.slice(0, 300) : undefined,
    });
    const imageUrl = await generateImageOpenRouter(prompt, `regen-${activityId}-${cellIndex}-${Date.now()}`, undefined, false, cellUrl, undefined, undefined, aspect, model);
    if (imageUrl.includes("picsum.photos")) throw new Error("生圖服務沒有回應");
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("[POST /api/multi/regenerate-cell]", err);
    return NextResponse.json({ error: "重新生成失敗，請稍後再試" }, { status: 500 });
  }
}

// 會花 AI 費用：跟「AI 生成圖文」共用每日上限
export const POST = protectPaidRoute(handlePost, { quota: dailyQuota("generate") });
