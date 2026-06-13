# Feature Log — marketing-tool

> 本檔為 in-repo 的完整功能/變更紀錄（換電腦後 Claude 記憶不會跟住走，故記喺呢度）。

## 素材庫重構（接通 AI 生成 + 統一圖庫）

### 接通圖片 + 文案生成（in-app，可抽換）
- `src/lib/generate.ts`：`generateImage`（Pollinations 主力 → HF FLUX.1-schnell 備援）、`generateCopy`（OpenRouter）、`compileImagePrompt`、provider 開關 `GEN_PROVIDER=inapp|n8n`（n8n stub）
- `POST /api/library/generate`：編 prompt → 出圖（存 `public/uploads`）+ 出文案 → 建 `LibraryImage`
- PromptComposer「生成新圖」掣接通；「其他注意事項」欄；色盤逐色使用/不使用開關
- ⚠️ Pollinations 免費匿名 + 帶 token 對本機 IP 都回 **402**；實際靠 **HF**（端點 `router.huggingface.co/hf-inference/models/<model>`，舊 `api-inference.huggingface.co` 已死）

### 圖片分析併入風格組件（移除獨立分頁）
- 素材庫 3 tab → **2 tab**（生成圖片 / 風格組件）；刪 `ImageAnalyzer.tsx`
- 風格組件預設「品牌圖庫」：`GET /api/library/gallery`（上傳分析圖按 previewUrl group + 生成圖 union）
- `ImageDetailModal.tsx`：點圖庫圖 / 組件卡片 → popup（圖 + 構圖/配色/語氣/背景 + 帶入生成）

### 5 色色盤 + coolors 色卡
- COLOR_SCHEME `data.colors:[{hex,role,label}]` + legacy `primaryColor/secondaryColor` 同步
- 5 role：主色 primary / 輔色 secondary / 強調色 accent / 中性色 neutral / 點綴色 highlight（`PALETTE_ROLES`）
- `getColors()` fallback（舊 2 色照顯示）；`ColorCards.tsx`（coolors 風大色塊 + hex 點擊複製）
- analyze 加 `colorScheme.extraColors`（additive，0–3 色）

### 背景類別 BACKGROUND
- 第 4 component 類別（teal）；`PromptSlots` 4 slot；風格組件「背景」子分頁；composer 第 4 積木

### 行業 default 範本（presets）
- `src/types/presets.ts`：6 行業（護膚品/女性用品/生活電子/衣服/食品飲料/家居生活），各含 構圖+5色配色+語氣+背景
- QuickAddModal 頂部「套用行業範本」一鍵填入

### 資料模型（全 additive，dev.db 資料保留）
- `LibraryImage`（生成圖獨立存，不動 `GeneratedLayout`）
- `Client.paletteColors`（JSON）
- migration `library_redesign`（SQLite RedefineTables，無資料損失）

### Model 更新
- OpenRouter `gemini-2.0-flash-001` / `gemini-2.0-flash-exp:free` 已 404 → 改 `openai/gpt-5.4-nano`（vision+text）
- 免費 `:free` text model 常 429，不採用

## 第二輪：互動 + 編輯 + 合成（8 項，全部已驗證）
1. **積木可點揀**：生成台 slot 點擊 → `SlotPickerModal` 揀已有素材帶入
2. **圖片紀錄 popup**：`AssetGrid` 可點 → 共用 `ImageDetailModal`（modal 提升到 `page.tsx`）
3. **帶入改 toast**：`handleInject` 不再跳分頁，改右下角自動消失 toast
4. **繁體中文台灣**：analyze name/description/toneLabels + `generateCopy` 強制繁中台灣；英文 `aiPromptText` 保留
5. **重新生成/調整**：生成圖 popup「重新生成」→ 載入 `paramsJson` 到生成台（prefill）
6. **編輯素材**：每素材「編輯」→ QuickAddModal 編輯模式（預填 + `PATCH /api/components/[id]` 覆蓋）；背景可純文字無圖 + 「AI 偵測描述」
7. **生成台上傳產品圖**：「AI 讀圖填主體」+「直接合成」（去背 PNG 用 `sharp` 疊背景；非透明偵測 alpha → 提示去背 remove.bg/photoroom）
8. **AI 存素材改 upsert**：`POST /api/components` 同 previewUrl+type 已存在 → 更新 + 置頂，唔再重複
- 已知限制：免費 text-to-image 唔做 img2img，「直接使用產品圖」靠 sharp 合成（需透明去背 PNG）

