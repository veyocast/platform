import {
  sportlinkSlideContextSchema,
  syncDynamicCommandSchema,
  syncDynamicConfigurationSchema,
  syncSlidePageCount,
  syncSlideMinimumDurationMs,
  syncSlidePresentationSchema,
  type SyncDynamicRequest,
  type SyncSlidePresentation,
  type SportlinkSlideContext,
} from "@veyocast/contracts";
import { createSyncStudioDocument, safeParseStudioDocument } from "@veyocast/studio";
import {
  compileSyncSportlinkBinding,
  isSyncSportlinkType,
  readSyncSportlinkSelection,
  syncSportlinkSelectionPolicy,
  type SyncSportlinkOptions,
} from "../slides/sync-sportlink-binding";
import { syncLineupFromText, syncRowsFromText } from "./sync-studio-recovery";
import type { SyncCreateWizardCommand, SyncCreateWizardData } from "./sync-create-wizard-types";
import { applySyncThemeCreationDefaults, syncThemeCreationStarterDefaults } from "../../../../lib/sync-theme-creation-defaults";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
export type SyncCreateWizardDraft = {
  mode: "manual" | "connected";
  presentation: SyncSlidePresentation;
  seconds: string;
  sourceId: string;
  selection: { mode: "all" | "selected"; contexts: SportlinkSlideContext[]; birthdayDays: 7 | 14 | 21 };
  rowsText: string;
  lineupText: string;
};
export type SyncCreateWizardScope = Pick<SyncCreateWizardData, "tenantId" | "actorScope" | "family">;
export type SyncCreateWizardJournal = SyncCreateWizardScope & {
  schemaVersion: 1;
  step: number;
  draft: SyncCreateWizardDraft;
  pending: SyncCreateWizardCommand | null;
};

export const syncWizardRowFamilies = new Set([
  "fixtures", "results", "period-standings", "cancellations", "dressing-rooms", "officials",
  "team-info", "activities", "training", "volunteers", "visitors", "club-program", "team-program",
  "pool-program", "club-results", "team-results", "pool-results", "standings", "team-arrivals",
  "referees", "changing-rooms", "birthdays", "menu", "sponsors", "agenda",
]);

export function syncCreateWizardKey(scope: SyncCreateWizardScope) {
  return `veyocast.sync.create-wizard.v1:${scope.tenantId}:${scope.actorScope}:${scope.family}`;
}

export function initialSyncCreateWizardDraft(data: SyncCreateWizardData): SyncCreateWizardDraft {
  const checkedCfg = data.slideType ? syncDynamicConfigurationSchema.safeParse({
    schemaVersion: 1, kind: "dynamic", rendererVersion: data.initialPresentation.rendererVersion,
    sourceRevision: data.initialPresentation.sourceRevision, slideType: data.slideType,
    secondsPerPage: 5, seed: connectedSyncWizardSeed(data.initialPresentation),
  }) : null;
  const cfg=checkedCfg?.success?checkedCfg.data:null;
  return {
    mode: data.initialMode,
    presentation: data.initialPresentation,
    seconds: "5",
    sourceId: "",
    selection: { mode: cfg && isSyncSportlinkType(cfg.slideType) && syncSportlinkSelectionPolicy(cfg).required ? "selected" : "all", contexts: [], birthdayDays: 7 },
    rowsText: data.initialPresentation.rows.map(row => row.join(" | ")).join("\n"),
    lineupText: data.initialPresentation.lineup.map(line => line.join(", ")).join("\n"),
  };
}

/** Explicit user choice only. Recovery never calls this projector. */
export function chooseSyncWizardTheme(data: SyncCreateWizardData, draft: SyncCreateWizardDraft, themeId: SyncSlidePresentation["theme"]): SyncCreateWizardDraft {
  if (data.themeDefaultsError) throw Error(data.themeDefaultsError);
  const profile = data.themeDefaults?.profiles.find(value => value.themeId === themeId);
  return { ...draft, presentation: applySyncThemeCreationDefaults(draft.presentation, themeId, profile?.defaults ?? syncThemeCreationStarterDefaults(themeId)) };
}

export function connectedSyncWizardSeed(presentation: SyncSlidePresentation): SyncSlidePresentation {
  return syncSlidePresentationSchema.parse({ ...presentation, rows: [], news: [], ownRowIndexes: [],
    home: undefined, away: undefined, match: undefined, poll: undefined, youtubeUrl: undefined, ...(presentation.rendererVersion==='sync-onzetrots-v1'?{rich:undefined}:{}), state: "ready" });
}

