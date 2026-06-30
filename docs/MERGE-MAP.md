# MERGE-MAP — 素材庫 ⇄ 廣告客戶/活動圖 整合對照

> 用途：記低「同事（cindyhong）嘅 廣告客戶創建 + 活動圖製作」係點 merge 入本 repo（Verna 素材庫主線）。
> 將來同事升級，照住下面「點追同事新版」一節做就追到，唔使逐個檔靠記憶。
>
> 首次 merge：**2026-06-23**（本輪只搬功能，UI 重構 / OAuth / 登入權限排 backlog）

---

## 0. 同事來源 repo（重要）

- **同事 repo URL**：`https://github.com/fimmick/claude-code-examples`（作者 cindyhong-hash）
- **基準 commit**：`1e3f9e6`（2026-06-24 同步；前一基準 `70171bb` 2026-06-18）
  - `70171bb..1e3f9e6` 同事改動：`.env.example` 新增、`.gitignore`、`package-lock.json`、`ActivityForm.tsx`（loading 文字 MiniMax→Gemini）
  - 背景：同事（Hermes）發現幾條 AI API **香港地區 geo-block**，已遷專案去**美國 Azure 伺服器**；prompt 優化已可用，圖片生成仍偏慢。
  - 我哋同步：ActivityForm 文字 fix + 修正活動詳情頁誤導錯誤訊息（「OpenAI 額度不足」→ 講明 API 區域限制 / OpenRouter Gemini / 建議 VPN 或部署版）。圖片生成 code 本身已行 OpenRouter `google/gemini-3-pro-image-preview`（`/api/generate`），無需改邏輯。
- 已確認：本機 `claude-code-examples-main/` 內容 == 此 repo `main@70171bb`（用 `src/lib/fal.ts` 逐字核對一致）。

> ⚠️ **規矩**：呢個 repo 同 `CLAUDE.md` 嗰條「絕對唔好 push 去 `fimmick/claude-code-examples`」係同一個。
> 我哋對佢**只做唯讀 `git fetch`／diff，永遠唔 push**。
> （CLAUDE.md 舊註寫佢係「chesterchiu 原始 repo」已過時 — 實際係同事 cindyhong 嘅活躍 repo。）

### 點追同事新版（下次 merge 流程）
```bash
# 唯讀 fetch（443 端點，唔加 named remote、唔 push）
git fetch "ssh://git@ssh.github.com:443/fimmick/claude-code-examples.git" main
# 睇同事由上次基準 70171bb 之後改咗咩
git log --oneline 70171bb..FETCH_HEAD
git diff --stat 70171bb FETCH_HEAD -- src/
# 對住下面「檔案 ownership」表決定邊啲要再 graft
```
下次 merge 完，記得把本檔「基準 commit」更新做新嗰個。

---

## 1. 檔案 ownership（邊邊負責 = 邊邊升級時要留意）

### 🟦 WIP / 素材庫獨有（Verna 線）— 同事 repo 冇，唔會衝突
```
src/types/presets.ts
src/lib/generate.ts
src/components/library/SlotPickerModal.tsx
src/components/library/GenerateAssetModal.tsx
src/components/library/ImageDetailModal.tsx
src/components/library/QuickAddModal.tsx
src/components/library/ColorCards.tsx
src/app/api/library/**            (gallery / describe / save-image / images/[id] / polish / generate / template-paste)
src/app/api/components/analyze/route.ts
src/app/api/components/[id]/route.ts
```

