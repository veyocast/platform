import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AgentUploadTooLarge, readAgentImageFormData } from "./upload-body";

describe("agent image body admission", () => {
  it("preserves normal multipart fields and bytes", async () => {
    const form = new FormData(); form.set("conversationId", "own-conversation"); form.set("media", new File(["synthetic"], "poster.png", { type: "image/png" }));
    const parsed = await readAgentImageFormData(new Request("https://control.test/api/agent/images", { method: "POST", body: form }));
    expect(parsed.get("conversationId")).toBe("own-conversation");
    expect(await (parsed.get("media") as File).text()).toBe("synthetic");
  });
  it("bounds a chunked body without trusting Content-Length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); }, cancel });
    const request = new Request("https://control.test/api/agent/images", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readAgentImageFormData(request, 10)).rejects.toBeInstanceOf(AgentUploadTooLarge);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
