"use client";
/**
 * QuickAddModal (v3)
 * ──────────────────
 * Four素材 types shown together (構圖 / 配色 / 語氣 / 背景), each toggleable.
 *   1. Upload a reference image (optional) → AI 讀取圖片 fills 構圖/配色/語氣
 *   2. 配色 is a 5-color palette (主色/輔色/強調色/中性色/點綴色); each color toggleable
 *   3. 背景 is upload-only (no AI): its own image + description
 *   4. 儲存 → POSTs one component per checked section in parallel
 */

import { useState, useRef, useEffect } from "react";
import { X, Upload, Sparkles, Loader2, Plus, Trash2, Check } from "lucide-react";
import { CATEGORY_META, PALETTE_ROLES, getColors } from "@/types/library";
import type { PaletteRole, StyleComponent, ComponentCategory } from "@/types/library";
import { INDUSTRY_PRESETS, type IndustryPreset } from "@/types/presets";
import { ColorCards } from "./ColorCards";

type Props = {
  clientId: string | null;
  initialImageUrl?: string | null;
  editComponent?: StyleComponent | null;
  onClose: () => void;
  onSaved: () => void;
};

type PaletteEntry = { role: PaletteRole; label: string; hex: string; enabled: boolean };

const DEFAULT_PALETTE: PaletteEntry[] = PALETTE_ROLES.map((r, idx) => ({
  role: r.role,
  label: r.label,
  hex: idx === 0 ? "#3b82f6" : idx === 1 ? "#1f2937" : "#e5e7eb",
  enabled: idx < 2, // primary + secondary on by default
}));

