begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(71);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values
('00000000-0000-4000-8000-000000001411','authenticated','authenticated',
 's141-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001412','authenticated','authenticated',
 's141-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000001411','S141 owner'),
('00000000-0000-4000-8000-000000001412','S141 other owner');
insert into public.tenants(id,name,slug,screen_limit) values
('10000000-0000-4000-8000-000000001411','S141 tenant','s141-tenant',2),
('10000000-0000-4000-8000-000000001412','S141 other tenant','s141-other-tenant',1);
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000001411'),
('10000000-0000-4000-8000-000000001412');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000001411','00000000-0000-4000-8000-000000001411','tenant_owner'),
('10000000-0000-4000-8000-000000001412','00000000-0000-4000-8000-000000001412','tenant_owner');
insert into public.tenant_feature_flags(
  tenant_id,flag_key,enabled,rollout_reason,changed_by
) values
('10000000-0000-4000-8000-000000001411','ledscores_realtime',true,
 'S141 live match isolation test','00000000-0000-4000-8000-000000001411'),
('10000000-0000-4000-8000-000000001412','ledscores_realtime',true,
 'S141 cross-tenant isolation test','00000000-0000-4000-8000-000000001412');
insert into public.screens(id,tenant_id,name,orientation,status,created_by) values
('30000000-0000-4000-8000-000000001411','10000000-0000-4000-8000-000000001411',
 'Kantine live','landscape','active','00000000-0000-4000-8000-000000001411'),
('30000000-0000-4000-8000-000000001412','10000000-0000-4000-8000-000000001412',
 'Ander scherm','portrait','active','00000000-0000-4000-8000-000000001412');
insert into public.screen_groups(id,tenant_id,name,created_by,updated_by) values
('31000000-0000-4000-8000-000000001411','10000000-0000-4000-8000-000000001411',
 'Wedstrijddag','00000000-0000-4000-8000-000000001411','00000000-0000-4000-8000-000000001411');
insert into public.screen_group_memberships(
  tenant_id,screen_group_id,screen_id,created_by
) values (
  '10000000-0000-4000-8000-000000001411','31000000-0000-4000-8000-000000001411',
  '30000000-0000-4000-8000-000000001411','00000000-0000-4000-8000-000000001411'
);
insert into public.player_devices(
  id,tenant_id,screen_id,device_name,token_hash,status
) values (
  '40000000-0000-4000-8000-000000001411','10000000-0000-4000-8000-000000001411',
  '30000000-0000-4000-8000-000000001411','S141 Player',repeat('9',64),'paired'
);
insert into public.media_assets(
  id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,
  storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,
  duration_seconds,processed_at
) values (
  '20000000-0000-4000-8000-000000001411',
  '10000000-0000-4000-8000-000000001411',
  '00000000-0000-4000-8000-000000001411','video','Geen geldig logo',
  'goal-loop.mp4','video/mp4','ready','tenant-media',
  'tenants/10000000-0000-4000-8000-000000001411/assets/20000000-0000-4000-8000-000000001411/original/goal-loop.mp4',
  4096,repeat('7',64),1920,1080,8,now()
);
insert into public.media_variants(
  id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,
  file_size_bytes,checksum_sha256,width,height,duration_seconds
) values (
  '21000000-0000-4000-8000-000000001411',
  '10000000-0000-4000-8000-000000001411',
  '20000000-0000-4000-8000-000000001411','player_1080p','tenant-media',
  'tenants/10000000-0000-4000-8000-000000001411/assets/20000000-0000-4000-8000-000000001411/player/goal-loop.mp4',
  'video/mp4',4096,repeat('7',64),1920,1080,8
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001411',true);

select is((public.save_ledscores_connection_v1(
  '10000000-0000-4000-8000-000000001411',null,'Duindorp live','duindorp-sv','active',0
)->>'outcome'),'saved','owner creates a guarded LED Scores connection');
select set_config(
  'test.s141_connection_id',
  (select id::text from public.ledscores_connections
    where tenant_id='10000000-0000-4000-8000-000000001411'),false
);
select is((select count(*) from public.dynamic_data_sources
  where tenant_id='10000000-0000-4000-8000-000000001411'),1::bigint,
  'connection creation provisions exactly one dynamic source');
select is((select kind from public.dynamic_data_sources
  where tenant_id='10000000-0000-4000-8000-000000001411'),'ledscores',
  'the generated source is explicitly provider bound');
select is((public.save_ledscores_connection_v1(
  '10000000-0000-4000-8000-000000001411',null,'Duindorp live',
  'duindorp-sv-reserve','paused',0
)->>'outcome'),'saved',
  'a second connection may intentionally use the same human-readable name');
select is((select count(distinct name) from public.dynamic_data_sources
  where tenant_id='10000000-0000-4000-8000-000000001411'),2::bigint,
  'deterministic connection suffixes keep generated source names unique');
select is(public.save_ledscores_team_mappings_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_connection_id')::uuid,
  '[{"teamKey":"duindorp-1","teamName":"Duindorp SV 1","side":"own"},{"teamKey":"bezoekers-1","teamName":"Bezoekers 1","side":"opponent"}]'::jsonb
),2,'home and optional away team identities remain explicit');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((select count(*) from public.claim_ledscores_connections_v1(
  'worker:s141',45,10
)),1::bigint,'service worker claims the connection before roster intake');
select set_config(
  'test.s141_initial_sync',
  public.sync_ledscores_players_v1(
    current_setting('test.s141_connection_id')::uuid,'worker:s141',
    '[
      {"teamKey":"DUINDORP-1","playerKey":"player-9","name":"Daan Jansen","number":9,"active":true},
      {"teamKey":"bezoekers-1","playerKey":"visitor-4","name":"Bezoeker vier","number":4,"active":true}
    ]'::jsonb,clock_timestamp()
  )::text,false
);
select is((current_setting('test.s141_initial_sync')::jsonb
  ->>'playerCount')::integer,1,
  'without an explicit opt-in only the mapped own-team roster is persisted');
