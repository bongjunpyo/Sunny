# 처음 온 사람

먼저 [`../AGENTS.md`](../AGENTS.md)를 읽는다. 이 문서는 그 다음이다.

## 1. 설치

| 도구 | Windows (조수희) | macOS (봉준표 · 이재원) |
|---|---|---|
| Git | git-scm.com 에서 Git for Windows | 기본 설치 또는 Homebrew |
| Node.js **24 LTS** | nodejs.org 설치 파일 | nodejs.org 설치 파일 또는 Homebrew |
| 에디터 | VS Code | VS Code |
| AI | Codex | Claude Code (봉준표) · Codex (이재원) |

확인:

```
git --version
node --version      # v24.x 가 나와야 한다
```

Node 버전이 다르면 `npm ci`가 `npm error notsup`로 멈춘다. 정상이다 — 24를 설치한다. 이유는 [`DEV_ENV.md`](DEV_ENV.md).

## 2. 받아오기

```
git clone https://github.com/bongjunpyo/Sunny.git
cd Sunny
```

Windows는 `C:\Users\<이름>\` 아래 영문 경로에 둔다. 한글·공백이 들어간 경로는 피한다.

## 3. 훅을 켠다 — 가장 먼저

**이걸 안 하면 main 직접 push가 막히지 않는다.** 클론할 때마다 한 번씩 한다.

```
git config core.hooksPath .githooks
```

확인:

```
git config --get core.hooksPath      # .githooks 가 나와야 한다
```

| 훅 | 막는 것 |
|---|---|
| `pre-push` | **main 직접 push** · force push · main 브랜치 삭제 |
| `pre-commit` | `.env*` · 키 파일 · 기획서 `.hwpx` 원본 |

막히면 **우회하지 말고 팀장에게 말한다.** 막히는 것이 정상이다.

## 4. 자기 영역 확인

| 사람 | 폴더 | 읽을 규칙 |
|---|---|---|
| 봉준표 | `frontend/` (interaction · api · lib/server 제외) | [`../frontend/AGENTS.md`](../frontend/AGENTS.md) |
| 조수희 | `frontend/components/interaction/` · `frontend/e2e/interaction/` | [`../frontend/AGENTS.md`](../frontend/AGENTS.md) + [`../frontend/components/interaction/AGENTS.md`](../frontend/components/interaction/AGENTS.md) |
| 이재원 | `backend/` · `frontend/app/api/` · `frontend/lib/server/` | [`../backend/AGENTS.md`](../backend/AGENTS.md) |

**자기 영역 밖은 수정하지 않는다.**

## 5. 교재 — web-demo

`web-demo/`에 이 사이트에서 쓸 기술 다섯 가지의 견본이 있다. 각 페이지는 **결과 화면 → 코드에서 볼 곳 → 전체 코드** 순서로 읽는다.

```
cd web-demo
npm ci
npm run dev          # http://localhost:3000
```

| 페이지 | 기술 | 특히 읽을 사람 |
|---|---|---|
| `/typescript` | 데이터의 모양(타입) | 전원 |
| `/scrolltrigger` | GSAP 스크롤 연출 | **조수희** |
| `/splittext` | 글자·단어 단위 애니메이션 | **조수희** |
| `/three` | 셰이더 태양 + 팔찌 (순수 Three.js) | 조수희 · 봉준표 |
| `/r3f` | 같은 장면을 React 방식으로 | 조수희 · 봉준표 |

**`web-demo/`는 수정하지 않는다.** 실험은 자기 브랜치의 자기 영역에서 한다.

## 6. 첫 이슈와 첫 PR — 흐름을 한 번 돌려본다

내용은 사소하다. **목적은 이슈 → 브랜치 → PR → 머지를 몸에 익히는 것**이다.

1. 팀장이 이슈 **"온보딩: 담당 폴더 README에 이름 추가"**를 올리고 담당자로 지정한다
2. 이슈에 적힌 브랜치로 작업한다

```
git switch main
git pull
git switch -c <이슈에 적힌 브랜치 이름>
# 자기 영역 README.md 의 "담당" 줄에 이름을 확인·추가한다
git add <자기 영역>/README.md
git commit -m "docs(<영역>): 담당자 이름 확인"
git push -u origin <이슈에 적힌 브랜치 이름>
```

3. GitHub 웹에서 PR을 연다. **첫 줄 `Closes #이슈번호`**, 양식을 채운다
4. 팀장이 리뷰·머지하고, 이슈가 닫히고 브랜치가 지워지는 것까지 본다
5. 로컬을 정리한다

