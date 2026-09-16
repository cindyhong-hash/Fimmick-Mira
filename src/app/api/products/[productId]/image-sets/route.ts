import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVisualAssetKitHistory } from "@/lib/products/visual-asset-board";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const kits = await db.productImageSet.findMany({
    where: { productId, confirmedAt: { not: null }, product: { clientId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      themeKey: true,
      themeLabel: true,
      status: true,
      createdAt: true,
      confirmedAt: true,
    },
  });
  if (!kits.length) return NextResponse.json({ kits: [] });

  const assets = await db.libraryImage.findMany({
    where: { productId, batchId: { in: kits.map(({ id }) => id) } },
    orderBy: { createdAt: "asc" },
    select: { batchId: true, status: true, imageUrl: true },
  });

  return NextResponse.json({ kits: buildVisualAssetKitHistory(kits, assets) });
}
