begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.source_doc()returns jsonb language sql immutable as $function$
 select $source_doc${"schemaVersion":1,"artboard":{"width":1920,"height":1080,"orientation":"landscape","background":{"kind":"solid","color":"#FAFAF7"},"safeArea":{"top":64,"right":64,"bottom":64,"left":64}},"motion":{"enabled":false,"durationMs":3000,"fps":30},"elements":[],"syncPresentation":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"club-story","orientation":"landscape","theme":"fieldflow","name":"Clubverhaal","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"metadata":{"fontRegistryVersion":"2026-09-09.1","tenantBrandApplied":false}}$source_doc$::jsonb;
$function$;
create temp table source_ids(label text primary key,id uuid);
grant all on source_ids to authenticated;
insert into auth.users(id,email)values
 ('00000000-0000-4000-8000-000000226081','source-library-a@veyocast.test'),
 ('00000000-0000-4000-8000-000000226082','source-library-b@veyocast.test'),
 ('00000000-0000-4000-8000-000000226083','source-library-viewer@veyocast.test');
insert into public.profiles(id,display_name)values
 ('00000000-0000-4000-8000-000000226081','Source A'),('00000000-0000-4000-8000-000000226082','Source B'),('00000000-0000-4000-8000-000000226083','Source viewer');
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226081','Source A','source-library-a'),('10000000-0000-4000-8000-000000226082','Source B','source-library-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226081'),('10000000-0000-4000-8000-000000226082');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226081','00000000-0000-4000-8000-000000226081','tenant_owner'),
 ('10000000-0000-4000-8000-000000226082','00000000-0000-4000-8000-000000226082','tenant_owner'),
 ('10000000-0000-4000-8000-000000226081','00000000-0000-4000-8000-000000226083','tenant_viewer');
select is(has_function_privilege('anon','public.list_publisher_sync_studio_v1(uuid,integer,text)','EXECUTE'),false,'anonymous callers cannot read the Source library');
select is(has_function_privilege('anon','public.prepare_publisher_sync_project_v1(uuid,bigint,uuid)','EXECUTE'),false,'anonymous callers cannot prepare a Source export');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226081',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226081","role":"authenticated","aal":"aal2"}',true);
insert into source_ids values('a',(public.create_studio_project_v1('10000000-0000-4000-8000-000000226081','Source A ontwerp','landscape',pg_temp.source_doc(),'{}','design','40000000-0000-4000-8000-000000226081')->>'projectId')::uuid);
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081')->>'total','1','a standalone Source project is visible without a fake series');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081')#>>'{projects,0,kind}','project','standalone identity is explicit');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081')#>>'{projects,0,members,0,projectId}',(select id::text from source_ids where label='a'),'the real project identity is retained');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081',0,'does not match')->>'total','0','search uses persisted project names');
select throws_ok($$select public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081',-1,null)$$,'22023',null,'invalid pagination is rejected');
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226081'),0::bigint,'opening and searching never enqueues a render');
select lives_ok($$select public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),0,'40000000-0000-4000-8000-000000226084')$$,'explicit selection prepares the real project');
insert into source_ids values('job',(public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),0,'40000000-0000-4000-8000-000000226084')->>'jobId')::uuid);
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226081'),1::bigint,'identical preparation creates one job');
select is(public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),0,'40000000-0000-4000-8000-000000226085')->>'jobId',(select id::text from source_ids where label='job'),'a new browser key after reload reuses the exact pending job');
select is((select output_kind from public.studio_render_jobs where id=(select id from source_ids where label='job')),'png','the actual stored no-motion document controls output kind');
select is(public.save_studio_draft_v1((select id from source_ids where label='a'),0,jsonb_set(pg_temp.source_doc(),'{syncPresentation,title}','"Latere inhoud"'),'{}','40000000-0000-4000-8000-000000226086')->>'outcome','saved','the mutable draft can change after preparation');
select is(public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),0,'40000000-0000-4000-8000-000000226084')->>'jobId',(select id::text from source_ids where label='job'),'the original receipt remains recoverable after that later edit');
select throws_ok($$select public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),0,'40000000-0000-4000-8000-000000226087')$$,'PT409',null,'an unrelated new stale intent is rejected');
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226081'),1::bigint,'stale intent rejection creates no extra job');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226082',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226082","role":"authenticated","aal":"aal2"}',true);
insert into source_ids values('b',(public.create_studio_project_v1('10000000-0000-4000-8000-000000226082','Source B ontwerp','landscape',pg_temp.source_doc(),'{}','design','40000000-0000-4000-8000-000000226082')->>'projectId')::uuid);
select throws_ok($$select public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081')$$,'42501',null,'tenant B cannot read the Source library of A');
select throws_ok($$select public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),1,'40000000-0000-4000-8000-000000226088')$$,'42501',null,'tenant B cannot prepare a project of A');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226082')->>'total','1','B sees only its own persisted project');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226083',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226083","role":"authenticated","aal":"aal1"}',true);
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226081')->>'total','1','a permitted viewer can read the design');
select throws_ok($$select public.prepare_publisher_sync_project_v1((select id from source_ids where label='a'),1,'40000000-0000-4000-8000-000000226089')$$,'42501',null,'a viewer cannot enqueue work through the read surface');
reset role;
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226081'),1::bigint,'unauthorized calls preserve the queue');
select *from finish();
rollback;
