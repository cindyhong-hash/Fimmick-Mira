"use client";
/**
 * ComponentGrid (merged 風格組件 tab)
 * ──────────────────────────────────
 * Default view = brand image gallery (uploaded analyzed images + generated images).
 * Sub-tabs 全部 / 構圖 / 配色 / 語氣 / 背景 list style-component cards.
 *   • Click a gallery tile OR a component card → ImageDetailModal popup
 *     (image + its 構圖/配色/語氣/背景 + 帶入生成). No hover preview.
 *   • Card actions: 複製 Prompt / 帶入生成 / 刪除 (stopPropagation).
 */

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  Copy, Check, ArrowRightCircle, LayoutTemplate, Palette, MessageSquare,
  Image as ImageIcon, LayoutGrid, Plus, Trash2, Sparkles, Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StyleComponent, ComponentCategory, PromptSlots, GalleryItem, ImageDetail } from "@/types/library";
import { CATEGORY_META, getColors } from "@/types/library";
import { ColorCards } from "./ColorCards";

type FilterTab = "GALLERY" | "ALL" | ComponentCategory;

const FILTER_TABS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
  { key: "GALLERY", label: "圖庫", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: "ALL", label: "全部" },
  { key: "COMPOSITION", label: "構圖", icon: <LayoutTemplate className="h-3.5 w-3.5" /> },
  { key: "COLOR_SCHEME", label: "配色", icon: <Palette className="h-3.5 w-3.5" /> },
  { key: "COPY_TONE", label: "語氣", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: "BACKGROUND", label: "背景", icon: <ImageIcon className="h-3.5 w-3.5" /> },
];

