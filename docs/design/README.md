# design — 디자인 기준 시안

화면을 만들 때 **이 폴더의 HTML 시안이 기준**이다. 프롬프트 문서와 내용이 다르면 HTML 시안이 맞다.

브라우저로 파일을 직접 열어 본다. 시안의 상품 · 금액 · 주문 · 로그인은 전부 **예시**이고 서버와 연결되지 않는다.

## 파일

| 파일 | 무엇 | 상태 |
|---|---|---|
| [`brand-preview.html`](brand-preview.html) | 메인 · 브랜드 — 히어로 태양(측면 → 중앙 → 확대) → Our Story · Collections · Manifesto · Solar Journal | **기준** |
| [`pages-prototype.html`](pages-prototype.html) | 전체 화면 흐름 — 컬렉션 · 상품 상세 · 장바구니 · 주문 · 마이페이지 · 로그인 · 리뷰 · Q&A · 문의 · Our stories · Solar journal · 관리자. 화면과 API 연결표는 `#map` | **기준** |
| [`stories-wearing-light.html`](stories-wearing-light.html) | Our stories 카드 커버 — 빛을 입는 기록 | **기준** |
| [`stories-yunseul-options.html`](stories-yunseul-options.html) | Our stories 레이아웃 A / B / C 비교 | 기록 — A 선택 |
| [`main-hero-candidates.html`](main-hero-candidates.html) | 이전 메인 히어로 후보 | 기록 — `prompts/claude-code-brand-v2.md`가 A안을 참조 |
| [`prompts/claude-code-brand-v2.md`](prompts/claude-code-brand-v2.md) | 구현 단계 · 스크롤 구간 · NASA 관측 표시 규칙 | 참고 |
| [`prompts/higgsfield-brand-v2.md`](prompts/higgsfield-brand-v2.md) | 태양 원반 · 표면 영상 소스 프롬프트 | 참고 — Higgsfield API 구매 후 사용 |

## 확정된 결정 — 2026-09-17 봉준표

- **테마는 "빛을 입다".** Our stories는 기록마다 다른 대상이 빛을 입는 방식을 담는다
- 첫 기록은 **바다가 빛을 입다 — 윤슬**이다. 윤슬은 테마가 아니라 스토리 하나다. 새 스토리는 준표가 정한다
- Our stories 레이아웃은 **카드 커버(A안)** 로 한다
- 상품 커스텀 옵션에서 **각인 문구를 삭제**한다 → 옵션은 반응색 · 길이 · 비즈 배열 · 사진
- 코드로 그린 태양 · 윤슬은 분위기 시안이다. 실제 촬영이나 AI 생성물로 바꾸고, **AI 생성물은 생성물이라고 표기**한다
- API 범위와 응답 형태는 이 폴더가 아니라 [`../CONTRACT_API.md`](../CONTRACT_API.md)에서 합의한다
