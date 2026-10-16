# 인증 DB·서버 계약 검토안 — #90

상태: 로컬 구현과 통합 검증 대상. API 정본은 [CONTRACT_API.md](../docs/CONTRACT_API.md)이며
이 문서는 준표·재원이 정본에 반영할 검토안이다. #88/PR #89의 변경 항목을 구체화하며
그 PR이 인증 계약을 이미 확정했다는 뜻은 아니다. main/운영 배포는 하지 않는다. 2026-10-16 사용자 요청으로 인증 화면도 이 DTO에 연결한다.

## 고정한 구성

- Better Auth 1.7.10 + pg 8.23.1. PostgreSQL auth schema/search_path, 사용자/인증 PK·FK uuid.
- 서버 세션은 DB에서 확인한다. HttpOnly/SameSite=Lax, HTTPS일 때 Secure. 쿠키 캐시는 사용하지 않는다.
- 게스트는 isAnonymous=true인 별도 사용자다. 자동 삭제와 delete-anonymous-user endpoint를 막고
  로그인/가입 전환 시 게스트 owner를 이전하지 않는다. 인증 children(session/account)의 CASCADE는
  업무 owner FK의 CASCADE와 다르며 업무 FK는 후속 migration에서 RESTRICT/NO ACTION으로 정한다.
- 인증 역할 sunny_auth는 auth 4개 테이블의 DML만 허용한다. auth의 ENABLE/FORCE RLS는 서버 인증 역할에
  전체 인증 행을 허용하는 서비스 정책이다. 최종 사용자별 업무 RLS와 다르며 sunny_app은 인증 테이블을 읽지 못한다.
- 가입 이메일 인증 필수·24시간·인증 뒤 자동 로그인 없음. account linking OFF.
- 클라이언트에 세션/OAuth 토큰·비밀번호 해시·게스트 식별 이메일을 JSON으로 반환하지 않는다.

## API

모든 응답은 Cache-Control: no-store다. 아래 입력 외 필드는 거절하며 userId/ownerId를 받지 않는다.
POST는 BETTER_AUTH_URL의 Origin과 application/json을 요구한다. JSON 본문 상한은 8 KiB다.
인증 쿠키를 보존하고 리디렉션은 허용한 내부 경로로 제한하며 JSON은 표시용 DTO만 반환한다.

| 메서드 | 경로 | 입력 | 성공 |
|---|---|---|---|
| POST | /api/auth/sign-in/anonymous | {} | user + session; 기존 게스트 재사용, 회원 세션이면 409 |
| POST | /api/auth/sign-in/email | email, password, rememberMe 선택 | 인증 회원 user + session |
| GET | /api/auth/get-session | 쿠키 | user + session 또는 null; DB 검증 강제 |
| POST | /api/auth/sign-out | {} | success=true 및 쿠키 폐기 |
| POST | /api/auth/sign-up/email | name, email, password | verificationPending=true; 회원 세션 없음 |
| POST | /api/auth/send-verification-email | email | 계정 존재를 드러내지 않는 동일 안내 |
| GET | /api/auth/verify-email | token, callbackURL 선택 | 토큰 없는 /login?auth=안내코드로 303; 자동 로그인 없음 |
| POST | /api/auth/sign-in/social | provider=kakao | 허용한 카카오 인가 URL만 반환 |
| GET | /api/auth/callback/kakao | native code/state | 성공 /account, 실패 /login?auth=안내코드 |

입력 검사는 기존 frontend/lib/validate.ts의 순수 함수를 서버에서도 재사용한다.
callbackURL은 /, /login, /signup, /account만 입력 허용하되 이메일 인증 결과는 /login으로 고정한다. 비밀번호 재설정·프로필 변경·토큰 발급·
사용자 삭제 등 다른 native 경로는 이번 범위에서 404다. 요청 제한·Cookie/Origin은 native 검사에 더해
서버 경계에서도 확인한다. 실제 UI는 password를 POST 본문으로 전달하고 getMember를 비동기 DB 세션 조회로 처리한다.
상품/CMS mock 모드와 인증을 분리한다. 게스트는 회원 메뉴/마이페이지에서 회원으로 표시하지 않는다.

