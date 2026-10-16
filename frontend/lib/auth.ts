"use client";

import type { Member } from "./types.ts";

export const AUTH_CHANGED_EVENT = "sunny:auth-changed";
export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function authErrorMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : "연결을 확인하고 다시 시도해 주세요.";
}
const messages: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "이메일 인증을 먼저 완료해 주세요.",
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호를 확인해 주세요.",
  INVALID_SIGNUP_INPUT: "이메일·별명·비밀번호 입력을 확인해 주세요.",
  AUTH_EMAIL_UNAVAILABLE: "인증 메일을 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_SERVICE_UNAVAILABLE: "인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  ORIGIN_NOT_ALLOWED: "현재 사이트 주소에서는 인증할 수 없습니다. 안내받은 주소로 접속해 주세요.",
};
async function request(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.error?.code === "string" ? data.error.code : "AUTH_REQUEST_FAILED";
    throw new AuthError(code, response.status === 429 ? "요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요."
      : messages[code] ?? "요청을 완료하지 못했습니다. 입력을 확인하거나 잠시 후 다시 시도해 주세요.");
  }
  return data;
}
function member(data: unknown): Member | null {
  const user = (data as { user?: { isAnonymous?: boolean; email?: unknown; nickname?: unknown } } | null)?.user;
  if (!user || user.isAnonymous === true) return null;
  if (user.isAnonymous !== false || typeof user.email !== "string" || typeof user.nickname !== "string") {
    throw new AuthError("INVALID_AUTH_RESPONSE", "회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return { email: user.email, nickname: user.nickname };
}
function changed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
/** 인증은 상품/CMS mock 모드와 무관하게 서버 DB 세션만 사용한다. */
export async function getMember(): Promise<Member | null> {
  return member(await request("get-session"));
}
export async function signIn(email: string, password: string): Promise<Member> {
  const result = member(await request("sign-in/email", { email: email.trim(), password }));
  if (!result) throw new AuthError("INVALID_AUTH_RESPONSE", "회원 정보를 확인하지 못했습니다.");
  changed(); return result;
}
export async function signUp(email: string, nickname: string, password: string): Promise<{ verificationPending: true; verificationDelivery?: "local" }> {
  const result = await request("sign-up/email", { email: email.trim(), name: nickname.trim(), password });
  if (result?.verificationPending !== true) throw new AuthError("INVALID_AUTH_RESPONSE", "가입 결과를 확인하지 못했습니다.");
  return { verificationPending: true, ...(result.verificationDelivery === "local" ? { verificationDelivery: "local" as const } : {}) };
}
export async function resendVerification(email: string): Promise<void> {
  await request("send-verification-email", { email: email.trim() });
}
export async function signOut(): Promise<void> {
  await request("sign-out", {}); changed();
}
