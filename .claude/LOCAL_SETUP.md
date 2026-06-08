# Local Dev Setup Notes
> 本地筆記
> Last updated: 本週（素材庫重構後）

---

## 環境設定

### .env.local（專案根目錄）
```
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="..."                       # 舊活動文案 route（未用）
OPENROUTER_API_KEY="sk-or-v1-..."             # 圖片分析 + 生成文案
OPENROUTER_VISION_MODEL="openai/gpt-5.4-nano" # 圖片分析（model id 會輪換，404 時換現存平價 model）
OPENROUTER_TEXT_MODEL="openai/gpt-5.4-nano"   # 生成文案
GEN_PROVIDER="inapp"                          # inapp | n8n
HF_TOKEN="hf_..."                             # 圖片生成主力（HF FLUX.1-schnell）
POLLINATIONS_TOKEN=""                         # 留空＝直接行 HF（此 IP 被 Pollinations 402 擋）
```
> 圖片：Pollinations（有 token 時）→ 失敗轉 HF（`router.huggingface.co/hf-inference/models/...`）。文案：OpenRouter。

### 啟動指令
```bash
cd /Users/verna/Desktop/claude-code-examples
npm run dev
# → http://localhost:3000 (自動 redirect 到 /clients)
```

### 首次設定（DB 不存在時）
```bash
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy
DATABASE_URL="file:./prisma/dev.db" npx prisma generate
```

---

## 頁面地圖

| # | 名稱 | URL |
|---|------|-----|
| 1 | 客戶列表 | `/clients` |
| 2 | 新增客戶 | `/clients/new` |
| 3 | 客戶詳情 | `/clients/[id]` |
| 4 | 品牌設定 | `/clients/[id]/settings` |
| 5 | 新增活動 | `/clients/[id]/activities/new` |
| 6 | 素材庫 — 生成圖片 | `/library` tab 1（4 積木 + 注意事項 + 色盤開關 + 生成 + 圖片紀錄）|
| 7 | 素材庫 — 風格組件 | `/library` tab 2（品牌圖庫 + popup + 構圖/配色/語氣/背景 子分頁）|

> 素材庫由 3 tab → **2 tab**：圖片分析已併入風格組件。

---

## 功能紀錄

### 本週：素材庫重大重構（接通 AI 生成 + 統一圖庫）
- **接通生成**：`生成新圖` 掣接 `POST /api/library/generate`；圖 = Pollinations→**HF FLUX.1-schnell** 備援，文案 = OpenRouter；存 `LibraryImage` 並入圖片紀錄/圖庫
- **合併分頁**：移除「圖片分析」tab，併入「風格組件」（品牌圖庫 union → 點圖/點卡片出 `ImageDetailModal` popup，hover 不再出 preview）
- **5 色色盤**：主色/輔色/強調色/中性色/點綴色；coolors 風 `ColorCards`；`data.colors[]` array + legacy 同步；analyze 加 `extraColors`
- **背景類別**：第 4 component 類別 + 第 4 積木（上傳專用）
- **資料**：新 `LibraryImage` 表 + `Client.paletteColors`（migration `library_redesign`，全 additive）
- **Model 更新**：OpenRouter `gemini-2.0-flash-001` 已 404 → 改 `openai/gpt-5.4-nano`（vision + text）
- 新檔：`lib/generate.ts`、`api/library/{generate,gallery}`、`components/library/{ColorCards,ImageDetailModal}.tsx`；刪 `ImageAnalyzer.tsx`

### 2026-06-03（已 commit）
| commit | 功能 |
|--------|------|
| `a726d82` | fix: 圖片分析「加入剩餘素材」按鈕無效 |
| `7934ddf` | feat: 素材刪除 + 圖片風格雙向導航 |
| `3a2b881` | feat: 三類型同時新增 + 圖片分析頁 |
| `cdef47b` | feat: 圖片分析改用 OpenRouter |
| `f346da5` | feat: 素材庫快速加入素材功能（初版） |

---

## 本地測試資料（永遠不 push）
- 客戶「測試品牌」ID: `cmpxszrme00002lvdpoep62c7`；另有「Sofie」客戶
- 生成測試圖（`LibraryImage`）+ 上傳圖在 `public/uploads/`
- 所有資料只存在 `prisma/dev.db` / `public/uploads/`（皆 gitignore）
