import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadContentLiveSport } from "./content-live-data.server";
const tenant = "12300000-0000-4000-8000-000000000001";
function database(override = {}) {
  const flag = { configuredEnabled: true, definitionAvailable: true, enabled: true, flagKey: "ledscores_realtime", killSwitchActive: false, revision: 1, tenantId: tenant, ...override };
  const calls: { method: string; args: unknown[] }[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "ilike", "filter", "order", "limit"]) query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, count: 2, data: [{ id: "original-overlay", name: "Eigen overlay", is_central_goal_overlay: false }, { id: "original-central", name: "Centrale goal", is_central_goal_overlay: true }] }).then(resolve);
  const client = { rpc: vi.fn().mockResolvedValue({ data: flag, error: null }), from: vi.fn(() => query) };
  return { client: client as unknown as NonNullable<Parameters<typeof loadContentLiveSport>[0]>, rpc: client.rpc, from: client.from, calls };
}
describe("Content retains feature-gated original LED objects", () => {
  it("does not read feature state or overlays without the original read capability", async () => {
    const db = database(); expect(await loadContentLiveSport(db.client, tenant, ["tenant.media.read"])).toMatchObject({ available: false, items: [] }); expect(db.rpc).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
  });
  it.each([{ tenantId: "other-tenant" }, { configuredEnabled: false, enabled: false }, { killSwitchActive: true, enabled: false }])("rejects foreign or disabled feature state %j", async override => {
    const db = database(override); expect(await loadContentLiveSport(db.client, tenant, ["tenant.dynamic_slide.read"])).toMatchObject({ available: false, items: [] }); expect(db.from).not.toHaveBeenCalled();
  });
  it("keeps the ordinary library usable when a feature-state transport read rejects", async () => {
    const db = database(); db.rpc.mockRejectedValue(new Error("controlled transport failure"));
    expect(await loadContentLiveSport(db.client, tenant, ["tenant.dynamic_slide.read"])).toMatchObject({ available: false, failed: true, items: [] });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("retains original editor IDs and reads no config, target or provider payload", async () => {
    const db = database(); const result = await loadContentLiveSport(db.client, tenant, ["tenant.dynamic_slide.read"], "Eigen");
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("get_ledscores_feature_effective_state_v1", { p_tenant_id: tenant });
    expect(db.calls).toContainEqual({ method: "eq", args: ["tenant_id", tenant] });
    expect(db.calls).toContainEqual({ method: "select", args: ["id,name,is_central_goal_overlay", { count: "exact" }] });
    expect(result.items.map(item => item.href)).toEqual(["/dashboard/studio/led-scores?edit=original-overlay", "/dashboard/studio/led-scores/goal-overlay"]);
  });
  it("reads only the flag for the chooser and does not invent an archived overlay editor", async () => {
    const db = database(); expect((await loadContentLiveSport(db.client, tenant, ["tenant.dynamic_slide.read"], "", false, false)).available).toBe(true);
    await loadContentLiveSport(db.client, tenant, ["tenant.dynamic_slide.read"], "", true); expect(db.from).not.toHaveBeenCalled();
  });
});
