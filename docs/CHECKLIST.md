# 功能檢查清單 + 更新紀錄

> 整合版：每次換機、重大改動後照此清單逐項驗證。  
> 最後更新：**2026-06-11**（繁中生成 + AI 合成 + 素材模型重整）

---

## 🧭 現況 Summary（2026-06-11）

**素材庫只有 3 種圖**（圖庫 filter）：
| 分類 | 來源 | 內容 / 用途 |
|---|---|---|
| 🟠 **背景** | 背景生成 / 上傳 | 純背景圖（無人/文字/產品），**只用於合成模式**做底圖 |
| 🟢 **上傳** | ＋加入素材（分析圖）| 一張圖綁 構圖+配色+語氣（一體，點「調整」一次改） |
| 🟣 **AI生成** | 生成圖片產出 | LibraryImage |

**核心流程**
- 生成圖片：繁中設計描述（唯讀預覽）→ 生成時自動翻英 → fal FLUX 出圖 + 繁中文案。
- 產品合成：上傳去背產品圖 → **fal.ai Bria Product Shot** AI 合成（修光融合）→ 失敗 fallback sharp 疊圖。
- 以圖為單位編輯：圖片風格 popup「調整」一次改該圖 構圖/配色/語氣；uncheck 即刪。
- Layout：/library 收起全域 Sidebar，左欄單一 +「《 返回客戶」。

### 🔌 現時使用的 API（邊部分用邊個）
| 部分 | API / Model | 備註 |
|---|---|---|
| 讀圖分析（加入素材）| **OpenRouter `openai/gpt-4o-mini`**（vision）| `OPENROUTER_VISION_MODEL` |
| AI 讀圖填主體 | OpenRouter `gpt-4o-mini`（vision）| describe route |
| 文案 + 繁→英翻譯 | **OpenRouter `gpt-4o-mini`**（text）| `OPENROUTER_TEXT_MODEL`；$0.15/$0.60 per 1M |
| 出圖（生成圖片 / 背景生成）| **fal.ai FLUX.1-schnell**（主）→ HF FLUX（備）→ Pollinations（停）| `FAL_KEY` / `HF_TOKEN` |
| 產品合成 | **fal.ai Bria Product Shot**（~$0.04/張，主）→ sharp 疊圖（備）| `FAL_KEY` |
| 本機疊圖 fallback | `sharp` | 需透明去背 PNG |
| 現時無用 | Pollinations / n8n / Anthropic | `GEN_PROVIDER=inapp` |

> 收費提示：OpenRouter 無 `:free` 尾 = 付費（gpt-4o-mini 極平）；fal 出圖/合成逐張收費（schnell 平、Bria ~$0.04/張）。

---

## ✅ 功能檢查清單（現有功能，逐項驗證）

### 🔧 環境 & 啟動
- [ ] `.env.local` 存在，並含以下 key：
  - `DATABASE_URL="file:./prisma/dev.db"`
  - `OPENROUTER_API_KEY`（新 key：`sk-or-v1-ca214...`）
  - `OPENROUTER_VISION_MODEL="openai/gpt-4o-mini"`
  - `OPENROUTER_TEXT_MODEL="openai/gpt-4o-mini"`
  - `HF_TOKEN="hf_..."`
  - `FAL_KEY="590c5f9c-...:9d644cb3..."` ← **新增**
  - `GEN_PROVIDER="inapp"`
- [ ] `prisma/dev.db` 存在（含客戶 + 素材 + 生成圖資料）
- [ ] `public/uploads/` 存在（備份還原後）
- [ ] `npm run dev` 可啟動；瀏覽器 `http://localhost:3000/library` 正常開啟
- [ ] Sidebar 顯示客戶清單（Sofie / 測試品牌）

---

### 🖼️ 生成圖片頁（/library → 生成圖片 tab）

**Prompt 積木組合台**
- [ ] 標題「Prompt 積木組合台」顯示
- [ ] **套用行業範本**（6 個 pill）顯示在積木上方 ← **新增**
  - [ ] 點「護膚品」→ 4 個積木自動填入
  - [ ] 「清除範本」按鈕出現，可重置
