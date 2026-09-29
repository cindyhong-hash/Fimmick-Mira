// Family 11 — 漫畫報紙風新品預告（直式 3:4）
//
// 家族氣質：新品上市前的「預告／招募」貼文。一張米色報紙斜斜鋪在畫面上，細線把版面切成報紙欄位；
// 左上紫色對話框放主題字，旁邊是漫畫感的外框＋硬陰影大字；左下一條斜緞帶＋咖啡色大標，右下網點格放商品，
// 最下面一疊資料夾紙片壓住畫面，寫「敬請期待」。
// 參考：保養品牌新品預告「抗糖招募令」貼文（2026-09-29 使用者提供）。
// 霜罐是 AI 生成後去背的示意商品、網點格是程式畫的；套用後換成自己的商品與文字。
//
// 2026-09-29 使用者在編輯器裡把這張微調過、存成範本，要以那一版為準：
// 實際的圖層改讀 family-11-comic-launch.layers.json（使用者存的那份），下面的 draftLayers 是最初的版本，留著當參考。
import { readFileSync } from "node:fs";
import { L, DEG } from "./template-kit.mjs";

const SNAPSHOT = JSON.parse(readFileSync(new URL("./family-11-comic-launch.layers.json", import.meta.url), "utf8"));

const W = 1200, H = 1600;
const SERIF = "'Noto Serif TC',serif";
const PURPLE = "#5f63c8";
const PAPER = "#f6f0de";
const BROWN = "#6b4f2a";
const GOLD = "#d7aa5c";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const HALFTONE = `${BLOB}1790654757734-js2lcpapgmp.png`;   // 600×960，網點往右下漸大
const JAR = `${BLOB}1790654812850-cfa18uh3pp5.png`;        // 610×565，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const rule = (x, y, w, color = "#5a4a3a") => L.shape("細線", x, y, w, 3, { kind: "rect", fill: color });
const poly = (name, x, y, w, h, fill, points, over = {}) =>
  L.shape(name, x, y, w, h, { kind: "path", fill, stroke: "none", strokeWidth: 0, closed: true, points }, over);

