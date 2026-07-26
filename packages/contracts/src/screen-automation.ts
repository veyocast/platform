import { z } from "zod";

export const screenAutomationSchemaVersion = 1 as const;

export const hdmiCecWakeCapabilitySchema = z.enum([
  "unknown",
  "probably_supported",
  "unavailable",
  "hardware_test_passed",
  "hardware_test_failed"
]);

export const screenAutomationCommandStatusSchema = z.enum([
  "requested",
  "received",
  "wake_requested",
  "player_started",
  "heartbeat_received",
  "expired",
  "failed"
]);

export const screenAutomationEventTypeSchema = z.enum([
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

const localTimeSchema = z.string().regex(
  /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  "Gebruik een tijd in HH:mm-notatie."
);

const localDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Gebruik een datum in JJJJ-MM-DD-notatie."
);

const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .refine(isValidTimezone, "Deze tijdzone wordt niet ondersteund.");

export const screenAutomationPeriodSchema = z.object({
  enabled: z.boolean().default(true),
  endLocalTime: localTimeSchema,
  id: z.string().uuid().optional(),
  startLocalTime: localTimeSchema,
  weekday: z.number().int().min(1).max(7)
}).refine(
  (period) => period.startLocalTime !== period.endLocalTime,
  {
    message: "Een periode moet een begin- en eindtijd hebben.",
    path: ["endLocalTime"]
  }
);

export const screenAutomationExceptionSchema = z
  .object({
    date: localDateSchema,
    endLocalTime: localTimeSchema.nullable().default(null),
    id: z.string().uuid().optional(),
    mode: z.enum(["closed", "open"]),
    reason: z.string().trim().max(160).nullable().default(null),
    startLocalTime: localTimeSchema.nullable().default(null)
  })
  .superRefine((exception, context) => {
    const hasWindow = Boolean(exception.startLocalTime && exception.endLocalTime);
    if (exception.mode === "open" && !hasWindow) {
      context.addIssue({
        code: "custom",
        message: "Extra openingstijd vereist een begin- en eindtijd.",
        path: ["startLocalTime"]
      });
    }
    if (exception.mode === "closed" && hasWindow) {
      context.addIssue({
        code: "custom",
        message: "Een sluitingsdag heeft geen tijdvenster.",
        path: ["startLocalTime"]
      });
    }
    if (
      exception.startLocalTime &&
      exception.endLocalTime &&
      exception.startLocalTime === exception.endLocalTime
    ) {
      context.addIssue({
        code: "custom",
        message: "Een uitzondering moet een begin- en eindtijd hebben.",
        path: ["endLocalTime"]
      });
    }
  });

export const screenAutomationSettingsInputSchema = z
  .object({
    enabled: z.boolean(),
    exceptions: z.array(screenAutomationExceptionSchema).max(366),
    hdmiCecEnabled: z.boolean(),
    keepAwakeEnabled: z.boolean(),
    localWakeEnabled: z.boolean(),
    offlineExecutionEnabled: z.boolean(),
    periods: z.array(screenAutomationPeriodSchema).max(56),
    restoreAfterReboot: z.boolean(),
    scheduleMode: z.enum(["always", "weekly"]),
    startupEnabled: z.boolean(),
    temporaryOverride: z.enum(["none", "active", "paused"]).default("none"),
    temporaryOverrideUntil: z.string().datetime({ offset: true }).nullable().default(null),
    timezone: timezoneSchema,
    wakeLeadMinutes: z.number().int().min(0).max(60)
  })
  .superRefine((settings, context) => {
    if (settings.hdmiCecEnabled && !settings.localWakeEnabled) {
      context.addIssue({
        code: "custom",
        message: "HDMI-CEC vereist dat lokale startpogingen zijn ingeschakeld.",
        path: ["hdmiCecEnabled"]
      });
    }
    if (settings.localWakeEnabled && !settings.startupEnabled) {
      context.addIssue({
        code: "custom",
        message: "Lokale start vereist dat automatisch starten is ingeschakeld.",
        path: ["localWakeEnabled"]
      });
    }
    if (settings.temporaryOverride !== "none" && !settings.temporaryOverrideUntil) {
      context.addIssue({
        code: "custom",
        message: "Een tijdelijke override vereist een eindtijd.",
        path: ["temporaryOverrideUntil"]
      });
    }
    addOverlapIssues(settings.periods, context);
    addExceptionOverlapIssues(settings.exceptions, context);
  });

export const screenAutomationSettingsSchema =
  screenAutomationSettingsInputSchema.extend({
    acceptedHdmiCecDisclaimerAt: z.string().datetime({ offset: true }).nullable(),
    acceptedHdmiCecDisclaimerBy: z.string().uuid().nullable(),
    cacheValidUntil: z.string().datetime({ offset: true }),
    revision: z.number().int().positive(),
    schemaVersion: z.literal(screenAutomationSchemaVersion),
    screenId: z.string().uuid(),
    syncedAt: z.string().datetime({ offset: true })
  });

export const screenAutomationCapabilityReportSchema = z.object({
  automationSchemaVersion: z.number().int().min(0),
  formFactor: z.enum(["general", "tv"]).optional(),
  hdmiCecWakeCapability: hdmiCecWakeCapabilitySchema,
  lastAutomationExecutionAt: z.string().datetime({ offset: true }).nullable(),
  lastAutomationResult: z.string().max(100).nullable(),
  lastAutomationSyncAt: z.string().datetime({ offset: true }).nullable(),
  operatingSystem: z.string().trim().min(1).max(100).optional(),
  supportsBootRestore: z.boolean(),
  supportsKeepAwake: z.boolean(),
  supportsLocalSchedule: z.boolean(),
  supportsScheduledWake: z.boolean()
});

export const screenAutomationCommandSchema = z.object({
  commandType: z.literal("wake_test"),
  expiresAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  requestedAt: z.string().datetime({ offset: true }),
  status: screenAutomationCommandStatusSchema
});

export const screenAutomationCommandReportSchema = z.object({
  commandId: z.string().uuid().nullable(),
  diagnosticCode: z
    .string()
    .regex(/^[A-Z0-9_]{1,100}$/)
    .nullable(),
  eventId: z.string().uuid(),
  eventType: screenAutomationEventTypeSchema,
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  occurredAt: z.string().datetime({ offset: true }),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(["success", "warning", "failed"])
});

export const playerAutomationSyncSchema = z.object({
  command: screenAutomationCommandSchema.nullable(),
  settings: screenAutomationSettingsSchema.nullable()
});

export type HdmiCecWakeCapability = z.infer<typeof hdmiCecWakeCapabilitySchema>;
export type ScreenAutomationCapabilityReport = z.infer<
  typeof screenAutomationCapabilityReportSchema
>;
export type ScreenAutomationCommand = z.infer<typeof screenAutomationCommandSchema>;
export type ScreenAutomationCommandReport = z.infer<
  typeof screenAutomationCommandReportSchema
>;
export type ScreenAutomationException = z.infer<typeof screenAutomationExceptionSchema>;
export type ScreenAutomationPeriod = z.infer<typeof screenAutomationPeriodSchema>;
export type ScreenAutomationSettings = z.infer<typeof screenAutomationSettingsSchema>;
export type ScreenAutomationSettingsInput = z.infer<
  typeof screenAutomationSettingsInputSchema
>;

export type ScreenAutomationEvaluation = Readonly<{
  active: boolean;
  nextTransitionAt: string | null;
  reason:
    | "disabled"
    | "exception_closed"
    | "exception_open"
    | "temporary_active"
    | "temporary_paused"
    | "weekly"
    | "outside_schedule";
  shouldPrepareWake: boolean;
}>;

export function evaluateScreenAutomationAt(
  settings: Pick<
    ScreenAutomationSettingsInput,
    | "enabled"
    | "exceptions"
    | "periods"
    | "scheduleMode"
    | "temporaryOverride"
    | "temporaryOverrideUntil"
    | "timezone"
    | "wakeLeadMinutes"
  >,
  at: Date
): ScreenAutomationEvaluation {
  const state = evaluateActiveState(settings, at);
  const nextTransitionAt = findNextTransition(settings, at, state.active);
  const leadMs = settings.wakeLeadMinutes * 60_000;
  const shouldPrepareWake =
    !state.active &&
    nextTransitionAt !== null &&
    Date.parse(nextTransitionAt) > at.getTime() &&
    Date.parse(nextTransitionAt) - at.getTime() <= leadMs;
  return {
    ...state,
    nextTransitionAt,
    shouldPrepareWake
  };
}

function evaluateActiveState(
  settings: Pick<
    ScreenAutomationSettingsInput,
    | "enabled"
    | "exceptions"
    | "periods"
    | "scheduleMode"
    | "temporaryOverride"
    | "temporaryOverrideUntil"
    | "timezone"
  >,
  at: Date
): Pick<ScreenAutomationEvaluation, "active" | "reason"> {
  if (!settings.enabled) return { active: false, reason: "disabled" };
  const local = localParts(at, settings.timezone);
  const todayExceptions = settings.exceptions.filter(
    (exception) => exception.date === local.date
  );
  if (todayExceptions.some((exception) => exception.mode === "closed")) {
    return { active: false, reason: "exception_closed" };
  }
  const openings = todayExceptions.filter((exception) => exception.mode === "open");
  if (openings.length) {
    return {
      active: openings.some((opening) =>
        matchesAnchoredLocalWindow(
          local.minute,
          opening.startLocalTime!,
          opening.endLocalTime!
        )
      ),
      reason: "exception_open"
    };
  }

  const previous = previousLocalDate(local.date);
  const previousOpenings = settings.exceptions.filter(
    (exception) => exception.date === previous && exception.mode === "open"
  );
  if (
    previousOpenings.some((opening) =>
      crossesMidnight(opening.startLocalTime!, opening.endLocalTime!) &&
      local.minute < timeToMinute(opening.endLocalTime!)
    )
  ) {
    return { active: true, reason: "exception_open" };
  }

  const overrideActive =
    settings.temporaryOverride !== "none" &&
    settings.temporaryOverrideUntil &&
    Date.parse(settings.temporaryOverrideUntil) > at.getTime();
  if (overrideActive) {
    return settings.temporaryOverride === "active"
      ? { active: true, reason: "temporary_active" }
      : { active: false, reason: "temporary_paused" };
  }

  if (settings.scheduleMode === "always") {
    return { active: true, reason: "weekly" };
  }

  const weeklyActive = settings.periods
    .filter((period) => period.enabled)
    .some((period) => {
      if (period.weekday === local.weekday) {
        return matchesAnchoredLocalWindow(
          local.minute,
          period.startLocalTime,
          period.endLocalTime
        );
      }
      const previousWeekday = local.weekday === 1 ? 7 : local.weekday - 1;
      return (
        period.weekday === previousWeekday &&
        crossesMidnight(period.startLocalTime, period.endLocalTime) &&
        local.minute < timeToMinute(period.endLocalTime)
      );
    });
  return weeklyActive
    ? { active: true, reason: "weekly" }
    : { active: false, reason: "outside_schedule" };
}

function findNextTransition(
  settings: Parameters<typeof evaluateActiveState>[0],
  at: Date,
  active: boolean
) {
  const start = Math.floor(at.getTime() / 60_000) * 60_000;
  for (let minute = 1; minute <= 9 * 24 * 60; minute += 1) {
    const candidate = new Date(start + minute * 60_000);
    if (evaluateActiveState(settings, candidate).active !== active) {
      return candidate.toISOString();
    }
  }
  return null;
}

function matchesAnchoredLocalWindow(
  minute: number,
  start: string,
  end: string
) {
  const startMinute = timeToMinute(start);
  const endMinute = timeToMinute(end);
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute;
}

const localPartsFormatters = new Map<string, Intl.DateTimeFormat>();

function localParts(at: Date, timezone: string) {
  let formatter = localPartsFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      weekday: "short",
      year: "numeric"
    });
    localPartsFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as
    Record<string, number>)[value("weekday")] ?? 1;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minute: Number(value("hour")) * 60 + Number(value("minute")),
    weekday
  };
}

