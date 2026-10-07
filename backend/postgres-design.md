# Next.js + PostgreSQL 개발 환경 설계 초안

이슈: [#71](https://github.com/bongjunpyo/Sunny/issues/71) · 작성: 2026-10-07 · 상태: 검토용 제안

이 문서는 구현 계획이며 기존 API 계약이나 환경변수 원본을 대체하지 않는다. 확정된 내용은 팀장이 거버넌스 문서에 반영하고, 외부 서비스·환경변수·실행 절차는 구현 시 `backend/README.md`에 반영한다.

## 1. 결정과 미정 사항

사용자 결정: 서버 프레임워크는 **Next.js Route Handlers 유지**, 애플리케이션 DB는 **독립 PostgreSQL**, 개발 DB 서버는 **Docker Compose로 실행**, 관리·조회는 **DBeaver**로 수행한다. FastAPI 전환은 철회됐다.

| 항목 | 이번 설계 |
|---|---|
| API 위치 | `frontend/app/api/**/route.ts` 유지 |
| 서버 전용 연결 | `frontend/lib/server/` 유지 |
| CMS / 자외선지수 | Sanity / 기상청 기존 방향 유지 |
| 로컬 실행 범위 | PostgreSQL만 Docker, Next.js는 npm 실행을 기본 제안. 둘 다 Docker로 실행할지는 TBD |
| Auth / 사진 Storage | Supabase 서비스 유지 또는 전체 교체 여부 TBD |
| 운영 DB | 위치·제공자·TLS·백업·연결 제한 TBD |

기존 `feat/back-fastapi-foundation`의 `6d68995`는 작업 기록으로 보존한다. 새 브랜치는 `origin/main`에서 시작하며 FastAPI 코드·프록시·Python 의존성을 가져오지 않는다. 기존 Supabase 프로젝트·환경파일·데이터는 변경하지 않는다.

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

이미지의 `POSTGRES_USER`는 초기 superuser다. 따라서 위 Compose의 관리 계정으로 앱을 연결하지 않는다. `sunny_app`의 역할·비밀번호·grant 생성이 완료되기 전에는 앱 연결 단계로 넘어가지 않는다. [공식 이미지](https://hub.docker.com/_/postgres)

| 환경변수 후보 | 위치 | 용도 |
|---|---|---|
| `SUNNY_PG_PORT` | `backend/.env.local` | 호스트 개발 DB 포트, 기본 제안 5434 |
| `SUNNY_PG_ADMIN_PASSWORD` | `backend/.env.local` | 개발 관리 계정 비밀번호 |
| `SUNNY_PG_APP_PASSWORD` | `backend/.env.local` | 앱 역할 초기화·인증 확인. Compose 초안에서는 아직 사용하지 않음 |
| `DATABASE_URL` | `frontend/.env.local` / 향후 배포 설정 | `sunny_app`의 서버 전용 연결 문자열 |

견본에는 비밀번호를 비워 두고 실제 값은 ignored 환경파일에만 둔다. `NEXT_PUBLIC_` 접두사는 사용하지 않는다. URL에 비밀번호를 넣을 경우 URL 인코딩을 적용한다. 마이그레이션의 관리 연결 문자열은 앱 런타임 설정에 넣지 않는다.

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

독립 PostgreSQL에는 Supabase Auth의 `auth.users`, `auth.uid()`와 JWT를 DB 정책에 전달하는 계층이 기본 제공되지 않는다. 기존 SQL과 SDK 호출을 그대로 옮기지 않는다.

| 의존성 | 새 설계에서 필요한 결정 |
|---|---|
| 이슈 #70 | Supabase Auth 유지 여부, 사용자 ID 매핑, HttpOnly 세션 검증과 콜백. 비회원 주문·카카오·비밀번호 재설정 요구는 유지 |
| PR #65 | 사진 저장소 제공자, private 객체·signed URL·업로드 검증·소유권·동의·만료 정책 |
| 이슈 #69 | 마이그레이션 경로와 도구, 사용자 참조, grants·RLS 재설계 |

Auth만 유지하면 외부 Auth ID와 로컬 사용자 레코드의 매핑·삭제 동기화가 필요하다. 다른 DB의 `auth.users`에 직접 FK를 만들 수 없다. Storage를 유지하더라도 로컬 DB의 사진 소유권을 Supabase Storage가 자동 검증하지 않으므로 서버 검증과 저장소 정책의 연결 방식을 합의해야 한다.

Supabase 전체를 제외하면 인증 제공자·세션 저장·이메일/카카오/재설정과 객체 저장소를 새로 선택한다. 여기서는 임의로 대체 제품이나 라이브러리를 확정하지 않는다.

RLS는 유지한다. 제안 방식은 Next.js가 세션 검증으로 얻은 신뢰 가능한 사용자 UUID를 **요청별 트랜잭션**에 전달하는 것이다.

```sql
-- 동일 client의 BEGIN 이후, 검증된 UUID를 바인딩한다.
SELECT set_config('app.user_id', $1, true);
-- 보호 데이터 쿼리를 수행하고 COMMIT 또는 ROLLBACK한다.
```

세 번째 인자의 `true`는 트랜잭션 범위다. 정책은 예를 들어 `NULLIF(current_setting('app.user_id', true), '')::uuid`를 기준으로 소유권을 비교하고 컨텍스트가 없으면 거부한다. 실제 사용자 컬럼·정책 SQL은 계약 확정 후 작성한다. 클라이언트가 보낸 사용자 ID·헤더를 세션 검증 없이 컨텍스트로 사용하지 않는다.

`sunny_app`은 테이블 소유자·superuser·BYPASSRLS가 아니어야 한다. 필요에 따라 FORCE RLS를 적용하고 schema CREATE·TRUNCATE 등 불필요한 권한을 주지 않는다. 이 방식의 신뢰 경계는 검증된 Next.js 서버이며 앱 DB 자격증명을 최종 사용자에게 제공하지 않는다. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

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
| 2. 계약 정리 | 팀장 거버넌스 반영, Auth·Storage 결정, #70·#65·#69 조정 | 기존 기능 요구와 사용자 ID·소유권·환경변수 정합성 |
| 3. 개발 DB 기반 | 별도 구현 이슈: Compose·견본·역할 초기화 | config -q, healthy, 호스트 TCP 인증, DBeaver Test Connection, SELECT 1 |
| 4. Next.js 연결 | 별도 구현 이슈: pg pool·서버 연결 | 앱 계정 연결, DB 중단·잘못된 자격증명 오류, 비밀 없는 로그 |
| 5. 업무 스키마·RLS | 계약 확정 후 migrations·grants·정책 | 사용자 A/B 교차 접근 거부, 비회원 정책, 컨텍스트 없는 요청 거부, 풀 재사용 시 이전 사용자 잔존 없음 |
| 6. API 구현 | 인증·사진·주문·설문 API 후속 이슈 | 계약 예시·mock·실제 응답 일치, 기존 화면 검증 |

개발 DB 기반 단계에서 추가 확인: 컨테이너 재생성 뒤 가짜 데이터 지속, 초기화 스크립트 재실행 가정 없음, 앱 계정의 DDL/권한 변경 거부, 마이그레이션 실패와 재적용, 볼륨 보존 종료/재시작. 실제 개인정보를 테스트 seed에 넣지 않는다.

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

Next.js 컨테이너화를 선택하면 Dockerfile·build context·hot reload·service hostname·readiness 범위를 별도로 추가한다. 이번 설계 브랜치는 `backend/postgres-design.md`만 변경한다. AGENTS.md·CLAUDE.md·CODEOWNERS·docs 규칙/계약은 팀장 반영용 제안만 하며 자동 수정하지 않는다.
