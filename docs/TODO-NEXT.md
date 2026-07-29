# TODO — 下一批更新（2026-07-13 起草，討論中）

> 狀態：**討論緊，未開工**。逐項傾清楚 + 拍板後先做。
> 主力 project = marketing-tool。

---

## 1. User Onboarding — 預設首頁 = 第一個品牌

**目標**：用戶入嚟唔好見到空白 / 客戶清單頁；直接 land 落**第一個品牌**。除非**真係一個品牌都冇**，先顯示空狀態（新增客戶）。

**現狀**：`/` → redirect `/clients` → 顯示客戶清單（或「還沒有客戶」）。

**做法（初步）**：
- `/`（或 `/clients`）：若有品牌 → redirect 去第一個品牌頁；若冇 → 顯示空狀態。
- 「第一個」= 跟側欄現有排序（釘選置頂優先）。

**✅ 已定**
- Land 落 **廣告活動圖** tab（`/clients/[firstId]`）。
- 「第一個品牌」= 跟側欄順序（釘選置頂優先）。

---

## 2. Activity Image Generation

### 2a. 加返 03 積木選擇（構圖 / 顏色 / 背景）→ 內容注入 AI Prompt

**目標**：活動圖生成頁加返 section 03，用戶可揀 **構圖 / 顏色 / 背景** 積木做生成參考，揀咗嘅內容會**加入 AI Prompt**。

**現狀**：`ActivityForm.tsx` section 03（ComponentSelector）已用 `{false && (...)}` 隱藏。

**做法（初步）**：
- 復原 03 section；用返素材庫嗰款**圖片式積木 picker**（同 SlotPickerModal 一致，有圖），3 類：構圖 / 顏色 / 背景。
- 揀完 → 各積木 `aiPromptText` / 內容拼入 imagePrompt（似而家「風格參考：」嘅 append 方式，或用 `[構圖:]`/`[配色:]`/`[背景:]` 標籤）。

**✅ 已定**
- 用**圖片式 picker**（同素材庫一致）。
- 3 類 = **構圖 / 顏色 / 背景**（唔要語氣）。
- 注入格式：結構化標籤 `[構圖:…][配色:…][背景:…]` append 落 imagePrompt（可再微調）。
- **Section 編號**：積木 picker = **03**；原本「圖片尺寸比例」順延做 **04**。

### 2b. 素材庫「活動圖生成」入口（揀圖 → 參考圖 / 活動圖底圖 → 新活動 job → 圖上出文字）

**目標**：喺**素材庫**加「活動圖生成」。用戶揀一張圖，選擇佢係：
- **(A) 參考圖** — 做風格參考；或
- **(B) 活動圖底圖** — 直接用呢張圖做活動圖，之後喺圖上**生成文字**。

→ 建立一個**新嘅活動圖 job**。「圖上生成文字」嗰部分係 **Cindy 負責**，但**我哋要先起好一個模板/框架**俾佢接。

**✅ 已定：兩個入口喺兩個唔同位置（WF3 v3）**
- **Mode A — 喺「廣告活動圖」頁**：撳「＋新增產品／素材圖片」→ pop-up 揀：① 新活動圖生成（AI 生新圖，現有流程）/ ② 用素材庫圖片（揀現有圖做起點）。
- **Mode B — 喺「素材庫」圖片 pop-up（素材庫只有呢個入口，冇 Mode A）**：「帶入活動圖生成」→ 揀角色：
  - ① 作參考圖（只借風格，另生成新畫面）
  - ② 作活動圖底圖（**成張相 100% 用做背景** → 用戶喺相上加文字 → **系統自動生成文案** → Cindy 做文字排版/生成）。

**✅ 已定 + 已做（2026-07-29）**
- (Q7) **要分，兩邊一致** → Mode A② 同 Mode B 共用 `RolePickerModal`（參考圖 / 底圖）。
- (Q8) **已起草 schema** → `docs/CINDY-TEXT-LAYER-SCHEMA.md`（v0.1，等 Verna + Cindy review）。
- Mode A 入口採 **方案 B**（「新增活動」先彈 ①新生成 / ②用素材庫圖片）。

**✅ 2b 已實作 + 端到端驗證通過**
- Prisma：`Activity.baseImageUrl`、`GeneratedLayout.textLayerJson`（db push 完）。
- 共用 `RolePickerModal`（參考圖 / 底圖）；`NewActivityModal`（Mode A ①/②）；`BrandWorkspaceHeader`「新增活動」改開 pop-up。
- Mode B：`LibraryWorkspace` 素材圖 popup「帶入活動圖生成」→ RolePicker。
- `ActivityForm` 底圖模式（banner + 收起生成 UI）；`/api/activities` 收 baseImageUrl。
- `generate` route 底圖模式：**唔重新生圖**，只生文案 + 打包 `textLayerJson`（Cindy schema）。
- 驗證：Mode A → 揀圖 → RolePicker → 底圖模式表單 → 建立 → DB textLayerJson 正確（headline/subtitle/cta/postCopy 齊）。

**❓ 仲要傾（交俾 Cindy 之前）**
- (Q6) 文字層**版面 / 模板 layout** —— schema 內 `zone`/`emphasis`/`templateHint` 現屬建議性質，等傾完收緊。
- Cindy review `docs/CINDY-TEXT-LAYER-SCHEMA.md` 尾段 4 條問題（role 夠唔夠 / zone 用區域定座標 / 顏色點指定 / 交付介面）。

---

## 3. Project Version（加版本號）

**現狀**：`package.json` version = `0.1.0`（太低，同實際成熟度唔符）。

**建議**：
- **而家 → `0.9.0`**：功能豐富、pre-1.0、交接測試階段（誠實反映「未正式部署上線」）。
- **`1.0.0`**：留返做「呢批新功能做完 + 正式部署」嘅里程碑。
- 顯示位置：`package.json` + UI（側欄底 / 設定頁顯示 `v0.9.0`）。

**✅ 已定**：採用 **0.9.0**（`package.json` + **介面左下角**顯示 `v0.9.0`）。1.0.0 留返做部署里程碑。

---

## Wireframe（2026-07-15，visualize widget，已出）
- WF1 Onboarding 預設首頁 + 版本號左下角
- WF2 活動圖 03 積木 picker → 注入 AI Prompt
- WF3 素材庫「活動圖生成」流程 + Cindy 文字模板框架（layout 待傾）

---

## 開工次序（建議）
1. 版本號（最快、無風險）
2. Onboarding 預設首頁（細、獨立）
3. 活動圖 03 積木注入（中）
4. 素材庫「活動圖生成」入口 + Cindy 模板（大，需先開會傾 layout）
