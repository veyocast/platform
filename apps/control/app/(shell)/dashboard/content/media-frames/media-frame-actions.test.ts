import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaFrameCommand, MediaFrameSettings } from "@veyocast/contracts";

const f = vi.hoisted(() => ({
  session: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(),
  storage: vi.fn(), sign: vi.fn(),
}));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
import { mutateMediaFrameAction as mutateAction, readMediaFrameSourceAction as readSourceAction } from "./media-frame-actions";

const tenant = "19170000-0000-4000-8000-000000000010";
const foreignTenant = "19170000-0000-4000-8000-000000000011";
const actor = "19170000-0000-4000-8000-000000000001";
const otherActor = "19170000-0000-4000-8000-000000000002";
const actorScope = `${tenant}:${actor}`;
const frame = "19170000-0000-4000-8000-000000000101";
const copy = "19170000-0000-4000-8000-000000000102";
const asset = "19170000-0000-4000-8000-000000000103";
const background = "19170000-0000-4000-8000-000000000104";
const variant = "19170000-0000-4000-8000-000000000105";
const version = "19170000-0000-4000-8000-000000000106";
const nonce = "19170000-0000-4000-8000-000000000107";
const checksum = "a".repeat(64);
const sourcePath = `tenants/${tenant}/assets/${asset}/verified.webp`;
const signedUrl = "https://storage.example.test/temporary-owned-preview";
const mutateMediaFrameAction = (input: unknown) => mutateAction(input, actorScope);
const readMediaFrameSourceAction = (input: Parameters<typeof readSourceAction>[0]) => readSourceAction(input, actorScope);
const fingerprint = () => ({ role: "media" as const, mediaAssetId: asset, variantId: variant, checksumSha256: checksum, byteSize: 1234 });
const settings = (): MediaFrameSettings => ({
  schemaVersion: 1, name: "Eigen lange video", orientation: "portrait", durationSeconds: 901,
  fitMode: "contain", focus: "right",
  appearance: { themeId: "fieldflow", accentColor: "#123456", background: { kind: "preset", preset: "stripes" } },
  sourceMetadata: { title: "Bewaarde metadata", headline: "Kop", subtitle: "Sub", body: "Eigen tekst", footer: "Voet",
    font: "Manrope", scale: 110, alignment: "right", safeMargin: 7, showLogo: true, showFooter: false, motion: "geen" },
});
function command(operation: MediaFrameCommand["operation"] = "save"): MediaFrameCommand {
  const identity = { tenantId: tenant, frameId: frame, idempotencyKey: nonce };
  if (operation === "create") return { ...identity, operation, expectedRevision: 0, sourceAssetId: asset, expectedSources: [fingerprint()], settings: settings() };
  if (operation === "save") return { ...identity, operation, expectedRevision: 7, expectedSources: [fingerprint()], settings: settings() };
  if (operation === "duplicate") return { ...identity, operation, expectedRevision: 7, newFrameId: copy };
  return { ...identity, operation, expectedRevision: 7 };
}
function receipt(overrides: Record<string, unknown> = {}) {
  return { frameId: frame, frameRevision: 8, versionId: version, versionNumber: 3, outcome: "saved", ...overrides };
}
function source(overrides: Record<string, unknown> = {}) {
  return { mediaAssetId: asset, kind: "image", title: "Eigen foto", fileName: "bron.webp", width: 1920, height: 1080, durationSeconds: null,
    variant: { variantId: variant, checksumSha256: checksum, byteSize: 1234, storageBucket: "tenant-media", storagePath: sourcePath, mimeType: "image/webp" },
    poster: null, ...overrides };
}
const request = (role: "media" | "background" = "media") => ({ tenantId: tenant, mediaAssetId: asset, role });

beforeEach(() => {
  vi.resetAllMocks();
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", userId: actor });
  f.storage.mockReturnValue({ createSignedUrl: f.sign });
  f.sign.mockResolvedValue({ data: { signedUrl }, error: null });
  f.client.mockResolvedValue({ rpc: f.rpc, storage: { from: f.storage } });
  f.rpc.mockResolvedValue({ data: receipt(), error: null });
});

