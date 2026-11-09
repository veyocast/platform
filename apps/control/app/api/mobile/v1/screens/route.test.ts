import type * as MobileContext from "../../../../../lib/mobile-api/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  detail: {} as unknown,
  seen: "",
  references: [] as string[],
  tenant: "tenant-a",
  screenStatus: "active",
  assignedReleaseId: "new-target" as string | null,
  capabilities: ["tenant.screen.read"] as string[],
  reads: 0,
  sourceReads: [] as unknown[]
}));
vi.mock("../../../../../lib/mobile-api/context", async importOriginal => ({
  ...await importOriginal<typeof MobileContext>(),
  getMobileRequestContext: async () => ({ requestId: "screen-readback", tenants:[{id:fixture.tenant,status:"active",capabilities:fixture.capabilities}], supabase: { rpc: async(name:string,args:unknown) => {fixture.sourceReads.push({name,args});return {data:[],error:null};}, from: (table: string) => {
    fixture.reads++;
    const filters = new Map<string, unknown>();
    const query = {
      select: () => query, is: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      in: (key: string, values: string[]) => { filters.set(key, values); return query; },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = table === "screens" ? [{ id: "screen-a", name: "Kantine", status: fixture.screenStatus, location: null, assigned_release_id: fixture.assignedReleaseId }]
          : table === "player_devices" ? [{ screen_id: "screen-a", status: "paired", app_version: "1", last_seen_at: fixture.seen, last_error_code: null, active_release_id: "old-lkg", desired_release_id: "new-target", current_sync_detail: fixture.detail }]
          : table === "playlist_releases" ? [
            { id: "old-lkg", version: 1, playlist: { name: "Bevestigde oude inhoud" } },
            { id: "new-target", version: 1001, playlist: { name: "Nieuwe opdracht" } }
          ].filter(row => ((filters.get("id") as string[] | undefined) ?? []).includes(row.id)) : [];
        if (table === "playlist_releases") fixture.references = filters.get("id") as string[];
        return Promise.resolve({ data: filters.get("tenant_id") === fixture.tenant ? rows : [], error: null }).then(resolve);
      }
    }; return query;
  } } })
}));

import { GET } from "./route";
function screenRequest(url: string, tenant = "tenant-a") {
  return new Request(url, {headers:{"x-veyocast-tenant-id":tenant}});
}

beforeEach(() => {
  fixture.seen = new Date().toISOString();
  fixture.detail = { publicationTrace: { releaseId: "old-lkg", firstFrameAt: new Date(Date.now() - 1000).toISOString() } };
  fixture.references = [];
  fixture.screenStatus = "active";
  fixture.assignedReleaseId = "new-target";
  fixture.capabilities = ["tenant.screen.read"];
  fixture.reads = 0;
  fixture.sourceReads=[];
});
describe("mobile screen publication readback", () => {
  it("returns the confirmed old release while a different assignment is pending, using explicit references", async () => {
    const response = await GET(screenRequest("http://localhost/api/mobile/v1/screens"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0].activeReleaseLabel).toBe("Bevestigde oude inhoud · versie 1");
    expect(fixture.references).toEqual(expect.arrayContaining(["old-lkg", "new-target"]));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not report an assigned or heartbeat-only release as visibly active", async () => {
    fixture.detail = {};
    const response = await GET(screenRequest("http://localhost/api/mobile/v1/screens"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0].activeReleaseLabel).toBeNull();
    expect(body.data.items[0].status).toBe("online");
  });
});


it("SCR-01/02 keeps v1 strict shape and exposes precise status only on explicit opt-in", async () => {
  const now = Date.now(); vi.spyOn(Date,"now").mockReturnValue(now);
  try {
    fixture.seen = new Date(now-5*60_000).toISOString();
    const old = await (await GET(screenRequest("http://localhost/api/mobile/v1/screens"))).json();
    expect(Object.keys(old.data.items[0]).sort()).toEqual(["activeReleaseLabel","appVersion","id","lastErrorCode","lastSeenAt","location","name","status"].sort());
    expect(old.data.items[0].status).toBe("unknown");
    const next = await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json();
    expect(next.data.items[0].statusEvidence).toMatchObject({kind:"stale",publicationKind:"unconfirmed"});
    fixture.seen = new Date(now-30*60_000).toISOString();
    expect((await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json()).data.items[0].statusEvidence.kind).toBe("offline");
    fixture.screenStatus = "maintenance";
    fixture.seen = new Date(now+1).toISOString();
    expect((await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json()).data.items[0].statusEvidence.kind).toBe("maintenance");
    fixture.screenStatus = "active";
  fixture.assignedReleaseId = "new-target";
    expect((await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json()).data.items[0].statusEvidence.kind).toBe("unknown");
  } finally {vi.restoreAllMocks();}
});

it("denies cross-tenant evidence and a missing screen capability before any read", async()=>{
 expect((await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1","tenant-b"))).status).toBe(404);
 expect(fixture.reads).toBe(0);
 fixture.capabilities=[];
 expect((await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).status).toBe(403);
 expect(fixture.reads).toBe(0);
});

it("bounds source metadata to one explicitly requested screen inside the authorized list",async()=>{
 await GET(screenRequest("http://localhost/api/mobile/v1/screens?sourceEvidenceFor=screen-a"));expect(fixture.sourceReads).toHaveLength(0);
 await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1&sourceEvidenceFor=foreign-screen"));expect(fixture.sourceReads).toHaveLength(0);
 const body=await(await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1&sourceEvidenceFor=screen-a"))).json();
 expect(fixture.sourceReads).toEqual([{name:"get_screen_source_status_s296_v1",args:{p_tenant_id:"tenant-a",p_screen_id:"screen-a"}}]);
 expect(body.data.items[0].statusEvidence.sources).toEqual([]);
});

it("SCR-03 screen assignment, including explicit null, overrides stale device desire",async()=>{
 fixture.assignedReleaseId="old-lkg";
 const confirmed=await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json();
 expect(confirmed.data.items[0].statusEvidence).toMatchObject({publicationKind:"confirmed",desiredReleaseLabel:"Bevestigde oude inhoud · versie 1"});
 fixture.assignedReleaseId=null;
 const cleared=await (await GET(screenRequest("http://localhost/api/mobile/v1/screens?statusEvidence=1"))).json();
 expect(cleared.data.items[0].statusEvidence).toMatchObject({publicationKind:"unconfirmed",desiredReleaseLabel:null});
 expect(cleared.data.items[0].activeReleaseLabel).toBe("Bevestigde oude inhoud · versie 1");
});
