"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Magic Layers 編輯器要滿版（自己管理捲動/縮放），去掉外層 padding 讓它貼齊側邊欄與頂部。
  const fullBleed = !!pathname && pathname.includes("/magic-layers/compose");
  return (
    // h-screen（唔係 min-h-screen）：外殼高度鎖死一個視窗，捲動交俾下面個 <main>。
    // 原本用 min-h-screen，成個 shell 會跟住內容長高 → 捲嘅係 body，側邊欄同頂欄都會捲走，
    // 而 <main> 上面個 overflow-auto 因為父層冇高度限制，其實一直冇生效（死 class）。
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <main className={fullBleed ? "min-h-0 flex-1 overflow-auto" : "min-h-0 flex-1 overflow-auto p-8"}>{children}</main>
      </div>
    </div>
  );
}
