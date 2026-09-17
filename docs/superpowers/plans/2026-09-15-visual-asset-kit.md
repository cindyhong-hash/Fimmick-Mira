# Visual Asset Kit Implementation Plan

> ⚠️ **開始前先讀 `docs/VISUAL-ASSET-KIT-PLAN-CORRECTIONS.md`。**
> 這份計畫是在沒有 repo 存取權的情況下撰寫的（見 Global Constraints 第一條），
> 有四處與實際程式碼不符，其中兩處會讓實作卡住或做白工。
> Task 1 已完成，Task 2 的處方已被推翻——詳見 `docs/VISUAL-ASSET-KIT-CONTINUE-HERE.md`。

**Goal:** Upgrade the existing five-image product image-set flow into a configurable, theme-aware Visual Asset Kit while preserving the current product analysis, image generation, paid-generation lease, LibraryImage, asset library, Magic Layers, and editor integrations.

**Architecture:** Keep every generated asset in `LibraryImage` and continue using `LibraryImage.batchId` as the kit identifier. Add one lightweight `ProductImageSet` record per batch to persist the exact confirmed art direction, theme, plan, and status required for reliable retry and audit; do not create a second asset table. Split planning from paid generation: the plan endpoint proposes an art direction and asset list, the user confirms and edits it, and the generation endpoint consumes that exact persisted batch instead of replanning.

**Tech Stack:** Next.js App Router, TypeScript, React, Prisma, Turso/SQLite, Vercel Blob, existing fal image model router, existing Magic Layers editor.

**Spec:** `docs/IMAGE-SET-KIT-SPEC.md`，以及 `/Users/chesterchiu/Documents/ChatGPT/maketing-tool/docs/AI商品視覺套組-Codex交接文件.md`。

## Global Constraints

- First verify every source path and architecture claim in Task 1. The source repository was not available when this plan was authored.
- Do not rebuild Product Analysis, `ImageSetArtDirection`, the model router, Blob storage, LibraryImage, asset library, Magic Layers, or the editor.
- Do not create a new generated-asset table. Generated files remain one row per image in `LibraryImage`.
- A new batch metadata table is allowed because `batchId` alone cannot preserve different themes and confirmed art directions for the same product.
- Do not generate text inside background, benefit, decoration, button-frame, ribbon, or label-base images. Existing product packaging and logo text must be preserved.
- The default selection contains the five core assets. Extra suggestions are opt-in and the UI shows the exact selected count before paid generation.
- The maximum asset count is enforced by a shared configurable constant on both client and server.
- A single failed asset does not fail or hide the whole kit. Retry preserves the batch's confirmed art direction.
- AI ad layout must query by the selected `batchId` or explicit asset IDs. It must not mix assets from different batches belonging to the same product.
- Preserve the existing purple primary color, radius, cards, modal, typography, loading, and progress patterns.
- Run `npx prisma generate` before TypeScript verification.
- `npx tsc --noEmit` and `npx next build` must exit 0.
- Run the full test command, not only affected tests. Only the already-known planner/content-brief failure may remain, after confirming it existed before this branch.
- Changed-file ESLint must report zero errors.
- Paid image generation requires the user's explicit approval of the exact selected count before the manual acceptance run.
- Production uses Turso. Any Prisma field or model addition must include and document the migration that must be applied before deployment.

---

## File Map