- [ ] 4 個積木 slot（構圖 / 背景 / 配色 / 語氣）
  - [ ] 空白時顯示虛線 + 提示文字
  - [ ] 點擊 slot → 彈出 **SlotPickerModal**
    - [ ] 頂部顯示**品牌 pill 篩選**（全部品牌 + 各客戶名）← **改版**
    - [ ] 有搜尋文字框
    - [ ] 有素材時顯示**圖片+文字卡片**（2 列網格，有 previewUrl 的顯示圖片疊文字）← **改版**
    - [ ] 選取後帶入 slot，modal 關閉
  - [ ] 帶入後 slot 顯示名稱 + 內容預覽（配色顯示色塊 `h-8`）← **修正截斷**
  - [ ] 右上「✕」可清除單個 slot
- [ ] 配色已選 → 色盤開關顯示（主色鎖定，其餘可關）
  - [ ] 每個顏色旁有 **hex 輸入框**，可直接改色 ← **新增**
- [ ] 主體物件文字輸入
- [ ] 上傳產品圖 → AI 讀圖填主體 / 直接合成（去背 PNG）
- [ ] 其他注意事項輸入
- [ ] **AI Prompt** 區塊（原「編譯後的 AI Prompt」） ← **改名**
  - [ ] 自動組裝 Prompt（中文標籤：`[構圖:]` `[背景:]` 等）
  - [ ] 可直接編輯（textarea 可輸入） ← **新功能**
  - [ ] 手動改動後出現「已自訂」badge + 「重置」按鈕 ← **新功能**
  - [ ] 「重置」→ 恢復自動組裝
  - [ ] 「複製」按鈕正常
  - [ ] 手動沒有 `aiPromptText` 的構圖 → 仍帶入 `description` 到 Prompt ← **修正**
- [ ] 「生成新圖」按鈕
  - [ ] 優先用 **fal.ai**，失敗改 HF ← **新增**
  - [ ] 生成中顯示 loading
  - [ ] 成功後圖片顯示在結果區 + 文案

**圖片紀錄**
- [ ] 生成圖顯示 **「🟣 AI生成」badge** ← **新增**
- [ ] 點圖 → popup 開啟
  - [ ] 圖片顯示
  - [ ] **生成文案**（amber 框）顯示 ← **修正**
  - [ ] **AI Prompt**（violet 框）顯示 ← **新增**
  - [ ] 右側顯示生成時使用的**積木組件**（構圖/配色/語氣/背景）← **修正**
  - [ ] 「重新生成/調整」→ 載入原參數到生成台

---

### 🎨 風格組件頁（/library → 風格組件 tab）

**圖庫 tab（預設）**
- [ ] 生成圖顯示 **「🟣 AI生成」badge** ← **新增**
- [ ] 上傳分析圖顯示 **「🟢 上傳」badge**（之前為「素材」）← **改名**
- [ ] 點任一圖 → popup（圖 + 積木組件 + 帶入生成）

**子分頁（全部 / 構圖 / 配色 / 語氣 / 背景）**
- [ ] 組件卡片正常顯示
- [ ] 配色卡片顯示 ColorCards 色塊（5 色，點擊複製 hex）
- [ ] 卡片底部按鈕：複製 / 帶入生成 / ✏️ 編輯 / 🗑️ 刪除
  - [ ] 刪除需二次確認
- [ ] 「加入素材」按鈕 → QuickAddModal

**加入素材 / 編輯素材（QuickAddModal）**
- [ ] **新建模式**：4 類型可同時勾選新增
- [ ] **編輯模式**：預填現有值，儲存後覆蓋 ← 含原有功能
- [ ] **兩種模式都有**：參考圖片上傳 + AI 分析按鈕 ← **修正（原只有新建有）**
- [ ] AI 分析 → 填入構圖 / 配色 / 語氣 / **背景描述** ← **修正（原缺背景）**
- [ ] AI Prompt 欄位標籤改為繁體中文 ← **改版**
- [ ] analyze API 輸出全繁中（包含 aiPromptText）← **修正**
- [ ] 5 色色盤：主色必填，其餘可勾選啟用
- [ ] 背景：可上傳圖 + AI 偵測描述 + 純文字描述
- [ ] 行業範本 pill 已**移除**（移至積木組合台）← **改版**

---

### 🔌 API & 後端

