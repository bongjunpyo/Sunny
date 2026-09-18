"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMember } from "../../lib/auth.ts";

/** 머리말의 회원 메뉴. 로그인 상태는 브라우저에서만 알 수 있다.
 *  서버에서 그린 화면과 어긋나지 않도록, 확인이 끝나기 전에는 "로그인"을 보여준다. */
export function AccountNav() {
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    setNickname(getMember()?.nickname ?? null);
  }, []);

  return nickname ? (
    <Link href="/account">{nickname} 님</Link>
  ) : (
    <Link href="/login">로그인</Link>
  );
}
