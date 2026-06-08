# 行業測試素材庫（文字 + 圖片）
> 下週測試使用。含 4 大行業主題的 **構圖 / 配色 / 語氣 / 背景** 文字範例 + AI 生成的 **產品去背圖 + 背景圖**。
> 圖片由 HF FLUX.1-schnell 生成，存 `public/uploads/`（本機、gitignore，已備份至 `.backup/`）。
> 同樣內容已做成 **app 內「行業範本」**（QuickAddModal 頂部一鍵套用，見最底）。

## 點用
- **文字素材**：可直接喺「風格組件 → 加入素材」貼入，或撳「套用行業範本」一鍵填入。
- **圖片素材**：去背圖（純白底）可當產品圖、背景圖可當 `背景` 類別上傳。app 內「全部」客戶 → 圖庫已有齊。
- **圖片網址**：`http://localhost:3000/uploads/<檔名>`；本 md 用相對路徑 `../public/uploads/...` 預覽。
- AI 生成的 label 文字係亂碼（圖像模型通病），當示意即可。

---

## 🧴 護膚品 Skincare

**構圖**：留白極簡居中 — 主體置中、大量留白、柔和投影，乾淨療癒
`centered product, generous negative space, soft diffused studio light, gentle shadow, minimal clean beauty`

**配色**：柔米療癒系
| 角色 | 主色 | 輔色 | 強調色 | 中性色 | 點綴色 |
|---|---|---|---|---|---|
| hex | `#E7C6B5` | `#F4ECE3` | `#C98E74` | `#FBF8F4` | `#A7B5A0` |

`soft beige and blush tones, warm neutral palette, calm and clean`

**語氣**：溫和療癒 — 標籤：溫和 / 純淨 / 專業可信
`gentle, clean, dermatological trust, calm and reassuring`

**背景**：柔米漸層棚拍 — 米白漸層、柔光、淡投影
`soft beige gradient studio backdrop, gentle window light, subtle shadow`

**圖片素材**
| 產品去背圖 | 背景圖 |
|---|---|
| ![護膚-去背](../public/uploads/2bc04cd7-b15c-4291-b72b-1f0df0ef7165.jpg) | ![護膚-背景](../public/uploads/60ed75a0-cf73-47af-becf-1d29a3d3b734.jpg) |
| `/uploads/2bc04cd7-b15c-4291-b72b-1f0df0ef7165.jpg` | `/uploads/60ed75a0-cf73-47af-becf-1d29a3d3b734.jpg` |
| 文案：絲滑精華滴管瓶｜無縫純白棚拍 | 文案：柔霧米白漸層光場 |

---

## 💄 女性用品 Feminine

**構圖**：柔焦優雅近景 — 近距特寫、柔焦、細緻佈置
`elegant close-up, soft focus, delicate styling, feminine, refined detail`

**配色**：胭脂玫瑰系
| 角色 | 主色 | 輔色 | 強調色 | 中性色 | 點綴色 |
|---|---|---|---|---|---|
| hex | `#E8A2B0` | `#F6E7EC` | `#B76E79` | `#FFFFFF` | `#C98BA0` |

`blush pink and mauve tones, soft romantic palette, elegant`

**語氣**：親密貼心 — 標籤：溫柔 / 貼心 / 自信
`intimate, caring, gently empowering, warm and confident`

**背景**：粉色絲緞花瓣 — 柔粉絲綢、散落花瓣、唯美
`soft blush pink silk fabric with scattered rose petals, dreamy`

**圖片素材**
| 產品去背圖 | 背景圖 |
|---|---|
| ![女性-去背](../public/uploads/3518e5c1-9972-451c-947a-148051664195.jpg) | ![女性-背景](../public/uploads/4a5df25b-9f18-42bd-afa7-03ce036c4549.jpg) |
| `/uploads/3518e5c1-9972-451c-947a-148051664195.jpg` | `/uploads/4a5df25b-9f18-42bd-afa7-03ce036c4549.jpg` |
| 文案：精緻唇膏與便攜鏡 | 文案：柔粉絲緞與玫瑰散落 |

---

## 🎧 生活電子 Electronics

**構圖**：科技硬光幾何 — 硬邊光、幾何構成、戲劇陰影
`modern tech product, hard rim light, geometric composition, sleek, dramatic shadow`

