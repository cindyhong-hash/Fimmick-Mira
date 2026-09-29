// Family 18 — 療程優惠券（直式 4:5）
//
// 家族氣質：醫美／美容療程的限時優惠。蜜桃漸層底，最上面品牌＋「✦ 限時優惠 ✦」兩側細線，
// 一排超大的白色斜體英文當背景字；左邊立著儀器，右邊「即回贈 $1800 療程金」＋橄欖綠膠囊說明，
// 下面一張米色票券（四角挖缺口、內框細線）寫「1000 發只需要 $2188」，探頭壓在票券右下；
// 最下面「✦ 只限首次體驗客戶 ✦」＋橄欖綠預約按鈕＋細則。
// 參考：美容中心「Linear Z 限時優惠」貼文（2026-09-29 使用者提供）。
// 儀器、探頭是 AI 生成後去背的示意商品；套用後換成自己的儀器照、改價格與文案。
import { L, DEG } from "./template-kit.mjs";

const W = 1200, H = 1500;
const SERIF = "'Noto Serif TC',serif";
const INK = "#3a2a20";
const BROWN = "#6b4a2e";
const ORANGE = "#c8642c";
const OLIVE = "#6f7152";
const LINE = "#c9a27a";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const MACHINE = `${BLOB}1790670528620-1nbq1w1us09.png`;   // 641×1270，去背
const HAND = `${BLOB}1790670530004-bdctu487rfe.png`;       // 651×618，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const rule = (x, y, w) => L.shape("細線", x, y, w, 2, { kind: "rect", fill: BROWN }, { opacity: 0.6 });

/** 票券：米色底＋外框＋內框細線，四個角用背景色的圓挖出缺口（顏色抓背景漸層在那個高度的顏色）。 */
function ticket(x, y, w, h) {
  const r = 30;
  const notch = (cx, cy, fill) => L.shape("票券缺口", cx - r, cy - r, r * 2, r * 2, { kind: "ellipse", fill });
  return [
    L.shape("票券", x, y, w, h, { kind: "rect", fill: "#f8ecd8", stroke: LINE, strokeWidth: 3 },
      { shadow: { color: "#a0643a", opacity: 0.16, distance: 8, blur: 22, angle: 90 } }),
    L.shape("票券內框", x + 20, y + 20, w - 40, h - 40, { kind: "rect", fill: "none", stroke: LINE, strokeWidth: 2 }),
    notch(x, y, "#f6d0a2"), notch(x + w, y, "#f6d0a2"), notch(x, y + h, "#f4bd95"), notch(x + w, y + h, "#f4bd95"),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "療程優惠券｜儀器＋票券價格（直式）",
      family: "clinic-ticket",
      composition: "device-left-ticket-right",
      docW: W, docH: H,
      visualHierarchy: ["price", "headline", "device", "cta", "brand"],
      visualWeight: { price: 10, headline: 8, device: 8, cta: 6, decoration: 3 },
      readingDirection: "top→right→bottom",
      negativeSpace: 0.14,
      rationale:
        "蜜桃漸層＋超大白色斜體英文營造精品感；儀器立在左邊當主角，右邊先用「回贈療程金」吸引，再把真正的優惠價放進一張票券裡——票券的缺口和內框讓人一看就知道是「券」，價格用橘色大字最搶眼。最下面限定條件＋橄欖綠預約按鈕收尾，顏色只用棕、橘、橄欖綠三種。",
      recommendedFor: "醫美、美容療程、課程或服務的限時優惠",
    },
    layers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: "#f8e6b0", gradient: { axis: "vertical", from: "#f8e6b0", to: "#f3b28e" } }, { type: "background", locked: true }),
      L.text("品牌", "BRAND", 400, 70, 400, 60, { fontSize: 44, color: INK, fontWeight: 500, fontFamily: SERIF, fx: { letterSpacing: 4 } }),
      rule(230, 206, 190), rule(780, 206, 190),
      L.text("小標", "✦ 限時優惠 ✦", 400, 168, 400, 80, { fontSize: 56, color: BROWN, fontWeight: 900, fontFamily: SERIF, fx: { letterSpacing: 8 } }),
      L.text("背景英文", "Glow Z", 100, 220, 1000, 270, { fontSize: 250, color: "#ffffff", fontWeight: 400, fontFamily: SERIF, opacity: 0.72, fx: { italic: true } }),

      image("儀器（換成你的儀器照）", MACHINE, 40, 390, 400, Math.round(400 * 1270 / 641),
        { shadow: { color: "#8a5a30", opacity: 0.22, distance: 16, blur: 30, angle: 100 } }),

      L.text("回贈", "即回贈", 430, 478, 200, 100, { fontSize: 62, color: INK, fontWeight: 900, fx: { letterSpacing: 6 } }),
      L.text("回贈金額", "$1800", 620, 440, 400, 150, { fontSize: 124, color: ORANGE, fontWeight: 900, fontFamily: SERIF, fx: { italic: true } }),
      L.text("回贈", "療程金", 1000, 478, 200, 100, { fontSize: 62, color: INK, fontWeight: 900, fx: { letterSpacing: 6 } }),
      L.shape("說明膠囊", 540, 580, 560, 64, { kind: "rect", fill: OLIVE, radius: 32 }),
      L.text("說明", "可直接扣抵單次療程價", 540, 580, 560, 64, { fontSize: 32, color: "#ffffff", fontWeight: 700, fx: { letterSpacing: 4 } }),

      ...ticket(460, 680, 700, 500),
      L.text("票券標題", "1000發只需要", 460, 730, 640, 90, { fontSize: 60, color: INK, fontWeight: 700, fontFamily: SERIF, fx: { letterSpacing: 8 } }),
      L.text("優惠價", "$2188", 470, 810, 620, 230, { fontSize: 220, color: ORANGE, fontWeight: 900, fontFamily: SERIF, fx: { italic: true } }),
      L.text("原價", "（原試做價$3988）", 460, 1050, 640, 70, { fontSize: 44, color: INK, fontWeight: 700, fontFamily: SERIF }),
      image("探頭（換成你的商品，或直接刪掉）", HAND, 940, 900, 270, Math.round(270 * 618 / 651), { rotation: -12 * DEG }),

      L.text("限定條件", "✦ 只限首次體驗客戶 ✦", 250, 1206, 700, 70, { fontSize: 46, color: INK, fontWeight: 900, fontFamily: SERIF, fx: { letterSpacing: 6 } }),
      L.shape("預約按鈕", 390, 1296, 420, 96, { kind: "rect", fill: OLIVE, radius: 48 }, { shadow: { color: "#4a4a30", opacity: 0.2, distance: 6, blur: 14, angle: 90 } }),
      L.text("預約", "立即預約", 390, 1296, 420, 96, { fontSize: 56, color: "#ffffff", fontWeight: 900, fontFamily: SERIF, fx: { letterSpacing: 10 } }),
      L.text("細則", "優惠受條款及細則約束", 350, 1414, 500, 44, { fontSize: 26, color: BROWN, fontWeight: 500, fontFamily: SERIF, fx: { letterSpacing: 4 } }),
    ],
  },
];
