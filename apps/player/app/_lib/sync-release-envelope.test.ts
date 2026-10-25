import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncSlidePresentationSchema, syncBackgroundAssets } from "@veyocast/contracts";
const state = vi.hoisted(() => ({
  presentation: null as unknown,
  duration: 3000,
  engage: false,
}));
vi.mock("./player-supabase", () => ({
  createPlayerAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        single: async () => ({
          data: {
            id: "10000000-0000-4000-8000-000000000226",
            tenant_id: "20000000-0000-4000-8000-000000000226",
            playlist_id: "30000000-0000-4000-8000-000000000226",
            version: 1,
            manifest_hash: "a".repeat(64),
            manifest_json: {},
            published_at: "2026-10-18T12:00:00Z",
            total_bytes: 10,
            total_duration_seconds: 12,
          },
          error: null,
        }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({
            error: null,
            data:
              table === "playlist_release_items"
                ? [
                    {
                      id: "40000000-0000-4000-8000-000000000226",
                      source_item_id: null,
                      asset_kind: "image",
                      asset_title: "Verified fallback",
                      display_title: null,
                      duration_seconds: 12,
                      fit_mode: "contain",
                      muted: true,
                      transition: "cut",
                      crop_focus_x: 0.5,
                      crop_focus_y: 0.5,
                      background_color: null,
                      volume_percent: 100,
                      trim_start_seconds: 0,
                      trim_end_seconds: null,
                      visible_from: null,
                      visible_until: null,
                      enabled: true,
                      accessibility_name: null,
                      section_source_id: null,
                      storage_bucket: "tenant-media",
                      storage_path: "frozen/fallback.png",
                      mime_type: "image/png",
                      file_size_bytes: 10,
                      checksum_sha256: "b".repeat(64),
                      dynamic_snapshot_id: null,
                      youtube_video_id: null,
                      sites_configuration_json: null,
                      sites_studio_presentation_json: null,
                      sync_studio_presentation_json: state.presentation,
                      sync_studio_duration_ms: state.duration,
                      engage_public_id: state.engage ? "70000000-0000-4000-8000-000000000226" : null,
                      engage_title: state.engage ? "Eigen campagne" : null,
                      engage_question: state.engage ? "Eigen vraag?" : null,
                    },
                  ]
                : [],
          }).then(resolve),
      };
      return query;
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://media.example/frozen.png" },
          error: null,
        }),
      }),
    },
  }),
}));
import { loadPlayerReleaseEnvelope } from "./player-release-envelope";
const input = {
  tenantId: "20000000-0000-4000-8000-000000000226",
  releaseId: "10000000-0000-4000-8000-000000000226",
  device: {
    id: "50000000-0000-4000-8000-000000000226",
    screenId: "60000000-0000-4000-8000-000000000226",
    screenName: "Own screen",
    activeReleaseId: "",
    desiredReleaseId: "10000000-0000-4000-8000-000000000226",
  },
};
describe("Source envelope capability negotiation", () => {
  beforeEach(() => {
    state.presentation = syncSlidePresentationSchema.parse({
      schemaVersion: 1,
      rendererVersion: "sync-v1",
      sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
      family: "free",
      orientation: "landscape",
      theme: "fieldflow",
      name: "Eigen ontwerp",
      title: "Eigen titel",
      club: { name: "Club A" },
      style: {},
    });
    state.duration = 3000;
    state.engage = false;
  });
  it("defaults to the complete existing binary profile for clients without the Source capability", async () => {
    const value = await loadPlayerReleaseEnvelope(input);
    expect(value.manifest.syncSystemAssets).toBeUndefined();
    expect(value.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
    expect(value.manifest.items[0]!.source.url).toBe(
      "https://media.example/frozen.png",
    );
    expect(value.manifest.systemAssets).toBeUndefined();
  });
  it("only opts capable clients into the independent complete Source asset union", async () => {
    const value = await loadPlayerReleaseEnvelope({
      ...input,
      enableSyncStudio: true,
    });
    expect(value.manifest.syncSystemAssets).toHaveLength(11);
    expect(value.manifest.systemAssets).toBeUndefined();
    expect(value.manifest.items[0]!).toMatchObject({
      syncStudioPresentation: state.presentation,
      syncStudioDurationMs: 3000,
      source: { url: "https://media.example/frozen.png" },
    });
    expect(value.manifest.totalBytes).toBe(
      10 +
        value.manifest.syncSystemAssets!.reduce(
          (sum, asset) => sum + asset.bytes,
          0,
        ),
    );
  });
  it("fails closed for a capable client when the frozen Source identity is invalid", async () => {
    state.presentation = { rendererVersion: "untrusted" };
    await expect(
      loadPlayerReleaseEnvelope({ ...input, enableSyncStudio: true }),
    ).rejects.toThrow("SYNC_STUDIO_RELEASE_INVALID");
    expect(
      (await loadPlayerReleaseEnvelope(input)).manifest.items[0]!
        .syncStudioPresentation,
    ).toBeUndefined();
  });
  it("keeps the complete Source fallback for old clients and enables public Engage only with its Source renderer", async () => {
    state.engage = true;
    expect((await loadPlayerReleaseEnvelope(input)).manifest.items[0]!.onlinePlayback).toBeUndefined();
    const value = await loadPlayerReleaseEnvelope({...input, enableSyncStudio: true});
    expect(value.manifest.items[0]!.onlinePlayback).toMatchObject({
      kind: "engage",
      publicId: "70000000-0000-4000-8000-000000000226",
    });
    expect(value.manifest.items[0]!.syncStudioPresentation).toEqual(state.presentation);
    expect(value.manifest.items[0]!.source.url).toBe("https://media.example/frozen.png");
  });
  it("fails closed if an export loses the immutable timing required for all pages", async () => {
    state.duration = 0;
    await expect(
      loadPlayerReleaseEnvelope({ ...input, enableSyncStudio: true }),
    ).rejects.toThrow("SYNC_STUDIO_RELEASE_INVALID");
  });
it.each(syncBackgroundAssets)("negotiates $path without extending old renderer manifests", async asset => {
  const original = state.presentation as ReturnType<typeof syncSlidePresentationSchema.parse>;
  state.presentation = { ...original, style: { ...original.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } };
  const old = await loadPlayerReleaseEnvelope({ ...input, enableSyncStudio: true });
  expect(old.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
  expect(old.manifest.syncSystemAssets).toBeUndefined();
  expect(old.manifest.items[0]!.source).toMatchObject({ bytes: 10, checksumSha256: "b".repeat(64), url: "https://media.example/frozen.png" });
  const fresh = await loadPlayerReleaseEnvelope({ ...input, enableSyncStudio: true, enableSyncBackgrounds: true });
  expect(fresh.manifest.syncSystemAssets).toHaveLength(12);
  expect(fresh.manifest.syncSystemAssets!.at(-1)).toEqual({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType });
  expect(fresh.manifest.items[0]!.syncStudioPresentation).toEqual(state.presentation);
  expect(fresh.manifest.totalBytes).toBe(10 + fresh.manifest.syncSystemAssets!.reduce((sum, ref) => sum + ref.bytes, 0));
});
  it('keeps current authoring fields out of old v9 DOM manifests and sends the verified complete Barlow asset to current clients',async()=>{
    state.presentation=syncSlidePresentationSchema.parse({...state.presentation as object,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',theme:'onzetrots-tv',visual:{schemaVersion:1,mode:'light'},authoring:{visualRevision:'onzetrots-20261024'}});
    state.duration=12000;
    const old=await loadPlayerReleaseEnvelope({...input,enableSyncStudio:true,enableSyncOnzeTrotsV9:true});
    expect(old.manifest.items[0]!.syncStudioPresentation).toBeUndefined();expect(old.manifest.syncSystemAssets).toBeUndefined();
    expect(old.manifest.items[0]!.source.url).toBe('https://media.example/frozen.png');
    const current=await loadPlayerReleaseEnvelope({...input,enableSyncStudio:true,enableSyncOnzeTrotsV9:true,enableSyncOnzeTrotsCurrent:true});
    expect(current.manifest.items[0]!.syncStudioPresentation).toEqual(state.presentation);
    expect(current.manifest.syncSystemAssets!.some(asset=>asset.path==='/onzetrots-approved-v1/assets/fonts/club-font-3.ttf')).toBe(true);
  });

});
