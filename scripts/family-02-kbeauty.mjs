// Family 02 — K-Beauty 成分實證
//
// 家族氣質：韓系保養詳情頁。畫面靠「細節密度」撐起來而不是靠大色塊——
// 編號賣點、＋膠囊標籤、引導線、光環、質地樣本、極小號註腳，
// 每一張都要有三層以上的字級與至少兩種輔助裝置。
//
// 這是回應「有比較好但不夠豐富，少了小細節」那次回饋：上一個家族結構對了
// 但詞彙太少，所以乾淨卻空。
import { L, S, DEG, product, PRODUCTS } from "./template-kit.mjs";
import {
  numberedClaim, claimGuide, plusPill, leaderLine, haloRing,
  textureDabs, footnotes, cornerFlag, giftInset, priceBlock,
  carouselDots, plusMarks, brandLockup,
} from "./template-details.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";

export const FAMILY = [
  {
    art: {
      name: "K-Beauty｜成分編號實證",
      family: "ecommerce",
      composition: "asymmetrical-hero",
      visualHierarchy: ["copy", "product", "decoration"],
      visualWeight: { copy: 9, product: 7, decoration: 3, badge: 2 },
      readingDirection: "top-left→bottom-right",
      negativeSpace: 0.42,
      rationale:
        "三組編號賣點沿著一條垂直引導線由上往下排，形成左側的閱讀節奏；商品從右下斜切進來壓住這條線的尾端，讓視線在最後一個賣點上被商品接住。註腳與輪播圓點把版面收在底部。",
      recommendedFor: "成分訴求、功效實證頁",
    },
    layers: () => [
      L.bg("#fbfbf7", "#f2f3ec"),
      // 商品後面墊一團柔邊色塊：參考圖裡那些液體團塊，沒有它商品會像貼上去的
      L.shape("色團", 640, 330, 520, 520, { kind: "ellipse", fill: "#e8f0b8", softness: 0.85 }, { opacity: 0.85 }),
      L.shape("色團2", 880, 640, 300, 300, { kind: "ellipse", fill: "#dbe89a", softness: 0.85 }, { opacity: 0.7 }),
      L.text("品名英", "Green Tangerine", 90, 90, 700, 40, {
        fontSize: 24, align: "left", color: "#8a8a7d", fontFamily: SANS, fontWeight: 400,
      }),
      L.text("品名", "Vita C 亮白精華 Alpha", 90, 130, 700, 50, {
        fontSize: 30, align: "left", color: "#2c2c26", fontFamily: SANS,
      }),
      ...claimGuide(106, 300, 520),
      ...numberedClaim(1, "美白活性成分 25% UP", "菸鹼醯胺 50,000ppm", 90, 300),
      ...numberedClaim(2, "VITA-C 加強護理", "維他命 C alpha 複合物", 90, 480),
      ...numberedClaim(3, "青橘萃取物", "有效成分含量提升 78%", 90, 660),
      ...product(PRODUCTS.green, 620, 300, 520, 640, { rotation: 14 * DEG, shadow: false }),
      ...textureDabs(700, 900, "#d8e6a8", 3),
      ...footnotes([
        "成分含量為自社既有產品比較之相對值。",
        "有效成分含量依原料批次略有差異。",
      ], 90, 1000, 700),
      ...brandLockup("goodal", 0, 1080, S, "#6f6f62"),
      ...carouselDots(4, 2, S / 2, 1140, "#b5b5a6"),
    ],
  },
  {
    art: {
      name: "K-Beauty｜環繞標籤",
      family: "ecommerce",
      composition: "product-floating",
      visualHierarchy: ["product", "badge", "headline"],
      visualWeight: { product: 10, badge: 6, headline: 5, decoration: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.30,
      rationale:
        "商品浮在正中央，五個＋膠囊標籤沿著一個看不見的圓圈環繞它，每個標籤都用一條短引線指回商品；視線從中心往外擴散再回到中心，形成閉環而不是由上往下讀。",
      recommendedFor: "多賣點一次說完、清潔／面膜類",
    },
    layers: () => [
      L.bg("#f6f0fb", "#e6dcf6"),
      L.text("主標", "現在開始", 0, 80, S, 90, { fontSize: 76, color: "#2b2440", fontFamily: SANS }),
      L.text("主標2", "真正救回皮膚的清潔", 0, 175, S, 90, {
        fontSize: 76, color: "#7a5bd6", fontFamily: SANS,
      }),
      L.shape("光暈", 300, 400, 620, 620, { kind: "ellipse", fill: "#ffffff", softness: 0.9 }, { opacity: 0.6 }),
      ...haloRing(600, 700, 330, "#cbbcf0", 1),
      ...haloRing(600, 700, 392, "#d9cff5", 1),
      ...product(PRODUCTS.white, 470, 400, 280, 580, { rotation: -8 * DEG, shadow: false }),
      ...plusPill("毛孔・彈力改善", 60, 470, 340),
      ...leaderLine(400, 503, 90, 8),
      ...plusPill("5-in-1 深層清潔", 790, 400, 330),
      ...leaderLine(730, 470, 80, -24),
      ...plusPill("改善緊繃", 800, 570, 260),
      ...leaderLine(750, 605, 60, 4),
      ...plusPill("粗糙膚觸改善", 60, 650, 320),
      ...leaderLine(390, 683, 90, -6),
      ...plusPill("低刺激測試完成", 60, 830, 330),
      ...plusMarks([[560, 1040, 26], [600, 1090, 20], [640, 1140, 16]]),
      L.shape("底帶", 0, 1060, S, 140, { kind: "rect", fill: "#3b2f6b" }),
      L.text("底帶字", "5-in-1 DEEP CLEANSING", 0, 1095, S, 60, {
        fontSize: 34, color: "#e4dcf8", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.3 },
      }),
      ...footnotes(["低刺激測試由外部機構執行，結果因人而異。"], 60, 1000, 520),
    ],
  },
  {
    art: {
      name: "K-Beauty｜光環單品",
      family: "ecommerce",
      composition: "centered-hero",
      visualHierarchy: ["product", "copy", "decoration"],
      visualWeight: { product: 10, copy: 5, decoration: 3 },
      readingDirection: "top→bottom",
      negativeSpace: 0.50,
      rationale:
        "商品直立置中並被一圈細光環托住，三組標籤左右分置但高度錯開，避免對稱造成的呆板；底部的質地樣本把畫面重心往下壓，讓上方的留白變成刻意的呼吸區。",
      recommendedFor: "單品成分說明、眼霜／精華",
    },
    layers: () => [
      L.bg("#f7f7f9", "#e3e3e8"),
      ...haloRing(620, 600, 310, "#9f95c9", 2),
      ...product(PRODUCTS.pink, 430, 330, 380, 520, { shadow: false }),
      ...plusPill("色素沉著型", 90, 400, 300, { fill: "#efe7fb", badge: "#7a5bd6", fg: "#4a3b73" }),
      L.text("成分1", "菸鹼醯胺 5%\n穀胱甘肽", 100, 480, 320, 100, {
        fontSize: 28, align: "left", color: "#3d3550", fontFamily: SANS, fontWeight: 400,
      }),
      ...plusPill("結構型", 800, 500, 260, { fill: "#efe7fb", badge: "#7a5bd6", fg: "#4a3b73" }),
      L.text("成分2", "黃金小球藻\n胜肽", 810, 580, 300, 100, {
        fontSize: 28, align: "left", color: "#3d3550", fontFamily: SANS, fontWeight: 400,
      }),
      ...plusPill("血管型", 90, 720, 220, { fill: "#efe7fb", badge: "#7a5bd6", fg: "#4a3b73" }),
      L.text("成分3", "咖啡因 2%", 100, 800, 300, 60, {
        fontSize: 28, align: "left", color: "#3d3550", fontFamily: SANS, fontWeight: 400,
      }),
      ...haloRing(620, 600, 368, "#c3bbdd", 1),
      // 長條塗抹樣本：比圓點更像真的膏體，也把底部的空撐起來
      ...[0, 1, 2].map((i) =>
        L.shape(`塗抹${i}`, 120 + i * 90, 1000 + i * 26, 210 - i * 30, 26,
          { kind: "ellipse", fill: "#d4c6f0" }, { rotation: (-14 + i * 5) * DEG, opacity: 0.9 })),
      ...textureDabs(760, 1030, "#d9cdf2", 3),
      L.shape("底說明底", 0, 1090, S, 110, { kind: "rect", fill: "#e9e6f2" }),
      L.text("底標", "3 TYPES OF DARK CIRCLE", 0, 1120, S, 44, {
        fontSize: 22, color: "#8d85a8", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.35 },
      }),
    ],
  },
  {
    art: {
      name: "K-Beauty｜檔期組合",
      family: "promotional",
      composition: "dense-information",
      visualHierarchy: ["price", "product", "badge"],
      visualWeight: { price: 10, product: 7, badge: 5, copy: 2 },
      readingDirection: "z-path",
      negativeSpace: 0.29,
      rationale:
        "左上角旗把檔期名稱斜切進畫面，商品放在中央白卡上保持乾淨，右下用整塊深色價格區把視線拉到最後；三個角各有一個重量元素，眼睛走的是 Z 字而不是由上到下。",
      recommendedFor: "檔期促銷、買幾送幾",
    },
    layers: () => [
      L.bg("#ffffff", "#f4f7fb"),
      L.shape("商品卡", 80, 210, 700, 620, { kind: "rect", fill: "#ffffff", radius: 8 }),
      L.shape("商品卡邊", 80, 210, 700, 620, { kind: "rect", fill: "none", stroke: "#e3e8ef", strokeWidth: 2, radius: 8 }),
      ...product(PRODUCTS.amber, 170, 260, 240, 520, { shadow: false }),
      ...product(PRODUCTS.green, 450, 300, 230, 480, { shadow: false }),
      ...cornerFlag("夏日購物趣", "7.7 限量好康"),
      L.shape("贈底", 820, 300, 300, 440, { kind: "rect", fill: "#eef4fc", radius: 6 }),
      ...giftInset("高效防曬乳 10ML 隨身瓶", 820, 300, 300, 440),
      ...product(PRODUCTS.white, 880, 350, 180, 300, { shadow: false }),
      L.shape("價格區", 0, 880, S, 320, { kind: "rect", fill: "#1e6fd9", gradient: { axis: "vertical", from: "#2a7ce6", to: "#1558b0" } }),
      L.text("價格標籤", "特惠", 90, 920, 200, 60, { fontSize: 40, align: "left", color: "#cfe0f7", fontFamily: SANS }),
      ...priceBlock("$2299", "$5309", 700, 910),
      L.text("買幾送幾", "買 2 送 1", 90, 1000, 520, 140, {
        fontSize: 108, align: "left", color: "#ffffff", fontFamily: SANS,
      }),
    ],
  },
  {
    art: {
      name: "K-Beauty｜實證數據條",
      family: "ecommerce",
      composition: "split-screen",
      visualHierarchy: ["copy", "product", "badge"],
      visualWeight: { copy: 9, product: 6, badge: 4, decoration: 1 },
      readingDirection: "left→right",
      negativeSpace: 0.24,
      rationale:
        "畫面左右切開，左側是三條等高的數據橫條、右側是整支商品，兩邊用同一條水平基準線對齊；數據條的重複節奏與商品的單一垂直形成對比，右側的留白替左側的密集資訊留出呼吸。",
      recommendedFor: "臨床數據、功效實證",
    },
    layers: () => [
      L.bg("#f1f6f3", "#e2ece6"),
      L.shape("右半", 620, 0, 580, S, { kind: "rect", fill: "#0f3b2a", gradient: { axis: "vertical", from: "#175c42", to: "#0c2f22" } }),
      L.text("主標", "7 天有感", 70, 120, 520, 110, {
        fontSize: 92, align: "left", color: "#12362a", fontFamily: SANS,
      }),
      L.text("副標", "CLINICALLY PROVEN", 70, 240, 520, 44, {
        fontSize: 22, align: "left", color: "#5c8573", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.35 },
      }),
      ...[["粉刺數量", "-39.38%", 360], ["痘痘改善", "-75.00%", 520], ["泛紅面積", "-52.10%", 680]]
        .flatMap(([label, value, y], i) => [
          L.shape(`條底${i}`, 70, y, 500, 110, { kind: "rect", fill: "#ffffff", radius: 6 }),
          L.text(`條標${i}`, label, 92, y + 30, 200, 56, {
            fontSize: 32, align: "left", color: "#12362a", fontFamily: SANS,
          }),
          L.text(`條值${i}`, value, 300, y + 22, 250, 70, {
            fontSize: 50, align: "right", color: "#1f7a52", fontFamily: SANS,
          }),
          L.text(`條註${i}`, `[${i + 1}]`, 540, y + 12, 40, 28, {
            fontSize: 16, color: "#8aa99a", fontFamily: SANS, fontWeight: 400,
          }),
        ]),
      ...product(PRODUCTS.green, 700, 330, 420, 560, { shadow: false }),
      ...haloRing(910, 610, 250, "#2f6b52", 1),
      ...footnotes([
        "資料來源：外部皮膚科機構臨床評估，32 名受試者連續使用 7 天。",
        "受試者自我評估問卷結果，個人感受可能不同。",
      ], 70, 860, 500, "#6b8d7d"),
      L.shape("底條", 0, 1060, S, 140, { kind: "rect", fill: "#0c2f22" }),
      L.text("底條字", "14 天完整療程・每日兩次", 0, 1095, S, 60, {
        fontSize: 36, color: "#cfe4d9", fontFamily: SANS, fontWeight: 400,
      }),
      // 貼齊右緣、通到底條：原本浮在半空像誤放的色塊
      L.shape("側標底", 1160, 0, 40, 1060, { kind: "rect", fill: "#1f7a52" }),
      ...carouselDots(5, 1, 910, 1010, "#7fb39a"),
    ],
  },
];

export { S };
