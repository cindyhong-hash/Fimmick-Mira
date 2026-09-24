"use client";
import { clipToShape, drawEditableShape, drawIcon, EDITABLE_ICON_NAMES, isFillableShape } from "@/lib/magic-layers/editable-shape.ts";
import { applyLayerTransform, docToLayer, layerCorners, layerToDoc } from "@/lib/magic-layers/layer-transform.ts";
import { alignOffsets, unitCount, type AlignMode } from "@/lib/magic-layers/align.ts";
import { DEFAULT_GLOW, drawGlow, type LayerGlow } from "@/lib/magic-layers/layer-glow.ts";
import { distanceToPolyline, drawPaint, paintHits, samplePath, smoothStroke, strokeToPaint } from "@/lib/magic-layers/freehand.ts";
/* ============================================================
   Magic Layers — React editor
   Canvas layer editor: select / move / scale / rotate / z-order / show / lock /
   delete / duplicate, zoom + pan. Consumes LayerData[] from the analysis
   pipeline; extracts each layer along its contour (no rectangle crops).
   Ported from the verified vanilla engine.
   ============================================================ */
import { drawEditableText, readTextLayout, DEFAULT_TEXT_LAYOUT, type TextLayout } from "@/lib/magic-layers/editable-text.ts";
import { useBrandFonts } from "@/lib/fonts/useBrandFonts";
import type { PaintStroke, SavedLayer, TextFx, TextRun, ShapeKind, ShapeSpec } from "@/lib/magic-layers/saved-layer.ts";
export type { SavedLayer } from "@/lib/magic-layers/saved-layer.ts";
/** 多頁設計的一頁（像 Canva 的頁面）：尺寸＋圖層。 */
export type SavedPage = { docW: number; docH: number; layers: SavedLayer[]; /** 頁面名稱（例如「封面」）；空的就顯示「第 N 頁」。 */ name?: string };
import { useCallback, useEffect, useRef, useState } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, ChevronUp, ChevronDown, ChevronLeft, Scissors, Sparkles, Eye, EyeOff, Lock, Unlock, Copy, Trash2, ArrowLeft, Plus, Download, Image as ImageIcon, Upload, Type, BadgeCheck, Square, Star, Minus, Pencil, Undo2, Redo2, Eraser, Maximize2, GripVertical, WandSparkles, Save, Layers, LayoutTemplate, Wrench, PenTool } from "lucide-react";
import type { LayerData, FragmentationReport } from "@/lib/magic-layers/types.ts";
import { extractLayer } from "@/lib/magic-layers/extract-browser.ts";
import { alphaHit } from "@/lib/magic-layers/alpha-hit-test.ts";
import { useUnsavedGuard } from "@/components/common/UnsavedGuard";

/** Vector layer (形狀 / 圖標 / 線條) — drawn on canvas, recolourable (not baked to bitmap). */
/** 文字特效（設計感）— 全部在 canvas 即時渲染，文字保持可編輯／可拖曳／可存。
 *  strokeW = 佔字級的比例（隨字放大縮小），letterSpacing = px。 */

type EL = {
  id: string; name: string; type: LayerData["type"]; semanticId: string; instanceId: string | null;
  confidence: number; editable: boolean; source: string;
  isText: boolean; text: string; color: string; fontSize: number; fontFamily: string; fontWeight: number; align: "left" | "center" | "right";
  textLayout?: TextLayout;
  runs?: TextRun[];          // 分段樣式：只把某幾個字放大／換色
  fx?: TextFx | null;        // 文字特效（選用；null/undefined = 純文字）
  isArt?: boolean;           // 由 AI 文字藝術字生成的圖片圖層（可再用 AI 微調）
  artRefImage?: string | null;   // 生成時用的風格參考圖（data URL；供 reload 後續編/微調）
  shape: ShapeSpec | null;   // vector layer spec; null for image/text layers
  canvas: HTMLCanvasElement | null; naturalW: number; naturalH: number;
  src: string | null;   // persistent image URL (for save/serialize); null for pure-generated canvases
  cx: number; cy: number; w: number; h: number; rotation: number;
  visible: boolean; locked: boolean; opacity: number;
  embeddedText: { text: string }[]; thumb: string | null;
  groupId?: string | null;
  /** 剪裁遮色片：只顯示在這個形狀圖層的輪廓裡（形狀圖層的 id）。 */
  clipTo?: string | null;
  /** 傾斜（角度）：水平傾斜讓方塊變成平行四邊形，像斜的標籤。 */
  skewX?: number; skewY?: number;
  /**
   * 圖層內繪製：畫在這張圖片上的筆畫（向量、非破壞性，原圖像素不動）。
   * 跟著圖片移動／縮放／旋轉／複製／隱藏／刪除，不會在圖層列表多出一堆「繪製」圖層。
   */
  paint?: PaintStroke[];
  /** 外光暈（沿著內容輪廓往外發光）；null/undefined＝沒有。 */
  glow?: LayerGlow | null;
};

/**
 * Feature flag：「魔術棒補空白」暫時收起。
 * 想拿回來繼續做就改 true——按鈕、generateMagicFill 與
 * /api/magic-layers/magic-fill 都原封不動留著。
 */
const SHOW_MAGIC_FILL = false;

type LeftTab = "templates" | "materials" | "ai" | "tools" | "upload";
const LEFT_TABS: { id: LeftTab; label: string; Icon: typeof Wrench }[] = [
  { id: "templates", label: "範本", Icon: LayoutTemplate },
  { id: "materials", label: "素材", Icon: ImageIcon },
  { id: "ai", label: "AI 設計", Icon: WandSparkles },
  { id: "tools", label: "工具", Icon: Wrench },
  { id: "upload", label: "上傳", Icon: Upload },
];

const TYPE_LABEL: Record<string, string> = { background: "背景", product: "產品", person: "人物", object: "物件", decoration: "裝飾", drawing: "繪製", independent_text: "文字" };

/** One serialized layer in a saved 排版 (stored in LibraryImage.paramsJson). */

