#!/usr/bin/env bash
set -Eeuo pipefail
fail() { printf '{"event":"build_capacity_failure","code":"%s"}\n' "$1" >&2; exit 1; }
[[ ${GITHUB_REPOSITORY:-} == veyocast/platform && ${GITHUB_REF:-} == refs/heads/main && ${RUNNER_NAME:-} == veyocast-staging-01 ]] || fail RUNNER_SCOPE_INVALID
[[ $(hostname -s) == dg-deploy-vps-01 && $(id -un) == deploy ]] || fail RUNNER_IDENTITY_INVALID
minimum=12884901888
endpoint=${DOCKER_HOST:-}
if [[ -z "$endpoint" ]]; then endpoint=$(docker context inspect --format '{{(index .Endpoints "docker").Host}}'); fi
[[ "$endpoint" == unix:///* ]] || fail LOCAL_SOCKET_REQUIRED
socket=${endpoint#unix://}
[[ "$socket" != /var/run/docker.sock && -S "$socket" && $(stat -c %u "$socket") == "$(id -u)" ]] || fail SOCKET_OWNER_INVALID
unset DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH BUILDKIT_HOST
export DOCKER_HOST="$endpoint" BUILDX_BUILDER=default
dc() { docker --host "$endpoint" "$@"; }
[[ $(dc info --format '{{json .SecurityOptions}}') == *rootless* ]] || fail ROOTLESS_DAEMON_REQUIRED
builder=$(dc buildx inspect default)
[[ $(awk '$1 == "Driver:" {print $2}' <<< "$builder") == docker ]] || fail DAEMON_BUILDER_REQUIRED
builder_endpoint=$(awk '$1 == "Endpoint:" {print $2}' <<< "$builder")
if [[ "$builder_endpoint" == default ]]; then builder_endpoint=$(dc context inspect default --format '{{(index .Endpoints "docker").Host}}'); fi
[[ "$builder_endpoint" == "$endpoint" ]] || fail BUILDER_ENDPOINT_MISMATCH
docker_root=$(dc info --format '{{.DockerRootDir}}')
[[ "$docker_root" =~ ^/[A-Za-z0-9_./-]+$ && -d "$docker_root" ]] || fail DOCKER_ROOT_INVALID
available() {
  local bytes
  bytes=$(df --block-size=1 --output=avail "$1" | tail -n 1 | tr -d '[:space:]')
  [[ "$bytes" =~ ^[0-9]+$ ]] || fail SPACE_READ_INVALID
  printf '%s\n' "$bytes"
}
measure() {
  checkout_available=$(available "$PWD")
  docker_available=$(available "$docker_root")
  printf '{"event":"build_capacity","phase":"%s","checkoutAvailableBytes":%s,"dockerAvailableBytes":%s,"minimumBytes":%s}\n' "$1" "$checkout_available" "$docker_available" "$minimum"
}
fingerprint() {
  case "$1" in
    images) dc image ls --all --no-trunc --quiet ;;
    containers) dc ps --all --no-trunc --quiet ;;
    volumes) dc volume ls --quiet ;;
    *) fail FINGERPRINT_SCOPE_INVALID ;;
  esac | sort -u | sha256sum | awk '{print $1}'
}
measure before
if (( checkout_available < minimum || docker_available < minimum )); then
  pattern='(^|[[:space:]/])(docker([[:space:]]+[^[:space:]]+)*[[:space:]]+(build|bake)|docker-buildx([[:space:]]+[^[:space:]]+)*[[:space:]]+(build|bake)|buildctl([[:space:]]+[^[:space:]]+)*[[:space:]]+build|pnpm([[:space:]]+[^[:space:]]+)*[[:space:]]+build)([[:space:]]|$)'
  if pgrep -u "$(id -u)" -f "$pattern" >/dev/null; then fail ACTIVE_BUILD_PROCESS; else [[ $? == 1 ]] || fail PROCESS_READ_INVALID; fi
  images=$(fingerprint images)
  containers=$(fingerprint containers)
  volumes=$(fingerprint volumes)
  dc buildx prune --builder default --force --filter until=1h
  [[ "$images" == "$(fingerprint images)" && "$containers" == "$(fingerprint containers)" && "$volumes" == "$(fingerprint volumes)" ]] || fail PROTECTED_RESOURCES_CHANGED
  measure after
fi
(( checkout_available >= minimum && docker_available >= minimum )) || fail INSUFFICIENT_BUILD_HEADROOM
printf '{"event":"build_capacity_ready","imagesPreserved":true,"containersPreserved":true,"volumesPreserved":true}\n'
