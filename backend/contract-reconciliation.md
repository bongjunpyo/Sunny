# API·ERD 계약 변경 검토안 — #88

> 상태: 공동 계약 검토용 제안. **정본과 구현 완료를 의미하지 않는다.**
> 이슈: [#88](https://github.com/bongjunpyo/Sunny/issues/88) · 브랜치: `docs/back-contract-reconciliation`
> 작성 기준: 2026-10-16 KST · 비교 main: `0d159a96c752b1fbecc1ed1ebf753598e59b9edc`

API·스키마 정본은 [CONTRACT_API.md](../docs/CONTRACT_API.md), 채택된 서버 설계 근거는
[postgres-design.md](postgres-design.md)다. 이 문서는 정본에 반영할 차이와 판단할 항목만 다룬다.
합의가 정본에 반영되면 여기의 제안은 정본 링크로 위임하고 별도 운영 규격으로 유지하지 않는다.

## 1. 입력 자료와 검토 범위

검토 입력은 `sunny-api-spec-review-demo-v2.xlsx`(29개 API), `sunny-data-flow-v2.html`,
`sunny-db-erd.html` 및 그 모델 `sunny-db-erd-model.json`이다. 원래 82개 API 중 현재
브랜드 아카이브·커스텀 주문·결제 시연 범위로 정리한 v2이며, 엑셀 자체가 팀 합의를 대체하지 않는다.
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

## 2. 기존 PR 상태와 선행 조건

2026-10-16 GitHub PR 메타데이터와 전체 리뷰 타임라인 조회 기준이다. 상태는 이후 달라질 수 있다.

| 작업 | 확인 상태 | 남은 일 / 책임 |
|---|---|---|
| [PR #81](https://github.com/bongjunpyo/Sunny/pull/81), #79 | open · Draft · mergeable=true · head `76a0169dd6678c6ffb82862c938a8bba90ca9e1c` · 댓글 없음 | 기반 검토와 담당자 본인 말로 학습 질문 답 작성 후 준표가 머지 판단. 사용자 DBeaver 연결 완료 안내와 PR의 후속 연결 문구는 담당자가 증빙 기준으로 정리 |
| [PR #65](https://github.com/bongjunpyo/Sunny/pull/65), #26 | open · Draft 아님 · mergeable=false · head `9671debbf623e89e164791e16104cbd9a08baae7` | 기존 `docs/contract-photo-upload`에서 최신 main을 **merge**해 충돌 해결. Supabase·인증 선행 #70·1회용 URL 가정을 최신 설계에 맞춰 공동 수정 |
| [PR #75](https://github.com/bongjunpyo/Sunny/pull/75), #71 | 채택 설계는 main에 존재 | 제공자 선택을 다시 TBD로 돌리지 않음. 세부 API·adapter·운영 정책 합의는 별도 |
| [#80](https://github.com/bongjunpyo/Sunny/issues/80) | open · 이재원 배정 · 별도 하늘상태 API 계약 과제 | v2의 29개에는 `/api/sky`가 없음. 기존 과제를 삭제한 것으로 해석하지 않으며, #80에서 정한 계약→서버→화면 절차 유지 |

#81은 인증·업무 테이블이 없는 기반 PR이다. 그 자체는 사진 계약 머지를 기다리지 않고 검토할 수 있다.
**업무 migration/API 구현**은 기반과 해당 공동 계약이 모두 준비된 뒤 시작한다.
#65의 사진 리뷰 수정은 기존 브랜치에 이어 붙이며 이 제안서 PR로 사진 계약을 중복 교체하지 않는다.
닫힌 #70·#69는 예전 제공자를 전제하므로 완료된 새 인증·DB 구현으로 해석하지 않는다.

## 3. 정본에서 바뀌어야 할 부분

| 현재 정본 / 이전 초안 | 반영할 변경 | 결정 수준 |
|---|---|---|
| 인증 항목만 있고 세부 DTO 없음 | Better Auth DB 세션·HttpOnly 쿠키·검증된 게스트, 이메일 인증/재설정/카카오 입력·반환·실패 흐름 추가 | 제공자/기본 정책 채택, DTO·버전 검토 |
| PostgreSQL 주문·선호 색상 설문, `POST /api/survey` | 설문을 제외하고 회원 리뷰로 대체. 기존 설문 API는 만들지 않음 | 최신 사용자 요구, 공동 계약 반영 필요 |
| 주문 필드·동의 미정 | 주문별 서버 생성 ID, 종류·색·길이·7칸 배치·가시안 확인·사진 동의 | 7칸은 기존 팀 리뷰, 나머지 v2와 사용자 요구 대조 |
| #65의 Supabase 저장소 및 기존 인증 전제 | private R2 + 검증된 회원/게스트, 검사한 동일 바이트의 별도 verified 객체 | #71 채택 설계에 정렬 |
| 일회용 URL·덮어쓰기 방지 가정 | 짧은 수명 URL의 만료 전 재사용 전제. pending/verified 경로 분리·정리 정책 | 채택 설계에 정렬 |
| 리뷰 없음 | 로그인한 비게스트 회원만 목록 조회, 본인 주문에만 작성. 게스트 주문은 회원에게 이전하지 않음 | 최신 사용자 요구 |
| 실제 상거래 결제 기능을 포함한 원본 명세 | Toss 테스트 모드의 시도·확인·조회만. 실청구·정산·자동 제작/배송 전환 제외 | 최신 사용자 요구, 세부 연동 검토 |
| 공통 오류·시간·목록 DTO 미정 | `{ error: { code, message } }` 후보, 소유권 오류와 재시도·시간·페이지네이션 합의 | 제안, 실제 adapter와 대조 필요 |

공통 사유와 실패 동작도 계약의 일부다. 인증 누락/만료, 비게스트 회원 조건 미충족,
타인 자원 접근, 입력 오류, 충돌, 요청 제한, 외부 서비스 장애를 나누되 **정확한 코드·상태는 공동 합의**한다.
타인 자원 존재를 드러내지 않는 404/403 처리, 인증 응답의 계정 존재 비노출, 개인정보 로그 제외를 함께 검토한다.

## 4. API 목록 대조 — 29개

ID와 P0/P1은 v2 문서의 분류다. **표의 경로·성공 상태·DTO가 확정된 라이브러리 동작이라는 의미는 아니다.**
현재 main은 제품/기록/UV/주문/설문 6개 초안만 있다. 제품·기록·UV·주문 5개는 상세화,
설문 1개는 제외, 나머지 24개는 신규 제안이다. #65의 아직 미머지인 사진 경로도 이 24개에 포함한다.

| ID | 메서드 | 경로 | 인증·권한 | 단계 |
|---|---|---|---|---|
| A01 | POST | `/api/auth/sign-in/anonymous` | 비로그인 → 검증된 게스트 | P0 |
| A02 | POST | `/api/auth/sign-up/email` | 공개 | P0 |
| A03 | POST | `/api/auth/send-verification-email` | 공개; 요청 제한 | P0 |
| A04 | GET | `/api/auth/verify-email` | 유효한 인증 토큰 | P0 |
| A05 | POST | `/api/auth/sign-in/email` | 공개 → 이메일 인증 회원 | P0 |
| A06 | GET | `/api/auth/get-session` | 쿠키가 있으면 서버 검증 | P0 |
| A07 | POST | `/api/auth/sign-out` | 서버 검증 회원·게스트 세션 | P0 |
| A08 | POST | `/api/auth/request-password-reset` | 공개; 요청 제한 | P0 |
| A09 | POST | `/api/auth/reset-password` | 유효한 재설정 토큰 | P0 |
| A10 | POST | `/api/auth/sign-in/social` | 공개 | P0 |
| A11 | GET | `/api/auth/callback/kakao` | Better Auth OAuth state 검증 | P0 |
| C01 | GET | `/api/terms` | 공개 | P0 |
| C02 | GET | `/api/products` | 공개 | P0 |
| C03 | GET | `/api/products/{slug}` | 공개 | P0 |
| C04 | GET | `/api/archive` | 공개 | P0 |
| C05 | GET | `/api/uv` | 공개 | P0 |
| F01 | GET | `/api/uploads/photo-rules` | 공개 | P0 |
| F02 | POST | `/api/uploads/presign` | 서버 검증 회원·게스트 세션 | P0 |
| F03 | POST | `/api/uploads/{assetId}/complete` | 서버 검증 회원·게스트 세션 | P0 |
| F04 | POST | `/api/uploads/{assetId}/read-url` | 서버 검증 회원·게스트 세션 | P0 |
| O01 | POST | `/api/orders` | 서버 검증 회원·게스트 세션 | P0 |
| O02 | GET | `/api/orders/{orderId}` | 서버 검증 회원·게스트 세션 | P1 |
| O03 | GET | `/api/orders` | 서버 검증 회원·게스트 세션 | P1 |
| R01 | GET | `/api/reviews` | 로그인 회원만; 게스트 제외 | P0 |
| R02 | POST | `/api/orders/{orderId}/review` | 로그인 회원만; 게스트 제외 | P0 |
| R03 | PATCH | `/api/reviews/{reviewId}` | 로그인 회원만; 게스트 제외 | P1 |
| P01 | POST | `/api/orders/{orderId}/demo-payment-attempts` | 서버 검증 회원·게스트 세션 | P0 |
| P02 | POST | `/api/demo-payments/{attemptId}/confirm` | 서버 검증 회원·게스트 세션 | P0 |
| P03 | GET | `/api/demo-payments/{attemptId}` | 서버 검증 회원·게스트 세션 | P0 |

### 4.1. 인증 계약에서 명시할 것

- 회원과 게스트는 서버의 실제 DB 세션 검증 결과로 구분한다. 요청의 ownerId/userId를 신뢰하지 않는다.
  게스트 생성 후 같은 세션을 재사용하며, 가입·로그인으로 게스트 주문/사진 소유권을 이전하지 않는다.
- 이메일 가입은 인증 대기 결과이며 회원 세션을 발급하지 않는다. 인증 링크 24시간, 인증 뒤 자동 로그인 OFF,
  비밀번호 재설정은 메일 링크와 기존 세션 무효화를 유지한다. 카카오는 자동 계정 연결 OFF를 유지한다.
- 익명 자동 삭제를 막고 업무 FK는 사용자 삭제 시 CASCADE로 지우지 않는다. 미인증 이메일 회원의 7일 정리는
  설계의 제외 조건(게스트·업무 참조·유효 세션/토큰·타 제공자)을 모두 만족할 때만 검토한다. 실행 주기/주체는 TBD다.
- `frontend/lib/auth.ts`의 password 없는 mock 로그인·가입 입력과 즉시 Member 반환은 후속 화면 계약 변경 대상이다.
  이재원이 서버 계약을 제안하고 준표가 화면 타입·함수·mock을 함께 맞춘다.
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
   이미 verified인 재호출은 동일 최종 결과, rejected/expired는 새 presign 안내를 검토한다.
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

### 4.4. 리뷰 — 설문 대체

`GET /api/reviews`는 로그인한 **isAnonymous=false 회원**에게만 허용한다. 게스트도 세션을 갖지만 회원 리뷰 권한은 없다.
작성은 본인 회원 주문에만 허용하고, 수정 후보는 본인 리뷰만 허용한다. 주문당 1개(UNIQUE order_id), 평점,
본문 길이·작성 가능한 제작 단계·수정/보관 정책은 아직 제안/TBD다. 테스트 결제 승인은 제작 완료 증거가 아니다.

회원은 다른 회원의 리뷰 목록을 볼 수 있으므로 작성자 owner 전용 RLS만으로는 목록 요구를 충족하지 못한다.
서버가 검증한 회원 컨텍스트로 리뷰 SELECT를 허용하되 쓰기는 owner로 제한하는 정책을 제안한다.
공개 투영은 리뷰 ID·제품/종류/색·표시 이름·본문·평점·시각만 내보내고 **타인의 orderId·ownerId·연락처·고객 사진 URL은 제외**한다.
리뷰의 제품·표시 이름 스냅샷은 서버가 본인 주문/계정에서 복사하여, 목록을 위해 타인의 주문 RLS를 풀지 않는다.

### 4.5. Toss 결제 시연

- 고객 주문 ID, 결제 시도 ID, Toss `provider_order_id`/`tossOrderId`는 구분한다. 시도는 본인 주문에만 만든다.
- 서버가 테스트용 금액/통화를 먼저 저장하고 SDK에 전달한다. 예시 12,000원은 정책 확정 금액이 아니다.
  확인 요청의 paymentKey·Toss orderId·amount를 서버 저장값·주문 소유권·테스트 모드와 대조한다.
- 테스트 client/secret의 일치와 SDK/키 종류·허용 결제 수단은 연동 시 공식 문서와 실제 테스트 응답으로 검증한다.
  키 이름을 보고 추정만 하거나 브라우저 성공 리디렉션만으로 승인 처리하지 않는다. 비밀 키는 서버에만 둔다.
- 테스트 승인 확인·조회만 연결한다. mode='test' 제약과 실환경 키 거부, 결과 `TEST_APPROVED`,
  actualCharge=false/settlement=false를 제안한다. 실제 PAID·정산·자동 제작/배송 시작 상태와 연결하지 않는다.
- CREATED/CONFIRMING/TEST_APPROVED/TEST_FAILED/UNKNOWN/EXPIRED는 상태 후보다. 중복 confirm은 같은 결과를 주고,
  동시 요청·응답 유실은 기존 시도를 조회/대사한 뒤 판단한다. 불명확한 결과에 새 결제 시도를 자동 생성하지 않는다.
  멱등 키 범위/만료와 상태 전이·조회/대사 실행 주체·재시도 상한은 공동 합의한다.

## 5. ERD 검토 — 적용 1개 / 후보 10개

ERD는 11개 엔티티·106개 컬럼이다. 그중 `sunny_meta.schema_migrations` 1개·6컬럼만 기반 적용 기록이며,
나머지 인증 4개·업무 6개, 총 100개 컬럼은 후보다. 최신 main에는 #81의 migration 도구가 아직 없다.
아래 컬럼 목록은 입력 ERD의 대조 목록이며 실제 DDL 정의가 아니다.

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
| `app.reviews` | 11 | `id`, `order_id`, `owner_id`, `product_slug`, `product_kind`, `color`, `author_display_name`, `content`, `rating`, `created_at`, `updated_at` | 미적용 후보 |
| `app.demo_payment_attempts` | 14 | `id`, `order_id`, `owner_id`, `mode`, `provider_order_id`, `provider_payment_key`, `amount_krw`, `currency`, `status`, `idempotency_key`, `created_at`, `confirmed_at`, `last_error_code`, `updated_at` | 미적용 후보 |
| `sunny_meta.schema_migrations` | 6 | `version`, `name`, `checksum`, `applied_at`, `applied_by`, `execution_ms` | 기반 적용 기록 |

| 관계 / 제약 | 검토 결과 |
|---|---|
| auth.user → orders/photo_assets | ID 타입과 실제 Better Auth adapter SQL을 먼저 맞추고 FK 연결. 업무 참조가 있으면 사용자 삭제 RESTRICT/NO ACTION |
| orders(id,owner_id) → order_beads/order_consents/reviews/demo_payment_attempts | 부모 복합 UNIQUE와 자식 복합 FK로 타인 주문 연결 차단 후보 |
| photo_assets(id,owner_id) → order_beads(photo_asset_id,owner_id) | null 허용·같은 asset 반복 허용. asset_id 단독 UNIQUE를 beads에 추가하지 않음. verified 조건은 FK와 별도로 검사 |
| orders → beads | 정확히 7은 트랜잭션/지연 검사까지 검토. 부분 생성·슬롯 삭제도 실패해야 함 |
| orders → consents | 0..2개 사진 동의. 사진 포함 시 제작 true, 선택 동의 거절 허용. 주문 개인정보 동의 정책은 별도 TBD |
| orders → reviews | 0..1은 후보이며 회원 본인 주문 작성과 회원 전체 조회의 권한을 분리 |
| orders → demo_payment_attempts | 0..N 시도, provider_order_id UNIQUE 후보, 테스트 mode CHECK, 금액/통화 제약·중복 처리 후보 |
| Sanity → product_slug | 외부 CMS 논리 참조이며 SQL FK가 아님. 주문 시 제품 종류·색·길이 검증과 스냅샷 정책 필요 |

RLS는 auth/app 역할 분리 위에서 설계한다. sunny_app에 인증 토큰/계정 조회 권한을 주지 않는다.
서버가 DB 세션에서 확인한 owner와 회원 여부만 **동일 client의 요청별 트랜잭션**에 전달한다.
`app.user_id`와 리뷰용 `app.is_member` 후보는 인증 수단이 아니며 요청 본문·임의 헤더에서 받지 않는다.
컨텍스트가 없으면 거부하고 COMMIT/ROLLBACK 뒤 풀의 이전 사용자 값이 남지 않아야 한다.
보호 업무 테이블은 ENABLE/FORCE RLS, UPDATE는 USING/WITH CHECK 모두 검토하며 runtime에 DDL·TRUNCATE를 허용하지 않는다.
R2 객체 바이트에는 PostgreSQL RLS가 직접 적용되지 않으므로 URL 발급/주문 연결 시 서버 소유권 검사를 유지한다.

## 6. 공동 검토 결정표

채택된 제공자·게스트 분리·7칸·이메일 인증 24시간은 설계/팀 리뷰에 근거한다.
리뷰·결제 시연 요구는 최신 사용자 요청이지만 정본에는 미반영이다. 아래 TBD를 운영값으로 확정하지 않는다.

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
| T12 리뷰 상세 정책 | 설문 기능은 최신 사용자 요청으로 제외. 로그인 회원만 조회·본인 주문만 작성은 확정. 작성 가능 제작 단계·평점·본문 길이·수정·보관·신고/관리 절차·주문당 1개 안을 합의. | 공동 계약 |
| T13 배포·동작 검증 | 운영 PostgreSQL 위치/TLS/백업/연결 제한, Vercel 네트워크·R2 개발/운영 CORS·실제 이미지 처리 라이브러리·SDK 추가 이슈. | 서버·배포 이슈 |
| T14 시연 운영·마이그레이션 | SDK/테스트 키 유형·시연 금액/결제수단·키 세트 검증·멱등/조회 복구·작성 상태 정책을 계약으로 확정. 인증 UUID 설정/복합 FK/RLS/정확히 7칸 trigger를 새 migration으로 적용. | 공동 계약 후 별도 구현 이슈 |

## 7. 반영 순서·담당·검증 기준

| 순서 | 즉시 할 일 | 담당 / 완료 증거 |
|---|---|---|
| 1 | 이 제안의 범위·TBD를 검토해 인증·주문·리뷰·테스트 결제의 공동 계약 이슈/허용 파일을 확정 | 이재원 제안, 준표와 합의. 이 문서 PR 머지만으로 API 계약이 확정되는 것은 아님 |
| 2 | 인증/게스트 계약을 정본에 반영하고 기존 #65에서 R2·게스트·URL 변경 및 main 충돌 해결 | 기존 사진 PR 재원, 정본 반영·공동 승인 준표/재원. 계약 파일을 동시에 고치는 후속 PR은 앞선 머지를 반영해 순차 처리 |
| 병행 | #81 기반 PR의 질문 답·확인 문구 정리와 리뷰 | 이재원 본인 답, 팀장 머지. 새 업무 SQL을 섞지 않음 |
| 3 | 정본의 설문→리뷰, 주문 DTO/7칸/동의, 테스트 결제를 합의한 작은 계약 PR들로 반영 | 실제 응답 예시 = mock = 타입, P0/P1 및 오류·시각 대조. 화면 변경은 준표 범위 |
| 4 | 기반 + 해당 계약이 준비되면 서버 pool/트랜잭션 → 인증 schema/adapter/API | 별도 back 이슈, 최소 권한·교차 사용자 거부·세션 무효화·컨텍스트 격리 검증 |
| 5 | 사진 → 주문 → 리뷰 → 테스트 결제 구현 | 각 back 이슈와 migration 분리. 사진 없는 7칸 주문은 주문 계약 확정 후 먼저 검증 가능 |
| 병행 | Sanity/약관/UV 및 기존 #80 | 각각 계약 확정 뒤 별도 범위로 진행. `/api/sky`를 UV와 임의 통합하지 않음 |

합의와 구현의 검증은 구별한다. 이번 문서 검토에서는 API 29개/ERD 11개·106컬럼 대조,
입력 지문, PR 상태, Markdown diff/허용 파일을 확인한다. API 실행·DB migration·Toss 테스트 승인·R2 업로드의
통합 검증은 아직 하지 않았으며 해당 구현 PR의 수용 기준으로 남긴다.

후속 계약/구현에서 반드시 확인할 실패 사례:

- 만료/위조 세션, 게스트의 리뷰 조회·작성, 회원의 타인 주문 리뷰, 타인 사진·주문 조회/연결 거부.
- 6칸/8칸/중복 index·범위 밖 index 거부, 동일 asset 재사용과 7칸 all-null 주문 허용, 부분 저장 rollback.
- 사진 포함 제작 동의 거절/오래된 정책 버전 거부, 브랜드 공개 거절 주문 허용, 서버 동의 시각 기록.
- pending 덮어쓰기·동시 complete·R2 저장 뒤 DB 실패에도 검증 바이트만 확정, URL 만료와 정리 재시도.
- 리뷰 목록에 타인 주문/소유자/연락처/고객 사진 URL이 없고 회원 조회를 위해 주문 RLS를 완화하지 않음.
- 결제 금액/번호/소유자/테스트 키 불일치 거부, 중복/응답 유실 대사, 테스트 승인이 제작/실결제로 전환되지 않음.
- API 계약·mock·실제 응답 동일성, 잘못된 DB 계정 거부, 컨텍스트 누수와 auth/app 역할의 교차 접근 거부.
