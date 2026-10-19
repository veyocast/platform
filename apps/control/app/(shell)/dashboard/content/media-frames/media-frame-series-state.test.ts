import { describe, expect, it } from "vitest";
import type { MediaFrameSettings } from "@veyocast/contracts";
import { prepareMediaFrameSave, type MediaFrameJournal } from "./media-frame-presentation";
import { mediaSeriesDraft, parseMediaFrameSeriesJournal, prepareMediaFrameSeriesSave, reconcileMediaFrameSeriesJournal, upgradeMediaFrameJournal, validMediaSeriesTitle } from "./media-frame-series-state";

const tenant = "10000000-0000-4000-8000-000000000001", asset = "20000000-0000-4000-8000-000000000001", frame = "30000000-0000-4000-8000-000000000001", nonce = "40000000-0000-4000-8000-000000000001", nextFrame = "30000000-0000-4000-8000-000000000002", series = "60000000-0000-4000-8000-000000000001";
const scope = { actorScope: `${tenant}:actor-a`, tenantId: tenant, identity: `source:${asset}`, assetId: asset };
const settings: MediaFrameSettings = { schemaVersion: 1, name: "Eigen ontwerp", orientation: "portrait", durationSeconds: 901, fitMode: "contain", focus: "right", appearance: { themeId: "onzetrots-tv", accentColor: "#123456", background: { kind: "preset", preset: "light" } }, sourceMetadata: { title: "Metadata", headline: "", subtitle: "", body: "Geen overlay", footer: "", font: "Arial", scale: 150, alignment: "right", safeMargin: 12, showLogo: true, showFooter: true, motion: "geen" } };
const legacy = (): MediaFrameJournal => ({ ...scope, schemaVersion: 1, frameId: frame, revision: 0, draft: { settings: structuredClone(settings), seconds: "901" }, sources: [{ role: "media", mediaAssetId: asset, variantId: "50000000-0000-4000-8000-000000000001", checksumSha256: "a".repeat(64), byteSize: 1024 }], dirty: true, pending: null });
const journal = () => upgradeMediaFrameJournal(legacy(), null);
const membership = { seriesId: series, seriesRevision: 21, seriesTitle: "Eigen label", position: 20 };

describe("media series journal compatibility and exact pending authority", () => {
  it.each([0, 7])("wraps an existing v1 pending command at revision %i without changing any command field", revision => {
    const value = legacy(); value.revision = revision; value.pending = prepareMediaFrameSave(value, nonce);
    const before = JSON.stringify(value.pending), restored = parseMediaFrameSeriesJournal(JSON.stringify(value), scope, membership)!;
    expect(restored.pending?.kind).toBe("frame"); expect(JSON.stringify(restored.pending?.command)).toBe(before);
    expect(prepareMediaFrameSeriesSave(restored, nextFrame, 1, nextFrame)).toBe(restored.pending);
    expect(restored.seriesDraft).toEqual(mediaSeriesDraft(membership));
  });
  it("does not turn an unbound blank series field into another command or fake group", () => {
    const value = journal(), pending = prepareMediaFrameSeriesSave(value, nonce);
    expect(pending.kind).toBe("frame"); expect(pending.command).toEqual(prepareMediaFrameSave(legacy(), nonce));
  });
  it("reserves only the appended frame, keeping the header identity and revision null", () => {
    const value = journal(); value.seriesDraft.seriesTitle = "  Zondag  ";
    const pending = prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame);
    expect(pending).toMatchObject({ kind: "series", command: { kind: "media-series", operation: "append", newFrameId: nextFrame, seriesId: null, expectedSeriesRevision: null, expectedFrameRevision: 0, seriesTitle: "  Zondag  ", settings: { durationSeconds: 901, focus: "right" } } });
    expect(pending.command).not.toHaveProperty("isPrimary"); expect(pending.command).not.toHaveProperty("document");
    value.pending = pending; const restored = parseMediaFrameSeriesJournal(JSON.stringify(value), scope, null)!;
    expect(prepareMediaFrameSeriesSave(restored, frame, 1, frame)).toBe(restored.pending); expect(restored.pending).toEqual(pending);
  });
  it("saves a bound empty member title without detaching or rewriting its CAS", () => {
    const value = journal(); value.revision = 8; value.seriesDraft = { ...mediaSeriesDraft(membership), seriesTitle: "", dirty: true };
    expect(prepareMediaFrameSeriesSave(value, nonce)).toMatchObject({ kind: "series", command: { operation: "save", seriesId: series, expectedSeriesRevision: 21, expectedFrameRevision: 8, seriesTitle: "" } });
  });
  it("does not inherit Studio's twenty-member limit", () => {
    const value = journal(); value.revision = 8; value.seriesDraft = mediaSeriesDraft(membership);
    expect(prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame)).toMatchObject({ command: { operation: "append", expectedSeriesRevision: 21, newFrameId: nextFrame } });
  });
  it.each([{ actorScope: `${tenant}:actor-b` }, { tenantId: nextFrame }, { identity: `frame:${nextFrame}` }, { assetId: nextFrame }])("ignores another actor/resource scope %j", change => {
    expect(parseMediaFrameSeriesJournal(JSON.stringify(journal()), { ...scope, ...change }, null)).toBeNull();
  });
  it("binds a copy to its real frame even when both journal and pending are altered", () => {
    const copyScope = { ...scope, identity: `frame:${frame}` }, value = { ...journal(), ...copyScope, revision: 3 };
    value.pending = prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame);
    const changed = { ...value, frameId: nextFrame, pending: { ...value.pending, command: { ...value.pending.command, frameId: nextFrame, newFrameId: frame } } };
    expect(() => parseMediaFrameSeriesJournal(JSON.stringify(changed), copyScope, null)).toThrow();
  });
  it("rejects a changed series/asset/CAS binding without discarding the original record", () => {
    const value = journal(); value.seriesDraft.seriesTitle = "Zondag"; value.pending = prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame);
    const before = JSON.stringify(value);
    for (const change of [{ sourceAssetId: nextFrame }, { expectedFrameRevision: 4 }, { seriesId: series, expectedSeriesRevision: 2 }]) {
      expect(() => parseMediaFrameSeriesJournal(JSON.stringify({ ...value, pending: { ...value.pending, command: { ...value.pending!.command, ...change } } }), scope, null)).toThrow();
    }
    expect(JSON.stringify(value)).toBe(before);
  });
  it("persists a confirmed destination using identifiers instead of signed URLs", () => {
    const value = journal(); value.confirmedAppend = { frameId: nextFrame, contentKey: `media-frame:${nextFrame}`, href: `/dashboard/content/media/${nextFrame}`, name: "Zondag · slide 2" };
    expect(parseMediaFrameSeriesJournal(JSON.stringify(value), scope, null)?.confirmedAppend).toEqual(value.confirmedAppend);
    expect(() => parseMediaFrameSeriesJournal(JSON.stringify({ ...value, confirmedAppend: { ...value.confirmedAppend, href: "https://foreign.invalid/token" } }), scope, null)).toThrow();
    expect(JSON.stringify(value)).not.toContain("https:");
  });
  it("retains transient name/duration/title but validates before creating a new command", () => {
    const value = journal(); value.draft.settings.name = ""; value.draft.seconds = "";
    expect(parseMediaFrameSeriesJournal(JSON.stringify(value), scope, null)?.draft).toEqual(value.draft);
    expect(() => prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame)).toThrow(); expect(value.draft.seconds).toBe("");
    expect(validMediaSeriesTitle("a".repeat(120))).toBe(true); expect(validMediaSeriesTitle("a".repeat(121))).toBe(false);
  });
});

