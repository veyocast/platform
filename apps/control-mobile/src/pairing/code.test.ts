import { describe, expect, it } from "vitest";

import { normalizePairingCode, pairingCodeFromScan } from "./code";

describe("mobile pairing code parser", () => {
  it("normalizes a typed code", () => {
    expect(normalizePairingCode("ab-12 cd")).toBe("AB12CD");
  });

  it("accepts a direct code or HTTPS locator without retaining secrets", () => {
    expect(pairingCodeFromScan("ABC123")).toBe("ABC123");
    expect(
      pairingCodeFromScan("https://control.veyocast.nl/mobile/pair?code=ZX90QW")
    ).toBe("ZX90QW");
    expect(
      pairingCodeFromScan(
        "https://control.veyocast.nl/mobile/pair?device_token=secret"
      )
    ).toBeNull();
  });
});
