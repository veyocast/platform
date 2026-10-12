import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(repository, "scripts/deploy-vps.sh"), "utf8");
// Execute the production functions and traps unchanged, replacing only external
// boundaries. The script's CLI bootstrap must never reach Docker or a database.
const functions = [...source.matchAll(/^([A-Za-z_][A-Za-z_0-9]*)\(\) \{[\s\S]*?^\}/gm)];
for (const name of [
  "cleanup", "restore_previous_release", "quiesce_previous_worker",
  "recover_interrupted_deployment", "on_exit", "on_error",
  "verify_health_matrix", "deploy_release"
]) {
  assert.ok(functions.some((match) => match[1] === name), `Missing deployment function: ${name}`);
}
const shellFunctions = functions.map((match) => match[0]).join("\n\n");
const shellTraps = source.match(/^trap .+$/gm)?.join("\n");
assert.ok(shellTraps, "Deployment traps must be present");
const initialState = source.slice(0, source.indexOf("\ncase ")).split("\n")
  .filter((line) => /^(mutation_started|quiesced_worker_id|recovery_failed|candidate_env_file|temporary_marketing_container|previous_env_snapshot|rendered_compose_file|rendered_worker_compose_file)=/.test(line))
  .join("\n");
const oldSha = "a".repeat(40);
const nextSha = "b".repeat(40);
const workerId = "c".repeat(64);
const oldImage = `sha256:${"d".repeat(64)}`;
const fixtures = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

test("dry-run ERR restores the armed old worker before cleanup without applying migrations", () => {
  const run = runDeployment("dry-run-fail");
  assert.equal(run.result.status, 41);
  assertRecovery(run);
  assert.ok(run.trace.includes("migrate:dry-run"));
  assert.ok(!run.trace.includes("migrate:apply"));
  assert.ok(!run.trace.some((event) => event.startsWith("compose-up:")));
  assert.equal(readFileSync(join(run.runtime, "REVISION"), "utf8").trim(), oldSha);
  assert.deepEqual(run.backups, []);
});

for (const [signal, exitCode] of [["TERM", 143], ["INT", 130]]) {
  test(`${signal} during dry-run exits ${exitCode} and restores before cleanup`, () => {
    const run = runDeployment(`signal-${signal}`);
    assert.equal(run.result.status, exitCode);
    assertRecovery(run);
    assert.ok(!run.trace.includes("migrate:apply"));
    assert.deepEqual(run.backups, []);
  });
}

test("an interrupted first stop is completed before starting the same draining worker", () => {
  const run = runDeployment("stop-fail");
  assert.equal(run.result.status, 42);
  assertRecovery(run);
  assert.ok(!run.trace.includes("migrate:dry-run"));
  assert.ok(run.trace.includes(`stop:${workerId}:2`));
  assert.ok(!run.trace.includes("start-noop-draining"));
});

test("apply failure uses the old immutable release rollback instead of early same-ID restart", () => {
  const run = runDeployment("apply-fail");
  assert.equal(run.result.status, 41);
  assert.ok(run.trace.includes("migrate:apply"));
  assert.ok(run.trace.includes(`compose-up:apps:${oldSha}`));
  assert.ok(run.trace.includes(`compose-up:worker:${oldSha}`));
  assert.ok(run.trace.includes(`health:worker:${oldSha}`));
  assert.ok(!run.trace.some((event) => event.startsWith("start:")));
  assert.ok(!run.trace.some((event) => event.includes(`compose-up:apps:${nextSha}`)));
  assert.deepEqual(run.backups, []);
});

test("successful deployment commits the new release and never restarts the old worker", () => {
  const run = runDeployment("success");
  assert.equal(run.result.status, 0);
  assert.ok(run.trace.includes(`compose-up:apps:${nextSha}`));
  assert.ok(run.trace.includes(`compose-up:worker:${nextSha}`));
  assert.equal(readFileSync(join(run.runtime, "REVISION"), "utf8").trim(), nextSha);
  assert.match(readFileSync(join(run.runtime, ".env.runtime"), "utf8"), new RegExp(`DEPLOYMENT_SHA=${nextSha}`));
  assert.equal(run.trace.filter((event) => event.startsWith("stop:")).length, 1);
  assert.ok(!run.trace.some((event) => event.startsWith("start:")));
  assert.deepEqual(run.backups, []);
});

