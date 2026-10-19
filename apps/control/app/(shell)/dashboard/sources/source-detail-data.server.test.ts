import { beforeEach, describe, expect, it, vi } from "vitest";

const tenant = "23400000-0000-4000-8000-000000000001";
const own = "23400000-0000-4000-8000-000000000002";
const foreign = "23400000-0000-4000-8000-000000000003";
const f = vi.hoisted(() => ({ session: vi.fn(), tables: {} as Record<string, Array<Record<string, unknown>>>, errors: {} as Record<string, unknown>, executed: [] as Array<{ table: string; select: string; filters: Record<string, unknown>; limit?: number }>, rpc: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({
  from(table: string) {
    const filters: Record<string, unknown> = {};
    let columns = "", maximum: number | undefined;
    const result = (single = false) => {
      f.executed.push({ table, select: columns, filters: { ...filters }, limit: maximum });
      const rows = (f.tables[table] ?? []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === undefined || row[key] === value));
      return { data: single ? rows[0] ?? null : rows.slice(0, maximum), count: rows.length, error: f.errors[table] ?? null };
    };
    const query = { select: (value: string) => { columns = value; return query; }, eq: (key: string, value: unknown) => { filters[key] = value; return query; }, neq: () => query, in: () => query, order: () => query, gte: () => query, is: () => query, limit: (value: number) => { maximum = value; return query; }, maybeSingle: async () => result(true), then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result())) };
    return query;
  }, rpc: f.rpc, storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) }
}) }));

import { loadSourceDetail } from "./source-detail-data.server";

beforeEach(() => {
  vi.clearAllMocks(); f.executed = []; f.errors = {};
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.data_source.read", "tenant.product.read"] });
  f.rpc.mockImplementation(async (name: string) => ({ data: name === "get_ledscores_feature_effective_state_v1" ? { tenantId: tenant, flagKey: "ledscores_realtime", definitionAvailable: true, killSwitchActive: false, configuredEnabled: true, enabled: true, revision: 1 } : {}, error: null }));
  f.tables = {
    dynamic_data_sources: [{ id: own, tenant_id: tenant, name: "Eigen clubnieuws", kind: "rss", status: "active", provider_status: "ready", last_successful_sync_at: new Date().toISOString(), last_error_code: null, config_json: { url: "https://club.example/feed?secret=private-token", refreshMinutes: 5, credentials: "DO_NOT_EXPOSE" } }],
    dynamic_news_articles: [{ id: own, tenant_id: tenant, data_source_id: own, title: "Opgeslagen eigen nieuws", intro: "Werkelijke opgeslagen introductie", canonical_link: "https://club.example/nieuws/1", link: "https://club.example/nieuws/1", raw_reference: { private: "DO_NOT_EXPOSE" } }],
    dynamic_sync_runs: [{ tenant_id: tenant, data_source_id: own, started_at: "2026-10-19T09:00:00Z", error_detail: "DO_NOT_EXPOSE" }],
    sportlink_connections: [{ id: own, tenant_id: tenant, status: "active", detected_club_name: "Eigen vereniging", client_id_suffix: "1234", last_tested_at: null, last_success_at: null, last_error_code: null, privacy_birthdays_enabled: false, authoring_revision: 3, selected_team_codes: ["own-team"] }],
    sportlink_sync_policies: [{ id: own, tenant_id: tenant, connection_id: own, dataset_group: "matches", frequency: "daily", enabled: true, last_success_at: null }],
    sportlink_sync_runs: [{ tenant_id: tenant, connection_id: own, dataset_group: "matches", status: "failed", error_code: "SPORTLINK_SYNC_FAILED" }],
    ledscores_connections: [{ id: own, tenant_id: tenant, name: "Eigen hoofdveld", scoreboard_label: "Hoofdveld", club_slug: "eigen-club", status: "active", health_status: "connected", last_source_message_at: null, last_connected_at: new Date().toISOString(), lease_expires_at: new Date(Date.now() + 60_000).toISOString(), last_test_at: null }],
    ledscores_team_mappings: [{ tenant_id: tenant, connection_id: own, id: own }],
    ledscores_goal_events: [{ id: own, tenant_id: tenant, connection_id: own, home_team: "Eigen team", away_team: "Tegenstander", home_score: 1, away_score: 0, event_kind: "goal" }],
    youtube_sources: [{ id: own, tenant_id: tenant, title: "Eigen clubvideo", status: "active", validation_status: "verified", embeddable: true, video_id: "abcdefghijk", playlist_id: null, playlist_video_ids: null, playlist_unavailable_count: 0, channel_title: null, fallback_media_asset_id: own }],
    tenant_feature_flags: [{ tenant_id: tenant, enabled: true }]
  };
});

