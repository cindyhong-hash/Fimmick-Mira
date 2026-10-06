"use client";
import { clipToShape, drawEditableShape, drawIcon, EDITABLE_ICON_NAMES, isFillableShape } from "@/lib/magic-layers/editable-shape.ts";
import { applyLayerTransform, docToLayer, layerCorners, layerToDoc } from "@/lib/magic-layers/layer-transform.ts";
import { alignOffsets, unitCount, type AlignMode } from "@/lib/magic-layers/align.ts";
import { buildRebuildSavedLayers, shrinkForUpload } from "@/lib/magic-layers/reference-rebuild/client.ts";
import type { RebuildResult } from "@/lib/magic-layers/reference-rebuild/types.ts";
import { DEFAULT_GLOW, DEFAULT_SHADOW, drawGlow, drawShadow, type LayerGlow, type LayerShadow } from "@/lib/magic-layers/layer-glow.ts";
import { distanceToPolyline, drawPaint, paintHits, samplePath, smoothStroke, strokeToPaint } from "@/lib/magic-layers/freehand.ts";
/* ============================================================
   Magic Layers — React editor
   Canvas layer editor: select / move / scale / rotate / z-order / show / lock /
   delete / duplicate, zoom + pan. Consumes LayerData[] from the analysis
   pipeline; extracts each layer along its contour (no rectangle crops).
   Ported from the verified vanilla engine.
   ============================================================ */
import { drawEditableText, layoutText, readTextLayout, DEFAULT_TEXT_LAYOUT, type TextLayout } from "@/lib/magic-layers/editable-text.ts";
import { idsInBox, selectableIds } from "@/lib/magic-layers/box-select.ts";
import { ANIM_LABELS, animEnd, animFrame, animUnits, carouselLayout, carouselSlot, carouselSteps, defaultAnim, isOneShot, readAnims, shineBand, staggeredStarts, typeChar, videoDuration, REST, type AnimFrame, type AnimKind, type LayerAnim, type TypingState } from "@/lib/magic-layers/layer-animation.ts";
import { encodeMp4, videoSize } from "@/lib/magic-layers/mp4-export.ts";
import { AnimationTab, AnimCopyBar, AnimDock, LayerAnimSettings, SequencePreview, type AnimTrack, type DockMode, type LifeRow } from "./AnimationPanel";
import { addPreset, animsForTargets, copyableAnims, loadPresets, PASTE_STAGGER, readingOrder, savePresets, type AnimPreset } from "@/lib/magic-layers/anim-presets.ts";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
import { CarouselSetup, isVerticalText, toVertical, type CarouselCardContent, type CarouselPart } from "./CarouselSetup";
import { aliveAt, clampLifespan, lifespanOf, readLifespan } from "@/lib/magic-layers/layer-lifespan.ts";
import { defaultTransition, hasDir, readTransition, sequenceAt, sequenceLayout, transitionPoses, TRANSITION_LABELS, type PageTransition, type Pose, type SeqLayout, type TransitionKind } from "@/lib/magic-layers/page-transition.ts";
import { anchorShift, autoWidth, shiftRuns, caretLines, indexAt, selectionSpans, verticalMove, widestLine, wrapRanges, type CaretLine, type TextLineRange } from "@/lib/magic-layers/text-caret.ts";
import { hexToRgb, isEditableInPsd, psdFileName, psdFontName, psdTextEffects, styleRunsFor } from "@/lib/magic-layers/psd-export.ts";
import { useBrandFonts } from "@/lib/fonts/useBrandFonts";
import type { PaintStroke, SavedLayer, TextFx, TextRun, ShapeKind, ShapeSpec } from "@/lib/magic-layers/saved-layer.ts";
export type { SavedLayer } from "@/lib/magic-layers/saved-layer.ts";
/** 多頁設計的一頁（像 Canva 的頁面）：尺寸＋圖層。 */
export type SavedPage = { docW: number; docH: number; layers: SavedLayer[]; /** 頁面名稱（例如「封面」）；空的就顯示「第 N 頁」。 */ name?: string;
  /** 做成影片時這一頁播多久（秒）；沒有＝照動畫自動決定。第 1 頁存在外層的 animDuration。 */ animDuration?: number;
  /** 從上一頁換到這一頁的過場（第 1 頁沒有）。 */ transitionIn?: PageTransition };
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, ChevronUp, ChevronDown, ChevronLeft, Scissors, Sparkles, Eye, EyeOff, Lock, Unlock, Copy, Trash2, ArrowLeft, Plus, Download, Image as ImageIcon, Upload, Type, BadgeCheck, Square, Star, Minus, Pencil, Undo2, Redo2, Eraser, Maximize2, GripVertical, WandSparkles, Save, Layers, LayoutTemplate, Wrench, PenTool, Clapperboard, Hand } from "lucide-react";
import type { LayerData, FragmentationReport } from "@/lib/magic-layers/types.ts";
import { extractLayer } from "@/lib/magic-layers/extract-browser.ts";
import { alphaHit } from "@/lib/magic-layers/alpha-hit-test.ts";
import { useUnsavedGuard } from "@/components/common/UnsavedGuard";
import { planPsdImport, PSD_MAX_BYTES, type ImportImage, type ImportNote, type PsdLike } from "@/lib/magic-layers/psd-import.ts";

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
  /** 陰影（有方向、有距離的投影）；null/undefined＝沒有。 */
  shadow?: LayerShadow | null;
  /**
   * 文字寬度：false/undefined＝自動寬度（打字時框跟著字變寬）；true＝固定寬度（字在框裡自動換行）。
   * 拖文字框左右兩邊、或自動變寬碰到畫布邊緣時會變成固定寬度。有 textLayout 的文字本來就會換行，不看這個。
   */
  wrap?: boolean;
  /** 圖層動畫（輸出 MP4 用）。 */
  anims?: LayerAnim[];
  /** 物件存在時間（這一頁的第幾秒出現／消失；沒設＝整頁都在）。只在播放、輸出時生效，跟 visible 無關。 */
  startTime?: number; endTime?: number;
  /** 光澤範圍：本身不顯示，只有閃光掃過時在它的形狀裡亮一下。 */
  shineOnly?: boolean;
};

/**
 * Feature flag：「魔術棒補空白」暫時收起。
 * 想拿回來繼續做就改 true——按鈕、generateMagicFill 與
 * /api/magic-layers/magic-fill 都原封不動留著。
 */
const SHOW_MAGIC_FILL = false;

type LeftTab = "templates" | "materials" | "ai" | "tools" | "upload" | "animate";
const LEFT_TABS: { id: LeftTab; label: string; Icon: typeof Wrench }[] = [
  { id: "templates", label: "範本", Icon: LayoutTemplate },
  { id: "materials", label: "素材", Icon: ImageIcon },
  { id: "ai", label: "AI 設計", Icon: WandSparkles },
  { id: "tools", label: "工具", Icon: Wrench },
  { id: "upload", label: "上傳", Icon: Upload },
  { id: "animate", label: "動畫", Icon: Clapperboard },
];

/** 動畫模式裡顯示的物件名稱：文字圖層直接用字（比「新文字」好認）。 */
function layerLabel(l: EL): string {
  return l.isText && l.text.trim() ? l.text.replace(/\s+/g, " ").slice(0, 16) : l.name;
}
/**
 * 動畫分頁的「目前選取」：只顯示正在編輯哪個物件，要換就用下拉選單。
 * 排序、顯示／隱藏、鎖定、複製、刪除這些圖層管理留在「設計」分頁。
 */
