import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium,expect as baseExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {runDynamicRenderOnce} from '../../apps/media-worker/src/dynamic-render-runner';
import {SupabaseDynamicRenderBackend} from '../../apps/media-worker/src/dynamic-render-backend';
import {ResvgSharpStudioRenderer} from '../../apps/media-worker/src/studio-render-resvg';

process.umask(0o077);
assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE,'1');assert.equal(process.cwd(),'/home/codex/repos/castivo-s226');
const tenant='19170000-0000-4000-8000-000000000010',container='supabase_db_veyocast-s226',base='http://127.0.0.1:3220',route=base+'/dashboard/slides/new/sync?family=pool-program';
const authFile='/tmp/veyocast-s226-qa-auth-state.json',configFile='/tmp/veyocast-s226-local-status.json',checkpoint='/tmp/veyocast-s226-sport-binding-state.json';
for(const file of[authFile,configFile])assert.equal(statSync(file).mode&0o777,0o600);
const cfg=JSON.parse(readFileSync(configFile,'utf8'));assert.equal(cfg.API_URL,'http://127.0.0.1:57621');assert.equal(new URL(cfg.DB_URL).port,'57622');
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container],{encoding:'utf8'}).trim(),'veyocast-s226');
function sql(query:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const source={sourceId:'',connectionId:''};
type State={name:string;command?:Record<string,unknown>;recovery?:string;receiptRecovered?:boolean;slideId?:string;snapshotId?:string;jobId?:string;sourceId?:string;connectionId?:string;fixturePrepared?:boolean};
if(existsSync(checkpoint))assert.equal(statSync(checkpoint).mode&0o777,0o600);
const state:State=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{name:'S226 Source-poule '+Date.now()};assert.match(state.name,/^S226 Source-poule \d+$/);
const save=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});save();
const frozenQuery=`select md5(coalesce(string_agg(row_to_json(r)::text,','order by id),''))from public.playlist_releases r where tenant_id='${tenant}'`;
const frozen=sql(frozenQuery),jobsBefore=Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`));
const expect=baseExpect.configure({timeout:30000}),browser=await chromium.launch(),context=await browser.newContext({storageState:authFile,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
await context.addCookies([{name:'veyocast-tenant-context',value:'duindorp-sites-local-qa',url:base,httpOnly:true,sameSite:'Lax'}]);
if(state.recovery&&!state.receiptRecovered)await context.addInitScript(({key,value})=>sessionStorage.setItem(key,value),{key:`veyocast.sync.dynamic.draft.v1:${tenant}:sport_program:pool-program:new`,value:state.recovery});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message.slice(0,200)));
const report:Record<string,unknown>={status:'RUNNING',startedAt:new Date().toISOString(),controlBuildId:readFileSync('apps/control/.next/BUILD_ID','utf8').trim(),scope:'actual AAL2 Source pool/team/period choices over owned persisted provider fixtures, current-user server options/canonical preview, lost create ACK and complete existing-worker output; fixture connection has automatic sync disabled and no external provider verification, credential or integration claim; no hardware or hosted deployment claim'};
let dropped=Boolean(state.command),writes:Array<Record<string,unknown>>=[];
try{
 await page.goto(base+'/dashboard/sources',{waitUntil:'domcontentloaded',timeout:120000});await context.storageState({path:authFile});
 const fixtureRequire=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient:fixtureServerClient}=fixtureRequire('@supabase/ssr'),fixtureCookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));
 const actor=fixtureServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...fixtureCookies.values()],setAll:()=>undefined}});
 assert.equal((await actor.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await actor.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 if(!state.connectionId){
  assert.equal(Number(sql(`select count(*)from public.sportlink_connections where tenant_id='${tenant}'`)),0,'Never overwrite another existing source connection');
  const reply=await actor.rpc('upsert_sportlink_connection_v1',{p_tenant_id:tenant,p_data_source_name:'S226 bronselectie fixture',p_detected_club_name:'Eigen QA-club',p_client_id_suffix:'S226QA',p_encrypted_client_id:'encrypted-fixture',p_encryption_iv:'initialization-vector',p_encryption_tag:'authentication-tag'});assert.equal(reply.error,null);
  const made=JSON.parse(sql(`select jsonb_build_object('connectionId',c.id,'sourceId',c.data_source_id)from public.sportlink_connections c join public.dynamic_data_sources d on d.tenant_id=c.tenant_id and d.id=c.data_source_id where c.tenant_id='${tenant}'and d.name='S226 bronselectie fixture'`));state.connectionId=made.connectionId;state.sourceId=made.sourceId;save();
 }
 for(const id of[state.connectionId,state.sourceId])assert.match(id!,/^[a-f0-9-]{36}$/);source.sourceId=state.sourceId!;source.connectionId=state.connectionId!;
 if(!state.fixturePrepared){
  sql(`begin;
   update public.sportlink_sync_policies set enabled=false,next_sync_at=now()+interval '100 years'where tenant_id='${tenant}'and connection_id='${source.connectionId}';
   update public.sportlink_connections set selected_team_codes=array['s226-team-a']where tenant_id='${tenant}'and id='${source.connectionId}';
   update public.dynamic_data_sources set provider_status='error',last_error_code='fixture_no_external_sync'where tenant_id='${tenant}'and id='${source.sourceId}';
   update public.sportlink_capabilities set available=true,enabled=true where tenant_id='${tenant}'and connection_id='${source.connectionId}'and article_key='poule-programma';
   insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)values
    ('${tenant}','${source.connectionId}','s226-team-a','Eigen QA-team A','{"competitionOptions":[{"externalId":"s226-competition","name":"QA-fixturecompetitie","poolName":"QA-poule A","season":"2026-2027","period":"2","poolExternalId":"s226-pool"}]}'),
    ('${tenant}','${source.connectionId}','s226-team-b','Niet geselecteerd QA-team B','{}')on conflict(tenant_id,source_connection_id,external_id)do nothing;
   insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
    select '${tenant}','${source.connectionId}','s226-fixture-'||i,now()+interval '1 day'+interval '10 minutes'*i,'scheduled',jsonb_build_object('externalId','s226-team-a','name','Eigen QA-team A'),jsonb_build_object('externalId','qa-opponent-'||i,'name',case when i<=5 then 'Eigen QA-tegenstander '||i else 'Andere poule hoort niet in beeld'end),'{"externalId":"s226-competition","period":"2","season":"2026-2027"}',jsonb_build_object('externalId',case when i<=5 then's226-pool'else'other-pool'end,'competitionExternalId','s226-competition'),true,true from generate_series(1,6)i on conflict(tenant_id,source_connection_id,external_id)do nothing;
   commit;`);state.fixturePrepared=true;save();
 }
 assert.equal(Number(sql(`select count(*)from public.sportlink_sync_policies where tenant_id='${tenant}'and connection_id='${source.connectionId}'and enabled`)),0);report.fixture={sourceId:source.sourceId,connectionId:source.connectionId,storedMatches:6,allowedTeam:'s226-team-a',selectedPool:'s226-pool',selectedPeriod:'2',automaticProviderSyncDisabled:true,externalProviderVerified:false};
 if(!state.receiptRecovered){
  await page.route(base+'/dashboard/slides/new/sync**',async current=>{
   const body=current.request().postData();if(current.request().method()!=='POST'||!body?.includes('"action":"create"'))return current.continue();
   const input=JSON.parse(body)[0]as Record<string,unknown>;assert.equal(input.action,'create');assert.equal(input.slideId,null);assert.equal(input.versionId,null);const request=input.request as {configuration:Record<string,unknown>;dataSourceId:string};assert.equal(request.dataSourceId,source.sourceId);assert.equal(request.configuration.blueprintKey,'sportlink.pool_schedule_next_7_days');assert.deepEqual(request.configuration.context,{providerTeamId:'s226-team-a',competitionSelectionMode:'pinned',competitionId:'s226-competition',phaseId:'2',poolId:'s226-pool',seasonId:'2026-2027'});assert.match(String(input.idempotencyKey),/^[a-f0-9-]{36}$/);writes.push(input);
   if(!dropped){state.command=input;state.recovery=await page.evaluate(key=>sessionStorage.getItem(key),`veyocast.sync.dynamic.draft.v1:${tenant}:sport_program:pool-program:new`)??undefined;save();
    const reply=await current.fetch();assert.equal(reply.status(),200);assert.equal(Number(sql(`select count(*)from public.publisher_command_receipts where tenant_id='${tenant}'and idempotency_key='${input.idempotencyKey}'and command_type='sync.dynamic.authoring'`)),1);dropped=true;return current.abort();}
   assert.deepEqual(input,state.command);return current.continue();
  });
  await page.goto(route,{waitUntil:'domcontentloaded',timeout:120000});
  const editor=page.locator('.sync-studio-frame:visible'),name=editor.getByLabel('Ontwerpnaam',{exact:true}),create=editor.getByRole('button',{name:'Maken en voorbereiden',exact:true});
  await expect(name).toHaveCount(1);
  if(!state.command){await expect(name).toBeEnabled();await expect(create).toBeDisabled();await name.fill(state.name);await editor.getByLabel('Gekoppelde bron',{exact:true}).selectOption(source.sourceId);await expect(editor.getByLabel('Team',{exact:true})).toBeEnabled();await expect(editor.getByRole('option',{name:'Niet geselecteerd QA-team B',exact:true})).toHaveCount(0);await editor.getByLabel('Team',{exact:true}).selectOption('s226-team-a');await editor.getByLabel('Competitie · Eigen QA-team A',{exact:true}).selectOption('0');await expect(editor.getByLabel('Bronregels',{exact:true})).toHaveValue('5');await expect(editor.locator('.vc-slide-preview').first()).toContainText('Eigen QA-team A');await expect(editor.locator('.vc-slide-preview').first()).not.toContainText('Andere poule');const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.editorAxeViolations=0;await expect(create).toBeEnabled();
   assert.equal(Number(sql(`select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'`)),jobsBefore);report.previewReadOnly=true;
   await page.screenshot({path:'execution/evidence/sync-sportlink-binding-ready.png'});await create.click();await expect(editor.locator('.notice[role="alert"]')).toContainText('antwoord is verloren');await page.reload({waitUntil:'domcontentloaded',timeout:120000});
  }
  await editor.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();await expect(page).toHaveURL(/\/dashboard\/slides\/[a-f0-9-]{36}$/);
  state.slideId=new URL(page.url()).pathname.split('/').at(-1);assert.match(state.slideId!,/^[a-f0-9-]{36}$/);state.receiptRecovered=true;save();
 }
 assert.match(state.slideId!,/^[a-f0-9-]{36}$/);report.slideId=state.slideId;report.exactCreateReceiptRecovered=true;report.transportWritesThisRun=writes.length;
 const own=JSON.parse(sql(`select jsonb_build_object('slideCount',(select count(*)from public.dynamic_slides where tenant_id='${tenant}'and name='${state.name}'),'snapshotId',s.id,'jobId',j.id,'jobStatus',j.status,'rows',jsonb_array_length(s.snapshot_data_json#>'{sport,items}'),'sourceId',s.data_source_id,'seedRows',jsonb_array_length(s.snapshot_data_json#>'{syncConfiguration,seed,rows}'))from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.tenant_id=s.tenant_id and j.snapshot_id=s.id where s.tenant_id='${tenant}'and s.dynamic_slide_id='${state.slideId}'`));assert.equal(own.slideCount,1);assert.equal(own.rows,5);assert.equal(own.seedRows,0);assert.equal(own.sourceId,source.sourceId);state.snapshotId=own.snapshotId;state.jobId=own.jobId;save();report.canonical=own;
 const pending=JSON.parse(sql("select coalesce(json_agg(id),'[]'::json)from public.dynamic_render_jobs where status in('queued','rendering')"));assert.ok(pending.every((id:string)=>id===state.jobId),'Never claim unrelated queue entries');
 process.env.CHROMIUM_EXECUTABLE_PATH=chromium.executablePath();
 if(own.jobStatus!=='completed'){const rendered=await runDynamicRenderOnce({backend:new SupabaseDynamicRenderBackend(cfg.API_URL,cfg.SERVICE_ROLE_KEY),renderer:new ResvgSharpStudioRenderer(),storageOrigin:cfg.API_URL,config:{workerId:'s226-source-create-proof',lockTimeoutSeconds:60,maxAttempts:3}});assert.equal(rendered.status,'completed');}
 const completed=JSON.parse(sql(`select jsonb_build_object('status',s.status,'assetId',s.output_media_asset_id,'durationMs',s.sync_render_result_json->'durationMs','rows',jsonb_array_length(s.sync_render_result_json#>'{presentation,rows}'),'bytes',v.file_size_bytes,'sha256',v.checksum_sha256,'path',v.storage_path)from public.dynamic_slide_snapshots s join public.media_variants v on v.tenant_id=s.tenant_id and v.asset_id=s.output_media_asset_id and v.variant_type='player_1080p'where s.tenant_id='${tenant}'and s.id='${state.snapshotId}'`));assert.equal(completed.status,'ready');assert.equal(completed.rows,5);assert.equal(completed.durationMs,10000);
 const require=createRequire(process.cwd()+'/apps/control/package.json'),{createServerClient}=require('@supabase/ssr'),cookies=new Map((await context.cookies()).map(cookie=>[cookie.name,cookie]));const client=createServerClient(cfg.API_URL,cfg.ANON_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:()=>undefined}});
 assert.equal((await client.auth.getUser()).data.user?.id,'19170000-0000-4000-8000-000000000001');assert.equal((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
 const download=await client.storage.from('tenant-media').download(completed.path);assert.equal(download.error,null);const bytes=Buffer.from(await download.data.arrayBuffer());assert.equal(bytes.length,Number(completed.bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),completed.sha256);delete completed.path;report.completeOutput=completed;
 await page.goto(base+'/dashboard/slides/'+state.slideId,{waitUntil:'domcontentloaded',timeout:120000});await expect(page.getByRole('heading',{name:state.name,exact:true})).toBeVisible();const video=page.locator('video[aria-label^="Volledige offline fallback"]:visible');await expect(video).toHaveCount(1);await expect(video).toBeVisible();await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>element.readyState)).toBeGreaterThanOrEqual(2);
 const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations,[]);report.detailAxeViolations=0;await page.screenshot({path:'execution/evidence/sync-sportlink-binding-complete.png'});
 assert.equal(sql(frozenQuery),frozen);report.existingReleasesUnchanged=true;assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message.replace(/([?&]token=)[^\s"<>]+/g,'$1[redacted]').slice(0,1600):'proof failed';await page.screenshot({path:'/tmp/veyocast-s226-sport-binding-failure.png',fullPage:true}).catch(()=>{});throw Error(String(report.error));}
finally{await browser.close();writeFileSync('execution/evidence/sync-sportlink-binding-real.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
