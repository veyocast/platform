#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# < 3 || $# > 4 )); then
  echo "Gebruik: $0 <algemene-aab> <bundletool-jar> <dexdump> [bewijsmap]" >&2
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

manifest_path="${evidence_dir}/general-production-manifest.xml"
compatibility_report="${evidence_dir}/general-compatibility-report.txt"
dex_report="${evidence_dir}/general-dex-report.txt"
dex_dir="${evidence_dir}/dex"

java -jar "${bundletool_path}" dump manifest \
  --bundle="${bundle_path}" \
  --module=base \
  > "${manifest_path}"

python3 - "${manifest_path}" "${compatibility_report}" "${expected_package}" <<'PY'
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

features = {
    feature.attrib.get(android + "name"): feature.attrib.get(android + "required", "true")
    for feature in root.findall("uses-feature")
}
for feature_name in (
    "android.software.leanback",
    "android.hardware.touchscreen",
    "android.hardware.type.television",
):
    if features.get(feature_name) == "true":
        raise SystemExit(
            f"Algemene bundle sluit telefoons/tablets uit via required feature {feature_name}"
        )

application = root.find("application")
if application is None:
    raise SystemExit("Productionmanifest bevat geen application")

general_launchers = []
leanback_launchers = []
for tag in ("activity", "activity-alias"):
    for component in application.findall(tag):
        for intent_filter in component.findall("intent-filter"):
            actions = {
                action.attrib.get(android + "name")
                for action in intent_filter.findall("action")
            }
            categories = {
                category.attrib.get(android + "name")
                for category in intent_filter.findall("category")
            }
            if (
                "android.intent.action.MAIN" in actions
                and "android.intent.category.LAUNCHER" in categories
            ):
                general_launchers.append(component)
            if (
                "android.intent.action.MAIN" in actions
                and "android.intent.category.LEANBACK_LAUNCHER" in categories
            ):
                leanback_launchers.append(component)

if len(general_launchers) != 1:
    raise SystemExit(
        f"Verwacht exact één algemene MAIN/LAUNCHER; gevonden {len(general_launchers)}"
    )

component = general_launchers[0]
activity_name = component.attrib.get(android + "name", "")
if not activity_name:
    raise SystemExit("Algemene launcher mist android:name")
if activity_name.startswith("."):
    activity_name = package_name + activity_name
elif "." not in activity_name:
    activity_name = package_name + "." + activity_name
if activity_name != "nl.veyocast.player.MainActivity":
    raise SystemExit(f"Onverwachte algemene Activity: {activity_name}")

exported = component.attrib.get(android + "exported")
enabled = component.attrib.get(android + "enabled", "true")
orientation = component.attrib.get(android + "screenOrientation", "")
if exported != "true":
    raise SystemExit(f"Algemene Activity is niet exported=true: {exported!r}")
if enabled != "true":
    raise SystemExit(f"Algemene Activity is niet enabled=true: {enabled!r}")
if orientation == "landscape":
    raise SystemExit("Algemene Activity is ten onrechte vastgezet op landscape")

version_code = root.attrib.get(android + "versionCode", "")
if not version_code.isdigit() or not 100_000_000 <= int(version_code) <= 199_999_999:
    raise SystemExit(
        f"Algemene versionCode valt buiten de gereserveerde range: {version_code!r}"
    )

with open(report_path, "w", encoding="utf-8") as report:
    report.write(f"applicationId={package_name}\n")
    report.write(f"versionCode={version_code}\n")
    report.write("phoneTabletCompatible=true\n")
    report.write(f"leanbackRequired={features.get('android.software.leanback', 'absent')}\n")
    report.write(f"touchscreenRequired={features.get('android.hardware.touchscreen', 'absent')}\n")
    report.write(
        f"televisionHardwareRequired={features.get('android.hardware.type.television', 'absent')}\n"
    )
    report.write(f"generalLaunchers={len(general_launchers)}\n")
    report.write(f"leanbackLaunchers={len(leanback_launchers)}\n")
    report.write(f"resolvedActivity={activity_name}\n")
    report.write(f"exported={exported}\n")
    report.write(f"enabled={enabled}\n")
    report.write(f"screenOrientation={orientation or 'unspecified'}\n")
PY

rm -rf "${dex_dir}"
install -d -m 0755 "${dex_dir}"
while IFS= read -r dex_entry; do
  unzip -p "${bundle_path}" "${dex_entry}" > "${dex_dir}/$(basename "${dex_entry}")"
done < <(unzip -Z1 "${bundle_path}" | grep -E '^base/dex/classes([0-9]*)?\.dex$')

if ! compgen -G "${dex_dir}/classes*.dex" > /dev/null; then
  echo "Algemene productionbundle bevat geen base DEX" >&2
  exit 1
fi

: > "${dex_report}"
for dex_file in "${dex_dir}"/classes*.dex; do
  "${dexdump_path}" -f "${dex_file}" >> "${dex_report}"
  "${dexdump_path}" -d "${dex_file}" >> "${dex_report}"
done

if ! grep -Fq "Class descriptor  : 'Lnl/veyocast/player/MainActivity;'" "${dex_report}"; then
  echo "nl.veyocast.player.MainActivity ontbreekt in de algemene production-DEX" >&2
  exit 1
fi

printf 'classExists=true\n' >> "${compatibility_report}"
printf 'bundle=%s\n' "${bundle_path}" >> "${compatibility_report}"
cat "${compatibility_report}"
