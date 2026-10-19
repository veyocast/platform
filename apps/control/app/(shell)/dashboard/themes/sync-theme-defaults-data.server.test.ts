import { describe, expect, it, vi } from "vitest";
import type { Capability } from "@veyocast/auth";
vi.mock("server-only", () => ({}));
import { canReadSyncThemeCreationDefaults, loadSyncThemeCreationDefaults } from "./sync-theme-defaults-data.server";

const tenantId = "23500000-0000-4000-8000-000000000001";
const model = () => ({ schemaVersion: 1, tenantId, defaultThemeId: "fieldflow", profiles: [
  { themeId: "fieldflow", themeVersion: "1.0.0", revision: 0, configured: false, defaults: null },
  { themeId: "onzetrots-tv", themeVersion: "11.0.0", revision: 0, configured: false, defaults: null },
] });
describe("bounded safe Source defaults reader", () => {
  it.each(["tenant.settings.read", "tenant.settings.manage", "tenant.studio.read", "tenant.studio.create", "tenant.dynamic_slide.read", "tenant.dynamic_slide.write"] as const)("accepts exactly the existing %s read capability", capability => {
    expect(canReadSyncThemeCreationDefaults([capability])).toBe(true);
  });
  it.each(([[], ["tenant.media.read"], ["tenant.sponsor.write"], ["tenant.overview.read"]] as Capability[][]).map(capabilities => ({ capabilities })))("does not infer new author rights from $capabilities", ({ capabilities }) => {
    expect(canReadSyncThemeCreationDefaults(capabilities)).toBe(false);
  });
  it("uses only one bounded tenant RPC and keeps null defaults explicitly unconfigured", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: model(), error: null });
    expect(await loadSyncThemeCreationDefaults({ rpc }, tenantId)).toEqual({ ok: true, value: model() });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_sync_theme_creation_defaults_v1", { p_tenant_id: tenantId });
  });
  it.each(["foreign-tenant", "duplicate", "wrong-version", "missing", "unexpected-palette", "null", "transport", "throw"])("never silently substitutes a starter for %s", async reason => {
    const value = model();
    if (reason === "foreign-tenant") value.tenantId = "23500000-0000-4000-8000-000000000009";
    if (reason === "duplicate") value.profiles[1] = value.profiles[0]!;
    if (reason === "wrong-version") value.profiles[1]!.themeVersion = "1.0.0";
    if (reason === "missing") value.profiles.pop();
    if (reason === "unexpected-palette") Object.assign(value, { appearance: {} });
    const rpc = vi.fn().mockResolvedValue({ data: reason === "null" ? null : value, error: reason === "transport" ? { code: "XX000" } : null });
    if (reason === "throw") rpc.mockRejectedValue(Error("private failure must not reach UI"));
    const result = await loadSyncThemeCreationDefaults({ rpc }, tenantId);
    expect(result).toMatchObject({ ok: false, code: "unavailable", uncertain: false }); expect(JSON.stringify(result)).not.toContain("private failure");
  });
  it("rejects malformed tenant input without querying", async () => {
    const rpc = vi.fn(); expect((await loadSyncThemeCreationDefaults({ rpc }, "invalid")).ok).toBe(false); expect(rpc).not.toHaveBeenCalled();
  });
});
