# Visual Asset Kit Implementation Plan — 開工前必讀的修正

> 這份實作計畫是在**沒有 repo 存取權**的情況下寫的（計畫自己有註明），
> 所以 Task 1 要求先驗證所有路徑與架構宣稱。**那份驗證我已經做完了**，
> 結果如下。請先讀完這頁再開始 Task 1，可以省掉大部分盤點時間。
>
> 查證基準：分支 `codex/ad-layout-composition-plan`，2026-09-15。

---

## 🔴 修正 1：`detail` 與 `texture` 的新舊關係寫反了

計畫目前寫：

```ts
export type StoredAssetRole = "hero" | "texture" | "background" | "benefit" | "decoration";
toImageSetCategory("detail") === "texture"; // legacy read compatibility only
```

**實際程式碼剛好相反**：

| 角色 | 實際狀態 | 證據 |
|---|---|---|
| `detail` | **現行角色** | `productMeta.ts:15` `CORE_SET_ROLES = ["hero","detail","background","benefit","decoration"]`<br>`productMeta.ts:36` 標籤「質地細節」<br>`image-set-roles.ts:4` `ImageSetRole = "hero"｜"detail"｜"lifestyle"｜"background"｜"benefit"｜"decoration"`（**沒有 texture**） |
| `texture` | **舊素材別名** | `productMeta.ts:37` 標籤「質地（舊素材）」<br>`productMeta.ts:21` `detail: ["detail", "texture"]`（texture 是 detail 的別名） |

### 請改成

```ts
export type StoredAssetRole = "hero" | "detail" | "background" | "benefit" | "decoration";

toStoredAssetRole("texture") === "detail";   // UI 類別名 → 儲存角色
toImageSetCategory("detail")  === "texture"; // 儲存角色 → UI 類別名（若 UI 仍要叫 texture）
toImageSetCategory("texture") === "texture"; // 舊資料相容
```

> 若要讓 UI 類別名與儲存角色一致，直接把 UI 類別也叫 `detail` 更單純；
> 但**儲存進 `LibraryImage.assetRole` 的值必須是 `detail`**，這點沒有商量空間。

### 不改會怎樣

- AI 排版不會壞（`ad-layout-context.ts:66` 有 `texture: "detail"` 的對應接住）
- 但 `ASSET_ROLE_LABELS` 會把**新生成的素材標成「質地（舊素材）」**給使用者看
- 而且會多出第二套角色詞彙，之後每個碰到的人都要先搞懂哪個才是現行的

---

## 🔴 修正 2：專案沒有 React 元件測試基礎建設

計畫在 **Task 2 / 8 / 10 / 12** 要求寫元件行為測試，例如：

> Assert this state flow: `select product/theme → planning → review direction and checklist → confirm → generating → terminal summary`

並要求建立 `ImageSetModal.test.tsx`、`VisualAssetBoard.test.tsx`、`ImageSet*.test.tsx` 等。

**但這個專案做不到**：

```
專案內 .test.tsx 檔案數：            0
testing-library / jsdom / vitest /
jest / happy-dom / enzyme：          全部沒有安裝
```

所有測試都是純 Node `node:test` + `tsx`，測的是**純函式**。
照計畫做，第一步就會卡在「要先裝 testing-library + jsdom + 設定建置」——
那是計畫沒有涵蓋的一大塊工作，而且會動到建置設定。

### 請改成（專案既有慣例）

**把不變式抽成純函式，測那個函式。** 元件只負責呼叫它。

例如 Task 2 的批次狀態判定，抽成：

```ts
// src/lib/products/image-set-kit.ts
export function normalizeImageSetRows(rows: unknown[]): {
  rows: NormalizedRow[];
  itemErrors: { index: number; reason: string }[];
  terminal: boolean;   // 沒有 PENDING/RUNNING 才算 terminal，不是「全部 DONE」
};
```

然後在 `image-set-kit.test.ts` 測它。這樣計畫 Task 2 Step 1 列的五條規則全部測得到，
不需要任何新依賴。

Task 8 / 10 / 12 的 UI 行為同理：能抽成純函式的（選取計數、上限驗證、狀態歸納、
CTA payload 組裝）就抽出來測；**純視覺的部分改用 Task 13 Step 5 的手動 preview 驗證**，
計畫裡本來就有這一步。

> 如果真的要引入元件測試工具，請當成**獨立提案**先跟使用者確認，不要夾在這個計畫裡做。

---

## 🟡 修正 3：Task 2 要修的東西已經有測試檔了

計畫 Task 2 說「create `src/components/products/ImageSetModal.test.tsx` only if none exists」。

