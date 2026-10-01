// Family 24 — 泡泡雲朵＋大字環繞商品（直式 9:16）
//
// 家族氣質：洗沐、清潔類的「空氣感」主視覺。整片淡灰藍底上堆滿柔邊白色泡泡雲，
// 上方品牌聯名列＋粗黑主標（後半段換淺藍色重點字）＋上下細線夾住的副標；
// 中間商品被四個細體大字（控油／沁爽／持久／去屑）圍住，後面一行白色襯線英文斜斜穿過，
// 右邊一條淺藍斜緞帶寫適用族群，左右兩顆透明泡泡各裝一個賣點，最下面是品名＋品項。
// 參考：洗髮泡泡小藍瓶聯名主視覺（2026-10-01 使用者提供，文案改成繁體中文、品牌換成佔位字）。
// 商品是示意圖；套用後換成自己的商品照、改文案。
import { L, DEG, PRODUCTS } from "./template-kit.mjs";

const W = 1200, H = 2134;
const SERIF = "'Noto Serif TC',serif";
const INK = "#16181d";
const NAVY = "#2b3550";
const MIST = "#7f9db5";      // 後排大字的霧藍
const SKY = "#9ccbe2";       // 主標重點字的淺藍
const VIOLET = "#7d6fd1";

// 一團泡泡雲：幾顆不同大小的柔邊白橢圓疊在一起，底下墊一點點灰藍讓它有厚度
const cloud = (cx, cy, s, over = {}) => [
  L.shape("泡泡陰影", cx - s * 0.62, cy - s * 0.18, s * 1.3, s * 0.64, { kind: "ellipse", fill: "#d5dce7", softness: 0.95 }, { opacity: 0.4, ...over }),
  L.shape("泡泡雲", cx - s * 0.7, cy - s * 0.42, s * 0.9, s * 0.62, { kind: "ellipse", fill: "#ffffff", softness: 0.7 }, over),
  L.shape("泡泡雲", cx - s * 0.18, cy - s * 0.5, s * 0.84, s * 0.66, { kind: "ellipse", fill: "#ffffff", softness: 0.72 }, over),
  L.shape("泡泡雲", cx - s * 0.48, cy - s * 0.2, s * 1.0, s * 0.5, { kind: "ellipse", fill: "#ffffff", softness: 0.75 }, over),
];
// 透明泡泡裡裝一個賣點：上一行彩色、下一行黑色
const bubbleNote = (cx, cy, top, bottom, color) => [
  L.shape("透明泡泡", cx - 150, cy - 130, 300, 260, { kind: "ellipse", fill: "#ffffff", stroke: "#ffffff", strokeWidth: 4 }, { opacity: 0.35 }),
  L.shape("泡泡高光", cx - 96, cy - 104, 70, 40, { kind: "ellipse", fill: "#ffffff", softness: 0.6 }, { opacity: 0.9 }),
  L.text("賣點", top, cx - 170, cy - 64, 340, 66, { fontSize: 50, color, fontWeight: 800 }),
  L.text("賣點小字", bottom, cx - 170, cy + 4, 340, 62, { fontSize: 46, color: INK, fontWeight: 600 }),
];

