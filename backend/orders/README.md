# 시연 주문 요청 — #100

API/입력/DTO/오류/시연 정책의 정본 제안은 [CONTRACT_API.md 주문 절](../../docs/CONTRACT_API.md#주문-요청-저장본인-조회--시연-계약안)과 [계약 PR #101](https://github.com/bongjunpyo/Sunny/pull/101)이다. 공동 계약/운영 승인은 아직 남아 있다. 사용자 확인에 따라 동의 문구·버전은 시연 전용으로 준비했다.

## 구현 경계

- PostgreSQL DB 세션 → 요청/7칸/확인 의사 검증 → 본인 verified 사진을 잠금/대조 → 주문·7칸·동의 영수증 원자 저장 → 본인 목록/상세 조회.
- `REQUESTED`/`DEMO`만 저장한다. 승인 안내는 시연용 주문 요청 저장 성공을 뜻한다. 실제/Toss 테스트 결제·SDK/키·결제 상태/금액·제작/배송 경로가 없다.
- owner별 멱등 키를 transaction advisory lock + UNIQUE로 직렬화한다. 정상화된 본문 해시가 다르면 충돌, 같으면 저장된 결과 재반환이다. 카탈로그/정책 재검사는 새 주문에 적용하며 이미 커밋된 재요청은 스냅샷으로 응답한다.
- 정확히 7개 및 제작 동의는 지연 constraint trigger로 커밋 시 검사한다. 세 테이블 FORCE RLS, runtime SELECT/INSERT만 허용한다. 주문 timestamp 정밀도는 millisecond로 고정해 cursor 페이지의 경계가 Node Date에서 유실되지 않게 했다.
- 사진은 중복 ID를 제거/정렬해 FOR SHARE로 잠근다. 접근 차단 변경과 주문 검증은 직렬화한다. 사진 바이트/키/서명 URL은 주문에 넣지 않는다.

## 안전한 검증

Node 24·Python 3·Docker·로컬에 있는 `postgres:17-bookworm`이 필요하다. 라이브러리 추가 없음.

```sh
cd frontend
npm ci
cd ..
python3 backend/orders/run-isolated-tests.py
```

- **backend/.env.local이 없는 별도 checkout에서만 실행**한다. 기존 파일이 있으면 덮어쓰지 않고 중단한다. `SUNNY_NODE_BIN`으로 Node 24 bin 경로를 지정할 수 있다.
- 무작위 이름/포트의 `sunny-order-test-*` PostgreSQL tmpfs 컨테이너만 만든다. 기존 sunny-dev/5434/볼륨·R2·사용자 키를 읽거나 변경하지 않는다. 모든 계정·사진 메타데이터는 합성이다.
- 기존 versioned role 초기화와 migration runner의 동일 SQL로 0001~0004를 적용하고 재실행 skip을 확인한다. 주문/인증/사진 테스트 후 실제 Next HTTP 가입 없는 명시적 게스트 생성→주문 생성/멱등→조회→로그아웃을 확인한다.
- 임시 설정/키는 0600, 임시 디렉터리는 0700이다. 종료 시 자신이 만든 라벨의 컨테이너만 정지/제거하고 임시 설정을 정리한다. 기존 DB/볼륨에 대한 정리 명령은 없다.
- UI 점검은 선택적으로 `SUNNY_ORDER_UI_HOLD=1`을 사용한다. 테스트가 출력하는 loopback 주소의 `/orders/verify-demo-button`은 합성 확인 입력으로 실제 제출 버튼 부품을 검사하는 임시 화면이다. CLI 점검 후 비공개 ready 파일의 releaseFile을 생성하면 종료한다. 5분 뒤에는 실패로 종료한다. 쿠키/토큰을 출력하지 않는다.
- 이 테스트 화면은 실제 3D 시청 테스트가 아니며 Git에 포함하지 않는다. Playwright CLI에서 주문 저장→승인 안내→목록·상세·새로고침, 390px에서 7칸/가로 넘침 없음도 별도 확인했다.

## 실제 custom/3D 화면 담당자에게

현재 `CustomBuilder`는 사진을 로컬에서만 미리 보며 실제 3D·7칸/R2 연결이 없다. 이 구현은 기존 custom 화면/3D 씬을 바꾸지 않는다. 연결할 부품은 `frontend/components/orders/OrderRequestButton.tsx`다.

- 상위 3D 흐름에서 현재 구성의 미리보기 로딩/사용자 확인을 받은 뒤 `previewReady`와 검증용 `OrderInput`을 전달한다. 미리보기/사진/옵션이 바뀌면 확인을 해제한다. `input=null` 또는 미확인 상태에서는 버튼이 비활성이다.
- 실제 업로드는 #94 photo-rules→presign→PUT→complete를 사용한다. `beads[].photoAssetId`에는 본인 verified ID만 넣고 미수신/검사 중/URL 만료는 사진 정본을 따른다.
- 사진이 있으면 `order-policy.ts`의 동일 시연 문구를 보여주고 제작 동의를 명시적으로 받는다. 브랜드 동의는 선택이고 미선택을 true로 만들지 않는다. 정책은 운영 공개 권한이 아니다.
- 버튼은 한 구성에 같은 멱등 키를 유지해 실패 후 수동 재확인에도 사용한다. 승인 응답의 고정 내부 경로만 사용하며 오류·잘못된 응답에는 이동하지 않는다. 자동 재전송은 하지 않는다.
- `/orders`, `/orders/[orderId]`는 회원/게스트 동일 세션의 실제 DB 내역을 읽는다. `getMember()`가 guest를 null로 반환한다고 세션을 새로 만들지 않는다. `/account`에는 본인 내역 링크만 추가했다.
- 최종 버튼/안내 문구·실제 3D 7칸 화면 통합은 팀장 화면 리뷰/후속 범위다. 가시안 확인 값은 의사 기록이며 시청 시간을 입증하지 않는다.

## 운영/기존 DB 적용 전

#92 인증 → #94 사진 → #96 기반 이관과 계약 #101의 팀장 리뷰/머지 순서를 따른다. **현재 기존 sunny DB에는 0004를 적용하지 않았다.** #96의 0001~0003 전용 이관은 새 주문 migration 적용 전에 완료해야 한다.

실제 카탈로그/Sanity·주문 가능 상태·정책 문구/버전/시행일·개인정보 보관/철회·공유 남용 제한과 실제 3D 화면 연동/검증이 남아 있다. `ORDER_DEMO_ENABLED`는 개발 loopback 전용이며 production/원격 Origin에서는 flag와 무관하게 false다. 실제 설정·배포값을 이번 작업에서 바꾸지 않는다.

설계 근거: PostgreSQL 17 [지연 constraint trigger](https://www.postgresql.org/docs/17/sql-createtrigger.html), [RLS와 권한](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [행 잠금](https://www.postgresql.org/docs/17/explicit-locking.html). 2026-11-03 대조. API 정본과 구현 테스트를 함께 검토한다.
