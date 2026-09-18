import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveImageSetKitStatus, normalizeImageSetKitAssets, parseImageSetPlanJson } from "@/lib/products/image-set-kit";
import { parseImageSetArtDirection } from "@/lib/products/product-visual-analysis";
import { deleteStoredAsset } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: {
  params: Promise<{ productId: string; batchId: string }>;
}) {
  const { productId, batchId } = await params;
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  const kit = await db.productImageSet.findFirst({ where: { id: batchId, productId, product: { clientId } } });
  if (!kit) return NextResponse.json({ error: "找不到這項產品的視覺套組" }, { status: 404 });
  const rows = await db.libraryImage.findMany({
    where: { productId, batchId },
    orderBy: { createdAt: "asc" },
  });

  try {
    const plan = parseImageSetPlanJson(kit.planJson);
    const artDirection = parseImageSetArtDirection(JSON.parse(kit.artDirectionJson));
    if (!artDirection) throw new Error("invalid art direction");
    const assets = normalizeImageSetKitAssets(productId, batchId, rows, plan);
    const terminalStatus = assets.length && !assets.some(({ status }) => status === "PENDING" || status === "GENERATING")
      ? deriveImageSetKitStatus(assets.map(({ status }) => status as "PENDING" | "GENERATING" | "DONE" | "FAILED"))
      : kit.status;
    return NextResponse.json({
      batchId: kit.id,
      productId: kit.productId,
      status: terminalStatus,
      theme: kit.themeKey ? { key: kit.themeKey, label: kit.themeLabel } : null,
      artDirection,
      plan,
      assets,
      confirmedAt: kit.confirmedAt,
      createdAt: kit.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "這份視覺套組的資料格式已失效" }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: {
  params: Promise<{ productId: string; batchId: string }>;
}) {
  const { productId, batchId } = await params;
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const kit = await db.productImageSet.findFirst({ where: { id: batchId, productId, product: { clientId } } });
  if (!kit) return NextResponse.json({ error: "找不到這項產品的視覺套組" }, { status: 404 });

  const rows = await db.libraryImage.findMany({
    where: { productId, batchId },
    select: { status: true, imageUrl: true },
  });
  if (kit.status === "CONFIRMED" || kit.status === "GENERATING" || rows.some(({ status }) => status === "PENDING" || status === "GENERATING")) {
    return NextResponse.json({ error: "套組仍在生成中，完成後才能刪除整組。" }, { status: 409 });
  }

  try {
    await db.$transaction(async (tx) => {
      const activeRows = await tx.libraryImage.count({
        where: { productId, batchId, status: { in: ["PENDING", "GENERATING"] } },
      });
      const current = await tx.productImageSet.findFirst({ where: { id: batchId, productId } });
      if (!current || current.status === "CONFIRMED" || current.status === "GENERATING" || activeRows > 0) {
        throw new Error("ACTIVE_IMAGE_SET");
      }
      await tx.libraryImage.deleteMany({ where: { productId, batchId } });
      await tx.productImageSet.deleteMany({ where: { id: batchId, productId } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_IMAGE_SET") {
      return NextResponse.json({ error: "套組仍在生成中，完成後才能刪除整組。" }, { status: 409 });
    }
    return NextResponse.json({ error: "刪除整組失敗" }, { status: 500 });
  }

  const urls = [...new Set(rows.map(({ imageUrl }) => imageUrl).filter(Boolean))];
  await Promise.allSettled(urls.map((url) => deleteStoredAsset(url)));
  return NextResponse.json({ ok: true, deletedAssets: rows.length });
}
