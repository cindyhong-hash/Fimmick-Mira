/* ============================================================
   付費功能的每日用量上限

   正式站可以不設網站密碼（讓同事、客戶直接進來用），但會花 AI 費用的端點
   不能讓任何人無限次地打。沒有密碼時就改用這裡的每日上限把關：
   就算網址外流被濫用，一天最多也只會花到上限的錢。

   計數存在資料庫（正式站同時有很多台伺服器，記在記憶體會各算各的）。
   沿用 StyleComponent 表（type = PAID_USAGE），跟範本庫一樣不另開表，
   就不用對正式站的 Turso 做結構變更。clientId 用固定的系統值，
   素材庫、風格積木那些依品牌或「未分類（clientId = null）」查的列表都碰不到它。

   做法是「先佔位、再數」：先寫一筆，再數今天有幾筆，超過上限就把自己那筆刪掉並拒絕。
   同時很多人按時最多只會少放行幾次，不會超過上限。
   ============================================================ */
import type { PaidQuotaResult } from "./site-gate";

export const PAID_USAGE_TYPE = "PAID_USAGE";
const SYSTEM_CLIENT_ID = "__system__";

/** 每個付費功能的預設每日上限；可用環境變數 PAID_DAILY_LIMIT_<BUCKET> 覆蓋（例如 PAID_DAILY_LIMIT_REBUILD=80，設 0 就是關閉）。 */
export const PAID_BUCKETS = {
  "rebuild": { label: "照參考圖重做", limit: 50 },
  "image-set": { label: "產品套圖", limit: 30 },
  "image-set-analyze": { label: "產品分析", limit: 60 },
  "image-set-retry": { label: "套圖重新生成", limit: 60 },
  "library-regenerate": { label: "素材重新生成", limit: 60 },
} as const;
export type PaidBucket = keyof typeof PAID_BUCKETS;

export type QuotaStore = {
  claim: (bucket: string, day: string) => Promise<string>;
  count: (bucket: string, day: string) => Promise<number>;
  release: (id: string) => Promise<void>;
  /** 刪掉 day 之前的紀錄。 */
  prune: (beforeDay: string) => Promise<void>;
};

/** 台灣時間的日期（YYYY-MM-DD）：上限在台灣的午夜重置，不是 UTC 的早上八點。 */
export function taipeiDay(nowMs: number): string {
  return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
}

export function dailyLimitFor(bucket: PaidBucket, env: Record<string, string | undefined> = process.env): number {
  const raw = env[`PAID_DAILY_LIMIT_${bucket.toUpperCase().replace(/-/g, "_")}`];
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : PAID_BUCKETS[bucket].limit;
}

async function dbStore(): Promise<QuotaStore> {
  // 動態載入：site-gate 會被 proxy（middleware）引用，不能讓它連帶把資料庫打包進去
  const { db } = await import("./db");
  return {
    claim: async (bucket, day) => (await db.styleComponent.create({
      data: { type: PAID_USAGE_TYPE, name: bucket, sourceLayoutId: day, clientId: SYSTEM_CLIENT_ID, data: "{}" },
    })).id,
    count: (bucket, day) => db.styleComponent.count({ where: { type: PAID_USAGE_TYPE, name: bucket, sourceLayoutId: day } }),
    release: async (id) => { await db.styleComponent.delete({ where: { id } }).catch(() => {}); },
    prune: async (beforeDay) => { await db.styleComponent.deleteMany({ where: { type: PAID_USAGE_TYPE, sourceLayoutId: { lt: beforeDay } } }); },
  };
}

/** 給 protectPaidRoute 的 quota：每次呼叫佔一次今天的額度。 */
export function dailyQuota(
  bucket: PaidBucket,
  deps: { store?: () => Promise<QuotaStore>; now?: () => number; env?: Record<string, string | undefined>; random?: () => number } = {},
): () => Promise<PaidQuotaResult> {
  return async () => {
    const { label } = PAID_BUCKETS[bucket];
    const limit = dailyLimitFor(bucket, deps.env);
    if (limit === 0) return { ok: false, error: `「${label}」目前暫停使用。` };
    const store = await (deps.store ?? dbStore)();
    const now = (deps.now ?? Date.now)();
    const day = taipeiDay(now);
    const id = await store.claim(bucket, day);
    const used = await store.count(bucket, day);
    if (used > limit) {
      await store.release(id);
      return { ok: false, error: `今天「${label}」已經用了 ${limit} 次（每日上限），明天再試。` };
    }
    // 偶爾順手清掉一週前的紀錄，不用另外排程
    if ((deps.random ?? Math.random)() < 0.05) await store.prune(taipeiDay(now - 7 * 86_400_000)).catch(() => {});
    return { ok: true, release: () => store.release(id) };
  };
}
