"use client";
import { useState } from "react";
import { AssetGrid } from "@/components/library/AssetGrid";
import { ComponentGrid } from "@/components/library/ComponentGrid";

export default function LibraryPage() {
  const [tab, setTab] = useState<"assets" | "components">("assets");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">素材庫</h1>
      <div className="flex gap-4 border-b mb-6">
        {(["assets", "components"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-black text-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t === "assets" ? "生成圖片" : "風格組件"}
          </button>
        ))}
      </div>
      {tab === "assets" ? <AssetGrid /> : <ComponentGrid />}
    </div>
  );
}
