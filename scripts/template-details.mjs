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

/* ── 第二批零件：手繪塗鴉、Y2K、撕紙、雷達圖、藝術字 ─────────────────
   來自第二輪參考（Catch keyword／ENERGY UP／Dr.G／Acnes／AESTURA／VARI:HOPE）。
   共同點是「畫面上有很多小東西在講話」，而不是只有商品和標題。 */

/** 手繪塗鴉：✕、四芒星、笑臉、短線。用形狀組出來，每個都可單獨刪。 */
export const doodles = (points, colour = "#3b4a5a") =>
  points.flatMap(([kind, x, y, size], i) => {
    if (kind === "x") return [
      L.shape(`塗鴉X${i}a`, x, y + size / 2, size, 3, { kind: "rect", fill: colour }, { rotation: 45 * DEG }),
      L.shape(`塗鴉X${i}b`, x, y + size / 2, size, 3, { kind: "rect", fill: colour }, { rotation: -45 * DEG }),
    ];
    if (kind === "star") return [L.icon(`塗鴉星${i}`, "sparkle", x, y, size, colour)];
    if (kind === "tick") return [
      L.shape(`塗鴉勾${i}a`, x, y, size * 0.5, 3, { kind: "rect", fill: colour }, { rotation: 50 * DEG }),
      L.shape(`塗鴉勾${i}b`, x + size * 0.28, y + size * 0.2, size * 0.8, 3, { kind: "rect", fill: colour }, { rotation: -40 * DEG }),
    ];
    return [L.shape(`塗鴉線${i}`, x, y, size, 3, { kind: "rect", fill: colour }, { rotation: -20 * DEG })];
  });

/** 方格紙底。線要夠淡，否則會蓋過內容。 */
export const gridPaper = (step = 60, colour = "#dfe6cf") => {
  const lines = [];
  for (let i = 1; i * step < 1200; i += 1) {
    lines.push(L.shape(`格直${i}`, i * step, 0, 1, 1200, { kind: "rect", fill: colour }, { opacity: 0.7 }));
    lines.push(L.shape(`格橫${i}`, 0, i * step, 1200, 1, { kind: "rect", fill: colour }, { opacity: 0.7 }));
  }
  return lines;
};

/** 膠帶貼紙：一小塊斜色塊加字，貼在其他元素邊緣。 */
export const tapeLabel = (label, x, y, w, deg, over = {}) => {
  const { fill = "#c8e68a", fg = "#2f4a12", h = 54 } = over;
  return [
    L.shape(`${label}膠帶`, x, y, w, h, { kind: "rect", fill }, { rotation: deg * DEG, opacity: 0.95 }),
    L.text(`${label}膠帶字`, label, x, y + h * 0.24, w, h * 0.55, {
      fontSize: h * 0.46, color: fg, rotation: deg * DEG,
    }),
  ];
};

/** 撕紙感標題帶：白色橫帶加輕微旋轉，標題壓在上面。 */
export const tornBand = (x, y, w, h, deg = -1.2, fill = "#ffffff") =>
  [L.shape("撕紙帶", x, y, w, h, { kind: "rect", fill }, { rotation: deg * DEG })];

/** 每個字一個外框（Acnes 的 ㅍㅍㅌ 那種）。 */
export const charBoxes = (chars, x, y, size, over = {}) => {
  const { stroke = "#2f6b3a", fg = "#2f6b3a", gap = 12 } = over;
  return chars.split("").flatMap((ch, i) => [
    L.shape(`字框${i}`, x + i * (size + gap), y, size, size, {
      kind: "rect", fill: "none", stroke, strokeWidth: 2,
    }),
    L.text(`字框字${i}`, ch, x + i * (size + gap), y + size * 0.2, size, size * 0.6, {
      fontSize: size * 0.56, color: fg,
    }),
  ]);
};

/** hashtag 膠囊標籤。 */
export const hashPill = (label, x, y, w, over = {}) => {
  const { stroke = "#3b4a5a", fg = "#2c3a48", fill = "#ffffff", h = 58 } = over;
  return [
    L.shape(`${label}底`, x, y, w, h, { kind: "rect", fill, stroke, strokeWidth: 2, radius: h / 2 }),
    L.text(`${label}字`, `#${label}`, x, y + h * 0.26, w, h * 0.5, { fontSize: 26, color: fg }),
  ];
};

