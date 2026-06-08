# Feature Log — marketing-tool

> 本檔為 in-repo 的完整功能/變更紀錄（換電腦後 Claude 記憶不會跟住走，故記喺呢度）。

## 素材庫重構（接通 AI 生成 + 統一圖庫）

### 接通圖片 + 文案生成（in-app，可抽換）
- `src/lib/generate.ts`：`generateImage`（Pollinations 主力 → HF FLUX.1-schnell 備援）、`generateCopy`（OpenRouter）、`compileImagePrompt`、provider 開關 `GEN_PROVIDER=inapp|n8n`（n8n stub）
- `POST /api/library/generate`：編 prompt → 出圖（存 `public/uploads`）+ 出文案 → 建 `LibraryImage`
- PromptComposer「生成新圖」掣接通；「其他注意事項」欄；色盤逐色使用/不使用開關
- ⚠️ Pollinations 免費匿名 + 帶 token 對本機 IP 都回 **402**；實際靠 **HF**（端點 `router.huggingface.co/hf-inference/models/<model>`，舊 `api-inference.huggingface.co` 已死）

### 圖片分析併入風格組件（移除獨立分頁）
- 素材庫 3 tab → **2 tab**（生成圖片 / 風格組件）；刪 `ImageAnalyzer.tsx`
- 風格組件預設「品牌圖庫」：`GET /api/library/gallery`（上傳分析圖按 previewUrl group + 生成圖 union）
- `ImageDetailModal.tsx`：點圖庫圖 / 組件卡片 → popup（圖 + 構圖/配色/語氣/背景 + 帶入生成）

### 5 色色盤 + coolors 色卡
- COLOR_SCHEME `data.colors:[{hex,role,label}]` + legacy `primaryColor/secondaryColor` 同步
- 5 role：主色 primary / 輔色 secondary / 強調色 accent / 中性色 neutral / 點綴色 highlight（`PALETTE_ROLES`）
- `getColors()` fallback（舊 2 色照顯示）；`ColorCards.tsx`（coolors 風大色塊 + hex 點擊複製）
- analyze 加 `colorScheme.extraColors`（additive，0–3 色）

### 背景類別 BACKGROUND
- 第 4 component 類別（teal）；`PromptSlots` 4 slot；風格組件「背景」子分頁；composer 第 4 積木

### 行業 default 範本（presets）
- `src/types/presets.ts`：6 行業（護膚品/女性用品/生活電子/衣服/食品飲料/家居生活），各含 構圖+5色配色+語氣+背景
- QuickAddModal 頂部「套用行業範本」一鍵填入

### 資料模型（全 additive，dev.db 資料保留）
- `LibraryImage`（生成圖獨立存，不動 `GeneratedLayout`）
- `Client.paletteColors`（JSON）
- migration `library_redesign`（SQLite RedefineTables，無資料損失）

### Model 更新
- OpenRouter `gemini-2.0-flash-001` / `gemini-2.0-flash-exp:free` 已 404 → 改 `openai/gpt-5.4-nano`（vision+text）
- 免費 `:free` text model 常 429，不採用

## 第二輪：互動 + 編輯 + 合成（8 項，全部已驗證）
1. **積木可點揀**：生成台 slot 點擊 → `SlotPickerModal` 揀已有素材帶入
2. **圖片紀錄 popup**：`AssetGrid` 可點 → 共用 `ImageDetailModal`（modal 提升到 `page.tsx`）
3. **帶入改 toast**：`handleInject` 不再跳分頁，改右下角自動消失 toast
4. **繁體中文台灣**：analyze name/description/toneLabels + `generateCopy` 強制繁中台灣；英文 `aiPromptText` 保留
5. **重新生成/調整**：生成圖 popup「重新生成」→ 載入 `paramsJson` 到生成台（prefill）
6. **編輯素材**：每素材「編輯」→ QuickAddModal 編輯模式（預填 + `PATCH /api/components/[id]` 覆蓋）；背景可純文字無圖 + 「AI 偵測描述」
7. **生成台上傳產品圖**：「AI 讀圖填主體」+「直接合成」（去背 PNG 用 `sharp` 疊背景；非透明偵測 alpha → 提示去背 remove.bg/photoroom）
8. **AI 存素材改 upsert**：`POST /api/components` 同 previewUrl+type 已存在 → 更新 + 置頂，唔再重複
- 已知限制：免費 text-to-image 唔做 img2img，「直接使用產品圖」靠 sharp 合成（需透明去背 PNG）

## 更早（已 commit，2026-06-03 批次）
| commit | 功能 |
|--------|------|
| `a726d82` | fix: 圖片分析「加入剩餘素材」按鈕無效 |
| `7934ddf` | feat: 素材刪除 + 圖片風格雙向導航 |
| `3a2b881` | feat: 三類型同時新增 + 圖片分析頁 |
| `cdef47b` | feat: 圖片分析改用 OpenRouter |
| `f346da5` | feat: 素材庫快速加入素材功能（初版） |

## API endpoints（累計）
| Method | Path | 功能 |
|--------|------|------|
| GET | `/api/clients` / `/api/assets` / `/api/activities` | 客戶 / 活動圖 / 活動 |
| GET | `/api/components` | 組件列表，支援 ?clientId= ?previewUrl= |
| POST | `/api/components` | 建立／upsert（同 previewUrl+type 更新置頂） |
| PATCH | `/api/components/[id]` | 編輯更新組件 |
| DELETE | `/api/components/[id]` | 刪除組件 |
| POST | `/api/components/analyze` | OpenRouter 圖片分析（繁中、含 extraColors） |
| GET | `/api/library/gallery` | 品牌圖庫 union（上傳 + 生成） |
| POST | `/api/library/generate` | 生成圖片（HF/Pollinations）+ 文案 + 合成模式 |
| POST | `/api/library/describe` | vision 描述（kind=subject/background → 繁中 + 英文） |
| POST | `/api/upload` | 上傳圖片到 public/uploads/ |

## 關鍵檔案
- `src/app/library/page.tsx` — 素材庫頁（2 tabs，統一管理 popup/toast/編輯/重生成）
- `src/components/library/` — PromptComposer / ComponentGrid / AssetGrid / QuickAddModal / ImageDetailModal / SlotPickerModal / ColorCards
- `src/lib/generate.ts` — 生成抽象層
- `src/types/library.ts` — 型別 + CATEGORY_META + PALETTE_ROLES + getColors()
- `src/types/presets.ts` — 行業範本
- 測試素材：`.claude/TESTING_MATERIALS_BY_INDUSTRY.md`、`.claude/TEST_MATERIALS.md`（圖片在 `public/uploads/`，gitignore，需從備份帶過去）
