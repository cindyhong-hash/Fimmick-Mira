"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, CheckCircle2, X, ChevronLeft, Pencil,
  Maximize2, SplitSquareHorizontal, RotateCcw, RotateCw,
  ChevronDown, ChevronUp, UploadCloud, FileText, LayoutGrid, Download, Type, Wand2,
  RefreshCw, ImageIcon, ArrowUp, ArrowDown, GripVertical,
} from "lucide-react";
import { MaskCanvas, type SelectionBounds } from "@/components/activities/MaskCanvas";
import LogoPlacerModal, { type LogoVersion } from "@/components/activities/LogoPlacerModal";
import { UnsavedChangesModal } from "@/components/activities/UnsavedChangesModal";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { collectTextEdits } from "@/lib/image-text-edit";
import { buildDownloadFilename } from "@/lib/download-filename";
import { downloadImage, downloadImages } from "@/lib/download-image";
import { moveItem, parseMultiLayoutMeta, type CompositeLogo } from "@/lib/multi-editor";
import { ImageLibraryPicker } from "@/components/magic-layers/ImageLibraryPicker";

type Props = {
  clientId?: string;               // 換圖時讀品牌素材庫
  activityId?: string;             // 重新生成這一格用
  layoutMetaJson?: string;         // GeneratedLayout.textLayerJson：拼版底色、總覽上的 LOGO（見 src/lib/multi-editor.ts）
  layoutRecordId: string;          // GeneratedLayout id
  layoutType: string;              // 多圖版型 id（two-lr / four-grid…）
  initialComposite: string;        // 拼版大圖 URL
  initialCells: string[];          // 各格圖 URL
  initialCopy: string;             // 文案
  ratio: string;                   // 圖片比例
  brandLogoUrl?: string;
  logoMode?: string;
  logoVersions?: LogoVersion[];    // 多版本品牌 logo（放置標誌可選）
  /** 活動主題 — 顯示喺頂欄標題（同單圖版 EditorCanvas.tsx 一致）。 */
  theme?: string;
  /** 頂欄「返回」連結。 */
  backHref?: string;
};

// view：要在中央大圖顯示的對象 — "composite"（整體拼版，唯讀）或某一格 index（可編輯）
type View = "composite" | number;

const COPY_TRANSFORMS = [
  { label: "再簡短一點", instruction: "請把這段文案縮短一半，保留核心意思" },
  { label: "更有衝勁",   instruction: "請讓這段文案更有能量、更有購買衝動感" },
  { label: "更正式",     instruction: "請讓這段文案更專業正式" },
  { label: "換個花樣",   instruction: "請用不同的角度重寫這段文案，保留核心訊息" },
];

