// Family 22 — 斜排明朝體大字＋手持商品（日系）
//
// 家族氣質：日系保健／食品的情感型主視覺。整張是綠色實景（手舉著商品），畫面微微往右上斜：
// 左半邊超大的白色明朝體大標，括號裡的關鍵字最大（「討厭」→「喜歡」的轉折）；
// 右上角兩行直書的一句心得，最下面兩行補充賣點；外面一個斜的白色細線框、左上一行小英文當節奏。
// 參考：日本青汁品牌「嫌い だった野菜が 好き に変わる瞬間」主視覺（2026-09-29 使用者提供，文案改成繁體中文）。
// 手持商品照是 AI 生成的示意素材，網點是程式畫的；套用後換成自己的照片、改文案。
import { L, S, DEG } from "./template-kit.mjs";

const SERIF = "'Noto Serif TC',serif";
const TILT = -6 * DEG;
const LIME = "#f2ff9c";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const HERO = `${BLOB}1790675316153-mnqdaso4u1a.jpg`;   // 1200×1200
const DOTS = `${BLOB}1790675316988-ugieozv8ka9.png`;   // 1200×1200 透明底白網點（左密右疏）

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const SHADOW = { color: "#2f6b3a", opacity: 0.3, distance: 3, blur: 10, angle: 90 };
const big = (name, text, x, y, w, h, fontSize, over = {}) =>
  L.text(name, text, x, y, w, h, { fontSize, color: "#ffffff", fontWeight: 700, fontFamily: SERIF, align: "left", rotation: TILT, shadow: SHADOW, ...over });
/** 直書：一個字一行；highlight 是要換色的那幾個字（原文字串的位置）。 */
const vertical = (name, text, x, y, fontSize, highlight) => {
  const chars = [...text];
  const joined = chars.join("\n");
  const runs = highlight ? [{ start: highlight[0] * 2, end: highlight[1] * 2 - 1, color: LIME }] : undefined;
  return L.text(name, joined, x, y, fontSize * 1.3, chars.length * fontSize * 1.25, { fontSize, color: "#ffffff", fontWeight: 700, rotation: TILT, shadow: SHADOW, ...(runs ? { runs } : {}) });
};

export const FAMILY = [
  {
    art: {
      name: "斜排明朝大字｜手持商品＋直書心得（日系）",
      family: "mincho-tilt",
      composition: "tilted-giant-serif-left-product-right",
      visualHierarchy: ["headline", "product", "quote", "claim"],
      visualWeight: { headline: 10, product: 8, quote: 5, claim: 5, texture: 2 },
      readingDirection: "top-left→bottom, then right column",
      negativeSpace: 0.1,
      rationale:
        "整張微微往右上斜，讓靜態的手持商品照有「往上」的動感；明朝體大字把情緒說出來，括號裡的「討厭」「喜歡」放到最大，一眼看出轉折。右上直書一句心得像使用者的口吻，最下面兩行補充理性的賣點；細線框和小英文只當節奏，不搶字。",
      recommendedFor: "食品、保健、生活選物的情感型主視覺（日系風格）",
    },
    layers: () => [
      image("手持商品照（換成你的照片）", HERO, 0, 0, S, S, { type: "background", locked: true }),
      L.shape("綠色調", 0, 0, S, S, { kind: "rect", fill: "#6fbf78" }, { opacity: 0.32 }),
      image("網點", DOTS, 0, 0, S, S, { opacity: 0.35 }),
      L.shape("細線框", 40, 90, 1110, 1050, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 2 }, { rotation: -4 * DEG, opacity: 0.7 }),

      L.icon("品牌圖示", "leaf", 40, 34, 42, "#ffffff"),
      L.text("品牌", "brand", 90, 36, 200, 40, { fontSize: 28, color: "#ffffff", fontWeight: 500, align: "left" }),
      L.text("小英文", "Tomorrow always brings forth new buds.", 34, 148, 760, 50, { fontSize: 30, color: "#ffffff", fontWeight: 500, fontFamily: "Arial, sans-serif", align: "left", rotation: TILT, fx: { letterSpacing: 3 } }),

      big("大標一", "「討厭」", -14, 228, 620, 230, 200),
      big("大標二", "的蔬菜", 176, 440, 440, 120, 96),
      big("大標三", "變成「喜歡」", 16, 560, 800, 240, 96, { runs: [{ start: 2, end: 6, fontSize: 200 }] }),
      big("大標四", "的瞬間。", 60, 800, 720, 190, 150),

      vertical("心得", "這麼溫和的青汁", 1092, 64, 54, [5, 7]),
      vertical("心得", "我還是第一次喝到。", 1022, 70, 54),

      big("補充", "只用2種原料", 590, 950, 560, 76, 54, { fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700 }),
      big("補充", "就有73種豐富營養。", 560, 1034, 620, 76, 54, { fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700 }),
    ],
  },
];
