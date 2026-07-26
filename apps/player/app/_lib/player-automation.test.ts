import { describe, expect, it } from "vitest";

import {
  clearAutomationReport,
  localStorageAutomationReportKey,
  localStorageAutomationSyncKey,
  readAutomationCapabilities,
  readAutomationReport,
  storeAutomationSync
} from "./player-automation";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

const report = {
  commandId: null,
  diagnosticCode: null,
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventType: "schedule-evaluated" as const,
  metadata: { active: true },
  occurredAt: "2026-07-26T10:00:00.000Z",
  scheduledFor: null,
  status: "success" as const
};

describe("player automation bridge storage", () => {
  it("reads and conditionally acknowledges one idempotent native report", () => {
    const storage = memoryStorage({
      [localStorageAutomationReportKey]: JSON.stringify(report)
    });
    const parsed = readAutomationReport(storage);
    expect(parsed).toEqual(report);
    clearAutomationReport(storage, {
      ...report,
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    });
    expect(storage.getItem(localStorageAutomationReportKey)).not.toBeNull();
    clearAutomationReport(storage, report);
    expect(storage.getItem(localStorageAutomationReportKey)).toBeNull();
  });

  it("rejects malformed reports and capability payloads", () => {
    const storage = memoryStorage({
      [localStorageAutomationReportKey]: "{\"eventType\":\"fake\"}"
    });
    expect(readAutomationReport(storage)).toBeNull();
    expect(readAutomationCapabilities(storage)).toBeNull();
  });

  it("persists only the validated server sync envelope", () => {
    const storage = memoryStorage();
    expect(storeAutomationSync(storage, { command: null, settings: null })).toBe(true);
    expect(storage.getItem(localStorageAutomationSyncKey)).toBe(
      "{\"command\":null,\"settings\":null}"
    );
    expect(
      storeAutomationSync(storage, { command: { id: "unsafe" }, settings: null })
    ).toBe(false);
  });
});
