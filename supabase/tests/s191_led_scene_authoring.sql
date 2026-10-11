begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(42);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data
) values
('00000000-0000-4000-8000-000000002401','authenticated','authenticated',
 's191led-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000002402','authenticated','authenticated',
 's191led-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000002401','S191 LED owner'),
('00000000-0000-4000-8000-000000002402','S191 LED other owner');
insert into public.tenants(id,name,slug,screen_limit) values
('10000000-0000-4000-8000-000000002401','S191 LED tenant','s191led-tenant',2),
('10000000-0000-4000-8000-000000002402','S191 LED other tenant','s191led-other-tenant',1);
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000002401'),
('10000000-0000-4000-8000-000000002402');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401','tenant_owner'),
('10000000-0000-4000-8000-000000002402','00000000-0000-4000-8000-000000002402','tenant_owner');
insert into public.tenant_feature_flags(
  tenant_id,flag_key,enabled,rollout_reason,changed_by
) values
('10000000-0000-4000-8000-000000002401','ledscores_realtime',true,
 'S191 LED canvas test','00000000-0000-4000-8000-000000002401'),
('10000000-0000-4000-8000-000000002402','ledscores_realtime',true,
 'S191 LED cross-tenant test','00000000-0000-4000-8000-000000002402');
insert into public.screen_groups(id,tenant_id,name,created_by,updated_by) values
('31000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
 'Canvasdoelgroep','00000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401');
insert into public.screens(id,tenant_id,name,orientation,status,created_by) values
('30000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
 'S191 LED Player','landscape','active','00000000-0000-4000-8000-000000002401');
insert into public.screen_group_memberships(
  tenant_id,screen_group_id,screen_id,created_by
) values (
  '10000000-0000-4000-8000-000000002401','31000000-0000-4000-8000-000000002401',
  '30000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401'
);
insert into public.player_devices(
  id,tenant_id,screen_id,device_name,token_hash,status
) values (
  '40000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
  '30000000-0000-4000-8000-000000002401','S191 LED canvas Player',repeat('8',64),'paired'
);

insert into public.media_assets(
  id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,
  storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,
  duration_seconds,processed_at
) values
('20000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
 '00000000-0000-4000-8000-000000002401','image','S191 LED patroon','patroon.png',
 'image/png','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000002401/assets/20000000-0000-4000-8000-000000002401/original/patroon.png',
 4096,repeat('1',64),1920,1080,null,now()),
('20000000-0000-4000-8000-000000002403','10000000-0000-4000-8000-000000002401',
 '00000000-0000-4000-8000-000000002401','video','S191 LED achtergrond','achtergrond.mp4',
 'video/mp4','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000002401/assets/20000000-0000-4000-8000-000000002403/original/achtergrond.mp4',
 8192,repeat('2',64),1920,1080,8,now()),
('20000000-0000-4000-8000-000000002402','10000000-0000-4000-8000-000000002402',
 '00000000-0000-4000-8000-000000002402','image','Andere tenant','ander.png',
 'image/png','ready','tenant-media',
 'tenants/10000000-0000-4000-8000-000000002402/assets/20000000-0000-4000-8000-000000002402/original/ander.png',
 4096,repeat('3',64),1920,1080,null,now());
insert into public.media_variants(
  id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,
  file_size_bytes,checksum_sha256,width,height,duration_seconds
) values (
  '21000000-0000-4000-8000-000000002403','10000000-0000-4000-8000-000000002401',
  '20000000-0000-4000-8000-000000002403','player_1080p','tenant-media',
  'tenants/10000000-0000-4000-8000-000000002401/assets/20000000-0000-4000-8000-000000002403/player/achtergrond.mp4',
  'video/mp4',8192,repeat('2',64),1920,1080,8
);

