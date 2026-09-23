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

const DB = "prisma/dev-release.db";
const OUT = "src/lib/magic-layers/builtin-templates.json";

/** 名稱 → 縮圖網址。同名取最新一筆（反覆灌入會留下重複）。 */
function thumbnails() {
  const rows = JSON.parse(execFileSync("sqlite3", [
    "-json", DB,
    "select name, previewUrl, createdAt from StyleComponent where type='CANVAS_TEMPLATE' order by createdAt",
  ], { encoding: "utf8" }) || "[]");
  const map = new Map();
  for (const r of rows) if (r.previewUrl) map.set(r.name, r.previewUrl);
  return map;
}

const thumbs = thumbnails();
const entries = [
  ...LEGACY.slice(10).map((t) => ({ name: t.name, layers: t.layers(), art: null })),
  ...[...F1, ...F2, ...F3, ...F4, ...SHOWCASE].map((f) => ({
    name: f.art.name, layers: f.layers(),
    art: {
      family: f.art.family, composition: f.art.composition,
      negativeSpace: f.art.negativeSpace, recommendedFor: f.art.recommendedFor,
    },
  })),
];

const missing = entries.filter((e) => !thumbs.get(e.name));
if (missing.length) {
  console.error("缺縮圖，先跑一次 seed-canvas-templates.mjs 產生：");
  for (const m of missing) console.error("  -", m.name);
  process.exit(1);
}

const builtins = entries.map((e, i) => ({
  id: `builtin-${String(i + 1).padStart(2, "0")}`,
  name: e.name,
  previewUrl: thumbs.get(e.name),
  docW: DOC, docH: DOC,
  art: e.art,
  layers: e.layers,
}));

writeFileSync(OUT, `${JSON.stringify(builtins, null, 0)}\n`);
const kb = Math.round(readFileSync(OUT).length / 1024);
console.log(`✓ ${builtins.length} 個內建範本 → ${OUT}（${kb} KB）`);
