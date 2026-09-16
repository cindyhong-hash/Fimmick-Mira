# 搬到公司 Vercel Pro

> ✅ **2026-09-16 已完成**：新站 https://fimmick-mira.vercel.app 已上線
> （team `Fimmick Limited`、專案 `fimmick-mira`）。
> 六個必填環境變數都已設定，驗證通過：標題 MIRA、favicon 4711 bytes、
> 密碼閘正常回 401（代表 SITE_PASSWORD 有吃到，沒設會是 503）。
>
> 下面保留當時的步驟紀錄，以及**還沒做完的收尾**（見最後兩節）。
>
> ⚠️ 實測更正：步驟 1 的 `vercel env pull` **拿不到值**（全是 Sensitive）。
> 實際的取值來源見 `VERCEL-PRO-MIGRATION.md` 開頭那節。

---

## 原始步驟紀錄（2026-09-15 寫）

> 寫於 2026-09-15 下班前。搭配 `docs/VERCEL-PRO-MIGRATION.md`（完整清單）一起看。
> 這份只寫「接下來的動作」，細節與原因在那份裡。

---

## 現在停在哪

- Vercel 開新專案的畫面已經填好，**還沒按 Create Project**
  - Team: `Fimmick Limited` (Pro)
  - Project Name: `fimmick-mira`
  - Repo: `cindyhong-hash/Fimmick-Mira`（= 原本的 taiwan-image-process 改名，同一個 repo）
  - Branch: `main`（已是 MIRA 版 `53ee4f9`）
- 舊正式站 https://taiwan-image-process-x5hn.vercel.app 正常運作中，沒有停機

---

## 步驟 1：拿舊專案的環境變數值

終端機依序跑：

```bash
cd /Users/chesterchiu/Desktop/marketing-tool
```

```bash
npx vercel login
```

```bash
npx vercel env pull .env.old.local --environment=production
```

**三個坑：**

1. **一定要加 `--environment=production`** — 不加預設拉 Development，那組可能是空的
2. **登入要選「個人」帳號** — 舊專案在個人帳號，這步是去舊的拿值；公司帳號是等一下貼進去用的
3. 這個目錄已經連結到 `taiwan-image-process-x5hn`，不用再選專案。
   **不要在 `.worktrees/rename-mira` 跑**（沒連結，會要你重選，容易選錯）

⚠️ `.env.old.local` 是明文金鑰。`.gitignore` 有 `.env*` 會擋住不被 commit，
但不要複製到桌面或雲端硬碟，用完 `rm .env.old.local`。

---

## 步驟 2：填新專案的環境變數，才按 Create Project

Vercel 那個「Environment Variables **11 Detected**」是它讀 repo 裡的 `.env.example`，
**全部是佔位符，不是真值**。必須清掉或覆蓋。

🔴 **最危險的一條**：`.env.example` 裡是 `DATABASE_URL=file:./dev.db`。
直接建下去 → 線上連到空的本機 sqlite → **整站沒有資料**。

### 必填 6 個（少一個就會壞）

| 變數 | 值 | 漏了會怎樣 |
|---|---|---|
| `DATABASE_URL` | 從 `.env.old.local` 抄（`libsql://...`） | 線上沒有資料 |
| `DATABASE_AUTH_TOKEN` | 從 `.env.old.local` 抄 | 連不上資料庫 |

> **資料庫不用搬，也沒有「之後再搬」這件事。**
> 資料存在 Turso（獨立服務，跟 Vercel 無關）。新專案填上跟舊專案一模一樣的
> `DATABASE_URL` + `DATABASE_AUTH_TOKEN`，**一部署就看得到全部資料** ——
> 不是複製一份，是指向同一個資料庫。新舊兩站同時讀同一份資料是正常的，
> 這也正是能零停機切換的原因。
>
> 上面「線上沒有資料」講的是**失敗模式**，不是待辦事項：
> `src/lib/db.ts:5` 寫 `process.env.DATABASE_URL ?? "file:./prisma/dev.db"`，
> 沒設就退回本機檔案，在 Vercel 容器裡那是空的 → 站起得來但裡面什麼都沒有。
> `.env.example` 的佔位值 `file:./dev.db` 就會造成這個結果。
>
> 真正需要「之後再搬」的只有**圖片**，因為 Blob 綁帳號。
| `BLOB_READ_WRITE_TOKEN` | **抄舊的** ← 見下方說明 | 圖片全壞 |
| `OPENROUTER_API_KEY` | 從 `.env.old.local` 抄 | 文案／靈感全失效 |
| `FAL_KEY` | 從 `.env.old.local` 抄 | 生不出圖 |
| `SITE_PASSWORD` | 你自己定 | **整站回 503**（fail-closed，故意的） |

