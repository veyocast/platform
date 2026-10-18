begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values
 ('00000000-0000-4000-8000-000000226171','authenticated','authenticated','source-led-owner@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000226171','Source LED owner');
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226171','Source LED A','source-led-a'),
 ('10000000-0000-4000-8000-000000226172','Source LED B','source-led-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226171');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000226171','00000000-0000-4000-8000-000000226171','tenant_owner');
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason,changed_by)values
 ('10000000-0000-4000-8000-000000226171','ledscores_realtime',true,'Source LED gate test','00000000-0000-4000-8000-000000226171');
insert into public.screens(id,tenant_id,name,orientation,status)values('30000000-0000-4000-8000-000000226171','10000000-0000-4000-8000-000000226171','Owned portrait fixture','portrait','active');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status)values('31000000-0000-4000-8000-000000226171','10000000-0000-4000-8000-000000226171','30000000-0000-4000-8000-000000226171','Owned fixture',repeat('d',64),'paired');
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;
create function pg_temp.request()returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',template.current_published_version_id,
  'dataSourceId',(select data_source_id from public.ledscores_connections where tenant_id='10000000-0000-4000-8000-000000226171'limit 1),
  'configuration',jsonb_build_object('liveMatch',jsonb_build_object('template','scoreboard','showClock',true),
   'syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"ledscores_live_match"'),'{seed,family}','"scoreboard"')))
 from public.dynamic_templates template where slug='ledscores-live-match-landscape';$$;
create temporary table source_led_results(name text primary key,value jsonb);grant select,insert on source_led_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226171',true);
select lives_ok($$select public.save_ledscores_connection_v1('10000000-0000-4000-8000-000000226171',null,'Own match fixture','own-match-fixture','active',0)$$,'the existing guarded connection writer provisions the Source source');
insert into source_led_results values('request',pg_temp.request());
insert into source_led_results values('create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226171','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000226171'));
select ok((select value?'slideId'and value?'snapshotId'from source_led_results where name='create'),'an entitled Source score uses the existing canonical snapshot/queue');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226171'),1::bigint,'Source creates one complete render job');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226172','create',null,null,0,(select value from source_led_results where name='request'),'40000000-0000-4000-8000-000000226172')$$,'42501',null,'A cannot author a Source score in tenant B');
reset role;
update public.tenant_feature_flags set enabled=false where tenant_id='10000000-0000-4000-8000-000000226171'and flag_key='ledscores_realtime';
set local role authenticated;
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226171','create',null,null,0,(select value from source_led_results where name='request'),'40000000-0000-4000-8000-000000226173')$$,'42501',null,'Source cannot bypass the tenant LED feature gate');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226171','create',null,null,0,(select value from source_led_results where name='request'),'40000000-0000-4000-8000-000000226171'),(select value from source_led_results where name='create'),'a committed receipt remains recoverable after the mutable feature decision changes');
reset role;
select lives_ok($$select private.assert_sync_dynamic_configuration_v1('10000000-0000-4000-8000-000000226171','sport_program','landscape',pg_temp.source_config())$$,'a disabled LED feature does not disable other Source families');
update public.tenant_feature_flags set enabled=true where tenant_id='10000000-0000-4000-8000-000000226171'and flag_key='ledscores_realtime';
update private.tenant_feature_flag_definitions set kill_switch_active=true where flag_key='ledscores_realtime';
set local role authenticated;
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000226171','create',null,null,0,(select value from source_led_results where name='request'),'40000000-0000-4000-8000-000000226174')$$,'42501',null,'Source cannot bypass the global LED kill switch');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000226171'),1::bigint,'feature changes and exact replay never duplicate Source work');
reset role;
select is(has_function_privilege('authenticated','private.assert_sync_dynamic_configuration_v1(uuid,text,text,jsonb)','execute'),false,'the combined validator stays private');
select is(has_function_privilege('authenticated','private.assert_sync_dynamic_before_led_v1(uuid,text,text,jsonb)','execute'),false,'the previous validator is not a bypass endpoint');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.get_ledscores_player_bootstrap_v1(repeat('d',64))->>'screenOrientation','portrait','the token-bound bootstrap returns the paired screen orientation');
select is((public.get_ledscores_player_bootstrap_v1(repeat('e',64))->>'authorized')::boolean,false,'an unknown device gets no screen data');
reset role;
select is(has_table_privilege('service_role','public.screens','select'),false,'the bootstrap fix grants no general screen table access');
select ok(has_column_privilege('service_role','public.screens','id','select')and has_column_privilege('service_role','public.screens','tenant_id','select')and has_column_privilege('service_role','public.screens','target_revision','select'),'the server realtime filter can read only its required identity/revision fields');
select is(has_column_privilege('service_role','public.screens','orientation','select'),false,'the token bootstrap does not require a direct orientation grant');
select is(has_column_privilege('service_role','public.screens','name','select'),false,'the realtime correction does not expose screen names');
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)from public.screens),0::bigint,'anonymous screen reads remain denied by tenant RLS');
reset role;
select is(to_regprocedure('private.get_ledscores_player_bootstrap_before_sync_v1(text)'),null::regprocedure,'no alternative bootstrap bypass endpoint is introduced');
select is(has_function_privilege('authenticated','public.get_ledscores_player_bootstrap_v1(text)','execute'),false,'ordinary browser roles cannot fetch device bootstrap data');
select *from finish();rollback;
