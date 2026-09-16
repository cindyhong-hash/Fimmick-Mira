"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check, ChevronLeft, Clock3, HelpCircle, Loader2, LockKeyhole, Palette, RefreshCw, Sparkles, X } from "lucide-react";
import type { ImageSetArtDirection, ProductVisualProfile, SetItem } from "@/lib/imageSet";
import type { ImageSetPlanItem } from "@/lib/products/image-set-kit";
import type { ImageSetTheme } from "@/lib/products/image-set-roles";
import { ImageSetDirectionEditor } from "@/components/products/ImageSetDirectionEditor";
import { ImageSetPlanChecklist } from "@/components/products/ImageSetPlanChecklist";
import {
  buildImageSetConfirmationPayload,
  clearSavedImageSetBatch,
  dialogFocusTargetIndex,
  imageSetBatchProgress,
  imageSetGenerationAnnouncement,
  imageSetOpeningAction,
  imageSetProgressLabel,
  imageSetRecoveryAction,
  imageSetTerminalSummary,
  initializeImageSetPlanSelection,
  isImageSetBatchSettled,
  mergeImageSetPollResult,
  readSavedImageSetBatch,
  reconcileImageSetResumeRows,
  shouldAnalyzeBeforeImageSetPicker,
  shouldNotifySettledBatch,
  shouldRenderDeterminateImageSetProgress,
  toggleImageSetPlanItem,
  writeSavedImageSetBatch,
  type ImageSetPlanSelection,
  type SavedImageSetBatch,
  type ImageSetRecoveryKind,
  type ImageSetResumeRow,
  type ImageSetUiRoleStatus,
} from "@/lib/products/image-set-ui";

type GenState = ImageSetResumeRow;
type ModalPhase = "analyzing" | "pick" | "planning" | "review" | "generating" | "done";
type ImageSetPayload = {
  profile: ProductVisualProfile | null;
  artDirection: ImageSetArtDirection | null;
  suggestions: SetItem[];
  needsAnalysis?: boolean;
  sourceImageCount?: number;
  sourceHash: string;
};
type ResumeRecovery = { payload: ImageSetPayload; saved: SavedImageSetBatch };
type LoadedRows = { rows: GenState[]; missingCount: number };
type PlanOptions = { themes: ImageSetTheme[]; maxAssets: number };
type PlannedKit = PlanOptions & {
  batchId: string;
  productId: string;
  theme: ImageSetTheme | null;
  artDirection: ImageSetArtDirection;
  items: ImageSetPlanItem[];
};

const POLL_INTERVAL_MS = 2_000;
const POLL_WINDOW_MS = 150_000;

function isRoleStatus(value: unknown): value is ImageSetUiRoleStatus {
  return value === "PENDING" || value === "GENERATING" || value === "DONE" || value === "FAILED";
}

async function loadRows(items: SavedImageSetBatch["items"]): Promise<LoadedRows> {
  const response = await fetch(`/api/library/images?ids=${items.map(({ id }) => id).join(",")}`);
  if (!response.ok) throw new Error("無法讀取套圖進度");
  const data = await response.json() as { items?: Array<Record<string, unknown>> };
  const responseRows = Array.isArray(data.items) ? data.items : [];
  const rowsById = new Map(responseRows.map((row) => [String(row.id), row]));
  const rows = items.flatMap((item) => {
    const row = rowsById.get(item.id);
    if (!row || !isRoleStatus(row.status)) return [];
    return [{
      ...item,
      status: row.status,
      imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined,
      errorMessage: typeof row.errorMessage === "string" ? row.errorMessage : null,
    }];
  });
  return reconcileImageSetResumeRows(items, rows);
}

