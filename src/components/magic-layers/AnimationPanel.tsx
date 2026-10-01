"use client";
/* ============================================================
   自由畫布「動畫」的介面：
   ・AnimationTab：左側「動畫」分頁（影片長度、播放／拖時間、套用效果、光澤範圍、時間軸、下載 MP4）
   ・LayerAnimSettings：右側面板裡，選到的圖層有哪些動畫、每個動畫的細節
   只負責畫面與回呼；圖層怎麼改、怎麼畫、怎麼輸出都在編輯器（MagicLayersEditor）裡。
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles, Trash2, Film, Plus, ChevronsUp, HeartPulse, Star, Waves, Sunrise, Zap, Keyboard, GalleryHorizontal, Vibrate, Focus, ArrowDownToLine, RotateCw, type LucideIcon } from "lucide-react";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
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
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "12px 2px 6px" };

/** key：這一列自己的代號（同一個圖層可能出現在好幾列，id 會重複，React 列表要用 key）。 */
export type AnimTrack = { key: string; id: string; name: string; /** 名字是使用者自己取的。 */ custom?: boolean; anims: LayerAnim[] };

export function AnimationTab(props: {
  getDuration: () => number; autoDuration: boolean; onDuration: (d: number | null) => void;
  playing: boolean; getTime: () => number | null; onPlay: () => void; onPause: () => void; onSeek: (t: number) => void;
  selectionCount: number; onApply: (kind: AnimKind) => void; onAddZone: () => void;
  /** 滑鼠移到效果按鈕上：先在畫布上試播（null＝移開了）。 */
  onTry: (kind: AnimKind | null) => void;
  onClearAll: () => void;
  getTracks: () => AnimTrack[]; selectedIds: string[]; onSelectLayer: (id: string) => void;
  onMoveStart: (layerId: string, animId: string, start: number) => void; onCommitMove: () => void;
  onRenameTrack: (layerId: string, animId: string, name: string) => void;
  /** 有幾頁：兩頁以上可以預覽／輸出整份影片（頁跟頁之間有過場）。 */
  pageCount: number; onPreviewAll: () => void;
  onExport: (allPages: boolean) => void; exporting: boolean; progress: number;
}) {
  const multi = props.pageCount > 1;
  // 圖層在編輯器的 ref 裡：每次這個面板重新 render 時讀一次（編輯器改圖層後會 refresh）
  const duration = props.getDuration();
  const tracks = props.getTracks();
  // 播放中自己用 rAF 更新時間顯示，不要讓整個編輯器每一格都重新 render
  const [time, setTime] = useState(0);
  const { playing, getTime } = props;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { setTime(getTime() ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getTime]);
  const shownTime = playing ? time : (getTime() ?? time);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, padding: "0 2px 4px" }}>
        先在畫布上選圖層（可以拉框選好幾個），滑鼠移到效果上會先試播，點下去才套用；細節在右側面板調。
      </div>

      <div style={label}>{multi ? "這一頁播多久" : "影片長度"}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[3, 6, 10].map((d) => (
          <button key={d} onClick={() => props.onDuration(d)}
            style={{ ...btn, flex: 1, ...(!props.autoDuration && duration === d ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{d} 秒</button>
        ))}
        <button onClick={() => props.onDuration(null)} title="照動畫自動決定"
          style={{ ...btn, flex: 1, ...(props.autoDuration ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>自動</button>
      </div>
      {/* 也可以直接打秒數（0.5–30）；自動時顯示目前算出來的長度 */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11, color: "#6b7280" }}>
        自己設定
        <input type="number" min={0.5} max={30} step={0.5} value={Math.round(duration * 10) / 10} aria-label={multi ? "這一頁播幾秒" : "影片幾秒"}
          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) props.onDuration(Math.min(30, Math.max(0.5, v))); }}
          style={{ width: 72, height: 28, border: `1px solid ${props.autoDuration ? "#e5e7eb" : "#7c3aed"}`, borderRadius: 8, padding: "0 8px", fontSize: 12, color: "#374151" }} />
        秒
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <button onClick={playing ? props.onPause : props.onPlay} style={{ ...primary, width: 76, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "暫停" : "播放"}
        </button>
        <input type="range" min={0} max={duration} step={0.05} value={Math.min(duration, shownTime)}
          onChange={(e) => { const t = Number(e.target.value); setTime(t); props.onSeek(t); }}
          style={{ flex: 1, accentColor: "#7c3aed" }} aria-label="預覽時間" />
        <span style={{ width: 54, fontSize: 11, color: "#6b7280", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{shownTime.toFixed(1)} / {duration}s</span>
      </div>

      <div style={label}>套用效果{props.selectionCount ? `（${props.selectionCount} 個圖層）` : ""}</div>
      {KIND_GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "2px 2px 5px" }}>
            {g.title}{g.note && <span style={{ fontWeight: 500, color: "#9ca3af", marginLeft: 6 }}>{g.note}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {g.kinds.map((kind) => {
              const Icon = ANIM_ICONS[kind];
              return (
                <button key={kind} onClick={() => props.onApply(kind)} disabled={!props.selectionCount}
                  onMouseEnter={() => { if (props.selectionCount) props.onTry(kind); }} onMouseLeave={() => props.onTry(null)}
                  title={props.selectionCount ? `${hintOf(kind)}${kind === "carousel" ? "" : "（滑鼠移上來會先試播，點下去才套用）"}` : "先在畫布上選一個圖層"}
                  style={{ ...btn, display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 7, padding: "0 10px", ...(props.selectionCount ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}>
                  <Icon size={15} color={ANIM_COLORS[kind]} style={{ flex: "0 0 auto" }} />{ANIM_LABELS[kind]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={props.onAddZone} style={{ ...btn, marginTop: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        title="加一塊看不見的範圍，只有閃光掃過時在裡面亮一下（例如只想讓照片的某一塊發亮）">
        <Sparkles size={14} color="#7c3aed" />加一塊光澤範圍
      </button>

      <div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0 }}>時間軸（拖曳色條調整開始時間；雙擊名稱可以改名）</span>
        {tracks.length > 0 && (
          <button onClick={props.onClearAll} title="拿掉這一頁所有圖層的動畫（可以 ⌘Z 復原）"
            style={{ flex: "0 0 auto", height: 24, padding: "0 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Trash2 size={11} />清除全部
          </button>
        )}
      </div>
      <Timeline duration={duration} tracks={tracks} selectedIds={props.selectedIds} onSelectLayer={props.onSelectLayer}
        onMoveStart={props.onMoveStart} onCommitMove={props.onCommitMove} onRename={props.onRenameTrack} />


      {multi && (
        <button onClick={props.onPreviewAll} disabled={props.exporting}
          style={{ ...btn, marginTop: 14, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Play size={14} color="#7c3aed" />預覽整份影片（{props.pageCount} 頁）
        </button>
      )}
      <button onClick={() => props.onExport(multi)} disabled={props.exporting}
        style={{ ...primary, marginTop: multi ? 8 : 14, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: props.exporting ? 0.7 : 1 }}>
        <Film size={15} />{props.exporting ? `輸出中… ${Math.round(props.progress * 100)}%` : multi ? `下載 MP4（全部 ${props.pageCount} 頁）` : "下載 MP4 影片"}
      </button>
      {multi && !props.exporting && (
        <button onClick={() => props.onExport(false)} style={{ marginTop: 6, border: "none", background: "transparent", color: "#6d28d9", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>只下載這一頁</button>
      )}
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, padding: "6px 2px 0" }}>
        {multi ? "在瀏覽器裡直接輸出，臉書、IG 都能上傳。頁跟頁之間的過場在下方頁面列兩頁中間的小按鈕設定。" : "在瀏覽器裡直接輸出，臉書、IG 都能上傳；只會輸出目前這一頁。"}
      </div>
    </div>
  );
}

const ANIM_COLORS: Record<AnimKind, string> = { shine: "#f59e0b", bounce: "#ec4899", pulse: "#8b5cf6", twinkle: "#06b6d4", float: "#10b981", fadeIn: "#6b7280", popIn: "#f97316", typeIn: "#3b82f6", carousel: "#14b8a6",
  wiggle: "#e11d48", blurIn: "#64748b", stomp: "#b45309", spin: "#0ea5e9" };

/** 每個有動畫的圖層一列，色條是動畫的時間（循環的後面接淡淡的重複）。拖色條改開始時間。 */
function Timeline(props: {
  duration: number; tracks: AnimTrack[]; selectedIds: string[]; onSelectLayer: (id: string) => void;
  onMoveStart: (layerId: string, animId: string, start: number) => void; onCommitMove: () => void;
  onRename: (layerId: string, animId: string, name: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const drag = useRef<{ layerId: string; animId: string; x0: number; s0: number } | null>(null);
  const { duration, tracks } = props;
  if (!tracks.length) return <div style={{ fontSize: 11, color: "#9ca3af", padding: "4px 2px 2px" }}>還沒有圖層有動畫。</div>;
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, w = barRef.current?.clientWidth ?? 1;
    if (!d) return;
    const start = Math.max(0, Math.min(duration - 0.1, Math.round((d.s0 + ((e.clientX - d.x0) / w) * duration) * 10) / 10));
    props.onMoveStart(d.layerId, d.animId, start);
  };
  return (
    <div ref={barRef} onPointerMove={onMove} onPointerUp={() => { if (drag.current) { drag.current = null; props.onCommitMove(); } }}
      style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {tracks.map((tr) => (
        <div key={tr.key}>
          {editing?.key === tr.key ? (
            <input autoFocus onFocus={(e) => e.currentTarget.select()} value={editing.value} maxLength={30} placeholder="清空＝自動取名" aria-label="時間軸列名"
              onChange={(e) => setEditing({ key: tr.key, value: e.target.value })}
              onBlur={() => { props.onRename(tr.id, tr.anims[0].id, editing.value); setEditing(null); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { props.onRename(tr.id, tr.anims[0].id, editing.value); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
              style={{ display: "block", width: "100%", boxSizing: "border-box", height: 22, margin: "1px 0", fontSize: 11, border: "1px solid #c4b5fd", borderRadius: 5, outline: "none", padding: "0 6px" }} />
          ) : (
            <button onClick={() => props.onSelectLayer(tr.id)} onDoubleClick={() => setEditing({ key: tr.key, value: tr.custom ? tr.name : "" })} title="點一下選取；雙擊改名"
              style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "2px 0", fontSize: 11, cursor: "pointer",
                color: props.selectedIds.includes(tr.id) ? "#6d28d9" : "#4b5563", fontWeight: props.selectedIds.includes(tr.id) ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</button>
          )}
          {tr.anims.map((a) => {
            const end = Math.min(duration, animEnd(a));
            const firstEnd = Math.min(duration, a.start + a.duration);
            return (
              <div key={a.id} style={{ position: "relative", height: 14, background: "#f3f4f6", borderRadius: 4, marginBottom: 2 }}>
                {/* 循環的重複部分：淡淡的底 */}
                <div style={{ position: "absolute", left: pct(a.start), width: `calc(${pct(end)} - ${pct(a.start)})`, top: 3, bottom: 3, background: ANIM_COLORS[a.kind], opacity: 0.25, borderRadius: 3 }} />
                <div title={`${ANIM_LABELS[a.kind]}：第 ${a.start} 秒開始（拖曳調整）`}
                  onPointerDown={(e) => { barRef.current?.setPointerCapture(e.pointerId); drag.current = { layerId: tr.id, animId: a.id, x0: e.clientX, s0: a.start }; }}
                  style={{ position: "absolute", left: pct(a.start), width: `max(8px, calc(${pct(firstEnd)} - ${pct(a.start)}))`, top: 0, bottom: 0, background: ANIM_COLORS[a.kind], borderRadius: 4, cursor: "ew-resize" }} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const num: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 30, border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 6px", fontSize: 12 };

/** 右側面板：這個圖層的動畫清單＋每個動畫的細節。 */
/** 輪播裡選到的那一張卡：第幾張、有哪些字、哪些圖。 */
export type CarouselCardInfo = { index: number; total: number; texts: { id: string; text: string; vertical: boolean }[]; images: { id: string; thumb: string | null }[] };

export function LayerAnimSettings(props: {
  anims: LayerAnim[] | undefined; shineOnly?: boolean;
  onChange: (animId: string, patch: Partial<LayerAnim>) => void; onRemove: (animId: string) => void; onAdd: (kind: AnimKind) => void;
  carouselCard?: CarouselCardInfo; library: { url: string; label?: string }[]; uploadFile: (f: File) => Promise<string>;
  onCardText: (layerId: string, value: string) => void; onCardImage: (layerId: string, url: string) => void;
}) {
  const anims = props.anims ?? [];
  const [adding, setAdding] = useState(false);
  // 正在幫這張卡的哪張圖挑新圖
  const [picking, setPicking] = useState<string | null>(null);
  // 哪幾個動畫打開了「自訂」（填過不是預設速度的數字會自動打開）
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const card = props.carouselCard;
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
        <div key={a.id} style={{ border: "1px solid #ede9fe", background: "#faf8ff", borderRadius: 10, padding: 10, marginBottom: 8 }}>
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