### 🟩 COLLEAGUE 負責（cindyhong 線）— 升級時主要睇呢批
本輪直接採用同事版（`70171bb`）：
```
# 同事獨有（WIP 本來冇，今輪新搬入）
src/lib/fal.ts                         ← 同事 (FAL_KEY 圖片生成)
src/lib/composite.ts                   ← 同事 (sharp 疊圖)
src/lib/openai.ts                      ← 同事 (OPENAI_API_KEY)
src/lib/openrouter.ts                  ← 同事
src/app/api/inpaint/route.ts           ← 同事 (框選改善)
src/app/api/layouts/[layoutId]/route.ts ← 同事
src/app/api/ai/analyze-image/route.ts  ← 同事
src/app/api/ai/optimize-prompt/route.ts ← 同事
src/components/activities/ComponentSelector.tsx ← 同事

# 共有但採用同事版（同事線更成熟）
src/lib/prompts.ts                     ← 同事 (superset，含 buildImagePrompt + buildCopyPrompt)
src/app/api/generate/route.ts          ← 同事 (活動生圖，399 行)
src/app/api/activities/route.ts        ← 同事
src/app/api/activities/[activityId]/route.ts ← 同事
src/app/api/assets/route.ts            ← 同事 (加 savedToLibrary 策展 filter)
src/types/index.ts                     ← 同事 (superset：TextZone/textZone/豐富 compositionPrompt)
src/components/activities/ActivityForm.tsx     ← 同事
src/components/activities/LayoutPicker.tsx     ← 同事
src/components/activities/MaskCanvas.tsx       ← 同事
src/components/activities/EditorCanvas.tsx     ← 同事
src/app/clients/[clientId]/page.tsx            ← 同事
src/app/clients/[clientId]/activities/new/page.tsx       ← 同事
src/app/clients/[clientId]/activities/[activityId]/page.tsx   ← 同事
src/app/clients/[clientId]/activities/[activityId]/edit/page.tsx   ← 同事
src/app/clients/[clientId]/activities/[activityId]/editor/page.tsx ← 同事
```

### 🟧 MERGED（兩邊都改，union）— 升級時最易出事，要逐手 graft
```
prisma/schema.prisma                   union：保 WIP(LibraryImage/taboos/paletteColors) + 加同事(commonText/Activity 新欄位/textBurnedIn/savedToLibrary)
src/app/api/clients/route.ts           union：POST 同時寫 taboos + commonText
src/app/api/clients/[clientId]/route.ts union：PATCH 保 taboos + 加 paletteColors 防呆（commonText 經 {...body} spread）
src/components/clients/BrandSettingsForm.tsx  union：同事底(logoUrl/commonText「常用字體」/logo 上載) + graft WIP(taboos「禁忌事項」)
```
> union 檔嘅 code 入面，同事嗰邊嘅欄位／區塊已標 `// [COLLEAGUE]`，WIP 嗰邊標 `// [WIP/素材庫]`。

### ⬜ 共有但保 WIP 版（同事版更舊 / 會整爛 library）
```
src/types/library.ts                   保 WIP (207 行 superset，含同事所有 export)
src/app/library/page.tsx               保 WIP (素材庫主頁)
src/components/library/ComponentGrid.tsx   保 WIP
src/components/library/PromptComposer.tsx  保 WIP (903 行)
src/components/library/AssetGrid.tsx       保 WIP
src/app/api/components/route.ts        保 WIP (72 行 > 同事 17 行)
src/components/layout/Sidebar.tsx      保 WIP (有 /library 隱藏全域側欄 guard；UI 統一留待下輪)
```

---

## 2. Prisma schema 聯集詳情

| Model | WIP 保留 | 同事新增（合併入） |
|---|---|---|
| Client | `taboos`、`paletteColors` | `commonText` |
| Activity | `productImageUrl`（改 default `""`） | `titleText`、`subtitleText`、`imagePrompt`、`productImageUrls`、`selectedComponentIds`、`imageRatio`、`imageModel` |
| GeneratedLayout | 原樣 | `textBurnedIn`、`savedToLibrary` |
| StyleComponent | （兩邊一致） | — |
| LibraryImage | ✅ 完整保留（同事已刪，我哋唔跟） | — |

- Migration：`prisma/migrations/20260623024608_merge_colleague_fields/`（純加欄位 + RedefineTables INSERT…SELECT，零資料損失）。
- 驗證：merge 後行數 Client 2 / StyleComponent 65 / LibraryImage 196，同 merge 前快照 `prisma/dev.db.pre-merge-bak` 完全一致。

---

## 3. 環境變數

WIP 已有：`DATABASE_URL`、`ANTHROPIC_API_KEY`、`OPENROUTER_API_KEY`、`FAL_KEY`（+ 素材庫嘅 HF_TOKEN / Pollinations 等）。
新增需要：`OPENAI_API_KEY`（只 `src/lib/openai.ts` 用；活動 AI route 實際行 OpenRouter + Anthropic，已有）。
→ 如未填，`lib/openai.ts` 相關路徑先唔 work，其餘正常。

---

## 4. 備份 / 還原點（本輪 merge 前）

- Git tag：`pre-merge-2026-06-23`（已 push origin）
- Git branch：`backup/pre-merge`（已 push origin）
- DB 快照：`prisma/dev.db.pre-merge-bak`
- 還原：`git reset --hard pre-merge-2026-06-23` + `cp prisma/dev.db.pre-merge-bak prisma/dev.db`

---

