import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSavedImageSetBatch,
  dialogFocusTargetIndex,
  imageSetBatchProgress,
  imageSetGenerationAnnouncement,
  imageSetOpeningAction,
  imageSetProgressLabel,
  imageSetRecoveryAction,
  imageSetTerminalSummary,
  initializeImageSetPlanSelection,
  isCompleteImageSetResume,
  isImageSetBatchSettled,
  mergeImageSetPollResult,
  readSavedImageSetBatch,
  reconcileImageSetResumeRows,
  shouldAnalyzeBeforeImageSetPicker,
  shouldNotifySettledBatch,
  shouldRenderDeterminateImageSetProgress,
  toggleImageSetPlanItem,
  buildImageSetConfirmationPayload,
  writeSavedImageSetBatch,
} from "./image-set-ui.ts";

const planItems = Array.from({ length: 8 }, (_, index) => ({
  id: `asset-${index}`,
  category: index === 0 ? "product" as const : "decoration" as const,
  assetRole: index === 0 ? "hero" as const : "decoration" as const,
  assetSubtype: `subtype-${index}`,
  purpose: `purpose-${index}`,
  core: index < 5,
  defaultSelected: index < 5,
}));

test("kit review defaults to the five core assets and keeps optional items unselected", () => {
  const selection = initializeImageSetPlanSelection(planItems);
  assert.equal(selection.filter(({ checked }) => checked).length, 5);
  assert.ok(selection.slice(0, 5).every(({ checked }) => checked));
  assert.ok(selection.slice(5).every(({ checked }) => !checked));
  assert.equal(toggleImageSetPlanItem(selection, "asset-5").filter(({ checked }) => checked).length, 6);
});

test("kit confirmation enforces the selection limit and builds the exact paid payload", () => {
  const selected = initializeImageSetPlanSelection(planItems);
  const direction = {
    concept: "同一檔期", palette: { dominant: ["白"], accent: [] }, lighting: "柔光", materials: [],
    backgroundLanguage: "留白", cameraLanguage: "正面", consistencyRules: ["一致"], mood: [], decorationStyle: [],
  };
  const valid = buildImageSetConfirmationPayload({ batchId: "batch-1", items: selected, artDirection: direction });
  assert.deepEqual(valid, {
    ok: true,
    payload: { batchId: "batch-1", selectedItemIds: planItems.slice(0, 5).map(({ id }) => id), artDirection: direction },
  });
  assert.equal(buildImageSetConfirmationPayload({ batchId: "batch-1", items: selected, artDirection: direction, maxAssets: 4 }).ok, false);
  assert.equal(buildImageSetConfirmationPayload({ batchId: "batch-1", items: selected.map((item) => ({ ...item, checked: false })), artDirection: direction }).ok, false);
});

test("terminal kit summaries keep partial results viewable and reopening resumes without planning", () => {
  assert.deepEqual(imageSetTerminalSummary([{ status: "DONE" }, { status: "FAILED" }]), {
    status: "PARTIAL", completed: 1, failed: 1, canViewKit: true,
  });
  assert.equal(imageSetTerminalSummary([{ status: "FAILED" }]).canViewKit, false);
  assert.equal(imageSetOpeningAction({ batchId: "batch-1", items: [{ id: "row-1", role: "hero", label: "主體" }] }), "resume");
  assert.equal(imageSetOpeningAction(null), "load-product");
});

test("reports analysis and batch progress in Traditional Chinese", () => {
  assert.equal(
    imageSetProgressLabel({ phase: "analyzing", sourceImageCount: 3 }),
    "正在讀取 3 張商品照，整理產品外觀與套圖方向…",
  );
  assert.equal(
    imageSetProgressLabel({ phase: "generating", completed: 2, total: 5, activeRoleLabel: "使用情境" }),
    "正在建立使用情境 · 完成 2/5",
  );
  assert.equal(
    imageSetProgressLabel({ phase: "analyzing", sourceImageCount: 0 }),
    "正在讀取商品照，整理產品外觀與套圖方向…",
  );
});

test("finishes when every role is done or failed", () => {
  assert.equal(isImageSetBatchSettled([{ status: "DONE" }, { status: "FAILED" }]), true);
  assert.equal(isImageSetBatchSettled([{ status: "DONE" }, { status: "GENERATING" }]), false);
  assert.equal(isImageSetBatchSettled([]), false);
});

test("reports completed count and the first active role", () => {
  assert.deepEqual(imageSetBatchProgress([
    { status: "DONE", label: "商品主視覺" },
    { status: "GENERATING", label: "功能細節" },
    { status: "PENDING", label: "使用情境" },
    { status: "FAILED", label: "情境空景" },
  ]), { completed: 2, total: 4, activeRoleLabel: "功能細節" });
});

