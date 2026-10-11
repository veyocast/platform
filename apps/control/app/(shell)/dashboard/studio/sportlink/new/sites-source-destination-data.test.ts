import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), responses: {} as Record<string, unknown>, calls: [] as Array<[string, string, unknown]>, tables: [] as string[] }));
vi.mock("../../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ from: (table: string) => {
  f.tables.push(table); const query = { select: () => query, eq: (key: string, value: unknown) => { f.calls.push([table, key, value]); return query; }, neq: () => query, is: () => query, order: () => query, limit: async () => f.responses[table] }; return query;
} }) }));
import { loadSitesSourceDestinationOptions } from "./sites-source-destination-data";
const tenant = "a1910000-0000-4000-8000-000000007801";
beforeEach(() => { vi.resetAllMocks(); f.calls.length = 0; f.tables.length = 0; f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.playlist.read", "tenant.playlist.write", "tenant.playlist.publish"] }); f.responses = { playlists: { data: [{ id: "own-playlist", name: "Kantine", revision: 4 }], error: null }, screens: { data: [{ id: "own-screen", name: "Kantine", orientation: "landscape" }], error: null }, screen_groups: { data: [{ id: "own-group", name: "Club" }], error: null }, screen_group_memberships: { data: [{ screen_group_id: "own-group", screen_id: "own-screen" }, { screen_group_id: "own-group", screen_id: "own-screen" }, { screen_group_id: "own-group", screen_id: "inactive-screen" }], error: null } }; });
describe("Bronbestemmingen worden uit de echte actieve tenant geladen", () => {
  it("bindt alle reads aan tenant en active groups, dedupliceert uitsluitend bestaande schermen", async () => {
    expect(await loadSitesSourceDestinationOptions()).toEqual({ canPublish: true, unavailable: false, playlists: [{ id: "own-playlist", name: "Kantine", revision: 4 }], screens: [{ id: "own-screen", name: "Kantine", orientation: "landscape" }], groups: [{ id: "own-group", name: "Club", screenIds: ["own-screen"] }] });
    for (const table of f.tables) expect(f.calls).toContainEqual([table, "tenant_id", tenant]); expect(f.calls).toContainEqual(["screen_groups", "status", "active"]);
  });
  it("biedt zonder leesrechten geen bestemmingen en zonder publishrechten of bij gepauzeerde tenant geen publicatiekeuze", async () => {
    f.session.mockResolvedValueOnce({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: [] }); expect(await loadSitesSourceDestinationOptions()).toMatchObject({ canPublish: false, playlists: [] }); expect(f.tables).toHaveLength(0);
    for (const session of [{ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.playlist.read"] }, { isLive: true, tenantId: tenant, tenantStatus: "paused", capabilities: ["tenant.playlist.read", "tenant.playlist.write", "tenant.playlist.publish"] }]) { f.session.mockResolvedValue(session); expect(await loadSitesSourceDestinationOptions()).toMatchObject({ canPublish: false }); }
  });
  it("faalt veilig bij ontbrekende provideronafhankelijke opslag zonder een lijst te verzinnen", async () => {
    f.responses.screens = { data: null, error: { message: "private-detail" } }; expect(await loadSitesSourceDestinationOptions()).toEqual({ canPublish: false, unavailable: true, playlists: [], screens: [], groups: [] });
  });
});
