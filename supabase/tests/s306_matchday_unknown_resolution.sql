begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug,screen_limit) values
 ('10000000-0000-4000-8000-000000000306','Source recovery A','matchday-s306-a',50),
 ('10000000-0000-4000-8000-000000000314','Source recovery B','matchday-s306-b',50);
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('matchday-s306-a','matchday-s306-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000306','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000314','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000315','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000306','Owner A'),('00000000-0000-4000-8000-000000000314','Owner B'),('00000000-0000-4000-8000-000000000315','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000306','tenant_owner'),
 ('10000000-0000-4000-8000-000000000314','00000000-0000-4000-8000-000000000314','tenant_owner'),
 ('10000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000315','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000306',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000306','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000314',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000314','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000306','10000000-0000-4000-8000-000000000314');
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
insert into auth.users(id,email)values('00000000-0000-4000-8000-000000000326','matchday-operator@test.invalid');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000000326','Wedstrijddienst');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000326','tenant_viewer');
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities)values('e3060000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000306','Alleen expliciet toegewezen draaiboek','{}');
update public.tenant_memberships set custom_role_id='e3060000-0000-4000-8000-000000000031'
 where tenant_id='10000000-0000-4000-8000-000000000306'and user_id='00000000-0000-4000-8000-000000000326';
create temporary table facts(key text primary key,value jsonb);
grant all on facts to authenticated;
create function pg_temp.tenant()returns uuid language sql immutable as $$select '10000000-0000-4000-8000-000000000306'::uuid$$;
create function pg_temp.connection_id()returns uuid language sql stable as $$select id from own_source where tenant_id=pg_temp.tenant()$$;
create function pg_temp.context(team text default 'own-team')returns jsonb language sql stable as $$select jsonb_build_object(
 'sourceId',data_source_id,'connectionId',id,'teamId',team,'competitionId','league','poolId','701','seasonId','2026','phaseId','phase','selectionMode','pinned')from own_source where tenant_id=pg_temp.tenant()$$;
