-- Regression: an applied available command is not a visible-frame receipt.
-- Normal human RPCs create the immutable publication/actions; the actual existing
-- device window-offer and heartbeat trigger provide the restoration evidence.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000300','Source recovery A','matchday-s300-a'),
 ('10000000-0000-4000-8000-000000000304','Source recovery B','matchday-s300-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('matchday-s300-a','matchday-s300-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000300','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000304','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000305','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000300','Owner A'),('00000000-0000-4000-8000-000000000304','Owner B'),('00000000-0000-4000-8000-000000000305','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000300','tenant_owner'),
 ('10000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000304','tenant_owner'),
 ('10000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000305','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000300',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000300','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000304',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000304','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000300','10000000-0000-4000-8000-000000000304');
grant select on own_source to authenticated;

create function pg_temp.seed() returns jsonb language sql immutable as $$select $seed${"schemaVersion":1,"rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","family":"matchday","orientation":"landscape","theme":"onzetrots-tv","name":"Onze wedstrijddag","club":{"name":"Eigen club","tagline":""},"title":"WEDSTRIJDDAG","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":6,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"clubmuur","backgroundPosition":"center","font":"Brush","fontChanged":true,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true},"visual":{"schemaVersion":1,"mode":"light","scrollSpeed":"normal","panelOpacity":94},"authoring":{"schemaVersion":1,"visualRevision":"onzetrots-20261024","headerSubtitles":{},"headerTexts":{},"welcomeScalePercent":150}}$seed$::jsonb$$;
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name) select tenant_id,id,'own-club','Own club' from own_source;
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,id,team_id,name,'{"competitionOptions":[{"externalId":"league","poolExternalId":"701","poolName":"C","period":"phase","season":null},{"externalId":"cup","poolExternalId":"702","poolName":"B","period":"cup-phase","season":null}]}'from own_source cross join(values('own-team','Own team'),('own-team-2','Own team 2'))teams(team_id,name);
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,scores_published,rows_json,metadata)
select tenant_id,id,competition,pool,'unknown',true,'[{"externalId":"own-team","teamName":"Own team","position":1,"played":1,"won":1,"drawn":0,"lost":0,"goalDifference":2,"points":3,"form":["W"]}]',jsonb_build_object('competition',jsonb_build_object('externalId',competition,'period',phase),'pool',jsonb_build_object('externalId',pool,'competitionExternalId',competition))from own_source cross join(values('league','701','phase'),('cup','702','cup-phase'))p(competition,pool,phase);
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,is_home_match)
select s.tenant_id,s.id,f.id,now()+make_interval(days=>f.days),f.status,
 jsonb_build_object('externalId',f.home,'name','Own team','score',2),jsonb_build_object('externalId',f.away,'name','Opponent','score',1),
 '{"externalId":"league","period":"phase","season":null}',jsonb_build_object('externalId',encode(extensions.digest(convert_to('pool-context','UTF8')||decode('00','hex')||convert_to('league|C','UTF8'),'sha256'),'hex'),'name','C','competitionExternalId','league'),true,false
from own_source s cross join(values('home',1,'scheduled','own-team','other'),('away',2,'scheduled','other','own-team'),('internal',3,'scheduled','own-team','own-team-2'),('neutral',2,'scheduled','own-team','other'),('lookalike',1,'scheduled','other','external'),('far',8,'scheduled','own-team','other'),('result-home',-1,'finished','own-team','other'),('result-away',-1,'finished','other','own-team'),('result-internal',-2,'finished','own-team','own-team-2'))f(id,days,status,home,away);

update public.sports_teams set metadata='{"competitionOptions":[{"externalId":"league","poolExternalId":"701","poolName":"Park","period":"phase","season":"2026"}]}';
update public.sports_matches set competition='{"externalId":"league","period":"phase","season":"2026"}',pool='{"externalId":"701","competitionExternalId":"league"}',
 starts_at=now()+interval '20 minutes',venue='{"field":"Veld 1"}';
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,is_home_match,venue)
select tenant_id,id,'park',now()+interval '40 minutes','scheduled','{"externalId":"own-team-2","name":"Eigen tweede team"}',
 '{"externalId":"other","name":"Parktegenstander"}','{"externalId":"league","period":"phase","season":"2026"}',
 '{"externalId":"701","competitionExternalId":"league"}',true,'{"field":"Veld 2"}'from own_source;
