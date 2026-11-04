import "server-only";
import { kakaoErrorNotice } from "../auth-flow.ts";
import { withVerificationDelivery, type SunnyAuth } from "./auth-core.ts";
import { validateEmail, validateNickname, validatePassword } from "../validate.ts";

const methods: Record<string, string> = {
  "sign-in/email": "POST", "sign-in/anonymous": "POST", "get-session": "GET", "sign-out": "POST",
  "sign-in/social": "POST", "callback/kakao": "GET",
  "sign-up/email": "POST", "request-password-reset": "POST", "reset-password": "POST",
};
const fields: Record<string, string[]> = {
  "sign-in/email": ["email", "password", "rememberMe"], "sign-in/anonymous": [], "sign-out": [],
  "sign-in/social": ["provider"],
  "sign-up/email": ["name", "email", "password"], "request-password-reset": ["email"], "reset-password": ["token", "newPassword"],
};
const headers = () => new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "Referrer-Policy": "no-referrer" });
export function authError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: headers() });
}
function displayUser(user: Record<string, unknown>) {
  return { id: user.id, nickname: user.name, isAnonymous: user.isAnonymous === true,
    ...(user.isAnonymous === true ? {} : { email: user.email }) };
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) return {};
  const reader = request.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 8192) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) return {};
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid JSON body");
  return data as Record<string, unknown>;
}

