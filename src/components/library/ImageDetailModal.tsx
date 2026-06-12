"use client";
/**
 * ImageDetailModal
 * ────────────────
 * Popup shown when a brand-gallery image OR a component card is clicked.
 * Displays the image and its linked 構圖 / 配色 / 語氣 / 背景 components, each with
 * a 「帶入生成」 button. For library-generated images (no linked components) it shows
 * the generated copy and offers 「分析此圖加入素材」.
 */
import { useEffect, useState } from "react";
import { X, ArrowRightCircle, Sparkles, ScanSearch, Pencil, RefreshCw, Trash2, Download, Check, Loader2 } from "lucide-react";
import type { StyleComponent, ComponentCategory } from "@/types/library";
import { CATEGORY_META, getColors } from "@/types/library";
import { ColorCards } from "./ColorCards";

type Props = {
  imageUrl: string | null;
  /** When provided, skip fetching and show exactly these components. */
  presetComponents?: StyleComponent[];
  copyText?: string | null;
  subject?: string | null;
  prompt?: string | null;
  libraryImageId?: string;
  injectedIds?: Set<string>;
  onInject: (comp: StyleComponent) => void;
  onAnalyze?: (imageUrl: string) => void;
  /** Image-based edit: adjust this image's 構圖/配色/語氣 together.
   *  libraryImageId is forwarded so a generated image saves back into its paramsJson snapshot. */
  onAdjust?: (imageUrl: string, components: StyleComponent[], libraryImageId?: string) => void;
  onRegenerate?: () => void;
  onDelete?: (id: string) => void;
  /** Delete StyleComponents by id (used for 背景素材 in the popup). */
  onDeleteComponents?: (ids: string[]) => void;
  /** Called after the photo title is edited — lets the parent refresh its grids. */
  onRefresh?: () => void;
  onClose: () => void;
};

const ORDER: ComponentCategory[] = ["COMPOSITION", "COLOR_SCHEME", "COPY_TONE", "BACKGROUND"];

