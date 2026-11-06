import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { syncDynamicConfigurationSchema } from "@veyocast/contracts";
import { createSyncStudioStarter } from "@veyocast/studio";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { SitesStaticView } from "@veyocast/content-templates/sites-static-view";
import { menuDomFixture } from "../../../../../../tests/helpers/menu-dom-fixture";
import type * as PreviewAssets from "../../../../lib/dynamic-preview-assets";

const f = vi.hoisted(() => ({ assets: vi.fn() }));
vi.mock("../../../../lib/dynamic-preview-assets", async importOriginal => ({
  ...await importOriginal<typeof PreviewAssets>(), loadPreviewAssets: f.assets
}));
import { loadSavedSlideCssPreview } from "./saved-slide-css-preview";

type Row = Record<string, unknown>;
const id = (n: number) => `29500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), slideId = id(2), versionId = id(3), snapshotId = id(4), templateVersionId = id(5), sourceId = id(6), templateId = id(7);
const seed = createSyncStudioStarter({ family: "rss", tenantName: "Eigen club", theme: "onzetrots-tv" }).syncPresentation!;
const configuration = syncDynamicConfigurationSchema.parse({ schemaVersion: 1, kind: "dynamic", rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: "news", seed, secondsPerPage: 10 });

function fixture() {
  const slide = { id: slideId, tenant_id: tenant, current_snapshot_id: null as string | null, current_published_version_id: null as string | null, active_draft_version_id: versionId };
  const version: Row = { id: versionId, tenant_id: tenant, dynamic_slide_id: slideId, status: "publishing", orientation: "landscape", slide_type: "news", template_version_id: templateVersionId, data_source_id: sourceId, configuration_json: { syncConfiguration: structuredClone(configuration) } };
  const data = { type: "news", syncPlaybackProtocol: 2, syncConfiguration: structuredClone(configuration), generatedAt: new Date().toISOString(), news: { title: "Nieuws", sourceName: "Eigen nieuwsbron", secondsPerSlide: 10, articles: [{ id: "article-1", title: "Bestaande bronkop", intro: "Werkelijke broninhoud", link: "https://example.invalid/nieuws/1" }] } };
  const snapshot: Row = { id: snapshotId, tenant_id: tenant, dynamic_slide_id: slideId, dynamic_slide_version_id: versionId, template_version_id: templateVersionId, data_source_id: sourceId, source_revision_hash: "a".repeat(64), snapshot_data_json: data, status: "queued", snapshot_sequence: 1, created_at: "2026-11-06T00:00:00Z" };
  const template: Row = { id: templateId, slug: "stored-source-news", orientation: "landscape", slide_type: "news" };
  const tables: Record<string, Row[]> = { dynamic_slide_versions: [version], dynamic_slide_snapshots: [snapshot], dynamic_template_versions: [{ id: templateVersionId, template_id: templateId }], dynamic_templates: [template] };
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const faults = { ignoreFilters: false, denied: "" };
  const rpc = vi.fn(() => { throw Error("Preview must not issue commands or a write-capability RPC"); });
  const client = {
    rpc,
    from(table: string) {
      const filters: Array<[string, unknown]> = [], orders: Array<[string, boolean]> = [];
      let maximum = Number.POSITIVE_INFINITY;
      calls.push({ table, filters });
      const query = {
        select: () => query,
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        in(column: string, values: unknown[]) { filters.push([column, values]); return query; },
        order(column: string, options: { ascending: boolean }) { orders.push([column, options.ascending]); return query; },
        limit(value: number) { maximum = value; return query; },
        async maybeSingle() {
          if (faults.denied === table) return { data: null, error: { code: "42501" } };
          const rows = (tables[table] ?? []).filter(row => faults.ignoreFilters || filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
          rows.sort((a, b) => {
            for (const [key, ascending] of orders) {
              const left = a[key] as string | number, right = b[key] as string | number;
              if (left !== right) return (left < right ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          return { data: rows.slice(0, maximum)[0] ?? null, error: null };
        }
      };
      return query;
    }
  };
  const load = () => loadSavedSlideCssPreview(client as unknown as Parameters<typeof loadSavedSlideCssPreview>[0], tenant, slide);
  return { slide, version, snapshot, data, template, tables, calls, faults, rpc, load };
}

beforeEach(() => { vi.clearAllMocks(); f.assets.mockResolvedValue(new Map()); });

it.each(["queued", "rendering"])("renders the actual saved Source CSS while its first snapshot is %s and has no media or worker receipt", async status => {
  const value = fixture(); value.snapshot.status = status;
  const preview = await value.load();
  expect(preview?.kind).toBe("source");
  if (preview?.kind !== "source") throw Error("Source preview missing");
  expect(preview.presentation.news[0]?.title).toBe("Bestaande bronkop");
  expect(renderToStaticMarkup(<SyncSlideStaticView presentation={preview.presentation} />)).toContain("Bestaande bronkop");
  expect(value.slide.current_snapshot_id).toBeNull();
  expect(value.snapshot.status).toBe(status);
  expect(value.snapshot).not.toHaveProperty("sync_render_result_json");
  expect(value.rpc).not.toHaveBeenCalled();
  expect(value.calls.filter(call => call.table.startsWith("dynamic_slide_")).every(call => call.filters.some(([key, id]) => key === "tenant_id" && id === tenant))).toBe(true);
});

it.each(["queued", "failed"])("retains the pinned last-good published Source while a newer draft snapshot is %s", async status => {
  const value = fixture();
  value.slide.current_snapshot_id = snapshotId; value.slide.current_published_version_id = versionId; value.slide.active_draft_version_id = id(8);
  value.version.status = "published"; value.snapshot.status = "ready";
  value.tables.dynamic_slide_versions!.push({ ...value.version, id: id(8), status: "publishing" });
  value.tables.dynamic_slide_snapshots!.push({ ...value.snapshot, id: id(9), dynamic_slide_version_id: id(8), snapshot_sequence: 2, status, snapshot_data_json: { ...value.data, news: { ...value.data.news, articles: [{ ...value.data.news.articles[0], title: "Nieuw concept" }] } } });
  const preview = await value.load();
  expect(preview?.kind).toBe("source");
  if (preview?.kind !== "source") throw Error("Last-good Source preview missing");
  expect(preview.id).toBe(snapshotId);
  expect(preview.presentation.news.map(article => article.title)).toEqual(["Bestaande bronkop"]);
});

it("shows the exact initial version when its completion commits after the page read its still-empty snapshot pointer", async () => {
  const value = fixture(); value.version.status = "published"; value.snapshot.status = "ready";
  expect(value.slide.current_snapshot_id).toBeNull();
  expect(await value.load()).toMatchObject({ kind: "source", id: snapshotId });
});

it("never falls through a missing published snapshot to an unrelated latest draft", async () => {
  const value = fixture(); value.slide.current_snapshot_id = id(99); value.slide.current_published_version_id = versionId; value.version.status = "published";
  expect(await value.load()).toBeNull(); expect(f.assets).not.toHaveBeenCalled();
});

it.each(["tenant_id", "dynamic_slide_id", "dynamic_slide_version_id", "template_version_id", "data_source_id"])("rejects a returned snapshot with the wrong %s even if a database client fails to filter it", async field => {
  const value = fixture(); value.snapshot[field] = id(99); value.faults.ignoreFilters = true;
  expect(await value.load()).toBeNull(); expect(f.assets).not.toHaveBeenCalled();
});

it.each(["tenant_id", "dynamic_slide_id", "id", "status"])("rejects an unauthorized returned version with the wrong %s before loading any snapshot", async field => {
  const value = fixture(); value.version[field] = field === "status" ? "draft" : id(99); value.faults.ignoreFilters = true;
  expect(await value.load()).toBeNull();
  expect(value.calls.some(call => call.table === "dynamic_slide_snapshots")).toBe(false);
});

it("does not bypass read permissions or render an unsubmitted editable draft", async () => {
  const denied = fixture(); denied.faults.denied = "dynamic_slide_snapshots";
  expect(await denied.load()).toBeNull(); expect(denied.rpc).not.toHaveBeenCalled();
  const draft = fixture(); draft.version.status = "draft";
  expect(await draft.load()).toBeNull();
  const foreign = fixture(); foreign.slide.tenant_id = id(99);
  expect(await foreign.load()).toBeNull(); expect(foreign.calls).toEqual([]);
});

it("rejects invalid canonical data, mismatched saved design, and failed first snapshots", async () => {
  const invalid = fixture(); invalid.data.type = "menu";
  expect(await invalid.load()).toBeNull();
  const design = fixture(); design.data.syncConfiguration.seed.title = "Unsaved design";
  expect(await design.load()).toBeNull();
  const failed = fixture(); failed.snapshot.status = "failed";
  expect(await failed.load()).toBeNull();
});

it("requires the canonical image and the authored checksum before showing an immediate Source preview", async () => {
  const value = fixture(), assetId = id(12), sha = "b".repeat(64);
  const cfg = structuredClone(configuration); cfg.seed.club.logo = { kind: "tenant", mediaAssetId: assetId, checksumSha256: sha };
  value.version.configuration_json = { syncConfiguration: cfg }; value.data.syncConfiguration = cfg;
  expect(await value.load()).toBeNull();
  f.assets.mockResolvedValueOnce(new Map([[assetId, { url: "https://example.invalid/logo.png", bytes: 100, checksumSha256: "c".repeat(64), mimeType: "image/png" }]]));
  expect(await value.load()).toBeNull();
  f.assets.mockResolvedValueOnce(new Map([[assetId, { url: "https://example.invalid/logo.png", bytes: 100, checksumSha256: sha, mimeType: "image/png" }]]));
  expect(await value.load()).toMatchObject({ kind: "source", assetUrls: { [assetId]: "https://example.invalid/logo.png" } });
});

it.each(["manual_products", "twelve_excel"] as const)("projects actual %s MenuDocument widgets and approved price before its descriptor exists", async provider => {
  const value = fixture(), menu = menuDomFixture(provider, "landscape"), document = { ...menu.document, tenantId: tenant };
  value.version.slide_type = "price_list"; value.version.configuration_json = document;
  value.template.slide_type = "price_list";
  value.snapshot.snapshot_data_json = { type: "price_list", syncPlaybackProtocol: 2, menuDocument: document, sitesConfiguration: menu.design, brand: { clubName: "Eigen club" } };
  const preview = await value.load();
  expect(preview?.kind).toBe("menu");
  if (preview?.kind !== "menu") throw Error("Menu preview missing");
  const html = renderToStaticMarkup(<SitesStaticView presentation={preview.presentation} />);
  expect(html).toContain("Clubkoffie"); expect(html).toContain("2,50");
  expect(value.snapshot.status).toBe("queued"); expect(value.rpc).not.toHaveBeenCalled();
  value.version.configuration_json = { ...document, revision: 2 };
  expect(await value.load()).toBeNull();
});

it("rejects a top-level Menu configuration that differs from the exact saved document", async () => {
  const value = fixture(), menu = menuDomFixture("manual_products", "landscape"), document = { ...menu.document, tenantId: tenant };
  value.version.slide_type = "price_list"; value.version.configuration_json = document; value.template.slide_type = "price_list";
  value.snapshot.snapshot_data_json = { type: "price_list", menuDocument: document, sitesConfiguration: { ...menu.design, title: "Niet opgeslagen vormgeving" } };
  expect(await value.load()).toBeNull();
});

it("verifies the saved Menu asset manifest checksum instead of adopting whichever image the loader returns", async () => {
  const value = fixture(), menu = menuDomFixture("manual_products", "landscape"), assetId = id(12), sha = "b".repeat(64);
  const document = { ...menu.document, tenantId: tenant, theme: { ...menu.document.theme, brand: { ...menu.document.theme.brand, logoAssetId: assetId } }, assets: [{ assetId, assetVersion: "original-v1", kind: "logo" as const, sha256: sha, status: "ready" as const }] };
  value.version.slide_type = "price_list"; value.version.configuration_json = document; value.template.slide_type = "price_list";
  value.snapshot.snapshot_data_json = { type: "price_list", menuDocument: document, sitesConfiguration: menu.design };
  f.assets.mockResolvedValueOnce(new Map([[assetId, { url: "https://example.invalid/logo.png", bytes: 100, checksumSha256: "c".repeat(64), mimeType: "image/png" }]]));
  expect(await value.load()).toBeNull();
  f.assets.mockResolvedValueOnce(new Map([[assetId, { url: "https://example.invalid/logo.png", bytes: 100, checksumSha256: sha, mimeType: "image/png" }]]));
  expect(await value.load()).toMatchObject({ kind: "menu", assetUrls: { [assetId]: "https://example.invalid/logo.png" } });
});
