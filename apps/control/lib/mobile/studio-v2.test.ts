import { describe, expect, it, vi } from "vitest";
import type { MobileRequestContext, MobileTenantContext } from "../mobile-api/context";
vi.mock("server-only", () => ({}));
vi.mock("../../app/(shell)/dashboard/studio/sites-tenant-brand", () => ({ getVerifiedSitesTenantBrandLogo: vi.fn() }));
import { loadMobileStudioV2, mutateMobileStudioV2 } from "./studio-v2";
const tenant = { id: "19136000-0000-4000-8000-000000000010", name: "Actual tenant" } as MobileTenantContext;
const key = "19136000-0000-4000-8000-000000000001";
function pausedClient(paused = true) {
  const from = vi.fn();
  const rpc = vi.fn(async () => ({ error: null, data: { tenantId: tenant.id, paused, revision: 2 } }));
  return { from, rpc };
}
const context = (client: ReturnType<typeof pausedClient>) => ({ supabase: client } as unknown as MobileRequestContext);
describe("native Sites authoring pause", () => {
  it.each(["create", "save"] as const)("blocks %s before any private data read or write", async operation => {
    const client = pausedClient();
    const input = operation === "create"
      ? { operation, templateId: "sites-v11-matchday-landscape-hd", name: "New design", idempotencyKey: key }
      : { operation, seriesId: key, expectedRevision: 1, slides: [], idempotencyKey: key };
    await expect(mutateMobileStudioV2(context(client), tenant, input)).rejects.toThrow("tijdelijk gepauzeerd");
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("get_sites_authoring_state_v1", { p_tenant_id: tenant.id });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("fails closed when the state belongs to another tenant", async () => {
    const client = pausedClient(false);
    client.rpc.mockResolvedValue({ error: null, data: { tenantId: key, paused: false, revision: 2 } });
    await expect(mutateMobileStudioV2(context(client), tenant, { operation: "create", templateId: "sites-v11-matchday-landscape-hd", name: "New design", idempotencyKey: key })).rejects.toThrow("authoringstatus");
    expect(client.from).not.toHaveBeenCalled();
  });
  it("keeps the actual paused workspace readable and acknowledges its state", async () => {
    const client = pausedClient();
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn(async () => ({ error: null, data: [], count: 0 })) };
    client.from.mockReturnValue(query);
    const workspace = await loadMobileStudioV2(context(client), tenant);
    expect(workspace).toMatchObject({ schemaVersion: 2, authoringPaused: true, total: 0, series: [] });
    expect(workspace.templates).toHaveLength(38);
    expect(query.eq).toHaveBeenCalledWith("tenant_id", tenant.id);
  });
});
