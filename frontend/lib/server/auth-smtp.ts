import "server-only";
import nodemailer from "nodemailer";
import addressparser from "nodemailer/lib/addressparser";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const;
export const smtpRequested = (env: NodeJS.ProcessEnv = process.env) => smtpKeys.some(key => Boolean(env[key]));

/** One mailbox only: never let a header value add recipients or new headers. */
function mailbox(value: string) {
  if (/[\r\n\0]/.test(value)) return null;
  const parsed = addressparser(value);
  const entry = parsed.length === 1 ? parsed[0] : undefined;
  if (!entry || !("address" in entry) || typeof entry.address !== "string"
    || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(entry.address)) return null;
  return { name: entry.name, address: entry.address };
}

/** Invalid/partial settings are unconfigured, so the handler refuses signup before DB writes. */
export function smtpConfig(env: NodeJS.ProcessEnv = process.env): SMTPTransport.Options | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const portText = env.SMTP_PORT?.trim() || "587";
  const port = Number(portText);
  if (!host || !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
    || !user || /[\r\n\0]/.test(user) || !pass?.trim() || /[\r\n\0]/.test(pass)
    || !/^\d+$/.test(portText) || port < 1 || port > 65535 || !mailbox(env.AUTH_EMAIL_FROM ?? "")) return null;
  return {
    host, port, secure: port === 465, requireTLS: true,
    auth: { user, pass }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  };
}

export async function sendSmtpVerificationEmail(message: { email: string; url: string; purpose?: "verification" | "reset" }) {
  const options = smtpConfig();
  const from = mailbox(process.env.AUTH_EMAIL_FROM ?? "");
  const to = mailbox(message.email);
  if (!options || !from || !to || to.address !== message.email) throw new Error("Verification email is not configured");
  const transport = nodemailer.createTransport(options);
  try {
    const escape = (value: string) => value.replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]!);
    const reset = message.purpose === "reset";
    const title = reset ? "Sunny 비밀번호 재설정" : "Sunny 이메일 인증";
    const instruction = reset ? "아래 링크에서 비밀번호를 재설정해 주세요. 링크는 1시간 유효하며 한 번만 사용할 수 있습니다." : "아래 링크에서 이메일 인증을 완료해 주세요. 링크는 24시간 유효합니다.";
    const label = reset ? "새 비밀번호 설정하기" : "이메일 인증 완료하기";
    const result = await transport.sendMail({
      from, to, subject: title,
      text: `${instruction}\n${message.url}\n\n본인이 요청하지 않았다면 이 메일을 무시해 주세요.`,
      html: `<!doctype html><html lang="ko"><meta charset="utf-8"><body><h1>${title}</h1><p>${instruction}</p><p><a href="${escape(message.url)}">${label}</a></p><p>완료 후 로그인해 주세요.</p><p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p></body></html>`,
    });
    if (!result.accepted.includes(to.address) || result.rejected.length) throw new Error("Recipient rejected");
  } catch {
    // SMTP errors can include credentials, recipients and server replies. Never propagate them.
    throw new Error("Verification email delivery failed");
  } finally { transport.close(); }
}
