#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# != 1 )); then
  echo "Gebruik: $0 <bewijsmap>" >&2
  exit 64
fi

evidence_dir="$(realpath "$1")"
package_name="nl.veyocast.player"
activity_name="nl.veyocast.player.MainActivity"
expected_component="${package_name}/${activity_name}"
resolve_output="${evidence_dir}/adb-resolve-activity.txt"
start_output="${evidence_dir}/adb-start.txt"
logcat_output="${evidence_dir}/adb-logcat.txt"

install -d -m 0755 "${evidence_dir}"
adb wait-for-device
adb shell pm clear "${package_name}" >/dev/null 2>&1 || true

normalize_component() {
  local component="$1"
  local package_part="${component%%/*}"
  local class_part="${component#*/}"
  if [[ "${class_part}" == .* ]]; then
    class_part="${package_part}${class_part}"
  fi
  printf '%s/%s\n' "${package_part}" "${class_part}"
}

adb shell cmd package resolve-activity \
  --brief \
  -a android.intent.action.MAIN \
  -c android.intent.category.LEANBACK_LAUNCHER \
  "${package_name}" \
  | tr -d '\r' \
  | tee "${resolve_output}"

resolved_component="$(normalize_component "$(tail -n 1 "${resolve_output}")")"
if [[ "${resolved_component}" != "${expected_component}" ]]; then
  echo "Package Manager resolveerde ${resolved_component@Q}, verwacht ${expected_component@Q}" >&2
  adb logcat -d -v threadtime > "${logcat_output}" || true
  exit 1
fi

adb logcat -c
adb shell am start -W \
  -a android.intent.action.MAIN \
  -c android.intent.category.LEANBACK_LAUNCHER \
  -p "${package_name}" \
  | tr -d '\r' \
  | tee "${start_output}"

adb logcat -d -v threadtime > "${logcat_output}"

grep -Fq "Status: ok" "${start_output}"
started_component="$(
  sed -n 's/^Activity: //p' "${start_output}" \
    | tail -n 1
)"
if [[ -z "${started_component}" ]] || [[ "$(normalize_component "${started_component}")" != "${expected_component}" ]]; then
  echo "Activity Manager startte ${started_component@Q}, verwacht ${expected_component@Q}" >&2
  exit 1
fi

if grep -Eq 'ClassNotFoundException|Unable to instantiate activity|Activity class .* does not exist|FATAL EXCEPTION' "${logcat_output}"; then
  echo "Logcat bevat een fatale launcher- of klasseladerfout" >&2
  exit 1
fi

adb shell dumpsys activity activities \
  | grep -F "${package_name}" \
  | grep -F "MainActivity" \
  > "${evidence_dir}/adb-running-activity.txt"

echo "Leanback-launcher start succesvol: ${expected_component}"
