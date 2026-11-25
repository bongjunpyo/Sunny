#!/usr/bin/env bash
# SUNNY 공개 사이트(jun) 릴리스 도구. GitHub Actions self-hosted runner가 부른다.
#   release.sh build    <image>   메모리 제한 빌더로 이미지 빌드
#   release.sh verify   <image>   임시 컨테이너(sunny-web-review)로 연기 테스트
#   release.sh activate <image>   compose.yml의 web image 한 줄을 바꿔 sunny-web 교체, 실패 시 복구
#   release.sh prune              오래된 sunny-web 이미지·빌드 캐시 정리
set -Eeuo pipefail
cmd=${1:?build|verify|activate|prune}
image=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
base=${SUNNY_SERVICE_DIR:-/home/jp/stdrd-infra/sunny}
builder=${SUNNY_BUILDER:-sunny-builder}
keep=${SUNNY_KEEP_IMAGES:-3}
review=sunny-web-review

log() { printf '[release] %s\n' "$*"; }
need_image() { [ -n "$image" ] || { echo "image tag required" >&2; exit 2; }; }
compose() { docker compose -f "$base/compose.yml" "$@"; }
review_compose() { docker compose -p sunny-review -f "$base/compose.yml" -f "$here/review.override.yml" "$@"; }
# override 파일이 SUNNY_REVIEW_IMAGE를 요구하므로 내릴 때도 값을 준다. 실패하면 컨테이너를 직접 지운다.
review_down() {
  SUNNY_REVIEW_IMAGE=${image:-none} review_compose down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f "$review" >/dev/null 2>&1 || true
}
ready() {
  local name=$1 i
  for i in $(seq 1 60); do
    if docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  log "$name did not become ready"; docker logs --tail 50 "$name" >&2 || true
  return 1
}
smoke() {
  docker cp "$here/verify-runtime.mjs" "$1:/tmp/sunny-verify.mjs"
  docker exec "$1" node /tmp/sunny-verify.mjs
}

case "$cmd" in
  build)
    need_image
    if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
      docker buildx create --name "$builder" --driver docker-container \
        --driver-opt memory=2000m --driver-opt memory-swap=2800m >/dev/null
    fi
    log "build $image"
    docker buildx build --builder "$builder" --load --pull \
      -f "$here/Dockerfile" -t "$image" "$here/../../frontend"
    ;;

  verify)
    need_image
    review_down
    trap review_down EXIT
    log "review container from $image"
    SUNNY_REVIEW_IMAGE="$image" review_compose up -d --no-build --force-recreate web
    ready "$review"
    smoke "$review"
    log "verify passed"
    ;;

  activate)
    need_image
    rel="$base/releases/$(date +%Y%m%d-%H%M%S)-${image##*:}"
    mkdir -p "$rel"
    cp -p "$base/compose.yml" "$rel/compose.before.yml"
    # web 서비스의 image: 한 줄만 바꾼다. 다른 서비스가 생겨도 건드리지 않는다.
    awk -v img="$image" '
      /^[[:space:]]+web:[[:space:]]*$/ { inweb = 1 }
      inweb && /^[[:space:]]+image:/ { sub(/image:.*/, "image: " img); inweb = 0 }
      { print }' "$rel/compose.before.yml" > "$rel/compose.next.yml"
    changed=$(diff "$rel/compose.before.yml" "$rel/compose.next.yml" | grep -c '^>' || true)
    [ "$changed" -eq 1 ] || { echo "expected exactly one changed line in compose.yml, got $changed" >&2; exit 1; }
    docker compose -f "$rel/compose.next.yml" config --quiet
    docker inspect sunny-web --format '{{.Config.Image}}' > "$rel/previous-image.txt" 2>/dev/null || echo none > "$rel/previous-image.txt"
    rollback() {
      log "activation failed — restoring $(cat "$rel/previous-image.txt")"
      cp "$rel/compose.before.yml" "$base/compose.yml"
      compose up -d --no-build web || true
    }
    trap rollback ERR
    cp "$rel/compose.next.yml" "$base/compose.yml"
    compose up -d --no-build web
    ready sunny-web
    smoke sunny-web
    trap - ERR
    printf '{"image":"%s","previous":"%s","activated_at":"%s"}\n' \
      "$image" "$(cat "$rel/previous-image.txt")" "$(date -Is)" > "$rel/release.json"
    log "active image: $(docker inspect sunny-web --format '{{.Config.Image}}')"
    ;;

  prune)
    active=$(docker inspect sunny-web --format '{{.Config.Image}}' 2>/dev/null || true)
    docker images stdrd/sunny-web --format '{{.Repository}}:{{.Tag}}' | grep -v '<none>' | tail -n +$((keep + 1)) \
      | while read -r tag; do
          if [ "$tag" != "$active" ]; then
            docker image rm "$tag" >/dev/null && log "removed $tag"
          fi
        done
    docker buildx prune --builder "$builder" --keep-storage 3GB -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    ;;

  *)
    echo "unknown command: $cmd" >&2; exit 2 ;;
esac
