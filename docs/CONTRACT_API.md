# 계약 — 화면 ↔ 서버 API ↔ Sanity · PostgreSQL

> **상태: 미확정 (v0 틀).** 채워야 할 항목은 아래 체크리스트에 있다.
>
> 담당: 봉준표·조수희(화면) ↔ 이재원(서버·데이터). **한쪽이 임의로 바꾸지 않는다.** 바뀌면 둘이 같은 PR에서 합의한다.

## 구조

```
브라우저 (frontend 화면)
   │  fetch("/api/...")            ← frontend/lib/api.ts 만 호출한다 (화면 코드에서 fetch 직접 금지)
   ▼
Next.js 서버 API (frontend/app/api/)            이재원
   │  frontend/lib/server/ 의 서버 전용 클라이언트
   ├──▶ Sanity CMS        공개 콘텐츠: 컬렉션 · 제품 · 제작 기록 · 이미지
   ├──▶ PostgreSQL        비공개 데이터: 주문 요청 · 선호 색상 설문 · 인증 세션 (접근 정책 적용)
   ├──▶ Cloudflare R2     비공개 파일: 고객 사진 (서버가 짧은 수명 서명 URL 발급)
   └──▶ 기상청 API         자외선지수
```

**브라우저는 Sanity·DB·기상청을 직접 부르지 않는다.** (고객 사진만 서버가 발급한 서명 URL로 R2에 직접 올리고 읽는다) 전부 서버 API를 거친다. 키가 브라우저로 새지 않게 하는 구조다.

고객 사진의 직접 전송 예외는 아래 사진 계약의 **R2 presigned PUT/GET**에 한정한다. URL은 지정 객체·메서드·만료 시각에만 유효한 임시 권한이며, 소지자가 만료 전 재사용할 수 있다. 서버 자격증명은 브라우저에 전달하지 않는다.

## mock 먼저

서버와 데이터가 준비되기 전에도 화면을 만든다.

| `NEXT_PUBLIC_API_MODE` | `frontend/lib/api.ts`가 하는 일 |
|---|---|
| 없음 · `mock` (기본) | `frontend/lib/mock/*.json`을 읽어 돌려준다 |
| `api` | `/api/*`를 호출한다 |

**규칙: 이 문서의 응답 예시 = `lib/mock/*.json` = 서버 API 실제 응답.** mock에서 api로 바꾸는 날 준표가 셋을 대조한다.

## 불변식

1. **서버 전용 키는 브라우저에 가지 않는다** — `NEXT_PUBLIC_` 금지, 서버 API 안에서만 읽는다
2. **서버 API는 관리자·`BYPASSRLS` DB 계정을 쓰지 않는다.** 기본은 앱 전용 계정 + 접근 정책(RLS). 사용자 ID는 서버가 검증한 세션에서만 얻는다
3. **주문·설문 테이블은 RLS 없이 만들지 않는다.** 주문 요청의 이름·연락처·사진은 개인정보다
4. **공개 콘텐츠의 정본은 Sanity, 주문·설문의 정본은 PostgreSQL.** 같은 데이터를 두 곳에 두지 않는다
5. **자외선지수를 못 받아오면 오류를 숨기지 않는다** — 마지막으로 받은 값과 갱신 시각, 안내 문구를 함께 준다
6. **고객 사진은 서버 검사를 통과하기 전까지 주문에 연결하지 않는다.** 브라우저 검사와 파일명·확장자·요청 MIME은 신뢰하지 않는다

## 채워야 할 것

- [ ] **제품** (Sanity) — 종류 `bracelet` \| `necklace`, 이름, 비즈 구성, 사진, 설명
- [ ] **비즈 · 광변색** — 색상: 기획서 수정본 기준 **빨강·주황·파랑·노랑·보라 5색** / 농도 저·중·고. (`web-demo/lib/bead.ts`는 3색 견본이다 — 확정 시 errata)
- [ ] **제작 기록** (Sanity) — 제목, 날짜, 단계(모델링·몰드·성형·전사·도포·조립), 사진, 본문
- [ ] **주문 요청** (PostgreSQL) — 아래 시연 계약안의 공동 합의·운영 정책/카탈로그·이용 동의·RLS 검토
- [ ] **선호 색상 설문** (PostgreSQL) — 문항, 익명 여부, RLS 정책
- [ ] **인증** (Better Auth) — 아래 PR #92 정본 절의 API·`lib/auth.ts` DTO 공동 검토와 운영 정책 확정; 비밀번호 재설정은 미구현
- [ ] **자외선지수** — `GET /api/uv` 응답 형태, 지역 기준, 캐시 주기, 실패 응답
- [ ] **커스텀 사진 업로드** — 아래 계약 초안에서 `provisional` 값과 보관 기간을 확정한 뒤 체크
- [ ] 공통 에러 응답 형태 — `{ error: { code, message } }` 여부
- [ ] 엔드포인트 목록과 각 응답 JSON 예시

## 엔드포인트 (초안 — 확정 전)

| 메서드 · 경로 | 용도 | 정본 |
|---|---|---|
| `GET /api/products` | 컬렉션 목록 (`?kind=bracelet\|necklace`) | Sanity |
| `GET /api/products/[slug]` | 제품 상세 | Sanity |
| `GET /api/archive` | 제작 기록 목록 | Sanity |
| `GET /api/uv` | 현재 자외선지수 | 기상청 |
| `GET /api/uploads/photo-rules` | 브라우저 1차 검사에 쓸 사진 규칙 | 서버 설정 |
| `POST /api/uploads/presign` | 비공개 pending 객체의 짧은 수명 PUT URL 발급 | PostgreSQL 메타데이터 · Cloudflare R2 객체 |
| `POST /api/uploads/[assetId]/complete` | 업로드 완료 알림 · 실제 바이트 검사 · verified 확정 | PostgreSQL 메타데이터 · Cloudflare R2 객체 |
| `POST /api/uploads/[assetId]/read-url` | 본인 소유 verified 객체의 짧은 수명 GET URL 발급 | PostgreSQL 소유권·상태 · Cloudflare R2 객체 |
| `POST /api/orders` | 시연 주문 요청 원자 저장 | PostgreSQL |
| `GET /api/orders` | 본인 시연 주문 목록 | PostgreSQL |
| `GET /api/orders/[orderId]` | 본인 시연 주문 상세 | PostgreSQL |
| `POST /api/survey` | 선호 색상 설문 | PostgreSQL |

## 인증 계약 — PR #92

> **PR #92 구현 기준·공동 검토 대상.** 이 절이 인증 API·DTO의 정본이다. 개발 구현과 운영 정책 승인은 구분한다. 환경변수·실행 절차는 [backend/README.md](../backend/README.md), 검증 근거와 남은 작업은 [backend/auth-contract.md](../backend/auth-contract.md)에 위임한다.

### 세션·소유권과 신뢰 경계

