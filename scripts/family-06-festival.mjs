// Family 06 — 節慶知識卡（中秋）
//
// 家族氣質：節慶社群圖＋知識型輪播的第一張。左半暖黃、右半夜空明月，
// 中間一枚綠色花邊圓牌放標題與提問，底部綠帶放「右滑看…」引導下一張。
// 參考：品牌中秋節柚子知識貼文（2026-09-24 使用者提供）。
// 參考圖的人物插畫做不出來（範本只有形狀＋文字），用月亮、星星、雲帶過；兔子用橢圓組成剪影。
// 套用後可以自己放插圖進來。
import { L, S } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const GREEN = "#3f8f3a";
const INK = "#2b2b2b";

/**
 * 花邊圓（像郵票／糖果盒的波浪邊）：一條封閉的鋼筆路徑，n 個向外鼓的弧。
 * 路徑節點以圖層中心為原點、用寬高比例表示（跟編輯器的鋼筆同一種格式）。
 */
function scallopPoints(n = 24, bulge = 0.2) {
  const pts = [], r = 0.44, cr = r * (1 + bulge);
  const at = (a, rad) => ({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step;
    const p = at(a, r);
    const out = at(a + step * 0.2, cr), inn = at(a - step * 0.2, cr);
    pts.push({ x: p.x, y: p.y, ox: out.x - p.x, oy: out.y - p.y, ix: inn.x - p.x, iy: inn.y - p.y });
  }
  return pts;
}

/**
 * 兔子剪影（跳舞的樣子）：頭、兩隻長耳、身體、舉起的手、兩條腿、尾巴，全部用橢圓組成。
 * flip＝面向左（左右鏡像）。整隻設成同一個群組，拖的時候整隻一起動。
 */
function rabbit(x, y, flip, group, colour = "#fbeec2") {
  const W = 130;
  const part = (name, dx, dy, w, h, rot) => L.shape(name, flip ? x + W - dx - w : x + dx, y + dy, w, h,
    { kind: "ellipse", fill: colour }, { rotation: (flip ? -rot : rot) * (Math.PI / 180), groupId: group });
  return [
    part("兔耳", 26, -58, 20, 78, -16),
    part("兔耳", 50, -52, 20, 72, 12),
    part("兔頭", 18, 6, 62, 54, 0),
    part("兔身", 22, 50, 74, 104, -14),
    part("兔手", 80, 44, 18, 64, 48),
    part("兔手", 10, 70, 18, 56, -30),
    part("兔腳", 30, 140, 24, 66, 24),
    part("兔腳", 70, 136, 24, 64, -34),
    part("兔尾", 2, 120, 26, 26, 0),
  ];
}

/** 一朵雲：三顆重疊的圓＋一條平底。 */
const cloud = (x, y, w, colour) => [
  L.shape("雲", x, y + w * 0.18, w * 0.5, w * 0.34, { kind: "ellipse", fill: colour }),
  L.shape("雲", x + w * 0.28, y, w * 0.46, w * 0.46, { kind: "ellipse", fill: colour }),
  L.shape("雲", x + w * 0.56, y + w * 0.14, w * 0.44, w * 0.36, { kind: "ellipse", fill: colour }),
  L.shape("雲", x + w * 0.1, y + w * 0.3, w * 0.82, w * 0.2, { kind: "rect", fill: colour, radius: w * 0.1 }),
];

export const FAMILY = [
  {
    art: {
      name: "節慶｜中秋知識卡",
      family: "festival",
      composition: "badge-center-split-bg",
      visualHierarchy: ["headline", "question", "illustration", "cta"],
      visualWeight: { headline: 9, question: 7, illustration: 5, cta: 4, decoration: 3 },
      readingDirection: "top→bottom",
      negativeSpace: 0.22,
      rationale:
        "背景左黃右夜，把「中秋」的月夜氣氛放在一邊、品牌暖色放在另一邊；中間的花邊圓牌壓在兩者交界，所有文字都在白底裡，不管背景多熱鬧都讀得清楚。底部綠帶是輪播的出口，告訴人往右滑看答案。",
      recommendedFor: "節慶貼文、知識型輪播第一張、產品冷知識",
    },
    layers: () => [
      L.bg("#f8e58a", "#f1d25a"),
      // 右半夜空＋月亮＋星星
      L.shape("夜空", 600, 0, 600, 1040, { kind: "rect", fill: "#1d2a4a", gradient: { axis: "vertical", from: "#141d38", to: "#34426b" } }),
      L.shape("月亮", 860, 70, 230, 230, { kind: "ellipse", fill: "#fdf1c0" },
        { glow: { color: "#fff1a8", size: 70, opacity: 0.85, strength: 3 } }),
      L.icon("星星", "sparkle", 700, 120, 40, "#fdf1c0"),
      L.icon("星星", "sparkle", 1120, 360, 30, "#fdf1c0", { opacity: 0.8 }),
      L.icon("星星", "sparkle", 760, 420, 24, "#fdf1c0", { opacity: 0.7 }),
      ...cloud(900, 880, 250, "#f3e3b8"),

      // 品牌標誌方塊
      L.shape("品牌底", 40, 34, 210, 92, { kind: "rect", fill: GREEN, radius: 14 }),
      L.text("品牌", "品牌名稱", 40, 34, 210, 92, { fontSize: 38, color: "#ffffff", fontWeight: 900 }),

      // 花邊圓牌：白底＋綠色波浪花邊線（一條鋼筆路徑，24 個弧）
      L.shape("花邊圓牌", 110, 160, 820, 820, { kind: "path", fill: "#ffffff", stroke: GREEN, strokeWidth: 8, closed: true, points: scallopPoints(24, 0.14) }),

      L.shape("標題上裝飾", 460, 300, 120, 8, { kind: "rect", fill: GREEN, radius: 4 }),
      L.shape("標題上裝飾", 490, 318, 60, 6, { kind: "rect", fill: GREEN, radius: 3 }),
      L.text("主標", "中秋節吃柚子", 200, 340, 640, 110, { fontSize: 88, color: GREEN, fontWeight: 900 }),
      L.shape("分隔線", 250, 470, 540, 4, { kind: "rect", fill: GREEN, radius: 2 }),
      L.text("提問", "你知道日本柚子、台灣柚子\n其實不一樣嗎？", 200, 500, 640, 160, {
        fontSize: 50, color: INK, fontWeight: 900, fontFamily: SANS,
      }),

      // 柚子＋切片（簡單圖形，換成自己的商品圖也可以）
      L.shape("柚子", 350, 690, 150, 150, { kind: "ellipse", fill: "#f6cd2f" }),
      L.icon("葉子", "leaf", 450, 660, 64, "#4f9a3a"),
      L.shape("切片", 470, 740, 140, 140, { kind: "ellipse", fill: "#fff3b0", stroke: "#f2c200", strokeWidth: 10 }),
      L.shape("切片果肉", 500, 770, 80, 80, { kind: "star", sides: 8, fill: "#fbe07a" }),

      // 底部綠帶＋右滑引導
      L.shape("底帶", 0, 1040, S, 160, { kind: "rect", fill: GREEN }),
      // 左下兩隻跳舞的兔子（面對面），站在底帶上面（排在底帶後面才不會被蓋住腳）
      ...rabbit(40, 930, false, "rabbit-a"),
      ...rabbit(190, 915, true, "rabbit-b"),
      L.shape("引導膠囊", 540, 1075, 610, 92, { kind: "rect", fill: "#ffffff", radius: 46 }),
      L.text("引導", "右滑看哪裡不一樣 ▶▶▶", 540, 1075, 610, 92, { fontSize: 44, color: GREEN, fontWeight: 900 }),
    ],
  },
];
