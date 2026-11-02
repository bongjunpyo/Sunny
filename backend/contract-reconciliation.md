# API·ERD 계약 변경 검토안 — #88

> 상태: 공동 계약 검토용 제안. **정본과 구현 완료를 의미하지 않는다.**
> 이슈: [#88](https://github.com/bongjunpyo/Sunny/issues/88) · 브랜치: `docs/back-contract-reconciliation`
> 입력 대조 기준: 2026-10-16 KST · 비교 main: `0d159a96c752b1fbecc1ed1ebf753598e59b9edc` · 범위 결정 반영: 2026-11-02 KST

API·스키마 정본은 [CONTRACT_API.md](../docs/CONTRACT_API.md), 채택된 서버 설계 근거는
[postgres-design.md](postgres-design.md)다. 이 문서는 정본에 반영할 차이와 판단할 항목만 다룬다.
합의가 정본에 반영되면 여기의 제안은 정본 링크로 위임하고 별도 운영 규격으로 유지하지 않는다.

## 팀장 결정 (2026-11-02)

- **웹 설문 제외**: 설문 API·테이블은 만들지 않는다. 선호 색상 조사는 제품 담당이 웹 밖(구글폼 등)에서 리서치로 진행한다.
- **결제 제외**: 실제 결제와 Toss 테스트 모드 모두 채택하지 않는다. 3D 가시안 확인 뒤 주문 요청을 저장하고 주문 내역으로 이동하며, SDK·결제 키·결제 상태 테이블을 만들지 않는다.
- **회원 리뷰 보류**: R01~R03·T12·`app.reviews`는 지금 구현하지 않는다. 별도 요구 근거와 범위의 공동 재검토가 있어야 재개한다.

결정 근거: [PR #89 팀장 리뷰](https://github.com/bongjunpyo/Sunny/pull/89#issuecomment-6570430630).

## 1. 입력 자료와 검토 범위

검토 입력은 `sunny-api-spec-review-demo-v2.xlsx`(29개 API), `sunny-data-flow-v2.html`,
`sunny-db-erd.html` 및 그 모델 `sunny-db-erd-model.json`이다. 원래 82개 API 중 현재
브랜드 아카이브·커스텀 주문·리뷰·결제 시연 후보를 정리한 입력 v2이며, 엑셀 자체가 팀 합의를 대체하지 않는다.
입력에 있던 리뷰·결제 항목은 대조 이력으로 남기되 위 팀장 결정에 따라 각각 보류·제외한다.
아래 지문으로 동일 입력을 구별한다. 원본 산출물은 별도 전달본이며 저장소에 포함하지 않는다.

| 입력 | SHA-256 |
|---|---|
| `sunny-api-spec-review-demo-v2.xlsx` | `23f7243379f310ac05b4111e90a9d014cd091e5912a3d9ce18bcd5c536b41123` |
| `sunny-data-flow-v2.html` | `74b65a948e318374309b70086a345ec2842cdca49f767ac89867a8d6f7b5e132` |
| `sunny-db-erd.html` | `89b838057ba9f6f255c834ba204e29eb594f94d117cfa97232e3db4d83d946db` |
| `sunny-db-erd-model.json` | `3a93ee4405c93f033c0b3f19ef8ca9f262bc96bfcb851159f382e99bbec9f8ce` |

이번 변경은 이 파일 하나다. 정본 계약·mock·화면·DB·환경변수·라이브러리는 변경하지 않는다.
DB 적용 상태는 ERD의 **2026-10-14 조회 기록**과 PR #81의 SQL을 대조한 것으로,
2026-10-16의 실행 중 DB를 새로 검사했다는 의미는 아니다.

## 2. 선행 조건

PR 상태는 [GitHub에서 본다](https://github.com/bongjunpyo/Sunny/pulls).

#81은 인증·업무 테이블이 없는 기반 PR이다. 그 자체는 사진 계약 머지를 기다리지 않고 검토할 수 있다.
**업무 migration/API 구현**은 기반과 해당 공동 계약이 모두 준비된 뒤 시작한다.
#65의 사진 리뷰 수정은 기존 브랜치에 이어 붙이며 이 제안서 PR로 사진 계약을 중복 교체하지 않는다.
2026-11-02 팀장 리뷰에서 #92의 인증 검토안과 사진 계약의 전제를 대조했으므로,
사진 계약 #65는 #81 → #92 머지를 기다리지 않고 먼저 머지한다. 인증 정본 절은 #92에서 추가하고,
구현 PR #94는 사진 계약 기준으로 리뷰한다. 제공자 선택은 #71/PR #75의 채택 설계를 유지한다.
#80 하늘상태 API는 입력의 29개 목록 밖인 별도 과제이며 여기서 삭제하거나 UV와 통합하지 않는다.
닫힌 #70·#69는 예전 제공자를 전제하므로 완료된 새 인증·DB 구현으로 해석하지 않는다.

## 3. 정본에서 바뀌어야 할 부분

| 현재 정본 / 이전 초안 | 반영할 변경 | 결정 수준 |
|---|---|---|
| 인증 항목만 있고 세부 DTO 없음 | Better Auth DB 세션·HttpOnly 쿠키·검증된 게스트, 이메일 인증/재설정/카카오 입력·반환·실패 흐름 추가 | 제공자/기본 정책 채택, DTO·버전 검토 |
| PostgreSQL 주문·선호 색상 설문, `POST /api/survey` | **설문 제외**. API·테이블을 만들지 않고 제품 담당이 웹 밖에서 조사. 리뷰로 자동 대체하지 않음 | 2026-11-02 팀장 결정; 정본 설문 errata는 준표, backend/README.md 정리는 다음 back PR |
| 주문 필드·동의 미정 | 주문별 서버 생성 ID, 종류·색·길이·7칸 배치·가시안 확인·사진 동의 | 7칸은 기존 팀 리뷰, 나머지 v2와 사용자 요구 대조 |
| 초기 사진 초안의 이전 저장소·인증 전제 | private R2 + 검증된 회원/게스트, 검사한 동일 바이트의 별도 verified 객체 | #71 채택 설계 및 #65 사진 계약에 정렬 |
| 일회용 URL·덮어쓰기 방지 가정 | 짧은 수명 URL의 만료 전 재사용 전제. pending/verified 경로 분리·정리 정책 | 채택 설계에 정렬 |
| 리뷰 없음 | **회원 리뷰 보류**. R01~R03·T12·app.reviews는 구현하지 않음 | 2026-11-02 팀장 결정; 별도 요구 근거 확인 후 재검토 |
| 실제 상거래 결제와 Toss 테스트 시연 후보 | **모든 결제 제외**. 주문 요청 저장 → 본인 주문 내역 조회로 연결; O02·O03은 P0 | 2026-11-02 팀장 결정; 버튼·안내 문구는 준표 담당 |
| 공통 오류·시간·목록 DTO 미정 | `{ error: { code, message } }` 후보, 소유권 오류와 재시도·시간·페이지네이션 합의 | 제안, 실제 adapter와 대조 필요 |

공통 사유와 실패 동작도 계약의 일부다. 인증 누락/만료, 비게스트 회원 조건 미충족,
타인 자원 접근, 입력 오류, 충돌, 요청 제한, 외부 서비스 장애를 나누되 **정확한 코드·상태는 공동 합의**한다.
타인 자원 존재를 드러내지 않는 404/403 처리, 인증 응답의 계정 존재 비노출, 개인정보 로그 제외를 함께 검토한다.

## 4. API 목록 대조 — 29개

ID·메서드·경로는 입력 v2의 대조 이력이다. **표의 경로·성공 상태·DTO가 확정된 라이브러리 동작이라는 의미는 아니다.**
2026-10-16 입력 대조에서는 정본의 기존 초안 6개 중 5개를 상세화하고 설문 1개를 제외하며,
나머지 24개를 신규 제안으로 분류했다. 아래는 팀장 결정 반영 후 **계약 검토 대상 23개 · 리뷰 보류 3개 · 결제 제외 3개**다.
O02·O03은 주문 요청 저장 직후 내역을 보여 주는 데 필요하므로 P1에서 P0으로 올렸다. 검토 대상은 구현 완료를 뜻하지 않는다.

| ID | 메서드 | 경로 | 인증·권한 | 단계 | 상태 |
|---|---|---|---|---|---|
| A01 | POST | `/api/auth/sign-in/anonymous` | 비로그인 → 검증된 게스트 | P0 | 계약 검토 |
| A02 | POST | `/api/auth/sign-up/email` | 공개 | P0 | 계약 검토 |
| A03 | POST | `/api/auth/send-verification-email` | 공개; 요청 제한 | P0 | 계약 검토 |
| A04 | GET | `/api/auth/verify-email` | 유효한 인증 토큰 | P0 | 계약 검토 |
| A05 | POST | `/api/auth/sign-in/email` | 공개 → 이메일 인증 회원 | P0 | 계약 검토 |
| A06 | GET | `/api/auth/get-session` | 쿠키가 있으면 서버 검증 | P0 | 계약 검토 |
| A07 | POST | `/api/auth/sign-out` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| A08 | POST | `/api/auth/request-password-reset` | 공개; 요청 제한 | P0 | 계약 검토 |
| A09 | POST | `/api/auth/reset-password` | 유효한 재설정 토큰 | P0 | 계약 검토 |
| A10 | POST | `/api/auth/sign-in/social` | 공개 | P0 | 계약 검토 |
| A11 | GET | `/api/auth/callback/kakao` | Better Auth OAuth state 검증 | P0 | 계약 검토 |
| C01 | GET | `/api/terms` | 공개 | P0 | 계약 검토 |
| C02 | GET | `/api/products` | 공개 | P0 | 계약 검토 |
| C03 | GET | `/api/products/{slug}` | 공개 | P0 | 계약 검토 |
| C04 | GET | `/api/archive` | 공개 | P0 | 계약 검토 |
| C05 | GET | `/api/uv` | 공개 | P0 | 계약 검토 |
| F01 | GET | `/api/uploads/photo-rules` | 공개 | P0 | 계약 검토 |
| F02 | POST | `/api/uploads/presign` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| F03 | POST | `/api/uploads/{assetId}/complete` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| F04 | POST | `/api/uploads/{assetId}/read-url` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| O01 | POST | `/api/orders` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| O02 | GET | `/api/orders/{orderId}` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| O03 | GET | `/api/orders` | 서버 검증 회원·게스트 세션 | P0 | 계약 검토 |
| R01 | GET | `/api/reviews` | 로그인 회원만; 게스트 제외 | — | 보류 |
| R02 | POST | `/api/orders/{orderId}/review` | 로그인 회원만; 게스트 제외 | — | 보류 |
| R03 | PATCH | `/api/reviews/{reviewId}` | 로그인 회원만; 게스트 제외 | — | 보류 |
| P01 | POST | `/api/orders/{orderId}/demo-payment-attempts` | 서버 검증 회원·게스트 세션 | — | 제외 |
| P02 | POST | `/api/demo-payments/{attemptId}/confirm` | 서버 검증 회원·게스트 세션 | — | 제외 |
| P03 | GET | `/api/demo-payments/{attemptId}` | 서버 검증 회원·게스트 세션 | — | 제외 |

### 4.1. 인증 계약에서 명시할 것

- 회원과 게스트는 서버의 실제 DB 세션 검증 결과로 구분한다. 요청의 ownerId/userId를 신뢰하지 않는다.
  게스트 생성 후 같은 세션을 재사용하며, 가입·로그인으로 게스트 주문/사진 소유권을 이전하지 않는다.
- 이메일 가입은 인증 대기 결과이며 회원 세션을 발급하지 않는다. 인증 링크 24시간, 인증 뒤 자동 로그인 OFF,
  비밀번호 재설정은 메일 링크와 기존 세션 무효화를 유지한다. 카카오는 자동 계정 연결 OFF를 유지한다.
- 익명 자동 삭제를 막고 업무 FK는 사용자 삭제 시 CASCADE로 지우지 않는다. 미인증 이메일 회원의 7일 정리는
  설계의 제외 조건(게스트·업무 참조·유효 세션/토큰·타 제공자)을 모두 만족할 때만 검토한다. 실행 주기/주체는 TBD다.
- 입력 v2의 인증 DTO를 #92의 `backend/auth-contract.md`와 대조하고, T01~T04는 #92 리뷰에서 정한다.
  서버 검토안·정본·화면의 실제 입력/반환을 공동 확인하며, 이 제안서로 인증 화면을 변경하지 않는다.
- 11개 native 경로와 프로젝트의 표시용 DTO는 별개로 검증한다. Better Auth 버전·adapter 생성 SQL·실제 상태 코드,
  Set-Cookie/Location 보존·리디렉션 허용 목록·클라이언트 호환성·Origin/CSRF·Secure/SameSite를 확정한다.
  세션 토큰·OAuth 토큰·비밀번호 해시는 API JSON에 반환하지 않는다. DB ID가 기본 UUID라고 가정하지 않는다.

### 4.2. 사진 — 기존 PR #65에 반영할 델타

1. `presign`의 `purpose`, `fileName`, `mimeType`, `size` 및 응답 `assetId/uploadUrl/expiresAt`을 유지하고 저장소를 R2로 맞춘다.
   서버 검증 회원과 게스트에게 같은 소유권·파일 검사 원칙을 적용한다. 무인증 업로드는 허용하지 않는다.
2. presigned PUT은 만료 전 재사용할 수 있다. 임의 pending key만 허용하고, complete에서 읽기 상한·실제 형식/바이트/해상도를 확인한다.
   검사한 **동일 바이트**를 방향 보정·재인코딩·EXIF 제거한 뒤 별도 verified key로 저장한다.
   검사 후 pending을 다시 읽거나 원본을 그대로 복사하여 verified로 승격하는 안은 배제한다.
3. DB 상태를 원자적으로 확보하고 R2 저장/DB 확정 실패·고아 객체·재시도·서명 만료 후 pending 재생성의 정리 책임을 정한다.
4. #65 제안인 최근 60분 사용자별 presign 20개와 429/Retry-After를 회원·게스트에 맞춘다.
   complete 검사 중 409는 Retry-After 3초, 최대 10회 추가 호출 후 안내하고 자동 반복을 멈춘다.
   이미 verified인 재호출은 동일 최종 결과다. rejected는 최초 HTTP/code를 재반환하고 expired는 410으로 안내한다.
   미수신 409·타인 접근 404·503 재시도는 #65의 2차 리뷰 반영 계약을 따른다. 재시도 수치를 이 문서에서 중복 확정하지 않는다.
5. `read-url`은 **POST** 단건이며 본인 verified 사진만 허용한다. 최대 7개를 병렬 호출하고 중복 asset ID는 한 번만 요청한다.
   고객 사진 응답은 no-store로 제안한다. URL을 영구 저장하지 않고 3D 텍스처의 만료·재발급 흐름을 정한다.
6. JPEG/PNG·10 MiB·1000×1000은 `provisional: true`인 임시값이다. 형식/용량/해상도/비율·PUT/GET TTL·보관/삭제·동의 정책
   확정 전 운영 업로드를 켜지 않는다. 20개/60분·재시도 수치 역시 아직 미머지 #65 검토안임을 유지한다.

### 4.3. 주문·7칸·동의

| API 입력 / 결과 | 저장 후보 | 서버 확인 |
|---|---|---|
| 서버 생성 `orderId` | orders.id | 회원별로 여러 주문 가능, 주문마다 별도 고유 ID. 생성 방식/DB 타입 확정 필요 |
| 서버 세션의 사용자 | owner_id | 클라이언트에서 owner 변경 불가 |
| productSlug / productKind | product_slug / product_kind | Sanity 정본과 대조; bracelet/necklace 및 주문 가능 제품 상태 확인 |
| color / length | color / length_cm | 5색 red/orange/blue/yellow/violet. `18cm`→18 같은 명시적 변환과 종류별 길이 검증 |
| customer | customer_name / customer_contact | 수집 필드·필수 여부·개인정보 동의 TBD; 주소·배송 상거래를 임의 추가하지 않음 |
| beadLayout.squareCount / beads | order_beads | 정확히 7개, index 0..6 각각 한 번; 사진 없으면 null, 같은 asset ID 여러 칸 허용 |
| previewConfirmed=true | preview_confirmed_at | 서버 수신 시각으로 확인 기록; 브라우저가 실제 화면을 봤다는 증명으로 과장하지 않음 |
| photoProductionConsent / photoBrandUseConsent | order_consents | 활성 policyVersion 검증, acceptedAt/recordedAt 서버 생성 |
| Idempotency-Key 후보 | idempotency_key / request_payload_hash | 동일 키·동일 본문 재요청과 다른 본문 충돌 정책 TBD |

사진을 하나라도 쓰면 본인 소유 verified asset인지 주문 시 다시 확인하고 제작 이용 동의 accepted=true를 요구한다.
브랜드 공개 동의는 선택이며 거절해도 주문된다. 7칸 모두 null이면 사진 동의 두 항목은 생략할 수 있다.
거절 기록의 accepted_at은 null이고 recorded_at은 서버가 남긴다. 동의 정책의 실제 문구·버전·유효일·철회 절차는 TBD다.
orders·7개 beads·consents는 한 트랜잭션으로 저장한다. 슬롯 범위 CHECK/복합 PK만으로 **정확히 7행**은 보장되지 않으므로
원자 저장 및 필요 시 지연 constraint trigger를 검토하고 부분 저장·직접 삭제 경로를 함께 막아야 한다.

주문 동선은 **3D 가시안 확인 → 주문 요청 저장(`POST /api/orders`) → 본인 주문 내역**이다.
O02·O03은 회원·게스트 모두 서버가 검증한 자기 세션의 주문만 조회한다. 게스트의 회원 전환·세션 분실로
이전 주문이 자동 조회되거나 소유권이 이전되지 않는다. 주문 상태는 **주문 요청**으로 다루며 `PAID`·"결제 완료"를 두지 않는다.
버튼 이름과 실제 결제·제작이 일어나지 않는다는 안내 문구는 준표가 화면에서 정한다.

### 4.4. 회원 리뷰 — 보류

2026-11-02 팀장 결정으로 R01~R03·T12·`app.reviews`를 보류한다. 현재 API·테이블·RLS·화면을 만들지 않는다.
기존 입력의 회원 조회·본인 주문 작성·수정·리뷰 투영은 채택된 요구가 아니다. 별도 요구 근거와 범위를 공동 재검토한 뒤에만 재개한다.
선호 색상 조사 리서치를 리뷰 기능으로 대체하지 않는다.

### 4.5. 결제 — 제외

2026-11-02 팀장 결정으로 실제 결제와 Toss 테스트 결제 모두 제외한다. P01~P03·T14·`app.demo_payment_attempts`는
대조 이력만 남기며 SDK·결제 키 환경변수·결제 상태 테이블·결제 API를 만들지 않는다.
시연도 결제 경로 없이 주문 요청 저장과 본인 주문 내역 조회까지만 다룬다. 결제 금액·승인·정산·실결제 전환을 구현하지 않는다.

## 5. ERD 검토 — 적용 1개 / 후보 10개

ERD는 11개 엔티티·106개 컬럼이다. 그중 `sunny_meta.schema_migrations` 1개·6컬럼만 기반 적용 기록이며,
나머지 인증 4개·업무 6개, 총 100개 컬럼은 **입력 자료의 후보 이력**이다.
팀장 결정 반영 후 `app.reviews` 11컬럼은 보류, `app.demo_payment_attempts` 14컬럼은 제외다.
검토 대상은 이력 테이블을 포함한 9개 엔티티·81컬럼이며 실제 DDL 정의나 현재 실행 DB의 상태가 아니다.
설문 API·설문 테이블은 만들지 않는다.

| 테이블 | 컬럼 수 | 컬럼 대조 | 상태 |
|---|---|---|---|
| `auth.user` | 8 | `id`, `name`, `email`, `emailVerified`, `image`, `isAnonymous`, `createdAt`, `updatedAt` | 미적용 후보 |
| `auth.session` | 8 | `id`, `userId`, `token`, `expiresAt`, `createdAt`, `updatedAt`, `ipAddress`, `userAgent` | 미적용 후보 |
| `auth.account` | 13 | `id`, `userId`, `providerId`, `accountId`, `password`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `createdAt`, `updatedAt` | 미적용 후보 |
| `auth.verification` | 6 | `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt` | 미적용 후보 |
| `app.photo_assets` | 15 | `id`, `owner_id`, `purpose`, `status`, `pending_key`, `verified_key`, `content_type`, `byte_size`, `width`, `height`, `created_at`, `upload_expires_at`, `verified_at`, `deletion_due_at`, `deleted_at` | 미적용 후보 |
| `app.orders` | 14 | `id`, `owner_id`, `product_slug`, `product_kind`, `color`, `length_cm`, `customer_name`, `customer_contact`, `status`, `preview_confirmed_at`, `idempotency_key`, `request_payload_hash`, `created_at`, `updated_at` | 미적용 후보 |
| `app.order_beads` | 4 | `order_id`, `slot_index`, `owner_id`, `photo_asset_id` | 미적용 후보 |
| `app.order_consents` | 7 | `order_id`, `consent_type`, `owner_id`, `accepted`, `policy_version`, `accepted_at`, `recorded_at` | 미적용 후보 |
| `app.reviews` | 11 | `id`, `order_id`, `owner_id`, `product_slug`, `product_kind`, `color`, `author_display_name`, `content`, `rating`, `created_at`, `updated_at` | **보류** — 현재 구현하지 않음 |
| `app.demo_payment_attempts` | 14 | `id`, `order_id`, `owner_id`, `mode`, `provider_order_id`, `provider_payment_key`, `amount_krw`, `currency`, `status`, `idempotency_key`, `created_at`, `confirmed_at`, `last_error_code`, `updated_at` | **제외** — 만들지 않음 |
| `sunny_meta.schema_migrations` | 6 | `version`, `name`, `checksum`, `applied_at`, `applied_by`, `execution_ms` | 기반 적용 기록 |

| 관계 / 제약 | 검토 결과 |
|---|---|
| auth.user → orders/photo_assets | ID 타입과 실제 Better Auth adapter SQL을 먼저 맞추고 FK 연결. 업무 참조가 있으면 사용자 삭제 RESTRICT/NO ACTION |
| orders(id,owner_id) → order_beads/order_consents | 부모 복합 UNIQUE와 자식 복합 FK로 타인 주문 연결 차단 후보. reviews는 보류, demo_payment_attempts는 제외 |
| photo_assets(id,owner_id) → order_beads(photo_asset_id,owner_id) | null 허용·같은 asset 반복 허용. asset_id 단독 UNIQUE를 beads에 추가하지 않음. verified 조건은 FK와 별도로 검사 |
| orders → beads | 정확히 7은 트랜잭션/지연 검사까지 검토. 부분 생성·슬롯 삭제도 실패해야 함 |
| orders → consents | 0..2개 사진 동의. 사진 포함 시 제작 true, 선택 동의 거절 허용. 주문 개인정보 동의 정책은 별도 TBD |
| orders → reviews | **보류** — 관계·권한·제약을 현재 구현하지 않음 |
| orders → demo_payment_attempts | **제외** — 결제 관계·상태·제약을 만들지 않음 |
| Sanity → product_slug | 외부 CMS 논리 참조이며 SQL FK가 아님. 주문 시 제품 종류·색·길이 검증과 스냅샷 정책 필요 |

RLS는 auth/app 역할 분리 위에서 설계한다. sunny_app에 인증 토큰/계정 조회 권한을 주지 않는다.
서버가 DB 세션에서 확인한 owner와 회원 여부만 **동일 client의 요청별 트랜잭션**에 전달한다.
`app.user_id`는 인증 수단이 아니며 요청 본문·임의 헤더에서 받지 않는다. 리뷰용 `app.is_member` 후보는 보류하며 현재 도입하지 않는다.
컨텍스트가 없으면 거부하고 COMMIT/ROLLBACK 뒤 풀의 이전 사용자 값이 남지 않아야 한다.
보호 업무 테이블은 ENABLE/FORCE RLS, UPDATE는 USING/WITH CHECK 모두 검토하며 runtime에 DDL·TRUNCATE를 허용하지 않는다.
R2 객체 바이트에는 PostgreSQL RLS가 직접 적용되지 않으므로 URL 발급/주문 연결 시 서버 소유권 검사를 유지한다.

## 6. 공동 검토 결정표

채택된 제공자·게스트 분리·7칸·이메일 인증 24시간은 설계/팀 리뷰에 근거한다.
리뷰는 보류하고 결제는 제외한다. T01~T04는 #92 리뷰에서, T05~T08은 업로드를 켜기 전에,
T09는 주문 계약 PR에서 정한다. T10·T11·T13도 해당 계약/구현 이슈에서 검토하며 아래 TBD를 운영값으로 확정하지 않는다.

| ID | 결정할 내용 | 담당 / 진입 조건 |
|---|---|---|
| T01 인증 어댑터 계약 | Better Auth 버전·실제 기본 응답/상태/경로와 DTO 차이, Set-Cookie/Location 보존, 클라이언트 호환성·Origin/CSRF·Secure/SameSite 합의·검증. | 공동: 봉준표·이재원 |
| T02 세션·재설정·요청 제한 | 게스트/회원 세션 수명·갱신, 비밀번호 재설정 TTL, 인증/게스트 요청 제한 수치와 쿠키 캐시 무효화. 인증 링크 24시간은 이미 채택. | 서버 설계 + 공동 계약 |
| T03 계정·메일 운영 | 비밀번호/닉네임 규칙, 카카오 이메일 검증 해석·중복 이메일 안내, 실제 auth 발신 도메인·DNS 검증, 미인증 계정 정리 실행 주기. | 서버 + 팀 도메인 확보 |
| T04 게스트 세션 분실 | 주문·사진 복구 방식. 현재 게스트 세션이 사라진 뒤 회원 계정에서 자동 조회·이전한다고 안내하지 않음. | 공동 계약 |
| T05 사진 운영 규칙 | 허용 MIME·실제 최대 바이트·최소 해상도·비율·크롭을 확정. 현재 값은 provisional=true이며 운영 업로드 차단. | 제품 조건 + 화면·서버 |
| T06 R2 서명 URL TTL | PUT/GET URL 수명, 완료 허용 기한, 3D 텍스처 갱신 여유. 예시 시각은 정책 수치가 아님. | 공동 계약 |
| T07 보관·삭제 실행 | pending/rejected/verified·고아 객체·URL 만료 후 재생성 객체 보관 기간과 삭제 주체·주기·실패 복구. 브랜드 공개 철회 절차. | 서버·운영 + 공동 계약 |
| T08 동의 정책 | 제작/브랜드 공개/주문 개인정보 문구·유효 버전·시행일·철회 처리. 정책 원천 저장 위치와 C01 경로 합의. | 공동 계약 / 제품 권리 |
| T09 주문 업무·중복 방지 | 이름·연락 수단·주소 수집 범위·필수값·개인정보 동의, 요청 가능한 제품 상태, 주문 처리 상태 전이, 중복 제출/Idempotency-Key 정책, O02/O03 조회 범위. | 공동 계약 |
| T10 자외선지수 | 지역 선정·생활기상지수 시간 의미·캐시 갱신 주기/유효기간·요청 필드·응답 JSON. stale 표시 원칙은 유지. | 공동 계약 |
| T11 CMS·화면 DTO | 제품 옵션 저장 구조, 제작 기록 단계·date 표현, 목록/상세 응답 래핑과 페이지네이션. mock/contract/server 동일성 대조. | 화면·서버 공동 |
| T12 리뷰 상세 정책 | **보류**. R01~R03·app.reviews를 현재 구현하지 않음. 별도 요구 근거와 범위부터 재검토. | 2026-11-02 팀장 결정; 재개 전 공동 검토 |
| T13 배포·동작 검증 | 운영 PostgreSQL 위치/TLS/백업/연결 제한, Vercel 네트워크·R2 개발/운영 CORS·실제 이미지 처리 라이브러리·SDK 추가 이슈. | 서버·배포 이슈 |
| T14 결제 시연 | **제외**. 실제·테스트 결제 API/SDK/키/상태 테이블을 만들지 않음. 결제와 무관한 UUID·FK·RLS·정확히 7칸 migration은 T01/T09 및 별도 back 이슈에서 검토. | 2026-11-02 팀장 결정 |

## 7. 반영 순서·담당·검증 기준

| 순서 | 즉시 할 일 | 담당 / 완료 증거 |
|---|---|---|
| 1 | #89의 설문·결제 제외/리뷰 보류와 #65의 2차 사진 리뷰를 반영 | 이재원 문서 수정 → 준표 재확인·squash merge. #65는 인증 정본 머지를 기다리지 않음 |
| 2 | #65 뒤 #92에서 인증 정본 절 추가, #94는 사진 계약 기준으로 리뷰 | 준표·재원이 같은 PR에서 합의. 계약 파일을 고치는 후속 PR은 앞선 머지를 반영해 순차 처리 |
| 병행 | #81 기반 PR의 질문 답·확인 문구 정리와 리뷰 | 이재원 본인 답, 팀장 머지. 새 업무 SQL을 섞지 않음 |
| 3 | #89 뒤 정본의 설문 제거 errata, 별도 주문 DTO/7칸/동의 및 O01~O03 P0 계약 반영 | 설문 정본 errata는 준표. backend/README.md 설문 문구는 다음 back PR. 화면·mock·타입은 준표와 공동 대조 |
| 4 | 기반 + 해당 계약이 준비되면 서버 pool/트랜잭션 → 인증 schema/adapter/API | 별도 back 이슈, 최소 권한·교차 사용자 거부·세션 무효화·컨텍스트 격리 검증 |
| 5 | 사진 → 주문 요청 저장·본인 주문 조회 구현 | 각 back 이슈와 migration 분리. 사진 없는 7칸 주문도 해당 계약 확정 후 검증. 설문·결제 구현 없음, 리뷰 보류 |
| 병행 | Sanity/약관/UV 및 기존 #80 | 각각 계약 확정 뒤 별도 범위로 진행. `/api/sky`를 UV와 임의 통합하지 않음 |

합의와 구현의 검증은 구별한다. 이번 문서 검토에서는 API 29개/ERD 11개·106컬럼 대조,
입력 지문, 범위 상태 표시, Markdown diff/허용 파일을 확인한다. API 실행·DB migration·R2 업로드의
통합 검증은 아직 하지 않았으며 해당 구현 PR의 수용 기준으로 남긴다.

후속 계약/구현에서 반드시 확인할 실패 사례:

- 만료/위조 세션과 타인 사진·주문 조회/연결 거부. 게스트는 자기 세션의 주문만 조회하며 회원 전환 시 자동 이전 없음.
- 6칸/8칸/중복 index·범위 밖 index 거부, 동일 asset 재사용과 7칸 all-null 주문 허용, 부분 저장 rollback.
- 사진 포함 제작 동의 거절/오래된 정책 버전 거부, 브랜드 공개 거절 주문 허용, 서버 동의 시각 기록.
- pending 덮어쓰기·동시 complete·R2 저장 뒤 DB 실패에도 검증 바이트만 확정, URL 만료와 정리 재시도.
- 설문·결제 API/테이블/SDK/키가 구현 범위에 섞이지 않고, 보류된 리뷰 API/테이블을 만들지 않음.
- 주문 요청 저장 후 본인 내역을 조회하고, PAID·"결제 완료" 상태나 결제·자동 제작 경로가 생기지 않음.
- API 계약·mock·실제 응답 동일성, 잘못된 DB 계정 거부, 컨텍스트 누수와 auth/app 역할의 교차 접근 거부.