// ─── Component card ──────────────────────────────────────────────────────────
function ComponentCard({
  comp, isInjected, onCopy, onInject, onDelete, onOpen, onEdit,
}: {
  comp: StyleComponent;
  isInjected: boolean;
  onCopy: (text: string) => void;
  onInject: (comp: StyleComponent) => void;
  onDelete: (id: string) => void;
  onOpen: (comp: StyleComponent) => void;
  onEdit?: (comp: StyleComponent) => void;
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) onDelete(comp.id);
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  };

  return (
    <div
      onClick={() => onOpen(comp)}
      className={`relative rounded-xl border p-4 transition-all duration-200 cursor-pointer select-none
        ${isInjected ? `${meta.bg} ${meta.border} ring-2 ring-offset-1 ring-current` : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"}`}
    >
      {isInjected && (
        <span className={`absolute top-2.5 right-2.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color} ${meta.border} border`}>
          已帶入
        </span>
      )}

      <div className="space-y-2">
        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${meta.color} ${meta.bg} ${meta.border} border`}>
          {meta.label}
        </Badge>
        <div className="text-sm font-semibold text-gray-800 leading-snug pr-12">{comp.name}</div>

        {comp.type === "COLOR_SCHEME" && (() => {
          const colors = getColors(comp.data);
          return colors.length ? <ColorCards colors={colors} height="h-16" /> : null;
        })()}

        {comp.type === "COMPOSITION" && (
          <p className="text-xs text-gray-600 leading-relaxed">{(comp.data.description as string) ?? ""}</p>
        )}

        {comp.type === "COPY_TONE" && (
          <div className="flex flex-wrap gap-1">
            {((comp.data.toneLabels as string[]) ?? []).length
              ? (comp.data.toneLabels as string[]).map((t, i) => (
                  <span key={i} className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{t}</span>
                ))
              : <span className="text-xs text-gray-500">標準語氣</span>}
          </div>
        )}

        {comp.type === "BACKGROUND" && Boolean(comp.data.imageUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comp.data.imageUrl as string} alt="bg" className="w-full h-24 object-cover rounded-lg border" />
        )}

        {comp.aiPromptText && (
          <p className="text-[11px] text-gray-400 font-mono leading-snug line-clamp-2">{comp.aiPromptText}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 mt-3">
        <button onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          title="複製 AI Prompt">
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "已複製" : "複製"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onInject(comp); }} disabled={isInjected}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg transition-colors
            ${isInjected ? "bg-gray-100 border border-gray-200 text-gray-400" : `${meta.bg} border ${meta.border} ${meta.color} hover:opacity-80`}`}
          title="帶入生成台">
          <ArrowRightCircle className="h-3 w-3" />
          {isInjected ? "已帶入" : "帶入生成"}
        </button>
        {onEdit && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(comp); }}
            className="flex items-center justify-center text-[11px] py-1.5 px-2 rounded-lg border bg-white border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600 transition-colors"
            title="編輯">
            <Pencil className="h-3 w-3" />
          </button>
        )}
        <button onClick={handleDeleteClick}
          className={`flex items-center justify-center text-[11px] py-1.5 px-2 rounded-lg border transition-colors
            ${confirmDelete ? "bg-red-500 border-red-500 text-white" : "bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500"}`}
          title={confirmDelete ? "再按一次確認刪除" : "刪除"}>
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Gallery tile ────────────────────────────────────────────────────────────
function GalleryTile({ item, onOpen }: { item: GalleryItem; onOpen: (item: GalleryItem) => void }) {
  return (
    <button onClick={() => onOpen(item)}
      className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md hover:border-gray-300 transition-all text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imageUrl} alt="brand" className="w-full aspect-square object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      {item.kind === "generated" ? (
        <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold bg-violet-600 text-white px-1.5 py-0.5 rounded-full shadow">
          <Sparkles className="h-2.5 w-2.5" />生成
        </span>
      ) : (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {(["COMPOSITION", "COLOR_SCHEME", "COPY_TONE", "BACKGROUND"] as ComponentCategory[]).map((t) => (
            <span key={t} className={`w-1.5 h-1.5 rounded-full ${item.types.includes(t) ? "bg-white shadow" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export type ComponentGridHandle = { refresh: () => void };

type Props = {
  clientId: string | null;
  injectedSlots: PromptSlots;
  onInject: (comp: StyleComponent) => void;
  onOpenQuickAdd?: () => void;
  onOpenImage: (detail: ImageDetail) => void;
  onEdit?: (comp: StyleComponent) => void;
};

export const ComponentGrid = forwardRef<ComponentGridHandle, Props>(function ComponentGrid(
  { clientId, injectedSlots, onInject, onOpenQuickAdd, onOpenImage, onEdit }, ref,
) {
  const [components, setComponents] = useState<StyleComponent[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("GALLERY");
  const [lastCopied, setLastCopied] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    const cq = clientId ? `?clientId=${clientId}` : "";
    Promise.all([
      fetch(`/api/components${cq}`).then((r) => r.json()),
      fetch(`/api/library/gallery${cq}`).then((r) => r.json()),
    ])
      .then(([comps, gal]) => {
        setComponents(Array.isArray(comps) ? comps : []);
        setGallery(Array.isArray(gal) ? gal : []);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useImperativeHandle(ref, () => ({ refresh: loadAll }), [loadAll]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/components/${id}`, { method: "DELETE" });
    setComponents((prev) => prev.filter((c) => c.id !== id));
    loadAll();
  }, [loadAll]);

  const injectedIds = new Set(Object.values(injectedSlots).filter(Boolean).map((c) => c!.id));

  const openFromCard = (comp: StyleComponent) => {
    if (comp.previewUrl) onOpenImage({ imageUrl: comp.previewUrl });
    else onOpenImage({ imageUrl: null, presetComponents: [comp] });
  };
  const openFromGallery = (item: GalleryItem) => {
    if (item.kind === "generated")
      onOpenImage({ imageUrl: item.imageUrl, presetComponents: [], copyText: item.copyText, subject: item.subject, regenerateParams: item.paramsJson });
    else onOpenImage({ imageUrl: item.imageUrl });
  };

  const filtered = activeTab === "ALL" || activeTab === "GALLERY"
    ? components
    : components.filter((c) => c.type === activeTab);

  const grouped = filtered.reduce<Record<string, StyleComponent[]>>((acc, c) => {
    acc[c.type] = [...(acc[c.type] ?? []), c];
    return acc;
  }, {});

  const counts = (key: FilterTab) =>
    key === "GALLERY" ? gallery.length
    : key === "ALL" ? components.length
    : components.filter((c) => c.type === key).length;

  return (
    <div className="space-y-5">
      {lastCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none animate-in fade-in slide-in-from-bottom-2">
          ✓ Prompt 已複製到剪貼簿
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
          {FILTER_TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t.icon}
              {t.label}
              <span className={`text-[10px] ${activeTab === t.key ? "text-gray-400" : "text-gray-300"}`}>{counts(t.key)}</span>
            </button>
          ))}
        </div>
        {onOpenQuickAdd && (
          <button onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 text-xs font-medium bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors shrink-0">
            <Plus className="h-3.5 w-3.5" />加入素材
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">載入中…</div>
      ) : activeTab === "GALLERY" ? (
        // ── Gallery view ──
        gallery.length === 0 ? (
          <EmptyState onOpenQuickAdd={onOpenQuickAdd}
            text={clientId ? "此客戶還沒有圖片" : "還沒有任何圖片"} hint="上傳圖片分析，或在「生成圖片」分頁產生新圖" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {gallery.map((item) => (
              <GalleryTile key={`${item.kind}-${item.imageUrl}`} item={item} onOpen={openFromGallery} />
            ))}
          </div>
        )
      ) : components.length === 0 ? (
        <EmptyState onOpenQuickAdd={onOpenQuickAdd}
          text={clientId ? "此客戶還沒有風格組件" : "還沒有任何風格組件"} hint="生成活動或上傳圖片後，會自動提取風格組件" />
      ) : (
        // ── Component cards by group ──
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const meta = CATEGORY_META[type as ComponentCategory];
            return (
              <div key={type}>
                <h3 className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${meta.color}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.bg} border ${meta.border}`} />
                  {meta.label}
                  <span className="text-gray-400 font-normal">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((comp) => (
                    <ComponentCard key={comp.id} comp={comp} isInjected={injectedIds.has(comp.id)}
                      onCopy={(text) => { setLastCopied(text); setTimeout(() => setLastCopied(null), 2500); }}
                      onInject={onInject} onDelete={handleDelete} onOpen={openFromCard} onEdit={onEdit} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

function EmptyState({ onOpenQuickAdd, text, hint }: {
  onOpenQuickAdd?: () => void; text: string; hint: string;
}) {
  return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-4xl mb-3">📦</div>
      <div className="text-sm">{text}</div>
      <div className="text-xs mt-1 mb-5">{hint}</div>
      {onOpenQuickAdd && (
        <button onClick={onOpenQuickAdd}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
          <Plus className="h-4 w-4" />手動加入素材
        </button>
      )}
    </div>
  );
}
