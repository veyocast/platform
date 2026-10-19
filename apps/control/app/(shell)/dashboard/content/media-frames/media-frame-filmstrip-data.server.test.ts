import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ContentDataModule from "../content-data.server";
type ContentDataClient = ContentDataModule.ContentDataClient;
type ContentLibraryRow = ContentDataModule.ContentLibraryRow;
import type { ContentItem } from "../model";
const f = vi.hoisted(() => ({ mapper: vi.fn(), rpc: vi.fn() }));
vi.mock("../content-data.server", async importOriginal => ({ ...await importOriginal<typeof ContentDataModule>(), mapContentLibraryRows: f.mapper }));
import { loadContentFilmstripPage, loadMediaFrameSeriesBinding } from "./media-frame-filmstrip-data.server";
const id = (n: number) => `23200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let rows: ContentLibraryRow[], count: number | null, error: unknown;
let requests: Array<{ table: string; filters: Array<[string, unknown]>; range?: [number, number]; orders: string[] }>;
function row(n: number): ContentLibraryRow {
  return { id: id(n), content_key: `media:${id(n)}`, title: `Eigen bestand ${n}`, kind: "media", family: "image", status: "ready", archived: false, orientation: "landscape", duration_seconds: 12, updated_at: "2026-10-19T00:00:00Z", width: 1920, height: 1080, preview_asset_id: null, placement: null, revision: null, media_frame_id: null, media_frame_version_id: null };
}
function client(): ContentDataClient {
  return { rpc: f.rpc, from: (table: string) => {
    const request: typeof requests[number] = { table, filters: [], orders: [] }; requests.push(request);
    const q = { select: () => q, eq: (name: string, value: unknown) => { request.filters.push([name, value]); return q; }, order: (name: string) => { request.orders.push(name); return q; }, range: async (start: number, end: number) => { request.range = [start, end]; return { data: rows, count, error }; } };
    return q;
  } } as unknown as ContentDataClient;
}
beforeEach(() => {
  vi.resetAllMocks(); requests = []; rows = [row(20)]; count = 1; error = null;
  f.mapper.mockImplementation(async (_client, _tenant, input: ContentLibraryRow[]) => input.map(r => ({ ...r, id: r.id, key: r.content_key, href: `/dashboard/content/media/source/${r.id}`, preview: null, duration: 12 } as unknown as ContentItem)));
  f.rpc.mockResolvedValue({ data: { frameId: id(2), frameRevision: 7, versionId: id(3), versionNumber: 4, series: null }, error: null });
});

describe("Bounded entire Content library filmstrip", () => {
  it("loads48rows across the library and the49th on the next page without a20member cap", async () => {
    rows = Array.from({ length: 48 }, (_, index) => row(index + 20)); count = 49;
    const db = client(); expect(await loadContentFilmstripPage(db, id(1))).toMatchObject({ offset: 0, total: 49, hasMore: true, items: expect.arrayContaining([{ key: `media:${id(20)}`, title: "Eigen bestand 20", href: `/dashboard/content/media/source/${id(20)}`, orientation: "landscape", preview: { kind: "unavailable", message: expect.any(String) } }]) });
    expect(requests[0]).toEqual({ table: "sync_content_library_v1", filters: [["tenant_id", id(1)], ["archived", false]], range: [0, 47], orders: ["updated_at", "content_key"] });
    expect(f.mapper).toHaveBeenCalledWith(db, id(1), rows);
    rows = [row(68)]; expect(await loadContentFilmstripPage(db, id(1), 48)).toMatchObject({ offset: 48, total: 49, hasMore: false, items: [{ key: `media:${id(68)}` }] });
    expect(requests[1]!.range).toEqual([48, 95]); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("preserves actual mixed content keys/hrefs and verified preview DTOs from the shared mapper", async () => {
    rows = [row(20), { ...row(21), kind: "studio", content_key: `studio:${id(21)}` }, { ...row(22), kind: "dynamic", content_key: `dynamic:${id(22)}` }]; count = 3;
    f.mapper.mockResolvedValue([
      { key: rows[0]!.content_key, title: "Raw bestand", href: `/dashboard/content/media/source/${id(20)}`, orientation: null, preview: "https://storage.example.test/transient" },
      { key: rows[1]!.content_key, title: "Studio ontwerp", href: `/dashboard/studio/${id(21)}`, orientation: "portrait", preview: null },
      { key: rows[2]!.content_key, title: "Bronontwerp", href: `/dashboard/slides/${id(22)}`, orientation: "landscape", preview: null },
    ]);
    const page = await loadContentFilmstripPage(client(), id(1));
    expect(page?.items.map(item => [item.key, item.href])).toEqual([[`media:${id(20)}`, `/dashboard/content/media/source/${id(20)}`], [`studio:${id(21)}`, `/dashboard/studio/${id(21)}`], [`dynamic:${id(22)}`, `/dashboard/slides/${id(22)}`]]);
    expect(page?.items[0]!.preview).toEqual({ kind: "image", url: "https://storage.example.test/transient" });
  });
  it.each(["missing-count", "truncated", "duplicates", "archived", "foreign-key", "error"])("fails closed on %s instead of a false complete page", async mode => {
    if (mode === "missing-count") count = null;
    if (mode === "truncated") count = 49;
    if (mode === "duplicates") { rows.push(rows[0]!); count = 2; }
    if (mode === "archived") rows[0]!.archived = true;
    if (mode === "foreign-key") rows[0]!.content_key = `studio:${id(20)}`;
    if (mode === "error") error = { message: "private details" };
    expect(await loadContentFilmstripPage(client(), id(1))).toBeNull(); expect(f.mapper).not.toHaveBeenCalled();
  });
  it("does not query unbounded or fractional page offsets", async () => {
    for (const offset of [-1, 0.5, 2_147_483_601, Number.NaN]) expect(await loadContentFilmstripPage(client(), id(1), offset)).toBeNull();
    expect(requests).toEqual([]);
  });
});

describe("Atomic frame and series read fence", () => {
  const expected = { frameId: id(2), frameRevision: 7, versionId: id(3), versionNumber: 4 };
  it("accepts one matching unbound result without creating anything", async () => {
    expect(await loadMediaFrameSeriesBinding(client(), id(1), expected)).toEqual({ membership: null, series: null });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("get_media_frame_series_v1", { p_tenant_id: id(1), p_frame_id: id(2) });
  });
  it.each([{ frameRevision: 8 }, { versionId: id(99) }, { frameId: id(99) }, { versionNumber: 5 }])("rejects mixed mutable snapshot %j", async change => {
    f.rpc.mockResolvedValue({ data: { ...expected, series: null, ...change }, error: null });
    expect(await loadMediaFrameSeriesBinding(client(), id(1), expected)).toBeNull();
  });
  it("keeps archived-capable membership and21member summary from the single RPC", async () => {
    f.rpc.mockResolvedValue({ data: { ...expected, series: { seriesId: id(10), seriesRevision: 21, seriesTitle: "", position: 20, memberCount: 21 } }, error: null });
    expect(await loadMediaFrameSeriesBinding(client(), id(1), expected)).toEqual({ membership: { seriesId: id(10), seriesRevision: 21, seriesTitle: "", position: 20 }, series: { id: id(10), revision: 21, memberCount: 21 } });
  });
});