| File | Responsibility after this change |
| --- | --- |
| `prisma/schema.prisma` | Persist kit metadata and the two additional LibraryImage fields |
| `prisma/migrations/20260915140000_add_product_image_sets/migration.sql` | Additive Turso/SQLite migration |
| `src/lib/products/product-visual-analysis.ts` | Extend `ImageSetArtDirection` with mood and decoration style |
| `src/lib/products/product-visual-profile.ts` | Backward-compatible parsing and cache behavior |
| `src/lib/products/image-set-kit.ts` | Shared kit types, role mapping, status reduction, limits, and validation |
| `src/lib/products/image-set-roles.ts` | Deterministic, theme-aware variable-length asset plan |
| `src/lib/products/image-set-prompts.ts` | Compile confirmed batch art direction and forbid generated text |
| `src/lib/products/image-set-orchestrator.ts` | Build direction once, persist/consume the confirmed plan, retry individual items |
| `src/lib/calendar/tw-calendar.ts` | Existing source for `PROMO_FIXED` and `TAIWAN_SEASONAL`; no duplicate theme catalog |
| `src/app/api/products/[productId]/image-set/plan/route.ts` | Free planning endpoint; no paid image generation |
| `src/app/api/products/[productId]/image-set/route.ts` | Generate only confirmed selected plan items with server-side limits |
| `src/app/api/products/[productId]/image-set/[batchId]/route.ts` | Read one persisted kit and its LibraryImage rows |
| `src/app/api/products/[productId]/image-set/[batchId]/assets/[assetId]/retry/route.ts` | Retry one failed asset using the batch's confirmed direction |
| `src/components/products/ImageSetModal.tsx` | Analysis, theme, direction review, asset checklist, progress, completion redirect |
| `src/components/products/ImageSetDirectionEditor.tsx` | Focused art-direction review and edit UI |
| `src/components/products/ImageSetPlanChecklist.tsx` | Selection, selected count, cost warning, and validation UI |
| `src/app/clients/[clientId]/products/[productId]/image-sets/[batchId]/page.tsx` | Server page for the Visual Asset Board |
| `src/components/products/VisualAssetBoard.tsx` | Kit presentation, category sections, asset actions, and CTAs |
| `src/app/api/magic-layers/ad-layout/route.ts` | Accept `batchId`/asset IDs and constrain candidate assets |
| `src/components/activities/RolePickerModal.tsx` | Reuse existing sessionStorage handoff keys |
| `src/components/magic-layers/ComposeView.tsx` | Consume existing handoff; extend only if a kit asset list is not already supported |

---

### Task 1: Verify the Repository and Baseline Behavior — ✅ 已完成（commit 98f9b0a）

產出：`docs/architecture/visual-asset-kit-audit.md`、擴充 `image-set-resume-recovery.test.ts`。
基準：tsc 0 error、build 成功、297 測試 296 通過，唯一失敗 `planner/content-brief`。
resume 錯誤歸因：localStorage 記著已被刪除的 `LibraryImage` ID，`complete: rows.length === items.length`
純數量比對因而失敗；**與 DONE/FAILED 判斷無關**（推翻本計畫原本的分類 B 假設）。

---

### Task 2: Fix Existing Image-Set Progress Restoration

> ⚠️ **本 Task 的 Step 1–3 已被 Task 1 的發現推翻，請改用
> `docs/VISUAL-ASSET-KIT-CONTINUE-HERE.md` 第 2 節的處方。**
> 不要實作 `normalizeImageSetRows`（DONE/FAILED/PENDING 共存）——那是在解一個不存在的問題。
> 實際要修的是：①錯誤文案誤導（叫使用者「重新讀取」但重讀無效）②缺幾筆應可照樣接續。

**Files:**
- Modify: `src/components/products/ImageSetModal.tsx`
- Modify: `src/lib/products/image-set-ui.ts`（判定邏輯以純函式承載）
- Test: 擴充既有的 `src/components/products/image-set-resume-recovery.test.ts`

- [ ] **Step 1:** 用純函式表達新的接續判定並寫測試（缺少的項目視為待重新生成）
- [ ] **Step 2:** 跑測試確認失敗
- [ ] **Step 3:** 實作最小修正（文案 + 判定），不要夾帶 kit 規劃、新角色或新 UI
- [ ] **Step 4:** `npx tsc --noEmit` 與相關測試
- [ ] **Step 5:** commit（訊息：`fix: restore partial image-set progress`）

---

### Task 3: Persist Kit Metadata Without Duplicating Assets

**Files:** `prisma/schema.prisma`、新 migration、`src/lib/products/image-set-kit.ts` + 測試

**Interfaces:**

