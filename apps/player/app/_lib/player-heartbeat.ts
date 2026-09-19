export type PlayerPlaybackErrorInput = {
  action?: string;
  code?: string;
  itemId?: string;
  occurredAt?: string;
  recoveredAt?: string;
} | null | undefined;

export function playbackErrorSyncDetail(value: PlayerPlaybackErrorInput) {
  const error = sanitizePlaybackError(value);
  return {
    lastPlaybackError: error?.recoveredAt ? null : error,
    recoveredPlaybackError: error?.recoveredAt ? error : null
  };
}

export function safePlayerIdentifier(value: string | null | undefined) {
  return value?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || null;
}

function sanitizePlaybackError(value: PlayerPlaybackErrorInput) {
  if (!value) return null;
  return {
    action: safePlayerIdentifier(value.action),
    code: safePlayerIdentifier(value.code),
    itemId: safePlayerIdentifier(value.itemId),
    occurredAt: safeIsoTimestamp(value.occurredAt),
    recoveredAt: safeIsoTimestamp(value.recoveredAt)
  };
}

function safeIsoTimestamp(value: string | null | undefined) {
  if (!value || value.length > 40) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function safeGoalVideoDiagnostics(value: unknown) {
  const codes = new Set(["GOAL_VIDEO_STARTED", "GOAL_VIDEO_COMPLETED", "GOAL_VIDEO_LOAD_ERROR",
    "GOAL_VIDEO_PLAY_REJECTED", "GOAL_VIDEO_START_TIMEOUT", "GOAL_VIDEO_PLAYBACK_ERROR",
    "GOAL_VIDEO_CACHE_TIMEOUT", "GOAL_VIDEO_CACHE_MISSING", "GOAL_VIDEO_ASSET_MISSING", "GOAL_VIDEO_UNSUPPORTED_FORMAT", "GOAL_VIDEO_SOURCE_FALLBACK"]);
  const uuid = (input: unknown) => typeof input === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input) ? input : null;
  return (Array.isArray(value) ? value.slice(-12) : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !codes.has(entry.code) ||
      !uuid(entry.eventId) || !uuid(entry.deliveryId) ||
      (entry.orientation !== "portrait" && entry.orientation !== "landscape")) return [];
    return [{ code: entry.code, eventId: uuid(entry.eventId), deliveryId: uuid(entry.deliveryId),
      alertVersionId: uuid(entry.alertVersionId), assetId: uuid(entry.assetId), orientation: entry.orientation,
      mimeType: entry.mimeType === "video/mp4" || entry.mimeType === "video/webm" ? entry.mimeType : null,
      at: typeof entry.at === "string" ? safeIsoTimestamp(entry.at) : null,
      width: safeVideoDimension(entry.width), height: safeVideoDimension(entry.height),
      source: entry.source === "cache_blob" || entry.source === "https" ? entry.source : null,
      mediaErrorCode: Number.isInteger(entry.mediaErrorCode) && entry.mediaErrorCode >= 1 && entry.mediaErrorCode <= 4 ? entry.mediaErrorCode : null }];
  });
}
function safeVideoDimension(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 16384 ? value : null;
}
export function safeGoalVideoCapabilities(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.runtime !== "react" && input.runtime !== "static-lg") return null;
  const playable = (value: unknown) => value === "probably" || value === "maybe" ? value : "";
  return { runtime: input.runtime,
    appVersion: typeof input.appVersion === "string" && /^(?:[0-9a-f]{40}|development)$/.test(input.appVersion) ? input.appVersion : null,
    browserVersion: typeof input.browserVersion === "string" && /^[0-9.]{1,24}$/.test(input.browserVersion) ? input.browserVersion : null,
    webOS: input.webOS === true, viewportWidth: safeVideoDimension(input.viewportWidth),
    viewportHeight: safeVideoDimension(input.viewportHeight), h264: playable(input.h264),
    webm: playable(input.webm), reducedMotion: input.reducedMotion === true };
}


export function safePublicationTrace(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const revision = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) ? value : null;
  const id = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null;
  if (!revision(input.targetRevision) || !revision(input.configRevision) || !id(input.publicationId) || !id(input.correlationId)) return null;
  const result: Record<string, string | number | null> = {
    targetRevision: revision(input.targetRevision), configRevision: revision(input.configRevision),
    publicationId: id(input.publicationId), releaseId: id(input.releaseId), correlationId: id(input.correlationId),
    generation: Number.isSafeInteger(input.generation) && Number(input.generation) > 0 ? Number(input.generation) : null,
    frameAfterBoundaryMs: typeof input.frameAfterBoundaryMs === "number" && input.frameAfterBoundaryMs >= 0 && input.frameAfterBoundaryMs < 86400000 ? input.frameAfterBoundaryMs : null
  };
  for (const key of ["committedAt", "targetWrittenAt", "signalReceivedAt", "resolvedAt", "assetsReadyAt", "boundaryAt", "firstFrameAt"]) {
    result[key] = typeof input[key] === "string" ? safeIsoTimestamp(input[key]) : null;
  }
  return result;
}
