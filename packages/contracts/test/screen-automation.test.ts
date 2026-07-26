import { describe, expect, it } from "vitest";

import {
  evaluateScreenAutomationAt,
  screenAutomationSettingsInputSchema,
  type ScreenAutomationSettingsInput
} from "../src/screen-automation";

const base: ScreenAutomationSettingsInput = {
  enabled: true,
  exceptions: [],
  hdmiCecEnabled: false,
  keepAwakeEnabled: true,
  localWakeEnabled: true,
  offlineExecutionEnabled: true,
  periods: [
    {
      enabled: true,
      endLocalTime: "23:00",
      startLocalTime: "07:30",
      weekday: 1
    }
  ],
  restoreAfterReboot: true,
  scheduleMode: "weekly",
  startupEnabled: true,
  temporaryOverride: "none",
  temporaryOverrideUntil: null,
  timezone: "Europe/Amsterdam",
  wakeLeadMinutes: 5
};

describe("screen automation contracts", () => {
  it("rejects overlapping weekly periods", () => {
    const result = screenAutomationSettingsInputSchema.safeParse({
      ...base,
      periods: [
        ...base.periods,
        {
          enabled: true,
          endLocalTime: "12:00",
          startLocalTime: "08:00",
          weekday: 1
        }
      ]
    });
    expect(result.success).toBe(false);
  });

  it("requires local wake before HDMI-CEC can be enabled", () => {
    const result = screenAutomationSettingsInputSchema.safeParse({
      ...base,
      hdmiCecEnabled: true,
      localWakeEnabled: false
    });
    expect(result.success).toBe(false);
  });

  it("accepts an always-active schedule without ambiguous equal times", () => {
    expect(screenAutomationSettingsInputSchema.safeParse({
      ...base,
      periods: [],
      scheduleMode: "always"
    }).success).toBe(true);
  });

  it("rejects a closure combined with another exception on the same date", () => {
    const result = screenAutomationSettingsInputSchema.safeParse({
      ...base,
      exceptions: [
        {
          date: "2026-07-27",
          endLocalTime: null,
          mode: "closed",
          reason: null,
          startLocalTime: null
        },
        {
          date: "2026-07-27",
          endLocalTime: "12:00",
          mode: "open",
          reason: null,
          startLocalTime: "10:00"
        }
      ]
    });
    expect(result.success).toBe(false);
  });
});

describe("screen automation evaluator", () => {
  it("evaluates a same-day interval and wake lead time", () => {
    expect(evaluateScreenAutomationAt(base, new Date("2026-07-27T05:31:00Z"))).toMatchObject({
      active: true,
      reason: "weekly",
      shouldPrepareWake: false
    });
    expect(evaluateScreenAutomationAt(base, new Date("2026-07-27T05:26:00Z"))).toMatchObject({
      active: false,
      reason: "outside_schedule",
      shouldPrepareWake: true
    });
  });

  it("handles a period crossing midnight", () => {
    const settings = {
      ...base,
      periods: [{
        enabled: true,
        endLocalTime: "00:30",
        startLocalTime: "19:00",
        weekday: 5
      }]
    };
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-24T22:15:00Z")).active)
      .toBe(true);
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-23T22:15:00Z")).active)
      .toBe(false);
  });

  it("applies a date closure before a temporary override and weekly schedule", () => {
    const settings = {
      ...base,
      exceptions: [{
        date: "2026-07-27",
        endLocalTime: null,
        mode: "closed" as const,
        reason: "Onderhoud",
        startLocalTime: null
      }],
      temporaryOverride: "active" as const,
      temporaryOverrideUntil: "2026-07-27T22:00:00Z"
    };
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-27T10:00:00Z")))
      .toMatchObject({ active: false, reason: "exception_closed" });
  });

  it("supports temporary opening hours", () => {
    const settings = {
      ...base,
      exceptions: [{
        date: "2026-07-28",
        endLocalTime: "12:00",
        mode: "open" as const,
        reason: "Evenement",
        startLocalTime: "10:00"
      }]
    };
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-28T08:30:00Z")))
      .toMatchObject({ active: true, reason: "exception_open" });
  });

  it("handles the DST start and end days using the configured timezone", () => {
    const sunday = {
      ...base,
      periods: [{
        enabled: true,
        endLocalTime: "04:00",
        startLocalTime: "01:00",
        weekday: 7
      }]
    };
    expect(evaluateScreenAutomationAt(sunday, new Date("2026-03-29T01:30:00Z")).active)
      .toBe(true);
    expect(evaluateScreenAutomationAt(sunday, new Date("2026-10-25T01:30:00Z")).active)
      .toBe(true);
  });

  it("fails safely for disabled automation", () => {
    expect(evaluateScreenAutomationAt({ ...base, enabled: false }, new Date()))
      .toMatchObject({ active: false, reason: "disabled", shouldPrepareWake: false });
  });

  it("applies a cross-midnight exception before a temporary pause", () => {
    const settings = {
      ...base,
      exceptions: [{
        date: "2026-07-26",
        endLocalTime: "01:00",
        mode: "open" as const,
        reason: "Toernooi",
        startLocalTime: "22:00"
      }],
      temporaryOverride: "paused" as const,
      temporaryOverrideUntil: "2026-07-27T08:00:00Z"
    };
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-26T22:30:00Z")))
      .toMatchObject({ active: true, reason: "exception_open" });
    expect(evaluateScreenAutomationAt(settings, new Date("2026-07-25T22:30:00Z")))
      .toMatchObject({ active: false });
  });
});
