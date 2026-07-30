#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
compose_file="${repository_root}/infra/vps/compose.yaml"
worker_compose_file="${repository_root}/infra/vps/worker.compose.yaml"
environment=${1:-}
action=${2:-deploy}
deployment_mode=${DEPLOYMENT_MODE:-release}
mutation_started=false
candidate_env_file=""
temporary_marketing_container=""
previous_env_snapshot=""
rendered_compose_file=""
rendered_worker_compose_file=""

case "${environment}" in
  staging)
    expected_control_host=staging-control.veyocast.nl
    expected_control_port=13000
    expected_player_host=staging-player.veyocast.nl
    expected_player_port=13001
    compose_project=veyocast-staging
    runtime_directory=/srv/apps/veyocast/staging
    ;;
  production)
    expected_control_host=control.veyocast.nl
    expected_control_port=23000
    expected_player_host=player.veyocast.nl
    expected_player_port=23001
    expected_marketing_host=veyocast.nl
    expected_marketing_port=23002
    compose_project=veyocast-production
    runtime_directory=/srv/apps/veyocast/production
    ;;
  *)
    echo "Gebruik: scripts/deploy-vps.sh <staging|production> [preflight|build-release|deploy|verify|rollback]" >&2
    exit 1
    ;;
esac

if [[ ${deployment_mode} != "release" && ${deployment_mode} != "rollback" ]]; then
  echo "DEPLOYMENT_MODE moet release of rollback zijn." >&2
  exit 1
fi

if [[ ${action} == "rollback" ]]; then
  deployment_mode=rollback
  if [[ -z ${RELEASE_SHA:-} && -r ${runtime_directory}/PREVIOUS_REVISION ]]; then
    RELEASE_SHA=$(<"${runtime_directory}/PREVIOUS_REVISION")
    export RELEASE_SHA
  fi
  action=deploy
fi

export COMPOSE_PROJECT_NAME=${compose_project}
export WORKER_COMPOSE_PROJECT_NAME=${compose_project}-worker
export DEPLOYMENT_SHA=${RELEASE_SHA:-${GITHUB_SHA:-}}
export VEYOCAST_ENVIRONMENT=${environment}

release_root=/srv/apps/veyocast/releases
release_directory="${release_root}/${DEPLOYMENT_SHA}"
release_metadata="${release_directory}/RELEASE_METADATA"
release_key_fingerprint="${release_directory}/SERVER_ACTIONS_KEY_FINGERPRINT"

cleanup() {
  if [[ -n ${temporary_marketing_container} ]]; then
    docker rm --force "${temporary_marketing_container}" >/dev/null 2>&1 || true
  fi
  if [[ -n ${candidate_env_file} && -f ${candidate_env_file} ]]; then
    rm -f -- "${candidate_env_file}"
  fi
  if [[ -n ${previous_env_snapshot} && -f ${previous_env_snapshot} ]]; then
    rm -f -- "${previous_env_snapshot}"
  fi
  if [[ -n ${rendered_compose_file} && -f ${rendered_compose_file} ]]; then
    rm -f -- "${rendered_compose_file}"
  fi
  if [[ -n ${rendered_worker_compose_file} && -f ${rendered_worker_compose_file} ]]; then
    rm -f -- "${rendered_worker_compose_file}"
  fi
}

show_sanitized_logs() {
  local env_file=${1:-}
  [[ -f ${env_file} ]] || return 0
  local -a args=(docker compose -p "${compose_project}" --env-file "${env_file}" --file "${compose_file}")
  if [[ ${environment} == production ]]; then
    args+=(--profile production)
  fi
  "${args[@]}" logs --no-color --tail 100 2>&1 \
    | node -e '
        let output = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { output += chunk; });
        process.stdin.on("end", () => {
          for (const name of [
            "DEVICE_LAB_ACCESS_TOKEN",
            "DEVICE_LAB_SESSION_SECRET",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
            "SUPABASE_SERVICE_ROLE_KEY"
          ]) {
            const value = process.env[name];
            if (value) output = output.replaceAll(value, "[REDACTED_" + name + "]");
          }
          process.stdout.write(output);
        });
      ' \
    | sed -E \
      -e 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#g' \
      -e 's#eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+#[REDACTED_JWT]#g' \
    || true

  docker compose \
    -p "${WORKER_COMPOSE_PROJECT_NAME}" \
    --env-file "${env_file}" \
    --file "${worker_compose_file}" \
    logs --no-color --tail 100 2>&1 \
    | node -e '
        let output = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { output += chunk; });
        process.stdin.on("end", () => {
          for (const name of ["SUPABASE_SERVICE_ROLE_KEY"]) {
            const value = process.env[name];
            if (value) output = output.replaceAll(value, "[REDACTED_" + name + "]");
          }
          process.stdout.write(output);
        });
      ' \
    | sed -E \
      -e 's#eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+#[REDACTED_JWT]#g' \
    || true
}

