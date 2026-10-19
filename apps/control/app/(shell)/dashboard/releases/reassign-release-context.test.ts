import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ capability: vi.fn(), client: vi.fn(), detail: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantCapability: mocks.capability }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
vi.mock("./data", () => ({ loadReleaseDetail: mocks.detail }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(href); } }));
import { reassignRelease } from "./actions";

const id = (n: number) => `24300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), release = id(2), screen = id(3), nonce = id(4), foreign = id(5);
const target = (status = "ready") => ({ screen: { id: screen, status: "active" }, preflight: { status } });
function request(context: string | null = screen) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ releaseId: release, screenIds: screen, idempotencyKey: nonce, confirmImmutable: "on" })) form.set(key, value);
  if (context !== null) form.set("screenContext", context);
  return form;
}
async function result(form: FormData) {
  try { await reassignRelease(form); throw new Error("Expected canonical redirect"); }
  catch (error) { const message = (error as Error).message; if (!message.startsWith("/dashboard/")) throw error; return new URL(message, "https://fixture.invalid"); }
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.capability.mockResolvedValue({ tenantId: tenant });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.detail.mockResolvedValue({ screenStates: [target()] });
  mocks.rpc.mockResolvedValue({ data: { outcome: "reassigned", targetCount: 1 }, error: null });
});

describe("immutable reassign keeps only UI screen context", () => {
  it("preserves the exact guarded RPC body/nonce and returns to the selected screen review", async () => {
    const url = await result(request());
    expect(mocks.capability).toHaveBeenCalledExactlyOnceWith("tenant.playlist.publish", "publish");
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith(tenant, release);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reassign_playlist_release_v2", { p_idempotency_key: nonce, p_release_id: release, p_screen_ids: [screen] });
    expect(url.searchParams.get("screens")).toBe(screen);
    expect(url.searchParams.get("succes")).toContain("immutable release");
    expect(url.hash).toBe("#opnieuw-toewijzen");
    expect(mocks.revalidate.mock.calls).toEqual([["/dashboard/publications"], [`/dashboard/publications/${release}`], ["/dashboard/screens"]]);
  });
  it("retains bounded context after missing immutable confirmation without reading targets or writing", async () => {
    const form = request(); form.delete("confirmImmutable"); const url = await result(form);
    expect(url.searchParams.get("screens")).toBe(screen);
    expect(url.searchParams.get("fout")).toContain("Bevestig");
    expect(mocks.detail).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["warning", "unknown"])("requires the existing risk confirmation for %s and keeps the retry target", async status => {
    mocks.detail.mockResolvedValue({ screenStates: [target(status)] });
    const form = request(), url = await result(form);
    expect(url.searchParams.get("fout")).toContain("waarschuwingen"); expect(url.searchParams.get("screens")).toBe(screen);
    expect(mocks.rpc).not.toHaveBeenCalled();
    form.set("confirmRisk", "on"); await result(form);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reassign_playlist_release_v2", { p_idempotency_key: nonce, p_release_id: release, p_screen_ids: [screen] });
  });
  it("keeps an explicitly unavailable context empty and never submits another target", async () => {
    mocks.detail.mockResolvedValue({ screenStates: [target("blocked"), { screen: { id: foreign, status: "active" }, preflight: { status: "ready" } }] });
    const url = await result(request());
    expect(url.searchParams.has("screens")).toBe(true); expect(url.searchParams.get("screens")).toBe("");
    expect(url.searchParams.get("fout")).toContain("geblokkeerd"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("drops forged foreign redirect IDs without changing the explicitly submitted command targets", async () => {
    const url = await result(request(foreign));
    expect(url.searchParams.has("screens")).toBe(true); expect(url.searchParams.get("screens")).toBe("");
    expect(mocks.rpc.mock.calls[0]?.[1].p_screen_ids).toEqual([screen]);
  });
  it("rejects malformed or repeated hidden context without injecting redirect parameters", async () => {
    for (const value of ["https://attacker.invalid/", `${screen}&succes=forged`]) {
      const form = request(value); form.delete("confirmImmutable"); const url = await result(form);
      expect(url.pathname).toBe(`/dashboard/publications/${release}`); expect(url.searchParams.get("screens")).toBe(""); expect(url.searchParams.has("succes")).toBe(false);
    }
    const form = request(); form.append("screenContext", foreign); form.delete("confirmImmutable");
    expect((await result(form)).searchParams.get("screens")).toBe(""); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains the same context and nonce on a canonical command failure and explicit retry", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
      const form = request(), failed = await result(form); expect(failed.searchParams.get("screens")).toBe(screen); expect(failed.searchParams.get("fout")).toContain("atomair");
      await result(form); expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
    } finally { error.mockRestore(); }
  });
  it("preserves the original no-context redirect and permission rejection", async () => {
    const url = await result(request(null)); expect(url.searchParams.has("screens")).toBe(false); expect(url.hash).toBe("");
    mocks.rpc.mockClear(); mocks.capability.mockRejectedValue(new Error("forbidden"));
    await expect(reassignRelease(request())).rejects.toThrow("forbidden"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
