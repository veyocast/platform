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

bash scripts/check-migration-safety.sh supabase/migrations

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
