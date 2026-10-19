import { describe, expect, it } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import { mediaFrameSeriesCopyName, parseMediaFrameSeriesCommand, parseMediaFrameSeriesRead, parseMediaFrameSeriesReceipt } from "./media-frame-series-contract";
import type { MediaFrameSeriesCommand } from "./media-frame-series-types";
const id = (n: number) => `23200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function command(operation: "save" | "append" = "save", bound = false): MediaFrameSeriesCommand {
  return { kind: "media-series", tenantId: id(1), frameId: id(2), sourceAssetId: id(3), expectedFrameRevision: 7,
    settings: mediaFrameDefaultSettings({ title: "Eigen bron", kind: "image", durationSeconds: null }), expectedSources: [{ role: "media", mediaAssetId: id(3), variantId: id(4), checksumSha256: "a".repeat(64), byteSize: 1234 }],
    seriesId: bound ? id(10) : null, expectedSeriesRevision: bound ? 5 : null, seriesTitle: "", idempotencyKey: id(9), operation,
    ...(operation === "append" ? { newFrameId: id(11) } : {}),
  } as MediaFrameSeriesCommand;
}
function receipt(c = command()): Record<string, unknown> {
  const group = c.seriesId || c.operation === "append" || c.seriesTitle.trim() ? { seriesId: c.seriesId ?? id(10), seriesRevision: c.seriesId ? c.expectedSeriesRevision! + 1 : 1, seriesTitle: c.operation === "append" ? c.seriesTitle.trim() || c.settings.name : c.seriesTitle, position: 0, memberCount: c.operation === "append" ? 2 : 1 } : null;
  return { outcome: c.operation === "append" ? "appended" : "saved", frameId: c.frameId, frameRevision: c.expectedFrameRevision + 1, versionId: id(5), versionNumber: c.expectedFrameRevision ? 3 : 1, series: group, newFrame: c.operation === "append" ? { frameId: c.newFrameId, frameRevision: 1, versionId: id(6), versionNumber: 1 } : null };
}

describe("Whole original media-series command", () => {
  it.each(["save", "append"] as const)("preserves exact %s object and JSON body with null binding", operation => {
    const original = command(operation); const serialized = JSON.stringify(original);
    expect(parseMediaFrameSeriesCommand(original)).toBe(original);
    expect(JSON.stringify(parseMediaFrameSeriesCommand(original))).toBe(serialized);
    expect(parseMediaFrameSeriesCommand(JSON.parse(serialized))).toEqual(original);
  });
  it.each([
    { isPrimary: true }, { seriesId: id(10), expectedSeriesRevision: 0 }, { seriesId: id(10), expectedSeriesRevision: null },
    { seriesId: null, expectedSeriesRevision: 1 }, { seriesId: id(10), expectedSeriesRevision: 1, expectedFrameRevision: 0 },
    { sourceAssetId: id(99) }, { sourceUrl: "https://private.invalid/signed" }, { seriesTitle: "x".repeat(121) }, { expectedFrameRevision: -1 }, { expectedFrameRevision: 0.5 },
    { expectedSeriesRevision: Number.MAX_SAFE_INTEGER + 1, seriesId: id(10) }, { kind: "frame" }, { idempotencyKey: "replacement" }, { operation: "duplicate" },
  ])("rejects unsafe identity/binding/extra fields %j", patch => expect(parseMediaFrameSeriesCommand({ ...command(), ...patch })).toBeNull());
  it("rejects missing nulls, duplicate roles, unbound background refs and extra append identity on save", () => {
    const c = command(); const missing = { ...c } as Record<string, unknown>; delete missing.seriesId;
    expect(parseMediaFrameSeriesCommand(missing)).toBeNull();
    expect(parseMediaFrameSeriesCommand({ ...c, expectedSources: [c.expectedSources[0], c.expectedSources[0]] })).toBeNull();
    expect(parseMediaFrameSeriesCommand({ ...c, expectedSources: [...c.expectedSources, { ...c.expectedSources[0], role: "background" }] })).toBeNull();
    expect(parseMediaFrameSeriesCommand({ ...c, newFrameId: id(11) })).toBeNull();
  });
  it("requires exact frozen background identity and already normalized name", () => {
    const c = command(); c.settings.appearance.background = { kind: "image", mediaAssetId: id(20), position: "right" };
    expect(parseMediaFrameSeriesCommand(c)).toBeNull();
    c.expectedSources.push({ ...c.expectedSources[0]!, role: "background", mediaAssetId: id(20) });
    expect(parseMediaFrameSeriesCommand(c)).toBe(c);
    expect(parseMediaFrameSeriesCommand({ ...c, settings: { ...c.settings, name: " Eigen bron " } })).toBeNull();
  });
  it("allows blank, whitespace and60 supplementary characters, never silently trims save titles", () => {
    for (const title of ["", " \t\u00a0", "😀".repeat(60)]) { const c = { ...command("save", true), seriesTitle: title }; expect(parseMediaFrameSeriesCommand(c)).toBe(c); }
    expect(parseMediaFrameSeriesCommand({ ...command(), seriesTitle: "😀".repeat(61) })).toBeNull();
  });
  it("requires a distinct valid append frame and permits first unsaved primary revision0", () => {
    expect(parseMediaFrameSeriesCommand({ ...command("append"), newFrameId: id(2) })).toBeNull();
    expect(parseMediaFrameSeriesCommand({ ...command("append"), expectedFrameRevision: 0 })).not.toBeNull();
  });
});

describe("Complete frozen acknowledgement and atomic read", () => {
  it("distinguishes unbound blank save from newly named and existing bound blank save", () => {
    for (const c of [command(), { ...command(), seriesTitle: "Naam" }, command("save", true)]) expect(parseMediaFrameSeriesReceipt(receipt(c), c)).toMatchObject({ ok: true, appended: null });
    expect(parseMediaFrameSeriesReceipt({ ...receipt(), series: { seriesId: id(10), seriesRevision: 1, seriesTitle: "", position: 0, memberCount: 1 } }, command())).toBeNull();
  });
  it("binds a server-minted new group, copied frame and truthful existing content href", () => {
    const c = { ...command("append"), seriesTitle: "\t\u00a0 Nieuwe reeks \u00a0" };
    expect(parseMediaFrameSeriesReceipt(receipt(c), c)).toMatchObject({ ok: true, membership: { seriesTitle: "Nieuwe reeks", position: 0 }, series: { revision: 1, memberCount: 2 }, appended: { frameId: id(11), name: "Nieuwe reeks · slide 2", href: `/dashboard/content/media/${id(11)}`, contentKey: `media-frame:${id(11)}`, membership: { position: 1, seriesTitle: "Nieuwe reeks" } } });
  });
  it.each([
    { frameId: id(99) }, { frameRevision: 7 }, { versionId: "bad" }, { versionNumber: 0 }, { outcome: "saved" },
    { newFrame: null }, { newFrame: { frameId: id(99), frameRevision: 1, versionId: id(6), versionNumber: 1 } },
    { newFrame: { frameId: id(11), frameRevision: 2, versionId: id(6), versionNumber: 1 } },
    { newFrame: { frameId: id(11), frameRevision: 1, versionId: id(5), versionNumber: 1 } },
    { rawUrl: "https://unexpected.invalid" }, { series: null },
  ])("never navigates on wrong/incomplete append receipt %j", patch => { const c = command("append"); expect(parseMediaFrameSeriesReceipt({ ...receipt(c), ...patch }, c)).toBeNull(); });
  it.each([
    { seriesId: id(99) }, { seriesRevision: 5 }, { seriesTitle: "Other member label" }, { position: 2 }, { position: -1 }, { memberCount: 0 }, { memberCount: 2.5 }, { unknown: true },
  ])("binds exact group revision and current-member label %j", patch => { const c = command("append", true), r = receipt(c); expect(parseMediaFrameSeriesReceipt({ ...r, series: { ...(r.series as object), ...patch } }, c)).toBeNull(); });
  it("accepts21and indexed integer maximum members without a Studio20 limit", () => {
    for (const memberCount of [21, 2_147_483_648]) { const c = command("append", true), r = receipt(c); const result = parseMediaFrameSeriesReceipt({ ...r, series: { ...(r.series as object), memberCount, position: memberCount - 2 } }, c); expect(result).toMatchObject({ ok: true, series: { memberCount }, appended: { membership: { position: memberCount - 1 } } }); }
  });
  it("truncates only generated Unicode prefix and never produces a split surrogate", () => {
    const generated = mediaFrameSeriesCopyName("😀".repeat(60), 2_147_483_648);
    expect(generated.length).toBeLessThanOrEqual(120); expect(generated.endsWith(" · slide 2147483648")).toBe(true);
    expect([...generated.slice(0, -" · slide 2147483648".length)].every(character => character === "😀")).toBe(true);
  });
  it("requires one complete atomic metadata DTO and exact frame identity", () => {
    const r = receipt(command("save", true)); delete r.outcome; delete r.newFrame;
    expect(parseMediaFrameSeriesRead(r, id(2))).toMatchObject({ frameId: id(2), membership: { seriesId: id(10) }, series: { memberCount: 1 } });
    expect(parseMediaFrameSeriesRead(r, id(99))).toBeNull();
    expect(parseMediaFrameSeriesRead({ ...r, extra: true }, id(2))).toBeNull();
    expect(parseMediaFrameSeriesRead({ ...r, series: { ...(r.series as object), memberCount: 0 } }, id(2))).toBeNull();
  });
});
