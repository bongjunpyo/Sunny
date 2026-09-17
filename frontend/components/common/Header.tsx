import Link from "next/link";
import styles from "./Header.module.css";

/** 히어로 위에 겹쳐 놓는 머리말. 배경이 어두운 구간 기준 색이다. */
export function Header() {
  return (
    <header className={styles.header}>
      <Link className={styles.logo} href="#top" aria-label="SUNNY 처음으로">
        SUNNY
      </Link>
      <nav className={styles.nav} aria-label="주 메뉴">
        <Link href="#collections">Collections</Link>
        <Link href="#story">Our Story</Link>
        <Link href="#journal">Solar Journal</Link>
      </nav>
      <span className={styles.edition}>BRAND STUDY — 01</span>
    </header>
  );
}
