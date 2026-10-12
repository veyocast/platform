import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { reclamationEvidenceSql, sanitizeReclamationEvidence } from "./publication-reclamation-evidence.mjs";

const tenant = "11111111-1111-1111-1111-111111111111";
const secret = "PRIVATE_PROVIDER_PAYLOAD_OR_CREDENTIAL";
const id = (n) => `22222222-2222-2222-2222-${String(n).padStart(12, "0")}`;
const hash = (character = "a") => character.repeat(64);
const clone = (value) => JSON.parse(JSON.stringify(value));
function fixture() {
  return { schemaVersion: 1, tenantId: tenant, scopeReady: true, observedAt: "2026-10-12T20:00:00.123456+00:00",
    since: "2026-10-12T19:00:00.000+00:00", windowValid: true,
    counts: { playlistReleases: 12, slideVersions: 13, snapshots: 21, publishedBindings: 4 },
    creationTimestampCounts: { playlistReleases: 0, slideVersions: 0, snapshots: 0 },
    protectedCount: 1, protectedTruncated: false,
    protectedReleases: [{ id: id(1), manifestHash: hash(), itemFingerprint: hash("b"), itemCount: 2 }],
    auditCount: 1, auditsTruncated: false, outputTruncated: false,
    pruneAudits: [{ id: id(2), createdAt: "2026-10-12T19:30:00.123456+00:00", valid: true, recordsTruncated: false,
      releaseCount: 1, versionCount: 1, snapshotCount: 1,
      releases: [{ id: id(3), playlistId: id(4), version: 2, manifestHash: hash("c"), absent: true }],
      versions: [{ id: id(5), slideId: id(6), version: 1, absent: true }], snapshots: [{ id: id(7), absent: true }] }] };
}
function safeFault(value, code = "RECLAMATION_EVIDENCE_SHAPE_INVALID") {
  assert.throws(() => sanitizeReclamationEvidence(value), (error) => {
    assert.equal(error.code, code); assert.equal(error.message, code); assert.equal(error.cause, undefined);
    assert.equal(JSON.stringify(error).includes(secret), false); assert.equal(error.stack.includes(secret), false); return true;
  });
}

