"use client";
/* ============================================================
   挑一張圖：品牌素材庫的縮圖格＋「從電腦上傳」。
   輪播設定視窗、右側「換一張圖」共用；挑好就回傳圖片網址，怎麼用由呼叫的人決定。
   ============================================================ */
import { useRef, useState } from "react";
import { Upload, RotateCcw } from "lucide-react";

const btn: React.CSSProperties = { height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" };

export function ImageLibraryPicker(props: {
  library: { url: string; label?: string }[];
  uploadFile: (f: File) => Promise<string>;
  onPick: (url: string) => void;
  /** 有給就多一顆「用原本的圖」。 */
  onReset?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Upload size={13} />{uploading ? "上傳中…" : "從電腦上傳"}
        </button>
        {props.onReset && (
          <button type="button" onClick={props.onReset} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 4 }}><RotateCcw size={13} />用原本的圖</button>
        )}
      </div>
      {props.library.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {props.library.map((b) => (
            <button key={b.url} type="button" onClick={() => props.onPick(b.url)} title={b.label || "素材"}
              style={{ aspectRatio: "1", padding: 0, border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", cursor: "pointer", background: "#f9fafb" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.url} alt={b.label || ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      ) : <div style={{ fontSize: 11, color: "#9ca3af" }}>素材庫目前沒有圖片，可以從電腦上傳。</div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setUploading(true);
          try { props.onPick(await props.uploadFile(f)); }
          catch (err) { alert("上傳失敗：" + (err instanceof Error ? err.message : String(err))); }
          finally { setUploading(false); }
        }} />
    </div>
  );
}