## 第三輪：繁中為主生成 + AI 合成 + 素材模型重整（2026-06-10～11）

### 生成語言：繁中為主 → 自動翻英
- `generate.ts` 加 `compileChineseBrief`（砌繁中設計描述）+ `translateBriefToEnglishPrompt`（OpenRouter 翻成優化英文 prompt 餵 FLUX）；無 key 時 fallback 原文。
- `generate/route.ts` full-AI 路徑改：取 customPrompt(繁中brief) 或由 slots 砌 → 翻英 → 出圖。
- PromptComposer 重寫：構圖描述/語氣 tag 可 **inline 編輯**；配色用 5-role checkbox（色票+hex，跟 QuickAddModal 一致）；「設計描述預覽」**唯讀**（鎖 icon）。

### 產品合成：fal.ai Bria Product Shot（真 AI 合成）
- `generate.ts` 加 `falProductShot`（`fal-ai/bria/product-shot`，~$0.04/張，圖片以 data URI 傳）。
- composite mode 改：**先試 Bria**（有背景圖→`ref_image_url`；無→繁中brief翻英做`scene_description`）→ **失敗 fallback 舊 sharp 疊圖**。
- 解決舊「sharp 純疊圖無修光、效果差」問題。

### 背景重整為純圖片資產
- 背景**只係圖片**（移除文字描述欄）、**只用於合成**、**移出文字 brief**、**唔再由相片分析產生**。
- 生成素材 → 改為 **背景生成**（只生背景：無人/文字/產品；只喺 圖庫/全部/背景 出現；移除素材分類選項）。
- 圖庫三分類 filter：**🟠 背景 / 🟢 上傳 / 🟣 AI生成**（gallery route 按 group 類型判斷 material vs uploaded）。
- ImageDetailModal 背景 popup：固定**正方形**版面（圖在上 + 帶入生成 + 刪除，不左右分欄）；移除「未分析」狀態。

### 以圖為單位編輯
- ImageDetailModal「**調整**」掣（刪除旁）：一次載入該圖 構圖+配色+語氣 → QuickAddModal 多段預填 → 一次存（upsert by previewUrl+type）；**uncheck 某類即刪該組件**。
- 風格組件積木卡改**圖片式**（圖+名稱 overlay + 帶入生成 + 刪除，移除逐個 pencil）；點卡 → 開該圖 popup。
- 移除 QuickAddModal 各類「AI Prompt」欄、編輯模式「分類」dropdown（保留專案 dropdown）。

### 修正以往 bug
- 編輯後不更新/順序唔郁：`/api/components`、`/api/library/gallery` 加 `dynamic="force-dynamic"` + 前端 `cache:"no-store"`+時間戳；PATCH bump `createdAt` 置頂。
- 編輯背景把 previewUrl 改錯導致 tile 消失：編輯時一律保留 `editComponent.previewUrl`。
- GalleryItem 加 `name`（曾用嚟喺 tile 顯示，後改為淨圖）。
- 生成素材未選的圖不入庫：generate 加 `draftOnly`（只存檔不寫 DB），選取先寫。

### Layout + 預設
- `/library` 收起全域 Sidebar；素材庫自己客戶資料夾欄做唯一左欄 + 「《 返回客戶」→ `/clients`。
- 預設客戶「全部」、預設分頁「風格組件」（tab 順序：風格組件 在前）。
- Composer 反應慢：改 prev-state 比較重置（消 setState-in-effect 連鎖重繪）。

### API model
- vision + text 由 `openai/gpt-5.4-nano` 改 **`openai/gpt-4o-mini`**（更平、支援 vision、穩定）。

### 新增 API endpoints
- `DELETE /api/library/images/[id]`（刪生成圖）、`POST /api/library/save-image`（背景生成保留時寫 LibraryImage）。

