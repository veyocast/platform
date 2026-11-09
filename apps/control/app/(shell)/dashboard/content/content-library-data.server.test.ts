import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./content-data.server", () => ({ contentLibraryColumns: "*", mapContentLibraryRows: vi.fn(async (_client, _tenant, rows) => rows) }));
import { loadContentLibrary } from "./content-library-data.server";
import { parseContentLibraryQuery } from "./content-library";
import type { Capability } from "@veyocast/auth";

type Row = { id: string; tenant_id: string; content_key: string; title: string; kind: string; family: string; status: string; archived: boolean; updated_at: string };
const row = (id: number, overrides: Partial<Row> = {}): Row => ({ id: String(id), tenant_id: "tenant-a", content_key: `item:${String(id).padStart(4, "0")}`, title: `Item ${id}`, kind: "studio", family: "free", status: "ready", archived: false, updated_at: "2026-11-09T12:00:00Z", ...overrides });
function database(rows: Row[], failed = false) {
  const queries: { method: string; args: unknown[] }[][] = [];
  const from = vi.fn(() => {
    const calls: { method: string; args: unknown[] }[] = []; queries.push(calls);
    let selected = [...rows], head = false, range: number[] | null = null;
    const orders: { column: keyof Row; ascending: boolean }[] = [];
    const chain: Record<string, unknown> = {};
    const method = (name: string, run: (...args: unknown[]) => void) => { chain[name] = (...args: unknown[]) => { calls.push({ method: name, args }); run(...args); return chain; }; };
    method("select", (_columns, options) => { head = Boolean((options as { head?: boolean })?.head); });
    method("eq", (key, value) => { selected = selected.filter(row => row[key as keyof Row] === value); });
    method("neq", (key, value) => { selected = selected.filter(row => row[key as keyof Row] !== value); });
    method("in", (key, values) => { selected = selected.filter(row => (values as unknown[]).includes(row[key as keyof Row])); });
    method("not", (key) => { selected = selected.filter(row => !["menu", "price_list"].includes(row[key as keyof Row] as string)); });
    method("ilike", (key, value) => { const needle = String(value).slice(1, -1).replace(/\\([%_*\\])/g, "$1").toLowerCase(); selected = selected.filter(row => String(row[key as keyof Row]).toLowerCase().includes(needle)); });
    method("filter", (key, operator, value) => { if (operator !== "imatch") throw Error("Unexpected operator"); const pattern = new RegExp(String(value), "i"); selected = selected.filter(row => pattern.test(String(row[key as keyof Row]))); });
    method("order", (column, options) => { orders.push({ column: column as keyof Row, ascending: (options as { ascending?: boolean })?.ascending !== false }); });
    method("range", (start, end) => { range = [Number(start), Number(end)]; });
    chain.then = (resolve: (value: unknown) => unknown) => {
      selected.sort((a, b) => { for (const { column, ascending } of orders) { const result = String(a[column]).localeCompare(String(b[column])); if (result) return ascending ? result : -result; } return 0; });
      return Promise.resolve({ data: head ? null : range ? selected.slice(range[0]!, range[1]! + 1) : selected, count: selected.length, error: failed ? { code: "42501" } : null }).then(resolve);
    };
    return chain;
  });
  return { client: { from } as unknown as NonNullable<Parameters<typeof loadContentLibrary>[0]>, queries, from };
}
const all: Capability[] = ["tenant.media.read", "tenant.studio.read", "tenant.dynamic_slide.read"];
describe("tenant-scoped server Content selection before pagination", () => {
  it("filters menus and price lists before paging, preserving stable tied keys", async () => {
    const rows = [...Array.from({ length: 60 }, (_, i) => row(i, { kind: "media" })), ...Array.from({ length: 30 }, (_, i) => row(100 + i, { kind: "dynamic", family: i % 2 ? "menu" : "price_list" }))].reverse();
    const db = database(rows);
    const result = await loadContentLibrary(db.client, "tenant-a", all, parseContentLibraryQuery({ filter: "menus", page: "2", pageSize: "24" }));
    expect(result.count).toBe(30); expect(result.items.map(item => item.id)).toEqual(["124", "125", "126", "127", "128", "129"]);
    const query = db.queries[0]!; expect(query.findIndex(call => call.method === "in" && call.args[0] === "family")).toBeLessThan(query.findIndex(call => call.method === "range"));
    expect(query.filter(call => call.method === "order").map(call => call.args[0])).toEqual(["updated_at", "content_key"]);
  });
  it("separates manual sports designs, automatic slides and series without duplicating Alles", async () => {
    const rows = [row(1), row(2, { kind: "dynamic", family: "results" }), row(3, { kind: "dynamic", family: "menu" }), row(4, { kind: "series", family: "series" })];
    for (const [filter, ids] of [["all", ["1", "2", "3", "4"]], ["designs", ["1"]], ["automatic", ["2"]], ["menus", ["3"]], ["series", ["4"]]] as const) {
      const db = database(rows); const result = await loadContentLibrary(db.client, "tenant-a", all, parseContentLibraryQuery({ filter }));
      expect(result.items.map(item => item.id), filter).toEqual(ids);
    }
  });
  it("never includes foreign-tenant or forbidden-category rows in search, totals or counts", async () => {
    const db = database([row(1, { kind: "media", title: "Eigen foto" }), row(2, { kind: "dynamic", title: "Verboden bron" }), row(3, { tenant_id: "tenant-b", kind: "media", title: "Geheim" })]);
    const result = await loadContentLibrary(db.client, "tenant-a", ["tenant.media.read"], parseContentLibraryQuery({}));
    expect(result).toMatchObject({ count: 1, total: 1, ready: 1, processing: 0 }); expect(result.items.map(item => item.id)).toEqual(["1"]);
    for (const query of db.queries) { expect(query).toContainEqual({ method: "eq", args: ["tenant_id", "tenant-a"] }); expect(query).toContainEqual({ method: "in", args: ["kind", ["media"]] }); }
    expect((await loadContentLibrary(db.client, "tenant-a", ["tenant.media.read"], parseContentLibraryQuery({ filter: "automatic", q: "Verboden" }))).count).toBe(0);
  });
  it("combines type, search and archive, and distinguishes valid empty from a technical failure", async () => {
    const rows = [row(1, { archived: true, title: "50% _*club" }), row(2, { title: "50% _*club" }), row(3, { archived: true, title: "Other" })];
    const db = database(rows);
    const result = await loadContentLibrary(db.client, "tenant-a", all, parseContentLibraryQuery({ filter: "designs", status: "archive", q: "50% _*club" }));
    expect(result.items.map(item => item.id)).toEqual(["1"]); expect(result.failed).toBe(false);
    expect(db.queries[0]).toContainEqual({ method: "filter", args: ["title", "imatch", "50% _\\*club"] });
    expect((await loadContentLibrary(database(rows, true).client, "tenant-a", all, parseContentLibraryQuery({}))).failed).toBe(true);
    expect((await loadContentLibrary(database([]).client, "tenant-a", all, parseContentLibraryQuery({}))).failed).toBe(false);
  });
  it("does not read any rows or counts for a write-only actor", async () => {
    const db = database([row(1)]); expect(await loadContentLibrary(db.client, "tenant-a", ["tenant.studio.create"], parseContentLibraryQuery({}))).toMatchObject({ items: [], total: 0, failed: false }); expect(db.from).not.toHaveBeenCalled();
  });
});
