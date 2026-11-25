# 공개 사이트 배포 — jun 서버 자동화

담당: **봉준표**(파이프라인) · **이재원**(서버 env·DB·메일, #109). 결정 근거는 #109·#119.

https://sunny.stdrd.store 는 **jun 서버의 Docker 컨테이너 `sunny-web`** 이고, Cloudflare 터널(`stdrd-tunnel`)이 그 컨테이너로 보낸다. Vercel·Cloudflare Pages는 쓰지 않는다.

## 흐름

```
main push ─▶ GitHub Actions(deploy-jun) ─▶ jun의 self-hosted runner
             build  : deploy/jun/Dockerfile, 빌더 sunny-builder(메모리 2GB 제한)
             verify : sunny-web-review 임시 컨테이너 + verify-runtime.mjs (공개 사이트 영향 없음)
             activate (게이트 통과 시) : compose.yml의 web image 한 줄 교체 → 실패하면 이전 compose로 복구
             prune  : 최근 3개 이미지만 남김
```

| 트리거 | 빌드·검증 | 공개 사이트 교체 |
|---|---|---|
| `main` push | 항상 | 저장소 변수 **`SUNNY_AUTO_DEPLOY`가 `true`일 때만** |
| 수동 실행 (Actions → deploy-jun → Run workflow) | 항상 | `activate` 체크일 때만 |

- 게이트 켜기: `gh variable set SUNNY_AUTO_DEPLOY --body true` (끄기: `gh variable delete SUNNY_AUTO_DEPLOY`)
- 특정 커밋 수동 배포: `gh workflow run deploy-jun.yml --ref main -f activate=true`
- 서버 전용 환경변수(인증·DB·메일)는 이미지에 넣지 않는다. jun의 `compose.yml`에서 `env_file`로 넣고 컨테이너를 다시 만든다(#109). `NEXT_PUBLIC_*`는 빌드 시점 값이라 바꾸려면 다시 빌드한다.

## 서버 쪽 구성 (jun, 사용자 `jp`)

| 항목 | 위치 | 비고 |
|---|---|---|
| 서비스 | `/home/jp/stdrd-infra/sunny/compose.yml` | `web` 서비스 하나. 파이프라인은 `image:` 줄만 바꾼다 |
| 릴리스 기록 | `/home/jp/stdrd-infra/sunny/releases/<일시>-<태그>/` | `compose.before.yml` · `compose.next.yml` · `previous-image.txt` · `release.json` |
| runner | `/home/jp/actions-runner` | 이름 `jun`, 라벨 `jun`, systemd 서비스 `actions.runner.bongjunpyo-Sunny.jun` |
| 빌더 | `docker buildx ls` → `sunny-builder` | docker-container 드라이버, memory 2000m / swap 2800m |

같은 서버의 `ai-contract`·`ai-one`·`stdrd-tunnel`·`fde.stdrd.store`는 이 파이프라인이 건드리지 않는다.

## 수동 복구

```sh
# jun에서. 가장 최근 릴리스 폴더의 이전 compose로 되돌린다
cd /home/jp/stdrd-infra/sunny
rel=$(ls -d releases/*/ | tail -1)
cp "$rel/compose.before.yml" compose.yml && docker compose up -d --no-build web
```

## runner 설치·갱신

설치는 한 번만. 등록 토큰은 1시간 유효.

```sh
# 맥에서
gh api -X POST repos/bongjunpyo/Sunny/actions/runners/registration-token --jq .token
# jun에서 (아키텍처 arm64)
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -fsSL -o runner.tgz https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-arm64-2.338.2.tar.gz
tar xzf runner.tgz && rm runner.tgz
./config.sh --url https://github.com/bongjunpyo/Sunny --token <토큰> --name jun --labels jun --unattended --replace
sudo ./svc.sh install jp && sudo ./svc.sh start     # 부팅 시 자동 시작
```

- 상태: `sudo ./svc.sh status` · 로그: `journalctl -u 'actions.runner.*' -f`
- runner는 새 버전이 나오면 스스로 갱신한다. 수동 갱신이 필요하면 `sudo ./svc.sh stop` 뒤 같은 절차로 다시 설치한다.
- 공개 저장소의 self-hosted runner 보호: 저장소 Actions 설정에서 **외부 기여자 PR 워크플로는 전부 승인제**, 허용 액션은 **GitHub 제작·검증된 것만**. 이 워크플로는 `pull_request`에 반응하지 않는다.

## 로컬에서 같은 이미지 확인

```sh
docker build -f deploy/jun/Dockerfile -t sunny-web:local frontend
docker run --rm -d --name sunny-local -p 3000:3000 sunny-web:local
node deploy/jun/verify-runtime.mjs http://127.0.0.1:3000
docker rm -f sunny-local
```
