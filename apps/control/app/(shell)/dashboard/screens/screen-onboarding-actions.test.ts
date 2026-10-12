import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ capability: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("../releases/data", () => ({ loadReleasePreflight: vi.fn() }));
import { createScreenOnboarding } from "./actions";

const tenant = "19170000-0000-4000-8000-000000000010", screen = "19170000-0000-4000-8000-000000000023", group = "19170000-0000-4000-8000-000000000030", release = "19170000-0000-4000-8000-000000000041", command = "19170000-0000-4000-8000-000000000090";
function form() { const data = new FormData(); for (const [key, value] of Object.entries({ name: "Kantine TV 3", groupId: group, orientation: "landscape", location: "Kantine", resolutionWidth: "1920", resolutionHeight: "1080", initialReleaseId: release, idempotencyKey: command })) data.set(key, value); return data; }
beforeEach(() => { vi.clearAllMocks(); f.capability.mockResolvedValue({ isLive: true, tenantId: tenant }); f.rpc.mockResolvedValue({ data: screen, error: null }); });

describe("Source-schermwizard wacht op de atomische tenantbevestiging", () => {
  it("stuurt scherm, huidige release en groep met één stabiel servercommand", async () => {
    await expect(createScreenOnboarding(form())).rejects.toThrow(`redirect:/dashboard/screens/new?screen=${screen}`);
    expect(f.capability).toHaveBeenCalledWith("tenant.screen.manage", "mutate"); expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledWith("create_screen_onboarding_v2", { p_tenant_id: tenant, p_name: "Kantine TV 3", p_location: "Kantine", p_orientation: "landscape", p_resolution_width: 1920, p_resolution_height: 1080, p_initial_release_id: release, p_group_id: group, p_idempotency_key: command });
    expect(f.revalidate).toHaveBeenCalledWith(`/dashboard/screens/${screen}`);
  });
  it("houdt dezelfde sleutel bij een identieke retry en laat optionele content leeg", async () => {
    const data = form(); data.set("initialReleaseId", ""); data.set("groupId", "");
    await expect(createScreenOnboarding(data)).rejects.toThrow("screen="); await expect(createScreenOnboarding(data)).rejects.toThrow("screen=");
    expect(f.rpc.mock.calls[0]![1]).toMatchObject({ p_group_id: null, p_initial_release_id: null, p_idempotency_key: command }); expect(f.rpc.mock.calls[1]![1]).toEqual(f.rpc.mock.calls[0]![1]);
  });
  it("weigert ongeldige doel-ID's en ontbrekende retry-ID vóór de mutatie", async () => {
    for (const key of ["groupId", "initialReleaseId", "idempotencyKey"]) { const data = form(); data.set(key, "invalid"); await expect(createScreenOnboarding(data)).rejects.toThrow("fout="); }
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("claimt geen succes op een ontbrekende of vreemde receipt", async () => {
    for (const data of [null, "not-a-uuid", { screenId: screen }]) { f.rpc.mockResolvedValue({ data, error: null }); await expect(createScreenOnboarding(form())).rejects.toThrow("fout="); }
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("houdt autorisatie vóór ieder databasecommand", async () => {
    f.capability.mockRejectedValue(new Error("forbidden")); await expect(createScreenOnboarding(form())).rejects.toThrow("forbidden"); expect(f.rpc).not.toHaveBeenCalled(); expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("vertaalt een geweigerde groep/limiet naar een veilige fout zonder succesredirect", async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private backend detail" } }); await expect(createScreenOnboarding(form())).rejects.toThrow("fout="); expect(f.revalidate).not.toHaveBeenCalled();
  });
});
