/* ============================================================
   /api/magic-layers/templates/[id]

   GET    取單一範本的完整內容（含 layers）——套用時才抓，列表不帶
   DELETE 刪掉範本
   ============================================================ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CANVAS_TEMPLATE_TYPE, rowToCanvasTemplate } from "@/lib/magic-layers/canvas-template";
import { findBuiltinTemplate, isBuiltinTemplateId } from "@/lib/magic-layers/builtin-templates";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isBuiltinTemplateId(id)) {
    const builtin = findBuiltinTemplate(id);
    if (!builtin) return NextResponse.json({ error: "找不到這個範本" }, { status: 404 });
    return NextResponse.json({ template: builtin });
  }
  try {
    const row = await db.styleComponent.findUnique({ where: { id } });
    if (!row || row.type !== CANVAS_TEMPLATE_TYPE) {
      return NextResponse.json({ error: "找不到這個範本" }, { status: 404 });
    }
    const template = rowToCanvasTemplate(row);
    if (!template) return NextResponse.json({ error: "範本內容已損壞" }, { status: 422 });
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "讀取範本失敗" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 內建範本刪掉之後只能重新部署才會回來，所以擋住。
  if (isBuiltinTemplateId(id)) {
    return NextResponse.json({ error: "內建範本不能刪除" }, { status: 400 });
  }
  try {
    const row = await db.styleComponent.findUnique({ where: { id } });
    // 只允許刪範本，避免這支端點被拿去刪到風格積木。
    if (!row || row.type !== CANVAS_TEMPLATE_TYPE) {
      return NextResponse.json({ error: "找不到這個範本" }, { status: 404 });
    }
    await db.styleComponent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "刪除範本失敗" }, { status: 500 });
  }
}