describe("Media frame mutation admission and immutable command identity", () => {
  it.each([
    { ...command(), tenantId: "not-a-tenant" },
    { ...command(), idempotencyKey: "new-key-please" },
    { ...command(), sourceUrl: signedUrl },
    { ...command(), operation: "publish" },
    { ...command("create"), expectedRevision: 1 },
    { ...command("create"), sourceAssetId: background },
  ])("rejects malformed or URL-bearing commands before session or RPC access", async input => {
    expect(await mutateMediaFrameAction(input)).toMatchObject({ ok: false, code: "invalid", uncertain: false });
    expect(f.session).not.toHaveBeenCalled(); expect(f.client).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    { isLive: false, tenantId: tenant, tenantStatus: "active" },
    { isLive: true, tenantId: foreignTenant, tenantStatus: "active" },
    { isLive: true, tenantId: null, tenantStatus: "active" },
    { isLive: true, tenantId: tenant, tenantStatus: "paused" },
    { isLive: true, tenantId: tenant, tenantStatus: "archived" },
  ])("denies non-live, switched, missing or inactive tenants before making a client", async session => {
    f.session.mockResolvedValue({ ...session, userId: actor });
    expect(await mutateMediaFrameAction(command())).toMatchObject({ ok: false, code: "denied", uncertain: true });
    expect(f.session).toHaveBeenCalledWith("tenant.media.write");
    expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });

  it("rechecks permission on every replay and propagates the auth boundary without submitting", async () => {
    f.rpc.mockRejectedValueOnce(new Error("lost acknowledgement"));
    const original = command();
    expect(await mutateMediaFrameAction(original)).toMatchObject({ ok: false, uncertain: true });
    f.session.mockRejectedValueOnce(new Error("permission revoked"));
    await expect(mutateMediaFrameAction(original)).rejects.toThrow("permission revoked");
    expect(f.session).toHaveBeenCalledTimes(2); expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.session.mock.invocationCallOrder[0]).toBeLessThan(f.client.mock.invocationCallOrder[0]!);
  });

  it.each(["create", "save", "duplicate", "archive", "restore"] as const)("sends the exact %s ABI and replays the original nonce/body after response loss", async operation => {
    const original = command(operation), snapshot = structuredClone(original);
    const outcome = { create: "created", save: "saved", duplicate: "duplicated", archive: "archived", restore: "restored" }[operation];
    const expectedFrame = operation === "duplicate" ? copy : frame;
    const frameRevision = operation === "create" || operation === "duplicate" ? 1 : 8;
    const versionNumber = operation === "create" || operation === "duplicate" ? 1 : 3;
    f.rpc.mockRejectedValueOnce(new Error("private transport detail")).mockResolvedValueOnce({ data: receipt({ frameId: expectedFrame, frameRevision, versionNumber, outcome }), error: null });
    expect(await mutateMediaFrameAction(original)).toMatchObject({ ok: false, code: "unavailable", uncertain: true });
    expect(f.revalidate).not.toHaveBeenCalled();
    expect(await mutateMediaFrameAction(original)).toEqual({ ok: true, frameId: expectedFrame, frameRevision, versionId: version, versionNumber, outcome });
    const expected = operation === "create"
      ? ["create_media_frame_v1", { p_tenant_id: tenant, p_frame_id: frame, p_source_asset_id: asset, p_expected_sources: [fingerprint()], p_settings: settings(), p_idempotency_key: nonce }]
      : ["mutate_media_frame_v1", { p_tenant_id: tenant, p_frame_id: frame, p_expected_revision: 7, p_operation: operation,
        p_payload: operation === "save" ? { settings: settings(), expectedSources: [fingerprint()] } : operation === "duplicate" ? { newFrameId: copy } : {}, p_idempotency_key: nonce }];
    expect(f.rpc.mock.calls).toEqual([expected, expected]); expect(original).toEqual(snapshot);
    expect(f.session.mock.calls).toEqual([["tenant.media.write"], ["tenant.media.write"]]);
    expect(f.revalidate.mock.calls).toEqual([["/dashboard/content"], [`/dashboard/content/media/${expectedFrame}`]]);
  });

  it("keeps both exact source fingerprints and image-background identity in a save", async () => {
    const input = command("save");
    if (input.operation !== "save") throw new Error("save fixture required");
    input.settings.appearance.background = { kind: "image", mediaAssetId: background, position: "left" };
    input.expectedSources.push({ ...fingerprint(), role: "background", mediaAssetId: background });
    expect((await mutateMediaFrameAction(input)).ok).toBe(true);
    expect(f.rpc.mock.calls[0]?.[1].p_payload).toEqual({ settings: input.settings, expectedSources: input.expectedSources });
    expect(input.settings.durationSeconds).toBe(901);
  });

  it.each([
    ["PT409", "conflict", false], ["40001", "unavailable", true], ["57014", "unavailable", true],
    ["42501", "denied", true], ["P0002", "denied", true], ["55000", "denied", true],
    ["23514", "source_unavailable", true], ["23503", "source_unavailable", true], ["22023", "source_unavailable", true],
  ])("distinguishes %s from an unacknowledged action without leaking server details", async (code, resultCode, uncertain) => {
    f.rpc.mockResolvedValue({ data: null, error: { code, message: "sensitive storage and actor detail" } });
    const result = await mutateMediaFrameAction(command());
    expect(result).toMatchObject({ ok: false, code: resultCode, uncertain });
    expect(JSON.stringify(result)).not.toContain("sensitive"); expect(f.revalidate).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not infer success when the session client is unavailable", async () => {
    f.client.mockResolvedValue(null);
    expect(await mutateMediaFrameAction(command())).toMatchObject({ ok: false, code: "unavailable", uncertain: true });
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });
});

