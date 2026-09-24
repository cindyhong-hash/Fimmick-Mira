// 把設計好的範本匯出成內建資料，讓它們跟著程式碼走。
//
// 原本範本只存在資料庫，所以本機灌好了、正式站還是空的，換一台電腦也要再灌一次。
// 內建之後每個環境自動都有，不需要對正式站做任何資料操作（正式站有密碼閘，
// 也不該為了灌資料去繞過它）。
//
// 縮圖沿用先前上傳到 Blob 的網址——Blob 是跨環境共用的，正式站讀得到。
//
// 用法：node scripts/export-builtin-templates.mjs
// 產出：src/lib/magic-layers/builtin-templates.json
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { TEMPLATES as LEGACY, DOC } from "./seed-canvas-templates.data.mjs";
import { FAMILY as F1 } from "./family-01-editorial.mjs";
import { FAMILY as F2 } from "./family-02-kbeauty.mjs";
import { FAMILY as F3 } from "./family-03-y2k.mjs";
import { FAMILY as F4 } from "./family-04-luxury.mjs";
import { FAMILY as SHOWCASE } from "./showcase-ai-background.mjs";
import { FAMILY as F5 } from "./family-05-promo.mjs";
import { FAMILY as F6 } from "./family-06-festival.mjs";
import { FAMILY as F7 } from "./family-07-health.mjs";
import { FAMILY as F8 } from "./family-08-pain-points.mjs";

const DB = "prisma/dev-release.db";
const OUT = "src/lib/magic-layers/builtin-templates.json";

/**
 * 已下架的範本（2026-09-24 使用者覺得品質不夠，要重做一批）。
 * 設計檔先留著，只是不再匯出；編號照原本的順序給，剩下的範本 id 不會跟著往前移。
 */
const RETIRED = new Set([
  "11 系列・封面", "12 系列・功效實證", "13 系列・核心成分", "15 系列・使用步驟",
  "Editorial｜標題即畫面", "Editorial｜對角動線", "Editorial｜框中框", "Editorial｜大留白",
  "Luxury｜黑金雙欄", "Luxury｜置中儀式感", "Luxury｜襯線破邊", "Luxury｜字框標題",
  // 2026-09-24 第二批下架
  "14 系列・使用前後", "16 系列・立即入手", "17 完整詳情頁・墨綠實證（一次生好所有物件）",
  "K-Beauty｜光環單品", "Y2K｜半調漸層",
]);

/**
 * 名稱 → 縮圖網址。先用目前 JSON 裡已經有的（縮圖都在共用的 Blob 上），
 * 再用本機資料庫的蓋過去（同名取最新一筆；反覆灌入會留下重複）。
 * 這樣換一台電腦、本機資料庫沒有舊範本時也跑得起來，只有新範本要先產生縮圖。
 */
function thumbnails() {
  const map = new Map();
  try { for (const t of JSON.parse(readFileSync(OUT, "utf8"))) if (t.previewUrl) map.set(t.name, t.previewUrl); } catch { /* 第一次產生 */ }
  const rows = JSON.parse(execFileSync("sqlite3", [
    "-json", DB,
    "select name, previewUrl, createdAt from StyleComponent where type='CANVAS_TEMPLATE' order by createdAt",
  ], { encoding: "utf8" }) || "[]");
  for (const r of rows) if (r.previewUrl) map.set(r.name, r.previewUrl);
  return map;
}
/** --draft：還沒有縮圖的新範本也先匯出（previewUrl 空著），方便在編輯器裡套用檢查、再存縮圖。 */
const DRAFT = process.argv.includes("--draft");

const thumbs = thumbnails();
const entries = [
  ...LEGACY.slice(10).map((t) => ({ name: t.name, layers: t.layers(), art: null })),
  ...[...F1, ...F2, ...F3, ...F4, ...SHOWCASE, ...F5, ...F6, ...F7, ...F8].map((f) => ({
    name: f.art.name, layers: f.layers(),
    art: {
      family: f.art.family, composition: f.art.composition,
      negativeSpace: f.art.negativeSpace, recommendedFor: f.art.recommendedFor,
    },
  })),
];

const missing = entries.filter((e) => !thumbs.get(e.name) && !RETIRED.has(e.name));
if (missing.length && !DRAFT) {
  console.error("缺縮圖，先跑一次 seed-canvas-templates.mjs 產生：");
  for (const m of missing) console.error("  -", m.name);
  process.exit(1);
}


const builtins = entries.map((e, i) => ({
  id: `builtin-${String(i + 1).padStart(2, "0")}`,
  name: e.name,
  previewUrl: thumbs.get(e.name) ?? null,
  docW: DOC, docH: DOC,
  art: e.art,
  layers: e.layers,
})).filter((t) => !RETIRED.has(t.name));

writeFileSync(OUT, `${JSON.stringify(builtins, null, 0)}\n`);
const kb = Math.round(readFileSync(OUT).length / 1024);
console.log(`✓ ${builtins.length} 個內建範本 → ${OUT}（${kb} KB）`);
