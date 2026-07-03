"use client";
/**
 * LibraryImagePickerModal — 從素材庫（client gallery）揀一張圖做「活動圖參考圖」。
 * 列返該 client 所有素材，可按類型（產品成圖／背景／人像／插畫／參考圖）篩選；
 * 每格顯示類型標籤；搜尋涵蓋 標題 + AI Prompt 文字。點一張即回傳 imageUrl。
 */
import { useEffect, useMemo, useState } from "react";
import { X, Search } from "lucide-react";

type GalleryItem = {
  kind: "generated" | "uploaded" | "material";
  imageUrl: string;
  name?: string;
  subject?: string;
  prompt?: string;
  aiPromptText?: string;
  paramsJson?: string;
};

type TypeKey = "product" | "background" | "person" | "illustration" | "reference";
const TYPE_META: Record<TypeKey, { label: string; cls: string }> = {
  product:      { label: "產品成圖", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  background:   { label: "背景",     cls: "bg-teal-50 text-teal-700 border-teal-200" },
  person:       { label: "人像",     cls: "bg-rose-50 text-rose-700 border-rose-200" },
  illustration: { label: "插畫",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  reference:    { label: "參考圖",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

function itemType(it: GalleryItem): TypeKey {
  if (it.kind === "material") return "background";
  if (it.kind === "uploaded") return "reference";
  try {
    const g = JSON.parse(it.paramsJson ?? "{}").genType as string | undefined;
    if (g === "person") return "person";
    if (g === "illustration") return "illustration";
    if (g === "reference") return "reference";
  } catch { /* ignore */ }
  return "product";
}

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
  const [typeFilter, setTypeFilter] = useState<TypeKey | "ALL">("ALL");

  useEffect(() => {
    fetch(`/api/library/gallery?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: GalleryItem[]) => setItems(Array.isArray(d) ? d.filter((i) => i.imageUrl) : []))
      .finally(() => setLoading(false));
  }, [clientId]);

  const withType = useMemo(() => items.map((it) => ({ it, t: itemType(it) })), [items]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { t } of withType) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [withType]);

  const filtered = withType.filter(({ it, t }) => {
    if (typeFilter !== "ALL" && t !== typeFilter) return false;
    if (!q.trim()) return true;
    const hay = `${it.subject ?? ""} ${it.name ?? ""} ${it.prompt ?? ""} ${it.aiPromptText ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const filterPills: { k: TypeKey | "ALL"; label: string }[] = [
    { k: "ALL", label: "全部" },
    { k: "product", label: "產品成圖" },
    { k: "background", label: "背景" },
    { k: "person", label: "人像" },
    { k: "illustration", label: "插畫" },
    { k: "reference", label: "參考圖" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className="text-sm font-semibold">從素材庫揀參考圖</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 pt-2.5 pb-2 border-b shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋標題 / AI Prompt…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filterPills.map((f) => (
              <button key={f.k} type="button" onClick={() => setTypeFilter(f.k)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${typeFilter === f.k ? "bg-violet-600 text-white border-violet-600" : "bg-white border-gray-200 text-gray-600 hover:border-violet-300"}`}>
                {f.label}{f.k !== "ALL" && counts[f.k] ? ` ${counts[f.k]}` : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-10 text-sm">載入中…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm">冇符合嘅素材</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map(({ it, t }) => (
                <button type="button" key={it.imageUrl} onClick={() => onPick(it.imageUrl)} title={it.subject || it.name || ""}
                  className="relative rounded-xl border border-gray-200 overflow-hidden hover:border-violet-400 hover:shadow-md transition-all">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.imageUrl} alt="" loading="lazy" decoding="async" className="w-full aspect-square object-contain bg-gray-50" />
                  <span className={`absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TYPE_META[t].cls}`}>
                    {TYPE_META[t].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
