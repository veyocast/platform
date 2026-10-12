import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath, URL } from "node:url";
import { getDatabaseCliConfig } from "./database-cli-config.mjs";

const uri = "postgresql://fixture:synthetic%24password%3A%2F%40@fixture.invalid:5432/postgres";
const script = fileURLToPath(new URL("./database-cli-config.mjs", import.meta.url));
const invalidCode = "DATABASE_CONNECTION_CONFIG_INVALID";

test("an absent timeout receives the bounded default without rewriting credentials", () => {
  assert.deepEqual(getDatabaseCliConfig(uri), {
    databaseUrl: `${uri}?connect_timeout=45`, connectTimeoutSeconds: 45, budgetSource: "default"
  });
});

test("all original TLS, option, host-list and encoded query bytes survive appending", () => {
  const original = `${uri.replace("fixture.invalid:5432", "fixture.invalid:5432,second.invalid:6543")}?sslmode=verify-full&sslrootcert=%2Fprivate%2Froot%20ca.pem&sslcert=%2Fprivate%2Fclient.pem&sslkey=%2Fprivate%2Fkey.pem&options=-c%20statement_timeout%3D20000&application_name=fixture%2Bname`;
  const config = getDatabaseCliConfig(original);
  assert.equal(config.databaseUrl, `${original}&connect_timeout=45`);
  assert.equal(config.databaseUrl.slice(0, original.length), original);
});

test("an explicit URI budget preserves the complete original URI and overrides the environment", () => {
  const original = `${uri}?sslmode=require&connect_timeout=%30%33%30&options=-c%20statement_timeout%3D20000#unchanged-fragment`;
  assert.deepEqual(getDatabaseCliConfig(original, "invalid-environment-value"), {
    databaseUrl: original, connectTimeoutSeconds: 30, budgetSource: "uri"
  });
});

test("an explicit environment budget is appended while preserving URI options", () => {
  const original = `${uri}?sslmode=verify-ca&sslrootcert=%2Fprivate%2Fca.pem`;
  assert.deepEqual(getDatabaseCliConfig(original, "120"), {
    databaseUrl: `${original}&connect_timeout=120`, connectTimeoutSeconds: 120, budgetSource: "environment"
  });
});

test("timeout appending respects empty queries, trailing separators and URI fragments", () => {
  for (const [original, prepared] of [
    [`${uri}?`, `${uri}?connect_timeout=45`],
    [`${uri}?sslmode=require&`, `${uri}?sslmode=require&connect_timeout=45`],
    [`${uri}#retained`, `${uri}?connect_timeout=45#retained`],
    [`${uri}?sslmode=require#retained`, `${uri}?sslmode=require&connect_timeout=45#retained`]
  ]) assert.equal(getDatabaseCliConfig(original).databaseUrl, prepared);
});

test("both supported PostgreSQL schemes and the inclusive budget bounds work", () => {
  for (const [original, seconds] of [[uri.replace("postgresql:", "postgres:"), "1"], [uri, "120"]]) {
    assert.equal(getDatabaseCliConfig(`${original}?connect_timeout=${seconds}`).connectTimeoutSeconds, Number(seconds));
    assert.equal(getDatabaseCliConfig(original, seconds).connectTimeoutSeconds, Number(seconds));
  }
});

test("duplicate decoded URI timeout names fail instead of selecting an ambiguous budget", () => {
  for (const query of ["connect_timeout=30&connect_timeout=45", "connect_timeout=30&%63onnect_timeout=30"]) {
    assert.throws(() => getDatabaseCliConfig(`${uri}?${query}`), { message: invalidCode });
  }
});

test("invalid explicit URI and environment budgets never fall back to the default", () => {
  for (const value of ["", "0", "121", "-1", "+1", "1.5", "45s", " 45", "1e2", "999999999999999999999", "synthetic-password"]) {
    assert.throws(() => getDatabaseCliConfig(`${uri}?connect_timeout=${encodeURIComponent(value)}`, "30"), { message: invalidCode });
    assert.throws(() => getDatabaseCliConfig(uri, value), { message: invalidCode });
  }
});

test("invalid URI configuration returns only the fixed error without a parser cause", () => {
  for (const value of [undefined, null, 45, "", "https://synthetic-password.invalid", `${uri}\nsecret`]) {
    assert.throws(() => getDatabaseCliConfig(value), (error) => {
      assert.equal(error.message, invalidCode);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("the summary CLI emits only the reviewed budget event", () => {
  for (const [databaseUrl, pgConnectTimeout, seconds, source] of [
    [uri, undefined, 45, "default"], [uri, "60", 60, "environment"], [`${uri}?connect_timeout=120`, "1", 120, "uri"]
  ]) {
    const result = runCli(["--summary"], databaseUrl, pgConnectTimeout);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), { event: "database_connection_budget", seconds, source });
    assert.doesNotMatch(result.stdout, /postgres|fixture|synthetic|password|ssl/);
  }
});

test("the private URL CLI returns only the prepared URI for command capture", () => {
  const original = `${uri}?sslmode=verify-full&sslrootcert=%2Fprivate%2Fca.pem`;
  const result = runCli(["--url"], original, "30");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${original}&connect_timeout=30\n`);
});

test("CLI invalid input and options reveal only the fixed code", () => {
  for (const [args, databaseUrl, pgConnectTimeout] of [
    [["--summary"], `${uri}?connect_timeout=0`, undefined],
    [["--url"], uri, "synthetic-password"],
    [["--summary"], undefined, undefined],
    [["--url", "unexpected-secret"], uri, undefined],
    [["--unknown"], uri, undefined]
  ]) {
    const result = runCli(args, databaseUrl, pgConnectTimeout);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `${invalidCode}\n`);
  }
});

function runCli(args, databaseUrl, pgConnectTimeout) {
  const env = { ...process.env };
  delete env.SUPABASE_DB_URL;
  delete env.PGCONNECT_TIMEOUT;
  if (databaseUrl !== undefined) env.SUPABASE_DB_URL = databaseUrl;
  if (pgConnectTimeout !== undefined) env.PGCONNECT_TIMEOUT = pgConnectTimeout;
  const result = spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.error, undefined);
  return result;
}