### 🔴 BLOB_READ_WRITE_TOKEN 一定要填舊的

**不要讓 Vercel 自動建新的 Blob store。**

資料庫裡存的是完整圖片網址（`https://xxx.public.blob.vercel-storage.com/...`），
填舊 token → 所有圖片照常顯示、什麼都不用搬、零風險。

長期要把圖搬到公司的 store（擁有權才乾淨），但那是之後寫腳本的事，不擋今天。
**在圖搬完之前，個人帳號的 Blob store 絕對不要刪。**

### 選填但建議一起設

`RAPIDAPI_KEY_IG2` — 靈感中心「正在升溫」的真實 IG 訊號。沒設會靜默降級成季節主題。

⚠️ 這把跟 `RAPIDAPI_KEY_IG` 曾在截圖中明文外洩、**還沒輪替**。
建議直接去 RapidAPI 後台重新產生，新專案填新的、舊的撤銷 —— 順手補掉這個洞。

---

## 步驟 3：驗證新站

部署完，**不用輸密碼**就能驗（密碼閘那頁本身公開）：

```bash
curl -s https://<新網址>/ | grep -o '<title>[^<]*</title>'
```
→ 應回 `<title>MIRA</title>`

```bash
curl -s -o /tmp/f.ico -w '%{size_download}\n' https://<新網址>/favicon.ico
```
→ 應回 `4711`

兩個都對 = 新版真的上去了。

然後輸密碼進站，照 `VERCEL-PRO-MIGRATION.md` ⑦ 節的驗收清單跑一遍，
**重點看素材庫的舊圖有沒有正常顯示**（那是驗證 Blob token 有沒有填對）。

---

## 步驟 4：收尾

- [ ] 舊專案 `taiwan-image-process`（不是 x5hn）**斷開 GitHub 連結**
      → 現在同一個 repo 接了兩個專案，推一次跑兩次建置；加上新的會變三個
      → ⚠️ 斷開連結 ≠ 刪除，Blob store 還要靠舊帳號
- [ ] 確認新站穩定後，再決定什麼時候把大家的網址換過去
- [ ] **網域只換一次** — SITE_PASSWORD 的 30 天免輸是綁網域的 cookie，
      換一次網址 = 所有人重輸一次密碼

---

## 這份 repo 還有一件事沒做完

`rename-mira` 分支有 1 個 commit 還沒推：

```
948b644 docs: 搬到 Vercel Pro 的完整檢查清單
```

不影響部署（純文件），要推的時候：

```bash
cd /Users/chesterchiu/Desktop/marketing-tool/.worktrees/rename-mira && git push mine HEAD:main
```

---

## 其他待辦（跟搬家無關，不急）

- **Codex** 還在 `codex/ad-layout-composition-plan` 做產品套圖優化，已 6 個 commit、
  有 6 個檔案編到一半沒提交（所以 dev server 3014 是壞的，正常現象）。
  他那條分支新增了 migration `20260915140000_add_product_image_sets`，
  **部署前要先套到正式 Turso**，而且要先確認他的 `.env.local` 指向本機不是正式庫。
- 素材背景圖有 AI 亂碼文字（例：「Eaodr Shavts」），輸出品質問題，還沒處理。
- lint 還有 34 個 error，全是刻意不改的。

---

## 上線後還沒做的收尾（2026-09-16）

- [ ] `BLOB_READ_WRITE_TOKEN` 目前只勾 **Production**，其他五個是
      Production and Preview。正式站沒問題，但分支預覽的圖片會壞。
      Settings → Environment Variables → 該行 ⋯ → Edit → 加勾 Preview
- [ ] 舊專案 `taiwan-image-process`（不是 x5hn）**斷開 GitHub 連結**
      → 現在同一個 repo 接了三個 Vercel 專案，推一次跑三次建置
      → ⚠️ 斷開 ≠ 刪除，Blob store 還要靠個人帳號
- [ ] 決定什麼時候把大家的網址從 x5hn 換到 fimmick-mira
- [ ] **網域只換一次** —— SITE_PASSWORD 的 30 天免輸是綁網域的 cookie
- [ ] 圖片仍存在**個人帳號**的 Blob store（`v16uryj9gfmy6re4`）。
      新站是沿用舊 token，所以能正常讀寫。
      🔴 **在寫腳本把圖搬到公司 store 之前，個人帳號絕對不能刪。**
- [ ] RapidAPI key 輪替（`RAPIDAPI_KEY_IG` / `RAPIDAPI_KEY_IG2` 曾完整外洩）
