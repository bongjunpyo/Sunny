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
- [ ] **회원·비회원 인증** — 아래 #70 검토안 합의, 동의 정책·후속 이슈 연결
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
| `POST /api/auth/signup` | 이메일·비밀번호 가입 | Supabase Auth |
| `GET /api/auth/email/callback` | 가입·이메일 전환 코드 확인 | Supabase Auth |
| `POST /api/auth/login` | 이메일·비밀번호 로그인 | Supabase Auth |
| `GET /api/auth/session` | 현재 회원·비회원 세션 조회 | Supabase Auth · profiles |
| `POST /api/auth/logout` | 현재 브라우저 세션 종료 | Supabase Auth |
| `POST /api/auth/profile/complete` | 별명·가입 동의 완료 | Supabase |
| `POST /api/auth/guest/upgrade/request` | 비회원의 이메일 신원 연결 | Supabase Auth |
| `POST /api/auth/guest/upgrade/confirm` | 확인 후 비밀번호 설정·회원 전환 | Supabase Auth |
| `GET /api/auth/kakao/start` | 카카오 로그인·비회원 신원 연결 시작 | Supabase Auth OAuth |
| `GET /api/auth/kakao/callback` | 인증 코드 교환·쿠키 발급 | Supabase Auth OAuth |
| `POST /api/auth/password-reset/request` | 재설정 메일 요청 | Supabase Auth |
| `GET /api/auth/password-reset/callback` | 재설정 코드 교환 | Supabase Auth |
| `POST /api/auth/password-reset/confirm` | 새 비밀번호 설정·세션 종료 | Supabase Auth |
| `POST /api/orders/guest/lookup/request` | 비회원 조회 인증 코드 요청 | Supabase · 거래 메일 |
| `POST /api/orders/guest/lookup/confirm` | 코드 확인 후 해당 주문 상태 조회 | Supabase |
| `POST /api/orders` | 커스텀 주문 요청 | Supabase |
| `POST /api/survey` | 선호 색상 설문 | Supabase |

## 회원 인증·비회원 주문 계약 — #70 검토안

> **팀장 확정:** 비회원 주문·사진 업로드를 허용하며, 카카오 로그인·비밀번호 재설정을 이번 계약에 포함한다.
>
> **검토 중:** 아래 구현 방식·정책 수치는 이재원의 제안이다. 봉준표·이재원이 같은 계약 PR에서 합의한다. API·화면·DB 구현은 후속 이슈에서 진행한다. 기간·정책 버전이 `TBD`인 기능은 운영에 열지 않는다.

### 1. 비회원 신원과 소유권

비회원 식별은 **Next 서버가 Supabase 익명 로그인으로 만든 `auth.users.id`**를 사용한다. 기존 회원과 같은 사용자 ID·RLS·자산 소유권 검사를 쓸 수 있고, 새 계정으로 가입할 때 ID를 유지할 수 있어 자체 비회원 세션 저장소보다 구현 범위가 작다. 브라우저는 Supabase Auth를 직접 호출하지 않는다.

- `POST /api/auth/guest`는 서버에서 `signInAnonymously()`를 호출하고 HttpOnly 세션 쿠키만 발급한다. 이미 유효한 회원·비회원 세션이 있으면 새 ID를 만들지 않는다.
- Supabase 익명 사용자는 DB에서 `authenticated` 역할이다. 회원 전용 기능은 검증된 JWT의 `is_anonymous`와 회원 프로필 완료 상태도 확인한다. API 키의 `anon` 역할과 익명 사용자를 구분한다.
- `orders.user_id`와 사진의 소유자 ID는 `NOT NULL`인 Supabase 사용자 ID다. 요청 본문의 `userId`·`ownerId`·`isAnonymous`는 권한 판단에 쓰지 않는다.
- Next API가 요청별 Auth 클라이언트를 만들고 `auth.getUser()`로 서버에서 사용자를 확인한다. 쿠키에서 복원한 `getSession()`의 사용자 객체만으로 승인하지 않는다. 검증된 사용자의 access JWT를 Supabase Data API에 전달해 RLS의 `auth.uid()`가 같은 ID를 보도록 한다.
- `presign`·`complete`·`read-url`·주문 제출 모두 소유자를 확인한다. 주문 서버는 각 `assetId`의 소유자·`verified` 상태를 다시 확인한다. 정회원과 비회원 모두 본인 자산만 사용한다.
- 비회원 세션은 쿠키 삭제·로그아웃·다른 기기로 복구할 수 없다. 주문번호와 이메일 인증 코드를 사용하는 아래 조회 절차가 별도로 필요하다.