회원/게스트 로그인·세션 응답 예시(표시용이며 실제 식별자가 아니다):

```json
{
  "user": {"id":"00000000-0000-4000-8000-000000000001","nickname":"예시 회원","email":"member@example.invalid","isAnonymous":false},
  "session": {"expiresAt":"2026-10-23T12:00:00.000Z"}
}
```

게스트는 email을 생략하고 isAnonymous=true다. signup은 아래만 반환한다.

```json
{"verificationPending":true,"message":"메일함에서 인증을 마쳐 주세요."}
```

개발 전용 로컬 메일을 명시적으로 켠 경우 가입 응답에 `verificationDelivery="local"`을 추가한다.
실제 메일 전송 대신 Git에서 제외된 비공개 파일로 인증 링크를 전달하며, 운영·원격 origin에서는 사용할 수 없다.
클라이언트에 인증 링크/세션 토큰을 JSON으로 반환하지 않는다. 가입 직후 DB user/account는 생성되지만
emailVerified=false이고 session은 생성되지 않는다. 인증 링크를 연 다음 별도 로그인한다.
약관 체크는 현재 UI 확인만 하며 DB 동의 이력 수집은 미구현이다. 선택 마케팅 동의는 비활성화한다.

오류는 error.code/message만 반환하며 원본 DB/메일 예외·토큰은 반환하지 않는다.

| HTTP | 의미 |
|---|---|
| 400/415 | 입력/필드/JSON·Content-Type 불일치 |
| 401 | 잘못된 이메일/비밀번호 |
| 403 | EMAIL_NOT_VERIFIED 또는 허용하지 않는 Origin |
| 404/405 | 범위 밖 경로/메서드 |
| 409 | 회원 세션이 있는데 게스트 시작 요청 |
| 429 | native rate limit; Retry-After가 있으면 유지 |
| 503 | 인증 비활성/DB·설정 장애/메일 미설정·발송 실패 |

get-session은 무효·만료·위조 쿠키에 200/null을 반환하며 보호 업무 API는 이를 인증 실패로 처리해야 한다.
실제 메일 또는 명시적인 로컬 개발 메일 설정이 없으면 가입/재발송을 DB 변경 전에 막는다. 실제 Resend 전달이 중간 실패한 경우 계정은 인증 대기로
남을 수 있으므로 메일 복구 후 재발송한다. 실패가 가입/인증 성공으로 바뀌지 않는다.

## 개발 검토값과 운영 전 남은 결정

버전과 UUID는 이번 구현 선택이다. 아래 운영 정책 수치는 채택된 전체 정책으로 오해하지 않는다.

| 항목 | 이번 개발값 | 남은 일 |
|---|---|---|
| 회원·게스트 세션 | 7일, 1일 갱신 | 팀 합의·게스트 세션 분실 복구 |
| 비밀번호·별명 | 공용 validate.ts 사용: 비밀번호 8..128자·영문+숫자, 별명 2..12자 | 기존 화면 입력 규칙 유지, 운영 공동 검토 |
| 공통 인증 제한 | 60초/30회 | IP/프록시 신뢰 경계·공유 제한 저장소 |
| 로그인 | 60초/10회 | 계정 기준 보조 제한·운영 보안 정책 |
| 게스트·가입·카카오 시작 | 각각 60초/5회 | 게스트 재생성 남용·운영 수치 |
| 메일 재발송 | 60초/3회 | 공유 제한·메일 한도·실제 도메인 |

현재 요청 제한 저장소는 memory다. 프로세스 재시작/여러 인스턴스 간 한도를 보장하지 않으므로
Vercel 운영용으로 완료했다고 보고하지 않는다. AUTH_ENABLED 기본 false를 유지하고
공동 계약·공유 요청 제한·실제 메일/HTTPS/검증된 PostgreSQL TLS 준비 전 운영 활성화하지 않는다.
라이브러리 기본 세션과 JSON을 그대로 공개한 API가 아니므로 Better Auth 브라우저 client를 직접 붙이지 않는다.
화면은 이 DTO 또는 다음 공동 계약에서 합의한 클라이언트 adapter를 사용한다.

