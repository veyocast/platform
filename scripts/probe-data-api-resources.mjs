import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { open, rm } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { pathToFileURL } from "node:url";

import { createSqlAdapter, diagnosticDatabaseConfig, probeRuntimeDatabase } from "./probe-runtime-database.mjs";

const TENANT = "7526e17f-c819-431c-a05d-4ef5f16ea1c0";
const SHA = /^[0-9a-f]{40}$/;
const ROLES = ["anon", "authenticated", "authenticator", "postgres", "service_role"];
const TABLES = ["player_heartbeats", "sportlink_birthdays", "sportlink_team_members", "sports_activities", "sports_clubs", "sports_matches", "sports_public_people", "sports_standings", "sports_teams"];
const MODES = ["AccessShareLock", "RowShareLock", "RowExclusiveLock", "ShareUpdateExclusiveLock", "ShareLock", "ShareRowExclusiveLock", "ExclusiveLock", "AccessExclusiveLock"];
const COMMANDS = ["CREATE INDEX", "CREATE INDEX CONCURRENTLY", "REINDEX", "REINDEX CONCURRENTLY", "OTHER"];
const PHASES = ["initializing", "waiting for writers before build", "building index", "waiting for writers before validation", "index validation: scanning index", "index validation: sorting tuples", "index validation: scanning table", "waiting for old snapshots", "waiting for readers before marking dead", "waiting for readers before dropping", "OTHER"];
const ACTIVITY_COUNTS = ["sessions", "active", "idle", "idleTransaction", "otherState", "lockWait", "ioWait", "clientWait", "otherWait", "noWait"];
const INDEX_FIELDS = ["onExpectedTable", "valid", "ready", "btree", "nonUnique", "columnsExact", "predicateExact", "defaultOptionsExact"];
const LOCK_RELATIONS = [
  ["public", "tenants", "TENANTS"], ["public", "player_heartbeats", "HEARTBEATS"],
  ["private", "publication_version_prune_queue", "PRUNE_QUEUE"], ["private", "published_data_refresh_queue", "REFRESH_QUEUE"],
  ["public", "published_dynamic_data", "PUBLISHED_BINDINGS"], ["public", "dynamic_data_sources", "DATA_SOURCES"],
  ["public", "sportlink_sync_runs", "SPORTLINK_RUNS"], ["public", "provider_asset_cache", "PROVIDER_CACHE"],
  ["public", "provider_asset_versions", "PROVIDER_VERSIONS"], ["public", "sports_standings", "SPORTS_STANDINGS"],
  ["public", "sports_matches", "SPORTS_MATCHES"], ["public", "sports_teams", "SPORTS_TEAMS"],
  ["public", "sports_clubs", "SPORTS_CLUBS"], ["public", "sportlink_birthdays", "SPORTLINK_BIRTHDAYS"],
  ["public", "dynamic_slide_snapshots", "SNAPSHOTS"], ["public", "dynamic_slide_versions", "SLIDE_VERSIONS"],
  ["public", "playlist_releases", "RELEASES"], ["public", "screen_compositions", "COMPOSITIONS"],
  ["storage", "objects", "STORAGE_OBJECTS"]
];
const WORKLOAD_HINTS = [
  ["prune_queued_publication_versions_v1", "PRUNE"],
  ["complete_sportlink_sync_v4", "SPORTLINK_COMPLETION"],
  ["complete_published_data_refresh_v1", "PUBLISHED_REFRESH_COMPLETION"]
];
const CLASSIFIED_WORKLOADS = WORKLOAD_HINTS.map(row => row[1]);
const classifiedWorkloadsSql = CLASSIFIED_WORKLOADS.map(value => `'${value}'`).join(",");
const WORKLOADS = [...CLASSIFIED_WORKLOADS, "MULTIPLE_HINTS", "UNCLASSIFIED", "UNKNOWN"];
const LOCK_CLASSES = ["TRANSACTION", "TUPLE", "RELATION", "OTHER", "UNKNOWN"];
const LIMITATIONS = [
  "one_bounded_database_wide_metadata_observation_not_tenant_row_counts",
  "baseline_public_health_precedes_metadata_and_does_not_prove_runtime_unchanged",
  "baseline_timestamp_is_probe_completion_not_each_health_sample",
  "metadata_timestamp_is_observation_time_not_an_atomic_lock_or_statistics_snapshot",
  "activity_locks_and_progress_are_current_context_not_historical_failure_cause",
  "activity_counts_are_backend_login_roles_excluding_this_snapshot_not_request_roles",
  "table_progress_does_not_uniquely_identify_the_expected_index_build",
  "catalog_and_dead_live_tuple_values_are_estimates_not_measured_bloat_cpu_memory_or_physical_io",
  "missing_visibility_cap_or_shape_evidence_is_unknown_not_zero_or_recovery",
  "migration_history_presence_and_catalog_shape_do_not_prove_ddl_history_atomicity",
  "relation_oid_mapping_is_current_catalog_not_historical_table_identity",
  "bounded_blocker_edges_are_current_context_not_full_chains_or_deadlock_proof",
  "query_tokens_are_last_statement_hints_not_proof_of_active_rpc",
  "prepared_external_masked_or_unclassified_blockers_are_unknown",
  "parallel_blocker_pids_are_deduplicated_per_waiter_not_global_session_counts"
];
const values = rows => rows.map(value => `('${value}')`).join(",");
const roleListSql = ROLES.map(role => `'${role}'`).join(",");
const safeNumberSql = value => `CASE WHEN ${value} BETWEEN 0 AND 9007199254740991 THEN ${value} END`;
const workloadSql = query => {
  const hints = WORKLOAD_HINTS.map(([token, workload]) => ({
    match: `${query} ~* '(^|[^a-z0-9_])${token}([^a-z0-9_]|$)'`, workload
  }));
  return `CASE WHEN ${query} IS NULL OR ${query} IN ('','<insufficient privilege>') THEN 'UNKNOWN'
  WHEN (${hints.map(hint => `CASE WHEN ${hint.match} THEN 1 ELSE 0 END`).join(" + ")})>1 THEN 'MULTIPLE_HINTS'
  ${hints.map(hint => `WHEN ${hint.match} THEN '${hint.workload}'`).join("\n  ")}
  ELSE 'UNCLASSIFIED' END`;
};

