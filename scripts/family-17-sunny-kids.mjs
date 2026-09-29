// Family 17 — 陽光大圓框主視覺（限動／直式 9:16）
//
// 家族氣質：嬰幼兒／親子商品的活力主視覺。整張亮黃底，一個超大的圓把情境照框起來（圓的左邊露出、右邊破出畫面），
// 上面兩行白色大標壓在照片上緣（「小勇士」放大），左下一條斜的白色撕紙條寫賣點，
// 最下面白色鋸齒撕紙邊放標語＋搜尋框，商品罐從右下角冒出來。
// 參考：奶粉品牌「自護小勇士 活力向前衝」限動（2026-09-29 使用者提供）。
// 情境照、奶粉罐都是 AI 生成的示意素材；套用後換成自己的照片、商品與文字。
import { L, DEG } from "./template-kit.mjs";

const W = 1125, H = 2000;
const BLUE = "#1f4fb5";
const RED = "#e8344e";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const HERO = `${BLOB}1790668332720-fg1ndstvmvl.jpg`;   // 768×1024
const CAN = `${BLOB}1790668333888-8mlh4iduvbi.png`;    // 555×789，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const TITLE_FX = { strokeColor: "#f0a500", strokeW: 0.05 };
const TITLE_SHADOW = { color: "#c98a00", opacity: 0.45, distance: 8, blur: 6, angle: 90 };

export const FAMILY = [
  {
    art: {
      name: "陽光大圓框｜情境照＋撕紙賣點（直式 9:16）",
      family: "sunny-kids",
      composition: "big-circle-photo-yellow-frame",
      docW: W, docH: H,
      visualHierarchy: ["headline", "photo", "claim", "product", "slogan"],
      visualWeight: { headline: 9, photo: 9, claim: 6, product: 7, slogan: 5 },
      readingDirection: "top→bottom",
      negativeSpace: 0.1,
      rationale:
        "亮黃底＋超大圓框把情境照變成一個窗，圓只露出左半邊弧線、右邊破出畫面，畫面很有衝勁；白色描邊大標壓在照片上緣，讓字和照片黏在一起。斜的白色撕紙條把賣點像貼紙一樣貼上去，最下面的鋸齒撕紙邊收住畫面，商品罐從右下角冒出來當結尾。",
      recommendedFor: "嬰幼兒、親子、夏季活動的限動／直式主視覺",
    },
    layers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: "#ffe44d", gradient: { axis: "vertical", from: "#ffe44d", to: "#ffd21f" } }, { type: "background", locked: true }),
      L.text("品牌", "BRAND 品牌", 56, 44, 520, 96, { fontSize: 70, color: BLUE, fontWeight: 900, align: "left" }),

      // 超大圓框裡的情境照（圓的右邊破出畫面）
      ...(() => {
        const frame = L.shape("大圓框", 55, 330, 1700, 1700, { kind: "ellipse", fill: "#bfe4f7" });
        return [
          frame,
          image("情境照（換成你的照片）", HERO, 55, 330, 1070, Math.round(1070 * 1024 / 768), { clipTo: frame.id }),
          L.shape("大圓白邊", 55, 330, 1700, 1700, { kind: "ellipse", fill: "none", stroke: "#ffffff", strokeWidth: 10 }),
        ];
      })(),

      // 兩行大標（壓在照片上緣）＋紙飛機
      L.text("大標上", "自護「小勇士」", 40, 150, 900, 190, {
        fontSize: 112, color: "#ffffff", fontWeight: 900, fx: TITLE_FX, shadow: TITLE_SHADOW,
        runs: [{ start: 2, end: 7, fontSize: 140 }],
      }),
      L.text("大標下", "活力向前衝", 300, 330, 780, 180, { fontSize: 146, color: "#ffffff", fontWeight: 900, fx: TITLE_FX, shadow: TITLE_SHADOW }),
      L.shape("紙飛機", 950, 170, 120, 90, { kind: "triangle", fill: "#ffffff", stroke: "#f0a500", strokeWidth: 4 }, { rotation: -24 * DEG }),

      // 左下斜的白色撕紙條賣點（第一行下面一條黃色螢光筆）
      L.shape("撕紙條", -20, 1368, 800, 240, { kind: "rect", fill: "#ffffff" }, { rotation: -4 * DEG, opacity: 0.96, shadow: { color: "#b58a00", opacity: 0.2, distance: 6, blur: 14, angle: 90 } }),
      L.shape("螢光筆", 40, 1432, 640, 34, { kind: "rect", fill: "#ffe44d" }, { rotation: -4 * DEG }),
      L.text("賣點", "乳源OPO+FOS益生元+CPP", 20, 1392, 720, 80, { fontSize: 52, color: BLUE, fontWeight: 900, rotation: -4 * DEG }),
      L.text("賣點", "輕鬆照顧嬌嫩小肚肚", 20, 1474, 720, 80, { fontSize: 52, color: BLUE, fontWeight: 900, rotation: -4 * DEG }),

      // 最下面白色鋸齒撕紙邊＋標語＋搜尋框
      L.shape("撕紙邊", 0, 1620, W, 380, {
        kind: "path", fill: "#ffffff", stroke: "none", strokeWidth: 0, closed: true,
        points: [
          { x: -0.5, y: -0.2 }, { x: -0.4, y: -0.34 }, { x: -0.31, y: -0.14 }, { x: -0.19, y: -0.42 }, { x: -0.06, y: -0.18 },
          { x: 0.07, y: -0.32 }, { x: 0.19, y: -0.1 }, { x: 0.32, y: -0.3 }, { x: 0.44, y: -0.14 }, { x: 0.5, y: -0.24 },
          { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 },
        ],
      }),
      image("示意商品（換成你的商品，或直接刪掉）", CAN, 715, 1540, 390, Math.round(390 * 789 / 555),
        { shadow: { color: "#8a6a00", opacity: 0.3, distance: 14, blur: 26, angle: 100 } }),
      L.text("標語", "聰明寶寶 喝品牌", 56, 1790, 640, 100, { fontSize: 76, color: BLUE, fontWeight: 900, align: "left" }),
      L.shape("搜尋框", 56, 1904, 580, 72, { kind: "rect", fill: "#ffffff", stroke: RED, strokeWidth: 4, radius: 36 }),
      L.shape("搜尋標籤", 56, 1904, 150, 72, { kind: "rect", fill: RED, radius: 36 }),
      L.text("搜尋標籤字", "搜尋", 56, 1904, 150, 72, { fontSize: 36, color: "#ffffff", fontWeight: 900 }),
      L.text("搜尋字", "品牌名 商品名", 220, 1904, 400, 72, { fontSize: 36, color: "#333333", fontWeight: 700, align: "left" }),
    ],
  },
];
