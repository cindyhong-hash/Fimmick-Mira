# marketing-tool

社群行銷廣告活動圖生成工具（Next.js 16 + React 19 + Prisma/SQLite），由活動主題一站式生成成品廣告圖。同時內建 **素材庫 `/library`**，用來累積、管理可重複使用的品牌素材：
- **生成圖片**：積木組合（構圖/配色/語氣/背景）+ 主體/上傳產品圖 → AI 生成圖片 + 文案，或去背產品圖合成到背景
- **風格組件**：品牌圖庫（上傳分析圖 + 生成圖）→ 點擊圖片開啟詳情視窗、帶入生成、編輯、行業範本一鍵套用

## 🆕 本次更新（2026-08-27）

> ⚠️ **閱讀前須知**：本工具有**兩大功能區**，部分按鈕**同名但功能完全不同**，以下每一項都會標明所屬功能區。
> - 🗂 **素材庫** — 建立與管理可重複使用的素材（產品圖／背景／人像／2D插圖／風格組件）
> - 📣 **廣告活動圖** — 由活動主題生成成品廣告圖，再進入「微調畫布」修圖
>
> 最容易混淆的例子：兩區都有「**上一步／重做**」，但**素材庫的是還原你輸入的文字**，**微調畫布的是還原圖片**。

### 新功能

#### 1️⃣ 上一步／重做 — 五個位置全面統一
過去各處做法並不一致（部分只有單向「還原」，部分完全沒有），現已全面統一。**兩個按鈕永遠一同出現、一同隱藏**，未使用過 AI 功能前不會顯示。

| 功能區 | 位置 | 還原內容 | 過去狀況 |
|---|---|---|---|
| 🗂 素材庫 | 新增**產品圖** → 設計描述 | **文字**（AI 優化提示詞前後） | 只有單向「還原」 |
| 🗂 素材庫 | 新增**背景／人像／2D 插圖** → 主體描述 | **文字**（AI 優化提示詞前後） | 只有單向「還原」 |
| 📣 廣告活動圖 | 新增／編輯活動 → 畫面描述提示詞 | **文字**（AI 幫改／AI 優化提示詞前後） | ❗**完全沒有此功能** |
| 📣 廣告活動圖 | 微調畫布（**單圖**） | **圖片**（每次 AI 修改／放置標誌之後） | 只有「上一步」，沒有「重做」 |
| 📣 廣告活動圖 | 微調畫布（**多圖拼版**） | **圖片**（每格獨立） | 只有「上一步」，沒有「重做」 |

同時「潤色」統一更名為「**AI 優化提示詞**」，圖示全部一致。

#### 2️⃣ 長按圖片預覽上一步版本
**📣 廣告活動圖 → 微調畫布（單圖／多圖皆適用）**
在**圖片本身**（而非按鈕）長按約半秒，即可看到上一個版本，放開手指即消失，方便對比 AI 修改前後的差異。圖片下方有提示文字。
> 長按與「拖曳選取要修改的區域」不會衝突——手指／滑鼠一移動就會自動取消長按。

#### 3️⃣ 未儲存離開時會顯示警告
**📣 廣告活動圖 → 微調畫布（單圖／多圖皆適用）**
修改圖片後尚未點擊「完成此版本」，若點擊返回上一頁或側欄品牌名稱，會彈出確認視窗：**先儲存再離開 ／ 不儲存，直接離開 ／ 取消，留在此頁**。
> 🗂 素材庫的生成流程**刻意未加入**此警告——該流程生成的圖片會立即進入圖庫，中途離開不會遺失，回到畫廊仍然可以找到。

#### 4️⃣ 側欄記住你上次瀏覽的分頁
**全站側欄**
點擊品牌名稱不再固定跳轉到「廣告活動圖」，而是返回你上次瀏覽的分頁。素材庫生成過程中切換頁面再返回，也不會誤以為「生成中斷了」。

#### 5️⃣ 下載檔名統一
**🗂 素材庫（圖片彈出視窗）** 與 **📣 廣告活動圖（版型頁）** 兩處皆已統一為
`{品牌名}-{類型}-{寬x高}-{標題}.{副檔名}`：
```
Fimmick-產品成圖-1200x1200-藍白清新科技感.jpg
Fimmick-多圖01-1200x1500-盛夏芒果冰爽登場.jpg
```
多圖版還可以**逐格下載原圖**（命名為 `多圖01`／`多圖02`…），「下載全部」會顯示實際張數。

### 修復

| 功能區 | 問題 | 現況 |
|---|---|---|
| 🗂 素材庫 | 點擊「AI 優化提示詞」後，已選取的**構圖／配色／背景會悄悄消失**，生成結果不跟隨風格設定 | 優化後會自動保留你選取的設定 |
| 🗂 素材庫 | 圖片彈出視窗點擊「重新生成」，畫面顯示已帶入設定，但**配色實際上沒有送出給 AI** | 已確實送出 |
| 🗂 素材庫 | 點擊「調整」有時會跳轉到**一片空白**的上傳頁面 | 已修復 |
| 📣 微調畫布 | 9:16 直式圖片：右下角說明文字**最後一個字被裁切** | 已修復 |
| 📣 微調畫布 | 9:16 直式圖片：上方按鈕**超出圖片右邊界** | 已對齊 |
| 📣 微調畫布 | 9:16 直式圖片：**左側留白過寬**（與其他比例不一致） | 由 67px 縮小為 25px，與其他比例一致 |
| 📣 微調畫布 | 點擊上一步／重做時，**整段圖片預覽會閃爍**（消失再出現） | 已修復，切換圖片時不再閃爍 |
| 📣 微調畫布 | 中間「圖片微調」區塊會**左右跳動**（一開始修改圖片就跳動） | 欄寬已固定，不再受圖片比例／提示訊息影響 |
| 全站 | Vercel 上點擊「下載」**無法儲存檔案**，只會開啟新分頁 | 已修復（已實測確認） |

---

## 文件
| 檔案 | 內容 |
|------|------|
| [`docs/GUIDE-新手使用.md`](docs/GUIDE-新手使用.md) | **新手使用指南**（如何開始使用本工具） |
| [`docs/HANDOVER-HK.md`](docs/HANDOVER-HK.md) | 技術交接文件 |

> 其餘開發用文檔（環境設定、變更紀錄、設計決定、待辦事項等）為內部筆記，不隨分享版一併提供。

## Getting Started

複製環境變數範本並填入真實 key（見 `.env.example` / `docs/SETUP.md`）：

```bash
cp .env.example .env.local      # 填 OPENROUTER_API_KEY、HF_TOKEN
npm install
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy && npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
