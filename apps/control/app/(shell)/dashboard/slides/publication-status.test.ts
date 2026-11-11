import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ reads: new Map<string, unknown>(), filters: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: async () => ({ tenantId: "a1910000-0000-4000-8000-000000007901" }) }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ from: (table: string) => {
  const query = { select: () => query, eq: (key: string, value: unknown) => { fixture.filters(table, key, value); return query; }, order: () => query, limit: () => query, maybeSingle: async () => fixture.reads.get(table) };
  return query;
} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { readDynamicPublication } from "./version-actions";

const slideId = "a1910000-0000-4000-8000-000000007902";
const versionId = "a1910000-0000-4000-8000-000000007904";
beforeEach(() => {
  fixture.filters.mockClear(); fixture.reads.clear();
  fixture.reads.set("dynamic_slides", { data: { current_published_version_id: versionId, active_draft_version_id: null, current_snapshot_id: "snapshot", last_error_code: null } });
  fixture.reads.set("dynamic_slide_versions", { data: { id: versionId, status: "published", edit_revision: 5, published_snapshot_id: "snapshot" } });
  fixture.reads.set("dynamic_slide_snapshots", { data: { id: "snapshot", status: "ready", output_media_asset_id: "asset", error_code: null, created_at: "2026-11-11T12:00:00Z" } });
});

describe("publication confirmation", () => {
  it("confirms only an active published version with ready output", async () => {
    expect(await readDynamicPublication(slideId, versionId)).toMatchObject({ status: "published", versionId, revision: 5 });
    expect(fixture.filters).toHaveBeenCalledWith("dynamic_slides", "tenant_id", "a1910000-0000-4000-8000-000000007901");
    expect(fixture.filters).toHaveBeenCalledWith("dynamic_slide_snapshots", "id", "snapshot");
  });
  it("never confirms a queued publication or a published label without playable output", async () => {
    fixture.reads.set("dynamic_slide_versions", { data: { status: "publishing", edit_revision: 5 } });
    expect(await readDynamicPublication(slideId, versionId)).toMatchObject({ status: "publishing" });
    fixture.reads.set("dynamic_slide_versions", { data: { status: "published", edit_revision: 5 } });
    fixture.reads.set("dynamic_slide_snapshots", { data: { status: "rendering", output_media_asset_id: null } });
    expect(await readDynamicPublication(slideId, versionId)).not.toMatchObject({ status: "published" });
  });
  it("reports failed processing instead of an endless publication message", async () => {
    fixture.reads.set("dynamic_slide_snapshots", { data: { status: "failed", output_media_asset_id: null, error_code: "RENDER_TIMEOUT" } });
    expect(await readDynamicPublication(slideId, versionId)).toMatchObject({ status: "failed", error: "RENDER_TIMEOUT" });
  });
  it("rejects missing or inaccessible state", async () => {
    fixture.reads.set("dynamic_slides", { data: null, error: { code: "42501" } });
    await expect(readDynamicPublication(slideId, versionId)).rejects.toThrow("publicatiestatus");
  });
});
