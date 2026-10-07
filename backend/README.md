# backend — FastAPI · CMS · 데이터 · 배포

담당: **이재원**

규칙은 [`AGENTS.md`](AGENTS.md). API 규격은 [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md).
팀장과 합의한 FastAPI 전환 작업은 [#71](https://github.com/bongjunpyo/Sunny/issues/71)이다.
고정 스택·인증 계약 원문의 팀장 반영용 수정안은 [`fastapi-transition.md`](fastapi-transition.md)에 있다. 원문 반영과 계약 합의 후 머지한다.

## 폴더

```
backend/
├── api/          FastAPI 진입점 · 서버 전용 Supabase 클라이언트
├── tests/        Python 서버 테스트
├── pyproject.toml / uv.lock  Python 의존성 · 잠금 파일
├── vercel.json   FastAPI 독립 배포 설정
├── sanity/       Sanity Studio · 스키마 (후속 이슈)
└── supabase/     migrations/ · seed · RLS 정책

frontend/
├── app/api/      동일 출처 /api/* 전달 라우트
└── lib/server/   FastAPI 프록시 (업무 로직은 Python)
```

## 로컬 실행

Python 3.11~3.14와 [uv](https://docs.astral.sh/uv/), 화면은 기존 Node 24·npm을 사용한다.

터미널 1:

```sh
cd backend
cp -n .env.example .env.local  # 기존 환경파일은 덮어쓰지 않는다
uv sync --locked
uv run --env-file .env.local uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

터미널 2:

```sh
cd frontend
cp -n .env.example .env.local  # 기존 파일에는 FASTAPI_URL 항목만 추가
npm ci
npm run dev
```

Next 서버가 읽는 `FASTAPI_URL=http://127.0.0.1:8000`을 설정한다. 기본 화면은 기존 mock 모드다.
FastAPI 직접 확인은 `http://127.0.0.1:8000/api/health`, 화면을 통한 확인은 `http://localhost:3000/api/health`, API 문서는 `/api/docs`다.
health는 프로세스 실행 확인이며 Supabase·Sanity·기상청의 연결 상태를 뜻하지 않는다.

이번 전환은 서버 실행 기반을 바꾼다. 제품·기록·인증·주문·설문·사진·기상청의 업무 API는 계약과 후속 구현 이슈에서 추가한다. 아직 구현되지 않은 경로는 404다.

## 외부 서비스 — 단일 진실 원천

| 서비스 | 용도 | 프로젝트 이름 | 소유 계정 | 팀장 접근 |
|---|---|---|---|---|
| Sanity | 컬렉션 · 제품 · 제작 기록 · 이미지 | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| Supabase | 주문 요청 · 선호 색상 설문 | Sunny_project | 이재원 개인 조직 | 초대 완료(2026-09-25) |
| Vercel | 배포 · PR 미리보기 | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| 공공데이터포털 | 기상청 생활기상지수 인증키 | — | 만든 뒤 기록 (인코딩/디코딩 중 사용한 키 표기) | — |

**비밀값(키 · 토큰 · 비밀번호)은 여기에 적지 않는다.**

## 환경변수 이름 — 단일 진실 원천

| 이름 | 공개 | 읽는 곳 | 용도 |
|---|:---:|---|---|
| `NEXT_PUBLIC_API_MODE` | O | `lib/api.ts` | 화면 데이터 모드 `mock` \| `api` (없으면 mock) |
| `FASTAPI_URL` | X | Next `lib/server/fastapi-proxy.ts` | FastAPI 원점. 로컬 HTTP 또는 배포 HTTPS, `/api`를 붙이지 않음 |
| `SANITY_PROJECT_ID` | X | Python 서버 (후속 구현) | Sanity 프로젝트 |
| `SANITY_DATASET` | X | Python 서버 (후속 구현) | Sanity 데이터셋 |
| `SANITY_API_READ_TOKEN` | X | Python 서버 (후속 구현) | 비공개·초안 콘텐츠 읽기 |
| `SUPABASE_URL` | X | `backend/api/supabase.py` | Supabase 주소 |
| `SUPABASE_PUBLISHABLE_KEY` | X | `backend/api/supabase.py` | RLS가 적용되는 공개 권한 키 (`anon` 역할) |
| `SUPABASE_SECRET_KEY` | X | Python 서버 (필요한 후속 구현만) | RLS 우회 — 현재 연결 기반에서 사용하지 않음 |
| `KMA_SERVICE_KEY` | X | Python 서버 (후속 구현) | 기상청 생활기상지수 |

실제 값은 화면의 `frontend/.env.local`, Python의 `backend/.env.local`, 승인된 Vercel 프로젝트 설정에만 둔다. 견본은 [`../frontend/.env.example`](../frontend/.env.example)과 [`.env.example`](.env.example)이다.
기존 `frontend/.env.local`의 외부 서비스 설정은 필요한 이름만 Python 환경으로 옮긴다. 키를 문서·터미널 출력·PR에 붙이지 않는다.

Supabase 클라이언트는 요청마다 새로 만들며 세션 저장·자동 갱신을 끈다. 사용자 JWT 검증·RLS 컨텍스트 주입·HttpOnly 세션 구현은 #70 계약 합의 후 추가한다. 클라이언트를 전역 공유하거나 publishable 키 자체를 로그인 증명으로 쓰지 않는다.

## 배포

Vercel 프로젝트 두 개를 같은 저장소에 연결한다. 화면 프로젝트 Root Directory는 `frontend`, FastAPI 프로젝트는 `backend`다.
화면 프로젝트의 서버 환경변수 `FASTAPI_URL`에 해당 환경의 FastAPI HTTPS 원점을 넣는다. API 프로젝트에 외부 서비스 설정을 넣는다.
브라우저는 화면 도메인의 `/api/*`를 사용하므로 다른 출처 API 호출을 위한 CORS 설정은 필요하지 않다. 프록시는 쿠키·다중 `Set-Cookie`·상태 코드를 전달하고 응답을 캐시하지 않는다.
미리보기는 승인된 테스트 API를 가리키도록 설정하고 운영 API에 연결하지 않는다. API 미리보기에 Deployment Protection이 있다면 서버 간 호출이 가능한지 별도로 검증한다.
카카오·비밀번호 재설정의 콜백은 브라우저가 쓰는 화면 도메인을 기준으로 #70에서 확정한다. 프록시가 전달하는 요청 헤더만으로 외부 URL을 신뢰하지 않는다.

| 이벤트 | Vercel |
|---|---|
| PR 열림 · 커밋 추가 | 미리보기 URL — PR에 자동으로 붙는다 |
| main 머지 (봉준표) | 프로덕션 배포 |

프로덕션 환경변수 변경은 **팀장 확인 후** 한다.

## 검증

```sh
cd backend
uv run --locked pytest

cd ../frontend
node --test lib/server/fastapi-proxy.test.ts
npm test
npm run typecheck
npm run build
```

Python 테스트는 외부 서비스에 접속하지 않는다. 실제 DB/RLS와 배포 미리보기는 해당 계약·구현 PR에서 별도로 검증한다.
