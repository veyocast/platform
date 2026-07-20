#!/usr/bin/env bash
set -Eeuo pipefail

migration_root=${1:-supabase/migrations}

if [[ ! -d ${migration_root} ]]; then
  echo "Migratiemap bestaat niet: ${migration_root}." >&2
  exit 1
fi

mapfile -t migrations < <(find "${migration_root}" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | LC_ALL=C sort)
if (( ${#migrations[@]} == 0 )); then
  echo "Geen Supabase-migraties gevonden." >&2
  exit 1
fi

previous=""
for migration in "${migrations[@]}"; do
  if [[ ! ${migration} =~ ^([0-9]{14})_[a-z0-9_]+\.sql$ ]]; then
    echo "Migratievolgorde is ongeldig: ${migration}." >&2
    exit 1
  fi
  current=${BASH_REMATCH[1]}
  if [[ -n ${previous} && ${current} -le ${previous} ]]; then
    echo "Migratieversies moeten uniek en strikt oplopend zijn: ${migration}." >&2
    exit 1
  fi
  previous=${current}
done

reject_matches() {
  local message=$1
  shift

  set +e
  "$@"
  local status=$?
  set -e

  if (( status == 0 )); then
    echo "${message}" >&2
    exit 1
  fi
  if (( status != 1 )); then
    echo "Migratiesafetycontrole kon niet worden uitgevoerd." >&2
    exit "${status}"
  fi
}

reject_matches \
  "Potentieel destructieve migratie gedetecteerd; handmatige review is verplicht." \
  rg --line-number --ignore-case \
  --regexp='(^|[[:space:];])(drop[[:space:]]+(table|schema|type)|truncate[[:space:]])' \
  "${migration_root}"

# Een begrensde DELETE is toegestaan. De PCRE2-lookahead weigert uitsluitend
# DELETE-statements die vóór hun statementeinde geen WHERE-clausule hebben.
reject_matches \
  "Onbegrensde DELETE in migratie gedetecteerd; handmatige review is verplicht." \
  rg --line-number --ignore-case --multiline --pcre2 \
  --regexp='(?s)(^|[[:space:];])delete[[:space:]]+from[[:space:]]+(?:(?!\bwhere\b)[^;])*(?:;|\z)' \
  "${migration_root}"
