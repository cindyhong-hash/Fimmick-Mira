# AGENTS.md

給在本 repo 工作的 AI coding agent 的實務指南。目標：讓你**快速抓到架構、遵守既有慣例、避開雷區**。使用者說明文件見 `README.md` 與 `docs/`（SETUP / MIGRATION / FEATURE_LOG / DECISIONS）。

---

## 專案一句話

社群行銷活動圖生成工具：由「產品圖 + 主題」用 AI 生成**單圖**或**多圖拼版**活動圖（自動配場景/模特/文案燒字），並有**素材庫**餵料。**Next.js 16 (App Router) + React 19 + Prisma 7 / SQLite + sharp**。AI 走 **OpenRouter**（Claude / Gemini）與 **FAL**（FLUX、BiRefNet 去背）。

---

## 常用指令

```bash
npm run dev        # dotenv -e .env.local -- next dev（一定要有 .env.local）
npm run build      # next build
npm run lint       # eslint
npx prisma db push # 套用 schema 到 dev.db（附加式；改 schema 後必跑，會重生 client）
npx prisma generate
```

- **本機優先**：這是本機開發設計（見「雷區」的 SQLite / uploads）。
- **驗證改動**：起 dev server（`http://localhost:3000`）用瀏覽器實看；生成類改動要實跑一次比對成品。無單元測試框架——以 `tsc --noEmit` + `build` + runtime 實跑為準。

---

## 架構地圖

### 兩條生成流程（重要：別搞混）
| | 單圖 / 底圖 | 多圖拼版 |
|---|---|---|
| 入口 route | `POST /api/generate` | 同上，`route.ts` 內判斷 `activity.layoutId !== "single"` → 轉呼叫 `generateMulti()` |
| 核心 lib | `src/lib/generate.ts`、`composite.ts` | `src/lib/generate-multi.ts`、`composite-multi.ts`、`src/lib/multi/*` |
| 前端頁 | `activities/new/page.tsx`（單圖表單） | `activities/new/multi/page.tsx`（多圖表單） |
| 編輯畫布 | `EditorCanvas.tsx` | `MultiEditorCanvas.tsx`（`editor/page.tsx` 依 `isMulti` 分流） |

改單圖流程時**別動多圖檔**，反之亦然。`generate/route.ts` 的分支是兩者交界。

### 多圖「規劃層」（`src/lib/multi/`）
生成順序：`design-spec → frame-planner → prompt-builder → 既有生圖 → 既有合成`
- `design-spec.ts` — `GlobalDesignSpec`（全域外觀：人物/色系/光線/字體），Claude 生成 + **deterministic fallback**。
- `frame-planner.ts` — `FramePlan[]`（逐格鏡頭/構圖/情緒 + **文案**），格數動態對齊版型。
- `variant-style.ts` — A（導購/強對比/產品大）/ B（敘事/留白/生活感）設計語言常數。
- `prompt-builder.ts` — 固定 6 段結構組裝。**原則：重組不重寫**——既有 lock 區塊（`PRODUCT_IDENTITY_LOCK`、色溫鎖、NO-TEXT、razor exclusion…）由呼叫端（`generate-multi.ts`）以 `LockBlocks` 原封傳入，builder 只負責排列，**不得自行改寫 lock 內容**。

### AI 用戶端
- `src/lib/openrouter.ts` — 生圖 + 文字，支援多圖 `image_url` 參考輸入（Gemini）。
- `src/lib/anthropic.ts` — **Anthropic 形狀的 shim，實際打 OpenRouter**（`anthropic.messages.create(...)` 回傳 `{content:[{type:"text",text}]}`）。歷史殘留命名，別誤以為直連 Anthropic。
- `src/lib/fal.ts` — FAL：FLUX 生圖、`removeBackground`（BiRefNet）、inpaint。
- `src/lib/typography.ts` — 底圖模式文字排版引擎（同事維護）。

### 版型
`src/types/multiLayout.ts` — `MULTI_LAYOUTS`（single / carousel-2 / two-h / two-v / three-h-top / three-v-left / four-*/ four-grid(田字) / five-* / 5+）+ `getCellRects()`。

---

## 資料模型（Prisma）

`Client` → `Activity` → `GeneratedLayout`；素材庫 `LibraryImage`、`StyleComponent`。
- `Activity` 多圖欄位：`layoutId` / `genMode`(unified|perCell) / `cells`(JSON) / `logoMode` / `variantCount`(1 或 2=A/B) / `errorMessage`；單圖用 `imagePrompt` / `productImageUrls` / `baseImageUrl` / `typographyMood` 等。
- `GeneratedLayout.cellImageUrls` = 多圖各格 URL。
- schema 改動請走**附加式**（新欄位給 default / nullable），跑 `prisma db push`——別破壞既有資料（`dev.db` 有真實客戶資料）。

---

## 慣例

- **文字是合成的，不是模型畫的**：副圖文字由 `composite-multi.ts` 用 sharp+SVG 白卡後製；只有 hero 由模型燒入。要改文字外觀 → 改合成層，不是加 prompt。
- **產品用真圖合成**：hero/刀類產品用 `removeBackground` + `overlayProduct` 貼真圖（像素級一致），不信任模型重畫。
- **程式碼標記**：`[MULTI]`=多圖、`[COLLEAGUE]`=同事既有、`[2b]`=底圖模式。改動沿用對應標記。
- **註解語言**：既有註解夾雜繁中/粵語，跟隨鄰近風格即可。
- **檔案路徑用 `@/` alias**（`tsconfig` paths → `src/`）。
- **commit 訊息**：`type(scope): 中文說明`（如 `fix(multi): …`）。

---

## ⚠️ 雷區（務必知道）

1. **DB 是 SQLite（檔案 `prisma/dev.db`）**：**gitignored**、含真實客戶資料。換機/部署要另外帶。**Vercel/serverless 不能用**（唯讀檔案系統）。
2. **生成圖寫本機 `public/uploads/`**（`fs.writeFile`，也 gitignored）。**Vercel 不能寫檔** → 上雲要改雲端儲存（Blob/S3）。
3. **`.env.local` gitignored**：需 `OPENROUTER_API_KEY`、`FAL_KEY`、`DATABASE_URL`（見 `.env.example`）。缺了 dev server 起不來。
4. **生成很慢**：`/api/generate` `maxDuration=180`；A/B 兩組 ×2 時間。動生成流程時留意逾時。
5. **改 schema 一定重跑 `prisma db push`**（否則 Prisma Client 型別對不上，`tsc` 會報 `xxx does not exist in ...CreateInput`）。
6. 上 Vercel 的完整關卡與交接見專案根目錄外的部署清單（DB→雲、uploads→Blob、build 加 `prisma generate`、需 Pro）。

---

## 驗證流程（改動後）

1. `npx tsc --noEmit` — 型別。
2. `npm run build` — 打包/引用。
3. `npm run dev` → 瀏覽器實看對應頁；生成類改動實跑一次（單圖與多圖各測，確認未互相影響）。
4. 若動到 schema：先確認 `dev.db` 資料筆數不變（附加式）。
