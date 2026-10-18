import {expect,it} from 'vitest';
import {syncDynamicConfigurationSchema,syncSlidePresentationSchema} from '@veyocast/contracts';
import {projectSyncLiveMatch,selectSyncLiveMatchState} from './sync-live-match';
import {parseLedScoresMatchStateMessage} from './ledscores-match-experience';
import {readSyncDynamicReleaseSnapshot} from './player-sync-dynamic-payload';

const id='10000000-0000-4000-8000-000000000231',at='2026-10-18T09:00:00Z';
const state=parseLedScoresMatchStateMessage({connectionId:id,stateSequence:4,state:{schemaVersion:1,matchKey:'actual-match',stateRevision:4,status:'live',home:{name:'Eigen thuis',score:2},away:{name:'Eigen uit',score:1},clock:{anchorAt:at,anchorSeconds:120,direction:'up',maxSeconds:7200,running:true},sourceUpdatedAt:at,staleAfter:'2026-10-18T09:00:10Z',timeline:[]}})!;
const binding={connectionId:id,sourceUpdatedAt:at,showClock:true};
const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'scoreboard',orientation:'landscape',theme:'fieldflow',name:'Eigen wedstrijd',title:'De tussenstand',club:{name:'Club A'},style:{motion:'geen'}});

it('accepts only the authorized connection at least as fresh as the complete fallback',()=>{
 expect(state).not.toBeNull();expect(selectSyncLiveMatchState(binding,null,state)).toBe(state);
 expect(selectSyncLiveMatchState(binding,null,{...state,connectionId:'20000000-0000-4000-8000-000000000231'})).toBeNull();
 expect(selectSyncLiveMatchState(binding,null,{...state,sourceUpdatedAt:'2026-10-18T08:59:59Z'})).toBeNull();
 expect(selectSyncLiveMatchState(undefined,state,state)).toBeNull();
});
it('retains the latest observed score through waiting placeholders, out-of-order messages and missing stream state',()=>{
 for(const next of[undefined,{...state,matchKey:'waiting:'+id,status:'unknown' as const,revision:'0'},{...state,sequence:3,home:{...state.home,score:0}}])expect(selectSyncLiveMatchState(binding,state,next)).toBe(state);
 const next={...state,sequence:5,revision:'5',home:{...state.home,score:0}};
 expect(selectSyncLiveMatchState(binding,state,next)).toBe(next); // a real correction to zero is valid
});
it('ticks locally up to staleAfter and preserves the Source design without raw stream image URLs',()=>{
 const logo={kind:'tenant' as const,mediaAssetId:id,checksumSha256:'a'.repeat(64)},base={...seed,home:{name:state.home.name,team:'',logo},away:{name:'Old opponent',team:'',logo}};
 const now=Date.parse(at),live={...state,home:{...state.home,logoUrl:'https://unverified.invalid/logo.png'}};
 const first=projectSyncLiveMatch(base,live,true,now+5000),stale=projectSyncLiveMatch(base,live,true,now+60000);
 expect(first.match).toMatchObject({homeScore:'2',awayScore:'1',clock:'02:05'});expect(stale.match?.clock).toBe('02:10');
 expect(first.home?.logo).toEqual(logo);expect(first.away?.logo).toBeUndefined();expect(JSON.stringify(first)).not.toContain('unverified');
 expect(first.theme).toBe(seed.theme);expect(first.style).toBe(seed.style);expect(projectSyncLiveMatch(base,live,false,now).match?.clock).toBe('');
 expect(projectSyncLiveMatch(seed,null,true,now)).toBe(seed);
});
it('derives the DOM stream binding from the canonical snapshot while keeping the binary metadata independent',()=>{
 const configuration=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'ledscores_live_match',seed,secondsPerPage:5});
 const frozen=projectSyncLiveMatch(seed,state,true,Date.parse(at));
 const snapshot={id,dynamic_slide_version_id:id,template_version_id:id,source_revision_hash:'b'.repeat(64),status:'ready',snapshot_data_json:{type:'ledscores_live_match',syncConfiguration:configuration,liveMatch:{connectionId:id,configuration:{showClock:true},state}},sync_render_result_json:{presentation:frozen,checksumSha256:'c'.repeat(64),byteLength:100,mimeType:'image/png',durationMs:5000}};
 const result=readSyncDynamicReleaseSnapshot(snapshot,{checksum_sha256:'c'.repeat(64),file_size_bytes:100,mime_type:'image/png',asset_kind:'image',duration_seconds:5});
 expect(result.liveMatch).toEqual({...binding,sourceUpdatedAt:state.sourceUpdatedAt});expect(result.metadata).not.toHaveProperty('liveMatch');expect(result.presentation).toEqual(frozen);
 expect(()=>readSyncDynamicReleaseSnapshot({...snapshot,snapshot_data_json:{...snapshot.snapshot_data_json,liveMatch:{connectionId:'invalid'}}},{checksum_sha256:'c'.repeat(64),file_size_bytes:100,mime_type:'image/png',asset_kind:'image',duration_seconds:5})).toThrow('SYNC_DYNAMIC_MATCH_BINDING_INVALID');
});
