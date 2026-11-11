import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";

const script = resolve("scripts/ensure-build-capacity.sh");
async function runCapacity(scenario) {
  const root = mkdtempSync(join(tmpdir(), "vc-capacity-"));
  const bin = join(root, "bin"), dockerRoot = join(root, "docker"), socket = join(root, "docker.sock");
  mkdirSync(bin); mkdirSync(dockerRoot);
  const server = createServer();
  await new Promise(resolveListening => server.listen(socket, resolveListening));
  const commands = {
    hostname: "printf 'dg-deploy-vps-01\\n'",
    id: 'if [[ $1 == -un ]]; then echo deploy; else echo "$TEST_UID"; fi',
    pgrep: 'case "$TEST_SCENARIO" in active) exit 0;; process-error) exit 2;; *) exit 1;; esac',
    df: `echo Avail
if [[ $TEST_SCENARIO == invalid-space ]]; then echo invalid; exit; fi
if [[ $TEST_SCENARIO == healthy || ( -f $TEST_ROOT/pruned && $TEST_SCENARIO != low ) ]]; then echo 18000000000; else echo 3000000000; fi`,
    docker: `printf '%s\\n' "$*" >> "$TEST_ROOT/trace"
[[ $1 == --host && $2 == "$DOCKER_HOST" ]] || exit 97
shift 2
case "$1 $2" in
  'info --format')
    if [[ $3 == *SecurityOptions* ]]; then
      if [[ $TEST_SCENARIO == rootful ]]; then echo '[]'; else echo '["rootless"]'; fi
    else echo "$TEST_DOCKER_ROOT"; fi ;;
  'buildx inspect')
    echo 'Driver: docker'
    if [[ $TEST_SCENARIO == builder-mismatch ]]; then echo 'Endpoint: unix:///var/run/docker.sock'; else echo "Endpoint: $DOCKER_HOST"; fi ;;
  'image ls')
    if [[ $TEST_SCENARIO == image-change && -f $TEST_ROOT/pruned ]]; then echo changed; else echo original-image; fi ;;
  'ps --all') echo original-container ;;
  'volume ls') echo original-volume ;;
  'buildx prune')
    [[ $* == 'buildx prune --builder default --force --filter until=1h' ]] || exit 97
    touch "$TEST_ROOT/pruned" ;;
  *) exit 97 ;;
esac`
  };
  for (const [name, body] of Object.entries(commands)) {
    const path = join(bin, name);
    writeFileSync(path, `#!/bin/bash\nset -eu\n${body}\n`); chmodSync(path, 0o700);
  }
  writeFileSync(join(root, "trace"), "");
  try {
    const result = spawnSync("bash", [script], { cwd: root, encoding: "utf8", timeout: 5000,
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, DOCKER_HOST: `unix://${socket}`,
        GITHUB_REPOSITORY: "veyocast/platform", GITHUB_REF: "refs/heads/main", RUNNER_NAME: scenario === "wrong-runner" ? "unrelated" : "veyocast-staging-01",
        TEST_ROOT: root, TEST_DOCKER_ROOT: dockerRoot, TEST_SCENARIO: scenario, TEST_UID: String(process.getuid()) } });
    return { ...result, trace: readFileSync(join(root, "trace"), "utf8") };
  } finally {
    await new Promise(resolveClosed => server.close(resolveClosed));
    rmSync(root, { recursive: true, force: true });
  }
}

test("sufficient capacity preserves all reusable cache without pruning", async () => {
  const result = await runCapacity("healthy");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /build_capacity_ready/);
  assert.doesNotMatch(result.trace, /prune/);
});

test("pressure reclaims only old unused local builder cache and proves protected sets unchanged", async () => {
  const result = await runCapacity("recover");
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.trace.match(/buildx prune/g) ?? []).length, 1);
  assert.match(result.trace, /buildx prune --builder default --force --filter until=1h/);
  assert.doesNotMatch(result.trace, /image rm|container rm|volume rm|system prune/);
  assert.match(result.stdout, /"phase":"after"/);
});

for (const [scenario, code] of [["wrong-runner", "RUNNER_SCOPE_INVALID"], ["rootful", "ROOTLESS_DAEMON_REQUIRED"],
  ["builder-mismatch", "BUILDER_ENDPOINT_MISMATCH"], ["active", "ACTIVE_BUILD_PROCESS"],
  ["process-error", "PROCESS_READ_INVALID"], ["invalid-space", "SPACE_READ_INVALID"]]) {
  test(`${scenario} refuses maintenance without pruning`, async () => {
    const result = await runCapacity(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(code));
    assert.doesNotMatch(result.trace, /prune/);
  });
}

for (const [scenario, code] of [["low", "INSUFFICIENT_BUILD_HEADROOM"], ["image-change", "PROTECTED_RESOURCES_CHANGED"]]) {
  test(`${scenario} prevents a build after the single bounded maintenance attempt`, async () => {
    const result = await runCapacity(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(code));
    assert.equal((result.trace.match(/buildx prune/g) ?? []).length, 1);
  });
}
