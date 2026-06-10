"use client";
/**
 * GenerateAssetModal — 背景生成
 * ──────────────────────────────
 * Right-side panel that generates 3–5 PURE BACKGROUND images from a text description
 * (for use as product-copy backdrops: NO text, NO people, NO products).
 * Generation uses draftOnly mode (file saved, no DB record) so unselected images
 * never appear in the gallery. Selected images are saved as 背景素材 (BACKGROUND component).
 */

import { useState } from "react";
import { X, Wand2, Loader2, Check, Save } from "lucide-react";

type GeneratedItem = {
  imageUrl: string; // just the URL — no DB id yet (draftOnly)
  selected: boolean;
};

type Props = {
  clientId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function GenerateAssetModal({ clientId, onClose, onSaved }: Props) {
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [saving, setSaving] = useState(false);

  function buildBackgroundPrompt(desc: string): string {
    const base = desc.trim();
    return `${base}, pure background scene only, absolutely no people no faces no text no logos no watermarks no products, seamless background texture or environment, studio quality, photorealistic`;
  }

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setError(null);
    setItems([]);
    try {
      const prompt = buildBackgroundPrompt(description);
      const results = await Promise.allSettled(
        Array.from({ length: count }, () =>
          fetch("/api/library/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId,
              subject: description.trim(),
              customPrompt: prompt,
              draftOnly: true,
            }),
          }).then((r) => r.json())
        )
      );
      const ok: GeneratedItem[] = results
        .filter((r): r is PromiseFulfilledResult<{ imageUrl: string }> => r.status === "fulfilled" && !!r.value?.imageUrl)
        .map((r) => ({ imageUrl: r.value.imageUrl, selected: true }));
      if (ok.length === 0) throw new Error("所有圖片生成失敗，請重試");
      setItems(ok);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成失敗");
    } finally {
      setGenerating(false);
    }
  }

  function toggle(url: string) {
    setItems((prev) => prev.map((it) => it.imageUrl === url ? { ...it, selected: !it.selected } : it));
  }

  async function handleSave() {
    const selected = items.filter((it) => it.selected);
    if (selected.length === 0) { setError("請至少選取一張圖片"); return; }
    setSaving(true);
    setError(null);
    try {
      // Always save selected images as 背景素材 (BACKGROUND component, image-only).
      await Promise.all(selected.map((it, i) =>
        fetch("/api/components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "BACKGROUND",
            clientId,
            name: `${description.trim().slice(0, 20)}${selected.length > 1 ? ` #${i + 1}` : ""}`,
            data: { imageUrl: it.imageUrl },
            aiPromptText: "",
            previewUrl: it.imageUrl,
          }),
        })
      ));
      onSaved();
    } catch {
      setError("儲存失敗，請重試");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = items.filter((it) => it.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-500" />背景生成
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">生成純背景圖（無文字／人物／產品），供產品文案作底圖</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Description input */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">背景描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={"例：清新白色棚拍背景、柔和漫射光\n例：米白漸層棚拍、淡淡投影\n例：夏日戶外自然場景、柔光"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
            />
          </div>

          {/* Count */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">生成數量</label>
            <div className="flex gap-1.5">
              {[3, 4, 5].map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${count === n ? "bg-violet-600 text-white border-violet-600" : "bg-white border-gray-200 text-gray-600 hover:border-violet-300"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!description.trim() || generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors">
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" />生成中…（每張約 10–40 秒）</>
              : <><Wand2 className="h-4 w-4" />生成 {count} 張</>}
          </button>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>
          )}

          {/* Results */}
          {items.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-2">
                點擊選取要保留的圖片（已選 {selectedCount}/{items.length}）
              </div>
              <div className="grid grid-cols-2 gap-3">
                {items.map((item) => (
                  <div key={item.imageUrl}
                    className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${item.selected ? "border-violet-500 shadow-md" : "border-gray-200 opacity-50"}`}
                    onClick={() => toggle(item.imageUrl)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt="generated" className="w-full aspect-square object-cover" />
                    <div className={`absolute inset-0 transition-colors ${item.selected ? "bg-transparent" : "bg-gray-100/30"}`} />
                    {item.selected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
            {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              取消
            </button>
            <button onClick={handleSave} disabled={saving || selectedCount === 0}
              className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</>
                : <><Save className="h-4 w-4" />保留 {selectedCount} 張 → 🌄 背景素材</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