export function MagicLayersEditor({ image, layers, fragmentation, backgrounds, logos, name, clientId, onRename, onBack, onSave, extraPages, firstPageName }: { image: HTMLImageElement; layers: LayerData[]; fragmentation?: FragmentationReport; backgrounds?: { url: string; label?: string }[]; logos?: string[]; name?: string; clientId?: string | null; onRename?: (name: string) => void; onBack?: () => void; onSave?: (payload: { docW: number; docH: number; layers: SavedLayer[]; imageDataUrl: string; finalize: boolean; pages?: SavedPage[]; pageImages?: string[] }) => Promise<void>;
  /** 多頁草稿的第 2 頁以後；第 1 頁照舊從 image／layers 進來。 */
  extraPages?: SavedPage[];
  /** 第 1 頁的名稱（第 1 頁的圖層走 layers，名稱另外帶進來）。 */
  firstPageName?: string }) {
  // 品牌字體：使用者上傳的字體要能在畫布選用。ready 用來在字體載完後重畫一次，
  // 否則已經套用品牌字體的圖層會先以系統字型畫出來。
  const { fonts: brandFonts, ready: brandFontsReady } = useBrandFonts(clientId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const addProdRef = useRef<HTMLInputElement>(null);
  const uploadImgRef = useRef<HTMLInputElement>(null);
  const uploadLogoRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [showLogo, setShowLogo] = useState(false);            // Logo 選擇器（多版本挑一個）
  const [showIcon, setShowIcon] = useState(false);            // 圖標選擇器
  const [showShape, setShowShape] = useState(false);          // 形狀選擇器
  const [showOutpaint, setShowOutpaint] = useState(false);
  const [outpaintRatio, setOutpaintRatio] = useState("4:5");
  const [outpaintDirection, setOutpaintDirection] = useState("auto");
  const [outpaintMode, setOutpaintMode] = useState<"keep" | "recompose">("keep");
  const [outpaintCount, setOutpaintCount] = useState(2);
  const [outpaintBusy, setOutpaintBusy] = useState(false);
  const [outpaintResult, setOutpaintResult] = useState<{ variants: string[]; targetW: number; targetH: number; offsetX: number; offsetY: number } | null>(null);
  const [magicFillBusy, setMagicFillBusy] = useState(false);
  const [magicFillResult, setMagicFillResult] = useState<string[] | null>(null);
  // 左側：一排圖示（範本｜素材｜AI 設計｜工具｜上傳），點了才展開那一格的面板，再點一次收起來（像 Canva）
  const [leftTab, setLeftTab] = useState<LeftTab | null>(null);
  // 範本庫（共用，全品牌看得到；目前只做 1:1）
  const [templates, setTemplates] = useState<{ id: string; name: string; previewUrl: string | null; builtin?: boolean }[]>([]);
  const [tplSaving, setTplSaving] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);         // 右下「圖層」可收合
  // 可拖曳調整的高度，記在這台瀏覽器（圖層區含標題列；範本庫、素材庫是縮圖格的高度）
  const [layersH, startLayersResize] = useStoredHeight(LAYERS_H_KEY, 340, 150);
  const rpanelRef = useRef<HTMLElement>(null);
  /** 左欄拉高某一區時，至少留一點給下面的工具列。 */
  const [panelTab, setPanelTab] = useState<"design" | "settings">("design");
  const [renaming, setRenaming] = useState(false);            // 重新命名這個設計
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renamingLayerValue, setRenamingLayerValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);   // 短暫顯示「✓ 已儲存」回饋
  const [artBusy, setArtBusy] = useState(false);   // AI 文字藝術字生成中
  const [artRef, setArtRef] = useState<string | null>(null);   // AI 藝術字設定：風格參考圖（data URL）
  const [artEdit, setArtEdit] = useState("");      // AI 微調：使用者的修改指令
  const [artView, setArtView] = useState<"none" | "setup">("none");   // 文字圖層是否進入「AI 文字藝術字」設定子畫面
  // 復原/重做歷史 refs（實作在 render 定義之後，避免 TDZ）
  const history = useRef<EL[][]>([]);
  const histIdx = useRef(0);
  const savedIdx = useRef(0);
  const [histTick, bumpHv] = useState(0);
  /** 頁面有增刪、排序，或切走的那頁有沒存的修改 → 算「有未儲存的變更」。 */
  const [pagesChanged, setPagesChanged] = useState(false);
  const bump = useCallback(() => bumpHv((n) => n + 1), []);
  const [doc, setDoc] = useState(() => ({ w: image.naturalWidth, h: image.naturalHeight }));
  // 滑鼠事件是在 effect 裡註冊的，讀 state 會拿到舊值；框選要夾在畫布內，需要當下的尺寸
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; }, [doc]);

  const layersRef = useRef<EL[]>([]);
  const view = useRef({ zoom: 1, panX: 0, panY: 0 });
  const drag = useRef<any>(null);
  const space = useRef(false);
  const dpr = useRef(1);

  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** 單選且是圖片圖層時才給「去背」——文字圖層沒有背景可去。 */
  const [selectedIsImage, setSelectedIsImage] = useState(false);
  const selectedIdsRef = useRef<string[]>([]);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  // 橡皮擦工具（局部擦掉圖片圖層）
  const [tool, setTool] = useState<"select" | "erase" | "marquee" | "pen" | "draw">("select");
  /**
   * 繪製（Figma Pencil）：顏色、粗細、透明度、平滑度、是否在擦除模式。
   * 事件處理在較早的 effect 裡註冊，透過 drawCfgRef 讀到最新設定。
   */
  const [drawCfg, setDrawCfg] = useState({ color: "#1f2937", width: 6, opacity: 1, smooth: 50, erase: false, bind: true });
  const drawCfgRef = useRef(drawCfg);
  useEffect(() => { drawCfgRef.current = drawCfg; }, [drawCfg]);
  /** 正在畫的這一筆（文件座標），放開滑鼠才變成圖層。 */
  const strokeRef = useRef<{ x: number; y: number }[] | null>(null);
  const finishStrokeRef = useRef<() => void>(() => {});
  /**
   * 鋼筆畫到一半的路徑（文件座標）。每個點可以有進／出把手（相對於點的位移）；
   * hover 是滑鼠目前位置，用來畫「下一段會長這樣」的預覽線。
   */
  /** 滑鼠、鍵盤事件在較早的 effect 裡註冊，透過這個 ref 呼叫下面才宣告的 finishPen。 */
  const finishPenRef = useRef<(closed: boolean) => void>(() => {});
  const penRef = useRef<{ pts: { x: number; y: number; ix?: number; iy?: number; ox?: number; oy?: number }[]; hover: { x: number; y: number } | null } | null>(null);
  // 畫布內文字編輯：雙擊文字圖層就地打字，Enter 換行。
  // 右側面板也能改，但要在畫面上直接看著版面打字才知道會不會爆框。
  // 雙擊當下就把幾何算好存進 state；render 期間不再去讀 layersRef／view
  // （那會在 render 階段讀 ref，lint 會擋，而且 pan/zoom 後座標也會失準）。
  // 畫布內編輯時，textarea 裡被選起來的字元範圍。有範圍才顯示分段樣式工具列。
  const [textSel, setTextSel] = useState<{ start: number; end: number } | null>(null);
  const readSel = useCallback((t: HTMLTextAreaElement) => {
    setTextSel(t.selectionStart === t.selectionEnd ? null : { start: t.selectionStart, end: t.selectionEnd });
  }, []);
  const [editingText, setEditingText] = useState<{
    id: string; value: string;
    left: number; top: number; width: number; height: number;
    rotation: number; font: string; color: string; align: "left" | "center" | "right";
  } | null>(null);
  // 生成式填色：在畫布上框一塊，只有那一塊交給 AI 重畫（補東西或移除東西）。
  // marqueeRef 是拖曳中的即時矩形（給 render 畫虛線框用，不觸發 re-render）；
  // marquee 是放開滑鼠後定案的那一塊，有值才會跳出輸入框。
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [genFillPrompt, setGenFillPrompt] = useState("");
  const [genFillBusy, setGenFillBusy] = useState(false);
  const [genFillResult, setGenFillResult] = useState<string[] | null>(null);
  /** 目前預覽第幾個版本；結果一回來就直接套在畫布上，用 ‹ › 換著看。 */
  const [genFillIndex, setGenFillIndex] = useState(0);
  /**
   * 這次生成式填色要補的範圍，以及補好的那塊要插在哪一層上面（最上面那張背景；null＝放最上層）。
   * 之前的做法是把整張畫布壓平去修、再把所有圖層藏起來用結果當新背景——
   * 用過一次整份設計就變成一張圖，存草稿回來字都不能改了。
   */
  const genFillTarget = useRef<{ box: { x: number; y: number; w: number; h: number }; afterId: string | null } | null>(null);
  const [brush, setBrush] = useState(28);   // 筆刷半徑（文件座標 px）
  const toolRef = useRef(tool); toolRef.current = tool;
  const brushRef = useRef(brush); brushRef.current = brush;
  const erasePt = useRef<{ x: number; y: number } | null>(null);   // 筆刷游標位置（文件座標）

  /* ---------- build editor layers from analysis output ---------- */
  useEffect(() => {
    let cancelled = false;
    const src = document.createElement("canvas");
    src.width = doc.w; src.height = doc.h;
    const sctx = src.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(image, 0, 0);

    (async () => {
      const els: EL[] = await Promise.all(layers.map(async (l) => {
        const st = (l.meta?.style ?? null) as { text?: string; fontSizePx?: number; fontWeight?: number; color?: string; align?: "left" | "center" | "right"; fontFamily?: string; fx?: TextFx | null; layout?: unknown } | null;
        // 可編輯文字：type 是 independent_text 且「不是已光柵化的圖層」（藝術字/去背文字有 image，屬圖片圖層）
        const isText = l.type === "independent_text" && !l.image && !(l.meta?.isArt as boolean | undefined);
        // Bitmaps come from the ORIGINAL/generated pixels:
        //  - objects & background: server cut-out / image (l.image), else client extract
        //  - matted text (decompose flow): l.image
        //  - generated/editable text (compose flow): NO image -> rendered as TEXT
        const shape = (l.meta?.shape as ShapeSpec | undefined) ?? null;   // 向量圖層
        let canvas: HTMLCanvasElement | null = null;
        if (l.image) canvas = await loadToCanvas(l.image);
        else if (!isText && !shape) canvas = extractLayer(image, l, doc.w, doc.h)?.canvas ?? null;
        // 圖層的框是排版位置，不是圖片尺寸。直接把圖拉去填滿框會變形——套組給
        // icon 的框是直的，icon 本身是正方形，塞進去就被壓扁。所以圖片依原始
        // 比例縮到框內並置中。背景例外：它本來就該滿版出血。
        let boxW = l.width;
        let boxH = l.height;
        if (!isText && canvas && l.type !== "background" && canvas.width > 0 && canvas.height > 0) {
          const scale = Math.min(l.width / canvas.width, l.height / canvas.height);
          boxW = Math.round(canvas.width * scale);
          boxH = Math.round(canvas.height * scale);
        }
        const el: EL = {
          id: l.id, name: l.name, type: l.type, semanticId: l.semanticId, instanceId: l.instanceId,
          confidence: l.confidence, editable: l.editable, source: l.source, shape, fx: st?.fx ?? null, textLayout: readTextLayout(st?.layout),
          isArt: (l.meta?.isArt as boolean | undefined) ?? false,
          artRefImage: (l.meta?.artRefImage as string | undefined) ?? null,
          isText, text: isText ? String(st?.text ?? (l.meta?.textObject as { text?: string } | undefined)?.text ?? l.name) : String((l.meta?.artText as string | undefined) ?? ""),
          color: st?.color ?? "#241f47", fontSize: st?.fontSizePx ?? Math.max(10, Math.round(l.height * 0.8)),
          fontFamily: st?.fontFamily ?? "'Noto Sans TC',system-ui,sans-serif", fontWeight: st?.fontWeight ?? 700, align: st?.align ?? "center",
          runs: (l.meta?.style as { runs?: TextRun[] } | undefined)?.runs,
          canvas, naturalW: canvas?.width || l.width, naturalH: canvas?.height || l.height,
          src: l.image ?? null,
          cx: l.x + l.width / 2, cy: l.y + l.height / 2, w: boxW, h: boxH, rotation: l.rotation ?? 0,
          // runtime flags restored from a saved 排版 (meta), else defaults
          visible: (l.meta?.visible as boolean | undefined) ?? true,
          locked: (l.meta?.locked as boolean | undefined) ?? false,
          opacity: (l.meta?.opacity as number | undefined) ?? 1,
          groupId: (l.meta?.groupId as string | undefined) ?? null,
          clipTo: (l.meta?.clipTo as string | undefined) ?? null,
          skewX: (l.meta?.skewX as number | undefined) ?? 0, skewY: (l.meta?.skewY as number | undefined) ?? 0,
          paint: (l.meta?.paint as PaintStroke[] | undefined) ?? undefined,
          glow: (l.meta?.glow as LayerGlow | undefined) ?? null,
          embeddedText: l.embeddedText.map((t) => ({ text: t.text })), thumb: null,
        };
        if (isText && !st && !canvas) el.color = sampleColor(sctx, l.x, l.y, l.width, l.height);
        el.thumb = makeThumb(el);
        return el;
      }));
      if (cancelled) return;
      layersRef.current = els;
      selectOnly(null);
      seedHistory();   // 剛載入（合成/續編）→ 歷史基準、乾淨狀態
      requestAnimationFrame(() => { fit(); refresh(); });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // 只在載入另一份設計時重建圖層；擴圖改 doc 尺寸時不可重新初始化，否則會覆蓋剛加入的擴展背景。
  }, [image, layers]);

  /* ---------- geometry ---------- */
  const s2d = (sx: number, sy: number) => ({ x: (sx - view.current.panX) / view.current.zoom, y: (sy - view.current.panY) / view.current.zoom });
  const d2s = (dx: number, dy: number) => ({ x: dx * view.current.zoom + view.current.panX, y: dy * view.current.zoom + view.current.panY });
  const evPt = (e: MouseEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  // 四個角：跟著旋轉和傾斜，選取框才會貼著斜的圖層
  const corners = (l: EL) => layerCorners(l);
  // 四邊中點（上/右/下/左）— 拖曳只改單一方向（壓扁/拉長）
  const edges = (l: EL) => {
    const hw = l.w / 2, hh = l.h / 2;
    return ([[0, -hh, "y"], [hw, 0, "x"], [0, hh, "y"], [-hw, 0, "x"]] as const).map(([px, py, axis]) => ({ ...layerToDoc(l, px, py), axis }));
  };
  // 旋轉把手：在上緣中點（傾斜後的位置）再往「上」一段
  const rotHandle = (l: EL) => { const gap = 26 / view.current.zoom, top = layerToDoc(l, 0, -l.h / 2); return { x: top.x + gap * Math.sin(l.rotation), y: top.y - gap * Math.cos(l.rotation) }; };
  // 畫布座標換回圖層自己的座標（把旋轉和傾斜都還原）：點選、縮放、橡皮擦都用這個
  const toLocal = (l: EL, dx: number, dy: number) => docToLayer(l, dx, dy);
  const sel = () => layersRef.current.find((l) => l.id === selectedId) ?? null;
  const applySelection = (ids: string[], primary: string | null = ids[0] ?? null) => {
    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    setSelectedId(primary);
    // 在這裡算好，工具列 render 時就不必讀 ref（render 期間讀 ref 是 lint 擋的事）。
    const only = ids.length === 1 ? layersRef.current.find((l) => l.id === ids[0]) : undefined;
    setSelectedIsImage(!!only && !only.isText);
  };
  const selectOnly = (id: string | null) => applySelection(id ? [id] : [], id);
  const toggleSelection = (id: string) => {
    const hit = layersRef.current.find((l) => l.id === id);
    const related = hit?.groupId ? layersRef.current.filter((l) => l.groupId === hit.groupId).map((l) => l.id) : [id];
    const current = selectedIdsRef.current, removing = related.every((x) => current.includes(x));
    const next = removing ? current.filter((x) => !related.includes(x)) : [...new Set([...current, ...related])];
    applySelection(next, next.includes(selectedId ?? "") ? selectedId : next[0] ?? null);
  };
  const selectLayerOrGroup = (id: string) => { const hit = layersRef.current.find((l) => l.id === id); const ids = hit?.groupId ? layersRef.current.filter((l) => l.groupId === hit.groupId).map((l) => l.id) : [id]; applySelection(ids, id); };
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

  /* ---------- render ---------- */
  const render = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    ctx.save();
    ctx.translate(view.current.panX, view.current.panY);
    ctx.scale(view.current.zoom, view.current.zoom);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, doc.w, doc.h);
    ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.lineWidth = 1 / view.current.zoom; ctx.strokeRect(0, 0, doc.w, doc.h);
    // Figma Frame-style Clip content：圖層仍可拖出畫布，但超出文件邊界的像素不顯示。
    ctx.beginPath(); ctx.rect(0, 0, doc.w, doc.h); ctx.clip();
    for (const l of layersRef.current) {
      if (!l.visible) continue;
      ctx.save();
      applyClip(ctx, l, layersRef.current);
      applyLayerTransform(ctx, l); ctx.globalAlpha = l.opacity;
      drawElBody(ctx, l);
      ctx.restore();
    }
    // 生成式填色的選取框（虛線，跟 PS 的行進螞蟻同一個意思）
    const mq = marqueeRef.current;
    if (mq) {
      ctx.save();
      ctx.setLineDash([6 / view.current.zoom, 4 / view.current.zoom]);
      ctx.lineWidth = 1.5 / view.current.zoom; ctx.strokeStyle = "#7c3aed";
      ctx.fillStyle = "rgba(124,58,237,.10)";
      const x = Math.min(mq.x0, mq.x1), y = Math.min(mq.y0, mq.y1);
      ctx.fillRect(x, y, Math.abs(mq.x1 - mq.x0), Math.abs(mq.y1 - mq.y0));
      ctx.strokeRect(x, y, Math.abs(mq.x1 - mq.x0), Math.abs(mq.y1 - mq.y0));
      ctx.restore();
    }
    // 繪製：畫到一半的這一筆，照目前的顏色、粗細、透明度即時顯示
    const stroke = strokeRef.current;
    if (stroke && stroke.length) {
      const cfg = drawCfgRef.current;
      ctx.save();
      // 畫在圖片上：預覽也只顯示在圖片範圍內，跟放開後的結果一樣
      const t = paintTarget(layersRef.current, selectedIdsRef.current, cfg.bind);
      if (t) { const m = ctx.getTransform(); applyLayerTransform(ctx, t); ctx.beginPath(); ctx.rect(-t.w / 2, -t.h / 2, t.w, t.h); ctx.clip(); ctx.setTransform(m); }
      ctx.globalAlpha = cfg.opacity; ctx.strokeStyle = cfg.color; ctx.lineWidth = cfg.width;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
      ctx.stroke(); ctx.restore();
    }
    // 鋼筆：已經點的節點、把手，以及從最後一點到滑鼠的預覽線
    const pen = penRef.current;
    if (pen && pen.pts.length) {
      const z = view.current.zoom;
      ctx.save();
      ctx.lineWidth = 2 / z; ctx.strokeStyle = "#7c3aed";
      ctx.beginPath(); ctx.moveTo(pen.pts[0].x, pen.pts[0].y);
      for (let i = 1; i < pen.pts.length; i++) {
        const a = pen.pts[i - 1], b = pen.pts[i];
        if (a.ox != null || b.ix != null) ctx.bezierCurveTo(a.x + (a.ox ?? 0), a.y + (a.oy ?? 0), b.x + (b.ix ?? 0), b.y + (b.iy ?? 0), b.x, b.y);
        else ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      if (pen.hover) {
        const last = pen.pts[pen.pts.length - 1];
        ctx.setLineDash([5 / z, 4 / z]); ctx.beginPath(); ctx.moveTo(last.x, last.y);
        if (last.ox != null) ctx.quadraticCurveTo(last.x + last.ox, last.y + (last.oy ?? 0), pen.hover.x, pen.hover.y); else ctx.lineTo(pen.hover.x, pen.hover.y);
        ctx.stroke(); ctx.setLineDash([]);
      }
      const closing = pen.hover && pen.pts.length >= 3 && Math.hypot(pen.hover.x - pen.pts[0].x, pen.hover.y - pen.pts[0].y) < 12 / z;
      pen.pts.forEach((p, i) => {
        for (const [hx, hy] of [[p.ix, p.iy], [p.ox, p.oy]] as const) {
          if (hx == null) continue;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + hx, p.y + (hy ?? 0)); ctx.lineWidth = 1 / z; ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x + hx, p.y + (hy ?? 0), 3.5 / z, 0, Math.PI * 2); ctx.fillStyle = "#7c3aed"; ctx.fill();
        }
        const r = (i === 0 && closing ? 7 : 4.5) / z;
        ctx.fillStyle = i === 0 && closing ? "#7c3aed" : "#fff"; ctx.lineWidth = 1.5 / z;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); ctx.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
      });
      ctx.restore();
    }
    // 橡皮擦筆刷游標圈
    if (toolRef.current === "erase" && erasePt.current) {
      ctx.beginPath();
      ctx.arc(erasePt.current.x, erasePt.current.y, brushRef.current, 0, Math.PI * 2);
      ctx.lineWidth = 1.5 / view.current.zoom; ctx.strokeStyle = "#7c3aed";
      ctx.fillStyle = "rgba(124,58,237,.12)"; ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    if (toolRef.current === "select") for (const id of selectedIds) { const s = layersRef.current.find((l) => l.id === id); if (s?.visible) drawSelection(ctx, s, id === selectedId); }
  }, [doc.w, doc.h, selectedId, selectedIds]);
  // 局部擦除：文件座標 → 圖層像素 → destination-out 挖透明
  const eraseAt = (l: EL, dx: number, dy: number) => {
    if (!l.canvas) return;
    const lp = toLocal(l, dx, dy);
    const sx = l.canvas.width / l.w, sy = l.canvas.height / l.h;
    const px = (lp.x + l.w / 2) * sx, py = (lp.y + l.h / 2) * sy;
    const r = brushRef.current * ((sx + sy) / 2);
    const c = l.canvas.getContext("2d")!;
    c.save(); c.globalCompositeOperation = "destination-out";
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fillStyle = "#000"; c.fill();
    c.restore();
  };
  const cloneCanvas = (src: HTMLCanvasElement) => { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d")!.drawImage(src, 0, 0); return c; };

  /* ---------- undo / redo history (defined after render to avoid TDZ) ---------- */
  const seedHistory = useCallback(() => { history.current = [layersRef.current.map(cloneEL)]; histIdx.current = 0; savedIdx.current = 0; bump(); }, [bump]);
  // markDirty：改動後 push 快照（截掉 redo 分支）→ 離開攔截 + 復原/重做的單一來源
  const markDirty = useCallback(() => {
    const h = history.current.slice(0, histIdx.current + 1);
    h.push(layersRef.current.map(cloneEL));
    if (h.length > 60) h.shift();
    history.current = h; histIdx.current = h.length - 1; bump();
  }, [bump]);
  const restoreHist = useCallback((idx: number) => {
    const snap = history.current[idx]; if (!snap) return;
    layersRef.current = snap.map(cloneEL);
    histIdx.current = idx;
    const ids = selectedIdsRef.current.filter((id) => layersRef.current.some((l) => l.id === id));
    applySelection(ids, ids.includes(selectedId ?? "") ? selectedId : ids[0] ?? null);
    bump(); refresh(); render();
  }, [bump, refresh, render]);
  const undo = useCallback(() => { if (histIdx.current > 0) restoreHist(histIdx.current - 1); }, [restoreHist]);
  const redo = useCallback(() => { if (histIdx.current < history.current.length - 1) restoreHist(histIdx.current + 1); }, [restoreHist]);
  const dirty = histIdx.current !== savedIdx.current || pagesChanged;
  const canUndo = histIdx.current > 0;
  const canRedo = histIdx.current < history.current.length - 1;

  function drawSelection(ctx: CanvasRenderingContext2D, l: EL, showHandles = true) {
    const cs = corners(l).map((p) => d2s(p.x, p.y));
    const accent = "#7c3aed";
    ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = accent;
    ctx.beginPath(); ctx.moveTo(cs[0].x, cs[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(cs[i].x, cs[i].y); ctx.closePath(); ctx.stroke();
    if (!l.locked && showHandles) {
      const rp = rotHandle(l), rs = d2s(rp.x, rp.y), tm = { x: (cs[0].x + cs[1].x) / 2, y: (cs[0].y + cs[1].y) / 2 };
      ctx.beginPath(); ctx.moveTo(tm.x, tm.y); ctx.lineTo(rs.x, rs.y); ctx.stroke();
      dot(ctx, rs.x, rs.y, accent, true);
      edges(l).forEach((e) => { const p = d2s(e.x, e.y); dot(ctx, p.x, p.y, accent, false); });
      cs.forEach((p) => dot(ctx, p.x, p.y, accent, false));
    }
    ctx.restore();
  }
  function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, round: boolean) {
    ctx.beginPath(); if (round) ctx.arc(x, y, 6, 0, Math.PI * 2); else ctx.rect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
  }

  /* ---------- hit testing ---------- */
  function hitHandle(sx: number, sy: number) {
    const l = sel(); if (!l || l.locked || !l.visible) return null;
    const cs = corners(l).map((p) => d2s(p.x, p.y));
    for (let i = 0; i < 4; i++) if (dist(sx, sy, cs[i].x, cs[i].y) <= 10) return { type: "scale" as const };
    const rp = rotHandle(l), rs = d2s(rp.x, rp.y);
    if (dist(sx, sy, rs.x, rs.y) <= 10) return { type: "rotate" as const };
    const es = edges(l);
    for (const e of es) { const p = d2s(e.x, e.y); if (dist(sx, sy, p.x, p.y) <= 10) return { type: "resize" as const, axis: e.axis }; }
    return null;
  }
  function hitLayer(dx: number, dy: number) {
    if (dx < 0 || dy < 0 || dx > doc.w || dy > doc.h) return null;
    const ls = layersRef.current;
    for (let i = ls.length - 1; i >= 0; i--) {
      const l = ls[i]; if (!l.visible || l.locked) continue;
      const lp = toLocal(l, dx, dy);
      if (Math.abs(lp.x) > l.w / 2 || Math.abs(lp.y) > l.h / 2) continue;   // outside bbox
      if (l.type === "drawing" && l.shape?.points && !hitsDrawing(l, dx, dy, 6 / view.current.zoom)) continue;
      if (l.clipTo) {
        const frame = ls.find((x) => x.id === l.clipTo);
        if (frame) { const fp = toLocal(frame, dx, dy); if (Math.abs(fp.x) > frame.w / 2 || Math.abs(fp.y) > frame.h / 2) continue; }
      }
      // pixel-perfect: image layers only hit where the cut-out is opaque
      if (l.canvas && !l.isText) {
        const u = (lp.x + l.w / 2) / l.w * l.canvas.width;
        const v = (lp.y + l.h / 2) / l.h * l.canvas.height;
        // 透明的地方點不到；但畫在圖片上的筆畫要點得到（筆畫可能畫在去背後的透明處）
        if (!alphaHit(l.canvas, u, v) && !paintHits(l.paint, l.w, l.h, lp, 6 / view.current.zoom).length) continue;
      }
      return l;
    }
    return null;
  }

  /* ---------- pointer interaction ---------- */
  useEffect(() => {
    const cv = canvasRef.current!; if (!cv) return;
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      const s = evPt(e), d = s2d(s.x, s.y);
      const wantPan = e.button === 1 || space.current;
      // 橡皮擦模式：在圖片圖層上局部擦除（優先用選中的圖片圖層，其次點到的圖層）
      if (!wantPan && toolRef.current === "erase") {
        let l = sel();
        const inBBox = (x: EL) => { const lp = toLocal(x, d.x, d.y); return Math.abs(lp.x) <= x.w / 2 && Math.abs(lp.y) <= x.h / 2; };
        if (!(l && l.canvas && !l.isText && !l.locked && inBBox(l))) l = hitLayer(d.x, d.y);
        if (l && l.canvas && !l.isText && !l.locked) {
          if (selectedId !== l.id) selectOnly(l.id);
          l.canvas = cloneCanvas(l.canvas);   // 新 canvas → 復原能還原被擦的像素
          l.src = null;                        // 擦過後以 canvas 為準（存檔用 data URL）
          eraseAt(l, d.x, d.y); erasePt.current = d;
          drag.current = { mode: "erase", l, lx: d.x, ly: d.y };
          render();
        }
        return;
      }
      // 繪製：按下開始一筆；擦除模式則是碰到哪一筆就刪哪一筆
      if (!wantPan && toolRef.current === "draw") {
        if (drawCfgRef.current.erase) { drag.current = { mode: "drawErase", removed: eraseStrokesAt(layersRef.current, selectedIdsRef.current, drawCfgRef.current.bind, d.x, d.y, view.current.zoom) }; render(); return; }
        strokeRef.current = [{ x: d.x, y: d.y }];
        drag.current = { mode: "draw" };
        render();
        return;
      }
      // 鋼筆：點一下加一個點；按住拖曳就是拉出這一點的曲線把手；點回第一個點就封閉完成
      if (!wantPan && toolRef.current === "pen") {
        const pen = penRef.current ?? (penRef.current = { pts: [], hover: null });
        const first = pen.pts[0];
        if (first && pen.pts.length >= 3 && Math.hypot(d.x - first.x, d.y - first.y) < 12 / view.current.zoom) { finishPenRef.current(true); return; }
        const pt = { x: d.x, y: d.y };
        pen.pts.push(pt);
        drag.current = { mode: "pen", pt };
        render();
        return;
      }
      // 框選模式：只畫框，不碰圖層
      if (!wantPan && toolRef.current === "marquee") {
        marqueeRef.current = { x0: d.x, y0: d.y, x1: d.x, y1: d.y };
        setMarquee(null); setGenFillResult(null);
        drag.current = { mode: "marquee" };
        render();
        return;
      }
      if (!wantPan) {
        const h = hitHandle(s.x, s.y);
        if (h) { const l = sel()!; drag.current = h.type === "rotate" ? { mode: "rotate", l, orot: l.rotation, grab: Math.atan2(d.y - l.cy, d.x - l.cx) } : { mode: "scale", l, ow: l.w, oh: l.h, handle: h }; return; }
        const l = hitLayer(d.x, d.y);
        if (l) {
          if (e.shiftKey) { toggleSelection(l.id); render(); return; }
          if (!selectedIdsRef.current.includes(l.id)) selectLayerOrGroup(l.id);
          const picked = layersRef.current.filter((item) => selectedIdsRef.current.includes(item.id) && !item.locked);
          const pickedIds = new Set(picked.map((item) => item.id));
          const riders = layersRef.current.filter((item) => item.clipTo && pickedIds.has(item.clipTo) && !pickedIds.has(item.id) && !item.locked);
          const moving = [...picked, ...riders].map((item) => ({ l: item, ocx: item.cx, ocy: item.cy }));
          drag.current = { mode: "move", l, moving, sx: d.x, sy: d.y }; render(); return;
        }
      }
      drag.current = { mode: "pan", sx: s.x, sy: s.y, opx: view.current.panX, opy: view.current.panY };
      if (!wantPan && selectedId) selectOnly(null);
    };
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g) {
        const s = evPt(e);
        if (toolRef.current === "erase") { erasePt.current = s2d(s.x, s.y); cv.style.cursor = "crosshair"; render(); return; }
        if (toolRef.current === "pen") { if (penRef.current) penRef.current.hover = s2d(s.x, s.y); cv.style.cursor = "crosshair"; render(); return; }
        if (toolRef.current === "draw") { cv.style.cursor = drawCfgRef.current.erase ? "cell" : "crosshair"; return; }
        hover(s); return;
      }
      const s = evPt(e), d = s2d(s.x, s.y);
      if (g.mode === "erase") {
        // 沿上一點→現在點內插，避免快速拖曳留下斷點
        const lx = g.lx ?? d.x, ly = g.ly ?? d.y;
        const distp = Math.hypot(d.x - lx, d.y - ly);
        const step = Math.max(1, brushRef.current * 0.35);
        const n = Math.max(1, Math.ceil(distp / step));
        for (let i = 1; i <= n; i++) eraseAt(g.l, lx + (d.x - lx) * (i / n), ly + (d.y - ly) * (i / n));
        g.lx = d.x; g.ly = d.y; erasePt.current = d; render();
      }
      else if (g.mode === "draw") {
        const pts = strokeRef.current, last = pts?.[pts.length - 1];
        if (pts && last && Math.hypot(d.x - last.x, d.y - last.y) >= 0.5 / view.current.zoom) { pts.push({ x: d.x, y: d.y }); render(); }
      }
      else if (g.mode === "drawErase") {
        if (eraseStrokesAt(layersRef.current, selectedIdsRef.current, drawCfgRef.current.bind, d.x, d.y, view.current.zoom)) { g.removed = true; render(); }
      }
      else if (g.mode === "pen") {
        // 拖出來的方向就是「出」的把手，另一邊對稱成「進」的把手（跟 Photoshop 一樣的平滑節點）
        const ox = d.x - g.pt.x, oy = d.y - g.pt.y;
        if (Math.hypot(ox, oy) > 3 / view.current.zoom) { g.pt.ox = ox; g.pt.oy = oy; g.pt.ix = -ox; g.pt.iy = -oy; }
        if (penRef.current) penRef.current.hover = d;
        render();
      }
      else if (g.mode === "marquee") {
        if (marqueeRef.current) { marqueeRef.current.x1 = d.x; marqueeRef.current.y1 = d.y; render(); }
      }
      else if (g.mode === "move") {
        const dx = d.x - g.sx, dy = d.y - g.sy;
        for (const item of g.moving) { item.l.cx = item.ocx + dx; item.l.cy = item.ocy + dy; }
        render();
      }
      else if (g.mode === "scale") {
        const lp = toLocal(g.l, d.x, d.y); const min = 8;
        const h = g.handle;
        if (h && h.type === "resize" && h.axis === "x") { g.l.w = Math.max(min, Math.abs(lp.x) * 2); }          // 只改寬
        else if (h && h.type === "resize" && h.axis === "y") { g.l.h = Math.max(min, Math.abs(lp.y) * 2); }     // 只改高
        else if (e.shiftKey) { const f = Math.max(Math.abs(lp.x) / (g.ow / 2 || 1), Math.abs(lp.y) / (g.oh / 2 || 1), 0.02); g.l.w = g.ow * f; g.l.h = g.oh * f; }  // 角落＋Shift：等比整體縮放
        else { g.l.w = Math.max(min, Math.abs(lp.x) * 2); g.l.h = Math.max(min, Math.abs(lp.y) * 2); }           // 角落：自由改寬高（可壓扁）
        render();
      }
      else if (g.mode === "rotate") { const now = Math.atan2(d.y - g.l.cy, d.x - g.l.cx); let r = g.orot + (now - g.grab); if (e.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12); g.l.rotation = r; render(); }
      else if (g.mode === "pan") { view.current.panX = g.opx + (s.x - g.sx); view.current.panY = g.opy + (s.y - g.sy); render(); }
    };
    const dbl = (e: MouseEvent) => {
      // 鋼筆：雙擊結束（不封閉）。雙擊會先觸發兩次按下，多出來的那個點拿掉
      if (toolRef.current === "pen") { penRef.current?.pts.pop(); finishPenRef.current(false); return; }
      const s = evPt(e), d = s2d(s.x, s.y);
      const hit = hitLayer(d.x, d.y);
      if (hit?.isText && !hit.locked) {
        selectOnly(hit.id);
        const z = view.current.zoom;
        const p = d2s(hit.cx, hit.cy);
        const fs = hit.fontSize * (hit.w / (hit.naturalW || hit.w)) * z;
        setEditingText({
          id: hit.id, value: hit.text,
          left: p.x - (hit.w * z) / 2, top: p.y - (hit.h * z) / 2,
          width: hit.w * z, height: hit.h * z,
          rotation: hit.rotation,
          font: `${hit.fontWeight} ${fs}px ${hit.fontFamily}`,
          color: hit.color, align: hit.align,
        });
      }
    };
    const up = () => {
      if (drag.current?.mode === "pen") { drag.current = null; return; }
      if (drag.current?.mode === "draw") { drag.current = null; finishStrokeRef.current(); return; }
      if (drag.current?.mode === "drawErase") { const removed = drag.current.removed; drag.current = null; if (removed) { markDirty(); refresh(); } render(); return; }
      if (drag.current?.mode === "marquee") {
        const m = marqueeRef.current;
        // 夾在畫布範圍內：框到畫布外面的灰色區域沒有東西可以補，照樣送出去只是白花錢。
        const { w: dw, h: dh } = docRef.current;
        const x0 = m ? Math.max(0, Math.min(m.x0, m.x1)) : 0, y0 = m ? Math.max(0, Math.min(m.y0, m.y1)) : 0;
        const x1 = m ? Math.min(dw, Math.max(m.x0, m.x1)) : 0, y1 = m ? Math.min(dh, Math.max(m.y0, m.y1)) : 0;
        const w = x1 - x0, h = y1 - y0;
        // 太小的框當成誤點，直接取消——不然會跳出輸入框擋畫面。
        if (m && w >= 12 && h >= 12) { marqueeRef.current = { x0, y0, x1, y1 }; setMarquee({ x: x0, y: y0, w, h }); }
        else { marqueeRef.current = null; setMarquee(null); }
        drag.current = null; render(); return;
      }
      if (drag.current && drag.current.l) { for (const item of drag.current.moving ?? [{ l: drag.current.l }]) item.l.thumb = makeThumb(item.l); if (drag.current.mode !== "pan") markDirty(); } drag.current = null; refresh(); render(); };
    const hover = (s: { x: number; y: number }) => {
      if (space.current) { cv.style.cursor = "grab"; return; }
      const h = hitHandle(s.x, s.y); if (h) { cv.style.cursor = h.type === "rotate" ? "crosshair" : h.type === "resize" ? (h.axis === "x" ? "ew-resize" : "ns-resize") : "nwse-resize"; return; }
      const d = s2d(s.x, s.y); cv.style.cursor = hitLayer(d.x, d.y) ? "move" : "default";
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const s = evPt(e); setZoom(view.current.zoom * Math.pow(1.0015, -e.deltaY), s); };
    cv.addEventListener("dblclick", dbl);
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => { cv.removeEventListener("dblclick", dbl); cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.removeEventListener("wheel", wheel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, render]);

  /* ---------- keyboard (space to pan, delete) ---------- */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if (e.code === "Space" && !typing) { space.current = true; if (canvasRef.current) canvasRef.current.style.cursor = "grab"; e.preventDefault(); }
      if (e.key === "Escape" && toolRef.current === "draw" && !typing) { e.preventDefault(); strokeRef.current = null; setTool("select"); if (canvasRef.current) canvasRef.current.style.cursor = "default"; render(); return; }
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "p" && !typing) {
        e.preventDefault(); const on = toolRef.current !== "draw"; setTool(on ? "draw" : "select"); if (on && !keepsPaintSelection(layersRef.current, selectedIdsRef.current)) applySelection([]); return;
      }
      // 鋼筆畫到一半：Enter 完成、Esc 取消、Backspace 退一個點（不能讓它去刪到選取的圖層）
      if (toolRef.current === "pen" && !typing) {
        if (e.key === "Enter") { e.preventDefault(); finishPenRef.current(false); return; }
        if (e.key === "Escape") { e.preventDefault(); penRef.current = null; setTool("select"); if (canvasRef.current) canvasRef.current.style.cursor = "default"; render(); return; }
        if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); penRef.current?.pts.pop(); render(); return; }
      }
      // ⌘C／⌘V：複製、貼上物件。貼上的是完整獨立的一份，每貼一次往右下錯開一點
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !typing && selectedIdsRef.current.length && !window.getSelection()?.toString()) {
        e.preventDefault();
        const ids = new Set(selectedIdsRef.current);
        layerClipboard = { layers: layersRef.current.filter((l) => ids.has(l.id)).map(cloneLayerDeep), pastes: 0 };
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && !typing && layerClipboard?.layers.length) {
        e.preventDefault();
        const off = 24 * ++layerClipboard.pastes;
        const idMap = new Map<string, string>(), groupMap = new Map<string, string>();
        const pasted = layerClipboard.layers.map((src) => {
          const c = cloneLayerDeep(src);
          c.id = `${src.id.split("_paste")[0]}_paste_${crypto.randomUUID().slice(0, 6)}`; idMap.set(src.id, c.id);
          if (src.groupId) { if (!groupMap.has(src.groupId)) groupMap.set(src.groupId, `group_${crypto.randomUUID().slice(0, 8)}`); c.groupId = groupMap.get(src.groupId)!; }
          c.cx += off; c.cy += off;
          return c;
        });
        // 放在形狀裡的圖：形狀也一起貼的話指向新的形狀；形狀留在原處就還放在原本那個裡面
        for (const c of pasted) if (c.clipTo) c.clipTo = idMap.get(c.clipTo) ?? (layersRef.current.some((l) => l.id === c.clipTo) ? c.clipTo : null);
        layersRef.current.push(...pasted);
        applySelection(pasted.map((c) => c.id), pasted[pasted.length - 1].id); markDirty(); refresh(); render();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current.length && !typing) {
        const deleting = new Set(selectedIdsRef.current); layersRef.current = layersRef.current.filter((l) => !deleting.has(l.id));
        applySelection([]); markDirty(); refresh(); render();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y") && !typing) { e.preventDefault(); redo(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") { space.current = false; if (canvasRef.current) canvasRef.current.style.cursor = "default"; } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ---------- zoom / fit / resize ---------- */
  const setZoom = useCallback((z: number, centerScreen?: { x: number; y: number }) => {
    z = Math.min(32, Math.max(0.02, z));
    const wrap = wrapRef.current!; const c = centerScreen ?? { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 };
    const before = s2d(c.x, c.y); view.current.zoom = z; view.current.panX = c.x - before.x * z; view.current.panY = c.y - before.y * z;
    setZoomPct(Math.round(z * 100)); render();
  }, [render]);
  const fit = useCallback(() => {
    const wrap = wrapRef.current; if (!wrap || !doc.w) return;
    const pad = 48, z = Math.min((wrap.clientWidth - pad) / doc.w, (wrap.clientHeight - pad) / doc.h);
    view.current.zoom = Math.min(32, Math.max(0.02, z));
    view.current.panX = (wrap.clientWidth - doc.w * view.current.zoom) / 2;
    view.current.panY = (wrap.clientHeight - doc.h * view.current.zoom) / 2;
    setZoomPct(Math.round(view.current.zoom * 100)); render();
  }, [doc.w, doc.h, render]);

  /**
   * 只有畫布尺寸真的改變才重新置中。
   *
   * 原本相依 fit 的識別值，而 fit 相依 render、render 又相依 selectedId——
   * 於是每選一個圖層就會重跑一次 fit()，畫面自己跳掉縮放與位置，
   * 使用者根本看不到自己剛選中的東西。用 ref 拿最新的 fit，
   * 相依只留畫布尺寸。
   */
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; });
  // 面板展開／收起時畫布區變寬變窄：等版面更新完再重新縮放置中，畫布才不會被擠到一邊、被右欄擋住
  const leftOpen = leftTab !== null;
  useEffect(() => { const id = requestAnimationFrame(() => fitRef.current()); return () => cancelAnimationFrame(id); }, [leftOpen]);
  useEffect(() => { requestAnimationFrame(() => fitRef.current()); }, [doc.w, doc.h]);

  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current; if (!wrap || !cv) return;
    const resize = () => { dpr.current = window.devicePixelRatio || 1; cv.width = Math.round(wrap.clientWidth * dpr.current); cv.height = Math.round(wrap.clientHeight * dpr.current); cv.style.width = wrap.clientWidth + "px"; cv.style.height = wrap.clientHeight + "px"; render(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(wrap); return () => ro.disconnect();
  }, [render]);

  // brandFontsReady 進 deps：canvas 的 ctx.font 只認已載入完成的字體，
  // 品牌字體是非同步載入的，載完必須重畫一次，否則圖層會停在系統字型。
  useEffect(() => { render(); }, [render, tool, brandFontsReady]);
  // 換選取的圖層時，收起 AI 藝術字子畫面 / 清空微調輸入
  useEffect(() => { setArtView("none"); setArtRef(null); setArtEdit(""); }, [selectedId]);

  /* ---------- layer ops ---------- */
  const idx = (id: string) => layersRef.current.findIndex((l) => l.id === id);
  /** 讓圖剛好蓋滿形狀（等比放大到兩邊都蓋住，置中），跟 Canva 把圖拖進相框一樣。 */
  const fitIntoFrame = (imgId: string, frameId: string) => {
    const img = layersRef.current.find((l) => l.id === imgId), frame = layersRef.current.find((l) => l.id === frameId);
    if (!img || !frame) return;
    const k = Math.max(frame.w / img.w, frame.h / img.h);
    img.w *= k; img.h *= k; img.cx = frame.cx; img.cy = frame.cy;
    img.thumb = makeThumb(img); markDirty(); refresh(); render();
  };
  /** 剪裁遮色片：圖只顯示在形狀裡。圖要疊在形狀上面才看得到，所以順便把它移到形狀正上方。 */
  const putIntoFrame = (imgId: string, frameId: string) => {
    const a = layersRef.current, img = a.find((l) => l.id === imgId), frame = a.find((l) => l.id === frameId);
    if (!img || !frame) return;
    img.clipTo = frame.id;
    if (a.indexOf(img) < a.indexOf(frame)) { a.splice(a.indexOf(img), 1); a.splice(a.indexOf(frame) + 1, 0, img); }
    fitIntoFrame(imgId, frameId);
  };
  const takeOutOfFrame = useCallback((id: string) => {
    const img = layersRef.current.find((l) => l.id === id); if (!img) return;
    img.clipTo = null; markDirty(); refresh(); render();
  }, [markDirty, refresh, render]);
  /** 填色切換純色／漸層：切到漸層時拿目前的顏色當起點，切回純色時拿起點當顏色，不會突然變色。 */
  const setFillMode = useCallback((mode: "solid" | "gradient") => {
    const l = layersRef.current.find((x) => x.id === selectedIdsRef.current[0]); const sh = l?.shape; if (!l || !sh) return;
    // 終點預設用起點的淡色版：用固定顏色的話，剛好跟原本同色時一切換看起來完全沒變
    if (mode === "gradient" && !sh.gradient) { const from = hexColor(sh.fill === "none" ? "#7c3aed" : toHex(sh.fill)); sh.gradient = { axis: "vertical", from, to: lighten(from, 0.7) }; }
    else if (mode === "solid" && sh.gradient) { sh.fill = hexColor(sh.gradient.from); sh.gradient = undefined; }
    else return;
    l.thumb = makeThumb(l); markDirty(); render(); refresh();
  }, [markDirty, render, refresh]);
  const del = (id: string) => { const i = idx(id); if (i < 0) return; layersRef.current.splice(i, 1);
    releaseClips(layersRef.current, id); if (selectedIdsRef.current.includes(id)) { const ids = selectedIdsRef.current.filter((x) => x !== id); applySelection(ids, ids[0] ?? null); } markDirty(); refresh(); render(); };
  const reorderLayer = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const a = layersRef.current, from = a.findIndex((l) => l.id === sourceId), target = a.findIndex((l) => l.id === targetId);
    if (from < 0 || target < 0) return;
    const [item] = a.splice(from, 1); const to = a.findIndex((l) => l.id === targetId);
    // 面板是反向顯示（最上層在最上面）；紫線在目標列上方，所以內部要插在目標之後。
    a.splice(to + 1, 0, item); markDirty(); refresh(); render();
  };
  const toggleVis = (id: string) => { const l = layersRef.current[idx(id)]; if (l) { l.visible = !l.visible; markDirty(); refresh(); render(); } };
  /** 清掉畫在這張圖片上的所有筆畫（一個復原步驟）。 */
  const clearPaint = (id: string) => { const l = layersRef.current[idx(id)]; if (l?.paint?.length) { l.paint = undefined; l.thumb = makeThumb(l); markDirty(); refresh(); render(); } };
  const toggleLock = (id: string) => { const l = layersRef.current[idx(id)]; if (l) { l.locked = !l.locked; markDirty(); refresh(); render(); } };
  // 用 cloneLayerDeep：之前只複製外殼，形狀顏色、文字特效其實跟原本共用同一份，改一個另一個也跟著變
  const duplicate = (id: string) => { const l = layersRef.current[idx(id)]; if (!l) return; const c: EL = { ...cloneLayerDeep(l), id: `${l.id.split("_copy")[0]}_copy_${crypto.randomUUID().slice(0, 6)}`, name: l.name + " 複本", cx: l.cx + 24, cy: l.cy + 24, groupId: null }; layersRef.current.splice(idx(id) + 1, 0, c); selectOnly(c.id); markDirty(); refresh(); render(); };
  /**
   * 對齊／均分：只選一塊對齊畫布，選兩塊以上對齊彼此；群組一起動，鎖定的不動，
   * 放在形狀裡的圖跟著形狀走。一次是一個復原步驟。
   */
  const alignSelected = (mode: AlignMode) => {
    const ids = new Set(selectedIdsRef.current); if (!ids.size) return;
    const offs = alignOffsets(layersRef.current.filter((l) => ids.has(l.id)), mode, doc);
    if (!offs.size) return;
    moveByOffsets(layersRef.current, offs, ids);
    markDirty(); refresh(); render();
  };
  const alignRef = useRef(alignSelected);
  useEffect(() => { alignRef.current = alignSelected; });
  const groupSelected = () => { if (selectedIdsRef.current.length < 2) return; const groupId = `group_${Date.now()}`; layersRef.current.forEach((l) => { if (selectedIdsRef.current.includes(l.id)) l.groupId = groupId; }); markDirty(); refresh(); render(); };
  /**
   * 合併圖層（⌘E，跟 Photoshop 一樣）：選兩個以上就把它們合成一張；只選一個就跟下面那層合併。
   * 依原本的上下順序畫進一張新圖（位置、旋轉、透明度、遮色片都照畫面上的樣子），
   * 放在原本最上面那層的位置。有背景參與時結果就是背景、而且是整張畫布大小，
   * 擴圖、換背景這些把背景當滿版的功能才接得上。
   * 文字合併後會變成圖片，所以先問一次；合錯了可以復原。
   */
  const mergeLayers = () => {
    const a = layersRef.current;
    let ids = selectedIdsRef.current.slice();
    if (ids.length === 1) {
      const i = a.findIndex((l) => l.id === ids[0]);
      const below = a.slice(0, Math.max(0, i)).reverse().find((l) => l.visible);
      if (!below) return;
      ids = [ids[0], below.id];
    }
    const picked = a.filter((l) => ids.includes(l.id) && l.visible);
    if (picked.length < 2) return;
    if (picked.some((l) => l.isText) && !window.confirm("合併之後文字會變成圖片，就不能再改字了（可以用復原還原）。要合併嗎？")) return;

    const hasBg = picked.some((l) => l.type === "background");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of picked) for (const p of layerCorners(l)) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    // 超出畫布的部分本來就看不到，不用留；背景一律是整張畫布
    if (hasBg) { minX = 0; minY = 0; maxX = doc.w; maxY = doc.h; }
    else { minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(doc.w, maxX); maxY = Math.min(doc.h, maxY); }
    const W = Math.round(maxX - minX), H = Math.round(maxY - minY);
    if (W < 1 || H < 1) return;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d")!;
    g.translate(-minX, -minY);
    for (const l of picked) {
      g.save(); applyClip(g, l, a); applyLayerTransform(g, l); g.globalAlpha = l.opacity;
      drawElBody(g, l);
      g.restore();
    }
    const merged: EL = { id: `merged_${crypto.randomUUID().slice(0, 8)}`, name: hasBg ? "背景" : "合併圖層", type: hasBg ? "background" : "object", semanticId: hasBg ? "background" : "object", instanceId: null, confidence: 1, editable: true, source: "generated", isText: false, text: "", color: "#000", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center", shape: null, canvas: cv, naturalW: W, naturalH: H, src: null, cx: minX + W / 2, cy: minY + H / 2, w: W, h: H, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null, groupId: null, clipTo: null };
    merged.thumb = makeThumb(merged);
    const pickedIds = new Set(picked.map((l) => l.id));
    const top = Math.max(...picked.map((l) => a.indexOf(l)));
    const at = top - picked.filter((l) => a.indexOf(l) < top).length;
    layersRef.current = a.filter((l) => !pickedIds.has(l.id));
    layersRef.current.splice(at, 0, merged);
    for (const id of pickedIds) releaseClips(layersRef.current, id);
    selectOnly(merged.id); markDirty(); refresh(); render();
  };
  const ungroupSelected = () => { const groups = new Set(layersRef.current.filter((l) => selectedIdsRef.current.includes(l.id)).map((l) => l.groupId).filter(Boolean)); if (!groups.size) return; layersRef.current.forEach((l) => { if (l.groupId && groups.has(l.groupId)) l.groupId = null; }); markDirty(); refresh(); render(); };
  const commitLayerRename = () => { const l = layersRef.current.find((x) => x.id === renamingLayerId); if (l && renamingLayerValue.trim()) { l.name = renamingLayerValue.trim(); markDirty(); refresh(); } setRenamingLayerId(null); };
  const canvasRatio = (() => { const r = doc.w / doc.h; return Math.abs(r - 1) < .01 ? "1:1" : Math.abs(r - .8) < .01 ? "4:5" : Math.abs(r - 9 / 16) < .01 ? "9:16" : Math.abs(r - 16 / 9) < .01 ? "16:9" : "custom"; })();
  const resizeCanvasToRatio = (ratio: string) => {
    const map: Record<string, [number, number]> = { "1:1": [1, 1], "4:5": [4, 5], "9:16": [9, 16], "16:9": [16, 9] };
    const pair = map[ratio]; if (!pair) return; const [rw, rh] = pair, long = Math.max(doc.w, doc.h);
    const nextW = rw >= rh ? long : Math.round(long * rw / rh), nextH = rh >= rw ? long : Math.round(long * rh / rw);
    const dx = (nextW - doc.w) / 2, dy = (nextH - doc.h) / 2;
    layersRef.current.forEach((l) => { l.cx += dx; l.cy += dy; }); setDoc({ w: nextW, h: nextH }); markDirty(); refresh();
  };
  /* ---------- background replacement (pick from library) ---------- */
  const replaceBackground = useCallback(async (url: string) => {
    const im = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    if (!im) return;
    const c = document.createElement("canvas"); c.width = doc.w; c.height = doc.h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const s = Math.max(doc.w / im.naturalWidth, doc.h / im.naturalHeight); // cover
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (doc.w - w) / 2, (doc.h - h) / 2, w, h);
    // 圖的比例跟畫布一樣才存網址；不一樣的話畫面上是裁過的，存網址的話重開會被拉扁，所以存裁好的這張
    const sameRatio = Math.abs(im.naturalWidth / im.naturalHeight - doc.w / doc.h) < 0.01;
    let bg = layersRef.current.find((l) => l.type === "background");
    if (!bg) {
      // 空白畫布還沒有背景：新增一層放在最底下
      bg = { id: `bg_${crypto.randomUUID().slice(0, 8)}`, name: "背景", type: "background", semanticId: "background", instanceId: null, confidence: 1, editable: true, source: "generated", isText: false, text: "", color: "#000", fontSize: 24, fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700, align: "center", shape: null, canvas: null, naturalW: doc.w, naturalH: doc.h, src: null, cx: doc.w / 2, cy: doc.h / 2, w: doc.w, h: doc.h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null };
      layersRef.current.unshift(bg);
    }
    bg.canvas = c; bg.src = sameRatio ? url : null; bg.naturalW = doc.w; bg.naturalH = doc.h; bg.w = doc.w; bg.h = doc.h; bg.cx = doc.w / 2; bg.cy = doc.h / 2; bg.visible = true; bg.thumb = makeThumb(bg);
    markDirty(); render(); refresh();
  }, [doc.w, doc.h, render, refresh]);

  /* ---------- add a product (upload -> cut out -> new layer) ---------- */
  const addProduct = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || adding) return;
    setAdding(true);
    try {
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      const resp = await fetch("/api/magic-layers/cutout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl: dataUrl }) });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error ?? resp.statusText);
      const canvas = await loadToCanvas(d.url);
      if (!canvas) throw new Error("讀取去背圖失敗");
      // fit the cut-out into ~45% of the canvas, centred
      const ar = canvas.width / canvas.height;
      let w = doc.w * 0.45, h = w / ar;
      if (h > doc.h * 0.55) { h = doc.h * 0.55; w = h * ar; }
      const el: EL = {
        id: "product_add_" + Math.floor(view.current.panX + layersRef.current.length + doc.w),
        name: "產品 " + (layersRef.current.filter((l) => l.type === "product").length + 1),
        type: "product", semanticId: "product", instanceId: null,
        confidence: 1, editable: true, source: "segmented",
        isText: false, text: "", color: "#241f47", fontSize: 24, fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700, align: "center",
        shape: null, canvas, naturalW: canvas.width, naturalH: canvas.height, src: d.url,
        cx: doc.w / 2, cy: doc.h / 2, w, h, rotation: 0,
        visible: true, locked: false, opacity: 1,
        embeddedText: [], thumb: null,
      };
      el.thumb = makeThumb(el);
      layersRef.current.push(el);        // top of stack
      selectOnly(el.id); markDirty(); refresh(); render();
    } catch (err) { alert("加入產品失敗：" + (err instanceof Error ? err.message : String(err))); }
    finally { setAdding(false); }
  }, [adding, doc.w, doc.h, refresh, render]);

  /* ---------- cut out an existing image layer ---------- */
  // 生成的素材是白底 JPG（文字生圖拿不到透明底），放到有色背景上就會看到白方塊。
  // 這裡沿用「加入產品」那支去背 API，差別是對畫布上已經有的圖層做。
  // 做成按鈕而不是自動執行：去背是要付費的，什麼時候花錢該由使用者決定。
  const cutoutSelected = useCallback(async () => {
    const target = layersRef.current.find((l) => l.id === selectedIdsRef.current[0]);
    if (!target || target.isText || !target.canvas || adding) return;
    setAdding(true);
    try {
      const resp = await fetch("/api/magic-layers/cutout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: target.canvas.toDataURL("image/png") }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error ?? resp.statusText);
      const canvas = await loadToCanvas(d.url);
      if (!canvas) throw new Error("讀取去背圖失敗");
      // 只換圖，不動位置與尺寸——使用者已經排好的版不該因為去背而跑掉。
      target.canvas = canvas;
      target.naturalW = canvas.width;
      target.naturalH = canvas.height;
      target.src = d.url;
      target.thumb = makeThumb(target);
      markDirty(); refresh(); render();
    } catch (err) {
      alert("去背失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally { setAdding(false); }
  }, [adding, refresh, render]);

  /* ---------- insert tools: image / upload / text / logo ---------- */
  const FONT = "'Noto Sans TC',system-ui,sans-serif";
  // 插入一張圖片圖層（不去背）：素材庫 / 上傳圖片 / Logo 共用
  const pushImageLayer = useCallback(async (url: string, nm: string, type: "object" | "product" = "object", at?: { cx: number; cy: number }) => {
    const canvas = await loadToCanvas(url);
    if (!canvas) { alert("讀取圖片失敗"); return; }
    const ar = canvas.width / (canvas.height || 1);
    let w = doc.w * 0.4, h = w / ar;
    if (h > doc.h * 0.5) { h = doc.h * 0.5; w = h * ar; }
    const el: EL = {
      id: "img_" + Math.floor(view.current.panX + layersRef.current.length + doc.w + Math.abs(canvas.width)),
      name: nm, type, semanticId: type, instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: false, text: "", color: "#241f47", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center",
      shape: null, canvas, naturalW: canvas.width, naturalH: canvas.height, src: url,
      cx: at ? at.cx : doc.w / 2, cy: at ? at.cy : doc.h / 2, w, h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null,
    };
    el.thumb = makeThumb(el); layersRef.current.push(el); selectOnly(el.id); markDirty(); refresh(); render();
  }, [doc.w, doc.h, markDirty, refresh, render]);

  // 上傳圖片（不去背）→ 先存到 /uploads 拿持久 URL → 圖層
  const onUploadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error ?? "上傳失敗");
      await pushImageLayer(d.url, "圖片");
    } catch (err) { alert("上傳失敗：" + (err instanceof Error ? err.message : String(err))); }
  }, [pushImageLayer]);

  // 加一個文字圖層
  const addTextLayer = useCallback(() => {
    const w = Math.round(doc.w * 0.6), h = Math.round(doc.h * 0.09);
    const el: EL = {
      id: "text_" + Math.floor(view.current.panX + layersRef.current.length + doc.h),
      name: "新文字", type: "independent_text", semanticId: "text", instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: true, text: "新文字", color: "#241f47", fontSize: Math.round(h * 0.7), fontFamily: FONT, fontWeight: 700, align: "center",
      shape: null, canvas: null, naturalW: w, naturalH: h, src: null,
      cx: doc.w / 2, cy: doc.h / 2, w, h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null,
    };
    el.thumb = makeThumb(el); layersRef.current.push(el); selectOnly(el.id); markDirty(); refresh(); render();
  }, [doc.w, doc.h, markDirty, refresh, render]);

  // 向量圖層（形狀 / 線條 / 圖標）——畫在 canvas，可改色，不烤成點陣
  /**
   * 把鋼筆畫好的路徑變成一個形狀圖層。節點換算成「相對於圖層中心、佔寬高的比例」，
   * 之後放大縮小整個形狀會跟著等比變化。範圍把把手也算進去（曲線一定落在節點＋把手圍起來的範圍內）。
   * 封閉的預設紫色填色；沒封閉的是一條深色線。
   */
  const finishPen = useCallback((closed: boolean) => {
    const pen = penRef.current; penRef.current = null;
    setTool("select");
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
    if (!pen || pen.pts.length < 2) { render(); return; }
    const isClosed = closed && pen.pts.length >= 3;
    const xs: number[] = [], ys: number[] = [];
    for (const p of pen.pts) {
      xs.push(p.x); ys.push(p.y);
      if (p.ix != null) { xs.push(p.x + p.ix); ys.push(p.y + (p.iy ?? 0)); }
      if (p.ox != null) { xs.push(p.x + p.ox); ys.push(p.y + (p.oy ?? 0)); }
    }
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(4, maxX - minX), h = Math.max(4, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const points = pen.pts.map((p) => ({
      x: (p.x - cx) / w, y: (p.y - cy) / h,
      ...(p.ix != null ? { ix: p.ix / w, iy: (p.iy ?? 0) / h } : {}),
      ...(p.ox != null ? { ox: p.ox / w, oy: (p.oy ?? 0) / h } : {}),
    }));
    const shape: ShapeSpec = isClosed
      ? { kind: "path", points, closed: true, fill: "#7c3aed", stroke: "none", strokeWidth: 0 }
      : { kind: "path", points, closed: false, fill: "none", stroke: "#1f2937", strokeWidth: 4 };
    const el: EL = {
      id: `path_${crypto.randomUUID().slice(0, 8)}`, name: isClosed ? "鋼筆形狀" : "鋼筆線條", type: "decoration", semanticId: "decoration", instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: false, text: "", color: "#241f47", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center",
      shape, canvas: null, naturalW: w, naturalH: h, src: null,
      cx, cy, w, h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null,
    };
    el.thumb = makeThumb(el); layersRef.current.push(el); selectOnly(el.id); markDirty(); refresh(); render();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectOnly 只碰 ref 與 setState，跟 pushShapeLayer 一樣不列
  }, [markDirty, refresh, render]);
  useEffect(() => { finishPenRef.current = finishPen; }, [finishPen]);

  /**
   * 放開滑鼠：把這一筆平滑、簡化成向量路徑，變成一個「繪製」圖層（跟鋼筆一樣以寬高比例存節點）。
   * 範圍外擴半個筆寬，選取框才包得住整條線。只點一下也算一筆（畫成一個點）。
   */
  const finishStroke = useCallback(() => {
    const raw = strokeRef.current; strokeRef.current = null;
    if (!raw || !raw.length) { render(); return; }
    const cfg = drawCfgRef.current;
    let pts = smoothStroke(raw, cfg.smooth, view.current.zoom);
    if (pts.length === 1) pts = [pts[0], { x: pts[0].x + 0.01, y: pts[0].y }];
    // 先選了一張圖片：這一筆屬於那張圖片（存在它身上），不另外長出圖層
    const target = paintTarget(layersRef.current, selectedIdsRef.current, cfg.bind);
    if (target) {
      const st = strokeToPaint(pts, (x, y) => docToLayer(target, x, y), target.w, target.h, cfg);
      target.paint = [...(target.paint ?? []), st];
      target.thumb = makeThumb(target); markDirty(); refresh(); render();
      return;
    }
    const xs: number[] = [], ys: number[] = [];
    for (const p of pts) {
      xs.push(p.x); ys.push(p.y);
      if (p.ix != null) { xs.push(p.x + p.ix); ys.push(p.y + (p.iy ?? 0)); }
      if (p.ox != null) { xs.push(p.x + p.ox); ys.push(p.y + (p.oy ?? 0)); }
    }
    const pad = cfg.width / 2 + 1;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const w = Math.max(2, maxX - minX), h = Math.max(2, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const points = pts.map((p) => ({
      x: (p.x - cx) / w, y: (p.y - cy) / h,
      ...(p.ix != null ? { ix: p.ix / w, iy: (p.iy ?? 0) / h } : {}),
      ...(p.ox != null ? { ox: p.ox / w, oy: (p.oy ?? 0) / h } : {}),
    }));
    const el: EL = {
      id: `draw_${crypto.randomUUID().slice(0, 8)}`, name: "繪製", type: "drawing", semanticId: "decoration", instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: false, text: "", color: cfg.color, fontSize: 24, fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700, align: "center",
      shape: { kind: "path", points, closed: false, fill: "none", stroke: cfg.color, strokeWidth: cfg.width }, canvas: null, naturalW: w, naturalH: h, src: null,
      cx, cy, w, h, rotation: 0, visible: true, locked: false, opacity: cfg.opacity, embeddedText: [], thumb: null,
    };
    el.thumb = makeThumb(el); layersRef.current.push(el); markDirty(); refresh(); render();
  }, [markDirty, refresh, render]);
  useEffect(() => { finishStrokeRef.current = finishStroke; }, [finishStroke]);
  const exitDraw = useCallback(() => {
    strokeRef.current = null; setTool("select");
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
    render();
  }, [render]);
  const pushShapeLayer = useCallback((shape: ShapeSpec, nm: string, w: number, h: number) => {
    const el: EL = {
      id: "shape_" + Math.floor(view.current.panX + layersRef.current.length + doc.w + (shape.icon ? shape.icon.length : shape.kind.length)),
      name: nm, type: "decoration", semanticId: "decoration", instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: false, text: "", color: "#241f47", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center",
      shape, canvas: null, naturalW: w, naturalH: h, src: null,
      cx: doc.w / 2, cy: doc.h / 2, w, h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null,
    };
    el.thumb = makeThumb(el); layersRef.current.push(el); selectOnly(el.id); markDirty(); refresh(); render();
  }, [doc.w, doc.h, markDirty, refresh, render]);
  const addShapeKind = useCallback((spec: Partial<ShapeSpec> & { kind: ShapeKind }, label: string) => {
    setShowShape(false);
    const s = Math.round(Math.min(doc.w, doc.h) * 0.3);
    pushShapeLayer({ fill: "#7c3aed", stroke: "none", strokeWidth: 0, ...spec, radius: roundedRadius(spec, s) ?? 0 }, label, s, s);
  }, [doc.w, doc.h, pushShapeLayer]);
  const addShape = useCallback(() => setShowShape(true), []);
  const addLine = useCallback(() => {
    pushShapeLayer({ kind: "line", fill: "none", stroke: "#1f2937", strokeWidth: 6 }, "線條", Math.round(doc.w * 0.4), 24);
  }, [doc.w, pushShapeLayer]);
  const addIcon = useCallback((icon: string) => {
    setShowIcon(false);
    const s = Math.round(Math.min(doc.w, doc.h) * 0.16);
    pushShapeLayer({ kind: "icon", icon, fill: "#1f2937", stroke: "none", strokeWidth: 0 }, "圖標", s, s);
  }, [doc.w, doc.h, pushShapeLayer]);

  // Logo：開選擇器（同微調畫布的放置標誌）——挑品牌 logo 版本，或直接上傳一個
  const addLogo = useCallback(() => setShowLogo(true), []);
  const onUploadLogo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setShowLogo(false);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error ?? "上傳失敗");
      await pushImageLayer(d.url, "Logo");
    } catch (err) { alert("上傳失敗：" + (err instanceof Error ? err.message : String(err))); }
  }, [pushImageLayer]);

  /* ---------- save / export (flatten + serialize) ---------- */
  // Flatten the doc to a full-res PNG (deliverable + 素材庫 image). Mirrors render()
  // minus pan/zoom/selection, drawn at document coordinates.
  const flattenLayersToDataUrl = useCallback((keep: (l: EL) => boolean) => {
    const c = document.createElement("canvas");
    c.width = doc.w; c.height = doc.h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, doc.w, doc.h);
    for (const l of layersRef.current) {
      if (!l.visible || !keep(l)) continue;
      ctx.save();
      applyClip(ctx, l, layersRef.current);
      applyLayerTransform(ctx, l); ctx.globalAlpha = l.opacity;
      drawElBody(ctx, l);
      ctx.restore();
    }
    try { return c.toDataURL("image/png"); } catch { return ""; }
  }, [doc.w, doc.h]);
  const flattenToDataUrl = useCallback(() => flattenLayersToDataUrl(() => true), [flattenLayersToDataUrl]);

  // 擴圖要餵「場景背景」，不能餵含文字與白色留邊的完成稿；否則模型會把白邊當成要延伸的內容。
  const outpaintSourceToDataUrl = useCallback(() => {
    const bg = layersRef.current.find((l) => l.type === "background" && l.visible && l.canvas);
    if (!bg?.canvas) return flattenToDataUrl();
    const c = document.createElement("canvas"); c.width = doc.w; c.height = doc.h;
    const g = c.getContext("2d")!;
    // 背景語意即 full-bleed；擴圖時先還原成滿版場景，文字／產品之後仍由原圖層疊回。
    g.drawImage(bg.canvas, 0, 0, doc.w, doc.h);
    // 生成式填色補過的那幾塊也是背景的一部分，要一起畫進去，不然擴圖後修過的地方會不見
    for (const l of layersRef.current) {
      if (l === bg || l.type !== "background" || !l.visible || !l.canvas) continue;
      g.save(); applyLayerTransform(g, l); g.globalAlpha = l.opacity;
      g.drawImage(l.canvas, -l.w / 2, -l.h / 2, l.w, l.h); g.restore();
    }
    return c.toDataURL("image/png");
  }, [doc.w, doc.h, flattenToDataUrl]);

  const buildMagicFillInput = useCallback(() => {
    const bg = layersRef.current.find((l) => l.type === "background" && l.visible && l.canvas);
    if (!bg?.canvas) throw new Error("找不到可延伸的背景圖層");
    const c = document.createElement("canvas"); c.width = doc.w; c.height = doc.h; const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, doc.w, doc.h); g.save(); g.translate(bg.cx, bg.cy); g.rotate(bg.rotation); g.drawImage(bg.canvas, -bg.w / 2, -bg.h / 2, bg.w, bg.h); g.restore();
    const data = g.getImageData(0, 0, doc.w, doc.h), mask = document.createElement("canvas"); mask.width = doc.w; mask.height = doc.h;
    const mg = mask.getContext("2d")!, out = mg.createImageData(doc.w, doc.h), seen = new Uint8Array(doc.w * doc.h), queue = new Int32Array(doc.w * doc.h); let head = 0, tail = 0;
    const blank = (i: number) => data.data[i * 4 + 3] < 16 || (data.data[i * 4] > 242 && data.data[i * 4 + 1] > 242 && data.data[i * 4 + 2] > 242);
    const add = (i: number) => { if (!seen[i] && blank(i)) { seen[i] = 1; queue[tail++] = i; } };
    for (let x = 0; x < doc.w; x++) { add(x); add((doc.h - 1) * doc.w + x); } for (let y = 0; y < doc.h; y++) { add(y * doc.w); add(y * doc.w + doc.w - 1); }
    while (head < tail) { const i = queue[head++], x = i % doc.w, y = Math.floor(i / doc.w); if (x) add(i - 1); if (x + 1 < doc.w) add(i + 1); if (y) add(i - doc.w); if (y + 1 < doc.h) add(i + doc.w); }
    let pixels = 0; for (let i = 0; i < seen.length; i++) { const v = seen[i] ? 255 : 0; if (v) pixels++; out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
    if (pixels < doc.w * doc.h * .005) throw new Error("畫布邊緣沒有偵測到可補的空白區域"); mg.putImageData(out, 0, 0);
    return { imageDataUrl: c.toDataURL("image/png"), maskDataUrl: mask.toDataURL("image/png") };
  }, [doc.w, doc.h]);

  const generateMagicFill = useCallback(async () => {
    if (magicFillBusy) return; setMagicFillBusy(true); setMagicFillResult(null);
    try { const input = buildMagicFillInput(); const r = await fetch("/api/magic-layers/magic-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, variants: 2 }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "補空白失敗"); setMagicFillResult(d.variants); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); setMagicFillResult(null); }
    finally { setMagicFillBusy(false); }
  }, [magicFillBusy, buildMagicFillInput]);

  const applyMagicFill = useCallback(async (url: string) => {
    const canvas = await loadToCanvas(url); if (!canvas) return;
    layersRef.current.forEach((l) => { if (l.type === "background") l.visible = false; });
    const bg: EL = { id: `magic_fill_${Date.now()}`, name: "魔術棒延伸背景", type: "background", semanticId: "background", instanceId: null, confidence: 1, editable: true, source: "generated", isText: false, text: "", color: "#000", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center", shape: null, canvas, naturalW: canvas.width, naturalH: canvas.height, src: url, cx: doc.w / 2, cy: doc.h / 2, w: doc.w, h: doc.h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null };
    bg.thumb = makeThumb(bg); layersRef.current.unshift(bg); setMagicFillResult(null); selectOnly(bg.id); markDirty(); refresh(); render();
  }, [doc.w, doc.h, markDirty, refresh, render]);

  /**
   * 把樣式套到目前選起來的字上。
   *
   * 區間會重疊（使用者可能先放大三個字、再只把中間那個換色），所以先把跟新
   * 區間相交的舊區間切開，再把新的疊上去；drawRunText 讀的時候後定義的優先。
   */
  const applyRunStyle = useCallback((patch: Partial<TextRun>) => {
    if (!editingText || !textSel) return;
    const target = layersRef.current.find((x) => x.id === editingText.id);
    if (!target) return;
    const { start, end } = textSel;
    const kept: TextRun[] = [];
    for (const r of target.runs ?? []) {
      if (r.end <= start || r.start >= end) { kept.push(r); continue; }
      if (r.start < start) kept.push({ ...r, end: start });
      if (r.end > end) kept.push({ ...r, start: end });
    }
    const existing = (target.runs ?? []).find((r) => r.start <= start && r.end >= end);
    kept.push({ ...(existing ?? {}), start, end, ...patch });
    target.runs = kept.sort((a, b) => a.start - b.start);
    target.thumb = makeThumb(target);
    markDirty(); render(); refresh();
  }, [editingText, textSel, markDirty, render, refresh]);

  const PREVIEW_ID = "genfill_preview";

  /**
   * 把某個版本直接套上畫布預覽。
   *
   * 不用彈窗列縮圖給使用者挑——那樣要瞇著眼睛比對小圖。改成直接蓋在畫布上，
   * 用 ‹ › 原地切換，看到滿意的再按完成。
   *
   * 只裁出框選的那一塊，當成一個新圖層插在背景正上方；其他圖層一個都不動，
   * 字、產品、色塊都還能改。邊緣做一點柔化，接縫才不會看出一條線。
   * 圖存的是裁好的像素（src 留空，存檔時會轉成圖檔），不能存模型回傳的整張圖網址——
   * 下次打開時整張圖會被擠進這一小塊。
   */
  const previewGenFill = useCallback(async (url: string) => {
    const target = genFillTarget.current; if (!target) return;
    const full = await loadToCanvas(url); if (!full) return;
    const { box } = target;
    const sx = full.width / doc.w, sy = full.height / doc.h;
    const patch = document.createElement("canvas");
    patch.width = Math.max(1, Math.round(box.w * sx)); patch.height = Math.max(1, Math.round(box.h * sy));
    const pg = patch.getContext("2d")!;
    pg.drawImage(full, box.x * sx, box.y * sy, box.w * sx, box.h * sy, 0, 0, patch.width, patch.height);
    const f = Math.max(2, Math.min(16, Math.round(Math.min(patch.width, patch.height) * 0.06)));
    pg.globalCompositeOperation = "destination-in";
    for (const [x1, y1] of [[patch.width, 0], [0, patch.height]] as const) {
      const g = pg.createLinearGradient(0, 0, x1, y1), len = x1 || y1;
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(f / len, "#000"); g.addColorStop(1 - f / len, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
      pg.fillStyle = g; pg.fillRect(0, 0, patch.width, patch.height);
    }
    pg.globalCompositeOperation = "source-over";

    const existing = layersRef.current.find((l) => l.id === PREVIEW_ID);
    if (existing) {
      existing.canvas = patch; existing.naturalW = patch.width; existing.naturalH = patch.height; existing.thumb = makeThumb(existing);
    } else {
      const el: EL = { id: PREVIEW_ID, name: "生成式填色", type: "background", semanticId: "background", instanceId: null, confidence: 1, editable: true, source: "generated", isText: false, text: "", color: "#000", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center", shape: null, canvas: patch, naturalW: patch.width, naturalH: patch.height, src: null, cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, h: box.h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null };
      el.thumb = makeThumb(el);
      const at = target.afterId ? layersRef.current.findIndex((l) => l.id === target.afterId) + 1 : layersRef.current.length;
      layersRef.current.splice(at > 0 ? at : layersRef.current.length, 0, el);
    }
    refresh(); render();
  }, [doc.w, doc.h, refresh, render]);

  /** 留下目前預覽的版本。 */
  const commitGenFill = useCallback(() => {
    const l = layersRef.current.find((x) => x.id === PREVIEW_ID);
    if (l) l.id = `genfill_${Date.now()}`;
    genFillTarget.current = null;
    setGenFillResult(null); setGenFillIndex(0); setMarquee(null); marqueeRef.current = null;
    setGenFillPrompt(""); setTool("select");
    if (l) selectOnly(l.id);
    markDirty(); refresh(); render();
  }, [markDirty, refresh, render, selectOnly]);

  /** 丟掉預覽，畫面回到按生成之前。 */
  const cancelGenFill = useCallback(() => {
    layersRef.current = layersRef.current.filter((l) => l.id !== PREVIEW_ID);
    genFillTarget.current = null;
    setGenFillResult(null); setGenFillIndex(0);
    refresh(); render();
  }, [refresh, render]);

  /**
   * 生成式填色：只重畫框選的那一塊。
   *
   * 來源是整張攤平的畫布（模型要看得到周圍才接得起來），遮罩則只有框選區是白的。
   * 沒填字就是「把這塊接回周圍的場景」＝移除東西；填了字就是在那塊畫指定的內容。
   */
  const generateFillInMarquee = useCallback(async (mode: "fill" | "remove") => {
    if (!marquee || genFillBusy) return;
    setGenFillBusy(true); setGenFillResult(null);
    try {
      const m = document.createElement("canvas"); m.width = doc.w; m.height = doc.h;
      const mg = m.getContext("2d")!;
      mg.fillStyle = "#000"; mg.fillRect(0, 0, doc.w, doc.h);
      mg.fillStyle = "#fff"; mg.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      // 只把背景送去修：字、產品、色塊留在自己的圖層上，不能被烤進補好的那一塊。
      // 沒有背景層（例如空白畫布直接貼圖）才退回整張壓平，補好的那塊放最上層。
      const scene = layersRef.current.filter((l) => l.visible && l.type === "background" && l.id !== PREVIEW_ID);
      genFillTarget.current = { box: { ...marquee }, afterId: scene.length ? scene[scene.length - 1].id : null };
      const source = scene.length ? flattenLayersToDataUrl((l) => l.type === "background" && l.id !== PREVIEW_ID) : flattenToDataUrl();
      const r = await fetch("/api/magic-layers/magic-fill", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: source, maskDataUrl: m.toDataURL("image/png"), prompt: mode === "fill" ? genFillPrompt.trim() || undefined : undefined, mode, variants: 2 }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "生成失敗");
      setGenFillResult(d.variants); setGenFillIndex(0);
      if (d.variants?.[0]) await previewGenFill(d.variants[0]);
    } catch (e) { alert("生成式填色失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setGenFillBusy(false); }
  }, [marquee, genFillBusy, doc.w, doc.h, flattenToDataUrl, flattenLayersToDataUrl, genFillPrompt, previewGenFill]);

  const generateOutpaint = useCallback(async () => {
    if (outpaintBusy) return; setOutpaintBusy(true); setOutpaintResult(null);
    try {
      const r = await fetch("/api/magic-layers/outpaint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl: outpaintSourceToDataUrl(), width: doc.w, height: doc.h, ratio: outpaintRatio, direction: outpaintDirection, mode: outpaintMode, variants: outpaintCount }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "擴圖失敗"); setOutpaintResult(d);
    } catch (e) { alert("擴圖失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setOutpaintBusy(false); }
  }, [outpaintBusy, outpaintSourceToDataUrl, doc.w, doc.h, outpaintRatio, outpaintDirection, outpaintMode, outpaintCount]);

  const applyOutpaint = useCallback(async (url: string) => {
    if (!outpaintResult) return; const canvas = await loadToCanvas(url); if (!canvas) return;
    layersRef.current.forEach((l) => { if (l.type === "background") l.visible = false; else { l.cx += outpaintResult.offsetX; l.cy += outpaintResult.offsetY; } });
    const bg: EL = { id: `outpaint_${Date.now()}`, name: `擴展背景 ${outpaintRatio}`, type: "background", semanticId: "background", instanceId: null, confidence: 1, editable: true, source: "generated", isText: false, text: "", color: "#000", fontSize: 24, fontFamily: FONT, fontWeight: 700, align: "center", shape: null, canvas, naturalW: canvas.width, naturalH: canvas.height, src: url, cx: outpaintResult.targetW / 2, cy: outpaintResult.targetH / 2, w: outpaintResult.targetW, h: outpaintResult.targetH, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null };
    bg.thumb = makeThumb(bg); layersRef.current.unshift(bg); setDoc({ w: outpaintResult.targetW, h: outpaintResult.targetH }); setShowOutpaint(false); setOutpaintResult(null); selectOnly(bg.id); markDirty(); refresh();
  }, [outpaintResult, outpaintRatio, markDirty, refresh]);

  const serializeLayers = useCallback((): SavedLayer[] => serializeEls(layersRef.current), []);

  /* ---------- 範本庫（共用，1:1） ---------- */

  const loadTemplates = useCallback(async () => {
    try {
      const r = await fetch("/api/magic-layers/templates");
      const d = await r.json();
      setTemplates(Array.isArray(d.templates) ? d.templates : []);
    } catch { /* 列不出來就當沒有，不要擋住編輯器 */ }
  }, []);

  // 用 timeout 把抓清單推到 effect 的同步階段之外：直接在 effect 裡呼叫，
  // lint 會判定成「在 effect 裡同步 setState」，而那條規則這個檔案本來就在守。
  useEffect(() => {
    const t = setTimeout(() => { void loadTemplates(); }, 0);
    return () => clearTimeout(t);
  }, [loadTemplates]);

  /**
   * 把存起來的一個圖層還原成畫布上的圖層。
   *
   * 跟掛載時那段還原邏輯同一套規則，特別是「框是排版位置、不是圖片尺寸」——
   * 直接把圖拉去填滿框會變形，所以依原比例縮到框內；背景例外，它本來就要滿版。
   */
  const elFromSavedLayer = useCallback(async (sl: SavedLayer): Promise<EL> => {
    const isText = !!sl.isText;
    const canvas = !isText && sl.image ? await loadToCanvas(sl.image) : null;
    let boxW = sl.w, boxH = sl.h;
    if (canvas && sl.type !== "background" && canvas.width > 0 && canvas.height > 0) {
      const scale = Math.min(sl.w / canvas.width, sl.h / canvas.height);
      boxW = Math.round(canvas.width * scale);
      boxH = Math.round(canvas.height * scale);
    }
    const el: EL = {
      id: `${sl.id}_${Math.random().toString(36).slice(2, 7)}`,   // 同一個範本可以套多次，id 不能撞
      name: sl.name, type: sl.type, semanticId: sl.type === "independent_text" ? "text" : sl.type,
      instanceId: null, confidence: 1, editable: true, source: "generated",
      isText, text: sl.text ?? "", color: sl.color ?? "#111",
      fontSize: sl.fontSize ?? 32, fontFamily: sl.fontFamily ?? FONT, fontWeight: sl.fontWeight ?? 700,
      align: sl.align ?? "center", fx: sl.fx ?? null, textLayout: sl.textLayout,
      shape: (sl.shape as ShapeSpec | undefined) ?? null,
      canvas, naturalW: canvas?.width ?? sl.w, naturalH: canvas?.height ?? sl.h,
      src: sl.image ?? null,
      cx: sl.x + sl.w / 2, cy: sl.y + sl.h / 2, w: boxW, h: boxH,
      rotation: sl.rotation ?? 0, visible: sl.visible !== false, locked: !!sl.locked,
      opacity: sl.opacity ?? 1, embeddedText: [], thumb: null, groupId: sl.groupId ?? null, clipTo: sl.clipTo ?? null,
      skewX: sl.skewX ?? 0, skewY: sl.skewY ?? 0,
      ...(sl.paint?.length ? { paint: sl.paint } : {}),
      ...(sl.glow ? { glow: sl.glow } : {}),
    };
    el.thumb = makeThumb(el);
    return el;
  }, []);

  /* ---------- 多頁（像 Canva 的頁面） ----------
     目前這一頁的圖層、尺寸、復原紀錄照舊放在 layersRef／doc／history；
     切換頁面時把目前這頁收進 pagesRef，再把要去的那頁拿出來。
     每一頁有自己的復原紀錄：在第 2 頁按復原不會把第 1 頁的東西改回去。 */
  const pagesRef = useRef<EditorPage[]>([]);
  const pageIdxRef = useRef(0);
  const [pageIdx, setPageIdx] = useState(0);
  /** 縮圖列要顯示的東西（不在 render 裡讀 ref）。 */
  const [pagesView, setPagesView] = useState<{ id: string; name: string; thumb: string | null; w: number; h: number }[]>([]);
  const [curThumb, setCurThumb] = useState<string | null>(null);
  const syncPagesView = useCallback(() => setPagesView(pagesRef.current.map((p) => ({ id: p.id, name: p.name, thumb: p.thumb, w: p.w, h: p.h }))), []);

  // 第一次掛載：第 1 頁就是目前的畫布；其他頁在背景轉回圖層、算好縮圖
  useEffect(() => {
    const first: EditorPage = { id: "page-1", name: firstPageName ?? "", w: image.naturalWidth, h: image.naturalHeight, els: null, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: null };
    const rest: EditorPage[] = (extraPages ?? []).map((pg, i) => {
      const page: EditorPage = { id: `page-${i + 2}`, name: pg.name ?? "", w: pg.docW, h: pg.docH, els: null, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: null };
      page.loading = Promise.all(pg.layers.map(elFromSavedLayer)).then((els) => {
        const idMap = new Map(pg.layers.map((sl, k) => [sl.id, els[k].id]));
        for (const e of els) if (e.clipTo) e.clipTo = idMap.get(e.clipTo) ?? null;
        page.els = els; page.thumb = flattenEls(els, page.w, page.h, PAGE_THUMB);
        return els;
      });
      return page;
    });
    pagesRef.current = [first, ...rest];
    Promise.all(rest.map((p) => p.loading)).then(syncPagesView);
    const t = setTimeout(syncPagesView, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在掛載時建立一次
  }, []);
  useEffect(() => { pageIdxRef.current = pageIdx; }, [pageIdx]);
  // 目前這頁的縮圖：改完停一下再算，不要每動一下就重畫
  useEffect(() => {
    const t = setTimeout(() => setCurThumb(flattenEls(layersRef.current, doc.w, doc.h, PAGE_THUMB)), 400);
    return () => clearTimeout(t);
  }, [histTick, doc.w, doc.h]);

  /** 把目前這頁（畫布上的）收回 pagesRef。 */
  const stashCurrentPage = useCallback(() => {
    const p = pagesRef.current[pageIdxRef.current]; if (!p) return;
    p.els = layersRef.current; p.w = docRef.current.w; p.h = docRef.current.h;
    p.history = history.current; p.histIdx = histIdx.current; p.savedIdx = savedIdx.current;
    p.thumb = flattenEls(p.els, p.w, p.h, PAGE_THUMB);
    if (p.histIdx !== p.savedIdx) setPagesChanged(true);
  }, []);
  /** 把第 i 頁放上畫布（不先收目前這頁，呼叫的人自己決定）。 */
  const activatePage = useCallback(async (i: number) => {
    const p = pagesRef.current[i]; if (!p) return;
    const els = p.els ?? (p.loading ? await p.loading : []);
    p.els = els;
    layersRef.current = els;
    if (p.history.length) { history.current = p.history; histIdx.current = p.histIdx; savedIdx.current = p.savedIdx; }
    else { history.current = [els.map(cloneEL)]; histIdx.current = 0; savedIdx.current = 0; }
    pageIdxRef.current = i; setPageIdx(i);
    applySelection([]); setDoc({ w: p.w, h: p.h }); setCurThumb(p.thumb);
    syncPagesView(); bump(); refresh(); render();
    requestAnimationFrame(() => fitRef.current());
  }, [syncPagesView, bump, refresh, render]);
  const goToPage = useCallback((i: number) => {
    if (i === pageIdxRef.current) return;
    stashCurrentPage(); void activatePage(i);
  }, [stashCurrentPage, activatePage]);
  /** 在目前這頁後面加一頁：空白（同尺寸），或把這一頁完整複製一份（做輪播最常用，風格一致）。 */
  const addPage = useCallback((duplicate: boolean) => {
    stashCurrentPage();
    const src = pagesRef.current[pageIdxRef.current];
    const els = duplicate && src.els ? duplicateEls(src.els) : [];
    const page: EditorPage = { id: `page-${crypto.randomUUID().slice(0, 8)}`, name: duplicate && src.name ? `${src.name} 複本` : "", w: src.w, h: src.h, els, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: flattenEls(els, src.w, src.h, PAGE_THUMB) };
    pagesRef.current.splice(pageIdxRef.current + 1, 0, page);
    setPagesChanged(true);
    void activatePage(pageIdxRef.current + 1);
  }, [stashCurrentPage, activatePage]);
  const deletePage = useCallback((i: number) => {
    const pages = pagesRef.current;
    if (pages.length <= 1 || !window.confirm(`刪除第 ${i + 1} 頁？（可以用復原以外的方式找回：只要還沒存檔，重新整理就會回到上次存的樣子）`)) return;
    const cur = pageIdxRef.current;
    if (i === cur) { pages.splice(i, 1); void activatePage(Math.min(i, pages.length - 1)); }
    else { stashCurrentPage(); pages.splice(i, 1); const next = i < cur ? cur - 1 : cur; pageIdxRef.current = next; setPageIdx(next); syncPagesView(); }
    setPagesChanged(true);
  }, [stashCurrentPage, activatePage, syncPagesView]);
  const renamePage = useCallback((i: number, nextName: string) => {
    const p = pagesRef.current[i]; if (!p || p.name === nextName.trim()) return;
    p.name = nextName.trim().slice(0, 40); setPagesChanged(true); syncPagesView();
  }, [syncPagesView]);
  const movePage = useCallback((from: number, to: number) => {
    if (from === to) return;
    stashCurrentPage();
    const pages = pagesRef.current, curId = pages[pageIdxRef.current].id;
    const [pg] = pages.splice(from, 1); pages.splice(to, 0, pg);
    const next = pages.findIndex((p) => p.id === curId);
    pageIdxRef.current = next; setPageIdx(next); setPagesChanged(true); syncPagesView();
  }, [stashCurrentPage, syncPagesView]);

  /** 套用範本：換掉整個畫布內容（可以用復原還原）。 */
  const applyTemplate = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/magic-layers/templates/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "讀取範本失敗");
      const tpl = d.template as { docW: number; docH: number; layers: SavedLayer[] };
      const els = await Promise.all(tpl.layers.map(elFromSavedLayer));
      // 套範本時每層都換了新 id（同一個範本可以套多次），遮色片指向的形狀 id 也要跟著換
      const idMap = new Map(tpl.layers.map((sl, i) => [sl.id, els[i].id]));
      for (const e of els) if (e.clipTo) e.clipTo = idMap.get(e.clipTo) ?? null;
      layersRef.current = els;
      setDoc({ w: tpl.docW, h: tpl.docH });
      applySelection([]); markDirty(); refresh(); render();
    } catch (e) { alert("套用範本失敗：" + (e instanceof Error ? e.message : String(e))); }
  }, [elFromSavedLayer, markDirty, refresh, render]);

  /** 把目前畫布存成共用範本，連同一張縮圖。 */
  const saveAsTemplate = useCallback(async () => {
    if (tplSaving) return;
    if (!layersRef.current.some((l) => l.visible)) { alert("空白畫布不能存成範本"); return; }
    const templateName = window.prompt("範本名稱", name || "未命名範本");
    if (templateName === null) return;
    setTplSaving(true);
    try {
      // 縮圖：攤平後縮到 480px，列表用不著原尺寸。
      const flat = flattenToDataUrl();
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = flat; });
      const tc = document.createElement("canvas"); tc.width = 480; tc.height = 480;
      tc.getContext("2d")!.drawImage(img, 0, 0, 480, 480);
      const r = await fetch("/api/magic-layers/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, docW: doc.w, docH: doc.h, layers: serializeLayers(), thumbnail: tc.toDataURL("image/png") }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "存成範本失敗");
      await loadTemplates();
    } catch (e) { alert("存成範本失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setTplSaving(false); }
  }, [tplSaving, doc.w, doc.h, flattenToDataUrl, serializeLayers, loadTemplates, name]);

  const deleteTemplate = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`刪除範本「${name}」？`)) return;
    try {
      const r = await fetch(`/api/magic-layers/templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "刪除失敗");
      await loadTemplates();
    } catch (e) { alert("刪除範本失敗：" + (e instanceof Error ? e.message : String(e))); }
  }, [loadTemplates]);

  const doSave = useCallback(async (download: boolean) => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      stashCurrentPage();
      const pages = pagesRef.current;
      // 還在背景轉換中的頁面先等它轉完
      const pageEls = await Promise.all(pages.map((p) => p.els ?? p.loading ?? Promise.resolve<EL[]>([])));
      const multi = pages.length > 1 || !!pages[0]?.name;
      // 第 1 頁放在原本的欄位（列表縮圖、舊版讀取都照舊）；多頁時另外帶上所有頁
      const firstEls = multi ? pageEls[0] : layersRef.current;
      const firstW = multi ? pages[0].w : doc.w, firstH = multi ? pages[0].h : doc.h;
      const imageDataUrl = multi ? flattenEls(firstEls, firstW, firstH) : flattenToDataUrl();
      const pagePayload = multi ? pages.map((p, i) => ({ docW: p.w, docH: p.h, layers: serializeEls(pageEls[i]), ...(p.name ? { name: p.name } : {}) })) : undefined;
      const pageImages = download && multi ? pages.map((p, i) => flattenEls(pageEls[i], p.w, p.h)) : undefined;
      await onSave({ docW: firstW, docH: firstH, layers: multi ? pagePayload![0].layers : serializeLayers(), imageDataUrl, finalize: download, pages: pagePayload, pageImages });
      savedIdx.current = histIdx.current;
      markPagesSaved(pages, pageIdxRef.current, histIdx.current);
      setPagesChanged(false);
      setSaved(true); bump(); setTimeout(() => setSaved(false), 2000);
      if (download) {
        const nameLayer = layersRef.current.find((l) => l.isText);
        const base = (nameLayer?.text || "magic-layout").slice(0, 40);
        const files = pageImages ?? (imageDataUrl ? [imageDataUrl] : []);
        files.forEach((href, i) => {
          // 瀏覽器連續下載需要一點間隔，不然只會留最後一張
          setTimeout(() => {
            const a = document.createElement("a");
            const pageName = pages[i]?.name ? pages[i].name.replace(/[\\/:*?"<>|]/g, "") : String(i + 1);
            a.download = files.length > 1 ? `${base}-${pageName}.png` : `${base}.png`;
            a.href = href; document.body.appendChild(a); a.click(); a.remove();
          }, i * 350);
        });
      }
    } catch (err) { alert("儲存失敗：" + (err instanceof Error ? err.message : String(err))); }
    finally { setSaving(false); }
  }, [onSave, saving, doc.w, doc.h, flattenToDataUrl, serializeLayers, stashCurrentPage]);

  // 設計工具慣例：Command+S / Ctrl+S 儲存草稿，不佔用工具列按鈕空間。
  useEffect(() => {
    const saveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void doSave(false); }
      // ⌘G 群組／⌘⇧G 解散，跟設計工具一致。要 preventDefault——瀏覽器的 ⌘G 是「找下一個」。
      // 放在這個 effect 而不是上面那個鍵盤 effect：groupSelected 宣告在那之後。
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g"
        && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected(); else groupSelected();
      }
      // ⌥A／⌥H／⌥D 靠左／水平置中／靠右，⌥W／⌥V／⌥S 靠上／垂直置中／靠下（跟 Figma 一樣）。
      // 用 e.code：Mac 按著 Option 時 e.key 會變成特殊符號
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName) && !(e.target as HTMLElement).isContentEditable) {
        const mode = ({ KeyA: "left", KeyH: "hcenter", KeyD: "right", KeyW: "top", KeyV: "vcenter", KeyS: "bottom" } as Record<string, AlignMode>)[e.code];
        if (mode && selectedIdsRef.current.length) { e.preventDefault(); alignRef.current(mode); }
      }
      // ⌘E 合併圖層（Photoshop 的慣例）
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e"
        && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault(); mergeLayers();
      }
    };
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, [doSave]);

  // 離開攔截：有 onSave 且有未存變更 → 攔截並問「儲存草稿／不儲存／取消」
  const { guard, dialog: unsavedDialog } = useUnsavedGuard(!!onSave && dirty, () => doSave(false));

  /* ---------- text editing (content / colour / size / font) ---------- */
  const selEl = layersRef.current.find((l) => l.id === selectedId) ?? null;
  const updateText = (patch: Partial<EL>) => {
    if (!selEl) return; Object.assign(selEl, patch); selEl.thumb = makeThumb(selEl); markDirty(); render(); refresh();
  };
  const updateShape = (patch: Partial<ShapeSpec>) => {
    if (!selEl || !selEl.shape) return; Object.assign(selEl.shape, patch); selEl.thumb = makeThumb(selEl); markDirty(); render(); refresh();
  };
  // 文字特效：patch=null 清除特效（回純文字）；否則合併
  const updateFx = (patch: Partial<TextFx> | null) => {
    if (!selEl) return; selEl.fx = patch === null ? null : { ...(selEl.fx ?? {}), ...patch }; selEl.thumb = makeThumb(selEl); markDirty(); render(); refresh();
  };
  const applyFxPreset = (fx: TextFx | null, color?: string) => { if (!selEl) return; if (color) selEl.color = color; selEl.fx = fx; selEl.thumb = makeThumb(selEl); markDirty(); render(); refresh(); };
  // 字形 guide：用真字體把目標文字畫成黑字白底引導圖（四周留白）→ AI 只上風格不重畫字形
  const buildTextGuide = (el: EL): string => {
    const W = 1024, pad = 0.16;                       // 左右各留 16%
    const inner = W * (1 - pad * 2);
    const c = document.createElement("canvas");
    const m = c.getContext("2d")!;
    // 先用基準字級量測，再等比縮放讓文字寬度貼近 inner
    const base = 200;
    m.font = `${el.fontWeight || 700} ${base}px ${el.fontFamily}`;
    const tw = Math.max(1, m.measureText(el.text || "字").width);
    const fs = Math.min(base * (inner / tw), inner);  // 不超過 inner 高
    const textH = fs * 1.25;
    const H = Math.round(textH / (1 - pad * 2));       // 上下各留 16%
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ff00ff"; g.fillRect(0, 0, W, H);   // 洋紅底（chroma key）→ 去背乾淨、保得住白外框
    g.fillStyle = "#111111";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `${el.fontWeight || 700} ${Math.round(fs)}px ${el.fontFamily}`;
    g.fillText(el.text || "字", W / 2, H / 2);
    return c.toDataURL("image/png");
  };
  // 生成藝術字：把 target 文字（用 guide 鎖字形）＋參考圖風格 → 就地變成圖片圖層（可拖曳、可再 AI 微調）
  const generateArtInto = async (target: EL, refImage: string | null) => {
    if (artBusy) return;
    setArtBusy(true);
    try {
      const guide = buildTextGuide(target);
      // 沒有參考圖時：擷取「整張畫面（不含這段文字）」讓 AI 依整體氛圍/配色設計最合適的風格
      let scene: string | null = null;
      if (!refImage) {
        try {
          const c = document.createElement("canvas"); c.width = doc.w; c.height = doc.h;
          const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, doc.w, doc.h);
          for (const l of layersRef.current) {
            if (!l.visible || l.id === target.id) continue;
            g.save(); applyClip(g, l, layersRef.current); applyLayerTransform(g, l); g.globalAlpha = l.opacity;
            drawElBody(g, l);
            g.restore();
          }
          scene = c.toDataURL("image/jpeg", 0.85);
        } catch { scene = null; }
      }
      const r = await fetch("/api/magic-layers/arttext", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: target.text, width: Math.round(target.w), height: Math.round(target.h), refImageUrl: refImage, guideImageUrl: guide, sceneImageUrl: scene }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? r.statusText);
      const canvas = await loadToCanvas(d.url);
      if (!canvas) throw new Error("讀取藝術字失敗");
      const ar = canvas.width / (canvas.height || 1);
      target.canvas = canvas; target.src = d.url; target.isText = false; target.fx = null; target.shape = null; target.isArt = true;
      target.artRefImage = refImage ?? target.artRefImage ?? null;
      target.naturalW = canvas.width; target.naturalH = canvas.height;
      target.h = target.w / ar;   // 保留寬、依比例定高；中心不變
      target.name = "藝術字：" + (target.text || "").slice(0, 8);
      target.thumb = makeThumb(target);
      setArtView("none"); setArtRef(null); setArtEdit("");
      markDirty(); render(); refresh();
    } catch (err) { alert("AI 文字藝術字失敗：" + (err instanceof Error ? err.message : String(err))); }
    finally { setArtBusy(false); }
  };
  const applyArtText = () => { if (selEl && selEl.isText) generateArtInto(selEl, artRef); };        // State B「生成藝術字」
  const regenArt = () => { if (selEl && selEl.isArt) generateArtInto(selEl, selEl.artRefImage ?? null); };  // State C「重新生成」
  // AI 微調：image-to-image，拿現有藝術字＋指令改風格，內容鎖定（每次重帶原始文字＋原參考圖）
  const editArtText = async () => {
    if (!selEl || !selEl.isArt || !selEl.src || artBusy) return;
    const instruction = artEdit.trim();
    if (!instruction) return;
    const target = selEl;
    setArtBusy(true);
    try {
      const r = await fetch("/api/magic-layers/arttext", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: target.text, width: Math.round(target.w), height: Math.round(target.h), editImageUrl: target.src, instruction, refImageUrl: target.artRefImage ?? null }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? r.statusText);
      const canvas = await loadToCanvas(d.url);
      if (!canvas) throw new Error("讀取藝術字失敗");
      const ar = canvas.width / (canvas.height || 1);
      target.canvas = canvas; target.src = d.url;
      target.naturalW = canvas.width; target.naturalH = canvas.height;
      target.h = target.w / ar;   // 保留寬、依比例定高；中心不變
      target.thumb = makeThumb(target);
      setArtEdit("");
      markDirty(); render(); refresh();
    } catch (err) { alert("AI 微調失敗：" + (err instanceof Error ? err.message : String(err))); }
    finally { setArtBusy(false); }
  };

  /* ---------- panel (top layer first) ---------- */
  const panel = [...layersRef.current].reverse();

  return (
    <div style={S.root}>
      {unsavedDialog}
      {fragmentation?.blocked && (
        <div style={S.warn}>⚠︎ 偵測到碎片化：{fragmentation.warnings.join("；")}（已阻止直接套用，請人工確認）</div>
      )}
      <div style={S.toolbar}>
        {onBack && <button style={S.tbtn} onClick={() => guard(onBack)} title="返回"><ArrowLeft size={15} />返回</button>}
        <strong style={{ letterSpacing: ".02em" }}>Magic <span style={{ color: "#7c3aed" }}>Layers</span></strong>
        {onRename && (renaming ? (
          <input autoFocus defaultValue={name ?? ""} placeholder="設計名稱"
            onBlur={(e) => { onRename(e.target.value.trim() || "未命名排版"); setRenaming(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }}
            style={{ ...S.tbtn, width: 180, fontWeight: 500 }} />
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
            {name ? <>· {name}</> : null}
            <button style={{ ...S.icon, width: 24, height: 24 }} title="重新命名" onClick={() => setRenaming(true)}><Pencil size={14} /></button>
          </span>
        ))}
        <span style={S.divider} />
        <button style={{ ...S.tbtn, ...(canUndo ? {} : S.toolOff) }} onClick={undo} disabled={!canUndo} title="復原 (Ctrl+Z)"><Undo2 size={15} /></button>
        <button style={{ ...S.tbtn, ...(canRedo ? {} : S.toolOff) }} onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
        <span style={S.divider} />
        <button style={S.tbtn} onClick={() => setZoom(view.current.zoom / 1.2)}>−</button>
        <span style={{ width: 52, textAlign: "center", color: "#9a9cab", fontVariantNumeric: "tabular-nums" }}>{zoomPct}%</span>
        <button style={S.tbtn} onClick={() => setZoom(view.current.zoom * 1.2)}>＋</button>
        <select aria-label="畫布比例" title="改尺寸畫布" value={canvasRatio} onChange={(e) => resizeCanvasToRatio(e.target.value)} style={{ ...S.tbtn, appearance: "auto", minWidth: 70, paddingInline: 9 }}>
          {canvasRatio === "custom" && <option value="custom" disabled>自訂比例</option>}
          <option value="1:1">1:1</option><option value="4:5">4:5</option><option value="9:16">9:16</option><option value="16:9">16:9</option>
        </select>
        <span style={S.divider} />
        {selectedIds.length >= 2 && !selectedIds.some((id) => !!layersRef.current.find((l) => l.id === id)?.groupId) && <button style={S.tbtn} onClick={groupSelected} title="將選取的物件設為一組（⌘G）">群組</button>}
        {selectedIds.some((id) => !!layersRef.current.find((l) => l.id === id)?.groupId) && <button style={S.tbtn} onClick={ungroupSelected} title="解除目前群組（⌘⇧G）">解散群組</button>}
        {(selectedIds.length >= 2 || (selectedIds.length === 1 && panel.findIndex((l) => l.id === selectedIds[0]) < panel.length - 1)) && (
          <button style={S.tbtn} onClick={mergeLayers} title={selectedIds.length >= 2 ? "把選取的圖層合成一張（⌘E）" : "跟下面那一層合成一張（⌘E）"}>
            {selectedIds.length >= 2 ? "合併圖層" : "向下合併"}
          </button>
        )}
        {selectedIsImage && (
          <button style={S.tbtn} onClick={() => void cutoutSelected()} disabled={adding} title="移除這個圖層的背景（會呼叫付費去背服務）">
            {adding ? "去背中…" : "去背"}
          </button>
        )}
        {onSave && (
          <>
            <span style={S.divider} />
            {(saving || saved) && <span aria-live="polite" style={{ fontSize: 12, color: saved ? "#16a34a" : "#9ca3af" }}>{saving ? "儲存中…" : "✓ 已自動儲存"}</span>}
            <button style={{ ...S.tbtn, border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff" }} onClick={() => doSave(true)} disabled={saving} title="下載成 PNG，並存進素材庫"><Download size={15} />下載並存入素材庫</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{layersRef.current.length} 圖層 · 文件 {doc.w}×{doc.h}</span>
      </div>

      <div style={S.body}>
        {/* 最左邊：編輯器專用的圖示列（進自由畫布後，網站的側邊選單會收起來）。
            最上面的 Logo 回首頁，跟「返回」一樣會先問要不要儲存。 */}
        <nav aria-label="編輯工具" style={S.rail}>
          <button onClick={() => guard(() => { window.location.href = clientId ? `/clients/${clientId}` : "/"; })} title="回首頁（會先問要不要儲存）" aria-label="回首頁"
            style={{ width: 44, height: 44, margin: "10px 0 8px", border: "none", background: "none", padding: 0, cursor: "pointer", display: "grid", placeItems: "center" }}>
            <img src="/mira-mark.png" alt="MIRA" style={{ width: 32, height: 32, objectFit: "contain" }} />
          </button>
          {LEFT_TABS.map((t) => {
            const on = leftTab === t.id;
            return (
              <button key={t.id} onClick={() => setLeftTab(on ? null : t.id)} aria-pressed={on} title={on ? `收起${t.label}` : t.label}
                style={{ ...S.railBtn, ...(on ? { background: "#f5f3ff", color: "#6d28d9" } : {}) }}>
                <t.Icon size={20} />
                <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>{t.label}</span>
              </button>
            );
          })}
        </nav>
        {leftTab && (
        <aside style={S.panel} aria-label={LEFT_TABS.find((t) => t.id === leftTab)?.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px", borderBottom: "1px solid #f3f4f6", flex: "0 0 auto" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginRight: "auto" }}>{LEFT_TABS.find((t) => t.id === leftTab)?.label}</span>
            {leftTab === "templates" && templates.length > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>{templates.length} 個・點擊套用</span>}
            {leftTab === "materials" && backgrounds?.length ? <span style={{ fontSize: 11, color: "#9ca3af" }}>設為背景・加入畫布</span> : null}
            <button onClick={() => setLeftTab(null)} title="收起面板" aria-label="收起面板" style={{ ...S.icon, width: 28, height: 28 }}><ChevronLeft size={16} /></button>
          </div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: leftTab === "templates" || leftTab === "materials" ? "10px 10px 14px" : "8px 6px 14px" }}>
            {leftTab === "templates" && (<>
              {/* 範本庫：共用（全品牌看得到），目前只做 1:1 */}
                {templates.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                    範本載入中……如果一直沒出現，重新整理一次。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {templates.map((t) => (
                      <div key={t.id} style={{ position: "relative" }}>
                        <button onClick={() => applyTemplate(t.id)} title={`${t.name}（點擊套用，會換掉目前畫布內容；可用復原還原）`}
                          style={{ display: "block", width: "100%", padding: 0, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: "pointer" }}>
                          {t.previewUrl
                            ? <img src={t.previewUrl} alt={t.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                            : <div style={{ width: "100%", aspectRatio: "1", display: "grid", placeItems: "center", fontSize: 10, color: "#9ca3af" }}>無縮圖</div>}
                        </button>
                        {/* 內建範本是唯讀的，刪掉之後只能重新部署才會回來，所以不給刪除鈕。 */}
                        {!t.builtin && (
                          <button onClick={() => deleteTemplate(t.id, t.name)} title="刪除這個範本"
                            style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, border: "none", background: "rgba(17,24,39,.72)", color: "#fff", fontSize: 11, lineHeight: "18px", cursor: "pointer", padding: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={saveAsTemplate} disabled={tplSaving}
                  style={{ ...S.tool, width: "100%", marginTop: 8, justifyContent: "center", opacity: tplSaving ? .6 : 1 }}>
                  <Save size={15} />{tplSaving ? "儲存中…" : "把目前畫布存成範本"}
                </button>
            </>)}
            {leftTab === "materials" && (
              backgrounds && backgrounds.length > 0 ? (
                /* 原本「背景庫」和「素材庫」是同一批圖、只差點下去做什麼，合成這一區：
                   每張圖都能選設為背景或加入畫布，也能直接拖到畫布上 */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {backgrounds.map((b, i) => (
                    <MaterialThumb key={i} url={b.url} label={b.label ?? ""}
                      onUseAsBackground={() => replaceBackground(b.url)}
                      onAddToCanvas={() => void pushImageLayer(b.url, b.label || "圖片")} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, padding: 4 }}>素材庫目前沒有圖片。可以到「上傳」加入自己的圖。</div>
              )
            )}
            {leftTab === "ai" && (<>
              {SHOW_MAGIC_FILL && (
                <button style={S.tool} onClick={generateMagicFill} disabled={magicFillBusy}><WandSparkles size={16} />{magicFillBusy ? "偵測並延伸中…" : "魔術棒補空白"}</button>
              )}
              <button
                style={{ ...S.tool, ...(tool === "marquee" ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}
                onClick={() => {
                  setTool((t) => (t === "marquee" ? "select" : "marquee"));
                  marqueeRef.current = null; setMarquee(null); setGenFillResult(null);
                  if (canvasRef.current) canvasRef.current.style.cursor = "default";
                  render();
                }}
                title="在畫布上框一塊，讓 AI 只重畫那一塊（補東西或移除東西）">
                <WandSparkles size={16} />生成式填色{tool === "marquee" ? "（開）" : ""}
              </button>
              {tool === "marquee" && (
                <div style={{ fontSize: 11, color: "#6b7280", padding: "2px 4px 6px" }}>
                  在圖上拖出一個框。要清掉東西按「移除」；要畫東西就打字再按「生成」。只會改背景，字和產品請直接選取後刪除。
                </div>
              )}
              <button style={S.tool} onClick={() => { setOutpaintResult(null); setShowOutpaint(true); }}><Maximize2 size={16} />擴圖／改尺寸</button>
              <button style={{ ...S.tool, ...(selectedIsImage ? {} : { opacity: .5, cursor: "not-allowed" }) }} disabled={!selectedIsImage || adding}
                onClick={() => void cutoutSelected()} title={selectedIsImage ? "移除這個圖層的背景（會呼叫付費去背服務）" : "先在畫布上選一張圖片"}>
                <Scissors size={16} />{adding ? "去背中…" : "去背"}
              </button>
              <button style={{ ...S.tool, ...(selEl?.isText ? {} : { opacity: .5, cursor: "not-allowed" }) }} disabled={!selEl?.isText}
                onClick={() => { setPanelTab("design"); setArtView("setup"); }} title={selEl?.isText ? "把選取的文字做成 AI 藝術字" : "先在畫布上選一段文字"}>
                <Sparkles size={16} />AI 文字藝術字
              </button>
              {!(selectedIsImage || selEl?.isText) && (
                <div style={{ fontSize: 11, color: "#9ca3af", padding: "6px 4px 0", lineHeight: 1.6 }}>去背要先選一張圖片；AI 文字藝術字要先選一段文字。</div>
              )}
            </>)}
            {leftTab === "tools" && (<>
              <button style={S.tool} onClick={addTextLayer}><Type size={16} />文字</button>
              <button style={{ ...S.tool, ...(tool === "draw" ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}
                onClick={() => { if (tool === "draw") exitDraw(); else { setTool("draw"); if (!keepsPaintSelection(layersRef.current, selectedIdsRef.current)) applySelection([]); } }} title="繪製：按住拖曳畫任意線條（Shift＋P）">
                <Pencil size={16} />繪製{tool === "draw" ? "（開）" : ""}
              </button>
              <button style={S.tool} onClick={addShape}><Square size={16} />形狀</button>
              <button style={S.tool} onClick={() => setShowIcon(true)}><Star size={16} />圖標</button>
              <button style={S.tool} onClick={addLine}><Minus size={16} />線條</button>
              <button
                style={{ ...S.tool, ...(tool === "erase" ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}
                onClick={() => { setTool((t) => (t === "erase" ? "select" : "erase")); erasePt.current = null; if (canvasRef.current) canvasRef.current.style.cursor = "default"; render(); }}
                title="橡皮擦：在圖片圖層上拖曳，局部擦成透明">
                <Eraser size={16} />橡皮擦{tool === "erase" ? "（開）" : ""}
              </button>
              {tool === "erase" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px 2px" }} title="筆刷大小">
                  <span style={{ fontSize: 11, color: "#9ca3af", flex: "0 0 auto" }}>筆刷</span>
                  <input type="range" min={6} max={120} value={brush} onChange={(e) => { setBrush(Number(e.target.value)); render(); }} style={{ flex: 1, accentColor: "#7c3aed" }} />
                  <span style={{ width: 26, fontSize: 11, color: "#9a9cab", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brush}</span>
                </div>
              )}
            </>)}
            {leftTab === "upload" && (<>
              <button style={S.tool} onClick={() => uploadImgRef.current?.click()}><Upload size={16} />上傳圖片</button>
              <button style={S.tool} onClick={() => addProdRef.current?.click()} disabled={adding} title="上傳一張產品圖，自動去背後加入為新圖層">
                <Plus size={16} />{adding ? "去背中…" : "加入產品（自動去背）"}
              </button>
              <button style={S.tool} onClick={addLogo}><BadgeCheck size={16} />Logo</button>
              <div style={{ fontSize: 11, color: "#9ca3af", padding: "8px 4px 0", lineHeight: 1.6 }}>也可以把「素材」裡的圖直接拖到畫布上。</div>
            </>)}
          </div>
        </aside>
        )}
        {/* 檔案選擇框一直留著：面板收起來時快捷操作、其他地方的按鈕也要用得到 */}
        <input ref={uploadImgRef} type="file" accept="image/*" onChange={onUploadImage} style={{ display: "none" }} />
        <input ref={addProdRef} type="file" accept="image/*" onChange={addProduct} style={{ display: "none" }} />

        {/* 畫布＋下方的頁面列 */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div ref={wrapRef} style={S.stage}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("text/ml-image-url")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
          onDrop={(e) => {
            const url = e.dataTransfer.getData("text/ml-image-url"); if (!url) return;
            e.preventDefault();
            const r = canvasRef.current!.getBoundingClientRect();
            const d = s2d(e.clientX - r.left, e.clientY - r.top);   // 落點（文件座標）
            pushImageLayer(url, "背景圖", "object", { cx: d.x, cy: d.y });
          }}>
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, touchAction: "none" }} />
        {/* 選起某幾個字之後才出現的分段樣式工具列。
            按鈕帶 data-run-tool，textarea 的 onBlur 會據此判斷不要收起編輯框，
            否則點按鈕的當下選取範圍就沒了。 */}
        {editingText && textSel && (
          <div style={{
            position: "absolute",
            left: Math.max(8, editingText.left),
            top: Math.max(8, editingText.top - 52),
            zIndex: 45, display: "flex", gap: 6, alignItems: "center",
            background: "#1f2937", padding: "6px 8px", borderRadius: 10,
            boxShadow: "0 6px 18px rgba(0,0,0,.25)",
          }}>
            <span style={{ fontSize: 11, color: "#9ca3af", paddingInline: 4 }}>選取的字</span>
            {[1.4, 0.75].map((factor) => (
              <button key={factor} data-run-tool="1" onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const target = layersRef.current.find((x) => x.id === editingText.id);
                  const current = target?.runs?.find((r) => r.start <= textSel.start && r.end >= textSel.end)?.fontSize
                    ?? target?.fontSize ?? 40;
                  applyRunStyle({ fontSize: Math.round(current * factor) });
                }}
                style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #4b5563", background: "#111827", color: "#f9fafb", fontSize: 13, cursor: "pointer" }}>
                {factor > 1 ? "放大" : "縮小"}
              </button>
            ))}
            <input type="color" data-run-tool="1" onMouseDown={(e) => e.preventDefault()}
              defaultValue="#ffffff"
              onChange={(e) => applyRunStyle({ color: e.target.value })}
              title="這幾個字的顏色"
              style={{ width: 30, height: 28, border: "1px solid #4b5563", borderRadius: 6, padding: 0, background: "#111827", cursor: "pointer" }} />
            <button data-run-tool="1" onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyRunStyle({ fontWeight: 900 })}
              style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #4b5563", background: "#111827", color: "#f9fafb", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>粗</button>
            <button data-run-tool="1" onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const target = layersRef.current.find((x) => x.id === editingText.id);
                if (!target) return;
                target.runs = (target.runs ?? []).filter((r) => r.end <= textSel.start || r.start >= textSel.end);
                target.thumb = makeThumb(target); markDirty(); render(); refresh();
              }}
              style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #4b5563", background: "transparent", color: "#d1d5db", fontSize: 13, cursor: "pointer" }}>還原</button>
          </div>
        )}

        {/* 畫布內文字編輯：貼合圖層位置／大小／旋轉／字級的輸入框，疊在 canvas 上。
            打字即時更新圖層，Enter 換行，Esc 或點別處收起。
            用 textarea 不用 contenteditable：換行行為本來就對，也不會帶進 HTML。 */}
        {editingText && (
          <textarea
            key={editingText.id}
            autoFocus
            defaultValue={editingText.value}
            onChange={(e) => {
              const target = layersRef.current.find((x) => x.id === editingText.id);
              if (!target) return;
              target.text = e.target.value;
              target.thumb = makeThumb(target);
              markDirty(); render(); refresh();
            }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { setEditingText(null); setTextSel(null); } }}
            // onSelect 在某些情況不會觸發（程式設定選取、部分輸入法），
            // 所以 keyup／mouseup 也各讀一次，確保拖曳選字與 Shift＋方向鍵都抓得到。
            onSelect={(e) => readSel(e.target as HTMLTextAreaElement)}
            onKeyUp={(e) => readSel(e.target as HTMLTextAreaElement)}
            onMouseUp={(e) => readSel(e.target as HTMLTextAreaElement)}
            // 不在 blur 收起：點上方工具列會先觸發 blur，範圍就沒了。改成點畫布別處才收。
            onBlur={(e) => { if (!(e.relatedTarget as HTMLElement | null)?.dataset?.runTool) { setEditingText(null); setTextSel(null); } }}
            style={{
              position: "absolute",
              left: editingText.left, top: editingText.top,
              width: editingText.width, height: editingText.height,
              transform: `rotate(${editingText.rotation}rad)`, transformOrigin: "center",
              font: editingText.font, lineHeight: 1.25,
              color: editingText.color, textAlign: editingText.align,
              background: "rgba(255,255,255,.92)", border: "2px solid #7c3aed", borderRadius: 4,
              padding: 0, margin: 0, resize: "none", outline: "none", overflow: "hidden", zIndex: 40,
            }} />
        )}
        </div>
        <PageStrip pages={pagesView} current={pageIdx} currentThumb={curThumb}
          onSelect={goToPage} onAdd={() => addPage(false)} onDuplicate={() => addPage(true)} onDelete={deletePage} onMove={movePage} onRename={renamePage} />
        </div>

        {/* 右側面板常駐。原本是選到圖層才掛載，一選取畫布就從 501px 被擠到 237px，
            縮放比例沒變、可視範圍卻少一半，操作起來就像「一點物件就放大」。
            Figma／PS 的面板都是固定的，畫布寬度不會因為選取而變動。 */}
        <aside ref={rpanelRef} style={S.rpanel}>
          {/* 設定在上、圖層在下——跟 Photoshop 一樣，左欄就不會擠成一條。 */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
          {!selEl ? (
            <div style={{ padding: 20, fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>
              選一個圖層來編輯它的設定。<br />
              雙擊文字可以直接在畫布上改字。
            </div>
          ) : (
          <>
            <div style={S.rtabs}>
              <button style={{ ...S.rtab, ...(panelTab === "design" ? S.rtabOn : {}) }} onClick={() => setPanelTab("design")}>設計</button>
              <button style={{ ...S.rtab, ...(panelTab === "settings" ? S.rtabOn : {}) }} onClick={() => setPanelTab("settings")}>設定</button>
            </div>
            {panelTab === "design" ? (
              <div style={{ padding: 16, overflowY: "auto" }}>
                <AlignBar units={unitCount(panel.filter((l) => selectedIds.includes(l.id)))} onAlign={alignSelected} />
                {selEl.isText && (artView === "setup" ? (
                  /* ===== State B：AI 文字藝術字設定（獨立子畫面） ===== */
                  <>
                    <button onClick={() => { setArtView("none"); setArtRef(null); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", ...S.rhead }}>
                      <ArrowLeft size={15} /> AI 文字藝術字
                    </button>
                    <label style={S.rlabel}>目前文字</label>
                    <div style={{ padding: "9px 11px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#374151", fontWeight: 600, wordBreak: "break-all" }}>{selEl.text || "（空白）"}</div>
                    <label style={{ ...S.rlabel, marginTop: 16 }}>參考風格</label>
                    {artRef ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={artRef} alt="參考圖" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ 參考圖片已加入</div>
                          <button disabled={artBusy} onClick={() => setArtRef(null)} style={{ ...S.rbtn, marginTop: 6, color: "#dc2626", padding: "4px 10px", fontSize: 11 }}>移除</button>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: "block", textAlign: "center", padding: "22px 8px", border: "1px dashed #c4b5fd", borderRadius: 10, color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: artBusy ? "default" : "pointer", background: "#faf5ff" }}>
                        ＋ 上傳參考圖片
                        <input type="file" accept="image/*" disabled={artBusy} style={{ display: "none" }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => setArtRef(String(fr.result)); fr.readAsDataURL(f); e.target.value = ""; }} />
                      </label>
                    )}
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>AI 只會參考文字的視覺風格，不會使用圖片中的文字內容。</p>
                    <button onClick={applyArtText} disabled={artBusy}
                      style={{ width: "100%", marginTop: 16, height: 42, borderRadius: 10, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: artBusy ? "default" : "pointer", background: artBusy ? "#a78bfa" : "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
                      {artBusy ? "生成藝術字中…（約 15–30 秒）" : "✨ 生成藝術字"}
                    </button>
                    <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />
                  </>
                ) : (
                  /* ===== State A：一般文字（可編輯；不含任何 AI 分析／參考圖 UI） ===== */
                  <>
                    <div style={S.rhead}>文字設定</div>
                    <label style={S.rlabel}>文字內容</label>
                    {/* 用 textarea 不用 input：單行輸入框打不出換行，使用者按 Enter 沒反應。
                        繪製端本來就支援多行（editable-text.ts 會 split("\n")），卡住的只有輸入。
                        Enter 換行、⌘Enter 收起鍵盤焦點。 */}
                    <textarea
                      value={selEl.text}
                      onChange={(e) => updateText({ text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); }}
                      rows={Math.min(6, Math.max(2, selEl.text.split("\n").length + 1))}
                      placeholder="換行請按 Enter"
                      style={{ ...S.rinput, height: "auto", minHeight: 62, padding: "8px 10px", lineHeight: 1.5, resize: "vertical" }} />
                    <label style={S.rlabel}>字體</label>
                    {/* 這三個家族由 app/layout.tsx 以 next/font 實際載入（見該檔註解）。
                        先前選單裡的 Manrope 根本沒被載入，選了等於沒選；
                        中文字也沒有任何 webfont，實際字形取決於觀看者的作業系統。 */}
                    <select value={selEl.fontFamily} onChange={(e) => updateText({ fontFamily: e.target.value })} style={S.rinput}>
                      <option value="'Noto Sans TC',system-ui,sans-serif">思源黑體（Noto Sans TC）</option>
                      <option value="'Noto Serif TC',serif">思源宋體（Noto Serif TC）</option>
                      <option value="'Manrope','Noto Sans TC',sans-serif">Manrope（英數）</option>
                      {brandFonts.length > 0 && (
                        <optgroup label="品牌字體">
                          {brandFonts.map((f) => (
                            <option key={f.id} value={`'${f.family}','Noto Sans TC',sans-serif`}>{f.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}><label style={S.rlabel}>字型大小</label>
                        <input type="number" value={Math.round(selEl.fontSize)} onChange={(e) => updateText({ fontSize: Math.max(8, Number(e.target.value) || 8) })} style={S.rinput} /></div>
                      <div style={{ flex: 1 }}><label style={S.rlabel}>字重</label>
                        <select value={selEl.fontWeight} onChange={(e) => updateText({ fontWeight: Number(e.target.value) })} style={S.rinput}>
                          <option value={400}>Regular</option><option value={600}>Medium</option><option value={700}>Bold</option><option value={800}>Black</option>
                        </select></div>
                    </div>
                    {/* 字距／行高：drawTextEl 早就會讀 textLayout 來排版，但一直沒有 UI，
                        使用者調不到。沒有 textLayout 的舊圖層在這裡第一次調整時建立預設值。 */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}><label style={S.rlabel}>字距</label>
                        <input type="number" step={0.5} value={selEl.textLayout?.letterSpacing ?? 0}
                          onChange={(e) => {
                            const v = Math.max(-20, Math.min(20, Number(e.target.value) || 0));
                            updateText({ textLayout: { ...(selEl.textLayout ?? DEFAULT_TEXT_LAYOUT), letterSpacing: v } });
                          }} style={S.rinput} /></div>
                      <div style={{ flex: 1 }}><label style={S.rlabel}>行高</label>
                        <input type="number" step={0.05} value={selEl.textLayout?.lineHeight ?? DEFAULT_TEXT_LAYOUT.lineHeight}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(2, Number(e.target.value) || DEFAULT_TEXT_LAYOUT.lineHeight));
                            updateText({ textLayout: { ...(selEl.textLayout ?? DEFAULT_TEXT_LAYOUT), lineHeight: v } });
                          }} style={S.rinput} /></div>
                    </div>
                    <label style={S.rlabel}>顏色</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="color" value={toHex(selEl.color)} onChange={(e) => updateText({ color: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                      <input value={selEl.color} onChange={(e) => updateText({ color: e.target.value })} style={{ ...S.rinput, flex: 1 }} />
                    </div>
                    <label style={S.rlabel}>文字效果</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <button style={{ ...S.fxChip, ...(!selEl.fx ? S.fxChipOn : {}) }} onClick={() => applyFxPreset(null)}>無</button>
                      <button style={S.fxChip} onClick={() => applyFxPreset({ gradient: ["#fce38a", "#c8811f"] })}>漸層金</button>
                      <button style={S.fxChip} onClick={() => applyFxPreset({ gradient: ["#c4b5fd", "#6d28d9"] })}>漸層紫</button>
                      <button style={S.fxChip} onClick={() => applyFxPreset({ strokeColor: "#111827", strokeW: 0.08 }, "#ffffff")}>白字黑框</button>
                      <button style={S.fxChip} onClick={() => applyFxPreset({ gradient: ["#a78bfa", "#7c3aed"], shadow: true })}>霓虹</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={{ ...S.rbtn, flex: 1, ...(selEl.fx?.strokeW ? { border: "1px solid #7c3aed", color: "#7c3aed" } : {}) }} onClick={() => updateFx({ strokeW: selEl.fx?.strokeW ? 0 : 0.08, strokeColor: selEl.fx?.strokeColor || "#ffffff" })}>外框</button>
                      <button style={{ ...S.rbtn, flex: 1, ...(selEl.fx?.shadow ? { border: "1px solid #7c3aed", color: "#7c3aed" } : {}) }} onClick={() => updateFx({ shadow: !selEl.fx?.shadow })}>陰影</button>
                      <button style={{ ...S.rbtn, flex: 1, ...(selEl.fx?.italic ? { border: "1px solid #7c3aed", color: "#7c3aed" } : {}) }} onClick={() => updateFx({ italic: !selEl.fx?.italic })}>斜體</button>
                    </div>
                    {/* 外框：顏色＋粗細（像 PS 的「筆畫 1 像素」）。粗細以畫面上看得到的外框寬度（px）顯示，
                        存成字級的比例，文字放大縮小外框跟著等比變 */}
                    {selEl.fx?.strokeW ? (() => {
                      const fs = selEl.fontSize * (selEl.w / (selEl.naturalW || selEl.w));
                      const px = Math.max(1, Math.round((fs * selEl.fx.strokeW) / 2));
                      const setPx = (v: number) => updateFx({ strokeW: (Math.max(1, Math.min(60, v || 1)) * 2) / Math.max(1, fs) });
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                          <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>外框</span>
                          <input type="color" aria-label="外框顏色" title="外框顏色" value={toHex(selEl.fx.strokeColor || "#ffffff")} onChange={(e) => updateFx({ strokeColor: e.target.value })} style={{ width: 32, height: 28, border: "1px solid #e5e7eb", borderRadius: 6, padding: 0, cursor: "pointer", flex: "0 0 auto" }} />
                          <input type="range" aria-label="外框粗細" min={1} max={60} value={Math.min(60, px)} onChange={(e) => setPx(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "#7c3aed" }} />
                          <input type="number" aria-label="外框粗細（像素）" min={1} max={60} value={px} onChange={(e) => setPx(Number(e.target.value))} style={{ ...S.rinput, width: 56, height: 28, padding: "0 6px", flex: "0 0 auto" }} />
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>px</span>
                        </div>
                      );
                    })() : null}
                    <label style={S.rlabel}>字距 <span style={{ float: "right", color: "#9ca3af" }}>{selEl.fx?.letterSpacing ?? 0}px</span></label>
                    <input type="range" min={-12} max={48} step={1} value={selEl.fx?.letterSpacing ?? 0} onChange={(e) => updateFx({ letterSpacing: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                    <label style={S.rlabel}>文字路徑</label>
                    <select value={selEl.fx?.warp ?? "none"} onChange={(e) => updateFx({ warp: e.target.value as TextFx["warp"] })} style={S.rinput}>
                      <option value="none">一般直線</option><option value="arc-up">向上弧形</option><option value="arc-down">向下弧形</option><option value="wave">波浪文字</option>
                    </select>
                    {(selEl.fx?.warp ?? "none") !== "none" && (<>
                      <label style={S.rlabel}>彎曲幅度 <span style={{ float: "right", color: "#9ca3af" }}>{selEl.fx?.warpAmount ?? 35}%</span></label>
                      <input type="range" min={5} max={100} value={selEl.fx?.warpAmount ?? 35} onChange={(e) => updateFx({ warpAmount: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                      {selEl.fx?.warp === "wave" && <><label style={S.rlabel}>波浪數</label><input type="range" min={1} max={5} step={1} value={selEl.fx?.waveCount ?? 2} onChange={(e) => updateFx({ waveCount: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></>}
                    </>)}
                    {/* AI 文字藝術字入口 */}
                    <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>想做更特殊的文字效果？</div>
                    <button onClick={() => setArtView("setup")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", textAlign: "left" }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>✨</span>
                      <span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>AI 文字藝術字</span>
                        <span style={{ display: "block", fontSize: 11, opacity: 0.85, marginTop: 2 }}>參考圖片生成特殊文字設計</span>
                      </span>
                    </button>
                    <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />
                  </>
                ))}
                {selEl.textLayout && selEl.fx?.warp && selEl.fx.warp !== "none" && <p style={{padding:12,fontSize:12}}>變形文字以單行顯示；取消變形即可恢復多行排版。</p>}
                {selEl.shape && (
                  <>
                    <div style={S.rhead}>{selEl.shape.kind === "icon" ? "圖標設定" : selEl.shape.kind === "line" ? "線條設定" : "形狀設定"}</div>
                    {selEl.shape.kind === "path" && !selEl.shape.closed && selEl.type !== "drawing" && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>這是一條沒有封閉的線：可以改顏色、粗細；封閉之後就能填色、當成放圖的框。</div>
                        <button onClick={() => updateShape({ closed: true, fill: "#7c3aed" })} style={{ ...S.rbtn, width: "100%" }}>把頭尾接起來，變成形狀</button>
                      </div>
                    )}
                    {selEl.shape.kind === "path" && !selEl.shape.closed && (<>
                      <label style={S.rlabel}>線條顏色</label>
                      <input type="color" value={hexColor(toHex(selEl.shape.stroke === "none" ? "#1f2937" : selEl.shape.stroke))} onChange={(e) => updateShape({ stroke: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                      <label style={S.rlabel}>粗細</label>
                      <input type="number" min={1} value={selEl.shape.strokeWidth} onChange={(e) => updateShape({ strokeWidth: Math.max(1, Number(e.target.value) || 1) })} style={S.rinput} />
                    </>)}
                    {(selEl.shape.kind !== "line" && selEl.shape.kind !== "icon" && !(selEl.shape.kind === "path" && !selEl.shape.closed)) && (<>
                      {selEl.shape.kind !== "path" && (<>
                      <label style={S.rlabel}>類型</label>
                      <select value={selEl.shape.kind} onChange={(e) => updateShape({ kind: e.target.value as ShapeSpec["kind"] })} style={S.rinput}>
                        <option value="rect">矩形</option>
                        <option value="ellipse">橢圓</option>
                        <option value="triangle">三角形</option>
                        <option value="diamond">菱形</option>
                        <option value="polygon">多邊形</option>
                        <option value="star">星形</option>
                      </select>
                      </>)}
                      <label style={S.rlabel}>填色</label>
                      <div style={{ display: "flex", gap: 4, padding: 3, background: "#f3f4f6", borderRadius: 10, marginBottom: 8 }}>
                        {(["solid", "gradient"] as const).map((mode) => {
                          const on = mode === "gradient" ? !!selEl.shape!.gradient : !selEl.shape!.gradient;
                          return (
                            <button key={mode} onClick={() => setFillMode(mode)}
                              style={{ flex: 1, height: 30, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "#7c3aed" : "#6b7280", boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
                              {mode === "solid" ? "純色" : "漸層"}
                            </button>
                          );
                        })}
                      </div>
                      {!selEl.shape.gradient ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="color" value={hexColor(toHex(selEl.shape.fill === "none" ? "#7c3aed" : selEl.shape.fill))} onChange={(e) => updateShape({ fill: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                          <button style={{ ...S.rbtn, flex: 1 }} onClick={() => updateShape({ fill: "none" })}>無填色</button>
                        </div>
                      ) : (
                        <GradientEditor g={selEl.shape.gradient} onChange={(gradient) => updateShape({ gradient })} />
                      )}
                      {selEl.shape.kind === "ellipse" && !selEl.shape.gradient && (<>
                        <label style={S.rlabel}>邊緣柔和度 <span style={{ float: "right", color: "#9ca3af" }}>{Math.round((selEl.shape.softness ?? 0) * 100)}%</span></label>
                        <input type="range" min={0} max={100} value={Math.round((selEl.shape.softness ?? 0) * 100)} onChange={(e) => updateShape({ softness: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                      </>)}
                      {selEl.shape.kind === "rect" && (<>
                        <label style={S.rlabel}>圓角 <span style={{ float: "right", color: "#9ca3af" }}>{Math.round(selEl.shape.radius ?? 0)}</span></label>
                        <input type="range" min={0} max={Math.round(Math.min(selEl.w, selEl.h) / 2)} value={Math.round(selEl.shape.radius ?? 0)} onChange={(e) => updateShape({ radius: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                      </>)}
                      {(selEl.shape.kind === "polygon" || selEl.shape.kind === "star") && (<>
                        <label style={S.rlabel}>{selEl.shape.kind === "star" ? "角數" : "邊數"} <span style={{ float: "right", color: "#9ca3af" }}>{selEl.shape.sides ?? (selEl.shape.kind === "star" ? 5 : 6)}</span></label>
                        <input type="range" min={3} max={12} value={selEl.shape.sides ?? (selEl.shape.kind === "star" ? 5 : 6)} onChange={(e) => updateShape({ sides: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                      </>)}
                      <label style={S.rlabel}>邊框（寬＞0 才顯示）</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={toHex(selEl.shape.stroke === "none" ? "#1f2937" : selEl.shape.stroke)} onChange={(e) => updateShape({ stroke: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                        <input type="number" value={selEl.shape.strokeWidth} onChange={(e) => updateShape({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })} style={{ ...S.rinput, flex: 1 }} />
                      </div>
                    </>)}
                    {selEl.shape.kind === "line" && (<>
                      <label style={S.rlabel}>顏色</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={toHex(selEl.shape.stroke)} onChange={(e) => updateShape({ stroke: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                        <input value={selEl.shape.stroke} onChange={(e) => updateShape({ stroke: e.target.value })} style={{ ...S.rinput, flex: 1 }} />
                      </div>
                      <label style={S.rlabel}>粗細</label>
                      <input type="number" value={selEl.shape.strokeWidth} onChange={(e) => updateShape({ strokeWidth: Math.max(1, Number(e.target.value) || 1) })} style={S.rinput} />
                    </>)}
                    {selEl.shape.kind === "icon" && (<>
                      <label style={S.rlabel}>顏色</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={toHex(selEl.shape.fill)} onChange={(e) => updateShape({ fill: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                        <input value={selEl.shape.fill} onChange={(e) => updateShape({ fill: e.target.value })} style={{ ...S.rinput, flex: 1 }} />
                      </div>
                    </>)}
                    <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />
                  </>
                )}
                {selEl.isArt && (
                  <>
                    {/* ===== State C：AI 藝術字（生成完成） ===== */}
                    <div style={S.rhead}>AI 藝術字</div>
                    {selEl.thumb ? (
                      <div style={{ padding: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, textAlign: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selEl.thumb} alt="藝術字" style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain" }} />
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, wordBreak: "break-all" }}>{selEl.text}</div>
                      </div>
                    ) : null}
                    <label style={{ ...S.rlabel, marginTop: 14 }}>AI 微調</label>
                    <textarea value={artEdit} disabled={artBusy} onChange={(e) => setArtEdit(e.target.value)} rows={2}
                      placeholder="描述想修改的地方…例：翅膀小一點、藍色再淡一些、陰影不要這麼重、更接近參考圖"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
                    <button onClick={editArtText} disabled={artBusy || !artEdit.trim()}
                      style={{ width: "100%", marginTop: 8, height: 38, borderRadius: 10, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: artBusy || !artEdit.trim() ? "default" : "pointer", background: artBusy ? "#a78bfa" : !artEdit.trim() ? "#c4b5fd" : "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
                      {artBusy ? "AI 修改中…（約 15–30 秒）" : "✨ AI 微調"}
                    </button>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>只改風格，文字內容鎖定不變（可用復原還原）。</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button disabled={artBusy} onClick={regenArt} style={{ ...S.rbtn, flex: 1 }}>重新生成</button>
                      <label style={{ ...S.rbtn, flex: 1, textAlign: "center", cursor: artBusy ? "default" : "pointer" }}>
                        更換參考圖
                        <input type="file" accept="image/*" disabled={artBusy} style={{ display: "none" }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const el = selEl; if (el) generateArtInto(el, String(fr.result)); }; fr.readAsDataURL(f); e.target.value = ""; }} />
                      </label>
                    </div>
                    <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />
                  </>
                )}
                {selEl.canvas && !selEl.isText && !selEl.shape && selEl.type !== "background" && (
                  <ClipPanel
                    frameName={selEl.clipTo ? (panel.find((l) => l.id === selEl.clipTo)?.name ?? null) : null}
                    frames={panel.filter((l) => l.id !== selEl.id && isFillableShape(l.shape)).map((l) => ({ id: l.id, name: l.name, shape: l.shape! }))}
                    onPut={(frameId) => putIntoFrame(selectedIdsRef.current[0], frameId)}
                    onFit={() => { const id = selectedIdsRef.current[0], f = layersRef.current.find((l) => l.id === id)?.clipTo; if (f) fitIntoFrame(id, f); }}
                    onTakeOut={() => takeOutOfFrame(selectedIdsRef.current[0])} />
                )}
                {/* 畫在這張圖片上的筆畫：跟 PS 一樣就是這個圖層的一部分，圖層列表不另外列出來 */}
                {selEl.paint?.length ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px", padding: "8px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, color: "#4b5563" }}>
                    <Pencil size={13} color="#7c3aed" />
                    <span style={{ flex: 1 }}>這張圖上畫了 {selEl.paint.length} 筆</span>
                    <button onClick={() => clearPaint(selEl.id)} title="清掉畫在這張圖片上的筆畫（原圖不受影響）"
                      style={{ ...S.rbtn, height: 26, padding: "0 10px", fontSize: 12 }}>清除筆畫</button>
                  </div>
                ) : null}
                <div style={S.rhead}>圖層設定</div>
                <label style={S.rlabel}>透明度 <span style={{ float: "right", color: "#9ca3af" }}>{Math.round(selEl.opacity * 100)}%</span></label>
                <input type="range" min={0} max={100} value={Math.round(selEl.opacity * 100)} onChange={(e) => updateText({ opacity: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                {selEl.type !== "background" && (
                  <SkewControls skewX={selEl.skewX ?? 0} skewY={selEl.skewY ?? 0} onChange={(patch) => updateText(patch)} />
                )}
                {selEl.type !== "background" && (
                  <GlowControls glow={selEl.glow ?? null} onChange={(glow) => updateText({ glow })} />
                )}
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={S.rhead}>文件</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>尺寸：{doc.w} × {doc.h} px</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>圖層數：{layersRef.current.length}</div>
              </div>
            )}
          </>
          )}
          </div>
            {/* 分隔線：往上拉一次看到更多圖層，往下拉把空間讓給上面的設定 */}
            {layersOpen
              ? <ResizeHandle label="拖曳調整圖層區高度" onPointerDown={(e) => startLayersResize(e, -1, (rpanelRef.current?.clientHeight ?? 800) - 150)} />
              : <div style={{ borderTop: "1px solid #e5e7eb" }} />}
            <SectionHeader icon={<Layers size={16} color="#7c3aed" />} title="圖層" count={panel.length} open={layersOpen} collapseDown onToggle={() => setLayersOpen((v) => !v)} />
            {/* 用 Shift 選了兩個以上：直接在圖層列表上方提示可以做什麼，工具列上的小按鈕不容易看到 */}
            {layersOpen && selectedIds.length >= 2 && (
              <div style={{ flex: "0 0 auto", margin: "8px 8px 0", padding: "10px 12px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #ddd6fe", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6", marginRight: "auto" }}>已選取 {selectedIds.length} 個圖層</span>
                <button onClick={mergeLayers} title="把選取的圖層合成一張（⌘E）"
                  style={{ height: 30, padding: "0 12px", border: "none", borderRadius: 8, background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>合併圖層 ⌘E</button>
                <button onClick={groupSelected} title="設為一組，一起移動（⌘G）"
                  style={{ height: 30, padding: "0 12px", border: "1px solid #c4b5fd", borderRadius: 8, background: "#fff", color: "#6d28d9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>群組 ⌘G</button>
              </div>
            )}
            <div style={{ display: layersOpen ? "flex" : "none", flex: "0 0 auto", height: Math.max(0, layersH - 54), overflowY: "auto", padding: 8, flexDirection: "column", gap: 6 }}>
              {panel.map((l) => (
                <div key={l.id} draggable={renamingLayerId !== l.id} onClick={(e) => e.shiftKey ? toggleSelection(l.id) : selectLayerOrGroup(l.id)}
                     onDragStart={(e) => { setDragLayerId(l.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
                     onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverLayerId(l.id); }}
                     onDragLeave={() => setDragOverLayerId((id) => id === l.id ? null : id)}
                     onDrop={(e) => { e.preventDefault(); const source = dragLayerId || e.dataTransfer.getData("text/plain"); if (source) reorderLayer(source, l.id); setDragLayerId(null); setDragOverLayerId(null); }}
                     onDragEnd={() => { setDragLayerId(null); setDragOverLayerId(null); }}
                     style={{ ...S.row, ...(selectedIds.includes(l.id) ? S.rowSel : {}), ...(l.id === dragOverLayerId && l.id !== dragLayerId ? { borderTop: "3px solid #7c3aed" } : {}), opacity: l.visible ? 1 : 0.5 }}>
                  <GripVertical size={15} style={{ flex: "0 0 auto", color: "#9ca3af", cursor: "grab" }} aria-label="拖曳排序" />
                  <div style={S.thumb}>{l.thumb ? <img src={l.thumb} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : (l.isText ? "T" : "◇")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {renamingLayerId === l.id ? <input autoFocus value={renamingLayerValue} onChange={(e) => setRenamingLayerValue(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={commitLayerRename} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenamingLayerId(null); }} style={{ ...S.rinput, height: 28, padding: "0 7px", minWidth: 0 }} /> : <span style={S.name} title="雙擊重新命名" onDoubleClick={(e) => { e.stopPropagation(); setRenamingLayerId(l.id); setRenamingLayerValue(l.name); }}>{l.name}</span>}
                      {confBadge(l.confidence)}
                    </div>
                    <div style={S.sub}>
                      {TYPE_LABEL[l.type] ?? l.type}{l.clipTo ? " · 放在形狀裡" : l.instanceId ? ` · ${l.instanceId}` : ""}
                      {l.embeddedText.length ? ` · 內嵌: ${l.embeddedText.map((t) => t.text).join(", ")}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button title="顯示/隱藏" style={{ ...S.icon, ...(l.visible ? {} : { color: "#c4b5fd" }) }} onClick={(e) => { e.stopPropagation(); toggleVis(l.id); }}>{l.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    <button title="鎖定" style={{ ...S.icon, ...(l.locked ? { color: "#7c3aed" } : {}) }} onClick={(e) => { e.stopPropagation(); toggleLock(l.id); }}>{l.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                    <button title="複製" style={S.icon} onClick={(e) => { e.stopPropagation(); duplicate(l.id); }}><Copy size={14} /></button>
                    <button title="刪除" style={{ ...S.icon, color: "#ef4444" }} onClick={(e) => { e.stopPropagation(); del(l.id); }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
        </aside>
      </div>

      {showOutpaint && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} onClick={() => !outpaintBusy && setShowOutpaint(false)} />
          <div style={{ position: "relative", width: "min(680px,92%)", maxHeight: "86vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>擴圖／改尺寸</div><p style={{ fontSize: 12, color: "#6b7280" }}>原有圖層會保留，AI 擴展結果加入最底層，可隨時隱藏或刪除。</p>
            <label style={S.rlabel}>目標比例</label><div style={{ display: "flex", gap: 8 }}>{["1:1","4:5","9:16","16:9"].map((r) => <button key={r} onClick={() => setOutpaintRatio(r)} style={{ ...S.rbtn, ...(outpaintRatio === r ? { border: "1px solid #7c3aed", color: "#7c3aed" } : {}) }}>{r}</button>)}</div>
            <label style={S.rlabel}>擴展方向</label><select value={outpaintDirection} onChange={(e) => setOutpaintDirection(e.target.value)} style={S.rinput}><option value="auto">自動／置中</option><option value="left">往左</option><option value="right">往右</option><option value="top">往上</option><option value="bottom">往下</option></select>
            <label style={S.rlabel}>構圖方式</label><select value={outpaintMode} onChange={(e) => setOutpaintMode(e.target.value as "keep" | "recompose")} style={S.rinput}><option value="keep">保留主體位置</option><option value="recompose">自動重新構圖</option></select>
            <label style={S.rlabel}>產生版本</label><input type="range" min={2} max={4} value={outpaintCount} onChange={(e) => setOutpaintCount(Number(e.target.value))} style={{ width: "100%", accentColor: "#7c3aed" }} /><div style={{ fontSize: 12, color: "#6b7280" }}>{outpaintCount} 個版本（會使用 AI 額度）</div>
            {!outpaintResult && <button onClick={generateOutpaint} disabled={outpaintBusy} style={{ ...S.rbtn, width: "100%", marginTop: 16, height: 42, background: "#7c3aed", color: "#fff" }}>{outpaintBusy ? "擴圖生成中…" : "開始擴圖"}</button>}
            {outpaintResult && <><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 16 }}>{outpaintResult.variants.map((url, i) => <button key={url} onClick={() => applyOutpaint(url)} style={{ border: "1px solid #e5e7eb", background: "#fff", padding: 6, borderRadius: 12, cursor: "pointer" }}><img src={url} alt={`版本 ${i + 1}`} style={{ width: "100%", maxHeight: 260, objectFit: "contain" }} /><span>使用版本 {i + 1}</span></button>)}</div><button onClick={generateOutpaint} style={{ ...S.rbtn, marginTop: 12 }}>重新產生</button></>}
          </div>
        </div>
      )}

      {/* 框好之後的輸入框：跟 PS 一樣，框選完就地問「要生成什麼」 */}
      {tool === "draw" && <DrawToolbar cfg={drawCfg} target={selectedIds.length === 1 && isPaintable(selEl) && selEl.visible && !selEl.locked ? selEl.name : null} onChange={(patch) => setDrawCfg((c) => ({ ...c, ...patch }))} onDone={exitDraw} />}
      {tool === "pen" && (
        <div style={{ position: "fixed", left: "50%", bottom: 124, transform: "translateX(-50%)", zIndex: 92, display: "flex", gap: 10, alignItems: "center", background: "#1f2937", color: "#f9fafb", padding: "10px 14px", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)" }}>
          <PenTool size={16} color="#c4b5fd" />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>點一下加點・按住拖曳拉曲線・點回第一個點封閉<br /><span style={{ color: "#9ca3af", fontSize: 12 }}>Enter 完成（不封閉）・Backspace 退一步・Esc 取消</span></span>
          <button onClick={() => finishPen(false)} style={{ ...S.rbtn, background: "#7c3aed", color: "#fff", border: "none", whiteSpace: "nowrap" }}>完成</button>
          <button onClick={() => { penRef.current = null; setTool("select"); render(); }} style={{ ...S.rbtn, background: "transparent", color: "#d1d5db", border: "1px solid #4b5563", whiteSpace: "nowrap" }}>取消</button>
        </div>
      )}
      {marquee && !genFillResult && (
        <div style={{ position: "fixed", left: "50%", bottom: 124, transform: "translateX(-50%)", zIndex: 92, display: "flex", gap: 8, alignItems: "center", background: "#1f2937", padding: 10, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)" }}>
          <input
            autoFocus
            value={genFillPrompt}
            onChange={(e) => setGenFillPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !genFillBusy && genFillPrompt.trim()) generateFillInMarquee("fill"); if (e.key === "Escape") { setMarquee(null); marqueeRef.current = null; render(); } }}
            placeholder="要在這塊畫什麼？（想清掉東西就按右邊的「移除」）"
            style={{ width: 340, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "#111827", color: "#f9fafb", outline: "none" }} />
          <button onClick={() => generateFillInMarquee("fill")} disabled={genFillBusy || !genFillPrompt.trim()}
            title={genFillPrompt.trim() ? "在框選的那塊畫出你打的東西" : "先打字說要畫什麼"}
            style={{ ...S.rbtn, background: "#7c3aed", color: "#fff", border: "none", opacity: (genFillBusy || !genFillPrompt.trim()) ? .5 : 1, whiteSpace: "nowrap" }}>
            {genFillBusy ? "生成中…" : "生成"}
          </button>
          {/* 移除獨立一顆，不靠關鍵字猜意圖——打「把花瓣移除」時模型會照著畫花瓣。 */}
          <button onClick={() => generateFillInMarquee("remove")} disabled={genFillBusy}
            title="把框選的東西清掉，補成乾淨的表面"
            style={{ ...S.rbtn, background: "transparent", color: "#f9fafb", border: "1px solid #4b5563", opacity: genFillBusy ? .6 : 1, whiteSpace: "nowrap" }}>
            移除
          </button>
          {genFillBusy && (
            // 不定量進度條：這一步要 15–40 秒，沒有東西在動會讓人以為當掉了。
            <span aria-hidden style={{ width: 90, height: 4, borderRadius: 2, background: "#374151", overflow: "hidden", display: "inline-block" }}>
              <span style={{ display: "block", width: "40%", height: "100%", background: "#7c3aed", animation: "genfill-progress 1.1s ease-in-out infinite" }} />
            </span>
          )}
          <style>{"@keyframes genfill-progress{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}"}</style>
          <button onClick={() => { setMarquee(null); marqueeRef.current = null; render(); }}
            style={{ ...S.rbtn, background: "transparent", color: "#d1d5db", border: "1px solid #4b5563", whiteSpace: "nowrap" }}>
            取消
          </button>
        </div>
      )}

      {/* 結果直接套在畫布上，用 ‹ › 原地換版本——不要彈窗擺一排小縮圖給人瞇著眼比。 */}
      {genFillResult && genFillResult.length > 0 && (
        <div style={{ position: "fixed", left: "50%", bottom: 124, transform: "translateX(-50%)", zIndex: 93, display: "flex", gap: 10, alignItems: "center", background: "#1f2937", padding: "10px 14px", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)", color: "#f9fafb" }}>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>只有框選的那塊被換掉</span>
          <button
            onClick={() => { const i = (genFillIndex - 1 + genFillResult.length) % genFillResult.length; setGenFillIndex(i); void previewGenFill(genFillResult[i]); }}
            style={{ ...S.rbtn, background: "transparent", color: "#f9fafb", border: "1px solid #4b5563", padding: "4px 10px" }}>‹</button>
          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{genFillIndex + 1}/{genFillResult.length}</span>
          <button
            onClick={() => { const i = (genFillIndex + 1) % genFillResult.length; setGenFillIndex(i); void previewGenFill(genFillResult[i]); }}
            style={{ ...S.rbtn, background: "transparent", color: "#f9fafb", border: "1px solid #4b5563", padding: "4px 10px" }}>›</button>
          <button onClick={commitGenFill} style={{ ...S.rbtn, background: "#7c3aed", color: "#fff", border: "none", whiteSpace: "nowrap" }}>完成</button>
          <button onClick={cancelGenFill} style={{ ...S.rbtn, background: "transparent", color: "#d1d5db", border: "1px solid #4b5563", whiteSpace: "nowrap" }}>取消</button>
        </div>
      )}

      {magicFillResult && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} onClick={() => setMagicFillResult(null)} />
          <div style={{ position: "relative", width: "min(680px,92%)", background: "#fff", borderRadius: 16, padding: 22 }}><div style={{ fontSize: 17, fontWeight: 800 }}>選擇補空白版本</div><p style={{ fontSize: 12, color: "#6b7280" }}>只延伸與畫布邊緣相連的白色／透明區域。</p><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>{magicFillResult.map((url, i) => <button key={url} onClick={() => applyMagicFill(url)} style={{ border: "1px solid #e5e7eb", background: "#fff", padding: 6, borderRadius: 12, cursor: "pointer" }}><img src={url} alt={`版本 ${i + 1}`} style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} /><span>使用版本 {i + 1}</span></button>)}</div></div>
        </div>
      )}

      {showLogo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} onClick={() => setShowLogo(false)} />
          <div style={{ position: "relative", width: "min(460px,92%)", maxHeight: "80vh", background: "#fff", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1f2937", marginBottom: 12 }}>選擇 Logo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, overflowY: "auto" }}>
              {(logos ?? []).map((url, i) => (
                <button key={i} onClick={() => { setShowLogo(false); pushImageLayer(url, "Logo"); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>
                  <img src={url} alt="" style={{ width: "100%", height: 56, objectFit: "contain" }} />
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>標誌 {i + 1}</span>
                </button>
              ))}
              {/* 上傳一個 logo（同微調畫布：品牌版本 + 上傳） */}
              <button onClick={() => uploadLogoRef.current?.click()}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: 10, border: "2px dashed #d1d5db", background: "#fff", color: "#7c3aed", cursor: "pointer", minHeight: 90 }}>
                <Upload size={18} /><span style={{ fontSize: 11, fontWeight: 600 }}>上傳標誌</span>
              </button>
            </div>
            {(logos ?? []).length === 0 && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>此品牌尚未設定 Logo，可直接上傳一個。</div>}
            <input ref={uploadLogoRef} type="file" accept="image/*" onChange={onUploadLogo} style={{ display: "none" }} />
          </div>
        </div>
      )}

      {showIcon && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} onClick={() => setShowIcon(false)} />
          <div style={{ position: "relative", width: "min(420px,92%)", background: "#fff", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1f2937", marginBottom: 12 }}>選擇圖標</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {ICON_NAMES.map((nm) => (
                <button key={nm} onClick={() => addIcon(nm)} title={nm}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>
                  <img src={iconPreview(nm)} alt={nm} style={{ width: 30, height: 30 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showShape && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} onClick={() => setShowShape(false)} />
          <div style={{ position: "relative", width: "min(440px,92%)", background: "#fff", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1f2937", marginBottom: 12 }}>選擇形狀</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {SHAPE_PRESETS.map((p) => (
                <button key={p.label} onClick={() => addShapeKind(p.spec, p.label)} title={p.label}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>
                  <img src={shapePreview(p.spec)} alt={p.label} style={{ width: 34, height: 34 }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{p.label}</span>
                </button>
              ))}
              <button onClick={() => { setShowShape(false); penRef.current = null; setTool("pen"); applySelection([]); }} title="自己畫形狀：點一下加點、按住拖曳拉曲線"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px", borderRadius: 10, border: "1px solid #c4b5fd", background: "#f5f3ff", cursor: "pointer" }}>
                <PenTool size={30} color="#7c3aed" strokeWidth={1.8} />
                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>鋼筆（自己畫）</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function confBadge(c: number) {
  if (c >= 0.85) return null;
  const ai = c >= 0.6;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: ai ? "rgba(255,177,78,.16)" : "rgba(255,93,108,.16)", color: ai ? "#ffb14e" : "#ff5d6c" }}>{ai ? "AI 判斷" : "需確認"}</span>;
}
/** 畫一個圖層的內容（已經換到圖層座標系）：圖片／文字／形狀，再加上畫在圖片上的筆畫。 */
function drawElBody(ctx: CanvasRenderingContext2D, l: EL) {
  // 外光暈先畫（在內容底下）；文字自己的「陰影」效果在光暈那一趟關掉，不然會蓋掉光暈的設定
  if (l.glow) drawGlow(ctx, l.glow, () => drawElContent(ctx, l.fx?.shadow ? { ...l, fx: { ...l.fx, shadow: false } } : l));
  drawElContent(ctx, l);
  drawPaint(ctx, l.paint, l.w, l.h);
}
function drawElContent(ctx: CanvasRenderingContext2D, l: EL) {
  if (l.canvas) { ctx.imageSmoothingQuality = "high"; ctx.drawImage(l.canvas, -l.w / 2, -l.h / 2, l.w, l.h); }
  else if (l.isText) drawTextEl(ctx, l);
  else if (l.shape) drawEditableShape(ctx, l.w, l.h, l.shape);
}

/** 可以「畫在上面」的圖層：圖片圖層（產品照、背景、合併後的圖…），文字、形狀、繪製線條不算。 */
function isPaintable(l: EL | null | undefined): l is EL {
  return !!l && !!l.canvas && !l.isText && !l.shape && l.type !== "drawing";
}

function makeThumb(l: EL): string | null {
  const max = 76, c = document.createElement("canvas");
  if (l.shape) {
    const ar = l.w / (l.h || 1); let w = max, h = max / ar; if (h > max) { h = max; w = max * ar; }
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const g = c.getContext("2d")!;
    g.save(); g.translate(c.width / 2, c.height / 2); drawEditableShape(g, c.width * 0.86, c.height * 0.86, l.shape); g.restore();
    try { return c.toDataURL("image/png"); } catch { return null; }
  }
  if (l.isText) {
    c.width = max; c.height = Math.round(max * 0.5); const g = c.getContext("2d")!;
    g.fillStyle = "#f5f3ff"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#7c3aed"; g.font = "600 20px 'Noto Sans TC',sans-serif"; g.textBaseline = "middle";
    g.fillText((l.text || "T").slice(0, 7), 6, c.height / 2);
    try { return c.toDataURL("image/png"); } catch { return null; }
  }
  if (!l.canvas) return null;
  const w = l.canvas.width, h = l.canvas.height, s = Math.min(max / w, max / h, 1);
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  try {
    const g = c.getContext("2d")!; g.drawImage(l.canvas, 0, 0, c.width, c.height);
    if (l.paint?.length) { g.translate(c.width / 2, c.height / 2); drawPaint(g, l.paint, c.width, c.height); }
    return c.toDataURL("image/png");
  } catch { return null; }
}
function sampleColor(sctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): string {
  try {
    const d = sctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h)).data;
    const px: number[][] = []; const step = Math.max(4, Math.floor(d.length / 4 / 600) * 4);
    for (let i = 0; i < d.length; i += step) px.push([d[i], d[i + 1], d[i + 2]]);
    px.sort((a, b) => lum(a) - lum(b));
    const half = px.slice(0, Math.max(1, Math.floor(px.length / 2)));
    const s = half.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
    const n = half.length; return `rgb(${Math.round(s[0] / n)},${Math.round(s[1] / n)},${Math.round(s[2] / n)})`;
  } catch { return "#222"; }
}
const lum = (p: number[]) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
/** #rrggbb（去掉透明度）；不是 hex 就給預設紫色，color input 只吃這種格式。 */
function hexColor(c: string): string { return /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : "#7c3aed"; }
/** 往白色混 amount（0–1）。 */
function lighten(hex: string, amount: number): string {
  const c = hexColor(hex);
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) + (255 - parseInt(c.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, "0")).join("");
}
/** #rrggbbaa 的透明度（0–1）；沒帶就是不透明。 */
function hexAlpha(c: string): number { return /^#[0-9a-f]{8}$/i.test(c) ? parseInt(c.slice(7, 9), 16) / 255 : 1; }
function withAlpha(c: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return v >= 255 ? hexColor(c) : `${hexColor(c)}${v.toString(16).padStart(2, "0")}`;
}
function toHex(c: string): string {
  if (!c) return "#241f47";
  if (c[0] === "#") return c;
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? "#" + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("") : "#241f47";
}
/** Draw a vector layer. Assumes ctx is already translated to the layer centre + rotated. */
function drawTextEl(ctx: CanvasRenderingContext2D, l: EL) {
  const fx = l.fx;
  const fs = l.fontSize * (l.w / (l.naturalW || l.w));
  ctx.font = `${fx?.italic ? "italic " : ""}${l.fontWeight} ${fs}px ${l.fontFamily}`;
  ctx.textBaseline = "middle"; ctx.textAlign = l.align;
  if (l.textLayout) ctx.letterSpacing = `${l.textLayout.letterSpacing * (l.w / (l.naturalW || l.w))}px`;
  if (fx?.letterSpacing != null) { try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${fx.letterSpacing}px`; } catch { /* older canvas */ } }
  const tx = l.align === "left" ? -l.w / 2 : l.align === "right" ? l.w / 2 : 0;
  let fill: string | CanvasGradient = l.color;
  if (fx?.gradient) { const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); g.addColorStop(0, fx.gradient[0]); g.addColorStop(1, fx.gradient[1]); fill = g; }
  const warped = fx?.warp && fx.warp !== "none";
  if (warped) { drawWarpedText(ctx, l.text, l.w, fs, fx!, fill); return; }
  // 沒有 textLayout 的文字圖層（自己加的、範本帶來的）原本直接 fillText 整串，
  // 所以使用者打了換行畫布上還是連成一行。這裡自己斷行並上下置中排版。
  // 有 textLayout 的走 drawEditableText，它本來就會處理段落。
  const lines = l.textLayout ? null : l.text.split("\n");
  const lineHeight = fs * 1.25;
  const firstY = lines ? -((lines.length - 1) * lineHeight) / 2 : 0;

  if (fx?.strokeW && fx.strokeW > 0) {
    ctx.lineWidth = fs * fx.strokeW; ctx.strokeStyle = fx.strokeColor || "#ffffff";
    ctx.lineJoin = "round"; ctx.miterLimit = 2;
    if (lines) lines.forEach((line, i) => ctx.strokeText(line, tx, firstY + i * lineHeight));
  }
  if (fx?.shadow) { ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = fs * 0.1; ctx.shadowOffsetX = fs * 0.03; ctx.shadowOffsetY = fs * 0.06; }
  ctx.fillStyle = fill;
  if (l.textLayout) {
    drawEditableText(ctx, { text: l.text, width: l.w, height: l.h, fontSize: fs, align: l.align, layout: l.textLayout, stroke: Boolean(fx?.strokeW) });
  } else if (l.runs?.length) {
    drawRunText(ctx, l, lines ?? [l.text], fs, lineHeight, firstY, fill);
  } else {
    (lines ?? [l.text]).forEach((line, i) => ctx.fillText(line, tx, firstY + i * lineHeight));
  }
}

/**
 * 逐段畫文字：讓同一個圖層裡的某幾個字有自己的字級／顏色／字重。
 *
 * 不能整行 fillText 之後再蓋——字寬不同，位置會對不上。所以先把每一行依
 * 分段切成小片，量出整行實際寬度來決定對齊起點，再一片一片往右推。
 * 每片的基線都對齊同一條（textBaseline 用 alphabetic 手動算），
 * 否則放大的字會上下亂跳。
 */
function drawRunText(
  ctx: CanvasRenderingContext2D, l: EL, lines: string[],
  baseFs: number, lineHeight: number, firstY: number, fill: string | CanvasGradient,
) {
  const runs = l.runs ?? [];
  const scale = l.w / (l.naturalW || l.w);
  const fx = l.fx;
  // 某個字元屬於哪一段（後定義的優先，方便重複套用）
  const styleAt = (i: number) => {
    for (let r = runs.length - 1; r >= 0; r -= 1) {
      if (i >= runs[r].start && i < runs[r].end) return runs[r];
    }
    return undefined;
  };
  const fontFor = (st?: TextRun) =>
    `${fx?.italic ? "italic " : ""}${st?.fontWeight ?? l.fontWeight} ${(st?.fontSize ?? l.fontSize) * scale}px ${l.fontFamily}`;

  let offset = 0;
  lines.forEach((line, li) => {
    // 依樣式把這一行切成連續的小片
    const pieces: { text: string; st?: TextRun }[] = [];
    for (let i = 0; i < line.length; i += 1) {
      const st = styleAt(offset + i);
      const last = pieces[pieces.length - 1];
      if (last && last.st === st) last.text += line[i];
      else pieces.push({ text: line[i], st });
    }
    const widths = pieces.map((piece) => { ctx.font = fontFor(piece.st); return ctx.measureText(piece.text).width; });
    const total = widths.reduce((a, b) => a + b, 0);
    let x = l.align === "left" ? -l.w / 2 : l.align === "right" ? l.w / 2 - total : -total / 2;
    const y = firstY + li * lineHeight;

    ctx.save();
    ctx.textAlign = "left";
    pieces.forEach((piece, pi) => {
      ctx.font = fontFor(piece.st);
      if (fx?.strokeW && fx.strokeW > 0) {
        ctx.lineWidth = (piece.st?.fontSize ?? l.fontSize) * scale * fx.strokeW;
        ctx.strokeStyle = fx.strokeColor || "#ffffff";
        ctx.lineJoin = "round"; ctx.miterLimit = 2;
        ctx.strokeText(piece.text, x, y);
      }
      ctx.fillStyle = piece.st?.color ?? fill;
      ctx.fillText(piece.text, x, y);
      x += widths[pi];
    });
    ctx.restore();
    offset += line.length + 1;   // +1 是被 split 掉的換行字元
  });
}

function drawWarpedText(ctx: CanvasRenderingContext2D, text: string, width: number, fs: number, fx: TextFx, fill: string | CanvasGradient) {
  const chars = [...text]; if (!chars.length) return;
  const spacing = fx.letterSpacing ?? 0;
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0), scale = Math.min(1, width / Math.max(1, total));
  let x = -total * scale / 2; const amp = fs * ((fx.warpAmount ?? 35) / 100);
  chars.forEach((ch, i) => {
    const cw = widths[i] * scale, p = chars.length === 1 ? .5 : i / (chars.length - 1); let y = 0, angle = 0;
    if (fx.warp === "wave") { const phase = p * Math.PI * 2 * (fx.waveCount ?? 2); y = Math.sin(phase) * amp; angle = Math.atan(Math.cos(phase) * amp * Math.PI * 2 * (fx.waveCount ?? 2) / Math.max(width, 1)); }
    else {
      // 圓弧基線：所有字都貼著同一個圓的切線，粗中文字兩端不會突然折起。
      const chord = Math.max(1, total * scale), half = chord / 2;
      const sagitta = Math.min(Math.max(1, amp), half * 0.46);
      const radius = chord * chord / (8 * sagitta) + sagitta / 2;
      const px = Math.max(-half, Math.min(half, x + cw / 2));
      const edgeY = Math.sqrt(Math.max(0, radius * radius - half * half));
      const circleY = Math.sqrt(Math.max(0, radius * radius - px * px));
      const sign = fx.warp === "arc-up" ? -1 : 1;
      y = sign * (circleY - edgeY);
      angle = Math.atan(sign * (-px / Math.max(1, circleY)));
    }
    ctx.save(); ctx.translate(x + cw / 2, y); ctx.rotate(angle); ctx.scale(scale, scale);
    if (fx.strokeW && fx.strokeW > 0) { ctx.lineWidth = fs * fx.strokeW; ctx.strokeStyle = fx.strokeColor || "#fff"; ctx.lineJoin = "round"; ctx.strokeText(ch, 0, 0); }
    if (fx.shadow) { ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = fs * .1; ctx.shadowOffsetY = fs * .06; }
    ctx.fillStyle = fill; ctx.fillText(ch, 0, 0); ctx.restore(); x += cw;
  });
}

/** Programmatic icon set (24-unit space, centred at 0). Reliable + recolourable. */
const ICON_NAMES = EDITABLE_ICON_NAMES;


// 複製一個圖層（歷史快照用）：clone 可變欄位；canvas/thumb 以參照保留（它們整顆替換而非就地改）。
/** 把一頁的圖層轉成存檔格式。 */
function serializeEls(els: EL[]): SavedLayer[] {
  return els.map((l, i) => ({
    id: l.id, name: l.name, type: l.type, zIndex: i,
    x: l.cx - l.w / 2, y: l.cy - l.h / 2, w: l.w, h: l.h, rotation: l.rotation,
    visible: l.visible, opacity: l.opacity, locked: l.locked, groupId: l.groupId ?? null,
    ...(l.clipTo ? { clipTo: l.clipTo } : {}),
    ...(l.skewX ? { skewX: l.skewX } : {}), ...(l.skewY ? { skewY: l.skewY } : {}),
    ...(l.paint?.length ? { paint: l.paint } : {}),
    ...(l.glow ? { glow: { ...l.glow } } : {}),
    ...(l.isText
      ? { isText: true, text: l.text, color: l.color, fontSize: l.fontSize * (l.w / (l.naturalW || l.w)), fontFamily: l.fontFamily, fontWeight: l.fontWeight, align: l.align, ...(l.fx ? { fx: l.fx } : {}), ...(l.textLayout ? { textLayout: { ...l.textLayout, letterSpacing: l.textLayout.letterSpacing * (l.w / (l.naturalW || l.w)) } } : {}),
          // 分段樣式的字級跟著圖層縮放一起換算，否則存檔重開會跑掉
          ...(l.runs?.length ? { runs: l.runs.map((r) => ({ ...r, ...(r.fontSize ? { fontSize: r.fontSize * (l.w / (l.naturalW || l.w)) } : {}) })) } : {}) }
      : l.shape
        ? { shape: { ...l.shape } }
        : { image: l.src ?? (l.canvas ? (safeDataUrl(l.canvas) ?? undefined) : undefined), ...(l.isArt ? { isArt: true, text: l.text, ...(l.artRefImage ? { artRefImage: l.artRefImage } : {}) } : {}) }),
  }));
}

type EditorPage = {
  id: string; name: string; w: number; h: number;
  /** null＝還沒轉回圖層（存檔讀回來的頁，在背景轉換中）。 */
  els: EL[] | null; loading: Promise<EL[]> | null;
  history: EL[][]; histIdx: number; savedIdx: number;
  thumb: string | null;
};
const PAGE_THUMB = 140;

/** 存檔成功後：每一頁目前的復原位置都算「已存」。 */
function markPagesSaved(pages: EditorPage[], current: number, currentHistIdx: number) {
  pages.forEach((p, i) => { p.savedIdx = i === current ? currentHistIdx : p.histIdx; });
}

/** 把一頁的圖層畫成一張圖（maxSide 有給就縮小，用來做縮圖）。 */
function flattenEls(els: EL[], w: number, h: number, maxSide?: number): string {
  const k = maxSide ? Math.min(1, maxSide / Math.max(w, h)) : 1;
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(k, k);
  for (const l of els) {
    if (!l.visible) continue;
    ctx.save(); applyClip(ctx, l, els); applyLayerTransform(ctx, l); ctx.globalAlpha = l.opacity;
    drawElBody(ctx, l);
    ctx.restore();
  }
  try { return c.toDataURL("image/png"); } catch { return ""; }
}

/** 複製整頁：每個圖層完整獨立一份、換新 id，群組和遮色片的對應也跟著換。 */
function duplicateEls(els: EL[]): EL[] {
  const idMap = new Map<string, string>(), groupMap = new Map<string, string>();
  const out = els.map((l) => {
    const c = cloneLayerDeep(l);
    c.id = `${l.id.split("_pg")[0]}_pg${crypto.randomUUID().slice(0, 6)}`; idMap.set(l.id, c.id);
    if (l.groupId) { if (!groupMap.has(l.groupId)) groupMap.set(l.groupId, `group_${crypto.randomUUID().slice(0, 8)}`); c.groupId = groupMap.get(l.groupId)!; }
    return c;
  });
  for (const c of out) if (c.clipTo) c.clipTo = idMap.get(c.clipTo) ?? null;
  return out;
}

/**
 * 畫布下方的頁面列（像 Canva）：點縮圖切換、拖曳排序；滑鼠移上去可以複製、刪除；
 * 最後一格加空白頁。只有一頁時也顯示，讓人知道可以加頁。
 */
function PageStrip({ pages, current, currentThumb, onSelect, onAdd, onDuplicate, onDelete, onMove, onRename }: {
  pages: { id: string; name: string; thumb: string | null; w: number; h: number }[]; current: number; currentThumb: string | null;
  onSelect: (i: number) => void; onAdd: () => void; onDuplicate: () => void; onDelete: (i: number) => void; onMove: (from: number, to: number) => void;
  onRename: (i: number, name: string) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ i: number; value: string } | null>(null);
  const H = 64;
  const list = pages.length ? pages : [{ id: "page-1", name: "", thumb: null, w: 1, h: 1 }];
  const tile = (active: boolean): React.CSSProperties => ({ position: "relative", height: H, flex: "0 0 auto", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#fff",
    border: active ? "2px solid #7c3aed" : "1px solid #e5e7eb", boxShadow: active ? "0 0 0 3px #ede9fe" : "none" });
  return (
    <div style={{ flex: "0 0 auto", height: 98, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: "#fff", borderTop: "1px solid #e5e7eb", overflowX: "auto" }}>
      {list.map((p, i) => {
        const thumb = i === current ? currentThumb ?? p.thumb : p.thumb;
        return (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) onMove(drag, i); setDrag(null); }} onDragEnd={() => setDrag(null)}
              onClick={() => onSelect(i)} title={`${p.name || `第 ${i + 1} 頁`}（拖曳可以排序）`}
              style={{ ...tile(i === current), width: Math.round(H * (p.w / p.h || 1)), opacity: drag === i ? 0.4 : 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb ? <img src={thumb} alt={`第 ${i + 1} 頁`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: "#f3f4f6" }} />}
              {hover === i && (
                <div style={{ position: "absolute", top: 3, right: 3, display: "flex", gap: 3 }}>
                  {i === current && (
                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="複製這一頁"
                      style={{ width: 20, height: 20, border: "none", borderRadius: 5, background: "rgba(17,24,39,.75)", color: "#fff", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}><Copy size={12} /></button>
                  )}
                  {list.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(i); }} title="刪除這一頁"
                      style={{ width: 20, height: 20, border: "none", borderRadius: 5, background: "rgba(17,24,39,.75)", color: "#fff", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}><Trash2 size={12} /></button>
                  )}
                </div>
              )}
            </div>
            {editing?.i === i ? (
              <input autoFocus value={editing.value} maxLength={40}
                onChange={(e) => setEditing({ i, value: e.target.value })}
                onBlur={() => { onRename(i, editing.value); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onRename(i, editing.value); setEditing(null); } if (e.key === "Escape") setEditing(null); e.stopPropagation(); }}
                style={{ width: 88, height: 20, fontSize: 11, textAlign: "center", border: "1px solid #c4b5fd", borderRadius: 5, outline: "none", padding: "0 4px" }} />
            ) : (
              <span onDoubleClick={() => setEditing({ i, value: p.name })} title="雙擊改名"
                style={{ maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, cursor: "text", color: i === current ? "#7c3aed" : "#6b7280", fontWeight: i === current ? 700 : 500 }}>
                {p.name || `第 ${i + 1} 頁`}
              </span>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 4 }}>
        <button onClick={onAdd} title="在這一頁後面加一個空白頁"
          style={{ height: 28, padding: "0 12px", border: "1px dashed #c4b5fd", borderRadius: 8, background: "#faf5ff", color: "#7c3aed", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <Plus size={13} /> 新增頁面
        </button>
        <button onClick={onDuplicate} title="把這一頁完整複製一份放在後面（做輪播最方便）"
          style={{ height: 28, padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <Copy size={13} /> 複製這頁
        </button>
      </div>
    </div>
  );
}

function cloneEL(el: EL): EL {
  return { ...el, textLayout: el.textLayout ? { ...el.textLayout } : undefined, shape: el.shape ? { ...el.shape } : null, fx: el.fx ? { ...el.fx } : el.fx, embeddedText: el.embeddedText.map((t) => ({ ...t })), paint: el.paint?.slice(), glow: el.glow ? { ...el.glow } : el.glow };
}
function iconPreview(name: string): string {
  const c = document.createElement("canvas"); c.width = 40; c.height = 40;
  const g = c.getContext("2d")!; g.translate(20, 20); drawIcon(g, 30, name, "#374151");
  try { return c.toDataURL("image/png"); } catch { return ""; }
}
/**
 * 「圓角矩形」的圓角：用記號值，加形狀時換算成邊長的 18%。
 * 之前直接給 9999，會被夾成邊長的一半——正方形就變成正圓，選單上的圖示也是圓的。
 */
const ROUNDED_RADIUS = -1;
const roundedRadius = (spec: Partial<ShapeSpec>, size: number) => (spec.radius === ROUNDED_RADIUS ? Math.round(size * 0.18) : spec.radius);
// 形狀選擇器：預設清單（參考 PS）＋縮圖
const SHAPE_PRESETS: { label: string; spec: Partial<ShapeSpec> & { kind: ShapeKind } }[] = [
  { label: "矩形", spec: { kind: "rect", radius: 0 } },
  { label: "圓角矩形", spec: { kind: "rect", radius: ROUNDED_RADIUS } },
  { label: "橢圓", spec: { kind: "ellipse" } },
  { label: "三角形", spec: { kind: "triangle" } },
  { label: "菱形", spec: { kind: "diamond" } },
  { label: "五邊形", spec: { kind: "polygon", sides: 5 } },
  { label: "六邊形", spec: { kind: "polygon", sides: 6 } },
  { label: "星形", spec: { kind: "star", sides: 5 } },
];
function shapePreview(spec: Partial<ShapeSpec> & { kind: ShapeKind }): string {
  const c = document.createElement("canvas"); c.width = 44; c.height = 44;
  const g = c.getContext("2d")!; g.translate(22, 22);
  const full: ShapeSpec = { fill: "#374151", stroke: "none", strokeWidth: 0, ...spec, radius: roundedRadius(spec, 30) };
  const sz = 34;
  const r = full.radius && full.radius > 0 ? Math.min(full.radius, sz / 2) : 0;
  drawEditableShape(g, sz, sz, { ...full, radius: r });
  try { return c.toDataURL("image/png"); } catch { return ""; }
}
function safeDataUrl(c: HTMLCanvasElement): string | undefined {
  try { return c.toDataURL("image/png"); } catch { return undefined; }
}
function loadToCanvas(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d", { willReadFrequently: true })!.drawImage(im, 0, 0); resolve(c); };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/* ---------- inline styles (self-contained; no CSS import needed) ---------- */
/**
 * 剪裁遮色片：畫這一層之前，先用它指定的形狀輪廓剪裁（在形狀自己的座標下描輪廓，
 * 再把座標轉回來）。形狀被隱藏也照樣剪——這樣可以做出「只看得到裁好的圖、看不到框」。
 */
/** 形狀的漸層填色：起點／終點顏色與透明度、方向，上面一條即時預覽。 */
function GradientEditor({ g, onChange }: { g: NonNullable<ShapeSpec["gradient"]>; onChange: (g: NonNullable<ShapeSpec["gradient"]>) => void }) {
  const set = (patch: Partial<typeof g>) => onChange({ ...g, ...patch });
  const css = g.axis === "radial" ? `radial-gradient(circle, ${g.from}, ${g.to})`
    : `linear-gradient(${g.axis === "horizontal" ? "90deg" : g.axis === "diagonal" ? "135deg" : "180deg"}, ${g.from}, ${g.to})`;
  const stop = (key: "from" | "to", label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ width: 28, fontSize: 12, color: "#6b7280" }}>{label}</span>
      <input type="color" aria-label={`${label}顏色`} value={hexColor(g[key])} onChange={(e) => set({ [key]: withAlpha(e.target.value, hexAlpha(g[key])) })}
        style={{ width: 36, height: 30, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
      <input type="range" aria-label={`${label}透明度`} min={0} max={100} value={Math.round(hexAlpha(g[key]) * 100)} onChange={(e) => set({ [key]: withAlpha(g[key], Number(e.target.value) / 100) })}
        style={{ flex: 1, accentColor: "#7c3aed" }} />
      <span style={{ width: 34, textAlign: "right", fontSize: 11, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{Math.round(hexAlpha(g[key]) * 100)}%</span>
    </div>
  );
  return (<>
    {/* 棋盤格底：看得出透明的部分 */}
    <div aria-hidden style={{ height: 22, borderRadius: 6, marginBottom: 8, border: "1px solid #e5e7eb", background: `${css}, repeating-conic-gradient(#f3f4f6 0 25%, #fff 0 50%) 0 0 / 10px 10px` }} />
    {stop("from", "起點")}
    {stop("to", "終點")}
    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
      {([["vertical", "上→下"], ["horizontal", "左→右"], ["diagonal", "斜角"], ["radial", "放射"]] as const).map(([axis, label]) => (
        <button key={axis} onClick={() => set({ axis })}
          style={{ ...S.rbtn, flex: 1, padding: 0, height: 30, fontSize: 12, ...(g.axis === axis ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}>{label}</button>
      ))}
    </div>
    <button onClick={() => set({ from: g.to, to: g.from })} style={{ ...S.rbtn, width: "100%", marginTop: 6, height: 30, fontSize: 12 }}>⇅ 對調起點與終點</button>
  </>);
}

/**
 * 素材庫的一張縮圖。滑鼠移上去（觸控裝置點一下）出現兩個用途：
 * 設為背景（換掉目前的背景）、加入畫布（加成一張可以移動縮放的圖）。
 * 也可以直接拖到畫布上想放的位置。
 */
function MaterialThumb({ url, label, onUseAsBackground, onAddToCanvas }: { url: string; label: string; onUseAsBackground: () => void; onAddToCanvas: () => void }) {
  const [active, setActive] = useState(false);
  const btn: React.CSSProperties = { width: "100%", height: 24, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" };
  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", aspectRatio: "1" }}
      onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)} onClick={() => setActive(true)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} title={label} draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/ml-image-url", url); e.dataTransfer.effectAllowed = "copy"; }}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "grab" }} />
      {active && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,.55)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, padding: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); setActive(false); onUseAsBackground(); }} style={{ ...btn, background: "#fff", color: "#1f2937" }}>設為背景</button>
          <button onClick={(e) => { e.stopPropagation(); setActive(false); onAddToCanvas(); }} style={{ ...btn, background: "#7c3aed", color: "#fff" }}>加入畫布</button>
        </div>
      )}
    </div>
  );
}

/** 傾斜：水平傾斜把方塊推成平行四邊形（斜的標籤），垂直傾斜則是上下方向。文字、形狀、圖片都能用。 */
/**
 * 對齊列（像 Figma 面板最上面那排）：靠左／水平置中／靠右｜靠上／垂直置中／靠下｜水平均分／垂直均分。
 * units＝選取裡有幾塊：1 塊對齊畫布，2 塊以上對齊彼此，3 塊以上才能均分。
 */
function AlignBar({ units, onAlign }: { units: number; onAlign: (mode: AlignMode) => void }) {
  if (!units) return null;
  const target = units === 1 ? "對齊畫布" : `對齊選取的 ${units} 個`;
  const btn = (mode: AlignMode, icon: React.ReactNode, label: string, key: string, disabled = false) => (
    <button key={mode} onClick={() => onAlign(mode)} disabled={disabled} aria-label={label}
      title={disabled ? "選三個以上才能均分" : `${label}（${units === 1 ? "對齊畫布" : "對齊選取範圍"}）${key ? ` ${key}` : ""}`}
      style={{ ...S.icon, width: 30, height: 30, borderRadius: 6, color: disabled ? "#d1d5db" : "#374151", cursor: disabled ? "not-allowed" : "pointer" }}>{icon}</button>
  );
  const sep = <span aria-hidden style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 2px" }} />;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{target}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        {btn("left", <AlignStartVertical size={16} />, "靠左對齊", "⌥A")}
        {btn("hcenter", <AlignCenterVertical size={16} />, "水平置中", "⌥H")}
        {btn("right", <AlignEndVertical size={16} />, "靠右對齊", "⌥D")}
        {sep}
        {btn("top", <AlignStartHorizontal size={16} />, "靠上對齊", "⌥W")}
        {btn("vcenter", <AlignCenterHorizontal size={16} />, "垂直置中", "⌥V")}
        {btn("bottom", <AlignEndHorizontal size={16} />, "靠下對齊", "⌥S")}
        {sep}
        {btn("hdistribute", <AlignHorizontalDistributeCenter size={16} />, "水平均分", "", units < 3)}
        {btn("vdistribute", <AlignVerticalDistributeCenter size={16} />, "垂直均分", "", units < 3)}
      </div>
    </div>
  );
}

