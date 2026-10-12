import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants, readFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { pathToFileURL, URL } from "node:url";
import { createSqlAdapter, diagnosticDatabaseConfig, tenantReadSql } from "./probe-runtime-database.mjs";
import { runtimeMetadataSql, sanitizeRuntimeMetadata } from "./publication-runtime-metadata.mjs";

const MAX_BODY = 65_536;
const SQL_DEADLINE = 52_000;
const template = readFileSync(new URL("./sql/current-publication-inventory.sql", import.meta.url), "utf8");
export const inventoryTemplateSha256 = createHash("sha256").update(template).digest("hex");
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const PG_CODES = new Set(["08001", "08006", "28P01", "28000", "42501", "57014", "53300", "57P01", "57P02", "57P03", "3D000", "42P01"]);
const CONNECT_CATEGORIES = new Map([
  ["failed to connect to postgres: SqlError: PgClient: Failed to connect", "SQL_CLIENT_CONNECT_FAILED"],
  ["failed to connect to postgres: SqlError: PgClient: Connection timed out", "SQL_CLIENT_DEADLINE"],
  ["failed to connect to postgres: SqlError: Failed to acquire connection", "SQL_POOL_ACQUIRE_FAILED"]
]);
const NODE_TYPES = new Set(["Aggregate", "Append", "Bitmap Heap Scan", "Bitmap Index Scan", "CTE Scan", "Custom Scan", "Foreign Scan", "Function Scan", "Gather", "Gather Merge", "Group", "Hash", "Hash Join", "Incremental Sort", "Index Only Scan", "Index Scan", "Limit", "LockRows", "Materialize", "Memoize", "Merge Append", "Merge Join", "Nested Loop", "ProjectSet", "Recursive Union", "Result", "Seq Scan", "SetOp", "Sort", "Subquery Scan", "Table Function Scan", "Tid Range Scan", "Tid Scan", "Unique", "Values Scan", "WindowAgg", "WorkTable Scan"]);
const RELATIONS = new Set(["content_schedules", "dynamic_data_sources", "dynamic_release_refresh_queue", "dynamic_slide_snapshots", "player_devices", "player_heartbeats", "player_sync_events", "playlist_items", "playlist_publications", "playlist_release_items", "playlist_releases", "playlists", "published_dynamic_data", "publisher_target_snapshots", "retention_policies", "screen_groups", "screens", "sponsor_plan_revisions", "sports_standings", "sports_teams", "tenant_feature_flag_definitions", "tenant_feature_flags", "tenant_settings", "tenant_theme_profiles", "tenants"]);
const INDEXES = new Set([
  "content_schedules_tenant_enabled_window_idx", "content_schedules_tenant_id_id_key", "content_schedules_pkey",
  "dynamic_data_sources_pkey", "dynamic_data_sources_tenant_id_id_key", "dynamic_data_sources_tenant_kind_idx",
  "dynamic_release_refresh_queue_due_idx", "dynamic_release_refresh_queue_pkey",
  "dynamic_slide_snapshots_pkey", "dynamic_slide_snapshots_tenant_id_id_key", "dynamic_slide_snapshots_source_idx", "publication_snapshots_prune_page_idx",
  "player_devices_pkey", "player_devices_one_paired_per_screen_uq", "player_devices_tenant_composition_idx", "player_devices_tenant_id_id_key",
  "player_heartbeats_pkey", "player_heartbeats_tenant_device_created_idx", "player_heartbeats_tenant_screen_created_idx",
  "player_sync_events_pkey", "player_sync_events_tenant_device_created_idx", "player_sync_events_tenant_release_created_idx",
  "playlist_items_pkey", "playlist_items_tenant_playlist_idx", "publication_items_snapshot_reference_idx",
  "playlist_publications_pkey", "playlist_publications_tenant_id_playlist_id_key",
  "playlist_release_items_pkey", "playlist_release_items_tenant_release_idx", "publication_release_items_snapshot_reference_idx",
  "playlist_releases_pkey", "playlist_releases_tenant_id_id_key", "playlist_releases_tenant_id_playlist_id_version_key", "playlist_releases_tenant_playlist_idx", "playlist_releases_tenant_published_at_idx", "playlist_releases_tenant_playlist_id_uq", "publication_releases_prune_page_idx",
  "playlists_pkey", "playlists_tenant_id_id_key", "published_dynamic_data_pkey",
  "publisher_target_snapshots_pkey", "publisher_target_snapshots_tenant_id_id_key", "publisher_target_snapshots_tenant_release_idx", "publisher_target_snapshots_tenant_schedule_idx",
  "retention_policies_pkey", "screen_groups_pkey", "screen_groups_tenant_name_active_uq", "screens_pkey", "screens_tenant_id_id_key",
  "sponsor_plan_revisions_pkey", "sponsor_plan_revisions_tenant_id_id_key", "sponsor_plan_revisions_latest_idx",
  "sports_standings_context_idx", "sports_standings_pkey", "sports_teams_pkey", "sports_teams_tenant_source_idx",
  "tenant_feature_flag_definitions_pkey", "tenant_feature_flags_pkey", "tenant_settings_pkey", "tenant_theme_profiles_pkey"
]);
const ESTIMATE_RELATIONS = ["dynamic_slide_snapshots", "dynamic_slide_versions", "playlist_releases", "published_dynamic_data", "player_heartbeats", "player_sync_events", "publisher_target_snapshots", "playlist_release_authoring_snapshots"];
const DATASETS = new Set(["club_profile", "teams", "competitions", "matches", "match_details", "activities", "public_people", "volunteers"]);
const FREQUENCIES = new Set(["five_minutes", "hourly", "daily", "weekly", "monthly"]);
const RUN_STATUSES = new Set(["queued", "running", "partial", "succeeded", "failed"]);
const COMPLETION_CODES = new Set([
  "08001", "08006", "22023", "22P02", "23502", "23503", "23505", "23514", "28000", "28P01", "40001", "40P01", "42501", "42703", "42883", "42P01", "53300", "53400", "54000", "55000", "55P03", "57014", "57P01", "57P02", "57P03", "P0001", "P0002", "XX000",
  "PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST100", "PGRST102", "PGRST103", "PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205", "PGRST300", "PGRST301", "PGRST302", "PGRST303", "PGRSTX00", "TRANSPORT_FAILED", "RPC_FAILED", "INVALID_RESULT"
].map((code) => `SPORTLINK_SYNC_COMPLETE_${code}`));
COMPLETION_CODES.add("SPORTLINK_SYNC_COMPLETE_57014_STATEMENT_TIMEOUT");
COMPLETION_CODES.add("SPORTLINK_SYNC_COMPLETE_57014_USER_REQUEST");
const ACTIVITY_STATES = new Set(["active", "idle", "idle in transaction", "idle in transaction (aborted)", "fastpath function call", "disabled", "unknown"]);
const WORKLOADS = new Set(["prune", "sportlink_completion", "published_projection", "inventory", "other"]);
const WAIT_TYPES = new Set(["Activity", "BufferPin", "Client", "Extension", "InjectionPoint", "IO", "IPC", "Lock", "LWLock", "Timeout", "none", "unknown"]);
class ProbeFault extends Error { constructor(code) { super(code); this.code = code; } }
const elapsed = (start) => Math.max(0, Math.round(performance.now() - start));
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const numeric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const count = (value) => numeric(value) && Number.isSafeInteger(value);
function tenantLiteral(tenantId) {
  if (!UUID.test(tenantId ?? "")) throw new ProbeFault("SCOPE_INVALID");
  return `'${tenantId}'::uuid`;
}

