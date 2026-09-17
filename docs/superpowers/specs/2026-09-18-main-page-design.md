# 메인 페이지 설계 (2026-09-18)

기준 시안은 [`docs/design/brand-preview.html`](../../design/brand-preview.html)이다. **시안과 이 문서가 다르면 시안이 맞다.** 참고 문서 [`docs/design/prompts/claude-code-brand-v2.md`](../../design/prompts/claude-code-brand-v2.md)와 다르면 시안과 이 문서가 우선한다.

## 무엇을 만드나

한 페이지(`/`)에서 스크롤만으로 이어지는 브랜드 도입부다. 라우트 이동이 없다.

| 순서 | 구간 | 내용 |
|---|---|---|
| 1 | Hero | 검은 화면, 오른쪽의 태양이 중앙으로 와서 정면으로 확대된다. 문구 `Wear the light.` |
| 2 | 전환 | 종이색(`--paper`)이 덮이고 `멀리 있는 빛을, 가까이 지니는 일.`이 뜬다 |
| 3 | 01 Our Story | 빛과 감각. 왼쪽 문장 + 오른쪽 빛 연구 이미지 |
| 4 | 02 Collections | Bracelets · Necklaces 두 장. **판매 중 상품·가격을 지어내지 않는다** |
| 5 | Manifesto | 어두운 띠. `더 빛나기보다, 나의 빛에 가까이.` |
| 6 | 03 Solar Journal | 실제 관측 이미지 1장과 출처. 감성 연출과 구분한다 |
| 7 | Footer | 워드마크 · 링크 · 시안 표기 |

## 정해진 값

### 디자인 토큰 — `app/globals.css`

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--paper` | `#eeeae2` | 브랜드 배경 |
| `--paper-2` | `#f3f0e9` | 쇼핑 화면 배경 (`pages-prototype.html`) |
| `--ink` | `#242420` | 본문 |
| `--muted` | `#65645d` | 보조 문장 |
| `--line` | `#cbc7bf` | 구분선 |
| `--night` | `#090a09` | 히어로 배경 |
| `--gold` | `#d7af76` | 진행 표시 · 강조 |
| `--amber` | `#b47e40` | 포커스 링 |

글꼴은 시스템 글꼴(`Arial, 'Apple SD Gothic Neo', 'Malgun Gothic'`)을 쓴다. 웹폰트는 라이선스와 성능을 확인한 뒤 별도 이슈로 정한다.

### 스크롤 구간 — `heroProgress` 하나만 쓴다

`p` = 히어로 구간 스크롤 진행률 0~1. 시안 코드의 값을 그대로 옮긴다.

| p | 일어나는 일 |
|---|---|
| 0 → .38 | 태양 중심이 가로 78%(모바일 92%)에서 50%로 이동 |
| .12 → .32 | 히어로 문구가 사라진다 (.34에서 숨김) |
| .32 → .82 | 태양이 정면으로 확대된다 (배율 1 → 7, 제곱 가속). **회전·궤도 이동 없음** |
| .66 → .89 | 종이색이 덮인다 (한 번의 부드러운 전환) |
| .85 → .95 | 도착 문구가 나타난다 |

히어로 길이: PC `255svh`, 모바일(≤700px) `195svh`. 스크롤 컨테이너에 `overflow-anchor: none`을 준다 — 없으면 sticky 구간에서 스크롤이 되돌아간다.

`prefers-reduced-motion: reduce`이면 태양을 오른쪽에 둔 정지 화면으로 보여주고 문구는 모두 보이게 한다. 화면에 모션을 끄는 버튼도 둔다.

### 태양 — 나중에 Higgsfield 영상으로 바꾼다

태양은 `components/scene/`의 부품 하나로 감싸고, 바깥 화면 코드는 **위치·배율만** 넘긴다.

| 단계 | 태양의 정체 | 상태 |
|---|---|---|
| 지금 | 시안의 SVG 원반 (`feTurbulence` 질감) | 이번 이슈 |
| 다음 | Higgsfield 고정 카메라 영상 + 포스터 이미지 | API 구매 후 |
| 필요하면 | R3F 셰이더 (`web-demo/lib/sunShader.ts` 계열) | 별도 이슈 |

영상으로 바꿔도 바깥 코드가 바뀌지 않도록 부품의 입력을 고정한다 — `progress`(0~1), `reduced`(불리언). 영상은 `muted` · `playsInline` · `poster` · 화면 밖 일시정지 · 자동재생 거부 시 포스터 유지. **AI로 만든 태양은 생성물이라고 표기하고, 관측 자료 자리에는 넣지 않는다.**

### 데이터

이번 단계에서 화면은 `lib/api.ts`만 부른다. `NEXT_PUBLIC_API_MODE`가 없거나 `mock`이면 `lib/mock/*.json`을 읽는다 → [`docs/CONTRACT_API.md`](../../CONTRACT_API.md)

Solar Journal의 관측 이미지는 서버 API가 생기기 전까지 **불러오지 못한 상태**를 그대로 보여준다. 가짜 태양 이미지를 관측 자리에 넣지 않는다. 관측 시각을 확인할 수 없으면 `observedAt`은 `null`이고, 수집 시각을 관측 시각으로 쓰지 않는다.

## 이번 범위가 아닌 것

- Editorial(착용 화보) 구간 — 제품 사진이 없다. 촬영 후 별도 이슈
- 실내/햇빛 발색 비교, 자외선지수, 설문 — 계약에는 남아 있고 다른 페이지에서 다룬다
- 쇼핑 화면(`pages-prototype.html`) — 메인이 끝난 뒤 순서대로

## 만드는 순서 — 이슈 단위

| 순서 | 이슈 | 브랜치 | 담당 |
|---|---|---|---|
| 1 | 앱 뼈대 · 토큰 · mock · 테스트 | `feat/front-app-skeleton` | 봉준표 |
| 2 | 메인 정적 화면 (모션 없음) | `feat/front-main-static` | 봉준표 |
| 3 | 태양 부품 + 히어로 스크롤 연출 | `feat/interaction-hero-scroll` | 조수희 (부품 규격은 1·2에서 확정) |
| 4 | 관측 API 연결 | `feat/back-solar-latest` | 이재원 (계약 합의 후) |
| 5 | Higgsfield 영상 교체 | 미정 | 봉준표 (API 구매 후) |

## 확인 기준

- `npm run build` · `node --test` · Playwright 스모크가 통과한다
- 모션을 꺼도 브랜드 페이지로 읽힌다
- 360 · 390 · 768 · 1440 너비에서 가로 스크롤이 생기지 않는다
- 키보드로 "컬렉션으로 바로 가기"에 닿을 수 있고 포커스가 보인다
- 서버 전용 키에 `NEXT_PUBLIC_`을 붙이지 않는다
