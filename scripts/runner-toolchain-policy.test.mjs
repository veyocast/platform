import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isolatedPnpmDestination, validateRunnerToolchains } from "./runner-toolchain-policy.mjs";

function workflow(runner, destination = isolatedPnpmDestination, job = "probe") {
  return `jobs:\n  ${job}:\n    runs-on: ${runner}\n    steps:\n      - name: Setup pnpm\n        uses: pnpm/action-setup@pinned\n        with:\n          version: 11.5.2\n${destination ? `          dest: ${destination}\n` : ""}`;
}

test("self-hosted default/shared destinations fail closed", () => {
  for (const destination of ["", "~/setup-pnpm", "${{ runner.temp }}/pnpm", "${{ runner.temp }}/pnpm-${{ github.run_id }}"]) {
    assert.throws(() => validateRunnerToolchains([workflow("[self-hosted, linux, production]", destination)]), /NOT_ISOLATED/);
  }
});

test("each shared-host job is checked independently", () => {
  const combined = workflow("[self-hosted, staging]", isolatedPnpmDestination, "build")
    + workflow("[self-hosted, production]", "", "probe").replace(/^jobs:\n/, "");
  assert.throws(() => validateRunnerToolchains([combined]), /NOT_ISOLATED/);
  assert.equal(validateRunnerToolchains([workflow("[self-hosted, staging]")]), 1);
});

test("multiline and dynamic runner routes require isolation", () => {
  for (const runner of ["\n      - self-hosted\n      - staging", "${{ inputs.runner }}", "*shared-runner"]) {
    assert.throws(() => validateRunnerToolchains([workflow(runner, "")]), /NOT_ISOLATED/);
    assert.equal(validateRunnerToolchains([workflow(runner)]), 1);
  }
});

test("a hosted job cannot exempt a later shared-host job", () => {
  const combined = workflow("ubuntu-latest", "", "hosted")
    + workflow("[self-hosted, production]", "", "probe").replace(/^jobs:\n/, "");
  assert.throws(() => validateRunnerToolchains([combined]), /NOT_ISOLATED/);
  assert.equal(validateRunnerToolchains([workflow("ubuntu-24.04", "")]), 0);
});

test("wrong-step destination does not satisfy pnpm isolation", () => {
  const value = workflow("[self-hosted, staging]", "")
    + `      - uses: unrelated/action@pinned\n        with:\n          dest: ${isolatedPnpmDestination}\n`;
  assert.throws(() => validateRunnerToolchains([value]), /NOT_ISOLATED/);
});

test("quoted job names and compact step indentation cannot hide shared defaults", () => {
  const quoted = workflow("[self-hosted, staging]", "").replace("  probe:", '  "probe":');
  assert.throws(() => validateRunnerToolchains([quoted]), /NOT_ISOLATED/);
  const compact = (workflow("[self-hosted, staging]")
    + "      - uses: pnpm/action-setup@pinned\n        with:\n          version: 11.5.2\n")
    .replaceAll("      - ", "    - ");
  assert.throws(() => validateRunnerToolchains([compact]), /NOT_ISOLATED/);
});

test("quoted action values/keys and repository casing cannot bypass the guard", () => {
  for (const value of ['"pnpm/action-setup@v6"', "'pnpm/action-setup@v6'", "PNPM/action-setup@v6"]) {
    const unsafe = workflow("[self-hosted, staging]", "").replace("pnpm/action-setup@pinned", value);
    assert.throws(() => validateRunnerToolchains([unsafe]), /NOT_ISOLATED/);
    const safe = workflow("[self-hosted, staging]").replace("pnpm/action-setup@pinned", value);
    assert.equal(validateRunnerToolchains([safe]), 1);
  }
  const quotedKeys = workflow("[self-hosted, staging]", "")
    .replace("jobs:", '"jobs":').replace("uses:", '"uses":');
  assert.throws(() => validateRunnerToolchains([quotedKeys]), /NOT_ISOLATED/);
  const secondUnsafe = workflow("[self-hosted, staging]")
    + '      - "uses": "pnpm/action-setup@v6"\n        with:\n          version: 11.5.2\n';
  assert.throws(() => validateRunnerToolchains([secondUnsafe]), /NOT_ISOLATED/);
});

test("concurrent job bootstrap deletion preserves another job's executable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-pnpm-isolation-"));
  const resolveDestination = (run, attempt, job) => isolatedPnpmDestination
    .replace("${{ runner.temp }}", directory).replace("${{ github.run_id }}", run)
    .replace("${{ github.run_attempt }}", attempt).replace("${{ github.job }}", job);
  const build = resolveDestination("100", "1", "build");
  const probe = resolveDestination("101", "1", "probe");
  try {
    await mkdir(build); await mkdir(probe);
    await writeFile(join(build, "pnpm"), "active-build-executable");
    // The pinned installer's destructive bootstrap acts only on its own dest.
    await rm(probe, { recursive: true, force: true }); await mkdir(probe);
    assert.equal(await readFile(join(build, "pnpm"), "utf8"), "active-build-executable");
    assert.notEqual(build, resolveDestination("100", "2", "build"));
    assert.notEqual(build, resolveDestination("100", "1", "probe"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
