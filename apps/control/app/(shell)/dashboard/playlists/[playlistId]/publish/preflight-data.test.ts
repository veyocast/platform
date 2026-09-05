import { beforeEach, describe, expect, it, vi } from "vitest";

const createControlSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../lib/supabase/server", () => ({
  createControlSupabaseClient
}));

import { loadDraftPreflight, loadReleasePreflight } from "../../../releases/data";

type MockError = { message: string } | null;
type MockResult = { data: Record<string, unknown>[] | null; error: MockError };
type QueryCall = {
  equals: Array<[string, unknown]>;
  inFilters: Array<[string, readonly string[]]>;
  ranges: Array<[number, number]>;
  select: string | null;
  table: string;
};

function createSupabaseMock(results: Record<string, MockResult | MockResult[]>) {
  const calls: QueryCall[] = [];
  const resultIndexes = new Map<string, number>();
  const client = {
    from(table: string) {
      const call: QueryCall = {
        equals: [],
        inFilters: [],
        ranges: [],
        select: null,
        table
      };
      calls.push(call);
      const query = {
        eq(column: string, value: unknown) {
          call.equals.push([column, value]);
          return query;
        },
        in(column: string, values: readonly string[]) {
          call.inFilters.push([column, values]);
          return query;
        },
        is() {
          return query;
        },
        order() {
          return query;
        },
        range(from: number, to: number) {
          call.ranges.push([from, to]);
          return query;
        },
        select(columns: string) {
          call.select = columns;
          return query;
        },
        then(
          onFulfilled: (value: MockResult) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          const configured = results[table] ?? { data: [], error: null };
          const index = resultIndexes.get(table) ?? 0;
          const result = Array.isArray(configured)
            ? configured[index] ?? configured.at(-1) ?? { data: [], error: null }
            : configured;
          resultIndexes.set(table, index + 1);
          return Promise.resolve(result).then(
            onFulfilled,
            onRejected
          );
        }
      };
      return query;
    }
  };
  return { calls, client };
}

const activeScreen = {
  assigned_release_id: null,
  id: "screen-active",
  location: "Kantine",
  name: "Kantine TV",
  orientation: "landscape",
  status: "active"
};

