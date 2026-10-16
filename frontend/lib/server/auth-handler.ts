import "server-only";
import type { SunnyAuth } from "./auth-core.ts";
import { validateEmail, validateNickname, validatePassword } from "../validate.ts";

const methods: Record<string, string> = {
  "sign-in/email": "POST", "sign-in/anonymous": "POST", "get-session": "GET", "sign-out": "POST",
  "sign-up/email": "POST", "send-verification-email": "POST", "verify-email": "GET",
};
const fields: Record<string, string[]> = {
  "sign-in/email": ["email", "password", "rememberMe"], "sign-in/anonymous": [], "sign-out": [],
  "sign-up/email": ["name", "email", "password"], "send-verification-email": ["email"],
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

export async function handleAuth(request: Request, auth: SunnyAuth, config: { baseURL: string; emailReady: boolean }) {
  const url = new URL(request.url); const origin = new URL(config.baseURL).origin;
  const path = url.pathname.replace(/^\/api\/auth\//, "");
  if (!methods[path]) return authError(404, "AUTH_ENDPOINT_NOT_AVAILABLE", "지원하지 않는 인증 요청입니다.");
  if (methods[path] !== request.method) return authError(405, "METHOD_NOT_ALLOWED", "허용되지 않은 요청 방식입니다.");
  if (request.method === "POST" && request.headers.get("origin") !== origin) {
    return authError(403, "ORIGIN_NOT_ALLOWED", "허용되지 않은 요청 출처입니다.");
  }
  if (["sign-up/email", "send-verification-email"].includes(path) && !config.emailReady) {
    return authError(503, "AUTH_EMAIL_UNAVAILABLE", "인증 메일 설정을 준비하고 있습니다.");
  }
  let nativeRequest = request;
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
      if (typeof body.email === "string") body.email = body.email.trim();
      if (typeof body.name === "string") body.name = body.name.trim();
      nativeRequest = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) });
    } catch { return authError(400, "INVALID_AUTH_REQUEST", "인증 요청 형식을 확인해 주세요."); }
  }
  if (path === "verify-email") {
    const callback = url.searchParams.get("callbackURL");
    if (callback && !["/", "/login", "/signup", "/account"].includes(callback)) {
      return authError(400, "INVALID_CALLBACK", "허용되지 않은 이동 경로입니다.");
    }
  }
  if (path === "get-session") url.searchParams.set("disableCookieCache", "true");
  if (path === "get-session") nativeRequest = new Request(url, { headers: request.headers });
  if (path === "sign-in/anonymous") {
    const existing = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    if (existing) {
      if (!existing.user.isAnonymous) return authError(409, "MEMBER_SESSION_EXISTS", "로그인된 회원 세션을 사용해 주세요.");
      return Response.json({ user: displayUser(existing.user), session: { expiresAt: existing.session.expiresAt } }, { headers: headers() });
    }
  }
  const response = await auth.handler(nativeRequest);
  const outHeaders = new Headers(response.headers); outHeaders.set("Cache-Control", "no-store");
  outHeaders.set("Referrer-Policy", "no-referrer");
  outHeaders.delete("Content-Length"); outHeaders.delete("Content-Encoding");
  // Verification redirects carry native Location and Set-Cookie unchanged.
  if (response.status >= 300 && response.status < 400) return new Response(null, { status: response.status, headers: outHeaders });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code;
    const safeCode = ["EMAIL_NOT_VERIFIED", "INVALID_EMAIL_OR_PASSWORD", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "INVALID_EMAIL", "INVALID_TOKEN", "TOKEN_EXPIRED"].includes(code) ? code : "AUTH_REQUEST_FAILED";
    const error = authError(response.status, safeCode, code === "EMAIL_NOT_VERIFIED" ? "이메일 인증을 먼저 완료해 주세요." : "인증 요청을 완료하지 못했습니다.");
    for (const cookie of response.headers.getSetCookie()) error.headers.append("Set-Cookie", cookie);
    const retryAfter = response.headers.get("Retry-After"); if (retryAfter) error.headers.set("Retry-After", retryAfter);
    return error;
  }
  let result: unknown;
  if (path === "get-session") result = data ? { user: displayUser(data.user), session: { expiresAt: data.session.expiresAt } } : null;
  else if (["sign-in/email", "sign-in/anonymous"].includes(path)) {
    const sessionHeaders = new Headers(request.headers);
    const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]).join("; ");
    sessionHeaders.set("cookie", cookies);
    const session = await auth.api.getSession({ headers: sessionHeaders, query: { disableCookieCache: true } });
    if (!session) return authError(503, "AUTH_SESSION_UNAVAILABLE", "세션을 확인하지 못했습니다.");
    result = { user: displayUser(session.user), session: { expiresAt: session.session.expiresAt } };
  } else if (path === "sign-up/email") result = { verificationPending: true, message: "메일함에서 인증을 마쳐 주세요." };
  else if (path === "send-verification-email") result = { message: "인증이 필요한 경우 메일을 보냈습니다." };
  else result = { success: true };
  return Response.json(result, { status: response.status, headers: outHeaders });
}
