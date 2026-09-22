# 商品套圖升級：Visual Asset Kit（給 Codex 的規格）

> 這份是修訂版。原始草稿的方向是對的，但**核心前提與兩處資料結構跟現況不符**，
> 照原稿做會重建一個已經存在的東西、並且弄壞素材庫／自由畫布／AI 排版的既有整合。
> 已在下面逐項標註修正，並**把原稿要求的 Architecture Audit 直接填好答案**（已查證），
> 不用再花一輪盤點。

---

## 00 / 開始前必讀：三件跟你預期不一樣的事

### ① Visual Direction / Design Recipe 已經存在，不要重建

`src/lib/products/product-visual-analysis.ts:20`：

```ts
export type ImageSetArtDirection = {
  concept: string;                                  // = 原稿的 visualStyle
  palette: { dominant: string[]; accent: string[] }; // = primary/secondary/accentColor
  lighting: string;                                 // = lighting
  materials: string[];                              // = materials[]
  backgroundLanguage: string;                       // = environment
  cameraLanguage: string;                           // = composition
  consistencyRules: string[];                       // = 「所有素材要像同一檔」的規則
};
```

而且**運作方式就是原稿要求的那樣**：

- `image-set-orchestrator.ts:511` — `buildImageSetArtDirection()` **一個批次只算一次**
- 算完傳給該批所有素材共用（514 / 566 / 574 行）
- `compileImageSetPrompt()` 已把它注入**每一個角色**的 prompt
  （`image-set-prompts.ts` 的 104、107-108、141-142、159 行）
- profile 快取在 `Product.visualProfileJson`，重新生成不會重算

原稿第 6 節的「MASTER VISUAL PROMPT + ASSET SPECIFIC PROMPT」**也已經是現在的架構**。

**所以 Phase 1 已完成約 85%。** 真正缺的只有下面三項，請只做這三項：

- `mood: string[]` — 目前部分語意藏在 `concept`，抽成獨立欄位
- `decorationStyle: string[]` — 目前沒有
- 讓使用者**看見並微調**這份 art direction 的 UI（目前完全沒有對外呈現）

### ② 沒有 `ProductAsset` 資料表，素材存在 `LibraryImage`

原稿第 8 節提議新開 `Asset { id, kitId, ... }`。**不要這樣做。**

```prisma
model LibraryImage {
  id, clientId, imageUrl, prompt, status, errorMessage
  batchId    String?   // 同一次生成的群組 ← 這就是原稿要的 kitId
  productId  String?   // 所屬產品（null＝一般素材）
  assetRole  String?   // hero｜texture｜background｜decoration…
  generationLeaseId / generationLeaseExpiresAt  // 付費生成的擁有權控制（CAS）
  @@index([productId])
  @@index([productId, status, generationLeaseExpiresAt])
}
```

**產品素材會自動出現在素材庫，就是因為它們本來就是 LibraryImage。**
新開一張表會導致：素材庫／自由畫布／AI 排版三處都要改、既有素材要遷移、
付費 lease 機制要重做（這塊最容易改出重複扣款或孤兒資料）、還要跑 Turso migration。

**改成**：沿用 `LibraryImage`，`kitId` 直接用既有的 `batchId`。需要的新欄位加在這張表上：

- `assetSubtype String?` — 同一 role 底下的變體（例如 texture 的 cream / foam / water）
- `hasTransparentBackground Boolean?` — **依實際產出檔案判定**，不可因為 prompt 要求透明就標記為透明（原稿這點說得對）

> 加欄位仍需 migration，但只是加欄位、不動既有資料，風險遠低於新開表。
> 遷移檔請一併產出，正式站是 Turso，部署前要套用。

### ③ 原稿沒寫、但使用者已經決定的三件事

1. **成本控制（必做）**：現在固定 5 張，升級後 12–20 張，**每張都是一次付費生圖**。
   使用者要求：**AI 先提建議清單 → 使用者勾選刪減 → 才送出生成**。
   UI 上要顯示「這批會生 N 張」。預設只勾核心 5 張，其餘由使用者加選。