export const FAMILY = [
  {
    art: {
      name: "泡泡雲朵｜大字環繞商品（直式長圖）",
      family: "foam-cloud",
      composition: "product-center-four-word-orbit",
      docW: W, docH: H,
      visualHierarchy: ["product", "headline", "orbit-words", "subhead", "selling-points", "product-name"],
      visualWeight: { product: 10, headline: 9, "orbit-words": 7, subhead: 5, "selling-points": 4, "product-name": 5 },
      readingDirection: "top→center→bottom",
      negativeSpace: 0.3,
      rationale:
        "整片柔軟的泡泡雲把「洗得很綿密、有空氣感」直接畫出來；粗黑主標接淺藍重點字，一眼記住品項名。中間商品被四個細體大字圍成一圈，像功效環繞著產品，"
        + "後面斜穿過的白色英文增加層次但不搶字；淺藍斜緞帶點出適用族群，左右透明泡泡各裝一個賣點，最下面品名收尾，視線從上到下一路走完。",
      recommendedFor: "洗髮、沐浴、洗面乳等清潔類商品的直式長圖（限動、商品詳情頁）",
    },
    layers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: "#eef1f6", gradient: { axis: "vertical", from: "#e9edf3", to: "#f6f7fa" } }, { type: "background", locked: true }),
      // 滿版泡泡雲（上方、兩側、中間後面）
      ...cloud(160, 120, 520), ...cloud(1080, 260, 560), ...cloud(80, 760, 480), ...cloud(1150, 980, 520),
      ...cloud(600, 1180, 640, { opacity: 0.85 }), ...cloud(140, 1560, 560), ...cloud(1090, 1700, 600),

      // 上方：品牌 × 通路
      L.text("品牌", "BRAND", 300, 96, 300, 96, { fontSize: 72, color: "#7a5a2f", fontWeight: 700, fontFamily: SERIF }),
      L.text("聯名符號", "×", 590, 100, 60, 90, { fontSize: 64, color: "#555b66", fontWeight: 400 }),
      L.shape("通路底", 650, 112, 260, 72, { kind: "rect", fill: "#11a39a", radius: 36 }),
      L.text("通路", "通路名稱", 650, 112, 260, 72, { fontSize: 40, color: "#ffffff", fontWeight: 800 }),

      // 主標：粗黑字＋淺藍重點字
      L.text("主標", "沁爽淨屑", 120, 310, 560, 160, { fontSize: 132, color: INK, fontWeight: 900, align: "left" }),
      L.text("主標重點字", "小藍瓶", 680, 310, 420, 160, { fontSize: 132, color: SKY, fontWeight: 900, align: "left" }),
      // 副標：上下細線夾住
      L.shape("細線", 250, 500, 700, 3, { kind: "rect", fill: "#2b2f38" }),
      L.text("副標", "頭屑防護盾　洗出空氣感", 250, 512, 700, 100, { fontSize: 60, color: "#2b2f38", fontWeight: 500 }),
      L.shape("細線", 250, 624, 700, 3, { kind: "rect", fill: "#2b2f38" }),

      // 商品後面：霧藍細體大字＋斜穿過的白色襯線英文
      L.text("環繞大字", "控油", 40, 860, 420, 230, { fontSize: 200, color: MIST, fontWeight: 300 }),
      L.text("環繞大字", "沁爽", 760, 820, 420, 230, { fontSize: 200, color: MIST, fontWeight: 300 }),
      L.text("英文襯字", "AMINO ACID SHAMPOO", 100, 1090, 1000, 120, {
        fontSize: 92, color: "#ffffff", fontWeight: 700, fontFamily: SERIF, rotation: -4 * DEG,
        shadow: { color: "#7fb3cf", opacity: 0.55, distance: 4, blur: 10, angle: 90 },
      }),

      // 商品（換成你的商品）＋底下的泡泡
      L.shape("商品陰影", 380, 1700, 440, 70, { kind: "ellipse", fill: "#8796ab", softness: 0.9 }, { opacity: 0.25 }),
      L.shape("示意商品（換成你的商品，或直接刪掉）", 340, 690, 520, Math.round(520 * 939 / 437), { kind: "rect" }, { image: PRODUCTS.blue, shape: undefined }),
      ...cloud(600, 1760, 760),

      // 商品前面：深藍細體大字
      L.text("環繞大字", "持久", 40, 1250, 480, 260, { fontSize: 250, color: NAVY, fontWeight: 300 }),
      L.text("環繞大字", "去屑", 700, 1150, 480, 260, { fontSize: 250, color: NAVY, fontWeight: 300 }),
      // 適用族群的淺藍斜緞帶
      L.shape("緞帶", 760, 1400, 460, 90, { kind: "rect", fill: "#cfe8f5" }, { rotation: -6 * DEG, opacity: 0.95 }),
      L.text("適用族群", "頭癢、頭屑族群適用", 770, 1400, 440, 90, { fontSize: 44, color: NAVY, fontWeight: 700, rotation: -6 * DEG }),

      // 左右透明泡泡裡的賣點
      ...bubbleNote(250, 1620, "生物胺基酸", "精粹", VIOLET),
      ...bubbleNote(960, 1610, "夜間呵護", "髮絲", "#5b6ad6"),

      // 最下面：品名＋品項
      L.text("品名", "品牌名－沁爽淨屑", 150, 1870, 900, 110, { fontSize: 84, color: INK, fontWeight: 800 }),
      L.text("品項", "胺基酸泡泡洗髮露", 200, 1980, 800, 80, { fontSize: 52, color: "#3b404a", fontWeight: 500 }),
    ],
  },
];
