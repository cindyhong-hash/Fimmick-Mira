# 分享去 HK 前 — 最終檢查清單

> 用途：交俾 HK dev team 之前，逐項 test 一次確認冇壞。剔完先行「分享步驟」。
> 最後更新：2026-07-13（本輪積木邏輯大改後）

---

## A. 積木邏輯（本輪重點改動，最高風險 — 必 test）

### A1. 引用模型一致性
- [ ] 開任何「產品成圖 / 參考圖」detail → 顯示嘅構圖/配色，同「選擇積木 picker」入面同一個 block **一模一樣**（名、色、內容）
- [ ] 喺 picker「調整」一個 block 內容 → detail 同 picker 兩邊即刻**一齊更新**（唔會一個新一個舊）

### A2. 擁有權規則（調整積木）
- [ ] 調整一張圖嘅積木，嗰個 block **只得呢張圖用** → **就地改**（改自己）
- [ ] 調整一張圖嘅積木，嗰個 block **有其他圖 / 參考圖都用緊** → **fork 新 block**，原本嗰個同其他圖**唔受影響**
- [ ] 生成台揀咗現成積木、臨時改色/構圖再生成 → 自動起**新 block**（唔會改到原本）

### A3. Picker 顯示
- [ ] 產品圖 picker 每張 card 都顯示返**產品/參考圖**（唔淨係色塊）
- [ ] 活動生成嘅通用 preset（無圖）**唔會**出現喺產品圖 picker
- [ ] 活動「風格素材選擇器」仍然揀到嘢（preset 冇被誤刪）

### A4. 分析 & 位置
- [ ] 生成一張冇揀積木嘅產品圖 → detail 顯示「尚未分析風格」→ 撳「分析此圖加入素材」→ 之後 detail **顯示返構圖/配色**（唔再「尚未分析」），picker 亦見到
- [ ] 「調整積木」後，張圖**唔會跳去 gallery 最新位置**（保持原位）
- [ ] 生成台儲存後 → 組裝台**自動清空**；header「清空重來」掣可手動清

### A5. 活動圖參考
- [ ] 「從素材庫揀」風格參考圖 → 「AI 反推提示詞」掣變「帶入參考圖提示詞」→ 撳一下**即時帶入**該圖 AI Prompt（無需再上傳/分析）
- [ ] 上傳新參考圖 → 仍可 analyze API 反推

---

## B. AI 引擎全覆蓋（用 docs 測試 prompt 逐個行一次）

- [ ] **FLUX.2 edit**（產品合成主力）— 中文字/標籤清晰
- [ ] **nano-banana**（產品合成）— 場景自然
- [ ] **Seedream 4.5**（產品合成）— 多圖文字
- [ ] **FLUX.1**（文字主體 / 背景生成）
- [ ] **FLUX.2 pro**（素材生成 · 人像）
- [ ] **Recraft V3**（素材生成 · 插畫）
- [ ] **Nano Banana 風格遷移**（有參考圖）
- [ ] 每張成圖 tag 顯示嘅引擎名**對得上**（冇靜靜 fallback）

---

## C. 核心流程 smoke test

- [ ] `/library` 開得到，Sidebar 顯示品牌清單
- [ ] 生成圖片：出圖 + 文案（繁中）正常
- [ ] 產品合成：上傳產品圖 → 出乾淨成圖 → 存入圖庫
- [ ] 圖庫 filter（全部/參考圖/背景/人像/插畫/產品成圖）數量正確
- [ ] 圖片可刪除（二次確認）、可移到其他客戶 / 設公用
- [ ] 廣告活動圖：新增活動 → 生成 → 加入素材庫（變參考圖）

---

## D. 技術把關（打包前）

- [ ] `npx tsc --noEmit` 零錯
- [ ] `npm run dev` 起得到、冇 console / server error
- [ ] `git status` 乾淨（所有嘢已 commit + push origin）
- [ ] **無機密檔案入 git**：`.env.local` / `prisma/dev.db` / `public/uploads/` 都喺 `.gitignore`
- [ ] `.env.example` 齊 3 個 key 位（OPENROUTER / FAL / HF），但**唔含真 key**
- [ ] `docs/HANDOVER-HK.md` 內容 review 過（環境/起步/供應商/已知問題）

---

## E. 分享步驟（剔完 A–D 先行）

1. [ ] `bash scripts/sync-share.sh "本輪更新：積木邏輯一致化 + picker 顯示圖 + 活動參考圖帶 prompt"`
   - 自動由 main 重建 → 剝走內部文檔（docs/ 除 GUIDE、CLAUDE.md、AGENTS.md、.claude/）→ force-push 去 `share`
2. [ ] `bash scripts/pack-materials.sh` → 出 `dist/*.zip`（dev.db + uploads ~274MB，**唔含真 key**）
3. [ ] 把 zip 經雲端 / USB 傳俾 HK dev
4. [ ] 確認 HK 收到後跟 `docs/GUIDE-新手使用.md` / `docs/HANDOVER-HK.md` 起到步（自備 3 個 API key）
5. [ ] push 完 sync 個人 Git 備份

> ⚠️ 交付**唔俾真 API key**（用戶決定）：HK team 自行申請 OpenRouter / fal.ai / HF。