for (const scenario of ["restore-stop-fail", "restore-start-fail", "restore-inspect-fail"]) {
  test(`${scenario} preserves the protected previous configuration and original failure`, () => {
    const run = runDeployment(scenario);
    assert.equal(run.result.status, 41);
    assert.equal(run.backups.length, 1);
    assert.match(readFileSync(join(run.runtime, run.backups[0]), "utf8"), new RegExp(`DEPLOYMENT_SHA=${oldSha}`));
    assert.match(run.result.stderr, /herstel kon niet worden bevestigd/);
    assert.ok(!readdirSync(run.runtime).some((name) => name.startsWith(".env.runtime.candidate.")));
  });
}

test("a failed restoration converts an otherwise successful EXIT into a failure", () => {
  const run = runDeployment("restore-failure-zero-exit");
  assert.equal(run.result.status, 1);
  assert.equal(run.backups.length, 1);
  assert.match(run.result.stderr, /herstel kon niet worden bevestigd/);
});

test("rollback worker compose failure is propagated and retains the recovery configuration", () => {
  const run = runDeployment("rollback-worker-fail");
  assert.equal(run.result.status, 41);
  assert.equal(run.backups.length, 1);
  assert.match(run.result.stderr, /workerrollback faalde/);
  assert.ok(!run.trace.includes(`health:worker:${oldSha}`));
});

test("an early rollback health failure cannot be masked by later passing healthchecks", () => {
  const run = runDeployment("rollback-control-fail");
  assert.equal(run.result.status, 41);
  assert.equal(run.backups.length, 1);
  assert.ok(run.trace.includes(`health:control:local:${oldSha}`));
  assert.ok(!run.trace.includes(`health:player:local:${oldSha}`));
  assert.ok(!run.trace.includes(`health:worker:${oldSha}`));
});

test("the health matrix propagates the first failure when called conditionally", () => {
  const run = runDeployment("matrix-control-fail", "if verify_health_matrix; then exit 0; else exit 63; fi");
  assert.equal(run.result.status, 63);
  assert.deepEqual(run.trace.filter((event) => event.startsWith("health:")), [`health:control:local:${nextSha}`]);
});

test("candidate health failure restores the old release without committing the new revision", () => {
  const run = runDeployment("candidate-health-fail");
  assert.equal(run.result.status, 1);
  assert.ok(run.trace.includes(`compose-up:apps:${nextSha}`));
  assert.ok(run.trace.includes(`compose-up:apps:${oldSha}`));
  assert.ok(run.trace.includes(`health:worker:${oldSha}`));
  assert.equal(readFileSync(join(run.runtime, "REVISION"), "utf8").trim(), oldSha);
});

for (const scenario of ["wrong-image", "wrong-environment", "multiple-workers"]) {
  test(`${scenario} is rejected before any worker stop or database operation`, () => {
    const run = runDeployment(scenario);
    assert.equal(run.result.status, 1);
    assert.ok(!run.trace.some((event) => /^(stop:|start:|migrate:|compose-up:)/.test(event)));
    assert.equal(readFileSync(join(run.directory, "worker-state"), "utf8").trim(), "running");
  });
}

test("a missing running worker does not start or stop a previously inactive service", () => {
  const run = runDeployment("no-running-worker");
  assert.equal(run.result.status, 0);
  assert.ok(run.trace.includes("migrate:apply"));
  assert.ok(!run.trace.some((event) => /^(stop:|start:)/.test(event)));
});

test("migration-list failure runs one bounded diagnostic, preserves exit17 and never pushes", () => {
  const run = runMigration("list-fail", "apply");
  assert.equal(run.result.status, 17);
  assert.deepEqual(run.trace, ["migration-safety", "migration-list", "transport-diagnostic"]);
});

for (const [mode, expected] of [
  ["dry-run", ["migration-safety", "migration-list", "db-push-dry-run"]],
  ["apply", ["migration-safety", "migration-list", "db-push-dry-run", "db-push-apply"]]
]) {
  test(`successful ${mode} retains the normal migration order without diagnostics`, () => {
    const run = runMigration("success", mode);
    assert.equal(run.result.status, 0);
    assert.deepEqual(run.trace, expected);
  });
}

