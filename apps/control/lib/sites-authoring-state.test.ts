import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createControlSupabaseClient: vi.fn() }));
import { loadSitesAuthoringState, parseSitesAuthoringState } from "./sites-authoring-state";
const tenant = "19136000-0000-4000-8000-000000000001";
describe("managed Sites authoring pause readback", () => {
  it("accepts only a revision-aware result for the active tenant", () => {
    expect(parseSitesAuthoringState({ tenantId: tenant, paused: true, revision: 2 }, tenant)).toEqual({ tenantId: tenant, paused: true, revision: 2 });
  });
  it.each([{tenantId:"19136000-0000-4000-8000-000000000002",paused:false,revision:2}, {tenantId:tenant,paused:"false",revision:2}, {tenantId:tenant,paused:false,revision:-1}, null])("fails closed for an invalid or cross-tenant response", input => {
    expect(parseSitesAuthoringState(input, tenant)).toBeNull();
  });
  it("uses the existing authenticated client and tenant-bounded RPC", async () => {
    const rpc = vi.fn(async () => ({error:null,data:{tenantId:tenant,paused:false,revision:0}}));
    expect(await loadSitesAuthoringState({rpc} as unknown as Parameters<typeof loadSitesAuthoringState>[0], tenant)).toEqual({tenantId:tenant,paused:false,revision:0});
    expect(rpc).toHaveBeenCalledWith("get_sites_authoring_state_v1", {p_tenant_id:tenant});
  });
  it("never treats an unavailable guard as permission to author", async () => {
    const rpc = vi.fn(async () => ({error:{code:"57014"},data:null}));
    await expect(loadSitesAuthoringState({rpc} as unknown as Parameters<typeof loadSitesAuthoringState>[0], tenant)).rejects.toThrow("authoringstatus");
  });
});
