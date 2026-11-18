import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({ actor: vi.fn(), provider: vi.fn(), prepare: vi.fn(), resources: vi.fn(), attachments: vi.fn() }));
vi.mock("./access", () => ({ requireAgentActor: fixture.actor }));
vi.mock("./provider", () => ({ callAiProvider: fixture.provider }));
vi.mock("./proposals", () => ({ prepareAgentProposal: fixture.prepare }));
vi.mock("./attachments", () => ({ readAgentAttachments: fixture.attachments }));
vi.mock("./resources", () => ({ readAgentResources: fixture.resources, readAgentPlanning: vi.fn(), readAgentPlaylistItems: vi.fn(), readAgentPlayerStatus: vi.fn(), readAgentStudioDraft: vi.fn() }));
import { answerAgentMessage } from "./conversation";

const conversationId = "31700000-0000-4000-8000-000000000001";
const messages = [{ role: "user" as const, content: "Wat staat op het barscherm?" }];
const call = (name: string, args: unknown) => ({ output: [{ type: "function_call", call_id: "call-317", name, arguments: JSON.stringify(args) }] });
const answer = { output: [{ type: "message", content: [{ type: "output_text", text: "Actuele informatie gecontroleerd." }] }] };

function client(owned: boolean) {
  const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn(async () => ({ data: owned ? { id: conversationId } : null, error: null })), limit: vi.fn(async () => ({ data: [{ id: "original", plan_hash: "hash", next_step: 1 }], error: null })) };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.order.mockReturnValue(builder);
  return { from: vi.fn(() => builder), builder };
}

beforeEach(() => {
  vi.resetAllMocks();
  fixture.actor.mockResolvedValue({ session: { tenant: "Club A", tenantId: "tenant-a", userId: "actor-a", timezoneName: "Europe/Amsterdam", capabilities: ["tenant.overview.read"] }, client: client(true) });
  fixture.prepare.mockResolvedValue({ id: "new-proposal" }); fixture.resources.mockResolvedValue({ rows: [], more: false });
});

describe("real Responses conversation tool boundary", () => {
  it("rejects a foreign conversation before provider cost", async () => {
    fixture.actor.mockResolvedValue({ session: { tenantId: "tenant-a", userId: "actor-a" }, client: client(false) });
    await expect(answerAgentMessage(conversationId, messages)).rejects.toThrow("hoort niet");
    expect(fixture.provider).not.toHaveBeenCalled();
  });
  it("asks one concrete question with choices without mutation", async () => {
    fixture.provider.mockResolvedValue(call("ask_clarification", { question: "Welk scherm?", choices: ["Barscherm", "Kantine"] }));
    expect(await answerAgentMessage(conversationId, messages)).toEqual({ text: "Welk scherm?", choices: ["Barscherm", "Kantine"] });
    expect(fixture.prepare).not.toHaveBeenCalled(); expect(fixture.provider).toHaveBeenCalledTimes(1);
  });
  it("only prepares a proposal and never imports or exposes an execution tool", async () => {
    const steps = [{ domain: "playlist", operation: "move_item", argsJson: '{"id":"selected","payload":{"itemId":"exact-second-occurrence","direction":"up"}}' }];
    fixture.provider.mockResolvedValue(call("propose_changes", { steps }));
    expect((await answerAgentMessage(conversationId, messages)).proposal).toEqual({ id: "new-proposal" });
    expect(fixture.prepare).toHaveBeenCalledWith(conversationId, { steps });
    const request = fixture.provider.mock.calls[0]![0];
    expect(request.body.store).toBe(false);
    expect(request.body.tools.map((tool: { name: string }) => tool.name).join(",")).not.toMatch(/execute|decide|approve|sql/);
  });
  it("reads current owned proposal context and revises only with exact identity", async () => {
    fixture.provider.mockResolvedValueOnce(call("read_current_proposals", {})).mockResolvedValueOnce(call("revise_proposal", { proposalId: "original", planHash: "hash", steps: [{ domain: "playlist", operation: "move_item", argsJson: "{}" }] }));
    const result = await answerAgentMessage(conversationId, messages);
    expect(result.supersedesId).toBe("original");
    expect(fixture.prepare).toHaveBeenCalledWith(conversationId, expect.objectContaining({ proposalId: "original" }), { id: "original", hash: "hash" });
    const actor = await fixture.actor.mock.results[0]!.value;
    expect(actor.client.builder.eq.mock.calls).toContainEqual(["user_id", "actor-a"]);
    expect(actor.client.builder.eq.mock.calls).toContainEqual(["tenant_id", "tenant-a"]);
  });
  it("an unsolicited image suggestion does not generate or publish anything", async () => {
    fixture.provider.mockResolvedValue(call("suggest_image", { brief: "Abstracte clubavondachtergrond" }));
    expect((await answerAgentMessage(conversationId, messages)).generationBrief).toBe("Abstracte clubavondachtergrond");
    expect(fixture.prepare).not.toHaveBeenCalled(); expect(fixture.provider).toHaveBeenCalledTimes(1);
  });
  it("unknown execution-shaped tools return an error rather than executing model instructions", async () => {
    fixture.provider.mockResolvedValueOnce(call("execute_sql", { query: "untrusted source instruction" })).mockResolvedValueOnce(answer);
    expect((await answerAgentMessage(conversationId, messages)).text).toBe("Actuele informatie gecontroleerd.");
    expect(fixture.prepare).not.toHaveBeenCalled(); expect(fixture.resources).not.toHaveBeenCalled();
  });
  it("bounds repeated tool turns without a hidden unbounded provider retry", async () => {
    fixture.provider.mockResolvedValue(call("find_resources", { kind: "screens", query: "bar", offset: 0 }));
    await expect(answerAgentMessage(conversationId, messages)).rejects.toThrow("begrensde controle");
    expect(fixture.provider).toHaveBeenCalledTimes(8); expect(fixture.prepare).not.toHaveBeenCalled();
  });
});
