import { createHash } from "node:crypto";

import type {
  SportActivity, SportClub, SportMatch, SportPersonDisplay, SportStanding,
  SportTeam, SportTeamCompetition
} from "@veyocast/contracts";

import { extractSportlinkRecords } from "./sportlink-client";

const forbiddenKeys = /email|telefoon|mobiel|adres|straat|huisnummer|postcode|bank|iban|bic|bsn|secretaris|relatiecode|identificatie/i;

export function mapSportlinkClub(payload: unknown): SportClub | null {
  const root = record(payload);
  const value = record(root.gegevens ?? root);
  const name = string(value.clubnaam);
  if (!name) return null;
  return {
    city: nullable(value.plaats),
    clubCode: nullable(value.clubcode),
    colors: { primary: null, secondary: null, text: null },
    externalId: nullable(value.clubcode) ?? stableId("club", name),
    foundedOn: dateOnly(value.oprichtingsdatum),
    information: nullable(value.informatie)?.slice(0, 4_000) ?? null,
    logoUrl: httpUrl(value.logo),
    name,
    websiteUrl: httpUrl(value.website)
  };
}

export function mapSportlinkTeams(payload: unknown): SportTeam[] {
  const teams = new Map<string, SportTeam>();

  for (const value of extractSportlinkRecords(payload)) {
    try {
      const name = string(value.teamnaam);
      const sourceId = nullable(value.teamcode) ??
        nullable(value.lokaleteamcode);
      if (!name || !sourceId) throw new Error("team_core_invalid");

      const competition = mapTeamCompetition(value);
      const existing = teams.get(sourceId);
      if (!existing) {
        teams.set(sourceId, {
          category: nullable(value.leeftijdscategorie ?? value.categorie),
          competitionName: nullable(
            value.competitienaam ?? value.competitie
          ) ?? competition?.name ?? null,
          competitionOptions: competition ? [competition] : [],
          externalId: sourceId,
          gender: nullable(value.geslacht),
          localExternalId: nullable(value.lokaleteamcode),
          logoUrl: httpUrl(value.teamlogo),
          name,
          photoUrl: httpUrl(value.teamfoto),
          teamType: nullable(value.teamsoort)
        });
        continue;
      }

      existing.category ??= nullable(
        value.leeftijdscategorie ?? value.categorie
      );
      existing.competitionName ??= nullable(
        value.competitienaam ?? value.competitie
      ) ?? competition?.name ?? null;
      existing.gender ??= nullable(value.geslacht);
      existing.localExternalId ??= nullable(value.lokaleteamcode);
      existing.logoUrl ??= httpUrl(value.teamlogo);
      existing.photoUrl ??= httpUrl(value.teamfoto);
      existing.teamType ??= nullable(value.teamsoort);
      if (
        competition &&
        !(existing.competitionOptions ?? []).some(
          (option) => option.externalId === competition.externalId
        )
      ) {
        existing.competitionOptions = [
          ...(existing.competitionOptions ?? []),
          competition
        ];
      }
    } catch {
      // One malformed row must not invalidate the complete public team feed.
    }
  }

  return [...teams.values()];
}

