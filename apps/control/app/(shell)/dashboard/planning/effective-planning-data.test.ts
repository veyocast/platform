import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { effectivePlanningSchema } from "@veyocast/contracts";
import { loadEffectivePlanning } from "./effective-planning-data.server";

const { rpc, client } = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: client }));
const fixture = JSON.parse(readFileSync(new URL("../../../../../../tests/fixtures/s298-effective-planning.json", import.meta.url), "utf8"));
const tenant = "29800000-0000-4000-8000-000000000010";
const screen = "29800000-0000-4000-8000-000000000040";
beforeEach(() => { vi.restoreAllMocks(); rpc.mockReset(); client.mockReset().mockResolvedValue({ rpc }); });

it("accepts the actual isolated database report and calls only the authorized read RPC", async () => {
  rpc.mockResolvedValue({ data: fixture.current, error: null });
  const result = await loadEffectivePlanning(tenant, { screenIds: [screen], at: fixture.current.evaluatedAt });
  expect(result.error).toBeNull();
  expect(result.report?.screens[0]?.winner.name).toBe("Rule 103");
  expect(result.report?.screens[0]?.next?.winner.name).toBe("Rule 102");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("preview_effective_planning_v1", {
    p_tenant_id: tenant, p_screen_ids: [screen], p_at: fixture.current.evaluatedAt,
    p_horizon_days: 8, p_proposal: null, p_default_playlist_id: null
  });
});
it.each([{ screenIds: [] }, { screenIds: [screen, screen] }, { screenIds: ["foreign-or-invalid"] }, { screenIds: Array.from({ length: 51 }, () => screen) }])("rejects an invalid or duplicate target batch before database access: %j", async ({ screenIds }) => {
  expect((await loadEffectivePlanning(tenant, { screenIds })).report).toBeNull();
  expect(client).not.toHaveBeenCalled();
});
it.each(["42501", "PT409", "PGRST202"])("retains no report on an authorization, revision or unavailable RPC error: %s", async code => {
  rpc.mockResolvedValue({ data: fixture.current, error: { code, message: "private database detail" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = await loadEffectivePlanning(tenant, { screenIds: [screen] });
  expect(result.report).toBeNull();
  expect(result.error).not.toContain("private database detail");
  expect(log).toHaveBeenCalledExactlyOnceWith("Effectieve planning niet beschikbaar", { code });
});
it("rejects an incomplete RPC projection without turning it into a usable winner", async () => {
  rpc.mockResolvedValue({ data: { ...fixture.current, screens: [{ ...fixture.current.screens[0], next: { at: "invalid" } }] }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await loadEffectivePlanning(tenant, { screenIds: [screen] })).report).toBeNull();
  expect(effectivePlanningSchema.safeParse(fixture.proposal).success).toBe(true);
});
