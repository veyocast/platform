import { describe, expect, it } from "vitest";

import { reportToMarkdown, type DeviceLabReport } from "./device-lab-core";

describe("Device Lab report export", () => {
  it("exports explicit evidence statuses without claiming LG verification", () => {
    const report: DeviceLabReport = {
      appVersion: "test",
      capabilities: [{ detail: "API exists", id: "sw", label: "Service Worker", status: "PASS" }],
      capturedAt: "2026-07-18T12:00:00.000Z",
      codecs: [{ canPlayType: "maybe", detail: "indicative", id: "h264", label: "H.264", status: "WARNING" }],
      deploymentSha: "abc123",
      device: { platform: "DESKTOP_CHROMIUM", userAgent: "test" },
      errors: [],
      firmware: "",
      lgModel: "",
      manualTests: [{ detail: "physical", id: "reboot", label: "Offline reboot", status: "REQUIRES_MANUAL_TEST" }],
      playback: [],
      runId: "00000000-0000-4000-8000-000000000000",
      transitions: []
    };

    const markdown = reportToMarkdown(report);
    expect(markdown).toContain("**WARNING** — H.264");
    expect(markdown).toContain("**REQUIRES_MANUAL_TEST** — Offline reboot");
    expect(markdown).not.toContain("VERIFIED_ON_LG");
  });
});
