# AI 引擎全覽 — marketing-tool

> 本檔解釋呢個工具用咗邊啲 AI 模型、各自強項/限制、合成引擎點揀同**點手動改排序**。
> 對應程式碼：`src/lib/generate.ts`（模型常數 + 各引擎函數）、`src/app/api/library/generate/route.ts`（合成排序 `order`）。

---

## 0. 確切型號 / 版本（用緊邊個就係邊個）

> 想一眼知「實際 call 緊邊個模型嘅邊個版本」就睇呢度。fal endpoint 喺 `src/lib/generate.ts` 頂部常數，可用 `.env.local` 覆寫。

| 功能 | 確切模型・版本 | 供應商 | fal endpoint（實際 call）| env 覆寫 |
|---|---|---|---|---|
| 產品合成 · 主力 | **FLUX.2 [pro]**（edit/多參考）| Black Forest Labs | `fal-ai/flux-2-pro/edit` | `FAL_FLUX2_EDIT_MODEL` |
| 產品合成 · 自然 | **Nano Banana = Google Gemini 2.5 Flash Image**（**標準版，唔係 Pro / 唔係 Gemini 3**）| Google（經 fal）| `fal-ai/nano-banana/edit` | `FAL_EDIT_MODEL` |
| 素材生成 · Nano 純文字生圖 | **Nano Banana**（text-to-image，無參考圖時用）| Google（經 fal）| `fal-ai/nano-banana` | `FAL_NANO_T2I_MODEL` |
| 產品合成 · Seedream | **Seedream 4.5**（edit）| ByteDance | `fal-ai/bytedance/seedream/v4.5/edit` | `FAL_SEEDREAM_EDIT_MODEL` |
| 產品合成 · Qwen（UI 隱藏）| **Qwen-Image-Edit Plus（2509）** | Alibaba | `fal-ai/qwen-image-edit-plus` | `FAL_QWEN_EDIT_MODEL` |
| 純文字生圖 · 場景/背景 | **FLUX.1 [schnell]** | Black Forest Labs | `fal-ai/flux/schnell` | `HF_IMAGE_MODEL`（HF 備援）|
| 素材生成 · 人像 | **FLUX.2 [pro]**（text-to-image）| Black Forest Labs | `fal-ai/flux-2-pro` | `FAL_FLUX2_MODEL` |
| 素材生成 · 插畫 | **Recraft V3**（style=digital_illustration）| Recraft | `fal-ai/recraft/v3/text-to-image` | `FAL_RECRAFT_MODEL` |
| 去背（rembg）| **BiRefNet** | （經 fal）| `fal-ai/birefnet` | `FAL_REMBG_MODEL` |
| 升頻（dormant）| **Clarity Upscaler** | （經 fal）| `fal-ai/clarity-upscaler` | `FAL_UPSCALE_MODEL` |
| #4 AI 融合打光（opt-in）| **FLUX.2 [pro]** edit | Black Forest Labs | `fal-ai/flux-2-pro/edit` | `FAL_FLUX2_EDIT_MODEL` |
| 文案（text）| **GPT-4o mini** | OpenAI（經 OpenRouter）| `openai/gpt-4o-mini` | `OPENROUTER_TEXT_MODEL` |
| 圖片分析 / 讀圖（vision）| **GPT-5.4 nano** | OpenAI（經 OpenRouter）| `openai/gpt-5.4-nano` | `OPENROUTER_VISION_MODEL` |
| 〔已退役〕GPT 影像合成 | GPT-5.4 image 2 / GPT-5 image mini | OpenAI（經 OpenRouter）| `openai/gpt-5.4-image-2` | `OPENROUTER_IMAGE_MODEL` |
| 〔已退役〕Bria product-shot | Bria | （經 fal）| `fal-ai/bria/product-shot` | — |

> **特別答**：產品合成嘅「nano-banana」= **Google Gemini 2.5 Flash Image（標準 Nano Banana）**，**唔係** 近期嘅「Nano Banana Pro / Gemini 3 Pro Image」。想升 Pro 就改 `FAL_EDIT_MODEL` 去對應 fal endpoint（會貴啲）。

---

## 1. 一覽表

