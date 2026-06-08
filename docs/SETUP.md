# 開發設定 Setup

> Project: marketing-tool（Next.js 16 + React 19 + Prisma + libsql/SQLite）

## 環境變數（`.env.local`，不 commit）
見 `.env.example`。重點：
- `OPENROUTER_API_KEY` — 圖片分析(vision) + 生成文案。https://openrouter.ai/keys
- `OPENROUTER_VISION_MODEL` / `OPENROUTER_TEXT_MODEL` — 預設 `openai/gpt-5.4-nano`
  - ⚠️ OpenRouter model id 會輪換/下架。若 analyze 或 generate 回 `No endpoints found` / 404，去 `https://openrouter.ai/api/v1/models` 揾現存平價且支援 vision 的 model 換上即可。
- `HF_TOKEN` — 圖片生成主力（HF FLUX.1-schnell）。https://huggingface.co/settings/tokens（Read）
- `POLLINATIONS_TOKEN` — 留空（免費匿名常回 402，留空直接行 HF）
- `GEN_PROVIDER` — `inapp`（預設）或 `n8n`（stub）

## 資料庫（SQLite via Prisma + libsql adapter）
- 檔案：`prisma/dev.db`（gitignore）
- 首次/新機：
  ```bash
  DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy
  npx prisma generate
  ```
- 改 schema：
  ```bash
  DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name xxx --create-only   # 先檢查 SQL 只有 ADD/CREATE
  DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev                             # 套用
  ```
  切勿 `migrate reset` / 刪 `dev.db`（會清資料）。

## 啟動
```bash
npm run dev   # dotenv -e .env.local -- next dev → http://localhost:3000（自動轉 /clients）
```
- 主要頁：`/library`（素材庫，2 tabs：生成圖片 / 風格組件）
- 換 model / 排查：見 `.claude/skills/run-dev/SKILL.md`

## 備份指令（換電腦前跑）
```bash
TS=$(date +%Y%m%d-%H%M%S); DEST=".backup/$TS"
mkdir -p "$DEST/uploads"
cp prisma/dev.db "$DEST/dev.db"
cp -R public/uploads/. "$DEST/uploads/"
cp .env.local "$DEST/.env.local"   # 含真實 key，只放本機 / USB，勿上傳
```
`.backup/` 已 gitignore。將整個 `.backup/<TS>/` 複製去 USB/雲端帶去新電腦。

## 圖片生成流程（in-app）
- 全 AI 生成：`compileImagePrompt`(slots/subject/notes) → HF FLUX 出圖 + OpenRouter 出文案 → 存 `public/uploads` + `LibraryImage`
- 合成模式：去背 PNG 用 `sharp` 疊落「背景積木圖」或「AI 生成背景」
- 端點：`POST /api/library/generate`、`GET /api/library/gallery`、`POST /api/library/describe`
- Pollinations 對 datacenter/部分 IP 回 402 → 自動轉 HF（端點 `router.huggingface.co/hf-inference/models/<HF_IMAGE_MODEL>`）
