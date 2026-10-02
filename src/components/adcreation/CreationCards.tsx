"use client";
import { useState } from "react";
import { Image as ImageIcon, ArrowRight, Check, Play } from "lucide-react";
import { FreeLayoutIcon } from "@/components/icons/FreeLayoutIcon";
import { IntroVideoModal } from "@/components/intro/MagicLayersIntro";

// 三張創作卡：整張卡可點＋hover 有反應（跟首頁 QuickStartCards 一致），
// 內層 CTA 只作視覺提示（pointer-events-none），實際點擊交給整張卡。
// 版面＝左側文字（約 45%）＋右側示意圖（約 55%，透明 PNG、object-contain 不裁切、不加白底）。
export function CreationCards({
  onNewGenerate,
  onApplyBase,
  onFreeLayout,
}: {
  onNewGenerate: () => void;
  onApplyBase: () => void;
  onFreeLayout: () => void;
}) {
  const cardBase =
    "group relative grid grid-cols-[42fr_58fr] items-stretch gap-3 overflow-hidden rounded-2xl border p-5 text-left transition-all cursor-pointer";
  const leftCol = "flex min-w-0 flex-col";
  const rightCol = "flex min-w-0 items-center justify-center";
  const img = "h-full max-h-72 w-full object-contain";
  const cta =
    "pointer-events-none mt-auto inline-flex self-start items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium";
  const feat = "flex items-center gap-1.5 text-xs text-gray-500";
  const check = "h-3.5 w-3.5 shrink-0 text-violet-500";
  const [intro, setIntro] = useState(false);

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 卡1 全新生成 → 生成類型 popup（淡紫底） */}
      <button
        type="button"
        onClick={onNewGenerate}
        className={`${cardBase} border-[#ebe4f9] bg-[#f9f6ff] hover:border-violet-300 hover:shadow-md`}
      >
        <div className={leftCol}>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">AI</span>
          <div className="text-lg font-semibold text-gray-900">AI 全新生成</div>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">告訴 AI 你想做什麼，直接產生完整圖文。</p>
          <ul className="mt-3 mb-5 space-y-1.5">
            <li className={feat}><Check className={check} />輸入主題或需求</li>
            <li className={feat}><Check className={check} />AI 生成圖文素材</li>
            <li className={feat}><Check className={check} />支援單圖 / 多圖</li>
          </ul>
          <span className={`${cta} bg-violet-600 text-white`}>開始生成 <ArrowRight className="h-4 w-4" /></span>
        </div>
        <div className={rightCol}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/creation/ai.png" alt="AI 全新生成示意" loading="lazy" className={img} />
        </div>
      </button>

      {/* 卡2 使用現有素材 → 從素材庫揀底圖（淡藍底） */}
      <button
        type="button"
        onClick={onApplyBase}
        className={`${cardBase} border-[#e2ecfb] bg-[#f3f8ff] hover:border-violet-300 hover:shadow-md`}
      >
        <div className={leftCol}>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-500"><ImageIcon className="h-5 w-5" /></span>
          <div className="text-lg font-semibold text-gray-900">使用現有素材</div>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">選擇素材庫中的圖片，快速套用文字與內容。</p>
          <ul className="mt-3 mb-5 space-y-1.5">
            <li className={feat}><Check className={check} />從素材庫選擇圖片</li>
            <li className={feat}><Check className={check} />套用文字與版型</li>
            <li className={feat}><Check className={check} />快速產出專業圖文</li>
          </ul>
          <span className={`${cta} border border-[#ebeff5] bg-white text-gray-600 group-hover:border-violet-300 group-hover:text-violet-600`}>選擇素材 <ArrowRight className="h-4 w-4" /></span>
        </div>
        <div className={rightCol}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/creation/material.png" alt="使用現有素材示意" loading="lazy" className={img} />
        </div>
      </button>

      {/* 卡3 自由設計 → 建立精靈（空白/從素材/AI底圖 → 選尺寸 → Magic Layers 編輯器）（淡粉／杏底）
          這張卡用 div＋role=button：右上角的「看介紹」是另一顆按鈕，按鈕裡不能再放按鈕 */}
      <div
        role="button"
        tabIndex={0}
        onClick={onFreeLayout}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFreeLayout(); } }}
        className={`${cardBase} border-[#fbe4ea] bg-[#fff5f7] hover:border-violet-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-violet-500`}
      >
        <div className={leftCol}>
          {/* NEW 標籤放在圖示旁邊（放標題旁邊，卡片窄的時候「自由設計」會被擠成兩行）；動畫上線一兩個月後拿掉 */}
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-500"><FreeLayoutIcon className="h-5 w-5" /></span>
            <span className="whitespace-nowrap rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold leading-none tracking-wide text-white">NEW 動畫</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">自由設計</div>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">自由排版圖文與素材，還能讓每個元素動起來。</p>
          <ul className="mt-3 mb-5 space-y-1.5">
            <li className={feat}><Check className={check} />拖曳排版、加文字素材</li>
            <li className={`${feat} font-medium text-violet-700`}><Check className={check} />每個元素都能加動畫</li>
            <li className={feat}><Check className={check} />下載圖片或 MP4</li>
          </ul>
          <span className={`${cta} whitespace-nowrap border border-[#ebeff5] bg-white text-gray-600 group-hover:border-violet-300 group-hover:text-violet-600`}>開啟編輯器 <ArrowRight className="h-4 w-4" /></span>
        </div>
        <div className={rightCol}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/creation/freelayout.png" alt="自由設計示意" loading="lazy" className={img} />
        </div>
        {/* 右上角「看介紹」：點它只開影片，不觸發整張卡 */}
        <button type="button" onClick={(e) => { e.stopPropagation(); setIntro(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); /* 只擋會觸發卡片的鍵，Esc 要讓影片視窗收到 */ }}
          title="看 38 秒介紹影片：一張圖，設計到動畫"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#fbd5df] bg-white/90 py-1 pl-1 pr-2.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur hover:border-violet-300 hover:text-violet-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white"><Play className="ml-px h-2.5 w-2.5" fill="currentColor" /></span>
          看介紹（38 秒）
        </button>
      </div>
      <IntroVideoModal open={intro} onClose={() => setIntro(false)} onTry={onFreeLayout} tryLabel="開啟編輯器" />
    </div>
  );
}
