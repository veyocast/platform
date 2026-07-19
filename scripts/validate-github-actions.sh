#!/usr/bin/env bash
set -Eeuo pipefail

actionlint_version=1.7.12
archive_name="actionlint_${actionlint_version}_linux_amd64.tar.gz"
expected_sha256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
validation_root="${RUNNER_TEMP:-/tmp}/veyocast-actionlint-${actionlint_version}-${UID}"
archive_path="${validation_root}/${archive_name}"

install -d -m 0755 "${validation_root}"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
  --output "${archive_path}" \
  "https://github.com/rhysd/actionlint/releases/download/v${actionlint_version}/${archive_name}"
printf '%s  %s\n' "${expected_sha256}" "${archive_path}" | sha256sum --check --status
tar --extract --gzip --file "${archive_path}" --directory "${validation_root}" actionlint
"${validation_root}/actionlint" -color -shellcheck "$(command -v shellcheck)"
node scripts/validate-deploy-workflow-security.mjs
