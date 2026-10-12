#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

event() {
  printf '{"event":"quiesced_worker_probe","phase":"%s","code":"%s"}\n' "$1" "$2" >&2
}
fail() { event "$1" "$2"; exit "${3:-1}"; }

# Validate all caller-controlled scope before filesystem, Docker or probe work.
[[ $# == 4 ]] || fail scope PROBE_SCOPE_INVALID 2
case "$1" in
  publication) entrypoint=probe-publication-runtime.mjs; probe_ceiling=190 ;;
  runtime) entrypoint=probe-runtime-database.mjs; probe_ceiling=80 ;;
  *) fail scope PROBE_SCOPE_INVALID 2 ;;
esac
target=$2
revision=$3
tenant=$4
[[ $target =~ ^(staging|production)$ && $revision =~ ^[0-9a-f]{40}$ \
  && $tenant =~ ^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$ \
  && ${GITHUB_REF:-} == refs/heads/main ]] || fail scope PROBE_SCOPE_INVALID 2
[[ ${QUIESCED_PROBE_JOB_STARTED_AT:-} =~ ^[1-9][0-9]{0,9}$ ]] \
  || fail budget PROBE_JOB_BUDGET_UNPROVEN

for tool in docker timeout setsid node bash flock mkdir stat sleep date; do
  command -v "$tool" >/dev/null 2>&1 || fail toolchain PROBE_TOOLCHAIN_UNAVAILABLE
done
script_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
project="veyocast-${target}-worker"
lock_root="/tmp/veyocast-quiesced-worker-${UID}"
if ! mkdir -m 700 -- "$lock_root" 2>/dev/null; then
  [[ -d $lock_root && ! -L $lock_root ]] || fail lock PROBE_LOCK_UNPROVEN
fi
[[ ! -L $lock_root && $(stat -c '%u %a' -- "$lock_root" 2>/dev/null) == "$UID 700" ]] \
  || fail lock PROBE_LOCK_UNPROVEN
lock_file="${lock_root}/${target}.lock"
[[ ! -L $lock_file && ( ! -e $lock_file || -f $lock_file ) ]] || fail lock PROBE_LOCK_UNPROVEN
if ! { exec 9>> "$lock_file"; } 2>/dev/null; then fail lock PROBE_LOCK_UNPROVEN; fi
flock -n 9 2>/dev/null || fail lock PROBE_QUIESCE_BUSY 75

worker_id=""
stop_confirmed=false
probe_pid=""
watchdog_pid=""

docker_read() { timeout --kill-after=1s 3s docker "$@" 9>&- 2>/dev/null; }
docker_stop() { timeout --kill-after=1s 23s docker stop --time 20 "$worker_id" 9>&- >/dev/null 2>&1; }

# Cleanup functions are reached through the EXIT trap, including INT/TERM.
# shellcheck disable=SC2317
stop_owned_diagnostic() {
  if [[ -n $watchdog_pid ]]; then
    kill -TERM -- "-${watchdog_pid}" 2>/dev/null || true
    wait "$watchdog_pid" 2>/dev/null || true
  fi
  if [[ -n $probe_pid ]]; then
    kill -TERM -- "-${probe_pid}" 2>/dev/null || true
    # Fixed entrypoints abort their separately owned SQL groups on SIGTERM.
    # Bound the remaining caller lifetime too, including an unresponsive caller.
    for ((attempt = 0; attempt < 40; attempt++)); do
      kill -0 "$probe_pid" 2>/dev/null || break
      sleep 0.05
    done
    kill -KILL -- "-${probe_pid}" 2>/dev/null || true
    wait "$probe_pid" 2>/dev/null || true
  fi
}

