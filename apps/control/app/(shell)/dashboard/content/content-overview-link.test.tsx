import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.stubGlobal("React", React);
vi.mock("../../../../lib/release-preview.server", () => ({ loadFrozenReleasePreviews: vi.fn() }));
import { SyncOverview } from "../sync-overview";
import { createTodayVisualFixture } from "../visual-qa-fixtures";

describe("Overview uses the same authorized Content chooser", () => {
  it("opens the chooser directly instead of the intermediate Studio index", async () => {
    const markup = renderToStaticMarkup(await SyncOverview({ canCreateStudio: true, canManageScreens: false, data: createTodayVisualFixture("empty-unconfigured"), schedules: [], tenant: "Eigen club", userName: "Eigen actor" }));
    expect(markup).toMatch(/href="\/dashboard\/studio\/new"[^>]*>[\s\S]*?Content maken/);
    expect(markup).not.toContain('href="/dashboard/studio"');
  });
  it("does not offer an unauthorized create action", async () => {
    const markup = renderToStaticMarkup(await SyncOverview({ canCreateStudio: false, canManageScreens: false, data: createTodayVisualFixture("empty-unconfigured"), schedules: [], tenant: "Eigen club", userName: "Eigen actor" }));
    expect(markup).not.toContain("Content maken");
  });
});
