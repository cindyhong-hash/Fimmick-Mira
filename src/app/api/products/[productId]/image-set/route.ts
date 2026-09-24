import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { classifyBatchAssets } from "@/lib/library/classify-asset";
import { parseBenefitIconStyle } from "@/lib/products/image-set-kit";
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
  // 沒送＝沿用草稿記的；送了不認得的值就退回 400，不要默默改成預設風格後付費生圖。
  const benefitIconStyle = body.benefitIconStyle === undefined ? undefined : parseBenefitIconStyle(body.benefitIconStyle);
  if (body.benefitIconStyle !== undefined && !benefitIconStyle) {
    return NextResponse.json({ error: "benefitIconStyle 格式不正確" }, { status: 400 });
  }

  // 只收得懂的形狀；內容長度與空白由 orchestrator 驗（那裡才是付費生成的關卡）。
  const rawTexts = body.benefitTexts;
  // 使用者自己加的賣點：只收得懂的形狀，長度與空白由 orchestrator 驗。
  const rawAdded = body.addedBenefits;
  const addedBenefits = Array.isArray(rawAdded)
    ? rawAdded
      .filter((entry: unknown): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .filter((entry) => typeof entry.title === "string")
      .map((entry) => ({
        title: entry.title as string,
        description: typeof entry.description === "string" ? entry.description : "",
      }))
    : [];

  const benefitTexts: Record<string, { title: string; description: string }> = {};
  if (rawTexts && typeof rawTexts === "object" && !Array.isArray(rawTexts)) {
    for (const [id, value] of Object.entries(rawTexts as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      if (typeof entry.title !== "string") continue;
      benefitTexts[id] = { title: entry.title, description: typeof entry.description === "string" ? entry.description : "" };
    }
  }

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
    benefitIconStyle: benefitIconStyle ?? undefined,
    ...(Object.keys(benefitTexts).length ? { benefitTexts } : {}),
    ...(addedBenefits.length ? { addedBenefits } : {}),
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
    // 整批生成、套圖狀態都更新完之後，再看圖補素材庫分類（生成角色 ≠ 素材庫分類）。
    // 放在最後：不會讓套圖多顯示「處理中」；最多多花 20 秒，失敗不影響套圖
    scheduleAfter: (callback) => after(async () => {
      try { await callback(); } finally { if (typeof body.batchId === "string" && body.batchId) await classifyBatchAssets(body.batchId); }
    }),
    runBatch: (input, value) => runImageSetBatch(input, undefined, value),
    readBatchStatuses: async (batchId, ownerProductId) => (await db.libraryImage.findMany({
      where: { batchId, productId: ownerProductId },
      select: { status: true },
    })).map(({ status }) => status as "PENDING" | "GENERATING" | "DONE" | "FAILED"),
    updateKitStatus: (batchId, status) => db.productImageSet.update({ where: { id: batchId }, data: { status } }),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}, { quota: dailyQuota("image-set") });
