import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizePaidRequest,
  createSiteGateToken,
  protectPaidRoute,
  verifySiteGateCookie,
} from "./site-gate.ts";

test("accepts only the derived HttpOnly site gate cookie", () => {
  const password = "correct horse battery staple";
  const token = createSiteGateToken(password);
  assert.equal(verifySiteGateCookie(`other=1; site_gate=${token}`, password), true);
  assert.equal(verifySiteGateCookie("site_gate=wrong", password), false);
  assert.equal(verifySiteGateCookie("other=1", password), false);
  assert.notEqual(token, password);
});

test("paid endpoints fail closed in production when SITE_PASSWORD is missing", () => {
  const result = authorizePaidRequest(new Request("https://example.test/api/paid"), {
    nodeEnv: "production",
    sitePassword: undefined,
  });
  assert.deepEqual(result, {
    ok: false,
    status: 503,
    error: "付費功能尚未完成安全設定。",
  });
});

test("paid endpoints reject invalid cookies and allow the valid single-admin cookie", () => {
  const password = "admin-only";
  const invalid = authorizePaidRequest(new Request("https://example.test/api/paid", {
    headers: { cookie: "site_gate=invalid" },
  }), { nodeEnv: "production", sitePassword: password });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.status, 401);

  const valid = authorizePaidRequest(new Request("https://example.test/api/paid", {
    headers: { cookie: `site_gate=${createSiteGateToken(password)}` },
  }), { nodeEnv: "production", sitePassword: password });
  assert.deepEqual(valid, { ok: true });
});

test("local development may run paid endpoints without a configured password", () => {
  assert.deepEqual(authorizePaidRequest(new Request("http://localhost/api/paid"), {
    nodeEnv: "development",
    sitePassword: undefined,
  }), { ok: true });
});

test("paid route wrapper rejects before invoking object lookup or paid scheduling", async () => {
  let handlerCalls = 0;
  const route = protectPaidRoute(async (_request, context: { params: Promise<{ id: string }> }, execution) => {
    handlerCalls += 1;
    return Response.json({ id: (await context.params).id, startedAt: execution.invocationStartedAt });
  }, {
    authorizationEnvironment: { nodeEnv: "production", sitePassword: "admin-only" },
    now: () => 1234,
  });

  const unauthorized = await route(new Request("https://example.test/api/paid"), {
    params: Promise.resolve({ id: "must-not-query" }),
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(handlerCalls, 0);

  const authorized = await route(new Request("https://example.test/api/paid", {
    headers: { cookie: `site_gate=${createSiteGateToken("admin-only")}` },
  }), { params: Promise.resolve({ id: "safe" }) });
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), { id: "safe", startedAt: 1234 });
  assert.equal(handlerCalls, 1);
});

test("paid route wrapper fails closed before its handler when production is misconfigured", async () => {
  let handlerCalls = 0;
  const route = protectPaidRoute(async () => {
    handlerCalls += 1;
    return new Response(null, { status: 204 });
  }, { authorizationEnvironment: { nodeEnv: "production", sitePassword: undefined } });

  const response = await route(new Request("https://example.test/api/paid"), undefined);
  assert.equal(response.status, 503);
  assert.equal(handlerCalls, 0);
});

// ---------- 沒設密碼的正式站：改用每日上限 ----------
const prodNoPassword = { nodeEnv: "production", sitePassword: undefined };
const ok = () => Promise.resolve(Response.json({ ok: true }));

test("正式站沒設密碼、有每日上限：額度內照常執行", async () => {
  let ran = false;
  const route = protectPaidRoute(async () => { ran = true; return ok(); }, {
    authorizationEnvironment: prodNoPassword,
    quota: async () => ({ ok: true, release: async () => {} }),
  });
  const res = await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
  assert.equal(res.status, 200);
  assert.equal(ran, true);
});

test("正式站沒設密碼、超過每日上限：回 429 和看得懂的原因，不執行", async () => {
  let ran = false;
  const route = protectPaidRoute(async () => { ran = true; return ok(); }, {
    authorizationEnvironment: prodNoPassword,
    quota: async () => ({ ok: false, error: "今天「照參考圖重做」已經用了 50 次（每日上限），明天再試。" }),
  });
  const res = await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /每日上限/);
  assert.equal(ran, false);
});

test("沒給每日上限的付費端點，正式站沒設密碼時照舊拒絕（預設安全）", async () => {
  const route = protectPaidRoute(ok, { authorizationEnvironment: prodNoPassword });
  const res = await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
  assert.equal(res.status, 503);
});

test("有設密碼但沒登入：每日上限也不能拿來繞過密碼", async () => {
  let asked = false;
  const route = protectPaidRoute(ok, {
    authorizationEnvironment: { nodeEnv: "production", sitePassword: "secret" },
    quota: async () => { asked = true; return { ok: true, release: async () => {} }; },
  });
  const res = await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
  assert.equal(res.status, 401);
  assert.equal(asked, false);
});

test("請求本身有問題（4xx）把額度還回去；伺服器錯誤照樣算一次", async () => {
  for (const [status, shouldRelease] of [[400, true], [404, true], [500, false], [200, false]] as const) {
    let released = false;
    const route = protectPaidRoute(async () => Response.json({}, { status }), {
      authorizationEnvironment: prodNoPassword,
      quota: async () => ({ ok: true, release: async () => { released = true; } }),
    });
    await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
    assert.equal(released, shouldRelease, `status ${status}`);
  }
});

test("查不到今天的用量（資料庫出錯）時擋下，不放行", async () => {
  const route = protectPaidRoute(ok, {
    authorizationEnvironment: prodNoPassword,
    quota: async () => { throw new Error("db down"); },
  });
  const res = await route(new Request("https://example.test/api/paid", { method: "POST" }), {});
  assert.equal(res.status, 503);
});
