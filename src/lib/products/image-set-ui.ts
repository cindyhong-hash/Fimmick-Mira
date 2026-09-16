import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import { IMAGE_SET_MAX_ASSETS, type ImageSetPlanItem } from "./image-set-kit.ts";

export type ImageSetUiPhase = "analyzing" | "pick" | "generating" | "done";

export type ImageSetUiRoleStatus = "PENDING" | "GENERATING" | "DONE" | "FAILED";
export type ImageSetRecoveryKind = "initial" | "resume" | "analysis";

export type ImageSetUiRole = {
  status: ImageSetUiRoleStatus;
  label?: string;
};

export type SavedImageSetBatch = {
  batchId: string;
  items: Array<{ id: string; role: string; label: string }>;
};

export type ImageSetResumeRow = SavedImageSetBatch["items"][number] & {
  status: ImageSetUiRoleStatus;
  imageUrl?: string;
  errorMessage?: string | null;
  missing?: boolean;
};

export type ImageSetStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ImageSetPlanSelection = ImageSetPlanItem & { checked: boolean };

export function initializeImageSetPlanSelection(items: ImageSetPlanItem[]): ImageSetPlanSelection[] {
  return items.map((item) => ({ ...item, checked: item.core && item.defaultSelected }));
}

export function toggleImageSetPlanItem(
  items: ImageSetPlanSelection[],
  itemId: string,
  maxAssets = IMAGE_SET_MAX_ASSETS,
): ImageSetPlanSelection[] {
  const target = items.find(({ id }) => id === itemId);
  if (!target) return items;
  const selectedCount = items.filter(({ checked }) => checked).length;
  if (!target.checked && selectedCount >= maxAssets) return items;
  return items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item);
}

export function buildImageSetConfirmationPayload(input: {
  batchId: string;
  items: ImageSetPlanSelection[];
  artDirection: ImageSetArtDirection;
  maxAssets?: number;
}): { ok: true; payload: { batchId: string; selectedItemIds: string[]; artDirection: ImageSetArtDirection } }
  | { ok: false; error: string } {
  const selectedItemIds = input.items.filter(({ checked }) => checked).map(({ id }) => id);
  if (!selectedItemIds.length) return { ok: false, error: "至少要選擇一項素材" };
  if (selectedItemIds.length > (input.maxAssets ?? IMAGE_SET_MAX_ASSETS)) {
    return { ok: false, error: `單批最多只能生成 ${input.maxAssets ?? IMAGE_SET_MAX_ASSETS} 項素材` };
  }
  return { ok: true, payload: { batchId: input.batchId, selectedItemIds, artDirection: input.artDirection } };
}

export function imageSetTerminalSummary(items: Array<Pick<ImageSetUiRole, "status">>): {
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  completed: number;
  failed: number;
  canViewKit: boolean;
} {
  const completed = items.filter(({ status }) => status === "DONE").length;
  const failed = items.filter(({ status }) => status === "FAILED").length;
  return {
    status: completed === items.length && items.length > 0 ? "COMPLETE" : completed > 0 ? "PARTIAL" : "FAILED",
    completed,
    failed,
    canViewKit: completed > 0,
  };
}

export function imageSetOpeningAction(saved: SavedImageSetBatch | null): "resume" | "load-product" {
  return saved ? "resume" : "load-product";
}

const savedBatchKey = (productId: string) => `product-image-set:${productId}:latest-batch`;

function isSavedImageSetBatch(value: unknown): value is SavedImageSetBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as Partial<SavedImageSetBatch>;
  return typeof batch.batchId === "string" && !!batch.batchId && Array.isArray(batch.items) && batch.items.length > 0
    && batch.items.every((item) => !!item && typeof item.id === "string" && !!item.id
      && typeof item.role === "string" && !!item.role && typeof item.label === "string" && !!item.label);
}