```ts
export type ImageSetKitStatus = "DRAFT" | "CONFIRMED" | "GENERATING" | "COMPLETE" | "PARTIAL" | "FAILED";
export type ImageSetCategory = "product" | "texture" | "background" | "benefit" | "decoration";
// ⚠️ 修正：detail 是現行儲存角色，texture 是舊別名（原計畫寫反了）
export type StoredAssetRole = "hero" | "detail" | "background" | "benefit" | "decoration";
export type ImageSetPlanItem = {
  id: string;
  category: ImageSetCategory;
  assetRole: StoredAssetRole;
  assetSubtype: string;
  purpose: string;
  core: boolean;
  defaultSelected: boolean;
};
export const IMAGE_SET_MAX_ASSETS: number;
export function toStoredAssetRole(category: ImageSetCategory): StoredAssetRole;
export function toImageSetCategory(role: string): ImageSetCategory | null;
export function parseImageSetPlanJson(value: string): ImageSetPlanItem[];
```

- [ ] **Step 1:** 寫對應與驗證測試（`toStoredAssetRole("texture") === "detail"`；
      `toImageSetCategory("detail")`／`("texture")` 都要能解；plan 拒絕重複 ID、未知角色、
      空 subtype/purpose、超過 `IMAGE_SET_MAX_ASSETS`）
- [ ] **Step 2:** 跑測試確認失敗
- [ ] **Step 3:** 新增 Prisma schema（純新增）

```prisma
model ProductImageSet {
  id               String   @id
  productId        String
  themeKey         String?
  themeLabel       String?
  artDirectionJson String
  planJson         String
  status           String   @default("DRAFT")
  confirmedAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([productId, createdAt])
}
```

`LibraryImage` 加：`assetSubtype String?`、`hasTransparentBackground Boolean?`
`Product` 加：`imageSets ProductImageSet[]`。**不要改動或挪用 `LibraryImage.batchId`。**

- [ ] **Step 4:** 建立 Turso 相容的純新增 migration（建表 + 索引 + 兩個 nullable 欄位；
      不得改寫、刪除或回填既有 LibraryImage 資料）
- [ ] **Step 5:** 實作共用型別與驗證（`IMAGE_SET_MAX_ASSETS` 預設保守值 20，伺服器端驗證為準）
- [ ] **Step 6:** `npx prisma generate` → 測試 → `tsc`
- [ ] **Step 7:** commit（`feat: persist product image-set metadata`）

> ⚠️ **跑 migration 前務必確認 `head -1 .env.local` 是 `DATABASE_URL="file:./prisma/dev.db"`。**

---

### Task 4: Extend and Parse Art Direction Backward-Compatibly

**Files:** `product-visual-analysis.ts`、`product-visual-profile.ts`、`image-set-prompts.ts` + 既有測試

```ts
export type ImageSetArtDirection = {
  concept: string;
  palette: { dominant: string[]; accent: string[] };
  lighting: string;
  materials: string[];
  backgroundLanguage: string;
  cameraLanguage: string;
  consistencyRules: string[];
  mood: string[];            // 新增
  decorationStyle: string[]; // 新增
};
```

- [ ] **Step 1:** 相容性測試（舊快取沒有 mood／decorationStyle 要能解析成空陣列；
      不可僅因缺這兩個可選欄位就讓 source hash 失效）
- [ ] **Step 2:** prompt 測試：每個角色的 prompt 都要含確認過的 mood、相關時的 decoration style、
      campaign consistency rules，以及下列語意：

```text
Do not render new words, letters, numbers, captions, badges with text, or typographic marks.
Preserve genuine logo and packaging label details visible on the supplied product reference.
```

- [ ] **Step 3:** 實作（不可為每個素材重跑 Product Analysis）
- [ ] **Step 4:** 跑測試 + `tsc`
- [ ] **Step 5:** commit（`feat: extend image-set art direction`）

---

### Task 5: Build a Deterministic Theme-Aware Asset Plan

**Files:** `image-set-roles.ts`（讀 `tw-calendar.ts`）+ 測試

```ts
type PlanImageSetInput = {
  profile: ProductVisualProfile;
  artDirection: ImageSetArtDirection;
  theme?: { key: string; label: string; kind: "PROMO" | "SEASONAL" };
};
export function planImageSetRoles(input: PlanImageSetInput): ImageSetPlanItem[];
```

