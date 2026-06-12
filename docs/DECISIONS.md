# 設計決定 Decisions

記低重要決定同理由，方便日後（或換機後）唔使重新諗。

## 生成後端：in-app 可抽換（非 n8n 起步）
- 文字用已有 OpenRouter key；圖片用免費來源。`GEN_PROVIDER=inapp|n8n` 開關，將來轉 n8n 只改 env。
- 理由：最快令功能 work；n8n 要起服務、維護、debug 較煩，留待之後。

## 圖片來源（text→image）：fal.ai 主力 → HF 備援 → Pollinations 最後（2026-06-09 起）
- **主力 fal.ai FLUX.1-schnell**（`FAL_KEY`，端點 `fal.run/fal-ai/flux/schnell`）。
- 備援 **Hugging Face FLUX.1-schnell**（`HF_TOKEN`，端點 `router.huggingface.co`；舊 `api-inference.huggingface.co` 已死）。
- 最後 Pollinations：免費匿名/部分 IP 回 **402**，`POLLINATIONS_TOKEN` 留空＝實際停用。

## 文案/分析語言：繁體中文（台灣）
- analyze 的 name/description/toneLabels + 生成文案 一律繁中台灣；只有餵圖像模型嘅英文 `aiPromptText` 保留英文。

## 配色：5 色 array
- 1 主色 + 輔色 + 強調色 + 中性色 + 點綴色（role-based array），上限只係 UI 常數可調。
- 向後相容：`getColors()` 讀唔到 `colors[]` 就由 legacy `primaryColor/secondaryColor` 合成。

## 產品合成：fal.ai Bria Product Shot 為主，sharp 疊圖為備援（2026-06-11 更新）
- **主力**：`fal-ai/bria/product-shot`（**約 $0.04/張**）——餵去背產品圖 + 背景圖(`ref_image_url`) 或文字場景(`scene_description`)，AI 自動置入並**修光/陰影/透視融合**（電商導向、商用授權）。
- **備援**：AI 合成失敗時，退回舊 `sharp` 機械式疊圖（需透明去背 PNG；非透明 → 提示去背）。
- 圖片以 **data URI（base64）** 傳畀 fal，避免 fal 伺服器讀唔到本機 `/uploads`。
- 取代咗舊「只用 sharp」決定（sharp 純疊圖無修光，效果差，故降為 fallback）。

## OpenRouter model：vision + text 都用 `openai/gpt-4o-mini`（2026-06-11 更新）
- 由 `openai/gpt-5.4-nano` 改 `openai/gpt-4o-mini`：**更平**（輸入 $0.15 / 輸出 $0.60 per 1M，vs nano $0.20 / $1.25）、**支援 vision（食圖）**、穩定。
- 仍由 env 控制（`OPENROUTER_VISION_MODEL` / `OPENROUTER_TEXT_MODEL`）；404 時去 `/api/v1/models` 換現存平價 model。免費 `:free` model 常 429，不採用。

## 設計描述：繁中為主 → 生成時自動翻英（2026-06-11 更新）
- 用戶喺積木組合台用**繁體中文**砌設計描述（構圖/配色/語氣/主體/備註，背景除外）。
- 生成時 `translateBriefToEnglishPrompt`（OpenRouter）把繁中 brief 翻成優化英文 prompt 餵 FLUX（FLUX 對英文遠勝中文）。
- 「設計描述預覽」係**唯讀**（鎖 icon），所有編輯喺上面欄位做。

## 背景 = 純圖片資產（2026-06-11 更新）
- 背景**只係圖片**（無文字描述），只用於**合成模式**做底圖；**唔入文字 brief**（純文字生成唔受背景影響）。
- 來源：**背景生成**（fal 圖片鏈，prompt 強制無人/文字/產品）或上傳；**唔再由相片分析自動產生**。
- 圖庫三分類：**🟠 背景（素材）/ 🟢 上傳（分析圖）/ 🟣 AI生成（生成圖）**。背景 popup 只顯示正方形圖 + 帶入生成 + 刪除。

## 以圖為單位編輯（image-based edit，2026-06-11）
- 上傳分析圖 = 一張圖綁住 構圖+配色+語氣（三者一體）。圖片風格 popup「**調整**」→ 一次載入該圖 3 個組件同步改、一次存（`POST /api/components` 按 previewUrl+type upsert）；**uncheck 某類 → 刪除該組件**。
- 風格組件卡改圖片式（圖+名稱 overlay + 帶入生成 + 刪除，無逐個 pencil）；點卡 → 開該圖 popup。
- 移除 QuickAddModal 各類的「AI Prompt」欄（唔用於生成）。

## 素材庫 layout（2026-06-11）
- `/library` **收起全域 Sidebar**（只此頁），改用素材庫自己嘅「客戶資料夾」欄做唯一左欄，頂部「**《 返回客戶**」→ `/clients`。其他頁全域 Sidebar 不變。
- 預設：客戶「全部」+ 「風格組件」分頁（tab 順序：風格組件 在前）。
- Composer 反應慢修正：改用 React「render 期間比較 prev state」重置 override（取代 setState-in-effect，消除連鎖重繪）。

