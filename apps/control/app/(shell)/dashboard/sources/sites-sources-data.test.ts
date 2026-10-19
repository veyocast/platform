import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ tables: {} as Record<string, { data: unknown; error: unknown }>, from: vi.fn(), eq: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({
  from(table: string) {
    f.from(table); const filters: Record<string, unknown> = {};
    const result = () => table === "sportlink_sync_runs" ? { data: { status: "failed", error_code: "SPORTLINK_SYNC_COMPLETE_57014" }, error: null } : f.tables[table] ?? { data: [], error: null };
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; f.eq(table, key, value); return query; }, neq: () => query, in: () => query, order: () => query, limit: () => query, maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result())) };
    return query;
  }, rpc: f.rpc
}) }));
import { loadSourcesOverview } from "./sites-sources-data";
const tenant = "a1910000-0000-4000-8000-000000006901";
beforeEach(() => {
  vi.resetAllMocks(); f.tables = {
    dynamic_data_sources: { data: [{ id: "real-catalog", name: "Eigen catalogus", kind: "manual_products", status: "active", provider_status: "ready", last_successful_sync_at: null, last_error_code: null, config_json: {} }], error: null },
    sportlink_connections: { data: { id: "real-connection", status: "active", last_error_code: null }, error: null },
    sportlink_sync_policies: { data: [{ dataset_group: "matches", frequency: "five_minutes", enabled: true, last_success_at: new Date().toISOString() }, { dataset_group: "birthdays", frequency: "daily", enabled: true, last_success_at: new Date().toISOString() }], error: null },
    tenant_feature_flags: { data: { flag_key: "youtube_integration", enabled: true }, error: null },
    youtube_sources: { data: [{ status: "active", validation_status: "verified", embeddable: true }], error: null },
    ledscores_connections: { data: [], error: null }
  };
  f.rpc.mockResolvedValue({ data: { tenantId: tenant, flagKey: "ledscores_realtime", definitionAvailable: true, killSwitchActive: false, configuredEnabled: true, enabled: true, revision: 1 }, error: null });
});
describe("Bronoverzicht leest alleen opgeslagen eigen tenantstatus", () => {
  it("gebruikt per dataset de laatste run en houdt fouten vóór oude success zonder mutaties", async () => {
    const result = await loadSourcesOverview(tenant);
    expect(result.cards.find(card => card.id === "sportlink")?.health).toMatchObject({ tone: "critical" });
    expect(f.eq).toHaveBeenCalledWith("sportlink_sync_runs", "dataset_group", "matches");
    expect(f.eq).toHaveBeenCalledWith("sportlink_sync_runs", "dataset_group", "birthdays");
    for (const [table] of f.from.mock.calls) expect(f.eq).toHaveBeenCalledWith(table, "tenant_id", tenant);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("get_ledscores_feature_effective_state_v1", { p_tenant_id: tenant });
    expect(result.cards.find(card => card.id === "youtube")?.health.label).toBe("Gevalideerd · online");
    expect(result.sources[0]).not.toHaveProperty("config_json");
  });
  it("vraagt niet-vrijgegeven LED en YouTube-providerbronnen niet op", async () => {
    f.tables.tenant_feature_flags = { data: { enabled: false }, error: null };
    f.rpc.mockResolvedValue({ data: { tenantId: tenant, flagKey: "ledscores_realtime", definitionAvailable: true, killSwitchActive: true, configuredEnabled: true, enabled: false, revision: 2 }, error: null });
    const result = await loadSourcesOverview(tenant);
    expect(f.from).not.toHaveBeenCalledWith("ledscores_connections"); expect(f.from).not.toHaveBeenCalledWith("youtube_sources");
    expect(result.cards.find(card => card.id === "led")?.health.label).toBe("Gepauzeerd");
    expect(result.cards.find(card => card.id === "youtube")?.health.label).toBe("Niet vrijgegeven");
  });
  it("laat een onleesbare policy of transportfout expliciet onbekend en bewaart geen ruwe foutdetails", async () => {
    f.tables.sportlink_sync_policies = { data: null, error: { message: "private-db-details" } };
    const result = await loadSourcesOverview(tenant);
    expect(result.failed).toBe(true); expect(result.cards.find(card => card.id === "sportlink")?.health.label).toBe("Status onbekend");
    f.rpc.mockRejectedValueOnce(new Error("private-credentials"));
    const unavailable = await loadSourcesOverview(tenant);
    expect(unavailable.cards.every(card => card.health.label === "Status onbekend")).toBe(true); expect(JSON.stringify(unavailable)).not.toContain("private-credentials");
  });
  it("exposes actual connection identities and names without sending raw provider config", async () => {
    f.tables.sportlink_connections = { data: { id: "23400000-0000-4000-8000-000000000001", status: "active", detected_club_name: "Eigen vereniging", last_success_at: null, last_error_code: null, encrypted_client_id: "DO_NOT_EXPOSE" }, error: null };
    f.tables.ledscores_connections = { data: [{ id: "23400000-0000-4000-8000-000000000002", name: "Eigen veld", status: "paused", health_status: "disconnected", last_connected_at: null, last_source_message_at: null, lease_expires_at: null, config_json: { private: "DO_NOT_EXPOSE" } }], error: null };
    f.tables.youtube_sources = { data: [{ id: "23400000-0000-4000-8000-000000000003", title: "Eigen clubvideo", status: "active", validation_status: "verified", embeddable: true }], error: null };
    const result = await loadSourcesOverview(tenant);
    expect(result.resources.map(resource => [resource.provider, resource.id, resource.name])).toEqual([["sportlink", "23400000-0000-4000-8000-000000000001", "Eigen vereniging"], ["led", "23400000-0000-4000-8000-000000000002", "Eigen veld"], ["youtube", "23400000-0000-4000-8000-000000000003", "Eigen clubvideo"]]);
    expect(JSON.stringify(result)).not.toContain("DO_NOT_EXPOSE");
  });
});