update public.sportlink_sync_policies set last_success_at=now(),next_sync_at=now()+interval '1 hour';
insert into auth.users(id,email)values('00000000-0000-4000-8000-000000000306','matchday-operator@test.invalid');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000000306','Wedstrijddienst');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000306','tenant_viewer');
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities)values('e3000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000300','Alleen expliciet toegewezen draaiboek','{}');
update public.tenant_memberships set custom_role_id='e3000000-0000-4000-8000-000000000031'
 where tenant_id='10000000-0000-4000-8000-000000000300'and user_id='00000000-0000-4000-8000-000000000306';
create temporary table facts(key text primary key,value jsonb);
grant all on facts to authenticated;
create function pg_temp.tenant()returns uuid language sql immutable as $$select '10000000-0000-4000-8000-000000000300'::uuid$$;
create function pg_temp.connection_id()returns uuid language sql stable as $$select id from own_source where tenant_id=pg_temp.tenant()$$;
create function pg_temp.context(team text default 'own-team')returns jsonb language sql stable as $$select jsonb_build_object(
 'sourceId',data_source_id,'connectionId',id,'teamId',team,'competitionId','league','poolId','701','seasonId','2026','phaseId','phase','selectionMode','pinned')from own_source where tenant_id=pg_temp.tenant()$$;
