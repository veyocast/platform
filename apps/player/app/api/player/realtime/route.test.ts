import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as LedScoresServer from "../../../_lib/player-ledscores-server";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), removeChannel: vi.fn(), bootstrap: vi.fn(), matches: vi.fn(),
  callbacks: new Map<string, (change: { new: Record<string, unknown>; old: Record<string, unknown>; commit_timestamp?: string }) => void>(),
  subscribed: null as null | ((status: string) => void) }));
vi.mock("../../../_lib/player-supabase", () => ({ createPlayerAdminClient: () => ({
  rpc: fixture.rpc, removeChannel: fixture.removeChannel,
  channel: () => {
    const channel = { on: (_event: string, filter: { table: string }, callback: never) => {
      fixture.callbacks.set(filter.table, callback); return channel;
    }, subscribe: (callback: (status: string) => void) => { fixture.subscribed = callback; return channel; } };
    return channel;
  }
}) }));
vi.mock("../../../_lib/player-ledscores-server", async (importOriginal) => ({
  ...await importOriginal<typeof LedScoresServer>(),
  loadLedScoresPlayerBootstrap: fixture.bootstrap, loadLedScoresMatchPlayerBootstrap: fixture.matches
}));
import { GET } from "./route";

const target = { screen_id: "screen-A", tenant_id: "tenant-A", target_revision: "3", data_key: "binding-A:2" };
const controllers: AbortController[] = [];
function request() {
  const controller = new AbortController(); controllers.push(controller);
  return new Request("https://player.veyocast.nl/api/player/realtime", {
    signal: controller.signal, headers: { Authorization: `Bearer ${"d".repeat(48)}` }
  });
}

describe("authorized publication invalidation stream", () => {
  beforeEach(() => {
    vi.useFakeTimers(); fixture.callbacks.clear(); fixture.subscribed = null;
    fixture.rpc.mockReset().mockResolvedValue({ data: target, error: null });
    fixture.removeChannel.mockReset().mockResolvedValue(undefined);
    fixture.bootstrap.mockReset().mockResolvedValue({ authorized: true, enabled: false, screenId: "screen-A", tenantId: "tenant-A", configs: [], pendingDeliveries: [], screenOrientation: "landscape" });
    fixture.matches.mockReset().mockResolvedValue({ authorized: true, enabled: false, screenId: "screen-A", tenantId: "tenant-A", bindings: [], pendingDeliveries: [] });
  });
  afterEach(() => { controllers.splice(0).forEach((controller) => controller.abort()); vi.useRealTimers(); });

  it("works without goal configuration, coalesces relevant changes and removes every timer on cancellation", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    await reader.read(); // bootstrap
    fixture.subscribed!("SUBSCRIBED");
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("target_invalidated");
    const change = fixture.callbacks.get("published_dynamic_data")!;
    change({ new: { tenant_id: "tenant-B", snapshot_id: "binding-A", data_revision: 3 }, old: { data_revision: 2 } });
    change({ new: { tenant_id: "tenant-A", snapshot_id: "unpublished", data_revision: 3 }, old: { data_revision: 2 } });
    change({ new: { tenant_id: "tenant-A", snapshot_id: "binding-A", data_revision: 2 }, old: { data_revision: 2 } });
    expect(vi.getTimerCount()).toBe(1); // health validation only
    for (let revision = 3; revision < 13; revision += 1) change({ new: { tenant_id: "tenant-A", snapshot_id: "binding-A", data_revision: revision }, old: { data_revision: revision - 1 } });
    fixture.callbacks.get("screens")!({ new: { tenant_id: "tenant-A", target_revision: "4" }, old: {}, commit_timestamp: "2026-09-20T12:00:00Z" });
    expect(vi.getTimerCount()).toBe(2); // exactly one coalesced invalidation
    await vi.advanceTimersByTimeAsync(100);
    const notification = new TextDecoder().decode((await reader.read()).value);
    expect(notification).toContain('"screenId":"screen-A"');
    expect(notification).toContain('"committedAt":"2026-09-20T12:00:00Z"');
    expect(notification).not.toContain("binding-A");
    await reader.cancel();
    expect(fixture.removeChannel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("closes a revoked stream without retaining subscriptions", async () => {
    const response = await GET(request());
    const reader = response.body!.getReader(); await reader.read();
    fixture.rpc.mockResolvedValue({ data: null, error: null });
    await vi.advanceTimersByTimeAsync(15_000);
    await reader.read(); // already-enqueued keepalive
    expect((await reader.read()).done).toBe(true);
    expect(fixture.removeChannel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects inconsistent tenant authorization before opening a channel", async () => {
    fixture.rpc.mockResolvedValue({ data: { ...target, tenant_id: "tenant-B" }, error: null });
    expect((await GET(request())).status).toBe(401);
    expect(fixture.callbacks.size).toBe(0);
  });
});
