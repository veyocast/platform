import {
  sportlinkArrivalConfigSchema,
  sportlinkClubAggregateBlueprintKeys,
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

export function isClubAggregateBlueprint(key: SportlinkSlideBlueprintKey) {
  return sportlinkClubAggregateBlueprintKeys.includes(
    key as (typeof sportlinkClubAggregateBlueprintKeys)[number]
  );
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

export function normalizeLegacyClubAggregateDraft(
  draft: SportlinkSlideDraft
): SportlinkSlideDraft {
  if (!isClubAggregateBlueprint(draft.blueprintKey) || draft.teamSelection) {
    return draft;
  }
  // Legacy clubprogramma's rendered club-wide already. Preserve that scope
  // while making its future-proof all-team filter explicit.
  return {
    ...draft,
    teamSelection: {
      mode: "all",
      teamContexts: []
    }
  };
}

export function prepareSportlinkVersionEditorDraft(
  draft: SportlinkSlideDraft,
  teams: SportlinkVersionEditorTeam[],
  fieldflowThemeVersion: string
) {
  const normalizedDraft = normalizeLegacyClubAggregateDraft(
    normalizeLegacyArrivalDraft(draft)
  );
  const ref = normalizedDraft.themeSelection.ref;
  const themeNeedsNormalization = ref.catalog !== "v2" ||
    ref.id !== "fieldflow" || ref.version !== fieldflowThemeVersion;
  const preparedDraft: SportlinkSlideDraft = themeNeedsNormalization
    ? {
        ...normalizedDraft,
        themeSelection: {
          ...normalizedDraft.themeSelection,
          ref: {
            catalog: "v2",
            id: "fieldflow",
            version: fieldflowThemeVersion
          }
        }
      }
    : normalizedDraft;
  return {
    draft: preparedDraft,
    requiresSave: normalizedDraft !== draft || themeNeedsNormalization
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
      : isClubAggregateBlueprint(draft.blueprintKey) &&
          draft.teamSelection?.teamContexts.length
        ? draft.teamSelection.teamContexts.map((context) => ({ ...context }))
        : [{ ...draft.context }];
    const next = {
      ...draft,
      arrival: draft.arrival ?? sportlinkArrivalConfigSchema.parse({}),
      blueprintKey,
      context: { ...teamContexts[0]! },
      teamContexts,
      templateVersionId,
      title: sportlinkSlideBlueprints[blueprintKey].label
    };
    delete next.teamSelection;
    return next;
  }

  if (isClubAggregateBlueprint(blueprintKey)) {
    const teamSelection = isClubAggregateBlueprint(draft.blueprintKey) &&
      draft.teamSelection
      ? {
          ...draft.teamSelection,
          teamContexts: draft.teamSelection.teamContexts.map((context) => ({
            ...context
          }))
        }
      : {
          mode: "selected" as const,
          teamContexts: (draft.teamContexts ?? [draft.context]).map(
            (context) => ({ ...context })
          )
        };
    const next = {
      ...draft,
      blueprintKey,
      context: { ...(teamSelection.teamContexts[0] ?? draft.context) },
      teamSelection,
      templateVersionId,
      title: sportlinkSlideBlueprints[blueprintKey].label
    };
    delete next.arrival;
    delete next.teamContexts;
    return next;
  }

  const next = {
    ...draft,
    blueprintKey,
    context: {
      ...(draft.teamContexts?.[0] ??
        draft.teamSelection?.teamContexts[0] ??
        draft.context)
    },
    templateVersionId,
    title: sportlinkSlideBlueprints[blueprintKey].label
  };
  delete next.arrival;
  delete next.teamContexts;
  delete next.teamSelection;
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

export function replaceClubTeamSelection(
  draft: SportlinkSlideDraft,
  mode: "all" | "selected",
  selectedTeamIds: string[],
  teams: SportlinkVersionEditorTeam[]
): SportlinkSlideDraft {
  const current = draft.teamSelection ?? {
    mode: "all" as const,
    teamContexts: []
  };
  const existing = new Map(current.teamContexts.map((context) => [
    context.providerTeamId,
    context
  ]));
  if (mode === "all") {
    const pinnedOverrides = current.teamContexts.filter((context) =>
      context.competitionSelectionMode === "pinned"
    );
    return {
      ...draft,
      context: { ...(pinnedOverrides[0] ?? draft.context) },
      teamSelection: { mode, teamContexts: pinnedOverrides }
    };
  }
  const available = new Set(teams.map((team) => team.externalId));
  const teamIds = [...new Set(selectedTeamIds)].filter((teamId) =>
    available.has(teamId) || existing.has(teamId)
  ).slice(0, sportlinkSlideTeamContextsMax);
  if (!teamIds.length) return draft;
  const teamContexts = teamIds.map((teamId) => ({
    ...(existing.get(teamId) ?? autoCompetitionContext(teamId))
  }));
  return {
    ...draft,
    context: { ...teamContexts[0]! },
    teamSelection: { mode, teamContexts }
  };
}

export function replaceClubTeamContext(
  draft: SportlinkSlideDraft,
  context: SportlinkSlideContext
): SportlinkSlideDraft {
  const teamSelection = draft.teamSelection ?? {
    mode: "all" as const,
    teamContexts: []
  };
  const existingIndex = teamSelection.teamContexts.findIndex((candidate) =>
    candidate.providerTeamId === context.providerTeamId
  );
  let teamContexts = teamSelection.teamContexts.map((candidate) => ({
    ...candidate
  }));
  if (
    teamSelection.mode === "all" &&
    context.competitionSelectionMode === "auto_current"
  ) {
    teamContexts = teamContexts.filter((candidate) =>
      candidate.providerTeamId !== context.providerTeamId
    );
  } else if (existingIndex >= 0) {
    teamContexts[existingIndex] = { ...context };
  } else {
    teamContexts.push({ ...context });
  }
  return {
    ...draft,
    context: { ...(teamContexts[0] ?? draft.context) },
    teamSelection: { ...teamSelection, teamContexts }
  };
}
