"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMember, signOut } from "../../lib/auth.ts";
import type { Member } from "../../lib/types.ts";
import styles from "../../app/account/page.module.css";

/** 마이페이지 본문. 로그인 상태는 브라우저에서만 알 수 있어 클라이언트에서 읽는다. */
export function AccountView() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMember(getMember());
    setReady(true);
  }, []);

  if (!ready) return <p className={styles.notice}>불러오는 중…</p>;

  if (!member) {
    return (
      <div className={styles.empty}>
        <p>로그인이 필요한 화면입니다.</p>
        <Link href="/login">로그인하러 가기 ↗</Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.head}>
        <div>
          <span>MY SUNNY</span>
          <h1 className={styles.name}>{member.nickname} 님</h1>
          <p className={styles.email}>{member.email}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          로그아웃
        </button>
      </div>

      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="마이페이지 메뉴">
          <a href="#orders">주문 내역</a>
          <a href="#wishlist">관심 상품</a>
          <a href="#inquiries">문의</a>
          <a href="#profile">회원 정보</a>
        </nav>

        <div>
          <section className={styles.section} id="orders">
            <h2>주문 내역</h2>
            <div className={styles.empty}>
              아직 주문이 없습니다.
              <br />
              주문 기능은 서버 연결 후 열립니다. <Link href="/collection">컬렉션 둘러보기</Link>
            </div>
          </section>

          <section className={styles.section} id="wishlist">
            <h2>관심 상품</h2>
            <div className={styles.empty}>관심 상품을 담으면 여기에 모입니다.</div>
          </section>

          <section className={styles.section} id="inquiries">
            <h2>문의</h2>
            <div className={styles.empty}>문의 내역이 없습니다.</div>
          </section>

          <section className={styles.section} id="profile">
            <h2>회원 정보</h2>
            <p className={styles.notice}>
              별명 · 비밀번호 변경과 회원 탈퇴는 서버 연결 후 열립니다.
              <br />
              지금 보이는 정보는 이 브라우저에만 저장된 시안 값입니다. 로그아웃하면 지워집니다.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
