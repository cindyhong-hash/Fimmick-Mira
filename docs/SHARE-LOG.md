# 分享進度 SHARE-LOG（內部，唔會分享俾老闆）

> 每次用 `scripts/sync-share.sh "備註"` 分享去老闆 testing repo，會自動喺下面記一行。
> 老闆 repo 嘅 main = 對應下面最新嗰行嘅 `main@<sha>`（只含程式碼 + 用戶指南）。
> 內部文檔（FEATURE_LOG / DECISIONS / CHECKLIST / FUNCTIONS / AI-ENGINES / DEMO …）**唔分享**，只留俾自己。

## ⚠️ 部署注意（決定咗：先 push code，URL 遲啲再做）
本 app 寫圖去本機 `public/uploads/` + 用 SQLite `prisma/dev.db` →
- **Vercel 部署唔到**（serverless 檔案系統唯讀/即棄，生成圖同 DB 唔會存）。
- 要 URL 俾老闆嘅可行路：
  - **本機 + Cloudflare Tunnel**（免費、0 改 code、機開住先用）—— demo/短期最快。
  - **Render / Railway**（~US$6/月，持久 disk、always-on）—— code 唔使改。
  - **改雲（Supabase/Neon storage+Postgres）→ 先上到 Vercel**（= backlog #1，工程量中～大）。

## 已分享版本
<!-- script 會 append 喺呢度下面 -->
- 2026-06-18 · main@66e457b · 初次分享 market-tool-demo
- 2026-06-18 · main@0707c94 · 加 Setup 安裝指南，老闆 clone 後跟 GUIDE 就可以起動
- 2026-06-18 · main@2d67a98 · CLAUDE.md 加 demo sync 規矩（內部）；GUIDE 加 Setup 章節
- 2026-06-18 · main@eaf162d · GUIDE 補 prisma generate 步驟（setup 必要）
