import Link from "next/link";
import { TextLink } from "./TextLink.tsx";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.closing}>
      <div className={styles.top}>
        <span>태양에서 시작된 새로운 감각.</span>
        <TextLink href="#collections" mark="↑">
          컬렉션 다시 보기
        </TextLink>
      </div>
      <div className={styles.wordmark} aria-hidden="true">
        SUNNY
      </div>
      <div className={styles.bottom}>
        <span>SUNNY — BRAND DIRECTION PREVIEW / 01</span>
        <span>디자인 시안 · 카피 및 제품 형태 미확정 · 태양은 코드로 그린 연출</span>
        <Link href="#top">맨 위로 ↑</Link>
      </div>
    </footer>
  );
}