describe("Media frame receipt binding", () => {
  it.each([
    null, receipt({ frameId: copy }), receipt({ versionId: "not-a-version" }), receipt({ versionId: null }),
    receipt({ frameRevision: 0 }), receipt({ frameRevision: 1.5 }), receipt({ frameRevision: "8" }),
    receipt({ versionNumber: 0 }), receipt({ versionNumber: Number.MAX_SAFE_INTEGER + 1 }),
    receipt({ outcome: "published" }),
  ])("keeps malformed or unrelated acknowledgements uncertain and never revalidates", async data => {
    f.rpc.mockResolvedValue({ data, error: null });
    expect(await mutateMediaFrameAction(command())).toMatchObject({ ok: false, code: "unavailable", uncertain: true });
    expect(f.revalidate).not.toHaveBeenCalled();
  });

  it("a duplicate receipt must identify the requested copy, never the original frame", async () => {
    f.rpc.mockResolvedValue({ data: receipt({ outcome: "duplicated" }), error: null });
    expect(await mutateMediaFrameAction(command("duplicate"))).toMatchObject({ ok: false, uncertain: true });
    expect(f.revalidate).not.toHaveBeenCalled();
  });

  it.each(["create", "save", "duplicate", "archive", "restore"] as const)("rejects a structurally valid acknowledgement for the wrong %s operation", async operation => {
    const expectedFrame = operation === "duplicate" ? copy : frame;
    const wrongOutcome = operation === "save" ? "created" : "saved";
    f.rpc.mockResolvedValue({ data: receipt({ frameId: expectedFrame, outcome: wrongOutcome }), error: null });
    expect(await mutateMediaFrameAction(command(operation))).toMatchObject({ ok: false, code: "unavailable", uncertain: true });
    expect(f.revalidate).not.toHaveBeenCalled();
  });

  it.each(["archive", "restore"] as const)("accepts the explicit %s noop receipt without inventing a new content version", async operation => {
    f.rpc.mockResolvedValue({ data: receipt({ outcome: "noop", frameRevision: 7 }), error: null });
    expect(await mutateMediaFrameAction(command(operation))).toMatchObject({ ok: true, outcome: "noop", frameRevision: 7, versionNumber: 3 });
  });
});

