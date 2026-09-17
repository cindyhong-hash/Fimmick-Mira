"use client";

import { useState } from "react";
import { ChevronDown, LockKeyhole } from "lucide-react";
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

export function ImageSetDirectionEditor({ value, productColors, productMaterials, onChange }: {
  value: ImageSetArtDirection;
  productColors: string[];
  productMaterials: string[];
  onChange: (value: ImageSetArtDirection) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const update = <K extends keyof ImageSetArtDirection>(key: K, next: ImageSetArtDirection[K]) => onChange({ ...value, [key]: next });
  const colors = productColors.length ? productColors : value.palette.dominant;
  const materials = productMaterials.length ? productMaterials : value.materials;
  return <div className="rounded-2xl border border-[#ebe4f9] bg-[#faf8ff] p-4 sm:p-5">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">套組方向</p>
      <h3 className="mt-1 text-sm font-bold text-gray-900">AI 已為這組素材設定視覺方向</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">可修改概念；其他畫面細節已依商品與主題預先設定。</p>
    </div>
    <div className="mt-4"><Field label="概念" value={value.concept} onChange={(next) => update("concept", next)} /></div>
    <div className="mt-4 rounded-xl border border-white bg-white/80 p-3.5">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-800"><LockKeyhole className="h-3.5 w-3.5 text-violet-600" />商品原貌鎖定</div>
      <p className="mt-1 text-xs leading-5 text-gray-500">生成時會保留商品既有色彩、材質與外觀，不會當成可調整的畫面配色。</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {colors.map((color) => <span key={`color-${color}`} className="rounded-full bg-[#f5f3ff] px-2.5 py-1 text-[11px] font-medium text-violet-800">{color}</span>)}
        {materials.map((material) => <span key={`material-${material}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">{material}</span>)}
      </div>
    </div>
    <button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      進階調整 AI 已設定的畫面細節 <ChevronDown className={`h-3.5 w-3.5 transition ${advancedOpen ? "rotate-180" : ""}`} />
    </button>
    {advancedOpen && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {imageSetDirectionAdvancedFields(value).map((field) => <Field key={field.key} label={field.label} value={field.value} onChange={(next) => {
        if (field.key === "mood" || field.key === "decorationStyle") update(field.key, splitList(next));
        else update(field.key, next);
      }} />)}
    </div>}
  </div>;
}
