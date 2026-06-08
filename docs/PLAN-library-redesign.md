# /library 重構 + 接上 AI 生成 — 實作計劃

## Context（點解要改）
`/library` 目前三個分頁（生成圖片 / 風格組件 / 圖片分析）感覺各自為政，唔似一個「睇晒每個客戶素材」嘅系統。三個核心問題：
1. **生成圖片唔 work**：`PromptComposer` 個「生成新圖」掣冇 onClick，積木 slot 唔可以直接點，而且根本冇圖片生成後端（`/api/generate` 用 picsum 假圖 + 已壞嘅 Anthropic key）。
2. **資訊割裂**：圖片分析自成一個 tab，用戶要喺唔同地方睇同一張圖嘅風格。配色淨係 2 隻色、色卡細到睇唔到。
3. **缺背景維度**：冇「背景」呢個素材類別。

目標：接上免費 AI（文字 + 圖片）令生成真係 work；把圖片分析併入風格組件做成「品牌圖庫 → 點圖睇風格 → 帶入生成」嘅一致流程；配色升級到 5 色 + coolors 風色卡；新增背景類別。**一次過全部做。**

## 已鎖定決定（來自你嘅回答）
- **生成後端**：In-app 免費 API，且**可抽換**。文字 = 你已有嘅 OpenRouter key + 免費模型；圖片 = Pollinations.ai（免 key）。寫成 `GEN_PROVIDER=inapp|n8n` 開關，將來轉 n8n 只改 env。
- **配色 = 5 色**（資料用 array 存，上限只係 UI 常數，隨時可調）。生成時每隻非主色有「使用 / 不使用」開關。
- **次序**：全部一次過做。

### 5 隻色命名（你叫我起，建議如下；label 可改）
| role key | 中文 label | 用途 | 生成可關 |
|---|---|---|---|
| `primary` | 主色 | 品牌核心、主導 60% | ✗（永遠用） |
| `secondary` | 輔色 | 次要搭配 30% | ✓ |
| `accent` | 強調色 | 重點 / CTA / 行動點 10% | ✓ |
| `neutral` | 中性色 | 背景 / 留白 / 文字底 | ✓ |
| `highlight` | 點綴色 | 細節提亮 / 裝飾 | ✓ |

---

## 1. 資料模型（Prisma，全部 additive、唔會掉資料）
檔案：`prisma/schema.prisma`
- 新增 `LibraryImage`（library 生成圖獨立存，**唔郁** `GeneratedLayout`，因為佢 FK 綁死 Activity）：
  ```
  model LibraryImage {
    id String @id @default(cuid())
    clientId String?        // null = 全部，沿用 StyleComponent 慣例（無 relation）
    imageUrl String          // 下載落 /uploads 後嘅本地路徑
    prompt String            // 實際送出嘅圖片 prompt
    copyText String?         // 生成文案
    subject String?
    paramsJson String @default("{}")  // slots / palette+flags / notes / seed 快照，供重現
    createdAt DateTime @default(now())
  }
  ```
- `Client` 加一個 nullable JSON 欄：`paletteColors String @default("[]")`（新色盤來源；保留 `primaryColor`/`secondaryColor` 做向後相容，寫入時兩邊同步）。
- 遷移：`DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name library_redesign`，**先睇產生嘅 migration.sql 確認只有 ADD COLUMN / CREATE TABLE，無 DROP**；永遠唔 `migrate reset`、唔刪 `dev.db`。

## 2. 生成抽象層（新檔 `src/lib/generate.ts`）
沿用 `analyze/route.ts` 已驗證嘅 OpenRouter `fetch` pattern。
- `generateCopy({subject, toneAiPrompt, toneLabels, notes, taboos})` → `{copyText}`：打 OpenRouter 純文字，`model = OPENROUTER_TEXT_MODEL`（預設 `google/gemini-2.0-flash-exp:free`）。非 200 要 catch，降級回空文案，唔阻圖片生成。
- `generateImage({prompt, width=1024, height=1024, seed})` → `{buffer, contentType}`：Pollinations
  `https://image.pollinations.ai/prompt/<encode(prompt)>?width&height&seed&nologo=true&model=flux`，`AbortSignal.timeout(60_000)`，**回傳 buffer**（唔 hotlink）。
