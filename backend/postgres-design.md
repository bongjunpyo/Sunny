# Next.js + PostgreSQL 개발 환경 설계 초안

이슈: [#71](https://github.com/bongjunpyo/Sunny/issues/71) · 작성: 2026-10-07 · 상태: 검토용 제안

이 문서는 구현 계획이며 기존 API 계약이나 환경변수 원본을 대체하지 않는다. 확정된 내용은 팀장이 거버넌스 문서에 반영하고, 외부 서비스·환경변수·실행 절차는 구현 시 `backend/README.md`에 반영한다.

## 1. 결정과 미정 사항

사용자 결정: 서버 프레임워크는 **Next.js Route Handlers 유지**, **Supabase 전체(DB·Auth·Storage·SDK·CLI) 제외**, 애플리케이션 DB는 **독립 PostgreSQL**, 개발 DB 서버는 **Docker Compose로 실행**, 관리·조회는 **DBeaver**로 수행한다. FastAPI 전환은 철회됐다.

| 항목 | 이번 설계 |
|---|---|
| API 위치 | `frontend/app/api/**/route.ts` 유지 |
| 서버 전용 연결 | `frontend/lib/server/` 유지 |
| CMS / 자외선지수 | Sanity / 기상청 기존 방향 유지 |
| 로컬 실행 범위 | PostgreSQL만 Docker, Next.js는 npm 실행을 기본 제안. 둘 다 Docker로 실행할지는 TBD |
| Auth | Supabase Auth 제외 확정. Better Auth + PostgreSQL DB 세션을 추천하며 채택·세부 정책은 TBD |
| 고객 사진 Storage | Supabase Storage 제외 확정. private Amazon S3를 추천하며 Cloudflare R2도 후보. 제공자·정책은 TBD |
| 개인정보 접근 | Next.js의 세션·소유권 검사 + PostgreSQL 자체 RLS 유지 |
| 운영 DB | 위치·제공자·TLS·백업·연결 제한 TBD |

기존 `feat/back-fastapi-foundation`의 `6d68995`는 작업 기록으로 보존한다. 새 브랜치는 `origin/main`에서 시작하며 FastAPI 코드·프록시·Python 의존성을 가져오지 않는다. 이번 제외 결정은 새 구현의 의존성에 관한 것이다. 기존 Supabase 프로젝트·환경파일·데이터의 실제 폐기는 별도 작업이다. main의 코드·설정·거버넌스 정리는 팀장 요청으로 분리한다(11절).

## 2. 개발 구조

```text
브라우저 ── HTTP ──> Next.js 화면 / Route Handlers (localhost:3000)
                          │ 서버 전용 pg 연결
                          ▼
                    127.0.0.1:5434
                          │ Docker 포트 매핑
                          ▼
DBeaver ── PostgreSQL ──> PostgreSQL 컨테이너 (db:5432)
                          │
                          ▼
                     named volume
```

브라우저는 DB 접속 문자열을 받지 않는다. DBeaver는 DB 클라이언트이며 서버 역할은 PostgreSQL 컨테이너가 맡는다. DB는 호스트 loopback에만 바인딩한다.

2026-10-07 로컬 확인 시 `5433`은 Docker 프로세스가 사용 중이었다. 개발 포트는 `5434`를 제안하고 실제 시작 직전에 충돌을 재확인한다. 기존 컨테이너나 포트를 중단해 확보하지 않는다.

| 접속 주체 | DB host / port |
|---|---|
| 호스트에서 npm으로 실행한 Next.js | `127.0.0.1:5434` |
| 호스트의 DBeaver | `127.0.0.1:5434` |
| 같은 Compose 네트워크의 앱 컨테이너를 추가할 경우 | `db:5432` |

## 3. Compose 초안

다음 코드는 후속 구현의 `backend/docker-compose.yml` 후보다. **현재 실행 파일을 생성하거나 DB를 시작한 상태가 아니다.** PostgreSQL 17은 제안 버전이며 실제 구현 때 지원 상태와 이미지 태그를 확인한다. PostgreSQL 18 이상으로 변경할 때는 공식 이미지의 데이터 디렉터리 변경도 함께 반영한다.

```yaml
name: sunny-dev

services:
  db:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: sunny
      POSTGRES_USER: sunny_admin
      POSTGRES_PASSWORD: ${SUNNY_PG_ADMIN_PASSWORD:?Set SUNNY_PG_ADMIN_PASSWORD locally}
    ports:
      - "127.0.0.1:${SUNNY_PG_PORT:-5434}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

volumes:
  pgdata:
```

Compose 이름과 volume key로 `sunny-dev_pgdata` 볼륨을 식별한다. 초기화 스크립트는 역할 생성만 맡도록 후속 이슈에서 설계한다. `/docker-entrypoint-initdb.d`는 빈 볼륨의 첫 초기화 때만 실행되므로 업무 마이그레이션의 실행 도구로 사용하지 않는다. [공식 PostgreSQL 이미지](https://hub.docker.com/_/postgres)

`pg_isready`는 서버 준비 상태를 확인한다. 실제 비밀번호 인증·권한은 별도 TCP 접속으로 검증한다. Next.js도 Docker에 넣는 경우 `depends_on: db: condition: service_healthy`와 앱 자체의 연결 실패 처리를 추가한다. [Docker 시작 순서](https://docs.docker.com/compose/how-tos/startup-order/), [pg_isready](https://www.postgresql.org/docs/17/app-pg-isready.html)

## 4. 계정과 환경변수 제안

| DB 역할 | 권한과 사용처 |
|---|---|
| `sunny_admin` | 이미지 초기 관리 계정. 로컬 역할 초기화·관리·마이그레이션, DBeaver 관리 연결에만 사용 |
| `sunny_owner` | `NOLOGIN` 테이블 소유 역할 제안. 앱 역할에 소유 역할의 멤버십을 주지 않음 |
| `sunny_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`. 필요한 schema USAGE와 테이블 DML만 부여. Next.js 런타임에 사용 |
| `sunny_auth` | 후속 인증 구현의 전용 `LOGIN NOSUPERUSER NOBYPASSRLS` 역할 제안. 인증 테이블·세션 검증에 필요한 권한만 부여하며 주문·사진 테이블 DML은 주지 않음 |

이미지의 `POSTGRES_USER`는 초기 superuser다. 따라서 위 Compose의 관리 계정으로 앱을 연결하지 않는다. `sunny_app`의 역할·비밀번호·grant 생성이 완료되기 전에는 앱 연결 단계로 넘어가지 않는다. [공식 이미지](https://hub.docker.com/_/postgres)

| 환경변수 후보 | 위치 | 용도 |
|---|---|---|
| `SUNNY_PG_PORT` | `backend/.env.local` | 호스트 개발 DB 포트, 기본 제안 5434 |
| `SUNNY_PG_ADMIN_PASSWORD` | `backend/.env.local` | 개발 관리 계정 비밀번호 |
| `SUNNY_PG_APP_PASSWORD` | `backend/.env.local` | 앱 역할 초기화·인증 확인. Compose 초안에서는 아직 사용하지 않음 |
| `DATABASE_URL` | `frontend/.env.local` / 향후 배포 설정 | `sunny_app`의 서버 전용 연결 문자열 |

견본에는 비밀번호를 비워 두고 실제 값은 ignored 환경파일에만 둔다. `NEXT_PUBLIC_` 접두사는 사용하지 않는다. URL에 비밀번호를 넣을 경우 URL 인코딩을 적용한다. 마이그레이션의 관리 연결 문자열은 앱 런타임 설정에 넣지 않는다.

Auth·객체 저장소 채택 후 별도 인증 DB 연결, 인증 secret, 카카오 client ID/secret, 이메일 발송 설정, 객체 저장소 endpoint/region/bucket/자격증명 이름을 구현 이슈와 `backend/README.md`에서 확정한다. 여기의 후보를 현재 필수 환경변수로 취급하지 않는다.

Compose는 명시적으로 `--env-file backend/.env.local`을 사용한다. 셸의 같은 이름 변수가 파일 값을 덮어쓸 수 있으므로 충돌 여부를 값 노출 없이 확인한다. `docker compose config -q`로 검증하고 비밀번호가 펼쳐지는 전체 config 출력은 남기지 않는다. [Compose 환경변수 우선순위](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)

## 5. 시작과 DBeaver 연결 절차

아래는 **후속 구현 파일과 로컬 비밀번호가 준비된 뒤** 수행할 절차다.

```sh
# 저장소 루트에서 수행
lsof -nP -iTCP:5434 -sTCP:LISTEN
docker compose --env-file backend/.env.local -f backend/docker-compose.yml config -q
docker compose --env-file backend/.env.local -f backend/docker-compose.yml up -d --wait db
docker compose --env-file backend/.env.local -f backend/docker-compose.yml ps

# Next.js는 별도 터미널에서 실행
cd frontend
npm ci
npm run dev
```

DB 이미지가 최초 준비되는 시간과 앱 시작 시간을 구분한다. `up --wait` 통과는 DBeaver 또는 앱 계정의 인증 성공을 뜻하지 않는다.

1. DBeaver에서 **Database → New Database Connection → PostgreSQL**을 선택한다.
2. Host `127.0.0.1`, Port `5434`, Database `sunny`, Username `sunny_admin`을 입력한다. 비밀번호는 로컬 값으로만 입력한다.
3. **Test Connection**으로 드라이버와 TCP 인증을 확인한 뒤 Finish한다.
4. SQL Editor에서 `SELECT current_database(), current_user;`와 `SELECT 1;`을 실행한다.
5. `sunny_app` 연결도 별도로 생성하여 역할과 허용 권한을 확인한다. 관리 연결만 성공한 것을 앱 연결 성공으로 보고하지 않는다.

DBeaver에서 업무 테이블을 임의 생성·변경하지 않는다. 스키마 변경은 저장소의 마이그레이션으로 기록하고 DBeaver는 조회·검증에 사용한다. [DBeaver 연결 문서](https://dbeaver.com/docs/dbeaver/Create-Connection/)

## 6. Next.js 연결 설계

후속 라이브러리 제안은 `pg`와 개발 타입 `@types/pg`다. 이번 설계에서는 설치하지 않는다. `frontend/package.json`과 lockfile의 변경 허용 범위를 구현 이슈에 먼저 적는다.

- `frontend/lib/server/postgres.ts`에 `import "server-only"`를 두고 서버 전용 pool을 제공한다.
- DB를 쓰는 Route Handler는 Node.js runtime을 사용한다.
- 프로세스당 pool을 재사용하고 개발 hot reload에서도 중복 pool 생성을 피한다.
- 연결 수·획득 대기·쿼리 시간 제한은 초기 로컬 값과 운영 DB 제한을 구분해서 정한다.
- SQL은 `$1`, `$2` 매개변수를 사용한다. 접속 URL·비밀번호·개인정보는 오류 응답이나 로그에 넣지 않는다.
- 트랜잭션은 `pool.connect()`로 얻은 **동일 client**에서 BEGIN부터 COMMIT/ROLLBACK까지 처리한다. `finally`에서 반환하고 rollback 실패 등 연결 상태를 복구하지 못한 경우 연결을 폐기한다.
- 일반 단일 쿼리와 사용자 컨텍스트가 필요한 업무 트랜잭션을 구분한다. 보호 데이터는 아래 요청별 컨텍스트 경로로만 접근한다.

연결 풀 재사용·반환 및 동일 client 트랜잭션 원칙은 [node-postgres pooling](https://node-postgres.com/features/pooling), [transactions](https://node-postgres.com/features/transactions)을 따른다. DB 연결 확인용 API를 추가한다면 인증 정보와 DB 구조를 공개하지 않는 응답 모양부터 계약에 제안한다.

## 7. 인증·Storage·RLS 경계

**Supabase Auth·Storage도 사용하지 않는다.** 독립 PostgreSQL에는 Supabase의 `auth.users`, `auth.uid()`와 JWT 전달 계층이 기본 제공되지 않는다. 인증·객체 저장·DB 권한을 각각 설계하되 하나의 서버 검증 사용자 ID로 연결한다. 아래 제품 선택은 공식 자료를 확인한 추천안이며 확정 계약은 아니다.

| 책임 | 추천 구현 | 경계 |
|---|---|---|
| 본인 확인 | Next.js 서버의 Better Auth + PostgreSQL DB 세션 | 쿠키 유무만 보지 않고 유효한 세션을 검증해 사용자 ID를 얻음 |
| 업무 권한 | Next.js 서버 API + PostgreSQL RLS | 검증한 사용자의 주문·사진·설문 범위와 회원/비회원 권한 검사 |
| 사진 바이트 | private S3 버킷. R2는 대안 | 저장소 자격증명은 서버 전용, 브라우저에는 제한된 서명 업로드/조회 권한만 전달 |
| 사진 메타데이터 | PostgreSQL `photo_assets` 등 후속 계약 | owner ID·객체 key·검증 상태·동의·만료 시각을 저장하며 영구 공개 URL을 저장하지 않음 |

### 7.1. 인증 추천 — Better Auth + PostgreSQL

현재 요구인 이메일·비밀번호, 카카오 로그인, 비밀번호 재설정, 비회원 주문에 맞춰 Better Auth를 우선 검토한다. 공식 문서에 Next.js Route Handler 통합, PostgreSQL 연결, 이메일/비밀번호와 재설정, 카카오 제공자, anonymous 플러그인이 있다. 비밀번호 해싱·OAuth·세션 프로토콜을 직접 새로 작성하는 부담을 줄일 수 있다는 점이 추천 이유다. [Next.js 통합](https://better-auth.com/docs/integrations/next), [DB 연결](https://better-auth.com/docs/concepts/database), [이메일/비밀번호](https://better-auth.com/docs/authentication/email-password), [카카오](https://better-auth.com/docs/authentication/kakao)

- 인증 설정은 `frontend/lib/server/`의 서버 전용 모듈로 두고 Next.js `/api/auth/*`에서 처리한다. 기존 화면 `frontend/lib/auth.ts`의 입력/반환과 라이브러리 경로가 다르면 계약과 서버 어댑터에서 맞춘다.
- 라이브러리 기본 JSON 응답과 기존 계약의 토큰 전달 제한도 대조한다. 브라우저 응답은 회원 표시 정보만 남기고 세션/OAuth 토큰은 반환하거나 브라우저 저장소에 보관하지 않는 서버 어댑터를 설계한다. 쿠키 설정·갱신 헤더는 정상 전달되어야 한다.
- 기본 제안은 PostgreSQL에 세션을 저장하고 HttpOnly 쿠키로 세션 식별자를 전달하는 방식이다. 운영의 `Secure`, `SameSite`, 만료/갱신과 상태 변경 API의 Origin/CSRF 검사를 계약한다. 보호 API는 매번 서버에서 DB 세션의 유효성을 확인한다. 쿠키 캐시를 켜는 경우 무효화 지연을 검토하고 민감 API는 캐시만으로 허용하지 않는다. [세션](https://better-auth.com/docs/concepts/session-management), [쿠키](https://better-auth.com/docs/concepts/cookies)
- 비밀번호 해싱은 라이브러리 기능을 사용한다. 비밀번호 재설정/이메일 확인은 발송 함수를 연결해야 하므로 이메일 발송 서비스·도메인도 별도로 필요하다. 재설정 후 기존 세션 무효화와 계정 존재를 드러내지 않는 응답을 계약한다.
- 카카오 redirect URL과 scope/동의 권한을 확인하고 이메일을 항상 받을 수 있다고 가정하지 않는다. 회원 연결은 검증된 제공자 식별자와 합의한 연결 정책으로 처리한다.
- 사용자·세션·계정·검증 토큰 모델은 실제 adapter 생성 스키마를 확인해 마이그레이션으로 기록한다. 사용자 ID는 UUID를 제안하되 기본 생성 ID가 UUID라고 가정하지 않는다. 채택 시 `advanced.database.generateId: "uuid"` 지원과 FK 타입을 함께 확인한다.
- 비회원은 anonymous 플러그인으로 서버가 검증한 게스트 세션과 사용자 ID를 발급하는 안을 검토한다. 단순 무인증 요청이나 nullable 주문 소유자로 대체하지 않는다. 회원 로그인/가입 시 기본 익명 사용자 삭제 전에 주문·사진 소유권 이전 또는 별도 안정적 주체 매핑을 구현해야 한다. 플러그인의 `onLinkAccount`만으로 우리 업무 데이터가 자동 이전되지는 않는다. 실패/재시도·중복 연결·소유권 보존을 검증한 후 사용한다. [anonymous와 계정 연결](https://better-auth.com/docs/plugins/anonymous)
- 게스트 세션을 잃은 주문 조회는 주문번호만으로 허용하지 않고 별도 이메일 코드 등 검증을 계약한다. 보관 기간·메일 인증·게스트 허용 API·세션 수명·요청 제한 수치는 TBD다.

인증 테이블은 업무 RLS와 다른 접근 경계를 가진다. 세션 검증은 아직 사용자 컨텍스트가 없는 상태에서 수행되므로 업무 테이블 정책을 그대로 복사하면 인증이 막힌다. `sunny_auth` 전용 역할/풀과 제한된 인증 테이블 권한으로 세션을 검증하고, 주문·사진은 `sunny_app`의 업무 트랜잭션으로 접근하는 분리를 제안한다. auth adapter의 schema/search_path·권한·마이그레이션 방식은 구현 전에 확인한다. 두 역할 모두 관리 계정이나 BYPASSRLS 권한을 받지 않는다.

### 7.2. 고객 사진 추천 — private Amazon S3

고객 원본은 공개 CMS 이미지와 구분해 private 객체 저장소에 둔다. PostgreSQL은 파일 바이트 대신 소유권·상태·객체 key를 관리한다. 브라우저는 Next.js에 업로드 권한을 요청하고, 서버가 허용한 객체와 메서드에만 짧게 서명된 권한으로 전송한다. 저장소의 서명 검사는 우리 DB의 회원/소유권 검사를 대신하지 않는다. [S3 presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

1. `presign`: 세션·Origin·사용자별 요청 제한·허용 규칙을 확인하고 서버가 `assetId`와 임의의 pending key를 생성한다. 본문 `ownerId`·파일명·임의 bucket/key를 신뢰하지 않는다.
2. 직접 업로드: private 임시 경로에만 서명한다. 용량을 저장소에서 제한하려면 S3 presigned POST의 `content-length-range`를 검토한다. 이 경우 기존 PUT URL 계약을 `method`·`fields` 등 POST 응답으로 바꿔야 하므로 PR #65에서 먼저 합의한다. Content-Type 조건은 파일 내용 검사가 아니다. [S3 POST 정책](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html)
3. `complete`: DB에서 사용자 소유권·상태를 확인한 뒤 서버가 실제 바이트·용량·형식·해상도를 검사한다. 방향 보정·재인코딩·EXIF 제거가 끝난 결과를 **브라우저 업로드 권한이 없는 별도 verified key**에 저장한다. 재사용 가능한 임시 업로드 서명으로 검증 완료 파일을 덮어쓸 수 없게 한다.
4. DB 확정: 처리 성공 후 `verified`로 전환한다. DB와 저장소는 하나의 트랜잭션이 아니므로 재시도 가능한 완료 처리와 고아 객체 정리 작업이 필요하다. 검사 중 409 및 멱등 완료 흐름은 PR #65와 일치시킨다.
5. 조회/주문: 서버가 본인 소유·verified·허용 목적을 확인한 뒤 GET 서명을 발급한다. 주문은 같은 검증을 다시 수행한다. 기존 7칸 배치·중복 사진 재사용·최대 7개 미리보기 URL 요구를 유지한다.
6. 삭제: pending/rejected/verified별 보관·동의 철회 규칙과 객체/DB 삭제 재시도를 정한다. 라이프사이클과 정기 정리 작업의 실행 주체·주기는 TBD다.

버킷 공개 접근을 차단하고 서명 역할은 필요한 bucket/prefix의 작업만 허용한다. 개발/운영 버킷과 자격증명을 구분하고 CORS origin/method를 좁힌다. presigned URL은 소지자가 만료 전 재사용할 수 있는 권한이므로 사용자 전용 링크나 일회용 토큰으로 설명하지 않는다. 로그/영구 데이터에 서명 URL을 남기지 않고 TTL은 3D 미리보기 사용 시간과 함께 합의한다.

Cloudflare R2도 S3 API 기반 private GET/PUT 서명 후보지만 공식 문서상 HTML form POST 서명 업로드는 지원하지 않는다. 따라서 S3 POST 용량 조건을 그대로 이식할 수 없으며 PUT + 서버 complete 검사와 미완료 객체 정리, 또는 별도 업로드 중계 방식을 결정해야 한다. 제공자 선택 전에 PR #65의 업로드 형식과 맞춘다. [R2 presigned URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

### 7.3. RLS 추천 — PostgreSQL 자체 기능 유지

**RLS는 Supabase 전용 기능이 아니라 PostgreSQL 기능**이므로 유지한다. Next.js가 세션으로 검증한 사용자 UUID를 **요청별 트랜잭션**에 전달하고, DB는 같은 사용자 범위만 허용한다. 다음은 컨텍스트 전달의 예시이며 바로 실행하는 마이그레이션이 아니다.

```sql
-- 동일 client의 BEGIN 이후, 검증된 UUID를 바인딩한다.
SELECT set_config('app.user_id', $1, true);
-- 보호 데이터 쿼리를 수행하고 COMMIT 또는 ROLLBACK한다.
```

세 번째 인자의 `true`는 트랜잭션 범위다. 정책은 예를 들어 `NULLIF(current_setting('app.user_id', true), '')::uuid`를 기준으로 소유권을 비교하고 컨텍스트가 없으면 거부한다. SELECT/DELETE는 `USING`, INSERT는 `WITH CHECK`, UPDATE는 기존 행과 변경 후 행을 모두 검사한다. 실제 사용자 컬럼·FK·회원/비회원별 정책 SQL은 계약 확정 후 작성한다. 클라이언트가 보낸 사용자 ID·헤더를 세션 검증 없이 컨텍스트로 사용하지 않는다.

`sunny_app`은 테이블 소유자·superuser·BYPASSRLS가 아니어야 한다. 보호 테이블은 ENABLE RLS와 FORCE RLS를 제안한다. FORCE도 superuser/BYPASSRLS는 막지 못한다. schema CREATE·TRUNCATE 등 불필요한 권한을 주지 않는다. 같은 client에서 컨텍스트 설정·업무 SQL·COMMIT/ROLLBACK을 처리하고 풀 반환 전 트랜잭션을 끝낸다. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [set_config 범위](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SET)

이 방식의 신뢰 경계는 검증된 Next.js 서버다. `app.user_id` 설정 자체는 인증이 아니며 앱 DB 자격증명을 가진 주체는 다른 값을 설정할 수 있다. RLS를 서버 탈취나 임의 SQL 실행까지 차단하는 수단으로 설명하지 않는다. 서버 인증·소유권 검사·매개변수 SQL·최소 DB 권한과 함께 사용하고 자격증명을 최종 사용자에게 제공하지 않는다. DB의 RLS는 S3/R2 바이트 읽기에 직접 적용되지 않으므로 사진 URL 발급/주문 연결 시 서버가 소유권과 상태를 다시 확인한다.

### 7.4. 기존 계약과 후속 작업

| 기존 작업 | 유지할 요구 / 새로 조정할 것 |
|---|---|
| #70 (조회 기준 closed) | 비회원 주문·카카오·재설정·HttpOnly 서버 인증 요구 유지. Supabase 사용자/JWT/SSR 전제는 후속 인증 계약에서 대체 |
| PR #65 (조회 기준 open) | 업로드 검사·verified·소유권·동의·7칸·409/429·private 조회 유지. 제공자·PUT/POST·응답 형태·계정 연결 시 사진 소유권 조정 |
| #69 (조회 기준 closed) | 주문/설문 제약·RLS 요구 유지. Supabase MCP/CLI 적용 지시를 독립 PostgreSQL migrations·grants·컨텍스트 정책으로 대체 |

위 상태는 2026-10-07 조회값이며 실제 구현이나 계약 합의 완료를 뜻하지 않는다. 닫힌 Supabase 이슈를 그대로 실행하지 않고 새 계약/구현 이슈에서 확정한다. Auth·Storage 라이브러리, 이메일 서비스, 세션·업로드 제한·보관 기간·정책 버전·운영 도메인은 팀 합의 전 TBD로 남긴다.

## 8. 마이그레이션과 복구

후속 경로 제안은 `backend/postgres/migrations/`다. 순번·checksum·적용 이력을 기록하고 중복 적용·이력 불일치는 실패 처리한다. 하나의 변경을 가능한 한 트랜잭션으로 적용하고 실패 후 이력이 어긋나지 않는지 검증한다. 구체적인 실행 도구는 후속 이슈에서 선택한다.

기존 Supabase 마이그레이션은 먼저 현황을 조사하고, Auth·Storage 스키마 의존성을 재설계한 뒤 이식 여부를 결정한다. 원격 데이터가 없다고 가정하지 않는다. 업무 계약 확정 전에는 개발 역할 기반까지만 준비한다.

일반 종료는 다음과 같이 볼륨을 보존한다.

```sh
docker compose --env-file backend/.env.local -f backend/docker-compose.yml down
```

비밀번호 환경변수를 바꿔도 기존 볼륨의 DB 역할 비밀번호가 자동 변경되지는 않는다. 인증 오류는 포트·DB/user·셸 덮어쓰기·현재 유효한 자격증명 순서로 확인하고 기존 접속을 통해 역할 비밀번호를 변경한다. 인증 문제 해결을 위해 `down -v`나 볼륨 삭제를 사용하지 않는다. [공식 이미지 초기화 조건](https://hub.docker.com/_/postgres)

스키마 rollback은 변경별 역변경 또는 백업 복원을 검토한다. 파괴적 변경 전에는 백업과 별도 개발 DB에서 복원 검증이 필요하다. 운영 이전·기존 Supabase 삭제·프로덕션 환경변수 교체는 이 설계에 포함하지 않는다.

## 9. 구현 순서와 검증 기준

| 단계 | 산출물 / 진입 조건 | 검증 |
|---|---|---|
| 1. 설계 검토 | #71, 이 문서 | 결정/TBD 구분, 허용 파일, 문서 diff 확인 |
| 2. main·계약 정리 | 팀장 Supabase 연결/거버넌스 정리, 대체 Auth·Storage 선택, 새 인증/DB 계약과 PR #65 조정 | SDK/env 참조 제거, 기존 기능 요구와 사용자 ID·소유권·환경변수 정합성 |
| 3. 개발 DB 기반 | 별도 구현 이슈: Compose·견본·역할 초기화 | config -q, healthy, 호스트 TCP 인증, DBeaver Test Connection, SELECT 1 |
| 4. Next.js 연결 | 별도 구현 이슈: pg pool·서버 연결 | 앱 계정 연결, DB 중단·잘못된 자격증명 오류, 비밀 없는 로그 |
| 5. 업무 스키마·RLS | 계약 확정 후 migrations·grants·정책 | 사용자 A/B 교차 접근 거부, 비회원 정책, 컨텍스트 없는 요청 거부, 풀 재사용 시 이전 사용자 잔존 없음 |
| 6. API 구현 | 인증/게스트 → private 사진 → 주문/설문 후속 이슈 | DB 세션 무효화·게스트 계정 연결/복구, 업로드 검사·타인 URL 발급 거부·재업로드 분리, 계약/mock/응답 일치 |

개발 DB 기반 단계에서 추가 확인: 컨테이너 재생성 뒤 가짜 데이터 지속, 초기화 스크립트 재실행 가정 없음, 앱 계정의 DDL/권한 변경 거부, 마이그레이션 실패와 재적용, 볼륨 보존 종료/재시작. 실제 개인정보를 테스트 seed에 넣지 않는다.

RLS 검증은 조회 거부뿐 아니라 다른 owner로 INSERT/UPDATE 거부, owner 변경 거부, COMMIT/ROLLBACK 후 사용자 컨텍스트 초기화와 동시 요청 격리를 포함한다. Auth 역할로 주문/사진에 접근할 수 없고 앱 역할로 인증 토큰/비밀번호 데이터에 접근할 수 없는지도 확인한다. 계정 연결 중 업무 소유권 이전에 추가 권한이 필요하면 범위가 제한된 별도 서버 절차를 설계한다.

운영 DB는 Vercel이 네트워크로 접근 가능한 별도 PostgreSQL이어야 한다. 개발 PC의 `localhost` 주소를 배포 설정에 넣거나 로컬 DB 포트를 공개하는 방식으로 해결하지 않는다. 운영 위치가 정해지면 TLS 검증·pool 제한·백업/복원·운영 마이그레이션을 별도 설계한다.

## 10. 후속 구현의 파일 후보

아래는 현재 수정 허용 범위가 아니다. 다음 이슈에 필요한 파일만 선택해 적는다.

| 후보 | 목적 |
|---|---|
| `backend/docker-compose.yml` | 개발 PostgreSQL 실행 |
| `backend/.env.example`, `backend/README.md` | 견본·공식 실행/연결 절차 |
| `backend/postgres/init/` | 첫 개발 초기화의 계정·기본 권한 |
| `backend/postgres/migrations/`, migration runner·검증 SQL | 스키마 이력·RLS·권한 검증 |
| `frontend/lib/server/postgres.ts` | 서버 전용 pool·트랜잭션 |
| `frontend/.env.example`, `frontend/package.json`, lockfile | 서버 연결 설정·pg 의존성 |
| `frontend/lib/server/auth.ts`, 인증 전용 DB 연결 모듈, `frontend/app/api/auth/` | 인증 라이브러리·DB 세션·게스트·카카오·재설정. 경로/어댑터는 계약 후 확정 |
| `frontend/lib/server/storage.ts`, `frontend/app/api/uploads/` | private 객체 저장소 서명·바이트 검사·완료/조회 |
| `backend/postgres/`의 인증/사진 migration, 정리 작업 | 인증 모델·사진 상태/소유권·계정 연결·객체 삭제 재시도 |

Next.js 컨테이너화를 선택하면 Dockerfile·build context·hot reload·service hostname·readiness 범위를 별도로 추가한다. 이번 설계 브랜치는 `backend/postgres-design.md`만 변경한다. AGENTS.md·CLAUDE.md·CODEOWNERS·docs 규칙/계약은 팀장 반영용 제안만 하며 자동 수정하지 않는다.

## 11. 팀장 요청 — main의 Supabase 정리

이슈 #71에 팀장 `@bongjunpyo` 요청을 기록한다. 2026-10-07 `origin/main`의 `790334a`에서 확인한 내용이다. 작업 시 최신 main을 재확인하고 팀장 별도 작업 이슈/브랜치에서 PR을 거쳐 main에 반영한다. 이 설계 브랜치는 정리 코드나 거버넌스를 직접 수정하지 않는다.

| main에서 확인한 대상 | 요청 |
|---|---|
| `frontend/lib/server/supabase.ts` | 전용 클라이언트와 남은 호출부 제거 |
| `frontend/package.json`, `frontend/package-lock.json` | `@supabase/supabase-js` 제거 및 lockfile 정상 갱신 |
| `backend/supabase/config.toml` | 추적된 CLI 설정 제거. 현재 main의 해당 폴더에서 확인된 파일은 이 설정뿐이며 기존 SQL 이식은 별도 조사 |
| `frontend/.env.example`, `backend/README.md` | Supabase 환경변수/서비스/실행 안내를 새 방향으로 정리 |
| 루트·backend·frontend `AGENTS.md`, 루트·frontend `README.md` | 팀장이 스택·담당·서버 인증·독립 PostgreSQL/RLS 원칙을 반영 |
| `docs/CONTRACT_API.md`, `docs/DEV_ENV.md`, `docs/design/prompts/claude-code-brand-v2.md` | 기존 서비스 전제·계약·개발 구조 정합성 반영. 계약은 준표·재원 공동 검토 |
| `.github/pull_request_template.md`, `.claude/settings.json` | 영역 설명과 Supabase CLI 실행 허용 항목 정리 |
| `docs/PITFALLS.md`, `docs/superpowers/specs/2026-09-16-team-workflow-design.md` | 과거 사실을 보존하고 현재 결정으로 연결하는 dated errata 추가 |
| `.gitignore` | 새 로컬 파일 제외 확인. 잔존 Supabase 로컬 상태/민감 파일 보호 규칙은 필요하면 유지 |

정리 후 SDK import·환경변수 의존성·CLI 지시를 재검색하고 `git diff --check`, frontend typecheck/test/build와 기존 mock 화면을 확인한다. 과거 기록과 보안 목적 ignore에 남는 명칭은 이유를 기록한다. 기존 `.env.local`·프로젝트/DB/사진·로컬 `.temp`·동결 `web-demo/`는 이 정리 작업에서 삭제/수정하지 않는다. 운영 환경변수 제거와 기존 서비스 폐기는 데이터/백업 확인이 필요한 별도 작업이다.
