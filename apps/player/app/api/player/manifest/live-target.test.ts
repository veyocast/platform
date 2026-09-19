import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { adminRpc, anonRpc, loadEnvelope } = vi.hoisted(() => ({ adminRpc: vi.fn(), anonRpc: vi.fn(), loadEnvelope: vi.fn() }));
vi.mock("../../../_lib/player-supabase", () => ({
  isLivePlayerConfigured: () => true,
  createPlayerAnonClient: () => ({ rpc: anonRpc }),
  createPlayerAdminClient: () => ({ rpc: adminRpc, from: () => { throw new Error("branding unavailable in fixture"); } })
}));
vi.mock("../../../_lib/player-release-envelope", () => ({ loadPlayerReleaseEnvelope: loadEnvelope }));
import { getPlayerManifestForToken } from "../../../_lib/player-manifest";
import { GET } from "./route";

const target = { tenant_id: "tenant-A", device_id: "device-A", screen_id: "screen-A", screen_name: "Test",
  device_status: "paired", screen_status: "active", active_release_id: "old", desired_release_id: "current",
  target_revision: "12", publication_id: "playlist-A", config_revision: "100", assignment_source: "default",
  target_changed_at: "2026-09-19T12:00:00Z", data_key: "binding-A:2", sponsor_key: "" };
const request = (etag?: string) => new Request("https://player.veyocast.nl/api/player/manifest", {
  headers: { Authorization: "Bearer device-secret-fixture", ...(etag ? { "If-None-Match": etag } : {}) }
});

describe("authorized current-target API", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-19T12:01:00Z"));
    adminRpc.mockReset().mockResolvedValue({ data: target, error: null });
    anonRpc.mockReset().mockResolvedValue({ data: [], error: null });
    loadEnvelope.mockReset().mockImplementation(async () => {
      const fixture = getPlayerManifestForToken("demo-online");
      if (!fixture.ok) throw new Error("fixture unavailable");
      return structuredClone(fixture.body);
    });
  });
  afterEach(() => vi.useRealTimers());

  it("authenticates every 304 and avoids signing/loading unchanged manifests", async () => {
    const first = await GET(request());
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag")!;
    loadEnvelope.mockClear(); adminRpc.mockClear();
    const next = await GET(request(etag));
    expect(next.status).toBe(304);
    expect(adminRpc).toHaveBeenCalledOnce();
    expect(loadEnvelope).not.toHaveBeenCalled();
    expect(next.headers.get("vary")).toBe("Authorization");
    expect(await next.text()).toBe("");
  });
  it("rejects a revoked credential despite a previously valid target ETag", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: null, error: null });
    anonRpc.mockResolvedValue({ data: "DEVICE_REVOKED", error: null });
    expect((await GET(request(first.headers.get("etag")!))).status).toBe(403);
  });
  it("does not share an ETag across authorized tenant/device targets", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: { ...target, tenant_id: "tenant-B", screen_id: "screen-B", device_id: "device-B" }, error: null });
    const next = await GET(request(first.headers.get("etag")!));
    expect(next.status).toBe(200);
    expect(next.headers.get("etag")).not.toBe(first.headers.get("etag"));
  });
  it("rejects a target changed while a manifest was being prepared", async () => {
    adminRpc.mockResolvedValueOnce({ data: target, error: null })
      .mockResolvedValueOnce({ data: { ...target, target_revision: "13", desired_release_id: "newer" }, error: null });
    const result = await GET(request());
    expect(result.status).toBe(409);
    expect(await result.json()).toHaveProperty("error.code", "TARGET_CHANGED");
  });
  it("refreshes data and signed access independently of the configuration revision", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: { ...target, data_key: "binding-A:3" }, error: null });
    const data = await GET(request(first.headers.get("etag")!));
    expect(data.status).toBe(200);
    expect(await data.json()).toHaveProperty("target.configRevision", "100");
    vi.setSystemTime(new Date("2026-09-19T12:31:00Z"));
    const access = await GET(request(data.headers.get("etag")!));
    expect(access.status).toBe(200);
    expect(await access.json()).toHaveProperty("target.revision", "12");
  });
});
