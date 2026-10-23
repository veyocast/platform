import { describe, expect, it } from "vitest";
import { createSyncStudioStarter } from "@veyocast/studio";
import { syncContentFamilies, syncDynamicConfigurationSchema, type SyncContentFamily } from "@veyocast/contracts";
import { syncConnectedAuthoringType, syncSportlinkAutoContext, type SyncSportlinkOptions } from "../slides/sync-sportlink-binding";
import { buildSyncWizardRequest, chooseSyncWizardTheme, connectedSyncWizardSeed, initialSyncCreateWizardDraft, prepareSyncWizardCommand, readSyncWizardJournal, syncCreateWizardDraftError, syncCreateWizardKey, syncWizardHref, type SyncCreateWizardDraft, type SyncCreateWizardJournal } from "./sync-create-wizard-state";
import { syncThemeCreationStarterDefaults } from "../../../../lib/sync-theme-creation-defaults";
import type { SyncCreateWizardData } from "./sync-create-wizard-types";

const id = (number: number) => `23400000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function data(family: SyncContentFamily = "welcome"): SyncCreateWizardData {
  return { tenantId: id(1), actorScope: `${id(1)}:${id(2)}`, tenantName: "Eigen club", family,
    initialPresentation: createSyncStudioStarter({ family, tenantName: "Eigen club", theme: "onzetrots-tv" }).syncPresentation!,
    canCreateManual: true, canCreateConnected: Boolean(syncConnectedAuthoringType(family)), initialMode: "manual",
    slideType: syncConnectedAuthoringType(family) ?? null,
    sources: [{ id: id(3), name: "Eigen bron", kind: "sportlink", providerStatus: "healthy", lastSuccessfulSyncAt: null, lastErrorCode: null }],
    templates: [{ versionId: id(4), orientation: "landscape", slug: "eigen-template" }, { versionId: id(5), orientation: "portrait", slug: "eigen-template-portret" }], loadError: null,
  };
}
const options: SyncSportlinkOptions = { sourceId: id(3), teams: [{ externalId: "own-team", name: "Eigen team", contexts: [{ label: "Eigen competitie", competitionId: "comp", phaseId: "phase", poolId: "pool", seasonId: "season" }] }], capabilities: [], privacyPeople: true, privacyBirthdays: true };

describe("new-design defaults never rewrite original authoring recovery", () => {
  it("applies only an explicitly chosen profile while preserving all own content and selection", () => {
    const props = data("fixtures"), draft = initialSyncCreateWizardDraft(props);
    props.themeDefaults = { schemaVersion: 1, tenantId: props.tenantId, defaultThemeId: "fieldflow", profiles: [
      { themeId: "fieldflow", themeVersion: "1.0.0", configured: false, revision: 0, defaults: null },
      { themeId: "onzetrots-tv", themeVersion: "11.0.0", configured: true, revision: 7, defaults: { ...syncThemeCreationStarterDefaults("onzetrots-tv"), accent: "#aBc123", font: "Georgia", mode: "dark", scale: 116, background: "stadium", motion: "geen", showLogo: false } },
    ] };
    draft.presentation.name = "Eigen nieuwe titel"; draft.presentation.rows = [["Tijd", "Echt team", "Eigen informatie", "Veld"]]; draft.rowsText = "Eigen ruwe invoer"; draft.seconds = "23";
    const before = JSON.stringify(draft), selected = chooseSyncWizardTheme(props, draft, "onzetrots-tv");
    expect(selected.presentation.style).toMatchObject({ accent: "#aBc123", font: "Serif", fontChanged: true, background: "clubmuur", scale: 116, motion: "geen", showLogo: false });
    expect({ ...selected, presentation: draft.presentation }).toEqual(draft);
    expect(selected.presentation.rendererVersion).toBe('sync-onzetrots-v9');
    expect(selected.presentation.rendererVersion==='sync-onzetrots-v9'&&selected.presentation.visual.mode).toBe('dark');
    expect({...selected.presentation,style:draft.presentation.style,visual:('visual'in draft.presentation?draft.presentation.visual:undefined)}).toEqual(draft.presentation); expect(JSON.stringify(draft)).toBe(before);
    expect(chooseSyncWizardTheme(props, draft, "fieldflow").presentation.style).toMatchObject({ accent: "#006D83", font: "Manrope", background: "light" });
  });
  it.each(["manual", "connected"] as const)("keeps the exact old v1 %s journal/body after new defaults or read failure", mode => {
    const props = data("menu"), draft = initialSyncCreateWizardDraft({ ...props, initialMode: mode }); draft.sourceId = id(3);
    const command = prepareSyncWizardCommand(props, draft, null, id(6)), raw = JSON.stringify(journal(props, draft, command));
    const current = { ...props, initialPresentation: { ...props.initialPresentation, style: { ...props.initialPresentation.style, accent: "#000000" } }, themeDefaultsError: "Read unavailable", sources: [], templates: [] };
    const recovered = readSyncWizardJournal(raw, current)!;
    expect(JSON.stringify(recovered.pending)).toBe(JSON.stringify(command)); expect(recovered.draft).toEqual(draft);
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["actorScope", "draft", "family", "pending", "schemaVersion", "step", "tenantId"]);
    expect(() => prepareSyncWizardCommand(current, recovered.draft, null, id(7))).toThrow("Read unavailable");
    expect(() => chooseSyncWizardTheme(current, recovered.draft, "fieldflow")).toThrow("Read unavailable");
  });
});
function connected(family: SyncContentFamily) {
  const props = data(family), draft = initialSyncCreateWizardDraft({ ...props, initialMode: "connected" });
  draft.sourceId = id(3);
  if (draft.selection.mode === "selected") draft.selection.contexts = [syncSportlinkAutoContext("own-team")];
  return { props, draft };
}
function journal(props: SyncCreateWizardData, draft = initialSyncCreateWizardDraft(props), pending: SyncCreateWizardJournal["pending"] = null): SyncCreateWizardJournal {
  return { schemaVersion: 1, tenantId: props.tenantId, actorScope: props.actorScope, family: props.family, step: 3, draft, pending };
}

describe("all Source families retain truthful direct creation", () => {
  it.each(syncContentFamilies.map(value => value.id))("creates the canonical manual document for %s", family => {
    const props = data(family), draft = initialSyncCreateWizardDraft(props), command = prepareSyncWizardCommand(props, draft, null, id(6));
    expect(command.kind).toBe("manual");
    if (command.kind !== "manual") throw Error("manual");
    expect(command.document.syncPresentation).toEqual(props.initialPresentation);
    expect(command.idempotencyKey).toBe(id(6));
    expect(command).toStrictEqual(JSON.parse(JSON.stringify(command)));
    expect(readSyncWizardJournal(JSON.stringify(journal(props, draft, command)), props)?.pending).toEqual(command);
  });
  it.each(syncContentFamilies.filter(value => syncConnectedAuthoringType(value.id)).map(value => value.id))("creates %s directly with a fact-free canonical source seed", family => {
    const { props, draft } = connected(family), command = prepareSyncWizardCommand(props, draft, options, id(7));
    expect(command.kind).toBe("connected");
    if (command.kind !== "connected" || !("configuration" in command.command.request)) throw Error("connected");
    expect(command).not.toHaveProperty("document");
    expect(command.command).toMatchObject({ action: "create", slideId: null, versionId: null, expectedRevision: 0, idempotencyKey: id(7) });
    expect(command).toStrictEqual(JSON.parse(JSON.stringify(command)));
    const cfg = syncDynamicConfigurationSchema.parse(command.command.request.configuration.syncConfiguration);
    expect(cfg.seed).toMatchObject({ family, rows: [], news: [], ownRowIndexes: [] });
    expect(cfg.seed.home).toBeUndefined(); expect(cfg.seed.away).toBeUndefined(); expect(cfg.seed.match).toBeUndefined();
    expect(readSyncWizardJournal(JSON.stringify(journal(props, draft, command)), props)?.pending).toEqual(command);
  });
  it("removes provider facts and interactive credentials from a connected seed without mutating the manual draft", () => {
    const p = data("scoreboard").initialPresentation;
    p.home = { name: "Handmatig thuis", team: "1" }; p.away = { name: "Handmatig uit", team: "2" }; p.match = { homeScore: "8", awayScore: "5", date: "Vandaag", time: "12:00", clock: "43" }; p.rows = [["A", "B", "C", "D"]]; p.ownRowIndexes = [0];
    const clean = connectedSyncWizardSeed(p);
    expect(clean.rows).toEqual([]); expect(clean.ownRowIndexes).toEqual([]); expect(clean.match).toBeUndefined(); expect(clean.home).toBeUndefined();
    expect(p.rows).toHaveLength(1); expect(p.match.homeScore).toBe("8");
  });
  it("compiles exact real pinned competition and birthday period", () => {
    const { props, draft } = connected("birthdays");
    draft.selection = { mode: "selected", birthdayDays: 21, contexts: [{ providerTeamId: "own-team", competitionSelectionMode: "pinned", competitionId: "comp", phaseId: "phase", poolId: "pool", seasonId: "season" }] };
    const request = buildSyncWizardRequest(props, draft, options);
    expect(request.configuration.context).toEqual(draft.selection.contexts[0]);
    expect(request.configuration.birthday).toMatchObject({ period: { days: 21 }, selection: { selectedTeamIds: ["own-team"] } });
  });
  it.each(["foreign-source", "foreign-team", "foreign-pool", "missing-options", "missing-template", "missing-permission"])("fails closed before source creation: %s", reason => {
    const { props, draft } = connected("standings"); let selectedOptions: SyncSportlinkOptions | null = options;
    if (reason === "foreign-source") draft.sourceId = id(9);
    if (reason === "foreign-team") draft.selection.contexts = [syncSportlinkAutoContext("foreign-team")];
    if (reason === "foreign-pool") draft.selection.contexts = [{ providerTeamId: "own-team", competitionSelectionMode: "pinned", competitionId: "comp", phaseId: "phase", poolId: "foreign", seasonId: "season" }];
    if (reason === "missing-options") selectedOptions = null;
    if (reason === "missing-template") props.templates = [];
    if (reason === "missing-permission") props.canCreateConnected = false;
    expect(() => prepareSyncWizardCommand(props, draft, selectedOptions, id(8))).toThrow();
  });
});

describe("durable exact original command and strict scope", () => {
  it("freezes the first manual body before transport, including nested optional values", () => {
    const props = data(), draft = initialSyncCreateWizardDraft(props);
    draft.presentation.style.backgroundAsset = undefined;
    draft.presentation.club.logo = undefined;
    const first = prepareSyncWizardCommand(props, draft, null, id(6));
    if (first.kind !== "manual") throw Error("manual");
    expect(Object.hasOwn(first.document, "templateId")).toBe(false);
    expect(Object.hasOwn(first.document.syncPresentation!.style, "backgroundAsset")).toBe(false);
    expect(Object.hasOwn(first.document.syncPresentation!.club, "logo")).toBe(false);
    const recovered = readSyncWizardJournal(JSON.stringify(journal(props, draft, first)), props);
    expect(recovered?.pending).toStrictEqual(first);
    expect(first.idempotencyKey).toBe(id(6));
  });
  it("replays the exact frozen request after sources/templates disappear or current defaults change", () => {
    const { props, draft } = connected("menu"), command = prepareSyncWizardCommand(props, draft, null, id(6));
    const raw = JSON.stringify(journal(props, draft, command));
    const changed = { ...props, templates: [], sources: [] };
    const recovered = readSyncWizardJournal(raw, changed);
    expect(JSON.stringify(recovered?.pending)).toBe(JSON.stringify(command));
  });
  it.each(["actor", "tenant", "family", "missing-scope", "extra-journal", "extra-draft", "extra-selection", "extra-command", "missing-pending", "changed-source", "changed-seed", "changed-selection", "invalid-nonce", "publish-command"])("rejects a changed or malformed journal: %s", reason => {
    const { props, draft } = connected("standings"), command = prepareSyncWizardCommand(props, draft, options, id(6));
    const value = JSON.parse(JSON.stringify(journal(props, draft, command)));
    if (reason === "actor") value.actorScope = `${props.tenantId}:${id(9)}`;
    if (reason === "tenant") value.tenantId = id(9);
    if (reason === "family") value.family = "menu";
    if (reason === "missing-scope") delete value.actorScope;
    if (reason === "extra-journal") value.extra = true;
    if (reason === "extra-draft") value.draft.signedUrl = "https://private.invalid/token";
    if (reason === "extra-selection") value.draft.selection.extra = true;
    if (reason === "extra-command") value.pending.extra = true;
    if (reason === "missing-pending") delete value.pending;
    if (reason === "changed-source") value.pending.command.request.dataSourceId = id(9);
    if (reason === "changed-seed") value.pending.command.request.configuration.syncConfiguration.seed.title = "Changed";
    if (reason === "changed-selection") value.pending.command.request.configuration.teamSelection = { mode: "selected", teamContexts: [syncSportlinkAutoContext("other-team")] };
    if (reason === "invalid-nonce") value.pending.command.idempotencyKey = "new";
    if (reason === "publish-command") value.pending.command.action = "publish";
    expect(() => readSyncWizardJournal(JSON.stringify(value), props)).toThrow();
  });
  it("isolates keys for actor, tenant and family", () => {
    const props = data(); const keys = [props, { ...props, actorScope: `${id(1)}:${id(9)}` }, { ...props, tenantId: id(9) }, { ...props, family: "menu" as const }].map(syncCreateWizardKey);
    expect(new Set(keys).size).toBe(4);
  });
  it("keeps invalid row scratch for repair without replacing the last complete rows", () => {
    const props = data("menu"), draft = initialSyncCreateWizardDraft(props);
    draft.rowsText = "A | B | C | D | unexpected";
    expect(syncCreateWizardDraftError(draft)).toContain("regels");
    const recovered = readSyncWizardJournal(JSON.stringify(journal(props, draft)), props);
    expect(recovered?.draft.rowsText).toBe(draft.rowsText); expect(recovered?.draft.presentation.rows).toEqual([]);
    expect(() => prepareSyncWizardCommand(props, draft, null, id(6))).toThrow();
  });
  it.each(["", "2", "121", "3.5", "1e2", "NaN"])("does not silently normalize invalid duration %s", seconds => {
    const props = data(), draft = { ...initialSyncCreateWizardDraft(props), seconds };
    expect(syncCreateWizardDraftError(draft)).toContain("duur");
    expect(() => prepareSyncWizardCommand(props, draft, null, id(6))).toThrow();
  });
  it("bounds the total manual duration without clipping content", () => {
    const props = data("menu"), draft = initialSyncCreateWizardDraft(props);
    draft.presentation.rows = Array.from({ length: 81 }, () => ["A", "B", "C", "D"]); draft.presentation.rowsPerPage = 1; draft.seconds = "14";
    expect(syncCreateWizardDraftError(draft)).toContain("120 seconden"); expect(draft.presentation.rows).toHaveLength(81);
  });
  it("rejects oversized unicode journals in bytes and preserves null as no saved draft", () => {
    expect(readSyncWizardJournal(null, data())).toBeNull();
    expect(() => readSyncWizardJournal("€".repeat(240_000), data())).toThrow("Oversized");
  });
  it("stores tenant image identity/hash without an expiring preview URL", () => {
    const props = data(), draft: SyncCreateWizardDraft = initialSyncCreateWizardDraft(props);
    draft.presentation.style.background = "photo"; draft.presentation.style.backgroundAsset = { kind: "tenant", mediaAssetId: id(20), checksumSha256: "a".repeat(64) };
    props.images = [{ id: id(20), title: "Eigen foto", checksumSha256: "a".repeat(64), url: "https://private.invalid/signed-temporary" }];
    const command = prepareSyncWizardCommand(props, draft, null, id(6)), raw = JSON.stringify(journal(props, draft, command));
    expect(raw).not.toContain("https:"); expect(raw).not.toContain("signed-temporary");
    expect(readSyncWizardJournal(raw, props)?.pending).toEqual(command);
  });
  it.each(["https://other.invalid/", "//other.invalid/", "/dashboard/studio/new", "/dashboard/slides/../settings", `/dashboard/studio/${id(8)}?token=x`])("rejects an unconfirmed navigation target %s", value => expect(syncWizardHref(value)).toBe(false));
  it("accepts only confirmed internal design destinations", () => { expect(syncWizardHref(`/dashboard/studio/${id(8)}`)).toBe(true); expect(syncWizardHref(`/dashboard/slides/${id(8)}`)).toBe(true); });
});
