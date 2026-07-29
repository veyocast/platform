#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
android_root="$(realpath "${script_dir}/..")"
source_root="${android_root}/app/src/main/java/nl/veyocast/player"
launcher="${source_root}/AutomationActivityLauncher.kt"
activity="${source_root}/MainActivity.kt"

test -s "${launcher}"
test -s "${activity}"

if ! grep -Fq "setAndAllowWhileIdle(" "${launcher}"; then
  echo "Autostart wordt niet via Androids systeemalarm afgeleverd" >&2
  exit 1
fi
if ! grep -Fq "AlarmManager.ELAPSED_REALTIME_WAKEUP" "${launcher}"; then
  echo "Autostart mist een wakeup-alarm op monotone tijd" >&2
  exit 1
fi
if grep -Fq "pendingIntent.send" "${launcher}"; then
  echo "Autostart mag de Activity-PendingIntent niet zelf versturen" >&2
  exit 1
fi
if ! grep -Fq "!activityResumed ||" "${activity}"; then
  echo "Een automationstart mag pas na onResume als zichtbaar gelden" >&2
  exit 1
fi

printf '%s\n' \
  "systemDeliveredActivity=true" \
  "selfSentActivity=false" \
  "visibleOnlyAfterResume=true"
