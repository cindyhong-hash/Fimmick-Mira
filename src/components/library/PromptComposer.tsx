"use client";
/**
 * PromptComposer — 生成圖片 tab 的積木組合台
 * Slots (構圖/配色/語氣/背景) 可點擊揀已有素材；可上傳產品圖（AI 描述填主體 / 直接合成）；
 * 色盤逐色開關；其他注意事項。生成走 POST /api/library/generate。
 */

import { useState, useEffect } from "react";
import {
  X, Copy, Check, Sparkles, LayoutTemplate, Palette, MessageSquare,
  Image as ImageIcon, Target, StickyNote, Loader2, Upload, Plus, Trash2, Type, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptSlots, StyleComponent, ComponentCategory, PaletteColor, PaletteRole } from "@/types/library";
import { CATEGORY_META, getColors, PALETTE_ROLES } from "@/types/library";
import { ColorCards } from "./ColorCards";
import { SlotPickerModal } from "./SlotPickerModal";
import { INDUSTRY_PRESETS } from "@/types/presets";

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

// A palette row mirrors QuickAddModal: fixed 5 roles, checkbox toggles enabled.
type PalRow = { role: PaletteRole; label: string; hex: string; enabled: boolean };

/** Build the 5-role palette table from a COLOR_SCHEME component (absent roles default + disabled). */
function buildPaletteRows(comp: StyleComponent | null): PalRow[] {
  const cols = comp ? getColors(comp.data) : [];
  return PALETTE_ROLES.map((r, idx) => {
    const found = cols.find((c) => c.role === r.role);
    return {
      role: r.role,
      label: r.label,
      hex: found?.hex ?? (idx === 0 ? "#3b82f6" : idx === 1 ? "#1f2937" : "#e5e7eb"),
      enabled: r.role === "primary" ? true : !!found,
    };
  });
}

/** Build the Traditional-Chinese design brief (this is what the user edits; server translates → English).
 *  NOTE: 背景 is an image asset used only in 合成 mode, so it is intentionally NOT part of the text brief. */
function buildChineseBrief(args: {
  subject: string; layoutDesc: string; toneLabels: string[]; usedColors: PaletteColor[]; notes: string;
}): string {
  const lines: string[] = [];
  if (args.subject.trim()) lines.push(`主體：${args.subject.trim()}`);
  if (args.layoutDesc.trim()) lines.push(`構圖：${args.layoutDesc.trim()}`);
  if (args.usedColors.length) lines.push(`配色：${args.usedColors.map((c) => `${c.label} ${c.hex}`).join("、")}`);
  if (args.toneLabels.length) lines.push(`風格語氣：${args.toneLabels.join("、")}`);
  if (args.notes.trim()) lines.push(`其他要求：${args.notes.trim()}`);
  return lines.join("\n");
}

