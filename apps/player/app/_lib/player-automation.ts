import type {
  ScreenAutomationCapabilityReport,
  ScreenAutomationCommandReport
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
    isAutomationCommandReport
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
    isAutomationCapabilityReport
  );
}

export function storeAutomationSync(storage: StorageLike, input: unknown) {
  if (!isPlayerAutomationSync(input)) return false;
  storage.setItem(localStorageAutomationSyncKey, JSON.stringify(input));
  return true;
}

export function queueAutomationHeartbeatConfirmation(
  storage: StorageLike,
  previous: ScreenAutomationCommandReport,
  eventId: string,
  occurredAt: string
) {
  if (!previous.commandId || previous.eventType !== "player-visible") return false;
  const next = {
    commandId: previous.commandId,
    diagnosticCode: "PLAYER_HEARTBEAT_CONFIRMED",
    eventId,
    eventType: "heartbeat-sent",
    metadata: {},
    occurredAt,
    scheduledFor: null,
    status: "success"
  };
  if (!isAutomationCommandReport(next)) return false;
  storage.setItem(localStorageAutomationReportKey, JSON.stringify(next));
  return true;
}

function parseStoredValue<T>(
  value: string | null,
  guard: (input: unknown) => input is T
): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const automationEventTypes = new Set([
  "automation-config-received",
  "automation-config-stored",
  "command-received",
  "schedule-evaluated",
  "wake-scheduled",
  "wake-triggered",
  "activity-start-requested",
  "player-visible",
  "keep-awake-enabled",
  "keep-awake-disabled",
  "heartbeat-sent",
  "execution-failed"
]);
const automationResultStatuses = new Set(["success", "warning", "failed"]);
const commandStatuses = new Set([
  "requested",
  "received",
  "wake_requested",
  "player_started",
  "heartbeat_received",
  "expired",
  "failed"
]);
const hdmiCapabilities = new Set([
  "unknown",
  "probably_supported",
  "unavailable",
  "hardware_test_passed",
  "hardware_test_failed"
]);

function isAutomationCommandReport(
  input: unknown
): input is ScreenAutomationCommandReport {
  if (!isRecord(input)) return false;
  return (
    isNullableUuid(input.commandId) &&
    isNullableDiagnosticCode(input.diagnosticCode) &&
    isUuid(input.eventId) &&
    typeof input.eventType === "string" &&
    automationEventTypes.has(input.eventType) &&
    isScalarRecord(input.metadata) &&
    isIsoTimestamp(input.occurredAt) &&
    isNullableIsoTimestamp(input.scheduledFor) &&
    typeof input.status === "string" &&
    automationResultStatuses.has(input.status)
  );
}

function isAutomationCapabilityReport(
  input: unknown
): input is ScreenAutomationCapabilityReport {
  if (!isRecord(input)) return false;
  return (
    Number.isInteger(input.automationSchemaVersion) &&
    Number(input.automationSchemaVersion) >= 0 &&
    typeof input.hdmiCecWakeCapability === "string" &&
    hdmiCapabilities.has(input.hdmiCecWakeCapability) &&
    isNullableIsoTimestamp(input.lastAutomationExecutionAt) &&
    isNullableBoundedString(input.lastAutomationResult, 100) &&
    isNullableIsoTimestamp(input.lastAutomationSyncAt) &&
    isOptionalBoundedString(input.operatingSystem, 100) &&
    (input.formFactor === undefined ||
      input.formFactor === "general" ||
      input.formFactor === "tv") &&
    typeof input.supportsBootRestore === "boolean" &&
    typeof input.supportsKeepAwake === "boolean" &&
    typeof input.supportsLocalSchedule === "boolean" &&
    typeof input.supportsScheduledWake === "boolean"
  );
}

function isPlayerAutomationSync(input: unknown) {
  if (!isRecord(input)) return false;
  const command = input.command;
  const settings = input.settings;
  return (
    (command === null || isAutomationCommand(command)) &&
    (settings === null || isAutomationSettings(settings))
  );
}

function isAutomationCommand(input: unknown) {
  if (!isRecord(input)) return false;
  return (
    input.commandType === "wake_test" &&
    isIsoTimestamp(input.expiresAt) &&
    isUuid(input.id) &&
    isIsoTimestamp(input.requestedAt) &&
    typeof input.status === "string" &&
    commandStatuses.has(input.status)
  );
}

