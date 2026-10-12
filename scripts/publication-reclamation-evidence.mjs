import { Buffer } from "node:buffer";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const PROTECTED_LIMIT = 2048;
const AUDIT_LIMIT = 16;
const RELEASE_LIMIT = 25;
const VERSION_LIMIT = 25;
const SNAPSHOT_LIMIT = 1024;
const MAX_BYTES = 512 * 1024;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COUNT_KEYS = ["playlistReleases", "slideVersions", "snapshots", "publishedBindings"];
const CREATION_KEYS = COUNT_KEYS.slice(0, 3);

class EvidenceFault extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fault = () => { throw new EvidenceFault("RECLAMATION_EVIDENCE_SHAPE_INVALID"); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const uuid = (value) => typeof value === "string" && UUID.test(value);
const hash = (value) => typeof value === "string" && HASH.test(value);

function sinceLiteral(value) {
  if (value === undefined || value === null) return "NULL::timestamptz";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || value.startsWith("0000-") || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new EvidenceFault("EVIDENCE_SINCE_INVALID");
  }
  return `'${value}'::timestamptz`;
}

/** One fixed read-only observation; the only interpolated values are exact UUID/UTC timestamp literals. */
export function reclamationEvidenceSql(tenantId, sinceTimestamp) {
  if (!uuid(tenantId)) throw new EvidenceFault("SCOPE_INVALID");
  const since = sinceLiteral(sinceTimestamp);
  const sqlUuid = "^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$";
  const validVersion = "CASE WHEN jsonb_typeof(entry->'version')='number' AND entry->>'version' ~ '^[1-9][0-9]{0,9}$' THEN (entry->>'version')::numeric<=2147483647 ELSE false END";
  const knownKeys = (expression, names) => `NOT EXISTS(SELECT 1 FROM jsonb_object_keys(CASE WHEN jsonb_typeof(${expression})='object' THEN ${expression} ELSE '{}'::jsonb END) key WHERE key NOT IN (${names.map((name) => `'${name}'`).join(",")}))`;
  const validRelease = `jsonb_typeof(entry)='object' AND jsonb_typeof(entry->'manifestHash')='string' AND entry->>'id' ~ '${sqlUuid}' AND entry->>'playlistId' ~ '${sqlUuid}' AND entry->>'manifestHash' ~ '^[0-9a-f]{64}$' AND jsonb_typeof(entry->'targetIds')='array' AND (${validVersion}) AND ${knownKeys("entry", ["id", "playlistId", "version", "manifestHash", "targetIds"])}`;
  const validSlideVersion = `jsonb_typeof(entry)='object' AND entry->>'id' ~ '${sqlUuid}' AND entry->>'slideId' ~ '${sqlUuid}' AND (${validVersion}) AND ${knownKeys("entry", ["id", "slideId", "version"])}`;
  const safeUuid = (key) => `CASE WHEN entry->>'${key}' ~ '${sqlUuid}' THEN (entry->>'${key}')::uuid END`;
  const safeVersion = `CASE WHEN (${validVersion}) THEN (entry->>'version')::integer END`;
  return `WITH frame AS MATERIALIZED (
    SELECT '${tenantId}'::uuid AS tenant_id, statement_timestamp() AS observed_at, ${since} AS since_at,
      EXISTS(SELECT 1 FROM public.tenants WHERE id='${tenantId}'::uuid AND status='active') AS scope_ready
  ), window_frame AS MATERIALIZED (
    SELECT *, coalesce(since_at<=observed_at AND since_at>=observed_at-interval '7 days',false) AS window_valid FROM frame
  ), protected_all AS MATERIALIZED (
    SELECT release.id,CASE WHEN release.manifest_hash ~ '^[0-9a-f]{64}$' THEN release.manifest_hash END AS manifest_hash FROM public.playlist_releases release CROSS JOIN window_frame f
    WHERE f.scope_ready AND release.tenant_id=f.tenant_id AND private.publication_release_is_referenced_v1(f.tenant_id,release.id)
  ), protected_kept AS MATERIALIZED (SELECT * FROM protected_all ORDER BY id LIMIT ${PROTECTED_LIMIT}),
  protected_rows AS (
    SELECT jsonb_build_object('id',release.id,'manifestHash',release.manifest_hash,
      'itemCount',items.n,'itemFingerprint',items.fingerprint) AS value,release.id
    FROM protected_kept release CROSS JOIN window_frame f CROSS JOIN LATERAL (
      SELECT count(*) AS n,encode(extensions.digest(coalesce(string_agg(
        encode(extensions.digest(to_jsonb(item)::text,'sha256'),'hex'),'' ORDER BY item.sort_order,item.id),''),'sha256'),'hex') AS fingerprint
      FROM public.playlist_release_items item WHERE item.tenant_id=f.tenant_id AND item.release_id=release.id
    ) items
  ), audit_window AS MATERIALIZED (
    SELECT event.id,event.created_at FROM public.audit_events event CROSS JOIN window_frame f
    WHERE f.scope_ready AND f.window_valid AND event.tenant_id=f.tenant_id AND event.created_at>=f.since_at AND event.created_at<=f.observed_at
      AND event.action='publication.superseded_versions.pruned' AND event.result='success' AND event.target_type='tenants' AND event.target_id=f.tenant_id
  ), audit_sample AS MATERIALIZED (SELECT * FROM audit_window ORDER BY created_at DESC,id DESC LIMIT ${AUDIT_LIMIT + 1}),
  audit_kept AS MATERIALIZED (
    SELECT kept.id,kept.created_at,event.metadata FROM (SELECT * FROM audit_sample ORDER BY created_at DESC,id DESC LIMIT ${AUDIT_LIMIT}) kept
    CROSS JOIN window_frame f JOIN public.audit_events event ON event.tenant_id=f.tenant_id AND event.id=kept.id
  ),
  audit_parts AS (
    SELECT *,CASE WHEN jsonb_typeof(metadata->'releases')='array' THEN metadata->'releases' ELSE '[]'::jsonb END AS releases,
      CASE WHEN jsonb_typeof(metadata->'versions')='array' THEN metadata->'versions' ELSE '[]'::jsonb END AS versions,
      CASE WHEN jsonb_typeof(metadata->'snapshotIds')='array' THEN metadata->'snapshotIds' ELSE '[]'::jsonb END AS snapshots,
      coalesce(jsonb_typeof(metadata)='object' AND metadata->'systemExecuted'='true'::jsonb AND metadata->'activeReferencesPreserved'='true'::jsonb
        AND metadata->'assetsDeleted'='0'::jsonb AND jsonb_typeof(metadata->'releases')='array'
        AND jsonb_typeof(metadata->'versions')='array' AND jsonb_typeof(metadata->'snapshotIds')='array'
        AND jsonb_typeof(metadata->'detachedBasis')='array' AND jsonb_typeof(metadata->'clearedSnapshotProvenance')='array'
        AND ${knownKeys("metadata", ["systemExecuted", "activeReferencesPreserved", "assetsDeleted", "releases", "versions", "snapshotIds", "detachedBasis", "clearedSnapshotProvenance"])},false) AS metadata_valid
    FROM audit_kept
  ), audit_checked AS (
    SELECT *, metadata_valid AND jsonb_array_length(releases)+jsonb_array_length(versions)+jsonb_array_length(snapshots)>0
      AND NOT EXISTS(SELECT 1 FROM (SELECT value AS entry FROM jsonb_array_elements(releases) LIMIT ${RELEASE_LIMIT}) checked WHERE NOT coalesce((${validRelease}),false))
      AND NOT EXISTS(SELECT 1 FROM (SELECT value AS entry FROM jsonb_array_elements(versions) LIMIT ${VERSION_LIMIT}) checked WHERE NOT coalesce((${validSlideVersion}),false))
      AND NOT EXISTS(SELECT 1 FROM (SELECT value AS entry FROM jsonb_array_elements(snapshots) LIMIT ${SNAPSHOT_LIMIT}) checked
        WHERE NOT coalesce(jsonb_typeof(entry)='string' AND entry#>>'{}' ~ '${sqlUuid}',false)) AS valid
    FROM audit_parts
  ), audit_rows AS (
    SELECT audit.id,audit.created_at,jsonb_build_object('id',audit.id,'createdAt',audit.created_at,'valid',audit.valid,
      'recordsTruncated',jsonb_array_length(audit.releases)>${RELEASE_LIMIT} OR jsonb_array_length(audit.versions)>${VERSION_LIMIT} OR jsonb_array_length(audit.snapshots)>${SNAPSHOT_LIMIT},
      'releaseCount',jsonb_array_length(audit.releases),'versionCount',jsonb_array_length(audit.versions),'snapshotCount',jsonb_array_length(audit.snapshots),
      'releases',CASE WHEN audit.valid THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',${safeUuid("id")},'playlistId',${safeUuid("playlistId")},'version',${safeVersion},
        'manifestHash',CASE WHEN entry->>'manifestHash' ~ '^[0-9a-f]{64}$' THEN entry->>'manifestHash' END,
        'absent',NOT EXISTS(SELECT 1 FROM public.playlist_releases r WHERE r.tenant_id=f.tenant_id AND r.id=${safeUuid("id")})) ORDER BY position)
        FROM (SELECT value AS entry,ordinality AS position FROM jsonb_array_elements(audit.releases) WITH ORDINALITY LIMIT ${RELEASE_LIMIT}) entries),'[]'::jsonb) ELSE '[]'::jsonb END,
      'versions',CASE WHEN audit.valid THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',${safeUuid("id")},'slideId',${safeUuid("slideId")},'version',${safeVersion},
        'absent',NOT EXISTS(SELECT 1 FROM public.dynamic_slide_versions v WHERE v.tenant_id=f.tenant_id AND v.id=${safeUuid("id")})) ORDER BY position)
        FROM (SELECT value AS entry,ordinality AS position FROM jsonb_array_elements(audit.versions) WITH ORDINALITY LIMIT ${VERSION_LIMIT}) entries),'[]'::jsonb) ELSE '[]'::jsonb END,
      'snapshots',CASE WHEN audit.valid THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',CASE WHEN entry#>>'{}' ~ '${sqlUuid}' THEN (entry#>>'{}')::uuid END,
        'absent',NOT EXISTS(SELECT 1 FROM public.dynamic_slide_snapshots s WHERE s.tenant_id=f.tenant_id
          AND s.id=CASE WHEN entry#>>'{}' ~ '${sqlUuid}' THEN (entry#>>'{}')::uuid END)) ORDER BY position)
        FROM (SELECT value AS entry,ordinality AS position FROM jsonb_array_elements(audit.snapshots) WITH ORDINALITY LIMIT ${SNAPSHOT_LIMIT}) entries),'[]'::jsonb) ELSE '[]'::jsonb END) AS value
    FROM audit_checked audit CROSS JOIN window_frame f
  ), report AS (
    SELECT jsonb_build_object('schemaVersion',1,'tenantId',f.tenant_id,'scopeReady',f.scope_ready,'observedAt',f.observed_at,'since',f.since_at,'windowValid',f.window_valid,
      'counts',jsonb_build_object('playlistReleases',(SELECT count(*) FROM public.playlist_releases WHERE tenant_id=f.tenant_id),
        'slideVersions',(SELECT count(*) FROM public.dynamic_slide_versions WHERE tenant_id=f.tenant_id),
        'snapshots',(SELECT count(*) FROM public.dynamic_slide_snapshots WHERE tenant_id=f.tenant_id),
        'publishedBindings',(SELECT count(*) FROM public.published_dynamic_data WHERE tenant_id=f.tenant_id)),
      'creationTimestampCounts',CASE WHEN f.window_valid THEN jsonb_build_object(
        'playlistReleases',(SELECT count(*) FROM public.playlist_releases WHERE tenant_id=f.tenant_id AND published_at>=f.since_at AND published_at<=f.observed_at),
        'slideVersions',(SELECT count(*) FROM public.dynamic_slide_versions WHERE tenant_id=f.tenant_id AND created_at>=f.since_at AND created_at<=f.observed_at),
        'snapshots',(SELECT count(*) FROM public.dynamic_slide_snapshots WHERE tenant_id=f.tenant_id AND created_at>=f.since_at AND created_at<=f.observed_at)) ELSE NULL END,
      'protectedCount',(SELECT count(*) FROM protected_all),'protectedTruncated',(SELECT count(*)>${PROTECTED_LIMIT} FROM protected_all),
      'protectedReleases',coalesce((SELECT jsonb_agg(value ORDER BY id) FROM protected_rows),'[]'::jsonb),
      'auditCount',(SELECT count(*) FROM audit_window),'auditsTruncated',(SELECT count(*)>${AUDIT_LIMIT} FROM audit_window),
      'pruneAudits',coalesce((SELECT jsonb_agg(value ORDER BY created_at DESC,id DESC) FROM audit_rows),'[]'::jsonb),'outputTruncated',false) AS value
    FROM window_frame f
  ) SELECT CASE WHEN octet_length(value::text)>${MAX_BYTES - 4096}
    THEN value||jsonb_build_object('outputTruncated',true,'protectedReleases','[]'::jsonb,'pruneAudits','[]'::jsonb) ELSE value END AS report FROM report;\n`;
}