익명 세션을 발급하기 전 CAPTCHA를 검사한다. IP 제한과 사용자 ID별 업로드 제한을 함께 적용해 ID 재발급으로 presign 상한을 우회하지 못하게 한다. 익명 계정 정리는 주문·사진·보존 중인 동의가 없는 계정만 대상으로 한다. 보관 기간과 정리 실행 주체는 #69의 보관 계약에서 확정하며, 현재 초안의 `orders.user_id ON DELETE RESTRICT`를 피해 무조건 계정을 삭제하지 않는다.

### 2. 세션 라이브러리·갱신·쿠키

**제안: `@supabase/ssr`의 `createServerClient`를 Next Route Handler에서만 사용한다.** SDK가 세션 직렬화·쿠키 분할·refresh 토큰 회전을 맡게 한다. 브라우저용 `createBrowserClient`는 만들지 않고 화면은 Next API만 호출한다. 이 구성에서 서버의 `getAll`·`setAll`은 HttpOnly 쿠키를 읽고 쓸 수 있다.

`@supabase/ssr`은 아직 설치되어 있지 않다. 이 계약 PR에서 추가를 제안하며, 승인 후 서버 구현 이슈의 허용 파일에 `frontend/package.json`·`frontend/package-lock.json`을 넣고 호환 버전을 함께 고정한다. 이번 문서 PR에서는 설치하지 않는다.

| 쿠키·항목 | 제안 |
|---|---|
| 일반 세션 | 이름 `sunny-session`. access/refresh 토큰을 SDK의 **하나의 세션 레코드**에 함께 담는다. 크기가 크면 `sunny-session.0`, `.1` 등으로 SDK가 나눈다. 토큰마다 직접 쿠키를 분리·재조립하지 않는다. |
| 일반 속성 | 모든 세션 조각에 `HttpOnly; SameSite=Lax; Path=/`, `Domain` 미지정. HTTPS 미리보기·운영에서는 `Secure`, HTTP localhost에서만 `Secure`를 끈다. |
| 일반 수명 | 브라우저 저장은 마지막 성공 갱신부터 **7일 Max-Age 제안**. 삭제 옵션의 `Max-Age=0`을 덮어쓰지 않는다. 이는 브라우저 보관 기간이며 서버 세션의 절대 수명과 다르다. access JWT 만료는 Supabase 설정 `exp`를 검증한다. 운영 JWT 수명·서버 절대 세션 제한은 구현 전 별도로 확인하며, 유료 플랜의 시간 제한 기능을 사용한다고 가정하지 않는다. |
| PKCE·진행 정보 | SDK의 `sunny-session` 기반 PKCE verifier 쿠키와 서버가 서명한 `sunny-auth-flow`를 사용한다. `sunny-auth-flow`는 목적·일회용 흐름 ID·예상 사용자/이메일·안전한 복귀 경로·만료를 묶는다. OAuth는 10분, 메일 확인은 1시간 수명 제안. 비밀번호·토큰을 진행 정보에 넣지 않는다. |
| 재설정·비회원 전환 | `sunny-recovery`와 `sunny-upgrade`라는 별도 SDK 저장 키와 서명된 목적 정보를 사용한다. 콜백 성공 뒤 15분 수명 제안. 일반 보호 API는 이 쿠키를 인증에 쓰지 않는다. |
| 갱신 위치 | **각 API의 공통 서버 인증 함수**에서 확인·필요 시 갱신한다. SDK가 내보낸 모든 `Set-Cookie`를 성공·실패·리디렉션 응답에 보존한다. 지금 화면은 세션 조회 API를 호출하므로 `proxy`에 전역 갱신을 넣지 않는다. |
| 로그아웃 | `signOut({scope:"local"})`로 현재 세션의 refresh 토큰을 폐기하고 세션·PKCE·진행·전환 쿠키와 모든 조각을 같은 속성으로 지운다. 다른 기기 세션은 유지한다. |

세션 클라이언트와 사용자 상태를 모듈 전역에서 공유하지 않는다. 인증·회원·비회원 조회 응답에는 `Cache-Control: private, no-store`를 적용한다. 동시 refresh 요청과 조각 수 변경, 리디렉션 시 쿠키 전달, 두 사용자 간 격리는 서버 구현 이슈의 필수 검증이다.

