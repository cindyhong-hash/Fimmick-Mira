import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import { IMAGE_SET_MAX_ASSETS, type BenefitIconStyle, type ImageSetPlanItem } from "./image-set-kit.ts";

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

export type ImageSetPlanSelection = ImageSetPlanItem & {
  checked: boolean;
  /**
   * 使用者自己加的賣點。它不在伺服器的計畫裡，所以不能混進 selectedItemIds
   * （會被判定為「未知素材」），要另外送。
   */
  addedByUser?: boolean;
};

/** 一組賣點圖示最多 5 個，跟 deriveBenefitPoints 的上限一致。 */
export const MAX_BENEFIT_ICONS = 5;

/** 新增一個空白賣點，標題留給使用者自己打。 */
export function addImageSetBenefit(items: ImageSetPlanSelection[]): ImageSetPlanSelection[] {
  const icons = items.filter(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon"));
  if (icons.length >= MAX_BENEFIT_ICONS) return items;
  const added: ImageSetPlanSelection = {
    // 這個 id 只在前端用來辨識與編輯；送出時不會當成計畫項目 id。
    id: `benefit-added-${Date.now()}-${icons.length + 1}`,
    category: "benefit",
    assetRole: "benefit",
    assetSubtype: `benefit-icon-added-${icons.length + 1}`,
    purpose: "",
    core: false,
    defaultSelected: false,
    checked: true,
    addedByUser: true,
    benefitTitle: "",
    benefitDescription: "",
  };
  const lastIcon = items.map(({ assetSubtype }) => assetSubtype.startsWith("benefit-icon")).lastIndexOf(true);
  // 接在既有賣點後面，不要跑到清單最下方。
  return lastIcon < 0 ? [...items, added] : [...items.slice(0, lastIcon + 1), added, ...items.slice(lastIcon + 1)];
}

/** 移除使用者自己加的賣點；AI 推薦的不能刪，取消勾選就好。 */
export function removeImageSetBenefit(items: ImageSetPlanSelection[], itemId: string): ImageSetPlanSelection[] {
  return items.filter((item) => !(item.id === itemId && item.addedByUser));
}

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

/** 賣點文字的長度上限，跟提示詞那邊一致。空字串＝清掉說明。 */
const BENEFIT_TITLE_MAX = 8;
const BENEFIT_DESCRIPTION_MAX = 16;

export function editImageSetBenefitText(
  items: ImageSetPlanSelection[],
  itemId: string,
  field: "benefitTitle" | "benefitDescription",
  value: string,
): ImageSetPlanSelection[] {
  const limit = field === "benefitTitle" ? BENEFIT_TITLE_MAX : BENEFIT_DESCRIPTION_MAX;
  const next = value.slice(0, limit);
  return items.map((item) => item.id === itemId ? { ...item, [field]: next } : item);
}

/**
 * 使用者改過的賣點文字。只送被勾選的——沒勾的不會生成，帶著它的文字沒有意義。
 * 標題不能空白：它就是這張 icon 要畫的東西，也是排版階段要渲染的字。
 */
export function collectImageSetBenefitTexts(
  items: ImageSetPlanSelection[],
): Record<string, { title: string; description: string }> {
  const texts: Record<string, { title: string; description: string }> = {};
  for (const item of items) {
    // 自己加的賣點走 addedBenefits，不走這裡——伺服器的計畫裡沒有它的 id。
    if (!item.checked || item.addedByUser || !item.benefitTitle) continue;
    texts[item.id] = {
      title: item.benefitTitle.trim().slice(0, BENEFIT_TITLE_MAX),
      description: (item.benefitDescription ?? "").trim().slice(0, BENEFIT_DESCRIPTION_MAX),
    };
  }
  return texts;
}

export function buildImageSetConfirmationPayload(input: {
  batchId: string;
  items: ImageSetPlanSelection[];
  artDirection: ImageSetArtDirection;
  maxAssets?: number;
  /** 賣點圖示風格在確認這一刻才決定，跟著送出；沒有選到賣點圖示時不需要帶。 */
  benefitIconStyle?: BenefitIconStyle;
}): {
  ok: true;
  payload: {
    batchId: string;
    selectedItemIds: string[];
    artDirection: ImageSetArtDirection;
    benefitIconStyle?: BenefitIconStyle;
    benefitTexts?: Record<string, { title: string; description: string }>;
    addedBenefits?: { title: string; description: string }[];
  };
} | { ok: false; error: string } {
  const selectedItemIds = input.items.filter(({ checked, addedByUser }) => checked && !addedByUser).map(({ id }) => id);
  const addedBenefits = input.items
    .filter(({ checked, addedByUser }) => checked && addedByUser)
    .map((item) => ({
      title: (item.benefitTitle ?? "").trim().slice(0, BENEFIT_TITLE_MAX),
      description: (item.benefitDescription ?? "").trim().slice(0, BENEFIT_DESCRIPTION_MAX),
    }));
  if (!selectedItemIds.length && !addedBenefits.length) return { ok: false, error: "至少要選擇一項素材" };
  const blankTitle = input.items.find((item) => item.checked && item.benefitTitle !== undefined && !item.benefitTitle.trim());
  if (blankTitle) return { ok: false, error: "賣點標題不能留空" };
  if (selectedItemIds.length + addedBenefits.length > (input.maxAssets ?? IMAGE_SET_MAX_ASSETS)) {
    return { ok: false, error: `單批最多只能生成 ${input.maxAssets ?? IMAGE_SET_MAX_ASSETS} 項素材` };
  }
  const benefitTexts = collectImageSetBenefitTexts(input.items);
  return {
    ok: true,
    payload: {
      batchId: input.batchId,
      selectedItemIds,
      artDirection: input.artDirection,
      ...(input.benefitIconStyle ? { benefitIconStyle: input.benefitIconStyle } : {}),
      ...(Object.keys(benefitTexts).length ? { benefitTexts } : {}),
      ...(addedBenefits.length ? { addedBenefits } : {}),
    },
  };
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