insert into public.screens(id,tenant_id,name,status,orientation,resolution_width,resolution_height)values
 ('e3000000-0000-4000-8000-000000000007',pg_temp.tenant(),'Entree','active','landscape',1920,1080),
 ('e3000000-0000-4000-8000-000000000008',pg_temp.tenant(),'Clubmuur','active','landscape',1920,1080),
 ('e3000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000304','Ander park','active','landscape',1920,1080);
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values('e3000000-0000-4000-8000-000000000002',pg_temp.tenant(),'image','Local publication image','fixture.png','image/png','ready',
 'tenants/10000000-0000-4000-8000-000000000300/assets/e3000000-0000-4000-8000-000000000002/original.png',100,repeat('b',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select 'e3000000-0000-4000-8000-000000000003',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
 from public.media_assets where id='e3000000-0000-4000-8000-000000000002';
create function pg_temp.make_release(label text)returns uuid language plpgsql as $$declare playlist_id uuid:=gen_random_uuid();revision bigint;result jsonb;begin
 insert into public.playlists(id,tenant_id,name)values(playlist_id,pg_temp.tenant(),label);
 insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,duration_seconds,fit_mode,muted)
 values(pg_temp.tenant(),playlist_id,'e3000000-0000-4000-8000-000000000002',0,10,'contain',true);
 select playlist.revision into revision from public.playlists playlist where id=playlist_id;
 result:=public.publish_playlist_to_targets_v3(playlist_id,revision,array['e3000000-0000-4000-8000-000000000007'::uuid],label,gen_random_uuid());
 return(result->>'releaseId')::uuid;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000300',true);
insert into facts values('ordinary',to_jsonb(pg_temp.make_release('Gewone planning A'))),('role',to_jsonb(pg_temp.make_release('Entree draaiboek'))),('playing',to_jsonb(pg_temp.make_release('Tijdens de wedstrijd')));
reset role;
update public.screens set default_playlist_id=release.playlist_id,default_release_id=release.id,assigned_playlist_id=release.playlist_id,
 assigned_release_id=release.id from public.playlist_releases release
 where screens.tenant_id=pg_temp.tenant()and screens.id in('e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000008')
 and release.id=(select(value#>>'{}')::uuid from facts where key='ordinary');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status,capabilities)values
 ('e3000000-0000-4000-8000-000000000011',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007',repeat('d',64),'paired','{"matchdayExpiry":"matchday-expiry-v1"}'),
 ('e3000000-0000-4000-8000-000000000012',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000008',repeat('e',64),'paired','{"matchdayExpiry":"matchday-expiry-v1"}');
create function pg_temp.configuration()returns jsonb language sql stable security definer set search_path=''as $$select jsonb_build_object(
 'schemaVersion',1,'name','Wedstrijddag op het park','timezone','Europe/Amsterdam','startsAt',now()-interval '5 minutes','endsAt',now()+interval '2 hours',
 'context',pg_temp.context(),'mainMatchId',(select id from public.sports_matches where tenant_id=pg_temp.tenant()and external_id='home'),
 'matches',(select jsonb_agg(private.matchday_match_s300_v1(pg_temp.tenant(),id,pg_temp.context(case when external_id='park'then'own-team-2'else'own-team'end))order by external_id)
 from public.sports_matches where tenant_id=pg_temp.tenant()and external_id in('home','neutral','park')),
 'roles',jsonb_build_array(jsonb_build_object('role','entrance','targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3000000-0000-4000-8000-000000000007')),
  'defaultReleaseId',(select value from facts where key='role'),'phaseReleaseIds',jsonb_build_object('playing',(select value from facts where key='playing')),'menuFallbacks','[]'::jsonb,'ledBinding',null),
 jsonb_build_object('role','clubwall','targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3000000-0000-4000-8000-000000000008')),
  'defaultReleaseId',(select value from facts where key='role'),'phaseReleaseIds','{}'::jsonb,'menuFallbacks','[]'::jsonb,'ledBinding',null)),
 'overlapDecisions','[]'::jsonb,'phaseWindows',jsonb_build_array(jsonb_build_object('phase','playing','startsAt',now()+interval '30 minutes','endsAt',now()+interval '45 minutes')))
$$;
set local role authenticated;
select public.set_matchday_enabled_s300_v1(pg_temp.tenant(),jsonb_build_object('enabled',true,'expectedRevision',0,'requestId',gen_random_uuid(),'reason','Interne herstelregressie'));
reset role;
-- SQL admission fixture for an already published menu. Physical assets and
-- rendering are tested by their existing gates; these bytes are not claimed here.
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('e3000000-0000-4000-8000-000000000060',pg_temp.tenant(),'Bestaande menubron','manual_products');
insert into public.tenant_products(id,tenant_id,data_source_id,source,slug,name,price_cents)values
 ('e3000000-0000-4000-8000-000000000061',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000060','manual','clubkoffie','Clubkoffie',250);
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
select 'e3000000-0000-4000-8000-000000000062',pg_temp.tenant(),'Vast gepubliceerd menu','menu','landscape',id,current_published_version_id,'e3000000-0000-4000-8000-000000000060','{}'
 from public.dynamic_templates where slug='editorial-arena-menubord-dark-landscape'and status='published';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,dynamic_slide_version_id)
select 'e3000000-0000-4000-8000-000000000064',tenant_id,id,template_version_id,data_source_id,repeat('a',64),
 '{"type":"menu","menuDocument":{"pages":[{"blocks":[{"productNodes":[{"id":"coffee","kind":"product","productRef":{"productId":"e3000000-0000-4000-8000-000000000061"},"snapshotFallback":{"name":"Clubkoffie","price":{"amountMinor":250,"currency":"EUR"}}}]}]}]}}',
 'ready',active_draft_version_id from public.dynamic_slides where id='e3000000-0000-4000-8000-000000000062';
insert into public.playlists(id,tenant_id,name)values('e3000000-0000-4000-8000-000000000065',pg_temp.tenant(),'Vaste menuversie');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3000000-0000-4000-8000-000000000066',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000065',1,repeat('e',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,
 asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,dynamic_snapshot_id)
select pg_temp.tenant(),'e3000000-0000-4000-8000-000000000065','e3000000-0000-4000-8000-000000000066',null,asset.id,variant.id,0,10,'contain',true,
 asset.kind,asset.title,variant.storage_path,variant.mime_type,variant.file_size_bytes,variant.checksum_sha256,1920,1080,
 'e3000000-0000-4000-8000-000000000064'
 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
 where asset.id='e3000000-0000-4000-8000-000000000002';
insert into facts values('catalog-before',(select to_jsonb(product)from public.tenant_products product where id='e3000000-0000-4000-8000-000000000061'));
select is((select count(*)::int from private.matchday_menu_placements_s300_v1(pg_temp.tenant(),array['e3000000-0000-4000-8000-000000000066'::uuid])),1,'exact frozen product node is discovered from the published menu placement');
update public.screens set default_playlist_id='e3000000-0000-4000-8000-000000000065',default_release_id='e3000000-0000-4000-8000-000000000066',
 assigned_playlist_id='e3000000-0000-4000-8000-000000000065',assigned_release_id='e3000000-0000-4000-8000-000000000066'
 where tenant_id=pg_temp.tenant()and id in('e3000000-0000-4000-8000-000000000008','e3000000-0000-4000-8000-000000000007');
set local role authenticated;
insert into facts values('menu-configuration',jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(jsonb_build_object('role','canteen',
 'targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3000000-0000-4000-8000-000000000008'),jsonb_build_object('kind','screen','id','e3000000-0000-4000-8000-000000000007')),'defaultReleaseId','e3000000-0000-4000-8000-000000000066',
 'phaseReleaseIds','{}'::jsonb,'menuFallbacks',jsonb_build_array(jsonb_build_object('menuSnapshotId','e3000000-0000-4000-8000-000000000064','placementId','coffee',
 'productId','e3000000-0000-4000-8000-000000000061','productLabel','Clubkoffie','unavailableReleaseId',(select value from facts where key='playing'))),'ledBinding',null))));
