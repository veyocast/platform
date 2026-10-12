#!/usr/bin/env bash
set -Eeuo pipefail

# Keep SDK bootstrapping explicit: the pinned action's default contains the
# retired "tools" package. Platform/build-tools versions remain in sdkmanager
# steps; every bootstrap installs only the supported platform-tools package.
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const androidAction = "android-actions/setup-android@40fd30fb8d7440372e1316f5d1809ec01dcd3699";

function validateAndroidSdkPackages(source, path) {
  const lines = source.split(/\r?\n/);
  let count = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^( *)(- )?uses:/.test(lines[index]) || !lines[index].includes("android-actions/setup-android@")) continue;
    const match = lines[index].match(/^( *)(- )?uses:\s*(['"]?)(android-actions\/setup-android@[^\s#'"]+)\3(?:\s*#.*)?$/);
    assert.ok(match, `${path}: Android SDK setup must use an explicit reviewed action reference.`);
    assert.equal(match[4], androidAction, `${path}: Android SDK action must retain its reviewed SHA.`);
    const fieldIndent = match[1].length + (match[2] ? 2 : 0);
    const stepIndent = fieldIndent - 2;
    let start = index;
    while (start > 0 && !new RegExp(`^ {${stepIndent}}- `).test(lines[start])) start -= 1;
    let end = index + 1;
    while (end < lines.length) {
      if (lines[end].trim() && !lines[end].trimStart().startsWith("#") &&
          lines[end].search(/\S/) <= stepIndent) break;
      end += 1;
    }
    const step = lines.slice(start, end);
    const withIndex = step.findIndex((line) => new RegExp(`^ {${fieldIndent}}with:\\s*(?:#.*)?$`).test(line));
    assert.ok(withIndex >= 0, `${path}: Android SDK setup requires explicit with.packages.`);
    const inputs = [];
    for (const line of step.slice(withIndex + 1)) {
      if (line.trim() && !line.trimStart().startsWith("#") && line.search(/\S/) <= fieldIndent) break;
      inputs.push(line);
    }
    const packages = inputs.filter((line) => new RegExp(`^ {${fieldIndent + 2}}packages:`).test(line));
    assert.equal(packages.length, 1, `${path}: Android SDK setup requires one explicit packages input.`);
    assert.match(packages[0], new RegExp(`^ {${fieldIndent + 2}}packages:\\s*(?:platform-tools|"platform-tools"|'platform-tools')\\s*(?:#.*)?$`),
      `${path}: Android SDK bootstrap packages must be platform-tools; action defaults and retired tools are forbidden.`);
    count += 1;
  }
  return count;
}

// Test the guard against the actual failure and a neighboring-step false pass.
const action = `      - name: SDK\n        uses: ${androidAction}\n`;
assert.equal(validateAndroidSdkPackages(`${action}        with:\n          packages: platform-tools\n`, "valid fixture"), 1);
assert.equal(validateAndroidSdkPackages(`      - uses: ${androidAction}\n        with:\n          packages: 'platform-tools'\n`, "unnamed fixture"), 1);
assert.equal(validateAndroidSdkPackages(`      - name: SDK\n        with:\n          packages: platform-tools\n        uses: "${androidAction}"\n`, "quoted action and reordered fields fixture"), 1);
for (const [label, fixture] of [
  ["missing inputs", action],
  ["missing packages", `${action}        with:\n          accept-android-sdk-licenses: true\n`],
  ["retired tools", `${action}        with:\n          packages: tools platform-tools\n`],
  ["empty packages", `${action}        with:\n          packages: ''\n`],
  ["neighboring step", `${action}      - name: Other step\n        with:\n          packages: platform-tools\n`]
]) {
  assert.throws(() => validateAndroidSdkPackages(fixture, label), { name: "AssertionError" });
}

let validated = 0;
for (const name of (await readdir(".github/workflows")).filter((name) => /\.ya?ml$/.test(name)).sort()) {
  const path = `.github/workflows/${name}`;
  validated += validateAndroidSdkPackages(await readFile(path, "utf8"), path);
}
assert.ok(validated > 0, "Android SDK setup actions must be present and checked.");
console.log(`Android SDK setup: ${validated} explicit supported package declarations; five rejection fixtures passed.`);
NODE

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
shopt -s nullglob
workflow_paths=(.github/workflows/*.yml .github/workflows/*.yaml)
if (( ${#workflow_paths[@]} == 0 )); then
  echo 'No GitHub Actions workflows found.' >&2
  exit 1
fi
for workflow_path in "${workflow_paths[@]}"; do
  timeout 120s env GOMAXPROCS=2 "${validation_root}/actionlint" -color -shellcheck "$(command -v shellcheck)" "${workflow_path}"
done
node scripts/validate-deploy-workflow-security.mjs
node scripts/validate-royal-current-theme-reset-workflow.mjs
