import type {
  PlayerSponsorCreative,
  PlayerSponsorPlacement,
  PlayerSponsorPlan,
  SponsorPlayEvent,
  SponsorPositionKey
} from "@veyocast/contracts";

export type SponsorPlaybackSelection = Readonly<{
  creative: PlayerSponsorCreative;
  placement: PlayerSponsorPlacement;
}>;

export function selectPlayerSponsor({
  plan,
  positionKey,
  orientation,
  seed
}: {
  plan: PlayerSponsorPlan | undefined;
  positionKey: SponsorPositionKey;
  orientation?: "landscape" | "portrait";
  seed: string;
}): SponsorPlaybackSelection | null {
  if (!plan || Date.parse(plan.expiresAt) <= Date.now()) return null;
  const candidates = plan.placements.filter(
    (placement) => placement.positionKey === positionKey && placement.creatives.length &&
      (!orientation || placement.orientation === "any" || placement.orientation === orientation)
  );
  if (!candidates.length) return null;
  const placement = [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) return right.priority - left.priority;
    const leftScore = stableHash(`${seed}:${left.campaignId}`) / left.weight;
    const rightScore = stableHash(`${seed}:${right.campaignId}`) / right.weight;
    return leftScore - rightScore;
  })[0];
  if (!placement) return null;
  const creative = placement.creatives[
    stableHash(`${seed}:${placement.campaignId}:creative`) % placement.creatives.length
  ];
  return creative ? { creative, placement } : null;
}

export function appendSponsorProof(queue: readonly SponsorPlayEvent[], event: SponsorPlayEvent) {
  return [...queue.filter((item) => item.eventId !== event.eventId), event].slice(-500);
}

export function removeAcceptedSponsorProof(
  queue: readonly SponsorPlayEvent[],
  eventIds: readonly string[]
) {
  const accepted = new Set(eventIds);
  return queue.filter((event) => !accepted.has(event.eventId));
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
