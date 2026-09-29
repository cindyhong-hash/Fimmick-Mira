// Family 09 — 三步驟（人物主視覺＋三張步驟照）
//
// 家族氣質：保養／口腔用品的「使用方法」貼文。上半部一張大人物照，底部漸層淡入品牌淺紫，
// 大標壓在交界處（「3」用黃色襯線字跳出來）；下半部一條微斜的白帶放三張步驟照卡片，最底一條紫帶放品牌名。
// 參考：牙膏「終結不良口氣 自信開口 3 步驟」貼文（2026-09-29 使用者提供）。
// 人物照、步驟照、牙膏都是 AI 生成的示意素材；套用後換成自己的照片、商品，改步驟文字。
import { L, S, DEG } from "./template-kit.mjs";

const SERIF = "'Noto Serif TC',serif";
const INK = "#3b2f6b";
const YELLOW = "#ffe94a";
const LAV = "#c6bde6";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const HERO = `${BLOB}1790649280734-ci8ch0aen96.jpg`;    // 1200×800
const STEPS = [
  `${BLOB}1790649125564-ij1aujayajr.jpg`,
  `${BLOB}1790649126064-c1qpuphydsi.jpg`,
  `${BLOB}1790649126574-eb7w0ol617f.jpg`,
];
const TUBE = `${BLOB}1790649126886-2f75wj485n4.png`;  // 1145×767，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const TEXT_SHADOW = { color: "#4b3f7a", opacity: 0.35, distance: 6, blur: 16, angle: 90 };

/** 一張步驟卡：白框（淡陰影）＋照片＋下方說明，整組一起微微傾斜。 */
function step(i, cx, top, caption, deg) {
  const size = 270, pad = 10, rot = deg * DEG;
  return [
    L.shape("步驟卡", cx - size / 2, top, size, size, { kind: "rect", fill: "#ffffff", stroke: "#d9d3ee", strokeWidth: 2, radius: 12 },
      { rotation: rot, shadow: { color: "#3b2f6b", opacity: 0.18, distance: 8, blur: 20, angle: 90 } }),
    image(`步驟照 ${i + 1}（換成你的照片）`, STEPS[i], cx - size / 2 + pad, top + pad, size - pad * 2, size - pad * 2, { rotation: rot }),
    L.text("步驟說明", caption, cx - 170, top + size + 8, 340, 50, { fontSize: 34, color: INK, fontWeight: 700, rotation: rot }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "三步驟｜人物主視覺＋步驟照",
      family: "steps",
      composition: "hero-photo-top-steps-bottom",
      visualHierarchy: ["headline", "photo", "steps", "brand"],
      visualWeight: { headline: 9, photo: 8, steps: 7, product: 5, brand: 3 },
      readingDirection: "top→bottom, left→right",
      negativeSpace: 0.14,
      rationale:
        "上半部人物照給情緒（笑容＝結果），照片底部淡入品牌淺紫，大標剛好壓在交界上；「3」換成黃色襯線大字，一眼知道有幾步。下半部斜白帶把三張步驟照排成一列，每張同一套格式（照片／STEP 說明），角度各差一點像拍立得，最底紫帶收尾放品牌。",
      recommendedFor: "使用方法、保養步驟、產品教學",
    },
    layers: () => [
      L.bg(LAV, "#b1a5d8"),
      image("人物照（換成你的照片）", HERO, 0, 0, S, 800),
      // 照片底部淡入淺紫，標題才讀得清楚
      L.shape("照片漸層", 0, 440, S, 380, { kind: "rect", fill: LAV, gradient: { axis: "vertical", from: "#c6bde600", to: "#c6bde6ff" } }),
      // 右上示意商品（斜放、破邊）
      image("示意商品（換成你的商品，或直接刪掉）", TUBE, 790, 110, 520, Math.round(520 * 767 / 1145), { rotation: -28 * DEG }),

      L.text("小標", "終結「不良口氣」", 90, 470, 680, 90, {
        fontSize: 70, color: "#ffffff", fontWeight: 900, align: "left", shadow: TEXT_SHADOW,
        runs: [{ start: 2, end: 8, color: YELLOW }],
      }),
      L.text("主標", "自信開口", 70, 560, 600, 170, { fontSize: 150, color: "#ffffff", fontWeight: 900, align: "left", shadow: TEXT_SHADOW }),
      L.text("數字", "3", 650, 520, 170, 230, { fontSize: 250, color: YELLOW, fontWeight: 900, fontFamily: SERIF, shadow: TEXT_SHADOW }),
      L.text("主標", "步驟", 820, 560, 330, 170, { fontSize: 150, color: "#ffffff", fontWeight: 900, align: "left", shadow: TEXT_SHADOW }),

      // 下半部斜白帶＋三張步驟卡
      L.shape("白帶", -60, 770, S + 120, 360, { kind: "rect", fill: "#ffffff" }, { rotation: -3 * DEG }),
      ...step(0, 215, 800, "STEP.1  不沾水乾刷", -3),
      ...step(1, 600, 780, "STEP.2  口含2分鐘", 2),
      ...step(2, 985, 770, "STEP.3  自信微笑", -2),

      L.text("品牌", "BRAND", 860, 1132, 300, 60, { fontSize: 50, color: "#ffffff", fontWeight: 900, align: "right", fontFamily: "Arial, sans-serif" }),
    ],
  },
];
