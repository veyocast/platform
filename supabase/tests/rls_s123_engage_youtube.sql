begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(40);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000001251','authenticated','authenticated','engage-admin@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000001252','authenticated','authenticated','engage-viewer@veyocast.test','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000001253','authenticated','authenticated','engage-other@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000001251','Engage admin'),
 ('00000000-0000-4000-8000-000000001252','Engage viewer'),
 ('00000000-0000-4000-8000-000000001253','Other admin');
insert into public.tenants(id,name,slug,screen_limit) values
 ('10000000-0000-4000-8000-000000001251','Engage tenant','engage-tenant',5),
 ('10000000-0000-4000-8000-000000001252','Other tenant','engage-other',5);
insert into public.tenant_settings(tenant_id) values
 ('10000000-0000-4000-8000-000000001251'),('10000000-0000-4000-8000-000000001252');
insert into public.tenant_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000001251','00000000-0000-4000-8000-000000001251','tenant_admin'),
 ('10000000-0000-4000-8000-000000001251','00000000-0000-4000-8000-000000001252','tenant_viewer'),
 ('10000000-0000-4000-8000-000000001252','00000000-0000-4000-8000-000000001253','tenant_admin');
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason) values
 ('10000000-0000-4000-8000-000000001251','engage',true,'Gecontroleerde interne Engage pilot'),
 ('10000000-0000-4000-8000-000000001251','youtube_integration',true,'Gecontroleerde YouTube pilot');
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at) values
 ('20000000-0000-4000-8000-000000001251','10000000-0000-4000-8000-000000001251','00000000-0000-4000-8000-000000001251','image','Offline fallback','fallback.webp','image/webp','ready','tenant-media','tenants/10000000-0000-4000-8000-000000001251/assets/20000000-0000-4000-8000-000000001251/original/fallback.webp',2048,repeat('a',64),1920,1080,now());
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height) values
 ('21000000-0000-4000-8000-000000001251','10000000-0000-4000-8000-000000001251','20000000-0000-4000-8000-000000001251','original','tenant-media','tenants/10000000-0000-4000-8000-000000001251/assets/20000000-0000-4000-8000-000000001251/original/fallback.webp','image/webp',2048,repeat('a',64),1920,1080);
insert into public.playlists(id,tenant_id,name,status,created_by,updated_by) values
 ('22000000-0000-4000-8000-000000001251','10000000-0000-4000-8000-000000001251','YouTube scherm','draft','00000000-0000-4000-8000-000000001251','00000000-0000-4000-8000-000000001251');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001251',true);

select ok((public.save_engage_campaign_v1(
  '10000000-0000-4000-8000-000000001251',null,'motm','Man van de wedstrijd',
  'Wie was vandaag de uitblinker?','after_vote',now()-interval '1 minute',now()+interval '1 hour',
  '[{"label":"Speler 1"},{"label":"Speler 2"},{"label":"Speler 3"}]'::jsonb
)->>'campaignId')::uuid is not null,'admin creates an Engage draft through the guarded command');
select is((select count(*) from public.engage_options),3::bigint,'campaign options are tenant-scoped children');
select throws_ok($$insert into public.engage_campaigns(tenant_id,kind,title,question)
 values('10000000-0000-4000-8000-000000001251','poll','Direct poll','Should fail')$$,
 '42501','permission denied for table engage_campaigns','direct Engage writes are denied');
select lives_ok($$select public.transition_engage_campaign_v1(
 '10000000-0000-4000-8000-000000001251',(select id from public.engage_campaigns),'live')$$,
 'admin can start a complete draft');
select is((select status from public.engage_campaigns),'live','campaign lifecycle becomes live');
select ok(public.save_youtube_source_v1(
 '10000000-0000-4000-8000-000000001251',null,'dQw4w9WgXcQ','Clubvideo','Clubkanaal',
 '20000000-0000-4000-8000-000000001251',true,'verified',null) is not null,
 'admin saves verified online-only YouTube metadata with local fallback');
select is((select online_only from public.youtube_sources),true,'YouTube source is structurally online-only');
select is((public.add_youtube_source_to_playlist_v1(
  '22000000-0000-4000-8000-000000001251',
  (select id from public.youtube_sources where tenant_id='10000000-0000-4000-8000-000000001251'),
  0,30,'23000000-0000-4000-8000-000000001251'
)->>'outcome'),'applied','verified YouTube source is added through an idempotent playlist command');
select is((select media_asset_id from public.playlist_items
  where playlist_id='22000000-0000-4000-8000-000000001251'),
  '20000000-0000-4000-8000-000000001251'::uuid,
  'playlist item keeps the ready local fallback as its cacheable media source');
