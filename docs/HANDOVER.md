# 接手就從這裡開始（MIRA / marketing-tool）

> 給新 session 的 agent。讀完這一份就能直接開工，不用重新盤點。
> 最後更新：2026-09-21

---

## 0. 三十秒進入狀況

```bash
cd /Users/chesterchiu/Desktop/marketing-tool/.worktrees/release-kit
git log --oneline -5
git log --oneline mine/main..HEAD    # 未推的
```

**目前主要工作區**：`.worktrees/release-kit`（分支 `release/visual-asset-kit`）
**未推**：0 個（本地與 `mine/main` 同步）
**正式站**：`mine/main` = `21a5f7c`（2026-09-21 推上 24 個 commit，全是賣點圖示這條線）

⚠️ `mine` 這個 remote 才是正式站（`cindyhong-hash/Fimmick-Mira`）。
`origin` 是別人的舊 repo，**不要推到 origin**。

---

## 1. 這個專案是什麼

MIRA（原名 Content／行銷圖文工具）。Next.js 16 + Prisma 7.8 + Turso(libSQL) + Vercel Blob。
台灣美妝／除毛品牌的社群圖文生成工具，使用者是 Cindy（fimmick，行銷，非工程背景）。

核心流程：品牌設定 → 建立圖文（單／多圖）→ 素材庫 → 產品套圖（AI 建立商品套圖）→ 自由畫布排版。

「AI 幫我排版」（產品素材包自動排成可編輯設計稿）程式碼已在 `main`，但正式站關閉中，
用 `?adlayout=1` 可測。交接給 Codex 的開工須知見
[`docs/CODEX-AI-LAYOUT-KICKOFF.md`](CODEX-AI-LAYOUT-KICKOFF.md)，功能設計見
[`docs/AI-LAYOUT-HANDOFF.md`](AI-LAYOUT-HANDOFF.md)。

---

## 2. 環境

| | |
|---|---|
| 正式站（公司 Pro） | https://fimmick-mira.vercel.app |
| 正式站（個人，目前測試用） | https://taiwan-image-process-x5hn.vercel.app |
| 資料庫 | Turso `marketing-tool`，**兩站共用同一個** |
| 圖片 | Vercel Blob store `v16uryj9gfmy6re4`，在**個人**帳號，**兩站共用** |
| 本機預覽 | `preview_start` name=`mt-release-kit`，port 3017，密碼 `localdev` |

### 🔴 部署現況（重要）

使用者與同事商定：**先推個人站 x5hn 測試，公司站之後再說。**
所以「推了 main 但 fimmick-mira 沒動」是**預期狀態，不要去修**。

公司站觸發失效的原因已查明：**團隊角色權限**，不是程式／額度／方案。
（Redeploy 顯示鎖頭、看不到 team usage、但團隊其他專案正常部署。）
同事改成 Developer 後成功一次，之後又失效，待釐清。

⚠️ **GitHub deployments API 收不到 fimmick-mira 的回報**，用 `gh api` 輪詢對公司專案是盲的。
不要把「GitHub 沒紀錄」誤讀成「沒部署」。

---

## 3. 紅線

- **付費生成前必須取得使用者對「確切張數」的核准。**「AI 建立商品套圖」每張都是真的扣款，本機也是（接同一組 API）。
- **個人 Vercel 帳號的 Blob store 不能刪** — 所有圖片都在那，資料庫存的是完整網址。
- 部署一律由使用者明確指示才做。推 main = 上正式站。
- 正式資料庫的操作由使用者執行。
- 不要 `npm install`（worktree 的 node_modules 是共用 symlink）。
- 不要把 `prisma/*.db` commit 進去（曾經誤把 843KB 正式資料快照推進**公開** repo 前一刻攔下）。

---

## 4. 本機開發怎麼起

```bash
cd /Users/chesterchiu/Desktop/marketing-tool/.worktrees/release-kit
grep '^DATABASE_URL' .env.local     # 必須是 file:./prisma/dev-release.db
```

