begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values
 ('00000000-0000-4000-8000-000000001151','authenticated','authenticated','sponsor-maker@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000001152','authenticated','authenticated','sponsor-approver@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000001153','authenticated','authenticated','sponsor-other@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000001154','authenticated','authenticated','sponsor-committee@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000001151','Sponsor maker'),
 ('00000000-0000-4000-8000-000000001152','Sponsor approver'),
 ('00000000-0000-4000-8000-000000001153','Other tenant'),
 ('00000000-0000-4000-8000-000000001154','Sponsor committee');
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000001151','Sponsor tenant','sponsor-tenant'),
 ('10000000-0000-4000-8000-000000001153','Other sponsor tenant','other-sponsor-tenant');
update public.tenants set screen_limit=3 where id in ('10000000-0000-4000-8000-000000001151','10000000-0000-4000-8000-000000001153');
insert into public.tenant_settings(tenant_id) values
 ('10000000-0000-4000-8000-000000001151'),
 ('10000000-0000-4000-8000-000000001153');
insert into public.tenant_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000001151','00000000-0000-4000-8000-000000001151','tenant_owner'),
 ('10000000-0000-4000-8000-000000001151','00000000-0000-4000-8000-000000001152','tenant_admin'),
 ('10000000-0000-4000-8000-000000001153','00000000-0000-4000-8000-000000001153','tenant_owner');
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities,created_by,updated_by)
values('90000000-0000-4000-8000-000000001154','10000000-0000-4000-8000-000000001151','Sponsorcommissie',array['tenant.sponsor.read','tenant.sponsor.report'],'00000000-0000-4000-8000-000000001151','00000000-0000-4000-8000-000000001151');
insert into public.tenant_memberships(tenant_id,user_id,role,custom_role_id)
values('10000000-0000-4000-8000-000000001151','00000000-0000-4000-8000-000000001154','tenant_viewer','90000000-0000-4000-8000-000000001154');
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
values ('20000000-0000-4000-8000-000000001151','10000000-0000-4000-8000-000000001151','00000000-0000-4000-8000-000000001151','image','Sponsorbord','sponsor.png','image/png','ready','tenant-media','tenants/10000000-0000-4000-8000-000000001151/assets/20000000-0000-4000-8000-000000001151/original.png',1200,repeat('a',64),1920,1080,now());
insert into public.screens(id,tenant_id,name,orientation,status,created_by)
values ('30000000-0000-4000-8000-000000001151','10000000-0000-4000-8000-000000001151','Sponsor scherm','landscape','active','00000000-0000-4000-8000-000000001151');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status)
values ('40000000-0000-4000-8000-000000001151','10000000-0000-4000-8000-000000001151','30000000-0000-4000-8000-000000001151','Sponsor player',repeat('b',64),'paired');

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-4000-8000-000000001155','authenticated','authenticated','s299-b-approver@veyocast.test','test','{}','{}');
insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000001155','Other approver');
insert into public.tenant_memberships(tenant_id,user_id,role)
values('10000000-0000-4000-8000-000000001153','00000000-0000-4000-8000-000000001155','tenant_admin');
insert into public.screens(id,tenant_id,name,orientation,status,created_by) values
('30000000-0000-4000-8000-000000001152','10000000-0000-4000-8000-000000001151','Hernoemd tweede scherm','portrait','active','00000000-0000-4000-8000-000000001151'),
('30000000-0000-4000-8000-000000001153','10000000-0000-4000-8000-000000001153','Tenant B scherm','landscape','active','00000000-0000-4000-8000-000000001153');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status) values
('40000000-0000-4000-8000-000000001152','10000000-0000-4000-8000-000000001151','30000000-0000-4000-8000-000000001152','Second player',repeat('c',64),'paired'),
('40000000-0000-4000-8000-000000001153','10000000-0000-4000-8000-000000001153','30000000-0000-4000-8000-000000001153','Other player',repeat('d',64),'paired');
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
values('20000000-0000-4000-8000-000000001153','10000000-0000-4000-8000-000000001153','00000000-0000-4000-8000-000000001153','image','Other sponsor','sponsor.png','image/png','ready','tenant-media','tenants/10000000-0000-4000-8000-000000001153/assets/20000000-0000-4000-8000-000000001153/original.png',1200,repeat('e',64),1920,1080,now());