select is(jsonb_array_length(current_setting('test.s141_initial_sync')::jsonb
  ->'acceptedPlayers'),1,
  'the worker receives an exact allowlist for privacy-safe photo imports');
select is((select provider_team_key from public.ledscores_player_identities
  where provider_player_key='player-9'),'duindorp-1',
  'uppercase provider team identifiers are persisted in canonical lowercase');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001411',true);

select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',null,
  current_setting('test.s141_connection_id')::uuid,'Wedstrijdanimaties',500,8000,'continue',
  '{
    "schemaVersion":1,
    "triggerOwn":true,
    "triggerOpponent":false,
    "unknownPolicy":"suppress",
    "ownTeamKeys":["DUINDORP-1"],
    "activeFrom":null,
    "activeUntil":null,
    "ownSoundVolume":70,
    "opponentSoundVolume":0,
    "sponsorOnlyOwn":true,
    "ownDesign":{"headline":"GOAL!","animation":"impact","palette":"electric-orange"},
    "opponentDesign":{"headline":"Tegendoelpunt","animation":"pulse","palette":"ink-black"},
    "unknownDesign":{"headline":"GOAL!","animation":"impact","palette":"ink-black"},
    "overlayTriggers":{"lineup":true,"start":true,"halfTime":true,"end":true},
    "lineupBehavior":{"selectedOnly":true,"activeFallback":false,"includeOpponent":true,"pageDurationMs":6000},
    "overlayDesigns":{
      "lineupHome":{"template":"team-grid","headline":"Onze opstelling","animation":"slide","palette":"ink-black","durationMs":12000},
      "lineupAway":{"template":"team-grid","headline":"Opstelling bezoekers","animation":"slide","palette":"white","durationMs":14000},
      "matchStart":{"template":"matchday-impact","headline":"De wedstrijd begint","animation":"impact","palette":"electric-orange","durationMs":8000},
      "halfTime":{"template":"score-focus","headline":"Rust","animation":"pulse","palette":"ink-black","durationMs":8000},
      "matchEnd":{"template":"final-score","headline":"Eindstand","animation":"impact","palette":"ink-black","durationMs":12000}
    }
  }'::jsonb,
  array['31000000-0000-4000-8000-000000001411']::uuid[],'{}'::uuid[],0
)->>'outcome'),'saved','one responsive Studio configuration stores goals and match overlays');
select set_config(
  'test.s141_alert_id',
  (select id::text from public.ledscores_goal_alerts
    where tenant_id='10000000-0000-4000-8000-000000001411'),false
);
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,1,
  '50000000-0000-4000-8000-000000001411'
)->>'outcome'),'published','the combined overlay design publishes immutably');
select is((select (config_snapshot #>> '{overlayTriggers,lineup}')::boolean
  from public.ledscores_goal_alert_versions),true,
  'published configuration freezes the lineup trigger');
select is((select config_snapshot #>> '{ownTeamKeys,0}'
  from public.ledscores_goal_alert_versions),'duindorp-1',
  'published own-team filters are canonicalized for case-stable dispatch');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,
  current_setting('test.s141_connection_id')::uuid,
  'Wedstrijdanimaties',500,8000,'continue',
  jsonb_set(
    (select draft_config from public.ledscores_goal_alerts
      where id=current_setting('test.s141_alert_id')::uuid),
    '{overlayTriggers,start}','"kapot"'::jsonb
  ),
  array['31000000-0000-4000-8000-000000001411']::uuid[],'{}'::uuid[],2
)$$,'23514',null,
  'direct RPC callers cannot publish malformed nested overlay trigger types');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,
  current_setting('test.s141_connection_id')::uuid,
  'Wedstrijdanimaties',500,8000,'continue',
  jsonb_set(
    (select draft_config from public.ledscores_goal_alerts
      where id=current_setting('test.s141_alert_id')::uuid),
    '{overlayTriggers}','[]'::jsonb
  ),
  array['31000000-0000-4000-8000-000000001411']::uuid[],'{}'::uuid[],2
)$$,'23514',null,
  'direct RPC callers reject non-object overlay trigger containers');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,
  current_setting('test.s141_connection_id')::uuid,
  'Wedstrijdanimaties',500,8000,'continue',
  jsonb_set(jsonb_set(
    (select draft_config from public.ledscores_goal_alerts
      where id=current_setting('test.s141_alert_id')::uuid),
    '{overlayTriggers,lineup}','false'::jsonb
  ),'{lineupBehavior,includeOpponent}','true'::jsonb),
  array['31000000-0000-4000-8000-000000001411']::uuid[],'{}'::uuid[],2
)$$,'23514',null,
  'opponent roster consent cannot remain enabled without a lineup overlay');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,
  current_setting('test.s141_connection_id')::uuid,
  'Wedstrijdanimaties',500,8000,'continue',
  jsonb_set(
    (select draft_config from public.ledscores_goal_alerts
      where id=current_setting('test.s141_alert_id')::uuid),
    '{logoMediaAssetId}',
    to_jsonb('20000000-0000-4000-8000-000000001411'::text)
  ),
  array['31000000-0000-4000-8000-000000001411']::uuid[],
  array['20000000-0000-4000-8000-000000001411']::uuid[],2
)$$,'23514',null,
  'a player-ready video can never be configured as a club logo');

