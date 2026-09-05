import { describe, expect, it } from "vitest";

import { slideComposerErrorPath } from "./slide-composer-validation";

describe("nieuwsslide-validatie", () => {
  it("behoudt de nieuwsfamilie en foutmelding in de wizardroute", () => {
    const path = slideComposerErrorPath(
      "news",
      "De slide kon tijdelijk niet worden gemaakt."
    );
    const url = new URL(path, "https://control.veyocast.nl");
    expect(url.pathname).toBe("/dashboard/slides/new");
    expect(url.searchParams.get("family")).toBe("news");
    expect(url.searchParams.get("fout")).toBe(
      "De slide kon tijdelijk niet worden gemaakt."
    );
  });
});