select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000023','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',(select value from facts where key='menu-configuration')));
insert into facts values('menu-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000023',1));
select is((select value->>'canPublish'from facts where key='menu-preflight'),'true','preflight validates the exact immutable menu placement and its configured replacement');
insert into facts values('menu-published',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000023','expectedRevision',1,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='menu-preflight'))));
insert into facts values('menu-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000023','publicationId',(select value->'publicationId'from facts where key='menu-published'),
 'expectedRevision',0,'requestId',gen_random_uuid(),'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008'),'endsAt',now()+interval '15 minutes',
 'reason','Koffie tijdelijk niet beschikbaar','kind','sold_out','menuSnapshotId','e3000000-0000-4000-8000-000000000064','placementId','coffee','productId','e3000000-0000-4000-8000-000000000061'));
select throws_ok($$select public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object('requestId',gen_random_uuid(),'placementId','foreign-placement')from facts where key='menu-input'))$$,'42501',null,'another or invented placement cannot be changed through a matching product label');

reset role;
create function pg_temp.available(expected bigint default 1)returns jsonb language sql stable as $$select value||jsonb_build_object(
 'kind','available','expectedRevision',expected,'requestId',gen_random_uuid(),'reason','Koffie weer beschikbaar')from facts where key='menu-input'$$;
create function pg_temp.offer_input(bootstrap jsonb)returns jsonb language sql immutable as $$select jsonb_build_object(
 'publicationId',bootstrap#>'{matchday_window,publication_id}','targetId',bootstrap#>'{matchday_window,target_id}',
 'windowId',bootstrap#>'{matchday_window,window_id}','contentHash',bootstrap#>'{matchday_window,content_hash}',
 'fallbackReleaseId',bootstrap#>'{matchday_window,fallback_release_id}','fallbackCompositionId',bootstrap#>'{matchday_window,fallback_composition,id}',
 'fallbackCompositionRevision',bootstrap#>'{matchday_window,fallback_composition,revision}','fallbackCompositionHash',bootstrap#>'{matchday_window,fallback_composition_hash}')$$;
-- A shared object head may only be superseded with its full still-active
-- target scope. Partial grants never imply authority over the other target.
savepoint shared_predecessor_scope;
set local role authenticated;
insert into facts values('shared-soldout',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object(
 'requestId',gen_random_uuid(),'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008','e3000000-0000-4000-8000-000000000007'))from facts where key='menu-input')));
select public.grant_matchday_operation_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000023',
 'publicationId',(select value->'publicationId'from facts where key='menu-published'),'userId','00000000-0000-4000-8000-000000000306',
 'expectedRevision',0,'requestId',gen_random_uuid(),'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008'),
 'objectIds',jsonb_build_array('menu:e3000000-0000-4000-8000-000000000064:coffee:e3000000-0000-4000-8000-000000000061'),
 'actionKinds',jsonb_build_array('available'),'endsAt',now()+interval '1 hour','revoke',false));
reset role;
insert into facts values('shared-before',(select jsonb_build_object('lifecycle',to_jsonb(lifecycle),'schedules',
 (select jsonb_agg(to_jsonb(schedule)order by schedule.id)from public.content_schedules schedule join public.matchday_owned_schedules owned
 on owned.tenant_id=schedule.tenant_id and owned.schedule_id=schedule.id where owned.action_id=lifecycle.action_id),
 'head',(select to_jsonb(head)from public.matchday_object_states head where head.current_action_id=lifecycle.action_id))
 from public.matchday_action_lifecycle lifecycle where action_id=(select(value->>'actionId')::uuid from facts where key='shared-soldout')));
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000306',true);
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available())->>'outcome','blocked','delegate for A cannot supersede an active sold-out action spanning A and B');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000300',true);
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available())->>'outcome','blocked','owner must also explicitly select the full previous action scope');
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object('expectedRevision',1,'requestId',gen_random_uuid())from facts where key='menu-input'))->>'outcome',
 'blocked','a new sold-out revision also cannot silently shrink the active A and B target scope');