- Better Auth **1.7.10**, pg **8.23.1**, PostgreSQL의 `auth.user/session/account/verification`과 UUID PK·FK를 사용한다. 서버는 실제 DB 세션을 재조회하며 쿠키 캐시를 인증 근거로 사용하지 않는다.
- 인증은 `sunny_auth`, 업무는 `sunny_app` 역할로 분리한다. 두 역할 모두 관리자·테이블 소유자·BYPASSRLS 권한을 갖지 않는다. auth의 서비스 역할 RLS와 업무의 사용자별 소유권 RLS를 구분한다. 업무 API는 검증한 UUID만 owner로 사용한다.
- 세션 쿠키는 `sunny` 접두사, `HttpOnly`, `SameSite=Lax`, `Path=/`이며 HTTPS에서는 `Secure`다. 로그인·로그아웃·세션 갱신의 `Set-Cookie`를 경계에서 보존한다. 기존 게스트 재사용에도 갱신 쿠키를 전달한다.
- 게스트는 `isAnonymous=true`인 별도 DB 사용자다. 기존 게스트 세션은 재사용하고 회원 세션에 게스트 시작을 요청하면 `409 MEMBER_SESSION_EXISTS`다. 가입/로그인 뒤에도 게스트 사용자를 보존하며 사진·주문 소유권을 회원에게 이전하지 않는다. 자동 게스트 삭제는 비활성화한다.
- 이메일 가입은 인증 대기이며 가입/이메일 인증 직후 회원 세션을 만들지 않는다. 인증 후 별도로 로그인한다. 보호 업무 API는 무효·만료 세션에 `401`, 미인증 회원에 `403`을 적용한다. 사진 API는 검증 회원 또는 검증된 게스트 DB 세션만 허용한다.
- 브라우저 JSON에 세션 토큰·OAuth access/refresh token·비밀번호·해시·게스트 식별 이메일을 반환하지 않는다. provider 토큰은 DB에 암호화해 저장하고 이메일만 같은 계정을 자동 연결하지 않는다.

### 입력과 엔드포인트

모든 인증 응답은 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`다. POST는 `BETTER_AUTH_URL`과 정확히 같은 Origin, `Content-Type: application/json`, 최대 **8 KiB** JSON 객체를 요구한다. 아래 허용 필드 외 `userId/ownerId` 등을 거절한다. 표시용 별명 입력 이름은 `name`, 반환 이름은 `nickname`이다.

| 메서드 · 경로 | 입력 | 성공 응답/동작 |
|---|---|---|
| `POST /api/auth/sign-up/email` | `{name,email,password}` | `200` 인증 대기 DTO; 세션 발급 없음 |
| `POST /api/auth/send-verification-email` | `{email}` | `200` 계정 존재를 드러내지 않는 동일 안내 |
| `GET /api/auth/verify-email` | query `token`, `callbackURL` 선택 | `303 /login?auth=...`; 자동 로그인 없음 |
| `POST /api/auth/sign-in/email` | `{email,password,rememberMe?}` | `200` 회원 표시 DTO + 세션 쿠키 |
| `POST /api/auth/sign-in/anonymous` | `{}` | `200` 게스트 표시 DTO + 세션 쿠키; 기존 게스트 재사용 |
| `GET /api/auth/get-session` | 세션 쿠키 | `200` 표시 DTO 또는 `null`; DB 검증 강제 |
| `POST /api/auth/sign-out` | `{}` | `200 {"success":true}` + 쿠키 폐기 |
| `POST /api/auth/sign-in/social` | `{"provider":"kakao"}` | `200 {"url":"https://kauth.kakao.com/oauth/authorize?..."}` |
| `GET /api/auth/callback/kakao` | native OAuth `code/state`, 검증 쿠키 | 성공 `302/303 /account`, 실패 `303 /login?auth=...` |

`sign-in/social`의 인가 URL에는 OAuth state가 포함된다. 서버가 provider와 인가 URL의 origin/path를 확인하며, 세션/OAuth 토큰을 JSON으로 내보내는 endpoint가 아니다. callback GET은 Origin 없이 들어올 수 있으나 native state/쿠키 검증을 생략하지 않는다.

이 목록 외 Better Auth native 경로(비밀번호 재설정·프로필 수정·사용자 삭제·토큰 발급 포함)는 **미구현/비공개이며 404**다. Better Auth 브라우저 client를 직접 붙여 native 응답을 가정하지 않는다. 인증은 상품/CMS의 `NEXT_PUBLIC_API_MODE=mock`과 무관하게 DB 세션을 사용한다.

### 표시 DTO와 화면 adapter

회원의 로그인·세션 응답 예시(합성 값):

```json
{
  "user": {"id":"00000000-0000-4000-8000-000000000001","nickname":"예시 회원","email":"member@example.invalid","isAnonymous":false},
  "session": {"expiresAt":"2026-11-10T00:00:00.000Z"}
}
```

게스트 응답은 `email`을 생략한다. 무효·만료·위조 쿠키의 `get-session`은 `200 null`이며 보호 업무 API가 이 값을 인증 실패로 처리한다.

```json
{
  "user": {"id":"00000000-0000-4000-8000-000000000002","nickname":"Anonymous","isAnonymous":true},
  "session": {"expiresAt":"2026-11-10T00:00:00.000Z"}
}
```

가입과 재발송 성공 응답은 각각 다음과 같다. 가입 때 `auth.user/account`가 생성되어도 `emailVerified=false`이며 회원 세션은 없다.

```json
{"verificationPending":true,"message":"메일함에서 인증을 마쳐 주세요."}
```

```json
{"message":"인증이 필요한 경우 메일을 보냈습니다."}
```

명시적으로 켠 loopback 개발 로컬 메일 모드만 가입 DTO에 `verificationDelivery: "local"`을 추가한다. 링크는 Git 제외 비공개 파일로 전달하고 JSON에 넣지 않는다. 운영·원격 Origin에서는 사용할 수 없다.

화면은 `frontend/lib/auth.ts` adapter를 사용한다. `getMember(): Promise<Member|null>`은 회원만 `{email,nickname}`으로 반환하며 게스트/무효 세션은 `null`이다. `signIn(email,password)`는 `Promise<Member>`, `signUp(email,nickname,password)`는 인증 대기 결과, `resendVerification(email)`·`signOut()`은 `Promise<void>`, `signInWithKakao()`는 검증된 인가 URL의 `Promise<string>`이다. 실패 시 표시용 `AuthError(code,message)`를 던진다. 게스트의 UUID·세션이 필요한 업무 흐름은 위 서버 DTO를 사용하며 `getMember()`의 `null`을 게스트 세션 폐기로 해석하지 않는다.

### 이메일·카카오 결과 처리

- 이메일 링크는 `token`과 선택 `callbackURL`만 허용한다. callback 입력은 `/`, `/login`, `/signup`, `/account`로 제한하며 실제 인증 결과 화면은 `/login`으로 고정한다. 허용한 깨진 쿼리 인코딩만 한 번 정규화하고 서명·만료 검증은 Better Auth에서 수행한다. 중복/알 수 없는 필드·외부 callback·이중 인코딩은 거절한다.
- 이메일 결과의 `auth` 코드는 `email-verified`, `verification-invalid`, `verification-expired`다. 토큰·원본 오류를 리디렉션 URL에 싣지 않는다.
- 메일 미설정은 가입/재발송의 DB 변경 전에 `503 AUTH_EMAIL_UNAVAILABLE`로 거절한다. 실제 발송 실패는 인증 대기 계정이 남을 수 있으므로 메일 복구 후 재발송한다. Better Auth가 내부에서 흡수한 가입 메일 실패도 요청별 비동기 컨텍스트로 확인해 동일한 `503`으로 전달한다. 실패를 가입/인증 성공으로 표시하지 않는다.
- 카카오는 서버 설정이 있을 때만 활성화한다. `account_email/profile_nickname`만 요청하고 프로필 이미지를 수집하지 않는다. 제공자가 검증한 이메일은 인정하며, 미인증 이메일은 서비스 메일 인증 후 카카오로 재로그인한다. 이메일 미제공은 거절하고 임의 이메일을 만들지 않는다. 기존 credential 계정과 이메일이 같아도 자동 연결하지 않는다.
- 카카오 실패 안내 코드는 `kakao-cancelled`, `kakao-email-required`, `kakao-email-unverified`, `kakao-account-exists`, `kakao-failed`다. 서버가 성공 `/account`와 실패 `/login`을 고정하며 외부 리디렉션·원본 provider 오류를 전달하지 않는다. 카카오 재로그인은 provider 계정으로 같은 회원 UUID를 사용한다.

### 실패 응답

JSON 실패의 모양은 다음과 같다. 메일/DB/provider 원본 예외·주소·링크·자격증명을 포함하지 않는다. 이메일 인증·카카오 callback의 실패는 위 고정 화면으로 리디렉션한다.

```json
{"error":{"code":"AUTH_EMAIL_UNAVAILABLE","message":"인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."}}
```

| HTTP | code · 조건 | 화면/호출자 처리 |
|---|---|---|
| 400 | `INVALID_AUTH_REQUEST`, `INVALID_SIGNUP_INPUT`, `INVALID_SOCIAL_PROVIDER` | 입력을 수정; 허용하지 않은 필드/본문 크기·JSON 확인 |
| 415 | `INVALID_CONTENT_TYPE` | JSON으로 요청 |
| 401 | `INVALID_EMAIL_OR_PASSWORD` | 동일한 로그인 실패 안내 |
| 403 | `EMAIL_NOT_VERIFIED`, `ORIGIN_NOT_ALLOWED` | 이메일 인증 또는 접속 Origin 확인 |
| 404 | `AUTH_ENDPOINT_NOT_AVAILABLE` | 지원하지 않는 native 경로를 호출하지 않음 |
| 405 | `METHOD_NOT_ALLOWED` + `Allow` | 해당 경로의 허용 메서드 사용 |
| 409 | `MEMBER_SESSION_EXISTS` | 기존 회원 세션 사용; 자동 게스트 전환 금지 |
| 429 | `AUTH_RATE_LIMITED` + 유효한 `Retry-After`(정수 초) | 지정 시간 뒤 재시도; 검증한 native `X-Retry-After`도 표준 헤더로 전달 |
| 503 | `AUTH_EMAIL_UNAVAILABLE` | 메일 설정/발송 복구 후 재발송; 가입/로그인 성공 처리 금지 |
| 503 | `AUTH_SERVICE_UNAVAILABLE`, `AUTH_SESSION_UNAVAILABLE`, `KAKAO_UNAVAILABLE` | 인증 비활성·DB/설정·세션 재조회·카카오 설정/응답 장애 안내 |
| native 실패 상태 유지 | 허용한 `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `INVALID_EMAIL`, `INVALID_TOKEN`, `TOKEN_EXPIRED` 외 `AUTH_REQUEST_FAILED`로 정규화 | 원본 예외를 노출하지 않고 재입력/재시도 안내 |