select set_config(
  'test.s141_slide_outcome',
  public.create_ledscores_live_match_slide_v1(
    '10000000-0000-4000-8000-000000001411',
    current_setting('test.s141_connection_id')::uuid,
    'Live tussenstand','landscape',
    '{"liveMatch":{"template":"match_center","showClock":true,"showTimeline":true,"timelineLimit":5,"outsideMatchBehavior":"last_known","accentMode":"club"}}'::jsonb,
    '51000000-0000-4000-8000-000000001411'
  )::text,false
);
select is((current_setting('test.s141_slide_outcome')::jsonb ->> 'outcome'),'created',
  'Studio creates a real landscape live-match slide');
select set_config(
  'test.s141_slide_id',
  current_setting('test.s141_slide_outcome')::jsonb ->> 'slideId',false
);
select is((select snapshot_data_json ->> 'type'
  from public.dynamic_slide_snapshots
  where dynamic_slide_id=current_setting('test.s141_slide_id')::uuid),
  'ledscores_live_match','the immutable snapshot is typed as a live match');
select is((public.create_ledscores_live_match_slide_v1(
    '10000000-0000-4000-8000-000000001411',
    current_setting('test.s141_connection_id')::uuid,
    'Live tussenstand','landscape',
    '{"liveMatch":{"template":"match_center","showClock":true,"showTimeline":true,"timelineLimit":5,"outsideMatchBehavior":"last_known","accentMode":"club"}}'::jsonb,
    '51000000-0000-4000-8000-000000001411'
  )->>'slideId'),current_setting('test.s141_slide_id'),
  'a repeated create submit replays the same live slide instead of duplicating it');