insert into public.screens(id,tenant_id,name,status,orientation,resolution_width,resolution_height)values
 ('e3060000-0000-4000-8000-000000000007',pg_temp.tenant(),'Entree','active','landscape',1920,1080),
 ('e3060000-0000-4000-8000-000000000008',pg_temp.tenant(),'Clubmuur','active','landscape',1920,1080),
 ('e3060000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000314','Ander park','active','landscape',1920,1080);
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values('e3060000-0000-4000-8000-000000000002',pg_temp.tenant(),'image','Local publication image','fixture.png','image/png','ready',
 'tenants/10000000-0000-4000-8000-000000000306/assets/e3060000-0000-4000-8000-000000000002/original.png',100,repeat('b',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select 'e3060000-0000-4000-8000-000000000003',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
 from public.media_assets where id='e3060000-0000-4000-8000-000000000002';
create function pg_temp.make_release(label text)returns uuid language plpgsql as $$declare playlist_id uuid:=gen_random_uuid();revision bigint;result jsonb;begin
 insert into public.playlists(id,tenant_id,name)values(playlist_id,pg_temp.tenant(),label);
 insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,duration_seconds,fit_mode,muted)
 values(pg_temp.tenant(),playlist_id,'e3060000-0000-4000-8000-000000000002',0,10,'contain',true);
 select playlist.revision into revision from public.playlists playlist where id=playlist_id;
 result:=public.publish_playlist_to_targets_v3(playlist_id,revision,array['e3060000-0000-4000-8000-000000000007'::uuid],label,gen_random_uuid());
 return(result->>'releaseId')::uuid;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000306',true);
insert into facts values('ordinary',to_jsonb(pg_temp.make_release('Gewone planning A'))),('role',to_jsonb(pg_temp.make_release('Entree draaiboek'))),('playing',to_jsonb(pg_temp.make_release('Tijdens de wedstrijd')));
reset role;
update public.screens set default_playlist_id=release.playlist_id,default_release_id=release.id,assigned_playlist_id=release.playlist_id,
 assigned_release_id=release.id from public.playlist_releases release
 where screens.tenant_id=pg_temp.tenant()and screens.id in('e3060000-0000-4000-8000-000000000007','e3060000-0000-4000-8000-000000000008')
 and release.id=(select(value#>>'{}')::uuid from facts where key='ordinary');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status,capabilities)values
 ('e3060000-0000-4000-8000-000000000011',pg_temp.tenant(),'e3060000-0000-4000-8000-000000000007',repeat('d',64),'paired','{"matchdayExpiry":"matchday-expiry-v1"}'),
 ('e3060000-0000-4000-8000-000000000012',pg_temp.tenant(),'e3060000-0000-4000-8000-000000000008',repeat('e',64),'paired','{"matchdayExpiry":"matchday-expiry-v1"}');
create function pg_temp.configuration()returns jsonb language sql stable security definer set search_path=''as $$select jsonb_build_object(
 'schemaVersion',1,'name','Wedstrijddag op het park','timezone','Europe/Amsterdam','startsAt',now()-interval '5 minutes','endsAt',now()+interval '2 hours',
 'context',pg_temp.context(),'mainMatchId',(select id from public.sports_matches where tenant_id=pg_temp.tenant()and external_id='home'),
 'matches',(select jsonb_agg(private.matchday_match_s300_v1(pg_temp.tenant(),id,pg_temp.context(case when external_id='park'then'own-team-2'else'own-team'end))order by external_id)
 from public.sports_matches where tenant_id=pg_temp.tenant()and external_id in('home','neutral','park')),
 'roles',jsonb_build_array(jsonb_build_object('role','entrance','targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3060000-0000-4000-8000-000000000007')),
  'defaultReleaseId',(select value from facts where key='role'),'phaseReleaseIds',jsonb_build_object('playing',(select value from facts where key='playing')),'menuFallbacks','[]'::jsonb,'ledBinding',null),
 jsonb_build_object('role','clubwall','targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3060000-0000-4000-8000-000000000008')),
  'defaultReleaseId',(select value from facts where key='role'),'phaseReleaseIds','{}'::jsonb,'menuFallbacks','[]'::jsonb,'ledBinding',null)),
 'overlapDecisions','[]'::jsonb,'phaseWindows',jsonb_build_array(jsonb_build_object('phase','playing','startsAt',now()+interval '30 minutes','endsAt',now()+interval '45 minutes')))
$$;
set local role authenticated;
select is(public.get_matchday_availability_s300_v1(pg_temp.tenant())->>'enabled','false','WDG-13 pilot is disabled by default');
insert into facts values('save-input',jsonb_build_object('runbookId','e3060000-0000-4000-8000-000000000020','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',pg_temp.configuration()));
insert into facts values('saved',public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),(select value from facts where key='save-input')));
select is((select value->>'outcome'from facts where key='saved'),'applied','WDG-01 exact three-match draft is saved through the server writer');
select is(public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),(select value from facts where key='save-input')),(select value from facts where key='saved'),'WDG-06 exact save retry replays before mutable CAS');
insert into facts values('feature',public.set_matchday_enabled_s300_v1(pg_temp.tenant(),jsonb_build_object('enabled',true,'expectedRevision',0,'requestId',gen_random_uuid(),'reason','Interne canary activeren')));
select is((select value->>'outcome'from facts where key='feature'),'applied','explicit authorized operator enables the pilot');

reset role;
insert into public.screens(id,tenant_id,name,status,orientation,resolution_width,resolution_height)
 values('e3060000-0000-4000-8000-000000000099',pg_temp.tenant(),'Unmeasured non-target','active','landscape',null,null);
set local role authenticated;
insert into facts values('known-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000020',1));
select is((select value->>'canPublish'from facts where key='known-preflight'),'true','S306 an unrelated unknown screen does not block known targets');
select is((select value->'width'from jsonb_array_elements(public.get_matchday_workspace_s300_v1(pg_temp.tenant(),null)->'options'->'screens')value
 where value->>'id'='e3060000-0000-4000-8000-000000000099'),'null'::jsonb,'S306 workspace retains a real unknown width as JSON null');