| 用途 | 模型 / 服務 | 喺邊度設定 | 強項 | 限制 |
|---|---|---|---|---|
| **產品合成（主力）** | fal.ai **FLUX.2 [pro] edit**（`fal-ai/flux-2-pro/edit`）| `FAL_FLUX2_EDIT_MODEL` | **中文字保真最好**（實測單圖幾乎逐隻清晰）、可換背景/真背景圖、**收多圖**、場景自然 | 多於 1 張產品時細字會微糊（生成式先天限制）|
| **產品合成（自然）** | fal.ai **nano-banana**（Gemini，`fal-ai/nano-banana/edit`）| `FAL_EDIT_MODEL` | 快（~8s）、穩、收多圖、場景最自然 | **會重畫產品 → 中文/小字易糊**，適合無產品文字之合成 |
| **產品合成（Seedream）** | fal.ai **Seedream 4.5 edit**（`fal-ai/bytedance/seedream/v4.5/edit`）| `FAL_SEEDREAM_EDIT_MODEL` | 場景最自然、穩定、收多圖；多圖文字優於 FLUX | 偶有機率出錯字、~1分鐘 |
| **產品合成（後端保留，UI 隱藏）** | **Qwen Image Edit Plus**（`fal-ai/qwen-image-edit-plus`）/ **文字保真貼圖**（rembg 真像素疊圖）| `FAL_QWEN_EDIT_MODEL` / 函數內 | Qwen=中文字專家；貼圖=字 100% 不糊 | Qwen 慢易 timeout；貼圖融合感平。實測效果不及上述，故 UI 收起（函數仍在）|
| **產品合成（最後備援）** | `sharp` 機械疊圖 | 函數內 | 一定出到（本機）| 需透明去背 PNG、無打光、最「死版」 |
| **〔已退役〕Bria product-shot / GPT image** | — | — | — | Bria 去背差、產品變細；GPT provider 極不穩定常 crash。**已從 UI/排序移除**（被 FLUX.2 edit + Seedream 取代）|
| **純文字生圖**（文字主體 / 背景生成）| fal.ai **FLUX.1-schnell**（`fal-ai/flux/schnell`）→ HF FLUX 備援 → Pollinations（停）| `HF_IMAGE_MODEL` 等 | 快、平、prompt 跟得好 | 文字（尤其中文）一樣弱 |
| **去背** | fal.ai **birefnet**（`fal-ai/birefnet`）| `FAL_REMBG_MODEL` | 快（~1-2s）、乾淨 alpha | — |
| **升頻（dormant）** | fal.ai **clarity-upscaler** | `FAL_UPSCALE_MODEL` | 銳化 | 低清源頭救唔返、會亂估字（已停用）|
| **圖片分析（構圖/配色/語氣）** | OpenRouter **gpt-5.4-nano**（vision）| `OPENROUTER_VISION_MODEL` | 讀版面準、抓主導色、識分促銷意圖 | model id 會輪換 |
| **文案生成** | OpenRouter **gpt-4o-mini**（text）| `OPENROUTER_TEXT_MODEL` | 平、穩、繁中 | — |
| **繁中 brief → 英文 prompt** | OpenRouter text model | — | 令 FLUX 出圖更準 | — |

---

## 2. 合成引擎：三揀一 + 自動 fallback

UI「合成方式」可揀 3 個（`src/components/library/PromptComposer.tsx`），**全部支援多產品**：

| 揀 | engine 值 | 行為 |
|---|---|---|
| **FLUX.2 edit · 主力**（預設）| `flux2edit` | 中文字最清晰；產品多於 1 張時字會微糊 |
| **nano-banana** | `nano` | 場景最自然；字會糊，適合無產品文字合成 |
| **Seedream 4.5** | `seedream` | 多圖文字效果優於 FLUX；偶有機率出錯字 |

> 另有 `qwen`（Qwen edit）同 `paste`（文字保真貼圖）兩個後端引擎，實測效果不及上述，**UI 已收起**（函數/排序仍保留，將來想要返開返 UI 按鈕即可）。

**高清輸入**：合成前產品圖**唔再降到 1024**，改餵高清（單／雙產品 2048、三產品 1280，q92）。實測令標籤/中文字清晰好多。

後端（route.ts）會按你揀嘅 `engine` **先試主力，失敗就順序試下一個**，全部失敗先去 sharp 疊圖：

```
engine = "flux2edit" → [flux2edit, nano]            ← 預設
engine = "nano"      → [nano, flux2edit]
engine = "seedream"  → [seedream, flux2edit, nano]
（隱藏）qwen → [qwen, flux2edit, nano]；paste → [paste, flux2edit]
（以上全失敗 → sharp 疊圖）
```

---

## 3. 🔧 點手動改「AI 生圖引擎排序」