/**
 * 雷達多邊形：賣點放在頂點，中心連線到每個頂點。
 * VARI:HOPE 那張的裝置；比並排清單更有「被分析過」的說服力。
 */
export const radarPolygon = (cx, cy, r, labels, over = {}) => {
  const { line = "#e0a83c", dot = "#e0a83c", fg = "#6b4c12" } = over;
  const n = labels.length;
  const pt = (i, radius) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
  };
  // 旋轉是繞元素中心，所以線段的 x/y 要放「中點減一半長寬」，
  // 直接用起點座標會讓每條邊都偏移半個長度——畫出來就不是多邊形了。
  const segment = (name, x1, y1, x2, y2, thickness, opacity) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return L.shape(name, (x1 + x2) / 2 - len / 2, (y1 + y2) / 2 - thickness / 2, len, thickness,
      { kind: "rect", fill: line }, { rotation: deg * DEG, opacity });
  };
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const [x1, y1] = pt(i, r);
    const [x2, y2] = pt((i + 1) % n, r);
    out.push(segment(`雷達邊${i}`, x1, y1, x2, y2, 2, 0.8));
    out.push(segment(`雷達輻${i}`, cx, cy, x1, y1, 1, 0.45));
    out.push(L.shape(`雷達點${i}`, x1 - 7, y1 - 7, 14, 14, { kind: "ellipse", fill: dot }));
    const [lx, ly] = pt(i, r + 78);
    out.push(L.text(`雷達字${i}`, labels[i], lx - 110, ly - 22, 220, 50, { fontSize: 30, color: fg }));
  }
  return out;
};

/** 視窗 UI 框（Y2K 常見）：標題列＋三個圓點＋內容底。 */
export const windowChrome = (title, x, y, w, h, over = {}) => {
  const { bar = "#f6bcd0", body = "#ffffff", fg = "#3a2430" } = over;
  return [
    L.shape("視窗底", x, y, w, h, { kind: "rect", fill: body, radius: 10 }),
    L.shape("視窗列", x, y, w, 62, { kind: "rect", fill: bar, radius: 10 }),
    L.text("視窗標題", title, x + 24, y + 16, 400, 34, {
      fontSize: 26, align: "left", color: fg, fx: { letterSpacing: 0.12 },
    }),
    ...[0, 1, 2].map((i) =>
      L.shape(`視窗點${i}`, x + w - 120 + i * 34, y + 20, 22, 22,
        { kind: "ellipse", fill: i === 2 ? "#2b1d26" : "#ffffff" })),
  ];
};

/** 格紋角落（Y2K 棋盤格）。 */
export const checkerCorner = (x, y, cells, size, colour = "#f08ab0") => {
  const out = [];
  for (let r = 0; r < cells; r += 1) for (let c = 0; c < cells; c += 1) {
    if ((r + c) % 2) continue;
    out.push(L.shape(`格${r}${c}`, x + c * size, y + r * size, size, size, { kind: "rect", fill: colour }));
  }
  return out;
};

/** 星形外框（粗描邊、只有輪廓）。 */
export const starOutline = (x, y, size, colour = "#ffffff", deg = 0) =>
  [L.icon("星框", "star", x, y, size, colour, { rotation: deg * DEG, opacity: 0.9 })];

/**
 * 藝術字：弧形排字＋粗描邊＋漸層。
 * 編輯器的 fx.warp 真的會逐字沿弧線排（drawWarpedText），所以這是可編輯文字，
 * 不是生成的圖片——使用者改字，弧形會跟著重排。
 */
export const arcHeadline = (text, x, y, w, h, over = {}) => {
  const {
    fontSize = 120, from = "#ffffff", to = "#ffd0e4",
    stroke = "#e0467f", strokeW = 0.12, warp = "arc-up", warpAmount = 30,
  } = over;
  return [L.text("藝術字", text, x, y, w, h, {
    fontSize, color: from,
    fx: { gradient: [from, to], strokeColor: stroke, strokeW, shadow: true, warp, warpAmount },
  })];
};

