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