## 資料：本機 SQLite + 全 additive migration
- `dev.db` 只在本機（gitignore）；改 schema 一律 additive（新表 / nullable 欄），切勿 reset。
- 生成圖獨立存 `LibraryImage`（不污染 activity 的 `GeneratedLayout`）。

## AI 重新分析：upsert 而非新增
- 同一張圖（previewUrl）+ 同類型再分析 → 更新現有素材 + 置頂，唔建重複紀錄。

## UX
- 帶入素材 → 唔跳分頁，出自動消失 toast。
- slot / 圖片 / 卡片 統一用一個 `ImageDetailModal`（提升到 page 管理）。
- 編輯素材重用「加入素材」彈窗（編輯模式 + PATCH），介面一致。

---

# 第三輪決定（2026-06-11 → 06-13）

> 完整時序見 [FEATURE_LOG.md](./FEATURE_LOG.md)「第三輪」；引擎細節見 [AI-ENGINES.md](./AI-ENGINES.md)。

## 產品合成引擎：3 揀 1 + 自動 fallback（取代「Bria 主力 / sharp 備援」）
- **討論過程**：
  1. 發現 Bria `ref_image_url` 只做風格參考、唔原樣用背景 → 想搵能「用真背景 + 自然」嘅方案。
  2. 試 **GPT-5.4 image 2**：payload（PNG/兩圖）整到 timeout，修完仍發現 provider **本身 intermittent**（時秒回、時 hang 幾分鐘）。
  3. 試 **fal nano-banana**（Gemini）：穩、快、收多圖、可用真背景 → **升做主力**。
- **最終決定**：UI 可揀 `nano`（預設，自然、多產品）/ `bria`（保留文字、單圖）/ `gpt`（測試）；route 按揀嘅 engine **先試主力再 fallback**，最後 sharp。
- 排序喺 `route.ts` 嘅 `order`（有註解教改）。

## 文字保留：Bria product-shot（單圖），唔靠去背疊圖
- **討論**：產品中文標籤被重畫模型整爛。試過「去背+疊原相」→ 有毛邊、只能置中、死版。
- **最終**：用 **Bria product-shot**（保留產品原像素、automatic 自然擺位、乾淨 matte）；多產品（Bria 單圖）時用 nano-banana。
- **認清限制**：force「繁中/UTF-8 output」對圖片文字**無用**（圖係像素冇編碼）；斜面/弧面標籤冇可靠重造法 → 靠保留原相。

## OpenRouter 圖像模型：gpt-5.4-image-2（非 mini）
- 試過 `gpt-5-image-mini`（最平、初測秒回）→ **質素唔好** + 重測一樣 intermittent → **回推 `gpt-5.4-image-2`**，GPT timeout 設 **60s**。
- 結論：OpenRouter 上 OpenAI 影像模型全部不穩，只做「測試/撞順風」，唔做穩定主力（要穩 → 直連 OpenAI 官方 API）。

## 分析模型：改返 gpt-5.4-nano（覆蓋舊「gpt-4o-mini」決定）
- 比較 5 張參考圖：`gpt-5.4-nano` 構圖讀得準（唔套版）、抓到品牌主導色、識分促銷語氣，勝 `gpt-4o-mini`。
- 同時**收緊 analyze prompt**：據實判讀（禁一律「產品居中」、主色要取實際主導色）+ 硬性字數上限。
- `OPENROUTER_VISION_MODEL = openai/gpt-5.4-nano`（text 文案仍 gpt-4o-mini）。

## 生成圖「調整」寫返 paramsJson（唔寫 StyleComponent）
- 生成圖嘅構圖/配色/語氣係 `paramsJson.slots` 快照；編輯改寫 paramsJson（新增 `PATCH /api/library/images/[id]`），唔再產生孤兒 StyleComponent 或誤刪來源素材。編輯後 bump createdAt 排最新。

## 組件 upsert：match previewUrl+type（去掉 clientId）
- 之前 match 連 clientId → 改專案時會 fork 重複。改成 match `previewUrl+type`、update 寫 clientId → **搬專案而唔 fork**。

## 圖片文字清晰：認限制 + 分工（唔做以下）
- ❌ 文字疊真字 overlay（用戶覺得效果唔好、只適合平面文案）→ 移除（後端 dormant）。
- ❌ 源圖高清化 upscale（低清救唔返、會亂估字）→ 移除（dormant）。
- ❌ 超採樣 shot_size 落 Bria（Bria 固定 1MP，反而更糊）→ 移除。
- ✅ 留低：Bria 保留原相（文字安全）、nano-banana（自然）。

## 超採樣只用於真高清 render
- 2x render 再 lanczos 縮 → FLUX 全 AI 生成、sharp 疊圖**有效**；Bria（固定解析度）**無效甚至更糊**，故 Bria 唔用。

## UI 收斂（本輪）
- 移除語氣積木（composer）；背景積木叫返「背景」；生成結果框 + 圖片紀錄卡 + ImageDetailModal **唔顯示文案**（AI Prompt 保留、可改標題）。
- 圖庫/生成圖/背景 gallery 一致：**全圖 object-contain + 尺寸標籤 + AI生成/引擎徽章**。
- 多產品（≥3）時背景 → 文字參考（唔當圖片輸入，免過載 nano-banana）。