재설정·이메일 전환은 시작 요청과 콜백이 같은 전용 SDK 저장 키를 사용해 PKCE verifier를 공유한다. 전환 시작은 서버가 확인한 현재 익명 세션을 전용 클라이언트에 전달하고, 콜백 뒤에도 사용자 ID가 같은지 검사한다. 일반 세션으로의 승격은 완료 API에서만 한다. 흐름 ID의 소모·재사용 방지는 서버에 기록하며, 서로 다른 인증 흐름이 겹치면 먼저 시작한 흐름을 취소하고 재시작을 안내한다.

로그아웃은 브라우저의 접근을 종료하고 refresh 토큰을 폐기하지만 이미 발급한 access JWT는 `exp`까지 남을 수 있다. 즉시 모든 JWT를 무효화했다고 설명하지 않는다. 비밀번호 재설정에서도 같은 제한을 적용한다.

### 3. 요청 보호·호출 제한

HttpOnly는 JS의 토큰 읽기를 막지만 브라우저는 쿠키를 자동 전송한다. 상태 변경 JSON API는 `Content-Type: application/json`과 **같은 출처의 Origin**을 요구하고 없거나 다르면 `403 ORIGIN_NOT_ALLOWED`로 거절한다. 출처는 신뢰하는 배포 설정과 정확히 비교하며, 임의 Host/Forwarded 헤더나 전체 `*.vercel.app`에서 허용 목록을 만들지 않는다. OAuth·메일 콜백은 GET이므로 아래의 일회용 흐름·PKCE 검증을 적용한다.

다음은 **리뷰용 제한 수치**이며 합의 전 운영값이 아니다. 여러 서버 인스턴스에서 같은 원자적 집계를 사용한다. 존재하지 않는 계정·주문에도 같은 기준을 적용하고, 계정 식별자와 IP 원문을 오류·로그에 남기지 않는다.

| 대상 | 상한 제안 | 실패 |
|---|---|---|
| 익명 ID 발급 | IP당 최근 60분 10개 + CAPTCHA | 429, `Retry-After` |
| 로그인 | IP+정규화 이메일 조합당 최근 15분 10회, IP 전체 상한은 운영 환경에서 합의 | 429; 이메일 유무와 같은 모양 |
| 가입·이메일 전환 | 이메일당 최근 60분 5회, IP당 20회 | 429 |
| 재설정 메일 | 이메일당 최근 60분 3회, IP당 10회; 재요청 60초 대기 | 429 |
| 비회원 조회 메일 | 주문번호+이메일 조합당 최근 60분 3회, IP당 10회; 재요청 60초 대기 | 429 |
| 비회원 조회 확인 | challenge당 5회 실패로 폐기, IP당 최근 15분 20회 | 400 `LOOKUP_FAILED` 또는 IP 제한 429 |

상한에 도달하면 다음 요청 가능 시간까지의 초를 `Retry-After`로 준다. 화면은 자동 재요청하지 않는다. 메일 제공자·Supabase의 실제 상한이 더 낮으면 그 제한도 적용한다. 비밀번호 정책·운영 IP 전체 상한은 `TBD`로 PR에서 합의한다.

### 4. 이메일 가입·로그인·현재 세션·로그아웃

| 요청 | 성공 | 화면 동작 |
|---|---|---|
| `POST /api/auth/signup` | 202 `email_confirmation_required` | 이메일 확인 안내. 기존 이메일에도 같은 응답; 확인 전 회원 기능을 열지 않음 |
| `GET /api/auth/email/callback` | 303 안전한 화면 경로 | 서버가 코드 교환·이메일 확인 후 쿠키 발급. 성공은 `/account` 또는 프로필 완료 안내, 만료/다른 브라우저는 다시 확인 안내 |
| `POST /api/auth/login` | 200 회원 객체 + 쿠키 | 회원 화면으로 이동. 프로필·동의 미완료면 `profile_required` 상태 |
| `GET /api/auth/session` | 200 상태 객체 | 미로그인·비회원·프로필 미완료·회원 구분 |
| `POST /api/auth/logout` | 204, 본문 없음 | 서버 성공 후 회원 상태 제거. 실패는 재시도 안내 |
| `POST /api/auth/profile/complete` | 200 회원 객체 | 신규 카카오 사용자의 별명·가입 동의 저장 후 회원 기능 활성화 |

