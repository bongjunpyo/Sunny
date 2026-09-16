# PITFALLS

## rAF 시각과 performance.now()를 섞어서 자외선 값이 958까지 폭주
- **증상**: Three.js 예제의 자외선 표시가 0~11을 넘어 114.6 → 13.9로 서서히 내려옴. 태양이 하얗게 과노출. R3F 예제는 정상.
- **원인**: `last = performance.now()`로 시작하고 `tick(now)`의 rAF 인자와 빼서 dt를 구함. 긴 로딩 직후 첫 프레임의 rAF 시각이 설정 시각보다 5.3초 과거 → dt = -5.318 → `exp(-rate*dt)`가 119배 → 8이 958로 튐. `Math.min(dt, 0.05)`는 음수를 못 막음.
- **어떻게 잡혔나**: 스크린샷에서 표시값 이상 발견 → tick에 `rawDt<0 || uv>11.5`일 때 console.warn 계측 → 첫 프레임 `rawDt=-5.3180 now=1653.4 prevLast=6971.4` 확인 → `dampUv(8,0,-5.318)` 실패 테스트로 재현.
- **다음에**: 한 루프 안에서는 시계 하나만 쓴다(performance.now() 또는 rAF 인자 중 하나). 감쇠 함수는 `dt <= 0`이면 그대로 반환. 테스트: `node --test tests/dampUv.test.ts`.

## SplitText `type: "chars"`만 쓰면 한글 단어가 중간에서 줄바꿈
- **증상**: 인용구 "이야기"가 "이 / 야기"로 갈라짐.
- **원인**: 글자마다 inline-block으로 감싸면 `word-break: keep-all`이 적용되지 않아 아무 글자 사이에서나 줄이 바뀜.
- **어떻게 잡혔나**: 스크린샷 확인.
- **다음에**: 한글은 `type: "words, chars"`로 단어 틀 안에 글자를 넣는다.

## SplitText `lines` + `::first-letter` 드롭캡 충돌
- **증상**: 첫 문단 둘째 줄이 "아래로 한"처럼 짧게 끊기고 드롭캡 주변 흐름이 깨짐.
- **원인**: 줄을 나눈 뒤 각 줄이 overflow 틀(mask)에 들어가 float가 줄 안에 갇힘.
- **다음에**: 줄 단위 애니메이션 문단에는 CSS 드롭캡을 쓰지 않거나, 드롭캡 글자를 별도 요소로 뺀다.

## 홈 폴더의 package-lock.json 때문에 Turbopack 루트 경고
- **증상**: `next dev` 시작 시 "ignored package-lock.json in /Users/bongjunpyo" 경고.
- **다음에**: `next.config.ts`에 `turbopack: { root: path.join(__dirname) }`.
