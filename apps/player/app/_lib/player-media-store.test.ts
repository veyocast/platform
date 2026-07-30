import { describe, expect, it } from "vitest";

import { shouldUseObjectUrlForCachedPlayback } from "./player-media-store";

describe("cached playback URL-strategie", () => {
  it("gebruikt op de LG-route een object-URL ondanks een actieve serviceworker", () => {
    expect(
      shouldUseObjectUrlForCachedPlayback({
        pathname: "/lg",
        serviceWorkerControlled: true,
        userAgent:
          "Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/79.0.3945.79 Safari/537.36"
      })
    ).toBe(true);
  });

  it("gebruikt voor generieke browsers de range-capabele serviceworker-URL", () => {
    expect(
      shouldUseObjectUrlForCachedPlayback({
        pathname: "/",
        serviceWorkerControlled: true,
        userAgent: "Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36"
      })
    ).toBe(false);
  });

  it("valt zonder serviceworkercontroller terug op een object-URL", () => {
    expect(
      shouldUseObjectUrlForCachedPlayback({
        pathname: "/",
        serviceWorkerControlled: false,
        userAgent: "Generic Browser"
      })
    ).toBe(true);
  });
});
