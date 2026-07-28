import { describe, expect, it } from "vitest";

import {
  mobilePairingClaimRequestSchema,
  mobilePlaylistPublishRequestSchema,
  mobilePlayerCommandRequestSchema
} from "../src/mobile-control";

describe("mobile Control contracts", () => {
  it("normalizes pairing codes without accepting secrets in the payload", () => {
    const result = mobilePairingClaimRequestSchema.safeParse({
      code: "AB12CD",
      idempotencyKey: "6ccfb8e2-7381-438e-9964-8f5452448771",
      screenId: "7a28c2cb-b028-40a7-b53b-596f3f59f6b5"
    });

    expect(result.success).toBe(true);
    expect(
      mobilePairingClaimRequestSchema.safeParse({
        code: "https://example.test/?token=secret",
        idempotencyKey: "6ccfb8e2-7381-438e-9964-8f5452448771",
        screenId: "7a28c2cb-b028-40a7-b53b-596f3f59f6b5"
      }).success
    ).toBe(false);
  });

  it("allows only server-supported idempotent player commands", () => {
    const common = {
      idempotencyKey: "6ccfb8e2-7381-438e-9964-8f5452448771",
      screenId: "7a28c2cb-b028-40a7-b53b-596f3f59f6b5"
    };

    expect(
      mobilePlayerCommandRequestSchema.safeParse({
        ...common,
        commandType: "RELOAD_PLAYER",
        ttlSeconds: 300
      }).success
    ).toBe(true);
    expect(
      mobilePlayerCommandRequestSchema.safeParse({
        ...common,
        commandType: "NEXT_ITEM"
      }).success
    ).toBe(false);
  });

  it("requires an explicit, bounded target selection for publication", () => {
    const valid = {
      confirmWarnings: false,
      expectedRevision: 4,
      idempotencyKey: "6ccfb8e2-7381-438e-9964-8f5452448771",
      releaseNotes: "Kantine bijgewerkt",
      screenIds: ["7a28c2cb-b028-40a7-b53b-596f3f59f6b5"]
    };

    expect(mobilePlaylistPublishRequestSchema.safeParse(valid).success).toBe(
      true
    );
    expect(
      mobilePlaylistPublishRequestSchema.safeParse({
        ...valid,
        screenIds: []
      }).success
    ).toBe(false);
  });
});
