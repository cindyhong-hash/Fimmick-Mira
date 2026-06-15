# 📑 文檔總目錄 — marketing-tool

> 搵文檔由呢度入。每份文檔嘅用途同對象列喺下面。
> （專案脈絡同 git 規則喺根目錄 `CLAUDE.md` / `AGENTS.md`。）

---

## 🚀 想即刻用
| 文檔 | 內容 | 啱邊個睇 |
|---|---|---|
| **[GUIDE-新手使用.md](./GUIDE-新手使用.md)** | 由開機到生成第一張圖、兩種生成方式、⚠️ AI 限制、常見情況點揀 | **第一次用嘅人** |
| [SETUP.md](./SETUP.md) | 環境變數、token、啟動指令、初始化 DB | 裝機 / 跑起個 app |
| [MIGRATION.md](./MIGRATION.md) | 換電腦要手動帶嘅嘢（.env.local / dev.db / uploads） | 換機 |

## 🧠 想了解 AI / 改 AI 行為
| 文檔 | 內容 | 啱邊個睇 |
|---|---|---|
| **[AI-ENGINES.md](./AI-ENGINES.md)** | 所有 AI 模型一覽、各引擎強項/限制、**點手動改生圖排序**、AI 技術限制 | **要改 AI 排序/換模型** |
| **[FUNCTIONS.md](./FUNCTIONS.md)** | 函數速查：邊個函數做咩、用邊個 model/endpoint/env + API 路由 | **要搵某個生成函數** |

## 📜 想睇歷史 / 決定
| 文檔 | 內容 | 啱邊個睇 |
|---|---|---|
| [FEATURE_LOG.md](./FEATURE_LOG.md) | 完整功能/變更紀錄（含**第三輪時序** + 回推原因 + summary）| 想知做過咩、點解咁做 |
| [DECISIONS.md](./DECISIONS.md) | 重要設計決定 + 理由（含第三輪：引擎/文字/模型決定）| 想知「點解唔用 X」 |
| [CHECKLIST.md](./CHECKLIST.md) | 功能清單 + backlog（待做） | 規劃下一步 |
| [PLAN-library-redesign.md](./PLAN-library-redesign.md) | 素材庫原始重構計劃 | 背景脈絡 |

---

## 🗺️ 快速地圖（程式碼）

| 想改… | 去邊度 |
|---|---|
| AI 生圖**引擎排序** | `src/app/api/library/generate/route.ts` 搜 `手動改`（→ [AI-ENGINES.md §3](./AI-ENGINES.md)） |
| **換 AI 模型** | `src/lib/generate.ts` 頂部常數 / `.env.local`（→ [AI-ENGINES.md §1](./AI-ENGINES.md)） |
| 素材庫頁面 / 分頁 | `src/app/library/page.tsx` |
| 組合台 / 上載 / 各 popup | `src/components/library/*.tsx` |
| 型別 / 配色 role / 引擎徽章 | `src/types/library.ts` |
| 行業範本 | `src/types/presets.ts` |

---

## 一句概覽

社群行銷素材工具，核心係 `/library` 素材庫（**風格組件** + **生成圖片** 兩 tab）。
產品合成有 **3 個 AI 引擎可揀**（**FLUX.2 edit 主力**·中文字最清 / nano-banana 自然 / Seedream 4.5）+ 自動 fallback；純文字生圖用 FLUX；素材生成做 背景/人像/插畫。
詳情入返上面對應文檔。
