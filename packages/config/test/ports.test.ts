import { describe, expect, it } from "vitest";

import { CASTIVO_APPS, CASTIVO_PORTS, getLocalUrl } from "../src/index";

describe("Castivo local runtime config", () => {
  it("keeps the documented app ports stable", () => {
    expect(CASTIVO_PORTS).toEqual({
      control: 3000,
      player: 3001,
      marketing: 3002,
      "media-worker": 3100
    });
  });

  it("derives local URLs from app ids", () => {
    expect(getLocalUrl("control")).toBe("http://localhost:3000");
    expect(getLocalUrl("player")).toBe("http://localhost:3001");
    expect(getLocalUrl("marketing")).toBe("http://localhost:3002");
  });

  it("keeps every app config keyed by its own id", () => {
    for (const [appId, appConfig] of Object.entries(CASTIVO_APPS)) {
      expect(appConfig.id).toBe(appId);
    }
  });
});
