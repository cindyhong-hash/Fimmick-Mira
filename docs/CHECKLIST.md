# 功能檢查清單 + 待增加項目

> 換電腦 / 改動後可照此清單逐項驗證。最後更新：本週第二輪重構後。

---

## ✅ 功能檢查清單（現有功能）

### 生成圖片頁（/library → 生成圖片）
- [ ] 積木 slot（構圖/配色/語氣/背景）**點擊** → 彈窗揀已有素材帶入
- [ ] 從「風格組件」帶入素材 → slot 填入 + 右下角 toast（**唔跳分頁**）
- [ ] 配色 slot 有色時，色盤逐色「使用/不使用」開關（主色鎖定）
- [ ] 主體物件可打字
- [ ] 上傳產品圖 →「AI 讀圖填主體」自動填繁中主體
- [ ] 上傳去背 PNG + 勾「直接合成」→ 產品疊落背景積木圖/AI 背景
- [ ] 上傳非透明圖 + 合成 → 提示「先去背」(remove.bg/photoroom)
- [ ] 「其他注意事項」欄可輸入
- [ ] 編譯後 Prompt 預覽 + 複製
- [ ] 「生成新圖」→ 出圖(HF) + 文案(繁中)；約 5–15 秒
- [ ] 圖片紀錄顯示生成圖；**點擊 → popup**（圖 + 文案 + 重新生成）
- [ ] popup「重新生成/調整」→ 載入原參數到生成台

### 風格組件頁（/library → 風格組件）
- [ ] 預設「圖庫」= 品牌全部圖（上傳分析圖 + 生成圖，生成圖有「生成」標籤）
- [ ] 子分頁：全部 / 構圖 / 配色 / 語氣 / 背景
- [ ] 點圖庫圖 或 點組件卡片 → 同一個 popup（**hover 唔再出 preview**）
- [ ] popup 內素材可「帶入生成」/「複製 Prompt」/「編輯」
- [ ] 配色用 coolors 大色卡（點擊複製 hex）；舊 2 色素材仍正常顯示
- [ ] 卡片可刪除（二次確認）
- [ ] 「加入素材」→ 行業範本一鍵填入（6 行業）
- [ ] 加入素材：4 類型可同時新增、5 色色盤、背景可純文字/上傳 + 「AI 偵測描述」
- [ ] 上傳參考圖 →「AI 讀取圖片」填構圖/配色/語氣（繁中）
- [ ] 「編輯」→ 彈窗預填、改完儲存即覆蓋（PATCH）
- [ ] 重新分析同一張圖 → 更新現有素材 + 置頂（唔建重複）

### 後端 / 資料
- [ ] analyze、生成文案 輸出**繁體中文（台灣）**；英文 aiPromptText 保留
- [ ] OpenRouter model 404 時 → 換 env model 即修復
- [ ] Pollinations 402 → 自動轉 HF
- [ ] `dev.db` 資料完整（客戶/素材/生成紀錄）
- [ ] `.env.local` / `dev.db` / `public/uploads/` / `.backup/` 均 gitignore，無誤推

---

## 🧩 待增加項目（Backlog）

### 1. 加入 fal.ai API key 製圖
- 將 **fal.ai** 加成圖片生成 provider（FLUX 等，速度快、品質高）。
- 做法：`src/lib/generate.ts` 加 `falImage()`；新增 env `FAL_KEY`（https://fal.ai/dashboard/keys）+ `IMAGE_PROVIDER=fal|hf|pollinations`（或在現有 fallback 鏈加 fal 為主力）。
- 端點參考：`https://fal.run/fal-ai/flux/schnell`（POST，Authorization: `Key <FAL_KEY>`，回 image url → 下載落 `public/uploads`）。
- 好處：比 HF 免費層穩定/快；可取代或排喺 HF 之前做主力。
- ⚠️ 確認你寫嘅係 **fal.ai**（如果係其他服務請更正）。

### 2. 加入參考連結
- 待釐清用途（二選一或都要）：
  - (a) **生成參考**：喺生成台可貼參考圖**網址**作風格/構圖參考（注意：免費 text-to-image 唔食輸入圖；可行做法＝下載該圖→AI 描述→併入 prompt，或合成）。
  - (b) **素材參考**：素材/圖片可附「來源連結」欄（例如靈感出處 URL），喺 popup 顯示可點。
- 待你確認方向後再排做法。

### （其他已知可做，未必要做）
- 真 img2img / 多產品合成（需付費或更強模型）
- n8n provider（`GEN_PROVIDER=n8n` 目前係 stub，可接外部 workflow）
- 生成圖一鍵「分析加入素材庫」(目前可經 popup 分析)
