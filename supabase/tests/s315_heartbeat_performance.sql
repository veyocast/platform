begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='player_heartbeats'
  and indexname='player_heartbeats_tenant_recent_idx' and indexdef like '%(tenant_id, created_at DESC) INCLUDE (screen_id, active_release_id, runtime_state)%'),
  'the overview has an ordered tenant covering index');
select ok((select relrowsecurity from pg_class where oid='public.player_heartbeats'::regclass),'heartbeat RLS remains enabled');
insert into public.tenants(id,name,slug)values
 ('31500000-0000-4000-8000-000000000001','Performance A','performance-a'),
 ('31500000-0000-4000-8000-000000000002','Performance B','performance-b');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
 values('31500000-0000-4000-8000-000000000003','authenticated','authenticated','performance@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('31500000-0000-4000-8000-000000000003','Performance owner');
insert into public.tenant_memberships(tenant_id,user_id,role)values('31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000003','tenant_owner');
insert into public.screens(id,tenant_id,name)values
 ('31500000-0000-4000-8000-000000000011','31500000-0000-4000-8000-000000000001','Screen A'),
 ('31500000-0000-4000-8000-000000000012','31500000-0000-4000-8000-000000000002','Screen B');
insert into public.player_devices(id,tenant_id,screen_id,token_hash)values
 ('31500000-0000-4000-8000-000000000021','31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000011',repeat('a',64)),
 ('31500000-0000-4000-8000-000000000022','31500000-0000-4000-8000-000000000002','31500000-0000-4000-8000-000000000012',repeat('b',64));
insert into public.player_heartbeats(tenant_id,device_id,screen_id,runtime_state,created_at)values
 ('31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000021','31500000-0000-4000-8000-000000000011','READY',now()-'1 minute'::interval),
 ('31500000-0000-4000-8000-000000000001','31500000-0000-4000-8000-000000000021','31500000-0000-4000-8000-000000000011','PLAYING',now()),
 ('31500000-0000-4000-8000-000000000002','31500000-0000-4000-8000-000000000022','31500000-0000-4000-8000-000000000012','READY',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','31500000-0000-4000-8000-000000000003',true);
select is((select count(*)from public.player_heartbeats),2::bigint,'an authenticated owner reads only their own tenant');
select is((select count(*)from public.player_heartbeats where tenant_id='31500000-0000-4000-8000-000000000002'),0::bigint,'the new index never exposes another tenant');
select is((select runtime_state from public.player_heartbeats where tenant_id='31500000-0000-4000-8000-000000000001'order by created_at desc limit 1),'PLAYING','the ordered overview still returns the latest actual heartbeat');
reset role;
select ok(not has_table_privilege('anon','public.player_heartbeats','select'),'anonymous callers cannot read heartbeat telemetry');

create temporary table performance_heartbeats(tenant_id uuid,device_id uuid,screen_id uuid,active_release_id uuid,runtime_state text,created_at timestamptz);
insert into performance_heartbeats
 select case when sequence%100=0 then '31500000-0000-4000-8000-000000000002'::uuid else '31500000-0000-4000-8000-000000000001'::uuid end,
 md5('device-'||(sequence%8)::text)::uuid,md5('screen-'||(sequence%8)::text)::uuid,null,'PLAYING',now()-make_interval(secs=>sequence)
 from generate_series(1,100000)sequence;
create index performance_heartbeats_device_idx on performance_heartbeats(tenant_id,device_id,created_at desc);
create index performance_heartbeats_screen_idx on performance_heartbeats(tenant_id,screen_id,created_at desc);
create index performance_heartbeats_active_idx on performance_heartbeats(tenant_id,active_release_id)where active_release_id is not null;
analyze performance_heartbeats;
create function pg_temp.overview_plan()returns jsonb language plpgsql as $plan$
declare result jsonb;
begin
 execute 'explain(analyze,buffers,format json)select screen_id,active_release_id,runtime_state,created_at from performance_heartbeats where tenant_id=''31500000-0000-4000-8000-000000000001''order by created_at desc limit 250'into result;
 return result;
end;$plan$;
create temporary table performance_plans(name text,plan jsonb);
insert into performance_plans values('before',pg_temp.overview_plan());
create index performance_heartbeats_tenant_recent_idx on performance_heartbeats(tenant_id,created_at desc)include(screen_id,active_release_id,runtime_state);
insert into performance_plans values('after',pg_temp.overview_plan());
select ok((select plan::text like '%Seq Scan%'and plan::text like '%Sort%'from performance_plans where name='before'),'baseline reproduces a full tenant scan and sort');
select ok((select plan::text like '%performance_heartbeats_tenant_recent_idx%'and plan::text not like '%Sort%'from performance_plans where name='after'),'the planner uses the new ordered index without a sort');
select cmp_ok((select(plan#>>'{0,Plan,Local Hit Blocks}')::bigint+(plan#>>'{0,Plan,Local Read Blocks}')::bigint from performance_plans where name='after'),'<',
 (select((plan#>>'{0,Plan,Local Hit Blocks}')::bigint+(plan#>>'{0,Plan,Local Read Blocks}')::bigint)/10 from performance_plans where name='before'),'the indexed read visits less than one tenth of the baseline pages');
select name,plan#>>'{0,Execution Time}'execution_ms,(plan#>>'{0,Plan,Local Hit Blocks}')::bigint+(plan#>>'{0,Plan,Local Read Blocks}')::bigint buffer_pages from performance_plans order by name;
select *from finish();
rollback;
