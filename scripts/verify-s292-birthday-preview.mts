import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSyncStudioStarter} from '../packages/studio/src/sync';
import {syncDynamicConfigurationSchema,playerDynamicTemplatePayloadSchema,syncSlidePageCount} from '../packages/contracts/src/index';
import {compileSyncSportlinkBinding} from '../apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding';
import {projectSyncDynamicSnapshot} from '../packages/content-templates/src/sync-dynamic-projector';
import {prepareSyncDynamicDescriptor}from'../apps/media-worker/src/sync-dynamic-render';
import {parseClaimedDynamicRenderJob}from'../apps/media-worker/src/dynamic-render-backend';
import {SyncSlideStaticView} from '../packages/content-templates/src/sync-slide-static-view';
const require=createRequire(new URL('../apps/control/package.json',import.meta.url));
const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server');

// Deliberately local-only: this creates fixture rows and rolls them all back.
const port=process.env.S292_LOCAL_DB_PORT??'63271';
assert.match(port,/^[0-9]{4,5}$/);
for(const orientation of ['landscape','portrait'] as const)for(const count of [0,8])for(const days of [7,14,21] as const){
 const starter=createSyncStudioStarter({family:'birthdays',tenantName:'Eigen testclub',theme:'onzetrots-tv'}).syncPresentation!;
 const seed={...starter,orientation,rows:[],news:[],ownRowIndexes:[],home:undefined,away:undefined,match:undefined,poll:undefined,rich:undefined,state:'ready' as const};
 const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'sport_birthdays',seed,secondsPerPage:15});
 const configuration=compileSyncSportlinkBinding(cfg,{}, {mode:'all',contexts:[],birthdayDays:days},[]);
 assert.equal(configuration.blueprintKey,'sportlink.birthdays');
 const sql=`begin;
 insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000000492','Birthday integration','s292-birthday');
 insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000000492');
 insert into auth.users(id,email)values('00000000-0000-4000-8000-000000000492','s292-birthday@test.invalid');
 insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000000492','Test owner');
 insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000000492','00000000-0000-4000-8000-000000000492','tenant_owner');
 set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000492',true);
 select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000492','Birthday source','Eigen testclub','1234','fixture-encrypted','fixture-iv','fixture-tag');
 select public.activate_sportlink_birthdays_v1((select id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000000492'),true);
 reset role;
 update public.sportlink_sync_policies set last_success_at=now()-interval '1 minute'where tenant_id='10000000-0000-4000-8000-000000000492'and dataset_group='public_people';
 insert into public.sportlink_birthdays(tenant_id,connection_id,external_id,display_name,normalized_name,birth_month,birth_day,next_occurrence,source_fetched_at)
 select connection.tenant_id,connection.id,lpad(to_hex(i),40,'0'),'Voornaam '||i||' Achternaam','testpersoon-'||i,
 extract(month from (now()at time zone'Europe/Amsterdam')::date+1),extract(day from (now()at time zone'Europe/Amsterdam')::date+1),(now()at time zone'Europe/Amsterdam')::date+1,now()-interval '1 minute'
 from public.sportlink_connections connection cross join generate_series(1,${count})i where tenant_id='10000000-0000-4000-8000-000000000492';
 set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
 select public.set_sync_dom_rollout_v2('10000000-0000-4000-8000-000000000492',true,repeat('a',40));reset role;
 create temporary table before_preview as select (select count(*)from public.dynamic_slides)slides,(select count(*)from public.dynamic_slide_snapshots)snapshots,(select count(*)from public.dynamic_render_jobs)jobs;
 set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
 select jsonb_build_object('response',public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000000492','Verjaardagen',
 (select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays'and orientation='${orientation}'and status='published'order by slug limit 1),
 (select data_source_id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000000492'),$s292$${JSON.stringify(configuration)}$s292$::jsonb));
 reset role;
 select jsonb_build_object('unchanged',(select slides=(select count(*)from public.dynamic_slides)and snapshots=(select count(*)from public.dynamic_slide_snapshots)and jobs=(select count(*)from public.dynamic_render_jobs)from before_preview));
 set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
 select jsonb_build_object('createReceipt',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000492','create',null,null,0,
 jsonb_build_object('templateVersionId',(select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays'and orientation='${orientation}'and status='published'order by slug limit 1),
 'dataSourceId',(select data_source_id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000000492'),
 'configuration',$s292$${JSON.stringify(configuration)}$s292$::jsonb),'90000000-0000-4000-8000-000000000492'));
 reset role;set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
 select jsonb_build_object('claim',(select value from public.claim_sync_dom_ready_job_v2('birthday-dom',30,3)value));
 rollback;`;
 const output=execFileSync('psql',['-XAtq','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'});
 const messages=output.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
 const response=messages.find(value=>value.response)?.response;
 const claimed=parseClaimedDynamicRenderJob(messages.find(value=>value.claim)?.claim);
 const descriptor=prepareSyncDynamicDescriptor({job:claimed,assets:{}});
 assert.equal(descriptor.dom.presentation.rows.length,count);assert.equal(descriptor.dom.schemaVersion,2);
 assert(response);assert(messages.find(value=>value.unchanged===true));
 assert.match(messages.find(value=>value.createReceipt)?.createReceipt?.slideId??'',/^[0-9a-f-]{36}$/);
 assert.equal(response.data.sport.timezone,'Europe/Amsterdam');
 assert(response.data.sport.fetchedAt,'Real builder must supply its observed source timestamp, including a confirmed empty feed');
 const payload=playerDynamicTemplatePayloadSchema.parse({schemaVersion:1,snapshotId:response.previewId,snapshotHash:createHash('sha256').update(JSON.stringify(response.data)).digest('hex'),templateVersionId:response.templateVersionId,templateSlug:response.templateSlug,orientation,slideType:'sport_birthdays',data:response.data,assets:{}});
 const result=projectSyncDynamicSnapshot(payload,cfg.seed);
 assert(result.ok,JSON.stringify(result));assert.equal(result.presentation.rows.length,count);
 assert.equal(syncSlidePageCount(result.presentation),Math.max(1,Math.ceil(count/6)));
 const html=renderToStaticMarkup(createElement(SyncSlideStaticView,{presentation:result.presentation,resolveAsset:()=>undefined,page:0}));
 assert(html.includes('vc-slide-preview'));
 console.log(JSON.stringify({orientation,count,days,pages:syncSlidePageCount(result.presentation),readOnly:true,createConfirmed:true,domProtocol:2,descriptorBytes:descriptor.byteLength,noCapture:true,renderer:result.presentation.rendererVersion}));
}
