@AGENTS.md

# 專案脈絡 — marketing-tool（換機 / 新 session 必讀）

社群行銷素材工具；核心係素材庫 `/library`（2 tabs：生成圖片 / 風格組件）。
完整紀錄喺 `docs/`：**SETUP**（環境/token/啟動）、**MIGRATION**（換機清單）、**FEATURE_LOG**、**DECISIONS**、**CHECKLIST**（功能清單 + backlog）、**PLAN**。開工前讀返呢啲就上到手。

## 換機後要做
git 只帶 code + docs。**手動帶**（gitignore，唔會喺 clone 入面）：`.env.local`、`prisma/dev.db`、`public/uploads/`（從 `.backup/<最新>/` 複製）。詳見 `docs/MIGRATION.md`。
快速：`cp .env.example .env.local`（填 OPENROUTER_API_KEY + HF_TOKEN）→ `npm install` → `npx prisma generate` → `npm run dev` → http://localhost:3000/library

## Git 規則（必守）
- `origin` = 私人 repo `verna-fimmickTW/market-tool-v-wip`；push 去 origin OK。
- **絕對唔好 push 去 `fimmick/claude-code-examples`**（chesterchiu 原始 repo，已唔再係本專案 remote，唔好 re-add）。
- 私人 WIP 同公司 repo **分開做**；將來用 **PR** merge 功能入公司 repo。
- **Merge 時：`docs/` 同 `.claude/*.md`（WIP 筆記）唔好 merge 入公司 repo**，只 merge 程式碼/功能。
- commit email 用公司 `vernaip@fimmick.com`。⚠️ 全機 global 預設係個人 email；新機 clone 後要：`git config user.email vernaip@fimmick.com`

## 老闆分享 repo（market-tool-demo）
- **分享 repo**：`verna-fimmickTW/market-tool-demo`（Private，已 invite 老闆）
- **remote 名**：`share`（走 port 443：`ssh://git@ssh.github.com:443/verna-fimmickTW/market-tool-demo.git`）
- **規矩**：只放 code + `docs/GUIDE-新手使用.md`；剝走 `CLAUDE.md`、`AGENTS.md`、`.claude/`、其他 `docs/`
- **每次同步**：`bash scripts/sync-share.sh "今次更新咗咩"` — 自動剝走內部文件再 force-push
- 用戶話「sync demo」/ 「push 新版去 demo」就係叫行呢個 script
- 進度記錄自動寫去 `docs/SHARE-LOG.md`
- 老闆 clone 後：要自備 `.env.local`（3 個 key：OpenRouter / fal.ai / HF）+ 跑 `npx prisma db push`，詳見 `docs/GUIDE-新手使用.md`

## 供應商 / 已知（2026-06-11）
- 圖片生成（text→image）：**fal.ai FLUX.1-schnell**（`FAL_KEY`，主）→ **HF FLUX**（`HF_TOKEN`，備，端點 `router.huggingface.co`）→ Pollinations（停，402）。
- 產品合成：**fal.ai Bria Product Shot**（`fal-ai/bria/product-shot`，~$0.04/張，主）→ `sharp` 疊圖（備，需透明去背 PNG）。
- 文字/分析用 **OpenRouter**（vision + text 都用 `openai/gpt-4o-mini`）；model id 會輪換，404 就去 `/api/v1/models` 換現存平價 model。
- 設計描述以**繁中為主**，生成時自動翻英餵 FLUX；所有 AI 輸出（分析/文案）一律**繁體中文（台灣）**。
