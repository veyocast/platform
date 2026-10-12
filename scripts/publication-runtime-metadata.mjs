// Fixed catalog observations only. These declarations are not the effective
// timeout of a PostgREST request, and estimates are not source-record counts.
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const TIMEOUTS = ["statement_timeout", "lock_timeout", "idle_in_transaction_session_timeout", "idle_session_timeout", "transaction_timeout"];
const ROLES = ["authenticator", "service_role", "postgres"];
const FUNCTIONS = [
  ["public", "complete_sportlink_sync_v4"], ["public", "complete_sportlink_sync_v1"],
  ["public", "complete_sportlink_sync_before_standing_history_v1"],
  ["public", "record_sportlink_sync_v1"], ["public", "record_sportlink_sync_pre_context_v1"],
  ["private", "deduplicate_sportlink_source_revision_v1"],
  ["private", "refresh_sportlink_source_after_dataset_sync"],
  ["private", "refresh_published_data_after_source_v1"], ["private", "refresh_published_data_v1"],
  ["public", "prune_queued_publication_versions_v1"]
];
const TABLES = {
  sports_clubs: ["sports_clubs_pkey", "sports_clubs_tenant_id_id_key", "sports_clubs_tenant_id_source_connection_id_external_id_key", "sports_clubs_provider_logo_version_idx"],
  sports_teams: ["sports_teams_pkey", "sports_teams_tenant_id_id_key", "sports_teams_tenant_id_source_connection_id_external_id_key", "sports_teams_tenant_idx"],
  sports_matches: ["sports_matches_pkey", "sports_matches_tenant_id_id_key", "sports_matches_tenant_id_source_connection_id_external_id_key", "sports_matches_start_idx"],
  sports_standings: ["sports_standings_pkey", "sports_standings_tenant_id_id_key", "sports_standings_source_external_season_key", "sports_standings_context_idx"],
  sports_activities: ["sports_activities_pkey", "sports_activities_tenant_id_id_key", "sports_activities_tenant_id_source_connection_id_external_i_key", "sports_activities_start_idx"],
  sports_public_people: ["sports_public_people_pkey", "sports_public_people_tenant_id_id_key", "sports_public_people_tenant_id_source_connection_id_externa_key"],
  sportlink_team_members: ["sportlink_team_members_pkey", "sportlink_team_members_tenant_id_id_key", "sportlink_team_members_tenant_id_connection_id_identity_key_key", "sportlink_team_members_match_idx", "sportlink_team_members_code_idx"],
  sportlink_birthdays: ["sportlink_birthdays_pkey", "sportlink_birthdays_tenant_id_id_key", "sportlink_birthdays_tenant_id_connection_id_external_id_key", "sportlink_birthdays_window_idx", "sportlink_birthdays_conflicts_idx"],
  player_heartbeats: ["player_heartbeats_pkey", "player_heartbeats_tenant_device_created_idx", "player_heartbeats_tenant_screen_created_idx", "player_heartbeats_tenant_active_release_idx"]
};
const COLUMNS = new Set(["id", "tenant_id", "source_connection_id", "connection_id", "external_id", "active", "starts_at", "status", "season_key", "last_synced_at", "logo_provider_asset_version_id", "identity_key", "normalized_name", "external_member_code", "next_occurrence", "display_name", "match_status", "device_id", "screen_id", "created_at", "active_release_id", "expression", "unreviewed"]);
const TRACKING = {
  "pg_stat_statements.track": ["none", "top", "all"],
  "pg_stat_statements.track_planning": ["on", "off"],
  track_activities: ["on", "off"],
  track_functions: ["none", "pl", "all"]
};
class MetadataFault extends Error { constructor(code) { super(code); this.code = code; } }
const quote = (value) => `'${value}'`;
const values = (rows) => rows.map((row) => `(${row.map(quote).join(",")})`).join(",\n");

