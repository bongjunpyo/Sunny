import type { Metadata } from "next";
import { LoginForm } from "../../components/auth/LoginForm.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "../../components/auth/auth.module.css";

export const metadata: Metadata = { title: "SUNNY — 로그인" };

export default function LoginPage() {
  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <p className={styles.warn}>
          화면 시안입니다. 서버에 연결되어 있지 않으니 <b>실제 개인정보를 입력하지 마세요.</b>{" "}
          입력한 값은 이 브라우저에만 남고 서버로 가지 않습니다.
        </p>
        <span className={styles.eyebrow}>WELCOME BACK</span>
        <h1 className={styles.title}>다시 만나 반가워요.</h1>
        <LoginForm />
      </main>
      <Footer />
    </>
  );
}