/** 貓掌：一顆掌墊＋四顆腳趾（都是橢圓，換色、刪掉都方便）。 */
function paw(cx, cy, s, color) {
  const toe = (dx, dy) => L.shape("貓掌", cx + dx * s - s * 0.13, cy + dy * s - s * 0.16, s * 0.26, s * 0.32, { kind: "ellipse", fill: color });
  return [
    L.shape("貓掌", cx - s * 0.31, cy - s * 0.05, s * 0.62, s * 0.5, { kind: "ellipse", fill: color }),
    toe(-0.42, -0.22), toe(-0.15, -0.42), toe(0.15, -0.42), toe(0.42, -0.22),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "漫畫報紙｜新品預告（直式）",
      family: "comic-launch",
      composition: "newspaper-comic-teaser",
      docW: W, docH: H,
      visualHierarchy: ["headline", "product", "teaser", "cta"],
      visualWeight: { headline: 10, teaser: 8, product: 7, cta: 4, decoration: 4 },
      readingDirection: "top-left→bottom-right",
      negativeSpace: 0.12,
      rationale:
        "報紙＋漫畫的語言讓「預告」有話題感：左上紫色對話框和外框硬陰影大字一左一右撐起標題；斜緞帶把視線帶到咖啡色大標，貓掌是可愛的記憶點；右下網點格把商品框成漫畫格，最下面一疊紙片壓住畫面、放「敬請期待」收尾。主色只用紫＋咖啡＋米色。",
      recommendedFor: "新品預告、活動招募、品牌聯名揭曉",
    },
    layers: () => structuredClone(SNAPSHOT.layers),
    draftLayers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: "#f3e3bf", gradient: { axis: "vertical", from: "#f3e3bf", to: "#e7cf9d" } }, { type: "background", locked: true }),
      // 後面一張紙（左邊露出一截）＋主報紙（微微斜放、右邊破出畫面）
      L.shape("後面的紙", -90, 110, 340, 1040, { kind: "rect", fill: "#efe3c6", stroke: "#cfc8e8", strokeWidth: 4 }, { rotation: -4 * DEG }),
      L.shape("報紙", 222, 30, 1060, 1480, { kind: "rect", fill: PAPER },
        { rotation: 2 * DEG, shadow: { color: "#8a6a3a", opacity: 0.22, distance: 10, blur: 28, angle: 90 } }),

      // 報頭
      rule(285, 180, 300), rule(285, 188, 300),
      L.text("品牌", "BRAND", 640, 140, 320, 70, { fontSize: 58, color: "#2b2b3a", fontFamily: SERIF, fontWeight: 700, fx: { letterSpacing: 6 } }),
      L.text("品牌副標", "品 牌 名 稱", 640, 208, 320, 34, { fontSize: 22, color: "#2b2b3a", fontWeight: 500 }),
      rule(670, 262, 530), rule(670, 270, 530),

      // 左上：紫色對話框（右邊一條淡色斜紋、左下一個尖角）
      L.shape("對話框", 253, 283, 424, 330, { kind: "rect", fill: PURPLE }),
      L.shape("斜紋", 520, 283, 80, 330, { kind: "rect", fill: "#7a7ee0" }, { skewX: -20 * DEG, opacity: 0.6 }),
      poly("對話框尖角", 253, 610, 130, 96, PURPLE, [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 }]),
      L.text("主題", "抗糖", 253, 300, 424, 300, { fontSize: 190, color: PAPER, fontWeight: 900 }),
      // 右上：漫畫感外框＋硬陰影大字
      L.text("主標", "招募令", 670, 300, 530, 250, {
        fontSize: 168, color: "#ece8f8", fontWeight: 900, rotation: -3 * DEG,
        fx: { strokeColor: PURPLE, strokeW: 0.07 },
        shadow: { color: PURPLE, opacity: 1, distance: 12, blur: 0, angle: 45 },
      }),
      rule(655, 572, 560), rule(655, 580, 560),

      // 左下：斜緞帶＋咖啡色大標＋貓掌
      L.shape("緞帶", 228, 666, 560, 88, { kind: "rect", fill: PURPLE }, { rotation: 6 * DEG }),
      L.text("緞帶字", "品牌邀請了", 228, 666, 560, 88, { fontSize: 50, color: "#ffffff", fontWeight: 900, rotation: 6 * DEG, fx: { letterSpacing: 16 } }),
      L.text("大標上", "神秘", 228, 770, 360, 170, { fontSize: 156, color: BROWN, fontWeight: 900, align: "left" }),
      ...paw(625, 850, 130, GOLD),
      L.text("大標下", "新夥伴", 200, 935, 520, 175, { fontSize: 156, color: BROWN, fontWeight: 900, align: "left" }),
      rule(160, 1112, 540),
      L.text("行動呼籲", "搶先入手 >>>", 178, 1128, 460, 84, { fontSize: 54, color: PURPLE, fontWeight: 900, align: "left", rotation: 2 * DEG }),
      rule(160, 1226, 540),

      // 右下：網點漫畫格＋商品＋斜標籤
      image("網點格", HALFTONE, 780, 655, 460, 760, { shadow: { color: "#3b3470", opacity: 0.18, distance: 8, blur: 20, angle: 90 } }),
      L.shape("網點格外框", 780, 655, 460, 760, { kind: "rect", fill: "none", stroke: PURPLE, strokeWidth: 4 }),
      image("示意商品（換成你的商品，或直接刪掉）", JAR, 700, 780, 400, Math.round(400 * 565 / 610),
        { rotation: -8 * DEG, shadow: { color: "#2a2560", opacity: 0.3, distance: 14, blur: 26, angle: 90 } }),
      L.shape("標籤底", 930, 722, 260, 64, { kind: "rect", fill: "#ffffff", radius: 32 }, { rotation: 38 * DEG }),
      L.text("商品名", "新品名稱", 930, 722, 260, 64, { fontSize: 40, color: "#3b3450", fontWeight: 900, rotation: 38 * DEG }),

      // 最下面一疊資料夾紙片
      poly("紙片（後）", 0, 1250, W, 350, "#ecd9a8",
        [{ x: -0.5, y: -0.5 }, { x: -0.17, y: -0.5 }, { x: -0.12, y: -0.22 }, { x: 0.5, y: -0.22 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }],
        { shadow: { color: "#8a6a3a", opacity: 0.25, distance: 8, blur: 24, angle: -90 } }),
      poly("紙片（前）", 0, 1380, W, 220, "#f3e5c0",
        [{ x: -0.36, y: -0.5 }, { x: 0.34, y: -0.3 }, { x: 0.5, y: -0.44 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }, { x: -0.5, y: -0.36 }],
        { shadow: { color: "#8a6a3a", opacity: 0.2, distance: 6, blur: 18, angle: -90 } }),
      L.text("敬請期待", "敬請期待", 300, 1478, 460, 90, { fontSize: 62, color: BROWN, fontWeight: 900, fx: { letterSpacing: 18 } }),
      ...paw(800, 1528, 44, BROWN),
      ...paw(852, 1534, 32, BROWN),
      ...paw(894, 1534, 32, BROWN),
    ],
  },
];
