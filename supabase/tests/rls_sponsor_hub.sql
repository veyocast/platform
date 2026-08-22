begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);

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

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001151',true);

select is(public.ensure_sponsor_positions_v1('10000000-0000-4000-8000-000000001151'),6,'writer initializes all six semantic sponsor positions');
select ok((public.create_sponsor_v1('10000000-0000-4000-8000-000000001151','Lokale held',null,null)->>'sponsorId')::uuid is not null,'writer creates a tenant sponsor');
select ok((public.create_sponsor_campaign_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsors where name='Lokale held'),
  'Seizoenscampagne',now()-interval '1 day',now()+interval '30 days',2
)->>'campaignId')::uuid is not null,'writer creates a campaign and creative set');
select ok((public.register_sponsor_media_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsors where name='Lokale held'),
  '20000000-0000-4000-8000-000000001151'
)->>'sponsorMediaId')::uuid is not null,'ready tenant media is explicitly scoped to the sponsor workspace');
select ok((public.add_sponsor_creative_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsor_campaigns where name='Seizoenscampagne'),
  '20000000-0000-4000-8000-000000001151','footer','landscape',8
)->>'creativeId')::uuid is not null,'ready media becomes a checksum-pinned creative revision');
select ok((public.place_sponsor_campaign_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsor_campaigns where name='Seizoenscampagne'),
  (select id from public.sponsor_positions where key='footer'),'landscape'
)->>'placementId')::uuid is not null,'campaign is assigned to a semantic position pool');
select lives_ok($$select public.submit_sponsor_campaign_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsor_campaigns where name='Seizoenscampagne'))$$,
  'complete campaign can be submitted');
select throws_ok($$select public.approve_sponsor_campaign_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsor_campaigns where name='Seizoenscampagne'),true)$$,
  '42501','four-eyes approval requires another user','submitter cannot approve own revision');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001152',true);
select lives_ok($$select public.approve_sponsor_campaign_v1(
  '10000000-0000-4000-8000-000000001151',(select id from public.sponsor_campaigns where name='Seizoenscampagne'),true)$$,
  'a different authorized user approves the campaign');
select is((public.publish_sponsor_plan_v1('10000000-0000-4000-8000-000000001151',null,14)->>'targetCount')::integer,1,'approved campaign publishes to the active screen');
select ok((select plan_json->'placements'->0->>'positionKey' from public.sponsor_plan_revisions)='footer','immutable plan contains semantic position and pinned campaign payload');
select throws_ok($$update public.sponsor_plan_revisions set plan_json='{}' where tenant_id='10000000-0000-4000-8000-000000001151'$$,
  '42501','permission denied for table sponsor_plan_revisions','published plans expose no human mutation ACL');
select set_config('sponsor_test.plan_id',(select id::text from public.sponsor_plan_revisions limit 1),false);
select set_config('sponsor_test.sponsor_id',(select id::text from public.sponsors limit 1),false);
select set_config('sponsor_test.campaign_id',(select id::text from public.sponsor_campaigns limit 1),false);
select set_config('sponsor_test.creative_id',(select id::text from public.sponsor_creatives limit 1),false);
select set_config('sponsor_test.position_id',(select id::text from public.sponsor_positions where key='footer'),false);

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001153',true);
select is((select count(*) from public.sponsors),0::bigint,'tenant B cannot read tenant A sponsors');
select is((select count(*) from public.sponsor_plan_revisions),0::bigint,'tenant B cannot read tenant A plans');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001154',true);
select is(public.get_my_tenant_capabilities_v1('10000000-0000-4000-8000-000000001151'),array['tenant.sponsor.read','tenant.sponsor.report']::text[],'sponsor-only custom role receives no Publisher baseline capabilities');
select is((select count(*) from public.sponsors),1::bigint,'sponsor committee can read only its tenant sponsor workspace');

reset role; set local role anon;
select is(public.record_sponsor_play_events_v1(repeat('b',64),jsonb_build_array(jsonb_build_object(
  'eventId','50000000-0000-4000-8000-000000001151','planRevisionId',current_setting('sponsor_test.plan_id'),
  'sponsorId',current_setting('sponsor_test.sponsor_id'),'campaignId',current_setting('sponsor_test.campaign_id'),
  'creativeId',current_setting('sponsor_test.creative_id'),'positionId',current_setting('sponsor_test.position_id'),
  'happenedAt',now(),'playedMs',8000,'context','{}'::jsonb
))),1,'paired player records a validated Proof of Play event');
select is(public.record_sponsor_play_events_v1(repeat('b',64),jsonb_build_array(jsonb_build_object(
  'eventId','50000000-0000-4000-8000-000000001151','planRevisionId',current_setting('sponsor_test.plan_id'),
  'sponsorId',current_setting('sponsor_test.sponsor_id'),'campaignId',current_setting('sponsor_test.campaign_id'),
  'creativeId',current_setting('sponsor_test.creative_id'),'positionId',current_setting('sponsor_test.position_id'),
  'happenedAt',now(),'playedMs',8000,'context','{}'::jsonb
))),0,'event UUID makes Proof of Play batches idempotent');

select * from finish();
rollback;
