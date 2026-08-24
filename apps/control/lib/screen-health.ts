export const screenOnlineWindowMs = 5 * 60_000;
export const screenStaleWindowMs = 30 * 60_000;

export type ScreenHealthKind =
  | "disabled"
  | "maintenance"
  | "unpaired"
  | "unknown"
  | "syncing"
  | "online"
  | "stale"
  | "offline";

export type ScreenHealth = Readonly<{
  explanation: string;
  kind: ScreenHealthKind;
  label: string;
  tone: "critical" | "info" | "success" | "warning";
}>;

export function deriveScreenHealth(
  input: Readonly<{
    activeReleaseId?: string | null;
    desiredReleaseId?: string | null;
    deviceStatus?: string | null;
    lastSeenAt?: string | null;
    screenStatus: string;
  }>,
  now = new Date()
): ScreenHealth {
  if (input.screenStatus === "disabled") {
    return health("disabled", "Uitgeschakeld", "critical", "Het scherm accepteert geen nieuwe Player- of releaseopdrachten.");
  }
  if (input.screenStatus === "maintenance") {
    return health("maintenance", "Onderhoud", "warning", "Last-known-good content blijft beschikbaar; nieuwe uitrol wacht.");
  }
  if (!input.deviceStatus || input.deviceStatus === "revoked") {
    return health("unpaired", "Niet gekoppeld", "warning", "Er is geen actieve Player-identiteit aan dit scherm gekoppeld.");
  }
  const seenAt = timestamp(input.lastSeenAt);
  if (!seenAt) {
    return health("unknown", "Status onbekend", "warning", "De gekoppelde Player heeft nog geen geldige heartbeat gestuurd.");
  }
  const age = Math.max(0, now.getTime() - seenAt);
  if (age >= screenStaleWindowMs) {
    return health("offline", "Offline", "critical", "De laatste heartbeat is ouder dan dertig minuten; lokale content kan nog spelen.");
  }
  if (age >= screenOnlineWindowMs) {
    return health("stale", "Status verouderd", "warning", "De laatste heartbeat is ouder dan vijf minuten; gezondheid is niet bevestigd.");
  }
  if (
    input.desiredReleaseId &&
    input.desiredReleaseId !== input.activeReleaseId
  ) {
    return health("syncing", "Synchroniseren", "info", "De Player is bereikbaar en bereidt een andere immutable release voor.");
  }
  return health("online", "Online", "success", "Een recente heartbeat bevestigt de actuele Playerstatus.");
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function health(
  kind: ScreenHealthKind,
  label: string,
  tone: ScreenHealth["tone"],
  explanation: string
): ScreenHealth {
  return { explanation, kind, label, tone };
}
