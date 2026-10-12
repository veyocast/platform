import console from "node:console";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDatabaseCliConfig } from "./database-cli-config.mjs";
import { executePublicationQuery } from "./publication-database-query.mjs";

const env = process.env;
const mode = env.PUBLICATION_OPERATION ?? "inventory";
const targetEnvironment = env.TARGET_ENVIRONMENT;
const tenantName = env.TENANT_NAME?.trim();
const sha = env.EXPECTED_RELEASE_SHA;
const operator = env.OPERATOR;
const reason = env.REASON;
const selectedPlaylist = env.PLAYLIST_ID?.trim();
const observationSeconds = Number(env.OBSERVATION_SECONDS ?? "0");
if (!["inventory", "refresh", "cutover"].includes(mode) || !["staging", "production"].includes(targetEnvironment) ||
    !tenantName || tenantName.length > 120 || !/^[0-9a-f]{40}$/.test(sha ?? "") ||
    !/^github:[A-Za-z0-9-]{1,39}$/.test(operator ?? "") || !reason || reason.length < 10 || reason.length > 240 ||
    env.GITHUB_REF !== "refs/heads/main" || !env.SUPABASE_DB_URL ||
    (selectedPlaylist && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(selectedPlaylist)) ||
    !Number.isInteger(observationSeconds) || observationSeconds < 0 || observationSeconds > 180) throw new Error("PUBLICATION_OPERATION_INVALID");
const databaseCliConfig = getDatabaseCliConfig(env.SUPABASE_DB_URL, env.PGCONNECT_TIMEOUT);
const databaseCommandTimeout = Math.min(130_000, Math.max(60_000, (databaseCliConfig.connectTimeoutSeconds + 10) * 1000));
console.log(JSON.stringify({ event: "database_connection_budget", seconds: databaseCliConfig.connectTimeoutSeconds, source: databaseCliConfig.budgetSource }));
const operationController = new globalThis.AbortController();
let interruptedExitCode;
const interrupted = (exitCode) => {
  interruptedExitCode ??= exitCode;
  operationController.abort();
};
const onInterrupt = () => interrupted(130);
const onTerminate = () => interrupted(143);
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function query(phase, sql) {
  console.log(JSON.stringify({ event: "publication_database_query_started", phase, timeoutMs: databaseCommandTimeout }));
  return executePublicationQuery({ phase, databaseUrl: databaseCliConfig.databaseUrl, sql, timeoutMs: databaseCommandTimeout, signal: operationController.signal },
    { onDiagnostic: (diagnostic) => console.log(JSON.stringify(diagnostic)) });
}
async function maintainPublication() {
  const tenants = await query("tenant_lookup", `select id,name,status from public.tenants where name=${literal(tenantName)};`);
  if (tenants.length !== 1 || tenants[0].status !== "active") throw new Error("EXACT_ACTIVE_TENANT_REQUIRED");
  const tenant = tenants[0];
  if (env.EXPECTED_TENANT_ID && tenant.id !== env.EXPECTED_TENANT_ID) throw new Error("TENANT_ID_MISMATCH");
  const expanded = (await query("schema_presence", "select to_regclass('public.playlist_publications') is not null as available;"))[0]?.available === true;
  if (!expanded && mode !== "inventory") throw new Error("PUBLICATION_DATABASE_MIGRATION_REQUIRED");
  const inventoryFile = expanded ? "current-publication-inventory.sql" : "legacy-publication-inventory.sql";
  const sql = readFileSync(new URL(`./sql/${inventoryFile}`, import.meta.url), "utf8").replaceAll("__TENANT_ID__", `${literal(tenant.id)}::uuid`);
  const inventory = async () => {
    const started = performance.now();
    const report = (await query("inventory_report", sql))[0]?.report;
    if (!report || !Array.isArray(report.playlists) || !Array.isArray(report.screens)) throw new Error("INVALID_PUBLICATION_INVENTORY");
    return { ...report, inventoryCommandMs: Math.round(performance.now() - started) };
  };
  const before = await inventory();
  const outputDirectory = env.RUNNER_TEMP ?? "/tmp";
  writeFileSync(join(outputDirectory, "publication-before.json"), JSON.stringify(before, null, 2));
  const changes = [];
  if (mode !== "inventory") {
    const prefix = targetEnvironment === "staging" ? "staging-" : "";
    for (const [app, path] of [["control", "/api/health"], ["player", "/healthz"]]) {
      const response = await globalThis.fetch(`https://${prefix}${app}.veyocast.nl${path}`, {
        signal: globalThis.AbortSignal.any([operationController.signal, globalThis.AbortSignal.timeout(10_000)]) });
      const health = await response.json();
      if (!response.ok || health.revision !== sha) throw new Error(`DEPLOYED_${app.toUpperCase()}_SHA_MISMATCH`);
    }
  }
  if (mode === "refresh") {
    changes.push((await query("refresh_command", `select private.refresh_used_publication_sources_v1(${literal(tenant.id)}::uuid,${literal(sha)},${literal(reason)},${literal(operator)}) as result;`))[0]?.result);
  }
  if (mode === "cutover") {
    if (before.theme?.timezone !== "Europe/Amsterdam" || before.theme?.policy?.kind !== "fixed" || before.theme?.policy?.mode !== "light") {
      throw new Error("FIXED_LIGHT_AMSTERDAM_PRECONDITION_REQUIRED");
    }
    // Each playlist is a separate atomic, resumable operation. Network work never
    // runs while the database holds its assignment locks.
    const playlists = selectedPlaylist ? before.playlists.filter((playlist) => playlist.id === selectedPlaylist) : before.playlists;
    if (!playlists.length) throw new Error("USED_PLAYLIST_REQUIRED");
    for (const playlist of playlists) {
      const started = performance.now();
      const result = (await query("cutover_command", `select private.cutover_current_publication_v1(${literal(tenant.id)}::uuid,${literal(playlist.id)}::uuid,
        ${literal(playlist.draftRevision)}::bigint,${literal(sha)},${literal(reason)},${literal(operator)}) as result;`))[0]?.result;
      changes.push({ ...result, commandRoundTripMs: Math.round(performance.now() - started) });
    }
  }
  let after = await inventory();
  const observations = [];
  const deadline = performance.now() + observationSeconds * 1000;
  while (performance.now() < deadline) {
    observations.push({ observedAt: after.observedAt, screens: after.screens });
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Math.max(1, deadline - performance.now()))));
    after = await inventory();
  }
  if (observations.length) writeFileSync(join(outputDirectory, "publication-observations.json"), JSON.stringify(observations, null, 2));
  writeFileSync(join(outputDirectory, "publication-after.json"), JSON.stringify({ operation: mode, deploymentSha: sha, changes, ...after }, null, 2));
  console.log(JSON.stringify({ operation: mode, tenant: tenant.name, tenantId: tenant.id, usedPlaylists: after.playlists.length,
    screens: after.screens.length, changedConfigurations: changes.filter((change) => change.configurationChanged).length,
    legacyPending: after.legacyPending, retention: after.retention, report: "publication-after.json" }, null, 2));
}
try { await maintainPublication(); }
catch (error) {
  if (!operationController.signal.aborted) throw error;
  console.log(JSON.stringify({ event: "publication_operation_interrupted", code: "PUBLICATION_OPERATION_INTERRUPTED" }));
  process.exitCode = interruptedExitCode;
} finally {
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
}
