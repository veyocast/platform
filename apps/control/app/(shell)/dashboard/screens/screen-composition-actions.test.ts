import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), revalidate: vi.fn(), from: vi.fn(), rows: {} as Record<string, Array<Record<string, unknown>>>, reads: [] as Array<{ table: string; filters: Array<[string, string, unknown]>; limit: number }> }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantCapability: fixtures.capability }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: fixtures.rpc, from: fixtures.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: fixtures.revalidate }));
import { saveScreenComposition } from "./screen-composition-actions";

const tenant = "00000000-0000-4000-8000-000000000001";
const screen = "00000000-0000-4000-8000-000000000002";
const playlist = "00000000-0000-4000-8000-000000000003";
const series = "00000000-0000-4000-8000-000000000004";
const request = () => ({ commandId: "00000000-0000-4000-8000-000000000005", targets: [{ screenId: screen, expectedDraftRevision: 7 }], configuration: { layout: "full", orientation: "landscape", mainWidthPercent: 70, bottomHeightPercent: 20, zones: [{ id: "main", content: `playlist:${playlist}` }] }, seriesRevisions: {} });
beforeEach(() => {
  vi.clearAllMocks(); fixtures.reads = [];
  fixtures.capability.mockResolvedValue({ isLive: true, tenantId: tenant, memberships: [tenant, "00000000-0000-4000-8000-000000000011"] });
  fixtures.rows = { screens: [{ id: screen, tenant_id: tenant, status: "active", deleted_at: null }], studio_series: [{ id: series, tenant_id: tenant, status: "active", revision: 4 }], playlists: [{ id: playlist, tenant_id: tenant, status: "published", archived_at: null }] };
  fixtures.from.mockImplementation((table: string) => {
    const filters: Array<[string, string, unknown]> = [];
    const query = { select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => { filters.push(["eq", key, value]); return query; }), is: vi.fn((key: string, value: unknown) => { filters.push(["is", key, value]); return query; }), in: vi.fn((key: string, value: unknown[]) => { filters.push(["in", key, value]); return query; }), order: vi.fn(() => query), limit: vi.fn((limit: number) => { fixtures.reads.push({ table, filters, limit }); return Promise.resolve({ data: (fixtures.rows[table] ?? []).filter(row => filters.every(([operator, key, value]) => operator === "in" ? (value as unknown[]).includes(row[key]) : row[key] === value)).slice(0, limit), error: null }); }) };
    return query;
  });
});
describe("Schermindeling gebruikt echte immutable publicaties", () => {
  it("scopeert alle targets en bronnen op de actieve vereniging vóór enige muterende RPC", async () => {
    const foreignTenant = "00000000-0000-4000-8000-000000000011", foreign = "00000000-0000-4000-8000-000000000012";
    fixtures.rows.studio_series!.push({ id: foreign, tenant_id: foreignTenant, status: "active", revision: 4 });
    const input = { ...request(), configuration: { ...request().configuration, zones: [{ id: "main", content: `series:${foreign}` }] }, seriesRevisions: { [foreign]: 4 } };
    expect((await saveScreenComposition(input)).status).toBe("error");
    expect(fixtures.rpc).not.toHaveBeenCalled();
    expect(fixtures.reads.every(read => read.filters.some(([operator, key, value]) => operator === "eq" && key === "tenant_id" && value === tenant))).toBe(true);
    expect(fixtures.reads.find(read => read.table === "studio_series")?.limit).toBe(3);
  });
  it("weigert een vreemd target vóór een geldige Studio-serie kan worden gepubliceerd", async () => {
    const foreign = "00000000-0000-4000-8000-000000000012";
    fixtures.rows.screens!.push({ id: foreign, tenant_id: "00000000-0000-4000-8000-000000000011", status: "active", deleted_at: null });
    const input = { ...request(), targets: [{ screenId: screen, expectedDraftRevision: 7 }, { screenId: foreign, expectedDraftRevision: 0 }], configuration: { ...request().configuration, zones: [{ id: "main", content: `series:${series}` }] }, seriesRevisions: { [series]: 4 } };
    expect((await saveScreenComposition(input)).status).toBe("error"); expect(fixtures.rpc).not.toHaveBeenCalled();
  });
  it("valideert alle zones samen: een latere vreemde playlist creëert geen eerdere Studio-playlist", async () => {
    const foreign = "00000000-0000-4000-8000-000000000012";
    fixtures.rows.playlists!.push({ id: foreign, tenant_id: "00000000-0000-4000-8000-000000000011", status: "published", archived_at: null });
    const input = { ...request(), configuration: { ...request().configuration, layout: "sidebar", zones: [{ id: "main", content: `series:${series}` }, { id: "side", content: `playlist:${foreign}` }] }, seriesRevisions: { [series]: 4 } };
    expect((await saveScreenComposition(input)).status).toBe("error"); expect(fixtures.rpc).not.toHaveBeenCalled();
  });
  it("weigert verwijderde of inactieve targets en gewijzigde bronrevisies zonder side effects", async () => {
    fixtures.rows.screens![0]!.deleted_at = "2026-10-11T10:00:00Z";
    expect((await saveScreenComposition(request())).status).toBe("error"); expect(fixtures.rpc).not.toHaveBeenCalled();
    fixtures.rows.screens![0]!.deleted_at = null; fixtures.rows.screens![0]!.status = "paused";
    expect((await saveScreenComposition(request())).status).toBe("error"); expect(fixtures.rpc).not.toHaveBeenCalled();
    fixtures.rows.screens![0]!.status = "active";
    const input = { ...request(), configuration: { ...request().configuration, zones: [{ id: "main", content: `series:${series}` }] }, seriesRevisions: { [series]: 3 } };
    expect((await saveScreenComposition(input)).status).toBe("conflict"); expect(fixtures.rpc).not.toHaveBeenCalled(); expect(fixtures.revalidate).not.toHaveBeenCalled();
  });

  it("weigert een ongeldige percentage-invoer voordat er Studio of schermen worden gewijzigd", async () => {
    const input = request(); input.configuration.mainWidthPercent = 73;
    expect((await saveScreenComposition(input)).status).toBe("error");
    expect(fixtures.capability).not.toHaveBeenCalled(); expect(fixtures.rpc).not.toHaveBeenCalled();
  });
  it("controleert schermbeheer én publiceren en verstuurt de exacte doelrevisie atomair", async () => {
    fixtures.rpc.mockResolvedValue({ data: { outcome: "published" }, error: null });
    const result = await saveScreenComposition(request());
    expect(result).toMatchObject({ status: "published", publishedCount: 1 });
    expect(fixtures.capability.mock.calls).toEqual([["tenant.screen.manage"], ["tenant.playlist.publish"]]);
    expect(fixtures.rpc).toHaveBeenCalledWith("save_publish_screen_composition_batch_v1", expect.objectContaining({ p_tenant_id: tenant, p_targets: [{ screenId: screen, expectedDraftRevision: 7, configuration: { schemaVersion: 1, layout: "full", orientation: "landscape", mainWidthPercent: 70, bottomHeightPercent: 20, zones: [{ id: "main", playlistId: playlist }] } }] }));
  });
  it("wijzigt geen schermen en claimt geen publicatie wanneer de batch een CAS-conflict meldt", async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect(await saveScreenComposition(request())).toMatchObject({ status: "conflict", publishedCount: 0 });
    expect(fixtures.revalidate).not.toHaveBeenCalled();
  });
  it("houdt dezelfde command-ID idempotent over een onbekende netwerkuitkomst", async () => {
    fixtures.rpc.mockResolvedValue({ data: { outcome: "published" }, error: null });
    await saveScreenComposition(request()); await saveScreenComposition(request());
    expect(fixtures.rpc.mock.calls[0]![1].p_idempotency_key).toBe(fixtures.rpc.mock.calls[1]![1].p_idempotency_key);
  });
  it("zet een Studio-serie om in een echte playlist en meldt die bij een later schermconflict", async () => {
    fixtures.rpc.mockResolvedValueOnce({ data: { outcome: "created", playlistId: playlist }, error: null }).mockResolvedValueOnce({ data: null, error: { code: "40001" } });
    const input = { ...request(), configuration: { ...request().configuration, zones: [{ id: "main", content: `series:${series}` }] }, seriesRevisions: { [series]: 4 } };
    const result = await saveScreenComposition(input);
    expect(fixtures.rpc.mock.calls[0]![0]).toBe("create_studio_series_zone_playlist_v1");
    expect(fixtures.rpc.mock.calls[0]![1]).toMatchObject({ p_series_id: series, p_expected_series_revision: 4 });
    expect(fixtures.rpc.mock.calls[1]![1].p_targets[0].configuration.zones).toEqual([{ id: "main", playlistId: playlist }]);
    expect(result).toMatchObject({ status: "conflict", publishedCount: 0 });
    expect(result.message).toContain("Studio-ontwerpen zijn wel als playlists beschikbaar");
  });
});
