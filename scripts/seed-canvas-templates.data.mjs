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
 * 空框只說明「這裡放商品」，看不出擺多大、擺哪裡好看。放真的圖之後
 * 一眼就知道這個版的比例感，換成自己的或直接刪掉都很快。
 *
 * 每個版刻意給不同的尺寸、位置與角度——第一版十個版的商品全都一樣大、
 * 一樣置中，那就是「範本感」最大的來源。這裡允許座標超出畫布（出血裁切）。
 */
const SAMPLE_PRODUCT = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/product-set-hero-1789962056557-1ocqi87cfc1h.png";
const product = (x, y, w, h, over = {}) => [
  ...(over.shadow === false ? [] : [shape("商品陰影", x + w * 0.14, y + h * 0.88, w * 0.72, h * 0.08,
    { kind: "ellipse", fill: "#000000", softness: 0.9 }, { opacity: 0.18 })]),
  base({
    name: "示意商品（換成你的商品，或直接刪掉）",
    type: "object", x, y, w, h,
    ...(over.rotation ? { rotation: over.rotation } : {}),
    ...(over.opacity !== undefined ? { opacity: over.opacity } : {}),
    image: SAMPLE_PRODUCT,
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


/* ── 系列組合（墨綠實證風）共用零件 ────────────────────────────────
   六張共用同一套裝置，改一次全組跟著改；這正是「一組」跟「六個獨立版」的差別。 */

/** 圓角玻璃卡：整組內容都放在這張卡上。 */
const glassCard = () => [
  shape("卡片", 80, 180, 1040, 840, {
    kind: "rect", radius: 56, fill: "#7aa862",
    gradient: { axis: "vertical", from: "#86b46d", to: "#5d8f4d" },
  }),
];

/** 標題裝置：白細框中文標題 ＋ 右上角英文小標。 */
const cardTitle = (zh, en) => [
  shape("標題框", 150, 250, 520, 130, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 3 }),
  text("標題", zh, 150, 275, 520, 90, { fontSize: 76, color: "#ffffff" }),
  text("英文小標", en, 760, 260, 290, 110, {
    fontSize: 26, fontWeight: 400, align: "right", color: "#d6e8c8", fx: { letterSpacing: 0.15 },
  }),
];

/** 數據列：白髮絲線 ＋ 標籤 ＋ 深綠色塊裡的大數字 ＋ 右上角註記。 */
const dataRow = (label, value, note, y) => [
  shape(`線${y}`, 150, y - 60, 900, 2, { kind: "rect", fill: "#ffffff" }, { opacity: 0.55 }),
  text(`註${y}`, note, 760, y - 45, 290, 40, { fontSize: 24, fontWeight: 400, align: "right", color: "#e4f0da" }),
  text(`標${y}`, label, 160, y + 20, 380, 90, { fontSize: 66, align: "left", color: "#ffffff" }),
  shape(`塊${y}`, 570, y, 480, 130, { kind: "rect", fill: "#1d4a25", radius: 10 }),
  text(`值${y}`, value, 570, y + 25, 480, 90, { fontSize: 76, color: "#ffffff" }),
];

/** 成分列：深綠標籤塊 ＋ 底下一行白色說明。 */
const chipRow = (chip, desc, y) => [
  shape(`線${y}`, 150, y - 50, 900, 2, { kind: "rect", fill: "#ffffff" }, { opacity: 0.55 }),
  shape(`塊${y}`, 160, y, 620, 96, { kind: "rect", fill: "#1d4a25", radius: 8 }),
  text(`塊字${y}`, chip, 160, y + 18, 620, 66, { fontSize: 54, color: "#ffffff" }),
  text(`說明${y}`, desc, 160, y + 115, 800, 60, {
    fontSize: 40, fontWeight: 400, align: "left", color: "#ffffff",
  }),
];

/** 粗描邊標題膠囊（封面與行動呼籲用）。 */
const lozenge = (label, x, y, w, h) => [
  shape(`${label}底`, x, y, w, h, { kind: "rect", fill: "#12331d", radius: 8 }),
  text(`${label}字`, label, x, y + h * 0.26, w, h * 0.5, {
    fontSize: h * 0.42, color: "#ffffff", fx: { letterSpacing: 0.1 },
  }),
];


/**
 * 把照 3:4 海報比例排好的版等比縮進 1:1。
 *
 * 直式海報的資訊密度本來就比正方形高，硬改座標會把間距拆散；等比縮小再置中，
 * 版面關係完全不變，左右留白也成為刻意的邊距。背景維持滿版不動。
 */
const asSquare = (layers, fromH = 1440) => {
  const k = S / fromH;
  const dx = (S - S * k) / 2;
  return layers.map((l) => (l.type === "background" ? l : {
    ...l,
    x: Math.round(l.x * k + dx), y: Math.round(l.y * k),
    w: Math.round(l.w * k), h: Math.round(l.h * k),
    ...(l.isText ? { fontSize: Math.round(l.fontSize * k) } : {}),
  }));
};

export const TEMPLATES = [
  {
    // 主張：商品放到最大並裁切出血，標題壓在商品上。極端的尺寸對比。
    name: "01 巨型商品・出血裁切",
    layers: () => [
      bg("#f3efe8", "#e7e0d4"),
      ...product(300, 240, 900, 1100, { shadow: false }),
      text("小標", "NEW", 90, 150, 300, 60, {
        fontSize: 30, fontWeight: 400, align: "left", color: "#8a8378", fx: { letterSpacing: 0.45 },
      }),
      text("主標", "春季\n新品", 90, 230, 620, 400, {
        fontSize: 186, align: "left", color: "#22201c",
      }),
      shape("細線", 92, 690, 120, 3, { kind: "rect", fill: "#22201c" }),
      text("內文", "集結當季最療癒的保養提案", 90, 730, 480, 50, {
        fontSize: 27, fontWeight: 400, align: "left", color: "#6f675c",
      }),
    ],
  },
  {
    // 主張：整片深色色塊佔左半，商品跨過分界，字反白壓在色塊上。
    name: "02 色塊分割・跨界商品",
    layers: () => [
      bg("#faf7f2", "#f2ece2"),
      shape("色塊", 0, 0, 660, 1200, { kind: "rect", fill: "#1f3d34", gradient: { axis: "vertical", from: "#24463b", to: "#16302a" } }),
      text("小標", "LIMITED SET", 90, 160, 480, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#8fbfae", fx: { letterSpacing: 0.4 },
      }),
      text("主標", "雙件組", 90, 230, 520, 200, { fontSize: 150, align: "left", color: "#ffffff" }),
      text("內文", "任選兩件\n現折 12%", 90, 470, 420, 140, {
        fontSize: 34, fontWeight: 400, align: "left", color: "#bcd8cd",
      }),
      ...product(420, 520, 620, 700),
      shape("徽章", 880, 120, 230, 230, { kind: "ellipse", fill: "#e2b857" }, { rotation: -12 * DEG }),
      text("折數", "88", 880, 175, 230, 110, { fontSize: 104, color: "#1f3d34", rotation: -12 * DEG }),
      text("折字", "折", 880, 275, 230, 50, { fontSize: 34, color: "#6b5416", rotation: -12 * DEG }),
    ],
  },
  {
    // 主張：圓形舞台在上、價格資訊橫排在下。價格與圓不要互相壓，各自佔一條。
    name: "03 圓形舞台・價格橫排",
    layers: () => [
      bg("#fff3d9", "#ffe4b0"),
      shape("舞台圓", 220, 110, 760, 760, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.9 }),
      text("上標", "SPECIAL OFFER", 220, 180, 760, 50, {
        fontSize: 26, fontWeight: 400, color: "#b08637", fx: { letterSpacing: 0.5 },
      }),
      ...product(430, 250, 340, 500),
      shape("分隔線", 90, 920, 1020, 2, { kind: "rect", fill: "#e0c894" }),
      text("價格", "$320", 90, 960, 640, 220, {
        fontSize: 200, align: "left", color: "#e0563d",
      }),
      text("價格說明", "新客限定", 760, 990, 350, 60, {
        fontSize: 40, align: "left", color: "#8a6b2f",
      }),
      text("原價", "原價 $420", 760, 1055, 350, 50, {
        fontSize: 28, fontWeight: 400, align: "left", color: "#b39a6a",
      }),
    ],
  },
  {
    // 主張：全黑、金線細框、襯線字。商品刻意小，靠留白撐起質感。
    name: "04 極致深色・金線質感",
    layers: () => [
      bg("#0d0d10", "#17171d"),
      shape("金框", 80, 80, 1040, 1040, { kind: "rect", fill: "none", stroke: "#8d7434", strokeWidth: 2 }),
      text("上標", "PREMIUM CARE", 140, 160, 920, 50, {
        fontSize: 24, fontWeight: 400, color: "#c2a35d", fontFamily: SERIF, fx: { letterSpacing: 0.6 },
      }),
      ...product(480, 250, 240, 360, { shadow: false }),
      text("主標", "夜間修護", 140, 680, 920, 160, {
        fontSize: 128, color: "#f4efe3", fontFamily: SERIF,
        fx: { gradient: ["#f7f0df", "#c2a35d"] },
      }),
      shape("細線", 560, 880, 80, 1, { kind: "rect", fill: "#8d7434" }),
      text("內文", "一夜之間，肌膚自己會回答", 140, 920, 920, 50, {
        fontSize: 28, fontWeight: 400, color: "#9a937f", fontFamily: SERIF,
      }),
      ...[0, 1, 2, 3, 4].map((i) =>
        icon(`金點${i}`, "sparkle", 500 + i * 50, 1020, 22, "#8d7434")),
    ],
  },
  {
    // 主張：雜誌封面。刊頭橫貫全寬，商品從左下出血，右側一欄小字。
    name: "05 雜誌封面・刊頭橫貫",
    layers: () => [
      bg("#e8eef0", "#cfdade"),
      text("刊頭", "BEAUTY", 60, 90, 1080, 200, {
        fontSize: 196, color: "#16323c", fx: { letterSpacing: 0.06 },
      }),
      shape("刊頭線", 60, 300, 1080, 3, { kind: "rect", fill: "#16323c" }),
      ...product(-60, 480, 720, 820, { shadow: false }),
      text("副標題", "12 月號", 60, 320, 300, 50, {
        fontSize: 28, fontWeight: 400, align: "left", color: "#4d6b75", fx: { letterSpacing: 0.2 },
      }),
      text("右欄1", "瞬間補水", 700, 420, 440, 90, { fontSize: 72, align: "left", color: "#16323c" }),
      text("右欄2", "30 秒成為\n透明感美人", 700, 530, 440, 120, {
        fontSize: 34, fontWeight: 400, align: "left", color: "#3d5a63",
      }),
      shape("右欄線", 700, 690, 200, 2, { kind: "rect", fill: "#7c99a2" }),
      text("右欄3", "・日本專利玻尿酸\n・無添加香精色素\n・回購率第一名", 700, 720, 440, 170, {
        fontSize: 28, fontWeight: 400, align: "left", color: "#4d6b75",
      }),
    ],
  },
  {
    // 主張：深淺交錯的棋盤格，深格反白字。色差要夠大，不然四格會糊成一片。
    name: "06 四格賣點・深淺交錯",
    layers: () => [
      bg("#ffffff", "#ffffff"),
      shape("格1", 0, 0, 600, 600, { kind: "rect", fill: "#173a63" }),
      shape("格2", 600, 0, 600, 600, { kind: "rect", fill: "#e8f0fa" }),
      shape("格3", 0, 600, 600, 600, { kind: "rect", fill: "#dce8f7" }),
      shape("格4", 600, 600, 600, 600, { kind: "rect", fill: "#2f6fb8" }),
      ...[["美白淡斑", 70, 110, "sparkle", "#ffffff", "#8fb4dd"],
          ["抗痘消炎", 670, 110, "shield", "#173a63", "#5d84b0"],
          ["注水發光", 70, 710, "water-drop", "#173a63", "#5d84b0"],
          ["修護防曬", 670, 710, "sun", "#ffffff", "#bcd6f0"]]
        .flatMap(([label, x, y, ic, fg, dim], i) => [
          text(`序${i}`, `0${i + 1}`, x, y, 460, 50, {
            fontSize: 24, fontWeight: 400, align: "left", color: dim, fx: { letterSpacing: 0.3 },
          }),
          icon(`圖${i}`, ic, x, y + 70, 76, fg),
          text(`字${i}`, label, x, y + 190, 460, 80, { fontSize: 52, align: "left", color: fg }),
        ]),
      shape("中心圓", 360, 360, 480, 480, { kind: "ellipse", fill: "#ffffff" }),
      ...product(480, 430, 240, 340),
    ],
  },
  {
    // 主張：整片高彩度色場，價格是主角，商品縮到角落並傾斜。
    name: "07 螢光價格・快閃",
    layers: () => [
      bg("#f5e02e", "#f2c81d"),
      text("上標", "FLASH SALE", 90, 130, 1020, 60, {
        fontSize: 32, fontWeight: 400, align: "left", color: "#6b5a00", fx: { letterSpacing: 0.4 },
      }),
      text("價格", "$199", 60, 230, 1080, 300, {
        fontSize: 280, align: "left", color: "#111111",
      }),
      text("原價", "原價 $420", 90, 560, 600, 60, {
        fontSize: 36, fontWeight: 400, align: "left", color: "#6b5a00",
      }),
      shape("黑條", 0, 680, 1200, 130, { kind: "rect", fill: "#111111" }),
      text("黑條字", "只有 48 小時", 0, 710, 1200, 70, { fontSize: 54, color: "#f5e02e" }),
      ...product(700, 830, 420, 470, { rotation: 10 * DEG, shadow: false }),
      text("備註", "數量有限・售完為止", 90, 900, 520, 50, {
        fontSize: 30, fontWeight: 400, align: "left", color: "#6b5a00",
      }),
    ],
  },
  {
    // 主張：左右分割做前後對比，左邊壓低透明度與彩度當「before」。
    name: "08 前後對比・左右分割",
    layers: () => [
      bg("#eef1f0", "#e2e8e6"),
      shape("右半", 600, 0, 600, 1200, { kind: "rect", fill: "#d9ece3", gradient: { axis: "vertical", from: "#e4f2ea", to: "#cbe3d7" } }),
      shape("中線", 598, 0, 4, 1200, { kind: "rect", fill: "#ffffff" }),
      text("左標", "BEFORE", 60, 130, 480, 60, {
        fontSize: 34, fontWeight: 400, color: "#9aa5a1", fx: { letterSpacing: 0.35 },
      }),
      text("右標", "AFTER", 660, 130, 480, 60, {
        fontSize: 34, color: "#2f7a60", fx: { letterSpacing: 0.35 },
      }),
      ...product(150, 320, 300, 420, { opacity: 0.45 }),
      ...product(720, 260, 360, 500),
      text("左說明", "乾燥・粗糙", 60, 800, 480, 60, { fontSize: 36, fontWeight: 400, color: "#9aa5a1" }),
      text("右說明", "水潤・細緻", 660, 800, 480, 60, { fontSize: 36, color: "#1f5c46" }),
      shape("底條", 0, 1020, 1200, 180, { kind: "rect", fill: "#1f5c46" }),
      text("底條字", "連續使用 4 週的紀錄", 0, 1065, 1200, 70, { fontSize: 48, color: "#ffffff" }),
    ],
  },
  {
    // 主張：三條滿版橫帶，巨大編號當視覺主體，商品只是點綴。
    name: "09 三步驟・橫帶編號",
    layers: () => [
      bg("#fffaf4", "#fff3e6"),
      ...[["潔淨", "洗去一天的負擔", "#ffe7cc"], ["導入", "讓精華走進肌底", "#ffd9ab"], ["鎖水", "留住整夜的水分", "#ffc987"]]
        .flatMap(([title, desc, fill], i) => [
          shape(`帶${i}`, 0, 180 + i * 300, 1200, 280, { kind: "rect", fill }),
          text(`號${i}`, `0${i + 1}`, 70, 210 + i * 300, 220, 180, {
            fontSize: 150, align: "left", color: "#ffffff",
          }),
          text(`題${i}`, title, 300, 245 + i * 300, 400, 90, {
            fontSize: 66, align: "left", color: "#7a4a12",
          }),
          text(`述${i}`, desc, 300, 340 + i * 300, 560, 60, {
            fontSize: 30, fontWeight: 400, align: "left", color: "#a9772f",
          }),
        ]),
      text("主標", "三步驟・一夜有感", 70, 70, 1060, 80, {
        fontSize: 60, align: "left", color: "#5c3508",
      }),
      ...product(940, 940, 220, 300, { rotation: -8 * DEG, shadow: false }),
    ],
  },
  {
    // 主張：把留白做到底。商品小、字少、八成畫面是空的。
    name: "10 極簡留白・八成留空",
    layers: () => [
      bg("#f7f5f1", "#f0ece4"),
      ...product(510, 200, 180, 250),
      text("主標", "純淨", 0, 560, 1200, 180, { fontSize: 150, color: "#26241f" }),
      shape("細線", 570, 790, 60, 2, { kind: "rect", fill: "#b5aa98" }),
      text("內文", "只留下肌膚需要的", 0, 840, 1200, 50, {
        fontSize: 28, fontWeight: 400, color: "#8d8474",
      }),
      text("頁尾", "BRAND", 0, 1090, 1200, 50, {
        fontSize: 22, fontWeight: 400, color: "#b5aa98", fx: { letterSpacing: 0.5 },
      }),
    ],
  },

// ── 系列組合：墨綠實證風（11–16）────────────────────────────────────
// 這六張是「一組」，不是六個獨立的版：共用同一個綠色系、同一個圓角卡、
// 同一個「白細框中文標題＋右上角英文小標」的標題裝置。做輪播或商品詳情頁時
// 整組套下來就有一致性，換內容不換樣式。
  {
    name: "11 系列・封面",
    layers: () => [
      bg("#0e2a19", "#5f9a48"),
      ...lozenge("FOR FORMULA", 80, 150, 520, 92),
      text("主標", "祛痘攻略", 80, 280, 700, 190, {
        fontSize: 150, align: "left", color: "#ffffff",
        fx: { strokeColor: "#12331d", strokeW: 0.06, shadow: true },
      }),
      text("副標", "配方至上・14 天有感", 80, 500, 700, 60, {
        fontSize: 34, fontWeight: 400, align: "left", color: "#cfe6bd",
      }),
      shape("橫線", 80, 600, 1040, 3, { kind: "rect", fill: "#ffffff" }, { opacity: 0.55 }),
      ...product(600, 620, 560, 640, { shadow: false }),
      text("頁碼", "01 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    name: "12 系列・功效實證",
    layers: () => [
      bg("#0e2a19", "#5f9a48"),
      ...glassCard(),
      ...cardTitle("功效實證", "EFFICACY\nEVIDENCE"),
      ...dataRow("粉刺數量", "-39.38%", "[1]", 480),
      ...dataRow("痘痘改善", "-75.00%", "[2]", 760),
      text("頁碼", "02 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    name: "13 系列・核心成分",
    layers: () => [
      bg("#0e2a19", "#5f9a48"),
      ...glassCard(),
      ...cardTitle("核心成分", "CORE\nCOMPONENT"),
      ...chipRow("4% 皮傲寧", "從源頭減少新痘生成", 470),
      ...chipRow("2% 生物琥珀酸", "溫和疏通毛孔・調節皮脂", 760),
      text("頁碼", "03 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    name: "14 系列・使用前後",
    layers: () => [
      bg("#0e2a19", "#5f9a48"),
      ...glassCard(),
      ...cardTitle("使用前後", "BEFORE\nAFTER"),
      shape("中線", 598, 470, 3, 480, { kind: "rect", fill: "#ffffff" }, { opacity: 0.4 }),
      text("左標", "BEFORE", 160, 480, 380, 50, {
        fontSize: 28, fontWeight: 400, color: "#cfe6bd", fx: { letterSpacing: 0.3 },
      }),
      text("右標", "AFTER", 660, 480, 380, 50, {
        fontSize: 28, color: "#ffffff", fx: { letterSpacing: 0.3 },
      }),
      ...product(230, 550, 240, 330, { opacity: 0.4, shadow: false }),
      ...product(710, 520, 280, 390, { shadow: false }),
      text("左說明", "泛紅・粗糙", 160, 900, 380, 60, { fontSize: 34, fontWeight: 400, color: "#b9d8a6" }),
      text("右說明", "平滑・穩定", 660, 900, 380, 60, { fontSize: 34, color: "#ffffff" }),
      text("頁碼", "04 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    name: "15 系列・使用步驟",
    layers: () => [
      bg("#0e2a19", "#5f9a48"),
      ...glassCard(),
      ...cardTitle("使用步驟", "HOW TO\nUSE"),
      ...[["潔淨", "洗去多餘油脂", 460], ["精華", "痘痘處點壓吸收", 640], ["保濕", "鎖水穩定屏障", 820]]
        .flatMap(([title, desc, y], i) => [
          shape(`步驟號底${i}`, 160, y, 76, 76, { kind: "ellipse", fill: "#1d4a25" }),
          text(`步驟號${i}`, `0${i + 1}`, 160, y + 18, 76, 46, { fontSize: 34, color: "#ffffff" }),
          text(`步驟題${i}`, title, 270, y + 2, 300, 70, { fontSize: 50, align: "left", color: "#ffffff" }),
          text(`步驟述${i}`, desc, 560, y + 14, 500, 50, {
            fontSize: 30, fontWeight: 400, align: "left", color: "#d5e9c6",
          }),
        ]),
      text("頁碼", "05 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    name: "16 系列・立即入手",
    layers: () => [
      bg("#0e2a19", "#4f8a3c"),
      ...product(330, 160, 540, 620, { shadow: false }),
      ...lozenge("LIMITED OFFER", 340, 790, 520, 88),
      text("價格", "$680", 0, 890, 1200, 170, {
        fontSize: 150, color: "#ffffff", fx: { shadow: true },
      }),
      text("原價", "原價 $880・限時 7 天", 0, 1060, 1200, 60, {
        fontSize: 32, fontWeight: 400, color: "#cfe6bd",
      }),
      text("頁碼", "06 / 06", 80, 1080, 300, 50, {
        fontSize: 26, fontWeight: 400, align: "left", color: "#a9cf94", fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    // 主張：一次把所有物件都生出來，套下來就是一張完整的設計稿，不是空骨架。
    // 結構：頂欄品牌條 → 粗框大標 → 左右兩張錯位玻璃卡 → 傾斜商品壓在中央 →
    //       左下情境小圖 → 底部註腳。使用者只要改字、換商品就能用。
    name: "17 完整詳情頁・墨綠實證（一次生好所有物件）",
    layers: () => asSquare([
      bg("#0b2414", "#4e8a3a"),

      // 頂欄
      text("品牌英文", "FOR FORMULA", 80, 70, 560, 70, {
        fontSize: 52, align: "left", color: "#ffffff", fx: { letterSpacing: 0.02 },
      }),
      text("品牌中文", "配 方 至 上", 80, 140, 560, 60, {
        fontSize: 40, align: "left", color: "#ffffff", fx: { letterSpacing: 0.3 },
      }),
      text("頂欄右", "祛痘攻略", 700, 105, 420, 70, { fontSize: 48, align: "right", color: "#ffffff" }),
      shape("頂欄線", 80, 225, 1040, 3, { kind: "rect", fill: "#ffffff" }),

      // 粗框大標
      shape("大標框", 70, 285, 1060, 190, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 5 }),
      text("大標", "祛痘快 褪紅強 不反復", 70, 330, 1060, 110, {
        fontSize: 92, color: "#ffffff",
      }),

      // 左上玻璃卡：核心成分
      shape("成分卡", 60, 560, 620, 520, {
        kind: "rect", radius: 40, fill: "#4a7d3c",
        gradient: { axis: "vertical", from: "#568b45", to: "#3d6b32" },
      }, { opacity: 0.94 }),
      shape("成分標題框", 110, 610, 290, 86, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 3 }),
      text("成分標題", "核心成分", 110, 628, 290, 56, { fontSize: 46, color: "#ffffff" }),
      text("成分英文", "CORE\nCOMPONENT", 430, 612, 210, 80, {
        fontSize: 20, fontWeight: 400, align: "right", color: "#c9e0b8",
      }),
      shape("成分線", 110, 730, 520, 2, { kind: "rect", fill: "#ffffff" }, { opacity: 0.5 }),
      shape("成分塊1", 110, 760, 330, 74, { kind: "rect", fill: "#10381c", radius: 6 }),
      text("成分字1", "4% 皮傲寧", 110, 774, 330, 50, { fontSize: 40, color: "#ffffff" }),
      text("成分述1", "從源頭減少新痘生成", 110, 848, 520, 50, {
        fontSize: 32, fontWeight: 400, align: "left", color: "#ffffff",
      }),
      shape("成分線2", 110, 918, 520, 2, { kind: "rect", fill: "#ffffff" }, { opacity: 0.5 }),
      shape("成分塊2", 110, 946, 430, 74, { kind: "rect", fill: "#10381c", radius: 6 }),
      text("成分字2", "2% 生物琥珀酸", 110, 960, 430, 50, { fontSize: 40, color: "#ffffff" }),

      // 右下玻璃卡：功效實證（跟左卡刻意錯開高度，做出層次）
      shape("功效卡", 560, 880, 600, 460, {
        kind: "rect", radius: 40, fill: "#4a7d3c",
        gradient: { axis: "vertical", from: "#5c9249", to: "#3d6b32" },
      }, { opacity: 0.95 }),
      shape("功效標題框", 610, 925, 270, 82, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 3 }),
      text("功效標題", "功效實證", 610, 942, 270, 52, { fontSize: 44, color: "#ffffff" }),
      text("功效英文", "EFFICACY\nEVIDENCE", 910, 928, 210, 76, {
        fontSize: 20, fontWeight: 400, align: "right", color: "#c9e0b8",
      }),
      shape("功效線1", 610, 1040, 510, 2, { kind: "rect", fill: "#ffffff" }, { opacity: 0.5 }),
      text("功效標1", "粉刺數量", 610, 1075, 280, 60, { fontSize: 42, align: "left", color: "#ffffff" }),
      shape("功效塊1", 880, 1062, 240, 78, { kind: "rect", fill: "#10381c", radius: 6 }),
      text("功效值1", "-39.38%", 880, 1078, 240, 52, { fontSize: 42, color: "#ffffff" }),
      text("註1", "[1]", 1080, 1042, 50, 30, { fontSize: 18, fontWeight: 400, color: "#dcecd0" }),

      // 商品：傾斜、壓在兩張卡中間，做出前後層次
      // 商品往右上收：原本太寬又太置中，直接蓋掉右卡的「功效實證」標題。
      // 現在夾在兩張卡中間、只壓到卡片邊緣，層次在但不擋字。
      ...product(600, 490, 340, 390, { rotation: 10 * DEG, shadow: false }),

      // 右側直排小標
      text("右小標", "ACNE\nTREATMENT\nSERUM", 900, 560, 220, 130, {
        fontSize: 22, fontWeight: 400, align: "right", color: "#cde3bc", fx: { letterSpacing: 0.15 },
      }),

      // 左下情境小圖（白細框內留空，換成你的質地特寫）
      shape("情境框", 80, 1120, 240, 200, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 3 }),
      text("情境提示", "放質地特寫", 80, 1195, 240, 50, {
        fontSize: 24, fontWeight: 400, color: "#bcd8a9",
      }),

      // 底部註腳
      text("註腳", "＊1. 數據來源為皮膚科醫生臨床評估，32 名受試者連續使用 7 天後得出結論\n＊2. 數據來源為受試者自我評估問卷，連續使用 7 天後針對「感覺痘痘整體得到改善」一項得出結論",
        80, 1340, 1040, 90, {
          fontSize: 18, fontWeight: 400, align: "left", color: "#a8c898",
        }),
    ]),
  },
];

export const DOC = S;
