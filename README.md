# 빛이 남기는 색

**광변색 소재를 활용한 비즈 팔찌·목걸이 브랜드 — 패션 아카이브 웹사이트**

2026학년도 2학기 창업캡스톤디자인2 · 명지전문대학 · 팀 헬로 썬라이즈 · 담당교수 정필성

---

## 무엇을 만드는가

실내에서는 흰색, 햇빛 아래에서는 고른 색으로 변하는 비즈를 한 줄로 엮은 팔찌와 목걸이. 비즈의 평평한 정면에는 사진이나 문구를 담는다.

이 저장소는 그 브랜드의 웹사이트다. 브랜드 스토리 · 컬렉션 · 실내/햇빛 발색 비교 · 커스텀 · 제작 기록을 담는다.

> **빛에 따라 드러나는 개인의 기록.**

## 저장소 구조

| 폴더 | 영역 | 담당 |
|---|---|---|
| [`frontend/`](frontend/) | 화면 — Next.js · GSAP · React Three Fiber | 봉준표 (팀장) |
| [`frontend/components/interaction/`](frontend/components/interaction/) | 스크롤 연출 · 발색 비교 · 씬 파라미터 | 조수희 |
| [`backend/`](backend/) · `frontend/app/api/` · `frontend/lib/server/` | 서버 API · Sanity CMS · Supabase · 배포 | 이재원 |
| [`docs/`](docs/) | 사람·AI 공용 규칙과 계약 | 봉준표 |
| [`web-demo/`](web-demo/) | 기술 견본 (학습 교재, 동결) | 봉준표 |

## 시작하기

1. **[`AGENTS.md`](AGENTS.md)를 먼저 읽는다.** 사람과 AI 모두가 따르는 협업 헌법이다 (Claude Code는 `CLAUDE.md`를 통해 같은 파일을 읽는다)
2. 훅을 켠다 — `git config core.hooksPath .githooks`
3. [`docs/ONBOARDING.md`](docs/ONBOARDING.md)를 따라 첫 이슈와 첫 PR을 한 번 돌려본다
4. 자기 영역 폴더의 `AGENTS.md`와 `README.md`를 읽는다

## 작업 방식 한눈에

```
팀장이 이슈 작성 → 담당자가 이슈의 브랜치에서 작업 → PR (Closes #이슈)
→ 팀장만 squash merge → 이슈 자동 닫힘 · 브랜치 자동 삭제
```

main에는 아무도 직접 올리지 않는다. 머지는 팀장(봉준표)만 한다.

## 일정 (기획서 7. 추진일정)

```
8주차    중간 발표회
12주차   웹사이트 정보구조 · 와이어프레임 · Figma 프로토타입
13주차   Next.js 웹 UI 구현 · CMS · 데이터베이스 · 자외선지수 API 연동
14주차   반응형 · 접근성 · 성능 테스트 · 제출 자료 정리
15주차   기말 발표회 · 웹사이트 시연
```