describe("draft publish preflight data", () => {
  beforeEach(() => {
    createControlSupabaseClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("houdt schermen selecteerbaar wanneer Playerstatus niet geladen kan worden", async () => {
    const { calls, client } = createSupabaseMock({
      player_devices: { data: null, error: { message: "telemetry unavailable" } },
      screens: {
        data: [activeScreen, { ...activeScreen, id: "screen-two", name: "Bestuurskamer" }],
        error: null
      }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", [
      { checksumSha256: "a".repeat(64), fileSizeBytes: 512 }
    ]);

    expect(result.error).toBeNull();
    expect(result.warning).toContain("Playerstatus");
    expect(result.screenStates).toHaveLength(2);
    expect(result.screenStates.every(({ preflight }) => preflight.status === "unknown")).toBe(true);
    expect(calls.map(({ table }) => table)).toEqual(["screens", "player_devices"]);
  });

  it("maakt alleen de essentiële schermquery fataal", async () => {
    const { calls, client } = createSupabaseMock({
      screens: { data: null, error: { message: "screens unavailable" } }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", []);

    expect(result.error).toContain("doelschermen");
    expect(result.warning).toBeNull();
    expect(result.screenStates).toEqual([]);
    expect(calls.map(({ table }) => table)).toEqual(["screens"]);
  });

  it("beperkt cachedata tot actieve releases en gebruikt device-telemetry", async () => {
    const { calls, client } = createSupabaseMock({
      player_devices: {
        data: [{
          active_release_id: "release-active",
          capabilities: { manifestSchemaVersions: [1] },
          desired_release_id: null,
          id: "device-one",
          last_seen_at: new Date().toISOString(),
          screen_id: activeScreen.id,
          storage_quota_bytes: 1_000_000_000,
          storage_used_bytes: 100
        }],
        error: null
      },
      playlist_release_items: {
        data: [{ checksum_sha256: "a".repeat(64), release_id: "release-active" }],
        error: null
      },
      screens: { data: [activeScreen], error: null }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", [
      { checksumSha256: "a".repeat(64), fileSizeBytes: 512 },
      { checksumSha256: "b".repeat(64), fileSizeBytes: 256 }
    ]);
    const releaseCall = calls.find(({ table }) => table === "playlist_release_items");
    const deviceCall = calls.find(({ table }) => table === "player_devices");

    expect(result.warning).toBeNull();
    expect(result.screenStates[0]?.preflight).toMatchObject({
      missingBytes: 256,
      status: "ready"
    });
    expect(releaseCall?.select).toBe("release_id, checksum_sha256, sort_order");
    expect(releaseCall?.inFilters).toEqual([["release_id", ["release-active"]]]);
    expect(releaseCall?.equals).toContainEqual(["tenant_id", "tenant-one"]);
    expect(releaseCall?.ranges).toEqual([[0, 999]]);
    expect(deviceCall?.select).toContain("last_seen_at");
    expect(deviceCall?.select).toContain("storage_quota_bytes");
    expect(calls.some(({ table }) => table === "player_heartbeats")).toBe(false);
  });

  it("pagineert actieve release-items voorbij de PostgREST-limiet", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, sortOrder) => ({
      checksum_sha256: "a".repeat(64),
      release_id: "release-active",
      sort_order: sortOrder
    }));
    const { calls, client } = createSupabaseMock({
      player_devices: {
        data: [{
          active_release_id: "release-active",
          capabilities: { manifestSchemaVersions: [1] },
          desired_release_id: null,
          id: "device-one",
          last_seen_at: new Date().toISOString(),
          screen_id: activeScreen.id,
          storage_quota_bytes: 1_000_000_000,
          storage_used_bytes: 100
        }],
        error: null
      },
      playlist_release_items: [
        { data: firstPage, error: null },
        {
          data: [{
            checksum_sha256: "b".repeat(64),
            release_id: "release-active",
            sort_order: 1_000
          }],
          error: null
        }
      ],
      screens: { data: [activeScreen], error: null }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", [
      { checksumSha256: "b".repeat(64), fileSizeBytes: 512 }
    ]);
    const releaseCalls = calls.filter(({ table }) =>
      table === "playlist_release_items"
    );

    expect(result.warning).toBeNull();
    expect(result.screenStates[0]?.preflight).toMatchObject({
      missingBytes: 0,
      status: "ready"
    });
    expect(releaseCalls.map(({ ranges }) => ranges)).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
  });

  it("pagineert doelschermen en gekoppelde devices voorbij de PostgREST-limiet", async () => {
    const firstScreenPage = Array.from({ length: 1_000 }, (_, index) => ({
      ...activeScreen,
      id: `screen-${index}`,
      name: `Scherm ${index}`
    }));
    const firstDevicePage = Array.from({ length: 1_000 }, (_, index) => ({
      active_release_id: null,
      capabilities: { manifestSchemaVersions: [1] },
      desired_release_id: null,
      id: `device-${index}`,
      last_seen_at: new Date().toISOString(),
      screen_id: `screen-${index}`,
      storage_quota_bytes: 1_000_000_000,
      storage_used_bytes: 100
    }));
    const { calls, client } = createSupabaseMock({
      player_devices: [
        { data: firstDevicePage, error: null },
        {
          data: [{
            ...firstDevicePage[0],
            id: "device-overflow",
            screen_id: "screen-overflow"
          }],
          error: null
        }
      ],
      screens: [
        { data: firstScreenPage, error: null },
        {
          data: [{
            ...activeScreen,
            id: "screen-overflow",
            name: "Scherm overloop"
          }],
          error: null
        }
      ]
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", []);
    const screenCalls = calls.filter(({ table }) => table === "screens");
    const deviceCalls = calls.filter(({ table }) => table === "player_devices");

    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
    expect(result.screenStates).toHaveLength(1_001);
    expect(result.screenStates.at(-1)).toMatchObject({
      deviceId: "device-overflow",
      screen: {
        id: "screen-overflow",
        name: "Scherm overloop"
      }
    });
    expect(screenCalls.map(({ ranges }) => ranges)).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
    expect(deviceCalls.map(({ ranges }) => ranges)).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
  });

  it("vereist een bewuste bevestiging wanneer actieve cachedata faalt", async () => {
    const { client } = createSupabaseMock({
      player_devices: {
        data: [{
          active_release_id: "release-active",
          capabilities: { manifestSchemaVersions: [1] },
          desired_release_id: null,
          id: "device-one",
          last_seen_at: new Date().toISOString(),
          screen_id: activeScreen.id,
          storage_quota_bytes: 1_000_000_000,
          storage_used_bytes: 100
        }],
        error: null
      },
      playlist_release_items: { data: null, error: { message: "cache unavailable" } },
      screens: { data: [activeScreen], error: null }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadDraftPreflight("tenant-one", [
      { checksumSha256: "a".repeat(64), fileSizeBytes: 512 }
    ]);

    expect(result.error).toBeNull();
    expect(result.warning).toContain("cachegegevens");
    expect(result.screenStates).toHaveLength(1);
    expect(result.screenStates[0]?.preflight).toMatchObject({
      missingBytes: null,
      reasons: ["STORAGE_UNKNOWN"],
      status: "unknown"
    });
  });

  it("beperkt een bestaande-releasepreflight tot release-items en gekozen schermen", async () => {
    const { calls, client } = createSupabaseMock({
      player_devices: { data: [], error: null },
      playlist_release_items: {
        data: [{
          checksum_sha256: "a".repeat(64),
          file_size_bytes: 512
        }],
        error: null
      },
      screens: { data: [activeScreen], error: null }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadReleasePreflight(
      "tenant-one",
      "release-one",
      [activeScreen.id]
    );
    const itemCall = calls.find(({ table }) => table === "playlist_release_items");
    const screenCall = calls.find(({ table }) => table === "screens");
    const deviceCall = calls.find(({ table }) => table === "player_devices");

    expect(result.error).toBeNull();
    expect(result.screenStates).toHaveLength(1);
    expect(itemCall?.equals).toEqual([
      ["tenant_id", "tenant-one"],
      ["release_id", "release-one"]
    ]);
    expect(itemCall?.ranges).toEqual([[0, 999]]);
    expect(screenCall?.inFilters).toEqual([["id", [activeScreen.id]]]);
    expect(deviceCall?.inFilters).toEqual([["screen_id", [activeScreen.id]]]);
  });
});
