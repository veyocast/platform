#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 3 ]]; then
  echo "Gebruik: $0 <exacte-url> <verwacht-lokaal-ipk> <uitvoermap>" >&2
  exit 64
fi

url="$1"
expected_ipk="$(realpath "$2")"
output_dir="$(realpath -m "$3")"
remote_ipk="${output_dir}/remote.ipk"
headers="${output_dir}/response-headers.txt"
unpacked="${output_dir}/unpacked"

mkdir -p "${output_dir}" "${unpacked}"
curl -sS \
  --header "Accept-Encoding: identity" \
  --output "${remote_ipk}" \
  --dump-header "${headers}" \
  "${url}"

tr -d '\r' < "${headers}" > "${output_dir}/response-headers.normalized.txt"
first_status="$(
  awk 'toupper($1) ~ /^HTTP\// { status=$2 } END { print status }' \
    "${output_dir}/response-headers.normalized.txt"
)"
if [[ "${first_status}" != "200" ]]; then
  echo "Verwacht directe HTTP 200, ontving ${first_status:-geen status}" >&2
  exit 1
fi
if grep -Eiq '^(location|content-encoding):' \
  "${output_dir}/response-headers.normalized.txt"; then
  echo "Redirect- of compressieheader is niet toegestaan voor een IPK" >&2
  exit 1
fi
if ! grep -Eiq '^content-type: application/vnd\.shana\.informed\.package' \
  "${output_dir}/response-headers.normalized.txt"; then
  echo "De download heeft niet het verwachte IPK Content-Type" >&2
  exit 1
fi

content_length="$(
  awk 'tolower($1) == "content-length:" { value=$2 } END { print value }' \
    "${output_dir}/response-headers.normalized.txt"
)"
actual_length="$(stat -c '%s' "${remote_ipk}")"
if [[ -z "${content_length}" || "${content_length}" != "${actual_length}" ]]; then
  echo "Content-Length ${content_length:-ontbreekt} wijkt af van ${actual_length}" >&2
  exit 1
fi

{
  echo "URL: ${url}"
  echo "Content-Length: ${actual_length}"
  echo "Verwacht lokaal:"
  sha256sum "${expected_ipk}"
  echo "Exact remote:"
  sha256sum "${remote_ipk}"
} > "${output_dir}/sha256.txt"
cmp "${expected_ipk}" "${remote_ipk}"

for attempt in 1 2 3; do
  encoded_headers="${output_dir}/response-headers-encoded-${attempt}.txt"
  curl -sS \
    --header "Accept-Encoding: gzip, br" \
    --output /dev/null \
    --dump-header "${encoded_headers}" \
    "${url}"
  tr -d '\r' < "${encoded_headers}" \
    > "${output_dir}/response-headers-encoded-${attempt}.normalized.txt"
  if ! grep -Eq '^HTTP/[0-9.]+ 200( |$)' \
    "${output_dir}/response-headers-encoded-${attempt}.normalized.txt"; then
    echo "Herhaalrequest ${attempt} retourneerde geen directe HTTP 200" >&2
    exit 1
  fi
  if grep -Eiq '^(location|content-encoding):' \
    "${output_dir}/response-headers-encoded-${attempt}.normalized.txt"; then
    echo "Herhaalrequest ${attempt} gebruikte redirect of contentcompressie" >&2
    exit 1
  fi
  repeated_length="$(
    awk 'tolower($1) == "content-length:" { value=$2 } END { print value }' \
      "${output_dir}/response-headers-encoded-${attempt}.normalized.txt"
  )"
  if [[ "${repeated_length}" != "${actual_length}" ]]; then
    echo "Content-Length wijzigde bij herhaalrequest ${attempt}" >&2
    exit 1
  fi
done

curl -sS \
  --range 0-15 \
  --output "${output_dir}/range-first-16.bin" \
  --dump-header "${output_dir}/range-response-headers.txt" \
  "${url}"
head -c 16 "${output_dir}/range-first-16.bin" \
  | xxd > "${output_dir}/range-first-16-bytes.txt"
cmp <(head -c 16 "${remote_ipk}") "${output_dir}/range-first-16.bin"

if command -v file >/dev/null 2>&1; then
  file "${remote_ipk}" > "${output_dir}/file.txt"
else
  echo "file is niet geïnstalleerd; magic en ar-validatie volgen apart." \
    > "${output_dir}/file.txt"
fi
head -c 16 "${remote_ipk}" | xxd > "${output_dir}/first-16-bytes.txt"
if head -c 256 "${remote_ipk}" |
  grep -Eiq '<!doctype html|<html|version https://git-lfs'; then
  echo "HTML of een Git LFS-pointer is geen installeerbare IPK" >&2
  exit 1
fi
ar t "${remote_ipk}" > "${output_dir}/ar-members.txt"
ar tv "${remote_ipk}" > "${output_dir}/ar-members-verbose.txt"
if ! diff -u \
  <(printf 'debian-binary\ncontrol.tar.gz\ndata.tar.gz\n') \
  "${output_dir}/ar-members.txt" \
  > "${output_dir}/ar-members.diff"; then
  echo "IPK bevat een onverwachte ar-memberstructuur" >&2
  exit 1
fi
(cd "${unpacked}" && ar x "${remote_ipk}")

xxd "${unpacked}/debian-binary" > "${output_dir}/debian-binary.txt"
tar --numeric-owner --full-time -tvzf "${unpacked}/control.tar.gz" \
  > "${output_dir}/control-archive.txt"
tar --numeric-owner --full-time -tvzf "${unpacked}/data.tar.gz" \
  > "${output_dir}/data-archive.txt"
tar -xOzf "${unpacked}/control.tar.gz" control \
  > "${output_dir}/control.txt"

package_id="$(
  awk '$1 == "Package:" { print $2 }' "${output_dir}/control.txt"
)"
tar -xOzf "${unpacked}/data.tar.gz" \
  "usr/palm/packages/${package_id}/packageinfo.json" \
  > "${output_dir}/packageinfo.json"
tar -xOzf "${unpacked}/data.tar.gz" \
  "usr/palm/applications/${package_id}/appinfo.json" \
  > "${output_dir}/appinfo.json"

pnpm exec ares-package -i "${remote_ipk}" \
  > "${output_dir}/ares-package-info.txt" 2>&1
pnpm exec ares-package -I "${remote_ipk}" \
  > "${output_dir}/ares-package-info-detail.txt" 2>&1

if tar -tzf "${unpacked}/data.tar.gz" |
  grep -Eiq '(^|/).+\\.(ipk|zip|deb|tar|tgz|gz)$|git-lfs'; then
  echo "Verdacht genest pakket aangetroffen" >&2
  exit 1
fi

{
  echo "ares-package executable shim: $(pnpm exec which ares-package)"
  echo "ares-package implementation: $(node -p "require.resolve('@webos-tools/cli/bin/ares-package.js')")"
  echo "ares-package version: $(pnpm exec ares-package --version)"
  echo "npm package: $(node -p "require('./node_modules/@webos-tools/cli/package.json').name + '@' + require('./node_modules/@webos-tools/cli/package.json').version")"
  echo "node: $(node --version)"
  echo "npm: $(npm --version)"
  echo "pnpm: $(pnpm --version)"
  echo "kernel: $(uname -a)"
  sed -n '1,8p' /etc/os-release
} > "${output_dir}/tooling.txt"

echo "Publieke IPK-audit geslaagd: ${url}"
