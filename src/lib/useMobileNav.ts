"use client";
import { useSyncExternalStore, useCallback } from "react";

/**
 * 手機版導覽抽屉的開關。
 *
 * 跟 useSidebarCollapsed 刻意分開：
 * - sidebarCollapsed 是「桌機的偏好」，要記在 localStorage
 * - 抽屉是「當下的動作」，重新載入頁面本來就該是關著的，所以只存在記憶體
 *
 * 用 module 層變數 + 事件（跟 useSidebarCollapsed 同一套模式），
 * TopHeader 的按鈕與 Sidebar 的抽屉就能共用狀態，不需要多包一層 context。
 */
const EVT = "mobile-nav-change";
let open = false;

function subscribe(callback: () => void) {
  window.addEventListener(EVT, callback);
  return () => window.removeEventListener(EVT, callback);
}

const read = () => open;
/** SSR 一律回 false，避免 hydration 落差。 */
const readServer = () => false;

function emit() {
  window.dispatchEvent(new Event(EVT));
}

export function useMobileNav(): { open: boolean; toggle: () => void; close: () => void } {
  const isOpen = useSyncExternalStore(subscribe, read, readServer);
  const toggle = useCallback(() => { open = !open; emit(); }, []);
  const close = useCallback(() => { if (open) { open = false; emit(); } }, []);
  return { open: isOpen, toggle, close };
}
