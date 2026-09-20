import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  try {
    const output = execFileSync("pnpm", ["exec", "supabase", "db", "query", "--db-url", env.SUPABASE_DB_URL, "--agent", "no", "--output-format", "json"],
      { input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 60_000, stdio: ["pipe", "pipe", "pipe"] });
    const rows = JSON.parse(output);
    if (!Array.isArray(rows)) throw new Error("INVALID_QUERY_RESPONSE");
    return rows;
  } catch { throw new Error("PUBLICATION_DATABASE_OPERATION_FAILED: inspect protected database logs; no credentials or raw database errors are printed"); }
}
const tenants = query(`select id,name,status from public.tenants where name=${literal(tenantName)};`);
if (tenants.length !== 1 || tenants[0].status !== "active") throw new Error("EXACT_ACTIVE_TENANT_REQUIRED");
const tenant = tenants[0];
if (env.EXPECTED_TENANT_ID && tenant.id !== env.EXPECTED_TENANT_ID) throw new Error("TENANT_ID_MISMATCH");
const expanded = query("select to_regclass('public.playlist_publications') is not null as available;")[0]?.available === true;
if (!expanded && mode !== "inventory") throw new Error("PUBLICATION_DATABASE_MIGRATION_REQUIRED");
const inventoryFile = expanded ? "current-publication-inventory.sql" : "legacy-publication-inventory.sql";
const sql = readFileSync(new URL(`./sql/${inventoryFile}`, import.meta.url), "utf8").replaceAll("__TENANT_ID__", `${literal(tenant.id)}::uuid`);
const inventory = () => {
  const started = performance.now();
  const report = query(sql)[0]?.report;
  if (!report || !Array.isArray(report.playlists) || !Array.isArray(report.screens)) throw new Error("INVALID_PUBLICATION_INVENTORY");
  return { ...report, inventoryCommandMs: Math.round(performance.now() - started) };
};
const before = inventory();
const outputDirectory = env.RUNNER_TEMP ?? "/tmp";
writeFileSync(join(outputDirectory, "publication-before.json"), JSON.stringify(before, null, 2));
const changes = [];
if (mode !== "inventory") {
  const prefix = targetEnvironment === "staging" ? "staging-" : "";
  for (const [app, path] of [["control", "/api/health"], ["player", "/healthz"]]) {
    const response = await fetch(`https://${prefix}${app}.veyocast.nl${path}`, { signal: AbortSignal.timeout(10_000) });
    const health = await response.json();
    if (!response.ok || health.revision !== sha) throw new Error(`DEPLOYED_${app.toUpperCase()}_SHA_MISMATCH`);
  }
}
if (mode === "refresh") {
  changes.push(query(`select private.refresh_used_publication_sources_v1(${literal(tenant.id)}::uuid,${literal(sha)},${literal(reason)},${literal(operator)}) as result;`)[0]?.result);
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
    const result = query(`select private.cutover_current_publication_v1(${literal(tenant.id)}::uuid,${literal(playlist.id)}::uuid,
      ${literal(playlist.draftRevision)}::bigint,${literal(sha)},${literal(reason)},${literal(operator)}) as result;`)[0]?.result;
    changes.push({ ...result, commandRoundTripMs: Math.round(performance.now() - started) });
  }
}
let after = inventory();
const observations = [];
const deadline = performance.now() + observationSeconds * 1000;
while (performance.now() < deadline) {
  observations.push({ observedAt: after.observedAt, screens: after.screens });
  await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Math.max(1, deadline - performance.now()))));
  after = inventory();
}
if (observations.length) writeFileSync(join(outputDirectory, "publication-observations.json"), JSON.stringify(observations, null, 2));
writeFileSync(join(outputDirectory, "publication-after.json"), JSON.stringify({ operation: mode, deploymentSha: sha, changes, ...after }, null, 2));
console.log(JSON.stringify({ operation: mode, tenant: tenant.name, tenantId: tenant.id, usedPlaylists: after.playlists.length,
  screens: after.screens.length, changedConfigurations: changes.filter((change) => change.configurationChanged).length,
  legacyPending: after.legacyPending, retention: after.retention, report: "publication-after.json" }, null, 2));
