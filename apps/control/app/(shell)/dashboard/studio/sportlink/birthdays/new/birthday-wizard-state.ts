import type { SportlinkBirthdayConfiguration } from "@veyocast/contracts";

type BirthdaySelection = SportlinkBirthdayConfiguration["selection"];

export type ResolvedBirthdayTeamSelection = {
  includeWithoutTeam: boolean;
  mode: "all" | "selected";
  teamIds: string[];
};

export type BirthdayReadinessIssue =
  | "connection_missing"
  | "connection_unavailable"
  | "feature_unavailable"
  | "module_inactive"
  | "orientation_unavailable"
  | "status_unavailable"
  | "sync_missing"
  | "templates_unavailable";

export function resolveBirthdayTeamSelection(
  selection: Pick<
    BirthdaySelection,
    "includeWithoutTeam" | "selectedTeamIds" | "teamSelectionMode"
  >
): ResolvedBirthdayTeamSelection {
  const mode = selection.teamSelectionMode ?? (
    selection.selectedTeamIds.length ? "selected" : "all"
  );
  return {
    includeWithoutTeam: selection.includeWithoutTeam ?? mode === "all",
    mode,
    teamIds: [...selection.selectedTeamIds]
  };
}

export function allBirthdayTeams(): ResolvedBirthdayTeamSelection {
  return { includeWithoutTeam: true, mode: "all", teamIds: [] };
}

export function toggleBirthdayTeam(
  selection: ResolvedBirthdayTeamSelection,
  teamId: string
): ResolvedBirthdayTeamSelection {
  if (selection.mode === "all") {
    return { includeWithoutTeam: false, mode: "selected", teamIds: [teamId] };
  }
  return {
    ...selection,
    teamIds: selection.teamIds.includes(teamId)
      ? selection.teamIds.filter((candidate) => candidate !== teamId)
      : [...selection.teamIds, teamId]
  };
}

export function toggleBirthdaysWithoutTeam(
  selection: ResolvedBirthdayTeamSelection
): ResolvedBirthdayTeamSelection {
  if (selection.mode === "all") {
    return { includeWithoutTeam: true, mode: "selected", teamIds: [] };
  }
  return { ...selection, includeWithoutTeam: !selection.includeWithoutTeam };
}

export function hasBirthdayTeamSelection(selection: ResolvedBirthdayTeamSelection) {
  return selection.mode === "all" || selection.includeWithoutTeam || selection.teamIds.length > 0;
}

export function birthdayTeamSelectionLabel(
  selection: ResolvedBirthdayTeamSelection,
  teams: Array<{ external_id: string; name: string }>
) {
  if (selection.mode === "all") return "Alle teams en overige";
  const labels = selection.teamIds.flatMap((teamId) => {
    const team = teams.find((candidate) => candidate.external_id === teamId);
    return team ? [team.name] : [];
  });
  if (selection.includeWithoutTeam) labels.push("Overige (zonder team)");
  if (!labels.length) return "Nog niets geselecteerd";
  if (labels.length === 1) return labels[0];
  return `${labels.length} selecties`;
}

export function birthdayReadinessIssues({
  active,
  connectionAvailable,
  connectionLoaded,
  featureEnabled,
  hasSuccessfulSync,
  orientationAvailable,
  statusLoaded,
  templatesLoaded
}: {
  active: boolean;
  connectionAvailable: boolean;
  connectionLoaded: boolean;
  featureEnabled: boolean;
  hasSuccessfulSync: boolean;
  orientationAvailable: boolean;
  statusLoaded: boolean;
  templatesLoaded: boolean;
}): BirthdayReadinessIssue[] {
  if (!connectionLoaded) return ["connection_unavailable"];
  if (!connectionAvailable) return ["connection_missing"];
  if (!statusLoaded) return ["status_unavailable"];
  const issues: BirthdayReadinessIssue[] = [];
  if (!featureEnabled) issues.push("feature_unavailable");
  else if (!active) issues.push("module_inactive");
  else if (!hasSuccessfulSync) issues.push("sync_missing");
  if (!templatesLoaded) issues.push("templates_unavailable");
  else if (!orientationAvailable) issues.push("orientation_unavailable");
  return issues;
}
