import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncThemeDefaultsCommand } from "@veyocast/contracts";
const mocks = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../../../../lib/control-session", () => ({ requireControlSession: mocks.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
import { readSyncThemeCreationDefaultsAction, saveSyncThemeCreationDefaultsAction } from "./sync-theme-defaults-actions";

const id = (n: number) => `23500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), actor = id(2), scope = `${tenant}:${actor}`;
const session = () => ({ isLive: true, tenantId: tenant, userId: actor, tenantStatus: "active", capabilities: ["tenant.settings.manage"] });
const command = (): SyncThemeDefaultsCommand => ({ tenantId: tenant, themeId: "fieldflow", expectedRevision: 4, idempotencyKey: id(3), defaults: { accent: "#aBc123", font: "Georgia", mode: "auto", scale: 112, background: "stadium", motion: "geen", showLogo: false } });
const ack = () => ({ schemaVersion: 1, tenantId: tenant, themeId: "fieldflow", revision: 5, outcome: "applied", defaults: command().defaults });
const model = () => ({ schemaVersion: 1, tenantId: tenant, defaultThemeId: null, profiles: [
  { themeId: "fieldflow", themeVersion: "1.0.0", revision: 0, configured: false, defaults: null },
  { themeId: "onzetrots-tv", themeVersion: "11.0.0", revision: 0, configured: false, defaults: null },
] });
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue(session()); mocks.client.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: ack(), error: null }); });
describe("fresh settings-only defaults command boundary", () => {
  it("sends the exact original body/nonce to the new writer, validates ACK and only revalidates creation routes", async () => {
    const original = command(), before = JSON.stringify(original); const result = await saveSyncThemeCreationDefaultsAction(original, scope);
    expect(result).toEqual({ ok: true, value: ack() }); expect(JSON.stringify(original)).toBe(before);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_sync_theme_creation_defaults_v1", { p_tenant_id: tenant, p_theme_id: original.themeId, p_expected_revision: 4, p_defaults: original.defaults, p_idempotency_key: original.idempotencyKey });
    expect(mocks.rpc.mock.calls[0]![1].p_defaults).toBe(original.defaults);
    expect(mocks.revalidate.mock.calls.map(call => call[0])).toEqual(["/dashboard/themes", "/dashboard/studio/new", "/dashboard/slides/new/sync"]);
  });
  it.each([{ isLive: false }, { tenantId: null }, { userId: null }, { userId: id(9) }, { tenantId: id(9) }, { tenantStatus: "paused" }, { tenantStatus: "archived" }, { capabilities: ["tenant.studio.create"] }, { capabilities: ["tenant.settings.read"] }])("refuses changed identity or write rights before client/RPC: %j", async change => {
    mocks.session.mockResolvedValue({ ...session(), ...change });
    expect(await saveSyncThemeCreationDefaultsAction(command(), scope)).toMatchObject({ ok: false, code: "denied", uncertain: false }); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([undefined, "", `${tenant}:${id(9)}`])("refuses a missing or stale expected actor scope %s", async value => {
    expect((await saveSyncThemeCreationDefaultsAction(command(), value as string)).ok).toBe(false); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([null, { ...command(), tenantId: id(8) }, { ...command(), defaults: { ...command().defaults, url: "https://private.invalid" } }, { ...command(), expectedRevision: -1 }, { ...command(), idempotencyKey: "bad" }])("rejects invalid/foreign commands without POST", async value => {
    expect((await saveSyncThemeCreationDefaultsAction(value, scope)).ok).toBe(false); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["tenant", "theme", "payload", "revision", "outcome", "missing", "extra"])("retains uncertainty for a malformed or mismatched receipt: %s", async reason => {
    const value = ack(); if (reason === "tenant") value.tenantId = id(8); if (reason === "theme") value.themeId = "onzetrots-tv";
    if (reason === "payload") value.defaults.scale = 113; if (reason === "revision") value.revision = 6; if (reason === "outcome") value.outcome = "noop";
    if (reason === "extra") Object.assign(value, { rolloutId: id(8) });
    mocks.rpc.mockResolvedValue({ data: reason === "missing" ? null : value, error: null });
    expect(await saveSyncThemeCreationDefaultsAction(command(), scope)).toMatchObject({ ok: false, code: "unavailable", uncertain: true }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each(["40001", "23505", "XX000"])("treats %s as uncertain without leaking backend details", async code => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } }); const result = await saveSyncThemeCreationDefaultsAction(command(), scope);
    expect(result).toMatchObject({ ok: false, code: "unavailable", uncertain: true }); expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });
  it("distinguishes an actual PT409 and never switches to the global rollout RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } }); expect(await saveSyncThemeCreationDefaultsAction(command(), scope)).toMatchObject({ ok: false, code: "conflict", uncertain: false }); expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("keeps the identical command on unknown transport and fresh permission revocation", async () => {
    const original = command(), before = JSON.stringify(original); mocks.rpc.mockRejectedValueOnce(Error("lost response"));
    expect((await saveSyncThemeCreationDefaultsAction(original, scope))).toMatchObject({ ok: false, uncertain: true });
    mocks.session.mockResolvedValue({ ...session(), capabilities: [] }); expect(await saveSyncThemeCreationDefaultsAction(original, scope)).toMatchObject({ ok: false, code: "denied" });
    expect(JSON.stringify(original)).toBe(before); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("returns a verified receipt even if secondary cache invalidation fails", async () => {
    mocks.revalidate.mockImplementation(() => { throw Error("cache"); }); expect((await saveSyncThemeCreationDefaultsAction(command(), scope)).ok).toBe(true);
  });
});
describe("fresh bounded read action", () => {
  it.each(["tenant.settings.read", "tenant.settings.manage", "tenant.studio.read", "tenant.studio.create", "tenant.dynamic_slide.read", "tenant.dynamic_slide.write"])("permits safe custom %s readers without overview permission", async capability => {
    mocks.session.mockResolvedValue({ ...session(), capabilities: [capability], tenantStatus: "paused" }); mocks.rpc.mockResolvedValue({ data: model(), error: null });
    expect(await readSyncThemeCreationDefaultsAction(scope)).toEqual({ ok: true, value: model() });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_sync_theme_creation_defaults_v1", { p_tenant_id: tenant }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([{ tenantStatus: "archived" }, { capabilities: ["tenant.sponsor.read"] }, { userId: id(9) }])("denies %j before read client", async change => {
    mocks.session.mockResolvedValue({ ...session(), ...change }); expect((await readSyncThemeCreationDefaultsAction(scope)).ok).toBe(false); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("fails explicitly for missing client and corrupt read data", async () => {
    mocks.client.mockResolvedValueOnce(null); expect(await readSyncThemeCreationDefaultsAction(scope)).toMatchObject({ ok: false, uncertain: false });
    mocks.rpc.mockResolvedValue({ data: { ...model(), tenantId: id(8) }, error: null }); expect(await readSyncThemeCreationDefaultsAction(scope)).toMatchObject({ ok: false, uncertain: false });
  });
});
