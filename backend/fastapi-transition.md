# FastAPI 전환 — 팀장 반영용 변경 제안

상태: 사용자가 팀장 합의를 확인한 [#71](https://github.com/bongjunpyo/Sunny/issues/71)의 구현에 대응하는 **제안**이다. 이 문서는 규칙·API 계약의 정본이 아니다. AI는 아래 보호 문서 원문을 수정하지 않았다.

## 팀장이 규칙 원문에 반영할 변경

| 원문 | 변경 제안 |
|---|---|
| 루트 `AGENTS.md` 프로젝트 스택 | 서버 프레임워크 `Next.js 서버 API` → `Python FastAPI`. Next.js 화면, Sanity, Supabase, 기상청, Vercel은 유지 |
| 루트 `AGENTS.md` 역할·영역 | 이재원의 서버 책임에 `backend/api/`를 추가하고 `frontend/app/api/`는 동일 출처 프록시로 설명 |
| `backend/AGENTS.md` 영역·고정 스택·개발 환경 | API 실행 위치를 `backend/api/`로 변경. TypeScript 서버 클라이언트를 Python으로 대체. 실행·환경변수 상세는 `backend/README.md`로 위임 |
| `backend/AGENTS.md` 서버 키 규칙 | Python 서버 키도 브라우저·로그에 노출하지 않음. 남는 Next 프록시에는 `import "server-only"` 유지 |
| `frontend/AGENTS.md` 앱 설명 | 화면과 업무 API는 별도 서버로 실행하고 Next API 라우트는 전달만 담당함을 명시. 화면 스택은 유지 |

팀장 반영은 이 구현의 main 머지 전에 완료해야 한다. `CODEOWNERS`는 기존 `/backend/`, `/frontend/app/api/`, `/frontend/lib/server/` 소유권이 이미 전환 파일을 포괄하므로 변경이 필요하지 않다.

## 봉준표·이재원이 같은 계약 PR에서 반영할 변경

`docs/CONTRACT_API.md` 구조의 서버 노드를 다음처럼 바꾼다. 경로·JSON·오류·권한·동의 등 업무 계약은 프레임워크 전환만으로 바꾸지 않는다.

```text
브라우저 → 화면 도메인 /api/*
         → Next 동일 출처 프록시 (업무 로직·Supabase 세션 없음)
         → FastAPI (backend/api/)
         → Sanity / Supabase 사용자 컨텍스트 + RLS / 기상청
```

- #70의 Next 인증 처리·콜백·갱신 주체를 FastAPI로 바꾸고, `@supabase/ssr` 제안은 Python 구현에 맞춰 재검토한다.
- access/refresh 쿠키의 속성·수명·갱신 경쟁·무효화, CSRF/Origin 검사, 카카오 state/PKCE와 복구 콜백 URL을 합의한다. 토큰은 JSON·localStorage로 전달하지 않는다.
- 외부 URL은 합의된 화면 원점을 사용한다. 클라이언트 제공 `Forwarded`/`X-Forwarded-*`로 인증 콜백·보안 판단을 하지 않는다.
- Supabase 익명 사용자·회원의 검증된 ID와 JWT를 요청별 클라이언트에 주입하는 방법을 합의한다. 전환 기반의 클라이언트 생성만으로 인증/RLS 검증이 완료된 것은 아니다.
- 팀장이 확정한 비회원 주문·카카오 로그인·비밀번호 재설정 범위는 유지한다. 미확정 보관 정책·상한은 기존 `TBD`/`provisional`을 유지한다.
- 인증 계약 합의 → PR #65 소유권·업로드 계약 조정 → #69 스키마/RLS 작업 순서를 유지한다. 이 전환에서 원격 DB를 변경하지 않는다.
- 추가된 `/api/health`는 프로세스 상태 확인으로 설명하고, 외부 서비스 readiness와 구분한다. 현재 `/api/docs`의 OpenAPI는 기반 라우트만 포함하며 업무 계약 정본을 대체하지 않는다.

## 배포 확인

설정·실행·환경변수의 원본은 [README.md](README.md)에 있다. PR 미리보기에서 실제 `/api/health`, 요청 쿠키·복수 `Set-Cookie`, 리다이렉트와 보호 설정을 확인한 뒤 팀장이 main에 머지한다. 이 작업에서는 배포나 운영 설정 교체를 실행하지 않는다.