export function inventoryExplainSql(tenantId) {
  // SUMMARY provides a plan-end marker without executing the inventory SELECT.
  return `EXPLAIN (FORMAT TEXT, COSTS TRUE, VERBOSE FALSE, SUMMARY TRUE, SETTINGS FALSE)\n${template.replaceAll("__TENANT_ID__", tenantLiteral(tenantId))}`;
}

/** Fixed metadata and small indexed tenant counts; no activity query text or IDs. */
export function publicationStatsSql(tenantId) {
  const tenant = tenantLiteral(tenantId);
  return `WITH scoped_connections AS MATERIALIZED (
    SELECT id FROM public.sportlink_connections WHERE tenant_id=${tenant} ORDER BY id LIMIT 101
  ), kept_connections AS MATERIALIZED (SELECT id FROM scoped_connections ORDER BY id LIMIT 100),
  activity_groups AS MATERIALIZED (
    SELECT state,wait_type,workload,count(*) AS n,max(query_age_ms) AS max_query_age_ms
    FROM (SELECT coalesce(state,'unknown') AS state,coalesce(wait_event_type,'none') AS wait_type,
      CASE WHEN query ILIKE '%prune_queued_publication_versions_v1%' THEN 'prune'
        WHEN query ILIKE '%complete_sportlink_sync_v%' OR query ILIKE '%complete_sportlink_birthday%' THEN 'sportlink_completion'
        WHEN query ILIKE '%standingFormCoverage%' THEN 'inventory'
        WHEN query ILIKE '%published_dynamic_data%' OR query ILIKE '%refresh_current_publication%' THEN 'published_projection'
        ELSE 'other' END AS workload,
      CASE WHEN state='active' AND query_start IS NOT NULL
        THEN least(9007199254740991,greatest(0,floor(extract(epoch FROM (clock_timestamp()-query_start))*1000))) ELSE 0 END AS query_age_ms
      FROM pg_catalog.pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) classified
    GROUP BY state,wait_type,workload ORDER BY state,wait_type,workload LIMIT 129
  )
  SELECT jsonb_build_object(
    'tenantCounts', jsonb_build_object(
      'snapshots', (SELECT count(*) FROM public.dynamic_slide_snapshots WHERE tenant_id=${tenant}),
      'releases', (SELECT count(*) FROM public.playlist_releases WHERE tenant_id=${tenant}),
      'publishedBindings', (SELECT count(*) FROM public.published_dynamic_data WHERE tenant_id=${tenant})),
    'tableEstimates', (SELECT coalesce(jsonb_agg(jsonb_build_object('relation',c.relname,'estimatedRows',greatest(c.reltuples,0)) ORDER BY c.relname),'[]'::jsonb)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN (${ESTIMATE_RELATIONS.map((name) => `'${name}'`).join(",")})),
    'sportlink', jsonb_build_object(
      'retainedConnections',(SELECT count(*) FROM kept_connections),
      'connectionsTruncated',(SELECT count(*)>100 FROM scoped_connections),
      'datasets',(SELECT coalesce(jsonb_agg(jsonb_build_object(
        'connectionId',p.connection_id,'datasetGroup',p.dataset_group,'enabled',p.enabled,'frequency',p.frequency,
        'nextSyncAt',p.next_sync_at,'lastSuccessAt',p.last_success_at,
        'status',r.status,'startedAt',r.started_at,'finishedAt',r.finished_at,'errorCode',r.error_code,
        'readCount',r.read_count,'changedCount',r.changed_count,'skippedCount',r.skipped_count
      ) ORDER BY p.connection_id,p.dataset_group),'[]'::jsonb)
        FROM public.sportlink_sync_policies p JOIN kept_connections c ON c.id=p.connection_id
        LEFT JOIN LATERAL (SELECT status,started_at,finished_at,error_code,read_count,changed_count,skipped_count
          FROM public.sportlink_sync_runs WHERE tenant_id=${tenant} AND connection_id=p.connection_id AND dataset_group=p.dataset_group
          ORDER BY started_at DESC,id DESC LIMIT 1) r ON true
        WHERE p.tenant_id=${tenant})),
    'activityTruncated',(SELECT count(*)>128 FROM activity_groups),
    'activity', (SELECT coalesce(jsonb_agg(jsonb_build_object('state',state,'waitType',wait_type,'workload',workload,'count',n,'maxQueryAgeMs',max_query_age_ms) ORDER BY state,wait_type,workload),'[]'::jsonb)
      FROM (SELECT * FROM activity_groups ORDER BY state,wait_type,workload LIMIT 128) activity)
  ) AS report;\n`;
}