`POST /api/auth/signup` 요청:

```json
{
  "email": "person@example.invalid",
  "password": "<입력한 비밀번호>",
  "nickname": "햇살",
  "consents": {
    "terms": {"accepted": true, "policyVersion": "TBD"},
    "privacy": {"accepted": true, "policyVersion": "TBD"},
    "marketing": {"accepted": false, "policyVersion": "TBD"}
  }
}
```

응답 `202`:

```json
{"status": "email_confirmation_required"}
```

가입은 서버에서 이메일 확인을 요구한다. 새 일반 가입은 Supabase `signUp()`을 사용하며, nickname·동의 버전·서버 접수 시각은 서명된 가입 진행 정보로 보관한 뒤 검증된 이메일 콜백에서 사용자 ID에 연결해 저장한다. 이메일 확인 전 자동 정회원 로그인하지 않는다. 이메일 콜백과 PKCE verifier는 가입을 시작한 브라우저에 묶는다. 비밀번호는 Auth 호출 후 버리고 쿠키·DB·로그에 저장하지 않는다.

이미 비회원 세션이 있는 요청은 아래 **비회원 전환 절차**를 안내한다. `signUp()`으로 별도 사용자 ID를 만들고 주문을 자동 옮기지 않는다.

`POST /api/auth/login` 요청:

```json
{"email": "person@example.invalid", "password": "<입력한 비밀번호>"}
```

응답 `200`:

```json
{"status": "member", "member": {"email": "person@example.invalid", "nickname": "햇살"}}
```

존재하지 않는 이메일·잘못된 비밀번호·확인 전 계정은 모두 같은 `401 INVALID_CREDENTIALS`와 “이메일 또는 비밀번호를 확인해 주세요.”를 반환한다. 중복 가입은 일반 202 안내로 처리한다. 공급자의 계정 존재 여부·내부 오류를 그대로 전달하지 않는다.

`GET /api/auth/session` 회원 응답:

```json
{"status": "member", "member": {"email": "person@example.invalid", "nickname": "햇살"}}
```

| 상태 | 응답 객체 | 의미 |
|---|---|---|
| 세션 없음·만료 | `{"status":"unauthenticated","member":null}` | 확실히 무효한 쿠키는 지움 |
| 비회원 | `{"status":"guest","member":null}` | 주문·본인 사진만 허용 |
| 이메일 확인 후 비밀번호 설정 전 / 프로필·동의 미완료 | `{"status":"profile_required","member":null}` | 필요한 완료 화면으로 안내. 일반 회원 기능은 제한 |
| 회원 | 위 `member` 응답 | 표시용 email·nickname만 반환 |

Auth 서비스 장애·네트워크 오류는 503으로 분리하고 쿠키를 임의 삭제하지 않는다. 화면은 이전 상태를 곧바로 미로그인으로 덮지 않고 재시도 안내를 보여준다. `/account`는 `member` 상태만 허용한다.

### 5. 비회원 주문 후 가입·계정 연결

**새 계정으로 전환할 때 주문·사진을 연결한다.** 같은 익명 사용자 ID에 신원을 추가하므로 주문·사진의 소유자 ID와 presign 집계는 유지된다.

| 요청 | 입력 / 성공 |
|---|---|
| `POST /api/auth/guest/upgrade/request` | `email`·`nickname`·`consents` → 202 `email_confirmation_required` |
| `GET /api/auth/email/callback` | 원래 익명 사용자·예상 이메일·흐름·PKCE 확인 → 전환 전용 쿠키와 비밀번호 설정 안내 |
| `POST /api/auth/guest/upgrade/confirm` | `password` → 200 회원 객체 + 일반 세션 쿠키 |

서버는 `updateUser({email})`로 신원을 연결한다. 이메일 확인 후 비밀번호를 다시 입력받아 설정하며, 확인을 기다리는 동안 입력한 비밀번호를 보관하지 않는다. 확인된 이메일·필수 동의·별명이 갖춰지고 비밀번호 설정이 성공한 때 회원 전환을 완료한다.

