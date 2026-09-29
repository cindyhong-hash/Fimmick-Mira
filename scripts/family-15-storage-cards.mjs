// Family 15 — 療癒系收納（實景＋白卡標題＋右欄三張圓形商品圖）
//
// 家族氣質：居家／生活用品的多品項介紹。左邊三分之二是暖米色的實景照，最上面一排空心大英文字當背景紋理，
// 中間一張白卡放品牌、大標、小標與「一字一圓」的圓點字；右邊一欄三格，每格一張圓形商品照＋圓點字分類＋白色對話框賣點。
// 參考：居家收納品牌「療癒系收納小物」貼文（2026-09-29 使用者提供）。
// 實景照、三張商品照都是 AI 生成的示意素材；套用後換成自己的照片、改分類與賣點。
import { L, S, DEG } from "./template-kit.mjs";

const BROWN = "#a97b64";
const DARK = "#5b4538";
const SAND = "#dccfc3";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const ROOM = `${BLOB}1790666125471-jepggb8oeu.jpg`;
const PHOTOS = [`${BLOB}1790666127007-qxilbgwfzfi.jpg`, `${BLOB}1790666127516-523a2tgnyp6.jpg`, `${BLOB}1790666128081-e0g97qv3256.jpg`];

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/**
 * 一字一圓：每個字底下一顆圓、顏色輪流換，圓跟圓稍微重疊（像一串珠子）。
 * 置中排在 cx；回傳圓＋字的圖層。
 */
function chips(text, cx, y, size, colors, textColor, fs) {
  const chars = [...text], step = size * 0.9;
  const x0 = cx - ((chars.length - 1) * step + size) / 2;
  return chars.flatMap((ch, i) => [
    L.shape("圓點字底", x0 + i * step, y, size, size, { kind: "ellipse", fill: colors[i % colors.length] }),
    L.text("圓點字", ch, x0 + i * step, y, size, size, { fontSize: fs, color: textColor, fontWeight: 900 }),
  ]);
}

/** 右欄一格：米色底＋圓形商品照（放在圓框裡）＋左上圓點字分類＋右下白色對話框賣點。 */
function panel(i, y, label, point) {
  const x = 810, R = 330, cx = x + 40 + R / 2;
  const frame = L.shape("商品圓框", x + 40, y + 36, R, R, { kind: "ellipse", fill: "#ffffff" });
  return [
    L.shape("右欄底", x, y, 390, 392, { kind: "rect", fill: SAND }),
    // 圓框後面一圈淡淡的大圓，像參考圖的層次
    L.shape("淡圓", x + 20, y + 16, R + 40, R + 40, { kind: "ellipse", fill: "#e8ded4" }),
    frame,
    image(`商品照 ${i + 1}（換成你的照片）`, PHOTOS[i], x + 40, y + 36, R, R, { clipTo: frame.id }),
    L.shape("圓框白邊", x + 40, y + 36, R, R, { kind: "ellipse", fill: "none", stroke: "#ffffff", strokeWidth: 6 }),
    ...chips(label, x + 40 + ([...label].length * 50) / 2 + 10, y + 30, 58, ["#f5efe9", "#c2b3a6"], DARK, 36),
    L.shape("賣點對話框", x + 136, y + 290, 246, 58, { kind: "rect", fill: "#ffffff", radius: 29 },
      { shadow: { color: "#6b5444", opacity: 0.2, distance: 4, blur: 10, angle: 90 } }),
    L.shape("對話框尾巴", x + 156, y + 338, 22, 20, { kind: "triangle", fill: "#ffffff" }, { rotation: 180 * DEG }),
    L.text("賣點", point, x + 136, y + 290, 246, 58, { fontSize: 24, color: "#333333", fontWeight: 900 }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "療癒系收納｜實景白卡＋右欄三張圓形商品圖",
      family: "storage-cards",
      composition: "photo-card-left-three-circles-right",
      visualHierarchy: ["headline", "chips", "products", "points"],
      visualWeight: { headline: 9, products: 8, chips: 6, points: 5, texture: 3 },
      readingDirection: "left→right, top→bottom",
      negativeSpace: 0.2,
      rationale:
        "左邊實景照先給「家」的溫度，白卡把字收在一個乾淨的區塊，大標用溫暖的棕色；「一字一圓」的圓點字讓標語有手作感。右邊一欄三格同一套格式（圓形商品照／分類／白色對話框賣點），一眼看完三樣東西。空心英文大字只當紋理，不搶字。",
      recommendedFor: "居家、生活用品、多品項推薦",
    },
    layers: () => [
      L.bg("#e7ddd3", "#d9cdc1"),
      image("實景照（換成你的照片）", ROOM, -140, 0, S, S),
      // 最上面一排空心英文大字（只有白色描邊）
      L.text("空心大字", "STORAGE", -24, 24, 858, 200, {
        fontSize: 176, color: "rgba(255,255,255,0)", fontWeight: 700, fontFamily: "Arial, sans-serif",
        fx: { strokeColor: "#ffffff", strokeW: 0.012 }, opacity: 0.9,
      }),
      // 白卡（後面一層半透明的框）
      L.shape("白卡外框", 138, 174, 564, 794, { kind: "rect", fill: "#ffffff" }, { opacity: 0.35 }),
      L.shape("白卡", 160, 198, 520, 746, { kind: "rect", fill: "#ffffff" }, { shadow: { color: "#6b5444", opacity: 0.12, distance: 8, blur: 24, angle: 90 } }),
      L.shape("品牌圓標", 380, 236, 80, 80, { kind: "ellipse", fill: "none", stroke: "#d9773e", strokeWidth: 4 }),
      L.icon("品牌圖示", "heart", 400, 256, 40, "#d9773e"),
      L.text("品牌", "BRAND", 320, 320, 200, 40, { fontSize: 28, color: "#2b3a5c", fontWeight: 900 }),
      L.text("大標", "療癒系", 160, 370, 520, 150, { fontSize: 136, color: BROWN, fontWeight: 900 }),
      L.text("小標", "收納小物", 160, 522, 520, 110, { fontSize: 86, color: BROWN, fontWeight: 900 }),
      ...chips("多款質感收納", 420, 650, 84, ["#d9cfc4", "#b9b3ad"], "#ffffff", 50),
      ...chips("好物", 420, 748, 84, ["#d9cfc4", "#b9b3ad"], "#ffffff", 50),
      L.text("手寫小字", "小坪數也能有大享受", 170, 862, 500, 60, { fontSize: 38, color: "#7a5a4a", fontWeight: 500, fontFamily: "'Noto Serif TC',serif", fx: { italic: true, letterSpacing: 6 } }),
      // 下方換頁小點
      ...[0, 1, 2, 3, 4].map((i) => L.shape("換頁點", 364 + i * 26, 992, 16, 16, { kind: "ellipse", fill: "#ffffff" }, { opacity: i === 0 ? 0.5 : 1 })),

      // 右邊一欄三格
      ...panel(0, 0, "質感生活", "摺疊收納內外兼具！"),
      ...panel(1, 404, "廚房幫手", "防潮防蟲大容量！"),
      ...panel(2, 808, "壁掛式", "防塵不占位！"),
    ],
  },
];
