import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({ actor: vi.fn(), provider: vi.fn(), admin: vi.fn(), upload: vi.fn() }));
vi.mock("./access", () => ({ requireAgentActor: fixture.actor }));
vi.mock("./provider", () => ({ callAiProvider: fixture.provider }));
vi.mock("../supabase/admin", () => ({ createControlAdminClient: fixture.admin }));
vi.mock("../media/validated-image-upload", () => ({ uploadValidatedImageCandidate: fixture.upload }));
import { generateAgentImage, uploadAgentImage } from "./attachments";

function query(data: unknown, error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error })), single: vi.fn(async () => ({ data, error })) };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.is.mockReturnValue(builder);
  return builder;
}
const input = { conversationId: "31700000-0000-4000-8000-000000000001", title: "Clubposter", prompt: "Een abstracte achtergrond, geen tekst", orientation: "portrait" as const };
beforeEach(() => { vi.resetAllMocks(); });

describe("private attachment cost and replay guards", () => {
  it("checks conversation ownership before any paid generation", async () => {
    const conversation = query(null, { code: "PGRST116" });
    fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a", userId: "actor-a" }, client: { from: () => conversation } });
    await expect(generateAgentImage(input)).rejects.toThrow("geen betaalde aanvraag");
    expect(fixture.provider).not.toHaveBeenCalled(); expect(fixture.admin).not.toHaveBeenCalled();
    expect(conversation.eq.mock.calls).toContainEqual(["tenant_id", "tenant-a"]);
    expect(conversation.eq.mock.calls).toContainEqual(["user_id", "actor-a"]);
  });
  it("checks read rights as well as write rights before generation", async () => {
    fixture.actor.mockResolvedValueOnce({}).mockRejectedValueOnce(Error("Je rol mist leesrechten."));
    await expect(generateAgentImage(input)).rejects.toThrow("leesrechten");
    expect(fixture.actor.mock.calls.map(call => call[0])).toEqual(["tenant.media.write", "tenant.media.read"]);
    expect(fixture.provider).not.toHaveBeenCalled();
  });
  it("rejects foreign image edit source before downloading or calling provider", async () => {
    fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a", userId: "actor-a" }, client: { from: (table: string) => table === "ai_conversations" ? query({ id: input.conversationId }) : query(null) } });
    await expect(generateAgentImage({ ...input, referenceId: "foreign" })).rejects.toThrow("hoort niet bij");
    expect(fixture.provider).not.toHaveBeenCalled(); expect(fixture.admin).not.toHaveBeenCalled();
  });
  it("invalid generation input costs nothing", async () => {
    await expect(generateAgentImage({ ...input, prompt: "" })).rejects.toThrow("Vul");
    expect(fixture.actor).not.toHaveBeenCalled(); expect(fixture.provider).not.toHaveBeenCalled();
  });
  it.each([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]])("preserves %s edit source MIME and file extension without accepting archived files", async (mimeType, extension) => {
    const referenceId = "31700000-0000-4000-8000-000000000002";
    fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a", userId: "actor-a" }, client: { from: () => query({ id: referenceId }) } });
    const asset = query({ storage_bucket: "tenant-media", storage_path: `tenants/tenant-a/assets/${referenceId}/original/source.${extension}`, mime_type: mimeType, status: "ready", kind: "image" });
    fixture.admin.mockReturnValue({ from: () => asset, storage: { from: () => ({ download: async () => ({ data: new Blob(["synthetic source"], { type: mimeType }), error: null }) }) } });
    fixture.provider.mockRejectedValue(Error("stop_after_payload_capture"));
    await expect(generateAgentImage({ ...input, referenceId })).rejects.toThrow("stop_after_payload_capture");
    expect(asset.is).toHaveBeenCalledWith("deleted_at", null);
    const body = fixture.provider.mock.calls[0]![0].body as FormData;
    const source = body.get("image[]") as File;
    expect(source.name).toBe(`bronafbeelding.${extension}`); expect(source.type).toBe(mimeType);
  });
  it("reconciles a lost ready-upload acknowledgement without another upload or asset", async () => {
    const rpc = vi.fn(async () => ({ data: input.conversationId, error: null }));
    fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a", userId: "actor-a" }, client: { rpc } });
    const complete = vi.fn(async () => ({ data: true, error: null }));
    fixture.admin.mockReturnValue({ from: () => query({ id: input.conversationId, status: "ready" }), rpc: complete });
    const file = new File(["synthetic-bytes"], "poster.png", { type: "image/png" });
    expect(await uploadAgentImage(input.conversationId, file, "Poster", input.conversationId)).toBe(input.conversationId);
    expect(rpc).toHaveBeenCalledWith("reserve_ai_attachment_v1", expect.objectContaining({ p_attachment_id: input.conversationId, p_source_signature: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(complete).toHaveBeenCalledWith("complete_ai_attachment_v1", { p_attachment_id: input.conversationId, p_tenant_id: "tenant-a", p_actor_id: "actor-a" });
    expect(fixture.upload).not.toHaveBeenCalled();
  });
});
