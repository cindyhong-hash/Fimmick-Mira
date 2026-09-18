import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { db } from "../db.ts";
import { deleteStoredAsset, loadBuffer, saveBuffer } from "../storage.ts";
import { compileImageSetPrompt } from "./image-set-prompts.ts";
import {
  generateImageSetRole,
  ImageSetFallbackBudgetError,
  type ImageSetRoleGenerationInput,
  type ImageSetRoleGenerationOutput,
} from "./image-set-model-router.ts";
import {
  analyzeProductVisualProfile,
  buildImageSetArtDirection,
  countProductVisualReferenceImages,
  parseImageSetArtDirection,
  type ImageSetArtDirection,
  type ProductBrandFacts,
} from "./product-visual-analysis.ts";
import {
  computeProductVisualSourceHash,
  fallbackProductVisualProfile,
  parseProductVisualProfile,
  type ProductVisualProfile,
} from "./product-visual-profile.ts";
import {
  imageSetThemeCatalog,
  planImageSetRoles,
  resolveImageSetTheme,
  type ImageSetRole,
  type ImageSetRoleSpec,
  type ImageSetTheme,
} from "./image-set-roles.ts";
import { deriveBenefitPoints, extractBenefitPoints, type BenefitPoint } from "./benefit-points.ts";
import { chatTextOpenRouter } from "../openrouter.ts";
import {
  deriveImageSetKitStatus,
  IMAGE_SET_MAX_ASSETS,
  parseImageSetPlanJson,
  type BenefitIconStyle,
  type ImageSetPlanItem,
  type ImageSetKitStatus,
} from "./image-set-kit.ts";
import {
  claimImageAssetCleanupJobLease,
  completeGeneratedImageSetRowWithLease,
  persistProductVisualProfileWithLease,
} from "./image-set-db-operations.ts";

export type ImageSetProduct = {
  id: string;
  clientId: string;
  name: string;
  category: string | null;
  description: string | null;
  primaryColorOverride: string | null;
  rawImageUrls: string[];
  heroImageUrl: string | null;
};

export type StoredImageSetProduct = Omit<ImageSetProduct, "rawImageUrls"> & {
  rawImageUrls: string;
  visualProfileJson: string;
  visualProfileSourceHash: string | null;
  visualProfileUpdatedAt?: Date | null;
};

export type ImageSetClient = {
  primaryColor?: string | null;
  toneLabels?: string | null;
} | null;

export type ImageSetRow = { id: string; role: ImageSetRoleSpec };
export type ImageSetRowStatus = "PENDING" | "GENERATING" | "DONE" | "FAILED";
// 對齊 Vercel Hobby 300s 硬上限：route maxDuration=290，內部 deadline 設 270s，
// 讓 orchestrator 在函式被平台砍之前先把未完成的列標 FAILED（不留孤兒列）。
// 升級 Pro/Enterprise 後可連同 route maxDuration 一起調高。
export const IMAGE_SET_BATCH_DEADLINE_MS = 270_000;
export type ImageSetExecution = { leaseId: string; deadlineAt: number };

export function createImageSetExecution(
  invocationStartedAt: number,
  leaseId: string,
  budgetMs = IMAGE_SET_BATCH_DEADLINE_MS,
): ImageSetExecution {
  return { leaseId, deadlineAt: invocationStartedAt + budgetMs };
}

export async function claimProductPaidOperationLease(
  productId: string,
  execution: ImageSetExecution,
  kind: "analysis" | "batch",
  now = new Date(),
): Promise<boolean> {
  const result = await db.product.updateMany({
    where: {
      id: productId,
      assets: {
        none: {
          status: { in: ["PENDING", "GENERATING"] },
          generationLeaseExpiresAt: { gt: now },
        },
      },
      OR: [
        { paidOperationLeaseId: null },
        { paidOperationLeaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      paidOperationLeaseId: execution.leaseId,
      paidOperationLeaseExpiresAt: new Date(execution.deadlineAt),
      paidOperationKind: kind,
    },
  });
  return result.count === 1;
}

export async function releaseProductPaidOperationLease(productId: string, leaseId: string): Promise<boolean> {
  const result = await db.product.updateMany({
    where: { id: productId, paidOperationLeaseId: leaseId },
    data: { paidOperationLeaseId: null, paidOperationLeaseExpiresAt: null, paidOperationKind: null },
  });
  return result.count === 1;
}

type ImageSetRowMutation = {
  status?: ImageSetRowStatus;
  imageUrl?: string;
  prompt?: string;
  paramsJson?: string;
  errorMessage?: string | null;
  generationLeaseId?: string | null;
  generationLeaseExpiresAt?: Date | null;
  hasTransparentBackground?: boolean;
};

export type ImageSetRowParams = {
  imageSet: true;
  profileVersion: 1;
  sourceHash: string;
  artDirection: ImageSetArtDirection;
  roleSpec: ImageSetRoleSpec;
  provider?: string;
};

export type ImageSetBatchInput = {
  batchId: string;
  sourceHash: string;
  profile: ProductVisualProfile;
  artDirection: ImageSetArtDirection;
  product: ImageSetProduct;
  rows: ImageSetRow[];
};

export type ImageSetBatchDependencies = {
  updateRow?: (id: string, data: ImageSetRowMutation) => Promise<unknown>;
  transitionRow?: (id: string, from: ImageSetRowStatus[], data: ImageSetRowMutation, execution: ImageSetExecution) => Promise<boolean>;
  completeRow?: (id: string, data: Required<Pick<ImageSetRowMutation, "imageUrl" | "prompt" | "paramsJson" | "hasTransparentBackground">>, execution: ImageSetExecution) => Promise<boolean>;
  failUnfinishedRows?: (rows: Array<{ id: string; errorMessage: string }>, execution: ImageSetExecution) => Promise<unknown>;
  generateRole: (input: ImageSetRoleGenerationInput) => Promise<ImageSetRoleGenerationOutput>;
  saveBuffer: (buffer: Buffer, extension: string, prefix: string, signal?: AbortSignal) => Promise<string>;
  cleanupOrphanAsset?: (input: ImageSetOrphanAsset) => Promise<ImageSetOrphanCleanupResult>;
  loadAsDataUri?: (url: string, signal?: AbortSignal) => Promise<string>;
  setDeadlineTimer?: (callback: () => void, delayMs: number) => unknown;
  clearDeadlineTimer?: (timer: unknown) => void;
  createAbortController?: () => AbortController;
  waitForCleanupRetry?: (delayMs: number) => Promise<void>;
  now?: () => number;
  logError?: (...values: unknown[]) => void;
  inspectTransparency?: (buffer: Buffer) => Promise<boolean>;
};

export type ImageSetBatchResult = {
  statuses: Partial<Record<ImageSetRole, "DONE" | "FAILED">>;
  params: Partial<Record<ImageSetRole, ImageSetRowParams>>;
};

async function hasTransparentPixels(buffer: Buffer): Promise<boolean> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.hasAlpha) return false;
  const stats = await sharp(buffer).stats();
  return (stats.channels[3]?.min ?? 255) < 255;
}

export type ImageSetSuggestion = {
  role: ImageSetRole;
  label: string;
  usageDescription: string;
  path: ImageSetRoleSpec["path"];
  cutout: boolean;
  sceneCn: string;
};

export type ImageSetOrphanAsset = {
  productId: string;
  libraryImageId: string;
  generationLeaseId: string;
  assetUrl: string;
};

export type ImageSetOrphanCleanupJob = ImageSetOrphanAsset & {
  id: string;
  attempts: number;
  lastError?: string | null;
  cleanupLeaseId?: string | null;
  cleanupLeaseExpiresAt?: Date | null;
};

export type ImageSetOrphanCleanupResult = { resolved: boolean; deleted: boolean };
export type ImageSetOrphanDeletionClaim = "claimed" | "safe_without_original_lease" | "blocked";

export type ImageSetOrphanCleanupDependencies = {
  upsertCleanupJob: (input: ImageSetOrphanAsset) => Promise<ImageSetOrphanCleanupJob>;
  claimCleanupJob: (job: ImageSetOrphanCleanupJob, execution: ImageSetExecution) => Promise<boolean>;
  claimOrphanDeletion: (input: ImageSetOrphanAsset) => Promise<ImageSetOrphanDeletionClaim>;
  isCurrentAsset: (job: ImageSetOrphanCleanupJob) => Promise<boolean>;
  deleteAsset: (url: string) => Promise<void>;
  completeCleanupJob: (job: ImageSetOrphanCleanupJob, execution: ImageSetExecution) => Promise<boolean>;
  recordCleanupFailure: (job: ImageSetOrphanCleanupJob, execution: ImageSetExecution, errorMessage: string) => Promise<unknown>;
  releaseCleanupJob: (job: ImageSetOrphanCleanupJob, execution: ImageSetExecution) => Promise<boolean>;
  createCleanupLease: () => ImageSetExecution;
  waitForRetry: (delayMs: number) => Promise<void>;
  logError: (...values: unknown[]) => void;
};

const orphanCleanupError = (error: unknown) => (
  error instanceof Error ? `Asset cleanup failed (${error.name})` : "Unknown asset cleanup failure"
);

