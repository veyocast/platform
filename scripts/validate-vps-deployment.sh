#!/usr/bin/env bash
set -Eeuo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${repository_root}"

export COMPOSE_PROJECT_NAME=veyocast-staging
export VEYOCAST_ENVIRONMENT=staging
export CONTROL_BIND_PORT=13000
export CONTROL_HOST=staging-control.veyocast.nl
export DEPLOYMENT_SHA=0123456789abcdef0123456789abcdef01234567
export DEVICE_LAB_ACCESS_TOKEN=test-device-lab-token-with-safe-length
export DEVICE_LAB_SESSION_SECRET=test-device-lab-session-secret-with-safe-length
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export NEXT_PUBLIC_SUPABASE_URL=https://staging-project-ref.supabase.co
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
export PLAYER_BIND_PORT=13001
export PLAYER_HOST=staging-player.veyocast.nl
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

staging_config=$(mktemp)
production_config=$(mktemp)
bounded_migration_root=$(mktemp -d)
unbounded_migration_root=$(mktemp -d)
trap 'rm -f -- "${staging_config}" "${production_config}"; rm -rf -- "${bounded_migration_root}" "${unbounded_migration_root}"' EXIT

docker compose -p veyocast-staging --file infra/vps/compose.yaml config --quiet
docker compose -p veyocast-staging --file infra/vps/compose.yaml config --format json > "${staging_config}"
node scripts/validate-compose-config.mjs "${staging_config}" staging "${DEPLOYMENT_SHA}"

make_test_jwt() {
  local role=$1 project_ref=$2
  node -e '
    const [role, ref] = process.argv.slice(1);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    process.stdout.write(encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ ref, role }) + ".c2lnbmF0dXJl");
  ' "${role}" "${project_ref}"
}

staging_ref=abcdefghijklmnopqrst
NEXT_PUBLIC_SUPABASE_URL="https://${staging_ref}.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(make_test_jwt anon "${staging_ref}")" \
SUPABASE_SERVICE_ROLE_KEY="$(make_test_jwt service_role "${staging_ref}")" \
SUPABASE_PROJECT_REF="${staging_ref}" \
SUPABASE_DB_URL="postgresql://postgres.${staging_ref}:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
GITHUB_SHA="${DEPLOYMENT_SHA}" \
  node scripts/preflight-deployment.mjs staging >/dev/null

export COMPOSE_PROJECT_NAME=veyocast-production
export VEYOCAST_ENVIRONMENT=production
export CONTROL_BIND_PORT=23000
export CONTROL_HOST=control.veyocast.nl
export MARKETING_BIND_PORT=23002
export MARKETING_HOST=veyocast.nl
export PLAYER_BIND_PORT=23001
export PLAYER_HOST=player.veyocast.nl

docker compose -p veyocast-production --profile production --file infra/vps/compose.yaml config --quiet
docker compose -p veyocast-production --profile production --file infra/vps/compose.yaml config --format json > "${production_config}"
node scripts/validate-compose-config.mjs "${production_config}" production "${DEPLOYMENT_SHA}"

production_ref=bcdefghijklmnopqrstu
NEXT_PUBLIC_SUPABASE_URL="https://${production_ref}.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(make_test_jwt anon "${production_ref}")" \
SUPABASE_SERVICE_ROLE_KEY="$(make_test_jwt service_role "${production_ref}")" \
SUPABASE_PROJECT_REF="${production_ref}" \
SUPABASE_DB_URL="postgresql://postgres.${production_ref}:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
GITHUB_SHA="${DEPLOYMENT_SHA}" \
  node scripts/preflight-deployment.mjs production >/dev/null

if grep --recursive --line-number --extended-regexp '(0\.0\.0\.0:|REVERSE_PROXY_NETWORK|caddy:)' infra/vps .github/workflows/deploy.yml; then
  echo "Verboden publieke bind of reverse-proxypad gevonden." >&2
  exit 1
fi

if grep --line-number --extended-regexp '(^|[[:space:]])build:' infra/vps/compose.yaml; then
  echo "De deployment-Compose mag geen buildinstructies bevatten." >&2
  exit 1
fi

bash -n scripts/deploy-vps.sh scripts/migrate-supabase.sh scripts/validate-vps-deployment.sh

node scripts/check-migration-safety.mjs supabase/migrations

printf '%s\n' \
  'create function public.remove_one() returns void language sql as $$' \
  '  delete from public.memberships where user_id = auth.uid();' \
  '$$;' > "${bounded_migration_root}/20260720000000_bounded_delete.sql"
node scripts/check-migration-safety.mjs "${bounded_migration_root}"

printf '%s\n' \
  'delete from public.memberships;' > "${unbounded_migration_root}/20260720000000_unbounded_delete.sql"
if node scripts/check-migration-safety.mjs "${unbounded_migration_root}" >/dev/null 2>&1; then
  echo "De migratieguard accepteert ten onrechte een onbegrensde DELETE." >&2
  exit 1
fi

for gate in lint typecheck test build; do
  if ! grep --fixed-strings --quiet -- "pnpm ${gate} --concurrency=\"\${release_gate_concurrency}\"" scripts/deploy-vps.sh; then
    echo "Releasegate ${gate} mist de begrensde self-hosted-runnerconcurrency." >&2
    exit 1
  fi
done
