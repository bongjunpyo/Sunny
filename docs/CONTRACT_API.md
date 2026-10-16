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
- [ ] **주문 요청** (PostgreSQL) — 필드, 이용 동의 항목, RLS 정책
- [ ] **선호 색상 설문** (PostgreSQL) — 문항, 익명 여부, RLS 정책
- [ ] **인증** (Better Auth) — 가입(이메일 인증)·로그인·재설정·카카오·비회원 세션 API와 `lib/auth.ts` 입력/반환
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
| `POST /api/orders` | 커스텀 주문 요청 | PostgreSQL |
| `POST /api/survey` | 선호 색상 설문 | PostgreSQL |

## 커스텀 사진 업로드 계약 — #26 검토 초안

> **합의 전 초안.** `provisional: true`인 규칙과 `TBD` 정책은 운영값이 아니다. 봉준표·이재원이 이 PR에서 값을 확정하고 `provisional: false`로 바꾸기 전에는 사진 업로드를 프로덕션에 켜지 않는다.

### 채택 설계와 합의할 경계

제공자는 [PostgreSQL·Better Auth·R2 설계](../backend/postgres-design.md)의 7절과 #71/PR #75를 따른다. 이 절은 PR #65에서 합의할 사진 API 수정안이며 구현 완료를 뜻하지 않는다.

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

닫힌 #70은 이전 인증 방식의 이력이다. 후속 인증 계약 조정은 [#88](https://github.com/bongjunpyo/Sunny/issues/88)·[PR #89](https://github.com/bongjunpyo/Sunny/pull/89)의 검토 항목에 연결하되, 두 작업을 확정된 인증 API 계약으로 간주하지 않는다. **머지 선행 조건**은 새 인증 계약의 세션 검증·게스트 ID·쿠키/Origin/CSRF·401/403 동작을 준표·재원이 합의하고 이 절과 대조하는 것이다. Better Auth 버전·adapter ID 타입·native 응답/헤더 호환성·세션 수명·인증 요청 제한은 그 계약에서 확정한다.

이번 사진 PR은 설문→리뷰, 주문 제품 옵션 전체, 테스트 결제 계약을 함께 변경하지 않는다. 해당 변경안은 #88의 후속 공동 계약 범위다. 아래 주문 항목은 사진 배치·동의 연결에 한정한다.

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
- `rejected`·`expired`이면 다시 살리지 않고 새 presign부터 시작한다.
- 정제본 저장/DB 확정 실패는 `503`으로 안내하고 같은 asset의 상태를 재확인한다. 검증 실패와 구분하여 새 파일/새 asset을 자동 생성하지 않는다. inspecting이 남아 있으면 위 `409` 상한을 따르며 영구 대기 복구는 서버 책임이다.

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

| HTTP | `code` | 때 |
|---:|---|---|
| 400 | `INVALID_UPLOAD_REQUEST` | 필수 필드 누락·범위 밖 값 |
| 401 | `AUTHENTICATION_REQUIRED` | 검증 가능한 회원·게스트 세션이 없거나 만료됨 |
| 403 | `UPLOAD_SESSION_NOT_ELIGIBLE` | 세션은 있으나 새 인증 계약의 회원/게스트 자격에 맞지 않음 |
| 403 | `UPLOAD_ORIGIN_REJECTED` | 앱 POST의 Origin/CSRF 검사 실패 |
| 403 | `UPLOAD_ACCESS_DENIED` | 다른 사용자의 `assetId` 접근 |
| 404 | `UPLOAD_NOT_FOUND` | 존재하지 않는 `assetId` |
| 409 | `UPLOAD_INSPECTION_IN_PROGRESS` | 같은 파일을 이미 검사 중 |
| 409 | `UPLOAD_NOT_VERIFIED` | read-url/주문에 pending 또는 inspecting 사진 사용 |
| 410 | `UPLOAD_EXPIRED` | 앱 DB의 완료 허용 기한 만료로 expired 처리된 asset |
| 413 | `FILE_TOO_LARGE` | 요청 크기 또는 실제 바이트 수 초과 |
| 415 | `UNSUPPORTED_IMAGE_TYPE` | 허용하지 않는 형식·SVG·실제 형식 불일치 |
| 422 | `INVALID_IMAGE_FILE` | 이미지로 디코딩할 수 없음 |
| 422 | `IMAGE_DIMENSIONS_TOO_SMALL` | 방향 보정 후 최소 해상도 미달 |
| 422 | `IMAGE_ASPECT_RATIO_NOT_ALLOWED` | 확정된 비율 범위 밖 |
| 429 | `UPLOAD_RATE_LIMITED` | 검증된 회원/게스트가 최근 60분의 presign 발급 상한에 도달 |
| 503 | `UPLOAD_STORAGE_UNAVAILABLE` | R2/확정 처리 장애로 안전하게 완료할 수 없음 |

오류 메시지는 화면 표시용 한국어 문장이고, 분기는 `code`로 한다. 서명 URL에 포함되는 객체 경로·서명 항목 외에 bucket/key를 별도 필드로 반환하지 않는다. 오류 응답과 로그에는 내부 스토리지 경로·서명 URL·키·원본 오류·개인정보를 넣지 않는다.

