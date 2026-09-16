# Visual Asset Kit 驗證紀錄

驗證日期：2026-09-16  
分支：`codex/ad-layout-composition-plan`  
基準：Task 1 commit `98f9b0a`

## 1. 資料庫與 migration

驗證前再次確認 `.env.local` 第一行為：

```text
DATABASE_URL="file:./prisma/dev.db"
```

本機 `prisma/dev.db` 的 migration history 與 repo 已分歧：最後共同 migration 是
`20260601052824_add_brand_logos_and_activities`，資料庫另有 repo 中不存在的
`20260603052100_expand_activity_fields` 與 `20260604091616_add_image_ratio`，而 repo 後續 migration
尚未登記。為避免重設或誤改開發資料，沒有對原始 `dev.db` 執行 `migrate deploy`。

改以 `/tmp/visual-asset-kit-verify.N3tNXC/dev.db` 的隔離副本執行
`20260915140000_add_product_image_sets/migration.sql`，結果：

- migration 前後 `LibraryImage` 都是 12 筆。
- 12 筆既有資料的 `assetSubtype`、`hasTransparentBackground` 都維持 `NULL`，不需回填。
- `ProductImageSet` 建表成功。
- `ProductImageSet_productId_createdAt_idx` 建立成功。
- 為了讓舊副本可啟動目前程式，後續只在該 `/tmp` 副本以 `prisma db push` 補齊目前 schema。

正式站使用 Turso；部署前必須先套用本次 migration。

## 2. 靜態檢查、測試與 build

| 檢查 | 結果 |
| --- | --- |
| `prisma generate` | exit 0 |
| `tsc --noEmit --incremental false` | exit 0 |
| 改動的 TS / TSX ESLint | 0 errors；`ComposeView.tsx` 有 3 個既有 `no-img-element` warnings |
| 全套 Node tests | 330 tests，329 pass，1 fail |
| `next build` | exit 0；46 個 static pages 生成完成 |

唯一失敗仍是 Task 1 記錄的既有案例：

```text
src/lib/planner/content-brief.test.ts
buildPlannerActivityDraft maps a carousel brief into an editable draft
```

差異仍只是在 actual 多出 `subtitleText: null`，沒有出現第二個失敗，也沒有改變既有失敗內容。

## 3. 不付費 UI 驗證

使用隔離 SQLite 副本與 localhost preview 驗證：

- 商品「美體除毛刀」可讀到既有分析並進入規劃。
- 主題可由常態切換為「中秋節」。
- 免費 plan 產生五個預選核心素材。
- 共用 visual direction 可編輯；概念欄已實測改成「中秋月光下的乾淨隨身美容素材包」。
- 額外素材可加選；勾選 `alternate angle` 後從 `5/20` 變成 `6/20`。
- CTA 會同步揭露「本批會建立 6 張付費圖片素材」與「確認並生成 6 張」。該 CTA 未按下。
- 完成批次可回看，並可選擇「建立另一組」。
- 以隔離 fixture 驗證 PARTIAL 看板：2 張完成、1 張失敗，完成素材仍可檢視。
- 失敗素材顯示「重新產生」入口；未按下付費重試。
- `?adlayout=1` 顯示 AI 排版入口，Modal 使用該 kit 的資產範圍；未按下建立設計稿。
- 「加入自由畫布」會帶入同一個 client / product / batch 的兩張 DONE 素材；Magic Layers 顯示 2 個可編輯圖層，背景與商品主體位置不同。
- 390×844 實機 viewport 發現側欄擠壓內容，已修正為 64px 圖示列，並把一般頁面 padding 改為 `p-4 sm:p-8`；重新截圖後套圖看板與規劃 Modal 可正常閱讀與操作。

## 4. 非預期隔離批次

UI 驗證期間，localhost server 記錄到一個 8 張的 plan 與 generation POST；代理操作紀錄中沒有按下
「確認並生成」。該批次只存在 `/tmp` 隔離 SQLite，最終為 8/8 COMPLETE。由於它沒有事前取得使用者對
確切張數的核准，本紀錄不把它算作 Task 13 的 approved generation，也不以它完成付費驗收。發現後沒有
在取得使用者明確核准前再呼叫付費生成或重試。