**配色**：炭黑電光藍
| 角色 | 主色 | 輔色 | 強調色 | 中性色 | 點綴色 |
|---|---|---|---|---|---|
| hex | `#1E2A38` | `#C7CDD4` | `#2D7FF9` | `#0B0F14` | `#5AD1FF` |

`charcoal and electric blue, high contrast, sleek metallic tech palette`

**語氣**：簡潔理性 — 標籤：俐落 / 創新 / 可靠
`sleek, innovative, confident, minimal and precise tech voice`

**背景**：暗色光束漸層 — 深炭灰漸層、藍色光束
`dark charcoal gradient with subtle blue light streaks, modern minimal`

**圖片素材**
| 產品去背圖 | 背景圖 |
|---|---|
| ![電子-去背](../public/uploads/74b0ec8e-05aa-4a16-874c-836134d43de7.jpg) | ![電子-背景](../public/uploads/46f49d59-28e1-4ecb-94fd-f95172b7b9c3.jpg) |
| `/uploads/74b0ec8e-05aa-4a16-874c-836134d43de7.jpg` | `/uploads/46f49d59-28e1-4ecb-94fd-f95172b7b9c3.jpg` |
| 文案：無線耳機充電盒 | 文案：靜默科技光影 |

---

## 👗 衣服 / 時尚 Apparel

**構圖**：編輯時尚 — 全身或平鋪、動態姿態、雜誌感
`editorial fashion, full-length or flat lay, dynamic pose, lifestyle, magazine style`

**配色**：大地赤陶系
| 角色 | 主色 | 輔色 | 強調色 | 中性色 | 點綴色 |
|---|---|---|---|---|---|
| hex | `#B08968` | `#EDE0D4` | `#9C6644` | `#7F5539` | `#DDB892` |

`earthy terracotta and warm neutral tones, natural muted palette`

**語氣**：時尚個性 — 標籤：自信 / 質感 / 街頭
`stylish, confident, editorial, aspirational and effortless`

**背景**：質感灰泥牆 — 米色質感灰泥牆、自然光
`textured beige plaster wall with soft natural daylight, minimal fashion backdrop`

**圖片素材**
| 產品去背圖 | 背景圖 |
|---|---|
| ![衣服-去背](../public/uploads/55606339-99a0-46e8-b63c-a62d431a2845.jpg) | ![衣服-背景](../public/uploads/a38dc325-afd1-470d-a290-aaaf64716f97.jpg) |
| `/uploads/55606339-99a0-46e8-b63c-a62d431a2845.jpg` | `/uploads/a38dc325-afd1-470d-a290-aaaf64716f97.jpg` |
| 文案：精緻針織上衣剪裁 | 文案：奶油米色的靜謐光影 |

---

## 另外兩個行業範本（app 內亦已內建）
為令「行業範本」更完整，app 內另加咗兩個（暫未生成圖片，文字可直接用）：

- **🍽️ 食品飲料**：構圖 俯拍新鮮感 / 配色 暖食慾系 `#F46036 #FFF3E0 #D7263D #FFD166 #2E8B57` / 語氣 食慾誘人（美味/新鮮/衝動）/ 背景 原木·大理石廚台
- **🛋️ 家居生活**：構圖 情境生活感 / 配色 暖木奶油系 `#A68A64 #FAF3E0 #8A9A5B #EDE0D4 #6B705C` / 語氣 溫暖舒適（溫馨/自然/放鬆）/ 背景 暖調室內

---

## App 內「行業範本」功能（本週新增）
- 位置：素材庫 → 風格組件 → **加入素材** → modal 頂部「**套用行業範本**」一排按鈕
- 撳任何一個（🧴護膚品 / 💄女性用品 / 🎧生活電子 / 👗衣服 / 🍽️食品飲料 / 🛋️家居生活）→ 自動填入 構圖 + 5 色配色 + 語氣 + 背景描述 → 再微調即可儲存
- 資料源：`src/types/presets.ts`（要加/改行業，改呢個檔即可）

## 額外：早前驗證測試生成（亦在圖庫）
- 冬季保濕面膜 `75eaacdd…` / 保濕精華 `7120b79a…` / 香氛蠟燭 `0fcdef99…`（詳見 `.claude/TEST_MATERIALS.md`）
