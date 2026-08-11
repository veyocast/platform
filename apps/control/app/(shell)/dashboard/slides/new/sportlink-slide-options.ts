export type SportlinkCompetitionOption = {
  externalId: string;
  label: string;
  seasonValues: string[];
  teamExternalIds: string[];
};

export type SportlinkSeasonOption = {
  competitionExternalIds: string[];
  label: string;
  teamExternalIds: string[];
  value: string;
};

export type SportlinkTeamOption = {
  externalId: string;
  label: string;
};

export type SportlinkSlideOptions = {
  availability: SportlinkAvailabilityRecord[];
  competitions: SportlinkCompetitionOption[];
  seasons: SportlinkSeasonOption[];
  teams: SportlinkTeamOption[];
};

export type SportlinkAvailabilityRecord = {
  competitionExternalId: string | null;
  homeAway: "away" | "home" | null;
  itemCount: number;
  lastSyncedAt: string | null;
  season: string | null;
  slideType: string;
  startsAt: string | null;
  teamExternalIds: string[];
};

export type SportlinkTeamRow = {
  external_id: string;
  metadata: unknown;
  name: string;
  source_connection_id: string;
};

export type SportlinkMatchRow = {
  active?: boolean;
  away_team: unknown;
  competition: unknown;
  dressing_rooms?: unknown;
  expires_at?: string | null;
  home_team: unknown;
  is_home_match?: boolean;
  last_synced_at?: string | null;
  officials?: unknown;
  pool: unknown;
  scores_published?: boolean;
  source_connection_id: string;
  starts_at?: string;
  status?: string;
};

export type SportlinkStandingRow = {
  active?: boolean;
  last_synced_at?: string | null;
  metadata: unknown;
  period_number?: number | null;
  rows_json: unknown;
  scores_published?: boolean;
  season_key?: string;
  source_connection_id: string;
};

type MutableCompetition = {
  externalId: string;
  label: string;
  seasonValues: Set<string>;
  teamExternalIds: Set<string>;
};

type MutableSeason = {
  competitionExternalIds: Set<string>;
  label: string;
  teamExternalIds: Set<string>;
  value: string;
};