function crossesMidnight(start: string, end: string) {
  return timeToMinute(start) > timeToMinute(end);
}

function timeToMinute(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function previousLocalDate(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1, 12));
  return date.toISOString().slice(0, 10);
}

function addOverlapIssues(
  periods: ScreenAutomationPeriod[],
  context: z.RefinementCtx
) {
  const intervals = periods
    .filter((period) => period.enabled)
    .flatMap((period, index) => weeklyIntervals(period, index))
    .sort((left, right) => left.start - right.start);
  for (let index = 1; index < intervals.length; index += 1) {
    const current = intervals[index];
    const previous = intervals[index - 1];
    if (current && previous && current.start < previous.end) {
      context.addIssue({
        code: "custom",
        message: "Tijdvensters mogen elkaar niet overlappen.",
        path: ["periods", current.sourceIndex]
      });
    }
  }
}

function weeklyIntervals(period: ScreenAutomationPeriod, sourceIndex: number) {
  const week = 7 * 24 * 60;
  const start = (period.weekday - 1) * 24 * 60 + timeToMinute(period.startLocalTime);
  let end = (period.weekday - 1) * 24 * 60 + timeToMinute(period.endLocalTime);
  if (end <= start) end += 24 * 60;
  if (end <= week) return [{ end, sourceIndex, start }];
  return [
    { end: week, sourceIndex, start },
    { end: end - week, sourceIndex, start: 0 }
  ];
}

