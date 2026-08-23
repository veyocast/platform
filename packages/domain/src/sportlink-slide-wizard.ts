import {
  sportlinkSlideBlueprints,
  type SportlinkArrivalConfig,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft
} from "@veyocast/contracts";

export type SportlinkWizardTeam = {
  context: SportlinkSlideContext;
  name: string;
};

export function buildSportlinkSlideDrafts(input: {
  blueprintKeys: SportlinkSlideBlueprintKey[];
  orientation: "landscape" | "portrait";
  templateVersionIdBySlideType: Record<string, string>;
  teams: SportlinkWizardTeam[];
}): SportlinkSlideDraft[] {
  return input.teams.flatMap((team) => input.blueprintKeys.map((blueprintKey) => {
    const blueprint = sportlinkSlideBlueprints[blueprintKey];
    const templateVersionId = input.templateVersionIdBySlideType[blueprint.slideType];
    if (!templateVersionId) {
      throw new Error(`Geen template voor ${blueprint.slideType}.`);
    }
    return {
      blueprintKey,
      context: { ...team.context },
      name: `${team.name} · ${blueprint.label}`.slice(0, 120),
      orientation: input.orientation,
      templateVersionId,
      title: blueprint.label
    };
  }));
}

export function copySportlinkContextToTeam(
  drafts: SportlinkSlideDraft[],
  sourceDraftIndex: number,
  targetTeamId: string
) {
  const source = drafts[sourceDraftIndex];
  if (!source) return drafts;
  return drafts.map((draft) => draft.context.providerTeamId === targetTeamId
    ? { ...draft, context: { ...source.context, providerTeamId: targetTeamId } }
    : { ...draft, context: { ...draft.context } });
}

export type SportlinkArrivalMatch = {
  awayTeam: string;
  competition: string;
  dressingRoom: string;
  field: string;
  id: string;
  officialDressingRoom: string;
  officials: string[];
  startsAt: string;
};

export type SportlinkArrivalCard = {
  arrivalAt: string;
  competition: string;
  dressingRoom: string;
  field: string;
  id: string;
  kickoffAt: string;
  name: string;
  recent: boolean;
};

export function resolveSportlinkArrivalCards(input: {
  config: SportlinkArrivalConfig;
  kind: "referee" | "visitor";
  matches: SportlinkArrivalMatch[];
  now: Date;
}): SportlinkArrivalCard[] {
  const nowMs = input.now.getTime();
  const windowStart = nowMs - input.config.minutesAfter * 60_000;
  const windowEnd = nowMs + input.config.minutesBefore * 60_000;
  return input.matches.flatMap((match) => {
    const kickoff = new Date(match.startsAt);
    const kickoffMs = kickoff.getTime();
    if (!Number.isFinite(kickoffMs) || kickoffMs < windowStart || kickoffMs > windowEnd) return [];
    const arrivalAt = new Date(kickoffMs - input.config.minutesBefore * 60_000);
    const recent = nowMs - arrivalAt.getTime() <= input.config.highlightRecentMinutes * 60_000 &&
      nowMs >= arrivalAt.getTime();
    if (input.kind === "visitor") {
      return [{
        arrivalAt: arrivalAt.toISOString(), competition: match.competition,
        dressingRoom: match.dressingRoom, field: match.field, id: match.id,
        kickoffAt: kickoff.toISOString(), name: match.awayTeam, recent
      }];
    }
    return match.officials.map((name, index) => ({
      arrivalAt: arrivalAt.toISOString(), competition: match.competition,
      dressingRoom: match.officialDressingRoom, field: match.field,
      id: `${match.id}:${index}`, kickoffAt: kickoff.toISOString(), name, recent
    }));
  }).sort((left, right) => left.kickoffAt.localeCompare(right.kickoffAt));
}

export function paginateSportlinkArrivals<T>(items: T[], cardCount: number): T[][] {
  const size = Math.min(4, Math.max(1, Math.trunc(cardCount)));
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

export function interpolateSportlinkWelcome(
  template: string,
  values: { club: string; team: string }
) {
  return template
    .replaceAll("{{club}}", values.club)
    .replaceAll("{{team}}", values.team);
}
