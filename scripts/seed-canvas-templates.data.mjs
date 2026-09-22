// 自由畫布的設計公版。1200×1200，只用形狀＋文字＋圖示，不夾任何圖片——
// 夾了圖每次套用都會帶進同一張示意商品，使用者還要手動刪。
//
// 第一版做出來像「有結構的版面」而不是「設計過的版」，因為只用了平色塊和平文字。
// 編輯器其實真的會畫這些，這版全部用上：
//   ・每層可旋轉（rotation 是弧度）→ 斜貼的貼紙標籤
//   ・文字粗描邊 fx.strokeW/strokeColor ＋ fx.shadow → 厚描邊標題字
//   ・文字漸層 fx.gradient、字距 fx.letterSpacing
//   ・形狀漸層、圓角、柔邊（softness）→ 光暈與層次
//   ・18 個內建圖示（star/heart/sparkle/leaf/sun/bolt/water-drop…）→ 裝飾點綴
//   ・在卡片後面墊一層偏移的深色塊 → 假造投影，做出堆疊感
const S = 1200;
const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const DEG = Math.PI / 180;

let seq = 0;
const base = (over) => {
  seq += 1;
  return {
    id: `l${seq}`, name: "圖層", type: "object", zIndex: seq,
    x: 0, y: 0, w: 100, h: 100, rotation: 0, visible: true, opacity: 1, locked: false,
    ...over,
  };
};

const shape = (name, x, y, w, h, spec, over = {}) => base({
  name, type: "object", x, y, w, h,
  shape: { kind: "rect", fill: "#ffffff", stroke: "none", strokeWidth: 0, ...spec },
  ...over,
});

const text = (name, content, x, y, w, h, over = {}) => base({
  name, type: "independent_text", x, y, w, h,
  isText: true, text: content, color: "#1f2937", fontSize: 56,
  fontFamily: SANS, fontWeight: 700, align: "center",
  ...over,
});

const icon = (name, iconName, x, y, size, fill, over = {}) =>
  shape(name, x, y, size, size, { kind: "icon", icon: iconName, fill }, over);

/** 卡片＋後面墊一層偏移深色塊，做出堆疊投影感。 */
const card = (name, x, y, w, h, fill, radius = 28, shadow = "#00000014") => [
  shape(`${name}投影`, x + 14, y + 16, w, h, { kind: "rect", fill: shadow, radius }),
  shape(name, x, y, w, h, { kind: "rect", fill, radius }),
];

/**
 * 商品位：直接放一張示意商品圖，不是空虛框。
 *
 * 空框只說明「這裡放商品」，看不出擺多大、擺哪裡好看。放真的圖之後，
 * 使用者換成自己的商品或直接刪掉都很快，而且一眼就知道這個版的比例感。
 * 底下墊一個柔邊橢圓當落地陰影，商品才不會像浮在半空。
 */
const SAMPLE_PRODUCT = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/product-set-hero-1789962056557-1ocqi87cfc1h.png";
const slot = (x, y, w, h) => [
  shape("商品陰影", x + w * 0.12, y + h * 0.86, w * 0.76, h * 0.1,
    { kind: "ellipse", fill: "#000000", softness: 0.9 }, { opacity: 0.16 }),
  base({
    name: "示意商品（換成你的商品，或直接刪掉）",
    type: "object", x, y, w, h, image: SAMPLE_PRODUCT,
  }),
];

const bg = (from, to, axis = "vertical") =>
  shape("背景", 0, 0, S, S, { kind: "rect", fill: from, gradient: { axis, from, to } }, { type: "background", locked: true });

/** 斜貼的貼紙標籤（色塊＋字一起轉同角度）。 */
const sticker = (label, x, y, w, h, deg, fill, color = "#ffffff", fontSize = 34) => [
  shape(`${label}底`, x, y, w, h, { kind: "rect", fill, radius: h / 2 }, { rotation: deg * DEG }),
  text(`${label}字`, label, x, y + h * 0.26, w, h * 0.5, {
    fontSize, color, rotation: deg * DEG, fx: { letterSpacing: 0.12 },
  }),
];

