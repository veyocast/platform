"use client";

import {
  syncSlideDraftInputSchema,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import { safeParseStudioDocument, type StudioDocument } from "@veyocast/studio";

export type SyncStudioScratch = { rowsText: string; lineupText: string };
export type SyncStudioDraft = {
  presentation: SyncSlidePresentation;
  seconds: string;
  scratch: SyncStudioScratch;
};
export type SyncStudioSaveAttempt = {
  projectId: string;
  expectedRevision: number;
  idempotencyKey: string;
  document: StudioDocument;
};
export type SyncStudioRenderAttempt = {
  projectId: string;
  expectedDraftRevision: number;
  outputKind: "png" | "mp4";
  idempotencyKey: string;
};
export type SyncStudioCopyAttempt = {
  projectId: string;
  document: StudioDocument;
  idempotencyKey: string;
};
export type SyncStudioRestoreAttempt = {
  projectId: string;
  revisionId: string;
  expectedDraftRevision: number;
  idempotencyKey: string;
};
export type SyncStudioRecovery = {
  tenantId: string;
  projectId: string;
  revision: number;
  draft: SyncStudioDraft;
  pendingSave?: SyncStudioSaveAttempt;
  pendingRender?: SyncStudioRenderAttempt;
  pendingCopy?: SyncStudioCopyAttempt;
  pendingRestore?: SyncStudioRestoreAttempt;
  confirmedRead?: { revision: number; document: StudioDocument };
  pendingJob?: string;
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = (tenant: string, project: string) =>
  `veyocast-sync-studio-v1:${tenant}:${project}`;
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Session storage keeps separate browser tabs independent. It never authorises a command. */
export function readSyncStudioRecovery(
  tenantId: string,
  projectId: string,
): SyncStudioRecovery | null {
  const raw = sessionStorage.getItem(key(tenantId, projectId));
  if (!raw) return null;
  if (raw.length > 1500000) throw Error("Local draft exceeds bounds");
  const record = object(JSON.parse(raw)),
    draft = object(record?.draft),
    scratch = object(draft?.scratch);
  if (
    record?.tenantId !== tenantId ||
    record.projectId !== projectId ||
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 0 ||
    typeof draft?.seconds !== "string" ||
    draft.seconds.length > 12 ||
    typeof scratch?.rowsText !== "string" ||
    scratch.rowsText.length > 400000 ||
    typeof scratch.lineupText !== "string" ||
    scratch.lineupText.length > 1000
  )
    return null;
  const parsed = syncSlideDraftInputSchema.safeParse(draft.presentation);
  if (!parsed.success) return null;
  let pendingSave: SyncStudioSaveAttempt | undefined;
  if (record.pendingSave) {
    const pending = object(record.pendingSave),
      document = safeParseStudioDocument(pending?.document);
    if (
      !pending ||
      pending.projectId !== projectId ||
      typeof pending.idempotencyKey !== "string" ||
      !uuid.test(pending.idempotencyKey) ||
      !Number.isSafeInteger(pending.expectedRevision) ||
      Number(pending.expectedRevision) < 0 ||
      !document.success ||
      !document.data.syncPresentation
    )
      throw Error("Local pending command cannot be recovered safely");
    pendingSave = {
      projectId,
      expectedRevision: Number(pending.expectedRevision),
      idempotencyKey: pending.idempotencyKey,
      document: document.data,
    };
  }
  function command(value: unknown) {
    const parsed = object(value);
    if (
      !parsed ||
      parsed.projectId !== projectId ||
      typeof parsed.idempotencyKey !== "string" ||
      !uuid.test(parsed.idempotencyKey)
    )
      throw Error("Local pending command cannot be recovered safely");
    return parsed;
  }
  function revision(value: unknown) {
    if (!Number.isSafeInteger(value) || Number(value) < 0)
      throw Error("Local command revision is invalid");
    return Number(value);
  }
  function document(value: unknown) {
    const parsed = safeParseStudioDocument(value);
    if (!parsed.success || !parsed.data.syncPresentation)
      throw Error("Local command document is invalid");
    return parsed.data;
  }
  let pendingRender: SyncStudioRenderAttempt | undefined,
    pendingCopy: SyncStudioCopyAttempt | undefined,
    pendingRestore: SyncStudioRestoreAttempt | undefined,
    confirmedRead: SyncStudioRecovery["confirmedRead"];
  if (record.pendingRender) {
    const value = command(record.pendingRender);
    if (value.outputKind !== "png" && value.outputKind !== "mp4")
      throw Error("Local output kind is invalid");
    pendingRender = {
      projectId,
      idempotencyKey: String(value.idempotencyKey),
      expectedDraftRevision: revision(value.expectedDraftRevision),
      outputKind: value.outputKind,
    };
  }
  if (record.pendingCopy) {
    const value = command(record.pendingCopy);
    pendingCopy = {
      projectId,
      idempotencyKey: String(value.idempotencyKey),
      document: document(value.document),
    };
  }
  if (record.pendingRestore) {
    const value = command(record.pendingRestore);
    if (typeof value.revisionId !== "string" || !uuid.test(value.revisionId))
      throw Error("Local snapshot identity is invalid");
    pendingRestore = {
      projectId,
      idempotencyKey: String(value.idempotencyKey),
      expectedDraftRevision: revision(value.expectedDraftRevision),
      revisionId: value.revisionId,
    };
  }
  if (record.confirmedRead) {
    const value = object(record.confirmedRead);
    confirmedRead = {
      revision: revision(value?.revision),
      document: document(value?.document),
    };
  }
  if (
    record.pendingJob !== undefined &&
    (typeof record.pendingJob !== "string" || !uuid.test(record.pendingJob))
  )
    throw Error("Local render identity is invalid");
  return {
    tenantId,
    projectId,
    revision: Number(record.revision),
    draft: {
      presentation: parsed.data,
      seconds: draft.seconds,
      scratch: { rowsText: scratch.rowsText, lineupText: scratch.lineupText },
    },
    ...(pendingSave ? { pendingSave } : {}),
    ...(pendingRender ? { pendingRender } : {}),
    ...(pendingCopy ? { pendingCopy } : {}),
    ...(pendingRestore ? { pendingRestore } : {}),
    ...(confirmedRead ? { confirmedRead } : {}),
    ...(record.pendingJob ? { pendingJob: String(record.pendingJob) } : {}),
  };
}

export function writeSyncStudioRecovery(record: SyncStudioRecovery) {
  const raw = JSON.stringify(record);
  if (raw.length > 1500000) throw Error("Local draft exceeds bounds");
  sessionStorage.setItem(key(record.tenantId, record.projectId), raw);
}
export function clearSyncStudioRecovery(tenantId: string, projectId: string) {
  sessionStorage.removeItem(key(tenantId, projectId));
}

export function syncRowsFromText(
  value: string,
): SyncSlidePresentation["rows"] | null {
  const lines = value.split("\n").filter((line) => line.trim());
  if (lines.length > 200) return null;
  const rows = lines.map((line) => line.split("|").map((cell) => cell.trim()));
  if (
    rows.some((row) => row.length > 4 || row.some((cell) => cell.length > 400))
  )
    return null;
  return rows.map((row) => [
    row[0] ?? "",
    row[1] ?? "",
    row[2] ?? "",
    row[3] ?? "",
  ]);
}
export function syncLineupFromText(value: string): number[][] | null {
  const lines = value
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split(",").map((number) => number.trim()));
  if (
    lines.length > 11 ||
    lines.some(
      (line) =>
        line.length > 11 ||
        line.some((number) => !/^\d{1,2}$/.test(number) || Number(number) < 1),
    )
  )
    return null;
  return lines.map((line) => line.map(Number));
}
