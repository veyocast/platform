import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), guard: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/control-session", () => ({ requireControlSession: mocks.session, requireTenantControlSession: mocks.guard }));
import { requireContentSession } from "./content-access.server";
beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockImplementation(async capability => ({ guardedBy: capability })); });
describe("Content entry uses existing task guards", () => {
  it.each(["tenant.media.read", "tenant.studio.read", "tenant.dynamic_slide.read", "tenant.media.write"])("keeps %s without overview access", async capability => {
    mocks.session.mockResolvedValue({ capabilities: [capability] });
    expect(await requireContentSession()).toEqual({ guardedBy: capability });
    expect(mocks.guard).toHaveBeenCalledExactlyOnceWith(capability);
  });
  it.each(["tenant.studio.create", "tenant.dynamic_slide.write"])("keeps creator %s without overview access", async capability => {
    mocks.session.mockResolvedValue({ capabilities: [capability] });
    await requireContentSession(true); expect(mocks.guard).toHaveBeenCalledExactlyOnceWith(capability);
  });
  it("delegates denial to the existing guard rather than using an unrelated overview permission", async () => {
    mocks.session.mockResolvedValue({ capabilities: ["tenant.overview.read"] });
    mocks.guard.mockRejectedValue(new Error("existing denied redirect"));
    await expect(requireContentSession(true)).rejects.toThrow("existing denied redirect");
    expect(mocks.guard).toHaveBeenCalledExactlyOnceWith("tenant.studio.create");
  });
});