test("a migration safety failure prevents both database connections and diagnostics", () => {
  const run = runMigration("safety-fail", "apply");
  assert.equal(run.result.status, 19);
  assert.deepEqual(run.trace, ["migration-safety"]);
});

function runMigration(scenario, mode) {
  const directory = mkdtempSync(join(tmpdir(), "veyocast-migration-lifecycle-"));
  fixtures.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const traceFile = join(directory, "trace");
  writeFileSync(traceFile, "");
  writeFileSync(join(bin, "node"), `#!/usr/bin/env bash
set -Eeuo pipefail
case "$1" in
  scripts/check-migration-safety.mjs)
    printf 'migration-safety\\n' >> "$TEST_TRACE"
    [[ $SCENARIO != safety-fail ]] || exit 19 ;;
  scripts/probe-database-transport.mjs)
    printf 'transport-diagnostic\\n' >> "$TEST_TRACE"
    exit 1 ;;
  *) printf 'unexpected-node\\n' >> "$TEST_TRACE"; exit 97 ;;
esac
`, { mode: 0o700 });
  writeFileSync(join(bin, "pnpm"), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ $1 != exec || $2 != supabase || $5 != --db-url || $6 != "$SUPABASE_DB_URL" ]]; then
  printf 'unexpected-pnpm\\n' >> "$TEST_TRACE"; exit 97
