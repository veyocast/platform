import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

// Reuses the real rollback-only SQL acceptance setup and its actual RPC output.
// No hosted endpoint, provider request, credentials or device token is involved.
const port = process.env.S298_LOCAL_DB_PORT ?? "64432";
assert.match(port, /^\d{4,5}$/);
const sqlPath = "supabase/tests/s298_effective_planning.sql";
const source = readFileSync(sqlPath, "utf8");
const ending = "select *from finish();\nrollback;";
assert.equal(source.split(ending).length, 2);
const sql = source.replace(ending, `reset role;
select jsonb_build_object('s298Evidence',jsonb_build_object(
  'current',(select value from facts where key='before-preview'),
  'proposal',(select value from facts where key='proposal-report')));
rollback;`);
const executed = spawnSync("psql", ["-XAtq", "-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sql, env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 45_000
});
assert.equal(executed.status, 0, "isolated SQL acceptance must complete");
assert(!/^\s*not ok\b/m.test(executed.stdout), "SQL acceptance contains a failed assertion");
const line = executed.stdout.split("\n").find(value => value.startsWith('{"s298Evidence":'));
assert(line, "actual RPC evidence is required");
const result = {
  schemaVersion: 1, fixture: true, actualHostedStaging: false,
  source: { path: sqlPath, sha256: createHash("sha256").update(source).digest("hex") },
  ...JSON.parse(line).s298Evidence
};
const output = process.env.S298_PLANNING_FIXTURE ?? "tests/fixtures/s298-effective-planning.json";
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: "PASS", output, assertions: executed.stdout.split("\n").filter(value => /^ok \d+\b/.test(value)).length,
  currentWinner: result.current.screens[0].winner.name, nextWinner: result.current.screens[0].next.winner.name,
  fixture: true, hostedStaging: false })}\n`);
