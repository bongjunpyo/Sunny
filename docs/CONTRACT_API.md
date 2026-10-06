# 계약 — 화면 ↔ 서버 API ↔ Sanity · Supabase

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
   ├──▶ Supabase          비공개 데이터: 주문 요청 · 선호 색상 설문 (접근 정책 적용)
   └──▶ 기상청 API         자외선지수
```

**브라우저는 Sanity·Supabase·기상청을 직접 부르지 않는다.** 전부 서버 API를 거친다. 키가 브라우저로 새지 않게 하는 구조다.

## mock 먼저

서버와 데이터가 준비되기 전에도 화면을 만든다.

| `NEXT_PUBLIC_API_MODE` | `frontend/lib/api.ts`가 하는 일 |
|---|---|
| 없음 · `mock` (기본) | `frontend/lib/mock/*.json`을 읽어 돌려준다 |
| `api` | `/api/*`를 호출한다 |

**규칙: 이 문서의 응답 예시 = `lib/mock/*.json` = 서버 API 실제 응답.** mock에서 api로 바꾸는 날 준표가 셋을 대조한다.

## 불변식

1. **서버 전용 키는 브라우저에 가지 않는다** — `NEXT_PUBLIC_` 금지, 서버 API 안에서만 읽는다
2. **Supabase `service_role` 키는 서버 API에서도 꼭 필요한 곳에만** 쓴다. 기본은 `anon` 키 + 접근 정책(RLS)
3. **주문·설문 테이블은 RLS 없이 만들지 않는다.** 주문 요청의 이름·연락처·사진은 개인정보다
4. **공개 콘텐츠의 정본은 Sanity, 주문·설문의 정본은 Supabase.** 같은 데이터를 두 곳에 두지 않는다
5. **자외선지수를 못 받아오면 오류를 숨기지 않는다** — 마지막으로 받은 값과 갱신 시각, 안내 문구를 함께 준다

## 채워야 할 것

- [ ] **제품** (Sanity) — 종류 `bracelet` \| `necklace`, 이름, 비즈 구성, 사진, 설명
- [ ] **비즈 · 광변색** — 색상: 기획서 수정본 기준 **빨강·주황·파랑·노랑·보라 5색** / 농도 저·중·고. (`web-demo/lib/bead.ts`는 3색 견본이다 — 확정 시 errata)
- [ ] **제작 기록** (Sanity) — 제목, 날짜, 단계(모델링·몰드·성형·전사·도포·조립), 사진, 본문
- [ ] **주문 요청** (Supabase) — 필드, 이용 동의 항목, RLS 정책
- [ ] **선호 색상 설문** (Supabase) — 문항, 익명 여부, RLS 정책
- [ ] **자외선지수** — `GET /api/uv` 응답 형태, 지역 기준, 캐시 주기, 실패 응답
- [ ] 공통 에러 응답 형태 — `{ error: { code, message } }` 여부
- [ ] 엔드포인트 목록과 각 응답 JSON 예시

## 엔드포인트 (초안 — 확정 전)

| 메서드 · 경로 | 용도 | 정본 |
|---|---|---|
| `GET /api/products` | 컬렉션 목록 (`?kind=bracelet\|necklace`) | Sanity |
| `GET /api/products/[slug]` | 제품 상세 | Sanity |
| `GET /api/archive` | 제작 기록 목록 | Sanity |
| `GET /api/uv` | 현재 자외선지수 | 기상청 |
| `POST /api/auth/guest` | 비회원 주문용 익명 세션 시작 | Supabase Auth |
| `POST /api/auth/signup` | 이메일 가입 또는 현재 비회원의 가입 전환 | Supabase Auth · 회원 동의 기록 |
| `POST /api/auth/login` | 이메일·비밀번호 로그인 | Supabase Auth |
| `GET /api/auth/session` | 현재 회원·비회원 세션 조회 | Supabase Auth · 회원 표시 정보 |
| `POST /api/auth/logout` | 현재 브라우저 세션 종료 | Supabase Auth |
| `GET /api/auth/kakao/start` | 카카오 로그인 시작 | Supabase Auth OAuth |
| `GET /api/auth/kakao/callback` | 인증 코드 교환·쿠키 발급 | Supabase Auth OAuth |
| `POST /api/auth/password-reset/request` | 재설정 메일 요청 | Supabase Auth |
| `GET /api/auth/password-reset/callback` | 재설정 코드 교환 | Supabase Auth |
| `POST /api/auth/password-reset/confirm` | 새 비밀번호 설정 | Supabase Auth |
| `POST /api/orders/guest/lookup/request` | 비회원 주문 조회 인증 코드 요청 | Supabase · 메일 제공자 |
| `POST /api/orders/guest/lookup/confirm` | 인증 코드 확인 후 주문 조회 | Supabase |
| `POST /api/orders` | 커스텀 주문 요청 | Supabase |
| `POST /api/survey` | 선호 색상 설문 | Supabase |

## 회원 인증·비회원 주문 계약 — #70 합의 초안

> **팀장 결정:** 비회원 주문과 사진 업로드를 허용한다. 카카오 로그인과 비밀번호 재설정도 이번 계약에 포함한다. 아래의 구체적인 방식과 수치는 봉준표·이재원이 이 계약 PR에서 합의할 제안이다. 계약 머지 전에는 인증·주문·업로드 API를 운영에 열지 않는다.

### 신원과 소유권

- 비회원은 Next 서버의 `POST /api/auth/guest`를 통해 Supabase Auth `signInAnonymously()`로 **익명 사용자 ID**를 받는다. 브라우저에 Supabase 토큰을 반환하지 않고 서버가 HttpOnly 세션 쿠키를 발급한다. 별도 자체 비회원 ID·세션 저장소는 만들지 않는다. 익명 사용자와 정회원은 모두 `auth.users.id`를 소유자 ID로 쓰므로 `orders.user_id`는 `NOT NULL`을 유지한다.
- 익명 로그인 사용자는 DB에서 `authenticated` 역할이다. 주문·사진은 검증된 `auth.uid()`와 소유자 ID의 일치를 검사하고, 회원 전용 설문·계정 기능은 JWT의 `is_anonymous`도 확인한다. `anon` API 키의 권한과 익명 **사용자**의 권한을 혼동하지 않는다.
- 모든 주문·사진 API는 Next 서버가 매 요청의 Supabase 사용자를 확인한다. `userId`·`ownerId`·`isAnonymous`를 요청 본문에서 받아 권한 판단에 쓰지 않는다. 사진은 서버가 `assetId`의 소유자와 `verified` 상태를 확인한 뒤 주문에 연결한다. 사용자 컨텍스트의 Supabase 클라이언트와 RLS를 기본으로 쓰고, 비밀 키를 쓰는 검증·메일 작업은 최소 범위로 격리한다.
- 비회원은 쿠키를 잃거나 다른 기기로 옮기면 익명 세션을 복구할 수 없다. 이때 주문번호만으로 주문을 보여주지 않고 아래 비회원 조회 절차를 사용한다.
- 익명 계정 발급 전 CAPTCHA/Turnstile 검증을 적용하고, IP 기준 발급 상한도 둔다. 현재 Supabase 익명 로그인에는 남용으로 사용자가 대량 생성될 위험이 있다. 사용하지 않는 익명 계정 정리 주기와 주문·사진을 보유한 계정의 삭제 예외는 데이터 보관 정책과 함께 #69 후속 마이그레이션에서 확정한다.

### 서버 전용 세션 제안

| 항목 | 제안 |
|---|---|
| 라이브러리 | 이미 설치된 `@supabase/supabase-js`의 **서버 전용** Auth 클라이언트와 요청별 쿠키 저장 어댑터를 사용한다. `@supabase/ssr`의 통상적인 브라우저·서버 공유 세션은 HttpOnly 조건과 맞지 않아 이번 계약에서는 추가하지 않는다. 구현 전에 토큰 회전·동시 요청·OAuth 콜백을 검증한다. |
| 갱신 위치 | 보호 API가 요청마다 서버에서 세션을 복원·갱신하고, 회전된 토큰을 같은 응답의 `Set-Cookie`로 함께 갱신한다. `proxy`에서 전역 갱신하지 않는다. `GET /api/auth/session`도 이 경로를 사용한다. |
| 쿠키 | `sunny-at`(access)와 `sunny-rt`(refresh)를 **별도** 쿠키로 둔다. 둘 다 `HttpOnly; SameSite=Lax; Path=/`; HTTPS 배포에서는 `Secure`, HTTP localhost 개발에서는 `Secure`를 쓰지 않는다. `Domain`은 지정하지 않는다. 세션·비회원 응답에는 `Cache-Control: no-store`를 붙인다. |
| 만료 | `sunny-at`의 `Max-Age`는 Supabase access JWT의 남은 유효 시간 이내. `sunny-rt`는 **7일 절대 수명 제안**이며 Supabase 세션 제한을 이보다 길지 않게 맞춘다. 이 수치는 팀 합의 전 운영값이 아니다. 만료·폐기된 refresh 토큰은 쿠키를 모두 제거하고 보호 API에서 401로 처리한다. |
| 로그아웃 | 현재 브라우저의 Supabase 세션을 폐기하고 두 쿠키를 같은 속성으로 만료시킨다. 다른 기기 세션은 유지한다. 비회원 로그아웃 후에는 이전 주문·사진에 대한 세션 접근이 사라진다. |

Supabase의 `@supabase/ssr` 기본 설명은 브라우저 클라이언트가 refresh 토큰을 읽는 구성을 전제로 한다. 따라서 패키지 이름만 바꾸거나 `HttpOnly` 옵션만 붙여 이 계약을 충족했다고 간주하지 않는다. 모든 인증 요청은 Next API를 거치며, 브라우저의 `localStorage`·JS 쿠키·응답 JSON·URL fragment에 access/refresh 토큰을 두지 않는다. OAuth·메일 콜백 URL의 일회용 **인증 코드**는 Next 서버가 교환한 뒤 URL에서 제거한다.

쿠키를 자동 전송하는 상태 변경 요청은 `Origin`을 정확한 허용 출처와 비교하고, 없거나 다르면 `403 ORIGIN_NOT_ALLOWED`로 거절한다. 로컬·미리보기·운영 출처는 배포 환경별 허용 목록으로 관리하며 임의의 `*.vercel.app`을 전체 허용하지 않는다. OAuth·메일의 GET 콜백은 일회용 코드와 `state`/PKCE로 별도 검증한다. 로그인·가입·익명 발급·재설정·비회원 조회에는 IP와 계정 식별자별 호출 제한을 적용한다. 제한 수치의 정본은 운영 정책 합의 전 `TBD`다.

### 회원 가입·로그인·세션 API

| 요청 | 입력 | 성공 응답 | 실패 및 화면 동작 |
|---|---|---|---|
| `POST /api/auth/guest` | CAPTCHA 검증 결과 | `201 {"guest":true}` + 쿠키 | 제한 시 429와 `Retry-After`; 화면은 주문 시작을 잠시 중단 |
| `POST /api/auth/signup` | `email`, `password`, `nickname`, `consents` | `202 {"status":"email_confirmation_required"}` | 형식 오류 400; 기존 계정 여부를 응답으로 단정하지 않음. 이메일 확인 안내 |
| `POST /api/auth/login` | `email`, `password` | `200 {"member":{"email":"person@example.invalid","nickname":"햇살"}}` + 쿠키 | `401 INVALID_CREDENTIALS`는 이메일 존재 여부를 숨김. 화면은 같은 오류 문구 사용 |
| `GET /api/auth/session` | 쿠키 | `200 {"member":null,"guest":false}` 또는 회원/비회원 객체 | 만료 쿠키를 제거하고 로그인 화면 상태로 전환. 네트워크 장애는 미로그인으로 단정하지 않음 |
| `POST /api/auth/logout` | 쿠키 | `204` (본문 없음) + 쿠키 만료 | 실패 시 화면이 성공으로 단정하지 않고 재시도 안내 |

`GET /api/auth/session`의 회원 응답 예시:

```json
{"member":{"email":"person@example.invalid","nickname":"햇살"},"guest":false}
```

비회원 응답은 `{"member":null,"guest":true}`다. 보호 API는 세션이 없거나 만료되면 `401 AUTHENTICATION_REQUIRED`, 유효한 세션이지만 다른 소유자 자산이나 회원 전용 기능에 접근하면 `403 ACCESS_DENIED`를 반환한다. `/account`는 회원만 보여주고 비회원·미로그인은 로그인 안내로 보낸다. `GET /api/auth/session`의 공개 상태 조회와 보호 API의 401을 구분한다.

가입 요청과 응답 예시:

```json
{"email":"person@example.invalid","password":"<입력한 비밀번호>","nickname":"햇살","consents":{"terms":{"accepted":true,"policyVersion":"TBD"},"privacy":{"accepted":true,"policyVersion":"TBD"},"marketing":{"accepted":false,"policyVersion":"TBD"}}}
```

```json
{"status":"email_confirmation_required"}
```

서버는 필수 동의 둘이 `true`인지 검사한다. 브라우저가 보낸 `acceptedAt`은 받지 않고 서버 수신 시각을 기록한다. 정책 버전은 배포된 동의 문구와 서버가 대조한다. 회원 존재 여부를 숨기기 위해 이미 등록된 이메일의 가입 요청도 같은 안내 응답을 사용한다.

가입 시 이메일 확인을 요구하고 확인 전에는 정회원 세션으로 전환하지 않는다. 익명 세션에서 새 이메일로 가입하면 `signUp()`으로 별도 계정을 만들지 않고 해당 익명 사용자에 이메일 신원을 연결하고 확인 후 비밀번호를 설정해 **동일한 사용자 ID**를 유지한다. 확인 전에는 기존 익명 세션으로만 주문에 접근한다. 그 ID에 묶인 주문·사진은 별도 소유권 이전 없이 계정에 남는다. 카카오도 새 신원이라면 같은 익명 사용자에 연결한다. 이미 존재하는 계정으로 로그인하는 경우에는 주문·사진을 자동 이전하지 않는다. 비회원은 아래 조회 절차를 계속 사용할 수 있고, 기존 계정으로의 이전은 별도 소유권 증명·마이그레이션 계약 없이는 제공하지 않는다.

`nickname`은 표시 정보다. 가입 필수 약관·개인정보 처리 동의와 선택 마케팅 동의는 각각 `accepted`, `policyVersion`, **서버 기록 시각**을 저장한다. 마케팅 거부도 기록하고 사진 제작·브랜드 공개 동의와 섞지 않는다. 별명과 현재 동의 상태는 `public.profiles`, 동의 변경 이력은 별도 `member_consent_events`에 저장하는 안을 제안한다. 사용자가 바꿀 수 있는 `user_metadata`만을 동의 증빙의 정본으로 삼지 않는다. 테이블·RLS·삭제 정책은 #69의 허용 범위 밖이므로 **별도 back 인증 스키마 이슈**에서 만든다. 동의 문구·정책 버전·보관 기간은 `TBD`로 두고 확정 전 가입 API를 운영에 열지 않는다.

화면의 API 모드 함수 계약은 `signIn(email, password): Promise<Member>`, `signUp(email, password, nickname, consents): Promise<{status:"email_confirmation_required"}>`, `getMember(): Promise<Member|null>`, `signOut(): Promise<void>`다. `getMember`는 `GET /api/auth/session`을 호출한다. 추가로 카카오 시작, 재설정 요청·확정, 비회원 주문 조회 함수가 필요하다. 현재 mock 함수·호출 화면 수정은 팀장의 후속 화면 이슈에서 한다.

### 카카오 로그인

1. 브라우저는 `GET /api/auth/kakao/start`로 이동한다. Next 서버가 OAuth `state`와 PKCE verifier를 시작 요청의 짧은 수명 HttpOnly 쿠키에 연결한 뒤 Supabase Auth를 통해 카카오로 돌려보낸다.
2. 카카오는 **Supabase Auth의 제공자 콜백 URL**로 돌아오고, Supabase는 허용 목록의 `redirectTo`인 `https://<해당 배포 호스트>/api/auth/kakao/callback`으로 일회용 코드를 보낸다. Next 콜백은 `state`·PKCE 및 허용 출처를 확인하고 코드를 서버에서 교환한 뒤 세션 쿠키를 발급한다. 브라우저에는 토큰을 반환하지 않는다.
3. Next 콜백은 성공 시 `/account`, 취소·거부·검증 실패 시 `/login`으로 돌려보내고 일반 오류 메시지만 표시한다. 임의 `next` URL이나 미등록 호스트로 리디렉션하지 않는다.

개발 `http://localhost:3000/api/auth/kakao/callback`, Vercel 미리보기의 **실제 호스트별** HTTPS 콜백, 운영 HTTPS 콜백을 Supabase redirect 허용 목록에 등록한다. Vercel 미리보기 호스트가 바뀌면 등록·검증된 호스트에서만 카카오를 켠다. 카카오 개발자 설정에는 Supabase 프로젝트의 Auth 콜백 URL을 등록한다. 동일한 **검증된 이메일**의 이메일 계정은 Supabase의 안전한 identity linking 결과를 확인해 연결하고, 확인되지 않은 이메일은 자동 합치지 않는다. 카카오가 이메일을 제공하지 않으면 이번 계약에서는 가입·로그인을 완료하지 않고 이메일 동의 안내 후 로그인 화면으로 돌린다. 이메일이 있는 신규 카카오 사용자는 별명·필수/선택 동의 입력을 마친 뒤 회원 기능을 연다. 이 단계가 끝나지 않은 계정은 주문·사진 API를 사용하지 못한다.

카카오 REST API 키와 client secret은 Supabase Auth 제공자 설정의 서버 측 비밀값으로 둔다. Next 코드가 직접 읽지 않는 구성이라면 새 `KAKAO_*` 환경변수를 임의로 만들지 않는다. 직접 연동으로 바꾸려면 `backend/README.md`의 환경변수 이름과 `frontend/.env.example`을 **별도 허용 범위의 이슈·PR**에서 합의한다. 어떤 경우에도 secret에 `NEXT_PUBLIC_`을 붙이지 않는다.

### 비밀번호 재설정

`POST /api/auth/password-reset/request`는 `{ "email": "person@example.invalid" }`을 받고 계정 존재 여부와 관계없이 `202 {"status":"if_account_exists_email_sent"}`를 반환한다. IP·이메일별 요청 상한과 같은 응답 시간을 적용한다. 메일 링크는 등록된 `GET /api/auth/password-reset/callback`으로 돌아오며, Next 서버가 일회용 코드를 교환해 **재설정 전용** 짧은 수명 HttpOnly 쿠키를 발급한다. 이 쿠키만으로 주문·사진 API를 호출할 수 없다.

`POST /api/auth/password-reset/confirm`은 `{ "newPassword": "<새 비밀번호>" }`를 받고 성공 시 `204`와 재설정 쿠키 만료를 반환한다. 링크 만료·재사용은 `400 RESET_LINK_INVALID`, 요청 제한은 `429`와 `Retry-After`로 처리한다. 링크 수명, 요청 상한, 비밀번호 정책은 Supabase 설정과 함께 `TBD`다. **제안:** 재설정 성공 후 기존 모든 세션을 무효화하고 새 로그인으로 복귀한다. Supabase에서 전역 세션 폐기 방법과 필요한 최소 권한을 구현 이슈에서 검증한다.

### 비회원 주문 조회와 보관

비회원은 주문번호와 **주문 당시 확인한 이메일로 발송한 일회용 코드**를 함께 증명한다. 주문 생성 시 이메일을 필수로 받고 주문 확정 전에 그 이메일의 접근 가능 여부를 확인한다. 이 필드와 확인 기록은 #69 주문 스키마에 추가 검토가 필요하다. 메일 제공자도 현재 스택에 없으므로 구현 이슈에서 서비스·발송 상한·환경변수 이름을 제안해야 한다. `POST /api/orders/guest/lookup/request`의 입력은 `{ "orderNumber":"EXAMPLE-ORDER","email":"person@example.invalid" }`, 응답은 일치 여부와 무관하게 `202 {"status":"if_match_code_sent"}`다. `POST /api/orders/guest/lookup/confirm`은 같은 주문번호·이메일과 `code`를 받아 성공 시 필요한 주문 상태만 `200`으로 반환한다. 잘못된 조합·만료 코드는 같은 `400 LOOKUP_FAILED`로 처리한다. 코드 만료·재사용 방지와 IP·주문번호·이메일별 시도 상한을 둔다. **제안 수치:** 코드 10분, 확인 5회 실패/15분 이후 `429`와 `Retry-After`; 팀 합의 전 운영값은 아니다.

비회원과 회원의 수령 정보·동의 기록은 **같은 보관·삭제 기준**을 적용하되 실제 기간과 법적 보존 근거는 `TBD`다. 익명 사용자 정리는 주문·사진·보존 중인 동의 기록을 먼저 확인해야 한다. 현재 `orders.user_id ON DELETE RESTRICT`이므로 계정 삭제·기록 보존·익명 사용자 정리를 #69 후속 설계에서 함께 결정한다. 기간이 정해지기 전에는 주문 API를 운영에 열지 않는다.

### #65·#69와 구현 이슈의 경계

| 대상 | 계약 머지 후 반영할 내용 |
|---|---|
| 사진 계약 PR #65 | `presign`·`complete`·`read-url`의 "로그인 사용자"를 **정회원 또는 서버가 검증한 익명 사용자**로 고친다. 최근 60분 20개 presign 상한은 사용자 ID마다 동일하게 적용하고, 익명 ID 재발급을 통한 우회는 CAPTCHA·IP 제한으로 보완한다. 자산 소유권은 주문 시에도 다시 확인한다. #70 머지 뒤 #65 브랜치에 `origin/main`을 merge한다. |
| DB 이슈 #69 | `orders.user_id NOT NULL` 유지 제안. 익명 사용자도 `auth.users.id`가 있다. 비회원 조회용 주문번호·확인 이메일·검증 기록을 주문 스키마에 검토한다. RLS에서는 회원/익명을 필요에 따라 구분하고, 사진 소유권·동의·보관이 확정되기 전 쓰기 권한을 열지 않는다. `survey_responses`는 회원 전용으로 둔다. |
| 별도 back 인증 스키마·API 이슈 | `profiles`·동의 이력, 익명 계정 정리, 쿠키 어댑터, 인증·카카오·재설정·비회원 조회 구현의 허용 파일을 적는다. `@supabase/ssr`을 다시 제안한다면 HttpOnly 조건 충족 방식과 라이브러리 추가 승인을 먼저 문서화한다. |
| 팀장 화면 후속 이슈 | `frontend/lib/auth.ts`와 호출 화면을 위 입력·반환 계약에 맞춘다. mock 모드의 별도 저장 값은 API 모드에서 사용하지 않는다. |

공통 오류 JSON은 `{ "error": { "code": "AUTHENTICATION_REQUIRED", "message": "로그인이 필요합니다." } }` 형태를 제안한다. 오류 응답·로그·메일에는 토큰, 내부 Storage 경로, 고객 사진·연락처를 넣지 않는다.

## 변경 이력

- 2026-10-06: #70 인증·비회원 주문·카카오·재설정 계약 제안 추가 (팀장 합의 전)
- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