reset role;
select is((select jsonb_build_object('lifecycle',to_jsonb(lifecycle),'schedules',
 (select jsonb_agg(to_jsonb(schedule)order by schedule.id)from public.content_schedules schedule join public.matchday_owned_schedules owned
 on owned.tenant_id=schedule.tenant_id and owned.schedule_id=schedule.id where owned.action_id=lifecycle.action_id),
 'head',(select to_jsonb(head)from public.matchday_object_states head where head.current_action_id=lifecycle.action_id))
 from public.matchday_action_lifecycle lifecycle where action_id=(select(value->>'actionId')::uuid from facts where key='shared-soldout')),
 (select value from facts where key='shared-before'),'blocked partial supersessions retain every old schedule, lifecycle and object head byte for byte');
set local role authenticated;
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available()||jsonb_build_object('screenIds',
 jsonb_build_array('e3000000-0000-4000-8000-000000000008','e3000000-0000-4000-8000-000000000007')))->>'outcome','applied','owner can explicitly restore the complete A and B predecessor scope');
insert into facts values('shared-field-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000023',
 'publicationId',(select value->'publicationId'from facts where key='menu-published'),'expectedRevision',0,'requestId',gen_random_uuid(),
 'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008','e3000000-0000-4000-8000-000000000007'),
 'endsAt',now()+interval '15 minutes','reason','Veldmelding op beide doelen','kind','field','matchId',pg_temp.configuration()->'mainMatchId','field','Veld 3'));
select public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='shared-field-input'));
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object('expectedRevision',1,'requestId',gen_random_uuid(),
 'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008'),'field','Veld 4')from facts where key='shared-field-input'))->>'outcome',
 'blocked','a field correction cannot silently end the same active object on an unselected second screen');
reset role;
rollback to shared_predecessor_scope;
-- Deterministic read-transition regression for the same race separately
-- exercised with real concurrent connections and a wall-clock expiry. The
-- first authorized target read is old; after the delivery lock, it is new.
savepoint late_offer_read_transition;
set local role authenticated;
insert into facts values('late-soldout',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='menu-input')));
reset role;
insert into facts values('late-before',public.get_player_effective_target_v1(repeat('e',64)));
set local role authenticated;
insert into facts values('late-available',public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available()));
reset role;
insert into facts values('late-after',public.get_player_effective_target_v1(repeat('e',64)));
create temporary sequence s300_offer_read_transition;
create or replace function public.get_player_effective_target_v1(p_token_hash text)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare selected_key text;begin
 selected_key:=case when nextval('pg_temp.s300_offer_read_transition')=1 then'late-before'else'late-after'end;
 return(select value from pg_temp.facts where key=selected_key);
end$$;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('e',64),(select pg_temp.offer_input(value)from facts where key='late-before')),
 false,'offer is rejected when the authorized target changes between the initial read and the locked recheck');
select ok((select offered_at is null and window_offers_json='[]'::jsonb from public.matchday_deliveries
 where action_id=(select(value->>'actionId')::uuid from facts where key='late-soldout')),'a stale pre-lock read cannot archive or offer a window already removed by availability');
select set_config('request.jwt.claim.role','authenticated',true);
rollback to late_offer_read_transition;
-- A semantic no-op is explicitly blocked and replayable, with no fictional
-- action, delivery, visible frame or CAS increment. Roll back this branch so
-- the unfixed source also reaches the independent causal receipt regression.
savepoint no_predecessor;
set local role authenticated;
insert into facts values('noop-input',pg_temp.available(0));
insert into facts values('noop',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='noop-input')));
select is((select value->>'outcome'from facts where key='noop'),'blocked','availability without a sold-out predecessor is explicitly blocked');
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='noop-input')),
 (select value from facts where key='noop'),'the blocked no-op nonce replays its exact original receipt');