**已經存在**：

```
src/components/products/image-set-resume-recovery.test.ts
```

它測的就是 resume 恢復流程（斷點續傳時提供「丟棄這批重新開始」）。
寫法是**讀取 `ImageSetModal.tsx` 原始碼做字串比對**——這是沒有元件測試工具時的變通：

```ts
const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");
assert.match(source, /丟棄這批重新開始/);
assert.match(source, /clearSavedImageSetBatch\(window\.localStorage, productId\)/);
```

**請擴充這個檔案，不要另開新的**，否則兩邊會打架。
（這種字串比對測試很脆弱，重構 `ImageSetModal` 時容易誤報，改動後記得一起更新。）

---

## 🟡 修正 4：測試檔位置慣例

計畫假設 route 測試放在 `src/app/api/products/[productId]/image-set/route.test.ts`。

**專案慣例是扁平放在 `src/app/api/`**：

```
src/app/api/paid-image-set-routes.test.ts      ← 付費生成相關的 route 測試都在這
src/app/api/ad-layout-route.test.ts
```

新的 plan / retry / batch 讀取端點，請加進 `paid-image-set-routes.test.ts`
或依同樣慣例新增一個扁平檔，不要放進深層路由資料夾。

---

## ✅ 已查證正確的部分（Task 1 可以直接引用）

| 計畫宣稱 | 查證結果 |
|---|---|
| `ImageSetArtDirection` / `buildImageSetArtDirection` / `compileImageSetPrompt` / `planImageSetRoles` | ✅ 全部存在，符號名正確 |
| `Product.visualProfileJson` / `visualProfileSourceHash` | ✅ `schema.prisma:148-149` |
| `LibraryImage` 的 `batchId` / `productId` / `assetRole` / `generationLeaseId` / `generationLeaseExpiresAt` | ✅ `schema.prisma:92-112` |
| `ML_COMPOSE_BG_KEY` / `ML_COMPOSE_CLIENT_KEY` / `ML_WIZARD_SEED_KEY` | ✅ `components/activities/RolePickerModal.tsx:20-25` |
| `SHOW_AD_LAYOUT` / `NEXT_PUBLIC_SHOW_AD_LAYOUT` / `?adlayout=1` | ✅ `lib/feature-flags.ts` |
| 引用的交接文件路徑 | ✅ 存在 |
| 入口 route、主要 components、生圖 model router、Blob 儲存 | ✅ 皆如 File Map 所述 |

### 計畫漏提但存在的東西

- **`src/app/api/products/[productId]/image-set/analyze/route.ts` 已經存在**（產品視覺分析）。
  新的 `plan` 端點與它職責相鄰，請先讀過它，避免做出第二條重複的分析路徑。
- `ad-layout-context.ts` 有完整的角色對應表（`detail: "detail"`、`texture: "detail"`），
  Task 11 的 legacy 相容測試可以直接引用它，不用自己重寫對應邏輯。

---

## ✅ 計畫寫得好、請保留的決定

1. **planning（免費）與 generation（付費）拆成兩支 API**，且生成端只消費持久化的
   確認快照、不重新規劃 —— 這比原始規格更嚴謹，避免「使用者確認的清單」與
   「實際生成的清單」不一致。
2. **新增 `ProductImageSet` metadata 表**（而非新的 asset 表）——
   論證成立：`batchId` 單獨確實存不了主題與確認過的 art direction。
   Task 3 的 migration 必須是純新增（建表 + 兩個 nullable 欄位），不可改寫既有資料。
3. **Task 13 Step 6：付費生成前要先取得使用者對「確切張數」的核准** —— 務必遵守。
4. **Task 1 先驗證再實作** —— 態度正確，而且計畫自己承認撰寫時沒有 repo，很誠實。

---

## 開工順序建議

1. 先讀完這頁 → 修正計畫中的型別定義與測試策略
2. Task 1 的路徑驗證可大幅縮短（上表已查完），但**仍請自行覆核一次**
3. Task 2 擴充既有的 `image-set-resume-recovery.test.ts`
4. 其餘照計畫的 Phase 邊界走

## 驗收提醒（沿用先前約定）

```bash
npx prisma generate      # 沒跑會噴一堆 Prisma 欄位不存在的假錯誤
npx tsc --noEmit         # 必須 0
npx next build           # 必須 EXIT=0
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts" "src/components/**/*.test.ts"
```

**請跑全套，不要只跑相關子集。** 前幾輪有三次回報「全數通過」但全套有失敗，
都是只跑了子集造成的。目前唯一允許的既有失敗是 `planner/content-brief`。