- [ ] **Step 1:** 決定性測試：恰好 5 個核心項目 `defaultSelected: true` 且五類各一；
      其餘 `defaultSelected: false`；相同輸入回傳 deep-equal 且 ID 穩定；
      不同主題至少改變一個 subtype 或 purpose；不超過上限；
      不因產品不支援就亂提（例如非保養品不該提 foam）；
      框／緞帶／標籤底項目要明確標示不含文字
- [ ] **Step 2:** 實作最小決定性 planner（主題目錄**只用** `PROMO_FIXED` / `TAIWAN_SEASONAL`，
      不得複製其值到別的檔案；ID 由 `assetRole` + `assetSubtype` + 正規化主題鍵推導，不得用隨機）
- [ ] **Step 3:** 跑測試 + `tsc`
- [ ] **Step 4:** commit（`feat: plan configurable product asset kits`）

---

### Task 6: Add the Free Planning and Confirmation API

**Files:** `app/api/products/[productId]/image-set/plan/route.ts`、`image-set-orchestrator.ts` + 測試

```ts
type PlanImageSetRequest = { themeKey?: string; themeKind?: "PROMO" | "SEASONAL" };
type PlanImageSetResponse = {
  batchId: string; productId: string;
  theme: { key: string; label: string; kind: "PROMO" | "SEASONAL" } | null;
  artDirection: ImageSetArtDirection;
  items: ImageSetPlanItem[];
  maxAssets: number;
};
```

- [ ] **Step 1:** route 測試：驗證擁有權、主題查表、沿用快取的 Product Analysis、
      一次 plan 只 build 一次 art direction、建立一筆 DRAFT `ProductImageSet`、
      **完全不呼叫付費生圖**
- [ ] **Step 2:** 跑測試確認失敗
- [ ] **Step 3:** 實作規劃與 DRAFT 持久化（重複呼叫建立新 draft，永不覆寫已確認的批次）
- [ ] **Step 4:** 測試 + `tsc`
- [ ] **Step 5:** commit（`feat: add product asset kit planning API`）

> 測試檔位置請照專案慣例放在 `src/app/api/` 扁平層（如 `paid-image-set-routes.test.ts`），
> 不要放進深層路由資料夾。

---

### Task 7: Generate Only the Confirmed Selection

**Files:** `image-set/route.ts`、`image-set-orchestrator.ts` + 既有測試

```ts
type ConfirmImageSetRequest = {
  batchId: string;
  selectedItemIds: string[];
  artDirection: ImageSetArtDirection;
};
```

- [ ] **Step 1:** 伺服器驗證測試：錯誤的 product/batch、非 DRAFT、空選取、重複、未知 ID、
      超過上限、art direction 格式錯、client 竄改 role/subtype ——
      **全部要在任何付費呼叫之前就被擋下**
- [ ] **Step 2:** 持久化測試：確認後存下編輯過的 art direction 與選取清單；
      DRAFT → CONFIRMED → GENERATING；每列寫入 `batchId`/`productId`/`assetRole`/`assetSubtype`/prompt；
      `hasTransparentBackground` **依實際產出檔案或已驗證的去背結果判定**
      （prompt 要求透明不算）；保留既有 lease/CAS 與孤兒清理行為
- [ ] **Step 3:** 實作（伺服器端將 `selectedItemIds` 與持久化的 DRAFT plan 取交集；
      client 可編輯允許的 art direction 欄位，但不能透過生成請求新增角色或項目）
- [ ] **Step 4:** 狀態歸納

```text
GENERATING: 至少一列 pending/running
COMPLETE:   全部 DONE
PARTIAL:    終態且至少一列 DONE、至少一列 FAILED
FAILED:     終態且沒有任何 DONE
```

- [ ] **Step 5:** 測試 + `tsc`
- [ ] **Step 6:** commit（`feat: generate confirmed asset kit selections`）

---

### Task 8: Add Theme, Art-Direction, and Cost Confirmation UI

**Files:** `ImageSetModal.tsx`、新增 `ImageSetDirectionEditor.tsx`、`ImageSetPlanChecklist.tsx`