/** One fixed SELECT. Names, queries, PIDs and predicate text never leave SQL. */
export function dataApiResourcesSql() {
  return `WITH visibility AS (
    SELECT coalesce((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user),false)
      OR pg_catalog.pg_has_role(current_user,'pg_read_all_stats','USAGE') AS all_stats
  ), database_scope AS (SELECT oid,oid=5 AS matches FROM pg_catalog.pg_database WHERE datname=current_database()),
  expected_lock_relations(schema_name,relation_name,class) AS (VALUES ${LOCK_RELATIONS.map(row => `(${row.map(value => `'${value}'`).join(",")})`).join(",")}),
  lock_relations AS MATERIALIZED (SELECT e.class,c.oid FROM expected_lock_relations e
    JOIN pg_catalog.pg_namespace n ON n.nspname=e.schema_name
    JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.relation_name AND c.relkind IN ('r','p')),
  relation_profile AS (SELECT matches AS database_matches,
    CASE WHEN NOT matches THEN 'INCOMPARABLE'
      WHEN NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=20982) THEN 'ABSENT'
      WHEN EXISTS(SELECT 1 FROM lock_relations WHERE oid=20982) THEN 'MATCHED' ELSE 'UNREVIEWED' END AS state,
    CASE WHEN matches THEN (SELECT class FROM lock_relations WHERE oid=20982) END AS class FROM database_scope),
  lock_activity AS MATERIALIZED (SELECT pid,usename,query,wait_event_type,${workloadSql("query")} AS workload
    FROM pg_catalog.pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()),
  eligible_waiters AS MATERIALIZED (SELECT a.pid,a.usename AS role,a.workload,
    (SELECT CASE WHEN count(DISTINCT locktype)<>1 THEN 'UNKNOWN' ELSE CASE min(locktype)
      WHEN 'transactionid' THEN 'TRANSACTION' WHEN 'tuple' THEN 'TUPLE' WHEN 'relation' THEN 'RELATION' ELSE 'OTHER' END END
      FROM pg_catalog.pg_locks WHERE pid=a.pid AND NOT granted) AS lock_class
    FROM lock_activity a CROSS JOIN visibility v WHERE v.all_stats AND a.usename IN (${roleListSql})
      AND a.wait_event_type='Lock' AND (a.workload IN (${classifiedWorkloadsSql},'MULTIPLE_HINTS')
        OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=a.pid
          AND l.database=(SELECT oid FROM database_scope) AND l.relation IN (SELECT oid FROM lock_relations)))
    ORDER BY a.pid LIMIT 17),
  kept_waiters AS MATERIALIZED (SELECT * FROM eligible_waiters ORDER BY pid LIMIT 16),
  blocker_sample AS MATERIALIZED (SELECT w.pid AS waiter_pid,b.blocker_pid,
    row_number() OVER(PARTITION BY w.pid ORDER BY b.blocker_pid) AS position FROM kept_waiters w
    CROSS JOIN LATERAL (SELECT DISTINCT blocker_pid FROM unnest(pg_catalog.pg_blocking_pids(w.pid)) blocker_pid ORDER BY blocker_pid LIMIT 17) b),
  kept_blockers AS MATERIALIZED (SELECT s.waiter_pid,
    CASE WHEN a.usename IN (${roleListSql}) THEN a.usename ELSE 'UNKNOWN' END AS role,
    coalesce(a.workload,'UNKNOWN') AS workload,
    CASE WHEN s.blocker_pid=0 THEN 'prepared'
      WHEN a.usename IN (${roleListSql}) AND a.workload IN (${classifiedWorkloadsSql}) THEN 'classified'
      ELSE 'unknown' END AS category
    FROM blocker_sample s LEFT JOIN lock_activity a ON a.pid=s.blocker_pid WHERE s.position<=16),
  blocker_groups AS (SELECT waiter_pid,role,workload,category,count(*) AS n FROM kept_blockers GROUP BY waiter_pid,role,workload,category),
  heartbeat AS (SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='player_heartbeats' AND c.relkind IN ('r','p')),
  roles(role) AS (VALUES ${values(ROLES)}), activity AS (
    SELECT r.role,p.oid IS NOT NULL AS present,(v.all_stats OR r.role=current_user) AS visible,a.*
    FROM roles r CROSS JOIN visibility v LEFT JOIN pg_catalog.pg_roles p ON p.rolname=r.role
    CROSS JOIN LATERAL (SELECT count(*) AS sessions,count(*) FILTER(WHERE state='active') AS active,
      count(*) FILTER(WHERE state='idle') AS idle,count(*) FILTER(WHERE state IN ('idle in transaction','idle in transaction (aborted)')) AS idle_transaction,
      count(*) FILTER(WHERE state IS NULL OR state NOT IN ('active','idle','idle in transaction','idle in transaction (aborted)')) AS other_state,
      count(*) FILTER(WHERE wait_event_type='Lock') AS lock_wait,count(*) FILTER(WHERE wait_event_type='IO') AS io_wait,
      count(*) FILTER(WHERE wait_event_type='Client') AS client_wait,
      count(*) FILTER(WHERE wait_event_type IS NOT NULL AND wait_event_type NOT IN ('Lock','IO','Client')) AS other_wait,
      count(*) FILTER(WHERE wait_event_type IS NULL) AS no_wait
      FROM (SELECT state,wait_event_type FROM pg_catalog.pg_stat_activity
        WHERE datname=current_database() AND usename=r.role AND pid<>pg_backend_pid() ORDER BY pid LIMIT 257) capped) a
  ), lock_sample AS MATERIALIZED (
    SELECT mode,granted FROM pg_catalog.pg_locks WHERE locktype='relation'
      AND database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
      AND relation=(SELECT oid FROM heartbeat) ORDER BY pid NULLS FIRST,mode,granted LIMIT 257
  ), lock_modes(mode) AS (VALUES ${values(MODES)}), progress_sample AS MATERIALIZED (
    SELECT command,phase,lockers_total,lockers_done,blocks_total,blocks_done,tuples_total,tuples_done
    FROM pg_catalog.pg_stat_progress_create_index WHERE datid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
      AND relid=(SELECT oid FROM heartbeat) ORDER BY pid LIMIT 17
  ), tables(relation) AS (VALUES ${values(TABLES)}), table_profiles AS (
    SELECT t.relation,c.oid,c.reltuples,s.relid IS NOT NULL AS stats_known,s.n_live_tup,s.n_dead_tup
    FROM tables t LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=t.relation AND c.relkind IN ('r','p')
    LEFT JOIN pg_catalog.pg_stat_user_tables s ON s.relid=c.oid
  ), named_index AS (SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='player_heartbeats_tenant_active_release_idx'),
  index_profile AS (SELECT c.oid,x.*,am.amname,c.reloptions FROM named_index c
    LEFT JOIN pg_catalog.pg_index x ON x.indexrelid=c.oid LEFT JOIN pg_catalog.pg_am am ON am.oid=c.relam)
  SELECT jsonb_build_object(
    'scopeReady',EXISTS(SELECT 1 FROM public.tenants WHERE id='${TENANT}'::uuid AND status='active'),
    'observedAt',clock_timestamp(),'allStatsVisible',(SELECT all_stats FROM visibility),
    'roles',(SELECT jsonb_agg(jsonb_build_object('role',role,'present',present,'visibilityKnown',visible AND present,
      'truncated',CASE WHEN visible AND present THEN sessions>256 ELSE false END,
      'sessions',CASE WHEN visible AND present THEN sessions END,'active',CASE WHEN visible AND present THEN active END,
      'idle',CASE WHEN visible AND present THEN idle END,'idleTransaction',CASE WHEN visible AND present THEN idle_transaction END,
      'otherState',CASE WHEN visible AND present THEN other_state END,'lockWait',CASE WHEN visible AND present THEN lock_wait END,
      'ioWait',CASE WHEN visible AND present THEN io_wait END,'clientWait',CASE WHEN visible AND present THEN client_wait END,
      'otherWait',CASE WHEN visible AND present THEN other_wait END,'noWait',CASE WHEN visible AND present THEN no_wait END) ORDER BY role) FROM activity),
    'heartbeatLocks',jsonb_build_object('tablePresent',EXISTS(SELECT 1 FROM heartbeat),
      'sampledLocks',(SELECT count(*) FROM lock_sample),'truncated',(SELECT count(*)>256 FROM lock_sample),
      'unreviewedModes',(SELECT count(*) FROM lock_sample WHERE mode NOT IN (SELECT mode FROM lock_modes)),
      'modes',(SELECT jsonb_agg(jsonb_build_object('mode',mode,'granted',(SELECT count(*) FROM lock_sample s WHERE s.mode=m.mode AND s.granted),
        'waiting',(SELECT count(*) FROM lock_sample s WHERE s.mode=m.mode AND NOT s.granted)) ORDER BY mode) FROM lock_modes m)),
    'heartbeatProgress',jsonb_build_object('tablePresent',EXISTS(SELECT 1 FROM heartbeat),
      'visibilityKnown',(SELECT all_stats FROM visibility),'truncated',(SELECT all_stats FROM visibility) AND (SELECT count(*)>16 FROM progress_sample),
      'rows',CASE WHEN (SELECT all_stats FROM visibility) THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
        'command',CASE WHEN command IN (${COMMANDS.filter(value => value !== "OTHER").map(value => `'${value}'`).join(",")}) THEN command ELSE 'OTHER' END,
        'phase',CASE WHEN phase IN (${PHASES.filter(value => value !== "OTHER").map(value => `'${value}'`).join(",")}) THEN phase ELSE 'OTHER' END,
        'lockersTotal',${safeNumberSql("lockers_total")},'lockersDone',${safeNumberSql("lockers_done")},
        'blocksTotal',${safeNumberSql("blocks_total")},'blocksDone',${safeNumberSql("blocks_done")},
        'tuplesTotal',${safeNumberSql("tuples_total")},'tuplesDone',${safeNumberSql("tuples_done")})) FROM progress_sample),'[]'::jsonb) ELSE '[]'::jsonb END),
    'tables',(SELECT jsonb_agg(jsonb_build_object('relation',relation,'present',oid IS NOT NULL,'statsKnown',stats_known,
      'estimatedRows',${safeNumberSql("reltuples")},'liveRowsEstimate',${safeNumberSql("n_live_tup")},
      'deadRowsEstimate',${safeNumberSql("n_dead_tup")}) ORDER BY relation) FROM table_profiles),
    'heartbeatIndex',jsonb_build_object('namePresent',EXISTS(SELECT 1 FROM named_index),
      'onExpectedTable',(SELECT coalesce(indrelid=(SELECT oid FROM heartbeat),false) FROM index_profile),
      'valid',(SELECT indisvalid FROM index_profile),'ready',(SELECT indisready FROM index_profile),
      'btree',(SELECT amname='btree' FROM index_profile),'nonUnique',(SELECT NOT (indisunique OR indisprimary OR indisexclusion) FROM index_profile),
      'columnsExact',(SELECT indnkeyatts=2 AND indnatts=2 AND indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.position) FROM unnest(indkey) WITH ORDINALITY k(attnum,position)
          LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=k.attnum)=ARRAY['tenant_id','active_release_id'] FROM index_profile),
      'predicateExact',(SELECT coalesce(pg_catalog.pg_get_expr(indpred,indrelid,false) IN ('(active_release_id IS NOT NULL)','active_release_id IS NOT NULL'),false) FROM index_profile),
      'defaultOptionsExact',(SELECT reloptions IS NULL AND NOT EXISTS(SELECT 1 FROM unnest(indoption) option WHERE option<>0)
        AND NOT EXISTS(SELECT 1 FROM unnest(indclass) class LEFT JOIN pg_catalog.pg_opclass o ON o.oid=class WHERE NOT coalesce(o.opcdefault,false))
        AND NOT EXISTS(SELECT 1 FROM unnest(indcollation) WITH ORDINALITY col(collation_oid,position)
          LEFT JOIN LATERAL (SELECT attnum FROM unnest(indkey) WITH ORDINALITY k(attnum,position) WHERE k.position=col.position) k ON true
          LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=k.attnum WHERE col.collation_oid IS DISTINCT FROM a.attcollation) FROM index_profile)),
    'heartbeatMigration',jsonb_build_object('versionPresent',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261012190000')),
    'lockDiagnosis',jsonb_build_object('databaseMatches',(SELECT database_matches FROM relation_profile),
      'relationState',(SELECT state FROM relation_profile),'relationClass',(SELECT class FROM relation_profile),
      'visibilityKnown',(SELECT all_stats FROM visibility),
      'waitersSampled',CASE WHEN (SELECT all_stats FROM visibility) THEN (SELECT count(*) FROM eligible_waiters) END,
      'waitersTruncated',(SELECT all_stats FROM visibility) AND (SELECT count(*)>16 FROM eligible_waiters),
      'waiters',coalesce((SELECT jsonb_agg(jsonb_build_object('role',w.role,'workload',w.workload,'lockClass',w.lock_class,
        'blockersSampled',(SELECT count(*) FROM blocker_sample s WHERE s.waiter_pid=w.pid),
        'blockersTruncated',(SELECT count(*)>16 FROM blocker_sample s WHERE s.waiter_pid=w.pid),
        'blockerGroups',coalesce((SELECT jsonb_agg(jsonb_build_object('role',b.role,'workload',b.workload,'category',b.category,'count',b.n)
          ORDER BY b.role,b.workload,b.category) FROM blocker_groups b WHERE b.waiter_pid=w.pid),'[]'::jsonb)) ORDER BY w.pid) FROM kept_waiters w),'[]'::jsonb))
  ) AS report;\n`;
}

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const count = value => Number.isSafeInteger(value) && value >= 0;
const numeric = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const invalid = () => { throw new Error("RESOURCE_METADATA_INVALID"); };
function fixedRows(rows, names, key, check) {
  if (!Array.isArray(rows) || rows.length !== names.length || new Set(rows.map(row => row?.[key])).size !== names.length) invalid();
  return rows.map(row => { if (!names.includes(row?.[key])) invalid(); return check(row); }).sort((a, b) => a[key].localeCompare(b[key]));
}

