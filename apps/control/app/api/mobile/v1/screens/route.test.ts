import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  detail: {} as unknown,
  seen: "",
  references: [] as string[],
  tenant: "tenant-a"
}));
vi.mock("../../../../../lib/mobile-api/context", () => ({
  MobileApiContextError: class extends Error {},
  getMobileRequestContext: async () => ({ requestId: "screen-readback", supabase: { from: (table: string) => {
    const filters = new Map<string, unknown>();
    const query = {
      select: () => query, is: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      in: (key: string, values: string[]) => { filters.set(key, values); return query; },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = table === "screens" ? [{ id: "screen-a", name: "Kantine", status: "active", location: null, assigned_release_id: "new-target" }]
          : table === "player_devices" ? [{ screen_id: "screen-a", status: "paired", app_version: "1", last_seen_at: fixture.seen, last_error_code: null, active_release_id: "old-lkg", desired_release_id: "new-target", current_sync_detail: fixture.detail }]
          : table === "playlist_releases" ? [
            { id: "old-lkg", version: 1, playlist: { name: "Bevestigde oude inhoud" } },
            { id: "new-target", version: 1001, playlist: { name: "Nieuwe opdracht" } }
          ].filter(row => ((filters.get("id") as string[] | undefined) ?? []).includes(row.id)) : [];
        if (table === "playlist_releases") fixture.references = filters.get("id") as string[];
        return Promise.resolve({ data: filters.get("tenant_id") === fixture.tenant ? rows : [], error: null }).then(resolve);
      }
    }; return query;
  } } }),
  requireMobileTenant: () => ({ id: fixture.tenant })
}));

import { GET } from "./route";

beforeEach(() => {
  fixture.seen = new Date().toISOString();
  fixture.detail = { publicationTrace: { releaseId: "old-lkg", firstFrameAt: new Date(Date.now() - 1000).toISOString() } };
  fixture.references = [];
});
describe("mobile screen publication readback", () => {
  it("returns the confirmed old release while a different assignment is pending, using explicit references", async () => {
    const response = await GET(new Request("http://localhost/api/mobile/v1/screens"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0].activeReleaseLabel).toBe("Bevestigde oude inhoud · versie 1");
    expect(fixture.references).toEqual(expect.arrayContaining(["old-lkg", "new-target"]));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not report an assigned or heartbeat-only release as visibly active", async () => {
    fixture.detail = {};
    const response = await GET(new Request("http://localhost/api/mobile/v1/screens"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0].activeReleaseLabel).toBeNull();
    expect(body.data.items[0].status).toBe("online");
  });
});