function CurrentLayerPicker(props: { layers: EL[]; selected: EL | null; extra: number; onPick: (id: string) => void }) {
  const l = props.selected;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 0", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #ede9fe", background: "#faf8ff" }}>
      <div style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: 6, background: "#fff", border: "1px solid #ebeff5", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 12, color: "#9ca3af" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {l?.thumb ? <img src={l.thumb} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : l ? (l.isText ? "T" : "◇") : "–"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>目前選取{props.extra > 0 ? `（另外還選了 ${props.extra} 個）` : ""}</div>
        <select value={l?.id ?? ""} onChange={(e) => e.target.value && props.onPick(e.target.value)} aria-label="切換要加動畫的物件"
          style={{ width: "100%", height: 26, marginTop: 2, border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#1f2937", cursor: "pointer", padding: 0, outline: "none" }}>
          {!l && <option value="">還沒選物件</option>}
          {props.layers.map((x) => <option key={x.id} value={x.id}>{layerLabel(x)}{x.anims?.length ? `　· ${x.anims.length} 個動畫` : ""}</option>)}
        </select>
      </div>
    </div>
  );
}
/** 上方「畫布比例」選單：[名稱, 寬比, 高比]。 */
const CANVAS_RATIOS: [string, number, number][] = [["1:1", 1, 1], ["4:5", 4, 5], ["5:4", 5, 4], ["9:16", 9, 16], ["16:9", 16, 9]];
const FONT_WEIGHTS: [number, string][] = [[300, "Light 細"], [400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra Bold"], [900, "Black 特粗"]];
const TYPE_LABEL: Record<string, string> = { background: "背景", product: "產品", person: "人物", object: "物件", decoration: "裝飾", drawing: "繪製", independent_text: "文字" };

/** One serialized layer in a saved 排版 (stored in LibraryImage.paramsJson). */

export function MagicLayersEditor({ image, layers, fragmentation, backgrounds, logos, name, clientId, onRename, onBack, onSave, extraPages, firstPageName, animDuration }: { image: HTMLImageElement; layers: LayerData[]; fragmentation?: FragmentationReport; backgrounds?: { url: string; label?: string }[]; logos?: string[]; name?: string; clientId?: string | null; onRename?: (name: string) => void; onBack?: () => void; onSave?: (payload: { docW: number; docH: number; layers: SavedLayer[]; imageDataUrl: string; finalize: boolean; pages?: SavedPage[]; pageImages?: string[]; animDuration?: number }) => Promise<void>;
  /** 多頁草稿的第 2 頁以後；第 1 頁照舊從 image／layers 進來。 */
  extraPages?: SavedPage[];
  /** 第 1 頁的名稱（第 1 頁的圖層走 layers，名稱另外帶進來）。 */
  firstPageName?: string;
  /** 圖層動畫的影片長度（秒；存檔帶回來的，沒有就照動畫自動決定）。 */
  animDuration?: number }) {
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
  // AI 設計：生成背景、照參考圖重做
  const [bgPrompt, setBgPrompt] = useState("");
  const [bgRef, setBgRef] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<null | "bg" | "rebuild">(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const bgRefInput = useRef<HTMLInputElement>(null);
  const rebuildInput = useRef<HTMLInputElement>(null);
  const psdInput = useRef<HTMLInputElement>(null);
  // 生成式填色的參考圖（選填）
  const [genFillRef, setGenFillRef] = useState<string | null>(null);
  const [genFillPicking, setGenFillPicking] = useState(false);
  // 匯入 PSD：進行中的說明（蓋在畫布上）、做完的報告（哪些圖層略過、哪些效果被簡化）
  const [psdImporting, setPsdImporting] = useState<string | null>(null);
  const [psdReport, setPsdReport] = useState<{ pages: number; layers: number; skipped: ImportNote[]; approximated: ImportNote[] } | null>(null);
  // 範本庫（共用，全品牌看得到；目前只做 1:1）
  const [templates, setTemplates] = useState<{ id: string; name: string; previewUrl: string | null; builtin?: boolean; docW?: number; docH?: number }[]>([]);
  // 範本放大預覽（第幾個；null＝沒開）。點縮圖先預覽，確定了才套用——套用會換掉整個畫布
  const [tplPreview, setTplPreview] = useState<number | null>(null);
  const [matPreview, setMatPreview] = useState<number | null>(null);   // 素材放大預覽
  const [tplSaving, setTplSaving] = useState(false);
  // 套用範本要下載整組圖片，可能要好幾秒：期間蓋一層「套用中」，也擋掉重複點
  const [tplApplying, setTplApplying] = useState(false);
  const tplApplyingRef = useRef(false);
  // 右下「圖層」可收合；開或關記在這台瀏覽器
  const [layersOpen, setLayersOpenState] = useState(() => { try { return window.localStorage.getItem("mira.layersOpen") !== "0"; } catch { return true; } });
  const setLayersOpen = (f: (v: boolean) => boolean) => setLayersOpenState((v) => { const n = f(v); try { window.localStorage.setItem("mira.layersOpen", n ? "1" : "0"); } catch { /* 存不了就算了 */ } return n; });
  // 可拖曳調整的高度，記在這台瀏覽器（圖層區含標題列；範本庫、素材庫是縮圖格的高度）
  // 預設高度從 340 降到 260：右上的設定區才有空間（使用者自己拖過的高度照舊）
  const [layersH, startLayersResize] = useStoredHeight(LAYERS_H_KEY, 260, 150);
  const rpanelRef = useRef<HTMLElement>(null);
  /** 左欄拉高某一區時，至少留一點給下面的工具列。 */
  // 右側分頁：設計／動畫。原本還有一個「設定」，只寫文件尺寸和圖層數，
  // 已經併到「沒選東西時」的「這一頁」（尺寸、比例、背景色、圖層數）
  const [panelTab, setPanelTab] = useState<"design" | "anim">("design");
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
  // 點畫布時要停止播放：播放迴圈看到這個旗子就自己停（畫布事件裡不能直接動播放狀態）
  const haltPlayRef = useRef(false);
  // 手形工具：開著時在畫布上直接拖＝移動畫面（游標是手）；按 H 或上方的手形按鈕切換
  const handRef = useRef(false);
  const [handMode, setHandMode] = useState(false);
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
  /**
   * 畫布上直接改字（雙擊文字進入）。輸入交給一個看不見的 textarea（中文輸入法才正常），
   * 游標、反白、組字底線都由畫布畫（drawTextEditing），位置跟畫出來的字一模一樣。
   * left/top 是「選取的字」工具列要放的位置（螢幕座標）。
   */
  const [editingText, setEditingText] = useState<{ id: string; original: string; left: number; top: number } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  /** 正在編輯的文字圖層 id：事件處理和 render 讀這個（不用等 state 更新）。 */
  const editingRef = useRef<string | null>(null);
  const editingOriginalRef = useRef("");
  /** 輸入法組字開始的位置；null＝沒有在組字。 */
  const compStartRef = useRef<number | null>(null);
  const caretOnRef = useRef(true);
  /** 進入編輯時要放的游標位置（textarea 掛上去之後才放得了）。 */
  const pendingCaretRef = useRef<{ start: number; end: number } | null>(null);
  /** 進入編輯前的框（沒改字就還原）。 */
  const editGeomRef = useRef<TextGeom | null>(null);
  /** 拉框選取中的框（文件座標）；render 畫虛線框用。 */
  const boxSelRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** 動畫預覽的時間（秒）；null＝不在預覽，照平常畫。 */
  const animTimeRef = useRef<number | null>(null);
  const startTextEditRef = useRef<(l: EL, range?: { start: number; end: number }) => void>(() => {});
  const exitTextEditRef = useRef<() => void>(() => {});
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
          wrap: (l.meta?.wrap as boolean | undefined) ?? false,
          paint: (l.meta?.paint as PaintStroke[] | undefined) ?? undefined,
          glow: (l.meta?.glow as LayerGlow | undefined) ?? null,
          shadow: (l.meta?.shadow as LayerShadow | undefined) ?? null,
          anims: readAnims(l.meta?.anims),
          ...readLifespan(l.meta as { startTime?: unknown; endTime?: unknown } | undefined),
          shineOnly: !!l.meta?.shineOnly,
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
    // 選到別的東西（圖層列表、快捷鍵…）就結束畫布上的改字
    if (editingRef.current && !ids.includes(editingRef.current)) exitTextEditRef.current();
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
    const at = animTimeRef.current;
    // 輪播排在畫布外面等著滑進來的卡片：編輯器裡淡淡畫出來，不然看不到也沒辦法改（輸出的影片不會有）
    {
      const waiting = layersRef.current.filter((l) => l.visible && l.anims?.some((a) => a.kind === "carousel"));
      if (waiting.length) {
        for (const l of waiting) drawLayerAnimated(ctx, l, layersRef.current, at);
        const far = 1e5;
        ctx.save(); ctx.beginPath(); ctx.rect(-far, -far, far * 2, far * 2); ctx.rect(0, 0, doc.w, doc.h);
        ctx.fillStyle = "rgba(248,249,252,.62)"; ctx.fill("evenodd"); ctx.restore();
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, doc.w, doc.h);
      }
    }
    // Figma Frame-style Clip content：圖層仍可拖出畫布，但超出文件邊界的像素不顯示。
    ctx.beginPath(); ctx.rect(0, 0, doc.w, doc.h); ctx.clip();
    for (const l of layersRef.current) {
      if (!l.visible) continue;
      drawLayerAnimated(ctx, l, layersRef.current, at);
      // 光澤範圍平常看不見：編輯時畫一個淡淡的虛線框，讓人知道它在哪
      if (l.shineOnly && at === null) drawShineZoneHint(ctx, l, view.current.zoom);
    }
    // 畫布上改字：游標、反白、組字底線（跟字畫在同一個座標系）
    const editId = editingRef.current, ta = textAreaRef.current;
    const editEl = editId ? layersRef.current.find((l) => l.id === editId) : undefined;
    if (editEl && ta) drawTextEditing(ctx, editEl, { start: ta.selectionStart, end: ta.selectionEnd }, compStartRef.current, caretOnRef.current, view.current.zoom);
    // 拉框選取的框
    const bx = boxSelRef.current;
    if (bx) {
      ctx.save();
      ctx.setLineDash([5 / view.current.zoom, 4 / view.current.zoom]);
      ctx.lineWidth = 1.2 / view.current.zoom; ctx.strokeStyle = "#7c3aed"; ctx.fillStyle = "rgba(124,58,237,.08)";
      const x = Math.min(bx.x0, bx.x1), y = Math.min(bx.y0, bx.y1), w = Math.abs(bx.x1 - bx.x0), h = Math.abs(bx.y1 - bx.y0);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
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

    // 改字時只留細虛線框（drawTextEditing 畫的），不顯示縮放／旋轉把手
    if (toolRef.current === "select" && animTimeRef.current === null) {
      // 選了好幾個：每個圖層只畫框，外面再畫一個包住全部的大框＋四角把手（拖角落一起等比縮放）
      const grp = editId ? null : unionBox(movableOf(layersRef.current, selectedIds));
      for (const id of selectedIds) { if (id === editId) continue; const s = layersRef.current.find((l) => l.id === id); if (s?.visible) drawSelection(ctx, s, !grp && id === selectedId); }
      if (grp) { const v = view.current; drawGroupFrame(ctx, grp.x0 * v.zoom + v.panX, grp.y0 * v.zoom + v.panY, grp.x1 * v.zoom + v.panX, grp.y1 * v.zoom + v.panY); }
    }
    // 播放或停在某一格時：把手收起來，但留一圈淡淡的虛線，看得出右側正在調哪個物件
    if (toolRef.current === "select" && animTimeRef.current !== null) {
      for (const id of selectedIds) {
        const s = layersRef.current.find((l) => l.id === id);
        if (s?.visible) drawGhostFrame(ctx, corners(s).map((p) => d2s(p.x, p.y)));
      }
    }
    // 看不見的 textarea 跟著文字框走：輸入法的選字視窗才會出現在字旁邊
    if (editEl && ta) placeTextArea(ta, editEl, view.current);
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
  function groupCorners(b: { x0: number; y0: number; x1: number; y1: number }) { return [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]; }
  function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, round: boolean) {
    ctx.beginPath(); if (round) ctx.arc(x, y, 6, 0, Math.PI * 2); else ctx.rect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
  }

  /* ---------- hit testing ---------- */
  function hitHandle(sx: number, sy: number) {
    if (editingRef.current) return null;   // 改字時沒有縮放／旋轉把手
    const grp = unionBox(movableOf(layersRef.current, selectedIdsRef.current));
    if (grp) {
      const cs = groupCorners(grp).map((p) => d2s(p.x, p.y));
      for (let i = 0; i < 4; i++) if (dist(sx, sy, cs[i].x, cs[i].y) <= 10) return { type: "groupScale" as const, corner: i, box: grp };
      return null;
    }
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
    // 畫布外面點不到東西；只有輪播排在外面等著滑進來的卡片例外（編輯器裡看得到，要能點來改字、換圖）
    const outside = dx < 0 || dy < 0 || dx > doc.w || dy > doc.h;
    const ls = layersRef.current;
    for (let i = ls.length - 1; i >= 0; i--) {
      const l = ls[i]; if (!l.visible || l.locked) continue;
      if (outside && !l.anims?.some((a) => a.kind === "carousel")) continue;
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
      // 正在看動畫（播放中或停在某一格）：點一下畫布就回到編輯畫面，選取框、把手才會出來
      if (animTimeRef.current !== null) { animTimeRef.current = null; haltPlayRef.current = true; }
      const s = evPt(e), d = s2d(s.x, s.y);
      const wantPan = e.button === 1 || space.current || handRef.current;
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
      // 改字中：點在這段字上＝放游標／拖曳選字（Shift 延伸）；點到別處＝結束改字，再照一般點選處理
      if (!wantPan && editingRef.current) {
        const el = layersRef.current.find((x) => x.id === editingRef.current), ta = textAreaRef.current;
        if (el && ta) {
          const lp = toLocal(el, d.x, d.y), m = 8 / view.current.zoom;
          if (Math.abs(lp.x) <= el.w / 2 + m && Math.abs(lp.y) <= el.h / 2 + m) {
            e.preventDefault();   // 不然 textarea 會失去焦點
            const idx = indexAt(textCaretLines(el), lp.x, lp.y);
            const anchor = e.shiftKey ? (ta.selectionDirection === "backward" ? ta.selectionEnd : ta.selectionStart) : idx;
            selectTextRange(ta, anchor, idx); ta.focus({ preventScroll: true }); caretOnRef.current = true; readSel(ta);
            drag.current = { mode: "textSelect", anchor }; render(); return;
          }
        }
        exitTextEditRef.current();
      }
      if (!wantPan) {
        const h = hitHandle(s.x, s.y);
        if (h && h.type === "groupScale") {
          // 對角固定不動，其他圖層照跟它的距離一起等比放大縮小
          const anchor = groupCorners(h.box)[(h.corner + 2) % 4];
          drag.current = { mode: "groupScale", anchor, d0: Math.max(1, Math.hypot(d.x - anchor.x, d.y - anchor.y)),
            items: h.box.layers.map((l) => ({ l, cx: l.cx, cy: l.cy, w: l.w, h: l.h })) };
          return;
        }
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
      // 空白處按住拖曳＝拉框選取（Shift 是加選）；移動畫面改用空白鍵＋拖曳或滑鼠中鍵
      if (!wantPan && toolRef.current === "select") {
        boxSelRef.current = { x0: d.x, y0: d.y, x1: d.x, y1: d.y };
        drag.current = { mode: "boxSelect", add: e.shiftKey, base: e.shiftKey ? [...selectedIdsRef.current] : [], sx: s.x, sy: s.y };
        if (!e.shiftKey && selectedIdsRef.current.length) selectOnly(null);
        render(); return;
      }
      drag.current = { mode: "pan", sx: s.x, sy: s.y, opx: view.current.panX, opy: view.current.panY };
      if (wantPan) cv.style.cursor = "grabbing";   // 拖著畫面時是「抓住的手」
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
      if (g.mode === "boxSelect") {
        if (boxSelRef.current) { boxSelRef.current.x1 = d.x; boxSelRef.current.y1 = d.y; render(); }
        return;
      }
      if (g.mode === "textSelect") {
        const el = layersRef.current.find((x) => x.id === editingRef.current), ta = textAreaRef.current;
        if (el && ta) { const lp = toLocal(el, d.x, d.y); selectTextRange(ta, g.anchor, indexAt(textCaretLines(el), lp.x, lp.y)); caretOnRef.current = true; render(); }
        return;
      }
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
        if (h && h.type === "resize" && h.axis === "x" && g.l.isText && !g.l.canvas) resizeTextWidth(g.l, Math.max(min, Math.abs(lp.x) * 2), docRef.current.w);   // 文字：改框寬、字級不變、自動換行
        else if (h && h.type === "resize" && h.axis === "x") { g.l.w = Math.max(min, Math.abs(lp.x) * 2); }          // 只改寬
        else if (h && h.type === "resize" && h.axis === "y") { g.l.h = Math.max(min, Math.abs(lp.y) * 2); }     // 只改高
        else if (e.shiftKey) { const f = Math.max(Math.abs(lp.x) / (g.ow / 2 || 1), Math.abs(lp.y) / (g.oh / 2 || 1), 0.02); g.l.w = g.ow * f; g.l.h = g.oh * f; }  // 角落＋Shift：等比整體縮放
        else { g.l.w = Math.max(min, Math.abs(lp.x) * 2); g.l.h = Math.max(min, Math.abs(lp.y) * 2); }           // 角落：自由改寬高（可壓扁）
        render();
      }
      else if (g.mode === "groupScale") {
        const k = Math.max(0.05, Math.hypot(d.x - g.anchor.x, d.y - g.anchor.y) / g.d0);
        for (const it of g.items) {
          it.l.cx = g.anchor.x + (it.cx - g.anchor.x) * k; it.l.cy = g.anchor.y + (it.cy - g.anchor.y) * k;
          it.l.w = Math.max(2, it.w * k); it.l.h = Math.max(2, it.h * k);   // 文字的字級跟著框寬一起縮放
        }
        render();
      }
      else if (g.mode === "rotate") { const now = Math.atan2(d.y - g.l.cy, d.x - g.l.cx); let r = g.orot + (now - g.grab); if (e.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12); g.l.rotation = r; render(); }
      else if (g.mode === "pan") { view.current.panX = g.opx + (s.x - g.sx); view.current.panY = g.opy + (s.y - g.sy); render(); }
    };
    const dbl = (e: MouseEvent) => {
      // 鋼筆：雙擊結束（不封閉）。雙擊會先觸發兩次按下，多出來的那個點拿掉
      if (toolRef.current === "pen") { penRef.current?.pts.pop(); finishPenRef.current(false); return; }
      const s = evPt(e), d = s2d(s.x, s.y);
      // 改字中雙擊：選一個詞
      if (editingRef.current) {
        const el = layersRef.current.find((x) => x.id === editingRef.current), ta = textAreaRef.current;
        if (el && ta) {
          const lp = toLocal(el, d.x, d.y);
          if (Math.abs(lp.x) <= el.w / 2 && Math.abs(lp.y) <= el.h / 2) {
            const w = wordRangeAt(el.text, indexAt(textCaretLines(el), lp.x, lp.y));
            ta.setSelectionRange(w.start, w.end); readSel(ta); render();
          }
        }
        return;
      }
      // 雙擊文字：進入改字，游標放在點的位置（轉成圖片的藝術字不算）
      const hit = hitLayer(d.x, d.y);
      if (hit?.isText && !hit.locked && !hit.canvas) {
        const lp = toLocal(hit, d.x, d.y), idx = indexAt(textCaretLines(hit), lp.x, lp.y);
        startTextEditRef.current(hit, { start: idx, end: idx });
      }
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.mode === "boxSelect") {
        const g = drag.current, b = boxSelRef.current;
        boxSelRef.current = null; drag.current = null;
        // 幾乎沒拖（小於 3px）就當成點空白處：只是取消選取
        const moved = Math.hypot(evPt(e).x - g.sx, evPt(e).y - g.sy) >= 3;
        if (b && moved) {
          const hits = idsInBox(layersRef.current.map((l) => ({ id: l.id, corners: layerCorners(l), locked: l.locked, visible: l.visible, type: l.type, groupId: l.groupId })), b);
          const ids = g.add ? [...new Set([...g.base, ...hits])] : hits;
          applySelection(ids, ids[ids.length - 1] ?? null);
        }
        render(); return;
      }
      if (drag.current?.mode === "textSelect") { drag.current = null; if (textAreaRef.current) readSel(textAreaRef.current); return; }
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
      if (drag.current?.mode === "pan") cv.style.cursor = space.current || handRef.current ? "grab" : "default";
      if (drag.current?.mode === "groupScale") { for (const it of drag.current.items) it.l.thumb = makeThumb(it.l); markDirty(); }
      if (drag.current && drag.current.l) { for (const item of drag.current.moving ?? [{ l: drag.current.l }]) item.l.thumb = makeThumb(item.l); if (drag.current.mode !== "pan") markDirty(); } drag.current = null; refresh(); render(); };
    const hover = (s: { x: number; y: number }) => {
      if (space.current || handRef.current) { cv.style.cursor = "grab"; return; }
      if (editingRef.current) {
        const el = layersRef.current.find((x) => x.id === editingRef.current), d = s2d(s.x, s.y);
        if (el) { const lp = toLocal(el, d.x, d.y); if (Math.abs(lp.x) <= el.w / 2 && Math.abs(lp.y) <= el.h / 2) { cv.style.cursor = "text"; return; } }
      }
      const h = hitHandle(s.x, s.y); if (h) { cv.style.cursor = h.type === "groupScale" ? (h.corner % 2 === 0 ? "nwse-resize" : "nesw-resize") : h.type === "rotate" ? "crosshair" : h.type === "resize" ? (h.axis === "x" ? "ew-resize" : "ns-resize") : "nwse-resize"; return; }
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
      if (e.code === "Space" && !typing) { space.current = true; if (canvasRef.current && drag.current?.mode !== "pan") canvasRef.current.style.cursor = "grab"; e.preventDefault(); }
      // H：切換手形工具（移動畫面）；Esc 關掉
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "h" || e.key === "H" || (e.key === "Escape" && handRef.current))) {
        const on = e.key !== "Escape" && !handRef.current;
        handRef.current = on; setHandMode(on);
        if (canvasRef.current) canvasRef.current.style.cursor = on ? "grab" : "default";
      }
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && !typing) {
        e.preventDefault();
        const ids = selectableIds(layersRef.current);
        applySelection(ids, ids[ids.length - 1] ?? null); render();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current.length && !typing) {
        const deleting = new Set(selectedIdsRef.current); layersRef.current = layersRef.current.filter((l) => !deleting.has(l.id));
        applySelection([]); markDirty(); refresh(); render();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y") && !typing) { e.preventDefault(); redo(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") { space.current = false; if (canvasRef.current && drag.current?.mode !== "pan") canvasRef.current.style.cursor = handRef.current ? "grab" : "default"; } };
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
  const canvasRatio = CANVAS_RATIOS.find(([, rw, rh]) => Math.abs(doc.w / doc.h - rw / rh) < .01)?.[0] ?? "custom";
  const resizeCanvasToRatio = (ratio: string) => {
    const hit = CANVAS_RATIOS.find(([k]) => k === ratio); if (!hit) return;
    const pair = [hit[1], hit[2]]; const [rw, rh] = pair, long = Math.max(doc.w, doc.h);
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

  /* ---------- 圖層動畫：預覽播放、套用效果、輸出 MP4 ---------- */
  const [videoLen, setVideoLen] = useState<number | null>(animDuration ?? null);
  const [playing, setPlaying] = useState(false);
  const [mp4Busy, setMp4Busy] = useState<number | null>(null);
  // 切頁時要把這一頁的長度收回頁面裡（stashCurrentPage 是穩定的 callback，讀 ref 才拿得到最新值）
  const videoLenRef = useRef<number | null>(animDuration ?? null);
  useEffect(() => { videoLenRef.current = videoLen; }, [videoLen]);
  // 圖層存在 ref 裡（不是 state），render 期間不能讀：影片長度、時間軸都用函式，在事件或子元件裡才去讀
  // 跟整份影片用同一個規則（沒動畫的頁停 3 秒），面板上看到的長度就是影片裡的長度
  const currentDuration = useCallback(() => pageDuration(layersRef.current, videoLen), [videoLen]);
  // 時間軸：同一個效果、同一個開始時間的圖層（通常是同一個物件的幾個零件）合成一列，名字用裡面的文字
  const currentTracks = useCallback(() => animTrackRows(layersRef.current), []);
  const getAnimTime = useCallback(() => animTimeRef.current, []);
  // 播放：每一格算時間、重畫（循環播放）。播放列在畫布下方，哪個分頁都能播
  const previewing = playing;
  useEffect(() => {
    if (!previewing) return;
    let raf = 0; const t0 = performance.now() - (animTimeRef.current ?? 0) * 1000;
    const tick = () => {
      if (haltPlayRef.current) { haltPlayRef.current = false; animTimeRef.current = null; setPlaying(false); render(); return; }
      animTimeRef.current = ((performance.now() - t0) / 1000) % currentDuration(); render(); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [previewing, render, currentDuration]);
  const playAnim = useCallback(() => { haltPlayRef.current = false; if (animTimeRef.current === null) animTimeRef.current = 0; setPlaying(true); }, []);
  const stopAnim = useCallback(() => { setPlaying(false); animTimeRef.current = null; render(); }, [render]);
  // 暫停：停在這一格（再按播放從這裡接著播）；點一下畫布才回到編輯畫面
  const pauseAnim = useCallback(() => { setPlaying(false); render(); }, [render]);
  const seekAnim = useCallback((t: number) => { setPlaying(false); animTimeRef.current = t; render(); }, [render]);

  /**
   * 滑過效果按鈕時試播：暫時把選到的圖層換成只有這個效果、從頭一直重播；
   * 滑鼠移開（或點下去套用）就把原本的動畫換回來。試播不記進復原、也不會存檔。
   */
  const tryRef = useRef<{ saved: Map<string, LayerAnim[] | undefined>; raf: number; time: number | null; wasPlaying: boolean } | null>(null);
  const endTryAnim = () => {
    const tr = tryRef.current; if (!tr) return;
    cancelAnimationFrame(tr.raf);
    restoreAnims(layersRef.current, tr.saved);
    // 試播期間如果面板重畫過，會顯示試播用的效果：這裡同步回真正的動畫
    tryRef.current = null; animTimeRef.current = tr.time; refresh(); render();
    if (tr.wasPlaying) setPlaying(true);
  };
  const tryAnim = (kind: AnimKind | null) => {
    endTryAnim();
    if (!kind || kind === "carousel") return;
    const picked = layersRef.current.filter((l) => selectedIdsRef.current.includes(l.id) && !l.locked);
    if (!picked.length) return;
    const time = animTimeRef.current;
    if (playing) setPlaying(false);
    const saved = new Map(picked.map((l) => [l.id, l.anims] as const));
    clearAnims(picked);
    addAnimsTo(picked, kind, doc.w / 2, layersRef.current);
    // 第一個馬上開始；只跑一次的效果播完停一下再重來，一直動的效果看幾秒就重來
    const anims = picked.flatMap((l) => l.anims ?? []);
    const first = Math.min(...anims.map((a) => a.start));
    shiftAnims(picked, -first);
    const ends = picked.flatMap((l) => l.anims ?? []).map(animEnd).filter(Number.isFinite);
    const loop = ends.length ? Math.max(...ends) + 0.6 : 3;
    const t0 = performance.now();
    const tr = { saved, raf: 0, time, wasPlaying: playing };
    const tick = () => { animTimeRef.current = ((performance.now() - t0) / 1000) % loop; render(); tr.raf = requestAnimationFrame(tick); };
    tr.raf = requestAnimationFrame(tick);
    tryRef.current = tr;
  };
  useEffect(() => () => { const tr = tryRef.current; if (tr) cancelAnimationFrame(tr.raf); }, []);
  /** 清除這一頁所有動畫；只拿來閃光的「光澤範圍」也一起刪掉。可以 ⌘Z 復原。 */
  const clearPageAnims = () => {
    endTryAnim();
    const zones = layersRef.current.filter((l) => l.shineOnly).length;
    if (!window.confirm(`拿掉這一頁所有圖層的動畫${zones ? `（${zones} 塊光澤範圍也會一起刪掉）` : ""}？之後可以按 ⌘Z 復原。`)) return;
    layersRef.current = layersRef.current.filter((l) => !l.shineOnly);
    clearAnims(layersRef.current);
    setPlaying(false); animTimeRef.current = null;
    applySelection(selectedIdsRef.current.filter((id) => layersRef.current.some((l) => l.id === id)));
    markDirty(); refresh(); render();
  };

  /* ---------- 動畫的複製／貼上、公版（像 Lightroom 的拷貝設定 → 貼上設定） ---------- */
  const [animClip, setAnimClip] = useState<{ anims: LayerAnim[]; label: string } | null>(null);
  const [animPresets, setAnimPresets] = useState<AnimPreset[]>([]);
  const [staggerPaste, setStaggerPaste] = useState(true);
  // 公版存在這台瀏覽器：掛載後再讀（伺服器端沒有 localStorage）
  useEffect(() => { const t = setTimeout(() => setAnimPresets(loadPresets()), 0); return () => clearTimeout(t); }, []);
  const animSummary = (anims: LayerAnim[]) => [...new Set(anims.map((a) => ANIM_LABELS[a.kind]))].join("＋");
  const copyAnims = () => {
    const l = layersRef.current.find((x) => x.id === selectedIdsRef.current[0]);
    const anims = copyableAnims(l?.anims);
    if (anims.length) setAnimClip({ anims, label: animSummary(anims) });
  };
  /** 把一組動畫套到選取的物件（取代原本的動畫）；錯開的話照畫面閱讀順序一個晚 0.3 秒。 */
  const applyAnimsToSelection = (src: LayerAnim[]) => {
    endTryAnim();
    if (!pasteAnimsTo(layersRef.current, selectedIdsRef.current, src, staggerPaste ? PASTE_STAGGER : 0)) return;
    setPanelTab("anim");
    markDirty(); refresh(); playAnim();
  };
  const saveAnimPreset = () => {
    const l = layersRef.current.find((x) => x.id === selectedIdsRef.current[0]);
    const anims = copyableAnims(l?.anims);
    if (!anims.length) return;
    const name = window.prompt("公版名稱（同名會覆蓋）", animSummary(anims))?.trim();
    if (!name) return;
    const next = addPreset(animPresets, { id: `preset_${crypto.randomUUID().slice(0, 8)}`, name: name.slice(0, 40), anims: anims.map((a, i) => ({ ...a, id: `p${i}` })), createdAt: Date.now() });
    setAnimPresets(next);
    if (!savePresets(next)) alert("這個瀏覽器不能存資料（可能是私密模式），公版只會留到關掉頁面為止。");
  };
  const deleteAnimPreset = (pr: AnimPreset) => {
    if (!window.confirm(`刪除公版「${pr.name}」？`)) return;
    const next = animPresets.filter((x) => x.id !== pr.id);
    setAnimPresets(next); savePresets(next);
  };

  /** 把效果套到選到的圖層；選好幾個時，閃光／彈跳／閃爍依由左到右自動錯開，循環時也保持同樣順序。 */
  const applyAnimToSelection = (kind: AnimKind) => {
    endTryAnim();
    const picked = layersRef.current.filter((l) => selectedIdsRef.current.includes(l.id) && !l.locked).sort((a, b) => a.cx - b.cx);
    if (!picked.length) return;
    // 輪播只選了一張卡：問要幾張，自動複製排成一排（不用自己排、自己全選）
    if (kind === "carousel" && new Set(animUnits(picked.map((l) => ({ id: l.id, ...layerBox(l), groupId: l.groupId }))).values()).size === 1) {
      setCarouselAsk({
        ids: picked.map((l) => l.id),
        texts: picked.filter((l) => l.isText).map((l) => ({ id: l.id, label: l.text || l.name, thumb: null })),
        images: picked.filter(isPaintable).map((l) => ({ id: l.id, label: l.name, thumb: l.thumb })),
      });
      return;
    }
    addAnimsTo(picked, kind, doc.w / 2, layersRef.current);
    setPanelTab("anim");
    markDirty(); refresh(); playAnim();
  };
  /** 上傳一張圖到儲存空間，回傳網址（換圖、輪播設定共用）。 */
  const uploadImageFile = async (f: File): Promise<string> => {
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error ?? "上傳失敗");
    return d.url as string;
  };
  /** 換一張圖：新圖等比例放進原本那張圖的框裡（置中、不拉扁），位置、效果、動畫都保留。 */
  // 右側「換一張圖」打開的是哪個圖層（換選別的圖層就自動收起來）
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const swapLayerImage = async (id: string, url: string) => {
    const l = layersRef.current.find((x) => x.id === id);
    if (!l?.canvas) return;
    const cv = await loadToCanvas(url);
    if (!cv) { alert("讀取圖片失敗"); return; }
    const ar = cv.width / (cv.height || 1), nw = Math.min(l.w, l.h * ar);
    l.canvas = cv; l.naturalW = cv.width; l.naturalH = cv.height; l.src = url; l.w = nw; l.h = nw / ar; l.thumb = makeThumb(l);
    markDirty(); refresh(); render();
  };
  /** 輪播：選了一張卡時，問要做幾張。 */
  const [carouselAsk, setCarouselAsk] = useState<{ ids: string[]; texts: CarouselPart[]; images: CarouselPart[] } | null>(null);
  /**
   * 把選到的那一張卡複製成一排：第一張移到畫布正中間，其他張依序排在右邊（超出畫布的等著滑進來），
   * 間距＝卡片寬度再多一點空隙；全部套上同一組輪播，最後把畫面縮小到看得到整排。
   */
  const buildCarousel = async (ids: string[], contents: CarouselCardContent[]) => {
    const layers = layersRef.current;
    const card = layers.filter((l) => ids.includes(l.id));
    if (!card.length) return;
    const count = contents.length;
    const boxes = card.map(layerBox);
    const x0 = Math.min(...boxes.map((b) => b.x0)), x1 = Math.max(...boxes.map((b) => b.x1));
    const y0 = Math.min(...boxes.map((b) => b.y0)), y1 = Math.max(...boxes.map((b) => b.y1));
    const spacing = Math.round((x1 - x0) * 1.12);
    const shift = doc.w / 2 - (x0 + x1) / 2;
    // 每一張：先在原位換好字和圖（文字框自動寬度要在畫布裡算），再移到自己的位置
    const sets: EL[][] = [card];
    for (let i = 1; i < count; i++) sets.push(duplicateEls(card));
    const imgCache = new Map<string, HTMLCanvasElement | null>();
    for (const [i, set] of sets.entries()) {
      const want = contents[i];
      for (const [k, l] of set.entries()) {
        const origId = card[k].id;
        // 原本是一字一行的直排字：打的時候是一行，這裡轉回一字一行
        const typed = want.texts[origId];
        const text = typeof typed === "string" && isVerticalText(card[k].text) ? toVertical(typed) : typed;
        if (l.isText && typeof text === "string" && text !== l.text) { l.text = text; fitTextBox(l, doc.w, true); l.thumb = makeThumb(l); }
        const url = want.images[origId];
        if (url && l.canvas) {
          if (!imgCache.has(url)) imgCache.set(url, await loadToCanvas(url));
          const cv = imgCache.get(url);
          if (cv) {
            // 新圖放進原本那張圖的框裡（等比例、置中），不會被拉扁
            const ar = cv.width / (cv.height || 1), nw = Math.min(l.w, l.h * ar);
            l.canvas = cv; l.naturalW = cv.width; l.naturalH = cv.height; l.src = url; l.w = nw; l.h = nw / ar; l.thumb = makeThumb(l);
          }
        }
      }
    }
    for (const [i, set] of sets.entries()) for (const l of set) l.cx += shift + spacing * i;
    const all = sets.flat();
    let at = Math.max(...card.map((l) => layers.indexOf(l))) + 1;
    for (const set of sets.slice(1)) { layers.splice(at, 0, ...set); at += set.length; }
    addAnimsTo(all, "carousel", doc.w / 2, layers);
    applySelection(all.map((l) => l.id));
    setPanelTab("anim"); markDirty(); refresh();
    // 縮小畫面：畫布＋整排卡片都看得到，才找得到後面幾張來改字、換圖
    const wrap = wrapRef.current;
    if (wrap) {
      const bx0 = Math.min(0, x0 + shift), bx1 = Math.max(doc.w, x1 + shift + spacing * (count - 1));
      const by0 = Math.min(0, y0), by1 = Math.max(doc.h, y1);
      const pad = 48, z = Math.min((wrap.clientWidth - pad) / (bx1 - bx0), (wrap.clientHeight - pad) / (by1 - by0));
      view.current.zoom = Math.min(32, Math.max(0.02, z));
      view.current.panX = (wrap.clientWidth - (bx1 - bx0) * view.current.zoom) / 2 - bx0 * view.current.zoom;
      view.current.panY = (wrap.clientHeight - (by1 - by0) * view.current.zoom) / 2 - by0 * view.current.zoom;
      setZoomPct(Math.round(view.current.zoom * 100));
    }
    render();
  };
  /** 加一塊看不見的光澤範圍（圓角矩形，可以拉大縮小、換成橢圓），預設就有閃光。 */
  const addShineZone = () => {
    const w = doc.w * 0.4, h = doc.h * 0.25;
    const el: EL = {
      id: `shine_${crypto.randomUUID().slice(0, 8)}`, name: "光澤範圍", type: "object", semanticId: "object", instanceId: null, confidence: 1, editable: true, source: "generated",
      isText: false, text: "", color: "#000", fontSize: 24, fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700, align: "center",
      shape: { kind: "rect", fill: "#ffffff", stroke: "none", strokeWidth: 0, radius: 24 }, canvas: null, naturalW: w, naturalH: h, src: null,
      cx: doc.w / 2, cy: doc.h / 2, w, h, rotation: 0, visible: true, locked: false, opacity: 1, embeddedText: [], thumb: null,
      shineOnly: true, anims: [defaultAnim("shine", `anim_${crypto.randomUUID().slice(0, 6)}`, 0.2)],
    };
    el.thumb = makeThumb(el);
    layersRef.current.push(el); selectOnly(el.id); markDirty(); refresh(); render();
  };
  /** 輸出 MP4：一格一格畫（跟預覽同一套），瀏覽器內建編碼器壓成 H.264。 */
  const exportMp4 = async () => {
    if (mp4Busy !== null) return;
    if (!layersRef.current.some((l) => l.anims?.length)) { alert("還沒有圖層有動畫：先在「動畫」分頁選圖層、套用效果"); setLeftTab("animate"); return; }
    setPlaying(false); animTimeRef.current = null;
    setMp4Busy(0);
    try {
      const size = videoSize(doc.w, doc.h);
      const layers = layersRef.current;
      const blob = await encodeMp4({
        width: size.width, height: size.height, fps: 30, duration: currentDuration(),
        renderFrame: (ctx, t) => {
          ctx.scale(size.width / doc.w, size.height / doc.h);
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, doc.w, doc.h);
          for (const l of layers) if (l.visible) drawLayerAnimated(ctx, l, layers, t);
        },
        onProgress: (done, total) => setMp4Busy(done / total),
      });
      downloadMp4(blob, name || layersRef.current.find((l) => l.isText)?.text);
    } catch (err) {
      alert("輸出 MP4 失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally { setMp4Busy(null); render(); }
  };

  /* ---------- 下載 PSD ---------- */
  const [psdBusy, setPsdBusy] = useState(false);
  const downloadPsd = useCallback(async () => {
    if (psdBusy) return;
    setPsdBusy(true);
    try {
      const { writePsd } = await import("ag-psd");   // 很大，按下去才載入
      const psd = buildPsdDocument(layersRef.current, doc);
      const buf = writePsd(psd as unknown as Parameters<typeof writePsd>[0], { noBackground: true, generateThumbnail: true });
      const url = URL.createObjectURL(new Blob([buf], { type: "image/vnd.adobe.photoshop" }));
      const a = document.createElement("a"); a.href = url; a.download = psdFileName(name || layersRef.current.find((l) => l.isText)?.text); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      alert("下載 PSD 失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally { setPsdBusy(false); }
  }, [psdBusy, doc, name]);

  /* ---------- AI 換圖：先在畫布上預覽，按確定才算數（框不動） ---------- */
  // 預覽時直接換掉圖層的圖，但不記進上一步；原本的圖先存起來，取消就換回去。
  const replacePreview = useRef<{ id: string; snap: ImageSnap } | null>(null);
  const previewLayerImage = useCallback(async (id: string, v: ReplaceVariant, cutout: boolean) => {
    const target = layersRef.current.find((l) => l.id === id);
    if (!target) throw new Error("找不到這個圖層");
    const canvas = await loadToCanvas(v.url);
    if (!canvas) throw new Error("讀取新圖失敗");
    if (replacePreview.current?.id !== id) replacePreview.current = { id, snap: snapImage(target) };
    else restoreImage(target, replacePreview.current.snap);   // 換另一張之前先回到原本的框，去背的圖才會縮進同一個框
    applyReplacedImage(target, canvas, v.url, cutout);
    refresh(); render();
  }, [refresh, render]);
  const confirmLayerImage = useCallback(() => {
    if (!replacePreview.current) return;
    replacePreview.current = null;
    markDirty(); refresh(); render();
  }, [markDirty, refresh, render]);
  const cancelLayerImage = useCallback(() => {
    const p = replacePreview.current;
    if (!p) return;
    replacePreview.current = null;
    const target = layersRef.current.find((l) => l.id === p.id);
    if (target) restoreImage(target, p.snap);
    refresh(); render();
  }, [refresh, render]);

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

  /** 這一頁的背景色：最底下已經有鋪滿的色塊背景就改它的顏色，沒有就墊一塊（鎖住，不會被誤點拖走）。 */
  const setPageBackground = (color: string) => {
    if (!applyPageBackground(layersRef.current, color, doc.w, doc.h, FONT)) return;
    markDirty(); refresh(); render();
  };

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

  /* ---------- 畫布上直接改字：開始／結束 ---------- */
  /** 「選取的字」工具列放在文字框左上方（螢幕座標）。 */
  const editToolbarPos = (l: EL) => { const c = layerCorners(l).map((p) => d2s(p.x, p.y)); return { left: Math.min(...c.map((p) => p.x)), top: Math.min(...c.map((p) => p.y)) }; };
  const startTextEdit = (l: EL, range?: { start: number; end: number }) => {
    if (l.locked || !l.isText || l.canvas) return;
    selectOnly(l.id);
    editingRef.current = l.id; editingOriginalRef.current = l.text;
    // 框先貼齊字（以中心收，字不會跳）；最後沒改字就把框還原
    editGeomRef.current = snapTextGeom(l);
    fitTextBox(l, doc.w, true);
    pendingCaretRef.current = range ?? { start: l.text.length, end: l.text.length };
    caretOnRef.current = true; compStartRef.current = null;
    setEditingText({ id: l.id, original: l.text, ...editToolbarPos(l) });
    render();
  };
  /** 結束改字：有改才記一步「上一步」（整段改字算一步）；字全刪光就把這個文字圖層拿掉。 */
  const exitTextEdit = () => {
    const id = editingRef.current;
    if (!id) return;
    editingRef.current = null; compStartRef.current = null;
    const l = layersRef.current.find((x) => x.id === id);
    if (l && !l.text.trim()) { dropLayer(layersRef.current, id); selectedIdsRef.current = selectedIdsRef.current.filter((x) => x !== id); setSelectedIds(selectedIdsRef.current); setSelectedId(null); markDirty(); }
    else if (l && l.text !== editingOriginalRef.current) { refreshThumb(l); markDirty(); }
    else if (l && editGeomRef.current) restoreTextGeom(l, editGeomRef.current);
    editGeomRef.current = null;
    setEditingText(null); setTextSel(null); refresh(); render();
  };
  useEffect(() => { startTextEditRef.current = startTextEdit; exitTextEditRef.current = exitTextEdit; });
  // 進入改字：把焦點給看不見的 textarea、放好游標；游標每 530ms 閃一下
  const editingId = editingText?.id ?? null;
  useEffect(() => {
    if (!editingId) return;
    const ta = textAreaRef.current;
    if (ta && document.activeElement !== ta) ta.focus({ preventScroll: true });
    const r = pendingCaretRef.current;
    if (ta && r) { ta.setSelectionRange(r.start, r.end); pendingCaretRef.current = null; }
    render();
    const blink = setInterval(() => { caretOnRef.current = !caretOnRef.current; render(); }, 530);
    return () => clearInterval(blink);
  }, [editingId, render]);

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
      const refDataUrl = mode === "fill" && genFillRef ? await urlToJpegDataUrl(genFillRef) : null;
      if (mode === "fill" && genFillRef && !refDataUrl) throw new Error("讀不到參考圖，換一張試試");
      const r = await fetch("/api/magic-layers/magic-fill", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: source, maskDataUrl: m.toDataURL("image/png"), prompt: mode === "fill" ? genFillPrompt.trim() || undefined : undefined, mode, variants: 2,
          ...(mode === "fill" && refDataUrl ? { refDataUrl, box: marquee } : {}) }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "生成失敗");
      setGenFillResult(d.variants); setGenFillIndex(0);
      if (d.variants?.[0]) await previewGenFill(d.variants[0]);
    } catch (e) { alert("生成式填色失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setGenFillBusy(false); }
  }, [marquee, genFillBusy, doc.w, doc.h, flattenToDataUrl, flattenLayersToDataUrl, genFillPrompt, genFillRef, previewGenFill]);

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
      // 分段樣式（只把某幾個字放大／換色）：之前漏接，範本和多頁草稿第 2 頁以後重開就變回整段同一個樣式
      ...(sl.runs?.length ? { runs: sl.runs.map((r) => ({ ...r })) } : {}),
      shape: (sl.shape as ShapeSpec | undefined) ?? null,
      canvas, naturalW: canvas?.width ?? sl.w, naturalH: canvas?.height ?? sl.h,
      src: sl.image ?? null,
      cx: sl.x + sl.w / 2, cy: sl.y + sl.h / 2, w: boxW, h: boxH,
      rotation: sl.rotation ?? 0, visible: sl.visible !== false, locked: !!sl.locked,
      opacity: sl.opacity ?? 1, embeddedText: [], thumb: null, groupId: sl.groupId ?? null, clipTo: sl.clipTo ?? null,
      skewX: sl.skewX ?? 0, skewY: sl.skewY ?? 0,
      ...(sl.wrap ? { wrap: true } : {}),
      ...(sl.paint?.length ? { paint: sl.paint } : {}),
      ...(sl.glow ? { glow: sl.glow } : {}),
      ...(sl.anims?.length ? { anims: readAnims(sl.anims) } : {}),
      ...readLifespan(sl),
      ...(sl.shineOnly ? { shineOnly: true } : {}),
      ...(sl.shadow ? { shadow: sl.shadow } : {}),
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
  const [pagesView, setPagesView] = useState<{ id: string; name: string; thumb: string | null; w: number; h: number; transitionIn: PageTransition | null }[]>([]);
  const [curThumb, setCurThumb] = useState<string | null>(null);
  const syncPagesView = useCallback(() => setPagesView(pagesRef.current.map((p) => ({ id: p.id, name: p.name, thumb: p.thumb, w: p.w, h: p.h, transitionIn: p.transitionIn }))), []);

  // 第一次掛載：第 1 頁就是目前的畫布；其他頁在背景轉回圖層、算好縮圖
  useEffect(() => {
    const first: EditorPage = { id: "page-1", name: firstPageName ?? "", w: image.naturalWidth, h: image.naturalHeight, els: null, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: null, videoLen: animDuration ?? null, transitionIn: null };
    const rest: EditorPage[] = (extraPages ?? []).map((pg, i) => {
      const page: EditorPage = { id: `page-${i + 2}`, name: pg.name ?? "", w: pg.docW, h: pg.docH, els: null, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: null,
        videoLen: typeof pg.animDuration === "number" && pg.animDuration > 0 ? Math.min(30, pg.animDuration) : null, transitionIn: readTransition(pg.transitionIn) };
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
    p.videoLen = videoLenRef.current;
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
    setVideoLen(p.videoLen); videoLenRef.current = p.videoLen;
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
    const page: EditorPage = { id: `page-${crypto.randomUUID().slice(0, 8)}`, name: duplicate && src.name ? `${src.name} 複本` : "", w: src.w, h: src.h, els, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: flattenEls(els, src.w, src.h, PAGE_THUMB),
      videoLen: duplicate ? src.videoLen : null, transitionIn: null };
    pagesRef.current.splice(pageIdxRef.current + 1, 0, page);
    setPagesChanged(true);
    void activatePage(pageIdxRef.current + 1);
  }, [stashCurrentPage, activatePage]);
  /** 在目前這頁後面加一頁，放進現成的圖層（照參考圖重做的結果），尺寸可以跟目前這頁不同。 */
  const addPageWith = useCallback((name: string, els: EL[], w: number, h: number) => {
    stashCurrentPage();
    const page: EditorPage = { id: `page-${crypto.randomUUID().slice(0, 8)}`, name, w, h, els, loading: null, history: [], histIdx: 0, savedIdx: 0, thumb: flattenEls(els, w, h, PAGE_THUMB), videoLen: null, transitionIn: null };
    pagesRef.current.splice(pageIdxRef.current + 1, 0, page);
    setPagesChanged(true);
    void activatePage(pageIdxRef.current + 1);
  }, [stashCurrentPage, activatePage]);

  /**
   * 匯入 PSD：每個工作區域一頁（沒有工作區域就整份一頁），圖層一路從群組裡拆出來。
   * 圖片圖層先上傳拿網址再放進畫布：直接把像素塞進存檔的話，圖層一多存檔就會超過伺服器大小上限。
   * 目前畫布是空的（只有一頁、沒有圖層）→ 直接換成 PSD 的頁；不是空的 → 加在目前這頁後面，不會蓋掉。
   */
  const importPsd = async (file: File) => {
    if (file.size > PSD_MAX_BYTES) { alert(`PSD 太大（${Math.round(file.size / 1048576)}MB）。上限 ${PSD_MAX_BYTES / 1048576}MB，請先在 Photoshop 合併不需要的圖層或縮小尺寸。`); return; }
    setPsdImporting("讀取 PSD 中…");
    try {
      const [{ readPsd }, buf] = await Promise.all([import("ag-psd"), file.arrayBuffer()]);
      await new Promise((r) => setTimeout(r, 30));   // 讓「讀取中」先畫出來，大檔讀的時候畫面才不會像當掉
      const psd = readPsd(buf, { skipThumbnail: true, skipLinkedFilesData: true });
      const plan = planPsdImport(psd as unknown as PsdLike);
      const imageCount = plan.pages.reduce((n, p) => n + p.layers.filter((l) => l.kind === "image").length, 0);
      let done = 0;
      setPsdImporting(`上傳圖層 0／${imageCount}`);
      const built: { name: string; w: number; h: number; els: EL[] }[] = [];
      for (const page of plan.pages) {
        const baked = new Map<number, { canvas: HTMLCanvasElement; left: number; top: number }>();
        const saved: (SavedLayer | null)[] = page.layers.map(() => null);
        const uploads: (() => Promise<void>)[] = [];
        page.layers.forEach((l, i) => {
          const common = { id: `psd_${i}_${crypto.randomUUID().slice(0, 6)}`, name: l.name, zIndex: i, x: l.x, y: l.y, w: l.w, h: l.h, rotation: l.rotation ?? 0, visible: l.visible, opacity: l.opacity, locked: false, groupId: l.groupId,
            ...(l.kind !== "rect" && l.shadow ? { shadow: l.shadow } : {}), ...(l.kind !== "rect" && l.glow ? { glow: l.glow } : {}) };
          if (l.kind === "rect") { saved[i] = { ...common, type: "background", locked: true, shape: { kind: "rect", fill: l.fill, stroke: "none", strokeWidth: 0 } }; return; }
          if (l.kind === "text") {
            saved[i] = { ...common, type: "independent_text", isText: true, text: l.text, color: l.color, fontSize: l.fontSize, fontFamily: l.fontFamily, fontWeight: l.fontWeight, align: l.align,
              ...(l.runs ? { runs: l.runs } : {}), ...(l.fx ? { fx: l.fx } : {}) };
            return;
          }
          const canvas = bakePsdImage(l, baked);
          baked.set(i, { canvas, left: l.docLeft, top: l.docTop });
          uploads.push(async () => {
            const url = await uploadImageFile(await canvasToPngFile(canvas, l.name));
            saved[i] = { ...common, type: l.background ? "background" : "object", image: url };
            done += 1; setPsdImporting(`上傳圖層 ${done}／${imageCount}`);
          });
        });
        // 一次傳 4 張：太多同時傳會被瀏覽器排隊，一張一張傳又太慢
        for (let k = 0; k < uploads.length; k += 4) await Promise.all(uploads.slice(k, k + 4).map((u) => u()));
        const layers = saved.filter((x): x is SavedLayer => !!x);
        built.push({ name: page.name, w: page.w, h: page.h, els: await Promise.all(layers.map(elFromSavedLayer)) });
      }
      if (!built.length) { alert("這個 PSD 裡沒有可以匯入的圖層。"); return; }
      stashCurrentPage();
      const replace = pagesRef.current.length === 1 && layersRef.current.length === 0;
      const pages: EditorPage[] = built.map((b) => ({ id: `page-${crypto.randomUUID().slice(0, 8)}`, name: b.name, w: b.w, h: b.h, els: b.els, loading: null, history: [], histIdx: 0, savedIdx: 0,
        thumb: flattenEls(b.els, b.w, b.h, PAGE_THUMB), videoLen: null, transitionIn: null }));
      const at = replace ? 0 : pageIdxRef.current + 1;
      pagesRef.current.splice(at, replace ? 1 : 0, ...pages);
      setPagesChanged(true);
      await activatePage(at);
      setPsdReport({ pages: built.length, layers: built.reduce((n, b) => n + b.els.length, 0), skipped: plan.skipped, approximated: plan.approximated });
    } catch (err) {
      alert("匯入 PSD 失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally { setPsdImporting(null); }
  };

  /** 整份影片要用的每一頁（還在背景轉換的頁先等它轉完）。 */
  const sequenceItems = useCallback(async (): Promise<SeqItem[]> => {
    stashCurrentPage();
    const pages = pagesRef.current;
    const els = await Promise.all(pages.map((p) => p.els ?? p.loading ?? Promise.resolve<EL[]>([])));
    return pages.map((p, i) => ({ els: els[i], w: p.w, h: p.h, duration: pageDuration(els[i], p.videoLen), transitionIn: i > 0 ? p.transitionIn : null }));
  }, [stashCurrentPage]);
  /** 預覽整份影片（蓋在畫面上的播放器）。 */
  const [seqPreview, setSeqPreview] = useState<{ width: number; height: number; total: number; draw: (ctx: CanvasRenderingContext2D, t: number) => void } | null>(null);
  const openSequencePreview = useCallback(async () => {
    stopAnim();
    const items = await sequenceItems();
    const vs = videoSize(items[0].w, items[0].h, 900);
    const seq = makeSequenceRenderer(items, vs.width, vs.height);
    setSeqPreview({ width: vs.width, height: vs.height, total: seq.layout.total, draw: seq.draw });
  }, [sequenceItems, stopAnim]);
  /** 時間軸要列的物件（由上到下，背景不列）：存在時間、縮圖、有沒有動畫。 */
  const lifeRows = (): LifeRow[] => {
    const dur = currentDuration();
    return [...layersRef.current].reverse().filter((l) => l.type !== "background").map((l) => ({
      id: l.id, name: layerLabel(l), sub: `${TYPE_LABEL[l.type] ?? "物件"}圖層`, isText: l.isText, thumb: l.thumb,
      ...lifespanOf(l, dur), hasAnim: !!l.anims?.length, anims: l.anims ?? [],
      timed: !!l.anims?.length || l.startTime !== undefined || l.endTime !== undefined,
    }));
  };
  const [dockMode, setDockMode] = useState<DockMode>("closed");
  // 時間軸上點到的動畫片段：右側動畫卡跟著亮起來
  const [focusAnimId, setFocusAnimId] = useState<string | null>(null);
  /** 第 i 頁做成影片播幾秒（這頁沒有動畫＝null，頁面列就不顯示秒數）。 */
  const pageSeconds = (i: number): number | null => {
    // 有動畫、或有物件設了出現／消失時間的頁才標秒數
    const timed = (els: EL[]) => els.some((l) => l.anims?.length || l.startTime !== undefined || l.endTime !== undefined);
    if (i === pageIdxRef.current) return timed(layersRef.current) ? currentDuration() : null;
    const p = pagesRef.current[i], els = p?.els;
    return els && timed(els) ? pageDuration(els, p.videoLen) : null;
  };
  /** 設定從上一頁換到第 i 頁的過場（null＝直接切換）。 */
  const setPageTransition = useCallback((i: number, tr: PageTransition | null) => {
    const p = pagesRef.current[i]; if (!p) return;
    p.transitionIn = tr; setPagesChanged(true); syncPagesView();
  }, [syncPagesView]);

  /** 輸出整份影片：每一頁依序接起來，頁跟頁之間播過場（影片尺寸用第 1 頁的）。 */
  const exportWholeMp4 = useCallback(async () => {
    if (mp4Busy !== null) return;
    stopAnim(); setMp4Busy(0);
    try {
      const items = await sequenceItems();
      const vs = videoSize(items[0].w, items[0].h);
      const seq = makeSequenceRenderer(items, vs.width, vs.height);
      const blob = await encodeMp4({ width: vs.width, height: vs.height, fps: 30, duration: seq.layout.total, renderFrame: seq.draw, onProgress: (done, total) => setMp4Busy(done / total) });
      downloadMp4(blob, name || items[0].els.find((l) => l.isText)?.text);
    } catch (err) {
      alert("輸出 MP4 失敗：" + (err instanceof Error ? err.message : String(err)));
    } finally { setMp4Busy(null); render(); }
  }, [mp4Busy, stopAnim, sequenceItems, name, render]);

  /**
   * AI 生成背景：打字描述（可附參考圖）→ 生成一張符合目前畫布比例的底圖 → 換成背景。
   * 其他圖層都不動；換背景是一個復原步驟，不滿意按 ⌘Z。
   */
  const generateBackground = useCallback(async () => {
    if (!bgPrompt.trim() || aiBusy) return;
    setAiBusy("bg"); setAiMsg(null);
    try {
      const ar = doc.w / doc.h;
      const ratio = (["1:1", "4:5", "3:4", "16:9", "9:16", "4:3"] as const).reduce((best, r) => {
        const [a, b] = r.split(":").map(Number), [c, d] = best.split(":").map(Number);
        return Math.abs(Math.log(a / b / ar)) < Math.abs(Math.log(c / d / ar)) ? r : best;
      }, "1:1" as string);
      const r = await fetch("/api/magic-layers/compose", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundPrompt: bgPrompt.trim(), backgroundRefUrl: bgRef || undefined, ratio, productImageUrls: [], texts: [] }) });
      const d = await r.json().catch(() => ({})) as { backgroundUrl?: string; error?: string };
      if (!r.ok || !d.backgroundUrl) throw new Error(d.error ?? "生成失敗，請稍後再試");
      await replaceBackground(d.backgroundUrl);
      setAiMsg("已換上新背景。不滿意可以按 ⌘Z 回到原本的背景，或改一下描述再生成一次。");
    } catch (e) { setAiMsg("生成背景失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setAiBusy(null); }
  }, [bgPrompt, bgRef, aiBusy, doc.w, doc.h, replaceBackground]);

  /**
   * 照參考圖重做：上傳一張設計圖，AI 拆成可編輯的圖層，放進「新的一頁」——目前的畫布完全不動。
   * 跟「建立圖文 → AI 幫我設計」是同一套（/api/magic-layers/rebuild），約 30–60 秒。
   */
  const rebuildFromReference = useCallback(async (file: File) => {
    if (aiBusy) return;
    setAiBusy("rebuild"); setAiMsg(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error("讀不到這張圖片")); fr.readAsDataURL(file); });
      const image = await shrinkForUpload(dataUrl);
      const r = await fetch("/api/magic-layers/rebuild", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "重做失敗，請稍後再試");
      const result = d as RebuildResult;
      const els = await Promise.all((await buildRebuildSavedLayers(result)).map((sl) => elFromSavedLayer(sl)));
      addPageWith("參考圖重做", els, result.docW, result.docH);
      setAiMsg("已放進新的一頁「參考圖重做」，原本的畫布沒有動。");
    } catch (e) { setAiMsg("照參考圖重做失敗：" + (e instanceof Error ? e.message : String(e))); }
    finally { setAiBusy(null); }
  }, [aiBusy, elFromSavedLayer, addPageWith]);

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
    if (tplApplyingRef.current) return;
    tplApplyingRef.current = true; setTplApplying(true);
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
    finally { tplApplyingRef.current = false; setTplApplying(false); }
  }, [elFromSavedLayer, markDirty, refresh, render]);

  /** 把目前畫布存成共用範本，連同一張縮圖。 */
  const saveAsTemplate = useCallback(async () => {
    if (tplSaving) return;
    if (!layersRef.current.some((l) => l.visible)) { alert("空白畫布不能存成範本"); return; }
    const templateName = window.prompt("範本名稱", name || "未命名範本");
    if (templateName === null) return;
    setTplSaving(true);
    try {
      // 縮圖：攤平後長邊縮到 480px（照原比例，直式範本不能壓扁），列表用不著原尺寸。
      const flat = flattenToDataUrl();
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = flat; });
      const ts = 480 / Math.max(doc.w, doc.h);
      const tc = document.createElement("canvas"); tc.width = Math.round(doc.w * ts); tc.height = Math.round(doc.h * ts);
      tc.getContext("2d")!.drawImage(img, 0, 0, tc.width, tc.height);
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

  const doSave = useCallback(async (download: boolean, format: "png" | "jpg" = "png") => {
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
      const pagePayload = multi ? pages.map((p, i) => ({ docW: p.w, docH: p.h, layers: serializeEls(pageEls[i]), ...(p.name ? { name: p.name } : {}),
        ...(p.videoLen ? { animDuration: p.videoLen } : {}), ...(i > 0 && p.transitionIn ? { transitionIn: p.transitionIn } : {}) })) : undefined;
      // 外層的 animDuration 是第 1 頁的長度（單頁、舊版讀取都照舊）
      const firstLen = multi ? pages[0].videoLen : videoLen;
      const pageImages = download && multi ? pages.map((p, i) => flattenEls(pageEls[i], p.w, p.h)) : undefined;
      await onSave({ docW: firstW, docH: firstH, layers: multi ? pagePayload![0].layers : serializeLayers(), imageDataUrl, finalize: download, pages: pagePayload, pageImages, ...(firstLen ? { animDuration: firstLen } : {}) });
      savedIdx.current = histIdx.current;
      markPagesSaved(pages, pageIdxRef.current, histIdx.current);
      setPagesChanged(false);
      setSaved(true); bump(); setTimeout(() => setSaved(false), 2000);
      if (download) {
        const nameLayer = layersRef.current.find((l) => l.isText);
        const base = (nameLayer?.text || "magic-layout").slice(0, 40);
        const pngs = pageImages ?? (imageDataUrl ? [imageDataUrl] : []);
        const files = format === "jpg" ? await Promise.all(pngs.map(toJpegDataUrl)) : pngs;
        files.forEach((href, i) => {
          // 瀏覽器連續下載需要一點間隔，不然只會留最後一張
          setTimeout(() => {
            const a = document.createElement("a");
            const pageName = pages[i]?.name ? pages[i].name.replace(/[\\/:*?"<>|]/g, "") : String(i + 1);
            a.download = files.length > 1 ? `${base}-${pageName}.${format}` : `${base}.${format}`;
            a.href = href; document.body.appendChild(a); a.click(); a.remove();
          }, i * 350);
        });
      }
    } catch (err) { alert("儲存失敗：" + (err instanceof Error ? err.message : String(err))); }
    finally { setSaving(false); }
  }, [onSave, saving, doc.w, doc.h, flattenToDataUrl, serializeLayers, stashCurrentPage, videoLen]);

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
    if (!selEl) return; Object.assign(selEl, patch);
    // 右側「文字內容」跟畫布上改字一樣：框跟著字的長度調整（自動寬度）
    if ("text" in patch || "wrap" in patch) fitTextBox(selEl, doc.w, true);
    selEl.thumb = makeThumb(selEl); markDirty(); render(); refresh();
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
  // 這一頁的純色背景（沒選東西時右側「這一頁」用）；panel 是由上往下，背景在最後一個
  const pageBackground = pageBackgroundOf([...panel].reverse(), doc.w, doc.h);
  // 下方時間軸：開著左側「動畫」、這頁有動畫或存在時間、或使用者打開了，才出現
  const dockShown = leftTab === "animate" || dockMode !== "closed" || panel.some((l) => l.anims?.length || l.startTime !== undefined || l.endTime !== undefined);
  // 時間軸出現／展開、左側面板變寬時畫布區變小：重新縮放，畫布才不會被時間軸蓋住、被右欄切掉
  const stageLayout = `${leftTab === "animate"}|${dockShown ? dockMode : "none"}`;
  useEffect(() => { const id = requestAnimationFrame(() => fitRef.current()); return () => cancelAnimationFrame(id); }, [stageLayout]);

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
        <button style={{ ...S.tbtn, ...(handMode ? { background: "#f5f3ff", color: "#6d28d9", border: "1px solid #c4b5fd" } : {}) }} aria-pressed={handMode}
          title={handMode ? "手形工具開著：拖曳移動畫面（按 H 或 Esc 關掉）" : "手形工具（H）：拖曳移動畫面；也可以按住空白鍵拖曳"}
          onClick={() => { const on = !handRef.current; handRef.current = on; setHandMode(on); if (canvasRef.current) canvasRef.current.style.cursor = on ? "grab" : "default"; }}><Hand size={15} /></button>
        {/* 縮放（只改看的大小）跟「比例」（會改畫布尺寸）分開放，中間隔一條線：原本「− 58% ＋ 1:1」連在一起，1:1 很像「縮放 100%」 */}
        <button style={S.tbtn} onClick={() => setZoom(view.current.zoom / 1.2)} title="縮小畫面" aria-label="縮小畫面">−</button>
        <span style={{ width: 48, textAlign: "center", color: "#6b7280", fontSize: 13, fontVariantNumeric: "tabular-nums" }} title="目前顯示大小（不影響輸出尺寸）">{zoomPct}%</span>
        <button style={S.tbtn} onClick={() => setZoom(view.current.zoom * 1.2)} title="放大畫面" aria-label="放大畫面">＋</button>
        <button style={S.tbtn} onClick={() => fitRef.current()} title="整張畫布剛好放進畫面"><Maximize2 size={14} />符合畫面</button>
        <span style={S.divider} />
        <label title={`畫布比例：會改輸出尺寸（目前 ${doc.w}×${doc.h}）`} style={{ ...S.tbtn, gap: 4, paddingRight: 6, cursor: "pointer" }}>
          <span style={{ color: "#9ca3af", fontWeight: 600 }}>比例</span>
          <select aria-label="畫布比例" value={canvasRatio} onChange={(e) => resizeCanvasToRatio(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer", outline: "none", paddingRight: 2 }}>
            {canvasRatio === "custom" && <option value="custom" disabled>自訂</option>}
            {CANVAS_RATIOS.map(([k]) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
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
        <span style={{ flex: 1 }} />
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{layersRef.current.length} 圖層 · 文件 {doc.w}×{doc.h}</span>
        {/* 下載放最右上角：大部分設計工具的匯出都在那裡 */}
        {onSave && (
          <>
            <span style={S.divider} />
            {(saving || saved) && <span aria-live="polite" style={{ fontSize: 12, color: saved ? "#16a34a" : "#9ca3af" }}>{saving ? "儲存中…" : "✓ 已自動儲存"}</span>}
            <DownloadMenu busy={saving || psdBusy}
              onPick={(f) => { if (f === "psd") void downloadPsd(); else if (f === "mp4") void exportMp4(); else void doSave(true, f); }} />
          </>
        )}
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
              <button key={t.id} onClick={() => { setLeftTab(on ? null : t.id); if (!on && t.id === "animate") setPanelTab("anim"); /* 打開左側「動畫」時右側也切到「動畫」，細節就在旁邊調 */ }} aria-pressed={on} title={on ? `收起${t.label}` : t.label}
                style={{ ...S.railBtn, ...(on ? { background: "#f5f3ff", color: "#6d28d9" } : {}) }}>
                <t.Icon size={20} />
                <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>{t.label}</span>
              </button>
            );
          })}
        </nav>
        {/* 動畫分頁的效果按鈕排三欄，面板寬一點才放得下四個字的效果名稱 */}
        {leftTab && (
        <aside style={{ ...S.panel, ...(leftTab === "animate" ? { width: 330 } : {}) }} aria-label={LEFT_TABS.find((t) => t.id === leftTab)?.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px", borderBottom: "1px solid #f3f4f6", flex: "0 0 auto" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginRight: "auto" }}>{LEFT_TABS.find((t) => t.id === leftTab)?.label}</span>
            {leftTab === "templates" && templates.length > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>{templates.length} 個・點擊套用</span>}
            {leftTab === "materials" && backgrounds?.length ? <span style={{ fontSize: 11, color: "#9ca3af" }}>加入畫布・放大看・可拖曳</span> : null}
            <button onClick={() => setLeftTab(null)} title="收起面板" aria-label="收起面板" style={{ ...S.icon, width: 28, height: 28 }}><ChevronLeft size={16} /></button>
          </div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: leftTab === "templates" || leftTab === "materials" ? "10px 10px 14px" : "8px 6px 14px" }}>
            {leftTab === "templates" && (<>
              {/* 範本庫：共用（全品牌看得到）；不是正方形的範本縮圖不裁切，角落標比例（套用後畫布會換成那個尺寸） */}
                {templates.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                    範本載入中……如果一直沒出現，重新整理一次。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {templates.map((t, i) => (
                      <div key={t.id} style={{ position: "relative" }}>
                        <button onClick={() => setTplPreview(i)} title={`${t.name}（點擊放大預覽）`}
                          style={{ display: "block", width: "100%", padding: 0, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: "pointer" }}>
                          {t.previewUrl
                            ? <img src={t.previewUrl} alt={t.name} style={{ width: "100%", aspectRatio: "1", objectFit: t.docW && t.docH && t.docW !== t.docH ? "contain" : "cover", background: "#f3f4f6", display: "block" }} />
                            : <div style={{ width: "100%", aspectRatio: "1", display: "grid", placeItems: "center", fontSize: 10, color: "#9ca3af" }}>無縮圖</div>}
                        </button>
                        {t.docW && t.docH && t.docW !== t.docH && (
                          <span style={{ position: "absolute", left: 3, bottom: 3, padding: "0 5px", borderRadius: 5, fontSize: 9, fontWeight: 700, lineHeight: "15px", color: "#fff", background: "rgba(17,24,39,.66)", pointerEvents: "none" }}>
                            {ratioLabel(t.docW, t.docH)}
                          </span>
                        )}
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
                   每張圖都能加入畫布、放大看，也能直接拖到畫布上 */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {backgrounds.map((b, i) => (
                    <MaterialThumb key={i} url={b.url} label={b.label ?? ""}
                      onPreview={() => setMatPreview(i)}
                      onAddToCanvas={() => void pushImageLayer(b.url, b.label || "圖片")} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, padding: 4 }}>素材庫目前沒有圖片。可以到「上傳」加入自己的圖。</div>
              )
            )}
            {leftTab === "ai" && (<>
              {/* 生成背景：打字描述（可附參考圖）→ 換成背景，其他圖層不動 */}
              <div style={S.aiCard}>
                <div style={S.aiCardTitle}><ImageIcon size={15} color="#7c3aed" />生成背景</div>
                <textarea value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} disabled={!!aiBusy} rows={3}
                  placeholder="例：夏日海灘，清爽日系廣告風格，陽光燦爛、乾淨簡約"
                  style={{ ...S.rinput, height: "auto", padding: "8px 10px", resize: "vertical", fontSize: 12, lineHeight: 1.6 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {bgRef ? (<>
                    <img src={bgRef} alt="參考圖" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                    <button onClick={() => setBgRef(null)} disabled={!!aiBusy} style={{ ...S.rbtn, height: 26, padding: "0 8px", fontSize: 11 }}>移除參考圖</button>
                  </>) : (
                    <button onClick={() => bgRefInput.current?.click()} disabled={!!aiBusy} style={{ ...S.rbtn, height: 26, padding: "0 8px", fontSize: 11 }}>＋ 參考圖（選填）</button>
                  )}
                </div>
                <button onClick={() => void generateBackground()} disabled={!bgPrompt.trim() || !!aiBusy}
                  style={{ ...S.aiCardBtn, ...(!bgPrompt.trim() || aiBusy ? { opacity: .5, cursor: "not-allowed" } : {}) }}>
                  {aiBusy === "bg" ? "生成中…（約 15–30 秒）" : "生成背景"}
                </button>
              </div>
              {/* 照參考圖重做：上傳設計圖 → 拆成可編輯的圖層，放進新的一頁 */}
              <div style={S.aiCard}>
                <div style={S.aiCardTitle}><Layers size={15} color="#7c3aed" />照參考圖重做</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>上傳一張設計圖，AI 拆成可以改的文字、產品和色塊，放在新的一頁（目前的畫布不會動）。</div>
                <button onClick={() => rebuildInput.current?.click()} disabled={!!aiBusy}
                  style={{ ...S.aiCardBtn, ...(aiBusy ? { opacity: .5, cursor: "not-allowed" } : {}) }}>
                  {aiBusy === "rebuild" ? "AI 拆解版面中…（約 30–60 秒）" : "上傳參考圖"}
                </button>
              </div>
              {aiMsg && <div role="status" style={{ fontSize: 11, color: aiMsg.includes("失敗") ? "#b91c1c" : "#15803d", background: aiMsg.includes("失敗") ? "#fef2f2" : "#f0fdf4", borderRadius: 8, padding: "8px 10px", margin: "0 4px 10px", lineHeight: 1.6 }}>{aiMsg}</div>}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "4px 6px 6px" }}>編輯目前的畫面</div>
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
            {leftTab === "animate" && (
              <AnimationTab
                getDuration={currentDuration} autoDuration={!videoLen} onDuration={(d) => { setVideoLen(d); if (d) clampPageLifespans(layersRef.current, d); markDirty(); }}
                playing={playing} getTime={getAnimTime} onPlay={playAnim} onPause={stopAnim} onSeek={seekAnim}
                selectionCount={selectedIds.length} onApply={applyAnimToSelection} onAddZone={addShineZone}
                getTracks={currentTracks} selectedIds={selectedIds} onSelectLayer={(id) => { selectOnly(id); render(); }}
                onMoveStart={(layerId, animId, start) => { moveAnimGroup(layersRef.current, layerId, animId, start); seekAnim(start); refresh(); }}
                onCommitMove={() => markDirty()}
                onRenameTrack={(layerId, animId, name) => { renameAnimGroup(layersRef.current, layerId, animId, name); markDirty(); refresh(); }}
                onResizeTrack={(layerId, animId, duration) => { resizeAnimGroup(layersRef.current, layerId, animId, duration); refresh(); render(); }}
                onRemoveTrack={(layerId, animId) => { removeAnimGroup(layersRef.current, layerId, animId); markDirty(); refresh(); render(); }}
                activeKinds={[...new Set(selEl?.anims?.map((a) => a.kind) ?? [])]}
                onTry={tryAnim} onClearAll={clearPageAnims}
                pageCount={pagesView.length || 1} onPreviewAll={() => void openSequencePreview()}
                onExport={(all) => void (all ? exportWholeMp4() : exportMp4())} exporting={mp4Busy !== null} progress={mp4Busy ?? 0}
                presets={animPresets} onApplyPreset={(pr) => applyAnimsToSelection(pr.anims)} onDeletePreset={deleteAnimPreset} />
            )}
            {leftTab === "upload" && (<>
              <button style={S.tool} onClick={() => uploadImgRef.current?.click()}><Upload size={16} />上傳圖片</button>
              <button style={S.tool} onClick={() => addProdRef.current?.click()} disabled={adding} title="上傳一張產品圖，自動去背後加入為新圖層">
                <Plus size={16} />{adding ? "去背中…" : "加入產品（自動去背）"}
              </button>
              <button style={S.tool} onClick={addLogo}><BadgeCheck size={16} />Logo</button>
              <button style={S.tool} onClick={() => psdInput.current?.click()} disabled={!!psdImporting} title="Photoshop 檔：每個工作區域變成一頁，圖層、文字都拆開可以改">
                <Layers size={16} />{psdImporting ? "匯入中…" : "匯入 PSD（可多頁）"}
              </button>
              <div style={{ fontSize: 11, color: "#9ca3af", padding: "8px 4px 0", lineHeight: 1.6 }}>也可以把「素材」裡的圖直接拖到畫布上。</div>
            </>)}
          </div>
        </aside>
        )}
        {/* 檔案選擇框一直留著：面板收起來時快捷操作、其他地方的按鈕也要用得到 */}
        <input ref={uploadImgRef} type="file" accept="image/*" onChange={onUploadImage} style={{ display: "none" }} />
        <input ref={addProdRef} type="file" accept="image/*" onChange={addProduct} style={{ display: "none" }} />
        <input ref={psdInput} type="file" accept=".psd,image/vnd.adobe.photoshop,application/x-photoshop" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (f) void importPsd(f);
        }} />
        <input ref={bgRefInput} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          const fr = new FileReader(); fr.onload = () => setBgRef(String(fr.result)); fr.readAsDataURL(f);
        }} />
        <input ref={rebuildInput} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (f) void rebuildFromReference(f);
        }} />

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
          {(tplApplying || psdImporting) && (
            <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,249,252,.72)", backdropFilter: "blur(2px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "#fff", border: "1px solid #ebeff5", boxShadow: "0 6px 20px rgba(17,24,39,.08)", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ddd6fe", borderTopColor: "#7c3aed", animation: "tpl-spin .8s linear infinite" }} />
                {psdImporting ?? "套用範本中，正在載入圖片…"}
              </div>
              <style>{"@keyframes tpl-spin{to{transform:rotate(360deg)}}"}</style>
            </div>
          )}
          {psdReport && <PsdReportCard report={psdReport} onClose={() => setPsdReport(null)} />}
          {/* 空白畫布：直接給幾個起點，不讓人對著一張白紙不知道要按哪裡 */}
          {/* 只有純色背景也還算空白（先選了背景色），有圖片或其他東西才收起來 */}
          {panel.every((l) => l.type === "background" && !l.canvas) && !tplApplying && !psdImporting && (
            <EmptyCanvasStart
              onTemplate={() => setLeftTab("templates")} onUpload={() => uploadImgRef.current?.click()} onPsd={() => psdInput.current?.click()}
              onText={addTextLayer} onAi={() => setLeftTab("ai")} />
          )}
          {/* 生成式填色的輸入列／結果列：放在畫布範圍裡，才不會蓋到下面的時間軸 */}
      {marquee && !genFillResult && (
        <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 92, display: "flex", gap: 8, alignItems: "center", background: "#1f2937", padding: 10, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)" }}>
          <input
            autoFocus
            value={genFillPrompt}
            onChange={(e) => setGenFillPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !genFillBusy && (genFillPrompt.trim() || genFillRef)) generateFillInMarquee("fill"); if (e.key === "Escape") { setMarquee(null); marqueeRef.current = null; render(); } }}
            placeholder={genFillRef ? "要放什麼？例如：放一束跟參考圖一樣的花（不寫就照參考圖）" : "要在這塊畫什麼？（想清掉東西就按右邊的「移除」）"}
            style={{ width: 340, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "#111827", color: "#f9fafb", outline: "none" }} />
          {/* 參考圖（選填）：想在這塊放「長得像這張」的東西 */}
          <button onClick={() => setGenFillPicking((v) => !v)} disabled={genFillBusy} title={genFillRef ? "換一張參考圖" : "放一張參考圖：在框裡放長得像它的東西"}
            style={{ ...S.rbtn, background: "transparent", color: "#f9fafb", border: "1px solid #4b5563", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, padding: genFillRef ? "0 8px 0 4px" : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {genFillRef ? <img src={genFillRef} alt="參考圖" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4 }} /> : <ImageIcon size={14} />}
            {genFillRef ? "參考圖" : "＋參考圖"}
          </button>
          {genFillRef && <button onClick={() => setGenFillRef(null)} disabled={genFillBusy} aria-label="拿掉參考圖" style={{ border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>}
          {genFillPicking && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 8px)", background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 10px 30px rgba(0,0,0,.22)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>選一張參考圖：框裡會放進長得像它的東西</div>
              <ImageLibraryPicker library={backgrounds ?? []} uploadFile={uploadImageFile} onPick={(url) => { setGenFillRef(url); setGenFillPicking(false); }} />
            </div>
          )}
          <button onClick={() => generateFillInMarquee("fill")} disabled={genFillBusy || (!genFillPrompt.trim() && !genFillRef)}
            title={genFillPrompt.trim() || genFillRef ? "在框選的那塊畫出你要的東西" : "先打字說要畫什麼，或放一張參考圖"}
            style={{ ...S.rbtn, background: "#7c3aed", color: "#fff", border: "none", opacity: (genFillBusy || (!genFillPrompt.trim() && !genFillRef)) ? .5 : 1, whiteSpace: "nowrap" }}>
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
        <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 93, display: "flex", gap: 10, alignItems: "center", background: "#1f2937", padding: "10px 14px", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.28)", color: "#f9fafb" }}>
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

        {/* 畫布上改字的輸入框：看不見，只負責接收鍵盤和中文輸入法（字、游標、反白都是畫布畫的）。
            不受控（defaultValue）＋固定 key：打字、組字時 React 重新 render 也不會重建節點或搶走焦點。
            位置、大小由 render() 的 placeTextArea 跟著文字框移動，輸入法的選字視窗才會出現在字旁邊。 */}
        {editingText && (
          <textarea
            ref={textAreaRef}
            key={editingText.id}
            defaultValue={editingText.original}
            aria-label="編輯文字" spellCheck={false} autoComplete="off"
            onChange={(e) => {
              const el = layersRef.current.find((x) => x.id === editingText.id);
              if (!el) return;
              applyTypedText(el, e.target.value, doc.w);
              caretOnRef.current = true; render(); refresh();
            }}
            onCompositionStart={(e) => { compStartRef.current = e.currentTarget.selectionStart; render(); }}
            onCompositionUpdate={() => { caretOnRef.current = true; render(); }}
            onCompositionEnd={() => { compStartRef.current = null; render(); }}
            onKeyDown={(e) => {
              e.stopPropagation();   // 不要讓 Delete、方向鍵、⌘Z 之類的畫布快捷鍵生效
              if (e.nativeEvent.isComposing || compStartRef.current != null) return;   // 中文還在選字：什麼都不攔
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); exitTextEdit(); return; }
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                // 上下鍵要照畫布上的行走（textarea 自己的換行跟畫布不一樣）
                const ta = e.currentTarget, el = layersRef.current.find((x) => x.id === editingText.id);
                if (!el) return;
                e.preventDefault();
                const back = ta.selectionDirection === "backward";
                const focus = back ? ta.selectionStart : ta.selectionEnd, anchor = back ? ta.selectionEnd : ta.selectionStart;
                const next = verticalMove(textCaretLines(el), focus, e.key === "ArrowUp" ? -1 : 1);
                selectTextRange(ta, e.shiftKey ? anchor : next, next);
                caretOnRef.current = true; readSel(ta); render();
              }
            }}
            // onSelect 在某些情況不會觸發（程式設定選取、部分輸入法），所以 keyup／mouseup 也各讀一次
            onSelect={(e) => { caretOnRef.current = true; readSel(e.target as HTMLTextAreaElement); render(); }}
            onKeyUp={(e) => { readSel(e.target as HTMLTextAreaElement); render(); }}
            // 點上方「選取的字」工具列會先 blur：那些按鈕帶 data-run-tool，不要因此結束改字
            onBlur={(e) => { if (!(e.relatedTarget as HTMLElement | null)?.dataset?.runTool) exitTextEdit(); }}
            style={{
              position: "absolute", left: 0, top: 0, opacity: 0, pointerEvents: "none",
              padding: 0, margin: 0, border: "none", outline: "none", resize: "none",
              background: "transparent", color: "transparent", caretColor: "transparent",
              whiteSpace: "pre", zIndex: 1,
            }} />
        )}
        </div>
        {/* 漸進揭露：這頁有動畫才出現薄薄一條播放列，按「動畫時間軸 ↑」才展開完整時間軸 */}
        {/* 漸進揭露：這頁有動畫、有設存在時間、或使用者打開了，才出現時間軸 */}
        {dockShown && (
          <AnimDock mode={dockMode} onMode={setDockMode} getDuration={currentDuration}
            playing={playing} getTime={getAnimTime} onPlay={playAnim} onPause={pauseAnim} onSeek={seekAnim}
            getRows={lifeRows} selectedId={selectedId} selectedIds={selectedIds} onSelect={(id) => { selectOnly(id); render(); }}
            onLifespan={(id, start, end) => { setLifespan(layersRef.current, id, start, end, currentDuration()); render(); refresh(); }}
            onAnim={(layerId, animId, patch) => {
              const l = layersRef.current.find((x) => x.id === layerId); if (!l) return;
              patchAnimShared(layersRef.current, l, animId, patch);
              if (patch.start !== undefined) seekAnim(patch.start);
              render(); refresh();
            }}
            onFocusAnim={(layerId, animId) => { selectOnly(layerId); setFocusAnimId(animId); setPanelTab("anim"); render(); }}
            focusAnimId={focusAnimId}
            onCommit={() => markDirty()} />
        )}
        <PageStrip pages={pagesView} current={pageIdx} currentThumb={curThumb} getSeconds={pageSeconds}
          onSelect={goToPage} onAdd={() => addPage(false)} onDuplicate={() => addPage(true)} onDelete={deletePage} onMove={movePage} onRename={renamePage}
          onTransition={setPageTransition} />
        {carouselAsk && (
            <CarouselSetup
              texts={carouselAsk.texts}
              images={carouselAsk.images}
              library={backgrounds ?? []}
              uploadFile={uploadImageFile}
              onCancel={() => setCarouselAsk(null)}
              onConfirm={(cards) => { const ids = carouselAsk.ids; setCarouselAsk(null); void buildCarousel(ids, cards); }} />
        )}
        {seqPreview && <SequencePreview width={seqPreview.width} height={seqPreview.height} total={seqPreview.total} drawFrame={seqPreview.draw} onClose={() => { setSeqPreview(null); render(); }} />}
        </div>

        {/* 右側面板常駐。原本是選到圖層才掛載，一選取畫布就從 501px 被擠到 237px，
            縮放比例沒變、可視範圍卻少一半，操作起來就像「一點物件就放大」。
            Figma／PS 的面板都是固定的，畫布寬度不會因為選取而變動。 */}
        <aside ref={rpanelRef} style={S.rpanel}>
          {/* 設定在上、圖層在下——跟 Photoshop 一樣，左欄就不會擠成一條。 */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
          {!selEl && panelTab === "anim" ? (
            <>
              <div style={S.rtabs}>
                <button style={S.rtab} onClick={() => setPanelTab("design")}>設計</button>
                <button style={{ ...S.rtab, ...S.rtabOn }}>動畫</button>
              </div>
              <div style={{ padding: "2px 16px 16px" }}>
                <CurrentLayerPicker layers={panel} selected={null} extra={0} onPick={(id) => { selectLayerOrGroup(id); render(); }} />
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginTop: 10 }}>在畫布或下方時間軸點一個物件，或從上面選，就能幫它加動畫、調時間。</div>
              </div>
            </>
          ) : !selEl ? (
            /* 沒選東西：顯示這一頁的設定（尺寸、比例、背景色），不是一句「請選圖層」 */
            <div style={{ padding: "16px 16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>這一頁</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{doc.w} × {doc.h} px・{panel.length} 個圖層</div>
              <label style={S.rlabel}>比例</label>
              <select aria-label="這一頁的比例" value={canvasRatio} onChange={(e) => resizeCanvasToRatio(e.target.value)} style={S.rinput}>
                {canvasRatio === "custom" && <option value="custom" disabled>自訂（{doc.w}×{doc.h}）</option>}
                {CANVAS_RATIOS.map(([k]) => <option key={k} value={k}>{k}</option>)}
              </select>
              <label style={S.rlabel}>背景顏色</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {["#ffffff", "#f8f9fc", "#f5f3ff", "#fff1f2", "#ecfdf5", "#111827"].map((c) => (
                  <button key={c} onClick={() => setPageBackground(c)} aria-label={`背景改成 ${c}`} title={c}
                    style={{ width: 28, height: 28, borderRadius: 8, background: c, cursor: "pointer", border: pageBackground === c ? "2px solid #7c3aed" : "1px solid #e5e7eb" }} />
                ))}
                <input type="color" aria-label="自訂背景顏色" value={toHex(pageBackground ?? "#ffffff")} onChange={(e) => setPageBackground(e.target.value)}
                  style={{ width: 34, height: 30, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
              </div>
              {pageBackground === null && panel.some((l) => l.type === "background") && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, lineHeight: 1.6 }}>這頁的背景是圖片；選了顏色會墊在最底下，被圖片蓋住的地方看不到。</div>
              )}
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginTop: 18, paddingTop: 14, borderTop: "1px solid #eef0f3" }}>
                點畫布上的東西就能編輯它；雙擊文字可以直接改字。<br />按住空白鍵（或 H）可以拖曳移動畫面。
              </div>
            </div>
          ) : (
          <>
            <div style={S.rtabs}>
              <button style={{ ...S.rtab, ...(panelTab === "design" ? S.rtabOn : {}) }} onClick={() => setPanelTab("design")}>設計</button>
              <button style={{ ...S.rtab, ...(panelTab === "anim" ? S.rtabOn : {}) }} onClick={() => setPanelTab("anim")}>
                動畫{selEl.anims?.length ? <span style={S.rtabCount}>{selEl.anims.length}</span> : null}
              </button>
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
                    <PropSection id="text" title="文字" defaultOpen first>
                    <label style={{ ...S.rlabel, marginTop: 0 }}>文字內容</label>
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
                    <div style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>也可以直接在畫布上雙擊文字來改</div>
                    {!selEl.textLayout && !(selEl.fx?.warp && selEl.fx.warp !== "none") && (
                      <div style={{ display: "flex", gap: 6, margin: "8px 0 2px" }} title="自動寬度：框跟著字變寬；固定寬度：字在框裡自動換行（拖文字框左右兩邊也會變成固定寬度）">
                        {([[false, "自動寬度"], [true, "固定寬度・自動換行"]] as const).map(([w, label]) => (
                          <button key={label} onClick={() => updateText({ wrap: w })}
                            style={{ ...S.rbtn, flex: 1, height: 30, fontSize: 12, ...(!!selEl.wrap === w ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{label}</button>
                        ))}
                      </div>
                    )}
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
                          {/* 範本常用 300 細體、900 特粗：選單沒有的字重會被誤顯示成第一個選項 */}
                          {FONT_WEIGHTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                          {!FONT_WEIGHTS.some(([v]) => v === selEl.fontWeight) && <option value={selEl.fontWeight}>{selEl.fontWeight}</option>}
                        </select></div>
                    </div>
                    <label style={S.rlabel}>顏色</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="color" value={toHex(selEl.color)} onChange={(e) => updateText({ color: e.target.value })} style={{ width: 40, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: 0, cursor: "pointer" }} />
                      <input value={selEl.color} onChange={(e) => updateText({ color: e.target.value })} style={{ ...S.rinput, flex: 1 }} />
                    </div>
                    </PropSection>
                    {/* 字距／行高：drawTextEl 早就會讀 textLayout 來排版，但一直沒有 UI，
                        使用者調不到。沒有 textLayout 的舊圖層在這裡第一次調整時建立預設值。 */}
                    <PropSection id="spacing" title="字距與行高" summary={`字距 ${selEl.textLayout?.letterSpacing ?? 0}・行高 ${selEl.textLayout?.lineHeight ?? DEFAULT_TEXT_LAYOUT.lineHeight}`}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}><label style={{ ...S.rlabel, marginTop: 0 }}>字距</label>
                        <input type="number" step={0.5} value={selEl.textLayout?.letterSpacing ?? 0}
                          onChange={(e) => {
                            const v = Math.max(-20, Math.min(20, Number(e.target.value) || 0));
                            updateText({ textLayout: { ...(selEl.textLayout ?? DEFAULT_TEXT_LAYOUT), letterSpacing: v } });
                          }} style={S.rinput} /></div>
                      <div style={{ flex: 1 }}><label style={{ ...S.rlabel, marginTop: 0 }}>行高</label>
                        <input type="number" step={0.05} value={selEl.textLayout?.lineHeight ?? DEFAULT_TEXT_LAYOUT.lineHeight}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(2, Number(e.target.value) || DEFAULT_TEXT_LAYOUT.lineHeight));
                            updateText({ textLayout: { ...(selEl.textLayout ?? DEFAULT_TEXT_LAYOUT), lineHeight: v } });
                          }} style={S.rinput} /></div>
                    </div>
                    </PropSection>
                    <PropSection id="textfx" title="文字效果" summary={textFxSummary(selEl.fx)}>
                    <label style={{ ...S.rlabel, marginTop: 0 }}>樣式</label>
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
                    {/* 舊的「效果字距」：跟上面「字距與行高」的字距重複，只在舊設計已經有值時才顯示（才調得回 0） */}
                    {selEl.fx?.letterSpacing ? (<>
                      <label style={S.rlabel}>額外字距（舊設定） <span style={{ float: "right", color: "#9ca3af" }}>{selEl.fx.letterSpacing}px</span></label>
                      <input type="range" min={-12} max={48} step={1} value={selEl.fx.letterSpacing} onChange={(e) => updateFx({ letterSpacing: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                    </>) : null}
                    <label style={S.rlabel}>文字路徑</label>
                    <select value={selEl.fx?.warp ?? "none"} onChange={(e) => updateFx({ warp: e.target.value as TextFx["warp"] })} style={S.rinput}>
                      <option value="none">一般直線</option><option value="arc-up">向上弧形</option><option value="arc-down">向下弧形</option><option value="wave">波浪文字</option>
                    </select>
                    {(selEl.fx?.warp ?? "none") !== "none" && (<>
                      <label style={S.rlabel}>彎曲幅度 <span style={{ float: "right", color: "#9ca3af" }}>{selEl.fx?.warpAmount ?? 35}%</span></label>
                      <input type="range" min={5} max={100} value={selEl.fx?.warpAmount ?? 35} onChange={(e) => updateFx({ warpAmount: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} />
                      {selEl.fx?.warp === "wave" && <><label style={S.rlabel}>波浪數</label><input type="range" min={1} max={5} step={1} value={selEl.fx?.waveCount ?? 2} onChange={(e) => updateFx({ waveCount: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></>}
                    </>)}
                    </PropSection>
                    {/* AI 文字藝術字入口 */}
                    <PropSection id="textart" title="AI 文字藝術字" summary="參考圖片生成特殊字">
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>想做更特殊的文字效果？</div>
                    <button onClick={() => setArtView("setup")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", textAlign: "left" }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>✨</span>
                      <span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>AI 文字藝術字</span>
                        <span style={{ display: "block", fontSize: 11, opacity: 0.85, marginTop: 2 }}>參考圖片生成特殊文字設計</span>
                      </span>
                    </button>
                    </PropSection>
                  </>
                ))}
                {selEl.textLayout && selEl.fx?.warp && selEl.fx.warp !== "none" && <p style={{padding:12,fontSize:12}}>變形文字以單行顯示；取消變形即可恢復多行排版。</p>}
                {selEl.shape && (
                  <>
                    <PropSection id="shape" title={selEl.shape.kind === "icon" ? "圖標" : selEl.shape.kind === "line" ? "線條" : "形狀"} defaultOpen first>
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
                    </PropSection>
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
                {selEl.canvas && !selEl.isText && !selEl.shape && !selEl.isArt && selectedIds.length === 1 && (
                  <PropSection id="swap" title="換圖" defaultOpen first>
                  <div style={{ marginBottom: 14 }}>
                    <button onClick={() => setSwapFor((v) => (v === selEl.id ? null : selEl.id))}
                      style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #c4b5fd", background: swapFor === selEl.id ? "#f5f3ff" : "#fff", color: "#6d28d9", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <ImageIcon size={15} />換一張圖（素材庫／上傳）
                    </button>
                    {swapFor === selEl.id && (
                      <div style={{ marginTop: 8 }}>
                        <ImageLibraryPicker library={backgrounds ?? []} uploadFile={uploadImageFile}
                          onPick={(url) => { setSwapFor(null); void swapLayerImage(selEl.id, url); }} />
                        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, marginTop: 4 }}>新圖會等比例放進原本的框，位置、效果、動畫都不變。</div>
                      </div>
                    )}
                  </div>
                  <ReplaceImagePanel key={selEl.id} layerId={selEl.id} aspect={selEl.w / (selEl.h || 1)}
                    isCutout={() => { const l = layersRef.current.find((x) => x.id === selectedIdsRef.current[0]); return !!l?.canvas && l.type !== "background" && hasTransparency(l.canvas); }}
                    getSource={(cutout) => { const l = layersRef.current.find((x) => x.id === selectedIdsRef.current[0]); return l?.canvas ? sourceDataUrl(l.canvas, cutout) : null; }}
                    onPreview={(v, cutout) => previewLayerImage(selEl.id, v, cutout)}
                    onConfirm={confirmLayerImage} onCancel={cancelLayerImage}
                    library={backgrounds ?? []} uploadFile={uploadImageFile} />
                  </PropSection>
                )}
                {selEl.canvas && !selEl.isText && !selEl.shape && selEl.type !== "background" && (
                  <PropSection id="clip" title="放進形狀（剪裁遮色片）" summary={selEl.clipTo ? "已放進形狀" : undefined}>
                  <ClipPanel
                    frameName={selEl.clipTo ? (panel.find((l) => l.id === selEl.clipTo)?.name ?? null) : null}
                    frames={panel.filter((l) => l.id !== selEl.id && isFillableShape(l.shape)).map((l) => ({ id: l.id, name: l.name, shape: l.shape! }))}
                    onPut={(frameId) => putIntoFrame(selectedIdsRef.current[0], frameId)}
                    onFit={() => { const id = selectedIdsRef.current[0], f = layersRef.current.find((l) => l.id === id)?.clipTo; if (f) fitIntoFrame(id, f); }}
                    onTakeOut={() => takeOutOfFrame(selectedIdsRef.current[0])} />
                  </PropSection>
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
                <PropSection id="opacity" title="透明度" defaultOpen summary={`${Math.round(selEl.opacity * 100)}%`}>
                <input type="range" min={0} max={100} value={Math.round(selEl.opacity * 100)} onChange={(e) => updateText({ opacity: Number(e.target.value) / 100 })} aria-label="透明度" style={{ width: "100%", accentColor: "#7c3aed" }} />
                </PropSection>
                {selEl.type !== "background" && (
                  <PropSection id="layerfx" title="陰影・光暈・傾斜" summary={layerFxSummary(selEl)}>
                  <ShadowControls shadow={selEl.shadow ?? null} onChange={(shadow) => updateText({ shadow })} />
                  <GlowControls glow={selEl.glow ?? null} onChange={(glow) => updateText({ glow })} />
                  <SkewControls skewX={selEl.skewX ?? 0} skewY={selEl.skewY ?? 0} onChange={(patch) => updateText(patch)} />
                  </PropSection>
                )}
              </div>
            ) : (
              <div style={{ padding: "2px 16px 16px", overflowY: "auto" }}>
                <CurrentLayerPicker layers={panel} selected={selEl} extra={selectedIds.length - 1} onPick={(id) => { selectLayerOrGroup(id); render(); }} />
                {/* 物件存在時間：細節在下方時間軸拖，這裡只顯示、給一個入口 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 0", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #ebeff5", background: "#fff" }}>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>出現時間</span>
                  <span style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                    {selEl.startTime === undefined && selEl.endTime === undefined ? "整頁都在" : `${selEl.startTime ?? 0}s – ${selEl.endTime === undefined ? "頁尾" : `${selEl.endTime}s`}`}
                  </span>
                  <button onClick={() => setDockMode("selected")} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#6d28d9", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>在時間軸調整 ↓</button>
                </div>
                <AnimCopyBar canCopy={copyableAnims(selEl.anims).length > 0} hasClip={!!animClip} clipLabel={animClip?.label ?? null} count={selectedIds.length}
                  stagger={staggerPaste} onStagger={setStaggerPaste}
                  onCopy={copyAnims} onPaste={() => { if (animClip) applyAnimsToSelection(animClip.anims); }} onSavePreset={saveAnimPreset} />
                <LayerAnimSettings anims={selEl.anims} shineOnly={selEl.shineOnly} focusId={focusAnimId}
                  carouselCard={carouselCardOf(panel, selEl)} library={backgrounds ?? []} uploadFile={uploadImageFile}
                  onCardText={(id, value) => {
                    const l = layersRef.current.find((x) => x.id === id); if (!l?.isText) return;
                    l.text = isVerticalText(l.text) ? toVertical(value) : value;
                    fitTextBox(l, doc.w, true); l.thumb = makeThumb(l); markDirty(); render(); refresh();
                  }}
                  onCardImage={(id, url) => void swapLayerImage(id, url)}
                  onChange={(animId, patch) => { patchAnimShared(layersRef.current, selEl, animId, patch); markDirty(); render(); refresh(); }}
                  onRemove={(animId) => { removeAnimShared(layersRef.current, selEl, animId); markDirty(); render(); refresh(); }}
                  onAdd={(kind) => { addAnimsTo([selEl], kind, doc.w / 2, layersRef.current); markDirty(); render(); refresh(); }} />
              </div>
            )}
          </>
          )}
          </div>
            {/* 動畫分頁不放完整圖層列表：選物件靠畫布、時間軸和上面的「目前選取」，圖層管理在「設計」分頁 */}
            {panelTab !== "anim" && (<>
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
                     style={{ ...S.row, ...(selectedIds.includes(l.id) ? S.rowSel : {}), ...(l.id === dragOverLayerId && l.id !== dragLayerId ? { boxShadow: "inset 0 3px 0 #7c3aed" } : {}), opacity: l.visible ? 1 : 0.5 }}>
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
            </>)}
        </aside>
      </div>

      {tplPreview !== null && templates[tplPreview] && (
        <ImagePreview items={templates.map((t) => ({ url: t.previewUrl, name: t.name }))} index={tplPreview} onIndex={setTplPreview} onClose={() => setTplPreview(null)}
          hint="套用會換掉目前畫布，可以按 ⌘Z 復原"
          actions={[{ label: "套用這個範本", title: "會換掉目前畫布的內容，可以用 ⌘Z 復原", onClick: (i) => { setTplPreview(null); void applyTemplate(templates[i].id); } }]} />
      )}
      {matPreview !== null && backgrounds?.[matPreview] && (
        <ImagePreview items={backgrounds.map((b) => ({ url: b.url, name: b.label ?? "" }))} index={matPreview} onIndex={setMatPreview} onClose={() => setMatPreview(null)}
          actions={[
            { label: "加入畫布", title: "加成一張可以移動縮放的圖", onClick: (i) => { setMatPreview(null); void pushImageLayer(backgrounds[i].url, backgrounds[i].label || "圖片"); } },
          ]} />
      )}
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
/* ---------- 下載 PSD：每個圖層一個 PS 圖層（寫檔的部分見 psd-export.ts 的說明） ---------- */
/** 只畫一個圖層到整張透明畫布上，再裁掉透明邊（PSD 的圖層只存有東西的那塊）。 */
function renderLayerAlone(l: EL, all: EL[], doc: { w: number; h: number }, part: "body" | "content") {
  const c = document.createElement("canvas"); c.width = doc.w; c.height = doc.h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.save(); applyClip(g, l, all); applyLayerTransform(g, l);
  if (part === "body") drawElBody(g, l); else drawElContent(g, l);
  g.restore();
  const d = g.getImageData(0, 0, doc.w, doc.h).data;
  let x0 = doc.w, y0 = doc.h, x1 = -1, y1 = -1;
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      if (d[(y * doc.w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  const out = document.createElement("canvas"); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, left: x0, top: y0 };
}

/** 文字圖層 → PS 的段落文字：框的寬度、字級、顏色、行距、對齊、分段樣式照畫布；旋轉放在 transform。 */
function psdTextData(l: EL) {
  const scale = l.w / (l.naturalW || l.w);
  const fs = l.fontSize * scale;
  const lineH = fs * (l.textLayout?.lineHeight ?? 1.25);
  const m = document.createElement("canvas").getContext("2d")!;
  m.font = `${l.fontWeight} ${fs}px ${l.fontFamily}`;
  const lines = l.textLayout ? Math.max(1, layoutText(l.text, l.w, (t) => m.measureText(t).width).length) : Math.max(1, textRanges(l).length);
  const blockH = lines * lineH;
  const cos = Math.cos(l.rotation), sin = Math.sin(l.rotation);
  const style = (st: { fontSize: number; color: { r: number; g: number; b: number }; fontWeight: number }) => ({
    font: { name: psdFontName(l.fontFamily, st.fontWeight) }, fontSize: st.fontSize, fillColor: st.color,
    autoLeading: false, leading: lineH, tracking: l.textLayout ? Math.round((l.textLayout.letterSpacing / (l.fontSize || 1)) * 1000) : 0,
  });
  const base = { fontSize: fs, color: hexToRgb(l.color), fontWeight: l.fontWeight };
  const runs = styleRunsFor(l.text, base, l.runs?.map((r) => ({ ...r, fontSize: r.fontSize != null ? r.fontSize * scale : undefined })));
  return {
    text: l.text,
    transform: [cos, sin, -sin, cos, l.cx, l.cy],
    shapeType: "box" as const,
    // 高度多留一行：PS 的框放不下最後一行會直接藏起來
    boxBounds: [-l.w / 2, -blockH / 2, l.w / 2, blockH / 2 + lineH],
    style: style(base),
    styleRuns: runs.map((r) => ({ length: r.length, style: style(r.style) })),
    paragraphStyle: { justification: l.align },
  };
}

/** 整張設計稿 → PSD 的內容（交給 ag-psd 的 writePsd）。 */
function buildPsdDocument(layers: EL[], doc: { w: number; h: number }) {
  const children: Record<string, unknown>[] = [];
  const looks: Record<string, unknown>[] = [];
  for (const l of layers) {
    const name = (l.isText ? l.text.replace(/\s+/g, " ").slice(0, 24) : l.name) || l.name || "圖層";
    const editable = l.isText && !l.canvas && isEditableInPsd(l.fx);
    const body = renderLayerAlone(l, layers, doc, "body");
    if (editable) {
      const content = renderLayerAlone(l, layers, doc, "content") ?? body;
      if (!content) continue;
      const fs = l.fontSize * (l.w / (l.naturalW || l.w));
      children.push({
        name, hidden: !l.visible, opacity: l.opacity, ...content, text: psdTextData(l),
        effects: psdTextEffects({ shadow: l.shadow, glow: l.glow, fx: l.fx, fontSize: fs }),
      });
      if (body) looks.push({ name: `${name}（畫布上的樣子）`, opacity: l.opacity, ...body });
    } else if (body) {
      children.push({ name, hidden: !l.visible, opacity: l.opacity, ...body });
    }
  }
  if (looks.length) children.push({ name: "文字原始外觀（圖片）", hidden: true, opened: false, children: looks });
  // 合成圖：看圖軟體、縮圖用
  const comp = document.createElement("canvas"); comp.width = doc.w; comp.height = doc.h;
  const g = comp.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, doc.w, doc.h);
  for (const l of layers) {
    if (!l.visible) continue;
    g.save(); applyClip(g, l, layers); applyLayerTransform(g, l); g.globalAlpha = l.opacity; drawElBody(g, l); g.restore();
  }
  return { width: doc.w, height: doc.h, canvas: comp, children };
}

/* ---------- 圖層動畫：畫出第 t 秒的樣子（預覽與輸出 MP4 共用） ---------- */
/** 畫一個圖層；t＝null 就是平常的樣子，有數字就套上那一秒的動畫（位移、縮放、透明度、光帶）。 */
function drawLayerAnimated(ctx: CanvasRenderingContext2D, l: EL, layers: EL[], t: number | null) {
  // 物件存在時間外：播放／輸出時不畫（不改 visible、不刪物件；編輯中 t＝null 一律畫）
  if (!aliveAt(l, t)) return;
  const f: AnimFrame = t === null ? REST : animFrame(l.anims, t);
  ctx.save();
  // 輪播：整張卡（好幾個圖層）一起在畫布座標裡平移、以卡片中心放大，所以要在圖層自己的變形之前做
  const cw = t === null ? null : carouselWorld(l, layers, t);
  if (cw) {
    ctx.translate(cw.tx, 0);
    if (cw.scale !== 1) { ctx.translate(cw.px, cw.py); ctx.scale(cw.scale, cw.scale); ctx.translate(-cw.px, -cw.py); }
    if (cw.blur > 0.02) { const m = ctx.getTransform(); ctx.filter = `blur(${(cw.blur * 5 * Math.hypot(m.a, m.b)).toFixed(1)}px)`; }
  }
  applyClip(ctx, l, layers);
  applyLayerTransform(ctx, l);
  if (f.dx || f.dy) ctx.translate(f.dx * l.h, f.dy * l.h);
  if (f.rot) ctx.rotate(f.rot);
  if (f.scale !== 1) ctx.scale(f.scale, f.scale);
  // 模糊化：跟輪播的滑動模糊疊在一起（以畫面上的像素算，縮放畫布也一樣模糊）
  if (f.blur > 0.0005) {
    const m = ctx.getTransform(), px = f.blur * l.h * Math.hypot(m.a, m.b);
    ctx.filter = `${ctx.filter && ctx.filter !== "none" ? ctx.filter + " " : ""}blur(${px.toFixed(1)}px)`;
  }
  ctx.globalAlpha = l.opacity * f.opacity;
  if (f.typing) drawTypingText(ctx, l, f.typing);
  else drawElBody(ctx, l);
  // 逐字還在進場時先不閃（光會亮在還沒出現的字上）
  if (f.shines.length && !f.typing) drawShines(ctx, l, f.shines);
  ctx.restore();
}
/**
 * 逐字出現：先把整個圖層照常畫到一張畫布（描邊、陰影、光暈都在），
 * 再把每個字那一格依它自己的進度（透明、縮放、從上面滑下來）貼回來。
 * 字的位置跟畫布上打字的游標用同一套（textCaretLines）。
 * 變形文字（弧形、波浪）或不是文字的圖層沒辦法切字，就整個一起淡入。
 */
function drawTypingText(ctx: CanvasRenderingContext2D, l: EL, s: TypingState) {
  const warped = l.fx?.warp && l.fx.warp !== "none";
  if (!l.isText || warped || !l.text.trim()) {
    ctx.globalAlpha *= s.p;
    drawElBody(ctx, l);
    return;
  }
  const fs = l.fontSize * (l.w / (l.naturalW || l.w));
  const lh = fs * (l.textLayout?.lineHeight ?? 1.25);
  // 每個看得見的字一格（空白不算，也不佔出場順序）
  const cells: { x0: number; x1: number; y: number }[] = [];
  for (const line of textCaretLines(l)) {
    for (let k = line.start; k < line.end; k++) {
      const code = l.text.charCodeAt(k);
      const wide = code >= 0xd800 && code <= 0xdbff ? 2 : 1;   // emoji 這種兩個碼的字
      if (!/\s/.test(l.text[k])) cells.push({ x0: line.x[k - line.start], x1: line.x[Math.min(line.x.length - 1, k - line.start + wide)], y: line.y });
      k += wide - 1;
    }
  }
  if (!cells.length) return;
  // 描邊、陰影、光暈會超出字的格子：整張畫布四周多留一點，最外圈的格子也往外放寬
  const pad = fs * 0.4;
  const m = ctx.getTransform();
  const sc = Math.min(4, Math.max(0.25, Math.hypot(m.a, m.b) || 1));
  const W = l.w + pad * 2, H = l.h + pad * 2;
  const off = document.createElement("canvas"); off.width = Math.max(1, Math.ceil(W * sc)); off.height = Math.max(1, Math.ceil(H * sc));
  const g = off.getContext("2d")!;
  g.scale(sc, sc); g.translate(W / 2, H / 2);
  drawElBody(g, l);
  const xs = cells.map((c) => [c.x0, c.x1]).flat(), ys = cells.map((c) => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const base = ctx.globalAlpha;
  cells.forEach((c, i) => {
    const st = typeChar(s, i, cells.length);
    if (st.opacity <= 0.001 || st.scale <= 0.001) return;
    const x0 = c.x0 <= minX + 0.5 ? -W / 2 : c.x0, x1 = c.x1 >= maxX - 0.5 ? W / 2 : c.x1;
    const y0 = c.y <= minY + 0.5 ? -H / 2 : c.y - lh / 2, y1 = c.y >= maxY - 0.5 ? H / 2 : c.y + lh / 2;
    if (x1 - x0 <= 0 || y1 - y0 <= 0) return;
    const cx = (c.x0 + c.x1) / 2;
    ctx.save();
    ctx.globalAlpha = base * st.opacity;
    ctx.translate(cx, c.y + st.dy * lh);
    if (st.scale !== 1) ctx.scale(st.scale, st.scale);
    ctx.drawImage(off, (x0 + W / 2) * sc, (y0 + H / 2) * sc, (x1 - x0) * sc, (y1 - y0) * sc, x0 - cx, y0 - c.y, x1 - x0, y1 - y0);
    ctx.restore();
  });
}
/**
 * 閃光：光帶只亮在這個圖層自己的形狀上（去背的商品就只有商品本身亮、文字就只有字亮）。
 * 做法是在一張跟圖層一樣大的小畫布上先畫光帶，再用圖層的內容當遮罩裁掉，最後疊回去。
 */
function drawShines(ctx: CanvasRenderingContext2D, l: EL, shines: AnimFrame["shines"]) {
  const m = ctx.getTransform();
  const sc = Math.min(4, Math.max(0.25, Math.hypot(m.a, m.b) || 1));
  const ow = Math.max(1, Math.ceil(l.w * sc)), oh = Math.max(1, Math.ceil(l.h * sc));
  const off = document.createElement("canvas"); off.width = ow; off.height = oh;
  const g = off.getContext("2d")!;
  g.scale(sc, sc); g.translate(l.w / 2, l.h / 2);
  g.globalCompositeOperation = "lighter";
  for (const s of shines) {
    const b = shineBand(l.w, l.h, s);
    const gr = g.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.5, `rgba(255,255,255,${s.intensity})`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(-l.w / 2, -l.h / 2, l.w, l.h);
  }
  // 遮罩：光澤範圍用它的形狀；其他圖層用自己畫出來的內容。
  // 先畫在另一張畫布、再一次用 destination-in 疊上——直接在這裡一筆一筆畫的話，
  // 每一筆都會把前一筆的範圍清掉（兩行以上的字就整個不亮了）。
  const mask = document.createElement("canvas"); mask.width = ow; mask.height = oh;
  const mg = mask.getContext("2d")!;
  mg.scale(sc, sc); mg.translate(l.w / 2, l.h / 2);
  if (l.shineOnly && l.shape && isFillableShape(l.shape)) { clipToShape(mg, l.w, l.h, l.shape); mg.fillStyle = "#fff"; mg.fillRect(-l.w / 2, -l.h / 2, l.w, l.h); }
  else drawElContent(mg, l);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(mask, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(off, -l.w / 2, -l.h / 2, l.w, l.h);
}
/** 光澤範圍在編輯時的樣子：淡淡的虛線框＋一點點底色（輸出時不會出現）。 */
function drawShineZoneHint(ctx: CanvasRenderingContext2D, l: EL, zoom: number) {
  ctx.save(); applyLayerTransform(ctx, l);
  ctx.setLineDash([6 / zoom, 4 / zoom]); ctx.lineWidth = 1.5 / zoom; ctx.strokeStyle = "rgba(245,158,11,.9)";
  ctx.fillStyle = "rgba(245,158,11,.08)";
  ctx.fillRect(-l.w / 2, -l.h / 2, l.w, l.h); ctx.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h);
  ctx.restore();
}
/**
 * 套效果：選好幾個時，閃光／彈跳／閃爍照「物件」自動錯開（疊在一起的圖層、同一群組算同一個物件，一起動），
 * 順序是由上到下、同一排由左到右；每個的循環長度一樣，循環時順序才不會亂掉。
 */
/** 試播／清除用：把動畫換回存起來的、全部拿掉、或整批往前後移。 */
function restoreAnims(layers: EL[], saved: Map<string, LayerAnim[] | undefined>) {
  for (const l of layers) if (saved.has(l.id)) l.anims = saved.get(l.id);
}
function clearAnims(layers: EL[]) { for (const l of layers) l.anims = undefined; }
function shiftAnims(layers: EL[], by: number) {
  for (const l of layers) l.anims = l.anims?.map((a) => ({ ...a, start: Math.max(0, Math.round((a.start + by) * 100) / 100) }));
}
/** 多選的總外框：紫色虛線＋四角方形把手（螢幕座標）。 */
/**
 * PSD 圖層的像素：圖層遮色片、剪裁遮色片先烤進去（畫布沒有這兩種東西，烤進去看起來才會跟 PS 一樣）。
 * baked＝這一頁已經處理好的圖層（剪裁要貼在下面那個圖層的範圍裡）。座標都用 PSD 文件的座標。
 */
function bakePsdImage(l: ImportImage, baked: Map<number, { canvas: HTMLCanvasElement; left: number; top: number }>): HTMLCanvasElement {
  const src = l.source as HTMLCanvasElement;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  if (l.mask) {
    // 遮色片是灰階（白＝看得到、黑＝挖掉），超出遮色片範圍的地方用 defaultColor
    const m = l.mask.source as HTMLCanvasElement;
    const mc = document.createElement("canvas"); mc.width = c.width; mc.height = c.height;
    const mctx = mc.getContext("2d", { willReadFrequently: true })!;
    const d = l.mask.defaultColor;
    mctx.fillStyle = `rgb(${d},${d},${d})`; mctx.fillRect(0, 0, mc.width, mc.height);
    mctx.drawImage(m, l.mask.left - l.docLeft, l.mask.top - l.docTop);
    const px = ctx.getImageData(0, 0, c.width, c.height), mk = mctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < px.data.length; i += 4) px.data[i + 3] = Math.round(px.data[i + 3] * mk[i] / 255);
    ctx.putImageData(px, 0, 0);
  }
  const base = l.clipBase !== undefined ? baked.get(l.clipBase) : undefined;
  if (base) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(base.canvas, base.left - l.docLeft, base.top - l.docTop);
    ctx.globalCompositeOperation = "source-over";
  }
  if (!l.stroke) return c;
  // PS 的「筆畫」（外框）：把剪影塗成外框色，往四周一圈一圈蓋出來，再把原圖疊回中間
  const sz = Math.max(1, Math.round(l.stroke.size));
  const sil = document.createElement("canvas"); sil.width = c.width; sil.height = c.height;
  const sctx = sil.getContext("2d")!;
  sctx.drawImage(c, 0, 0); sctx.globalCompositeOperation = "source-in"; sctx.fillStyle = l.stroke.color; sctx.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement("canvas"); out.width = c.width + sz * 2; out.height = c.height + sz * 2;
  const octx = out.getContext("2d")!;
  octx.globalAlpha = l.stroke.opacity;
  const steps = Math.max(16, Math.round(sz * 6));
  for (let r = 1; r <= sz; r += Math.max(1, Math.floor(sz / 4))) {
    for (let k = 0; k < steps; k++) { const a = (k / steps) * Math.PI * 2; octx.drawImage(sil, sz + Math.cos(a) * r, sz + Math.sin(a) * r); }
  }
  octx.globalAlpha = 1;
  octx.drawImage(c, sz, sz);
  return out;
}
function canvasToPngFile(c: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(new File([b], `${name.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40) || "layer"}.png`, { type: "image/png" })) : reject(new Error("圖層轉成圖片失敗"))), "image/png"));
}
/** 匯入 PSD 完的報告：幾頁幾個圖層，哪些略過、哪些效果被簡化（可以展開看是哪幾層）。 */
function PsdReportCard({ report, onClose }: { report: { pages: number; layers: number; skipped: ImportNote[]; approximated: ImportNote[] }; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const notes = [...report.skipped.map((n) => ({ ...n, kind: "略過" })), ...report.approximated.map((n) => ({ ...n, kind: "簡化" }))];
  return (
    <div style={{ position: "absolute", right: 16, top: 16, zIndex: 55, width: 300, maxHeight: "70%", overflow: "auto", background: "#fff", border: "1px solid #ebeff5", borderRadius: 12, boxShadow: "0 8px 24px rgba(17,24,39,.12)", padding: "12px 14px", fontSize: 12, color: "#374151" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>PSD 匯入完成</span>
        <button onClick={onClose} aria-label="關閉" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ marginTop: 4, color: "#6b7280" }}>{report.pages} 頁、{report.layers} 個圖層{notes.length ? `；${report.skipped.length} 個略過、${report.approximated.length} 個效果被簡化` : "，全部照原樣匯入"}。</div>
      {notes.length > 0 && (
        <>
          <button onClick={() => setOpen((v) => !v)} style={{ marginTop: 8, border: "none", background: "transparent", padding: 0, color: "#6d28d9", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{open ? "收起" : "看是哪幾層"}</button>
          {open && (
            <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {notes.map((n, i) => (
                <li key={i} style={{ lineHeight: 1.5 }}>
                  <span style={{ display: "inline-block", minWidth: 30, fontWeight: 700, color: n.kind === "略過" ? "#b45309" : "#6b7280" }}>{n.kind}</span>
                  <b style={{ color: "#111827" }}>{n.layer}</b>：{n.reason}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
/**
 * 貼上動畫／套公版：取代選取物件原本的動畫（輪播那組保留，不然卡片會停住）。
 * 錯開時照畫面閱讀順序（由上到下、由左到右）一個晚 stagger 秒。回傳有沒有套到東西。
 */
function pasteAnimsTo(layers: EL[], ids: string[], src: LayerAnim[], stagger: number): boolean {
  const picked = layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (!picked.length || !src.length) return false;
  const order = readingOrder(picked.map((l) => ({ cx: l.cx, cy: l.cy, h: l.h }))).map((i) => picked[i]);
  const per = animsForTargets(src, order.length, stagger, () => `anim_${crypto.randomUUID().slice(0, 6)}`);
  order.forEach((l, i) => {
    const keep = (l.anims ?? []).filter((a) => a.kind === "carousel");
    l.anims = [...keep, ...per[i]];
  });
  return true;
}
/** 這一頁的背景色：最底下一層是鋪滿整頁的純色色塊才算（圖片背景回傳 null）。 */
function pageBackgroundOf(layers: EL[], w: number, h: number): string | null {
  const b = layers[0];
  if (!b || b.type !== "background" || b.shape?.kind !== "rect" || b.shape.gradient) return null;
  return b.w >= w * 0.98 && b.h >= h * 0.98 ? b.shape.fill : null;
}
/** 設定背景色：有純色背景就改顏色，沒有就在最底下墊一塊鋪滿的色塊（鎖住）。回傳有沒有改。 */
function applyPageBackground(layers: EL[], color: string, w: number, h: number, font: string): boolean {
  const b = layers[0];
  if (b && pageBackgroundOf(layers, w, h) !== null && b.shape) { b.shape = { ...b.shape, fill: color }; b.thumb = makeThumb(b); return true; }
  const el: EL = {
    id: `bg_${crypto.randomUUID().slice(0, 8)}`, name: "背景色", type: "background", semanticId: "background", instanceId: null, confidence: 1, editable: true, source: "generated",
    isText: false, text: "", color: "#000", fontSize: 24, fontFamily: font, fontWeight: 700, align: "center",
    shape: { kind: "rect", fill: color, stroke: "none", strokeWidth: 0 }, canvas: null, naturalW: w, naturalH: h, src: null,
    cx: w / 2, cy: h / 2, w, h, rotation: 0, visible: true, locked: true, opacity: 1, embeddedText: [], thumb: null,
  };
  el.thumb = makeThumb(el);
  layers.unshift(el);
  return true;
}
/** 空白畫布的起點：套範本、上傳、匯入 PSD、加文字、AI 生成背景。 */
function EmptyCanvasStart(props: { onTemplate: () => void; onUpload: () => void; onPsd: () => void; onText: () => void; onAi: () => void }) {
  const items: { label: string; hint: string; Icon: typeof LayoutTemplate; onClick: () => void; primary?: boolean }[] = [
    { label: "套用範本", hint: "從現成版型開始改", Icon: LayoutTemplate, onClick: props.onTemplate, primary: true },
    { label: "上傳圖片", hint: "照片、商品圖", Icon: Upload, onClick: props.onUpload },
    { label: "匯入 PSD", hint: "工作區域變成多頁", Icon: Layers, onClick: props.onPsd },
    { label: "加文字", hint: "標題、說明文字", Icon: Type, onClick: props.onText },
    { label: "AI 生成背景", hint: "描述畫面就生成", Icon: WandSparkles, onClick: props.onAi },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: "min(460px, 90%)", background: "#fff", border: "1px solid #ebeff5", borderRadius: 16, boxShadow: "0 8px 30px rgba(17,24,39,.08)", padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>從哪裡開始？</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>選一個起點，之後都可以再加別的東西。</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          {items.map(({ label, hint, Icon, onClick, primary }) => (
            <button key={label} onClick={onClick}
              style={{ gridColumn: primary ? "1 / -1" : undefined, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                border: `1.5px solid ${primary ? "#7c3aed" : "#ebeff5"}`, background: primary ? "#f5f3ff" : "#fff" }}>
              <span style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: primary ? "#7c3aed" : "#f5f3ff", color: primary ? "#fff" : "#7c3aed" }}><Icon size={17} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#111827" }}>{label}</span>
                <span style={{ display: "block", fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
/** 播放中的選取提示：淡紫虛線、沒有把手（不能拖，只是標出是哪一個）。 */
function drawGhostFrame(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.save();
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(124,58,237,.7)"; ctx.stroke();
  ctx.restore();
}
function drawGroupFrame(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#7c3aed"; ctx.setLineDash([6, 4]);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    ctx.beginPath(); ctx.rect(x - 5, y - 5, 10, 10); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
/**
 * 設定一個物件的存在時間。從頭開始＝不記開始、拉到頁尾＝不記結束（「一直到頁尾」），
 * 之後頁面拉長，物件也不會提早消失；兩個都沒有＝整頁都在。
 */
function setLifespan(layers: EL[], id: string, start: number, end: number, duration: number) {
  const l = layers.find((x) => x.id === id); if (!l) return;
  l.startTime = start > 0.001 ? start : undefined;
  l.endTime = end < duration - 0.001 ? end : undefined;
}
/** 頁長縮短：這一頁所有物件超出的消失時間夾回頁長。 */
function clampPageLifespans(layers: EL[], duration: number) {
  for (const l of layers) {
    if (l.startTime === undefined && l.endTime === undefined) continue;
    const c = clampLifespan(l, duration);
    l.startTime = c.startTime; l.endTime = c.endTime;
  }
}
/** 選到的、看得到又沒鎖的圖層。 */
function movableOf(layers: EL[], ids: string[]) { return layers.filter((l) => ids.includes(l.id) && l.visible && !l.locked); }
/** 兩個以上圖層的總外框（多選一起縮放用）；不到兩個回傳 null。 */
function unionBox(ls: EL[]) {
  if (ls.length < 2) return null;
  const bs = ls.map(layerBox);
  return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)), layers: ls };
}
/** 圖層在畫布上的外框。 */
function layerBox(l: EL) {
  const c = layerCorners(l);
  return { x0: Math.min(...c.map((p) => p.x)), y0: Math.min(...c.map((p) => p.y)), x1: Math.max(...c.map((p) => p.x)), y1: Math.max(...c.map((p) => p.y)) };
}
/**
 * 一組輪播現在怎麼排：同組的圖層依重疊／群組併成一張張卡，每張卡的中心、間距、焦點、最多幾格。
 * 每一格畫的時候現算，所以使用者之後把卡片挪一挪、加一張也會跟著對。
 */
function carouselGroupLayout(layers: EL[], group: string | undefined, anchorX: number, dir: "left" | "right") {
  const members = layers.filter((x) => x.visible && x.anims?.some((a) => a.kind === "carousel" && a.group === group));
  const units = animUnits(members.map((m) => ({ id: m.id, ...layerBox(m), groupId: m.groupId })));
  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
  for (const m of members) {
    const u = units.get(m.id) ?? 0, b = layerBox(m), o = boxes.get(u);
    boxes.set(u, o ? { x0: Math.min(o.x0, b.x0), y0: Math.min(o.y0, b.y0), x1: Math.max(o.x1, b.x1), y1: Math.max(o.y1, b.y1) } : b);
  }
  const center = (u: number) => { const b = boxes.get(u)!; return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 }; };
  const layout = carouselLayout([...boxes.keys()].map((u) => center(u).cx), anchorX, dir);
  return { units, center, layout };
}
/** 輪播：這個圖層在第 t 秒要跟著它那張卡平移多少、以卡片中心放大多少、滑動模糊多少。 */
function carouselWorld(l: EL, layers: EL[], t: number): { tx: number; px: number; py: number; scale: number; blur: number } | null {
  const a = l.anims?.find((x) => x.kind === "carousel");
  if (!a) return null;
  const dir = a.slideDir ?? "left", anchorX = a.anchorX ?? 0;
  const { units, center, layout } = carouselGroupLayout(layers, a.group, anchorX, dir);
  const s = carouselSteps(a, t, layout.maxSteps);
  const u = units.get(l.id) ?? 0;
  const { cx, cy } = center(u);
  // 由左到右第幾張：跟 carouselLayout 算焦點時用的順序一樣
  const order = [...new Set(units.values())].sort((p, q) => center(p).cx - center(q).cx);
  const i = order.indexOf(u), n = order.length;
  const slot = carouselSlot(i, n, layout.focus, s, layout.spacing, dir, anchorX, 0.3 * Math.max(0, Math.min(1, a.intensity)), a.wrap !== false);
  // 以「排得整整齊齊時」的位置為準算位移，這張卡沒完全對齊也不會跳
  const tx = slot.x - (anchorX + (i - layout.focus) * layout.spacing);
  const frac = s - Math.floor(s);
  return { tx, px: cx, py: cy, scale: slot.scale, blur: a.blur && frac > 0 ? Math.sin(Math.PI * frac) : 0 };
}
/**
 * 選到的圖層如果在輪播裡：它是第幾張卡、這張卡有哪些字和圖（右側動畫分頁直接改）。
 * 用面板的圖層快照算（render 期間不能讀 ref）。
 */
function carouselCardOf(layers: EL[], sel: EL) {
  const a = sel.anims?.find((x) => x.kind === "carousel");
  if (!a) return undefined;
  const { units, center } = carouselGroupLayout(layers, a.group, a.anchorX ?? 0, a.slideDir ?? "left");
  const order = [...new Set(units.values())].sort((p, q) => center(p).cx - center(q).cx);
  const u = units.get(sel.id);
  if (u === undefined) return undefined;
  const members = layers.filter((l) => units.get(l.id) === u && l.anims?.some((x) => x.kind === "carousel" && x.group === a.group));
  return {
    index: order.indexOf(u), total: order.length,
    texts: members.filter((l) => l.isText).map((l) => ({ id: l.id, text: isVerticalText(l.text) ? l.text.replace(/\n/g, "") : l.text, vertical: isVerticalText(l.text) })),
    images: members.filter(isPaintable).map((l) => ({ id: l.id, thumb: l.thumb })),
  };
}
/** 輪播可以滑幾格（影片長度用）：同組每個圖層都記一份。 */
function refreshCarouselSteps(layers: EL[], group: string | undefined) {
  const a = layers.flatMap((l) => l.anims ?? []).find((x) => x.kind === "carousel" && x.group === group);
  if (!a) return;
  const { layout } = carouselGroupLayout(layers, group, a.anchorX ?? 0, a.slideDir ?? "left");
  for (const l of layers) l.anims = l.anims?.map((x) => (x.kind === "carousel" && x.group === group ? { ...x, steps: layout.maxSteps } : x));
}
/** 改動畫設定：輪播是一整組共用一份設定，改一張就全部一起改。 */
function patchAnimShared(layers: EL[], l: EL, animId: string, patch: Partial<LayerAnim>) {
  const a = l.anims?.find((x) => x.id === animId);
  if (a?.kind !== "carousel") { patchAnim(l, animId, patch); return; }
  for (const m of layers) m.anims = m.anims?.map((x) => (x.kind === "carousel" && x.group === a.group ? { ...x, ...patch, id: x.id } : x));
  refreshCarouselSteps(layers, a.group);
}
/** 拿掉動畫：輪播整組一起拿掉（只拿掉一張的話，那張會停在原地、其他卡照樣滑，很怪）。 */
function removeAnimShared(layers: EL[], l: EL, animId: string) {
  const a = l.anims?.find((x) => x.id === animId);
  if (a?.kind !== "carousel") { removeAnim(l, animId); return; }
  for (const m of layers) {
    const keep = (m.anims ?? []).filter((x) => !(x.kind === "carousel" && x.group === a.group));
    m.anims = keep.length ? keep : undefined;
  }
}
function addAnimsTo(layers: EL[], kind: AnimKind, anchorX = 0, all: EL[] = layers) {
  if (kind === "carousel") {
    // 一整組共用一個 group；焦點＝套用時畫布的中線
    const group = `carousel_${crypto.randomUUID().slice(0, 6)}`;
    for (const l of layers) {
      const a = { ...defaultAnim("carousel", `anim_${crypto.randomUUID().slice(0, 6)}`, 0.3), group, anchorX };
      l.anims = [...(l.anims ?? []).filter((x) => x.kind !== "carousel"), a];
    }
    refreshCarouselSteps(all, group);
    return;
  }
  const units = animUnits(layers.map((l) => {
    const c = layerCorners(l);
    return { id: l.id, x0: Math.min(...c.map((p) => p.x)), y0: Math.min(...c.map((p) => p.y)), x1: Math.max(...c.map((p) => p.x)), y1: Math.max(...c.map((p) => p.y)), groupId: l.groupId };
  }));
  const n = new Set(units.values()).size;
  const oneShot = isOneShot(kind);
  const staggered = n > 1 && (kind === "shine" || kind === "bounce" || kind === "twinkle" || kind === "popIn" || kind === "typeIn" || kind === "stomp" || kind === "wiggle");
  const base = defaultAnim(kind, "x");
  // 彈出像參考影片裡的圖示，一個接一個間隔半秒；逐字是一段字跑完再換下一段
  const step = kind === "popIn" || kind === "stomp" ? 0.5 : base.duration + 0.15;
  const starts = staggeredStarts(n, 0.3, step);
  const cycle = n * step + 1;
  for (const l of layers) {
    const a = defaultAnim(kind, `anim_${crypto.randomUUID().slice(0, 6)}`, kind === "fadeIn" ? 0 : staggered ? starts[units.get(l.id) ?? 0] : 0.3);
    if (staggered && !oneShot) a.gap = Math.max(0, cycle - a.duration);
    l.anims = [...(l.anims ?? []).filter((x) => x.kind !== kind), a];
  }
}
/** 時間軸的列：同一個效果＋同一個開始時間的圖層合成一列（一個物件的幾個零件），列名優先用裡面的文字。 */
function animTrackRows(layers: EL[]): AnimTrack[] {
  const rows = new Map<string, { key: string; id: string; names: string[]; label?: string; anim: LayerAnim }>();
  for (const l of layers) {
    for (const a of l.anims ?? []) {
      const key = `${a.kind}@${a.start}`;
      const r = rows.get(key) ?? { key, id: l.id, names: [] as string[], anim: a };
      r.names.push(l.isText && l.text.trim() ? l.text.replace(/\s+/g, "") : "");
      r.label ??= a.label;
      if (l.isText && !rows.has(key)) r.id = l.id;
      rows.set(key, r);
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.anim.start - b.anim.start)
    .map((r) => ({ key: r.key, id: r.id, name: r.label || r.names.find(Boolean)?.slice(0, 14) || layers.find((l) => l.id === r.id)?.name || "圖層", custom: !!r.label, anims: [r.anim] }));
}
/** 拖時間軸：同一個效果、同一個開始時間的其他圖層（同一個物件的零件）一起移。 */
function moveAnimGroup(layers: EL[], layerId: string, animId: string, start: number) {
  const src = layers.find((l) => l.id === layerId)?.anims?.find((a) => a.id === animId);
  if (!src) return;
  const kind = src.kind, old = src.start;
  for (const l of layers) l.anims = l.anims?.map((a) => (a.kind === kind && a.start === old ? { ...a, start } : a));
}
/** 時間軸拖右邊把手：同一列（同一個效果、同一個開始時間）的動畫一起改一輪多長。 */
function resizeAnimGroup(layers: EL[], layerId: string, animId: string, duration: number) {
  const src = layers.find((l) => l.id === layerId)?.anims?.find((a) => a.id === animId);
  if (!src) return;
  const kind = src.kind, start = src.start;
  for (const l of layers) l.anims = l.anims?.map((a) => (a.kind === kind && a.start === start ? { ...a, duration } : a));
}
/** 時間軸「刪除這列」：同一列的動畫都拿掉（輪播整組拿掉）。 */
function removeAnimGroup(layers: EL[], layerId: string, animId: string) {
  const owner = layers.find((l) => l.id === layerId);
  const src = owner?.anims?.find((a) => a.id === animId);
  if (!owner || !src) return;
  if (src.kind === "carousel") { removeAnimShared(layers, owner, animId); return; }
  for (const l of layers) {
    const keep = (l.anims ?? []).filter((a) => !(a.kind === src.kind && a.start === src.start));
    l.anims = keep.length ? keep : undefined;
  }
}
/** 時間軸列改名：同一列（同一個效果、同一個開始時間）的動畫都記上這個名字；空的＝回到自動取名。 */
function renameAnimGroup(layers: EL[], layerId: string, animId: string, name: string) {
  const src = layers.find((l) => l.id === layerId)?.anims?.find((a) => a.id === animId);
  if (!src) return;
  const label = name.trim().slice(0, 30) || undefined;
  for (const l of layers) l.anims = l.anims?.map((a) => (a.kind === src.kind && a.start === src.start ? { ...a, label } : a));
}
function patchAnim(l: EL, animId: string, patch: Partial<LayerAnim>) {
  l.anims = (l.anims ?? []).map((a) => (a.id === animId ? { ...a, ...patch } : a));
}
function removeAnim(l: EL, animId: string) {
  l.anims = (l.anims ?? []).filter((a) => a.id !== animId);
  if (!l.anims.length) l.anims = undefined;
}

function drawElBody(ctx: CanvasRenderingContext2D, l: EL) {
  if (l.shineOnly) return;   // 光澤範圍本身看不見（只有動畫時的光）
  // 陰影、外光暈先畫（在內容底下）；文字自己的「陰影」效果在這兩趟關掉，不然會蓋掉這裡的設定
  const plain = l.fx?.shadow ? { ...l, fx: { ...l.fx, shadow: false } } : l;
  if (l.shadow) drawShadow(ctx, l.shadow, () => drawElContent(ctx, plain));
  if (l.glow) drawGlow(ctx, l.glow, () => drawElContent(ctx, plain));
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
/** 設定 textarea 的選取範圍：focus 在前面就是往回選（Shift＋方向鍵才會從對的那一端繼續延伸）。 */
function selectTextRange(ta: HTMLTextAreaElement, anchor: number, focus: number) {
  ta.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? "backward" : "forward");
}
/** 看不見的 textarea 蓋在文字框上（螢幕座標、跟著旋轉），輸入法的選字視窗才會在字旁邊。 */
function placeTextArea(ta: HTMLTextAreaElement, l: EL, v: { zoom: number; panX: number; panY: number }) {
  const z = v.zoom, fs = l.fontSize * (l.w / (l.naturalW || l.w)) * z;
  const st = ta.style;
  st.left = `${l.cx * z + v.panX - (l.w * z) / 2}px`; st.top = `${l.cy * z + v.panY - (l.h * z) / 2}px`;
  st.width = `${Math.max(4, l.w * z)}px`; st.height = `${Math.max(4, l.h * z)}px`;
  st.transform = `rotate(${l.rotation}rad)`; st.fontSize = `${Math.max(8, fs)}px`; st.lineHeight = "1.25";
  st.fontFamily = l.fontFamily; st.textAlign = l.align;
}
/** 打字：換掉文字、框跟著字調整。分段樣式超出新長度的部分截掉。 */
function applyTypedText(l: EL, text: string, docW: number) {
  if (l.runs?.length) l.runs = shiftRuns(l.runs, l.text, text);
  l.text = text;
  fitTextBox(l, docW);
}
/** 拖文字框左右兩邊：改框寬、字級不變，改成固定寬度自動換行，高度跟著行數長。 */
function resizeTextWidth(l: EL, newW: number, docW: number) {
  const k = l.w / (l.naturalW || l.w);
  l.w = newW; l.naturalW = newW / k;
  if (!l.textLayout) l.wrap = true;
  fitTextBox(l, docW);
}
type TextGeom = Pick<EL, "cx" | "cy" | "w" | "h" | "naturalW" | "wrap">;
function snapTextGeom(l: EL): TextGeom { return { cx: l.cx, cy: l.cy, w: l.w, h: l.h, naturalW: l.naturalW, wrap: l.wrap }; }
function restoreTextGeom(l: EL, g: TextGeom) { Object.assign(l, g); }
function dropLayer(layers: EL[], id: string) {
  const i = layers.findIndex((l) => l.id === id);
  if (i >= 0) layers.splice(i, 1);
}
function refreshThumb(l: EL) { l.thumb = makeThumb(l); }

/* ---------- 文字：量字、斷行、游標（編輯時游標、反白都由畫布自己畫，位置要跟畫字一模一樣） ---------- */
let measureScratch: CanvasRenderingContext2D | null = null;
/** 量某一段字（[start, end)）的寬度：字型、字距、分段樣式都照 drawTextEl／drawRunText。 */
function textMeasurer(l: EL): (start: number, end: number) => number {
  const ctx = measureScratch ?? (measureScratch = document.createElement("canvas").getContext("2d")!);
  const scale = l.w / (l.naturalW || l.w), fx = l.fx;
  const spacing = fx?.letterSpacing != null ? fx.letterSpacing : l.textLayout ? l.textLayout.letterSpacing * scale : 0;
  try { ctx.letterSpacing = `${spacing}px`; } catch { /* older canvas */ }
  const runs = l.textLayout ? [] : (l.runs ?? []);
  const styleAt = (i: number) => { for (let r = runs.length - 1; r >= 0; r -= 1) if (i >= runs[r].start && i < runs[r].end) return runs[r]; return undefined; };
  const fontFor = (st?: TextRun) => `${fx?.italic ? "italic " : ""}${st?.fontWeight ?? l.fontWeight} ${(st?.fontSize ?? l.fontSize) * scale}px ${l.fontFamily}`;
  return (start, end) => {
    if (end <= start) return 0;
    if (!runs.length) { ctx.font = fontFor(); return ctx.measureText(l.text.slice(start, end)).width; }
    let w = 0;
    for (let i = start; i < end;) {
      const st = styleAt(i); let j = i + 1;
      while (j < end && styleAt(j) === st) j += 1;
      ctx.font = fontFor(st); w += ctx.measureText(l.text.slice(i, j)).width; i = j;
    }
    return w;
  };
}
/** 文字圖層分成哪幾行：有 textLayout 或固定寬度（wrap）就照框寬自動換行，不然只在換行字元處斷。 */
function textRanges(l: EL): TextLineRange[] {
  const wrapW = l.textLayout || l.wrap ? l.w : null;
  return wrapRanges(l.text, wrapW, wrapW ? textMeasurer(l) : () => 0);
}
/** 每一行、每個字縫在圖層座標裡的位置（游標、反白、點擊定位用）。 */
function textCaretLines(l: EL): CaretLine[] {
  const fs = l.fontSize * (l.w / (l.naturalW || l.w));
  return caretLines({
    text: l.text, ranges: textRanges(l), w: l.w, h: l.h, align: l.align,
    lineHeight: fs * (l.textLayout?.lineHeight ?? 1.25), vertical: l.textLayout ? "top" : "center", measureRange: textMeasurer(l),
  });
}
/** 改文字框寬度但字級不變（字級跟 w/naturalW 綁在一起，所以兩個一起改）；對齊的那一邊不動。 */
function setTextWidth(l: EL, newW: number) {
  const k = l.w / (l.naturalW || l.w);
  const dx = anchorShift(l.align, l.w, newW);
  l.cx += dx * Math.cos(l.rotation); l.cy += dx * Math.sin(l.rotation);
  l.w = newW; l.naturalW = newW / k;
}
/**
 * 打字後讓框貼著字：自動寬度的框跟著最長的那行變寬／變窄（碰到畫布邊緣就改成固定寬度、自動換行），
 * 高度跟著行數；固定寬度的只會長高，不會把字裁掉。彎曲字不動（它自己會縮進框裡）。
 */
function fitTextBox(l: EL, docW: number, keepCenter = false) {
  if (!l.isText || l.canvas || (l.fx?.warp && l.fx.warp !== "none")) return;
  const fs = l.fontSize * (l.w / (l.naturalW || l.w));
  const lh = fs * (l.textLayout?.lineHeight ?? 1.25), pad = fs * 0.15;
  if (!l.textLayout && !l.wrap) {
    const m = textMeasurer(l);
    // 在畫布外面的字（輪播等著滑進來的卡）：當成在畫布中間來算可用寬度，不然會被擠成一條
    const cx = l.cx < 0 || l.cx > docW ? docW / 2 : l.cx;
    const r = autoWidth({ need: widestLine(wrapRanges(l.text, null, m), m) + pad * 2, cx, w: l.w, docW, align: l.align, rotated: Math.abs(l.rotation) > 1e-3, min: fs * 0.6, margin: docW * 0.03 });
    setTextWidth(l, r.w);
    if (r.fixed) l.wrap = true;
  }
  const needH = Math.max(1, textRanges(l).length) * lh + pad;
  // 高度剛好包住字。打字時上緣不動（多一行往下長、少一行往上收，跟 Canva 一樣，不會蓋到上面的東西）；
  // keepCenter＝以中心收放：剛進入編輯時用，範本的框常常比字高很多，收成剛好時字才不會跳上去。
  const setH = (h: number) => {
    if (!keepCenter) { const dy = (h - l.h) / 2; l.cx -= dy * Math.sin(l.rotation); l.cy += dy * Math.cos(l.rotation); }
    l.h = h;
  };
  if (l.textLayout) { if (needH > l.h) setH(needH); }   // 從上往下排的字：只長不縮（框是版面設計好的）
  else if (Math.abs(needH - l.h) > 0.5) setH(needH);
}
/** 編輯中的文字：細虛線框、選取反白、輸入法組字底線、游標（都在圖層座標裡畫）。 */
function drawTextEditing(ctx: CanvasRenderingContext2D, l: EL, sel: { start: number; end: number }, comp: number | null, caretOn: boolean, zoom: number) {
  const fs = l.fontSize * (l.w / (l.naturalW || l.w));
  const lines = textCaretLines(l);
  ctx.save(); applyLayerTransform(ctx, l);
  ctx.setLineDash([4 / zoom, 3 / zoom]); ctx.lineWidth = 1 / zoom; ctx.strokeStyle = "rgba(124,58,237,.75)";
  ctx.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(124,58,237,.28)";
  for (const sp of selectionSpans(lines, sel.start, sel.end, fs * 0.3)) ctx.fillRect(sp.x0, sp.y - fs * 0.62, sp.x1 - sp.x0, fs * 1.24);
  if (comp != null && sel.end > comp) {
    ctx.fillStyle = "#7c3aed";
    for (const sp of selectionSpans(lines, comp, sel.end, 0)) ctx.fillRect(sp.x0, sp.y + fs * 0.56, sp.x1 - sp.x0, Math.max(2 / zoom, fs * 0.05));
  }
  if (caretOn && sel.start === sel.end) {
    const li = lines.findIndex((ln) => sel.end <= ln.end), ln = lines[li < 0 ? lines.length - 1 : li];
    if (ln) { ctx.fillStyle = "#7c3aed"; ctx.fillRect(ln.x[Math.max(0, Math.min(ln.x.length - 1, sel.end - ln.start))] - 1 / zoom, ln.y - fs * 0.62, 2 / zoom, fs * 1.24); }
  }
  ctx.restore();
}
/** 雙擊選一個詞：中文會切成詞、英文是一個單字。 */
function wordRangeAt(text: string, index: number): { start: number; end: number } {
  for (const seg of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) {
    if (index >= seg.index && index <= seg.index + seg.segment.length && seg.segment.trim()) return { start: seg.index, end: seg.index + seg.segment.length };
  }
  return { start: index, end: index };
}

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
  // 固定寬度（wrap）的文字在框裡自動換行；斷行跟游標共用 textRanges，畫出來的位置才對得上
  const ranges = l.textLayout ? null : textRanges(l);
  const lines = ranges ? ranges.map((r) => l.text.slice(r.start, r.end)) : null;
  const lineHeight = fs * 1.25;
  const firstY = lines ? -((lines.length - 1) * lineHeight) / 2 : 0;

  if (fx?.strokeW && fx.strokeW > 0) {
    ctx.lineWidth = fs * fx.strokeW; ctx.strokeStyle = fx.strokeColor || "#ffffff";
    ctx.lineJoin = "round"; ctx.miterLimit = 2;
    // 有分段樣式的字由 drawRunText 一段一段描邊；這裡再描整行會多出一圈位置不對的殘影
    if (lines && !l.runs?.length) lines.forEach((line, i) => ctx.strokeText(line, tx, firstY + i * lineHeight));
  }
  if (fx?.shadow) { ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = fs * 0.1; ctx.shadowOffsetX = fs * 0.03; ctx.shadowOffsetY = fs * 0.06; }
  ctx.fillStyle = fill;
  if (l.textLayout) {
    drawEditableText(ctx, { text: l.text, width: l.w, height: l.h, fontSize: fs, align: l.align, layout: l.textLayout, stroke: Boolean(fx?.strokeW) });
  } else if (l.runs?.length) {
    drawRunText(ctx, l, ranges ?? [{ start: 0, end: l.text.length }], fs, lineHeight, firstY, fill);
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
  ctx: CanvasRenderingContext2D, l: EL, ranges: TextLineRange[],
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

  ranges.forEach((range, li) => {
    const line = l.text.slice(range.start, range.end), offset = range.start;
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
    ...(l.shadow ? { shadow: { ...l.shadow } } : {}),
    ...(l.anims?.length ? { anims: l.anims.map((a) => ({ ...a })) } : {}),
    ...(l.startTime !== undefined ? { startTime: l.startTime } : {}), ...(l.endTime !== undefined ? { endTime: l.endTime } : {}),
    ...(l.shineOnly ? { shineOnly: true } : {}),
    ...(l.isText
      ? { isText: true, ...(l.wrap ? { wrap: true } : {}), text: l.text, color: l.color, fontSize: l.fontSize * (l.w / (l.naturalW || l.w)), fontFamily: l.fontFamily, fontWeight: l.fontWeight, align: l.align, ...(l.fx ? { fx: l.fx } : {}), ...(l.textLayout ? { textLayout: { ...l.textLayout, letterSpacing: l.textLayout.letterSpacing * (l.w / (l.naturalW || l.w)) } } : {}),
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
  /** 做成影片時這一頁播多久；null＝照動畫自動決定。 */
  videoLen: number | null;
  /** 從上一頁換到這一頁的過場；null＝直接切換。 */
  transitionIn: PageTransition | null;
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
/** 把輸出好的影片存到電腦（檔名用設計名稱或第一段字）。 */
function downloadMp4(blob: Blob, title?: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${(title || "設計稿").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").trim().slice(0, 40) || "設計稿"}.mp4`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
/** 整份影片的一頁。 */
type SeqItem = { els: EL[]; w: number; h: number; duration: number; transitionIn: PageTransition | null };
/** 這一頁播多久：有設定照設定；沒設就照動畫自動決定，沒有動畫的頁停 3 秒。 */
function pageDuration(els: EL[], chosen: number | null): number {
  // 輪播能滑幾格跟卡片現在的位置有關：先照目前的排法重算一次
  for (const g of new Set(els.flatMap((l) => l.anims ?? []).filter((a) => a.kind === "carousel").map((a) => a.group))) refreshCarouselSteps(els, g);
  const anims = els.flatMap((l) => l.anims ?? []);
  if (chosen) return Math.min(30, chosen);
  // 自動長度也要包住每個物件設定的消失時間
  const lifeEnds = els.flatMap((l) => (l.endTime !== undefined ? [l.endTime] : []));
  if (!anims.length && !lifeEnds.length) return 3;
  return Math.min(30, Math.max(anims.length ? videoDuration(anims, null) : 3, ...lifeEnds));
}
/** 把一頁的第 t 秒畫滿 W×H（尺寸跟影片不同就等比縮放置中、旁邊補白）。 */
function drawPageAt(ctx: CanvasRenderingContext2D, item: SeqItem, W: number, H: number, t: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / item.w, H / item.h);
  ctx.translate((W - item.w * s) / 2, (H - item.h * s) / 2); ctx.scale(s, s);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, item.w, item.h); ctx.clip();
  for (const l of item.els) if (l.visible) drawLayerAnimated(ctx, l, item.els, t);
  ctx.restore();
}
/** 把一張畫好的頁照過場的位置（透明、位移、縮放、只露出一塊）貼上去。 */
function drawPosed(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, p: Pose, W: number, H: number) {
  if (p.alpha <= 0.001) return;
  ctx.save(); ctx.globalAlpha = p.alpha;
  if (p.blend) ctx.globalCompositeOperation = p.blend;
  if (p.clip) { ctx.beginPath(); ctx.rect(p.clip.x0 * W, p.clip.y0 * H, (p.clip.x1 - p.clip.x0) * W, (p.clip.y1 - p.clip.y0) * H); ctx.clip(); }
  ctx.translate(W / 2 + p.dx * W, H / 2 + p.dy * H);
  if (p.scale !== 1) ctx.scale(p.scale, p.scale);
  ctx.drawImage(src, -W / 2, -H / 2, W, H);
  ctx.restore();
}
/** 翻頁掀開：掀開的那條邊在舊的一頁上投一道淡淡的影子，看起來像紙翻過來。 */
function drawWipeEdge(ctx: CanvasRenderingContext2D, c: NonNullable<Pose["clip"]>, W: number, H: number) {
  const depth = Math.min(W, H) * 0.05;
  const edge = c.x0 > 0.001 ? { x: c.x0 * W, dx: -1, dy: 0 } : c.x1 < 0.999 ? { x: c.x1 * W, dx: 1, dy: 0 }
    : c.y0 > 0.001 ? { y: c.y0 * H, dx: 0, dy: -1 } : c.y1 < 0.999 ? { y: c.y1 * H, dx: 0, dy: 1 } : null;
  if (!edge) return;
  const x0 = "x" in edge ? edge.x! : 0, y0 = "y" in edge ? edge.y! : 0;
  const g = ctx.createLinearGradient(x0, y0, x0 + edge.dx * depth, y0 + edge.dy * depth);
  g.addColorStop(0, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.fillStyle = g;
  if (edge.dx) ctx.fillRect(edge.dx < 0 ? x0 - depth : x0, 0, depth, H); else ctx.fillRect(0, edge.dy < 0 ? y0 - depth : y0, W, depth);
  ctx.restore();
}
/** 整份影片的畫法：第 t 秒畫出來（預覽和輸出 MP4 共用）。 */
function makeSequenceRenderer(items: SeqItem[], W: number, H: number): { layout: SeqLayout; draw: (ctx: CanvasRenderingContext2D, t: number) => void } {
  const layout = sequenceLayout(items);
  const bufs = [0, 1].map(() => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; });
  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const f = sequenceAt(layout, items, t);
    drawPageAt(bufs[0].getContext("2d")!, items[f.from.page], W, H, f.from.local);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (!f.to || !f.transition) { ctx.drawImage(bufs[0], 0, 0); ctx.restore(); return; }
    drawPageAt(bufs[1].getContext("2d")!, items[f.to.page], W, H, f.to.local);
    const pose = transitionPoses(f.transition, f.mix ?? 0);
    if (pose.base) { ctx.fillStyle = pose.base; ctx.fillRect(0, 0, W, H); }
    if (pose.toOnTop) { drawPosed(ctx, bufs[0], pose.from, W, H); drawPosed(ctx, bufs[1], pose.to, W, H); }
    else { drawPosed(ctx, bufs[1], pose.to, W, H); drawPosed(ctx, bufs[0], pose.from, W, H); }
    if (f.transition.kind === "wipe" && pose.to.clip) drawWipeEdge(ctx, pose.to.clip, W, H);
    if (pose.overlay && pose.overlay.alpha > 0) { ctx.globalAlpha = pose.overlay.alpha; ctx.fillStyle = pose.overlay.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.restore();
  };
  return { layout, draw };
}

/** 過場選單分組：溶解類跟 Premiere 的「溶解」資料夾一樣。 */
const TRANSITION_GROUPS: [string, TransitionKind[]][] = [
  ["基本", ["none", "fade"]],
  ["溶解", ["dipBlack", "dipWhite", "additive", "nonAdditive", "filmDissolve"]],
  ["移動", ["push", "wipe", "zoom"]],
];
/** 兩頁中間的過場按鈕：點開選效果、方向、秒數。 */
function TransitionButton({ value, onChange }: { value: PageTransition | null; onChange: (tr: PageTransition | null) => void }) {
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const on = value && value.kind !== "none";
  const pill = (active: boolean): React.CSSProperties => ({ height: 26, padding: "0 8px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
    border: active ? "1px solid #7c3aed" : "1px solid #e5e7eb", background: active ? "#f5f3ff" : "#fff", color: active ? "#6d28d9" : "#374151" });
  const kind = value?.kind ?? "none";
  return (
    <>
      <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setOpen(open ? null : { x: r.left + r.width / 2, y: r.top }); }}
        title={on ? `過場：${TRANSITION_LABELS[value!.kind]}（點一下修改）` : "加過場效果"} aria-label="頁面過場"
        style={{ flex: "0 0 auto", alignSelf: "center", marginBottom: 18, height: 22, minWidth: 22, padding: on ? "0 6px" : 0, borderRadius: 11, cursor: "pointer",
          border: on ? "1px solid #7c3aed" : "1px dashed #c4b5fd", background: on ? "#f5f3ff" : "#fff", color: "#7c3aed", fontSize: 10, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2, whiteSpace: "nowrap" }}>
        <Clapperboard size={11} />{on ? TRANSITION_LABELS[value!.kind] : null}
      </button>
      {open && (<>
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 900 }} />
        <div style={{ position: "fixed", left: Math.max(8, open.x - 150), top: open.y - 8, transform: "translateY(-100%)", zIndex: 901, width: 300, background: "#fff",
          border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 12px 32px rgba(17,24,39,.18)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>換頁過場</div>
          {TRANSITION_GROUPS.map(([title, kinds]) => (
            <div key={title}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>{title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {kinds.map((k) => (
                  <button key={k} onClick={() => onChange(k === "none" ? null : { ...defaultTransition(k), ...(value && value.kind !== "none" ? { duration: value.duration } : {}) })} style={pill(kind === k)}>{TRANSITION_LABELS[k]}</button>
                ))}
              </div>
            </div>
          ))}
          {value && hasDir(value.kind) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#6b7280", marginRight: 4 }}>方向</span>
              {([["left", "←"], ["right", "→"], ["up", "↑"], ["down", "↓"]] as const).map(([d, t]) => (
                <button key={d} onClick={() => onChange({ ...value, dir: d })} title={value.kind === "push" ? `往${{ left: "左", right: "右", up: "上", down: "下" }[d]}推` : `往${{ left: "左", right: "右", up: "上", down: "下" }[d]}掀開`}
                  aria-label={`過場方向${t}`} style={{ ...pill((value.dir ?? "left") === d), width: 32, padding: 0, fontSize: 13 }}>{t}</button>
              ))}
            </div>
          )}
          {value && value.kind !== "none" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              多久（秒）
              <input type="number" min={0.1} max={2} step={0.1} value={value.duration}
                onChange={(e) => onChange({ ...value, duration: Math.min(2, Math.max(0.1, Number(e.target.value) || 0.5)) })}
                style={{ width: 64, height: 26, border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 6px", fontSize: 12 }} />
            </label>
          )}
          <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>在「動畫」分頁按「預覽整份影片」看效果；下載 MP4 選全部頁面才會有過場。</div>
        </div>
      </>)}
    </>
  );
}

function PageStrip({ pages, current, currentThumb, getSeconds, onSelect, onAdd, onDuplicate, onDelete, onMove, onRename, onTransition }: {
  /** 有動畫的頁顯示「· 3s」。 */
  getSeconds: (i: number) => number | null;
  pages: { id: string; name: string; thumb: string | null; w: number; h: number; transitionIn?: PageTransition | null }[]; current: number; currentThumb: string | null;
  onSelect: (i: number) => void; onAdd: () => void; onDuplicate: () => void; onDelete: (i: number) => void; onMove: (from: number, to: number) => void;
  onRename: (i: number, name: string) => void; onTransition: (i: number, tr: PageTransition | null) => void;
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
        return (<Fragment key={p.id}>
          {/* 兩頁中間：從上一頁換到這一頁的過場 */}
          {i > 0 && <TransitionButton value={p.transitionIn ?? null} onChange={(tr) => onTransition(i, tr)} />}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
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
                {(() => { const sec = getSeconds(i); return sec === null ? null : <span style={{ color: "#9ca3af", fontWeight: 500 }}> · {Math.round(sec * 10) / 10}s</span>; })()}
              </span>
            )}
          </div>
        </Fragment>);
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
  return { ...el, textLayout: el.textLayout ? { ...el.textLayout } : undefined, shape: el.shape ? { ...el.shape } : null, fx: el.fx ? { ...el.fx } : el.fx, embeddedText: el.embeddedText.map((t) => ({ ...t })), paint: el.paint?.slice(), glow: el.glow ? { ...el.glow } : el.glow, shadow: el.shadow ? { ...el.shadow } : el.shadow, anims: el.anims?.map((a) => ({ ...a })) };
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
 * 素材庫的一張縮圖。滑鼠移上去（觸控裝置點一下）出現：
 * 加入畫布（加成一張可以移動縮放的圖）、放大看（預覽大圖）。
 * 原本還有「設為背景」，使用者覺得跟加入畫布重複，只留加入畫布（要當背景就加入後拉滿、放到最底層）。
 * 也可以直接拖到畫布上想放的位置。
 */
function MaterialThumb({ url, label, onPreview, onAddToCanvas }: { url: string; label: string; onPreview: () => void; onAddToCanvas: () => void }) {
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
          <button onClick={(e) => { e.stopPropagation(); setActive(false); onAddToCanvas(); }} style={{ ...btn, background: "#7c3aed", color: "#fff" }}>加入畫布</button>
          <button onClick={(e) => { e.stopPropagation(); setActive(false); onPreview(); }} style={{ ...btn, height: 20, background: "transparent", color: "#fff", fontWeight: 600 }}>🔍 放大看</button>
        </div>
      )}
    </div>
  );
}

/**
 * 圖片放大預覽（範本、素材共用）：大圖＋上一個／下一個（‹ › 或鍵盤左右鍵）＋底下的動作按鈕。
 * Enter 做主要動作（actions 的最後一個）。
 * 鍵盤事件在這裡攔下來，不讓編輯器收到——不然左右鍵會去移動畫布上選取的圖層、Esc 會取消選取。
 */
function ImagePreview({ items, index, onIndex, onClose, actions, hint }: {
  items: { url: string | null; name: string }[];
  index: number; onIndex: (i: number) => void; onClose: () => void;
  /** 底下的按鈕；最後一個是主要動作（紫色、Enter）。 */
  actions: { label: string; title?: string; onClick: (i: number) => void }[];
  hint?: string;
}) {
  const t = items[index], n = items.length;
  const go = (d: number) => onIndex((index + d + n) % n);
  const main = actions[actions.length - 1];
  const arrow = (d: number, label: string) => (
    <button onClick={() => go(d)} aria-label={label} title={label}
      style={{ position: "absolute", top: "50%", [d < 0 ? "left" : "right"]: -56, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: 20, border: "none", background: "rgba(255,255,255,.92)", color: "#374151", fontSize: 22, lineHeight: "40px", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.2)" }}>
      {d < 0 ? "‹" : "›"}
    </button>
  );
  return (
    <div role="dialog" aria-label={`預覽：${t.name}`} tabIndex={-1}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        else if (e.key === "Escape") { e.preventDefault(); onClose(); }
        else if (e.key === "Enter" && main) { e.preventDefault(); main.onClick(index); }
      }}
      style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,.6)" }} onClick={onClose} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative" }}>
          {t.url
            ? <img src={t.url} alt={t.name} style={{ display: "block", width: "min(640px, 72vh, calc(100vw - 160px))", height: "min(640px, 72vh, calc(100vw - 160px))", objectFit: "contain", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,.35)" }} />
            : <div style={{ width: "min(640px, 72vh)", aspectRatio: "1", display: "grid", placeItems: "center", background: "#fff", borderRadius: 14, color: "#9ca3af" }}>無縮圖</div>}
          {n > 1 && arrow(-1, "上一個")}
          {n > 1 && arrow(1, "下一個")}
          <button onClick={onClose} aria-label="關閉預覽" title="關閉（Esc）"
            style={{ position: "absolute", top: -14, right: -14, width: 30, height: 30, borderRadius: 15, border: "none", background: "#fff", color: "#374151", fontSize: 16, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>×</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 12, padding: "10px 12px 10px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
          {t.name && <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>}
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{index + 1} / {n}</span>
          {actions.map((a, i) => (
            <button key={a.label} onClick={() => a.onClick(index)} title={a.title}
              style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                ...(i === actions.length - 1 ? { border: "none", background: "#7c3aed", color: "#fff" } : { border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }) }}>{a.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)" }}>← → 切換　Enter {main?.label}　Esc 關閉{hint ? `　（${hint}）` : ""}</div>
      </div>
    </div>
  );
}

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
 * 陰影（像 PS 的投影）：開關＋顏色／透明度／距離／模糊／方向。
 * 物件、形狀、文字都能用；影子沿著內容輪廓落下，去背產品就是產品形狀的影子。
 */
function ShadowControls({ shadow, onChange }: { shadow: LayerShadow | null; onChange: (shadow: LayerShadow | null) => void }) {
  const row = (label: string, value: number, min: number, max: number, unit: string, set: (v: number) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ width: 44, fontSize: 12, color: "#6b7280", flex: "0 0 auto" }}>{label}</span>
      <input type="range" aria-label={`陰影${label}`} min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "#7c3aed" }} />
      <span style={{ width: 42, textAlign: "right", fontSize: 12, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 14, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginRight: "auto" }}>陰影</span>
        {shadow && <input type="color" aria-label="陰影顏色" title="陰影顏色" value={hexColor(shadow.color)} onChange={(e) => onChange({ ...shadow, color: e.target.value })} style={{ width: 32, height: 26, border: "1px solid #e5e7eb", borderRadius: 6, padding: 0, cursor: "pointer" }} />}
        <button onClick={() => onChange(shadow ? null : { ...DEFAULT_SHADOW })} aria-pressed={!!shadow}
          style={{ ...S.rbtn, height: 28, padding: "0 12px", fontSize: 12, ...(shadow ? { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" } : {}) }}>{shadow ? "關閉" : "加上陰影"}</button>
      </div>
      {shadow && (<>
        {row("透明度", Math.round(shadow.opacity * 100), 5, 100, "%", (v) => onChange({ ...shadow, opacity: v / 100 }))}
        {row("距離", shadow.distance, 0, 120, "px", (v) => onChange({ ...shadow, distance: v }))}
        {row("模糊", shadow.blur, 0, 120, "px", (v) => onChange({ ...shadow, blur: v }))}
        {row("方向", shadow.angle, 0, 359, "°", (v) => onChange({ ...shadow, angle: v }))}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {([["右下", 60], ["正下", 90], ["左下", 120], ["右上", 300]] as const).map(([t, a]) => (
            <button key={t} onClick={() => onChange({ ...shadow, angle: a })}
              style={{ ...S.rbtn, flex: 1, height: 26, padding: 0, fontSize: 11, ...(shadow.angle === a ? { border: "1px solid #7c3aed", color: "#7c3aed" } : {}) }}>{t}</button>
          ))}
        </div>
      </>)}
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

/** 傾斜：水平傾斜把方塊推成平行四邊形（斜的標籤），垂直傾斜則是上下方向。文字、形狀、圖片都能用。 */
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
/** 圖片有沒有透明的地方（去背過的商品、人物）：縮小取樣看 alpha。 */
function hasTransparency(c: HTMLCanvasElement): boolean {
  const t = document.createElement("canvas"); t.width = 48; t.height = 48;
  const g = t.getContext("2d", { willReadFrequently: true });
  if (!g) return false;
  g.drawImage(c, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  return clear > 48 * 48 * 0.02;
}

/** 送給「改這張」的原圖：長邊縮到 1280 以內，去背的保留透明（PNG），其餘用 JPG 省流量。 */
function sourceDataUrl(c: HTMLCanvasElement, cutout: boolean): string {
  const s = Math.min(1, 1280 / Math.max(c.width, c.height));
  const t = document.createElement("canvas"); t.width = Math.max(1, Math.round(c.width * s)); t.height = Math.max(1, Math.round(c.height * s));
  t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
  return cutout ? t.toDataURL("image/png") : t.toDataURL("image/jpeg", 0.9);
}

/** 把換好的圖放回圖層：框的位置不動；去背的圖依自己的比例縮進原本的框（置中）。 */
function applyReplacedImage(target: EL, canvas: HTMLCanvasElement, url: string, cutout: boolean) {
  if (cutout) {
    const ar = canvas.width / (canvas.height || 1);
    let w = target.w, h = w / ar;
    if (h > target.h) { h = target.h; w = h * ar; }
    target.w = w; target.h = h;
  }
  target.canvas = canvas; target.naturalW = canvas.width; target.naturalH = canvas.height; target.src = url;
  target.thumb = makeThumb(target);
}

type ReplaceVariant = { url: string; width: number; height: number; label?: string };
type ImageSnap = Pick<EL, "canvas" | "src" | "w" | "h" | "naturalW" | "naturalH" | "thumb">;
function snapImage(l: EL): ImageSnap {
  return { canvas: l.canvas, src: l.src, w: l.w, h: l.h, naturalW: l.naturalW, naturalH: l.naturalH, thumb: l.thumb };
}
function restoreImage(l: EL, s: ImageSnap) { Object.assign(l, s); }

/** 1200×1600 → "3:4"（範本縮圖角落的比例標籤）。 */
function ratioLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.round(w), Math.round(h)) || 1;
  const a = Math.round(w) / g, b = Math.round(h) / g;
  return a <= 32 && b <= 32 ? `${a}:${b}` : (w > h ? "橫式" : "直式");
}

/** PNG data URL → JPG（白底，畫質 0.92）。 */
function toJpegDataUrl(png: string): Promise<string> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.92));
    };
    im.onerror = () => resolve(png);
    im.src = png;
  });
}

type DownloadFormat = "jpg" | "png" | "psd" | "mp4";
const DOWNLOAD_OPTIONS: { f: DownloadFormat; label: string; hint: string }[] = [
  { f: "jpg", label: "JPG 圖片", hint: "檔案小，適合直接發文" },
  { f: "png", label: "PNG 圖片", hint: "畫質無損" },
  { f: "psd", label: "PSD（Photoshop）", hint: "每個圖層分開，文字可以改；Illustrator 也能開" },
  { f: "mp4", label: "MP4 影片（動畫）", hint: "把「動畫」分頁設定的效果輸出成影片" },
];

/** 工具列的「下載」：一顆按鈕，點開選格式。 */
function DownloadMenu({ busy, onPick }: { busy: boolean; onPick: (f: DownloadFormat) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc, true); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={{ ...S.tbtn, border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff" }} disabled={busy}
        onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="下載這張設計">
        <Download size={15} />{busy ? "處理中…" : "下載"}<ChevronDown size={14} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, width: 260, padding: 6, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 12px 32px rgba(17,24,39,.14)" }}>
          {DOWNLOAD_OPTIONS.map((o) => (
            <button key={o.f} role="menuitem" onClick={() => { setOpen(false); onPick(o.f); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f3ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{o.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{o.hint}</div>
            </button>
          ))}
          <div style={{ fontSize: 11, color: "#9ca3af", padding: "6px 10px 4px", borderTop: "1px solid #f3f4f6", marginTop: 4 }}>JPG、PNG 會同時存一份到素材庫</div>
        </div>
      )}
    </div>
  );
}

/**
 * 右側面板「AI 換圖」：選一張圖、描述想要的畫面，出兩張挑一張換上（位置、大小、效果都保留）。
 * 「改這張」拿原圖當參考只改描述的部分；「全新生成」照描述重畫。
 */
function ReplaceImagePanel({ layerId, aspect: frameAspect, getSource, isCutout, onPreview, onConfirm, onCancel, library, uploadFile }: {
  layerId: string; aspect: number;
  /** 參考圖可以從品牌素材庫挑，或從電腦上傳。 */
  library: { url: string; label?: string }[]; uploadFile: (f: File) => Promise<string>;
  getSource: (cutout: boolean) => string | null;
  isCutout: () => boolean;
  /** 在畫布上先換上看看（不記進上一步）。 */
  onPreview: (v: ReplaceVariant, cutout: boolean) => Promise<void>;
  onConfirm: () => void;
  /** 換回原本的圖。 */
  onCancel: () => void;
}) {
  // 預覽去背的圖時框會變，比例要用一開始的，重新生成才會照原本的框
  const [aspect] = useState(frameAspect);
  const [prompt, setPrompt] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // 預覽中換到別的圖層（這個面板被拆掉）就換回原圖，不能把沒確定的圖留在畫布上
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => () => cancelRef.current(), []);
  const [mode, setMode] = useState<"edit" | "new">("edit");
  // 參考圖（選填）：想改成的樣子，例如某個髮型、背景、風格
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [pickingRef, setPickingRef] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ layerId: string; cutout: boolean; variants: ReplaceVariant[] } | null>(null);
  const shown = result && result.layerId === layerId ? result : null;

  const canRun = !!prompt.trim() || !!refUrl;
  const run = async () => {
    if (busy || !canRun) return;
    if (picked) { onCancel(); setPicked(null); }
    setBusy(true); setErr(null); setResult(null);
    try {
      const cutout = isCutout();
      const imageDataUrl = mode === "edit" ? getSource(cutout) : null;
      if (mode === "edit" && !imageDataUrl) throw new Error("讀不到這張圖");
      const refDataUrl = refUrl ? await urlToJpegDataUrl(refUrl) : null;
      if (refUrl && !refDataUrl) throw new Error("讀不到參考圖，換一張試試");
      const r = await fetch("/api/magic-layers/replace-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), mode, aspect, cutout, imageDataUrl, ...(refDataUrl ? { refDataUrl } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(d.variants) || !d.variants.length) throw new Error(d.error ?? "生成失敗");
      setResult({ layerId, cutout, variants: d.variants });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const pick = async (v: ReplaceVariant) => {
    if (!shown || busy) return;
    try { await onPreview(v, shown.cutout); setPicked(v.url); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const confirm = () => { onConfirm(); setPicked(null); setResult(null); };
  const discard = () => { onCancel(); setPicked(null); setResult(null); };

  const modeBtn = (m: "edit" | "new", label: string) => (
    <button onClick={() => setMode(m)} disabled={busy}
      style={{ flex: 1, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${mode === m ? "#7c3aed" : "#e5e7eb"}`, background: mode === m ? "#f5f3ff" : "#fff", color: mode === m ? "#6d28d9" : "#4b5563" }}>
      {label}
    </button>
  );

  return (
    <div style={{ margin: "0 0 14px", padding: 12, borderRadius: 12, border: "1px solid #ede9fe", background: "#faf8ff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
        <WandSparkles size={15} color="#7c3aed" />AI 換圖
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {modeBtn("edit", "改這張")}
        {modeBtn("new", "全新生成")}
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={400} disabled={busy}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(); }}
        placeholder={refUrl
          ? (mode === "edit" ? "要照參考圖改哪裡？例如：髮型改成參考圖這樣（不寫就照參考圖自動判斷）" : "想要什麼畫面？例如：同樣的氛圍，換成我們的商品（不寫就照參考圖的感覺生成）")
          : (mode === "edit" ? "要改哪裡？例如：換成短髮、背景改成臥室" : "想要什麼畫面？例如：亞洲女生在浴室對鏡子刷牙，明亮白色調")}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, resize: "vertical", fontFamily: "inherit", background: "#fff" }} />
      {/* 參考圖（選填） */}
      {refUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: 6, borderRadius: 8, border: "1px solid #ede9fe", background: "#fff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={refUrl} alt="參考圖" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, flex: "0 0 auto" }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
            <b style={{ color: "#374151" }}>參考圖</b><br />{mode === "edit" ? "會照這張改你描述的部分" : "會照這張的風格生成新的"}
          </div>
          <button onClick={() => setPickingRef(true)} disabled={busy} style={{ border: "none", background: "transparent", color: "#6d28d9", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>換一張</button>
          <button onClick={() => setRefUrl(null)} disabled={busy} aria-label="拿掉參考圖" style={{ border: "none", background: "transparent", color: "#9ca3af", fontSize: 15, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      ) : (
        <button onClick={() => setPickingRef((v) => !v)} disabled={busy}
          style={{ marginTop: 8, width: "100%", height: 32, borderRadius: 8, border: "1px dashed #c4b5fd", background: "#fff", color: "#6d28d9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ＋ 參考圖（選填）
        </button>
      )}
      {pickingRef && (
        <div style={{ marginTop: 8 }}>
          <ImageLibraryPicker library={library} uploadFile={uploadFile} onPick={(url) => { setRefUrl(url); setPickingRef(false); }} />
        </div>
      )}
      <button onClick={() => void run()} disabled={busy || !canRun}
        style={{ width: "100%", marginTop: 8, height: 36, borderRadius: 10, border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: busy || !canRun ? "default" : "pointer", background: busy ? "#a78bfa" : !canRun ? "#c4b5fd" : "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
        {busy ? "生成中…（約 20–40 秒）" : "✨ 生成兩張"}
      </button>
      {err && <div role="alert" style={{ marginTop: 8, fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "6px 8px", lineHeight: 1.5 }}>{err}</div>}
      {shown && (
        <>
          <div style={{ fontSize: 11, color: "#6b7280", margin: "10px 0 6px" }}>{picked ? "畫布上是預覽，滿意再按「確定套用」" : "點一張先在畫布上看看"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {shown.variants.map((v) => (
              <button key={v.url} onClick={() => void pick(v)} title="在畫布上預覽這張" aria-pressed={picked === v.url}
                style={{ position: "relative", padding: 0, border: picked === v.url ? "2px solid #7c3aed" : "1px solid #e5e7eb", boxShadow: picked === v.url ? "0 0 0 3px #ede9fe" : "none", borderRadius: 8, overflow: "hidden", cursor: "pointer", aspectRatio: String(aspect), display: "flex", alignItems: "center", justifyContent: "center",
                  background: shown.cutout ? "repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 50% / 12px 12px" : "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.url} alt="生成結果" style={{ width: "100%", height: "100%", objectFit: shown.cutout ? "contain" : "cover", display: "block" }} />
                {v.label && <span style={{ position: "absolute", left: 4, bottom: 4, padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(31,41,55,.72)" }}>{v.label}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={discard} style={{ ...S.rbtn, flex: 1 }}>{picked ? "取消，用原圖" : "都不要"}</button>
            <button onClick={confirm} disabled={!picked}
              style={{ flex: 1, height: 32, borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: picked ? "pointer" : "default", background: picked ? "#7c3aed" : "#c4b5fd" }}>確定套用</button>
          </div>
        </>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>位置、大小、陰影等效果都會保留；去背的圖換上後也會自動去背。</p>
    </div>
  );
}

/** 參考圖網址 → 長邊 1280 以內的 JPEG data URL（送給 AI 換圖；鋪白底，透明的地方才不會變黑）。 */
async function urlToJpegDataUrl(url: string): Promise<string | null> {
  const src = await loadToCanvas(url);
  if (!src) return null;
  const s = Math.min(1, 1280 / Math.max(src.width, src.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height);
  try { return c.toDataURL("image/jpeg", 0.9); } catch { return null; }
}

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
    shadow: l.shadow ? { ...l.shadow } : l.shadow,
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
/**
 * 右側設定的一個區塊：標題列點了可以收合，收起來時標題旁顯示目前的設定摘要（例如「外框、陰影」）。
 * 每個區塊開或關記在這台瀏覽器：常用的預設展開、進階的預設收起，使用者改過就照他的。
 */
function PropSection({ id, title, summary, defaultOpen = false, first = false, children }: {
  id: string; title: string; summary?: string; defaultOpen?: boolean; first?: boolean; children: React.ReactNode;
}) {
  const key = `mira.props.${id}`;
  const [open, setOpen] = useState(() => {
    try { const v = window.localStorage.getItem(key); if (v === "1" || v === "0") return v === "1"; } catch { /* 讀不到就用預設 */ }
    return defaultOpen;
  });
  const toggle = () => setOpen((v) => { try { window.localStorage.setItem(key, v ? "0" : "1"); } catch { /* 存不了就只在這次有效 */ } return !v; });
  return (
    <div style={{ borderTop: first ? "none" : "1px solid #eef0f3", margin: first ? "4px 0 0" : 0 }}>
      <button onClick={toggle} aria-expanded={open}
        style={{ width: "100%", height: 40, display: "flex", alignItems: "center", gap: 8, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{title}</span>
        {!open && summary && <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>}
        <span style={{ marginLeft: "auto", color: "#9ca3af", display: "inline-flex" }}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
      </button>
      {open && <div style={{ paddingBottom: 14 }}>{children}</div>}
    </div>
  );
}
/** 文字效果收起來時的摘要。 */
function textFxSummary(fx: TextFx | null | undefined): string {
  if (!fx) return "無";
  const on = [fx.gradient ? "漸層" : "", fx.strokeW ? "外框" : "", fx.shadow ? "陰影" : "", fx.italic ? "斜體" : "", fx.warp && fx.warp !== "none" ? "彎曲" : ""].filter(Boolean);
  return on.length ? on.join("、") : "無";
}
/** 陰影／光暈／傾斜收起來時的摘要。 */
function layerFxSummary(l: { shadow?: unknown; glow?: unknown; skewX?: number; skewY?: number }): string {
  const on = [l.shadow ? "陰影" : "", l.glow ? "光暈" : "", l.skewX || l.skewY ? "傾斜" : ""].filter(Boolean);
  return on.length ? on.join("、") : "無";
}
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
  aiCard: { border: "1px solid #ede9fe", background: "#faf8ff", borderRadius: 12, padding: 12, margin: "0 4px 10px", display: "flex", flexDirection: "column", gap: 6 },
  aiCardTitle: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#374151" },
  aiCardBtn: { marginTop: 6, height: 34, border: "none", borderRadius: 8, background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
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
  rtabCount: { marginLeft: 4, padding: "0 6px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9", fontSize: 11, fontWeight: 700 },
  rhead: { fontSize: 14, fontWeight: 800, color: "#1f2937", marginTop: 0, marginRight: 0, marginBottom: 12, marginLeft: 0 },
  rlabel: { display: "block", fontSize: 12, color: "#6b7280", marginTop: 12, marginRight: 0, marginBottom: 4, marginLeft: 0, fontWeight: 600 },
  rinput: { width: "100%", height: 34, background: "#fff", border: "1px solid #e5e7eb", color: "#1f2937", borderRadius: 8, padding: "0 10px", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" },
  rbtn: { height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  fxChip: { height: 30, padding: "0 12px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  fxChipOn: { border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff" },
};