function sanitizeLockDiagnosis(value, allStatsVisible) {
  if (!exact(value, ["databaseMatches", "relationState", "relationClass", "visibilityKnown", "waitersSampled", "waitersTruncated", "waiters"])
    || ![value.databaseMatches, value.visibilityKnown, value.waitersTruncated].every(field => typeof field === "boolean")
    || value.visibilityKnown !== allStatsVisible || !["INCOMPARABLE", "ABSENT", "UNREVIEWED", "MATCHED"].includes(value.relationState)
    || (value.relationState === "INCOMPARABLE") !== !value.databaseMatches
    || (value.relationState === "MATCHED" ? !LOCK_RELATIONS.some(row => row[2] === value.relationClass) : value.relationClass !== null)
    || !Array.isArray(value.waiters) || value.waiters.length > 16
    || (value.visibilityKnown ? !count(value.waitersSampled) || value.waitersSampled > 17
      || value.waitersTruncated !== (value.waitersSampled > 16) || value.waiters.length !== Math.min(value.waitersSampled, 16)
      : value.waitersSampled !== null || value.waitersTruncated || value.waiters.length !== 0)) invalid();
  const waiters = value.waiters.map(row => {
    if (!exact(row, ["role", "workload", "lockClass", "blockersSampled", "blockersTruncated", "blockerGroups"])
      || !ROLES.includes(row.role) || !WORKLOADS.includes(row.workload) || !LOCK_CLASSES.includes(row.lockClass)
      || !count(row.blockersSampled) || row.blockersSampled > 17 || typeof row.blockersTruncated !== "boolean"
      || row.blockersTruncated !== (row.blockersSampled > 16) || !Array.isArray(row.blockerGroups) || row.blockerGroups.length > 16) invalid();
    const seen = new Set();
    const blockerGroups = row.blockerGroups.map(group => {
      if (!exact(group, ["role", "workload", "category", "count"]) || ![...ROLES, "UNKNOWN"].includes(group.role)
        || !WORKLOADS.includes(group.workload) || !["classified", "unknown", "prepared"].includes(group.category)
        || !count(group.count) || group.count < 1 || group.count > 16
        || (group.category === "classified") !== (ROLES.includes(group.role) && CLASSIFIED_WORKLOADS.includes(group.workload))
        || group.category === "prepared" && (group.role !== "UNKNOWN" || group.workload !== "UNKNOWN" || group.count !== 1)) invalid();
      const key = [group.role, group.workload, group.category].join(":");
      if (seen.has(key)) invalid(); seen.add(key);
      return { ...group };
    });
    if (blockerGroups.reduce((total, group) => total + group.count, 0) !== Math.min(row.blockersSampled, 16)) invalid();
    return { ...row, blockerGroups };
  });
  const unknownWaiters = value.visibilityKnown ? waiters.filter(row => !CLASSIFIED_WORKLOADS.includes(row.workload) || ["OTHER", "UNKNOWN"].includes(row.lockClass)).length : null;
  const unknownBlockerEdges = value.visibilityKnown ? waiters.reduce((total, row) => total + row.blockerGroups.filter(group => group.category !== "classified").reduce((n, group) => n + group.count, 0), 0) : null;
  const preparedBlockerEdges = value.visibilityKnown ? waiters.reduce((total, row) => total + row.blockerGroups.filter(group => group.category === "prepared").reduce((n, group) => n + group.count, 0), 0) : null;
  const waitersWithoutBlockers = value.visibilityKnown ? waiters.filter(row => row.blockersSampled === 0).length : null;
  const complete = value.databaseMatches && value.relationState === "MATCHED" && value.visibilityKnown && !value.waitersTruncated
    && unknownWaiters === 0 && unknownBlockerEdges === 0 && waitersWithoutBlockers === 0 && waiters.every(row => !row.blockersTruncated);
  return { ...value, waiters, unknownWaiters, unknownBlockerEdges, preparedBlockerEdges, waitersWithoutBlockers, complete };
}