test("poll timeout leaves the persisted role state unchanged", () => {
  const current: { id: string; status: "PENDING" | "GENERATING" | "DONE" | "FAILED"; label: string; imageUrl?: string } = {
    id: "row-1",
    status: "GENERATING",
    label: "商品主視覺",
  };
  assert.deepEqual(mergeImageSetPollResult(current, { kind: "timeout" }), current);
  assert.deepEqual(
    mergeImageSetPollResult(current, { kind: "row", row: { status: "DONE", imageUrl: "/hero.png" } }),
    { ...current, status: "DONE", imageUrl: "/hero.png" },
  );
});

test("requires fresh analysis whenever GET marks data stale or the profile is absent", () => {
  assert.equal(shouldAnalyzeBeforeImageSetPicker({ needsAnalysis: true, profile: { version: 1 } }), true);
  assert.equal(shouldAnalyzeBeforeImageSetPicker({ needsAnalysis: false, profile: null }), true);
  assert.equal(shouldAnalyzeBeforeImageSetPicker({ needsAnalysis: false, profile: { version: 1 } }), false);
});

test("notifies a settled resumed batch only once per open cycle", () => {
  const settled = [{ status: "DONE" as const }, { status: "FAILED" as const }];
  assert.equal(shouldNotifySettledBatch(settled, false), true);
  assert.equal(shouldNotifySettledBatch(settled, true), false);
  assert.equal(shouldNotifySettledBatch([{ status: "GENERATING" }], false), false);
});

test("saved batch storage is best-effort when browser storage throws", () => {
  const throwingStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  const batch = { batchId: "batch-1", items: [{ id: "row-1", role: "hero", label: "主視覺" }] };
  assert.equal(readSavedImageSetBatch(throwingStorage, "product-1"), null);
  assert.equal(writeSavedImageSetBatch(throwingStorage, "product-1", batch), false);
  assert.equal(clearSavedImageSetBatch(throwingStorage, "product-1"), false);
});

test("dialog focus trap wraps Tab and Shift+Tab at the boundaries", () => {
  assert.equal(dialogFocusTargetIndex(2, 3, false), 0);
  assert.equal(dialogFocusTargetIndex(0, 3, true), 2);
  assert.equal(dialogFocusTargetIndex(1, 3, false), null);
  assert.equal(dialogFocusTargetIndex(-1, 3, false), 0);
});

test("recovery actions distinguish initial load, saved batch resume, and analysis", () => {
  assert.deepEqual(imageSetRecoveryAction("initial"), {
    title: "無法載入商品套圖資料",
    actionLabel: "重新載入",
  });
  assert.deepEqual(imageSetRecoveryAction("resume"), {
    title: "無法讀取既有套圖進度",
    actionLabel: "重新讀取生成進度",
  });
  assert.deepEqual(imageSetRecoveryAction("analysis"), {
    title: "產品分析未完成",
    actionLabel: "重新分析",
  });
});

test("row creation is announced as indeterminate until IDs exist", () => {
  assert.equal(shouldRenderDeterminateImageSetProgress({ creatingRows: true, itemCount: 0 }), false);
  assert.equal(imageSetGenerationAnnouncement({ creatingRows: true, itemCount: 0 }), "正在建立素材清單…");
  assert.equal(shouldRenderDeterminateImageSetProgress({ creatingRows: false, itemCount: 3 }), true);
});

test("resume completeness requires the exact saved IDs once each", () => {
  const saved = ["row-a", "row-b", "row-c"];
  assert.equal(isCompleteImageSetResume(saved, ["row-a", "row-b", "row-c"]), true);
  assert.equal(isCompleteImageSetResume(saved, ["row-a", "row-b"]), false);
  assert.equal(isCompleteImageSetResume(saved, ["row-a", "row-b", "row-b"]), false);
  assert.equal(isCompleteImageSetResume(saved, ["row-a", "row-b", "unexpected"]), false);
  assert.equal(isCompleteImageSetResume(["row-a", "row-a"], ["row-a", "row-a"]), false);
});

test("missing saved rows become non-retryable placeholders without hiding surviving progress", () => {
  const result = reconcileImageSetResumeRows(
    [
      { id: "row-hero", role: "hero", label: "商品主視覺" },
      { id: "row-detail", role: "detail", label: "質地細節" },
      { id: "row-background", role: "background", label: "情境空景" },
    ],
    [
      { id: "row-hero", role: "hero", label: "商品主視覺", status: "DONE", imageUrl: "/hero.png" },
      { id: "row-background", role: "background", label: "情境空景", status: "GENERATING" },
    ],
  );

  assert.equal(result.missingCount, 1);
  assert.deepEqual(result.rows, [
    { id: "row-hero", role: "hero", label: "商品主視覺", status: "DONE", imageUrl: "/hero.png" },
    {
      id: "row-detail",
      role: "detail",
      label: "質地細節",
      status: "FAILED",
      errorMessage: "原本的素材紀錄已不存在，請建立另一組補回這張素材。",
      missing: true,
    },
    { id: "row-background", role: "background", label: "情境空景", status: "GENERATING" },
  ]);
});
