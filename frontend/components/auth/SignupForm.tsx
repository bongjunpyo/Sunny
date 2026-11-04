"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp, resendVerification, authErrorMessage } from "../../lib/auth.ts";
import {
  validateEmail,
  validateNickname,
  validatePassword,
  validateRequiredTerms,
} from "../../lib/validate.ts";
import { Field } from "./Field.tsx";
import { TermsDialog, useTermsDialog } from "../legal/TermsDialog.tsx";
import styles from "./auth.module.css";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [requiredTerms, setRequiredTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [localMail, setLocalMail] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const legal = useTermsDialog();

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
    setFormError(null);
    try {
      const result = await signUp(email, nickname, password);
      setPassword("");
      setPending(true);
      setLocalMail(result.verificationDelivery === "local");
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (pending) return (
    <div>
      <h2>이메일 인증을 완료해 주세요.</h2>
      <p role="status">가입 요청을 접수했습니다. 인증 링크를 연 뒤 로그인해 주세요.</p>
      {localMail ? <p>개발용 인증 메일은 이 컴퓨터의 비공개 메일 파일에 저장했습니다. 실제 이메일은 발송하지 않습니다.</p> : <p>메일함을 확인해 주세요.</p>}
      {formError ? <p className={styles.formError} role="alert">{formError}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <button className={styles.ghost} type="button" disabled={busy} onClick={async () => {
        setBusy(true); setFormError(null); setNotice("");
        try { await resendVerification(email); setNotice("인증이 필요한 경우 인증 메일을 다시 준비했습니다."); }
        catch (error) { setFormError(authErrorMessage(error)); }
        finally { setBusy(false); }
      }}>인증 메일 다시 받기</button>
      <p className={styles.links}><Link href="/login">인증 후 로그인</Link></p>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {formError ? <p className={styles.formError} role="alert">{formError}</p> : null}
      <Field
        label="이메일"
        type="email"
        value={email}
        onChange={setEmail}
        error={errors.email}
        autoComplete="email"
        placeholder="member@example.com"
      />
      <Field
        label="비밀번호 · 8자 이상, 영문과 숫자"
        type="password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="new-password"
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
          <span>
            [필수]{" "}
            <button type="button" className={styles.legalLink} onClick={() => legal.open("terms")}>
              이용약관
            </button>{" "}
            ·{" "}
            <button
              type="button"
              className={styles.legalLink}
              onClick={() => legal.open("privacy")}
            >
              개인정보 처리방침
            </button>
            에 동의합니다
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={false}
            disabled
          />
          <span>[선택] 새 컬렉션 소식 받기 · 준비 중</span>
        </label>
        {errors.terms ? (
          <span className={styles.error} role="alert">
            {errors.terms}
          </span>
        ) : null}
        <p className={styles.eyebrow} style={{ marginTop: "var(--step-1)" }}>
          약관 이름을 누르면 전문을 볼 수 있습니다. 지금 문서는 검토 전 초안입니다.
        </p>
      </div>

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "만드는 중…" : "가입하기"}
      </button>

      <p className={styles.links}>
        <span>이미 계정이 있나요?</span>
        <Link href="/login">로그인</Link>
      </p>

      <TermsDialog docId={legal.openDoc} onClose={legal.close} onSwitch={legal.open} />
    </form>
  );
}
