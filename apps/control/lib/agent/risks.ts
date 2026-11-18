import "server-only";

import { createHash } from "node:crypto";
import type { AgentProposal } from "./catalog";

export class AgentRiskConfirmation extends Error {
  readonly risk: { hash: string; messages: string[] };
  constructor(proposal: AgentProposal, messages: string[]) {
    super("Controleer de concrete waarschuwingen hieronder. Bevestigde stappen blijven behouden; deze stap is nog niet uitgevoerd.");
    this.risk = { hash: createHash("sha256").update(JSON.stringify([proposal.id, proposal.plan_hash, proposal.next_step, messages])).digest("hex"), messages };
  }
}

export function requireRiskConfirmation(proposal: AgentProposal, messages: string[], acceptedHash: string | null) {
  if (!messages.length) return;
  const confirmation = new AgentRiskConfirmation(proposal, messages);
  if (confirmation.risk.hash !== acceptedHash) throw confirmation;
}
