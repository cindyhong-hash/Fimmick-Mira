# 本機開發資料庫 & 憑證輪替

> 2026-09-16 實作紀錄。兩件都踩過坑，做法與原因寫在這。

---

## 一、想在本機用「真實資料」測試

本機 `prisma/dev.db` 停在 2026-09-04、缺表，而且**它是 symlink，主專案與所有
worktree 共用同一份** —— 直接對它跑 migration 會同時影響 Codex 等其他工作區。

### 做法：本機專屬資料庫 + 正式站快照（唯讀）

```bash
# 1. 這個 worktree 的 .env.local 指向自己的檔（不要碰共用的 dev.db）
DATABASE_URL="file:./prisma/dev-mira.db"

# 2. 從 Turso 匯出快照（唯讀，不會改到正式庫）
turso db shell marketing-tool ".dump" > prisma/prod-snapshot.sql

# 3. 匯入本機
rm -f prisma/dev-mira.db* && sqlite3 prisma/dev-mira.db < prisma/prod-snapshot.sql

# 4. 重啟 dev server（換資料庫檔一定要重啟）
```

- 寫入只進本機副本，正式站不受影響
- 快照是**當下複本**，正式站之後的新資料不會同步，要更新就重跑
- 含真實客戶資料，別放桌面／雲端硬碟
- `.gitignore` 已加 `prisma/*.db` 與 `prisma/*.sql`

### 🔴 坑：Prisma client 是跨 worktree 共用的

`schema.prisma` 的 `generator client` **沒有設 `output`**，所以 client 產生在
`node_modules/.prisma/client`，而 `node_modules` 是共用 symlink。

意思是：**同一時間只能有一份 generated client**。Codex 在他的 worktree 跑
`prisma generate`，你這邊的 dev server 就會開始用他的 schema，查詢你資料庫裡
還沒有的欄位：

```
SQLITE_ERROR: no such column: main.LibraryImage.assetSubtype
   at GET (src/app/api/library/gallery/route.ts:20)
```

**不要為了修這個而在自己 worktree 跑 `prisma generate`** —— 那只會反過來弄壞對方，
變成互相覆蓋。

改成在本機副本補上缺的欄位即可（本機測試庫，加欄位無害）：

```bash
sqlite3 prisma/dev-mira.db \
  "ALTER TABLE LibraryImage ADD COLUMN assetSubtype TEXT;
   ALTER TABLE LibraryImage ADD COLUMN hasTransparentBackground BOOLEAN;"
```

對方之後再改 schema 可能又要補。這是共用 `node_modules` 的代價，
等那條分支合併就會消失。

---

## 二、輪替 Turso 的 DATABASE_AUTH_TOKEN

### 順序不能亂，而且一定會有停機

```bash
turso db tokens invalidate marketing-tool   # 舊 token 全部失效 ← 停機從這裡開始
turso db tokens create marketing-tool       # 產生新的
```

然後**兩個 Vercel 專案都要**更新 `DATABASE_AUTH_TOKEN` 並**重新部署**：

| 專案 | |
|---|---|
| `fimmick-mira` | 公司 Pro，未來的正式站 |
| `taiwan-image-process-x5hn` | 舊正式站，大家目前還在用 ← 很容易漏 |

⚠️ **Vercel 環境變數是建置時打包進去的，改了不重新部署不會生效。**

Turso 的 invalidate 是「輪替簽章金鑰」，會讓所有既有 token 一起失效，
**沒有新舊並存的空窗設計**，所以停機無法避免（約 5–10 分鐘，主要是兩次建置）。

把兩個 Vercel 環境變數頁面先開好再跑 invalidate，可以把中斷壓到最短。

### 驗證：外部看不出來

密碼閘（`src/proxy.ts`）在碰資料庫之前就回 401，所以就算 token 填錯，
從外面看到的還是一樣：401、密碼頁、build success。

**唯一有效的檢查是登入後看側邊欄的品牌清單有沒有出來**（那是從資料庫讀的）。
兩個站都要看。

### 不受影響的東西

本機 dev server（連 `file:`）、已匯出的快照、`turso` CLI 本身（用 CLI 登入
而非這把 token）、Blob / OpenRouter / fal 的金鑰。
