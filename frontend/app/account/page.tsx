import type { Metadata } from "next";
import { AccountView } from "../../components/auth/AccountView.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "SUNNY — 마이페이지" };

export default function AccountPage() {
  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <AccountView />
      </main>
      <Footer />
    </>
  );
}
