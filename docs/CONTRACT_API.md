# 계약 — 화면 ↔ 서버 API ↔ Sanity · Supabase

> **상태: 미확정 (v0 틀).** 채워야 할 항목은 아래 체크리스트에 있다.
>
> 담당: 봉준표·조수희(화면) ↔ 이재원(서버·데이터). **한쪽이 임의로 바꾸지 않는다.** 바뀌면 둘이 같은 PR에서 합의한다.

## 구조

```
브라우저 (frontend 화면)
   │  fetch("/api/...")            ← frontend/lib/api.ts 만 호출한다 (화면 코드에서 fetch 직접 금지)
   ▼
Next.js 서버 API (frontend/app/api/)            이재원
   │  frontend/lib/server/ 의 서버 전용 클라이언트
   ├──▶ Sanity CMS        공개 콘텐츠: 컬렉션 · 제품 · 제작 기록 · 이미지
   ├──▶ Supabase          비공개 데이터: 주문 요청 · 선호 색상 설문 (접근 정책 적용)
   └──▶ 기상청 API         자외선지수
```

**브라우저는 Sanity·Supabase·기상청을 직접 부르지 않는다.** 전부 서버 API를 거친다. 키가 브라우저로 새지 않게 하는 구조다.

단, 고객 사진은 서버가 발급한 **1회용 서명 업로드 URL**에만 브라우저가 직접 전송한다. 3D 가시안에 쓰는 검증된 사진도 서버가 발급한 **짧은 수명의 서명 조회 URL**로만 직접 읽는다. 두 URL 모두 Supabase 키나 다른 파일의 접근 권한을 포함하지 않는다.

## mock 먼저

서버와 데이터가 준비되기 전에도 화면을 만든다.

| `NEXT_PUBLIC_API_MODE` | `frontend/lib/api.ts`가 하는 일 |
|---|---|
| 없음 · `mock` (기본) | `frontend/lib/mock/*.json`을 읽어 돌려준다 |
| `api` | `/api/*`를 호출한다 |

**규칙: 이 문서의 응답 예시 = `lib/mock/*.json` = 서버 API 실제 응답.** mock에서 api로 바꾸는 날 준표가 셋을 대조한다.

## 불변식

1. **서버 전용 키는 브라우저에 가지 않는다** — `NEXT_PUBLIC_` 금지, 서버 API 안에서만 읽는다
2. **Supabase `service_role` 키는 서버 API에서도 꼭 필요한 곳에만** 쓴다. 기본은 `anon` 키 + 접근 정책(RLS)
3. **주문·설문 테이블은 RLS 없이 만들지 않는다.** 주문 요청의 이름·연락처·사진은 개인정보다
4. **공개 콘텐츠의 정본은 Sanity, 주문·설문의 정본은 Supabase.** 같은 데이터를 두 곳에 두지 않는다
5. **자외선지수를 못 받아오면 오류를 숨기지 않는다** — 마지막으로 받은 값과 갱신 시각, 안내 문구를 함께 준다
6. **고객 사진은 서버 검사를 통과하기 전까지 주문에 연결하지 않는다.** 브라우저 검사와 파일명·확장자·요청 MIME은 신뢰하지 않는다

## 채워야 할 것

- [ ] **제품** (Sanity) — 종류 `bracelet` \| `necklace`, 이름, 비즈 구성, 사진, 설명
- [ ] **비즈 · 광변색** — 색상: 기획서 수정본 기준 **빨강·주황·파랑·노랑·보라 5색** / 농도 저·중·고. (`web-demo/lib/bead.ts`는 3색 견본이다 — 확정 시 errata)
- [ ] **제작 기록** (Sanity) — 제목, 날짜, 단계(모델링·몰드·성형·전사·도포·조립), 사진, 본문
- [ ] **주문 요청** (Supabase) — 필드, 이용 동의 항목, RLS 정책
- [ ] **선호 색상 설문** (Supabase) — 문항, 익명 여부, RLS 정책
- [ ] **자외선지수** — `GET /api/uv` 응답 형태, 지역 기준, 캐시 주기, 실패 응답
- [ ] **커스텀 사진 업로드** — 아래 계약 초안에서 `provisional` 값과 보관 기간을 확정한 뒤 체크
- [ ] 공통 에러 응답 형태 — `{ error: { code, message } }` 여부
- [ ] 엔드포인트 목록과 각 응답 JSON 예시