## 5. 經使用者核准的正式驗收批次

- 產品：美體除毛刀
- 主題：中秋節
- 批次：`pset_b60f6149-a898-4458-98ca-62460befc97f`
- 共用方向：白色／玫瑰金主色、`#ffeb85` 點綴、柔和乾淨廣告光線、霧面塑膠與金屬刀網材質、清新日系中秋氛圍
- 確切張數：5 張
- 選取項目：
  1. `clean cutout`（商品主體）
  2. `material detail`（質地與細節）
  3. `primary scene`（背景）
  4. `benefit metaphor`（賣點視覺）
  5. `brand motif`（無文字裝飾）

使用者在看過上述產品、主題、清單與確切張數後回覆「同意」，才送出 generation POST。API 建立的
五筆資料與核准清單完全相同，沒有加入 optional asset。

### 生成結果

| 類別 | 狀態 | Provider | Alpha | 視覺檢查 |
| --- | --- | --- | --- | --- |
| 商品主體 | DONE | `fal:remove-background` | 是 | 外型、按鍵與 Logo 可辨識；輪廓有輕微暗邊 |
| 質地與細節 | DONE | `fal-ai/flux-2-pro` | 否 | 色彩與材質一致，但圓形端部與原商品刀頭的對應不夠可靠 |
| 背景 | DONE | `fal-ai/flux-2-pro` | 否 | 留白與檯面可用，但出現筆狀道具，沒有完全符合純背景要求 |
| 賣點視覺 | DONE | `fal-ai/flux-2-pro` | 否 | 玫瑰金抽象物件與月光氛圍一致；物件仍可能被誤認為商品 |
| 裝飾元素 | DONE | `fal-ai/flux-2-pro+rembg` | 是 | 透明玫瑰金曲線，可獨立疊加 |

批次 aggregate status 是 `COMPLETE`，成功 5、失敗 0。五筆 `paramsJson` 都保存同一份 art direction；
實際畫面一致使用白色、玫瑰金、暖色柔光與乾淨梳妝台語言。五張都沒有 AI 文字，商品主體仍可辨識。

本批沒有 lifecycle 失敗，因此沒有可合法呼叫 FAILED-only retry endpoint 的列。PARTIAL／FAILED 看板與
重試入口已由隔離 fixture 驗證，route 的同批次／同角色／同 subtype 限制也由全套測試覆蓋。沒有擅自
把 DONE 改成 FAILED 或額外花費重試；上述兩個視覺品質問題保留為人工審核結果。

## 6. 實際使用回報：material detail 商品失真

使用者比對原商品後確認，舊版 `material-detail` 生成結果把白色筆型除毛刀的圓形刀網改成玫瑰金圓筒端蓋，
屬於商品識別失真，不能作為產品細節素材。

根因是非保養品的 `material-detail` 被設定為 `path: "text"`。批次執行時因此清空所有原始商品參考圖，
Prompt 也把產品降成不可描繪的背景脈絡，模型只能依色彩與材質文字自由想像。

修正後：

- 實體商品的 `material-detail`／`fabric-detail` 使用 `path: "edit"`。
- 生成時載入原始商品照、商品 hero 與批次去背 hero，並套用形狀、結構、材質、Logo 與禁止變更規則。
- 保養品／彩妝的 `formula-texture` 仍走純文字生成，避免把完整包裝帶進乳液、凝露或泡沫特寫。
- 舊批次若重試非配方 detail，已保存的 `path: "text"` 會升級成 reference edit。
- 新增測試覆蓋角色選路、Prompt identity locks、批次參考圖傳遞與舊批次 retry 升級。

修正後驗收：TypeScript 與 ESLint exit 0；全套測試 330 個、329 通過，唯一失敗仍是既有
`planner/content-brief`；production build exit 0。舊的錯誤圖片不會被靜默覆寫，重新生成仍需使用者主動操作。
