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
        <p className={styles.warn}>
          화면 시안입니다. 서버에 연결되어 있지 않으니 <b>실제 개인정보를 입력하지 마세요.</b>{" "}
          계정은 만들어지지 않습니다.
        </p>
        <span className={styles.eyebrow}>JOIN THE LIGHT</span>
        <h1 className={styles.title}>빛을 기록할 준비.</h1>
        <SignupForm />
      </main>
      <Footer />
    </>
  );
}