function timestamp(value) {
  if (typeof value !== "string") fault();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fault();
  const [, year, month, day, hour, minute, second, fraction = "", zone] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (year === "0000" || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    || Number(hour)>23 || Number(minute)>59 || Number(second)>59
    || (zone !== "Z" && (Number(zone.slice(1, 3))>23 || Number(zone.slice(4))>59))) fault();
  const millis = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction.padEnd(3, "0").slice(0, 3)}${zone}`);
  if (!Number.isFinite(millis)) fault();
  return `${new Date(millis).toISOString().slice(0, 19)}.${fraction.padEnd(6, "0")}Z`;
}
const microseconds = (value) => BigInt(Date.parse(value))*1000n + BigInt(value.slice(23, 26));
function counts(value, keys) {
  if (!exact(value, keys) || keys.some((key) => !count(value[key]))) fault();
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}
function unique(value, seen) {
  if (!uuid(value) || seen.has(value)) fault();
  seen.add(value); return value;
}

function sanitize(value) {
  const keys = ["schemaVersion", "tenantId", "scopeReady", "observedAt", "since", "windowValid", "counts", "creationTimestampCounts", "protectedCount", "protectedTruncated", "protectedReleases", "auditCount", "auditsTruncated", "pruneAudits", "outputTruncated"];
  if (!exact(value, keys) || value.schemaVersion !== 1 || !uuid(value.tenantId) || typeof value.scopeReady !== "boolean") fault();
  if (!value.scopeReady) throw new EvidenceFault("RECLAMATION_EVIDENCE_SCOPE_INVALID");
  if (Buffer.byteLength(JSON.stringify(value), "utf8")>MAX_BYTES) throw new EvidenceFault("RECLAMATION_EVIDENCE_OUTPUT_TOO_LARGE");
  const observedAt = timestamp(value.observedAt);
  let since = null;
  if (value.since !== null) {
    since = timestamp(value.since);
    // Input timestamps have millisecond precision; normalize the SQL rendering.
    if (!since.endsWith("000Z")) fault();
    since = `${since.slice(0, 23)}Z`;
    sinceLiteral(since);
  }
  const sinceMicros = since === null ? null : microseconds(timestamp(since));
  const observedMicros = microseconds(observedAt);
  const validWindow = sinceMicros !== null && sinceMicros<=observedMicros && observedMicros-sinceMicros<=BigInt(WINDOW_MS)*1000n;
  if (typeof value.windowValid !== "boolean" || value.windowValid !== validWindow) fault();
  const totals = counts(value.counts, COUNT_KEYS);
  const created = value.windowValid ? counts(value.creationTimestampCounts, CREATION_KEYS) : null;
  if ((!value.windowValid && value.creationTimestampCounts !== null) || created && CREATION_KEYS.some((key) => created[key]>totals[key])) fault();
  if (!count(value.protectedCount) || value.protectedCount>totals.playlistReleases || !count(value.auditCount)
    || typeof value.protectedTruncated !== "boolean" || value.protectedTruncated !== (value.protectedCount>PROTECTED_LIMIT)
    || typeof value.auditsTruncated !== "boolean" || value.auditsTruncated !== (value.auditCount>AUDIT_LIMIT)
    || typeof value.outputTruncated !== "boolean" || !Array.isArray(value.protectedReleases) || !Array.isArray(value.pruneAudits)
    || value.protectedReleases.length !== (value.outputTruncated ? 0 : Math.min(value.protectedCount, PROTECTED_LIMIT))
    || value.pruneAudits.length !== (value.outputTruncated ? 0 : Math.min(value.auditCount, AUDIT_LIMIT))
    || (!value.windowValid && value.auditCount !== 0)) fault();
  const protectedIds = new Set(), auditIds = new Set(), deletedReleaseIds = new Set(), deletedVersionIds = new Set(), deletedSnapshotIds = new Set();
  const protectedReleases = value.protectedReleases.map((row) => {
    if (!exact(row, ["id", "manifestHash", "itemFingerprint", "itemCount"]) || !hash(row.manifestHash) || !hash(row.itemFingerprint) || !count(row.itemCount)) fault();
    return { id: unique(row.id, protectedIds), manifestHash: row.manifestHash, itemFingerprint: row.itemFingerprint, itemCount: row.itemCount };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const pruneAudits = value.pruneAudits.map((row) => {
    if (!exact(row, ["id", "createdAt", "valid", "recordsTruncated", "releaseCount", "versionCount", "snapshotCount", "releases", "versions", "snapshots"])
      || typeof row.valid !== "boolean" || typeof row.recordsTruncated !== "boolean"
      || ![row.releaseCount, row.versionCount, row.snapshotCount].every(count)
      || ![row.releases, row.versions, row.snapshots].every(Array.isArray)
      || row.recordsTruncated !== (row.releaseCount>RELEASE_LIMIT || row.versionCount>VERSION_LIMIT || row.snapshotCount>SNAPSHOT_LIMIT)
      || row.releases.length !== (row.valid ? Math.min(row.releaseCount, RELEASE_LIMIT) : 0)
      || row.versions.length !== (row.valid ? Math.min(row.versionCount, VERSION_LIMIT) : 0)
      || row.snapshots.length !== (row.valid ? Math.min(row.snapshotCount, SNAPSHOT_LIMIT) : 0)
      || row.valid && row.releaseCount+row.versionCount+row.snapshotCount===0) fault();
    const createdAt = timestamp(row.createdAt);
    if (sinceMicros === null || microseconds(createdAt)<sinceMicros || microseconds(createdAt)>observedMicros) fault();
    const releases = row.releases.map((entry) => {
      if (!exact(entry, ["id", "playlistId", "version", "manifestHash", "absent"]) || !uuid(entry.playlistId) || !hash(entry.manifestHash)
        || !Number.isSafeInteger(entry.version) || entry.version<1 || entry.version>2147483647 || typeof entry.absent !== "boolean") fault();
      return { id: unique(entry.id, deletedReleaseIds), playlistId: entry.playlistId, version: entry.version, manifestHash: entry.manifestHash, absent: entry.absent };
    });
    const versions = row.versions.map((entry) => {
      if (!exact(entry, ["id", "slideId", "version", "absent"]) || !uuid(entry.slideId)
        || !Number.isSafeInteger(entry.version) || entry.version<1 || entry.version>2147483647 || typeof entry.absent !== "boolean") fault();
      return { id: unique(entry.id, deletedVersionIds), slideId: entry.slideId, version: entry.version, absent: entry.absent };
    });
    const snapshots = row.snapshots.map((entry) => {
      if (!exact(entry, ["id", "absent"]) || typeof entry.absent !== "boolean") fault();
      return { id: unique(entry.id, deletedSnapshotIds), absent: entry.absent };
    });
    return { id: unique(row.id, auditIds), createdAt, valid: row.valid, recordsTruncated: row.recordsTruncated,
      releaseCount: row.releaseCount, versionCount: row.versionCount, snapshotCount: row.snapshotCount, releases, versions, snapshots };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const reasons = [];
  if (!value.windowValid) reasons.push("window_unavailable");
  if (!value.auditCount) reasons.push("no_committed_prune_audit_observed");
  if (value.outputTruncated) reasons.push("output_truncated");
  if (value.protectedTruncated) reasons.push("protected_releases_truncated");
  if (value.auditsTruncated) reasons.push("audit_events_truncated");
  if (pruneAudits.some((row) => !row.valid)) reasons.push("audit_metadata_invalid");
  if (pruneAudits.some((row) => row.recordsTruncated)) reasons.push("audit_records_truncated");
  if (pruneAudits.some((row) => [...row.releases, ...row.versions, ...row.snapshots].some((entry) => !entry.absent))) reasons.push("audited_record_still_present");
  if ([...deletedReleaseIds].some((id) => protectedIds.has(id))) reasons.push("protected_release_also_audited");
  const result = { schemaVersion: 1, tenantId: value.tenantId, observedAt, since, windowValid: value.windowValid,
    counts: totals, creationTimestampCounts: created, protectedCount: value.protectedCount, protectedTruncated: value.protectedTruncated, protectedReleases,
    auditCount: value.auditCount, auditsTruncated: value.auditsTruncated, pruneAudits, outputTruncated: value.outputTruncated,
    status: reasons.length ? "UNPROVEN" : "EVIDENCE_COMPLETE", unprovenReasons: reasons,
    completionScope: "single_statement_and_bounded_committed_prune_audit_observations_only",
    referencePreservationCompared: false, commitOrderingVerified: false, mediaDeletionVerified: false, offlinePlaybackVerified: false,
    interpretationLimits: [
      "Creation timestamp counts include surviving rows only; releases use published_at. They do not prove commit ordering or absence of transient creation/deletion.",
      "Protected release IDs and item fingerprints are one observation; unchanged references and immutable items require a complete earlier observation comparison.",
      "observedAt is statement_timestamp, not the snapshot acquisition or commit time. The existing volatile canonical helper can observe concurrent reference commits during collection.",
      "Audit created_at is a transaction timestamp, not a commit timestamp or executing-image SHA. Audited absence is scoped to this tenant and the SELECT snapshot.",
      "Truncated audit details are samples, not full-window ID coverage. No media deletion or physical/offline playback is verified."
    ] };
  if (Buffer.byteLength(JSON.stringify(result), "utf8")>MAX_BYTES) throw new EvidenceFault("RECLAMATION_EVIDENCE_OUTPUT_TOO_LARGE");
  return result;
}

/** Raw details, hostile coercions and exceptions never leave the fixed failure boundary. */
export function sanitizeReclamationEvidence(value) {
  try { return sanitize(value); }
  catch (error) {
    if (error instanceof EvidenceFault && ["RECLAMATION_EVIDENCE_SCOPE_INVALID", "RECLAMATION_EVIDENCE_OUTPUT_TOO_LARGE"].includes(error.code)) {
      throw new EvidenceFault(error.code);
    }
    throw new EvidenceFault("RECLAMATION_EVIDENCE_SHAPE_INVALID");
  }
}