select ok(not has_function_privilege(
  'authenticated','private.validate_ledscores_canvas_config_v1(uuid,jsonb,uuid[])','execute'
),'browser roles cannot bypass the guarded save RPC through the canvas validator');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);
select is((public.save_ledscores_connection_v1(
  '10000000-0000-4000-8000-000000002401',null,'S191 LED LED Scores','s191led-club','active',0
)->>'outcome'),'saved','owner creates a guarded LED Scores connection');
select set_config(
  'test.s191led_connection_id',
  (select id::text from public.ledscores_connections
   where tenant_id='10000000-0000-4000-8000-000000002401'),false
);
select is(public.save_ledscores_team_mappings_v1(
  '10000000-0000-4000-8000-000000002401',
  current_setting('test.s191led_connection_id')::uuid,
  '[{"teamKey":"s191led-club","teamName":"S191 LED Club","side":"own"}]'::jsonb
),1,'home-team identity is available to the canvas configuration');

select set_config('test.s191led_legacy_config',jsonb_build_object(
  'schemaVersion',1,'triggerOwn',true,'triggerOpponent',false,
  'unknownPolicy','suppress','ownTeamKeys',jsonb_build_array('s191led-club'),
  'activeFrom',null,'activeUntil',null,'ownSoundVolume',70,
  'opponentSoundVolume',0,'sponsorOnlyOwn',true,
  'ownDesign',jsonb_build_object('headline','GOAL!','animation','impact','palette','electric-orange'),
  'opponentDesign',jsonb_build_object('headline','Tegendoelpunt','animation','pulse','palette','ink-black'),
  'unknownDesign',jsonb_build_object('headline','GOAL!','animation','impact','palette','ink-black'),
  'overlayTriggers',jsonb_build_object('lineup',true,'start',true,'halfTime',true,'end',true),
  'lineupBehavior',jsonb_build_object(
    'selectedOnly',true,'activeFallback',false,'includeOpponent',false,'pageDurationMs',6000
  ),
  'overlayDesigns',jsonb_build_object(
    'lineupHome',jsonb_build_object('template','team-grid','headline','Onze opstelling','animation','slide','palette','ink-black','durationMs',12000),
    'lineupAway',jsonb_build_object('template','team-grid','headline','Bezoekers','animation','slide','palette','white','durationMs',12000),
    'matchStart',jsonb_build_object('template','matchday-impact','headline','Aftrap','animation','impact','palette','electric-orange','durationMs',8000),
    'halfTime',jsonb_build_object('template','score-focus','headline','Rust','animation','pulse','palette','ink-black','durationMs',8000),
    'matchEnd',jsonb_build_object('template','final-score','headline','Eindstand','animation','impact','palette','ink-black','durationMs',12000)
  )
)::text,false);

select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',null,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  current_setting('test.s191led_legacy_config')::jsonb,
  array['31000000-0000-4000-8000-000000002401']::uuid[],'{}'::uuid[],0
)->>'outcome'),'saved','legacy configurations remain editable without a backfill');
select set_config(
  'test.s191led_alert_id',
  (select id::text from public.ledscores_goal_alerts
   where tenant_id='10000000-0000-4000-8000-000000002401'),false
);

