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

---

# Phase 2 決定（2026-06-12 → 06-13）

## 背景 popup：用 genType hint 避免先跳框再縮
- **問題**：從 gallery 點背景圖 → modal 先 render `max-w-5xl`（loading 狀態）→ API 返回後縮成 `max-w-2xl`，視覺上有跳動。
- **解決**：gallery click 時在 `regenerateParams` 加入 `{ genType: "material" }` hint。Modal 檢查 `genType === "material"` → 第一格 render 就用正確框尺寸，完全消除跳動。
- **組件卡片 click**：額外傳 `presetComponents: [comp]`（instant display，不需等 API）+ 同樣加 hint。
- **取捨**：hint 是 UI-level 信號，不存 DB，只用於解決 render 時序問題。

## 參考風格圖：分析範圍限「風格」不含「構圖」
- **決定**：`describeReferenceStyle` 的 vision prompt 和 `polishBriefToChinese` 的 styleHint **刻意排除構圖/佈局/畫面內容**，只分析色調/光影/質感/情緒。
- **理由**：構圖是用戶主動在描述欄控制的，若 AI 從參考圖自動帶入構圖，會違反用戶原意，且難以預測。風格（色調、光影、質感）遷移才是用戶的真實意圖。
- **體現**：Vision prompt 明寫「不要描述構圖或佈局」；`falSceneFromRef` prompt 明寫「Do NOT copy composition/layout/subject matter」。

## Nano Banana 作素材生成引擎：風格遷移而非內容複製
- **問題**：nano-banana 是 image-editing model，收參考圖時可能直接複製構圖/內容，不是真正「借風格」。
- **解決**：在 `falSceneFromRef` 的 prompt 明確聲明：reference image = style guide only（color palette, lighting, texture, atmosphere），並強調「Do NOT copy composition, layout, or subject matter。The result must be entirely different in content。」
- **效果**：prompt engineering 方式；nano-banana 本身仍有可能有偏差，但明確 instruction 顯著降低內容複製的機率。
- **適用範圍**：三種素材類型（背景/人像/插畫）均可用 Nano Banana + 參考圖；Nano 只在有參考圖時才可選。

## GenerateAssetModal init prop：從 popup 預填值打開
- **問題**：圖庫 popup「重新生成/調整」要把當前圖片的 description/refImageUrl/type/engine 帶入 GenerateAssetModal。
- **解決**：GenerateAssetModal 加 `init?` prop；`useState(init?.xxx ?? default)` 直接用 prop 初始化 state（組件生命週期開始時已帶入，不需 effect）。parent（library/page.tsx）從 paramsJson + bgComp.data 提取資料，關閉 modal 時清空 `generateAssetInit` state。
- **取捨**：用 init prop 而非 context/store，因為 GenerateAssetModal 只由一個父層控制，簡單夠用。

## engineLabel 顯示正確引擎名（唔 hardcode「AI生成」）
- **問題**：舊有背景 tile 一律顯示「AI生成」，唔知用乜引擎。
- **解決**：儲存時加入 `mode` 到 data/paramsJson；Gallery API 回傳 `mode`；`engineLabel()` 按 mode 返回人類可讀名稱（FLUX.1/FLUX.2 pro/Recraft V3/Nano Banana）。
- **engineLabel map**（`types/library.ts`）：`"flux-scene"→"FLUX.1"`、`"flux2-person"→"FLUX.2 pro"`、`"recraft-illustration"→"Recraft V3"`、`"nano-banana"→"Nano Banana"`。

## 素材類型 engine label：顯示實際引擎名 + 「純文字生圖」說明
- FLUX 系列（背景/人像/插畫各用不同 FLUX endpoint）：副標加「純文字生圖」說明用戶輸入只靠文字。
- Nano Banana：副標「參考圖風格遷移（需有參考圖）」。
- 每次切換素材類型時同時 reset engine 為 `"flux"`（防殘留上次選的 nano 但新類型情況不同）。

---

# Phase 3 決定（2026-06-13）

## 參考風格圖 AI 讀圖填描述（describe?kind=brief）
- **決定**：`/api/library/describe` 加 `kind="brief"` 模式，接受 `genType`（person/illustration/background），用 vision model 分析圖片並回傳 20–30 字簡潔生成描述初稿。
- **理由**：用戶貼/上傳參考圖後描述欄是空的，要靠用戶自己從頭寫太慢；AI 給一句初稿，用戶改比從零寫快得多。
- **範圍刻意縮短**：初稿只要 20–30 字（一句話），只說主要視覺元素/色調/氛圍，不要長篇創意發揮——那是用戶或潤色再做的事。
- **取捨**：不同於潤色（polishBriefToChinese），describe brief 不帶入 styleDesc，因為此時重點是告訴系統「圖裡有什麼」，不是融合風格。

## AI 讀圖觸發策略：自動觸發 + 手動按鈕分離
- **自動觸發（靜默，不覆蓋）**：URL 欄 `onBlur` + 上傳圖片成功後，如描述欄**為空**才填入。有描述時靜默不覆蓋，避免打斷用戶已寫的內容。
- **手動觸發（強制覆蓋）**：「重新讀圖」按鈕（`RefreshCw` icon，天藍色），`force=true` 無論有無描述都覆蓋。按鈕只在有參考圖時顯示。
- **loading 分離**：`refDescribing` 與 `polishing` 獨立 state；讀圖進行中在 label 旁顯示獨立 spinner「讀圖中…」，按鈕文字不變（讓用戶清楚看到「重新讀圖」按鈕始終在那裡）。

## 潤色可在空描述 + 有參考圖時觸發（先讀圖再潤色）
- **問題**：舊版 polish 在 `!description.trim()` 時直接 return，用戶有圖無描述時「潤色」按鈕是灰的，反直覺。
- **解決**：`polish()` 改成：有圖無描述 → 先呼叫 describe brief → 填入描述 → 再用這個初稿去潤色。用戶一鍵完成「讀圖 → 潤色」。有描述 → 直接潤色（原有行為不變）。
- **按鈕 disabled 條件**：改為 `!description && !refImageUrl`，只有兩者皆空才 disabled。

## 「重新讀圖」按鈕移到潤色旁邊（右側工具列）
- **決定**：把 AI 讀圖按鈕從 label 左邊移到描述欄右上角，與「潤色」並排。
- **理由**：放 label 旁邊太細、不顯眼；用戶以為是 label 的一部分。移到右側、用天藍色邊框 + `RefreshCw` icon，視覺上是可點擊的動作按鈕。

## 潤色按鈕文字去 emoji、去「讀圖」字眼
- **決定**：按鈕統一叫「潤色」，不管有無參考圖（舊版有圖時叫「✨ 讀圖潤色」）。
- **理由**：讀圖是後台自動的事，不需要告訴用戶按鈕名稱；emoji 視覺噪音。按鈕職責是「潤色」，怎麼實現是實作細節。

## polish 輸出長度：4–6 句 → 100 字內
- **決定**：`polishBriefToChinese` system prompt 第 3 條改為「100字內（含標點），簡潔有創意，留空間給用戶和 AI 修改，不要過度鋪排」。
- **理由**：用戶明確說「不用很長，100字內就夠，簡而精，留點創意空間」。長 brief 反而限死了後續 AI 的發揮空間，也讓用戶懶得改。
