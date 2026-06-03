"use client";
/**
 * QuickAddModal
 * ─────────────
 * Slide-in panel for manually adding a StyleComponent to the library.
 * User can:
 *   1. Upload an image
 *   2. Fill in 名稱, 類型 (構圖 / 配色 / 語氣), and type-specific fields manually
 *   3. Click "AI 讀取圖片" to auto-fill all fields using Claude vision
 *   4. Save → POST /api/components
 */

import { useState, useRef } from "react";
import { X, Upload, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import type { ComponentCategory } from "@/types/library";
import { CATEGORY_META } from "@/types/library";

type Props = {
  clientId: string | null;
  onClose: () => void;
  onSaved: () => void; // triggers a re-fetch in ComponentGrid
};

const TYPES: ComponentCategory[] = ["COMPOSITION", "COLOR_SCHEME", "COPY_TONE"];

export function QuickAddModal({ clientId, onClose, onSaved }: Props) {
  // ── Image ────────────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [type, setType] = useState<ComponentCategory>("COMPOSITION");
  const [name, setName] = useState("");
  // COMPOSITION
  const [description, setDescription] = useState("");
  const [compPrompt, setCompPrompt] = useState("");
  // COLOR_SCHEME
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");
  const [colorPrompt, setColorPrompt] = useState("");
  // COPY_TONE
  const [toneLabels, setToneLabels] = useState<string[]>([]);
  const [toneInput, setToneInput] = useState("");
  const [tonePrompt, setTonePrompt] = useState("");

  // ── AI ───────────────────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

      // Fill all fields
      const { composition, colorScheme, copyTone } = data;

      // Composition
      if (composition) {
        if (!name) setName(composition.name ?? "");
        setDescription(composition.description ?? "");
        setCompPrompt(composition.aiPromptText ?? "");
      }
      // Color
      if (colorScheme) {
        if (!name) setName(colorScheme.name ?? "");
        setPrimaryColor(colorScheme.primaryColor ?? "#000000");
        setSecondaryColor(colorScheme.secondaryColor ?? "#ffffff");
        setColorPrompt(colorScheme.aiPromptText ?? "");
      }
      // Tone
      if (copyTone) {
        if (!name) setName(copyTone.name ?? "");
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
    if (!name.trim()) { setSaveError("請填寫素材名稱"); return; }
    setSaving(true);
    setSaveError(null);

    let data: Record<string, unknown> = {};
    let aiPromptText = "";

    if (type === "COMPOSITION") {
      data = { description };
      aiPromptText = compPrompt;
    } else if (type === "COLOR_SCHEME") {
      data = { primaryColor, secondaryColor };
      aiPromptText = colorPrompt;
    } else {
      data = { toneLabels };
      aiPromptText = tonePrompt;
    }

    const res = await fetch("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        clientId,
        data,
        aiPromptText,
        previewUrl: imageUrl,
      }),
    });

    setSaving(false);
    if (!res.ok) { setSaveError("儲存失敗，請重試"); return; }
    onSaved();
    onClose();
  }

  const meta = CATEGORY_META[type];

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">快速加入素材</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Image upload ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">參考圖片（選填）</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
            />
            {imageUrl ? (
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="preview" className="w-full h-48 object-cover rounded-xl border" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
                {/* AI analyze button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg shadow transition-colors disabled:opacity-60"
                >
                  {analyzing
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />AI 分析中…</>
                    : <><Sparkles className="h-3.5 w-3.5" />AI 讀取圖片</>
                  }
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Upload className="h-5 w-5" />
                }
                <span className="text-xs">{uploading ? "上傳中…" : "點擊上傳圖片"}</span>
              </button>
            )}
            {aiError && <p className="text-xs text-red-500 mt-1.5">{aiError}</p>}
          </div>

          {/* ── Type selector ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">素材類型 *</label>
            <div className="flex gap-2">
              {TYPES.map((t) => {
                const m = CATEGORY_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      type === t
                        ? `${m.bg} ${m.border} ${m.color}`
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Name ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">素材名稱 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`例：${type === "COMPOSITION" ? "留白極簡構圖" : type === "COLOR_SCHEME" ? "暖橙系配色" : "活潑親切語氣"}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* ── Type-specific fields ── */}
          {type === "COMPOSITION" && (
            <div className={`space-y-3 p-4 rounded-xl ${meta.bg} border ${meta.border}`}>
              <p className={`text-xs font-semibold ${meta.color}`}>構圖設定</p>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">構圖描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例：主體置中，大量留白，視覺乾淨"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">AI Prompt（供生成圖片使用）</label>
                <textarea
                  value={compPrompt}
                  onChange={(e) => setCompPrompt(e.target.value)}
                  placeholder="例：centered product, minimal white space, clean composition"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          )}

          {type === "COLOR_SCHEME" && (
            <div className={`space-y-3 p-4 rounded-xl ${meta.bg} border ${meta.border}`}>
              <p className={`text-xs font-semibold ${meta.color}`}>配色設定</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block">主色</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block">輔色</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">AI Prompt（供生成圖片使用）</label>
                <textarea
                  value={colorPrompt}
                  onChange={(e) => setColorPrompt(e.target.value)}
                  placeholder="例：warm orange tones, high contrast, vibrant palette"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>
          )}

          {type === "COPY_TONE" && (
            <div className={`space-y-3 p-4 rounded-xl ${meta.bg} border ${meta.border}`}>
              <p className={`text-xs font-semibold ${meta.color}`}>語氣設定</p>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">語氣標籤</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {toneLabels.map((label, i) => (
                    <span key={i}
                      className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full border border-amber-200">
                      {label}
                      <button onClick={() => setToneLabels(toneLabels.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={toneInput}
                    onChange={(e) => setToneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && toneInput.trim()) {
                        e.preventDefault();
                        setToneLabels([...toneLabels, toneInput.trim()]);
                        setToneInput("");
                      }
                    }}
                    placeholder="輸入標籤後按 Enter"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => { if (toneInput.trim()) { setToneLabels([...toneLabels, toneInput.trim()]); setToneInput(""); }}}
                    className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">AI Prompt（供文案生成使用）</label>
                <textarea
                  value={tonePrompt}
                  onChange={(e) => setTonePrompt(e.target.value)}
                  placeholder="例：親切活潑、帶有幽默感、符合年輕族群"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
          {saveError && <p className="text-xs text-red-500 flex-1">{saveError}</p>}
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : "儲存素材"}
          </button>
        </div>
      </div>
    </div>
  );
}
