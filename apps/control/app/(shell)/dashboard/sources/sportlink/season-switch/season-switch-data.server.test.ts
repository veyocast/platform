import { beforeEach, describe, expect, it, vi } from "vitest";
import { seasonId, seasonInventoryFixture } from "../../../../../../../../tests/helpers/s301-season-fixtures";
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), from: vi.fn(), rowResult: vi.fn(), calls: [] as unknown[][] }));
vi.mock("../../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
import { loadSeasonConnections, loadSeasonInventory } from "./season-switch-data.server";

const input = () => ({ connectionId: seasonId(10), targetSeasonId: "2026/2027", filters: { query: "letterlijke *", status: "attention" as const, resourceKind: "all" as const }, cursor: "opaque-cursor", pageSize: 25 });
beforeEach(() => {
  vi.resetAllMocks(); mocks.calls.length = 0;
  const query = {
    select: (...args: unknown[]) => { mocks.calls.push(["select", ...args]); return query; },
    eq: (...args: unknown[]) => { mocks.calls.push(["eq", ...args]); return query; },
    neq: (...args: unknown[]) => { mocks.calls.push(["neq", ...args]); return query; },
    order: (...args: unknown[]) => { mocks.calls.push(["order", ...args]); return query; },
    limit: (...args: unknown[]) => { mocks.calls.push(["limit", ...args]); return query; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.rowResult()).then(resolve)
  };
  mocks.from.mockReturnValue(query); mocks.client.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.rowResult.mockReturnValue({ data: [{ id: seasonId(10), detected_club_name: "Eigen vereniging" }], error: null });
  mocks.rpc.mockResolvedValue({ data: seasonInventoryFixture(), error: null });
});

describe("season-switch minimal tenant data boundary", () => {
  it("keeps own paused/error connections inspectable and excludes revoked credentials without provider blobs", async () => {
    expect(await loadSeasonConnections(seasonId(1))).toEqual({ failed: false, items: [{ id: seasonId(10), name: "Eigen vereniging" }] });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("sportlink_connections");
    expect(mocks.calls).toEqual([["select", "id,detected_club_name"], ["eq", "tenant_id", seasonId(1)], ["neq", "status", "revoked"], ["order", "id"], ["limit", 101]]);
  });

  it("passes bounded filters and cursor to the authorized inventory RPC before any UI paging", async () => {
    expect(await loadSeasonInventory(seasonId(1), input())).toMatchObject({ ok: true, inventory: { rows: expect.any(Array) } });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_sportlink_season_switch_inventory_v1", { p_tenant_id: seasonId(1), p_connection_id: seasonId(10), p_target_season_id: "2026/2027", p_filters: input().filters, p_cursor: "opaque-cursor", p_limit: 25 });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not turn partial connection coverage or a failed/malformed inventory into valid empty", async () => {
    mocks.rowResult.mockReturnValueOnce({ data: Array.from({ length: 101 }, () => ({ id: seasonId(10) })), error: null });
    expect(await loadSeasonConnections(seasonId(1))).toEqual({ failed: true, items: [] });
    for (const response of [{ error: { code: "42501" }, data: null }, { error: null, data: [] }, { error: null, data: { ...seasonInventoryFixture(), sourceHealth: null } }]) {
      mocks.rpc.mockResolvedValueOnce(response);
      expect(await loadSeasonInventory(seasonId(1), input())).toMatchObject({ ok: false });
    }
  });

  it("rejects another connection/season response and keeps technical error details private", async () => {
    const other = seasonInventoryFixture(); other.connection.id = seasonId(99);
    mocks.rpc.mockResolvedValueOnce({ data: other, error: null });
    expect(await loadSeasonInventory(seasonId(1), input())).toMatchObject({ ok: false });
    mocks.rpc.mockRejectedValueOnce(new Error("PRIVATE provider credential"));
    expect(JSON.stringify(await loadSeasonInventory(seasonId(1), input()))).not.toContain("PRIVATE");
  });
});
