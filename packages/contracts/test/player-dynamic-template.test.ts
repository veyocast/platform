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
});
