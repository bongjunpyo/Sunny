# Git 규칙

[`../AGENTS.md`](../AGENTS.md)의 "절대 하지 말 것"을 실제 명령 수준으로 푼 문서다.

## 왜 이런 규칙이 있나

`AGENTS.md`의 위험 1·2번 — **main 직접 push와 되돌릴 수 없는 명령.** 이 팀은 Git 경험이 고르지 않고, 팀원의 AI(Codex)가 명령을 대신 실행한다. 2026-09-16에 실제로 main에 직접 push가 네 번 들어갔다 → [`PITFALLS.md`](PITFALLS.md)

## 이슈 → 브랜치 → PR → 머지

```
팀장이 이슈 작성 (담당자 · 브랜치 이름 · 수정 허용 파일)
  → 담당자가 이슈의 브랜치에서 작업
  → PR (본문 첫 줄 Closes #이슈번호)
  → 팀장만 squash merge
  → 이슈 자동 닫힘 · 원격 브랜치 자동 삭제
  → 담당자가 로컬 브랜치 정리
```

**이슈 없는 브랜치를 만들지 않는다.** 팀장 본인의 작업도 이슈를 먼저 만든다 — 작업 기록이 결과보고서의 근거가 된다.

## 브랜치

`main` 하나에 짧은 작업 브랜치를 붙였다 뗀다. **그 이상은 만들지 않는다.** develop·release 같은 장기 브랜치는 이 팀에 과하다.

### 이름

```
main                                 보호 대상. 직접 push 금지
feat/front-collection-page           기능
fix/interaction-mobile-stutter       수정
docs/contract-api-v1                 문서
test/back-uv-index-fallback          시험
chore/gitignore-vercel               잡일
```

`<종류>/<영역>-<짧은-설명>`. 영역은 `front`(봉준표) · `interaction`(조수희) · `back`(이재원). **영문 소문자와 `-`만 쓴다** — 한글 브랜치 이름은 `gh pr create`가 실패한 적이 있다.

**팀원은 브랜치 이름을 직접 짓지 않는다. 이슈에 적힌 이름을 그대로 쓴다.**

### 수명은 3일

**3일보다 오래 사는 브랜치는 자른 게 너무 큰 것이다.** 팀장에게 이슈를 쪼개 달라고 한다.

### main에서 따고 main으로 돌아간다

```
git switch main
git pull
git switch -c feat/interaction-sun-scroll
```

**브랜치에서 브랜치를 따지 않는다.** 부모 브랜치가 squash 머지되면 자식이 꼬인다.

### 오래 걸리면 merge로 따라간다

```
git switch feat/interaction-sun-scroll
git fetch origin
git merge origin/main
```

**`rebase`를 쓰지 않는다.** 머지는 팀장이 squash로 하니 main 히스토리는 어차피 깨끗해진다.

## 머지는 팀장만

**main에 들어가는 모든 변경은 봉준표가 squash merge 한다.** 대신 머지하는 사람은 두지 않는다.

| 하지 않는 것 | 누가 |
|---|---|
| GitHub 웹의 Merge 버튼 | 팀원 전원 |
| `gh pr merge` | 팀원 전원 |
| Codex·GitHub MCP 등 AI 도구의 머지 기능 | 팀원 전원 |
| `git push origin main` | 팀장 외 전원 (훅이 거부) |

## 이슈가 닫히면 브랜치도 닫는다

GitHub 설정 `delete_branch_on_merge`를 켜둔다. PR이 머지되면 **`Closes #N`으로 이슈가 닫히고 원격 브랜치가 동시에 사라진다.**

- **PR 없이 이슈를 닫는 경우**(취소 · 중복)는 팀장이 원격 브랜치를 함께 지운다
- 로컬은 각자 정리한다

```
git switch main
git pull
git branch -d feat/interaction-sun-scroll    # 머지 안 됐으면 거부된다 (안전장치)
git fetch --prune                             # 사라진 원격 추적 정리
```

`-d`는 머지되지 않은 브랜치를 거부한다. **`-D`는 쓰지 않는다** — 작업이 사라진다.

## 교차 영역 작업 — PR을 나눈다

계약([`CONTRACT_API.md`](CONTRACT_API.md))이 바뀌는 작업은 **한 브랜치에 둘이 push하지 않는다.**

