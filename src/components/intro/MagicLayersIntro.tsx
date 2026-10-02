"use client";
/* ============================================================
   Magic Layers 介紹影片（38 秒）：三個入口共用一個播放視窗。
   ・首頁：上線後每個人第一次進來跳一次「新功能」公告（看過／關掉就不再跳）
   ・建立圖文「自由設計」卡片：▶ 看介紹（隨時可以再看）
   ・編輯器第一次打開：角落一個小提示，點了才播
   影片預設靜音自動播放（畫面上本來就有字幕），要聲音自己按播放器的喇叭。
   ============================================================ */
import { useEffect, useState } from "react";
import { ArrowRight, Play, X } from "lucide-react";

export const INTRO_VIDEO = "/videos/magic-layers-intro.mp4";
export const INTRO_POSTER = "/videos/magic-layers-intro.jpg";
/** 換新版影片時改版號，大家就會再看到一次公告。 */
const ANNOUNCE_KEY = "mira.intro.magicLayers.v1.announced";
const EDITOR_HINT_KEY = "mira.intro.magicLayers.v1.editorHint";
/** 「立即試試」跳去建立圖文頁時，叫那一頁直接打開自由設計精靈（用 sessionStorage 傳：換頁時網址參數不一定讀得到）。 */
export const OPEN_FREE_WIZARD_KEY = "mira.openFreeWizard";

const seen = (key: string) => { try { return window.localStorage.getItem(key) === "1"; } catch { return true; } };
const markSeen = (key: string) => { try { window.localStorage.setItem(key, "1"); } catch { /* 私密模式存不了：下次再跳一次也沒關係 */ } };

export function IntroVideoModal({ open, onClose, onTry, tryLabel = "立即試試" }: {
  open: boolean; onClose: () => void;
  /** 影片下面的主按鈕；不給就只有「關閉」。 */
  onTry?: () => void; tryLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Magic Layers 介紹影片">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button onClick={onClose} aria-label="關閉"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60">
          <X className="h-4 w-4" />
        </button>
        <video src={INTRO_VIDEO} poster={INTRO_POSTER} autoPlay muted playsInline controls preload="metadata"
          className="block aspect-video w-full bg-[#f6f6f8]" />
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="mr-auto min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-violet-600">新功能・自由設計</div>
            <div className="text-base font-semibold text-gray-900">一張圖，設計到動畫</div>
            <div className="mt-0.5 text-xs text-gray-500">上傳參考圖拆成圖層、每一層加動畫、下載成 MP4。影片預設靜音，按喇叭可以開聲音。</div>
          </div>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100">之後再看</button>
          {onTry && (
            <button onClick={() => { onClose(); onTry(); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
              {tryLabel} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 首頁：上線後每個人第一次進來跳一次。
 * 新品牌第一次進來會先跑 6 步導覽（TopHeader 的 tourSeen:<clientId>），兩個疊在一起會很亂：
 * 導覽還沒跑完就先不跳，等下次進首頁再說。
 */
export function IntroAnnouncement({ clientId, onTry }: { clientId: string; onTry: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // 等首頁先畫出來再跳，不要一進來就整個擋住
    const t = window.setTimeout(() => { if (!seen(ANNOUNCE_KEY) && seen(`tourSeen:${clientId}`)) setOpen(true); }, 800);
    return () => window.clearTimeout(t);
  }, [clientId]);
  const close = () => { markSeen(ANNOUNCE_KEY); setOpen(false); };
  return <IntroVideoModal open={open} onClose={close} onTry={onTry} />;
}

/** 編輯器：第一次打開時角落一個小提示，點了才播。 */
export function EditorIntroHint() {
  const [show, setShow] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => { if (!seen(EDITOR_HINT_KEY)) setShow(true); }, 1200);
    return () => window.clearTimeout(t);
  }, []);
  const dismiss = () => { markSeen(EDITOR_HINT_KEY); setShow(false); };
  return (
    <>
      {show && (
        <div className="fixed bottom-[118px] left-[96px] z-[80] flex items-center gap-2 rounded-xl border border-violet-100 bg-white py-2 pl-2 pr-1.5 shadow-lg">
          <button onClick={() => { dismiss(); setPlaying(true); }} className="flex items-center gap-2 rounded-lg px-1 text-left hover:bg-violet-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white"><Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" /></span>
            <span className="pr-1">
              <span className="block text-[13px] font-semibold text-gray-800">第一次用？</span>
              <span className="block text-xs text-gray-500">看 38 秒介紹</span>
            </span>
          </button>
          <button onClick={dismiss} aria-label="不用了" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
      )}
      <IntroVideoModal open={playing} onClose={() => setPlaying(false)} />
    </>
  );
}