select is(position('ledscores.score.tel' in (select snapshot_data_json::text
  from public.dynamic_slide_snapshots
  where dynamic_slide_id=current_setting('test.s141_slide_id')::uuid)),0,
  'browser snapshot never contains the provider websocket or image host');
select ok(not exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name='ledscores_player_identities'
    and column_name='photo_source_url'
),'tenant-readable player rows never persist a raw provider photo URL');
select ok(not has_function_privilege(
  'authenticated','public.sync_ledscores_players_v1(uuid,text,jsonb,timestamptz)','execute'
),'browser roles cannot synchronize provider player identities');
select ok(not has_function_privilege(
  'authenticated','public.get_ledscores_match_player_bootstrap_v1(text)','execute'
),'browser roles cannot call the service-backed Player bootstrap');

reset role;
set local role service_role;
update public.tenant_feature_flags set enabled=false
where tenant_id='10000000-0000-4000-8000-000000001411'
  and flag_key='ledscores_realtime';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001411',true);
select throws_ok($$select public.create_ledscores_live_match_slide_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_connection_id')::uuid,
  'Niet toegestaan','portrait',
  '{"liveMatch":{"template":"scoreboard"}}'::jsonb,
  '51000000-0000-4000-8000-000000001412'
)$$,'42501',null,
  'the LED Scores feature flag gates live-slide creation server-side');
reset role;
set local role service_role;
update public.tenant_feature_flags set enabled=true
where tenant_id='10000000-0000-4000-8000-000000001411'
  and flag_key='ledscores_realtime';
reset role;
set local role authenticated;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001412',true);
select is((select count(*) from public.ledscores_connections),0::bigint,
  'tenant B cannot read tenant A connection');
select is((select count(*) from public.dynamic_slides),0::bigint,
  'tenant B cannot read tenant A live slide');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.renew_ledscores_connection_lease_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',45
),true,'the same service worker renews its active connection lease');
select is((public.sync_ledscores_players_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  '[
    {"teamKey":"duindorp-1","playerKey":"player-9","name":"Daan Jansen","number":9,"active":true},
    {"teamKey":"duindorp-1","playerKey":"player-10","name":"Milan de Wit","number":10,"active":true},
    {"teamKey":"bezoekers-1","playerKey":"visitor-4","name":"Bezoeker vier","number":4,"active":true}
  ]'::jsonb,clock_timestamp()
)->>'playerCount')::integer,3,
  'explicit opponent opt-in allows both mapped rosters to be synchronized');

select is((public.upsert_ledscores_live_match_state_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  jsonb_build_object(
    'schemaVersion',1,'connectionId',current_setting('test.s141_connection_id'),
    'sourceUpdateId','state-1','stateRevision','1',
    'matchKey','match-s141','status','live',
    'homeTeamKey','duindorp-1','awayTeamKey','bezoekers-1',
    'home',jsonb_build_object('teamKey','duindorp-1','name','Duindorp SV 1','score',1),
    'away',jsonb_build_object('teamKey','bezoekers-1','name','Bezoekers 1','score',0),
    'periodLabel','1e helft','clock',jsonb_build_object(
      'anchorSeconds',600,'anchorAt',clock_timestamp(),'running',true,
      'direction','up','maxSeconds',null
    ),'timeline','[]'::jsonb,'sourceUpdatedAt',clock_timestamp(),'staleAfter',30
  ),clock_timestamp()
)->>'outcome'),'stored','first bounded live state is stored');
select is((public.upsert_ledscores_live_match_state_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  jsonb_build_object(
    'schemaVersion',1,'connectionId',current_setting('test.s141_connection_id'),
    'sourceUpdateId','state-1','stateRevision','1',
    'matchKey','match-s141','status','live',
    'homeTeamKey','duindorp-1','awayTeamKey','bezoekers-1',
    'home',jsonb_build_object('teamKey','duindorp-1','name','Duindorp SV 1','score',1),
    'away',jsonb_build_object('teamKey','bezoekers-1','name','Bezoekers 1','score',0),
    'periodLabel','1e helft','clock',jsonb_build_object(
      'anchorSeconds',600,'anchorAt',clock_timestamp(),'running',true,
      'direction','up','maxSeconds',null
    ),'timeline','[]'::jsonb,'sourceUpdatedAt',clock_timestamp(),'staleAfter',30
  ),clock_timestamp()
)->>'outcome'),'duplicate','duplicate provider update does not advance state');
select is((public.upsert_ledscores_live_match_state_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  jsonb_build_object(
    'schemaVersion',1,'connectionId',current_setting('test.s141_connection_id'),
    'sourceUpdateId','state-2','stateRevision','2',
    'matchKey','match-s141','status','live',
    'homeTeamKey','duindorp-1','awayTeamKey','bezoekers-1',
    'home',jsonb_build_object('teamKey','duindorp-1','name','Duindorp SV 1','score',2),
    'away',jsonb_build_object('teamKey','bezoekers-1','name','Bezoekers 1','score',1),
    'periodLabel','1e helft','clock',jsonb_build_object(
      'anchorSeconds',720,'anchorAt',clock_timestamp(),'running',true,
      'direction','up','maxSeconds',null
    ),
    'timeline',jsonb_build_array(
      jsonb_build_object(
        'id','goal-2','kind','goal','label','Goal · Daan Jansen',
        'occurredAt',clock_timestamp(),'clockLabel','12:00',
        'playerName','Daan Jansen','side','home','homeScore',2,'awayScore',0
      ),
      jsonb_build_object(
        'id','goal-away-1','kind','goal','label','Goal · Bezoeker vier',
        'occurredAt',clock_timestamp(),'clockLabel','14:00',
        'playerName','Bezoeker vier','side','away','homeScore',2,'awayScore',1
      )
    ),'sourceUpdatedAt',clock_timestamp(),'staleAfter',30
  ),clock_timestamp()
)->>'stateSequence')::bigint,2::bigint,'a newer provider update advances the monotonic sequence');
select throws_ok($$select public.upsert_ledscores_live_match_state_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  (select state_json || '{"rosters":[],"debugUrl":"https://provider.invalid"}'::jsonb
    from public.ledscores_live_match_states
    where connection_id=current_setting('test.s141_connection_id')::uuid),
  clock_timestamp()
)$$,'22023',null,
  'bounded live state rejects rosters, provider URLs and undeclared debug fields');

