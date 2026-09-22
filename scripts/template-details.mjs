// 細節零件庫。
//
// 版面結構做對了還是會覺得「空」，差的不是構圖而是細節詞彙。拆解韓系／電商
// 詳情頁之後，真正讓畫面「看起來是設計過的」的是這些小東西：編號圓點與引導線、
// 「＋」膠囊標籤、商品後面的細圓環、質地樣本、極小號註腳、角落旗標、贈品外框、
// 刪除線原價、輪播圓點、散落的加號節奏。
//
// 這些零件都只用編輯器真的畫得出來的東西（形狀、文字、圖示、旋轉），
// 每一個都是可編輯圖層，使用者可以改字、換色、刪掉。
import { L, DEG } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";

/**
 * 編號賣點：圓底號碼 ＋ 粗體主張 ＋ 細規格 ＋ 註腳記號。
 * 韓系成分頁最常見的裝置；一個賣點自己就有三層字級。
 */
export const numberedClaim = (n, claim, spec, x, y, over = {}) => {
  const { accent = "#c98a2e", fg = "#1f1b16", dim = "#8a8177", w = 520 } = over;
  return [
    L.shape(`號碼圈${n}`, x, y, 34, 34, { kind: "ellipse", fill: "none", stroke: accent, strokeWidth: 2 }),
    L.text(`號碼${n}`, String(n), x, y + 7, 34, 24, { fontSize: 18, color: accent, fontFamily: SANS }),
    L.text(`主張${n}`, claim, x + 54, y - 4, w, 56, {
      fontSize: 38, align: "left", color: fg, fontFamily: SANS,
    }),
    L.text(`規格${n}`, spec, x + 54, y + 58, w, 44, {
      fontSize: 24, align: "left", color: dim, fontFamily: SANS, fontWeight: 400,
    }),
  ];
};

/** 把數個編號賣點串起來的垂直引導線。 */
export const claimGuide = (x, y, h, colour = "#e0d3bd") =>
  [L.shape("引導線", x, y, 1, h, { kind: "rect", fill: colour })];

/**
 * 「＋」膠囊標籤：小方框加號 ＋ 標籤字。
 * MEDIHEAL／JUMISO 那種環繞商品的賣點標，靠它畫面才不會只剩商品。
 */
export const plusPill = (label, x, y, w, over = {}) => {
  const { fill = "#ffffff", fg = "#3b2f6b", badge = "#6d5bb5", h = 66 } = over;
  return [
    L.shape(`${label}底`, x, y, w, h, { kind: "rect", fill, radius: h / 2 }),
    L.shape(`${label}加號底`, x + 10, y + (h - 34) / 2, 34, 34, { kind: "rect", fill: badge, radius: 8 }),
    L.text(`${label}加號`, "＋", x + 10, y + (h - 34) / 2 + 4, 34, 28, {
      fontSize: 20, color: "#ffffff", fontFamily: SANS,
    }),
    L.text(`${label}字`, label, x + 52, y + h * 0.26, w - 66, h * 0.5, {
      fontSize: 28, align: "left", color: fg, fontFamily: SANS,
    }),
  ];
};

/** 從標籤拉到商品的細引導線（給定起點與角度長度）。 */
export const leaderLine = (x, y, length, deg, colour = "#b9aee0") =>
  [L.shape("引線", x, y, length, 1, { kind: "rect", fill: colour }, { rotation: deg * DEG })];

/** 商品後面的細圓環：把視線收束到商品上，又不會擋住它。 */
export const haloRing = (cx, cy, r, colour = "#c9bff0", width = 1) =>
  [L.shape("光環", cx - r, cy - r, r * 2, r * 2, {
    kind: "ellipse", fill: "none", stroke: colour, strokeWidth: width,
  })];

/** 質地樣本：幾顆膏體小點，讓畫面有「真的摸得到」的感覺。 */
export const textureDabs = (x, y, colour = "#cdb8f0", count = 3) =>
  Array.from({ length: count }, (_, i) =>
    L.shape(`質地${i}`, x + i * 78, y + (i % 2 ? 18 : 0), 54 - i * 6, 42 - i * 4,
      { kind: "ellipse", fill: colour }, { rotation: (i * 14 - 10) * DEG }));

