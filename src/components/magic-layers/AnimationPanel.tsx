"use client";
/* ============================================================
   自由畫布「動畫」的介面：
   ・AnimationTab：左側「動畫」分頁（影片長度、播放／拖時間、套用效果、光澤範圍、時間軸、下載 MP4）
   ・LayerAnimSettings：右側面板裡，選到的圖層有哪些動畫、每個動畫的細節
   只負責畫面與回呼；圖層怎麼改、怎麼畫、怎麼輸出都在編輯器（MagicLayersEditor）裡。
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles, Trash2, Film, Plus } from "lucide-react";
import { ANIM_LABELS, animEnd, isOneShot, TYPE_STYLES, type AnimKind, type LayerAnim, type ShineDirection, type TypeStyle } from "@/lib/magic-layers/layer-animation.ts";

const KINDS: { kind: AnimKind; hint: string }[] = [
  { kind: "shine", hint: "一道光從物件上掃過去；選好幾個會一個接一個閃" },
  { kind: "bounce", hint: "往上彈一下再落回來；選好幾個會依序彈" },
  { kind: "pulse", hint: "輕輕放大再縮回，一直重複" },
  { kind: "twinkle", hint: "忽明忽暗，適合星星、小裝飾" },
  { kind: "float", hint: "上下輕輕飄，適合商品" },
  { kind: "fadeIn", hint: "開場時慢慢出現" },
  { kind: "popIn", hint: "從無到有「啵」一下冒出來；選好幾個會一個接一個出現，適合圖示、標籤" },
  { kind: "typeIn", hint: "文字一個字一個字出現（打字、淡入、彈出、飛入）；選好幾段字會一段接一段" },
];

const TYPE_STYLE_LABELS: Record<TypeStyle, string> = { type: "打字", fade: "淡入", pop: "彈出", slide: "飛入" };

const btn: React.CSSProperties = { height: 34, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" };
const primary: React.CSSProperties = { ...btn, border: "none", background: "#7c3aed", color: "#fff" };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "12px 2px 6px" };

/** key：這一列自己的代號（同一個圖層可能出現在好幾列，id 會重複，React 列表要用 key）。 */
export type AnimTrack = { key: string; id: string; name: string; anims: LayerAnim[] };

