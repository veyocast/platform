begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values
('00000000-0000-4000-8000-000000001751','authenticated','authenticated',
 's175-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001752','authenticated','authenticated',
 's175-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000001751','S175 owner'),
('00000000-0000-4000-8000-000000001752','S175 other owner');
insert into public.tenants(id,name,slug,screen_limit) values
('10000000-0000-4000-8000-000000001751','S175 tenant','s175-tenant',2),
('10000000-0000-4000-8000-000000001752','S175 other tenant','s175-other-tenant',1);
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000001751'),
('10000000-0000-4000-8000-000000001752');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000001751','00000000-0000-4000-8000-000000001751','tenant_owner'),
('10000000-0000-4000-8000-000000001752','00000000-0000-4000-8000-000000001752','tenant_owner');
insert into public.tenant_feature_flags(
  tenant_id,flag_key,enabled,rollout_reason,changed_by
) values
('10000000-0000-4000-8000-000000001751','ledscores_realtime',true,
 'S175 canvas test','00000000-0000-4000-8000-000000001751'),
('10000000-0000-4000-8000-000000001752','ledscores_realtime',true,
 'S175 cross-tenant test','00000000-0000-4000-8000-000000001752');
insert into public.screen_groups(id,tenant_id,name,created_by,updated_by) values
('31000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751',
 'Canvasdoelgroep','00000000-0000-4000-8000-000000001751','00000000-0000-4000-8000-000000001751');
insert into public.screens(id,tenant_id,name,orientation,status,created_by) values
('30000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751',
 'S175 Player','landscape','active','00000000-0000-4000-8000-000000001751');
insert into public.screen_group_memberships(
  tenant_id,screen_group_id,screen_id,created_by
) values (
  '10000000-0000-4000-8000-000000001751','31000000-0000-4000-8000-000000001751',
  '30000000-0000-4000-8000-000000001751','00000000-0000-4000-8000-000000001751'
);
insert into public.player_devices(
  id,tenant_id,screen_id,device_name,token_hash,status
) values (
  '40000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751',
  '30000000-0000-4000-8000-000000001751','S175 canvas Player',repeat('8',64),'paired'
);

insert into public.media_assets(
  id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,
  storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,
  duration_seconds,processed_at
) values
('20000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751',
 '00000000-0000-4000-8000-000000001751','image','S175 patroon','patroon.png',
 'image/png','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000001751/assets/20000000-0000-4000-8000-000000001751/original/patroon.png',
 4096,repeat('1',64),1920,1080,null,now()),
('20000000-0000-4000-8000-000000001753','10000000-0000-4000-8000-000000001751',
 '00000000-0000-4000-8000-000000001751','video','S175 achtergrond','achtergrond.mp4',
 'video/mp4','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000001751/assets/20000000-0000-4000-8000-000000001753/original/achtergrond.mp4',
 8192,repeat('2',64),1920,1080,8,now()),
('20000000-0000-4000-8000-000000001752','10000000-0000-4000-8000-000000001752',
 '00000000-0000-4000-8000-000000001752','image','Andere tenant','ander.png',
 'image/png','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000001752/assets/20000000-0000-4000-8000-000000001752/original/ander.png',
 4096,repeat('3',64),1920,1080,null,now());
insert into public.media_variants(
  id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,
  file_size_bytes,checksum_sha256,width,height,duration_seconds
) values (
  '21000000-0000-4000-8000-000000001753','10000000-0000-4000-8000-000000001751',
  '20000000-0000-4000-8000-000000001753','player_1080p','tenant-media',
  'tenants/10000000-0000-4000-8000-000000001751/assets/20000000-0000-4000-8000-000000001753/player/achtergrond.mp4',
  'video/mp4',8192,repeat('2',64),1920,1080,8
);