/**
 * 外光暈（像 PS 圖層樣式）：開關＋顏色／大小／透明度／強度。
 * 物件、形狀、文字都能用；光暈沿著內容輪廓，去背的產品就沿著產品邊緣發光。
 */
function GlowControls({ glow, onChange }: { glow: LayerGlow | null; onChange: (glow: LayerGlow | null) => void }) {
  const row = (label: string, value: number, min: number, max: number, unit: string, set: (v: number) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ width: 44, fontSize: 12, color: "#6b7280", flex: "0 0 auto" }}>{label}</span>
      <input type="range" aria-label={`外光暈${label}`} min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "#7c3aed" }} />
      <span style={{ width: 42, textAlign: "right", fontSize: 12, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 14, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginRight: "auto" }}>外光暈</span>
        {glow && <input type="color" aria-label="外光暈顏色" title="光暈顏色" value={hexColor(glow.color)} onChange={(e) => onChange({ ...glow, color: e.target.value })} style={{ width: 32, height: 26, border: "1px solid #e5e7eb", borderRadius: 6, padding: 0, cursor: "pointer" }} />}
        <button onClick={() => onChange(glow ? null : { ...DEFAULT_GLOW })} aria-pressed={!!glow}
          style={{ ...S.rbtn, height: 28, padding: "0 12px", fontSize: 12, ...(glow ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}>{glow ? "關閉" : "加上光暈"}</button>
      </div>
      {glow && (<>
        {row("大小", glow.size, 1, 120, "px", (v) => onChange({ ...glow, size: v }))}
        {row("透明度", Math.round(glow.opacity * 100), 5, 100, "%", (v) => onChange({ ...glow, opacity: v / 100 }))}
        {row("強度", glow.strength, 1, 5, "", (v) => onChange({ ...glow, strength: v }))}
      </>)}
    </div>
  );
}

