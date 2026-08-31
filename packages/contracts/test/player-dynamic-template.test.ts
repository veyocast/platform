import { describe, expect, it } from "vitest";

import { playerDynamicTemplatePayloadSchema } from "../src/dynamic-content";

describe("Player dynamic template payload", () => {
  const payload = {
    data: {
      brand: { primaryColor: "#ff5a1f" },
      menu: { products: [], title: "Menu vandaag" },
      type: "menu"
    },
    orientation: "portrait",
    schemaVersion: 1,
    slideType: "menu",
    snapshotHash: "a".repeat(64),
    snapshotId: "11111111-1111-4111-8111-111111111111",
    templateSlug: "menu-clubhouse-dark-portrait",
    templateVersionId: "22222222-2222-4222-8222-222222222222"
  };

  it("accepteert alleen een versiegebonden platformtemplate", () => {
    expect(playerDynamicTemplatePayloadSchema.parse(payload)).toEqual(payload);
  });

  it("weigert vrije templatebron en een ongeldige revision hash", () => {
    expect(
      playerDynamicTemplatePayloadSchema.safeParse({
        ...payload,
        html: "<script>alert(1)</script>",
        snapshotHash: "niet-verifieerbaar"
      }).success
    ).toBe(false);
  });

  it("accepteert een immutable LED Scores-livebinding zonder provider-URL", () => {
    const livePayload = {
      ...payload,
      data: {
        liveMatch: {
          configuration: { staleBehavior: "freeze", template: "match_center" },
          connectionId: "33333333-3333-4333-8333-333333333333",
          state: { schemaVersion: 1, status: "live" }
        },
        type: "ledscores_live_match"
      },
      orientation: "landscape",
      slideType: "ledscores_live_match",
      templateSlug: "ledscores-live-match-landscape"
    };

    expect(playerDynamicTemplatePayloadSchema.parse(livePayload)).toEqual(livePayload);
    expect(JSON.stringify(livePayload)).not.toContain("wss.ledscores");
  });
});
