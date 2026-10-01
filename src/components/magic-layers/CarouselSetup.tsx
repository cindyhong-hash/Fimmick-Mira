"use client";
/* ============================================================
   「做成輪播」的設定視窗：只選了一張卡時跳出來。
   先選要幾張，再逐張決定每一段字要寫什麼、每張圖要換成哪張（素材庫挑或從電腦上傳）；
   沒改的就沿用第 1 張。真正複製、排版、換圖在編輯器（buildCarousel）做。
   ============================================================ */
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { ImageLibraryPicker } from "./ImageLibraryPicker";

export type CarouselPart = { id: string; label: string; thumb: string | null };

/** 一字一行的直排字（「管／不／住／嘴」）：輸入框裡當一行打，建立時再轉回一字一行。 */
export const isVerticalText = (t: string) => { const lines = t.split("\n"); return lines.length > 1 && lines.every((l) => [...l].length <= 1); };
export const toVertical = (t: string) => [...t.replace(/\n/g, "")].join("\n");
/** 每一張卡的內容：texts[圖層 id]＝這段字；images[圖層 id]＝換成這張圖的網址（沒有＝用原本的）。 */
export type CarouselCardContent = { texts: Record<string, string>; images: Record<string, string> };

const btn: React.CSSProperties = { height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" };

export function CarouselSetup(props: {
  texts: CarouselPart[]; images: CarouselPart[];
  library: { url: string; label?: string }[];
  uploadFile: (f: File) => Promise<string>;
  onCancel: () => void; onConfirm: (cards: CarouselCardContent[]) => void;
}) {
  // 直排字在輸入框裡顯示成一行；其他有換行的字用多行框
  const shown = (label: string) => (isVerticalText(label) ? label.replace(/\n/g, "") : label);
  const blank = (): CarouselCardContent => ({ texts: Object.fromEntries(props.texts.map((t) => [t.id, shown(t.label)])), images: {} });
  const [cards, setCards] = useState<CarouselCardContent[]>(() => [blank(), blank(), blank(), blank()]);
  // 目前打開挑圖的是哪一張卡的哪張圖
  const [picking, setPicking] = useState<{ card: number; image: string } | null>(null);

  const setCount = (n: number) => {
    const k = Math.min(10, Math.max(2, Math.round(n) || 2));
    setCards((cs) => (k > cs.length ? [...cs, ...Array.from({ length: k - cs.length }, blank)] : cs.slice(0, k)));
    setPicking((p) => (p && p.card >= k ? null : p));
  };
  const patch = (i: number, fn: (c: CarouselCardContent) => CarouselCardContent) => setCards((cs) => cs.map((c, k) => (k === i ? fn(c) : c)));
  const pickImage = (url: string) => {
    if (!picking) return;
    patch(picking.card, (c) => ({ ...c, images: { ...c.images, [picking.image]: url } }));
    setPicking(null);
  };

  return (
    <div onClick={props.onCancel} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") props.onCancel(); }}
        style={{ width: "min(560px, 100%)", maxHeight: "86vh", background: "#fff", borderRadius: 14, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px 10px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>做成輪播</div>
          <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, marginTop: 4 }}>
            會把這張卡複製成一排，播放時一格一格往左滑、停在最後一張。下面逐張改字、換圖；沒改的就跟第 1 張一樣。
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginTop: 10 }}>
            總共要幾張卡
            <input type="number" min={2} max={10} value={cards.length} aria-label="輪播卡片張數" onChange={(e) => setCount(Number(e.target.value))}
              style={{ width: 64, height: 32, border: "1px solid #c4b5fd", borderRadius: 8, padding: "0 8px", fontSize: 14 }} />
            張
          </label>
        </div>

        <div style={{ overflowY: "auto", padding: "10px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ border: "1px solid #ede9fe", background: i === 0 ? "#faf8ff" : "#fff", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>第 {i + 1} 張{i === 0 ? "（一開始在中間）" : ""}</div>
              {props.texts.map((t) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 70, flex: "0 0 auto", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.label}>{isVerticalText(t.label) ? `${shown(t.label)}（直排）` : t.label.replace(/\s+/g, " ")}</span>
                  {t.label.includes("\n") && !isVerticalText(t.label) ? (
                    <textarea value={c.texts[t.id] ?? ""} aria-label={`第 ${i + 1} 張的「${t.label}」`} rows={Math.min(4, t.label.split("\n").length)}
                      onChange={(e) => { const v = e.target.value; patch(i, (x) => ({ ...x, texts: { ...x.texts, [t.id]: v } })); }}
                      style={{ flex: 1, minWidth: 0, border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                  ) : (
                    <input value={c.texts[t.id] ?? ""} aria-label={`第 ${i + 1} 張的「${t.label}」`} placeholder={isVerticalText(t.label) ? "直排字，照常打一行" : undefined}
                      onChange={(e) => { const v = e.target.value; patch(i, (x) => ({ ...x, texts: { ...x.texts, [t.id]: v } })); }}
                      style={{ flex: 1, minWidth: 0, height: 30, border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 8px", fontSize: 13 }} />
                  )}
                </label>
              ))}
              {props.images.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                  {props.images.map((im, k) => {
                    const chosen = c.images[im.id];
                    const on = picking?.card === i && picking.image === im.id;
                    return (
                      <button key={im.id} type="button" onClick={() => setPicking(on ? null : { card: i, image: im.id })} title="點一下換圖"
                        aria-label={`第 ${i + 1} 張換${props.images.length > 1 ? `第 ${k + 1} 張` : ""}圖`}
                        style={{ width: 64, height: 64, padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative", background: "#f3f4f6",
                          border: on ? "2px solid #7c3aed" : chosen ? "2px solid #a78bfa" : "1px solid #e5e7eb" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {(chosen || im.thumb) ? <img src={chosen || im.thumb!} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /> : <ImageIcon size={18} color="#9ca3af" />}
                        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(17,24,39,.6)", padding: "1px 0" }}>{chosen ? "已換圖" : "換圖"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {picking?.card === i && (
                <div style={{ marginTop: 8 }}>
                  <ImageLibraryPicker library={props.library} uploadFile={props.uploadFile} onPick={pickImage}
                    onReset={c.images[picking.image] ? () => { const id = picking.image; patch(i, (x) => { const images = { ...x.images }; delete images[id]; return { ...x, images }; }); setPicking(null); } : undefined} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid #f3f4f6" }}>
          <button onClick={props.onCancel} style={btn}>取消</button>
          <button onClick={() => props.onConfirm(cards)}
            style={{ ...btn, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700 }}>建立 {cards.length} 張</button>
        </div>
      </div>
    </div>
  );
}
