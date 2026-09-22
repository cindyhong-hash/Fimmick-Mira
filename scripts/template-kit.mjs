// 各設計家族共用的建構零件。只負責「怎麼做出一個圖層」，
// 不決定任何版面——構成決策寫在各家族自己的檔案裡。
export const S = 1200;
export const DEG = Math.PI / 180;

const BLOB = "https://v16uryj9gfmy6re4.public.blob.vercel-storage.com/";

/** 示意商品（都已裁掉透明邊；不裁的話依比例縮進框會變成一小支）。 */
export const PRODUCTS = {
  blue: `${BLOB}product-set-hero-1789962056557-1ocqi87cfc1h.png`,
  green: `${BLOB}1790063738911-aqpn0pb29lt.png`,
  white: `${BLOB}1790063739549-gn2sp249th.png`,
  amber: `${BLOB}1790063740119-w6y353zypt.png`,
  pink: `${BLOB}1790063740715-y2z16zkdeci.png`,
};

let seq = 0;
const base = (over) => {
  seq += 1;
  return {
    id: `l${seq}`, name: "圖層", type: "object", zIndex: seq,
    x: 0, y: 0, w: 100, h: 100, rotation: 0, visible: true, opacity: 1, locked: false,
    ...over,
  };
};

export const L = {
  shape: (name, x, y, w, h, spec, over = {}) => base({
    name, type: "object", x, y, w, h,
    shape: { kind: "rect", fill: "#ffffff", stroke: "none", strokeWidth: 0, ...spec },
    ...over,
  }),
  text: (name, content, x, y, w, h, over = {}) => base({
    name, type: "independent_text", x, y, w, h,
    isText: true, text: content, color: "#1f2937", fontSize: 56,
    fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700, align: "center",
    ...over,
  }),
  icon: (name, icon, x, y, size, fill, over = {}) => base({
    name, type: "object", x, y, w: size, h: size,
    shape: { kind: "icon", icon, fill, stroke: "none", strokeWidth: 0 },
    ...over,
  }),
  bg: (from, to, axis = "vertical") => base({
    name: "背景", type: "background", x: 0, y: 0, w: S, h: S, locked: true,
    shape: { kind: "rect", fill: from, stroke: "none", strokeWidth: 0, gradient: { axis, from, to } },
  }),
};

/** 示意商品圖層（可選落地陰影）。座標允許超出畫布，破邊是刻意的。 */
export const product = (src, x, y, w, h, over = {}) => [
  ...(over.shadow === false ? [] : [L.shape("商品陰影", x + w * 0.14, y + h * 0.88, w * 0.72, h * 0.08,
    { kind: "ellipse", fill: "#000000", softness: 0.9 }, { opacity: 0.18 })]),
  base({
    name: "示意商品（換成你的商品，或直接刪掉）",
    type: "object", x, y, w, h, image: src,
    ...(over.rotation ? { rotation: over.rotation } : {}),
    ...(over.opacity !== undefined ? { opacity: over.opacity } : {}),
  }),
];