export function mapSportlinkMatches(
  payload: unknown,
  mode: "program" | "results" | "cancellations" = "program"
): SportMatch[] {
  return isolate(payload, (value) => {
    const externalId = nullable(value.wedstrijdcode);
    const homeName = string(value.thuisteam);
    const awayName = string(value.uitteam);
    const startsAt = dateTime(value.wedstrijddatum, value.datum, value.aanvangstijd);
    if (!externalId || !homeName || !awayName || !startsAt) {
      throw new Error("match_core_invalid");
    }
    const scores = parseScore(value.uitslag);
    const cancelled = mode === "cancellations" ||
      /afgelast|cancel/i.test(string(value.status) ?? "");
    const competition = mapMatchCompetition(value);
    return {
      awayTeam: {
        externalId: nullable(value.uitteamid ?? value.uitteamcode),
        logoUrl: httpUrl(value.uitteamlogo),
        name: awayName,
        score: scores?.[1] ?? null
      },
      cancellationReason: cancelled
        ? nullable(value.info ?? value.status) ?? "Afgelast"
        : null,
      competition,
      dressingRooms: {
        away: nullable(value.kleedkameruitteam),
        home: nullable(value.kleedkamerthuisteam),
        official: nullable(value.kleedkamerscheidsrechter)
      },
      externalId,
      homeTeam: {
        externalId: nullable(value.thuisteamid ?? value.thuisteamcode),
        logoUrl: httpUrl(value.thuisteamlogo),
        name: homeName,
        score: scores?.[0] ?? null
      },
      isHomeMatch: /thuis|home|1|ja/i.test(string(value.eigenteam ?? value.teamvolgorde) ?? ""),
      officials: splitPeople(value.scheidsrechters ?? value.scheidsrechter, "Scheidsrechter"),
      pool: mapMatchPool(value, competition?.externalId ?? null),
      startsAt,
      status: cancelled ? "cancelled" : mode === "results" ? "finished" : "scheduled",
      venue: {
        city: nullable(value.plaats),
        field: nullable(value.veld),
        name: nullable(value.accommodatie ?? value.locatie),
        routeUrl: null
      }
    };
  });
}

export function mapSportlinkStandings(
  payload: unknown,
  poolExternalId: string,
  poolName = "Competitiestand",
  periodNumber: number | null = null
): SportStanding {
  const rows = isolate(payload, (value) => {
    const teamName = string(value.team ?? value.teamnaam);
    if (!teamName) throw new Error("standing_team_invalid");
    return {
      drawn: numberOrNull(value.gelijk ?? value.gelijkspel),
      externalId: nullable(value.teamcode) ?? stableId("standing-team", teamName),
      goalsAgainst: numberOrNull(value.doelpuntentegen ?? value["doelpunten tegen"]),
      goalsFor: numberOrNull(value.doelpuntenvoor ?? value["doelpunten voor"]),
      lost: numberOrNull(value.verloren),
      played: numberOrNull(value.gespeeld ?? value["aantal wedstrijden"]),
      points: numberOrNull(value.punten ?? value.totaalpunten),
      position: numberOrNull(value.positie),
      teamName,
      won: numberOrNull(value.gewonnen)
    };
  });
  return {
    competition: null,
    externalId: stableId("standing", `${poolExternalId}:${periodNumber ?? "all"}`),
    periodNumber,
    pool: { competitionExternalId: null, externalId: poolExternalId, name: poolName },
    rows,
    scoresPublished: rows.length > 0
  };
}

export function mapSportlinkActivities(payload: unknown): SportActivity[] {
  return isolate(payload, (value) => {
    const name = string(value.activiteit);
    const startsAt = dateTime(value.datumvan, value.datumvan, null);
    if (!name || !startsAt) throw new Error("activity_core_invalid");
    return {
      allDay: /ja|true|1/i.test(string(value.heledag) ?? ""),
      calendarName: nullable(value.kalendernaam),
      endsAt: dateTime(value.datumtm, value.datumtm, null),
      externalId: stableId("activity", `${name}:${startsAt}`),
      location: nullable(value.plaats),
      name,
      startsAt,
      url: httpUrl(value.url)
    };
  });
}

export function mapPublicPeople(payload: unknown, role: string): SportPersonDisplay[] {
  return isolate(payload, (value) => {
    const displayName = string(value.volledigenaam ?? value.naam ?? value.lid);
    if (!displayName) throw new Error("person_name_invalid");
    return {
      displayName,
      externalId: null,
      photoUrl: httpUrl(value.foto ?? value.afbeelding),
      role: nullable(value.rol ?? value.functie ?? role)
    };
  });
}

export function privacyFilterSportlinkPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(privacyFilterSportlinkPayload);
  if (!payload || typeof payload !== "object") return payload;
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => !forbiddenKeys.test(key) && !/^(logo|kleinlogo)$/i.test(key))
      .map(([key, value]) => [key, privacyFilterSportlinkPayload(value)])
  );
}

export function stableSportlinkExternalId(namespace: string, ...parts: unknown[]) {
  return stableId(namespace, parts.map((value) => String(value ?? "")).join("|"));
}

