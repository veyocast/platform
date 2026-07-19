#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

mode=${1:-dry-run}
if [[ ${mode} != "apply" && ${mode} != "dry-run" ]]; then
  echo "Gebruik: scripts/migrate-supabase.sh [apply|dry-run]" >&2
  exit 1
fi

required=(SUPABASE_DB_URL SUPABASE_PROJECT_REF GITHUB_SHA)
for variable_name in "${required[@]}"; do
  if [[ -z ${!variable_name:-} ]]; then
    echo "Migratieconfiguratie ontbreekt: ${variable_name}." >&2
    exit 1
  fi
done

if [[ ${SUPABASE_DB_URL} != postgres://* && ${SUPABASE_DB_URL} != postgresql://* ]]; then
  echo "Migratieconfiguratie is ongeldig: SUPABASE_DB_URL." >&2
  exit 1
fi
if [[ ${SUPABASE_DB_URL} != *"${SUPABASE_PROJECT_REF}"* ]]; then
  echo "Migratieconfiguratie is ongeldig: SUPABASE_PROJECT_REF." >&2
  exit 1
fi
if [[ ! ${GITHUB_SHA} =~ ^[0-9a-f]{40}$ ]]; then
  echo "Migratieconfiguratie is ongeldig: GITHUB_SHA." >&2
  exit 1
fi

mapfile -t migrations < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | LC_ALL=C sort)
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

if rg --line-number --ignore-case \
  --regexp='(^|[[:space:];])(drop[[:space:]]+(table|schema|type)|truncate[[:space:]]|delete[[:space:]]+from[[:space:]])' \
  supabase/migrations; then
  echo "Potentieel destructieve migratie gedetecteerd; handmatige review is verplicht." >&2
  exit 1
fi

# De CLI vergelijkt lokale en remote migration history. Zonder --include-all
# stopt hij bij remote-only en out-of-order versies in plaats van ze te forceren.
pnpm exec supabase migration list --db-url "${SUPABASE_DB_URL}" >/dev/null
pnpm exec supabase db push \
  --db-url "${SUPABASE_DB_URL}" \
  --dry-run \
  --yes

if [[ ${mode} == "apply" ]]; then
  pnpm exec supabase db push \
    --db-url "${SUPABASE_DB_URL}" \
    --yes
fi