/** Project only reviewed technical fields; plans may contain private filters. */
export function sanitizeInventoryPlan(value) {
  if (!Array.isArray(value) || value.length !== 1 || !record(value[0]) || !record(value[0].Plan)) throw new ProbeFault("PLAN_SHAPE_INVALID");
  const nodes = [];
  const visit = (node, depth) => {
    if (!record(node) || depth > 32 || nodes.length >= 256 || typeof node["Node Type"] !== "string"
      || !numeric(node["Startup Cost"]) || !numeric(node["Total Cost"]) || !count(node["Plan Rows"])
      || node["Total Cost"] < node["Startup Cost"] || (node.Plans !== undefined && !Array.isArray(node.Plans))) throw new ProbeFault("PLAN_SHAPE_INVALID");
    const item = { nodeType: NODE_TYPES.has(node["Node Type"]) ? node["Node Type"] : "unreviewed", depth,
      estimatedRows: node["Plan Rows"], startupCost: node["Startup Cost"], totalCost: node["Total Cost"] };
    if (node["Relation Name"] !== undefined) item.relation = RELATIONS.has(node["Relation Name"]) ? node["Relation Name"] : "unreviewed";
    if (node["Index Name"] !== undefined) item.index = INDEXES.has(node["Index Name"]) ? node["Index Name"] : "unreviewed";
    nodes.push(item);
    for (const child of node.Plans ?? []) visit(child, depth + 1);
  };
  visit(value[0].Plan, 0);
  return { queryTemplateSha256: inventoryTemplateSha256, nodeCount: nodes.length, nodes };
}