describe("Media frame actor scope survives account switches without crossing identities", () => {
  it("does not replay actor A's uncertain command under actor B in the same tenant", async () => {
    const original = command(), snapshot = structuredClone(original);
    f.rpc.mockRejectedValueOnce(new Error("lost response for actor A"));
    expect(await mutateMediaFrameAction(original)).toMatchObject({ ok: false, uncertain: true });
    const submitted = structuredClone(f.rpc.mock.calls);
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", userId: otherActor });
    expect(await mutateAction(original, actorScope)).toMatchObject({ ok: false, code: "denied", uncertain: true });
    expect(f.rpc.mock.calls).toEqual(submitted); expect(f.client).toHaveBeenCalledTimes(1);
    expect(original).toEqual(snapshot); expect(f.revalidate).not.toHaveBeenCalled();
  });

  it("does not refresh actor A's private preview after switching to actor B", async () => {
    f.rpc.mockResolvedValue({ data: source(), error: null });
    expect((await readMediaFrameSourceAction(request())).ok).toBe(true);
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", userId: otherActor });
    expect(await readSourceAction(request(), actorScope)).toMatchObject({ ok: false });
    expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.client).toHaveBeenCalledTimes(1); expect(f.sign).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit mutation actor scope even for a valid same-tenant command", async () => {
    expect(await Reflect.apply(mutateAction, undefined, [command()])).toMatchObject({ ok: false, code: "denied", uncertain: true });
    expect(f.session).toHaveBeenCalledWith("tenant.media.write");
    expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });

  it("requires an explicit source-read actor scope before signing private media", async () => {
    expect(await Reflect.apply(readSourceAction, undefined, [request()])).toMatchObject({ ok: false });
    expect(f.session).toHaveBeenCalledWith("tenant.media.read");
    expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });

  it("cannot manufacture an actor boundary from a live session with no actor identity", async () => {
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", userId: null });
    expect(await mutateAction(command(), `${tenant}:null`)).toMatchObject({ ok: false, code: "denied", uncertain: true });
    expect(await readSourceAction(request(), `${tenant}:null`)).toMatchObject({ ok: false });
    expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });
});