const defaultOrphanCleanupDependencies: ImageSetOrphanCleanupDependencies = {
  upsertCleanupJob: async (input) => db.imageAssetCleanupJob.upsert({
    where: { assetUrl: input.assetUrl },
    create: input,
    update: {},
  }),
  claimCleanupJob: (job, execution) => claimImageAssetCleanupJobLease({
    jobId: job.id,
    leaseId: execution.leaseId,
    deadlineAt: execution.deadlineAt,
  }),
  claimOrphanDeletion: async (input) => {
    const claimed = await db.libraryImage.updateMany({
      where: {
        id: input.libraryImageId,
        OR: [
          { status: { in: ["PENDING", "GENERATING"] }, generationLeaseId: input.generationLeaseId },
          // Stale reconciliation may already have safely cleared the old lease.
          { status: "FAILED", generationLeaseId: null },
        ],
      },
      data: {
        status: "FAILED",
        errorMessage: "未完成的商品套圖素材已交由清理流程處理。",
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      },
    });
    if (claimed.count === 1) return "claimed";
    const current = await db.libraryImage.findUnique({
      where: { id: input.libraryImageId },
      select: { status: true, generationLeaseId: true, imageUrl: true },
    });
    if (!current) return "safe_without_original_lease";
    // A replacement generation lease cannot complete the old lease's result;
    // a DONE row, however, may already own the URL and must block deletion.
    if (["PENDING", "GENERATING"].includes(current.status) && current.generationLeaseId !== input.generationLeaseId) {
      return "safe_without_original_lease";
    }
    if (current.status === "DONE" && current.imageUrl !== input.assetUrl) {
      return "safe_without_original_lease";
    }
    return "blocked";
  },
  isCurrentAsset: async (job) => (await db.libraryImage.count({
    where: { status: "DONE", imageUrl: job.assetUrl },
  })) > 0,
  deleteAsset: deleteStoredAsset,
  completeCleanupJob: async (job, execution) => (await db.imageAssetCleanupJob.deleteMany({
    where: {
      id: job.id,
      assetUrl: job.assetUrl,
      libraryImageId: job.libraryImageId,
      generationLeaseId: job.generationLeaseId,
      cleanupLeaseId: execution.leaseId,
      cleanupLeaseExpiresAt: new Date(execution.deadlineAt),
    },
  })).count === 1,
  recordCleanupFailure: (job, execution, errorMessage) => db.imageAssetCleanupJob.updateMany({
    where: {
      id: job.id,
      assetUrl: job.assetUrl,
      libraryImageId: job.libraryImageId,
      generationLeaseId: job.generationLeaseId,
      cleanupLeaseId: execution.leaseId,
      cleanupLeaseExpiresAt: new Date(execution.deadlineAt),
    },
    data: { attempts: { increment: 1 }, lastError: errorMessage },
  }),
  releaseCleanupJob: async (job, execution) => (await db.imageAssetCleanupJob.updateMany({
    where: {
      id: job.id,
      cleanupLeaseId: execution.leaseId,
      cleanupLeaseExpiresAt: new Date(execution.deadlineAt),
    },
    data: { cleanupLeaseId: null, cleanupLeaseExpiresAt: null },
  })).count === 1,
  createCleanupLease: () => createImageSetExecution(Date.now(), randomUUID(), 15_000),
  waitForRetry: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  logError: (...values) => console.error(...values),
};

/** Records an orphan before deletion and retains the record when bounded cleanup cannot finish. */
export async function cleanupImageSetOrphanAsset(
  input: ImageSetOrphanAsset,
  dependencies: ImageSetOrphanCleanupDependencies = defaultOrphanCleanupDependencies,
): Promise<ImageSetOrphanCleanupResult> {
  const retryDelays = [0, 250, 1_000];
  let job: ImageSetOrphanCleanupJob | null = null;
  for (let attempt = 0; attempt < retryDelays.length && !job; attempt += 1) {
    if (attempt > 0) await dependencies.waitForRetry(retryDelays[attempt]);
    try {
      job = await dependencies.upsertCleanupJob(input);
    } catch (error) {
      dependencies.logError(`[image-set] orphan cleanup record attempt ${attempt + 1} failed`, orphanCleanupError(error));
    }
  }
  // The database tombstone is the normal coordination path. If the database is
  // unavailable, still make a bounded best-effort delete so a provider outage
  // does not turn every late upload into a permanent blob orphan. This path is
  // intentionally bounded and never reports success unless the provider delete
  // itself completed.
  if (!job) {
    let directDeletionClaimed = false;
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      if (attempt > 0) await dependencies.waitForRetry(retryDelays[attempt]);
      try {
        if (!directDeletionClaimed) {
          const claim = await dependencies.claimOrphanDeletion(input);
          directDeletionClaimed = claim !== "blocked";
          if (!directDeletionClaimed) {
            dependencies.logError("[image-set] direct orphan delete skipped because the generation lease was not owned");
            return { resolved: false, deleted: false };
          }
        }
        // The row CAS above is the adoption barrier. Keep this check as a
        // second fail-closed guard for legacy paths that may have the same URL.
        const directFallbackJob: ImageSetOrphanCleanupJob = { id: "direct-fallback", ...input, attempts: 0 };
        if (await dependencies.isCurrentAsset(directFallbackJob)) {
          dependencies.logError("[image-set] direct orphan delete skipped because the asset is already current");
          return { resolved: false, deleted: false };
        }
        await dependencies.deleteAsset(input.assetUrl);
        return { resolved: true, deleted: true };
      } catch (error) {
        dependencies.logError(`[image-set] direct orphan delete attempt ${attempt + 1} failed`, orphanCleanupError(error));
      }
    }
    return { resolved: false, deleted: false };
  }
  const cleanupExecution = dependencies.createCleanupLease();
  if (!await dependencies.claimCleanupJob(job, cleanupExecution)) {
    return { resolved: false, deleted: false };
  }

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (attempt > 0) await dependencies.waitForRetry(retryDelays[attempt]);
    try {
      if (await dependencies.isCurrentAsset(job)) {
        const resolved = await dependencies.completeCleanupJob(job, cleanupExecution);
        return { resolved, deleted: false };
      }
      await dependencies.deleteAsset(job.assetUrl);
      const resolved = await dependencies.completeCleanupJob(job, cleanupExecution);
      return { resolved, deleted: true };
    } catch (error) {
      const errorMessage = orphanCleanupError(error);
      try {
        await dependencies.recordCleanupFailure(job, cleanupExecution, errorMessage);
      } catch (recordError) {
        dependencies.logError("[image-set] orphan cleanup failure bookkeeping failed", recordError);
      }
      dependencies.logError(`[image-set] orphan asset delete attempt ${attempt + 1} failed`, errorMessage);
    }
  }
  await dependencies.releaseCleanupJob(job, cleanupExecution).catch((error) => {
    dependencies.logError("[image-set] orphan cleanup lease release failed; expiry will recover", orphanCleanupError(error));
  });
  return { resolved: false, deleted: false };
}

function extension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function roleFailureMessage(role: ImageSetRole, timedOut = false, error?: unknown): string {
  const labels: Record<ImageSetRole, string> = {
    hero: "商品主體",
    detail: "質地細節",
    lifestyle: "使用情境",
    background: "情境背景",
    benefit: "賣點視覺",
    decoration: "品牌裝飾",
  };
  if (error instanceof ImageSetFallbackBudgetError) {
    return `${labels[role]}剩餘生成時間不足，未啟動下一個備援服務；可單獨重新產生。`;
  }
  return timedOut
    ? `${labels[role]}生成逾時，可單獨重新產生；其他素材不受影響。`
    : `${labels[role]}生成失敗，可單獨重新產生；其他素材仍可繼續生成。`;
}

function isConcreteProvider(provider: string): boolean {
  const value = provider.trim();
  return !!value && !/(^|:)unreported(?:\+|$)/i.test(value);
}

