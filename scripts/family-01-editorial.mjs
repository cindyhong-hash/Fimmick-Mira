// Family 01 — Editorial
//
// 家族氣質：雜誌內頁。大量留白、極端字級落差、細線與小型英文標籤、
// 構成不對稱。不用置中、不用等寬格子、不用「圖＋標題＋按鈕」。
//
// 五個 composition 彼此至少變三項（構成／主角／留白帶／閱讀動線），
// 由 assertFamilyIsVaried() 在灌入前強制檢查。
import { L, S, DEG, product, PRODUCTS } from "./template-kit.mjs";

const SANS = "'Noto Sans TC',system-ui,sans-serif";
const SERIF = "'Noto Serif TC',serif";

export const FAMILY = [
  {
    art: {
      name: "Editorial｜商品破邊裁切",
      family: "editorial",
      composition: "image-cutout",
      visualHierarchy: ["product", "headline", "copy"],
      visualWeight: { product: 10, headline: 7, copy: 3, decoration: 1 },
      readingDirection: "top-left→bottom-right",
      negativeSpace: 0.42,
      rationale:
        "商品被畫布右緣裁掉三分之一，視覺重心因此偏出畫面外，左上的標題必須用同樣大的份量把重心拉回來；兩股力量之間空出的斜向通道就是這張的動線。",
      recommendedFor: "新品上市、單品主打",
    },
    layers: () => [
      L.bg("#efece5", "#e2ddd2"),
      // 商品刻意超出右緣：破邊才有張力，整支放進來就變型錄照
      // 右緣真的要切掉一截——整支都在畫面內就只是「靠右擺」，沒有破邊張力
      ...product(PRODUCTS.amber, 780, 150, 760, 1010, { shadow: false }),
      L.text("小標", "NEW IN", 90, 150, 300, 50, {
        fontSize: 26, align: "left", color: "#8f877a", fontFamily: SANS, fx: { letterSpacing: 0.5 },
      }),
      L.text("主標", "琥珀\n精萃", 90, 230, 520, 400, {
        fontSize: 170, align: "left", color: "#1e1b16", fontFamily: SERIF,
      }),
      L.shape("細線", 92, 690, 110, 2, { kind: "rect", fill: "#1e1b16" }),
      L.text("內文", "低溫萃取・整夜修護\n晨起摸得到的細緻", 90, 730, 420, 120, {
        fontSize: 26, align: "left", color: "#6b6357", fontFamily: SANS, fontWeight: 400,
      }),
      L.text("頁碼", "01", 90, 1070, 120, 50, {
        fontSize: 22, align: "left", color: "#a49b8c", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.3 },
      }),
    ],
  },
  {
    art: {
      name: "Editorial｜標題即畫面",
      family: "editorial",
      composition: "typography-as-image",
      visualHierarchy: ["headline", "product", "copy"],
      visualWeight: { headline: 10, product: 5, copy: 2 },
      readingDirection: "top→bottom",
      negativeSpace: 0.38,
      rationale:
        "標題大到成為畫面本身，字與字之間的縫隙就是這張的留白；商品縮到只在字腔裡露出一截，靠尺寸反差製造層次，而不是靠位置分區。",
      recommendedFor: "品牌宣言、season campaign",
    },
    layers: () => [
      L.bg("#1a1a1a", "#2b2b2b"),
      L.text("主標", "SLOW", 0, 90, 1200, 300, {
        fontSize: 300, color: "#f2efe9", fontFamily: SERIF,
      }),
      // 商品夾在兩行字中間，只露一截
      ...product(PRODUCTS.green, 470, 330, 260, 420, { shadow: false }),
      L.text("主標2", "BEAUTY", 0, 690, 1200, 300, {
        fontSize: 230, color: "#f2efe9", fontFamily: SERIF,
      }),
      L.text("內文", "慢下來，肌膚才跟得上", 0, 980, 1200, 60, {
        fontSize: 30, color: "#9a948a", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.2 },
      }),
      L.shape("細線", 500, 1070, 200, 1, { kind: "rect", fill: "#6b655c" }),
    ],
  },
  {
    art: {
      name: "Editorial｜對角動線",
      family: "editorial",
      composition: "diagonal",
      visualHierarchy: ["product", "headline", "badge"],
      visualWeight: { product: 9, headline: 6, badge: 4, decoration: 1 },
      readingDirection: "bottom-left→top-right",
      negativeSpace: 0.31,
      rationale:
        "一條傾斜色帶從左下貫穿到右上，商品沿著這條帶子傾斜擺放，標題壓在帶子的另一端；所有元素共用同一個傾角，視線被迫斜著走完整張。帶子兩側再各壓一排小標，把節奏填滿。",
      recommendedFor: "活力感檔期、運動保養",
    },
    layers: () => [
      L.bg("#f4f1ea", "#e8e3d6"),
      // 用一條超長的傾斜色帶當骨架，所有東西貼著它走
      L.shape("斜帶", -120, 520, 1440, 260, { kind: "rect", fill: "#c2603f" }, { rotation: -22 * DEG }),
      L.shape("斜細線", -120, 430, 1440, 3, { kind: "rect", fill: "#c2603f" }, { rotation: -22 * DEG, opacity: 0.45 }),
      ...product(PRODUCTS.amber, 180, 560, 330, 480, { rotation: -22 * DEG, shadow: false }),
      L.text("主標", "煥新", 700, 300, 420, 190, {
        fontSize: 150, align: "left", color: "#1f1b16", fontFamily: SERIF, rotation: -22 * DEG,
      }),
      // 副標移到色帶下緣的另一側；跟主標同一條斜線但不重疊
      L.text("副標", "RENEW YOUR SKIN", 560, 700, 520, 50, {
        fontSize: 26, align: "left", color: "#f0e4d8", fontFamily: SANS, fontWeight: 400,
        rotation: -22 * DEG, fx: { letterSpacing: 0.3 },
      }),
      L.shape("徽章", 880, 820, 200, 200, { kind: "ellipse", fill: "#1f1b16" }, { rotation: 12 * DEG }),
      L.text("徽章字", "限定", 880, 880, 200, 80, {
        fontSize: 56, color: "#f4f1ea", fontFamily: SERIF, rotation: 12 * DEG,
      }),
      // 沿著同一個傾角再壓三排小標，讓節奏連續、不要只剩一條孤帶
      ...["01  低溫萃取", "02  無添加香精", "03  8 小時修護"].map((t, i) =>
        L.text(`節奏${i}`, t, 120, 130 + i * 62, 520, 50, {
          fontSize: 26, align: "left", color: "#8a7a66", fontFamily: SANS, fontWeight: 400,
          rotation: -22 * DEG, fx: { letterSpacing: 0.15 },
        })),
      L.shape("底色塊", 0, 1010, 1200, 190, { kind: "rect", fill: "#1f1b16" }),
      L.text("底標", "EDITORIAL  /  RENEW", 0, 1055, 1200, 60, {
        fontSize: 30, color: "#e8e1d4", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.35 },
      }),
    ],
  },
  {
    art: {
      name: "Editorial｜框中框",
      family: "editorial",
      composition: "frame-within-frame",
      visualHierarchy: ["headline", "product", "subhead"],
      visualWeight: { headline: 9, product: 7, subhead: 3, decoration: 2 },
      readingDirection: "center→outward",
      negativeSpace: 0.19,
      rationale:
        "內框把商品關起來形成第一層畫面，標題刻意破框而出、跨在框線上，讓視線從框內被推到框外；破框的那個交界就是整張的重心。",
      recommendedFor: "質感單品、聯名款",
    },
    layers: () => [
      L.bg("#e8eae5", "#d7dbd3"),
      L.shape("外框", 60, 60, 1080, 1080, { kind: "rect", fill: "none", stroke: "#3a4038", strokeWidth: 2 }),
      // 內框壓深一階：白色商品放在淺綠上會整支消失，襯底必須比商品暗
      L.shape("內框", 250, 210, 700, 680, { kind: "rect", fill: "#7d8a76" }),
      ...product(PRODUCTS.amber, 430, 280, 340, 540, { shadow: false }),
      // 標題壓在內框下緣，一半在框裡一半在框外
      L.text("主標", "純粹", 130, 790, 940, 200, {
        fontSize: 190, color: "#23291f", fontFamily: SERIF,
      }),
      L.text("副標", "THE PURE EDIT", 130, 1000, 940, 50, {
        fontSize: 26, color: "#5f6759", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.45 },
      }),
      L.text("角標", "NO.04", 900, 120, 180, 40, {
        fontSize: 22, align: "right", color: "#6d7568", fontFamily: SANS, fontWeight: 400,
      }),
    ],
  },
  {
    art: {
      name: "Editorial｜大留白",
      family: "editorial",
      composition: "minimal-negative-space",
      visualHierarchy: ["copy", "product", "decoration"],
      visualWeight: { copy: 8, product: 4, decoration: 1 },
      readingDirection: "top-right→bottom-left",
      negativeSpace: 0.85,
      rationale:
        "六成以上留空，靠一條細線把右上的短句和左下的小商品串起來；元素少到每一個都必須被看見，留白本身成為主要的視覺份量。",
      recommendedFor: "品牌形象、極簡調性",
    },
    layers: () => [
      L.bg("#faf8f4", "#f2efe8"),
      L.text("短句", "少，但剛好", 620, 150, 480, 110, {
        fontSize: 72, align: "right", color: "#24211c", fontFamily: SERIF,
      }),
      L.text("英文", "LESS, BUT ENOUGH", 620, 280, 480, 50, {
        fontSize: 22, align: "right", color: "#9c9487", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.4 },
      }),
      // 細線把右上的字和左下的商品連起來——這是唯一的動線
      L.shape("連線", 200, 360, 700, 1, { kind: "rect", fill: "#c8c1b4" }, { rotation: 28 * DEG }),
      // 米白底上不能放白管，換成琥珀色才看得見
      ...product(PRODUCTS.amber, 150, 760, 190, 290, { shadow: false }),
      L.text("品牌", "BRAND", 150, 1090, 300, 40, {
        fontSize: 20, align: "left", color: "#b0a89a", fontFamily: SANS, fontWeight: 400, fx: { letterSpacing: 0.5 },
      }),
    ],
  },
];

export { S };
