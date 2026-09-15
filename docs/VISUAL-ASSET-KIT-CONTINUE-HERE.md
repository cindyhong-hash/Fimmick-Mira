# Visual Asset Kit — 接手就從這裡開始

> 給接續這項工作的 agent（換帳號、換 session、換人都適用）。
> **只需要這一個路徑，其他文件都在 repo 裡。**
> 最後更新：2026-09-15

---

## 0. 先做這三件事

```bash
cd /Users/chesterchiu/Desktop/marketing-tool/.worktrees/ad-layout-composition-plan
git branch --show-current        # 必須是 codex/ad-layout-composition-plan
git log --oneline -3
```

然後**依序讀**：

| 順序 | 文件 | 為什麼 |
|---|---|---|
| 1 | `docs/VISUAL-ASSET-KIT-PLAN-CORRECTIONS.md` | 實作計畫有四處跟實際程式碼對不上，**先看修正再看計畫** |
| 2 | `docs/superpowers/plans/2026-09-15-visual-asset-kit.md` | 13 個 Task 的實作計畫本體 |
| 3 | `docs/IMAGE-SET-KIT-SPEC.md` | 產品規格（為什麼要做、做到什麼程度） |
| 4 | `docs/architecture/visual-asset-kit-audit.md` | Task 1 產出的架構覆核（路徑、資料流、基準） |

---

## 1. 現在做到哪

| | |
|---|---|
| 分支 | `codex/ad-layout-composition-plan` |
| 最新 commit | `98f9b0a docs: verify visual asset kit architecture` |
| 完成 | **Task 1**（架構覆核 + 基準確認 + resume 錯誤歸因） |
| 下一步 | **Task 2**，但**處方要改**，見下一節 |
| 尚未開始 | Task 3–13 |

### 基準（兩邊獨立量過，數字一致）

```
npx prisma generate   → 成功
npx tsc --noEmit      → 0 error
npx next build        → 成功
全套測試              → 297 個，296 通過
唯一允許的失敗        → planner/content-brief（subtitleText: null），改動前就存在
```

**任何時候出現第二個失敗，就是這次改壞的。**

---

## 2. ⚠️ Task 2 的處方要改（計畫寫錯了）

計畫 Task 2 假設錯誤成因是「client 要求全部 DONE、不接受部分失敗」（它列的分類 B）。
**實際不是。** Task 1 已查明並驗證：

`src/components/products/ImageSetModal.tsx:81`

```ts
complete: rows.length === items.length     // 純數量比對，跟 DONE/FAILED 無關
```

localStorage 記著的批次有 N 筆，API 只回傳資料庫裡還存在的 M 筆。
**只要任何一筆 `LibraryImage` 被刪過（使用者在素材庫刪圖、或孤兒清理），M < N 就觸發錯誤。**

而且 `ImageSetModal.tsx:166-171` 同時做了兩件矛盾的事：

```ts
setResumeRecovery({ payload, saved });               // 顯示「丟棄這批重新開始」
setRecoveryKind("resume");
setError("既有套圖進度資料尚未完整，請重新讀取。");   // 但文案叫使用者「重新讀取」
```

**重新讀取沒有用** —— 那筆資料在資料庫裡真的不見了，再讀一次還是缺。

### 所以 Task 2 請這樣做（取代計畫原本的 Step 1–3）

**不要**寫計畫要求的 `normalizeImageSetRows`（讓 DONE/FAILED/PENDING 共存）——
那是在解一個不存在的問題。

改成修這兩點：

1. **文案**：說明實情（這批有素材已被刪除，無法接續），
   並讓「丟棄這批重新開始」成為主要動作，不要叫使用者「重新讀取」。
2. **判定**：缺幾筆應該可以照樣接續 —— 把缺少的項目視為「待重新生成」，
   而不是讓整批不可用。這符合 Task 2 的原意（部分失敗不該讓整批失效），
   只是原因跟計畫寫的不一樣。

判定邏輯請用**純函式**承載並測試，沿用 `src/lib/products/image-set-ui.ts` 的
`isCompleteImageSetResume()` 那個模式。

---

## 3. 🚫 環境紅線（違反會出事）

### 資料庫必須是本機

```bash
head -1 .env.local      # 必須是 DATABASE_URL="file:./prisma/dev.db"
```

這個 worktree 的 `.env.local` 曾經為了驗證指向**正式站 Turso**，現已還原。
**Task 3 要產生 migration，跑 `prisma migrate dev` 前務必再確認一次。**
`migrate dev` 偵測到 drift 時可能提議 reset —— 打到正式庫會清掉真實資料。

### 不要自己 npm install

```
.worktrees/ad-layout-composition-plan/node_modules -> ../../node_modules   （symlink）
```

這個 worktree 的 `node_modules` 跟主專案共用。自己裝套件會影響其他工作區。
需要新依賴請先提出來，不要直接裝。

> 註：`tsx` 沒有列在 `package.json`，靠 `npx` 即時下載。若沙箱擋網路，
> 請求受控權限即可；**不要**為了這個跑 `npm install`。

### 跑測試前一定先 prisma generate

否則 `tsc` 會噴一堆「Prisma 欄位不存在」的假錯誤（實測會有 45 個）。

### 本機資料庫是舊的

`prisma/dev.db` 停在 2026-09-04，**缺產品套圖需要的表**，所以本機測不了完整套圖流程。
需要讀正式資料驗證時，臨時開短效 token（約兩分鐘，**用完要還原**）：

```bash
turso db tokens create marketing-tool --expiration 1d
```

---

## 4. 驗收條件（每個 Task 結束都要）

```bash
npx prisma generate
npx tsc --noEmit         # 0
npx next build           # EXIT=0
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts" "src/components/**/*.test.ts"
```

- **請跑全套，不要只跑相關子集。** 先前有三次回報「全數通過」但全套有失敗，都是只跑子集
- 唯一允許的既有失敗：`planner/content-brief`
- 改動檔案 `npx eslint <files>` 要 0 error（全 repo 有既有 error，不要增加）
- **付費生成前必須先取得使用者對「確切張數」的核准**（計畫 Task 13 Step 6）

## 5. 關於付費

「AI 建立商品套圖」**每張素材都是一次付費生圖**。
規劃／清單／UI 都可以免費驗證，**不要為了測試隨手跑真實生成**。

## 6. 其他背景

- 「AI 幫我排版」在正式站是關的（`SHOW_AD_LAYOUT`）。要測加網址參數 `?adlayout=1`，關掉用 `?adlayout=0`
- dev server 用專案既有的 preview 設定，不要用 Bash 跑 `next dev`，也不要在別的目錄再開一個（Next 16 會拒絕）
- 該分支另外還有 15 個 AI 排版的 commit 未併入 main，那批已驗證通過，與本工作無關