dev server 用 `preview_start`（**不要用 Bash 跑 next dev**）：name `mt-release-kit`，port 3017。
本機資料是正式站快照（`prisma/prod-snapshot.sql` 匯入）。`.env.local` 有設 `SITE_PASSWORD=localdev`
——這是刻意的：不設的話本機付費端點完全無認證（見第 7 節）。

驗收四件套：

```bash
npx prisma generate
npx tsc --noEmit                    # 0
npx eslint <改動檔>                 # 0 error
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts" "src/components/**/*.test.ts"
npx next build                      # EXIT 0
```

**基準：396 tests / 395 pass。唯一允許的失敗是 `planner/content-brief` 的 `subtitleText: null`（改動前就存在）。出現第二個失敗就是改壞了。**

eslint 全 repo 有既有 error（`MagicLayersEditor.tsx` 單檔 29 個），那些刻意不改，
但**不要新增**——改完比對數字有沒有變多。

---

## 5. 這幾天做完的事（都已上線）

| 主題 | 內容 |
|---|---|
| 品牌改名 | Content → **MIRA**，側邊欄 logo、favicon、分頁標題、密碼閘標題 |
| 搬公司 Vercel | 建立 `fimmick-mira`，6 個必填環境變數 |
| 版面 | 固定側邊欄／頂欄、品牌切換淺紫底、套組預覽固定列高 |
| 放置標誌 | 橫圖被裁切、底圖快取時畫布比例讀不到導致拖曳座標錯位 |
| 手機版 | 響應式修正（桌機 A/B 實測完全不變）＋導覽改抽屉，拿掉常駐 64px 圖示欄 |
| 素材命名 | assetSubtype 改中文顯示、英文降為輔助，統一 7 個顯示位置 |
| 逐張重生 | 每張素材可單獨重新生成並填「希望怎麼改」 |
| 畫布 | 素材進畫布不再被拉變形；圖層可單獨去背（按鈕，因為要付費） |
| 清單 UI | 賣點 Icon 自成一區、風格用縮圖卡片選、每個素材類型旁有示意圖 |
| **生成品質** | 見下節 |

### 生成品質這條線（使用者最在意）

依序修過四個問題，每一個的根因都不一樣：

1. **背景出現不相關商品與英文字** → 根因是我們**主動把商品名詞送進去**
   （`Product positioning: 身體除毛乳液`），模型照著畫，還把欄位標籤
   `Supplied use cases;` 當成畫面文字描上去。解法：背景角色只收 `Setting:`，
   不收任何商品資訊。**這條教訓反覆出現——送進提示詞的欄位標籤會被畫出來。**
2. **質地圖畫出錯誤容器** → 提示詞主動允許「無品牌按壓頭」。解法：畫面中完全不出現任何容器。
3. **賣點視覺只是泛用緞帶** → 使用者填的賣點（`Product.description`）**從來沒送進提示詞**，
   benefit 只拿到 `Supplied use cases: pre-shaving care` 三個英文字，又被要求「抽象」。
   解法：送進真正的賣點文字（剝掉欄位標籤），並改成「演出功效」——
   肌膚效果／作用過程／改善對比三選一。
4. **主題選了沒感覺** → `ImageSetTheme` 只有 `{key,label,kind}`，
   模型不知道「開學季」長什麼樣。解法：`image-set-theme-visuals.ts`
   補上時節光線／色調／道具／場景，37 個明確條目＋購物節共用一套。

⚠️ **「乾淨可合成」與「有主題感」本質衝突**（背景要淨空，主題道具想擺上去）。
現行解法是分工：背景只吃 `setting`+`season`、裝飾吃 `palette`+`props`、賣點視覺吃全部。

---

## 6. 賣點圖示（已上線 2026-09-21）

9/18–9/21 全部的工作都在這一條線上，24 個 commit。

### 分工

賣點視覺＝用情境演出功效；賣點圖示＝把賣點整理成 Icon 資訊模組，圖裡不含任何文字。

### 🔴 圖裡不能有字（反覆被違反，改提示詞前先讀這段）

中文交給排版階段用字型渲染，圖像模型畫中文會缺筆畫。**實測真的踩過**：提示詞裡
寫了 `Draw one icon for "雙重保濕"`，模型就把那四個字畫進圖上、上下各一次，
後面補再多 `no text` 都沒用——這個專案早就驗過否定指令對文字生圖無效。