/** 極小號註腳區塊。有沒有這塊，畫面的「完成度」差很多。 */
export const footnotes = (lines, x, y, w, colour = "#a89f92") =>
  [L.text("註腳", lines.map((l, i) => `＊${i + 1}. ${l}`).join("\n"), x, y, w, 24 * lines.length + 12, {
    fontSize: 16, align: "left", color: colour, fontFamily: SANS, fontWeight: 400,
  })];

/** 角落旗標：電商檔期最常見的左上角斜帶。 */
export const cornerFlag = (label, sub, over = {}) => {
  const { fill = "#1e6fd9", fg = "#ffffff" } = over;
  return [
    L.shape("角旗", -140, 60, 560, 130, { kind: "rect", fill }, { rotation: -32 * DEG }),
    L.text("角旗主", label, -90, 92, 460, 56, {
      fontSize: 44, color: fg, fontFamily: SANS, rotation: -32 * DEG,
    }),
    ...(sub ? [L.text("角旗副", sub, -90, 146, 460, 36, {
      fontSize: 22, color: fg, fontFamily: SANS, fontWeight: 400, rotation: -32 * DEG,
    })] : []),
  ];
};

/** 贈品外框小盒。 */
export const giftInset = (label, x, y, w, h, over = {}) => {
  const { stroke = "#1e6fd9", fg = "#1e6fd9" } = over;
  return [
    L.shape("贈框", x, y, w, h, { kind: "rect", fill: "none", stroke, strokeWidth: 2, radius: 6 }),
    L.shape("贈標底", x + 16, y - 16, 62, 34, { kind: "rect", fill: stroke, radius: 4 }),
    L.text("贈標", "贈", x + 16, y - 10, 62, 26, { fontSize: 22, color: "#ffffff", fontFamily: SANS }),
    L.text("贈品名", label, x + 10, y + h - 54, w - 20, 44, {
      fontSize: 20, color: fg, fontFamily: SANS, fontWeight: 400,
    }),
  ];
};

/**
 * 價格塊：現價大、原價加刪除線。
 * 文字圖層沒有刪除線屬性，所以用一條細線壓在原價上——這也是可編輯圖層。
 */
export const priceBlock = (now, was, x, y, over = {}) => {
  const { fg = "#ffffff", dim = "#cddcf5", wasW = 150 } = over;
  return [
    L.text("原價", was, x, y, wasW, 44, {
      fontSize: 28, align: "right", color: dim, fontFamily: SANS, fontWeight: 400,
    }),
    L.shape("刪除線", x + 8, y + 22, wasW - 16, 2, { kind: "rect", fill: dim }),
    L.text("現價", now, x, y + 46, 420, 130, {
      fontSize: 112, align: "left", color: fg, fontFamily: SANS,
    }),
  ];
};

/** 輪播圓點。小東西，但少了就少一層「這是一組內容」的暗示。 */
export const carouselDots = (total, active, cx, y, colour = "#b9b2a6") =>
  Array.from({ length: total }, (_, i) =>
    L.shape(`點${i}`, cx - (total * 22) / 2 + i * 22, y, i === active ? 12 : 8, i === active ? 12 : 8,
      { kind: "ellipse", fill: colour }, { opacity: i === active ? 1 : 0.45 }));

/** 散落的小加號，當畫面節奏用。 */
export const plusMarks = (points, colour = "#c4b6ea") =>
  points.flatMap(([x, y, size], i) => [
    L.shape(`加橫${i}`, x, y + size / 2 - 1, size, 3, { kind: "rect", fill: colour }),
    L.shape(`加直${i}`, x + size / 2 - 1, y, 3, size, { kind: "rect", fill: colour }),
  ]);

/** 品牌 lockup。 */
export const brandLockup = (name, x, y, w, colour = "#6b6357") =>
  [L.text("品牌", name, x, y, w, 46, {
    fontSize: 30, color: colour, fontFamily: SANS, fx: { letterSpacing: 0.18 },
  })];
