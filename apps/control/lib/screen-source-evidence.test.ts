import {expect,it} from "vitest";
import {readScreenSourceMetadata,screenSourceEvidence} from "./screen-source-evidence";
const now=Date.parse("2026-11-09T12:00:00Z");
const row={snapshotId:"own-snapshot",sourceName:"Sportlink",sourceKind:"sportlink",datasetKey:"competitions",lastSuccessAt:"2026-11-08T12:00:00Z",lastAttemptAt:"2026-11-09T11:00:00Z",checkedAt:"2026-11-09T11:00:01Z",dataRevision:4,contentHash:"a".repeat(64),lastErrorCode:null};
it("SCR-04 distinguishes last successful source observation from checked data and reported frame",()=>{
 const [parsed]=readScreenSourceMetadata([row]);
 expect(screenSourceEvidence(parsed!,{configurationSnapshotId:"own-snapshot",dataRevision:3,contentHash:"b".repeat(64)},now)).toMatchObject({lastSuccessAt:row.lastSuccessAt,checkedAt:row.checkedAt,reportedRevision:3,contentConfirmed:false});
 expect(screenSourceEvidence(parsed!,{configurationSnapshotId:"own-snapshot",dataRevision:4,contentHash:row.contentHash},now).contentConfirmed).toBe(true);
});
it("does not borrow confirmation from another snapshot and rejects impossible timestamps",()=>{
 const [parsed]=readScreenSourceMetadata([{...row,lastSuccessAt:"2026-11-09T12:00:01Z",checkedAt:"invalid"}]);
 expect(screenSourceEvidence(parsed!,{configurationSnapshotId:"other-snapshot",dataRevision:4,contentHash:row.contentHash},now)).toMatchObject({lastSuccessAt:null,checkedAt:null,reportedRevision:null,contentConfirmed:false});
 expect(readScreenSourceMetadata([{rawProviderData:"must not render"}])).toEqual([]);
});