export const TEMPLATES = [
  {
    name: "01 厚描邊標題・貼紙風",
    layers: () => [
      bg("#fff8ec", "#ffeccd"),
      // 標題放在卡片下方而不是壓在卡片邊緣上——壓著會看起來像沒排好
      ...card("主卡", 110, 230, 980, 560, "#ffffff", 40),
      ...slot(270, 300, 660, 420),
      text("主標", "春季新品", 110, 830, 980, 150, {
        fontSize: 132, color: "#2f2a24",
        fx: { strokeColor: "#ffffff", strokeW: 0.14, shadow: true },
      }),
      ...sticker("NEW ARRIVAL", 90, 160, 380, 96, -7, "#4caf7d"),
      icon("裝飾星", "sparkle", 990, 180, 110, "#f5c451", { rotation: 12 * DEG }),
      icon("裝飾心", "heart", 100, 855, 80, "#f28b82", { rotation: -14 * DEG }),
      text("副標", "集結當季最療癒的保養提案", 110, 1000, 980, 60, {
        fontSize: 36, fontWeight: 400, color: "#7d7367",
      }),
    ],
  },
  {
    name: "02 折扣印章・斜角徽章",
    layers: () => [
      bg("#fdf3f1", "#f7ddd8"),
      ...card("主卡", 130, 300, 940, 640, "#ffffff", 36),
      ...slot(270, 370, 660, 500),
      text("主標", "雙件組", 100, 110, 1000, 130, {
        fontSize: 116, color: "#7a2f28", fx: { letterSpacing: 0.06 },
      }),
      shape("徽章外圈", 840, 120, 300, 300, { kind: "ellipse", fill: "#d94f45" }, { rotation: -10 * DEG }),
      shape("徽章內圈", 866, 146, 248, 248, { kind: "ellipse", fill: "none", stroke: "#ffffff", strokeWidth: 4 }, { rotation: -10 * DEG }),
      text("折數", "88", 840, 195, 300, 120, {
        fontSize: 108, color: "#ffffff", rotation: -10 * DEG,
        fx: { shadow: true },
      }),
      text("折字", "折", 840, 310, 300, 60, { fontSize: 40, color: "#ffe3e0", rotation: -10 * DEG }),
      text("副標", "任選兩件・現折 12%", 100, 250, 700, 60, {
        fontSize: 38, fontWeight: 400, align: "left", color: "#a5736c",
      }),
      icon("裝飾閃", "sparkle", 150, 880, 74, "#e8a99f", { rotation: -18 * DEG }),
      text("頁尾", "活動至 3/31 止", 100, 980, 1000, 50, { fontSize: 30, fontWeight: 400, color: "#b08a84" }),
    ],
  },
  {
    name: "03 四效合一・圓形賣點",
    layers: () => [
      bg("#eef4fb", "#dde9f7"),
      shape("光暈", 300, 300, 600, 600, { kind: "ellipse", fill: "#ffffff", softness: 0.8 }, { opacity: 0.7 }),
      text("主標", "四效合一", 100, 80, 1000, 120, {
        fontSize: 100, color: "#17365c",
        fx: { strokeColor: "#ffffff", strokeW: 0.1, shadow: true },
      }),
      ...slot(430, 400, 340, 380),
      ...[
        ["美白淡斑", 70, 300, "sparkle"],
        ["抗痘消炎", 880, 300, "shield"],
        ["注水發光", 70, 640, "water-drop"],
        ["修護防曬", 880, 640, "sun"],
      ].flatMap(([label, x, y, ic], i) => [
        shape(`賣點底${i + 1}`, x, y, 250, 250, { kind: "ellipse", fill: "#ffffff" }),
        shape(`賣點圈${i + 1}`, x + 8, y + 8, 234, 234, { kind: "ellipse", fill: "none", stroke: "#bfd6ee", strokeWidth: 3 }),
        icon(`賣點圖${i + 1}`, ic, x + 90, y + 52, 70, "#3f7bc4"),
        text(`賣點字${i + 1}`, label, x, y + 145, 250, 60, { fontSize: 36, color: "#1f4a7d" }),
      ]),
      text("頁尾", "1 盒 60 顆｜1 天 2 顆", 100, 1040, 1000, 60, {
        fontSize: 32, fontWeight: 400, color: "#54769f",
      }),
    ],
  },
  {
    name: "04 大字報・深色限時",
    layers: () => [
      bg("#12131a", "#25283a"),
      icon("角落星1", "sparkle", 90, 120, 60, "#f2c94c", { rotation: -20 * DEG }),
      icon("角落星2", "sparkle", 1040, 980, 70, "#f2c94c", { rotation: 15 * DEG }),
      text("小標", "LIMITED TIME", 100, 120, 1000, 60, {
        fontSize: 34, fontWeight: 400, color: "#a8adc4", fx: { letterSpacing: 0.35 },
      }),
      text("主標", "限時三天", 100, 190, 1000, 200, {
        fontSize: 168, color: "#ffffff",
        fx: { gradient: ["#ffffff", "#ffd97a"], shadow: true },
      }),
      shape("分隔線", 100, 420, 1000, 4, { kind: "rect", fill: "#4a4f6b" }),
      ...slot(340, 490, 520, 420),
      ...sticker("SALE", 880, 420, 230, 84, 8, "#e0483d"),
      text("頁尾", "3/1 — 3/3 全站同慶", 100, 960, 1000, 70, {
        fontSize: 42, fontWeight: 400, color: "#d8dcea",
      }),
    ],
  },
  {
    name: "05 價格卡・新客優惠",
    layers: () => [
      bg("#ffffff", "#f4efff"),
      ...card("商品卡", 90, 300, 560, 620, "#faf7ff", 32),
      ...slot(150, 360, 440, 500),
      ...card("價格卡", 700, 380, 410, 380, "#6d28d9", 30, "#6d28d933"),
      text("價格標籤", "新客優惠", 700, 420, 410, 60, { fontSize: 34, fontWeight: 400, color: "#ddd0ff" }),
      text("價格", "$320", 700, 490, 410, 140, {
        fontSize: 116, color: "#ffffff", fx: { shadow: true },
      }),
      text("原價", "原價 $420", 700, 645, 410, 50, { fontSize: 30, fontWeight: 400, color: "#bfa6f0" }),
      text("主標", "體驗組", 90, 120, 1020, 130, {
        fontSize: 104, align: "left", color: "#2e1065", fx: { letterSpacing: 0.04 },
      }),
      text("副標", "四件入門組・一次擁有", 90, 250, 1020, 60, {
        fontSize: 38, fontWeight: 400, align: "left", color: "#7c5bb0",
      }),
      icon("裝飾閃", "sparkle", 620, 240, 66, "#c4b0f0", { rotation: 18 * DEG }),
    ],
  },
  {
    name: "06 雜誌感・襯線細框",
    layers: () => [
      bg("#fbfaf8", "#f4f1eb"),
      shape("外框", 70, 70, 1060, 1060, { kind: "rect", fill: "none", stroke: "#2b2b2b", strokeWidth: 2 }),
      text("上標", "SKINCARE EDIT", 120, 140, 960, 50, {
        fontSize: 28, fontWeight: 400, color: "#8b8378", fontFamily: SERIF, fx: { letterSpacing: 0.3 },
      }),
      text("主標", "瞬間補水", 120, 205, 960, 150, {
        fontSize: 124, color: "#1c1c1c", fontFamily: SERIF,
      }),
      shape("短線", 120, 380, 180, 3, { kind: "rect", fill: "#1c1c1c" }),
      ...slot(330, 450, 540, 470),
      text("引文", "「30 秒，換一張透明感的臉」", 120, 960, 960, 60, {
        fontSize: 40, fontWeight: 400, color: "#4a4a4a", fontFamily: SERIF,
      }),
      text("頁尾", "12 月刊", 120, 1030, 960, 50, { fontSize: 28, fontWeight: 400, color: "#9b9388", fontFamily: SERIF }),
    ],
  },
  {
    name: "07 三賣點・編號直排",
    layers: () => [
      bg("#fbfaf7", "#f1ece1"),
      text("主標", "為什麼選我們", 100, 120, 900, 120, {
        fontSize: 86, align: "left", color: "#33291c", fx: { letterSpacing: 0.04 },
      }),
      shape("直線", 112, 320, 4, 520, { kind: "rect", fill: "#b08d57" }),
      ...[["日本專利成分", 320], ["無添加香精色素", 490], ["回購率第一名", 660]].flatMap(([label, y], i) => [
        shape(`編號底${i + 1}`, 78, y - 6, 72, 72, { kind: "ellipse", fill: "#b08d57" }),
        text(`編號${i + 1}`, `0${i + 1}`, 78, y + 12, 72, 44, { fontSize: 32, color: "#ffffff" }),
        text(`賣點${i + 1}`, label, 180, y + 4, 700, 60, {
          fontSize: 44, fontWeight: 400, align: "left", color: "#4f4233",
        }),
      ]),
      ...slot(700, 800, 400, 320),
      icon("裝飾葉", "leaf", 960, 150, 96, "#c9b48c", { rotation: 20 * DEG }),
    ],
  },
  {
    name: "08 柔霧漸層・主視覺",
    layers: () => [
      bg("#efe9fa", "#cdc2ee"),
      shape("光暈大", 200, 240, 800, 800, { kind: "ellipse", fill: "#ffffff", softness: 0.9 }, { opacity: 0.55 }),
      shape("光暈小", 760, 160, 280, 280, { kind: "ellipse", fill: "#ffffff", softness: 0.9 }, { opacity: 0.4 }),
      ...slot(360, 400, 480, 470),
      text("主標", "溫和修護", 100, 130, 1000, 130, {
        fontSize: 108, color: "#372a63",
        fx: { strokeColor: "#ffffff", strokeW: 0.09, shadow: true },
      }),
      text("副標", "敏弱肌也能安心使用", 100, 268, 1000, 60, { fontSize: 38, fontWeight: 400, color: "#6d5fa8" }),
      ...card("按鈕", 390, 980, 420, 96, "#ffffff", 48, "#372a6322"),
      text("按鈕字", "立即選購", 390, 1005, 420, 50, { fontSize: 38, color: "#372a63" }),
      icon("裝飾閃1", "sparkle", 150, 380, 64, "#a794e0", { rotation: -12 * DEG }),
      icon("裝飾閃2", "sparkle", 1020, 760, 54, "#a794e0", { rotation: 22 * DEG }),
    ],
  },
  {
    name: "09 前後對比・雙欄卡片",
    layers: () => [
      bg("#f4f8f6", "#e4efea"),
      text("主標", "使用前後", 100, 100, 1000, 120, {
        fontSize: 94, color: "#1c3d33",
        fx: { strokeColor: "#ffffff", strokeW: 0.08 },
      }),
      ...card("左卡", 80, 300, 480, 580, "#ffffff", 26),
      ...card("右卡", 640, 300, 480, 580, "#ffffff", 26),
      ...sticker("BEFORE", 120, 330, 220, 68, -4, "#9fb3ad", "#ffffff", 28),
      ...sticker("AFTER", 680, 330, 220, 68, 4, "#2f7a60", "#ffffff", 28),
      ...slot(130, 430, 380, 400),
      ...slot(690, 430, 380, 400),
      text("頁尾", "連續使用 4 週的紀錄", 100, 930, 1000, 60, {
        fontSize: 36, fontWeight: 400, color: "#3f6b5d",
      }),
      icon("裝飾箭", "arrow", 570, 560, 70, "#2f7a60"),
    ],
  },
  {
    name: "10 極簡留白・置中單品",
    layers: () => [
      bg("#f8f6f3", "#ece7e0"),
      text("上標", "PURE CARE", 150, 130, 900, 50, {
        fontSize: 28, fontWeight: 400, color: "#a79f94", fx: { letterSpacing: 0.4 },
      }),
      text("主標", "純淨保養", 150, 195, 900, 130, { fontSize: 110, color: "#2b2723" }),
      text("副標", "每天三分鐘・養出透亮肌", 150, 335, 900, 60, {
        fontSize: 36, fontWeight: 400, color: "#847b70",
      }),
      shape("底座", 330, 840, 540, 60, { kind: "ellipse", fill: "#000000", softness: 0.9 }, { opacity: 0.1 }),
      ...slot(360, 440, 480, 420),
      shape("細線", 520, 960, 160, 2, { kind: "rect", fill: "#c4bbae" }),
      text("頁尾", "BRAND NAME", 150, 1000, 900, 50, {
        fontSize: 28, fontWeight: 400, color: "#a79f94", fx: { letterSpacing: 0.25 },
      }),
    ],
  },
];

export const DOC = S;