function parseToneLabels(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function asImageSetProduct(product: Pick<StoredImageSetProduct,
  "id" | "clientId" | "name" | "category" | "description" | "primaryColorOverride" | "rawImageUrls" | "heroImageUrl"
>): ImageSetProduct {
  return { ...product, rawImageUrls: parseRawImageUrls(product.rawImageUrls) };
}

function imageSetBrand(client: ImageSetClient, primaryColorOverride?: string | null) {
  return {
    primaryColor: primaryColorOverride || client?.primaryColor || undefined,
    toneLabels: parseToneLabels(client?.toneLabels),
  };
}

function suggestionsFor(profile: ProductVisualProfile, artDirection: ImageSetArtDirection): ImageSetSuggestion[] {
  const paletteDirection = [
    artDirection.palette.dominant.length ? `產品主色：${artDirection.palette.dominant.join("、")}` : "",
    artDirection.palette.accent.length ? `品牌輔色：${artDirection.palette.accent.join("、")}，僅作點綴，不作主色` : "",
  ].filter(Boolean).join("；");
  return planImageSetRoles(profile).map(({ role, label, usageDescription, path, cutout, sceneCn }) => ({
    role,
    label,
    usageDescription,
    path,
    cutout,
    sceneCn: [sceneCn, artDirection.concept && `視覺方向：${artDirection.concept}`, paletteDirection].filter(Boolean).join("；"),
  }));
}

function cachedProfileFor(product: StoredImageSetProduct): { profile: ProductVisualProfile | null; sourceHash: string } {
  const imageProduct = asImageSetProduct(product);
  const sourceHash = computeProductVisualSourceHash(imageProduct);
  try {
    const profile = parseProductVisualProfile(JSON.parse(product.visualProfileJson || "{}"));
    return { profile: profile && product.visualProfileSourceHash === sourceHash ? profile : null, sourceHash };
  } catch {
    return { profile: null, sourceHash };
  }
}

export type ProductImageSetDraftData = {
  id: string;
  productId: string;
  themeKey: string | null;
  themeLabel: string | null;
  artDirectionJson: string;
  planJson: string;
  status: "DRAFT";
};

export type PlanProductImageSetDependencies = {
  createBatchId: () => string;
  createDraft: (data: ProductImageSetDraftData) => Promise<unknown>;
  buildArtDirection?: (
    profile: ProductVisualProfile,
    brand: ProductBrandFacts,
    theme: ImageSetTheme | null,
  ) => ImageSetArtDirection;
  /** 打 LLM 整理賣點；注入而不是直接 import，測試才不用真的連網。 */
  chatText?: (prompt: string) => Promise<string | null>;
};

export type PlanProductImageSetResult =
  | { ok: true; value: {
    batchId: string;
    productId: string;
    theme: ImageSetTheme | null;
    themes: ImageSetTheme[];
    artDirection: ImageSetArtDirection;
    items: ImageSetPlanItem[];
    maxAssets: number;
  } }
  | { ok: false; status: 400 | 409; error: string };

function publicPlanItem(role: ReturnType<typeof planImageSetRoles>[number]): ImageSetPlanItem {
  const {
    id, category, assetRole, assetSubtype, purpose, core, defaultSelected,
    benefitIconStyle, benefitTitle, benefitDescription,
  } = role;
  return {
    id, category, assetRole, assetSubtype, purpose, core, defaultSelected,
    ...(benefitIconStyle ? { benefitIconStyle } : {}),
    // 清單用 benefitTitle 當主標題，排版階段用這兩個欄位渲染文字圖層。
    ...(benefitTitle ? { benefitTitle } : {}),
    ...(benefitDescription ? { benefitDescription } : {}),
  };
}

/**
 * 讀回這批草稿記錄的賣點圖示風格。風格是在「確認生成」那一刻選的，
 * 所以正常情況下請求會帶；這裡是後備，給沒帶風格的舊批次用。
 */
/**
 * 讀回規劃時整理好的賣點文字。舊批次沒有這些欄位，回 undefined 讓呼叫端
 * 退回規則拆解——那是這些批次原本就在用的推導方式，結果會一致。
 */
const BENEFIT_TITLE_MAX = 8;
const BENEFIT_DESCRIPTION_MAX = 16;

/**
 * 把使用者改過的賣點文字套回計畫。前端已經擋過一次，但這裡是付費生成的入口，
 * 不能只靠前端——標題空白會生出一張不知道在畫什麼的 icon。
 */
function applyBenefitTextEdits(
  plan: ImageSetPlanItem[],
  edits: Record<string, { title: string; description: string }> | undefined,
): { ok: true; plan: ImageSetPlanItem[] } | { ok: false; error: string } {
  if (!edits) return { ok: true, plan };
  const next: ImageSetPlanItem[] = [];
  for (const item of plan) {
    const edit = edits[item.id];
    if (!edit || !item.assetSubtype.startsWith("benefit-icon")) {
      next.push(item);
      continue;
    }
    const title = typeof edit.title === "string" ? edit.title.trim().slice(0, BENEFIT_TITLE_MAX) : "";
    if (!title) return { ok: false, error: "賣點標題不能留空" };
    const description = typeof edit.description === "string"
      ? edit.description.trim().slice(0, BENEFIT_DESCRIPTION_MAX)
      : "";
    next.push({
      ...item,
      benefitTitle: title,
      ...(description ? { benefitDescription: description } : { benefitDescription: undefined }),
      purpose: description ? `${title}——${description}` : title,
    });
  }
  return { ok: true, plan: next };
}

function storedBenefitPoints(plan: ImageSetPlanItem[]): BenefitPoint[] | undefined {
  const icons = plan.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
  if (!icons.length || !icons.every(({ benefitTitle }) => benefitTitle)) return undefined;
  return icons.map(({ benefitTitle, benefitDescription, benefitIconConcept }) => ({
    title: benefitTitle as string,
    description: benefitDescription ?? "",
    iconConcept: benefitIconConcept ?? "",
  }));
}

function storedBenefitIconStyle(plan: ImageSetPlanItem[]): BenefitIconStyle | undefined {
  return plan.find(({ benefitIconStyle }) => benefitIconStyle)?.benefitIconStyle;
}

/** Creates a free, immutable planning snapshot from the current cached product analysis. */
export async function planProductImageSet(
  request: {
    product: StoredImageSetProduct;
    client: ImageSetClient;
    themeKey?: string;
    themeKind?: ImageSetTheme["kind"];
  },
  dependencies: PlanProductImageSetDependencies,
): Promise<PlanProductImageSetResult> {
  const { profile } = cachedProfileFor(request.product);
  if (!profile) {
    return { ok: false, status: 409, error: "商品資料或圖片已更新，請先重新分析產品後再規劃套圖。" };
  }
  let theme: ImageSetTheme | null;
  try {
    theme = resolveImageSetTheme(request.themeKey, request.themeKind);
  } catch (error) {
    return { ok: false, status: 400, error: error instanceof Error ? error.message : "套圖主題資料無效" };
  }
  const buildDirection = dependencies.buildArtDirection ?? buildImageSetArtDirection;
  const artDirection = buildDirection(profile, imageSetBrand(request.client, request.product.primaryColorOverride), theme);
  // 賣點由 LLM 整理（規則拆解切得出句子，切不出「不同面向」），結果跟著
  // planJson 存下來，確認階段直接讀存好的，不重算——否則兩次的賣點可能不同。
  // LLM 失敗時 extractBenefitPoints 會自己退回規則版本。
  const benefitPoints = await extractBenefitPoints(
    { name: request.product.name, category: request.product.category, description: request.product.description },
    profile.useCases,
    dependencies.chatText ?? chatTextOpenRouter,
  );
  // 規劃階段不需要知道賣點圖示風格：planJson 只存 id／角色／用途，不含提示詞，
  // 而風格只改提示詞。風格留到「確認生成」那一刻再選。
  const items = planImageSetRoles({ profile, artDirection, theme: theme ?? undefined, benefitPoints }).map(publicPlanItem);
  const batchId = dependencies.createBatchId();
  await dependencies.createDraft({
    id: batchId,
    productId: request.product.id,
    themeKey: theme?.key ?? null,
    themeLabel: theme?.label ?? null,
    artDirectionJson: JSON.stringify(artDirection),
    planJson: JSON.stringify(items),
    status: "DRAFT",
  });
  return {
    ok: true,
    value: {
      batchId,
      productId: request.product.id,
      theme,
      themes: imageSetThemeCatalog(),
      artDirection,
      items,
      maxAssets: IMAGE_SET_MAX_ASSETS,
    },
  };
}

export type ImageSetAnalysisDependencies = {
  analyze: (product: ImageSetProduct, signal?: AbortSignal) => Promise<ProductVisualProfile>;
  persistProfile: (productId: string, data: {
    visualProfileJson: string;
    visualProfileSourceHash: string;
    visualProfileUpdatedAt: Date;
  }, execution: ImageSetExecution, checkedAt: Date) => Promise<boolean>;
  now?: () => Date;
};

const defaultAnalysisDependencies: ImageSetAnalysisDependencies = {
  analyze: (product, signal) => analyzeProductVisualProfile(product, {}, signal),
  persistProfile: async (productId, data, execution, checkedAt) => {
    void checkedAt;
    return persistProductVisualProfileWithLease({
      productId,
      leaseId: execution.leaseId,
      deadlineAt: execution.deadlineAt,
      ...data,
    });
  },
};

/** Builds the GET payload strictly from stored data. Dependency arguments are accepted
 * in tests to prove this path never invokes analysis or persistence. */
export async function readImageSetProduct(
  product: StoredImageSetProduct,
  client: ImageSetClient,
  dependencies?: Partial<ImageSetAnalysisDependencies>,
) {
  void dependencies;
  const { profile, sourceHash } = cachedProfileFor(product);
  const artDirection = profile ? buildImageSetArtDirection(profile, imageSetBrand(client, product.primaryColorOverride)) : null;
  const suggestionProfile = profile ?? fallbackProductVisualProfile(asImageSetProduct(product));
  const suggestionDirection = artDirection ?? buildImageSetArtDirection(suggestionProfile, imageSetBrand(client, product.primaryColorOverride));
  return {
    profile,
    artDirection,
    suggestions: suggestionsFor(suggestionProfile, suggestionDirection),
    needsAnalysis: !profile,
    hasHero: !!product.heroImageUrl,
    sourceImageCount: countProductVisualReferenceImages(asImageSetProduct(product)),
    sourceHash,
  };
}

export async function analyzeImageSetProduct(
  product: StoredImageSetProduct,
  client: ImageSetClient,
  force: boolean,
  dependencies: ImageSetAnalysisDependencies = defaultAnalysisDependencies,
  signal?: AbortSignal,
  execution?: ImageSetExecution,
) {
  const imageProduct = asImageSetProduct(product);
  const { profile: cachedProfile, sourceHash } = cachedProfileFor(product);
  const cached = !force && !!cachedProfile;
  const profile = cachedProfile && !force
    ? cachedProfile
    : await dependencies.analyze(imageProduct, signal);
  signal?.throwIfAborted();
  if (!cached) {
    if (!execution) throw new Error("Analysis persistence requires an active product lease");
    const checkedAt = (dependencies.now ?? (() => new Date()))();
    if (checkedAt.getTime() >= execution.deadlineAt) throw new Error("Analysis lease ownership was lost before persistence");
    const persisted = await dependencies.persistProfile(product.id, {
      visualProfileJson: JSON.stringify(profile),
      visualProfileSourceHash: sourceHash,
      visualProfileUpdatedAt: checkedAt,
    }, execution, checkedAt);
    if (!persisted) throw new Error("Analysis lease ownership was lost before persistence");
  }
  const artDirection = buildImageSetArtDirection(profile, imageSetBrand(client, product.primaryColorOverride));
  return {
    profile,
    artDirection,
    suggestions: suggestionsFor(profile, artDirection),
    cached,
    sourceHash,
  };
}

export const IMAGE_SET_FORCE_ANALYSIS_COOLDOWN_MS = 60_000;

export type RequestImageSetAnalysisDependencies<T> = {
  now: () => number;
  claimProductLease: (productId: string, execution: ImageSetExecution, kind: "analysis") => Promise<boolean>;
  releaseProductLease: (productId: string, leaseId: string) => Promise<unknown>;
  analyze: (signal?: AbortSignal) => Promise<T>;
};

export type RequestImageSetAnalysisResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 409 | 429; error: string };

