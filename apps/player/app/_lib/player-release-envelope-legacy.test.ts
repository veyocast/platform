import { describe, expect, it, vi } from "vitest";
import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";
import { playerDynamicDataSchema } from "./player-manifest";

const fixture = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("./player-supabase", () => ({ createPlayerAdminClient: () => fixture.admin }));
import { loadPlayerReleaseEnvelope } from "./player-release-envelope";

const id = (suffix: number) => `29500000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
type Family = "news" | "menu" | "price_list";
function sourceData(family: Family, revision: number): Record<string, unknown> {
  const title = `Brongegevens ${revision}`;
  const product = { id: "product-1", name: title, category: "Onze kaart", priceMinor: 350 + revision };
  return family === "news"
    ? { type: family, news: { sourceName: "Clubnieuws", articles: [{ id: "article-1", title, intro: "Onze eigen bron" }] } }
    : family === "menu"
      ? { type: family, menu: { products: [product] } }
      : { type: family, priceList: { sections: [{ title: "Onze kaart", products: [product] }] } };
}
function setup(family: Family = "news") {
  const snapshot = {
    id: id(1), dynamic_slide_version_id: id(2), template_version_id: id(3),
    source_revision_hash: "a".repeat(64), snapshot_data_json: sourceData(family, 1)
  };
  const row = {
    id: id(4), source_item_id: id(5), live_data_enabled: true, asset_kind: "image",
    asset_title: "Gepubliceerde bron", display_title: null, duration_seconds: 30,
    fit_mode: "contain", muted: true, transition: "cut", crop_focus_x: .5, crop_focus_y: .5,
    background_color: null, volume_percent: 0, trim_start_seconds: 0, trim_end_seconds: null,
    visible_from: null, visible_until: null, enabled: true, accessibility_name: null,
    section_source_id: null, section_name: null, section_position_key: null,
    storage_bucket: "tenant-media", storage_path: `tenants/${id(8)}/assets/${id(6)}/original.png`,
    mime_type: "image/png", file_size_bytes: 128, checksum_sha256: "b".repeat(64),
    dynamic_snapshot_id: snapshot.id, youtube_video_id: null, youtube_title: null,
    youtube_online_only: null, sites_configuration_json: null, sites_studio_presentation_json: null
  };
  const release = {
    id: id(7), tenant_id: id(8), playlist_id: id(9), version: 1,
    manifest_hash: "c".repeat(64), manifest_json: {}, published_at: "2026-11-09T00:00:00Z",
    total_bytes: 128, total_duration_seconds: 30
  };
  const state = {
    live: true, error: false, revision: 2 as unknown, hash: "d".repeat(64) as unknown,
    data: sourceData(family, 2), checkedAt: "2026-11-09T00:01:00Z", signedVersion: 1,
    extraRows: [] as typeof row[], assetIds: [] as string[]
  };
  fixture.admin = {
    from(table: string) {
      const result = () => ({
        error: table === "published_dynamic_data" && state.error ? { code: "temporary_failure" } : null,
        data: table === "playlist_release_items" ? [row, ...state.extraRows]
          : table === "dynamic_slide_snapshots" ? [snapshot]
          : table === "published_dynamic_data" ? state.live ? [{
            snapshot_id: snapshot.id, data_revision: state.revision, content_hash: state.hash,
            data_json: state.data, checked_at: state.checkedAt, changed_at: state.checkedAt
          }] : []
          : table === "dynamic_template_versions" ? [{ id: id(3), template_id: id(10) }]
          : table === "dynamic_templates" ? [{ id: id(10), slug: `legacy-${family.replaceAll("_", "-")}`, slide_type: family, orientation: "landscape" }]
          : table === "media_assets" ? state.assetIds.map(assetId => ({ id: assetId, kind: "image" }))
          : table === "media_variants" ? state.assetIds.map(assetId => ({
            asset_id: assetId, variant_type: "original", storage_bucket: "tenant-media",
            storage_path: `tenants/${release.tenant_id}/assets/${assetId}/original.png`, mime_type: "image/png",
            file_size_bytes: 42, checksum_sha256: assetId.replaceAll("-", "").repeat(2)
          }))
          : []
      });
      const query = {
        select() { return query; }, eq() { return query; }, in() { return query; },
        order() { return query; }, limit() { return query; },
        single: async () => ({ error: null, data: release }),
        maybeSingle: async () => ({ error: null, data: null }),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); }
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: async (path: string) => ({
      error: null, data: { signedUrl: `https://signed.example.invalid/${path}?version=${state.signedVersion}` }
    }) }) }
  };
  return { state, row, snapshot, load: () => loadPlayerReleaseEnvelope({
    device: { activeReleaseId: release.id, desiredReleaseId: release.id, id: id(11), screenId: id(12), screenName: "Legacy bron" },
    releaseId: release.id, tenantId: release.tenant_id
  }) };
}