select is((public.dispatch_ledscores_match_overlay_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('a',64),
  'match_start','overlay-start',
  '{"schemaVersion":1,"matchKey":"match-s141","homeTeamKey":"DUINDORP-1","awayTeamKey":"BEZOEKERS-1","home":{"name":"Duindorp SV 1"},"away":{"name":"Bezoekers 1"},"score":{"home":0,"away":0}}'::jsonb,
  clock_timestamp()
)->>'deliveryCount')::integer,1,'match start reaches the one targeted screen');
select is((select payload #>> '{ownTeamKeys,0}'
  from public.ledscores_player_deliveries
  where message_kind='match_overlay' and payload ->> 'overlayKind'='match_start'),
  'duindorp-1','match overlay carries the resolved own-team identity for club-logo binding');
select is((public.dispatch_ledscores_match_overlay_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('a',64),
  'match_start','overlay-start-repeat',
  '{"schemaVersion":1,"matchKey":"match-s141","homeTeamKey":"duindorp-1","awayTeamKey":"bezoekers-1"}'::jsonb,clock_timestamp()
)->>'outcome'),'duplicate','a repeated semantic event is idempotently suppressed');
select is((public.dispatch_ledscores_match_overlay_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('b',64),
  'lineup','overlay-lineup-away',
  '{"schemaVersion":1,"matchKey":"match-s141","homeTeamKey":"DUINDORP-1","awayTeamKey":"BEZOEKERS-1","teamKey":"BEZOEKERS-1","side":"away","team":{"teamKey":"BEZOEKERS-1","name":"Bezoekers 1"},"selectedPlayers":[{"id":"visitor-4","name":"Speler vier","number":4}],"activePlayers":[{"id":"visitor-4","name":"Speler vier","number":4},{"id":"visitor-8","name":"Reserve acht","number":8}]}'::jsonb,
  clock_timestamp()
)->>'deliveryCount')::integer,1,'away lineup uses the optional opponent overlay path');
select is((select payload -> 'design' ->> 'headline'
  from public.ledscores_player_deliveries
  where message_kind='match_overlay' and payload ->> 'overlayKind'='lineup'),
  'Opstelling bezoekers','away lineup selects its own immutable design');
select is((select jsonb_array_length(payload -> 'lineup')
  from public.ledscores_player_deliveries
  where message_kind='match_overlay' and payload ->> 'overlayKind'='lineup'),1,
  'selected-only lineup truthfully excludes active but unselected players');