> ⚠️ **專案沒有 React 元件測試工具**（無 testing-library / jsdom / vitest / jest）。
> 請把可測的邏輯（選取計數、上限驗證、狀態歸納、CTA payload 組裝）抽成純函式放進
> `image-set-kit.ts` 或 `image-set-ui.ts` 並以 `.test.ts` 測試；
> 純視覺行為留給 Task 13 Step 5 的手動 preview 驗證。**不要引入新的測試框架。**

狀態流：`選產品/主題 → 規劃中 → 檢視方向與清單 → 確認 → 生成中 → 終態摘要`

- [ ] **Step 1:** 純函式測試（5 個核心預設選取、額外項預設不選、計數即時更新、
      超過上限時不可送出、重開進度不會偷偷建立新 plan）
- [ ] **Step 2:** 主題選擇（資料由 plan 端點提供，**不要在元件裡複製** `PROMO_FIXED`／`TAIWAN_SEASONAL`）
- [ ] **Step 3:** 方向編輯器（可改 concept／palette／lighting／materials／mood／
      decorationStyle／backgroundLanguage／cameraLanguage；`consistencyRules` 保留不動）
- [ ] **Step 4:** 清單與張數揭露（依類別分組，顯示 subtype 與用途，標示核心項；
      按鈕文案如「確認並生成 N 張」；**不要宣稱具體金額**，專案沒有可靠價格來源）
- [ ] **Step 5:** 進度與完成摘要（支援 COMPLETE／PARTIAL／FAILED；PARTIAL 仍提供「查看視覺套組」）
- [ ] **Step 6:** 測試 + 改動檔 ESLint + `tsc`
- [ ] **Step 7:** commit（`feat: confirm visual asset kit before generation`）

---

### Task 9: Read a Kit and Retry One Asset With the Same Direction

**Files:** `image-set/[batchId]/route.ts`、`.../assets/[assetId]/retry/route.ts`、`image-set-orchestrator.ts`

- [ ] **Step 1:** 讀取端點測試（擁有權、嚴格以 `productId + batchId` 過濾、類別正規化、
      真實狀態、不得混入其他批次的素材）
- [ ] **Step 2:** retry 測試（拒絕批次外的素材、拒絕不支援的 role/subtype 變更、
      從 `ProductImageSet.artDirectionJson` 讀方向、只改該素材的變化、保留 lease/CAS）
- [ ] **Step 3:** 實作（retry **絕不**重建 Product Analysis 或 Art Direction；
      若保留原失敗列，依專案既有的重試/版本慣例連結新嘗試，
      不得覆寫已被既有版面引用的圖片）
- [ ] **Step 4:** 測試 + `tsc`
- [ ] **Step 5:** commit（`feat: read and retry visual asset kits`）

---

### Task 10: Build the Visual Asset Board

**Files:** `app/clients/[clientId]/products/[productId]/image-sets/[batchId]/page.tsx`、`VisualAssetBoard.tsx`

- [ ] **Step 1:** 可測邏輯的測試（分類歸納、計數、CTA payload 帶齊 `clientId`/`productId`/`batchId`）
- [ ] **Step 2:** 實作 server page 與看板（主視覺預覽區 + 分類區塊；
      預覽可由既有縮圖組成，**但不得存成素材來源**）
- [ ] **Step 3:** 沿用既有素材動作（加入素材庫／下載／刪除／重新生成／加入畫布）；
      目前沒有的動作就不要做，不要另開第二條資料路徑
- [ ] **Step 4:** 用專案既有的 preview 流程驗證桌機與手機寬度
- [ ] **Step 5:** ESLint + `tsc`
- [ ] **Step 6:** commit（`feat: add product visual asset board`）

---

### Task 11: Constrain AI Ad Layout to the Selected Kit

**Files:** `app/api/magic-layers/ad-layout/route.ts`、`VisualAssetBoard.tsx` + 既有測試

```ts
type AssetKitSelection = { productId: string; batchId: string; assetIds?: string[] };
```

- [ ] **Step 1:** 跨批次隔離測試（同一產品兩個批次，請求 A 絕不含 B 的素材；
      給 `assetIds` 時要與 `productId + batchId + status:DONE` 取交集）
