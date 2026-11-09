import {expect,it} from "vitest";
import {mobileScreenSummarySchema} from "@veyocast/contracts";
import {mobileScreenStatus} from "./screen-status";
const now=Date.parse("2026-11-09T12:00:00Z");
const old={id:"29600000-0000-4000-8000-000000000001",name:"Kantine",location:null,appVersion:null,lastErrorCode:null,lastSeenAt:new Date(now-60_000).toISOString(),activeReleaseLabel:"Clubavond · versie 1",status:"online"};
it("SCR-01/04 re-evaluates an older strict v1 cache at the shared 5/30 minute boundaries",()=>{
 const cached=mobileScreenSummarySchema.parse(old);
 expect(mobileScreenStatus(cached,now).kind).toBe("online");
 expect(mobileScreenStatus(cached,now+4*60_000).kind).toBe("stale");
 expect(mobileScreenStatus(cached,now+29*60_000).kind).toBe("offline");
 expect(cached.activeReleaseLabel).toBe("Clubavond · versie 1");
});
it("SCR-02/03 metadata preserves management priority and historical confirmation",()=>{
 const current=mobileScreenSummarySchema.parse({...old,statusEvidence:{screenStatus:"maintenance",deviceStatus:"paired",kind:"maintenance",publicationKind:"unconfirmed",desiredReleaseLabel:"Nieuwe avond · versie 2",desiredPublishedAt:null,confirmedAt:"2026-11-09T10:00:00Z",reportedSourceRevision:3,reportedSourceAt:old.lastSeenAt}});
 expect(mobileScreenStatus(current,now+60*60_000)).toMatchObject({kind:"maintenance",reachable:false,confirmedAt:"2026-11-09T10:00:00Z",reportedSourceRevision:3});
});
it("future contact never becomes online in native views",()=>expect(mobileScreenStatus(mobileScreenSummarySchema.parse({...old,lastSeenAt:new Date(now+1).toISOString()}),now).kind).toBe("unknown"));

it("invalid or future cached proof timestamps stay unknown independently of valid contact",()=>{
 const future="2026-11-09T12:00:00.001Z";
 const current=mobileScreenSummarySchema.parse({...old,statusEvidence:{screenStatus:"active",deviceStatus:"paired",kind:"online",publicationKind:"unconfirmed",desiredReleaseLabel:null,desiredPublishedAt:null,confirmedAt:future,reportedSourceRevision:3,reportedSourceAt:future,sources:[{snapshotId:"29600000-0000-4000-8000-000000000001",sourceName:"Sportlink",sourceKind:"sportlink",datasetKey:"competitions",lastSuccessAt:future,lastAttemptAt:null,checkedAt:null,dataRevision:4,contentHash:null,lastErrorCode:null}]}});
 expect(mobileScreenStatus(current,now)).toMatchObject({kind:"online",confirmedAt:null,reportedSourceRevision:null,reportedSourceAt:null,sources:[{lastSuccessAt:null}]});
});