export function AnimationTab(props: {
  getDuration: () => number; autoDuration: boolean; onDuration: (d: number | null) => void;
  playing: boolean; getTime: () => number | null; onPlay: () => void; onPause: () => void; onSeek: (t: number) => void;
  selectionCount: number; onApply: (kind: AnimKind) => void; onAddZone: () => void;
  getTracks: () => AnimTrack[]; selectedIds: string[]; onSelectLayer: (id: string) => void;
  onMoveStart: (layerId: string, animId: string, start: number) => void; onCommitMove: () => void;
  onExport: () => void; exporting: boolean; progress: number;
}) {
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
        先在畫布上選圖層（可以拉框選好幾個），再點下面的效果；細節在右側面板調。
      </div>

      <div style={label}>影片長度</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[3, 6, 10].map((d) => (
          <button key={d} onClick={() => props.onDuration(d)}
            style={{ ...btn, flex: 1, ...(!props.autoDuration && duration === d ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>{d} 秒</button>
        ))}
        <button onClick={() => props.onDuration(null)} title="照動畫自動決定"
          style={{ ...btn, flex: 1, ...(props.autoDuration ? { border: "1px solid #7c3aed", color: "#6d28d9", background: "#f5f3ff" } : {}) }}>自動</button>
      </div>

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {KINDS.map(({ kind, hint }) => (
          <button key={kind} onClick={() => props.onApply(kind)} disabled={!props.selectionCount} title={props.selectionCount ? hint : "先在畫布上選一個圖層"}
            style={{ ...btn, ...(props.selectionCount ? {} : { opacity: 0.45, cursor: "not-allowed" }) }}>
            {ANIM_LABELS[kind]}
          </button>
        ))}
      </div>
      <button onClick={props.onAddZone} style={{ ...btn, marginTop: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        title="加一塊看不見的範圍，只有閃光掃過時在裡面亮一下（例如只想讓照片的某一塊發亮）">
        <Sparkles size={14} color="#7c3aed" />加一塊光澤範圍
      </button>

      <div style={label}>時間軸（拖曳色條調整開始時間）</div>
      <Timeline duration={duration} tracks={tracks} selectedIds={props.selectedIds} onSelectLayer={props.onSelectLayer}
        onMoveStart={props.onMoveStart} onCommitMove={props.onCommitMove} />

      <button onClick={props.onExport} disabled={props.exporting}
        style={{ ...primary, marginTop: 14, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: props.exporting ? 0.7 : 1 }}>
        <Film size={15} />{props.exporting ? `輸出中… ${Math.round(props.progress * 100)}%` : "下載 MP4 影片"}
      </button>
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, padding: "6px 2px 0" }}>在瀏覽器裡直接輸出，臉書、IG 都能上傳；只會輸出目前這一頁。</div>
    </div>
  );
}

const ANIM_COLORS: Record<AnimKind, string> = { shine: "#f59e0b", bounce: "#ec4899", pulse: "#8b5cf6", twinkle: "#06b6d4", float: "#10b981", fadeIn: "#6b7280", popIn: "#f97316", typeIn: "#3b82f6" };

/** 每個有動畫的圖層一列，色條是動畫的時間（循環的後面接淡淡的重複）。拖色條改開始時間。 */
function Timeline(props: {
  duration: number; tracks: AnimTrack[]; selectedIds: string[]; onSelectLayer: (id: string) => void;
  onMoveStart: (layerId: string, animId: string, start: number) => void; onCommitMove: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
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
          <button onClick={() => props.onSelectLayer(tr.id)}
            style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "2px 0", fontSize: 11, cursor: "pointer",
              color: props.selectedIds.includes(tr.id) ? "#6d28d9" : "#4b5563", fontWeight: props.selectedIds.includes(tr.id) ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</button>
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
export function LayerAnimSettings(props: {
  anims: LayerAnim[] | undefined; shineOnly?: boolean;
  onChange: (animId: string, patch: Partial<LayerAnim>) => void; onRemove: (animId: string) => void; onAdd: (kind: AnimKind) => void;
}) {
  const anims = props.anims ?? [];
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ margin: "14px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
        <Film size={14} color="#7c3aed" style={{ marginRight: 6 }} />動畫
        <button onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto", ...btn, height: 26, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 3 }}><Plus size={12} />加效果</button>
      </div>
      {props.shineOnly && <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginBottom: 6 }}>這是一塊「光澤範圍」：輸出時看不見，只有閃光掃過時在這個形狀裡亮一下。</div>}
      {adding && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
          {KINDS.map(({ kind }) => <button key={kind} onClick={() => { props.onAdd(kind); setAdding(false); }} style={{ ...btn, height: 28, fontSize: 11 }}>{ANIM_LABELS[kind]}</button>)}
        </div>
      )}
      {!anims.length && !adding && <div style={{ fontSize: 11, color: "#9ca3af" }}>沒有動畫。可以在左側「動畫」分頁套用，或按「加效果」。</div>}
      {anims.map((a) => (
        <div key={a.id} style={{ border: "1px solid #ede9fe", background: "#faf8ff", borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: ANIM_COLORS[a.kind], marginRight: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{ANIM_LABELS[a.kind]}</span>
            <button onClick={() => props.onRemove(a.id)} title="拿掉這個動畫" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af" }}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Field label="開始（秒）"><input type="number" min={0} max={30} step={0.1} value={a.start} onChange={(e) => props.onChange(a.id, { start: Math.max(0, Number(e.target.value) || 0) })} style={num} /></Field>
            <Field label={a.kind === "typeIn" ? "整段跑完（秒）" : isOneShot(a.kind) ? "多久（秒）" : "一輪（秒）"}><input type="number" min={0.1} max={10} step={0.1} value={a.duration} onChange={(e) => props.onChange(a.id, { duration: Math.max(0.1, Number(e.target.value) || 0.1) })} style={num} /></Field>
            {!isOneShot(a.kind) && (<>
              <Field label="每輪間隔（秒）"><input type="number" min={0} max={10} step={0.1} value={a.gap} onChange={(e) => props.onChange(a.id, { gap: Math.max(0, Number(e.target.value) || 0) })} style={num} /></Field>
              <Field label="重複（0＝一直）"><input type="number" min={0} max={50} step={1} value={a.repeat} onChange={(e) => props.onChange(a.id, { repeat: Math.max(0, Math.round(Number(e.target.value) || 0)) })} style={num} /></Field>
            </>)}
          </div>
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
          {a.kind !== "fadeIn" && !(a.kind === "typeIn" && (a.typeStyle === "type" || a.typeStyle === "fade")) && (
            <Field label={`${a.kind === "typeIn" && (a.typeStyle ?? "slide") === "slide" ? "飛入距離" : a.kind === "popIn" || a.kind === "typeIn" ? "彈的力道" : "強度"} ${Math.round(a.intensity * 100)}%`}>
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