export function ImageSetModal({ clientId, productId, onClose, onFinished }: {
  clientId: string;
  productId: string;
  onClose: () => void;
  onFinished: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ImageSetPlanSelection[]>([]);
  const [phase, setPhase] = useState<ModalPhase>("analyzing");
  const [profile, setProfile] = useState<ProductVisualProfile | null>(null);
  const [artDirection, setArtDirection] = useState<ImageSetArtDirection | null>(null);
  const [sourceHash, setSourceHash] = useState("");
  const [sourceImageCount, setSourceImageCount] = useState(0);
  const [needsAnalysis, setNeedsAnalysis] = useState(true);
  const [themes, setThemes] = useState<ImageSetTheme[]>([]);
  const [selectedThemeKey, setSelectedThemeKey] = useState("");
  const [maxAssets, setMaxAssets] = useState(20);
  const [draftBatchId, setDraftBatchId] = useState("");
  const [gen, setGen] = useState<GenState[]>([]);
  const [creatingRows, setCreatingRows] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKind, setRecoveryKind] = useState<ImageSetRecoveryKind | null>(null);
  const [resumeRecovery, setResumeRecovery] = useState<ResumeRecovery | null>(null);
  const finishedNotified = useRef(false);
  const genRef = useRef(gen);
  const onFinishedRef = useRef(onFinished);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const batchItemsKey = gen.map(({ id }) => id).join(",");

  useEffect(() => { genRef.current = gen; }, [gen]);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, []);

  const showPicker = (payload: ImageSetPayload) => {
    setProfile(payload.profile);
    setArtDirection(payload.artDirection);
    setSourceHash(payload.sourceHash);
    setSourceImageCount(payload.profile?.sourceImageCount ?? 0);
    setNeedsAnalysis(false);
    setRecoveryKind(null);
    setResumeRecovery(null);
    setItems([]);
    setDraftBatchId("");
    setPhase("pick");
    void loadPlanOptions();
  };

  async function loadPlanOptions() {
    try {
      const response = await fetch(`/api/products/${productId}/image-set/plan`);
      const data = await response.json().catch(() => ({})) as Partial<PlanOptions> & { error?: string };
      if (!response.ok || !Array.isArray(data.themes) || typeof data.maxAssets !== "number") {
        throw new Error(data.error || "無法載入套圖主題");
      }
      setThemes(data.themes);
      setMaxAssets(data.maxAssets);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法載入套圖主題");
    }
  }

  const analyzeProduct = async (force: boolean, fallback?: ImageSetPayload) => {
    setAnalyzing(true);
    setPhase("analyzing");
    setError(null);
    setRecoveryKind(null);
    try {
      const response = await fetch(`/api/products/${productId}/image-set/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await response.json().catch(() => ({})) as ImageSetPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "產品分析失敗，請稍後再試");
      showPicker(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "產品分析失敗，請稍後再試");
      if (fallback && !shouldAnalyzeBeforeImageSetPicker(fallback)) showPicker(fallback);
      else setRecoveryKind("analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  const applySavedBatch = async (
    payload: ImageSetPayload,
    saved: SavedImageSetBatch,
    isActive: () => boolean = () => true,
  ) => {
    try {
      const loaded = await loadRows(saved.items);
      if (!isActive()) return;
      const persisted = loaded.rows;
      setError(null);
      setRecoveryKind(null);
      setResumeRecovery(null);
      setProfile(payload.profile);
      setArtDirection(payload.artDirection);
      setSourceHash(payload.sourceHash);
      setDraftBatchId(saved.batchId);
      setItems([]);
      setGen(persisted);
      const settled = isImageSetBatchSettled(persisted);
      setPhase(settled ? "done" : "generating");
      if (shouldNotifySettledBatch(persisted, finishedNotified.current)) {
        finishedNotified.current = true;
        onFinishedRef.current();
      }
    } catch {
      if (!isActive()) return;
      setResumeRecovery({ payload, saved });
      setRecoveryKind("resume");
      setError("暫時無法讀取這批套圖的最新進度，請重新讀取。");
      setPhase("analyzing");
    }
  };

  const loadInitial = async (isActive: () => boolean = () => true) => {
    setError(null);
    setRecoveryKind(null);
    setPhase("analyzing");
    try {
      const response = await fetch(`/api/products/${productId}/image-set`);
      const payload = await response.json() as ImageSetPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "無法載入套圖建議");
      if (!isActive()) return;
      const analysisRequired = shouldAnalyzeBeforeImageSetPicker(payload);
      setNeedsAnalysis(analysisRequired);
      setSourceImageCount(payload.sourceImageCount ?? payload.profile?.sourceImageCount ?? 0);
      const saved = readSavedImageSetBatch(window.localStorage, productId);
      if (imageSetOpeningAction(saved) === "resume" && saved) {
        await applySavedBatch(payload, saved, isActive);
        return;
      }
      if (analysisRequired) await analyzeProduct(false);
      else showPicker(payload);
    } catch (reason) {
      if (!isActive()) return;
      setError(reason instanceof Error ? reason.message : "無法載入套圖建議");
      setNeedsAnalysis(true);
      setRecoveryKind("initial");
      setPhase("analyzing");
    }
  };

  useEffect(() => {
    let alive = true;
    const frame = requestAnimationFrame(() => { void loadInitial(() => alive); });
    return () => { alive = false; cancelAnimationFrame(frame); };
    // Opening the modal is the intended request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (phase !== "generating" || !batchItemsKey || isImageSetBatchSettled(genRef.current)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > POLL_WINDOW_MS) {
        setPollingTimedOut(true);
        return;
      }
      try {
        const { rows } = await loadRows(genRef.current.map(({ id, role, label }) => ({ id, role, label })));
        if (!cancelled) {
          setGen((current) => current.map((item) => {
            const row = rows.find(({ id }) => id === item.id);
            return row ? mergeImageSetPollResult(item, { kind: "row", row }) : item;
          }));
          if (rows.length === genRef.current.length && shouldNotifySettledBatch(rows, finishedNotified.current)) {
            setPhase("done");
            finishedNotified.current = true;
            onFinishedRef.current();
            return;
          }
        }
      } catch {
        // Polling failures never overwrite persisted row status.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, batchItemsKey]);

  const chosen = useMemo(() => items.filter(({ checked }) => checked), [items]);
  const missingResumeCount = gen.filter(({ missing }) => missing).length;
  const progress = imageSetBatchProgress(gen);
  const progressLabel = phase === "analyzing"
    ? imageSetProgressLabel({ phase: "analyzing", sourceImageCount })
    : imageSetProgressLabel({ phase: "generating", ...progress });
  const preparingRows = !shouldRenderDeterminateImageSetProgress({ creatingRows, itemCount: gen.length });
  const preparingAnnouncement = imageSetGenerationAnnouncement({ creatingRows, itemCount: gen.length });
  const recoveryAction = recoveryKind ? imageSetRecoveryAction(recoveryKind) : null;
  const terminalSummary = gen.length ? imageSetTerminalSummary(gen) : null;
  const requestClose = () => { if (!creatingRows) onClose(); };

  const retryRecovery = () => {
    setError(null);
    if (recoveryKind === "resume" && resumeRecovery) {
      setRecoveryKind(null);
      void applySavedBatch(resumeRecovery.payload, resumeRecovery.saved);
    } else if (recoveryKind === "initial") {
      void loadInitial();
    } else {
      void analyzeProduct(true);
    }
  };

  const discardResumeAndRestart = () => {
    if (recoveryKind !== "resume") return;
    clearSavedImageSetBatch(window.localStorage, productId);
    setResumeRecovery(null);
    setRecoveryKind(null);
    setError(null);
    setGen([]);
    setPollingTimedOut(false);
    finishedNotified.current = false;
    void loadInitial();
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.getAttribute("aria-hidden") !== "true" && element.tabIndex >= 0);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const targetIndex = dialogFocusTargetIndex(currentIndex, focusable.length, event.shiftKey);
    if (targetIndex !== null) {
      event.preventDefault();
      focusable[targetIndex]?.focus();
    }
  };

  async function createPlan() {
    if (!profile || phase === "planning") return;
    setPhase("planning");
    setError(null);
    try {
      const theme = themes.find(({ key }) => key === selectedThemeKey);
      const response = await fetch(`/api/products/${productId}/image-set/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme ? { themeKey: theme.key, themeKind: theme.kind } : {}),
      });
      const data = await response.json().catch(() => ({})) as Partial<PlannedKit> & { error?: string };
      if (!response.ok || !data.batchId || !data.artDirection || !Array.isArray(data.items) || !Array.isArray(data.themes)) {
        throw new Error(data.error || "無法建立套圖規劃");
      }
      setDraftBatchId(data.batchId);
      setArtDirection(data.artDirection);
      setThemes(data.themes);
      setMaxAssets(typeof data.maxAssets === "number" ? data.maxAssets : maxAssets);
      setItems(initializeImageSetPlanSelection(data.items));
      setPhase("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法建立套圖規劃");
      setPhase("pick");
    }
  }

  async function generate() {
    if (!chosen.length || creatingRows) return;
    if (!artDirection) return;
    const confirmation = buildImageSetConfirmationPayload({ batchId: draftBatchId, items, artDirection, maxAssets });
    if (!confirmation.ok) {
      setError(confirmation.error);
      return;
    }
    setCreatingRows(true);
    setPollingTimedOut(false);
    setError(null);
    setPhase("generating");
    finishedNotified.current = false;
    try {
      const response = await fetch(`/api/products/${productId}/image-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmation.payload),
      });
      const data = await response.json().catch(() => ({})) as {
        batchId?: string;
        items?: Array<Pick<GenState, "id" | "role" | "label"> & { status?: ImageSetUiRoleStatus }>;
        error?: string;
      };
      if (!response.ok || !data.batchId || !data.items?.length) throw new Error(data.error || "無法開始生成，請稍後再試");
      const created = data.items.map((item) => ({ ...item, status: item.status ?? "PENDING" }));
      setGen(created);
      writeSavedImageSetBatch(window.localStorage, productId, {
        batchId: data.batchId,
        items: created.map(({ id, role, label }) => ({ id, role, label })),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法開始生成，請稍後再試");
      setPhase("review");
    } finally {
      setCreatingRows(false);
    }
  }

  async function retry(item: GenState) {
    setError(null);
    setPollingTimedOut(false);
    try {
      const response = await fetch(`/api/library/images/${item.id}/regenerate`, { method: "POST" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || `${item.label}目前無法重新產生`);
      setGen((current) => current.map((row) => row.id === item.id ? { ...row, status: "GENERATING", errorMessage: null } : row));
      setPhase("generating");
      finishedNotified.current = false;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${item.label}目前無法重新產生`);
    }
  }

  const startAnotherSet = () => {
    clearSavedImageSetBatch(window.localStorage, productId);
    setGen([]);
    setPollingTimedOut(false);
    finishedNotified.current = false;
    setItems([]);
    setDraftBatchId("");
    if (needsAnalysis || !profile) void analyzeProduct(true);
    else {
      setPhase("pick");
      void loadPlanOptions();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={requestClose}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="image-set-title" tabIndex={-1} onKeyDown={handleDialogKeyDown} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#ebeff5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-[#ebeff5] px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <h2 id="image-set-title" className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50"><Sparkles className="h-4 w-4 text-violet-600" /></span>
              AI 建立商品套圖
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">先確認產品識別與套圖方向，再建立可重複使用的商品素材。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={requestClose} disabled={creatingRows} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label={creatingRows ? "正在建立素材，暫時無法關閉" : "關閉"}><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {phase === "analyzing" ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f9f6ff]">{analyzing || !error ? <Loader2 className="h-6 w-6 animate-spin text-violet-600" /> : <AlertCircle className="h-6 w-6 text-red-500" />}</span>
              <p role="status" aria-live="polite" className="mt-5 max-w-md text-sm font-medium leading-6 text-gray-700">{progressLabel}</p>
              <p className="mt-2 text-xs text-gray-400">會依商品照片整理色彩、外觀細節與一致的視覺方向。</p>
              {error && <div className="mt-4 flex flex-col items-center gap-3"><ErrorMessage>{recoveryAction?.title ? `${recoveryAction.title}：${error}` : error}</ErrorMessage><div className="flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={retryRecovery} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><RefreshCw className="h-3.5 w-3.5" />{recoveryAction?.actionLabel ?? "重試"}</button>{recoveryKind === "resume" && <button type="button" onClick={discardResumeAndRestart} className="inline-flex items-center gap-1.5 rounded-full border border-[#ebe4f9] bg-white px-5 py-2.5 text-xs font-bold text-violet-600 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">丟棄這批重新開始</button>}</div></div>}
            </div>
          ) : phase === "planning" ? (
            <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-72 flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f9f6ff]"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></span>
              <p className="mt-5 text-sm font-bold text-gray-800">正在依主題規劃 Visual Asset Kit…</p>
              <p className="mt-2 max-w-md text-xs leading-5 text-gray-500">這一步只建立方向與建議清單，不會開始付費生成。</p>
            </div>
          ) : phase === "pick" ? (
            <div className="space-y-5">
              {profile && (
                <div className="rounded-2xl border border-[#ebe4f9] bg-[#f9f6ff] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-violet-600">AI 產品視覺分析</p>
                      {profile.confidence > 0 ? <p className="mt-1 text-base font-bold text-gray-900">{profile.productType}<span className="ml-2 text-xs font-medium text-gray-400">信心度 {Math.round(profile.confidence * 100)}%</span></p> : <p className="mt-1 text-sm font-medium text-gray-600">使用基本產品資料規劃套圖</p>}
                    </div>
                    <button type="button" onClick={() => void analyzeProduct(true, { profile, artDirection, suggestions: [], sourceHash })} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ebe4f9] bg-white px-3 py-2 text-xs font-bold text-violet-600 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />重新分析產品</button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoCard icon={<Palette className="h-3.5 w-3.5 text-violet-500" />} title="產品主色" text={artDirection?.palette.dominant.length ? artDirection.palette.dominant.join("、") : "依商品原貌保留"} />
                    <InfoCard icon={<Sparkles className="h-3.5 w-3.5 text-violet-500" />} title="品牌點綴色" text={artDirection?.palette.accent.length ? artDirection.palette.accent.join("、") : "未設定，維持產品色彩"} />
                  </div>
                  {!!profile.prohibitedChanges.length && <div className="mt-4"><div className="flex items-center gap-1.5 text-xs font-bold text-gray-700"><LockKeyhole className="h-3.5 w-3.5 text-violet-500" />商品識別鎖定</div><div className="mt-2 flex flex-wrap gap-2">{profile.prohibitedChanges.slice(0, 3).map((lock) => <span key={lock} className="rounded-full border border-[#ebe4f9] bg-white px-2.5 py-1 text-[11px] leading-4 text-gray-600">{lock}</span>)}</div></div>}
                </div>
              )}

              {(profile?.sourceImageCount ?? 0) === 0 && <HelpPopover label="需要商品參考照">目前沒有可用的商品參考照，包含商品主體的規劃將無法送出生成。</HelpPopover>}
              <div className="rounded-2xl border border-[#e7ebf1] bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-bold text-gray-900">選擇檔期或季節主題</h3></div>
                <p className="mt-1 text-xs leading-5 text-gray-500">主題會影響氛圍、背景與無文字裝飾。也可以保留常態品牌方向。</p>
                <select value={selectedThemeKey} onChange={(event) => setSelectedThemeKey(event.target.value)} className="mt-4 w-full rounded-xl border border-[#e5e9f0] bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                  <option value="">常態品牌素材</option>
                  <optgroup label="促銷檔期">{themes.filter(({ kind }) => kind === "PROMO").map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</optgroup>
                  <optgroup label="季節主題">{themes.filter(({ kind }) => kind === "SEASONAL").map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</optgroup>
                </select>
              </div>
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <div className="flex flex-col items-center pt-1"><button type="button" onClick={() => void createPlan()} disabled={!profile || !themes.length} className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-10 py-3.5 text-sm font-bold text-white shadow-[0_8px_8px_rgba(124,58,237,0.15)] hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#F8F9FB] disabled:text-[#868D99] disabled:shadow-none sm:px-14"><Sparkles className="h-[18px] w-[18px]" />建立建議清單</button></div>
            </div>
          ) : phase === "review" && artDirection ? (
            <div className="space-y-5">
              <button type="button" onClick={() => { setError(null); setPhase("pick"); }} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-violet-600"><ChevronLeft className="h-4 w-4" />重新選擇主題</button>
              <ImageSetDirectionEditor value={artDirection} onChange={setArtDirection} />
              <ImageSetPlanChecklist items={items} maxAssets={maxAssets} onToggle={(id) => setItems((current) => toggleImageSetPlanItem(current, id, maxAssets))} />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">確認後才會開始生成。本批會建立 <strong>{chosen.length} 張</strong>付費圖片素材。</div>
              <div className="flex justify-center"><button type="button" onClick={() => void generate()} disabled={!chosen.length || chosen.length > maxAssets || creatingRows} className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-10 py-3.5 text-sm font-bold text-white shadow-[0_8px_8px_rgba(124,58,237,0.15)] hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#F8F9FB] disabled:text-[#868D99] disabled:shadow-none sm:px-14">{creatingRows ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}{creatingRows ? "正在確認批次…" : `確認並生成 ${chosen.length} 張`}</button></div>
            </div>
          ) : (
            <div className="space-y-5">
              {preparingRows ? <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-[#ebe4f9] bg-[#f9f6ff] text-sm font-bold text-gray-700"><Loader2 className="mb-3 h-5 w-5 animate-spin text-violet-600" />{preparingAnnouncement ?? "正在準備生成…"}</div> : <div role="status" aria-live="polite" className="rounded-2xl border border-[#ebe4f9] bg-[#f9f6ff] p-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">{phase === "done" ? <Check className="h-5 w-5 text-emerald-500" /> : <Loader2 className="h-5 w-5 animate-spin text-violet-600" />}</span><div className="min-w-0"><p className="text-sm font-bold text-gray-900">{phase === "done" ? (missingResumeCount ? `已恢復套圖進度，${missingResumeCount} 張待重新生成` : terminalSummary?.status === "PARTIAL" ? `完成 ${terminalSummary.completed} 張，${terminalSummary.failed} 張失敗` : terminalSummary?.status === "FAILED" ? `本批 ${terminalSummary.failed} 張皆未完成` : `套圖已完成 ${terminalSummary?.completed ?? progress.completed}/${progress.total}`) : progressLabel}</p><p className="mt-1 text-xs leading-5 text-gray-500">{phase === "done" ? (missingResumeCount ? "這批有素材已被刪除；其餘素材已保留，請丟棄舊批次後重新開始。" : terminalSummary?.status === "PARTIAL" ? "成功素材已保留，可查看套組或單獨重試失敗項目。" : terminalSummary?.status === "FAILED" ? "可單獨重新產生失敗項目，或建立另一組。" : "完成的素材已存回產品，可以前往視覺套組查看。") : "建立完成後會自動更新；現在可以關閉視窗，生成仍會繼續。"}</p></div></div>
                <div role="progressbar" aria-label="商品套圖建立進度" aria-valuemin={0} aria-valuemax={Math.max(progress.total, 1)} aria-valuenow={progress.completed} aria-valuetext={`完成 ${progress.completed}/${progress.total}`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600 transition-[width] duration-500" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} /></div>
              </div>}
              {!preparingRows && <div className="space-y-2.5">{gen.map((item) => <RoleRow key={item.id} item={item} onRetry={() => void retry(item)} />)}</div>}
              {pollingTimedOut && phase !== "done" && <HelpPopover label="等待時間較長">已暫停更新畫面，但生成仍在背景進行。關閉後重新開啟即可繼續查看，不會改動後端狀態。</HelpPopover>}
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <div className="flex flex-col-reverse items-stretch justify-center gap-2 pt-1 sm:flex-row">
                {phase === "done" && <button type="button" onClick={startAnotherSet} className={`rounded-full px-6 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${missingResumeCount ? "bg-violet-600 text-white hover:bg-violet-700" : "border border-[#ebe4f9] bg-white text-violet-600 hover:bg-violet-50"}`}>{missingResumeCount ? "丟棄這批重新開始" : "建立另一組"}</button>}
                {phase === "done" && terminalSummary?.canViewKit && !missingResumeCount && <button type="button" onClick={() => router.push(`/clients/${clientId}/products/${productId}/image-sets/${draftBatchId}`)} className="rounded-full bg-violet-600 px-7 py-3 text-sm font-bold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">查看視覺套組</button>}
                <button type="button" onClick={requestClose} disabled={creatingRows} className={`rounded-full px-9 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${phase === "done" && missingResumeCount ? "border border-[#ebe4f9] bg-white text-violet-600 hover:bg-violet-50" : "bg-violet-600 text-white hover:bg-violet-700"}`}>{phase === "done" ? "完成" : "關閉並在背景繼續"}</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">{icon}{title}</div><p className="mt-1.5 text-xs leading-5 text-gray-500">{text}</p></div>;
}

function HelpPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="relative inline-flex items-center gap-1.5 text-xs text-gray-500" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); } }}>
    <span>{label}</span>
    <button type="button" aria-label={`說明：${label}`} aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined} onClick={() => setOpen((value) => !value)} className="rounded p-0.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><HelpCircle className="h-3.5 w-3.5" /></button>
    {open && <><button type="button" tabIndex={-1} aria-label="關閉說明" className="fixed inset-0 z-10 cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => setOpen(false)} /><div id={id} role="tooltip" className="absolute left-0 top-6 z-20 w-64 rounded-lg border border-[#ebeff5] bg-white p-3 text-xs leading-5 text-gray-500 shadow-md">{children}</div></>}
  </div>;
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{children}</p>;
}

function RoleRow({ item, onRetry }: { item: GenState; onRetry: () => void }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#ebeff5] bg-white p-3">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#ebeff5] bg-gray-50">
      {item.status === "DONE" && item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={`${item.label}生成結果`} className="h-full w-full object-cover" />
      ) : item.status === "GENERATING" ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : item.status === "FAILED" ? <AlertCircle className="h-4 w-4 text-red-400" /> : <Clock3 className="h-4 w-4 text-gray-400" />}
    </div>
    <div className="min-w-0 flex-1"><div className="text-sm font-bold text-gray-900">{item.label}</div><div role="status" aria-live="polite" className={`mt-0.5 text-xs leading-5 ${item.status === "FAILED" ? "text-red-500" : "text-gray-400"}`}>{item.status === "PENDING" ? "等待生成" : item.status === "GENERATING" ? "正在生成…" : item.status === "DONE" ? "已完成" : (item.errorMessage || `${item.label}生成失敗，可單獨重新產生。`)}</div></div>
    {item.status === "FAILED" && !item.missing ? <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ebe4f9] bg-[#f9f6ff] px-3 py-2 text-xs font-bold text-violet-600 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><RefreshCw className="h-3.5 w-3.5" />重新產生</button> : item.status === "DONE" ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : null}
  </div>;
}
