// Family 05 — 電商檔期（主視覺＋商品卡）
//
// 家族氣質：電商通路檔期主圖。左邊是活動主視覺（品牌×通路、大標、折扣、贈品、商品站在檯面上、CTA），
// 右邊一欄商品卡（折扣圓標＋商品＋品名＋限時價）。
// 參考：品牌 × 通路聯名的檔期圖（2026-09-24 使用者提供）。
// 字、商品都是示意：套用後直接改字、把示意商品換成自己的商品。
import { L, S, product, PRODUCTS } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const INK = "#3d3431";
const ORANGE = "#ef6034";

/** 示意商品依圖片原比例給框（高度固定），底部才對得齊檯面、卡片裡才不會一大一小。 */
const RATIO = { blue: 437 / 939, green: 213 / 694, white: 268 / 727, amber: 217 / 673, pink: 436 / 451 };
const standing = (key, x, bottom, h) => product(PRODUCTS[key], x, bottom - h, Math.round(h * RATIO[key]), h, { shadow: false });

/** 右欄一張商品卡：白卡＋左上折扣圓標＋商品（1–2 支）＋品名＋限時價。 */
function card(y, { off, offSize, items, name, price }) {
  const X = 760, W = 400, H = 340, cx = X + W / 2;
  const imgH = 180, gap = 24;
  const widths = items.map((k) => Math.round(imgH * RATIO[k]));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let px = cx - total / 2;
  const goods = items.flatMap((k, i) => {
    const out = product(PRODUCTS[k], Math.round(px), y + 28, widths[i], imgH, { shadow: false });
    px += widths[i] + gap;
    return out;
  });
  return [
    L.shape("商品卡", X, y, W, H, { kind: "rect", fill: "#ffffff", radius: 28 },
      { glow: { color: "#5a4a3c", size: 28, opacity: 0.16, strength: 1 } }),
    ...goods,
    L.text("品名", name, X + 20, y + 222, W - 40, 44, { fontSize: 30, color: INK, fontWeight: 700 }),
    L.text("限時價", price, X + 20, y + 266, W - 40, 62, {
      fontSize: 32, color: ORANGE, fontWeight: 900,
      runs: [{ start: 3, end: 3 + price.slice(3).replace(/\/.*/, "").length, fontSize: 58 }],
    }),
    L.shape("折扣圓標", X - 36, y + 26, 100, 100, { kind: "ellipse", fill: ORANGE },
      { glow: { color: "#ffffff", size: 6, opacity: 0.9, strength: 2 } }),
    L.text("折扣", off, X - 36, y + 26, 100, 100, {
      fontSize: 26, color: "#ffffff", fontWeight: 900,
      runs: [{ start: 0, end: off.length - 1, fontSize: offSize }],
    }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "電商檔期｜主視覺＋商品卡",
      family: "promo",
      composition: "hero-with-product-cards",
      visualHierarchy: ["headline", "discount", "product", "cards", "cta"],
      visualWeight: { headline: 9, discount: 8, product: 7, cards: 6, cta: 4 },
      readingDirection: "left→right, top→bottom",
      negativeSpace: 0.18,
      rationale:
        "左六右四：左邊是檔期主視覺，大標與「83 折」的橘色數字先抓住視線，商品站在檯面上撐起下半部；右邊三張白卡用同一套格式（圓標／商品／品名／限時價）排成一欄，讓人一眼比價。暖米色底配柔光，折扣只用一種橘色，不跟商品搶。",
      recommendedFor: "電商通路檔期、品牌聯名、多品項折扣",
    },
    layers: () => [
      L.bg("#f4ede4", "#d9c8b6", "diagonal"),
      // 窗光：左上一團柔白，讓底色不死板
      L.shape("窗光", -160, -120, 760, 620, { kind: "ellipse", fill: "#ffffff", softness: 0.95 }, { opacity: 0.55 }),
      // 檯面
      L.shape("檯面", 0, 1010, 760, 190, { kind: "rect", fill: "#ece3d8" }),
      L.shape("檯面亮邊", 0, 1008, 760, 4, { kind: "rect", fill: "#ffffff" }, { opacity: 0.8 }),

      L.text("品牌×通路", "你的品牌  ×  通路", 40, 60, 680, 70, {
        fontSize: 46, color: "#6b5d52", fontFamily: SERIF, fontWeight: 700,
      }),
      L.text("主標", "韓系植萃淨嫩保養", 30, 150, 700, 110, { fontSize: 84, color: INK, fontWeight: 900 }),
      L.text("日期", "9.14\n9.27", 44, 290, 100, 100, { fontSize: 28, color: INK, fontWeight: 700 }),
      L.text("折扣標題", "全館限時83折起", 140, 280, 600, 120, {
        fontSize: 80, color: INK, fontWeight: 900,
        runs: [{ start: 4, end: 6, fontSize: 108, color: ORANGE }],
      }),
      // 贈品膠囊：深色外框＋白色小膠囊
      L.shape("贈品膠囊", 110, 430, 540, 66, { kind: "rect", fill: "#5a4f47", radius: 33 }),
      L.shape("贈品膠囊白", 114, 434, 210, 58, { kind: "rect", fill: "#ffffff", radius: 29 }),
      L.text("贈品標籤", "滿額加碼送", 114, 434, 210, 58, { fontSize: 30, color: INK, fontWeight: 900 }),
      L.text("贈品", "指定好禮送給你", 330, 430, 310, 66, { fontSize: 30, color: "#ffffff", fontWeight: 700 }),

      // 商品站在檯面上（由左到右、由小到大）
      ...standing("green", 96, 1012, 300),
      ...standing("pink", 206, 1012, 140),
      ...standing("amber", 360, 1012, 450),
      ...standing("blue", 520, 1012, 480),

      L.shape("按鈕", 330, 1086, 260, 70, { kind: "rect", fill: INK, radius: 14 }),
      L.text("按鈕字", "立即搶購 >", 330, 1086, 260, 70, { fontSize: 32, color: "#ffffff", fontWeight: 900 }),

      ...card(50, { off: "9折", offSize: 44, items: ["blue"], name: "人氣精華液", price: "限時價$405" }),
      ...card(430, { off: "85折", offSize: 40, items: ["amber", "amber"], name: "淨透卸妝油2入", price: "限時價$550/件" }),
      ...card(810, { off: "83折", offSize: 40, items: ["white", "white"], name: "泡沫洗面乳2入", price: "限時價$350/件" }),
    ],
  },
];

export { S };
