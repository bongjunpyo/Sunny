"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMember, AUTH_CHANGED_EVENT } from "../../lib/auth.ts";

/** 서버 세션을 조회하고 인증 변경·페이지 이동 때 회원 메뉴를 갱신한다. */
export function AccountNav() {
  const pathname = usePathname();
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    let active = true; let latest = 0;
    const refresh = () => {
      const request = ++latest;
      getMember().then(member => {
        if (active && request === latest) setNickname(member?.nickname ?? null);
      }).catch(() => { if (active && request === latest) setNickname(null); });
    };
    refresh(); window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => { active = false; window.removeEventListener(AUTH_CHANGED_EVENT, refresh); };
  }, [pathname]);

  return nickname ? (
    <Link href="/account">{nickname} 님</Link>
  ) : (
    <Link href="/login">로그인</Link>
  );
}
