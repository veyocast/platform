import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { discoverGateGroups, validatePlayerShardClosures } from "./run-browser-gates.mjs";

try {
  const root = resolve(process.env.PLAYWRIGHT_PLAYER_SHARD_REPORTS);
  const closures = readdirSync(root, { withFileTypes: true }).map(entry => {
    if (!entry.isDirectory()) throw new Error("PLAYER_SHARD_ARTIFACT_INVALID");
    return JSON.parse(readFileSync(join(root, entry.name, "case-closure.json"), "utf8"));
  });
  const combined = validatePlayerShardClosures(closures, {
    shardCount: Number(process.env.PLAYWRIGHT_PLAYER_SHARD_COUNT), files: discoverGateGroups().player,
    context: { revision: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT }
  });
  const output = resolve(process.env.PLAYWRIGHT_PLAYER_CLOSURE_OUTPUT);
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "case-closure.json"), JSON.stringify(combined, null, 2), { mode: 0o600 });
  process.stdout.write(`Player closure: ${combined.executions.length}/${combined.caseCount} original cases; ${combined.files.length} spec files; ${combined.shardCount} isolated shards.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "PLAYER_SHARD_AGGREGATION_FAILED"}\n`);
  process.exitCode = 1;
}