create temporary table s299_fixture(tenant_id uuid primary key, info jsonb);
grant select on s299_fixture to authenticated,anon;
do $$
declare n integer; tenant uuid; maker uuid; approver uuid; asset uuid; sponsor uuid; campaign uuid; creative uuid; position uuid; first_campaign uuid; second_campaign uuid; plan uuid; creatives jsonb:='[]';
begin
  foreach n in array array[1151,1153] loop
    tenant := ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    maker := ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    approver := case when n=1151 then '00000000-0000-4000-8000-000000001152'::uuid else '00000000-0000-4000-8000-000000001155'::uuid end;
    asset := ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claim.sub',maker::text,true);
    perform public.ensure_sponsor_positions_v1(tenant);
    sponsor := (public.create_sponsor_v1(tenant,'Eigen partner '||n,null,null)->>'sponsorId')::uuid;
    perform public.register_sponsor_media_v1(tenant,sponsor,asset);
    select id into position from public.sponsor_positions where tenant_id=tenant and key='footer';
    creatives := '[]';
    for i in 1..2 loop
      campaign := (public.create_sponsor_campaign_v1(tenant,sponsor,'Campagne '||n||'/'||i,now()-interval '20 days',now()+interval '20 days',1)->>'campaignId')::uuid;
      creative := (public.add_sponsor_creative_v1(tenant,campaign,asset,'footer','any',8)->>'creativeId')::uuid;
      perform public.place_sponsor_campaign_v1(tenant,campaign,position,'any');
      perform public.submit_sponsor_campaign_v1(tenant,campaign);
      perform set_config('request.jwt.claim.sub',approver::text,true);
      perform public.approve_sponsor_campaign_v1(tenant,campaign,true);
      perform set_config('request.jwt.claim.sub',maker::text,true);
      if i=1 then first_campaign:=campaign; else second_campaign:=campaign; end if;
      creatives:=creatives||jsonb_build_array(creative);
    end loop;
    plan := (public.publish_sponsor_plan_v1(tenant,null,14)->>'planRevisionId')::uuid;
    insert into s299_fixture values(tenant,jsonb_build_object('sponsor',sponsor,'campaign1',first_campaign,'campaign2',second_campaign,'creatives',creatives,'position',position,'plan',plan));
  end loop;
end $$;