排序由 `src/app/api/library/generate/route.ts` 入面個 **`order`** 變數決定（搜 `生圖引擎排序` 就搵到，有大段框住嘅註解）：

```ts
const order = engine === "nano" ? [tryNano, tryFlux2Edit]
  : engine === "seedream" ? [trySeedream, tryFlux2Edit, tryNano]
  : engine === "qwen" ? [tryQwen, tryFlux2Edit, tryNano]
  : engine === "paste" ? [tryPaste, tryFlux2Edit]
  : [tryFlux2Edit, tryNano];   // ← 預設 / "flux2edit"
```

- **每行 = 一個 engine 對應嘅嘗試次序**；第 1 個係主力，跟住順序 fallback。
- 現成 helper：`tryFlux2Edit`（主力）、`tryNano`、`trySeedream`、`tryQwen`、`tryPaste`。

**常見改法：**

| 想點 | 點改 |
|---|---|
| 預設改用 Seedream | 最後一行（else）→ `[trySeedream, tryFlux2Edit, tryNano]` |
| 把 Qwen / 貼圖重新放返 UI | 喺 `PromptComposer.tsx` 嘅引擎選項 array 加返 `qwen` / `paste` 兩格 |
| 完全唔用某引擎 | 喺 array 度刪走嗰個 `tryXXX` |
| 加新引擎 | 喺上面照 `tryFlux2Edit` 寫多個 `tryXyz()` helper，再加入 array |

**換模型**（唔改排序，只換某引擎用邊個 model）：改 `src/lib/generate.ts` 頂部嘅常數，或喺 `.env.local` 覆寫：
- FLUX.2 edit → `FAL_FLUX2_EDIT_MODEL`
- nano-banana → `FAL_EDIT_MODEL`
- Seedream → `FAL_SEEDREAM_EDIT_MODEL`；Qwen → `FAL_QWEN_EDIT_MODEL`
- 去背 → `FAL_REMBG_MODEL`
- 文字生圖 → `HF_IMAGE_MODEL`
- 分析/文案 → `OPENROUTER_VISION_MODEL` / `OPENROUTER_TEXT_MODEL`

> 改完 `route.ts` 或 `generate.ts` 後，dev server 會自動重編譯；改 `.env.local` 要**重啟** dev server 先生效。

---

## 4. 素材生成引擎（GenerateAssetModal）

素材生成功能（背景 / 人像 / 插畫）各有預設引擎。**Nano Banana 引擎任何時候都揀得**：有參考風格圖 → 走 `/edit` 做**風格遷移**；無參考圖 → 走 `fal-ai/nano-banana` 做**純文字生圖**。後端按 `refImageUrl` 有冇自動切，UI 唔再 disable（2026-06 更新）。

### 4a. 預設引擎（純文字生圖，無需參考圖）

| 素材類型 | 預設引擎 | fal.ai endpoint | 強項 | 限制 |
|---|---|---|---|---|
| **背景** | **FLUX.1-schnell** | `fal-ai/flux/schnell` | 快（~4s）、場景感強 | 無法保留特定風格 |
| **人像** | **FLUX.2 pro** | `fal-ai/flux-2-pro`（`FAL_FLUX2_MODEL`）| 真人寫實、預設亞裔（台/港）面孔（prompt 自動加，可關）| 貴、較慢 |
| **插畫** | **Recraft V3** | `fal-ai/recraft/v3/text-to-image`（`FAL_RECRAFT_MODEL`，style=`digital_illustration`）| 2D 插畫風格準確 | 唔適合寫實 |

### 4b. Nano Banana（風格遷移 / 純文字生圖，按參考圖自動切）

- **有參考圖** → endpoint `fal-ai/nano-banana/edit`（`FAL_EDIT_MODEL`，同產品合成用同一個 model）；做 image-to-image **風格遷移**，把參考圖的**視覺風格**（色調、光影質感、氣氛）遷移到新畫面。
- **無參考圖** → endpoint `fal-ai/nano-banana`（`FAL_NANO_T2I_MODEL`）；做 text-to-image **純文字生圖**，功能上同 FLUX.1 重疊（出品風格不同，可 A/B 試）。
- **切換邏輯**：後端 `useNano = engine==="nano"`，再 `useNanoEdit = useNano && !!refImageUrl` 決定走 edit 定 t2i；UI 引擎掣任何時候都揀得，副標題按有冇參考圖顯示「參考圖風格遷移」/「純文字生圖」。

#### 風格遷移 vs 內容複製 — 關鍵決定

