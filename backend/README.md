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
| PostgreSQL | 주문 요청 · 선호 색상 설문 · 인증 세션 | 개발: Docker 로컬 DB · 운영: 미정 | 운영 호스팅 정한 뒤 기록 | — |
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

브라우저가 Sanity·DB·R2·기상청을 직접 부르지 않으므로 서버 키에 `NEXT_PUBLIC_`이 필요 없다. 바뀌면 [`../frontend/.env.example`](../frontend/.env.example)도 같은 PR에서 고친다.

`SUNNY_PG_*` 값은 ignored `backend/.env.local`에만 둔다. `prepare`는 누락된 개발 DB 값만 생성하고 기존 설정·비밀번호를 보존한다. Python 도구는 이 파일의 값을 사용해 같은 이름의 셸 환경변수와 `COMPOSE_*`가 다른 DB/설정으로 덮어쓰지 못하게 한다. 전체 `docker compose config` 출력에는 비밀번호가 펼쳐질 수 있으므로 `config -q`만 사용한다.

Next.js의 `DATABASE_URL`·별도 인증 연결·Better Auth·R2·메일 환경변수는 각 구현 이슈에서 추가한다. 앱 런타임에 관리 연결 문자열을 사용하지 않는다. 실제 앱 값은 `frontend/.env.local`과 승인된 배포 환경에만 둔다.

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

역할은 다음과 같다.

| 역할 | 사용 |
|---|---|
| `sunny_admin` | 로컬 관리·migration·DBeaver 관리 연결. 앱에서 사용 금지 |
| `sunny_owner` | NOLOGIN schema/table 소유 역할. runtime에 멤버십 없음 |
| `sunny_app` | 업무 schema USAGE, CONNECT. 계약 확정 migration에서 필요한 DML/RLS 추가 |
| `sunny_auth` | 인증 schema USAGE, CONNECT. 인증 구현에서 adapter에 필요한 DML 추가 |

runtime은 NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS이고 DB CREATE/TEMP 권한이 없다.
현재 생성된 table은 `sunny_meta.schema_migrations`뿐이다. 인증/업무 schema는 비어 있다.

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
다음 SQL 파일은 0002부터 연속 순번을 쓰며, 적용한 파일을 고치거나 이름을 바꾸지 않는다.
SQL 파일에 psql 메타 명령이나 BEGIN/COMMIT을 쓰지 않는다. runner가 파일별 트랜잭션을 소유한다.
같은 psql 세션의 advisory lock 안에서 이력/checksum을 확인하고 DDL과 이력을 함께 commit한다.
동일 파일의 재실행은 skip이며 이력 변조·누락·순번 불일치는 실패한다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -Werror -m unittest discover -s backend/postgres/tests -v
PYTHONDONTWRITEBYTECODE=1 SUNNY_DB_TESTS=1 python3 -Werror -m unittest discover -s backend/postgres/tests -v
```

두 번째 명령은 **이 프로젝트의 로컬 sunny DB만** 사용한다. 실패 migration의 테스트 DDL은
트랜잭션 rollback되고 이력에 남지 않는다. 비밀값/실고객 데이터는 테스트에 넣지 않는다.

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

## 배포

| 이벤트 | Vercel |
|---|---|
| PR 열림 · 커밋 추가 | 미리보기 URL — PR에 자동으로 붙는다 |
| main 머지 (봉준표) | 프로덕션 배포 |

프로덕션 환경변수 변경은 **팀장 확인 후** 한다.
