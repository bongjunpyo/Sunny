# PostgreSQL 설계 분석과 테이블 검토안

기반 이슈: [#79](https://github.com/bongjunpyo/Sunny/issues/79). 기준: main `63d6233`의
[`postgres-design.md`](../postgres-design.md), [`CONTRACT_API.md`](../../docs/CONTRACT_API.md),
[#71 팀장 답변](https://github.com/bongjunpyo/Sunny/issues/71#issuecomment-6076363050),
[PR #65](https://github.com/bongjunpyo/Sunny/pull/65).

**업무 테이블과 컬럼은 검토 제안이다. 계약을 대체하지 않으며 아직 적용하지 않는다.**
이번 구현은 개발 DB·역할·분리된 schema·migration 이력 테이블까지다.
인증/사진/주문/설문 테이블은 계약 합의 후 별도 migration으로 적용한다.

## 1. 설계 11개 절의 구현 영향

| 설계 절 | 확인한 요구 | 이번 작업 / 후속 조건 |
|---|---|---|
| 1. 결정 | Next.js 유지, 독립 PostgreSQL, Better Auth/R2, 게스트·회원 분리 | 서버 프레임워크/서비스를 추가 변경하지 않음 |
| 2. 구조 | DB만 Docker, 호스트 5434, 컨테이너 5432, loopback | `sunny-dev`, `sunny`, `sunny-dev_pgdata`로 다른 DB와 분리 |
| 3. Compose | PostgreSQL 17, healthcheck, 최초 초기화와 migration 분리 | `17-bookworm`; 초기화 스크립트는 역할만 생성; 최종 TCP readiness 확인 |
| 4. 권한 | 관리자/NOLOGIN owner/app/auth 분리, 서버 전용 비밀값 | 역할 4개, runtime의 CREATE/TEMP/owner 멤버십 차단; 로컬 설정은 ignored 0600 |
| 5. DBeaver | 관리/업무 연결별 Test Connection·SELECT 1 | 두 연결을 각각 확인; 스키마 직접 수정 금지 |
| 6. Next.js | server-only pool, 동일 client 트랜잭션, 매개변수 SQL | 이번 DB 작업에 앱 연결·라이브러리 설치 없음; 별도 구현 이슈 |
| 7. 인증/사진/RLS | 세션 검증 → 업무 context, private R2, 별도 verified key | 어댑터·입력/반환·owner FK·정책 합의 후 업무 테이블 적용 |
| 8. migration | 순번/checksum/이력/원자 적용, 볼륨 보존 | Python stdlib + Docker/psql runner; 동일 세션 advisory lock, 파일별 트랜잭션 |
| 9. 검증 | 실제 TCP 인증, 최소 권한, rollback, 재실행, 재생성 | 기반에서 검증; A/B 업무 RLS는 업무 계약과 테이블 적용 후 |
| 10. 파일 | 구현 이슈에 필요한 파일만 허용 | #79 허용 목록만 변경 |
| 11. 정리 | Supabase 코드 정리와 실제 서비스 폐기 구분 | 기존 컨테이너·프로젝트·볼륨·데이터를 삭제하지 않음 |

현재 main 계약은 `미확정 (v0 틀)`이며 컬럼·FK·주문/설문 요청/응답이 없다.
PR #65는 R2 출처, URL 재사용/덮어쓰기, 새 인증 계약, 게스트 권한 조정이 필요하다.
다만 검증된 게스트의 사진 업로드 허용은 #71 최신 댓글에서 이미 채택됐다.
이 문서와 계약 검토에는 해당 결정을 유지한다.

## 2. 실제 생성하는 기반

| 대상 | 소유자 / 허용 접근 |
|---|---|
| DB `sunny` | `sunny_admin`; runtime 역할에는 CONNECT만 부여 |
| schema `sunny_meta` | `sunny_owner`; runtime 접근 없음 |
| schema `auth` | `sunny_owner`; `sunny_auth`에 USAGE만 |
| schema `app` | `sunny_owner`; `sunny_app`에 USAGE만 |
| table `sunny_meta.schema_migrations` | `sunny_owner`; 관리 연결/runner만 조회·기록 |

`schema_migrations` 컬럼:

| 컬럼 | 타입 | 제약 / 의미 |
|---|---|---|
| `version` | integer | PK, 양수, 적용 순번 |
| `name` | text | UNIQUE, `0001_description.sql` 형식 |
| `checksum` | text | SHA-256 64자리 소문자 hex, 적용 후 변경 거부 |
| `applied_at` | timestamptz | NOT NULL, 서버 적용 시각 |
| `applied_by` | name | NOT NULL, 실제 세션 로그인 역할 |
| `execution_ms` | bigint | NOT NULL, 0 이상, 실행 소요 시간 |

이 테이블에는 고객 데이터가 없고 runtime에 권한을 주지 않는다.
주문·설문·사진의 RLS를 이 기반 테이블 생성으로 구현 완료라고 주장하지 않는다.
인증/업무 schema는 아직 비어 있다. 향후 각 migration에서 실제 table owner와
명시적인 grant를 설정하며, 업무 테이블은 RLS와 함께 생성한다.

## 3. 인증 테이블 — 어댑터 생성 스키마 확인 후 적용

[Better Auth DB 공식 문서](https://better-auth.com/docs/concepts/database)의 핵심 모델은
`user`, `session`, `account`, `verification`이다. 실제 버전·어댑터·anonymous 플러그인
설정으로 생성한 SQL과 아래 논리 모델을 대조한다. 모델명/필드명 매핑도 그때 확정한다.

| 논리 모델 | 검토할 컬럼 | 검토 제약 |
|---|---|---|
| user | ID, name, email, emailVerified, image, createdAt, updatedAt, isAnonymous | UUID ID 제안; 이메일 unique; anonymous 플러그인 필드 반영 |
| session | ID, userId, token, expiresAt, createdAt, updatedAt, ipAddress, userAgent | user FK, token unique, 세션/OAuth 토큰은 업무 역할·응답에서 접근 차단 |
| account | ID, userId, providerId, accountId, password 및 어댑터의 OAuth 필드, 시각 | 비밀번호는 라이브러리 해시; 동일 이메일 OAuth 오류 흐름 확인 |
| verification | ID, identifier, value, expiresAt, createdAt, updatedAt | 가입 인증/재설정 토큰은 별개 수명; 라이브러리 schema와 보관 방식 확인 |

UUID를 채택하면 `advanced.database.generateId: "uuid"` 지원과 모든 사용자 FK 타입을
함께 확인한다. `user`에 별도 평문 비밀번호 컬럼을 만들지 않는다.
회원 별명은 기본 `name`과 매핑할지 추가 필드를 쓸지 계약에서 정한다.
`sunny_auth`만 adapter에 필요한 DML을 받고, 업무 RLS의 사용자 context를
로그인 전 인증 테이블에 그대로 적용하지 않는다.

정책 결정: 이메일 인증 필수, 가입 직후 인증 대기, 인증 후 자동 로그인 없음,
가입 인증 링크 24시간, 조건에 맞는 미인증 이메일 계정만 7일 후 정리 대상으로 삼음.
게스트 자동 삭제/회원 소유권 이전 금지, owner FK `ON DELETE CASCADE` 금지.
게스트 복구·세션/재설정 링크 수명·실제 발신 도메인·요청 제한은 후속 계약 대상이다.

## 4. 사진 메타데이터 — `app.photo_assets` 후보

아래 컬럼명·타입은 후보이며 migration이 아니다.

| 컬럼 후보 | 타입 후보 | 필요한 의미/제약 |
|---|---|---|
| id | uuid | PK, 서버 발급 assetId |
| owner_id | uuid | NOT NULL, 확정한 user FK; 삭제 RESTRICT/NO ACTION 검토 |
| purpose | text | 허용 목적 목록, 주문 사진 목적 |
| status | text | pending/검사 중/verified/rejected 상태 및 전이 확정 |
| pending_key | text | private 임시 객체 key, 임의 생성·충돌 방지 |
| verified_key | text | 검사한 동일 바이트를 정제한 별도 객체 key |
| content_type / byte_size | text / bigint | 서버가 확인한 형식·실제 크기, 유효 범위 검사 |
| width / height | integer | 서버 디코딩/방향 보정 후 픽셀 수 |
| created_at / upload_expires_at / verified_at | timestamptz | 서버 시각, 상태별 NULL 규칙 확정 |
| deletion_due_at / deleted_at | timestamptz | 보관·삭제 재시도와 DB/R2 정합성 |

영구 공개 URL·서명 URL을 컬럼에 저장하지 않는다. 사진 바이트는 R2에 둔다.
업로드/조회 URL 수명, 상태 전이, 검사 경합 확보, 완료 멱등성, 정리 주체/기간을
계약에서 정해야 한다. `pending` 덮어쓰기는 가능하다고 보고 verified 결과를 분리한다.
형식/최대 용량/최소 해상도의 PR #65 값은 아직 provisional이며 운영 제약으로 확정하지 않는다.

## 5. 주문·7칸 배치·동의 후보

| 테이블 후보 | 컬럼 후보 | 검토 항목 |
|---|---|---|
| app.orders | id uuid, owner_id uuid, product_slug text, 색상/길이, 고객 이름/연락처, created_at | 실제 요청 필드와 필수 여부 확정; Sanity 제품은 참조값만 사용; owner는 서버 세션에서만 결정 |
| app.order_beads | order_id uuid, slot_index smallint, photo_asset_id uuid NULL | PK(order_id, slot_index), index 0~6, 사진 없는 칸 NULL, 중복 사진 사용 허용 |
| 주문 동의 컬럼 또는 별도 동의 테이블 | 제작/브랜드 공개 동의 여부·서버 수신 시각·정책 버전·가시안 확인 시각 | 사진이 있으면 제작 동의 필수, 브랜드 공개는 별도 선택; 정책 버전/보관 정책 확정 필요 |

네모 비즈 7칸은 제품 종류/길이와 무관한 채택 요구다. `slot_index` 범위와 PK만으로는
**행 수가 정확히 7인 것**까지 보장하지 못한다. 원자적 주문/7칸 저장 및 필요 시 지연
constraint trigger를 검토한다. 사진 FK만으로는 본인 소유·verified까지 보장하지 못하므로
서버 트랜잭션 검증, RLS, 복합 FK/제약 전략을 함께 합의한다.

색상은 기존 타입의 red/orange/blue/yellow/violet 5색을 기준으로 맞춘다.
길이는 화면 선택지를 계약에 반영하고 단위/저장 타입을 확정한다.
주문 상태·상태 변경 주체·이름/연락처 형식·조회 인증·보관 기간은 임의로 정하지 않는다.
제품 목록·제작 기록용 PostgreSQL 복제 테이블은 만들지 않는다(Sanity가 정본).

## 6. 설문 후보

`app.survey_responses`에는 응답 ID·설문 버전·서버 수신 시각·확정된 답변을 저장하는 안을 검토한다.
응답 컬럼은 **문항, 단일/복수 선택, 익명 여부, 중복 제출 기준** 확정 후 정한다.
owner_id를 NULL로 만들거나 인증 없이 INSERT를 허용하는 정책을 지금 선택하지 않는다.
자유 입력/JSONB를 검토하더라도 허용 문항/값·용량을 검증하는 계약이 먼저 필요하다.

## 7. 업무 RLS·API 구현 진입 조건

1. 준표·재원이 새 인증 및 PR #65의 업로드/주문 계약을 합의한다.
2. user ID·FK, 게스트/회원 API 권한, 주문·사진·설문 필드와 제약을 확정한다.
3. 검토한 adapter SQL와 업무 DDL/RLS/grants를 새 migration으로 기록한다.
4. 앱 역할로 A/B 교차 조회·다른 owner INSERT/UPDATE·owner 변경을 거부하는지 검증한다.
5. 인증 context 없이 업무 접근 거부, COMMIT/ROLLBACK·풀 재사용 이후 이전 사용자 context 잔존 없음,
   auth/app 역할의 상호 비공개 table 접근 거부를 확인한다.
6. 게스트의 로그인/가입 후에도 기존 주문/사진 owner와 FK를 보존한다.

`set_config('app.user_id', ..., true)`는 서버가 이미 검증한 사용자 ID를 DB에 전달하는 수단이다.
그 설정 자체를 인증으로 취급하지 않으며 DB 자격증명을 최종 사용자에게 주지 않는다.
DB RLS는 R2 바이트 접근을 직접 막지 않는다. 조회 URL 발급/주문 연결 시 서버가
본인 소유·verified·허용 목적을 다시 검사한다.