const PLAN_LINE = /^( *)(-> {2})?(.+?) {2}\(cost=([0-9]+(?:\.[0-9]+)?)\.\.([0-9]+(?:\.[0-9]+)?) rows=([0-9]+) width=([0-9]+)\)$/;
const PLAN_DETAILS = /^(?:Filter|Index Cond|Recheck Cond|Hash Cond|Join Filter|Merge Cond|One-Time Filter|Sort Key|Group Key|Presorted Key|Cache Key|Cache Mode|Workers Planned|Planned Partitions|Partitions|Run Condition): /;
const PLAN_WRAPPER = /^(?:CTE [^\r\n]+|(?:InitPlan|SubPlan) [0-9]+(?: \([^\r\n]+\))?)$/;
const IDENTIFIER = '(?:"(?:[^"\\r\\n]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)(?:\\.(?:"(?:[^"\\r\\n]|"")*"|[A-Za-z_][A-Za-z0-9_$]*))?';
const PLAN_ON = new RegExp(` on (${IDENTIFIER})(?: |$)`);
const PLAN_USING = new RegExp(` using (${IDENTIFIER})(?: |$)`);
const RELATION_SCANS = new Set(["Seq Scan", "Index Scan", "Index Only Scan", "Bitmap Heap Scan", "Tid Scan", "Tid Range Scan", "Foreign Scan"]);
function textNodeType(label) {
  let type = label.split(/ (?:using|on) /)[0];
  type = type.replace(/^(?:Parallel |Partial |Finalize )/, "").replace(/ Backward$/, "");
  if (["HashAggregate", "GroupAggregate", "MixedAggregate"].includes(type)) type = "Aggregate";
  type = type.replace(/^(Hash|Merge) (?:Left|Right|Full|Anti|Semi) Join$/, "$1 Join")
    .replace(/^Nested Loop (?:Left|Right|Full|Anti|Semi) Join$/, "Nested Loop")
    .replace(/^(?:Hash)?SetOp (?:Except|Intersect)$/, "SetOp");
  return NODE_TYPES.has(type) ? type : "unreviewed";
}
function reviewedIdentifier(value, allowed) {
  // Qualified public names and quoted identifiers must still match exactly.
  const name = value?.replace(/^public\./, "");
  const unquoted = /^"(?:[^"\r\n]|"")*"$/.test(name ?? "") ? name.slice(1, -1).replaceAll('""', '"') : name;
  return allowed.has(unquoted) ? unquoted : "unreviewed";
}

/** TEXT rows are compact, but raw labels/filters never leave this projection. */
function sanitizeTextPlan(rows) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 2048 || Buffer.byteLength(JSON.stringify(rows)) > MAX_BODY) throw new ProbeFault("PLAN_SHAPE_INVALID");
  const lines = rows.map((row) => {
    if (!exactKeys(row, ["QUERY PLAN"]) || typeof row["QUERY PLAN"] !== "string" || /[\r\n\t\0]/.test(row["QUERY PLAN"])) throw new ProbeFault("PLAN_SHAPE_INVALID");
    return row["QUERY PLAN"];
  });
  const summaryAt = lines.findIndex((line) => /^Planning Time: [0-9]+(?:\.[0-9]+)? ms$/.test(line));
  if (summaryAt < 1 || !numeric(Number(lines[summaryAt].slice(15, -3)))) throw new ProbeFault("PLAN_SHAPE_INVALID");
  const footer = lines.slice(summaryAt + 1);
  // PostgreSQL emits JIT after Planning Time. Accept the complete fixed footer,
  // never its partial prefix or any ANALYZE execution statistics.
  if (footer.length && (footer.length !== 3 || footer[0] !== "JIT:" || !/^ {2}Functions: [0-9]+$/.test(footer[1])
    || !count(Number(footer[1].slice(13))) || !/^ {2}Options: Inlining (?:true|false), Optimization (?:true|false), Expressions (?:true|false), Deforming (?:true|false)$/.test(footer[2]))) throw new ProbeFault("PLAN_SHAPE_INVALID");
  const nodes = [], ancestors = [];
  let pendingWrapper;
  for (const line of lines.slice(0, summaryAt)) {
    const match = PLAN_LINE.exec(line);
    const indent = line.match(/^ */)[0].length;
    if (match) {
      if (nodes.length >= 256 || (nodes.length === 0 ? indent !== 0 || match[2] !== undefined : !match[2] || indent === 0)
        || (pendingWrapper !== undefined && indent <= pendingWrapper)) throw new ProbeFault("PLAN_SHAPE_INVALID");
      while (ancestors.length && ancestors.at(-1) >= indent) ancestors.pop();
      const depth = ancestors.length, startupCost = Number(match[4]), totalCost = Number(match[5]), estimatedRows = Number(match[6]);
      if (depth > 32 || !numeric(startupCost) || !numeric(totalCost) || !count(estimatedRows) || !count(Number(match[7])) || totalCost < startupCost) throw new ProbeFault("PLAN_SHAPE_INVALID");
      const label = match[3].trim(), nodeType = textNodeType(label), item = { nodeType, depth, estimatedRows, startupCost, totalCost };
      const on = PLAN_ON.exec(label)?.[1], using = PLAN_USING.exec(label)?.[1];
      if (RELATION_SCANS.has(nodeType)) {
        if (!on) throw new ProbeFault("PLAN_SHAPE_INVALID");
        item.relation = reviewedIdentifier(on, RELATIONS);
      }
      if (["Index Scan", "Index Only Scan", "Bitmap Index Scan"].includes(nodeType)) {
        const index = nodeType === "Bitmap Index Scan" ? on : using;
        if (!index) throw new ProbeFault("PLAN_SHAPE_INVALID");
        item.index = reviewedIdentifier(index, INDEXES);
      }
      nodes.push(item); ancestors.push(indent); pendingWrapper = undefined;
    } else {
      const detail = line.slice(indent);
      while (ancestors.length && ancestors.at(-1) >= indent) ancestors.pop();
      if (!nodes.length || pendingWrapper !== undefined || !ancestors.length) throw new ProbeFault("PLAN_SHAPE_INVALID");
      if (PLAN_WRAPPER.test(detail)) pendingWrapper = indent;
      else if (!PLAN_DETAILS.test(detail)) throw new ProbeFault("PLAN_SHAPE_INVALID");
    }
  }
  if (!nodes.length || pendingWrapper !== undefined) throw new ProbeFault("PLAN_SHAPE_INVALID");
  return { queryTemplateSha256: inventoryTemplateSha256, format: "text", planComplete: true, nodeCount: nodes.length, nodes };
}
export function sanitizeInventoryTextPlan(rows) {
  try { return sanitizeTextPlan(rows); }
  catch { throw new ProbeFault("PLAN_SHAPE_INVALID"); }
}

