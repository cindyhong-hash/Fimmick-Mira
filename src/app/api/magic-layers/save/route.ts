/* ============================================================
   Magic Layers — save / load an editable 排版 as an Activity draft
   進行中的自由排版 = 一筆 Activity(status DRAFT, layoutId="magic-layers") + 一筆
   GeneratedLayout（imageUrl=壓平縮圖、textLayerJson=排版 JSON）。這樣它就出現在
   「廣告活動圖」列表的草稿裡，點擊可回編輯器續編。零 DB migration（重用現成欄位）。

   POST body { clientId, activityId?, name, docW, docH, layers, imageDataUrl, finalize?, pages?, pageImages? }
        → { activityId }   (create when no activityId, else update)
        finalize=true（按下載時）：活動轉 DONE，並把成品推一次到素材庫。
        pages：多頁設計（像 Canva 的頁面）。第 1 頁同時放在 docW/docH/layers，
        舊版讀取程式、列表縮圖都照舊能用；pageImages 是下載時每一頁壓平的圖，每頁各存一筆到素材庫。
   GET  ?activity=<activityId>  (或舊的 ?id=<libraryImageId>)
        → { activityId?, name, docW, docH, layers, imageUrl }
   ============================================================ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MARKER = "magicLayout";
const LAYOUT_ID = "magic-layers";

export async function POST(request: Request) {
  try {
    const { clientId, activityId, name, docW, docH, layers, imageDataUrl, finalize, pages, pageImages } = await request.json();
    if (!Array.isArray(layers) || !docW || !docH) return NextResponse.json({ error: "missing docW/docH/layers" }, { status: 400 });

    let imageUrl = "";
    if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
      imageUrl = await saveBuffer(Buffer.from(imageDataUrl.split(",")[1] ?? "", "base64"), "png", "ml-layout-");
    }
    // 只有一頁（而且沒取頁名）時照舊存 version 1，不讓單頁草稿多帶一份重複的資料
    const multi = Array.isArray(pages) && (pages.length > 1 || (pages.length === 1 && typeof pages[0]?.name === "string" && !!pages[0].name.trim()))
      && pages.every((p: { docW?: unknown; docH?: unknown; layers?: unknown }) => Number(p?.docW) > 0 && Number(p?.docH) > 0 && Array.isArray(p?.layers));
    const textLayerJson = JSON.stringify(multi
      ? { kind: MARKER, version: 2, docW, docH, layers, pages }
      : { kind: MARKER, version: 1, docW, docH, layers });
    const theme = (typeof name === "string" && name.trim()) ? name.trim().slice(0, 80) : "未命名排版";
    const status = finalize ? "DONE" : "DRAFT";

    // find or create the Activity
    let id = activityId as string | undefined;
    if (id) {
      await db.activity.update({ where: { id }, data: { theme, status } });
    } else {
      if (!clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
      const act = await db.activity.create({
        data: { clientId, theme, focusPoint: "", layoutId: LAYOUT_ID, status, imageRatio: `${docW}:${docH}` },
      });
      id = act.id;
    }

    // upsert its single GeneratedLayout (holds the thumbnail + the editable layout doc)
    const existing = await db.generatedLayout.findFirst({ where: { activityId: id } });
    if (existing) {
      await db.generatedLayout.update({
        where: { id: existing.id },
        data: { textLayerJson, ...(imageUrl ? { imageUrl } : {}) },
      });
    } else {
      await db.generatedLayout.create({
        data: { activityId: id!, layoutType: LAYOUT_ID, imageUrl, copyText: "", textLayerJson, isSelected: true },
      });
    }

    // 下載時把成品推一次到素材庫（用 savedToLibrary 當去重旗標，避免重複下載狂加）
    if (finalize && imageUrl) {
      const gl = await db.generatedLayout.findFirst({ where: { activityId: id } });
      if (gl && !gl.savedToLibrary) {
        // 多頁：每一頁各存一張（第 1 頁就是 imageUrl，其他頁另外存檔）
        const extra = multi && Array.isArray(pageImages) ? pageImages.slice(1).filter((u: unknown): u is string => typeof u === "string" && u.startsWith("data:")) : [];
        const urls = [imageUrl];
        for (const u of extra) urls.push(await saveBuffer(Buffer.from(u.split(",")[1] ?? "", "base64"), "png", "ml-layout-"));
        for (const [i, url] of urls.entries()) {
          // 頁面有名字就用名字（「夏日防曬－封面」），沒有就標第幾頁
          const pageName = multi && typeof pages[i]?.name === "string" ? pages[i].name.trim() : "";
          const subject = pageName ? `${theme}－${pageName}` : urls.length > 1 ? `${theme}（${i + 1}／${urls.length}）` : theme;
          await db.libraryImage.create({ data: { clientId: clientId ?? null, imageUrl: url, subject, prompt: "", paramsJson: JSON.stringify({ kind: MARKER, activityId: id, page: i + 1 }), status: "DONE" } });
        }
        await db.generatedLayout.update({ where: { id: gl.id }, data: { savedToLibrary: true } });
      }
    }

    return NextResponse.json({ activityId: id });
  } catch (err) {
    console.error("[magic-layers/save] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const activityId = sp.get("activity");
    const libId = sp.get("id");

    let textLayerJson = "{}"; let name = ""; let imageUrl = ""; let outActivityId: string | undefined;
    if (activityId) {
      const gl = await db.generatedLayout.findFirst({ where: { activityId }, orderBy: { createdAt: "desc" } });
      const act = await db.activity.findUnique({ where: { id: activityId } });
      if (!gl || !act) return NextResponse.json({ error: "not found" }, { status: 404 });
      textLayerJson = gl.textLayerJson; name = act.theme; imageUrl = gl.imageUrl; outActivityId = activityId;
    } else if (libId) {
      const row = await db.libraryImage.findUnique({ where: { id: libId } });
      if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
      // 舊素材庫排版：paramsJson 可能直接存 doc，或指向 activityId
      let p: { kind?: string; activityId?: string; docW?: number; docH?: number; layers?: unknown[] } = {};
      try { p = JSON.parse(row.paramsJson || "{}"); } catch { /* ignore */ }
      if (p.activityId) return GET(new Request(request.url.replace(/id=[^&]*/, `activity=${p.activityId}`)));
      textLayerJson = row.paramsJson; name = row.subject ?? ""; imageUrl = row.imageUrl;
    } else {
      return NextResponse.json({ error: "missing activity/id" }, { status: 400 });
    }

    let doc: { kind?: string; docW?: number; docH?: number; layers?: unknown[]; pages?: { docW: number; docH: number; layers: unknown[] }[] } = {};
    try { doc = JSON.parse(textLayerJson || "{}"); } catch { /* ignore */ }
    if (doc.kind !== MARKER) return NextResponse.json({ error: "not a magic layout" }, { status: 400 });
    return NextResponse.json({ activityId: outActivityId, name, imageUrl, docW: doc.docW, docH: doc.docH, layers: doc.layers ?? [],
      pages: Array.isArray(doc.pages) && doc.pages.length ? doc.pages : undefined });
  } catch (err) {
    console.error("[magic-layers/load] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
