import Link from "next/link";
import { TextLink } from "./TextLink.tsx";
import { LegalLinks } from "../legal/LegalLinks.tsx";
import styles from "./Footer.module.css";

/** 마무리.
 *  `variant="brand"` — 메인의 마지막을 장식하는 큰 워드마크 (메인에서만)
 *  `variant="compact"` (기본) — 다른 페이지용. 워드마크를 작게 두고 높이를 줄인다 */
export function Footer({ variant = "compact" }: { variant?: "brand" | "compact" }) {
  const brand = variant === "brand";
  return (
    <footer className={brand ? styles.closing : `${styles.closing} ${styles.compact}`}>
      <div className={styles.top}>
        <span>태양에서 시작된 새로운 감각.</span>
        <TextLink href={brand ? "#collections" : "/collection"} mark="↑">
          컬렉션 다시 보기
        </TextLink>
      </div>
      <div className={styles.wordmark} aria-hidden="true">
        SUNNY
      </div>
      <nav className={styles.sitemap} aria-label="페이지 목록">
        <Link href="/collection">컬렉션</Link>
        <Link href="/custom">커스텀</Link>
        <Link href="/archive">제작 기록</Link>
        <Link href="/about">브랜드 소개</Link>
        <Link href="/login">로그인</Link>
      </nav>
      <div className={styles.bottom}>
        <span>SUNNY — BRAND DIRECTION PREVIEW / 01</span>
        <LegalLinks />
        <span>디자인 시안 · 카피 및 제품 형태 미확정 · 태양은 코드로 그린 연출</span>
        <Link href="#top">맨 위로 ↑</Link>
      </div>
    </footer>
  );
}