```
git switch main
git pull
git branch -d <브랜치 이름>
```

**이걸 하기 전에 실제 작업을 시작하지 않는다.**

## 7. Codex에게 이렇게 말한다 (조수희 · 이재원)

Codex는 **실행한 폴더까지의 `AGENTS.md`만 자동으로 읽는다.** 그래서 첫 문장에서 규칙 파일을 직접 가리킨다.

### 작업 시작

```
이슈 #__ 작업을 시작할 거야.
AGENTS.md와 <내 영역 AGENTS.md 경로>를 먼저 읽고 규칙을 따라줘.
이슈 본문을 읽고, 브랜치 이름과 수정 허용 파일을 확인한 뒤 계획부터 3줄로 보여줘.
```

### 이슈 만들기 (이재원 — `back` 영역만)

```
AGENTS.md와 backend/AGENTS.md를 먼저 읽고 규칙을 따라줘.
<무엇을 만들지 한두 문장> 작업의 이슈 초안을 .github/ISSUE_TEMPLATE/task.md 양식으로 써줘.
브랜치 이름은 <종류>/back-<설명>, 수정 허용 파일은 backend/ · frontend/app/api/ · frontend/lib/server/ 안에서만.
계약(docs/CONTRACT_API.md)이 바뀌면 알려줘. 초안을 내가 확인한 뒤에
gh issue create --assignee leejaewon23 --label back 으로 올려줘. 머지는 하지 마.
```

### 에러가 났을 때

```
아래 에러가 났어. 원인을 먼저 설명하고, 고치기 전에 어떻게 고칠지 말해줘.

[에러 메시지 전체를 그대로 붙여넣기 — 줄이지 말 것]
```

### 코드 설명 요청

```
<파일 경로>를 한 줄씩 설명해줘.
PR에서 받을 만한 질문 3개와 내가 답할 수 있게 핵심을 정리해줘.
```

### 대화가 길어져서 같은 실수를 반복할 때

새 대화를 열고:

```
AGENTS.md와 <내 영역 AGENTS.md 경로>를 따라줘.
이슈 #__ 작업 중이고, ______까지 됐고 ______가 안 돼.
마지막 에러: [붙여넣기]
원인 후보를 2~3개 적고 가장 유력한 것부터 하나씩 확인해줘.
```

### 하지 말 것

| 나쁜 요청 | 왜 | 이렇게 |
|---|---|---|
| "알아서 해줘" | AI가 범위를 넓힌다 | 이슈 번호와 완료 기준을 말한다 |
| "main에 올려줘" / "머지해줘" | 규칙 위반. 훅이 막는다 | "이슈 브랜치에 push하고 PR 본문 초안을 써줘" |
| 에러를 요약해서 전달 | 정보가 빠져 엉뚱한 진단 | 에러 전문을 그대로 |
| 막혔는데 계속 "다시 해봐" | 같은 실수를 반복 | 새 대화 + 위 재시작 문장 |

## 8. 막혔을 때

- **30분 이상 같은 문제**면 이슈에 댓글로 남긴다 — ① 보낸 요청 ② 에러 전문 ③ AI의 마지막 답변
- 규칙이 이해되지 않으면 → `AGENTS.md`의 "사고가 날 수 있는 경로" 표에서 대응 위험을 본다
- 다른 영역이 필요하면 → 이슈 댓글로 요청한다. 직접 고치지 않는다
