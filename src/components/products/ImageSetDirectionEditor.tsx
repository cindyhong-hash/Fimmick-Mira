"use client";

import type { ImageSetArtDirection } from "@/lib/products/product-visual-analysis";

function splitList(value: string): string[] {
  return value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-gray-700">
    {label}
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
  </label>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <Field label={label} value={value.join("、")} onChange={(next) => onChange(splitList(next))} />;
}

export function ImageSetDirectionEditor({ value, onChange }: {
  value: ImageSetArtDirection;
  onChange: (value: ImageSetArtDirection) => void;
}) {
  const update = <K extends keyof ImageSetArtDirection>(key: K, next: ImageSetArtDirection[K]) => onChange({ ...value, [key]: next });
  return <div className="rounded-2xl border border-[#ebe4f9] bg-[#faf8ff] p-4 sm:p-5">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">Visual direction</p>
      <h3 className="mt-1 text-sm font-bold text-gray-900">微調整批素材共用的視覺方向</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">可用頓號或逗號分隔多個詞。商品識別與批次一致性規則會保留。</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="概念" value={value.concept} onChange={(next) => update("concept", next)} /></div>
      <ListField label="主色" value={value.palette.dominant} onChange={(next) => update("palette", { ...value.palette, dominant: next })} />
      <ListField label="點綴色" value={value.palette.accent} onChange={(next) => update("palette", { ...value.palette, accent: next })} />
      <Field label="光線" value={value.lighting} onChange={(next) => update("lighting", next)} />
      <ListField label="材質" value={value.materials} onChange={(next) => update("materials", next)} />
      <ListField label="氛圍" value={value.mood} onChange={(next) => update("mood", next)} />
      <ListField label="裝飾風格" value={value.decorationStyle} onChange={(next) => update("decorationStyle", next)} />
      <Field label="背景語言" value={value.backgroundLanguage} onChange={(next) => update("backgroundLanguage", next)} />
      <Field label="鏡頭與構圖" value={value.cameraLanguage} onChange={(next) => update("cameraLanguage", next)} />
    </div>
  </div>;
}
