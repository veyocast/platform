import { describe, expect, it } from "vitest";

import {
  parseSlideResourceFilter,
  slideFilterCount,
  slidePageHref,
  slideResourceStatus
} from "./slide-resource";

describe("slide-resourceoverzicht", () => {
  it("normaliseert onbetrouwbare queryparameters naar begrensde serverfilters", () => {
    expect(parseSlideResourceFilter({
      page: "-4",
      q: `  ${"a".repeat(160)}  `,
      sort: "unknown",
      status: "deleted"
    })).toEqual({
      kind: "all",
      page: 1,
      query: "a".repeat(120),
      sort: "updated-desc",
      status: "all"
    });
  });

  it("vertaalt technische verwerking naar de drie zichtbare lifecycle-statussen", () => {
    expect(slideResourceStatus("ready")).toBe("active");
    expect(slideResourceStatus("archived")).toBe("inactive");
    expect(slideResourceStatus("draft")).toBe("concept");
    expect(slideResourceStatus("rendering")).toBe("concept");
    expect(slideResourceStatus("error")).toBe("concept");
    expect(slideResourceStatus("rendering", true)).toBe("active");
    expect(slideResourceStatus("error", true)).toBe("active");
    expect(slideResourceStatus("archived", true)).toBe("inactive");
  });

  it("bewaart filters in paginalinks zonder standaardruis", () => {
    expect(slidePageHref({ q: "programma", sort: "name", status: "active" }, 3))
      .toBe("/dashboard/slides?q=programma&status=active&sort=name&page=3");
    expect(slidePageHref({}, 1)).toBe("/dashboard/slides");
  });

  it("telt alleen afwijkende filters", () => {
    expect(slideFilterCount(parseSlideResourceFilter({}))).toBe(0);
    expect(slideFilterCount(parseSlideResourceFilter({ q: "club", status: "active" }))).toBe(2);
  });
});
