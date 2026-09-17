# 헬로 썬라이즈 — 협업 헌법 (AGENTS.md)

## 이 문서의 위치

이 파일은 **이 저장소에 참여하는 모든 사람과 모든 AI**가 따르는 협업 헌법이다.

- **Codex**(이재원·조수희)는 `AGENTS.md`를 읽는다. **Claude Code**(봉준표)는 `CLAUDE.md`를 읽는데, `CLAUDE.md`는 이 파일을 불러오기만 한다. **규칙의 원본은 `AGENTS.md` 하나다.**
- 개인 전역 설정(`~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`)보다 이 파일이 우선한다.
- **Codex는 실행한 폴더까지의 `AGENTS.md`만 자동으로 읽는다.** 그래서 AI는 작업 전에 대상 영역의 `AGENTS.md`를 **직접 열어서** 읽는다 → 아래 "영역 규칙 파일".
- 상세는 [`docs/`](docs/)로 위임한다.
- **AI는 이 파일, 영역 `AGENTS.md`, `docs/` 규칙 문서를 스스로 고치지 않는다.** 제안만 하고 반영은 팀장이 한다.

## 프로젝트 개요

- 과제명: **빛이 남기는 색** — 광변색 소재를 활용한 비즈 팔찌·목걸이 디자인
- 과목: 2026학년도 2학기 창업캡스톤디자인2 · 명지전문대학 · 팀 헬로 썬라이즈 · 담당교수 정필성
- 이 저장소가 만드는 것: 브랜드 패션 아카이브 웹사이트 — 브랜드 스토리 · 컬렉션 · 실내/햇빛 발색 비교 · 커스텀 · 제작 기록
- 스택 (기획서 5-1 기준, 임의 변경 금지)
  - 화면: Next.js App Router · React · TypeScript · GSAP ScrollTrigger/SplitText · Three.js/React Three Fiber
  - 서버·데이터: Next.js 서버 API · Sanity CMS · Supabase PostgreSQL · 기상청 생활기상지수(자외선지수) API
  - 배포: Vercel

한 문장 — **빛에 따라 드러나는 개인의 기록.**

## 우리 팀에서 사고가 날 수 있는 경로

규칙은 이 목록에서 역추적해 만들었다. 규칙이 이해되지 않으면 대응하는 위험을 먼저 본다.

| # | 위험 | 막는 규칙 |
|---|------|----------|
| 1 | **AI나 초보가 main에 직접 push** — 2026-09-16 실제 발생 | **[`.githooks/`](.githooks/)가 거부** + 머지는 팀장만 + [`docs/GIT_RULES.md`](docs/GIT_RULES.md) · [`docs/PITFALLS.md`](docs/PITFALLS.md) |
| 2 | `force push`·`reset --hard`로 작업 소실 | `.githooks/pre-push` + 아래 "절대 하지 말 것" |
| 3 | 이슈 없이 시작한 작업이 범위를 넘음 | **팀원 작업은 이슈로만 요청하고 이슈로만 시작한다** → [`docs/ISSUE_GUIDE.md`](docs/ISSUE_GUIDE.md) |
| 4 | 남의 영역을 잘못 건드림 | 영역 `AGENTS.md` "하지 말 것" + [`.github/CODEOWNERS`](.github/CODEOWNERS) |
| 5 | 팀원마다 AI 도구가 다름 (Codex 2 · Claude Code 1) | 규칙 원본은 `AGENTS.md` 하나. `CLAUDE.md`는 불러오기만 |
| 6 | 계약 없이 병렬 작업 → 서로 기다림 | [`docs/CONTRACT_API.md`](docs/CONTRACT_API.md) + mock 데이터로 먼저 개발 |
| 7 | 비밀 키·개인정보(주문·설문·고객 사진) 커밋·노출 | `.gitignore` + `.githooks/pre-commit` + **서버 키는 서버에서만** |
| 8 | 3D·스크롤 연출이 무거워 모바일에서 멈춤 | 정적 대체 화면 + `prefers-reduced-motion` 지원 (기획서 5-1) → [`frontend/AGENTS.md`](frontend/AGENTS.md) |
| 9 | **OS가 갈림** (Windows 1 · macOS 2) | [`.gitattributes`](.gitattributes) + [`docs/DEV_ENV.md`](docs/DEV_ENV.md) |
| 10 | 문서끼리 내용이 어긋남 | **단일 진실 원천** + errata (아래) |

## 역할 분담 (기획서 5-2)

