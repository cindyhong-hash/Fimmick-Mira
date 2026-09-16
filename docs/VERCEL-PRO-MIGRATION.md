================================================================================
 marketing-tool（taiwan-image-process）Vercel 環境變數清單
 產生日期：2026-09-09   更新：2026-09-15（補 ⑧–⑬ 節）
 來源：①–⑦ 掃描 main 分支程式碼（a23ba30）；⑧–⑬ 為 2026-09-15 實測補充
 用途：搬到公司 Pro 帳號時照這張表逐一設定
================================================================================

【怎麼拿到「值」】

 ⚠️ 2026-09-16 實測更正：`vercel env pull` 對這個專案「拿不到值」。
 舊專案的 17 個變數全是 Sensitive 型態，Vercel 設計上就不可讀回，
 拉下來只會是 "[SENSITIVE]" 佔位符。這條路行不通，別浪費時間。

 ── 實際可行的四個來源 ──────────────────────────────────

 1. 本機 ~/Desktop/marketing-tool/.env.local（實測最有用）
    已經有：BLOB_READ_WRITE_TOKEN / OPENROUTER_API_KEY / FAL_KEY
            / RAPIDAPI_KEY / RAPIDAPI_KEY_IG / RAPIDAPI_KEY_IG2
    注意這個檔的 DATABASE_URL 是本機 file: 版，不是正式庫，別直接抄。

 2. Turso CLI（資料庫那兩個）

        turso db show marketing-tool --url      # 位址，非機密
        turso db tokens create marketing-tool   # 直接發新的，不用找回舊的

    ⚠️ 不要加 --expiration，正式站用會到期後整站連不上資料庫。

 3. 外部服務後台重發：OpenRouter / fal.ai / RapidAPI 都可以重新產生。

 4. SITE_PASSWORD 由你自己定，新舊站可以不一樣。

 ── 怎麼確認 Blob token 沒拿錯 store ────────────────────

 填錯 store 圖片會全壞。store id 是公開資訊（就印在圖片網址裡），可安全比對：

     # token 前綴裡的 store id
     grep '^BLOB_READ_WRITE_TOKEN=' .env.local \
       | sed -E 's/^[^=]+=//; s/"//g; s/^vercel_blob_rw_([A-Za-z0-9]+)_.*/\1/'

     # 實際圖片網址裡的 store id
     strings prisma/dev.db \
       | grep -oE 'https://[a-zA-Z0-9]+\.public\.blob\.vercel-storage\.com' \
       | sed -E 's#https://([^.]+)\..*#\1#' | sort | uniq -c

     兩者比對（大小寫不敏感）。2026-09-16 實測結果：v16uryj9gfmy6re4 ✅


================================================================================
 ① 必填 —— 沒設就會壞