select ok((select not payload ? 'selectedPlayers' and not payload ? 'activePlayers'
  from public.ledscores_player_deliveries
  where message_kind='match_overlay' and payload ->> 'overlayKind'='lineup'),
  'Player delivery exposes only the immutable resolved lineup');
select is((select (payload ->> 'lineupPageDurationMs')::integer
  from public.ledscores_player_deliveries
  where message_kind='match_overlay' and payload ->> 'overlayKind'='lineup'),6000,
  'published pagination duration travels with the resolved lineup');
select is((public.dispatch_ledscores_match_overlay_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('e',64),
  'lineup','overlay-lineup-no-selection',
  '{"schemaVersion":1,"matchKey":"match-s141","homeTeamKey":"duindorp-1","awayTeamKey":"bezoekers-1","teamKey":"duindorp-1","side":"home","team":{"teamKey":"duindorp-1","name":"Duindorp SV 1"},"selectedPlayers":[],"activePlayers":[{"id":"player-9","name":"Daan Jansen","number":9}]}'::jsonb,
  clock_timestamp()
)->>'deliveryCount')::integer,0,
  'selected-only mode never invents a lineup when LED Scores has no selection');
select is((public.dispatch_ledscores_match_overlay_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('d',64),
  'match_start','overlay-other-home-team',
  '{"schemaVersion":1,"matchKey":"match-other","homeTeamKey":"ander-thuisteam"}'::jsonb,
  clock_timestamp()
)->>'deliveryCount')::integer,0,
  'an unselected home team cannot trigger the published match animations');

select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('c',64),
  'goal-before-scorer','match-s141','Duindorp SV 1','Bezoekers 1',1,0,2,0,
  'own','','12:00',clock_timestamp(),'live',null,'home','DUINDORP-1'
)->>'deliveryCount')::integer,1,'goal overlay is delivered before scorer selection arrives');
select is((select scoring_team_key from public.ledscores_goal_events
  where canonical_key=repeat('c',64)),'duindorp-1',
  'goal dispatch canonicalizes uppercase provider team identity before filtering');
select is((public.enrich_ledscores_goal_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('c',64),
  'scorer-late','player-9','Daan Jansen',9,clock_timestamp()
)->>'deliveryCount')::integer,1,'late scorer identity upgrades the visible goal overlay');
select is((select resolution from public.ledscores_goal_event_enrichments),'resolved',
  'late scorer is linked to the stable provider player identity');
select is((public.get_ledscores_match_player_bootstrap_v1(repeat('9',64))->>'authorized')::boolean,
  true,'paired Player credential authorizes the supplemental match bootstrap');
select is(jsonb_array_length(
  public.get_ledscores_match_player_bootstrap_v1(repeat('9',64))->'pendingDeliveries'
),3,'reconnect bootstrap catches up match overlays and scorer enrichment');
select ok(exists(
  select 1 from pg_catalog.pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename='ledscores_live_match_states'
),'only the bounded public live-state table is published to Realtime');
select is((public.dispatch_ledscores_goal_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('f',64),
  'opponent-goal-before-opt-out','match-s141','Duindorp SV 1','Bezoekers 1',2,0,2,1,
  'opponent','Bezoeker vier','14:00',clock_timestamp(),'live',null,'away','bezoekers-1'
)->>'deliveryCount')::integer,0,
  'an opted-in opponent identity can be audited without enabling opponent goal playback');
select is((public.enrich_ledscores_goal_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',repeat('f',64),
  'opponent-scorer','visitor-4','Bezoeker vier',4,clock_timestamp()
)->>'deliveryCount')::integer,0,
  'opponent scorer enrichment remains non-delivering when that goal trigger is disabled');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001411',true);
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,
  current_setting('test.s141_connection_id')::uuid,
  'Wedstrijdanimaties',500,8000,'continue',
  jsonb_set(
    (select draft_config from public.ledscores_goal_alerts
      where id=current_setting('test.s141_alert_id')::uuid),
    '{lineupBehavior,includeOpponent}','false'::jsonb
  ),
  array['31000000-0000-4000-8000-000000001411']::uuid[],'{}'::uuid[],2
)->>'outcome'),'saved','owner can withdraw the optional opponent-roster consent');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_alert_id')::uuid,3,
  '50000000-0000-4000-8000-000000001412'
)->>'outcome'),'published','opponent-roster opt-out is published as a new immutable version');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.sync_ledscores_players_v1(
  current_setting('test.s141_connection_id')::uuid,'worker:s141',
  '[
    {"teamKey":"duindorp-1","playerKey":"player-9","name":"Daan Jansen","number":9,"active":true},
    {"teamKey":"duindorp-1","playerKey":"player-10","name":"Milan de Wit","number":10,"active":true},
    {"teamKey":"bezoekers-1","playerKey":"visitor-4","name":"Bezoeker vier","number":4,"active":true}
  ]'::jsonb,clock_timestamp()
)->>'playerCount')::integer,2,
  'the next roster sync applies the withdrawn consent immediately');
