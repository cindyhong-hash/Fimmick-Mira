// 灌入前先檢查設計宣告是否屬實。
// 用法：npx tsx scripts/audit-templates.mjs
//
// 這支存在的理由：宣告「留白 40%」很容易，畫面實際塞滿也很容易。
// 兩者對不上就是版型沒做到自己說的事，應該在進入範本庫之前就被擋下來。
const file = process.argv[2] ?? "./family-01-editorial.mjs";
const { FAMILY, S } = await import(file);
import {
  assertValidArtDirection, assertFamilyIsVaried, auditTemplate,
} from "../src/lib/magic-layers/template-design-system.ts";

const arts = FAMILY.map((f) => f.art);
arts.forEach(assertValidArtDirection);
// 差異不足先記下來，不要直接中斷——還是要先看到每張的實際留白才好決定怎麼分開
let varietyError = null;
try { assertFamilyIsVaried(arts); } catch (e) { varietyError = e.message; }

let bad = 0;
for (const f of FAMILY) {
  const a = auditTemplate(f.art, f.layers(), S);
  if (!a.ok) bad += 1;
  console.log(
    a.ok ? "✓" : "✗", f.art.name,
    `｜${f.art.composition}｜宣告留白 ${(f.art.negativeSpace * 100).toFixed(0)}%`,
    `實際 ${(a.measured.negativeSpace * 100).toFixed(0)}%`,
    a.problems.length ? `→ ${a.problems.join("；")}` : "",
  );
}
if (varietyError) console.error(`\n✗ ${varietyError}`);
if (bad || varietyError) { console.error(`\n${bad} 個版型沒通過檢查`); process.exit(1); }
console.log("\n全部通過");