export function sanitizeDataApiResources(value) {
  try {
    if (!exact(value, ["scopeReady", "observedAt", "allStatsVisible", "roles", "heartbeatLocks", "heartbeatProgress", "tables", "heartbeatIndex", "heartbeatMigration", "lockDiagnosis"])
      || value.scopeReady !== true || typeof value.allStatsVisible !== "boolean"
      || typeof value.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.observedAt)
      || !Number.isFinite(Date.parse(value.observedAt))) invalid();
    const roles = fixedRows(value.roles, ROLES, "role", row => {
      if (!exact(row, ["role", "present", "visibilityKnown", "truncated", ...ACTIVITY_COUNTS])
        || ![row.present, row.visibilityKnown, row.truncated].every(field => typeof field === "boolean")
        || !row.present && row.visibilityKnown || !row.visibilityKnown && row.truncated
        || ACTIVITY_COUNTS.some(key => row.visibilityKnown ? !count(row[key]) || row[key] > 257 : row[key] !== null)) invalid();
      if (row.visibilityKnown && (row.truncated !== (row.sessions > 256)
        || row.active + row.idle + row.idleTransaction + row.otherState !== row.sessions
        || row.lockWait + row.ioWait + row.clientWait + row.otherWait + row.noWait !== row.sessions)) invalid();
      return { ...row };
    });
    const locks = value.heartbeatLocks;
    if (!exact(locks, ["tablePresent", "sampledLocks", "truncated", "unreviewedModes", "modes"])
      || typeof locks.tablePresent !== "boolean" || typeof locks.truncated !== "boolean" || !count(locks.sampledLocks) || locks.sampledLocks > 257
      || locks.truncated !== (locks.sampledLocks > 256) || !count(locks.unreviewedModes) || locks.unreviewedModes > locks.sampledLocks) invalid();
    const modes = fixedRows(locks.modes, MODES, "mode", row => {
      if (!exact(row, ["mode", "granted", "waiting"]) || !count(row.granted) || !count(row.waiting)) invalid(); return { ...row };
    });
    if (modes.reduce((total, row) => total + row.granted + row.waiting, locks.unreviewedModes) !== locks.sampledLocks
      || !locks.tablePresent && locks.sampledLocks !== 0) invalid();
    const progress = value.heartbeatProgress;
    if (!exact(progress, ["tablePresent", "visibilityKnown", "truncated", "rows"])
      || ![progress.tablePresent, progress.visibilityKnown, progress.truncated].every(field => typeof field === "boolean")
      || progress.visibilityKnown !== value.allStatsVisible || !Array.isArray(progress.rows) || progress.rows.length > 17
      || progress.truncated !== (progress.rows.length > 16) || (!progress.visibilityKnown || !progress.tablePresent) && progress.rows.length !== 0) invalid();
    const rows = progress.rows.map(row => {
      const counters = ["lockersTotal", "lockersDone", "blocksTotal", "blocksDone", "tuplesTotal", "tuplesDone"];
      if (!exact(row, ["command", "phase", ...counters]) || !COMMANDS.includes(row.command) || !PHASES.includes(row.phase)
        || counters.some(key => row[key] !== null && !count(row[key]))) invalid(); return { ...row };
    });
    const tables = fixedRows(value.tables, TABLES, "relation", row => {
      if (!exact(row, ["relation", "present", "statsKnown", "estimatedRows", "liveRowsEstimate", "deadRowsEstimate"])
        || ![row.present, row.statsKnown].every(field => typeof field === "boolean") || !row.present && (row.statsKnown || row.estimatedRows !== null)
        || row.estimatedRows !== null && !numeric(row.estimatedRows)
        || [row.liveRowsEstimate, row.deadRowsEstimate].some(field => row.statsKnown ? field !== null && !count(field) : field !== null)) invalid();
      return { ...row };
    });
    const index = value.heartbeatIndex;
    if (!exact(index, ["namePresent", ...INDEX_FIELDS]) || typeof index.namePresent !== "boolean"
      || INDEX_FIELDS.some(key => index[key] !== null && typeof index[key] !== "boolean")
      || !index.namePresent && INDEX_FIELDS.some(key => index[key] !== null)) invalid();
    if (!exact(value.heartbeatMigration, ["versionPresent"]) || typeof value.heartbeatMigration.versionPresent !== "boolean") invalid();
    const lockDiagnosis = sanitizeLockDiagnosis(value.lockDiagnosis, value.allStatsVisible);
    const contextComplete = lockDiagnosis.complete && value.allStatsVisible && roles.every(row => row.present && row.visibilityKnown && !row.truncated && row.otherState === 0)
      && locks.tablePresent && !locks.truncated && locks.unreviewedModes === 0 && progress.tablePresent && progress.visibilityKnown && !progress.truncated
      && rows.every(row => row.command !== "OTHER" && row.phase !== "OTHER" && Object.values(row).every(field => field !== null))
      && tables.every(row => row.present && row.statsKnown && row.estimatedRows !== null && row.liveRowsEstimate !== null && row.deadRowsEstimate !== null)
      && (!index.namePresent || INDEX_FIELDS.every(key => index[key] !== null));
    return { observedAt: new Date(value.observedAt).toISOString(), allStatsVisible: value.allStatsVisible, roles,
      heartbeatLocks: { ...locks, modes }, heartbeatProgress: { ...progress, rows }, tables,
      heartbeatIndex: { ...index, exactDefinition: index.namePresent && ["onExpectedTable", "btree", "nonUnique", "columnsExact", "predicateExact", "defaultOptionsExact"].every(key => index[key] === true) },
      heartbeatMigration: { versionPresent: value.heartbeatMigration.versionPresent }, lockDiagnosis, contextComplete };
  } catch { throw new Error("RESOURCE_METADATA_INVALID"); }
}

