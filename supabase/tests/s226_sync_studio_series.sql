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
 ('00000000-0000-4000-8000-000000226101','source-series-a@veyocast.test'),
 ('00000000-0000-4000-8000-000000226102','source-series-b@veyocast.test'),
 ('00000000-0000-4000-8000-000000226103','source-series-viewer@veyocast.test');
insert into public.profiles(id,display_name)values
 ('00000000-0000-4000-8000-000000226101','Source A'),('00000000-0000-4000-8000-000000226102','Source B'),('00000000-0000-4000-8000-000000226103','Source viewer');
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226101','Source A','source-series-a'),('10000000-0000-4000-8000-000000226102','Source B','source-series-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226101'),('10000000-0000-4000-8000-000000226102');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226101','00000000-0000-4000-8000-000000226101','tenant_owner'),
 ('10000000-0000-4000-8000-000000226102','00000000-0000-4000-8000-000000226102','tenant_owner'),
 ('10000000-0000-4000-8000-000000226101','00000000-0000-4000-8000-000000226103','tenant_viewer');

create temp table source_results(label text primary key,value jsonb);grant all on source_results to authenticated;
select is(has_function_privilege('anon','public.mutate_sync_studio_series_v1(uuid,bigint,uuid,bigint,text,text,uuid[],uuid)','EXECUTE'),false,'anonymous users cannot mutate Source collections');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226101","role":"authenticated","aal":"aal2"}',true);
insert into source_ids values('a',(public.create_studio_project_v1('10000000-0000-4000-8000-000000226101','Eigen clubverhaal','landscape',pg_temp.source_doc(),'{}','design','40000000-0000-4000-8000-000000226101')->>'projectId')::uuid);
insert into source_results values('create',public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),0,null,null,'add','Wedstrijddag',null,'40000000-0000-4000-8000-000000226104'));
insert into source_ids values('series',((select value->>'seriesId' from source_results where label='create'))::uuid),('second',((select value->>'nextProjectId' from source_results where label='create'))::uuid);
select is((select value->>'outcome' from source_results where label='create'),'applied','adding a slide atomically creates a real Source collection');
select is((select count(*)from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226101'),2::bigint,'the existing project is adopted and exactly one new draft is created');
select is((select project_id from public.studio_series_items where series_id=(select id from source_ids where label='series') and sort_order=0),(select id from source_ids where label='a'),'the original project identity is retained');
select is((select document_json#>>'{syncPresentation,name}' from public.studio_project_drafts where project_id=(select id from source_ids where label='second')),'Eigen clubverhaal · slide 2','the new editable draft has its own name');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226101')->>'total','1','the library presents one collection without duplicate standalone members');
select is(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226101')#>>'{projects,0,kind}','series','Source collection identity is explicit');
select is(jsonb_array_length(public.list_publisher_sync_studio_v1('10000000-0000-4000-8000-000000226101')#>'{projects,0,members}'),2,'every Source member remains readable before export');
select is(public.list_publisher_studio_series_v2('10000000-0000-4000-8000-000000226101')->>'total','0','the legacy Sites reader never receives Source documents');
select is(public.save_studio_draft_v1((select id from source_ids where label='a'),0,jsonb_set(pg_temp.source_doc(),'{syncPresentation,title}','"Latere tekst"'),'{}','40000000-0000-4000-8000-000000226105')->>'outcome','saved','a Source member remains independently editable');
select is(public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),0,null,null,'add','Wedstrijddag',null,'40000000-0000-4000-8000-000000226104'),(select value from source_results where label='create'),'the complete original receipt replays after a later draft change');
select is((select count(*)from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226101'),2::bigint,'replaying an unknown add does not create another draft');
select throws_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),0,(select id from source_ids where label='series'),1,'duplicate',null,null,'40000000-0000-4000-8000-000000226106')$$,'PT409',null,'a new stale copy intent is rejected');
insert into source_results values('duplicate',public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),1,'duplicate',null,null,'40000000-0000-4000-8000-000000226107'));
insert into source_ids values('copy',((select value->>'nextProjectId' from source_results where label='duplicate'))::uuid);
select is((select project_id from public.studio_series_items where series_id=(select id from source_ids where label='series') and sort_order=1),(select id from source_ids where label='copy'),'a duplicate is inserted directly after its source');
select is((select document_json#>>'{syncPresentation,title}' from public.studio_project_drafts where project_id=(select id from source_ids where label='copy')),'Latere tekst','duplication copies the confirmed current draft');
select is((select value->>'revision' from source_results where label='duplicate'),'2','membership changes advance the series CAS');
select throws_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),1,'rename','Verouderde reeksnaam',null,'40000000-0000-4000-8000-000000226108')$$,'PT409',null,'a stale series command cannot overwrite a later membership change');
select lives_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),2,'reorder',null,array[(select id from source_ids where label='second'),(select id from source_ids where label='a'),(select id from source_ids where label='copy')],'40000000-0000-4000-8000-000000226109')$$,'reorder atomically retains every existing member');
select is((select project_id from public.studio_series_items where series_id=(select id from source_ids where label='series') and sort_order=0),(select id from source_ids where label='second'),'the selected order is persisted');
select throws_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),3,'reorder',null,array[(select id from source_ids where label='a'),(select id from source_ids where label='a'),(select id from source_ids where label='copy')],'40000000-0000-4000-8000-000000226110')$$,'23514',null,'a duplicated or missing reorder identity is refused');
select lives_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='copy'),0,(select id from source_ids where label='series'),3,'remove',null,null,'40000000-0000-4000-8000-000000226111')$$,'remove archives the selected source and updates membership together');
select is((select status from public.studio_projects where id=(select id from source_ids where label='copy')),'archived','removed drafts stay available for recovery');
select is((select count(*)from public.studio_series_items where series_id=(select id from source_ids where label='series')),2::bigint,'remaining members retain their identities');
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226101'),0::bigint,'collection editing never queues implicit renders');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226102',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226102","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),4,'rename','Andere tenant',null,'40000000-0000-4000-8000-000000226112')$$,'42501',null,'tenant B cannot change tenant A collections');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226103","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='a'),1,(select id from source_ids where label='series'),4,'rename','Viewerwijziging',null,'40000000-0000-4000-8000-000000226113')$$,'42501',null,'a viewer cannot mutate collections');
reset role;
select is((select count(*)from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226101'),3::bigint,'failed commands create no additional projects');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226101","role":"authenticated","aal":"aal2"}',true);
insert into source_results values('prepare',public.prepare_publisher_studio_series_v1((select id from source_ids where label='series'),4,jsonb_build_array(jsonb_build_object('id',(select id from source_ids where label='second'),'draftRevision',0),jsonb_build_object('id',(select id from source_ids where label='a'),'draftRevision',1)),'40000000-0000-4000-8000-000000226114'));
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226101'),2::bigint,'explicit collection preparation creates one immutable job per selected member');
select lives_ok($$select public.mutate_sync_studio_series_v1((select id from source_ids where label='second'),0,(select id from source_ids where label='series'),4,'remove',null,null,'40000000-0000-4000-8000-000000226115')$$,'the collection can change after the preparation was committed');
select is(public.prepare_publisher_studio_series_v1((select id from source_ids where label='series'),4,jsonb_build_array(jsonb_build_object('id',(select id from source_ids where label='second'),'draftRevision',0),jsonb_build_object('id',(select id from source_ids where label='a'),'draftRevision',1)),'40000000-0000-4000-8000-000000226114'),(select value from source_results where label='prepare'),'the exact committed preparation replays after both series revision and membership changed');
select throws_ok($$select public.prepare_publisher_studio_series_v1((select id from source_ids where label='series'),4,jsonb_build_array(jsonb_build_object('id',(select id from source_ids where label='second'),'draftRevision',0),jsonb_build_object('id',(select id from source_ids where label='a'),'draftRevision',1)),'40000000-0000-4000-8000-000000226116')$$,'PT409',null,'a new stale preparation intent is rejected');
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226101'),2::bigint,'receipt recovery and stale rejection never duplicate render jobs');
select *from finish();rollback;
