import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { getDatabaseCliConfig } from "./database-cli-config.mjs";

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(repository, "scripts/deploy-vps.sh"), "utf8");
// Execute the production functions and traps unchanged, replacing only external
// boundaries. The script's CLI bootstrap must never reach Docker or a database.
const functions = [...source.matchAll(/^([A-Za-z_][A-Za-z_0-9]*)\(\) \{[\s\S]*?^\}/gm)];
for (const name of [
  "cleanup", "restore_previous_release", "quiesce_previous_worker",
  "recover_interrupted_deployment", "on_exit", "on_error",
  "verify_health_matrix", "deploy_release", "snapshot_runtime_state",
  "restore_runtime_state", "write_state_file", "commit_release_state"
]) {
  assert.ok(functions.some((match) => match[1] === name), `Missing deployment function: ${name}`);
}
const shellFunctions = functions.map((match) => match[0]).join("\n\n");
const shellTraps = source.match(/^trap .+$/gm)?.join("\n");
assert.ok(shellTraps, "Deployment traps must be present");
const initialState = source.slice(0, source.indexOf("\ncase ")).split("\n")
  .filter((line) => /^(mutation_started|quiesced_worker_id|recovery_failed|candidate_env_file|temporary_marketing_container|previous_env_snapshot|previous_state_directory|rendered_compose_file|rendered_worker_compose_file)=/.test(line))
  .join("\n");
const oldSha = "a".repeat(40);
const nextSha = "b".repeat(40);
const workerId = "c".repeat(64);
const oldImage = `sha256:${"d".repeat(64)}`;
const runtimeFiles = [".env.runtime", "REVISION", "PREVIOUS_REVISION", "RELEASE_MANIFEST"];
const fixtures = [];

const webApps = ["control", "player", "marketing"];
const retainedBuildFiles = [
  ".next/standalone/server.js", ".next/static/chunk.js", ".next/build-manifest.json",
  "public/asset.svg", "node_modules/fixture", ".turbo/fixture"
];

test("release build discards only its three Next caches after all gates and before Docker", () => {
  const run = runReleaseBuild();
  assert.equal(run.result.status, 77, run.result.stderr);
  assert.deepEqual(run.trace, [
    "pnpm:install --frozen-lockfile", "pnpm:lint --concurrency=2",
    "pnpm:typecheck --concurrency=2", "pnpm:test --concurrency=2",
    "pnpm:build --concurrency=2", "docker:build"
  ]);
  for (const app of webApps) assert.ok(!existsSync(join(run.root, "apps", app, ".next/cache")), app);
  assertRetainedBuildFiles(run.root);
  const diagnostic = JSON.parse(run.result.stdout.trim());
  assert.deepEqual(diagnostic.cachePaths, webApps.map((app) => `apps/${app}/.next/cache`));
  assert.equal(diagnostic.removedCacheCount, 3);
  assert.match(diagnostic.availableBytesBefore, /^\d+$/);
  assert.match(diagnostic.availableBytesAfter, /^\d+$/);
  assert.equal(BigInt(diagnostic.availableBytesDelta), BigInt(diagnostic.availableBytesAfter) - BigInt(diagnostic.availableBytesBefore));
});

for (const gate of ["install", "lint", "typecheck", "test", "build"]) {
  test(`failed ${gate} keeps every Next cache and prevents Docker`, () => {
    const run = runReleaseBuild({ failGate: gate });
    assert.equal(run.result.status, 43, run.result.stderr);
    for (const app of webApps) assert.ok(existsSync(join(run.root, "apps", app, ".next/cache/cached")));
    assert.ok(!run.trace.includes("docker:build"));
    assertRetainedBuildFiles(run.root);
  });
}

test("a checkout changed during the gates cannot authorize cache deletion or Docker", () => {
  const run = runReleaseBuild({ changedCheckout: true });
  assert.equal(run.result.status, 1, run.result.stderr);
  for (const app of webApps) assert.ok(existsSync(join(run.root, "apps", app, ".next/cache/cached")));
  assert.ok(!run.trace.includes("docker:build"));
});

