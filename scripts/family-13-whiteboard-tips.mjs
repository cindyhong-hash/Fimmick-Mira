// Family 13 — 白板主視覺＋三格頭像（職場小心機）
//
// 家族氣質：日系插畫感的知識／活動貼文。上半部一塊白板（灰藍外框、上方夾子、左下長尾夾），
// 白板上寫大標：綠色「新鮮人」＋綠色膠囊「職場小心機」＋黃色螢光筆副標，左邊幾個手寫對話泡泡，右邊一位老師插畫；
// 下半部深藍色：活動說明一行（「3」黃色大字、「抽」放進黃色圓），三格圓形頭像＋三個重點。
// 參考：洗護品牌「新鮮人職場小心機」留言抽獎貼文（2026-09-29 使用者提供）。
// 老師、三個頭像都是 AI 生成的示意插畫（頭像放進圓框、自動裁成圓的），點點底是程式畫的；套用後換成自己的圖與文字。
import { L, S, DEG } from "./template-kit.mjs";

const GREEN = "#1f9e6e";
const GREEN_D = "#1d6b4d";
const NAVY = "#22325f";
const BLUE = "#3353a6";
const YELLOW = "#fbe76a";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const DOTS = `${BLOB}1790659994673-n9artnh9sx.png`;       // 1200×1200，水藍點點
const TEACHER = `${BLOB}1790659992790-u5lxp49njz.png`;    // 723×1009，去背
const AVATARS = [`${BLOB}1790659995188-8v3r0i4xk2t.jpg`, `${BLOB}1790659996080-fq8zo6ejo3.jpg`, `${BLOB}1790659996599-kholfn3505t.jpg`];

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/** 手寫感的對話泡泡：灰色橢圓線框＋灰字，微微傾斜。 */
const bubble = (x, y, text) => [
  L.shape("對話泡泡", x, y, 200, 78, { kind: "ellipse", fill: "none", stroke: "#9aa3b5", strokeWidth: 3 }, { rotation: -8 * DEG }),
  L.text("泡泡字", text, x, y, 200, 78, { fontSize: 30, color: "#8a93a6", fontWeight: 500, rotation: -8 * DEG }),
];
/** 大標兩側的斜虛線（五小段）。 */
const dashes = (x0, y0, dx, dy, deg) => [0, 1, 2, 3, 4].map((i) =>
  L.shape("虛線", x0 + dx * i, y0 + dy * i, 6, 18, { kind: "rect", fill: GREEN, radius: 3 }, { rotation: deg * DEG }));

