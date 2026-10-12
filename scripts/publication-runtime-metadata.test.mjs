import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { runtimeMetadataSql, sanitizeRuntimeMetadata } from "./publication-runtime-metadata.mjs";

const tenant = "11111111-1111-1111-1111-111111111111";
const secret = "PRIVATE_PROVIDER_RECORD_OR_FUNCTION_CONFIG";
const timeoutKeys = ["statement_timeout", "lock_timeout", "idle_in_transaction_session_timeout", "idle_session_timeout", "transaction_timeout"];
const functionNames = [
  ["public", "complete_sportlink_sync_v4"], ["public", "complete_sportlink_sync_v1"],
  ["public", "complete_sportlink_sync_before_standing_history_v1"],
  ["public", "record_sportlink_sync_v1"], ["public", "record_sportlink_sync_pre_context_v1"],
  ["private", "deduplicate_sportlink_source_revision_v1"], ["private", "refresh_sportlink_source_after_dataset_sync"],
  ["private", "refresh_published_data_after_source_v1"], ["private", "refresh_published_data_v1"],
  ["public", "prune_queued_publication_versions_v1"]
];
const indexes = {
  sports_clubs: ["sports_clubs_pkey", "sports_clubs_tenant_id_id_key", "sports_clubs_tenant_id_source_connection_id_external_id_key", "sports_clubs_provider_logo_version_idx"],
  sports_teams: ["sports_teams_pkey", "sports_teams_tenant_id_id_key", "sports_teams_tenant_id_source_connection_id_external_id_key", "sports_teams_tenant_idx"],
  sports_matches: ["sports_matches_pkey", "sports_matches_tenant_id_id_key", "sports_matches_tenant_id_source_connection_id_external_id_key", "sports_matches_start_idx"],
  sports_standings: ["sports_standings_pkey", "sports_standings_tenant_id_id_key", "sports_standings_source_external_season_key", "sports_standings_context_idx"],
  sports_activities: ["sports_activities_pkey", "sports_activities_tenant_id_id_key", "sports_activities_tenant_id_source_connection_id_external_i_key", "sports_activities_start_idx"],
  sports_public_people: ["sports_public_people_pkey", "sports_public_people_tenant_id_id_key", "sports_public_people_tenant_id_source_connection_id_externa_key"],
  sportlink_team_members: ["sportlink_team_members_pkey", "sportlink_team_members_tenant_id_id_key", "sportlink_team_members_tenant_id_connection_id_identity_key_key", "sportlink_team_members_match_idx", "sportlink_team_members_code_idx"],
  sportlink_birthdays: ["sportlink_birthdays_pkey", "sportlink_birthdays_tenant_id_id_key", "sportlink_birthdays_tenant_id_connection_id_external_id_key", "sportlink_birthdays_window_idx", "sportlink_birthdays_conflicts_idx"],
  player_heartbeats: ["player_heartbeats_pkey", "player_heartbeats_tenant_device_created_idx", "player_heartbeats_tenant_screen_created_idx"]
};
const fields = (status = "unset") => timeoutKeys.map((key) => ({ key, status, milliseconds: null }));
const index = (name) => ({ name, present: true, valid: true, ready: true, columnCount: 1, keyColumnCount: 1, columnsTruncated: false, partial: false, hasExpressions: false, columns: ["id"] });
function fixture() {
  return {
    scopeReady: true,
    timeoutProfiles: ["global_all_roles", "current_database_all_roles"].map((scope) => ({ scope, role: null, present: true, overridesPresent: false, timeouts: fields() })).concat(
      ["authenticator", "service_role", "postgres"].flatMap((role) => ["global_role", "current_database_role"].map((scope) => ({ scope, role, present: true, overridesPresent: false, timeouts: fields() })))),
    functions: functionNames.map(([schema, name]) => ({ schema, name, overloads: 1, timeouts: fields() })),
    tables: Object.entries(indexes).map(([relation, names]) => ({ relation, present: true, estimatedRows: 10, statsKnown: true, liveRowsEstimate: 12, deadRowsEstimate: 1,
      lastAnalyzeAt: "2026-10-12T10:00:00.123456+00:00", lastAutoAnalyzeAt: null, unreviewedIndexCount: 0, indexes: names.map(index) })),
    statementStatistics: { installed: true, schema: "extensions", viewPresent: true, tracking: [
      { key: "pg_stat_statements.track", status: "set", value: "top" }, { key: "pg_stat_statements.track_planning", status: "set", value: "off" },
      { key: "track_activities", status: "set", value: "on" }, { key: "track_functions", status: "set", value: "none" }
    ] }
  };
}
function shapeFault(value) {
  assert.throws(() => sanitizeRuntimeMetadata(value), (error) => {
    assert.equal(error.code, "RUNTIME_METADATA_SHAPE_INVALID");
    assert.equal(error.message, "RUNTIME_METADATA_SHAPE_INVALID");
    assert.equal(error.cause, undefined);
    assert.equal(JSON.stringify(error).includes(secret), false);
    return true;
  });
}

