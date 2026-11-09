export const screenOnlineWindowMs = 5 * 60_000;
export const screenStaleWindowMs = 30 * 60_000;

export type ScreenContactKind = "online" | "stale" | "offline" | "unknown";
export type ScreenStatusKind = ScreenContactKind | "disabled" | "maintenance" | "unpaired";
export type ScreenStatusTone = "critical" | "info" | "success" | "warning";

const presentation = {
  disabled: ["Uitgeschakeld", "critical", "Het scherm is uitgeschakeld. Een offline Player verwerkt dit zodra de verbinding terugkomt."],
  maintenance: ["Onderhoud", "warning", "Het scherm staat in onderhoud. Laatst geldige lokale inhoud kan blijven spelen."],
  unpaired: ["Niet gekoppeld", "warning", "Er is geen actieve Player aan dit scherm gekoppeld."],
  unknown: ["Status onbekend", "warning", "Er is geen geldige heartbeat. Controleer ook de apparaatklok."],
  online: ["Online", "success", "De laatste geldige heartbeat is minder dan vijf minuten oud."],
  stale: ["Status verouderd", "warning", "De laatste heartbeat is minstens vijf en minder dan dertig minuten oud."],
  offline: ["Offline", "critical", "De laatste heartbeat is minstens dertig minuten oud. Geldige lokale inhoud kan nog spelen."]
} as const;

/** One clock, with no implicit tolerance for timestamps from the future. */
export function validScreenTimestamp(value: string | null | undefined, now: number): number | null {
  if (!value || !Number.isFinite(now)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(value)) return null;
  const year = Number(value.slice(0,4)), month = Number(value.slice(5,7)), day = Number(value.slice(8,10));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now ? parsed : null;
}

/** Contact does not assert playback, source freshness or a physical panel. */
export function deriveScreenContactStatus(input: {
  screenStatus: string;
  deviceStatus?: string | null;
  lastSeenAt?: string | null;
}, now = Date.now()) {
  const seen = validScreenTimestamp(input.lastSeenAt, now);
  const ageMs = seen === null ? null : now - seen;
  const contact: ScreenContactKind = ageMs === null ? "unknown"
    : ageMs < screenOnlineWindowMs ? "online"
    : ageMs < screenStaleWindowMs ? "stale" : "offline";
  const kind: ScreenStatusKind = input.screenStatus === "disabled" ? "disabled"
    : input.screenStatus === "maintenance" ? "maintenance"
    : input.deviceStatus !== "paired" ? "unpaired" : contact;
  const [label, tone, explanation] = presentation[kind];
  return { kind, label, tone, explanation, contact, ageMs,
    lastSeenAt: seen === null ? null : input.lastSeenAt!,
    reachable: kind === "online" };
}