카카오 새 신원을 연결할 때는 비회원 세션에서 `linkIdentity({provider:"kakao"})`를 사용하고 동일 ID 유지 여부를 확인한다. 이미 다른 계정에 연결된 카카오 신원·이메일이면 자동 데이터 이전을 하지 않고 기존 계정 로그인 또는 비회원 주문 조회를 안내한다. 연락처·이메일 문자열이 같다는 이유만으로 주문·사진을 다른 계정에 붙이지 않는다. **기존 회원 계정으로의 주문 소유권 이전은 이번 계약에서 제공하지 않는다.**

### 6. 카카오 로그인·콜백·동일 이메일

흐름은 **브라우저 → Next 시작 → Supabase Auth → 카카오 → Supabase 제공자 콜백 → Next 콜백 → HttpOnly 세션 발급**이다.

1. `GET /api/auth/kakao/start`는 서버에서 OAuth 또는 비회원 신원 연결을 시작한다. 서명된 `sunny-auth-flow`에 목적·현재 익명 사용자 ID·복귀 경로를 묶고 PKCE verifier를 HttpOnly로 저장한 뒤 303 리디렉션한다.
2. **카카오 ↔ Supabase 제공자 구간의 state 검증은 Supabase Auth가 담당**한다. Next 콜백이 카카오의 원래 state를 그대로 받는다고 가정하지 않는다.
3. `GET /api/auth/kakao/callback`은 코드·서버가 발급한 진행 정보·PKCE verifier·만료를 확인한다. 서버의 `exchangeCodeForSession()`만 토큰을 받고 쿠키를 발급한다. 흐름 쿠키가 없거나 잘못되면 실패 처리한다.
4. 토큰 교환 후 주소의 코드를 제거해 303 리디렉션한다. 기존 회원은 `/account`, 신규 카카오는 별명·가입 동의 완료 안내로 보낸다. 취소·거부·만료·연결 충돌은 `/login`에서 일반 문구와 재시도를 안내한다. 외부 `next` URL이나 사용자 입력 Host로 이동하지 않는다.

| 환경 | Next 앱 콜백 |
|---|---|
| 로컬 앱 + 호스팅 Supabase 개발 Auth | `http://localhost:3000/api/auth/kakao/callback` |
| Vercel 미리보기 | 등록한 **정확한 HTTPS 배포 호스트**의 `/api/auth/kakao/callback` |
| 운영 | 확정된 운영 HTTPS 도메인의 같은 경로. 도메인 `TBD` |

카카오 개발자 설정에는 Supabase Auth의 제공자 콜백을 등록하고, Supabase redirect 허용 목록에는 위 Next URL을 등록한다. 미리보기 호스트가 등록되지 않았으면 카카오 시작을 비활성화한다. 전체 Vercel 도메인을 와일드카드 허용하지 않는다.

동일 이메일의 이메일·카카오 신원은 **Supabase가 검증한 identity linking 결과에 따라 같은 사용자 ID로 연결하는 안**을 제안한다. 앱이 이메일 문자열만 비교해 DB 기록을 합치지 않는다. 신규 비회원 전환과 기존 계정 충돌은 앞 절의 규칙을 따른다.

이번 계약에서는 **카카오가 이메일을 제공하지 않으면 가입·로그인을 완료하지 않는다.** Supabase Kakao의 이메일 없는 사용자 허용을 끄는 구성을 제안하고, 취소·동의 거부 때 일반 로그인 화면으로 돌아가 이메일 제공 안내를 한다. 신규 카카오 계정은 `POST /api/auth/profile/complete`에 nickname·consents를 제출해야 회원 기능을 사용할 수 있다.

환경변수 이름의 정본은 `backend/README.md`다. 다음은 추가 등록 제안이며 이 문서 PR에서 README나 실제 비밀값을 변경하지 않는다.

| 이름 제안 | 설정 위치 / 용도 |
|---|---|
| `KAKAO_CLIENT_ID` | 카카오 REST API 키. 서버 관리 배포 설정 또는 Supabase 제공자 구성의 입력 |
| `KAKAO_CLIENT_SECRET` | Supabase Kakao 제공자의 client secret. Next 앱에서 직접 사용하지 않으면 Next에 복제하지 않음 |
| `AUTH_FLOW_COOKIE_SECRET` | 서버의 가입·OAuth·복귀 경로 진행 정보를 서명. `lib/server/`만 읽음 |

Supabase 제공자 설정 방식과 이름을 준표와 합의하고, 별도 `chore/back-auth-provider-config` 이슈에서 `backend/README.md`·`frontend/.env.example` 허용 범위를 정한다. 브라우저에 전달하거나 `NEXT_PUBLIC_`을 붙이지 않는다.

