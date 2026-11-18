import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseAgentDraft, type AgentProposal } from "./catalog";
import { AgentRiskConfirmation, requireRiskConfirmation } from "./risks";

describe("immutable agent proposal inputs", () => {
  it.each([null, {}, { steps: [] }, { steps: [{ domain: "__proto__", operation: "constructor", args: {} }] }, { steps: [{ domain: "playlist", operation: "drop_table", args: {} }] }])("rejects unknown and prototype commands", input => {
    expect(() => parseAgentDraft(input)).toThrow();
  });
  it("parses a constrained provider payload without granting execution or preserving supplied authority", () => {
    const parsed = parseAgentDraft({ steps: [{ domain: "playlist", operation: "move_item", argsJson: '{"id":"playlist","payload":{"itemId":"second-occurrence","direction":"up"}}', approved: true }], tenantId: "other", approved: true });
    expect(parsed).toEqual([{ domain: "playlist", operation: "move_item", args: { id: "playlist", payload: { itemId: "second-occurrence", direction: "up" } } }]);
  });
  it("binds informed risk consent to exact proposal, step and current warnings", () => {
    const proposal = { id: "proposal", plan_hash: "immutable", next_step: 2 } as AgentProposal;
    const risk = new AgentRiskConfirmation(proposal, ["Barscherm: Player niet gekoppeld."]);
    expect(() => requireRiskConfirmation(proposal, risk.risk.messages, null)).toThrow(AgentRiskConfirmation);
    expect(() => requireRiskConfirmation(proposal, risk.risk.messages, risk.risk.hash)).not.toThrow();
    expect(() => requireRiskConfirmation({ ...proposal, next_step: 3 }, risk.risk.messages, risk.risk.hash)).toThrow();
    expect(() => requireRiskConfirmation(proposal, ["Kantine: onvoldoende bewijs."], risk.risk.hash)).toThrow();
  });
});