## 更早（已 commit，2026-06-03 批次）
| commit | 功能 |
|--------|------|
| `a726d82` | fix: 圖片分析「加入剩餘素材」按鈕無效 |
| `7934ddf` | feat: 素材刪除 + 圖片風格雙向導航 |
| `3a2b881` | feat: 三類型同時新增 + 圖片分析頁 |
| `cdef47b` | feat: 圖片分析改用 OpenRouter |
| `f346da5` | feat: 素材庫快速加入素材功能（初版） |

## 第三輪（2026-06-11 → 06-13）：合成引擎大改 + 多產品 + 文字保留 + UI 全面打磨

> 由 commit `f8a10ec` 之後嘅工作（全部喺 working tree，未 commit）。按時序記錄；回推項目附原因。

### 時序

1. **清空 DB 重建測試** — 刪晒 Client/Activity/StyleComponent/LibraryImage + `public/uploads/`，先完整備份去 `.backup/<ts>/`（dev.db + uploads）。
2. **合成 bug：生成背景無被用** — 查明係 **Bria `ref_image_url` 嘅語意**：佢只攞背景做「風格參考去生成新場景」，唔會原樣用。→ 唔係 wiring 問題。
3. **背景積木重新定位 + ImageDetailModal 修復**
   - 背景積木改名「生成背景參考」、移到語氣之下、修描述預覽文字。
   - 修 `ImageDetailModal`：移除 `bgComp` 短路 bug（之前有背景就只顯示背景、隱藏構圖/配色/語氣）→ 改為永遠顯示構圖/配色/語氣。
4. **分析模型比較 → 換 nano** — 用 `gpt-5.4-nano` 重跑 5 張參考圖 vs 現用 `gpt-4o-mini`：nano **構圖讀得準（唔再套版）、抓到品牌主導色、識分促銷語氣**。→ `OPENROUTER_VISION_MODEL` 改 `openai/gpt-5.4-nano` + **收緊 analyze prompt**（據實判讀、禁套版、硬性字數上限）。
5. **ImageDetailModal 加功能** — 構圖/配色/語氣**個別刪除** icon（兩段式確認）；**圖片下載**掣。
6. **多項 popup/composer 修正**
   - QuickAddModal「專案」分類改唔到 → 修 `POST /api/components` upsert：match 改 **`previewUrl+type`（去掉 clientId）** + update 時寫 clientId（容許搬專案，唔再 fork 重複）。
   - 上傳圖 popup 加 header 刪除（刪該圖所有組件）；背景 popup 加 header 下載+刪除、收起底部 trash。
   - **按積木生成**：QuickAddModal 每個積木加「AI 生成此項」（只重生成嗰一項）。
7. **生成圖積木更新 bug** — 生成圖嘅構圖/配色/語氣存喺 `LibraryImage.paramsJson.slots`（快照），但「調整」寫去 StyleComponent rows，兩邊唔通。→ 新增 **`PATCH /api/library/images/[id]`** 直接改寫 paramsJson.slots；編輯後 **bump createdAt** 令該圖排到最新。可改埋 clientId、subject。
8. **9 項 UI 打磨**（一次過）— 產品提示說明、移除語氣積木、背景積木改名「背景」、結果框唔顯示文案、圖片紀錄**全圖+尺寸標籤**、放大編輯素材參考圖、modal **放回背景積木 + 加回 AI Prompt**、**可改照片標題**。
9. **AI Prompt 改中文** — 合成存 `sceneCn`（用戶原本繁中 brief），唔再存英文翻譯；ComponentRow 唔再顯示細說明；背景生成加正方/長方尺寸。
10. **合成引擎 saga（核心）**
    - GPT-5.4 image 2 做主力 → 實測 timeout：① 產品 PNG payload 太大 → 改降 1024 **JPEG**；② **兩張輸入圖會 hang** → GPT 改只送 1 圖 + 文字場景；③ provider 本身 **intermittent**。
    - 加 **fal nano-banana edit** 做可靠 workhorse（~8s、收多圖、用真背景）→ **對調做主力**。
    - **尺寸選項**（1200²/1800×1200）+ `aspect_ratio` + supersample（2x render 再縮）。
    - **多產品（最多 3）**：nano-banana 收多圖；Bria/GPT 單圖（多產品 UI 禁用）。
    - **3 引擎選擇器**（自然合成 nano / 保留文字 Bria / GPT image）+ 引擎徽章。
    - **3 件產品時背景 → 文字參考**（唔當第 4 圖輸入）。

