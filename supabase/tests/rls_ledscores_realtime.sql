begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(54);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values
('00000000-0000-4000-8000-000000001321','authenticated','authenticated',
 'ledscores-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001322','authenticated','authenticated',
 'ledscores-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000001321','LED Scores owner'),
('00000000-0000-4000-8000-000000001322','LED Scores other owner');
insert into public.tenants(id,name,slug,screen_limit) values
('10000000-0000-4000-8000-000000001321','LED Scores tenant','ledscores-tenant',3),
('10000000-0000-4000-8000-000000001322','Other LED Scores tenant','other-ledscores-tenant',1);
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001322');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000001321','00000000-0000-4000-8000-000000001321','tenant_owner'),
('10000000-0000-4000-8000-000000001322','00000000-0000-4000-8000-000000001322','tenant_owner');
insert into public.tenant_feature_flags(
  tenant_id,flag_key,enabled,rollout_reason,changed_by
) values
('10000000-0000-4000-8000-000000001321','ledscores_realtime',true,
 'Controlled RLS integration test rollout','00000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001322','ledscores_realtime',true,
 'Controlled cross-tenant isolation test','00000000-0000-4000-8000-000000001322');
insert into public.screens(id,tenant_id,name,orientation,status,created_by) values
('30000000-0000-4000-8000-000000001321','10000000-0000-4000-8000-000000001321','Kantinescherm','landscape','active','00000000-0000-4000-8000-000000001321'),
('30000000-0000-4000-8000-000000001323','10000000-0000-4000-8000-000000001321','Veldscherm A','landscape','active','00000000-0000-4000-8000-000000001321'),
('30000000-0000-4000-8000-000000001324','10000000-0000-4000-8000-000000001321','Veldscherm B','portrait','active','00000000-0000-4000-8000-000000001321'),
('30000000-0000-4000-8000-000000001322','10000000-0000-4000-8000-000000001322','Ander scherm','landscape','active','00000000-0000-4000-8000-000000001322');
insert into public.screen_groups(id,tenant_id,name,created_by,updated_by) values
('31000000-0000-4000-8000-000000001321','10000000-0000-4000-8000-000000001321','Kantine','00000000-0000-4000-8000-000000001321','00000000-0000-4000-8000-000000001321'),
('32000000-0000-4000-8000-000000001321','10000000-0000-4000-8000-000000001321','Wedstrijddag','00000000-0000-4000-8000-000000001321','00000000-0000-4000-8000-000000001321'),
('31000000-0000-4000-8000-000000001322','10000000-0000-4000-8000-000000001322','Andere groep','00000000-0000-4000-8000-000000001322','00000000-0000-4000-8000-000000001322');
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id,created_by) values
('10000000-0000-4000-8000-000000001321','31000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001321','00000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001321','32000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001321','00000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001321','31000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001323','00000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001321','32000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001324','00000000-0000-4000-8000-000000001321'),
('10000000-0000-4000-8000-000000001322','31000000-0000-4000-8000-000000001322','30000000-0000-4000-8000-000000001322','00000000-0000-4000-8000-000000001322');
insert into public.player_devices(id,tenant_id,screen_id,device_name,token_hash,status) values
('40000000-0000-4000-8000-000000001321','10000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001321','LED Scores player',repeat('c',64),'paired');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001321',true);

select is((public.save_ledscores_connection_v1(
  '10000000-0000-4000-8000-000000001321',null,'Duindorp live','duindorp-sv','active',0
)->>'outcome'),'saved','tenant owner creates a guarded read-only provider connection');
select set_config(
  'test.ledscores_connection_id',
  (select id::text from public.ledscores_connections where tenant_id='10000000-0000-4000-8000-000000001321'),
  false
);
select is((select count(*) from public.ledscores_connections),1::bigint,
  'tenant owner reads only the own connection');
select is((select endpoint_host from public.ledscores_connections),'wss.ledscores.score.tel',
  'connection host remains fixed server-side');
