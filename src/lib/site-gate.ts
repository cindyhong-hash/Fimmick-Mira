import { createHash, timingSafeEqual } from "node:crypto";

export const SITE_GATE_COOKIE_NAME = "site_gate";

export function createSiteGateToken(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  for (const part of (cookieHeader ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function verifySitePassword(candidate: string, password: string): boolean {
  return safeEqual(candidate, password);
}

export function verifySiteGateCookie(cookieHeader: string | null, password: string): boolean {
  const supplied = cookieValue(cookieHeader, SITE_GATE_COOKIE_NAME);
  return !!supplied && safeEqual(supplied, createSiteGateToken(password));
}

export type PaidRequestAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function authorizePaidRequest(
  request: Pick<Request, "headers">,
  environment: { nodeEnv?: string; sitePassword?: string } = {
    nodeEnv: process.env.NODE_ENV,
    sitePassword: process.env.SITE_PASSWORD,
  },
): PaidRequestAuthorization {
  const password = environment.sitePassword;
  if (!password) {
    return environment.nodeEnv === "production"
      ? { ok: false, status: 503, error: "付費功能尚未完成安全設定。" }
      : { ok: true };
  }
  return verifySiteGateCookie(request.headers.get("cookie"), password)
    ? { ok: true }
    : { ok: false, status: 401, error: "請先輸入網站管理密碼。" };
}

export type PaidRouteExecution = { invocationStartedAt: number };

/**
 * 每日用量上限的檢查結果。ok 時會先佔掉一次額度；release 用來把這次還回去
 * （請求本身有問題、根本沒花到錢時）。
 */
export type PaidQuotaResult =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; error: string };

export function protectPaidRoute<Context>(
  handler: (request: Request, context: Context, execution: PaidRouteExecution) => Promise<Response>,
  dependencies: {
    authorizationEnvironment?: { nodeEnv?: string; sitePassword?: string };
    now?: () => number;
    /**
     * 正式站沒設網站密碼時的替代把關：每日用量上限。
     * 沒給就維持原本的行為（直接拒絕），所以新加的付費端點預設是安全的。
     */
    quota?: () => Promise<PaidQuotaResult>;
  } = {},
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    const invocationStartedAt = (dependencies.now ?? Date.now)();
    const authorization = dependencies.authorizationEnvironment
      ? authorizePaidRequest(request, dependencies.authorizationEnvironment)
      : authorizePaidRequest(request);
    if (authorization.ok) return handler(request, context, { invocationStartedAt });

    // 有設密碼但沒登入（401）一律擋；只有「正式站沒設密碼」（503）才改用每日上限
    if (authorization.status !== 503 || !dependencies.quota) {
      return Response.json({ error: authorization.error }, { status: authorization.status });
    }
    let quota: PaidQuotaResult;
    try { quota = await dependencies.quota(); }
    catch { return Response.json({ error: "暫時無法確認今天的使用次數，請稍後再試。" }, { status: 503 }); }
    if (!quota.ok) return Response.json({ error: quota.error }, { status: 429 });

    const response = await handler(request, context, { invocationStartedAt });
    // 請求本身有問題（格式錯、找不到資料）時還沒花到錢，把額度還回去；
    // 伺服器錯誤可能已經打過 AI 服務了，照樣算一次，不然反覆失敗就能繞過上限。
    if (response.status >= 400 && response.status < 500) await quota.release().catch(() => {});
    return response;
  };
}