| 사람 | GitHub | AI | 영역 | 책임 |
|------|--------|----|------|------|
| **봉준표** (팀장) | `bongjunpyo` | Claude Code | `frontend/` 공통 · 페이지 · 3D 뼈대 | 정보구조·Figma, 브랜드 소개·컬렉션·제작 기록 페이지, WebGL 핵심(태양 셰이더·씬 구조·보드 좌표), **이슈 작성 · 리뷰 · main 머지(단독)** |
| **조수희** | `whtngml18` | Codex | `frontend/components/interaction/` | GSAP 스크롤 연출, 실내·햇빛 발색 비교 콘텐츠, 씬 파라미터 조정. **팀장이 올린 이슈로만 작업** |
| **이재원** | `leejaewon23` | Codex | `backend/` + `frontend/app/api/` + `frontend/lib/server/` | Next.js 서버 API, Sanity CMS, Supabase, 자외선지수 API, 환경변수, Vercel 배포 |

**3D는 순서가 있다.** 준표가 `frontend/components/scene/`에 WebGL 뼈대를 먼저 세우고, 수희는 그 공개 부품 위에 스크롤 연출과 파라미터를 얹는다.

제품 담당(나선우·박경찬·문예은)은 이 저장소에 코드를 올리지 않는다. 웹에 필요한 사진·영상·발색 기록은 **이슈로 요청**하고 받는다.

| OS | 사람 |
|---|---|
| macOS | 봉준표 · 이재원 |
| Windows | 조수희 |

저장소 안의 폴더·파일 이름은 **ASCII**로 쓴다(한글은 macOS와 Windows에서 다른 파일로 인식된다). 줄바꿈은 `.gitattributes`가 LF로 통일한다. → [`docs/DEV_ENV.md`](docs/DEV_ENV.md)

**자기 영역 밖은 수정하지 않는다.** 다른 영역에 영향이 필요하면 이슈나 PR 코멘트로 요청한다.

## 영역 규칙 파일 — 작업 전에 반드시 직접 읽는다

| 작업 대상 | 읽을 파일 |
|---|---|
| `frontend/` 전반 | [`frontend/AGENTS.md`](frontend/AGENTS.md) |
| `frontend/components/interaction/` (조수희) | 위 파일 **+** [`frontend/components/interaction/AGENTS.md`](frontend/components/interaction/AGENTS.md) |
| `backend/`, `frontend/app/api/`, `frontend/lib/server/` (이재원) | [`backend/AGENTS.md`](backend/AGENTS.md) |
| `web-demo/` | **동결된 학습 교재. 수정하지 않는다** |

## 계약 먼저

화면과 서버가 동시에 움직일 수 있는 이유는 계약이 먼저 고정되기 때문이다. **코드보다 먼저 문서로 확정한다.**

| 계약 | 사이 | 위치 |
|------|------|------|
| 화면 ↔ 서버 API ↔ Sanity·Supabase | 봉준표·조수희 ↔ 이재원 | [`docs/CONTRACT_API.md`](docs/CONTRACT_API.md) |

계약이 바뀌면 **준표와 재원이 같은 PR에서 합의**한다. 확정 전에는 화면 쪽이 `frontend/lib/mock/`의 가짜 데이터로 개발한다.

## 작업 흐름

1. **팀장이 이슈를 올린다.** 담당자·브랜치 이름·수정 허용 파일을 이슈에 적는다 → [`docs/ISSUE_GUIDE.md`](docs/ISSUE_GUIDE.md)
2. 담당자는 **이슈에 적힌 브랜치 이름 그대로** main에서 브랜치를 딴다
3. 작게 작업하고 PR을 연다. **PR 본문 첫 줄은 `Closes #이슈번호`**
4. **팀장만 squash merge 한다.** 팀원은 GitHub 웹의 Merge 버튼, `gh pr merge`, AI 도구의 머지 기능을 쓰지 않는다
5. 머지되면 이슈가 자동으로 닫히고 **원격 브랜치가 자동으로 삭제**된다. PR 없이 닫는 이슈는 팀장이 브랜치를 함께 지운다
6. 담당자는 로컬 브랜치를 정리한다 — `git switch main` → `git pull` → `git branch -d <브랜치>`

브랜치 이름은 `<종류>/<영역>-<짧은-설명>`, 영문 소문자와 `-`만 쓴다.

```
feat/front-collection-page       봉준표 — 페이지·공통·3D 뼈대
feat/interaction-sun-scroll      조수희 — 스크롤 연출·발색 비교
feat/back-uv-index-api           이재원 — 서버 API·CMS·DB·배포
docs/contract-api-v1             계약·문서
chore/gitignore-vercel           잡일
```