/* ── 第三批零件：社群實測／UGC 風格 ─────────────────────────────── */

/** 括號強調：（ 內容 ）用大括號把一句話框起來，社群版最常見的強調手法。 */
export const bracketPhrase = (text, x, y, w, h, over = {}) => {
  const { fg = "#ffffff", bracket = "#ffffff", fontSize = h * 0.62 } = over;
  return [
    L.text("左括號", "(", x, y, h * 0.5, h, { fontSize: h * 0.95, color: bracket }),
    L.text("括號內容", text, x + h * 0.42, y + h * 0.16, w - h * 0.84, h * 0.7, { fontSize, color: fg }),
    L.text("右括號", ")", x + w - h * 0.5, y, h * 0.5, h, { fontSize: h * 0.95, color: bracket }),
  ];
};

/** 斜線包夾：\ 內容 / 讓一行小標看起來像被引用。 */
export const slashPhrase = (text, x, y, w, h, over = {}) => {
  const { fg = "#2b2340", fontSize = h * 0.62 } = over;
  return [
    L.text("左斜", "＼", x, y + h * 0.1, h * 0.6, h * 0.8, { fontSize: fontSize * 0.9, color: fg }),
    L.text("斜線內容", text, x + h * 0.6, y, w - h * 1.2, h, { fontSize, color: fg }),
    L.text("右斜", "／", x + w - h * 0.6, y + h * 0.1, h * 0.6, h * 0.8, { fontSize: fontSize * 0.9, color: fg }),
  ];
};

/**
 * 照片格：影像圖層 ＋ 一圈白色外框。
 * 圖層本身是方的（畫布不支援圓角裁切），所以用外框做出「被裱起來」的感覺。
 */
export const photoTile = (url, x, y, w, h, over = {}) => {
  const { frame = "#ffffff", pad = 10, label, labelColour = "#4a3f66" } = over;
  return [
    L.shape("照片外框", x - pad, y - pad, w + pad * 2, h + pad * 2, { kind: "rect", fill: frame, radius: 14 }),
    { ...L.shape("照片", x, y, w, h, { kind: "rect", fill: "#eee" }), shape: null, image: url,
      name: "示意照片（換成你的）" },
    ...(label ? [L.text("照片標", label, x, y + h + 14, w, 44, {
      fontSize: 26, color: labelColour,
    })] : []),
  ];
};

/** 見證卡：圓形頭像 ＋ 白色圓角卡片 ＋ 多行留言。 */
export const testimonialCard = (who, lines, x, y, w, h, over = {}) => {
  const { card = "#ffffff", fg = "#3b3054", dim = "#7a6f96", avatar = "#e6def7", avatarImage } = over;
  const d = Math.min(120, h * 0.55);
  return [
    L.shape("見證卡", x + d * 0.55, y, w - d * 0.55, h, { kind: "rect", fill: card, radius: 18 }),
    L.shape("頭像底", x, y + (h - d) / 2, d, d, { kind: "ellipse", fill: avatar }),
    // 有插畫頭像就用圖，沒有就退回文字圖示——圖層是方的，靠底下的圓色塊做出圓形頭像的感覺
    ...(avatarImage
      ? [{ ...L.shape("頭像", x + d * 0.08, y + (h - d) / 2 + d * 0.02, d * 0.84, d * 0.96, { kind: "rect", fill: "#0000" }),
           shape: null, image: avatarImage, name: "見證人頭像（可換）" }]
      : [L.text("頭像字", "👤", x, y + (h - d) / 2 + d * 0.22, d, d * 0.55, { fontSize: d * 0.45, color: "#7a6f96" })]),
    L.text("見證人", who, x + d * 0.9, y + 18, w - d * 1.2, 40, {
      fontSize: 22, align: "left", color: dim,
    }),
    L.text("見證內容", lines.join("\n"), x + d * 0.9, y + 62, w - d * 1.2, h - 80, {
      fontSize: 25, align: "left", color: fg, fontWeight: 400,
    }),
  ];
};
