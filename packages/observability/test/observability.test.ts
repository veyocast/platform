import { describe, expect, it } from "vitest";

import {
  alertDefinitions,
  createStructuredLogger,
  createSupportBundle,
  evaluateAlert,
  isObservabilityEvent,
  redactObservabilityValue,
  sloDefinitions
} from "../src";

describe("structured observability", () => {
  it("redacts secrets, URLs, email and signed query data recursively", () => {
    expect(redactObservabilityValue({
      databaseUrl: "postgres://admin:secret@example.test/db",
      detail: "Mail operator@example.test via https://storage.test/file?token=secret en postgres://operator:secret@db.test/app",
      nested: { authorization: "Bearer abc.def.ghi" }
    })).toEqual({
      databaseUrl: "[REDACTED]",
      detail: "Mail [REDACTED] via [REDACTED] en [REDACTED]",
      nested: { authorization: "[REDACTED]" }
    });
  });

  it("writes one bounded JSON event without leaking fields", () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      correlationId: "upload_12345678",
      environment: "staging west",
      revision: "abc123",
      service: "media-worker"
    }, (line) => lines.push(line));
    logger.error("media.job.failed", { retry: 2, signedUrl: "https://storage.test/a?token=x" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      correlation_id: "upload_12345678",
      environment: "staging_west",
      event: "media.job.failed",
      fields: { retry: 2, signedUrl: "[REDACTED]" },
      level: "error",
      service: "media-worker"
    });
  });

  it("recognises the privacy-safe Studio render events", () => {
    expect(isObservabilityEvent("studio.render.queue_polled")).toBe(true);
    expect(isObservabilityEvent("studio.render.completed")).toBe(true);
    expect(isObservabilityEvent("studio.render.failed")).toBe(true);
    expect(isObservabilityEvent("dynamic.render.queue_polled")).toBe(true);
    expect(isObservabilityEvent("dynamic.render.completed")).toBe(true);
    expect(isObservabilityEvent("dynamic.render.failed")).toBe(true);
    expect(isObservabilityEvent("led_scores.live_image.requested")).toBe(true);
  });
});

describe("operational contracts", () => {
  it("gives every critical alert an owner, runbook, threshold and Control deep link", () => {
    expect(alertDefinitions).toHaveLength(11);
    for (const alert of alertDefinitions) {
      expect(alert.owner).toBeTruthy();
      expect(alert.runbook).toMatch(/^docs\//);
      expect(alert.controlPath).toMatch(/^\//);
      expect(alert.threshold.value).toBeGreaterThan(0);
    }
    expect(sloDefinitions.map(({ id }) => id)).toEqual([
      "upload_finalization", "processing_queue_wait", "publish_duration",
      "desired_to_active", "heartbeat_freshness", "player_startup"
    ]);
  });

  it("fires only after both value and duration cross the configured threshold", () => {
    const observedAt = "2026-07-21T10:00:00Z";
    expect(evaluateAlert({ alertId: "media_queue_age", breachingForMinutes: 5, observedAt, value: 61 }).firing).toBe(true);
    expect(evaluateAlert({ alertId: "media_queue_age", breachingForMinutes: 4, observedAt, value: 61 }).firing).toBe(false);
    expect(evaluateAlert({ alertId: "tls_expiry", breachingForMinutes: 60, observedAt, value: 13 }).firing).toBe(true);
    expect(evaluateAlert({ alertId: "deployment_unhealthy", breachingForMinutes: 2, observedAt, value: 1 }).firing).toBe(true);
  });

  it("exports only the explicit support bundle allowlist", () => {
    const bundle = createSupportBundle({
      appVersion: "1.0.0",
      environment: "staging",
      events: [
        { code: "media.job.failed", occurredAt: "2026-07-21T10:00:00Z", result: "failed" },
        { code: "operator@example.test", occurredAt: "2026-07-21T10:01:00Z", result: "private" }
      ],
      generatedAt: "2026-07-21T11:00:00Z",
      releaseIds: ["15fdfc9b-20f7-4d6f-8fad-080cff918b7a"],
      revision: "abc123",
      service: "control",
      window: { from: "2026-07-21T10:00:00Z", to: "2026-07-21T11:00:00Z" }
    });
    expect(Object.keys(bundle).sort()).toEqual([
      "app_version", "environment", "events", "generated_at", "release_ids",
      "revision", "schema_version", "service", "window"
    ]);
    expect(bundle.events[1]).toMatchObject({ code: "unknown_event", result: "unknown" });
    expect(JSON.stringify(bundle)).not.toMatch(/token|url|credential|user.?agent|raw/i);
  });
});
