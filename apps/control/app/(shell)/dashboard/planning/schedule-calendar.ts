import {
  isoToZonedDateTimeLocal,
  zonedLocalDateTimeToIso
} from "./schedule-time";

export type PlanningView = "agenda" | "month" | "week";

export type CalendarSchedule = {
  enabled: boolean;
  endsAt: string | null;
  id: string;
  name: string;
  playlistName: string;
  priority: number;
  recurrence: Record<string, unknown>;
  releaseVersion: number;
  scheduleKind: string;
  source: string;
  startsAt: string;
  targetKind: string;
  targetName: string;
};

export type CalendarOccurrence = {
  enabled: boolean;
  endsAt: string | null;
  name: string;
  playlistName: string;
  priority: number;
  releaseVersion: number;
  scheduleId: string;
  source: string;
  startsAt: string;
  targetKind: string;
  targetName: string;
};

export type CalendarDay = {
  date: string;
  isOutsidePrimaryRange: boolean;
  isToday: boolean;
  occurrences: CalendarOccurrence[];
};

export function normalizePlanningView(value: string | undefined): PlanningView {
  return value === "week" || value === "month" ? value : "agenda";
}

export function normalizeReferenceDate(
  value: string | undefined,
  timeZone: string,
  now = new Date()
) {
  if (value && dateKeyPattern.test(value) && isValidDateKey(value)) return value;
  return zonedDateKey(now, timeZone);
}

export function buildCalendarDays(
  schedules: readonly CalendarSchedule[],
  view: Exclude<PlanningView, "agenda">,
  referenceDate: string,
  timeZone: string,
  now = new Date()
): CalendarDay[] {
  const today = zonedDateKey(now, timeZone);
  const primaryMonth = referenceDate.slice(0, 7);
  const firstDate = view === "week"
    ? startOfWeek(referenceDate)
    : startOfWeek(`${primaryMonth}-01`);
  const dayCount = view === "week" ? 7 : 42;

  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(firstDate, index);
    return {
      date,
      isOutsidePrimaryRange: view === "month" && !date.startsWith(primaryMonth),
      isToday: date === today,
      occurrences: schedules
        .flatMap((schedule) => occurrenceForDate(schedule, date, timeZone))
        .sort((left, right) =>
          left.startsAt.localeCompare(right.startsAt) ||
          right.priority - left.priority ||
          left.name.localeCompare(right.name, "nl-NL")
        )
    };
  });
}

export function shiftReferenceDate(
  referenceDate: string,
  view: Exclude<PlanningView, "agenda">,
  direction: -1 | 1
) {
  if (view === "week") return addDays(referenceDate, direction * 7);
  const date = dateKeyToUtcDate(referenceDate);
  date.setUTCMonth(date.getUTCMonth() + direction, 1);
  return utcDateKey(date);
}

export function planningRangeLabel(
  referenceDate: string,
  view: Exclude<PlanningView, "agenda">,
  timeZone: string
) {
  if (view === "month") {
    return new Intl.DateTimeFormat("nl-NL", {
      month: "long",
      timeZone,
      year: "numeric"
    }).format(new Date(`${referenceDate.slice(0, 7)}-15T12:00:00.000Z`));
  }
  const first = startOfWeek(referenceDate);
  const last = addDays(first, 6);
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
  return `${formatter.format(dateKeyToUtcDate(first))} – ${formatter.format(dateKeyToUtcDate(last))}`;
}

export function formatCalendarDayLabel(date: string, long = false) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: long ? "long" : "short",
    timeZone: "UTC",
    weekday: long ? "long" : "short"
  }).format(dateKeyToUtcDate(date));
}

function occurrenceForDate(
  schedule: CalendarSchedule,
  date: string,
  timeZone: string
): CalendarOccurrence[] {
  if (schedule.scheduleKind === "once") {
    const startLocal = isoToZonedDateTimeLocal(schedule.startsAt, timeZone);
    return startLocal.startsWith(`${date}T`)
      ? [toOccurrence(schedule, schedule.startsAt, schedule.endsAt)]
      : [];
  }

  const weekdays = recurrenceWeekdays(schedule.recurrence);
  if (
    (schedule.scheduleKind === "weekly" || schedule.scheduleKind === "custom") &&
    !weekdays.includes(isoWeekday(date))
  ) {
    return [];
  }
  const localStart = isoToZonedDateTimeLocal(schedule.startsAt, timeZone);
  const startTime = recurrenceTime(schedule.recurrence.startTime) ?? localStart.slice(11, 16);
  const endTime = recurrenceTime(schedule.recurrence.endTime) ?? "23:59";
  try {
    const startsAt = zonedLocalDateTimeToIso(`${date}T${startTime}`, timeZone);
    const endDate = endTime <= startTime ? addDays(date, 1) : date;
    let endsAt = zonedLocalDateTimeToIso(`${endDate}T${endTime}`, timeZone);
    if (startsAt < schedule.startsAt) return [];
    if (schedule.endsAt && startsAt >= schedule.endsAt) return [];
    if (schedule.endsAt && endsAt > schedule.endsAt) endsAt = schedule.endsAt;
    return [toOccurrence(schedule, startsAt, endsAt)];
  } catch {
    // A local time inside a forward DST jump does not exist and is therefore
    // not presented as an executable occurrence.
    return [];
  }
}

function toOccurrence(
  schedule: CalendarSchedule,
  startsAt: string,
  endsAt: string | null
): CalendarOccurrence {
  return {
    enabled: schedule.enabled,
    endsAt,
    name: schedule.name,
    playlistName: schedule.playlistName,
    priority: schedule.priority,
    releaseVersion: schedule.releaseVersion,
    scheduleId: schedule.id,
    source: schedule.source,
    startsAt,
    targetKind: schedule.targetKind,
    targetName: schedule.targetName
  };
}

function recurrenceTime(value: unknown) {
  return typeof value === "string" && timePattern.test(value) ? value : null;
}

function recurrenceWeekdays(value: Record<string, unknown>) {
  return Array.isArray(value.weekdays)
    ? value.weekdays.filter(
        (day): day is number => Number.isInteger(day) && day >= 1 && day <= 7
      )
    : [];
}

function isoWeekday(date: string) {
  const day = dateKeyToUtcDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

function startOfWeek(date: string) {
  return addDays(date, -(isoWeekday(date) - 1));
}

function addDays(date: string, amount: number) {
  const result = dateKeyToUtcDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return utcDateKey(result);
}

function zonedDateKey(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric"
    }).formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyToUtcDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Ongeldige kalenderdatum.");
  return date;
}

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidDateKey(value: string) {
  return utcDateKey(dateKeyToUtcDate(value)) === value;
}

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
