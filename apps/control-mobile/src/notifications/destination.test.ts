import { describe, expect, it } from "vitest";

import { notificationDestination } from "./destination";

describe("notification destination", () => {
  it("routes only allowlisted native destinations", () => {
    expect(notificationDestination({ destination: "content" })).toBe(
      "/(tabs)/content"
    );
    expect(notificationDestination({ destination: "https://evil.test" })).toBe(
      null
    );
  });

  it("accepts only a valid screen UUID", () => {
    expect(
      notificationDestination({
        screenId: "7a28c2cb-b028-40a7-b53b-596f3f59f6b5"
      })
    ).toBe("/screens/7a28c2cb-b028-40a7-b53b-596f3f59f6b5");
    expect(notificationDestination({ screenId: "../../account" })).toBeNull();
  });
});
