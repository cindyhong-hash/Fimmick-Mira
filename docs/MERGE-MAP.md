# MERGE-MAP — 素材庫 ⇄ 廣告客戶/活動圖 整合對照

> 用途：記低「同事（cindyhong）嘅 廣告客戶創建 + 活動圖製作」係點 merge 入本 repo（Verna 素材庫主線）。
> 將來同事升級，照住下面「點追同事新版」一節做就追到，唔使逐個檔靠記憶。
>
> 首次 merge：**2026-06-23**（本輪只搬功能，UI 重構 / OAuth / 登入權限排 backlog）

---

## 0. 同事來源 repo（重要）

- **同事 repo URL**：`https://github.com/fimmick/claude-code-examples`（作者 cindyhong-hash）
- **本輪 merge 基準 commit**：`70171bb`（2026-06-18 12:32，commit 訊息：「1.圖片三種選項…2.新增活動修改…3.圖面生成的 prompt 修改」）
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