2. **檔期／主題綁定（必做）**：使用者要能選檔期（中秋／週年慶／夏日…），
   AI 依主題加生對應的氛圍與裝飾元素。
   **現成資料直接接，不要自己造**：`src/lib/calendar/tw-calendar.ts` 的
   `PROMO_FIXED`（12 個電商檔期）與 `TAIWAN_SEASONAL`（每月 3 個季節主題）。
3. **文字與版型素材**：使用者希望有按鈕框、文案框、緞帶、標籤底這類版型元素。
   ⚠️ **但只生「無文字的空框」，不要讓 AI 畫字。**
   實證：目前背景素材上就有 AI 自己畫出來的亂碼英文
   （"Eaodr Shavts"、"Body indʌl Savd Pre-Shaving Care"）。AI 生圖畫中文幾乎必然出錯，
   而且事後改不了字、換不了字體。文字一律交給自由畫布的文字圖層
   （那裡可用使用者上傳的品牌字體）。

---

## 01 / Architecture Audit（已查證，直接用）

| # | 問題 | 答案 |
|---|---|---|
| 1 | 入口 route | `src/app/clients/[clientId]/products/[productId]/page.tsx` |
| 2 | 主要 components | `components/products/ImageSetModal.tsx`（生成流程＋進度）、`ProductGrid.tsx`、`NewProductModal.tsx` |
| 3 | Product Analysis | `lib/products/product-visual-analysis.ts`（呼叫 vision）、`product-visual-profile.ts`（型別＋解析＋快取雜湊）。結果存 `Product.visualProfileJson`，以 `visualProfileSourceHash` 判斷是否需重算 |
| 4 | 五種素材 Prompt | 角色定義 `lib/products/image-set-roles.ts` 的 `planImageSetRoles()`（**目前回傳固定 5 筆**）；prompt 組裝 `lib/products/image-set-prompts.ts` 的 `compileImageSetPrompt()` |
| 5 | 生圖 API | route：`app/api/products/[productId]/image-set/route.ts`（生成）、`image-set/analyze/route.ts`（分析）、`hero/route.ts`（去背）。模型路由 `lib/products/image-set-model-router.ts`（fal：seedream / fluxEdit / removeBg，含 fallback 與時間預算） |
| 6 | Assets 如何儲存 | `LibraryImage` 一列一張，`imageUrl` 指向 Vercel Blob。**沒有獨立 asset 表** |
| 7 | DB models | `Client / Activity / GeneratedLayout / StyleComponent / LibraryImage / ImageAssetCleanupJob / Product / MonthlyMarketingPlan / MarketingCampaign / CampaignProduct / CampaignImportantDate / ContentPlanItem` |
| 8 | 素材庫資料結構 | 圖片 = `LibraryImage`；風格積木 = `StyleComponent`（含品牌字體 `type="FONT"`）。畫廊 API 以 `previewUrl: { not: null }` 過濾 |
| 9 | 自由畫布 import | 透過 sessionStorage handoff：`ML_COMPOSE_BG_KEY` / `ML_COMPOSE_CLIENT_KEY` / `ML_WIZARD_SEED_KEY`（定義在 `components/activities/RolePickerModal.tsx`），由 `components/magic-layers/ComposeView.tsx` 讀取 |
| 10 | AI 排版如何取素材 | `app/api/magic-layers/ad-layout/route.ts:45` 直接查 `product.assets`（= 該產品的 LibraryImage，`status: "DONE"`），依 `assetRole` 分派到 hero／background／detail／benefit／decoration |
| 11 | 可直接沿用 | Product Analysis、ArtDirection、生圖 model router、Blob 儲存、LibraryImage、素材庫、自由畫布、AI 排版、付費 lease／孤兒清理機制 |
| 12 | 需要新增 | 可變長度的角色清單、主題（檔期）輸入、生成前的清單確認 UI、Asset Board 頁、`assetSubtype` / `hasTransparentBackground` 欄位 |

---

## 02 / 這次要做什麼（依原稿調整）

### Phase 1 — 擴充 Art Direction（**不是新建**）

- 在 `ImageSetArtDirection` 補 `mood: string[]`、`decorationStyle: string[]`
- 讓 `buildImageSetArtDirection()` 接受**主題參數**（檔期／季節），把主題語彙併入
  `concept` / `decorationStyle` / `consistencyRules`
