# 素材庫生成 — 測試結果 / Testing Materials
> 本週重構驗證時產生，留俾下週做 testing materials。
> 圖片實際靠 **Hugging Face FLUX.1-schnell** 生成、文案靠 **OpenRouter (gpt-5.4-nano)**。
> 所有圖 + 紀錄存喺本機（`public/uploads/` + `prisma/dev.db`，皆 gitignore）。

## 點睇返呢啲素材
1. `npm run dev` → http://localhost:3000/library
2. 左側客戶資料夾揀「**全部**」
3. **生成圖片** tab → 下面「圖片紀錄」見到 3 張生成圖
4. **風格組件** tab → 「圖庫」見到 生成圖（紫色「生成」標籤）+ 上傳分析圖；點任何一張睇詳情

---

## 生成圖測試案例（可重用輸入）
每個案例可以喺「生成圖片」分頁照填（主體 + 注意事項 + 配色），或直接打 `POST /api/library/generate`。

### 案例 1 — 冬季保濕面膜
- **主體 (subject)**：`a winter moisturizing face mask jar on a marble table, soft studio light`
- **配色 palette**：主色 `#4F3C37`、強調色 `#E8C8A0`
- **注意事項 notes**：`warm cozy mood, no text on image`
- **seed**：`532702598`
- **圖檔**：`public/uploads/75eaacdd-a9cd-48bb-b0d0-28c0e730cb1b.jpg`
- **生成文案**：
  > 冬日保濕面膜罐靜享時刻
  > 在柔和工作室光下，溫暖極簡的保濕護理，讓肌膚安心回到水潤狀態
  > 立即體驗
- **畫面**：大理石圓盤上嘅面膜罐，旁邊松果，暖奶油色調 ✅

### 案例 2 — 保濕精華
- **主體 (subject)**：`premium hydrating serum bottle with botanical leaves, bright clean studio`
- **配色 palette**：主色 `#2E7D5B`、中性色 `#F4E9D8`
- **注意事項 notes**：`fresh natural, soft shadows, no text`
- **seed**：`343545119`
- **圖檔**：`public/uploads/7120b79a-9b49-45e4-bbbe-5c06e2acc8ac.jpg`
- **生成文案**：
  > 純淨保濕精華瓶｜植萃葉片靜美呈現
  > 在明亮乾淨的棚拍光線下，清新自然、柔和陰影，展現 premium hydrating serum 的輕盈滋潤。
  > 立即體驗
- **畫面**：粉色精華瓶 + 綠色植萃葉片，明亮乾淨棚拍 ✅

### 案例 3 — 香氛蠟燭
- **主體 (subject)**：`a scented candle on a wooden tray, warm evening light`
- **配色 palette**：（無，用預設）
- **注意事項 notes**：`cozy minimalist, no text`
- **seed**：`223416720`
- **圖檔**：`public/uploads/0fcdef99-88cc-4cb4-9472-e3e857f587da.jpg`
- **生成文案**：
  > 暮色微光，木盤香氛
  > 在暖黃晚光裡，極簡迷人香氛蠟燭，打造安靜放鬆的 cozy 氛圍
  > 點燃此刻
- **畫面**：木盤香氛蠟燭放喺床品上，暖黃晚光 cozy 感 ✅

---

## 圖片分析（vision）測試
對已上傳圖跑 `POST /api/components/analyze` 正常：
- 圖：`/uploads/eed52966-…webp` → 構圖「側邊近距產品細節切片」、主色 `#4A352F`、`extraColors: []`
- 另一張上傳分析圖：`/uploads/71b86056-…jpg`

---

## 已知行為（測試時要留意）
- **AI 出圖嘅 label 文字係亂碼**（圖像模型通病），故 notes 加 `no text` 只能減少、唔保證無字。
- **同一 seed + 同一 prompt** 會出相近圖（可重現）；唔填 seed 則每次隨機。
- **Pollinations 對此網絡 IP 回 402**，故 `POLLINATIONS_TOKEN` 留空、直接行 HF。HF 免費額度用得多會 429/限流。
- 生成需時約 **5–15 秒**（HF FLUX.1-schnell）。

## 快速重跑（curl 範例）
```bash
curl -s -X POST http://localhost:3000/api/library/generate \
  -H "Content-Type: application/json" \
  -d '{"subject":"<主體>","palette":[{"hex":"#2E7D5B","role":"primary","use":true}],"notes":"<注意事項>"}'
# 回 {imageUrl, copyText, seed, prompt}
```