所以提示詞裡**完全不放中文**。測試直接斷言「指示模型畫什麼的那一段不得出現任何
中文字元」，另外也擋色碼（`#FFFFFF` 那類字串同樣會被畫成畫面上的字）。
賣點圖示也不收商品賣點文字——那是給賣點視覺用的，會從另一條路把中文帶進去。

### 🔴 一致性一定要用可執行的東西表達

這條今天被驗證了四次，每次都是同一個教訓：**每張 icon 是獨立一次 API 呼叫，
模型看不到同組其他張**，所以任何「請保持一致」都會跑掉。

| 要一致的東西 | 失敗的做法 | 現在的做法 |
|---|---|---|
| 線條風格 | 「請保持風格一致」 | 寫死比例：主體佔畫布 45%、線寬 3% |
| 畫面主體 | 「整組共用同一個 subject」 | 程式強制：取第一個賣點的主體套用到全部 |
| 輔助元素 | 「要具體、畫得出來」 | 程式檢查必須是名詞片語（a/an/the/two… 開頭） |
| 圓底大小與顏色 | 「直徑佔 60%、整組同色」 | **程式合成**：模型只畫剪影，圓由 `renderBenefitBadge()` 畫 |

最後一項是關鍵轉折：寫死比例仍然不夠，因為要一致的是**跨圖的絕對值**。

### 怎麼決定畫什麼

`extractBenefitPoints()` 打一次 LLM，整理成 3–5 個不重複面向的賣點，每個拆成兩段：

- `subject`：唯一主體，限身體部位或自然元素。**整組共用同一個**，由程式統一
- `hint`：一個看得見的輔助元素，**必須是名詞片語**（動作沒有形狀，會畫成色塊）

合成後例如 `a leg with a few small particles`。禁用字擋掉沒有形狀的東西
（setting／atmosphere／experience）與會變成商品插畫的東西（bottle／platform／table）。
規則拆解版 `deriveBenefitPoints()` 留著當後備，但它給不出英文描述，那種情況不做圖示。

### 三種風格

| key | 名稱 | 說明 |
|---|---|---|
| `plain` | 極簡線稿 | 單色細線，無外框（預設） |
| `framed` | 圓底徽章 | **圓由程式合成**，模型只畫深色剪影 |
| `soft` | 柔和色塊 | 柔和填色，保留插畫感但細節壓到最少 |

風格在「確認生成」那一刻選，存進 planJson 的賣點圖示項目上。**不需要改資料庫結構。**

### 使用者可以改

清單上標題與說明是輸入框（右側有鉛筆提示）。改了標題會自動重新想圖——圖是由
英文描述決定的，只改標題不動描述會發生「打了保濕卻畫出刷子」。

「新增賣點」**目前收起來**：`ImageSetModal` 沒有傳 `onAddBenefit`／`onRemoveBenefit`，
所以按鈕不顯示。後端（確認 API 的 `addedBenefits`）與 `addImageSetBenefit()` 都還在
而且有測試，要開回來就是把那兩行 handler 接上。

### 加入自由畫布

一張賣點圖示拆成三個圖層：icon 圖片、標題文字、說明文字。文字是真正的
`independent_text`，可換字體字級顏色。編輯器有群組功能（工具列「群組」）但不會
自動群組。另外修過：素材進畫布會被拉變形（框是排版位置，不是圖片尺寸）。

### 去背

生成的是白底 JPG，文字生圖路徑拿不到透明底。畫布工具列有「去背」按鈕（選取單一
圖片圖層時出現），沿用既有的 `/api/magic-layers/cutout`。**做成按鈕不是自動執行，
因為去背要付費。**

### 清單 UI

賣點圖示自成一區「AI 推薦賣點 Icon」，卡片式三欄；風格用三張 SVG 縮圖卡片選。
其他八個素材類型旁邊各有一張示意縮圖（`public/asset-samples/`，共約 39KB）。

