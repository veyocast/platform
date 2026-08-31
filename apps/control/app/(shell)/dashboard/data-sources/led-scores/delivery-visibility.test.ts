import { describe, expect, it } from "vitest";

import {
  deliveryDisplayState,
  deliveryLatencyMs,
  formatDeliveryLatency,
  heartbeatDisplayState,
  safeDeliveryDetail,
  type GoalDeliveryRow
} from "./delivery-visibility";

const base: GoalDeliveryRow = {
  dispatched_at: "2026-08-31T15:20:47.500Z",
  execute_at: "2026-08-31T15:20:48.250Z",
  expires_at: "2026-08-31T15:20:59.000Z",
  failed_at: null,
  outcome_detail: null,
  received_at: null,
  rendered_at: null,
  skipped_at: null,
  status: "pending"
};

describe("LED Scores afleverzichtbaarheid", () => {
  it("onderscheidt klaargezet van verlopen zonder ontvangst", () => {
    expect(deliveryDisplayState(base, Date.parse("2026-08-31T15:20:50Z"))).toMatchObject({
      key: "pending",
      label: "Klaargezet"
    });
    expect(deliveryDisplayState(base, Date.parse("2026-08-31T15:21:00Z"))).toMatchObject({
      key: "expired",
      label: "Verlopen zonder ontvangst"
    });
  });

  it("claimt na de eindtijd niet dat ontvangst nog een lopende toestand is", () => {
    expect(deliveryDisplayState({
      ...base,
      received_at: "2026-08-31T15:20:51Z",
      status: "received"
    }, Date.parse("2026-08-31T15:21:00Z"))).toMatchObject({
      key: "expired",
      label: "Verlopen na ontvangst"
    });
  });

  it("geeft een terminale Playeruitkomst voorrang op oude tussenstatus", () => {
    expect(deliveryDisplayState({
      ...base,
      rendered_at: "2026-08-31T15:20:48.394Z",
      status: "received"
    })).toMatchObject({ key: "rendered", label: "Getoond" });
    expect(deliveryDisplayState({
      ...base,
      failed_at: "2026-08-31T15:20:48.500Z",
      rendered_at: "2026-08-31T15:20:48.394Z",
      status: "failed"
    })).toMatchObject({ key: "failed", label: "Mislukt" });
  });

  it("berekent bron-naar-uitkomstlatency en formatteert die compact", () => {
    const delivery = {
      ...base,
      rendered_at: "2026-08-31T15:20:48.394Z",
      status: "rendered"
    };
    const latency = deliveryLatencyMs(delivery, "2026-08-31T15:20:47.000Z");
    expect(latency).toBe(1_394);
    expect(formatDeliveryLatency(latency)).toBe("1.4 sec.");
  });

  it("vertaalt bekende details en begrenst onbekende diagnostiek", () => {
    expect(safeDeliveryDetail("render_latency_ms:12")).toBe("Player renderde in 12 ms");
    expect(safeDeliveryDetail("execute_window_expired")).toBe("Uitvoervenster was al verlopen");
    expect(safeDeliveryDetail("replaced_before_activation"))
      .toBe("Vervangen door een nieuwere Goal Alert vóór weergave");
    expect(safeDeliveryDetail("duplicate_event_before_activation"))
      .toBe("Dubbel event vóór weergave overgeslagen");
    expect(safeDeliveryDetail("execute_time_too_far"))
      .toBe("Uitvoertijd lag te ver in de toekomst");
    expect(safeDeliveryDetail("invalid_goal_payload"))
      .toBe("Goal Alert bevatte ongeldige gegevens");
    expect(safeDeliveryDetail("device_credential_removed"))
      .toBe("Playerkoppeling was ingetrokken");
    expect(safeDeliveryDetail(`fout https://example.test/${"a".repeat(80)} ${"x".repeat(180)}`))
      .not.toContain("example.test");
    expect(safeDeliveryDetail("x".repeat(200))?.length).toBeLessThanOrEqual(140);
  });

  it("noemt Playercontact eerlijk een heartbeat en geen realtimeverbinding", () => {
    const now = Date.parse("2026-08-31T15:20:00.000Z");
    expect(heartbeatDisplayState("2026-08-31T15:19:00.000Z", now).label)
      .toBe("Recente heartbeat");
    expect(heartbeatDisplayState("2026-08-31T14:00:00.000Z", now).label)
      .toBe("Geen recente heartbeat");
  });
});
