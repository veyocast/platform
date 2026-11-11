import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const receipt = "fixtures.json";
const required = ["backgrounds/registry.json", ...["onzetrots-v1", "onzetrots-v9"].flatMap(directory =>
  ["artifact.json", "presentation.json", "assets.json", "standings-full.mp4", "standings-poster.png"].map(name => `${directory}/${name}`))];

export function fixtureContext(environment, cliVersion = "1.61.1") {
  const { GITHUB_SHA: revision, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: runAttempt } = environment;
  if (!/^[a-f0-9]{40}$/u.test(revision ?? "") || !/^[1-9][0-9]*$/u.test(runId ?? "") ||
      !/^[1-9][0-9]*$/u.test(runAttempt ?? "") || cliVersion !== "1.61.1") throw new Error("PLAYER_FIXTURE_CONTEXT_INVALID");
  return { revision, runId, runAttempt, cliVersion };
}

function inventory(root) {
  const files = [];
  function visit(directory, prefix = "") {
    const metadata = lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("PLAYER_FIXTURE_PATH_INVALID");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === receipt) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(relative) || entry.isSymbolicLink()) throw new Error("PLAYER_FIXTURE_PATH_INVALID");
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relative);
      else {
        const info = lstatSync(absolute);
        if (!info.isFile() || info.nlink !== 1 || info.size === 0) throw new Error("PLAYER_FIXTURE_PATH_INVALID");
        const bytes = readFileSync(absolute);
        files.push({ path: relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
  }
  visit(root);
  for (const path of required) if (!files.some(file => file.path === path)) throw new Error("PLAYER_FIXTURE_INCOMPLETE");
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export function sealPlayerFixtures(root, context) {
  const files = inventory(root);
  const report = { schemaVersion: 1, context, files };
  writeFileSync(join(root, receipt), JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  return report;
}

export function verifyPlayerFixtures(root, context) {
  const metadata = lstatSync(join(root, receipt));
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) throw new Error("PLAYER_FIXTURE_RECEIPT_INVALID");
  const report = JSON.parse(readFileSync(join(root, receipt), "utf8"));
  assert.deepEqual(report, { schemaVersion: 1, context, files: inventory(root) }, "PLAYER_FIXTURE_MISMATCH");
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.env.PLAYWRIGHT_FIXTURE_ROOT);
    if (!process.env.RUNNER_TEMP || root !== join(resolve(process.env.RUNNER_TEMP), "player-fixtures")) throw new Error("PLAYER_FIXTURE_ROOT_INVALID");
    const context = fixtureContext(process.env, createRequire(import.meta.url)("@playwright/test/package.json").version);
    const operation = process.argv[2];
    if (!["seal", "verify"].includes(operation)) throw new Error("PLAYER_FIXTURE_OPERATION_INVALID");
    const report = operation === "seal" ? sealPlayerFixtures(root, context) : verifyPlayerFixtures(root, context);
    process.stdout.write(JSON.stringify({ event: `player_fixtures_${operation}`, context, files: report.files.length,
      bytes: report.files.reduce((total, file) => total + file.bytes, 0) }) + "\n");
  } catch {
    process.stderr.write("PLAYER_FIXTURE_VALIDATION_FAILED\n");
    process.exitCode = 1;
  }
}
