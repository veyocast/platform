import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createControlSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase/server", () => ({
  createControlSupabaseClient
}));

import { loadScreenFleet } from "./data";

type MockError = { message: string } | null;
type MockResult = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: MockError;
};
type QueryCall = {
  name: string;
  ranges: Array<[number, number]>;
  source: "rpc" | "table";
};

function createSupabaseMock(
  results: Record<string, MockResult | MockResult[]>,
  rpcResult: MockResult | MockResult[]
) {
  const fromCalls: string[] = [];
  const queryCalls: QueryCall[] = [];
  const rpcCalls: Array<{ args: Record<string, unknown>; name: string }> = [];
  const resultIndexes = new Map<string, number>();
  const nextResult = (
    key: string,
    configured: MockResult | MockResult[] | undefined
  ): MockResult => {
    if (!configured) return { data: [], error: null };
    if (!Array.isArray(configured)) return configured;
    const index = resultIndexes.get(key) ?? 0;
    resultIndexes.set(key, index + 1);
    return configured[index] ?? configured.at(-1) ?? { data: [], error: null };
  };
  const createQuery = (
    call: QueryCall,
    loadResult: () => MockResult
  ) => {
    const query = {
      eq() {
        return query;
      },
      is() {
        return query;
      },
      in() {
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle() {
        return query;
      },
      order() {
        return query;
      },
      range(from: number, to: number) {
        call.ranges.push([from, to]);
        return query;
      },
      select() {
        return query;
      },
      then(
        onFulfilled: (value: MockResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(loadResult()).then(onFulfilled, onRejected);
      }
    };
    return query;
  };
  const client = {
    from(table: string) {
      fromCalls.push(table);
      const call: QueryCall = { name: table, ranges: [], source: "table" };
      queryCalls.push(call);
      return createQuery(call, () => nextResult(`table:${table}`, results[table]));
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ args, name });
      const call: QueryCall = { name, ranges: [], source: "rpc" };
      queryCalls.push(call);
      return createQuery(call, () => nextResult(`rpc:${name}`, rpcResult));
    },
    storage: {
      from() {
        return {
          createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
    }
  };

  return { client, fromCalls, queryCalls, rpcCalls };
}

describe("screen fleet data", () => {
  beforeEach(() => {
    createControlSupabaseClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("laadt de begrensde fleetprojectie via de tenantgebonden RPC", async () => {
    const { client, fromCalls, rpcCalls } = createSupabaseMock(
      {
        playlists: {
          data: [
            { id: "playlist-live", name: "Testportrait", status: "published" },
            { id: "playlist-archived", name: "Archief", status: "archived" }
          ],
          error: null
        }
      },
      {
        data: [
          {
            id: "release-latest",
            playlist_id: "playlist-live",
            published_at: "2026-09-05T10:00:00.000Z",
            release_notes: "Automatische dynamische vernieuwing",
            version: 540
          },
          {
            id: "release-referenced",
            playlist_id: "playlist-live",
            published_at: "2026-09-04T10:00:00.000Z",
            release_notes: null,
            version: 539
          },
          {
            id: "release-archived",
            playlist_id: "playlist-archived",
            published_at: "2026-09-03T10:00:00.000Z",
            release_notes: null,
            version: 9
          }
        ],
        error: null
      }
    );
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadScreenFleet("tenant-one");

    expect(rpcCalls).toEqual([{
      args: { p_tenant_id: "tenant-one" },
      name: "list_screen_fleet_releases_v1"
    }]);
    expect(fromCalls).not.toContain("playlist_releases");
    expect(result.releases.map(({ id }) => id)).toEqual([
      "release-latest",
      "release-referenced",
      "release-archived"
    ]);
    expect(result.assignableReleases).toEqual([
      expect.objectContaining({
        automatic: true,
        id: "release-latest",
        label: "Testportrait · versie 540",
        playlistId: "playlist-live",
        version: 540
      })
    ]);
  });

  it("toont de bestaande herstelmelding wanneer de fleetprojectie faalt", async () => {
    const { client } = createSupabaseMock({}, {
      data: null,
      error: { message: "fleet projection unavailable" }
    });
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadScreenFleet("tenant-one");

    expect(result).toMatchObject({
      assignableReleases: [],
      error: "De schermvloot kon niet volledig worden geladen. Vernieuw de pagina.",
      releases: [],
      screens: []
    });
  });

  it("pagineert schermen, devices, fleetreleases en playlistlabels voorbij 1.000 rijen", async () => {
    const screensPage = Array.from({ length: 1_000 }, (_, index) => ({
      active_assignment_source: "default",
      active_schedule_id: null,
      active_target_snapshot_id: null,
      assigned_playlist_id: null,
      assigned_release_id: null,
      created_at: "2026-09-05T10:00:00.000Z",
      default_playlist_id: null,
      default_release_id: null,
      id: `screen-${index}`,
      location: null,
      name: `Scherm ${index}`,
      orientation: "landscape",
      resolution_height: 1_080,
      resolution_width: 1_920,
      status: "active"
    }));
    const devicesPage = Array.from({ length: 1_000 }, (_, index) => ({
      active_release_id: null,
      app_version: "1.0.0",
      capabilities: {},
      desired_release_id: null,
      device_name: `Player ${index}`,
      id: `device-${index}`,
      last_error_at: null,
      last_error_code: null,
      last_seen_at: "2026-09-05T10:00:00.000Z",
      paired_at: "2026-09-05T09:00:00.000Z",
      platform: "web",
      revoked_at: null,
      screen_id: `screen-${index}`,
      status: "paired",
      storage_quota_bytes: 1_000_000,
      storage_used_bytes: 100,
      sync_retry_requested_at: null
    }));
    const playlistsPage = Array.from({ length: 1_000 }, (_, index) => ({
      id: `playlist-${index}`,
      name: `Playlist ${index}`,
      status: "published"
    }));
    const releasesPage = Array.from({ length: 1_000 }, (_, index) => ({
      id: `release-${index}`,
      playlist_id: `playlist-${index}`,
      published_at: "2026-09-05T10:00:00.000Z",
      release_notes: null,
      version: 1
    }));
    const { client, queryCalls } = createSupabaseMock(
      {
        player_devices: [
          { data: devicesPage, error: null },
          {
            data: [{
              ...devicesPage[0],
              device_name: "Player overloop",
              id: "device-overflow",
              screen_id: "screen-overflow"
            }],
            error: null
          }
        ],
        playlists: [
          { data: playlistsPage, error: null },
          {
            data: [{
              id: "playlist-overflow",
              name: "Zaal overloop",
              status: "published"
            }],
            error: null
          }
        ],
        screens: [
          { data: screensPage, error: null },
          {
            data: [{
              ...screensPage[0],
              id: "screen-overflow",
              name: "Scherm overloop"
            }],
            error: null
          }
        ],
        tenant_settings: {
          data: {
            default_resolution_height: 1_080,
            default_resolution_width: 1_920,
            default_screen_orientation: "landscape"
          },
          error: null
        },
        tenants: { data: { screen_limit: 10_000 }, error: null }
      },
      [
        { data: releasesPage, error: null },
        {
          data: [{
            id: "release-overflow",
            playlist_id: "playlist-overflow",
            published_at: "2026-09-05T11:00:00.000Z",
            release_notes: "Automatische dynamische vernieuwing",
            version: 77
          }],
          error: null
        }
      ]
    );
    createControlSupabaseClient.mockResolvedValue(client);

    const result = await loadScreenFleet("tenant-one");
    const rangesFor = (source: QueryCall["source"], name: string) => queryCalls
      .filter((call) => call.source === source && call.name === name)
      .map(({ ranges }) => ranges);

    expect(result.error).toBeNull();
    expect(result.screens).toHaveLength(1_001);
    expect(result.screens.at(-1)).toMatchObject({
      id: "screen-overflow",
      name: "Scherm overloop"
    });
    expect(result.devices).toHaveLength(1_001);
    expect(result.devices.at(-1)).toMatchObject({
      id: "device-overflow",
      screenId: "screen-overflow"
    });
    expect(result.releases).toHaveLength(1_001);
    expect(result.assignableReleases).toContainEqual(expect.objectContaining({
      automatic: true,
      id: "release-overflow",
      label: "Zaal overloop · versie 77",
      playlistId: "playlist-overflow"
    }));
    expect(rangesFor("table", "screens")).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
    expect(rangesFor("table", "player_devices")).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
    expect(rangesFor("table", "playlists")).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
    expect(rangesFor("rpc", "list_screen_fleet_releases_v1")).toEqual([
      [[0, 999]],
      [[1_000, 1_999]]
    ]);
  });
});
