import assert from "node:assert/strict";
import test from "node:test";
import { dailyLimitFor, dailyQuota, taipeiDay, type QuotaStore } from "./paid-quota.ts";

/** 記憶體版的計數表，行為跟資料庫版一樣：先佔位、再數。 */
function memoryStore() {
  const rows = new Map<string, { bucket: string; day: string }>();
  let seq = 0;
  const pruned: string[] = [];
  const store: QuotaStore = {
    claim: async (bucket, day) => { const id = `r${++seq}`; rows.set(id, { bucket, day }); return id; },
    count: async (bucket, day) => [...rows.values()].filter((r) => r.bucket === bucket && r.day === day).length,
    release: async (id) => { rows.delete(id); },
    prune: async (before) => { pruned.push(before); for (const [id, r] of rows) if (r.day < before) rows.delete(id); },
  };
  return { store, rows, pruned };
}
const NOON = Date.parse("2026-09-23T04:00:00Z");   // 台灣中午

test("到上限就擋下，被擋的那次不佔額度", async () => {
  const mem = memoryStore();
  const quota = dailyQuota("rebuild", { store: async () => mem.store, now: () => NOON, env: { PAID_DAILY_LIMIT_REBUILD: "2" }, random: () => 1 });
  assert.equal((await quota()).ok, true);
  assert.equal((await quota()).ok, true);
  const third = await quota();
  assert.equal(third.ok, false);
  if (!third.ok) assert.match(third.error, /照參考圖重做.*2 次/);
  assert.equal(mem.rows.size, 2, "被擋的那次要把自己佔的位置刪掉");
});

test("還回額度之後可以再用一次", async () => {
  const mem = memoryStore();
  const quota = dailyQuota("rebuild", { store: async () => mem.store, now: () => NOON, env: { PAID_DAILY_LIMIT_REBUILD: "1" }, random: () => 1 });
  const first = await quota();
  assert.ok(first.ok);
  if (first.ok) await first.release();
  assert.equal((await quota()).ok, true);
});

test("隔天重新計算；日期用台灣時間", async () => {
  const mem = memoryStore();
  let now = NOON;
  const quota = dailyQuota("image-set", { store: async () => mem.store, now: () => now, env: { PAID_DAILY_LIMIT_IMAGE_SET: "1" }, random: () => 1 });
  assert.equal((await quota()).ok, true);
  assert.equal((await quota()).ok, false);
  now = Date.parse("2026-09-23T16:30:00Z");          // 台灣時間 24 日 00:30
  assert.equal(taipeiDay(now), "2026-09-24");
  assert.equal((await quota()).ok, true);
});

test("每個功能各算各的", async () => {
  const mem = memoryStore();
  const env = { PAID_DAILY_LIMIT_REBUILD: "1", PAID_DAILY_LIMIT_IMAGE_SET: "1" };
  const deps = { store: async () => mem.store, now: () => NOON, env, random: () => 1 };
  assert.equal((await dailyQuota("rebuild", deps)()).ok, true);
  assert.equal((await dailyQuota("image-set", deps)()).ok, true);
});

test("上限可以用環境變數調整，設 0 就是暫停；亂填就用預設值", () => {
  assert.equal(dailyLimitFor("rebuild", {}), 50);
  assert.equal(dailyLimitFor("image-set", {}), 30);
  assert.equal(dailyLimitFor("rebuild", { PAID_DAILY_LIMIT_REBUILD: "80" }), 80);
  assert.equal(dailyLimitFor("image-set-analyze", { PAID_DAILY_LIMIT_IMAGE_SET_ANALYZE: "0" }), 0);
  assert.equal(dailyLimitFor("rebuild", { PAID_DAILY_LIMIT_REBUILD: "abc" }), 50);
  assert.equal(dailyLimitFor("rebuild", { PAID_DAILY_LIMIT_REBUILD: "-5" }), 50);
});

test("設 0 的功能直接擋下，不寫任何紀錄", async () => {
  const mem = memoryStore();
  const r = await dailyQuota("rebuild", { store: async () => mem.store, env: { PAID_DAILY_LIMIT_REBUILD: "0" } })();
  assert.equal(r.ok, false);
  assert.equal(mem.rows.size, 0);
});

test("偶爾清掉一週前的紀錄", async () => {
  const mem = memoryStore();
  await dailyQuota("rebuild", { store: async () => mem.store, now: () => NOON, env: {}, random: () => 0 })();
  assert.deepEqual(mem.pruned, ["2026-09-16"]);
});
