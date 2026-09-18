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
        <div className={styles.layout}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>WELCOME BACK</span>
            <h1 className={styles.title}>다시 만나 반가워요.</h1>
            <p>
              기록해 둔 관심 상품과 주문을 이어서 볼 수 있습니다. 빛에 따라 달라지는 색처럼, 기록도
              시간에 따라 쌓입니다.
            </p>
            <p className={styles.warn}>
              화면 시안입니다. 서버에 연결되어 있지 않으니 <b>실제 개인정보를 입력하지 마세요.</b>{" "}
              입력한 값은 이 브라우저에만 남고 서버로 가지 않습니다.
            </p>
          </div>
          <div className={styles.form}>
            <LoginForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