function isAutomationSettings(input: unknown) {
  if (!isRecord(input)) return false;
  return (
    input.schemaVersion === 1 &&
    isUuid(input.screenId) &&
    Number.isInteger(input.revision) &&
    Number(input.revision) > 0 &&
    isNullableIsoTimestamp(input.acceptedHdmiCecDisclaimerAt) &&
    isNullableUuid(input.acceptedHdmiCecDisclaimerBy) &&
    isIsoTimestamp(input.cacheValidUntil) &&
    isIsoTimestamp(input.syncedAt) &&
    typeof input.enabled === "boolean" &&
    typeof input.hdmiCecEnabled === "boolean" &&
    typeof input.keepAwakeEnabled === "boolean" &&
    typeof input.localWakeEnabled === "boolean" &&
    typeof input.offlineExecutionEnabled === "boolean" &&
    typeof input.restoreAfterReboot === "boolean" &&
    typeof input.startupEnabled === "boolean" &&
    typeof input.timezone === "string" &&
    input.timezone.length >= 3 &&
    input.timezone.length <= 64 &&
    (input.scheduleMode === "always" || input.scheduleMode === "weekly") &&
    Array.isArray(input.periods) &&
    input.periods.length <= 56 &&
    input.periods.every(isAutomationPeriod) &&
    Array.isArray(input.exceptions) &&
    input.exceptions.length <= 366 &&
    input.exceptions.every(isAutomationException) &&
    (input.temporaryOverride === "none" ||
      input.temporaryOverride === "active" ||
      input.temporaryOverride === "paused") &&
    isNullableIsoTimestamp(input.temporaryOverrideUntil) &&
    Number.isInteger(input.wakeLeadMinutes) &&
    Number(input.wakeLeadMinutes) >= 0 &&
    Number(input.wakeLeadMinutes) <= 60
  );
}

function isAutomationPeriod(input: unknown) {
  if (!isRecord(input)) return false;
  return (
    typeof input.enabled === "boolean" &&
    isLocalTime(input.startLocalTime) &&
    isLocalTime(input.endLocalTime) &&
    (!input.startLocalTime ||
      !input.endLocalTime ||
      input.startLocalTime !== input.endLocalTime) &&
    Number.isInteger(input.weekday) &&
    Number(input.weekday) >= 1 &&
    Number(input.weekday) <= 7 &&
    (input.id === undefined || isUuid(input.id))
  );
}

function isAutomationException(input: unknown) {
  if (!isRecord(input)) return false;
  const validMode = input.mode === "closed" || input.mode === "open";
  const startValid = input.startLocalTime === null || isLocalTime(input.startLocalTime);
  const endValid = input.endLocalTime === null || isLocalTime(input.endLocalTime);
  const hasWindow = Boolean(input.startLocalTime && input.endLocalTime);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? "")) &&
    validMode &&
    startValid &&
    endValid &&
    (input.mode !== "open" || hasWindow) &&
    (input.mode !== "closed" || !hasWindow) &&
    input.startLocalTime !== input.endLocalTime &&
    (input.id === undefined || isUuid(input.id)) &&
    isNullableBoundedString(input.reason, 160)
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === "object" && !Array.isArray(input));
}

function isScalarRecord(input: unknown) {
  return (
    isRecord(input) &&
    Object.values(input).every(
      (value) =>
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
  );
}

function isUuid(input: unknown): input is string {
  return (
    typeof input === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input
    )
  );
}

function isNullableUuid(input: unknown) {
  return input === null || isUuid(input);
}

function isIsoTimestamp(input: unknown): input is string {
  return (
    typeof input === "string" &&
    input.includes("T") &&
    Number.isFinite(Date.parse(input))
  );
}

function isNullableIsoTimestamp(input: unknown) {
  return input === null || isIsoTimestamp(input);
}

function isNullableDiagnosticCode(input: unknown) {
  return (
    input === null ||
    (typeof input === "string" && /^[A-Z0-9_]{1,100}$/.test(input))
  );
}

function isNullableBoundedString(input: unknown, maximum: number) {
  return input === null || (typeof input === "string" && input.length <= maximum);
}

function isOptionalBoundedString(input: unknown, maximum: number) {
  return input === undefined ||
    (typeof input === "string" &&
      input.trim().length > 0 &&
      input.trim().length <= maximum);
}

function isLocalTime(input: unknown): input is string {
  return (
    typeof input === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input)
  );
}
