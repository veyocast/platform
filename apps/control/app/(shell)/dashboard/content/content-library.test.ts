import { describe, expect, it } from "vitest";
import { contentLibraryHref, contentReadableKinds, contentTypeLabel, isContentRoute, contentSearchPattern, legacyStudioIndexHref, parseContentLibraryQuery } from "./content-library";
import { contentCreateTasks, contentTaskScopes, contentWizardHref } from "../studio/content-create-catalog";
import { syncContentFamilies } from "@veyocast/contracts";

describe("Content route and task compatibility", () => {
  it("uses matching task labels and keeps Content active on original editor families", () => {
    expect([contentTypeLabel("studio", "free"), contentTypeLabel("dynamic", "results"), contentTypeLabel("dynamic", "menu"), contentTypeLabel("dynamic", "price_list"), contentTypeLabel("series", "series")]).toEqual(["Ontwerp", "Automatische slide", "Menu", "Menu", "Reeks"]);
    for (const path of ["/dashboard/content", "/dashboard/studio/id", "/dashboard/media/source/id", "/dashboard/slides/menu-studio/id", "/dashboard/slides/id/versions/v1"]) expect(isContentRoute(path), path).toBe(true);
    for (const path of ["/dashboard/sources", "/dashboard/products", "/dashboard/engage", "/dashboard/sponsors", "/dashboard/playlists", "/dashboard/studiotrick"]) expect(isContentRoute(path), path).toBe(false);
  });

  it("searches LIKE aliases and regex punctuation literally without changing normal search", () => {
    expect(contentSearchPattern("50% _club")).toEqual({ operator: "ilike", value: "%50\\% \\_club%" });
    const query = "Club* (A+B) [1].$?";
    const pattern = contentSearchPattern(query);
    expect(pattern.operator).toBe("imatch");
    expect(new RegExp(pattern.value, "i").test(`Eigen ${query} ontwerp`)).toBe(true);
    expect(new RegExp(pattern.value, "i").test("Club% (A+B) [1].$?")).toBe(false);
    expect(new RegExp(pattern.value, "i").test("ClubOTHER (A+B) [1].$?")).toBe(false);
  });
  it("bounds URL input and retains old status/non-media bookmarks", () => {
    expect(parseContentLibraryQuery({ q: "  club  ", filter: "archive", page: "-2" })).toEqual({ query: "club", filter: "all", status: "archive", page: 1, size: 48 });
    expect(parseContentLibraryQuery({ filter: "slides", page: "2", pageSize: "24" })).toMatchObject({ filter: "slides", page: 2, size: 24 });
    expect(parseContentLibraryQuery({ filter: "https://foreign.invalid", status: "other", page: "Infinity", q: ["private"] })).toMatchObject({ filter: "all", status: "active", page: 100000, query: "" });
  });
  it("retains search, type, status and legacy menu page size across pagination", () => {
    const state = parseContentLibraryQuery({ q: "A&B", filter: "menus", status: "archive", page: "2", pageSize: "24" });
    expect(contentLibraryHref(state, { page: 3 })).toBe("/dashboard/content?filter=menus&status=archive&page=3&q=A%26B&pageSize=24");
    expect(contentLibraryHref(state, { filter: "media", page: 1 })).toContain("filter=media&status=archive&page=1");
  });
  it("keeps task read access independent of overview permission", () => {
    expect(contentReadableKinds(["tenant.media.read"])).toEqual(["media"]);
    expect(contentReadableKinds(["tenant.studio.read"])).toEqual(["studio", "series"]);
    expect(contentReadableKinds(["tenant.dynamic_slide.read"])).toEqual(["dynamic"]);
    expect(contentReadableKinds(["tenant.overview.read", "tenant.media.write"])).toEqual([]);
  });
  it("keeps advanced Studio query intent and only maps equivalent plain indexes", () => {
    expect(legacyStudioIndexHref({ q: "Team 1", status: "archived" })).toBe("/dashboard/content?filter=designs&status=archive&page=1&q=Team+1");
    const href = legacyStudioIndexHref({ q: "Team", format: "portrait", owner: "mine", status: "deleted", sort: "name" });
    expect(href).toBe("/dashboard/studio?advanced=1&format=portrait&owner=mine&sort=name&q=Team&status=deleted");
    expect(legacyStudioIndexHref({ q: "//foreign.invalid" })).toMatch(/^\/dashboard\/content\?/);
  });
  it("bundles scopes while preserving every original family and mode URL", () => {
    expect(contentCreateTasks.filter(task => task.id.includes("results")).map(task => task.id)).toEqual(["results"]);
    expect(contentTaskScopes("results").map(scope => scope.family)).toEqual(["club-results", "team-results", "pool-results"]);
    expect(contentTaskScopes("fixtures").map(scope => scope.family)).toEqual(["club-program", "team-program", "pool-program"]);
    for (const family of syncContentFamilies) expect(new URL(contentWizardHref(family.id, "connected"), "http://localhost").searchParams.get("family")).toBe(family.id);
    expect(contentWizardHref("results", "manual")).toBe("/dashboard/studio/new?family=results&mode=manual");
  });
});
