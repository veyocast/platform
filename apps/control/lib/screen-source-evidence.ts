import { validScreenTimestamp } from "@veyocast/domain";

type SourceRow = {
  snapshotId: string; sourceName: string; sourceKind: string; datasetKey: string;
  lastSuccessAt: string | null; lastAttemptAt: string | null; checkedAt: string | null;
  dataRevision: number | null; contentHash: string | null; lastErrorCode: string | null;
};

/** Metadata only. The server RPC owns tenant/screen/publication authorization. */
export function readScreenSourceMetadata(value: unknown): SourceRow[] {
  if (!Array.isArray(value) || value.length > 200) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (!["snapshotId","sourceName","sourceKind","datasetKey"].every(key => typeof row[key] === "string" && (row[key] as string).length <= 200)) return [];
    const text = (key: string) => typeof row[key] === "string" ? row[key] as string : null;
    return [{ snapshotId: text("snapshotId")!, sourceName: text("sourceName")!, sourceKind: text("sourceKind")!, datasetKey: text("datasetKey")!,
      lastSuccessAt: text("lastSuccessAt"), lastAttemptAt: text("lastAttemptAt"), checkedAt: text("checkedAt"),
      dataRevision: Number.isSafeInteger(row.dataRevision) && Number(row.dataRevision) > 0 ? Number(row.dataRevision) : null,
      contentHash: typeof row.contentHash === "string" && /^[a-f0-9]{64}$/.test(row.contentHash) ? row.contentHash : null,
      lastErrorCode: text("lastErrorCode") }];
  });
}

export function screenSourceEvidence(row: SourceRow, reported: { configurationSnapshotId: string; dataRevision: number; contentHash: string } | null, now: number) {
  const validTime = (value: string | null) => validScreenTimestamp(value, now) !== null ? value : null;
  const matches = reported?.configurationSnapshotId === row.snapshotId;
  return {...row, lastSuccessAt: validTime(row.lastSuccessAt), lastAttemptAt: validTime(row.lastAttemptAt), checkedAt: validTime(row.checkedAt),
    reportedRevision: matches ? reported.dataRevision : null,
    contentConfirmed: Boolean(matches && reported.dataRevision === row.dataRevision && reported.contentHash === row.contentHash) };
}
