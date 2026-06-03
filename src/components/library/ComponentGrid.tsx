"use client";
/**
 * ComponentGrid
 * ─────────────
 * Shows style components filtered by clientId.
 * Each card supports:
 *   • [複製 Prompt]   – copies aiPromptText to clipboard
 *   • [帶入生成]      – injects component into the PromptComposer slot
 *   • [刪除]          – deletes the component (with inline confirm)
 *   • Thumbnail click – navigates to the source image's full analysis
 */

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  Copy, Check, ArrowRightCircle, LayoutTemplate, Palette,
  MessageSquare, Plus, Trash2, ScanSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StyleComponent, ComponentCategory, PromptSlots } from "@/types/library";
import { CATEGORY_META } from "@/types/library";

type FilterTab = "ALL" | ComponentCategory;

const FILTER_TABS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
  { key: "ALL", label: "全部" },
  { key: "COMPOSITION",  label: "構圖", icon: <LayoutTemplate className="h-3.5 w-3.5" /> },
  { key: "COLOR_SCHEME", label: "配色", icon: <Palette className="h-3.5 w-3.5" /> },
  { key: "COPY_TONE",    label: "語氣", icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

// ─── Single component card ────────────────────────────────────────────────────
function ComponentCard({
  comp,
  isInjected,
  onCopy,
  onInject,
  onDelete,
  onViewImage,
}: {
  comp: StyleComponent;
  isInjected: boolean;
  onCopy: (text: string) => void;
  onInject: (comp: StyleComponent) => void;
  onDelete: (id: string) => void;
  onViewImage?: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = CATEGORY_META[comp.type];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!comp.aiPromptText) return;
    await navigator.clipboard.writeText(comp.aiPromptText);
    setCopied(true);
    onCopy(comp.aiPromptText);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInject(comp);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(comp.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={`group relative rounded-xl border p-3 transition-all duration-200 cursor-default select-none
        ${isInjected
          ? `${meta.bg} ${meta.border} ring-2 ring-offset-1 ring-current`
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
        }`}
    >
      {/* Injected badge */}
      {isInjected && (
        <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color} ${meta.border} border`}>
          已帶入
        </span>
      )}

      {/* Preview image thumbnail (if available) */}
      {comp.previewUrl && onViewImage && (
        <button
          onClick={(e) => { e.stopPropagation(); onViewImage(comp.previewUrl!); }}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title="查看來源圖片分析"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comp.previewUrl}
            alt="source"
            className="w-8 h-8 rounded-md object-cover border border-white shadow-md ring-1 ring-gray-200 hover:ring-violet-400 transition-all"
          />
        </button>
      )}

      {/* Card content */}
      <div className="space-y-1.5 pr-6">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${meta.color} ${meta.bg} ${meta.border} border`}
          >
            {meta.label}
          </Badge>
        </div>
        <div className="text-xs font-semibold text-gray-800 leading-snug">{comp.name}</div>

        {comp.type === "COLOR_SCHEME" && (() => {
          const primary = comp.data.primaryColor as string | undefined;
          const secondary = comp.data.secondaryColor as string | undefined;
          return primary ? (
            <div className="flex gap-1 mt-1">
              <span className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: primary }} title={primary} />
              {secondary && <span className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: secondary }} title={secondary} />}
              <span className="text-[10px] text-gray-400 self-center">{primary}</span>
            </div>
          ) : null;
        })()}

        {comp.type === "COMPOSITION" && (
          <div className="text-[11px] text-gray-500 leading-relaxed">
            {(comp.data.description as string) ?? ""}
          </div>
        )}

        {comp.type === "COPY_TONE" && (
          <div className="text-[11px] text-gray-500 leading-relaxed">
            {((comp.data.toneLabels as string[]) ?? []).join("、") || "標準語氣"}
          </div>
        )}

        {comp.aiPromptText && (
          <p className="text-[10px] text-gray-400 font-mono leading-snug line-clamp-2 mt-1">
            {comp.aiPromptText}
          </p>
        )}
      </div>

      {/* Hover action bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-2 pb-2 pt-6
        bg-gradient-to-t from-white/95 to-transparent rounded-b-xl
        opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">

        {/* View source image button */}
        {comp.previewUrl && onViewImage && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewImage(comp.previewUrl!); }}
            className="flex items-center justify-center text-[11px] font-medium py-1 px-2 rounded-lg
              bg-white border border-gray-200 text-violet-600 hover:border-violet-300 hover:text-violet-700 transition-colors shadow-sm"
            title="查看來源圖片分析"
          >
            <ScanSearch className="h-3 w-3" />
          </button>
        )}

        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg
            bg-white border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors shadow-sm"
          title="複製 AI Prompt"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "已複製" : "複製 Prompt"}
        </button>

        <button
          onClick={handleInject}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg transition-colors shadow-sm
            ${isInjected
              ? "bg-gray-100 border border-gray-200 text-gray-400"
              : `${meta.bg} border ${meta.border} ${meta.color} hover:opacity-80`
            }`}
          title="帶入生成台"
          disabled={isInjected}
        >
          <ArrowRightCircle className="h-3 w-3" />
          {isInjected ? "已帶入" : "帶入生成"}
        </button>

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          className={`flex items-center justify-center text-[11px] font-medium py-1 px-2 rounded-lg border transition-colors shadow-sm
            ${confirmDelete
              ? "bg-red-500 border-red-500 text-white"
              : "bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500"
            }`}
          title={confirmDelete ? "再按一次確認刪除" : "刪除"}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="h-6 group-hover:h-0 transition-all duration-200" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export type ComponentGridHandle = { refresh: () => void };

type Props = {
  clientId: string | null;
  injectedSlots: PromptSlots;
  onInject: (comp: StyleComponent) => void;
  onOpenQuickAdd?: () => void;
  onViewImage?: (url: string) => void;
};

export const ComponentGrid = forwardRef<ComponentGridHandle, Props>(function ComponentGrid(
  { clientId, injectedSlots, onInject, onOpenQuickAdd, onViewImage }, ref
) {
  const [components, setComponents] = useState<StyleComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [lastCopied, setLastCopied] = useState<string | null>(null);

  const loadComponents = useCallback(() => {
    setLoading(true);
    const url = clientId ? `/api/components?clientId=${clientId}` : "/api/components";
    fetch(url)
      .then((r) => r.json())
      .then(setComponents)
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  useImperativeHandle(ref, () => ({ refresh: loadComponents }), [loadComponents]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/components/${id}`, { method: "DELETE" });
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const injectedIds = new Set(
    Object.values(injectedSlots).filter(Boolean).map((c) => c!.id)
  );

  const filtered =
    activeTab === "ALL" ? components : components.filter((c) => c.type === activeTab);

  const grouped = filtered.reduce<Record<string, StyleComponent[]>>((acc, c) => {
    acc[c.type] = [...(acc[c.type] ?? []), c];
    return acc;
  }, {});

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">載入中…</div>;

  if (components.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-4xl mb-3">📦</div>
        <div className="text-sm">
          {clientId ? "此客戶還沒有風格組件" : "還沒有任何風格組件"}
        </div>
        <div className="text-xs mt-1 mb-5">生成活動後，AI 會自動提取並儲存風格組件</div>
        {onOpenQuickAdd && (
          <button
            onClick={onOpenQuickAdd}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            手動加入素材
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {lastCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none animate-in fade-in slide-in-from-bottom-2">
          ✓ Prompt 已複製到剪貼簿
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`text-[10px] ${activeTab === tab.key ? "text-gray-400" : "text-gray-300"}`}>
                {tab.key === "ALL"
                  ? components.length
                  : components.filter((c) => c.type === tab.key).length}
              </span>
            </button>
          ))}
        </div>
        {onOpenQuickAdd && (
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 text-xs font-medium bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            加入素材
          </button>
        )}
      </div>

      {/* Cards by group */}
      {Object.entries(grouped).map(([type, items]) => {
        const meta = CATEGORY_META[type as ComponentCategory];
        return (
          <div key={type}>
            <h3 className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${meta.color}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${meta.bg.replace("bg-", "bg-")} border ${meta.border}`} />
              {meta.label}
              <span className="text-gray-400 font-normal">({items.length})</span>
            </h3>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((comp) => (
                <ComponentCard
                  key={comp.id}
                  comp={comp}
                  isInjected={injectedIds.has(comp.id)}
                  onCopy={(text) => {
                    setLastCopied(text);
                    setTimeout(() => setLastCopied(null), 2500);
                  }}
                  onInject={onInject}
                  onDelete={handleDelete}
                  onViewImage={onViewImage}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
