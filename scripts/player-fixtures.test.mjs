import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fixtureContext, sealPlayerFixtures, verifyPlayerFixtures } from "./player-fixtures.mjs";

const environment = { GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" };
const context = fixtureContext(environment);
function fixture(run) {
  const temporary = mkdtempSync(join(tmpdir(), "veyocast-shared-fixtures-"));
  const root = join(temporary, "player-fixtures");
  try {
    mkdirSync(join(root, "backgrounds"), { recursive: true });
    writeFileSync(join(root, "backgrounds/registry.json"), "{}");
    for (const directory of ["onzetrots-v1", "onzetrots-v9"]) {
      mkdirSync(join(root, directory));
      for (const name of ["artifact.json", "presentation.json", "assets.json", "standings-full.mp4", "standings-poster.png"])
        writeFileSync(join(root, directory, name), `${directory}/${name}`);
    }
    run(root, temporary);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

test("all fixture bytes and identity round-trip without rewriting any producer output", () => fixture(root => {
  const before = readFileSync(join(root, "onzetrots-v9/standings-full.mp4"));
  const report = sealPlayerFixtures(root, context);
  assert.equal(report.files.length, 11);
  assert.deepEqual(verifyPlayerFixtures(root, context), report);
  assert.deepEqual(readFileSync(join(root, "onzetrots-v9/standings-full.mp4")), before);
  assert.throws(() => sealPlayerFixtures(root, context));
}));

test("source, workflow run, attempt and pinned CLI identities cannot be substituted", () => {
  for (const [name, value] of [["GITHUB_SHA", "main"], ["GITHUB_RUN_ID", "0"], ["GITHUB_RUN_ATTEMPT", "01"]])
    assert.throws(() => fixtureContext({ ...environment, [name]: value }));
  assert.throws(() => fixtureContext(environment, "1.61.2"));
  fixture(root => {
    sealPlayerFixtures(root, context);
    for (const [name, value] of [["revision", "b".repeat(40)], ["runId", "124"], ["runAttempt", "2"], ["cliVersion", "1.61.2"]])
      assert.throws(() => verifyPlayerFixtures(root, { ...context, [name]: value }));
  });
});

for (const mutation of ["changed", "missing", "extra", "empty", "symlink", "hardlink", "receipt"]) {
  test(`downloaded ${mutation} fixture content fails closed`, () => fixture((root, temporary) => {
    sealPlayerFixtures(root, context);
    const target = join(root, "onzetrots-v9/standings-full.mp4");
    if (mutation === "changed") writeFileSync(target, "different content");
    if (mutation === "missing") rmSync(target);
    if (mutation === "extra") writeFileSync(join(root, "extra"), "extra content");
    if (mutation === "empty") writeFileSync(target, "");
    if (mutation === "symlink") symlinkSync(temporary, join(root, "escape"));
    if (mutation === "hardlink") linkSync(target, join(temporary, "shared-file"));
    if (mutation === "receipt") writeFileSync(join(root, "fixtures.json"), "{}");
    assert.throws(() => verifyPlayerFixtures(root, context));
  }));
}

test("a partial producer cannot be sealed", () => fixture(root => {
  rmSync(join(root, "onzetrots-v9/standings-poster.png"));
  assert.throws(() => sealPlayerFixtures(root, context));
}));

test("the real CLI validates the exact runner-owned download and rejects an old attempt", () => fixture((root, temporary) => {
  sealPlayerFixtures(root, context);
  const env = { ...process.env, ...environment, RUNNER_TEMP: temporary, PLAYWRIGHT_FIXTURE_ROOT: root };
  const run = options => spawnSync(process.execPath, ["scripts/player-fixtures.mjs", "verify"], { env: { ...env, ...options }, encoding: "utf8" });
  assert.equal(run({}).status, 0);
  assert.notEqual(run({ GITHUB_RUN_ATTEMPT: "2" }).status, 0);
  assert.notEqual(run({ PLAYWRIGHT_FIXTURE_ROOT: temporary }).status, 0);
}));

for (const failHelper of [false, true]) {
  test(`the actual orchestration starts without a fixture parent and ${failHelper ? "never seals a failed helper" : "seals all helper outputs"}`, () => {
    const temporary = mkdtempSync(join(tmpdir(), "vc-fixture-runner-"));
    const bin = join(temporary, "bin");
    mkdirSync(bin);
    const commands = {
      ffmpeg: "exit 0", ffprobe: "exit 0",
      node: 'if [[ $1 == --input-type=module ]]; then printf /bin/true; else exec "$TEST_NODE" "$@"; fi',
      pnpm: `[[ $1 == exec && $2 == tsx ]] || exit 97
if [[ $3 == tests/helpers/sync-background-binary.ts ]]; then
  mkdir "$S238_BACKGROUND_BINARIES"
  printf '{}' > "$S238_BACKGROUND_BINARIES/registry.json"
else
  [[ $3 == tests/helpers/sync-onzetrots-export.ts ]] || exit 97
  if [[ \${6:-} == sync-onzetrots-v9 && $TEST_FAIL_HELPER == true ]]; then exit 42; fi
  mkdir "$4"
  for name in artifact.json presentation.json assets.json standings-full.mp4 standings-poster.png; do printf fixture > "$4/$name"; done
fi`
    };
    for (const [name, command] of Object.entries(commands)) writeFileSync(join(bin, name), `#!/bin/bash\nset -eu\n${command}\n`, { mode: 0o700 });
    try {
      const result = spawnSync("bash", ["scripts/prepare-player-fixtures.sh"], { encoding: "utf8", timeout: 5000,
        env: { ...process.env, ...environment, PATH: `${bin}:/usr/bin:/bin`, RUNNER_TEMP: temporary,
          TEST_NODE: process.execPath, TEST_FAIL_HELPER: String(failHelper) } });
      assert.equal(result.status, failHelper ? 42 : 0, result.stderr);
      assert.equal(existsSync(join(temporary, "player-fixtures/fixtures.json")), !failHelper);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
}