-- Every bulk fixture row passes the unchanged device acceptance RPC in batches.
do $$
declare info jsonb; payload jsonb; accepted integer:=0; chosen_token text;
begin
  select f.info into info from s299_fixture f where tenant_id='10000000-0000-4000-8000-000000001151';
  for batch in 0..55 loop
    for screen in 1..2 loop
      select jsonb_agg(jsonb_build_object(
        'eventId',('52990000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
        'planRevisionId',info->>'plan','sponsorId',info->>'sponsor',
        'campaignId',info->>case when i%2=1 then 'campaign1' else 'campaign2' end,
        'creativeId',info->'creatives'->>case when i%2=1 then 0 else 1 end,
        'positionId',info->>'position','happenedAt',now()-make_interval(days=>i%5+1,secs=>i),
        'playedMs',1000+i%4,'context','{}'::jsonb)) into payload
      from generate_series(batch*100+1,least((batch+1)*100,5501)) i
      where case when screen=2 then i%3=0 else i%3<>0 end;
      if payload is not null then
        chosen_token:=case when screen=1 then repeat('b',64) else repeat('c',64) end;
        accepted:=accepted+public.record_sponsor_play_events_v1(chosen_token,payload);
      end if;
    end loop;
  end loop;
  if accepted<>5501 then raise exception 'fixture acceptance mismatch: %',accepted; end if;
  select f.info into info from s299_fixture f where tenant_id='10000000-0000-4000-8000-000000001153';
  perform public.record_sponsor_play_events_v1(repeat('d',64),jsonb_build_array(jsonb_build_object(
    'eventId','52990000-0000-4000-8000-000000009000','planRevisionId',info->>'plan','sponsorId',info->>'sponsor',
    'campaignId',info->>'campaign1','creativeId',info->'creatives'->>0,'positionId',info->>'position',
    'happenedAt',now()-interval '1 day','playedMs',999999,'context','{}'::jsonb)));
end $$;

select set_config('s299.from',((now() at time zone 'Europe/Amsterdam')::date-7)::text,true);
select set_config('s299.until',((now() at time zone 'Europe/Amsterdam')::date+1)::text,true);
select set_config('s299.cut',(now()+interval '1 second')::text,true);
create function pg_temp.s299_report(campaign uuid default null,screen uuid default null,cut timestamptz default null,before_at timestamptz default null,before_id uuid default null)
returns jsonb language sql as $$
 select public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.from')::date,current_setting('s299.until')::date,campaign,screen,coalesce(cut,current_setting('s299.cut')::timestamptz),before_at,before_id);
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select is(pg_temp.s299_report()#>>'{totals,acceptedEvents}','5501','SPN-01 full accepted total exceeds the old 5000 row cap');
select is(pg_temp.s299_report()#>>'{totals,playedMs}','5509251','SPN-01 sums every validated millisecond exactly');
select is(jsonb_array_length(pg_temp.s299_report()->'details'),50,'details remain bounded to 50, independently of full totals');
select is((pg_temp.s299_report()->>'hasMore')::boolean,true,'bounded detail page advertises more rows');
select is(pg_temp.s299_report((select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001151'))#>>'{totals,acceptedEvents}','2751','campaign filter spans all days and screens');
select is(pg_temp.s299_report(null,'30000000-0000-4000-8000-000000001152')#>>'{totals,acceptedEvents}','1833','screen filter includes all events beyond detail pages');
select is(pg_temp.s299_report((select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001151'),'30000000-0000-4000-8000-000000001152')#>>'{totals,acceptedEvents}','917','campaign and screen predicates intersect');
select is((select sum((g->>'acceptedEvents')::bigint)::text from jsonb_array_elements(pg_temp.s299_report()->'groups') g),'5501','CSV grouping covers every selected accepted event');
select is((select sum((g->>'playedMs')::bigint)::text from jsonb_array_elements(pg_temp.s299_report()->'groups') g),'5509251','CSV group durations equal the dashboard total');
select set_config('s299.page1',pg_temp.s299_report()::text,true);
select set_config('s299.page2',pg_temp.s299_report(null,null,null,(current_setting('s299.page1')::jsonb#>>'{details,49,happenedAt}')::timestamptz,(current_setting('s299.page1')::jsonb#>>'{details,49,eventId}')::uuid)::text,true);
select is(current_setting('s299.page2')::jsonb->'totals',current_setting('s299.page1')::jsonb->'totals','INT-08 cursor changes no aggregate');
select is((select count(*) from jsonb_array_elements(current_setting('s299.page1')::jsonb->'details') a join jsonb_array_elements(current_setting('s299.page2')::jsonb->'details') b on a->>'eventId'=b->>'eventId'),0::bigint,'cursor pages have no repeated event');
select ok((current_setting('s299.page1')::jsonb#>>'{details,49,happenedAt}')::timestamptz >= (current_setting('s299.page2')::jsonb#>>'{details,0,happenedAt}')::timestamptz,'detail pages are newest first');
select is(pg_temp.s299_report()#>>'{coverage,status}','unconfirmed','accepted totals do not invent proof of complete device registration');
select is(pg_temp.s299_report()#>>'{coverage,automaticRetentionDays}',null,'30-day late ingress is not misreported as retention');
select is(pg_temp.s299_report()->'qrScans','null'::jsonb,'SPN-03 no measured QR source means unavailable');
select is(pg_temp.s299_report()->'completedPlays','null'::jsonb,'accepted duration is not invented proof of a complete play');
select is(pg_temp.s299_report()->'historicalScreenGroupsAvailable','false'::jsonb,'current group membership is never used as historical group evidence');
select is(jsonb_array_length(pg_temp.s299_report()->'goals'),0,'SPN-03 missing explicit agreement remains absent');

-- Retry and invalid inputs exercise the real device boundary, unchanged by S299.
reset role;
select set_config('s299.original_event',(select jsonb_build_object('eventId',event_id,'planRevisionId',plan_revision_id,'sponsorId',sponsor_id,'campaignId',campaign_id,'creativeId',creative_id,'positionId',position_id,'happenedAt',happened_at,'playedMs',played_ms,'context',context_json)::text from public.sponsor_play_events where event_id='52990000-0000-4000-8000-000000000001'),true);
set local role anon;
select is(public.record_sponsor_play_events_v1(repeat('b',64),jsonb_build_array(current_setting('s299.original_event')::jsonb)),0,'SPN-02 repeated delivery UUID counts once');
select is(public.record_sponsor_play_events_v1(repeat('b',64),jsonb_build_array(current_setting('s299.original_event')::jsonb||jsonb_build_object('eventId',gen_random_uuid(),'playedMs',3600001))),0,'SPN-02 invalid duration does not become accepted data');
select is(public.record_sponsor_play_events_v1(repeat('b',64),jsonb_build_array(current_setting('s299.original_event')::jsonb||jsonb_build_object('eventId',gen_random_uuid(),'happenedAt',now()-interval '31 days'))),0,'SPN-02 event outside existing ingress allowance is rejected');
select throws_ok($$select pg_temp.s299_report()$$,'42501','permission denied for function get_sponsor_report_v1','anonymous cannot call report API');
reset role;
-- A later receipt is controlled explicitly because all fixture RPCs share one
-- transaction's now(); production deliveries each have their own transaction.
insert into public.sponsor_play_events select '52990000-0000-4000-8000-000000009001',tenant_id,device_id,screen_id,plan_revision_id,sponsor_id,campaign_id,creative_id,position_id,now()-interval '2 days',8000,context_json,now()+interval '2 seconds' from public.sponsor_play_events where event_id='52990000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select is(pg_temp.s299_report()#>>'{totals,acceptedEvents}','5501','fixed receipt cutoff excludes a later offline delivery');
select is(pg_temp.s299_report(null,null,now()+interval '3 seconds')#>>'{totals,acceptedEvents}','5502','new cutoff includes the late receipt by its historical event time');
select is(pg_temp.s299_report(null,null,now()+interval '3 seconds')#>>'{totals,playedMs}','5517251','late receipt updates complete duration transparently');

select lives_ok($$select public.set_sponsor_report_goal_v1('10000000-0000-4000-8000-000000001151',(select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001151'),current_setting('s299.from')::date,current_setting('s299.until')::date,6000)$$,'SPN-03 authorized writer stores an explicit campaign/period goal');
select is(pg_temp.s299_report()#>>'{goals,0,targetPlays}','6000','explicit agreement has its own count, separate from actual plays');
select is(pg_temp.s299_report(null,'30000000-0000-4000-8000-000000001152')#>>'{goals,0,targetPlays}','6000','campaign goal remains explicitly all-screen, never inferred from a screen filter');
select throws_ok($$select pg_temp.s299_report((select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001153'))$$,'42501','sponsor report filter is not authorized','tenant A cannot choose tenant B campaign');
select throws_ok($$select pg_temp.s299_report(null,'30000000-0000-4000-8000-000000001153')$$,'42501','sponsor report filter is not authorized','tenant A cannot choose tenant B screen');
select throws_ok($$select public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001153',current_date-7,current_date+1)$$,'42501','missing sponsor capability','SPN-04 tenant A cannot request tenant B aggregate');
select throws_ok($$select public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_date,current_date)$$,'22023','invalid sponsor report period, cutoff or cursor','empty/inverted periods fail closed');
select throws_ok($$select pg_temp.s299_report(null,null,now()+interval '2 minutes')$$,'22023','invalid sponsor report period, cutoff or cursor','future receipt cutoffs are bounded');
select throws_ok($$select pg_temp.s299_report(null,null,null,now(),null)$$,'22023','invalid sponsor report period, cutoff or cursor','incomplete cursor cannot silently broaden results');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001154',true);
select is(pg_temp.s299_report()#>>'{totals,acceptedEvents}','5501','existing sponsor report committee can read exact totals');
select throws_ok($$select public.set_sponsor_report_goal_v1('10000000-0000-4000-8000-000000001151',(select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001151'),current_date-1,current_date+1,2)$$,'42501','missing sponsor capability','report-only committee cannot write agreements');
reset role;
update public.tenant_custom_roles set capabilities=array['tenant.sponsor.read'] where id='90000000-0000-4000-8000-000000001154';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001154',true);
select throws_ok($$select pg_temp.s299_report()$$,'42501','missing sponsor capability','ordinary read-only sponsor role without report permission cannot aggregate/export');
select is((select count(*) from public.sponsor_campaign_report_goals),0::bigint,'goal RLS does not leak to an unauthorized reader');
reset role;
update public.tenant_custom_roles set capabilities=array['tenant.sponsor.report'] where id='90000000-0000-4000-8000-000000001154';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001154',true);
select throws_ok($$select pg_temp.s299_report()$$,'42501','missing sponsor capability','report-only role cannot bypass dashboard read permission to read labels');
select is((select count(*) from public.sponsor_campaign_report_goals),0::bigint,'report-only role cannot bypass dashboard read permission to read agreements');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001153',true);
select is((select count(*) from public.sponsor_campaign_report_goals),0::bigint,'tenant B cannot read tenant A goal');
select is(public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001153',current_setting('s299.from')::date,current_setting('s299.until')::date)#>>'{totals,acceptedEvents}','1','tenant B sees only its own accepted event');

reset role;
insert into private.sponsor_report_gaps(tenant_id,starts_at,ends_at,reason)
values('10000000-0000-4000-8000-000000001151',now()-interval '4 days',now()-interval '3 days','retention');
update public.screens set deleted_at=now(),status='disabled' where id='30000000-0000-4000-8000-000000001152';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select is(pg_temp.s299_report(null,null,now()+interval '3 seconds')#>>'{coverage,status}','partial','known retention/registration gap marks selected period incomplete');
select is(pg_temp.s299_report(null,null,now()+interval '3 seconds')#>>'{coverage,gaps,0,reason}','retention','gap is explicit report evidence, not inferred from missing plays');
select is(pg_temp.s299_report(null,'30000000-0000-4000-8000-000000001152')#>>'{totals,acceptedEvents}','1833','soft-deleted screen keeps authorized historical event totals');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s299_report()->'groups') g where g->>'screenId'='30000000-0000-4000-8000-000000001152' and (g->>'screenDeleted')::boolean),'deleted screen label accompanies preserved history');
select throws_ok($$update public.sponsor_campaign_report_goals set target_plays=1$$,'42501','permission denied for table sponsor_campaign_report_goals','goals have no direct mutation ACL');
reset role;
select set_config('request.jwt.claim.aal','aal2',true);
update public.tenants set status='paused' where id='10000000-0000-4000-8000-000000001151';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select throws_ok($$select public.set_sponsor_report_goal_v1('10000000-0000-4000-8000-000000001151',(select (info->>'campaign1')::uuid from s299_fixture where tenant_id='10000000-0000-4000-8000-000000001151'),current_date-1,current_date+1,2)$$,'42501','tenant is not writable','paused tenant cannot modify agreements');
select is(pg_temp.s299_report()#>>'{totals,acceptedEvents}','5501','paused tenant preserves read-only report access');
reset role;

-- Real tenant-local boundaries, including both DST days, never use 24h math.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select is(extract(epoch from ((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151','2026-03-29','2026-03-30')#>>'{period,until}')::timestamptz-(public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151','2026-03-29','2026-03-30')#>>'{period,from}')::timestamptz))::integer,82800,'spring DST report day has 23 hours');
select is(extract(epoch from ((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151','2026-10-25','2026-10-26')#>>'{period,until}')::timestamptz-(public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151','2026-10-25','2026-10-26')#>>'{period,from}')::timestamptz))::integer,90000,'autumn DST report day has 25 hours');
select is(pg_temp.s299_report()#>>'{timezone}','Europe/Amsterdam','dashboard and export receive the authoritative tenant timezone');
select ok(not (pg_temp.s299_report()::text like '%device_id%' or pg_temp.s299_report()::text like '%token_hash%' or pg_temp.s299_report()::text like '%context_json%'),'report exposes neither raw player identities nor raw event context');

-- Two exactly bounded historical events use controlled receipt times so they
-- do not alter the earlier frozen-cutoff fixtures.
select set_config('s299.bound_day',((now() at time zone 'Europe/Amsterdam')::date-6)::text,true);
select set_config('s299.bound_next',((now() at time zone 'Europe/Amsterdam')::date-5)::text,true);
select set_config('s299.bound_count',public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_day')::date,current_setting('s299.bound_next')::date,null,null,now()+interval '5 seconds')#>>'{totals,acceptedEvents}',true);
select set_config('s299.adjacent_count',public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_next')::date,current_setting('s299.bound_next')::date+1,null,null,now()+interval '5 seconds')#>>'{totals,acceptedEvents}',true);
reset role;
insert into public.sponsor_play_events select '52990000-0000-4000-8000-000000009002',tenant_id,device_id,screen_id,plan_revision_id,sponsor_id,campaign_id,creative_id,position_id,current_setting('s299.bound_day')::date::timestamp at time zone 'Europe/Amsterdam',7,context_json,now()+interval '4 seconds' from public.sponsor_play_events where event_id='52990000-0000-4000-8000-000000000001';
insert into public.sponsor_play_events select '52990000-0000-4000-8000-000000009003',tenant_id,device_id,screen_id,plan_revision_id,sponsor_id,campaign_id,creative_id,position_id,current_setting('s299.bound_next')::date::timestamp at time zone 'Europe/Amsterdam',11,context_json,now()+interval '4 seconds' from public.sponsor_play_events where event_id='52990000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);
select is((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_day')::date,current_setting('s299.bound_next')::date,null,null,now()+interval '5 seconds')#>>'{totals,acceptedEvents}')::bigint,current_setting('s299.bound_count')::bigint+1,'SPN-02 inclusive lower boundary counts exactly one boundary event');
select is((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_next')::date,current_setting('s299.bound_next')::date+1,null,null,now()+interval '5 seconds')#>>'{totals,acceptedEvents}')::bigint,current_setting('s299.adjacent_count')::bigint+1,'SPN-02 exclusive upper boundary belongs to the following report');
select is((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_day')::date,current_setting('s299.bound_next')::date,null,null,now()+interval '5 seconds')#>>'{period,from}')::timestamptz,current_setting('s299.bound_day')::date::timestamp at time zone 'Europe/Amsterdam','period lower bound is local midnight');
select is((public.get_sponsor_report_v1('10000000-0000-4000-8000-000000001151',current_setting('s299.bound_day')::date,current_setting('s299.bound_next')::date,null,null,now()+interval '5 seconds')#>>'{period,until}')::timestamptz,current_setting('s299.bound_next')::date::timestamp at time zone 'Europe/Amsterdam','period upper bound is exclusive local midnight');

select * from finish();
rollback;

