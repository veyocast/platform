export type SloDefinition = Readonly<{
  description: string;
  id: string;
  objective: number;
  targetMs: number;
  window: "24h" | "30d";
}>;

export const sloDefinitions = [
  { description: "Uploadfinalisatie na laatste byte", id: "upload_finalization", objective: 0.99, targetMs: 10_000, window: "30d" },
  { description: "Wachttijd totdat mediaverwerking start", id: "processing_queue_wait", objective: 0.99, targetMs: 60_000, window: "30d" },
  { description: "Publicatie tot immutable release", id: "publish_duration", objective: 0.99, targetMs: 30_000, window: "30d" },
  { description: "Gewenste release tot actief op online scherm", id: "desired_to_active", objective: 0.95, targetMs: 120_000, window: "30d" },
  { description: "Heartbeat van gekoppelde online players", id: "heartbeat_freshness", objective: 0.99, targetMs: 180_000, window: "24h" },
  { description: "Playerstart tot eerste geldig frame", id: "player_startup", objective: 0.95, targetMs: 8_000, window: "30d" }
] as const satisfies readonly SloDefinition[];

export type AlertDefinition = Readonly<{
  controlPath: string;
  id: string;
  owner: "platform" | "product-support";
  runbook: string;
  threshold: Readonly<{ durationMinutes: number; operator: "<" | ">" | ">="; value: number; unit: string }>;
}>;

export const alertDefinitions = [
  alert("worker_idle_claims", 12, "empty_claims_above_work_claims/min/worker", 1, "/platform/system", "docs/runbooks/egress.md"),
  alert("player_duplicate_media", 2, "repeat_downloads/5m", 0, "/dashboard/screens", "docs/runbooks/egress.md", "platform", ">="),
  alert("media_queue_age", 60, "seconds", 5, "/dashboard/media?status=processing", "docs/runbooks/media-queue.md"),
  alert("media_worker_errors", 5, "errors/5m", 5, "/dashboard/media?status=validation_failed", "docs/runbooks/media-worker.md"),
  alert("media_worker_retries", 10, "retries/15m", 15, "/dashboard/media?status=processing", "docs/runbooks/media-worker.md"),
  alert("offline_fleet_ratio", 20, "percent", 10, "/dashboard/screens?status=offline", "docs/runbooks/screen-sync.md", "product-support"),
  alert("screen_sync_timeout", 120, "seconds", 5, "/dashboard/screens?status=syncing", "docs/runbooks/screen-sync.md", "product-support"),
  alert("disk_usage", 85, "percent", 10, "/platform/system?focus=disk", "docs/runbooks/infrastructure.md"),
  alert("tls_expiry", 14, "days", 60, "/platform/system?focus=tls", "docs/runbooks/infrastructure.md", "platform", "<"),
  alert("deployment_unhealthy", 1, "failed_checks", 2, "/platform/system?focus=deployment", "docs/deployment/rollback.md", "platform", ">="),
  alert("backup_freshness", 25, "hours", 15, "/platform/system?focus=backup", "docs/runbooks/recovery.md")
] as const satisfies readonly AlertDefinition[];

function alert(
  id: string,
  value: number,
  unit: string,
  durationMinutes: number,
  controlPath: string,
  runbook: string,
  owner: AlertDefinition["owner"] = "platform",
  operator: AlertDefinition["threshold"]["operator"] = ">"
): AlertDefinition {
  return { controlPath, id, owner, runbook, threshold: { durationMinutes, operator, unit, value } };
}

export type AlertObservation = Readonly<{
  alertId: string;
  breachingForMinutes: number;
  observedAt: string;
  value: number;
}>;

export function evaluateAlert(observation: AlertObservation) {
  const definition = alertDefinitions.find(({ id }) => id === observation.alertId);
  if (!definition) throw new Error(`Unknown alert definition: ${observation.alertId}`);
  const valueBreached = definition.threshold.operator === "<"
    ? observation.value < definition.threshold.value
    : definition.threshold.operator === ">="
      ? observation.value >= definition.threshold.value
      : observation.value > definition.threshold.value;
  return {
    alertId: definition.id,
    firing: valueBreached && observation.breachingForMinutes >= definition.threshold.durationMinutes,
    observedAt: new Date(observation.observedAt).toISOString(),
    owner: definition.owner,
    runbook: definition.runbook
  } as const;
}