```
1) docs/contract-api-products      계약 문서만. 준표·재원 둘 다 리뷰 → 머지
2) feat/back-products-api          서버 구현
3) feat/front-collection-data      화면 연결
```

**머지 순서를 PR 설명에 적는다.**

## 바이너리는 소유자 단독

이미지 · 영상 · 3D 모델(`.glb`) · 폰트는 **머지가 안 된다.** 동시에 고치면 한쪽을 통째로 버리는 수밖에 없다. 남이 고쳐야 하면 **이슈로 요청**한다.

## 쓰지 않는 명령

| 명령 | 왜 |
|---|---|
| `git push --force` / `-f` / `+refspec` | 남의 커밋이 사라진다 |
| `git reset --hard` | 커밋 안 한 작업이 통째로 날아간다 |
| `git clean -fd` / `-fdx` | 추적 안 하는 파일까지 지운다 |
| `git rebase` | 히스토리가 갈라진다 |
| `git branch -D` | 머지 안 된 브랜치가 사라진다. `-d`를 쓴다 |
| `git filter-branch` | 히스토리 전체를 다시 쓴다 |

**차단되면 우회하지 말고 팀장에게 말한다.**

## 막는 장치가 몇 겹인가

| 층 | 상태 | 막는 범위 |
|---|---|---|
| 문서 (`AGENTS.md` · 이 파일) | 있음 | 읽고 따를 때만 |
| **`.githooks/`** | **있음** | **터미널·Codex·Claude Code 어디서 실행해도 막음** (`--no-verify` 제외) |
| `.claude/settings.json` | 있음 | 봉준표의 Claude Code 안에서만 |
| Codex 설정 | 없음 | 개인 PC 설정이라 저장소가 강제할 수 없다 |
| **GitHub 서버 보호 규칙** | **없음** | 무료 요금제 비공개 저장소라 사용 불가. Pro 인증 후 켠다 |

**서버 보호가 없으므로 Merge 버튼은 막히지 않는다.** 그래서 "머지는 팀장만"은 지금은 규칙으로 지킨다. 훅은 **실수를 막는 장치**이지 작정한 우회를 막는 장치가 아니다.

### 훅 켜기

```
git config core.hooksPath .githooks
```

| 훅 | 거부하는 것 |
|---|---|
| `pre-push` | main 직접 push · force push(원격 커밋이 사라지는 push) · main 브랜치 삭제 |
| `pre-commit` | `.env*`(`.env.example` 제외) · `*.key` · `*.pem` · `*.hwp`/`*.hwpx` · `secrets/` |

force push 판정은 플래그가 아니라 **원격 커밋이 로컬의 조상인지**로 한다. `-f`, 뒤에 붙인 `--force`, `+refspec`이 전부 잡힌다.

팀장만 main push 예외를 켠다.

```
git config --local sunny.allowMainPush true     # 봉준표만
```

**다른 사람은 이 값을 켜지 않는다.** 켜는 것은 실수가 아니라 의도적 우회다.

## 되돌리고 싶을 때

| 하고 싶은 것 | 쓰는 명령 |
|---|---|
| 방금 커밋 메시지만 고치기 (push 전) | `git commit --amend` |
| 커밋은 두고 되돌리기 | `git revert <커밋>` |
| 지금 수정분만 버리기 | `git restore <파일>` |
| 잠깐 치워두기 | `git stash` → `git stash pop` |
| 실수로 main에 커밋했다 (push 전) | 훅 메시지의 안내대로 브랜치로 옮긴다 |
| 커밋 안 한 걸 날렸다 | 팀장에게. `git reflog`로 찾을 수도 있다 |

## 충돌이 났을 때

1. 당황하지 않는다. 충돌은 정상이다
2. `git status`로 어떤 파일인지 본다
3. `<<<<<<<` `=======` `>>>>>>>` 사이를 직접 고른다. **마커를 남기지 않는다**
4. 확신이 없으면 그 파일 담당자에게 묻는다
5. 다 고쳤으면 `git add` → `git commit`

## 커밋 전에 확인

```
git status              # 의도한 파일만 있나
git diff --staged       # 충돌 마커 · 디버그 코드 · 비밀정보 없나
```

## 비밀정보를 실수로 커밋했다면

**바로 팀장에게 말한다.** 혼자 지우려 하지 않는다. push 후에는 히스토리에 남아 **키를 폐기하고 새로 발급받는 것이 유일한 해결**이다.