⚠️ 示意圖是**固定素材，所有品牌看到的都一樣**（目前是這支除毛乳液的圖），
標注為「示意」。其中「商品其他角度」那張是雪景耶誕版，庫存另一張印著
「520告白日」五個大字，兩張都是檔期批次生的，之後要換得重生一張中性的。

### 已實際生成驗證過

- 圖上沒有中文字、沒有方格紙 ✅
- 改標題會換圖（保濕 → 水滴，不再是刷子）✅
- 三張同組共用同一條腿、輔助元素各不同 ✅
- 圓底徽章兩張的圓直徑都是 614px、顏色完全相同 ✅
- 三種風格都各生過 ✅

### 還沒驗證的

- 「新增賣點」按下去真的多一張並生成——只有單元測試，UI 已收起來
- 柔和色塊的顆粒偏小、徽章剪影內的小元素偏小，可調但要花錢試

## 7. 未解 / 待辦

| 優先 | 事項 |
|---|---|
| 🔴 | 個人 Vercel 帳號的 **Blob store 不能刪**；長期要寫腳本把圖搬到公司 store 並回寫資料庫網址（約 16 個欄位＋JSON 內嵌） |
| 🟡 | 公司站部署權限未穩定 |
| 🟡 | 決定何時把使用者從 x5hn 切到 fimmick-mira（換網域＝所有人重輸密碼，只該換一次） |
| 🟡 | 「新增賣點」只有單元測試，UI 已收起來；要開回來得先實測一次 |
| ⚪ | 加入畫布時不會自動群組三個圖層（編輯器有群組功能，但要手動框選） |
| ⚪ | 示意圖「商品其他角度」是雪景耶誕版，要中性的得重生一張 |
| ⚪ | 柔和色塊的顆粒、徽章剪影裡的小元素都偏小，可調但要花錢試 |
| 🟡 | Codex 分支 `codex/ad-layout-composition-plan` 落後 main 34 個 commit，要繼續開發得先 merge main |
| 🟡 | 本機 dev 若不設 `SITE_PASSWORD`，付費端點**完全無認證**（`site-gate.ts:50` 開發環境直接放行）。曾發生過「沒人按確認卻收到 8 張 generation POST」 |
| ⚪ | 素材背景有 AI 亂碼文字（「Eaodr Shavts」），一直沒處理 |
| ⚪ | lint 全 repo 有既有 error（`MagicLayersEditor.tsx` 單檔 29 個），刻意不改但**不要新增**——改完比對數字有沒有變多 |
| ⚪ | `release-kit` worktree 與 `backup-before-strip` 標記，穩定後可清 |

**已從待辦移除**：RapidAPI key 輪替（使用者 2026-09-17 決定不處理，不要再主動提）。

---

## 8. 跟使用者共事的方式

- 她是行銷背景，**要解釋「為什麼」而不只是「做了什麼」**，但不要長篇術語。
- 她會用截圖回報問題，通常直覺是對的（「賣點視覺只是一張背景」「主題沒感覺」都命中真正的根因）。
- **她的截圖曾三次帶到憑證**（RapidAPI key、Turso token）。要看終端機時提醒她先 `clear` 或只截需要的幾行。
- 每次改動都要跑完整驗收再回報，她信任「實測數字」勝過「應該沒問題」。
- 判斷錯了要明講並更正（這次有三次：Hobby 函式上限、背景否定改肯定沒用、「6 個未推 commit」記錯）。

---

## 9. 相關文件

| 檔案 | 內容 |
|---|---|
| `DESIGN.md` | 白卡片 v2 設計系統。**做 UI 前先讀**，特別是 §8 改版鐵則（只改視覺不動邏輯） |
| `docs/VERCEL-PRO-MIGRATION.md` | 搬公司 Vercel 的完整清單（環境變數分四級、Blob 陷阱、免密碼驗證法） |
| `docs/LOCAL-DEV-DB.md` | 本機資料庫做法、Prisma client 跨 worktree 共用的坑、Turso token 輪替 |
| `docs/NEXT-STEPS.md` | 搬家步驟與收尾 |
| `docs/VISUAL-ASSET-KIT-CONTINUE-HERE.md` | Codex 那條線的交接 |