### 回推（rollback）項目 + 原因

| 項目 | 曾加入 | 回推原因 |
|---|---|---|
| **Bria `shot_size: 2400`（超採樣）** | 想細字更清 | Bria 原生 ~1MP，叫佢出 2400 只係**內部放大自己 → 更糊**。超採樣只對真高清 render（FLUX/疊圖）有效。→ Bria 移除 shot_size。 |
| **文字疊圖（真字 overlay）** | 海報文案永遠清晰 | 用戶覺得效果唔好（且只適合平面文案）→ UI 移除（後端 `applyTextOverlay` 留 dormant）。 |
| **源圖高清化（clarity-upscaler）** | 救低清產品相 | 低清字 AI 放大唔係「仍糊」就係「清但亂估字」→ UI 移除（dormant）。 |
| **去背+疊圖（保留文字 v1）** | 文字 100% 保留 | 去背毛邊、只能置中、死版 → 改用 **Bria product-shot**（automatic 擺位、保留原相）。 |
| **GPT 模型 `gpt-5-image-mini`** | 快、平、初測靚 | 重測**質素唔好** + 一樣 intermittent → 回推 `gpt-5.4-image-2` + timeout 25s→**60s**。 |
| **分析模型（舊記 gpt-4o-mini）** | — | 本輪改 `gpt-5.4-nano`（比較後較準）；已更新 DECISIONS。 |

### Summary

合成流程由「Bria/sharp」進化成 **3 引擎可選 + 自動 fallback**（nano-banana 主力 / Bria 保留文字 / GPT 測試 → sharp 備援），支援 **1–3 產品 + 兩種尺寸**，並認清 **AI 重畫文字嘅本質限制**（中文標籤靠 Bria 保留原相解）。期間試錯多個方向（超採樣/疊字/升頻/GPT mini）並據實回推，留低最穩定有效嘅組合。

---

## Phase 2（2026-06-12 → 06-13）：圖庫 UI 打磨 + 素材生成大升級 + 參考風格圖 + Nano Banana

> 本 session 分兩條主線：① 圖庫/popup UI 一系列修正打磨；② 素材生成功能性升級（參考圖 + 新引擎）。

### 圖庫 UI 打磨（bug 修正）

| 項目 | 問題 | 修正 |
|---|---|---|
| **Gallery tile AI tag** | 背景有 Sparkles icon，人像/插畫無 | 所有 AI 素材 tile 一律加 Sparkles icon |
| **AI Engine label** | 背景 tile 硬編碼顯示「AI生成」 | 改用 `engineLabel()` 讀 `mode`（FLUX.1/FLUX.2 pro/Recraft V3/Nano Banana） |
| **背景 tag 無 mode** | 舊存法只存 `imageUrl`，無 `mode` | 背景生成儲存時加 `mode: "flux-scene"`；Gallery API 回傳 `aiPromptText` + `mode` |
| **Popup button 次序** | 次序亂 | 全 3 個 popup 分支統一：下載 → 調整 → 移到… → 刪除 |
| **背景 popup icon 顏色** | 寫死紫色 | 改按 tag 色同步：背景=teal、人像=rose、插畫=amber、參考圖/上傳=blue、AI生成=violet |
| **背景 popup 先跳大再縮** | `loading=true` 時先 render max-w-5xl 主 popup，API 返回後縮成 max-w-2xl | 加 `genType: "material"` hint 到 `regenerateParams`；modal 憑此 hint 第一格即 render 正確尺寸 |
| **背景 popup 不一致** | 圖庫 gallery click vs 組件卡片 click popup 不同 | 兩路均加 `genType: "material"` hint；組件卡片額外加 `presetComponents: [comp]` 即時顯示不閃 |
| **背景 popup 無 AI Prompt** | 未顯示 | 加 violet 卡（同人像/插畫格式） |
| **背景 popup 圖片截剪** | `object-cover` 剪走細節 | 改 `object-contain bg-gray-50` |