select is((public.add_engage_campaign_to_playlist_v1(
  '22000000-0000-4000-8000-000000001251',
  (select id from public.engage_campaigns where tenant_id='10000000-0000-4000-8000-000000001251'),
  '20000000-0000-4000-8000-000000001251',1,30,
  '23000000-0000-4000-8000-000000001253'
)->>'outcome'),'applied','live Engage campaign is bound through an idempotent playlist command');
select is((select count(*) from public.playlist_items
  where playlist_id='22000000-0000-4000-8000-000000001251'
    and engage_campaign_id is not null),1::bigint,
  'Engage playlist item keeps a runtime campaign binding beside its local fallback');
select throws_ok($$select public.save_youtube_source_v1(
 '10000000-0000-4000-8000-000000001251',null,'dQw4w9WgXcQ','Geen fallback','Club',
 '20000000-0000-4000-8000-000000009999',true,'verified',null)$$,
 '23514','invalid youtube source input','a missing local fallback fails closed');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001252',true);
select is((select count(*) from public.engage_campaigns),1::bigint,'tenant viewer can read enabled Engage campaigns');
select throws_ok($$select public.transition_engage_campaign_v1(
 '10000000-0000-4000-8000-000000001251',(select id from public.engage_campaigns),'closed')$$,
 '42501','engage rollout and write capability required','tenant viewer cannot mutate campaign lifecycle');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001253',true);
select is((select count(*) from public.engage_campaigns),0::bigint,'another tenant cannot read Engage campaigns');
select is((select count(*) from public.youtube_sources),0::bigint,'another tenant cannot read YouTube sources');
select throws_ok($$select public.save_engage_campaign_v1(
 '10000000-0000-4000-8000-000000001251',null,'poll','Cross tenant','Should fail',
 'live',null,null,'[{"label":"One"},{"label":"Two"}]'::jsonb)$$,
 '42501','engage rollout and write capability required','cross-tenant Engage writes fail closed');
select throws_ok($$select public.add_youtube_source_to_playlist_v1(
 '22000000-0000-4000-8000-000000001251',
 (select id from public.youtube_sources limit 1),1,30,
 '23000000-0000-4000-8000-000000001252')$$,
 '42501','youtube rollout and playlist write capability required',
 'cross-tenant users cannot bind YouTube sources to a playlist');

reset role;
insert into public.playlist_releases(
  id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,
  total_duration_seconds,total_bytes,published_by
) values (
  '24000000-0000-4000-8000-000000001251','10000000-0000-4000-8000-000000001251',
  '22000000-0000-4000-8000-000000001251',1,repeat('d',64),'{}',2,60,4096,
  '00000000-0000-4000-8000-000000001251'
);
insert into public.playlist_release_items(
  tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,
  sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_bucket,
  storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
) select item.tenant_id,item.playlist_id,'24000000-0000-4000-8000-000000001251',item.id,
  item.media_asset_id,'21000000-0000-4000-8000-000000001251',item.sort_order,30,'cover',true,
  'image','Offline fallback','tenant-media',
  'tenants/10000000-0000-4000-8000-000000001251/assets/20000000-0000-4000-8000-000000001251/original/fallback.webp',
  'image/webp',2048,repeat('a',64),1920,1080
from public.playlist_items item where item.playlist_id='22000000-0000-4000-8000-000000001251';
select is((select youtube_video_id from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001251'
    and youtube_source_id is not null),'dQw4w9WgXcQ',
  'published release materializes the immutable provider video ID');
select is((select youtube_title from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001251'
    and youtube_source_id is not null),'Clubvideo',
  'published release materializes the immutable provider title');
select is((select engage_public_id from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001251'
    and engage_campaign_id is not null),
  (select public_id from public.engage_campaigns where tenant_id='10000000-0000-4000-8000-000000001251'),
  'published release freezes the campaign binding while vote totals stay live');
update public.youtube_sources set title='Nieuwere bronnaam'
where tenant_id='10000000-0000-4000-8000-000000001251';
select is((select youtube_title from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001251'
    and youtube_source_id is not null),'Clubvideo',
  'historical release metadata does not mutate when the source changes');
update public.engage_campaigns set question='Een later aangepaste vraag'
where tenant_id='10000000-0000-4000-8000-000000001251';
select is((select engage_question from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001251'
    and engage_campaign_id is not null),'Wie was vandaag de uitblinker?',
  'historical Engage release configuration stays immutable after campaign edits');

insert into public.playlist_releases(
  id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,
  total_duration_seconds,total_bytes,published_by
) values (
  '24000000-0000-4000-8000-000000001252','10000000-0000-4000-8000-000000001251',
  '22000000-0000-4000-8000-000000001251',2,repeat('e',64),'{}',2,60,4096,
  '00000000-0000-4000-8000-000000001251'
);
insert into public.playlist_release_items(
  tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,
  sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_bucket,
  storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,
  youtube_source_id,youtube_video_id,youtube_title,youtube_online_only,
  engage_campaign_id,engage_public_id,engage_title,engage_question
) select
  item.tenant_id,item.playlist_id,'24000000-0000-4000-8000-000000001252',null,
  item.media_asset_id,item.media_variant_id,item.sort_order,item.duration_seconds,
  item.fit_mode,item.muted,item.asset_kind,item.asset_title,item.storage_bucket,
  item.storage_path,item.mime_type,item.file_size_bytes,item.checksum_sha256,
  item.width,item.height,item.youtube_source_id,item.youtube_video_id,
  item.youtube_title,item.youtube_online_only,item.engage_campaign_id,
  item.engage_public_id,item.engage_title,item.engage_question