================================================================================

 變數                        用途                          沒設會怎樣
 --------------------------  ----------------------------  --------------------
 DATABASE_URL                Turso 資料庫連線              退回本機 sqlite，
                             (libsql://...)                線上等於沒有資料

 DATABASE_AUTH_TOKEN         Turso 存取權杖                連不上資料庫

 BLOB_READ_WRITE_TOKEN       Vercel Blob（所有圖片）       圖片上傳/顯示全壞

 OPENROUTER_API_KEY          所有文字與視覺 AI             靈感中心、文案、
                             （靈感/文案/產品視覺分析）    產品分析全失效

 FAL_KEY                     生圖／去背／產品套圖          生不出任何圖

 SITE_PASSWORD               網站密碼閘                    ★ production 沒設會
                                                           直接回 503
                                                           「付費功能尚未完成
                                                           安全設定」——整站不能用
                                                           （這是 fail-closed
                                                           設計，故意的）

 ⚠️ SITE_PASSWORD 這條特別容易忘。上次上線就是漏了這個，正式站整個 503。


================================================================================
 ② 功能性 —— 沒設不會壞，但該功能會靜默降級
================================================================================

 變數                  用途                        沒設會怎樣
 --------------------  --------------------------  ------------------------
 RAPIDAPI_KEY_IG2      靈感中心「正在升溫」的      機會卡自動降級成
                       IG 真實貼文訊號             「當季主題」，來源顯示
                       (instagram-scraper-         「台灣 N 月季節脈絡」。
                        stable-api)                功能正常，但沒有真實熱度。

 RAPIDAPI_KEY_IG       IG 舊來源（備援）           IG2 沒設時才會用到

 RAPIDAPI_KEY          Threads 趨勢（目前失效）    目前訂閱已過期，
                                                   provider 已下架不啟用


================================================================================
 ③ 模型覆寫 —— 全部都有程式預設值，通常不用設
================================================================================

 只有想換模型時才需要設。以下是程式裡的預設值：

   OPENROUTER_TEXT_MODEL             = openai/gpt-4o-mini
   OPENROUTER_VISION_MODEL           = openai/gpt-5.4-nano
   OPENROUTER_IMAGE_MODEL            = openai/gpt-5.4-image-2
   OPENROUTER_IMAGE_MODEL_FALLBACK   = openai/gpt-5-image-mini

   FAL_FLUX2_MODEL         = fal-ai/flux-2-pro
   FAL_FLUX2_EDIT_MODEL    = fal-ai/flux-2-pro/edit
   FAL_RECRAFT_MODEL       = fal-ai/recraft/v3/text-to-image
   FAL_NANO_T2I_MODEL      = fal-ai/nano-banana
   FAL_EDIT_MODEL          = fal-ai/nano-banana/edit
   FAL_QWEN_EDIT_MODEL     = fal-ai/qwen-image-edit-plus
   FAL_SEEDREAM_EDIT_MODEL = fal-ai/bytedance/seedream/v4.5/edit
   FAL_REMBG_MODEL         = fal-ai/birefnet          （去背）
   FAL_SAM2_MODEL          = fal-ai/sam2/image        （分割）
   FAL_UPSCALE_MODEL       = fal-ai/clarity-upscaler  （放大）
   HF_IMAGE_MODEL          = black-forest-labs/FLUX.1-schnell


================================================================================
 ④ 目前沒在用 —— 新專案可以不設
================================================================================

   GEN_PROVIDER          生成 provider 切換（inapp / n8n）
   N8N_WEBHOOK_URL       n8n 整合
   HF_TOKEN              HuggingFace 後備生圖
   OPENAI_API_KEY        OpenAI 直連（已改走 OpenRouter）
   POLLINATIONS_TOKEN    Pollinations 後備生圖
   TREND_SIGNALS_MOCK    測試用假趨勢訊號（開發用）
   FONTCONFIG_FILE       字型設定路徑（執行環境用）
   FORCE_VT / ML_MASK_PRIMARY   Magic Layers 內部調校旗標

 註：舊版清單裡的 ANTHROPIC_API_KEY 已經不用了（視覺分析改走 OpenRouter）。


================================================================================
 ⑤ 環境變數以外，別忘記
================================================================================

 [ ] Git：連結 GitHub repo，production 分支設成 main
 [ ] Region：hnd1（東京，跟 Turso 同區）— vercel.json 已寫好，自動套
 [ ] Framework：Next.js（自動偵測）
 [ ] 自訂網域（如果有）重新綁

 【Blob 特別注意】🔴
   新專案預設會建「自己的新 Blob store」，但現有圖片全都在舊 store。
   直接用新 store → 舊圖網址全部失效、圖全破。
   建議：新專案沿用「舊 Blob store 的 token」，圖不用搬、網址不變。

 【Turso】🟡
   沿用同一個 DB 最簡單，把 DATABASE_URL + DATABASE_AUTH_TOKEN 複製過去即可。
   要開新 DB 的話得另外套 schema + 搬資料，麻煩很多。


================================================================================
 ⑥ 搬到 Pro 之後可以放寬的設定
================================================================================

 Hobby 的函式時長上限是 300 秒，所以現在程式刻意壓在底下：

   src/app/api/products/[productId]/image-set/route.ts        maxDuration = 290
   src/app/api/library/images/[id]/regenerate/route.ts        maxDuration = 290
   src/lib/products/image-set-orchestrator.ts                 內部 deadline 270s

 搬到 Pro 並開啟 Fluid Compute 後可以調到 800s，
 一次生 5 張產品套圖就不會被中途砍斷。


================================================================================
 ⑦ 部署後驗證
================================================================================

 [ ] 能輸入密碼進站、能切換品牌
 [ ] 素材庫圖片、過往貼文圖都顯示正常（Blob 沿用的話應該正常）
 [ ] 建立圖文（單圖／多圖）能生成
 [ ] 產品套圖：建立產品 → 去背 → AI 建立商品套圖能跑完
 [ ] 靈感中心能載入，且「正在升溫」那張卡的來源顯示
     「IG 近期討論（N 個訊號）」而不是「台灣 N 月季節脈絡」
     （後者代表 RAPIDAPI_KEY_IG2 沒吃到）

 ※ Vercel 加完環境變數要「重新部署一次」才會生效。

================================================================================


================================================================================
 ⑧ 🔴 同一個 repo 現在接了「兩個」Vercel 專案（2026-09-15 查證）
================================================================================

 GitHub deployments API 會同時列出：

   Production – taiwan-image-process        ← 網址 404，被 Vercel 登入保護擋著
   Production – taiwan-image-process-x5hn   ← ★ 這個才是正式站

 而且 **x5hn 晚約一分鐘才建立部署**。
 推完馬上查很容易看到前者 success 就以為上線了，其實正式站還是舊版。

 [ ] 搬到 Pro 時，順便把舊的 taiwan-image-process 專案「斷開 GitHub 連結」
     否則加上 Pro 專案會變成推一次跑三次建置，之後分不清哪個是線上

 ⚠️ 斷開連結 ≠ 刪除。Blob store 還要靠舊帳號，見 ⑨。


================================================================================
 ⑨ 🔴 Blob 綁帳號 —— 這是唯一會弄丟資料的地方
================================================================================

 src/lib/storage.ts:31 存回資料庫的是「完整網址」：

     https://xxx.public.blob.vercel-storage.com/...

 也就是說，**舊圖的網址永遠指向舊帳號的 store**。

 ── 兩種做法 ──────────────────────────────────────────────

 A. 新專案沿用「舊 Blob store 的 token」（⑤ 節的建議）
    ✅ 圖不用搬、網址不變、零風險
    ⚠️ 但 store 的擁有權與帳單仍在個人帳號
       → 人離職 / 帳號停用，公司會失去所有圖片
       → 適合當「過渡期」做法，不適合長期

 B. 新專案用自己的新 store
    ✅ 擁有權乾淨，長期正確
    ⚠️ 新圖進新 store、舊圖留舊 store（兩邊都是絕對網址，混著能跑）
    ⚠️ **舊帳號的 store 在舊圖搬完之前絕對不能刪**

 ── 建議 ──────────────────────────────────────────────────

 先 A 後 B：搬家當下用 A（最快、零風險），之後再寫腳本把舊圖複製到
 新 store 並回寫資料庫網址，切成 B。B 這步可以延後，不擋搬家。

 [ ] 不論哪種，**個人帳號的 Blob store 在確認前都不要刪**
 [ ] Blob store 是「帳號層級」資源（Storage 分頁），不是專案的。
     刪專案理論上不會刪 store，但動手前務必先在後台確認。


================================================================================
 ⑩ 免密碼的部署驗證法
================================================================================

 全站有密碼閘，但**密碼閘那頁本身不用登入就看得到**，可以拿來驗證：

     curl -s https://<新網址>/ | grep -o '<title>[^<]*</title>'
     → 應該回 <title>MIRA</title>（舊版是「行銷圖文工具」）

     curl -s -o /tmp/f.ico -w '%{size_download}\n' https://<新網址>/favicon.ico
     → 應該是 4711 bytes（舊的 Next 預設是 25931）

 這兩個一對就知道新版有沒有真的上去，不用輸密碼。


================================================================================
 ⑪ 換網域的時機
================================================================================

 SITE_PASSWORD 的「30 天免再輸」是綁網域的 cookie。
 **換一次網址 = 所有人重輸一次密碼。**

 所以不要先改成 mira.vercel.app、之後搬公司再改一次 —— 那是換兩次。

 建議順序：

   1. 辦 Pro、搬家、確認正常        ← 網址先維持 vercel.app 亂數名
   2. 全部穩定後，最後一次換網域     ← 只痛一次


================================================================================
 ⑫ 順便處理：RapidAPI key 輪替
================================================================================

 RAPIDAPI_KEY_IG / RAPIDAPI_KEY_IG2 兩把曾在截圖中以明文外洩，尚未輪替。

 [ ] 搬家設定新環境變數時，直接去 RapidAPI 後台重新產生，
     新專案填新的、舊的撤銷 —— 等於順手補掉這個洞，不用另外排時間


================================================================================
 ⑬ 與 Codex 進行中工作的交會點
================================================================================

 分支 codex/ad-layout-composition-plan 新增了 migration：

     prisma/migrations/20260915140000_add_product_image_sets

 搬 Vercel 與這件事**互不影響**（Turso 不綁 Vercel）。
 但那條分支要部署時：

 [ ] 先確認該 worktree 的 .env.local 指向本機而非正式 Turso
     （曾經指過正式站，migrate dev 偵測到 drift 可能提議 reset → 清掉真實資料）
 [ ] 先把 migration 套到正式 Turso，再部署程式

================================================================================