## 엔드포인트 (초안 — 확정 전)

| 메서드 · 경로 | 용도 | 정본 |
|---|---|---|
| `GET /api/products` | 컬렉션 목록 (`?kind=bracelet\|necklace`) | Sanity |
| `GET /api/products/[slug]` | 제품 상세 | Sanity |
| `GET /api/archive` | 제작 기록 목록 | Sanity |
| `GET /api/uv` | 현재 자외선지수 | 기상청 |
| `GET /api/uploads/photo-rules` | 브라우저 1차 검사에 쓸 사진 규칙 | 서버 설정 |
| `POST /api/uploads/presign` | 비공개 임시 경로의 1회용 업로드 URL 발급 | Supabase Storage |
| `POST /api/uploads/[assetId]/complete` | 업로드 완료 알림 · 서버 실제 파일 검사 | Supabase Storage |
| `POST /api/uploads/[assetId]/read-url` | 검증된 사진의 짧은 수명 조회 URL 발급 | Supabase Storage |
| `POST /api/orders` | 커스텀 주문 요청 | Supabase |
| `POST /api/survey` | 선호 색상 설문 | Supabase |

## 커스텀 사진 업로드 계약 — #26 검토 초안

> **합의 전 초안.** `provisional: true`인 규칙과 `TBD` 정책은 운영값이 아니다. 봉준표·이재원이 이 PR에서 값을 확정하고 `provisional: false`로 바꾸기 전에는 사진 업로드를 프로덕션에 켜지 않는다.

### 흐름과 신뢰 경계

```
1. 브라우저  → GET  /api/uploads/photo-rules
2. 브라우저  → POST /api/uploads/presign
3. 브라우저  → 서명 업로드 URL로 임시 파일 전송
4. 브라우저  → POST /api/uploads/{assetId}/complete
5. 서버      → 파일 바이트·용량·해상도 검사 → 방향 보정·재인코딩(EXIF 제거)
6. 서버      → 통과 파일만 verified 상태로 전환
7. 브라우저  → 소유한 verified 사진의 조회 URL로 3D 가시안 확인
8. 주문 API  → 7칸 배치에 있는 본인 소유 verified assetId만 받음
```

- `assetId`는 presign 때 미리 발급하지만, `verified` 전에는 주문이나 조회에 쓸 수 없다.
- 업로드 원본은 비공개 버킷의 `pending/` 경로에 격리한다. 공개 URL은 만들지 않는다.
- 서버 검사는 업로드 완료 알림을 받는 즉시 실행한다. 주문 제출 때까지 검사를 미루지 않는다.
- 완료 알림은 같은 `assetId`로 다시 호출해도 검사를 중복 실행하지 않는다. 검사 중에는 `409`, 검증 완료 뒤에는 동일한 최종 결과를 반환한다. 화면의 재시도 규칙은 아래 `complete` 항목을 따른다.
- `presign`·`complete`·`read-url`·주문 API는 #70 인증 계약에 따라 Next 서버가 확인한 사용자 ID를 사용한다. 요청 본문의 `userId`·`ownerId`나 다른 사용자의 `assetId`를 신뢰하지 않는다.
- 서버는 실제 파일 시그니처와 이미지 디코딩 결과를 검사한다. 파일명·확장자·요청 MIME만으로 통과시키지 않는다.
- SVG와 디코딩할 수 없는 파일은 거부한다.
- 통과 파일은 화면 방향을 적용한 뒤 재인코딩해 EXIF 전체를 제거한다. 특히 GPS 위치 정보가 남지 않아야 한다.
- 실패한 임시 파일은 주문에 연결하지 않고 삭제 대상으로 표시한다.

### 사진 규칙

현재 화면의 임시값을 계약 모양에 옮긴 것이다. 숫자와 비율은 회의에서 확정해야 한다.

