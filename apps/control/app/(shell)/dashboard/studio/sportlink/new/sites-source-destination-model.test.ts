import { describe, expect, it } from "vitest";
import { initialSitesSourceDestination, toggleSitesSourceDestinationScreens, validSitesSourceDestination, type SitesSourceDestinationOptions } from "./sites-source-destination-model";
const options: SitesSourceDestinationOptions = { canPublish: true, unavailable: false, playlists: [{ id: "playlist", name: "Kantine", revision: 4 }], screens: [{ id: "screen1", name: "Kantine", orientation: "landscape" }, { id: "screen2", name: "Entree", orientation: "portrait" }], groups: [{ id: "group", name: "Club", screenIds: ["screen1", "screen2"] }] };
describe("Echte wizardbestemming behoudt keuzes en vereiste CAS-revisie", () => {
  it("laat save-only zonder publicatierechten toe maar vereist bestaande playlist, schermen en revisie bij publicatie", () => {
    expect(validSitesSourceDestination(initialSitesSourceDestination, { ...options, canPublish: false })).toBe(true);
    const selected = { mode: "publish" as const, playlistId: "playlist", expectedRevision: 4, screenIds: ["screen1"] };
    expect(validSitesSourceDestination(selected, options)).toBe(true);
    for (const value of [{ ...selected, expectedRevision: 3 }, { ...selected, playlistId: "missing" }, { ...selected, screenIds: ["other-tenant"] }, { ...selected, screenIds: [] }, { ...selected, screenIds: ["screen1", "screen1"] }]) expect(validSitesSourceDestination(value, options)).toBe(false);
    expect(validSitesSourceDestination(selected, { ...options, unavailable: true })).toBe(false); expect(validSitesSourceDestination(selected, { ...options, canPublish: false })).toBe(false);
  });
  it("dedupliceert echte groep-/schermselecties en respecteert de honderdschermgrens", () => {
    expect(toggleSitesSourceDestinationScreens(["screen1"], ["screen1", "screen2"], true)).toEqual(["screen1", "screen2"]);
    expect(toggleSitesSourceDestinationScreens(["screen1", "screen2"], ["screen2"], false)).toEqual(["screen1"]);
    const current = Array.from({ length: 99 }, (_, index) => `actual-screen-${index}`);
    expect(toggleSitesSourceDestinationScreens(current, ["new1", "new2"], true)).toHaveLength(100); expect(current).toHaveLength(99);
  });
});
