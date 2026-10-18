begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226151','Source author A','source-author-a'),
 ('10000000-0000-4000-8000-000000226152','Source author B','source-author-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226151'),('10000000-0000-4000-8000-000000226152');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values
 ('00000000-0000-4000-8000-000000226151','authenticated','authenticated','source-owner@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226152','authenticated','authenticated','source-other@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000226153','authenticated','authenticated','source-viewer@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000226151','Owner A'),('00000000-0000-4000-8000-000000226152','Owner B'),('00000000-0000-4000-8000-000000226153','Viewer');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226151','00000000-0000-4000-8000-000000226151','tenant_owner'),
 ('10000000-0000-4000-8000-000000226152','00000000-0000-4000-8000-000000226152','tenant_owner'),
 ('10000000-0000-4000-8000-000000226151','00000000-0000-4000-8000-000000226153','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values
 ('20000000-0000-4000-8000-000000226151','10000000-0000-4000-8000-000000226151','Own catalog','manual_products'),
 ('20000000-0000-4000-8000-000000226152','10000000-0000-4000-8000-000000226152','Foreign catalog','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values
 ('10000000-0000-4000-8000-000000226151','20000000-0000-4000-8000-000000226151','manual','own-product','Actual own product',250);
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;
create function pg_temp.request()returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,'dataSourceId','20000000-0000-4000-8000-000000226151','configuration',jsonb_build_object('maxItems',200,'syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"menu"'),'{seed,family}','"menu"')))
 from public.dynamic_templates where slug='editorial-arena-menubord-dark-landscape'and status='published';$$;
create temporary table author_results(name text primary key,value jsonb);grant select,insert on author_results to authenticated;
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
select '30000000-0000-4000-8000-000000226151','10000000-0000-4000-8000-000000226151','Gekoppeld bronontwerp','menu','landscape',template.id,template.current_published_version_id,'20000000-0000-4000-8000-000000226151',pg_temp.request()->'configuration'
from public.dynamic_templates template where slug='editorial-arena-menubord-dark-landscape';
insert into author_results select 'draft',jsonb_build_object('id',id,'revision',edit_revision)from public.dynamic_slide_versions where dynamic_slide_id='30000000-0000-4000-8000-000000226151';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226151',true);
insert into author_results values('create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226151'));
select ok((select value?'slideId'and value?'snapshotId'from author_results where name='create'),'a guarded Source create retains canonical snapshot and queue identity');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226151'),(select value from author_results where name='create'),'lost create acknowledgement returns the original receipt');
select is((select count(*)from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000226151'),2::bigint,'replayed create never duplicates the slide');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,title}','"Changed command"'),'40000000-0000-4000-8000-000000226151')$$,'23505',null,'the same key cannot mean a different Source design');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,rows}','[["Forged product","9,99","",""]]'),'40000000-0000-4000-8000-000000226152')$$,'23514',null,'Source facts cannot be authored through the receipt endpoint');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,jsonb_set(pg_temp.request(),'{dataSourceId}','"20000000-0000-4000-8000-000000226152"'),'40000000-0000-4000-8000-000000226153')$$,null,null,'the original canonical writer rejects another tenant source');
insert into author_results values('save',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','save','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'revision')::bigint from author_results where name='draft'),jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,title}','"Own saved design"'),'40000000-0000-4000-8000-000000226154'));
select is((select value->>'outcome'from author_results where name='save'),'applied','saving uses the existing dynamic draft writer');
select is((select configuration_json#>>'{syncConfiguration,seed,title}'from public.dynamic_slide_versions where id=(select(value->>'id')::uuid from author_results where name='draft')),'Own saved design','the Source seed is actually persisted');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226151'),1::bigint,'saving a draft does not start a render');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','save','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'revision')::bigint from author_results where name='draft'),jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,title}','"Own saved design"'),'40000000-0000-4000-8000-000000226154'),(select value from author_results where name='save'),'lost save acknowledgement recovers before the changed CAS revision');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','save','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'revision')::bigint from author_results where name='draft'),pg_temp.request(),'40000000-0000-4000-8000-000000226155')->>'outcome','conflict','a new stale command is rejected');
insert into author_results values('publish',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','publish','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'editRevision')::bigint from author_results where name='save'),'{}','40000000-0000-4000-8000-000000226156'));
select is((select value->>'outcome'from author_results where name='publish'),'publishing','explicit prepare enters the existing complete Source queue');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','publish','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'editRevision')::bigint from author_results where name='save'),'{}','40000000-0000-4000-8000-000000226156'),(select value from author_results where name='publish'),'preparation can recover its original acknowledgement');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','save','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),(select(value->>'revision')::bigint from author_results where name='draft'),jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,title}','"Own saved design"'),'40000000-0000-4000-8000-000000226154'),(select value from author_results where name='save'),'save receipt survives later publication status');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226151'),2::bigint,'publish recovery never adds a second job');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226152',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226152','publish','30000000-0000-4000-8000-000000226151',(select(value->>'id')::uuid from author_results where name='draft'),0,'{}','40000000-0000-4000-8000-000000226157')$$,'42501',null,'tenant B cannot publish or read the A version through the command');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226153',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226151','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226158')$$,'42501',null,'a viewer cannot author a connected Source design');
reset role;
select is(has_function_privilege('anon','public.mutate_sync_dynamic_authoring_v1(uuid,text,uuid,uuid,bigint,jsonb,uuid)','EXECUTE'),false,'anonymous clients cannot call the authoring writer');
select is(has_function_privilege('service_role','public.mutate_sync_dynamic_authoring_v1(uuid,text,uuid,uuid,bigint,jsonb,uuid)','EXECUTE'),false,'workers cannot author Source designs without a real user');
select *from finish();rollback;