### 7. 비밀번호 재설정

`POST /api/auth/password-reset/request` 입력:

```json
{"email": "person@example.invalid"}
```

응답은 계정 존재 여부와 무관하게 `202`:

```json
{"status": "if_account_exists_email_sent"}
```

서버는 `resetPasswordForEmail()`을 호출한다. 존재 여부에 따른 문구·상태 코드·대기 시간 차이를 만들지 않는다. 명백한 공급자 장애는 일반 503으로 처리하며 계정 유무를 이유로 분기하지 않는다. 요청 상한은 호출 제한 표, 메일 링크 유효 시간은 **1시간 제안**으로 Supabase 설정과 맞춘다.

메일 링크 → `GET /api/auth/password-reset/callback` → 서버의 PKCE 코드 교환 → `sunny-recovery` 전용 쿠키 → 새 비밀번호 화면 순서다. 같은 브라우저의 올바른 재설정 목적·verifier가 없으면 일반 실패를 안내하고 재요청한다. 이 콜백에서 일반 `sunny-session`을 발급하지 않는다.

`POST /api/auth/password-reset/confirm` 입력:

```json
{"newPassword": "<새 비밀번호>"}
```

전용 쿠키·진행 정보를 확인한 뒤 비밀번호를 변경하고 **`signOut({scope:"global"})`로 모든 refresh 세션을 종료**한다. 성공은 `204`와 재설정·일반 세션 쿠키 삭제이며, 화면은 새 로그인으로 복귀한다. 만료·재사용·잘못된 흐름은 동일한 `400 RESET_LINK_INVALID`다. 비밀번호 변경 뒤 세션 폐기에 실패하면 성공으로 단정하지 않고 재시도 가능한 일반 503을 반환한다.

기존 access JWT가 `exp`까지 유효할 수 있다는 Supabase 제한을 포함한다. 따라서 모든 기기에서 즉시 access JWT가 폐기된다는 보장은 하지 않는다. 즉시 차단이 필요하다는 합의가 생기면 `session_id` 기반 서버 검증 등 별도 설계를 먼저 추가한다.

### 8. 비회원 주문 조회·보관

**주문번호 + 주문에 기록된 연락 이메일 + 그 이메일로 보낸 일회용 코드**로 확인한다. 주문번호·전화번호 끝자리만으로 조회하지 않는다. 연락 이메일은 가입 신원과 독립된 수령 연락처이며, 문자열 일치만으로 계정 소유권을 증명하지 않는다.

`POST /api/orders/guest/lookup/request` 입력:

```json
{"orderNumber": "EXAMPLE-ORDER", "email": "person@example.invalid"}
```

일치·불일치 모두 같은 `202` 응답을 반환한다. 실제 또는 가짜 challenge에 대해 같은 응답 구조·만료·실패 횟수 정책을 사용한다.

```json
{"status": "if_match_code_sent", "challengeId": "00000000-0000-4000-8000-000000000001"}
```

`POST /api/orders/guest/lookup/confirm` 입력:

```json
{"challengeId": "00000000-0000-4000-8000-000000000001", "code": "<메일에서 입력한 코드>"}
```

성공 `200` 예시:

```json
{"order": {"orderNumber": "EXAMPLE-ORDER", "status": "received", "createdAt": "2026-10-06T00:00:00.000Z"}}
```

6자리 코드·10분 유효·성공 시 즉시 소모를 제안한다. 서버는 목적·주문·이메일·challenge ID에 묶어 코드의 비밀키 기반 해시만 보관한다. 만료·재사용·잘못된 코드·없는 주문을 모두 `400 LOOKUP_FAILED`로 처리한다. 확인 실패 상한은 호출 제한 표를 따른다.

조회는 해당 주문의 상태·접수 시각만 반환하고 일반 세션이나 사진 URL, 다른 주문에 대한 권한을 주지 않는다. `received` 등 주문 상태 enum은 #69 주문 계약에서 확정한다. #69에는 주문번호·`contact_email`·challenge 만료/사용/실패 횟수와 최소 서버 접근 경계를 검토해야 한다. 거래 메일 발송 서비스·서버 비밀키 이름은 제공자 설정 이슈에서 승인하고, 준비 전에는 이 조회 기능을 운영에 열지 않는다.