select set_config('test.s191led_landscape_scene',jsonb_build_object(
  'orientation','landscape',
  'background',jsonb_build_object(
    'kind','media','mediaAssetId','20000000-0000-4000-8000-000000002403',
    'objectFit','cover','focusX',0.5,'focusY',0.5,
    'overlayColor','#0a0a0a','overlayOpacity',0.3
  ),
  'layers',jsonb_build_array(
    jsonb_build_object(
      'type','text','id','scorer-name','name','Spelernaam','x',120,'y',120,
      'width',900,'height',160,'rotation',0,'opacity',1,'visible',true,'locked',false,
      'zIndex',0,'animation','rise','align','left','backgroundColor',null,
      'binding','scorerName','cornerRadius',0,'fill','#fafaf7','fontFamily','Inter Tight',
      'fontSize',120,'fontWeight',900,'letterSpacing',0,'lineHeight',1,
      'padding',0,'text','Doelpuntenmaker','verticalAlign','middle'
    ),
    jsonb_build_object(
      'type','image','id','brand-image','name','Clubbeeld','x',1100,'y',120,
      'width',600,'height',420,'rotation',0,'opacity',1,'visible',true,'locked',false,
      'zIndex',1,'animation','fade','binding',null,'mediaAssetId','20000000-0000-4000-8000-000000002401',
      'cornerRadius',24,'focusX',0.5,'focusY',0.5,'objectFit','cover'
    ),
    jsonb_build_object(
      'type','image','id','scorer-photo','name','Spelersfoto','x',1100,'y',560,
      'width',600,'height',420,'rotation',0,'opacity',1,'visible',true,'locked',false,
      'zIndex',2,'animation','zoom','binding','scorerPhoto','mediaAssetId',null,
      'cornerRadius',24,'focusX',0.5,'focusY',0.3,'objectFit','cover'
    ),
    jsonb_build_object(
      'type','shape','id','accent-panel','name','Accentvlak','x',0,'y',0,
      'width',80,'height',1080,'rotation',0,'opacity',1,'visible',true,'locked',false,
      'zIndex',3,'animation','wipe','shape','rectangle','fill','#ff5c20',
      'stroke',null,'strokeWidth',0,'cornerRadius',0
    ),
    jsonb_build_object(
      'type','lineup','id','lineup-grid','name','Opstelling','x',120,'y',560,
      'width',800,'height',420,'rotation',0,'opacity',1,'visible',true,'locked',false,
      'zIndex',4,'animation','rise','accentColor','#ff5c20','cardColor','#151719e6',
      'columns',4,'gap',20,'showName',true,'showNumber',true,'showPhoto',true,
      'textColor','#fafaf7'
    )
  )
)::text,false);
select set_config('test.s191led_pair',jsonb_build_object(
  'landscape',current_setting('test.s191led_landscape_scene')::jsonb,
  'portrait',jsonb_set(
    current_setting('test.s191led_landscape_scene')::jsonb,'{orientation}','"portrait"'::jsonb
  )
)::text,false);
select set_config('test.s191led_config',(
  current_setting('test.s191led_legacy_config')::jsonb || jsonb_build_object(
    'canvasExperience',jsonb_build_object(
      'schemaVersion',1,
      'scenes',jsonb_build_object(
        'goalOwn',current_setting('test.s191led_pair')::jsonb,
        'goalOpponent',current_setting('test.s191led_pair')::jsonb,
        'goalUnknown',current_setting('test.s191led_pair')::jsonb,
        'lineupHome',current_setting('test.s191led_pair')::jsonb,
        'lineupAway',current_setting('test.s191led_pair')::jsonb,
        'matchStart',current_setting('test.s191led_pair')::jsonb,
        'halfTime',current_setting('test.s191led_pair')::jsonb,
        'matchEnd',current_setting('test.s191led_pair')::jsonb
      )
    )
  )
)::text,false);

