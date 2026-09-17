# frontend — 영역 규칙

**먼저 [`../AGENTS.md`](../AGENTS.md)를 읽으십시오.**

## 이 영역이 맡는 것

Next.js 앱 전체 — 페이지, 공통 부품, 3D 씬, 스크롤 연출, 그리고 같은 앱 안의 서버 API.

**한 앱을 세 사람이 나눠 쓴다.** 폴더별 담당은 [`README.md`](README.md)의 "폴더와 담당" 표가 원본이다. **작업 전에 그 표에서 내 폴더를 확인한다.** 서버 쪽(`app/api/`, `lib/server/`)을 만지면 [`../backend/AGENTS.md`](../backend/AGENTS.md)도 따른다. 조수희의 `components/interaction/`은 [그 폴더의 `AGENTS.md`](components/interaction/AGENTS.md)가 추가로 적용된다.

## 스택 (고정 — 다른 프레임워크·라이브러리 제안 금지)

| | |
|---|---|
| 프레임워크 | Next.js 16 App Router · React 19 · TypeScript |
| 모션 | GSAP · `@gsap/react` (ScrollTrigger · SplitText) |
| 3D | three · `@react-three/fiber` · `@react-three/drei` |
| 스타일 | CSS Modules + 디자인 토큰 CSS 변수 |
| 테스트 | `node --test` (로직) · Playwright (페이지) |
| 런타임 | Node 24 LTS · npm |

버전은 `web-demo/package.json`과 맞춘다.

**Next.js 16은 AI의 학습 데이터와 API가 다르다.** 코드를 쓰기 전에 `frontend/node_modules/next/dist/docs/`에서 해당 가이드를 확인한다.

## 개발 환경

> **앱 뼈대는 아직 없다.** 첫 뼈대 이슈에서 봉준표가 만든다. 그 전에는 `web-demo/`로 공부한다.

뼈대가 생긴 뒤:

```
cd frontend
npm ci                  # lock 대로 설치 (npm install 쓰지 않음)
npm run dev             # http://localhost:3000
npm run build           # 타입 검사 + 빌드
npm test                # node --test  (tests/**/*.test.ts)
npx playwright test     # 페이지 스모크 테스트 (mock 모드 고정)
```

환경변수는 `.env.example`을 `.env.local`로 복사한다. **아무것도 안 넣으면 mock 모드**라서 서버·CMS 없이 화면이 뜬다 → [`../docs/CONTRACT_API.md`](../docs/CONTRACT_API.md)

## 코드 규칙

1. **데이터는 `lib/api.ts`의 함수로만 가져온다.** 화면 코드에서 `fetch`를 직접 쓰지 않는다
2. **화면 코드에서 `lib/server/`를 import하지 않는다.** 서버 전용 파일은 맨 위에 `import "server-only"`를 둔다
3. **스타일은 `*.module.css`와 `var(--토큰)`으로만.** 색·글꼴·간격 값을 직접 쓰지 않는다. 토큰은 `app/globals.css`에 있다
4. **`"use client"`는 상태·이벤트·WebGL·GSAP이 필요한 파일에만** 붙인다
5. **3D는 `components/scene/`의 공개 부품으로만 쓴다.** 셰이더(GLSL)·씬 구조·보드 좌표를 바꾸는 것은 봉준표 담당이다
6. **모션 접근성** — `prefers-reduced-motion: reduce`면 움직임 없는 정적 화면을, WebGL을 못 쓰는 기기면 정적 이미지를 보여준다 (기획서 5-1)
7. **애니메이션 루프 안에서는 시계를 하나만** 쓴다 — `performance.now()`와 rAF 시각을 섞으면 값이 폭주한다 ([`../web-demo/docs/PITFALLS.md`](../web-demo/docs/PITFALLS.md))
8. **매 프레임 React 상태를 바꾸지 않는다.** 프레임마다 바뀌는 값은 `ref`에 둔다
9. 한글에 SplitText를 쓸 때는 `type: "words, chars"` — 글자만 쪼개면 단어 중간에서 줄이 바뀐다

## 테스트

- **로직** — `tests/**/*.test.ts`를 `node --test`로 돌린다. 설치 없이 Node 24가 TS를 바로 실행한다
  - 테스트 파일은 `../lib/xxx.ts`처럼 **확장자를 붙여** import한다. 그래서 `tsconfig.json`의 `exclude`에 `tests`를 넣는다
  - `node --test`가 직접 부르는 `lib/` 파일은 `@/` 별칭을 쓰지 않는다 (Node는 tsconfig 별칭을 모른다)
- **페이지** — `e2e/**/*.spec.ts`를 Playwright로 돌린다. `webServer`가 mock 모드로 `npm run dev`를 띄운다
  - 스크린샷은 `e2e/shots/`(커밋하지 않음). PR에 첨부한다
  - WebGL 씬은 **페이지가 열리는지만** 검사한다

## 절대 하지 말 것

1. **담당이 아닌 폴더 수정** — README의 표를 본다. 필요하면 이슈 댓글로 요청한다
2. **서버 전용 키에 `NEXT_PUBLIC_`** 붙이기 — 브라우저에 그대로 노출된다
3. **라이브러리 임의 설치** — 이슈로 제안한다. `package.json`과 `package-lock.json`은 같은 커밋에 넣는다
4. **`web-demo/` 수정** — 동결된 교재다. 필요한 코드는 복사해 와서 자기 폴더에서 고친다
5. **main commit·push · PR 머지** — 머지는 봉준표만 한다

## 혼자 검증하는 법

**mock 모드로 화면을 끝까지 완성한다.** 서버 API·Sanity·Supabase를 기다리지 않는다. Playwright 스모크 테스트가 통과하고 스크린샷이 의도와 같으면 PR을 연다.