# shellcheck disable=SC2317
restore_worker() {
  local failed=false running
  [[ -n $worker_id ]] || return 0
  # A failed/interrupted first stop can leave a daemon-side drain in progress.
  # Complete that bounded stop before the single start; never start a new ID.
  if [[ $stop_confirmed != true ]]; then
    docker_stop || failed=true
    running=$(docker_read inspect --format '{{.State.Running}}' "$worker_id") || running=unknown
    [[ $running == false ]] || failed=true
  fi
  # During a diagnostic cancellation this is the first external cleanup action,
  # before signaling or waiting for the diagnostic caller and its SQL children.
  timeout --kill-after=1s 7s docker start "$worker_id" 9>&- >/dev/null 2>&1 || failed=true
  running=$(docker_read inspect --format '{{.State.Running}}' "$worker_id") || running=unknown
  [[ $running == true ]] || failed=true
  [[ $failed == false ]]
}

# shellcheck disable=SC2317
on_exit() {
  local original_exit=$?
  trap - EXIT
  trap '' INT TERM USR1
  if [[ -n $worker_id ]]; then
    if restore_worker; then event restore PROBE_WORKER_RESTORED;
    else
      event restore PROBE_WORKER_RESTORE_FAILED
      (( original_exit != 0 )) || original_exit=1
    fi
  fi
  stop_owned_diagnostic
  exit "$original_exit"
}
trap on_exit EXIT
trap 'event cancellation PROBE_CANCELLED; exit 130' INT
trap 'event cancellation PROBE_CANCELLED; exit 143' TERM
trap 'event deadline PROBE_OPERATION_TIMEOUT; exit 124' USR1

if ! containers=$(docker_read ps --quiet --no-trunc \
  --filter "label=com.docker.compose.project=${project}" \
  --filter 'label=com.docker.compose.service=media-worker'); then
  fail discovery PROBE_WORKER_READ_FAILED
fi
[[ $containers =~ ^[0-9a-f]{64}$ ]] || fail discovery PROBE_WORKER_SCOPE_UNPROVEN
identity_format='{{.Id}}|{{.Config.Image}}|{{.State.Running}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}'
if ! identity=$(docker_read inspect --format "$identity_format" "$containers"); then
  fail identity PROBE_WORKER_READ_FAILED
fi
[[ $identity == "${containers}|veyocast-media-worker:${revision}|true|${project}|media-worker" ]] \
  || fail identity PROBE_WORKER_SCOPE_UNPROVEN

# The unchanged five-minute job also includes setup. Check its real remaining
# time immediately before arming any mutation, reserving 60 seconds for stop,
# restoration, owned-process cleanup and the final workflow artifact steps.
if ! now=$(date +%s 2>/dev/null) || [[ ! $now =~ ^[1-9][0-9]{0,9}$ ]]; then
  fail budget PROBE_JOB_BUDGET_UNPROVEN
fi
(( QUIESCED_PROBE_JOB_STARTED_AT <= now )) || fail budget PROBE_JOB_BUDGET_UNPROVEN
(( 300 - (now - QUIESCED_PROBE_JOB_STARTED_AT) >= probe_ceiling + 60 )) \
  || fail budget PROBE_JOB_BUDGET_INSUFFICIENT

# Arm restoration before stop: a nonzero client exit can still stop the worker.
worker_id=$containers
event stop PROBE_WORKER_STOPPING
docker_stop || fail stop PROBE_WORKER_STOP_FAILED
running=$(docker_read inspect --format '{{.State.Running}}' "$worker_id") || running=unknown
[[ $running == false ]] || fail stop PROBE_WORKER_STOP_UNPROVEN
stop_confirmed=true
event diagnostic PROBE_WORKER_QUIESCED

setsid node "${script_root}/${entrypoint}" "$target" "$revision" "$tenant" 9>&- 2>/dev/null &
probe_pid=$!
# Positional parameters belong to the fixed child program, not this shell.
# shellcheck disable=SC2016
setsid bash -c 'sleep "$1"; kill -USR1 "$2"' -- "$probe_ceiling" "$$" 9>&- >/dev/null 2>&1 &
watchdog_pid=$!
diagnostic_exit=0
wait "$probe_pid" || diagnostic_exit=$?
event diagnostic PROBE_DIAGNOSTIC_FINISHED
exit "$diagnostic_exit"