reset role;
select is((select count(*)::int from public.matchday_actions where tenant_id=pg_temp.tenant()),0,'no-op availability creates no action or delivery evidence');
rollback to no_predecessor;
set local role authenticated;
insert into facts values('menu-soldout',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='menu-input')));
reset role;
select is((select value->>'outcome'from facts where key='menu-soldout'),'applied','exact active sold-out predecessor is issued through the ordinary human RPC');
savepoint expired_predecessor;
create or replace function private.matchday_now_s300_v1()returns timestamptz language sql volatile set search_path=''as $$select now()+interval '16 minutes'$$;
set local role authenticated;
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available()||jsonb_build_object('endsAt',now()+interval '45 minutes'))->>'outcome',
 'blocked','an expired sold-out predecessor is explicitly blocked even while publication and new command remain in time');
reset role;
select is((select count(*)::int from public.matchday_actions where tenant_id=pg_temp.tenant()),1,'expired availability creates no new action or visible-frame evidence');
rollback to expired_predecessor;
savepoint missing_target_predecessor;
delete from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='menu-soldout');
set local role authenticated;
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available())->>'outcome','blocked','selected frozen target requires its own exact predecessor delivery');
reset role;
rollback to missing_target_predecessor;
-- If a device never saw the replaced window, cancellation is real but there
-- cannot be a frame acknowledgement for that unknown identity.
savepoint never_offered;
set local role authenticated;
insert into facts values('unseen-input',pg_temp.available());
insert into facts values('unseen',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='unseen-input')));
reset role;
select is((select value->>'outcome'from facts where key='unseen'),'applied','an unoffered temporary replacement can still be removed');
select is((select status from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='unseen')),'skipped','never-offered predecessor yields an explicit skipped receipt rather than an endless queue');
select ok((select offered_at is null and received_at is null and prepared_at is null and rendered_at is null and restored_at is null and confirmed_release_id is null
 from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='unseen')),'skipping an unseen window fabricates no receipt or frame fields');
select matches((select detail from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='unseen')),'geen herstelbeeld bevestigd','skipped availability explains the exact absence of frame evidence');
set local role authenticated;
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),pg_temp.available(2))->>'outcome','blocked','repeated availability without another sold-out action is explicitly blocked');
reset role;
rollback to never_offered;
insert into facts values('soldout-bootstrap',public.get_player_effective_target_v1(repeat('e',64)));
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('e',64),(select pg_temp.offer_input(value)from facts where key='soldout-bootstrap')),true,'trusted offer archives the exact source window and ordinary menu restoration identity');
create function pg_temp.window_report(phase text,release_id uuid,at_time timestamptz)returns jsonb language sql stable as $$select jsonb_build_object(
 'schemaVersion',1,'publicationId',value#>'{matchday_window,publication_id}','targetId',value#>'{matchday_window,target_id}',
 'windowId',value#>'{matchday_window,window_id}','contentHash',value#>'{matchday_window,content_hash}','releaseId',release_id,
 'phase',phase,'reportedAt',at_time,'compositionId',null,'compositionRevision',null,'compositionHash',null)from facts where key='soldout-bootstrap'$$;
create function pg_temp.report(phase text,release_id uuid,frame_time timestamptz default null,device_id uuid default 'e3000000-0000-4000-8000-000000000012',report_patch jsonb default '{}')returns void
language plpgsql as $$declare stamp timestamptz:=clock_timestamp();begin
 update public.player_devices set last_seen_at=stamp,active_release_id=release_id,active_composition_id=null,
  current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',release_id,'firstFrameAt',coalesce(frame_time,stamp)),
   'matchdayWindow',pg_temp.window_report(phase,release_id,stamp)||report_patch)where id=device_id;
end$$;
select pg_temp.report('rendered',(select(value#>>'{}')::uuid from facts where key='playing'));
insert into facts values('old-frame',(select to_jsonb(rendered_at)from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='menu-soldout')));
select ok((select value is not null and value<>'null'::jsonb from facts where key='old-frame'),'the predecessor has a real accepted temporary frame before availability');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into facts values('available-input',pg_temp.available());
insert into facts values('available',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='available-input')));
select is((select value->>'outcome'from facts where key='available'),'applied','availability supersedes exactly the issued active sold-out revision');
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='available-input')),
 (select value from facts where key='available'),'lost availability command response replays its original immutable action identity');
