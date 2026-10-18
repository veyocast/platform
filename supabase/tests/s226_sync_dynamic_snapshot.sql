begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000226141','Full source A','full-source-a'),('10000000-0000-4000-8000-000000226142','Other source B','full-source-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226141'),('10000000-0000-4000-8000-000000226142');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('20000000-0000-4000-8000-000000226141','10000000-0000-4000-8000-000000226141','Actual manual catalog','manual_products');
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;

create function pg_temp.slide_fixture(p_sync boolean)returns public.dynamic_slides language sql stable as $fn$
select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','30000000-0000-4000-8000-000000226141','tenant_id','10000000-0000-4000-8000-000000226141','name','Full own menu','slide_type','menu','orientation','landscape','data_source_id','20000000-0000-4000-8000-000000226141','configuration_json',jsonb_build_object('maxItems',200)||case when p_sync then jsonb_build_object('syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"menu"'),'{seed,family}','"menu"'))else '{}'::jsonb end));$fn$;
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents,sort_order)
select '10000000-0000-4000-8000-000000226141','20000000-0000-4000-8000-000000226141','manual','own-'||i,'Actual item '||i,200+i,i from generate_series(1,43)i;
insert into public.tenant_products(tenant_id,source,slug,name,price_cents)values('10000000-0000-4000-8000-000000226142','manual','foreign-menu','Private B item',999);
create temporary table snapshot_result(value jsonb);insert into snapshot_result select private.build_dynamic_snapshot_data(pg_temp.slide_fixture(true));
select is(jsonb_array_length((select value#>'{menu,products}'from snapshot_result)),43,'Source preserves all forty-three actual products rather than the first forty');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.slide_fixture(false))#>'{menu,products}'),40,'legacy callers retain their established bounded snapshot shape');
select is((select value#>>'{menu,products,42,name}'from snapshot_result),'Actual item 43','the last selected product remains present');
select ok((select not(value::text like'%Private B item%')from snapshot_result),'the complete selection cannot cross the tenant boundary');
select is((select value#>>'{syncConfiguration,seed,family}'from snapshot_result),'menu','the exact Source configuration is frozen alongside canonical facts');
select ok((select value?'generatedAt'and not(value?'sitesConfiguration')from snapshot_result),'generation time is metadata and never relabels the old renderer');
select is(private.dynamic_snapshot_content_hash_v1(pg_temp.slide_fixture(true),(select value from snapshot_result)),private.dynamic_snapshot_content_hash_v1(pg_temp.slide_fixture(true),(select jsonb_set(value,'{generatedAt}','"2026-12-31T12:00:00Z"')from snapshot_result)),'render generation metadata cannot create a needless snapshot');
select is(private.published_data_hash_v1((select value from snapshot_result)),private.published_data_hash_v1((select jsonb_set(value,'{generatedAt}','"2026-12-31T12:00:00Z"')from snapshot_result)),'generation time cannot create a needless published-data revision');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents,sort_order)
select '10000000-0000-4000-8000-000000226141','20000000-0000-4000-8000-000000226141','manual','own-'||i,'Actual item '||i,200+i,i from generate_series(44,200)i;
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.slide_fixture(true))#>'{menu,products}'),200,'the complete source boundary admits exactly two hundred rows');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents,sort_order)values('10000000-0000-4000-8000-000000226141','20000000-0000-4000-8000-000000226141','manual','own-201','Actual item 201',401,201);
select throws_ok($$select private.build_dynamic_snapshot_data(pg_temp.slide_fixture(true))$$,'23514','Source full selection exceeds 200 rows; narrow the selection or split into a series','overflow is an explicit failure, never a silently incomplete render');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226141'),0::bigint,'read-only projection does not create worker jobs');
select is(has_function_privilege('authenticated','private.build_dynamic_snapshot_data(public.dynamic_slides)','EXECUTE'),false,'the canonical builder remains behind guarded commands');

-- The protected S206 sport body stays untouched. Its Source-only reader must
-- retain the entire source/pool selection without consuming a foreign source.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values('00000000-0000-4000-8000-000000226141','authenticated','authenticated','source-sport-rows@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000226141','Source sport fixture');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000226141','00000000-0000-4000-8000-000000226141','tenant_owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226141',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000226141','Source sport primary','Own club','226141','encrypted-fixture','initialization-vector','authentication-tag');
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000226141','Source sport secondary','Other source club','226142','encrypted-fixture','initialization-vector','authentication-tag');
reset role;
create temporary table sport_sources as select source.name,connection.id,connection.data_source_id from public.sportlink_connections connection join public.dynamic_data_sources source on source.tenant_id=connection.tenant_id and source.id=connection.data_source_id where connection.tenant_id='10000000-0000-4000-8000-000000226141';
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select '10000000-0000-4000-8000-000000226141',source.id,source.name||'-'||i,now()+interval '1 day'+interval '1 minute'*i,'scheduled',jsonb_build_object('externalId','own','name','Own club'),jsonb_build_object('externalId','opponent','name',case when source.name='Source sport primary'then'Actual opponent '||i else'Other source private opponent'end),'{"externalId":"cup","period":"phase","season":"2026"}','{"externalId":"own-pool","competitionExternalId":"cup"}',true,true from sport_sources source cross join generate_series(1,43)i;
create function pg_temp.sport_fixture(p_sync boolean)returns public.dynamic_slides language sql stable as $fn$
 select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','30000000-0000-4000-8000-000000226142','tenant_id','10000000-0000-4000-8000-000000226141','name','Full canonical pool program','slide_type','sport_program','orientation','landscape','data_source_id',source.data_source_id,'configuration_json',jsonb_build_object('blueprintKey','sportlink.pool_schedule_next_7_days','context',jsonb_build_object('poolId','own-pool'))||case when p_sync then jsonb_build_object('syncConfiguration',pg_temp.source_config())else '{}'::jsonb end))from sport_sources source where name='Source sport primary';$fn$;
select is(jsonb_array_length(private.build_sync_dynamic_typed_wrapper_v1(pg_temp.sport_fixture(true))#>'{sport,items}'),43,'the Source-only typed sport reader retains every authorized pool match');
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.sport_fixture(false))#>'{sport,items}'),40,'the protected historical typed sport reader keeps its original bound');
select ok(private.build_sync_dynamic_typed_wrapper_v1(pg_temp.sport_fixture(true))::text not like'%Other source private opponent%','the complete sport reader preserves the selected source boundary');
select is(has_function_privilege('service_role','private.build_sync_dynamic_typed_wrapper_v1(public.dynamic_slides)','EXECUTE'),false,'workers cannot invoke the private typed source authority');
select *from finish();rollback;
