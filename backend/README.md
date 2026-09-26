# backend — 서버 API · CMS · 데이터 · 배포

담당: **이재원**

규칙은 [`AGENTS.md`](AGENTS.md). API 규격은 [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md).

## 폴더

```
backend/
├── sanity/       Sanity Studio · 스키마          (첫 이슈에서 생성)
└── supabase/     migrations/ · seed · RLS 정책   (첫 이슈에서 생성)

frontend/
├── app/api/      Next.js 서버 API                 ← 이재원
└── lib/server/   서버 전용 클라이언트              ← 이재원
```

## 외부 서비스 — 단일 진실 원천

| 서비스 | 용도 | 프로젝트 이름 | 소유 계정 | 팀장 접근 |
|---|---|---|---|---|
| Sanity | 컬렉션 · 제품 · 제작 기록 · 이미지 | 만든 뒤 기록 | 만든 뒤 기록 | 초대 |
| Supabase | 주문 요청 · 선호 색상 설문 | Sunny_project | 이재원 개인 조직 | 초대 완료(2026-09-25) |
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
| `SUPABASE_URL` | X | `lib/server/` | Supabase 주소 |
| `SUPABASE_PUBLISHABLE_KEY` | X | `lib/server/` | RLS가 적용되는 공개 권한 키 (`anon` 역할) |
| `SUPABASE_SECRET_KEY` | X | `lib/server/` (꼭 필요한 곳만) | RLS 우회 — 최소 사용 |
| `KMA_SERVICE_KEY` | X | `lib/server/` | 기상청 생활기상지수 |

브라우저가 Sanity·Supabase를 직접 부르지 않으므로 서버 키에 `NEXT_PUBLIC_`이 필요 없다. 바뀌면 [`../frontend/.env.example`](../frontend/.env.example)도 같은 PR에서 고친다.

Supabase 연결 기반은 publishable 키만 사용한다. `SUPABASE_SECRET_KEY`는 이 단계에서 사용하지 않는다. 실제 값은 각자의 `frontend/.env.local`과 승인된 배포 환경에만 둔다.

## 배포

| 이벤트 | Vercel |
|---|---|
| PR 열림 · 커밋 추가 | 미리보기 URL — PR에 자동으로 붙는다 |
| main 머지 (봉준표) | 프로덕션 배포 |

프로덕션 환경변수 변경은 **팀장 확인 후** 한다.