test("fixed SQL is read-only, canonically scoped, hashes items internally and separately checks audited absence", () => {
  const sql = reclamationEvidenceSql(tenant, "2026-10-12T19:00:00.000Z");
  assert.match(sql, /^WITH frame AS MATERIALIZED/);
  assert.match(sql, /statement_timestamp\(\) AS observed_at/);
  assert.match(sql, /private\.publication_release_is_referenced_v1\(f\.tenant_id,release\.id\)/);
  assert.match(sql, /extensions\.digest\(to_jsonb\(item\)::text,'sha256'\)/);
  assert.match(sql, /item\.tenant_id=f\.tenant_id AND item\.release_id=release\.id/);
  assert.match(sql, /LIMIT 2048/); assert.match(sql, /LIMIT 17/); assert.match(sql, /LIMIT 16/); assert.match(sql, /LIMIT 1024/);
  assert.match(sql, /event\.tenant_id=f\.tenant_id AND event\.created_at>=f\.since_at/);
  assert.match(sql, /'publication\.superseded_versions\.pruned'/);
  assert.match(sql, /'absent',NOT EXISTS\(SELECT 1 FROM public\.playlist_releases r WHERE r\.tenant_id=f\.tenant_id/);
  assert.match(sql, /'absent',NOT EXISTS\(SELECT 1 FROM public\.dynamic_slide_versions v WHERE v\.tenant_id=f\.tenant_id/);
  assert.match(sql, /'absent',NOT EXISTS\(SELECT 1 FROM public\.dynamic_slide_snapshots s WHERE s\.tenant_id=f\.tenant_id/);
  assert.match(sql, /CASE WHEN entry->>'id' ~ '\^\[0-9a-f\]/);
  assert.match(sql, /octet_length\(value::text\)>520192/);
  assert.match(sql, /interval '7 days'/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|drop|create|analyze|set_config|prune_superseded_publication_versions_v1)\b/i);
  assert.doesNotMatch(sql, /jsonb_build_object\([^\n]*(?:'metadata'|'manifest_json'|'payload'|'name'|'targetIds')/);
});

test("SQL arguments reject injection, noncanonical dates and hostile coercion without private errors", () => {
  for (const value of [undefined, null, 1, {}, `${tenant}\n`, `${tenant}' OR true--`, { toString() { throw new Error(secret); } }]) {
    assert.throws(() => reclamationEvidenceSql(value), (error) => error.code === "SCOPE_INVALID" && error.message === "SCOPE_INVALID");
  }
  for (const value of [1, {}, "2026-10-12T19:00:00Z", "2026-10-12T19:00:00.000+00:00", "2026-02-30T00:00:00.000Z", "0000-01-01T00:00:00.000Z", "2026-10-12T19:00:00.000Z' OR true--", { toString() { throw new Error(secret); } }]) {
    assert.throws(() => reclamationEvidenceSql(tenant, value), (error) => error.code === "EVIDENCE_SINCE_INVALID" && error.message === "EVIDENCE_SINCE_INVALID");
  }
  assert.match(reclamationEvidenceSql(tenant), /NULL::timestamptz AS since_at/);
});

test("complete observations retain exact IDs/fingerprints/absence and explicitly exclude acceptance claims", () => {
  const value = fixture(), result = sanitizeReclamationEvidence(value);
  assert.equal(result.status, "EVIDENCE_COMPLETE"); assert.deepEqual(result.unprovenReasons, []);
  assert.equal(result.observedAt, "2026-10-12T20:00:00.123456Z"); assert.equal(result.since, "2026-10-12T19:00:00.000Z");
  assert.equal(result.protectedReleases[0].itemFingerprint, hash("b")); assert.equal(result.pruneAudits[0].releases[0].absent, true);
  assert.equal(result.referencePreservationCompared, false); assert.equal(result.commitOrderingVerified, false);
  assert.equal(result.mediaDeletionVerified, false); assert.equal(result.offlinePlaybackVerified, false);
  assert.match(result.completionScope, /observations_only$/); assert.ok(result.interpretationLimits.some((text) => text.includes("surviving rows only")));
  assert.ok(result.interpretationLimits.some((text) => text.includes("volatile canonical helper")));
  value.protectedReleases[0].manifestHash = secret; assert.equal(JSON.stringify(result).includes(secret), false);
});

test("baseline without a window is useful but never actual deletion proof", () => {
  const value = fixture(); value.since = null; value.windowValid = false; value.creationTimestampCounts = null;
  value.auditCount = 0; value.pruneAudits = [];
  const result = sanitizeReclamationEvidence(value);
  assert.equal(result.status, "UNPROVEN"); assert.equal(result.protectedReleases.length, 1);
  assert.deepEqual(result.unprovenReasons, ["window_unavailable", "no_committed_prune_audit_observed"]);
});

test("future, over-seven-day and microsecond boundary windows remain unavailable", () => {
  for (const since of ["2026-10-12T21:00:00.000Z", "2026-10-01T00:00:00.000Z", "2026-10-05T20:00:00.123Z"]) {
    const value = fixture(); value.since = since; value.windowValid = false; value.creationTimestampCounts = null; value.auditCount = 0; value.pruneAudits = [];
    assert.equal(sanitizeReclamationEvidence(value).status, "UNPROVEN");
    value.windowValid = true; value.creationTimestampCounts = { playlistReleases: 0, slideVersions: 0, snapshots: 0 }; safeFault(value);
  }
  const value = fixture(); value.since = "2026-10-05T20:00:00.124Z";
  assert.equal(sanitizeReclamationEvidence(value).status, "EVIDENCE_COMPLETE");
});

test("zero audits and still-present audited records cannot produce complete reclamation evidence", () => {
  const empty = fixture(); empty.auditCount = 0; empty.pruneAudits = [];
  assert.equal(sanitizeReclamationEvidence(empty).status, "UNPROVEN");
  for (const key of ["releases", "versions", "snapshots"]) {
    const value = fixture(); value.pruneAudits[0][key][0].absent = false;
    assert.ok(sanitizeReclamationEvidence(value).unprovenReasons.includes("audited_record_still_present"));
  }
  const value = fixture(); value.pruneAudits[0].releases[0].id = value.protectedReleases[0].id;
  assert.ok(sanitizeReclamationEvidence(value).unprovenReasons.includes("protected_release_also_audited"));
});

test("malformed stored audit metadata is explicit UNPROVEN with no raw details", () => {
  const value = fixture(), row = value.pruneAudits[0]; row.valid = false; row.releases = []; row.versions = []; row.snapshots = [];
  const result = sanitizeReclamationEvidence(value); assert.equal(result.status, "UNPROVEN");
  assert.ok(result.unprovenReasons.includes("audit_metadata_invalid"));
  row.releases = fixture().pruneAudits[0].releases; safeFault(value);
});

test("protected release and event caps preserve samples with honest incomplete coverage", () => {
  const value = fixture(); value.counts.playlistReleases = 2049; value.protectedCount = 2049; value.protectedTruncated = true;
  value.protectedReleases = Array.from({ length: 2048 }, (_, index) => ({ id: id(10000+index), manifestHash: hash(), itemFingerprint: hash("b"), itemCount: 0 }));
  assert.ok(sanitizeReclamationEvidence(value).unprovenReasons.includes("protected_releases_truncated"));
  const audits = fixture(); audits.auditCount = 17; audits.auditsTruncated = true;
  audits.pruneAudits = Array.from({ length: 16 }, (_, index) => {
    const row = clone(fixture().pruneAudits[0]); row.id = id(20000+index); row.releases[0].id = id(30000+index); row.versions[0].id = id(40000+index); row.snapshots[0].id = id(50000+index); return row;
  });
  const result = sanitizeReclamationEvidence(audits); assert.equal(result.pruneAudits.length, 16); assert.equal(result.status, "UNPROVEN");
});

test("per-audit release/version and snapshot caps never silently truncate", () => {
  for (const [key, countKey, limit] of [["releases", "releaseCount", 25], ["versions", "versionCount", 25], ["snapshots", "snapshotCount", 1024]]) {
    const value = fixture(), row = value.pruneAudits[0], example = row[key][0]; row[countKey] = limit+1; row.recordsTruncated = true;
    row[key] = Array.from({ length: limit }, (_, index) => ({ ...example, id: id(60000+index) }));
    const result = sanitizeReclamationEvidence(value); assert.ok(result.unprovenReasons.includes("audit_records_truncated"));
    row.recordsTruncated = false; safeFault(value);
  }
});

test("SQL output budget suppression remains UNPROVEN and cannot fabricate retained arrays", () => {
  const value = fixture(); value.outputTruncated = true; value.protectedReleases = []; value.pruneAudits = [];
  assert.ok(sanitizeReclamationEvidence(value).unprovenReasons.includes("output_truncated"));
  value.protectedReleases = fixture().protectedReleases; safeFault(value);
});

test("extra private fields at every projected level fail closed", () => {
  for (const modify of [
    (value) => { value.rawQuery = secret; }, (value) => { value.counts.payload = secret; },
    (value) => { value.creationTimestampCounts.commitOrder = secret; }, (value) => { value.protectedReleases[0].manifest_json = secret; },
    (value) => { value.pruneAudits[0].metadata = secret; }, (value) => { value.pruneAudits[0].releases[0].targetIds = [secret]; },
    (value) => { value.pruneAudits[0].versions[0].name = secret; }, (value) => { value.pruneAudits[0].snapshots[0].snapshot_data_json = secret; }
  ]) { const value = fixture(); modify(value); safeFault(value); }
});

test("invalid IDs, hashes, dates, numbers, flags and inconsistent lengths fail closed", () => {
  for (const modify of [
    (value) => { value.tenantId = secret; }, (value) => { value.observedAt = "2026-02-30T00:00:00.000Z"; },
    (value) => { value.since = "2026-10-12T19:00:00.000001Z"; }, (value) => { value.protectedReleases[0].id = secret; },
    (value) => { value.protectedReleases[0].manifestHash = "A".repeat(64); }, (value) => { value.protectedReleases[0].itemFingerprint = secret; },
    (value) => { value.protectedReleases[0].itemCount = -1; }, (value) => { value.counts.snapshots = 1.1; },
    (value) => { value.counts.snapshots = Number.MAX_SAFE_INTEGER+1; }, (value) => { value.creationTimestampCounts.snapshots = 22; },
    (value) => { value.protectedCount = 13; }, (value) => { value.protectedTruncated = true; },
    (value) => { value.auditCount = 2; }, (value) => { value.pruneAudits[0].createdAt = "2026-10-12T20:00:00.123457Z"; },
    (value) => { value.pruneAudits[0].releaseCount = 0; }, (value) => { value.pruneAudits[0].releases[0].playlistId = secret; },
    (value) => { value.pruneAudits[0].releases[0].version = 2147483648; }, (value) => { value.pruneAudits[0].versions[0].version = 0; },
    (value) => { value.pruneAudits[0].snapshots[0].absent = "true"; }, (value) => { value.pruneAudits = null; }
  ]) { const value = fixture(); modify(value); safeFault(value); }
  const scope = fixture(); scope.scopeReady = false; safeFault(scope, "RECLAMATION_EVIDENCE_SCOPE_INVALID");
});

test("duplicates across protected rows, audits and repeated eliminated IDs fail closed", () => {
  const protectedRows = fixture(); protectedRows.protectedCount = 2; protectedRows.protectedReleases.push(clone(protectedRows.protectedReleases[0])); safeFault(protectedRows);
  for (const key of ["id", "releases", "versions", "snapshots"]) {
    const value = fixture(), row = clone(value.pruneAudits[0]); value.auditCount = 2;
    row.id = id(80); row.releases[0].id = id(81); row.versions[0].id = id(82); row.snapshots[0].id = id(83);
    if (key === "id") row.id = value.pruneAudits[0].id; else row[key][0].id = value.pruneAudits[0][key][0].id;
    value.pruneAudits.push(row); safeFault(value);
  }
});

test("oversized transport objects and hostile getters/coercions expose only fixed errors", () => {
  const value = fixture(); value.protectedReleases[0].manifestHash = secret.repeat(20000);
  assert.ok(Buffer.byteLength(JSON.stringify(value))>512*1024); safeFault(value, "RECLAMATION_EVIDENCE_OUTPUT_TOO_LARGE");
  const hostile = fixture(); Object.defineProperty(hostile, "counts", { enumerable: true, get() { throw new Error(secret, { cause: secret }); } }); safeFault(hostile);
  const coercion = fixture(); coercion.counts.snapshots = { valueOf() { throw new Error(secret); } }; safeFault(coercion);
  const serialization = fixture(); serialization.pruneAudits[0].releases[0].toJSON = () => { throw new Error(secret); }; safeFault(serialization);
});