export function readSavedImageSetBatch(storage: ImageSetStorage, productId: string): SavedImageSetBatch | null {
  try {
    const value = JSON.parse(storage.getItem(savedBatchKey(productId)) ?? "null");
    return isSavedImageSetBatch(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeSavedImageSetBatch(storage: ImageSetStorage, productId: string, batch: SavedImageSetBatch): boolean {
  try {
    storage.setItem(savedBatchKey(productId), JSON.stringify(batch));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedImageSetBatch(storage: ImageSetStorage, productId: string): boolean {
  try {
    storage.removeItem(savedBatchKey(productId));
    return true;
  } catch {
    return false;
  }
}

export function shouldAnalyzeBeforeImageSetPicker(payload: { needsAnalysis?: boolean; profile: unknown }): boolean {
  return payload.needsAnalysis === true || !payload.profile;
}

export function shouldNotifySettledBatch(
  items: Array<Pick<ImageSetUiRole, "status">>,
  alreadyNotified: boolean,
): boolean {
  return !alreadyNotified && isImageSetBatchSettled(items);
}

export function isCompleteImageSetResume(savedIds: string[], returnedIds: string[]): boolean {
  if (savedIds.length !== returnedIds.length) return false;
  if (new Set(savedIds).size !== savedIds.length) return false;
  if (new Set(returnedIds).size !== returnedIds.length) return false;
  const expectedIds = new Set(savedIds);
  return returnedIds.every((id) => expectedIds.has(id));
}

export function reconcileImageSetResumeRows(
  savedItems: SavedImageSetBatch["items"],
  returnedRows: ImageSetResumeRow[],
): { rows: ImageSetResumeRow[]; missingCount: number } {
  const rowsById = new Map(returnedRows.map((row) => [row.id, row]));
  let missingCount = 0;
  const rows = savedItems.map((item) => {
    const row = rowsById.get(item.id);
    if (row) return row;
    missingCount += 1;
    return {
      ...item,
      status: "FAILED" as const,
      errorMessage: "原本的素材紀錄已不存在，請建立另一組補回這張素材。",
      missing: true,
    };
  });
  return { rows, missingCount };
}

export function imageSetRecoveryAction(kind: ImageSetRecoveryKind): { title: string; actionLabel: string } {
  if (kind === "resume") return { title: "無法讀取既有套圖進度", actionLabel: "重新讀取生成進度" };
  if (kind === "analysis") return { title: "產品分析未完成", actionLabel: "重新分析" };
  return { title: "無法載入商品套圖資料", actionLabel: "重新載入" };
}

export function shouldRenderDeterminateImageSetProgress(input: { creatingRows: boolean; itemCount: number }): boolean {
  return input.itemCount > 0 && !(input.creatingRows && input.itemCount === 0);
}

export function imageSetGenerationAnnouncement(input: { creatingRows: boolean; itemCount: number }): string | null {
  return input.creatingRows && input.itemCount === 0 ? "正在建立素材清單…" : null;
}

/** Returns a wrapped focus target only when Tab would otherwise leave the dialog. */
export function dialogFocusTargetIndex(currentIndex: number, itemCount: number, shiftKey: boolean): number | null {
  if (itemCount <= 0) return null;
  if (currentIndex < 0) return shiftKey ? itemCount - 1 : 0;
  if (shiftKey && currentIndex <= 0) return itemCount - 1;
  if (!shiftKey && currentIndex >= itemCount - 1) return 0;
  return null;
}

export function isImageSetBatchSettled(items: Array<Pick<ImageSetUiRole, "status">>): boolean {
  return items.length > 0 && items.every(({ status }) => status === "DONE" || status === "FAILED");
}

export function imageSetBatchProgress(items: ImageSetUiRole[]) {
  const completed = items.filter(({ status }) => status === "DONE" || status === "FAILED").length;
  const active = items.find(({ status }) => status === "GENERATING")
    ?? items.find(({ status }) => status === "PENDING");
  return {
    completed,
    total: items.length,
    activeRoleLabel: active?.label,
  };
}

export function imageSetProgressLabel(state:
  | { phase: "analyzing"; sourceImageCount: number }
  | { phase: "generating"; completed: number; total: number; activeRoleLabel?: string }
): string {
  if (state.phase === "analyzing") {
    return state.sourceImageCount > 0
      ? `正在讀取 ${state.sourceImageCount} 張商品照，整理產品外觀與套圖方向…`
      : "正在讀取商品照，整理產品外觀與套圖方向…";
  }
  const subject = state.activeRoleLabel ? `正在建立${state.activeRoleLabel}` : "正在整理商品套圖";
  return `${subject} · 完成 ${state.completed}/${state.total}`;
}

export function mergeImageSetPollResult<T extends { status: ImageSetUiRoleStatus }>(
  current: T,
  result:
    | { kind: "timeout" }
    | { kind: "row"; row: Partial<Omit<T, "status">> & { status: ImageSetUiRoleStatus } },
): Omit<T, "status"> & { status: ImageSetUiRoleStatus } {
  return result.kind === "timeout" ? current : { ...current, ...result.row };
}
