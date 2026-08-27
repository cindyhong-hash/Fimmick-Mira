"use client";
/**
 * QuickAddPage — 「上傳參考圖」全頁版（原本係 popup：QuickAddModal）。
 * 由 ComponentGrid 嘅釘死 icon 按鈕，或圖片詳情嘅「分析」/「調整」觸發，
 * 跳嚟呢頁而唔再開 modal。跨頁交接（初始圖／既有積木／libraryImageId）
 * 用 sessionStorage 一次性交接（libraryGenerateHandoff.ts），跟「新增產品／
 * 素材圖片」全頁嗰套做法一致。
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { QuickAddForm } from "@/components/library/QuickAddForm";
import { consumeQuickAddHandoff, type LibraryQuickAddHandoff } from "@/components/library/libraryGenerateHandoff";

export default function QuickAddPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState("");
  const router = useRouter();
  const [handoff, setHandoff] = useState<LibraryQuickAddHandoff | null>(null);
  // 專案（clientId）選擇器：放喺 header 右上角（同下面「編輯/重新生成」等掣同一慣例），
  // 唔再夾喺表單內容中間——嗰度全部項目都係滿版闊度，一粒窄 dropdown 擺埋一齊會唔 align。
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  // consumeQuickAddHandoff() 一次性讀走 sessionStorage——dev 環境 React Strict Mode 會將呢個
  // effect 連續 invoke 兩次，第二次先讀就已經俾第一次清空，令「調整」帶埋嚟嘅構圖/配色靜靜哋
  // 冇咗（頁面淨係跌落「上傳參考圖」空白模式，冇報錯，好隱蔽）。用 ref 確保實際「讀走」呢個
  // 動作淨係執行一次。
  const handoffConsumedRef = useRef(false);
  useEffect(() => {
    params.then(({ clientId }) => setClientId(clientId));
    if (!handoffConsumedRef.current) {
      handoffConsumedRef.current = true;
      setHandoff(consumeQuickAddHandoff());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (clientId) setEditClientId((prev) => (prev === null ? clientId : prev));
  }, [clientId]);

  const isEdit = !!handoff?.prefillComponents && handoff.prefillComponents.length > 0;

  useEffect(() => {
    if (!isEdit) return;
    fetch("/api/clients").then((r) => r.json()).then((data) => setClients(Array.isArray(data) ? data : []));
  }, [isEdit]);

  const backToLibrary = () => router.push(`/clients/${clientId}/components`);

  if (!clientId || !handoff) return null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={backToLibrary} className="text-gray-400 hover:text-gray-700">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold flex-1">{isEdit ? "編輯素材" : "上傳參考圖"}</h1>
        {isEdit && (
          <div className="relative">
            <select value={editClientId ?? ""} onChange={(e) => setEditClientId(e.target.value || null)}
              className="appearance-none text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white cursor-pointer">
              <option value="">全部（無分類）</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      <QuickAddForm
        initialImageUrl={handoff.imageUrl}
        prefillComponents={handoff.prefillComponents}
        libraryImageId={handoff.libraryImageId ?? undefined}
        editClientId={editClientId}
        onCancel={backToLibrary}
        onSaved={backToLibrary}
      />
    </div>
  );
}