회원·비회원의 수령 정보와 주문 동의 기록은 **같은 보관 기준**을 제안한다. 실제 기간·보존 근거·삭제 주체는 `TBD`이며 #65/#69에서 합의한다. 사진 원본·정제본·임시 업로드 기간은 사진 계약에 위임한다. 주문이 있는 익명 계정의 일괄 삭제, 계정 전환을 통한 동의 기록 유실을 허용하지 않는다.

### 9. 회원 정보·가입 동의 저장소

별명은 `public.profiles`, 가입 동의 변경 이력은 `public.member_consent_events`에 저장하는 안을 제안한다. `user_metadata`는 사용자 변경이 가능하므로 동의 증빙이나 회원 기능 승인 기준으로 삼지 않는다. `Member` 응답은 email·nickname만 사용한다.

| 저장소 | 제안 필드·규칙 |
|---|---|
| `profiles` | `user_id`·`nickname`·`onboarding_completed_at`·서버 생성/변경 시각. 별명·필수 동의와 가입 방법별 완료 조건을 서버가 확인한 뒤 완료 시각을 기록한다. 전환 회원은 비밀번호 설정과 일반 세션 갱신까지 성공해야 완료된다. |
| `member_consent_events` | 사용자 ID·동의 종류·accepted·policy_version·서버 recorded_at. 변경마다 이력을 추가한다. |
| 필수 / 선택 | 약관·개인정보 동의는 필수, 마케팅은 선택. 거절도 기록하며 주문 사진 제작·브랜드 공개 동의와 분리한다. |

서버가 현재 게시된 동의 버전과 요청 버전을 대조한다. 브라우저의 `acceptedAt`은 받지 않는다. 완료 시각·동의 이력은 서버가 관리하며 클라이언트의 직접 테이블 쓰기로 위조할 수 없게 RLS와 컬럼 권한을 함께 설계한다. 서버/DB가 기록한 UTC 시각을 사용한다. `POST /api/auth/profile/complete`는 가입 예시의 nickname·consents만 받으며 필수 동의가 없으면 400이다.

이 테이블은 #69 범위 밖이다. 담당자 **이재원**, 후속 작업 **“회원 프로필·가입 동의 이력 스키마 — #70 계약 후속”**, 지정 브랜치 `feat/back-member-schema`, 허용 파일 `backend/supabase/migrations/*.sql`·`tests/*.sql`·README·seed로 제안한다. **후속 이슈 번호는 아직 TBD다.** 위 이름·담당자·브랜치·허용 범위로 이슈를 생성·배정하고, 계약 합의·동의 버전/보관 정책 확정 이후에만 DB를 만든다.

### 10. 화면 함수·실패 응답·후속 순서

| 화면 함수 제안 | 입력 | API 모드 반환 / 연결 |
|---|---|---|
| `signIn` | email·password | `Promise<SignInResult>`. `{status:"member",member:Member}` 또는 `{status:"profile_required",member:null}`를 반환하며 화면이 완료 필요 상태를 분기 |
| `signUp` | email·password·nickname·consents | `Promise<{status:"email_confirmation_required"}>`. signup 호출; 비회원은 전환 함수 사용 |
| `getMember` | 없음 | **`Promise<Member\|null>`**. session 조회 결과 중 회원만 반환 |
| `getSessionState` (새로) | 없음 | `Promise<SessionState>`. 비회원·미로그인·완료 필요를 구분 |
| `signOut` | 없음 | `Promise<void>`. 서버 logout 성공 후 화면 상태 제거 |
| `startKakaoSignIn` (새로) | 없음 | 서버 시작 경로로 이동; 응답 토큰을 읽지 않음 |
| `requestPasswordReset` / `confirmPasswordReset` (새로) | email / newPassword | 202 안내 객체 / `Promise<void>` |
| `requestGuestUpgrade` / `confirmGuestUpgrade` (새로) | email·nickname·consents / password | 202 안내 객체 / `Promise<Member>` |
| `requestGuestOrderLookup` / `confirmGuestOrderLookup` (새로) | orderNumber·email / challengeId·code | challenge 안내 객체 / 해당 주문 상태 |

현재 `frontend/lib/auth.ts`는 mock 중심이다. 계약 머지 후 팀장이 화면 이슈를 만들고 위 입력·비동기 반환과 호출 화면을 함께 고친다. API 모드에서 mock localStorage를 인증 근거로 사용하지 않는다. 서버 DTO→화면 함수 매핑과 mock 응답을 그 이슈에서 대조한다.

