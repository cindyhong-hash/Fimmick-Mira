// Family 08 — 痛點圍繞（人物＋環狀痛點圓牌）
//
// 家族氣質：保養／洗護的「痛點型」廣告。超大標題點出問題，困擾的人物站在中間，
// 五個深色圓牌沿著一圈橢圓線圍著他（每個圓牌一個痛點），底部斜橫幅給解方＋左下商品。
// 參考：男士洗髮精「五大頭皮煩惱」（2026-09-24 使用者提供）。
// 人物是 AI 生成後去背的示意照；商品是示意商品。套用後換成自己的人物照、商品，改痛點文字。
import { L, S, product, PRODUCTS } from "./template-kit.mjs";

const NAVY = "#1f4466";
const INK = "#1f2937";
const PERSON = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/1790241452541-5tulouj8yjr.png";   // 1050×1373，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/** 一個痛點圓牌：深藍漸層圓＋白邊＋淡陰影＋白字（一到兩行）。 */
const badge = (cx, cy, text) => [
  L.shape("痛點圓牌", cx - 92, cy - 92, 184, 184,
    { kind: "ellipse", fill: NAVY, stroke: "#ffffff", strokeWidth: 6, gradient: { axis: "radial", from: "#3d6690", to: "#12263b" } },
    { shadow: { color: "#0b1622", opacity: 0.35, distance: 10, blur: 22, angle: 90 } }),
  L.text("痛點", text, cx - 80, cy - 80, 160, 160, { fontSize: 40, color: "#ffffff", fontWeight: 900 }),
];

export const FAMILY = [
  {
    art: {
      name: "痛點圍繞｜人物＋環狀圓牌",
      family: "pain-points",
      composition: "hero-person-with-orbit-badges",
      visualHierarchy: ["headline", "person", "badges", "solution", "product"],
      visualWeight: { headline: 10, person: 8, badges: 7, solution: 6, product: 5 },
      readingDirection: "top→center→bottom",
      negativeSpace: 0.12,
      rationale:
        "標題佔滿上方直接點出問題，人物頭髮壓在標題前面把兩者黏在一起；五個痛點圓牌沿著同一圈橢圓線環繞人物，讓人一眼數得出「五大」；底部斜橫幅是轉折（從煩惱到解方），商品從左下角冒出來接住這個轉折。",
      recommendedFor: "洗護、保養的痛點型廣告，列出多個困擾再帶商品",
    },
    layers: () => [
      L.bg("#f0f4f8", "#cddae6"),
      L.shape("背光", 250, 300, 700, 700, { kind: "ellipse", fill: "#ffffff", softness: 0.9 }, { opacity: 0.7 }),

      L.text("小標", "\\ 男士的 /", 0, 44, S, 80, { fontSize: 54, color: INK, fontWeight: 900 }),
      L.text("主標", "五大頭皮煩惱", 0, 118, S, 190, { fontSize: 168, color: NAVY, fontWeight: 900 }),

      // 環繞人物的橢圓線（在人物後面）
      L.shape("環線", 170, 430, 860, 390, { kind: "ellipse", fill: "none", stroke: NAVY, strokeWidth: 5 }),
      // 人物（頭髮壓在標題前面）
      image("人物（換成你的照片）", PERSON, 285, 250, 630, Math.round(630 * 1373 / 1050)),

      // 五個痛點圓牌（在人物前面）
      ...badge(300, 470, "頭臭\n油垢味"),
      ...badge(880, 455, "大把\n大把掉"),
      ...badge(1060, 690, "大出油"),
      ...badge(310, 715, "頭皮屑"),
      ...badge(790, 810, "頭皮\n紅腫癢"),

      // 底部解方橫幅（斜的）＋光束
      L.shape("副標底", 250, 966, 560, 66, { kind: "rect", fill: NAVY }, { opacity: 0.92, skewX: -12 }),
      L.text("副標", "敏弱頭皮更該溫和洗淨", 250, 966, 560, 66, { fontSize: 36, color: "#ffffff", fontWeight: 700 }),
      L.shape("解方橫幅", 290, 1040, 830, 130,
        { kind: "rect", fill: "#1b4f80", gradient: { axis: "horizontal", from: "#173f66", to: "#2f7cc0" } }, { skewX: -12 }),
      L.shape("光束", 230, 1036, 900, 5, { kind: "rect", fill: "#ffffff" },
        { glow: { color: "#8fd0ff", size: 22, opacity: 0.9, strength: 3 } }),
      L.text("解方", "找回自信風采！", 290, 1040, 830, 130, { fontSize: 96, color: "#ffffff", fontWeight: 900 }),

      // 左下商品（壓在橫幅前面）
      ...product(PRODUCTS.blue, 44, 640, Math.round(540 * 437 / 939), 540, { shadow: false }),
    ],
  },
];
