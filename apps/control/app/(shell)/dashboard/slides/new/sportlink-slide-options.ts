export type SportlinkCompetitionOption = {
  externalId: string;
  label: string;
  teamExternalIds: string[];
};

export type SportlinkTeamOption = {
  externalId: string;
  label: string;
};

export type SportlinkSlideOptions = {
  competitions: SportlinkCompetitionOption[];
  teams: SportlinkTeamOption[];
};

export type SportlinkTeamRow = {
  external_id: string;
  metadata: unknown;
  name: string;
  source_connection_id: string;
};

export type SportlinkMatchRow = {
  away_team: unknown;
  competition: unknown;
  home_team: unknown;
  pool: unknown;
  source_connection_id: string;
};

type MutableCompetition = {
  externalId: string;
  label: string;
  teamExternalIds: Set<string>;
};

export function buildSportlinkSlideOptions({
  matches,
  teams
}: {
  matches: SportlinkMatchRow[];
  teams: SportlinkTeamRow[];
}): SportlinkSlideOptions {
  const teamOptions = uniqueTeams(teams);
  const teamByExternalId = new Map(
    teamOptions.map((team) => [team.externalId, team])
  );
  const teamIdsByName = new Map<string, string[]>();
  for (const team of teamOptions) {
    const key = normalizeName(team.label);
    teamIdsByName.set(key, [
      ...(teamIdsByName.get(key) ?? []),
      team.externalId
    ]);
  }

  const competitions = new Map<string, MutableCompetition>();
  for (const teamRow of teams) {
    const metadata = record(teamRow.metadata);
    for (const option of array(metadata?.competitionOptions)) {
      const competition = record(option);
      const externalId = text(competition?.externalId);
      if (!competition || !externalId) continue;
      addCompetition(competitions, {
        externalId,
        label: competitionLabel(competition),
        teamExternalIds: [teamRow.external_id]
      });
    }
  }

  for (const match of matches) {
    const competition = record(match.competition);
    const externalId = text(competition?.externalId);
    if (!competition || !externalId) continue;
    const pool = record(match.pool);
    const teamExternalIds = [
      ...resolveMatchTeamIds(
        match.home_team,
        teamByExternalId,
        teamIdsByName
      ),
      ...resolveMatchTeamIds(
        match.away_team,
        teamByExternalId,
        teamIdsByName
      )
    ];
    addCompetition(competitions, {
      externalId,
      label: competitionLabel(competition, pool),
      teamExternalIds
    });
  }

  return {
    competitions: [...competitions.values()]
      .map((competition) => ({
        externalId: competition.externalId,
        label: competition.label,
        teamExternalIds: [...competition.teamExternalIds].sort()
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, "nl-NL")
      ),
    teams: teamOptions.sort((left, right) =>
      left.label.localeCompare(right.label, "nl-NL", { numeric: true })
    )
  };
}

function uniqueTeams(teams: SportlinkTeamRow[]) {
  const unique = new Map<string, SportlinkTeamOption>();
  for (const team of teams) {
    const externalId = text(team.external_id);
    const label = text(team.name);
    if (externalId && label) {
      unique.set(externalId, { externalId, label });
    }
  }
  return [...unique.values()];
}

function resolveMatchTeamIds(
  value: unknown,
  teamByExternalId: Map<string, SportlinkTeamOption>,
  teamIdsByName: Map<string, string[]>
) {
  const team = record(value);
  const externalId = text(team?.externalId);
  if (externalId && teamByExternalId.has(externalId)) {
    return [externalId];
  }
  const name = text(team?.name);
  return name ? teamIdsByName.get(normalizeName(name)) ?? [] : [];
}

function addCompetition(
  competitions: Map<string, MutableCompetition>,
  option: {
    externalId: string;
    label: string;
    teamExternalIds: string[];
  }
) {
  const current = competitions.get(option.externalId);
  if (current) {
    if (option.label.length > current.label.length) {
      current.label = option.label;
    }
    for (const teamExternalId of option.teamExternalIds) {
      current.teamExternalIds.add(teamExternalId);
    }
    return;
  }
  competitions.set(option.externalId, {
    externalId: option.externalId,
    label: option.label,
    teamExternalIds: new Set(option.teamExternalIds)
  });
}

function competitionLabel(
  competition: Record<string, unknown>,
  pool?: Record<string, unknown> | null
) {
  const parts = [
    text(competition.type),
    text(competition.name),
    text(competition.period),
    text(pool?.name) ?? text(competition.poolName)
  ].filter((part): part is string => Boolean(part));
  const unique = parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) =>
          candidate.toLocaleLowerCase("nl-NL") ===
          part.toLocaleLowerCase("nl-NL")
      ) === index
  );
  return unique.join(" · ") || "Competitie";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-NL");
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}