## 5. Backlog（本輪冇做，下輪）

1. **UI 重構**（依 `wireframes/marketing-tool-wireframes-v2.html`）：統一側邊欄、switch-tab（廣告活動圖／風格組件）、品牌設定內含「連動帳號」tab、新增產品／素材融合表單、圖庫排序（活動成品→參考圖）。
2. **連動帳號 OAuth**：Meta / Google Ads / IG（wireframe ① ⑨ 有，屬 net-new）。
3. **NextAuth 登入 + 內部/客戶權限**（wireframe ① ③）。

---

## 7. 活動圖 ↔ 素材庫 整合（我哋自訂 · merge 時必須保留／重套）

> 同事原版：活動圖同素材庫係兩套（GeneratedLayout vs LibraryImage/StyleComponent），「加入素材庫」只 set `savedToLibrary` flag，唔會真係入到 Verna 嘅素材庫 gallery。
> 我哋加咗以下**跨邊連結邏輯**，令活動成品真正入素材庫做「參考圖」+ 自動帶風格組件。
> **⚠️ 下次由同事 repo merge 嗰陣，如果佢覆蓋咗呢啲檔，要把以下邏輯重新套返。**

| 檔案 | 我哋改咗咩（自訂） | 屬誰原檔 |
|---|---|---|
| `src/app/api/layouts/[layoutId]/route.ts` | PATCH `savedToLibrary=true` → 建一筆 **rich LibraryImage**：`prompt`=活動 imagePrompt、`paramsJson={genType:"reference", fromLayoutId, productImageUrls:來源圖, slots:{layout,color}}`（slots 由 **AI 據實分析成品圖** `/api/components/analyze` 得出）。`false` → 刪 LibraryImage(by imageUrl) + 清 `import-<layoutId>` 殘留。 | 同事（COLLEAGUE）—— 佢原版只 `data:{savedToLibrary}` |
| `src/app/api/library/images/[id]/route.ts` | DELETE **反向同步**：若 `paramsJson.fromLayoutId` 存在 → 把對應 layout `savedToLibrary=false`（素材庫刪圖 → 活動頁標返未加入）。 | WIP（Verna） |
| `src/components/library/ComponentGrid.tsx` | `generatedKind()`：`genType==="reference"` → `"uploaded"`（歸類做參考圖）；`matchesGalleryFilter()`：參考圖 filter 認 generated-reference。 | WIP（Verna） |
| `src/app/clients/[clientId]/activities/[activityId]/page.tsx` | 活動標題 inline 改名（PATCH `theme`）；status tag 按狀態上色（補 FAILED）。 | 同事原檔 |
| `src/app/api/library/gallery/route.ts`、`api/components/route.ts` | 加 `?unassigned=1`（clientId=null）。 | WIP |

**設計取捨**：
- detail 一次過有：**Prompt + 來源產品圖 + 真實構圖/配色 + 帶入生成**（同活動成圖 detail 一致），title 可改（generated）。
- 用「分析成品圖」而唔係 gen-time input 參數（input 係品牌色/通用構圖，唔代表成品）。
- 生成 prompt 放 `LibraryImage.prompt`（detail 顯示）；唔塞落每個組件。
- 語氣（COPY_TONE）唔建（已全面移除）。
- 去重：以 `imageUrl` / `fromLayoutId` 為鍵，可安全 toggle on/off + 反向同步。

---

## 8. 未用 / Legacy code 追蹤（merge 時考慮清理）

> 用途：記低「而家無人 import、但暫時留住做後備」嘅檔。每次由同事 repo merge 之前/之後，
> 翻睇呢個清單；若連續幾個 version 都仍然無人用，就向用戶建議刪除。

| 檔案 | 狀態 | 來源 | 備註 |
|---|---|---|---|
| `src/lib/openai.ts` | **無人 import（dead）** | 同事原檔（`70171bb` 已有，一字不差） | 同事最初嘅 OpenAI(DALL·E/gpt-image) 出圖引擎；後來轉咗 OpenRouter Gemini 後被取代。用戶決定**留住做後備**（2026-06-26）。**若往後幾個 version 都仍然 0 import → 建議刪 + 拎走 `OPENAI_API_KEY`。** |

**檢查方法**：`grep -rl "@/lib/openai" src/` —— 若仍然空 = 冇人用。
（順帶：UI 重構後 `ComponentGrid.tsx` 內有少量舊 code，如 `ComponentCard` / `FILTER_TABS`，亦屬可清理，但低優先。）
