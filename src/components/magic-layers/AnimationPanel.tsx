"use client";
/* ============================================================
   自由畫布「動畫」的介面：
   ・AnimationTab：左側「動畫」分頁（影片長度、播放／拖時間、套用效果、光澤範圍、時間軸、下載 MP4）
   ・LayerAnimSettings：右側面板裡，選到的圖層有哪些動畫、每個動畫的細節
   只負責畫面與回呼；圖層怎麼改、怎麼畫、怎麼輸出都在編輯器（MagicLayersEditor）裡。
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles, Trash2, Film, Plus, ChevronsUp, HeartPulse, Star, Waves, Sunrise, Zap, Keyboard, GalleryHorizontal, Vibrate, Focus, ArrowDownToLine, RotateCw, Clock, type LucideIcon } from "lucide-react";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
import { dragLifespan } from "@/lib/magic-layers/layer-lifespan.ts";
import { ANIM_LABELS, animEnd, isOneShot, speedOf, SPEED_LABELS, SPEED_PRESETS, type AnimSpeed, TYPE_STYLES, type AnimKind, type LayerAnim, type ShineDirection, type TypeStyle } from "@/lib/magic-layers/layer-animation.ts";

const KINDS: { kind: AnimKind; hint: string }[] = [
  { kind: "shine", hint: "一道光從物件上掃過去；選好幾個會一個接一個閃" },
  { kind: "bounce", hint: "往上彈一下再落回來；選好幾個會依序彈" },
  { kind: "pulse", hint: "輕輕放大再縮回，一直重複" },
  { kind: "twinkle", hint: "忽明忽暗，適合星星、小裝飾" },
  { kind: "float", hint: "上下輕輕飄，適合商品" },
  { kind: "fadeIn", hint: "開場時慢慢出現" },
  { kind: "popIn", hint: "從無到有「啵」一下冒出來；選好幾個會一個接一個出現，適合圖示、標籤" },
  { kind: "typeIn", hint: "文字一個字一個字出現（打字、淡入、彈出、飛入）；選好幾段字會一段接一段" },
  { kind: "wiggle", hint: "左右扭一扭再停住，隔一下再扭；適合價格標、「立即購買」按鈕" },
  { kind: "blurIn", hint: "從模糊慢慢變清楚；適合大標、商品" },
  { kind: "stomp", hint: "從很大「碰」一下砸到定位；適合折扣數字。選好幾個會一個接一個砸下來" },
  { kind: "spin", hint: "一直轉；適合星星、徽章、小裝飾" },
  { kind: "carousel", hint: "選一張做好的卡片（底框＋字＋圖），按這個就會複製成一排，一格一格往左滑、停在最後一張" },
];

/** 每個效果的小圖示（顏色跟時間軸色條一樣）。 */
const ANIM_ICONS: Record<AnimKind, LucideIcon> = {
  shine: Sparkles, bounce: ChevronsUp, pulse: HeartPulse, twinkle: Star, float: Waves,
  fadeIn: Sunrise, popIn: Zap, typeIn: Keyboard, carousel: GalleryHorizontal,
  wiggle: Vibrate, blurIn: Focus, stomp: ArrowDownToLine, spin: RotateCw,
};
/** 左側效果分組：讓它出現／讓它一直動／特殊。 */
const KIND_GROUPS: { title: string; note: string; kinds: AnimKind[] }[] = [
  { title: "進場", note: "讓它出現", kinds: ["fadeIn", "popIn", "typeIn", "blurIn", "stomp"] },
  { title: "一直動", note: "吸引目光", kinds: ["shine", "bounce", "pulse", "twinkle", "float", "wiggle", "spin"] },
  { title: "特殊", note: "", kinds: ["carousel"] },
];
const hintOf = (k: AnimKind) => KINDS.find((x) => x.kind === k)?.hint ?? "";

const TYPE_STYLE_LABELS: Record<TypeStyle, string> = { type: "打字", fade: "淡入", pop: "彈出", slide: "飛入" };