fi
if [[ $3 == migration && $4 == list && $# == 6 ]]; then
  printf 'migration-list\\n' >> "$TEST_TRACE"
  [[ $SCENARIO != list-fail ]] || exit 17
elif [[ $3 == db && $4 == push && $# == 8 && $7 == --dry-run && $8 == --yes ]]; then
  printf 'db-push-dry-run\\n' >> "$TEST_TRACE"
elif [[ $3 == db && $4 == push && $# == 7 && $7 == --yes ]]; then
  printf 'db-push-apply\\n' >> "$TEST_TRACE"
else
  printf 'unexpected-pnpm\\n' >> "$TEST_TRACE"; exit 97
fi
`, { mode: 0o700 });
  const result = spawnSync("bash", [join(repository, "scripts/migrate-supabase.sh"), mode], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TEST_TRACE: traceFile,
      SCENARIO: scenario,
      SUPABASE_DB_URL: "postgresql://fixture:synthetic-password@fixture.invalid/postgres",
      SUPABASE_PROJECT_REF: "fixture",
      GITHUB_SHA: nextSha
    },
    encoding: "utf8", timeout: 8_000, maxBuffer: 1024 * 1024
  });
  assert.equal(result.error, undefined);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-password|postgresql:\/\//);
  const trace = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
  assert.ok(!trace.some((event) => event.startsWith("unexpected")));
  return { result, trace };
}

function runDeployment(scenario, entrypoint = "deploy_release") {
  const directory = mkdtempSync(join(tmpdir(), "veyocast-deployment-lifecycle-"));
  fixtures.push(directory);
  const runtime = join(directory, "runtime");
  const releases = join(directory, "releases");
  mkdirSync(runtime);
  for (const sha of [oldSha, nextSha]) {
    mkdirSync(join(releases, sha), { recursive: true });
    writeFileSync(join(releases, sha, "RELEASE_METADATA"), JSON.stringify({
      revision: sha,
      images: Object.fromEntries(["control", "marketing", "player", "media-worker"].map((service) => [service, { digest: oldImage }]))
    }));
    writeFileSync(join(releases, sha, "SERVER_ACTIONS_KEY_FINGERPRINT"), "synthetic-fingerprint\n");
  }
  writeFileSync(join(runtime, ".env.runtime"), `DEPLOYMENT_SHA=${oldSha}\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=synthetic-old-key\n`, { mode: 0o600 });
  writeFileSync(join(runtime, "REVISION"), `${oldSha}\n`);
  writeFileSync(join(directory, "worker-state"), "running\n");
  writeFileSync(join(directory, "stop-count"), "0\n");
  writeFileSync(join(directory, "trace"), "");
  const variables = {
    TEST_DIRECTORY: directory, TEST_TRACE: join(directory, "trace"), SCENARIO: scenario,
    TEST_OLD_SHA: oldSha, TEST_NEXT_SHA: nextSha, TEST_WORKER_ID: workerId, TEST_OLD_IMAGE: oldImage,
    repository_root: directory, runtime_directory: runtime, release_root: releases,
    DEPLOYMENT_SHA: nextSha, release_directory: join(releases, nextSha),
    release_metadata: join(releases, nextSha, "RELEASE_METADATA"),
    release_key_fingerprint: join(releases, nextSha, "SERVER_ACTIONS_KEY_FINGERPRINT"),
    environment: "production", deployment_mode: "release", compose_project: "veyocast-production",
    COMPOSE_PROJECT_NAME: "veyocast-production", WORKER_COMPOSE_PROJECT_NAME: "veyocast-production-worker",
    compose_file: join(repository, "infra/vps/compose.yaml"), worker_compose_file: join(repository, "infra/vps/worker.compose.yaml"),
    CONTROL_BIND_PORT: "23000", PLAYER_BIND_PORT: "23001", MARKETING_BIND_PORT: "23002",
    CONTROL_HOST: "control.fixture.invalid", PLAYER_HOST: "player.fixture.invalid", MARKETING_HOST: "marketing.fixture.invalid",
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-key", NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "synthetic-next-key",
    DEVICE_LAB_ACCESS_TOKEN: "synthetic-device-token", DEVICE_LAB_SESSION_SECRET: "synthetic-device-secret",
    SUPABASE_DB_URL: "postgresql://fixture.invalid/postgres", SUPABASE_PROJECT_REF: "fixture"
  };
  const program = [
    "set -Eeuo pipefail", "umask 077", initialState,
    ...Object.entries(variables).map(([name, value]) => `${name}=${shellQuote(value)}`),
    shellFunctions, mocks, shellTraps, entrypoint
  ].join("\n\n");
  const result = spawnSync("bash", ["-c", program], { encoding: "utf8", timeout: 8_000, maxBuffer: 1024 * 1024 });
  assert.equal(result.error, undefined, "The isolated Bash harness must finish within its deadline");
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-server-key|synthetic-device-token|synthetic-device-secret|synthetic-next-key|synthetic-old-key/);
  const trace = readFileSync(join(directory, "trace"), "utf8").trim().split("\n").filter(Boolean);
  assert.ok(!trace.some((event) => event.startsWith("unexpected:")), `Unexpected boundary invocation: ${trace.join("\n")}`);
  return { directory, runtime, result, trace, backups: readdirSync(runtime).filter((name) => name.startsWith(".env.runtime.previous.")) };
}

function assertRecovery(run) {
  const restarted = run.trace.indexOf(`start:${workerId}`);
  assert.ok(restarted >= 0, "The exact old container must be restarted");
  assert.ok(run.trace.indexOf(`stop:${workerId}:2`) < restarted, "A possibly draining process must finish stopping before restart");
  const cleanup = run.trace.findIndex((event) => event.startsWith("cleanup:"));
  assert.ok(cleanup > restarted, "Restoration must precede cleanup");
  assert.equal(readFileSync(join(run.directory, "worker-state"), "utf8").trim(), "running");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const mocks = String.raw`
record() { printf '%s\n' "$*" >> "$TEST_TRACE"; }
run_preflight() { record preflight; }
assert_release_checkout() { record checkout; }
validate_release_images() { record "validate-images:$DEPLOYMENT_SHA"; }
validate_staging_promotion() { record staging-promotion; }
validate_compose() { record compose-validation; }
cleanup_old_images() { record image-cleanup; }
show_sanitized_logs() { record sanitized-logs; }
rm() { record "cleanup:$*"; command rm "$@"; }
check_health_url() {
  local locality=local
  [[ $2 != https://* ]] || locality=public
  record "health:$1:$locality:$DEPLOYMENT_SHA"
  if [[ $1 == control && ( $SCENARIO == matrix-control-fail || ( $SCENARIO == rollback-control-fail && $DEPLOYMENT_SHA == "$TEST_OLD_SHA" ) || ( $SCENARIO == candidate-health-fail && $DEPLOYMENT_SHA == "$TEST_NEXT_SHA" ) ) ]]; then return 49; fi
}
check_worker_readiness() { record "health:worker:$DEPLOYMENT_SHA"; }
bash() {
  if [[ $1 != scripts/migrate-supabase.sh ]]; then record "unexpected:bash:$*"; return 97; fi
  record "migrate:$2"
  if [[ $2 == dry-run ]]; then
    case "$SCENARIO" in
      dry-run-fail|restore-stop-fail|restore-start-fail|restore-inspect-fail) return 41 ;;
      signal-TERM) kill -TERM "$$" ;;
      signal-INT) kill -INT "$$" ;;
      restore-failure-zero-exit) exit 0 ;;
    esac
  elif [[ $SCENARIO == apply-fail || $SCENARIO == rollback-worker-fail || $SCENARIO == rollback-control-fail ]]; then return 41; fi
}
docker() {
  local format argument env_file= project= operation= count state revision kind
  case "$1" in
    ps)
      record "docker-ps:$*"
      [[ $SCENARIO != no-running-worker ]] || return 0
      printf '%s\n' "$TEST_WORKER_ID"
      [[ $SCENARIO != multiple-workers ]] || printf '%064d\n' 0
      return 0 ;;
    inspect)
      format=$3
      case "$format" in
        '{{.Image}}')
          if [[ $SCENARIO == wrong-image ]]; then printf 'sha256:%064d\n' 0; else printf '%s\n' "$TEST_OLD_IMAGE"; fi ;;
        '{{.State.Running}}')
          if [[ $SCENARIO == restore-inspect-fail && -e $TEST_DIRECTORY/started ]]; then return 48; fi
          state=$(<"$TEST_DIRECTORY/worker-state")
          if [[ $state == stopped ]]; then printf 'false\n'; else printf 'true\n'; fi ;;
        '{{json .Config.Env}}')
          if [[ $SCENARIO == wrong-environment ]]; then argument=staging; else argument=production; fi
          printf '["VEYOCAST_ENVIRONMENT=%s","DEPLOYMENT_SHA=%s","SUPABASE_SERVICE_ROLE_KEY=synthetic-server-key"]\n' "$argument" "$TEST_OLD_SHA" ;;
        *) record "unexpected:inspect:$*"; return 97 ;;
      esac ;;
    stop)
      [[ $2 == --time && $3 == 70 && $4 == "$TEST_WORKER_ID" ]] || { record "unexpected:stop:$*"; return 97; }
      count=$(<"$TEST_DIRECTORY/stop-count"); count=$(( count + 1 ))
      printf '%s\n' "$count" > "$TEST_DIRECTORY/stop-count"
      record "stop:$4:$count"
      printf 'draining\n' > "$TEST_DIRECTORY/worker-state"
      if [[ $SCENARIO == stop-fail && $count == 1 ]]; then return 42; fi
      if [[ $SCENARIO == restore-stop-fail && $count == 2 ]]; then return 43; fi
      printf 'stopped\n' > "$TEST_DIRECTORY/worker-state" ;;
    start)
      [[ $2 == "$TEST_WORKER_ID" ]] || { record "unexpected:start:$*"; return 97; }
      record "start:$2"
      if [[ $SCENARIO == restore-start-fail || $SCENARIO == restore-failure-zero-exit ]]; then return 44; fi
      state=$(<"$TEST_DIRECTORY/worker-state")
      if [[ $state == draining ]]; then record start-noop-draining; return 0; fi
      printf 'running\n' > "$TEST_DIRECTORY/worker-state"
      printf 'yes\n' > "$TEST_DIRECTORY/started" ;;
    compose)
      shift
      while (( $# > 0 )); do
        case "$1" in
          -p) project=$2; shift ;;
          --env-file) env_file=$2; shift ;;
          up|down) operation=$1 ;;
        esac
        shift
      done
      [[ $operation == up && -n $env_file && -n $project ]] || { record "unexpected:compose:$operation"; return 97; }
      revision=$(sed -n 's/^DEPLOYMENT_SHA=//p' "$env_file")
      if [[ $project == *-worker ]]; then kind=worker; else kind=apps; fi
      record "compose-up:$kind:$revision"
      if [[ $SCENARIO == rollback-worker-fail && $kind == worker && $revision == "$TEST_OLD_SHA" ]]; then return 45; fi
      if [[ $kind == worker ]]; then printf 'running\n' > "$TEST_DIRECTORY/worker-state"; fi ;;
    *) record "unexpected:docker:$*"; return 97 ;;
  esac
}
`;
