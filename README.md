# Marketing Content Tool — 專案導覽與使用說明

> **給合作夥伴的快速指引：** 這是一個需要在本機啟動伺服器才能使用的 Web 應用程式，**沒有獨立的 HTML 頁面可以直接點兩下開啟**。請依照下方步驟啟動後，用瀏覽器開啟 `http://localhost:3000` 即可看到 market-tool 主介面。

---

## 一、專案簡介

**Marketing Content Tool** 是一個專為行銷團隊打造的內容生產工具，協助管理多個客戶的品牌設定、行銷活動（Activity）與貼文素材。

主要功能包含：

- **客戶管理** — 建立客戶資料夾，儲存品牌色、字體、語氣等設定
- **活動管理** — 為每位客戶建立行銷活動，管理文案與圖片素材
- **AI 文案生成** — 透過 Claude（Anthropic）自動產出符合品牌語氣的行銷文案
- **AI 圖片生成** — 透過 DALL-E 3（OpenAI）產生活動配圖
- **素材庫** — 統一管理已上傳的圖片資產與風格元件

---

## 二、如何找到 market-tool 入口

這個專案使用 **Next.js**（一個 React 框架），**沒有獨立的 HTML 檔案**，所有頁面都是透過伺服器動態生成的。

| 頁面 | 路徑（啟動伺服器後在瀏覽器輸入） |
|------|----------------------------------|
| **主入口（自動跳轉至客戶列表）** | `http://localhost:3000` |
| 客戶列表 | `http://localhost:3000/clients` |
| 新增客戶 | `http://localhost:3000/clients/new` |
| 某客戶的活動列表 | `http://localhost:3000/clients/[clientId]` |
| 素材庫 | `http://localhost:3000/library` |

> 啟動伺服器的步驟請見下方【本地運行指南】。

---

## 三、資料夾結構

```
marketing-tool/
│
├── src/
│   ├── app/                          ← Next.js 頁面（路由）
│   │   ├── page.tsx                  ← 首頁（自動跳轉至 /clients）★ 入口
│   │   ├── layout.tsx                ← 全域版面配置
│   │   ├── globals.css               ← 全域樣式
│   │   │
│   │   ├── clients/                  ← 客戶相關頁面 ★ 主要功能區
│   │   │   ├── page.tsx              ← 客戶列表
│   │   │   ├── new/page.tsx          ← 新增客戶
│   │   │   └── [clientId]/
│   │   │       ├── page.tsx          ← 某客戶的活動列表
│   │   │       ├── settings/page.tsx ← 客戶品牌設定
│   │   │       └── activities/
│   │   │           ├── new/page.tsx  ← 新增活動
│   │   │           └── [activityId]/
│   │   │               ├── page.tsx        ← 活動詳情
│   │   │               ├── edit/page.tsx   ← 編輯活動
│   │   │               └── editor/page.tsx ← 素材編輯器
│   │   │
│   │   ├── library/page.tsx          ← 素材庫
│   │   │
│   │   └── api/                      ← 後端 API 路由
│   │       ├── clients/              ← 客戶 CRUD
│   │       ├── activities/           ← 活動 CRUD
│   │       ├── generate/             ← AI 文案生成
│   │       ├── transform-copy/       ← 文案語氣轉換
│   │       ├── assets/               ← 素材查詢
│   │       ├── components/           ← 風格元件
│   │       ├── export/               ← 匯出功能
│   │       └── upload/               ← 圖片上傳
│   │
│   ├── components/                   ← 可重用 UI 元件
│   │   ├── activities/               ← 活動相關元件
│   │   ├── clients/                  ← 客戶相關元件
│   │   ├── layout/                   ← 版面元件（Sidebar、MainLayout）
│   │   ├── library/                  ← 素材庫元件
│   │   └── ui/                       ← 基礎 UI 元件（Button、Input 等）
│   │
│   ├── lib/                          ← 工具函式與第三方整合
│   │   ├── anthropic.ts              ← Claude AI 整合
│   │   ├── openai.ts                 ← OpenAI DALL-E 整合
│   │   ├── db.ts                     ← 資料庫連線（Prisma）
│   │   ├── prompts.ts                ← AI Prompt 設定
│   │   └── utils.ts                  ← 通用工具函式
│   │
│   └── types/                        ← TypeScript 型別定義
│
├── prisma/
│   ├── schema.prisma                 ← 資料庫結構定義
│   ├── dev.db                        ← SQLite 資料庫（本機資料）
│   └── migrations/                   ← 資料庫版本紀錄
│
├── public/
│   └── uploads/                      ← 上傳的圖片素材
│
├── .env.example                      ← 環境變數範本（必看！）
├── .env.local                        ← 實際環境變數（含 API 金鑰，勿上傳）
├── package.json                      ← 專案依賴與指令
└── next.config.ts                    ← Next.js 設定
```

---

## 四、本地運行指南

### 前置需求

- **Node.js** 18 以上版本（[下載點](https://nodejs.org/)）
- **npm**（隨 Node.js 一起安裝）

### 步驟一：確認環境變數

複製範本並填入 API 金鑰：

```bash
# 如果 .env.local 不存在，先複製範本
cp .env.example .env.local
```

用文字編輯器開啟 `.env.local`，填入以下金鑰（至少需要 Anthropic 金鑰才能使用 AI 功能）：

```
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="sk-ant-你的金鑰"
OPENAI_API_KEY="sk-proj-你的金鑰"
```

> 如果 `.env.local` 已存在且已有金鑰，可以跳過此步驟。

### 步驟二：安裝依賴套件

```bash
npm install
```

> 首次執行需要幾分鐘，之後不需要重複執行（除非套件更新）。

### 步驟三：啟動開發伺服器

```bash
npm run dev
```

看到以下訊息代表成功啟動：

```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

### 步驟四：在瀏覽器開啟

打開瀏覽器，前往：

```
http://localhost:3000
```

頁面會自動跳轉至 **客戶列表**，這就是 market-tool 的主介面。

### 停止伺服器

在終端機按下 `Ctrl + C` 即可停止。

---

## 五、常見問題

**Q：我找不到 `.env.local` 檔案？**
A：檔案開頭有點（`.`），在 Mac Finder 中預設隱藏。請在終端機執行 `ls -a` 可以看到它，或直接用 VS Code 開啟整個資料夾。

**Q：執行 `npm run dev` 後出現錯誤？**
A：最常見原因是 `.env.local` 缺少 `DATABASE_URL`。請確認環境變數已正確設定。

**Q：頁面顯示空白或 404？**
A：確認終端機顯示「Local: http://localhost:3000」後，重新整理瀏覽器頁面。

**Q：AI 生成功能沒有回應？**
A：請確認 `.env.local` 中的 `ANTHROPIC_API_KEY` 已填入有效金鑰。
