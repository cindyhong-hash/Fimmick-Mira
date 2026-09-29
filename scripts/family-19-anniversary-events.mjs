// Family 19 — 門市週年慶三重好禮（直式 4:5）
//
// 家族氣質：門市活動的「優惠清單」貼文。上半部是淡化的門市實景照，對話框膠囊寫門市名、深綠大標、英文副標；
// 下半部一大片深綠色（上緣是柔和的波浪），三張白卡依序是 EVENT 1／2／3（大數字圓牌壓在卡片上緣），
// 每張卡：商品照＋說明＋紅字贈品＋價格或限量小框；最下面一條淺綠色長卡放加碼好禮（紅色 SPECIAL GIFT 標籤＋日期）。
// 參考：生活選物品牌「週年慶限定優惠」門市活動貼文（2026-09-29 使用者提供）。
// 門市照、商品照都是 AI 生成的示意素材；套用後換成自己的照片，改活動內容與價格。
import { L } from "./template-kit.mjs";

const W = 1200, H = 1500;
const GREEN = "#5d6e55";
const GREEN_D = "#4f5f47";
const MINT = "#dfe8d5";
const RED = "#d9644f";
const INK = "#333333";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const STORE = `${BLOB}1790672303053-gdz1mokqau4.jpg`;   // 1200×780
const ITEMS = [`${BLOB}1790672304120-4nh5wnu1mnn.jpg`, `${BLOB}1790672304457-7thv8q2bkdh.jpg`, `${BLOB}1790672304994-jucjjiv1kv.jpg`];   // 600×400
const GIFT = `${BLOB}1790672305304-ud0zclt0ro.jpg`;     // 600×400

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const box = (x, y, w, text) => [
  L.shape("小框", x, y, w, 42, { kind: "rect", fill: "#ffffff", stroke: "#8a8a8a", strokeWidth: 2, radius: 4 }),
  L.text("小框字", text, x, y, w, 42, { fontSize: 22, color: INK, fontWeight: 700 }),
];

/** 一張活動卡：EVENT 標籤＋大數字圓牌＋商品照（放在圓角框裡）＋說明文字。body 是卡片下半部的圖層。 */
function card(i, x, note, body) {
  const y = 660, CW = 336;
  const frame = L.shape("商品照框", x + 16, y + 16, CW - 32, 230, { kind: "rect", fill: "#eceeea", radius: 12 });
  return [
    L.shape("活動卡", x, y, CW, 500, { kind: "rect", fill: "#ffffff", radius: 18 }, { shadow: { color: "#2f3a2a", opacity: 0.18, distance: 6, blur: 16, angle: 90 } }),
    frame,
    image(`商品照 ${i + 1}（換成你的照片）`, ITEMS[i], x + 16 - 20, y + 16, 345, 230, { clipTo: frame.id }),
    L.text("備註", note, x + CW - 150, y + 212, 130, 30, { fontSize: 20, color: "#777777", fontWeight: 500, align: "right" }),
    L.shape("EVENT 標籤", x - 4, y - 50, 132, 46, { kind: "rect", fill: "#ffffff", stroke: GREEN, strokeWidth: 2, radius: 23 }),
    L.text("EVENT", "EVENT", x - 4, y - 50, 132, 46, { fontSize: 24, color: GREEN, fontWeight: 900 }),
    L.shape("數字圓牌", x + 118, y - 76, 116, 116, { kind: "ellipse", fill: MINT, stroke: "#ffffff", strokeWidth: 6 }),
    L.text("數字", String(i + 1), x + 118, y - 76, 116, 116, { fontSize: 72, color: GREEN_D, fontWeight: 900 }),
    ...body(x, y, CW),
  ];
}
const line = (x, y, w, text, color = INK, fs = 30, weight = 700) => L.text("說明", text, x, y, w, 46, { fontSize: fs, color, fontWeight: weight });

