// Family 20 — 時段膠囊（最佳食用時機）
//
// 家族氣質：保健食品的「什麼時候吃」說明圖。米色紙感底、左右兩條深綠邊，上方描邊大標（前兩字深綠、後面淺綠）；
// 三列膠囊形長條，每條左邊是情境照、斜斜切進白色區塊寫時段與用法（產品名換成金色），右端疊著對應的商品；
// 最下面品牌名。
// 參考：保健品牌「最佳食用時機」貼文（2026-09-29 使用者提供）。
// 三張情境照、三組商品包裝都是 AI 生成的示意素材；套用後換成自己的照片、商品與時段。
import { L, S, DEG } from "./template-kit.mjs";

const GREEN = "#3f6b52";
const MINT = "#9cc4a8";
const GRAY = "#6b6b62";
const GOLD = "#d2bb7c";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const PHOTOS = [`${BLOB}1790673265766-0ceomolu0yc.jpg`, `${BLOB}1790673266908-fwpc4nrqcu9.jpg`, `${BLOB}1790673267796-0dwvf26e4foc.jpg`];   // 900×560
const PRODUCTS = [
  { src: `${BLOB}1790673268357-w7v70lo0im.png`, w: 290, h: 202, x: 900, y: 300 },   // 兩個蛋白粉袋 700×488
  { src: `${BLOB}1790673269718-wg3myim2zn.png`, w: 181, h: 280, x: 952, y: 548 },   // 白色圓筒 452×700
  { src: `${BLOB}1790673270487-ap6ix4k4h1.png`, w: 168, h: 280, x: 962, y: 808 },   // 綠色圓筒 420×700
];

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/** 一列膠囊：左邊情境照、斜切的白色區塊寫時段＋用法（產品名金色），外框深灰細線，右端疊商品。 */
function row(i, time, lead, product) {
  const x = 72, y = 314 + i * 260, w = 870, h = 232;
  const frame = L.shape("膠囊", x, y, w, h, { kind: "rect", fill: "#ffffff", radius: h / 2 });
  const p = PRODUCTS[i];
  return [
    frame,
    image(`情境照 ${i + 1}（換成你的照片）`, PHOTOS[i], x, y - 46, 520, 324, { clipTo: frame.id }),
    L.shape("斜切線", x + 432, y, 22, h, { kind: "rect", fill: "#d9d9d0" }, { skewX: -16 * DEG, clipTo: frame.id }),
    L.shape("白色區塊", x + 452, y, 480, h, { kind: "rect", fill: "#ffffff" }, { skewX: -16 * DEG, clipTo: frame.id }),
    L.shape("膠囊外框", x, y, w, h, { kind: "rect", fill: "none", stroke: "#3d3d3d", strokeWidth: 3, radius: h / 2 }),
    L.text("時段", time, x + 448, y + 44, 360, 80, { fontSize: 60, color: GRAY, fontWeight: 900, fx: { letterSpacing: 4 } }),
    L.text("用法", lead + product, x + 438, y + 128, 380, 60, {
      fontSize: 38, color: GRAY, fontWeight: 900,
      runs: [{ start: lead.length, end: lead.length + product.length, color: GOLD }],
    }),
    image(`示意商品 ${i + 1}（換成你的商品，或直接刪掉）`, p.src, p.x, p.y, p.w, p.h,
      { shadow: { color: "#3b4a3f", opacity: 0.22, distance: 10, blur: 20, angle: 100 } }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "時段膠囊｜三個時段＋情境照＋商品",
      family: "timeline-capsules",
      composition: "three-capsule-rows",
      visualHierarchy: ["headline", "times", "photos", "products", "brand"],
      visualWeight: { headline: 9, times: 8, photos: 7, products: 7, brand: 3 },
      readingDirection: "top→bottom",
      negativeSpace: 0.16,
      rationale:
        "大標用描邊＋兩種綠把「最佳」和「食用時機」分開強調；三列一樣的膠囊由上而下就是一天的時間軸，左邊照片給情境、斜切進白色區塊把時段放大，產品名用金色點出，右端疊上對應商品讓人知道每個時段吃哪一個。米色紙感＋左右深綠邊框，整體溫和、有質感。",
      recommendedFor: "保健食品、保養步驟、一天的使用時段說明",
    },
    layers: () => [
      L.bg("#f2f0e7", "#ebe8dc"),
      L.shape("淡色波紋", -200, 520, 1600, 700, { kind: "ellipse", fill: "#f8f7f0" }, { opacity: 0.8 }),
      L.shape("左邊框", 0, 0, 28, S, { kind: "rect", fill: "#4f7a63" }),
      L.shape("右邊框", S - 28, 0, 28, S, { kind: "rect", fill: "#4f7a63" }),

      L.text("大標", "最佳食用時機", 100, 50, 1000, 170, {
        fontSize: 148, color: GREEN, fontWeight: 900,
        fx: { strokeColor: "#ffffff", strokeW: 0.08 },
        shadow: { color: "#2f4a3a", opacity: 0.3, distance: 6, blur: 0, angle: 90 },
        runs: [{ start: 2, end: 6, color: MINT }],
      }),
      L.text("副標", "筆記起來，享受健康每一天！", 100, 214, 1000, 80, { fontSize: 52, color: "#555555", fontWeight: 900, fx: { letterSpacing: 10 } }),

      ...row(0, "6:00-10:00", "早餐", "兩勺高蛋白"),
      ...row(1, "11:00-14:00", "午餐餐前", "PRODUCT A"),
      ...row(2, "21:00-23:00", "晚餐睡前", "PRODUCT B"),

      L.icon("品牌圖示", "leaf", 420, 1108, 60, GRAY),
      L.text("品牌", "BRAND X", 490, 1100, 320, 76, { fontSize: 56, color: GRAY, fontWeight: 700, fontFamily: "'Noto Serif TC',serif", align: "left", fx: { letterSpacing: 6 } }),
    ],
  },
];
