# private R2 사진 업로드 — #93

API/상태/개발 정책과 공동 검토 항목은 [contract-review.md](contract-review.md).
환경변수 이름의 원본은 [backend/README.md](../README.md)다.
서버 API만 구현했으며 기존 사진 선택 화면은 아직 서버와 연결하지 않았다.

## 로컬 실행

1. Node 24와 Docker 개발 sunny DB를 준비한다. 저장소 루트에서
   `python3 backend/postgres/manage.py up`, `python3 backend/postgres/manage.py migrate`를 실행한다.
   0003이 app.photo_assets / app.photo_upload_attempts를 만든다. DBeaver에서 app schema를 새로고침한다.
   적용한 0001/0002/0003 SQL은 수정하지 않는다. 운영 DB에는 이 개발 도구를 실행하지 않는다.
2. Cloudflare R2에서 **개발 전용 private 버킷**을 준비한다. r2.dev와 custom public domain을 켜지 않는다.
   해당 버킷에 한정된 Object Read & Write S3 자격증명을 담당자가 발급한다. 브라우저에 키를 넣지 않는다.
3. ignored frontend/.env.local에 backend/README.md 표의 R2 네 이름을 직접 넣는다.
   AUTH_ENABLED=true, BETTER_AUTH_URL=http://localhost:3000, sunny_app DATABASE_URL 및 기존 인증 설정을 유지한다.
   PHOTO_UPLOAD_ENABLED=true로 개발 기능을 켠 후 frontend에서 npm run dev를 재시작한다.
4. R2 버킷 Settings → CORS Policy에 [cors.local.json](cors.local.json)을 적용한다.
   localhost와 127.0.0.1은 다른 Origin이다. 실제 앱 Origin 한 개로 맞추며 *로 대체하지 않는다.
   이 JSON은 Dashboard 형식이다. 배포/preview CORS와 운영 버킷 설정은 별도 공동 검토한다.
5. 같은 Origin의 앱에서 이메일 인증 후 로그인하거나 POST /api/auth/sign-in/anonymous로 게스트 세션을 받는다.
   브라우저는 /api/uploads/photo-rules → presign → R2 PUT → complete → read-url 순서로 요청한다.
   complete/read-url은 본문 없이, presign은 application/json으로 보낸다.

직접 R2 PUT 예시(실제 URL은 presign 응답의 메모리 값이며 로그/파일/PR에 보관하지 않는다):

```ts
const uploaded = await fetch(uploadUrl, {
  method: "PUT", headers: { "Content-Type": file.type }, body: file, credentials: "omit",
});
if (!uploaded.ok) throw new Error("사진 전송을 다시 확인해 주세요.");
// PUT 성공 뒤에만 same-origin complete를 호출한다. R2에 앱 쿠키/Authorization을 보내지 않는다.
```

complete가 409면 Retry-After 3초로 최대 10회 추가 확인하고 멈춘다. 429면 남은 시간을 안내한다.
read-url은 최대 7개 단건 병렬, 같은 asset은 화면에서 중복 제거한다. 3D 텍스처 로딩은 CORS가 필요하며
URL 만료 전 갱신/실패 안내를 구현해야 한다. 이 화면 연결은 팀장 담당 후속 범위다.

GET/PUT 서명은 만료 전 반복 사용 가능하다. 로그아웃해도 이미 발급한 URL은 즉시 취소되지 않는다.
재발급은 앱 세션으로 막고 verified 원본을 private/no-store로 다룬다.
규칙은 provisional=true, production 보호 API는 flag와 관계없이 503이다.

## 검증

```sh
cd frontend
npm run test:uploads
npm run test:auth
npm test
npm run typecheck
npm run build
```

uploads 테스트는 실제 로컬 sunny PG + Better Auth 이메일 인증 회원/게스트와 **모의 object store**를 쓴다.
SDK의 실제 SigV4 URL 생성은 가짜 키로 로컬 검증하며 R2에 전송하지 않는다.
합성 이미지·.invalid 회원만 생성하고 테스트가 만든 ID에 한해서 정리한다. 실 사용자·실 R2 데이터는 건드리지 않는다.
서버 동시성/lease/fencing·DB 장애 복구/고아 후보·RLS·미인증·세션 폐기·형식 위장 등을 검증한다.
이 결과가 실제 R2 권한/CORS/업로드·브라우저 3D 왕복·Vercel 배포 검증을 뜻하지 않는다.

## 복구·삭제·다음 단계

중단된 inspecting은 lease 만료 뒤 동일 complete가 회수한다. 검증 실패는 rejected, 일시 장애는 503이며
재호출은 같은 asset을 쓴다. 기한이 지난 pending/중단 작업은 expired로 막는다.
검사 시도별 object_key와 published_at, pending_cleanup_after는 운영 정리 작업의 근거만 제공한다.
자동 R2 삭제/정리 스케줄러는 없다. 객체·버킷 삭제는 저장소 규칙에 따라 팀장 확인 후 수행한다.
미정 보관 기간·반복 정리/늦게 끝난 PUT·고아 객체·참조 주문·동의 철회 운영은 공동 검토 후 구현한다.

주문 7칸·제작 동의·미리보기 확인·테스트 결제·리뷰는 별도 API다. 사진 테이블만으로 주문 구현 완료라 하지 않는다.
선행 PR 머지 뒤 main을 **이 작업 브랜치에 merge**해 중복 diff를 정리한다. rebase/force push/직접 main push는 하지 않는다.
