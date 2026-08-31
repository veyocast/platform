export const ledScoresLiveMatchSlideType = "ledscores_live_match" as const;
export const ledScoresMatchStateStorageKey =
  "veyocast-player-ledscores-match-states-v1";

const maximumStoredMatchStates = 8;
const maximumStoredMatchStateAgeMs = 7 * 24 * 60 * 60 * 1_000;
const maximumServerTimeOffsetMs = 100 * 366 * 24 * 60 * 60 * 1_000;

export type LedScoresSide = "away" | "home";
export type LedScoresOverlayKind =
  | "half_time"
  | "lineup"
  | "lineup_clear"
  | "match_end"
  | "match_start";
export type LedScoresOverlayTemplateId =
  | "final-score"
  | "matchday-impact"
  | "score-focus"
  | "team-grid";
export type LedScoresMatchStatus =
  | "finished"
  | "half_time"
  | "live"
  | "paused"
  | "pre_match"
  | "unknown";

export type LedScoresTeamViewModel = {
  logoUrl: string | null;
  name: string;
  score: number;
};

export type LedScoresPlayerViewModel = {
  id: string | null;
  name: string;
  number: string | null;
  photoUrl: string | null;
};

export type LedScoresClockAnchor = {
  anchorAt: string;
  anchorSeconds: number;
  direction: "down" | "up";
  maxSeconds: number | null;
  running: boolean;
};

export type LedScoresTimelineItem = {
  awayScore: number | null;
  clockLabel: string | null;
  homeScore: number | null;
  id: string;
  kind: "goal" | "period" | "score_correction" | "status";
  label: string;
  occurredAt: string;
  playerName: string | null;
  side: LedScoresSide | null;
};

export type LedScoresMatchState = {
  away: LedScoresTeamViewModel;
  clock: LedScoresClockAnchor | null;
  connectionId: string;
  home: LedScoresTeamViewModel;
  matchKey: string;
  periodLabel: string | null;
  revision: string;
  schemaVersion: 1;
  sequence: number | null;
  serverTimeOffsetMs: number | null;
  sourceUpdatedAt: string;
  staleAfter: string;
  status: LedScoresMatchStatus;
  timeline: LedScoresTimelineItem[];
};

export type LedScoresOverlayDesign = {
  animation: "impact" | "none" | "pulse" | "slide";
  headline: string;
  logoPosition: "center" | "left";
  logoScale: "large" | "medium" | "small";
  palette: "electric-orange" | "ink-black" | "signal-red" | "white";
  secondaryText: string;
  showClock: boolean;
  showPreviousScore: boolean;
  showScorer: boolean;
  templateId: LedScoresOverlayTemplateId;
  typography: "body" | "display";
};

export type ActiveLedScoresMatchOverlay = {
  away: LedScoresTeamViewModel;
  deliveryId: string;
  design: LedScoresOverlayDesign;
  durationMs: number;
  eventId: string;
  eventKind: "live" | "synthetic_test";
  home: LedScoresTeamViewModel;
  kind: LedScoresOverlayKind;
  lineup: LedScoresPlayerViewModel[];
  lineupPageDurationMs: number;
  matchClock: string | null;
  periodLabel: string | null;
  side: LedScoresSide | null;
  underlayPolicy: "continue" | "pause";
};

export type LedScoresGoalEnrichment = {
  deliveryId: string;
  eventId: string;
  expiresAt: string;
  executeAt: string;
  player: LedScoresPlayerViewModel;
  sequence: number;
  serverTime: string;
};

export type LedScoresLiveMatchConfig = {
  accentMode: "club" | "contrast" | "neutral";
  connectionId: string;
  fallbackState: LedScoresMatchState | null;
  outsideMatchBehavior: "last_known" | "skip";
  showClock: boolean;
  showStatus: boolean;
  showTimeline: boolean;
  template: "match_center" | "scoreboard";
  timelineLimit: number;
  title: string;
};

