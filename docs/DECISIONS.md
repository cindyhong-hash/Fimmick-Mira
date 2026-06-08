# 設計決定 Decisions

記低重要決定同理由，方便日後（或換機後）唔使重新諗。

## 生成後端：in-app 可抽換（非 n8n 起步）
- 文字用已有 OpenRouter key；圖片用免費來源。`GEN_PROVIDER=inapp|n8n` 開關，將來轉 n8n 只改 env。
- 理由：最快令功能 work；n8n 要起服務、維護、debug 較煩，留待之後。

## 圖片來源：Pollinations 主力 → HF 備援（實際靠 HF）
- 實測：Pollinations 免費匿名、甚至帶有效 token，對本機/datacenter IP 都回 **402**（x402 收費閘）。
- 故 `POLLINATIONS_TOKEN` 留空時直接行 **Hugging Face FLUX.1-schnell**（免費 token，端點 `router.huggingface.co`）。
- 舊 `api-inference.huggingface.co` 已停用（fetch failed），必須用 router 端點。

## 文案/分析語言：繁體中文（台灣）
- analyze 的 name/description/toneLabels + 生成文案 一律繁中台灣；只有餵圖像模型嘅英文 `aiPromptText` 保留英文。

## 配色：5 色 array
- 1 主色 + 輔色 + 強調色 + 中性色 + 點綴色（role-based array），上限只係 UI 常數可調。
- 向後相容：`getColors()` 讀唔到 `colors[]` 就由 legacy `primaryColor/secondaryColor` 合成。

## 「直接使用產品圖」：sharp 伺服器端合成
- 免費 text-to-image 唔做 img2img；要用「真產品」就靠 `sharp` 把**去背 PNG** 疊落背景（背景積木圖 / AI 生成背景）。
- 限制：必須透明去背 PNG。非透明 → 偵測 alpha 後提示先用 remove.bg / photoroom 去背。

## OpenRouter model 會輪換
- model id 會下架（曾遇 `gemini-2.0-flash-001` 404）。用 env 控制；404 時去 `/api/v1/models` 換現存平價 model。免費 `:free` model 常 429，不採用。

## 資料：本機 SQLite + 全 additive migration
- `dev.db` 只在本機（gitignore）；改 schema 一律 additive（新表 / nullable 欄），切勿 reset。
- 生成圖獨立存 `LibraryImage`（不污染 activity 的 `GeneratedLayout`）。

## AI 重新分析：upsert 而非新增
- 同一張圖（previewUrl）+ 同類型再分析 → 更新現有素材 + 置頂，唔建重複紀錄。

## UX
- 帶入素材 → 唔跳分頁，出自動消失 toast。
- slot / 圖片 / 卡片 統一用一個 `ImageDetailModal`（提升到 page 管理）。
- 編輯素材重用「加入素材」彈窗（編輯模式 + PATCH），介面一致。
