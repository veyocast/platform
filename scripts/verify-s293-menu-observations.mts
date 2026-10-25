import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {menuDomFixture} from '../tests/helpers/menu-dom-fixture';
import {parseClaimedDynamicRenderJob,dynamicRenderStoragePath} from '../apps/media-worker/src/dynamic-render-backend';
import {prepareMenuDomDescriptor} from '../apps/media-worker/src/menu-dom-render';

// This commits one explicitly owned fixture in the isolated local test DB.
// Separate transactions are essential: now() is constant within one transaction
// and hid the publication-observation regression in the earlier rollback tests.
const port=process.env.S293_LOCAL_DB_PORT??'63271';
assert.match(port,/^[0-9]{4,5}$/);
function sql(text:string){return execFileSync('psql',['-XAtq','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024}).split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));}
const id=(n:number)=>`29320000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),owner=id(2),source=id(3),product=id(4),playlist=id(5),screen=id(6);
const human=`set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claim.role','authenticated',true);`;
const service=`set local role service_role;select set_config('request.jwt.claim.role','service_role',true);`;
const json=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const fixture=JSON.parse(JSON.stringify(menuDomFixture('twelve_excel','landscape')).replaceAll('29220000-','29320000-'));
const created=sql(`begin;
 insert into public.tenants(id,name,slug)values('${tenant}','S293 isolated committed fixture','s293-menu-observations');
 insert into public.tenant_settings(tenant_id,menu_document_v2_read_enabled,menu_studio_v2_authoring_enabled,menu_studio_v2_linked_groups_enabled,menu_studio_v2_media_enabled,menu_studio_v2_publish_enabled,menu_studio_v2_player_enabled)values('${tenant}',true,true,true,true,true,true);
 insert into auth.users(id,email)values('${owner}','s293-local@test.invalid');insert into public.profiles(id,display_name)values('${owner}','S293 local fixture');insert into public.tenant_memberships(tenant_id,user_id,role)values('${tenant}','${owner}','tenant_owner');
 insert into public.dynamic_data_sources(id,tenant_id,name,kind,provider_status,last_successful_sync_at)values('${source}','${tenant}','S293 imported catalog','twelve_excel','ready',now());
 insert into public.tenant_products(id,tenant_id,source,source_external_id,slug,name,category,source_category_id,price_cents,last_synced_at)values('${product}','${tenant}','twelve_excel','coffee','coffee','Clubkoffie','Warme dranken','${id(7)}',250,now());
 ${service}select public.set_sync_dom_rollout_v2('${tenant}',true,repeat('a',40));reset role;
 ${human}select jsonb_build_object('created',public.create_menu_studio_draft_v2('${tenant}','S293 Menu',(select current_published_version_id from public.dynamic_templates where slide_type='price_list'and orientation='landscape'and status='published'order by slug limit 1),'${source}','latest',${json(fixture.document)},'${id(9)}'));
 commit;`)[0].created;
const claimed=sql(`begin;${human}select public.publish_dynamic_slide_version_v1('${created.slideId}',(select active_draft_version_id from public.dynamic_slides where id='${created.slideId}'),${created.document.revision});reset role;${service}select jsonb_build_object('claim',(select value from public.claim_sync_dom_ready_job_v2('s293-local',60,3)value));commit;`);
const job=parseClaimedDynamicRenderJob(claimed.find(row=>row.claim)?.claim);
assert.equal(job.tenantId,tenant);
const descriptor=prepareMenuDomDescriptor(job,{});
const artifact={byteLength:descriptor.byteLength,checksumSha256:descriptor.checksumSha256,width:descriptor.width,height:descriptor.height,storagePath:dynamicRenderStoragePath(job,descriptor.menuDom.mimeType,descriptor.checksumSha256),...descriptor.menuDom};
sql(`begin;${service}select public.complete_menu_dom_job_v2('${job.jobId}','s293-local','${job.leaseToken}',${json(artifact)});reset role;
 insert into public.playlists(id,tenant_id,name)values('${playlist}','${tenant}','S293 own local playlist');insert into public.screens(id,tenant_id,name,orientation,status)values('${screen}','${tenant}','S293 own local screen','landscape','active');
 ${human}select public.mutate_playlist_batch_v1('${playlist}',0,jsonb_build_array(jsonb_build_object('operation','add_dynamic','clientId','${id(10)}','dynamicSlideId','${created.slideId}','snapshotId','${job.snapshotId}','expectedSnapshotId','${job.snapshotId}','durationSeconds',12,'sitesConfiguration',${json(fixture.design)})),'${id(11)}');
 select public.publish_playlist_to_targets_v3('${playlist}',(select revision from public.playlists where id='${playlist}'),array['${screen}'::uuid],'S293 isolated fixture','${id(12)}');commit;`);
function state(){return sql(`select jsonb_build_object('revision',data_revision,'hash',content_hash,'publishedAt',data_json#>>'{menuDocument,publication,publishedAt}','jobs',(select count(*)from public.dynamic_render_jobs where tenant_id='${tenant}'),'snapshots',(select count(*)from public.dynamic_slide_snapshots where tenant_id='${tenant}'),'releases',(select count(*)from public.playlist_releases where tenant_id='${tenant}'),'binary',(select count(*)from private.sync_published_binary_state where tenant_id='${tenant}'))from public.published_dynamic_data where snapshot_id='${job.snapshotId}';`)[0];}
const baseline=state(),observations=[];
assert.equal(baseline.revision,1);assert.equal(baseline.binary,0);
for(let pass=0;pass<3;pass++){
 const lease=sql(`begin;
  update public.dynamic_data_sources set last_successful_sync_at=clock_timestamp(),revision=revision+1 where id='${source}';
  select private.enqueue_published_binding_v1('${tenant}','${job.snapshotId}');
  ${service}select jsonb_build_object('lease',public.claim_published_data_refresh_v1('s293-observation',60));commit;`)[0].lease;
 assert.equal(lease.snapshotId,job.snapshotId);
 const receipt=sql(`begin;${service}select public.complete_published_data_refresh_v1('${tenant}','${job.snapshotId}','${lease.leaseToken}');commit;`)[0];
 assert.equal(receipt.status,'completed');
 const current=state();observations.push(current);
 // Observation metadata remains fresh; only semantic identity and its work
 // counters must stay unchanged. Protocol 2 deliberately stores fresh reads.
 const {publishedAt:currentObservedAt,...currentIdentity}=current;
 const {publishedAt:baselineObservedAt,...baselineIdentity}=baseline;
 assert.notEqual(currentObservedAt,baselineObservedAt,'the fixture must really cross an observation timestamp');
 assert.deepEqual(currentIdentity,baselineIdentity,'an unchanged cross-transaction import observation must not advance Menu identity or jobs');
}
const identities=sql(`select jsonb_build_object('original',private.dynamic_snapshot_content_hash_v1(slide,frozen.snapshot_data_json),'observed',private.dynamic_snapshot_content_hash_v1(slide,jsonb_set(frozen.snapshot_data_json,'{menuDocument,publication,publishedAt}',to_jsonb(clock_timestamp()))))from public.dynamic_slides slide join public.dynamic_slide_snapshots frozen on frozen.dynamic_slide_id=slide.id where frozen.id='${job.snapshotId}';`)[0];
assert(identities.original);assert.equal(identities.original,identities.observed);
const proof={localOnly:true,separateTransactions:true,provider:'twelve_excel',importedProductSourceId:null,storageUpload:false,baseline,observations,snapshotIdentityStable:true};
if(process.env.S293_PROOF_PATH)writeFileSync(process.env.S293_PROOF_PATH,JSON.stringify(proof,null,2),{mode:0o600});
console.log(JSON.stringify(proof,null,2));
