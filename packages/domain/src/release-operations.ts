export type ReleaseComparisonItem = Readonly<{
  assetTitle: string;
  backgroundColor: string | null;
  checksumSha256: string;
  cropFocusX: number;
  cropFocusY: number;
  displayTitle: string | null;
  durationSeconds: number;
  enabled: boolean;
  fileSizeBytes: number;
  fitMode: string;
  mediaAssetId: string;
  muted: boolean;
  sortOrder: number;
  sourceItemId: string | null;
  transition: string;
  trimEndSeconds: number | null;
  trimStartSeconds: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  volumePercent: number;
}>;

export type ReleaseItemChange = Readonly<{
  after: ReleaseComparisonItem;
  before: ReleaseComparisonItem;
  fields: readonly (
    | "asset"
    | "background"
    | "checksum"
    | "crop"
    | "duration"
    | "enabled"
    | "fit"
    | "label"
    | "muted"
    | "size"
    | "transition"
    | "trim"
    | "visibility"
    | "volume"
  )[];
}>;

export type ReleaseItemMove = Readonly<{
  after: ReleaseComparisonItem;
  before: ReleaseComparisonItem;
  from: number;
  to: number;
}>;

export type ReleaseComparison = Readonly<{
  added: readonly ReleaseComparisonItem[];
  bytesDelta: number;
  changed: readonly ReleaseItemChange[];
  durationDeltaSeconds: number;
  moved: readonly ReleaseItemMove[];
  removed: readonly ReleaseComparisonItem[];
}>;

export function compareReleaseItems(
  before: readonly ReleaseComparisonItem[],
  after: readonly ReleaseComparisonItem[]
): ReleaseComparison {
  const beforeByKey = new Map(before.map((item) => [releaseItemKey(item), item]));
  const afterByKey = new Map(after.map((item) => [releaseItemKey(item), item]));
  const added = after.filter((item) => !beforeByKey.has(releaseItemKey(item)));
  const removed = before.filter((item) => !afterByKey.has(releaseItemKey(item)));
  const moved: ReleaseItemMove[] = [];
  const changed: ReleaseItemChange[] = [];

  for (const afterItem of after) {
    const beforeItem = beforeByKey.get(releaseItemKey(afterItem));
    if (!beforeItem) continue;

    if (beforeItem.sortOrder !== afterItem.sortOrder) {
      moved.push({
        after: afterItem,
        before: beforeItem,
        from: beforeItem.sortOrder,
        to: afterItem.sortOrder
      });
    }

    const fields: ReleaseItemChange["fields"][number][] = [];
    if (beforeItem.mediaAssetId !== afterItem.mediaAssetId) fields.push("asset");
    if (beforeItem.checksumSha256 !== afterItem.checksumSha256) fields.push("checksum");
    if (beforeItem.durationSeconds !== afterItem.durationSeconds) fields.push("duration");
    if (beforeItem.fitMode !== afterItem.fitMode) fields.push("fit");
    if (beforeItem.muted !== afterItem.muted) fields.push("muted");
    if (beforeItem.fileSizeBytes !== afterItem.fileSizeBytes) fields.push("size");
    if (beforeItem.backgroundColor !== afterItem.backgroundColor) fields.push("background");
    if (beforeItem.cropFocusX !== afterItem.cropFocusX || beforeItem.cropFocusY !== afterItem.cropFocusY) fields.push("crop");
    if (beforeItem.displayTitle !== afterItem.displayTitle) fields.push("label");
    if (beforeItem.enabled !== afterItem.enabled) fields.push("enabled");
    if (beforeItem.transition !== afterItem.transition) fields.push("transition");
    if (beforeItem.trimStartSeconds !== afterItem.trimStartSeconds || beforeItem.trimEndSeconds !== afterItem.trimEndSeconds) fields.push("trim");
    if (beforeItem.visibleFrom !== afterItem.visibleFrom || beforeItem.visibleUntil !== afterItem.visibleUntil) fields.push("visibility");
    if (beforeItem.volumePercent !== afterItem.volumePercent) fields.push("volume");
    if (fields.length) changed.push({ after: afterItem, before: beforeItem, fields });
  }

  return {
    added,
    bytesDelta: sum(after, "fileSizeBytes") - sum(before, "fileSizeBytes"),
    changed,
    durationDeltaSeconds:
      sum(after, "durationSeconds") - sum(before, "durationSeconds"),
    moved,
    removed
  };
}

export const releasePreflightReasonCodes = [
  "SCREEN_DISABLED",
  "SCREEN_MAINTENANCE",
  "DEVICE_MISSING",
  "HEARTBEAT_MISSING",
  "HEARTBEAT_STALE",
  "MANIFEST_INCOMPATIBLE",
  "MANIFEST_COMPATIBILITY_UNKNOWN",
  "STORAGE_UNKNOWN",
  "STORAGE_INSUFFICIENT",
  "STORAGE_MARGIN_LOW"
] as const;