describe("media series read reconciliation", () => {
  it("adopts a fresh clean group revision while retaining the confirmed next link", () => {
    const value = journal(); value.revision = 8; value.dirty = false; value.seriesDraft = mediaSeriesDraft(membership);
    value.confirmedAppend = { frameId: nextFrame, contentKey: `media-frame:${nextFrame}`, href: `/dashboard/content/media/${nextFrame}`, name: "Vervolg" };
    const fresh = { ...structuredClone(value), seriesDraft: { ...value.seriesDraft, baseRevision: 22, seriesTitle: "Nieuwe naam" }, confirmedAppend: null };
    expect(reconcileMediaFrameSeriesJournal(value, fresh)).toEqual({ journal: { ...fresh, confirmedAppend: value.confirmedAppend }, conflict: false });
  });
  it("keeps a dirty series title on its original CAS instead of pairing stale text with a fresh revision", () => {
    const value = journal(); value.revision = 8; value.seriesDraft = { ...mediaSeriesDraft(membership), seriesTitle: "Mijn invoer", dirty: true };
    const fresh = { ...structuredClone(value), revision: 9, dirty: false, seriesDraft: { ...mediaSeriesDraft(membership), baseRevision: 22, seriesTitle: "Anders" } };
    expect(reconcileMediaFrameSeriesJournal(value, fresh)).toEqual({ journal: value, conflict: true });
    expect(prepareMediaFrameSeriesSave(value, nonce)).toMatchObject({ command: { expectedFrameRevision: 8, expectedSeriesRevision: 21, seriesTitle: "Mijn invoer" } });
  });
  it("never replaces pending or rolls a confirmed revision back to older route props", () => {
    const value = journal(); value.pending = prepareMediaFrameSeriesSave(value, nonce, 3600, nextFrame);
    expect(reconcileMediaFrameSeriesJournal(value, { ...journal(), revision: 20 }).journal).toBe(value);
    value.pending = null; value.revision = 20; value.dirty = false;
    expect(reconcileMediaFrameSeriesJournal(value, journal()).journal).toBe(value);
  });
  it("detects another editor binding a previously unbound clean design", () => {
    const value = journal(); value.revision = 8; value.dirty = false;
    const fresh = { ...value, seriesDraft: mediaSeriesDraft(membership) };
    expect(reconcileMediaFrameSeriesJournal(value, fresh).journal).toEqual(fresh);
  });
});
