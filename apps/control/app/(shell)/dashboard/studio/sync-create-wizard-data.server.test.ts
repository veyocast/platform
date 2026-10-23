import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncContentFamily } from "@veyocast/contracts";

const mocks = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), media: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: mocks.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
vi.mock("./data", () => ({ loadStudioMediaAssets: mocks.media }));
import { loadSyncCreateWizardData } from "./sync-create-wizard-data.server";

const id = (n: number) => `23400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), actor = id(2), source = id(3), version = id(4);
const session = () => ({ isLive: true, tenantId: tenant, userId: actor, tenant: "Eigen vereniging", tenantStatus: "active", capabilities: ["tenant.studio.create", "tenant.dynamic_slide.write", "tenant.media.read"] });
const sourceRow = (kind = "sportlink") => ({ id: source, name: "Eigen bron", kind, provider_status: "healthy", last_successful_sync_at: null, last_error_code: null });
const templateRow = () => ({ current_published_version_id: version, orientation: "landscape", slug: "eigen-template" });
type QueryResult = { data: unknown[] | null; error: unknown };
function database(overrides: Partial<Record<string, QueryResult>> = {}) {
  const results: Partial<Record<string, QueryResult>> = { dynamic_data_sources: { data: [sourceRow()], error: null }, dynamic_templates: { data: [templateRow()], error: null }, ledscores_connections: { data: [{ data_source_id: source }], error: null }, ...overrides };
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const themeModel = { schemaVersion: 1, tenantId: tenant, defaultThemeId: "fieldflow", profiles: [
    { themeId: "fieldflow", themeVersion: "1.0.0", revision: 0, configured: false, defaults: null },
    { themeId: "onzetrots-tv", themeVersion: "11.0.0", revision: 0, configured: false, defaults: null },
  ] };
  const client = { rpc: vi.fn().mockResolvedValue({ data: themeModel, error: null }), from: vi.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
    query.then = (resolve: (result: QueryResult) => unknown) => { const result = results[table]; if (!result) throw Error(`Unexpected table: ${table}`); return Promise.resolve(result).then(resolve); };
    return query;
  }) };
  mocks.client.mockResolvedValue(client);
  return { client, calls, themeModel };
}
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(session()); mocks.media.mockResolvedValue({ assets: [], error: null }); });

describe("new wizard read boundary", () => {
  it("rejects an unknown family before session or database access", async () => {
    expect(await loadSyncCreateWizardData("unknown" as SyncContentFamily)).toBeNull(); expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([{ isLive: false }, { tenantId: null }, { userId: null }])("rejects missing live identity %j", async override => {
    mocks.session.mockResolvedValue({ ...session(), ...override }); expect(await loadSyncCreateWizardData("menu")).toBeNull(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([{ capabilities: [] }, { tenantStatus: "paused" }])("shows denied read-only state without querying resources %j", async override => {
    mocks.session.mockResolvedValue({ ...session(), ...override }); const result = await loadSyncCreateWizardData("menu"); expect(result).toMatchObject({ canCreateManual: false, canCreateConnected: false, sources: [], templates: [] }); expect(result?.loadError).toBeTruthy(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("reads only active own Sportlink sources and published matching templates", async () => {
    const { client, calls } = database(); const result = await loadSyncCreateWizardData("fixtures");
    expect(result).toMatchObject({ actorScope: `${tenant}:${actor}`, initialMode: "connected", sources: [{ id: source }], templates: [{ versionId: version }], loadError: null });
    expect(calls).toEqual(expect.arrayContaining([{ table: "dynamic_data_sources", method: "eq", args: ["tenant_id", tenant] }, { table: "dynamic_data_sources", method: "eq", args: ["status", "active"] }, { table: "dynamic_data_sources", method: "in", args: ["kind", ["sportlink"]] }, { table: "dynamic_templates", method: "eq", args: ["status", "published"] }]));
    expect(client.from.mock.calls.map(call => call[0])).toEqual(["dynamic_data_sources", "dynamic_templates"]); expect(mocks.media).toHaveBeenCalledExactlyOnceWith(client, tenant, []);
    expect(result?.initialPresentation.rows).toEqual([]);
  });
  it.each([["menu", ["manual_products", "twelve_excel"]], ["rss", ["rss"]]] as const)("isolates %s provider kinds", async (family, kinds) => {
    const { calls } = database({ dynamic_data_sources: { data: [sourceRow(kinds[0])], error: null } }); expect((await loadSyncCreateWizardData(family))?.sources).toHaveLength(1); expect(calls).toContainEqual({ table: "dynamic_data_sources", method: "in", args: ["kind", [...kinds]] });
  });
  it("requires an active own LED connection before offering its source", async () => {
    const { calls } = database({ dynamic_data_sources: { data: [sourceRow("ledscores")], error: null }, ledscores_connections: { data: [], error: null } }); const result = await loadSyncCreateWizardData("scoreboard"); expect(result?.sources).toEqual([]); expect(calls).toContainEqual({ table: "ledscores_connections", method: "eq", args: ["tenant_id", tenant] }); expect(calls).toContainEqual({ table: "ledscores_connections", method: "eq", args: ["status", "active"] });
  });
  it("manual-only permission reads no connected source/template/connection", async () => {
    mocks.session.mockResolvedValue({ ...session(), capabilities: ["tenant.studio.create"] }); const { client } = database(); const result = await loadSyncCreateWizardData("menu", "connected"); expect(result).toMatchObject({ canCreateManual: true, canCreateConnected: false, initialMode: "manual", sources: [], templates: [] }); expect(client.from).not.toHaveBeenCalled(); expect(mocks.media).not.toHaveBeenCalled();
  });
  it("respects an authorized explicit manual choice when connected sources exist", async () => {
    database(); expect((await loadSyncCreateWizardData("fixtures", "manual"))?.initialMode).toBe("manual");
  });
  it.each([
    { dynamic_data_sources: { data: Array.from({ length: 201 }, () => sourceRow()), error: null } },
    { dynamic_templates: { data: Array.from({ length: 101 }, templateRow), error: null } },
    { dynamic_data_sources: { data: [sourceRow("rss")], error: null } },
    { dynamic_templates: { data: [{ ...templateRow(), current_published_version_id: null }], error: null } },
    { dynamic_data_sources: { data: null, error: { code: "42501" } } },
  ])("fails closed for incomplete or foreign-kind resource reads", async overrides => {
    database(overrides); const result = await loadSyncCreateWizardData("fixtures"); expect(result?.loadError).toBeTruthy(); expect(result?.sources).toEqual([]); expect(result?.templates).toEqual([]);
  });
  it("exposes only verified own image references and keeps photo errors recoverable", async () => {
    database(); mocks.media.mockResolvedValue({ assets: [{ id: id(8), kind: "image", title: "Eigen foto", checksumSha256: "a".repeat(64), sourceUrl: "https://private.invalid/transient" }, { id: id(9), kind: "image", title: "Ongeverifieerd", sourceUrl: "https://private.invalid/transient" }, { id: id(10), kind: "video", checksumSha256: "b".repeat(64), sourceUrl: "https://private.invalid/transient" }], error: "photo read failed" });
    const result = await loadSyncCreateWizardData("welcome"); expect(result?.images).toEqual([{ id: id(8), title: "Eigen foto", checksumSha256: "a".repeat(64), url: "https://private.invalid/transient" }]); expect(result?.loadError).toContain("foto's"); expect(result?.canCreateManual).toBe(true);
  });
  it("uses the actual tenant theme choice and frozen saved defaults without a mutation", async () => {
    const { client, themeModel } = database();
    const saved = { accent: "#bAc123", font: "Georgia", mode: "dark", scale: 119, background: "stadium", motion: "geen", showLogo: false };
    client.rpc.mockResolvedValue({ data: { ...themeModel, defaultThemeId: "onzetrots-tv", profiles: [themeModel.profiles[0], { themeId: "onzetrots-tv", themeVersion: "11.0.0", revision: 12, configured: true, defaults: saved }] }, error: null });
    const result = await loadSyncCreateWizardData("fixtures");
    expect(result?.themeDefaultsError).toBeNull(); expect(result?.initialPresentation).toMatchObject({ theme: "onzetrots-tv", rendererVersion:"sync-onzetrots-v9",sourceRevision:"5ba52a657d6d16ad103ba2fb43b8db18aa83715a",visual:{schemaVersion:1,mode:"dark",scrollSpeed:"normal",panelOpacity:94},style: { accent: "#bAc123", font: "Serif", fontChanged: true, background: "clubmuur", scale: 119, motion: "geen", showLogo: false } });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("read_sync_theme_creation_defaults_v1", { p_tenant_id: tenant });
    expect(result?.initialPresentation.rows).toEqual([]); expect(result?.initialPresentation.home).toBeUndefined();
  });
  it("uses real Source beginvalues only for explicitly unset profiles", async () => {
    database(); const result = await loadSyncCreateWizardData("welcome");
    expect(result?.themeDefaults?.profiles[0]).toMatchObject({ configured: false, defaults: null, revision: 0 });
    expect(result?.initialPresentation).toMatchObject({ theme: "fieldflow", style: { accent: "#006D83", font: "Manrope", fontChanged: true, scale: 100, background: "light", motion: "rustig", showLogo: true } });
  });
  it("keeps an unknown historic default choice explicitly null while choosing a fresh FieldFlow example", async () => {
    const { client, themeModel } = database(); client.rpc.mockResolvedValue({ data: { ...themeModel, defaultThemeId: null }, error: null });
    const result = await loadSyncCreateWizardData("welcome"); expect(result?.themeDefaults?.defaultThemeId).toBeNull(); expect(result?.initialPresentation.theme).toBe("fieldflow");
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["foreign", "corrupt", "transport"])("shows an explicit defaults failure instead of claiming a safe starter: %s", async reason => {
    const { client, themeModel } = database(); client.rpc.mockResolvedValue({ data: reason === "foreign" ? { ...themeModel, tenantId: id(9) } : reason === "corrupt" ? {} : null, error: reason === "transport" ? { code: "XX000" } : null });
    const result = await loadSyncCreateWizardData("fixtures"); expect(result?.themeDefaultsError).toBeTruthy(); expect(result?.themeDefaults).toBeUndefined();
  });
});
