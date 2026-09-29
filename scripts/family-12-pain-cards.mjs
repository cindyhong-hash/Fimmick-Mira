// Family 12 — 痛點插畫主視覺＋三張情境卡
//
// 家族氣質：瘦身／保健的「說中你的煩惱」貼文。上半部紫色主視覺：左邊白色大標＋淡黃色 hashtag 條，
// 右邊一個插畫人物（後面一塊斜的淺紫色、再疊一層放大的淡淡人物當氛圍）；下半部淺灰點點底，
// 三張情境照卡片，每張左上一條斜的白色直書標籤點出痛點，下面一顆紫色膠囊按鈕。
// 參考：瘦身品牌「夏天甩肉心好累」貼文（2026-09-29 使用者提供）。
// 插畫人物、三張情境照是 AI 生成的示意素材，點點底是程式畫的；套用後換成自己的圖與文字。
import { L, S, DEG } from "./template-kit.mjs";

const PURPLE = "#7b5fc8";
const LILAC = "#a794e6";
const INK = "#111111";
const SERIF = "'Noto Serif TC',serif";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const GIRL = `${BLOB}1790657987135-d5ch4gmsmel.png`;   // 803×1363，去背
const DOTS = `${BLOB}1790657988756-bhr4ul741h.png`;    // 1200×400
const PHOTOS = [`${BLOB}1790657989128-bdck0omzd4.jpg`, `${BLOB}1790657989707-sm7d2jqcokh.jpg`, `${BLOB}1790657990602-in6ehntlm3m.jpg`];
const GIRL_RATIO = 803 / 1363;

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const poly = (name, x, y, w, h, fill, points, over = {}) =>
  L.shape(name, x, y, w, h, { kind: "path", fill, stroke: "none", strokeWidth: 0, closed: true, points }, over);

/** 一張情境卡：白框照片＋左上斜的白色直書標籤＋下方紫色膠囊按鈕。 */
function card(i, x, label) {
  const y = 830, W = 350, H = 300, tilt = -10 * DEG;
  return [
    L.shape("卡片框", x, y, W, H, { kind: "rect", fill: "#ffffff", radius: 18 },
      { shadow: { color: "#4b3f7a", opacity: 0.12, distance: 6, blur: 16, angle: 90 } }),
    image(`情境照 ${i + 1}（換成你的照片）`, PHOTOS[i], x + 10, y + 10, W - 20, H - 20),
    // 五個字 × 字級 48 × 行高 1.25 = 300，標籤剛好包住
    L.shape("直書標籤", x + 14, y + 4, 90, 304, { kind: "rect", fill: "#ffffff", stroke: INK, strokeWidth: 4 }, { rotation: tilt }),
    L.text("痛點", label.split("").join("\n"), x + 14, y + 4, 90, 304, { fontSize: 48, color: INK, fontWeight: 900, rotation: tilt }),
    L.shape("按鈕", x + 38, y + 312, 274, 66, { kind: "rect", fill: PURPLE, radius: 33 },
      { shadow: { color: "#4b3f7a", opacity: 0.2, distance: 4, blur: 10, angle: 90 } }),
    L.text("按鈕字", "小撇步點我", x + 52, y + 312, 196, 66, { fontSize: 34, color: "#ffffff", fontWeight: 900 }),
    L.shape("按鈕圓圈", x + 252, y + 326, 38, 38, { kind: "ellipse", fill: "none", stroke: "#ffffff", strokeWidth: 3 }),
    L.text("按鈕箭頭", ">", x + 252, y + 324, 38, 38, { fontSize: 26, color: "#ffffff", fontWeight: 700 }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "痛點插畫｜主視覺＋三張情境卡",
      family: "pain-cards",
      composition: "hero-illustration-three-cards",
      visualHierarchy: ["headline", "illustration", "cards", "tag", "cta"],
      visualWeight: { headline: 9, illustration: 8, cards: 7, tag: 5, cta: 4 },
      readingDirection: "top-left→right→bottom",
      negativeSpace: 0.14,
      rationale:
        "上半部用一個有表情的插畫人物把情緒帶出來（累、煩），白色大標說出心聲、淡黃 hashtag 條把話題收成一句；右邊斜的淺紫色塊和放大的淡淡人物讓畫面有層次但不搶字。下半部三張情境照各配一條斜的直書標籤，像貼上去的便條，一眼看出三種痛點，每張下面都有同一顆按鈕引導往下看解法。",
      recommendedFor: "瘦身、保健、生活困擾型的痛點貼文、輪播封面",
    },
    layers: () => [
      L.bg(PURPLE, "#6f53bd"),
      // 右邊斜的淺紫色塊
      poly("斜色塊", 620, 0, 580, 800, LILAC, [{ x: -0.1, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }], { opacity: 0.85 }),
      // 放大的淡淡人物（氛圍）＋主角人物
      image("氛圍人物", GIRL, 330, -80, 620, Math.round(620 / GIRL_RATIO), { opacity: 0.12 }),
      image("插畫人物（換成你的圖）", GIRL, 690, 20, Math.round(800 * GIRL_RATIO), 800),

      L.text("品牌", "BRAND", 40, 36, 220, 56, { fontSize: 40, color: "#ffffff", fontWeight: 700, fontFamily: SERIF, align: "left" }),
      L.text("品牌中文", "品 牌 名 稱", 40, 90, 220, 36, { fontSize: 24, color: "#ffffff", fontWeight: 500, align: "left" }),
      L.text("手寫小字", "減肥真的好累啊～", 200, 162, 460, 60, { fontSize: 38, color: "#ffffff", fontWeight: 500, fontFamily: SERIF, rotation: -4 * DEG, opacity: 0.92, fx: { italic: true } }),
      L.text("主標", "夏天甩肉\n心好累…", 110, 238, 580, 300, {
        fontSize: 138, color: "#ffffff", fontWeight: 900, align: "left",
        shadow: { color: "#3b2a7a", opacity: 0.25, distance: 6, blur: 14, angle: 90 },
      }),
      L.shape("標籤條", 120, 566, 500, 90, { kind: "rect", fill: "#fbf8c4" }),
      L.text("標籤", "#長肉不分四季", 120, 566, 500, 90, { fontSize: 54, color: INK, fontWeight: 900 }),
      // 右下點點裝飾
      ...[0, 1, 2].flatMap((c) => [0, 1, 2, 3].map((r) => L.shape("點點", 1118 + c * 18, 676 + r * 22, 6, 6, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.8 }))),

      // 下半部：淺灰點點底（蓋住人物的下半身）＋三張情境卡
      image("點點底", DOTS, 0, 800, S, 400, { locked: true }),
      ...card(0, 25, "管不住嘴？"),
      ...card(1, 425, "排便不順？"),
      ...card(2, 825, "熱量爆表？"),
    ],
  },
];
