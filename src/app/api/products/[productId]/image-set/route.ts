import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { protectPaidRoute } from "@/lib/site-gate";
import {
  claimProductPaidOperationLease,
  confirmAndScheduleProductImageSet,
  createImageSetExecution,
  readImageSetProduct,
  reconcileImageSetCleanupJobs,
  reconcileStaleImageSetWork,
  releaseProductPaidOperationLease,
  runImageSetBatch,
} from "@/lib/products/image-set-orchestrator";

// Vercel Hobby 方案函式硬上限 300s；設 290 留 buffer。orchestrator 內部 deadline（270s）
// 會在被平台砍之前先把未完成的列標成 FAILED，避免留下卡在「生成中」的孤兒列。
// 若日後升級 Pro/Enterprise（Fluid Compute）可調回較高值，並同步放寬 IMAGE_SET_BATCH_DEADLINE_MS。
export const maxDuration = 290;
export const dynamic = "force-dynamic";

// GET never starts paid analysis. It may only CAS-reconcile work whose durable lease has expired.
export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await db.product.findUnique({ where: { id: productId }, include: { client: true } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await reconcileStaleImageSetWork(product.id, new Date());
  await reconcileImageSetCleanupJobs(10);
  return NextResponse.json(await readImageSetProduct(product, product.client));
}

// POST confirms an existing DRAFT planning snapshot, then schedules one resilient batch callback.
export const POST = protectPaidRoute(async (
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
  { invocationStartedAt },
) => {
  const { productId } = await params;
  const body = await request.json().catch(() => ({}));
  const selectedItemIds = Array.isArray(body.selectedItemIds)
    ? body.selectedItemIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const product = await db.product.findUnique({ where: { id: productId }, include: { client: true } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await reconcileStaleImageSetWork(product.id, new Date());
  await reconcileImageSetCleanupJobs(10);
  const execution = createImageSetExecution(invocationStartedAt, randomUUID());
  const result = await confirmAndScheduleProductImageSet({
    product,
    client: product.client,
    batchId: typeof body.batchId === "string" ? body.batchId : "",
    selectedItemIds,
    artDirection: body.artDirection,
    execution,
  }, {
    loadDraft: (ownerProductId, batchId) => db.productImageSet.findFirst({ where: { id: batchId, productId: ownerProductId } }),
    claimProductLease: (id, value) => claimProductPaidOperationLease(id, value, "batch"),
    releaseProductLease: releaseProductPaidOperationLease,
    persistConfirmedBatch: (data) => db.$transaction(async (tx) => {
      const confirmed = await tx.productImageSet.updateMany({
        where: { id: data.batchId, productId: data.productId, status: "DRAFT" },
        data: {
          status: "CONFIRMED",
          artDirectionJson: data.artDirectionJson,
          planJson: data.planJson,
          confirmedAt: data.confirmedAt,
        },
      });
      if (confirmed.count !== 1) return null;
      const rows = await Promise.all(data.rows.map((row) => tx.libraryImage.create({ data: row })));
      const generating = await tx.productImageSet.updateMany({
        where: { id: data.batchId, productId: data.productId, status: "CONFIRMED" },
        data: { status: "GENERATING" },
      });
      if (generating.count !== 1) throw new Error("套圖批次狀態更新失敗");
      return rows;
    }),
    failCreatedRows: async (rowIds, value) => {
      const failed = await db.libraryImage.updateMany({
        where: { id: { in: rowIds }, status: { in: ["PENDING", "GENERATING"] }, generationLeaseId: value.leaseId },
        data: {
          status: "FAILED",
          errorMessage: "背景工作未能啟動，請重新建立套圖。",
          generationLeaseId: null,
          generationLeaseExpiresAt: null,
        },
      });
      return failed.count === rowIds.length;
    },
    scheduleAfter: (callback) => after(callback),
    runBatch: (input, value) => runImageSetBatch(input, undefined, value),
    readBatchStatuses: async (batchId, ownerProductId) => (await db.libraryImage.findMany({
      where: { batchId, productId: ownerProductId },
      select: { status: true },
    })).map(({ status }) => status as "PENDING" | "GENERATING" | "DONE" | "FAILED"),
    updateKitStatus: (batchId, status) => db.productImageSet.update({ where: { id: batchId }, data: { status } }),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
});