insert into public.dynamic_data_sources(id,tenant_id,kind,name,created_by,updated_by) values ('70000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751','sportlink','S175 Sportlink','00000000-0000-4000-8000-000000001751','00000000-0000-4000-8000-000000001751');
insert into public.sportlink_connections(id,tenant_id,data_source_id,client_id_suffix,encrypted_client_id,encryption_iv,encryption_tag) values ('71000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751','70000000-0000-4000-8000-000000001751','test175','fixture-only-encrypted','fixture-only-iv','fixture-only-tag');
insert into public.sports_clubs(id,tenant_id,source_connection_id,external_id,name) values ('72000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751','71000000-0000-4000-8000-000000001751','club-213','Duindorp SV');
insert into public.sports_teams(id,tenant_id,source_connection_id,external_id,name,category) values ('73000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751','71000000-0000-4000-8000-000000001751','teamcode-99','Sportlink team 2','Senioren');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001751',true);
select is((public.save_ledscores_connection_v1('10000000-0000-4000-8000-000000001751',null,'Clubkoppeling','duindorp-sv','active',0)->>'outcome'),'saved','create tenant source');
select set_config('test.connection',(select id::text from public.ledscores_connections where tenant_id='10000000-0000-4000-8000-000000001751'),true);
select is((public.link_ledscores_club_v2('10000000-0000-4000-8000-000000001751',current_setting('test.connection')::uuid,'72000000-0000-4000-8000-000000001751',1)->>'outcome'),'saved','explicitly bind the VeyoCast club');
select throws_ok($$select public.link_ledscores_club_v2('10000000-0000-4000-8000-000000001751',current_setting('test.connection')::uuid,'72000000-0000-4000-8000-000000001752',2)$$,'23514',null,'unavailable club ID cannot be linked');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select count(*) from public.claim_ledscores_connections_v1('worker:s175',45,10);
select set_config('test.catalog','[{"teamKey":"29643","teamName":"Duindorp SV 1","sourceName":"ZA1","side":"own","active":true},{"teamKey":"29644","teamName":"Duindorp SV 2","sportlinkTeamCode":"teamcode-99","side":"own","active":true},{"teamKey":"29646","teamName":"Duindorp SV JO19-1","side":"own","active":true},{"teamKey":"30000","teamName":"VUC 2","side":"opponent","active":true}]',true);
select is(public.sync_ledscores_club_catalog_v2(current_setting('test.connection')::uuid,'worker:s175','213','duindorp-sv','Duindorp SV',current_setting('test.catalog')::jsonb),4,'source catalog discovers four identities');
select is((select provider_club_id from public.ledscores_connections where id=current_setting('test.connection')::uuid),'213','provider club ID is persisted');
select throws_ok($$select public.sync_ledscores_club_catalog_v2(current_setting('test.connection')::uuid,'worker:s175','214','duindorp-sv','Wrong club','[]')$$,'23514',null,'club identity cannot be rebound');
select throws_ok($$select public.sync_ledscores_club_catalog_v2(current_setting('test.connection')::uuid,'other-worker','213','duindorp-sv','Duindorp SV','[]')$$,'42501',null,'catalog requires active worker lease');
select is(public.sync_ledscores_club_catalog_v2(current_setting('test.connection')::uuid,'worker:s175','213','duindorp-sv','Duindorp SV',current_setting('test.catalog')::jsonb||'[{"teamKey":"new-team","teamName":"New youth team","side":"own","active":true,"category":"Jeugd"}]'),5,'new team appears without an application update');
select is((select sports_team_id::text from public.ledscores_team_mappings where connection_id=current_setting('test.connection')::uuid and provider_team_key='29644'),'73000000-0000-4000-8000-000000001751','exact teamcode binds to the explicitly linked local club');
insert into public.ledscores_player_identities(id,tenant_id,connection_id,provider_team_key,provider_player_key,display_name,first_seen_at,last_seen_at) values ('74000000-0000-4000-8000-000000001751','10000000-0000-4000-8000-000000001751',current_setting('test.connection')::uuid,'29644','player-9','Jack Morauw',now(),now());
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok($$select public.set_ledscores_player_photo_v2('10000000-0000-4000-8000-000000001751','74000000-0000-4000-8000-000000001751','20000000-0000-4000-8000-000000001751')$$,'known player can use an existing tenant image');
select throws_ok($$select public.set_ledscores_player_photo_v2('10000000-0000-4000-8000-000000001751','74000000-0000-4000-8000-000000001751','20000000-0000-4000-8000-000000001752')$$,'23514',null,'manual player photo cannot cross tenant boundary');

select set_config('test.config',$json${"schemaVersion":2,"themeMode":"auto","headlineTemplate":"GOAL!","subtitleTemplate":"","goalTextTemplate":"","showScorer":true,"showPlayerPhoto":true,"showShirtNumber":true,"showMinute":true,"showTeamNames":true,"showTeamLogos":true,"showCompetition":false,"showMatchName":false,"showRound":false,"showVenue":false,"lightOuterColor":null,"darkOuterColor":null,"lightCardColor":null,"darkCardColor":null,"lightTextColor":null,"darkTextColor":null,"accentTextColor":null,"font":"display","layout":"centered","radius":28,"spacing":"comfortable","shadow":true,"logoSize":"medium","photoSize":"medium","introEnabled":false,"introLandscapeMediaId":null,"introPortraitMediaId":null,"overlayDurationMs":7000,"enterAnimation":"rise","exitAnimation":"fade","transitionDurationMs":350}$json$,true);