describe("Source detail uses selected tenant reads and safe existing provider loaders", () => {
  it("does no session, provider or database work for a closed or malformed selection", async () => {
    expect(await loadSourceDetail(null)).toBeNull();
    expect(await loadSourceDetail({ mode: "detail", provider: "led", id: "led" })).toBeNull();
    expect(f.session).not.toHaveBeenCalled(); expect(f.executed).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("requires a fresh read session and fails closed without a live tenant", async () => {
    f.session.mockResolvedValueOnce({ isLive: false, tenantId: null });
    expect(await loadSourceDetail({ mode: "detail", provider: "rss", id: own })).toMatchObject({ failed: true, detail: null });
    expect(f.session).toHaveBeenCalledExactlyOnceWith("tenant.data_source.read"); expect(f.executed).toEqual([]);
  });
  it("returns saved own articles, real attempts and only whitelisted display config", async () => {
    const result = await loadSourceDetail({ mode: "detail", provider: "rss", id: own });
    expect(result).toMatchObject({ failed: false, detail: { name: "Eigen clubnieuws", itemCount: 1, lastAttemptAt: "2026-10-19T09:00:00Z", items: [{ title: "Opgeslagen eigen nieuws", href: "https://club.example/nieuws/1" }] } });
    expect(result?.detail?.fields).toContainEqual({ label: "Publieke feed-URL", value: "https://club.example/feed" });
    const json = JSON.stringify(result); expect(json).not.toContain("DO_NOT_EXPOSE"); expect(json).not.toContain("private-token"); expect(json).not.toContain("config_json"); expect(json).not.toContain("raw_reference");
    for (const read of f.executed) expect(read.filters.tenant_id).toBe(tenant);
    for (const read of f.executed.filter(read => read.table !== "dynamic_data_sources")) expect(read.filters.data_source_id).toBe(own);
    expect(f.executed.find(read => read.table === "dynamic_news_articles")?.limit).toBe(100);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("projects a safe cause and recovery for a failed RSS source without exposing provider details", async () => {
    Object.assign(f.tables.dynamic_data_sources![0]!, { provider_status: "error", last_error_code: "rss_fetch_unavailable", provider_error: "DO_NOT_EXPOSE" });
    const result = await loadSourceDetail({ mode: "detail", provider: "rss", id: own });
    expect(result?.detail?.health.tone).toBe("critical");
    expect(result?.detail?.issue).toBe("De feed was niet bereikbaar. De laatste goede inhoud blijft bewaard. Probeer synchroniseren opnieuw.");
    expect(result?.detail?.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("DO_NOT_EXPOSE");
    f.tables.dynamic_data_sources![0]!.last_error_code = "DO_NOT_EXPOSE";
    const unknown = await loadSourceDetail({ mode: "detail", provider: "rss", id: own });
    expect(unknown?.detail?.issue).toContain("De laatste synchronisatie kon niet worden voltooid");
    expect(JSON.stringify(unknown)).not.toContain("DO_NOT_EXPOSE");
  });
  it("does not read child data for a foreign resource or mismatched provider kind", async () => {
    expect(await loadSourceDetail({ mode: "detail", provider: "rss", id: foreign })).toMatchObject({ detail: null, failed: true });
    expect(f.executed.map(read => read.table)).toEqual(["dynamic_data_sources"]);
    f.executed = [];
    expect(await loadSourceDetail({ mode: "detail", provider: "twelve", id: own })).toMatchObject({ detail: null, failed: true });
    expect(f.executed.map(read => read.table)).toEqual(["dynamic_data_sources"]);
  });
  it("does not grant product reads merely because source read is permitted", async () => {
    f.tables.dynamic_data_sources![0]!.kind = "manual_products";
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, capabilities: ["tenant.data_source.read"] });
    const result = await loadSourceDetail({ mode: "detail", provider: "twelve", id: own });
    expect(result?.detail?.itemCount).toBeNull(); expect(f.executed.some(read => read.table === "tenant_products")).toBe(false);
  });
  it("uses the selected real Sportlink connection and retains a recent failure", async () => {
    const result = await loadSourceDetail({ mode: "detail", provider: "sportlink", id: own });
    expect(result?.detail).toMatchObject({ id: own, name: "Eigen vereniging", health: { tone: "critical" }, itemCount: null });
    expect(f.executed.find(read => read.table === "sportlink_connections")?.filters).toEqual({ tenant_id: tenant, id: own });
    for (const read of f.executed.filter(read => read.table !== "sportlink_connections")) expect(read.filters.connection_id).toBe(own);
    expect(f.rpc.mock.calls.every(([name]) => name === "get_sportlink_birthday_status_v1")).toBe(true);
  });
  it("scopes actual LED mappings, events and counts to the selected connection", async () => {
    const result = await loadSourceDetail({ mode: "detail", provider: "led", id: own });
    expect(result?.detail).toMatchObject({ id: own, name: "Eigen hoofdveld", itemCount: 1 });
    expect(f.executed.find(read => read.table === "ledscores_connections")?.filters).toEqual({ tenant_id: tenant, id: own });
    for (const read of f.executed.filter(read => ["ledscores_team_mappings", "ledscores_goal_events"].includes(read.table))) expect(read.filters.connection_id).toBe(own);
    for (const read of f.executed) expect(read.filters.tenant_id).toBe(tenant);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("get_ledscores_feature_effective_state_v1", { p_tenant_id: tenant });
  });
  it("does not read LED histories for a foreign selection or a new connection", async () => {
    expect(await loadSourceDetail({ mode: "detail", provider: "led", id: foreign })).toMatchObject({ failed: true, detail: null });
    expect(f.executed.map(read => read.table)).toEqual(["ledscores_connections"]);
    f.executed = [];
    expect(await loadSourceDetail({ mode: "create", provider: "led" })).toMatchObject({ failed: false, detail: null });
    expect(f.executed.map(read => read.table).sort()).toEqual(["sports_clubs", "sports_teams"]);
  });
  it("reads a selected YouTube UUID and no existing source list for creation", async () => {
    expect(await loadSourceDetail({ mode: "detail", provider: "youtube", id: own })).toMatchObject({ detail: { id: own, name: "Eigen clubvideo", itemCount: 1 } });
    expect(f.executed.find(read => read.table === "youtube_sources")?.filters).toEqual({ tenant_id: tenant, id: own });
    f.executed = [];
    await loadSourceDetail({ mode: "create", provider: "youtube" });
    expect(f.executed.some(read => read.table === "youtube_sources")).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects unsafe article links and keeps failures out of the client DTO", async () => {
    f.tables.dynamic_news_articles![0]!.canonical_link = "javascript:alert(1)";
    f.errors.dynamic_sync_runs = { message: "DO_NOT_EXPOSE" };
    const result = await loadSourceDetail({ mode: "detail", provider: "rss", id: own });
    expect(result?.failed).toBe(true); expect(result?.detail?.items[0]).not.toHaveProperty("href"); expect(JSON.stringify(result)).not.toContain("DO_NOT_EXPOSE");
  });
});