export async function handleAuth(request: Request, auth: SunnyAuth, config: { baseURL: string; emailReady: boolean; localMail?: boolean; kakaoReady?: boolean }) {
  const url = new URL(request.url); const origin = new URL(config.baseURL).origin;
  const path = url.pathname.replace(/^\/api\/auth\//, "");
  if (!Object.hasOwn(methods, path)) return authError(404, "AUTH_ENDPOINT_NOT_AVAILABLE", "지원하지 않는 인증 요청입니다.");
  if (methods[path] !== request.method) {
    const response = authError(405, "METHOD_NOT_ALLOWED", "허용되지 않은 요청 방식입니다.");
    response.headers.set("Allow", methods[path]);
    return response;
  }
  if (request.method === "POST" && request.headers.get("origin") !== origin) {
    return authError(403, "ORIGIN_NOT_ALLOWED", "허용되지 않은 요청 출처입니다.");
  }
  if (["request-password-reset", "reset-password"].includes(path) && url.search) return authError(400, "INVALID_AUTH_REQUEST", "요청 주소를 확인해 주세요.");
  if (path === "request-password-reset" && !config.emailReady) {
    return authError(503, "AUTH_EMAIL_UNAVAILABLE", "인증 메일 설정을 준비하고 있습니다.");
  }
  const redirect = (notice: string, cookies: string[] = []) => {
    const h = headers(); h.set("Location", `${origin}/login?auth=${notice}`);
    for (const cookie of cookies) h.append("Set-Cookie", cookie);
    return new Response(null, { status: 303, headers: h });
  };
  if (["sign-in/social", "callback/kakao"].includes(path) && !config.kakaoReady) {
    return path === "callback/kakao" ? redirect("kakao-failed") : authError(503, "KAKAO_UNAVAILABLE", "카카오 로그인을 준비하고 있습니다.");
  }
  let nativeRequest = request;
  let resetToken: string | undefined;
  if (request.method === "POST") {
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return authError(415, "INVALID_CONTENT_TYPE", "JSON으로 요청해 주세요.");
    }
    try {
      const body = await readBody(request);
      if (Object.keys(body).some((key) => !fields[path].includes(key))) throw new Error("Unexpected field");
      if (path === "sign-up/email" && (typeof body.name !== "string" || typeof body.email !== "string" || typeof body.password !== "string"
        || validateEmail(body.email) || validateNickname(body.name) || validatePassword(body.password))) {
        return authError(400, "INVALID_SIGNUP_INPUT", "이메일·별명·비밀번호 입력을 확인해 주세요.");
      }
      if (path === "sign-in/social") {
        if (body.provider !== "kakao") return authError(400, "INVALID_SOCIAL_PROVIDER", "지원하지 않는 로그인 방법입니다.");
        Object.assign(body, { callbackURL: `${origin}/account`, errorCallbackURL: `${origin}/login`, disableRedirect: true });
      }
      if (path === "request-password-reset") {
        if (typeof body.email !== "string" || validateEmail(body.email)) return authError(400, "INVALID_EMAIL", "이메일 입력을 확인해 주세요.");
        body.redirectTo = `${origin}/reset-password`;
      }
      if (path === "reset-password") {
        if (typeof body.token !== "string" || !/^[A-Za-z0-9]{24}$/.test(body.token)) return authError(400, "INVALID_TOKEN", "재설정 링크가 만료됐거나 올바르지 않습니다. 메일을 다시 받아 주세요.");
        if (typeof body.newPassword !== "string" || validatePassword(body.newPassword) || body.newPassword.length > 128) return authError(400, "INVALID_PASSWORD", "비밀번호는 8~128자이며 영문과 숫자를 함께 입력해 주세요.");
        resetToken = body.token;
      }
      if (typeof body.email === "string") body.email = body.email.trim();
      if (typeof body.name === "string") body.name = body.name.trim();
      nativeRequest = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) });
    } catch { return authError(400, "INVALID_AUTH_REQUEST", "인증 요청 형식을 확인해 주세요."); }
  }
  if (resetToken) {
    const context = await auth.$context;
    const verification = await context.internalAdapter.findVerificationValue(`reset-password:${resetToken}`);
    const credential = verification && await context.internalAdapter.findCredentialAccount(verification.value);
    if (!credential?.password) return authError(400, "INVALID_TOKEN", "재설정 링크가 만료됐거나 올바르지 않습니다. 메일을 다시 받아 주세요.");
  }
  if (path === "get-session") url.searchParams.set("disableCookieCache", "true");
  if (path === "get-session") nativeRequest = new Request(url, { headers: request.headers });
  if (path === "sign-in/anonymous") {
    const checked = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true }, returnHeaders: true });
    const existing = checked.response;
    if (existing) {
      const response = existing.user.isAnonymous
        ? Response.json({ user: displayUser(existing.user), session: { expiresAt: existing.session.expiresAt } }, { headers: headers() })
        : authError(409, "MEMBER_SESSION_EXISTS", "로그인된 회원 세션을 사용해 주세요.");
      for (const cookie of checked.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
      return response;
    }
  }
  const { response, deliveryFailed } = await withVerificationDelivery(() => auth.handler(nativeRequest));
  if (deliveryFailed) {
    if (path === "callback/kakao") return redirect("kakao-failed", response.headers.getSetCookie());
    return authError(503, "AUTH_EMAIL_UNAVAILABLE", "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const outHeaders = new Headers(response.headers); outHeaders.set("Cache-Control", "no-store");
  outHeaders.set("Referrer-Policy", "no-referrer");
  outHeaders.delete("Content-Length"); outHeaders.delete("Content-Encoding");
  if (path === "callback/kakao") {
    const location = response.headers.get("Location");
    if (!location) return redirect("kakao-failed", response.headers.getSetCookie());
    const target = new URL(location, origin);
    if (target.origin !== origin) return redirect("kakao-failed", response.headers.getSetCookie());
    if (target.pathname === "/login") return redirect(kakaoErrorNotice(target.searchParams.get("error")), response.headers.getSetCookie());
    if (target.pathname !== "/account" || ![302,303].includes(response.status)) return redirect("kakao-failed", response.headers.getSetCookie());
    outHeaders.set("Location", `${origin}/account`);
    return new Response(null, { status: response.status, headers: outHeaders });
  }
  // Only the callback above may issue an OAuth redirect.
  if (response.status >= 300 && response.status < 400) return new Response(null, { status: response.status, headers: outHeaders });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code;
    const limited = response.status === 429;
    const safeCode = limited ? "AUTH_RATE_LIMITED" : ["EMAIL_NOT_VERIFIED", "INVALID_EMAIL_OR_PASSWORD", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "INVALID_EMAIL", "INVALID_TOKEN", "TOKEN_EXPIRED"].includes(code) ? code : "AUTH_REQUEST_FAILED";
    const error = authError(response.status, safeCode, limited ? "요청이 많습니다. 잠시 후 다시 시도해 주세요." : code === "EMAIL_NOT_VERIFIED" ? "이메일 인증을 먼저 완료해 주세요." : "인증 요청을 완료하지 못했습니다.");
    for (const cookie of response.headers.getSetCookie()) error.headers.append("Set-Cookie", cookie);
    const retryAfter = response.headers.get("Retry-After") ?? response.headers.get("X-Retry-After");
    if (retryAfter && /^(?:0|[1-9][0-9]{0,5})$/.test(retryAfter)) error.headers.set("Retry-After", retryAfter);
    return error;
  }
  let result: unknown;
  if (path === "get-session") result = data ? { user: displayUser(data.user), session: { expiresAt: data.session.expiresAt } } : null;
  else if (path === "sign-in/social") {
    let target: URL;
    try { target = new URL(data?.url); } catch { return authError(503, "KAKAO_UNAVAILABLE", "카카오 로그인 주소를 확인하지 못했습니다."); }
    if (target.origin !== "https://kauth.kakao.com" || target.pathname !== "/oauth/authorize") return authError(503, "KAKAO_UNAVAILABLE", "카카오 로그인 주소를 확인하지 못했습니다.");
    result = { url: target.href };
  }
  else if (["sign-in/email", "sign-in/anonymous"].includes(path)) {
    const sessionHeaders = new Headers(request.headers);
    const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]).join("; ");
    sessionHeaders.set("cookie", cookies);
    const session = await auth.api.getSession({ headers: sessionHeaders, query: { disableCookieCache: true } });
    if (!session) return authError(503, "AUTH_SESSION_UNAVAILABLE", "세션을 확인하지 못했습니다.");
    result = { user: displayUser(session.user), session: { expiresAt: session.session.expiresAt } };
  } else if (path === "sign-up/email") result = { registered: true, message: "가입을 완료했습니다. 로그인해 주세요." };
  else if (path === "request-password-reset") result = { message: "비밀번호 재설정이 가능한 계정이면 안내 메일을 보냈습니다.",
    ...(config.localMail ? { resetDelivery: "local" } : {}) };
  else result = { success: true };
  return Response.json(result, { status: response.status, headers: outHeaders });
}
