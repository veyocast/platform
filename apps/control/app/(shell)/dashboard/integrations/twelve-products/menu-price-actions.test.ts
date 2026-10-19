import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), client: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
import { prepareMenuPriceCandidatesAction, publishMenuPriceCandidatesAction, readMenuPriceCandidatesAction, readMenuPriceImpactAction } from "./menu-price-actions";
const id = (n: number) => `a2610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const caps = ["tenant.product.read", "tenant.dynamic_slide.read", "tenant.dynamic_slide.write", "tenant.playlist.read", "tenant.screen.read"];
const session = () => ({ isLive: true, tenantId: id(1), tenantStatus: "active", capabilities: caps });
const command = { reviewHash: "a".repeat(64), selections: [{ slideId: id(2), basisVersionId: id(3), expectedRevision: 4 }], idempotencyKey: id(4) };
const candidates = { captureActorId: id(5), captureKey: id(4), candidates: [{ slideId: id(2), versionId: id(6), editRevision: 5, name: "Menu", editor: "sync", priceSetHash: "b".repeat(64), state: "draft", snapshotId: null, jobId: null, playlists: [] }] };
const impact = { status: "ready", complete: true, reviewHash: "a".repeat(64), totalProducts: 75, changedProducts: 51, affectedMenus: 2, affectedPlacements: 3, affectedPlaylists: 1, desiredScreens: 1, confirmedScreens: 0, unknownScreens: 1, reviewRequiredProducts: 1, offset: 20, limit: 20, hasMore: true, rows: [], menus: [], error: null };
beforeEach(() => { vi.resetAllMocks(); f.session.mockResolvedValue(session()); f.client.mockResolvedValue({ rpc: f.rpc }); f.rpc.mockResolvedValue({ data: candidates, error: null }); });
// These are action/transport boundary tests; real SQL authorization is proved separately.
describe("menu price server action boundaries", () => {
  it("reads the whole-impact RPC with bounded paging and the fresh server tenant, without receipts or revalidation", async () => {
    f.rpc.mockResolvedValue({ data: impact, error: null });
    expect(await readMenuPriceImpactAction({ offset: 20, limit: 20 })).toEqual({ ok: true, data: impact });
    expect(f.session).toHaveBeenCalledWith("tenant.product.read");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("read_menu_price_impact_v1", { p_tenant_id: id(1), p_offset: 20, p_limit: 20 });
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("does not send unbounded reads or leak menu/screen impact without the complete read capabilities", async () => {
    expect((await readMenuPriceImpactAction({ limit: 500 })).ok).toBe(false);
    for (const missing of ["tenant.dynamic_slide.read", "tenant.playlist.read", "tenant.screen.read"]) {
      f.session.mockResolvedValue({ ...session(), capabilities: caps.filter(cap => cap !== missing) });
      expect((await readMenuPriceImpactAction()).ok).toBe(false);
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("repeats the original nonce and exact reviewed request after a lost response", async () => {
    f.rpc.mockRejectedValueOnce(new Error("lost ACK"));
    expect(await prepareMenuPriceCandidatesAction(command)).toMatchObject({ ok: false, rejected: false });
    expect(await prepareMenuPriceCandidatesAction(command)).toEqual({ ok: true, data: candidates });
    expect(f.rpc.mock.calls[0]).toEqual(f.rpc.mock.calls[1]);
    expect(f.rpc.mock.calls[0]).toEqual(["prepare_menu_price_candidates_v1", { p_tenant_id: id(1), p_review_hash: command.reviewHash, p_selections: command.selections, p_idempotency_key: command.idempotencyKey }]);
  });
  it("requires a fresh active writer for both separate mutations", async () => {
    for (const state of [{ ...session(), isLive: false }, { ...session(), tenantStatus: "paused" }, { ...session(), capabilities: caps.filter(cap => cap !== "tenant.dynamic_slide.write") }]) {
      f.session.mockResolvedValue(state);
      expect((await prepareMenuPriceCandidatesAction(command)).ok).toBe(false);
      expect((await publishMenuPriceCandidatesAction({ captureActorId: id(5), captureKey: id(4), candidates: [{ slideId: id(2), versionId: id(6), expectedRevision: 5 }], idempotencyKey: id(7) })).ok).toBe(false);
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("does not silently prepare/publish another selection after a concurrent source or draft change", async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect(await prepareMenuPriceCandidatesAction(command)).toMatchObject({ ok: false, rejected: true, conflict: true });
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("publishes only the separately confirmed candidate versions and never performs a playlist/device command", async () => {
    const publish = { captureActorId: id(5), captureKey: id(4), candidates: [{ slideId: id(2), versionId: id(6), expectedRevision: 5 }], idempotencyKey: id(7) };
    expect((await publishMenuPriceCandidatesAction(publish)).ok).toBe(true);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("publish_menu_price_candidates_v1", { p_tenant_id: id(1), p_capture_actor_id: id(5), p_capture_key: id(4), p_candidates: publish.candidates, p_idempotency_key: id(7) });
  });
  it("retains an unconfirmed receipt state when the RPC response is incomplete", async () => {
    f.rpc.mockResolvedValue({ data: { outcome: "applied" }, error: null });
    expect(await prepareMenuPriceCandidatesAction(command)).toMatchObject({ ok: false, rejected: false });
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("status reads use the exact tenant/capture reference without retrying a mutator", async () => {
    expect(await readMenuPriceCandidatesAction({ captureActorId: id(5), captureKey: id(4) })).toEqual({ ok: true, data: candidates });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("read_menu_price_candidates_v1", { p_tenant_id: id(1), p_capture_actor_id: id(5), p_capture_key: id(4) });
    expect(f.revalidate).not.toHaveBeenCalled();
  });
});

import { createSyncStudioStarter } from "@veyocast/studio";
import { mutateSyncDynamicAuthoringAction } from "../../slides/sync-dynamic-actions";
function sourceCommand() {
  const seed = createSyncStudioStarter({ family: "menu", tenantName: "Eigen club", theme: "fieldflow" }).syncPresentation!;
  return { action: "save" as const, slideId: id(2), versionId: id(6), expectedRevision: 5, idempotencyKey: id(8), request: { templateVersionId: id(9), dataSourceId: id(10), configuration: {
    syncConfiguration: { schemaVersion: 1, kind: "dynamic", rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: "menu", seed: { ...seed, rows: [] }, secondsPerPage: 3 },
    menuPriceSourceReview: { sourceId: id(10), priceReviewHash: "c".repeat(64), confirmed: true },
  } } };
}
describe("ordinary Source source-change canonical readback", () => {
  it("keeps the same source-change command after lost ACK and returns the actual stored configuration", async () => {
    const command = sourceCommand(), configuration = { syncConfiguration: command.request.configuration.syncConfiguration, menuPriceSet: { dataSourceId: id(10), hash: "d".repeat(64) } };
    f.rpc.mockRejectedValueOnce(new Error("lost ACK")).mockResolvedValue({ data: { slideId: id(2), editRevision: 6, configuration }, error: null });
    await expect(mutateSyncDynamicAuthoringAction(command)).rejects.toThrow("lost ACK");
    expect(await mutateSyncDynamicAuthoringAction(command)).toMatchObject({ ok: true, editRevision: 6, configuration });
    expect(f.rpc.mock.calls[0]).toEqual(f.rpc.mock.calls[1]);
    expect(f.rpc.mock.calls[1]?.[1].p_request).toEqual(command.request);
  });
  it("does not confirm a source change when its stored price configuration is missing from the receipt", async () => {
    const command = sourceCommand(), syncConfiguration = command.request.configuration.syncConfiguration;
    for (const configuration of [undefined, { syncConfiguration }, { syncConfiguration, menuPriceSet: { dataSourceId: id(99), hash: "d".repeat(64) } }, { syncConfiguration, menuPriceSet: { dataSourceId: id(10), hash: "invalid" } }]) {
      f.rpc.mockResolvedValue({ data: { slideId: id(2), editRevision: 6, configuration }, error: null });
      expect(await mutateSyncDynamicAuthoringAction(command)).toMatchObject({ ok: false });
    }
    expect(f.revalidate).not.toHaveBeenCalled();
  });
});
