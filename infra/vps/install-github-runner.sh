#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Gebruik als root:
  install-github-runner.sh <staging|production> <repository-url> <registratietoken> <runner-versie> <sha256>

Voorbeeld:
  sudo infra/vps/install-github-runner.sh staging \
    https://github.com/veyocast/platform TOKEN 2.327.1 VERWACHTE_SHA256

Haal versie, download-URL, checksum en het kortlevende registratietoken uit:
GitHub repository > Settings > Actions > Runners > New self-hosted runner.
EOF
}

if [[ ${EUID} -ne 0 ]]; then
  echo "Voer dit script als root uit." >&2
  exit 1
fi

if [[ $# -ne 5 ]]; then
  usage >&2
  exit 1
fi

veyocast_environment=$1
repository_url=${2%/}
registration_token=$3
runner_version=$4
expected_sha256=$5

if [[ ${veyocast_environment} != "staging" && ${veyocast_environment} != "production" ]]; then
  echo "Omgeving moet staging of production zijn." >&2
  exit 1
fi

if [[ ! ${repository_url} =~ ^https://github\.com/[^/]+/[^/]+$ ]]; then
  echo "Gebruik een HTTPS GitHub repository-URL zonder extra pad." >&2
  exit 1
fi

if [[ ! ${runner_version} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Ongeldige runner-versie." >&2
  exit 1
fi

if [[ ! ${expected_sha256} =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Ongeldige SHA-256 checksum." >&2
  exit 1
fi

for required_command in curl sha256sum tar useradd usermod runuser; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Vereist commando ontbreekt: ${required_command}" >&2
    exit 1
  fi
done

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Installeer eerst Docker Engine en Docker Compose v2." >&2
  exit 1
fi

runner_user="veyocast-${veyocast_environment}"
runner_root="/opt/veyocast-runners/${veyocast_environment}"
runner_archive="/tmp/actions-runner-${veyocast_environment}-${runner_version}.tar.gz"
runner_url="https://github.com/actions/runner/releases/download/v${runner_version}/actions-runner-linux-x64-${runner_version}.tar.gz"
runner_name="veyocast-vps-${veyocast_environment}"

if ! id "${runner_user}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${runner_user}"
fi
usermod --append --groups docker "${runner_user}"

install -d -o "${runner_user}" -g "${runner_user}" -m 0750 "${runner_root}"
if [[ -e "${runner_root}/.runner" ]]; then
  echo "Runner ${veyocast_environment} is al geconfigureerd in ${runner_root}." >&2
  exit 1
fi

curl --fail --location --proto '=https' --tlsv1.2 --output "${runner_archive}" "${runner_url}"
printf '%s  %s\n' "${expected_sha256,,}" "${runner_archive}" | sha256sum --check --status
tar --extract --gzip --file "${runner_archive}" --directory "${runner_root}"
rm -f "${runner_archive}"
chown -R "${runner_user}:${runner_user}" "${runner_root}"

cd "${runner_root}"
runuser -u "${runner_user}" -- ./config.sh \
  --unattended \
  --url "${repository_url}" \
  --token "${registration_token}" \
  --name "${runner_name}" \
  --labels "veyocast-vps,${veyocast_environment}" \
  --work _work

unset registration_token
./svc.sh install "${runner_user}"
./svc.sh start

echo "Runner ${runner_name} is geïnstalleerd met labels veyocast-vps en ${veyocast_environment}."