for (const unsafePath of ["apps", "apps/marketing", "apps/marketing/.next", "apps/marketing/.next/cache"]) {
  test(`cache cleanup rejects symlink ${unsafePath} before deleting any other cache`, () => {
    const run = runReleaseBuild({ unsafePath });
    assert.equal(run.result.status, 1, run.result.stderr);
    assert.equal(readFileSync(join(run.outside, "sentinel"), "utf8"), "keep");
    if (unsafePath !== "apps") assert.ok(existsSync(join(run.root, "apps/control/.next/cache/cached")));
    assert.ok(!run.trace.includes("docker:build"));
  });
}

test("a non-directory cache fails before deleting another app cache", () => {
  const run = runReleaseBuild({ cacheFile: true });
  assert.equal(run.result.status, 1, run.result.stderr);
  assert.ok(existsSync(join(run.root, "apps/control/.next/cache/cached")));
  assert.equal(readFileSync(join(run.root, "apps/marketing/.next/cache"), "utf8"), "keep");
  assert.ok(!run.trace.includes("docker:build"));
});

test("an existing partial immutable release is rejected before gates or cache cleanup", () => {
  const run = runReleaseBuild({ partialRelease: true });
  assert.equal(run.result.status, 1, run.result.stderr);
  assert.match(run.result.stderr, /incompleet of gewijzigd en wordt niet overschreven/);
  assert.deepEqual(run.trace, []);
  for (const app of webApps) assert.ok(existsSync(join(run.root, "apps", app, ".next/cache/cached")));
  assertRetainedBuildFiles(run.root);
});

test("cache cleanup rejects a symlink checkout root", () => {
  const run = runReleaseBuild({ symlinkRoot: true });
  assert.equal(run.result.status, 1, run.result.stderr);
  for (const app of webApps) assert.ok(existsSync(join(run.root, "apps", app, ".next/cache/cached")));
  assert.ok(!run.trace.includes("docker:build"));
});

test("missing Next caches are harmless and a nested cache symlink cannot delete its target", () => {
  const run = runReleaseBuild({ missingCache: "marketing", nestedSymlink: true });
  assert.equal(run.result.status, 77, run.result.stderr);
  assert.equal(readFileSync(join(run.outside, "sentinel"), "utf8"), "keep");
  for (const app of webApps) assert.ok(!existsSync(join(run.root, "apps", app, ".next/cache")));
  assertRetainedBuildFiles(run.root);
  assert.equal(JSON.parse(run.result.stdout.trim()).removedCacheCount, 2);
});

for (const failApp of [null, ...webApps]) {
  test(`Docker web-builder clears each completed app cache in the same RUN (${failApp ?? "success"})`, () => {
    const run = runDockerWebBuild(failApp);
    assert.equal(run.result.status, failApp ? 43 : 0, run.result.stderr);
    const expected = failApp ? webApps.slice(0, webApps.indexOf(failApp) + 1) : webApps;
    assert.deepEqual(run.trace, expected);
    for (const app of expected) assert.equal(existsSync(join(run.root, "apps", app, ".next/cache")), app === failApp);
    assertRetainedBuildFiles(run.root);
  });
}

function assertRetainedBuildFiles(root) {
  for (const app of webApps) {
    for (const file of retainedBuildFiles) assert.equal(readFileSync(join(root, "apps", app, file), "utf8"), "keep", `${app}/${file}`);
  }
  assert.equal(readFileSync(join(root, "release/RELEASE_METADATA.json"), "utf8"), "immutable");
}

function releaseBuildFixture() {
  const directory = mkdtempSync(join(tmpdir(), "veyocast-build-cache-"));
  fixtures.push(directory);
  const root = join(directory, "checkout"), outside = join(directory, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "sentinel"), "keep");
  for (const app of webApps) {
    for (const file of [...retainedBuildFiles, ".next/cache/cached"]) {
      const path = join(root, "apps", app, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.endsWith("cached") ? "regenerable" : "keep");
    }
  }
  mkdirSync(join(root, "release"));
  writeFileSync(join(root, "release/RELEASE_METADATA.json"), "immutable");
  const traceFile = join(directory, "trace");
  writeFileSync(traceFile, "");
  return { directory, root, outside, traceFile };
}

