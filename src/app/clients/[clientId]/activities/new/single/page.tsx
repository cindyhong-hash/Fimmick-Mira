"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ActivityForm, type ActivityFormValues } from "@/components/activities/ActivityForm";
import { MultiLayoutPicker } from "@/components/activities/MultiLayoutPicker";

export default function NewSingleActivityPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then(({ clientId }) => setClientId(clientId));
  }, [params]);

  const handleSubmit = async (values: ActivityFormValues) => {
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, clientId, layoutId: "single" }),
    });
    const activity = await res.json();
    router.push(`/clients/${clientId}/activities/${activity.id}`);
  };

  // 重選版型：single 留在本頁；其他版型 → 多圖填寫頁
  const handlePick = (layoutId: string) => {
    setShowPicker(false);
    if (layoutId !== "single") {
      router.push(`/clients/${clientId}/activities/new/multi?layout=${layoutId}`);
    }
  };

  if (!clientId) return null;

  return (
    <div className="max-w-xl">
      {/* 頂部：標題 + 版型標示（可重選）*/}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">新增活動</h1>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-violet-600 border border-gray-200 hover:border-violet-300 rounded-lg px-3 py-1.5 transition-all"
        >
          選擇版型：<span className="font-medium text-gray-800">1張（單圖）</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <ActivityForm clientId={clientId} onSubmit={handleSubmit} />

      {showPicker && (
        <MultiLayoutPicker selectedId="single" onSelect={handlePick} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
