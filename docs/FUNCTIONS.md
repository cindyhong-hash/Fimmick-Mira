# 函數速查 Function Reference — marketing-tool

> 換機 / 新 session 想快搵「邊個函數做咩、用邊個 model/endpoint」就睇呢度。
> 對應程式碼：`src/lib/generate.ts`（生成核心）+ `src/app/api/library/*`（路由）。
> 最後更新：**2026-06-15**。引擎決定見 [AI-ENGINES.md](./AI-ENGINES.md) / [DECISIONS.md](./DECISIONS.md)。

---

## 1. `src/lib/generate.ts` — 生成核心

### 文字 → 圖（純生圖）
| 函數 | 用途 | 模型 / endpoint | env |
|---|---|---|---|
| `generateImage` → `generateImageInApp` | text→image 路由器；按 `input.model` 揀模型，fal → HF → Pollinations fallback | — | — |
| `falAiImage` | 場景 / 背景（預設）| FLUX.1 schnell `fal-ai/flux/schnell` | — |
| `falFlux2Pro` | **人像**（`model:"flux-2-pro"`）| `fal-ai/flux-2-pro` | `FAL_FLUX2_MODEL` |
| `falRecraft` | **插畫**（`model:"recraft"`, style=digital_illustration）| `fal-ai/recraft/v3/text-to-image` | `FAL_RECRAFT_MODEL` |
| `falSceneFromRef` | 素材生成 Nano「參考圖風格遷移」（**有參考圖**，只借風格唔抄構圖）| `fal-ai/nano-banana/edit` | `FAL_EDIT_MODEL` |
| `falNanoTextToImage` | 素材生成 Nano 純文字生圖（**無參考圖**時自動走呢個）| `fal-ai/nano-banana` | `FAL_NANO_T2I_MODEL` |

### 產品合成（edit / 重畫型；全部收多圖 `image_urls`）
| 函數 | UI 名 | 模型 / endpoint | env | 備註 |
|---|---|---|---|---|
| `falFlux2Edit` | **FLUX.2 edit · 主力** | `fal-ai/flux-2-pro/edit` | `FAL_FLUX2_EDIT_MODEL` | 中文字保真最好 |
| `falImageEdit` | nano-banana | `fal-ai/nano-banana/edit` | `FAL_EDIT_MODEL` | 最自然、字會糊 |
| `falSeedreamEdit` | Seedream 4.5 | `fal-ai/bytedance/seedream/v4.5/edit` | `FAL_SEEDREAM_EDIT_MODEL` | 多圖文字較好、偶錯字 |
| `falQwenEdit` | （UI 隱藏）Qwen edit | `fal-ai/qwen-image-edit-plus` | `FAL_QWEN_EDIT_MODEL` | 中文字專家、慢、易 timeout |
| `gptImageComposite` | 〔退役〕GPT image | `openai/gpt-5.4-image-2`（+mini fallback）| `OPENROUTER_IMAGE_MODEL` | provider 常 crash，已從 UI 移除 |
| `falProductShot` | 〔退役〕Bria | `fal-ai/bria/product-shot` | — | 去背差、產品變細，已移除 |
| `buildProductEditPrompt` | （共用）| — | — | edit prompt：多圖排位 + 強調保留中文標籤 |
| `falRemoveBg` | 去背（「文字保真貼圖」用）| `fal-ai/birefnet` | `FAL_REMBG_MODEL` | 真像素疊圖（route 內 `tryPaste`）|
| `falUpscale` | 升頻（dormant）| `fal-ai/clarity-upscaler` | `FAL_UPSCALE_MODEL` | 低清救唔返，已停用 |

### 文字（文案 / brief / 風格）
| 函數 | 用途 | 模型 | env |
|---|---|---|---|
| `generateCopy`（+ `COPY_SYSTEM`）| 文案；persona 入正式 **system role** | OpenRouter text | `OPENROUTER_TEXT_MODEL`（gpt-4o-mini）|
| `translateBriefToEnglishPrompt` | 繁中 brief → 英文 FLUX prompt | OpenRouter text | 同上 |
| `polishBriefToChinese` | ✨潤色：短指令 → 豐富繁中 brief（接 `styleDesc?`）| OpenRouter text | 同上 |
| `describeReferenceStyle` | 參考圖風格分析（只色調/光影/質感，不含構圖）| OpenRouter vision | `OPENROUTER_VISION_MODEL`（gpt-5.4-nano）|
| `compileChineseBrief` | 由積木砌繁中 brief | — | — |
| `falRelightComposite` | #4 系列圖「AI 融合打光」（貼好後 relight，opt-in，有 drift 風險）| FLUX.2 edit | `FAL_FLUX2_EDIT_MODEL` |

---

## 2. API 路由

| 路由 | 用途 | 重點 |
|---|---|---|
| `POST /api/library/generate` | 合成 / 純文字生成 / `draftOnly` 預覽 | 合成餵高清原圖（2048/1280）；`engine` 決定 `order`；`genType`→生圖模型；`sceneOverride`=潤色後場景；`refImageUrl`=參考圖 |
| `POST /api/library/polish` | 潤色 | 接 `brief` + `genType?` + `refImageUrl?`（有圖先 `describeReferenceStyle` 注入風格）|
| `POST /api/library/describe` | AI 讀圖 | `kind=brief`（20–30字初稿）/ `background` / 預設主體；接 `genType` |
| `POST /api/library/template-paste` | #4 固定模板系列：去背產品貼固定背景固定位置 | `placement{scale,x,y}` + 接地/投射陰影 + 可選 `harmonize`（AI relight）；`size` 支援 1800×1200 |
| `POST /api/library/save-image` | 存 draft 入 LibraryImage | 人像/插畫/合成 draft 選取後存（`paramsJson.genType`/`mode`）|
| `PATCH /api/library/images/[id]` | 改生成圖 | `slots` / `copyText` / `subject` / **`clientId`（reassign 移專案）** |
| `PATCH /api/components/[id]` | 改組件 | 含 `clientId` re-home（背景/參考圖 reassign）|
| `POST /api/components/analyze` | 讀圖抽 構圖/配色/語氣/背景 | vision；繁中、硬字數上限 |

---

## 3. 合成引擎排序（`route.ts` 的 `order`）

```ts
engine === "nano"     → [tryNano, tryFlux2Edit]
engine === "seedream" → [trySeedream, tryFlux2Edit, tryNano]
engine === "qwen"     → [tryQwen, tryFlux2Edit, tryNano]   // UI 隱藏
engine === "paste"    → [tryPaste, tryFlux2Edit]            // UI 隱藏
else / "flux2edit"    → [tryFlux2Edit, tryNano]             // 預設
// 全失敗 → sharp 機械疊圖
```

> 改排序 / 換模型 / 加引擎 → 見 [AI-ENGINES.md §3](./AI-ENGINES.md)。
