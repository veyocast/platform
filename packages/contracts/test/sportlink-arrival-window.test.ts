import { describe, expect, it } from "vitest";

import {
  sportlinkArrivalConfigSchema,
  sportlinkArrivalWindowMaxMinutes
} from "../src/sportlink-slide-blueprints";

describe("Sportlink-aankomstvenster", () => {
  it("accepteert 10.000 minuten vooruit", () => {
    expect(sportlinkArrivalConfigSchema.parse({
      minutesBefore: 10_000
    }).minutesBefore).toBe(10_000);
  });

  it("begrenst de invoer op de providerhorizon van 42 dagen", () => {
    expect(sportlinkArrivalWindowMaxMinutes).toBe(60_480);
    expect(sportlinkArrivalConfigSchema.safeParse({
      minutesBefore: sportlinkArrivalWindowMaxMinutes + 1
    }).success).toBe(false);
  });
});
