import { describe, expect, it } from "vitest";

import {
  deriveScreenHealth,
  screenOnlineWindowMs,
  screenStaleWindowMs
} from "./screen-health";

const now = new Date("2026-08-24T12:00:00.000Z");

describe("deriveScreenHealth", () => {
  it("keeps lifecycle and pairing states distinct", () => {
    expect(deriveScreenHealth({ screenStatus: "disabled" }, now).kind).toBe("disabled");
    expect(deriveScreenHealth({ screenStatus: "maintenance" }, now).kind).toBe("maintenance");
    expect(deriveScreenHealth({ screenStatus: "active" }, now).kind).toBe("unpaired");
    expect(deriveScreenHealth({ deviceStatus: "paired", screenStatus: "active" }, now).kind).toBe("unknown");
  });

  it("does not present stale or offline telemetry as healthy", () => {
    expect(deriveScreenHealth({
      deviceStatus: "paired",
      lastSeenAt: new Date(now.getTime() - screenOnlineWindowMs).toISOString(),
      screenStatus: "active"
    }, now).kind).toBe("stale");
    expect(deriveScreenHealth({
      deviceStatus: "paired",
      lastSeenAt: new Date(now.getTime() - screenStaleWindowMs).toISOString(),
      screenStatus: "active"
    }, now).kind).toBe("offline");
  });

  it("shows syncing only while the Player is recently confirmed", () => {
    expect(deriveScreenHealth({
      activeReleaseId: "release-a",
      desiredReleaseId: "release-b",
      deviceStatus: "paired",
      lastSeenAt: new Date(now.getTime() - 30_000).toISOString(),
      screenStatus: "active"
    }, now).kind).toBe("syncing");
  });
});
