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

## 4. ⚠️ AI 技術限制（好重要）

1. **圖片入面嘅文字係「畫」出嚟嘅像素，唔係文字資料** → 重畫型模型（nano-banana / GPT）對**中文**特別差，會扭曲/亂筆。Force「繁中/UTF-8 output」**無用**（圖冇編碼可言）。
2. **保留文字嘅唯一可靠方法 = 保留產品原像素**（Bria）或**疊真字體**（只適合平面海報文案，唔適合貼上斜面/弧面產品標籤）。
3. **超採樣（2x render 再縮）只對「真高清 render」有效**（FLUX / sharp 疊圖）；對 **Bria 固定 ~1MP** 反效果（佢只會放大自己張低清 → 更糊），所以 Bria **唔用** shot_size。
4. **源頭低清救唔返**：AI 放大細字只會「仍然糊」或「清但變錯字」，垃圾入垃圾出。
5. **OpenAI 影像模型（OpenRouter）全部 intermittent**：gpt-5.4-image-2 / gpt-5-image / gpt-5-image-mini 都係時快時 hang，唔適合做穩定主力（要穩可考慮直連 OpenAI 官方 API）。
6. **多圖上限**：nano-banana 食「3 產品 + 1 背景 = 4 圖」會過載 → 揀 3 件產品時，背景**改用文字參考**（唔當圖片輸入）。

---

## 5. 實務建議

- **日常主力**：nano-banana（自然、可多產品）。
- **產品標籤/中文要清楚**：揀 **Bria 保留文字**（單圖）。
- **GPT**：撞順風先試，睇佢質素，唔好當主力。
- **重點宣傳大字**：與其靠 AI 畫，不如將來用「平面疊真字」（海報文案層，永遠清晰）。
