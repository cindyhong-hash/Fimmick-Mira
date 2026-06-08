---
description: Launch the marketing-tool dev server and verify all pages load correctly
---

# Run Dev — marketing-tool

## Prerequisites (first time only)

1. **`.env.local`** must exist at project root:
   ```
   DATABASE_URL="file:./prisma/dev.db"
   ANTHROPIC_API_KEY="..."                       # 舊活動文案 route（未用）
   OPENROUTER_API_KEY="sk-or-v1-..."             # 圖片分析 + 生成文案
   OPENROUTER_VISION_MODEL="openai/gpt-5.4-nano" # model id 會輪換；404 時去 /api/v1/models 換現存平價 model
   OPENROUTER_TEXT_MODEL="openai/gpt-5.4-nano"
   GEN_PROVIDER="inapp"                          # inapp | n8n
   HF_TOKEN="hf_..."                             # 圖片生成主力（HF FLUX.1-schnell, router.huggingface.co）
   POLLINATIONS_TOKEN=""                         # 留空＝直接行 HF（此 IP 被 Pollinations 402 擋）
   ```

2. **Database** must be initialised:
   ```bash
   DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy
   DATABASE_URL="file:./prisma/dev.db" npx prisma generate
   ```

## Launch

Use the preview tool (already configured in `.claude/launch.json`):

```
preview_start("dev")   # port 3000, autoPort: false
```

If port 3000 is in use by a stale process:
```bash
lsof -ti :3000 | xargs kill -9
```

Then retry `preview_start("dev")`.

## Verify pages

Navigate via `preview_eval`:
```js
location.href = 'http://localhost:3000/clients'
location.href = 'http://localhost:3000/library'
```

Expected pages:
| URL | What to see |
|-----|-------------|
| `/clients` | 客戶列表，sidebar 顯示客戶資料夾 |
| `/clients/new` | 新增客戶表單 |
| `/clients/[id]` | 客戶詳情 + 新增活動按鈕 |
| `/clients/[id]/settings` | 品牌設定表單 |
| `/clients/[id]/activities/new` | 新增活動表單 |
| `/library` (生成圖片 tab) | 4-slot 積木組合台(構圖/配色/語氣/背景) + 注意事項 + 色盤開關 + 生成新圖 + 圖片紀錄 |
| `/library` (風格組件 tab) | 品牌圖庫(上傳+生成) → 點圖出 popup；子分頁 構圖/配色/語氣/背景；加入素材 / 刪除 |

> 素材庫只有 **2 tabs**（圖片分析已併入風格組件）。

## Common errors

| Error | Fix |
|-------|-----|
| `Cannot find module '.prisma/client/default'` | Run `npx prisma generate` |
| `OPENROUTER_API_KEY 尚未設定` | 填入 `.env.local` 的真實 key |
| analyze/generate 回 `No endpoints found` / 404 | OpenRouter model 已下架；去 `/api/v1/models` 揾現存平價 model 換 `OPENROUTER_*_MODEL` |
| 生成圖回 Pollinations 402 / HF fetch failed | Pollinations 此 IP 被擋；填 `HF_TOKEN` 行 HF。HF 端點須用 `router.huggingface.co`（非 api-inference） |
| `PORT 3000 in use` | `lsof -ti :3000 \| xargs kill -9` |
| Empty page / chrome-error | preview_eval: `location.href = 'http://localhost:3000/...'` |
