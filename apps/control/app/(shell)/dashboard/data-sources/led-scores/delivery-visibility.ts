export type DeliveryStatusTone = "critical" | "info" | "neutral" | "success" | "warning";

export type GoalDeliveryRow = {
  dispatched_at: string;
  execute_at: string;
  expires_at: string;
  failed_at: string | null;
  outcome_detail: string | null;
  received_at: string | null;
  rendered_at: string | null;
  skipped_at: string | null;
  status: string;
};

export type DeliveryDisplayState = {
  key: "failed" | "pending" | "received" | "rendered" | "skipped" | "expired";
  label: string;
  occurredAt: string;
  tone: DeliveryStatusTone;
};

const knownDeliveryDetails: Record<string, string> = {
  configuration_prefetched: "Configuratie vooraf geladen",
  device_credential_removed: "Playerkoppeling was ingetrokken",
  duplicate_event_before_activation: "Dubbel event vóór weergave overgeslagen",
  execute_time_too_far: "Uitvoertijd lag te ver in de toekomst",
  execute_window_expired: "Uitvoervenster was al verlopen",
  expired_or_duplicate: "Event was verlopen of al verwerkt",
  invalid_goal_payload: "Goal Alert bevatte ongeldige gegevens",
  replaced_before_activation: "Vervangen door een nieuwere Goal Alert vóór weergave"
};

export function deliveryDisplayState(
  delivery: GoalDeliveryRow,
  now = Date.now()
): DeliveryDisplayState {
  if (delivery.failed_at || delivery.status === "failed") {
    return {
      key: "failed",
      label: "Mislukt",
      occurredAt: delivery.failed_at ?? delivery.dispatched_at,
      tone: "critical"
    };
  }
  if (delivery.skipped_at || delivery.status === "skipped") {
    return {
      key: "skipped",
      label: "Overgeslagen",
      occurredAt: delivery.skipped_at ?? delivery.dispatched_at,
      tone: "warning"
    };
  }
  if (delivery.rendered_at || delivery.status === "rendered") {
    return {
      key: "rendered",
      label: "Getoond",
      occurredAt: delivery.rendered_at ?? delivery.received_at ?? delivery.dispatched_at,
      tone: "success"
    };
  }
  if (Date.parse(delivery.expires_at) <= now) {
    const received = Boolean(delivery.received_at) || delivery.status === "received";
    return {
      key: "expired",
      label: received ? "Verlopen na ontvangst" : "Verlopen zonder ontvangst",
      occurredAt: delivery.expires_at,
      tone: "warning"
    };
  }
  if (delivery.received_at || delivery.status === "received") {
    return {
      key: "received",
      label: "Ontvangen",
      occurredAt: delivery.received_at ?? delivery.dispatched_at,
      tone: "info"
    };
  }
  return {
    key: "pending",
    label: "Klaargezet",
    occurredAt: delivery.dispatched_at,
    tone: "neutral"
  };
}

export function deliveryLatencyMs(
  delivery: GoalDeliveryRow,
  sourceObservedAt: string,
  now = Date.now()
) {
  const state = deliveryDisplayState(delivery, now);
  if (state.key === "pending" || state.key === "expired") return null;
  const sourceTime = Date.parse(sourceObservedAt);
  const outcomeTime = Date.parse(state.occurredAt);
  if (!Number.isFinite(sourceTime) || !Number.isFinite(outcomeTime)) return null;
  return Math.max(0, outcomeTime - sourceTime);
}

export function formatDeliveryLatency(value: number | null) {
  if (value === null) return null;
  if (value < 1_000) return `${value} ms`;
  if (value < 10_000) return `${(value / 1_000).toFixed(1)} sec.`;
  if (value < 60_000) return `${Math.round(value / 1_000)} sec.`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1_000);
  return `${minutes} min. ${seconds} sec.`;
}

export function safeDeliveryDetail(value: string | null) {
  if (!value) return null;
  const normalized = stripControlCharacters(value)
    .replace(/https?:\/\/\S+/gi, "[link verwijderd]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[waarde verwijderd]")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  const renderLatency = /^render_latency_ms:(\d{1,7})$/.exec(normalized);
  if (renderLatency) return `Player renderde in ${renderLatency[1]} ms`;
  if (knownDeliveryDetails[normalized]) return knownDeliveryDetails[normalized];
  return normalized.length > 140 ? `${normalized.slice(0, 139).trimEnd()}…` : normalized;
}

function stripControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("");
}

export function heartbeatDisplayState(lastSeenAt: string | null, now = Date.now()) {
  const seenAt = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
  if (!Number.isFinite(seenAt)) {
    return { key: "missing" as const, label: "Geen heartbeat", tone: "neutral" as const };
  }
  const age = Math.max(0, now - seenAt);
  if (age <= 2 * 60_000) {
    return { key: "recent" as const, label: "Recente heartbeat", tone: "success" as const };
  }
  if (age <= 15 * 60_000) {
    return { key: "stale" as const, label: "Heartbeat verouderd", tone: "warning" as const };
  }
  return { key: "old" as const, label: "Geen recente heartbeat", tone: "warning" as const };
}
