// Family 10 — 清單三欄卡（便利貼紙＋三張商品卡）
//
// 家族氣質：食品／居家品牌的「推薦清單」貼文。整張像一張貼在牆上的紙（左上一段紙膠帶、右下紙角翻起），
// 上方雙線夾住大標與副標，右上一個手繪感的彎箭頭往下指；下方三張同款圓角卡：情境膠囊／圓形照片／線條圖示／品名／一句話。
// 參考：冷凍水餃品牌「冰箱常備品清單」貼文（2026-09-29 使用者提供）。
// 三張食物照、三個線條圖示都是 AI 生成的示意素材（圖示轉成咖啡色、去白底）；套用後換成自己的商品照與文字。
import { L, S, DEG } from "./template-kit.mjs";

const SERIF = "'Noto Serif TC',serif";
const INK = "#4a4541";
const ORANGE = "#e0a052";
const CARD = "#e8b06f";
const BROWN = "#8b5a2b";
const PAPER = "#f4f0e8";
const BG = "#e9b574";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const FOOD = [`${BLOB}1790653878421-ce4d6aiwpip.jpg`, `${BLOB}1790653879098-uvj7qz49nxl.jpg`, `${BLOB}1790653879750-20o0fzai819.jpg`];
const ICONS = [
  { src: `${BLOB}1790653880275-qllp98hv57h.png`, ratio: 488 / 382 },
  { src: `${BLOB}1790653881265-554pz8eg0b.png`, ratio: 489 / 447 },
  { src: `${BLOB}1790653882385-v1u59sul2yr.png`, ratio: 480 / 487 },
];

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const line = (x, y, w) => L.shape("雙線", x, y, w, 3, { kind: "rect", fill: "#c79a63" });
const doubleLine = (x, y, w) => [line(x, y, w), line(x, y + 8, w)];

/** 一張商品卡：情境膠囊（白框）＋圓形照片（後面一圈深色弧）＋閃光＋線條圖示＋品名＋一句話。 */
function card(i, x, tag, title, sub) {
  const W = 302, cx = x + W / 2, top = 425;
  const frame = L.shape("照片圓框", cx - 100, top + 170, 210, 210, { kind: "ellipse", fill: "#ffffff" });
  const ic = ICONS[i], icH = 72;
  return [
    L.shape("商品卡", x, top, W, 595, { kind: "rect", fill: CARD, radius: 28 }),
    L.shape("情境膠囊", cx - 114, top + 50, 228, 70, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 4, radius: 35 }),
    L.text("情境", tag, cx - 114, top + 50, 228, 70, { fontSize: 36, color: "#ffffff", fontWeight: 900 }),
    L.shape("照片後的弧", cx - 118, top + 156, 232, 232, { kind: "ellipse", fill: "#d69a55" }),
    frame,
    image(`商品照 ${i + 1}（換成你的照片）`, FOOD[i], cx - 100, top + 170, 210, 210, { clipTo: frame.id }),
    L.icon("閃光", "sparkle", cx - 132, top + 176, 34, "#ffffff"),
    image("線條圖示", ic.src, cx - Math.round((icH * ic.ratio) / 2), top + 402, Math.round(icH * ic.ratio), icH),
    L.text("品名", title, x + 10, top + 478, W - 20, 64, { fontSize: 48, color: "#ffffff", fontWeight: 900 }),
    L.text("一句話", sub, x + 16, top + 548, W - 32, 40, { fontSize: 26, color: BROWN, fontWeight: 700 }),
  ];
}

/** 開放的鋼筆路徑（手繪感彎箭頭）：節點以圖層中心為原點、用寬高比例表示。 */
const arrowBody = [
  { x: -0.25, y: -0.46, ox: 0.55, oy: 0.05, ix: 0, iy: 0 },
  { x: 0.05, y: 0.40, ox: 0, oy: 0, ix: 0.45, iy: -0.35 },
];
const arrowHead = [
  { x: -0.38, y: 0.12 },
  { x: 0.05, y: 0.42 },
  { x: 0.42, y: 0.06 },
];

