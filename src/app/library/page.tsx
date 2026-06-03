"use client";
/**
 * LibraryPage  (/library)
 * ───────────────────────
 * Tabs:
 *   "生成圖片"  → AssetGrid + PromptComposer
 *   "風格組件"  → ComponentGrid (hover-inject)
 *   "圖片分析"  → ImageAnalyzer (upload → AI style analysis)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { FolderOpen, Images, Layers, ScanSearch } from "lucide-react";
import { AssetGrid } from "@/components/library/AssetGrid";
import { ComponentGrid, type ComponentGridHandle } from "@/components/library/ComponentGrid";
import { PromptComposer } from "@/components/library/PromptComposer";
import { QuickAddModal } from "@/components/library/QuickAddModal";
import { ImageAnalyzer } from "@/components/library/ImageAnalyzer";
import type { StyleComponent, PromptSlots } from "@/types/library";
import { CATEGORY_META } from "@/types/library";

type Client = { id: string; name: string; _count: { activities: number } };
type Tab = "assets" | "components" | "analyzer";

export default function LibraryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [slots, setSlots] = useState<PromptSlots>({ layout: null, color: null, tone: null });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [analyzerImageUrl, setAnalyzerImageUrl] = useState<string | null>(null);
  const componentGridRef = useRef<ComponentGridHandle>(null);

  // Navigate from ComponentCard thumbnail → 圖片分析 tab
  const handleViewImage = useCallback((url: string) => {
    setAnalyzerImageUrl(url);
    setTab("analyzer");
  }, []);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data: Client[]) => {
        setClients(data);
        if (data.length > 0 && !selectedClientId) {
          setSelectedClientId(data[0].id);
        }
      });
  }, []);

  const handleInject = useCallback((comp: StyleComponent) => {
    const slotKey = CATEGORY_META[comp.type].slot as keyof PromptSlots;
    setSlots((prev) => ({ ...prev, [slotKey]: comp }));
    setTab("assets");
  }, []);

  const handleClearSlot = useCallback((key: keyof PromptSlots) => {
    setSlots((prev) => ({ ...prev, [key]: null }));
  }, []);

  const filledSlotCount = Object.values(slots).filter(Boolean).length;

  return (
    <>
    <div className="flex gap-0 min-h-[calc(100vh-4rem)] -mx-6 -mt-6">

      {/* ── Left: Client folder sidebar ── */}
      <aside className="w-44 shrink-0 border-r bg-gray-50/70 pt-6 pb-4 flex flex-col gap-1 px-3">
        <div className="text-xs font-semibold text-gray-500 px-2 mb-3 uppercase tracking-wide">
          客戶資料夾
        </div>

        <button
          onClick={() => setSelectedClientId(null)}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left w-full ${
            selectedClientId === null
              ? "bg-gray-200 font-medium text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Layers className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">全部</span>
        </button>

        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() => setSelectedClientId(client.id)}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left w-full ${
              selectedClientId === client.id
                ? "bg-gray-200 font-medium text-gray-900"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate flex-1">{client.name}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{client._count.activities}</span>
          </button>
        ))}
      </aside>

      {/* ── Right: Tab bar + content ── */}
      <div className="flex-1 px-6 pt-6 pb-8 overflow-auto min-w-0">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold">
            素材庫
            {selectedClientId && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                — {clients.find((c) => c.id === selectedClientId)?.name}
              </span>
            )}
          </h1>

          {filledSlotCount > 0 && (
            <button
              onClick={() => setTab("assets")}
              className="flex items-center gap-1.5 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full hover:bg-violet-100 transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] flex items-center justify-center font-bold">
                {filledSlotCount}
              </span>
              積木已選取，前往組合台
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b mb-6">
          {([
            { key: "assets" as Tab,     label: "生成圖片", icon: <Images className="h-4 w-4" /> },
            { key: "components" as Tab, label: "風格組件", icon: <Layers className="h-4 w-4" /> },
            { key: "analyzer" as Tab,   label: "圖片分析", icon: <ScanSearch className="h-4 w-4" /> },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-black text-black"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "assets" && (
          <div className="space-y-8">
            <PromptComposer slots={slots} onClearSlot={handleClearSlot} />
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-4">圖片紀錄</h2>
              <AssetGrid clientId={selectedClientId} />
            </div>
          </div>
        )}

        {tab === "components" && (
          <ComponentGrid
            ref={componentGridRef}
            clientId={selectedClientId}
            injectedSlots={slots}
            onInject={handleInject}
            onOpenQuickAdd={() => setShowQuickAdd(true)}
            onViewImage={handleViewImage}
          />
        )}

        {tab === "analyzer" && (
          <div className="max-w-xl">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-700">圖片風格分析</h2>
              <p className="text-xs text-gray-400 mt-0.5">上傳任何圖片，AI 自動分析構圖・配色・語氣，可直接加入素材庫</p>
            </div>
            <ImageAnalyzer
              clientId={selectedClientId}
              initialImageUrl={analyzerImageUrl}
              onSaved={() => componentGridRef.current?.refresh()}
            />
          </div>
        )}

      </div>
    </div>

    {showQuickAdd && (
      <QuickAddModal
        clientId={selectedClientId}
        onClose={() => setShowQuickAdd(false)}
        onSaved={() => {
          setShowQuickAdd(false);
          setTab("components");
          componentGridRef.current?.refresh();
        }}
      />
    )}
    </>
  );
}
