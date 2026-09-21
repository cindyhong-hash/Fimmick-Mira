/**
 * 側邊欄寬度只定義在這裡。
 *
 * 表單底部那條「送出」列是 `fixed`（外層 <main> 是 overflow-auto，sticky 會失效），
 * 所以它必須自己知道要從哪裡開始，才不會蓋到側邊欄。原本寫死 `left-60`（240px），
 * 但側邊欄實際是 220px，中間就空出 20px 的灰縫——白色底看起來斷掉。
 * 收合成 64px 時縫變成 176px，手機版側邊欄整個收起來時更是差 240px。
 *
 * 寫死的數字一定會跟實際寬度走散，所以兩邊都從這裡取。
 */

/** 展開時的側邊欄寬度。 */
export const SIDEBAR_WIDTH_CLASS = "w-[220px]";
/** 收合時的側邊欄寬度（只剩圖示）。 */
export const SIDEBAR_COLLAPSED_WIDTH_CLASS = "w-16";

/**
 * 固定定位元素要對齊內容區左緣時用的 class。
 *
 * 小於 sm 的時候側邊欄是 `hidden`（改用抽屜），內容從 0 開始，所以先給 left-0
 * 再用 sm: 覆寫——只寫 sm 以上的值會讓手機版左邊空一大塊。
 */
export function sidebarOffsetClass(collapsed: boolean): string {
  return collapsed ? "left-0 sm:left-16" : "left-0 sm:left-[220px]";
}
