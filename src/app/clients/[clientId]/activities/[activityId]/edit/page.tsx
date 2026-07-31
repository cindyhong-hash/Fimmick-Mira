"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { ActivityForm, type ActivityFormValues } from "@/components/activities/ActivityForm";
import { MultiLayoutPicker } from "@/components/activities/MultiLayoutPicker";

export default function EditActivityPage({
  params,
}: {
  params: Promise<{ clientId: string; activityId: string }>;
}) {
  const [clientId,   setClientId]   = useState("");
  const [activityId, setActivityId] = useState("");
  const [initial,    setInitial]    = useState<Partial<ActivityFormValues> | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();

  // 重選版型：選單圖 → 留在本頁；選多圖版型 → 轉到多圖編輯（帶 layout 覆寫）
  const handlePick = (layoutId: string) => {
    setShowPicker(false);
    if (layoutId !== "single") {
      router.replace(`/clients/${clientId}/activities/new/multi?edit=${activityId}&layout=${layoutId}`);
    }
  };

  useEffect(() => {
    params.then(({ clientId, activityId }) => {
      setClientId(clientId);
      setActivityId(activityId);
      fetch(`/api/activities/${activityId}`)
        .then((r) => r.json())
        .then((data) => {
          // 多圖活動 → 導向多圖編輯表單（帶 ?edit）
          if (data.layoutId && data.layoutId !== "single") {
            router.replace(`/clients/${clientId}/activities/new/multi?edit=${activityId}`);
            return;
          }
          setInitial({
            requiredText:         data.titleText ?? data.focusPoint ?? "",
            imagePrompt:          data.imagePrompt ?? "",
            imageRatio:           data.imageRatio ?? "1:1",
            imageModel:           data.imageModel ?? "google/gemini-3-pro-image-preview",
            productImageUrls:     data.productImageUrls  ?? [],
            referenceImageUrls:   data.referenceImageUrls ?? [],
            selectedComponentIds: data.selectedComponentIds ?? [],
          });
        });
    });
  }, [params]);

  const handleSubmit = async (values: ActivityFormValues) => {
    await fetch(`/api/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme:                values.requiredText?.slice(0, 30) || values.imagePrompt?.slice(0, 30) || "未命名活動",
        focusPoint:           values.requiredText,
        titleText:            values.requiredText,
        imagePrompt:          values.imagePrompt,
        imageRatio:           values.imageRatio,
        imageModel:           values.imageModel,
        productImageUrls:     values.productImageUrls,
        referenceImageUrls:   values.referenceImageUrls,
        selectedComponentIds: values.selectedComponentIds,
        _regenerate: true,
      }),
    });
    router.push(`/clients/${clientId}/activities/${activityId}`);
  };

  if (!initial) return <div className="text-gray-400">載入中...</div>;

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${clientId}/activities/${activityId}`}
            className="text-gray-400 hover:text-gray-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">編輯活動</h1>
        </div>
        {/* 版型標示 + 重選（與多圖一致）*/}
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-violet-600 border border-gray-200 hover:border-violet-300 rounded-lg px-3 py-1.5 transition-all"
        >
          已選版型：<span className="font-medium text-gray-800">1張（單圖）</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-8 text-sm text-amber-700">
        儲存後將刪除舊的 3 款版型，重新用 AI 生成新版本。
      </div>

      <ActivityForm
        clientId={clientId}
        initialValues={initial}
        submitLabel="儲存並重新生成"
        onSubmit={handleSubmit}
      />

      {showPicker && (
        <MultiLayoutPicker selectedId="single" onSelect={handlePick} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
