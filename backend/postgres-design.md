# Next.js + PostgreSQL 개발 환경 설계 초안

이슈: [#71](https://github.com/bongjunpyo/Sunny/issues/71) · 작성: 2026-10-07 · 갱신: 2026-10-08 · 상태: 팀장 피드백 반영, 구현 전 설계

이 문서는 구현 계획이며 기존 API 계약이나 환경변수 원본을 대체하지 않는다. 확정된 내용은 팀장이 거버넌스 문서에 반영하고, 외부 서비스·환경변수·실행 절차는 구현 시 `backend/README.md`에 반영한다.

## 1. 결정과 미정 사항

사용자 결정: 서버 프레임워크는 **Next.js Route Handlers 유지**, **Supabase 전체(DB·Auth·Storage·SDK·CLI) 제외**, 애플리케이션 DB는 **독립 PostgreSQL**, 개발 DB 서버는 **Docker Compose로 실행**, 관리·조회는 **DBeaver**로 수행한다. FastAPI 전환은 철회됐다.

[팀장 피드백](https://github.com/bongjunpyo/Sunny/issues/71#issuecomment-6036050802)으로 **Better Auth + PostgreSQL DB 세션**, **private Cloudflare R2**, **서버 소유권 검사 + PostgreSQL RLS**, **인증/업무 역할 분리**를 채택했다. 이메일 가입 인증과 메일 링크 비밀번호 재설정은 필수다. 게스트와 회원은 다른 사용자로 유지하며 주문·사진을 이전하지 않는다. 채택 결정과 재원에게 위임된 결정(7.1)은 TBD가 아니며, 계약의 입력/응답과 나머지 미정 정책은 후속 공동 검토 대상이다.

| 항목 | 이번 설계 |
|---|---|
| API 위치 | `frontend/app/api/**/route.ts` 유지 |
| 서버 전용 연결 | `frontend/lib/server/` 유지 |
| CMS / 자외선지수 | Sanity / 기상청 기존 방향 유지 |
| 로컬 실행 범위 | 현재 backend/AGENTS.md 기준 PostgreSQL만 Docker, Next.js는 npm 실행. Next.js 컨테이너 추가는 별도 검토/TBD |
| Auth | Better Auth + PostgreSQL DB 세션 + HttpOnly 쿠키 채택. 이메일 가입 인증·카카오·게스트 세션·메일 링크 재설정 |
| 고객 사진 Storage | private Cloudflare R2 채택. PUT 서명 업로드 + complete 서버 검사 + 미완료 객체 정리 |
| 개인정보 접근 | Next.js의 세션·소유권 검사 + PostgreSQL 자체 RLS, sunny_auth/sunny_app 분리 채택 |
| 게스트와 회원 | 소유권 이전·계정 통합 없음. 익명 사용자 자동 삭제 금지, 주문·사진 owner FK의 ON DELETE CASCADE 금지 |
| 메일 | Resend Transactional Free 선택. 발신은 팀 소유 도메인의 auth 서브도메인, 실제 도메인명·DNS 권한은 TBD |
| 운영 DB | 위치·제공자·TLS·백업·연결 제한 TBD |

기존 `feat/back-fastapi-foundation`의 `6d68995`는 작업 기록으로 보존한다. 새 설계에 FastAPI 코드·프록시·Python 의존성을 가져오지 않는다. 지정 브랜치는 main에서 생성한 기존 설계를 보존하고, 2026-10-08 최신 `origin/main`의 `94cdd58`(#74)을 정상 merge로 반영했다. 주요 Supabase 코드·설정·거버넌스 정리는 #74에 반영됐으며 남은 CLI 허용 항목과 상세 계약 작업은 11절에 구분한다. 기존 Supabase 프로젝트·환경파일·데이터의 실제 폐기는 별도 작업이다.

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
| `sunny_auth` | 인증 전용 `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` 역할. 인증 테이블·세션 검증에 필요한 권한만 부여하며 주문·사진 테이블 DML은 주지 않음 |

이미지의 `POSTGRES_USER`는 초기 superuser다. 따라서 위 Compose의 관리 계정으로 앱을 연결하지 않는다. `sunny_app`의 역할·비밀번호·grant 생성이 완료되기 전에는 앱 연결 단계로 넘어가지 않는다. [공식 이미지](https://hub.docker.com/_/postgres)

| 환경변수 후보 | 위치 | 용도 |
|---|---|---|
| `SUNNY_PG_PORT` | `backend/.env.local` | 호스트 개발 DB 포트, 기본 제안 5434 |
| `SUNNY_PG_ADMIN_PASSWORD` | `backend/.env.local` | 개발 관리 계정 비밀번호 |
| `SUNNY_PG_APP_PASSWORD` | `backend/.env.local` | 앱 역할 초기화·인증 확인. Compose 초안에서는 아직 사용하지 않음 |
| `DATABASE_URL` | `frontend/.env.local` / 향후 배포 설정 | `sunny_app`의 서버 전용 연결 문자열 |

견본에는 비밀번호를 비워 두고 실제 값은 ignored 환경파일에만 둔다. `NEXT_PUBLIC_` 접두사는 사용하지 않는다. URL에 비밀번호를 넣을 경우 URL 인코딩을 적용한다. 마이그레이션의 관리 연결 문자열은 앱 런타임 설정에 넣지 않는다.

Better Auth·R2는 채택됐지만 별도 인증 DB 연결, 인증 secret, 카카오 client ID/secret, Resend 발송 키·발신 주소, R2 endpoint/bucket/자격증명의 환경변수 이름은 구현 이슈와 `backend/README.md`에서 확정한다. 여기의 후보를 현재 필수 환경변수로 취급하지 않는다. R2 자격증명과 메일 발송 키도 서버 전용이다.

Compose는 명시적으로 `--env-file backend/.env.local`을 사용한다. 셸의 같은 이름 변수가 파일 값을 덮어쓸 수 있으므로 충돌 여부를 값 노출 없이 확인한다. `docker compose config -q`로 검증하고 비밀번호가 펼쳐지는 전체 config 출력은 남기지 않는다. [Compose 환경변수 우선순위](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)

## 5. 시작과 DBeaver 연결 절차

아래는 **후속 구현 파일과 로컬 비밀번호가 준비된 뒤** 수행할 절차다.

```sh
# 저장소 루트에서 수행
# macOS: 포트 사용 여부 확인
lsof -nP -iTCP:5434 -sTCP:LISTEN
docker compose --env-file backend/.env.local -f backend/docker-compose.yml config -q
docker compose --env-file backend/.env.local -f backend/docker-compose.yml up -d --wait db
docker compose --env-file backend/.env.local -f backend/docker-compose.yml ps

# Next.js는 별도 터미널에서 실행
cd frontend
npm ci
npm run dev
```

Windows PowerShell에서 포트를 확인할 때는 `lsof` 대신 아래 명령을 사용한다. 연결 정보가 반환되면 사용 중이며 기존 프로세스를 임의로 종료하지 않는다. 이후 Compose 명령은 저장소 루트에서 동일하게 실행한다. 팀 기본 개발 환경에서 Docker 설치는 재원 담당이며, 아래는 Windows에서 같은 개발 DB를 확인해야 할 경우의 대안이다.

```powershell
Get-NetTCPConnection -LocalPort 5434 -State Listen -ErrorAction SilentlyContinue
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

**Supabase Auth·Storage도 사용하지 않는다.** 독립 PostgreSQL에는 Supabase의 `auth.users`, `auth.uid()`와 JWT 전달 계층이 기본 제공되지 않는다. 인증·객체 저장·DB 권한을 각각 설계하되 하나의 서버 검증 사용자 ID로 연결한다. 아래 기술은 #71에서 채택됐으며, 구현과 새 API 계약은 아직 완료되지 않았다.

| 책임 | 채택 구현 | 경계 |
|---|---|---|
| 본인 확인 | Next.js 서버의 Better Auth + PostgreSQL DB 세션 | 쿠키 유무만 보지 않고 유효한 세션을 검증해 사용자 ID를 얻음 |
| 업무 권한 | Next.js 서버 API + PostgreSQL RLS | 검증한 사용자의 주문·사진·설문 범위와 회원/비회원 권한 검사 |
| 사진 바이트 | private Cloudflare R2 버킷 | 저장소 자격증명은 서버 전용, 브라우저에는 제한된 서명 업로드/조회 권한만 전달 |
| 사진 메타데이터 | PostgreSQL `photo_assets` 등 후속 계약 | owner ID·객체 key·검증 상태·동의·만료 시각을 저장하며 영구 공개 URL을 저장하지 않음 |

### 7.1. 인증 — Better Auth + PostgreSQL DB 세션 채택

이메일·비밀번호, 카카오 로그인, 메일 링크 비밀번호 재설정, 비회원 주문에 Better Auth를 사용한다. Next.js Route Handler 통합과 PostgreSQL DB 세션, anonymous 플러그인을 이용하며 비밀번호 해싱·OAuth·세션 프로토콜을 새로 작성하지 않는다. 라이브러리 실제 버전·추가 파일은 후속 구현 이슈에서 제안한다. [Next.js 통합](https://better-auth.com/docs/integrations/next), [DB 연결](https://better-auth.com/docs/concepts/database), [이메일/비밀번호](https://better-auth.com/docs/authentication/email-password), [카카오](https://better-auth.com/docs/authentication/kakao)

- 인증 설정은 `frontend/lib/server/`의 서버 전용 모듈로 두고 Next.js `/api/auth/*`에서 처리한다. 기존 화면 `frontend/lib/auth.ts`의 입력/반환과 라이브러리 경로가 다르면 공동 계약과 서버 어댑터에서 맞춘다.
- 라이브러리 기본 JSON 응답과 계약의 토큰 전달 제한을 대조한다. 회원 표시 정보·인증 대기 등 계약된 상태만 반환하고 세션/OAuth 토큰은 JSON으로 반환하거나 브라우저 저장소에 보관하지 않는다. 서버 어댑터는 쿠키 설정·갱신 헤더를 정상 전달해야 한다.
- PostgreSQL에 세션을 저장하고 HttpOnly 쿠키로 세션 식별자를 전달한다. 운영의 `Secure`, `SameSite`, 만료/갱신과 상태 변경 API의 Origin/CSRF 검사를 계약한다. 보호 API는 매번 서버에서 DB 세션의 유효성을 확인한다. 쿠키 캐시를 켜면 무효화 지연을 검토하고 민감 API는 캐시만으로 허용하지 않는다. [세션](https://better-auth.com/docs/concepts/session-management), [쿠키](https://better-auth.com/docs/concepts/cookies)
- **이메일/비밀번호 회원가입은 이메일 인증 필수**다. `emailAndPassword.requireEmailVerification: true`, `emailVerification.sendOnSignUp: true`, `sendVerificationEmail`을 연결한다. 가입 직후 회원 세션을 만들지 않고 화면에는 **인증 대기**를 반환한다. 인증 전 이메일/비밀번호 로그인은 403으로 거절하고 “메일함에서 인증을 마쳐 주세요”와 재발송을 제공한다. 가입·로그인·재설정·재발송에는 요청 제한을 적용한다. 자동 재발송 여부 등 `sendOnSignIn` 설정과 계정 존재를 드러내지 않는 응답은 후속 계약에서 확인한다. [이메일 인증](https://better-auth.com/docs/concepts/email)
- 비밀번호 해싱은 라이브러리 기능을 사용한다. **비밀번호 재설정은 메일 링크 방식**이며 `emailAndPassword.sendResetPassword` 발송 함수를 연결하고 `revokeSessionsOnPasswordReset: true`로 기존 세션을 무효화한다. 요청 응답은 계정 존재를 드러내지 않게 맞춘다. 이메일 인증과 재설정에는 별도 이메일 발송 서비스·도메인이 **필수**다. 재설정 토큰 수명은 가입 인증 링크 수명과 별개이며 TBD다. [재설정과 세션 무효화](https://better-auth.com/docs/authentication/email-password#revoking-sessions-on-password-reset)
- 카카오 redirect URL과 scope/동의 권한을 확인하고 이메일을 항상 받거나 검증됐다고 가정하지 않는다. **카카오와 이메일 계정의 자동 연결을 끈다.** `account.accountLinking` 옵션·기본값은 선택한 버전에서 재확인하고 `enabled: false` 등으로 연결 API도 차단한다. 카카오 이메일 검증 정보의 해석은 이메일/비밀번호 인증과 구분해 계약한다.
- 동일 이메일이면 두 사용자 계정이 자동 생성된다고 보장하지 않는다. 공식 `user.email`은 unique이며 자동 연결을 끄면 동일 이메일 OAuth 로그인은 `account_not_linked`로 거절될 수 있다. 자동 병합·이메일 위조·unique 제약 완화 대신 기존 가입 방식으로 로그인하도록 안내하는 오류 흐름을 공동 계약에서 합의한다. [계정 연결](https://better-auth.com/docs/concepts/users-accounts), [사용자 스키마](https://better-auth.com/docs/concepts/database)
- 사용자·세션·계정·검증 토큰 모델은 실제 adapter 생성 스키마를 확인해 마이그레이션으로 기록한다. 사용자 ID는 UUID를 제안하되 기본 ID가 UUID라고 가정하지 않는다. 구현 시 `advanced.database.generateId: "uuid"` 지원과 FK 타입을 함께 확인한다.
- 비회원은 anonymous 플러그인으로 검증한 게스트 세션과 사용자 ID를 발급한다. 단순 무인증 요청이나 nullable 주문 소유자로 대체하지 않는다. **게스트 → 회원 소유권 이전·계정 통합을 구현하지 않는다.** 로그인/가입 후에도 게스트 주문·사진은 기존 게스트 사용자에게 남는다.
- `anonymous({ disableDeleteAnonymousUser: true })`를 필수로 설정해 익명 사용자 자동 삭제와 익명 사용자 삭제 endpoint를 차단한다. 주문·사진 owner FK는 `ON DELETE CASCADE`를 쓰지 않고 RESTRICT/NO ACTION 제약을 검토한다. 업무 소유권 이동 callback은 등록하지 않으며 인증 전환 때 게스트 사용자·owner FK·업무 데이터가 보존되는지 검증한다. [anonymous 옵션](https://better-auth.com/docs/plugins/anonymous)
- 비회원 커스텀 주문과 맞춰 검증된 게스트 세션에도 `presign`·`complete`·`read-url`을 허용하는 안을 새 계약에 제안한다. 미인증 이메일 계정 자체는 회원 권한을 갖지 않는다. 게스트 세션 분실 후 주문번호만으로 조회를 허용하지 않으며 **복구 방식은 TBD**다. 이메일 코드 방식을 고르면 같은 메일 서비스를 사용한다. 세션 수명·요청 제한 수치·최종 게스트 허용 API 목록은 공동 계약 전 TBD다.

인증 테이블은 업무 RLS와 다른 경계를 가진다. 사용자 컨텍스트가 없는 상태에서 세션을 검증하므로 업무 테이블 정책을 그대로 적용하지 않는다. `sunny_auth` 전용 역할/풀로 인증 테이블에만 필요한 접근을 허용하고, 주문·사진은 `sunny_app`의 업무 트랜잭션으로 접근한다. auth adapter의 schema/search_path·권한·마이그레이션 방식은 구현 전에 확인한다. 두 역할 모두 관리 계정이나 BYPASSRLS 권한을 받지 않는다.

#### 재원에게 위임된 인증·메일 결정

팀장 위임에 따라 다음 정책을 결정한다. 결정과 이유는 #71 답변에 기록한다. 실제 계정 생성·유료 구독·도메인 구매·DNS 설정은 이번 설계 작업에 포함하지 않는다.

| 항목 | 결정 | 이유 / 구현 조건 |
|---|---|---|
| 인증 후 자동 로그인 | `emailVerification.autoSignInAfterVerification: false` | 메일을 연 기기에 원치 않는 세션이 생기거나 게스트 작업 맥락이 바뀌는 것을 줄임. 인증 완료 후 명시적으로 로그인 |
| 가입 인증 링크 수명 | 24시간, `emailVerification.expiresIn: 86400` | 메일 도착 지연·다음 날 확인 허용. 만료 후 재발송하며 재설정 링크 수명과 구분 |
| 미인증 이메일 계정 정리 | 가입 후 7일 경과 시 정리 대상 | `isAnonymous = false`, 이메일/비밀번호 전용 미인증 계정만 대상. 게스트·다른 제공자 연결·유효한 인증 토큰/세션·주문·사진 참조가 있으면 삭제하지 않음 |
| 메일 서비스 | Resend Transactional Free | 가입 인증·재발송·재설정을 하나의 서버 발송 모듈에서 처리. 초기 무료 사용량 활용 |
| 발신 도메인 구성 | 팀 소유 도메인의 `auth.` 서브도메인, `noreply@auth.<team-domain>` | 실제 팀 소유 도메인명·DNS 권한은 확인 전이므로 TBD. 예시 주소를 운영값으로 사용하지 않음 |

미인증 계정 정리는 삭제 직전 인증 상태·참조를 재검사해 인증 완료와의 경합을 막는다. 업무 FK가 있는 사용자와 anonymous 사용자는 정리하지 않는다. 실행 주체·주기·참조 확인용 최소 권한은 후속 이슈에서 TBD로 정하고, 이를 위해 `sunny_auth`에 주문·사진 DML을 추가하지 않는다. [인증 링크 옵션](https://better-auth.com/docs/reference/options#emailverification)

예상 메일 비용(2026-10-08 확인): Free **월 $0 / 월 3,000통 / 일 100통**, 가입 인증·재발송·재설정을 합산한다. 필요 시 Pro **월 $20 / 50,000통**, 초과 **$0.90 / 1,000통**을 검토한다. 이번 설계에서 유료 플랜을 활성화하지 않는다. 도메인 등록·갱신 비용은 실제 도메인 선정 후 TBD이며 메일 요금과 별도다. [Resend 가격](https://resend.com/pricing)

인증 구현 이슈 전에 실제 발신 도메인을 확보하고 Resend가 제시한 SPF/DKIM 레코드를 DNS에 설정·검증해야 한다. open/click tracking은 인증 링크에 적용하지 않는 안을 기본으로 검토하고, 발송 성공·실패·재시도 및 무료 일일 한도 도달 처리를 설계한다. 계정 존재를 드러내지 않는 응답을 유지하되 전달 실패를 인증 완료로 취급하지 않는다. Vercel에서는 기다리지 않은 Promise만 남겨 발송을 유실하지 않도록 보장되는 백그라운드 작업/재시도 실행을 정한다. 실제 도메인·발송 검증 전에는 일반 사용자 대상 인증을 운영에 켜지 않는다. [발신 도메인·SPF/DKIM](https://resend.com/docs/add-a-domain), [발송 함수와 서버리스 처리](https://better-auth.com/docs/concepts/email)

### 7.2. 고객 사진 — private Cloudflare R2 채택

고객 원본은 공개 Sanity 이미지와 구분해 private R2 버킷에 둔다. PR #65의 `uploadUrl` 하나로 PUT 업로드하는 응답을 유지하고, 사진 전송 비용과 운영 부담을 고려해 R2를 채택한다. PostgreSQL은 파일 바이트 대신 소유권·상태·객체 key를 관리한다. 브라우저는 Next.js에 업로드 권한을 요청하고 서버가 허용한 객체와 메서드에만 짧게 서명된 URL로 전송한다. 저장소 서명은 DB의 회원/소유권 검사를 대신하지 않는다. [R2 서명 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 가격](https://developers.cloudflare.com/r2/pricing/)

1. `presign`: 세션·Origin·사용자별 요청 제한·허용 규칙을 확인하고 서버가 `assetId`와 임의의 pending key를 생성한다. 본문 `ownerId`·파일명·임의 bucket/key를 신뢰하지 않는다. 게스트 포함 여부는 7.4의 공동 계약에서 맞춘다.
2. 직접 업로드: private pending key 하나에만 **PUT** 서명한다. R2는 HTML form POST를 지원하지 않으므로 S3 POST의 `content-length-range` 정책을 사용하지 않는다. 허용 Content-Type을 서명에 포함하지만 이것은 실제 파일 내용 검사가 아니다. 저장소에서 최대 용량을 막는다고 가정하지 않는다. 서명에 Content-Length를 넣는 방법은 브라우저 동작·R2 지원을 구현 때 검증할 항목이며 의존하기 전에는 보장하지 않는다.
3. `complete`: DB에서 사용자 소유권·상태를 확인하고 검사 중 상태를 원자적으로 확보한다. 서버는 실제 크기를 확인하고 읽기 상한을 둔 뒤 실제 바이트·형식·해상도를 검사한다. 초과·잘못된 파일은 거절하고 삭제 대상으로 처리한다. **서버가 검사한 동일 바이트**를 방향 보정·재인코딩·EXIF 제거한 뒤 **브라우저 업로드 권한이 없는 별도 verified key**에 저장한다. 원본 pending 객체를 그대로 복사하거나 검사 후 다시 읽은 미검증 바이트를 저장하지 않는다. pending 덮어쓰기와 관계없이 완료 후 기준은 verified key뿐이다.
4. DB 확정: verified 객체 저장 성공 후 DB를 `verified`로 전환하고 pending 객체를 삭제 대상으로 처리한다. DB와 R2는 하나의 트랜잭션이 아니므로 DB 확정 실패·삭제 실패·서버 중단에 대한 재시도와 고아 객체 정리가 필요하다. 검사 중 409 및 멱등 완료 흐름은 PR #65와 맞추고 중복 검사를 막는다.
5. 조회/주문: 서버가 본인 소유·verified·허용 목적을 확인한 뒤 GET 서명을 발급한다. 주문은 같은 검증을 다시 수행한다. 기존 7칸 배치·중복 사진 재사용·최대 7개 미리보기 URL 요구를 유지한다.
6. 삭제: pending/rejected/verified별 보관·동의 철회 규칙과 객체/DB 삭제 재시도를 정한다. 삭제 직후에도 살아 있는 PUT 서명으로 pending 객체가 다시 생성될 수 있으므로 만료·업로드 완료 여유 시간 이후에도 미완료/고아 객체를 반복 정리한다. 정확한 보관 기간·여유 시간·정리 실행 주체·주기는 TBD다.

버킷은 공개하지 않으며 개발/운영 버킷과 자격증명을 분리한다. 서버 토큰은 해당 버킷의 필요한 객체 작업만 허용하고 pending URL에는 verified key의 권한을 부여하지 않는다. CORS는 환경별 우리 origin·`PUT`·`Content-Type`을 제한하고 직접 조회 GET/HEAD와 3D 텍스처의 CORS도 확인한다. Vercel preview origin 허용 방식은 TBD이며 전체 origin wildcard로 대체하지 않는다. [R2 토큰](https://developers.cloudflare.com/r2/api/tokens/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/)

서명 URL은 소지자가 만료 전 여러 번 재사용할 수 있는 권한이다. **1회용·사용자 전용·동일 pending 경로 덮어쓰기 불가를 보장하지 않는다.** 로그/영구 데이터에 URL을 남기지 않고 정확한 업로드/조회 TTL은 3D 미리보기 사용 시간과 함께 계약에서 합의한다(TBD). R2 presigned URL은 S3 API endpoint에서 사용하며 custom domain에 그대로 적용할 수 없다. 고객 사진을 공개 도메인/CDN URL로 대체하지 않는다. [서명 URL 제약](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

R2용 S3 SDK와 방향 보정·재인코딩·EXIF 제거 라이브러리의 선택/버전은 TBD다. 후속 구현 이슈에 의존성과 허용 파일을 먼저 제안하며 이번 설계에서는 설치하지 않는다.

### 7.3. RLS — PostgreSQL 자체 기능과 서버 소유권 검사 채택

**RLS는 Supabase 전용 기능이 아니라 PostgreSQL 기능**이므로 유지한다. Next.js가 세션으로 검증한 사용자 UUID를 **요청별 트랜잭션**에 전달하고, DB는 같은 사용자 범위만 허용한다. 다음은 컨텍스트 전달의 예시이며 바로 실행하는 마이그레이션이 아니다.

```sql
-- 동일 client의 BEGIN 이후, 검증된 UUID를 바인딩한다.
SELECT set_config('app.user_id', $1, true);
-- 보호 데이터 쿼리를 수행하고 COMMIT 또는 ROLLBACK한다.
```

세 번째 인자의 `true`는 트랜잭션 범위다. 정책은 예를 들어 `NULLIF(current_setting('app.user_id', true), '')::uuid`를 기준으로 소유권을 비교하고 컨텍스트가 없으면 거부한다. SELECT/DELETE는 `USING`, INSERT는 `WITH CHECK`, UPDATE는 기존 행과 변경 후 행을 모두 검사한다. 실제 사용자 컬럼·FK·회원/비회원별 정책 SQL은 계약 확정 후 작성한다. 클라이언트가 보낸 사용자 ID·헤더를 세션 검증 없이 컨텍스트로 사용하지 않는다.

`sunny_app`은 테이블 소유자·superuser·BYPASSRLS가 아니어야 한다. 보호 테이블은 ENABLE RLS와 FORCE RLS를 적용한다. FORCE도 superuser/BYPASSRLS는 막지 못한다. schema CREATE·TRUNCATE 등 불필요한 권한을 주지 않는다. 같은 client에서 컨텍스트 설정·업무 SQL·COMMIT/ROLLBACK을 처리하고 풀 반환 전 트랜잭션을 끝낸다. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [set_config 범위](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SET)

이 방식의 신뢰 경계는 검증된 Next.js 서버다. `app.user_id` 설정 자체는 인증이 아니며 앱 DB 자격증명을 가진 주체는 다른 값을 설정할 수 있다. RLS를 서버 탈취나 임의 SQL 실행까지 차단하는 수단으로 설명하지 않는다. 서버 인증·소유권 검사·매개변수 SQL·최소 DB 권한과 함께 사용하고 자격증명을 최종 사용자에게 제공하지 않는다. DB의 RLS는 R2 바이트 읽기에 직접 적용되지 않으므로 사진 URL 발급/주문 연결 시 서버가 소유권과 상태를 다시 확인한다.

### 7.4. 기존 계약과 후속 공동 작업

| 기존 작업 | 유지할 요구 / 새로 조정할 것 |
|---|---|
| #70 (closed) | 비회원 주문·카카오·재설정·HttpOnly 서버 인증 요구 유지. Supabase 전제로 닫혔으므로 새 인증 계약 이슈/PR을 작성 |
| PR #65 (open) | private 업로드·서버 검사·verified·소유권·동의·7칸·409/429·조회 요구 유지. 아래 4개 충돌을 공동 계약에서 조정 후 머지 |
| #69 (closed) | 주문/설문 제약·RLS 요구 유지. Supabase MCP/CLI 지시는 독립 PostgreSQL migrations·grants·컨텍스트 정책으로 대체 |

PR #65 확인 기준은 2026-10-08 head `9671deb`다. 닫힌 이슈나 기술 채택을 실제 구현 완료로 간주하지 않는다. 이번 설계 PR에서는 계약 파일을 수정하지 않고 준표·재원의 공동 계약 작업에 아래 항목을 넘긴다.

1. 업로드 API 3개의 저장소 출처를 Supabase Storage에서 **Cloudflare R2**로 바꾼다. PUT과 `assetId/uploadUrl/expiresAt` 응답 형태는 유지한다.
2. **“1회용 URL”·“같은 pending 경로 덮어쓰기 불가”를 “짧은 수명 서명 URL”로 수정**한다. 재사용 가능성, 임의 pending key, 서버가 검사·정제한 별도 verified key, 만료 이후 정리를 계약에 적는다.
3. **닫힌 #70 참조를 새 인증 계약 이슈로 대체**하고 사용자 UUID·DB 세션·검증된 게스트/회원 권한을 일치시킨다. 새 이슈 번호는 생성 전 TBD이며 만들어진 것처럼 적지 않는다.
4. **검증된 게스트 세션도 업로드·완료·조회 가능하도록 제안**한다. 비회원 커스텀 주문과 일치시키고 무인증 호출은 거절한다. 최종 API 범위와 게스트 제한은 같은 계약 PR에서 합의한다.

PR #65의 기존 presign 상한(사용자별 최근 60분 URL 20개), 초과 시 429/Retry-After, complete 검사 중 409와 3초 간격 최대 10회 추가 재시도 요구는 유지한다. 검증된 게스트 사용자 ID에도 상한을 적용하도록 공동 계약에서 맞추며 인증 API의 요청 제한 수치는 별도로 TBD다.

화면 인증 함수도 새 계약에서 입력과 반환을 맞춘다. 현재 `frontend/lib/auth.ts`의 `signIn(email)`·`signUp(email, nickname)`에는 password가 없고 `signUp`은 바로 Member를 반환한다. 제안은 로그인에 email/password, 가입에 email/password/nickname을 받고, 가입은 회원 세션이 아닌 **인증 대기 결과**를 반환하는 것이다. 인증 메일 재발송·비밀번호 재설정 요청·재설정 완료, 만료 링크·403·429·같은 이메일 OAuth 충돌의 화면 동작도 계약한다. 실제 함수명·반환 타입·오류 코드는 공동 합의 전 TBD이며 화면 수정은 준표 담당이다.

Better Auth와 R2 제공자 선택은 완료했다. 라이브러리 버전·세션 수명·인증 요청 제한·사진 규칙/업로드와 조회 TTL·보관 기간·정책 버전·게스트 복구·실제 도메인명 등 남은 정책은 TBD로 유지한다. PR #65의 사진 규칙은 `provisional: true`를 유지하고 보관/삭제 정책 확정 전 프로덕션 사진 업로드를 켜지 않는다.

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
| 2. 기존 결정과 공동 계약 | main 정리 #74 및 Better Auth/R2 선택 완료. 새 인증/DB 계약과 PR #65 조정은 후속 작업 | 가입 인증 대기·게스트 분리·R2 PUT/재사용·사용자 ID·소유권 정합성, 실제 발신 도메인 확인 |
| 3. 개발 DB 기반 | 별도 구현 이슈: Compose·견본·역할 초기화 | config -q, healthy, 호스트 TCP 인증, DBeaver Test Connection, SELECT 1 |
| 4. Next.js 연결 | 별도 구현 이슈: pg pool·서버 연결 | 앱 계정 연결, DB 중단·잘못된 자격증명 오류, 비밀 없는 로그 |
| 5. 인증/업무 스키마·RLS | 계약 확정 후 adapter 스키마·migrations·grants·정책 | 사용자 A/B 교차 접근 거부, 게스트/회원 분리, 컨텍스트 없는 요청 거부, 풀의 이전 사용자 컨텍스트 잔존 없음 |
| 6. API 구현 | 인증/게스트 → private R2 사진 → 주문/설문 후속 이슈 | 가입 인증·재발송·재설정/세션 무효화·게스트 데이터 보존, 업로드 검사·타인 URL 발급 거부·재사용 PUT과 verified 분리, 계약/mock/응답 일치 |

개발 DB 기반 단계에서 추가 확인: 컨테이너 재생성 뒤 가짜 데이터 지속, 초기화 스크립트 재실행 가정 없음, 앱 계정의 DDL/권한 변경 거부, 마이그레이션 실패와 재적용, 볼륨 보존 종료/재시작. 실제 개인정보를 테스트 seed에 넣지 않는다.

RLS 검증은 조회 거부뿐 아니라 다른 owner로 INSERT/UPDATE 거부, owner 변경 거부, COMMIT/ROLLBACK 후 사용자 컨텍스트 초기화와 동시 요청 격리를 포함한다. Auth 역할로 주문/사진에 접근할 수 없고 앱 역할로 인증 토큰/비밀번호 데이터에 접근할 수 없는지도 확인한다. 게스트가 회원으로 로그인/가입해도 기존 주문·사진의 owner ID와 FK가 유지되고 다른 사용자에게 노출되지 않는지 검증한다.

인증 검증에는 가입 직후 회원 세션 부재, 인증 전 403·재발송, 24시간 링크 만료, 인증 후 자동 로그인 없음, 중복 가입/재설정 응답의 계정 노출 방지, 비밀번호 재설정 후 기존 세션 차단, 동일 이메일 카카오 로그인 오류 흐름을 포함한다. 미인증 계정 정리는 게스트·업무 참조·유효한 토큰/세션을 제외하고 인증 완료와 삭제의 경합을 확인한다. 게스트 세션 복구 방식은 TBD로 유지한다.

R2 검증에는 만료 전 pending 덮어쓰기, complete 동시 요청·중간 실패, 검사한 동일 바이트의 정제본만 확정, 완료 후 pending 재생성이 verified 결과에 영향 없음, 만료 이후 정리 재시도, 과대 업로드·EXIF/GPS 제거·origin CORS·타인 조회 차단을 포함한다. 용량·TTL·보관 값이 미정인 상태를 구현 검증 완료로 보고하지 않는다.

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
| `frontend/lib/server/email.ts` 등 발송 모듈 후보 | Resend 가입 인증·재발송·재설정, 발송 실패/한도 처리. 경로/의존성은 후속 확정 |
| `backend/postgres/`의 인증/사진 migration, 정리 작업 | 인증 모델·게스트/회원 owner 분리·미인증 계정 정리·객체 삭제 재시도 |

Next.js 컨테이너화를 선택하면 Dockerfile·build context·hot reload·service hostname·readiness 범위를 별도로 추가한다. 이번 설계 브랜치는 `backend/postgres-design.md`만 변경한다. AGENTS.md·CLAUDE.md·CODEOWNERS·docs 규칙/계약은 팀장 반영용 제안만 하며 자동 수정하지 않는다.

## 11. main의 Supabase 정리 상태와 남은 작업

팀장은 #73 작업을 [PR #74](https://github.com/bongjunpyo/Sunny/pull/74)로 머지했다. 2026-10-08 `origin/main` `94cdd58`의 코드·의존성·거버넌스 정리를 확인하고 지정 설계 브랜치에 정상 merge로 반영했다. 재검색에서 확인한 남은 CLI 허용 항목은 아래와 같이 팀장 후속 요청으로 분리한다. 이 설계 PR의 main 대비 변경은 `backend/postgres-design.md` 하나다.

| 구분 | 확인 / 후속 책임 |
|---|---|
| 서버 코드·의존성 | main의 Supabase 서버 클라이언트·SDK·lockfile 의존성과 추적 CLI 설정이 제거됨 |
| 환경변수·거버넌스 | main의 견본·README·AGENTS·개발 안내가 독립 PostgreSQL·Better Auth·private R2 방향으로 변경됨 |
| 기본 계약 | main에서 `service_role`/`anon` 키 전제가 제거되고 주문·설문 정본 및 계약 표가 PostgreSQL로 변경됨 |
| 남은 CLI 허용 항목 | `.claude/settings.json` 29~30행에 `Bash(supabase db push:*)`·`Bash(supabase db reset:*)`가 남아 있음. 현 스택과 맞지 않으므로 팀장에게 별도 제거 요청, 이번 설계 PR에서는 수정하지 않음 |
| 상세 인증·사진 계약 | 새 인증 계약과 PR #65의 4개 충돌·화면 함수 입력/반환은 **아직 후속 작업**. 상세는 7.4에 위임하며 준표·재원이 같은 PR에서 합의 |
| 기존 서비스·데이터 | 기존 Supabase 프로젝트·실제 환경파일·DB·사진·로컬 상태 폐기는 완료로 간주하지 않음. 백업/이관 확인 후 별도 작업 |

과거 결정 기록과 비밀 파일 보호 목적 ignore에 남는 Supabase 명칭은 현재 실행 의존성과 구분한다. 최신 코드/계약을 기준으로 후속 작업을 시작하고 닫힌 Supabase 이슈나 예전 계약 브랜치를 그대로 적용하지 않는다. `web-demo/`는 동결 상태를 유지한다. 기존 서비스 폐기·운영 DB 이전·프로덕션 환경변수 교체는 이 문서 작업에 포함하지 않는다.
