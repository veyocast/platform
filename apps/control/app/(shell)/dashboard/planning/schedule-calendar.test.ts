import { describe, expect, it } from "vitest";

import {
  buildCalendarDays,
  isScheduleActiveAt,
  normalizeReferenceDate,
  planningRangeLabel,
  scheduleMatchesPlanningTarget,
  shiftReferenceDate,
  type CalendarSchedule
} from "./schedule-calendar";

const baseSchedule: CalendarSchedule = {
  enabled: true,
  endsAt: "2026-07-31T21:59:00.000Z",
  id: "schedule-1",
  name: "Kantineavond",
  playlistName: "Kantine",
  priority: 100,
  recurrence: { endTime: "22:00", startTime: "18:00" },
  releaseVersion: 4,
  scheduleKind: "daily",
  source: "publisher",
  startsAt: "2026-07-01T16:00:00.000Z",
  targetId: "group-1",
  targetKind: "screen_group",
  targetName: "Kantine"
};

describe("Publisher planning calendar", () => {
  it("bouwt een tenantlokale week uit een dagelijkse planning", () => {
    const days = buildCalendarDays(
      [baseSchedule],
      "week",
      "2026-07-20",
      "Europe/Amsterdam",
      new Date("2026-07-20T10:00:00.000Z")
    );

    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe("2026-07-20");
    expect(days.every((day) => day.occurrences.length === 1)).toBe(true);
    expect(days[0]?.occurrences[0]?.startsAt).toBe("2026-07-20T16:00:00.000Z");
  });

  it("beperkt wekelijkse planning tot de vastgelegde weekdagen", () => {
    const days = buildCalendarDays(
      [{
        ...baseSchedule,
        recurrence: {
          endTime: "21:00",
          startTime: "18:00",
          weekdays: [2, 4]
        },
        scheduleKind: "weekly"
      }],
      "week",
      "2026-07-20",
      "Europe/Amsterdam"
    );

    expect(days.filter((day) => day.occurrences.length).map((day) => day.date))
      .toEqual(["2026-07-21", "2026-07-23"]);
  });

  it("neemt alleen het echte startmoment van een eenmalige planning op", () => {
    const days = buildCalendarDays(
      [{
        ...baseSchedule,
        endsAt: "2026-07-23T19:00:00.000Z",
        scheduleKind: "once",
        startsAt: "2026-07-23T18:00:00.000Z"
      }],
      "month",
      "2026-07-12",
      "Europe/Amsterdam"
    );

    expect(days).toHaveLength(42);
    expect(days.flatMap((day) => day.occurrences)).toHaveLength(1);
    expect(days.find((day) => day.occurrences.length)?.date).toBe("2026-07-23");
  });

  it("normaliseert navigatiedatums zonder browserlocale-afhankelijkheid", () => {
    expect(normalizeReferenceDate("ongeldig", "Europe/Amsterdam", new Date("2026-07-23T22:30:00.000Z")))
      .toBe("2026-07-24");
    expect(shiftReferenceDate("2026-07-20", "week", 1)).toBe("2026-07-27");
    expect(shiftReferenceDate("2026-07-20", "month", -1)).toBe("2026-06-01");
    expect(planningRangeLabel("2026-07-20", "week", "Europe/Amsterdam")).toContain("20 jul");
  });

  it("telt een terugkerende planning alleen binnen het dagelijkse tijdvenster als actief", () => {
    expect(isScheduleActiveAt(
      baseSchedule,
      new Date("2026-07-20T17:00:00.000Z"),
      "Europe/Amsterdam"
    )).toBe(true);
    expect(isScheduleActiveAt(
      baseSchedule,
      new Date("2026-07-20T12:00:00.000Z"),
      "Europe/Amsterdam"
    )).toBe(false);
  });

  it("filtert een scherm zowel direct als via zijn schermgroep", () => {
    expect(scheduleMatchesPlanningTarget(
      { targetId: "screen-1", targetKind: "screen" },
      "screen:screen-1",
      []
    )).toBe(true);
    expect(scheduleMatchesPlanningTarget(
      { targetId: "group-1", targetKind: "screen_group" },
      "screen:screen-1",
      [{ id: "group-1", memberIds: ["screen-1"] }]
    )).toBe(true);
    expect(scheduleMatchesPlanningTarget(
      { targetId: "group-1", targetKind: "screen_group" },
      "screen_group:group-2",
      [{ id: "group-1", memberIds: ["screen-1"] }]
    )).toBe(false);
  });
});
