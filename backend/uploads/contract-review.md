# R2 사진 업로드 구현 대조안 — #93

main에 머지된 PR #65 사진 정본과 PR #92의 실제 DB 세션을 연결하는 **개발 구현**이다.
API·DTO·실패 응답의 원본은 [CONTRACT_API.md](../../docs/CONTRACT_API.md)의 사진 절이며,
인증 자격은 같은 문서의 인증 절을 따른다. 이 메모는 구현/복구 근거이며 운영 합의를 대신하지 않는다.
#81 기반·#65 사진 계약은 머지되었고 #92 인증 리뷰/머지 뒤 이 구현을 판단한다. 팀장만 머지한다.

## 구현 범위와 DTO

photo-rules / presign / complete / read-url의 입력과 반환은 정본 사진 절에 위임한다.

보호 API는 같은 Origin과 Better Auth **DB 재조회 세션**이 필요하다. 게스트 또는
emailVerified=true 회원만 허용한다. 자동 게스트 생성·회원 소유권 이전은 없다.
fileName은 유효성 확인 후 버린다. owner/key/bucket/파일명/해시/검사 토큰은 응답하지 않는다.
성공·실패 모두 no-store. 앱 API에는 쿠키를, R2 PUT/GET에는 credentials:omit를 사용한다.

## 정본 대조와 개발 검토값

- RLS 아래에서 타인 ID와 없는 ID를 같은 오류로 거절한다. 타인 존재를 확인하려고 RLS를 우회하지 않는다.
- 2026-11-03 정본 대조 보완: SDK의 `NoSuchKey`만 `UploadError("UPLOAD_NOT_RECEIVED")`로 바꾼다.
  service는 현재 검사 토큰을 해제해 pending으로 되돌린 뒤 이 안전한 오류를 그대로 던지고,
  handler의 공통 오류 응답으로 정본의 **409 UPLOAD_NOT_RECEIVED**를 전달한다.
  사용자는 유효한 PUT URL로 파일을 올린 뒤 같은 asset의 complete를 호출한다. 미수신 complete만 자동 반복하지 않는다.
  버킷 없음/권한/일반 404/네트워크 장애를 미수신으로 간주하지 않고 기존 503으로 처리한다.
  rejected·expired의 재호출과 화면 재시도 상한도 정본 규칙을 따른다.
- 개발 검토값: PUT/GET 각각 300초, complete 기한 900초, 검사 lease 120초,
  R2 각 작업 15초, sharp 처리 15초, 원본/정제본 각각 10 MiB, 최대 40,000,000픽셀·한 변 8,000,
  단일 프레임, 프로세스당 검사 최대 2개. 비율은 제한하지 않는다. 수치는 운영 합의값이 아니다.
- JPEG/PNG·1000×1000 최소 규칙은 기존 임시값을 사용하며 provisional=true를 유지한다.
- presign은 사용자별 advisory transaction lock 아래 최근 60분 20개. 서명 실패는 rollback,
  응답 유실 뒤 재발급은 새 발급으로 센다. 429의 Retry-After는 가장 오래된 발급 만료까지 초다.
- inspecting 409는 Retry-After:3. 화면은 3초 간격 최대 10회 추가 후 안내한다.
  화면 구현/3D 텍스처 교체는 이번 서버 작업 범위 밖이다.

## 동일 바이트 확정과 복구

1. app.photo_assets의 pending 원본은 브라우저 PUT으로 만료 전 덮어쓸 수 있다.
2. complete는 행 잠금으로 검사 토큰/lease를 확보한다. R2 네트워크 호출 중 DB 잠금을 잡지 않는다.
3. 최대 크기 이내로 **한 번 읽은 버퍼**만 실제 디코딩·방향 보정·sRGB 재인코딩한다.
   SVG/다중 프레임/손상/요청 MIME 불일치/해상도·자원 초과를 거부한다. metadata 유지 옵션 없이
   재인코딩하여 EXIF/GPS/원본 문구를 제거한다.
4. 검사 시도마다 새 verified 임의 key를 DB photo_upload_attempts에 먼저 기록하고 저장한다.
   브라우저에는 verified 쓰기 서명을 주지 않는다. pending을 복사하거나 두 번째로 읽지 않는다.
5. DB 확정은 현재 검사 토큰이 일치하고 lease가 유효할 때만 성공한다. lease를 잃은 이전 작업은
   새 작업의 상태·verified key를 바꿀 수 없다. 최종 응답은 DB의 확정된 값만 쓴다.
6. 저장/DB 확정 장애 시 503, 자신의 검사 토큰만 pending으로 되돌린다. DB 전체 장애/프로세스 중단이면
   lease 만료 뒤 같은 complete가 회수한다. 완료 기한까지 지나면 expired로 막는다.
   이미 verified인 complete는 동일 결과를 반환한다.
7. 시도별 key 기록은 저장 성공 후 DB 실패로 생기는 고아 객체의 식별 근거다. published_at 없는
   시도를 무조건 즉시 삭제하면 안 된다. 활성 lease·아직 끝나지 않은 작업·재시도와 대조해야 한다.

pending_cleanup_after는 PUT 만료+여유시간 이후의 **정리 후보 시각**이며 삭제 실행이 아니다.
늦게 끝나는 업로드/재생성·고아 verified·참조 중 주문·보관 기한을 반복 대조할 실행 주체와 주기,
verified 보관/삭제·동의 철회 정책은 TBD다. 이 구현에는 R2 Delete·공개 URL·자동 삭제 작업이 없다.
미정 정책을 구현했다고 보고하지 않으며 production에서는 flag 값과 무관하게 보호 API를 차단한다.

## 남은 범위

실제 R2/Next HTTP API/PG 및 CORS HTTP 응답의 확인 결과는
[실연결 검증 기록](verification-2026-10-16.md)을 본다. 브라우저 파일 선택/PUT→3D 텍스처 왕복,
공유 게스트 남용 제한, 보관·삭제 운영 작업, 실제 동의 문구·버전은 별도 합의/검증이 필요하다.
주문 생성·7칸 배치·동의 테이블은 이번에 만들지 않는다. 후속 주문 API는 한 트랜잭션에서
정확히 index 0..6의 7칸, 동일 사진 재사용/0장, 본인 verified, 사진 제작 동의와 미리보기 확인을 검증해야 한다.

근거: [R2 presigned URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
[sharp output/metadata](https://sharp.pixelplumbing.com/api-output/). 2026-10-16 확인.
