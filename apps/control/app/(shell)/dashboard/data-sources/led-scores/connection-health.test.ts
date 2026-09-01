import { describe, expect, it } from "vitest";

import {
  isLedScoresProviderConnected,
  ledScoresConnectionHealth
} from "./connection-health";

const now = Date.parse("2026-09-01T10:00:00.000Z");
const activeLease = "2026-09-01T10:00:45.000Z";

describe("LED Scores verbindingsstatus", () => {
  it("houdt een change-driven bron na meer dan 120 seconden stilte verbonden", () => {
    expect(ledScoresConnectionHealth({
      connectionStatus: "active",
      healthStatus: "connected",
      lastConnectedAt: "2026-09-01T09:50:00.000Z",
      lastSourceMessageAt: "2026-09-01T09:57:59.000Z",
      leaseExpiresAt: activeLease,
      now
    })).toEqual({ label: "Verbonden", tone: "success" });
  });

  it("maakt zichtbaar dat een verbonden bron nog op het eerste bericht wacht", () => {
    expect(ledScoresConnectionHealth({
      connectionStatus: "active",
      healthStatus: "connected",
      lastConnectedAt: "2026-09-01T09:59:50.000Z",
      lastSourceMessageAt: null,
      leaseExpiresAt: activeLease,
      now
    })).toEqual({
      label: "Verbonden · wacht op eerste bericht",
      tone: "info"
    });
  });

  it("gebruikt een oud bronbericht niet als readinessbewijs na reconnect", () => {
    expect(ledScoresConnectionHealth({
      connectionStatus: "active",
      healthStatus: "connected",
      lastConnectedAt: "2026-09-01T09:59:50.000Z",
      lastSourceMessageAt: "2026-09-01T09:58:00.000Z",
      leaseExpiresAt: activeLease,
      now
    })).toEqual({
      label: "Verbonden · wacht op eerste bericht",
      tone: "info"
    });
  });

  it("telt een verlopen workerlease nooit als verbonden provider", () => {
    const input = {
      connectionStatus: "active",
      healthStatus: "connected",
      lastConnectedAt: "2026-09-01T09:50:00.000Z",
      lastSourceMessageAt: "2026-09-01T09:57:59.000Z",
      leaseExpiresAt: "2026-09-01T09:59:59.000Z",
      now
    };

    expect(ledScoresConnectionHealth(input))
      .toEqual({ label: "Verbinding verlopen", tone: "warning" });
    expect(isLedScoresProviderConnected(
      input.healthStatus,
      input.leaseExpiresAt,
      now
    )).toBe(false);
  });

  it("behoudt duidelijke herstelstatussen voor niet-verbonden bronnen", () => {
    const input = {
      connectionStatus: "active",
      healthStatus: "connected",
      lastConnectedAt: null,
      lastSourceMessageAt: null,
      leaseExpiresAt: activeLease,
      now
    };
    expect(ledScoresConnectionHealth({ ...input, connectionStatus: "paused" }))
      .toEqual({ label: "Uitgeschakeld", tone: "neutral" });
    expect(ledScoresConnectionHealth({ ...input, healthStatus: "reconnecting" }))
      .toEqual({ label: "Opnieuw verbinden", tone: "warning" });
    expect(ledScoresConnectionHealth({ ...input, healthStatus: "error" }))
      .toEqual({ label: "Verbindingsfout", tone: "critical" });
  });
});
