import type { Metadata } from "next";
import { SignupForm } from "../../components/auth/SignupForm.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "../../components/auth/auth.module.css";

export const metadata: Metadata = { title: "SUNNY — 회원가입" };

export default function SignupPage() {
  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>JOIN THE LIGHT</span>
            <h1 className={styles.title}>빛을 기록할 준비.</h1>
            <p>
              이메일·비밀번호·별명으로 가입할 수 있습니다. 주문과 관심 상품, 제작 기록을 한자리에서 볼 수 있게
              준비하고 있습니다.
            </p>
            <p className={styles.warn}>가입 후 이메일 인증을 완료해야 로그인할 수 있습니다.</p>
          </div>
          <div className={styles.form}>
            <SignupForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