select is(public.save_ledscores_team_mappings_v1(
  '10000000-0000-4000-8000-000000001321',
  current_setting('test.ledscores_connection_id')::uuid,
  '[{"teamKey":"duindorp-sv-1","teamName":"Duindorp sv 1","side":"own"},{"teamKey":"ander-eigen-team","teamName":"Ander eigen team","side":"own"},{"teamKey":"tegenstander-1","teamName":"Tegenstander 1","side":"opponent"}]'::jsonb
),3,'owner stores multiple own teams and an opponent mapping');
select is(public.reserve_ledscores_connection_test_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_connection_id')::uuid
),true,'first connection test reservation succeeds');
select is(public.reserve_ledscores_connection_test_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_connection_id')::uuid
),false,'connection test is rate limited');
select lives_ok($$select public.finish_ledscores_connection_test_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_connection_id')::uuid,
  'success','Schema en eerste read-only bericht gevalideerd.'
)$$,'connection test result is auditable');
select is(public.set_screen_group_memberships_v1(
  '10000000-0000-4000-8000-000000001321','30000000-0000-4000-8000-000000001321',
  array['31000000-0000-4000-8000-000000001321','32000000-0000-4000-8000-000000001321']::uuid[]
),2,'screen detail saves multiple group memberships atomically');
select is((select count(*) from public.screen_group_memberships
  where tenant_id='10000000-0000-4000-8000-000000001321'
    and screen_id='30000000-0000-4000-8000-000000001321'),2::bigint,
  'many-to-many screen targeting persists both groups');
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',null,
  current_setting('test.ledscores_connection_id')::uuid,'Doelpunt hoofdveld',300,8000,'pause',
  '{"schemaVersion":"1","triggerOwn":true,"triggerOpponent":true,"unknownPolicy":"suppress","ownTeamKeys":["duindorp-sv-1"],"activeFrom":null,"activeUntil":null,"ownSoundVolume":70,"opponentSoundVolume":45,"sponsorOnlyOwn":true,"ownDesign":{"headline":"GOAL!","animation":"impact","palette":"electric-orange"},"opponentDesign":{"headline":"Tegendoelpunt","animation":"pulse","palette":"ink-black"},"unknownDesign":{"headline":"GOAL!","animation":"impact","palette":"ink-black"}}'::jsonb,
  array['31000000-0000-4000-8000-000000001321','32000000-0000-4000-8000-000000001321']::uuid[],
  '{}'::uuid[],0
)->>'outcome'),'saved','Studio stores the bounded alert draft');
select set_config(
  'test.ledscores_alert_id',
  (select id::text from public.ledscores_goal_alerts where tenant_id='10000000-0000-4000-8000-000000001321'),
  false
);
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  1,'50000000-0000-4000-8000-000000001321'
)->>'outcome'),'published','Studio publishes an immutable alert version');
select is((select count(*) from public.ledscores_goal_alert_versions),1::bigint,
  'publish creates exactly one immutable version');
select is((select count(*) from public.ledscores_player_deliveries
  where tenant_id='10000000-0000-4000-8000-000000001321'
    and message_kind='configuration'
    and payload->>'reason'='alert_published'),3::bigint,
  'groups A and B yield three unique configuration deliveries despite the overlapping screen');
select throws_ok($$insert into public.ledscores_connections(
  tenant_id,name,club_slug,status
) values ('10000000-0000-4000-8000-000000001321','Bypass','bypass','active')$$,
  '42501',null,'browser roles cannot bypass guarded connection writes');
select ok(not has_function_privilege(
  'authenticated','public.claim_ledscores_connections_v1(text,integer,integer)','execute'
),'browser roles cannot claim provider worker leases');
select ok(not has_function_privilege(
  'anon','public.get_ledscores_player_bootstrap_v1(text)','execute'
),'anonymous clients cannot call service-backed Player bootstrap');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001322',true);
select is((select count(*) from public.ledscores_connections),0::bigint,
  'tenant B cannot read tenant A provider connections');
select is((select count(*) from public.ledscores_goal_alert_versions),0::bigint,
  'tenant B cannot read tenant A published alert versions');
select throws_ok($$select public.save_ledscores_team_mappings_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_connection_id')::uuid,'[]'::jsonb
)$$,'42501',null,'tenant B cannot mutate tenant A connection mappings');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((select count(*) from public.claim_ledscores_connections_v1('worker:s132',45,10)),1::bigint,
  'service worker atomically claims the enabled connection');
