// Family 04 — Luxury
//
// 家族氣質：精品。深色底、金線、襯線字、極端留白。細節走「少而精準」——
// 髮絲線、小字英文、頂點裝飾，而不是貼紙與塗鴉。
// 這一家族的張力來自克制：元素越少，每個元素的位置就越不能錯。
import { L, S, DEG, product, PRODUCTS } from "./template-kit.mjs";
import { footnotes, haloRing, carouselDots, radarPolygon, charBoxes } from "./template-details.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const GOLD = "#b99a5b";

/** 精品常見的細金線 ＋ 兩端小菱形。 */
const goldRule = (x, y, w, colour = GOLD) => [
  L.shape("金線", x, y, w, 1, { kind: "rect", fill: colour }),
  L.shape("金菱左", x - 5, y - 5, 11, 11, { kind: "diamond", fill: colour }),
  L.shape("金菱右", x + w - 6, y - 5, 11, 11, { kind: "diamond", fill: colour }),
];

export const FAMILY = [
  {
    art: {
      name: "Luxury｜黑金雙欄",
      family: "luxury",
      composition: "split-screen",
      visualHierarchy: ["headline", "product", "copy"],
      visualWeight: { headline: 9, product: 7, copy: 3, decoration: 2 },
      readingDirection: "left→right",
      negativeSpace: 0.17,
      rationale:
        "畫面左右切成深與更深兩塊，分界不用線而用明度差；標題壓在分界上跨越兩邊，商品退到右側暗處只露出金屬光，留白讓視線在分界線上來回而不急著往下。",
      recommendedFor: "高單價保養、禮盒",
    },
    layers: () => [
      L.bg("#0b0b0e", "#16161c"),
      L.shape("右半", 620, 0, 580, S, { kind: "rect", fill: "#1d1d25" }),
      L.text("上標", "MAISON", 90, 130, 460, 46, {
        fontSize: 24, align: "left", color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.6 },
      }),
      L.text("主標", "夜間\n黃金修護", 90, 220, 700, 340, {
        fontSize: 108, align: "left", color: "#f3ecdd", fontFamily: SERIF,
      }),
      ...goldRule(92, 620, 200),
      L.text("內文", "24K 金箔・八小時滲透\n晨起的第一眼就知道", 90, 670, 460, 120, {
        fontSize: 26, align: "left", color: "#8e8878", fontFamily: SANS, fontWeight: 400,
      }),
      ...product(PRODUCTS.amber, 720, 380, 380, 560, { shadow: false }),
      L.shape("底帶", 0, 1020, S, 180, { kind: "rect", fill: "#08080b" }),
      L.text("底帶字", "MAISON  ·  NIGHT GOLD  ·  30ML", 0, 1060, S, 56, {
        fontSize: 24, color: "#8e8878", fontFamily: SERIF, fx: { letterSpacing: 0.3 },
      }),
      L.text("編號", "N°  0 4", 90, 1120, 300, 44, {
        fontSize: 22, align: "left", color: "#6b6558", fontFamily: SERIF, fx: { letterSpacing: 0.4 },
      }),
    ],
  },
  {
    art: {
      name: "Luxury｜置中儀式感",
      family: "luxury",
      composition: "luxury-minimal",
      visualHierarchy: ["product", "headline", "decoration"],
      visualWeight: { product: 10, headline: 6, decoration: 3, copy: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.50,
      rationale:
        "商品置中並被兩圈細金環托住，上下各一條等長的金線把它夾在中央；刻意對稱，因為儀式感來自秩序，留白佔六成讓這個秩序有呼吸的餘地。",
      recommendedFor: "週年紀念、聯名限定",
    },
    layers: () => [
      L.bg("#111014", "#1c1a20"),
      ...haloRing(600, 600, 300, GOLD, 1),
      ...haloRing(600, 600, 340, "#6b5a33", 1),
      ...goldRule(400, 210, 400),
      L.text("上標", "LIMITED EDITION", 0, 240, S, 46, {
        fontSize: 22, color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.55 },
      }),
      ...product(PRODUCTS.amber, 440, 360, 320, 520, { shadow: false }),
      L.text("主標", "琥珀之夜", 250, 920, 700, 110, {
        fontSize: 82, color: "#f3ecdd", fontFamily: SERIF,
      }),
      ...goldRule(400, 1010, 400),
      L.text("內文", "全球限量 500 瓶", 0, 1040, S, 50, {
        fontSize: 24, color: "#8e8878", fontFamily: SANS, fontWeight: 400,
      }),
    ],
  },
  {
    art: {
      name: "Luxury｜成分雷達",
      family: "luxury",
      composition: "dense-information",
      visualHierarchy: ["copy", "product", "decoration"],
      visualWeight: { copy: 9, product: 6, decoration: 4, badge: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.30,
      rationale:
        "五角雷達把五個功效放在頂點，中心連線構成一個可讀的形狀，商品疊在形狀正中成為重心；資訊不是列成清單而是變成圖形，視線先被輻射狀的線條引導繞一圈再收回中央，形成閉環的動線。",
      recommendedFor: "多功效成分說明",
    },
    layers: () => [
      L.bg("#141319", "#1f1d26"),
      L.text("主標", "五效合一", 0, 100, S, 100, {
        fontSize: 72, color: "#f3ecdd", fontFamily: SERIF,
      }),
      ...goldRule(470, 220, 260),
      L.shape("雷達舞台", 90, 290, 1020, 700, { kind: "rect", fill: "#191722", radius: 12 }),
      ...radarPolygon(600, 640, 260, ["肌膚透亮", "淡化細紋", "緊緻輪廓", "修護屏障", "均勻膚色"],
        { line: GOLD, dot: GOLD, fg: "#cbbf9f" }),
      ...product(PRODUCTS.amber, 520, 500, 160, 280, { shadow: false }),
      // 雷達只有細線，覆蓋率極低；補一塊底板與五行規格才對得起 dense-information
      L.shape("底板", 70, 950, 1060, 200, { kind: "rect", fill: "#1c1a23", radius: 8 }),
      ...["透亮 92%", "細紋 78%", "緊緻 81%", "屏障 88%", "膚色 74%"].map((t, i) =>
        L.text(`規格${i}`, t, 90 + i * 208, 990, 200, 50, {
          fontSize: 26, color: "#cbbf9f", fontFamily: SANS, fontWeight: 400,
        })),
      ...footnotes([
        "功效評估來自品牌自行委託之消費者感受調查。",
        "個人膚況不同，實際感受可能有差異。",
      ], 90, 1060, 700, "#6b6558"),
      ...carouselDots(5, 2, 1020, 1070, GOLD),
    ],
  },
  {
    art: {
      name: "Luxury｜襯線破邊",
      family: "luxury",
      composition: "image-cutout",
      visualHierarchy: ["product", "headline", "copy"],
      visualWeight: { product: 10, headline: 7, copy: 3 },
      readingDirection: "bottom-left→top-right",
      negativeSpace: 0.39,
      rationale:
        "商品從左下切出畫布、只留上半截，缺掉的部分由右上的襯線標題補上重量；兩個重心分別落在對角線兩端，中間的空白就是這條對角動線本身。",
      recommendedFor: "單品主視覺",
    },
    layers: () => [
      L.bg("#0e0d11", "#1a1820"),
      ...product(PRODUCTS.green, -80, 560, 620, 860, { shadow: false }),
      L.text("上標", "SIGNATURE", 620, 180, 500, 46, {
        fontSize: 22, align: "left", color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.55 },
      }),
      L.text("主標", "翡翠\n精粹", 620, 250, 500, 340, {
        fontSize: 116, align: "left", color: "#f0ece1", fontFamily: SERIF,
      }),
      ...goldRule(622, 640, 180),
      L.text("內文", "冷萃工法保留完整活性", 620, 690, 460, 60, {
        fontSize: 26, align: "left", color: "#8e8878", fontFamily: SANS, fontWeight: 400,
      }),
      L.shape("側線", 1140, 180, 2, 700, { kind: "rect", fill: "#4b4436" }),
      L.shape("規格底板", 600, 770, 540, 310, { kind: "rect", fill: "#181620", radius: 10 }),
      ...["冷萃", "無酒精", "純素"].map((t, i) =>
        L.shape(`規格底${i}`, 620, 800 + i * 86, 300, 66, { kind: "rect", fill: "none", stroke: "#4b4436", strokeWidth: 1 })),
      ...["冷萃工法", "無酒精", "純素配方"].map((t, i) =>
        L.text(`規格字${i}`, t, 620, 818 + i * 86, 300, 44, {
          fontSize: 24, color: "#9b9484", fontFamily: SANS, fontWeight: 400,
        })),
      L.text("容量", "30 ML", 620, 1080, 300, 44, {
        fontSize: 22, align: "left", color: "#6b6558", fontFamily: SERIF, fx: { letterSpacing: 0.4 },
      }),
    ],
  },
  {
    art: {
      name: "Luxury｜字框標題",
      family: "luxury",
      composition: "typography-as-image",
      visualHierarchy: ["headline", "copy", "product"],
      visualWeight: { headline: 10, copy: 5, product: 4, decoration: 2 },
      readingDirection: "top→bottom",
      negativeSpace: 0.39,
      rationale:
        "標題的每個字各自被一個金色細框關住，字距因此被框的節奏決定而不是字本身；框的重複形成一條水平節拍，下方的商品縮到很小，靠對比把重量全部讓給標題。",
      recommendedFor: "品牌概念、系列命名",
    },
    layers: () => [
      L.bg("#15131a", "#221f2b"),
      L.text("上標", "THE COLLECTION", 0, 150, S, 46, {
        fontSize: 22, color: GOLD, fontFamily: SERIF, fx: { letterSpacing: 0.6 },
      }),
      ...charBoxes("金萃系列", 300, 260, 130, { stroke: GOLD, fg: "#f3ecdd", gap: 20 }),
      L.text("副標", "GOLD ESSENCE SERIES", 0, 440, S, 50, {
        fontSize: 24, color: "#8e8878", fontFamily: SERIF, fx: { letterSpacing: 0.4 },
      }),
      ...goldRule(450, 530, 300),
      ...product(PRODUCTS.amber, 520, 620, 170, 300, { shadow: false }),
      L.text("內文", "以冷萃金萃為核心，三支一組完成整套夜間儀式。", 0, 1005, S, 60, {
        fontSize: 26, color: "#9b9484", fontFamily: SANS, fontWeight: 400,
      }),
      L.shape("系列底板", 60, 620, 1080, 380, { kind: "rect", fill: "#1a1722", radius: 10 }),
      ...[0, 1, 2].map((i) =>
        L.shape(`系列格${i}`, 240 + i * 250, 700, 210, 240, { kind: "rect", fill: "#1e1b26", stroke: "#4b4436", strokeWidth: 1 })),
      // 空框本來就該放東西：三支小商品讓「系列」這件事被看見，也真的把密度撐起來
      ...product(PRODUCTS.white, 285, 720, 120, 190, { shadow: false }),
      ...product(PRODUCTS.amber, 535, 720, 120, 190, { shadow: false }),
      ...product(PRODUCTS.green, 785, 720, 120, 190, { shadow: false }),
      ...["清潔", "精華", "面霜"].map((t, i) =>
        L.text(`系列字${i}`, t, 240 + i * 250, 960, 210, 44, {
          fontSize: 24, color: "#9b9484", fontFamily: SANS, fontWeight: 400,
        })),
      L.shape("底帶", 0, 1050, S, 150, { kind: "rect", fill: "#1b1822" }),
      L.text("底帶字", "MAISON  ·  GOLD ESSENCE  ·  SINCE 1998", 0, 1080, S, 56, {
        fontSize: 24, color: "#8e8878", fontFamily: SERIF, fx: { letterSpacing: 0.3 },
      }),
      ...carouselDots(3, 1, S / 2, 1150, GOLD),
    ],
  },
];

export { S };
