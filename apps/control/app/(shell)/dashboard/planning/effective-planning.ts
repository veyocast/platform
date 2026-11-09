import type { PlanningAlternative, PlanningWinner } from "@veyocast/contracts";
export { effectivePlanningSchema, type EffectivePlanningReport, type PlanningWinner, type PlanningPreviewResult, type PlanningProposal } from "@veyocast/contracts";

export function planningDecisionReason(winner: PlanningWinner, alternatives: PlanningAlternative[]) {
  if (winner.source === "default") return "Geen passende regel. De standaardinhoud geldt.";
  const other = alternatives.find(candidate => candidate.scheduleId !== winner.scheduleId);
  if (!other) return "Dit is de enige passende regel binnen de vastgelegde doelschermen.";
  if (winner.source !== other.source) return winner.source === "override"
    ? "De tijdelijke overname gaat vóór de overige planning."
    : "De Publisher-regel gaat vóór de overige planning.";
  if (winner.targetKind !== other.targetKind) return "De regel voor dit scherm gaat vóór een regel voor een groep.";
  if (winner.priority !== other.priority) return `De hogere prioriteit (${winner.priority}) is beslissend.`;
  if (winner.startsAt !== other.startsAt) return "Bij gelijke prioriteit wint het latere begintijdstip.";
  return "Bij een gelijke rang geldt de vaste volgorde van de planningsregels.";
}

export function planningSourceLabel(value: PlanningWinner["source"]) {
  return value === "override" ? "Tijdelijke overname" : value === "publisher" ? "Publisher-planning"
    : value === "default" ? "Standaardinhoud" : "Reguliere planning";
}