### 개발값·미완료와 운영 전 검토

| 항목 | PR #92의 개발 구현값 | 운영 전 남은 일 |
|---|---|---|
| 회원·게스트 DB 세션 | 7일, 갱신 간격 1일 | 수명 합의·게스트 세션 분실 복구 |
| 이메일 인증 토큰 | 24시간, 인증 뒤 자동 로그인 없음 | 실제 메일 도메인/수신 검증·운영 정책 |
| 가입 비밀번호·별명 | 8..128자·영문+숫자, 별명 2..12자 | 화면/서버 공용 validate 사용·운영 검토 |
| 요청 제한 | 메모리 저장소, 공통 60초/30회 | 공유 저장소·IP/프록시 신뢰 경계 |
| 개별 요청 제한 | 로그인 60초/10회; 게스트·가입·카카오 시작 각각 60초/5회; 재발송 60초/3회 | 계정 보조 제한·게스트 남용·메일 한도 합의 |
| 서비스 자체 동의 이력 | 미구현; UI 약관 확인만, 선택 마케팅 동의 비활성 | 문구/버전/증빙 저장 공동 계약 |
| 비밀번호 재설정·프로필 변경 | 미구현/공개 endpoint 없음 | 후속 이슈·계약 |

개발 수치는 운영 합의값이 아니다. 메모리 제한은 재시작·다중 인스턴스 간 한도를 보장하지 않는다. `AUTH_ENABLED` 기본 false를 유지하며 공동 계약 검토·공유 제한·검증한 프록시/HTTPS/PostgreSQL TLS·메일 준비 전 운영 활성화하지 않는다. 모의 메일/카카오 및 실제 로컬 PostgreSQL 검증은 외부 실서비스·Vercel 운영 검증과 구분한다. 적용된 migration·기존 인증 데이터·비밀번호·인증 secret 변경은 이 계약 정리 범위에 포함하지 않는다.

## 커스텀 사진 업로드 계약 — #26 검토 초안

> **운영 정책 합의 전 초안.** `provisional: true`인 규칙과 `TBD` 정책은 운영값이 아니다. 봉준표·이재원이 후속 계약 PR에서 값을 확정하고 `provisional: false`로 바꾸기 전에는 사진 업로드를 프로덕션에 켜지 않는다.

### 채택 설계와 합의할 경계

제공자는 [PostgreSQL·Better Auth·R2 설계](../backend/postgres-design.md)의 7절과 #71/PR #75를 따른다. 이 절은 PR #65에서 합의한 사진 API 초안이며 구현 완료를 뜻하지 않는다.

| 항목 | 사진 API의 기준 |
|---|---|
| 인증 | Next.js가 Better Auth의 실제 PostgreSQL DB 세션을 검증. HttpOnly 쿠키의 존재나 세션 쿠키 캐시만으로 허용하지 않음 |
| 허용 대상 | 로그인한 회원 또는 서버가 발급·검증한 게스트 세션. 무인증·만료 세션은 거부 |
| 회원 조건 | 이메일 가입은 인증 대기이며 회원 세션을 발급하지 않음. 사진 API에 쓸 회원 자격·카카오 검증은 새 인증 계약과 일치시킴 |
| 소유권 | 서버가 검증한 사용자 ID로 사진 owner를 결정. 본문의 userId/ownerId·bucket/key를 권한으로 사용하지 않음 |
| 게스트 전환 | 게스트와 회원은 별도 사용자. 가입/로그인 후 게스트 주문·사진의 소유권 이전·계정 통합 없음 |
| 데이터 정본 | 사진 바이트는 private R2, 소유권·목적·상태·객체 key는 PostgreSQL. 고객 사진을 공개 CMS로 옮기지 않음 |
| 접근 정책 | 인증은 전용 auth 역할, 업무는 NOBYPASSRLS 앱 역할과 서버 소유권 검사·RLS. 관리자/테이블 소유 역할로 API를 실행하지 않음 |

게스트의 자동 삭제를 막는 `disableDeleteAnonymousUser: true`와 업무 owner FK의 CASCADE 삭제 금지를 유지한다. 세션 분실 후 회원에게 자동 이전하거나 주문번호만으로 복구하지 않으며 복구 방식은 `TBD`다.