| Endpoint | 功能 | 驗證 |
|---|---|---|
| `GET /api/clients` | 客戶列表 | [ ] |
| `GET /api/components?clientId=` | 組件列表 | [ ] |
| `POST /api/components` | 建立（upsert 同 previewUrl+type）| [ ] |
| `PATCH /api/components/[id]` | 編輯組件 | [ ] |
| `DELETE /api/components/[id]` | 刪除組件 | [ ] |
| `POST /api/components/analyze` | 圖片分析（含 background）← 新 | [ ] |
| `GET /api/library/gallery` | 圖庫 union（含 prompt 欄）← 新 | [ ] |
| `POST /api/library/generate` | 生成圖（fal.ai → HF，支援 customPrompt）← 新 | [ ] |
| `POST /api/library/describe` | AI 描述 subject/background | [ ] |
| `POST /api/upload` | 上傳圖片 | [ ] |

- [ ] 文案生成（OpenRouter `openai/gpt-4o-mini`）輸出繁體中文台灣
- [ ] 圖片生成鏈：fal.ai 優先 → HF 備援 ← **新增**
- [ ] `dev.db` 資料完整
- [ ] 無機密檔案被 commit（`.env.local` / `dev.db` / `uploads/` 均 gitignore）

---

## 📅 更新紀錄（By Week）

---

### Week 1：2026-05-27 ~ 2026-05-31（初版功能）

**主要建立**
- 專案骨架：Next.js 16 + Prisma + SQLite + TailwindCSS
- 客戶管理：`/clients`（列表 / 新增 / 詳情 / 設定）
- 活動管理：`/clients/[id]/activities/new`（新增活動 + 表單）
- 素材庫初版：分析圖片（獨立分頁）+ 快速加入素材
- `POST /api/components`：構圖 / 配色 / 語氣 3 類型
- 圖片分析改接 OpenRouter（`gemini-2.0-flash-001`）
- Commits：`a726d82` fix / `7934ddf` feat / `3a2b881` feat / `cdef47b` feat / `f346da5` feat

---

### Week 2：2026-06-02 ~ 2026-06-06（素材庫大改造 + AI 功能接通）

**素材庫 2.0 重構**
- 素材庫從 3 tabs → **2 tabs**（生成圖片 / 風格組件）
- 刪除獨立圖片分析頁 `ImageAnalyzer.tsx`
- 品牌圖庫 `GET /api/library/gallery`（上傳 + 生成 union）

**AI 圖片 + 文案生成接通**
- `src/lib/generate.ts`：`generateImage`（Pollinations → HF）+ `generateCopy`（OpenRouter）+ `compileImagePrompt`
- `POST /api/library/generate`：prompt 編譯 → 出圖（存 uploads）+ 出文案 → 存 `LibraryImage`
- 確認 Pollinations 對此 IP 回 402 → 實際靠 **HF FLUX.1-schnell**（`router.huggingface.co`）
- `GEN_PROVIDER=inapp|n8n` 開關

**配色系統升級**
- 5 色 palette（主色/輔色/強調色/中性色/點綴色）
- `ColorCards.tsx`（coolors 風大色塊 + 點擊複製 hex）
- `getColors()` fallback 向後相容舊 2 色素材
- analyze 加 `colorScheme.extraColors`（最多 3 個點綴色）

**第 4 類型：背景（BACKGROUND）**
- 新增 teal 色系背景類別
- `PromptSlots` 擴充到 4 slots
- 風格組件加「背景」子分頁
- 背景可上傳圖 + 純文字描述 + AI 偵測描述

**行業預設範本**
- `src/types/presets.ts`：6 行業（護膚品/女性用品/生活電子/衣服時尚/食品飲料/家居生活）
- 每行業含完整 構圖+5色配色+語氣+背景
- QuickAddModal 頂部「套用行業範本」一鍵填入

**互動功能 8 項（全驗證）**
1. 積木可點揀：slot 點擊 → SlotPickerModal 揀素材帶入
2. 圖片紀錄點擊 → 共用 ImageDetailModal
3. 帶入改 toast（不跳分頁）
4. 全面繁體中文台灣輸出（analyze + copy）
5. 重新生成：載入 paramsJson 到生成台（prefill）
6. 編輯素材：QuickAddModal 編輯模式 + PATCH API
7. 上傳產品圖：AI 讀圖填主體 + sharp 合成去背 PNG
8. upsert 機制：同 previewUrl+type 再分析 → 更新不重複

**資料 schema 更新**
- `LibraryImage` 新表（生成圖獨立存）
- `Client.paletteColors`（JSON 欄）
- migration `library_redesign`（SQLite RedefineTables，無資料損失）

**已知 bug 修正**
- OpenRouter `gemini-2.0-flash-001` 已 404 → 改 `openai/gpt-5.4-nano`
- HF 舊端點 `api-inference.huggingface.co` 已死 → 改 `router.huggingface.co`

