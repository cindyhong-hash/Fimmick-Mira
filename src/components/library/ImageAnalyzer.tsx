"use client";
/**
 * ImageAnalyzer (v2)
 * ──────────────────
 * • Upload an image → AI auto-analyzes composition / color scheme / tone
 * • Shows past analyzed images (grouped by previewUrl from DB)
 * • Click any past image → loads its saved components (no new AI call)
 * • Accepts initialImageUrl prop so ComponentGrid can deep-link to an image
 * • Each result card has individual "加入" or "重新加入" button
 */

import { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Loader2, Check, Plus, X, History } from "lucide-react";
import { CATEGORY_META } from "@/types/library";
import type { StyleComponent } from "@/types/library";

type AnalysisResult = {
  composition: { name: string; description: string; aiPromptText: string } | null;
  colorScheme: { name: string; primaryColor: string; secondaryColor: string; aiPromptText: string } | null;
  copyTone: { name: string; toneLabels: string[]; aiPromptText: string } | null;
};

type SavedState = { COMPOSITION: boolean; COLOR_SCHEME: boolean; COPY_TONE: boolean };

type PastImage = { url: string; types: string[]; names: string[] };

type Props = {
  clientId: string | null;
  initialImageUrl?: string | null;   // set by library page when navigating from a component card
  onSaved?: () => void;
};

