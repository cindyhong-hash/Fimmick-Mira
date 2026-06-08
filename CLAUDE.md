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

## 供應商 / 已知
- 圖片生成靠 **HF FLUX**（`HF_TOKEN`，端點 `router.huggingface.co`）；Pollinations 對部分 IP 回 402，故 `POLLINATIONS_TOKEN` 留空直接行 HF。
- 文字/分析用 **OpenRouter**；model id 會輪換，404 就去 `/api/v1/models` 換現存平價 model（現用 `openai/gpt-5.4-nano`）。
- 所有 AI 輸出（分析名稱/描述/文案）一律**繁體中文（台灣）**；英文 `aiPromptText` 保留俾圖像模型。