// ─── Tone tag editor ─────────────────────────────────────────────────────────
function ToneTagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.length === 0 && <span className="text-xs text-gray-400 italic">未設定語氣，可新增</span>}
        {tags.map((t, i) => (
          <span key={i} className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 rounded-full border border-amber-200">
            {t}
            <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-500" title="移除"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="輸入語氣後按 Enter（例：溫柔、專業）"
          className="flex-1 border border-amber-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
        <button onClick={add} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs hover:bg-amber-100"><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// ─── Single slot card (full-width, inline-editable) ──────────────────────────
function SlotCard({
  category, icon, emptyLabel, component, onClear, onPick,
  descValue, onDescChange, tags, onTagsChange, colorsDisplay, footer,
}: {
  category: ComponentCategory;
  icon: React.ReactNode;
  emptyLabel: string;
  component: StyleComponent | null;
  onClear: () => void;
  onPick: () => void;
  /** COMPOSITION / BACKGROUND: editable description (繁中). */
  descValue?: string;
  onDescChange?: (v: string) => void;
  /** COPY_TONE: editable tags. */
  tags?: string[];
  onTagsChange?: (t: string[]) => void;
  /** COLOR_SCHEME: palette to display (with live edits). */
  colorsDisplay?: PaletteColor[];
  /** COLOR_SCHEME: palette editor rendered below the swatches. */
  footer?: React.ReactNode;
}) {
  const meta = CATEGORY_META[category];
  const filled = !!component;

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${filled ? `${meta.bg} ${meta.border}` : "border-dashed border-gray-200 bg-gray-50 hover:border-gray-300 cursor-pointer hover:shadow-sm"}`}>
      {/* Header — click to (re)pick the source material */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${filled ? meta.color : "text-gray-400"}`} onClick={onPick}>
          {icon}
          {meta.label}
          {filled && <span className="text-[10px] font-normal text-gray-400">（點此更換素材）</span>}
        </div>
        {filled && (
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-gray-400 hover:text-red-500 transition-colors" title="移除此積木">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filled ? (
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-800 leading-snug">{component.name}</div>

          {category === "COMPOSITION" && onDescChange && (
            <textarea value={descValue ?? ""} onChange={(e) => onDescChange(e.target.value)} rows={2}
              placeholder="構圖描述（繁中，可改）…"
              className="mt-1.5 w-full rounded-lg border border-indigo-200 bg-white/70 px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed" />
          )}

          {category === "BACKGROUND" && (
            (component.data.imageUrl || component.previewUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(component.data.imageUrl as string) || component.previewUrl!} alt="bg" className="mt-2 w-full h-28 object-cover rounded-md border" />
            ) : (
              <div className="mt-1 text-[11px] text-gray-400 italic">此背景無圖片（請改選有圖片的背景）</div>
            )
          )}

          {category === "COPY_TONE" && onTagsChange && (
            <ToneTagEditor tags={tags ?? []} onChange={onTagsChange} />
          )}

          {category === "COLOR_SCHEME" && (
            <>
              {(colorsDisplay?.length ?? 0) > 0 && (
                <div className="mt-2 overflow-hidden">
                  <ColorCards colors={colorsDisplay!} height="h-16" />
                </div>
              )}
              {footer}
            </>
          )}
        </div>
      ) : (
        <div onClick={onPick} className="text-xs text-gray-400 italic mt-2 cursor-pointer">{emptyLabel}</div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function PromptComposer({ slots, onClearSlot, onPickSlot, clientId, onGenerated, prefill, prefillNonce }: Props) {
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrl: string; copyText: string } | null>(null);
  const [pickerCategory, setPickerCategory] = useState<ComponentCategory | null>(null);
  // Editable compiled prompt override
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Subject input mode — 二選一: "text" (純 AI 生成) or "image" (上傳去背產品圖 → 合成用原圖)
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [productUploading, setProductUploading] = useState(false);
  const [describing, setDescribing] = useState(false);
  const composite = inputMode === "image" && !!productUrl;

  // ── Inline-edit overrides (local; never overwrite the library component) ──
  const [layoutDescOv, setLayoutDescOv] = useState<string | null>(null);
  const [toneLabelsOv, setToneLabelsOv] = useState<string[] | null>(null);
  // Palette as a fixed 5-role table (same model as QuickAddModal): checkbox enables/disables.
  const [paletteRows, setPaletteRows] = useState<PalRow[] | null>(null);

  const effRows = paletteRows ?? buildPaletteRows(slots.color);
  const enabledColors: PaletteColor[] = effRows.filter((r) => r.enabled).map((r) => ({ hex: r.hex, role: r.role, label: r.label }));
  const effLayoutDesc = layoutDescOv ?? ((slots.layout?.data?.description as string) ?? "");
  const effToneLabels = toneLabelsOv ?? ((slots.tone?.data?.toneLabels as string[]) ?? []);

  // Reset overrides when a slot's source material changes — using React's documented
  // "adjust state during render by comparing to previous state" pattern (no effects),
  // which avoids the cascading re-renders that made the composer feel laggy / hard to click.
  const [prevColorId, setPrevColorId] = useState(slots.color?.id);
  const [prevLayoutId, setPrevLayoutId] = useState(slots.layout?.id);
  const [prevToneId, setPrevToneId] = useState(slots.tone?.id);
  if (prevColorId !== slots.color?.id) { setPrevColorId(slots.color?.id); setPaletteRows(null); }
  if (prevLayoutId !== slots.layout?.id) { setPrevLayoutId(slots.layout?.id); setLayoutDescOv(null); }
  if (prevToneId !== slots.tone?.id) { setPrevToneId(slots.tone?.id); setToneLabelsOv(null); }

  // Prefill from 重新生成 (#5)
  useEffect(() => {
    if (prefillNonce === undefined) return;
    if (prefill?.subject !== undefined) setSubject(prefill.subject);
    if (prefill?.notes !== undefined) setNotes(prefill.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  const usedColors = enabledColors;
  // The auto-built brief is Traditional Chinese; server translates it to English for FLUX.
  const autoPrompt = buildChineseBrief({ subject, layoutDesc: effLayoutDesc, toneLabels: effToneLabels, usedColors, notes });
  // Read-only preview: the brief is fully derived from the fields above (no manual edit here).
  const compiledPrompt = autoPrompt;
  const hasAnyContent = compiledPrompt.length > 0;
  const canGenerate = inputMode === "image" ? !!productUrl : hasAnyContent;

  // Update one palette role (toggle enable, or change hex).
  const updateRow = (role: PaletteRole, patch: Partial<PalRow>) =>
    setPaletteRows(effRows.map((r) => (r.role === role ? { ...r, ...patch } : r)));

  // Apply an industry preset: fill all 4 slots with virtual components (not saved to DB)
  function applyPreset(p: typeof INDUSTRY_PRESETS[0]) {
    setActivePreset(p.key);
    const makeComp = (type: ComponentCategory, name: string, data: Record<string, unknown>, aiPromptText: string): StyleComponent => ({
      id: `preset-${p.key}-${type}`, type, name, data, aiPromptText,
      previewUrl: null, clientId: null, sourceLayoutId: "", createdAt: new Date().toISOString(),
    });
    // Fold the preset's background description into the composition so the scene is still
    // described in the (text) brief — 背景 slot is now image-only, so we don't fill it from a preset.
    const compositionDesc = [p.composition.description, p.background.description].filter(Boolean).join("，");
    onPickSlot(makeComp("COMPOSITION", p.composition.name, { description: compositionDesc }, p.composition.aiPromptText));
    onPickSlot(makeComp("COLOR_SCHEME", p.color.name, { colors: p.color.colors, primaryColor: p.color.colors[0]?.hex }, p.color.aiPromptText));
    onPickSlot(makeComp("COPY_TONE", p.tone.name, { toneLabels: p.tone.toneLabels }, p.tone.aiPromptText));
  }

  const copyPrompt = async () => {
    if (!compiledPrompt) return;
    await navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  async function uploadProduct(file: File) {
    setProductUploading(true);
    setGenError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url } = await res.json();
      setProductUrl(url);
      // Auto-describe after upload
      setDescribing(true);
      try {
        const dr = await fetch("/api/library/describe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
        });
        const dd = await dr.json();
        if (dr.ok && dd.subject) setSubject(dd.subject);
      } catch { /* non-critical */ } finally {
        setDescribing(false);
      }
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
      const palette = effRows.map((r) => ({ hex: r.hex, role: r.role, label: r.label, use: r.enabled }));
      // Build effective slots reflecting the inline edits (so copy/tone uses the latest values).
      const effectiveSlots: PromptSlots = {
        layout: slots.layout ? { ...slots.layout, data: { ...slots.layout.data, description: effLayoutDesc } } : null,
        background: slots.background, // image-only asset, used as-is in 合成 mode
        color: slots.color ? { ...slots.color, data: { ...slots.color.data, colors: enabledColors } } : null,
        tone: slots.tone ? { ...slots.tone, data: { ...slots.tone.data, toneLabels: effToneLabels } } : null,
      };
      const res = await fetch("/api/library/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, subject, slots: effectiveSlots, palette, notes,
          productImageUrl: composite ? productUrl : undefined,
          composite: composite && !!productUrl,
          // Always send the (Chinese) brief — server translates it to an English FLUX prompt.
          customPrompt: composite ? undefined : compiledPrompt,
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
        {/* Industry preset quick-fill */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />套用行業範本（一鍵填入所有積木）
          </label>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRY_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => applyPreset(p)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  activePreset === p.key
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600"}`}>
                <span>{p.emoji}</span>{p.label}
              </button>
            ))}
            {activePreset && (
              <button type="button" onClick={() => { setActivePreset(null); ["layout","color","tone","background"].forEach((k) => onClearSlot(k as keyof PromptSlots)); }}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                <X className="h-3 w-3" />清除範本
              </button>
            )}
          </div>
        </div>

        {/* Subject — 二選一: 文字主體 (純 AI) 或 產品圖 (合成用原圖) */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Target className="h-3.5 w-3.5 text-emerald-500" />主體物件（文字 或 產品圖，二選一）
          </label>

          {/* Mode toggle */}
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setInputMode("text")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                inputMode === "text" ? "bg-violet-600 text-white border-violet-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
              <Type className="h-3.5 w-3.5" />文字主體（AI 生成）
            </button>
            <button type="button" onClick={() => setInputMode("image")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                inputMode === "image" ? "bg-violet-600 text-white border-violet-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
              <ImageIcon className="h-3.5 w-3.5" />產品圖（合成用原圖）
            </button>
          </div>

          {/* Text input — disabled when in image mode */}
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            disabled={inputMode !== "text"}
            placeholder="例：冬季除毛、夏日防曬面膜、復古腳踏車…"
            className={`w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition ${
              inputMode === "text" ? "border-gray-200" : "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"}`} />

          {/* Product image area — disabled (greyed) when in text mode */}
          <div className={inputMode === "image" ? "" : "opacity-40 pointer-events-none select-none"}>
            <input id="composer-product" type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) uploadProduct(e.target.files[0]); }} />
            {!productUrl ? (
              <button onClick={() => document.getElementById("composer-product")?.click()} disabled={productUploading || inputMode !== "image"}
                className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 border-2 border-dashed border-gray-200 rounded-lg py-2.5 hover:border-violet-300 hover:text-violet-500 transition-colors">
                {productUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {productUploading ? "上傳中…" : "上傳去背產品圖（透明 PNG）"}
              </button>
            ) : (
              <div className="relative rounded-lg border border-gray-200 p-3">
                {/* Remove → trash icon, top-right */}
                <button onClick={() => setProductUrl(null)} title="移除產品圖"
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productUrl} alt="product" className="w-24 h-24 object-contain rounded-md border bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:12px_12px] mx-auto" />
                {/* AI 讀圖填主體 — centered (fills the text field as reference) */}
                <div className="flex justify-center mt-2">
                  <button onClick={describeProduct} disabled={describing}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-60">
                    {describing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}AI 讀圖填主體（參考用，可切回文字生成）
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug text-center mt-1.5">
                  合成模式會把此去背產品疊入背景。未去背可用 <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" className="underline">remove.bg</a> / <a href="https://www.photoroom.com/tools/background-remover" target="_blank" rel="noreferrer" className="underline">photoroom</a> 去背後再上傳。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Style blocks — full-width stacked, placed below 主體物件. Each optional: 點卡片選取 / ✕ 移除 */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />風格積木（可選，按需增減：點卡片選取素材，右上 ✕ 移除）
          </label>

          <SlotCard category="COMPOSITION" icon={<LayoutTemplate className="h-4 w-4" />} emptyLabel="點擊選取構圖"
            component={slots.layout} onClear={() => onClearSlot("layout")} onPick={() => setPickerCategory("COMPOSITION")}
            descValue={effLayoutDesc} onDescChange={setLayoutDescOv} />

          <SlotCard category="BACKGROUND" icon={<ImageIcon className="h-4 w-4" />} emptyLabel="點擊選取背景圖（只用於合成模式）"
            component={slots.background} onClear={() => onClearSlot("background")} onPick={() => setPickerCategory("BACKGROUND")} />

          <SlotCard category="COLOR_SCHEME" icon={<Palette className="h-4 w-4" />} emptyLabel="點擊選取配色"
            component={slots.color} onClear={() => onClearSlot("color")} onPick={() => setPickerCategory("COLOR_SCHEME")}
            colorsDisplay={enabledColors}
            footer={
              <div className="mt-3 pt-3 border-t border-rose-200/60" onClick={(e) => e.stopPropagation()}>
                <div className="text-[11px] font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-rose-500" />配色使用（主色必用，其餘勾選啟用 · 可改色）
                </div>
                <div className="space-y-1.5">
                  {effRows.map((r) => {
                    const locked = r.role === "primary";
                    const hint = PALETTE_ROLES.find((x) => x.role === r.role)?.hint ?? "";
                    return (
                      <div key={r.role} className={`flex items-center gap-2 ${r.enabled ? "" : "opacity-45"}`}>
                        <button type="button" disabled={locked} onClick={() => updateRow(r.role, { enabled: !r.enabled })}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${r.enabled ? "bg-rose-500 border-rose-500" : "border-gray-300 bg-white"} ${locked ? "cursor-default" : ""}`}
                          title={locked ? "主色必用" : "啟用 / 停用"}>
                          {r.enabled && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <input type="color" value={r.hex} onChange={(e) => updateRow(r.role, { hex: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0" />
                        <input value={r.hex} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateRow(r.role, { hex: v }); }}
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-700 leading-none">{r.label}</div>
                          <div className="text-[10px] text-gray-400 leading-none mt-0.5 truncate">{hint}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          />

          <SlotCard category="COPY_TONE" icon={<MessageSquare className="h-4 w-4" />} emptyLabel="點擊選取語氣"
            component={slots.tone} onClear={() => onClearSlot("tone")} onPick={() => setPickerCategory("COPY_TONE")}
            tags={effToneLabels} onTagsChange={setToneLabelsOv} />
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

        {/* Compiled prompt — editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />設計描述預覽（唯讀 · 自動產生，請在上方欄位修改）
            </span>
            <button onClick={copyPrompt} disabled={!hasAnyContent}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
                hasAnyContent ? (copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400")
                : "opacity-30 cursor-not-allowed border-gray-200 text-gray-400"}`}>
              {copied ? <><Check className="h-3 w-3" />已複製</> : <><Copy className="h-3 w-3" />複製</>}
            </button>
          </div>
          {/* Read-only display (NOT an input) — muted, caption-like so it never looks editable */}
          <div className="w-full rounded-lg bg-gray-100/70 px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap select-text">
            {compiledPrompt || (
              <span className="text-gray-400">選取積木或輸入主體後，這裡會自動組裝繁中設計描述；生成時自動翻譯成英文 prompt 餵圖像模型。</span>
            )}
          </div>
          {/* Composite info — NOT part of the brief / not translated, just explains what will happen */}
          {(composite || (slots.background && (slots.background.data?.imageUrl || slots.background.previewUrl))) && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 space-y-0.5">
              {composite && (
                <div className="text-[11px] text-violet-700 flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3 shrink-0" />合成模式：生成時直接疊用你上傳的去背產品圖（不經文字描述）
                </div>
              )}
              {slots.background && (slots.background.data?.imageUrl || slots.background.previewUrl) && (
                <div className="text-[11px] text-violet-700 flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3 shrink-0" />背景：直接使用所選背景圖「{slots.background.name}」（不經文字描述）
                </div>
              )}
            </div>
          )}
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
