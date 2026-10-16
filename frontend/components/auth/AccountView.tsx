"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMember, signOut, authErrorMessage } from "../../lib/auth.ts";
import type { Member } from "../../lib/types.ts";
import styles from "../../app/account/page.module.css";

/** DB 세션 조회가 끝난 뒤에만 회원 정보를 표시한다. */
export function AccountView() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true; setReady(false); setError(null);
    getMember().then(value => { if (active) setMember(value); })
      .catch(error => { if (active) setError(authErrorMessage(error)); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [attempt]);

  if (!ready) return <p className={styles.notice}>불러오는 중…</p>;

  if (error && !member) return <div className={styles.empty}>
    <p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>다시 확인</button>
  </div>;

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
          disabled={busy}
          onClick={async () => {
            setBusy(true); setError(null);
            try { await signOut(); setMember(null); router.push("/"); router.refresh(); }
            catch (error) { setError(authErrorMessage(error)); }
            finally { setBusy(false); }
          }}
        >
          로그아웃
        </button>
      </div>

      {error ? <p role="alert">{error}</p> : null}
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
              회원 정보는 서버의 로그인 세션을 통해 확인한 값입니다.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
