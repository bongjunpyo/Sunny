# 계약 — 화면 ↔ 서버 API ↔ Sanity · Supabase

> **상태: 미확정 (v0 틀).** 채워야 할 항목은 아래 체크리스트에 있다.
>
> 담당: 봉준표·조수희(화면) ↔ 이재원(서버·데이터). **한쪽이 임의로 바꾸지 않는다.** 바뀌면 둘이 같은 PR에서 합의한다.

## 구조

```
브라우저 (frontend 화면)
   │  fetch("/api/...")            ← frontend/lib/api.ts 만 호출한다 (화면 코드에서 fetch 직접 금지)
   ▼
Next.js 서버 API (frontend/app/api/)            이재원
   │  frontend/lib/server/ 의 서버 전용 클라이언트
   ├──▶ Sanity CMS        공개 콘텐츠: 컬렉션 · 제품 · 제작 기록 · 이미지
   ├──▶ Supabase          비공개 데이터: 주문 요청 · 선호 색상 설문 (접근 정책 적용)
   └──▶ 기상청 API         자외선지수
```

**브라우저는 Sanity·Supabase·기상청을 직접 부르지 않는다.** 전부 서버 API를 거친다. 키가 브라우저로 새지 않게 하는 구조다.

## mock 먼저

서버와 데이터가 준비되기 전에도 화면을 만든다.

| `NEXT_PUBLIC_API_MODE` | `frontend/lib/api.ts`가 하는 일 |
|---|---|
| 없음 · `mock` (기본) | `frontend/lib/mock/*.json`을 읽어 돌려준다 |
| `api` | `/api/*`를 호출한다 |

**규칙: 이 문서의 응답 예시 = `lib/mock/*.json` = 서버 API 실제 응답.** mock에서 api로 바꾸는 날 준표가 셋을 대조한다.

## 불변식

1. **서버 전용 키는 브라우저에 가지 않는다** — `NEXT_PUBLIC_` 금지, 서버 API 안에서만 읽는다
2. **Supabase `service_role` 키는 서버 API에서도 꼭 필요한 곳에만** 쓴다. 기본은 `anon` 키 + 접근 정책(RLS)
3. **주문·설문 테이블은 RLS 없이 만들지 않는다.** 주문 요청의 이름·연락처·사진은 개인정보다
4. **공개 콘텐츠의 정본은 Sanity, 주문·설문의 정본은 Supabase.** 같은 데이터를 두 곳에 두지 않는다
5. **자외선지수를 못 받아오면 오류를 숨기지 않는다** — 마지막으로 받은 값과 갱신 시각, 안내 문구를 함께 준다

## 채워야 할 것

- [ ] **제품** (Sanity) — 종류 `bracelet` \| `necklace`, 이름, 비즈 구성, 사진, 설명
- [ ] **비즈 · 광변색** — 색상: 기획서 수정본 기준 **빨강·주황·파랑·노랑·보라 5색** / 농도 저·중·고. (`web-demo/lib/bead.ts`는 3색 견본이다 — 확정 시 errata)
- [ ] **제작 기록** (Sanity) — 제목, 날짜, 단계(모델링·몰드·성형·전사·도포·조립), 사진, 본문
- [ ] **주문 요청** (Supabase) — 필드, 이용 동의 항목, RLS 정책
- [ ] **선호 색상 설문** (Supabase) — 문항, 익명 여부, RLS 정책
- [ ] **자외선지수** — `GET /api/uv` 응답 형태, 지역 기준, 캐시 주기, 실패 응답
- [ ] 공통 에러 응답 형태 — `{ error: { code, message } }` 여부
- [ ] 엔드포인트 목록과 각 응답 JSON 예시

## 엔드포인트 (초안 — 확정 전)

| 메서드 · 경로 | 용도 | 정본 |
|---|---|---|
| `GET /api/products` | 컬렉션 목록 (`?kind=bracelet\|necklace`) | Sanity |
| `GET /api/products/[slug]` | 제품 상세 | Sanity |
| `GET /api/archive` | 제작 기록 목록 | Sanity |
| `GET /api/uv` | 현재 자외선지수 | 기상청 |
| `POST /api/orders` | 커스텀 주문 요청 | Supabase |
| `POST /api/survey` | 선호 색상 설문 | Supabase |

## 변경 이력

- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