select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',
  current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  current_setting('test.s191led_config')::jsonb,
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array[
    '20000000-0000-4000-8000-000000002401',
    '20000000-0000-4000-8000-000000002403'
  ]::uuid[],1
)->>'outcome'),'saved','strict paired scenes and their exact media manifest save atomically');
select ok((select
    draft_config #>> '{canvasExperience,scenes,goalOwn,landscape,orientation}'='landscape'
    and draft_config #>> '{canvasExperience,scenes,goalOwn,portrait,orientation}'='portrait'
  from public.ledscores_goal_alerts where id=current_setting('test.s191led_alert_id')::uuid
),'draft freezes independent landscape and portrait scene documents');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',
  current_setting('test.s191led_alert_id')::uuid,2,
  '50000000-0000-4000-8000-000000002401'
)->>'outcome'),'published','the canvas experience publishes through the immutable version chain');
select is((select count(*) from public.ledscores_goal_alert_version_assets
  where alert_version_id=(select current_published_version_id
    from public.ledscores_goal_alerts where id=current_setting('test.s191led_alert_id')::uuid)
),2::bigint,'publication freezes exactly the two referenced canvas assets');
select set_config(
  'test.s191led_version_a',
  (select current_published_version_id::text from public.ledscores_goal_alerts
   where id=current_setting('test.s191led_alert_id')::uuid),false
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.ledscores_goal_events(
  id,tenant_id,connection_id,canonical_key,source_update_id,match_identity,
  home_team,away_team,previous_home_score,previous_away_score,home_score,
  away_score,scoreboard_side,scoring_team_key,scoring_side,scorer_name,
  match_clock,source_observed_at,event_kind,dispatch_status
) values (
  '70000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
  current_setting('test.s191led_connection_id')::uuid,repeat('e',64),'s191led-version-a',
  's191led-match','Thuisteam','Uitteam',0,0,1,0,'home','thuisteam','own',
  'Speler 9','12:34',clock_timestamp(),'live','dispatched'
);
insert into public.ledscores_player_deliveries(
  id,tenant_id,screen_id,message_kind,goal_event_id,alert_version_id,payload,
  execute_at,expires_at
) values (
  '60000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',
  '30000000-0000-4000-8000-000000002401','goal',
  '70000000-0000-4000-8000-000000002401',
  current_setting('test.s191led_version_a')::uuid,
  jsonb_build_object('eventId','70000000-0000-4000-8000-000000002401','scoringSide','own'),
  clock_timestamp(),clock_timestamp()+interval '1 minute'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);
select is((public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring B',500,8000,'continue',
  current_setting('test.s191led_config')::jsonb,
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],3
)->>'outcome'),'saved','a newer valid canvas draft can follow an immutable published version');
select is((public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,4,
  '50000000-0000-4000-8000-000000002403'
)->>'outcome'),'published','the newer canvas draft publishes as version B');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select ok((select
    jsonb_array_length(bootstrap -> 'configs')=2
    and bootstrap #>> '{configs,0,alertVersionId}'=current_setting('test.s191led_version_a')
  from (select public.get_ledscores_player_bootstrap_v1(repeat('8',64)) bootstrap) response
),'reconnect bootstrap returns pending immutable version A before current version B');
reset role;
update public.ledscores_goal_alerts
set status = 'paused'
where id = current_setting('test.s191led_alert_id')::uuid;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select ok((select
    jsonb_array_length(bootstrap -> 'configs')=1
    and bootstrap #>> '{configs,0,alertVersionId}'=current_setting('test.s191led_version_a')
  from (select public.get_ledscores_player_bootstrap_v1(repeat('8',64)) bootstrap) response
),'pending immutable version A remains available after the mutable alert is paused');
reset role;
update public.ledscores_goal_alerts
set status = 'published'
where id = current_setting('test.s191led_alert_id')::uuid;
delete from public.screen_group_memberships
where tenant_id='10000000-0000-4000-8000-000000002401'
  and screen_group_id='31000000-0000-4000-8000-000000002401'
  and screen_id='30000000-0000-4000-8000-000000002401';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select ok((select
    jsonb_array_length(bootstrap -> 'configs')=1
    and bootstrap #>> '{configs,0,alertVersionId}'=current_setting('test.s191led_version_a')
  from (select public.get_ledscores_player_bootstrap_v1(repeat('8',64)) bootstrap) response
),'pending immutable version A remains available after the screen is retargeted');
reset role;
insert into public.screen_group_memberships(
  tenant_id,screen_group_id,screen_id,created_by
) values (
  '10000000-0000-4000-8000-000000002401','31000000-0000-4000-8000-000000002401',
  '30000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401'
);
reset role;
set local role service_role;
select throws_ok($$update public.ledscores_goal_alert_versions
  set config_snapshot=jsonb_set(config_snapshot,'{schemaVersion}','2'::jsonb)
  where alert_id=current_setting('test.s191led_alert_id')::uuid$$,
  '55000',null,'published canvas scenes remain immutable');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);

select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  current_setting('test.s191led_config')::jsonb #- '{canvasExperience,scenes,goalOwn,portrait}',
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'a moment without portrait composition is rejected');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,landscape,layers,0,binding}','"window.location"'::jsonb),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'free-form data paths cannot enter the Player scene');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,landscape,layers,0,css}','"position:fixed"'::jsonb,true),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'undeclared CSS and executable presentation fields are rejected');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,landscape,layers,1,zIndex}','0'::jsonb),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'duplicate layer positions are rejected deterministically');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,portrait,layers,0,x}','3000'::jsonb),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'portrait layers cannot be hidden beyond the bounded canvas perimeter');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  current_setting('test.s191led_config')::jsonb,
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401']::uuid[],2
)$$,'23514',null,'an incomplete asset manifest cannot be saved');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,landscape,layers,1,mediaAssetId}',
    '"20000000-0000-4000-8000-000000002403"'::jsonb),
    '{canvasExperience,scenes,goalOwn,landscape,background,mediaAssetId}',
    '"20000000-0000-4000-8000-000000002401"'::jsonb),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'a player-ready video still cannot fill a static image layer');
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  jsonb_set(current_setting('test.s191led_config')::jsonb,
    '{canvasExperience,scenes,goalOwn,landscape,background,mediaAssetId}',
    '"20000000-0000-4000-8000-000000002402"'::jsonb),
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array[
    '20000000-0000-4000-8000-000000002401',
    '20000000-0000-4000-8000-000000002402',
    '20000000-0000-4000-8000-000000002403'
  ]::uuid[],2
)$$,'23514',null,'cross-tenant canvas media remains unavailable');

