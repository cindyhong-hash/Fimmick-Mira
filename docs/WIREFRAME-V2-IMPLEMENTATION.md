# Wireframe v2 UI 重構 — 實作紀錄

> 依 `wireframes/marketing-tool-wireframes-v2.html` 將「品牌／活動」+「素材庫」重組成統一體驗。
> 緊接喺「同事功能 merge」（見 `docs/MERGE-MAP.md`）之後嘅一輪。實作日期：2026-06-23～24。
> 配套：`docs/INTEGRATION_ROADMAP.md`（文字版規格）、`docs/MERGE-MAP.md`（同事 merge 對照）。

---

## 0. 一句總結

素材庫由「獨立全域頁」變成「**每個品牌工作區內嘅一個 tab**」；側欄淨列品牌；生成入口收攏成單一「新增產品／素材圖片」融合彈窗；全部生成彈窗統一置中。**所有現有生成／分析功能原封保留**，只改 IA／導覽／入口。

---

## 1. 資訊架構（IA）改動

- **統一側欄**（`components/layout/Sidebar.tsx`）：淨列品牌（標題「品牌」），底部加「未分組素材」入口。移除咗舊「素材庫」全域連結同 `/library` 隱藏邏輯。
- **巢狀路由品牌工作區**：
  - `/clients/[id]` = **廣告活動圖** tab（活動列表 + 品牌記憶卡）
  - `/clients/[id]/components` = **素材庫** tab（前稱「風格組件」，brand-scoped）
  - `/clients/[id]/settings` = **品牌設定**（2-tab）
- **統一 header**（`components/layout/BrandWorkspaceHeader.tsx`）：左 switch-tab `[廣告活動圖 | 素材庫]`，右上動作掣 `[品牌設定][上傳參考圖][新增產品／素材圖片]`（品牌設定固定喺最左）。
- `/library` → `redirect("/clients")`（全域「全部」庫已取消）。
- **未分組**（`/unassigned`）：收 `clientId = null` 嘅素材（取消「全部」後嘅落腳點）。API 加 `?unassigned=1`。

---

## 2. 對 wireframe 各節

| Wireframe 節 | 實作 | 主要檔案 |
|---|---|---|
| ③ 統一側欄＋switch-tab | ✅ 巢狀路由 + 統一 header | Sidebar / BrandWorkspaceHeader |
| ④⑤ 品牌記憶卡 | ✅ BRAND GUIDELINES（色票+語調）+ NEGATIVE PROMPTS（taboos）；色底 pill 自動對比；`items-start` 自然高度 | clients/BrandMemoryCards.tsx |
| ⑤ 廣告活動圖 | ✅ 活動列表（同事版）+ 統一 header | clients/[id]/page.tsx |
| ⑥ 素材庫（search/filter） | ✅ 搜尋 + 引擎 filter + 排序 pill；分類 pill；移除頂部分段控制 | library/ComponentGrid.tsx |
| ⑦ 圖庫排序 | ✅ 日期 range 拎走改輕量排序（最新／最舊） | ComponentGrid.tsx |
| ⑧ 新增產品／素材融合 | ✅ 4-type picker（type-picker wrapper）：產品圖→ProductComposeModal；背景/人像/插圖→GenerateAssetModal 鎖死類型 | AddAssetModal / ProductComposeModal / GenerateAssetModal |
| ⑨ 品牌設定 2-tab | ✅ 修改設定 / 連動帳號（stub） | clients/[id]/settings/page.tsx |

---

## 3. 生成彈窗（統一行為）

- **全部置中 pop up**：產品圖（ProductComposeModal）+ 背景/人像/插圖（GenerateAssetModal 由右側 drawer 改置中）。
- **4 類型 = 4 個專屬彈窗**：由「新增產品／素材圖片」揀類型後，GenerateAssetModal 鎖死該類型、隱藏類型選擇器，標題變「背景生成 / 人像生成 / 插畫生成」；產品圖開「產品圖生成」。
- **統一欄位順序**（兩個彈窗一致）：主體/描述 → 積木/參考 → 尺寸 → 數量 → 引擎 → 生成。
- **多尺寸**（兩個彈窗 + API）：正方形 1200×1200 / 橫向 1800×1200 / 直向 1200×1800 / 限時 1080×1920。API `size→{w,h,aspectRatio}` 對照（`api/library/generate`）。
- 產品圖彈窗：標題「產品圖生成」+ 描述句；移除內部「Prompt 積木組合台」header；「套用行業範本」暫隱藏（`{false &&}` 保留註解）；「語氣」積木已移除。

---

## 4. 新增 / 改動檔案

**新增**
- `components/layout/BrandWorkspaceHeader.tsx`
- `components/library/LibraryWorkspace.tsx`（由舊 /library 抽出，brand-scoped，forwardRef 暴露 openQuickAdd/openAddPicker）
- `components/library/AddAssetModal.tsx`（4-type 融合入口）
- `components/library/ProductComposeModal.tsx`（包 PromptComposer）
- `components/clients/BrandMemoryCards.tsx`
- `app/clients/[clientId]/components/page.tsx`
- `app/unassigned/page.tsx`

**改動**
- `components/layout/Sidebar.tsx`、`app/clients/[clientId]/page.tsx`、`app/clients/[clientId]/settings/page.tsx`
- `components/library/ComponentGrid.tsx`（移分段控制 + search/engine/sort + gallery-only + `unassigned`）
- `components/library/PromptComposer.tsx`（移內部 header、隱藏行業範本、4 尺寸、尺寸移上）
- `components/library/GenerateAssetModal.tsx`（置中、鎖類型、欄位 reorder、4 尺寸）
- `app/library/page.tsx`（redirect）
- `app/api/library/gallery/route.ts`、`app/api/components/route.ts`（unassigned filter）
- `app/api/library/generate/route.ts`（size→尺寸對照表）

---

## 5. 未做（backlog）

1. **連動帳號 OAuth**（Meta / Google / IG）— 品牌設定 Tab2 現為 UI stub。
2. **NextAuth 登入 + 權限**（內部／客戶）— 「未分組素材」之 admin-only gate 等呢個先做（現暫人人可見）。
3. **未分組頁加生成入口**（現只睇／管理，未有「新增」掣）。
4. ComponentGrid 內已不再用嘅舊 code（ComponentCard / FILTER_TABS 等）可清理。

---

## 6. 驗收要點（逐項 check）

見 `docs/WIREFRAME-V2-CHECKLIST.md`。
