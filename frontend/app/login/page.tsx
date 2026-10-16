import { authNotice } from "../../lib/auth-flow.ts";
import { kakaoOptions } from "../../lib/server/auth-kakao.ts";
import type { Metadata } from "next";
import { LoginForm } from "../../components/auth/LoginForm.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "../../components/auth/auth.module.css";

export const metadata: Metadata = { title: "SUNNY — 로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ auth?: string | string[] }> }) {
  const query = await searchParams;
  const status = typeof query.auth === "string" ? query.auth : undefined;
  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>WELCOME BACK</span>
            <h1 className={styles.title}>다시 만나 반가워요.</h1>
            <p>
              인증한 이메일과 비밀번호로 로그인해 주세요. 빛에 따라 달라지는 색처럼, 기록도
              시간에 따라 쌓입니다.
            </p>
            <p className={styles.warn}>가입한 이메일의 인증을 먼저 완료해 주세요.</p>
          </div>
          <div className={styles.form}>
            <LoginForm initialNotice={authNotice(status)} authStatus={status} kakaoReady={Boolean(kakaoOptions())} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