restore_previous_release() {
  if [[ ${mutation_started} != true || ! -s ${previous_env_snapshot} ]]; then
    return 0
  fi

  echo "De nieuwe applicatierelease faalde; de vorige runtimeconfiguratie wordt hersteld." >&2
  local previous_sha previous_actions_key saved_sha saved_metadata saved_directory saved_fingerprint saved_key
  previous_sha=$(sed -n 's/^DEPLOYMENT_SHA=//p' "${previous_env_snapshot}")
  previous_actions_key=$(sed -n 's/^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=//p' "${previous_env_snapshot}")
  if [[ ! ${previous_sha} =~ ^[0-9a-f]{40}$ || -z ${previous_actions_key} ]]; then
    echo "Automatische applicatierollback faalde: vorige runtimeconfiguratie is ongeldig." >&2
    return 1
  fi

  saved_sha=${DEPLOYMENT_SHA}
  saved_directory=${release_directory}
  saved_metadata=${release_metadata}
  saved_fingerprint=${release_key_fingerprint}
  saved_key=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}
  DEPLOYMENT_SHA=${previous_sha}
  release_directory="${release_root}/${DEPLOYMENT_SHA}"
  release_metadata="${release_directory}/RELEASE_METADATA"
  release_key_fingerprint="${release_directory}/SERVER_ACTIONS_KEY_FINGERPRINT"
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${previous_actions_key}

  local restore_worker=true
  if ! metadata_image_id media-worker >/dev/null 2>&1; then
    restore_worker=false
  fi
  if ! validate_release_images "${restore_worker}"; then
    echo "Automatische applicatierollback faalde: vorige image-ID's zijn niet betrouwbaar." >&2
    DEPLOYMENT_SHA=${saved_sha}
    release_directory=${saved_directory}
    release_metadata=${saved_metadata}
    release_key_fingerprint=${saved_fingerprint}
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${saved_key}
    return 1
  fi

  local -a args=(docker compose -p "${compose_project}" --env-file "${previous_env_snapshot}" --file "${compose_file}")
  local -a worker_args=(docker compose -p "${WORKER_COMPOSE_PROJECT_NAME}" --env-file "${previous_env_snapshot}" --file "${worker_compose_file}")
  if [[ ${environment} == production ]]; then
    args+=(--profile production)
  fi
  if ! "${args[@]}" up -d --no-build --remove-orphans >/dev/null 2>&1; then
    echo "Automatische applicatierollback faalde; handmatige incidentactie is vereist." >&2
    return 1
  fi
  if [[ ${restore_worker} == true ]]; then
    "${worker_args[@]}" up -d --no-build --remove-orphans >/dev/null 2>&1
  else
    "${worker_args[@]}" down --remove-orphans >/dev/null 2>&1 || true
  fi
  if ! verify_health_matrix "${restore_worker}"; then
    echo "Automatische applicatierollback faalde; handmatige incidentactie is vereist." >&2
    DEPLOYMENT_SHA=${saved_sha}
    release_directory=${saved_directory}
    release_metadata=${saved_metadata}
    release_key_fingerprint=${saved_fingerprint}
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${saved_key}
    return 1
  fi

  DEPLOYMENT_SHA=${saved_sha}
  release_directory=${saved_directory}
  release_metadata=${saved_metadata}
  release_key_fingerprint=${saved_fingerprint}
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${saved_key}
  echo "De vorige applicatierelease is opnieuw gezond geactiveerd." >&2
}

on_error() {
  local exit_code=$?
  trap - ERR
  show_sanitized_logs "${candidate_env_file}"
  if ! restore_previous_release; then
    echo "Automatisch herstel kon niet worden bevestigd." >&2
  fi
  cleanup
  exit "${exit_code}"
}

trap on_error ERR
trap cleanup EXIT INT TERM