function timestamp(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ProbeFault("STATS_SHAPE_INVALID");
  return new Date(value).toISOString();
}
function sanitizeSportlink(value) {
  if (!exactKeys(value, ["retainedConnections", "connectionsTruncated", "datasets"]) || !count(value.retainedConnections) || value.retainedConnections > 100
    || typeof value.connectionsTruncated !== "boolean" || !Array.isArray(value.datasets) || value.datasets.length > 800) throw new ProbeFault("STATS_SHAPE_INVALID");
  const connections = new Set(), keys = new Set();
  const datasets = value.datasets.map((row) => {
    if (!exactKeys(row, ["connectionId", "datasetGroup", "enabled", "frequency", "nextSyncAt", "lastSuccessAt", "status", "startedAt", "finishedAt", "errorCode", "readCount", "changedCount", "skippedCount"])
      || !UUID.test(row.connectionId ?? "") || !DATASETS.has(row.datasetGroup) || typeof row.enabled !== "boolean" || !FREQUENCIES.has(row.frequency)
      || (row.status !== null && !RUN_STATUSES.has(row.status)) || (row.errorCode !== null && typeof row.errorCode !== "string")
      || ![row.readCount, row.changedCount, row.skippedCount].every((number) => number === null || count(number))) throw new ProbeFault("STATS_SHAPE_INVALID");
    if (row.status === null && [row.startedAt, row.finishedAt, row.errorCode, row.readCount, row.changedCount, row.skippedCount].some((field) => field !== null)) throw new ProbeFault("STATS_SHAPE_INVALID");
    const key = `${row.connectionId}:${row.datasetGroup}`;
    if (keys.has(key)) throw new ProbeFault("STATS_SHAPE_INVALID");
    keys.add(key); connections.add(row.connectionId);
    return { connectionId: row.connectionId, datasetGroup: row.datasetGroup, enabled: row.enabled, frequency: row.frequency,
      nextSyncAt: timestamp(row.nextSyncAt), lastSuccessAt: timestamp(row.lastSuccessAt), status: row.status,
      startedAt: timestamp(row.startedAt), finishedAt: timestamp(row.finishedAt),
      errorCode: row.errorCode === null ? null : COMPLETION_CODES.has(row.errorCode) ? row.errorCode : "UNKNOWN_ERROR",
      readCount: row.readCount, changedCount: row.changedCount, skippedCount: row.skippedCount };
  });
  if (connections.size > value.retainedConnections) throw new ProbeFault("STATS_SHAPE_INVALID");
  return { retainedConnections: value.retainedConnections, connectionsTruncated: value.connectionsTruncated, datasets };
}
export function sanitizePublicationStats(value) {
  if (!exactKeys(value, ["tenantCounts", "tableEstimates", "activity", "activityTruncated", "sportlink"]) || !exactKeys(value.tenantCounts, ["snapshots", "releases", "publishedBindings"])
    || !Object.values(value.tenantCounts).every(count) || !Array.isArray(value.tableEstimates) || value.tableEstimates.length !== ESTIMATE_RELATIONS.length
    || !Array.isArray(value.activity) || value.activity.length > 128 || typeof value.activityTruncated !== "boolean") throw new ProbeFault("STATS_SHAPE_INVALID");
  const seen = new Set();
  const tableEstimates = value.tableEstimates.map((item) => {
    if (!exactKeys(item, ["relation", "estimatedRows"]) || !ESTIMATE_RELATIONS.includes(item.relation) || seen.has(item.relation) || !numeric(item.estimatedRows)) throw new ProbeFault("STATS_SHAPE_INVALID");
    seen.add(item.relation);
    return { relation: item.relation, estimatedRows: item.estimatedRows };
  });
  const activity = new Map();
  for (const item of value.activity) {
    if (!exactKeys(item, ["state", "waitType", "workload", "count", "maxQueryAgeMs"]) || typeof item.state !== "string" || typeof item.waitType !== "string" || typeof item.workload !== "string" || !count(item.count) || !count(item.maxQueryAgeMs)) throw new ProbeFault("STATS_SHAPE_INVALID");
    const state = ACTIVITY_STATES.has(item.state) ? item.state : "unreviewed";
    const waitType = WAIT_TYPES.has(item.waitType) ? item.waitType : "unreviewed";
    const workload = WORKLOADS.has(item.workload) ? item.workload : "other";
    const key = `${state}:${waitType}:${workload}`;
    const aggregate = activity.get(key) ?? { state, waitType, workload, count: 0, maxQueryAgeMs: 0 };
    aggregate.count += item.count;
    aggregate.maxQueryAgeMs = Math.max(aggregate.maxQueryAgeMs, item.maxQueryAgeMs);
    if (!count(aggregate.count)) throw new ProbeFault("STATS_SHAPE_INVALID");
    activity.set(key, aggregate);
  }
  return { tenantCounts: { ...value.tenantCounts }, tableEstimates, activity: [...activity.values()], activityTruncated: value.activityTruncated, sportlink: sanitizeSportlink(value.sportlink),
    estimatesScope: "database_wide_catalog_estimates", activityScope: "database_wide_aggregated_session_state_and_wait_type" };
}