reset role;
set local role service_role;
update public.media_assets set mime_type = 'image/svg+xml'
where id = '20000000-0000-4000-8000-000000002401';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);
select throws_ok($$select public.save_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,
  current_setting('test.s191led_connection_id')::uuid,'Canvaservaring',500,8000,'continue',
  current_setting('test.s191led_config')::jsonb,
  array['31000000-0000-4000-8000-000000002401']::uuid[],
  array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],2
)$$,'23514',null,'SVG markup cannot enter a live canvas image or background');
reset role;
set local role service_role;
update public.media_assets set mime_type = 'image/png'
where id = '20000000-0000-4000-8000-000000002401';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);

reset role;
set local role service_role;
update public.ledscores_goal_alerts
set draft_config = draft_config #- '{canvasExperience,scenes,goalOwn,portrait}'
where id = current_setting('test.s191led_alert_id')::uuid;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);
select throws_ok($$select public.publish_ledscores_goal_alert_v1(
  '10000000-0000-4000-8000-000000002401',current_setting('test.s191led_alert_id')::uuid,2,
  '50000000-0000-4000-8000-000000002402'
)$$,'23514',null,'publish revalidates a pre-existing malformed canvas draft');

select ok(position(
  'cardinality(normalized_assets) > 24' in
  pg_get_functiondef(
    'public.save_ledscores_goal_alert_before_s141_live_match_v1(uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer)'::regprocedure
  )
)>0,'the audited save flow enforces the raised but bounded 24-asset limit');
select ok(position(
  'version.id = pending.alert_version_id' in
  pg_get_functiondef(
    'public.get_ledscores_player_bootstrap_v1(text)'::regprocedure
  )
)>0 and position(
  'pending_catchup desc' in
  pg_get_functiondef(
    'public.get_ledscores_player_bootstrap_v1(text)'::regprocedure
  )
)>0,'the Player bootstrap prioritizes immutable versions needed by pending catch-up deliveries');
select ok(position('250000' in pg_get_constraintdef(
  (select oid from pg_constraint
   where conname='ledscores_goal_alerts_draft_config_check')
))>0,'the draft document has an explicit finite size boundary');