reset role;
update public.screens set resolution_width=null,resolution_height=null where tenant_id=pg_temp.tenant()and id='e3060000-0000-4000-8000-000000000008';
set local role authenticated;
insert into facts values('unknown-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000020',1));
select is((select value->>'canPublish'from facts where key='unknown-preflight'),'false','S306 a selected unknown screen never passes server preflight');
select is((select count(*)::int from facts cross join lateral jsonb_array_elements(value->'issues')issue where key='unknown-preflight'and issue->>'code'='SCREEN_RESOLUTION_UNKNOWN'),1,'S306 preflight gives an explicit structured resolution reason');
select is((select target->>'ready'from facts cross join lateral jsonb_array_elements(value->'targets')target where key='unknown-preflight'and target->>'screenId'='e3060000-0000-4000-8000-000000000008'),'false','S306 the exact unknown target is marked blocked');
select is((select target->>'ready'from facts cross join lateral jsonb_array_elements(value->'targets')target where key='unknown-preflight'and target->>'screenId'='e3060000-0000-4000-8000-000000000007'),'true','S306 the other known target retains its valid readiness');
select is(public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3060000-0000-4000-8000-000000000020','expectedRevision',1,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='known-preflight')))->>'outcome','blocked','S306 publish rechecks a previously ready proof after dimensions become unknown');
reset role;
select is((select count(*)::int from public.matchday_publications where tenant_id=pg_temp.tenant()),0,'S306 a stale known proof creates no publication');
select is((select count(*)::int from public.matchday_publication_targets where tenant_id=pg_temp.tenant()),0,'S306 unknown dimensions never enter frozen targets');
update public.screens set resolution_width=1920 where tenant_id=pg_temp.tenant()and id='e3060000-0000-4000-8000-000000000008';
set local role authenticated;
select is(public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000020',1)->>'canPublish','false','S306 a missing height alone remains blocked');
reset role;
update public.screens set resolution_width=null,resolution_height=1080 where tenant_id=pg_temp.tenant()and id='e3060000-0000-4000-8000-000000000008';
set local role authenticated;
select is(public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000020',1)->>'canPublish','false','S306 a missing width alone remains blocked');
reset role;
insert into public.screen_groups(id,tenant_id,name,status)values('e3060000-0000-4000-8000-000000000098',pg_temp.tenant(),'Known and unknown','active');
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id)values(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000098','e3060000-0000-4000-8000-000000000007'),(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000098','e3060000-0000-4000-8000-000000000008');
set local role authenticated;
select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3060000-0000-4000-8000-000000000021','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',
 jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(jsonb_set(pg_temp.configuration()#>'{roles,0}','{targets}','[{"kind":"screen_group","id":"e3060000-0000-4000-8000-000000000098"}]')))));
select is(public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000021',1)->>'canPublish','false','S306 a group cannot bypass the concrete unknown-target guard');
reset role;
update public.screens set resolution_width=1920,resolution_height=1080 where tenant_id=pg_temp.tenant()and id='e3060000-0000-4000-8000-000000000008';
set local role authenticated;
select is(public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3060000-0000-4000-8000-000000000021',1)->>'canPublish','true','S306 a fresh proof succeeds after actual dimensions are known');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000314',true);
select throws_ok($$select public.preview_matchday_publication_s300_v1('10000000-0000-4000-8000-000000000306','e3060000-0000-4000-8000-000000000020',1)$$,'42501',null,'S306 foreign membership cannot inspect the target proof');
reset role;
select ok(not has_function_privilege('anon','private.matchday_preflight_s300_v1(uuid,uuid,bigint,uuid)','execute'),'S306 private preflight stays denied to anon');
select ok(not coalesce(has_function_privilege('authenticated',to_regprocedure('private.matchday_preflight_before_resolution_s306_v1(uuid,uuid,bigint,uuid)'),'execute'),false),'S306 preserved original is not a browser bypass');
select *from finish();
rollback;
