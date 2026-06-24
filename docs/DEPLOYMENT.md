# 部署筆記 — URL 穩定性 + 上雲改造（Vercel / Netlify）

> 本檔解答兩條問題：
> 1. 部署 / 版本更新後，**URL 目錄會唔會變？**
> 2. 呢個 marketing-tool **可唔可以直接上 Vercel / Netlify？** 唔得嘅話要改咩？

---

## Part 1 — URL 穩定性（通用概念）

### 核心原則：URL = 檔案／路由嘅名，同 host、同有冇用 Git 無關

URL 改唔改變，**只睇你個檔案 / 路由叫咩名**，唔係睇你用 Netlify 定 Vercel、用唔用 Git。

### 靜態網站（純 HTML，例如 Netlify 拖資料夾上傳）

檔名 = URL：

| 檔案 | URL |
|------|-----|
| `index.html` | `https://你站/` |
| `about.html` | `https://你站/about.html` |
| `testv1.html` | `https://你站/testv1.html` |

- **改內容、唔改名** → URL **唔變** ✅
- **改名**（`testv1.html` → `testv2.html`） → URL 變成 `/testv2.html`，舊嘅 `/testv1.html` 變 **404** ❌

👉 「改名一定改 URL」係 **web 嘅基本規則**，唔係邊個 host 嘅限制。

### Git 部署（Vercel / Netlify 都一樣）

Git 部署 = 將 repo 入面嗰個**檔案 / 路由結構照搬上去**，再用新版覆蓋舊版。

- 路由名照舊 → URL **唔變** ✅
- ⚠️ **唔係「因為用咗 Git」所以 URL 穩定**，而係「因為你冇改路由名」。如果喺 repo 入面 rename 咗 route，照樣變 URL。
- Production 網域（`你站.vercel.app` / `你站.netlify.app` / custom domain）跨 deploy **穩定不變**；每個 deploy 另有獨立 preview URL，但 production 嗰條唔郁。

### 一句總結

| 你做咩 | URL |
|--------|-----|
| 同一個檔名 / 路由，改內容 | **唔變** ✅ |
| 改檔名 / 路由名（v1 → v2） | **變**，舊 URL 404 ❌ |
| Git 重新 deploy，名照舊 | **唔變** ✅ |

**建議：唔好靠改檔名做版本（testv1 / testv2）。** 保持名穩定，用 **Git commit / tag** 記版本先係正路 —— URL 永遠唔郁，舊連結唔會死。

### 萬一真係要改名 → 設轉址（redirect）

令舊 URL 自動跳去新 URL，舊連結就唔會死：

- **Netlify**：放一個 `_redirects` 檔，例：`/testv1.html  /testv2.html  301`
- **Vercel**：`vercel.json` 入面 `redirects`
- **Next.js（本 app）**：`next.config.ts` 入面 `async redirects()`

---

## Part 2 — 呢個 app 可唔可以直接上 Vercel / Netlify？

### ⚠️ 結論：唔可以照搬，會壞。揀邊個 host 唔係重點。

呢個 marketing-tool **唔係靜態網站**，所以 Netlify「拖資料夾上傳」（純靜態托管）**跑唔起後端** —— 你只會見到靜態外殼，生成圖 / 上傳 / 分析 / 素材庫全部唔 work；連 `next export`（強制靜態化）都會因為有 API routes 而 build 失敗。

就算用 Git 行正式 serverless 部署（Vercel 或 Netlify Functions），仲有兩個**根本性 blocker**：

| 現況 | 上雲嘅問題 |
|------|-----------|
| 圖片寫入 `public/uploads/`（`generate` / `upload` / `inpaint` / `template-paste` 四條 API 都 `writeFile` 落本機磁碟） | Serverless 檔案系統**唯讀 + 即用即棄**，寫唔到 `public/uploads/`；一生成 / 上傳就 fail，重 deploy 仲會清光 |
| 資料庫 = 本機 SQLite 檔 `prisma/dev.db`（`DATABASE_URL="file:./prisma/dev.db"`） | 此檔 gitignore，根本唔會 deploy；serverless 亦無法持久寫入 |

> 所以你問嘅「`/uploads/` 目錄保唔保到」——**喺 serverless 環境保唔到**，因為嗰個本機資料夾根本唔存在。圖片 URL 要由 `/uploads/xxx.jpg` 改成雲端儲存嘅 URL。

### 要上雲，需要兩個改造（核心功能唔使重寫，屬收尾工程）

1. **圖片 → object storage**
   - 選項：**Vercel Blob** / **Netlify Blobs** / S3 / Cloudflare R2
   - 改 `saveBuffer()`（`src/app/api/library/generate/route.ts` 等）：由 `writeFile` 落本機，改成 upload 去 blob，DB 存返 blob 回傳嘅 URL
   - 影響嘅 API：`generate` / `upload` / `inpaint` / `template-paste`

2. **資料庫 → 雲端**
   - 本 app **已經用緊 libsql adapter**（`@prisma/adapter-libsql`），所以接 **Turso**（libSQL 雲端版）幾乎零摩擦：改 `DATABASE_URL` + 加 auth token 就得，唔使換 ORM、唔使大改 schema

改造完成後：URL 路由全部保持不變，版本更新（重 deploy）production URL 亦穩定。

---

## 相關

- 未採用素材清理（同 `public/uploads/` 體積有關）：見 [UNUSED-ASSETS.md](./UNUSED-ASSETS.md) + backlog（[CHECKLIST.md](./CHECKLIST.md)）
- 本機環境 / 啟動：見 [SETUP.md](./SETUP.md) / [MIGRATION.md](./MIGRATION.md)