function mapTeamCompetition(
  value: Record<string, unknown>
): SportTeamCompetition | null {
  const context = competitionContext(value);
  if (!context) return null;
  return {
    externalId: context.externalId,
    name: context.name,
    period: context.period,
    poolExternalId: nullable(value.poulecode),
    poolName: context.poolName,
    type: context.type
  };
}

function mapMatchCompetition(value: Record<string, unknown>) {
  const context = competitionContext(value);
  if (!context) return null;
  return {
    externalId: context.externalId,
    name: context.name,
    period: context.period,
    season: nullable(value.seizoen),
    type: context.type
  };
}

function mapMatchPool(
  value: Record<string, unknown>,
  competitionExternalId: string | null
) {
  const name = nullable(value.poule ?? value.klassepoule);
  if (!name) return null;
  return {
    competitionExternalId,
    externalId: nullable(value.poulecode) ?? stableId(
      "pool-context",
      `${competitionExternalId ?? ""}|${name}`
    ),
    name
  };
}

function competitionContext(value: Record<string, unknown>) {
  const competitionName = nullable(
    value.competitie ?? value.competitienaam
  );
  const competitionType = nullable(
    value.competitiesoort ?? value.competitietype
  );
  const period = nullable(
    value.competitieperiode ?? value.fase ?? value.klasse
  );
  const poolName = nullable(value.poule ?? value.klassepoule);
  const name = competitionName ?? competitionType ?? period ?? poolName;
  if (!name) return null;
  return {
    externalId: stableId(
      "competition-context",
      [
        competitionType ?? "",
        competitionName ?? "",
        period ?? "",
        poolName ?? ""
      ].join("|")
    ),
    name,
    period,
    poolName,
    type: competitionType
  };
}

function isolate<T>(payload: unknown, mapper: (value: Record<string, unknown>) => T) {
  return extractSportlinkRecords(payload).flatMap((value) => {
    try { return [mapper(value)]; } catch { return []; }
  });
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function string(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}
function nullable(value: unknown) { return string(value); }
function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
function httpUrl(value: unknown) {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}
function dateOnly(value: unknown) {
  const raw = string(value);
  if (!raw) return null;
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})|(\d{2})-(\d{2})-(\d{4})/);
  return match ? (match[1] ? `${match[1]}-${match[2]}-${match[3]}`
    : `${match[6]}-${match[5]}-${match[4]}`) : null;
}
function dateTime(primary: unknown, date: unknown, time: unknown) {
  const direct = string(primary);
  if (direct) {
    if (/[zZ]|[+-]\d{2}:\d{2}$/u.test(direct)) {
      const parsed = new Date(direct);
      if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
    }
    const local = direct.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/u
    );
    if (local) {
      return amsterdamWallClockToIso(
        `${local[1]}-${local[2]}-${local[3]}`,
        `${local[4] ?? "00"}:${local[5] ?? "00"}`
      );
    }
  }
  const day = dateOnly(date);
  if (!day) return null;
  const clock = string(time)?.match(/\d{1,2}:\d{2}/)?.[0] ?? "00:00";
  return amsterdamWallClockToIso(day, clock);
}
function parseScore(value: unknown): [number, number] | null {
  const match = string(value)?.match(/(\d+)\s*[-–]\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}
function splitPeople(value: unknown, role: string) {
  return (string(value) ?? "").split(/[,;]/).map((name) => name.trim())
    .filter(Boolean).slice(0, 20)
    .map((displayName) => ({ displayName, externalId: null, role }));
}
function stableId(namespace: string, value: string) {
  return createHash("sha256").update(`${namespace}\0${value}`).digest("hex");
}

function amsterdamWallClockToIso(day: string, clock: string) {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  if (![year, month, date, hour, minute].every(Number.isFinite)) return null;
  const utcGuess = Date.UTC(year!, month! - 1, date!, hour!, minute!);
  let candidate = utcGuess - timeZoneOffsetMs(utcGuess);
  candidate = utcGuess - timeZoneOffsetMs(candidate);
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function timeZoneOffsetMs(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Amsterdam",
    year: "numeric"
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return Date.UTC(
    values.year!,
    values.month! - 1,
    values.day!,
    values.hour!,
    values.minute!,
    values.second!
  ) - timestamp;
}
