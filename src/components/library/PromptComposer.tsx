"use client";
/**
 * PromptComposer — 生成圖片 tab 的積木組合台
 * Slots (構圖/配色/語氣/背景) 可點擊揀已有素材；可上傳產品圖（AI 描述填主體 / 直接合成）；
 * 色盤逐色開關；其他注意事項。生成走 POST /api/library/generate。
 */

import { useState, useEffect } from "react";
import {
  X, Copy, Check, Sparkles, LayoutTemplate, Palette, MessageSquare,
  Image as ImageIcon, Target, StickyNote, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptSlots, StyleComponent, ComponentCategory, PaletteColor } from "@/types/library";
import { CATEGORY_META, getColors } from "@/types/library";
import { ColorCards } from "./ColorCards";
import { SlotPickerModal } from "./SlotPickerModal";

type Prefill = { subject?: string; notes?: string; useFlags?: Record<string, boolean> };

type Props = {
  slots: PromptSlots;
  onClearSlot: (slot: keyof PromptSlots) => void;
  onPickSlot: (comp: StyleComponent) => void;
  clientId: string | null;
  onGenerated?: () => void;
  prefill?: Prefill;
  prefillNonce?: number;
};

const SLOT_META: { key: keyof PromptSlots; category: ComponentCategory; icon: React.ReactNode; emptyLabel: string }[] = [
  { key: "layout", category: "COMPOSITION", icon: <LayoutTemplate className="h-4 w-4" />, emptyLabel: "點擊選取構圖" },
  { key: "background", category: "BACKGROUND", icon: <ImageIcon className="h-4 w-4" />, emptyLabel: "點擊選取背景" },
  { key: "color", category: "COLOR_SCHEME", icon: <Palette className="h-4 w-4" />, emptyLabel: "點擊選取配色" },
  { key: "tone", category: "COPY_TONE", icon: <MessageSquare className="h-4 w-4" />, emptyLabel: "點擊選取語氣" },
];

function buildCompiledPrompt(slots: PromptSlots, subject: string, notes: string, usedColors: PaletteColor[]): string {
  const parts: string[] = [];
  if (slots.layout?.aiPromptText) parts.push(`[Layout: ${slots.layout.aiPromptText}]`);
  if (slots.background?.aiPromptText) parts.push(`[Background: ${slots.background.aiPromptText}]`);
  if (slots.color?.aiPromptText) parts.push(`[Color: ${slots.color.aiPromptText}]`);
  if (usedColors.length) parts.push(`[Palette: ${usedColors.map((c) => c.hex).join(" ")}]`);
  if (slots.tone?.aiPromptText) parts.push(`[Tone: ${slots.tone.aiPromptText}]`);
  if (subject.trim()) parts.push(`[Subject: ${subject.trim()}]`);
  if (notes.trim()) parts.push(`[Notes: ${notes.trim()}]`);
  return parts.join(", ");
}