export function parseLedScoresMatchOverlayMessage(value: unknown) {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const payload = value.payload;
  const deliveryId = safeUuid(value.id);
  const executeAt = safeTimestamp(value.executeAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  const serverTime = safeTimestamp(value.serverTime);
  const eventId = safeUuid(payload.eventId);
  const kind = parseOverlayKind(payload.overlayKind);
  const durationMs = boundedInteger(payload.durationMs, 2_000, 30_000);
  let home = parseTeam(payload, "home");
  let away = parseTeam(payload, "away");
  if (
    !deliveryId || !executeAt || !expiresAt || !serverTime || !eventId ||
    !kind || durationMs === null || !home || !away
  ) return null;

  const ownTeamKeys = parseOwnTeamKeys(payload.ownTeamKeys);
  const configuredLogoUrl = resolveConfiguredTeamLogo(
    value.assets,
    payload.logoMediaAssetId
  );
  if (configuredLogoUrl && ownTeamKeys.has(teamKeyFor(payload, "home"))) {
    home = { ...home, logoUrl: configuredLogoUrl };
  }
  if (configuredLogoUrl && ownTeamKeys.has(teamKeyFor(payload, "away"))) {
    away = { ...away, logoUrl: configuredLogoUrl };
  }

  const side = payload.side === "home" || payload.side === "away"
    ? payload.side
    : null;
  const lineup = Array.isArray(payload.lineup)
    ? payload.lineup.slice(0, 24).flatMap((player) => {
        const parsed = parsePlayer(player);
        return parsed ? [parsed] : [];
      })
    : [];
  if (kind === "lineup" && (!side || !lineup.length)) return null;

  return {
    executeAt,
    expiresAt,
    overlay: {
      away,
      deliveryId,
      design: parseOverlayDesign(payload.design, kind),
      durationMs,
      eventId,
      eventKind: payload.eventKind === "synthetic_test"
        ? "synthetic_test" as const
        : "live" as const,
      home,
      kind,
      lineup,
      lineupPageDurationMs: boundedInteger(
        payload.lineupPageDurationMs,
        4_000,
        10_000
      ) ?? 6_000,
      matchClock: safeText(payload.matchClock, 40),
      periodLabel: safeText(payload.periodLabel, 80),
      side,
      underlayPolicy: payload.underlayPolicy === "continue"
        ? "continue" as const
        : "pause" as const
    } satisfies ActiveLedScoresMatchOverlay,
    serverTime
  };
}

export function parseLedScoresGoalEnrichmentMessage(
  value: unknown
): LedScoresGoalEnrichment | null {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const payload = value.payload;
  const player = parsePlayer(isRecord(payload.player)
    ? payload.player
    : {
        id: payload.playerId,
        name: payload.scorerName,
        number: payload.playerNumber,
        photoUrl: payload.photoUrl
      });
  const parsed = {
    deliveryId: safeUuid(value.id),
    eventId: safeUuid(payload.eventId),
    expiresAt: safeTimestamp(value.expiresAt),
    executeAt: safeTimestamp(value.executeAt),
    player,
    sequence: boundedInteger(payload.sequence ?? value.sequence, 1, Number.MAX_SAFE_INTEGER),
    serverTime: safeTimestamp(value.serverTime)
  };
  return parsed.deliveryId && parsed.eventId && parsed.expiresAt &&
    parsed.executeAt && parsed.player && parsed.sequence !== null && parsed.serverTime
    ? parsed as LedScoresGoalEnrichment
    : null;
}

export function parseLedScoresMatchStateMessage(
  value: unknown,
  clientNow = Date.now()
): LedScoresMatchState | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.state_json)
    ? value.state_json
    : isRecord(value.state)
    ? value.state
    : isRecord(value.payload)
      ? value.payload
      : value;
  if (candidate.schemaVersion !== 1) return null;
  const connectionId = safeUuid(
    candidate.connectionId ?? value.connectionId ?? value.connection_id
  );
  const matchKey = safeText(candidate.matchKey, 300);
  const rawRevision = candidate.stateRevision ?? candidate.revision ?? value.stateSequence ??
    value.state_sequence;
  const revision = typeof rawRevision === "number" &&
    Number.isSafeInteger(rawRevision) && rawRevision >= 0
    ? String(rawRevision)
    : safeText(rawRevision, 160);
  const status = parseMatchStatus(candidate.status);
  const sequence = optionalBoundedInteger(
    candidate.sequence ?? value.stateSequence ?? value.state_sequence,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const home = parseTeam(candidate, "home");
  const away = parseTeam(candidate, "away");
  const sourceUpdatedAt = safeTimestamp(
    candidate.sourceUpdatedAt ?? value.sourceObservedAt ??
      value.source_observed_at
  );
  const staleAfter = resolveStaleAfter(candidate, value, sourceUpdatedAt);
  const serverTimeOffsetMs = resolveServerTimeOffset(
    candidate,
    value,
    clientNow
  );
  if (
    !connectionId || !matchKey || !revision || !status || !home || !away ||
    !sourceUpdatedAt || !staleAfter
  ) return null;
  const clock = candidate.clock === null || candidate.clock === undefined
    ? null
    : parseClock(candidate.clock);
  if (candidate.clock !== null && candidate.clock !== undefined && !clock) return null;
  const timeline = Array.isArray(candidate.timeline)
    ? candidate.timeline.slice(0, 30).flatMap((item) => {
        const parsed = parseTimelineItem(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    away,
    clock,
    connectionId,
    home,
    matchKey,
    periodLabel: safeText(candidate.periodLabel, 80),
    revision,
    schemaVersion: 1,
    sequence,
    serverTimeOffsetMs,
    sourceUpdatedAt,
    staleAfter,
    status,
    timeline
  };
}

export function parseLedScoresLiveMatchConfig(
  value: unknown
): LedScoresLiveMatchConfig | null {
  if (!isRecord(value) || !isRecord(value.liveMatch)) return null;
  const liveMatch = value.liveMatch;
  const config = isRecord(liveMatch.configuration)
    ? liveMatch.configuration
    : liveMatch;
  const connectionId = safeUuid(liveMatch.connectionId ?? config.connectionId);
  if (!connectionId) return null;
  const fallbackState = liveMatch.state
    ? parseLedScoresMatchStateMessage({
        connectionId,
        state: liveMatch.state
      })
    : null;
  return {
    accentMode: config.accentMode === "contrast" || config.accentMode === "neutral"
      ? config.accentMode
      : "club",
    connectionId,
    fallbackState: fallbackState?.connectionId === connectionId
      ? fallbackState
      : null,
    outsideMatchBehavior: config.outsideMatchBehavior === "skip"
      ? "skip"
      : "last_known",
    showClock: config.showClock !== false,
    showStatus: config.showStatus !== false,
    showTimeline: config.showTimeline !== false,
    template: config.template === "scoreboard" ? "scoreboard" : "match_center",
    timelineLimit: boundedInteger(config.timelineLimit, 0, 10) ?? 5,
    title: safeText(config.title ?? liveMatch.connectionName, 120) ??
      "Live wedstrijd"
  };
}

export function resolveLedScoresClockSeconds(
  clock: LedScoresClockAnchor | null,
  now: number,
  staleAfter?: string | null
) {
  if (!clock) return null;
  const anchorAt = Date.parse(clock.anchorAt);
  const staleAt = staleAfter ? Date.parse(staleAfter) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(anchorAt)) return null;
  const effectiveNow = Math.min(now, Number.isFinite(staleAt) ? staleAt : now);
  const elapsed = clock.running
    ? Math.max(0, Math.floor((effectiveNow - anchorAt) / 1_000))
    : 0;
  const calculated = clock.direction === "down"
    ? clock.anchorSeconds - elapsed
    : clock.anchorSeconds + elapsed;
  const maximum = clock.maxSeconds ?? 359_999;
  return Math.max(0, Math.min(maximum, calculated));
}

export function formatLedScoresClock(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function isLedScoresMatchStateStale(
  state: LedScoresMatchState,
  now = Date.now()
) {
  return Date.parse(state.staleAfter) <= ledScoresMatchServerNow(state, now);
}

export function ledScoresMatchServerNow(
  state: Pick<LedScoresMatchState, "serverTimeOffsetMs">,
  clientNow = Date.now()
) {
  return clientNow + (state.serverTimeOffsetMs ?? 0);
}

export function chooseLatestLedScoresMatchState(
  current: LedScoresMatchState | null,
  next: LedScoresMatchState
) {
  if (!current || current.connectionId !== next.connectionId) return next;
  if (current.sequence !== null && next.sequence !== null) {
    if (next.sequence > current.sequence) return next;
    if (next.sequence < current.sequence) return current;
  }
  const currentUpdatedAt = Date.parse(current.sourceUpdatedAt);
  const nextUpdatedAt = Date.parse(next.sourceUpdatedAt);
  if (nextUpdatedAt > currentUpdatedAt) return next;
  if (nextUpdatedAt < currentUpdatedAt) return current;
  if (next.revision !== current.revision) return next;
  return next.serverTimeOffsetMs !== null &&
    next.serverTimeOffsetMs !== current.serverTimeOffsetMs
    ? next
    : current;
}

export function readStoredLedScoresMatchStates(
  storage: Pick<Storage, "getItem">,
  now = Date.now()
) {
  try {
    const raw = JSON.parse(storage.getItem(ledScoresMatchStateStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [] as LedScoresMatchState[];
    const byConnection = new Map<string, LedScoresMatchState>();
    for (const candidate of raw.slice(-maximumStoredMatchStates * 2)) {
      const state = parseLedScoresMatchStateMessage(candidate);
      if (!state || Date.parse(state.sourceUpdatedAt) <
        ledScoresMatchServerNow(state, now) - maximumStoredMatchStateAgeMs) {
        continue;
      }
      byConnection.set(
        state.connectionId,
        chooseLatestLedScoresMatchState(
          byConnection.get(state.connectionId) ?? null,
          state
        )
      );
    }
    return [...byConnection.values()].slice(-maximumStoredMatchStates);
  } catch {
    return [] as LedScoresMatchState[];
  }
}

export function writeStoredLedScoresMatchStates(
  storage: Pick<Storage, "setItem">,
  states: readonly LedScoresMatchState[]
) {
  try {
    storage.setItem(
      ledScoresMatchStateStorageKey,
      JSON.stringify(states.slice(-maximumStoredMatchStates))
    );
    return true;
  } catch {
    return false;
  }
}

function parseTeam(value: Record<string, unknown>, side: LedScoresSide) {
  const nested = isRecord(value[side]) ? value[side] : null;
  const name = safeText(nested?.name ?? value[`${side}Team`], 160);
  const score = boundedInteger(nested?.score ?? value[`${side}Score`], 0, 999);
  if (!name || score === null) return null;
  return {
    logoUrl: safeUrl(nested?.logoUrl ?? value[`${side}LogoUrl`]),
    name,
    score
  } satisfies LedScoresTeamViewModel;
}

function parseOwnTeamKeys(value: unknown) {
  const keys = new Set<string>();
  if (!Array.isArray(value)) return keys;
  for (const candidate of value.slice(0, 50)) {
    const key = normalizedTeamKey(candidate);
    if (key) keys.add(key);
  }
  return keys;
}

function teamKeyFor(value: Record<string, unknown>, side: LedScoresSide) {
  const nested = isRecord(value[side]) ? value[side] : null;
  return normalizedTeamKey(nested?.teamKey ?? value[`${side}TeamKey`]);
}

function normalizedTeamKey(value: unknown) {
  const key = safeText(value, 200);
  return key?.toLowerCase() ?? "";
}

function resolveConfiguredTeamLogo(assets: unknown, logoMediaAssetId: unknown) {
  const expectedId = safeUuid(logoMediaAssetId);
  if (!expectedId || !Array.isArray(assets)) return null;
  for (const candidate of assets.slice(0, 10)) {
    if (!isRecord(candidate) || safeUuid(candidate.mediaAssetId) !== expectedId) {
      continue;
    }
    const checksum = typeof candidate.checksum === "string" &&
      /^[a-f0-9]{64}$/.test(candidate.checksum);
    const image = typeof candidate.mimeType === "string" &&
      /^image\/(jpeg|png|webp)$/.test(candidate.mimeType);
    const url = safeUrl(candidate.url);
    if (checksum && image && url) return url;
  }
  return null;
}

function parsePlayer(value: unknown): LedScoresPlayerViewModel | null {
  if (!isRecord(value)) return null;
  const name = safeText(value.name, 160);
  if (!name) return null;
  const rawNumber = typeof value.number === "number" ? String(value.number) : value.number;
  return {
    id: safeText(value.id, 200),
    name,
    number: safeText(rawNumber, 16),
    photoUrl: safeUrl(value.photoUrl)
  };
}

function parseClock(value: unknown): LedScoresClockAnchor | null {
  if (!isRecord(value)) return null;
  const anchorAt = safeTimestamp(value.anchorAt);
  const anchorSeconds = boundedInteger(value.anchorSeconds, 0, 359_999);
  const direction = value.direction === "down" || value.direction === "up"
    ? value.direction
    : null;
  const maxSeconds = value.maxSeconds === null || value.maxSeconds === undefined
    ? null
    : boundedInteger(value.maxSeconds, 1, 359_999);
  return anchorAt && anchorSeconds !== null && direction &&
    (maxSeconds !== null || value.maxSeconds === null || value.maxSeconds === undefined)
    ? {
        anchorAt,
        anchorSeconds,
        direction,
        maxSeconds,
        running: value.running === true
      }
    : null;
}

function parseTimelineItem(value: unknown): LedScoresTimelineItem | null {
  if (!isRecord(value)) return null;
  const id = safeText(value.id, 200);
  const occurredAt = safeTimestamp(value.occurredAt);
  const kind = ["goal", "period", "score_correction", "status"].includes(
    String(value.kind)
  ) ? value.kind as LedScoresTimelineItem["kind"] : null;
  const label = safeText(value.label, 200);
  if (!id || !occurredAt || !kind || !label) return null;
  return {
    awayScore: optionalBoundedInteger(value.awayScore, 0, 999),
    clockLabel: safeText(value.clockLabel, 40),
    homeScore: optionalBoundedInteger(value.homeScore, 0, 999),
    id,
    kind,
    label,
    occurredAt,
    playerName: safeText(value.playerName, 160),
    side: value.side === "home" || value.side === "away" ? value.side : null
  };
}

function parseOverlayDesign(
  value: unknown,
  kind: LedScoresOverlayKind
): LedScoresOverlayDesign {
  const design = isRecord(value) ? value : {};
  const defaults = {
    half_time: { headline: "Rust", templateId: "score-focus" },
    lineup: { headline: "Opstelling", templateId: "team-grid" },
    lineup_clear: { headline: "Opstelling sluiten", templateId: "team-grid" },
    match_end: { headline: "Eindstand", templateId: "final-score" },
    match_start: { headline: "De wedstrijd begint", templateId: "matchday-impact" }
  } as const;
  const templateIds = ["team-grid", "matchday-impact", "score-focus", "final-score"];
  const palettes = ["electric-orange", "ink-black", "signal-red", "white"];
  const animations = ["impact", "pulse", "slide", "none"];
  const logoScales = ["small", "medium", "large"];
  return {
    animation: animations.includes(String(design.animation))
      ? design.animation as LedScoresOverlayDesign["animation"]
      : "impact",
    headline: safeText(design.headline, 80) ?? defaults[kind].headline,
    logoPosition: design.logoPosition === "center" ? "center" : "left",
    logoScale: logoScales.includes(String(design.logoScale))
      ? design.logoScale as LedScoresOverlayDesign["logoScale"]
      : "medium",
    palette: palettes.includes(String(design.palette))
      ? design.palette as LedScoresOverlayDesign["palette"]
      : "ink-black",
    secondaryText: safeText(design.secondaryText, 160) ?? "",
    showClock: kind === "lineup" ? false : design.showClock !== false,
    showPreviousScore: kind === "lineup" ? false : design.showPreviousScore === true,
    showScorer: kind === "lineup",
    templateId: templateIds.includes(String(design.templateId ?? design.template))
      ? (design.templateId ?? design.template) as LedScoresOverlayTemplateId
      : defaults[kind].templateId,
    typography: design.typography === "body" ? "body" : "display"
  };
}

function parseOverlayKind(value: unknown): LedScoresOverlayKind | null {
  return ["lineup", "lineup_clear", "match_start", "half_time", "match_end"].includes(String(value))
    ? value as LedScoresOverlayKind
    : null;
}

function resolveStaleAfter(
  candidate: Record<string, unknown>,
  envelope: Record<string, unknown>,
  sourceUpdatedAt: string | null
) {
  const timestamp = safeTimestamp(candidate.staleAfter);
  if (timestamp) return timestamp;
  const seconds = boundedInteger(
    envelope.staleAfterSeconds ?? envelope.stale_after_seconds ??
      candidate.staleAfter,
    3,
    120
  );
  const sourceObservedAt = safeTimestamp(
    envelope.sourceObservedAt ?? envelope.source_observed_at ?? sourceUpdatedAt
  );
  return seconds !== null && sourceObservedAt
    ? new Date(Date.parse(sourceObservedAt) + seconds * 1_000).toISOString()
    : null;
}

function resolveServerTimeOffset(
  candidate: Record<string, unknown>,
  envelope: Record<string, unknown>,
  clientNow: number
) {
  const serverTime = safeTimestamp(envelope.serverTime ?? candidate.serverTime);
  if (serverTime && Number.isFinite(clientNow)) {
    const measured = Date.parse(serverTime) - clientNow;
    return Math.abs(measured) <= maximumServerTimeOffsetMs ? measured : null;
  }
  const stored = candidate.serverTimeOffsetMs ?? envelope.serverTimeOffsetMs;
  return typeof stored === "number" && Number.isSafeInteger(stored) &&
    Math.abs(stored) <= maximumServerTimeOffsetMs
    ? stored
    : null;
}

function parseMatchStatus(value: unknown): LedScoresMatchStatus | null {
  return ["pre_match", "live", "paused", "half_time", "finished", "unknown"]
    .includes(String(value))
    ? value as LedScoresMatchStatus
    : null;
}

function safeUuid(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function safeTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function safeText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() && value.length <= maximum
    ? value.trim().replace(/\s+/g, " ")
    : null;
}

function safeUrl(value: unknown) {
  return typeof value === "string" && value.length <= 2_000 && /^https?:\/\//.test(value)
    ? value
    : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function optionalBoundedInteger(value: unknown, minimum: number, maximum: number) {
  return value === null || value === undefined
    ? null
    : boundedInteger(value, minimum, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