from public.playlist_release_items item
where item.release_id='24000000-0000-4000-8000-000000001251';
select is((select youtube_title from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001252'
    and youtube_source_id is not null),'Clubvideo',
  'an automatic branch clone preserves its exact frozen YouTube metadata');
select is((select engage_question from public.playlist_release_items
  where release_id='24000000-0000-4000-8000-000000001252'
    and engage_campaign_id is not null),'Wie was vandaag de uitblinker?',
  'an automatic branch clone preserves its exact frozen Engage metadata');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001251',true);
select set_config('engage_test.public_id',(select public_id::text from public.engage_campaigns limit 1),true);
set local role anon;
select ok(public.get_engage_campaign_public_v1(
 current_setting('engage_test.public_id')::uuid) is not null,
 'anonymous audience can read only the bounded live campaign projection');
select is((public.get_engage_campaign_public_v1(
 current_setting('engage_test.public_id')::uuid)->>'resultsVisible')::boolean,false,
 'after-vote results are private before a vote');
select throws_ok($$select public.submit_engage_vote_v1(
 current_setting('engage_test.public_id')::uuid,
 '30000000-0000-4000-8000-000000001251',repeat('b',64),repeat('c',64))$$,
 '42501','permission denied for function submit_engage_vote_v1','anonymous clients cannot bypass the rate-limited vote endpoint');

set local role service_role;
select is((public.submit_engage_vote_v1(
 current_setting('engage_test.public_id')::uuid,
 (select id from public.engage_options where tenant_id='10000000-0000-4000-8000-000000001251' order by sort_order limit 1),repeat('b',64),repeat('c',64))->>'accepted')::boolean,true,
 'trusted vote adapter records one pseudonymous vote');
select is((public.submit_engage_vote_v1(
 current_setting('engage_test.public_id')::uuid,
 (select id from public.engage_options where tenant_id='10000000-0000-4000-8000-000000001251' order by sort_order desc limit 1),repeat('b',64),repeat('c',64))->>'reason'),
 'already_voted','same pseudonymous identity cannot vote twice in one campaign');
select is((public.get_engage_campaign_for_identity_v1(
 current_setting('engage_test.public_id')::uuid,repeat('b',64))->>'resultsVisible')::boolean,true,
 'trusted identity projection reveals after-vote results to that participant');
select is((select count(*) from public.engage_votes where tenant_id='10000000-0000-4000-8000-000000001251'),1::bigint,'duplicate vote remains idempotent');
select is((select count(*) from public.engage_audit_events where tenant_id='10000000-0000-4000-8000-000000001251'),2::bigint,'management lifecycle is append-only audited');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001251',true);
select is((public.transition_engage_campaign_v2(
  '10000000-0000-4000-8000-000000001251',
  (select id from public.engage_campaigns where tenant_id='10000000-0000-4000-8000-000000001251'),
  'closed','40000000-0000-4000-8000-000000001251'
)->>'outcome'),'applied','mobile lifecycle command applies once');
select is((public.transition_engage_campaign_v2(
  '10000000-0000-4000-8000-000000001251',
  (select id from public.engage_campaigns where tenant_id='10000000-0000-4000-8000-000000001251'),
  'closed','40000000-0000-4000-8000-000000001251'
)->>'outcome'),'replayed','mobile lifecycle command replays the durable receipt');
select is((select status from public.engage_campaigns
  where tenant_id='10000000-0000-4000-8000-000000001251'),'closed',
  'mobile lifecycle closes the intended tenant campaign');
select throws_ok($$select public.transition_engage_campaign_v2(
  '10000000-0000-4000-8000-000000001251',
  (select id from public.engage_campaigns where tenant_id='10000000-0000-4000-8000-000000001251'),
  'live','40000000-0000-4000-8000-000000001251')$$,
  '22023','idempotency key belongs to another engage command',
  'an Engage idempotency key cannot be reused for another payload');
select is((select count(*) from public.engage_audit_events
  where tenant_id='10000000-0000-4000-8000-000000001251'),3::bigint,
  'a replay does not duplicate lifecycle audit events');
select is((select total_votes from public.get_engage_campaign_metrics_v1(
  '10000000-0000-4000-8000-000000001251')),1::bigint,
  'bounded campaign metrics expose only the tenant vote total');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001253',true);
select throws_ok($$select * from public.get_engage_campaign_metrics_v1(
  '10000000-0000-4000-8000-000000001251')$$,
  '42501','engage rollout and read capability required',
  'another tenant cannot request campaign metrics');

select * from finish();
rollback;