이 표는 **Next.js 앱 API**의 JSON 계약이다. R2에 직접 보내는 PUT/GET은 이 JSON 모양이나 앱의 410을 보장하지 않는다. R2의 만료/서명 오류(예: 403)를 앱의 세션 401과 혼동하지 않는다. PUT 실패 시 complete로 성공 처리하지 않고 유효 기한과 네트워크 결과를 확인한다. 새 presign은 발급 상한을 다시 적용하며, GET 실패는 유효한 앱 세션으로 read-url을 재요청하고 실패가 계속되면 자동 반복을 멈춰 안내한다. 미업로드 객체·일반 rejected의 재호출에 대한 세부 오류 매핑과 자동 재발급 상한은 공동 검토 항목이다.

### 보관·삭제 정책 — 합의 필요

| 상태 | 보관·삭제 원칙 | 기간 |
|---|---|---|
| `pending` · `expired` | 완료되지 않은 임시 파일과 만료 후 다시 생긴 pending 객체를 반복 정리 | `TBD` |
| `inspecting` | 서버 중단/시간 초과 작업을 복구하고 중복 확정 방지 | `TBD` |
| `rejected` | 검사 실패 뒤 즉시 접근 차단하고 삭제 | `TBD` |
| `verified` | 제작 완료 후 정해진 기간이 지나면 원본·정제본·메타데이터 삭제 | `TBD` |
| 브랜드 공개 동의 철회 | 공개 사용을 중단하고 별도 보관 근거가 없으면 삭제 | `TBD` |

기간과 삭제 실행 주체(예약 작업 또는 운영 절차)가 `TBD`인 동안 프로덕션 업로드를 켜지 않는다.

삭제한 pending 객체도 살아 있는 PUT URL로 다시 생성될 수 있다. 서명 만료와 업로드 완료 여유 시간 이후에도 고아 객체를 반복 정리한다. 정제본 저장 후 DB 확정 실패, DB 삭제/객체 삭제 실패, 주문에서 재사용 중인 사진의 참조 확인·보관 근거를 포함해 재시도와 정리 기준을 합의한다. 이 PR은 실제 객체·DB·기존 서비스 데이터를 삭제하지 않는다.

### 주문 동의 필드

제품 종류·길이와 무관하게 네모 비즈는 **정확히 7칸**이고, 각 칸에 사진 한 장 또는 `null`을 배치한다. 사진은 선택 사항이며 서로 다른 사진은 0~7장이다. 동일한 사진을 여러 칸에 쓸 수 있고 이 경우 업로드는 한 번만 한다. 주문 화면은 3D 가시안을 보여준 뒤 명시적인 확인을 받아야 제출할 수 있다. 주문 API는 `previewConfirmed: true`를 요구하고 서버 수신 시각을 확인 기록으로 저장한다. 이 값은 사용자의 확인 의사를 기록하며 실제 시청 시간을 증명하지는 않는다.

요청의 사진 배치 예시(7칸 전체):

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
- 주문 생성 시 사진 소유권·verified 상태·목적을 다시 검사한다. 주문·정확히 7개 배치·동의 기록은 원자적으로 저장하며, 슬롯 범위와 PK만으로 7행이 보장된다고 가정하지 않는다. 전체 제품 옵션/상태·FK/RLS SQL은 후속 주문/DB 계약에서 확정한다.

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

- 새 인증 계약과 회원/게스트 자격·401/403·쿠키/Origin/CSRF를 대조하고, 다른 사용자·게스트→회원 전환 후 이전 사진의 접근을 거부한다.
- 기존 7칸·동일 사진 재사용·0장·409 재시도·429 발급 상한을 회원/게스트 각각 확인한다.
- pending 덮어쓰기·동시 complete·검사 후 원본 변경에도 검사한 정제본만 verified로 확정하고 같은 complete는 동일 최종 결과를 반환한다.
- R2 저장 뒤 DB 확정 실패·영구 inspecting·만료 뒤 pending 재생성·삭제 실패를 복구하는 실행 주체와 시간/횟수 정책을 정한다.
- URL 만료/외부 403과 앱 인증 오류를 구분하고, 로그아웃 후 새 발급 차단·CORS·3D 텍스처 갱신·no-store를 검증한다.
- 사진 규칙/디코딩 자원 상한·PUT/GET TTL/완료 기한·보관/삭제·동의 정책은 합의 전 `provisional`/`TBD`로 유지한다. 이 PR에서는 문서만 검증하며 실제 R2/인증/DB 테스트 완료를 주장하지 않는다.

참고: [R2 서명 URL의 재사용·PUT/GET·S3 도메인](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [Better Auth DB 세션](https://better-auth.com/docs/concepts/session-management), [anonymous 옵션](https://better-auth.com/docs/plugins/anonymous). 2026-10-16 공식 문서 대조. 구체적인 버전·SDK·adapter는 구현 이슈에서 고정한다.

## 변경 이력

- 2026-10-16: PR #65 최신 main 충돌 해소안 — Better Auth 회원/게스트 경계, private R2의 재사용 가능한 PUT/GET, 동일 바이트 검증·별도 verified 객체·복구/정리, 서버 동의 시각 기록으로 정렬 (공동 합의 전)
- 2026-10-04: PR #65 리뷰 반영 — 7칸 사진 배치, 검사 중 재시도, presign 계정별 상한, 3D 가시안 조회 URL 용도 명시
- 2026-09-24: #26 커스텀 사진 업로드 계약 검토 초안 추가 (정책값·보관 기간 합의 전)
- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