describe("Media frame source privacy and fingerprint boundary", () => {
  beforeEach(() => { f.rpc.mockResolvedValue({ data: source(), error: null }); });

  it.each([
    { ...request(), tenantId: "invalid" }, { ...request(), mediaAssetId: "invalid" },
    { ...request(), role: "poster" }, null,
  ])("rejects invalid source identities before auth and signing", async input => {
    expect(await readMediaFrameSourceAction(input as Parameters<typeof readMediaFrameSourceAction>[0])).toMatchObject({ ok: false });
    expect(f.session).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });

  it.each([
    { isLive: false, tenantId: tenant }, { isLive: true, tenantId: foreignTenant }, { isLive: true, tenantId: null },
  ])("requires the fresh read capability and exact current tenant before reading or signing", async session => {
    f.session.mockResolvedValue({ ...session, userId: actor });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: false });
    expect(f.session).toHaveBeenCalledWith("tenant.media.read");
    expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.storage).not.toHaveBeenCalled();
  });

  it("does not reuse an old read permission when source refresh is denied", async () => {
    expect((await readMediaFrameSourceAction(request())).ok).toBe(true);
    f.session.mockRejectedValueOnce(new Error("read permission revoked"));
    await expect(readMediaFrameSourceAction(request())).rejects.toThrow("read permission revoked");
    expect(f.session).toHaveBeenCalledTimes(2); expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.sign).toHaveBeenCalledTimes(1);
  });

  it("signs only a verified tenant asset and returns a separate identity fingerprint", async () => {
    expect(await readMediaFrameSourceAction(request())).toEqual({ ok: true, source: {
      mediaAssetId: asset, kind: "image", title: "Eigen foto", fileName: "bron.webp", byteSize: 1234,
      width: 1920, height: 1080, durationSeconds: null, sourceUrl: signedUrl, posterUrl: null, expectedSource: fingerprint(),
    } });
    expect(f.rpc.mock.calls).toEqual([["get_media_frame_source_v1", { p_tenant_id: tenant, p_asset_id: asset }]]);
    expect(f.storage.mock.calls).toEqual([["tenant-media"]]); expect(f.sign.mock.calls).toEqual([[sourcePath, 900]]);
    expect(f.revalidate).not.toHaveBeenCalled();
  });

  it("allows image backgrounds but never promotes a video to the background role", async () => {
    expect(await readMediaFrameSourceAction(request("background"))).toMatchObject({ ok: true, source: { expectedSource: { role: "background" } } });
    f.sign.mockClear(); f.storage.mockClear();
    f.rpc.mockResolvedValue({ data: source({ kind: "video", durationSeconds: 901, maximumDurationSeconds: 901 }), error: null });
    expect(await readMediaFrameSourceAction(request("background"))).toMatchObject({ ok: false });
    expect(f.storage).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: true, source: { kind: "video", durationSeconds: 901, maximumDurationSeconds: 901 } });
  });

  it.each([undefined, null, 0, 4, 3601, -1, 901.5, "901", Number.NaN])("never signs a video without a bounded authoritative integer duration maximum: %s", async maximumDurationSeconds => {
    f.rpc.mockResolvedValue({ data: source({ kind: "video", durationSeconds: 901, maximumDurationSeconds }), error: null });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: false });
    expect(f.storage).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });

  it.each([5, 3600])("retains the exact authoritative video duration maximum at its boundary: %i", async maximumDurationSeconds => {
    f.rpc.mockResolvedValue({ data: source({ kind: "video", durationSeconds: maximumDurationSeconds, maximumDurationSeconds }), error: null });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: true, source: { kind: "video", durationSeconds: maximumDurationSeconds, maximumDurationSeconds } });
    expect(f.sign).toHaveBeenCalledExactlyOnceWith(sourcePath, 900);
  });

  it.each([
    { mediaAssetId: background }, { kind: "audio" }, { variant: null },
    { variant: { ...source().variant, storageBucket: "public-media" } },
    { variant: { ...source().variant, storagePath: `tenants/${foreignTenant}/assets/${asset}/verified.webp` } },
    { variant: { ...source().variant, storagePath: `tenants/${tenant}/assets/${background}/verified.webp` } },
    { variant: { ...source().variant, storagePath: `tenants/${tenant}/assets/${asset}/../other.webp` } },
    { variant: { ...source().variant, storagePath: `tenants/${tenant}/assets/${asset}/./verified.webp` } },
    { variant: { ...source().variant, storagePath: `${sourcePath}?x` } },
    { variant: { ...source().variant, storagePath: `${sourcePath}#x` } },
    { variant: { ...source().variant, storagePath: `${sourcePath}\\x` } },
    { variant: { ...source().variant, storagePath: `${sourcePath}\u0001` } },
    { variant: { ...source().variant, variantId: "forged-variant" } },
    { variant: { ...source().variant, checksumSha256: "not-a-sha256" } },
    { variant: { ...source().variant, byteSize: 0 } },
    { variant: { ...source().variant, byteSize: Number.MAX_SAFE_INTEGER + 1 } },
  ])("never signs a foreign path, missing identity or invalid source fingerprint", async override => {
    f.rpc.mockResolvedValue({ data: source(override), error: null });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: false });
    expect(f.storage).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });

  it.each([
    { storageBucket: "tenant-media", storagePath: `tenants/${foreignTenant}/assets/${asset}/poster.webp` },
    { storageBucket: "tenant-media", storagePath: `tenants/${tenant}/assets/${background}/poster.webp` },
    { storageBucket: "public-media", storagePath: sourcePath },
  ])("does not sign an unrelated optional poster even when the main source is valid", async poster => {
    f.rpc.mockResolvedValue({ data: source({ poster }), error: null });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: true, source: { posterUrl: null } });
    expect(f.sign.mock.calls).toEqual([[sourcePath, 900]]);
  });

  it("uses the same private scope for a valid optional poster and tolerates its signing failure", async () => {
    const posterPath = `tenants/${tenant}/assets/${asset}/poster.webp`;
    f.rpc.mockResolvedValue({ data: source({ poster: { storageBucket: "tenant-media", storagePath: posterPath } }), error: null });
    f.sign.mockResolvedValueOnce({ data: { signedUrl }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "private poster detail" } });
    expect(await readMediaFrameSourceAction(request())).toMatchObject({ ok: true, source: { sourceUrl: signedUrl, posterUrl: null } });
    expect(f.sign.mock.calls).toEqual([[sourcePath, 900], [posterPath, 900]]);
  });

  it.each(["client", "rpc-error", "rpc-throw", "sign-error", "sign-empty"])("keeps %s failures generic without exposing private data", async fault => {
    if (fault === "client") f.client.mockResolvedValue(null);
    if (fault === "rpc-error") f.rpc.mockResolvedValue({ data: null, error: { message: "sensitive provider details" } });
    if (fault === "rpc-throw") f.rpc.mockRejectedValue(new Error("sensitive provider details"));
    if (fault === "sign-error") f.sign.mockResolvedValue({ data: null, error: { message: "sensitive signing detail" } });
    if (fault === "sign-empty") f.sign.mockResolvedValue({ data: {}, error: null });
    const result = await readMediaFrameSourceAction(request());
    expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("sensitive"); expect(f.revalidate).not.toHaveBeenCalled();
  });
});
