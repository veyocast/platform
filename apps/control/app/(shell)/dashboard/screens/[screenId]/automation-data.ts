import "server-only";

import type {
  HdmiCecWakeCapability,
  ScreenAutomationException,
  ScreenAutomationPeriod,
  ScreenAutomationSettingsInput
} from "@veyocast/contracts";

import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export type ScreenAutomationView = {
  commands: Array<{
    completedAt: string | null;
    expiresAt: string;
    id: string;
    requestedAt: string;
    resultCode: string | null;
    status: string;
  }>;
  error: string | null;
  events: Array<{
    diagnosticCode: string | null;
    eventType: string;
    id: string;
    occurredAt: string;
    scheduledFor: string | null;
    status: string;
  }>;
  revision: number;
  settings: ScreenAutomationSettingsInput;
  disclaimerAcceptedAt: string | null;
  disclaimerAcceptedBy: string | null;
  tenantTimezone: string;
};

export type AutomationCapabilityView = {
  appVersion: string | null;
  automationSupport: AutomationSupportStatus;
  bootRestore: AutomationSupportStatus;
  hdmiCec: AutomationSupportStatus;
  hdmiCecCapability: HdmiCecWakeCapability;
  keepAwake: AutomationSupportStatus;
  lastAutomationExecutionAt: string | null;
  lastAutomationResult: string | null;
  lastAutomationSyncAt: string | null;
  localSchedule: AutomationSupportStatus;
  operatingSystem: string;
  platform: string;
  scheduledWake: AutomationSupportStatus;
};

export type AutomationSupportStatus =
  | "supported"
  | "probably_supported"
  | "unavailable"
  | "untested";

export async function loadScreenAutomation(
  tenantId: string,
  screenId: string
): Promise<ScreenAutomationView> {
  const supabase = await createControlSupabaseClient();
  const fallback = defaultAutomation("Europe/Amsterdam");
  if (!supabase) {
    return { ...fallback, error: "De beveiligde datasessie ontbreekt." };
  }
  const [settings, periods, exceptions, commands, events, tenantSettings] =
    await Promise.all([
      supabase
        .from("screen_automation_settings")
        .select("revision, enabled, timezone_name, schedule_mode, startup_enabled, local_wake_enabled, hdmi_cec_enabled, keep_awake_enabled, wake_lead_minutes, restore_after_reboot, offline_execution_enabled, temporary_override, temporary_override_until, accepted_hdmi_cec_disclaimer_at, accepted_hdmi_cec_disclaimer_by")
        .eq("tenant_id", tenantId)
        .eq("screen_id", screenId)
        .maybeSingle(),
      supabase
        .from("screen_automation_periods")
        .select("id, weekday, start_local_time, end_local_time, enabled")
        .eq("tenant_id", tenantId)
        .eq("screen_id", screenId)
        .order("weekday")
        .order("start_local_time"),
      supabase
        .from("screen_automation_exceptions")
        .select("id, local_date, mode, start_local_time, end_local_time, reason")
        .eq("tenant_id", tenantId)
        .eq("screen_id", screenId)
        .order("local_date")
        .order("start_local_time"),
      supabase
        .from("screen_automation_commands")
        .select("id, status, requested_at, expires_at, completed_at, result_code")
        .eq("tenant_id", tenantId)
        .eq("screen_id", screenId)
        .order("requested_at", { ascending: false })
        .limit(20),
      supabase
        .from("screen_automation_events")
        .select("id, event_type, scheduled_for, occurred_at, status, diagnostic_code")
        .eq("tenant_id", tenantId)
        .eq("screen_id", screenId)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("tenant_settings")
        .select("timezone_name")
        .eq("tenant_id", tenantId)
        .maybeSingle()
    ]);
  const error = [
    settings.error,
    periods.error,
    exceptions.error,
    commands.error,
    events.error,
    tenantSettings.error
  ].find(Boolean);
  if (error) {
    console.error("Schermautomatisering laden mislukt", error);
    return {
      ...fallback,
      error: "De automatiseringsconfiguratie kon niet volledig worden geladen. Vernieuw de pagina."
    };
  }
  const timezone = settings.data?.timezone_name
    ?? tenantSettings.data?.timezone_name
    ?? "Europe/Amsterdam";
  return {
    commands: (commands.data ?? []).map((command) => ({
      completedAt: command.completed_at,
      expiresAt: command.expires_at,
      id: command.id,
      requestedAt: command.requested_at,
      resultCode: command.result_code,
      status: command.status
    })),
    disclaimerAcceptedAt: settings.data?.accepted_hdmi_cec_disclaimer_at ?? null,
    disclaimerAcceptedBy: settings.data?.accepted_hdmi_cec_disclaimer_by ?? null,
    error: null,
    events: (events.data ?? []).map((event) => ({
      diagnosticCode: event.diagnostic_code,
      eventType: event.event_type,
      id: event.id,
      occurredAt: event.occurred_at,
      scheduledFor: event.scheduled_for,
      status: event.status
    })),
    revision: Number(settings.data?.revision ?? 0),
    settings: {
      enabled: settings.data?.enabled ?? false,
      exceptions: (exceptions.data ?? []).map((exception): ScreenAutomationException => ({
        date: exception.local_date,
        endLocalTime: trimTime(exception.end_local_time),
        id: exception.id,
        mode: exception.mode === "open" ? "open" : "closed",
        reason: exception.reason,
        startLocalTime: trimTime(exception.start_local_time)
      })),
      hdmiCecEnabled: settings.data?.hdmi_cec_enabled ?? false,
      keepAwakeEnabled: settings.data?.keep_awake_enabled ?? true,
      localWakeEnabled: settings.data?.local_wake_enabled ?? false,
      offlineExecutionEnabled: settings.data?.offline_execution_enabled ?? true,
      periods: (periods.data ?? []).map((period): ScreenAutomationPeriod => ({
        enabled: period.enabled,
        endLocalTime: trimTime(period.end_local_time) ?? "23:00",
        id: period.id,
        startLocalTime: trimTime(period.start_local_time) ?? "07:30",
        weekday: period.weekday
      })),
      restoreAfterReboot: settings.data?.restore_after_reboot ?? true,
      scheduleMode: settings.data?.schedule_mode === "always" ? "always" : "weekly",
      startupEnabled: settings.data?.startup_enabled ?? false,
      temporaryOverride:
        settings.data?.temporary_override === "active" ||
        settings.data?.temporary_override === "paused"
          ? settings.data.temporary_override
          : "none",
      temporaryOverrideUntil: settings.data?.temporary_override_until ?? null,
      timezone,
      wakeLeadMinutes: Number(settings.data?.wake_lead_minutes ?? 5)
    },
    tenantTimezone: tenantSettings.data?.timezone_name ?? "Europe/Amsterdam"
  };
}

