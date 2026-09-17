# frontend

담당: **봉준표** (팀장 · 페이지 · 3D 뼈대) · **조수희** (인터랙션) · **이재원** (서버 API)

브랜드 웹사이트의 Next.js 앱. 규칙은 [`AGENTS.md`](AGENTS.md).

> **앱 뼈대는 아직 없다.** 첫 뼈대 이슈에서 만든다. 아래 표는 뼈대가 따를 구조다.

## 폴더와 담당 — 단일 진실 원천

| 경로 | 담당 | 내용 |
|---|---|---|
| `app/layout.tsx` · `app/globals.css` | 봉준표 | 공통 레이아웃 · 디자인 토큰 |
| `app/page.tsx` | 봉준표 (조립) | 메인 — 태양 스토리텔링. 조수희의 연출 부품을 가져다 조립한다 |
| `app/(site)/` | 봉준표 | 브랜드 소개 · 컬렉션 · 커스텀 · 제작 기록 페이지 |
| `components/common/` | 봉준표 | 헤더 · 푸터 · 레이아웃 부품 |
| `components/scene/` | 봉준표 | **WebGL 뼈대** — 태양 셰이더 · 씬 구조 · 보드 좌표 |
| **`components/interaction/`** | **조수희** | **GSAP 스크롤 연출 · 발색 비교 · 씬 파라미터** → [README](components/interaction/README.md) |
| `lib/api.ts` · `lib/mock/` · `lib/types.ts` | 봉준표 (`types.ts`는 이재원과 공동) | 화면이 부르는 데이터 함수 · 가짜 데이터 · 계약 타입 |
| `app/api/` | **이재원** | Next.js 서버 API → [`../backend/`](../backend/) |
| `lib/server/` | **이재원** | 서버 전용 클라이언트 (Sanity · Supabase · 기상청) |
| `tests/` | 봉준표 | `node --test` 로직 테스트 |
| `e2e/` | 봉준표 | Playwright 페이지 테스트 |
| **`e2e/interaction/`** | **조수희** | 인터랙션 스모크 테스트 |

## 페이지 — 단일 진실 원천

| 경로 | 페이지 | 담당 | 상태 |
|---|---|---|---|
| `/` | 메인 — 태양이 다가와 스토리 보드로 넘어가는 스토리텔링 | 봉준표 (조립 · 3D) + 조수희 (스크롤 연출) | 시안 후보 비교 중 |
| `/about` | 브랜드 소개 | 봉준표 | 예정 |
| `/collection` | 컬렉션 — 팔찌 · 목걸이 | 봉준표 | 예정 |
| `/collection/[slug]` | 제품 상세 + 실내/햇빛 발색 비교 | 봉준표 (페이지) + 조수희 (발색 비교) | 예정 |
| `/custom` | 커스텀 주문 요청 | 봉준표 (화면) + 이재원 (API) | 예정 |
| `/archive` | 제작 기록 | 봉준표 | 예정 |

## 명령어

[`AGENTS.md`](AGENTS.md) "개발 환경"을 본다.

## 환경변수

[`.env.example`](.env.example)을 `.env.local`로 복사한다. 키 이름의 원본은 [`../backend/README.md`](../backend/README.md).
