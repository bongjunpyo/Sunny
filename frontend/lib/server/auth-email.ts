import "server-only";
import type { VerificationMailer } from "./auth-core.ts";
import { localVerificationMailEnabled, saveLocalVerificationMail } from "./auth-local-mail.ts";

export function verificationEmailConfigured() {
  return localVerificationMailEnabled() || Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}
export const sendVerificationEmail: VerificationMailer = async ({ email, url }) => {
  if (!verificationEmailConfigured()) throw new Error("Verification email is not configured");
  const verificationURL = new URL(url);
  verificationURL.searchParams.set("callbackURL", "/login");
  if (localVerificationMailEnabled()) return saveLocalVerificationMail({ email, url: verificationURL.href });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [email],
      subject: "Sunny 이메일 인증", text: `아래 링크에서 이메일 인증을 완료해 주세요. 링크는 24시간 유효합니다.\n${verificationURL.href}` }),
  });
  if (!response.ok) throw new Error("Verification email delivery failed");
};
