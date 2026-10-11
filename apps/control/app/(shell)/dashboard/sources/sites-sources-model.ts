import { ledScoresConnectionHealth } from "../data-sources/led-scores/connection-health";
import { sportlinkConnectionStatus, type SportlinkPolicyHealthInput } from "../data-sources/sportlink/sportlink-status";

export type SourceOverviewHealth = { label: string; tone: "critical" | "info" | "neutral" | "success" | "warning" };
export type SourceOverviewRow = {
  id: string; name: string; kind: string; status: string; provider_status: string;
  last_successful_sync_at: string | null; last_error_code: string | null;
  refreshMinutes: number | null;
};
export type SourceOverviewCard = {
  id: "sportlink" | "led" | "twelve" | "youtube";
  health: SourceOverviewHealth; detail: string; connectionCount: number;
};
export type SourceOverviewData = { cards: SourceOverviewCard[]; sources: SourceOverviewRow[]; failed: boolean };
export type SourceOverviewLedConnection = {
  status: string; health_status: string; last_connected_at: string | null;
  last_source_message_at: string | null; lease_expires_at: string | null;
};
const severity = { critical: 5, warning: 4, info: 3, neutral: 2, success: 1 } as const;
export function worstSourceOverviewHealth(states: readonly SourceOverviewHealth[]): SourceOverviewHealth {
  return [...states].sort((a, b) => severity[b.tone] - severity[a.tone])[0]
    ?? { label: "Nog niet ingesteld", tone: "neutral" };
}
export function sourceOverviewHealth(source: SourceOverviewRow, now = Date.now()): SourceOverviewHealth {
  if (source.status === "paused") return { label: "Gepauzeerd", tone: "neutral" };
  if (source.status === "error" || source.provider_status === "error" || source.last_error_code) return { label: "Laatste sync mislukt", tone: "critical" };
  if (source.provider_status === "syncing") return { label: "Synchroniseren", tone: "info" };
  if (source.kind === "twelve_excel") return { label: "Excel-import", tone: "neutral" };
  if (source.kind === "manual_products") return { label: "Handmatig beheer", tone: "neutral" };
  if (source.provider_status !== "ready" || !source.last_successful_sync_at) return { label: "Wacht op synchronisatie", tone: "warning" };
  const success = Date.parse(source.last_successful_sync_at);
  if (!Number.isFinite(success) || success > now + 300_000) return { label: "Status onbekend", tone: "warning" };
  if (source.refreshMinutes && success + source.refreshMinutes * 120_000 <= now) return { label: "Gegevens verouderd", tone: "warning" };
  return { label: "Gereed", tone: "success" };
}
export function sourceOverviewSportlinkHealth(
  connection: { status: string; last_error_code: string | null } | null,
  policies: SportlinkPolicyHealthInput[], failed = false, now = Date.now()
): SourceOverviewHealth {
  return failed ? { label: "Status onbekend", tone: "warning" }
    : sportlinkConnectionStatus(connection, policies, now);
}
export function sourceOverviewLedHealth(connections: SourceOverviewLedConnection[], now = Date.now()): SourceOverviewHealth {
  return worstSourceOverviewHealth(connections.map(connection => ledScoresConnectionHealth({
    connectionStatus: connection.status, healthStatus: connection.health_status,
    lastConnectedAt: connection.last_connected_at, lastSourceMessageAt: connection.last_source_message_at,
    leaseExpiresAt: connection.lease_expires_at, now
  })));
}
export function sourceOverviewErrorCopy(code: string | null) {
  if (!code) return null;
  const messages: Record<string, string> = {
    rss_fetch_blocked: "De feed-URL is geblokkeerd. De laatste goede inhoud blijft bewaard. Controleer de publieke feed-URL.",
    rss_fetch_http_error: "De feedserver gaf een foutantwoord. De laatste goede inhoud blijft bewaard. Controleer de feed en probeer synchroniseren opnieuw.",
    rss_fetch_invalid_content: "De URL bevat geen geldige RSS- of Atom-feed. De laatste goede inhoud blijft bewaard. Kies de juiste feed-URL.",
    rss_fetch_too_large: "De feed overschrijdt de veilige limiet. De laatste goede inhoud blijft bewaard. Kies een kleinere feed.",
    rss_fetch_unavailable: "De feed was niet bereikbaar. De laatste goede inhoud blijft bewaard. Probeer synchroniseren opnieuw."
  };
  return messages[code] ?? "De laatste synchronisatie kon niet worden voltooid. De laatste goede inhoud blijft bewaard. Open de koppeling en controleer de bronstatus.";
}