function runReleaseBuild(options = {}) {
  const fixture = releaseBuildFixture();
  const { directory, root, outside, traceFile } = fixture;
  if (options.unsafePath) {
    rmSync(join(root, options.unsafePath), { recursive: true });
    symlinkSync(outside, join(root, options.unsafePath));
  }
  if (options.missingCache) rmSync(join(root, "apps", options.missingCache, ".next/cache"), { recursive: true });
  if (options.nestedSymlink) symlinkSync(outside, join(root, "apps/control/.next/cache/external"));
  if (options.cacheFile) {
    rmSync(join(root, "apps/marketing/.next/cache"), { recursive: true });
    writeFileSync(join(root, "apps/marketing/.next/cache"), "keep");
  }
  let checkout = root;
  if (options.symlinkRoot) {
    checkout = join(directory, "checkout-link");
    symlinkSync(root, checkout);
  }
  const program = `set -Eeuo pipefail
${shellFunctions}
run_preflight() { :; }
git() {
  [[ $* == "-C $repository_root rev-parse HEAD" ]] || return 98
  if [[ -e $TEST_DIRECTORY/checkout-changed ]]; then printf '%s\\n' '${oldSha}'; else printf '%s\\n' '${nextSha}'; fi
}
pnpm() {
  printf 'pnpm:%s\\n' "$*" >> "$TEST_TRACE"
  [[ $1 != "$TEST_FAIL_GATE" ]] || return 43
  if [[ $1 == build && $TEST_CHANGED_CHECKOUT == true ]]; then touch "$TEST_DIRECTORY/checkout-changed"; fi
}
docker() {
  if [[ $1 == image && $2 == inspect ]]; then return 1; fi
  [[ $1 == build ]] || return 98
  printf 'docker:build\\n' >> "$TEST_TRACE"
  return 77
}
build_release`;
  const result = spawnSync("bash", ["-c", program], {
    cwd: directory, encoding: "utf8", timeout: 5000,
    env: { ...process.env, repository_root: checkout, environment: "staging", DEPLOYMENT_SHA: nextSha,
      deployment_mode: "release", release_root: join(directory, "releases"), release_directory: join(directory, "releases", nextSha),
      release_metadata: options.partialRelease ? join(root, "release/RELEASE_METADATA.json") : join(directory, "absent-metadata"),
      release_key_fingerprint: join(directory, "absent-key"),
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "synthetic-fixture-only", TEST_DIRECTORY: directory, TEST_TRACE: traceFile,
      TEST_FAIL_GATE: options.failGate ?? "", TEST_CHANGED_CHECKOUT: String(options.changedCheckout ?? false) }
  });
  return { ...fixture, result, trace: readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean) };
}

function runDockerWebBuild(failApp) {
  const fixture = releaseBuildFixture();
  const dockerfile = readFileSync(join(repository, "infra/production/Dockerfile"), "utf8");
  const builder = dockerfile.split("FROM dependencies AS web-builder\n")[1].split("\nFROM ")[0];
  assert.equal((builder.match(/^RUN /gm) ?? []).length, 1, "build and cleanup must remain in one layer");
  // Execute the actual && chain, replacing only its container root with this
  // owned fixture. No Docker, installation, secret, or real app build is run.
  const chain = builder.slice(builder.indexOf("  pnpm --filter")).replaceAll("\\\n", " ").replaceAll("/app/apps/", `${fixture.root}/apps/`);
  for (const app of webApps) rmSync(join(fixture.root, "apps", app, ".next/cache"), { recursive: true });
  const program = `set -Eeuo pipefail
pnpm() {
  [[ $# == 3 && $1 == --filter && $3 == build ]] || return 98
  local app=\${2#@veyocast/} previous
  for previous in control player marketing; do
    [[ $previous != "$app" ]] || break
    [[ ! -e "$TEST_ROOT/apps/$previous/.next/cache" ]] || return 79
  done
  printf '%s\\n' "$app" >> "$TEST_TRACE"
  mkdir -p "$TEST_ROOT/apps/$app/.next/cache"
  touch "$TEST_ROOT/apps/$app/.next/cache/cached"
  [[ $app != "$TEST_FAIL_APP" ]] || return 43
}
${chain}`;
  const result = spawnSync("bash", ["-c", program], {
    encoding: "utf8", timeout: 5000,
    env: { ...process.env, TEST_ROOT: fixture.root, TEST_TRACE: fixture.traceFile, TEST_FAIL_APP: failApp ?? "" }
  });
  return { ...fixture, result, trace: readFileSync(fixture.traceFile, "utf8").trim().split("\n").filter(Boolean) };
}

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

