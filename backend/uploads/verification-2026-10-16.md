# 실제 R2 업로드 검증 — 2026-10-16 / #93 · PR #94

브랜치: feat/back-r2-photo-upload. 실행 환경: Node 24 · Next development localhost:3000 ·
기존 Docker sunny PostgreSQL · 담당자가 설정한 private 개발 R2.
새 합성 회원/게스트와 단색 합성 이미지만 사용했다. 실 사용자 사진·계정은 테스트에 사용하지 않았다.
실제 R2 키는 서버 환경변수에서 읽었으며 값은 기록하지 않았다.

## 발견과 조치

처음 설정된 키는 SDK 목록 조회 200, 앱 서명 PUT과 SDK 직접 PUT은 모두 403 AccessDenied였다.
앱과 로컬 서명의 일치·키 ID/endpoint 일치·시계 오차 약 1초를 값 노출 없이 확인했다.
담당자가 Object Read & Write 키로 로컬 환경변수를 교체했고, 이전 R2 singleton을 사용하지 않도록
Next 개발 서버를 재시작한 뒤 PUT에 성공했다. 코드에서 인증·권한 검사를 우회하지 않았다.

서명 없는 S3 요청은 R2가 400 InvalidArgument와 인증 정보 누락 메시지를 반환했다.
검증 도구는 401/403 또는 **400 + InvalidArgument + 인증 누락 메시지**만 거부 성공으로 인정하도록 보완했다.
일반적인 400/다른 오류를 private 검증 성공으로 간주하지 않는다. 오류 본문·서명 URL은 출력하지 않는다.

## 실제 HTTP 왕복 결과

명령: `SUNNY_LIVE_R2_VERIFY=1 node backend/uploads/tests/live-r2.mjs` (저장소 루트, Node 24).

| 항목 | 실제 결과 |
|---|---|
| 인증 | 새 합성 .invalid 회원의 개발 메일 인증·로그인, 별도 게스트 DB 세션 성공 |
| presign | 201, 본인 UUID의 pending 메타데이터 저장 |
| 회원 JPEG PUT | 실제 R2 PUT 성공, PUT CORS preflight/응답 Origin 성공 |
| 회원 JPEG complete | 200 verified, EXIF 방향6 적용 후 1000×1200 · 7,356 bytes |
| 게스트 PNG PUT/complete | 실제 R2 PUT 성공, 200 verified · 1200×1000 · 6,276 bytes |
| DB 검사 이력 | photo_assets verified, 별도 verified key, photo_upload_attempts published_at 저장 |
| read-url / GET | 앱 발급 성공, 실제 R2 GET 성공, CORS GET preflight/Origin·no-store 확인 |
| 다운로드 검증 | 실제 조회 바이트의 SHA256·크기·해상도가 DB와 일치, EXIF/방향/XMP/IPTC/ICC 없음 |
| 반복 complete | 기존 확정 결과와 동일한 200 응답 |
| 세션 재조회 | 동일 회원/게스트 UUID 유지, read-url 재발급·사진 해시 유지 |
| 원본 덮어쓰기 | 실제 살아 있는 pending PUT을 재사용해도 확정 사진 해시 유지 |
| 타인 / 무인증 | read-url 각각 404 / 401, URL 발급 안 됨 |
| MIME 위장 SVG | PNG MIME으로 실제 PUT 후 서버 complete 415 UNSUPPORTED_IMAGE_TYPE, DB rejected |
| rejected 조회 | 409 UPLOAD_NOT_VERIFIED, 조회 URL 발급 안 됨 |
| 로그아웃 | 이후 같은 쿠키로 새 read-url 발급 401 |

최종 성공 실행의 assertion 그룹 10개가 모두 통과했다. 마지막 출력:

```text
PASS: real Next HTTP -> R2 PUT -> server inspection -> PostgreSQL -> signed R2 GET.
Retained: two synthetic subjects, three photo assets, five R2 objects. No object/DB deletion. Browser/3D flow not tested.
```

## 남겨진 테스트 데이터와 조회

최종 성공 실행: 합성 사용자 2명, asset 3개(verified 2/rejected 1), R2 객체 5개.
권한 진단/도구 보완 실행까지 합친 **이번 작업 전체**: 합성 사용자 7명, asset 6개
(verified 3/rejected 1/pending 2), 전송 성공한 합성 R2 객체 7개.
초기 pending 2개는 PUT 차단 당시의 메타데이터다. 재시도하면서 기존 asset을 삭제/변경하지 않았다.
OS 임시 폴더의 private manifest/summary/조회 이미지에 이번 fixture를 구분했다.
키·쿠키·서명 URL은 Git/PR/검증 산출물에 기록하지 않았다. 실제 R2 검증 도구에는 자동 삭제 기능이 없다.

DBeaver sunny-dev-admin에서 app schema를 새로고침한 뒤 메타데이터를 조회한다.
아래 쿼리는 원본 파일/서명/인증 토큰을 조회하지 않는다.

```sql
SELECT id, owner_id, status, mime_type, bytes, width, height,
       sha256 IS NOT NULL AS has_sha256, rejection_code, created_at
FROM app.photo_assets
ORDER BY created_at DESC;

SELECT asset_id, created_at, published_at
FROM app.photo_upload_attempts
ORDER BY created_at DESC;
```

sunny_app 직접 조회는 app.user_id 컨텍스트가 없으면 RLS로 행을 보여주지 않는 것이 정상이다.
관리 조회 결과의 실제 사용자 데이터는 공유/커밋하지 않는다. 테스트 객체/사용자 정리는 별도 팀장 확인 범위다.

## 검증의 경계

실제 R2와 Next HTTP API·PG까지의 왕복과 CORS HTTP 응답을 확인했다.
브라우저 파일 선택/새로고침 UI·브라우저가 적용하는 CORS·3D 텍스처·Vercel preview는 확인하지 않았다.
현재 사진 선택 화면도 아직 서버와 연결되지 않았다. 서버 세션 재조회가 UI 새로고침 검증을 대신하지 않는다.
공동 계약·공유 게스트 남용 제한·보관/삭제·동의/운영 정책이 남아 production 차단을 유지한다.
main commit/push·PR merge·DB 볼륨/기존 사용자/R2 객체 삭제는 하지 않았다.
