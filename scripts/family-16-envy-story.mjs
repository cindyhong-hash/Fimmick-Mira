// Family 16 — 故事型主視覺＋三格回憶卡（焦糖色）
//
// 家族氣質：寢具／生活品牌的「共鳴故事」貼文。上半部一張大情境照，細金線圓角框、左上四分之一圓放品牌、
// 右上兩行襯線金色文案（關鍵詞放大、換色），下緣一道焦糖色波浪帶放一句白色斜體問句；
// 下半部三格（焦糖、淺焦糖、深咖啡）：深咖啡小標籤＋圓角照片＋兩行說明（第二行的重點換成黃色）。
// 參考：床墊品牌「人總是羨慕自己沒有的」貼文（2026-09-29 使用者提供）。
// 主視覺照、三張情境照都是 AI 生成的示意素材；套用後換成自己的照片、改文案。
import { L, S } from "./template-kit.mjs";

const SERIF = "'Noto Serif TC',serif";
const CARAMEL = "#c49a6c";
const GOLD = "#b07a3c";
const INK = "#6f4a2a";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const HERO = `${BLOB}1790668080099-k54qf0hc5s.jpg`;    // 1200×780
const PHOTOS = [`${BLOB}1790668080822-z9jc8331yv8.jpg`, `${BLOB}1790668081382-3pzdsy07qnn.jpg`, `${BLOB}1790668081913-6ouh9y4hjj9.jpg`];

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/** 下半部一格：底色＋深咖啡小標籤＋圓角照片（放在圓角框裡）＋兩行說明。 */
function panel(i, x, fill, tag, line1, line2, muted = false) {
  const y = 792, W = 396;
  const frame = L.shape("照片框", x + 38, y + 104, W - 76, 200, { kind: "rect", fill: "#ffffff", radius: 24 });
  return [
    L.shape("格子", x, y, W, 408, { kind: "rect", fill }),
    L.shape("小標籤", x + W / 2 - 134, y + 30, 268, 56, { kind: "rect", fill: "#5a3b25", radius: 12 }),
    L.text("小標籤字", tag, x + W / 2 - 134, y + 30, 268, 56, { fontSize: 30, color: "#ffffff", fontWeight: 700, fontFamily: SERIF }),
    frame,
    image(`情境照 ${i + 1}（換成你的照片）`, PHOTOS[i], x + 38, y + 104, W - 76, 200, { clipTo: frame.id }),
    L.text("說明", line1, x + 10, y + 318, W - 20, 44, { fontSize: 32, color: muted ? "#cdbdb0" : "#ffffff", fontWeight: 700 }),
    L.text("說明重點", line2, x + 10, y + 360, W - 20, 44, { fontSize: 32, color: muted ? "#b9a898" : "#f6d56a", fontWeight: 700 }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "故事主視覺｜大情境照＋三格回憶卡",
      family: "envy-story",
      composition: "hero-photo-wave-three-panels",
      visualHierarchy: ["photo", "headline", "question", "panels"],
      visualWeight: { photo: 9, headline: 8, question: 7, panels: 7, brand: 3 },
      readingDirection: "top-right→bottom-left→bottom",
      negativeSpace: 0.14,
      rationale:
        "上半部用一張有情緒的大情境照帶出共鳴，金色襯線文案放在照片留白處、關鍵詞放大換色；下緣的焦糖色波浪帶把一句問句托出來，也把畫面自然切到下半部。三格同一套格式（小標籤／照片／兩行說明），像翻相簿一樣從小到大講故事，最後一格顏色最深當收尾。",
      recommendedFor: "寢具、生活用品的故事型貼文、共鳴話題、輪播封面",
    },
    layers: () => [
      L.bg("#f4efe9", "#efe7de"),
      image("主視覺照（換成你的照片）", HERO, 0, 0, S, 780),
      // 細金線圓角框
      L.shape("金線框", 52, 62, 1100, 690, { kind: "rect", fill: "none", stroke: "#c8a57a", strokeWidth: 3, radius: 40 }),
      // 左上四分之一圓＋品牌
      L.shape("品牌角", -150, -150, 400, 400, { kind: "ellipse", fill: CARAMEL }),
      L.icon("品牌圖示", "star", 90, 32, 44, "#ffffff"),
      L.text("品牌", "BRAND", 30, 86, 170, 50, { fontSize: 34, color: "#ffffff", fontWeight: 700, fontFamily: SERIF }),
      L.text("品牌中文", "品牌名稱", 30, 132, 170, 32, { fontSize: 22, color: "#ffffff", fontWeight: 500 }),
      // 右上兩行金色襯線文案
      L.text("文案上", "人總是羨慕自己沒有的", 460, 110, 700, 100, {
        fontSize: 56, color: INK, fontWeight: 900, fontFamily: SERIF, align: "right",
        runs: [{ start: 3, end: 5, fontSize: 80, color: GOLD }],
      }),
      L.text("文案下", "你從幾歲開始羨慕…", 460, 204, 700, 90, {
        fontSize: 52, color: INK, fontWeight: 900, fontFamily: SERIF, align: "right",
        runs: [{ start: 2, end: 4, fontSize: 60, color: "#d98a3a" }],
      }),
      // 下緣焦糖色波浪帶＋問句
      L.shape("波浪帶", 0, 640, S, 150, {
        kind: "path", fill: CARAMEL, stroke: "none", strokeWidth: 0, closed: true,
        points: [
          { x: -0.5, y: -0.05 },
          { x: -0.16, y: -0.42, ix: -0.12, iy: 0, ox: 0.14, oy: 0 },
          { x: 0.18, y: 0.22, ix: -0.12, iy: 0, ox: 0.14, oy: 0 },
          { x: 0.5, y: -0.12 },
          { x: 0.5, y: 0.5 },
          { x: -0.5, y: 0.5 },
        ],
      }, { opacity: 0.96 }),
      L.text("問句", "可以一覺到天亮的人？", 80, 688, 600, 80, { fontSize: 54, color: "#ffffff", fontWeight: 900, fontFamily: SERIF, fx: { italic: true } }),

      // 下半部三格（中間白線分隔：格子之間留 6px 讓底色透出來）
      L.shape("分隔底", 0, 786, S, 414, { kind: "rect", fill: "#ffffff" }),
      ...panel(0, 0, CARAMEL, "國小最羨慕的事", "同學生日可以", "請全班吃軟糖桶"),
      ...panel(1, 402, "#d4b28a", "高中後最羨慕的事", "羨慕其他學校", "有便服日"),
      ...panel(2, 804, "#7e5f4c", "大學最羨慕的事", "別人可以夜衝夜唱", "我卻要回家睡覺", true),
    ],
  },
];
