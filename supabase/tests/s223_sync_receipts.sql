begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000223001','authenticated','authenticated','sync-admin@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000223002','authenticated','authenticated','sync-other@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000223003','authenticated','authenticated','sync-viewer@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) select id,'Sync fixture' from auth.users where email like 'sync-%@veyocast.test';
insert into public.tenants(id,name,slug,screen_limit) values
 ('10000000-0000-4000-8000-000000223001','Sync A','sync-a',2),('10000000-0000-4000-8000-000000223002','Sync B','sync-b',2);
insert into public.tenant_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000223001','00000000-0000-4000-8000-000000223001','tenant_admin'),
 ('10000000-0000-4000-8000-000000223002','00000000-0000-4000-8000-000000223002','tenant_admin'),
 ('10000000-0000-4000-8000-000000223001','00000000-0000-4000-8000-000000223003','tenant_viewer');
insert into public.screens(id,tenant_id,name,status) values
 ('20000000-0000-4000-8000-000000223001','10000000-0000-4000-8000-000000223001','Screen A','active'),
 ('20000000-0000-4000-8000-000000223002','10000000-0000-4000-8000-000000223002','Screen B','active');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status) values
 ('30000000-0000-4000-8000-000000223001','10000000-0000-4000-8000-000000223001','20000000-0000-4000-8000-000000223001','Player A',repeat('a',64),'paired'),
 ('30000000-0000-4000-8000-000000223002','10000000-0000-4000-8000-000000223002','20000000-0000-4000-8000-000000223002','Player B',repeat('b',64),'paired');
create temporary table receipts(name text primary key,value jsonb);
grant all on receipts to anon,authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000223002',true);
select throws_ok($$select public.request_screen_sync_retry_v1('10000000-0000-4000-8000-000000223001','20000000-0000-4000-8000-000000223001')$$,'42501',null,'another tenant cannot force sync');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000223003',true);
select throws_ok($$select public.request_screen_sync_retry_v1('10000000-0000-4000-8000-000000223001','20000000-0000-4000-8000-000000223001')$$,'42501',null,'viewer cannot force sync');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000223001',true);
select lives_ok($$select public.request_screen_sync_retry_v1('10000000-0000-4000-8000-000000223001','20000000-0000-4000-8000-000000223001')$$,'authorized admin requests sync');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
insert into receipts select 'first',public.record_player_heartbeat_v3(repeat('a',64),'PLAYING');
select ok((select value->>'syncRetryRequestedAt' is not null from receipts where name='first'),'ordinary heartbeat delivers the outstanding request');
select is(public.record_player_heartbeat_v3(repeat('a',64),'PLAYING')->>'syncRetryRequestedAt',(select value->>'syncRetryRequestedAt' from receipts where name='first'),'unacknowledged receipt is redelivered');
select is(public.record_player_heartbeat_v3(repeat('b',64),'PLAYING')->>'syncRetryRequestedAt',null::text,'another Player cannot read the request');
select lives_ok($$select public.record_player_heartbeat_v3(repeat('a',64),'PLAYING',p_sync_detail:='{"syncRetryAcknowledgedAt":"invalid"}')$$,'malformed receipt does not break playback heartbeat');
reset role;
select ok((select sync_retry_requested_at is not null from player_devices where id='30000000-0000-4000-8000-000000223001'),'malformed receipt cannot clear the request');
-- Simulate a newer separately committed request while an older heartbeat is in flight.
update player_devices set sync_retry_requested_at=sync_retry_requested_at+interval '1 millisecond' where id='30000000-0000-4000-8000-000000223001';
set local role anon;
insert into receipts select 'newer',public.record_player_heartbeat_v3(repeat('a',64),'PLAYING',p_sync_detail:=jsonb_build_object('syncRetryAcknowledgedAt',(select value->>'syncRetryRequestedAt' from receipts where name='first')));
select isnt((select value->>'syncRetryRequestedAt' from receipts where name='newer'),(select value->>'syncRetryRequestedAt' from receipts where name='first'),'stale acknowledgement cannot erase a newer request');
select is(public.record_player_heartbeat_v3(repeat('a',64),'PLAYING',p_sync_detail:=jsonb_build_object('syncRetryAcknowledgedAt',(select value->>'syncRetryRequestedAt' from receipts where name='newer')))->>'syncRetryRequestedAt',null::text,'exact receipt acknowledges this device request');
select is(public.record_player_heartbeat_v3(repeat('a',64),'PLAYING',p_sync_detail:=jsonb_build_object('syncRetryAcknowledgedAt',(select value->>'syncRetryRequestedAt' from receipts where name='newer')))->>'syncRetryRequestedAt',null::text,'replayed acknowledgement is harmless');
select throws_ok($$select public.record_player_heartbeat_v3(repeat('c',64),'PLAYING')$$,'P0002',null,'unknown credential cannot read or acknowledge requests');
reset role;
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.record_player_heartbeat_v3(text,text,uuid,uuid,bigint,bigint,text,text,jsonb,text,jsonb)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'no implicit PUBLIC access');
select *from finish();
rollback;
