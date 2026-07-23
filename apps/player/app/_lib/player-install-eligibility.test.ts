import { describe, expect, it } from "vitest";

import { isAndroidPwaInstallEligible } from "./player-install-eligibility";

describe("Android Player-installatiegeschiktheid", () => {
  it("biedt installatie alleen in een normale Android-browser aan", () => {
    expect(
      isAndroidPwaInstallEligible({
        referrer: "",
        standalone: false,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126"
      })
    ).toBe(true);
  });

  it("toont geen PWA-installatiekaart in de native Android-shell", () => {
    expect(
      isAndroidPwaInstallEligible({
        referrer: "",
        standalone: false,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; TV) AppleWebKit/537.36 VeyoCastAndroidTV/1.0.0"
      })
    ).toBe(false);
  });

  it("toont geen installatiekaart in een reeds geïnstalleerde app", () => {
    expect(
      isAndroidPwaInstallEligible({
        referrer: "android-app://nl.veyocast.player/",
        standalone: false,
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/126"
      })
    ).toBe(false);
    expect(
      isAndroidPwaInstallEligible({
        referrer: "",
        standalone: true,
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/126"
      })
    ).toBe(false);
  });
});
