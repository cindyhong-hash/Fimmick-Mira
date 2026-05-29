"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type Asset = {
  id: string;
  imageUrl: string;
  layoutType: string;
  copyText: string;
  activity: { theme: string; client: { name: string } };
};

export function AssetGrid() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then(setAssets)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">載入中...</div>;
  if (assets.length === 0)
    return <div className="text-center py-20 text-gray-400">還沒有生成過任何圖片</div>;

  return (
    <div className="grid grid-cols-4 gap-4">
      {assets.map((asset) => (
        <div key={asset.id} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
          <img
            src={asset.imageUrl}
            alt={asset.activity.theme}
            className="w-full aspect-square object-cover"
          />
          <div className="p-2">
            <div className="text-xs font-medium truncate">{asset.activity.theme}</div>
            <div className="text-xs text-gray-400 truncate">{asset.activity.client.name}</div>
            <Badge variant="outline" className="text-xs mt-1">Layout {asset.layoutType}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
