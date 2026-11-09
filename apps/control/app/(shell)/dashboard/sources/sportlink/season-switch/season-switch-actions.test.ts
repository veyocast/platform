import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), assets: vi.fn() }));
vi.mock("../../../../../../lib/control-session", () => ({ requireTenantControlSession: mocks.session }));
vi.mock("../../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../../../../../../lib/dynamic-preview-assets", () => ({ collectPreviewMediaAssetIds: () => [], loadPreviewAssets: mocks.assets }));
import { applySeasonSwitchAction, previewSeasonSwitchAction } from "./season-switch-actions";

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const actorScope = `${id(1)}:${id(2)}`;
const context = { providerTeamId: "new-team", competitionSelectionMode: "pinned", competitionId: "league", poolId: "pool", seasonId: "2026/2027", phaseId: null };
const previewInput = () => ({ resourceKind: "dynamic_slide", resourceId: id(3), basisVersionId: id(4), expectedRevision: 0, oldBindingHash: "a".repeat(64), contextHash: "b".repeat(64), newSelection: { mappings: [{ fromProviderTeamId: "old-team", context }] }, clearSelectedMatches: false });
const applyInput = () => ({ ...previewInput(), requestId: id(5), correlationId: id(6) });
const links = { edit: `/dashboard/slides/${id(3)}/edit`, publish: "/dashboard/planning", restore: null };
const result = () => ({ schemaVersion: 1, status: "applied", resourceKind: "dynamic_slide", resourceId: id(3), requestId: id(5), correlationId: id(6), receiptId: id(7), previousVersionId: id(4), draftVersionId: id(8), previousRevision: 0, newRevision: 1, reason: null, links });
const preview = () => {
  const { clearSelectedMatches, ...fields } = previewInput();
  return { ...fields, schemaVersion: 1, oldSelection: { mappings: [{ fromProviderTeamId: "old-team", context: { ...context, providerTeamId: "old-team", seasonId: "2025/2026" } }] }, canApply: true, reasons: [], preview: { state: "empty", message: null, data: { previewId: id(9), slideType: "sport_program", orientation: "landscape", templateVersionId: id(10), templateSlug: "editorial-arena-program", data: { sport: { title: "Voorbeeld", items: [] } } } }, impact: { knownCount: 0, truncated: false, unknown: true, references: [] }, clearsSelectedMatches: clearSelectedMatches, links };
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ isLive: true, tenantId: id(1), userId: id(2), tenantStatus: "active", capabilities: ["tenant.data_source.read", "tenant.dynamic_slide.write"] });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc }); mocks.assets.mockResolvedValue(new Map());
  mocks.rpc.mockResolvedValue({ data: result(), error: null });
});

describe("season-switch authorized canonical actions", () => {
  it.each([`${id(11)}:${id(2)}`, `${id(1)}:${id(12)}`])("rejects changed tenant/actor scope before database access", async scope => {
    expect(await applySeasonSwitchAction(applyInput(), scope)).toMatchObject({ ok: false });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("keeps source, draft and publication rights separate", async () => {
    mocks.session.mockResolvedValue({ isLive: true, tenantId: id(1), userId: id(2), tenantStatus: "active", capabilities: ["tenant.data_source.read", "tenant.dynamic_slide.read"] });
    expect(await applySeasonSwitchAction(applyInput(), actorScope)).toMatchObject({ ok: false });
    expect(await previewSeasonSwitchAction(previewInput(), actorScope)).toMatchObject({ ok: false });
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ isLive: true, tenantId: id(1), userId: id(2), tenantStatus: "active", capabilities: ["tenant.data_source.read", "tenant.dynamic_slide.write"] });
    expect(await applySeasonSwitchAction(applyInput(), actorScope)).toMatchObject({ ok: true });
  });

  it("passes only binding commands and exact original nonces through the tenant RPC after response loss", async () => {
    const input = applyInput(); mocks.rpc.mockRejectedValueOnce(new Error("PRIVATE provider credentials"));
    const failed = await applySeasonSwitchAction(input, actorScope);
    expect(JSON.stringify(failed)).not.toContain("PRIVATE");
    expect(await applySeasonSwitchAction(input, actorScope)).toMatchObject({ ok: true, receipt: { newRevision: 1 } });
    expect(mocks.rpc.mock.calls).toEqual([["apply_sportlink_season_switch_draft_v1", { p_tenant_id: id(1), p_input: input }], ["apply_sportlink_season_switch_draft_v1", { p_tenant_id: id(1), p_input: input }]]);
    expect(mocks.rpc.mock.calls.flat().join(" ")).not.toContain("publish");
  });

  it("rejects mismatched or incomplete receipts instead of reporting successful storage", async () => {
    for (const altered of [{ ...result(), requestId: id(20) }, { ...result(), resourceId: id(21) }, { ...result(), receiptId: null }, { ...result(), draftVersionId: null }, { ...result(), newRevision: null }]) {
      mocks.rpc.mockResolvedValueOnce({ error: null, data: altered });
      expect(await applySeasonSwitchAction(applyInput(), actorScope)).toMatchObject({ ok: false });
    }
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("uses a read-only canonical preview envelope and existing verified asset preparation", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: null, data: preview() });
    const response = await previewSeasonSwitchAction(previewInput(), actorScope);
    expect(response).toMatchObject({ ok: true, review: { canApply: true }, screenPreview: { ok: true, payload: { snapshotId: id(9), data: { sport: { items: [] } } } } });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("preview_sportlink_season_switch_v1", { p_tenant_id: id(1), p_input: previewInput() });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("does not accept a preview for another revision, source-context hash or destination", async () => {
    for (const altered of [{ ...preview(), expectedRevision: 1 }, { ...preview(), contextHash: "c".repeat(64) }, { ...preview(), newSelection: { mappings: [{ fromProviderTeamId: "old-team", context: { ...context, poolId: "other-pool" } }] } }]) {
      mocks.rpc.mockResolvedValueOnce({ error: null, data: altered });
      expect(await previewSeasonSwitchAction(previewInput(), actorScope)).toMatchObject({ ok: false });
    }
  });
});