/** 下半部一格：藍底白框＋圓形頭像（放在圓框裡）＋閃光＋重點文字。 */
function card(i, x, label) {
  const W = 388, cx = x + W / 2, y = 800, R = 300;
  const frame = L.shape("頭像圓框", cx - R / 2, y + 22, R, R, { kind: "ellipse", fill: "#ffffff" });
  return [
    L.shape("格子", x, y, W, 394, { kind: "rect", fill: BLUE, stroke: "#ffffff", strokeWidth: 4 }),
    frame,
    image(`頭像 ${i + 1}（換成你的圖）`, AVATARS[i], cx - R / 2, y + 22, R, R, { clipTo: frame.id }),
    L.shape("頭像外框", cx - R / 2, y + 22, R, R, { kind: "ellipse", fill: "none", stroke: NAVY, strokeWidth: 6 }),
    L.icon("閃光", "sparkle", cx - R / 2 + 18, y + 120, 34, NAVY),
    L.icon("閃光", "sparkle", cx + R / 2 - 52, y + 196, 30, NAVY),
    L.text("重點", label, x + 10, y + 318, W - 20, 70, { fontSize: 62, color: "#ffffff", fontWeight: 900 }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "白板主視覺｜職場小心機＋三格頭像",
      family: "whiteboard-tips",
      composition: "whiteboard-hero-three-avatars",
      visualHierarchy: ["headline", "illustration", "cta-line", "avatars"],
      visualWeight: { headline: 9, illustration: 7, avatars: 7, "cta-line": 6, decoration: 3 },
      readingDirection: "top→bottom, left→right",
      negativeSpace: 0.16,
      rationale:
        "白板＋夾子讓人一看就知道是「上課／小知識」，大標拆成兩層：小一點的綠字帶出對象、綠色膠囊放主題；老師插畫指著標題把視線拉回來。下半部換成深藍，先用一行字說活動（數字和「抽」用黃色跳出來），再用三個一樣大的圓形頭像排成三格，一格一個重點，好比較也好記。",
      recommendedFor: "知識型貼文、新手指南、留言抽獎活動",
    },
    layers: () => [
      image("點點底", DOTS, 0, 0, S, S, { type: "background", locked: true }),
      L.text("品牌", "BRAND", 36, 16, 220, 60, { fontSize: 42, color: GREEN, fontWeight: 700, align: "left" }),

      // 白板：灰藍外框＋白板面＋上方夾子
      L.shape("白板外框", 40, 78, 1120, 600, { kind: "rect", fill: "#c9d4e6", stroke: "#3a4a6b", strokeWidth: 5, radius: 30 }),
      L.shape("白板", 70, 108, 1060, 560, { kind: "rect", fill: "#ffffff", stroke: "#3a4a6b", strokeWidth: 4, radius: 6 }),
      L.shape("夾子", 490, 66, 220, 58, { kind: "rect", fill: "#c9d4e6", stroke: "#3a4a6b", strokeWidth: 5, radius: 14 }),
      L.shape("夾子凹槽", 532, 84, 136, 14, { kind: "rect", fill: "#7a86a6", radius: 7 }),

      ...bubble(96, 144, "面試OK!"),
      ...bubble(118, 214, "就職OK!"),
      ...bubble(88, 284, "會議OK!"),

      ...dashes(322, 190, 13, 20, -32),
      ...dashes(792, 190, -13, 20, 32),
      L.text("大標上", "新鮮人", 380, 178, 360, 130, { fontSize: 118, color: GREEN, fontWeight: 900 }),
      // 綠色膠囊主標（外框深綠、裡面一圈白線）
      L.shape("主標膠囊", 190, 320, 720, 170, { kind: "rect", fill: "#2aa57a", stroke: GREEN_D, strokeWidth: 5, radius: 85 }),
      L.shape("主標內框", 206, 334, 688, 142, { kind: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 4, radius: 71 }),
      L.text("主標", "職場小心機", 190, 320, 720, 170, { fontSize: 124, color: "#ffffff", fontWeight: 900, fx: { strokeColor: GREEN_D, strokeW: 0.06 } }),
      // 黃色螢光筆副標
      L.shape("螢光筆", 290, 520, 540, 50, { kind: "rect", fill: "#fbf5a0" }),
      L.text("副標", "{ 品牌助你第一印象加滿分 }", 250, 506, 620, 76, { fontSize: 38, color: GREEN_D, fontWeight: 700 }),

      // 左下長尾夾（圈在後面、夾片在前面）
      L.shape("長尾夾圈", 72, 548, 62, 62, { kind: "ellipse", fill: "none", stroke: "#3a4a6b", strokeWidth: 5 }),
      L.shape("長尾夾", 50, 594, 110, 42, { kind: "rect", fill: "#f1a9b8", stroke: "#3a4a6b", strokeWidth: 4, radius: 6 }),
      // 右邊老師插畫（腳下被藍色區塊蓋住）
      image("老師插畫（換成你的圖）", TEACHER, 888, 230, 300, Math.round(300 * 1009 / 723)),

      // 下半部：藍色區塊＋活動說明一行
      L.shape("藍色區塊", 0, 650, S, 550, { kind: "rect", fill: BLUE }),
      L.text("活動說明", "留言區完成簡單", 168, 660, 430, 84, { fontSize: 58, color: "#ffffff", fontWeight: 900, align: "left" }),
      L.text("數字", "3", 598, 646, 64, 104, { fontSize: 96, color: "#ffe14a", fontWeight: 900, fontFamily: "'Noto Serif TC',serif", fx: { italic: true } }),
      L.text("活動說明", "步驟", 668, 660, 130, 84, { fontSize: 58, color: "#ffffff", fontWeight: 900, align: "left" }),
      L.shape("抽圓", 806, 664, 78, 78, { kind: "ellipse", fill: YELLOW }),
      L.text("抽", "抽", 806, 664, 78, 78, { fontSize: 52, color: BLUE, fontWeight: 900 }),
      L.text("活動說明", "好禮", 894, 660, 130, 84, { fontSize: 58, color: "#ffffff", fontWeight: 900, align: "left" }),
      ...[200, 600, 1000].map((cx) => L.text("加分", "\\ 加分 /", cx - 90, 744, 180, 46, { fontSize: 30, color: "#ffffff", fontWeight: 500 })),

      ...card(0, 6, "妝容得體"),
      ...card(1, 406, "衣著整潔"),
      ...card(2, 806, "明亮秀髮"),
    ],
  },
];
