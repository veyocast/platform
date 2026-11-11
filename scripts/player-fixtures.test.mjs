import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
