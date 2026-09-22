// 自由畫布的設計公版。1200×1200，全部只用形狀＋文字，不夾任何圖片——
// 夾了圖每次套用都會帶進同一張示意商品，使用者還要手動刪。
const S = 1200;
const FONT = "'Noto Sans TC',system-ui,sans-serif";

let seq = 0;
const base = (over) => {
  seq += 1;
  return {
    id: `l${seq}`, name: "圖層", type: "object", zIndex: seq,
    x: 0, y: 0, w: 100, h: 100, rotation: 0, visible: true, opacity: 1, locked: false,
    ...over,
  };
};

/** 形狀圖層 */
const shape = (name, x, y, w, h, spec, over = {}) => base({
  name, type: "object", x, y, w, h,
  shape: { kind: "rect", fill: "#ffffff", stroke: "none", strokeWidth: 0, ...spec },
  ...over,
});

/** 文字圖層 */
const text = (name, content, x, y, w, h, over = {}) => base({
  name, type: "independent_text", x, y, w, h,
  isText: true, text: content, color: "#1f2937", fontSize: 56,
  fontFamily: FONT, fontWeight: 700, align: "center",
  ...over,
});

/** 商品擺放位置的提示框。使用者放好自己的商品之後刪掉這層即可。 */
const slot = (x, y, w, h) => shape("商品位（放好商品後刪掉這層）", x, y, w, h, {
  kind: "rect", fill: "none", stroke: "#c7d2fe", strokeWidth: 3, radius: 24,
}, { opacity: 0.9 });

const bg = (from, to, axis = "vertical") =>
  shape("背景", 0, 0, S, S, { kind: "rect", fill: from, gradient: { axis, from, to } }, { type: "background", locked: true });

