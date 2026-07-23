export type ReorderIntent = {
  activeId: string;
  idempotencyKey: string;
  kind: "reorder";
  targetPosition: number;
};

export type UpdateItemIntent = {
  accessibilityName?: string;
  backgroundColor?: string;
  cropFocusX?: number;
  cropFocusY?: number;
  displayTitle?: string;
  durationSeconds: number;
  enabled?: boolean;
  fitMode: "contain" | "cover";
  idempotencyKey: string;
  itemId: string;
  kind: "update_item";
  muted: boolean;
  transition?: "crossfade" | "cut" | "wipe";
  trimEndSeconds?: number | null;
  trimStartSeconds?: number;
  visibleFrom?: string;
  visibleUntil?: string;
  volumePercent?: number;
};

export type UpdatePlaylistIntent = {
  description: string;
  idempotencyKey: string;
  kind: "update_playlist";
  name: string;
};

export type PublisherMutationIntent =
  | ReorderIntent
  | UpdateItemIntent
  | UpdatePlaylistIntent;

export type PublisherRecoveryRecord = {
  createdAt: string;
  intent: PublisherMutationIntent;
  order: string[];
  playlistId: string;
  queued: boolean;
  revision: number;
  tenantId: string;
  version: 1;
};

const storagePrefix = "veyocast:publisher-recovery:v1";
const uuidPattern = /^[0-9a-f-]{36}$/i;
const idempotencyPattern = /^[0-9a-z-]{16,80}$/i;

export function recoveryStorageKey(
  tenantId: string,
  playlistId: string,
  revision: number
) {
  return `${storagePrefix}:${tenantId}:${playlistId}:${revision}`;
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function saveRecovery(
  storage: Pick<Storage, "setItem">,
  record: PublisherRecoveryRecord
) {
  storage.setItem(
    recoveryStorageKey(record.tenantId, record.playlistId, record.revision),
    JSON.stringify(record)
  );
}

export function findRecovery(
  storage: Pick<Storage, "getItem" | "key" | "length">,
  tenantId: string,
  playlistId: string
): PublisherRecoveryRecord | null {
  const prefix = `${storagePrefix}:${tenantId}:${playlistId}:`;
  const candidates: PublisherRecoveryRecord[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const value = storage.getItem(key);
    const parsed = value ? parseRecovery(value) : null;
    if (
      parsed &&
      parsed.tenantId === tenantId &&
      parsed.playlistId === playlistId
    ) {
      candidates.push(parsed);
    }
  }
  return (
    candidates.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0] ?? null
  );
}

export function clearRecoveryFamily(
  storage: Pick<Storage, "key" | "length" | "removeItem">,
  tenantId: string,
  playlistId: string
) {
  const prefix = `${storagePrefix}:${tenantId}:${playlistId}:`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

export function parseRecovery(value: string): PublisherRecoveryRecord | null {
  try {
    const unknownValue: unknown = JSON.parse(value);
    if (!isRecord(unknownValue)) return null;
    const {
      createdAt,
      intent,
      order,
      playlistId,
      queued,
      revision,
      tenantId,
      version
    } = unknownValue;
    if (
      version !== 1 ||
      typeof tenantId !== "string" ||
      typeof playlistId !== "string" ||
      !uuidPattern.test(tenantId) ||
      !uuidPattern.test(playlistId) ||
      !Number.isInteger(revision) ||
      Number(revision) < 0 ||
      typeof queued !== "boolean" ||
      typeof createdAt !== "string" ||
      !Number.isFinite(Date.parse(createdAt)) ||
      !Array.isArray(order) ||
      !order.every((id) => typeof id === "string" && uuidPattern.test(id))
    ) {
      return null;
    }
    const safeIntent = parseIntent(intent);
    if (!safeIntent) return null;
    return {
      createdAt,
      intent: safeIntent,
      order,
      playlistId,
      queued,
      revision: Number(revision),
      tenantId,
      version: 1
    };
  } catch {
    return null;
  }
}

function parseIntent(value: unknown): PublisherMutationIntent | null {
  if (
    !isRecord(value) ||
    typeof value.kind !== "string" ||
    typeof value.idempotencyKey !== "string" ||
    !idempotencyPattern.test(value.idempotencyKey)
  ) {
    return null;
  }
  if (
    value.kind === "reorder" &&
    typeof value.activeId === "string" &&
    uuidPattern.test(value.activeId) &&
    Number.isInteger(value.targetPosition) &&
    Number(value.targetPosition) >= 0
  ) {
    return {
      activeId: value.activeId,
      idempotencyKey: value.idempotencyKey,
      kind: "reorder",
      targetPosition: Number(value.targetPosition)
    };
  }
  if (
    value.kind === "update_item" &&
    typeof value.itemId === "string" &&
    uuidPattern.test(value.itemId) &&
    Number.isInteger(value.durationSeconds) &&
    Number(value.durationSeconds) >= 5 &&
    Number(value.durationSeconds) <= 3600 &&
    (value.fitMode === "contain" || value.fitMode === "cover") &&
    typeof value.muted === "boolean"
  ) {
    return {
      accessibilityName: safeOptionalText(value.accessibilityName, 160),
      backgroundColor: safeOptionalColor(value.backgroundColor),
      cropFocusX: safeOptionalRange(value.cropFocusX, 0, 1),
      cropFocusY: safeOptionalRange(value.cropFocusY, 0, 1),
      displayTitle: safeOptionalText(value.displayTitle, 120),
      durationSeconds: Number(value.durationSeconds),
      enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
      fitMode: value.fitMode,
      idempotencyKey: value.idempotencyKey,
      itemId: value.itemId,
      kind: "update_item",
      muted: value.muted,
      transition: value.transition === "cut" || value.transition === "crossfade" || value.transition === "wipe"
        ? value.transition
        : undefined,
      trimEndSeconds: value.trimEndSeconds === null
        ? null
        : safeOptionalRange(value.trimEndSeconds, 0, 86_400),
      trimStartSeconds: safeOptionalRange(value.trimStartSeconds, 0, 86_400),
      visibleFrom: safeOptionalDate(value.visibleFrom),
      visibleUntil: safeOptionalDate(value.visibleUntil),
      volumePercent: safeOptionalRange(value.volumePercent, 0, 100)
    };
  }
  if (
    value.kind === "update_playlist" &&
    typeof value.name === "string" &&
    value.name.length >= 2 &&
    value.name.length <= 120 &&
    typeof value.description === "string" &&
    value.description.length <= 500
  ) {
    return {
      description: value.description,
      idempotencyKey: value.idempotencyKey,
      kind: "update_playlist",
      name: value.name
    };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeOptionalColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : undefined;
}

function safeOptionalDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : undefined;
}

function safeOptionalRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function safeOptionalText(value: unknown, maximum: number) {
  return typeof value === "string" && value.length <= maximum
    ? value
    : undefined;
}
