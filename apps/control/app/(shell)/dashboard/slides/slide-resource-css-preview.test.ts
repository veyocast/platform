import { beforeEach, expect, it, vi } from "vitest";
import { createSyncStudioStarter } from "@veyocast/studio";
import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";
import { buildSitesPresentationFromDynamicPayload } from "@veyocast/content-templates/sites-dynamic-projector";
import { menuDomFixtureJob } from "../../../../../../tests/helpers/menu-dom-fixture";

const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), preview: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("../../../../lib/supabase/admin", () => ({ createControlAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./saved-slide-css-preview", () => ({ loadSavedSlideCssPreview: f.preview }));
import { loadSlideResourcePreview } from "./slide-resource-actions";

const tenant = "29500000-0000-4000-8000-000000000001";
const slideId = "29500000-0000-4000-8000-000000000002";
const snapshotId = "29500000-0000-4000-8000-000000000004";
const presentation = createSyncStudioStarter({ family: "rss", tenantName: "Eigen club", theme: "onzetrots-tv" }).syncPresentation!;
const payload = { schemaVersion: 1 as const, slideType: "news" as const, orientation: "landscape" as const, snapshotId, snapshotHash: "a".repeat(64), templateVersionId: "29500000-0000-4000-8000-000000000005", templateSlug: "club-news", data: { news: { articles: [{ title: "Opgeslagen bronkop" }] } }, assets: {} };
let row: Record<string, unknown> | null;
let readError: { code: string } | null;
let reads: Array<[string, unknown]>;
let from: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  row = { id: slideId, tenant_id: tenant, name: "Eigen bronontwerp", orientation: "landscape", slide_type: "news", current_snapshot_id: null, current_published_version_id: null, active_draft_version_id: "29500000-0000-4000-8000-000000000003" };
  readError = null;
  reads = [];
  rpc = vi.fn(() => { throw Error("A preview must not publish, sync or request a render"); });
  from = vi.fn((table: string) => {
    if (table !== "dynamic_slides") throw Error("The validated direct preview must precede the old ready-snapshot gate");
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { reads.push([key, value]); return query; },
      maybeSingle: async () => ({ data: row, error: readError })
    };
    return query;
  });
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant });
  f.client.mockResolvedValue({ from, rpc });
  f.preview.mockResolvedValue({ kind: "source", payload, presentation, assetUrls: {}, durationSeconds: 10, id: snapshotId });
});

it("opens saved Source CSS from the library while the first worker receipt and current snapshot are absent", async () => {
  const result = await loadSlideResourcePreview(slideId);
  expect(result).toMatchObject({ ok: true, payload, cssPreview: { kind: "source", presentation, durationSeconds: 10, id: snapshotId }, missingAssetCount: 0 });
  if (!result.ok) throw Error("Expected saved CSS");
  expect(result.cssPreview).not.toHaveProperty("payload");
  expect(reads).toEqual([["tenant_id", tenant], ["id", slideId]]);
  expect(f.session).toHaveBeenCalledWith("tenant.dynamic_slide.read");
  expect(f.preview).toHaveBeenCalledWith(await f.client.mock.results[0]!.value, tenant, row);
  expect(from).toHaveBeenCalledTimes(1);
  expect(rpc).not.toHaveBeenCalled();
});

it("passes the same validated Menu composition to the library without waiting for a PNG", async () => {
  const fixture = menuDomFixtureJob();
  const menuPayload = playerDynamicTemplatePayloadSchema.parse({ ...payload, slideType: "price_list", data: fixture.snapshotData });
  const menu = buildSitesPresentationFromDynamicPayload(menuPayload);
  expect(menu?.kind).toBe("dynamic");
  if (menu?.kind !== "dynamic") throw Error("Expected the real Menu widget composition");
  expect(menu.content.menuPages).toHaveLength(2);
  f.preview.mockResolvedValue({ kind: "menu", payload: menuPayload, presentation: menu, assetUrls: {} });
  expect(await loadSlideResourcePreview(slideId)).toMatchObject({ ok: true, cssPreview: { kind: "menu", presentation: menu }, payload: menuPayload });
  expect(from).toHaveBeenCalledTimes(1);
  expect(rpc).not.toHaveBeenCalled();
});

it("does not claim a preview when canonical version or asset verification rejects the queued design", async () => {
  f.preview.mockResolvedValue(null);
  expect(await loadSlideResourcePreview(slideId)).toMatchObject({ ok: false, code: "PREVIEW_NOT_READY" });
  expect(rpc).not.toHaveBeenCalled();
});

it("respects an unavailable or denied tenant read before attempting the CSS loader", async () => {
  readError = { code: "42501" };
  expect(await loadSlideResourcePreview(slideId)).toMatchObject({ ok: false, code: "42501" });
  expect(f.preview).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("does not create a source read or export for a missing tenant session", async () => {
  f.session.mockResolvedValue({ isLive: false, tenantId: null });
  expect(await loadSlideResourcePreview(slideId)).toMatchObject({ ok: false, code: "PREVIEW_SELECTION_INVALID" });
  expect(from).not.toHaveBeenCalled();
  expect(f.preview).not.toHaveBeenCalled();
});

it("rejects an invalid slide identity before any database read", async () => {
  expect(await loadSlideResourcePreview("another-tenant/not-a-slide")).toMatchObject({ ok: false, code: "PREVIEW_SELECTION_INVALID" });
  expect(from).not.toHaveBeenCalled();
  expect(f.preview).not.toHaveBeenCalled();
});
