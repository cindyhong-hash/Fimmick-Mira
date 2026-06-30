# AI API / 地區設定筆記（Taiwan vs Hong Kong）

> 用途：講清楚 AI API 嘅地區限制、API key 應該點處理、本機（香港）邊啲嘢 test 唔到。
> 由來：同事（Hermes）發現幾條 AI API 喺**香港地區 geo-block**，已把專案部署去**美國 Azure 伺服器**；台灣本身用得正常。
> 最後更新：2026-06-26

---

## 1. 核心原則（重要）

- **呢部機永遠用呢部機嘅 `.env.local` 設定**（即台灣設定）。Next.js 本來就讀本機 `.env.local`，code 入面**冇任何「TW/HK 切換」覆蓋**。
- **預設＝台灣設定，照用、唔好改 API key / `.env` / endpoint。** 台灣（Hermes）跑得正常，呢套就係 baseline。
- **同事（HK）嘅「香港 / Azure 修復」唔影響 current work**：佢 code 改動只有顯示文字（已 merge）；真正修復係 infra（搬美國伺服器），唔喺 git。**「香港設定」只關將來 `marketing-tool demo` 部署，同本機開發完全分開。**
- 圖片生成 code 本身正確（活動圖走 OpenRouter `google/gemini-3-pro-image-preview`），**唔需要改邏輯**。

---

## 2. 現時 AI API 用途

| 用途 | 服務 / 模型 | env key |
|---|---|---|
| 文案生成 / 語氣 | Anthropic Claude | `ANTHROPIC_API_KEY` |
| 文字 / vision 分析、prompt 優化 | OpenRouter（text/vision model） | `OPENROUTER_API_KEY` |
| **活動圖 圖片生成** | OpenRouter `google/gemini-3-pro-image-preview`（fallback：fal.ai） | `OPENROUTER_API_KEY`（+ `FAL_KEY`） |
| 素材庫 圖片生成 | fal.ai FLUX（主）／OpenRouter／HF（備） | `FAL_KEY` / `OPENROUTER_API_KEY` / `HF_TOKEN` |

> ⚠️ 以上 key 維持**台灣設定**值；唔好為咗本機測試而改。

---

## 3. 地區行為

| 環境 | 文字類（文案 / prompt 優化） | 圖片生成 |
|---|---|---|
| 台灣（Hermes / 部署） | ✅ 正常 | ✅ 正常 |
| **香港本機（localhost）** | ✅ 多數正常 | ❌ **geo-block → 生成失敗**（唔係 bug） |
| 香港 + VPN（美國節點） | ✅ | ✅ |
| 已部署美國 Azure 版本 | ✅ | ✅ |

UI 上嘅「生成失敗」訊息已更新，講明係 API 區域限制／建議 VPN 或部署版（唔再誤導成「OpenAI 額度不足」）。

---

## 4. 本機（香港）測試指引

- **可以本機 test**：UI／流程／文案生成／prompt 優化／表單／導覽／彈窗等。
- **本機 test 唔到（跳過）**：實際 AI 出圖（活動圖 + 素材生成）。要驗證出圖 → 用 **VPN（美國）** 或 **部署版**。
- 見到「生成失敗（API 區域限制）」＝預期行為，**唔使當 bug 報**。

---

## 5. 推去 marketing-tool demo 時

- demo（老闆 repo `verna-fimmickTW/market-tool-demo`）部署環境若喺香港 / 需 HK 相容，先切去「香港設定」。
- 具體「香港設定」內容（endpoint / proxy / key）由 Hermes 提供 —— **TBD，要同 Hermes 確認**。
- 平時 sync demo 行 `bash scripts/sync-share.sh`（會剝走內部文檔）。

---

## 6. 檢查清單（API / 地區）

- [ ] `.env.local` 維持台灣設定（`ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` / `FAL_KEY` 等照舊，無改動）
- [ ] 本機（HK）只 test UI／流程／文案，**跳過實際出圖**
- [ ] 要驗證出圖：開 VPN（US）或用部署版，試 活動圖 + 素材生成各一次
- [ ] 「生成失敗（API 區域限制）」訊息正常顯示（非「OpenAI 額度不足」）
- [ ] 文案 / prompt 優化 本機 HK 試到 work
- [ ] push demo 前：同 Hermes 確認是否要切「香港設定」（endpoint / key）
- [ ] 無為咗本機測試而改動任何 API key / endpoint
