// AI 背景 ＋ 可編輯前景
//
// 「字框標題」原本靠純色底與外框撐場面，質感有限。這一版把背景換成 AI 生的
// 展示場景（黑色大理石、金色拱門、三座展示台），前景的標題、字框、標籤、
// 分隔線全部維持可編輯圖層——使用者改字、換商品、調位置都不會動到背景。
//
// 這是這個工具真正的用法：背景交給 AI，版面交給圖層。
import { L, S, product, PRODUCTS } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const GOLD = "#c9a95f";
const STAGE = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/1790067394855-ysq63pl246f.jpg";

/** 金色細線 ＋ 兩端小菱形。 */
const goldRule = (x, y, w) => [
  L.shape("金線", x, y, w, 1, { kind: "rect", fill: GOLD }),
  L.shape("金菱左", x - 5, y - 5, 11, 11, { kind: "diamond", fill: GOLD }),
  L.shape("金菱右", x + w - 6, y - 5, 11, 11, { kind: "diamond", fill: GOLD }),
];

/** 每個字一個金框。 */
const charBox = (ch, x, y, size) => [
  L.shape(`字框${ch}`, x, y, size, size, { kind: "rect", fill: "none", stroke: GOLD, strokeWidth: 2 }),
  L.text(`字${ch}`, ch, x, y + size * 0.19, size, size * 0.62, {
    fontSize: size * 0.58, color: "#f6edd8", fontFamily: SERIF,
  }),
];

export const FAMILY = [
  {
    art: {
      name: "Luxury｜金萃系列（AI 背景＋可編輯前景）",
      family: "luxury",
      composition: "layered",
      visualHierarchy: ["headline", "product", "copy"],
      visualWeight: { headline: 10, product: 8, copy: 3, decoration: 2 },
      readingDirection: "top→bottom",
      // 量的是「前景圖層」的覆蓋率；背景不算佔用（它就是畫布本身）。
      // 這張前景本來就刻意稀疏，密度由 AI 背景提供。
      negativeSpace: 0.55,
      rationale:
        "背景本身已經是一座打好光的展示場，金色拱門把視線從上方的標題收束下來，三座展示台則把三支商品架在同一條水平基準上；前景只負責文字層次，讓背景的縱深與前景的秩序疊成兩層空間。",
      recommendedFor: "系列組合、禮盒、品牌形象",
    },
    layers: () => [
      // 背景：AI 生的展示場。整張滿版，鎖住不讓誤拖。
      L.bg("#0b0b0e", "#0b0b0e"),
      { ...L.shape("AI 背景場景", 0, 0, S, S, { kind: "rect", fill: "#0b0b0e" }),
        type: "background", image: STAGE, shape: null, locked: true,
        name: "AI 背景場景（可換成你自己的）" },

      // 三支商品站在三座展示台上
      // 每支的底邊要對齊各自展示台的台面，否則會像浮在半空
      ...product(PRODUCTS.white, 290, 546, 150, 350, { shadow: false }),
      ...product(PRODUCTS.amber, 520, 440, 160, 360, { shadow: false }),
      ...product(PRODUCTS.green, 765, 537, 150, 350, { shadow: false }),

      // 前景文字：全部可編輯
      L.text("上標", "THE COLLECTION", 0, 90, S, 50, {
        fontSize: 26, color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.55 },
      }),
      ...goldRule(330, 160, 540),
      ...charBox("金", 300, 200, 130),
      ...charBox("萃", 450, 200, 130),
      ...charBox("系", 600, 200, 130),
      ...charBox("列", 750, 200, 130),
      L.text("副標", "GOLD ESSENCE SERIES", 0, 360, S, 50, {
        fontSize: 28, color: "#e3d3a6", fontFamily: SERIF, fx: { letterSpacing: 0.42 },
      }),
      ...goldRule(420, 430, 360),

      // 展示台下方的品項標
      ...[["清潔", 285], ["精華", 520], ["面霜", 760]].flatMap(([label, x], i) => [
        // 標在台子下方，不要壓在台面上
        L.text(`品項${i}`, label, x, 985, 150, 50, {
          fontSize: 30, color: "#f3e8cd", fontFamily: SERIF,
        }),
        L.shape(`品項線${i}`, x + 45, 1038, 60, 1, { kind: "rect", fill: GOLD }),
      ]),

      L.text("內文", "以冷萃金萃為核心，三支一組完成整套夜間儀式。", 0, 1062, S, 56, {
        fontSize: 28, color: "#d9cba9", fontFamily: SANS, fontWeight: 400,
      }),
      ...goldRule(330, 1126, 540),
      L.text("品牌", "MAISON  ·  GOLD ESSENCE  ·  SINCE 1998", 0, 1142, S, 46, {
        fontSize: 24, color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.3 },
      }),
    ],
  },
];

export { S };
