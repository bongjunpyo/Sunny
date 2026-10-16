"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signInWithKakao, resendVerification, AuthError, authErrorMessage } from "../../lib/auth.ts";
import { validateEmail, validatePassword } from "../../lib/validate.ts";
import { Field } from "./Field.tsx";
import styles from "./auth.module.css";

export function LoginForm({ initialNotice = null, authStatus, kakaoReady = false }: { initialNotice?: string | null; authStatus?: string; kakaoReady?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(authStatus?.startsWith("verification-") || authStatus === "kakao-email-unverified");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    setFormError(null);
    setVerificationRequired(false);
    setNotice("");
    try {
      await signIn(email, password);
      setPassword("");
      router.push("/account");
      router.refresh();
    } catch (error) {
      setVerificationRequired(error instanceof AuthError && error.code === "EMAIL_NOT_VERIFIED");
      setFormError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {initialNotice ? <p role="status">{initialNotice}</p> : null}
      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      {notice ? <p role="status">{notice}</p> : null}
      {verificationRequired ? <button className={styles.ghost} type="button" disabled={busy} onClick={async () => {
        const error = validateEmail(email);
        if (error) { setErrors({ email: error }); return; }
        setBusy(true); setFormError(null);
        try { await resendVerification(email); setNotice("인증이 필요한 경우 인증 메일을 다시 준비했습니다."); }
        catch (error) { setFormError(authErrorMessage(error)); }
        finally { setBusy(false); }
      }}>인증 메일 다시 받기</button> : null}
      <Field
        label="이메일"
        type="email"
        value={email}
        onChange={setEmail}
        error={errors.email}
        autoComplete="email"
        placeholder="demo@example.com"
      />
      <Field
        label="비밀번호"
        type="password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="current-password"
      />

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <button
        className={styles.ghost}
        type="button"
        disabled={busy || !kakaoReady}
        onClick={async () => {
          setBusy(true); setFormError(null);
          try { window.location.assign(await signInWithKakao()); }
          catch (error) { setFormError(authErrorMessage(error)); setBusy(false); }
        }}
      >
        {kakaoReady ? "카카오로 계속하기" : "카카오 로그인 · 준비 중"}
      </button>

      <p className={styles.links}>
        <Link href="/signup">회원가입</Link>
        <span aria-hidden="true">·</span>
        <span>비밀번호 재설정 (서버 연결 후)</span>
      </p>
    </form>
  );
}
