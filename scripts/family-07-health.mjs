// Family 07 — 健康衛教（人物照＋三格重點）
//
// 家族氣質：醫師／診所的衛教貼文。左邊一張滿版人物照撐起情緒（健康、正向），
// 左上手寫感的粉紅標題＋藍色標籤點出主題，右邊一欄淺藍底三格重點（線條圖示＋粉紅標題＋灰色說明）。
// 參考：婦產科醫師的更年期衛教貼文（2026-09-24 使用者提供）。
// 人物照、三個線條圖示都是 AI 生成的示意素材（圖示生成後去白底、加粗、統一成粉紅）；
// 套用後換成自己的照片，或把圖示換成別的主題。
import { L, S, DEG } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";
const PINK = "#e8336d";
const BLUE = "#5aa9e6";
const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";
const PHOTO = `${BLOB}1790240665356-beb8cdptnri.jpg`;   // 627×1024，跟左欄 735×1200 同比例
const ICONS = {
  heart: `${BLOB}1790240666017-vcyz002u8r.png`,
  bone: `${BLOB}1790240666735-4rsfr3bc4a.png`,
  pelvis: `${BLOB}1790240667450-ao9bur9xoto.png`,
};

/** 圖片圖層（不是示意商品，名字自己給）。 */
const image = (name, src, x, y, w, h, over = {}) => L.shape(name, x, y, w, h, { kind: "rect" }, { image: src, shape: undefined, ...over });

/** 右欄一格：白圓＋線條圖示＋粉紅標題＋灰色說明，左邊一個指向右的藍色小三角。 */
function point(i, icon, title, sub) {
  const top = i * 400, cx = 967;
  return [
    L.shape("白圓", cx - 95, top + 40, 190, 190, { kind: "ellipse", fill: "#ffffff" }),
    image("圖示", icon, cx - 66, top + 70, 132, 132),
    L.text("重點標題", title, 755, top + 262, 425, 56, { fontSize: 40, color: PINK, fontWeight: 900, fontFamily: SERIF }),
    L.text("重點說明", sub, 755, top + 322, 425, 44, { fontSize: 26, color: "#4b5563", fontWeight: 500 }),
    L.shape("箭頭", 698, top + 178, 44, 40, { kind: "triangle", fill: BLUE }, { rotation: 90 * DEG }),
  ];
}

export const FAMILY = [
  {
    art: {
      name: "健康衛教｜人物照＋三格重點",
      family: "health",
      composition: "photo-left-list-right",
      visualHierarchy: ["photo", "headline", "points"],
      visualWeight: { photo: 9, headline: 8, points: 7, badge: 3 },
      readingDirection: "left→right, top→bottom",
      negativeSpace: 0.2,
      rationale:
        "左六右四：左邊人物照給情緒（健康、正向），標題放在照片上方的留白牆面，手寫感粉紅字＋藍色標籤點出主題；右邊淺藍底切成三格，每格同一套格式（圖示／標題／說明），藍色小三角從照片指向重點，讓人自然往右讀。",
      recommendedFor: "醫師／診所衛教、保健知識、專家觀點",
    },
    layers: () => [
      L.bg("#ffffff", "#ffffff"),
      image("人物照（換成你的照片）", PHOTO, 0, 0, 735, 1200),

      // 左上標題：手寫感、微微傾斜；白色外光暈讓字壓在照片上也清楚
      L.text("標題上", "35歲後", 140, 50, 380, 96, {
        fontSize: 76, color: PINK, fontFamily: SERIF, fontWeight: 700, rotation: -4 * DEG,
        glow: { color: "#ffffff", size: 10, opacity: 0.9, strength: 2 },
      }),
      L.text("標題", "開始為更年期做準備吧！", 24, 150, 700, 96, {
        fontSize: 60, color: PINK, fontFamily: SERIF, fontWeight: 700, rotation: -3 * DEG,
        glow: { color: "#ffffff", size: 10, opacity: 0.9, strength: 2 },
      }),
      L.icon("閃光", "sparkle", 110, 120, 34, "#ffffff"),
      L.icon("閃光", "sparkle", 600, 262, 40, "#ffffff"),
      L.shape("標籤底", 150, 262, 430, 62, { kind: "rect", fill: BLUE }, { rotation: -3 * DEG }),
      L.text("標籤", "優雅面對荷爾蒙變化", 150, 262, 430, 62, { fontSize: 34, color: "#ffffff", fontWeight: 700, rotation: -3 * DEG }),

      // 左下醫師社群標籤
      L.shape("社群標籤", 30, 1092, 360, 70, { kind: "rect", fill: "#ffffff", radius: 10 },
        { glow: { color: "#1f2937", size: 12, opacity: 0.15, strength: 1 } }),
      L.shape("社群圖示底", 42, 1102, 50, 50, { kind: "rect", fill: "#1877f2", radius: 8 }),
      L.text("社群圖示", "f", 42, 1102, 50, 50, { fontSize: 38, color: "#ffffff", fontWeight: 900, fontFamily: "Arial, sans-serif" }),
      L.text("醫師", "婦產科 醫師名稱", 104, 1092, 276, 70, { fontSize: 30, color: "#1f2937", fontWeight: 700, align: "left", fontFamily: SANS }),

      // 右欄：淺藍底＋三格（白線分隔）
      L.shape("右欄底", 735, 0, 465, S, { kind: "rect", fill: "#c9e4f8" }),
      L.shape("分隔線", 755, 398, 425, 4, { kind: "rect", fill: "#ffffff" }),
      L.shape("分隔線", 755, 798, 425, 4, { kind: "rect", fill: "#ffffff" }),
      ...point(0, ICONS.heart, "心血管疾病風險倍增", "健康飲食＋運動維護心血管健康"),
      ...point(1, ICONS.bone, "骨質疏鬆風險提高", "多補鈣、多運動、少菸酒"),
      ...point(2, ICONS.pelvis, "骨盆腔鬆弛怎麼辦？", "凱格爾運動維持肌力"),
    ],
  },
];