test("fixed SQL reads declared catalogs, one scoped tenant and no source records or private configuration", () => {
  const sql = runtimeMetadataSql(tenant);
  assert.match(sql, /^WITH expected_roles/);
  assert.equal(sql.split(tenant).length - 1, 1);
  assert.match(sql, /pg_catalog\.pg_roles/); assert.match(sql, /pg_catalog\.pg_db_role_setting/);
  assert.match(sql, /only_function\.proconfig/); assert.match(sql, /pg_catalog\.pg_stat_user_tables/);
  assert.match(sql, /key\.position<=8/); assert.match(sql, /'columnsTruncated'/);
  assert.match(sql, /'unknown'/); assert.match(sql, /'unsupported'/); assert.match(sql, /'invalid'/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|drop|create|analyze|show)\b/i);
  assert.doesNotMatch(sql, /prosrc|pg_get_(?:function|index|trigger)def|pg_stat_statements\s*(?:WHERE|GROUP|;)|data_json|rows_json|contentRevisionHash|digest\(/i);
  assert.doesNotMatch(sql, /\bFROM public\.(?:sports_|sportlink_|player_heartbeats)/);
  assert.doesNotMatch(sql, /jsonb_build_object\([^\n]*(?:'raw'|'config'|'rolconfig'|'setconfig'|'proconfig')/);
});

test("SQL scope rejects injection, nonstrings and coercion without exposing its content", () => {
  for (const invalid of [undefined, null, "", tenant.toUpperCase().replace("1", "A"), `${tenant}' OR true--`, `${tenant}\n`, 42, { toString() { throw new Error(secret); } }]) {
    assert.throws(() => runtimeMetadataSql(invalid), (error) => error.code === "SCOPE_INVALID" && error.message === "SCOPE_INVALID");
  }
});

test("valid catalog observations preserve estimates and declare their interpretation limits", () => {
  const value = fixture();
  const auth = value.timeoutProfiles.find((row) => row.role === "authenticator" && row.scope === "global_role");
  auth.overridesPresent = true;
  auth.timeouts.find((row) => row.key === "statement_timeout").status = "set";
  auth.timeouts.find((row) => row.key === "statement_timeout").milliseconds = 8000;
  const result = sanitizeRuntimeMetadata(value);
  assert.equal(result.metadataComplete, true);
  assert.equal(result.timeoutScope, "declared_catalog_configuration_not_effective_postgrest_timeout");
  assert.equal(result.estimatesScope, "database_wide_catalog_and_statistics_estimates_not_exact_source_counts");
  assert.equal(result.tables.find((row) => row.relation === "sports_matches").liveRowsEstimate, 12);
  assert.equal(result.tables[0].lastAnalyzeAt, "2026-10-12T10:00:00.123Z");
  const safeAuth = result.timeoutProfiles.find((row) => row.role === "authenticator" && row.scope === "global_role");
  assert.equal(safeAuth.timeouts.find((row) => row.key === "statement_timeout").milliseconds, 8000);
  assert.equal(JSON.stringify(result).includes(tenant), false);
  value.tables[0].indexes[0].columns[0] = secret;
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("unknown estimates, missing functions/roles and invalid declarations remain incomplete", () => {
  for (const change of [
    (value) => { value.tables[0].estimatedRows = null; },
    (value) => { value.tables[0].unreviewedIndexCount = 1; },
    (value) => { value.functions[0].overloads = 0; value.functions[0].timeouts = fields("unknown"); },
    (value) => { value.functions[0].overloads = 2; value.functions[0].timeouts = fields("unknown"); },
    (value) => { const role = value.timeoutProfiles.find((row) => row.role !== null); role.present = false; role.timeouts = fields("unknown"); },
    (value) => { value.functions[0].timeouts[0].status = "invalid"; },
    (value) => { value.tables[0].indexes[0].valid = false; },
    (value) => { value.tables[0].indexes[0].columns[0] = "unreviewed"; },
    (value) => { value.statementStatistics.installed = false; value.statementStatistics.viewPresent = false; value.statementStatistics.schema = "absent"; },
    (value) => { value.statementStatistics.schema = "unreviewed"; },
    (value) => { value.statementStatistics.tracking[0].status = "unset"; value.statementStatistics.tracking[0].value = null; }
  ]) {
    const value = fixture(); change(value); assert.equal(sanitizeRuntimeMetadata(value).metadataComplete, false);
  }
  const value = fixture(); value.functions[0].timeouts[0].status = "unsupported";
  assert.equal(sanitizeRuntimeMetadata(value).metadataComplete, true);
});

test("index column cap is explicit and cannot become a complete index observation", () => {
  const value = fixture(), row = value.tables[0].indexes[0];
  row.columnCount = 32; row.keyColumnCount = 32; row.columnsTruncated = true; row.columns = Array(8).fill("tenant_id");
  const result = sanitizeRuntimeMetadata(value);
  assert.equal(result.metadataComplete, false);
  const retained = result.tables.find((table) => table.relation === value.tables[0].relation).indexes.find((item) => item.name === row.name);
  assert.equal(retained.columnCount, 32); assert.equal(retained.columns.length, 8); assert.equal(retained.columnsTruncated, true);
  row.columnsTruncated = false; shapeFault(value);
});

test("private names, source payloads, function bodies and nonallowlisted keys fail closed", () => {
  for (const change of [
    (value) => { value.rawQuery = secret; },
    (value) => { value.timeoutProfiles[0].config = secret; },
    (value) => { value.timeoutProfiles[2].role = secret; },
    (value) => { value.timeoutProfiles[0].timeouts[0].key = "search_path"; },
    (value) => { value.timeoutProfiles[0].timeouts[0].milliseconds = secret; },
    (value) => { value.functions[0].prosrc = secret; },
    (value) => { value.functions[0].name = secret; },
    (value) => { value.functions[0].schema = secret; },
    (value) => { value.tables[0].relation = secret; },
    (value) => { value.tables[0].indexes[0].name = secret; },
    (value) => { value.tables[0].indexes[0].columns[0] = secret; },
    (value) => { value.tables[0].indexes[0].predicate = secret; },
    (value) => { value.statementStatistics.query = secret; },
    (value) => { value.statementStatistics.schema = secret; },
    (value) => { value.statementStatistics.tracking[0].value = secret; }
  ]) { const value = fixture(); change(value); shapeFault(value); }
});

test("duplicates, missing entries, excess entries and truncated shapes fail closed", () => {
  for (const path of ["timeoutProfiles", "functions", "tables"]) {
    for (const mutation of [(rows) => rows.pop(), (rows) => rows.push(rows[0]), (rows) => { rows[1] = rows[0]; }]) {
      const value = fixture(); mutation(value[path]); shapeFault(value);
    }
  }
  for (const change of [
    (value) => { value.functions[0].timeouts.pop(); },
    (value) => { value.tables[0].indexes.pop(); },
    (value) => { value.statementStatistics.tracking.push(value.statementStatistics.tracking[0]); },
    (value) => { value.timeoutProfiles = null; },
    (value) => { value.functions[0] = null; },
    (value) => { value.tables[0].indexes[0].columns = Array(9).fill("id"); }
  ]) { const value = fixture(); change(value); shapeFault(value); }
});

test("numeric, timestamp and availability contradictions cannot masquerade as valid telemetry", () => {
  for (const change of [
    (value) => { value.tables[0].estimatedRows = -1; },
    (value) => { value.tables[0].estimatedRows = Infinity; },
    (value) => { value.tables[0].liveRowsEstimate = 1.5; },
    (value) => { value.tables[0].deadRowsEstimate = Number.MAX_SAFE_INTEGER + 1; },
    (value) => { value.tables[0].lastAnalyzeAt = secret; },
    (value) => { value.tables[0].statsKnown = false; },
    (value) => { value.tables[0].present = false; },
    (value) => { value.tables[0].indexes[0].present = false; },
    (value) => { value.tables[0].indexes[0].keyColumnCount = 2; },
    (value) => { value.functions[0].overloads = 101; },
    (value) => { value.functions[0].timeouts[0].status = "set"; value.functions[0].timeouts[0].milliseconds = 0; },
    (value) => { value.functions[0].timeouts[0].status = "disabled"; value.functions[0].timeouts[0].milliseconds = 1; },
    (value) => { value.timeoutProfiles[0].present = false; },
    (value) => { value.statementStatistics.installed = false; }
  ]) { const value = fixture(); change(value); shapeFault(value); }
});

test("absent table/statistics/index and disabled timeout are valid explicit observations", () => {
  const value = fixture(), table = value.tables[0];
  table.present = false; table.statsKnown = false; table.estimatedRows = null; table.liveRowsEstimate = null; table.deadRowsEstimate = null; table.lastAnalyzeAt = null;
  table.indexes.forEach((row) => { row.present = false; row.valid = null; row.ready = null; row.columnCount = null; row.keyColumnCount = null; row.partial = null; row.hasExpressions = null; row.columns = []; });
  value.functions[0].timeouts[0] = { key: timeoutKeys[0], status: "disabled", milliseconds: 0 };
  const result = sanitizeRuntimeMetadata(value);
  assert.equal(result.metadataComplete, false);
  assert.equal(result.tables.find((row) => row.relation === table.relation).indexes[0].present, false);
  assert.equal(result.functions.find((row) => row.name === value.functions[0].name).timeouts.find((row) => row.key === timeoutKeys[0]).milliseconds, 0);
});

test("hostile getters/coercions and thrown coded details cannot escape as secret exceptions", () => {
  const getter = fixture();
  Object.defineProperty(getter, "scopeReady", { get() { const error = new Error(secret); error.code = secret; error.cause = secret; throw error; }, enumerable: true });
  shapeFault(getter);
  const coercion = fixture(); coercion.timeoutProfiles[0].scope = { toString() { throw new Error(secret); } }; shapeFault(coercion);
  assert.throws(() => sanitizeRuntimeMetadata({ ...fixture(), scopeReady: false }), (error) => error.code === "RUNTIME_METADATA_SCOPE_INVALID" && error.cause === undefined);
});

test("reviewed maximum metadata stays below the existing pretty JSON wire bound", () => {
  const value = fixture();
  for (const profile of value.timeoutProfiles) {
    profile.overridesPresent = true;
    profile.timeouts = timeoutKeys.map((key) => ({ key, status: "set", milliseconds: Number.MAX_SAFE_INTEGER }));
  }
  value.functions.forEach((row) => { row.timeouts = timeoutKeys.map((key) => ({ key, status: "set", milliseconds: Number.MAX_SAFE_INTEGER })); });
  for (const table of value.tables) {
    table.estimatedRows = Number.MAX_SAFE_INTEGER; table.liveRowsEstimate = Number.MAX_SAFE_INTEGER; table.deadRowsEstimate = Number.MAX_SAFE_INTEGER;
    table.indexes.forEach((row) => { row.columnCount = 32; row.keyColumnCount = 32; row.columnsTruncated = true; row.columns = Array(8).fill("logo_provider_asset_version_id"); });
  }
  const safe = sanitizeRuntimeMetadata(value);
  assert.equal(safe.metadataComplete, false);
  assert.ok(Buffer.byteLength(JSON.stringify([{ report: value }], null, 2)) < 65_536);
  assert.ok(Buffer.byteLength(JSON.stringify(safe, null, 2)) < 65_536);
});
