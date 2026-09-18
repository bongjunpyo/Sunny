"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "../../lib/auth.ts";
import {
  validateEmail,
  validateNickname,
  validatePassword,
  validateRequiredTerms,
} from "../../lib/validate.ts";
import { Field } from "./Field.tsx";
import styles from "./auth.module.css";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [requiredTerms, setRequiredTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
      nickname: validateNickname(nickname),
      terms: validateRequiredTerms(requiredTerms),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      await signUp(email, nickname);
      router.push("/account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
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
        label="비밀번호 · 8자 이상, 영문과 숫자"
        type="password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="off"
      />
      <Field
        label="별명 · 2~12자"
        value={nickname}
        onChange={setNickname}
        error={errors.nickname}
        autoComplete="off"
        placeholder="예시 별명"
      />

      <div className={styles.terms}>
        <label>
          <input
            type="checkbox"
            checked={requiredTerms}
            onChange={(event) => setRequiredTerms(event.target.checked)}
          />
          <span>[필수] 이용약관 · 개인정보 처리방침에 동의합니다</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
          />
          <span>[선택] 새 컬렉션 소식을 받아볼래요</span>
        </label>
        {errors.terms ? (
          <span className={styles.error} role="alert">
            {errors.terms}
          </span>
        ) : null}
        <p className={styles.eyebrow} style={{ marginTop: "var(--step-1)" }}>
          약관 본문과 버전은 서버 연결 후 표시합니다.
        </p>
      </div>

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "만드는 중…" : "가입하기"}
      </button>

      <p className={styles.links}>
        <span>이미 계정이 있나요?</span>
        <Link href="/login">로그인</Link>
      </p>
    </form>
  );
}
