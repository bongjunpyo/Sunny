# #110 — 로그아웃 뒤 카카오 재로그인 세션 소실

기준 main: `9997caa`, 2026-11-04. 신규 라이브러리·카카오 scope·계정 연결·DB schema·이메일 정책 변경 없음.

## 재현한 원인

1. 카카오 콜백으로 세션 A를 만들고 쿠키 A를 저장한다.
2. 로그아웃은 DB 세션 A를 폐기하고 브라우저 쿠키를 만료시킨다.
3. 쿠키 A로 시작한 늦은 `/api/auth/get-session` 조회는 정상적으로 `200 null`을 반환한다.
4. Better Auth 1.7.10은 이때 `sunny.session_token=; Max-Age=0`도 반환한다.
5. 카카오 재로그인 콜백이 세션 B를 발급한 뒤 위 응답이 도착하면, 브라우저가 B의 쿠키까지 삭제한다.
   쿠키 이름·경로가 같으므로 쿠키 삭제 헤더는 요청 당시의 A에만 적용되지 않는다.
6. DB에는 새 세션이 있지만 이후 브라우저 조회는 세션 쿠키가 없어 미로그인 상태가 된다.

임시 PostgreSQL17 + 실제 Better Auth + 모의 Kakao에서 응답 도착 순서를 고정해 재현했다.
수정 전 새 세션 유지 assertion이 실패하고, 수정 후 같은 검사가 통과한다.
사용자 브라우저의 과거 실패 요청을 수집한 것은 아니므로 모든 과거 실패의 유일한 원인으로 단정하지 않는다.

## 수정 범위

`auth-handler.ts`에서 get-session 응답이 null이거나 실패이면 Set-Cookie를 전달하지 않는다.
폐기·만료·위조 세션은 여전히 DB 검증에서 거절하며 `null`/오류를 유지한다.
브라우저에 무효 쿠키가 남아도 로그인으로 인정하지 않으며 다음 로그인에서 새 쿠키로 교체한다.
명시적 sign-out 쿠키 폐기, 카카오 callback의 새 세션 쿠키, 유효한 세션의 갱신 Set-Cookie는 보존한다.
API DTO·상태 코드·세션 수명·요청 제한·OAuth state/쿠키 검증을 변경하지 않는다.

## 검증

Node24.14.0, Next16.4.5, 임시 tmpfs PostgreSQL17에 저장소 migration 0001~0003을 적용했다.
실제 개발 DB/볼륨·사용자 데이터·secret·카카오 앱 설정은 변경하지 않았다.

```text
수정 전 delayed session lookup 회귀 검사: tests 1 / fail 1
  late logged-out lookup erased a fresh Kakao session
수정 후 같은 검사: tests 1 / pass 1
  로그인→로그아웃→재로그인→늦은 옛 응답 적용을 3회 반복, 같은 회원 UUID 유지

npm run test:auth  tests 27 / pass 27 / fail 0
npm test          tests 40 / pass 40 / fail 0
npm run build     Compiled successfully; TypeScript 및 페이지 생성 성공
npm run typecheck tsc --noEmit 성공
git diff --check  성공
```

추가 검사는 null/401 응답의 쿠키 변경 차단, 명시적 로그아웃 쿠키 폐기,
유효 세션 갱신 헤더·DTO 비밀 비노출을 확인한다. 기존 OAuth state 위조·만료·재사용 거부,
기존 계정 자동 연결 OFF·게스트 보존·이메일 인증·요청 제한 회귀 검사도 통과했다.

## 실제 localhost 확인

기존 3000번 서버의 `auth-handler.ts`에 같은 최소 수정만 적용했다.
기존 가입/메일 미커밋 파일은 보존했고, 파일 해시 대조에서 이 파일 외 원본 변경이 없음을 확인했다.
Chrome 실계정 카카오 로그인→로그아웃→재로그인과 새로고침 후 회원 표시를 확인했다.
닉네임·이메일·인가 코드·state·세션 쿠키 값은 기록하지 않았다. 장바구니도 보존했다.
실계정 검증과 지연 응답 순서를 강제한 합성 재현 검증은 구분한다.

기존 브라우저에는 '요청이 많습니다' 안내도 관찰됐다. 카카오 시작 요청의 분당5회 제한은
그대로 유지하며, 429가 뜨면 Retry-After에 따라 기다린 뒤 다시 시도해야 한다.
요청 제한까지 해제하거나 우회한 검증은 아니다.

## 리뷰 순서

PR 첫 줄 Closes #110. 머지는 팀장만 한다. #109 인증 코드 변경은 이 수정이 main에 들어간 뒤
최신화한다. #115도 같은 auth-handler 경계를 유지해야 하며 이 PR에는 #114 정책 변경을 넣지 않는다.