/** One fixed SELECT; no source rows, function bodies, predicates or raw settings. */
export function runtimeMetadataSql(tenantId) {
  if (typeof tenantId !== "string" || tenantId.length !== 36 || !UUID.test(tenantId)) throw new MetadataFault("SCOPE_INVALID");
  return `WITH expected_roles(role_name) AS (VALUES ${values(ROLES.map((role) => [role]))}),
  database_oid AS (SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database()),
  role_profiles AS (
    SELECT 'global_role'::text AS scope,e.role_name AS role,r.oid IS NOT NULL AS present,r.rolconfig IS NOT NULL AS overrides_present,r.rolconfig AS config
    FROM expected_roles e LEFT JOIN pg_catalog.pg_roles r ON r.rolname=e.role_name
    UNION ALL SELECT 'current_database_role',e.role_name,r.oid IS NOT NULL,s.setconfig IS NOT NULL,s.setconfig
    FROM expected_roles e LEFT JOIN pg_catalog.pg_roles r ON r.rolname=e.role_name
    LEFT JOIN pg_catalog.pg_db_role_setting s ON s.setrole=r.oid AND s.setdatabase=(SELECT oid FROM database_oid)
    UNION ALL SELECT scope,NULL::text,true,s.setconfig IS NOT NULL,s.setconfig
    FROM (VALUES ('global_all_roles',0::oid),('current_database_all_roles',(SELECT oid FROM database_oid))) defaults(scope,database_id)
    LEFT JOIN pg_catalog.pg_db_role_setting s ON s.setrole=0 AND s.setdatabase=defaults.database_id
  ), expected_functions(schema_name,function_name) AS (VALUES ${values(FUNCTIONS)}),
  function_profiles AS (
    SELECT e.schema_name,e.function_name,count(p.oid)::integer AS overloads,
      CASE WHEN count(p.oid)=1 THEN (SELECT only_function.proconfig FROM pg_catalog.pg_proc only_function
        WHERE only_function.pronamespace=n.oid AND only_function.proname=e.function_name AND only_function.prokind='f' LIMIT 1) END AS config
    FROM expected_functions e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=e.schema_name
    LEFT JOIN pg_catalog.pg_proc p ON p.pronamespace=n.oid AND p.proname=e.function_name AND p.prokind='f'
    GROUP BY e.schema_name,e.function_name,n.oid
  ), configuration_profiles AS (
    SELECT scope||':'||coalesce(role,'-') AS profile,present,config FROM role_profiles
    UNION ALL SELECT schema_name||'.'||function_name,overloads=1,config FROM function_profiles
  ), timeout_keys(key) AS (VALUES ${values(TIMEOUTS.map((key) => [key]))}),
  timeout_raw AS (
    SELECT p.profile,p.present,k.key,EXISTS(SELECT 1 FROM pg_catalog.pg_settings s WHERE s.name=k.key) AS supported,
      (SELECT count(*) FROM unnest(p.config) entry WHERE split_part(entry,'=',1)=k.key) AS occurrences,
      (SELECT max(substring(entry FROM length(k.key)+2)) FROM unnest(p.config) entry WHERE split_part(entry,'=',1)=k.key) AS raw
    FROM configuration_profiles p CROSS JOIN timeout_keys k
  ), timeout_parsed AS (
    SELECT *,CASE WHEN occurrences=1 AND length(raw)<=40 AND raw ~ '^[0-9]{1,12}(\\.[0-9]{1,6})? *(us|ms|s|min|h|d)?$'
      THEN substring(raw FROM '^[0-9]+(?:\\.[0-9]+)?')::numeric * CASE
        WHEN raw ~ 'us$' THEN 0.001 WHEN raw ~ 'ms$' THEN 1 WHEN raw ~ 's$' THEN 1000
        WHEN raw ~ 'min$' THEN 60000 WHEN raw ~ 'h$' THEN 3600000 WHEN raw ~ 'd$' THEN 86400000 ELSE 1 END END AS milliseconds
    FROM timeout_raw
  ), timeout_rows AS (
    SELECT profile,key,CASE WHEN NOT present THEN 'unknown' WHEN occurrences>1 THEN 'invalid'
      WHEN occurrences=0 THEN CASE WHEN supported THEN 'unset' ELSE 'unsupported' END
      WHEN NOT supported OR milliseconds IS NULL OR milliseconds>9007199254740991 THEN 'invalid'
      WHEN milliseconds=0 THEN 'disabled' ELSE 'set' END AS status,
      CASE WHEN present AND supported AND occurrences=1 AND milliseconds BETWEEN 0 AND 9007199254740991 THEN milliseconds END AS milliseconds
    FROM timeout_parsed
  ), expected_tables(relation) AS (VALUES ${values(Object.keys(TABLES).map((name) => [name]))}),
  table_profiles AS (
    SELECT e.relation,c.oid,c.reltuples,s.relid IS NOT NULL AS stats_known,s.n_live_tup,s.n_dead_tup,s.last_analyze,s.last_autoanalyze
    FROM expected_tables e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.relation AND c.relkind IN ('r','p')
    LEFT JOIN pg_catalog.pg_stat_user_tables s ON s.relid=c.oid
  ), expected_indexes(relation,index_name) AS (VALUES ${values(Object.entries(TABLES).flatMap(([name, indexes]) => indexes.map((index) => [name, index])))}),
  index_profiles AS (
    SELECT e.relation,e.index_name,x.indexrelid,x.indisvalid,x.indisready,x.indnkeyatts,x.indnatts,x.indpred IS NOT NULL AS partial,x.indexprs IS NOT NULL AS expressions,
      CASE WHEN x.indexrelid IS NOT NULL THEN (SELECT jsonb_agg(CASE WHEN key.attnum=0 THEN 'expression'
        WHEN a.attname IN (${[...COLUMNS].filter((name) => !["expression", "unreviewed"].includes(name)).map(quote).join(",")}) THEN a.attname ELSE 'unreviewed' END ORDER BY key.position)
        FROM unnest(x.indkey) WITH ORDINALITY key(attnum,position) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=key.attnum WHERE key.position<=8) END AS columns
    FROM expected_indexes e JOIN table_profiles t ON t.relation=e.relation
    LEFT JOIN pg_catalog.pg_index x ON x.indrelid=t.oid
      AND x.indexrelid IN (SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=e.index_name)
  ), extension_profile AS (
    SELECT e.oid,n.nspname,EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace=e.extnamespace AND c.relname='pg_stat_statements' AND c.relkind='v') AS view_present
    FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_stat_statements'
  ), tracking_rows AS (
    SELECT key,CASE WHEN raw IS NULL THEN 'unset' WHEN raw=ANY(allowed) THEN 'set' ELSE 'invalid' END AS status,
      CASE WHEN raw=ANY(allowed) THEN raw END AS value
    FROM (SELECT key,allowed,current_setting(key,true) AS raw FROM (VALUES ${Object.entries(TRACKING).map(([key, allowed]) => `(${quote(key)},ARRAY[${allowed.map(quote).join(",")}])`).join(",")}) settings(key,allowed)) selected
  )
  SELECT jsonb_build_object(
    'scopeReady',EXISTS(SELECT 1 FROM public.tenants WHERE id='${tenantId}'::uuid AND status='active'),
    'timeoutProfiles',(SELECT jsonb_agg(jsonb_build_object('scope',p.scope,'role',p.role,'present',p.present,'overridesPresent',p.overrides_present,
      'timeouts',(SELECT jsonb_agg(jsonb_build_object('key',key,'status',status,'milliseconds',milliseconds) ORDER BY key) FROM timeout_rows WHERE profile=p.scope||':'||coalesce(p.role,'-'))) ORDER BY p.scope,p.role) FROM role_profiles p),
    'functions',(SELECT jsonb_agg(jsonb_build_object('schema',p.schema_name,'name',p.function_name,'overloads',p.overloads,
      'timeouts',(SELECT jsonb_agg(jsonb_build_object('key',key,'status',status,'milliseconds',milliseconds) ORDER BY key) FROM timeout_rows WHERE profile=p.schema_name||'.'||p.function_name)) ORDER BY p.schema_name,p.function_name) FROM function_profiles p),
    'tables',(SELECT jsonb_agg(jsonb_build_object('relation',t.relation,'present',t.oid IS NOT NULL,
      'estimatedRows',CASE WHEN t.reltuples>=0 THEN t.reltuples END,'statsKnown',t.stats_known,'liveRowsEstimate',t.n_live_tup,'deadRowsEstimate',t.n_dead_tup,
      'lastAnalyzeAt',t.last_analyze,'lastAutoAnalyzeAt',t.last_autoanalyze,
      'unreviewedIndexCount',(SELECT count(*) FROM pg_catalog.pg_index x WHERE x.indrelid=t.oid AND NOT EXISTS(SELECT 1 FROM index_profiles i WHERE i.indexrelid=x.indexrelid)),
      'indexes',(SELECT jsonb_agg(jsonb_build_object('name',i.index_name,'present',i.indexrelid IS NOT NULL,'valid',i.indisvalid,'ready',i.indisready,
        'keyColumnCount',i.indnkeyatts,'columnCount',i.indnatts,'columnsTruncated',CASE WHEN i.indexrelid IS NOT NULL THEN i.indnatts>8 ELSE false END,
        'partial',CASE WHEN i.indexrelid IS NOT NULL THEN i.partial END,'hasExpressions',CASE WHEN i.indexrelid IS NOT NULL THEN i.expressions END,
        'columns',coalesce(i.columns,'[]'::jsonb)) ORDER BY i.index_name) FROM index_profiles i WHERE i.relation=t.relation)) ORDER BY t.relation) FROM table_profiles t),
    'statementStatistics',jsonb_build_object('installed',EXISTS(SELECT 1 FROM extension_profile),'schema',coalesce((SELECT CASE WHEN nspname IN ('extensions','public') THEN nspname ELSE 'unreviewed' END FROM extension_profile),'absent'),
      'viewPresent',coalesce((SELECT view_present FROM extension_profile),false),'tracking',(SELECT jsonb_agg(jsonb_build_object('key',key,'status',status,'value',value) ORDER BY key) FROM tracking_rows))
  ) AS report;\n`;
}

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const numeric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const count = (value) => numeric(value) && Number.isSafeInteger(value);
const fail = () => { throw new MetadataFault("RUNTIME_METADATA_SHAPE_INVALID"); };
function date(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail();
  return new Date(value).toISOString();
}
function fixedRows(value, expected, identity, sanitize) {
  if (!Array.isArray(value) || value.length !== expected.length) fail();
  const seen = new Set();
  const rows = value.map((row) => {
    const key = identity(row);
    if (!expected.includes(key) || seen.has(key)) fail();
    seen.add(key);
    return sanitize(row);
  });
  return rows.sort((a, b) => identity(a).localeCompare(identity(b)));
}
function timeouts(value, known) {
  return fixedRows(value, TIMEOUTS, (row) => row?.key, (row) => {
    if (!exact(row, ["key", "status", "milliseconds"]) || !["set", "disabled", "unset", "unsupported", "invalid", "unknown"].includes(row.status)
      || (row.status === "set" ? !numeric(row.milliseconds) || row.milliseconds === 0 : row.status === "disabled" ? row.milliseconds !== 0 : row.milliseconds !== null)
      || (!known && row.status !== "unknown") || (known && row.status === "unknown")) fail();
    return { key: row.key, status: row.status, milliseconds: row.milliseconds };
  });
}