/** Applies a durable product-wide paid-operation lease and force-analysis cooldown. */
export async function requestImageSetAnalysis<T>(
  request: {
    product: StoredImageSetProduct;
    client: ImageSetClient;
    force: boolean;
    execution: ImageSetExecution;
    signal?: AbortSignal;
  },
  dependencies: RequestImageSetAnalysisDependencies<T>,
): Promise<RequestImageSetAnalysisResult<T>> {
  const now = dependencies.now();
  if (
    request.force &&
    request.product.visualProfileUpdatedAt &&
    now - request.product.visualProfileUpdatedAt.getTime() < IMAGE_SET_FORCE_ANALYSIS_COOLDOWN_MS
  ) {
    return { ok: false, status: 429, error: "產品剛完成分析，請稍候一分鐘再強制重新分析。" };
  }
  if (request.execution.deadlineAt <= now || request.signal?.aborted) {
    return { ok: false, status: 409, error: "這次分析請求已逾時，請再試一次。" };
  }
  const claimed = await dependencies.claimProductLease(request.product.id, request.execution, "analysis");
  if (!claimed) return { ok: false, status: 409, error: "這項產品已有付費處理正在進行，請稍候再試。" };
  try {
    return { ok: true, value: await dependencies.analyze(request.signal) };
  } finally {
    await dependencies.releaseProductLease(request.product.id, request.execution.leaseId).catch(() => {});
  }
}

export function createImageSetRowParams(
  input: Pick<ImageSetBatchInput, "sourceHash" | "profile" | "artDirection">,
  roleSpec: ImageSetRoleSpec,
  provider?: string,
): ImageSetRowParams {
  return {
    imageSet: true,
    profileVersion: input.profile.version,
    sourceHash: input.sourceHash,
    artDirection: input.artDirection,
    roleSpec,
    ...(provider ? { provider } : {}),
  };
}

async function defaultLoadAsDataUri(url: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  let buffer: Buffer;
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0) throw new Error("Invalid data URI");
    const metadata = url.slice(0, comma);
    const payload = url.slice(comma + 1);
    buffer = Buffer.from(metadata.includes(";base64") ? payload : decodeURIComponent(payload), metadata.includes(";base64") ? "base64" : "utf8");
  } else {
    buffer = Buffer.from(await loadBuffer(url, signal));
  }
  const png = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  signal?.throwIfAborted();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function loadReferenceDataUris(
  product: ImageSetProduct,
  batchHeroImageUrl: string | undefined,
  loadAsDataUri: (url: string, signal?: AbortSignal) => Promise<string>,
  signal?: AbortSignal,
): Promise<{ heroImageUrl?: string; rawImageUrls: string[]; batchHeroImageUrl?: string }> {
  const hero = product.heroImageUrl || undefined;
  const raw = [...new Set((product.rawImageUrls ?? []).filter(Boolean))].filter((url) => url !== hero);
  const urls = [...raw.slice(0, hero ? 4 : 5), ...(hero ? [hero] : [])];
  signal?.throwIfAborted();
  const settled = await Promise.allSettled(urls.map((url) => loadAsDataUri(url, signal)));
  signal?.throwIfAborted();
  const loaded = settled.flatMap((entry, index) => entry.status === "fulfilled" ? [{ url: urls[index], dataUri: entry.value }] : []);
  if (!loaded.length) {
    const failures = settled.flatMap((entry) => entry.status === "rejected" ? [entry.reason] : []);
    throw new AggregateError(failures, "No usable product reference image remains");
  }
  const heroDataUri = hero ? loaded.find((entry) => entry.url === hero)?.dataUri : undefined;
  let batchHeroDataUri: string | undefined;
  if (batchHeroImageUrl) {
    try {
      batchHeroDataUri = await loadAsDataUri(batchHeroImageUrl, signal);
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      // The generated hero is only a style anchor. Product identity references remain authoritative.
    }
  }
  return {
    rawImageUrls: loaded.map((entry) => entry.dataUri),
    ...(heroDataUri ? { heroImageUrl: heroDataUri } : {}),
    ...(batchHeroDataUri ? { batchHeroImageUrl: batchHeroDataUri } : {}),
  };
}

const defaultDependencies: ImageSetBatchDependencies = {
  transitionRow: async (id, from, data, execution) => {
    const result = await db.libraryImage.updateMany({ where: { id, status: { in: from }, generationLeaseId: execution.leaseId }, data });
    return result.count === 1;
  },
  completeRow: (id, data, execution) => completeGeneratedImageSetRowWithLease({
    rowId: id,
    leaseId: execution.leaseId,
    deadlineAt: execution.deadlineAt,
    imageUrl: data.imageUrl,
    prompt: data.prompt,
    paramsJson: data.paramsJson,
    hasTransparentBackground: data.hasTransparentBackground,
  }),
  failUnfinishedRows: (rows, execution) => db.$transaction(rows.map(({ id, errorMessage }) => db.libraryImage.updateMany({
    where: { id, status: { in: ["PENDING", "GENERATING"] }, generationLeaseId: execution.leaseId },
    data: { status: "FAILED", errorMessage, generationLeaseId: null, generationLeaseExpiresAt: null },
  }))),
  inspectTransparency: hasTransparentPixels,
  generateRole: generateImageSetRole,
  saveBuffer,
  cleanupOrphanAsset: cleanupImageSetOrphanAsset,
  loadAsDataUri: defaultLoadAsDataUri,
  setDeadlineTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearDeadlineTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  createAbortController: () => new AbortController(),
  waitForCleanupRetry: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  now: Date.now,
  logError: (...values) => console.error(...values),
};

/**
 * Generates one product image-set batch. Every row owns its own error boundary;
 * callers can await the function safely even if one or several image providers fail.
 */
