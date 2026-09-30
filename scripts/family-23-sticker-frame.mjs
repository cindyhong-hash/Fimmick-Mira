// Family 23 — 雜誌白框＋貼紙大字（直式 3:4）
//
// 家族氣質：時尚配件的雜誌封面感主視覺。淡紫底上一個白色大框（上緣寬、兩側細），框裡一塊淡紫色面，
// 模特兒去背後從框裡往外破出去；上面左邊品牌大字＋小字、右邊「透光率僅 8%」的數字重點，
// 兩側細框上各一行轉 90° 的小字；左下兩塊黑底白字小標籤；最下面超大黑字加白色粗描邊（像貼紙），
// 旁邊一行斜的綠色手寫感英文。
// 參考：墨鏡品牌「Очки солнцезащитные」主視覺（2026-09-30 使用者提供，文案改成繁體中文）。
// 模特兒是 AI 生成後去背的示意照片；套用後換成自己的模特兒照、改文案。
import { L, DEG } from "./template-kit.mjs";

const W = 1200, H = 1600;
const SERIF = "'Noto Serif TC',serif";
const INK = "#111111";
const LAVENDER = "#a9a7ea";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const MODEL = `${BLOB}1790735856949-qai88q0gnft.png`;   // 872×1400，去背

const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });
const tag = (x, y, w, text) => [
  L.shape("黑色標籤", x, y, w, 66, { kind: "rect", fill: INK }),
  L.text("標籤字", text, x, y, w, 66, { fontSize: 44, color: "#ffffff", fontWeight: 700 }),
];

export const FAMILY = [
  {
    art: {
      name: "雜誌白框｜模特兒破框＋貼紙大字（直式）",
      family: "sticker-frame",
      composition: "magazine-frame-model-breakout",
      docW: W, docH: H,
      visualHierarchy: ["model", "sticker-word", "brand", "spec", "labels"],
      visualWeight: { model: 10, "sticker-word": 9, brand: 7, spec: 6, labels: 4 },
      readingDirection: "top-left→top-right→bottom",
      negativeSpace: 0.08,
      rationale:
        "白框＋淡紫面做出雜誌封面的格局，模特兒從框裡破出去，讓畫面有層次；上緣寬的白邊放品牌和一個數字重點（8%），兩側細邊的直排小字當節奏。最下面超大的黑字加白色粗描邊像貼紙一樣壓在畫面上，斜的綠色英文讓它不死板；黑底白字小標籤點出材質。",
      recommendedFor: "時尚配件、眼鏡、服飾的雜誌感主視覺",
    },
    layers: () => [
      L.shape("背景", 0, 0, W, H, { kind: "rect", fill: LAVENDER, gradient: { axis: "vertical", from: "#a4a2e8", to: "#bab8f0" } }, { type: "background", locked: true }),
      // 白色大框（上緣寬、兩側細）＋框裡的淡紫面
      L.shape("白框", 82, 122, 1036, 1330, { kind: "rect", fill: "#ffffff", radius: 26 }),
      L.shape("框內淡紫面", 155, 383, 888, 745, { kind: "rect", fill: "#b3b1ee" }),
      // 模特兒從框裡破出去
      image("模特兒（換成你的照片）", MODEL, 110, 200, Math.round(1450 * 872 / 1400), 1450),

      L.text("品牌", "BRAND", 120, 150, 460, 130, { fontSize: 116, color: INK, fontWeight: 900, align: "left", fontFamily: "Arial, sans-serif" }),
      L.text("品牌小字", "鏡片", 126, 280, 200, 52, { fontSize: 38, color: INK, fontWeight: 500, align: "left" }),
      L.text("規格", "透光率僅", 770, 150, 340, 54, { fontSize: 40, color: INK, fontWeight: 500, align: "right" }),
      L.text("數字", "8%", 770, 214, 340, 160, { fontSize: 150, color: INK, fontWeight: 900, align: "right", fontFamily: "Arial, sans-serif" }),

      // 兩側細框上的直排小字
      L.text("側邊小字", "Polaroid", 10, 675, 240, 50, { fontSize: 34, color: "#555555", fontWeight: 400, rotation: -90 * DEG, fontFamily: "Arial, sans-serif" }),
      // 中文轉 90° 會變成躺著的字，改成一個字一行直排
      L.text("側邊小字", [..."墨鏡・眼鏡盒・拭鏡布"].join("\n"), 1050, 520, 60, 420, { fontSize: 32, color: "#555555", fontWeight: 500 }),

      ...tag(150, 900, 176, "材質"),
      ...tag(206, 968, 176, "塑膠"),

      // 最下面：貼紙大字（黑字＋白色粗描邊）＋斜的綠色英文
      L.text("貼紙大字", "墨鏡", 80, 1070, 1040, 440, {
        fontSize: 400, color: INK, fontWeight: 900, fontFamily: SERIF, rotation: -2 * DEG,
        fx: { strokeColor: "#ffffff", strokeW: 0.14 },
        shadow: { color: "#4a48a0", opacity: 0.18, distance: 8, blur: 20, angle: 90 },
      }),
      L.text("英文副標", "sunglasses", 560, 1386, 580, 120, { fontSize: 96, color: "#9aa980", fontWeight: 700, fontFamily: SERIF, rotation: -8 * DEG, fx: { italic: true } }),
    ],
  },
];
