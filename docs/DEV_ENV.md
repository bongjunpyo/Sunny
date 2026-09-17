# 개발 환경 — OS 차이와 외부 서비스

[`../AGENTS.md`](../AGENTS.md)의 위험 9번. **실제로 시간을 가장 많이 잡아먹는 것**이 여기다.

## 팀 OS

| OS | 사람 |
|---|---|
| macOS | 봉준표 · 이재원 |
| Windows | 조수희 |

---

## 1. 줄바꿈 — `.gitattributes`가 처리한다

Windows Git은 체크아웃할 때 LF를 CRLF로 바꾼다. 그러면 **한 줄도 안 고친 파일이 diff에 전체가 바뀐 것으로 뜬다.**

저장소 루트의 [`.gitattributes`](../.gitattributes)가 LF로 못 박았다. 이미 클론한 사람은 한 번 정규화한다.

```
git add --renormalize .
git status          # 바뀐 게 있으면 커밋
```

## 2. 파일 이름

### 저장소 안의 경로는 ASCII

macOS는 한글 파일명을 NFD(자모 분리)로, Windows는 NFC로 저장한다. **Git이 다른 파일로 인식**해서 한쪽에서만 파일이 사라지거나 중복된다. **폴더·파일 이름은 영문, 문서 제목과 본문은 한글.**

### 대소문자만 다른 파일을 두지 않는다

macOS·Windows는 대소문자를 구분하지 않고 Vercel(리눅스)은 구분한다. `Card.tsx`와 `card.tsx`가 로컬에선 멀쩡하고 배포에서 깨진다.

### PowerShell에서 괄호가 든 경로는 따옴표로 감싼다

Next.js는 `app/(site)/`처럼 괄호 폴더를 쓴다. PowerShell은 괄호를 식으로 해석해서 실패한다.

```powershell
cd "frontend/app/(site)"      # O
cd frontend/app/(site)        # X
```

### Windows 경로 길이

```powershell
git config --global core.longpaths true
```

## 3. Node — 24 LTS로 고정

셋의 Node 버전이 다르면 "내 PC에선 되는데"가 생긴다.

- `frontend/package.json`의 `"engines": { "node": ">=24 <25" }`
- `frontend/.npmrc`의 `engine-strict=true`

버전이 다르면 `npm ci`가 첫 줄에서 멈춘다.

```
npm error notsup Required: {"node":">=24 <25"}
```

**설치는 `npm ci`만 쓴다** (lock 파일 그대로). `npm install`은 lock을 바꿀 수 있다. 패키지 관리자는 npm 하나 — yarn·pnpm을 쓰지 않는다.

## 4. Docker는 필요 없다

기획서 스택(5-1)의 서버와 데이터는 **호스팅 서비스**다.

| 무엇 | 어디서 도나 | 로컬에 설치 |
|---|---|---|
| Next.js 화면 + 서버 API | 각자 PC `npm run dev` → 배포는 Vercel | Node만 |
| Sanity CMS | Sanity 클라우드 (Studio만 로컬 실행) | 없음 |
| Supabase PostgreSQL | Supabase 클라우드 | 없음 |
| 자외선지수 | 기상청 API (공공데이터포털) | 없음 |

**조수희 PC에는 Docker를 설치하지 않는다.** Supabase를 로컬에서 띄워 시험하고 싶으면(`supabase start`, Docker 필요) 이재원만 한다.

## 5. 환경변수

| 파일 | 커밋 | 내용 |
|---|---|---|
| `frontend/.env.example` | **O** | 키 **이름만**. 값은 비워 둔다 |
| `frontend/.env.local` | **X** | 실제 값. 각자 PC에만 |
| Vercel 프로젝트 설정 | — | 배포용 실제 값 (이재원 관리) |

- **`NEXT_PUBLIC_`이 붙은 값은 브라우저에 그대로 보인다.** 서버 전용 키(Sanity 토큰, Supabase `service_role`, 공공데이터포털 인증키)에는 절대 붙이지 않는다
- 키 목록의 원본은 [`../backend/README.md`](../backend/README.md)

### mock 모드 — 서버가 없어도 화면을 만든다

| 변수 | 값 | 없을 때 |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` \| `api` | `mock` |

아무 설정도 안 하면 mock이다. **조수희와 봉준표는 첫날 `.env.local` 없이 개발한다.** 규칙은 [`CONTRACT_API.md`](CONTRACT_API.md).

## 6. 포트

| 포트 | 무엇 |
|---|---|
| 3000 | `frontend` 개발 서버 (`/api/*` 서버 API 포함) |
| 3333 | Sanity Studio (이재원) |

`web-demo`도 3000을 쓴다. **둘을 동시에 켜지 않는다.** 겹치면 Next가 3001로 옮겨 뜬다고 알려준다.

## 7. 막혔을 때 먼저 볼 것

```
node --version              # 24 인가
git config --get core.hooksPath   # .githooks 인가
npm ci                      # lock 대로 다시 설치
```

그래도 모르겠으면 **에러 메시지 전문을 그대로** 이슈 댓글에 붙여넣는다. "안 돼요"는 도움이 안 된다.
