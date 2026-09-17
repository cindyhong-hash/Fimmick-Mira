"use client";

import { Check } from "lucide-react";
import type { ImageSetPlanSelection } from "@/lib/products/image-set-ui";

const CATEGORY_LABELS: Record<ImageSetPlanSelection["category"], string> = {
  product: "商品主體",
  texture: "質地與細節",
  background: "背景",
  benefit: "賣點視覺",
  decoration: "裝飾與版型元素",
};

export function ImageSetPlanChecklist({ items, maxAssets, onToggle }: {
  items: ImageSetPlanSelection[];
  maxAssets: number;
  onToggle: (id: string) => void;
}) {
  const selectedCount = items.filter(({ checked }) => checked).length;
  const groups = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
    category: category as ImageSetPlanSelection["category"],
    label,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length);

  return <div>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><h3 className="text-sm font-bold text-gray-900">選擇這組要建立的素材</h3><p className="mt-1 text-xs text-gray-500">每張都會沿用上方選定的風格與商品原貌；核心素材已預選。</p></div>
      <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">已選 {selectedCount}/{maxAssets}</span>
    </div>
    <div className="space-y-4">{groups.map((group) => <section key={group.category} aria-labelledby={`kit-${group.category}`}>
      <h4 id={`kit-${group.category}`} className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">{group.label}</h4>
      <div className="space-y-2">{group.items.map((item) => {
        const disabled = !item.checked && selectedCount >= maxAssets;
        return <label key={item.id} className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${item.checked ? "border-violet-500 bg-violet-50" : "border-[#e7ebf1] bg-white hover:border-violet-300"} ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}>
          <input className="sr-only" type="checkbox" checked={item.checked} disabled={disabled} onChange={() => onToggle(item.id)} />
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.checked ? "border-violet-600 bg-violet-600 text-white" : "border-gray-300 bg-white"}`}>{item.checked && <Check className="h-3.5 w-3.5" />}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900">{item.assetSubtype.replaceAll("-", " ")}{item.core && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-600">核心</span>}</span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">{item.purpose}</span>
          </span>
        </label>;
      })}</div>
    </section>)}</div>
  </div>;
}
