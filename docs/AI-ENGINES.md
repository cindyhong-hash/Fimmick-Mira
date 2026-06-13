# AI 引擎全覽 — marketing-tool

> 本檔解釋呢個工具用咗邊啲 AI 模型、各自強項/限制、合成引擎點揀同**點手動改排序**。
> 對應程式碼：`src/lib/generate.ts`（模型常數 + 各引擎函數）、`src/app/api/library/generate/route.ts`（合成排序 `order`）。

---

## 1. 一覽表

| 用途 | 模型 / 服務 | 喺邊度設定 | 強項 | 限制 |
|---|---|---|---|---|
| **產品合成（主力）** | fal.ai **nano-banana**（Google Gemini 2.5 Flash Image，`fal-ai/nano-banana/edit`）| `FAL_EDIT_MODEL` | 快（~8s）、穩、**收多張圖**（多產品 + 真背景圖）、自動去背+打光+透視 | **會重畫產品 → 產品上中文/小字易走樣** |
| **產品合成（保留文字）** | fal.ai **Bria product-shot**（`fal-ai/bria/product-shot`）| 函數內 | **保留產品原像素**（標籤/中文唔被重畫）、自然擺位（automatic）、商用授權 | **單圖**（只食 1 件產品）、~25s、融合感稍遜 |
| **產品合成（測試）** | OpenRouter **GPT-5.4 image 2**（`openai/gpt-5.4-image-2`）| `OPENROUTER_IMAGE_MODEL` | 順嗰陣質素好 | **provider 極不穩定**（時秒回、時 hang 幾分鐘）、單圖、會重畫文字 |
| **產品合成（最後備援）** | `sharp` 機械疊圖 | 函數內 | 一定出到（本機）| 需透明去背 PNG、無打光、最「死版」 |
| **純文字生圖**（文字主體 / 背景生成）| fal.ai **FLUX.1-schnell**（`fal-ai/flux/schnell`）→ HF FLUX 備援 → Pollinations（停）| `HF_IMAGE_MODEL` 等 | 快、平、prompt 跟得好 | 文字（尤其中文）一樣弱 |
| **去背** | fal.ai **birefnet**（`fal-ai/birefnet`）| `FAL_REMBG_MODEL` | 快（~1-2s）、乾淨 alpha | — |
| **升頻（dormant）** | fal.ai **clarity-upscaler** | `FAL_UPSCALE_MODEL` | 銳化 | 低清源頭救唔返、會亂估字（已停用）|
| **圖片分析（構圖/配色/語氣）** | OpenRouter **gpt-5.4-nano**（vision）| `OPENROUTER_VISION_MODEL` | 讀版面準、抓主導色、識分促銷意圖 | model id 會輪換 |
| **文案生成** | OpenRouter **gpt-4o-mini**（text）| `OPENROUTER_TEXT_MODEL` | 平、穩、繁中 | — |
| **繁中 brief → 英文 prompt** | OpenRouter text model | — | 令 FLUX 出圖更準 | — |

---

## 2. 合成引擎：三揀一 + 自動 fallback

UI「合成方式」可揀 3 個（`src/components/library/PromptComposer.tsx`）：

| 揀 | engine 值 | 行為 |
|---|---|---|
| **自然合成（nano-banana）**（預設）| `nano` | 最自然、可多產品；文字可能走樣 |
| **保留文字（Bria）** | `bria` | 保留產品/中文；**限單圖**（2 件或以上自動禁用 → 回落 nano）|
| **GPT-5.4 image** | `gpt` | 測試用；單圖；provider 不穩可能等到 60s 先 fallback |

後端（route.ts）會按你揀嘅 `engine` **先試主力，失敗就順序試下一個**，全部失敗先去 sharp 疊圖：

```
engine = "nano" → [nano, gpt, bria]   ← 預設
engine = "bria" → [bria, nano, gpt]
engine = "gpt"  → [gpt,  nano, bria]
（以上全失敗 → sharp 疊圖）
```

---

