"use client";
import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Image as ImageIcon, ChevronRight, Sparkles } from "lucide-react";
import { FreeLayoutWizard } from "@/components/adcreation/FreeLayoutWizard";

export function QuickStartCards({ clientId }: { clientId: string }) {
  // 「AI 幫我設計」不是換頁：直接打開選擇視窗（照參考圖重做／描述背景生成），後面沿用建立圖文的流程
  const [showAiDesign, setShowAiDesign] = useState(false);
  const cards: { title: string; sub: string; icon: typeof ShoppingBag; href?: string; onClick?: () => void; tint: string; preview: string }[] = [
    { title: "社群圖+文", sub: "單圖 / 多圖，一次完成圖文", icon: ShoppingBag, href: `/clients/${clientId}/activities/new`, tint: "bg-[#fff0f6] text-pink-500", preview: "/quickstart/ad.png" },
    { title: "商品情境", sub: "一個產品，快速生成整套商品素材", icon: ImageIcon, href: `/clients/${clientId}/components?tab=products&new=1`, tint: "bg-[#e6f7ff] text-blue-500", preview: "/quickstart/scene.png" },
    { title: "AI 幫我設計", sub: "選擇一種開始方式，AI 完成後仍可進入畫布自由調整", icon: Sparkles, onClick: () => setShowAiDesign(true), tint: "bg-[#ecdfff] text-violet-600", preview: "/quickstart/ai-design.webp" },
  ];
  return (
    <section data-tour="home-quickstart">
      <h2 className="mb-4 text-base font-semibold text-gray-900">開始創作</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <CardShell key={c.title} href={c.href} onClick={c.onClick}>
            {/* 標題列：icon + 標題/副標 + 箭頭 */}
            <div className="flex items-center gap-3">
              <span className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full ${c.tint}`}>
                <c.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-gray-900">{c.title}</div>
                <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">{c.sub}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-[#f3e8ff] text-violet-600 transition-colors group-hover:bg-violet-200">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            {/* 預覽圖：依原圖比例、滿版寬度、不裁切不變形 */}
            <div className="w-full overflow-hidden rounded-xl bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.preview} alt="" loading="lazy" className="block h-auto w-full" />
            </div>
          </CardShell>
        ))}
      </div>
      {showAiDesign && <FreeLayoutWizard clientId={clientId} startAt="aiChoice" onClose={() => setShowAiDesign(false)} />}
    </section>
  );
}

/** 卡片外殼：有網址就是連結，沒有就是按鈕（打開視窗），外觀一樣。 */
function CardShell({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls = "group flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#ebebeb] bg-white px-5 pb-3 pt-4 text-left transition-all hover:border-violet-300 hover:shadow-sm";
  return href
    ? <Link href={href} className={cls}>{children}</Link>
    : <button type="button" onClick={onClick} className={cls}>{children}</button>;
}
