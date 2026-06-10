"use client";
/**
 * AssetGrid — 圖片紀錄 (生成圖片 tab)
 * Shows library-generated images (LibraryImage rows) from the gallery union.
 * Refetches whenever `reloadKey` changes (bumped after a successful generation).
 */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { GalleryItem, ImageDetail, StyleComponent } from "@/types/library";

type Props = { clientId: string | null; reloadKey?: number; onOpenImage?: (detail: ImageDetail) => void };

export function AssetGrid({ clientId, reloadKey = 0, onOpenImage }: Props) {
  const [items, setItems] = useState<Extract<GalleryItem, { kind: "generated" }>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = clientId ? `/api/library/gallery?clientId=${clientId}` : "/api/library/gallery";
    fetch(url)
      .then((r) => r.json())
      .then((gal: GalleryItem[]) =>
        setItems(Array.isArray(gal) ? gal.filter((g): g is Extract<GalleryItem, { kind: "generated" }> => g.kind === "generated") : []),
      )
      .finally(() => setLoading(false));
  }, [clientId, reloadKey]);

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">載入中…</div>;
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🖼</div>
        <div className="text-sm">{clientId ? "此客戶尚無生成圖片" : "還沒有生成過任何圖片"}</div>
        <div className="text-xs mt-1">在上方組合積木後按「生成新圖」</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {items.map((item) => {
        // Parse paramsJson to extract slot components for the detail modal
        let slotComps: StyleComponent[] = [];
        try {
          const p = JSON.parse(item.paramsJson ?? "{}");
          slotComps = Object.values(p.slots ?? {}).filter(Boolean) as StyleComponent[];
        } catch { /* ignore */ }

        return (
          <button key={item.libraryImageId} type="button"
            onClick={() => onOpenImage?.({
              imageUrl: item.imageUrl,
              presetComponents: slotComps,
              copyText: item.copyText,
              subject: item.subject,
              regenerateParams: item.paramsJson,
              prompt: item.prompt,
              libraryImageId: item.libraryImageId,
            })}
            className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 bg-white text-left">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.subject ?? "generated"} className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold bg-violet-600 text-white px-1.5 py-0.5 rounded-full shadow">
                <Sparkles className="h-2.5 w-2.5" />AI生成
              </span>
            </div>
            <div className="p-2.5 space-y-1">
              {item.subject && <div className="text-xs font-semibold truncate text-gray-800">{item.subject}</div>}
              {item.copyText && <div className="text-[11px] text-gray-500 line-clamp-2 whitespace-pre-wrap">{item.copyText}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