export async function runImageSetBatch(
  input: ImageSetBatchInput,
  dependencies: ImageSetBatchDependencies = defaultDependencies,
  execution: ImageSetExecution = createImageSetExecution((dependencies.now ?? Date.now)(), `legacy_${input.batchId}`),
): Promise<ImageSetBatchResult> {
  const result: ImageSetBatchResult = { statuses: {}, params: {} };
  const loadAsDataUri = dependencies.loadAsDataUri ?? defaultLoadAsDataUri;
  const logError = dependencies.logError ?? defaultDependencies.logError!;
  const transitionRow = dependencies.transitionRow ?? (async (id, _from, data) => {
    if (!dependencies.updateRow) throw new Error("Missing row transition dependency");
    await dependencies.updateRow(id, data);
    return true;
  });
  const completeRow = dependencies.completeRow ?? (
    dependencies.transitionRow || dependencies.updateRow
      ? (id, data, value) => transitionRow(id, ["GENERATING"], {
        status: "DONE",
        ...data,
        errorMessage: null,
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      }, value)
      : defaultDependencies.completeRow!
  );
  const failUnfinishedRows = dependencies.failUnfinishedRows ?? (async (rows) => {
    if (!dependencies.updateRow) throw new Error("Missing unfinished-row dependency");
    await Promise.all(rows.map(({ id, errorMessage }) => dependencies.updateRow!(id, { status: "FAILED", errorMessage })));
  });
  const setDeadlineTimer = dependencies.setDeadlineTimer ?? defaultDependencies.setDeadlineTimer!;
  const clearDeadlineTimer = dependencies.clearDeadlineTimer ?? defaultDependencies.clearDeadlineTimer!;
  const cleanupOrphanAsset = dependencies.cleanupOrphanAsset ?? defaultDependencies.cleanupOrphanAsset!;
  const waitForCleanupRetry = dependencies.waitForCleanupRetry ?? defaultDependencies.waitForCleanupRetry!;
  const now = dependencies.now ?? Date.now;
  const inspectTransparency = dependencies.inspectTransparency ?? defaultDependencies.inspectTransparency!;
  const abortController = (dependencies.createAbortController ?? defaultDependencies.createAbortController!)();
  const reachedDeadline = () => abortController.signal.aborted || now() >= execution.deadlineAt;

  const deleteOrphan = async (row: ImageSetRow, url: string) => {
    try {
      await cleanupOrphanAsset({
        productId: input.product.id,
        libraryImageId: row.id,
        generationLeaseId: execution.leaseId,
        assetUrl: url,
      });
    } catch (error) {
      logError("[image-set] orphan asset cleanup failed", error);
    }
  };

  const runRow = async (row: ImageSetRow, batchHeroImageUrl?: string): Promise<string | undefined> => {
    const role = normalizePhysicalDetailRoleSpec(row.role);
    const initialParams = createImageSetRowParams(input, role);
    try {
      const claimed = await transitionRow(row.id, ["PENDING", "GENERATING"], {
        status: "GENERATING",
        errorMessage: null,
        paramsJson: JSON.stringify(initialParams),
        generationLeaseId: execution.leaseId,
        generationLeaseExpiresAt: new Date(execution.deadlineAt),
      }, execution);
      if (!claimed) {
        result.statuses[role.role] = "FAILED";
        result.params[role.role] = initialParams;
        return undefined;
      }
      if (reachedDeadline()) {
        await transitionRow(row.id, ["GENERATING"], {
          status: "FAILED",
          errorMessage: roleFailureMessage(role.role, true),
          paramsJson: JSON.stringify(initialParams),
          generationLeaseId: null,
          generationLeaseExpiresAt: null,
        }, execution).catch(() => {});
        result.statuses[role.role] = "FAILED";
        result.params[role.role] = initialParams;
        return undefined;
      }
      const references = role.path === "edit" || role.path === "crop" || role.path === "cutout"
        ? await loadReferenceDataUris(input.product, batchHeroImageUrl, loadAsDataUri, abortController.signal)
        : { rawImageUrls: [] as string[] };
      const prompt = compileImageSetPrompt({
        product: { name: input.product.name, category: input.product.category, description: input.product.description },
        profile: input.profile,
        artDirection: input.artDirection,
        role,
      });
      abortController.signal.throwIfAborted();
      const generated = await dependencies.generateRole({
        role: role.role,
        prompt,
        heroImageUrl: references.heroImageUrl,
        rawImageUrls: references.rawImageUrls,
        batchHeroImageUrl: references.batchHeroImageUrl,
        aspectRatio: "1:1",
        signal: abortController.signal,
        deadlineAt: execution.deadlineAt,
        generationPath: role.path,
      });
      if (!isConcreteProvider(generated.provider)) throw new Error("Image provider trace is missing or synthetic");
      if (reachedDeadline()) throw new Error("Image-set batch deadline reached");
      const hasTransparentBackground = await inspectTransparency(generated.buffer);
      const imageUrl = await dependencies.saveBuffer(
        generated.buffer,
        extension(generated.contentType),
        `product-set-${role.role}-`,
        abortController.signal,
      );
      const finalParams = createImageSetRowParams(input, role, generated.provider);
      if (reachedDeadline()) {
        await deleteOrphan(row, imageUrl);
        throw abortController.signal.reason ?? new Error("Image-set batch deadline reached");
      }
      const completed = !reachedDeadline() && await completeRow(row.id, {
        imageUrl,
        prompt,
        paramsJson: JSON.stringify(finalParams),
        hasTransparentBackground,
      }, execution);
      if (!completed) {
        await deleteOrphan(row, imageUrl);
        result.statuses[role.role] = "FAILED";
        result.params[role.role] = initialParams;
        return undefined;
      }
      result.statuses[role.role] = "DONE";
      result.params[role.role] = finalParams;
      return imageUrl;
    } catch (error) {
      logError(`[image-set:${role.role}] generation failed`, error);
      result.statuses[role.role] = "FAILED";
      result.params[role.role] = initialParams;
      await transitionRow(row.id, ["PENDING", "GENERATING"], {
        status: "FAILED",
        errorMessage: roleFailureMessage(role.role, reachedDeadline(), error),
        paramsJson: JSON.stringify(initialParams),
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      }, execution).catch(() => {});
      return undefined;
    }
  };

  let resolveDeadline!: () => void;
  const deadline = new Promise<void>((resolve) => { resolveDeadline = resolve; });
  let deadlineCleanupStarted = false;
  const finishAtDeadline = async () => {
    if (deadlineCleanupStarted) return deadline;
    deadlineCleanupStarted = true;
    if (!abortController.signal.aborted) abortController.abort(new Error("Image-set absolute deadline reached"));
    const unfinished = input.rows.filter((row) => result.statuses[row.role.role] !== "DONE");
    const cleanupRows = unfinished.map((row) => ({ id: row.id, errorMessage: roleFailureMessage(row.role.role, true) }));
    const retryDelays = [0, 1_000, 3_000];
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      if (attempt > 0) await waitForCleanupRetry(retryDelays[attempt]);
      try {
        await failUnfinishedRows(cleanupRows, execution);
        break;
      } catch (error) {
        logError(`[image-set] deadline cleanup attempt ${attempt + 1} failed`, error);
      }
    }
    for (const row of unfinished) {
      result.statuses[row.role.role] = "FAILED";
      result.params[row.role.role] = createImageSetRowParams(input, row.role);
    }
    resolveDeadline();
  };
  const remainingMs = Math.max(0, execution.deadlineAt - now());
  const timer = remainingMs > 0
    ? setDeadlineTimer(() => { void finishAtDeadline(); }, remainingMs)
    : undefined;
  if (remainingMs === 0) void finishAtDeadline();

  const work = (async () => {
    const hero = input.rows.find((row) => row.role.role === "hero");
    const heroUrl = hero ? await runRow(hero) : undefined;
    const remaining = input.rows.filter((row) => row !== hero);

    // The hero is deliberately serialized. All other selected roles are independent
    // and are allowed to proceed even when hero generation did not produce an anchor.
    await Promise.all(remaining.map((row) => runRow(
      row,
      (row.role.role === "detail" || row.role.role === "lifestyle") ? heroUrl : undefined,
    )));
  })();

  const winner = await Promise.race([work.then(() => "work" as const), deadline.then(() => "deadline" as const)]);
  if (deadlineCleanupStarted) await deadline;
  else if (winner === "work" && timer !== undefined) clearDeadlineTimer(timer);
  return result;
}

export type ExpiredImageSetRow = {
  id: string;
  assetRole: ImageSetRole;
  generationLeaseId: string;
  generationLeaseExpiresAt: Date;
};

export type ReconcileStaleImageSetDependencies = {
  listExpiredRows: (productId: string, cutoff: Date) => Promise<ExpiredImageSetRow[]>;
  failExpiredRow: (row: ExpiredImageSetRow, cutoff: Date) => Promise<boolean>;
  releaseExpiredProductLease: (productId: string, cutoff: Date) => Promise<boolean>;
  listOrphanCleanupJobs: (productId: string) => Promise<ImageSetOrphanCleanupJob[]>;
  cleanupOrphanAsset: (job: ImageSetOrphanCleanupJob) => Promise<ImageSetOrphanCleanupResult>;
};

export type ReconcileImageSetCleanupDependencies = {
  listOrphanCleanupJobs: (limit: number) => Promise<ImageSetOrphanCleanupJob[]>;
  cleanupOrphanAsset: (job: ImageSetOrphanCleanupJob) => Promise<ImageSetOrphanCleanupResult>;
};

const imageSetRoles = new Set<ImageSetRole>(["hero", "detail", "lifestyle", "background", "benefit", "decoration"]);

const defaultReconcileDependencies: ReconcileStaleImageSetDependencies = {
  listExpiredRows: async (productId, cutoff) => {
    const rows = await db.libraryImage.findMany({
      where: {
        productId,
        status: { in: ["PENDING", "GENERATING"] },
        generationLeaseId: { not: null },
        generationLeaseExpiresAt: { lte: cutoff },
      },
      select: { id: true, assetRole: true, generationLeaseId: true, generationLeaseExpiresAt: true },
    });
    return rows.flatMap((row) => (
      row.assetRole && imageSetRoles.has(row.assetRole as ImageSetRole) && row.generationLeaseId && row.generationLeaseExpiresAt
        ? [{ ...row, assetRole: row.assetRole as ImageSetRole, generationLeaseId: row.generationLeaseId, generationLeaseExpiresAt: row.generationLeaseExpiresAt }]
        : []
    ));
  },
  failExpiredRow: async (row, cutoff) => {
    const result = await db.libraryImage.updateMany({
      where: {
        id: row.id,
        status: { in: ["PENDING", "GENERATING"] },
        generationLeaseId: row.generationLeaseId,
        generationLeaseExpiresAt: { equals: row.generationLeaseExpiresAt, lte: cutoff },
      },
      data: {
        status: "FAILED",
        errorMessage: roleFailureMessage(row.assetRole, true),
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      },
    });
    return result.count === 1;
  },
  releaseExpiredProductLease: async (productId, cutoff) => {
    const result = await db.product.updateMany({
      where: { id: productId, paidOperationLeaseId: { not: null }, paidOperationLeaseExpiresAt: { lte: cutoff } },
      data: { paidOperationLeaseId: null, paidOperationLeaseExpiresAt: null, paidOperationKind: null },
    });
    return result.count === 1;
  },
  listOrphanCleanupJobs: (productId) => db.imageAssetCleanupJob.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  }),
  cleanupOrphanAsset: (job) => cleanupImageSetOrphanAsset(job),
};

