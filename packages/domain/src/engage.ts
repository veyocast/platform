import type { EngageCampaignStatus } from "@veyocast/contracts";

const transitions: Readonly<Record<EngageCampaignStatus, readonly EngageCampaignStatus[]>> = {
  archived: [],
  closed: ["archived"],
  draft: ["scheduled", "live", "archived"],
  live: ["closed"],
  scheduled: ["live", "closed", "archived"]
};

export function canTransitionEngageCampaign(from: EngageCampaignStatus, to: EngageCampaignStatus) {
  return transitions[from].includes(to);
}

export function engageResultsAreVisible({
  hasVoted,
  status,
  visibility
}: {
  hasVoted: boolean;
  status: EngageCampaignStatus;
  visibility: "after_vote" | "after_close" | "live";
}) {
  if (visibility === "live") return true;
  if (visibility === "after_close") return status === "closed";
  return hasVoted || status === "closed";
}