export function ImageAnalyzer({ clientId, initialImageUrl, onSaved }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedState>({ COMPOSITION: false, COLOR_SCHEME: false, COPY_TONE: false });
  const [saving, setSaving] = useState<Partial<SavedState>>({});
  const [pastImages, setPastImages] = useState<PastImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load past analyzed images from DB (grouped by previewUrl)
  useEffect(() => {
    const url = clientId ? `/api/components?clientId=${clientId}` : "/api/components";
    fetch(url)
      .then(r => r.json())
      .then((comps: StyleComponent[]) => {
        const map: Record<string, PastImage> = {};
        comps.filter(c => c.previewUrl).forEach(c => {
          const u = c.previewUrl!;
          if (!map[u]) map[u] = { url: u, types: [], names: [] };
          if (!map[u].types.includes(c.type)) map[u].types.push(c.type);
          map[u].names.push(c.name);
        });
        setPastImages(Object.values(map).reverse());
      });
  }, [clientId]);

  // If parent navigates us to a specific image, load it
  useEffect(() => {
    if (initialImageUrl && initialImageUrl !== imageUrl) {
      loadFromDb(initialImageUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageUrl]);

  async function handleUpload(file: File) {
    setUploading(true);
    setResult(null);
    setSaved({ COMPOSITION: false, COLOR_SCHEME: false, COPY_TONE: false });
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { url } = await res.json();
    setImageUrl(url);
    setUploading(false);
    await analyze(url);
  }

  async function analyze(url: string) {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/components/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "分析失敗");
      setResult(data);
      setSaved({ COMPOSITION: false, COLOR_SCHEME: false, COPY_TONE: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "分析失敗，請重試");
    } finally {
      setAnalyzing(false);
    }
  }

  // Load existing components from DB for a past image (no AI call)
  async function loadFromDb(url: string) {
    setImageUrl(url);
    setResult(null);
    setError(null);
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/components?previewUrl=${encodeURIComponent(url)}`);
      const comps: StyleComponent[] = await res.json();

      const comp = comps.find(c => c.type === "COMPOSITION");
      const color = comps.find(c => c.type === "COLOR_SCHEME");
      const tone = comps.find(c => c.type === "COPY_TONE");

      setResult({
        composition: comp
          ? { name: comp.name, description: (comp.data.description as string) ?? "", aiPromptText: comp.aiPromptText }
          : null,
        colorScheme: color
          ? { name: color.name, primaryColor: (color.data.primaryColor as string) ?? "#000000",
              secondaryColor: (color.data.secondaryColor as string) ?? "#ffffff", aiPromptText: color.aiPromptText }
          : null,
        copyTone: tone
          ? { name: tone.name, toneLabels: (tone.data.toneLabels as string[]) ?? [], aiPromptText: tone.aiPromptText }
          : null,
      });
      // Mark all as already saved (loaded from DB)
      setSaved({
        COMPOSITION: !!comp,
        COLOR_SCHEME: !!color,
        COPY_TONE: !!tone,
      });
    } catch {
      setError("載入失敗，請重試");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveComponent(type: keyof SavedState) {
    if (!result) return;
    setSaving(p => ({ ...p, [type]: true }));

    let name = "", data: Record<string, unknown> = {}, aiPromptText = "";
    if (type === "COMPOSITION" && result.composition) {
      name = result.composition.name;
      data = { description: result.composition.description };
      aiPromptText = result.composition.aiPromptText;
    } else if (type === "COLOR_SCHEME" && result.colorScheme) {
      name = result.colorScheme.name;
      data = { primaryColor: result.colorScheme.primaryColor, secondaryColor: result.colorScheme.secondaryColor };
      aiPromptText = result.colorScheme.aiPromptText;
    } else if (type === "COPY_TONE" && result.copyTone) {
      name = result.copyTone.name;
      data = { toneLabels: result.copyTone.toneLabels };
      aiPromptText = result.copyTone.aiPromptText;
    }

    await fetch("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, clientId, data, aiPromptText, previewUrl: imageUrl }),
    });

    setSaving(p => ({ ...p, [type]: false }));
    setSaved(p => ({ ...p, [type]: true }));
    // Refresh past images list
    const url = clientId ? `/api/components?clientId=${clientId}` : "/api/components";
    fetch(url).then(r => r.json()).then((comps: StyleComponent[]) => {
      const map: Record<string, PastImage> = {};
      comps.filter(c => c.previewUrl).forEach(c => {
        const u = c.previewUrl!;
        if (!map[u]) map[u] = { url: u, types: [], names: [] };
        if (!map[u].types.includes(c.type)) map[u].types.push(c.type);
        map[u].names.push(c.name);
      });
      setPastImages(Object.values(map).reverse());
    });
    onSaved?.();
  }

  async function saveAll() {
    if (!result) return;
    const types: (keyof SavedState)[] = [];
    if (result.composition && !saved.COMPOSITION) types.push("COMPOSITION");
    if (result.colorScheme && !saved.COLOR_SCHEME) types.push("COLOR_SCHEME");
    if (result.copyTone && !saved.COPY_TONE) types.push("COPY_TONE");
    await Promise.all(types.map(saveComponent));
  }

  const compMeta = CATEGORY_META["COMPOSITION"];
  const colorMeta = CATEGORY_META["COLOR_SCHEME"];
  const toneMeta = CATEGORY_META["COPY_TONE"];
  const allSaved = result && saved.COMPOSITION && saved.COLOR_SCHEME && saved.COPY_TONE;
  const anySaved = saved.COMPOSITION || saved.COLOR_SCHEME || saved.COPY_TONE;

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />

      {/* ── Past analyzed images ── */}
      {pastImages.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
            <History className="h-3.5 w-3.5" />
            過往分析紀錄
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pastImages.map((p) => (
              <button
                key={p.url}
                onClick={() => loadFromDb(p.url)}
                className={`shrink-0 relative group rounded-xl overflow-hidden border-2 transition-all
                  ${imageUrl === p.url ? "border-violet-500 shadow-md" : "border-gray-200 hover:border-violet-300"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="past" className="w-16 h-16 object-cover" />
                {/* Type dots */}
                <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                  {["COMPOSITION","COLOR_SCHEME","COPY_TONE"].map(t => (
                    <span key={t} className={`w-1.5 h-1.5 rounded-full ${p.types.includes(t) ? "bg-white shadow" : "bg-white/30"}`} />
                  ))}
                </div>
                {imageUrl === p.url && (
                  <div className="absolute inset-0 bg-violet-500/20" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">點擊查看已儲存的分析，三個白點代表已儲存三種風格</p>
        </div>
      )}

      {/* ── Upload / current image ── */}
      {!imageUrl ? (
        <button onClick={() => fileRef.current?.click()}
          className="w-full h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-sm font-medium">{uploading ? "上傳中…" : "上傳圖片，AI 自動分析風格"}</span>
          <span className="text-xs">自動分析構圖・配色・語氣</span>
        </button>
      ) : (
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="uploaded" className="w-36 h-36 object-cover rounded-xl border shrink-0" />
          <div className="flex-1 flex flex-col justify-between py-1">
            <div>
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {result ? "AI 重新分析中…" : "AI 分析中…"}
                </div>
              )}
              {result && !analyzing && (
                <div className="text-sm font-medium text-gray-700">
                  {anySaved ? "✓ 已從紀錄載入" : "分析完成 ✓"}
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setImageUrl(null); setResult(null); setSaved({ COMPOSITION: false, COLOR_SCHEME: false, COPY_TONE: false }); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <X className="h-3 w-3 inline mr-1" />清除
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                換圖片
              </button>
              {imageUrl && (
                <button onClick={() => analyze(imageUrl)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors">
                  <Sparkles className="h-3 w-3" />重新 AI 分析
                </button>
              )}
              {result && !allSaved && (
                <button onClick={saveAll}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                  <Plus className="h-3 w-3" />
                  {anySaved ? "加入剩餘素材" : "全部加入素材庫"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Analysis result cards ── */}
      {result && !analyzing && (
        <div className="grid grid-cols-1 gap-3">

          {result.composition && (
            <ResultCard meta={compMeta} label="構圖" name={result.composition.name}
              saved={saved.COMPOSITION} saving={!!saving.COMPOSITION} onSave={() => saveComponent("COMPOSITION")}>
              <p className="text-xs text-gray-600">{result.composition.description}</p>
              {result.composition.aiPromptText && (
                <p className="text-[11px] font-mono text-gray-400 mt-1 line-clamp-1">{result.composition.aiPromptText}</p>
              )}
            </ResultCard>
          )}

          {result.colorScheme && (
            <ResultCard meta={colorMeta} label="配色" name={result.colorScheme.name}
              saved={saved.COLOR_SCHEME} saving={!!saving.COLOR_SCHEME} onSave={() => saveComponent("COLOR_SCHEME")}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: result.colorScheme.primaryColor }} />
                <span className="w-6 h-6 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: result.colorScheme.secondaryColor }} />
                <span className="text-xs text-gray-500 font-mono">{result.colorScheme.primaryColor}</span>
                <span className="text-xs text-gray-400 font-mono">{result.colorScheme.secondaryColor}</span>
              </div>
              {result.colorScheme.aiPromptText && (
                <p className="text-[11px] font-mono text-gray-400 mt-1 line-clamp-1">{result.colorScheme.aiPromptText}</p>
              )}
            </ResultCard>
          )}

          {result.copyTone && (
            <ResultCard meta={toneMeta} label="語氣" name={result.copyTone.name}
              saved={saved.COPY_TONE} saving={!!saving.COPY_TONE} onSave={() => saveComponent("COPY_TONE")}>
              <div className="flex flex-wrap gap-1">
                {result.copyTone.toneLabels.map((t, i) => (
                  <span key={i} className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{t}</span>
                ))}
              </div>
              {result.copyTone.aiPromptText && (
                <p className="text-[11px] font-mono text-gray-400 mt-1 line-clamp-1">{result.copyTone.aiPromptText}</p>
              )}
            </ResultCard>
          )}

        </div>
      )}
    </div>
  );
}

function ResultCard({ meta, label, name, saved, saving, onSave, children }: {
  meta: { bg: string; border: string; color: string };
  label: string; name: string;
  saved: boolean; saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${meta.bg} ${meta.border}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}>{label}</span>
          <span className="text-xs font-semibold text-gray-800 truncate">{name}</span>
        </div>
        {children}
      </div>
      <button onClick={onSave} disabled={saved || saving}
        className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors self-start
          ${saved
            ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default"
            : `${meta.bg} ${meta.border} ${meta.color} hover:opacity-80`}`}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : saved ? <><Check className="h-3.5 w-3.5" />已加入</>
          : <><Plus className="h-3.5 w-3.5" />加入</>}
      </button>
    </div>
  );
}