test("a second TERM during recovery cannot interrupt restart and preserves the original143", () => {
  const run = runDeployment("second-TERM");
  assert.equal(run.result.status, 143);
  assertRecovery(run);
  assert.ok(run.trace.indexOf("second-TERM") < run.trace.indexOf(`start:${workerId}`));
  assertRuntimeRestored(run);
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
  assert.deepEqual(run.stateBackups, []);
});

for (const scenario of ["restore-stop-fail", "restore-start-fail", "restore-inspect-fail"]) {
  test(`${scenario} preserves the protected previous configuration and original failure`, () => {
    const run = runDeployment(scenario);
    assert.equal(run.result.status, 41);
    assert.equal(run.backups.length, 1);
    assertStateBackupRetained(run);
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

for (const file of runtimeFiles) {
  for (const [interruption, exitCode] of [["error", 51], ["TERM", 143]]) {
    test(`${interruption} after committing ${file} restores all four original runtime files`, () => {
      const run = runDeployment(`commit-${interruption}:${file}`);
      assert.equal(run.result.status, exitCode);
      assert.ok(run.trace.includes(`commit-interrupted:${file}`));
      assert.ok(run.trace.includes(`compose-up:apps:${oldSha}`));
      assert.ok(run.trace.includes(`health:worker:${oldSha}`));
      assert.ok(run.trace.some((event) => event.startsWith(`worker-readiness-env:${oldSha}:.env.runtime.previous.`)), "Rollback readiness must use the existing old environment snapshot");
      assertRuntimeRestored(run);
      assert.deepEqual(run.backups, []);
      assert.deepEqual(run.stateBackups, []);
    });
  }
}

test("INT after committing the candidate environment restores runtime files with exit130", () => {
  const run = runDeployment("commit-INT:.env.runtime");
  assert.equal(run.result.status, 130);
  assertRuntimeRestored(run);
  assert.deepEqual(run.stateBackups, []);
});

test("rollback removes newly written state files that were absent before deployment", () => {
  const run = runDeployment("commit-error:RELEASE_MANIFEST", "deploy_release", {
    missingRuntimeFiles: ["PREVIOUS_REVISION", "RELEASE_MANIFEST"]
  });
  assert.equal(run.result.status, 51);
  assertRuntimeRestored(run);
  assert.deepEqual(run.stateBackups, []);
});

test("a runtime-state restoration write failure retains both protected backups", () => {
  const run = runDeployment("state-restore-fail");
  assert.equal(run.result.status, 51);
  assert.ok(run.trace.includes("runtime-state-write-failed:REVISION"));
  assert.equal(run.backups.length, 1);
  assertStateBackupRetained(run);
  assert.equal(readFileSync(join(run.runtime, "REVISION"), "utf8").trim(), nextSha);
  assert.match(run.result.stderr, /Herstel van de opgeslagen releasestatus faalde/);
  assert.match(run.result.stderr, /herstel kon niet worden bevestigd/);
});

test("migration-list failure runs one bounded diagnostic, preserves exit17 and never pushes", () => {
  const run = runMigration("list-fail", "apply");
  assert.equal(run.result.status, 17);
  assert.deepEqual(run.trace, ["migration-safety", "connection-url", "connection-summary", "migration-list", "transport-diagnostic"]);
});

for (const [mode, expected] of [
  ["dry-run", ["migration-safety", "connection-url", "connection-summary", "migration-list", "db-push-dry-run"]],
  ["apply", ["migration-safety", "connection-url", "connection-summary", "migration-list", "db-push-dry-run", "db-push-apply"]]
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

test("migration commands respect URI and environment budgets while diagnostics retain the original URI", () => {
  for (const options of [
    { databaseUrl: "postgresql://fixture:synthetic-password@fixture.invalid/postgres?sslmode=verify-full&connect_timeout=120", pgConnectTimeout: "invalid" },
    { databaseUrl: "postgresql://fixture:synthetic-password@fixture.invalid/postgres?sslmode=require", pgConnectTimeout: "30" }
  ]) {
    const success = runMigration("success", "apply", options);
    assert.equal(success.result.status, 0);
    const failure = runMigration("list-fail", "apply", options);
    assert.equal(failure.result.status, 17);
    assert.equal(failure.trace.filter((event) => event === "transport-diagnostic").length, 1);
  }
});

test("invalid migration budgets fail before any database connection or diagnostic", () => {
  const run = runMigration("success", "apply", { pgConnectTimeout: "121" });
  assert.equal(run.result.status, 1);
  assert.deepEqual(run.trace, ["migration-safety", "connection-url"]);
  assert.equal(run.result.stdout, "");
  assert.equal(run.result.stderr, "DATABASE_CONNECTION_CONFIG_INVALID\n");
});

test("Marketing image health accepts only the exact healthy release and removes its temporary container", () => {
  const run = runMarketingHealth("success");
  assert.equal(run.result.status, 0);
  assert.equal(run.trace.filter((event) => event.startsWith("exec:")).length, 1);
  assert.ok(run.trace.includes("fetch-deadline:5000"));
  assert.ok(run.trace.includes("timeout:TERM:2s:8s"));
  assert.equal(run.trace.filter((event) => event === "remove").length, 1);
  assert.ok(!run.trace.includes("logs"));
});

for (const scenario of ["http-error", "invalid-shape", "wrong-sha", "request-hang", "body-hang"]) {
  test(`Marketing image health rejects ${scenario} within bounded retries and cleans up`, () => {
    const run = runMarketingHealth(scenario);
    assert.equal(run.result.status, 1);
    assert.equal(run.trace.filter((event) => event.startsWith("exec:")).length, 20);
    assert.equal(run.trace.filter((event) => event === "sleep:3").length, 19);
    if (scenario === "request-hang" || scenario === "body-hang") {
      assert.equal(run.trace.filter((event) => event === "fetch-aborted").length, 20);
    }
    assert.ok(run.trace.includes("logs"));
    assert.equal(run.trace.filter((event) => event === "remove").length, 1);
    assert.match(run.result.stderr, /Marketing-healthcheck is mislukt/);
  });
}

test("Marketing image health retries after a failed response without replacing the temporary container", () => {
  const run = runMarketingHealth("retry-success");
  assert.equal(run.result.status, 0);
  assert.equal(run.trace.filter((event) => event === "run").length, 1);
  assert.equal(run.trace.filter((event) => event.startsWith("exec:")).length, 2);
  assert.deepEqual(run.trace.filter((event) => event.startsWith("sleep:")), ["sleep:3"]);
  assert.equal(run.trace.filter((event) => event === "remove").length, 1);
});

test("Marketing image health kills a Docker exec that ignores TERM and can then recover", () => {
  const run = runMarketingHealth("exec-hang");
  assert.equal(run.result.status, 0);
  assert.ok(run.trace.includes("exec-hang-ready"));
  assert.equal(run.trace.filter((event) => event === "timeout:TERM:2s:8s").length, 2);
  assert.equal(run.trace.filter((event) => event.startsWith("exec:")).length, 2);
  assert.equal(run.trace.filter((event) => event === "remove").length, 1);
});

function runMarketingHealth(scenario) {
  const directory = mkdtempSync(join(tmpdir(), "veyocast-marketing-health-"));
  fixtures.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const traceFile = join(directory, "trace");
  writeFileSync(traceFile, "");
  const realTimeout = spawnSync("bash", ["-c", "command -v timeout"], { encoding: "utf8" });
  assert.equal(realTimeout.status, 0, "GNU timeout must be available for the Docker deadline regression");
  writeFileSync(join(bin, "timeout"), `#!/usr/bin/env bash
set -Eeuo pipefail
[[ $1 == --signal=TERM && $2 == --kill-after=2s && $3 == 8s && $4 == docker && $5 == exec ]] || exit 97
printf 'timeout:TERM:2s:8s\\n' >> "$TEST_TRACE"
# Exercise the real deadline and forced kill. Only the deliberately stalled
# process needs a short budget; normal Node startup has room on busy CI hosts.
deadline=2s
[[ $SCENARIO != exec-hang || -f $TEST_DIRECTORY/count ]] || deadline=0.2s
exec "$TEST_TIMEOUT_EXECUTABLE" --signal=TERM --kill-after=0.05s "$deadline" "${"$"}{@:4}"
`, { mode: 0o700 });
  writeFileSync(join(bin, "sleep"), `#!/usr/bin/env bash
set -Eeuo pipefail
[[ $# == 1 && $1 == 3 ]] || exit 97
printf 'sleep:%s\\n' "$1" >> "$TEST_TRACE"
`, { mode: 0o700 });
  writeFileSync(join(bin, "docker"), `#!/usr/bin/env bash
set -Eeuo pipefail
case "$1" in
  run)
    [[ $* == "run --detach --rm --name $TEST_CONTAINER --env DEPLOYMENT_SHA=$TEST_NEXT_SHA --env VEYOCAST_ENVIRONMENT=production veyocast-marketing:$TEST_NEXT_SHA" ]] || exit 97
    printf 'run\\n' >> "$TEST_TRACE" ;;
  exec)
    [[ $# == 5 && $2 == "$TEST_CONTAINER" && $3 == node && $4 == -e ]] || exit 97
    count=0
    [[ ! -f $TEST_DIRECTORY/count ]] || count=$(<"$TEST_DIRECTORY/count")
    count=$((count + 1))
    printf '%s\\n' "$count" > "$TEST_DIRECTORY/count"
    printf 'exec:%s\\n' "$count" >> "$TEST_TRACE"
    if [[ $SCENARIO == exec-hang && $count == 1 ]]; then
      trap '' TERM
      printf 'exec-hang-ready\\n' >> "$TEST_TRACE"
      while :; do :; done
    fi
    export TEST_ATTEMPT=$count
    exec "$TEST_NODE_EXECUTABLE" --import "$TEST_DIRECTORY/fetch-fixture.mjs" "$4" "$5" ;;
  rm)
    [[ $# == 3 && $2 == --force && $3 == "$TEST_CONTAINER" ]] || exit 97
    printf 'remove\\n' >> "$TEST_TRACE" ;;
  logs)
    [[ $# == 4 && $2 == --tail && $3 == 100 && $4 == "$TEST_CONTAINER" ]] || exit 97
    printf 'logs\\n' >> "$TEST_TRACE" ;;
  *) exit 97 ;;
esac
`, { mode: 0o700 });
  writeFileSync(join(directory, "fetch-fixture.mjs"), `import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
const record=value=>appendFileSync(process.env.TEST_TRACE,value+'\\n');
const realDeadline=AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout=milliseconds=>{
  assert.equal(milliseconds,5000);
  record('fetch-deadline:'+milliseconds);
  return realDeadline(35);
};
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:3002/api/health');
  const scenario=process.env.SCENARIO;
  const hang=()=>new Promise((resolve,reject)=>{
    record('fetch-hang:'+scenario+':'+(options?.signal?'bounded':'unbounded'));
    const keepAlive=setInterval(()=>{},1000);
    options?.signal?.addEventListener('abort',()=>{clearInterval(keepAlive);record('fetch-aborted');reject(options.signal.reason);},{once:true});
  });
  if(scenario==='request-hang')return hang();
  return {
    ok:scenario!=='http-error'&&!(scenario==='retry-success'&&process.env.TEST_ATTEMPT==='1'),
    json:async()=>{
      if(scenario==='body-hang')return hang();
      assert.ok(options?.signal instanceof AbortSignal,'the deadline must cover headers and body');
      if(scenario==='invalid-shape')return null;
      return {status:'ok',service:'marketing',environment:'production',revision:scenario==='wrong-sha'?'0'.repeat(40):process.env.TEST_NEXT_SHA};
    }
  };
};
`);
  const container = `veyocast-marketing-check-${nextSha.slice(0, 12)}-fixture`;
  const program = `set -Eeuo pipefail\n${initialState}\n${shellFunctions}\n${shellTraps}\nwait_for_marketing_image`;
  // A regressed shell can wait for its hanging child even after TERM. Separate
  // its process group and capture to files so inherited pipes cannot stall the
  // harness deadline; kill the complete fixture group before removing files.
  const stdoutFile = join(directory, "stdout"), stderrFile = join(directory, "stderr");
  const stdout = openSync(stdoutFile, "w"), stderr = openSync(stderrFile, "w");
  let result, cleanupError;
  try {
    result = spawnSync("bash", ["-c", program], {
      cwd: directory, detached: true,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_DIRECTORY: directory, TEST_TRACE: traceFile, SCENARIO: scenario,
        TEST_CONTAINER: container, TEST_NEXT_SHA: nextSha,
        TEST_TIMEOUT_EXECUTABLE: realTimeout.stdout.trim(), TEST_NODE_EXECUTABLE: process.execPath,
        DEPLOYMENT_SHA: nextSha, GITHUB_RUN_ID: "fixture"
      },
      stdio: ["ignore", stdout, stderr], timeout: 8_000, killSignal: "SIGKILL"
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
    if (result?.pid) {
      try { process.kill(-result.pid, "SIGKILL"); } catch (error) {
        if (error.code !== "ESRCH") cleanupError = error;
      }
    }
  }
  if (cleanupError) throw cleanupError;
  result.stdout = readFileSync(stdoutFile, "utf8");
  result.stderr = readFileSync(stderrFile, "utf8");
  assert.equal(result.error?.code, undefined, "the actual Marketing shell probe must finish within its deadlines");
  const trace = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
  return { result, trace };
}

function runMigration(scenario, mode, { databaseUrl = "postgresql://fixture:synthetic-password@fixture.invalid/postgres", pgConnectTimeout } = {}) {
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
    [[ $SUPABASE_DB_URL == "$TEST_ORIGINAL_DATABASE_URL" ]] || exit 97
    printf 'transport-diagnostic\\n' >> "$TEST_TRACE"
    exit 1 ;;
  scripts/database-cli-config.mjs)
    if [[ $2 == --url ]]; then printf 'connection-url\\n' >> "$TEST_TRACE";
    elif [[ $2 == --summary ]]; then printf 'connection-summary\\n' >> "$TEST_TRACE";
    else exit 97; fi
    exec "$TEST_NODE_EXECUTABLE" "$TEST_REPOSITORY/scripts/database-cli-config.mjs" "$2" ;;
  *) printf 'unexpected-node\\n' >> "$TEST_TRACE"; exit 97 ;;
esac
`, { mode: 0o700 });
  writeFileSync(join(bin, "pnpm"), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ $1 != exec || $2 != supabase || $5 != --db-url || $6 != "$TEST_DATABASE_CLI_URL" ]]; then
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
  const env = { ...process.env };
  delete env.PGCONNECT_TIMEOUT;
  if (pgConnectTimeout !== undefined) env.PGCONNECT_TIMEOUT = pgConnectTimeout;
  let config;
  try { config = getDatabaseCliConfig(databaseUrl, pgConnectTimeout); } catch { /* Invalid configuration must fail before pnpm. */ }
  const result = spawnSync("bash", [join(repository, "scripts/migrate-supabase.sh"), mode], {
    cwd: directory,
    env: {
      ...env,
      PATH: `${bin}:${process.env.PATH}`,
      TEST_TRACE: traceFile,
      TEST_NODE_EXECUTABLE: process.execPath,
      TEST_REPOSITORY: repository,
      TEST_DATABASE_CLI_URL: config?.databaseUrl ?? "",
      TEST_ORIGINAL_DATABASE_URL: databaseUrl,
      SCENARIO: scenario,
      SUPABASE_DB_URL: databaseUrl,
      SUPABASE_PROJECT_REF: "fixture",
      GITHUB_SHA: nextSha
    },
    encoding: "utf8", timeout: 8_000, maxBuffer: 1024 * 1024
  });
  assert.equal(result.error, undefined);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-password|postgresql:\/\//);
  const trace = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
  assert.ok(!trace.some((event) => event.startsWith("unexpected")));
  if (trace.includes("connection-summary")) {
    assert.deepEqual(JSON.parse(result.stdout), {
      event: "database_connection_budget", seconds: config.connectTimeoutSeconds, source: config.budgetSource
    });
  }
  return { result, trace };
}

function runDeployment(scenario, entrypoint = "deploy_release", { missingRuntimeFiles = [] } = {}) {
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
  const originalState = new Map([
    [".env.runtime", `DEPLOYMENT_SHA=${oldSha}\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=synthetic-old-key\n`],
    ["REVISION", `${oldSha}\n`],
    ["PREVIOUS_REVISION", `${"e".repeat(40)}\n`],
    ["RELEASE_MANIFEST", `${JSON.stringify({ revision: oldSha, environment: "production", original: true })}\n`]
  ]);
  for (const [name, contents] of originalState) {
    if (missingRuntimeFiles.includes(name)) originalState.set(name, undefined);
    else writeFileSync(join(runtime, name), contents, { mode: 0o600 });
  }
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
  const remaining = readdirSync(runtime);
  return {
    directory, runtime, result, trace, originalState,
    backups: remaining.filter((name) => name.startsWith(".env.runtime.previous.")),
    stateBackups: remaining.filter((name) => name.startsWith(".runtime-state.previous."))
  };
}

function assertRuntimeRestored(run) {
  for (const [name, contents] of run.originalState) {
    const file = join(run.runtime, name);
    if (contents === undefined) assert.ok(!existsSync(file), `${name} must retain its original absence`);
    else {
      assert.equal(readFileSync(file, "utf8"), contents, `${name} must be restored byte-for-byte`);
      assert.equal(statSync(file).mode & 0o777, 0o600, `${name} must remain protected`);
    }
  }
}

function assertStateBackupRetained(run) {
  assert.equal(run.stateBackups.length, 1);
  const directory = join(run.runtime, run.stateBackups[0]);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  for (const [name, contents] of run.originalState) {
    if (contents === undefined) continue;
    const file = join(directory, name);
    assert.equal(readFileSync(file, "utf8"), contents, `Retained ${name} must contain the original state`);
    assert.equal(statSync(file).mode & 0o777, 0o600);
  }
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
mv() {
  local destination=${"$"}{!#} name
  name=${"$"}{destination##*/}
  if [[ $SCENARIO == state-restore-fail && -e $TEST_DIRECTORY/commit-interrupted && $destination == "$runtime_directory/REVISION" ]]; then
    record runtime-state-write-failed:REVISION
    return 52
  fi
  command mv "$@" || return $?
  [[ $destination == "$runtime_directory/$name" ]] || return 0
  case "$name" in .env.runtime|REVISION|PREVIOUS_REVISION|RELEASE_MANIFEST) ;; *) return 0 ;; esac
  [[ ! -e $TEST_DIRECTORY/commit-interrupted ]] || return 0
  if [[ $SCENARIO == "commit-error:$name" || ( $SCENARIO == state-restore-fail && $name == .env.runtime ) ]]; then
    printf 'yes\n' > "$TEST_DIRECTORY/commit-interrupted"
    record "commit-interrupted:$name"
    return 51
  elif [[ $SCENARIO == "commit-TERM:$name" || $SCENARIO == "commit-INT:$name" ]]; then
    printf 'yes\n' > "$TEST_DIRECTORY/commit-interrupted"
    record "commit-interrupted:$name"
    if [[ $SCENARIO == commit-TERM:* ]]; then kill -TERM "$$"; else kill -INT "$$"; fi
  fi
}
check_health_url() {
  local locality=local
  [[ $2 != https://* ]] || locality=public
  record "health:$1:$locality:$DEPLOYMENT_SHA"
  if [[ $1 == control && ( $SCENARIO == matrix-control-fail || ( $SCENARIO == rollback-control-fail && $DEPLOYMENT_SHA == "$TEST_OLD_SHA" ) || ( $SCENARIO == candidate-health-fail && $DEPLOYMENT_SHA == "$TEST_NEXT_SHA" ) ) ]]; then return 49; fi
}
check_worker_readiness() {
  record "health:worker:$DEPLOYMENT_SHA"
  local argument env_file= prior=
  for argument in "${"$"}{WORKER_COMPOSE_ARGS[@]}"; do
    if [[ $prior == --env-file ]]; then env_file=$argument; break; fi
    prior=$argument
  done
  [[ -n $env_file && -r $env_file ]] || { record worker-readiness-env-missing; return 64; }
  [[ $(sed -n 's/^DEPLOYMENT_SHA=//p' "$env_file") == "$DEPLOYMENT_SHA" ]] || { record worker-readiness-env-wrong; return 65; }
  record "worker-readiness-env:$DEPLOYMENT_SHA:${"$"}{env_file##*/}"
}
bash() {
  if [[ $1 != scripts/migrate-supabase.sh ]]; then record "unexpected:bash:$*"; return 97; fi
  record "migrate:$2"
  if [[ $2 == dry-run ]]; then
    case "$SCENARIO" in
      dry-run-fail|restore-stop-fail|restore-start-fail|restore-inspect-fail) return 41 ;;
      signal-TERM|second-TERM) kill -TERM "$$" ;;
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
      if [[ $SCENARIO == second-TERM && $count == 2 ]]; then record second-TERM; kill -TERM "$$"; fi
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