- `compileImagePrompt(slots, palette, subject, notes)`：沿用 `[Layout]/[Color]/[Tone]/[Background]/[Subject]/[Notes]` bracket 格式；配色只併入 `use !== false` 嘅色。
- 頂層 `const provider = process.env.GEN_PROVIDER ?? "inapp"`；`n8n` 分支先留 thin stub（POST 去 `N8N_WEBHOOK_URL`）。

## 3. API routes
- **新** `POST /api/library/generate`（`src/app/api/library/generate/route.ts`）：收 `{clientId, subject, slots{layout,color,tone,background}, palette[{hex,role,use}], notes, seed?}` → 編 prompt → `generateImage` 落 buffer → 寫入 `public/uploads/<uuid>.png`（沿用 `upload/route.ts` 嘅 `writeFile`/`mkdir`）→ 同時 `generateCopy` → `db.libraryImage.create(...)` → 回 `{id, imageUrl, copyText, prompt, seed}`。失敗回結構化 `{error}`，唔建 row。
- **新** `GET /api/library/gallery?clientId=`：回「品牌全部圖」union — (a) 上傳分析圖（`styleComponent.previewUrl != null` 依 previewUrl group，含 types/componentIds）+ (b) `libraryImage` 各 row，按 createdAt 倒序。供合併分頁嘅圖庫用。
- **改（只 additive）** `components/analyze/route.ts`：prompt 多回 `colorScheme.extraColors: string[]`（0–3 個），**保留** `primaryColor`/`secondaryColor`（`QuickAddModal` 同 `ImageAnalyzer` 都靠呢兩個 key，不能改名）。背景係上傳取得、**唔加入 AI 分析**。
- **不變**：`components/route.ts`（POST 已對任意 `type`/`data` 通用，BACKGROUND 同 `colors[]` 唔使改）、`assets/route.ts`（活動流程照舊）。

## 4. 背景類別 BACKGROUND（穿過 types + UI）
- `src/types/library.ts`：`ComponentCategory` 加 `"BACKGROUND"`；`CATEGORY_META.BACKGROUND = {label:"背景", slot:"background", ...色}`；slot union 加 `"background"`；`PromptSlots` 加 `background`。
- data 形狀：`{imageUrl, description?}`，`aiPromptText` 帶文字描述餵 prompt。
- 上傳專用（無 AI）：file → `/api/upload` → POST component `type:"BACKGROUND"`。
- `PromptComposer` 加第 4 slot（grid 3→4，SlotCard 顯示背景縮圖）；`ComponentGrid` 加 BACKGROUND 篩選 tab + render 分支。

## 5. 5 色色盤（穿過 types + UI）
- COLOR_SCHEME `data`：`{colors:[{hex,role,label}], primaryColor, secondaryColor}`（array 為主、legacy 兩欄同步寫，保住舊讀者）。
- 新增共用 helper `getColors(data)` 於 `src/types/library.ts`：有 `colors[]` 用佢，否則由 `primaryColor`(+secondary) 合成。**所有**現時直接讀 `data.primaryColor/secondaryColor` 嘅位都改用佢（`PromptComposer.ColorDots`、`ComponentGrid` 色卡 IIFE）→ 保證舊 COLOR_SCHEME 仍正常顯示。
- **色卡 UI（coolors 風）**：由細圈圈改成大色塊卡，每塊下面顯示 hex（可點複製），佔比加大；風格組件每個 box 整體字級放大調整比例。
- 使用/不使用：生成時 UI state（非寫入 component），存喺 `PromptComposer`，連同 palette 送去 generate，順帶記入 `LibraryImage.paramsJson` 供重現。

