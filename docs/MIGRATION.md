# 換電腦 / Migration 清單

> 重點：**git 只會帶走程式碼同文件**。以下「本機限定」內容**不會**經 git 傳走，必須手動複製（已備份喺 `.backup/<timestamp>/`）。

## git 會帶走 ✅
- 全部 source code（`src/`、API routes、Prisma schema、migrations）
- 文件（`docs/`、`.claude/*.md`、`.claude/skills/`）
- `.env.example`（範本，無真 key）

## git **唔會**帶走 ❌（gitignore，要手動複製）
| 內容 | 路徑 | 點處理 |
|------|------|--------|
| 真 API key / token | `.env.local` | 用 `.env.example` 重建，填返真實 key（OpenRouter / HF） |
| 本機資料庫（客戶/素材/生成紀錄） | `prisma/dev.db` | 從 `.backup/` 複製，或重新 migrate 建空 DB |
| 上傳/生成圖片 | `public/uploads/` | 從 `.backup/` 複製（否則圖片連結會 404） |
| 備份本身 | `.backup/` | 用 USB / 雲端硬碟手動搬 |

## 新電腦設定步驟
1. **Clone**：`git clone https://github.com/verna-fimmickTW/market-tool-v-wip.git`
2. **裝套件**：`npm install`
3. **環境變數**：`cp .env.example .env.local` → 填入真實 `OPENROUTER_API_KEY`、`HF_TOKEN`
   - OpenRouter key：https://openrouter.ai/keys
   - HF token：https://huggingface.co/settings/tokens（Read）
4. **資料庫**（二選一）：
   - 想保留舊測試資料：將備份嘅 `prisma/dev.db` 複製返入 `prisma/`
   - 想要乾淨開始：`DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy`
   - 然後一定要：`npx prisma generate`
5. **圖片**：將備份嘅 `public/uploads/` 複製返入（保留生成圖/測試素材）
6. **啟動**：`npm run dev` → http://localhost:3000/library

## 換電腦前必做（舊電腦）
1. 確認最新 commit 已 push（見下）
2. 將 `.backup/<最新>/`（dev.db + uploads + .env.local）複製去 USB / 雲端
   - 或即時重做備份：見 `docs/SETUP.md` 的「備份指令」

## Push 到 GitHub
- Remote 已設：`origin → https://github.com/verna-fimmickTW/market-tool-v-wip.git`（私人 repo，公司帳號 verna-fimmickTW）
- 指令：`git push origin main`
- 若要求登入：用 GitHub Personal Access Token（https://github.com/settings/tokens）作 HTTPS 密碼，或設定 SSH key
- ⚠️ 唔好 push 去 `fimmick/claude-code-examples`（嗰個係 chesterchiu 嘅原始 repo，已唔再係本專案 remote）