const defaultCleanupReconcileDependencies: ReconcileImageSetCleanupDependencies = {
  // Cleanup jobs deliberately have no product FK, so this query remains useful
  // after a product or library row has been deleted. A bounded batch keeps a
  // request-triggered reconciler safe on serverless runtimes.
  listOrphanCleanupJobs: (limit) => db.imageAssetCleanupJob.findMany({
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
  }),
  cleanupOrphanAsset: (job) => cleanupImageSetOrphanAsset(job),
};

/** Drains durable cleanup tombstones globally, including jobs whose product was deleted. */
export async function reconcileImageSetCleanupJobs(
  limit = 25,
  dependencies: ReconcileImageSetCleanupDependencies = defaultCleanupReconcileDependencies,
): Promise<number> {
  const jobs = await dependencies.listOrphanCleanupJobs(limit);
  const results = await Promise.all(jobs.map((job) => dependencies.cleanupOrphanAsset(job)));
  return results.filter((result) => result.resolved).length;
}

/** Recovers work abandoned by a killed function. Every write is a status + lease + expiry CAS. */
export async function reconcileStaleImageSetWork(
  productId: string,
  cutoff: Date = new Date(),
  dependencies: ReconcileStaleImageSetDependencies = defaultReconcileDependencies,
): Promise<{ failedRows: number; releasedProductLease: boolean; cleanedAssets: number }> {
  const rows = await dependencies.listExpiredRows(productId, cutoff);
  const settled = await Promise.all(rows.map((row) => dependencies.failExpiredRow(row, cutoff)));
  const releasedProductLease = await dependencies.releaseExpiredProductLease(productId, cutoff);
  const cleanupJobs = await dependencies.listOrphanCleanupJobs(productId);
  const cleanupResults = await Promise.all(cleanupJobs.map((job) => dependencies.cleanupOrphanAsset(job)));
  return {
    failedRows: settled.filter(Boolean).length,
    releasedProductLease,
    cleanedAssets: cleanupResults.filter((result) => result.resolved).length,
  };
}

export type ImageSetPendingRowData = {
  clientId: string;
  productId: string;
  assetRole: ImageSetRole;
  assetSubtype?: string;
  subject: string;
  status: "PENDING";
  batchId: string;
  prompt?: string;
  paramsJson: string;
  generationLeaseId: string;
  generationLeaseExpiresAt: Date;
};

export type CreateImageSetBatchDependencies = {
  createRows: (rows: ImageSetPendingRowData[]) => Promise<Array<{ id: string }>>;
  claimProductLease: (productId: string, execution: ImageSetExecution) => Promise<boolean>;
  releaseProductLease: (productId: string, leaseId: string) => Promise<unknown>;
  failCreatedRows?: (rowIds: string[], execution: ImageSetExecution) => Promise<boolean>;
  scheduleAfter: (callback: () => Promise<unknown>) => void;
  runBatch: (input: ImageSetBatchInput, execution: ImageSetExecution) => Promise<unknown>;
  createBatchId: () => string;
};

export type CreateImageSetBatchResult =
  | { ok: true; batchId: string; items: Array<{ id: string; role: ImageSetRole; label: string; status: "PENDING" }> }
  | { ok: false; status: 400 | 409; error: string };

/** Validates a confirmed analysis snapshot, creates the complete PENDING batch,
 * then registers one background callback without waiting for generation. */
export async function createAndScheduleImageSetBatch(
  request: {
    product: StoredImageSetProduct;
    client: ImageSetClient;
    selectedRoles: string[];
    requestSourceHash?: string;
    execution: ImageSetExecution;
  },
  dependencies: CreateImageSetBatchDependencies,
): Promise<CreateImageSetBatchResult> {
  const { product, client, selectedRoles, requestSourceHash, execution } = request;
  if (!selectedRoles.length) return { ok: false, status: 400, error: "未選擇任何套圖" };
  const { profile, sourceHash } = cachedProfileFor(product);
  if (!profile) return { ok: false, status: 409, error: "商品資料或圖片已更新，請先重新分析產品後再建立套圖。" };
  if (requestSourceHash && requestSourceHash !== sourceHash) {
    return { ok: false, status: 409, error: "商品分析已過期，請重新分析產品後再建立套圖。" };
  }

  const roleMap = new Map<ImageSetRole, ImageSetRoleSpec>(
    planImageSetRoles(profile).map((role) => [role.role, role]),
  );
  const roles = selectedRoles.map((role) => roleMap.get(role as ImageSetRole)).filter((role): role is ImageSetRoleSpec => !!role);
  if (roles.length !== selectedRoles.length) return { ok: false, status: 400, error: "套圖角色資料無效，請重新選擇。" };

  const imageProduct = asImageSetProduct(product);
  if (roles.some((role) => role.path === "cutout") && !imageProduct.rawImageUrls.some(Boolean)) {
    return { ok: false, status: 400, error: "需要至少一張原始商品照，才能建立商品主體去背 PNG。" };
  }
  if (roles.some((role) => role.path === "edit" || role.path === "crop") && ![...imageProduct.rawImageUrls, imageProduct.heroImageUrl].some(Boolean)) {
    return { ok: false, status: 400, error: "需要至少一張商品照，才能建立產品參考素材。" };
  }

  const artDirection = buildImageSetArtDirection(profile, imageSetBrand(client, product.primaryColorOverride));
  const claimed = await dependencies.claimProductLease(product.id, execution);
  if (!claimed) return { ok: false, status: 409, error: "這項產品已有套圖正在生成，請等待完成後再試。" };
  const batchId = dependencies.createBatchId();
  const pendingRows: ImageSetPendingRowData[] = roles.map((role) => ({
    clientId: product.clientId,
    productId: product.id,
    assetRole: role.role,
    subject: role.label,
    status: "PENDING",
    batchId,
    paramsJson: JSON.stringify(createImageSetRowParams({ sourceHash, profile, artDirection }, role)),
    generationLeaseId: execution.leaseId,
    generationLeaseExpiresAt: new Date(execution.deadlineAt),
  }));
  let created: Array<{ id: string }>;
  try {
    created = await dependencies.createRows(pendingRows);
  } catch (error) {
    await dependencies.releaseProductLease(product.id, execution.leaseId).catch(() => {});
    throw error;
  }
  const batchInput: ImageSetBatchInput = {
    batchId,
    sourceHash,
    profile,
    artDirection,
    product: imageProduct,
    rows: created.map((row, index) => ({ id: row.id, role: roles[index] })),
  };
  try {
    dependencies.scheduleAfter(async () => {
      try {
        return await dependencies.runBatch(batchInput, execution);
      } finally {
        await dependencies.releaseProductLease(product.id, execution.leaseId).catch(() => {});
      }
    });
  } catch (error) {
    const cleaned = await dependencies.failCreatedRows?.(created.map((row) => row.id), execution).catch(() => false) ?? false;
    if (cleaned) await dependencies.releaseProductLease(product.id, execution.leaseId).catch(() => {});
    throw error;
  }
  return {
    ok: true,
    batchId,
    items: created.map((row, index) => ({
      id: row.id,
      role: roles[index].role,
      label: roles[index].label,
      status: "PENDING",
    })),
  };
}

export type StoredProductImageSetDraft = {
  id: string;
  productId: string;
  status: string;
  themeKey: string | null;
  themeLabel: string | null;
  artDirectionJson: string;
  planJson: string;
};

export type ConfirmedImageSetBatchData = {
  batchId: string;
  productId: string;
  artDirectionJson: string;
  planJson: string;
  confirmedAt: Date;
  rows: ImageSetPendingRowData[];
};

export type ConfirmProductImageSetDependencies = {
  loadDraft: (productId: string, batchId: string) => Promise<StoredProductImageSetDraft | null>;
  claimProductLease: (productId: string, execution: ImageSetExecution) => Promise<boolean>;
  releaseProductLease: (productId: string, leaseId: string) => Promise<unknown>;
  persistConfirmedBatch: (data: ConfirmedImageSetBatchData) => Promise<Array<{ id: string }> | null>;
  failCreatedRows?: (rowIds: string[], execution: ImageSetExecution) => Promise<boolean>;
  scheduleAfter: (callback: () => Promise<unknown>) => void;
  runBatch: (input: ImageSetBatchInput, execution: ImageSetExecution) => Promise<ImageSetBatchResult>;
  readBatchStatuses: (batchId: string, productId: string) => Promise<ImageSetRowStatus[]>;
  updateKitStatus: (batchId: string, status: Exclude<ImageSetKitStatus, "DRAFT" | "CONFIRMED">) => Promise<unknown>;
  now?: () => Date;
};

export type ConfirmProductImageSetResult =
  | { ok: true; batchId: string; items: Array<{ id: string; role: ImageSetRole; label: string; status: "PENDING" }> }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** Validates an immutable DRAFT snapshot before any lease or paid generation can begin. */
