# 圖片測試文件 — Image & AI Engine Test Reference

> 用途：上雲（Supabase / Vercel）前，記錄本工具用緊邊啲 AI engine 生圖、各 engine 對應咩用途、以及圖片儲存現況同瘦身方案。
> 最後更新：2026-06-23

---

## 1. 圖片儲存現況（瘦身前）

| 指標 | 數值 |
|---|---|
| 位置 | `public/uploads/`（平層，UUID 命名，無子目錄） |
| 總檔數（瘦身前） | 410 |
| 總容量（瘦身前） | 447 MB |
| 被 DB 引用（保守掃描） | **324（79%）** |
| Orphan（無引用） | **86（21%，59 MB）** |
| **瘦身後容量** | **387 MB**（已搬 orphan 去 `.backup/uploads-orphans-*`） |
| 程式碼硬引用 | 0（全部動態 `/uploads/${filename}`） |

> 註：初步 column-by-column 查只計到 239 in-use，但用 `strings` 全 DB 保守掃描其實有 **324** 個被引用 —— 多出嗰 85 個喺其他欄位（如 `Client.pastPostImageUrls`）有用到。故**只有 86 個係真 orphan**，已用 `scripts/slim-uploads.sh --apply` 搬走（可還原）。

**副檔名分佈**：PNG 193（47%）、JPG 173（42%）、WebP 24（6%）、JPEG 15（4%）、AVIF 5（1%）。
其中 **JPEG（15）、AVIF（5）100% 係 orphan**。

**Supabase 免費額度對照**：File Storage 上限 **1 GB**。瘦身後（447→~260MB）約用 26%，但本工具會不斷生成新圖，**長遠仍要升 Pro（US$25/月，100GB）或改用 Cloudflare R2（免費 10GB）**。

---

## 2. AI Engine 清單（測試對照表）

主力供應商係 **fal.ai**，輔以 Recraft / OpenRouter / Pollinations / HuggingFace。
DB 用 `Activity.imageModel` 欄位記錄每張圖用咗咩 mode。

### 2.1 各 engine 用途與 model id

| Mode（DB 記錄） | Provider | Model ID | 用途 |
|---|---|---|---|
| `flux2-edit` | fal.ai | `fal-ai/flux-2-pro/edit` | **產品合成（主力）** |
| `flux2-person` | fal.ai | `fal-ai/flux-2-pro` | 真人寫實人物 |
| `flux-scene` | fal.ai | `black-forest-labs/FLUX.1-schnell`（HF 備援） | 場景生成 |
| `fal-edit` / `nano-banana` | fal.ai | `fal-ai/nano-banana` `/edit` | text→image / 圖片編輯 |
| `seedream-edit` | fal.ai | `fal-ai/bytedance/seedream/v4.5/edit` | Seedream 4.5 編輯 |
| `qwen-edit` | fal.ai | `fal-ai/qwen-image-edit-plus` | Qwen 圖片編輯 |
| `bria` / `bria-preserve` | fal.ai | `fal-ai/bria/product-shot` | 產品去背合成（舊） |
| `recraft-illustration` | Recraft | `fal-ai/recraft/v3/text-to-image` | 2D 插畫 |
| `gpt-image` / `gpt-image-mini` | OpenRouter | `openai/gpt-5.4-image-2` | 圖片合成 |
| `paste-template` | 本地 | `sharp` 疊圖 | 模板貼上（無 AI） |
| 背景移除 | fal.ai | `fal-ai/birefnet` | 去背 |
| 高清化 | fal.ai | `fal-ai/clarity-upscaler` | upscale |
| 文案 / 分析 | OpenRouter | `openai/gpt-5.4-nano` | 文字 + vision |

### 2.2 使用次數統計（自 dev.db）

```
fal-edit              82
flux2-edit            25
bria                  13
nano-banana           11
paste-template        10
bria-preserve         10
seedream-edit          8
flux2-person           8
flux-scene             5
recraft-illustration   2
qwen-edit              2
gpt-image              2
gpt-image-mini         1
```

---

## 3. 測試項目 Checklist（上雲前手動 smoke test）

逐個 engine 行一次，確認上雲後仍 work（key 改放 Vercel env、圖片改寫去 Supabase Storage）：

- [ ] `flux2-edit` 產品合成 — 上傳產品圖 → 出合成圖
- [ ] `flux2-person` 真人生成 — 文字描述 → 出人物圖
- [ ] `flux-scene` 場景 — fal 主、HF 備援切換正常
- [ ] `nano-banana` / `seedream-edit` / `qwen-edit` 編輯流程
- [ ] `recraft-illustration` 插畫
- [ ] `gpt-image` OpenRouter 合成
- [ ] 背景移除（birefnet）+ 高清化（clarity-upscaler）
- [ ] 圖片**寫入**：確認新圖寫得入 Supabase Storage（serverless 寫唔到本機 disk）
- [ ] 圖片**讀取**：素材庫 `/library` 兩個 tab 顯示正常
- [ ] 單檔 < 50MB（Supabase 免費單檔上限）

---

## 4. 瘦身方案（cut orphan）

**做法（安全、可還原）**：用 `scripts/slim-uploads.sh`——
1. 重新完整掃描 `dev.db` 抽出**所有** `uploads/...` 引用（包括 `Client.pastPostImageUrls` 等所有欄位，比初次調查更保守）。
2. 把無引用的檔案**搬去**（非刪除）`.backup/uploads-orphans-<日期>/`。
3. 確認 `/library` 與各頁正常後，過幾日再人手清 `.backup`。

詳見該 script 註解。**唔好直接 `rm`**，因為引用分析有可能漏欄位。