function addExceptionOverlapIssues(
  exceptions: ScreenAutomationException[],
  context: z.RefinementCtx
) {
  const closedDates = new Map<string, number>();
  const windows: Array<{ end: number; index: number; start: number }> = [];
  exceptions.forEach((exception, index) => {
    if (exception.mode === "closed") {
      const existingIndex = closedDates.get(exception.date);
      if (
        existingIndex !== undefined ||
        exceptions.some(
          (candidate, candidateIndex) =>
            candidateIndex !== index &&
            candidate.date === exception.date
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "Een sluitingsdag kan niet met andere uitzonderingen worden gecombineerd.",
          path: ["exceptions", index]
        });
      }
      closedDates.set(exception.date, index);
      return;
    }
    if (
      !exception.startLocalTime ||
      !exception.endLocalTime
    ) return;
    const day = localDateToEpochDay(exception.date);
    const start = day * 1440 + timeToMinute(exception.startLocalTime);
    let end = day * 1440 + timeToMinute(exception.endLocalTime);
    if (end <= start) end += 24 * 60;
    windows.push({ end, index, start });
  });
  windows.sort((left, right) => left.start - right.start);
  for (let index = 1; index < windows.length; index += 1) {
    const current = windows[index];
    const previous = windows[index - 1];
    if (current && previous && current.start < previous.end) {
      context.addIssue({
        code: "custom",
        message: "Uitzonderingstijden mogen elkaar niet overlappen.",
        path: ["exceptions", current.index]
      });
    }
  }
}

function localDateToEpochDay(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
