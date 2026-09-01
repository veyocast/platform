export type LedScoresConnectionHealth = {
  label: string;
  tone: "critical" | "info" | "neutral" | "success" | "warning";
};

type LedScoresConnectionHealthInput = {
  connectionStatus: string;
  healthStatus: string;
  lastConnectedAt: string | null;
  lastSourceMessageAt: string | null;
  leaseExpiresAt: string | null;
  now?: number;
};

export function isLedScoresProviderConnected(
  healthStatus: string,
  leaseExpiresAt: string | null,
  now = Date.now()
) {
  return healthStatus === "connected"
    && isActiveLease(leaseExpiresAt, now);
}

export function ledScoresConnectionHealth({
  connectionStatus,
  healthStatus,
  lastConnectedAt,
  lastSourceMessageAt,
  leaseExpiresAt,
  now = Date.now()
}: LedScoresConnectionHealthInput): LedScoresConnectionHealth {
  if (connectionStatus === "paused") {
    return { label: "Uitgeschakeld", tone: "neutral" };
  }
  if (healthStatus === "connected") {
    if (!isLedScoresProviderConnected(healthStatus, leaseExpiresAt, now)) {
      return { label: "Verbinding verlopen", tone: "warning" };
    }
    const connectedAt = timestamp(lastConnectedAt);
    const sourceMessageAt = timestamp(lastSourceMessageAt);
    return connectedAt !== null
      && sourceMessageAt !== null
      && sourceMessageAt >= connectedAt
      ? { label: "Verbonden", tone: "success" }
      : { label: "Verbonden · wacht op eerste bericht", tone: "info" };
  }
  if (healthStatus === "pending") {
    return { label: "Verbinden", tone: "info" };
  }
  if (healthStatus === "reconnecting" || healthStatus === "disconnected") {
    return { label: "Opnieuw verbinden", tone: "warning" };
  }
  if (healthStatus === "error") {
    return { label: "Verbindingsfout", tone: "critical" };
  }
  return { label: "Niet verbonden", tone: "neutral" };
}

function isActiveLease(leaseExpiresAt: string | null, now: number) {
  const expiresAt = timestamp(leaseExpiresAt);
  return expiresAt !== null && expiresAt > now;
}

function timestamp(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