export const TEMPLATES = [
  {
    name: "01 極簡留白・主標置中",
    layers: () => [
      bg("#f7f5f2", "#efeae4"),
      slot(340, 380, 520, 520),
      text("主標", "純淨保養", 150, 140, 900, 130, { fontSize: 104, color: "#2b2b2b" }),
      text("副標", "每天三分鐘，養出透亮肌", 150, 280, 900, 60, { fontSize: 40, fontWeight: 400, color: "#7a7a7a" }),
      text("頁尾", "BRAND NAME", 150, 1040, 900, 50, { fontSize: 30, fontWeight: 400, color: "#a3a3a3" }),
    ],
  },
  {
    name: "02 上下分割・色塊標題",
    layers: () => [
      bg("#ffffff", "#ffffff"),
      shape("上方色塊", 0, 0, S, 430, { kind: "rect", fill: "#e8ecff", gradient: { axis: "vertical", from: "#e8ecff", to: "#d7ddff" } }),
      text("主標", "新品上市", 100, 120, 1000, 120, { fontSize: 96, color: "#2a3382" }),
      text("副標", "限時嘗鮮價，售完為止", 100, 250, 1000, 60, { fontSize: 38, fontWeight: 400, color: "#5b63a8" }),
      slot(330, 500, 540, 480),
      text("頁尾", "2026 SPRING", 100, 1060, 1000, 50, { fontSize: 28, fontWeight: 400, color: "#9aa0c9" }),
    ],
  },
  {
    name: "03 折扣徽章・右上角",
    layers: () => [
      bg("#fdf6f4", "#f8e9e5"),
      slot(300, 330, 600, 560),
      shape("徽章底", 820, 90, 280, 280, { kind: "ellipse", fill: "#d94f45" }),
      text("折數", "88折", 820, 175, 280, 110, { fontSize: 82, color: "#ffffff" }),
      text("主標", "雙件組優惠", 90, 130, 660, 110, { fontSize: 84, align: "left", color: "#3a2320" }),
      text("副標", "任選兩件，現折 12%", 90, 255, 660, 60, { fontSize: 36, fontWeight: 400, align: "left", color: "#8a6b64" }),
      text("頁尾", "活動至 3/31 止", 90, 1060, 1020, 50, { fontSize: 28, fontWeight: 400, align: "left", color: "#a99089" }),
    ],
  },
  {
    name: "04 四效合一・圓形賣點",
    layers: () => [
      bg("#f2f6fb", "#e6eef8"),
      text("主標", "四效合一", 100, 90, 1000, 110, { fontSize: 88, color: "#1f3b63" }),
      slot(420, 400, 360, 380),
      shape("賣點圓1", 90, 330, 250, 250, { kind: "ellipse", fill: "#ffffff", stroke: "#cfe0f2", strokeWidth: 3 }),
      text("賣點1", "美白淡斑", 90, 425, 250, 70, { fontSize: 38, color: "#2b5387" }),
      shape("賣點圓2", 860, 330, 250, 250, { kind: "ellipse", fill: "#ffffff", stroke: "#cfe0f2", strokeWidth: 3 }),
      text("賣點2", "抗痘消炎", 860, 425, 250, 70, { fontSize: 38, color: "#2b5387" }),
      shape("賣點圓3", 90, 640, 250, 250, { kind: "ellipse", fill: "#ffffff", stroke: "#cfe0f2", strokeWidth: 3 }),
      text("賣點3", "注水發光", 90, 735, 250, 70, { fontSize: 38, color: "#2b5387" }),
      shape("賣點圓4", 860, 640, 250, 250, { kind: "ellipse", fill: "#ffffff", stroke: "#cfe0f2", strokeWidth: 3 }),
      text("賣點4", "修護防曬", 860, 735, 250, 70, { fontSize: 38, color: "#2b5387" }),
      text("頁尾", "1 盒 60 顆｜1 天 2 顆", 100, 1050, 1000, 60, { fontSize: 32, fontWeight: 400, color: "#5b7ba6" }),
    ],
  },
  {
    name: "05 價格卡・新客優惠",
    layers: () => [
      bg("#ffffff", "#f6f2fb"),
      slot(180, 300, 520, 520),
      shape("價格卡", 720, 380, 390, 330, { kind: "rect", fill: "#6d28d9", radius: 28 }),
      text("價格標籤", "新客優惠", 720, 420, 390, 60, { fontSize: 34, fontWeight: 400, color: "#e9d8ff" }),
      text("價格", "$320", 720, 490, 390, 130, { fontSize: 104, color: "#ffffff" }),
      text("原價", "原價 $420", 720, 630, 390, 50, { fontSize: 30, fontWeight: 400, color: "#c9b3f2" }),
      text("主標", "體驗組", 90, 120, 1020, 120, { fontSize: 92, align: "left", color: "#2e1065" }),
      text("副標", "四件入門組，一次擁有", 90, 250, 1020, 60, { fontSize: 36, fontWeight: 400, align: "left", color: "#7c5bb0" }),
    ],
  },
  {
    name: "06 大字報・限時快閃",
    layers: () => [
      bg("#111827", "#1f2937"),
      text("小標", "LIMITED", 100, 110, 1000, 60, { fontSize: 34, fontWeight: 400, color: "#9ca3af" }),
      text("主標", "限時三天", 100, 180, 1000, 180, { fontSize: 150, color: "#ffffff" }),
      shape("分隔線", 100, 390, 1000, 4, { kind: "rect", fill: "#4b5563" }),
      slot(340, 460, 520, 460),
      text("頁尾", "3/1 — 3/3 全站同慶", 100, 1000, 1000, 70, { fontSize: 40, fontWeight: 400, color: "#d1d5db" }),
    ],
  },
  {
    name: "07 三賣點・左側直線",
    layers: () => [
      bg("#fbfaf7", "#f3f0e9"),
      shape("直線", 110, 300, 5, 520, { kind: "rect", fill: "#b08d57" }),
      text("主標", "為什麼選我們", 110, 130, 900, 110, { fontSize: 78, align: "left", color: "#3d3325" }),
      text("賣點1", "01 ｜ 日本專利成分", 160, 330, 700, 70, { fontSize: 42, fontWeight: 400, align: "left", color: "#5c5140" }),
      text("賣點2", "02 ｜ 無添加香精色素", 160, 500, 700, 70, { fontSize: 42, fontWeight: 400, align: "left", color: "#5c5140" }),
      text("賣點3", "03 ｜ 回購率第一名", 160, 670, 700, 70, { fontSize: 42, fontWeight: 400, align: "left", color: "#5c5140" }),
      slot(700, 780, 400, 340),
    ],
  },
  {
    name: "08 柔霧漸層・product hero",
    layers: () => [
      bg("#e9e4f7", "#cfc6ef"),
      shape("光暈", 250, 280, 700, 700, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.35 }),
      slot(360, 400, 480, 480),
      text("主標", "溫和修護", 100, 130, 1000, 120, { fontSize: 96, color: "#3b2f6b" }),
      text("副標", "敏弱肌也能安心使用", 100, 260, 1000, 60, { fontSize: 38, fontWeight: 400, color: "#6b5fa5" }),
      shape("底標籤", 390, 990, 420, 90, { kind: "rect", fill: "#ffffff", radius: 45 }),
      text("底標籤字", "立即選購", 390, 1013, 420, 50, { fontSize: 36, color: "#3b2f6b" }),
    ],
  },
  {
    name: "09 雜誌感・細框襯線",
    layers: () => [
      bg("#ffffff", "#ffffff"),
      shape("外框", 70, 70, 1060, 1060, { kind: "rect", fill: "none", stroke: "#1f2937", strokeWidth: 3 }),
      text("上標", "SKINCARE", 120, 140, 960, 50, { fontSize: 30, fontWeight: 400, color: "#6b7280" }),
      text("主標", "瞬間補水", 120, 210, 960, 140, { fontSize: 116, color: "#111827" }),
      shape("短線", 120, 380, 160, 4, { kind: "rect", fill: "#111827" }),
      slot(330, 450, 540, 470),
      text("頁尾", "12 月刊｜冬天專屬", 120, 1000, 960, 60, { fontSize: 34, fontWeight: 400, color: "#4b5563" }),
    ],
  },
  {
    name: "10 前後對比・雙欄",
    layers: () => [
      bg("#f5f7f6", "#eaf0ee"),
      text("主標", "使用前後", 100, 110, 1000, 110, { fontSize: 88, color: "#1f3d34" }),
      shape("左卡", 90, 300, 480, 560, { kind: "rect", fill: "#ffffff", radius: 20 }),
      shape("右卡", 630, 300, 480, 560, { kind: "rect", fill: "#ffffff", radius: 20 }),
      text("左標", "BEFORE", 90, 330, 480, 50, { fontSize: 32, fontWeight: 400, color: "#94a3a0" }),
      text("右標", "AFTER", 630, 330, 480, 50, { fontSize: 32, fontWeight: 400, color: "#2f6b57" }),
      slot(140, 400, 380, 420),
      slot(680, 400, 380, 420),
      text("頁尾", "連續使用 4 週的紀錄", 100, 900, 1000, 60, { fontSize: 34, fontWeight: 400, color: "#4b6b62" }),
    ],
  },
];

export const DOC = S;