---

### Week 3：2026-06-09（本 session — 大量優化 + 新功能）

#### 環境 / API 金鑰
| 項目 | 變更 |
|---|---|
| 新增 `FAL_KEY` | fal.ai 公司 API key 加入 `.env.local` |
| 更新 `OPENROUTER_API_KEY` | 舊 key 換新 key |
| `node_modules/.bin/next` 修復 | npm install 修復損壞的 node_modules |
| `launch.json` 更新 | 由 `npm run dev`（需 dotenv-cli）改為直接 `node_modules/.bin/next dev`（Next.js 原生讀 .env.local）|

#### 圖片生成優先順序升級
- **fal.ai FLUX.1-schnell** 設為 primary（`https://fal.run/fal-ai/flux/schnell`）
- HF 降為 fallback（素材/備援）
- Pollinations 降為 last resort（只在無其他 provider 時才用）

#### AI 分析升級（`analyze/route.ts`）
- 新增 **`background` 欄位**（名稱/描述/aiPromptText）
- `aiPromptText` 全部改為**繁體中文（台灣）**輸出（原為英文）

#### 積木組合台（`PromptComposer.tsx`）
- **行業範本**從 QuickAddModal 移至此區（6 個 preset pill）
- 一鍵填入：建立 virtual component 帶入 4 個 slots（不儲存 DB）
- 「清除範本」一鍵重置
- **AI Prompt 可編輯**：textarea 取代唯讀顯示
  - 手動改動 → 「已自訂」badge + 「重置」按鈕
  - 「重置」→ 恢復自動組裝
- Prompt 標籤改為中文（`[構圖:]` `[背景:]` 等）
- 構圖沒有 `aiPromptText` → fallback 用 `description`（修正手動建構圖無法帶入 Prompt 的問題）
- 配色 toggle 每個顏色旁加 **hex 輸入框**（可改色）

#### SlotPickerModal 大改版
- 品牌篩選從**下拉 dropdown 改為水平 pill 按鈕**
- 加文字搜尋框
- 素材改顯示 **2 列圖片卡**（有 previewUrl 的顯示圖片+文字覆蓋）

#### 風格組件 / 圖庫標示
- 「生成圖」badge：紫色 🟣 AI生成（ComponentGrid + AssetGrid）
- 「上傳圖」badge：綠色 🟢 上傳（原為「素材」）

#### 快速加入素材（QuickAddModal）
- **編輯模式**新增 AI 分析功能（原只有新建模式才有）
- AI 分析結果填入**背景描述**（原缺此欄）
- 行業範本 pill 已**移除**（移至積木組合台）
- AI Prompt 欄位標籤改為繁體中文

#### 生成圖 popup（ImageDetailModal）
- 新增 **AI Prompt 顯示**（violet 框）
- 生成時使用的**積木組件**正確帶入顯示（原 presetComponents:[] 導致顯示空白）
- 文案（copyText）一直有顯示，但現確認正常

#### 後端修正
- `generate/route.ts` 支援 `customPrompt` 覆蓋（AI Prompt 手動編輯後傳入）
- `gallery/route.ts` 回傳 `prompt` 欄位（生成時的完整 prompt）
- `gallery route` → `AssetGrid` → `ImageDetailModal` 整條 `prompt` 傳遞鏈

---

### Week 4：2026-06-10 ~ 06-11（繁中生成 + AI 合成 + 素材模型重整）

> ⚠️ 注意：上方「生成圖片頁 / 風格組件頁」嘅逐項清單部分**已被本週改動取代**，以開首「🧭 現況 Summary」為準。

#### API model
- vision + text 由 `openai/gpt-5.4-nano` → **`openai/gpt-4o-mini`**（更平 $0.15/$0.60、支援 vision、穩定）。

#### 生成：繁中為主 → 自動翻英
- `compileChineseBrief` + `translateBriefToEnglishPrompt`（OpenRouter）；FLUX 食英文。
- PromptComposer：構圖描述/語氣 tag inline 編輯；配色 5-role checkbox；「設計描述預覽」**唯讀**。

#### 產品合成：fal.ai Bria Product Shot
- `falProductShot`（`fal-ai/bria/product-shot`，~$0.04/張，data URI 傳圖）；composite 先試 Bria（有背景圖→`ref_image_url`／無→翻英 `scene_description`）→ 失敗 fallback sharp。