// ─── Single slot card (clickable → pick) ─────────────────────────────────────
function SlotCard({
  category, icon, emptyLabel, component, onClear, onPick,
}: {
  category: ComponentCategory;
  icon: React.ReactNode;
  emptyLabel: string;
  component: StyleComponent | null;
  onClear: () => void;
  onPick: () => void;
}) {
  const meta = CATEGORY_META[category];
  const filled = !!component;

  return (
    <div onClick={onPick}
      className={`rounded-xl border p-3 transition-all cursor-pointer hover:shadow-sm ${filled ? `${meta.bg} ${meta.border}` : "border-dashed border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${filled ? meta.color : "text-gray-400"}`}>
          {icon}
          {meta.label}
        </div>
        {filled && (
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-gray-400 hover:text-gray-600 transition-colors" title="移除此積木">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filled ? (
        <div>
          <div className="text-xs font-medium text-gray-800 truncate">{component.name}</div>
          {category === "COLOR_SCHEME" && (() => {
            const c = getColors(component.data);
            return c.length ? <div className="mt-1"><ColorCards colors={c} height="h-7" showRole={false} /></div> : null;
          })()}
          {category === "COMPOSITION" && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">{(component.data.description as string) ?? ""}</div>
          )}
          {category === "COPY_TONE" && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">{((component.data.toneLabels as string[]) ?? []).join("、") || "標準語氣"}</div>
          )}
          {category === "BACKGROUND" && Boolean(component.data.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={component.data.imageUrl as string} alt="bg" className="mt-1 w-full h-12 object-cover rounded-md border" />
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">{emptyLabel}</div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function PromptComposer({ slots, onClearSlot, onPickSlot, clientId, onGenerated, prefill, prefillNonce }: Props) {
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [useFlags, setUseFlags] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrl: string; copyText: string } | null>(null);
  const [pickerCategory, setPickerCategory] = useState<ComponentCategory | null>(null);

  // Product upload (#7)
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [productUploading, setProductUploading] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [composite, setComposite] = useState(false);

  const paletteColors = slots.color ? getColors(slots.color.data) : [];

  // Reset use-flags whenever the color slot changes (default: all on).
  useEffect(() => {
    const init: Record<string, boolean> = {};
    paletteColors.forEach((c) => { init[c.hex] = true; });
    setUseFlags(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.color?.id]);

  // Prefill from 重新生成 (#5)
  useEffect(() => {
    if (prefillNonce === undefined) return;
    if (prefill?.subject !== undefined) setSubject(prefill.subject);
    if (prefill?.notes !== undefined) setNotes(prefill.notes);
    if (prefill?.useFlags) setUseFlags(prefill.useFlags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  const usedColors = paletteColors.filter((c) => c.role === "primary" || useFlags[c.hex] !== false);
  const compiledPrompt = buildCompiledPrompt(slots, subject, notes, usedColors);
  const hasAnyContent = compiledPrompt.length > 0;
  const canGenerate = hasAnyContent || (composite && !!productUrl);

  const copyPrompt = async () => {
    if (!compiledPrompt) return;
    await navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleColor = (hex: string) => setUseFlags((p) => ({ ...p, [hex]: p[hex] === false }));

  async function uploadProduct(file: File) {
    setProductUploading(true);
    setGenError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url } = await res.json();
      setProductUrl(url);
    } finally {
      setProductUploading(false);
    }
  }

  async function describeProduct() {
    if (!productUrl) return;
    setDescribing(true);
    setGenError(null);
    try {
      const res = await fetch("/api/library/describe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: productUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "讀圖失敗");
      if (data.subject) setSubject(data.subject);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "讀圖失敗");
    } finally {
      setDescribing(false);
    }
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenError(null);
    setResult(null);
    try {
      const palette = paletteColors.map((c) => ({
        hex: c.hex, role: c.role, use: c.role === "primary" ? true : useFlags[c.hex] !== false,
      }));
      const res = await fetch("/api/library/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, subject, slots, palette, notes,
          productImageUrl: composite ? productUrl : undefined,
          composite: composite && !!productUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      setResult({ imageUrl: data.imageUrl, copyText: data.copyText ?? "" });
      onGenerated?.();
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "生成失敗，請重試");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold text-sm">Prompt 積木組合台</h3>
        <span className="ml-auto text-xs text-gray-400">點積木揀素材，或從「風格組件」帶入</span>
      </div>

      <div className="p-5 space-y-5">
        {/* 4 slots (clickable) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SLOT_META.map(({ key, category, icon, emptyLabel }) => (
            <SlotCard key={key} category={category} icon={icon} emptyLabel={emptyLabel}
              component={slots[key]} onClear={() => onClearSlot(key)} onPick={() => setPickerCategory(category)} />
          ))}
        </div>

        {/* Palette use/skip toggles */}
        {paletteColors.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-rose-500" />
              配色使用（主色必用，其餘可關）
            </div>
            <div className="flex flex-wrap gap-2">
              {paletteColors.map((c) => {
                const locked = c.role === "primary";
                const on = locked || useFlags[c.hex] !== false;
                return (
                  <button key={c.hex} type="button" disabled={locked} onClick={() => toggleColor(c.hex)}
                    className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs transition-all
                      ${on ? "bg-white border-gray-300 text-gray-700" : "bg-gray-100 border-gray-200 text-gray-300 line-through"}
                      ${locked ? "cursor-default" : "hover:border-gray-400"}`}
                    title={locked ? "主色必用" : on ? "點擊：生成時不使用" : "點擊：生成時使用"}>
                    <span className="w-4 h-4 rounded-full border border-white shadow-sm shrink-0" style={{ backgroundColor: c.hex }} />
                    {c.label}
                    {!locked && (on ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3" />)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Subject + product upload */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Target className="h-3.5 w-3.5 text-emerald-500" />主體物件（可打字，或上傳產品圖）
          </label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="例：冬季除毛、夏日防曬面膜、復古腳踏車…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />

          {/* Product upload */}
          <input id="composer-product" type="file" accept="image/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) uploadProduct(e.target.files[0]); }} />
          {!productUrl ? (
            <button onClick={() => document.getElementById("composer-product")?.click()} disabled={productUploading}
              className="mt-1 w-full flex items-center justify-center gap-2 text-xs text-gray-500 border-2 border-dashed border-gray-200 rounded-lg py-2.5 hover:border-violet-300 hover:text-violet-500 transition-colors">
              {productUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {productUploading ? "上傳中…" : "上傳產品圖（可 AI 讀圖填主體，或直接合成）"}
            </button>
          ) : (
            <div className="mt-1 flex gap-3 items-start rounded-lg border border-gray-200 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productUrl} alt="product" className="w-16 h-16 object-contain rounded-md border bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:12px_12px] shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={describeProduct} disabled={describing}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-60">
                    {describing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}AI 讀圖填主體
                  </button>
                  <button onClick={() => { setProductUrl(null); setComposite(false); }}
                    className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">移除</button>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={composite} onChange={(e) => setComposite(e.target.checked)} className="accent-violet-600" />
                  直接合成（去背 PNG 疊到背景積木 / AI 背景）
                </label>
                {composite && (
                  <p className="text-[10px] text-gray-400 leading-snug">
                    需透明去背圖。未去背可用 <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" className="underline">remove.bg</a> 或 <a href="https://www.photoroom.com/tools/background-remover" target="_blank" rel="noreferrer" className="underline">photoroom</a> 去背後再上傳。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <StickyNote className="h-3.5 w-3.5 text-amber-500" />其他注意事項（選填）
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="例：不要加入紅色、營造溫暖放鬆感、避免文字、產品要清晰…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
        </div>

        {/* Compiled prompt preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">編譯後的 AI Prompt</span>
            <button onClick={copyPrompt} disabled={!hasAnyContent}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                hasAnyContent ? (copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400")
                : "opacity-30 cursor-not-allowed border-gray-200 text-gray-400"}`}>
              {copied ? <><Check className="h-3 w-3" />已複製</> : <><Copy className="h-3 w-3" />複製</>}
            </button>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-[64px]">
            {hasAnyContent ? (
              <p className="text-xs text-gray-700 leading-relaxed break-all font-mono">{compiledPrompt}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">選取積木、輸入主體或上傳產品圖後，這裡會顯示組裝好的 AI Prompt…</p>
            )}
          </div>
        </div>

        {/* Generate */}
        <Button onClick={handleGenerate} disabled={!canGenerate || generating}
          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" />{composite ? "合成中…" : "生成中…（約 10–40 秒）"}</>
            : <><Sparkles className="h-4 w-4" />{composite ? "合成產品圖到背景" : "用此 Prompt 生成新圖"}</>}
        </Button>

        {genError && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {genError}</div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageUrl} alt="generated" className="w-32 h-32 object-cover rounded-lg border shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />完成，已加入圖片紀錄
              </div>
              {result.copyText ? (
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{result.copyText}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">（文案暫時失敗，圖片已生成）</p>
              )}
            </div>
          </div>
        )}
      </div>

      {pickerCategory && (
        <SlotPickerModal
          clientId={clientId}
          category={pickerCategory}
          onPick={(comp) => onPickSlot(comp)}
          onClose={() => setPickerCategory(null)}
        />
      )}
    </div>
  );
}
