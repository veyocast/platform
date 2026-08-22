import type {
  PlayerSponsorPlacement,
  SponsorContext,
  SponsorPositionKey
} from "@veyocast/contracts";

export type SponsorSelectionHistory = Readonly<{
  campaignCounts: Readonly<Record<string, number>>;
  lastCampaignId?: string;
  lastPlayedAtByCampaign: Readonly<Record<string, string>>;
}>;

export function selectSponsorPlacement({
  context,
  history,
  now,
  placements,
  positionKey,
  seed
}: {
  context: SponsorContext;
  history: SponsorSelectionHistory;
  now: Date;
  placements: readonly PlayerSponsorPlacement[];
  positionKey: SponsorPositionKey;
  seed: string;
}): PlayerSponsorPlacement | null {
  const eligible = placements.filter((placement) =>
    placement.positionKey === positionKey &&
    matchesContext(placement.context, context) &&
    (placement.dailyCap === null ||
      (history.campaignCounts[placement.campaignId] ?? 0) < placement.dailyCap) &&
    cooldownElapsed(placement, history, now)
  );
  if (!eligible.length) return null;

  const contextScore = Math.max(...eligible.map((placement) => contextSpecificity(placement.context)));
  const scoped = eligible.filter(
    (placement) => contextSpecificity(placement.context) === contextScore
  );
  const withoutRepeat = scoped.filter(
    (placement) => placement.campaignId !== history.lastCampaignId
  );
  const candidates = withoutRepeat.length ? withoutRepeat : scoped;

  return [...candidates].sort((left, right) => {
    const leftDeficit = (history.campaignCounts[left.campaignId] ?? 0) / left.weight;
    const rightDeficit = (history.campaignCounts[right.campaignId] ?? 0) / right.weight;
    if (leftDeficit !== rightDeficit) return leftDeficit - rightDeficit;
    if (left.priority !== right.priority) return right.priority - left.priority;
    return stableHash(`${seed}:${left.campaignId}`) - stableHash(`${seed}:${right.campaignId}`);
  })[0] ?? null;
}

export function selectSponsorCreative(
  placement: PlayerSponsorPlacement,
  seed: string
) {
  if (placement.creatives.length === 1) return placement.creatives[0] ?? null;
  const index = stableHash(`${seed}:${placement.campaignId}:creative`) % placement.creatives.length;
  return placement.creatives[index] ?? null;
}

export function isSponsorPlanUsable(expiresAt: string, now = new Date()) {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now.getTime();
}

function matchesContext(required: SponsorContext, current: SponsorContext) {
  return (Object.keys(required) as Array<keyof SponsorContext>).every(
    (key) => required[key] === undefined || required[key] === current[key]
  );
}

function contextSpecificity(context: SponsorContext) {
  if (context.matchId) return 5;
  if (context.eventId) return 4;
  if (context.teamId) return 3;
  if (context.competitionId) return 2;
  return 1;
}

function cooldownElapsed(
  placement: PlayerSponsorPlacement,
  history: SponsorSelectionHistory,
  now: Date
) {
  const previous = history.lastPlayedAtByCampaign[placement.campaignId];
  if (!previous || placement.cooldownSeconds <= 0) return true;
  const previousTime = Date.parse(previous);
  return !Number.isFinite(previousTime) ||
    now.getTime() - previousTime >= placement.cooldownSeconds * 1_000;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
