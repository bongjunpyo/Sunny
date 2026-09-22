import Link from "next/link";
import { AccountNav } from "../auth/AccountNav.tsx";
import styles from "./Header.module.css";

/** 머리말.
 *  `dark`(기본)이면 히어로 위에 겹쳐 놓는 어두운 배경용,
 *  `dark={false}`면 종이색 페이지의 맨 위에 놓는 밝은 배경용이다. */
export function Header({ dark = true }: { dark?: boolean }) {
  return (
    <header className={dark ? styles.header : `${styles.header} ${styles.light}`}>
      {/* 어느 페이지에서든 메인으로 */}
      <Link className={styles.logo} href="/" aria-label="SUNNY 메인으로">
        SUNNY
      </Link>
      <nav className={styles.nav} aria-label="주 메뉴">
        <Link href="/collection">Collections</Link>
        <Link className={styles.narrowHide} href="/custom">
          Custom
        </Link>
        {/* 좁은 화면에서는 아래 둘을 접는다 — 푸터에서 갈 수 있다 */}
        <Link className={styles.wide} href="/about">
          Our Story
        </Link>
        <Link className={styles.wide} href="/archive">
          Archive
        </Link>
      </nav>
      <nav className={styles.nav} aria-label="회원 메뉴">
        <AccountNav />
      </nav>
    </header>
  );
}
