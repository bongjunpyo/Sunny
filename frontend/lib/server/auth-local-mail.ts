import "server-only";
import { mkdir, chmod, lstat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** Explicit opt-in; a production build or remote origin can never capture verification mail. */
export function localVerificationMailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "development" || env.AUTH_DEV_LOCAL_MAIL !== "true") return false;
  try {
    const url = new URL(env.BETTER_AUTH_URL ?? "");
    return ["http:", "https:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

/** Private filesystem mailbox; no HTTP mailbox, token response, or token logging. */
export async function saveLocalVerificationMail(message: { email: string; url: string }) {
  if (!localVerificationMailEnabled()) throw new Error("Local verification delivery is disabled");
  const url = new URL(message.url);
  if (url.origin !== new URL(process.env.BETTER_AUTH_URL!).origin || url.pathname !== "/api/auth/verify-email") {
    throw new Error("Invalid local verification URL");
  }
  const directory = join(process.cwd(), ".sunny-auth-mail");
  await mkdir(directory, { mode: 0o700, recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Invalid local mailbox");
  await chmod(directory, 0o700);
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer">
<title>Sunny 개발용 인증 메일</title><body style="font:18px/1.8 sans-serif;max-width:650px;margin:64px auto;padding:24px">
<h1>개발용 이메일 인증</h1><p>받는 사람: ${escape(message.email)}</p>
<p>이 파일은 이 컴퓨터에만 저장한 개발용 메일입니다. 실제 이메일은 발송하지 않았습니다.</p>
<p><a href="${escape(url.href)}" rel="noreferrer">이메일 인증 완료하기</a></p>
<p>링크는 24시간 유효합니다. 인증 후 로그인 화면에서 로그인해 주세요.</p>
<p>인증 링크가 포함되어 있으므로 이 파일을 공유하거나 Git에 올리지 마세요.</p></body></html>`;
  const filename = `${Date.now()}-${randomUUID()}`;
  await writeFile(join(directory, `${filename}.html`), html, { mode: 0o600, flag: "wx" });
  await writeFile(join(directory, `${filename}.txt`), `Sunny 개발용 인증 메일\n${message.email}\n\n아래 주소 한 줄을 그대로 주소창에 붙여넣으세요. HTML 소스를 복사하지 마세요.\n${url.href}\n`, { mode: 0o600, flag: "wx" });
}