reset role;
select ok((select restored_at is null and confirmed_release_id is null from public.matchday_deliveries
 where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'applied availability and changed assignment alone do not confirm a visible frame');
select is(public.get_player_effective_target_v1(repeat('e',64))->>'desired_release_id','e3000000-0000-4000-8000-000000000066','ordinary resolver actually returns the exact original menu before restoration acknowledgement');
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066',(select(value#>>'{}')::timestamptz from facts where key='old-frame'));
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'a pre-command frame cannot confirm a new availability revision');
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066',null,'e3000000-0000-4000-8000-000000000011');
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'another paired screen cannot confirm the selected target restoration');
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066',null,'e3000000-0000-4000-8000-000000000012',jsonb_build_object('contentHash',repeat('f',64)));
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'wrong exact source-window hash does not confirm availability');
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066',null,'e3000000-0000-4000-8000-000000000012',jsonb_build_object('targetId','e3000000-0000-4000-8000-000000000099'));
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'another target identity cannot confirm availability on the same device');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status,capabilities)values
 ('e3000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000304','e3000000-0000-4000-8000-000000000009',repeat('f',64),'paired','{"matchdayExpiry":"matchday-expiry-v1"}');
select pg_temp.report('restored',null,null,'e3000000-0000-4000-8000-000000000013',jsonb_build_object('releaseId','e3000000-0000-4000-8000-000000000066'));
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'a different tenant device cannot confirm the selected action or release');
select pg_temp.report('restored',(select(value#>>'{}')::uuid from facts where key='role'));
select ok((select restored_at is null from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'a different unoffered immutable release cannot become availability evidence');
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066');
select is((select status from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='menu-soldout')),'restored','actual existing window trigger accepts the exact offered menu and fresh restoration frame');
select is((select status from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'restored','the same validated predecessor restoration confirms the precise availability action receipt');
select is((select confirmed_release_id::text from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),
 'e3000000-0000-4000-8000-000000000066','availability is confirmed against the actually restored immutable release');
select ok((select offered_at is null and received_at is null and prepared_at is null and rendered_at is null and restored_at is not null
 from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'causal restoration does not fabricate receipt, preparation, offer or temporary render times');
select is((select restored_at from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),
 (select restored_at from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='menu-soldout')),'available confirmedAt uses the accepted restoration time, not the older temporary-frame time');
select is((select count(*)::int from public.audit_events where action='matchday.delivery.restored'
 and metadata->>'actionId'=(select value->>'actionId'from facts where key='available')and metadata->>'sourceActionId'=(select value->>'actionId'from facts where key='menu-soldout')),
 1,'one causal audit binds the availability revision to the exact predecessor frame evidence');
insert into facts values('available-evidence',(select to_jsonb(delivery)from public.matchday_deliveries delivery where action_id=(select(value->>'actionId')::uuid from facts where key='available')));
select pg_temp.report('restored','e3000000-0000-4000-8000-000000000066');
select is((select to_jsonb(delivery)from public.matchday_deliveries delivery where action_id=(select(value->>'actionId')::uuid from facts where key='available')),
 (select value from facts where key='available-evidence'),'a duplicate or late predecessor report does not overwrite the confirmed availability receipt');
set local role authenticated;
insert into facts values('workspace-confirmed',public.get_matchday_workspace_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000023'));
select is((select item->>'status'from facts cross join lateral jsonb_array_elements(value#>'{selected,deliveries}')item
 where key='workspace-confirmed'and item->>'actionId'=(select value->>'actionId'from facts where key='available')),'restored','normal authorized Control projection exposes the availability restoration receipt');
reset role;
select is((select item->'confirmedAt'from facts cross join lateral jsonb_array_elements(value#>'{selected,deliveries}')item
 where key='workspace-confirmed'and item->>'actionId'=(select value->>'actionId'from facts where key='available')),
 (select to_jsonb(restored_at)from public.matchday_deliveries where action_id=(select(value->>'actionId')::uuid from facts where key='available')),'projected availability release and confirmedAt refer to the same accepted restored frame');
select is((select to_jsonb(product)from public.tenant_products product where id='e3000000-0000-4000-8000-000000000061'),
 (select value from facts where key='catalog-before'),'complete receipt lifecycle leaves all catalogue, product, price and source fields unchanged');
select ok(case when to_regprocedure('private.matchday_available_restoration_receipt_s300_v1()')is null then false
 else not has_function_privilege('authenticated','private.matchday_available_restoration_receipt_s300_v1()','execute')end,
 'human/browser role cannot invoke the trusted receipt propagation directly');
select *from finish();
rollback;
