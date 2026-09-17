"use client";

import type { ImageSetArtDirection } from "@/lib/products/product-visual-analysis";
import { imageSetDirectionAdvancedFields } from "@/lib/products/image-set-direction";

function splitList(value: string): string[] {
  return value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-gray-700">
    {label}
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
  </label>;
}

export function ImageSetDirectionEditor({ value, onChange }: {
  value: ImageSetArtDirection;
  onChange: (value: ImageSetArtDirection) => void;
}) {
  const update = <K extends keyof ImageSetArtDirection>(key: K, next: ImageSetArtDirection[K]) => onChange({ ...value, [key]: next });
  return <div className="rounded-2xl border border-[#ebe4f9] bg-[#faf8ff] p-4 sm:p-5">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">Visual direction</p>
      <h3 className="mt-1 text-sm font-bold text-gray-900">微調整這批素材共用的視覺方向</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">商品識別與批次一致性規則會保留；只調整畫面概念與表現方式。</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="概念" value={value.concept} onChange={(next) => update("concept", next)} /></div>
      {imageSetDirectionAdvancedFields(value).map((field) => <Field key={field.key} label={field.label} value={field.value} onChange={(next) => {
        if (field.key === "mood" || field.key === "decorationStyle") update(field.key, splitList(next));
        else update(field.key, next);
      }} />)}
    </div>
  </div>;
}
