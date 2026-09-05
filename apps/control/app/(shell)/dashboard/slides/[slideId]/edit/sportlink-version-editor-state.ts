import {
  sportlinkArrivalConfigSchema,
  sportlinkSlideBlueprints,
  sportlinkSlideTeamContextsMax,
  type SportlinkSlideBlueprintKey,
  type SportlinkSlideContext,
  type SportlinkSlideDraft
} from "@veyocast/contracts";

export type SportlinkVersionEditorTeam = {
  contexts: Array<{
    competitionId: string;
    label: string;
    phaseId: string | null;
    poolId: string | null;
    seasonId: string | null;
  }>;
  externalId: string;
  name: string;
};

export function isArrivalBlueprint(key: SportlinkSlideBlueprintKey) {
  return key === "sportlink.visitor_arrivals" ||
    key === "sportlink.referee_arrivals";
}

export function autoCompetitionContext(
  providerTeamId: string
): SportlinkSlideContext {
  return {
    competitionId: null,
    competitionSelectionMode: "auto_current",
    phaseId: null,
    poolId: null,
    providerTeamId,
    seasonId: null
  };
}

export function normalizeLegacyArrivalDraft(
  draft: SportlinkSlideDraft
): SportlinkSlideDraft {
  if (!isArrivalBlueprint(draft.blueprintKey) || draft.teamContexts) {
    return draft;
  }
  // A legacy arrival slide represented exactly one stored team. Normalizing
  // it must make that implicit selection explicit, never silently broaden it
  // to every team currently returned by Sportlink.
  const teamContexts = [{ ...draft.context }];
  return {
    ...draft,
    context: { ...teamContexts[0]! },
    teamContexts
  };
}

export function prepareSportlinkVersionEditorDraft(
  draft: SportlinkSlideDraft,
  teams: SportlinkVersionEditorTeam[],
  fieldflowThemeVersion: string
) {
  const arrivalDraft = normalizeLegacyArrivalDraft(draft);
  const ref = arrivalDraft.themeSelection.ref;
  const themeNeedsNormalization = ref.catalog !== "v2" ||
    ref.id !== "fieldflow" || ref.version !== fieldflowThemeVersion;
  const preparedDraft: SportlinkSlideDraft = themeNeedsNormalization
    ? {
        ...arrivalDraft,
        themeSelection: {
          ...arrivalDraft.themeSelection,
          ref: {
            catalog: "v2",
            id: "fieldflow",
            version: fieldflowThemeVersion
          }
        }
      }
    : arrivalDraft;
  return {
    draft: preparedDraft,
    requiresSave: arrivalDraft !== draft || themeNeedsNormalization
  } as const;
}

export function pinnedCompetitionContext(
  team: SportlinkVersionEditorTeam,
  current: SportlinkSlideContext
): SportlinkSlideContext {
  const option = team.contexts.find((candidate) =>
    candidate.competitionId === current.competitionId &&
    candidate.phaseId === current.phaseId &&
    candidate.poolId === current.poolId &&
    candidate.seasonId === current.seasonId
  ) ?? team.contexts[0];
  return option
    ? competitionContextFromOption(team.externalId, option)
    : autoCompetitionContext(team.externalId);
}

export function competitionContextFromOption(
  teamId: string,
  option: SportlinkVersionEditorTeam["contexts"][number]
): SportlinkSlideContext {
  return {
    competitionId: option.competitionId,
    competitionSelectionMode: "pinned",
    phaseId: option.phaseId,
    poolId: option.poolId,
    providerTeamId: teamId,
    seasonId: option.seasonId
  };
}

export function switchSportlinkBlueprint(
  draft: SportlinkSlideDraft,
  blueprintKey: SportlinkSlideBlueprintKey,
  templateVersionId: string
): SportlinkSlideDraft {
  const wasArrival = isArrivalBlueprint(draft.blueprintKey);
  if (isArrivalBlueprint(blueprintKey)) {
    const teamContexts = wasArrival && draft.teamContexts?.length
      ? draft.teamContexts.map((context) => ({ ...context }))
      : [{ ...draft.context }];
    return {
      ...draft,
      arrival: draft.arrival ?? sportlinkArrivalConfigSchema.parse({}),
      blueprintKey,
      context: { ...teamContexts[0]! },
      teamContexts,
      templateVersionId,
      title: sportlinkSlideBlueprints[blueprintKey].label
    };
  }

  const next = {
    ...draft,
    blueprintKey,
    context: { ...(draft.teamContexts?.[0] ?? draft.context) },
    templateVersionId,
    title: sportlinkSlideBlueprints[blueprintKey].label
  };
  delete next.arrival;
  delete next.teamContexts;
  return next;
}

export function replaceArrivalTeamSelection(
  draft: SportlinkSlideDraft,
  selectedTeamIds: string[],
  teams: SportlinkVersionEditorTeam[]
): SportlinkSlideDraft {
  const existing = new Map(
    (draft.teamContexts ?? [draft.context]).map((context) => [
      context.providerTeamId,
      context
    ])
  );
  const available = new Set(teams.map((team) => team.externalId));
  const uniqueIds = [...new Set(selectedTeamIds)].filter((teamId) =>
    available.has(teamId) || existing.has(teamId)
  ).slice(0, sportlinkSlideTeamContextsMax);
  if (!uniqueIds.length) return draft;
  const teamContexts = uniqueIds.map((teamId) => ({
    ...(existing.get(teamId) ?? autoCompetitionContext(teamId))
  }));
  return {
    ...draft,
    context: { ...teamContexts[0]! },
    teamContexts
  };
}

export function replaceArrivalTeamContext(
  draft: SportlinkSlideDraft,
  context: SportlinkSlideContext
): SportlinkSlideDraft {
  const teamContexts = (draft.teamContexts ?? [draft.context]).map((candidate) =>
    candidate.providerTeamId === context.providerTeamId
      ? { ...context }
      : { ...candidate }
  );
  return {
    ...draft,
    context: { ...teamContexts[0]! },
    teamContexts
  };
}
