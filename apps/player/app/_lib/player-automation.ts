import {
  playerAutomationSyncSchema,
  screenAutomationCapabilityReportSchema,
  screenAutomationCommandReportSchema,
  type ScreenAutomationCapabilityReport,
  type ScreenAutomationCommandReport
} from "@veyocast/contracts";

export const localStorageAutomationSyncKey = "veyocast.player.automation.v1";
export const localStorageAutomationReportKey = "veyocast.player.automation.report.v1";
export const localStorageAutomationCapabilitiesKey =
  "veyocast.player.automation.capabilities.v1";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readAutomationReport(
  storage: StorageLike
): ScreenAutomationCommandReport | null {
  return parseStoredValue(
    storage.getItem(localStorageAutomationReportKey),
    screenAutomationCommandReportSchema
  );
}

export function clearAutomationReport(
  storage: StorageLike,
  expected: ScreenAutomationCommandReport
) {
  const current = readAutomationReport(storage);
  if (current?.eventId === expected.eventId) {
    storage.removeItem(localStorageAutomationReportKey);
  }
}

export function readAutomationCapabilities(
  storage: StorageLike
): ScreenAutomationCapabilityReport | null {
  return parseStoredValue(
    storage.getItem(localStorageAutomationCapabilitiesKey),
    screenAutomationCapabilityReportSchema
  );
}

export function storeAutomationSync(storage: StorageLike, input: unknown) {
  const parsed = playerAutomationSyncSchema.safeParse(input);
  if (!parsed.success) return false;
  storage.setItem(localStorageAutomationSyncKey, JSON.stringify(parsed.data));
  return true;
}

export function queueAutomationHeartbeatConfirmation(
  storage: StorageLike,
  previous: ScreenAutomationCommandReport,
  eventId: string,
  occurredAt: string
) {
  if (!previous.commandId || previous.eventType !== "player-visible") return false;
  const next = screenAutomationCommandReportSchema.safeParse({
    commandId: previous.commandId,
    diagnosticCode: "PLAYER_HEARTBEAT_CONFIRMED",
    eventId,
    eventType: "heartbeat-sent",
    metadata: {},
    occurredAt,
    scheduledFor: null,
    status: "success"
  });
  if (!next.success) return false;
  storage.setItem(localStorageAutomationReportKey, JSON.stringify(next.data));
  return true;
}

function parseStoredValue<T>(
  value: string | null,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } }
): T | null {
  if (!value) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
