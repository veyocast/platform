#!/usr/bin/env bash
set -euo pipefail

if (( $# != 5 )); then
  echo "Gebruik: validate-android-bundle.sh <aab> <bundletool.jar> <zipalign> <llvm-readelf> <evidence-dir>" >&2
  exit 64
fi

aab="$1"
bundletool="$2"
zipalign="$3"
readelf="$4"
evidence="$5"

test -s "${aab}"
test -s "${bundletool}"
test -x "${zipalign}"
test -x "${readelf}"
mkdir -p "${evidence}"

java -jar "${bundletool}" validate --bundle="${aab}" \
  > "${evidence}/bundletool-validate.txt"
java -jar "${bundletool}" dump config --bundle="${aab}" \
  > "${evidence}/bundle-config.txt"
grep -Fq "PAGE_ALIGNMENT_16K" "${evidence}/bundle-config.txt"

unpack="$(mktemp -d)"
trap 'rm -rf "${unpack}"' EXIT
unzip -q "${aab}" -d "${unpack}/aab"

: > "${evidence}/native-inventory.tsv"
while IFS= read -r library; do
  relative="${library#${unpack}/aab/}"
  abi="$(printf '%s' "${relative}" | cut -d/ -f3)"
  printf '%s\t%s\t%s\n' \
    "${abi}" \
    "${relative}" \
    "$(sha256sum "${library}" | cut -d' ' -f1)" \
    >> "${evidence}/native-inventory.tsv"

  while IFS= read -r alignment; do
    value="${alignment#0x}"
    if (( 16#${value} < 16#4000 )); then
      echo "::error::${relative} heeft LOAD-alignment ${alignment}, lager dan 0x4000" >&2
      exit 1
    fi
  done < <(
    "${readelf}" -lW "${library}" |
      awk '$1 == "LOAD" { print $NF }'
  )
done < <(find "${unpack}/aab/base/lib" -type f -name '*.so' -print 2>/dev/null | sort)

allowed_abis='^(arm64-v8a|armeabi-v7a|x86|x86_64)$'
if [[ -s "${evidence}/native-inventory.tsv" ]] &&
  awk -F '\t' -v pattern="${allowed_abis}" '$1 !~ pattern { exit 1 }' \
    "${evidence}/native-inventory.tsv"; then
  :
elif [[ -s "${evidence}/native-inventory.tsv" ]]; then
  echo "::error::AAB bevat een niet-toegestane ABI" >&2
  exit 1
fi

printf 'bundle_sha256\t%s\n' "$(sha256sum "${aab}" | cut -d' ' -f1)" \
  > "${evidence}/digests.tsv"

if [[ -n "${ANDROID_SIGNING_STORE_FILE:-}" ]]; then
  java -jar "${bundletool}" build-apks \
    --bundle="${aab}" \
    --output="${evidence}/universal.apks" \
    --mode=universal \
    --ks="${ANDROID_SIGNING_STORE_FILE}" \
    --ks-key-alias="${ANDROID_SIGNING_KEY_ALIAS}" \
    --ks-pass="pass:${ANDROID_SIGNING_STORE_PASSWORD}" \
    --key-pass="pass:${ANDROID_SIGNING_KEY_PASSWORD}" \
    --overwrite
  unzip -p "${evidence}/universal.apks" universal.apk \
    > "${evidence}/universal.apk"
  "${zipalign}" -c -P 16 -v 4 "${evidence}/universal.apk" \
    > "${evidence}/zipalign-16k.txt"
fi