function metadataResult(result) {
  if (!result?.ok || result.timedOut || result.tooLarge || typeof result.stdout !== "string" || Buffer.byteLength(result.stdout) > 65_536) invalid();
  const rows = JSON.parse(result.stdout);
  // JSON.parse silently overwrites duplicate keys. Check the already-valid
  // JSON token stream so repeated/escaped keys cannot manufacture evidence.
  const tokens = result.stdout.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g);
  let position = 0;
  const consume = () => {
    const token = tokens[position++];
    if (token === "{") {
      const keys = new Set();
      if (tokens[position] === "}") { position++; return; }
      for (;;) {
        const key = JSON.parse(tokens[position++]);
        if (keys.has(key)) invalid(); keys.add(key); position++;
        consume(); if (tokens[position++] === "}") return;
      }
    }
    if (token === "[") {
      if (tokens[position] === "]") { position++; return; }
      for (;;) { consume(); if (tokens[position++] === "]") return; }
    }
  };
  consume();
  if (!Array.isArray(rows) || rows.length !== 1 || !exact(rows[0], ["report"])) invalid();
  return sanitizeDataApiResources(rows[0].report);
}

const BASELINE_CODES = new Set(["DATABASE_READY", "DATABASE_READ_UNPROVEN", "PUBLIC_HEALTH_READ_FAILED", "PUBLIC_HEALTH_SCOPE_MISMATCH", "PUBLIC_HEALTH_TIMEOUT", "SCOPE_INVALID", "SECRET_CONFIG_INVALID", "PROBE_CANCELLED", "PROBE_FAILED"]);
const STAGE_CODES = new Set(["SQL_READY", "SQL_CONNECT_FAILED", "SQL_QUERY_FAILED", "SQL_EXEC_FAILED", "SQL_TIMEOUT", "SQL_OUTPUT_TOO_LARGE", "SQL_OUTPUT_INVALID", "SQL_SCOPE_UNPROVEN", "REST_READY", "REST_TIMEOUT", "REST_READ_FAILED", "REST_SCOPE_UNPROVEN", "REST_OUTPUT_TOO_LARGE", "PROBE_CANCELLED"]);
const DB_CODES = new Set(["08001", "08006", "28P01", "28000", "42501", "57014", "53300", "57P01", "57P02", "57P03", "3D000", "42P01", "PGRST000", "PGRST001", "PGRST002", "PGRST003"]);
function baselineProjection(report) {
  const stage = value => value ? { code: STAGE_CODES.has(value.code) ? value.code : "UNKNOWN", tenantActive: value.tenantActive === true,
    ...(DB_CODES.has(value.databaseCode) ? { databaseCode: value.databaseCode } : {}),
    ...(Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599 ? { httpStatus: value.httpStatus } : {}),
    ...(count(value.elapsedMs) ? { elapsedMs: value.elapsedMs } : {}) } : undefined;
  const health = Array.isArray(report?.health) ? report.health.slice(0, 2).map(row => ({ service: ["control", "player"].includes(row.service) ? row.service : "UNKNOWN",
    status: ["passed", "failed"].includes(row.status) ? row.status : "UNKNOWN", ...(count(row.elapsedMs) ? { elapsedMs: row.elapsedMs } : {}) })) : [];
  return { code: BASELINE_CODES.has(report?.code) ? report.code : "UNKNOWN", health,
    ...(stage(report?.sql) ? { sql: stage(report.sql) } : {}), ...(stage(report?.rest) ? { rest: stage(report.rest) } : {}),
    ...(typeof report?.observedAt === "string" && Number.isFinite(Date.parse(report.observedAt)) ? { observedAt: new Date(report.observedAt).toISOString() } : {}) };
}

