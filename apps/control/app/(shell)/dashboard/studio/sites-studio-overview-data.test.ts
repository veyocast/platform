import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
import { loadStudioDynamicDesignCount, loadStudioSeriesOverview } from "./sites-studio-overview-data";
const tenantId = "19160300-0000-4000-8000-000000000001";
const filters: Array<[string, unknown]> = [];
let result: { error: null | { code: string }; count: number | null };
beforeEach(() => {
  vi.clearAllMocks(); filters.length = 0; result = { error: null, count: 27 };
  const query = {
    select: vi.fn(() => query),
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    neq: async (key: string, value: unknown) => { filters.push([key, value]); return result; }
  };
  mocks.client.mockResolvedValue({ from: vi.fn((table: string) => { filters.push(["table", table]); return query; }) });
});
describe("Studio's stored dynamic design count", () => {
  it("reads an exact aggregate under the authenticated tenant and excludes archived designs", async () => {
    expect(await loadStudioDynamicDesignCount(tenantId, true, true)).toBe(27);
    expect(filters).toEqual([["table", "dynamic_slides"], ["tenant_id", tenantId], ["status", "archived"]]);
  });
  it.each([[null, true, true], [tenantId, true, false]] as const)("does not query without tenant scope or read permission", async (id, live, permission) => {
    expect(await loadStudioDynamicDesignCount(id, live, permission)).toBeNull();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("reports an unavailable database count rather than an invented zero", async () => {
    result = { error: { code: "57014" }, count: null };
    expect(await loadStudioDynamicDesignCount(tenantId, true, true)).toBeNull();
  });
  it("keeps an actual empty database count distinct from failure", async () => {
    result = { error: null, count: 0 };
    expect(await loadStudioDynamicDesignCount(tenantId, true, true)).toBe(0);
  });
  it("does not open a database session for the existing explicitly non-live workspace", async () => {
    expect(await loadStudioDynamicDesignCount(tenantId, false, true)).toBe(0);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});


import { studioSitesSystemTemplates } from "@veyocast/studio";
import type { StudioProjectSummary } from "./types";
type QueryRow = Record<string, unknown>;
type QueryRead = { table: string; filters: Array<[string, unknown]>; columns: string; limit: number };
const seriesId = "19160300-0000-4000-8000-000000000020";
function project(index: number): StudioProjectSummary {
  return { id: `19160300-0000-4000-8000-${String(index).padStart(12,"0")}`, name: `Slide ${index}`, createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T11:00:00Z", document: studioSitesSystemTemplates[0]!.document, draftRevision: 2, durationMs: 15000, kind: "design", lastExportMediaId: null, lastRenderStatus: "completed", motionEnabled: false, orientation: "landscape", ownerUserId: null, projectRevision: 3, status: "active" };
}
function storedProject(value: StudioProjectSummary): QueryRow {
  return { id: value.id, name: value.name, created_at: value.createdAt, updated_at: value.updatedAt, duration_ms: value.durationMs, project_kind: value.kind, orientation: value.orientation, owner_user_id: value.ownerUserId, revision: value.projectRevision, status: value.status, motion_enabled: value.motionEnabled };
}
function mockSeriesReads(projects: StudioProjectSummary[], options: { missingMember?: boolean; errorTable?: string; archived?: boolean; changedRevisionMember?: number; changedAfterDraft?: boolean } = {}) {
  const reads: QueryRead[] = [];
  const members = projects.map((value,index) => ({ series_id: seriesId, project_id: value.id, sort_order: index }));
  mocks.client.mockResolvedValue({ from: (table: string) => {
    const read: QueryRead = { table, filters: [], columns: "", limit: 0 }; reads.push(read);
    const query = {
      select: (columns: string) => { read.columns = columns; return query; },
      eq: (key: string, value: unknown) => { read.filters.push([key,value]); return query; },
      in: (key: string, value: unknown) => { read.filters.push([key,value]); return query; },
      order: () => query,
      limit: async (limit: number) => {
        read.limit = limit;
        if (table === options.errorTable) return { data: null, error: { code: "57014" } };
        let data: QueryRow[] = [];
        if (table === "studio_series_items") {
          const scoped = read.filters.find(([key]) => key === "project_id")?.[1] as string[] | undefined;
          data = scoped ? members.filter(member => scoped.includes(member.project_id)) : members;
        } else if (table === "studio_series") data = options.archived ? [] : [{id: seriesId, name: "Onze complete collectie", updated_at: "2026-10-11T12:00:00Z"}];
        else if (table === "studio_projects") data = (options.missingMember ? projects.slice(1) : projects).map((value,index) => ({ ...storedProject(value), ...(options.changedRevisionMember === index || options.changedAfterDraft && read.columns === "id,revision" ? { revision: value.projectRevision + 1, duration_ms: 20000 } : {}) }));
        else if (table === "studio_project_drafts") data = projects.map(value => ({ project_id: value.id, draft_revision: value.draftRevision, document_json: value.document }));
        return {data,error:null};
      }
    }; return query;
  }});
  return reads;
}
describe("stored tenant-scoped Studio series overview", () => {
  it("groups the actual eight members into one design with their complete duration and preserves an unrelated design", async () => {
    const members = Array.from({length:8},(_,index)=>project(index+1));
    const standalone = project(99);
    const reads = mockSeriesReads(members);
    const result = await loadStudioSeriesOverview(tenantId,true,[...members].reverse().concat(standalone));
    expect(result.error).toBeNull();
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]).toMatchObject({id:members[0]!.id,seriesId,name:"Onze complete collectie",slideCount:8,durationMs:120000,lastRenderStatus:"completed",updatedAt:"2026-10-11T12:00:00Z"});
    expect(result.projects[1]).toEqual(standalone);
    expect(reads.every(read=>read.filters.some(([key,value])=>key==="tenant_id"&&value===tenantId))).toBe(true);
    expect(reads.find(read=>read.table==="studio_projects")?.filters).toContainEqual(["status","active"]);
  });
  it("loads the real first slide and all durations when a member is outside the overview page, without inventing ready status", async () => {
    const members = [project(1),project(2),project(3)];
    const reads = mockSeriesReads(members);
    const result = await loadStudioSeriesOverview(tenantId,true,[members[2]!]);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({id:members[0]!.id,slideCount:3,durationMs:45000,draftRevision:2,lastRenderStatus:null});
    expect(result.projects[0]!.document).toEqual(members[0]!.document);
    expect(reads.find(read=>read.table==="studio_project_drafts")?.filters).toContainEqual(["project_id",[members[0]!.id]]);
  });
  it("does not present an incomplete or foreign-tenant relation as a smaller complete series", async () => {
    const members = [project(1),project(2)]; mockSeriesReads(members,{missingMember:true});
    const result = await loadStudioSeriesOverview(tenantId,true,members);
    expect(result.projects).toEqual([]); expect(result.error).toContain("niet volledig");
  });
  it("refuses old completed content mixed with a newly saved member duration and project revision", async () => {
    const members=[project(1),project(2)];mockSeriesReads(members,{changedRevisionMember:1});
    const result=await loadStudioSeriesOverview(tenantId,true,members);
    expect(result.projects).toEqual([]);expect(result.error).toContain("niet volledig");
  });
  it("closes the metadata/draft race for a canonical first slide outside the overview page", async () => {
    const members=[project(1),project(2)];mockSeriesReads(members,{changedAfterDraft:true});
    const result=await loadStudioSeriesOverview(tenantId,true,[members[1]!]);
    expect(result.projects).toEqual([]);expect(result.error).toContain("Vernieuw");
  });
  it("keeps the original individual project when its stored series is archived", async () => {
    const value=project(1); mockSeriesReads([value],{archived:true});
    expect(await loadStudioSeriesOverview(tenantId,true,[value])).toEqual({projects:[value],error:null});
  });
  it("reports a transient relation lookup failure without leaking provider or database errors", async () => {
    const members=[project(1)];mockSeriesReads(members,{errorTable:"studio_series_items"});
    const result=await loadStudioSeriesOverview(tenantId,true,members);
    expect(result.projects).toEqual([]);expect(result.error).toContain("Vernieuw");expect(result.error).not.toContain("57014");
  });
  it("does not open an authenticated query for the existing non-live or empty overview", async () => {
    const value=project(1);
    expect(await loadStudioSeriesOverview(tenantId,false,[value])).toEqual({projects:[value],error:null});
    expect(await loadStudioSeriesOverview(tenantId,true,[])).toEqual({projects:[],error:null});
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("fails closed before queries when live tenant scope is absent", async () => {
    const result=await loadStudioSeriesOverview(null,true,[project(1)]);
    expect(result.projects).toEqual([]);expect(result.error).not.toBeNull();expect(mocks.client).not.toHaveBeenCalled();
  });
});
