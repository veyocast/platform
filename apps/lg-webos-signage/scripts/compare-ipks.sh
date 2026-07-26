#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 3 ]]; then
  echo "Gebruik: $0 <geaccepteerde-ipk> <te-vergelijken-ipk> <uitvoermap>" >&2
  exit 64
fi

accepted="$(realpath "$1")"
candidate="$(realpath "$2")"
output_dir="$(realpath -m "$3")"
accepted_dir="${output_dir}/accepted"
candidate_dir="${output_dir}/candidate"

mkdir -p "${accepted_dir}" "${candidate_dir}"
(cd "${accepted_dir}" && ar x "${accepted}")
(cd "${candidate_dir}" && ar x "${candidate}")

ar t "${accepted}" > "${output_dir}/accepted-ar-members.txt"
ar t "${candidate}" > "${output_dir}/candidate-ar-members.txt"
ar tv "${accepted}" > "${output_dir}/accepted-ar-verbose.txt"
ar tv "${candidate}" > "${output_dir}/candidate-ar-verbose.txt"
xxd "${accepted_dir}/debian-binary" > "${output_dir}/accepted-debian-binary.txt"
xxd "${candidate_dir}/debian-binary" > "${output_dir}/candidate-debian-binary.txt"

for archive in control data; do
  tar --numeric-owner --full-time -tvzf \
    "${accepted_dir}/${archive}.tar.gz" \
    > "${output_dir}/accepted-${archive}-archive.txt"
  tar --numeric-owner --full-time -tvzf \
    "${candidate_dir}/${archive}.tar.gz" \
    > "${output_dir}/candidate-${archive}-archive.txt"
done

tar -xOzf "${accepted_dir}/control.tar.gz" control \
  > "${output_dir}/accepted-control.txt"
tar -xOzf "${candidate_dir}/control.tar.gz" control \
  > "${output_dir}/candidate-control.txt"

accepted_id="$(awk '$1 == "Package:" { print $2 }' "${output_dir}/accepted-control.txt")"
candidate_id="$(awk '$1 == "Package:" { print $2 }' "${output_dir}/candidate-control.txt")"
for metadata in packageinfo appinfo; do
  if [[ "${metadata}" == "packageinfo" ]]; then
    accepted_path="usr/palm/packages/${accepted_id}/packageinfo.json"
    candidate_path="usr/palm/packages/${candidate_id}/packageinfo.json"
  else
    accepted_path="usr/palm/applications/${accepted_id}/appinfo.json"
    candidate_path="usr/palm/applications/${candidate_id}/appinfo.json"
  fi
  tar -xOzf "${accepted_dir}/data.tar.gz" "${accepted_path}" \
    > "${output_dir}/accepted-${metadata}.json"
  tar -xOzf "${candidate_dir}/data.tar.gz" "${candidate_path}" \
    > "${output_dir}/candidate-${metadata}.json"
done

{
  diff -u "${output_dir}/accepted-ar-verbose.txt" \
    "${output_dir}/candidate-ar-verbose.txt" || true
  diff -u "${output_dir}/accepted-control-archive.txt" \
    "${output_dir}/candidate-control-archive.txt" || true
  diff -u "${output_dir}/accepted-data-archive.txt" \
    "${output_dir}/candidate-data-archive.txt" || true
  diff -u "${output_dir}/accepted-control.txt" \
    "${output_dir}/candidate-control.txt" || true
  diff -u "${output_dir}/accepted-packageinfo.json" \
    "${output_dir}/candidate-packageinfo.json" || true
  diff -u "${output_dir}/accepted-appinfo.json" \
    "${output_dir}/candidate-appinfo.json" || true
} > "${output_dir}/complete-structure.diff"

{
  sha256sum "${accepted}" "${candidate}"
  gzip -lv "${accepted_dir}/control.tar.gz" "${accepted_dir}/data.tar.gz"
  gzip -lv "${candidate_dir}/control.tar.gz" "${candidate_dir}/data.tar.gz"
} > "${output_dir}/checksums-and-compression.txt"

echo "IPK-vergelijking opgeslagen in ${output_dir}"