export type ReleasePreflightReasonCode =
  (typeof releasePreflightReasonCodes)[number];
export type ReleasePreflightStatus = "ready" | "warning" | "blocked" | "unknown";

export type ReleasePreflightInput = Readonly<{
  activeReleaseChecksums?: readonly string[];
  capabilities?: Readonly<{ manifestSchemaVersions?: readonly number[] }> | null;
  devicePresent: boolean;
  heartbeatAt: string | null;
  now: string;
  previousReleaseChecksums?: readonly string[];
  release: Readonly<{
    items: readonly Readonly<{ checksumSha256: string; fileSizeBytes: number }>[];
    schemaVersion: number;
  }>;
  screenStatus: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number | null;
}>;

export type ReleasePreflightResult = Readonly<{
  availableBytes: number | null;
  missingBytes: number | null;
  reasons: readonly ReleasePreflightReasonCode[];
  status: ReleasePreflightStatus;
}>;

const heartbeatFreshnessMs = 2 * 60 * 1000;
const storageSafetyMarginBytes = 64 * 1024 * 1024;

export function evaluateReleasePreflight(
  input: ReleasePreflightInput
): ReleasePreflightResult {
  const blocked: ReleasePreflightReasonCode[] = [];
  const unknown: ReleasePreflightReasonCode[] = [];
  const warnings: ReleasePreflightReasonCode[] = [];

  if (input.screenStatus === "disabled") blocked.push("SCREEN_DISABLED");
  if (input.screenStatus === "maintenance") warnings.push("SCREEN_MAINTENANCE");
  if (!input.devicePresent) unknown.push("DEVICE_MISSING");

  const heartbeatAge = input.heartbeatAt
    ? Date.parse(input.now) - Date.parse(input.heartbeatAt)
    : Number.POSITIVE_INFINITY;
  const heartbeatFresh =
    input.devicePresent &&
    input.heartbeatAt !== null &&
    Number.isFinite(heartbeatAge) &&
    heartbeatAge >= 0 &&
    heartbeatAge <= heartbeatFreshnessMs;

  if (input.devicePresent && !input.heartbeatAt) unknown.push("HEARTBEAT_MISSING");
  if (input.devicePresent && input.heartbeatAt && !heartbeatFresh) {
    unknown.push("HEARTBEAT_STALE");
  }

  const supportedSchemas = input.capabilities?.manifestSchemaVersions;
  if (!supportedSchemas?.length) {
    unknown.push("MANIFEST_COMPATIBILITY_UNKNOWN");
  } else if (!supportedSchemas.includes(input.release.schemaVersion)) {
    blocked.push("MANIFEST_INCOMPATIBLE");
  }

  let availableBytes: number | null = null;
  let missingBytes: number | null = null;
  if (heartbeatFresh) {
    if (input.storageQuotaBytes === null || input.storageUsedBytes === null) {
      unknown.push("STORAGE_UNKNOWN");
    } else {
      availableBytes = Math.max(0, input.storageQuotaBytes - input.storageUsedBytes);
      const knownChecksums = new Set([
        ...(input.activeReleaseChecksums ?? []),
        ...(input.previousReleaseChecksums ?? [])
      ]);
      missingBytes = input.release.items.reduce(
        (total, item) =>
          total + (knownChecksums.has(item.checksumSha256) ? 0 : item.fileSizeBytes),
        0
      );
      if (missingBytes > availableBytes) {
        blocked.push("STORAGE_INSUFFICIENT");
      } else if (availableBytes - missingBytes < storageSafetyMarginBytes) {
        warnings.push("STORAGE_MARGIN_LOW");
      }
    }
  } else if (input.devicePresent) {
    // Stale or absent telemetry is deliberately never used as storage proof.
    unknown.push("STORAGE_UNKNOWN");
  }

  const reasons = unique([...blocked, ...unknown, ...warnings]);
  const status: ReleasePreflightStatus = blocked.length
    ? "blocked"
    : unknown.length
      ? "unknown"
      : warnings.length
        ? "warning"
        : "ready";

  return { availableBytes, missingBytes, reasons, status };
}

function releaseItemKey(item: ReleaseComparisonItem) {
  return item.sourceItemId ?? `asset:${item.mediaAssetId}:${item.sortOrder}`;
}

function sum(
  items: readonly ReleaseComparisonItem[],
  key: "durationSeconds" | "fileSizeBytes"
) {
  return items.reduce((total, item) => total + item[key], 0);
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}