## 검증

실행 절차·환경변수의 원본은 [README.md](README.md)에 위임한다.
0002는 설치 버전 migration 생성 결과에 schema/권한/RLS·계정 복합 UNIQUE를 추가한 SQL이다.
적용 뒤 adapter introspection과 실제 HTTP 의미의 Request/Response + PostgreSQL 테스트로 컬럼·로그인·
인증 대기/완료·게스트 보존·만료/폐기·쿠키·권한을 검증한다. 테스트 mailer는 링크를 메모리에만 보관한다.
실제 Resend 전송·운영 DB 검증과 구분한다. 화면→Next API→PostgreSQL 및 로컬 파일 인증 메일은 별도 통합 확인한다.

## 2026-10-16 추가 계약 검토 — 이메일 링크와 카카오 (같은 #90 / PR #92)

구현 전 검토 기준: token/callbackURL의 잘못 인코딩된 링크는 정해진 한 가지 형태만 한 번 복원하고(Next의 key-only query 재직렬화가 붙인 빈 = 포함)
서명/만료를 Better Auth에서 검사한다. 인증 성공/실패는 토큰 없는 `/login?auth=...`로 303 이동한다.
callbackURL은 기존 내부 경로만 허용하며 외부·중복·알 수 없는 필드/이중 인코딩은 거부한다.
로컬 HTML은 올바른 이스케이프를 유지하고 같은 비공개 위치에 원문 URL이 담긴 txt도 만든다.

추가 API:
- POST /api/auth/sign-in/social: `{provider:"kakao"}`만 입력. 서버가 callback=/account,
  error callback=/login을 고정한다. `{url:"https://kauth.kakao.com/oauth/authorize?..."}`만 반환한다.
  URL에는 OAuth state가 포함되며 세션/access/refresh token은 반환하지 않는다. 키 미설정은 503.
- GET /api/auth/callback/kakao: native OAuth code/state 검사 후 서버 DB 세션·HttpOnly 쿠키 생성.
  Origin 없는 callback GET은 허용하되 state/cookie 검사를 생략하지 않는다. 다른 provider/POST callback은 거부한다.
  성공은 /account, 오류는 허용한 안내 코드만 담은 /login으로 이동한다. 원본 error_description은 전달하지 않는다.

카카오 제공자의 인증된 이메일은 그대로 인정하고, 미인증 이메일이면 서비스 메일 인증 후 카카오로 재로그인한다.
이메일 미제공은 가입을 거부하고 권한/동의 안내를 한다(임의 이메일·추가 이메일 우회 생성 없음).
같은 이메일의 기존 credential 회원은 자동 연결하지 않고 원래 로그인 방법을 안내한다.
카카오 member의 비밀번호는 생성하지 않는다. providerId/accountId로 식별하고 재로그인 시 같은 UUID를 사용한다.
게스트는 로그인 후에도 보존하고 업무 소유권 이전은 하지 않는다. provider 토큰은 DB 저장 시 암호화한다.
요청 scope는 account_email/profile_nickname만 사용하며 고객 프로필 이미지는 받지 않는다.

키 미설정 상태에서도 이메일 인증은 계속 동작한다. 카카오 토큰 교환/프로필 응답은 자동 테스트에서 모의하고
사용자/계정/세션/state는 실제 PG로 확인한다. 실제 카카오 로그인은 개발자 앱/키·Redirect URI·이메일 제공 권한
설정 후 수동 검증이 필요하다. 서비스 자체 동의 증빙·별명 수정/추가 가입 화면은 후속 공동 계약이 필요하며
현재 법적 동의 이력 수집 완료/운영 가입 완료로 보고하지 않는다. 새 migration/라이브러리는 추가하지 않는다.