export const FAMILY = [
  {
    art: {
      name: "門市週年慶｜三重好禮活動卡（直式）",
      family: "anniversary-events",
      composition: "photo-header-three-event-cards-gift-bar",
      docW: W, docH: H,
      visualHierarchy: ["headline", "event-numbers", "gifts", "prices", "special-gift"],
      visualWeight: { headline: 9, "event-numbers": 7, gifts: 8, prices: 7, "special-gift": 6 },
      readingDirection: "top→left→right→bottom",
      negativeSpace: 0.1,
      rationale:
        "上半部用淡化的門市照交代「在哪裡」，對話框膠囊放門市名、深綠大標說活動；下半部一整片深綠把三張白卡托起來，大數字圓牌壓在卡片上緣，一眼數得出三重好禮。每張卡同一套格式（照片／說明／紅字贈品／價格或限量），最後一條淺綠長卡放加碼好禮，用紅色標籤跳出來。",
      recommendedFor: "門市週年慶、多檔活動彙整、滿額贈",
    },
    layers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: "#f4f5f1" }, { type: "background", locked: true }),
      image("門市照（換成你的照片）", STORE, 0, 0, W, 780),
      L.shape("淡化", 0, 0, W, 780, { kind: "rect", fill: "#ffffff" }, { opacity: 0.55 }),

      L.shape("門市膠囊", 440, 120, 320, 92, { kind: "rect", fill: GREEN_D, radius: 46 }),
      L.shape("膠囊尾巴", 588, 204, 26, 22, { kind: "triangle", fill: GREEN_D }, { rotation: Math.PI }),
      L.text("門市名", "門市名稱", 440, 120, 320, 92, { fontSize: 52, color: "#ffffff", fontWeight: 900 }),
      L.text("大標", "週年慶限定優惠", 100, 240, 1000, 150, { fontSize: 120, color: GREEN_D, fontWeight: 900 }),
      L.text("英文副標", "Brand X Partner  Special Gift for you", 100, 388, 1000, 64, { fontSize: 40, color: "#444444", fontWeight: 400, fx: { italic: true } }),

      // 下半部深綠（上緣波浪）
      L.shape("深綠波浪", 0, 470, W, 1030, {
        kind: "path", fill: GREEN, stroke: "none", strokeWidth: 0, closed: true,
        points: [
          { x: -0.5, y: -0.44 },
          { x: -0.2, y: -0.5, ix: -0.12, iy: 0, ox: 0.12, oy: 0 },
          { x: 0.16, y: -0.43, ix: -0.12, iy: 0, ox: 0.12, oy: 0 },
          { x: 0.5, y: -0.48 },
          { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 },
        ],
      }),

      ...card(0, 72, "（不挑色）", (x, y, w) => [
        line(x, y + 268, w, "購買莫蘭迪系列C組合"),
        line(x, y + 314, w, "贈吸管皮革收納袋乙個", RED, 30, 900),
        L.shape("分隔線", x + 20, y + 370, w - 40, 2, { kind: "rect", fill: "#555555" }),
        L.text("價格", "獨家價 $1,179", x, y + 384, w, 70, { fontSize: 38, color: INK, fontWeight: 900, runs: [{ start: 4, end: 10, fontSize: 48, color: RED }] }),
        L.text("原價", "原價$1454", x, y + 450, w, 34, { fontSize: 24, color: "#777777", fontWeight: 500 }),
        L.shape("刪除線", x + w / 2 - 60, y + 466, 120, 2, { kind: "rect", fill: "#777777" }),
      ]),
      ...card(1, 432, "（價值$119）", (x, y, w) => [
        line(x, y + 268, w, "凡購買小莊園系列"),
        line(x, y + 314, w, "任一組合"),
        line(x, y + 362, w, "贈品牌吸水布二入組", RED, 30, 900),
        ...box(x + w / 2 - 70, y + 426, 140, "限量50組"),
      ]),
      ...card(2, 792, "（價值$199）", (x, y, w) => [
        line(x, y + 262, w, "以1000元面額五倍券"),
        line(x, y + 306, w, "購買小莊園任一組合"),
        line(x, y + 350, w, "贈燙玫瑰金吸管乙支", RED, 30, 900),
        ...box(x + 26, y + 404, w - 52, "不得與其他活動合併參加"),
        ...box(x + w / 2 - 76, y + 452, 152, "限量100組"),
      ]),

      // 加碼好禮長卡
      L.shape("加碼長卡", 72, 1208, 1056, 262, { kind: "rect", fill: "#e3ead9", radius: 18 }),
      ...(() => {
        const frame = L.shape("好禮照框", 90, 1226, 330, 226, { kind: "rect", fill: "#ffffff", radius: 12 });
        return [frame, image("加碼好禮照（換成你的照片）", GIFT, 90, 1226, 340, 226, { clipTo: frame.id })];
      })(),
      L.shape("SPECIAL GIFT 標籤", 446, 1232, 214, 46, { kind: "rect", fill: "#e0786c", radius: 23 }),
      L.text("SPECIAL GIFT", "SPECIAL GIFT", 446, 1232, 214, 46, { fontSize: 26, color: "#ffffff", fontWeight: 900 }),
      L.text("日期", "10.07(四) —— 10.31(日)", 676, 1232, 440, 46, { fontSize: 30, color: INK, fontWeight: 900, align: "left" }),
      L.text("加碼說明", "於門市消費，即可憑兌換券", 446, 1292, 670, 46, { fontSize: 30, color: INK, fontWeight: 700, align: "left" }),
      L.text("加碼說明", "至合作品牌門市不限金額消費，兌換", 446, 1338, 670, 46, { fontSize: 30, color: INK, fontWeight: 700, align: "left" }),
      L.text("加碼好禮", "粗版彈力髮圈一條", 446, 1392, 300, 50, { fontSize: 34, color: RED, fontWeight: 900, align: "left" }),
      ...box(752, 1396, 226, "每人限贈一條，不挑色"),
      ...box(990, 1396, 126, "限量200份"),
    ],
  },
];
