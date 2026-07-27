#!/usr/bin/env bash
set -Eeuo pipefail

: "${PLAYER_ORIGIN:?PLAYER_ORIGIN ontbreekt}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL ontbreekt}"

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
  psql "${SUPABASE_DB_URL}" \
    --set ON_ERROR_STOP=1 \
    --set "installation_hash=${installation_hash}" \
    <<'SQL'
begin;
delete from private.player_pairing_events event
using public.player_installations installation
where event.installation_id = installation.id
  and installation.public_identifier_hash = :'installation_hash';
delete from private.player_pairing_recovery_events
where installation_id_hash = :'installation_hash';
delete from private.pairing_creation_attempts
where fingerprint_hash = :'installation_hash';
delete from public.pairing_sessions pairing
using public.player_installations installation
where pairing.installation_id = installation.id
  and installation.public_identifier_hash = :'installation_hash';
delete from public.player_installations
where public_identifier_hash = :'installation_hash';
commit;
SQL
  rm -rf "${work_dir}"
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