**브랜치 수명은 3일이다.** 오래 걸리면 `git merge origin/main`으로 따라간다. **rebase는 쓰지 않는다.** 상세는 [`docs/GIT_RULES.md`](docs/GIT_RULES.md), PR은 [`docs/PR_GUIDE.md`](docs/PR_GUIDE.md).

## 절대 하지 말 것

1. **main에 직접 commit·push** — `pre-push` 훅이 거부한다. 팀장만 예외
2. **PR 머지** — 팀장(봉준표)만 한다. Merge 버튼 · `gh pr merge` · AI 도구의 머지 기능 전부 금지
3. **`git push --force` · `git reset --hard` · `git branch -D` · `git clean -fd`** — 되돌릴 수 없다. 필요하면 팀장에게
4. **이슈 없이 작업 시작** (팀원) — 이슈가 없으면 멈추고 팀장에게 이슈를 요청한다
5. **남의 영역 수정** — 이슈나 PR 코멘트로 요청한다
6. **비밀정보 커밋·노출** — `.env*`, Sanity 토큰, Supabase `service_role` 키, 공공데이터포털 인증키. **서버 전용 키에 `NEXT_PUBLIC_`을 붙이지 않는다** (붙이면 브라우저에 그대로 노출된다)
7. **개인정보 커밋** — 주문·설문 응답, 고객 사진·문구, 학번·연락처(기획서 `.hwpx` 원본 포함)
8. **거버넌스 문서를 AI가 자동 수정** — `AGENTS.md`, `CLAUDE.md`, `docs/` 규칙 문서, `CODEOWNERS`는 제안만
9. **라이브러리 임의 추가** — 이슈로 먼저 제안한다
10. **`web-demo/` 수정** — 동결된 교재다

## 단일 진실 원천과 errata

같은 사실을 두 문서에 쓰지 않는다. 한 곳에 쓰고 나머지는 **링크로 위임**한다.

| 사실 | 원천 |
|------|------|
| 페이지 목록 · `frontend/` 폴더 담당 | [`frontend/README.md`](frontend/README.md) |
| 인터랙션 작업 범위 | [`frontend/components/interaction/README.md`](frontend/components/interaction/README.md) |
| API · 데이터 스키마 | [`docs/CONTRACT_API.md`](docs/CONTRACT_API.md) |
| 외부 서비스 · 배포 · 환경변수 이름 | [`backend/README.md`](backend/README.md) |
| 브랜치 · 머지 규칙 | [`docs/GIT_RULES.md`](docs/GIT_RULES.md) |
| 설계 결정의 근거 | [`docs/superpowers/specs/`](docs/superpowers/specs/) |

**문서와 다르게 만들었으면 코드로 우회하지 말고 문서를 먼저 고친다.** 커밋 메시지에 `docs: errata — <무엇이 왜 달라졌는지>`로 남긴다.

## 커밋 메시지

```
feat(front): 컬렉션 페이지 목록 추가
feat(interaction): 태양 스크롤 진입 연출
feat(back): 자외선지수 API 중계
fix(interaction): 모바일에서 스크롤 연출 끊김
docs: errata — 광변색 색상을 3색에서 5색으로 정정
chore: gitignore에 Vercel 폴더 추가
```

영역을 괄호에 넣는다(`front` · `interaction` · `back`). 전체에 걸치면 생략한다. 메시지는 한국어로 쓴다.

## 처음 온 사람

**클론하고 가장 먼저 훅을 켠다.** 이걸 안 하면 main 직접 push가 막히지 않는다.

```
git config core.hooksPath .githooks
```

그 다음 [`docs/ONBOARDING.md`](docs/ONBOARDING.md)를 따라간다.

## 브랜드 원칙

기획서에 근거한 것이고 **화면 문구와 코드가 이를 어기면 안 된다.**

- 광변색은 **"햇빛(자외선)에 반응해 색이 변한다"까지만** 말한다. 자외선 차단·건강 효과를 주장하지 않는다
- 발색 강도·복색 시간은 **시험 조건(농도·노출 시간·날씨)과 함께** 적는다
- 고객 사진·문구는 **이용 동의를 받은 것만** 쓴다 (기획서 6. 포트폴리오·권리 관리)
- 타 브랜드 이미지(리서치 캡처)는 쓰지 않는다. **AI로 만든 영상·이미지는 AI 생성물이라고 기록한다** (공모전 AI 기여도 확인 항목)
- 자외선지수는 기상청 데이터다. 받아오지 못하면 **최근 갱신 시각과 안내 문구**를 보여준다