describe("revisioned historical dynamic release data", () => {
  it.each(["news", "menu", "price_list"] as const)("binds current %s facts to the immutable publication without changing the old payload schema", async family => {
    const value = setup(family), before = await value.load(), item = before.manifest.items[0]!;
    expect(playerDynamicDataSchema.parse(item.dynamicData)).toMatchObject({
      schemaVersion: 1, configurationSnapshotId: value.snapshot.id, snapshotId: value.snapshot.id,
      templateVersionId: value.snapshot.template_version_id, dataRevision: 2, contentHash: "d".repeat(64)
    });
    expect(playerDynamicTemplatePayloadSchema.parse(item.dynamicTemplate).data).toEqual(value.state.data);
    expect(item.dynamicTemplate).not.toHaveProperty("dataRevision");
    expect(item.dynamicTemplate?.snapshotHash).toBe(item.dynamicData?.contentHash);
    value.state.revision = 3; value.state.hash = "e".repeat(64); value.state.data = sourceData(family, 3);
    const after = await value.load(), next = after.manifest.items[0]!;
    expect(after.manifest.releaseId).toBe(before.manifest.releaseId);
    expect(next.contentHash).toBe(item.contentHash);
    expect(next.dynamicData).toEqual({ ...item.dynamicData, dataRevision: 3, contentHash: "e".repeat(64) });
    expect(next.dynamicTemplate?.data).toEqual(value.state.data);
  });

  it("keeps source identity stable when signed access and observation times change", async () => {
    const value = setup(), before = await value.load();
    value.state.signedVersion = 2; value.state.checkedAt = "2026-11-09T00:02:00Z";
    const after = await value.load();
    expect(after.manifest.items[0]!.source.url).not.toBe(before.manifest.items[0]!.source.url);
    expect(after.manifest.items[0]!.dynamicData).toEqual(before.manifest.items[0]!.dynamicData);
    expect(after.manifest.items[0]!.dynamicTemplate).toEqual(before.manifest.items[0]!.dynamicTemplate);
  });

  it.each(["missing", "failure"] as const)("retains the Player's verified data through a %s published-data observation", async mode => {
    const value = setup();
    if (mode === "missing") value.state.live = false; else value.state.error = true;
    await expect(value.load()).rejects.toThrow("DYNAMIC_DATA_UNAVAILABLE");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, true, "2", "invalid"])("rejects untrusted source revision %s", async revision => {
    const value = setup(); value.state.revision = revision;
    await expect(value.load()).rejects.toThrow();
  });

  it("rejects a source hash that cannot identify the delivered facts", async () => {
    const value = setup(); value.state.hash = "unverified";
    await expect(value.load()).rejects.toThrow();
  });

  it("binds the configuration identity to the original snapshot and version", async () => {
    const value = setup(), before = await value.load();
    value.snapshot.dynamic_slide_version_id = id(20);
    const after = await value.load();
    expect(after.manifest.items[0]!.dynamicData?.configurationHash).not.toBe(before.manifest.items[0]!.dynamicData?.configurationHash);
    expect(after.manifest.items[0]!.dynamicData?.contentHash).toBe(before.manifest.items[0]!.dynamicData?.contentHash);
  });

  it("keeps immutable non-live releases independent from newer published source facts", async () => {
    const value = setup(); value.row.live_data_enabled = false; value.state.live = false;
    const body = await value.load(), item = body.manifest.items[0]!;
    expect(item.dynamicData).toMatchObject({ dataRevision: 1, contentHash: value.snapshot.source_revision_hash });
    expect(item.dynamicTemplate?.data).toEqual(value.snapshot.snapshot_data_json);
    const old = structuredClone(item); delete old.dynamicData;
    expect(playerDynamicTemplatePayloadSchema.parse(old.dynamicTemplate)).toEqual(item.dynamicTemplate);
  });

  it("keeps frozen facts, metadata and assets independent when the same snapshot also has a live placement", async () => {
    const value = setup(), frozenAsset = id(21), liveAsset = id(22), nextAsset = id(23);
    const facts = (title: string, assetId: string) => ({ type: "news", news: {
      sourceName: "Clubnieuws", articles: [{ id: "article-1", title, intro: "Eigen bron", heroMediaAssetId: assetId }]
    } });
    value.snapshot.snapshot_data_json = facts("Vastgelegd nieuws", frozenAsset);
    value.state.data = facts("Actueel nieuws", liveAsset);
    value.state.assetIds = [frozenAsset, liveAsset];
    value.state.extraRows.push({ ...value.row, id: id(30), source_item_id: id(31), live_data_enabled: false });
    const before = await value.load(), [live, frozen] = before.manifest.items;
    expect(live?.dynamicData).toMatchObject({ dataRevision: 2, contentHash: "d".repeat(64) });
    expect(live?.dynamicTemplate?.data).toEqual(value.state.data);
    expect(Object.keys(live?.dynamicTemplate?.assets ?? {})).toEqual([liveAsset]);
    expect(frozen?.dynamicData).toMatchObject({ dataRevision: 1, contentHash: value.snapshot.source_revision_hash });
    expect(frozen?.dynamicTemplate?.data).toEqual(value.snapshot.snapshot_data_json);
    expect(Object.keys(frozen?.dynamicTemplate?.assets ?? {})).toEqual([frozenAsset]);
    value.state.revision = 3; value.state.hash = "e".repeat(64);
    value.state.data = facts("Nieuwste bronfoto", nextAsset); value.state.assetIds = [frozenAsset, nextAsset];
    const after = await value.load(), [nextLive, stillFrozen] = after.manifest.items;
    expect(nextLive?.dynamicData).toMatchObject({ dataRevision: 3, contentHash: "e".repeat(64) });
    expect(Object.keys(nextLive?.dynamicTemplate?.assets ?? {})).toEqual([nextAsset]);
    expect(stillFrozen?.dynamicData).toEqual(frozen?.dynamicData);
    expect(stillFrozen?.dynamicTemplate).toEqual(frozen?.dynamicTemplate);
    expect(after.manifest.releaseId).toBe(before.manifest.releaseId);
  });
});
