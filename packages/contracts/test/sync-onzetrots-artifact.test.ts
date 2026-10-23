import{it,expect}from'vitest';
import{syncSlidePresentationSchema,syncDynamicConfigurationSchema,readSyncDynamicArtifact,syncDynamicPlaybackSchema}from'../src/index';
const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v1',sourceRevision:'ae83f2b4312408eacae9f29177d3c743e104185b',family:'standings',orientation:'landscape',theme:'onzetrots-tv',name:'Echte ranglijst',title:'De ranglijst.',club:{name:'Eigen club'},style:{motion:'geen'},visual:{schemaVersion:1,mode:'light'}});
const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'sport_standing',secondsPerPage:12,seed});
const presentation=syncSlidePresentationSchema.parse({...seed,rich:{standings:{ownTeamId:'team-13',rows:Array.from({length:14},(_,index)=>({id:`row-${index}`,teamId:`team-${index}`,clubId:null,teamName:`Team ${index}`,position:index+1,played:null,won:null,drawn:null,lost:null,points:null,goalDifference:null,form:[]}))}}});
const artifact={presentation,width:1920,height:1080,mimeType:'video/mp4',byteLength:1000,durationMs:38000,storagePath:'tenants/own/assets/own/complete.mp4',checksumSha256:'a'.repeat(64),poster:{byteLength:100,storagePath:'tenants/own/assets/own/poster.png',checksumSha256:'b'.repeat(64)}};
it('requires the complete scroll video at every artifact/playback boundary even without an entrance',()=>{
 expect(readSyncDynamicArtifact(cfg,artifact)?.artifact.durationMs).toBe(38000);
 expect(readSyncDynamicArtifact(cfg,{...artifact,durationMs:12000})).toBeNull();
 expect(readSyncDynamicArtifact(cfg,{...artifact,mimeType:'image/png'})).toBeNull();
 const metadata={schemaVersion:1,configurationSnapshotId:'10000000-0000-4000-8000-000000000285',snapshotId:'20000000-0000-4000-8000-000000000285',templateVersionId:'30000000-0000-4000-8000-000000000285',configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),fallbackChecksumSha256:'c'.repeat(64),durationMs:38000,presentation,assets:{}};
 expect(syncDynamicPlaybackSchema.safeParse(metadata).success).toBe(true);
 expect(syncDynamicPlaybackSchema.safeParse({...metadata,durationMs:12000}).success).toBe(false);
});
it('does not accept an independently valid historical renderer as output for a new configuration',()=>{
 if(presentation.rendererVersion!=='sync-onzetrots-v1')throw Error('Invalid test presentation');
 const{rich,visual,...base}=presentation;void rich;void visual;
 const legacy=syncSlidePresentationSchema.parse({...base,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'});
 expect(readSyncDynamicArtifact(cfg,{...artifact,presentation:legacy,durationMs:12000,mimeType:'image/png'})).toBeNull();
});
