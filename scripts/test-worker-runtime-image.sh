#!/usr/bin/env bash
set -Eeuo pipefail

image="veyocast-worker-runtime-test:${GITHUB_SHA:-local}"
docker build --file infra/production/Dockerfile --target media-worker --tag "$image" .
docker image inspect --format '{"event":"worker_image_size","bytes":{{.Size}}}' "$image"
docker run --rm --interactive --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --tmpfs /tmp:rw,nosuid,size=256m \
  --env HOME=/tmp --env XDG_CACHE_HOME=/tmp/.cache \
  "$image" node --import tsx --input-type=module < scripts/smoke-worker-runtime.mjs
