// Family 14 — 關鍵字標籤圍繞商品（直式 4:5）
//
// 家族氣質：保養／洗護的「形容詞轟炸」貼文。實景照（白磁磚牆＋檯面）上，商品站在正中間，
// 左右兩邊散落一堆關鍵字標籤：黃色、白色、藍色三種膠囊輪流用，其中一兩個放大成白色方塊當重點；
// 上方兩行大標（關鍵字那三個字換成黑色），最下面一條藍→黃漸層帶放品牌＋品名。
// 參考：髮油品牌「今天的你自帶哪些關鍵字？」貼文（2026-09-29 使用者提供）。
// 背景照、髮油瓶都是 AI 生成的示意素材；套用後換成自己的商品、改關鍵字。
import { L, DEG } from "./template-kit.mjs";

const W = 1200, H = 1500;
const BLUE = "#3aa0e6";
const YELLOW = "#f5ea3a";
const INK = "#1a1a1a";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const BG = `${BLOB}1790665583542-4j28bgjka9c.jpg`;        // 1200×1500，檯面上緣約 y=1260
const BOTTLE = `${BLOB}1790665584260-0xbt6b7k1fb.png`;    // 564×1144，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const SOFT = { color: "#5f8fb8", opacity: 0.18, distance: 6, blur: 18, angle: 90 };

/** 一個關鍵字膠囊：底色三種（黃底黑字、白底藍字、藍底白字）。 */
function tag(x, y, w, h, text, tone, fs = 52) {
  const fill = tone === "yellow" ? YELLOW : tone === "blue" ? BLUE : "#ffffff";
  const color = tone === "yellow" ? INK : tone === "blue" ? "#ffffff" : BLUE;
  return [
    L.shape("關鍵字底", x, y, w, h, { kind: "rect", fill, radius: 20 }, { shadow: SOFT }),
    L.text("關鍵字", text, x, y, w, h, { fontSize: fs, color, fontWeight: 900 }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "關鍵字標籤｜商品置中＋標籤圍繞（直式）",
      family: "keyword-tags",
      composition: "product-center-tags-around",
      docW: W, docH: H,
      visualHierarchy: ["headline", "product", "hero-tags", "tags", "brand-bar"],
      visualWeight: { headline: 8, product: 9, "hero-tags": 7, tags: 5, "brand-bar": 4 },
      readingDirection: "top→center→around",
      negativeSpace: 0.18,
      rationale:
        "商品站在正中間當主角，關鍵字標籤像留言一樣散在兩側，一眼就是「大家都這樣形容它」；三種顏色的膠囊輪流用避免單調，「柔順」「好感度 UP」放大成白色方塊當重點。大標把「關鍵字」三個字換成黑色點題，底部漸層帶沿用商品的藍黃配色收尾。",
      recommendedFor: "保養、洗護、香氛的商品特色／形容詞整理",
    },
    layers: () => [
      image("背景照（換成你的照片）", BG, 0, 0, W, H, { type: "background", locked: true }),

      // 大標（「關鍵字」換成黑色）＋右上愛心對話框＋三個小點
      L.text("大標上", "今天的你", 200, 130, 800, 120, { fontSize: 112, color: "#4aa8e8", fontWeight: 900 }),
      L.text("大標下", "自帶哪些關鍵字？", 100, 250, 1000, 130, {
        fontSize: 112, color: "#4aa8e8", fontWeight: 900,
        runs: [{ start: 4, end: 7, color: INK }],
      }),
      L.shape("對話框", 990, 150, 130, 96, { kind: "ellipse", fill: "#ffffff", stroke: BLUE, strokeWidth: 5 }),
      L.icon("愛心", "heart", 1032, 176, 46, BLUE),
      ...[660, 790, 920].map((x) => L.shape("小點", x, 392, 14, 14, { kind: "ellipse", fill: "#4aa8e8" })),

      // 商品（站在檯面上）
      image("示意商品（換成你的商品，或直接刪掉）", BOTTLE, 403, 470, Math.round(800 * 564 / 1144), 800,
        { shadow: { color: "#3b6f99", opacity: 0.22, distance: 18, blur: 30, angle: 100 } }),

      // 左邊的標籤
      L.text("手寫小字", "luster", 120, 470, 200, 64, { fontSize: 46, color: BLUE, fontWeight: 700, rotation: -6 * DEG, fx: { italic: true } }),
      L.shape("手寫底線", 128, 530, 170, 4, { kind: "rect", fill: BLUE, radius: 2 }, { rotation: -6 * DEG }),
      ...tag(138, 552, 302, 90, "# 光澤感", "yellow"),
      L.shape("重點方塊", 82, 680, 330, 200, { kind: "rect", fill: "#ffffff", radius: 28 }, { shadow: SOFT }),
      L.text("重點字", "柔順", 82, 680, 330, 200, { fontSize: 140, color: BLUE, fontWeight: 900 }),
      L.icon("閃光", "sparkle", 380, 660, 54, "#f2d51c"),
      L.icon("閃光", "sparkle", 396, 726, 34, "#f2d51c"),
      L.icon("小花", "spring", 64, 918, 70, "#f2d51c"),
      ...tag(130, 930, 290, 90, "# 香香的", "white"),
      L.icon("愛心", "heart", 316, 1046, 34, "#f2d51c"),
      L.icon("愛心", "heart", 348, 1030, 26, "#f2d51c"),
      ...tag(106, 1094, 320, 90, "# 好想靠近", "white"),

      // 右邊的標籤
      L.icon("星星", "sparkle", 1062, 506, 40, "#f2d51c"),
      ...tag(774, 540, 330, 86, "# 仙氣滿滿", "white"),
      ...tag(782, 676, 280, 86, "# 精緻感", "blue"),
      L.icon("星星", "sparkle", 1076, 700, 30, BLUE),
      L.shape("重點方塊", 812, 812, 324, 190, { kind: "rect", fill: "#ffffff", radius: 28 }, { shadow: SOFT }),
      L.text("重點字", "好感度", 812, 820, 324, 100, { fontSize: 88, color: BLUE, fontWeight: 900 }),
      L.text("重點字", "UP", 832, 912, 110, 80, { fontSize: 70, color: BLUE, fontWeight: 900, align: "left" }),
      L.icon("愛心", "heart", 948, 930, 44, BLUE),
      L.icon("愛心", "heart", 1000, 930, 44, "#f2d51c"),
      L.icon("愛心", "heart", 1052, 930, 44, BLUE),
      L.icon("閃光", "sparkle", 1086, 1022, 44, BLUE),
      ...tag(846, 1048, 272, 90, "# 不毛躁", "yellow"),

      // 最下面：藍→黃漸層帶＋品牌＋品名
      L.shape("品牌帶", 0, 1320, W, 180, { kind: "rect", fill: "#58b5e8", gradient: { axis: "horizontal", from: "#58b5e8", to: "#f0e25a" } }),
      L.shape("品牌圓標", 110, 1370, 84, 84, { kind: "ellipse", fill: "none", stroke: "#ffffff", strokeWidth: 4 }),
      L.text("品牌字首", "B", 110, 1370, 84, 84, { fontSize: 44, color: "#ffffff", fontWeight: 500 }),
      L.text("品牌", "brand", 214, 1368, 220, 88, { fontSize: 68, color: "#ffffff", fontWeight: 400, align: "left" }),
      L.text("品名", "商品名稱・胺基酸髮油", 450, 1372, 680, 80, { fontSize: 54, color: "#ffffff", fontWeight: 900, align: "left" }),
    ],
  },
];
