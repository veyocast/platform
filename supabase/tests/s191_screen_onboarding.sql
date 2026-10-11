begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('19180000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
select pg_temp.uid(n),'authenticated','authenticated','screen-s191-'||n||'@veyocast.test','test',now(),now(),now(),'{}','{}' from generate_series(1,3)n;
insert into public.profiles(id,display_name) select pg_temp.uid(n),'Screen owner '||n from generate_series(1,3)n;
insert into public.tenants(id,name,slug,screen_limit) values
  (pg_temp.uid(10),'Onboarding A','onboarding-s191-a',3),
  (pg_temp.uid(11),'Onboarding B','onboarding-s191-b',3);
insert into public.tenant_settings(tenant_id) values(pg_temp.uid(10)),(pg_temp.uid(11));
insert into public.tenant_memberships(tenant_id,user_id,role) values
  (pg_temp.uid(10),pg_temp.uid(1),'tenant_owner'),
  (pg_temp.uid(11),pg_temp.uid(2),'tenant_owner'),
  (pg_temp.uid(10),pg_temp.uid(3),'tenant_viewer');
insert into public.screen_groups(id,tenant_id,name,created_by) values
  (pg_temp.uid(20),pg_temp.uid(10),'Clubhuis',pg_temp.uid(1)),
  (pg_temp.uid(21),pg_temp.uid(11),'Andere club',pg_temp.uid(2));
create temporary table saved(name text primary key,id uuid);
grant all on saved to authenticated;
create function pg_temp.create_screen(key integer, grp uuid default null, name text default 'Nieuw scherm') returns uuid language sql as $$
  select public.create_screen_onboarding_v2(pg_temp.uid(10),name,'Kantine','landscape',1920,1080,null,grp,pg_temp.uid(key))
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
insert into saved values('first',pg_temp.create_screen(100,pg_temp.uid(20)));
select is((select count(*) from public.screens),1::bigint,'one acknowledged command creates exactly one screen');
select is((select screen_id from public.screen_group_memberships),(select id from saved where name='first'),'chosen group contains the actual created screen');
select is((select revision from public.screen_groups where id=pg_temp.uid(20)),1::bigint,'membership change invalidates a previously reviewed group editor');
select is(pg_temp.create_screen(100,pg_temp.uid(20)),(select id from saved where name='first'),'lost-response retry returns the same screen identity');
select is((select count(*) from public.screens),1::bigint,'retry cannot duplicate the screen');
select is((select revision from public.screen_groups where id=pg_temp.uid(20)),1::bigint,'retry cannot advance the group twice');
select throws_ok($$select pg_temp.create_screen(100,pg_temp.uid(20),'Changed retry')$$,'23505',null,'same command identity cannot represent changed form input');
select throws_ok($$select pg_temp.create_screen(101,pg_temp.uid(21))$$,'42501',null,'tenant A cannot attach a screen to tenant B group');
select throws_ok($$select pg_temp.create_screen(102,pg_temp.uid(999))$$,'42501',null,'missing group rejects the complete command');
select is((select count(*) from public.screens),1::bigint,'invalid group creates no orphan screen');
select throws_ok($$select pg_temp.create_screen(103,null,repeat('x',81))$$,'23514',null,'Source screen name is bounded at the server');
select throws_ok($$select public.create_screen_onboarding_v2(pg_temp.uid(10),'Null resolution','', 'portrait',null,1920,null,null,pg_temp.uid(104))$$,'23514',null,'missing resolution cannot bypass original screen validation');
select throws_ok($$select public.create_screen_onboarding_v2(pg_temp.uid(10),'Foreign release','', 'landscape',1920,1080,pg_temp.uid(999),pg_temp.uid(20),pg_temp.uid(105))$$,'23514',null,'unavailable immutable initial release rolls back creation and group mutation');
select is((select count(*) from public.screen_group_memberships),1::bigint,'failed release validation leaves group membership unchanged');
select is((select revision from public.screen_groups where id=pg_temp.uid(20)),1::bigint,'failed release validation preserves reviewed group revision');
insert into saved values('second',pg_temp.create_screen(106));
select is((select count(*) from public.screens),2::bigint,'group is optional and unpaired screen is a real resource');
select is((select count(*) from public.screen_group_memberships),1::bigint,'omitting group creates no invented membership');
insert into saved values('third',pg_temp.create_screen(107));
select throws_ok($$select pg_temp.create_screen(108,pg_temp.uid(20))$$,'P0001',null,'atomic screen limit is enforced through original authoritative command');
select is((select count(*) from public.screens),3::bigint,'screen limit failure creates no extra screen');
select is((select count(*) from public.screen_group_memberships),1::bigint,'screen limit failure adds no group member');
select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);
select throws_ok($$select pg_temp.create_screen(109)$$,'42501',null,'viewer cannot create a screen');
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
select is((select count(*) from public.screens),0::bigint,'tenant B cannot read screens created by tenant A');
select throws_ok($$select pg_temp.create_screen(110)$$,'42501',null,'tenant B cannot write screens for tenant A');
reset role;
update public.screen_groups set status='archived',archived_at=now() where id=pg_temp.uid(20);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select throws_ok($$select pg_temp.create_screen(111,pg_temp.uid(20))$$,'42501',null,'archived group is unavailable for a new command');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='paused' where id=pg_temp.uid(10);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select throws_ok($$select pg_temp.create_screen(112)$$,'42501',null,'suspended tenant cannot create even with an owner session');
reset role;
select ok(not has_function_privilege('anon','public.create_screen_onboarding_v2(uuid,text,text,text,integer,integer,uuid,uuid,uuid)','execute'),'anonymous cannot execute onboarding');
select ok(not has_function_privilege('service_role','public.create_screen_onboarding_v2(uuid,text,text,text,integer,integer,uuid,uuid,uuid)','execute'),'service role cannot impersonate a screen author');
select * from finish();
rollback;