```json
{
  "photoRules": {
    "accept": ["image/jpeg", "image/png"],
    "maxBytes": 10485760,
    "minWidth": 1000,
    "minHeight": 1000,
    "aspectRatio": null,
    "provisional": true
  }
}
```

| 필드 | 의미 |
|---|---|
| `accept` | 브라우저 안내와 presign 1차 거절에 쓰는 MIME 목록. 실제 형식은 서버가 바이트로 다시 확인 |
| `maxBytes` | 원본 업로드 최대 바이트 수 |
| `minWidth` · `minHeight` | 방향 보정 후 필요한 최소 픽셀 수 |
| `aspectRatio` | `null`이면 비율 제한 없음. 제한할 때 `{ "min": number, "max": number }` |
| `provisional` | `true`면 회의 전 임시값이며 운영 업로드 비활성 |

### `GET /api/uploads/photo-rules`

로그인 전에도 화면 안내에 쓸 수 있는 공개 규칙이다. 위 `photoRules` 객체를 그대로 반환한다. 화면은 이 값을 다시 하드코딩하지 않는다.

응답 `200`:

```json
{
  "photoRules": {
    "accept": ["image/jpeg", "image/png"],
    "maxBytes": 10485760,
    "minWidth": 1000,
    "minHeight": 1000,
    "aspectRatio": null,
    "provisional": true
  }
}
```

### `POST /api/uploads/presign`

로그인한 사용자가 브라우저 1차 검사를 통과한 뒤 요청한다.

요청:

```json
{
  "purpose": "custom_order_photo",
  "fileName": "my-photo.jpg",
  "mimeType": "image/jpeg",
  "size": 2456789
}
```

| 필드 | 규칙 |
|---|---|
| `purpose` | 현재는 `custom_order_photo`만 허용 |
| `fileName` | 화면 표시와 감사 기록용. 저장 경로와 형식 판정에는 사용하지 않음 |
| `mimeType` | `photoRules.accept`에 포함되어야 하나 서버 실제 검사 결과가 우선 |
| `size` | `1..photoRules.maxBytes`. 실제 업로드 바이트 수를 서버가 다시 확인 |

응답 `201`:

```json
{
  "assetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31",
  "uploadUrl": "https://storage.example/signed-upload/REDACTED",
  "expiresAt": "2026-09-24T11:15:00.000Z"
}
```

- `uploadUrl`은 응답을 받은 사용자와 해당 `assetId`의 임시 경로 하나에만 유효하다.
- 같은 경로 덮어쓰기는 허용하지 않는다.
- 만료 시간은 서버 설정값으로 관리하며 계약 확정 전에는 숫자를 문서에 고정하지 않는다.
- 계정당 **최근 60분 동안 발급한 URL 20개**를 상한으로 한다. 사용자가 재시도하거나 사진을 바꿀 수 있도록 7장보다 넉넉하게 잡은 초기 운영안이며, 서버는 인증된 사용자 ID 기준으로 동시 요청까지 원자적으로 집계한다. 형식·크기 검증에 실패해 URL을 발급하지 않은 요청은 세지 않는다.
- 상한에 도달하면 `429 UPLOAD_RATE_LIMITED`와 `Retry-After`(다음 발급이 가능한 때까지의 초)를 반환한다. 화면은 남은 시간을 안내하고 자동 재요청하지 않는다. 이 제한은 `presign` URL 발급에 적용하며 다른 업로드 API 호출은 세지 않는다. 상한을 바꾸려면 준표·재원이 계약을 다시 검토한다.

### `POST /api/uploads/[assetId]/complete`

서명 URL 업로드가 성공한 직후 호출한다. 요청 본문은 없다.

응답 `200`:

```json
{
  "assetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31",
  "status": "verified",
  "mimeType": "image/jpeg",
  "bytes": 1987654,
  "width": 1800,
  "height": 1200
}
```

`status` 전이:

```
pending → inspecting → verified
                     ↘ rejected
pending              → expired
```

