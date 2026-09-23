import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { deriveImageSetKitStatus } from "@/lib/products/image-set-kit";
import {
  createImageSetExecution,
  prepareKitAssetRegenerationFromRecords,
  reconcileImageSetCleanupJobs,
  reconcileStaleImageSetWork,
  regenerateImageSetItem,
  requestImageSetRegeneration,
} from "@/lib/products/image-set-orchestrator";

export const maxDuration = 290;

export const POST = protectPaidRoute(async (
  request: Request,
  { params }: { params: Promise<{ productId: string; batchId: string; assetId: string }> },
  { invocationStartedAt },
) => {
  const { productId, batchId, assetId } = await params;
  const body = await request.json().catch(() => ({})) as { assetRole?: unknown; assetSubtype?: unknown; revisionNote?: unknown };
  const revisionNote = typeof body.revisionNote === "string" ? body.revisionNote.trim().slice(0, 300) : "";
  const kit = await db.productImageSet.findFirst({ where: { id: batchId, productId } });
  if (!kit) return NextResponse.json({ error: "找不到這項產品的視覺套組" }, { status: 404 });
  const target = await db.libraryImage.findFirst({
    where: { id: assetId, productId, batchId },
    include: { product: true },
  });
  if (!target) return NextResponse.json({ error: "找不到這份套圖中的素材" }, { status: 404 });
  if (body.assetRole !== undefined && body.assetRole !== target.assetRole) {
    return NextResponse.json({ error: "重新產生時不可變更素材角色" }, { status: 400 });
  }
  if (body.assetSubtype !== undefined && body.assetSubtype !== target.assetSubtype) {
    return NextResponse.json({ error: "這個素材變化不在已確認的套圖清單中" }, { status: 400 });
  }

  const previousStatus = target.status === "DONE" ? "DONE" : "FAILED";

  await reconcileStaleImageSetWork(productId, new Date());
  await reconcileImageSetCleanupJobs(10);
  const execution = createImageSetExecution(invocationStartedAt, randomUUID());
  const updateKitStatus = async () => {
    const statuses = (await db.libraryImage.findMany({ where: { productId, batchId }, select: { status: true } }))
      .map(({ status }) => status as "PENDING" | "GENERATING" | "DONE" | "FAILED");
    await db.productImageSet.update({ where: { id: batchId }, data: { status: deriveImageSetKitStatus(statuses) } });
  };
  const result = await requestImageSetRegeneration(assetId, execution, {
    prepare: async () => prepareKitAssetRegenerationFromRecords(target, kit, revisionNote),
    // 原本只允許 FAILED 重生（避免誤觸重複付費）。使用者要求「每張都能重新生成並
    // 指定怎麼改」，所以放寬到 DONE；PENDING／GENERATING 仍然不可動，避免搶佔進行中的工作。
    claimFailedRow: (rowId, value) => db.$transaction(async (tx) => {
      const claimed = await tx.libraryImage.updateMany({
        where: { id: rowId, productId, batchId, status: { in: ["FAILED", "DONE"] } },
        data: {
          status: "GENERATING",
          errorMessage: null,
          generationLeaseId: value.leaseId,
          generationLeaseExpiresAt: new Date(value.deadlineAt),
        },
      });
      if (claimed.count !== 1) return false;
      await tx.productImageSet.update({ where: { id: batchId }, data: { status: "GENERATING" } });
      return true;
    }),
    rollbackClaimedRow: async (rowId, value) => {
      // 還原成「原本的狀態」：本來就是 DONE 的素材不該因為背景工作沒啟動就變成 FAILED，
      // 那會讓使用者以為圖被弄丟了（實際上舊圖還在）。
      const rolledBack = await db.libraryImage.updateMany({
        where: { id: rowId, productId, batchId, status: "GENERATING", generationLeaseId: value.leaseId },
        data: {
          status: previousStatus,
          errorMessage: previousStatus === "FAILED" ? "背景工作未能啟動，請重新產生。" : null,
          generationLeaseId: null,
          generationLeaseExpiresAt: null,
        },
      });
      await updateKitStatus().catch(() => {});
      return rolledBack.count === 1;
    },
    scheduleAfter: (callback) => after(callback),
    regenerate: async (rowId, prepared, value) => {
      try {
        return await regenerateImageSetItem(rowId, prepared, value);
      } finally {
        await updateKitStatus();
      }
    },
    logError: (...values) => console.error(...values),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.id, status: result.status });
}, { quota: dailyQuota("image-set-retry") });