export const FAMILY = [
  {
    art: {
      name: "清單三欄｜便利貼＋三張商品卡",
      family: "checklist",
      composition: "note-paper-three-cards",
      visualHierarchy: ["headline", "cards", "subhead", "cta"],
      visualWeight: { headline: 9, cards: 8, subhead: 5, cta: 4, decoration: 3 },
      readingDirection: "top→bottom, left→right",
      negativeSpace: 0.2,
      rationale:
        "整張做成一張貼在牆上的紙（紙膠帶＋翻起的紙角），讓「清單」有手作的溫度；大標用雙線夾住、關鍵字換成主色，彎箭頭把視線從標題帶到下面三張卡。三張卡同一套格式（情境→照片→品名→一句話），一眼就能比較，底部品牌＋訂購按鈕收尾。",
      recommendedFor: "食品、居家用品的推薦清單、多品項介紹",
    },
    layers: () => [
      L.bg(BG, BG),
      // 紙：淡陰影、左上紙膠帶、右下翻起的紙角
      L.shape("紙", 72, 72, 1056, 1080, { kind: "rect", fill: PAPER },
        { shadow: { color: "#8a5a2b", opacity: 0.2, distance: 8, blur: 24, angle: 90 } }),
      L.shape("紙膠帶", 96, 44, 270, 72, { kind: "rect", fill: "#d8c7a0" }, { opacity: 0.8, rotation: -8 * DEG }),

      ...doubleLine(200, 140, 255),
      ...doubleLine(745, 140, 255),
      L.text("主標", "冰箱 常備品清單!", 150, 160, 900, 130, {
        fontSize: 104, color: INK, fontWeight: 900,
        runs: [{ start: 3, end: 6, color: ORANGE }],
      }),
      L.text("副標", "讓美味即刻上桌的秘密武器們", 150, 284, 900, 64, { fontSize: 44, color: INK, fontWeight: 700, fx: { letterSpacing: 10 } }),
      ...doubleLine(200, 364, 800),
      // 右上彎箭頭（往下指向卡片）
      L.shape("彎箭頭", 1010, 225, 110, 180, { kind: "path", fill: "none", stroke: ORANGE, strokeWidth: 14, closed: false, points: arrowBody }),
      L.shape("箭頭尖", 1010, 225, 110, 180, { kind: "path", fill: "none", stroke: ORANGE, strokeWidth: 14, closed: false, points: arrowHead }),

      ...card(0, 118, "中午肚子餓", "冷凍水餃", "多種口味 豐富飽滿"),
      ...card(1, 450, "半夜肚子餓", "冷凍餛飩", "快速料理 暖心暖胃"),
      ...card(2, 778, "餐餐都可搭", "紅油辣子", "絕配百搭超涮嘴"),

      // 底部：品牌＋細線＋訂購按鈕
      L.text("品牌", "品牌名稱", 110, 1040, 240, 70, { fontSize: 40, color: "#6b5a4a", fontWeight: 700, fontFamily: SERIF }),
      L.shape("底線", 360, 1076, 560, 3, { kind: "rect", fill: "#8b7a6a" }),
      // 右下紙角：先用背景色切掉一角，再疊上翻起的那一片
      L.shape("紙角切口", 978, 1002, 150, 150, { kind: "path", fill: BG, stroke: "none", strokeWidth: 0, closed: true, points: [{ x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }] }),
      L.shape("紙角", 978, 1002, 150, 150, { kind: "path", fill: "#e6dfd2", stroke: "none", strokeWidth: 0, closed: true, points: [{ x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 }, { x: -0.5, y: -0.5 }] },
        { shadow: { color: "#6b4a2a", opacity: 0.25, distance: 6, blur: 14, angle: 45 } }),
      L.shape("訂購框", 948, 1086, 222, 68, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 4 }),
      L.text("訂購", "訂購GO >", 948, 1086, 222, 68, { fontSize: 42, color: "#ffffff", fontWeight: 900 }),
    ],
  },
];

export { S };