- [ ] **Step 2:** 舊角色相容測試（`hero`/`background`/`benefit`/`decoration` 照舊，
      並沿用 `ad-layout-context.ts` 既有的 `texture → detail` 對應；渲染端可挑子集，不必用到每個素材）
- [ ] **Step 3:** 實作（批次/產品不符要拒絕，**不得退回「該產品全部素材」**；
      非來自 kit 的舊呼叫路徑要繼續可用）
- [ ] **Step 4:** 測試 + `tsc`
- [ ] **Step 5:** commit（`feat: scope AI layouts to one asset kit`）

---

### Task 12: Hand the Kit to the Existing Free-Form Editor

**Files:** 必要時才改 `RolePickerModal.tsx`、`ComposeView.tsx`；`VisualAssetBoard.tsx`

- [ ] **Step 1:** 先用測試刻畫現有 handoff（`ML_COMPOSE_BG_KEY` / `ML_COMPOSE_CLIENT_KEY` /
      `ML_WIZARD_SEED_KEY` 的實際 seed 形狀，確認是否已支援多個 LibraryImage ID）
- [ ] **Step 2:** 最小擴充（已支援就沿用既有 schema；否則加一個向後相容的可選欄位）

```ts
assetKit?: { productId: string; batchId: string; assetIds: string[] };
```

編輯器應把它們列為可用素材或建立一個合理的初始構圖，
**不得把所有圖片疊在同一個座標**。

- [ ] **Step 3:** 向後相容測試（舊 payload 仍可開啟、格式錯誤不得清空畫布、
      kit 查詢限制在目前的 client/product/batch）
- [ ] **Step 4:** 測試 + ESLint + `tsc`
- [ ] **Step 5:** commit（`feat: open asset kits in Magic Layers`）

---

### Task 13: Full Verification and One Approved Generation Run

**Files:** 只修驗證中發現的缺陷；產出 `docs/verification/visual-asset-kit.md`

- [ ] **Step 1:** 在隔離的開發資料庫套用 migration，確認既有 LibraryImage 仍可讀、
      新的 nullable 欄位不需回填
- [ ] **Step 2:** `npx prisma generate` → `npx tsc --noEmit` → `npx next build`（全部 exit 0）
- [ ] **Step 3:** 跑**全套**測試，只允許 Task 1 記錄的 `planner/content-brief` 失敗；
      若其輸出改變，視為新失敗
- [ ] **Step 4:** 改動檔 ESLint 零錯誤

```bash
git diff --name-only --diff-filter=ACMR | rg '\.(ts|tsx)$' | xargs npx eslint
```

- [ ] **Step 5:** **不花錢**驗證 UI：規劃、換主題、編輯方向、5 個預設選取、額外項可加選、
      張數揭露、接續行為、看板載入、部分失敗、重試入口、排版隔離、編輯器 handoff。
      排版用 `?adlayout=1` 測、`?adlayout=0` 關
- [ ] **Step 6:** **向使用者說明產品、主題、選取清單與確切張數，取得核准後**才呼叫付費生成
- [ ] **Step 7:** 生成一組並記錄證據（確認的 art direction、選取清單、各類數量、成功/失敗數、
      重試行為、所有圖是否共用同一色彩／光線／材質／氛圍；
      **確認生成的框內沒有 AI 文字、商品包裝仍可辨識**）
- [ ] **Step 8:** 在驗證文件寫明：`正式站是 Turso，部署前必須先套用本次 migration。`
- [ ] **Step 9:** commit（`docs: verify visual asset kit`）

---

## Phase Boundaries

- **Phase 1:** Task 1–6 — 既有 bug 隔離修好、批次狀態持久化、art direction 擴充、免費規劃可用
- **Phase 2:** Task 7–9 — 確認後的可變長度生成、部分成功、同方向重試
- **Phase 3:** Task 10 — Visual Asset Board
- **Phase 4:** Task 11–12 — AI 排版與自由畫布使用選定的 kit，不跨批次混用
- **Release verification:** Task 13

每個 Phase 結束都可檢視與測試後才進下一個。**Phase 1 的規劃測試不得觸發付費生成。**