export function automationCapabilityView(
  platform: string | null,
  appVersion: string | null,
  capabilities: Record<string, unknown>
): AutomationCapabilityView {
  const nested = objectValue(capabilities.screenAutomation);
  const isAndroid = /android/i.test(platform ?? "")
    || capabilities.supportsLocalSchedule === true
    || nested.supportsLocalSchedule === true;
  const hdmiCapability = hdmiCecCapability(
    nested.hdmiCecWakeCapability ?? capabilities.hdmiCecWakeCapability
  );
  const support = (key: string): AutomationSupportStatus => {
    const value = nested[key] ?? capabilities[key];
    if (value === true) return "supported";
    if (!isAndroid || value === false) return "unavailable";
    return "untested";
  };
  return {
    appVersion,
    automationSupport: isAndroid && support("supportsLocalSchedule") === "supported"
      ? "supported"
      : isAndroid ? "untested" : "unavailable",
    bootRestore: support("supportsBootRestore"),
    hdmiCec: hdmiCapability === "probably_supported"
      ? "probably_supported"
      : hdmiCapability === "unavailable"
        ? "unavailable"
        : hdmiCapability === "hardware_test_passed"
          ? "supported"
          : "untested",
    hdmiCecCapability: hdmiCapability,
    keepAwake: support("supportsKeepAwake"),
    lastAutomationExecutionAt: stringOrNull(
      nested.lastAutomationExecutionAt ?? capabilities.lastAutomationExecutionAt
    ),
    lastAutomationResult: stringOrNull(
      nested.lastAutomationResult ?? capabilities.lastAutomationResult
    ),
    lastAutomationSyncAt: stringOrNull(
      nested.lastAutomationSyncAt ?? capabilities.lastAutomationSyncAt
    ),
    localSchedule: support("supportsLocalSchedule"),
    operatingSystem: stringOrNull(nested.operatingSystem) ?? "Versie niet gerapporteerd",
    platform: platform ?? "Onbekend platform",
    scheduledWake: support("supportsScheduledWake")
  };
}

function defaultAutomation(timezone: string): ScreenAutomationView {
  return {
    commands: [],
    disclaimerAcceptedAt: null,
    disclaimerAcceptedBy: null,
    error: null,
    events: [],
    revision: 0,
    settings: {
      enabled: false,
      exceptions: [],
      hdmiCecEnabled: false,
      keepAwakeEnabled: true,
      localWakeEnabled: false,
      offlineExecutionEnabled: true,
      periods: [],
      restoreAfterReboot: true,
      scheduleMode: "weekly",
      startupEnabled: false,
      temporaryOverride: "none",
      temporaryOverrideUntil: null,
      timezone,
      wakeLeadMinutes: 5
    },
    tenantTimezone: timezone
  };
}

function trimTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function hdmiCecCapability(value: unknown): HdmiCecWakeCapability {
  return value === "probably_supported"
    || value === "unavailable"
    || value === "hardware_test_passed"
    || value === "hardware_test_failed"
    ? value
    : "unknown";
}