### 素材生成功能性升級

**「背景生成」→「素材生成」**（`GenerateAssetModal.tsx`）：3 種素材類型
- **背景**（FLUX.1-schnell）→ 存為 BACKGROUND StyleComponent，可重用於合成
- **人像**（FLUX.2 pro）→ 存為 LibraryImage（genType=person）
- **插畫**（Recraft V3）→ 存為 LibraryImage（genType=illustration）

各類型用 `draftOnly` 模式批量生成（唔入庫），選取後才儲存，支援 1–5 張、正方/橫向尺寸。

### 參考風格圖（參考圖 = 只借風格，唔抄構圖）

用戶可加參考圖讓 AI 讀取風格做生成指導：

1. **輸入方式**：貼 URL 或本地上傳（`POST /api/upload`，存 `/uploads/`）
2. **✨潤色**：按鈕改名「✨ 讀圖潤色」；Polish API 先呼叫 `describeReferenceStyle` 分析風格，再注入 polish prompt（`polishBriefToChinese` 新增 `styleDesc?` 參數）
3. **生成時**：非 Nano 路徑 → prepend `【參考圖風格】` 到 brief；Nano 路徑 → ref 圖 → JPEG data URI → `falSceneFromRef`
4. **分析範圍**：只分析色調/光影/質感/情緒氣氛，**刻意排除構圖/佈局**（避免干擾用戶的構圖描述）
5. **儲存**：`refImageUrl` 記入背景 `data.refImageUrl` 或 LibraryImage `paramsJson.refImageUrl`

### Nano Banana 風格遷移引擎

- **觸發**：有參考圖 + 選 Nano Banana 引擎（三種素材類型均可用）
- **原理**：`falSceneFromRef`（`fal-ai/nano-banana/edit`），prompt 明確指示只借色調/光影/質感/氣氛，**不複製構圖/內容/主題**
- **引擎標籤**：FLUX.1 按素材類型顯示正確名稱（背景=FLUX.1、人像=FLUX.2 pro、插畫=Recraft V3）+ 副標「純文字生圖」
- **Nano 禁用邏輯**：無參考圖時自動 disable，清除參考圖時重置回 flux

### Popup 顯示參考圖

三個 popup 分支（背景/人像插畫/主 popup）均顯示參考圖：
- 圖片放大：`w-full max-h-64 object-contain`（原 `w-24 h-24`）
- 若為 http URL → 在圖下顯示可點擊連結（置中，`<a>`）

### 「重新生成/調整」按鈕

**素材生成結果頁**：Results 頂部 + Footer 各加一個「重新生成/調整」按鈕，清空 items 返回設定頁，description / refImageUrl 保留在 state。

**圖庫 popup**（背景/人像/插畫分支）：底部加「重新生成 / 調整（帶入素材生成）」按鈕：
- 關閉 popup → 切換到「風格組件」tab → 帶預填資料（description + refImageUrl + type + engine）打開 GenerateAssetModal
- `GenerateAssetModal` 新增 `init?` prop，用 `useState(init?.xxx ?? default)` 初始化
- `library/page.tsx`：新增 `generateAssetInit` state + `handleOpenGenerateAsset` callback，傳 `mode`（從 paramsJson）和 `onOpenGenerateAsset` 給 ImageDetailModal

### Phase 3（2026-06-13）：AI 讀圖填描述 + 潤色 UX 優化

**核心功能：`describe?kind=brief` — 自動讀圖填描述初稿**

| 觸發點 | 行為 |
|---|---|
| URL 欄 `onBlur`（貼完連結離開） | 描述為空時，自動 AI 讀圖填 20–30 字初稿（靜默，不覆蓋） |
| 上傳圖片成功後 | 同上 |
| 「重新讀圖」按鈕（藍色 RefreshCw）| 手動觸發，強制覆蓋現有描述 |

**潤色 UX 改進**
- 有圖無描述時「潤色」可觸發：自動先讀圖填初稿，再對初稿潤色（一鍵兩步）
- 按鈕 disabled 條件收緊：只有描述和參考圖**均為空**時才 disabled
- 潤色輸出由「4–6 句」→「100 字內，簡潔有創意，留空間給用戶修改」

