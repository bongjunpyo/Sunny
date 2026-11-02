# 기존 데이터를 보존하는 개발 DB 기반 이관 — #95

PR #81이 병합 전에 0001과 최초 초기화를 보완했기 때문에, 예전 0001을 적용한 DB는 새 파일의 checksum과 다르다.
이관 도구는 기존 이력을 수정하지 않고, 새 기반과 기존 데이터를 결합한 별도 DB를 만든다.
대상은 `sunny-dev-db-1` / PostgreSQL 17 / loopback의 개발 DB이며 운영 DB에는 사용하지 않는다.

## 데이터와 이력 보존 방식

1. 기존 DB의 이력 0001~0003과 실행 컨테이너·볼륨·로컬 비밀번호를 확인한다. 알려지지 않은 이력이나 이관 대상 밖의 데이터 객체가 있으면 중단한다.
2. 로컬 `backend/secrets/foundation-upgrades/` 아래에 전체 원본 dump와 auth/app data-only dump를 만든다. 디렉터리는 0700, 파일은 0600이다. 비밀번호·데이터·토큰을 화면이나 Git에 기록하지 않는다.
3. 전체 원본 dump를 별도 관리 전용 DB에 실제 복원하고, 모든 관리·인증·사진 테이블의 건수와 전체 행 내용의 HMAC을 대조한다. HMAC 키도 로컬 비공개 파일이다.
4. 공식 이미지의 network-none/tmpfs 컨테이너에 저장소 init과 migration 0001~0003을 적용한다. 그 결과를 새 DB의 기반으로 복원한 뒤 기존 auth/app 데이터만 넣는다. 새 migration 이력은 실제 재실행 결과이며 원본 이력은 원래 DB와 백업에 남는다.
5. UUID·비밀번호 해시·암호화된 OAuth 정보·세션·사진 소유권 등을 포함한 모든 행을 다시 대조한다. 역할별 새 DB 검색 경로는 `pg_catalog` 우선으로 설정한다.
6. 기존 DB를 `sunny_before_*`로, 검증된 새 DB를 `sunny`로 한 트랜잭션에서 이름 변경한다. 기존 컨테이너·볼륨·포트·비밀번호·인증 secret과 R2 객체는 바꾸지 않는다.
7. 새 sunny DB에서 데이터 비교와 `manage.py check`를 통과한 뒤 완료 상태를 기록한다. 원본 DB·복원 검증 DB는 runtime CONNECT가 차단된 관리 전용 복구본으로 보존한다.

DB schema는 기존 migration을 새 빈 환경에 적용한 결과만 사용한다. 이관 도구가 업무 table을 별도로 설계하거나 기존 checksum을 덮어쓰지 않는다.

## 실행

저장소 루트에서 현재 유효한 ignored `backend/.env.local`을 사용한다. 같은 경로를 덮어쓰지 않으므로 실행별 새 상태 디렉터리를 지정한다.

```sh
# 짧은 쓰기 중단 안에 백업·복원·대조·전환을 모두 수행
python3 backend/postgres/upgrade_foundation.py migrate \
  --state-dir backend/secrets/foundation-upgrades/<실행별-고유이름>

python3 backend/postgres/manage.py status
python3 backend/postgres/manage.py check
PYTHONDONTWRITEBYTECODE=1 SUNNY_DB_TESTS=1 python3 -Werror -m unittest discover -s backend/postgres/tests -v
```

`migrate`는 먼저 모든 기존 자격증명을 확인한 후 sunny_app/sunny_auth의 새 접속을 잠시 막고 해당 DB의 runtime 연결만 끊는다.
백업부터 전환까지 실행 중 로그인·업로드 요청은 잠시 실패할 수 있다. 이름 변경 전에 실패하면 원래 `sunny`의 CONNECT를 복구한다.
이름 변경 후 검증이 실패하면 새 DB의 runtime 접속을 차단한 상태로 두고 원본과 새 DB를 모두 보존한다.
변경되는 것은 DB 접속 권한과 이름뿐이며 DB 역할의 비밀번호나 인증 secret은 변경하지 않는다.

무중단 사전 복원 검증이 필요하면 `stage --state-dir ...`를 먼저 실행하고, 같은 경로에 `cutover`를 실행할 수 있다.
단계 사이 원본 데이터가 달라지면 cutover가 이름 변경 없이 중단하고 원래 접속을 복구한다. 그때는 새 디렉터리에 `migrate`를 실행해 최신 데이터를 다시 백업한다.

전환 후 DBeaver는 기존 연결을 다시 연결해 사용한다. 상태 파일의 `phase=verified`와 실제 DB 검사를 함께 확인한다.

## 복구와 보관

- 백업·상태·HMAC 키는 Git의 `secrets/` 제외 규칙에 해당한다. 공유·첨부하거나 백업 내용을 터미널로 출력하지 않는다.
- `original-full.dump`는 실제 복원이 검증된 전환 전 전체 원본이다. `original-data.dump`는 auth/app 데이터, `new-foundation.dump`는 새 기반이다.
- `state.json`에는 사용한 클러스터 ID·DB 이름·파일 checksum·비공개 비교 결과·진행 단계가 있다. `phase=staged`와 `phase=verified`를 구분한다.
- 원본 `sunny_before_*`와 복원 검증 `sunny_restore_*`는 자동 삭제하지 않는다. 정리 시점은 별도로 정한다.
- 전환 전에 실패하면 원래 sunny가 유지된다. 전환 후 검사 실패는 `phase=cutover`로 남는다. 이때도 새 데이터와 원본 DB 모두 보존된다.
- 전환 후 되돌려야 하면 먼저 현재 sunny를 별도 백업하고 신규 데이터 발생 여부를 확인한다. runtime 접속을 차단한 뒤, 관리 연결의 `postgres` DB에서 현재 sunny를 별도 이름으로 남기고 `sunny_before_*`를 sunny로 되돌리는 두 RENAME을 한 트랜잭션으로 수행한다. 이어 CONNECT·검증을 복구한다. 기존 DB를 DROP하거나 이력을 편집해 해결하지 않는다.

## 실제 확인 — 2026-11-02

- 원본 전체 백업을 별도 DB에 복원하고 관리 이력을 포함한 모든 테이블 데이터 일치 확인.
- 첫 온라인 검증 후 계정 정보 갱신·세션 추가를 감지해 첫 cutover 중단, 원래 접속 자동 복구 확인.
- 최신 로그인 정보를 포함한 새 백업으로 쓰기 중단 이관 완료. 전환 시점 사용자 14명, 계정 10건, 세션 8건, 사진 메타데이터 6건, 업로드 시도 4건, 인증 임시정보 0건 전부 일치.
- 새 0001~0003 이력 확인, 세 schema 객체의 sunny_owner 소유권·RLS·전역 함수 기본 권한·runtime 권한·다른 DB CONNECT/TEMP 거부 검사 통과.
- 이관 안전 검사 포함 DB 테스트 26개, 인증 19개, 사진 19개 통과. 인증·사진 테스트는 합성 ID만 생성·정리하고 실제 R2 객체는 변경하지 않음.
- 접속 주소 `127.0.0.1:5434/sunny`·DB 비밀번호·인증 secret·기존 볼륨 유지. 기존 이력은 원본/전체 백업에 보존.
- 모든 회귀 테스트 후에도 기존 auth/app 전체 행 내용과 원본 DB의 관리 이력이 그대로임을 재대조. 세션 8건 중 현재 유효한 1건도 보존.

추가 회귀 테스트 결과는 같은 이슈/PR의 검증 기록을 따른다.
