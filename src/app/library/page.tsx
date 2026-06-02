"use client";
/**
 * LibraryPage  (/library)
 * ───────────────────────
 * Layout:
 *   [Left: client folder sidebar (160px)]
 *   [Right: tab bar + content]
 *     Tab "生成圖片"  → AssetGrid (filtered) + PromptComposer
 *     Tab "風格組件"  → ComponentGrid (filtered, hover-inject)
 *
 * Shared state:
 *   selectedClientId  – drives all child fetches
 *   slots             – the 3 PromptComposer injection slots
 *     injecting from ComponentGrid (any tab) → fills a slot
 *     switching back to "生成圖片" shows the filled composer
 */

import { useEffect, useState, useCallback } from "react";
import { FolderOpen, Images, Layers } from "lucide-react";
import { AssetGrid } from "@/components/library/AssetGrid";
import { ComponentGrid } from "@/components/library/ComponentGrid";
import { PromptComposer } from "@/components/library/PromptComposer";
import type { StyleComponent, PromptSlots } from "@/types/library";
import { CATEGORY_META } from "@/types/library";

type Client = { id: string; name: string; _count: { activities: number } };
type Tab = "assets" | "components";

export default function LibraryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [slots, setSlots] = useState<PromptSlots>({ layout: null, color: null, tone: null });

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

  /** Called by ComponentGrid when user clicks "帶入生成" */
  const handleInject = useCallback((comp: StyleComponent) => {
    const slotKey = CATEGORY_META[comp.type].slot as keyof PromptSlots;
    setSlots((prev) => ({ ...prev, [slotKey]: comp }));
    // Auto-switch to assets tab so user sees the composer update
    setTab("assets");
  }, []);

  const handleClearSlot = useCallback((key: keyof PromptSlots) => {
    setSlots((prev) => ({ ...prev, [key]: null }));
  }, []);

  const filledSlotCount = Object.values(slots).filter(Boolean).length;

  return (
    <div className="flex gap-0 min-h-[calc(100vh-4rem)] -mx-6 -mt-6">

      {/* ── Left: Client folder sidebar ── */}
      <aside className="w-44 shrink-0 border-r bg-gray-50/70 pt-6 pb-4 flex flex-col gap-1 px-3">
        <div className="text-xs font-semibold text-gray-500 px-2 mb-3 uppercase tracking-wide">
          客戶資料夾
        </div>

        {/* "全部" option */}
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

          {/* Slot indicator pill (shows when composer has content) */}
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
          {(
            [
              { key: "assets" as Tab, label: "生成圖片", icon: <Images className="h-4 w-4" /> },
              {
                key: "components" as Tab,
                label: "風格組件",
                icon: <Layers className="h-4 w-4" />,
              },
            ] as const
          ).map(({ key, label, icon }) => (
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
        {tab === "assets" ? (
          <div className="space-y-8">
            {/* Prompt Composer always visible on assets tab */}
            <PromptComposer slots={slots} onClearSlot={handleClearSlot} />
            {/* Asset gallery */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-4">圖片紀錄</h2>
              <AssetGrid clientId={selectedClientId} />
            </div>
          </div>
        ) : (
          <ComponentGrid
            clientId={selectedClientId}
            injectedSlots={slots}
            onInject={handleInject}
          />
        )}
      </div>
    </div>
  );
}
