import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveImageSetKitStatus, normalizeImageSetKitAssets, parseImageSetPlanJson } from "@/lib/products/image-set-kit";
import { parseImageSetArtDirection } from "@/lib/products/product-visual-analysis";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: {
  params: Promise<{ productId: string; batchId: string }>;
}) {
  const { productId, batchId } = await params;
  const kit = await db.productImageSet.findFirst({ where: { id: batchId, productId } });
  if (!kit) return NextResponse.json({ error: "找不到這項產品的視覺套組" }, { status: 404 });
  const rows = await db.libraryImage.findMany({
    where: { productId, batchId },
    orderBy: { createdAt: "asc" },
  });

  try {
    const plan = parseImageSetPlanJson(kit.planJson);
    const artDirection = parseImageSetArtDirection(JSON.parse(kit.artDirectionJson));
    if (!artDirection) throw new Error("invalid art direction");
    const assets = normalizeImageSetKitAssets(productId, batchId, rows);
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
