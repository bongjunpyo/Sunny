# backend — 영역 규칙 (이재원)

**먼저 [`../AGENTS.md`](../AGENTS.md)를 읽으십시오.** `frontend/` 안의 서버 파일을 만질 때는 [`../frontend/AGENTS.md`](../frontend/AGENTS.md)의 코드 규칙도 함께 따른다.

## 이 영역이 맡는 것

서버 API, CMS, 데이터베이스, 외부 API 연동, 배포. **파일이 두 곳에 있다.**

| 위치 | 내용 |
|---|---|
| `backend/sanity/` | Sanity Studio · 콘텐츠 스키마 (컬렉션 · 제품 · 제작 기록 · 이미지) |
| `backend/postgres/` (후속 이슈에서 생성) | 개발 DB Compose · 역할 초기화 · 마이그레이션 SQL · 접근 정책(RLS) · 가짜 seed 데이터 |
| `frontend/app/api/` | Next.js 서버 API (Route Handlers) |
| `frontend/lib/server/` | 서버 전용 클라이언트 — Sanity · PostgreSQL · 인증 · R2 · 기상청 |

서버 API가 `frontend/` 안에 있는 이유: 기획서 5-1이 **Next.js 서버 API**이고, 화면과 한 앱으로 Vercel에 배포하기 때문이다.

## 스택 (고정 — 기획서 5-1)

| | |
|---|---|
| 서버 API | Next.js Route Handlers (`app/api/**/route.ts`) |
| CMS | Sanity (Studio · GROQ) |
| DB | PostgreSQL(독립) · RLS · 버전 관리되는 SQL 마이그레이션 |
| 인증 | Better Auth · PostgreSQL DB 세션 · HttpOnly 쿠키 (#71 채택, 구현 전) |
| 고객 사진 | Cloudflare R2 비공개 버킷 · 서버가 발급한 짧은 수명 서명 URL (#71 채택, 구현 전) |
| 외부 데이터 | 기상청 생활기상지수 API (공공데이터포털) — 자외선지수 |
| 배포 | Vercel (GitHub 연동 · PR 미리보기) |

## 작업 방식

- **이슈로 시작한다.** 재원은 `back` 영역 이슈를 **직접 쓰고 자신에게 배정한 뒤 바로 시작**한다 (팀장 확인 불필요). 팀장이 올린 이슈도 같다
- 이슈에는 **브랜치 이름 · 수정 허용 파일 · 완료 기준**을 적는다. 양식은 `작업 요청 (C형)` — 학습 섹션(비유 · 질문)은 비워도 된다
- 브랜치 이름은 재원이 짓는다 — `<종류>/back-<설명>` (예: `feat/back-uv-index-api`). main에서 딴다
- PR 첫 줄 `Closes #이슈번호`. **머지는 봉준표만 — 이슈를 직접 썼어도 머지하지 않는다**
- 자기가 쓴 이슈를 취소·중복으로 닫을 때는 사유를 댓글로 남기고 원격 브랜치도 지운다 — `git push origin --delete <브랜치>`. **남의 이슈·브랜치는 닫거나 지우지 않는다**
- 다른 영역 작업이 필요하면 빈 이슈로 요청만 한다. **담당자 배정은 팀장**이 한다 (조수희에게 직접 작업을 요청하지 않는다)
- 권한 전체는 [`../docs/GIT_RULES.md`](../docs/GIT_RULES.md) "누가 무엇을 하나"
- **계약 먼저** — 응답 모양은 [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md)에 먼저 적고 준표와 같은 PR에서 합의한다. **실제 응답 = 계약 예시 = `frontend/lib/mock/*.json`**

## 개발 환경

**Docker는 개발 DB(PostgreSQL)에만 쓰고, 재원만 설치한다.** Next.js는 Docker 없이 `npm run dev`로 띄운다. Sanity는 호스팅 서비스다.

```
# 서버 API — frontend 개발 서버에 같이 뜬다
cd frontend
npm run dev                                   # http://localhost:3000/api/...

# Sanity Studio (스키마 편집)
cd backend/sanity
npm run dev                                   # http://localhost:3333
```

- DB 스키마는 **마이그레이션 파일로만** 바꾼다 — 경로·실행 도구는 후속 이슈에서 확정(#71 설계 8절)
- Next.js 앱은 **관리자 DB 계정으로 연결하지 않는다** — `NOSUPERUSER · NOBYPASSRLS` 앱 전용 계정만 쓴다
- 환경변수 이름의 원본은 [`README.md`](README.md). 실제 값은 `frontend/.env.local`(각자)과 Vercel 프로젝트 설정(배포)에만 둔다

## 절대 하지 말 것

1. **서버 전용 키를 브라우저에 노출** — `NEXT_PUBLIC_` 금지. `lib/server/` 파일은 맨 위에 `import "server-only"`
2. **앱 런타임에 관리자·테이블 소유자·`BYPASSRLS` DB 계정 쓰기** — 이 계정들은 RLS를 무시한다. 기본은 앱 전용 계정 + RLS
3. **RLS 없이 테이블 만들기** — 주문 요청·설문은 개인정보다
4. **DBeaver 등 DB 도구에서 스키마 직접 수정** — 기록이 안 남아 다른 PC·배포와 어긋난다. 마이그레이션 파일로만 (DB 도구는 조회·검증용)
5. **실제 개인정보를 커밋·로그·seed에 넣기** — seed는 가짜 이름·가짜 연락처만
6. **Sanity 데이터셋 삭제 · DB 테이블 DROP · 개발 DB 볼륨 삭제(`down -v`) · R2 버킷·객체 삭제 · Vercel 프로덕션 환경변수 교체** — 팀장 확인 후에만
7. **계약을 혼자 바꾸기** — `CONTRACT_API.md` 수정은 준표와 같은 PR에서
8. **화면 컴포넌트 수정** — `components/`·`app/(site)/`는 준표·수희 영역. 필요하면 이슈 댓글로 요청
9. **라이브러리 임의 추가** — 이슈로 제안
10. **main commit·push · PR 머지 · force push**

## 혼자 검증하는 법

```
curl http://localhost:3000/api/uv                 # 응답 모양이 계약 예시와 같은가
curl http://localhost:3000/api/products
```

- **실패 경로를 일부러 만든다** — `KMA_SERVICE_KEY`를 비우고 `/api/uv`가 "최근 갱신 시각 + 안내 문구"를 돌려주는지 확인한다
- 응답 JSON과 `frontend/lib/mock/`의 같은 파일을 비교한다. 다르면 코드가 아니라 **계약부터** 고친다
- PR마다 Vercel 미리보기 URL에서 한 번 더 확인한다

## 알려진 리스크

- **공공데이터포털 인증키는 인코딩 키와 디코딩 키가 따로 있다.** 요청 라이브러리가 한 번 더 인코딩하면 인증 실패가 난다 — 어느 키를 썼는지 README에 적는다
- **외부 API 지연·호출 제한** — 자외선지수는 캐시(재검증 주기)를 두고, 실패하면 마지막 값을 갱신 시각과 함께 준다
- **시간대** — Vercel 서버는 UTC로 돈다. 기상청 발표 시각은 한국 시간 기준이므로 날짜·시각 계산에서 시간대를 명시한다