```
❌ 錯誤用法：叫 nano-banana 複製構圖 / 佈局 / 主體
✅ 正確用法：只借風格（color palette, lighting, texture, mood），另建全新畫面
```

為強制「風格遷移、非內容複製」，prompt 寫法：

```
Create a completely new original image. Use the reference image (first image)
ONLY as a style guide — adopt its color palette, lighting quality, texture and overall
mood/atmosphere. Do NOT copy the reference image's composition, layout, or subject matter.
New scene: <sceneDescription>. The result must be aesthetically similar but entirely
different in content.
```

#### 參考圖分析（vision model → styleDesc）

`describeReferenceStyle(imageUrl, host)` 呼叫 vision model（`OPENROUTER_VISION_MODEL`），只分析：
- ① 主色調與配色方案
- ② 光線氛圍與打光方式  
- ③ 整體質感與材質感
- ④ 情緒氣氛

**刻意排除**：構圖、佈局、畫面內容（避免影響用戶描述的構圖自主性）。

分析結果用於：
1. **✨潤色**：注入 `polishBriefToChinese` 的 `styleHint` 讓擴寫描述融入參考風格。
2. **全 AI 生成**（非 Nano 路徑）：prepend `【參考圖風格】` 到 brief 再翻英餵 FLUX。

#### 程式碼對應

| 函數 / 端點 | 位置 | 說明 |
|---|---|---|
| `describeReferenceStyle` | `lib/generate.ts` | Vision model 讀圖，回傳繁中風格描述（max 80字，僅色調/光影/質感/情緒，不含構圖） |
| `falSceneFromRef` | `lib/generate.ts` | Nano Banana 風格遷移生成（**有參考圖**），ref 圖先 resize → JPEG data URI |
| `falNanoTextToImage` | `lib/generate.ts` | Nano Banana 純文字生圖（**無參考圖**），endpoint `FAL_NANO_T2I_MODEL` |
| `polishBriefToChinese` | `lib/generate.ts` | 接受 `styleDesc?` 注入風格參考至 polish prompt；輸出 100 字內 |
| `POST /api/library/polish` | `app/api/library/polish/route.ts` | 接 `refImageUrl?`，先分析再潤色 |
| `POST /api/library/generate` | `app/api/library/generate/route.ts` | `useNano = engine==="nano"`；`useNanoEdit = useNano && !!refImageUrl` → 路由到 `falSceneFromRef`（edit）/ `falNanoTextToImage`（t2i）/ 標準 FLUX |
| `POST /api/library/describe` | `app/api/library/describe/route.ts` | 多模式讀圖：`kind=brief`（20–30字生成初稿）/ `kind=background`（20字場景）/ 預設（20字主體）；接 `genType` 調整提示 |

### 4c. AI 讀圖填描述初稿（describe?kind=brief）

用戶貼上或上傳參考風格圖後，vision model 自動分析並填入 20–30 字的描述初稿，供用戶修改或直接潤色。

**觸發方式（三種）：**

| 觸發 | 行為 | 是否覆蓋現有描述 |
|---|---|---|
| URL 欄 `onBlur`（貼完網址離開） | 自動靜默呼叫 | 描述為空時才填，有描述不覆蓋 |
| 上傳圖片成功後 | 自動靜默呼叫 | 同上 |
| 點「重新讀圖」按鈕（`RefreshCw` icon，藍色）| 手動強制觸發 | 一律覆蓋（force=true） |

**一鍵「讀圖 → 潤色」：**
- 有參考圖 + 描述為空時，直接按「潤色」：自動先讀圖填初稿，再對初稿進行潤色，一步完成。
- 有參考圖 + 描述已有內容：直接潤色（帶入 styleDesc 風格參考）。

**Loading 狀態分離：**
- `refDescribing`（讀圖中）與 `polishing`（潤色中）獨立 state。
- 讀圖進行中，label 旁顯示獨立 spinner「讀圖中…」；按鈕本身文字不變，讓用戶仍可看到「重新讀圖」按鈕在哪。

---

## 6. ⚠️ AI 技術限制（好重要）

