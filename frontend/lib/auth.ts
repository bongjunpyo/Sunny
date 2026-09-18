"use client";

import type { Member } from "./types.ts";
import { apiMode } from "./api.ts";

/** 회원 상태 — 서버와 이어질 단 하나의 자리.
 *
 *  mock: 브라우저 저장소에 별명·이메일만 둔다. 비밀번호는 저장하지 않는다.
 *  api : 서버 API(쿠키 세션)를 부른다. 지금은 아직 없다.
 *
 *  화면 코드는 이 파일의 함수만 부른다. */

const KEY = "sunny.mock.member";

function readMock(): Member | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Member) : null;
  } catch {
    return null;
  }
}

function writeMock(member: Member | null) {
  try {
    if (member) window.localStorage.setItem(KEY, JSON.stringify(member));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* 저장소를 못 쓰는 환경에서도 화면은 동작한다 */
  }
}

export function getMember(): Member | null {
  if (typeof window === "undefined") return null;
  if (apiMode() === "mock") return readMock();
  return null; // 서버 연결 후 쿠키 세션에서 읽는다
}

export async function signIn(email: string): Promise<Member> {
  if (apiMode() === "api") throw new Error("서버 인증은 아직 연결되지 않았습니다.");
  const member: Member = { email: email.trim(), nickname: email.trim().split("@")[0] };
  writeMock(member);
  return member;
}

export async function signUp(email: string, nickname: string): Promise<Member> {
  if (apiMode() === "api") throw new Error("서버 인증은 아직 연결되지 않았습니다.");
  const member: Member = { email: email.trim(), nickname: nickname.trim() };
  writeMock(member);
  return member;
}

export async function signOut(): Promise<void> {
  writeMock(null);
}