require_rootless_docker() {
  local security_options socket_path socket_owner current_uid
  security_options=$(docker info --format '{{json .SecurityOptions}}' 2>/dev/null) || {
    echo "De Rootless Docker-daemon is niet bereikbaar." >&2
    return 1
  }
  if [[ ${security_options} != *rootless* ]]; then
    echo "Deployment weigert een niet-rootless Docker-daemon." >&2
    return 1
  fi

  if [[ $(id -un) != deploy ]]; then
    echo "Deployment moet onder gebruiker deploy draaien." >&2
    return 1
  fi
  socket_path=${DOCKER_HOST:-}
  if [[ -z ${socket_path} ]]; then
    socket_path=$(docker context inspect --format '{{(index .Endpoints "docker").Host}}' 2>/dev/null)
  fi
  socket_path=${socket_path:-unix:///run/user/$(id -u)/docker.sock}
  if [[ ${socket_path} != unix://* ]]; then
    echo "Deployment vereist een lokale rootless unix-socket." >&2
    return 1
  fi
  socket_path=${socket_path#unix://}
  if [[ ${socket_path} == /var/run/docker.sock || ! -S ${socket_path} ]]; then
    echo "Deployment weigert de rootful of ontbrekende Docker-socket." >&2
    return 1
  fi
  socket_owner=$(stat -c '%u' "${socket_path}")
  current_uid=$(id -u)
  if [[ ${socket_owner} != "${current_uid}" ]]; then
    echo "De Docker-socket hoort niet bij de deploygebruiker." >&2
    return 1
  fi
}

run_preflight() {
  cd "${repository_root}"
  node scripts/preflight-deployment.mjs "${environment}"

  [[ ${CONTROL_HOST} == "${expected_control_host}" ]]
  [[ ${CONTROL_BIND_PORT} == "${expected_control_port}" ]]
  [[ ${PLAYER_HOST} == "${expected_player_host}" ]]
  [[ ${PLAYER_BIND_PORT} == "${expected_player_port}" ]]
  if [[ ${environment} == production ]]; then
    [[ ${MARKETING_HOST} == "${expected_marketing_host}" ]]
    [[ ${MARKETING_BIND_PORT} == "${expected_marketing_port}" ]]
  fi

  require_rootless_docker
}

assert_release_checkout() {
  local checkout_sha
  checkout_sha=$(git -C "${repository_root}" rev-parse HEAD)
  if [[ ${checkout_sha} != "${DEPLOYMENT_SHA}" ]]; then
    echo "De checkout hoort niet bij de geautoriseerde release-SHA." >&2
    return 1
  fi
}

image_id() {
  docker image inspect --format '{{.Id}}' "$1"
}

metadata_image_id() {
  local service=$1
  node -e '
    const fs = require("node:fs");
    const [path, service] = process.argv.slice(1);
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    if (!data.images?.[service]?.digest) process.exit(1);
    process.stdout.write(data.images[service].digest);
  ' "${release_metadata}" "${service}"
}

validate_release_images() {
  local require_worker=${1:-true}
  [[ -s ${release_metadata} && -s ${release_key_fingerprint} ]] || {
    echo "Release ${DEPLOYMENT_SHA} is niet eerder immutable gebouwd." >&2
    return 1
  }

  local service tag actual expected
  for service in control player marketing media-worker; do
    if [[ ${service} == media-worker ]] && ! metadata_image_id media-worker >/dev/null 2>&1; then
      if [[ ${require_worker} == true ]]; then
        echo "Release ${DEPLOYMENT_SHA} mist de media-workerimage." >&2
        return 1
      fi
      continue
    fi
    tag="veyocast-${service}:${DEPLOYMENT_SHA}"
    actual=$(image_id "${tag}")
    expected=$(metadata_image_id "${service}")
    if [[ ${actual} != "${expected}" || ! ${actual} =~ ^sha256:[0-9a-f]{64}$ ]]; then
      echo "Image digest is ongeldig: ${service}." >&2
      return 1
    fi
  done

  local current_key_fingerprint expected_key_fingerprint
  current_key_fingerprint=$(printf '%s' "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}" | sha256sum | awk '{print $1}')
  expected_key_fingerprint=$(<"${release_key_fingerprint}")
  if [[ ${current_key_fingerprint} != "${expected_key_fingerprint}" ]]; then
    echo "Deploymentconfiguratie is ongeldig: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY." >&2
    return 1
  fi
}

emit_release_outputs() {
  [[ -n ${GITHUB_OUTPUT:-} ]] || return 0
  {
    echo "control_digest=$(metadata_image_id control)"
    echo "marketing_digest=$(metadata_image_id marketing)"
    echo "player_digest=$(metadata_image_id player)"
    echo "worker_digest=$(metadata_image_id media-worker)"
    echo "release_sha=${DEPLOYMENT_SHA}"
  } >> "${GITHUB_OUTPUT}"
}

wait_for_marketing_image() {
  temporary_marketing_container="veyocast-marketing-check-${DEPLOYMENT_SHA:0:12}-${GITHUB_RUN_ID:-local}"
  docker run --detach --rm \
    --name "${temporary_marketing_container}" \
    --env DEPLOYMENT_SHA="${DEPLOYMENT_SHA}" \
    --env VEYOCAST_ENVIRONMENT=production \
    "veyocast-marketing:${DEPLOYMENT_SHA}" >/dev/null

  local attempt
  for attempt in $(seq 1 20); do
    if docker exec "${temporary_marketing_container}" node -e \
      "fetch('http://127.0.0.1:3002/api/health').then(async r=>{const b=await r.json();if(!r.ok||b.status!=='ok'||b.service!=='marketing'||b.environment!=='production'||b.revision!=='${DEPLOYMENT_SHA}')process.exit(1)}).catch(()=>process.exit(1))"; then
      docker rm --force "${temporary_marketing_container}" >/dev/null
      temporary_marketing_container=""
      return 0
    fi
    if (( attempt < 20 )); then
      sleep 3
    fi
  done

  echo "De tijdelijke Marketing-healthcheck is mislukt." >&2
  docker logs --tail 100 "${temporary_marketing_container}" 2>&1 || true
  return 1
}

build_release() {
  # De stagingrunner deelt zijn beperkte CPU/geheugenbudget met Rootless Docker.
  # Turbo's standaardparallelisme kan daardoor meerdere TypeScript-processen
  # tegelijk verliezen voordat de eigenlijke imagebuild begint. Alle gates
  # blijven verplicht; alleen hun gelijktijdigheid wordt hier begrensd.
  local -r release_gate_concurrency=2

  run_preflight
  if [[ ${environment} != staging ]]; then
    echo "Immutable releases worden uitsluitend eenmaal op de staging-runner gebouwd." >&2
    return 1
  fi
  assert_release_checkout

  local existing_artifact=false service
  [[ -e ${release_metadata} || -e ${release_key_fingerprint} ]] && existing_artifact=true
  for service in control player marketing media-worker; do
    if docker image inspect "veyocast-${service}:${DEPLOYMENT_SHA}" >/dev/null 2>&1; then
      existing_artifact=true
    fi
  done
  if [[ ${existing_artifact} == true ]]; then
    if validate_release_images; then
      emit_release_outputs
      return 0
    fi
    echo "Immutable release ${DEPLOYMENT_SHA} is incompleet of gewijzigd en wordt niet overschreven." >&2
    return 1
  fi
  if [[ ${deployment_mode} == rollback ]]; then
    echo "Rollbackrelease ${DEPLOYMENT_SHA} bestaat niet in de immutable imagestore." >&2
    return 1
  fi

  cd "${repository_root}"
  pnpm install --frozen-lockfile
  pnpm lint --concurrency="${release_gate_concurrency}"
  pnpm typecheck --concurrency="${release_gate_concurrency}"
  pnpm test --concurrency="${release_gate_concurrency}"
  pnpm build --concurrency="${release_gate_concurrency}"

  install -d -m 0700 "${release_root}" "${release_directory}"
  local key_fingerprint
  key_fingerprint=$(printf '%s' "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}" | sha256sum | awk '{print $1}')
  for service in control player marketing media-worker; do
    docker build \
      --file infra/production/Dockerfile \
      --target "${service}" \
      --tag "veyocast-${service}:${DEPLOYMENT_SHA}" \
      --build-arg DEPLOYMENT_SHA="${DEPLOYMENT_SHA}" \
      --build-arg SERVER_ACTIONS_KEY_FINGERPRINT="${key_fingerprint}" \
      --secret id=next_server_actions_encryption_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
      .
  done

  wait_for_marketing_image

  local control_digest player_digest marketing_digest worker_digest built_at metadata_tmp key_tmp
  control_digest=$(image_id "veyocast-control:${DEPLOYMENT_SHA}")
  player_digest=$(image_id "veyocast-player:${DEPLOYMENT_SHA}")
  marketing_digest=$(image_id "veyocast-marketing:${DEPLOYMENT_SHA}")
  worker_digest=$(image_id "veyocast-media-worker:${DEPLOYMENT_SHA}")
  built_at=$(date --utc +'%Y-%m-%dT%H:%M:%SZ')
  metadata_tmp=$(mktemp "${release_directory}/.RELEASE_METADATA.XXXXXX")
  key_tmp=$(mktemp "${release_directory}/.SERVER_ACTIONS_KEY_FINGERPRINT.XXXXXX")

  RELEASE_PATH=${metadata_tmp} \
  RELEASE_SHA=${DEPLOYMENT_SHA} \
  RELEASE_BUILT_AT=${built_at} \
  CONTROL_DIGEST=${control_digest} \
  PLAYER_DIGEST=${player_digest} \
  MARKETING_DIGEST=${marketing_digest} \
  WORKER_DIGEST=${worker_digest} \
    node -e '
      const fs = require("node:fs");
      const sha = process.env.RELEASE_SHA;
      const image = (service, digest) => ({ digest, tag: "veyocast-" + service + ":" + sha });
      fs.writeFileSync(process.env.RELEASE_PATH, JSON.stringify({
        builtAt: process.env.RELEASE_BUILT_AT,
        images: {
          control: image("control", process.env.CONTROL_DIGEST),
          marketing: image("marketing", process.env.MARKETING_DIGEST),
          player: image("player", process.env.PLAYER_DIGEST),
          "media-worker": image("media-worker", process.env.WORKER_DIGEST)
        },
        revision: sha,
        serviceVersions: { control: sha, marketing: sha, player: sha, "media-worker": sha }
      }, null, 2) + "\n", { mode: 0o600 });
    '
  printf '%s\n' "${key_fingerprint}" > "${key_tmp}"
  chmod 0600 "${metadata_tmp}" "${key_tmp}"
  mv -f "${metadata_tmp}" "${release_metadata}"
  mv -f "${key_tmp}" "${release_key_fingerprint}"

  validate_release_images
  emit_release_outputs
}

write_env_value() {
  local destination=$1 name=$2 value=$3
  if [[ -z ${value} || ! ${value} =~ ^[A-Za-z0-9._~:/?@%+,=-]+$ ]]; then
    echo "Runtimeconfiguratie is ongeldig: ${name}." >&2
    return 1
  fi
  printf '%s=%s\n' "${name}" "${value}" >> "${destination}"
}

create_candidate_env() {
  install -d -m 0700 "${runtime_directory}"
  candidate_env_file=$(mktemp "${runtime_directory}/.env.runtime.candidate.XXXXXX")
  chmod 0600 "${candidate_env_file}"

  write_env_value "${candidate_env_file}" COMPOSE_PROJECT_NAME "${compose_project}"
  write_env_value "${candidate_env_file}" WORKER_COMPOSE_PROJECT_NAME "${WORKER_COMPOSE_PROJECT_NAME}"
  write_env_value "${candidate_env_file}" CONTROL_BIND_PORT "${CONTROL_BIND_PORT}"
  write_env_value "${candidate_env_file}" CONTROL_HOST "${CONTROL_HOST}"
  write_env_value "${candidate_env_file}" DEPLOYMENT_SHA "${DEPLOYMENT_SHA}"
  write_env_value "${candidate_env_file}" DEVICE_LAB_ACCESS_TOKEN "${DEVICE_LAB_ACCESS_TOKEN}"
  write_env_value "${candidate_env_file}" DEVICE_LAB_SESSION_SECRET "${DEVICE_LAB_SESSION_SECRET}"
  write_env_value "${candidate_env_file}" NEXT_PUBLIC_SUPABASE_ANON_KEY "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
  write_env_value "${candidate_env_file}" NEXT_PUBLIC_SUPABASE_URL "${NEXT_PUBLIC_SUPABASE_URL}"
  write_env_value "${candidate_env_file}" NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}"
  write_env_value "${candidate_env_file}" PLAYER_BIND_PORT "${PLAYER_BIND_PORT}"
  write_env_value "${candidate_env_file}" PLAYER_HOST "${PLAYER_HOST}"
  if [[ -n ${SLACK_ALERT_WEBHOOK_URL:-} ]]; then
    write_env_value "${candidate_env_file}" SLACK_ALERT_WEBHOOK_URL "${SLACK_ALERT_WEBHOOK_URL}"
  fi
  write_env_value "${candidate_env_file}" SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY}"
  write_env_value "${candidate_env_file}" VEYOCAST_ENVIRONMENT "${environment}"
  if [[ ${environment} == production ]]; then
    write_env_value "${candidate_env_file}" MARKETING_BIND_PORT "${MARKETING_BIND_PORT}"
    write_env_value "${candidate_env_file}" MARKETING_HOST "${MARKETING_HOST}"
    write_env_value "${candidate_env_file}" MONITOR_MARKETING_URL "https://${MARKETING_HOST}/api/health"
  fi
}

compose_arguments() {
  COMPOSE_ARGS=(docker compose -p "${compose_project}" --env-file "${candidate_env_file}" --file "${compose_file}")
  WORKER_COMPOSE_ARGS=(docker compose -p "${WORKER_COMPOSE_PROJECT_NAME}" --env-file "${candidate_env_file}" --file "${worker_compose_file}")
  if [[ ${environment} == production ]]; then
    COMPOSE_ARGS+=(--profile production)
  fi
}

validate_compose() {
  rendered_compose_file=$(mktemp "${runtime_directory}/.compose.XXXXXX.json")
  "${COMPOSE_ARGS[@]}" config --quiet
  "${COMPOSE_ARGS[@]}" config --format json > "${rendered_compose_file}"
  node "${repository_root}/scripts/validate-compose-config.mjs" "${rendered_compose_file}" "${environment}" "${DEPLOYMENT_SHA}"
  rm -f -- "${rendered_compose_file}"
  rendered_compose_file=""

  rendered_worker_compose_file=$(mktemp "${runtime_directory}/.worker-compose.XXXXXX.json")
  "${WORKER_COMPOSE_ARGS[@]}" config --quiet
  "${WORKER_COMPOSE_ARGS[@]}" config --format json > "${rendered_worker_compose_file}"
  node "${repository_root}/scripts/validate-worker-compose-config.mjs" "${rendered_worker_compose_file}" "${environment}" "${DEPLOYMENT_SHA}"
  rm -f -- "${rendered_worker_compose_file}"
  rendered_worker_compose_file=""
}

check_health_url() {
  local service=$1 url=$2 response headers attempt content_type
  response=$(mktemp "${runtime_directory}/.health.${service}.XXXXXX.json")
  headers=$(mktemp "${runtime_directory}/.health.${service}.XXXXXX.headers")

  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error \
      --connect-timeout 3 --max-time 8 \
      --dump-header "${headers}" --output "${response}" "${url}"; then
      content_type=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {gsub("\r", ""); print $2; exit}' "${headers}")
      if [[ ${content_type} == application/json* ]] \
        && node "${repository_root}/scripts/verify-deployment-health.mjs" \
          "${response}" "${service}" "${environment}" "${DEPLOYMENT_SHA}"; then
        rm -f -- "${response}" "${headers}"
        return 0
      fi
    fi
    if (( attempt < 20 )); then
      sleep 3
    fi
  done

  rm -f -- "${response}" "${headers}"
  echo "Healthcheck mislukt: ${service}." >&2
  return 1
}

verify_health_matrix() {
  local require_worker=${1:-true}
  check_health_url control "http://127.0.0.1:${CONTROL_BIND_PORT}/api/health"
  check_health_url player "http://127.0.0.1:${PLAYER_BIND_PORT}/healthz"
  if [[ ${environment} == production ]]; then
    check_health_url marketing "http://127.0.0.1:${MARKETING_BIND_PORT}/api/health"
  fi

  check_health_url control "https://${CONTROL_HOST}/api/health"
  check_health_url player "https://${PLAYER_HOST}/healthz"
  if [[ ${environment} == production ]]; then
    check_health_url marketing "https://${MARKETING_HOST}/api/health"
  fi
  if [[ ${require_worker} == true ]]; then
    check_worker_readiness
  fi
}

check_worker_readiness() {
  local attempt container_id docker_health expected_image actual_image env_is_exact probe_result
  probe_result="nog geen probe uitgevoerd"
  docker_health="onbekend"
  for attempt in $(seq 1 24); do
    if probe_result=$("${WORKER_COMPOSE_ARGS[@]}" exec -T media-worker node -e \
      "fetch('http://127.0.0.1:3100/readyz').then(async r=>{const b=await r.json();const valid=r.ok&&b.status==='ready'&&b.service==='VeyoCast Media Worker'&&b.environment==='${environment}'&&b.revision==='${DEPLOYMENT_SHA}';process.stdout.write(JSON.stringify({environment:b.environment,httpStatus:r.status,revision:b.revision,service:b.service,status:b.status,valid}));if(!valid)process.exitCode=1}).catch(e=>{process.stdout.write(JSON.stringify({error:e instanceof Error?e.name:'unknown',valid:false}));process.exitCode=1})" 2>&1); then
      return 0
    fi

    # `docker compose exec` kan op een drukke rootless host tijdelijk geen
    # extra proces starten terwijl de reeds draaiende container wel gezond is.
    # De ingebouwde Docker-healthcheck bevraagt exact hetzelfde /readyz
    # endpoint. Accepteer die alleen wanneer containerimage én niet-geheime
    # runtime-identiteit exact bij deze geautoriseerde release horen.
    container_id=$("${WORKER_COMPOSE_ARGS[@]}" ps -q media-worker 2>/dev/null || true)
    if [[ -n ${container_id} ]]; then
      docker_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${container_id}" 2>/dev/null || true)
      actual_image=$(docker inspect --format '{{.Image}}' "${container_id}" 2>/dev/null || true)
      expected_image=$(metadata_image_id media-worker 2>/dev/null || true)
      # De JavaScript-template-expressies worden bewust pas door Node
      # geëvalueerd; Bash mag deze single-quoted bron niet expanderen.
      # shellcheck disable=SC2016
      if docker inspect --format '{{json .Config.Env}}' "${container_id}" 2>/dev/null \
        | EXPECTED_ENVIRONMENT="${environment}" EXPECTED_REVISION="${DEPLOYMENT_SHA}" node -e '
            let input = "";
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", (chunk) => { input += chunk; });
            process.stdin.on("end", () => {
              try {
                const values = JSON.parse(input);
                const environment = values.find((value) => value.startsWith("VEYOCAST_ENVIRONMENT="));
                const revision = values.find((value) => value.startsWith("DEPLOYMENT_SHA="));
                if (
                  environment !== `VEYOCAST_ENVIRONMENT=${process.env.EXPECTED_ENVIRONMENT}` ||
                  revision !== `DEPLOYMENT_SHA=${process.env.EXPECTED_REVISION}`
                ) process.exitCode = 1;
              } catch {
                process.exitCode = 1;
              }
            });
          '; then
        env_is_exact=true
      else
        env_is_exact=false
      fi
      if [[ ${docker_health} == healthy \
        && ${actual_image} == "${expected_image}" \
        && ${env_is_exact} == true ]]; then
        echo "Media-workerreadiness bevestigd via de ingebouwde Docker-healthcheck."
        return 0
      fi
    fi

    if (( attempt < 24 )); then
      sleep 3
    fi
  done
  echo "Readinesscheck mislukt: media-worker. Laatste veilige probe: ${probe_result}. Docker-health: ${docker_health}." >&2
  return 1
}

write_state_file() {
  local destination=$1 value=$2 temporary
  temporary=$(mktemp "${runtime_directory}/.$(basename "${destination}").XXXXXX")
  printf '%s\n' "${value}" > "${temporary}"
  chmod 0600 "${temporary}"
  mv -f "${temporary}" "${destination}"
}

commit_release_state() {
  local previous_revision deployed_at manifest_tmp
  previous_revision=""
  if [[ -r ${runtime_directory}/REVISION ]]; then
    previous_revision=$(<"${runtime_directory}/REVISION")
  fi

  deployed_at=$(date --utc +'%Y-%m-%dT%H:%M:%SZ')
  manifest_tmp=$(mktemp "${runtime_directory}/.RELEASE_MANIFEST.XXXXXX")
  RELEASE_SOURCE=${release_metadata} \
  RELEASE_PATH=${manifest_tmp} \
  RELEASE_ENVIRONMENT=${environment} \
  RELEASE_DEPLOYED_AT=${deployed_at} \
    node -e '
      const fs = require("node:fs");
      const release = JSON.parse(fs.readFileSync(process.env.RELEASE_SOURCE, "utf8"));
      fs.writeFileSync(process.env.RELEASE_PATH, JSON.stringify({
        ...release,
        deployedAt: process.env.RELEASE_DEPLOYED_AT,
        environment: process.env.RELEASE_ENVIRONMENT
      }, null, 2) + "\n", { mode: 0o600 });
    '
  chmod 0600 "${manifest_tmp}"

  if [[ ${previous_revision} != "${DEPLOYMENT_SHA}" ]]; then
    write_state_file "${runtime_directory}/PREVIOUS_REVISION" "${previous_revision}"
  fi
  write_state_file "${runtime_directory}/REVISION" "${DEPLOYMENT_SHA}"
  mv -f "${candidate_env_file}" "${runtime_directory}/.env.runtime"
  chmod 0600 "${runtime_directory}/.env.runtime"
  candidate_env_file=""
  mv -f "${manifest_tmp}" "${runtime_directory}/RELEASE_MANIFEST"
}

validate_staging_promotion() {
  [[ ${environment} == production ]] || return 0
  local staging_revision=/srv/apps/veyocast/staging/REVISION
  local staging_manifest=/srv/apps/veyocast/staging/RELEASE_MANIFEST
  if [[ ! -r ${staging_revision} || $(<"${staging_revision}") != "${DEPLOYMENT_SHA}" || ! -r ${staging_manifest} ]]; then
    echo "Production weigert een release die niet actief en gezond op staging staat." >&2
    return 1
  fi
  node -e '
    const fs = require("node:fs");
    const [stagingPath, releasePath, sha] = process.argv.slice(1);
    const staging = JSON.parse(fs.readFileSync(stagingPath, "utf8"));
    const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
    if (staging.environment !== "staging" || staging.revision !== sha) process.exit(1);
    for (const service of ["control", "marketing", "player", "media-worker"]) {
      if (staging.images?.[service]?.digest !== release.images?.[service]?.digest) process.exit(1);
    }
  ' "${staging_manifest}" "${release_metadata}" "${DEPLOYMENT_SHA}" || {
    echo "Production stagingbewijs komt niet overeen met de immutable release." >&2
    return 1
  }
}

cleanup_old_images() {
  local -a preserved=()
  local state_file value repository tag
  for state_file in \
    /srv/apps/veyocast/staging/REVISION \
    /srv/apps/veyocast/staging/PREVIOUS_REVISION \
    /srv/apps/veyocast/production/REVISION \
    /srv/apps/veyocast/production/PREVIOUS_REVISION; do
    if [[ -r ${state_file} ]]; then
      value=$(<"${state_file}")
      [[ ${value} =~ ^[0-9a-f]{40}$ ]] && preserved+=("${value}")
    fi
  done

  while read -r repository tag; do
    [[ ${repository} =~ ^veyocast-(control|marketing|player|media-worker)$ && ${tag} =~ ^[0-9a-f]{40}$ ]] || continue
    if [[ " ${preserved[*]} " != *" ${tag} "* ]]; then
      docker image rm "${repository}:${tag}" >/dev/null 2>&1 || true
    fi
  done < <(docker image ls --format '{{.Repository}} {{.Tag}}')
}

deploy_release() {
  run_preflight
  assert_release_checkout
  validate_release_images
  validate_staging_promotion
  create_candidate_env
  if [[ -s ${runtime_directory}/.env.runtime ]]; then
    previous_env_snapshot=$(mktemp "${runtime_directory}/.env.runtime.previous.XXXXXX")
    install -m 0600 "${runtime_directory}/.env.runtime" "${previous_env_snapshot}"
  fi
  compose_arguments
  validate_compose

  cd "${repository_root}"
  if [[ ${deployment_mode} == release ]]; then
    SUPABASE_DB_URL=${SUPABASE_DB_URL} \
    SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF} \
    GITHUB_SHA=${DEPLOYMENT_SHA} \
      bash scripts/migrate-supabase.sh dry-run
    mutation_started=true
    SUPABASE_DB_URL=${SUPABASE_DB_URL} \
    SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF} \
    GITHUB_SHA=${DEPLOYMENT_SHA} \
      bash scripts/migrate-supabase.sh apply
  else
    mutation_started=true
  fi

  "${COMPOSE_ARGS[@]}" up -d --no-build --remove-orphans
  "${WORKER_COMPOSE_ARGS[@]}" up -d --no-build --remove-orphans
  verify_health_matrix
  commit_release_state
  mutation_started=false
  cleanup_old_images
}

verify_active_release() {
  run_preflight
  if [[ ! -s ${runtime_directory}/.env.runtime || ! -s ${runtime_directory}/REVISION ]]; then
    echo "Er is geen actieve ${environment}-release om te verifiëren." >&2
    return 1
  fi
  DEPLOYMENT_SHA=$(<"${runtime_directory}/REVISION")
  export DEPLOYMENT_SHA
  WORKER_COMPOSE_ARGS=(docker compose -p "${WORKER_COMPOSE_PROJECT_NAME}" --env-file "${runtime_directory}/.env.runtime" --file "${worker_compose_file}")
  verify_health_matrix
}

case "${action}" in
  preflight)
    run_preflight
    ;;
  build-release)
    build_release
    ;;
  deploy)
    deploy_release
    ;;
  verify)
    verify_active_release
    ;;
  *)
    echo "Onbekende deploymentactie: ${action}." >&2
    exit 1
    ;;
esac
