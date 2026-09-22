// Family 03 — Y2K Pop
//
// 家族氣質：千禧復古。粗描邊藝術字、棋盤格、星形外框、半調點、視窗 UI 框。
// 這一家族刻意「吵」——畫面必須滿、顏色必須衝，留白是節奏而不是氣質。
//
// 藝術字用 fx.warp 逐字沿弧線排（編輯器的 drawWarpedText 真的會畫），
// 所以仍然是可編輯文字，使用者改字弧形會跟著重排，不是貼上去的圖。
import { L, S, DEG, product, PRODUCTS } from "./template-kit.mjs";
import {
  arcHeadline, checkerCorner, starOutline, windowChrome, plusMarks,
  hashPill, carouselDots, footnotes, priceBlock, tapeLabel,
} from "./template-details.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";

export const FAMILY = [
  {
    art: {
      name: "Y2K｜弧形藝術字",
      family: "dynamic",
      composition: "large-typography",
      visualHierarchy: ["headline", "product", "decoration"],
      visualWeight: { headline: 10, product: 6, decoration: 4, copy: 2 },
      readingDirection: "top→bottom",
      negativeSpace: 0.32,
      rationale:
        "弧形藝術字撐開畫面上緣，星形與棋盤格從四角往內壓，把中央擠出一塊給商品；標題的弧度與星芒的放射方向一致，整張的張力來自這個共同的擴散感。",
      recommendedFor: "年輕客群、節慶快閃",
    },
    layers: () => [
      L.bg("#ffd3e3", "#ff9dc2"),
      ...checkerCorner(0, 0, 4, 60, "#ff7fb0"),
      ...checkerCorner(960, 1020, 4, 60, "#ff7fb0"),
      ...starOutline(950, 60, 220, "#ffe3ee", 12),
      ...starOutline(60, 900, 150, "#ffe3ee", -8),
      ...arcHeadline("ENERGY UP", 60, 150, 1080, 230, {
        fontSize: 150, from: "#ffffff", to: "#ffd0e4", stroke: "#d6376f", strokeW: 0.14, warpAmount: 26,
      }),
      L.text("副標", "整個春天都有精神", 0, 400, S, 70, {
        fontSize: 46, color: "#4a1230", fontFamily: SANS,
      }),
      ...product(PRODUCTS.pink, 420, 520, 360, 520, { rotation: -10 * DEG, shadow: false }),
      ...plusMarks([[150, 420, 34], [1020, 520, 30], [200, 980, 26]], "#ffffff"),
      // 商品兩側原本大片空白，補三個賣點膠囊把中段撐起來
      ...["零咖啡因", "低糖配方", "一天一瓶"].map((t, i) =>
        L.shape(`賣點底${i}`, 90, 560 + i * 110, 280, 84, { kind: "rect", fill: "#ffffff", radius: 42 })),
      ...["零咖啡因", "低糖配方", "一天一瓶"].map((t, i) =>
        L.text(`賣點${i}`, t, 90, 584 + i * 110, 280, 50, { fontSize: 30, color: "#a81f5c", fontFamily: SANS })),
      L.shape("右柱", 840, 560, 280, 300, { kind: "rect", fill: "#ffffff", radius: 20 }, { opacity: 0.55 }),
      L.text("右柱字", "SPRING\nLIMITED", 840, 620, 280, 160, {
        fontSize: 40, color: "#a81f5c", fontFamily: SANS,
      }),
      ...starOutline(880, 760, 120, "#ffffff", 20),
      L.shape("底帶", 0, 1090, S, 110, { kind: "rect", fill: "#d6376f" }),
      L.text("底帶字", "LIMITED  ·  NEW  ·  ENERGY", 0, 1120, S, 56, {
        fontSize: 32, color: "#ffe3ee", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    art: {
      name: "Y2K｜視窗介面",
      family: "dynamic",
      composition: "frame-within-frame",
      visualHierarchy: ["product", "headline", "badge"],
      visualWeight: { product: 9, headline: 6, badge: 4, decoration: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.36,
      rationale:
        "把商品裝進一個假的視窗介面裡，視窗本身就是畫框；視窗外圍的星星與格紋是「桌面」，內外兩層空間拉出層次，讓商品像被展示在螢幕上而不是貼在背景上，視線從視窗中心往外擴散又被外框收回。",
      recommendedFor: "數位感、聯名快閃",
    },
    layers: () => [
      L.bg("#ffc9dd", "#ff8fb8"),
      ...checkerCorner(0, 1040, 3, 54, "#ff6ba6"),
      ...starOutline(60, 80, 160, "#ffe3ee", -14),
      ...starOutline(1000, 940, 190, "#ffe3ee", 16),
      L.text("上標", "TODAY'S PICK", 0, 70, S, 50, {
        fontSize: 28, color: "#6e1338", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.4 },
      }),
      ...windowChrome("HEALTHY FOOD", 140, 170, 920, 820),
      L.shape("內容底", 180, 262, 840, 690, { kind: "rect", fill: "#ffeef5", radius: 6 }),
      ...product(PRODUCTS.amber, 460, 330, 300, 540, { shadow: false }),
      ...hashPill("每日一瓶", 220, 880, 240, { stroke: "#d6376f", fg: "#d6376f", fill: "#ffffff" }),
      ...hashPill("零負擔", 490, 880, 200, { stroke: "#d6376f", fg: "#d6376f", fill: "#ffffff" }),
      ...hashPill("好喝", 720, 880, 170, { stroke: "#d6376f", fg: "#d6376f", fill: "#ffffff" }),
      ...carouselDots(4, 0, S / 2, 1030, "#d6376f"),
    ],
  },
  {
    art: {
      name: "Y2K｜大字報價格",
      family: "promotional",
      composition: "dense-information",
      visualHierarchy: ["price", "headline", "product"],
      visualWeight: { price: 10, headline: 7, product: 5, decoration: 2 },
      readingDirection: "z-path",
      negativeSpace: 0.30,
      rationale:
        "價格用整塊深色底反白處理成第二個標題，與上方的弧形字形成上下兩個重量級；商品被夾在兩者之間縮到最小，視線走 Z 字最後落在價格上。",
      recommendedFor: "限時特價、清倉",
    },
    layers: () => [
      L.bg("#2b1440", "#5a1f6b"),
      ...checkerCorner(0, 0, 3, 56, "#ff6ba6"),
      ...starOutline(1010, 300, 150, "#ffd84d", 10),
      ...arcHeadline("SUPER SALE", 60, 120, 1080, 190, {
        fontSize: 128, from: "#ffd84d", to: "#ff8fb8", stroke: "#2b1440", strokeW: 0.13, warpAmount: 22,
      }),
      L.text("副標", "全站最低 3 折起", 0, 330, S, 70, {
        fontSize: 48, color: "#ffd84d", fontFamily: SANS,
      }),
      ...product(PRODUCTS.green, 480, 430, 240, 340, { rotation: 8 * DEG, shadow: false }),
      ...plusMarks([[180, 430, 30], [980, 620, 26], [200, 700, 22]], "#ff8fb8"),
      // 中段原本空一大塊，跟「dense-information」的主張矛盾——補三個條件標
      ...["全站不限品項", "滿 $1500 免運", "會員再 9 折"].map((t, i) =>
        L.shape(`條件底${i}`, 120 + i * 330, 620, 300, 84, { kind: "rect", fill: "#ffffff", radius: 42 })),
      ...["全站不限品項", "滿 $1500 免運", "會員再 9 折"].map((t, i) =>
        L.text(`條件${i}`, t, 120 + i * 330, 644, 300, 50, { fontSize: 28, color: "#5a1f6b", fontFamily: SANS })),
      L.shape("上緣條", 0, 0, S, 26, { kind: "rect", fill: "#ff3d84" }),
      L.shape("價格底", 60, 800, 1080, 320, { kind: "rect", fill: "#ff3d84", radius: 24 }),
      L.text("價格標籤", "限時 48 小時", 110, 840, 400, 56, {
        fontSize: 34, align: "left", color: "#ffe3ee", fontFamily: SANS,
      }),
      ...priceBlock("$199", "$599", 700, 830, { fg: "#ffffff", dim: "#ffd2e4" }),
      L.text("買幾送幾", "買一送一", 110, 920, 520, 150, {
        fontSize: 108, align: "left", color: "#ffffff", fontFamily: SANS,
      }),
    ],
  },
  {
    art: {
      name: "Y2K｜貼紙拼貼",
      family: "collage",
      composition: "collage",
      visualHierarchy: ["badge", "product", "decoration"],
      visualWeight: { badge: 9, product: 8, decoration: 5, copy: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.42,
      rationale:
        "所有元素都像被隨手貼上去的貼紙，各自有不同的傾角；刻意不對齊，靠傾角的方向差製造散落感，中央的商品是唯一保持正的，因此成為視線的停留點。",
      recommendedFor: "社群貼文、開箱",
    },
    layers: () => [
      L.bg("#fff0d6", "#ffd9a0"),
      ...starOutline(90, 120, 130, "#ff9f43", -12),
      ...starOutline(1010, 980, 150, "#ff9f43", 18),
      ...tapeLabel("NEW", 150, 250, 220, -8, { fill: "#ff6b6b", fg: "#ffffff", h: 62 }),
      ...tapeLabel("人氣 NO.1", 820, 300, 280, 10, { fill: "#4ecdc4", fg: "#083b38", h: 62 }),
      ...tapeLabel("回購率 92%", 140, 900, 300, 6, { fill: "#ffd84d", fg: "#5a3b00", h: 62 }),
      ...tapeLabel("免運", 860, 880, 190, -12, { fill: "#a78bfa", fg: "#ffffff", h: 62 }),
      L.shape("商品卡", 380, 360, 440, 480, { kind: "rect", fill: "#ffffff", radius: 18 }, { rotation: -3 * DEG }),
      ...product(PRODUCTS.white, 450, 390, 300, 420, { shadow: false }),
      L.text("主標", "開箱好物", 0, 110, S, 90, {
        fontSize: 76, color: "#8a4b00", fontFamily: SANS,
      }),
      // 原本空到 69%，跟 collage 的主張矛盾——補第二層貼紙與底紋卡
      L.shape("底紋卡", 60, 300, 260, 320, { kind: "rect", fill: "#ffe2b8", radius: 14 }, { rotation: 5 * DEG }),
      L.shape("底紋卡2", 880, 520, 250, 300, { kind: "rect", fill: "#ffe2b8", radius: 14 }, { rotation: -6 * DEG }),
      ...tapeLabel("成分公開", 90, 640, 250, -4, { fill: "#ffffff", fg: "#8a4b00", h: 58 }),
      ...tapeLabel("無香料", 900, 420, 210, 8, { fill: "#ffffff", fg: "#8a4b00", h: 58 }),
      L.text("小字", "編輯精選・本月最推", 0, 210, S, 50, {
        fontSize: 28, color: "#b06a14", fontFamily: SANS, fontWeight: 400,
      }),
      ...plusMarks([[300, 300, 28], [900, 700, 24], [240, 780, 20]], "#ff9f43"),
      ...carouselDots(5, 3, S / 2, 1090, "#c98a2e"),
    ],
  },
  {
    art: {
      name: "Y2K｜半調漸層",
      family: "dynamic",
      composition: "full-bleed-image",
      visualHierarchy: ["product", "headline", "copy"],
      visualWeight: { product: 10, headline: 6, copy: 3, decoration: 2 },
      readingDirection: "bottom-left→top-right",
      negativeSpace: 0.60,
      rationale:
        "整片漸層從左下的濃色往右上淡出，商品放在濃色端，標題放在淡出端；沒有任何框線或色塊分區，全靠這個明度梯度把畫面切開，視線自然順著亮度往上走。",
      recommendedFor: "形象主視覺、新品預告",
    },
    layers: () => [
      L.bg("#ff5fa2", "#ffe9f2"),
      ...starOutline(1010, 900, 160, "#ffffff", 14),
      ...product(PRODUCTS.pink, 90, 560, 480, 640, { rotation: -14 * DEG, shadow: false }),
      L.text("主標", "SPRING\nGLOW", 560, 220, 560, 300, {
        fontSize: 116, align: "left", color: "#ffffff", fontFamily: SANS,
        fx: { strokeColor: "#e0467f", strokeW: 0.08, shadow: true },
      }),
      L.text("內文", "一噴就亮的春日限定", 560, 540, 520, 60, {
        fontSize: 34, align: "left", color: "#8a1f4e", fontFamily: SANS, fontWeight: 400,
      }),
      ...plusMarks([[640, 640, 26], [700, 700, 20]], "#ffffff"),
      ...footnotes(["限定包裝售完為止，實際顏色以商品為準。"], 560, 760, 520, "#b3608a"),
    ],
  },
];

export { S };