export async function confirmAndScheduleProductImageSet(
  request: {
    product: StoredImageSetProduct;
    client: ImageSetClient;
    batchId: string;
    selectedItemIds: string[];
    artDirection: unknown;
    /** 賣點圖示風格在確認這一刻決定；沒帶就沿用草稿裡記的（舊批次或重新確認）。 */
    benefitIconStyle?: BenefitIconStyle;
    /** 使用者在清單上改過的賣點文字，key 是計畫項目 id。AI 抓的不一定對。 */
    benefitTexts?: Record<string, { title: string; description: string }>;
    execution: ImageSetExecution;
  },
  dependencies: ConfirmProductImageSetDependencies,
): Promise<ConfirmProductImageSetResult> {
  if (!request.batchId.trim()) return { ok: false, status: 400, error: "缺少套圖批次" };
  if (!request.selectedItemIds.length) return { ok: false, status: 400, error: "至少要選擇一項素材" };
  if (request.selectedItemIds.length > IMAGE_SET_MAX_ASSETS) {
    return { ok: false, status: 400, error: `單批最多只能生成 ${IMAGE_SET_MAX_ASSETS} 項素材` };
  }
  if (new Set(request.selectedItemIds).size !== request.selectedItemIds.length) {
    return { ok: false, status: 400, error: "選取清單含有重複項目" };
  }
  const requestedArtDirection = parseImageSetArtDirection(request.artDirection);
  if (!requestedArtDirection) return { ok: false, status: 400, error: "套圖視覺方向格式不正確" };
  const { profile, sourceHash } = cachedProfileFor(request.product);
  if (!profile) return { ok: false, status: 409, error: "商品分析已過期，請重新規劃套圖。" };

  const draft = await dependencies.loadDraft(request.product.id, request.batchId);
  if (!draft || draft.productId !== request.product.id || draft.id !== request.batchId) {
    return { ok: false, status: 404, error: "找不到這項產品的套圖規劃" };
  }
  if (draft.status !== "DRAFT") return { ok: false, status: 409, error: "這份套圖規劃已確認或正在生成" };
  let storedArtDirection: ImageSetArtDirection | null = null;
  try {
    storedArtDirection = parseImageSetArtDirection(JSON.parse(draft.artDirectionJson));
  } catch {
    // Handled by the invalid persisted snapshot response below.
  }
  if (!storedArtDirection) return { ok: false, status: 409, error: "儲存的套圖視覺方向已失效，請重新規劃。" };
  const artDirection: ImageSetArtDirection = {
    ...requestedArtDirection,
    consistencyRules: storedArtDirection.consistencyRules,
  };

  let storedPlan: ImageSetPlanItem[];
  try {
    storedPlan = parseImageSetPlanJson(draft.planJson);
  } catch {
    return { ok: false, status: 409, error: "儲存的套圖規劃已失效，請重新規劃。" };
  }
  // 風格只影響提示詞，不影響 id／角色／子型別，所以下面的比對關卡抓不到風格不符。
  // 確認時選的才算數，草稿裡記的只是舊批次的後備值。
  const benefitIconStyle = request.benefitIconStyle ?? storedBenefitIconStyle(storedPlan);
  const selectedIds = new Set(request.selectedItemIds);
  // 使用者改過的賣點文字蓋掉草稿裡 AI 整理的版本；空標題不接受——標題就是這張
  // icon 要畫的東西，也是排版階段要渲染的字。
  const edited = applyBenefitTextEdits(storedPlan, request.benefitTexts);
  if (!edited.ok) return { ok: false, status: 400, error: edited.error };
  const selectedPlan = edited.plan
    .filter(({ id }) => selectedIds.has(id))
    // 存回這一批實際用到的風格，之後看紀錄才知道這組 icon 是怎麼生的。
    .map((item) => item.assetSubtype.startsWith("benefit-icon") && benefitIconStyle
      ? { ...item, benefitIconStyle }
      : item);
  if (selectedPlan.length !== selectedIds.size) return { ok: false, status: 400, error: "選取清單包含未知素材" };

  const theme = draft.themeKey
    ? imageSetThemeCatalog().find(({ key, label }) => key === draft.themeKey && label === draft.themeLabel) ?? null
    : null;
  if (draft.themeKey && !theme) return { ok: false, status: 409, error: "儲存的套圖主題已失效，請重新規劃。" };
  const currentSpecs = planImageSetRoles({
    profile,
    artDirection,
    theme: theme ?? undefined,
    // 規劃時 LLM 整理好的賣點存在 planJson 上，這裡讀回來，不重新問一次 LLM——
    // 重問會得到不同的賣點，跟使用者在清單上看到的對不起來。
    benefitPoints: storedBenefitPoints(edited.plan) ?? deriveBenefitPoints(request.product.description, profile.useCases),
    benefitIconStyle: benefitIconStyle ?? undefined,
  });
  const specsById = new Map(currentSpecs.map((spec) => [spec.id, spec]));
  const selectedSpecs = selectedPlan.map((item) => {
    const spec = specsById.get(item.id);
    if (!spec || spec.assetRole !== item.assetRole || spec.assetSubtype !== item.assetSubtype || spec.category !== item.category) return null;
    return spec;
  });
  if (selectedSpecs.some((spec) => !spec)) {
    // 最常見的原因是舊草稿：賣點圖示改成必須帶英文視覺描述之後（中文標題送進
    // 提示詞會被模型畫進圖裡），在那之前建立的草稿重算不出這幾張。與其丟一句
    // 讓人自己猜的通用錯誤，不如講清楚該按哪裡，而且要說明重建不用錢。
    const staleIcons = selectedPlan.filter((item, index) =>
      !selectedSpecs[index] && item.assetSubtype.startsWith("benefit-icon") && !item.benefitIconConcept);
    if (staleIcons.length) {
      return {
        ok: false,
        status: 409,
        error: "這份清單是賣點圖示更新前建立的，請按「重新選擇主題」再建立一次建議清單（不會扣款）。",
      };
    }
    return { ok: false, status: 409, error: "儲存的套圖角色或素材變化已失效，請重新規劃。" };
  }
  const roles = selectedSpecs.filter((spec): spec is NonNullable<typeof spec> => !!spec);
  const imageProduct = asImageSetProduct(request.product);
  if (roles.some(({ path }) => path === "cutout") && !imageProduct.rawImageUrls.some(Boolean)) {
    return { ok: false, status: 400, error: "需要至少一張原始商品照，才能建立商品主體去背 PNG。" };
  }
  if (roles.some(({ path }) => path === "edit" || path === "crop") && ![...imageProduct.rawImageUrls, imageProduct.heroImageUrl].some(Boolean)) {
    return { ok: false, status: 400, error: "需要至少一張商品照，才能建立產品參考素材。" };
  }

  const claimed = await dependencies.claimProductLease(request.product.id, request.execution);
  if (!claimed) return { ok: false, status: 409, error: "這項產品已有套圖正在生成，請等待完成後再試。" };
  const confirmedAt = (dependencies.now ?? (() => new Date()))();
  const pendingRows: ImageSetPendingRowData[] = roles.map((role) => ({
    clientId: request.product.clientId,
    productId: request.product.id,
    assetRole: role.role,
    assetSubtype: role.assetSubtype,
    subject: role.label,
    status: "PENDING",
    batchId: request.batchId,
    prompt: compileImageSetPrompt({ product: imageProduct, profile, artDirection, role }),
    paramsJson: JSON.stringify(createImageSetRowParams({ sourceHash, profile, artDirection }, role)),
    generationLeaseId: request.execution.leaseId,
    generationLeaseExpiresAt: new Date(request.execution.deadlineAt),
  }));
  const created = await dependencies.persistConfirmedBatch({
    batchId: request.batchId,
    productId: request.product.id,
    artDirectionJson: JSON.stringify(artDirection),
    planJson: JSON.stringify(selectedPlan),
    confirmedAt,
    rows: pendingRows,
  }).catch(async (error) => {
    await dependencies.releaseProductLease(request.product.id, request.execution.leaseId).catch(() => {});
    throw error;
  });
  if (!created || created.length !== roles.length) {
    await dependencies.releaseProductLease(request.product.id, request.execution.leaseId).catch(() => {});
    return { ok: false, status: 409, error: "這份套圖規劃已被其他請求確認" };
  }
  const batchInput: ImageSetBatchInput = {
    batchId: request.batchId,
    sourceHash,
    profile,
    artDirection,
    product: imageProduct,
    rows: created.map((row, index) => ({ id: row.id, role: roles[index] })),
  };
  try {
    dependencies.scheduleAfter(async () => {
      try {
        await dependencies.runBatch(batchInput, request.execution);
      } catch (error) {
        await dependencies.failCreatedRows?.(created.map(({ id }) => id), request.execution).catch(() => false);
        throw error;
      } finally {
        try {
          const statuses = await dependencies.readBatchStatuses(request.batchId, request.product.id);
          await dependencies.updateKitStatus(request.batchId, deriveImageSetKitStatus(statuses));
        } finally {
          await dependencies.releaseProductLease(request.product.id, request.execution.leaseId).catch(() => {});
        }
      }
    });
  } catch (error) {
    await dependencies.failCreatedRows?.(created.map(({ id }) => id), request.execution).catch(() => false);
    await dependencies.updateKitStatus(request.batchId, "FAILED").catch(() => {});
    await dependencies.releaseProductLease(request.product.id, request.execution.leaseId).catch(() => {});
    throw error;
  }
  return {
    ok: true,
    batchId: request.batchId,
    items: created.map((row, index) => ({ id: row.id, role: roles[index].role, label: roles[index].label, status: "PENDING" })),
  };
}

export type PreparedImageSetRegeneration = {
  rowId: string;
  input: ImageSetBatchInput;
};

export type ImageSetRegenerationPreparation =
  | { ok: true; value: PreparedImageSetRegeneration }
  | { ok: false; status: 400 | 404 | 409; error: string };

