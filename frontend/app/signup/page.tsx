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
              이메일과 별명만 있으면 됩니다. 주문과 관심 상품, 제작 기록을 한자리에서 볼 수 있게
              준비하고 있습니다.
            </p>
            <p className={styles.warn}>
              화면 시안입니다. 서버에 연결되어 있지 않으니 <b>실제 개인정보를 입력하지 마세요.</b>{" "}
              계정은 만들어지지 않습니다.
            </p>
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
