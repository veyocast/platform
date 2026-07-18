#!/usr/bin/env bash
set -Eeuo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${repository_root}"

export ACME_EMAIL=beheer@example.nl
export CASTIVO_ENVIRONMENT=staging
export CONTROL_BIND_PORT=13000
export CONTROL_HOST=staging-control.example.nl
export DEPLOYMENT_SHA=0123456789abcdef0123456789abcdef01234567
export DEVICE_LAB_ACCESS_TOKEN=test-device-lab-token
export DEVICE_LAB_SESSION_SECRET=test-device-lab-session-secret-with-32-bytes
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export NEXT_PUBLIC_SUPABASE_URL=https://staging-project-ref.supabase.co
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=test-server-actions-secret-with-32-bytes
export PLAYER_BIND_PORT=13001
export PLAYER_HOST=staging-player.example.nl
export REVERSE_PROXY_NETWORK=castivo-proxy
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

docker compose --file infra/vps/app.compose.yaml config --quiet

CASTIVO_ENVIRONMENT=production \
CONTROL_BIND_PORT=23000 \
CONTROL_HOST=control.example.nl \
PLAYER_BIND_PORT=23001 \
PLAYER_HOST=player.example.nl \
  docker compose --file infra/vps/app.compose.yaml config --quiet

CONTROL_HOST=control.example.nl \
PLAYER_HOST=player.example.nl \
docker compose --file infra/production/compose.yaml config --quiet
