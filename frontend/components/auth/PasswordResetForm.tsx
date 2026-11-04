"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword, authErrorMessage } from "../../lib/auth.ts";
import { validateEmail, validatePassword } from "../../lib/validate.ts";
import { Field } from "./Field.tsx";
import styles from "./auth.module.css";

export function PasswordResetForm({ mode }: { mode: "request" | "reset" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "reset") return;
    const fragment = window.location.hash;
    // StrictMode may run this effect again after the fragment has been removed.
    if (!fragment) { setToken(current => current ?? ""); return; }
    const params = new URLSearchParams(fragment.slice(1));
    const candidate = params.get("token") ?? "";
    setToken(params.size === 1 && /^[A-Za-z0-9]{24}$/.test(candidate) ? candidate : "");
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = mode === "request" ? validateEmail(email)
      : validatePassword(password)
        || (password.length > 128 ? "새 비밀번호는 128자 이하여야 합니다." : null)
        || (password !== confirmation ? "비밀번호 확인이 일치하지 않습니다." : null);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      if (mode === "request") await requestPasswordReset(email);
      else await resetPassword(token ?? "", password);
      setDone(true); setPassword(""); setConfirmation(""); setToken("");
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (done) return <div>
    <p role="status">{mode === "request"
      ? "비밀번호 재설정이 가능한 계정이면 안내 메일을 보냈습니다. 메일함을 확인해 주세요."
      : "비밀번호를 변경했습니다. 모든 기기에서 로그아웃되었습니다. 새 비밀번호로 로그인해 주세요."}</p>
    <p className={styles.links}><Link href="/login">로그인 화면으로</Link></p>
  </div>;
  if (mode === "reset" && !token) return <div>
    <p role="status">{token === null ? "재설정 링크를 확인하고 있습니다." : "재설정 링크가 올바르지 않습니다. 메일의 링크를 다시 열거나 새 메일을 받아 주세요."}</p>
    <Link href="/forgot-password">재설정 메일 다시 받기</Link>
  </div>;
  return <form onSubmit={submit} noValidate>
    {error ? <p role="alert" className={styles.formError}>{error}</p> : null}
    {mode === "request"
      ? <Field label="가입한 이메일" type="email" autoComplete="email" value={email} onChange={setEmail} />
      : <>
        <Field label="새 비밀번호" type="password" autoComplete="new-password" value={password} onChange={setPassword} />
        <Field label="새 비밀번호 확인" type="password" autoComplete="new-password" value={confirmation} onChange={setConfirmation} />
        <p>영문·숫자를 포함해 8~128자로 입력해 주세요.</p>
      </>}
    <button className={styles.submit} type="submit" disabled={busy}>{busy ? "처리 중…" : mode === "request" ? "재설정 메일 받기" : "비밀번호 변경"}</button>
    <p className={styles.links}><Link href="/login">로그인 화면으로</Link></p>
  </form>;
}
