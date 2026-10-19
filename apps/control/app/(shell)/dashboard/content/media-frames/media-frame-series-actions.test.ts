import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import type { MediaFrameSeriesCommand } from "./media-frame-series-types";
const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), page: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("./media-frame-filmstrip-data.server", () => ({ loadContentFilmstripPage: f.page, validContentFilmstripOffset: (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_600 }));
import { mutateMediaFrameSeriesAction, readContentFilmstripAction } from "./media-frame-series-actions";
const id = (n: number) => `23200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = `${id(1)}:${id(7)}`;
function command(operation: "save" | "append" = "save"): MediaFrameSeriesCommand {
  return { kind: "media-series", tenantId: id(1), frameId: id(2), sourceAssetId: id(3), expectedFrameRevision: 7,
    settings: mediaFrameDefaultSettings({ title: "Eigen bron", kind: "image", durationSeconds: null }), expectedSources: [{ role: "media", mediaAssetId: id(3), variantId: id(4), checksumSha256: "a".repeat(64), byteSize: 1234 }], seriesId: null, expectedSeriesRevision: null, seriesTitle: "", idempotencyKey: id(9), operation, ...(operation === "append" ? { newFrameId: id(11) } : {}) } as MediaFrameSeriesCommand;
}
function receipt(operation: "save" | "append" = "save") {
  return { outcome: operation === "save" ? "saved" : "appended", frameId: id(2), frameRevision: 8, versionId: id(5), versionNumber: 3,
    series: operation === "save" ? null : { seriesId: id(10), seriesRevision: 1, seriesTitle: "Eigen bron", position: 0, memberCount: 2 }, newFrame: operation === "save" ? null : { frameId: id(11), frameRevision: 1, versionId: id(6), versionNumber: 1 } };
}
beforeEach(() => {
  vi.resetAllMocks(); f.session.mockResolvedValue({ isLive: true, tenantId: id(1), userId: id(7), tenantStatus: "active", capabilities: ["tenant.media.read", "tenant.media.write"] });
  f.client.mockResolvedValue({ rpc: f.rpc }); f.rpc.mockResolvedValue({ data: receipt(), error: null });
  f.page.mockResolvedValue({ items: [], offset: 48, total: 0, hasMore: false });
});

describe("Series fresh-session and complete command boundary", () => {
  it.each([{ isPrimary: false }, { seriesId: id(10), expectedSeriesRevision: 0 }, { tenantId: "wrong" }, { url: "https://private.invalid" }])("rejects malformed whole command before any session/client %j", async patch => {
    expect(await mutateMediaFrameSeriesAction({ ...command(), ...patch }, scope)).toMatchObject({ ok: false, code: "invalid", uncertain: false });
    expect(f.session).not.toHaveBeenCalled(); expect(f.client).not.toHaveBeenCalled();
  });
  it.each([{ isLive: false }, { tenantId: id(20) }, { userId: id(20) }, { tenantStatus: "paused" }, { tenantStatus: "archived" }, { userId: null }])("rejects changed actor/tenant/status before client %j", async patch => {
    f.session.mockResolvedValue({ isLive: true, tenantId: id(1), userId: id(7), tenantStatus: "active", ...patch });
    expect(await mutateMediaFrameSeriesAction(command(), scope)).toMatchObject({ ok: false, code: "denied", uncertain: true });
    expect(f.session).toHaveBeenCalledWith("tenant.media.write"); expect(f.client).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("requires actor scope even when tenant remains unchanged", async () => {
    expect(await mutateMediaFrameSeriesAction(command(), undefined as never)).toMatchObject({ ok: false, code: "denied", uncertain: true }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["save", "append"] as const)("submits exact frozen8argument %s command; unknown response replays same body and nonce", async operation => {
    const original = command(operation), before = JSON.stringify(original);
    f.rpc.mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce({ data: receipt(operation), error: null });
    expect(await mutateMediaFrameSeriesAction(original, scope)).toMatchObject({ ok: false, uncertain: true });
    const result = await mutateMediaFrameSeriesAction(original, scope);
    expect(result).toMatchObject({ ok: true, current: { frameId: id(2), frameRevision: 8, versionId: id(5) } });
    expect(f.rpc).toHaveBeenCalledTimes(2); expect(f.rpc.mock.calls[1]).toEqual(f.rpc.mock.calls[0]);
    expect(f.rpc.mock.calls[0]).toEqual(["mutate_media_frame_series_v1", { p_tenant_id: id(1), p_frame_id: id(2), p_expected_revision: 7, p_series_id: null, p_expected_series_revision: null, p_operation: `${operation}_series`, p_payload: { sourceAssetId: id(3), settings: original.settings, expectedSources: original.expectedSources, seriesTitle: "", ...(operation === "append" ? { newFrameId: id(11) } : {}) }, p_idempotency_key: id(9) }]);
    expect(JSON.stringify(original)).toBe(before); expect(f.session).toHaveBeenCalledTimes(2); expect(f.revalidate).toHaveBeenCalledWith("/dashboard/content");
    if (operation === "append") expect(result).toMatchObject({ appended: { href: `/dashboard/content/media/${id(11)}`, contentKey: `media-frame:${id(11)}` } });
  });
  it.each([
    ["PT409", "conflict", false], ["40001", "unavailable", true], ["57014", "unavailable", true], ["23505", "unavailable", true],
    ["42501", "denied", true], ["P0002", "denied", true], ["55000", "denied", true], ["23514", "source_unavailable", true], ["22023", "source_unavailable", true], ["23503", "source_unavailable", true],
  ] as const)("classifies actual SQL %s without losing uncertain earlier command", async (code, expected, uncertain) => {
    f.rpc.mockResolvedValue({ data: null, error: { code, message: "sensitive backend detail" } });
    const result = await mutateMediaFrameSeriesAction(command(), scope);
    expect(result).toMatchObject({ ok: false, code: expected, uncertain }); expect(JSON.stringify(result)).not.toContain("sensitive"); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...receipt(), outcome: "noop" }, { ...receipt(), frameRevision: 100 }, { ...receipt(), series: { seriesId: id(99) } }])("cannot navigate on partial/foreign receipt %j", async data => {
    f.rpc.mockResolvedValue({ data, error: null }); expect(await mutateMediaFrameSeriesAction(command(), scope)).toMatchObject({ ok: false, code: "unavailable", uncertain: true }); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("rechecks revoked permission on replay before any second RPC", async () => {
    f.rpc.mockRejectedValueOnce(new Error("lost acknowledgement")); await mutateMediaFrameSeriesAction(command(), scope);
    f.session.mockRejectedValueOnce(new Error("permission boundary")); await expect(mutateMediaFrameSeriesAction(command(), scope)).rejects.toThrow("permission boundary"); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("Full-library filmstrip action", () => {
  it("uses fresh media.read+actor fence and one bounded read, without mutations", async () => {
    expect(await readContentFilmstripAction({ tenantId: id(1), offset: 48 }, scope)).toMatchObject({ ok: true, page: { offset: 48 } });
    expect(f.session).toHaveBeenCalledWith("tenant.media.read"); expect(f.page).toHaveBeenCalledWith(await f.client.mock.results[0]!.value, id(1), 48); expect(f.rpc).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it.each([{ tenantId: "wrong", offset: 0 }, { tenantId: id(1), offset: -1 }, { tenantId: id(1), offset: 0.5 }, { tenantId: id(1), offset: 2_147_483_601 }, { tenantId: id(1), offset: 0, extra: "memberIds" }])("rejects invalid unbounded inputs before reads %j", async input => {
    expect(await readContentFilmstripAction(input, scope)).toMatchObject({ ok: false }); expect(f.session).not.toHaveBeenCalled(); expect(f.page).not.toHaveBeenCalled();
  });
  it.each([`${id(1)}:${id(99)}`, `${id(99)}:${id(7)}`, ""]) ("rejects stale actor scope %s", async expected => {
    expect(await readContentFilmstripAction({ tenantId: id(1), offset: 0 }, expected)).toMatchObject({ ok: false }); expect(f.client).not.toHaveBeenCalled();
  });
  it("reports incomplete library read rather than a false empty page", async () => {
    f.page.mockResolvedValue(null); expect(await readContentFilmstripAction({ tenantId: id(1), offset: 0 }, scope)).toMatchObject({ ok: false });
  });
});
