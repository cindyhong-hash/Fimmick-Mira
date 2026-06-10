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
