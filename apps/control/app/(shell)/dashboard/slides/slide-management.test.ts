import { describe, expect, it } from "vitest";
import { slideAvailability, slideEditorKind, slidePurpose } from "./slide-management";
import { parseSlideResourceFilter, slidePageHref } from "./slide-resource";

describe("datagedreven slidebeheer", () => {
  it.each([
    ["sportlink.pool_standings", "sportlink"],
    ["sportlink.pool_schedule_next_7_days", "sportlink"],
    ["sportlink.club_results_today", "sportlink"],
    ["sportlink.birthdays", "detail"],
    ["unknown", "detail"]
  ])("stuurt %s alleen naar een editor die dit contract ondersteunt", (blueprintKey, expected) => {
    expect(slideEditorKind({ blueprintKey })).toBe(expected);
  });
  it("behoudt de bestaande Menu Studio-route", () => {
    expect(slideEditorKind({ schemaVersion: "menu-document.v2" })).toBe("menu");
    expect(slideEditorKind(null)).toBe("detail");
  });
  it("beschrijft periode en scope zonder extra slidetype te verzinnen", () => {
    expect(slidePurpose({ blueprintKey: "sportlink.pool_schedule_today" })).toBe("Pouleprogramma vandaag");
    expect(slidePurpose({})).toBeNull();
  });
  const base = { archived: false, error: false, itemCount: 0, pending: false, snapshot: null };
  it("verwisselt publicatie niet met beschikbare inhoud", () => {
    expect(slideAvailability(base).label).toBe("Nu geen inhoud");
    expect(slideAvailability({ ...base, itemCount: 3 }).label).toBe("Inhoud beschikbaar");
  });
  it.each([
    ["COMPETITION_CONTEXT_UNRESOLVED", "Competitie kiezen", "eenduidig"],
    ["STANDINGS_NOT_PUBLISHED", "Nu geen inhoud", "openbare stand"],
    ["NO_ITEMS_IN_PERIOD", "Nu geen inhoud", "Gestarte wedstrijden"],
    ["RESULTS_NOT_PUBLISHED", "Nu geen inhoud", "gestarte wedstrijden"],
    ["NO_ARRIVALS_IN_WINDOW", "Nu geen inhoud", "aankomsten"]
  ])("geeft een bruikbare verklaring voor %s", (code, label, explanation) => {
    const result = slideAvailability({ ...base, snapshot: { sport: { emptyStateCode: code } } });
    expect(result.label).toBe(label);
    expect(result.detail).toContain(explanation);
  });
  it("houdt beschikbare content herkenbaar tijdens een verversing", () => {
    expect(slideAvailability({ ...base, pending: true, itemCount: 2 }).label).toBe("Inhoud beschikbaar");
    expect(slideAvailability({ ...base, pending: true }).label).toBe("Wordt bijgewerkt");
    expect(slideAvailability({ ...base, error: true }).label).toBe("Controle nodig");
    expect(slideAvailability({ ...base, archived: true }).label).toBe("Gearchiveerd");
  });
  it("filtert op bestaande typen en bewaart het filter bij pagineren", () => {
    expect(parseSlideResourceFilter({ kind: "sport_standing" }).kind).toBe("sport_standing");
    expect(parseSlideResourceFilter({ kind: "arbitrary" }).kind).toBe("all");
    expect(slidePageHref({ kind: "sport_standing" }, 2)).toBe("/dashboard/slides?kind=sport_standing&page=2");
  });
});