## 6. 合併「圖片分析」入「風格組件」
- `src/app/library/page.tsx`：移除 `analyzer` tab、`ScanSearch` 按鈕、`analyzerImageUrl` deep-link；初始 `slots` 變 4 格。
- 合併後嘅「風格組件」分頁：
  - 預設 = **品牌圖庫**（`/api/library/gallery`，上傳分析圖 + 生成圖 union）。
  - 點任何一張圖 → **彈出 popup**（新組件 `ImageDetailModal.tsx`）顯示該圖 + 佢嘅 構圖/配色/語氣/背景 + 「帶入生成」掣。
  - 保留 構圖/配色/語氣/**背景** 子分頁；**hover 唔再出 preview**，改成**點擊卡片 → 開同一個 popup**（即圖庫點圖效果）。
  - 上傳→AI 分析→儲存 入口收進此分頁（沿用 `QuickAddModal`，已涵蓋 upload+AI+save）。
- `ImageAnalyzer.tsx`：邏輯被吸收，**刪除**。

## 7. 生成圖片分頁（接通）
- `PromptComposer`：4 slot + 色盤使用開關 + 新增「其他注意事項」free-text 欄（例：唔好用某色、要咩感覺）；個「生成新圖」掣接 `POST /api/library/generate`，loading/error 狀態，成功後刷新「圖片紀錄」。
- 「圖片紀錄」gallery 顯示 `LibraryImage`（同步出現喺合併分頁嘅品牌圖庫，達成「生成圖可加入風格組件區」）。

---

## 要新增 / 修改嘅檔案
**Schema**：`prisma/schema.prisma`(改) ＋ 新 migration（自動產生，先檢查）
**Lib**：`src/lib/generate.ts`(新)
**API**：`src/app/api/library/generate/route.ts`(新)、`src/app/api/library/gallery/route.ts`(新)、`src/app/api/components/analyze/route.ts`(改·additive)
**Types**：`src/types/library.ts`(改：BACKGROUND、4 slot、`getColors()`、palette/role 型別、gallery/LibraryImage 型別)
**前端**：`src/app/library/page.tsx`(改)、`src/components/library/PromptComposer.tsx`(改)、`src/components/library/ComponentGrid.tsx`(改)、`src/components/library/QuickAddModal.tsx`(改)、`src/components/library/AssetGrid.tsx`(改·指向 gallery)、`src/components/library/ImageDetailModal.tsx`(新 popup)、`src/components/library/ImageAnalyzer.tsx`(刪)
**Env**（`.env.local`，不 commit）：加 `OPENROUTER_TEXT_MODEL="google/gemini-2.0-flash-exp:free"`、`GEN_PROVIDER="inapp"`

## 風險 / 注意
- **Pollinations 圖一定下載落 `/uploads`**（唔 hotlink）：URL 每次重生、會慢、Next image domain 未設、避免日後失效。seed 記入 paramsJson。
- Pollinations 10–40s 可能慢/間中 down → 60s timeout、失敗回明確錯誤、retry 可試 `model=turbo`。
- 免費 OpenRouter 模型有 rate limit（429/503）→ `generateCopy` 失敗降級回空文案，圖片照存；model 由 env 控可隨時換付費。
- SQLite：`dev.db` 有真實資料，遷移只 additive，**唔 reset 唔刪**。
- `analyze` 係 `QuickAddModal` + `ImageAnalyzer` 共用契約 → 改動只能 additive（加 `extraColors`）。
- 活動流程產生嘅 component 無 `previewUrl` → 圖庫 query 過濾 `previewUrl != null`，唔會污染。
- `/uploads` 喺 serverless 唔持久（本地 dev 冇問題，已知限制）。

## 驗證（做完點測）
1. `npx prisma migrate dev` 後 `npx prisma generate`；確認 `dev.db` 資料仍在（測試品牌、舊 components）。
2. 用 preview tool 開 `/library`：
   - 風格組件分頁預設見到品牌圖庫；點圖出 popup（圖 + 構圖/配色/語氣/背景 + 帶入生成）；點子分頁卡片出同一 popup（hover 無 preview）。
   - 色卡係大色塊 + hex；舊 2 色 component 仍正常顯示。
   - 「加入素材」可上傳背景（BACKGROUND）＋ 一次過存 5 色配色。
3. 生成圖片分頁：揀積木 + 主體 + 注意事項 + 揀用邊幾隻色 → 按生成 → 等 Pollinations 出圖 → 圖入「圖片紀錄」同時出現喺品牌圖庫；文案有出（或降級訊息）。
4. 確認無 push `.env.local` / `dev.db` / `public/uploads`（已 gitignore）。