select set_config('test.teams',jsonb_build_array(jsonb_build_object('connectionId',current_setting('test.connection'),'clubId','213','teamKey','29643'),jsonb_build_object('connectionId',current_setting('test.connection'),'clubId','213','teamKey','29644'))::text,true);
select is((public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',null,0,current_setting('test.config')::jsonb,current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])->>'outcome'),'saved','one central overlay accepts multiple teams');
select set_config('test.alert',(select id::text from public.ledscores_goal_alerts where tenant_id='10000000-0000-4000-8000-000000001751' and is_central_goal_overlay),true);
select is((select count(*) from public.ledscores_goal_overlay_draft_teams),2::bigint,'team selection uses two relational rows');
select throws_ok($$select public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',null,0,current_setting('test.config')::jsonb,current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])$$,'23514',null,'second central config cannot be created');
select throws_ok($$select public.save_ledscores_team_mappings_v1('10000000-0000-4000-8000-000000001751',current_setting('test.connection')::uuid,'[]')$$,'23514',null,'legacy editor cannot delete catalog identities');
select throws_ok($$select public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,1,jsonb_set(current_setting('test.config')::jsonb,'{headlineTemplate}','"GOAL {unknown}"'),current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])$$,'23514',null,'database validates template variables');
select throws_ok($$select public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,1,jsonb_set(current_setting('test.config')::jsonb,'{introLandscapeMediaId}','"20000000-0000-4000-8000-000000001752"'),current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])$$,'23514',null,'cross-tenant media cannot be selected');
select is((public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,1,jsonb_set(current_setting('test.config')::jsonb,'{introLandscapeMediaId}','"20000000-0000-4000-8000-000000001753"'),current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])->>'outcome'),'saved','existing ready video asset is reused');
select is((public.publish_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,2,gen_random_uuid())->>'outcome'),'published','publish freezes the central configuration');
select is((select count(*) from public.ledscores_goal_overlay_version_teams where selected),2::bigint,'two selected team IDs are frozen');
select is((select count(*) from public.ledscores_goal_overlay_version_teams),5::bigint,'available opponent logos can be resolved from a frozen catalog');
select set_config('test.version',(select current_published_version_id::text from public.ledscores_goal_alerts where id=current_setting('test.alert')::uuid),true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001752',true);
select is((select count(*) from public.ledscores_goal_overlay_draft_teams),0::bigint,'tenant B cannot read tenant A team selections');
select is((select count(*) from public.ledscores_goal_overlay_version_teams),0::bigint,'tenant B cannot read published tenant A identities');
select throws_ok($$select public.save_ledscores_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,3,current_setting('test.config')::jsonb,current_setting('test.teams')::jsonb,array['31000000-0000-4000-8000-000000001751']::uuid[])$$,'42501',null,'tenant B cannot save tenant A overlay');
select throws_ok($$select public.get_ledscores_team_logos_v2('10000000-0000-4000-8000-000000001751')$$,'42501',null,'tenant B cannot request tenant A logo paths');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.dispatch_ledscores_goal_v1(current_setting('test.connection')::uuid,'worker:s175',repeat('a',64),'event-a','match-a','Duindorp SV 1','VUC 2',1,1,2,1,'own','Jack Morauw','67',clock_timestamp(),'live',null,'home','29643')->>'deliveryCount')::integer,1,'selected home team produces overlay');
select is((public.dispatch_ledscores_goal_v1(current_setting('test.connection')::uuid,'worker:s175',repeat('b',64),'event-b','match-b','VUC 2','Duindorp SV 2',1,1,1,2,'own',null,null,clock_timestamp(),'live',null,'away','29644')->>'deliveryCount')::integer,1,'selected away team produces same engine without scorer/minute');
select is((public.dispatch_ledscores_goal_v1(current_setting('test.connection')::uuid,'worker:s175',repeat('c',64),'event-c','match-c','Duindorp SV JO19-1','VUC 2',1,1,2,1,'own',null,null,clock_timestamp(),'live',null,'home','29646')->>'deliveryCount')::integer,0,'unselected own team does not produce overlay');
select is((public.dispatch_ledscores_goal_v1(current_setting('test.connection')::uuid,'worker:s175',repeat('a',64),'event-a','match-a','Duindorp SV 1','VUC 2',1,1,2,1,'own','Jack Morauw','67',clock_timestamp(),'live',null,'home','29643')->>'outcome'),'duplicate','same event is not dispatched twice');
select is((select count(*) from public.ledscores_player_deliveries where message_kind='goal'),2::bigint,'two distinct goals are available for queueing');
select ok((select bool_and(payload#>>'{goalOverlay,schemaVersion}'='2') from public.ledscores_player_deliveries where message_kind='goal'),'home and away deliveries carry one renderer configuration');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('8',64))->'pendingDeliveries'),2,'reconnect bootstrap retains both fresh goals');
select throws_ok($$update public.ledscores_goal_overlay_version_teams set selected=false where alert_version_id=current_setting('test.version')::uuid$$,'55000',null,'published team selections are immutable');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001751',true);
select is((public.run_ledscores_synthetic_goal_v2('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644','31000000-0000-4000-8000-000000001751','away',1,2,'74000000-0000-4000-8000-000000001751','Testspeler','67')->>'deliveryCount')::integer,1,'test targets selected team and published group');
select is((select count(*) from public.ledscores_goal_events where event_kind='synthetic_test'),1::bigint,'test is explicitly marked synthetic');
select is((select count(*) from public.ledscores_goal_events where event_kind='live'),3::bigint,'test does not add a live goal');
select is((select payload#>>'{player,providerPlayerId}' from public.ledscores_player_deliveries where message_kind='goal' and payload->>'eventKind'='synthetic_test'),'player-9','test inserts known scorer identity in the first realtime delivery');

-- S180: production diagnostics use a real owner operation, never a forged user.
select ok(not has_function_privilege('authenticated','private.run_ledscores_operator_test_v1(uuid,uuid,uuid,text,uuid,text,text,text)','EXECUTE'),'tenant users cannot execute operator probe');
select ok(not has_function_privilege('service_role','private.run_ledscores_operator_test_v1(uuid,uuid,uuid,text,uuid,text,text,text)','EXECUTE'),'workers cannot execute operator probe');
select throws_ok($$select public.dispatch_ledscores_goal_v1(current_setting('test.connection')::uuid,'operator-test:'||repeat('d',40),repeat('d',64),'operator','operator','Team','Test',1,1,2,1,'own',null,null,clock_timestamp(),'live',null,'home','29644')$$,'42501',null,'operator marker cannot grant a tenant user live dispatch');
reset role;
select set_config('request.jwt.claim.role','',true);
select set_config('request.jwt.claim.sub','',true);
select lives_ok($$select private.validate_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.config')::jsonb||'{"introAllowOrientationFallback":true}'::jsonb)$$,'explicit orientation fallback is a supported setting');
select throws_ok($$select private.validate_goal_overlay_v2('10000000-0000-4000-8000-000000001751',current_setting('test.config')::jsonb||'{"introAllowOrientationFallback":"true"}'::jsonb)$$,'23514',null,'orientation fallback rejects non-boolean configuration');
select throws_ok($$select private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001752',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644','31000000-0000-4000-8000-000000001751',repeat('d',40),'S180 decoder verification')$$,'23514',null,'operator cannot mix tenant and alert');
select throws_ok($$select private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29646','31000000-0000-4000-8000-000000001751',repeat('d',40),'S180 decoder verification')$$,'23514',null,'operator cannot target an unselected team');
select throws_ok($$select private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644',gen_random_uuid(),repeat('d',40),'S180 decoder verification')$$,'23514',null,'operator cannot target an unpublished group');
select throws_ok($$select private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644','31000000-0000-4000-8000-000000001751',repeat('d',40),'S180 decoder verification')$$,'P0004',null,'operator retains the existing synthetic rate limit');
-- Advance only this transaction's mutable event fixture beyond the rate window.
update public.ledscores_goal_events set created_at=clock_timestamp()-interval '30 seconds' where event_kind='synthetic_test';
select is((private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644','31000000-0000-4000-8000-000000001751',repeat('d',40),'S180 decoder verification','away')->>'deliveryCount')::integer,1,'real owner probe uses normal published delivery pipeline');
select is((select count(*) from public.ledscores_goal_events where event_kind='live'),3::bigint,'operator probe never changes live statistics');
select is((select count(*) from public.ledscores_goal_events where event_kind='synthetic_test'),2::bigint,'operator probe remains explicitly synthetic');
select is((select count(*) from public.audit_events where action='ledscores.operator.synthetic_test' and metadata->>'deploymentSha'=repeat('d',40)),1::bigint,'operator probe has deployment provenance in audit');
update public.tenants set status='paused' where id='10000000-0000-4000-8000-000000001751';
select throws_ok($$select private.run_ledscores_operator_test_v1('10000000-0000-4000-8000-000000001751',current_setting('test.alert')::uuid,current_setting('test.connection')::uuid,'29644','31000000-0000-4000-8000-000000001751',repeat('d',40),'S180 decoder verification')$$,'P0002',null,'operator probe respects paused tenant lifecycle');
select * from finish();
rollback;
