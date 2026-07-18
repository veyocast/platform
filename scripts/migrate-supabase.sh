#!/usr/bin/env bash
set -Eeuo pipefail

mode=${1:-apply}
if [[ ${mode} != "apply" && ${mode} != "dry-run" ]]; then
  echo "Gebruik: scripts/migrate-supabase.sh [apply|dry-run]" >&2
  exit 1
fi

if [[ -z ${SUPABASE_DB_URL:-} ]]; then
  echo "SUPABASE_DB_URL ontbreekt." >&2
  exit 1
fi

if [[ ${SUPABASE_DB_URL} != postgres://* && ${SUPABASE_DB_URL} != postgresql://* ]]; then
  echo "SUPABASE_DB_URL moet een Postgres-URL zijn." >&2
  exit 1
fi

pnpm exec supabase db push \
  --db-url "${SUPABASE_DB_URL}" \
  --include-all \
  --dry-run \
  --yes

if [[ ${mode} == "apply" ]]; then
  pnpm exec supabase db push \
    --db-url "${SUPABASE_DB_URL}" \
    --include-all \
    --yes
fi
