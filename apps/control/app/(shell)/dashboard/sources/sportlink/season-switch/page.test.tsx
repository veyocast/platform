import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seasonId, seasonInventoryFixture } from "../../../../../../../../tests/helpers/s301-season-fixtures";
const mocks = vi.hoisted(() => ({ session: vi.fn(), connections: vi.fn(), inventory: vi.fn() }));
vi.mock("../../../../../../lib/control-session", () => ({ requireTenantControlSession: mocks.session }));
vi.mock("./season-switch-data.server", () => ({ loadSeasonConnections: mocks.connections, loadSeasonInventory: mocks.inventory }));
vi.mock("./season-switch-workspace", () => ({ SeasonSwitchWorkspace: () => <div>Gecontroleerde inventaris</div> }));
import SeasonSwitchPage from "./page";
beforeEach(() => {
  vi.stubGlobal("React", React); vi.clearAllMocks();
  mocks.session.mockResolvedValue({ isLive: true, tenantId: seasonId(1), userId: seasonId(2), tenantStatus: "active", capabilities: ["tenant.data_source.read", "tenant.dynamic_slide.read"] });
  mocks.connections.mockResolvedValue({ failed: false, items: [{ id: seasonId(10), name: "Eigen vereniging" }] });
  mocks.inventory.mockResolvedValue({ ok: true, inventory: { ...seasonInventoryFixture(), nextCursor: "stable-next" } });
});

describe("canonical season-switch route", () => {
  it("preserves resource, target and filters in the stable next-page link", async () => {
    const markup = renderToStaticMarkup(await SeasonSwitchPage({ searchParams: Promise.resolve({ connectionId: seasonId(10), targetSeasonId: "2026/2027", resourceKind: "dynamic_slide", resourceId: seasonId(3), q: "Eigen *", status: "attention" }) }));
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith("tenant.data_source.read");
    expect(mocks.inventory).toHaveBeenCalledWith(seasonId(1), expect.objectContaining({ connectionId: seasonId(10), targetSeasonId: "2026/2027", filters: { query: "Eigen *", status: "attention", resourceKind: "dynamic_slide", resourceId: seasonId(3) }, cursor: null, pageSize: 25 }));
    expect(markup).toContain("cursor=stable-next"); expect(markup).toContain("resourceId=" + seasonId(3)); expect(markup).toContain("targetSeasonId=2026%2F2027");
    expect(markup).toContain("Gecontroleerde inventaris");
  });

  it("does not read inventory for a foreign connection or invalid unbounded filters", async () => {
    for (const query of [{ connectionId: seasonId(99) }, { connectionId: seasonId(10), q: "x".repeat(121) }, { connectionId: seasonId(10), status: "invented" }]) {
      const markup = renderToStaticMarkup(await SeasonSwitchPage({ searchParams: Promise.resolve(query) }));
      expect(markup).toContain("niet volledig of niet toegankelijk");
    }
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
});