공통 오류 예시:

```json
{"error": {"code": "AUTHENTICATION_REQUIRED", "message": "로그인이 필요합니다."}}
```

| HTTP·코드 | 호출자 행동 |
|---|---|
| 400 `INVALID_AUTH_REQUEST` | 입력·필수 동의를 수정. 서버 정책 버전 오류는 동의 문구를 다시 로드 |
| 401 `INVALID_CREDENTIALS` | 로그인 폼의 동일 오류 문구 사용 |
| 401 `AUTHENTICATION_REQUIRED` | 보호 API의 세션 없음·만료. 로그인/비회원 세션 시작 안내; 이전 자산 소유권을 새 ID로 넘기지 않음 |
| 403 `ACCESS_DENIED` / #65 `UPLOAD_ACCESS_DENIED` | 유효한 신원이나 타인 자산·회원 전용 접근. 재로그인 무한 반복 금지 |
| 403 `ORIGIN_NOT_ALLOWED` | 요청 거부. 화면에서 자동 재시도하지 않음 |
| 400 `RESET_LINK_INVALID` / `LOOKUP_FAILED` | 새 링크·코드 요청 안내. 계정/주문 존재 여부를 설명하지 않음 |
| 429 `AUTH_RATE_LIMITED` | `Retry-After`만큼 기다린 뒤 사용자가 다시 요청 |
| 503 `AUTH_SERVICE_UNAVAILABLE` | 네트워크/제공자 장애 안내, 기존 로그인 상태를 임의 삭제하지 않음 |

오류·서버 로그에 비밀번호·토큰·쿠키·내부 Storage 경로·이메일·연락처를 넣지 않는다. 조회 인증 코드가 들어가는 거래 메일은 수신자에게만 보내고 로그에 남기지 않는다.

| 대상 | 다음 작업 |
|---|---|
| #70 | 본 계약만 리뷰·합의. 가입 동의 버전·운영 제한·보관 정책·실제 후속 이슈 번호가 미확정임을 PR에 표시 |
| #65 | #70 머지 뒤 `origin/main`을 merge. 로그인 사용자 제한을 정회원·검증된 익명 사용자로 변경. **최근 60분 presign 20개**를 양쪽 모두 사용자 ID로 원자 집계. 익명 발급 제한은 위 정책으로 보완 |
| #69 | 회원/익명 소유권·설문 회원 여부·orderNumber/contact_email·동의/보관을 확정한 마이그레이션 작성. 계약 미확정 중 원격 DDL 금지 |
| 회원 스키마 후속 | profiles·동의 이력·RLS/권한·서버 기록을 별도 이슈에서 구현 |
| 서버 API 후속 | 승인된 `@supabase/ssr` 추가 범위, 쿠키 어댑터·인증·카카오·재설정·메일/challenge 구현과 실패 검증을 이슈별로 나눔 |
| 팀장 화면 후속 | 기존 signIn/signUp 입력, getMember 비동기, 서버 signOut, 신규 흐름 화면·mock/API 연결 |

### 검토 근거

- [Supabase 서버 클라이언트 구현](https://github.com/supabase/ssr/blob/main/src/createServerClient.ts)과 [쿠키 구현](https://github.com/supabase/ssr/blob/main/src/cookies.ts): 서버 cookie getAll/setAll, PKCE·회전·분할 지원 확인. 실제 설치 버전 호환성은 구현 이슈에서 고정·검증한다.
- [익명 로그인](https://supabase.com/docs/guides/auth/auth-anonymous), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): 익명 사용자 역할·새 계정 전환·기존 계정 충돌 처리 확인.
- [카카오 로그인](https://supabase.com/docs/guides/auth/social-login/auth-kakao): 제공자 콜백과 Next redirectTo를 구분.
- [로그아웃](https://supabase.com/docs/guides/auth/signout), [세션](https://supabase.com/docs/guides/auth/sessions): refresh 폐기와 access JWT 잔여 유효 시간을 구분.

## 변경 이력

- 2026-10-07: #70 팀장 코멘트 반영 — 서버 전용 SSR 쿠키·회원/비회원 전환·카카오·재설정·조회·후속 범위 구체화 (합의 전)
- 2026-10-06: #70 인증 계약 초안 작성
- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
