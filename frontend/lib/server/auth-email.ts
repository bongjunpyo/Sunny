import "server-only";
import type { VerificationMailer } from "./auth-core.ts";
import { localVerificationMailEnabled, saveLocalVerificationMail } from "./auth-local-mail.ts";
import { smtpConfig, smtpRequested, sendSmtpVerificationEmail } from "./auth-smtp.ts";

export function verificationEmailConfigured() {
  if (localVerificationMailEnabled()) return true;
  if (smtpRequested()) return smtpConfig() !== null;
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}
async function sendAuthEmail({ email, url }: { email: string; url: string }, purpose: "verification" | "reset") {
  if (!verificationEmailConfigured()) throw new Error("Verification email is not configured");
  const verificationURL = new URL(url);
  const validPath = purpose === "reset"
    ? verificationURL.pathname === "/reset-password" && !verificationURL.search && /^#token=[A-Za-z0-9]{24}$/.test(verificationURL.hash)
    : verificationURL.pathname === "/api/auth/verify-email" && Boolean(verificationURL.searchParams.get("token")) && !verificationURL.hash;
  if (verificationURL.origin !== new URL(process.env.BETTER_AUTH_URL ?? "").origin || !validPath
    || verificationURL.username || verificationURL.password) {
    throw new Error("Invalid verification URL");
  }
  if (localVerificationMailEnabled()) return saveLocalVerificationMail({ email, url: verificationURL.href, purpose });
  if (smtpRequested()) return sendSmtpVerificationEmail({ email, url: verificationURL.href, purpose });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [email],
      subject: purpose === "reset" ? "Sunny 비밀번호 재설정" : "Sunny 이메일 인증",
      text: purpose === "reset"
        ? `아래 링크에서 비밀번호를 재설정해 주세요. 링크는 1시간 유효하며 한 번만 사용할 수 있습니다. 직접 요청하지 않았다면 이 메일을 무시해 주세요.\n${verificationURL.href}`
        : `아래 링크에서 이메일 인증을 완료해 주세요. 링크는 24시간 유효합니다.\n${verificationURL.href}` }),
  });
  if (!response.ok) throw new Error("Verification email delivery failed");
}
// The old mail helper remains private to transport regression tests, not an exposed signup endpoint.
export const sendVerificationEmail: VerificationMailer = message => sendAuthEmail(message, "verification");
export const sendPasswordResetEmail: VerificationMailer = message => sendAuthEmail(message, "reset");