**UI 調整**
- 「重新讀圖」按鈕移至描述欄右上角，與「潤色」並排（原在 label 旁，太細不顯眼）
- Loading 分離：`refDescribing` state 獨立，label 旁顯示「讀圖中…」spinner，按鈕文字不受影響
- 潤色按鈕文字統一改為「潤色」（去 emoji，去「讀圖」字眼，讀圖是後台隱式行為）

---

## API endpoints（累計）
| Method | Path | 功能 |
|--------|------|------|
| GET | `/api/clients` / `/api/assets` / `/api/activities` | 客戶 / 活動圖 / 活動 |
| GET | `/api/components` | 組件列表，支援 ?clientId= ?previewUrl= |
| POST | `/api/components` | 建立／upsert（同 previewUrl+type 更新置頂） |
| PATCH | `/api/components/[id]` | 編輯更新組件 |
| DELETE | `/api/components/[id]` | 刪除組件 |
| POST | `/api/components/analyze` | OpenRouter 圖片分析（繁中、含 extraColors） |
| GET | `/api/library/gallery` | 品牌圖庫 union（上傳 + 生成） |
| POST | `/api/library/generate` | 生成圖（繁中brief→翻英→fal/HF）+ 文案；composite=Bria合成→sharp備援；draftOnly=只存檔 |
| POST | `/api/library/save-image` | 把 draft 圖寫入 LibraryImage（背景生成保留時用） |
| PATCH | `/api/library/images/[id]` | 更新生成圖：`slots`（改寫 paramsJson）/ `clientId`（搬專案）/ `subject`（改標題）；會 bump createdAt 排到最新 |
| DELETE | `/api/library/images/[id]` | 刪除生成圖（LibraryImage） |
| POST | `/api/library/describe` | vision 描述；`kind=brief`（20–30字生成初稿，接 `genType`）/ `kind=background`（20字場景）/ 預設（20字主體） |
| POST | `/api/library/polish` | 潤色繁中 brief；`refImageUrl?`：先分析風格再融入潤色；輸出 100 字內 |
| POST | `/api/upload` | 上傳圖片到 public/uploads/ |

> `POST /api/library/generate` 進階參數（Phase 2 更新）：`refImageUrl?`（參考風格圖）、`engine`（flux/nano/bria/gpt）、`genType`（background/person/illustration/scene）、`size`（square/landscape）、`productImageUrls[]`（1–3 件，合成模式）、`preserveText`(舊)/`upscaleSource`/`overlay`（dormant）。合成排序見 [AI-ENGINES.md](./AI-ENGINES.md)。

## 關鍵檔案
- `src/app/library/page.tsx` — 素材庫頁（2 tabs，統一管理 popup/toast/編輯/重生成）
- `src/components/library/` — PromptComposer / ComponentGrid / AssetGrid / QuickAddModal / GenerateAssetModal(背景生成) / ImageDetailModal / SlotPickerModal / ColorCards
- `src/lib/generate.ts` — 生成抽象層（compileChineseBrief / translateBriefToEnglishPrompt / generateImage 鏈 / **falImageEdit(nano-banana) / falProductShot(Bria) / gptImageComposite / falRemoveBg / falUpscale** / generateCopy）。**頂部有模型常數一覽 + 改排序指引**。
- `src/app/api/library/generate/route.ts` — 合成主流程；搜 `手動改` 睇引擎排序註解
- `src/types/library.ts` — 型別 + CATEGORY_META + PALETTE_ROLES + getColors() + **engineLabel()**（引擎徽章）
- `src/types/presets.ts` — 行業範本
- 文檔：[index.md](./index.md)（總目錄）、[AI-ENGINES.md](./AI-ENGINES.md)、[GUIDE-新手使用.md](./GUIDE-新手使用.md)
- 測試素材：`.claude/TESTING_MATERIALS_BY_INDUSTRY.md`、`.claude/TEST_MATERIALS.md`（圖片在 `public/uploads/`，gitignore，需從備份帶過去）
