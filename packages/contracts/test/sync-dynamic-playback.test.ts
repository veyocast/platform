import {expect,it} from 'vitest';
import {syncDynamicPlaybackSchema,syncDynamicBinaryPlaybackSchema,syncSlidePresentationSchema} from '../src/index';
const presentation=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'fixtures',orientation:'landscape',theme:'fieldflow',name:'Eigen bronontwerp',title:'Eigen programma',club:{name:'Club A'},rows:Array.from({length:5},(_,i)=>[`Thuis ${i}`,'Uit','14:00','1']),style:{motion:'geen'}});
const metadata={schemaVersion:1,configurationSnapshotId:'10000000-0000-4000-8000-000000000228',snapshotId:'20000000-0000-4000-8000-000000000228',templateVersionId:'30000000-0000-4000-8000-000000000228',configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),fallbackChecksumSha256:'c'.repeat(64),durationMs:6000};
it('separates immutable configuration, current content and matching binary identity',()=>{
 const parsed=syncDynamicPlaybackSchema.parse({...metadata,presentation,assets:{}});expect(parsed.configurationSnapshotId).not.toBe(parsed.snapshotId);expect(parsed.durationMs).toBe(6000);expect(syncDynamicBinaryPlaybackSchema.parse(metadata)).toEqual(metadata);
 expect(syncDynamicBinaryPlaybackSchema.safeParse(parsed).success).toBe(false);
});
it('rejects page truncation, historical renderer identities and unrelated source images',()=>{
 for(const durationMs of[3000,6500,120001])expect(syncDynamicPlaybackSchema.safeParse({...metadata,durationMs,presentation,assets:{}}).success).toBe(false);
 expect(syncDynamicPlaybackSchema.safeParse({...metadata,presentation:{...presentation,rendererVersion:'sites-v17'},assets:{}}).success).toBe(false);
 const id='40000000-0000-4000-8000-000000000228',ref={kind:'tenant',mediaAssetId:id,checksumSha256:'d'.repeat(64)},asset={bytes:100,checksumSha256:'d'.repeat(64),mimeType:'image/png',url:'https://media.example/actual.png'};
 expect(syncDynamicPlaybackSchema.safeParse({...metadata,presentation:{...presentation,club:{...presentation.club,logo:ref}},assets:{}}).success).toBe(false);
 expect(syncDynamicPlaybackSchema.safeParse({...metadata,presentation:{...presentation,club:{...presentation.club,logo:ref}},assets:{[id]:asset}}).success).toBe(true);
 expect(syncDynamicPlaybackSchema.safeParse({...metadata,presentation,assets:{[id]:asset}}).success).toBe(false);
});
it('scopes a live binding to Source score designs without exposing URLs or weakening binary profiles',()=>{
 const liveMatch={connectionId:'40000000-0000-4000-8000-000000000228',sourceUpdatedAt:'2026-10-18T09:00:00Z',showClock:true};
 const value={...metadata,presentation:{...presentation,family:'scoreboard',rows:[]},assets:{},liveMatch};
 expect(syncDynamicPlaybackSchema.safeParse(value).success).toBe(true);
 expect(syncDynamicPlaybackSchema.safeParse({...value,presentation}).success).toBe(false);
 expect(syncDynamicPlaybackSchema.safeParse({...value,liveMatch:{...liveMatch,url:'https://provider.invalid'}}).success).toBe(false);
 expect(syncDynamicPlaybackSchema.safeParse({...value,liveMatch:{...liveMatch,sourceUpdatedAt:'invalid'}}).success).toBe(false);
 expect(syncDynamicBinaryPlaybackSchema.safeParse({...metadata,liveMatch}).success).toBe(false);
});
