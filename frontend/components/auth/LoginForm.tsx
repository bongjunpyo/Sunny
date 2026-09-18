"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "../../lib/auth.ts";
import { validateEmail, validatePassword } from "../../lib/validate.ts";
import { Field } from "./Field.tsx";
import styles from "./auth.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    setFormError(null);
    try {
      await signIn(email);
      router.push("/account");
    } catch {
      // 계정이 있는지 없는지 알려주지 않는다
      setFormError("이메일 또는 비밀번호를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <Field
        label="이메일"
        type="email"
        value={email}
        onChange={setEmail}
        error={errors.email}
        autoComplete="off"
        placeholder="demo@example.com"
      />
      <Field
        label="비밀번호"
        type="password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="off"
      />

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <button
        className={styles.ghost}
        type="button"
        onClick={() => setFormError("카카오 로그인은 아직 연결되지 않았습니다.")}
      >
        카카오로 계속하기 · 연결 전
      </button>

      <p className={styles.links}>
        <Link href="/signup">회원가입</Link>
        <span aria-hidden="true">·</span>
        <span>비밀번호 재설정 (서버 연결 후)</span>
      </p>
    </form>
  );
}
