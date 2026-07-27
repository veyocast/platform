#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# < 3 || $# > 4 )); then
  echo "Gebruik: $0 <tv-aab> <bundletool-jar> <dexdump> [bewijsmap]" >&2
  exit 64
fi

bundle_path="$(realpath "$1")"
bundletool_path="$(realpath "$2")"
dexdump_path="$(realpath "$3")"
evidence_dir="${4:-$(mktemp -d)}"
expected_package="nl.veyocast.player"

test -s "${bundle_path}"
test -s "${bundletool_path}"
test -x "${dexdump_path}"
install -d -m 0755 "${evidence_dir}"
evidence_dir="$(realpath "${evidence_dir}")"

manifest_path="${evidence_dir}/tv-production-manifest.xml"
launcher_report="${evidence_dir}/tv-launcher-report.txt"
dex_report="${evidence_dir}/tv-dex-report.txt"
dex_dir="${evidence_dir}/dex"

java -jar "${bundletool_path}" dump manifest \
  --bundle="${bundle_path}" \
  --module=base \
  > "${manifest_path}"

python3 - "${manifest_path}" "${launcher_report}" "${expected_package}" <<'PY'
import sys
import xml.etree.ElementTree as ET

manifest_path, report_path, expected_package = sys.argv[1:]
android = "{http://schemas.android.com/apk/res/android}"
root = ET.parse(manifest_path).getroot()
package_name = root.attrib.get("package")
if package_name != expected_package:
    raise SystemExit(
        f"Onjuiste applicationId: {package_name!r}; verwacht {expected_package!r}"
    )

application = root.find("application")
if application is None:
    raise SystemExit("Productionmanifest bevat geen application")

permissions = {
    permission.attrib.get(android + "name")
    for permission in root.findall("uses-permission")
}
if "android.permission.RECEIVE_BOOT_COMPLETED" not in permissions:
    raise SystemExit("TV-bundle mist RECEIVE_BOOT_COMPLETED")

def normalized_component_name(component):
    name = component.attrib.get(android + "name", "")
    if name.startswith("."):
        return package_name + name
    if "." not in name:
        return package_name + "." + name
    return name

receivers = {
    normalized_component_name(receiver): receiver
    for receiver in application.findall("receiver")
}
boot_receiver = receivers.get("nl.veyocast.player.BootCompletedReceiver")
verification_receiver = receivers.get(
    "nl.veyocast.player.AutomationLaunchVerificationReceiver"
)
if boot_receiver is None or verification_receiver is None:
    raise SystemExit("TV-bundle mist boot- of zichtbaarheidverificatiereceiver")
if boot_receiver.attrib.get(android + "exported") != "false":
    raise SystemExit("Bootreceiver moet exported=false blijven")
if verification_receiver.attrib.get(android + "exported") != "false":
    raise SystemExit("Zichtbaarheidverificatiereceiver moet exported=false blijven")
boot_actions = {
    action.attrib.get(android + "name")
    for intent_filter in boot_receiver.findall("intent-filter")
    for action in intent_filter.findall("action")
}
for required_action in (
    "android.intent.action.BOOT_COMPLETED",
    "android.intent.action.MY_PACKAGE_REPLACED",
):
    if required_action not in boot_actions:
        raise SystemExit(f"Bootreceiver mist {required_action}")

main_components = []
launcher_categories = []
leanback_components = []
for tag in ("activity", "activity-alias"):
    for component in application.findall(tag):
        filters = component.findall("intent-filter")
        for intent_filter in filters:
            actions = {
                action.attrib.get(android + "name")
                for action in intent_filter.findall("action")
            }
            categories = {
                category.attrib.get(android + "name")
                for category in intent_filter.findall("category")
            }
            if "android.intent.action.MAIN" in actions:
                main_components.append(component)
            launcher_categories.extend(
                sorted(category for category in categories if category and category.endswith("LAUNCHER"))
            )
            if (
                "android.intent.action.MAIN" in actions
                and "android.intent.category.LEANBACK_LAUNCHER" in categories
            ):
                if "android.intent.category.DEFAULT" not in categories:
                    raise SystemExit(
                        "Leanback-launcher mist DEFAULT voor een impliciete Activity Manager-start"
                    )
                leanback_components.append(component)