reset role;
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
values ('20000000-0000-4000-8000-000000002404','10000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401','image','Sites achtergrond','sites.png','image/png','ready','tenant-media','tenants/10000000-0000-4000-8000-000000002401/assets/20000000-0000-4000-8000-000000002404/original/sites.png',4096,repeat('4',64),1920,1080,now());
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
values('21000000-0000-4000-8000-000000002404','10000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002404','original','tenant-media','tenants/10000000-0000-4000-8000-000000002401/assets/20000000-0000-4000-8000-000000002404/original/sites.png','image/png',4096,repeat('4',64),1920,1080);
select set_config('test.s191led_design',jsonb_build_object('schemaVersion',1,'rendererVersion','sites-v11','sourceRevision','b1cae899af19fc39908217253094c5240d7359fc','provider','led-scores','themeId','onzetrots-tv','orientation','landscape','title','GOAL!','subtitle','Voor de club','background',jsonb_build_object('kind','tenant','mediaAssetId','20000000-0000-4000-8000-000000002404','checksumSha256',repeat('4',64)),'overlay',65,'accent','#FF8127','layout','full','scale',100,'align','left','safeArea',6,'seconds',8,'rowsPerPage',4,'ledTheme','blue','ledMoment','goal','ledSide','own','titleScale',100,'scoreScale',100,'logoScale',100,'teamScale',100,'showBranding',true,'showSceneLabel',true,'showClock',true,'showTimeline',true,'timelineLimit',5,'backgroundFit','cover','grunge',35,'animation','fade')::text,true);
select set_config('test.s191led_sites',jsonb_set(jsonb_set(current_setting('test.s191led_config')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration}',current_setting('test.s191led_design')::jsonb,true),'{canvasExperience,scenes,goalOwn,portrait,sitesConfiguration}',jsonb_set(current_setting('test.s191led_design')::jsonb,'{orientation}','"portrait"'::jsonb),true)::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002401',true);
select is((public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Getypte Sitesdoelpunten',500,8000,'continue',current_setting('test.s191led_sites')::jsonb,array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)->>'outcome'),'saved','real save RPC accepts typed paired scenes with exact tenant asset manifest');
select set_config('test.s191led_sites_alert',(select id::text from public.ledscores_goal_alerts where tenant_id='10000000-0000-4000-8000-000000002401' and name='Getypte Sitesdoelpunten'),true);
select is((select draft_config#>'{canvasExperience,scenes,goalOwn,portrait,sitesConfiguration}' from public.ledscores_goal_alerts where id=current_setting('test.s191led_sites_alert')::uuid),jsonb_set(current_setting('test.s191led_design')::jsonb,'{orientation}','"portrait"'::jsonb),'save and reload retain independent portrait configuration exactly');
select is((public.publish_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',current_setting('test.s191led_sites_alert')::uuid,1,'50000000-0000-4000-8000-000000002404')->>'outcome'),'published','paired Sites scenes publish through immutable alert versions');
select set_config('test.s191led_sites_version',(select current_published_version_id::text from public.ledscores_goal_alerts where id=current_setting('test.s191led_sites_alert')::uuid),true);
select is((select count(*) from public.ledscores_goal_alert_version_assets where alert_version_id=current_setting('test.s191led_sites_version')::uuid),3::bigint,'frozen manifest includes the Sites-only background');
select is((public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',current_setting('test.s191led_sites_alert')::uuid,current_setting('test.s191led_connection_id')::uuid,'Getypte Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,title}','"Nieuwe titel"'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],2)->>'outcome'),'saved','authoring a new title creates a revision while published data stays frozen');
select is((select config_snapshot#>>'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,title}' from public.ledscores_goal_alert_versions where id=current_setting('test.s191led_sites_version')::uuid),'GOAL!','published Sites title is immutable across draft saves');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,provider}','"sportlink"'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene rejects a different provider');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,orientation}','"portrait"'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene rejects mismatched orientation');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,html}','"<script>arbitrary</script>"'::jsonb,true),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene rejects arbitrary HTML fields');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,scale}','201'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene enforces bounded full configuration');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,background,checksumSha256}',to_jsonb(repeat('9',64))),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene rejects an altered media checksum');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,background,mediaAssetId}','"20000000-0000-4000-8000-000000002402"'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'scene rejects assets belonging to another tenant');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Ongeldige Sitesdoelpunten',500,8000,'continue',current_setting('test.s191led_sites')::jsonb,array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403']::uuid[],0)$$,'23514',null,'scene rejects a missing Sites-only asset manifest entry');
select throws_ok($$select public.save_ledscores_goal_alert_v1('10000000-0000-4000-8000-000000002401',null,current_setting('test.s191led_connection_id')::uuid,'Te veel rijen',500,8000,'continue',jsonb_set(current_setting('test.s191led_sites')::jsonb,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,rowsPerPage}','9'::jsonb),array['31000000-0000-4000-8000-000000002401']::uuid[],array['20000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002403','20000000-0000-4000-8000-000000002404']::uuid[],0)$$,'23514',null,'LED rejects more than eight rows so the renderer cannot omit authored rows');
select ok(not has_function_privilege('service_role','private.validate_ledscores_canvas_config_v1(uuid,jsonb,uuid[])','execute'),'service clients cannot bypass the guarded authoring RPC');
select * from finish();
rollback;
