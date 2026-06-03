"use client";
/**
 * QuickAddModal (v2)
 * ──────────────────
 * All three types (構圖 / 配色 / 語氣) are shown simultaneously.
 * User can:
 *   1. Upload a reference image (optional)
 *   2. Click "AI 讀取圖片" → fills all three sections at once
 *   3. Edit any section manually
 *   4. Toggle each section on/off with the checkbox
 *   5. "儲存全部" → POSTs one component per checked section in parallel
 */

import { useState, useRef } from "react";
import { X, Upload, Sparkles, Loader2, Plus, Trash2, Check } from "lucide-react";
import { CATEGORY_META } from "@/types/library";

type Props = {
  clientId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function QuickAddModal({ clientId, onClose, onSaved }: Props) {
  // ── Image ────────────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Section toggles ──────────────────────────────────────────────────────────
  const [include, setInclude] = useState({ COMPOSITION: true, COLOR_SCHEME: true, COPY_TONE: true });

  // ── COMPOSITION ──────────────────────────────────────────────────────────────
  const [compName, setCompName] = useState("");
  const [description, setDescription] = useState("");
  const [compPrompt, setCompPrompt] = useState("");

  // ── COLOR_SCHEME ─────────────────────────────────────────────────────────────
  const [colorName, setColorName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");
  const [colorPrompt, setColorPrompt] = useState("");

  // ── COPY_TONE ────────────────────────────────────────────────────────────────
  const [toneName, setToneName] = useState("");
  const [toneLabels, setToneLabels] = useState<string[]>([]);
  const [toneInput, setToneInput] = useState("");
  const [tonePrompt, setTonePrompt] = useState("");

  // ── AI ───────────────────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const checkedCount = Object.values(include).filter(Boolean).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { url } = await res.json();
    setImageUrl(url);
    setUploading(false);
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
        setPrimaryColor(colorScheme.primaryColor ?? "#000000");
        setSecondaryColor(colorScheme.secondaryColor ?? "#ffffff");
        setColorPrompt(colorScheme.aiPromptText ?? "");
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

  async function handleSave() {
    // Validate: each included section must have a name
    const errors: string[] = [];
    if (include.COMPOSITION && !compName.trim()) errors.push("構圖");
    if (include.COLOR_SCHEME && !colorName.trim()) errors.push("配色");
    if (include.COPY_TONE && !toneName.trim()) errors.push("語氣");
    if (errors.length) { setSaveError(`請填寫名稱：${errors.join("、")}`); return; }
    if (checkedCount === 0) { setSaveError("請至少勾選一個素材類型"); return; }

    setSaving(true);
    setSaveError(null);

    const saves = [];
    if (include.COMPOSITION) saves.push(fetch("/api/components", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: compName.trim(), type: "COMPOSITION", clientId,
        data: { description }, aiPromptText: compPrompt, previewUrl: imageUrl }),
    }));
    if (include.COLOR_SCHEME) saves.push(fetch("/api/components", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: colorName.trim(), type: "COLOR_SCHEME", clientId,
        data: { primaryColor, secondaryColor }, aiPromptText: colorPrompt, previewUrl: imageUrl }),
    }));
    if (include.COPY_TONE) saves.push(fetch("/api/components", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: toneName.trim(), type: "COPY_TONE", clientId,
        data: { toneLabels }, aiPromptText: tonePrompt, previewUrl: imageUrl }),
    }));

    const results = await Promise.all(saves);
    setSaving(false);
    if (results.some((r) => !r.ok)) { setSaveError("部分素材儲存失敗，請重試"); return; }
    onSaved();
    onClose();
  }

  const compMeta = CATEGORY_META["COMPOSITION"];
  const colorMeta = CATEGORY_META["COLOR_SCHEME"];
  const toneMeta = CATEGORY_META["COPY_TONE"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">快速加入素材</h2>
            <p className="text-xs text-gray-400 mt-0.5">三種風格素材可同時新增</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">參考圖片（選填）</label>
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
                    : <><Sparkles className="h-3.5 w-3.5" />AI 讀取圖片，填入全部欄位</>}
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

          {/* ── COMPOSITION section ── */}
          <SectionWrapper
            meta={compMeta}
            label="構圖"
            checked={include.COMPOSITION}
            onToggle={() => setInclude(p => ({ ...p, COMPOSITION: !p.COMPOSITION }))}
          >
            <Field label="素材名稱 *">
              <input value={compName} onChange={e => setCompName(e.target.value)}
                placeholder="例：留白極簡構圖"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
            <Field label="構圖描述">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="例：主體置中，大量留白，視覺乾淨" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
            <Field label="AI Prompt（英文，供生成圖片用）">
              <textarea value={compPrompt} onChange={e => setCompPrompt(e.target.value)}
                placeholder="例：centered product, minimal white space, clean" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
          </SectionWrapper>

          {/* ── COLOR_SCHEME section ── */}
          <SectionWrapper
            meta={colorMeta}
            label="配色"
            checked={include.COLOR_SCHEME}
            onToggle={() => setInclude(p => ({ ...p, COLOR_SCHEME: !p.COLOR_SCHEME }))}
          >
            <Field label="素材名稱 *">
              <input value={colorName} onChange={e => setColorName(e.target.value)}
                placeholder="例：暖橙系配色"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </Field>
            <Field label="色票">
              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="text-[11px] text-gray-500 mb-1 block">主色</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-[11px] text-gray-500 mb-1 block">輔色</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  </div>
                </div>
              </div>
            </Field>
            <Field label="AI Prompt（英文，供生成圖片用）">
              <textarea value={colorPrompt} onChange={e => setColorPrompt(e.target.value)}
                placeholder="例：warm orange tones, high contrast, vibrant palette" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </Field>
          </SectionWrapper>

          {/* ── COPY_TONE section ── */}
          <SectionWrapper
            meta={toneMeta}
            label="語氣"
            checked={include.COPY_TONE}
            onToggle={() => setInclude(p => ({ ...p, COPY_TONE: !p.COPY_TONE }))}
          >
            <Field label="素材名稱 *">
              <input value={toneName} onChange={e => setToneName(e.target.value)}
                placeholder="例：活潑親切語氣"
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
                <input value={toneInput} onChange={e => setToneInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && toneInput.trim()) { e.preventDefault(); setToneLabels([...toneLabels, toneInput.trim()]); setToneInput(""); }}}
                  placeholder="輸入標籤後按 Enter"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <button onClick={() => { if (toneInput.trim()) { setToneLabels([...toneLabels, toneInput.trim()]); setToneInput(""); }}}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <Field label="AI Prompt（供文案生成用）">
              <textarea value={tonePrompt} onChange={e => setTonePrompt(e.target.value)}
                placeholder="例：親切活潑、帶有幽默感、符合年輕族群" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
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
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</>
              : <>儲存已選素材（{checkedCount}）</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionWrapper({ meta, label, checked, onToggle, children }: {
  meta: { bg: string; border: string; color: string };
  label: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-opacity ${checked ? "" : "opacity-40"} ${meta.bg} ${meta.border}`}>
      <button onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 pt-3 pb-2 text-left">
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