- 新增 UI：生成前顯示這份 art direction（色票、光線、材質、氛圍），使用者可微調
- **驗收**：同一產品、不同主題，產出的 art direction 要有可觀察的差異；
  同一主題重跑兩次要一致（deterministic）

### Phase 2 — 可變長度的 Asset Kit + 清單確認

- `planImageSetRoles()` 改成依 profile + 主題回傳**可變長度**清單，每筆帶 `subtype` 與用途說明
- 新增「規劃」API：回傳建議清單但**不生成**
- `ImageSetModal` 增加確認步驟：清單以勾選呈現，**預設只勾核心 5 張**，
  顯示「這批會生 N 張」，使用者確認後才送出
- 類別（保留原有分類，每類可多張）：
  - `product` — 商品主體、去背、特寫
  - `texture` — 質地細節（cream / foam / water…）
  - `background` — 情境背景（主場景 / 局部 / 純淨底）
  - `benefit` — 賣點視覺
  - `decoration` — 裝飾元素、主題元素（依檔期）、圖樣、**無文字的版型框**
- **成本護欄**：單批上限請設成可設定常數，不要 hard code；超過時 UI 要警告

### Phase 3 — Visual Asset Board

- 完成後導向「商品視覺套組」頁（原稿第 9–11 節照做）
- Modal 只負責完成通知 + 導向，不塞完整素材
- Key Visual 只是 Preview，**不可當素材來源**（原稿這點寫得對，務必遵守）
- 生成中的進度文案照原稿第 16 節（分階段敘述，不只列完成項目）

### Phase 4 — 串接

- 「使用整套素材建立廣告」→ 丟給現有 AI 排版，**不要建第二套 editor**
- 「進入自由排版」→ 沿用現有 sessionStorage handoff
- 單張重新生成要沿用原 art direction（原稿第 14 節，現有架構已支援）

---

## 03 / 不要做

- 不要新開 asset 資料表（用 `LibraryImage` + `batchId`）
- 不要重寫 Product Analysis 或 ArtDirection（已存在且運作正常）
- 不要建第二套 editor
- 不要讓 AI 畫文字（只生無文字的框）
- 不要生成一張不可拆解的大拼貼當素材
- 不要 hard code 任何品牌／產品資料
- 不要改動目前的 Design System（紫色主色、卡片、Modal、字級）

---

## 04 / 先修一個既有問題

`ImageSetModal.tsx` 目前就有一個使用者回報過的錯誤：

> 「無法讀取既有套圖進度：既有套圖進度資料尚未完整，請重新讀取。」
> （約在 `loadRows` 對 `complete` 的檢查附近）

這次要大改這個元件，**請先查清楚並修好**，否則之後分不清是新問題還是舊問題。
先判斷是「資料真的不完整」還是「檢查太嚴格」——兩者修法完全不同。

---

## 05 / 驗收條件

```bash
npx prisma generate      # 沒跑這行 tsc 會噴一堆 Prisma 欄位不存在的假錯誤
npx tsc --noEmit         # 必須 0 error
npx next build           # 必須 EXIT=0
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts" "src/components/**/*.test.ts"
```

- 測試**只允許** `planner/content-brief` 一個既有失敗。**請跑全套，不要只跑子集**
  （前幾輪有三次回報「全數通過」但全套有失敗，都是只跑了相關子集）
- 改動的檔案 `npx eslint <files>` 要 0 error。全 repo 目前有既有 error，不要增加
- **實際生成一組**看結果，並貼出：art direction 內容、素材清單、各類數量、失敗數
- 若新增 DB 欄位，請一併產出 migration 並註明「正式站是 Turso，部署前要套用」

## 06 / 環境提醒

- dev server 用 `preview_start` 的設定，不要用 Bash 跑 `next dev`，也不要在別的目錄再開一個（Next 16 會拒絕）
- 「AI 幫我排版」在正式站是關的（`SHOW_AD_LAYOUT`，讀 `NEXT_PUBLIC_SHOW_AD_LAYOUT`）；
  要測加網址參數 `?adlayout=1`，關掉用 `?adlayout=0`
- **「AI 建立商品套圖」會消耗付費生圖**，測試前先確認要生幾張
