# Cindy 文字層對接 Schema（草案 v0.1 — 待 review）

> 用途：素材庫「活動圖生成」→ **底圖模式**時，系統交俾 Cindy（負責「圖上生成文字」）嘅資料契約。
> 狀態：**草案，等 Verna + Cindy review**。文字層實際版面/模板（Q6）**未定**，所以呢度用彈性欄位（`hint` / `zone` 屬建議，唔強制），Cindy 可以自行決定最終排版。
> 起草日：2026-07-29

---

## 1. 背景 / 分工

| 角色 | 負責 |
|---|---|
| **本系統** | 出「底圖 + 文字內容 + 品牌樣式 + 建議」→ 一份 JSON |
| **Cindy** | 接呢份 JSON，喺底圖上**排版 / 生成文字層**（實際燒字 / SVG / 圖層都得，佢定） |

**底圖模式定義**：用戶喺素材庫揀一張相，成張相 **100% 用做背景**（唔會 AI 重新生圖）。系統只負責：
1. 存底圖 + 尺寸
2. 自動生成建議文案（主標 / 副標 / CTA / 發文文案）
3. 帶埋品牌樣式（色 / logo）
4. 打包成下面呢份 JSON 交俾 Cindy

---

## 2. Schema（草案）

```jsonc
{
  "version": "0.1",
  "jobId": "cly...",              // 對應一個 Activity job
  "mode": "BASE_IMAGE",           // 固定；將來如有其他模式再加

  // ── 底圖 ──────────────────────────────
  "baseImage": {
    "url": "/uploads/xxx.jpg",    // 成張相做背景
    "width": 1024,
    "height": 1024,
    "ratio": "1:1"
  },

  // ── 品牌樣式（供文字層取色 / 放 logo）──
  "brand": {
    "name": "品牌名",
    "primaryColor": "#123456",
    "secondaryColor": "#abcdef",  // 可 null
    "logoUrl": "/uploads/logo.png", // 可 null
    "fontHint": "常用字體 / commonText" // 可空
  },

  // ── 文字內容（系統自動生成，可俾用戶改）──
  // Cindy 只需要「內容 + 角色」；zone / hint 屬建議，非強制。
  "textElements": [
    {
      "role": "headline",         // headline | subtitle | cta | body
      "content": "主標題文字",
      "zone":  "top",             // 建議區域：top|center|bottom|free（Q6 未定，僅 hint）
      "emphasis": "high"          // high|medium|low（字重/字級建議，非強制）
    },
    {
      "role": "subtitle",
      "content": "副標題文字",
      "zone": "top",
      "emphasis": "medium"
    },
    {
      "role": "cta",
      "content": "立即選購",
      "zone": "bottom",
      "emphasis": "high"
    }
  ],

  // ── 長版發文文案（社群貼文用，唔一定燒上圖）──
  "postCopy": "完整發文文案……",

  // ── Q6 版面模板（未定；先留位）───────────
  "templateHint": null            // 將來放 layout/template id 或 spec
}
```

---

## 3. 欄位說明

- `mode`：`BASE_IMAGE`＝底圖模式。（參考圖模式行返現有生圖流程，唔經呢個 schema。）
- `textElements[].role`：**必要**。Cindy 靠呢個決定字級 / 階層。
- `textElements[].content`：**必要**。實際文字。
- `zone` / `emphasis`：**建議性質**，Cindy 可以覆蓋。等 Q6 版面定案後可以收緊。
- `templateHint`：Q6 待定，暫 `null`。定案後放模板 id / spec。

---

## 4. Review 問題（俾 Cindy）

1. `role` 呢 4 類（headline / subtitle / cta / body）夠唔夠？要唔要加（例如 `badge` / `price` / `tag`）？
2. `zone` 用 top/center/bottom/free 定係要精確座標（x/y/anchor）？→ 影響 Q6 版面模板設計。
3. 顏色 / 字體：靠 `brand` 提供 hint 夠唔夠，定要逐個 element 指定？
4. 交付介面：JSON 檔？API endpoint？定 DB 欄位（下述）直接讀？

---

## 5. 實作落點（本系統側，待起）

- **Prisma**：`Activity` 加 `baseImageUrl String?`（底圖模式用；null＝行現有生圖流程）。
- 交付：`GeneratedLayout` 加 `textLayerJson String @default("{}")` 存上面呢份 JSON，Cindy 讀呢欄（或另開 endpoint）。
- 角色分流（Q7 已定：Mode A② 同 Mode B 一致）：
  - **參考圖** → append 落 `referenceImageUrls`，行現有 generate 流程。
  - **底圖** → set `baseImageUrl`，generate 時**跳過生圖**，直接用底圖 + 打包呢份 schema。