- `verified`만 주문의 `beadLayout.beads[].photoAssetId`로 받을 수 있다.
- 서버가 반환하는 MIME·용량·해상도는 재인코딩된 최종 파일 기준이다.
- `inspecting` 중 같은 요청이 오면 `409 UPLOAD_INSPECTION_IN_PROGRESS`와 `Retry-After: 3`(초)을 반환한다. 화면은 이 응답 뒤 3초 간격으로 같은 `complete` 요청을 **최대 10회 추가 호출**한다. 매번 `409`라면 자동 재시도를 멈추고 "사진 확인에 시간이 걸리고 있습니다. 잠시 후 다시 확인해 주세요."라고 안내한다. 이후 사용자의 재확인은 같은 요청으로 하며 파일을 다시 업로드하지 않는다.
- 이미 `verified`이면 기존 `200` 결과를 다시 반환한다.
- `rejected`·`expired`이면 다시 살리지 않고 새 presign부터 시작한다.

### `POST /api/uploads/[assetId]/read-url`

현재 로그인 사용자가 소유한 `verified` 파일에 대해서만 짧은 수명의 조회 URL을 발급한다. 공개 URL이나 영구 URL은 반환하지 않는다. 주문 전에 반드시 확인하는 **3D 가시안의 비즈 표면 텍스처**에도 이 URL을 사용한다.

응답 `200`:

```json
{
  "readUrl": "https://storage.example/signed-read/REDACTED",
  "expiresAt": "2026-09-24T11:20:00.000Z"
}
```

- 7칸에 사진을 하나씩 넣으면 화면에서 최대 7개를 동시에 요청한다. 같은 `assetId`가 여러 칸에 있으면 한 번만 요청하고 그 URL을 해당 칸에서 함께 쓴다. 현재 규모에서는 기존 단건 API를 병렬 호출하며, 별도 일괄 발급 API는 만들지 않는다.
- 조회 URL 만료 시간은 3D 가시안을 돌려보는 시간을 고려해 회의에서 확정한다(`TBD`). 화면은 `expiresAt`이 지나기 전에 필요한 URL을 다시 요청해 텍스처를 갱신한다. 갱신에 실패하면 해당 사진을 계속 표시한다고 가정하지 않고 안내와 재시도 동작을 제공한다.

### 실패 응답

사진 업로드 API는 공통으로 아래 모양을 쓴다.

```json
{
  "error": {
    "code": "IMAGE_DIMENSIONS_TOO_SMALL",
    "message": "사진 해상도가 최소 기준보다 작습니다."
  }
}
```

| HTTP | `code` | 때 |
|---:|---|---|
| 400 | `INVALID_UPLOAD_REQUEST` | 필수 필드 누락·범위 밖 값 |
| 401 | `AUTHENTICATION_REQUIRED` | 로그인이 없거나 만료됨 |
| 403 | `UPLOAD_ACCESS_DENIED` | 다른 사용자의 `assetId` 접근 |
| 404 | `UPLOAD_NOT_FOUND` | 존재하지 않는 `assetId` |
| 409 | `UPLOAD_INSPECTION_IN_PROGRESS` | 같은 파일을 이미 검사 중 |
| 410 | `UPLOAD_EXPIRED` | 서명 URL 또는 임시 파일 만료 |
| 413 | `FILE_TOO_LARGE` | 요청 크기 또는 실제 바이트 수 초과 |
| 415 | `UNSUPPORTED_IMAGE_TYPE` | 허용하지 않는 형식·SVG·실제 형식 불일치 |
| 422 | `INVALID_IMAGE_FILE` | 이미지로 디코딩할 수 없음 |
| 422 | `IMAGE_DIMENSIONS_TOO_SMALL` | 방향 보정 후 최소 해상도 미달 |
| 422 | `IMAGE_ASPECT_RATIO_NOT_ALLOWED` | 확정된 비율 범위 밖 |
| 429 | `UPLOAD_RATE_LIMITED` | 인증된 계정이 최근 60분의 presign 발급 상한에 도달 |
| 503 | `UPLOAD_STORAGE_UNAVAILABLE` | Storage 장애로 안전하게 완료할 수 없음 |