select is((select endpoint_url from public.claim_ledscores_connections_v1('worker:s132',45,10)),
  'wss://wss.ledscores.score.tel/clubs/duindorp-sv/scores/',
  'worker receives only the canonical read-only websocket endpoint');
select is((select count(*) from public.claim_ledscores_connections_v1('worker:other',45,10)),0::bigint,
  'a second worker cannot steal an active lease');
select is(public.renew_ledscores_connection_lease_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:other',45
),false,'a different worker cannot renew the lease');
select is(public.renew_ledscores_connection_lease_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',45
),true,'the lease owner can renew the connection lease');
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('a',64),'update-42','match-42',
  'Duindorp sv 1','Tegenstander 1',0,0,1,0,'own','Speler 9','12:34',clock_timestamp(),'live',null,
  'home','duindorp-sv-1'
)->>'deliveryCount')::integer,3,'a valid own goal dispatches to exactly three unique targeted screens');
select set_config(
  'test.ledscores_delivery_id',
  (select id::text from public.ledscores_player_deliveries
    where message_kind='goal' and screen_id='30000000-0000-4000-8000-000000001321' limit 1),
  false
);
select is((select count(*) from public.ledscores_player_deliveries where message_kind='goal'),3::bigint,
  'screen 3 in both groups still receives only one goal delivery');
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('a',64),'update-42-repeat','match-42',
  'Duindorp sv 1','Tegenstander 1',0,0,1,0,'own','Speler 9','12:34',clock_timestamp(),'live',null,
  'home','duindorp-sv-1'
)->>'outcome'),'duplicate','canonical event key suppresses a repeated provider event');
select is((select count(*) from public.ledscores_player_deliveries where message_kind='goal'),3::bigint,
  'duplicate event cannot create a second Player delivery');
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('d',64),'update-unselected','match-42',
  'Ander eigen team','Tegenstander 1',1,0,2,0,'own','','13:00',clock_timestamp(),'live',null,
  'home','ander-eigen-team'
)->>'deliveryCount')::integer,0,'an own-team filter suppresses a valid goal from an unselected own team');
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('b',64),'update-43','match-42',
  'Thuisteam','Uitteam',1,0,1,1,'unknown','','13:10',clock_timestamp(),'live',null,
  'away','onbekend-team'
)->>'dispatchStatus'),'suppressed_unknown_side','unknown team mapping fails safely without an overlay');
select is((select count(*) from public.ledscores_goal_events),3::bigint,
  'audit history retains dispatched and safely suppressed canonical events');
select is((select scoreboard_side || ':' || scoring_team_key
  from public.ledscores_goal_events where canonical_key=repeat('a',64)),
  'home:duindorp-sv-1','canonical goal history retains the source side and mapped team key');
select is((public.get_ledscores_player_bootstrap_v1(repeat('c',64))->>'authorized')::boolean,true,
  'paired Player credential authorizes a screen-scoped bootstrap');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('c',64))->'configs'),1,
  'Player bootstrap deduplicates overlapping target groups');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('c',64))->'pendingDeliveries'),1,
  'Player reconnect bootstrap catches up only the latest still-valid delivery');
select is(public.ack_ledscores_player_delivery_v1(
  repeat('c',64),current_setting('test.ledscores_delivery_id')::uuid,'received',null
),true,'Player acknowledges receipt with its device credential');
select is(public.ack_ledscores_player_delivery_v1(
  repeat('c',64),current_setting('test.ledscores_delivery_id')::uuid,'rendered','render_latency_ms:24'
),true,'Player records terminal rendered acknowledgement');
select is((select status from public.ledscores_player_deliveries
  where id=current_setting('test.ledscores_delivery_id')::uuid),'rendered',
  'rendered delivery remains terminal and auditable');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('c',64))->'pendingDeliveries'),0,
  'terminal deliveries are never replayed during Player reconnect');
