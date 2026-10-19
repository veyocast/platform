import { mediaFrameExpectedSourcesSchema, type MediaFrameCommand } from "@veyocast/contracts";
import { parseMediaFrameSeriesCommand } from "./media-frame-series-contract";
import { parseMediaFrameJournal, prepareMediaFrameSave, validatedMediaFrameDraft, type MediaFrameJournal, type MediaFrameJournalScope } from "./media-frame-presentation";
import type { MediaFramePendingV2, MediaSeriesDraftV2, MediaSeriesMembershipDTO } from "./media-frame-series-types";

export type ConfirmedMediaFrameDestination = { frameId: string; contentKey: string; href: string; name: string };
export type MediaFrameSeriesJournal = Omit<MediaFrameJournal, "schemaVersion" | "pending"> & {
  schemaVersion: 2;
  seriesDraft: MediaSeriesDraftV2;
  pending: MediaFramePendingV2 | null;
  confirmedAppend: ConfirmedMediaFrameDestination | null;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export const mediaSeriesDraft = (membership: MediaSeriesMembershipDTO | null): MediaSeriesDraftV2 => ({ seriesId: membership?.seriesId ?? null, baseRevision: membership?.seriesRevision ?? null, seriesTitle: membership?.seriesTitle ?? "", dirty: false });
export const upgradeMediaFrameJournal = (journal: MediaFrameJournal, membership: MediaSeriesMembershipDTO | null): MediaFrameSeriesJournal => ({ ...journal, schemaVersion: 2, pending: journal.pending ? { kind: "frame", command: journal.pending } : null, seriesDraft: mediaSeriesDraft(membership), confirmedAppend: null });
export const validMediaSeriesTitle = (value: string) => value.length <= 120;

/** The old storage key and exact v1 command remain valid; no migration POST occurs. */
export function parseMediaFrameSeriesJournal(raw: string, scope: MediaFrameJournalScope, membership: MediaSeriesMembershipDTO | null): MediaFrameSeriesJournal | null {
  if (raw.length > 150_000) throw Error("Media-ontwerp is te groot voor veilig herstel.");
  const value: unknown = JSON.parse(raw);
  if (!object(value)) throw Error("Herstelgegevens zijn niet geldig.");
  if (value.schemaVersion === 1) {
    const legacy = parseMediaFrameJournal(raw, scope);
    return legacy ? upgradeMediaFrameJournal(legacy, membership) : null;
  }
  if (value.schemaVersion !== 2) throw Error("Deze herstelversie kan niet veilig worden geopend.");
  if (value.actorScope !== scope.actorScope || value.tenantId !== scope.tenantId || value.identity !== scope.identity || value.assetId !== scope.assetId) return null;
  const pending = value.pending;
  if (pending !== null && (!object(pending) || !["frame", "series"].includes(String(pending.kind)) || Object.keys(pending).some(key => !["kind", "command"].includes(key)))) throw Error("De oorspronkelijke opdracht is niet geldig.");
  const base = parseMediaFrameJournal(JSON.stringify({ ...value, schemaVersion: 1, pending: object(pending) && pending.kind === "frame" ? pending.command : null }), scope);
  if (!base) return null;
  const draft = value.seriesDraft;
  if (!object(draft) || Object.keys(draft).some(key => !["seriesId", "baseRevision", "seriesTitle", "dirty"].includes(key)) || typeof draft.seriesTitle !== "string" || !validMediaSeriesTitle(draft.seriesTitle) || typeof draft.dirty !== "boolean" || !(draft.seriesId === null && draft.baseRevision === null || typeof draft.seriesId === "string" && uuid.test(draft.seriesId) && Number.isSafeInteger(draft.baseRevision) && Number(draft.baseRevision) > 0)) throw Error("De lokale reeksinvoer is niet veilig te herstellen.");
  let restoredPending: MediaFramePendingV2 | null = base.pending ? { kind: "frame", command: base.pending } : null;
  if (object(pending) && pending.kind === "series") {
    const command = parseMediaFrameSeriesCommand(pending.command);
    if (!command || command.tenantId !== scope.tenantId || command.frameId !== base.frameId || command.sourceAssetId !== scope.assetId || command.expectedFrameRevision !== base.revision || command.seriesId !== draft.seriesId || command.expectedSeriesRevision !== draft.baseRevision) throw Error("De oorspronkelijke reeksopdracht hoort niet bij dit ontwerp.");
    restoredPending = { kind: "series", command };
  }
  const destination = value.confirmedAppend;
  if (destination !== null && (!object(destination) || Object.keys(destination).some(key => !["frameId", "contentKey", "href", "name"].includes(key)) || typeof destination.frameId !== "string" || !uuid.test(destination.frameId) || destination.contentKey !== `media-frame:${destination.frameId}` || destination.href !== `/dashboard/content/media/${destination.frameId}` || typeof destination.name !== "string" || destination.name.length > 120)) throw Error("De bevestigde vervolgstap is niet veilig te herstellen.");
  return { ...base, schemaVersion: 2, dirty: base.dirty || draft.dirty, seriesDraft: draft as MediaSeriesDraftV2, pending: restoredPending, confirmedAppend: destination as ConfirmedMediaFrameDestination | null };
}

/** A clean newer server read can refresh data; local CAS baselines never drift. */
export function reconcileMediaFrameSeriesJournal(current: MediaFrameSeriesJournal, fresh: MediaFrameSeriesJournal) {
  const frameAdvanced = fresh.revision > current.revision;
  const seriesAdvanced = fresh.seriesDraft.seriesId !== null && (fresh.seriesDraft.seriesId !== current.seriesDraft.seriesId || (fresh.seriesDraft.baseRevision ?? 0) > (current.seriesDraft.baseRevision ?? 0));
  if (current.pending || !(frameAdvanced || seriesAdvanced)) return { journal: current, conflict: false };
  if (current.dirty || current.seriesDraft.dirty) return { journal: current, conflict: true };
  return { journal: { ...fresh, confirmedAppend: current.confirmedAppend }, conflict: false };
}

export function prepareMediaFrameSeriesSave(journal: MediaFrameSeriesJournal, nonce: string, maximumSeconds = 3600, appendFrameId?: string): MediaFramePendingV2 {
  if (journal.pending) return journal.pending;
  if (!validMediaSeriesTitle(journal.seriesDraft.seriesTitle)) throw Error("Gebruik maximaal 120 tekens voor de reeksnaam. Je invoer blijft behouden.");
  const settings = validatedMediaFrameDraft(journal.draft, maximumSeconds);
  if (!settings.success) throw Error(`Controleer de ontwerpnaam en een gehele duur van 3 tot ${maximumSeconds} seconden. Je invoer blijft behouden.`);
  if (!appendFrameId && !journal.seriesDraft.seriesId && !journal.seriesDraft.seriesTitle.trim()) {
    const legacy: MediaFrameJournal = { ...journal, schemaVersion: 1, pending: null };
    return { kind: "frame", command: prepareMediaFrameSave(legacy, nonce, maximumSeconds) as MediaFrameCommand };
  }
  const command = parseMediaFrameSeriesCommand({ kind: "media-series", operation: appendFrameId ? "append" : "save", tenantId: journal.tenantId, frameId: journal.frameId, sourceAssetId: journal.assetId, expectedFrameRevision: journal.revision, settings: settings.data, expectedSources: mediaFrameExpectedSourcesSchema.parse(journal.sources), seriesId: journal.seriesDraft.seriesId, expectedSeriesRevision: journal.seriesDraft.baseRevision, seriesTitle: journal.seriesDraft.seriesTitle, idempotencyKey: nonce, ...(appendFrameId ? { newFrameId: appendFrameId } : {}) });
  if (!command) throw Error("De reeksopdracht kan niet veilig worden voorbereid. Je invoer blijft behouden; controleer het ontwerp en probeer opnieuw.");
  return { kind: "series", command };
}