const btn: React.CSSProperties = { height: 34, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" };
const primary: React.CSSProperties = { ...btn, border: "none", background: "#7c3aed", color: "#fff" };

/** key：這一列自己的代號（同一個圖層可能出現在好幾列，id 會重複，React 列表要用 key）。 */
export type AnimTrack = { key: string; id: string; name: string; /** 名字是使用者自己取的。 */ custom?: boolean; anims: LayerAnim[] };

// 左側動畫面板的樣式（白卡片 v2：紫 #7c3aed、淺紫底 violet-50、邊框 #ebeff5）
const BORDER = "#ebeff5";
const on: React.CSSProperties = { border: "1.5px solid #7c3aed", background: "#f5f3ff", color: "#6d28d9" };
const pill: React.CSSProperties = { height: 34, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: "#fff", fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" };
const divider = <div style={{ height: 1, background: BORDER, margin: "16px -2px" }} />;

/** 區塊標題：紫色小圖示＋粗體標題（右邊可以放按鈕），下面一行灰色說明。 */
function SectionHead(props: { icon: LucideIcon; title: React.ReactNode; hint?: string; right?: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon size={17} color="#7c3aed" style={{ flex: "0 0 auto" }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>{props.title}</span>
        {props.right}
      </div>
      {props.hint && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, paddingLeft: 24 }}>{props.hint}</div>}
    </div>
  );
}

export function AnimationTab(props: {
  getDuration: () => number; autoDuration: boolean; onDuration: (d: number | null) => void;
  playing: boolean; getTime: () => number | null; onPlay: () => void; onPause: () => void; onSeek: (t: number) => void;
  selectionCount: number; onApply: (kind: AnimKind) => void; onAddZone: () => void;
  /** 滑鼠移到效果按鈕上：先在畫布上試播（null＝移開了）。 */
  onTry: (kind: AnimKind | null) => void;
  onClearAll: () => void;
  /** 選到的圖層已經有哪些效果（按鈕亮起來）。 */
  activeKinds: AnimKind[];
  getTracks: () => AnimTrack[]; selectedIds: string[]; onSelectLayer: (id: string) => void;
  onMoveStart: (layerId: string, animId: string, start: number) => void; onCommitMove: () => void;
  onRenameTrack: (layerId: string, animId: string, name: string) => void;
  onResizeTrack: (layerId: string, animId: string, duration: number) => void;
  onRemoveTrack: (layerId: string, animId: string) => void;
  /** 有幾頁：兩頁以上可以預覽／輸出整份影片（頁跟頁之間有過場）。 */
  pageCount: number; onPreviewAll: () => void;
  onExport: (allPages: boolean) => void; exporting: boolean; progress: number;
}) {
  const multi = props.pageCount > 1;
  // 圖層在編輯器的 ref 裡：每次這個面板重新 render 時讀一次（編輯器改圖層後會 refresh）
  const duration = props.getDuration();
  const secRef = useRef<HTMLInputElement>(null);
  const preset = !props.autoDuration && [3, 6, 10].includes(duration) ? duration : null;
  const customOn = !props.autoDuration && preset === null;

  return (
    // 捲動面板時滑鼠底下的按鈕會換掉，但不會觸發「移開」：一捲動就先結束試播
    <div onWheel={() => props.onTry(null)} style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginBottom: 14 }}>
        先在畫布上選圖層（可以拉框選好幾個），滑鼠移到效果上會先試播，點下去才套用；細節在右側面板調整。
      </div>

      {/* ── 頁面時長 ── */}
      <SectionHead icon={Clock} title={multi ? "這一頁時長" : "頁面時長"} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[3, 6, 10].map((d) => (
          <button key={d} onClick={() => props.onDuration(d)} style={{ ...pill, ...(preset === d ? on : {}) }}>{d} 秒</button>
        ))}
        <button onClick={() => { if (props.autoDuration) props.onDuration(duration); secRef.current?.focus(); secRef.current?.select(); }}
          title="自己填秒數" style={{ ...pill, ...(customOn ? on : {}) }}>自訂</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        自己設定
        <input ref={secRef} type="number" min={0.5} max={30} step={0.5} value={Math.round(duration * 10) / 10} aria-label={multi ? "這一頁播幾秒" : "影片幾秒"}
          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) props.onDuration(Math.min(30, Math.max(0.5, v))); }}
          style={{ width: 80, height: 32, border: `1.5px solid ${customOn ? "#c4b5fd" : BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111827" }} />
        秒
        <button onClick={() => props.onDuration(null)} disabled={props.autoDuration} title="照動畫自動決定長度"
          style={{ marginLeft: "auto", border: "none", background: "transparent", padding: 0, fontSize: 11, cursor: props.autoDuration ? "default" : "pointer", color: props.autoDuration ? "#7c3aed" : "#9ca3af", fontWeight: props.autoDuration ? 700 : 500 }}>
          {props.autoDuration ? "✓ 自動" : "改回自動"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, marginTop: 8 }}>播放和時間軸在畫布下方：按「時間軸 ↑」可以調每個物件什麼時候出現、消失；動畫的開始、速度在右側面板調。</div>

      {divider}

      {/* ── 套用效果 ── */}
      <SectionHead icon={Sparkles} title={`套用效果${props.selectionCount ? `（${props.selectionCount} 個圖層）` : ""}`}
        hint={props.selectionCount ? undefined : "先在畫布上選一個圖層"}
        right={props.getTracks().length > 0 ? (
          <button onClick={props.onClearAll} title="拿掉這一頁所有圖層的動畫（可以 ⌘Z 復原）"
            style={{ flex: "0 0 auto", height: 28, padding: "0 9px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} />清除全部
          </button>
        ) : undefined} />
      {KIND_GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 7 }}>
            {g.title}{g.note && <span style={{ fontWeight: 500, fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{g.note}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {g.kinds.map((kind) => {
              const Icon = ANIM_ICONS[kind], active = props.activeKinds.includes(kind);
              return (
                <button key={kind} onClick={() => props.onApply(kind)} disabled={!props.selectionCount}
                  onMouseEnter={() => { if (props.selectionCount) props.onTry(kind); }} onMouseLeave={() => props.onTry(null)}
                  title={props.selectionCount ? `${hintOf(kind)}${kind === "carousel" ? "" : "（滑鼠移上來會先試播，點下去才套用）"}` : "先在畫布上選一個圖層"}
                  style={{ ...pill, height: 38, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 5, padding: "0 7px", whiteSpace: "nowrap", overflow: "hidden",
                    ...(active ? on : {}), ...(props.selectionCount ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}>
                  <Icon size={15} color={ANIM_COLORS[kind]} style={{ flex: "0 0 auto" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ANIM_LABELS[kind]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={props.onAddZone}
        title="加一塊看不見的範圍，只有閃光掃過時在裡面亮一下（例如只想讓照片的某一塊發亮）"
        style={{ height: 42, borderRadius: 10, border: "1.5px solid #ebe4f9", background: "#f9f6ff", color: "#4c1d95", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Sparkles size={16} color="#7c3aed" />加一塊光澤範圍
      </button>

      {divider}

      {/* ── 輸出 ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {multi && (
          <button onClick={props.onPreviewAll} disabled={props.exporting}
            style={{ ...pill, height: 44, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Play size={15} color="#7c3aed" fill="#7c3aed" />預覽整份影片（{props.pageCount} 頁）
          </button>
        )}
        <button onClick={() => props.onExport(multi)} disabled={props.exporting}
          style={{ height: 46, borderRadius: 10, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: props.exporting ? 0.7 : 1 }}>
          <Film size={17} />{props.exporting ? `輸出中… ${Math.round(props.progress * 100)}%` : multi ? `下載 MP4（全部 ${props.pageCount} 頁）` : "下載 MP4 影片"}
        </button>
        {multi && !props.exporting && (
          <button onClick={() => props.onExport(false)} style={{ border: "none", background: "transparent", color: "#6d28d9", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>只下載這一頁</button>
        )}
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.7 }}>
          {multi ? "在瀏覽器裡直接輸出，臉書、IG 都能上傳。頁跟頁之間的過場在下方頁面列兩頁中間的小按鈕設定。" : "在瀏覽器裡直接輸出，臉書、IG 都能上傳；只會輸出目前這一頁。"}
        </div>
      </div>
    </div>
  );
}

const ANIM_COLORS: Record<AnimKind, string> = { shine: "#f59e0b", bounce: "#ec4899", pulse: "#8b5cf6", twinkle: "#06b6d4", float: "#10b981", fadeIn: "#6b7280", popIn: "#f97316", typeIn: "#3b82f6", carousel: "#14b8a6",
  wiggle: "#e11d48", blurIn: "#64748b", stomp: "#b45309", spin: "#0ea5e9" };


const num: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 30, border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 6px", fontSize: 12 };

/** 右側面板：這個圖層的動畫清單＋每個動畫的細節。 */
/** 輪播裡選到的那一張卡：第幾張、有哪些字、哪些圖。 */
export type CarouselCardInfo = { index: number; total: number; texts: { id: string; text: string; vertical: boolean }[]; images: { id: string; thumb: string | null }[] };

export function LayerAnimSettings(props: {
  anims: LayerAnim[] | undefined; shineOnly?: boolean;
  onChange: (animId: string, patch: Partial<LayerAnim>) => void; onRemove: (animId: string) => void; onAdd: (kind: AnimKind) => void;
  carouselCard?: CarouselCardInfo; library: { url: string; label?: string }[]; uploadFile: (f: File) => Promise<string>;
  onCardText: (layerId: string, value: string) => void; onCardImage: (layerId: string, url: string) => void;
  /** 在下方時間軸點到的動畫：這張卡亮起來並捲到看得到。 */
  focusId?: string | null;
}) {
  const anims = props.anims ?? [];
  const [adding, setAdding] = useState(false);
  // 正在幫這張卡的哪張圖挑新圖
  const [picking, setPicking] = useState<string | null>(null);
  // 哪幾個動畫打開了「自訂」（填過不是預設速度的數字會自動打開）
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const card = props.carouselCard;
  // 時間軸點到別的動畫時才捲過去（不是每次重畫都捲，不然右側一直跳）
  const focusId = props.focusId;
  useEffect(() => {
    if (focusId) document.querySelector(`[data-anim-card="${focusId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusId]);
  return (
    <div style={{ margin: "14px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
        <Film size={14} color="#7c3aed" style={{ marginRight: 6 }} />動畫
        <button onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto", ...btn, height: 26, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 3 }}><Plus size={12} />加效果</button>
      </div>
      {props.shineOnly && <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginBottom: 6 }}>這是一塊「光澤範圍」：輸出時看不見，只有閃光掃過時在這個形狀裡亮一下。</div>}
      {adding && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
          {KIND_GROUPS.flatMap((g) => g.kinds).map((kind) => {
            const Icon = ANIM_ICONS[kind];
            return (
              <button key={kind} onClick={() => { props.onAdd(kind); setAdding(false); }} title={hintOf(kind)}
                style={{ ...btn, height: 28, fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 4px" }}>
                <Icon size={12} color={ANIM_COLORS[kind]} style={{ flex: "0 0 auto" }} />{ANIM_LABELS[kind]}
              </button>
            );
          })}
        </div>
      )}
      {!anims.length && !adding && <div style={{ fontSize: 11, color: "#9ca3af" }}>沒有動畫。可以在左側「動畫」分頁套用，或按「加效果」。</div>}
      {anims.map((a) => (
        <div key={a.id} data-anim-card={a.id}
          style={{ border: a.id === props.focusId ? "1.5px solid #7c3aed" : "1px solid #ede9fe", background: "#faf8ff", borderRadius: 10, padding: a.id === props.focusId ? 9.5 : 10, marginBottom: 8,
            boxShadow: a.id === props.focusId ? "0 0 0 3px #ede9fe" : "none", transition: "box-shadow .2s" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            {(() => { const Icon = ANIM_ICONS[a.kind]; return <Icon size={14} color={ANIM_COLORS[a.kind]} style={{ marginRight: 6, flex: "0 0 auto" }} />; })()}
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{ANIM_LABELS[a.kind]}</span>
            <button onClick={() => props.onRemove(a.id)} title="拿掉這個動畫" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af" }}><Trash2 size={14} /></button>
          </div>
          {(() => {
            const speed = speedOf(a);
            const custom = speed === null || !!customOpen[a.id];
            // 「停多久」是節奏，直接放外面填；只有一直循環的呼吸／閃爍／漂浮，間隔才收進自訂
            const gapOutside = a.kind === "shine" || a.kind === "bounce" || a.kind === "carousel";
            const gapField = (
              <Field label={a.kind === "carousel" ? "每張停多久（秒）" : "每輪間隔（秒）"}><input type="number" min={0} max={10} step={0.1} value={a.gap} onChange={(e) => props.onChange(a.id, { gap: Math.max(0, Number(e.target.value) || 0) })} style={num} /></Field>
            );
            const on = { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" };
            return (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <Field label="開始（秒）"><input type="number" min={0} max={30} step={0.1} value={a.start} onChange={(e) => props.onChange(a.id, { start: Math.max(0, Number(e.target.value) || 0) })} style={num} /></Field>
                {gapOutside && gapField}
              </div>
              <Field label={a.kind === "carousel" ? "滑動速度" : a.kind === "typeIn" ? "打字速度" : "速度"}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["slow", "normal", "fast"] as AnimSpeed[]).map((sp) => (
                    <button key={sp} type="button" onClick={() => { props.onChange(a.id, { duration: SPEED_PRESETS[a.kind][sp] }); setCustomOpen((c) => ({ ...c, [a.id]: false })); }}
                      style={{ ...btn, flex: 1, height: 28, fontSize: 12, ...(speed === sp ? on : {}) }}>{SPEED_LABELS[sp]}</button>
                  ))}
                  <button type="button" onClick={() => setCustomOpen((c) => ({ ...c, [a.id]: !custom }))} title={custom ? "收起" : "自己填秒數、重複次數"}
                    style={{ ...btn, flex: 1, height: 28, fontSize: 12, ...(speed === null ? on : custom ? { color: "#6d28d9" } : {}) }}>自訂{custom ? " ▴" : " ▾"}</button>
                </div>
              </Field>
              {custom && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <Field label={a.kind === "typeIn" ? "整段跑完（秒）" : a.kind === "carousel" ? "每次滑多久（秒）" : isOneShot(a.kind) ? "多久（秒）" : "一輪（秒）"}><input type="number" min={0.1} max={10} step={0.1} value={a.duration} onChange={(e) => props.onChange(a.id, { duration: Math.max(0.1, Number(e.target.value) || 0.1) })} style={num} /></Field>
                  {!isOneShot(a.kind) && a.kind !== "carousel" && (<>
                    {!gapOutside && gapField}
                    <Field label="重複（0＝一直）"><input type="number" min={0} max={50} step={1} value={a.repeat} onChange={(e) => props.onChange(a.id, { repeat: Math.max(0, Math.round(Number(e.target.value) || 0)) })} style={num} /></Field>
                  </>)}
                </div>
              )}
            </>);
          })()}
          {a.kind === "typeIn" && (
            <Field label="每個字怎麼進場">
              <div style={{ display: "flex", gap: 4 }}>
                {TYPE_STYLES.map((st) => (
                  <button key={st} type="button" onClick={() => props.onChange(a.id, { typeStyle: st })}
                    style={{ ...btn, flex: 1, height: 28, fontSize: 11, ...((a.typeStyle ?? "slide") === st ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{TYPE_STYLE_LABELS[st]}</button>
                ))}
              </div>
            </Field>
          )}
          {a.kind === "carousel" && (<>
            <Field label={`中間那張放大 ${a.intensity > 0 ? `${Math.round(a.intensity * 30)}%` : "（不放大）"}`}>
              <input type="range" min={0} max={100} value={Math.round(a.intensity * 100)} onChange={(e) => props.onChange(a.id, { intensity: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
            </Field>
            <Field label="往哪邊滑">
              <div style={{ display: "flex", gap: 4 }}>
                {([["left", "← 往左"], ["right", "往右 →"]] as const).map(([d, t]) => (
                  <button key={d} type="button" onClick={() => props.onChange(a.id, { slideDir: d })}
                    style={{ ...btn, flex: 1, height: 28, fontSize: 11, ...((a.slideDir ?? "left") === d ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{t}</button>
                ))}
              </div>
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={a.wrap !== false} onChange={(e) => props.onChange(a.id, { wrap: e.target.checked })} style={{ accentColor: "#7c3aed" }} />後面接回第一張（滑到最後旁邊不會空著）
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={a.blur !== false} onChange={(e) => props.onChange(a.id, { blur: e.target.checked })} style={{ accentColor: "#7c3aed" }} />滑動時有一點模糊（比較有速度感）
            </label>
            <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginTop: 6 }}>
              這一組共 {Math.max(0, (a.steps ?? 0)) + 1} 格可以看（會滑 {a.steps ?? 0} 次，停在最後一張）。上面的設定會一起改整組；中間那張＝套用時在畫布正中間的那張。
            </div>
            {card && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd6fe" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>這一張：第 {card.index + 1} 張／共 {card.total} 張</div>
                {card.texts.map((t) => (
                  <label key={t.id} style={{ display: "block", marginBottom: 6 }}>
                    <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 3 }}>文字{t.vertical ? "（直排，照常打一行）" : ""}</span>
                    <input value={t.text} aria-label="這張卡的文字" onChange={(e) => props.onCardText(t.id, e.target.value)} style={num} />
                  </label>
                ))}
                {card.images.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {card.images.map((im) => (
                      <button key={im.id} type="button" onClick={() => setPicking(picking === im.id ? null : im.id)} title="點一下換圖" aria-label="這張卡換圖"
                        style={{ width: 64, height: 64, padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative", background: "#f3f4f6", border: picking === im.id ? "2px solid #7c3aed" : "1px solid #e5e7eb" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {im.thumb ? <img src={im.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /> : null}
                        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(17,24,39,.6)", padding: "1px 0" }}>換圖</span>
                      </button>
                    ))}
                  </div>
                )}
                {picking && card.images.some((im) => im.id === picking) && (
                  <div style={{ marginTop: 8 }}>
                    <ImageLibraryPicker library={props.library} uploadFile={props.uploadFile} onPick={(url) => { props.onCardImage(picking, url); setPicking(null); }} />
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, marginTop: 6 }}>在畫布上點別張卡，這裡就換成那一張。</div>
              </div>
            )}
          </>)}
          {a.kind === "spin" && (
            <Field label="轉的方向">
              <div style={{ display: "flex", gap: 4 }}>
                {([[false, "↻ 順時針"], [true, "↺ 逆時針"]] as const).map(([ccw, t]) => (
                  <button key={t} type="button" onClick={() => props.onChange(a.id, { ccw })}
                    style={{ ...btn, flex: 1, height: 28, fontSize: 11, ...(!!a.ccw === ccw ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{t}</button>
                ))}
              </div>
            </Field>
          )}
          {a.kind !== "fadeIn" && a.kind !== "carousel" && a.kind !== "spin" && !(a.kind === "typeIn" && (a.typeStyle === "type" || a.typeStyle === "fade")) && (
            <Field label={`${a.kind === "typeIn" && (a.typeStyle ?? "slide") === "slide" ? "飛入距離" : a.kind === "popIn" || a.kind === "typeIn" || a.kind === "stomp" ? "力道" : a.kind === "wiggle" ? "扭的幅度" : a.kind === "blurIn" ? "一開始多模糊" : "強度"} ${Math.round(a.intensity * 100)}%`}>
              <input type="range" min={5} max={100} value={Math.round(a.intensity * 100)} onChange={(e) => props.onChange(a.id, { intensity: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
            </Field>
          )}
          {a.kind === "fadeIn" && (<>
            <Field label="從哪裡進來">
              <DirCompass value={a.enterDir ?? null} ariaPrefix="淡入" center="原地" onPick={(d) => props.onChange(a.id, { enterDir: d ?? undefined })} />
            </Field>
            {a.enterDir && (
              <Field label={`滑動距離 ${Math.round(a.intensity * 100)}%`}>
                <input type="range" min={5} max={100} value={Math.round(a.intensity * 100)} onChange={(e) => props.onChange(a.id, { intensity: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
              </Field>
            )}
          </>)}
          {a.kind === "shine" && (<>
            <Field label="方向">
              <DirCompass value={a.direction ?? "down"} ariaPrefix="閃光" onPick={(d) => d && props.onChange(a.id, { direction: d })} />
            </Field>
            <Field label={`光的寬度 ${Math.round((a.width ?? 0.35) * 100)}%`}>
              <input type="range" min={10} max={80} value={Math.round((a.width ?? 0.35) * 100)} onChange={(e) => props.onChange(a.id, { width: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#7c3aed" }} />
            </Field>
          </>)}
        </div>
      ))}
    </div>
  );
}

const SHINE_COMPASS: ([ShineDirection, string, string] | [null, "", ""])[] = [
  ["upLeft", "↖", "從右下往左上"], ["up", "↑", "從下往上"], ["upRight", "↗", "從左下往右上"],
  ["left", "←", "從右往左"], [null, "", ""], ["right", "→", "從左往右"],
  ["downLeft", "↙", "從右上往左下"], ["down", "↓", "從上往下"], ["downRight", "↘", "從左上往右下"],
];

/**
 * 3×3 方向羅盤：箭頭＝移動的方向（↑ 是往上走、也就是從下面來）。
 * 有 center 時正中間是一顆「不移動」的按鈕（回傳 null），沒有就空著。
 */
function DirCompass(props: { value: ShineDirection | null; onPick: (d: ShineDirection | null) => void; center?: string; ariaPrefix: string }) {
  const on = { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 32px)", gap: 4 }}>
      {SHINE_COMPASS.map(([d, t, name], i) => d ? (
        <button key={d} type="button" title={name} aria-label={`${props.ariaPrefix}${name}`} onClick={() => props.onPick(d)}
          style={{ ...btn, width: 32, height: 28, padding: 0, fontSize: 14, ...(props.value === d ? on : {}) }}>{t}</button>
      ) : props.center ? (
        <button key={`c${i}`} type="button" title={props.center} aria-label={`${props.ariaPrefix}${props.center}`} onClick={() => props.onPick(null)}
          style={{ ...btn, width: 32, height: 28, padding: 0, fontSize: 10, ...(props.value === null ? on : {}) }}>{props.center}</button>
      ) : <span key={`c${i}`} />)}
    </div>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginTop: 6 }}>
      <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 3 }}>{text}</span>
      {children}
    </label>
  );
}

/**
 * 預覽整份影片：蓋在畫面上的播放器，從第 1 頁播到最後一頁（含過場）。
 * 每一格怎麼畫由編輯器給（跟輸出 MP4 同一套），這裡只管播放、暫停、拖時間。
 */
export function SequencePreview(props: {
  width: number; height: number; total: number;
  drawFrame: (ctx: CanvasRenderingContext2D, t: number) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { drawFrame, total } = props;
  // 暫停時：拖到哪就畫哪一格
  useEffect(() => {
    const ctx = ref.current?.getContext("2d"); if (!ctx || playing) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); drawFrame(ctx, t);
  }, [playing, t, drawFrame]);
  // 播放中：自己用 rAF 走時間
  useEffect(() => {
    const ctx = ref.current?.getContext("2d"); if (!ctx || !playing) return;
    let raf = 0; const t0 = performance.now() - t * 1000;
    const tick = (now: number) => {
      let cur = (now - t0) / 1000;
      if (cur >= total) cur = total;
      ctx.setTransform(1, 0, 0, 1, 0, 0); drawFrame(ctx, cur); setT(cur);
      if (cur < total) raf = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t 只在開始播放那一刻讀一次
  }, [playing, drawFrame, total]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, maxWidth: "min(92vw, 900px)" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#1f2937" }}>
          <Film size={15} color="#7c3aed" style={{ marginRight: 6 }} />預覽整份影片
          <button onClick={props.onClose} style={{ marginLeft: "auto", ...btn, height: 28, padding: "0 10px" }}>關閉</button>
        </div>
        <canvas ref={ref} width={props.width} height={props.height}
          style={{ display: "block", maxWidth: "100%", maxHeight: "70vh", width: "auto", height: "auto", aspectRatio: `${props.width} / ${props.height}`, borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { if (!playing && t >= total) setT(0); setPlaying((v) => !v); }} style={{ ...primary, width: 76, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "暫停" : "播放"}
          </button>
          <input type="range" min={0} max={total} step={0.05} value={Math.min(total, t)} aria-label="整份影片預覽時間"
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} style={{ flex: 1, accentColor: "#7c3aed" }} />
          <span style={{ width: 70, fontSize: 11, color: "#6b7280", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.toFixed(1)} / {total.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

/** 0:02.3 這種格式（影片不會超過 30 秒，分鐘只是讓人看得懂）。 */
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** 時間軸一列要的資料（從編輯器的圖層快照來，不另外存一份）。 */
export type LifeRow = { id: string; name: string; sub: string; isText: boolean; thumb: string | null; start: number; end: number; hasAnim: boolean; anims: LayerAnim[] };

/** 動畫片段分車道：時間不重疊的放同一條（像參考圖淡入、漂浮排在同一排），重疊的往下排。 */
export function animLanes(anims: LayerAnim[], duration: number, minLen: (a: LayerAnim) => number = () => duration * 0.08): { anim: LayerAnim; lane: number }[] {
  const gap = duration * 0.02, laneEnd: number[] = [];
  return [...anims].sort((a, b) => a.start - b.start).map((anim) => {
    const end = Math.max(anim.start + anim.duration, anim.start + minLen(anim));
    let lane = laneEnd.findIndex((e) => e + gap <= anim.start);
    if (lane < 0) { lane = laneEnd.length; laneEnd.push(end); } else laneEnd[lane] = end;
    return { anim, lane };
  });
}
export type DockMode = "closed" | "selected" | "all";

/**
 * 畫布下方的時間軸（漸進揭露）。只管「時間」：播放位置、每個物件什麼時候出現／消失；
 * 物件管理（顯示、鎖定、排序…）留在右側圖層，動畫參數留在右側動畫面板。
 * ・closed：一條薄播放列
 * ・selected：秒數刻度＋目前選取的物件那一條
 * ・all：每個物件一列（縮圖＋短名稱＋時間條）
 * 時間條：拖中間＝整段平移、拖左右邊＝出現／消失時間；拖刻度或播放頭＝跳到那一格。
 */
export function AnimDock(props: {
  mode: DockMode; onMode: (m: DockMode) => void;
  getDuration: () => number;
  playing: boolean; getTime: () => number | null; onPlay: () => void; onPause: () => void; onSeek: (t: number) => void;
  /** 這一頁的物件（由上到下）；編輯器每次重畫面板時才讀，不在這裡另存一份。 */
  getRows: () => LifeRow[]; selectedId: string | null; onSelect: (id: string) => void;
  onLifespan: (id: string, start: number, end: number) => void; onCommit: () => void;
  /** 拖時間軸上的動畫片段：改開始時間或一輪多久（跟右側動畫設定是同一份資料）。 */
  onAnim: (layerId: string, animId: string, patch: Partial<LayerAnim>) => void;
  /** 點動畫片段：選到物件、右側切到動畫分頁並亮出那張卡。 */
  onFocusAnim: (layerId: string, animId: string) => void;
  focusAnimId: string | null;
}) {
  const [zoom, setZoom] = useState(1);   // 1＝整頁剛好放滿
  const [time, setTime] = useState(0);
  const drag = useRef<{ mode: "move" | "start" | "end" | "seek" | "animMove" | "animLen"; id: string; animId?: string; x0: number; s0: number; e0: number; w: number } | null>(null);
  const { playing, getTime, mode } = props;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { setTime(getTime() ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getTime]);
  const duration = props.getDuration();
  const shown = Math.min(duration, playing ? time : (getTime() ?? 0));
  const seek = (t: number) => { const v = Math.max(0, Math.min(duration, t)); setTime(v); props.onSeek(v); };
  const pct = (t: number) => `${(Math.max(0, Math.min(duration, t)) / duration) * 100}%`;

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dt = ((e.clientX - d.x0) / Math.max(1, d.w)) * duration;
    if (d.mode === "seek") { seek(d.s0 + dt); return; }
    if (d.mode === "animMove") { props.onAnim(d.id, d.animId!, { start: Math.max(0, Math.min(duration - 0.1, Math.round((d.s0 + dt) * 10) / 10)) }); return; }
    if (d.mode === "animLen") { props.onAnim(d.id, d.animId!, { duration: Math.max(0.1, Math.min(10, Math.round((d.e0 + dt) * 20) / 20)) }); return; }
    const r = dragLifespan(d.mode, d.s0, d.e0, dt, duration);
    props.onLifespan(d.id, r.start, r.end);
  };
  const endDrag = () => { const d = drag.current; drag.current = null; if (d && d.mode !== "seek") props.onCommit(); };
  /** 開始拖：w＝時間條（或刻度）的實際寬度，用來把像素換成秒。 */
  const begin = (e: React.PointerEvent, mode: "move" | "start" | "end" | "seek" | "animMove" | "animLen", id: string, s0: number, e0: number, animId?: string) => {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 抓不到游標也照樣拖 */ }
    const track = (e.currentTarget as HTMLElement).closest("[data-track]") as HTMLElement | null;
    drag.current = { mode, id, animId, x0: e.clientX, s0, e0, w: track?.getBoundingClientRect().width ?? 1 };
  };
  const scrubFromTrack = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = ((e.clientX - r.left) / Math.max(1, r.width)) * duration;
    seek(t); begin(e, "seek", "", t, t);
  };

  const playBtn = (
    <button onClick={playing ? props.onPause : props.onPlay} aria-label={playing ? "暫停" : "播放"} title={playing ? "暫停" : "播放（點一下畫布回到編輯）"}
      style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 2px 6px rgba(124,58,237,.35)" }}>
      {playing ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" style={{ marginLeft: 2 }} />}
    </button>
  );
  const timeText = <span style={{ fontSize: 13, color: "#4b5563", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{clock(shown)} / {clock(duration)}</span>;
  const linkBtn: React.CSSProperties = { border: "none", background: "transparent", color: "#6d28d9", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "0 4px", whiteSpace: "nowrap" };

  const PURPLE = "#7c3aed", LAV = "#ede9fe";
  const pill = (on = false): React.CSSProperties => ({
    height: 30, padding: "0 12px", borderRadius: 9, border: `1px solid ${on ? "#ddd6fe" : "#e5e7eb"}`, background: on ? "#faf8ff" : "#fff",
    color: on ? "#6d28d9" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4,
  });
  const scrub = (
    <input type="range" min={0} max={duration} step={0.05} value={shown} onChange={(e) => seek(Number(e.target.value))} aria-label="動畫時間"
      style={{ flex: "1 1 160px", minWidth: 80, maxWidth: 420, accentColor: PURPLE }} />
  );
  const card: React.CSSProperties = { flex: "0 0 auto", margin: "0 12px 8px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(17,24,39,.04), 0 4px 14px rgba(17,24,39,.04)" };

  if (mode === "closed") {
    return (
      <div style={{ ...card, height: 46, display: "flex", alignItems: "center", gap: 12, padding: "0 10px 0 8px" }}>
        {playBtn}{timeText}{scrub}
        <button onClick={() => props.onMode("selected")} style={{ ...pill(), marginLeft: "auto" }} title="展開時間軸：調整物件什麼時候出現、消失，和動畫的時間">時間軸 ↑</button>
      </div>
    );
  }

  const NAME_W = mode === "selected" ? 168 : 150;
  const allRows = props.getRows();
  const rows = mode === "all" ? allRows : allRows.filter((r) => r.id === props.selectedId);
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i);
  const BAR_H = mode === "selected" ? 20 : 14, CHIP_H = 22, LANE_H = 28;
  // 片段至少要寬到看得到名字；換成秒數拿來分車道（軌道寬抓大約值就好）
  const chipPx = (a: LayerAnim) => ANIM_LABELS[a.kind].length * 12 + 64;
  const trackPx = 640 * zoom;
  const lanesOf = (r: LifeRow) => animLanes(r.anims, duration, (a) => (chipPx(a) / trackPx) * duration);
  const laneCount = (r: LifeRow) => (r.anims.length ? Math.max(...lanesOf(r).map((x) => x.lane)) + 1 : 0);
  const rowH = (r: LifeRow) => (mode === "selected" ? 34 : 26) + laneCount(r) * LANE_H;
  const bar = (r: LifeRow) => {
    const sel = r.id === props.selectedId;
    const barTop = mode === "selected" ? 8 : 6;
    const edge: React.CSSProperties = { position: "absolute", top: 0, bottom: 0, width: 12, cursor: "ew-resize", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" };
    const grip = <div style={{ width: 3, height: BAR_H - 8, borderRadius: 2, background: sel ? "rgba(255,255,255,.95)" : "#c4b5fd" }} />;
    return (
      <div data-track style={{ position: "relative", flex: 1, minWidth: 0, height: rowH(r) }}>
        {/* 底軌：整頁的長度 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: barTop, height: BAR_H, borderRadius: 999, background: "#f5f3fa" }} />
        {/* 物件存在時間 */}
        <div title={`${r.name}：${r.start}s – ${Math.round(r.end * 100) / 100}s 出現（拖中間整段移動，拖兩邊調出現／消失時間）`}
          onPointerDown={(e) => { props.onSelect(r.id); begin(e, "move", r.id, r.start, r.end); }}
          style={{ position: "absolute", left: pct(r.start), width: `calc(${pct(r.end)} - ${pct(r.start)})`, top: barTop, height: BAR_H, borderRadius: 999, cursor: "grab", touchAction: "none",
            background: sel ? "linear-gradient(180deg,#8b5cf6,#7c3aed)" : "#e4dcfb", boxShadow: sel ? "0 1px 3px rgba(124,58,237,.35)" : "none" }}>
          <div onPointerDown={(e) => { props.onSelect(r.id); begin(e, "start", r.id, r.start, r.end); }} title="拖曳調整出現時間" style={{ ...edge, left: 0 }}>{grip}</div>
          <div onPointerDown={(e) => { props.onSelect(r.id); begin(e, "end", r.id, r.start, r.end); }} title="拖曳調整消失時間" style={{ ...edge, right: 0 }}>{grip}</div>
        </div>
        {/* 動畫片段：排在存在時間下面，跟右側動畫設定同一份資料 */}
        {lanesOf(r).map(({ anim: a, lane }) => {
          const top = barTop + BAR_H + 6 + lane * LANE_H, focused = a.id === props.focusAnimId;
          const first = Math.min(duration, a.start + a.duration), end = Math.min(duration, animEnd(a));
          const Icon = ANIM_ICONS[a.kind];
          return (
            <div key={a.id}>
              {/* 循環的動畫：後面淡淡接著重複的部分 */}
              {end > first + 0.01 && (
                <div style={{ position: "absolute", left: pct(first), width: `calc(${pct(end)} - ${pct(first)})`, top: top + CHIP_H / 2 - 2, height: 4, borderRadius: 2,
                  background: "repeating-linear-gradient(90deg,#ddd6fe 0 6px,transparent 6px 10px)" }} />
              )}
              <div title={`${ANIM_LABELS[a.kind]}：第 ${a.start} 秒開始、${a.kind === "typeIn" ? "整段" : "一輪"} ${a.duration} 秒（拖曳移動、拖右邊調長短；點一下在右側調細節）`}
                onPointerDown={(e) => { props.onFocusAnim(r.id, a.id); begin(e, "animMove", r.id, a.start, a.duration, a.id); }}
                style={{ position: "absolute", left: pct(a.start), width: `max(${chipPx(a)}px, calc(${pct(first)} - ${pct(a.start)}))`, maxWidth: `calc(100% - ${pct(a.start)})`, top, height: CHIP_H, boxSizing: "border-box",
                  borderRadius: 8, border: `1px solid ${focused ? PURPLE : "#ddd6fe"}`, background: focused ? LAV : "#f7f4ff", boxShadow: focused ? "0 0 0 3px rgba(124,58,237,.12)" : "none",
                  cursor: "grab", touchAction: "none", display: "flex", alignItems: "center", gap: 4, padding: "0 8px", overflow: "hidden", whiteSpace: "nowrap" }}>
                <Icon size={11} color={PURPLE} style={{ flex: "0 0 auto" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", overflow: "hidden", textOverflow: "ellipsis" }}>{ANIM_LABELS[a.kind]}</span>
                <span style={{ fontSize: 10, color: "#a78bfa", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>{a.duration}s</span>
                <div onPointerDown={(e) => { props.onFocusAnim(r.id, a.id); begin(e, "animLen", r.id, a.start, a.duration, a.id); }} title="拖曳調整一輪多久"
                  style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", touchAction: "none" }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const thumb = (r: LifeRow, size: number) => (
    <span style={{ width: size, height: size, flex: "0 0 auto", borderRadius: size > 30 ? 10 : 6, border: `1px solid ${BORDER}`, background: "#f9fafb", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {r.thumb ? <img src={r.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : (r.isText ? "T" : "◇")}
    </span>
  );
  return (
    <div onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      style={{ ...card, display: "flex", flexDirection: "column", maxHeight: 300, overflow: "hidden" }}>
      {/* 窄的時候換行，按鈕才不會被擠出去 */}
      <div style={{ minHeight: 48, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", padding: "8px 12px 4px 8px", flex: "0 0 auto" }}>
        {playBtn}{timeText}{scrub}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }} title="時間軸縮放">
          <button onClick={() => setZoom((z) => Math.max(1, Math.round((z / 1.25) * 100) / 100))} aria-label="時間軸縮小" style={{ ...linkBtn, color: "#6b7280", fontSize: 16 }}>−</button>
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="時間軸縮放" style={{ width: 72, accentColor: PURPLE }} />
          <button onClick={() => setZoom((z) => Math.min(4, Math.round(z * 1.25 * 100) / 100))} aria-label="時間軸放大" style={{ ...linkBtn, color: "#6b7280", fontSize: 16 }}>＋</button>
        </div>
        <button onClick={() => props.onMode("closed")} style={pill()} title="收成一條播放列">收合 ↓</button>
        <button onClick={() => props.onMode(mode === "all" ? "selected" : "all")} style={pill(mode === "all")}>
          {mode === "all" ? "只看目前選取" : "查看全部時間軸 ↑"}
        </button>
      </div>
      <div style={{ overflow: "auto", padding: "0 14px 10px", minHeight: 0 }}>
        <div style={{ position: "relative", width: `${zoom * 100}%`, minWidth: "100%" }}>
          {/* 秒數刻度：點一下或拖曳＝跳到那個時間 */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: NAME_W, flex: "0 0 auto", fontSize: 12, fontWeight: 800, color: PURPLE, paddingBottom: 4 }}>{mode === "selected" ? "目前選取" : "全部物件"}</div>
            <div data-track onPointerDown={scrubFromTrack} title="點一下或拖曳，跳到那個時間"
              style={{ position: "relative", flex: 1, height: 26, cursor: "pointer", touchAction: "none" }}>
              {ticks.map((s) => (
                <div key={s} style={{ position: "absolute", left: pct(s), top: 6, bottom: 0, borderLeft: "1px solid #e8e5f0" }}>
                  <span style={{ position: "absolute", ...(s >= duration - 0.3 ? { right: 4 } : { left: 4 }), top: 0, fontSize: 10, color: "#a1a1aa", fontVariantNumeric: "tabular-nums" }}>{s}s</span>
                </div>
              ))}
            </div>
          </div>
          {rows.length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0 6px", paddingLeft: NAME_W }}>
              {mode === "all" ? "這一頁沒有物件。" : "在畫布或右側點一個物件，就能調它什麼時候出現、消失，和動畫的時間。"}
            </div>
          )}
          <div style={{ maxHeight: mode === "all" ? 196 : undefined, overflowY: mode === "all" ? "auto" : undefined, overflowX: "hidden" }}>
            {rows.map((r) => {
              const sel = r.id === props.selectedId;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "flex-start", paddingTop: mode === "selected" ? 8 : 4, borderRadius: 10 }}>
                  <button onClick={() => props.onSelect(r.id)} title={r.name}
                    style={{ width: NAME_W, flex: "0 0 auto", height: mode === "selected" ? 44 : 26, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", padding: "0 10px 0 0", cursor: "pointer", textAlign: "left" }}>
                    {mode === "selected" ? thumb(r, 42) : thumb(r, 24)}
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: mode === "selected" ? 13 : 12, fontWeight: sel ? 800 : 600, color: sel ? "#1f2937" : "#4b5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                      {mode === "selected" && <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.sub}</span>}
                    </span>
                  </button>
                  {bar(r)}
                </div>
              );
            })}
          </div>
          {/* 播放頭：拖曳＝跳到那一格 */}
          <div style={{ position: "absolute", left: `calc(${NAME_W}px + (100% - ${NAME_W}px) * ${shown / duration})`, top: 14, bottom: 0, width: 0, borderLeft: `2px solid ${PURPLE}`, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: -6, left: -7, width: 12, height: 12, borderRadius: "50%", background: PURPLE, boxShadow: "0 0 0 3px #fff" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
