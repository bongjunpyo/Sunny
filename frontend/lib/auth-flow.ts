/** Pure boundary helpers: never log verification links or decode repeatedly. */
export function verificationURL(input: URL): URL | null {
  if (input.href.length > 8192) return null;
  const target = new URL(input);
  // Some HTML preview/copy paths encode the query delimiters, not just values.
  if (!target.searchParams.has("token") && /^\?token%3d/i.test(target.search)) {
    const entries = [...target.searchParams.entries()];
    if (entries.length !== 1 || entries[0][1] !== "") return null;
    // Next serializes a key-only query with a trailing '='. Use the decoded key,
    // so that framework-added empty assignment never becomes part of callbackURL.
    target.search = entries[0][0].replaceAll("&amp;", "&");
  }
  const params = target.searchParams;
  if (params.has("amp;callbackURL")) {
    if (params.has("callbackURL") || params.getAll("amp;callbackURL").length !== 1) return null;
    params.set("callbackURL", params.get("amp;callbackURL")!); params.delete("amp;callbackURL");
  }
  if ([...params.keys()].some(key => !["token", "callbackURL"].includes(key))) return null;
  const token = params.get("token");
  if (params.getAll("token").length !== 1 || !token || token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  if (params.getAll("callbackURL").length > 1) return null;
  const callback = params.get("callbackURL");
  if (callback !== null && !["/", "/login", "/signup", "/account"].includes(callback)) return null;
  target.hash = "";
  return target;
}

export const authNotices: Record<string, string> = {
  "email-verified": "이메일 인증을 완료했습니다. 가입한 방법으로 로그인해 주세요.",
  "verification-invalid": "인증 링크가 올바르지 않습니다. 인증 메일을 다시 받아 주세요.",
  "verification-expired": "인증 링크가 만료됐습니다. 인증 메일을 다시 받아 주세요.",
  "kakao-cancelled": "카카오 로그인을 취소했습니다. 다시 시도할 수 있습니다.",
  "kakao-email-required": "카카오 이메일 제공에 동의해야 가입할 수 있습니다. 이메일을 받을 수 없으면 이메일 회원가입을 이용해 주세요.",
  "kakao-email-unverified": "이메일 인증을 완료한 뒤 카카오로 다시 로그인해 주세요.",
  "kakao-account-exists": "같은 이메일의 계정이 있습니다. 기존에 가입한 방법으로 로그인해 주세요. 계정은 자동 연결하지 않습니다.",
  "kakao-failed": "카카오 로그인을 완료하지 못했습니다. 처음부터 다시 시도해 주세요.",
};
export function authNotice(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(authNotices, code) ? authNotices[code] : null;
}
export function kakaoErrorNotice(code: string | null): string {
  if (code === "access_denied") return "kakao-cancelled";
  if (code === "email_not_found") return "kakao-email-required";
  if (code === "email_not_verified") return "kakao-email-unverified";
  if (["account_not_linked", "unable_to_link_account", "account_already_linked_to_different_user"].includes(code ?? "")) return "kakao-account-exists";
  return "kakao-failed";
}