async function bounded(operation, milliseconds, code, operationSignal) {
  const controller = new globalThis.AbortController();
  let timer, rejectAbort;
  const abort = () => {
    // Notify the active adapter first: its existing signal listener kills the
    // owned group synchronously before cancellation can return to the CLI.
    controller.abort();
    rejectAbort?.(new ProbeFault("PROBE_CANCELLED"));
  };
  try {
    const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
    operationSignal?.addEventListener("abort", abort, { once: true });
    if (operationSignal?.aborted) abort();
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProbeFault(code)); }, milliseconds);
    });
    return await Promise.race([cancelled, deadline, Promise.resolve().then(() => {
      if (operationSignal?.aborted) throw new ProbeFault("PROBE_CANCELLED");
      return operation(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    operationSignal?.removeEventListener("abort", abort);
  }
}
async function limitedJson(response) {
  if (Number(response.headers.get("content-length")) > MAX_BODY) { await response.body?.cancel(); throw new ProbeFault("PUBLIC_HEALTH_READ_FAILED"); }
  if (!response.body) throw new ProbeFault("PUBLIC_HEALTH_READ_FAILED");
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new ProbeFault("PUBLIC_HEALTH_READ_FAILED");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
function sqlRows(result, planRows = false) {
  if (result?.tooLarge || Buffer.byteLength(result?.stdout ?? "") > MAX_BODY) throw new ProbeFault("SQL_OUTPUT_TOO_LARGE");
  if (result?.timedOut) throw new ProbeFault("SQL_TIMEOUT");
  let data;
  try { data = JSON.parse(result?.stdout); } catch { throw new ProbeFault("SQL_OUTPUT_INVALID"); }
  if (["LegacyDbConnectError", "LegacyDbQueryExecError"].includes(data?.error?.code)) {
    const fault = new ProbeFault(data.error.code === "LegacyDbConnectError" ? "SQL_CONNECT_FAILED" : "SQL_QUERY_FAILED");
    if (data.error.code === "LegacyDbConnectError") fault.cliFailureCategory = CONNECT_CATEGORIES.get(data.error.message) ?? "UNKNOWN";
    for (const code of [data.error.databaseCode, data.error.sqlState]) if (PG_CODES.has(code)) { fault.databaseCode = code; break; }
    throw fault;
  }
  if (!result?.ok) throw new ProbeFault("SQL_EXEC_FAILED");
  if (!Array.isArray(data) || (planRows ? data.length < 2 || data.length > 2048 : data.length !== 1)) throw new ProbeFault("SQL_OUTPUT_INVALID");
  return data;
}
async function sqlStage(stage, sql, config, executeSql, deadline, sanitize, operationSignal, planRows = false) {
  const started = performance.now();
  try {
    const rows = sqlRows(await bounded((signal) => executeSql({ databaseUrl: config.databaseUrl, sql, signal }), deadline, "SQL_TIMEOUT", operationSignal), planRows);
    return { stage, status: "passed", elapsedMs: elapsed(started), ...sanitize(planRows ? rows : rows[0]) };
  } catch (error) {
    const known = error instanceof ProbeFault;
    return { stage, status: "failed", code: known ? error.code : "SQL_EXEC_FAILED", elapsedMs: elapsed(started),
      ...(known && error.cliFailureCategory ? { cliFailureCategory: error.cliFailureCategory } : {}),
      ...(known && PG_CODES.has(error.databaseCode) ? { databaseCode: error.databaseCode } : {}) };
  }
}

/** Synthetic adapters test contracts; completion does not prove inventory latency. */
export async function probePublicationRuntime({ environment = process.env, targetEnvironment, expectedRuntimeSha, tenantId }, {
  fetchImpl = globalThis.fetch, executeSql = createSqlAdapter(), now = () => new Date(),
  healthDeadlineMs = 5_000, sqlDeadlineMs = SQL_DEADLINE, operationSignal
} = {}) {
  const started = performance.now(); let scope;
  const report = (code, details = {}, exitCode = 1) => ({ exitCode, report: {
    schemaVersion: 1, event: "publication_runtime_probe", mode: "read_only_inventory_plan_and_metadata",
    completionScope: "requested_queries_observed_and_sanitized_not_recovery_or_effective_timeout_proof",
    observedAt: now().toISOString(), verdict: code === "DIAGNOSTIC_COMPLETE" ? "DIAGNOSTIC_COMPLETE" : "UNPROVEN", code, queryTemplateSha256: inventoryTemplateSha256,
    ...(scope ? { scope } : {}), elapsedMs: elapsed(started), ...details
  } });
  try {
    if (environment.GITHUB_REF !== "refs/heads/main" || !["staging", "production"].includes(targetEnvironment)
      || !/^[0-9a-f]{40}$/.test(expectedRuntimeSha ?? "") || !UUID.test(tenantId ?? "")
      || !/^[a-z0-9]{20}$/.test(environment.SUPABASE_PROJECT_REF ?? "")
      || ![`https://${environment.SUPABASE_PROJECT_REF}.supabase.co`, `https://${environment.SUPABASE_PROJECT_REF}.supabase.co/`].includes(environment.NEXT_PUBLIC_SUPABASE_URL)
      || (operationSignal !== undefined && !(operationSignal instanceof globalThis.AbortSignal))
      || ![[healthDeadlineMs, 5_000], [sqlDeadlineMs, SQL_DEADLINE]].every(([value, limit]) => Number.isInteger(value) && value > 0 && value <= limit)) return report("SCOPE_INVALID", {}, 2);
    scope = { environment: targetEnvironment, runtimeSha: expectedRuntimeSha, tenantId };
    if (operationSignal?.aborted) return report("PROBE_CANCELLED");
    const health = [], prefix = targetEnvironment === "staging" ? "staging-" : "";
    for (const [service, path] of [["control", "/api/health"], ["player", "/healthz"]]) {
      const begin = performance.now();
      try {
        await bounded(async (signal) => {
          const response = await fetchImpl(`https://${prefix}${service}.veyocast.nl${path}`, { redirect: "error", signal });
          if (!response.ok) throw new ProbeFault("PUBLIC_HEALTH_READ_FAILED");
          const body = await limitedJson(response);
          if (!exactKeys(body, ["environment", "revision", "service", "status"]) || body.environment !== targetEnvironment
            || body.revision !== expectedRuntimeSha || body.service !== service || body.status !== "ok") throw new ProbeFault("PUBLIC_HEALTH_SCOPE_MISMATCH");
        }, healthDeadlineMs, "PUBLIC_HEALTH_TIMEOUT", operationSignal);
        if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
        health.push({ service, status: "passed", elapsedMs: elapsed(begin) });
      } catch (error) {
        if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
        const code = error instanceof ProbeFault && ["PUBLIC_HEALTH_READ_FAILED", "PUBLIC_HEALTH_SCOPE_MISMATCH", "PUBLIC_HEALTH_TIMEOUT"].includes(error.code) ? error.code : "PUBLIC_HEALTH_READ_FAILED";
        health.push({ service, status: "failed", code, elapsedMs: elapsed(begin) });
        return report(code, { health });
      }
    }
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health });
    let config;
    try { config = diagnosticDatabaseConfig(environment.SUPABASE_DB_URL, environment.PGCONNECT_TIMEOUT, environment.SUPABASE_PROJECT_REF, environment); }
    catch { return report("SECRET_CONFIG_INVALID", { health }, 2); }
    const budget = { normalSeconds: config.normalBudgetSeconds, normalSource: config.normalBudgetSource,
      diagnosticSeconds: config.diagnosticBudgetSeconds, overridden: config.budgetOverridden, processDeadlineMs: SQL_DEADLINE };
    const tenant = await sqlStage("tenant_lookup", tenantReadSql(tenantId), config, executeSql, sqlDeadlineMs, (row) => {
      if (!exactKeys(row, ["database_ready", "tenant_active"]) || row.database_ready !== 1 || row.tenant_active !== true) throw new ProbeFault("SQL_SCOPE_UNPROVEN");
      return { tenantActive: true };
    }, operationSignal);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, tenant });
    if (tenant.status !== "passed") return report("TENANT_SCOPE_UNPROVEN", { health, budget, tenant });
    const stats = await sqlStage("inventory_metadata", publicationStatsSql(tenantId), config, executeSql, sqlDeadlineMs, (row) => {
      if (!exactKeys(row, ["report"])) throw new ProbeFault("STATS_SHAPE_INVALID");
      return sanitizePublicationStats(row.report);
    }, operationSignal);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, tenant, stats });
    // Metadata failure remains useful evidence and does not suppress EXPLAIN.
    const plan = await sqlStage("inventory_explain", inventoryExplainSql(tenantId), config, executeSql, sqlDeadlineMs, sanitizeInventoryTextPlan, operationSignal, true);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, tenant, stats, plan });
    const runtimeMetadata = await sqlStage("runtime_catalog_metadata", runtimeMetadataSql(tenantId), config, executeSql, sqlDeadlineMs, (row) => {
      if (!exactKeys(row, ["report"])) throw new ProbeFault("RUNTIME_METADATA_SHAPE_INVALID");
      try { return sanitizeRuntimeMetadata(row.report); }
      catch (error) { throw new ProbeFault(error?.code === "RUNTIME_METADATA_SCOPE_INVALID" ? "RUNTIME_METADATA_SCOPE_INVALID" : "RUNTIME_METADATA_SHAPE_INVALID"); }
    }, operationSignal);
    if (operationSignal?.aborted) return report("PROBE_CANCELLED", { health, budget, tenant, stats, plan, runtimeMetadata });
    const complete = stats.status === "passed" && !stats.sportlink.connectionsTruncated && !stats.activityTruncated
      && plan.status === "passed" && runtimeMetadata.status === "passed"
      && runtimeMetadata.tables.every((table) => table.indexes.every((index) => !index.columnsTruncated));
    return report(complete ? "DIAGNOSTIC_COMPLETE" : "DIAGNOSTIC_UNPROVEN", { health, budget, tenant, stats, plan, runtimeMetadata }, complete ? 0 : 1);
  } catch { return report(operationSignal?.aborted ? "PROBE_CANCELLED" : "PROBE_FAILED"); }
}

