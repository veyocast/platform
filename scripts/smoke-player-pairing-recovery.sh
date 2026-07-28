#!/usr/bin/env bash
set -Eeuo pipefail

: "${PLAYER_ORIGIN:?PLAYER_ORIGIN ontbreekt}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL ontbreekt}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY ontbreekt}"

case "${PLAYER_ORIGIN}" in
  https://staging-player.veyocast.nl|https://player.veyocast.nl) ;;
  *)
    echo "Onverwachte Player-origin voor pairing-smoke: ${PLAYER_ORIGIN}" >&2
    exit 64
    ;;
esac

work_dir="$(mktemp -d)"
installation_id="$(tr -d '-' < /proc/sys/kernel/random/uuid)"
installation_hash="$(printf '%s' "${installation_id}" | sha256sum | cut -d' ' -f1)"

cleanup() {
  local command_status=$?
  local cleanup_status=0
  trap - EXIT
  set +e

  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --proto '=https' \
    --tlsv1.2 \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    --data "{\"p_installation_id_hash\":\"${installation_hash}\"}" \
    "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/rpc/cleanup_player_pairing_smoke_v1" \
    > /dev/null
  cleanup_status=$?
  rm -rf "${work_dir}"

  if (( command_status == 0 && cleanup_status != 0 )); then
    command_status="${cleanup_status}"
  fi
  exit "${command_status}"
}
trap cleanup EXIT

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data "{\"installationId\":\"${installation_id}\"}" \
  "${PLAYER_ORIGIN}/api/player/installation" \
  > "${work_dir}/installation.json"

installation_credential="$(
  node -e '
    const fs = require("node:fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (
      body.ok !== true ||
      body.live !== true ||
      !/^[A-Za-z0-9_-]{20,200}$/.test(body.installationCredential || "")
    ) process.exit(1);
    process.stdout.write(body.installationCredential);
  ' "${work_dir}/installation.json"
)"

request_nonce="$(tr -d '-' < /proc/sys/kernel/random/uuid)"
curl \
  --fail-with-body \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  --header 'Accept: application/json' \
  --header "X-VeyoCast-Installation-Credential: ${installation_credential}" \
  --header "X-VeyoCast-Pairing-Request: ${request_nonce}" \
  --header "X-VeyoCast-Player-Instance: ${installation_id}" \
  --request POST \
  "${PLAYER_ORIGIN}/api/player/pairing" \
  > "${work_dir}/pairing.json"

node -e '
  const fs = require("node:fs");
  const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (
    body.live !== true ||
    !/^[A-Z2-9]{3} [A-Z2-9]{3}$/.test(body.pairingCode || "") ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(body.deviceToken || "") ||
    !Number.isFinite(Date.parse(body.expiresAt || "")) ||
    Date.parse(body.expiresAt) <= Date.now()
  ) process.exit(1);
' "${work_dir}/pairing.json"

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header "X-VeyoCast-Installation-Credential: ${installation_credential}" \
  --data "{\"installationId\":\"${installation_id}\",\"mode\":\"soft\"}" \
  "${PLAYER_ORIGIN}/api/player/pairing/recover" \
  > "${work_dir}/recovery.json"

node -e '
  const fs = require("node:fs");
  const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (
    body.ok !== true ||
    body.live !== true ||
    body.cancelledPendingPairing !== true ||
    body.bindingState !== "UNPAIRED"
  ) process.exit(1);
' "${work_dir}/recovery.json"

curl \
  --fail \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  "${PLAYER_ORIGIN}/lg/recover" \
  > "${work_dir}/lg-recover.html"
grep -Fq 'VeyoCast Player herstellen' "${work_dir}/lg-recover.html"
grep -Fq '"/api/player/installation"' "${work_dir}/lg-recover.html"
grep -Fq '"/api/player/pairing"' "${work_dir}/lg-recover.html"
if grep -Fq '/_next/' "${work_dir}/lg-recover.html"; then
  echo "LG-recoveryroute bevat onverwacht een Next-clientchunk" >&2
  exit 1
fi

echo "Pairing- en LG-recovery-smoke geslaagd voor ${PLAYER_ORIGIN}"