select is((select count(*) from public.ledscores_player_identities
  where tenant_id='10000000-0000-4000-8000-000000001411'
    and provider_team_key='bezoekers-1'),0::bigint,
  'previously stored opponent identities are removed after opt-out');
select ok((select
    enrichment.resolution='removed'
    and enrichment.provider_player_key is null
    and enrichment.player_identity_id is null
    and enrichment.player_name is null
    and enrichment.shirt_number is null
    and enrichment.photo_provider_asset_version_id is null
  from public.ledscores_goal_event_enrichments enrichment
  join public.ledscores_goal_events goal
    on goal.tenant_id=enrichment.tenant_id and goal.id=enrichment.goal_event_id
  where goal.canonical_key=repeat('f',64)),
  'opponent scorer audit is fully redacted while its non-PII event evidence remains');
select ok((select scorer_name is null
  from public.ledscores_goal_events where canonical_key=repeat('f',64)),
  'opponent scorer name is also removed from the canonical goal event');
select ok((select not match_event.payload ? 'selectedPlayers'
    and not match_event.payload ? 'activePlayers'
    and (match_event.payload ->> 'redacted')::boolean
  from public.ledscores_match_events match_event
  where match_event.canonical_key=repeat('b',64)),
  'opponent lineup audit keeps only non-player event evidence after opt-out');
select ok((select jsonb_array_length(delivery.payload -> 'lineup')=0
    and (delivery.payload ->> 'redacted')::boolean
  from public.ledscores_player_deliveries delivery
  join public.ledscores_match_events match_event
    on match_event.tenant_id=delivery.tenant_id and match_event.id=delivery.match_event_id
  where match_event.canonical_key=repeat('b',64)),
  'pending and retained opponent lineup deliveries no longer expose players after opt-out');
select ok((select
    state_json #>> '{timeline,0,playerName}' = 'Daan Jansen'
    and state_json #> '{timeline,1,playerName}' = 'null'::jsonb
    and state_json #>> '{timeline,1,label}' = 'Doelpunt'
  from public.ledscores_live_match_states
  where connection_id=current_setting('test.s141_connection_id')::uuid),
  'live timeline keeps own attribution and redacts opponent attribution after opt-out');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001411',true);
select is((select count(*) from public.ledscores_player_identities),2::bigint,
  'tenant A can inspect only its synchronized own-team roster after opt-out');
select is((select count(*) from public.ledscores_live_match_states),1::bigint,
  'tenant A can inspect its current live match state');
select is((select count(*) from public.ledscores_match_events),4::bigint,
  'tenant A can audit dispatched and safely untargeted match events');
select is((select count(*) from public.ledscores_goal_event_enrichments),2::bigint,
  'tenant A can audit own scorer resolution and redacted opponent evidence');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001412',true);
select is((select count(*) from public.ledscores_player_identities),0::bigint,
  'tenant B cannot read tenant A roster');
select is((select count(*) from public.ledscores_live_match_states),0::bigint,
  'tenant B cannot read tenant A live state');
select is((select count(*) from public.ledscores_match_events),0::bigint,
  'tenant B cannot read tenant A match events');
select is((select count(*) from public.ledscores_goal_event_enrichments),0::bigint,
  'tenant B cannot read tenant A scorer enrichments');
select throws_ok($$insert into public.ledscores_live_match_states(
  tenant_id,connection_id,match_identity,status,state_json,
  source_updated_at,source_observed_at
) values (
  '10000000-0000-4000-8000-000000001411',
  current_setting('test.s141_connection_id')::uuid,'bypass','live',
  '{"schemaVersion":1}'::jsonb,now(),now()
)$$,'42501',null,'browser roles cannot bypass the service-only live-state writer');

select * from finish();
rollback;
