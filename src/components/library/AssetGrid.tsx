"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GeneratedAsset } from "@/types/library";

const LAYOUT_LABELS: Record<string, string> = {
  A: "置中型",
  B: "強烈型",
  C: "氣氛型",
};

type Props = { clientId: string | null };

export function AssetGrid({ clientId }: Props) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = clientId ? `/api/assets?clientId=${clientId}` : "/api/assets";
    fetch(url)
      .then(async (r) => {
        // 防止空 body 或非 JSON 回應讓 r.json() 直接 throw
        const text = await r.text();
        if (!r.ok || !text) {
          console.warn(`[AssetGrid] /api/assets failed (${r.status}):`, text.slice(0, 200));
          return [];
        }
        try {
          const data = JSON.parse(text);
          return Array.isArray(data) ? data : [];
        } catch {
          console.warn("[AssetGrid] /api/assets returned invalid JSON");
          return [];
        }
      })
      .then(setAssets)
      .catch((e) => {
        console.warn("[AssetGrid] fetch error:", e);
        setAssets([]);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">載入中…</div>;
  if (assets.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-4xl mb-3">🖼</div>
        <div className="text-sm">{clientId ? "此客戶尚無生成圖片" : "還沒有生成過任何圖片"}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 bg-white"
        >
          <div className="relative">
            <img
              src={asset.imageUrl}
              alt={asset.activity.theme}
              className="w-full aspect-square object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          </div>
          <div className="p-2.5 space-y-1">
            <div className="text-xs font-semibold truncate text-gray-800">{asset.activity.theme}</div>
            <div className="text-[11px] text-gray-400 truncate">{asset.activity.client.name}</div>
            <Badge variant="outline" className="text-[10px] px-1.5">
              {LAYOUT_LABELS[asset.layoutType] ?? `Layout ${asset.layoutType}`}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
