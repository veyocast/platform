begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000226121','Source worker A','source-worker-a');
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;

create temporary table source_worker_ids(name text primary key,id uuid not null);
grant select on source_worker_ids to service_role;
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('20000000-0000-4000-8000-000000226121','10000000-0000-4000-8000-000000226121','Actual canonical source','manual_products');
insert into source_worker_ids select 'template',version.id from public.dynamic_template_versions version join public.dynamic_templates template on template.id=version.template_id where template.slug='editorial-arena-programma-dark-landscape' and version.status='published';
create function pg_temp.queue_fixture(p_name text,p_source boolean,p_hash text,p_created timestamptz)returns uuid language plpgsql as $fn$
declare slide_id uuid:=gen_random_uuid();snapshot_id uuid:=gen_random_uuid();begin
 insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
 select slide_id,'10000000-0000-4000-8000-000000226121',p_name,'sport_program','landscape',version.template_id,version.id,'20000000-0000-4000-8000-000000226121',case when p_source then jsonb_build_object('syncConfiguration',pg_temp.source_config())else '{}'::jsonb end from public.dynamic_template_versions version where version.id=(select id from source_worker_ids where name='template');
 insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json)
 values(snapshot_id,'10000000-0000-4000-8000-000000226121',slide_id,(select id from source_worker_ids where name='template'),'20000000-0000-4000-8000-000000226121',p_hash,jsonb_build_object('type','sport_program','sport',jsonb_build_object('items','[]'::jsonb))||case when p_source then jsonb_build_object('syncConfiguration',pg_temp.source_config())else '{}'::jsonb end);
 insert into public.dynamic_render_jobs(tenant_id,snapshot_id,created_at)values('10000000-0000-4000-8000-000000226121',snapshot_id,p_created);return snapshot_id;end;$fn$;
insert into source_worker_ids values('source',pg_temp.queue_fixture('Mutable mirror name',true,repeat('a',64),now()-interval '2 hours')),('legacy',pg_temp.queue_fixture('Old design',false,repeat('b',64),now()-interval '1 hour'));
set local role service_role;
create temporary table legacy_claim as select *from public.claim_dynamic_render_job_v1('legacy-worker',30,3);
select is((select snapshot_id from legacy_claim),(select id from source_worker_ids where name='legacy'),'the old worker skips the older Source job in the same FIFO queue');
create temporary table source_claim as select *from public.claim_dynamic_render_job_v2('same-worker',30,3);
select is((select snapshot_id from source_claim),(select id from source_worker_ids where name='source'),'the modern worker claims that oldest Source job');
select is((select template_version_id from source_claim),(select id from source_worker_ids where name='template'),'the claim carries the actual immutable template version');
select is((select template_slug from source_claim),'editorial-arena-programma-dark-landscape','the claim carries the actual registered template slug');
select is((select source_revision_hash from source_claim),repeat('a',64),'the claim carries the actual canonical snapshot hash');
select is((select slide_name from source_claim),'Gekoppeld bronontwerp','Source rendering uses the frozen design name rather than the mutable mirror');
select ok((select lease_token is not null and dynamic_slide_version_id is not null from source_claim),'the claim includes a real version and fresh fenced lease');
select is(public.renew_dynamic_render_lease_v2((select job_id from source_claim),'same-worker',(select lease_token from source_claim)),true,'the current lease can renew');
select is(public.renew_dynamic_render_lease_v2((select job_id from source_claim),'same-worker',gen_random_uuid()),false,'a different lease token cannot renew');
select throws_ok($$select public.fail_dynamic_render_job_v2((select job_id from source_claim),'same-worker',gen_random_uuid(),'controlled_failure','Controlled test',true)$$,'55000','dynamic render lease lost','a stale token cannot fail the claimed render');
select throws_ok($$select public.complete_dynamic_render_job_v1((select job_id from source_claim),'same-worker','anything',100,repeat('a',64),1920,1080)$$,'23514','Source render requires complete validated artifact','the old completion cannot acknowledge a first-page-only PNG');
reset role;
update public.dynamic_render_jobs set locked_at=clock_timestamp()-interval '31 seconds' where id=(select job_id from source_claim);
set local role service_role;
create temporary table reclaimed_source as select *from public.claim_dynamic_render_job_v2('same-worker',30,3);
select is((select job_id from reclaimed_source),(select job_id from source_claim),'an expired retryable Source job returns through the same reaper');
select isnt((select lease_token from reclaimed_source),(select lease_token from source_claim),'even the same worker identity receives a new fencing token');
select is(public.renew_dynamic_render_lease_v2((select job_id from source_claim),'same-worker',(select lease_token from source_claim)),false,'the original attempt cannot renew the reclaimed job');
select throws_ok($$select public.fail_dynamic_render_job_v2((select job_id from source_claim),'same-worker',(select lease_token from source_claim),'controlled_failure','Controlled test',false)$$,'55000','dynamic render lease lost','the original attempt cannot terminalize the new one');
reset role;
update public.dynamic_render_jobs set attempt_count=3,locked_at=clock_timestamp()-interval '31 seconds' where id=(select job_id from source_claim);
set local role service_role;
select is((select count(*)from public.claim_dynamic_render_job_v2('reaper',30,3)),0::bigint,'the final expired attempt is not claimed again');
select is((select status from public.dynamic_render_jobs where id=(select job_id from source_claim)),'failed','the final expired Source attempt is terminalized');
select is((select status from public.dynamic_slide_snapshots where id=(select id from source_worker_ids where name='source')),'failed','the incomplete canonical snapshot never becomes ready');
reset role;
select is(has_function_privilege('authenticated','public.claim_dynamic_render_job_v2(text,integer,integer)','EXECUTE'),false,'Control cannot claim render work');
select is(has_function_privilege('anon','public.renew_dynamic_render_lease_v2(uuid,text,uuid)','EXECUTE'),false,'anonymous callers cannot renew a worker lease');
select is(has_function_privilege('authenticated','public.fail_dynamic_render_job_v2(uuid,text,uuid,text,text,boolean)','EXECUTE'),false,'Control cannot fail a worker render');
select *from finish();rollback;