export function MultiEditorCanvas({
  clientId, activityId, layoutMetaJson,
  layoutRecordId, layoutType, initialComposite, initialCells, initialCopy, brandLogoUrl, logoVersions = [], theme, backHref,
}: Props) {
  // 生成當下的拼版樣式＋放在總覽上的 LOGO：重新拼版要照著拼、拼完重貼
  const [initialMeta] = useState(() => parseMultiLayoutMeta(layoutMetaJson));
  const collage = initialMeta.collage;
  const [compositeLogos, setCompositeLogos] = useState<CompositeLogo[]>(initialMeta.compositeLogos ?? []);
  // 單格大圖嘅框闊度——換格／上一步重做會令 MaskCanvas remount，新圖未載完之前個框
  // 會塌窄再彈返（閃跳），保住上次闊度喺載入期間頂住個位（見 MaskCanvas reservedWidth）。
  const [cellWidth, setCellWidth] = useState<number | undefined>(undefined);

  const [showLogo, setShowLogo] = useState(false);
  const [cells, setCells] = useState<string[]>(initialCells);
  const [composite, setComposite] = useState<string>(initialComposite);
  const [view, setView] = useState<View>(0);   // 一進來顯示第 1 格（單張）
  const [copyText, setCopyText] = useState<string>(initialCopy);
  const [transforming, setTransforming] = useState(false);

  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds | null>(null);
  const [prompt, setPrompt] = useState("");
  const [refImageDataUrl, setRefImageDataUrl] = useState<string | null>(null);
  const [refImageName, setRefImageName] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const [inpainting, setInpainting] = useState(false);
  const [recompositing, setRecompositing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 右側面板分頁：修改圖片／放置LOGO；文案微調 collapsible（預設展開）；左側
  // 圖片工具列：縮放（0.5~2）＋對比（按住顯示上一步版本）——同單圖版 EditorCanvas.tsx 一致。
  const [tab, setTab] = useState<"edit" | "logo">("edit");
  // 修改圖片分成兩種：改圖上的字（AI 先讀出文字清單，直接在清單上改）／其他修改（框選＋描述）
  // 修改這一格的方式：改圖上的字／其他修改（框選＋描述）／整格重新生成／換成素材庫或上傳的圖
  const [editMode, setEditMode] = useState<"text" | "free" | "regen" | "replace">("text");
  const [regenWish, setRegenWish] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  // 換圖用的品牌素材庫：第一次打開「換圖」才去讀
  const [library, setLibrary] = useState<{ url: string; label?: string }[] | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  // 每張圖讀出來的文字，key 是圖片網址：換格、復原再回來都不用重讀（讀一次要花一次 AI）
  const [textBlocks, setTextBlocks] = useState<Record<string, string[] | "error">>({});
  // 使用者在清單上改到一半的內容，key 同樣是圖片網址
  const [textDrafts, setTextDrafts] = useState<Record<string, string[]>>({});
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copyOpen, setCopyOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [compare, setCompare] = useState(false);

  // 回上一步：每次 AI 修改 / 文案轉換前，先把當前狀態存進歷史堆疊
  type Snapshot = { cells: string[]; composite: string; copyText: string; compositeLogos: CompositeLogo[] };
  const [history, setHistory] = useState<Snapshot[]>([]);
  // 重做棧：回上一步彈出嗰版會推入呢度；新改動（pushHistory 一 call）會清空（標準 redo 慣例）。
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  // isModified：同單圖版 EditorCanvas.tsx 一致嘅概念——用嚟決定頂欄「已儲存」pill
  // 同「儲存草稿」按鈕嘅顯示/可用狀態。有歷史（即改過嘢）先算 modified。
  const isModified = history.length > 0;
  // 有未儲存改動就攔截「離開呢頁」（返上一頁箭嘴／側欄品牌名都算），彈確認框先過。
  const { pendingHref, confirmLeave, cancelLeave } = useUnsavedChangesGuard(isModified && !saved);

  const pushHistory = () => {
    setHistory((h) => [...h, { cells, composite, copyText, compositeLogos }].slice(-30));
    setRedoStack([]);
  };
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [{ cells, composite, copyText, compositeLogos }, ...r].slice(0, 30));
    setCells(prev.cells);
    setComposite(prev.composite);
    setCopyText(prev.copyText);
    setCompositeLogos(prev.compositeLogos);
    setHistory((h) => h.slice(0, -1));
    setMaskDataUrl(null);
    setSelectionBounds(null);
    setSaved(false);
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((h) => [...h, { cells, composite, copyText, compositeLogos }].slice(-30));
    setCells(next.cells);
    setComposite(next.composite);
    setCopyText(next.copyText);
    setCompositeLogos(next.compositeLogos);
    setRedoStack((r) => r.slice(1));
    setMaskDataUrl(null);
    setSelectionBounds(null);
    setSaved(false);
  };

  const isCell = typeof view === "number";
  const activeCell = isCell ? (view as number) : -1;
  const busy = inpainting || recompositing || regenerating;
  const peekPreviousImage = history.length === 0 ? null
    : isCell ? history[history.length - 1].cells[activeCell]
    : history[history.length - 1].composite;

  const selectView = (v: View) => {
    setView(v);
    setMaskDataUrl(null);
    setSelectionBounds(null);
  };

  // 進到「改文字」時自動讀這一格的字；讀過的圖不重讀
  const activeUrl = isCell ? cells[activeCell] : null;
  const blocksForActive = activeUrl ? textBlocks[activeUrl] : undefined;
  const needsRead = tab === "edit" && editMode === "text" && !!activeUrl && blocksForActive === undefined;
  useEffect(() => {
    if (!needsRead || !activeUrl) return;
    let cancelled = false;
    fetch("/api/ai/read-image-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: activeUrl }) })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); return data.blocks as string[]; })
      .then((blocks) => { if (!cancelled) setTextBlocks((m) => ({ ...m, [activeUrl]: blocks })); })
      .catch(() => { if (!cancelled) setTextBlocks((m) => ({ ...m, [activeUrl]: "error" })); });
    return () => { cancelled = true; };
  }, [needsRead, activeUrl]);
  const retryReadText = () => {
    if (!activeUrl) return;
    setTextBlocks((m) => { const next = { ...m }; delete next[activeUrl]; return next; });
    setTextDrafts((m) => { const next = { ...m }; delete next[activeUrl]; return next; });
  };
  const originalBlocks = Array.isArray(blocksForActive) ? blocksForActive : [];
  const draftBlocks = (activeUrl && textDrafts[activeUrl]) || originalBlocks;
  const pendingEdits = collectTextEdits(originalBlocks, draftBlocks);
  const setDraftAt = (i: number, value: string) => {
    if (!activeUrl) return;
    const next = draftBlocks.slice(); next[i] = value;
    setTextDrafts((m) => ({ ...m, [activeUrl]: next }));
  };

  const applyTextEdits = async () => {
    if (!isCell || !activeUrl || !pendingEdits.length) return;
    setInpainting(true);
    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: activeUrl, textEdits: pendingEdits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "修改失敗");
      pushHistory();
      const nextCells = cells.map((c, i) => (i === activeCell ? data.imageUrl : c));
      setCells(nextCells);
      // 新圖上的字就是剛改好的清單（清空的那段拿掉），不用再花一次 AI 重讀
      setTextBlocks((m) => ({ ...m, [data.imageUrl]: draftBlocks.map((t) => t.trim()).filter(Boolean) }));
      setTextDrafts((m) => { const next = { ...m }; delete next[activeUrl]; return next; });
      setSaved(false);
      await recomposite(nextCells);
    } catch (err) {
      alert(err instanceof Error ? err.message : "修改失敗，請稍後再試");
    } finally {
      setInpainting(false);
    }
  };

  // 換一格的圖（重新生成、換圖都走這裡）：記復原、更新格子、重新拼版
  const replaceActiveCell = async (url: string, knownTexts?: string[]) => {
    pushHistory();
    const nextCells = cells.map((c, i) => (i === activeCell ? url : c));
    setCells(nextCells);
    if (knownTexts) setTextBlocks((m) => ({ ...m, [url]: knownTexts }));
    setSaved(false);
    await recomposite(nextCells);
  };

  const regenerateCell = async () => {
    if (!isCell || !activeUrl || !activityId) return;
    setRegenerating(true);
    try {
      // 改文字模式讀過字就一起送，新圖的字才會一字不差
      const texts = Array.isArray(blocksForActive) ? blocksForActive : undefined;
      const res = await fetch("/api/multi/regenerate-cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, layoutType, cellIndex: activeCell, cellUrl: activeUrl, instruction: regenWish, texts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "重新生成失敗");
      setRegenWish("");
      await replaceActiveCell(data.imageUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "重新生成失敗，請稍後再試");
    } finally {
      setRegenerating(false);
    }
  };

  const needsLibrary = tab === "edit" && editMode === "replace" && library === null && !!clientId;
  useEffect(() => {
    if (!needsLibrary || !clientId) return;
    let cancelled = false;
    fetch(`/api/library/gallery?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((items: { imageUrl?: string; kind?: string; status?: string; name?: string; subject?: string }[]) => {
        if (cancelled) return;
        setLibrary((Array.isArray(items) ? items : [])
          .filter((it) => it?.imageUrl && (it.kind !== "generated" || it.status === "DONE"))
          .map((it) => ({ url: it.imageUrl as string, label: it.name || it.subject || "" }))
          .slice(0, 80));
      })
      .catch(() => { if (!cancelled) setLibrary([]); });
    return () => { cancelled = true; };
  }, [needsLibrary, clientId]);
  const uploadFile = async (f: File): Promise<string> => {
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error ?? "上傳失敗");
    return d.url as string;
  };

  // 換格子順序：拖曳左側縮圖，或用 ↑↓。選著的那格跟著移動。
  const reorderCells = (from: number, to: number) => {
    if (busy || from === to || to < 0 || to >= cells.length) return;
    pushHistory();
    const nextCells = moveItem(cells, from, to);
    setCells(nextCells);
    if (isCell) setView(moveItem(cells.map((_, i) => i), from, to).indexOf(activeCell));
    setMaskDataUrl(null);
    setSelectionBounds(null);
    setSaved(false);
    void recomposite(nextCells);
  };

  // 下載：拼版圖、全部格子、或只有這一格。下載的是畫面上目前的版本（不用先儲存）。
  const fileFor = (url: string, label: string) => buildDownloadFilename({ url, label, readableText: theme });
  const runDownload = async (job: () => Promise<void>) => {
    setDownloadOpen(false);
    setDownloading(true);
    try { await job(); } finally { setDownloading(false); }
  };
  const downloadComposite = () => runDownload(() => downloadImage(composite, fileFor(composite, "多圖拼版")));
  const downloadAllCells = () => runDownload(() => downloadImages(cells.map((u, i) => ({ url: u, filename: fileFor(u, `多圖${String(i + 1).padStart(2, "0")}`) }))));
  const downloadActiveCell = () => activeUrl && runDownload(() => downloadImage(activeUrl, fileFor(activeUrl, `多圖${String(activeCell + 1).padStart(2, "0")}`)));

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setRefImageDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const clearRef = () => { setRefImageDataUrl(null); setRefImageName(null); };

  // 照生成當下的樣子重新拼一張，再把放在總覽上的 LOGO 依原位置重貼（不然改一格 LOGO 就不見了）
  const recomposite = async (nextCells: string[], logos: CompositeLogo[] = compositeLogos) => {
    setRecompositing(true);
    try {
      const res = await fetch("/api/composite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellUrls: nextCells, layoutId: layoutType, matchGenerated: true, collage, logoMode: "none" }),
      });
      const data = await res.json();
      if (!data.imageUrl) return;
      let url: string = data.imageUrl;
      for (const l of logos) {
        const r = await fetch("/api/logo/place", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageUrl: url, logoUrl: l.logoUrl, x: l.x, y: l.y, scale: l.scale, shadow: l.shadow }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) url = d.url;
      }
      setComposite(url);
    } finally {
      setRecompositing(false);
    }
  };

  const editActiveCell = async () => {
    if (!isCell) return;
    if (!prompt.trim() && !selectionBounds && !refImageDataUrl) return;
    setInpainting(true);
    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: cells[activeCell],
          maskDataUrl,
          selectionBounds,
          prompt,
          referenceImageDataUrl: refImageDataUrl ?? undefined,
          brandLogoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "修改失敗");
      pushHistory();  // 存修改前狀態，供「回上一步」
      const nextCells = cells.map((c, i) => (i === activeCell ? data.imageUrl : c));
      setCells(nextCells);
      setMaskDataUrl(null);
      setSelectionBounds(null);
      setPrompt("");
      clearRef();
      setSaved(false);
      await recomposite(nextCells);
    } catch (err) {
      alert(err instanceof Error ? err.message : "修改失敗，請查看 console");
    } finally {
      setInpainting(false);
    }
  };

  const transformCopy = async (instruction: string) => {
    if (!copyText.trim()) return;
    setTransforming(true);
    try {
      const res = await fetch("/api/transform-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyText, instruction }),
      });
      const data = await res.json();
      if (data.result) { pushHistory(); setCopyText(data.result); setSaved(false); }
    } finally {
      setTransforming(false);
    }
  };

  const handleSave = async () => {
    if (!isModified) return;
    setSaving(true);
    try {
      await fetch(`/api/layouts/${layoutRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: composite, cellImageUrls: JSON.stringify(cells), copyText, compositeLogos }),
      });
      setSaved(true);
      // 同單圖版一致：儲存後把歷史清空（下次回來仍顯示最新結果）
      setHistory([]);
      setRedoStack([]);
    } catch {
      alert("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const zoomIn  = () => setZoom((z) => Math.min(2,   +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
  const fitZoom = () => setZoom(1);

  const availableLogos: LogoVersion[] =
    logoVersions.length ? logoVersions : (brandLogoUrl ? [{ url: brandLogoUrl, label: "品牌 Logo" }] : []);

  return (
    <div>
      {/* ── 頂欄（同單圖版 EditorCanvas.tsx 一致）── */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref ?? "#"}
            className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            返回
          </Link>
          <div className="flex items-center gap-1.5">
            <h1 className="font-semibold text-gray-900">{theme}</h1>
            <Pencil className="h-3.5 w-3.5 text-gray-300" />
          </div>
          {(!isModified || saved) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1">
              <CheckCircle2 className="h-3 w-3" />
              已儲存
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setDownloadOpen((o) => !o)}
            disabled={downloading || busy}
            aria-haspopup="menu"
            aria-expanded={downloadOpen}
            className="gap-1.5"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{downloading ? "下載中…" : "下載"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </Button>
          {downloadOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDownloadOpen(false)} />
              <div role="menu" className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-xl border bg-white p-1.5 shadow-lg">
                <button role="menuitem" onClick={downloadComposite} className="w-full text-left rounded-lg px-3 py-2 hover:bg-violet-50">
                  <div className="text-sm text-gray-800">拼版圖</div>
                  <div className="text-[11px] text-gray-400">整組拼成一張</div>
                </button>
                <button role="menuitem" onClick={downloadAllCells} className="w-full text-left rounded-lg px-3 py-2 hover:bg-violet-50">
                  <div className="text-sm text-gray-800">每一格分開（{cells.length} 張）</div>
                  <div className="text-[11px] text-gray-400">一格一張，適合做輪播貼文</div>
                </button>
                {isCell && (
                  <button role="menuitem" onClick={downloadActiveCell} className="w-full text-left rounded-lg px-3 py-2 hover:bg-violet-50">
                    <div className="text-sm text-gray-800">只有圖 {activeCell + 1}</div>
                  </button>
                )}
                <p className="px-3 pt-1.5 pb-1 text-[11px] text-gray-400 border-t mt-1">下載的是畫面上目前的版本，還沒儲存也可以。</p>
              </div>
            </>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isModified || saving}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{saving ? "儲存中…" : "儲存草稿"}</span>
        </Button>
        </div>
      </div>

      {/* ── 主體 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start p-6">

        {/* Left: 小圖列 + 中央大圖 */}
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            {/* 小圖列——比單圖版多出嚟嘅一段：拼版總覽＋逐格縮圖 */}
            <div className="flex flex-col gap-2 shrink-0 w-20 max-h-[75vh] overflow-y-auto pr-0.5">
              <button
                onClick={() => selectView("composite")}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  view === "composite" ? "border-violet-500 shadow" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <img src={composite} alt="拼版" className="w-full aspect-square object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-violet-600/80 text-white text-[9px] py-0.5 flex items-center justify-center gap-0.5">
                  <LayoutGrid className="h-2.5 w-2.5" />拼版
                </span>
              </button>
              {cells.map((url, i) => (
                <button
                  key={i}
                  onClick={() => selectView(i)}
                  draggable={!busy}
                  onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) reorderCells(dragFrom, i); setDragFrom(null); }}
                  onDragEnd={() => setDragFrom(null)}
                  title="點一下修改這格；拖曳可以換順序"
                  className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                    activeCell === i ? "border-violet-500 shadow" : "border-gray-200 hover:border-gray-400"
                  } ${dragFrom === i ? "opacity-40" : ""} ${dragFrom !== null && dragFrom !== i ? "ring-2 ring-violet-200" : ""}`}
                >
                  <GripVertical className="absolute top-1 left-0.5 h-3.5 w-3.5 text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img src={url} alt={`圖 ${i + 1}`} className="w-full aspect-square object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] py-0.5 text-center">
                    圖 {i + 1}
                  </span>
                </button>
              ))}
            </div>

            {/* 中央大圖——結構同單圖版 EditorCanvas.tsx 一致（縮放 wrapper + 對比疊層） */}
            <div className="flex-1 min-w-0 rounded-2xl border bg-gray-50/50 overflow-auto max-h-[75vh] flex justify-center p-4">
              {isCell ? (
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="relative inline-block">
                  <MaskCanvas
                    imageUrl={cells[activeCell]}
                    onMaskChange={setMaskDataUrl}
                    onSelectionChange={setSelectionBounds}
                    previousImageUrl={peekPreviousImage}
                    reservedWidth={cellWidth}
                    onWidthChange={setCellWidth}
                    overlay={(inpainting || regenerating) && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full border-4 border-white/20" />
                          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-white animate-spin" />
                          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-white/80" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-semibold text-sm">{regenerating ? "AI 正在重新生成這一格" : "AI 正在修改圖片"}</p>
                          <p className="text-white/60 text-xs mt-1">{regenerating ? "通常需要 20–40 秒" : "通常需要 15–30 秒"}</p>
                        </div>
                      </div>
                    )}
                  />
                  {recompositing && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-20 rounded-xl">
                      <Loader2 className="h-7 w-7 text-white animate-spin" />
                      <p className="text-white text-sm">重新拼版中…</p>
                    </div>
                  )}
                  {compare && peekPreviousImage && (
                    <img
                      src={peekPreviousImage}
                      alt="上一步版本"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-50 bg-white"
                    />
                  )}
                </div>
              ) : (
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="relative inline-block rounded-xl overflow-hidden border">
                  <img src={composite} alt="拼版總覽" draggable={false} className="max-w-[560px] w-full object-contain bg-gray-50 select-none" />
                  {compare && peekPreviousImage && (
                    <img
                      src={peekPreviousImage}
                      alt="上一步版本"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-50 bg-white"
                    />
                  )}
                  {busy && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-20">
                      <Loader2 className="h-7 w-7 text-white animate-spin" />
                      <p className="text-white text-sm">{inpainting ? "AI 修改中…" : "重新拼版中…"}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 底部工具列（同單圖版 EditorCanvas.tsx 一致） */}
          <div className="rounded-xl border bg-white px-3 py-2 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={zoomOut}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
              >
                −
              </button>
              <span className="text-xs text-gray-600 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={zoomIn}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
              >
                ＋
              </button>
            </div>
            <button
              onClick={fitZoom}
              className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              符合畫面
            </button>
            <button
              onPointerDown={() => peekPreviousImage && setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              disabled={!peekPreviousImage}
              className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
              對比
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={undo} disabled={history.length === 0}
                className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 border transition-all ${
                  history.length > 0 ? "text-gray-600 hover:text-violet-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
                  : "opacity-30 cursor-not-allowed text-gray-400 border-gray-200"}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                復原
              </button>
              <button
                onClick={redo} disabled={redoStack.length === 0}
                className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 border transition-all ${
                  redoStack.length > 0 ? "text-gray-600 hover:text-violet-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
                  : "opacity-30 cursor-not-allowed text-gray-400 border-gray-200"}`}
              >
                <RotateCw className="h-3.5 w-3.5" />
                重做
              </button>
            </div>
          </div>
        </div>

        {/* Right: AI 微調面板（同單圖版 EditorCanvas.tsx 一致） */}
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold">AI 微調</h2>

          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setTab("edit")}
              className={`flex-1 rounded-md text-sm py-1.5 transition-all ${
                tab === "edit" ? "bg-white text-violet-600 font-medium shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              修改圖片
            </button>
            <button
              onClick={() => setTab("logo")}
              className={`flex-1 rounded-md text-sm py-1.5 transition-all ${
                tab === "logo" ? "bg-white text-violet-600 font-medium shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              放置LOGO
            </button>
          </div>

          {tab === "edit" && (
            <div className="space-y-4">
              {!isCell ? (
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-400 text-center">
                  目前顯示整體拼版。<br />請從左側選一格（圖 1、圖 2…）來修改。
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">正在修改：圖 {activeCell + 1}</span>
                    <span className="flex items-center gap-1 text-gray-400">
                      換位置
                      <button onClick={() => reorderCells(activeCell, activeCell - 1)} disabled={busy || activeCell === 0}
                        aria-label="往前移一格" title="往前移一格"
                        className="w-6 h-6 grid place-items-center rounded-md border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => reorderCells(activeCell, activeCell + 1)} disabled={busy || activeCell === cells.length - 1}
                        aria-label="往後移一格" title="往後移一格"
                        className="w-6 h-6 grid place-items-center rounded-md border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 p-0.5">
                    {([["text", "改字", Type], ["free", "其他修改", Wand2], ["regen", "重新生成", RefreshCw], ["replace", "換圖", ImageIcon]] as const).map(([mode, label, Icon]) => (
                      <button
                        key={mode}
                        onClick={() => setEditMode(mode)}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-md text-[11px] py-1.5 transition-all ${
                          editMode === mode ? "bg-violet-50 text-violet-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <Icon className="h-3.5 w-3.5" />{label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {isCell && editMode === "regen" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">整格換一張新畫面：沿用這格的文字、產品和色調，只換場景、角度、構圖。不滿意可以按「復原」。</p>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">想要什麼樣的新畫面？（選填）</label>
                    <textarea
                      value={regenWish}
                      onChange={(e) => setRegenWish(e.target.value)}
                      rows={3}
                      maxLength={300}
                      placeholder="例：換成浴室洗手台的場景 / 改成近拍手拿產品 / 背景更明亮"
                      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
                    />
                  </div>
                  <Button
                    onClick={regenerateCell}
                    disabled={busy || !activityId}
                    className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                  >
                    {regenerating
                      ? <><Loader2 className="h-4 w-4 animate-spin" /><span>生成中…（約 20–40 秒）</span></>
                      : <><RefreshCw className="h-4 w-4" /><span>重新生成圖 {activeCell + 1}</span></>}
                  </Button>
                </div>
              )}

              {isCell && editMode === "replace" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">從品牌素材庫挑一張，或從電腦上傳，換掉「圖 {activeCell + 1}」。圖會依格子比例自動裁切。</p>
                  {library === null && clientId ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border bg-gray-50 py-8 text-xs text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />讀取素材庫…
                    </div>
                  ) : (
                    <div className={busy ? "pointer-events-none opacity-50" : ""}>
                      <ImageLibraryPicker library={library ?? []} uploadFile={uploadFile} onPick={(url) => { void replaceActiveCell(url); }} />
                    </div>
                  )}
                </div>
              )}

              {isCell && editMode === "text" && (
                <div className="space-y-3">
                  {blocksForActive === undefined ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border bg-gray-50 py-8 text-xs text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />正在讀取「圖 {activeCell + 1}」上的文字…
                    </div>
                  ) : blocksForActive === "error" ? (
                    <div className="rounded-lg border bg-gray-50 p-4 text-center text-xs text-gray-500 space-y-2">
                      <p>讀取圖上文字失敗。</p>
                      <Button variant="outline" size="sm" onClick={retryReadText}>再試一次</Button>
                    </div>
                  ) : originalBlocks.length === 0 ? (
                    <div className="rounded-lg border bg-gray-50 p-4 text-center text-xs text-gray-500 space-y-2">
                      <p>「圖 {activeCell + 1}」上沒有讀到文字。</p>
                      <p>要加字或改其他地方，請用「其他修改」。</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400">直接改下面的文字，AI 只會重畫你改的那幾段，字型和位置照舊。清空＝把那段字拿掉。</p>
                      <div className="space-y-2">
                        {draftBlocks.map((value, i) => {
                          const changed = value.trim() !== originalBlocks[i];
                          return (
                            <div key={i}>
                              <textarea
                                value={value}
                                onChange={(e) => setDraftAt(i, e.target.value)}
                                rows={Math.min(3, Math.max(1, Math.ceil(value.length / 22)))}
                                aria-label={`第 ${i + 1} 段文字`}
                                className={`w-full rounded-lg border p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 transition ${
                                  changed ? "border-violet-300 bg-violet-50/60" : "border-gray-200 bg-white"}`}
                              />
                              {changed && (
                                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 mt-0.5 px-1">
                                  <span className="truncate">原本：{originalBlocks[i]}</span>
                                  <button onClick={() => setDraftAt(i, originalBlocks[i])} className="shrink-0 text-violet-600 hover:underline">還原</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        讀錯字或漏掉某段？<button onClick={retryReadText} className="text-violet-600 hover:underline">重新讀取</button>，或改用「其他修改」。
                      </p>
                      <Button
                        onClick={applyTextEdits}
                        disabled={busy || pendingEdits.length === 0}
                        className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                      >
                        {inpainting
                          ? <><Loader2 className="h-4 w-4 animate-spin" /><span>修改中…</span></>
                          : <><Sparkles className="h-4 w-4" /><span>{pendingEdits.length ? `套用 ${pendingEdits.length} 處修改` : "改好文字後按這裡套用"}</span></>}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {isCell && editMode === "free" && (
                <>
                  <p className="text-xs text-gray-400">
                    正在修改「圖 {activeCell + 1}」。請選取畫面中的物件，或直接告訴 AI 想怎麼修改，完成會自動更新拼版。
                  </p>

                  {maskDataUrl && (
                    <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 border bg-blue-50 border-blue-200 text-blue-700">
                      <span className="w-2 h-2 rounded-full inline-block bg-blue-500" />
                      已選取修改範圍
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">告訴 AI 你想怎麼修改</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      placeholder="例：把背景改成日落沙灘 / 移除右下角的水印 / 文字改成：限時優惠中"
                      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
                    />
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      想改文字內容：用「文字改成：新內容」呢個句式最準，或者圈選好文字範圍後直接打新內容都得。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">加入參考圖（選填）</p>
                    {refImageDataUrl ? (
                      <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-white p-2">
                        <img src={refImageDataUrl} alt="參考圖" className="h-14 w-14 rounded-md object-cover shrink-0 border" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{refImageName}</p>
                        </div>
                        <button onClick={clearRef} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => refInputRef.current?.click()}
                        className="w-full flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50 px-3 py-5 text-xs text-gray-400 hover:text-violet-600 transition-all"
                      >
                        <UploadCloud className="h-5 w-5" />
                        <span className="font-medium">＋ 加入參考圖</span>
                        <span className="text-[11px] text-gray-400">支援 JPG、PNG，檔案大小不超過 5MB</span>
                      </button>
                    )}
                    <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefChange} />
                  </div>

                  <Button
                    onClick={editActiveCell}
                    disabled={busy || (!prompt.trim() && !selectionBounds && !refImageDataUrl)}
                    className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                  >
                    {inpainting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /><span>生成中…</span></>
                      : <><Sparkles className="h-4 w-4" /><span>產生修改 ✨</span></>}
                  </Button>
                </>
              )}

              {/* 文案微調——多圖係整組共用一份文案，唔跟住揀邊格而變，所以擺喺
                  cell-conditional 表單之外，composite／cell view 都見得到。 */}
              <div className="border-t pt-4">
                <button
                  onClick={() => setCopyOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-gray-400" />
                    文案微調
                  </span>
                  {copyOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {copyOpen && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={copyText}
                      onChange={(e) => { setCopyText(e.target.value); setSaved(false); }}
                      rows={6}
                      placeholder="這組多圖的文案…"
                      className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <div className="text-xs text-gray-500">一鍵轉換語氣：</div>
                    <div className="flex flex-wrap gap-2">
                      {COPY_TRANSFORMS.map((t) => (
                        <Button key={t.label} variant="outline" size="sm"
                          onClick={() => transformCopy(t.instruction)} disabled={transforming}>
                          {transforming ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          {t.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">文案會在「儲存草稿」時一併存回。</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "logo" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                將標誌放置在「{isCell ? `圖 ${activeCell + 1}` : "拼版總覽"}」上：某一格會合成到該格後自動重新拼版，拼版總覽則直接疊在整張大圖上。
              </p>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">標誌</p>
                {availableLogos.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableLogos.map((lv) => (
                      <button
                        key={lv.url}
                        onClick={() => setShowLogo(true)}
                        title={lv.label}
                        className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 hover:border-violet-300 hover:bg-violet-50 transition-colors"
                      >
                        <img src={lv.url} alt={lv.label} className="h-10 object-contain" />
                        <span className="text-[10px] text-gray-500 truncate max-w-full">{lv.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">尚未設定品牌標誌，可於下方上傳。</p>
                )}
              </div>

              <button
                onClick={() => setShowLogo(true)}
                className="w-full flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50 px-3 py-6 text-xs text-gray-400 hover:text-violet-600 transition-all"
              >
                <UploadCloud className="h-5 w-5" />
                <span>點擊或拖曳圖片到這裡</span>
              </button>

              {/* 柔和投影：實際開關在「放置標誌」視窗內（LogoPlacerModal 內建 shadow
                  狀態），呢度純顯示提示，未直接接線——避免喺呢層重複維護一份會同
                  modal 入面嗰個唔同步嘅開關狀態（同單圖版 EditorCanvas.tsx 一致）。 */}
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" disabled className="accent-violet-600" />
                柔和投影（於「放置標誌」視窗內設定）
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 放置標誌 modal —— 針對「目前顯示的那張圖」：
          某一格 → 合成到該格後自動重新拼版；拼版總覽 → 直接疊在整張大圖上。 */}
      {showLogo && (
        <LogoPlacerModal
          imageUrl={isCell ? cells[activeCell] : composite}
          logoVersions={availableLogos}
          onConfirm={(url, placed) => {
            setShowLogo(false);
            setSaved(false);
            pushHistory();
            if (isCell) {
              const nextCells = cells.map((c, i) => (i === activeCell ? url : c));
              setCells(nextCells);
              void recomposite(nextCells);
            } else {
              setComposite(url);
              // 記下位置：之後改任何一格重新拼版時重貼
              setCompositeLogos((cur) => [...cur, ...placed]);
            }
          }}
          onClose={() => setShowLogo(false)}
        />
      )}

      <UnsavedChangesModal
        open={!!pendingHref}
        saving={saving}
        onCancel={cancelLeave}
        onLeaveWithoutSaving={confirmLeave}
        onSaveAndLeave={async () => { await handleSave(); confirmLeave(); }}
      />
    </div>
  );
}
