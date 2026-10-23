import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncStudioStarter } from "@veyocast/studio";
import { publisherLibraryFilterSchema } from "@veyocast/contracts";
import { loadPublisherLibrary } from "./library";
import { planPlaylistChanges } from "./_components/sites/playlist-command-plan";
import type { Playlist, Slide } from "./_components/sites/model";

const f = vi.hoisted(() => ({ tables: {} as Record<string, Array<Record<string, unknown>>>, queries: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>, rpcs: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({
  rpc(name: string) { f.rpcs.push(name); throw Error("RSS filter must not query Studio"); },
  from(table: string) {
    const q = { table, filters: [] as Array<[string, string, unknown]> }; f.queries.push(q);
    const b = {
      select: () => b, order: () => b, range: () => b, limit: () => b,
      eq: (key: string, value: unknown) => { q.filters.push(["eq", key, value]); return b; },
      in: (key: string, value: unknown) => { q.filters.push(["in", key, value]); return b; },
      is: (key: string, value: unknown) => { q.filters.push(["eq", key, value]); return b; },
      not: (key: string, _: string, value: string) => { q.filters.push(["not", key, value.slice(1, -1).split(",")]); return b; },
      then(resolve: (value: unknown) => unknown) {
        const rows = (f.tables[table] ?? []).filter(row => q.filters.every(([op, key, value]) => op === "eq" ? row[key] === value : op === "in" ? (value as unknown[]).includes(row[key]) : !(value as unknown[]).includes(row[key])));
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
      },
    }; return b;
  },
}) }));
vi.mock("../../../../lib/supabase/admin", () => ({ createControlAdminClient: () => { throw Error("No provider image or privileged query expected"); } }));

const id = (n: number) => `28800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1);
beforeEach(() => {
  f.queries = []; f.rpcs = []; f.tables = { dynamic_slides: [], dynamic_slide_snapshots: [], media_assets: [] };
  for (let i = 0; i < 3; i++) {
    const seed = createSyncStudioStarter({ family: "rss", tenantName: "Eigen nieuwsclub", theme: "onzetrots-tv" }).syncPresentation!;
    const news = Array.from({ length: 5 }, (_, n) => ({ title: `Artikel ${n + 1} uit bron ${i + 1}`, intro: "Eigen nieuws", source: "Eigen bron", url: `https://example.org/${i}/${n}` }));
    const presentation = { ...seed, news, rich: { news: news.map((item, n) => ({ ...item, id: `source-${i}-article-${n}` })) } };
    const configuration = { schemaVersion: 1, kind: "dynamic", rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: "news", secondsPerPage: 10, seed };
    f.tables.dynamic_slides!.push({ tenant_id: tenant, id: id(10 + i), name: `Nieuws uit bron ${i + 1}`, slide_type: "news", orientation: "landscape", status: "ready", archived_at: null, current_snapshot_id: id(20 + i) });
    f.tables.dynamic_slide_snapshots!.push({ tenant_id: tenant, id: id(20 + i), dynamic_slide_id: id(10 + i), dynamic_slide_version_id: id(30 + i), template_version_id: id(40), source_revision_hash: "b".repeat(64), status: "ready", output_media_asset_id: id(50 + i), snapshot_data_json: { type: "news", syncConfiguration: configuration }, sync_render_result_json: { presentation, width: 1920, height: 1080, mimeType: "video/mp4", byteLength: 12345, durationMs: 50000, storagePath: `tenants/${tenant}/assets/${id(50 + i)}/source.mp4`, checksumSha256: "a".repeat(64), poster: { byteLength: 100, storagePath: `tenants/${tenant}/assets/${id(50 + i)}/poster.png`, checksumSha256: "c".repeat(64) } } });
    f.tables.media_assets!.push({ tenant_id: tenant, id: id(50 + i), status: "ready", kind: "video", mime_type: "video/mp4", checksum_sha256: "a".repeat(64), file_size_bytes: 12345, duration_seconds: 50, width: 1920, height: 1080, deleted_at: null });
  }
  f.tables.dynamic_slides!.push({ tenant_id: tenant, id: id(70), name: "Nieuws in voorbereiding", slide_type: "news", status: "rendering", archived_at: null }, { tenant_id: tenant, id: id(71), name: "Sport in voorbereiding", slide_type: "sport_program", status: "rendering", archived_at: null });
});

describe("RSS designs in the playlist library", () => {
  it("accepts the explicit news filter and lists all three verified RSS designs", async () => {
    expect(publisherLibraryFilterSchema.parse({ tab: "slides", source: "news" }).source).toBe("news");
    const page = await loadPublisherLibrary(tenant, { tab: "slides", source: "news" });
    expect(page.syncDesigns).toHaveLength(3); expect(page.total).toBe(3); expect(f.rpcs).toEqual([]);
    expect(page.syncDesigns?.every(design => design.provider === "news" && design.durationSeconds === 50 && design.presentation.news.length === 5)).toBe(true);
    expect(page.unavailableDesigns).toEqual([{ id: id(70), name: "Nieuws in voorbereiding", status: "rendering", processing: true, href: `/dashboard/slides/${id(70)}` }]);
    expect(f.queries.filter(q => q.table === "dynamic_slides").every(q => q.filters.some(filter => filter[1] === "slide_type" && filter[2] === "news"))).toBe(true);
    expect(f.queries.every(q => q.filters.some(filter => filter[1] === "tenant_id" && filter[2] === tenant))).toBe(true);
  });
  it("adds an RSS design with its actual snapshot and complete verified fallback", async () => {
    const page = await loadPublisherLibrary(tenant, { tab: "dynamic", source: "news" }), source = page.syncDesigns![0]!;
    const slide: Slide = { id: id(80), name: source.name, image: "", seconds: 10, syncDynamic: source, mediaId: source.mediaAssetId, mediaChecksumSha256: source.checksumSha256, kind: source.kind };
    const original: Playlist = { id: id(90), name: "Nieuwsplaylist", description: "", status: "Concept", updated: "", slides: [] };
    expect(planPlaylistChanges(original, { ...original, slides: [slide] }, new Map([[slide.id, slide]]))[0]).toMatchObject({ operation: "add_sync_dynamic", dynamicSlideId: source.id, expectedSnapshotId: source.snapshotId, snapshotId: source.snapshotId, durationSeconds: 50 });
  });
  it("keeps RSS out of the Sportlink filter", async () => {
    const page = await loadPublisherLibrary(tenant, { tab: "dynamic", source: "sportlink" });
    expect(page.syncDesigns).toEqual([]); expect(page.unavailableDesigns?.map(item => item.id)).toEqual([id(71)]);
  });
});
