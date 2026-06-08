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
import { X, ArrowRightCircle, Copy, Check, Sparkles, ScanSearch, Pencil, RefreshCw } from "lucide-react";
import type { StyleComponent, ComponentCategory } from "@/types/library";
import { CATEGORY_META, getColors } from "@/types/library";
import { ColorCards } from "./ColorCards";

type Props = {
  imageUrl: string | null;
  /** When provided, skip fetching and show exactly these components. */
  presetComponents?: StyleComponent[];
  copyText?: string | null;
  subject?: string | null;
  injectedIds?: Set<string>;
  onInject: (comp: StyleComponent) => void;
  onAnalyze?: (imageUrl: string) => void;
  onEdit?: (comp: StyleComponent) => void;
  onRegenerate?: () => void;
  onClose: () => void;
};

const ORDER: ComponentCategory[] = ["COMPOSITION", "COLOR_SCHEME", "COPY_TONE", "BACKGROUND"];

export function ImageDetailModal({
  imageUrl,
  presetComponents,
  copyText,
  subject,
  injectedIds,
  onInject,
  onAnalyze,
  onEdit,
  onRegenerate,
  onClose,
}: Props) {
  const [components, setComponents] = useState<StyleComponent[]>(presetComponents ?? []);
  const [loading, setLoading] = useState(!presetComponents && !!imageUrl);

  useEffect(() => {
    if (presetComponents) {
      setComponents(presetComponents);
      return;
    }
    if (!imageUrl) return;
    setLoading(true);
    fetch(`/api/components?previewUrl=${encodeURIComponent(imageUrl)}`)
      .then((r) => r.json())
      .then((comps: StyleComponent[]) => setComponents(Array.isArray(comps) ? comps : []))
      .finally(() => setLoading(false));
  }, [imageUrl, presetComponents]);

  const sorted = [...components].sort(
    (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <ScanSearch className="h-4 w-4 text-violet-500" />
            圖片風格
            {subject && <span className="text-gray-400 font-normal">— {subject}</span>}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
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
                className="w-full rounded-xl border object-cover"
              />
            )}
            {copyText && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[11px] font-semibold text-amber-700 mb-1">生成文案</div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{copyText}</p>
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

          {/* Linked components */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-gray-400 py-6 text-center">載入中…</div>
            ) : sorted.length === 0 ? (
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
                  onEdit={onEdit}
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
  onEdit,
}: {
  comp: StyleComponent;
  injected: boolean;
  onInject: (comp: StyleComponent) => void;
  onEdit?: (comp: StyleComponent) => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = CATEGORY_META[comp.type];

  const copy = async () => {
    if (!comp.aiPromptText) return;
    try {
      await navigator.clipboard.writeText(comp.aiPromptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

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

      {comp.aiPromptText && (
        <p className="text-[10px] font-mono text-gray-400 mt-1.5 line-clamp-2">{comp.aiPromptText}</p>
      )}

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
        {onEdit && (
          <button
            onClick={() => onEdit(comp)}
            className="flex items-center justify-center text-[11px] py-1.5 px-2 rounded-lg border bg-white border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
            title="編輯此素材"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {comp.aiPromptText && (
          <button
            onClick={copy}
            className="flex items-center justify-center text-[11px] py-1.5 px-2 rounded-lg border bg-white border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
            title="複製 Prompt"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
