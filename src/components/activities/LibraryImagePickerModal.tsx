"use client";
/**
 * LibraryImagePickerModal — 從素材庫（client gallery）揀一張圖做「活動圖參考圖」。
 * 列返該 client 所有素材（產品成圖／背景／人像／插畫／參考圖），點一張即回傳 imageUrl。
 * 用喺 ActivityForm 嘅「風格參考圖 → 從素材庫揀」。
 */
import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";

type GalleryItem = { kind: string; imageUrl: string; name?: string; subject?: string };

export function LibraryImagePickerModal({
  clientId,
  onPick,
  onClose,
}: {
  clientId: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/library/gallery?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: GalleryItem[]) => setItems(Array.isArray(d) ? d.filter((i) => i.imageUrl) : []))
      .finally(() => setLoading(false));
  }, [clientId]);

  const filtered = q.trim()
    ? items.filter((i) => `${i.subject ?? ""} ${i.name ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className="text-sm font-semibold">從素材庫揀參考圖</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-2.5 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋標題…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-10 text-sm">載入中…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm">此客戶暫無素材</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((it) => (
                <button type="button" key={it.imageUrl} onClick={() => onPick(it.imageUrl)} title={it.subject || it.name || ""}
                  className="rounded-xl border border-gray-200 overflow-hidden hover:border-violet-400 hover:shadow-md transition-all">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.imageUrl} alt="" loading="lazy" decoding="async" className="w-full aspect-square object-contain bg-gray-50" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
