import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { VisualAssetBoard } from "@/components/products/VisualAssetBoard";

export default async function VisualAssetKitPage({ params }: {
  params: Promise<{ clientId: string; productId: string; batchId: string }>;
}) {
  const { clientId, productId, batchId } = await params;
  const [product, kit] = await Promise.all([
    db.product.findFirst({ where: { id: productId, clientId }, select: { id: true, name: true } }),
    db.productImageSet.findFirst({ where: { id: batchId, productId }, select: { id: true } }),
  ]);
  if (!product || !kit) notFound();
  return <VisualAssetBoard clientId={clientId} productId={productId} batchId={batchId} productName={product.name} />;
}
