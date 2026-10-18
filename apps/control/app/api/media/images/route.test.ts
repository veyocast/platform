import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), upload: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ getControlSession: f.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("../../../../lib/media/validated-image-upload", () => ({ uploadValidatedImageCandidate: f.upload, MediaUploadError: class extends Error {} }));
import { POST } from "./route";
const tenant = "19170000-0000-4000-8000-000000000010", actor = "19170000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant, userId: actor, tenantStatus: "active", capabilities: ["tenant.media.write"] });
  f.client.mockResolvedValue({});
  f.upload.mockResolvedValue({ assetId: "19170000-0000-4000-8000-000000000123", processing: false, title: "Eigen beeld" });
});
function request(scope?: string) {
  const form = new FormData(); form.set("media", new File(["image"], "eigen.png", { type: "image/png" })); form.set("title", "Eigen beeld");
  return new Request("https://control.veyocast.nl/api/media/images", { method: "POST", body: form, headers: { host: "control.veyocast.nl", origin: "https://control.veyocast.nl", ...(scope !== undefined ? { "X-VeyoCast-Actor-Scope": scope } : {}) } });
}
describe("opt-in editor upload actor binding", () => {
  it.each(["", `${tenant}:19170000-0000-4000-8000-000000000002`, `19170000-0000-4000-8000-000000000011:${actor}`, "invalid"])("rejects stale scope %s before client, formdata or upload", async scope => {
    const input = request(scope), read = vi.spyOn(input, "formData");
    const response = await POST(input);
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ ok: false, error: { code: "CONTEXT_CHANGED" } });
    expect(read).not.toHaveBeenCalled(); expect(f.client).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
  });
  it.each([undefined, `${tenant}:${actor}`])("retains the existing upload for legacy or matching scope %s", async scope => {
    const response = await POST(request(scope));
    expect(response.status).toBe(201); expect(f.upload).toHaveBeenCalledTimes(1);
    expect(f.upload.mock.calls[0]![0]).toMatchObject({ tenantId: tenant, userId: actor, title: "Eigen beeld" });
  });
});