export function syncCreateWizardDraftError(draft: SyncCreateWizardDraft): string | null {
  if (!draft.presentation.name.trim() || draft.presentation.name.trim().length < 2 || draft.presentation.name.length > 120)
    return "Geef je ontwerp een naam van 2 tot 120 tekens.";
  if (!/^\d+$/.test(draft.seconds) || Number(draft.seconds) < 3 || Number(draft.seconds) > 120)
    return "Kies een gehele duur van 3 tot 120 seconden per pagina.";
  if (draft.mode === "manual") {
    if (syncWizardRowFamilies.has(draft.presentation.family) && syncRowsFromText(draft.rowsText) === null)
      return "Controleer je regels. Gebruik maximaal vier kolommen met | ertussen; je invoer blijft behouden.";
    if (draft.presentation.family === "lineup" && syncLineupFromText(draft.lineupText) === null)
      return "Controleer de opstelling. Gebruik rugnummers van 1 tot 99, met komma’s tussen de nummers.";
    if (Math.max(syncSlidePageCount(draft.presentation) * Number(draft.seconds)*1000,syncSlideMinimumDurationMs(draft.presentation)) > 120000)
      return "Je ontwerp duurt samen langer dan 120 seconden. Verdeel de inhoud of verkort de duur per pagina.";
  }
  return null;
}

export function buildSyncWizardRequest(data: SyncCreateWizardData, draft: SyncCreateWizardDraft, options: SyncSportlinkOptions | null): SyncDynamicRequest {
  if (!data.canCreateConnected || !data.slideType || draft.mode !== "connected") throw Error("Je kunt nu geen gekoppeld ontwerp maken. Kies handmatig of controleer je rechten.");
  const error = syncCreateWizardDraftError(draft);
  if (error) throw Error(error);
  if (!data.sources.some(source => source.id === draft.sourceId)) throw Error("Kies een beschikbare bron van je vereniging.");
  const template = data.templates.find(template => template.orientation === draft.presentation.orientation);
  if (!template) throw Error("Dit schermformaat is nog niet beschikbaar voor deze bron. Kies een ander formaat.");
  const cfg = syncDynamicConfigurationSchema.parse({ schemaVersion: 1, kind: "dynamic", rendererVersion: draft.presentation.rendererVersion,
    sourceRevision: draft.presentation.sourceRevision, slideType: data.slideType,
    secondsPerPage: Number(draft.seconds), seed: connectedSyncWizardSeed(draft.presentation) });
  let configuration: Record<string, unknown> = { maxItems: 200, syncConfiguration: cfg };
  if (isSyncSportlinkType(cfg.slideType)) {
    if (!options || options.sourceId !== draft.sourceId) throw Error("De teams en bronrechten zijn nog niet bevestigd. Wacht op de broncontrole of probeer opnieuw.");
    configuration = compileSyncSportlinkBinding(cfg, configuration, draft.selection, options.teams);
  } else if (cfg.slideType === "ledscores_live_match") {
    configuration.liveMatch = { template: "scoreboard", showClock: true, showTimeline: false, timelineLimit: 0, outsideMatchBehavior: "last_known", staleBehavior: "freeze" };
  }
  return { templateVersionId: template.versionId, dataSourceId: draft.sourceId, configuration };
}

export function prepareSyncWizardCommand(data: SyncCreateWizardData, draft: SyncCreateWizardDraft, options: SyncSportlinkOptions | null, idempotencyKey: string): SyncCreateWizardCommand {
  if (data.themeDefaultsError) throw Error(data.themeDefaultsError);
  if (!uuid.test(idempotencyKey)) throw Error("Invalid command nonce");
  if (draft.presentation.family !== data.family) throw Error("Deze keuze hoort bij een ander ontwerp. Open de juiste familie opnieuw.");
  const error = syncCreateWizardDraftError(draft);
  if (error) throw Error(error);
  if (draft.mode === "connected") return jsonStoredCommand({ kind: "connected", command: {
    action: "create", slideId: null, versionId: null, expectedRevision: 0, idempotencyKey,
    request: buildSyncWizardRequest(data, draft, options),
  } }, draft);
  if (!data.canCreateManual) throw Error("Je hebt nu geen rechten om een handmatig ontwerp te maken.");
  return jsonStoredCommand({ kind: "manual", document: createSyncStudioDocument(draft.presentation, Number(draft.seconds)), idempotencyKey }, draft);
}

/** Next's action transport preserves explicit undefined properties; JSON
 * recovery does not. Freeze the JSON-storable body before either is used. */
function jsonStoredCommand(command: SyncCreateWizardCommand, draft: SyncCreateWizardDraft): SyncCreateWizardCommand {
  return validatePending(JSON.parse(JSON.stringify(command)), draft);
}

/** Validate recovered commands without rebuilding them from possibly changed
 * source/template availability. The original body and nonce remain authority. */
