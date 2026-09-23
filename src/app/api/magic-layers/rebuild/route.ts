/* ============================================================
   POST /api/magic-layers/rebuild
   照參考圖重做：上傳一張設計圖，拆成可編輯的圖層素材。
   Body: { image: "data:image/...;base64,..." }
   Returns: RebuildResult（見 lib/magic-layers/reference-rebuild/types.ts）| { error }

   每次會打視覺模型一次、去背一次、LaMa 一到兩次（約 NT$1–2、30–60 秒），
   所以掛在付費閘後面。文字的字級與位置由瀏覽器用實際字體算（fit-text.ts）。
   ============================================================ */
import { NextResponse } from "next/server";
import { protectPaidRoute } from "@/lib/site-gate";
import { rebuildReference } from "@/lib/magic-layers/reference-rebuild/rebuild.ts";
import { rebuildServices } from "@/lib/magic-layers/reference-rebuild/services.ts";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** 瀏覽器端會先縮到 1600px 再送；這裡再擋一次，避免有人直接丟大檔。 */
const MAX_BYTES = 8 * 1024 * 1024;

export const POST = protectPaidRoute(async (request: Request) => {
  const body = await request.json().catch(() => null) as { image?: unknown } | null;
  const image = typeof body?.image === "string" ? body.image : "";
  const match = image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "請上傳 PNG、JPG 或 WebP 圖片" }, { status: 400 });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "圖片太大，請換一張 8MB 以內的圖" }, { status: 413 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("重做超過時間")), 110_000);
  try {
    const result = await rebuildReference(buffer, rebuildServices, controller.signal);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "重做失敗";
    console.error("[magic-layers/rebuild]", message);
    return NextResponse.json({ error: controller.signal.aborted ? "處理太久了，請換一張比較簡單的圖再試" : message }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
});
