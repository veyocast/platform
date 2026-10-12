#!/usr/bin/env bash
set -Eeuo pipefail

: "${PLAYER_ORIGIN:?PLAYER_ORIGIN ontbreekt}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL ontbreekt}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY ontbreekt}"

case "${PLAYER_ORIGIN}" in
  https://staging-player.veyocast.nl|https://player.veyocast.nl) ;;
  *)
    echo "Onverwachte Player-origin voor pairing-smoke" >&2
    exit 64
    ;;
esac

umask 077
work_dir="$(mktemp -d)"
installation_id="$(tr -d '-' < /proc/sys/kernel/random/uuid)"
installation_hash="$(printf '%s' "${installation_id}" | sha256sum | cut -d' ' -f1)"

failure() {
  local phase=$1 code=$2 exit_code=$3 http_status=${4:-0}
  case "$phase" in installation|pairing|recovery|lg_recovery|cleanup) ;; *) phase=unknown ;; esac
  case "$code" in HTTP_REQUEST_FAILED|RESPONSE_INVALID|CONTENT_INVALID) ;; *) code=RESPONSE_INVALID ;; esac
  printf '{"event":"player_pairing_smoke_failed","phase":"%s","code":"%s","httpStatus":%s,"exitCode":%s}\n' \
    "$phase" "$code" "$http_status" "$exit_code" >&2
}

request() {
  local phase=$1 output=$2 http_status exit_code http_number=0
  shift 2
  if http_status=$(curl \
    --fail-with-body --silent --show-error \
    --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 30 \
    --output "$output" --write-out '%{http_code}' "$@" 2>/dev/null); then
    return 0
  else
    exit_code=$?
  fi
  if [[ "$http_status" =~ ^[0-9]{3}$ ]]; then http_number=$((10#$http_status)); fi
  failure "$phase" HTTP_REQUEST_FAILED "$exit_code" "$http_number"
  return "$exit_code"
}

cleanup() {
  local command_status=$?
  local cleanup_status=0
  trap - EXIT
  set +e
  request cleanup /dev/null \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    --data "{\"p_installation_id_hash\":\"${installation_hash}\"}" \
    "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/rpc/cleanup_player_pairing_smoke_v1"
  cleanup_status=$?
  rm -rf "${work_dir}"
  if (( command_status == 0 && cleanup_status != 0 )); then command_status=$cleanup_status; fi
  if (( command_status == 0 )); then
    echo "Pairing- en LG-recovery-smoke geslaagd voor ${PLAYER_ORIGIN}"
  fi
  exit "$command_status"
}
trap cleanup EXIT

request installation "${work_dir}/installation.json" \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data "{\"installationId\":\"${installation_id}\"}" \
  "${PLAYER_ORIGIN}/api/player/installation"

if installation_credential="$(
  node -e '
    const fs = require("node:fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (
      body.ok !== true ||
      body.live !== true ||
      !/^[A-Za-z0-9_-]{20,200}$/.test(body.installationCredential || "")
    ) process.exit(1);
    process.stdout.write(body.installationCredential);
  ' "${work_dir}/installation.json" 2>/dev/null
)"; then :; else
  failure installation RESPONSE_INVALID 1
  exit 1
fi

request_nonce="$(tr -d '-' < /proc/sys/kernel/random/uuid)"
request pairing "${work_dir}/pairing.json" \
  --header 'Accept: application/json' \
  --header "X-VeyoCast-Installation-Credential: ${installation_credential}" \
  --header "X-VeyoCast-Pairing-Request: ${request_nonce}" \
  --header "X-VeyoCast-Player-Instance: ${installation_id}" \
  --request POST \
  "${PLAYER_ORIGIN}/api/player/pairing"

if node -e '
  const fs = require("node:fs");
  const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (
    body.live !== true ||
    !/^[A-Z2-9]{3} [A-Z2-9]{3}$/.test(body.pairingCode || "") ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(body.deviceToken || "") ||
    !Number.isFinite(Date.parse(body.expiresAt || "")) ||
    Date.parse(body.expiresAt) <= Date.now()
  ) process.exit(1);
' "${work_dir}/pairing.json" 2>/dev/null; then :; else
  failure pairing RESPONSE_INVALID 1
  exit 1
fi

request recovery "${work_dir}/recovery.json" \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header "X-VeyoCast-Installation-Credential: ${installation_credential}" \
  --data "{\"installationId\":\"${installation_id}\",\"mode\":\"soft\"}" \
  "${PLAYER_ORIGIN}/api/player/pairing/recover"

if node -e '
  const fs = require("node:fs");
  const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (
    body.ok !== true ||
    body.live !== true ||
    body.cancelledPendingPairing !== true ||
    body.bindingState !== "UNPAIRED"
  ) process.exit(1);
' "${work_dir}/recovery.json" 2>/dev/null; then :; else
  failure recovery RESPONSE_INVALID 1
  exit 1
fi

request lg_recovery "${work_dir}/lg-recover.html" \
  "${PLAYER_ORIGIN}/lg/recover"
if ! grep -Fq 'VeyoCast Player herstellen' "${work_dir}/lg-recover.html" ||
   ! grep -Fq '"/api/player/installation"' "${work_dir}/lg-recover.html" ||
   ! grep -Fq '"/api/player/pairing"' "${work_dir}/lg-recover.html"; then
  failure lg_recovery CONTENT_INVALID 1
  exit 1
fi
if grep -Fq '/_next/' "${work_dir}/lg-recover.html"; then
  failure lg_recovery CONTENT_INVALID 1
  exit 1
fi

: # The EXIT trap reports success only after authenticated cleanup.
