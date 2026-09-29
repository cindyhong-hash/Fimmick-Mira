// Family 21 — 九宮格圈圈看（困擾賓果）
//
// 家族氣質：互動型貼文。水藍底＋柔和光斑，上方白色大標＋一朵白雲寫「圈圈看」；
// 中間 3×3 九宮格，每格一個困擾，其中幾格用橘色手繪感的雙圈圈起來（像真的有人拿筆圈）；
// 最下面一條橘色帶問「崩潰連線了嗎？」＋白色箭頭，商品從右下角冒出來。
// 參考：洗髮精品牌「擾人的頭皮問題 圈圈看」貼文（2026-09-29 使用者提供）。
// 洗髮精瓶是 AI 生成後去背的示意商品；套用後換成自己的商品、改九格的內容（圈圈可以拖到別格或刪掉）。
import { L, S, DEG } from "./template-kit.mjs";

const BLUE = "#1d8fb0";
const ORANGE = "#f26b1d";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const BOTTLES = `${BLOB}1790674772396-omlx5rklr4q.png`;   // 463×700，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const plus = (cx, cy, size, color) => [
  L.shape("十字", cx - size / 2, cy - size / 8, size, size / 4, { kind: "rect", fill: color, radius: 3 }),
  L.shape("十字", cx - size / 8, cy - size / 2, size / 4, size, { kind: "rect", fill: color, radius: 3 }),
];

/** 九宮格的一格：淺藍外框＋白色漸層內框＋藍字；circled 就疊一個橘色手繪雙圈。 */
function tile(col, row, text, circled) {
  const x = 228 + col * 256, y = 228 + row * 256, s = 228;
  return [
    L.shape("格子外框", x, y, s, s, { kind: "rect", fill: "#bfe9f2", radius: 28 }, { shadow: { color: "#1f6f84", opacity: 0.18, distance: 6, blur: 14, angle: 90 } }),
    L.shape("格子", x + 10, y + 10, s - 20, s - 20, { kind: "rect", fill: "#ffffff", radius: 22, gradient: { axis: "vertical", from: "#ffffff", to: "#e3f5f9" } }),
    L.text("困擾", text, x, y, s, s, { fontSize: 50, color: BLUE, fontWeight: 700 }),
    ...(circled ? [
      // 兩圈略微錯開、各轉一點角度，看起來像手畫的
      L.shape("手繪圈", x - 8, y + 4, s + 10, s - 16, { kind: "ellipse", fill: "none", stroke: ORANGE, strokeWidth: 4 }, { rotation: -9 * DEG }),
      L.shape("手繪圈", x + 2, y - 4, s - 6, s - 6, { kind: "ellipse", fill: "none", stroke: ORANGE, strokeWidth: 3 }, { rotation: 7 * DEG, opacity: 0.9 }),
    ] : []),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "九宮格圈圈看｜困擾賓果＋商品",
      family: "bingo-circle",
      composition: "three-by-three-grid-bottom-band",
      visualHierarchy: ["headline", "grid", "circles", "band", "product"],
      visualWeight: { headline: 8, grid: 9, circles: 7, band: 6, product: 6 },
      readingDirection: "top→grid→bottom",
      negativeSpace: 0.12,
      rationale:
        "用「圈圈看」把困擾清單變成互動遊戲：九宮格一格一個困擾，橘色手繪雙圈像真的有人圈過，讓人想留言自己中了幾個；水藍底配白格子乾淨好讀，唯一的強調色是橘色（圈圈、十字、底部帶），最後一句「連線了嗎？」把人帶到右下角的商品。",
      recommendedFor: "互動留言貼文、困擾／症狀清單、測驗型內容",
    },
    layers: () => [
      L.bg("#86d0dc", "#5fb8c9"),
      // 柔和光斑
      L.shape("光斑", -120, 380, 420, 420, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.12 }),
      L.shape("光斑", 880, -80, 380, 380, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.14 }),
      L.shape("光斑", 1000, 620, 260, 260, { kind: "ellipse", fill: "#ffffff" }, { opacity: 0.1 }),

      // 左上品牌
      L.shape("品牌圓", 44, 30, 140, 110, { kind: "ellipse", fill: ORANGE }),
      L.text("品牌", "BRAND", 44, 30, 140, 110, { fontSize: 32, color: "#ffffff", fontWeight: 900 }),
      L.text("品牌副", "for hair", 44, 140, 140, 34, { fontSize: 22, color: ORANGE, fontWeight: 700 }),

      // 大標＋白雲「圈圈看」
      L.text("大標", "擾人的頭皮問題", 176, 60, 540, 120, { fontSize: 76, color: "#ffffff", fontWeight: 900,
        shadow: { color: "#1f6f84", opacity: 0.35, distance: 5, blur: 8, angle: 90 } }),
      L.shape("雲", 736, 70, 120, 100, { kind: "ellipse", fill: "#ffffff" }),
      L.shape("雲", 806, 46, 150, 140, { kind: "ellipse", fill: "#ffffff" }),
      L.shape("雲", 916, 70, 120, 100, { kind: "ellipse", fill: "#ffffff" }),
      L.shape("雲", 756, 100, 270, 86, { kind: "rect", fill: "#ffffff", radius: 43 }),
      L.text("圈圈看", "圈圈看", 736, 60, 300, 130, { fontSize: 82, color: ORANGE, fontWeight: 900 }),
      ...plus(1110, 150, 50, ORANGE), ...plus(1060, 225, 64, "#ffffff"),
      ...plus(98, 930, 50, "#ffffff"), ...plus(158, 990, 44, ORANGE),

      // 九宮格
      ...tile(0, 0, "換季\n敏感", true), ...tile(1, 0, "皮屑\n增多", false), ...tile(2, 0, "狂掉髮", true),
      ...tile(0, 1, "髮際線\n倒退", false), ...tile(1, 1, "易油頭", true), ...tile(2, 1, "頭皮\n發紅", false),
      ...tile(0, 2, "頭髮\n扁塌", true), ...tile(1, 2, "頭皮癢", false), ...tile(2, 2, "條碼\n瀏海", false),

      // 最下面橘色帶＋白色箭頭＋商品
      L.shape("橘色帶", 0, 1036, S, 164, { kind: "rect", fill: ORANGE }),
      L.text("結語", "崩潰連線了嗎？趕快使用品牌淨衡洗髮精！", 70, 1062, 860, 64, { fontSize: 40, color: "#ffffff", fontWeight: 700, align: "left", fx: { letterSpacing: 3 } }),
      L.shape("箭頭線", 330, 1148, 500, 30, { kind: "path", fill: "none", stroke: "#ffffff", strokeWidth: 3, closed: false,
        points: [{ x: -0.5, y: 0.3 }, { x: 0.5, y: -0.1, ix: -0.25, iy: 0.2, ox: 0, oy: 0 }] }),
      L.shape("箭頭尖", 806, 1134, 26, 22, { kind: "path", fill: "none", stroke: "#ffffff", strokeWidth: 3, closed: false,
        points: [{ x: -0.5, y: -0.5 }, { x: 0.5, y: 0.05 }, { x: -0.4, y: 0.5 }] }),
      image("示意商品（換成你的商品，或直接刪掉）", BOTTLES, 905, 830, Math.round(390 * 463 / 700), 390,
        { shadow: { color: "#0f4f5f", opacity: 0.25, distance: 12, blur: 22, angle: 100 } }),
    ],
  },
];
