// AI 背景 ＋ 可編輯前景
//
// 「字框標題」原本靠純色底與外框撐場面，質感有限。這一版把背景換成 AI 生的
// 展示場景（黑色大理石、金色拱門、三座展示台），前景的標題、字框、標籤、
// 分隔線全部維持可編輯圖層——使用者改字、換商品、調位置都不會動到背景。
//
// 這是這個工具真正的用法：背景交給 AI，版面交給圖層。
import { L, S, product, PRODUCTS } from "./template-kit.mjs";
import { bracketPhrase, slashPhrase, photoTile, testimonialCard } from "./template-details.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const GOLD = "#c9a95f";
// 生出來的背景有四座台子（中間前方多一座），跟「三支一組」對不上。
// 試過用生成式填色移除，但周圍全是台子，模型照著周圍又補了一座回來——
// 跟「移除花瓣反而長出更多花瓣」是同一個失敗模式。
// 最後用正下方的乾淨地板把它補掉（羽化邊緣＋依透視壓暗），不花錢且結果可控。
const STAGE = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/1790068213806-pyo5l3m4y7h.jpg";

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
      ...product(PRODUCTS.amber, 520, 440, 160, 360, { shadow: false }),   // 中間台面 y≈800
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

/* ── 第二張示範：社群實測風（AI 紫色壓紋牆背景 ＋ 可編輯前景）────────── */

// 第一版的牆太淡，白字直接消失、紫字也糊在紫底上。重生一張飽和的深紫羅蘭。
const WALL = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/1790068969682-1ejqs2ku0th.jpg";
// 紫色精華瓶（已去背並裁掉透明邊），配合這張的紫色調
const VIOLET_BOTTLE = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/1790069007341-en011p0rj1.png";
const BEFORE = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/product-set-benefit-1789704497564-7ohx8a5yelr.jpg";
const AFTER = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/product-set-benefit-1789705738405-4ebuc4dh691.jpg";

FAMILY.push({
  art: {
    name: "社群實測｜UGC 見證（AI 背景＋可編輯前景）",
    family: "ecommerce",
    composition: "dense-information",
    visualHierarchy: ["headline", "product", "supportingImage"],
    visualWeight: { headline: 10, product: 7, supportingImage: 6, copy: 3, decoration: 1 },
    readingDirection: "top-left→bottom-right",
    negativeSpace: 0.30,
    rationale:
      "標題用括號把最關鍵的一句話框成第二個重量級，商品從左緣切進來當錨點，右側上下疊兩張實測照與一張見證卡；左重右密形成傾斜的視覺重心，視線被迫從標題斜著走到右下角的真人留言。",
    recommendedFor: "社群實測、開箱見證、口碑導購",
  },
  layers: () => [
    L.bg("#efe6fa", "#efe6fa"),
    { ...L.shape("AI 背景場景", 0, 0, S, S, { kind: "rect", fill: "#efe6fa" }),
      type: "background", image: WALL, shape: null, locked: true,
      name: "AI 背景場景（可換成你自己的）" },

    // 品牌
    L.text("品牌", "MIRAE", 0, 44, S, 70, { fontSize: 54, color: "#ffffff", fontFamily: SERIF }),
    L.text("品牌中文", "未 來 美", 0, 112, S, 44, {
      fontSize: 26, color: "#dcd2f5", fontFamily: SANS, fx: { letterSpacing: 0.3 },
    }),

    // 標題群：小標 → 大標 → 括號強調
    L.text("小標", "！超級 A 醇精華！", 60, 180, 560, 50, {
      fontSize: 34, align: "left", color: "#ffd9f0", fontFamily: SANS,
    }),
    L.text("大標", "實測抗老・煥膚", 60, 236, 620, 90, {
      fontSize: 68, align: "left", color: "#ffffff", fontFamily: SANS,
      fx: { strokeColor: "#2a1a5e", strokeW: 0.05 },
    }),
    ...bracketPhrase("7 天有感 ?!", 720, 228, 430, 104, { fg: "#ffffff", bracket: "#ffffff", fontSize: 60 }),
    ...slashPhrase("Dcard 卡友真心話大聲說", 60, 350, 600, 58, { fg: "#ffffff" }),

    // 商品：從左緣切進來
    // 用細長瓶而不是寬扁霜罐：圖層依原比例縮進框，寬扁的會被放大到佔滿整個左半邊
    ...product(VIOLET_BOTTLE, 60, 470, 300, 620, { shadow: false }),

    // 使用前後兩張實測照
    ...photoTile(BEFORE, 480, 440, 310, 300, { label: "使用前", labelColour: "#e7dcff" }),
    ...photoTile(AFTER, 830, 440, 310, 300, { label: "使用後", labelColour: "#ffffff" }),

    // 左下補三條實測數據：商品縮小後那塊空掉，而且這種版本來就該有數字
    ...["粗糙感 -62%", "痘疤明顯度 -48%", "保水度 +35%"].map((t, i) =>
      L.shape(`數據底${i}`, 60, 900 + i * 92, 360, 76, { kind: "rect", fill: "#ffffff", radius: 38 }, { opacity: 0.92 })),
    ...["粗糙感 -62%", "痘疤明顯度 -48%", "保水度 +35%"].map((t, i) =>
      L.text(`數據${i}`, t, 60, 920 + i * 92, 360, 44, {
        fontSize: 28, color: "#4a2f7a", fontFamily: SANS,
      })),

    // 見證卡
    ...testimonialCard(
      "東海大學－財務金融學系",
      ["質地水潤、好推不厚重，吸收很快", "使用一週後膚況穩定、痘疤淡化", "真的感覺到平滑不少"],
      470, 860, 690, 250,
    ),
  ],
});
