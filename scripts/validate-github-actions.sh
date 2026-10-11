#!/usr/bin/env bash
set -Eeuo pipefail

# v1.7.12 writes ShellCheck input before starting its reader. Long run blocks
# deadlock when the host has a small pipe buffer. Pin the upstream correction,
# retaining both Actionlint and ShellCheck rather than omitting either check.
actionlint_revision=fd33e9f582a01a02885c93ae3775e1190cf63653
actionlint_sha256=5f4039d0ef280ba0746ca39d5aabbaafff8f588df04466de0e49977b9deb819d
go_version=1.26.1
go_sha256=031f088e5d955bab8657ede27ad4e3bc5b7c1ba281f05f245bcc304f327c987a
validation_root="${RUNNER_TEMP:-/tmp}/veyocast-actionlint-${actionlint_revision}-${UID}"
install -d -m 0755 "${validation_root}/source"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
  --connect-timeout 10 --max-time 120 --output "${validation_root}/source.tar.gz" \
  "https://codeload.github.com/rhysd/actionlint/legacy.tar.gz/${actionlint_revision}"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
  --connect-timeout 10 --max-time 120 --output "${validation_root}/go.tar.gz" \
  "https://go.dev/dl/go${go_version}.linux-amd64.tar.gz"
printf '%s  %s\n' "${actionlint_sha256}" "${validation_root}/source.tar.gz" \
  "${go_sha256}" "${validation_root}/go.tar.gz" | sha256sum --check --status
tar --extract --gzip --file "${validation_root}/source.tar.gz" \
  --directory "${validation_root}/source" --strip-components=1
tar --extract --gzip --file "${validation_root}/go.tar.gz" --directory "${validation_root}"
(
  cd "${validation_root}/source"
  GOMAXPROCS=2 GOTOOLCHAIN=local GOCACHE="${validation_root}/build-cache" \
    GOMODCACHE="${validation_root}/module-cache" \
    "${validation_root}/go/bin/go" build -trimpath -o "${validation_root}/actionlint" ./cmd/actionlint
)
# Keep subprocess fan-out bounded on small CI/self-hosted runners. Validate every
# workflow separately with the same parser and ShellCheck; no rule is omitted.
mapfile -t workflow_paths < <(rg --files .github/workflows -g '*.yml' -g '*.yaml' | sort)
for workflow_path in "${workflow_paths[@]}"; do
  timeout 120s env GOMAXPROCS=2 "${validation_root}/actionlint" -color -shellcheck "$(command -v shellcheck)" "${workflow_path}"
done
node scripts/validate-deploy-workflow-security.mjs
node scripts/validate-royal-current-theme-reset-workflow.mjs
