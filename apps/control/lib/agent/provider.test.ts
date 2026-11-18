import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSportlinkClientId } from "@veyocast/integrations/server";

vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({ adminRpc: vi.fn(), actor: vi.fn(), rpc: vi.fn() }));
vi.mock("../supabase/admin", () => ({ createControlAdminClient: () => ({ rpc: fixture.adminRpc }) }));
vi.mock("../supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: fixture.rpc }) }));
vi.mock("./access", () => ({ aiEnvironment: () => "staging", requireAgentActor: fixture.actor }));
import { callAiProvider, encryptAiKey, providerUsage, testAiProviderConnection } from "./provider";

const key = "sk-proj-synthetic-not-a-real-secret-317";
const material = "synthetic-test-material-317-at-least-thirty-two-characters";
const operationId = "31700000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SPORTLINK_CONFIG_ENCRYPTION_KEY", material);
  fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a" }, client: { rpc: fixture.rpc } });
  fixture.rpc.mockResolvedValue({ data: true, error: null });
  fixture.adminRpc.mockImplementation(async (name: string) => ({ error: null, data: name === "read_ai_provider_config_v1" ? { encryptedKey: encryptAiKey(key), chatModel: "configured-chat", imageModel: "configured-image", revision: 7 } : true }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("managed OpenAI provider boundary", () => {
  it("encrypts with domain-separated external material and randomized IVs", () => {
    const first = encryptAiKey(key), second = encryptAiKey(key);
    expect(first).not.toEqual(second);
    expect(JSON.stringify(first)).not.toContain(key);
    expect(decryptSportlinkClientId(first, `${material}:veyocast-openai-v1`)).toBe(key);
    expect(() => decryptSportlinkClientId(first, material)).toThrow();
  });
  it("rejects missing encryption material instead of persisting plaintext", () => {
    vi.stubEnv("SPORTLINK_CONFIG_ENCRYPTION_KEY", "");
    expect(() => encryptAiKey(key)).toThrow("geheimenopslag");
  });
  it.each(["", "copied chat content", "sk-short"])("rejects invalid key input", value => {
    expect(() => encryptAiKey(value)).toThrow("formaat");
  });
  it("preserves unknown versus zero units and strips prompts, costs and arbitrary metadata", () => {
    expect(providerUsage(null)).toBeNull();
    expect(providerUsage({ prompt: "private", amount: 10, output_tokens: -1 })).toBeNull();
    expect(providerUsage({ input_tokens: 0, output_tokens: 8, total_tokens: 8, input_tokens_details: { cached_tokens: 0, prompt: "private" }, price: 9 })).toEqual({ input_tokens: 0, output_tokens: 8, total_tokens: 8, input_tokens_details: { cached_tokens: 0 } });
  });
  it("admits before exactly one actual call, fixes model server-side and settles safe usage once", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ output: [], usage: { input_tokens: 0, output_tokens: 4 }, prompt: "must-not-be-in-usage" }), { headers: { "x-request-id": "req_317" } }));
    vi.stubGlobal("fetch", fetcher);
    await callAiProvider({ operationId, operation: "chat", body: { model: "client-overridden", store: false, input: "private source" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fixture.rpc.mock.invocationCallOrder[0]).toBeLessThan(fetcher.mock.invocationCallOrder[0]!);
    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(String(request.body))).toMatchObject({ model: "configured-chat", store: false });
    expect(request.redirect).toBe("error");
    const admitted = fixture.rpc.mock.calls[0]![1];
    expect(admitted).toMatchObject({ p_tenant_id: "tenant-a", p_environment: "staging", p_operation_id: operationId, p_config_revision: 7 });
    const settlement = fixture.adminRpc.mock.calls.find(call => call[0] === "finish_ai_provider_request_v1")![1];
    expect(settlement).toEqual({ p_request_id: admitted.p_request_id, p_status: "succeeded", p_provider_request_id: "req_317", p_units: { input_tokens: 0, output_tokens: 4 } });
    expect(JSON.stringify(settlement)).not.toMatch(/private|must-not|sk-proj/);
  });
  it("does not contact provider with missing key or rejected admission", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    fixture.adminRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(callAiProvider({ operationId, operation: "chat", body: {} })).rejects.toThrow("niet ingesteld");
    fixture.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(callAiProvider({ operationId, operation: "chat", body: {} })).rejects.toThrow("niet toegelaten");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("records an actual rejected attempt without leaking provider error bodies or retrying", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: `private ${key}` } }), { status: 401 })); vi.stubGlobal("fetch", fetcher);
    await expect(callAiProvider({ operationId, operation: "image_generation", body: { prompt: "private" } })).rejects.toThrow("OpenAI kon");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fixture.adminRpc).toHaveBeenLastCalledWith("finish_ai_provider_request_v1", expect.objectContaining({ p_status: "failed", p_units: null }));
  });
  it("records potentially charged timeout as unknown, not zero, with no automatic retry", async () => {
    const fetcher = vi.fn(async () => { throw Error(`network private ${key}`); }); vi.stubGlobal("fetch", fetcher);
    await expect(callAiProvider({ operationId, operation: "chat", body: {} })).rejects.toThrow("opnieuw kosten");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fixture.adminRpc).toHaveBeenLastCalledWith("finish_ai_provider_request_v1", expect.objectContaining({ p_status: "unknown", p_units: null }));
  });
  it("discards a response after tenant disable while recording its actual units", async () => {
    fixture.actor.mockResolvedValueOnce({ session: { tenantId: "tenant-a" }, client: { rpc: fixture.rpc } }).mockRejectedValueOnce(Error("disabled"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "eA==" }], usage: { total_tokens: 42 } }))));
    await expect(callAiProvider({ operationId, operation: "image_generation", body: {} })).rejects.toThrow("uitgeschakeld");
    expect(fixture.adminRpc).toHaveBeenLastCalledWith("finish_ai_provider_request_v1", expect.objectContaining({ p_status: "disabled_after_request", p_units: { total_tokens: 42, returned_images: 1 } }));
  });
  it("assigns separate request IDs to real attempts of the same operation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    await callAiProvider({ operationId, operation: "chat", body: {} });
    await callAiProvider({ operationId, operation: "chat", body: {} });
    const attempts = fixture.rpc.mock.calls.map(call => call[1]);
    expect(attempts[0].p_operation_id).toBe(attempts[1].p_operation_id);
    expect(attempts[0].p_request_id).not.toBe(attempts[1].p_request_id);
  });
  it("tests actual project model availability and rejects stale configuration settlement", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "configured-chat" }, { id: "configured-image" }] }))));
    const configuration = { encryptedKey: encryptAiKey(key), chatModel: "configured-chat", imageModel: "configured-image", revision: 7 };
    expect(await testAiProviderConnection(configuration)).toBe(true);
    fixture.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(testAiProviderConnection(configuration)).rejects.toThrow("gewijzigd");
  });
});