export async function writePublicationProbeArtifact(directory, report) {
  if (!directory) return;
  const file = await open(join(directory, "publication-runtime-probe.json"), constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { await file.chmod(0o600); await file.writeFile(`${JSON.stringify(report)}\n`); } finally { await file.close(); }
}
export async function publicationProbeCli({ argv = process.argv.slice(2), environment = process.env, stdout = process.stdout, ...dependencies } = {}) {
  let result;
  try {
    result = await probePublicationRuntime({ environment, targetEnvironment: argv.length === 3 ? argv[0] : undefined,
      expectedRuntimeSha: argv[1], tenantId: argv[2] }, dependencies);
    try { await writePublicationProbeArtifact(environment.RUNNER_TEMP, result.report); }
    catch { result = { exitCode: 1, report: { ...result.report, verdict: "UNPROVEN", code: "OUTPUT_WRITE_FAILED" } }; }
  } catch { result = { exitCode: 1, report: { schemaVersion: 1, event: "publication_runtime_probe", verdict: "UNPROVEN", code: "PROBE_FAILED" } }; }
  try { stdout.write(`${JSON.stringify(result.report)}\n`); } catch { return 1; }
  return result.exitCode;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new globalThis.AbortController();
  let cancellationExitCode;
  const cancel = (code) => {
    if (cancellationExitCode !== undefined) return;
    cancellationExitCode = code;
    controller.abort();
  };
  process.on("SIGINT", () => cancel(130));
  process.on("SIGTERM", () => cancel(143));
  process.stdout.on("error", () => { controller.abort(); process.exit(1); });
  const exitCode = await publicationProbeCli({ operationSignal: controller.signal });
  process.stdout.write("", () => process.exit(cancellationExitCode ?? exitCode));
}
