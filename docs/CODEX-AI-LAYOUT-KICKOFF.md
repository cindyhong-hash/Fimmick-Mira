# 給 Codex：「AI 幫我排版」開工前須知

> 寫於 2026-09-21，驗收基準線更新於 2026-09-22。這份只講**開工前要先知道的事**；功能本身的設計、已完成的 P0–P4、檔案分工在
> [`docs/AI-LAYOUT-HANDOFF.md`](AI-LAYOUT-HANDOFF.md)，那份仍然有效，請先讀完再看這份。

---

## 0. 一句話

功能已經做到 P4，程式碼都在 `main` 上，但**在正式站是關閉的**。你要做的是把它從「能跑」推到「能開給使用者」，不是重寫。

---

## 1. 開工第一件事：不要用舊分支

- `codex/ad-layout-composition-plan` 現在**落後 `main` 62 個 commit，領先 0 個**。它的內容已經全部進 `main` 了，繼續在上面做只會製造衝突。
- **從 `main` 開新分支**：

```bash
git fetch mine && git switch -c codex/ai-layout-<主題> mine/main
```

- 既有的 worktree `/.worktrees/ad-layout-composition-plan` 可以沿用，但進去後要先 `git fetch mine` 再切到新分支。

---

## 2. 遠端：`mine` 才是正式站

| remote | 指向 | 說明 |
|---|---|---|
| `mine` | `cindyhong-hash/Fimmick-Mira` | **正式站**，push `main` 會自動部署 |
| `origin` | `honghuixin4-cell/creative-image` | 舊 repo，**不要推** |
| `teammate` | `verna-fimmickTW/market-tool-demo` | 同事的，不要推 |

推分支給人 review 用 `git push mine <branch>`。**不要自己推 `main`** — 上正式站由發需求的人決定。

---

## 3. 功能旗標：現在是關的

`src/lib/feature-flags.ts`：

- 環境變數 `NEXT_PUBLIC_SHOW_AD_LAYOUT=1` → 整個環境開
- 網址加 `?adlayout=1` → 只開這個分頁（記在 sessionStorage，`?adlayout=0` 關掉）

正式站目前**沒有**設那個環境變數，所以使用者看到的是「敬請期待」。本機自測請用 `?adlayout=1`。

要不要正式放出去是產品決定，**不要順手在 commit 裡把旗標預設打開**。

---

## 4. 守備範圍：`src/lib/products/*` 不要碰

這是最重要的一條。自從你上次的分支之後，`src/lib/products/*` 有 **32 個 commit** 的改動，全部是另一手在顧的「商品素材生成品質」。排版功能**只讀素材包**，不要改生成核心。

近期那邊踩過的坑，你如果要改任何送進生圖模型的提示詞（理論上不用），先知道：

1. **負面句對生圖模型沒有作用。** 「不要畫商品」「no text」都無效——句子裡出現的名詞就是它要畫的東西。要它不畫，就是**不要提**。
2. **提示詞裡不要出現中文、hex 色碼、數字標籤**——會被當成畫面文字描上去（實測畫出過「雙重保濕」和 `#FFFFFF`）。
3. **「請保持一致」對分開的 API 呼叫無效**——每張圖是獨立呼叫，看不到同組的其他張。一致性要用程式保證（固定比例、程式合成、共用主體），不是用形容詞。

同樣別碰：`src/proxy.ts` 的 303、靈感中心、建立圖文流程（`activities/*`、`ActivityForm`）、首頁。要改先協調。

---

## 5. 付費：每一次生成都是真的扣款

- `ad-layout` 會呼叫去背（`FAL_KEY`），**本機也是接同一組正式 API**。
- P4 的「補素材」按鈕會走既有付費 image-set worker 生圖。
- **自測要生圖之前，先跟發需求的人確認確切張數**，不要自己連跑一批。

---

## 6. 環境與資料庫

- **不要 `npm install`**。各 worktree 的 `node_modules` 是共用 symlink，跑了會壞掉別人的環境。
- 你的 worktree `.env.local` 目前的 `DATABASE_URL` 是本機 `file:` DB，這是對的。**跑任何 migration 前先確認它不是 `libsql:`** —— 之前發生過 worktree 指到正式 Turso、差點改到正式資料庫。
- 本功能理論上不需要動 schema。真的要動：照 `docs/PRODUCT-IMAGE-SET-HANDOFF.md` 的 Turso 手動遷移流程，**絕對不要對遠端 Turso 跑 `prisma migrate deploy`**。
- **不要 commit `public/uploads`**（dev symlink，會讓 Vercel build 失敗），也不要 commit `prisma/*.db`。

---

## 7. UI 要照設計系統

repo 根目錄的 `DESIGN.md` 是「白卡片 v2」設計系統。動任何畫面前先讀它，不要自己發明樣式。

---

## 8. 驗證基準（開工前先跑一次，記下你的起點）

```bash
npx tsc --noEmit
npx tsx --test "src/**/*.test.ts"
npm run lint
npm run build
```

2026-09-22 在 `main` 上的實際狀況：

- `tsc` — 0
- 測試 — **408 個，407 過**。唯一失敗是既有的 `src/lib/planner/content-brief.test.ts`（`subtitleText: null`），**不是你弄壞的**，不用修。
- `lint` — **56 個 error、94 個 warning，全部是既有的**（集中在 `wireframes/`、舊 API route）。基準線是「不要新增」，不是「歸零」。
- `build` — EXIT 0

`tsc` 之前若看到一堆 Prisma 型別錯，先 `npx prisma generate`。

---

## 9. 做完自測的走法

1. 產品頁（帶 `?adlayout=1`）點 `✨ AI 幫我排版` → 選用途／尺寸／填標題 → 建立 3 個設計方向。
2. 三張預覽各自只顯示該 candidate 實際的圖層；商品主視覺不該出現未選的 detail／benefit。
3. 選一張 → 導去 `/magic-layers/compose?seed=1`，編輯器要出現**可個別拖拉／縮放／刪除／換素材**的圖層。
4. 商品主體不可變形（等比 contain），hero 與 Logo 永遠不會被自動移除或重生成。
5. 複雜文字區要有可刪除的安全底板；乾淨留白區不該無故加底板。

---

## 10. 已知待辦（`AI-LAYOUT-HANDOFF.md` 第二節）

1. 歷史設計參考——要讀過往貼文得先定義「已核准、同品牌、同用途」的資料來源與隱私範圍，目前刻意不讀。
2. 更細緻的背景處理——要漸層面板或模糊，得先擴充 Editor 的 shape/image effect 契約，不可直接 flatten 全圖。
3. Graphic / Icon system 擴充——一律走 semantic registry，不可讓模型傳任意座標。
4. 自動文案——可重用 `POST /api/activities/creative-direction`，但要保留無文案的 fallback。

另外：`docs/AI-LAYOUT-HANDOFF.md` 的「第三節／第四節」重複貼了兩次，內容一樣，讀到覺得眼熟不是錯覺。

---

## 11. 有疑問就問，不要猜

規格不清楚、或發現既有行為看起來像 bug 但不確定是不是刻意的——**先問發需求的人**，不要自己改了再說。這個 repo 有好幾條線同時在動。
