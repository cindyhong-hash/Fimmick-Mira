"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiLayoutPicker } from "@/components/activities/MultiLayoutPicker";

export default function NewActivityPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState("");
  const [showPicker, setShowPicker] = useState(true); // 進入立即彈出
  const router = useRouter();

  useEffect(() => {
    params.then(({ clientId }) => setClientId(clientId));
  }, [params]);

  // 選版型 → 依 single / 其他 路由到對應填寫頁
  const handlePick = (layoutId: string) => {
    setShowPicker(false);
    if (layoutId === "single") {
      router.push(`/clients/${clientId}/activities/new/single`);
    } else {
      router.push(`/clients/${clientId}/activities/new/multi?layout=${layoutId}`);
    }
  };

  if (!clientId) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-8">新增活動</h1>

      {/* 未選版型時的提示（關閉 popup 後可重新開啟）*/}
      <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
        請先選擇一個版型
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-violet-600 hover:text-violet-700 font-medium"
          >
            開啟版型選擇 →
          </button>
        </div>
      </div>

      {showPicker && (
        <MultiLayoutPicker onSelect={handlePick} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
