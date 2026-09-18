import Link from "next/link";
import styles from "./Header.module.css";

/** 머리말.
 *  `dark`(기본)이면 히어로 위에 겹쳐 놓는 어두운 배경용,
 *  `dark={false}`면 종이색 페이지의 맨 위에 놓는 밝은 배경용이다. */
export function Header({ dark = true }: { dark?: boolean }) {
  return (
    <header className={dark ? styles.header : `${styles.header} ${styles.light}`}>
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
