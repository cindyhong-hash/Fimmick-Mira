"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Magic Layers 編輯器要滿版（自己管理捲動/縮放），去掉外層 padding 讓它貼齊側邊欄與頂部。
  const fullBleed = !!pathname && pathname.includes("/magic-layers/compose");
  // 編輯器頁的外框要「剛好」一個螢幕高（h-dvh），不能是「最少」一個螢幕高（min-h-screen）：
  // 不然左欄內容一多就把整頁撐高，右欄跟著變長、圖層區被推到螢幕外面。
  // 固定之後左右兩欄各自在裡面捲動，互不影響。
  return (
    <div className={fullBleed ? "flex h-dvh overflow-hidden bg-gray-50" : "flex min-h-screen bg-gray-50"}>
      <Sidebar />
      <div className={fullBleed ? "flex min-h-0 min-w-0 flex-1 flex-col" : "flex min-w-0 flex-1 flex-col"}>
        <TopHeader />
        <main className={fullBleed ? "min-h-0 flex-1 overflow-hidden" : "flex-1 overflow-auto p-4 sm:p-8"}>{children}</main>
      </div>
    </div>
  );
}