export function QuickAddModal({ clientId, initialImageUrl, editComponent, onClose, onSaved }: Props) {
  const isEdit = !!editComponent;
  // ── Reference image (for AI analyze) ──
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Section toggles ──
  const [include, setInclude] = useState({
    COMPOSITION: true,
    COLOR_SCHEME: true,
    COPY_TONE: true,
    BACKGROUND: false,
  });

  // ── COMPOSITION ──
  const [compName, setCompName] = useState("");
  const [description, setDescription] = useState("");
  const [compPrompt, setCompPrompt] = useState("");

  // ── COLOR_SCHEME (5-color palette) ──
  const [colorName, setColorName] = useState("");
  const [palette, setPalette] = useState<PaletteEntry[]>(DEFAULT_PALETTE);
  const [colorPrompt, setColorPrompt] = useState("");

  // ── COPY_TONE ──
  const [toneName, setToneName] = useState("");
  const [toneLabels, setToneLabels] = useState<string[]>([]);
  const [toneInput, setToneInput] = useState("");
  const [tonePrompt, setTonePrompt] = useState("");

  // ── BACKGROUND (upload-only) ──
  const [bgName, setBgName] = useState("");
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgDescription, setBgDescription] = useState("");
  const [bgPrompt, setBgPrompt] = useState("");
  const bgFileRef = useRef<HTMLInputElement>(null);

  // ── Industry preset ──
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(p: IndustryPreset) {
    setActivePreset(p.key);
    setCompName(p.composition.name);
    setDescription(p.composition.description);
    setCompPrompt(p.composition.aiPromptText);
    setColorName(p.color.name);
    setColorPrompt(p.color.aiPromptText);
    setPalette(
      PALETTE_ROLES.map((r, idx) => {
        const c = p.color.colors.find((c) => c.role === r.role);
        return {
          role: r.role,
          label: r.label,
          hex: c?.hex ?? (idx === 0 ? "#3b82f6" : idx === 1 ? "#1f2937" : "#e5e7eb"),
          enabled: !!c,
        };
      }),
    );
    setToneName(p.tone.name);
    setToneLabels(p.tone.toneLabels);
    setTonePrompt(p.tone.aiPromptText);
    setBgName(p.background.name);
    setBgDescription(p.background.description);
    setBgPrompt(p.background.aiPromptText);
    setInclude((prev) => ({ ...prev, COMPOSITION: true, COLOR_SCHEME: true, COPY_TONE: true }));
  }

  // ── AI ──
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Save ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Edit-mode init: prefill the one section being edited ──
  useEffect(() => {
    if (!editComponent) return;
    const t = editComponent.type as ComponentCategory;
    setInclude({ COMPOSITION: t === "COMPOSITION", COLOR_SCHEME: t === "COLOR_SCHEME", COPY_TONE: t === "COPY_TONE", BACKGROUND: t === "BACKGROUND" });
    const d = editComponent.data ?? {};
    if (t === "COMPOSITION") { setCompName(editComponent.name); setDescription((d.description as string) ?? ""); setCompPrompt(editComponent.aiPromptText); }
    if (t === "COLOR_SCHEME") {
      setColorName(editComponent.name); setColorPrompt(editComponent.aiPromptText);
      const cols = getColors(d);
      setPalette(PALETTE_ROLES.map((r, idx) => {
        const c = cols.find((c) => c.role === r.role);
        return { role: r.role, label: r.label, hex: c?.hex ?? (idx === 0 ? "#3b82f6" : idx === 1 ? "#1f2937" : "#e5e7eb"), enabled: !!c };
      }));
    }
    if (t === "COPY_TONE") { setToneName(editComponent.name); setToneLabels((d.toneLabels as string[]) ?? []); setTonePrompt(editComponent.aiPromptText); }
    if (t === "BACKGROUND") { setBgName(editComponent.name); setBgImageUrl((d.imageUrl as string) ?? null); setBgDescription((d.description as string) ?? ""); setBgPrompt(editComponent.aiPromptText); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI-detect a background image's description (#6)
  async function detectBg() {
    if (!bgImageUrl) return;
    setAiError(null);
    try {
      const res = await fetch("/api/library/describe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: bgImageUrl, kind: "background" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "偵測失敗");
      if (data.text) setBgDescription(data.text);
      if (data.prompt) setBgPrompt(data.prompt);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "偵測失敗");
    }
  }

  const checkedCount = Object.values(include).filter(Boolean).length;

  // ── Handlers ──
  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { url } = await res.json();
    return url;
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setImageUrl(await uploadFile(file));
    setUploading(false);
  }

  async function handleBgUpload(file: File) {
    setBgUploading(true);
    setBgImageUrl(await uploadFile(file));
    setBgUploading(false);
  }

  function updateColor(role: PaletteRole, patch: Partial<PaletteEntry>) {
    setPalette((prev) => prev.map((p) => (p.role === role ? { ...p, ...patch } : p)));
  }

  async function handleAnalyze() {
    if (!imageUrl) return;
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await fetch("/api/components/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 分析失敗");

      const { composition, colorScheme, copyTone } = data;
      if (composition) {
        setCompName(composition.name ?? "");
        setDescription(composition.description ?? "");
        setCompPrompt(composition.aiPromptText ?? "");
      }
      if (colorScheme) {
        setColorName(colorScheme.name ?? "");
        setColorPrompt(colorScheme.aiPromptText ?? "");
        // Map primary, secondary, then extraColors → accent/neutral/highlight
        const extra: string[] = Array.isArray(colorScheme.extraColors) ? colorScheme.extraColors : [];
        setPalette((prev) =>
          prev.map((p, idx) => {
            if (p.role === "primary" && colorScheme.primaryColor)
              return { ...p, hex: colorScheme.primaryColor, enabled: true };
            if (p.role === "secondary" && colorScheme.secondaryColor)
              return { ...p, hex: colorScheme.secondaryColor, enabled: true };
            const extraIdx = idx - 2; // accent=0, neutral=1, highlight=2
            if (extraIdx >= 0 && extra[extraIdx])
              return { ...p, hex: extra[extraIdx], enabled: true };
            return p;
          }),
        );
      }
      if (copyTone) {
        setToneName(copyTone.name ?? "");
        setToneLabels(copyTone.toneLabels ?? []);
        setTonePrompt(copyTone.aiPromptText ?? "");
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "AI 分析失敗，請重試");
    } finally {
      setAnalyzing(false);
    }
  }

  // Build the {name,data,aiPromptText,previewUrl} payload for one section.
  function payloadFor(type: ComponentCategory) {
    const enabledColors = palette.filter((p) => p.enabled && p.hex);
    const primaryHex = (enabledColors.find((c) => c.role === "primary") ?? enabledColors[0])?.hex;
    const secondaryHex = (enabledColors.find((c) => c.role === "secondary") ?? enabledColors[1])?.hex;
    switch (type) {
      case "COMPOSITION":
        return { name: compName.trim(), data: { description }, aiPromptText: compPrompt, previewUrl: imageUrl };
      case "COLOR_SCHEME":
        return {
          name: colorName.trim(),
          data: { colors: enabledColors.map(({ hex, role, label }) => ({ hex, role, label })), primaryColor: primaryHex, secondaryColor: secondaryHex },
          aiPromptText: colorPrompt, previewUrl: imageUrl,
        };
      case "COPY_TONE":
        return { name: toneName.trim(), data: { toneLabels }, aiPromptText: tonePrompt, previewUrl: imageUrl };
      case "BACKGROUND":
        return { name: bgName.trim(), data: { imageUrl: bgImageUrl, description: bgDescription }, aiPromptText: bgPrompt, previewUrl: bgImageUrl };
    }
  }

  async function handleSave() {
    const errors: string[] = [];
    if (include.COMPOSITION && !compName.trim()) errors.push("構圖");
    if (include.COLOR_SCHEME && !colorName.trim()) errors.push("配色");
    if (include.COPY_TONE && !toneName.trim()) errors.push("語氣");
    if (include.BACKGROUND && !bgName.trim()) errors.push("背景");
    if (errors.length) { setSaveError(`請填寫名稱：${errors.join("、")}`); return; }
    if (checkedCount === 0) { setSaveError("請至少勾選一個素材類型"); return; }

    setSaving(true);
    setSaveError(null);

    // Edit mode: PATCH the single component in place.
    if (isEdit && editComponent) {
      const p = payloadFor(editComponent.type);
      const res = await fetch(`/api/components/${editComponent.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
      });
      setSaving(false);
      if (!res.ok) { setSaveError("儲存失敗，請重試"); return; }
      onSaved();
      onClose();
      return;
    }

    const post = (type: ComponentCategory) =>
      fetch("/api/components", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, clientId, ...payloadFor(type) }),
      });

    const saves: Promise<Response>[] = [];
    if (include.COMPOSITION) saves.push(post("COMPOSITION"));
    if (include.COLOR_SCHEME) saves.push(post("COLOR_SCHEME"));
    if (include.COPY_TONE) saves.push(post("COPY_TONE"));
    if (include.BACKGROUND) saves.push(post("BACKGROUND"));

    const results = await Promise.all(saves);
    setSaving(false);
    if (results.some((r) => !r.ok)) { setSaveError("部分素材儲存失敗，請重試"); return; }
    onSaved();
    onClose();
  }

  const compMeta = CATEGORY_META["COMPOSITION"];
  const colorMeta = CATEGORY_META["COLOR_SCHEME"];
  const toneMeta = CATEGORY_META["COPY_TONE"];
  const bgMeta = CATEGORY_META["BACKGROUND"];

  const enabledColors = palette.filter((p) => p.enabled && p.hex);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">{isEdit ? "編輯素材" : "快速加入素材"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{isEdit ? "修改後儲存即覆蓋原素材" : "構圖・配色・語氣・背景可同時新增"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!isEdit && (<>
          {/* Industry preset picker */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">套用行業範本（一鍵填入構圖 / 配色 / 語氣 / 背景）</label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRY_PRESETS.map((p) => (
                <button key={p.key} onClick={() => applyPreset(p)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    activePreset === p.key
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                  <span>{p.emoji}</span>{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference image upload */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">參考圖片（選填，供 AI 分析構圖/配色/語氣）</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
            {imageUrl ? (
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="preview" className="w-full h-44 object-cover rounded-xl border" />
                <button onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
                <button onClick={handleAnalyze} disabled={analyzing}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg shadow transition-colors disabled:opacity-60">
                  {analyzing
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />AI 分析中…</>
                    : <><Sparkles className="h-3.5 w-3.5" />AI 讀取圖片，填入欄位</>}
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-xs">{uploading ? "上傳中…" : "點擊上傳圖片（可用 AI 自動填入欄位）"}</span>
              </button>
            )}
            {aiError && <p className="text-xs text-red-500 mt-1.5">{aiError}</p>}
          </div>
          </>)}

          {/* COMPOSITION */}
          <SectionWrapper meta={compMeta} label="構圖" checked={include.COMPOSITION}
            onToggle={() => setInclude((p) => ({ ...p, COMPOSITION: !p.COMPOSITION }))}>
            <Field label="素材名稱 *">
              <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="例：留白極簡構圖"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
            <Field label="構圖描述">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：主體置中，大量留白，視覺乾淨" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
            <Field label="AI Prompt（英文，供生成圖片用）">
              <textarea value={compPrompt} onChange={(e) => setCompPrompt(e.target.value)} placeholder="例：centered product, minimal white space, clean" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
          </SectionWrapper>

          {/* COLOR_SCHEME — 5-color palette */}
          <SectionWrapper meta={colorMeta} label="配色" checked={include.COLOR_SCHEME}
            onToggle={() => setInclude((p) => ({ ...p, COLOR_SCHEME: !p.COLOR_SCHEME }))}>
            <Field label="素材名稱 *">
              <input value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="例：暖橙系配色"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </Field>
            <Field label="色盤（最多 5 色，可勾選啟用）">
              {enabledColors.length > 0 && <div className="mb-2"><ColorCards colors={enabledColors} height="h-12" /></div>}
              <div className="space-y-1.5">
                {palette.map((c) => {
                  const roleMeta = PALETTE_ROLES.find((r) => r.role === c.role)!;
                  return (
                    <div key={c.role} className={`flex items-center gap-2 ${c.enabled ? "" : "opacity-45"}`}>
                      <button type="button" onClick={() => roleMeta.toggleable && updateColor(c.role, { enabled: !c.enabled })}
                        disabled={!roleMeta.toggleable}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${c.enabled ? "bg-rose-500 border-rose-500" : "border-gray-300 bg-white"} ${roleMeta.toggleable ? "" : "cursor-default"}`}
                        title={roleMeta.toggleable ? "啟用 / 停用" : "主色必用"}>
                        {c.enabled && <Check className="h-3 w-3 text-white" />}
                      </button>
                      <input type="color" value={c.hex} onChange={(e) => updateColor(c.role, { hex: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0" />
                      <input value={c.hex} onChange={(e) => updateColor(c.role, { hex: e.target.value })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-700 leading-none">{c.label}</div>
                        <div className="text-[10px] text-gray-400 leading-none mt-0.5 truncate">{roleMeta.hint}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
            <Field label="AI Prompt（英文，供生成圖片用）">
              <textarea value={colorPrompt} onChange={(e) => setColorPrompt(e.target.value)} placeholder="例：warm orange tones, high contrast, vibrant palette" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </Field>
          </SectionWrapper>

          {/* COPY_TONE */}
          <SectionWrapper meta={toneMeta} label="語氣" checked={include.COPY_TONE}
            onToggle={() => setInclude((p) => ({ ...p, COPY_TONE: !p.COPY_TONE }))}>
            <Field label="素材名稱 *">
              <input value={toneName} onChange={(e) => setToneName(e.target.value)} placeholder="例：活潑親切語氣"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </Field>
            <Field label="語氣標籤">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {toneLabels.map((l, i) => (
                  <span key={i} className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full border border-amber-200">
                    {l}
                    <button onClick={() => setToneLabels(toneLabels.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={toneInput} onChange={(e) => setToneInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && toneInput.trim()) { e.preventDefault(); setToneLabels([...toneLabels, toneInput.trim()]); setToneInput(""); } }}
                  placeholder="輸入標籤後按 Enter"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <button onClick={() => { if (toneInput.trim()) { setToneLabels([...toneLabels, toneInput.trim()]); setToneInput(""); } }}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <Field label="AI Prompt（供文案生成用）">
              <textarea value={tonePrompt} onChange={(e) => setTonePrompt(e.target.value)} placeholder="例：親切活潑、帶有幽默感、符合年輕族群" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </Field>
          </SectionWrapper>

          {/* BACKGROUND — image optional, AI-detect description */}
          <SectionWrapper meta={bgMeta} label="背景" checked={include.BACKGROUND}
            onToggle={() => setInclude((p) => ({ ...p, BACKGROUND: !p.BACKGROUND }))}>
            <Field label="素材名稱 *">
              <input value={bgName} onChange={(e) => setBgName(e.target.value)} placeholder="例：柔和漸層棚拍背景"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </Field>
            <Field label="背景圖片（選填，可純文字描述）">
              <input ref={bgFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleBgUpload(e.target.files[0]); }} />
              {bgImageUrl ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bgImageUrl} alt="bg" className="w-full h-32 object-cover rounded-xl border" />
                  <button onClick={() => setBgImageUrl(null)}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                  <button onClick={detectBg}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow transition-colors">
                    <Sparkles className="h-3.5 w-3.5" />AI 偵測描述
                  </button>
                </div>
              ) : (
                <button onClick={() => bgFileRef.current?.click()} disabled={bgUploading}
                  className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-teal-300 hover:text-teal-500 transition-colors">
                  {bgUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-xs">{bgUploading ? "上傳中…" : "點擊上傳背景圖"}</span>
                </button>
              )}
            </Field>
            <Field label="背景描述">
              <textarea value={bgDescription} onChange={(e) => setBgDescription(e.target.value)} placeholder="例：米白色棉麻質感、柔光" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </Field>
            <Field label="AI Prompt（英文，供生成圖片用）">
              <textarea value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="例：soft beige linen studio backdrop, gentle light" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </Field>
          </SectionWrapper>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
          {saveError && <p className="text-xs text-red-500 flex-1">{saveError}</p>}
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button onClick={handleSave} disabled={saving || checkedCount === 0}
            className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : isEdit ? <>儲存修改</> : <>儲存已選素材（{checkedCount}）</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──
function SectionWrapper({ meta, label, checked, onToggle, children }: {
  meta: { bg: string; border: string; color: string };
  label: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-opacity ${checked ? "" : "opacity-40"} ${meta.bg} ${meta.border}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 pt-3 pb-2 text-left">
        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? `${meta.border} ${meta.bg}` : "border-gray-300 bg-white"}`}>
          {checked && <Check className={`h-3 w-3 ${meta.color}`} />}
        </span>
        <span className={`text-xs font-semibold ${meta.color}`}>{label}</span>
      </button>
      {checked && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
