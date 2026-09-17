# backend — 영역 규칙 (이재원)

**먼저 [`../AGENTS.md`](../AGENTS.md)를 읽으십시오.** `frontend/` 안의 서버 파일을 만질 때는 [`../frontend/AGENTS.md`](../frontend/AGENTS.md)의 코드 규칙도 함께 따른다.

## 이 영역이 맡는 것

서버 API, CMS, 데이터베이스, 외부 API 연동, 배포. **파일이 두 곳에 있다.**

| 위치 | 내용 |
|---|---|
| `backend/sanity/` | Sanity Studio · 콘텐츠 스키마 (컬렉션 · 제품 · 제작 기록 · 이미지) |
| `backend/supabase/` | 마이그레이션 SQL · 접근 정책(RLS) · 가짜 seed 데이터 |
| `frontend/app/api/` | Next.js 서버 API (Route Handlers) |
| `frontend/lib/server/` | 서버 전용 클라이언트 — Sanity · Supabase · 기상청 |

서버 API가 `frontend/` 안에 있는 이유: 기획서 5-1이 **Next.js 서버 API**이고, 화면과 한 앱으로 Vercel에 배포하기 때문이다.

## 스택 (고정 — 기획서 5-1)

| | |
|---|---|
| 서버 API | Next.js Route Handlers (`app/api/**/route.ts`) |
| CMS | Sanity (Studio · GROQ) |
| DB | Supabase PostgreSQL · RLS · Supabase CLI 마이그레이션 |
| 외부 데이터 | 기상청 생활기상지수 API (공공데이터포털) — 자외선지수 |
| 배포 | Vercel (GitHub 연동 · PR 미리보기) |

## 작업 방식

- **이슈로 시작한다.** 팀장이 올리거나, 재원이 제안하고 팀장이 확인한 이슈에서만 브랜치를 딴다
- 브랜치 `feat/back-<설명>`, PR 첫 줄 `Closes #이슈번호`, **머지는 봉준표만**
- **계약 먼저** — 응답 모양은 [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md)에 먼저 적고 준표와 같은 PR에서 합의한다. **실제 응답 = 계약 예시 = `frontend/lib/mock/*.json`**

## 개발 환경

**Docker는 필요 없다.** Sanity와 Supabase는 호스팅 서비스다.

```
# 서버 API — frontend 개발 서버에 같이 뜬다
cd frontend
npm run dev                                   # http://localhost:3000/api/...

# Sanity Studio (스키마 편집)
cd backend/sanity
npm run dev                                   # http://localhost:3333
```

- Supabase 스키마는 **마이그레이션 파일로만** 바꾼다 — `backend/supabase/migrations/`
- 로컬 DB로 시험하고 싶으면 `supabase start`(Docker 필요)를 쓴다. 선택 사항이고 재원만 한다
- 환경변수 이름의 원본은 [`README.md`](README.md). 실제 값은 `frontend/.env.local`(각자)과 Vercel 프로젝트 설정(배포)에만 둔다

## 절대 하지 말 것

1. **서버 전용 키를 브라우저에 노출** — `NEXT_PUBLIC_` 금지. `lib/server/` 파일은 맨 위에 `import "server-only"`
2. **`SUPABASE_SERVICE_ROLE_KEY`를 필요 없는 곳에 쓰기** — 기본은 `anon` 키 + RLS. service role은 RLS를 무시한다
3. **RLS 없이 테이블 만들기** — 주문 요청·설문은 개인정보다
4. **Supabase 대시보드에서 스키마 직접 수정** — 기록이 안 남아 다른 PC·배포와 어긋난다. 마이그레이션 파일로만
5. **실제 개인정보를 커밋·로그·seed에 넣기** — seed는 가짜 이름·가짜 연락처만
6. **Sanity 데이터셋 삭제 · Supabase 테이블 DROP · Vercel 프로덕션 환경변수 교체** — 팀장 확인 후에만
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