#### 背景 = 純圖片資產
- 只係圖、只用於合成、移出文字 brief、唔由相片分析產生。
- 生成素材→**背景生成**（只生背景、無分類選項、只喺 圖庫/全部/背景）。
- 圖庫三分類 **🟠背景 / 🟢上傳 / 🟣AI生成**；背景 popup 固定正方形（圖上 + 帶入生成 + 刪除）。

#### 以圖為單位編輯
- 圖片風格 popup「**調整**」→ 一次改該圖 構圖/配色/語氣、一次存（upsert）；uncheck 即刪。
- 風格組件卡改圖片式（圖+名稱 + 帶入生成 + 刪除，無 pencil）；點卡開 popup。
- 移除 QuickAddModal 各類「AI Prompt」欄、編輯模式「分類」dropdown（保留專案）。

#### Layout + 修正
- `/library` 收起全域 Sidebar；左欄單一 +「《 返回客戶」→ `/clients`；預設「全部 + 風格組件」。
- 編輯後不更新/順序錯：force-dynamic + no-store + PATCH bump createdAt；編輯保留 previewUrl 防 tile 消失。
- Composer 反應慢：prev-state 比較重置（消連鎖重繪）。
- 新 endpoint：`DELETE /api/library/images/[id]`、`POST /api/library/save-image`。

---

## 🗂️ Backlog（未做，待確認）

### 優先級高
- [ ] **用戶自己上傳圖片的分類調整**：目前「上傳」圖庫包含所有 previewUrl 圖片（含分析用參考圖）。需區分「品牌圖庫（用戶主動上傳）」vs「分析參考圖」，並讓用戶可調整分類。
- [ ] **以文字指令新增素材**：在加入素材或積木選取中，可輸入文字描述（如「暖色系簡約背景」），AI 自動生成素材資料存入。
- [ ] **生成圖 popup 刪除功能**：目前只能從風格組件的 ALL/子分頁卡片刪除；圖庫 tile 和圖片紀錄 popup 無刪除功能。
- [ ] **配色 hex 輸入真正改色**：目前 hex 輸入框只是 UI，改色後需更新 slot 中的 palette 資料並重新編譯 prompt。

### 優先級中
- [ ] **加入參考連結**：素材/圖片可附來源 URL；或生成台支援貼參考圖網址（AI 描述→併 prompt）
- [ ] 圖庫 tile 可直接刪除（目前需進子分頁才有刪除）
- [ ] n8n provider stub 接通（`GEN_PROVIDER=n8n`）

### 優先級低
- [ ] 真 img2img / 多產品合成（需付費 API）
- [ ] 生成圖一鍵「分析加入素材庫」（目前需手動進 popup 再按分析）

---

## 🔑 關鍵檔案快速索引

| 檔案 | 功能 |
|---|---|
| `src/app/library/page.tsx` | 素材庫頁主入口（2 tabs，統一管理 popup/toast/編輯/重生成） |
| `src/components/library/PromptComposer.tsx` | 積木組合台（slot + preset + editable prompt） |
| `src/components/library/SlotPickerModal.tsx` | 積木選取 popup（brand pills + search + image cards） |
| `src/components/library/ComponentGrid.tsx` | 風格組件 tab（圖庫 + 子分頁 + 卡片） |
| `src/components/library/AssetGrid.tsx` | 圖片紀錄（生成圖列表） |
| `src/components/library/QuickAddModal.tsx` | 加入/編輯素材彈窗 |
| `src/components/library/ImageDetailModal.tsx` | 圖片詳情 popup（含 prompt / 積木 / 文案） |
| `src/components/library/ColorCards.tsx` | coolors 風色卡（點擊複製 hex） |
| `src/lib/generate.ts` | 圖片/文案生成抽象層（fal.ai → HF → Pollinations） |
| `src/app/api/library/generate/route.ts` | 生成 API（支援 customPrompt） |
| `src/app/api/components/analyze/route.ts` | 圖片分析（含 background，全繁中） |
| `src/app/api/library/gallery/route.ts` | 圖庫 API（含 prompt 欄） |
| `src/types/library.ts` | 型別定義（GalleryItem / ImageDetail / StyleComponent）|
| `src/types/presets.ts` | 6 行業範本 |
| `.env.local` | API keys（FAL_KEY / OPENROUTER / HF）|
| `prisma/dev.db` | 本機 SQLite（gitignore，需從備份帶）|
| `public/uploads/` | 上傳/生成圖片（gitignore，需從備份帶）|
