"use client";
import { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeft, PanelLeftOpen, X } from "lucide-react";
import { BrandSwitcher } from "./BrandSwitcher";
import { SidebarNav } from "./SidebarNav";
import { SidebarUser } from "./SidebarUser";
import { getLastClientId } from "@/lib/lastClient";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import { useMobileNav } from "@/lib/useMobileNav";

const noopSubscribe = () => () => {};

export function Sidebar() {
  const pathname = usePathname();
  const m = pathname.match(/^\/clients\/([^/]+)/);
  const pathClientId = m && m[1] !== "new" ? m[1] : null;
  // 路徑沒有品牌（如 /magic-layers、/clients 清單）→ 退回「上次品牌」，
  // 讓側欄 nav 不會整個空掉（例：從品牌首頁點自由排版進 magic-layers）。
  // useSyncExternalStore：SSR 回 null、client mount 後讀 localStorage，無 hydration 落差。
  const lastId = useSyncExternalStore(noopSubscribe, getLastClientId, () => null);
  const clientId = pathClientId ?? lastId;
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const { open: navOpen, close: closeNav } = useMobileNav();

  // Esc 關閉抽屉。只掛事件、不在 effect 裡改 state（實際 setState 由使用者按鍵觸發）。
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeNav(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  // 手機抽屉：完整文字導覽（比 64px 圖示欄好懂），點任一連結就關。
  const drawer = (
    <div className="sm:hidden">
      {navOpen && (
        <>
          <button
            type="button"
            aria-label="關閉導覽"
            onClick={closeNav}
            className="fixed inset-0 z-40 cursor-default bg-gray-950/40"
          />
          <div role="dialog" aria-modal="true" aria-label="導覽" className="fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[82vw] flex-col overflow-y-auto border-r border-gray-200 bg-white p-4">
            <div className="mb-6 flex items-center justify-between px-1">
              <Image src="/mira-logo.png" alt="MIRA" width={399} height={96} priority className="h-6 w-auto" />
              <button type="button" onClick={closeNav} aria-label="關閉導覽" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            {clientId && (
              // 點連結後關抽屉：用容器攔 click，不必改 SidebarNav 的 props。
              <div onClick={closeNav}>
                <div className="mb-4"><BrandSwitcher currentClientId={clientId} /></div>
                <SidebarNav currentClientId={clientId} />
              </div>
            )}
            <div className="mt-auto" onClick={closeNav}><SidebarUser /></div>
          </div>
        </>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <>
      {drawer}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center self-start overflow-y-auto border-r border-gray-200 bg-white p-4 sm:flex">
        <Image
          src="/mira-mark.png"
          alt="MIRA"
          width={125}
          height={64}
          priority
          className="mb-5 w-8"
        />
        <button
          type="button"
          onClick={toggleCollapsed}
          title="展開側欄"
          className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        {clientId && <SidebarNav currentClientId={clientId} collapsed />}
        <div className="mt-auto"><SidebarUser collapsed /></div>
      </aside>
      </>
    );
  }

  // 合併 main 的固定側欄（sticky/h-screen/self-start）＋ MIRA logo，
  // 與 codex 的手機版窄欄（w-16 → sm:w-[220px]）。
  // 手機版扣掉內距只剩 32px，放不下 logo 與收合鈕，沿用 codex 對文字的做法：小螢幕隱藏 logo。
  return (
    <>
    {drawer}
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col self-start overflow-y-auto border-r border-gray-200 bg-white p-4 sm:flex">
      <div className="mb-6 flex items-center justify-between px-1">
        <Image
          src="/mira-logo.png"
          alt="MIRA"
          width={399}
          height={96}
          priority
          className="h-6 w-auto"
        />
        <button
          type="button"
          onClick={toggleCollapsed}
          title="收合側欄"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>
      {clientId && (
        <>
          <div className="mb-4"><BrandSwitcher currentClientId={clientId} /></div>
          <SidebarNav currentClientId={clientId} />
        </>
      )}
      <div className="mt-auto"><SidebarUser /></div>
    </aside>
    </>
  );
}
