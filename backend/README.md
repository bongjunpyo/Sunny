# backend — 서버 API · CMS · 데이터 · 배포

담당: **이재원**

규칙은 [`AGENTS.md`](AGENTS.md). API 규격은 [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md).

## 폴더

```
backend/
├── sanity/       Sanity Studio · 스키마          (첫 이슈에서 생성)
└── postgres/     역할 초기화 · migration 도구/SQL · 검증 · 업무 schema 검토안

frontend/
├── app/api/      Next.js 서버 API                 ← 이재원
└── lib/server/   서버 전용 클라이언트              ← 이재원
```

## 외부 서비스 — 단일 진실 원천

| 서비스 | 용도 | 프로젝트 이름 | 소유 계정 | 팀장 접근 |
|---|---|---|---|---|
| Sanity | 컬렉션 · 제품 · 제작 기록 · 이미지 | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| PostgreSQL | 주문 요청 · 인증 세션 | 개발: Docker 로컬 DB · 운영: 미정 | 운영 호스팅 정한 뒤 기록 | — |
| Cloudflare R2 | 고객 사진(비공개) | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| 메일 발송 | 가입 인증 · 비밀번호 재설정 메일 | 이재원이 선택(#71) | 만든 뒤 기록 | — |
| Vercel | 배포 · PR 미리보기 | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| 공공데이터포털 | 기상청 생활기상지수 인증키 | — | 만든 뒤 기록 (인코딩/디코딩 중 사용한 키 표기) | — |

**비밀값(키 · 토큰 · 비밀번호)은 여기에 적지 않는다.**

## 환경변수 이름 — 단일 진실 원천 (초안, 이재원 확정)

| 이름 | 공개 | 읽는 곳 | 용도 |
|---|:---:|---|---|
| `NEXT_PUBLIC_API_MODE` | O | `lib/api.ts` | 화면 데이터 모드 `mock` \| `api` (없으면 mock) |
| `SANITY_PROJECT_ID` | X | `lib/server/` | Sanity 프로젝트 |
| `SANITY_DATASET` | X | `lib/server/` | Sanity 데이터셋 |
| `SANITY_API_READ_TOKEN` | X | `lib/server/` | 비공개·초안 콘텐츠 읽기 |
| `KMA_SERVICE_KEY` | X | `lib/server/` | 기상청 생활기상지수 |
| `SUNNY_PG_PORT` | X | 개발 DB 도구 / Compose | 로컬 DB 포트, 기본 5434 |
| `SUNNY_PG_ADMIN_PASSWORD` | X | 개발 DB 도구 / Compose | 로컬 관리 역할 초기화·인증 |
| `SUNNY_PG_APP_PASSWORD` | X | 개발 DB 도구 / Compose | 로컬 업무 역할 초기화·인증 |
| `SUNNY_PG_AUTH_PASSWORD` | X | 개발 DB 도구 / Compose | 로컬 인증 역할 초기화·인증 |
| `AUTH_ENABLED` | X | 서버 인증 handler | 명시적으로 true일 때 활성화. 기본 비활성 |
| `AUTH_DATABASE_URL` | X | 서버 인증 pool | sunny_auth 전용 PostgreSQL 연결 |
| `DATABASE_URL` | X | 서버 업무 pool | sunny_app 전용 PostgreSQL 연결 |
| `BETTER_AUTH_SECRET` | X | Better Auth | 32자 이상 고엔트로피 세션 서명 비밀값 |
| `BETTER_AUTH_URL` | X | Better Auth / Origin 검사 | 앱의 고정 origin. 로컬 기본 http://localhost:3000 |
| `RESEND_API_KEY` | X | 인증 메일 발송 | Resend 서버 API 키 |
| `AUTH_EMAIL_FROM` | X | 인증 메일 발송 | 메일 제공자가 허용한 팀 발신자. 예: Sunny <team@example.com> |
| `SMTP_HOST` | X | 인증 SMTP | 제공자의 SMTP 호스트명 (URL이 아닌 호스트) |
| `SMTP_PORT` | X | 인증 SMTP | 기본 587(STARTTLS 필수), 465는 연결부터 TLS |
| `SMTP_USER` | X | 인증 SMTP | 팀 메일 SMTP 로그인 사용자 |
| `SMTP_PASSWORD` | X | 인증 SMTP | 제공자가 발급한 SMTP/앱 비밀번호. 일반 계정 비밀번호와 구분 |
| `KAKAO_ENABLED` | X | 카카오 로그인 | true + 두 키가 있을 때만 활성화 |
| `KAKAO_CLIENT_ID` | X | 카카오 로그인 | 카카오 앱 REST API 키, 서버 전용 |
| `KAKAO_CLIENT_SECRET` | X | 카카오 로그인 | 카카오 앱 Client Secret, 서버 전용 |
| `AUTH_DEV_LOCAL_MAIL` | X | 개발 인증 메일 | development + loopback에서만 true 허용. 비공개 로컬 파일 저장 |
| `PHOTO_UPLOAD_ENABLED` | X | 사진 API | true + development + loopback + AUTH_ENABLED일 때만 활성화. production 강제 차단 |
| `R2_ACCOUNT_ID` | X | R2 adapter | Cloudflare 계정 ID (32자리 hex), 서버 endpoint 구성 |
| `R2_BUCKET_NAME` | X | R2 adapter | 고객 사진 전용 private 개발 버킷 이름 |
| `R2_ACCESS_KEY_ID` | X | R2 adapter | 해당 개발 버킷만 허용한 R2 Object Read & Write 키 ID |
| `R2_SECRET_ACCESS_KEY` | X | R2 adapter | R2 S3 비밀 키 |

브라우저는 Sanity·DB·기상청 서버 키를 받지 않는다. R2에는 서버가 발급한 특정 객체의 PUT/GET 서명 URL로만
직접 접근하며 자격증명은 서버에 둔다. 서버 키에 `NEXT_PUBLIC_`을 붙이지 않는다.
바뀌면 [`../frontend/.env.example`](../frontend/.env.example)도 같은 PR에서 고친다.

`SUNNY_PG_*` 값은 ignored `backend/.env.local`에만 둔다. `prepare`는 누락된 개발 DB 값만 생성하고 기존 설정·비밀번호를 보존한다. Python 도구는 이 파일의 값을 사용해 같은 이름의 셸 환경변수와 `COMPOSE_*`가 다른 DB/설정으로 덮어쓰지 못하게 한다. 전체 `docker compose config` 출력에는 비밀번호가 펼쳐질 수 있으므로 `config -q`만 사용한다.

Next.js 인증·DB 연결·메일·R2 이름은 위 표를 따른다. 앱 런타임에 관리 연결 문자열을 사용하지 않는다.
실제 앱 값은 `frontend/.env.local`과 승인된 배포 환경에만 둔다.

## 개발 PostgreSQL — #79

설계는 [`postgres-design.md`](postgres-design.md), 미확정 업무 table/column 제안은
[`postgres/schema-proposal.md`](postgres/schema-proposal.md)에 있다. 기반 구현은 업무/API 계약을 대체하지 않는다.

필요한 도구: Docker Desktop/Compose, Python 3.10 이상. 호스트 TCP 검증에는 `psql`도 필요하다.
Python은 로컬 개발 도구에만 사용하며 Python 서버/추가 라이브러리를 설치하지 않는다.
Next.js는 기존 Node 24/npm 방식으로 실행한다.

저장소 루트에서:

```sh
python3 backend/postgres/manage.py prepare
python3 backend/postgres/manage.py up
python3 backend/postgres/manage.py migrate
python3 backend/postgres/manage.py check
python3 backend/postgres/manage.py status
```

Windows에서 Python 실행 이름이 `python`이면 `python3` 대신 `python`을 쓴다.

DB는 `postgres:17-bookworm`, `sunny`, `127.0.0.1:5434`이며 컨테이너 내부 포트는 5432다.
프로젝트는 `sunny-dev`, 볼륨은 `sunny-dev_pgdata`. 기존 DB·Supabase 서비스·볼륨과 분리한다.
포트가 이미 사용 중이면 도구가 실패하고 기존 프로세스를 종료하지 않는다.
초기화 스크립트는 컨테이너 내부에 복사해 읽기 권한을 고정한 뒤 공식 entrypoint가 최초 1회 읽도록 한다.
최초 이미지 다운로드가 느리면 `docker compose --env-file backend/.env.local -f backend/docker-compose.yml pull db`를 먼저 실행한다.
`restart: unless-stopped`이므로 실행 중이던 DB는 Docker 재시작 시 다시 시작하며, 명시적으로 중지한 DB는 자동 시작하지 않는다.

역할은 다음과 같다.

| 역할 | 사용 |
|---|---|
| `sunny_admin` | 로컬 관리·migration·DBeaver 관리 연결. 앱에서 사용 금지 |
| `sunny_owner` | NOLOGIN schema/table 소유 역할. runtime에 멤버십 없음 |
| `sunny_app` | 업무 schema USAGE, CONNECT. 계약 확정 migration에서 필요한 DML/RLS 추가 |
| `sunny_auth` | 인증 schema USAGE, CONNECT. 인증 구현에서 adapter에 필요한 DML 추가 |

runtime은 NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS이고 DB CREATE/TEMP 권한이 없다.
`postgres`·`template1`의 PUBLIC CONNECT/TEMP도 회수하며 runtime의 접속은 거부된다.
runtime 검색 경로는 `pg_catalog, app` / `pg_catalog, auth`로 시스템 함수를 먼저 찾는다.
`0001`은 `sunny_meta.schema_migrations`만 만든다. #90의 `0002_authentication.sql`은
`auth.user/session/account/verification` 4개를 추가한다. #93의 `0003_photo_uploads.sql`은
사진 메타데이터·검사 시도 업무 테이블을 추가한다. 주문·배치·동의·리뷰 테이블은 아직 생성하지 않는다.

### DBeaver

New Database Connection → PostgreSQL을 선택하고 다음 두 연결을 만든다.
비밀번호는 `backend/.env.local`의 해당 값으로 로컬에서 입력하고 **Save password는 해제**한다.

| 연결 이름 | Host | Port | Database | User | 비밀번호 항목 |
|---|---|---|---|---|---|
| `sunny-dev-admin` | 127.0.0.1 | 5434 | sunny | sunny_admin | SUNNY_PG_ADMIN_PASSWORD |
| `sunny-dev-app` | 127.0.0.1 | 5434 | sunny | sunny_app | SUNNY_PG_APP_PASSWORD |

포트를 바꿨다면 실제 `SUNNY_PG_PORT`를 쓴다. 각각 Test Connection → Finish 후 SQL Editor에서 확인한다.

```sql
SELECT current_database(), current_user;
SELECT 1;
```

관리 연결에서만 [`postgres/verify.sql`](postgres/verify.sql)을 조회한다.
앱 연결에서 관리 table 조회·CREATE TABLE·SET ROLE sunny_owner는 거부돼야 한다.
DBeaver Create Table/컬럼 편집으로 schema를 변경하지 않는다.

### Migration과 검증

`postgres/migrations/0001_database_foundation.sql`은 schema·이력 table·권한을 만든다.
새 SQL 파일은 마지막 파일 다음 연속 순번을 쓰며, 적용한 파일을 고치거나 이름을 바꾸지 않는다.
SQL 파일에 psql 메타 명령이나 트랜잭션 제어(BEGIN/START/COMMIT/END/ROLLBACK/ABORT/PREPARE TRANSACTION)를 쓰지 않는다.
runner는 SQL 문자열·식별자·달러 본문·주석을 제외한 영역을 검사하고 파일별 트랜잭션을 소유한다.
같은 psql 세션의 advisory lock 안에서 이력/checksum을 확인하고 DDL과 이력을 함께 commit한다.
동일 파일의 재실행은 skip이며 이력 변조·누락·순번 불일치는 실패한다.
0001은 schema를 만드는 관리자 기반 migration이다. 0002 이후에는 runner가 `SET LOCAL ROLE sunny_owner`를 적용해
table·sequence·function을 소유 역할로 생성한다. 파일마다 역할·검색 경로를 초기화한다.
함수의 PUBLIC EXECUTE 기본 권한은 schema별이 아닌 전역에서 회수한다. runtime 함수 실행은 후속 migration이 명시적으로 부여한다.
`check`는 객체 소유자·전역 함수 기본 권한·비밀번호 인증·타 DB 접속 거부까지 검증한다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -Werror -m unittest discover -s backend/postgres/tests -v
PYTHONDONTWRITEBYTECODE=1 SUNNY_DB_TESTS=1 python3 -Werror -m unittest discover -s backend/postgres/tests -v
```

두 번째 명령은 **이 프로젝트의 로컬 sunny DB만** 사용한다. 실패 migration의 테스트 DDL은
트랜잭션 rollback되고 이력에 남지 않는다. 비밀값/실고객 데이터는 테스트에 넣지 않는다.
미적용 migration이 있으면 통합 테스트가 즉시 중단되므로 먼저 `migrate`를 완료한다.
함수·identity sequence 소유자와 PUBLIC EXECUTE 테스트도 rollback되는 probe만 사용한다.

### 종료와 복구

```sh
python3 backend/postgres/manage.py down
python3 backend/postgres/manage.py up
```

`down`은 볼륨을 보존한다. `down -v`, DB/volume 삭제로 인증 오류를 해결하지 않는다.
비밀번호 파일 변경은 기존 DB 비밀번호를 자동 변경하지 않는다. 포트/DB/역할/현재 유효 자격증명을 먼저 확인한다.
기존 Sunny 볼륨이 있고 비밀번호가 누락됐으면 `prepare`는 새 비밀번호를 생성하지 않는다.
최초 초기화가 실패한 볼륨도 자동 재초기화하지 않는다. 로그와 실제 역할 존재를 확인하고
검토한 복구 절차를 사용한다. 운영 DB·프로덕션 환경변수·기존 Supabase 폐기는 별도 작업이다.

PR #81의 병합 전 0001·초기화 보완은 새 빈 DB에서 검증한다. 예전 0001을 이미 적용한 DB는 checksum이 달라
자동 재적용되지 않으며 init 스크립트도 다시 실행되지 않는다. 이력을 직접 고치거나 기존 볼륨을 삭제하지 않는다.
데이터가 있으면 보존·백업을 우선하고, 팀장과 별도의 이관 절차를 정한 뒤 적용한다.

## 인증 DB·서버 — #90

Better Auth **1.7.10**, pg **8.23.1**, @types/pg **8.23.1**, server-only **0.0.1**을 고정했다.
사용자·세션·계정·인증정보 PK와 user FK는 PostgreSQL **uuid**다. 설치 버전의
`better-auth/db/migration` 생성 SQL을 바탕으로 migration을 작성했고 schema introspection으로 대조한다.
추가한 제약은 account의 providerId/accountId 복합 UNIQUE와 인증 전용 역할 RLS·최소 DML 권한이다.
런타임에서 CLI migrate나 자동 schema 생성은 실행하지 않는다.

```sh
# 저장소 루트, 기존 개발 DB를 보존한다
python3 backend/postgres/manage.py up
python3 backend/postgres/manage.py migrate
node backend/auth/prepare-local.mjs
cd frontend
npm run dev
```

Node 24를 사용한다. 로컬 준비 도구는 기존 frontend/.env.local 값을 덮어쓰지 않고 누락된 이름만
추가하고 빈 placeholder만 채우며 값은 출력하지 않는다. 기존 AUTH_ENABLED=false가 있으면 담당자가 로컬에서 true로 변경해야 한다.
AUTH_DATABASE_URL은 sunny_auth, DATABASE_URL은 sunny_app만 사용한다. 관리자 연결은 앱에 넣지 않는다.
두 앱 pool도 `pg_catalog`를 먼저 검색하도록 지정해 #81의 DB 역할 설정을 덮어쓰지 않는다.
`localhost`와 `127.0.0.1`은 다른 Origin이므로 브라우저 주소와 BETTER_AUTH_URL을 맞춘다.

인증 API·DTO·오류·개발 정책의 정본은 [CONTRACT_API.md 인증 절](../docs/CONTRACT_API.md#인증-계약--pr-92)이다.
구현 근거와 검증 범위 및 #114 새 사용자 요구에 따른 정본과의 차이는 [auth-contract.md](auth-contract.md)를 본다.
현재 브랜치는 로컬 변경이며 #111/#112의 기존 팀장 결정 및 운영 계약을 대체하지 않는다.
로그인/가입 화면과 lib/auth.ts는 인증 API에 연결한다. 상품/CMS의 NEXT_PUBLIC_API_MODE와 무관하며
브라우저 localStorage의 기존 mock 회원 값은 읽거나 자동 이관하지 않는다. 이전에 화면 시안에서 가입했다면 다시 가입한다.

```sh
cd frontend
npm run test:auth
npm run typecheck
npm test
npm run build
```

인증 통합 테스트는 **로컬 127.0.0.1의 sunny DB만** 사용한다. test mailer가 인증 링크를 메모리에만
보관하고 가짜 .invalid 회원·게스트를 만들었다가 자신이 만든 ID만 정리한다. 토큰/쿠키/비밀번호를 출력하지 않는다.
실제 Resend 메일을 보내지 않는다. 운영 DB/실제 고객 데이터에 실행하지 않는다.
Better Auth의 읽기 전용 migration 대조는 `schemaName=auth`를 명시한다. 검색 경로의 첫 schema를
목표로 추정하는 CLI 기본값은 `pg_catalog` 우선인 런타임 연결에 사용하지 않으며, 반환된 DDL을 실행하지 않는다.
게스트 재사용 시 갱신 쿠키, 실제 native 429의 Retry-After, 메일 장애 503과 동시 요청 격리도 검증한다.

실제 발송은 아래 SMTP 설정 또는 기존 RESEND_API_KEY + AUTH_EMAIL_FROM으로 연결한다. 설정이 없고 로컬 개발 메일도
켜지지 않았다면 비밀번호 재설정 메일 요청은 503이다. 가입과 로그인은 메일 설정 없이 가능하다. 설정 후 개발 서버를 재시작한다.
prepare-local은 메일 방식을 임의로 선택하지 않는다.
발송 도중 실패하면 재설정 요청을 성공으로 응답하지 않는다. 발송 복구 후 비밀번호 재설정을 다시 요청한다.

### 로컬 비밀번호 재설정 SMTP — #114

팀 이메일을 만든 뒤 메일 제공자의 SMTP 사용을 허용하고 SMTP 전용/앱 비밀번호를 발급한다.
실제 값은 `frontend/.env.local` 또는 승인된 Vercel 환경변수에만 입력한다. 채팅·이슈·Git에 비밀번호를 적지 않는다.
아래는 입력 형태이며 실제 계정이 아니다. Google 등 특정 제공자에 종속되지 않는다.

```dotenv
AUTH_EMAIL_FROM="Sunny <team@example.com>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=team@example.com
SMTP_PASSWORD=replace-with-provider-smtp-password
AUTH_DEV_LOCAL_MAIL=false
```

발신 주소는 로그인 계정 또는 제공자가 허용한 별칭을 사용한다. 465는 implicit TLS,
그 외 포트(기본 587)는 STARTTLS가 반드시 성공해야 인증·발송한다. 인증서 검증과 TLS 1.2 이상을 강제한다.
연결·서버 인사·유휴 시간 제한은 각각 10초다. 제공자 원본 오류·주소·비밀번호·인증 링크는 로그에 남기지 않는다.
이메일에는 새 비밀번호 설정 링크와 1시간·일회 사용 안내가 들어간다. SMTP 서버 수락은 실제 수신함 도착을 보장하지 않는다.

명시적인 개발 파일 메일 → SMTP → 기존 Resend 순서다. SMTP 변수 중 하나라도 입력하면 SMTP 설정을 검사하며,
불완전하거나 잘못된 설정은 재설정 메일 요청을 DB 변경 전 503으로 차단한다. SMTP 장애 때 다른 제공자로 자동 재발송하지 않는다.
실제 수신을 시험하려면 `AUTH_DEV_LOCAL_MAIL=false`로 두고 서버를 재시작한다. 인증 활성화·DB·고정 origin은 기존 설정을 따른다.
운영에서는 실제 HTTPS origin을 사용하며 기존 운영 활성화 조건은 그대로 적용한다.

새 테스트 계정으로 가입(메일 없음) → 로그인 → 비밀번호 재설정 요청 → 메일 수신/스팸함 → 새 비밀번호 설정 → 옛 비밀번호 거부/새 비밀번호 로그인 → 기존 세션 폐기를 확인한다.
팀 메일 계정 생성·실제 발송/수신·배포 환경 검증은 별도 수행해야 한다. 현재 구현 검증은 로컬 모의 SMTP와 합성 회원 기준이다.
SMTP 검증은 `cd frontend && node --conditions=react-server --test ../backend/auth/tests/smtp-mail.test.ts`로 실행한다(Node 24·OpenSSL 필요).
테스트가 만든 일회성 CA만 테스트 자식 프로세스에 신뢰시키며 시스템 인증서·실제 메일 계정·기존 DB는 변경하지 않는다.
전송 옵션은 [Nodemailer SMTP 문서](https://nodemailer.com/smtp)를 따른다.

### 개발용 파일 메일

실제 SMTP 계정 없이 로컬 인증을 확인하려면 `frontend/.env.local`에 다음을 명시하고 서버를 재시작한다.

```dotenv
AUTH_DEV_LOCAL_MAIL=true
```

NODE_ENV=development이고 BETTER_AUTH_URL이 localhost/127.0.0.1/[::1]인 경우만 적용된다. 운영에서는
이 옵션이 true여도 로컬 저장을 허용하지 않는다. 실제 발송 설정이 없으면 재설정 메일 요청은 차단된다.
`frontend/.sunny-auth-mail/`에 재설정 요청마다 HTML/txt가 생성된다(디렉터리 700·파일 600, Git 제외).
최신 HTML의 **새 비밀번호 설정하기**를 누른다. 토큰은 URL fragment로 전달하여 서버 요청 로그에 넣지 않고,
화면에서 읽은 직후 주소창에서도 제거한다. 링크가 만료됐거나 이미 사용됐으면 새 메일을 요청한다.
비밀번호 변경 후 모든 기존 세션을 폐기하고 별도 로그인한다. 링크는 API JSON/터미널에 출력하지 않는다.
가입 직후 auth.user/emailVerified=false와 auth.account(기존 scrypt)가 저장되고 메일 없이 별도 로그인할 수 있다.
emailVerified를 일괄 true로 변경하지 않는다. 카카오가 검증한 이메일/소셜 계정의 경계는 유지한다.
약관은 UI 확인만 하고 이력을 저장하지 않으며 선택 마케팅 동의는 비활성화했다.
동의 버전·증빙 DB 수집은 별도 계약/migration이 필요하다.

Next 개발 요청 로그는 /api/auth/를 제외한다. 운영 접근 로그도 인증 query를 마스킹해야 한다.
DBeaver에서는 `sunny-dev-admin` 관리 연결의 `auth` schema를 새로고침하면 4개 테이블을 볼 수 있다.
`sunny_app` 연결에서 인증 테이블이 안 보이는 것은 의도한 권한 분리다. 새 SQL 탭/자동 커밋 조회를 사용한다.

```sql
SELECT id, name, email, "emailVerified", "isAnonymous", "createdAt"
FROM auth."user" ORDER BY "createdAt" DESC;

-- 비밀번호 원문/해시·세션 토큰은 조회 결과에 출력하지 않는다.
SELECT "userId", "providerId", password IS NOT NULL AS has_password
FROM auth.account;
```

#81 기반과 #65 사진 계약은 main에 머지되어 이 브랜치에도 반영했다. 인증 정본의 공동 리뷰 후
팀장이 #92 머지를 판단한다. 여기서 사진/주문 데이터를 생성하지 않는다.
세션 수명·비밀번호·요청 제한 수치는 정본 인증 절의 개발 검토값이다. 메모리 요청 제한은 단일 개발
프로세스용이며 **Vercel 다중 인스턴스 운영 전에 공유 제한 저장소/정책을 확정**해야 한다.
운영 인증은 기본 비활성이며, 활성화 전에 공동 계약·실제 메일·HTTPS·검증된 DB TLS·공유 제한을 확인한다.
2026-10-16 `npm audit --omit=dev`에서 기존 main의 Next 16.3.5(critical), sharp 0.35.4(high),
source-map-js 1.2.1(high) 권고가 확인됐다. Better Auth/pg 신규 직접 의존성의 권고는 없었다.
공통 의존성 수정은 팀장 후속 요청이며 보안 업데이트와 회귀 검증 전 운영 활성화하지 않는다.

## 배포

| 이벤트 | Vercel |
|---|---|
| PR 열림 · 커밋 추가 | 미리보기 URL — PR에 자동으로 붙는다 |
| main 머지 (봉준표) | 프로덕션 배포 |

프로덕션 환경변수 변경은 **팀장 확인 후** 한다.


## 카카오 로그인 — 같은 #90 / PR #92 추가 구현

기존 Better Auth 1.7.10과 auth 테이블을 사용한다. 별도 SDK/라이브러리/테이블을 추가하지 않는다.
`frontend/.env.local`에서 위 서버 전용 KAKAO_* 세 이름을 준비하고 개발 서버를 재시작한다.
키 미설정/플래그 false이면 카카오 버튼만 준비 중으로 표시하고 이메일 인증은 유지한다.

개발자 콘솔에서 담당자가 직접 준비할 항목:
1. 팀 카카오 앱의 카카오 로그인 활성화, REST API 키와 Client Secret 확인.
2. Redirect URI `http://localhost:3000/api/auth/callback/kakao` 등록. localhost/127.0.0.1 혼용 금지.
   운영은 고정 HTTPS 도메인 + 동일 경로를 별도로 등록하며 임의 Vercel preview 주소를 신뢰하지 않는다.
3. account_email/profile_nickname 동의항목과 이메일 제공 권한 확인. profile_image/전화번호/생일은 요청하지 않는다.
   이메일 제공 조건은 [카카오 설정 안내](https://developers.kakao.com/docs/ko/kakaologin/prerequisite)와
   [Better Auth 카카오](https://better-auth.com/docs/authentication/kakao)를 확인한다.
4. 앱의 테스트 허용 계정/공개 상태 및 개인정보 처리방침·서비스 자체 동의 절차를 확인한다.

키는 채팅/PR/스크린샷에 붙이지 않는다. 코드 검증은 모의 카카오 응답 + 실제 로컬 PG이며
실제 카카오 계정 연동/실제 Resend 전달/운영 활성화 완료를 뜻하지 않는다.
동일 이메일 기존 회원 자동 연결 OFF, 게스트 보존, 카카오 이메일 미제공 거부·미인증 메일 인증을 유지한다.
카카오 제공자가 유효하고 인증된 이메일을 반환한 경우 별도 서비스 메일을 중복 발송하지 않는다.
동의 증빙 DB·추가 이메일 수집/명시적 계정 연결은 후속 공동 계약이며 현재 범위에서 우회 구현하지 않는다.

실제 Next 개발 서버가 실행 중일 때 저장소 루트에서 `node backend/auth/tests/http-flow.mjs`로
새 합성 .invalid 회원의 가입/DB 저장 → 정상·잘못 인코딩된 메일 인증 → 로그인/DB 세션 → 로그아웃을 확인한다.
기존 메일/실 사용자 링크를 대신 사용하지 않는다. 테스트는 로컬 origin·개발 파일 메일 설정만 허용한다.
검증용 EmailProof 회원과 비공개 OS 임시 fixture를 남겨 브라우저 확인에 사용할 수 있다.
테스트 도중 실패하면 생성된 합성 회원/메일이 남을 수 있다. 실제 고객 데이터/기존 볼륨은 삭제하지 않는다.