## 3. 🔧 點手動改「AI 生圖引擎排序」

排序由 `src/app/api/library/generate/route.ts` 入面個 **`order`** 變數決定（搜 `手動改` 就搵到，有大段框住嘅註解）：

```ts
const order = engine === "bria" ? [tryBria, tryNano, tryGpt]
  : engine === "gpt" ? [tryGpt, tryNano, tryBria]
  : [tryNano, tryGpt, tryBria];   // ← 預設分支
```

- **每行 = 一個 engine 對應嘅嘗試次序**；第 1 個係主力，跟住順序 fallback。
- 三個現成 helper：`tryNano`（nano-banana）、`tryBria`（Bria 保留文字）、`tryGpt`（GPT image）。

**常見改法：**

| 想點 | 點改 |
|---|---|
| nano 永遠優先、唔用 GPT | 三行全部 → `[tryNano, tryBria]` |
| 預設改用 Bria | 最後一行（else）→ `[tryBria, tryNano, tryGpt]` |
| 完全唔用某引擎 | 喺 array 度刪走嗰個 `tryXXX` |
| 加新引擎 | 喺上面照 `tryNano` 寫多個 `tryXyz()` helper，再加入 array |

**換模型**（唔改排序，只換某引擎用邊個 model）：改 `src/lib/generate.ts` 頂部嘅常數，或喺 `.env.local` 覆寫：
- nano-banana → `FAL_EDIT_MODEL`
- GPT image → `OPENROUTER_IMAGE_MODEL`
- 去背 → `FAL_REMBG_MODEL`
- 文字生圖 → `HF_IMAGE_MODEL`
- 分析/文案 → `OPENROUTER_VISION_MODEL` / `OPENROUTER_TEXT_MODEL`

> 改完 `route.ts` 或 `generate.ts` 後，dev server 會自動重編譯；改 `.env.local` 要**重啟** dev server 先生效。

---

## 4. 素材生成引擎（GenerateAssetModal）

素材生成功能（背景 / 人像 / 插畫）各有預設引擎；加埋「參考風格圖」後可解鎖 **Nano Banana 風格遷移**模式。

### 4a. 預設引擎（純文字生圖，無需參考圖）

| 素材類型 | 預設引擎 | fal.ai endpoint | 強項 | 限制 |
|---|---|---|---|---|
| **背景** | **FLUX.1-schnell** | `fal-ai/flux/schnell` | 快（~4s）、場景感強 | 無法保留特定風格 |
| **人像** | **FLUX.2 pro** | `fal-ai/flux-pro/v1.1-ultra` | 真人寫實、亞裔面孔自然 | 貴、較慢 |
| **插畫** | **Recraft V3** | `fal-ai/recraft-v3` | 2D 插畫風格準確、SVG 支援 | 唔適合寫實 |

### 4b. Nano Banana 風格遷移（需要參考風格圖）

- **endpoint**：`fal-ai/nano-banana/edit`（同產品合成用同一個 model）
- **觸發條件**：用戶上傳 / 填入「參考風格圖」URL + 選擇「Nano Banana」引擎。
- **設計意圖**：利用 nano-banana 的 image-to-image 能力，把參考圖的**視覺風格**（色調、光影質感、氣氛）遷移到新生成畫面。

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
| `falSceneFromRef` | `lib/generate.ts` | Nano Banana 風格遷移生成，ref 圖先 resize → JPEG data URI |
| `polishBriefToChinese` | `lib/generate.ts` | 接受 `styleDesc?` 注入風格參考至 polish prompt；輸出 100 字內 |
| `POST /api/library/polish` | `app/api/library/polish/route.ts` | 接 `refImageUrl?`，先分析再潤色 |
| `POST /api/library/generate` | `app/api/library/generate/route.ts` | `useNano = engine==="nano" && !!refImageUrl`；路由到 `falSceneFromRef` 或標準 FLUX |
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

