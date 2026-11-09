import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import {createSyncStudioStarter} from '../packages/studio/src/sync';
import {syncDynamicConfigurationSchema,syncOnzeTrotsV9SlidePresentationSchema} from '../packages/contracts/src/index';
import {mapSportlinkMatches,mapSportlinkStandings} from '../packages/integrations/src/sportlink-mappers';
import {parseClaimedDynamicRenderJob,dynamicRenderStoragePath} from '../apps/media-worker/src/dynamic-render-backend';
import {prepareSyncDynamicDescriptor} from '../apps/media-worker/src/sync-dynamic-render';
import {readSyncDynamicReleaseSnapshot,projectSyncDynamicReleaseData,type SyncDynamicSnapshotRow} from '../apps/player/app/_lib/player-sync-dynamic-payload';

// Deliberately local-only. This probe publishes through the actual guarded
// authoring/worker/playlist commands inside a transaction and rolls it back.
const port=process.env.S295_LOCAL_DB_PORT??'64432';
assert.match(port,/^\d{4,5}$/);
const child=spawn('psql',['-XAtq','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{env:{...process.env,PGPASSWORD:'postgres'},stdio:['pipe','pipe','pipe']});
type Row=Record<string,unknown>;
let serial=0,lines:string[]=[],errors='',pending:{marker:string;resolve:(rows:Row[])=>void;reject:(error:Error)=>void}|null=null;
createInterface({input:child.stdout}).on('line',line=>{
 if(pending&&line===pending.marker){const rows=lines.filter(value=>value.startsWith('{')).map(value=>JSON.parse(value) as Row);lines=[];const done=pending;pending=null;done.resolve(rows);}else lines.push(line);
});
child.stderr.on('data',data=>{errors+=data;});
child.on('exit',code=>{if(pending){pending.reject(Error(`Local test database exited ${code}: ${errors}`));pending=null;}});
function query(sql:string):Promise<Row[]>{assert(!pending);return new Promise((resolve,reject)=>{const marker=`S295_DONE_${++serial}`;pending={marker,resolve,reject};child.stdin.write(`${sql}\n\\echo ${marker}\n`);});}
const json=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const uid=(n:number)=>`29500000-0000-4000-9000-${String(n).padStart(12,'0')}`;
const tenant=uid(1),owner=uid(2),playlist=uid(3),screen=uid(4);
const human=`set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claim.role','authenticated',true);`;
const service=`set local role service_role;select set_config('request.jwt.claim.role','service_role',true);`;
const competition={externalId:'league',name:'Fixture competitie',type:'regulier',period:'phase',season:null};
const pool={externalId:'701',name:'A',competitionExternalId:'league'};
const fixtureNow=Date.now();
const fromNow=(days:number)=>new Date(fixtureNow+days*86400000).toISOString();
const fixtureTeamIds:Record<string,string>={'Eigen team':'295100','Poule A':'295101','Volgende tegenstander':'295102','Eigen tegenstander':'295103','Poule B':'295104','Poule C':'295105','Poule D':'295106','Andere poule':'295201','Verkeerde tegenstander':'295202'};
function result(code:string,home:string,away:string,score:string,days=-1){
 const mapped=mapSportlinkMatches([{wedstrijdcode:code,wedstrijddatum:fromNow(days),thuisteam:home,uitteam:away,thuisteamid:fixtureTeamIds[home],uitteamid:fixtureTeamIds[away],uitslag:score}],'results');
 assert.equal(mapped.length,1);return {...mapped[0]!,competition,pool};
}
const own=result('295001','Eigen team','Eigen tegenstander','3-1');
const other=result('295002','Poule A','Poule B','0-0');
const olderPool=result('295005','Poule C','Poule D','1-1',-7);
const next={...result('295003','Eigen team','Volgende tegenstander','',3),status:'scheduled',homeTeam:{externalId:'295100',name:'Eigen team',score:null},awayTeam:{externalId:'295102',name:'Volgende tegenstander',score:null}};
const fixtureResults=[own,other,olderPool,result('295004','Andere poule','Verkeerde tegenstander','4-2'),{...result('295006','Poule A','Poule B','5-4'),competition:{...competition,period:'foreign-phase'}}].map(value=>value.externalId==='295004'?{...value,pool:{...pool,externalId:'702'}}:value);
const standings=(points:number)=>({...mapSportlinkStandings([
 {teamcode:'295100',teamnaam:'Eigen team',positie:points===3?2:1,gespeeld:2,gewonnen:1,gelijk:0,verloren:1,doelpuntenvoor:points===3?4:7,doelpuntentegen:2,punten:points},
 {teamcode:'295101',teamnaam:'Poule A',positie:points===3?1:2,gespeeld:2,gewonnen:1,gelijk:0,verloren:1,doelpuntenvoor:3,doelpuntentegen:2,punten:4},
 ...[...['Poule B','Poule C','Poule D','Eigen tegenstander','Volgende tegenstander'].map(name=>({teamcode:fixtureTeamIds[name]!,teamnaam:name})),...Array.from({length:7},(_,index)=>({teamcode:String(295110+index),teamnaam:`Pouleclub ${index+8}`}))].map((team,index)=>({...team,positie:index+3,gespeeld:2,gewonnen:0,gelijk:1,verloren:1,doelpuntenvoor:1,doelpuntentegen:index+2,punten:1}))
 ],'701','A',null,competition),poolExternalId:'701',pool});
const day=(offset:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(fixtureNow+offset*86400000));
const observation={schemaVersion:1,kind:'full',checkedAt:new Date(fixtureNow).toISOString(),scopes:[{
 scope:'pool',poolExternalId:'701',competitionExternalId:'league',phase:'phase',fromDate:day(-14),throughDate:day(0),complete:true,
 resultsComplete:true,programComplete:true,programFromDate:day(0),programThroughDate:day(14),resultExternalIds:['295001','295002','295005'],programExternalIds:['295003']
}]};
const evidence:unknown[]=[];
const variants:unknown[]=[];
try{
 for(const orientation of ['landscape','portrait'] as const){
  await query(`begin;set local statement_timeout='30s';
   insert into public.tenants(id,name,slug)values('${tenant}','S295 isolated publication','s295-publication');
   insert into public.tenant_settings(tenant_id)values('${tenant}');
   insert into auth.users(id,email)values('${owner}','s295-publication@test.invalid');
   insert into public.profiles(id,display_name)values('${owner}','Fixture owner');
   insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${owner}','tenant_owner');
   ${human}select public.upsert_sportlink_connection_v1('${tenant}','Fixture Sportlink','Fixture club','295000','encrypted-fixture','iv-fixture','tag-fixture');reset role;
   insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name)select tenant_id,id,'own-club','Fixture club'from public.sportlink_connections where tenant_id='${tenant}';
   insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)select tenant_id,id,'295100','Eigen team',${json({competitionOptions:[{...competition,poolExternalId:'701',poolName:'A'}]})} from public.sportlink_connections where tenant_id='${tenant}';
   ${service}select public.set_sync_dom_rollout_v2('${tenant}',true,repeat('a',40));reset role;
  `);
  const source=(await query(`select jsonb_build_object('connection',id,'source',data_source_id)from public.sportlink_connections where tenant_id='${tenant}';`))[0]!;
  const complete=async(kind:'matches'|'competitions',matches:unknown[]=[],standingRows:unknown[]=[])=>{
   const run=(await query(`insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)values('${tenant}','${source.connection}','${kind}','running','s295-proof',now())returning jsonb_build_object('run',id);`))[0]!.run;
   const started=performance.now();
   const observed=kind==='matches'?{...observation,scopes:observation.scopes.map(scope=>({...scope,resultExternalIds:(matches as Array<{externalId:string;status:string;pool?:{externalId:string};competition?:{period:string}}>).filter(match=>match.status==='finished'&&match.pool?.externalId===scope.poolExternalId&&match.competition?.period===scope.phase).map(match=>match.externalId)}))}:{};
   await query(`${service}select public.complete_sportlink_sync_v5('${run}','s295-proof','{}','{}','[]','[]',${json(matches)},'[]',${json(standingRows)},${json(observed)});reset role;`);
   return {runId:run,completionMs:performance.now()-started};
  };
  const initialRun=await complete('matches',[...fixtureResults.filter(item=>item.externalId!=='295002'),next]);await complete('competitions',[],[standings(3)]);
  const starter=createSyncStudioStarter({family:'matchday',tenantName:'Fixture club',theme:'onzetrots-tv'}).syncPresentation!;
  const seed={...starter,style:{...starter.style,accent:starter.style.accent.toLowerCase()},orientation,rows:[],news:[],ownRowIndexes:[],rich:undefined,state:'ready' as const};
  const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',slideType:'sport_match_of_the_day',secondsPerPage:5,rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,seed});
  const context={providerTeamId:'295100',competitionSelectionMode:'auto_current',competitionId:null,poolId:null,phaseId:null,seasonId:null};
  const configuration={schemaVersion:1,maxItems:200,context,teamSelection:{mode:'selected',teamContexts:[context],matchLocation:'both'},syncConfiguration:cfg};
  const validation=(await query(`select jsonb_build_object('errors',extensions.jsonschema_validation_errors(private.sync_dynamic_configuration_schema_v1()::json,${json(cfg)}::json));`))[0]!.errors;
  assert.deepEqual(validation,[]);
  const created=(await query(`${human}select jsonb_build_object('receipt',public.mutate_sync_dynamic_authoring_v1('${tenant}','create',null,null,0,jsonb_build_object('templateVersionId',(select current_published_version_id from public.dynamic_templates where slide_type='sport_match_of_the_day'and orientation='${orientation}'and status='published'order by slug limit 1),'dataSourceId','${source.source}','configuration',${json(configuration)}),'${uid(5)}'));reset role;${service}select jsonb_build_object('claim',(select value from public.claim_sync_dom_ready_job_v2('s295-dom',60,3)value));reset role;`));
  const receipt=created.find(row=>row.receipt)!.receipt as {slideId:string};
  const job=parseClaimedDynamicRenderJob(created.find(row=>row.claim)!.claim);
  assert(job.templateSlug);const templateSlug=job.templateSlug;
  const prepared=prepareSyncDynamicDescriptor({job,assets:{}});
  const artifact={...prepared.dom,byteLength:prepared.byteLength,checksumSha256:prepared.checksumSha256,width:prepared.width,height:prepared.height,storagePath:dynamicRenderStoragePath(job,prepared.dom.mimeType,prepared.checksumSha256)};
  await query(`${service}select public.complete_dynamic_dom_job_v2('${job.jobId}','s295-dom','${job.leaseToken}',${json(artifact)});reset role;
   insert into public.playlists(id,tenant_id,name)values('${playlist}','${tenant}','S295 published fixture');
   insert into public.screens(id,tenant_id,name,orientation,status)values('${screen}','${tenant}','S295 isolated target','${orientation}','active');
   insert into public.player_devices(id,tenant_id,screen_id,token_hash,status)values('${uid(9)}','${tenant}','${screen}',repeat('d',64),'paired');
   ${human}select public.mutate_playlist_batch_v1('${playlist}',0,jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','${uid(6)}','dynamicSlideId','${receipt.slideId}','expectedSnapshotId','${job.snapshotId}','snapshotId','${job.snapshotId}','durationSeconds',${artifact.durationMs/1000})),'${uid(7)}');
   select public.publish_playlist_to_targets_v3('${playlist}',(select revision from public.playlists where id='${playlist}'),array['${screen}'::uuid],'S295 isolated proof','${uid(8)}');reset role;`);
  const publish=(await query(`select jsonb_build_object('releaseId',id,'manifestHash',manifest_hash,'releaseCount',(select count(*)from public.playlist_releases where tenant_id='${tenant}'),'live',(select bool_and(live_data_enabled)from public.playlist_release_items where release_id=release.id))from public.playlist_releases release where playlist_id='${playlist}';`))[0]!;
  assert.equal(publish.live,true);assert.equal(publish.releaseCount,1);
  const publishedRows=(await query(`select jsonb_build_object('snapshot',to_jsonb(snapshot),'item',(select to_jsonb(item)from public.playlist_release_items item where item.release_id='${publish.releaseId}'and item.dynamic_snapshot_id=snapshot.id))from public.dynamic_slide_snapshots snapshot where id='${job.snapshotId}';`))[0]!;
  const snapshot=publishedRows.snapshot as SyncDynamicSnapshotRow;
  const releaseItem=publishedRows.item as {checksum_sha256:string;file_size_bytes:number;mime_type:string;asset_kind:string;duration_seconds:number;storage_path:string};
  const releaseBase=readSyncDynamicReleaseSnapshot(snapshot,releaseItem,true);
  const read=async(label:string)=>{
   await query(`${service}select jsonb_build_object('lease',(select value from public.claim_published_data_refresh_v1('s295-data',60)value));reset role;`);
   const lease=(await query(`select jsonb_build_object('token',lease_token)from private.published_data_refresh_queue where tenant_id='${tenant}'and snapshot_id='${job.snapshotId}'and phase='data';`))[0]?.token;
   if(lease)await query(`${service}select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${lease}');reset role;`);
   const live=(await query(`select jsonb_build_object('data',data_json,'contentHash',content_hash,'dataRevision',data_revision,'checkedAt',checked_at,'changedAt',changed_at,'releaseCount',(select count(*)from public.playlist_releases where tenant_id='${tenant}'),'manifestHash',(select manifest_hash from public.playlist_releases where id='${publish.releaseId}'),'dataKey',public.get_player_effective_target_v1(repeat('d',64))->>'data_key')from public.published_dynamic_data where tenant_id='${tenant}'and snapshot_id='${job.snapshotId}';`))[0]!;
   assert.equal(live.releaseCount,1);
   assert.equal(live.manifestHash,publish.manifestHash);
   assert.equal(typeof live.dataKey,'string');assert(String(live.dataKey).includes(`${job.snapshotId}:${live.dataRevision}`));
   const projected=projectSyncDynamicReleaseData({snapshot,base:releaseBase,live:{data_json:live.data,content_hash:live.contentHash,data_revision:live.dataRevision},template:{slug:templateSlug,slide_type:'sport_match_of_the_day',orientation},assets:{}});
   evidence.push({label,orientation,releaseId:publish.releaseId,snapshotId:job.snapshotId,dataRevision:live.dataRevision,contentHash:live.contentHash,dataKey:live.dataKey,immutableManifestHash:live.manifestHash,checkedAt:live.checkedAt,changedAt:live.changedAt,immutableReleaseCount:live.releaseCount});
   return {label,dataRevision:Number(live.dataRevision),contentHash:String(live.contentHash),dataKey:String(live.dataKey),presentation:syncOnzeTrotsV9SlidePresentationSchema.parse(projected.presentation)};
  };
  const initial=await read('published');
  assert.equal(initial.presentation.rich?.matchday?.results[0]?.id,'295001');
  assert.equal(initial.presentation.rich?.matchday?.standings.rows.length,14);
  assert(!initial.presentation.rich?.matchday?.results.some(item=>item.id==='295002'));
  assert(!initial.presentation.rich?.matchday?.results.some(item=>item.id==='295004'));
  assert(!initial.presentation.rich?.matchday?.results.some(item=>item.id==='295006'));
  const standingRun=await complete('competitions',[],[standings(9)]);
  const standing=await read('standings-only');assert(standing.dataRevision>initial.dataRevision);
  const ownStanding=standing.presentation.rich?.matchday?.standings.rows.find(row=>row.teamId==='295100');
  assert.equal(ownStanding?.position,1);assert.equal(ownStanding?.points,9);assert.equal(ownStanding?.goalDifference,5);
  const addedRun=await complete('matches',[own,other,olderPool,next]);
  const added=await read('new-pool-result');assert(added.dataRevision>standing.dataRevision);
  assert(added.presentation.rich?.matchday?.results.some(item=>item.id==='295002'&&item.homeScore===0&&item.awayScore===0));
  const poolRun=await complete('matches',[own,result('295002','Poule A','Poule B','2-0'),olderPool,next]);
  const corrected=await read('pool-results-only');assert(corrected.dataRevision>added.dataRevision);
  const correctedResult=corrected.presentation.rich?.matchday?.results.find(item=>item.id==='295002');
  assert.equal(correctedResult?.homeScore,2);assert.equal(correctedResult?.awayScore,0);
  assert.equal(corrected.presentation.rich?.matchday?.results.find(item=>item.id==='295001')?.homeScore,3);
  await complete('matches',[own,result('295002','Poule A','Poule B','2-0'),olderPool,next]);
  const unchanged=await read('identical-observation');assert.equal(unchanged.dataRevision,corrected.dataRevision);assert.equal(unchanged.contentHash,corrected.contentHash);assert.equal(unchanged.dataKey,corrected.dataKey);
  // Move only the projection clock across its local date boundary. Provider
  // rows, source revision and immutable publication remain unchanged.
  await query(`do $clock$ declare definition text;begin
   definition:=pg_get_functiondef('private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)'::regprocedure);
   execute replace(definition,'now()',$replacement$(current_setting('test.s295_clock')::timestamptz) $replacement$);
   end;$clock$;
   select set_config('test.s295_clock',((((now()at time zone'Europe/Amsterdam')::date+1)+time '00:00:01')at time zone'Europe/Amsterdam')::text,true);
   select private.refresh_published_data_v1('${tenant}','${source.source}');`);
  const expired=await read('local-midnight-unchanged-provider');
  assert(expired.dataRevision>corrected.dataRevision);
  assert(!expired.presentation.rich?.matchday?.results.some(item=>item.id==='295005'));
  assert(expired.presentation.rich?.matchday?.results.some(item=>item.id==='295002'&&item.homeScore===2));
  const emptyRun=await complete('matches',[next]);
  const empty=await read('confirmed-empty-results');
  assert(empty.dataRevision>expired.dataRevision);
  assert.equal(empty.presentation.rich?.matchday?.results.length,0);
  assert.equal(empty.presentation.rich?.matchday?.standings.rows.length,14);
  assert.equal(empty.presentation.rich?.matchday?.fixtures.length,1);
  variants.push({orientation,releaseId:publish.releaseId,snapshotId:job.snapshotId,templateVersionId:job.templateVersionId,configurationHash:releaseBase.metadata.configurationHash,descriptor:new TextDecoder().decode(prepared.bytes),descriptorChecksum:prepared.checksumSha256,durationMs:artifact.durationMs,initial,standing,added,corrected,expired,empty});
  evidence.push({orientation,initialRun,standingRun,addedRun,poolRun,emptyRun,localClock:'instrumented Europe/Amsterdam midnight; unchanged provider rows before expiry',rolledBack:true,providerResponse:'representative-fixture',publishedViaGuardedCommands:true,storageUpload:false});
  await query('rollback;');
 }
 await mkdir('tests/fixtures',{recursive:true});
 await writeFile('tests/fixtures/s295-published-sportlink.json',JSON.stringify({schemaVersion:1,generatedFromIsolatedDatabase:true,variants},null,2)+'\n');
 await mkdir('docs/implementation/s295-sportlink-playback-refresh',{recursive:true});
 await writeFile('docs/implementation/s295-sportlink-playback-refresh/local-publication-chain.json',JSON.stringify(evidence,null,2)+'\n');
 console.info(JSON.stringify({status:'passed',orientations:2,stages:evidence.length,rolledBack:true}));
}catch(error){console.error(error);process.exitCode=1;}finally{child.stdin.end();}