if len(leanback_components) != 1:
    raise SystemExit(
        f"Verwacht exact één MAIN/LEANBACK_LAUNCHER; gevonden {len(leanback_components)}"
    )
if launcher_categories.count("android.intent.category.LEANBACK_LAUNCHER") != 1:
    raise SystemExit("LEANBACK_LAUNCHER moet exact eenmaal voorkomen")
if "android.intent.category.LAUNCHER" in launcher_categories:
    raise SystemExit("TV-bundle bevat ten onrechte een algemene LAUNCHER")

component = leanback_components[0]
activity_name = component.attrib.get(android + "name", "")
if not activity_name:
    raise SystemExit("Leanback-launcher mist android:name")
if activity_name.startswith("."):
    activity_name = package_name + activity_name
elif "." not in activity_name:
    activity_name = package_name + "." + activity_name
if activity_name != "nl.veyocast.player.MainActivity":
    raise SystemExit(f"Onverwachte Leanback Activity: {activity_name}")

exported = component.attrib.get(android + "exported")
enabled = component.attrib.get(android + "enabled", "true")
if exported != "true":
    raise SystemExit(f"Leanback Activity is niet exported=true: {exported!r}")
if enabled != "true":
    raise SystemExit(f"Leanback Activity is niet enabled=true: {enabled!r}")

version_code = root.attrib.get(android + "versionCode", "")
if not version_code.isdigit() or not 200_000_000 <= int(version_code) <= 299_999_999:
    raise SystemExit(f"TV-versionCode valt buiten de gereserveerde range: {version_code!r}")

with open(report_path, "w", encoding="utf-8") as report:
    report.write(f"applicationId={package_name}\n")
    report.write(f"versionCode={version_code}\n")
    report.write(f"mainComponents={len(set(map(id, main_components)))}\n")
    report.write("launcherCategories=" + ",".join(launcher_categories) + "\n")
    report.write("leanbackLaunchers=1\n")
    report.write(f"resolvedActivity={activity_name}\n")
    report.write(f"exported={exported}\n")
    report.write(f"enabled={enabled}\n")
    report.write("bootRecoveryContract=true\n")
PY

rm -rf "${dex_dir}"
install -d -m 0755 "${dex_dir}"
while IFS= read -r dex_entry; do
  unzip -p "${bundle_path}" "${dex_entry}" > "${dex_dir}/$(basename "${dex_entry}")"
done < <(unzip -Z1 "${bundle_path}" | grep -E '^base/dex/classes([0-9]*)?\.dex$')

if ! compgen -G "${dex_dir}/classes*.dex" > /dev/null; then
  echo "Productionbundle bevat geen base DEX" >&2
  exit 1
fi

: > "${dex_report}"
for dex_file in "${dex_dir}"/classes*.dex; do
  "${dexdump_path}" -f "${dex_file}" >> "${dex_report}"
  "${dexdump_path}" -d "${dex_file}" >> "${dex_report}"
done

if ! grep -Fq "Class descriptor  : 'Lnl/veyocast/player/MainActivity;'" "${dex_report}"; then
  echo "nl.veyocast.player.MainActivity ontbreekt in de production-DEX" >&2
  exit 1
fi

if ! grep -Fq "Class descriptor  : 'Lnl/veyocast/player/BootCompletedReceiver;'" "${dex_report}"; then
  echo "nl.veyocast.player.BootCompletedReceiver ontbreekt in de production-DEX" >&2
  exit 1
fi
for class_name in \
  AutomationActivityLauncher \
  AutomationLaunchVerifier \
  AutomationLaunchVerificationReceiver; do
  if ! grep -Fq "Class descriptor  : 'Lnl/veyocast/player/${class_name};'" "${dex_report}"; then
    echo "nl.veyocast.player.${class_name} ontbreekt in de production-DEX" >&2
    exit 1
  fi
done

printf 'classExists=true\n' >> "${launcher_report}"
printf 'bundle=%s\n' "${bundle_path}" >> "${launcher_report}"
cat "${launcher_report}"