1. **圖片入面嘅文字係「畫」出嚟嘅像素，唔係文字資料** → 重畫型模型（nano-banana / GPT）對**中文**特別差，會扭曲/亂筆。Force「繁中/UTF-8 output」**無用**（圖冇編碼可言）。
2. **保留文字嘅唯一可靠方法 = 保留產品原像素**（Bria）或**疊真字體**（只適合平面海報文案，唔適合貼上斜面/弧面產品標籤）。
3. **超採樣（2x render 再縮）只對「真高清 render」有效**（FLUX / sharp 疊圖）；對 **Bria 固定 ~1MP** 反效果（佢只會放大自己張低清 → 更糊），所以 Bria **唔用** shot_size。
4. **源頭低清救唔返**：AI 放大細字只會「仍然糊」或「清但變錯字」，垃圾入垃圾出。
5. **OpenAI 影像模型（OpenRouter）全部 intermittent**：gpt-5.4-image-2 / gpt-5-image / gpt-5-image-mini 都係時快時 hang，唔適合做穩定主力（要穩可考慮直連 OpenAI 官方 API）。
6. **多圖上限**：nano-banana 食「3 產品 + 1 背景 = 4 圖」會過載 → 揀 3 件產品時，背景**改用文字參考**（唔當圖片輸入）。

---

## 7. 實務建議

- **日常主力**：nano-banana（自然、可多產品）。
- **產品標籤/中文要清楚**：揀 **Bria 保留文字**（單圖）。
- **GPT**：撞順風先試，睇佢質素，唔好當主力。
- **重點宣傳大字**：與其靠 AI 畫，不如將來用「平面疊真字」（海報文案層，永遠清晰）。

---

## 8. 點解唔轉用其他生圖模型（DALL-E / Midjourney / FLUX / SD 3.5）

> 常見問題：「轉用 ChatGPT / Midjourney / FLUX 會唔會解決產品中文字走樣？」**唔會。**

關鍵分別 —— 生圖模型分三類，只有第三類保留得到你個產品：

| 類型 | 例子 | 會唔會保留你產品標籤 |
|---|---|---|
| **純文字生圖**（text-to-image）| DALL-E 3、Midjourney、FLUX、SD 3.5 | ❌ 完全唔會（由零畫，連產品＋中文都自己亂作，比現狀更差）|
| **圖像編輯／重繪** | nano-banana、GPT image、FLUX Kontext | ⚠️ 收你張圖但會**重繪 → 中文走樣**（即現狀）|
| **產品保留合成** | **Bria product-shot**、去背+疊圖 | ✅ 保留產品原像素、文字完好 |

➡️ **純文字生圖模型解決唔到文字問題**，反而失去「用你產品相」嘅能力。真正解中文 = **保留原像素**（Bria）或**疊真字**（海報文案層）。

### 各模型參考（純生圖用途；價錢約數、會浮動）

| Model | 可否 API 生圖 | 約價/張 | 中文字準度 | 備註 |
|---|---|---|---|---|
| **DALL-E 3** | ✅（OpenAI API）| ~$0.04 標準 / $0.08 HD | 一般，中文差 | **唔收輸入圖**保留產品 |
| **Midjourney** | ⚠️ 冇官方 API（$10–120/月 Discord；第三方非官方）| 訂閱制 | 美感最強、中文差 | 唔能保留指定產品 |
| **FLUX Pro / Dev** | ✅（fal.ai / Replicate）| Dev ~$0.025、Pro ~$0.04、**schnell ~$0.003** | 拉丁字尚可、中文唔穩 | 本 project 已用 schnell 做**純文字生圖** fallback |
| **Stable Diffusion 3.5** | ✅（Stability / fal / Replicate）| ~$0.03–0.065（Large）| 比舊版好但中文仍差 | 開源、可自架（慳 API 費）|

> 結論：換邊個純生圖模型都救唔到產品中文標籤。文字清晰問題交俾 **Bria 保留原相** / 平面疊真字；角度/弧面標籤亦只能靠保留原相（真照片角度天生正確），唔好夾硬叫 AI 重畫。