function SkewControls({ skewX, skewY, onChange }: { skewX: number; skewY: number; onChange: (patch: { skewX?: number; skewY?: number }) => void }) {
  const row = (label: string, value: number, key: "skewX" | "skewY") => (<>
    <label style={S.rlabel}>{label} <span style={{ float: "right", color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{Math.round(value)}°</span></label>
    <input type="range" min={-60} max={60} value={Math.round(value)} onChange={(e) => onChange({ [key]: Number(e.target.value) })}
      onDoubleClick={() => onChange({ [key]: 0 })} title="雙擊歸零" style={{ width: "100%", accentColor: "#7c3aed" }} />
  </>);
  return (<>
    {row("水平傾斜", skewX, "skewX")}
    {row("垂直傾斜", skewY, "skewY")}
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      {[-15, 15].map((v) => (
        <button key={v} onClick={() => onChange({ skewX: v, skewY: 0 })} style={{ ...S.rbtn, flex: 1, height: 30, fontSize: 12 }}>{v < 0 ? "往左斜" : "往右斜"} {Math.abs(v)}°</button>
      ))}
      {(skewX || skewY) ? <button onClick={() => onChange({ skewX: 0, skewY: 0 })} style={{ ...S.rbtn, flex: 1, height: 30, fontSize: 12 }}>取消傾斜</button> : null}
    </div>
  </>);
}

/** 右側面板「放進形狀（剪裁遮色片）」：選到圖片時出現。 */
function ClipPanel({ frameName, frames, onPut, onFit, onTakeOut }: {
  frameName: string | null;
  frames: { id: string; name: string; shape: ShapeSpec }[];
  onPut: (frameId: string) => void; onFit: () => void; onTakeOut: () => void;
}) {
  const swatch = (sh: ShapeSpec): React.CSSProperties => ({
    width: 18, height: 18, flex: "0 0 auto", border: "1px solid #d1d5db",
    background: sh.gradient ? `linear-gradient(180deg, ${sh.gradient.from}, ${sh.gradient.to})` : sh.fill === "none" ? "#fff" : sh.fill,
    borderRadius: sh.kind === "ellipse" ? "50%" : sh.kind === "rect" ? Math.min(6, (sh.radius ?? 0) / 4) : 3,
  });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={S.rhead}>放進形狀（剪裁遮色片）</div>
      {frameName !== null ? (<>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
          已放進「{frameName}」。拖這張圖可以調整在框裡的位置；拖形狀會連圖一起移動。
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onFit} style={{ ...S.rbtn, flex: 1 }}>填滿形狀</button>
          <button onClick={onTakeOut} style={{ ...S.rbtn, flex: 1 }}>拿出來</button>
        </div>
      </>) : frames.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>先用左邊「工具 → 形狀」加一個圓形、圓角方形或星形，再回來把圖放進去。</div>
      ) : (<>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>選一個形狀，圖只會顯示在形狀裡面。</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
          {frames.map((f) => (
            <button key={f.id} onClick={() => onPut(f.id)} style={{ ...S.rbtn, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", height: 36 }}>
              <span aria-hidden style={swatch(f.shape)} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>放進「{f.name}」</span>
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

/**
 * 完整複製一個圖層：形狀、漸層、鋼筆節點、文字特效、分段樣式、圖片像素都各自一份。
 * 只用 {...l} 的話這些設定是跟原本共用的，改複本的顏色原本也會跟著變。
 */
function cloneLayerDeep(l: EL): EL {
  const canvas = l.canvas ? (() => { const c = document.createElement("canvas"); c.width = l.canvas.width; c.height = l.canvas.height; c.getContext("2d")!.drawImage(l.canvas, 0, 0); return c; })() : null;
  return {
    ...l,
    canvas,
    shape: l.shape ? { ...l.shape, ...(l.shape.gradient ? { gradient: { ...l.shape.gradient } } : {}), ...(l.shape.points ? { points: l.shape.points.map((p) => ({ ...p })) } : {}) } : null,
    fx: l.fx ? { ...l.fx, ...(l.fx.gradient ? { gradient: [...l.fx.gradient] as [string, string] } : {}) } : l.fx,
    runs: l.runs?.map((r) => ({ ...r })),
    textLayout: l.textLayout ? { ...l.textLayout } : l.textLayout,
    embeddedText: l.embeddedText.map((t) => ({ ...t })),
    paint: l.paint?.map((st) => ({ ...st, points: st.points.map((p) => ({ ...p })) })),
    glow: l.glow ? { ...l.glow } : l.glow,
  };
}

/**
 * ⌘C 複製的圖層。放在模組層級：換到另一份草稿（同一個分頁）也貼得過去。
 * pastes 記貼了幾次，每貼一次往右下錯開，不會整疊在同一個位置。
 */
let layerClipboard: { layers: EL[]; pastes: number } | null = null;

/**
 * 圖層內繪製的對象：只選了一張圖片（沒隱藏、沒鎖定）而且沒切成「畫成新圖層」時，
 * 筆畫就畫在這張圖片上；否則照舊變成獨立的「繪製」圖層。
 */
function paintTarget(ls: EL[], selectedIds: string[], bind: boolean): EL | null {
  if (!bind || selectedIds.length !== 1) return null;
  const l = ls.find((x) => x.id === selectedIds[0]);
  return isPaintable(l) && l.visible && !l.locked ? l : null;
}

/** 套用對齊算出來的位移；放在形狀裡、自己沒被選到的圖跟著形狀一起動。 */
function moveByOffsets(ls: EL[], offs: Map<string, { dx: number; dy: number }>, selected: Set<string>) {
  for (const l of ls) {
    const o = offs.get(l.id) ?? (l.clipTo && !selected.has(l.id) && !l.locked ? offs.get(l.clipTo) : undefined);
    if (o) { l.cx += o.dx; l.cy += o.dy; }
  }
}

/** 進入繪製時：選的是一張圖片就保留選取（要畫在它上面）；其他情況清掉，畫成新圖層。 */
function keepsPaintSelection(ls: EL[], selectedIds: string[]): boolean {
  return selectedIds.length === 1 && isPaintable(ls.find((x) => x.id === selectedIds[0]));
}

/** 橡皮擦：畫在圖片上時只擦這張圖片上的筆畫（原圖不動）；否則擦獨立的繪製圖層。 */
function eraseStrokesAt(ls: EL[], selectedIds: string[], bind: boolean, dx: number, dy: number, zoom: number): boolean {
  const t = paintTarget(ls, selectedIds, bind);
  if (!t) return eraseDrawingsAt(ls, dx, dy, zoom);
  const hits = new Set(paintHits(t.paint, t.w, t.h, docToLayer(t, dx, dy), 8 / zoom));
  if (!hits.size) return false;
  const left = (t.paint ?? []).filter((_, i) => !hits.has(i));
  t.paint = left.length ? left : undefined;   // 換一個新陣列：復原紀錄裡的舊版本不會被改到
  t.thumb = makeThumb(t);
  return true;
}

/** 擦除模式：刪掉這一點碰到的繪製筆畫（最上面那筆先；V1 整筆刪，不做像素級擦除）。回傳有沒有刪到。 */
function eraseDrawingsAt(ls: EL[], dx: number, dy: number, zoom: number): boolean {
  for (let i = ls.length - 1; i >= 0; i--) {
    const l = ls[i];
    if (l.type !== "drawing" || !l.visible || l.locked) continue;
    if (hitsDrawing(l, dx, dy, 8 / zoom)) { ls.splice(i, 1); return true; }
  }
  return false;
}

/** 這一點有沒有碰到繪製的線（考慮線寬、再加一點容許範圍）。 */
function hitsDrawing(l: EL, dx: number, dy: number, tolerance: number): boolean {
  if (!l.shape?.points) return false;
  const local = docToLayer(l, dx, dy);
  return distanceToPolyline(local, samplePath(l.shape.points, l.w, l.h)) <= l.shape.strokeWidth / 2 + tolerance;
}

/**
 * 繪製時畫布下方的工具列：顏色｜粗細｜透明度｜平滑｜橡皮擦（跟 Figma 一樣就地調，不開大面板）。
 */
function DrawToolbar({ cfg, target, onChange, onDone }: {
  cfg: { color: string; width: number; opacity: number; smooth: number; erase: boolean; bind: boolean };
  /** 目前選取、可以直接畫在上面的圖片名稱；null＝沒選圖片，只能畫成新圖層。 */
  target: string | null;
  onChange: (patch: Partial<{ color: string; width: number; opacity: number; smooth: number; erase: boolean; bind: boolean }>) => void;
  onDone: () => void;
}) {
  const label: React.CSSProperties = { fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" };
  const slider = (value: number, min: number, max: number, set: (v: number) => void, title: string, unit = "") => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={title}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: 80, accentColor: "#a78bfa" }} disabled={cfg.erase} />
      <span style={{ width: 34, fontSize: 11, color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </div>
  );
  const sep = <span aria-hidden style={{ width: 1, height: 22, background: "#374151" }} />;
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 124, transform: "translateX(-50%)", zIndex: 92, width: "max-content", maxWidth: "calc(100vw - 32px)", whiteSpace: "nowrap", display: "flex", gap: 10, alignItems: "center", background: "#1f2937", color: "#f9fafb", padding: "8px 12px", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><Pencil size={15} color="#c4b5fd" />繪製</span>
      {sep}
      {/* 畫在哪裡：選了圖片就預設畫在圖片上；也可以切回「新圖層」 */}
      {target ? (
        <div style={{ display: "flex", border: "1px solid #4b5563", borderRadius: 8, overflow: "hidden" }}>
          {[{ v: true, t: `畫在「${target.length > 8 ? target.slice(0, 8) + "…" : target}」上`, tip: "筆畫屬於這張圖片：移動、縮放、複製、刪除圖片時一起變化；原圖不會被改到" },
            { v: false, t: "新圖層", tip: "每一筆變成獨立的「繪製」圖層" }].map((o) => (
            <button key={String(o.v)} onClick={() => onChange({ bind: o.v })} title={o.tip}
              style={{ height: 28, padding: "0 10px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                background: cfg.bind === o.v ? "#4c1d95" : "transparent", color: cfg.bind === o.v ? "#fff" : "#d1d5db" }}>{o.t}</button>
          ))}
        </div>
      ) : (
        <span style={{ ...label, color: "#d1d5db" }} title="先選一張圖片再按「繪製」，就可以直接畫在那張圖片上">畫成新圖層</span>
      )}
      {sep}
      <span style={label}>顏色</span>
      <input type="color" aria-label="線條顏色" value={cfg.color} onChange={(e) => onChange({ color: e.target.value, erase: false })}
        style={{ width: 28, height: 26, border: "1px solid #4b5563", borderRadius: 6, padding: 0, background: "none", cursor: "pointer" }} />
      <span style={label}>粗細</span>{slider(cfg.width, 1, 40, (v) => onChange({ width: v }), "筆畫粗細", "px")}
      <span style={label}>透明度</span>{slider(Math.round(cfg.opacity * 100), 5, 100, (v) => onChange({ opacity: v / 100 }), "筆畫透明度", "%")}
      <span style={label}>平滑</span>{slider(cfg.smooth, 0, 100, (v) => onChange({ smooth: v }), "去掉手抖的程度（0＝完全照你畫的）")}
      {sep}
      <button onClick={() => onChange({ erase: !cfg.erase })} title={target && cfg.bind ? "橡皮擦：擦掉畫在這張圖片上的筆畫（碰到哪一筆刪哪一筆，原圖不動）" : "橡皮擦：碰到哪一筆就刪掉哪一筆"}
        style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
          border: cfg.erase ? "1px solid #a78bfa" : "1px solid #4b5563", background: cfg.erase ? "#4c1d95" : "transparent", color: "#f9fafb" }}>
        <Eraser size={14} />橡皮擦
      </button>
      <button onClick={onDone} title="回到選取（Esc）"
        style={{ height: 30, padding: "0 12px", border: "none", borderRadius: 8, background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>完成</button>
    </div>
  );
}

/** 形狀被刪掉時，原本放在裡面的圖解除剪裁（不然存檔會留著指向不存在的形狀）。 */
function releaseClips(layers: EL[], frameId: string) {
  for (const l of layers) if (l.clipTo === frameId) l.clipTo = null;
}

function applyClip(ctx: CanvasRenderingContext2D, l: EL, layers: EL[]) {
  if (!l.clipTo) return;
  const frame = layers.find((x) => x.id === l.clipTo);
  if (!frame || !isFillableShape(frame.shape)) return;
  const m = ctx.getTransform();
  applyLayerTransform(ctx, frame);
  clipToShape(ctx, frame.w, frame.h, frame.shape);
  ctx.setTransform(m);   // 剪裁範圍會留著，只把座標系換回來
}

/** 圖層區高度記在 localStorage 的 key。 */
const LAYERS_H_KEY = "ml-layers-h";

/**
 * 可拖曳調整、記在這台瀏覽器的高度。
 * 編輯器只在瀏覽器端載好圖之後才出現，不會在伺服器端算，所以初始值可以直接讀 localStorage。
 * dir：1＝往下拖變高（左欄的縮圖格），-1＝往上拖變高（右下的圖層區）。
 */
function useStoredHeight(key: string, fallback: number, min: number) {
  const [h, setH] = useState(() => {
    try { const v = Number(window.localStorage.getItem(key)); if (v >= min) return v; } catch { /* 無痕模式等讀不到就用預設 */ }
    return fallback;
  });
  const start = useCallback((e: React.PointerEvent, dir: 1 | -1, max: number) => {
    e.preventDefault();
    const startY = e.clientY, startH = h, top = Math.max(min, max);
    let latest = startH;
    const move = (ev: PointerEvent) => { latest = Math.max(min, Math.min(top, startH + dir * (ev.clientY - startY))); setH(latest); };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      try { window.localStorage.setItem(key, String(Math.round(latest))); } catch { /* 存不了就只在這次有效 */ }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }, [h, key, min]);
  return [h, start] as const;
}

/** 可拖曳的分隔線：中間一條短橫槓提示「這裡可以拉」。 */
function ResizeHandle({ label, onPointerDown }: { label: string; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div role="separator" aria-orientation="horizontal" aria-label={label} title={label} onPointerDown={onPointerDown}
      style={{ flex: "0 0 auto", height: 12, cursor: "row-resize", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #f0f1f4", background: "#fff", touchAction: "none" }}>
      <span style={{ width: 40, height: 4, borderRadius: 2, background: "#d1d5db" }} />
    </div>
  );
}

/**
 * 側欄每一區的標題列。原本是灰色小字的全大寫標題，擠在一起看不出哪裡是一區的開始；
 * 改成淺底、深色粗體、帶圖示與數量，一眼就找得到。
 * collapseDown：放在最下面的區塊（圖層）收合方向是往下。
 */
function SectionHeader({ icon, title, hint, count, open, onToggle, collapseDown }: {
  icon: React.ReactNode; title: string; hint?: string; count?: number; open: boolean; onToggle: () => void; collapseDown?: boolean;
}) {
  return (
    <button onClick={onToggle}
      style={{ flex: "0 0 auto", width: "100%", height: 42, padding: "0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", border: "none", borderBottom: "1px solid #eef0f3", cursor: "pointer", color: "#6b7280" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#1f2937" }}>
        {icon}{title}
        {count != null && <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#f5f3ff", borderRadius: 999, padding: "1px 8px" }}>{count}</span>}
        {hint && <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>{hint}</span>}
      </span>
      {(open !== !!collapseDown) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", color: "#1f2937", fontFamily: "'Manrope','Noto Sans TC',system-ui,sans-serif" },
  warn: { background: "#fffbeb", color: "#b45309", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #fde68a" },
  toolbar: { height: 56, flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: "#ffffff", borderBottom: "1px solid #e5e7eb" },
  divider: { width: 1, height: 24, background: "#e5e7eb" },
  tbtn: { height: 34, padding: "0 12px", border: "1px solid #e5e7eb", background: "#ffffff", color: "#374151", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  // overflowY：範本庫、素材庫都拉很高時，整欄可以捲，不會把外框撐高
  panel: { width: 280, flex: "0 0 auto", background: "#ffffff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", minHeight: 0 },
  rail: { width: 72, flex: "0 0 auto", background: "#ffffff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 0, overflowY: "auto" },
  railBtn: { width: 60, height: 58, border: "none", borderRadius: 10, background: "transparent", color: "#4b5563", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 0 },
  panelHead: { height: 44, display: "flex", alignItems: "center", padding: "0 14px", borderBottom: "1px solid #e5e7eb", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 },
  row: { display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", borderRadius: 12, background: "#f9fafb", border: "1px solid transparent", cursor: "pointer" },
  rowSel: { border: "1px solid #7c3aed", background: "#f5f3ff" },
  thumb: { width: 38, height: 38, flex: "0 0 auto", borderRadius: 8, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 14, color: "#9ca3af" },
  name: { fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1f2937" },
  sub: { fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 },
  icon: { width: 26, height: 26, border: "none", background: "transparent", color: "#9ca3af", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, position: "relative", minWidth: 0, overflow: "hidden", background: "#F8F9FC" },
  textPanel: { position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", gap: 6, alignItems: "center", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "6px 8px", boxShadow: "0 8px 24px rgba(0,0,0,.12)" },
  tpInput: { width: 170, background: "#ffffff", border: "1px solid #e5e7eb", color: "#1f2937", borderRadius: 8, padding: "6px 8px", fontSize: 13 },
  tpColor: { width: 30, height: 30, padding: 0, border: "1px solid #e5e7eb", borderRadius: 8, background: "transparent", cursor: "pointer" },
  tpBtn: { height: 30, padding: "0 8px", border: "1px solid #e5e7eb", background: "#ffffff", color: "#374151", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  tpSel: { height: 30, background: "#ffffff", border: "1px solid #e5e7eb", color: "#374151", borderRadius: 8, fontSize: 12 },
  // left tools palette
  tool: { display: "flex", alignItems: "center", gap: 10, width: "100%", height: 36, padding: "0 10px", border: "none", background: "transparent", color: "#374151", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" },
  toolOff: { color: "#c4c8d0", cursor: "not-allowed" },
  // right properties panel
  rpanel: { width: 320, flex: "0 0 auto", background: "#ffffff", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", minHeight: 0 },
  rtabs: { display: "flex", gap: 18, padding: "0 16px", borderBottom: "1px solid #e5e7eb", flex: "0 0 auto" },
  rtab: { height: 44, border: "none", background: "transparent", color: "#9ca3af", fontSize: 14, fontWeight: 700, cursor: "pointer", borderBottom: "2px solid transparent" },
  rtabOn: { color: "#7c3aed", borderBottom: "2px solid #7c3aed" },
  rhead: { fontSize: 14, fontWeight: 800, color: "#1f2937", marginTop: 0, marginRight: 0, marginBottom: 12, marginLeft: 0 },
  rlabel: { display: "block", fontSize: 12, color: "#6b7280", marginTop: 12, marginRight: 0, marginBottom: 4, marginLeft: 0, fontWeight: 600 },
  rinput: { width: "100%", height: 34, background: "#fff", border: "1px solid #e5e7eb", color: "#1f2937", borderRadius: 8, padding: "0 10px", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" },
  rbtn: { height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  fxChip: { height: 30, padding: "0 12px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  fxChipOn: { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" },
};