export type ImageSetRegenerationRow = {
  id: string;
  batchId: string | null;
  productId?: string | null;
  assetRole?: string | null;
  assetSubtype?: string | null;
  paramsJson: string;
  product: StoredImageSetProduct | null;
};

export type ProductImageSetRetrySnapshot = {
  id: string;
  productId: string;
  artDirectionJson: string;
  planJson: string;
};

function parseRawImageUrls(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string" && !!url.trim()) : [];
  } catch {
    return [];
  }
}

function parseImageSetParams(raw: string): ImageSetRowParams | null {
  try {
    const value = JSON.parse(raw) as Partial<ImageSetRowParams>;
    if (!value || value.imageSet !== true || value.profileVersion !== 1 || typeof value.sourceHash !== "string") return null;
    if (!value.artDirection || !value.roleSpec || typeof value.roleSpec.role !== "string") return null;
    return value as ImageSetRowParams;
  } catch {
    return null;
  }
}

function isValidSavedRoleSpec(role: unknown): role is ImageSetRoleSpec {
  if (!role || typeof role !== "object") return false;
  const value = role as Partial<ImageSetRoleSpec>;
  return (
    typeof value.role === "string" &&
    typeof value.label === "string" &&
    (value.path === "cutout" || value.path === "crop" || value.path === "edit" || value.path === "text") &&
    typeof value.cutout === "boolean" &&
    typeof value.sceneCn === "string" &&
    typeof value.objective === "string" &&
    typeof value.composition === "string" &&
    Array.isArray(value.mustNotShow) && value.mustNotShow.every((item) => typeof item === "string")
  );
}

function normalizePhysicalDetailRoleSpec(role: ImageSetRoleSpec): ImageSetRoleSpec {
  const saved = role as ImageSetRoleSpec & { assetSubtype?: string };
  if (saved.role !== "detail" || saved.assetSubtype === "formula-texture" || saved.path === "crop") return role;
  return {
    ...saved,
    path: "crop",
    mustNotShow: saved.mustNotShow.filter((item) => item !== "Logo" && item !== "文字"),
  };
}

export function prepareImageSetRegenerationFromRow(row: ImageSetRegenerationRow): ImageSetRegenerationPreparation {
  const params = parseImageSetParams(row.paramsJson);
  if (!params) return { ok: false, status: 400, error: "這不是可重新產生的商品套圖素材" };
  if (!row.product) return { ok: false, status: 400, error: "找不到這張素材所屬的產品" };

  const product = asImageSetProduct(row.product);
  const currentHash = computeProductVisualSourceHash(product);
  let profile: ProductVisualProfile | null = null;
  try {
    profile = parseProductVisualProfile(JSON.parse(row.product.visualProfileJson || "{}"));
  } catch {
    profile = null;
  }
  if (
    !profile ||
    row.product.visualProfileSourceHash !== currentHash ||
    params.sourceHash !== currentHash ||
    params.profileVersion !== profile.version
  ) {
    return { ok: false, status: 409, error: "商品資料或圖片已更新，請先重新分析產品後再重新產生這張素材。" };
  }

  const knownRole = imageSetRoles.has(params.roleSpec.role);
  if (!knownRole || !isValidSavedRoleSpec(params.roleSpec)) {
    return { ok: false, status: 400, error: "商品套圖角色資料無效，請重新建立套圖。" };
  }

  return {
    ok: true,
    value: {
      rowId: row.id,
      input: {
        batchId: row.batchId ?? `retry_${row.id}`,
        sourceHash: params.sourceHash,
        profile,
        artDirection: params.artDirection,
        product,
        rows: [{ id: row.id, role: normalizePhysicalDetailRoleSpec(params.roleSpec) }],
      },
    },
  };
}

/** Reuses one persisted kit direction and rejects rows whose role metadata no longer matches its confirmed plan. */
export function prepareKitAssetRegenerationFromRecords(
  row: ImageSetRegenerationRow,
  kit: ProductImageSetRetrySnapshot,
  /** 使用者輸入的「希望怎麼改」。角色、變化與商品識別規則都不受影響，只補一段修改指示。 */
  revisionNote?: string,
): ImageSetRegenerationPreparation {
  if (
    row.batchId !== kit.id
    || row.productId !== kit.productId
    || row.product?.id !== kit.productId
  ) return { ok: false, status: 404, error: "找不到這份套圖中的素材" };

  let plan: ImageSetPlanItem[];
  let kitDirection: ImageSetArtDirection | null = null;
  try {
    plan = parseImageSetPlanJson(kit.planJson);
    kitDirection = parseImageSetArtDirection(JSON.parse(kit.artDirectionJson));
  } catch {
    return { ok: false, status: 409, error: "套圖方向或角色資料已失效，請重新建立套圖。" };
  }
  if (!kitDirection) return { ok: false, status: 409, error: "套圖方向或角色資料已失效，請重新建立套圖。" };
  const planned = plan.find((item) => item.assetRole === row.assetRole && item.assetSubtype === row.assetSubtype);
  if (!planned) return { ok: false, status: 400, error: "這張素材的角色或變化不在已確認的套圖清單中" };

  const prepared = prepareImageSetRegenerationFromRow(row);
  if (!prepared.ok) return prepared;
  const savedRole = prepared.value.input.rows[0]?.role as ImageSetRoleSpec & { assetRole?: string; assetSubtype?: string };
  if (
    savedRole.role !== planned.assetRole
    || savedRole.assetSubtype !== planned.assetSubtype
  ) return { ok: false, status: 400, error: "這張素材的角色或變化資料不一致" };

  // 修改指示只附加在場景描述後面，不覆寫 objective／mustNotShow／商品識別規則——
  // 那些是這個角色的安全邊界（例如背景不得出現商品、質地不得出現容器），
  // 不能讓使用者一句話把它們解除。
  const note = revisionNote?.trim().slice(0, 300);
  const rows = note
    ? prepared.value.input.rows.map((entry, index) => index === 0
      ? { ...entry, role: { ...entry.role, sceneCn: `${entry.role.sceneCn}\n【本次重新生成的修改指示】${note}` } }
      : entry)
    : prepared.value.input.rows;

  return {
    ok: true,
    value: {
      ...prepared.value,
      input: {
        ...prepared.value.input,
        rows,
        batchId: kit.id,
        artDirection: kitDirection,
      },
    },
  };
}

/** Reloads and validates one saved image-set row before a single-role retry. */
export async function prepareImageSetRegeneration(rowId: string): Promise<ImageSetRegenerationPreparation> {
  const row = await db.libraryImage.findUnique({
    where: { id: rowId },
    include: { product: true },
  });
  if (!row) return { ok: false, status: 404, error: "找不到這張素材" };
  return prepareImageSetRegenerationFromRow(row);
}

/** Re-generates only the requested row; no sibling batch rows are read or mutated. */
export async function regenerateImageSetItem(
  rowId: string,
  alreadyPrepared?: PreparedImageSetRegeneration,
  execution?: ImageSetExecution,
): Promise<ImageSetBatchResult> {
  const prepared = alreadyPrepared ? { ok: true as const, value: alreadyPrepared } : await prepareImageSetRegeneration(rowId);
  if (!prepared.ok) throw new Error(prepared.error);
  return runImageSetBatch(prepared.value.input, defaultDependencies, execution);
}

export type RequestImageSetRegenerationDependencies = {
  prepare: (rowId: string) => Promise<ImageSetRegenerationPreparation>;
  claimFailedRow: (rowId: string, execution: ImageSetExecution) => Promise<boolean>;
  rollbackClaimedRow: (rowId: string, execution: ImageSetExecution) => Promise<boolean>;
  scheduleAfter: (callback: () => Promise<unknown>) => void;
  regenerate: (rowId: string, prepared: PreparedImageSetRegeneration, execution: ImageSetExecution) => Promise<unknown>;
  logError?: (...values: unknown[]) => void;
};

export type RequestImageSetRegenerationResult =
  | { ok: true; id: string; status: "GENERATING" }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** Validates before any mutation, then schedules exactly one retry for the target row. */
export async function requestImageSetRegeneration(
  rowId: string,
  execution: ImageSetExecution,
  dependencies: RequestImageSetRegenerationDependencies,
): Promise<RequestImageSetRegenerationResult> {
  const prepared = await dependencies.prepare(rowId);
  if (!prepared.ok) return prepared;
  const claimed = await dependencies.claimFailedRow(rowId, execution);
  if (!claimed) {
    return { ok: false, status: 409, error: "這張素材目前無法重新產生，請確認狀態為失敗後再試一次。" };
  }
  try {
    dependencies.scheduleAfter(() => dependencies.regenerate(rowId, prepared.value, execution));
  } catch (error) {
    try {
      const rolledBack = await dependencies.rollbackClaimedRow(rowId, execution);
      if (!rolledBack) {
        dependencies.logError?.("[image-set:retry] immediate rollback lost lease ownership; stale reconciliation will recover", {
          rowId,
          leaseId: execution.leaseId,
        });
      }
    } catch (rollbackError) {
      dependencies.logError?.("[image-set:retry] immediate rollback failed; stale lease retained for reconciliation", {
        rowId,
        leaseId: execution.leaseId,
        error: rollbackError,
      });
    }
    throw error;
  }
  return { ok: true, id: rowId, status: "GENERATING" };
}