1. **圖片入面嘅文字係「畫」出嚟嘅像素，唔係文字資料** → 重畫型模型會「重繪」標籤。但**唔係所有重畫型都一樣差**：實測 **FLUX.2 edit** 對中文標籤保真度極高（單圖幾乎逐隻清晰），**Seedream 4.5** 同級，而 **nano-banana / GPT** 就明顯走樣。Force「繁中/UTF-8 output」無用（圖冇編碼可言），但**揀啱模型 + 餵高清原圖**就救到大部分情況。
2. **多產品會令細字變糊**：呢個係生成式先天限制（每件分到嘅注意力/解析度少咗），FLUX / Seedream / Qwen 都會。要 **100% 保字** 唯一方法仍係**保留產品原像素**（「文字保真貼圖」= rembg 真像素疊圖，UI 已收起但函數仍在）或疊真字體。
3. **餵高清原圖好重要**：合成前唔好降到 1024（已改成 2048/1280）。源頭高清 → 重畫型模型出嚟嘅字清好多。
4. **源頭低清救唔返**：AI 放大細字只會「仍然糊」或「清但變錯字」，垃圾入垃圾出。
5. **已退役 GPT / Bria**：OpenAI 影像模型（gpt-5.4-image-2 等）全部 intermittent、常 crash；Bria 去背差、產品變細。兩者已從 UI/排序移除。
6. **多圖上限**：nano-banana 食「3 產品 + 1 背景 = 4 圖」會過載 → 揀 3 件產品時，背景**改用文字參考**（唔當圖片輸入）。

---

## 7. 實務建議

- **日常主力 / 中文標籤要清楚**：**FLUX.2 edit**（預設）。單圖中文字保真最好。
- **純場景、無產品文字**：nano-banana（最自然）。
- **多圖 / 想另一種場景風格**：Seedream 4.5（多圖文字較好，但偶有錯字）。
- **多產品細字要 100% 清**：用「文字保真貼圖」（要喺 UI 開返，或直接行 `paste` 引擎）。
- **重點宣傳大字**：與其靠 AI 畫，不如將來用「平面疊真字」（海報文案層，永遠清晰）。

---

## 8. 點解唔轉用其他生圖模型（DALL-E / Midjourney / FLUX / SD 3.5）

> 常見問題：「轉用 ChatGPT / Midjourney / FLUX 會唔會解決產品中文字走樣？」**唔會。**

關鍵分別 —— 生圖模型分三類，只有第三類保留得到你個產品：

| 類型 | 例子 | 會唔會保留你產品標籤 |
|---|---|---|
| **純文字生圖**（text-to-image）| DALL-E 3、Midjourney、FLUX、SD 3.5 | ❌ 完全唔會（由零畫，連產品＋中文都自己亂作，比現狀更差）|
| **圖像編輯／重繪** | **FLUX.2 edit ✅**、Seedream 4.5 ✅、nano-banana ⚠️、GPT ⚠️ | 收你張圖重繪。**但 FLUX.2 edit / Seedream 對中文保真度高**（實測單圖近乎完美）；nano/GPT 就走樣 |
| **產品保留合成** | 去背+疊圖（「文字保真貼圖」）| ✅ 保留產品原像素、文字 100% 完好（融合感較平）|

➡️ 更新（本 session 實測）：以前以為「重畫型一定救唔到中文」，但 **FLUX.2 edit / Seedream 4.5 重畫都保到中文**，已成為主力。要 100% 保字先需要「保留原像素」（貼圖）。純文字生圖模型（DALL-E/MJ/SD）依然解決唔到，且失去「用你產品相」嘅能力。

### 各模型參考（純生圖用途；價錢約數、會浮動）

| Model | 可否 API 生圖 | 約價/張 | 中文字準度 | 備註 |
|---|---|---|---|---|
| **DALL-E 3** | ✅（OpenAI API）| ~$0.04 標準 / $0.08 HD | 一般，中文差 | **唔收輸入圖**保留產品 |
| **Midjourney** | ⚠️ 冇官方 API（$10–120/月 Discord；第三方非官方）| 訂閱制 | 美感最強、中文差 | 唔能保留指定產品 |
| **FLUX Pro / Dev** | ✅（fal.ai / Replicate）| Dev ~$0.025、Pro ~$0.04、**schnell ~$0.003** | 拉丁字尚可、中文唔穩 | 本 project 已用 schnell 做**純文字生圖** fallback |
| **Stable Diffusion 3.5** | ✅（Stability / fal / Replicate）| ~$0.03–0.065（Large）| 比舊版好但中文仍差 | 開源、可自架（慳 API 費）|

> 結論：換邊個純生圖模型都救唔到產品中文標籤。文字清晰問題交俾 **Bria 保留原相** / 平面疊真字；角度/弧面標籤亦只能靠保留原相（真照片角度天生正確），唔好夾硬叫 AI 重畫。