export async function probeDataApiResources({ expectedRuntimeSha, environment = process.env }, {
  probe = probeRuntimeDatabase, executeSql = createSqlAdapter(), operationSignal, metadataDeadlineMs = 20_000, now = () => new Date()
} = {}) {
  const started = performance.now();
  const observed = { schemaVersion: 1, event: "data_api_resources_probe", completionScope: "one_read_only_context_snapshot_not_root_cause_or_readiness", limitations: [...LIMITATIONS] };
  const finish = (code, exitCode = 1) => ({ exitCode, report: { ...observed, code, verdict: "UNPROVEN", observedAt: now().toISOString(), elapsedMs: Math.round(performance.now() - started) } });
  if (environment.GITHUB_REF !== "refs/heads/main" || !SHA.test(environment.GITHUB_SHA ?? "") || !SHA.test(expectedRuntimeSha ?? "")
    || !Number.isInteger(metadataDeadlineMs) || metadataDeadlineMs < 1 || metadataDeadlineMs > 20_000
    || operationSignal !== undefined && !(operationSignal instanceof globalThis.AbortSignal)) return finish("RESOURCE_SCOPE_INVALID", 2);
  Object.assign(observed, { workflowSha: environment.GITHUB_SHA, runtimeSha: expectedRuntimeSha, tenantId: TENANT });
  if (operationSignal?.aborted) return finish("RESOURCE_CANCELLED");
  try {
    const before = await probe({ environment, targetEnvironment: "production", expectedRuntimeSha, tenantId: TENANT }, { operationSignal, executeSql });
    observed.baseline = baselineProjection(before.report);
    if (operationSignal?.aborted) return finish("RESOURCE_CANCELLED");
    if (!before.report?.scope || before.report.scope.environment !== "production" || before.report.scope.runtimeSha !== expectedRuntimeSha || before.report.scope.tenantId !== TENANT
      || before.report.sql?.code !== "SQL_READY" || before.report.sql.tenantActive !== true
      || before.report.health?.length !== 2 || before.report.health[0].service !== "control" || before.report.health[1].service !== "player"
      || before.report.health.some(row => row.status !== "passed")) return finish("RESOURCE_BASELINE_UNPROVEN");
    const config = diagnosticDatabaseConfig(environment.SUPABASE_DB_URL, environment.PGCONNECT_TIMEOUT, environment.SUPABASE_PROJECT_REF, environment);
    const controller = new globalThis.AbortController();
    let timer, rejectAbort;
    const abort = () => { controller.abort(); rejectAbort?.(new Error("RESOURCE_CANCELLED")); };
    operationSignal?.addEventListener("abort", abort, { once: true });
    try {
      const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
      if (operationSignal?.aborted) abort();
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("RESOURCE_METADATA_TIMEOUT")); }, metadataDeadlineMs); });
      const result = await Promise.race([cancelled, deadline, Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("RESOURCE_CANCELLED");
        return executeSql({ databaseUrl: config.databaseUrl, sql: dataApiResourcesSql(), signal: controller.signal });
      })]);
      if (operationSignal?.aborted) return finish("RESOURCE_CANCELLED");
      observed.metadata = metadataResult(result);
      return finish(observed.metadata.contextComplete ? "RESOURCE_CONTEXT_OBSERVED" : "RESOURCE_CONTEXT_INCOMPLETE", 0);
    } finally { clearTimeout(timer); operationSignal?.removeEventListener("abort", abort); }
  } catch (error) {
    return finish(operationSignal?.aborted ? "RESOURCE_CANCELLED" : error?.message === "RESOURCE_METADATA_TIMEOUT" ? "RESOURCE_METADATA_TIMEOUT" : "RESOURCE_CONTEXT_UNPROVEN");
  }
}

