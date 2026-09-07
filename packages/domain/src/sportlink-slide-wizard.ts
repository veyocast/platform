import {
  sportlinkSlideBlueprints,
  sportlinkSlideTeamContextsSchema,
  sportlinkSlideTeamSelectionSchema,
  type SportlinkArrivalConfig,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft,
  type SportlinkMatchLocation,
  type SportlinkSlideTeamSelection,
  type ThemeSelection
} from "@veyocast/contracts";

export type SportlinkWizardTeam = {
  context: SportlinkSlideContext;
  name: string;
};

export function buildSportlinkSlideDrafts(input: {
  blueprintKeys: SportlinkSlideBlueprintKey[];
  orientation: "landscape" | "portrait";
  matchLocation?: SportlinkMatchLocation;
  matchLocations?: readonly SportlinkMatchLocation[];
  templateVersionIdBySlideType: Record<string, string>;
  teamSelectionMode?: "all" | "selected";
  teams: SportlinkWizardTeam[];
  themeSelection: ThemeSelection;
}): SportlinkSlideDraft[] {
  const aggregatedArrivals = new Set<SportlinkSlideBlueprintKey>();
  const aggregatedClubSlides = new Set<string>();
  return input.teams.flatMap((team) => input.blueprintKeys.flatMap((blueprintKey) => {
    if (isClubwideMatchBlueprint(blueprintKey)) {
      const matchLocations = [...new Set(
        input.matchLocations?.length
          ? input.matchLocations
          : [input.matchLocation ?? "both"]
      )];
      return matchLocations.flatMap((matchLocation) => {
        const aggregateKey = `${blueprintKey}:${matchLocation}`;
        if (aggregatedClubSlides.has(aggregateKey)) return [];
        aggregatedClubSlides.add(aggregateKey);
        const teamContexts = input.teams.map((candidate) => ({
          ...candidate.context
        }));
        const selection: SportlinkSlideTeamSelection =
          sportlinkSlideTeamSelectionSchema.parse({
            matchLocation,
            mode: input.teamSelectionMode ?? "selected",
            teamContexts: input.teamSelectionMode === "all"
              ? teamContexts.filter((context) =>
                  context.competitionSelectionMode === "pinned"
                )
              : teamContexts
          });
        const primaryTeam = selection.teamContexts.length
          ? input.teams.find((candidate) =>
              candidate.context.providerTeamId ===
                selection.teamContexts[0]?.providerTeamId
            ) ?? team
          : team;
        return [buildDraft(
          input,
          blueprintKey,
          primaryTeam,
          undefined,
          selection,
          matchLocation
        )];
      });
    }
    if (!isArrivalBlueprint(blueprintKey)) {
      return [buildDraft(input, blueprintKey, team)];
    }
    if (aggregatedArrivals.has(blueprintKey)) return [];
    aggregatedArrivals.add(blueprintKey);
    const teamContexts = sportlinkSlideTeamContextsSchema.parse(
      input.teams.map((candidate) => ({ ...candidate.context }))
    );
    return [buildDraft(input, blueprintKey, team, teamContexts)];
  }));
}

function buildDraft(
  input: Parameters<typeof buildSportlinkSlideDrafts>[0],
  blueprintKey: SportlinkSlideBlueprintKey,
  team: SportlinkWizardTeam,
  teamContexts?: SportlinkSlideContext[],
  teamSelection?: SportlinkSlideTeamSelection,
  matchLocation?: SportlinkMatchLocation
): SportlinkSlideDraft {
  const blueprint = sportlinkSlideBlueprints[blueprintKey];
  const locationSuffix = matchLocation === "home"
    ? "Thuis"
    : matchLocation === "away"
      ? "Uit"
      : matchLocation === "both"
        ? "Thuis en uit"
        : "";
  const label = locationSuffix
    ? `${blueprint.label} · ${locationSuffix}`
    : blueprint.label;
  const templateVersionId = input.templateVersionIdBySlideType[blueprint.slideType];
  if (!templateVersionId) {
    throw new Error(`Geen template voor ${blueprint.slideType}.`);
  }
  return {
    blueprintKey,
    context: { ...team.context },
    display: {
      columns: "one",
      showDressingRoom: false,
      showField: true,
      showHomeAway: true,
      showLogo: true,
      showReferee: false
    },
    name: (teamContexts || teamSelection
      ? label
      : `${team.name} · ${blueprint.label}`).slice(0, 120),
    orientation: input.orientation,
    ...(teamContexts ? { teamContexts } : {}),
    ...(teamSelection ? { teamSelection } : {}),
    templateVersionId,
    themeSelection: input.themeSelection,
    title: label.slice(0, 160)
  };
}

function isArrivalBlueprint(blueprintKey: SportlinkSlideBlueprintKey) {
  return blueprintKey === "sportlink.visitor_arrivals" ||
    blueprintKey === "sportlink.referee_arrivals";
}

function isClubwideMatchBlueprint(blueprintKey: SportlinkSlideBlueprintKey) {
  const blueprint = sportlinkSlideBlueprints[blueprintKey];
  return blueprint.scope === "club" && (
    blueprint.slideType === "sport_program" ||
    blueprint.slideType === "sport_results"
  );
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