오류 메시지는 화면 표시용 한국어 문장이고, 분기는 `code`로 한다. 내부 스토리지 경로·키·원본 오류·개인정보는 응답이나 로그에 넣지 않는다.

### 보관·삭제 정책 — 합의 필요

| 상태 | 보관·삭제 원칙 | 기간 |
|---|---|---|
| `pending` | 완료 알림이 없거나 만료된 임시 파일을 정기 삭제 | `TBD` |
| `rejected` | 검사 실패 뒤 즉시 접근 차단하고 삭제 | `TBD` |
| `verified` | 제작 완료 후 정해진 기간이 지나면 원본·정제본·메타데이터 삭제 | `TBD` |
| 브랜드 공개 동의 철회 | 공개 사용을 중단하고 별도 보관 근거가 없으면 삭제 | `TBD` |

기간과 삭제 실행 주체(예약 작업 또는 운영 절차)가 `TBD`인 동안 프로덕션 업로드를 켜지 않는다.

### 주문 동의 필드

제품 종류·길이와 무관하게 네모 비즈는 **정확히 7칸**이고, 각 칸에 사진 한 장 또는 `null`을 배치한다. 사진은 선택 사항이며 서로 다른 사진은 0~7장이다. 동일한 사진을 여러 칸에 쓸 수 있고 이 경우 업로드는 한 번만 한다. 주문 화면은 3D 가시안을 보여준 뒤 명시적인 확인을 받아야 제출할 수 있다. 주문 API는 `previewConfirmed: true`를 요구하고 서버 수신 시각을 확인 기록으로 저장한다. 이 값은 사용자의 확인 의사를 기록하며 실제 시청 시간을 증명하지는 않는다.

요청의 사진 배치 예시(7칸 전체):

```json
{
  "beadLayout": {
    "squareCount": 7,
    "beads": [
      { "index": 0, "photoAssetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31" },
      { "index": 1, "photoAssetId": "019db8d2-6721-7f17-9f73-2d9c9e1a6b31" },
      { "index": 2, "photoAssetId": null },
      { "index": 3, "photoAssetId": null },
      { "index": 4, "photoAssetId": null },
      { "index": 5, "photoAssetId": null },
      { "index": 6, "photoAssetId": null }
    ]
  },
  "previewConfirmed": true,
  "photoProductionConsent": {
    "accepted": true,
    "acceptedAt": "2026-09-24T11:30:00.000Z",
    "policyVersion": "TBD"
  },
  "photoBrandUseConsent": {
    "accepted": false,
    "acceptedAt": null,
    "policyVersion": "TBD"
  }
}
```

- `beadLayout.squareCount`는 `7`, `beads` 길이는 정확히 7이다. `index`는 0~6을 한 번씩 포함해야 하며 빠짐·중복·범위 밖 값은 거절한다. 순서는 `index`로 정한다.
- `previewConfirmed`가 `true`가 아니면 주문을 받지 않는다. 서버는 확인 시각을 브라우저 값 대신 직접 기록한다.
- `beads[].photoAssetId`는 `null` 또는 본인 소유의 `verified` 파일 ID다. 같은 ID가 여러 칸에 있어도 허용한다. 사진이 없으면 일곱 칸 모두 `null`이다.
- 사진이 한 칸이라도 있으면 `photoProductionConsent.accepted`가 `true`여야 한다. 모두 `null`이면 두 사진 동의 필드는 필요 없다.
- `photoBrandUseConsent`는 제작 동의를 대신하지 않으며, 거부해도 주문할 수 있다.
- 동의 시각과 정책 버전을 서버가 저장한다. 브라우저가 보낸 시각만 신뢰하지 않는다.

## 변경 이력

- 2026-10-04: PR #65 리뷰 반영 — 7칸 사진 배치, 검사 중 재시도, presign 계정별 상한, 3D 가시안 조회 URL 용도 명시
- 2026-09-24: #26 커스텀 사진 업로드 계약 검토 초안 추가 (정책값·보관 기간 합의 전)
- 2026-09-17: v0 틀 작성 (구조 · mock 규칙 · 불변식 · 채울 항목)