export async function dataApiResourcesCli({ argv = process.argv.slice(2), environment = process.env, stdout = process.stdout, probe = probeDataApiResources } = {}) {
  if (argv.length !== 1) return 2;
  const controller = new globalThis.AbortController();
  let signalExit;
  const cancel = code => { if (signalExit === undefined) signalExit = code; controller.abort(); };
  const interrupt = () => cancel(130), terminate = () => cancel(143);
  const timer = setTimeout(() => controller.abort(), 180_000);
  process.on("SIGINT", interrupt); process.on("SIGTERM", terminate);
  try {
    const result = await probe({ expectedRuntimeSha: argv[0], environment }, { operationSignal: controller.signal });
    if (environment.RUNNER_TEMP) {
      const path = join(environment.RUNNER_TEMP, "data-api-resources.json"); await rm(path, { force: true });
      const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(JSON.stringify(result.report) + "\n"); } finally { await file.close(); }
    }
    stdout.write(JSON.stringify(result.report) + "\n");
    return signalExit ?? (controller.signal.aborted ? 1 : result.exitCode);
  } catch { stdout.write('{"schemaVersion":1,"event":"data_api_resources_probe","code":"RESOURCE_OUTPUT_UNPROVEN","verdict":"UNPROVEN"}\n'); return signalExit ?? 1; }
  finally { clearTimeout(timer); process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await dataApiResourcesCli();
