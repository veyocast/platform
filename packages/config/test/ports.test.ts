import { describe, expect, it } from "vitest";

import { VEYOCAST_APPS, VEYOCAST_PORTS, getLocalUrl } from "../src/index";

describe("VeyoCast local runtime config", () => {
  it("keeps the documented app ports stable", () => {
    expect(VEYOCAST_PORTS).toEqual({
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
    for (const [appId, appConfig] of Object.entries(VEYOCAST_APPS)) {
      expect(appConfig.id).toBe(appId);
    }
  });
});
