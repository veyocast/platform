import {
  mediaFrameCommandSchema,
  mediaFrameExpectedSourcesSchema,
  mediaFrameSettingsSchema,
  syncSlidePresentationSchema,
  syncSlideRendererVersion,
  syncSlideSourceRevision,
  type MediaFrameCommand,
  type MediaFrameExpectedSource,
  type MediaFrameSettings,
} from "@veyocast/contracts";
import type { MediaFrameSource } from "./media-frame-types";

export type MediaFrameDraft = { settings: MediaFrameSettings; seconds: string };
export type MediaFrameJournalScope = { actorScope: string; tenantId: string; identity: string; assetId: string };
export type MediaFrameJournal = MediaFrameJournalScope & {
  schemaVersion: 1;
  frameId: string;
  revision: number;
  draft: MediaFrameDraft;
  sources: MediaFrameExpectedSource[];
  dirty: boolean;
  pending: MediaFrameCommand | null;
};

export const mediaFrameJournalKey = (scope: MediaFrameJournalScope) =>
  `veyocast-media-frame-v1:${encodeURIComponent(scope.actorScope)}:${scope.tenantId}:${scope.identity}`;
export const sameMediaFrameSource = (a: MediaFrameExpectedSource, b: MediaFrameExpectedSource) =>
  a.role === b.role && a.mediaAssetId === b.mediaAssetId && a.variantId === b.variantId && a.checksumSha256 === b.checksumSha256 && a.byteSize === b.byteSize;

/** Transient name/duration input is retained; save validation never coerces or clips it. */
export function validatedMediaFrameDraft(draft: MediaFrameDraft, maximumSeconds = 3600) {
  const seconds = /^\d+$/.test(draft.seconds) ? Number(draft.seconds) : NaN;
  return mediaFrameSettingsSchema.refine(value => value.durationSeconds <= maximumSeconds, { path: ["durationSeconds"], message: `De geverifieerde bron ondersteunt maximaal ${maximumSeconds} seconden.` }).safeParse({ ...draft.settings, durationSeconds: seconds });
}

/** The adapter supplies form chrome only; it is never a stored/rendered Studio document. */
export function mediaFrameChrome(settings: MediaFrameSettings) {
  return syncSlidePresentationSchema.parse({
    schemaVersion: 1, rendererVersion: syncSlideRendererVersion, sourceRevision: syncSlideSourceRevision,
    family: "free", name: settings.name, orientation: settings.orientation, theme: settings.appearance.themeId,
    club: { name: "", tagline: "" }, title: "", style: { accent: settings.appearance.accentColor, showLogo: false, showFooter: false, motion: settings.sourceMetadata.motion },
  });
}

export function sourcesForMediaFrame(settings: MediaFrameSettings, main: MediaFrameSource, images: MediaFrameSource[]) {
  const media = { ...main.expectedSource, role: "media" as const };
  const background = settings.appearance.background;
  if (background.kind === "preset") return [media];
  const image = images.find(source => source.mediaAssetId === background.mediaAssetId && source.kind === "image");
  return image ? [media, { ...image.expectedSource, role: "background" as const }] : null;
}

export function mediaFrameSourcesAvailable(sources: MediaFrameExpectedSource[], available: MediaFrameSource[]) {
  return sources.every(expected => available.some(source => sameMediaFrameSource(expected, { ...source.expectedSource, role: expected.role })));
}

/** Durable data contains fingerprints and commands, never ephemeral signed URLs. */
export function parseMediaFrameJournal(raw: string, scope: MediaFrameJournalScope): MediaFrameJournal | null {
  if (raw.length > 100_000) throw Error("Media-ontwerp is te groot voor veilig herstel.");
  const value = JSON.parse(raw) as MediaFrameJournal;
  if (!value || value.schemaVersion !== 1 || value.actorScope !== scope.actorScope || value.tenantId !== scope.tenantId || value.identity !== scope.identity || value.assetId !== scope.assetId) return null;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.frameId) || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.dirty !== "boolean") throw Error("Herstelgegevens zijn niet geldig.");
  if (scope.identity.startsWith("frame:") && value.frameId !== scope.identity.slice(6)) throw Error("De lokale opdracht hoort bij een ander media-ontwerp.");
  if (!value.draft || typeof value.draft.settings?.name !== "string" || value.draft.settings.name.length > 120 || typeof value.draft.seconds !== "string" || value.draft.seconds.length > 12 || !mediaFrameSettingsSchema.safeParse({ ...value.draft.settings, name: "Herstel" }).success) throw Error("De lokale invoer is niet veilig te herstellen.");
  const sources = mediaFrameExpectedSourcesSchema.parse(value.sources);
  if (sources.find(source => source.role === "media")?.mediaAssetId !== scope.assetId) throw Error("De bron hoort niet bij dit ontwerp.");
  const pending = value.pending ? mediaFrameCommandSchema.parse(value.pending) : null;
  if (pending && (pending.tenantId !== scope.tenantId || pending.frameId !== value.frameId || !["create", "save"].includes(pending.operation))) throw Error("De oorspronkelijke opdracht hoort niet bij dit ontwerp.");
  if (pending && (pending.operation === "create" || pending.operation === "save") && pending.expectedSources.find(source => source.role === "media")?.mediaAssetId !== scope.assetId) throw Error("De oorspronkelijke opdracht verwijst naar een ander bestand.");
  return { ...scope, schemaVersion: 1, frameId: value.frameId, revision: value.revision, draft: { settings: value.draft.settings, seconds: value.draft.seconds }, sources, dirty: value.dirty, pending };
}

export function prepareMediaFrameSave(journal: MediaFrameJournal, nonce: string, maximumSeconds = 3600): MediaFrameCommand {
  if (journal.pending) return journal.pending;
  const settings = validatedMediaFrameDraft(journal.draft, maximumSeconds);
  if (!settings.success) throw Error(`Controleer de ontwerpnaam en een gehele duur van 3 tot ${maximumSeconds} seconden. Je invoer blijft behouden.`);
  const common = { tenantId: journal.tenantId, frameId: journal.frameId, idempotencyKey: nonce, expectedSources: journal.sources, settings: settings.data };
  return mediaFrameCommandSchema.parse(journal.revision === 0 ? { ...common, operation: "create", expectedRevision: 0, sourceAssetId: journal.assetId } : { ...common, operation: "save", expectedRevision: journal.revision });
}
