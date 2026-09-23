/* ============================================================
   /magic-layers

   這裡本來是開發時用的獨立 demo 入口（上傳圖片／Mock／真實 AI 三條路徑），
   沒有任何地方連過來，卻長得跟產品其他頁完全不一樣，打開會讓人以為走錯站。
   改成轉回品牌列表；要用編輯器一律走
   /clients/[clientId]/magic-layers/compose。

   舊的 demo 頁在 git 記錄裡（刪除前最後一版：fc497d1）。
   ============================================================ */
import { redirect } from "next/navigation";

export default function MagicLayersPage() {
  redirect("/clients");
}