function validatePending(command: unknown, draft: SyncCreateWizardDraft): SyncCreateWizardCommand {
  if (!command || typeof command !== "object" || Array.isArray(command)) throw Error("Invalid command");
  const value = command as Record<string, unknown>;
  if (value.kind === "manual" && draft.mode === "manual") {
    if (Object.keys(value).some(key => !["kind", "document", "idempotencyKey"].includes(key))) throw Error("Invalid command fields");
    const parsed = safeParseStudioDocument(value.document);
    if (typeof value.idempotencyKey !== "string" || !uuid.test(value.idempotencyKey)) throw Error("Invalid command nonce");
    if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(createSyncStudioDocument(draft.presentation, Number(draft.seconds)))) throw Error("Changed manual command");
    return command as SyncCreateWizardCommand;
  }
  if (value.kind === "connected" && draft.mode === "connected") {
    if (Object.keys(value).some(key => !["kind", "command"].includes(key))) throw Error("Invalid command fields");
    const parsed = syncDynamicCommandSchema.parse(value.command);
    if (parsed.action !== "create" || parsed.slideId || parsed.versionId || parsed.expectedRevision !== 0 || !("configuration" in parsed.request)) throw Error("Invalid create command");
    const cfg = syncDynamicConfigurationSchema.parse(parsed.request.configuration.syncConfiguration);
    if (parsed.request.dataSourceId !== draft.sourceId || cfg.secondsPerPage !== Number(draft.seconds)
      || JSON.stringify(cfg.seed) !== JSON.stringify(connectedSyncWizardSeed(draft.presentation))) throw Error("Changed source command");
    if (isSyncSportlinkType(cfg.slideType)) {
      const selection = readSyncSportlinkSelection(cfg, parsed.request.configuration);
      const expected = { ...draft.selection, contexts: draft.selection.mode === "all" ? [] : draft.selection.contexts };
      if (selection.mode !== expected.mode || selection.birthdayDays !== expected.birthdayDays
        || JSON.stringify(selection.contexts.map(context => sportlinkSlideContextSchema.parse(context))) !== JSON.stringify(expected.contexts.map(context => sportlinkSlideContextSchema.parse(context)))) throw Error("Changed team selection");
    }
    return command as SyncCreateWizardCommand;
  }
  throw Error("Changed command mode");
}

export function readSyncWizardJournal(raw: string | null, scope: SyncCreateWizardScope): SyncCreateWizardJournal | null {
  if (raw === null) return null;
  if (new TextEncoder().encode(raw).byteLength > 700_000) throw Error("Oversized journal");
  const value: unknown = JSON.parse(raw);
  if (!record(value) || !exactKeys(value, ["schemaVersion", "tenantId", "actorScope", "family", "step", "draft", "pending"])
    || value.schemaVersion !== 1 || value.tenantId !== scope.tenantId || !uuid.test(scope.tenantId)
    || value.actorScope !== scope.actorScope || typeof value.actorScope !== "string" || value.actorScope.length > 200
    || value.family !== scope.family || !Number.isInteger(value.step) || Number(value.step) < 0 || Number(value.step) > 3) throw Error("Different journal scope");
  const draft = value.draft;
  if (!record(draft) || !exactKeys(draft, ["mode", "presentation", "seconds", "sourceId", "selection", "rowsText", "lineupText"])
    || !["manual", "connected"].includes(String(draft.mode)) || typeof draft.seconds !== "string" || draft.seconds.length > 8
    || typeof draft.sourceId !== "string" || draft.sourceId !== "" && !uuid.test(draft.sourceId)
    || typeof draft.rowsText !== "string" || draft.rowsText.length > 400_000
    || typeof draft.lineupText !== "string" || draft.lineupText.length > 4_000) throw Error("Invalid draft");
  const presentation = syncSlidePresentationSchema.safeParse(draft.presentation), selection = draft.selection;
  if (!presentation.success || presentation.data.family !== scope.family || !record(selection)
    || !exactKeys(selection, ["mode", "contexts", "birthdayDays"]) || !["all", "selected"].includes(String(selection.mode))
    || ![7, 14, 21].includes(Number(selection.birthdayDays)) || typeof selection.birthdayDays !== "number"
    || !Array.isArray(selection.contexts) || selection.contexts.length > 500
    || selection.contexts.some(context => !sportlinkSlideContextSchema.safeParse(context).success)) throw Error("Invalid selection");
  const parsedDraft = draft as SyncCreateWizardDraft;
  const pending = value.pending === null ? null : validatePending(value.pending, parsedDraft);
  return { schemaVersion: 1, ...scope, step: Number(value.step), draft: parsedDraft, pending };
}

export function syncWizardHref(value: string) {
  return /^\/dashboard\/(studio|slides)\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}