select is(public.ack_ledscores_player_delivery_v1(
  repeat('d',64),current_setting('test.ledscores_delivery_id')::uuid,'rendered',null
),false,'a different device credential cannot acknowledge the delivery');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001321',true);
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  current_setting('test.ledscores_connection_id')::uuid,'Doelpunt hoofdveld',300,8000,'pause',
  (select draft_config || jsonb_build_object(
    'unknownPolicy','generic','unknownDesign',jsonb_build_object(
      'headline','GOAL GENERIEK','animation','impact','palette','ink-black'
    )
  ) from public.ledscores_goal_alerts where id=current_setting('test.ledscores_alert_id')::uuid),
  array['31000000-0000-4000-8000-000000001321','32000000-0000-4000-8000-000000001321']::uuid[],
  '{}'::uuid[],2
)->>'outcome'),'saved','Studio can explicitly choose the non-misleading generic unknown-team fallback');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  3,'50000000-0000-4000-8000-000000001322'
)->>'version')::integer,2,'generic fallback is frozen in a second immutable version');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('e',64),'update-unknown-generic','match-42',
  'Thuisteam','Uitteam',1,1,1,2,'unknown','','13:20',clock_timestamp(),'live',null,
  'away','nieuw-onbekend-team'
)->>'deliveryCount')::integer,3,'generic unknown-team policy produces three deduplicated safe deliveries');
select is((select payload->'design'->>'headline'
  from public.ledscores_player_deliveries delivery
  join public.ledscores_goal_events event on event.id=delivery.goal_event_id
  where event.canonical_key=repeat('e',64)
    and delivery.screen_id='30000000-0000-4000-8000-000000001321'),
  'GOAL GENERIEK','unknown-team delivery contains only the published generic design');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001321',true);
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  current_setting('test.ledscores_connection_id')::uuid,'Doelpunt hoofdveld',300,8000,'pause',
  (select draft_config || '{"triggerOpponent":false,"unknownPolicy":"suppress"}'::jsonb
    from public.ledscores_goal_alerts where id=current_setting('test.ledscores_alert_id')::uuid),
  array['31000000-0000-4000-8000-000000001321']::uuid[],'{}'::uuid[],4
)->>'outcome'),'saved','Studio can disable the opponent trigger independently');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  5,'50000000-0000-4000-8000-000000001323'
)->>'version')::integer,3,'opponent trigger policy is immutable after publish');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('f',64),'update-opponent-off','match-42',
  'Duindorp sv 1','Tegenstander 1',2,1,2,2,'opponent','','14:00',clock_timestamp(),'live',null,
  'away','tegenstander-1'
)->>'deliveryCount')::integer,0,'disabled opponent trigger creates no Player delivery');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001321',true);
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  current_setting('test.ledscores_connection_id')::uuid,'Doelpunt hoofdveld',300,8000,'pause',
  (select draft_config || jsonb_build_object(
    'triggerOpponent',true,'activeFrom',(clock_timestamp()+interval '1 day')::text,
    'activeUntil',(clock_timestamp()+interval '2 days')::text
  ) from public.ledscores_goal_alerts where id=current_setting('test.ledscores_alert_id')::uuid),
  array['31000000-0000-4000-8000-000000001321']::uuid[],'{}'::uuid[],6
)->>'outcome'),'saved','Studio accepts a bounded optional UTC active window');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001321',current_setting('test.ledscores_alert_id')::uuid,
  7,'50000000-0000-4000-8000-000000001324'
)->>'version')::integer,4,'active window is frozen in the next immutable version');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132',repeat('1',64),'update-before-window','match-42',
  'Duindorp sv 1','Tegenstander 1',2,2,2,3,'opponent','','14:10',clock_timestamp(),'live',null,
  'away','tegenstander-1'
)->>'deliveryCount')::integer,0,'a valid goal outside the published active window is safely suppressed');
select throws_ok($$update public.ledscores_goal_alert_versions
  set config_snapshot=config_snapshot where id=(select id from public.ledscores_goal_alert_versions limit 1)$$,
  '55000','published LED Scores alert versions are immutable',
  'published alert version rejects every mutation, including service role');
select is(public.release_ledscores_connection_lease_v1(
  current_setting('test.ledscores_connection_id')::uuid,'worker:s132','test_complete'
),true,'worker releases its lease gracefully');
select ok(exists(
  select 1 from pg_catalog.pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename='ledscores_player_deliveries'
),'only the screen-scoped delivery table is added to Realtime');
reset role;
select ok(exists(
  select 1 from public.audit_events
  where tenant_id='10000000-0000-4000-8000-000000001321'
    and action='ledscores.goal_alert.published'
),'publish and connection management remain auditable');

select * from finish();
rollback;