인증 API·DTO·DB 세션/쿠키·Origin·실패 응답은 위 [인증 정본 절](#인증-계약--pr-92)을 따른다. 사진 API는 그 절의 검증 회원/게스트 자격을 사용한다. 사진 계약(#65)은 먼저 머지되었으며, 구현 PR #94는 이 사진 절을 대조 기준으로 삼는다. #92 인증 정본의 공동 검토와 운영 정책 검토는 별개이며 머지는 팀장만 한다.

이 사진 절의 주문 항목은 사진 배치·동의 연결에 한정한다. 주문 제품 옵션 전체는 후속 주문 계약에서 정한다. 웹 설문·결제 제외와 회원 리뷰 보류는 #88/PR #89의 2026-11-02 팀장 결정에 따르며, 정본의 기존 설문 문구 정리는 별도 errata에서 처리한다.

### 흐름과 신뢰 경계

```
1. 브라우저  → GET  /api/uploads/photo-rules
2. 브라우저  → POST /api/uploads/presign
3. 브라우저  → presigned PUT으로 private pending 객체 전송
4. 브라우저  → POST /api/uploads/{assetId}/complete
5. 서버      → 파일 바이트·용량·해상도 검사 → 방향 보정·재인코딩(EXIF 제거)
6. 서버      → 검사한 동일 바이트의 정제본을 별도 verified key에 저장 → DB 확정
7. 브라우저  → 소유한 verified 사진의 조회 URL로 3D 가시안 확인
8. 주문 API  → 7칸 배치에 있는 본인 소유 verified assetId만 받음
```

- `assetId`는 presign 때 미리 발급하지만, `verified` 전에는 주문이나 조회에 쓸 수 없다.
- 업로드 원본은 비공개 R2 버킷의 서버 생성 임의 `pending/` 경로에 격리한다. 파일명으로 key를 만들지 않고 공개 URL은 만들지 않는다. 브라우저에는 다른 객체나 verified 경로의 쓰기 권한을 주지 않는다.
- 서버 검사는 업로드 완료 알림을 받는 즉시 실행한다. 주문 제출 때까지 검사를 미루지 않는다.
- 완료 알림은 같은 `assetId`로 다시 호출해도 검사를 중복 실행하지 않는다. 검사 중에는 `409`, 검증 완료 뒤에는 동일한 최종 결과를 반환한다. 화면의 재시도 규칙은 아래 `complete` 항목을 따른다.
- `presign`·`complete`·`read-url`·주문 API는 위 인증 경계에 따라 검증한 회원/게스트 ID만 사용한다. 타인 사진 접근을 거부하며 가입/로그인으로 이전 게스트 사진을 사용할 수 있게 하지 않는다.
- 서버는 실제 파일 시그니처와 이미지 디코딩 결과를 검사한다. 파일명·확장자·요청 MIME만으로 통과시키지 않는다.
- SVG와 디코딩할 수 없는 파일은 거부한다.
- 통과 파일은 화면 방향을 적용한 뒤 재인코딩해 EXIF 전체를 제거한다. 특히 GPS 위치 정보가 남지 않아야 한다.
- 실패한 임시 파일은 주문에 연결하지 않고 삭제 대상으로 표시한다.
- 업무 DB는 같은 client의 요청별 트랜잭션에 검증된 사용자 ID를 설정하고 RLS를 적용한다. 컨텍스트가 없으면 거부하고 완료/rollback 후 풀에 사용자 컨텍스트를 남기지 않는다. DB의 RLS는 R2 바이트에 직접 적용되지 않으므로 서명 발급·완료·주문 연결 시 서버 검사를 유지한다.
- 보호 POST는 세션 외에 Origin/CSRF 정책을 검사한다. 사진 API의 성공·실패 응답에 `Cache-Control: no-store`를 적용한다. 서명 URL을 영구 저장하지 않고 URL·쿠키·토큰·원본 파일명/개인정보를 로그에 남기지 않는다. R2 직접 요청에 앱 세션 쿠키·Authorization을 전달하지 않는다.

### 사진 규칙

현재 화면의 임시값을 계약 모양에 옮긴 것이다. 숫자와 비율은 회의에서 확정해야 한다.

```json
{
  "photoRules": {
    "accept": ["image/jpeg", "image/png"],
    "maxBytes": 10485760,
    "minWidth": 1000,
    "minHeight": 1000,
    "aspectRatio": null,
    "provisional": true
  }
}
```

| 필드 | 의미 |
|---|---|
| `accept` | 브라우저 안내와 presign 1차 거절에 쓰는 MIME 목록. 실제 형식은 서버가 바이트로 다시 확인 |
| `maxBytes` | 원본 업로드 최대 바이트 수 |
| `minWidth` · `minHeight` | 방향 보정 후 필요한 최소 픽셀 수 |
| `aspectRatio` | `null`이면 비율 제한 없음. 제한할 때 `{ "min": number, "max": number }` |
| `provisional` | `true`면 회의 전 임시값이며 운영 업로드 비활성 |

### `GET /api/uploads/photo-rules`

로그인 전에도 화면 안내에 쓸 수 있는 공개 규칙이다. 위 `photoRules` 객체를 그대로 반환한다. 화면은 이 값을 다시 하드코딩하지 않는다.

응답 `200`:

```json
{
  "photoRules": {
    "accept": ["image/jpeg", "image/png"],
    "maxBytes": 10485760,
    "minWidth": 1000,
    "minHeight": 1000,
    "aspectRatio": null,
    "provisional": true
  }
}
```

### `POST /api/uploads/presign`

서버가 검증한 회원 또는 게스트가 브라우저 1차 검사를 통과한 뒤 요청한다. 게스트 세션 생성·갱신은 인증 API의 책임이며 이 API가 무인증 요청을 자동 게스트로 바꾸지 않는다.

요청:

```json
{
  "purpose": "custom_order_photo",
  "fileName": "my-photo.jpg",
  "mimeType": "image/jpeg",
  "size": 2456789
}
```

| 필드 | 규칙 |
|---|---|
| `purpose` | 현재는 `custom_order_photo`만 허용 |
| `fileName` | 화면 표시를 위한 원본 이름 힌트. 저장 경로·형식 판정에 사용하거나 원문을 로그에 남기지 않음 |
| `mimeType` | `photoRules.accept`에 포함되어야 하나 서버 실제 검사 결과가 우선 |
| `size` | `1..photoRules.maxBytes`. 실제 업로드 바이트 수를 서버가 다시 확인 |

응답 `201`:

```json
{
  "assetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31",
  "uploadUrl": "https://example.invalid/r2-presigned-put/REDACTED",
  "expiresAt": "2026-10-16T11:15:00.000Z"
}
```

- 예시 URL은 실행 불가 placeholder다. 실제 URL은 R2 S3 API 도메인의 지정 pending 객체 하나에 대한 **PUT** 권한이며, 브라우저는 요청의 `mimeType`과 같은 `Content-Type`으로 파일 바이트를 보낸다. Next API의 POST와 R2 전송 메서드 PUT을 구분한다. HTML form POST는 사용하지 않는다.
- URL은 응답받은 사용자에게만 묶인 인증 수단이 아니다. 소지자가 만료 전 반복 사용할 수 있고 같은 pending 객체를 덮어쓸 수 있으므로, 노출하지 않고 완료 검사와 verified 객체 분리로 보호한다.
- `Content-Type` 서명은 실제 파일 형식 검사나 최대 바이트 제한을 대신하지 않는다. R2가 `size`만큼만 받거나 과대 파일을 차단한다고 가정하지 않으며 서버가 bounded read와 디코딩 자원 제한을 적용한다. 정확한 픽셀/디코딩 자원 상한은 구현 전 합의한다.
- `expiresAt`은 PUT URL의 만료 시각이다. 업로드 후 complete를 허용하는 기한과 구분하며 두 정책은 `TBD`다. 예시 시각은 TTL 합의를 뜻하지 않는다.
- 사용자별 **최근 60분 동안 발급한 URL 20개**를 상한으로 하는 기존 PR 검토안을 유지한다. 서버는 검증된 회원·게스트 사용자 ID 각각을 기준으로 동시 요청까지 원자적으로 집계한다. 형식·크기 검증에 실패해 URL을 발급하지 않은 요청은 세지 않는다. URL 재사용은 새 발급이 아니지만 새 presign은 다시 센다.
- 상한에 도달하면 `429 UPLOAD_RATE_LIMITED`와 `Retry-After`(다음 발급이 가능한 때까지의 초)를 반환한다. 화면은 남은 시간을 안내하고 자동 재요청하지 않는다. 이 제한은 `presign` URL 발급에 적용하며 다른 업로드 API 호출은 세지 않는다. 상한을 바꾸려면 준표·재원이 계약을 다시 검토한다.
- 새 게스트 세션을 반복 만들어 사용자별 한도를 우회하는 경우는 인증/게스트 생성 제한으로 함께 다룬다. IP 등 추가 제한·개인정보 최소화·수치와 실행 방식은 인증 계약의 `TBD`이며 사용자별 20개 제한만으로 남용을 막았다고 보고하지 않는다.

### `POST /api/uploads/[assetId]/complete`

R2 PUT 업로드가 성공한 직후 같은 회원·게스트 세션으로 호출한다. 요청 본문은 없다. asset의 소유권·목적·상태·완료 허용 기한을 서버가 확인한다.

1. 같은 asset을 한 작업만 검사하도록 DB 상태를 원자적으로 `inspecting`으로 확보한다.
2. pending 객체의 실제 크기·읽기 상한·파일 형식·이미지 디코딩·방향 보정 후 해상도를 검사한다. 헤더/메타데이터만으로 통과시키지 않는다.
3. **서버가 검사한 동일 바이트**를 방향 보정·재인코딩·EXIF 제거한 정제본으로 만들어 **브라우저 PUT 권한이 없는 별도 verified key**에 저장한다. 검사 후 pending을 다시 읽은 미검증 바이트나 pending 객체의 단순 복사본으로 확정하지 않는다.
4. 정제 객체 저장 성공 뒤 DB를 `verified`로 확정하고 pending을 삭제 대상으로 남긴다. 이후 조회·주문은 verified key만 사용하므로 기존 PUT의 재사용/덮어쓰기가 확정 사진을 바꾸지 않는다.

R2 저장과 DB 확정은 하나의 트랜잭션이 아니다. 중간 실패는 검증 실패(`rejected`)와 구분하고, 고아 verified 객체·남은 pending 객체·서버 중단으로 멈춘 inspecting 상태를 정리/복구하는 책임을 둔다. 실행 주체·복구 제한 시간·재시도/정리 주기는 `TBD`이며 미확정 상태에서 운영에 켜지 않는다.

응답 `200`:

```json
{
  "assetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31",
  "status": "verified",
  "mimeType": "image/jpeg",
  "bytes": 1987654,
  "width": 1800,
  "height": 1200
}
```

`status` 전이:

```
pending → inspecting → verified
                     ↘ rejected
pending              → expired
```

- `verified`만 주문의 `beadLayout.beads[].photoAssetId`로 받을 수 있다.
- 서버가 반환하는 MIME·용량·해상도는 재인코딩된 최종 파일 기준이다.
- `inspecting` 중 같은 요청이 오면 `409 UPLOAD_INSPECTION_IN_PROGRESS`와 `Retry-After: 3`(초)을 반환한다. 화면은 이 응답 뒤 3초 간격으로 같은 `complete` 요청을 **최대 10회 추가 호출**한다. 매번 `409`라면 자동 재시도를 멈추고 "사진 확인에 시간이 걸리고 있습니다. 잠시 후 다시 확인해 주세요."라고 안내한다. 이후 사용자의 재확인은 같은 요청으로 하며 파일을 다시 업로드하지 않는다.
- 이미 `verified`이면 기존 `200` 결과를 다시 반환한다.
- pending 객체가 R2에 없으면 `409 UPLOAD_NOT_RECEIVED`를 반환하고 asset을 `pending`으로 유지한다. R2의 `NoSuchKey`로 확인된 객체 미수신을 장애 `503`으로 바꾸지 않는다. 완료 허용 기한 안이고 `expiresAt` 전이면 화면은 같은 `uploadUrl`로 PUT을 다시 수행하고, PUT 성공 뒤 `complete`를 호출한다. PUT URL이 만료됐으면 새 presign부터 시작한다. 파일이 없는 상태에서 complete만 자동 반복하거나 새 presign을 자동 연속 발급하지 않는다.
- 이미 `rejected`이면 최초 검사 실패의 HTTP 상태와 `error.code`를 그대로 다시 반환한다. 파일을 재검사하거나 `pending`으로 되살리지 않는다. 화면은 해당 코드로 다른 사진을 선택하도록 안내한 뒤 새 presign부터 시작한다. `expired` 재호출은 `410 UPLOAD_EXPIRED`이며 새 presign을 안내한다.
- 정제본 저장/DB 확정 실패 등 일시 장애는 `503 UPLOAD_STORAGE_UNAVAILABLE`로 안내하고 같은 asset의 `complete`를 재호출한다. 유효한 `Retry-After`(초)가 있으면 그 값만큼 기다리고, 없거나 유효하지 않으면 3초 뒤 재시도한다. **최대 10회 추가 호출** 뒤에도 실패하면 자동 반복을 멈추고 "사진 처리가 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해 주세요."라고 안내한다. 사용자 재확인은 같은 asset으로 하며 새 파일/새 asset을 자동 생성하지 않는다. 재호출 결과가 `verified`면 기존 `200`, `inspecting`이면 위 `409`, 미수신이면 `UPLOAD_NOT_RECEIVED` 동작을 따른다. `503`과 검사 중 `409`가 번갈아도 하나의 자동 확인 과정에서 추가 호출은 합계 10회를 넘지 않으며, 영구 inspecting 복구는 서버 책임이다.

### `POST /api/uploads/[assetId]/read-url`

서버가 검증한 회원·게스트가 소유한 `custom_order_photo` 목적의 `verified` 파일에 대해서만 **별도 verified key의 GET URL**을 발급한다. pending/rejected/expired 또는 보관 기한 만료·삭제/접근 차단 대상 파일의 URL은 발급하지 않는다. 공개 URL이나 영구 URL은 반환하지 않는다. 주문 전에 반드시 확인하는 **3D 가시안의 비즈 표면 텍스처**에도 이 URL을 사용한다.

응답 `200`:

```json
{
  "readUrl": "https://example.invalid/r2-presigned-get/REDACTED",
  "expiresAt": "2026-10-16T11:20:00.000Z"
}
```

- 7칸에 사진을 하나씩 넣으면 화면에서 최대 7개를 동시에 요청한다. 같은 `assetId`가 여러 칸에 있으면 한 번만 요청하고 그 URL을 해당 칸에서 함께 쓴다. 현재 규모에서는 기존 단건 API를 병렬 호출하며, 별도 일괄 발급 API는 만들지 않는다.
- 조회 URL 만료 시간은 3D 가시안을 돌려보는 시간을 고려해 회의에서 확정한다(`TBD`). 화면은 `expiresAt`이 지나기 전에 필요한 URL을 다시 요청해 텍스처를 갱신한다. 갱신에 실패하면 해당 사진을 계속 표시한다고 가정하지 않고 안내와 재시도 동작을 제공한다.
- GET URL도 만료 전 재사용되는 bearer 권한이다. 로그아웃·세션 만료·동의 철회만으로 이미 발급된 URL이 즉시 무효화된다고 보장하지 않는다. 새 발급은 차단하되 기존 URL의 만료·캐시/삭제 정책을 함께 합의한다. 앱 응답과 고객 객체 응답은 no-store로 다루는 안을 검증한다.
- 개발/운영 R2 버킷·키를 구분하고 허용 origin·PUT/GET/필요 시 HEAD·Content-Type을 CORS에 맞춘다. preview origin 방식은 `TBD`이며 전체 origin 허용으로 대체하지 않는다. 3D 텍스처 읽기까지 확인하고, CORS를 소유권 검사로 간주하지 않는다.

### 실패 응답

사진 업로드 API는 공통으로 아래 모양을 쓴다.

```json
{
  "error": {
    "code": "IMAGE_DIMENSIONS_TOO_SMALL",
    "message": "사진 해상도가 최소 기준보다 작습니다."
  }
}
```

| HTTP | `code` | 때 | 화면 동작 |
|---:|---|---|---|
| 400 | `INVALID_UPLOAD_REQUEST` | 필수 필드 누락·범위 밖 값 | 입력을 고친 뒤 요청; 같은 본문 자동 반복 금지 |
| 401 | `AUTHENTICATION_REQUIRED` | 검증 가능한 회원·게스트 세션이 없거나 만료됨 | 인증을 다시 확인; 다른 사용자에게 이전 사진을 자동 연결하지 않음 |
| 403 | `UPLOAD_SESSION_NOT_ELIGIBLE` | 세션은 있으나 인증 계약의 회원/게스트 자격에 맞지 않음 | 자격·이메일 인증 안내; 같은 요청 자동 반복 금지 |
| 403 | `UPLOAD_ORIGIN_REJECTED` | 앱 POST의 Origin/CSRF 검사 실패 | 요청 환경 오류 안내; 자동 반복 금지 |
| 404 | `UPLOAD_NOT_FOUND` | 없거나 · 본인 소유가 아니거나 · 접근 차단된 `assetId` | 동일한 접근 불가 안내; 자동 반복·다른 사용자 사진 탐색 금지 |
| 409 | `UPLOAD_INSPECTION_IN_PROGRESS` | 같은 파일을 이미 검사 중 | 3초 간격, 최대 10회 추가 complete 후 안내·자동 반복 중단 |
| 409 | `UPLOAD_NOT_RECEIVED` | pending 객체가 R2에 없음; asset은 pending 유지 | 완료 기한·expiresAt 전이면 같은 URL로 PUT 후 complete, PUT URL 만료면 새 presign |
| 409 | `UPLOAD_NOT_VERIFIED` | read-url/주문에 pending 또는 inspecting 사진 사용 | 먼저 complete 결과를 확인; verified 전에는 조회·주문하지 않음 |
| 410 | `UPLOAD_EXPIRED` | 앱 DB의 완료 허용 기한 만료로 expired 처리된 asset | 새 presign 안내; 기존 asset 되살리기 금지 |
| 413 | `FILE_TOO_LARGE` | 요청 크기 또는 실제 바이트 수 초과 | 더 작은 사진 선택 후 새 presign |
| 415 | `UNSUPPORTED_IMAGE_TYPE` | 허용하지 않는 형식·SVG·실제 형식 불일치 | 허용 형식의 다른 사진 선택 후 새 presign |
| 422 | `INVALID_IMAGE_FILE` | 이미지로 디코딩할 수 없음 | 다른 사진 선택 후 새 presign |
| 422 | `IMAGE_DIMENSIONS_TOO_SMALL` | 방향 보정 후 최소 해상도 미달 | 해상도 조건을 만족하는 다른 사진 선택 후 새 presign |
| 422 | `IMAGE_ASPECT_RATIO_NOT_ALLOWED` | 확정된 비율 범위 밖 | 비율 조건을 만족하는 사진 선택 후 새 presign |
| 429 | `UPLOAD_RATE_LIMITED` | 검증된 회원/게스트가 최근 60분의 presign 발급 상한에 도달 | Retry-After의 남은 시간 안내; 자동 presign 금지 |
| 503 | `UPLOAD_STORAGE_UNAVAILABLE` | R2/확정 처리 장애로 안전하게 완료할 수 없음 | complete는 Retry-After 우선·없으면 3초, 최대 10회 추가 후 안내·중단; 다른 API는 아래 규칙 |

오류 메시지는 화면 표시용 한국어 문장이고, 분기는 `code`로 한다. 서명 URL에 포함되는 객체 경로·서명 항목 외에 bucket/key를 별도 필드로 반환하지 않는다. 오류 응답과 로그에는 내부 스토리지 경로·서명 URL·키·원본 오류·개인정보를 넣지 않는다.

complete/read-url의 소유권·접근 검사는 상태 검사보다 먼저 적용한다. RLS 아래에서 조회되지 않는 자원과 접근 차단 자원은 같은 `404 UPLOAD_NOT_FOUND` 코드·메시지로 처리하며, 타인 자원의 존재를 구분하려고 관리자 권한으로 재조회하지 않는다. 세션 자격·Origin/CSRF의 `403`과 구분한다.

이 표는 **Next.js 앱 API**의 JSON 계약이다. R2에 직접 보내는 PUT/GET은 이 JSON 모양이나 앱의 410을 보장하지 않는다. R2의 만료/서명 오류(예: 403)를 앱의 세션 401과 혼동하지 않는다. PUT 실패 시 complete로 성공 처리하지 않고 유효 기한과 네트워크 결과를 확인한다. 새 presign은 발급 상한을 다시 적용한다. presign의 503은 발급 성공 여부가 불명확할 수 있으므로 자동 재발급하지 않고 사용자 재시도를 안내한다. GET 실패는 유효한 앱 세션으로 read-url을 재요청하며, read-url의 503도 Retry-After 우선·없으면 3초 간격으로 최대 10회 추가 요청한 뒤 안내하고 자동 반복을 멈춘다. 동일 asset에 대한 URL 발급 재시도 횟수는 그 확인 과정에서 누적하며 오류 응답이 달라졌다고 초기화하지 않는다. 미수신·rejected·expired 재호출은 위 complete 규칙을 따른다.

### 보관·삭제 정책 — 합의 필요

| 상태 | 보관·삭제 원칙 | 기간 |
|---|---|---|
| `pending` · `expired` | 완료되지 않은 임시 파일과 만료 후 다시 생긴 pending 객체를 반복 정리 | `TBD` |
| `inspecting` | 서버 중단/시간 초과 작업을 복구하고 중복 확정 방지 | `TBD` |
| `rejected` | 검사 실패 뒤 즉시 접근 차단하고 삭제 | `TBD` |
| `verified` | 제작 완료 후 정해진 기간이 지나면 원본·정제본·메타데이터 삭제 | `TBD` |
| 브랜드 공개 동의 철회 | 공개 사용을 중단하고 별도 보관 근거가 없으면 삭제 | `TBD` |

기간과 삭제 실행 주체(예약 작업 또는 운영 절차)가 `TBD`인 동안 프로덕션 업로드를 켜지 않는다.

삭제한 pending 객체도 살아 있는 PUT URL로 다시 생성될 수 있다. 서명 만료와 업로드 완료 여유 시간 이후에도 고아 객체를 반복 정리한다. 정제본 저장 후 DB 확정 실패, DB 삭제/객체 삭제 실패, 주문에서 재사용 중인 사진의 참조 확인·보관 근거를 포함해 재시도와 정리 기준을 합의한다.

### 주문 동의 필드

팔찌의 네모 사진 비즈는 **정확히 7칸**이고, 각 칸에 사진 한 장 또는 `null`을 배치한다. 사진은 선택 사항이며 서로 다른 사진은 0~7장이다. 동일한 사진을 여러 칸에 쓸 수 있고 이 경우 업로드는 한 번만 한다. 주문 화면은 3D 가시안을 보여준 뒤 명시적인 확인을 받아야 제출할 수 있다. 주문 API는 `previewConfirmed: true`를 요구하고 서버 수신 시각을 확인 기록으로 저장한다. 이 값은 사용자의 확인 의사를 기록하며 실제 시청 시간을 증명하지는 않는다.

목걸이는 사진 커스텀 없이 원형–달–원형 3개 구성이며, 여러 품목 주문의 전체 입력은 아래 주문 계약을 따른다.

팔찌 품목의 사진 배치 예시(7칸 전체):

```json
{
  "beadLayout": {
    "squareCount": 7,
    "beads": [
      { "index": 0, "photoAssetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31" },
      { "index": 1, "photoAssetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31" },
      { "index": 2, "photoAssetId": null },
      { "index": 3, "photoAssetId": null },
      { "index": 4, "photoAssetId": null },
      { "index": 5, "photoAssetId": null },
      { "index": 6, "photoAssetId": null }
    ]
  },
  "previewConfirmed": true,
  "photoProductionConsent": {
    "accepted": true,
    "policyVersion": "EXAMPLE_PRODUCTION_V1"
  },
  "photoBrandUseConsent": {
    "accepted": false,
    "policyVersion": "EXAMPLE_BRAND_V1"
  }
}
```

- `beadLayout.squareCount`는 `7`, `beads` 길이는 정확히 7이다. `index`는 0~6을 한 번씩 포함해야 하며 빠짐·중복·범위 밖 값은 거절한다. 순서는 `index`로 정한다.
- `previewConfirmed`가 `true`가 아니면 주문을 받지 않는다. 서버는 확인 시각을 브라우저 값 대신 직접 기록한다.
- `beads[].photoAssetId`는 `null` 또는 본인 소유의 `verified` 파일 ID다. 같은 ID가 여러 칸에 있어도 허용한다. 사진이 없으면 일곱 칸 모두 `null`이다.
- 사진이 한 칸이라도 있으면 `photoProductionConsent.accepted`가 `true`여야 한다. 모두 `null`이면 두 사진 동의 필드는 필요 없다.
- `photoBrandUseConsent`는 제작 동의를 대신하지 않으며, 거부해도 주문할 수 있다.
- 클라이언트는 accepted/policyVersion만 제출하고 acceptedAt은 보내지 않는다. 서버가 유효한 정책 버전을 대조해 동의 영수증과 시각을 기록한다. 위 EXAMPLE 버전은 유효 정책이 아니며 실제 문구·버전·시행일·철회는 `TBD`다. 거절의 acceptedAt은 null, recordedAt은 서버 수신 시각이다.
- 주문 생성 시 사진 소유권·verified 상태·목적을 다시 검사한다. 주문 묶음·품목별 배치(팔찌7칸/목걸이3개)·동의 기록은 원자적으로 저장하며, 슬롯 범위와 PK만으로 7행이 보장된다고 가정하지 않는다. 전체 제품 옵션/상태·FK/RLS SQL은 후속 주문/DB 계약에서 확정한다.

서버가 기록한 동의 결과의 예시(주문 응답 전체 DTO는 후속 계약 대상):

```json
{
  "consents": {
    "photoProductionConsent": {
      "accepted": true,
      "policyVersion": "EXAMPLE_PRODUCTION_V1",
      "acceptedAt": "2026-10-16T11:30:00.000Z",
      "recordedAt": "2026-10-16T11:30:00.000Z"
    },
    "photoBrandUseConsent": {
      "accepted": false,
      "policyVersion": "EXAMPLE_BRAND_V1",
      "acceptedAt": null,
      "recordedAt": "2026-10-16T11:30:00.000Z"
    }
  }
}
```

### 공동 검토와 구현 수용 기준

- 위 인증 정본 절의 회원/게스트 자격·401/403·쿠키/Origin/CSRF를 구현과 대조한다. 다른 사용자·게스트→회원 전환 후 이전 사진의 접근은 존재하지 않는 사진과 같은 404로 거부한다.
- 기존 7칸·동일 사진 재사용·0장·409 재시도·429 발급 상한을 회원/게스트 각각 확인한다.
- pending 덮어쓰기·동시 complete·검사 후 원본 변경에도 검사한 정제본만 verified로 확정하고 같은 complete는 동일 최종 결과를 반환한다.
- PUT 미수신은 pending 유지·409 UPLOAD_NOT_RECEIVED, rejected 재호출은 최초 HTTP/code 유지, 503과 검사 중 409가 섞여도 추가 호출 합계 10회 상한·안내·중단을 확인한다.
- R2 저장 뒤 DB 확정 실패·영구 inspecting·만료 뒤 pending 재생성·삭제 실패를 복구하는 실행 주체와 시간/횟수 정책을 정한다.
- URL 만료/외부 403과 앱 인증 오류를 구분하고, 로그아웃 후 새 발급 차단·CORS·3D 텍스처 갱신·no-store를 검증한다.
- 사진 규칙/디코딩 자원 상한·PUT/GET TTL/완료 기한·보관/삭제·동의 정책은 합의 전 `provisional`/`TBD`로 유지한다.

참고: [R2 서명 URL의 재사용·PUT/GET·S3 도메인](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [Better Auth DB 세션](https://better-auth.com/docs/concepts/session-management), [anonymous 옵션](https://better-auth.com/docs/plugins/anonymous). 2026-10-16 공식 문서 대조. 구체적인 버전·SDK·adapter는 구현 이슈에서 고정한다.

## 주문 요청 저장·본인 조회 — 시연 계약안

> 공동 검토용 개발 시연 계약이다. 2026-11-03 사용자 확정: 목걸이는 달 1개/좌우 원형 2개, 팔찌 사진은 7칸, 여러 상품/수량을 한 주문으로 저장한다. ‘결제하기’는 실제 결제 없이 저장 성공 후 주문 목록으로 이동한다. 정책 문구/버전은 시연 전용이며 운영 승인은 아니다.

### 제품 구성과 화면 흐름

- 팔찌: 네모 사진 비즈 7칸, 각 칸은 본인 verified 사진 또는 null. 0~7장·같은 사진 반복을 허용한다.
- 목걸이: 원형–달–원형 순서의 3개 구성이다. 사진 커스텀/사진 동의를 받지 않는다. 팔찌의 7칸 규칙을 목걸이에 적용하지 않는다.
- 여러 제품/색/길이 구성을 장바구니에 담고 품목별 수량 1~10을 선택한다. 서로 다른 사진 배치는 서로 다른 품목이다. 시연 상한은 20품목·전체100개다.
- 가시안/옵션 확인과 필요한 사진 동의 → 명시적 ‘결제하기’ → 한 트랜잭션 저장 → `/orders?submitted=<orderId>`. 상태는 REQUESTED/DEMO다. Toss SDK/키/결제 테이블·청구·실제 제작/배송을 도입하지 않는다.
- 현재 구성 그림의 확인 의사를 기록하며 실제 3D 시청 시간을 증명하지 않는다. 구성/사진이 바뀌면 확인을 해제한다. 실패·미인증·타임아웃을 성공으로 표시하거나 주문 목록으로 이동하지 않는다.
- 사진 검사/accept/용량/해상도/임시값 표시는 `GET /api/uploads/photo-rules` 응답을 그대로 따른다. 규칙 수신 전에는 업로드를 막고 자체 WebP/8MB 상수를 사용하지 않는다.
- 사진 원본·서명 URL·토큰은 장바구니 저장소에 보관하지 않는다. verified asset ID는 생성 당시 owner UUID와 묶어 현재 세션이 다르면 제출을 막는다. 게스트→회원 사진 이전은 없다.

### API 입력

`POST /api/orders`는 같은 Origin·application/json·64KiB 이하와 UUID Idempotency-Key를 요구한다. 본문은 `items`만 받는다. 배열 순서는 품목 순서이며 1~20개다. 각 품목은 productSlug/productKind/color/lengthCm/quantity/beadLayout/previewConfirmed와 사진 동의만 허용한다.

```json
{"items":[
  {"productSlug":"light-study-01","productKind":"bracelet","color":"violet","lengthCm":18,"quantity":2,
   "beadLayout":{"squareCount":7,"beads":[
     {"index":0,"photoAssetId":null},{"index":1,"photoAssetId":null},{"index":2,"photoAssetId":null},
     {"index":3,"photoAssetId":null},{"index":4,"photoAssetId":null},{"index":5,"photoAssetId":null},{"index":6,"photoAssetId":null}]},
   "previewConfirmed":true},
  {"productSlug":"light-study-02","productKind":"necklace","color":"blue","lengthCm":45,"quantity":1,
   "beadLayout":{"moonCount":1,"roundCount":2},"previewConfirmed":true}
]}
```

- 서버 시연 카탈로그 `lib/mock/products.json`과 slug/종류/색을 대조한다. 길이는 팔찌16/18/20·목걸이40/45/50cm다. planning 제품의 시연 허용을 실제 판매 가능 상태로 해석하지 않는다. Sanity 실연결은 후속이다.
- 팔찌 index는0..6 정확히 한 번씩, 같은 asset ID 반복 가능. 목걸이는 위 moonCount/roundCount만 받고 서버가 index0 원형/index1 달/index2 원형을 확정한다. 목걸이 사진·7칸 입력·사진 동의는 거절한다.
- 각 품목 previewConfirmed=true 필수. 사진이 있는 팔찌는 photoProductionConsent.accepted=true 필수, 브랜드 공개는 선택/거절 가능하다. 사진 없는 품목은 사진 동의를 넣지 않는다. owner/가격/상태/확인·동의 시각/URL은 입력받지 않는다.
- 동의는 품목에 속하고 해당 구성의 모든 수량에 적용된다. accepted/policyVersion만 제출하며 시각은 서버가 기록한다. 브랜드 동의 생략을 동의로 만들지 않는다.

### 시연 동의 정책

| 종류 | 시연 버전 | 제안 문구 |
|---|---|---|
| 제작 이용 | SUNNY_DEMO_PRODUCTION_V1 | 선택한 사진을 비공개 시연 주문 요청과 가시안 확인에 사용하는 데 동의합니다. 실제 제작·배송은 진행하지 않습니다. |
| 브랜드 공개 | SUNNY_DEMO_BRAND_V1 | 선택한 사진의 브랜드 공개 이용 의사를 시연 기록으로 남기는 데 동의합니다. 이 기록만으로 사진을 공개하지 않습니다. |

위 버전만 개발 시연에 사용하고 EXAMPLE_*·오래된 버전은409 ORDER_POLICY_MISMATCH다. 동의 영수증에 정확한 문구/해시·서버 recordedAt을 보존하며 true이면 acceptedAt=recordedAt, false이면 null이다. 운영 문구·시행일·보관/철회는 TBD이고 이 시연 기록으로 고객 사진을 공개하지 않는다.

### 원자 저장·멱등·RLS

- app.order_checkouts는 주문 묶음, app.orders는 품목, order_beads/order_consents는 품목별 배치/영수증이다. 기존 단건 주문과 0001~0004는 변경하지 않고 0005로 확장한다. 기존 단건 행/동의/사진 참조는 보존하고 조회에서 한 품목짜리 주문으로 보여준다.
- 묶음/모든 품목/수량/7칸 또는3개 배치/동의가 하나의 트랜잭션으로 커밋된다. 품목 하나라도 잘못되면 부분 주문을 남기지 않는다. DB 지연 제약은 품목 수·위치·전체수량, 팔찌7칸, 목걸이3개 모양·사진 없음, 필수 제작 동의를 검사한다.
- owner는 검증한 DB 세션에서만 얻고 모든 부모/자식 FK에 owner를 포함한다. 사진을 중복 제거/정렬해 같은 트랜잭션에서 잠그고 verified·목적·본인 소유·접근 차단 아님을 확인한다.
- 신규 묶음도 ENABLE/FORCE RLS, runtime SELECT/INSERT만 부여한다. UPDATE/DELETE/TRUNCATE/DDL은 금지한다. transaction-local app.user_id를 쓰고 인증 역할의 업무 접근을 허용하지 않는다.
- owner별 같은 멱등 키·정규화된 같은 전체 본문은 같은 주문을200으로 재반환한다(최초201). 수량·품목/순서·사진/동의가 다르면409 ORDER_IDEMPOTENCY_CONFLICT다. 동시 요청은 advisory lock/UNIQUE로 한 묶음만 저장한다.
- 응답 유실/503 후에는 같은 키·같은 본문으로 확인한다. 장바구니는 실패 시 유지하고 같은 내용의 키를 새로 만들지 않는다. 주문 생성 성공을 확인한 뒤 제출한 장바구니 품목만 정리한다.

### 응답과 조회

생성/재호출은 `{order,nextPath,noticeCode:"DEMO_ORDER_REQUEST_APPROVED"}`다. order에는 orderId/status/mode/createdAt/itemCount/totalQuantity/photoCount 및 items가 있다. photoCount는 수량을 곱하지 않은 사진 배치 칸 수다. 각 items에는 itemId/productSlug/productKind/productName/color/lengthCm/quantity/photoCount가 있고, 상세에는 previewConfirmedAt/beadLayout/consents를 추가한다.

목걸이 상세 beadLayout은 `{moonCount:1,roundCount:2,beads:[{index:0,shape:"round",photoAssetId:null},{index:1,shape:"moon",photoAssetId:null},{index:2,shape:"round",photoAssetId:null}]}`다. 팔찌 상세는 squareCount7 및 원래7칸을 반환한다. 기존 단건 시연 기록은 저장 당시의 배치를 그대로 반환한다.

- `GET /api/orders`는 본인 주문 묶음과 기존 단건 기록만 `{items:[요약],nextCursor}`로 반환한다. 기본20/최대50, createdAt DESC/orderId DESC의 검증한 cursor를 사용한다. 알 수 없는/중복 쿼리는400이다.
- `GET /api/orders/[orderId]`는 `{order}` 상세다. 타인/미존재는 같은404 ORDER_NOT_FOUND다. 게스트 세션을 잃거나 회원으로 바뀌면 이전 게스트 주문을 자동 조회/이전하지 않는다.
- 모든 API 응답은 no-store/no-referrer. owner·세션/OAuth 토큰·키·서명 URL·멱등 키·해시를 반환하지 않는다. GET도 DB 세션을 재조회하고 Origin이 있으면 같은 Origin만 허용한다.

### 오류와 활성화

오류는 `{error:{code,message}}`만 반환한다. 400 INVALID_ORDER_REQUEST(구성/수량/본문),401 AUTHENTICATION_REQUIRED,403 ORDER_SESSION_NOT_ELIGIBLE/ORDER_ORIGIN_REJECTED,404 ORDER_NOT_FOUND,409 ORDER_IDEMPOTENCY_CONFLICT/ORDER_PHOTO_NOT_READY/ORDER_POLICY_MISMATCH,413 ORDER_BODY_TOO_LARGE,415 ORDER_CONTENT_TYPE_REJECTED,503 ORDER_SERVICE_UNAVAILABLE를 구분한다. 사진의 없거나/타인/미검증/차단 상태를409의 같은 코드로 숨긴다. SQL/저장소 원본 예외는 노출하지 않는다.

시연은 AUTH_ENABLED와 ORDER_DEMO_ENABLED를 명시한 개발 loopback만 허용한다. production/원격 주소는 강제 차단하며 공개 서비스 활성화·실제 DB 적용/배포는 별도 검토다. 사진 API/공유 남용 제한·운영 카탈로그/정책·실제3D 검증은 기존 후속 조건을 유지한다. 목걸이/장바구니/버튼 사용자 확정이 운영 동의 정책의 확정을 의미하지 않는다.

## 변경 이력

- 2026-11-03: PR #92 인증 정본 추가 — 구현 API·표시 DTO·DB 세션/쿠키·Origin·오류와 미구현/운영 미합의 항목 구분
- 2026-11-03: 사용자 확정 반영 — 목걸이 달1/원형2, 여러 품목/수량의 원자 주문, photo-rules 기준 검사, 결제하기→주문 목록 시연

- 2026-11-02: PR #65 2차 리뷰 반영 — 타인 접근 404 통일, 미수신 409, rejected·503 재호출 규칙, 인증 대조 결과와 사진 계약 우선 머지 순서 반영
- 2026-10-16: PR #65 최신 main 충돌 해소안 — Better Auth 회원/게스트 경계, private R2의 재사용 가능한 PUT/GET, 동일 바이트 검증·별도 verified 객체·복구/정리, 서버 동의 시각 기록으로 정렬 (공동 합의 전)
- 2026-10-04: PR #65 리뷰 반영 — 7칸 사진 배치, 검사 중 재시도, presign 계정별 상한, 3D 가시안 조회 URL 용도 명시
- 2026-09-24: #26 커스텀 사진 업로드 계약 검토 초안 추가 (정책값·보관 기간 합의 전)
- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
