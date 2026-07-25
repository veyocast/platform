#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
android_root="$(realpath "${script_dir}/..")"
bundle="${android_root}/tv/build/outputs/bundle/productionRelease/tv-production-release.aab"
evidence_dir="${RUNNER_TEMP:?RUNNER_TEMP ontbreekt}/tv-launcher-evidence"
store_password_file="${RUNNER_TEMP}/store-password.txt"
key_password_file="${RUNNER_TEMP}/key-password.txt"

: "${BUNDLETOOL_PATH:?BUNDLETOOL_PATH ontbreekt}"
: "${ANDROID_SIGNING_STORE_FILE:?ANDROID_SIGNING_STORE_FILE ontbreekt}"
: "${ANDROID_SIGNING_STORE_PASSWORD:?ANDROID_SIGNING_STORE_PASSWORD ontbreekt}"
: "${ANDROID_SIGNING_KEY_ALIAS:?ANDROID_SIGNING_KEY_ALIAS ontbreekt}"
: "${ANDROID_SIGNING_KEY_PASSWORD:?ANDROID_SIGNING_KEY_PASSWORD ontbreekt}"

cleanup() {
  rm -f "${store_password_file}" "${key_password_file}"
}
trap cleanup EXIT

test -s "${bundle}"
test -s "${BUNDLETOOL_PATH}"
test -s "${ANDROID_SIGNING_STORE_FILE}"
install -d -m 0755 "${evidence_dir}"
umask 077
printf '%s' "${ANDROID_SIGNING_STORE_PASSWORD}" > "${store_password_file}"
printf '%s' "${ANDROID_SIGNING_KEY_PASSWORD}" > "${key_password_file}"

java -jar "${BUNDLETOOL_PATH}" build-apks \
  --bundle="${bundle}" \
  --output="${evidence_dir}/tv-production-release.apks" \
  --ks="${ANDROID_SIGNING_STORE_FILE}" \
  --ks-pass="file:${store_password_file}" \
  --ks-key-alias="${ANDROID_SIGNING_KEY_ALIAS}" \
  --key-pass="file:${key_password_file}"

java -jar "${BUNDLETOOL_PATH}" install-apks \
  --apks="${evidence_dir}/tv-production-release.apks"

"${script_dir}/validate-tv-launcher-on-device.sh" "${evidence_dir}"