/** Reject malformed/extra fields; retain only bounded reviewed technical data. */
function sanitize(value) {
  if (!exact(value, ["scopeReady", "timeoutProfiles", "functions", "tables", "statementStatistics"]) || typeof value.scopeReady !== "boolean") fail();
  if (!value.scopeReady) throw new MetadataFault("RUNTIME_METADATA_SCOPE_INVALID");
  const profileKeys = ["global_all_roles:-", "current_database_all_roles:-", ...ROLES.flatMap((role) => [`global_role:${role}`, `current_database_role:${role}`])];
  const profileKey = (row) => `${row?.scope}:${row?.role ?? "-"}`;
  const timeoutProfiles = fixedRows(value.timeoutProfiles, profileKeys, profileKey, (row) => {
    if (!exact(row, ["scope", "role", "present", "overridesPresent", "timeouts"]) || typeof row.present !== "boolean" || typeof row.overridesPresent !== "boolean"
      || (!row.present && row.overridesPresent) || (["global_all_roles", "current_database_all_roles"].includes(row.scope) && (row.role !== null || !row.present))) fail();
    const fields = timeouts(row.timeouts, row.present);
    if (row.present && !row.overridesPresent && fields.some((field) => !["unset", "unsupported"].includes(field.status))) fail();
    return { scope: row.scope, role: row.role, present: row.present, overridesPresent: row.overridesPresent, timeouts: fields };
  });
  const functions = fixedRows(value.functions, FUNCTIONS.map(([schema, name]) => `${schema}.${name}`), (row) => `${row?.schema}.${row?.name}`, (row) => {
    if (!exact(row, ["schema", "name", "overloads", "timeouts"]) || !count(row.overloads) || row.overloads > 100) fail();
    return { schema: row.schema, name: row.name, overloads: row.overloads, timeouts: timeouts(row.timeouts, row.overloads === 1) };
  });
  const tables = fixedRows(value.tables, Object.keys(TABLES), (row) => row?.relation, (row) => {
    if (!exact(row, ["relation", "present", "estimatedRows", "statsKnown", "liveRowsEstimate", "deadRowsEstimate", "lastAnalyzeAt", "lastAutoAnalyzeAt", "unreviewedIndexCount", "indexes"])
      || typeof row.present !== "boolean" || typeof row.statsKnown !== "boolean" || (row.estimatedRows !== null && !numeric(row.estimatedRows))
      || !count(row.unreviewedIndexCount) || row.unreviewedIndexCount > 10000
      || (row.statsKnown ? !count(row.liveRowsEstimate) || !count(row.deadRowsEstimate) : [row.liveRowsEstimate, row.deadRowsEstimate, row.lastAnalyzeAt, row.lastAutoAnalyzeAt].some((field) => field !== null))
      || (!row.present && (row.statsKnown || row.estimatedRows !== null || row.unreviewedIndexCount !== 0))) fail();
    const indexes = fixedRows(row.indexes, TABLES[row.relation], (index) => index?.name, (index) => {
      if (!exact(index, ["name", "present", "valid", "ready", "keyColumnCount", "columnCount", "columnsTruncated", "partial", "hasExpressions", "columns"]) || typeof index.present !== "boolean"
        || typeof index.columnsTruncated !== "boolean" || !Array.isArray(index.columns) || index.columns.length > 8 || !index.columns.every((column) => COLUMNS.has(column))) fail();
      if (index.present ? !row.present || ![index.valid, index.ready, index.partial, index.hasExpressions].every((field) => typeof field === "boolean")
        || !count(index.columnCount) || index.columnCount < 1 || index.columnCount > 32 || index.columns.length !== Math.min(8, index.columnCount)
        || index.columnsTruncated !== (index.columnCount > 8) || !count(index.keyColumnCount) || index.keyColumnCount < 1 || index.keyColumnCount > index.columnCount
        : [index.valid, index.ready, index.keyColumnCount, index.columnCount, index.partial, index.hasExpressions].some((field) => field !== null) || index.columns.length !== 0 || index.columnsTruncated) fail();
      if (index.present && (index.columns.includes("expression") && !index.hasExpressions || !index.columnsTruncated && index.columns.includes("expression") !== index.hasExpressions)) fail();
      return { name: index.name, present: index.present, valid: index.valid, ready: index.ready, keyColumnCount: index.keyColumnCount, columnCount: index.columnCount, columnsTruncated: index.columnsTruncated,
        partial: index.partial, hasExpressions: index.hasExpressions, columns: [...index.columns] };
    });
    return { relation: row.relation, present: row.present, estimatedRows: row.estimatedRows, statsKnown: row.statsKnown,
      liveRowsEstimate: row.liveRowsEstimate, deadRowsEstimate: row.deadRowsEstimate, lastAnalyzeAt: date(row.lastAnalyzeAt), lastAutoAnalyzeAt: date(row.lastAutoAnalyzeAt), unreviewedIndexCount: row.unreviewedIndexCount, indexes };
  });
  const stats = value.statementStatistics;
  if (!exact(stats, ["installed", "schema", "viewPresent", "tracking"]) || typeof stats.installed !== "boolean" || typeof stats.viewPresent !== "boolean"
    || !["extensions", "public", "unreviewed", "absent"].includes(stats.schema) || (!stats.installed && (stats.schema !== "absent" || stats.viewPresent)) || (stats.installed && stats.schema === "absent")) fail();
  const tracking = fixedRows(stats.tracking, Object.keys(TRACKING), (row) => row?.key, (row) => {
    if (!exact(row, ["key", "status", "value"]) || !["set", "unset", "invalid"].includes(row.status) || (row.status === "set" ? !TRACKING[row.key].includes(row.value) : row.value !== null)) fail();
    return { key: row.key, status: row.status, value: row.value };
  });
  const metadataComplete = timeoutProfiles.every((row) => row.present && row.timeouts.every((field) => !["invalid", "unknown"].includes(field.status)))
    && functions.every((row) => row.overloads === 1 && row.timeouts.every((field) => !["invalid", "unknown"].includes(field.status)))
    && tables.every((row) => row.present && row.statsKnown && row.estimatedRows !== null && row.unreviewedIndexCount === 0
      && row.indexes.every((index) => index.present && index.valid && index.ready && !index.columnsTruncated && !index.columns.includes("unreviewed")))
    && stats.installed && stats.viewPresent && stats.schema !== "unreviewed" && tracking.every((row) => row.status === "set");
  return { timeoutProfiles, functions, tables, statementStatistics: { installed: stats.installed, schema: stats.schema, viewPresent: stats.viewPresent, tracking }, metadataComplete,
    timeoutScope: "declared_catalog_configuration_not_effective_postgrest_timeout", estimatesScope: "database_wide_catalog_and_statistics_estimates_not_exact_source_counts" };
}

export function sanitizeRuntimeMetadata(value) {
  try { return sanitize(value); }
  catch (error) {
    // Even hostile getters/coercions supplied by a transport/test double must
    // not turn a shape fault into an exception carrying private content.
    if (error instanceof MetadataFault && error.code === "RUNTIME_METADATA_SCOPE_INVALID") throw new MetadataFault("RUNTIME_METADATA_SCOPE_INVALID");
    throw new MetadataFault("RUNTIME_METADATA_SHAPE_INVALID");
  }
}