export function buildSportlinkSlideOptions({
  matches,
  now = new Date(),
  standings = [],
  teams,
  timeZoneByConnectionId = {}
}: {
  matches: SportlinkMatchRow[];
  now?: Date;
  standings?: SportlinkStandingRow[];
  teams: SportlinkTeamRow[];
  timeZoneByConnectionId?: Record<string, string>;
}): SportlinkSlideOptions {
  const teamOptions = uniqueTeams(teams, standings);
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
  const seasons = new Map<string, MutableSeason>();
  const availability: SportlinkAvailabilityRecord[] = [];
  for (const teamRow of teams) {
    const metadata = record(teamRow.metadata);
    for (const option of array(metadata?.competitionOptions)) {
      const competition = record(option);
      const externalId = text(competition?.externalId);
      if (!competition || !externalId) continue;
      addCompetition(competitions, {
        externalId,
        label: competitionLabel(competition),
        seasonValues: [text(competition.season)].filter(
          (value): value is string => Boolean(value)
        ),
        teamExternalIds: [teamRow.external_id]
      });
      addSeason(seasons, {
        competitionExternalIds: [externalId],
        teamExternalIds: [teamRow.external_id],
        value: text(competition.season)
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
      seasonValues: [text(competition.season)].filter(
        (value): value is string => Boolean(value)
      ),
      teamExternalIds
    });
    addSeason(seasons, {
      competitionExternalIds: [externalId],
      teamExternalIds,
      value: text(competition.season)
    });
    availability.push(...matchAvailability({
      competitionExternalId: externalId,
      match,
      now,
      season: text(competition.season),
      teamExternalIds: [...new Set(teamExternalIds)],
      timeZone:
        timeZoneByConnectionId[match.source_connection_id] ??
        "Europe/Amsterdam"
    }));
  }

  for (const standing of standings) {
    const metadata = record(standing.metadata);
    const competition = record(metadata?.competition);
    const pool = record(metadata?.pool);
    const externalId =
      text(competition?.externalId) ??
      text(pool?.competitionExternalId);
    const season = text(competition?.season) ?? text(metadata?.season);
    const standingTeamIds = array(standing.rows_json).flatMap((value) => {
      const row = record(value);
      const teamExternalId = text(row?.externalId);
      return teamExternalId ? [teamExternalId] : [];
    });
    if (externalId) {
      addCompetition(competitions, {
        externalId,
        label: competitionLabel(
          competition ?? { name: text(pool?.name) ?? "Competitie" },
          pool
        ),
        seasonValues: season ? [season] : [],
        teamExternalIds: standingTeamIds
      });
    }
    addSeason(seasons, {
      competitionExternalIds: externalId ? [externalId] : [],
      teamExternalIds: standingTeamIds,
      value: season
    });
    const rows = array(standing.rows_json);
    if (
      standing.active !== false &&
      standing.scores_published === true &&
      rows.length > 0
    ) {
      const standingAvailability = {
        competitionExternalId: externalId,
        homeAway: null,
        itemCount: rows.length,
        lastSyncedAt: text(standing.last_synced_at),
        season: text(standing.season_key) ?? season,
        startsAt: null,
        teamExternalIds: [...new Set(standingTeamIds)]
      } satisfies Omit<SportlinkAvailabilityRecord, "slideType">;
      availability.push({
        ...standingAvailability,
        slideType: "sport_standing"
      });
      if (standing.period_number !== null && standing.period_number !== undefined) {
        availability.push({
          ...standingAvailability,
          slideType: "sport_period_standing"
        });
      }
    }
  }

  return {
    availability,
    competitions: [...competitions.values()]
      .map((competition) => ({
        externalId: competition.externalId,
        label: competition.label,
        seasonValues: [...competition.seasonValues].sort(compareSeasons),
        teamExternalIds: [...competition.teamExternalIds].sort()
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, "nl-NL")
      ),
    seasons: [...seasons.values()]
      .map((season) => ({
        competitionExternalIds: [...season.competitionExternalIds].sort(),
        label: season.label,
        teamExternalIds: [...season.teamExternalIds].sort(),
        value: season.value
      }))
      .sort((left, right) => compareSeasons(left.value, right.value)),
    teams: teamOptions.sort((left, right) =>
      left.label.localeCompare(right.label, "nl-NL", { numeric: true })
    )
  };
}

function matchAvailability({
  competitionExternalId,
  match,
  now,
  season,
  teamExternalIds,
  timeZone
}: {
  competitionExternalId: string;
  match: SportlinkMatchRow;
  now: Date;
  season: string | null;
  teamExternalIds: string[];
  timeZone: string;
}): SportlinkAvailabilityRecord[] {
  const startsAt = validDate(match.starts_at);
  const expiresAt = validDate(match.expires_at);
  if (
    match.active === false ||
    !startsAt ||
    (expiresAt && expiresAt.getTime() <= now.getTime())
  ) {
    return [];
  }
  const status = text(match.status)?.toLowerCase() ?? "";
  const scheduled = status === "scheduled" || status === "postponed";
  const future = startsAt.getTime() >= now.getTime();
  const todayOrLater = localDateKey(startsAt, timeZone) >=
    localDateKey(now, timeZone);
  const scoresReady =
    match.scores_published !== false &&
    scoreIsPresent(match.home_team) &&
    scoreIsPresent(match.away_team);
  const dressingRooms = record(match.dressing_rooms);
  const hasDressingRooms = Boolean(
    text(dressingRooms?.home) ||
    text(dressingRooms?.away) ||
    text(dressingRooms?.official)
  );
  const hasOfficials = array(match.officials).some((candidate) => {
    const official = record(candidate);
    return Boolean(text(official?.displayName) ?? text(candidate));
  });
  const base = {
    competitionExternalId,
    homeAway: match.is_home_match === true ? "home" as const : "away" as const,
    itemCount: 1,
    lastSyncedAt: text(match.last_synced_at),
    season,
    startsAt: startsAt.toISOString(),
    teamExternalIds
  };
  const result: SportlinkAvailabilityRecord[] = [];
  if (scheduled && todayOrLater) {
    result.push({ ...base, slideType: "sport_program" });
  }
  if (status === "finished" && scoresReady) {
    result.push({ ...base, slideType: "sport_results" });
  }
  if (status === "cancelled") {
    result.push({ ...base, slideType: "sport_cancellations" });
  }
  if (scheduled && future) {
    result.push({ ...base, slideType: "sport_next_match" });
  }
  if (scheduled && todayOrLater && hasDressingRooms) {
    result.push({ ...base, slideType: "sport_dressing_rooms" });
  }
  if (scheduled && todayOrLater && hasOfficials) {
    result.push({ ...base, slideType: "sport_officials" });
  }
  if (
    scheduled &&
    localDateKey(startsAt, timeZone) === localDateKey(now, timeZone)
  ) {
    result.push({ ...base, slideType: "sport_match_of_the_day" });
  }
  return result;
}

function scoreIsPresent(value: unknown) {
  const team = record(value);
  const score = team?.score;
  return (typeof score === "number" && Number.isFinite(score)) ||
    (typeof score === "string" && /^\d+$/.test(score.trim()));
}

function validDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function localDateKey(value: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric"
    }).formatToParts(value);
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function uniqueTeams(
  teams: SportlinkTeamRow[],
  standings: SportlinkStandingRow[]
) {
  const unique = new Map<string, SportlinkTeamOption>();
  for (const team of teams) {
    const externalId = text(team.external_id);
    const label = text(team.name);
    if (externalId && label) {
      unique.set(externalId, { externalId, label });
    }
  }
  for (const standing of standings) {
    for (const value of array(standing.rows_json)) {
      const row = record(value);
      const externalId = text(row?.externalId);
      const label = text(row?.teamName);
      if (externalId && label && !unique.has(externalId)) {
        unique.set(externalId, { externalId, label });
      }
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
    seasonValues: string[];
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
    for (const season of option.seasonValues) {
      current.seasonValues.add(season);
    }
    return;
  }
  competitions.set(option.externalId, {
    externalId: option.externalId,
    label: option.label,
    seasonValues: new Set(option.seasonValues),
    teamExternalIds: new Set(option.teamExternalIds)
  });
}

function addSeason(
  seasons: Map<string, MutableSeason>,
  option: {
    competitionExternalIds: string[];
    teamExternalIds: string[];
    value: string | null;
  }
) {
  if (!option.value) return;
  const current = seasons.get(option.value);
  if (current) {
    option.competitionExternalIds.forEach((value) =>
      current.competitionExternalIds.add(value)
    );
    option.teamExternalIds.forEach((value) =>
      current.teamExternalIds.add(value)
    );
    return;
  }
  seasons.set(option.value, {
    competitionExternalIds: new Set(option.competitionExternalIds),
    label: option.value,
    teamExternalIds: new Set(option.teamExternalIds),
    value: option.value
  });
}

function compareSeasons(left: string, right: string) {
  const year = (value: string) =>
    Math.max(
      ...[...value.matchAll(/\d{4}/g)].map((match) => Number(match[0])),
      0
    );
  return year(right) - year(left) ||
    right.localeCompare(left, "nl-NL", { numeric: true });
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
