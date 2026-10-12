import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ capability: vi.fn(), batch: vi.fn(), responses: {} as Record<string, unknown>, calls: [] as Array<[string, string, unknown]>, tables: [] as string[] }));
vi.mock("../../../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../playlists/sites-batch-actions", () => ({ savePlaylistBatch: f.batch }));
vi.mock("../../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ from: (table: string) => {
  f.tables.push(table);
  const query = { select: () => query, eq: (key: string, value: unknown) => { f.calls.push([table, key, value]); return query; }, is: () => query, neq: () => query, in: async () => f.responses[table] };
  return query;
} }) }));
import { prepareSitesSourceDestination } from "./sites-source-destination-actions";
const tenant = "a1910000-0000-4000-8000-000000007601", playlist = "a1910000-0000-4000-8000-000000007602", screen = "a1910000-0000-4000-8000-000000007603", slide = "a1910000-0000-4000-8000-000000007604", snapshot = "a1910000-0000-4000-8000-000000007605", client = "a1910000-0000-4000-8000-000000007606", key = "a1910000-0000-4000-8000-000000007607";
const input = () => ({ destination: { mode: "publish" as const, playlistId: playlist, expectedRevision: 8, screenIds: [screen] }, designs: [{ slideId: slide, snapshotId: snapshot, durationSeconds: 15, clientId: client }], idempotencyKey: key });
const ready = () => ({ id: slide, status: "ready", current_snapshot_id: snapshot, active_draft_version_id: null, configuration_json: { revision: 5 } });
beforeEach(() => {
  vi.resetAllMocks(); f.calls.length = 0; f.tables.length = 0;
  f.capability.mockResolvedValue({ isLive: true, tenantId: tenant });
  f.responses = { screens: { data: [{ id: screen }], error: null }, dynamic_slides: { data: [ready()], error: null } };
  f.batch.mockResolvedValue({ outcome: "applied", actualRevision: 9, itemIds: { [client]: "actual-item" } });
});
describe("Bronbestemming gebruikt uitsluitend de bestaande atomic concept- en publicatieketen", () => {
  it("handhaaft beide rechten vóór tenantreads en een batchcommand", async () => {
    f.capability.mockResolvedValueOnce({ isLive: true, tenantId: tenant }).mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(prepareSitesSourceDestination(input())).rejects.toThrow("FORBIDDEN");
    expect(f.capability.mock.calls).toEqual([["tenant.playlist.write", "mutate"], ["tenant.playlist.publish", "publish"]]);
    expect(f.tables).toHaveLength(0); expect(f.batch).not.toHaveBeenCalled();
  });
  it("controleert alle eigen schermen en snapshots vóór één CAS-batch, en publiceert daarna uitsluitend via de echte controlepagina", async () => {
    expect(await prepareSitesSourceDestination(input())).toEqual({ outcome: "ready", actualRevision: 9, url: `/dashboard/playlists/${playlist}/publish?screens=${screen}` });
    expect(f.calls).toContainEqual(["screens", "tenant_id", tenant]); expect(f.calls).toContainEqual(["dynamic_slides", "tenant_id", tenant]);
    expect(f.batch).toHaveBeenCalledExactlyOnceWith({ playlistId: playlist, expectedRevision: 8, idempotencyKey: key, operations: [{ operation: "add_dynamic", clientId: client, dynamicSlideId: slide, expectedSnapshotId: snapshot, durationSeconds: 15 }] });
  });
  it("voegt bij pending render, gewijzigd ontwerp, niet-eigen scherm of menuconcept geen gedeeltelijke batch toe", async () => {
    for (const value of [{ ...ready(), status: "render_pending" }, { ...ready(), active_draft_version_id: client }]) {
      f.responses.dynamic_slides = { data: [value], error: null }; expect(await prepareSitesSourceDestination(input())).toMatchObject({ outcome: "pending" });
    }
    f.responses.dynamic_slides = { data: [{ ...ready(), current_snapshot_id: client }], error: null }; expect(await prepareSitesSourceDestination(input())).toMatchObject({ outcome: "conflict" });
    f.responses.dynamic_slides = { data: [ready()], error: null }; f.responses.screens = { data: [], error: null }; expect(await prepareSitesSourceDestination(input())).toMatchObject({ outcome: "failed" });
    expect(f.batch).not.toHaveBeenCalled();
  });
  it("controleert de werkelijk opgeslagen Menu-revisie en behoudt een stale playlistconflict", async () => {
    const command = { ...input(), designs: [{ slideId: slide, menuRevision: 6, durationSeconds: 15, clientId: client }] };
    expect(await prepareSitesSourceDestination(command)).toMatchObject({ outcome: "conflict" }); expect(f.batch).not.toHaveBeenCalled();
    command.designs[0]!.menuRevision = 5; f.batch.mockResolvedValue({ outcome: "conflict", actualRevision: 10 });
    expect(await prepareSitesSourceDestination(command)).toMatchObject({ outcome: "conflict", message: expect.stringContaining("Er is niets") });
    expect(f.batch.mock.calls[0]![0]).toMatchObject({ expectedRevision: 8, idempotencyKey: key });
  });
  it("wacht op de laatste van alle 25 echte ontwerpen, en verstuurt ze samen met dezelfde sleutel na herstel", async () => {
    const designs = Array.from({ length: 25 }, (_, index) => ({ slideId: `a1910000-0000-4000-8000-${String(7700 + index).padStart(12, "0")}`, snapshotId: `a1910000-0000-4000-8000-${String(7800 + index).padStart(12, "0")}`, clientId: `a1910000-0000-4000-8000-${String(7900 + index).padStart(12, "0")}`, durationSeconds: 5 }));
    const command = { ...input(), designs }; const rows = designs.map(design => ({ ...ready(), id: design.slideId, current_snapshot_id: design.snapshotId }));
    rows[24]!.status = "render_pending"; f.responses.dynamic_slides = { data: rows, error: null };
    expect(await prepareSitesSourceDestination(command)).toMatchObject({ outcome: "pending" }); expect(f.batch).not.toHaveBeenCalled();
    rows[24]!.status = "ready"; expect(await prepareSitesSourceDestination(command)).toMatchObject({ outcome: "ready" });
    expect(f.batch).toHaveBeenCalledOnce(); expect(f.batch.mock.calls[0]![0]).toMatchObject({ operations: expect.any(Array), idempotencyKey: key, expectedRevision: 8 }); expect(f.batch.mock.calls[0]![0].operations).toHaveLength(25);
  });
  it("bevestigt transportuitval nooit als succesvol en hergebruikt de oorspronkelijke CAS-command bij retry", async () => {
    f.batch.mockRejectedValueOnce(new Error("raw-secret-diagnostic"));
    const failed = await prepareSitesSourceDestination(input()); expect(failed).toMatchObject({ outcome: "failed" }); expect(JSON.stringify(failed)).not.toContain("raw-secret");
    expect(await prepareSitesSourceDestination(input())).toMatchObject({ outcome: "ready" }); expect(f.batch.mock.calls[0]![0]).toEqual(f.batch.mock.calls[1]![0]);
  });
  it("weigert ongeldige UUIDs, dubbele clientidentiteiten en schermen vóór DB-read of command", async () => {
    const commands = [{ ...input(), destination: { ...input().destination, playlistId: "-".repeat(36) } }, { ...input(), designs: [input().designs[0]!, { ...input().designs[0]!, slideId: playlist }] }, { ...input(), destination: { ...input().destination, screenIds: [screen, screen] } }];
    for (const command of commands) expect(await prepareSitesSourceDestination(command)).toMatchObject({ outcome: "failed" });
    expect(f.tables).toHaveLength(0); expect(f.batch).not.toHaveBeenCalled();
  });
});