export function ImageDetailModal({
  imageUrl,
  presetComponents,
  subject,
  prompt,
  libraryImageId,
  injectedIds,
  onInject,
  onAnalyze,
  onAdjust,
  onRegenerate,
  onDelete,
  onDeleteComponents,
  onRefresh,
  onClose,
}: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [components, setComponents] = useState<StyleComponent[]>(presetComponents ?? []);
  const [loading, setLoading] = useState(!presetComponents && !!imageUrl);
  // Editable photo title (generated images only — persisted to LibraryImage.subject).
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);
  const displaySubject = savedTitle ?? subject;

  async function saveTitle() {
    if (!libraryImageId) return;
    const v = titleDraft.trim();
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/library/images/${libraryImageId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: v }),
      });
      if (res.ok) { setSavedTitle(v); setEditingTitle(false); onRefresh?.(); }
    } finally { setSavingTitle(false); }
  }

  // Download the displayed image (same-origin /uploads → the `download` attribute is honored).
  function handleDownload() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = imageUrl.split("/").pop() || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Header 「刪除」 — what it removes depends on the image kind:
  //  • generated (has libraryImageId) → delete the LibraryImage row
  //  • uploaded / 背景素材 (only linked components) → delete all of this image's components
  const canDelete = (!!onDelete && !!libraryImageId) || (!!onDeleteComponents && components.length > 0);
  function handleHeaderDelete() {
    if (onDelete && libraryImageId) onDelete(libraryImageId);
    else if (onDeleteComponents && components.length > 0) onDeleteComponents(components.map((c) => c.id));
    onClose();
  }

  useEffect(() => {
    setEditingTitle(false);
    setSavedTitle(null);
    if (presetComponents) {
      setComponents(presetComponents);
      return;
    }
    if (!imageUrl) return;
    setLoading(true);
    // cache-bust + no-store: when re-opening the SAME image after an edit, the browser must
    // not serve a stale cached component list (this caused "編輯後內容唔 update").
    fetch(`/api/components?previewUrl=${encodeURIComponent(imageUrl)}&_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((comps: StyleComponent[]) => setComponents(Array.isArray(comps) ? comps : []))
      .finally(() => setLoading(false));
  }, [imageUrl, presetComponents]);

  // 背景 is a standalone image asset, not an analysed style block.
  const bgComp = components.find((c) => c.type === "BACKGROUND");
  const sorted = [...components]
    .filter((c) => c.type !== "BACKGROUND")
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

  // 背景素材 popup: a compact, fixed-square layout — square image on top, buttons below.
  if (!loading && bgComp && sorted.length === 0) {
    const injected = injectedIds?.has(bgComp.id) ?? false;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0 gap-3 min-w-0">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 min-w-0 truncate">
              <ScanSearch className="h-4 w-4 text-teal-500 shrink-0" />
              <span className="truncate">{bgComp.name}</span>
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              {imageUrl && (
                <button onClick={handleDownload} title="下載圖片"
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-600 transition-colors">
                  <Download className="h-3.5 w-3.5" />下載
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirmDel) handleHeaderDelete();
                    else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }
                  }}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors
                    ${confirmDel ? "bg-red-500 text-white border-red-500" : "bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"}`}
                  title={confirmDel ? "再按確認刪除" : "刪除此背景素材"}>
                  <Trash2 className="h-3.5 w-3.5" />{confirmDel ? "確認刪除" : "刪除"}
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-5">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={bgComp.name} className="w-full aspect-square object-cover rounded-xl border" />
            )}
            <div className="mt-3 flex items-center gap-2">
              {/* Delete moved to the header (top); only 帶入生成 remains here. */}
              <button onClick={() => onInject(bgComp)} disabled={injected}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg border transition-colors
                  ${injected ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-teal-50 border-teal-200 text-teal-700 hover:opacity-80"}`}>
                <ArrowRightCircle className="h-4 w-4" />{injected ? "已帶入" : "帶入生成（背景）"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0 gap-3 min-w-0">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 min-w-0 flex-1">
            <ScanSearch className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="shrink-0">圖片風格</span>
            {libraryImageId ? (
              editingTitle ? (
                <span className="flex items-center gap-1 min-w-0 flex-1">
                  <span className="text-gray-400 font-normal shrink-0">—</span>
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                  <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    className="min-w-0 flex-1 text-xs font-normal border border-violet-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <button onClick={saveTitle} disabled={savingTitle} title="儲存標題" className="p-1 rounded hover:bg-gray-100 text-emerald-600 shrink-0">
                    {savingTitle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setEditingTitle(false)} title="取消" className="p-1 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <button onClick={() => { setTitleDraft(displaySubject ?? ""); setEditingTitle(true); }}
                  className="flex items-center gap-1 min-w-0 text-gray-400 font-normal hover:text-violet-600 transition-colors group/title" title="點擊編輯標題">
                  <span className="truncate">— {displaySubject || "（未命名）"}</span>
                  <Pencil className="h-3 w-3 shrink-0 opacity-50 group-hover/title:opacity-100" />
                </button>
              )
            ) : (displaySubject && <span className="text-gray-400 font-normal truncate">— {displaySubject}</span>)}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Download the image */}
            {imageUrl && (
              <button onClick={handleDownload} title="下載圖片"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">
                <Download className="h-3.5 w-3.5" />下載
              </button>
            )}
            {/* Image-based adjust — edit this image's 構圖/配色/語氣 together */}
            {onAdjust && imageUrl && sorted.length > 0 && (
              <button onClick={() => onAdjust(imageUrl, sorted, libraryImageId)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">
                <Pencil className="h-3.5 w-3.5" />調整
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  if (confirmDel) handleHeaderDelete();
                  else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }
                }}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors
                  ${confirmDel ? "bg-red-500 text-white border-red-500" : "bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"}`}
                title={confirmDel ? "再按確認刪除" : (libraryImageId ? "刪除此生成圖" : "刪除此圖（連同其構圖/配色/語氣素材）")}>
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDel ? "確認刪除" : "刪除"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Image */}
          <div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="preview"
                className="w-full rounded-xl border object-contain bg-gray-50"
              />
            )}
            {/* 參考文案 intentionally hidden (not needed). AI Prompt is shown below. */}
            {prompt && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                <div className="text-[11px] font-semibold text-violet-700 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />AI Prompt</div>
                <p className="text-[11px] font-mono text-gray-600 leading-relaxed break-all">{prompt}</p>
              </div>
            )}
            {onRegenerate && (
              <button onClick={onRegenerate}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-violet-600 text-white px-3 py-2 rounded-lg hover:bg-violet-700 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成 / 調整（載入原參數到生成台）
              </button>
            )}
          </div>

          {/* Linked components — 構圖/配色/語氣 + 背景（合成會直接用到，所以顯示出嚟）。 */}
          <div className="space-y-3">
            {!loading && bgComp && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-teal-50 border-teal-200 text-teal-700">背景</span>
                  <span className="text-xs font-semibold text-gray-800 truncate ml-2">{bgComp.name}</span>
                </div>
                {Boolean(bgComp.data.imageUrl || bgComp.previewUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(bgComp.data.imageUrl as string) || bgComp.previewUrl!} alt="bg" loading="lazy" decoding="async" className="w-full aspect-square object-cover rounded-lg border mb-2" />
                )}
                <button onClick={() => onInject(bgComp)} disabled={injectedIds?.has(bgComp.id)}
                  className={`w-full flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg border transition-colors
                    ${injectedIds?.has(bgComp.id) ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-white border-teal-200 text-teal-700 hover:opacity-80"}`}>
                  <ArrowRightCircle className="h-3.5 w-3.5" />{injectedIds?.has(bgComp.id) ? "已帶入" : "帶入生成（背景）"}
                </button>
              </div>
            )}
            {loading ? (
              <div className="text-sm text-gray-400 py-6 text-center">載入中…</div>
            ) : sorted.length === 0 && !bgComp ? (
              <div className="text-center py-8 px-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-500 mb-1">此圖尚未分析風格</div>
                <p className="text-xs text-gray-400 mb-4">分析後可取得構圖・配色・語氣，並加入素材庫</p>
                {imageUrl && onAnalyze && (
                  <button
                    onClick={() => onAnalyze(imageUrl)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    分析此圖加入素材
                  </button>
                )}
              </div>
            ) : (
              sorted.map((comp) => (
                <ComponentRow
                  key={comp.id}
                  comp={comp}
                  injected={injectedIds?.has(comp.id) ?? false}
                  onInject={onInject}
                  onDelete={onDeleteComponents ? (id) => onDeleteComponents([id]) : undefined}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({
  comp,
  injected,
  onInject,
  onDelete,
}: {
  comp: StyleComponent;
  injected: boolean;
  onInject: (comp: StyleComponent) => void;
  /** Delete this style component from the library (two-click confirm). */
  onDelete?: (id: string) => void;
}) {
  const meta = CATEGORY_META[comp.type];
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className={`rounded-xl border p-3 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}>
          {meta.label}
        </span>
        <span className="text-xs font-semibold text-gray-800 truncate ml-2 flex-1 text-right">{comp.name}</span>
      </div>

      {/* Type-specific preview */}
      {comp.type === "COLOR_SCHEME" && <ColorCards colors={getColors(comp.data)} height="h-14" />}
      {comp.type === "COMPOSITION" && (
        <p className="text-xs text-gray-600 leading-relaxed">{(comp.data.description as string) ?? ""}</p>
      )}
      {comp.type === "COPY_TONE" && (
        <div className="flex flex-wrap gap-1">
          {((comp.data.toneLabels as string[]) ?? []).map((t, i) => (
            <span key={i} className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{t}</span>
          ))}
        </div>
      )}
      {comp.type === "BACKGROUND" && Boolean(comp.data.imageUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comp.data.imageUrl as string} alt="bg" className="w-full h-20 object-cover rounded-lg border" />
      )}

      {/* 小說明文字（aiPromptText）唔喺方塊度展示 */}

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-2">
        <button
          onClick={() => onInject(comp)}
          disabled={injected}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg border transition-colors
            ${injected
              ? "bg-gray-100 border-gray-200 text-gray-400"
              : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"}`}
        >
          <ArrowRightCircle className="h-3 w-3" />
          {injected ? "已帶入" : "帶入生成"}
        </button>
        {onDelete && (
          <button
            onClick={() => {
              if (confirmDel) onDelete(comp.id);
              else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }
            }}
            className={`flex items-center justify-center gap-1 text-[11px] py-1.5 px-2.5 rounded-lg border transition-colors
              ${confirmDel ? "bg-red-500 text-white border-red-500" : "bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"}`}
            title={confirmDel ? "再按確認刪除此素材" : "刪除此素材"}>
            <Trash2 className="h-3 w-3" />{confirmDel ? "確認" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
