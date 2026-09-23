/* ============================================================
   /api/magic-layers/templates

   自由畫布的共用範本庫。範本存在 StyleComponent（type = CANVAS_TEMPLATE、
   clientId = null＝所有品牌共用），不另開 model，就不用對遠端 Turso 跑遷移。

   GET  列出全部範本（不含 layers，列表不需要，省頻寬）
   POST 把一份畫布存成範本
   ============================================================ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveBuffer } from "@/lib/storage";
import {
  CANVAS_TEMPLATE_TYPE,
  parseCanvasTemplatePayload,
  rowToCanvasTemplate,
} from "@/lib/magic-layers/canvas-template";
import { builtinTemplateSummaries } from "@/lib/magic-layers/builtin-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  // 內建範本跟著程式碼走，資料庫掛了也還在。使用者自存的排前面——
  // 那是他們剛做的東西，比較常要回去套。
  const builtins = builtinTemplateSummaries();
  try {
    const rows = await db.styleComponent.findMany({
      where: { type: CANVAS_TEMPLATE_TYPE },
      orderBy: { createdAt: "desc" },
      take: 120,
    });
    // 列表只要縮圖與名字；layers 有可能很大，點進去套用時才需要。
    const mine = rows
      .map(rowToCanvasTemplate)
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map(({ layers, ...rest }) => ({ ...rest, layerCount: layers.length, builtin: false }));
    return NextResponse.json({ templates: [...mine, ...builtins] });
  } catch {
    // 本機資料庫還沒起來時仍然給得出內建的，不要讓整個編輯器空掉。
    return NextResponse.json({ templates: builtins });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; docW?: number; docH?: number; layers?: unknown; thumbnail?: string };
    const name = (body.name ?? "").trim() || "未命名範本";
    const payload = parseCanvasTemplatePayload({ docW: body.docW, docH: body.docH, layers: body.layers });

    let previewUrl: string | null = null;
    if (typeof body.thumbnail === "string" && body.thumbnail.startsWith("data:image/")) {
      const buffer = Buffer.from(body.thumbnail.split(",")[1] ?? "", "base64");
      if (buffer.length) previewUrl = await saveBuffer(buffer, "png", "canvas-template-");
    }

    const row = await db.styleComponent.create({
      data: {
        name,
        type: CANVAS_TEMPLATE_TYPE,
        data: JSON.stringify(payload),
        sourceLayoutId: "canvas-template",
        clientId: null,          // 共用：所有品牌都看得到
        aiPromptText: "",
        previewUrl,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "存成範本失敗";
    console.error("[magic-layers/templates] POST", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
