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
select is(public.get_matchday_availability_s300_v1(pg_temp.tenant())->>'enabled','false','WDG-13 pilot is disabled by default');
insert into facts values('save-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',pg_temp.configuration()));
insert into facts values('saved',public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),(select value from facts where key='save-input')));
select is((select value->>'outcome'from facts where key='saved'),'applied','WDG-01 exact three-match draft is saved through the server writer');
select is(public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),(select value from facts where key='save-input')),(select value from facts where key='saved'),'WDG-06 exact save retry replays before mutable CAS');
insert into facts values('feature',public.set_matchday_enabled_s300_v1(pg_temp.tenant(),jsonb_build_object('enabled',true,'expectedRevision',0,'requestId',gen_random_uuid(),'reason','Interne canary activeren')));
select is((select value->>'outcome'from facts where key='feature'),'applied','explicit authorized operator enables the pilot');
insert into facts values('preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000020',1));
insert into facts values('workspace-before-publish',public.get_matchday_workspace_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000020'));
select is((select value->>'canPublish'from facts where key='preflight'),'true','WDG-02 real immutable releases and modern paired devices pass bounded preflight');
select is((select jsonb_array_length(value->'targets')from facts where key='preflight'),2,'preflight expands exactly two explicit screen roles');
insert into facts values('publish-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020','expectedRevision',1,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='preflight')));
insert into facts values('published',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),(select value from facts where key='publish-input')));
select is((select value->>'outcome'from facts where key='published'),'applied','WDG-01 confirmed preflight publishes a frozen runbook version');
select is(public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),(select value from facts where key='publish-input')),(select value from facts where key='published'),'WDG-06 lost publish response replays the exact immutable publication');
reset role;
select is((select count(*)::int from public.matchday_publication_targets where tenant_id=pg_temp.tenant()),2,'WDG-03 concrete targets are frozen separately from groups');
select is((select count(*)::int from public.matchday_owned_schedules where tenant_id=pg_temp.tenant()),4,'default and phase windows use bounded canonical Publisher schedules');
select is((select count(*)::int from public.screens where tenant_id=pg_temp.tenant()and assigned_release_id=(select(value#>>'{}')::uuid from facts where key='role')),2,'actual screen assignments agree with the shared resolver at publication');
set local role authenticated;
insert into facts values('workspace',public.get_matchday_workspace_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000020'));
select is((select value#>>'{selected,readScope}'from facts where key='workspace'),'full','publisher workspace explicitly identifies its complete authorized read scope');
select is((select jsonb_array_length(value#>'{selected,publication,targets}')from facts where key='workspace'),2,'workspace exposes the two concrete immutable publication targets');
select is((select value#>>'{selected,publication,version}'from facts where key='workspace'),'1','immutable publication number is distinct from mutable lifecycle CAS');
insert into facts values('action-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'expectedRevision',0,'requestId',gen_random_uuid(),
 'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000007'),'endsAt',now()+interval '20 minutes','reason','Veldwijziging bevestigd',
 'kind','field','matchId',(select value#>'{selected,configuration,mainMatchId}'from facts where key='workspace'),'field','Veld 3'));
insert into facts values('action',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='action-input')));
select is((select value->>'outcome'from facts where key='action'),'applied','WDG-05 a field correction is issued only to the explicitly selected frozen target');
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='action-input')),
 (select value from facts where key='action'),'WDG-06 an exact lost-response action retry returns its original result');
insert into facts values('action-conflict',public.apply_matchday_action_s300_v1(pg_temp.tenant(),
 (select value||jsonb_build_object('requestId',gen_random_uuid(),'field','Veld 4')from facts where key='action-input')));
select is((select value->>'outcome'from facts where key='action-conflict'),'conflict','WDG-06 another operator must review the actual object revision before a conflicting correction');
insert into facts values('workspace-after-action',public.get_matchday_workspace_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000020'));
select is((select value#>>'{selected,publication,version}'from facts where key='workspace-after-action'),'1','an operational action does not mutate the immutable publication number');
insert into facts values('delegation-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'userId','00000000-0000-4000-8000-000000000306','expectedRevision',0,'requestId',gen_random_uuid(),
 'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000007'),
 'objectIds',jsonb_build_array('match:'||(select value#>>'{selected,configuration,mainMatchId}'from facts where key='workspace')||':field'),
 'actionKinds',jsonb_build_array('field'),'endsAt',now()+interval '1 hour','revoke',false));
insert into facts values('delegation',public.grant_matchday_operation_s300_v1(pg_temp.tenant(),(select value from facts where key='delegation-input')));
select is((select value->>'outcome'from facts where key='delegation'),'applied','WDG-11 publisher grants only explicit object, action, screen and expiry');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000306',true);
insert into facts values('delegated-workspace',public.get_matchday_workspace_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000020'));
select is((select value#>>'{selected,readScope}'from facts where key='delegated-workspace'),'delegated','bounded operator sees an explicit delegated read projection');
select is((select jsonb_array_length(value#>'{selected,configuration,matches}')from facts where key='delegated-workspace'),1,'delegate cannot inspect other park match objects');
select is((select jsonb_array_length(value#>'{selected,publication,targets}')from facts where key='delegated-workspace'),1,'delegate cannot inspect unassigned publication targets');
select is((select jsonb_array_length(value#>'{options,screens}')from facts where key='delegated-workspace'),0,'delegate receives no global screen/source/member options');
select throws_ok($$select public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object('requestId',gen_random_uuid(),
 'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000008'))from facts where key='action-input'))$$,
 '42501',null,'WDG-11 delegated action cannot expand to an unassigned screen');
select throws_ok($$select public.close_matchday_publication_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'expectedRevision',1,'requestId',gen_random_uuid(),'operation','close','reason','Onbevoegde sluiting'))$$,
 '42501',null,'delegate never receives global publication lifecycle rights');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000300',true);
select throws_ok($$select public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||'{"field":"Andere body"}'from facts where key='action-input'))$$,
 '23505',null,'same action nonce with a different payload is rejected');
select ok(not has_function_privilege('authenticated','private.matchday_can_operate_s300_v1(uuid,uuid,text,text,uuid[],timestamptz)','execute'),
 'private operational authority helper is not directly callable by a browser');
select throws_ok($$select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId',gen_random_uuid(),'expectedRevision',0,'requestId',gen_random_uuid(),
 'configuration',jsonb_set(pg_temp.configuration(),'{timezone}','"UTC"')))$$,'22023',null,'valid but different timezone cannot replace the canonical association timezone');
reset role;
insert into facts values('bootstrap',public.get_player_effective_target_v1(repeat('d',64)));
select ok((select value->'matchday_window'is not null from facts where key='bootstrap'),'actual effective owned schedule receives bounded Player window metadata');
select is((select value#>>'{matchday_window,fallback_release_id}'from facts where key='bootstrap'),
 (select value#>>'{}'from facts where key='ordinary'),'END fallback is the ordinary shared-resolver result');
select is((select value#>>'{matchday_window,unsupported_release_id}'from facts where key='bootstrap'),
 (select value#>>'{}'from facts where key='ordinary'),'noncapable profiles receive the ordinary NOW result');
create function pg_temp.offer_input(bootstrap jsonb)returns jsonb language sql immutable as $$select jsonb_build_object(
 'publicationId',bootstrap#>'{matchday_window,publication_id}','targetId',bootstrap#>'{matchday_window,target_id}',
 'windowId',bootstrap#>'{matchday_window,window_id}','contentHash',bootstrap#>'{matchday_window,content_hash}',
 'fallbackReleaseId',bootstrap#>'{matchday_window,fallback_release_id}','fallbackCompositionId',bootstrap#>'{matchday_window,fallback_composition,id}',
 'fallbackCompositionRevision',bootstrap#>'{matchday_window,fallback_composition,revision}','fallbackCompositionHash',bootstrap#>'{matchday_window,fallback_composition_hash}')$$;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),(select pg_temp.offer_input(value)from facts where key='bootstrap')),true,
 'server records the exact issued device/window and canonical immutable fallback identity');
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),(select pg_temp.offer_input(value)from facts where key='bootstrap')),true,
 'duplicate offers are idempotent and do not consume the identity archive');
select is((select jsonb_array_length(window_offers_json)from public.matchday_deliveries where tenant_id=pg_temp.tenant()
 and schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),1,'ordinary observations do not append duplicate immutable fallback identities');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.mutate_content_schedule_v2(pg_temp.tenant(),null,0,'create',jsonb_build_object('name','Gewone planning op grens','targetKind','screen',
 'targetId','e3000000-0000-4000-8000-000000000007','releaseId',(select value from facts where key='playing'),'timezoneName','Europe/Amsterdam','source','publisher','priority',200,
 'scheduleKind','once','startsAt',now()+interval '2 hours','endsAt',now()+interval '3 hours','recurrence','{}'::jsonb,'enabled',true),gen_random_uuid());
reset role;
insert into facts values('bootstrap-changed-normal',public.get_player_effective_target_v1(repeat('d',64)));
select is((select value#>>'{matchday_window,content_hash}'from facts where key='bootstrap-changed-normal'),
 (select value#>>'{matchday_window,content_hash}'from facts where key='bootstrap'),'a changed future ordinary rule does not mutate the immutable temporal window hash');
select is((select value#>>'{matchday_window,fallback_release_id}'from facts where key='bootstrap-changed-normal'),
 (select value#>>'{}'from facts where key='playing'),'WDG-07 the END fallback follows the newly valid ordinary rule at the exclusive boundary');
select is((select value#>>'{matchday_window,unsupported_release_id}'from facts where key='bootstrap-changed-normal'),
 (select value#>>'{}'from facts where key='ordinary'),'future ordinary replacement is not served early to a noncapable profile');
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),(select pg_temp.offer_input(value)from facts where key='bootstrap-changed-normal')),true,
 'new canonical future fallback is archived without erasing the earlier offline offer');
select is((select jsonb_array_length(window_offers_json)from public.matchday_deliveries where tenant_id=pg_temp.tenant()
 and schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),2,'both prior and new immutable fallback identities remain available as historical evidence');
select set_config('request.jwt.claim.role','authenticated',true);
-- Direct RPCs retain the membership boundary after a grant recipient leaves.
delete from public.tenant_memberships where tenant_id=pg_temp.tenant()and user_id='00000000-0000-4000-8000-000000000306';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000306',true);
select throws_ok($$select public.get_matchday_workspace_s300_v1(pg_temp.tenant(),null)$$,'42501',null,'removed member cannot inspect even feature/settings metadata with an old delegation');
select throws_ok($$select public.get_matchday_availability_s300_v1(pg_temp.tenant())$$,'42501',null,'removed delegate cannot inspect navigation availability');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000300',true);
reset role;
insert into public.tenant_memberships(tenant_id,user_id,role,custom_role_id)values(pg_temp.tenant(),'00000000-0000-4000-8000-000000000306','tenant_viewer','e3000000-0000-4000-8000-000000000031');
select set_config('request.jwt.claim.role','service_role',true);
insert into facts values('device-actions',public.get_player_matchday_actions_s300_v1(repeat('d',64),array[(select(value->>'publicationId')::uuid from facts where key='published')],gen_random_uuid()));
select is((select jsonb_array_length(value->'actions')from facts where key='device-actions'),1,'only the selected device receives its one current field overlay');
select is(jsonb_array_length(public.get_player_matchday_actions_s300_v1(repeat('e',64),array[(select(value->>'publicationId')::uuid from facts where key='published')],gen_random_uuid())->'actions'),0,'another frozen screen receives no foreign selected overlay');
select throws_ok($$select public.get_player_matchday_actions_s300_v1(repeat('a',64),array[]::uuid[],gen_random_uuid())$$,'42501',null,'unknown device token cannot retrieve action metadata');
select is(public.record_player_matchday_window_offer_s300_v1(repeat('e',64),(select pg_temp.offer_input(value)from facts where key='bootstrap-changed-normal')),false,'a valid different device cannot register another target offer');
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),(select pg_temp.offer_input(value)||jsonb_build_object('fallbackReleaseId',value->'desired_release_id')from facts where key='bootstrap-changed-normal')),false,'client cannot nominate a different ordinary fallback');
create function pg_temp.action_ack(phase text)returns jsonb language sql stable as $$select jsonb_build_object(
 'schemaVersion',1,'requestId',gen_random_uuid(),'deliveryId',value#>'{actions,0,deliveryId}','actionId',value#>'{actions,0,actionId}',
 'runbookId',value#>'{actions,0,runbookId}','publicationId',value#>'{actions,0,publicationId}','targetId',value#>'{actions,0,targetId}',
 'actionRevision',value#>'{actions,0,actionRevision}','contentHash',value#>'{actions,0,contentHash}','phase',phase,
 'reportedAt',clock_timestamp(),'activeReleaseId',(select value from facts where key='role'),'reasonCode',null)from facts where key='device-actions'$$;
insert into facts values('ack-input',pg_temp.action_ack('received'));
insert into facts values('ack-receipt',public.ack_player_matchday_action_s300_v1(repeat('d',64),(select value from facts where key='ack-input')));
select is((select value->>'accepted'from facts where key='ack-receipt'),'true','exact issued overlay receipt is accepted');
select is(public.ack_player_matchday_action_s300_v1(repeat('d',64),(select value from facts where key='ack-input'))->>'replayed','true','device nonce replays the original acknowledgement without another mutation');
select throws_ok($$select public.ack_player_matchday_action_s300_v1(repeat('d',64),(select value||'{"phase":"prepared"}'from facts where key='ack-input'))$$,'23505',null,'changed acknowledgement under the same device nonce is rejected');
select throws_ok($$select public.ack_player_matchday_action_s300_v1(repeat('e',64),(select value from facts where key='ack-input'))$$,'42501',null,'a different paired device cannot acknowledge another device delivery');
select is(public.ack_player_matchday_action_s300_v1(repeat('d',64),pg_temp.action_ack('rendered'))->>'accepted','true','rendered overlay acknowledgement is accepted for the current exact base publication');
select ok((select rendered_at is not null and prepared_at is null from public.matchday_deliveries where id=(select(value#>>'{actions,0,deliveryId}')::uuid from facts where key='device-actions')),'rendered overlay never fabricates a separate prepared receipt');
create function pg_temp.window_report(phase text,release_id uuid,at_time timestamptz)returns jsonb language sql stable as $$select jsonb_build_object(
 'schemaVersion',1,'publicationId',value#>'{matchday_window,publication_id}','targetId',value#>'{matchday_window,target_id}',
 'windowId',value#>'{matchday_window,window_id}','contentHash',value#>'{matchday_window,content_hash}','releaseId',release_id,
 'phase',phase,'reportedAt',at_time,'compositionId',null,'compositionRevision',null,'compositionHash',null)from facts where key='bootstrap'$$;
with stamp as(select clock_timestamp()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 current_sync_detail=jsonb_build_object('matchdayWindow',pg_temp.window_report('received',(select(value#>>'{}')::uuid from facts where key='role'),stamp.at_time))
 from stamp where id='e3000000-0000-4000-8000-000000000011';
select is((select status from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'received','heartbeat contact records received without claiming a frame');
with stamp as(select clock_timestamp()at_time)update public.player_devices set last_seen_at=stamp.at_time,active_release_id=(select(value#>>'{}')::uuid from facts where key='role'),
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',(select value from facts where key='role'),'firstFrameAt',stamp.at_time),
 'matchdayWindow',pg_temp.window_report('rendered',(select(value#>>'{}')::uuid from facts where key='role'),stamp.at_time)||jsonb_build_object('contentHash',repeat('a',64)))
 from stamp where id='e3000000-0000-4000-8000-000000000011';
select ok((select rendered_at is null from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'matching release frame with an unissued window hash cannot confirm temporal content');
with stamp as(select clock_timestamp()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',(select value from facts where key='role'),'firstFrameAt',stamp.at_time),
 'matchdayWindow',pg_temp.window_report('rendered',(select(value#>>'{}')::uuid from facts where key='role'),stamp.at_time))
 from stamp where id='e3000000-0000-4000-8000-000000000011';
select ok((select rendered_at is not null and prepared_at is null from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'exact offered window plus actual release first frame confirms rendered without invented preparation');
select ok(not has_function_privilege('authenticated','public.get_player_matchday_actions_s300_v1(text,uuid[],uuid)','execute'),'browser role cannot call device action retrieval');
select ok(not has_function_privilege('authenticated','public.record_player_matchday_window_offer_s300_v1(text,jsonb)','execute'),'browser role cannot create trusted server offers');
select set_config('request.jwt.claim.role','authenticated',true);

-- The real S301 adapter changes only an editable draft, never a publication.
update public.sports_teams set metadata=jsonb_set(metadata,'{competitionOptions}',metadata->'competitionOptions'||'[{
 "externalId":"next-league","poolExternalId":"801","poolName":"Next pool","period":"next-phase","season":"2027","type":"league","level":"2"}]'::jsonb)
 where tenant_id=pg_temp.tenant();
set local role authenticated;
insert into facts values('season-inventory',public.get_sportlink_season_switch_inventory_v1(pg_temp.tenant(),pg_temp.connection_id(),'2027','{"resourceKind":"matchday_runbook"}'));
select is((select value#>>'{integration,matchdayRunbooks}'from facts where key='season-inventory'),'available','S301 now reports actual runbook integration instead of a fabricated unavailable/empty inventory');
select is((select jsonb_array_length(value->'rows')from facts where key='season-inventory'),1,'authorized inventory includes the real runbook draft exactly once');
insert into facts values('season-row',(select value#>'{rows,0}'from facts where key='season-inventory'));
insert into facts values('season-input',(select jsonb_build_object('resourceKind','matchday_runbook','resourceId',value->'resourceId','basisVersionId',value->'basisVersionId',
 'expectedRevision',value->'expectedRevision','oldBindingHash',value->'oldBindingHash','contextHash',value->'contextHash','clearSelectedMatches',false,
 'newSelection',jsonb_build_object('mappings',jsonb_build_array(jsonb_build_object('fromProviderTeamId','own-team','context',
 '{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"next-league","poolId":"801","seasonId":"2027","phaseId":"next-phase"}'::jsonb))))from facts where key='season-row'));
select is(public.preview_sportlink_season_switch_v1(pg_temp.tenant(),(select value from facts where key='season-input'))->>'canApply','false','different context with selected matches requires an explicit clearing decision');
update facts set value=value||'{"clearSelectedMatches":true}'where key='season-input';
insert into facts values('season-preview',public.preview_sportlink_season_switch_v1(pg_temp.tenant(),(select value from facts where key='season-input')));
select is((select value->>'canApply'from facts where key='season-preview'),'true','exact observed destination can be explicitly previewed for the editable draft');
update facts set value=value||jsonb_build_object('requestId',gen_random_uuid(),'correlationId',gen_random_uuid())where key='season-input';
insert into facts values('season-applied',public.apply_sportlink_season_switch_draft_v1(pg_temp.tenant(),(select value from facts where key='season-input')));
select is((select value->>'status'from facts where key='season-applied'),'applied','S301 uses the real canonical runbook context mutator');
select is(public.apply_sportlink_season_switch_draft_v1(pg_temp.tenant(),(select value from facts where key='season-input')),(select value from facts where key='season-applied'),'season retry replays the outer original receipt before mutable context/CAS');
reset role;
select is((select configuration_json#>>'{context,seasonId}'from public.matchday_runbooks where id='e3000000-0000-4000-8000-000000000020'),'2027','only draft context changes to the explicitly selected canonical season');
select is((select jsonb_array_length(configuration_json->'matches')from public.matchday_runbooks where id='e3000000-0000-4000-8000-000000000020'),0,'explicit season switch clears exact match selections without guessing replacements');
select is((select configuration_json#>>'{context,seasonId}'from public.matchday_publications where id=(select(value->>'publicationId')::uuid from facts where key='published')),'2026','published context and complete frozen match selections are immutable across a draft season change');

-- Ending a correction is object-CAS guarded and preserves its visible history.
set local role authenticated;
insert into facts values('end-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'actionId',(select value->'actionId'from facts where key='action'),
 'expectedRevision',1,'requestId',gen_random_uuid(),'reason','Veldmelding beëindigen'));
insert into facts values('ended',public.end_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='end-input')));
select is((select value->>'outcome'from facts where key='ended'),'applied','explicit end uses the current object revision without changing published configuration');
select is(public.end_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='end-input')),(select value from facts where key='ended'),'lost end response returns its original receipt');
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$select public.ack_player_matchday_action_s300_v1(repeat('d',64),pg_temp.action_ack('rendered'))$$,'40001',null,'a terminated overlay cannot be newly acknowledged as current rendered');
select is(public.ack_player_matchday_action_s300_v1(repeat('d',64),pg_temp.action_ack('restored'))->>'accepted','true','restored overlay is independently acknowledged after the explicit end');
select is(public.ack_player_matchday_action_s300_v1(repeat('d',64),pg_temp.action_ack('received'))->>'accepted','true','late transport receipt is retained without reversing completed restoration');
select is(public.ack_player_matchday_action_s300_v1(repeat('d',64),pg_temp.action_ack('prepared'))->>'accepted','true','late preparation receipt is retained without reversing completed restoration');
select is((select status from public.matchday_deliveries where id=(select(value#>>'{actions,0,deliveryId}')::uuid from facts where key='device-actions')),'restored','restored delivery status remains monotone under reordered acknowledgements');
select is(jsonb_array_length(public.get_player_matchday_actions_s300_v1(repeat('d',64),array[(select(value->>'publicationId')::uuid from facts where key='published')],gen_random_uuid())->'actions'),0,'ended head is absent and no superseded correction reappears');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into facts values('phase-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020','publicationId',(select value->'publicationId'from facts where key='published'),
 'expectedRevision',0,'requestId',gen_random_uuid(),'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000007'),
 'endsAt',now()+interval '15 minutes','reason','Hoofdfase bewust bevestigen','kind','phase','phase','playing','matchId',(select value#>'{selected,configuration,mainMatchId}'from facts where key='workspace')));
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='phase-input'))->>'outcome','blocked','main phase never silently expands a selected screen subset to all targets');
update facts set value=value||jsonb_build_object('requestId',gen_random_uuid(),'screenIds',jsonb_build_array('e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000008'))where key='phase-input';
insert into facts values('phase-applied',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='phase-input')));
select is((select value->>'outcome'from facts where key='phase-applied'),'applied','explicit complete target selection applies the authorized main phase atomically');
reset role;
select is((select phase from public.matchday_runs where publication_id=(select(value->>'publicationId')::uuid from facts where key='published')),'playing','main phase is an explicit operational fact with its own actor');
select is(public.get_player_effective_target_v1(repeat('d',64))->>'desired_release_id',(select value#>>'{}'from facts where key='playing'),'entrance uses its exact frozen phase release');
select is(public.get_player_effective_target_v1(repeat('e',64))->>'desired_release_id',(select value#>>'{}'from facts where key='role'),'other role retains its own frozen configured phase/default choice');
select is((select version from public.matchday_publications where id=(select(value->>'publicationId')::uuid from facts where key='published')),1,'multiple operational revisions never change the immutable publication number');
select throws_ok($$update public.matchday_publications set configuration_json='{}'where tenant_id=pg_temp.tenant()$$,'55000',null,'published matchday configuration rejects direct mutation');
select throws_ok($$update public.matchday_publication_targets set screen_name='Changed group member'where tenant_id=pg_temp.tenant()$$,'55000',null,'concrete target snapshot remains immutable');
select throws_ok($$update public.matchday_actions set payload_json='{}'where tenant_id=pg_temp.tenant()$$,'55000',null,'historical action payload remains immutable');
set local role authenticated;
select throws_ok($$select public.get_matchday_workspace_s300_v1('10000000-0000-4000-8000-000000000304',null)$$,'42501',null,'same labels do not grant cross-tenant runbook reads');
insert into facts values('close-stale',public.close_matchday_publication_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'expectedRevision',1,'requestId',gen_random_uuid(),'operation','close','reason','Oude publicatieversie is geen CAS')));
select is((select value->>'outcome'from facts where key='close-stale'),'conflict','lifecycle CAS uses operational revision, not the immutable version number');
reset role;
insert into facts values('publication-facts',(select configuration_json from public.matchday_publications where id=(select(value->>'publicationId')::uuid from facts where key='published')));
-- A rollback-only clock reaches the exclusive end without changing provider data.
create or replace function private.matchday_now_s300_v1()returns timestamptz language sql volatile set search_path=''as $$select now()+interval '2 hours 1 second'$$;
select is(public.get_player_effective_target_v1(repeat('d',64))->>'desired_release_id',(select value#>>'{}'from facts where key='playing'),'exclusive end selects ordinary B that begins exactly on the boundary');
select ok(public.get_player_effective_target_v1(repeat('d',64))->'matchday_window'is null,'expired/closed temporal publication never extends its window or invents another runbook fallback');
with stamp as(select private.matchday_now_s300_v1()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 active_release_id=(select(value#>>'{}')::uuid from facts where key='ordinary'),
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',(select value from facts where key='ordinary'),'firstFrameAt',stamp.at_time),
 'matchdayWindow',pg_temp.window_report('restored',(select(value#>>'{}')::uuid from facts where key='ordinary'),stamp.at_time))
 from stamp where id='e3000000-0000-4000-8000-000000000011';
select is((select status from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'restored','the earlier fully offered offline fallback is recognized after later planning changes');
select matches((select detail from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'^Eerder aangeboden','historical fallback receipt explicitly avoids claiming the current ordinary winner was restored');
with stamp as(select private.matchday_now_s300_v1()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 current_sync_detail=jsonb_build_object('matchdayWindow',pg_temp.window_report('received',(select(value#>>'{}')::uuid from facts where key='role'),stamp.at_time))
 from stamp where id='e3000000-0000-4000-8000-000000000011';
select is((select status from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='bootstrap')),'restored','out-of-order heartbeat receipt cannot reverse a proven window restoration');
create or replace function private.matchday_now_s300_v1()returns timestamptz language sql volatile set search_path=''as $$select clock_timestamp()$$;


set local role authenticated;
insert into facts values('close-input',jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000020',
 'publicationId',(select value->'publicationId'from facts where key='published'),'expectedRevision',3,'requestId',gen_random_uuid(),'operation','cancel','reason','Wedstrijddienst beëindigt hele uitvoering'));
insert into facts values('closed',public.close_matchday_publication_s300_v1(pg_temp.tenant(),(select value from facts where key='close-input')));
select is((select value->>'outcome'from facts where key='closed'),'applied','correct operational CAS cancels the entire owned execution');
select is(public.close_matchday_publication_s300_v1(pg_temp.tenant(),(select value from facts where key='close-input')),(select value from facts where key='closed'),'lifecycle retry preserves its original result');
reset role;
select is((select count(*)::int from public.content_schedules schedule join public.matchday_owned_schedules owned on owned.tenant_id=schedule.tenant_id and owned.schedule_id=schedule.id where owned.tenant_id=pg_temp.tenant()and schedule.enabled),0,'close disables all own future and current phase rules without deleting history');
select is(public.get_player_effective_target_v1(repeat('d',64))->>'desired_release_id',(select value#>>'{}'from facts where key='ordinary'),'close restores the ordinary shared-resolver winner valid now');
select is((select configuration_json from public.matchday_publications where id=(select(value->>'publicationId')::uuid from facts where key='published')),(select value from facts where key='publication-facts'),'lifecycle never rewrites frozen configuration or original provider facts');
-- Group membership is expanded once, never on later polling or activation.
update public.tenants set screen_limit=5 where id=pg_temp.tenant();
insert into public.screen_groups(id,tenant_id,name)values('e3000000-0000-4000-8000-000000000040',pg_temp.tenant(),'Bevestigde twee schermen');
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id)values
 (pg_temp.tenant(),'e3000000-0000-4000-8000-000000000040','e3000000-0000-4000-8000-000000000007'),
 (pg_temp.tenant(),'e3000000-0000-4000-8000-000000000040','e3000000-0000-4000-8000-000000000008');
set local role authenticated;
insert into facts values('group-configuration',jsonb_set(jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(
 jsonb_set(pg_temp.configuration()#>'{roles,0}','{targets}','[{"kind":"screen_group","id":"e3000000-0000-4000-8000-000000000040"}]'))),'{phaseWindows}','[]'));
select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000021','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',(select value from facts where key='group-configuration')));
insert into facts values('group-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000021',1));
select is((select value->>'canPublish'from facts where key='group-preflight'),'true','group preflight uses the existing real membership and exact current releases');
insert into facts values('group-published',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000021','expectedRevision',1,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='group-preflight'))));
select is((select value->>'outcome'from facts where key='group-published'),'applied','confirmed group targets publish through real Publisher target snapshots');
reset role;
insert into public.screens(id,tenant_id,name,status,orientation,resolution_width,resolution_height)values('e3000000-0000-4000-8000-000000000010',pg_temp.tenant(),'Later groepslid','active','landscape',1920,1080);
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id)values(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000040','e3000000-0000-4000-8000-000000000010');
select is((select count(*)::int from public.matchday_publication_targets where publication_id=(select(value->>'publicationId')::uuid from facts where key='group-published')),2,'a newly added group member does not alter frozen publication targets');
select ok(not exists(select 1 from public.publisher_target_snapshot_screens where tenant_id=pg_temp.tenant()and screen_id='e3000000-0000-4000-8000-000000000010'),
 'new group member is absent from all previously confirmed immutable Publisher target snapshots');
insert into facts values('group-bootstrap',public.get_player_effective_target_v1(repeat('d',64)));
-- Eight immutable END identities are retained; ordinary source observations do not count.
create function pg_temp.add_offer(index_value integer)returns boolean language plpgsql as $$declare release_id uuid;input jsonb;begin
 release_id:=pg_temp.make_release('Gewone variant '||index_value);
 perform public.mutate_content_schedule_v2(pg_temp.tenant(),null,0,'create',jsonb_build_object('name','END variant '||index_value,
  'targetKind','screen','targetId','e3000000-0000-4000-8000-000000000007','releaseId',release_id,'timezoneName','Europe/Amsterdam','source','publisher','priority',300+index_value,
  'scheduleKind','once','startsAt',now()+interval '2 hours','endsAt',now()+interval '3 hours','recurrence','{}'::jsonb,'enabled',true),gen_random_uuid());
 perform set_config('request.jwt.claim.role','service_role',true);
 input:=pg_temp.offer_input(public.get_player_effective_target_v1(repeat('d',64)));
 return public.record_player_matchday_window_offer_s300_v1(repeat('d',64),input);
end$$;
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),pg_temp.offer_input(public.get_player_effective_target_v1(repeat('d',64)))),true,'new publication starts its own exact offer archive');
select ok((select bool_and(pg_temp.add_offer(value))from generate_series(1,7)value),'seven newer canonical ordinary identities fit without evicting the first offer');
select is((select jsonb_array_length(window_offers_json)from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='group-bootstrap')),8,'archive is bounded to exactly eight distinct immutable fallback identities');
select throws_ok($$select pg_temp.add_offer(8)$$,'54000','MATCHDAY_FALLBACK_OFFER_LIMIT','ninth distinct identity refuses only the new offer instead of evicting an offline authorization');
select is((select jsonb_array_length(window_offers_json)from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='group-bootstrap')),8,'failed ninth offer leaves all eight previously issued identities intact');
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),pg_temp.offer_input(public.get_player_effective_target_v1(repeat('d',64)))),true,'already-issued canonical identity still succeeds when archive is full');
-- A profile change requires new preflight; no new temporary content reaches an old runtime.
update public.player_devices set capabilities='{}'where id='e3000000-0000-4000-8000-000000000011';
select ok(public.get_player_effective_target_v1(repeat('d',64))->'matchday_window'is null,'a device that loses temporal capability receives the existing ordinary fallback');
update public.player_devices set capabilities='{"matchdayExpiry":"matchday-expiry-v1"}'where id='e3000000-0000-4000-8000-000000000011';
update public.screens set resolution_width=1280,resolution_height=720 where id='e3000000-0000-4000-8000-000000000007';
select ok(public.get_player_effective_target_v1(repeat('d',64))->'matchday_window'is null,'changed screen profile cannot silently redefine a frozen temporal target');
update public.screens set resolution_width=1920,resolution_height=1080 where id='e3000000-0000-4000-8000-000000000007';
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is(public.set_matchday_enabled_s300_v1(pg_temp.tenant(),jsonb_build_object('enabled',false,'expectedRevision',1,'requestId',gen_random_uuid(),'reason','Pilot veilig beëindigen'))->>'outcome','applied','explicit feature disable ends owned operation and restores normal planning');
reset role;
select ok(public.get_player_effective_target_v1(repeat('d',64))->'matchday_window'is null,'feature off exposes no temporal window to modern or legacy profiles');
select is((select count(*)::int from public.content_schedules schedule join public.matchday_owned_schedules owned on owned.tenant_id=schedule.tenant_id and owned.schedule_id=schedule.id where owned.tenant_id=pg_temp.tenant()and schedule.enabled),0,'feature disable cancels all own future phases while preserving unrelated schedules');
select ok(exists(select 1 from public.content_schedules schedule where tenant_id=pg_temp.tenant()and enabled and not exists(select 1 from public.matchday_owned_schedules owned where owned.schedule_id=schedule.id)),'ordinary non-owned Publisher rules remain enabled');

-- Optional LED enrollment uses an observed code and both normalized team mappings.
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason)values(pg_temp.tenant(),'ledscores_realtime',true,'Interne SQL-canary voor exacte LED-binding');
insert into public.ledscores_connections(id,tenant_id,name,club_slug)values('e3000000-0000-4000-8000-000000000050',pg_temp.tenant(),'Park LED','park-s300');
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name)values(pg_temp.tenant(),pg_temp.connection_id(),'other','Tegenstander');
insert into public.ledscores_team_mappings(tenant_id,connection_id,provider_team_key,provider_team_name,sports_team_id,scoring_side)
select pg_temp.tenant(),'e3000000-0000-4000-8000-000000000050',case when external_id='own-team'then'led-home'else'led-away'end,name,id,
 case when external_id='own-team'then'own'else'opponent'end from public.sports_teams where tenant_id=pg_temp.tenant()and external_id in('own-team','other');
insert into public.ledscores_goal_alerts(id,tenant_id,connection_id,name,draft_config)values('e3000000-0000-4000-8000-000000000051',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000050','Bestaande LED-configuratie','{"schemaVersion":1,"ownDesign":{},"opponentDesign":{},"unknownDesign":{}}');
insert into public.ledscores_goal_alert_versions(id,tenant_id,alert_id,connection_id,version,priority,duration_ms,underlay_policy,config_snapshot,checksum_sha256)
values('e3000000-0000-4000-8000-000000000052',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000051','e3000000-0000-4000-8000-000000000050',1,100,8000,'continue','{}',repeat('a',64));
update public.ledscores_goal_alerts set status='published',current_published_version_id='e3000000-0000-4000-8000-000000000052'where id='e3000000-0000-4000-8000-000000000051';
insert into public.ledscores_goal_alert_version_groups(tenant_id,alert_version_id,screen_group_id)values(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000040');
insert into public.ledscores_live_match_states(tenant_id,connection_id,match_identity,status,state_json,source_updated_at,source_observed_at)
values(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000050','match:home','live','{"schemaVersion":1,"matchId":"home","homeTeamId":"led-home","awayTeamId":"led-away"}',now(),now());
select is((select count(*)::int from private.matchday_led_options_s300_v1(pg_temp.tenant(),(select id from public.sports_matches where tenant_id=pg_temp.tenant()and external_id='home'))),1,
 'exact shared match code and both normalized team mappings expose the existing compatible LED option');
update public.ledscores_live_match_states set state_json=jsonb_set(state_json,'{matchId}','"looks-similar"')where tenant_id=pg_temp.tenant();
select is((select count(*)::int from private.matchday_led_options_s300_v1(pg_temp.tenant(),null)),0,'same names or date cannot substitute for the exact cross-provider match code');
update public.ledscores_live_match_states set state_json=jsonb_set(state_json,'{matchId}','"home"')where tenant_id=pg_temp.tenant();
set local role authenticated;
select public.set_matchday_enabled_s300_v1(pg_temp.tenant(),jsonb_build_object('enabled',true,'expectedRevision',2,'requestId',gen_random_uuid(),'reason','LED canary expliciet activeren'));
insert into facts values('led-configuration',jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(
 jsonb_set(jsonb_set(pg_temp.configuration()#>'{roles,0}','{role}','"led"'),'{ledBinding}',
 '{"connectionId":"e3000000-0000-4000-8000-000000000050","alertVersionId":"e3000000-0000-4000-8000-000000000052","providerMatchId":"home","maximumSourceAgeSeconds":60}'))));
select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000022','expectedRevision',0,'requestId',gen_random_uuid(),'configuration',(select value from facts where key='led-configuration')));
insert into facts values('led-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000022',1));
select is((select value->>'canPublish'from facts where key='led-preflight'),'true','LED preflight proves recent source, exact mapping, existing target group and temporal profile');
insert into facts values('led-published',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000022','expectedRevision',1,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='led-preflight'))));
select is((select value->>'outcome'from facts where key='led-published'),'applied','optional LED role freezes only the explicitly confirmed compatible binding');
reset role;
insert into public.ledscores_goal_events(id,tenant_id,connection_id,canonical_key,match_identity,home_team,away_team,previous_home_score,previous_away_score,home_score,away_score,scoreboard_side,scoring_team_key,scoring_side,source_observed_at,dispatch_status)
values('e3000000-0000-4000-8000-000000000053',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000050',repeat('f',64),'match:home','Eigen ploeg','Tegenstander',0,0,1,0,'home','led-home','own',now(),'dispatched');
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),true,'fresh exact enrolled goal is allowed only during the effective owned window');
insert into public.ledscores_player_deliveries(id,tenant_id,screen_id,message_kind,goal_event_id,alert_version_id,payload,execute_at,expires_at)values
 ('e3000000-0000-4000-8000-000000000054',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','goal','e3000000-0000-4000-8000-000000000053','e3000000-0000-4000-8000-000000000052','{}',now(),now()+interval '10 seconds'),
 ('e3000000-0000-4000-8000-000000000055',pg_temp.tenant(),'e3000000-0000-4000-8000-000000000008','goal','e3000000-0000-4000-8000-000000000053','e3000000-0000-4000-8000-000000000052','{}',now(),now()+interval '10 seconds');
select set_config('request.jwt.claim.role','service_role',true);
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('d',64))->'pendingDeliveries'),1,'actual existing LED read offers the fresh queued owned goal before close');
create temporary table led_state_backup as select *from public.ledscores_live_match_states where tenant_id=pg_temp.tenant();
delete from public.ledscores_live_match_states where tenant_id=pg_temp.tenant();
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),false,'missing exact live state is false rather than unknown admission authority');
insert into public.ledscores_player_deliveries(tenant_id,screen_id,message_kind,goal_event_id,alert_version_id,payload,execute_at,expires_at)
values(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','goal','e3000000-0000-4000-8000-000000000053','e3000000-0000-4000-8000-000000000052','{}',now(),now()+interval '10 seconds');
select is((select count(*)::int from public.ledscores_player_deliveries where tenant_id=pg_temp.tenant()and screen_id='e3000000-0000-4000-8000-000000000007'),1,'actual INSERT guard rejects an owned goal when the exact live state has disappeared');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('d',64))->'pendingDeliveries'),0,'missing live state also prevents reconnect from reading an earlier queued owned goal');
insert into public.ledscores_live_match_states select *from led_state_backup;
select set_config('request.jwt.claim.role','authenticated',true);
update public.ledscores_goal_events set source_observed_at=now()+interval '1 minute'where id='e3000000-0000-4000-8000-000000000053';
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),false,'future provider observation cannot trigger an enrolled goal');
update public.ledscores_goal_events set source_observed_at=now()-interval '2 minutes'where id='e3000000-0000-4000-8000-000000000053';
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),false,'stale provider goal is not a fresh enrolled observation');
update public.ledscores_goal_events set source_observed_at=now(),match_identity='match:park'where id='e3000000-0000-4000-8000-000000000053';
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),false,'other park match cannot replace the frozen main match LED identity');
update public.ledscores_goal_events set match_identity='match:home'where id='e3000000-0000-4000-8000-000000000053';
set local role authenticated;
select public.close_matchday_publication_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000022','publicationId',(select value->'publicationId'from facts where key='led-published'),
 'expectedRevision',0,'requestId',gen_random_uuid(),'operation','cancel','reason','Hoofdwedstrijd afgelast'));
reset role;
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),false,'closed enrollment blocks late owned goals until original exclusive end');
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000008','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),true,'unrelated legacy LED screen keeps its existing delivery path');
insert into public.ledscores_player_deliveries(tenant_id,screen_id,message_kind,goal_event_id,alert_version_id,payload,execute_at,expires_at)
values(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','goal','e3000000-0000-4000-8000-000000000053','e3000000-0000-4000-8000-000000000052','{}',now(),now()+interval '10 seconds');
select is((select count(*)::int from public.ledscores_player_deliveries where tenant_id=pg_temp.tenant()and screen_id='e3000000-0000-4000-8000-000000000007'),1,'actual insert guard adds no late owned delivery and preserves the earlier delivery record');
select set_config('request.jwt.claim.role','service_role',true);
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('d',64))->'pendingDeliveries'),0,'reconnect after close never reoffers the earlier queued owned goal');
select is(jsonb_array_length(public.get_ledscores_player_bootstrap_v1(repeat('e',64))->'pendingDeliveries'),1,'same generic LED read on an unrelated screen remains unchanged after close');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into facts values('led-preflight-again',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000022',2));
insert into facts values('led-published-again',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000022','expectedRevision',2,'requestId',gen_random_uuid(),'preflightId',(select value->'id'from facts where key='led-preflight-again'))));
reset role;
select is((select value->>'outcome'from facts where key='led-published-again'),'applied','an explicitly rechecked new publication may supersede the closed enrollment');
select is(private.matchday_led_delivery_allowed_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000007','e3000000-0000-4000-8000-000000000052','e3000000-0000-4000-8000-000000000053'),true,'new current confirmed binding supersedes the old closed enrollment without provider rewrites');

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
set local role authenticated;
insert into facts values('menu-configuration',jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(jsonb_build_object('role','canteen',
 'targets',jsonb_build_array(jsonb_build_object('kind','screen','id','e3000000-0000-4000-8000-000000000008')),'defaultReleaseId','e3000000-0000-4000-8000-000000000066',
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
insert into facts values('menu-soldout',public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value from facts where key='menu-input')));
select is((select value->>'outcome'from facts where key='menu-soldout'),'applied','temporary sold-out applies only to the exact frozen menu object');
reset role;
select is(public.get_player_effective_target_v1(repeat('e',64))->>'desired_release_id',(select value#>>'{}'from facts where key='playing'),'sold-out uses the configured existing replacement publication for that canteen screen');
set local role authenticated;
select is(public.apply_matchday_action_s300_v1(pg_temp.tenant(),(select value||jsonb_build_object('kind','available','expectedRevision',1,'requestId',gen_random_uuid(),'reason','Koffie weer beschikbaar')from facts where key='menu-input'))->>'outcome','applied','available correction supersedes the temporary replacement with the current object CAS');
reset role;
select is(public.get_player_effective_target_v1(repeat('e',64))->>'desired_release_id','e3000000-0000-4000-8000-000000000066','restored availability returns to the original frozen menu release');
select is((select to_jsonb(product)from public.tenant_products product where id='e3000000-0000-4000-8000-000000000061'),(select value from facts where key='catalog-before'),'temporary menu operations never alter product/catalog/price/source fields');
select is((select snapshot_data_json#>>'{menuDocument,pages,0,blocks,0,productNodes,0,snapshotFallback,price,amountMinor}'from public.dynamic_slide_snapshots where id='e3000000-0000-4000-8000-000000000064'),'250','published menu source bytes and original price remain unchanged');

-- Exact source identities, finite bounds and RPC-only privilege remain enforced.
set local role authenticated;
select throws_ok($$select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId',gen_random_uuid(),'expectedRevision',0,'requestId',gen_random_uuid(),
 'configuration',jsonb_set(pg_temp.configuration(),'{context,poolId}','"another-pool"')))$$,'42501',null,'wrong main pool is rejected by the exact normalized context resolver');
select throws_ok($$select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId',gen_random_uuid(),'expectedRevision',0,'requestId',gen_random_uuid(),
 'configuration',jsonb_set(pg_temp.configuration(),'{context,phaseId}','"another-phase"')))$$,'42501',null,'wrong main phase never falls back to a similarly named team or competition');
select throws_ok($$select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId',gen_random_uuid(),'expectedRevision',0,'requestId',gen_random_uuid(),
 'configuration',jsonb_set(pg_temp.configuration(),'{endsAt}','null')))$$,'22023',null,'an open-ended operational publication is never accepted');
select throws_ok($$select count(*)from public.matchday_actions$$,'42501',null,'browser role cannot bypass object-scoped RPCs through direct action table reads');
reset role;
select is((select count(*)::int from jsonb_array_elements((select value#>'{selected,configuration,matches}'from facts where key='workspace'))match_value
 where match_value->>'homeTeamId'='own-team'),2,'two matches of the same own team remain separate canonical match identities');
select ok((select bool_and(relrowsecurity)from pg_class where oid=any(array['public.matchday_settings'::regclass,'public.matchday_runbooks'::regclass,'public.matchday_publications'::regclass,
 'public.matchday_publication_targets'::regclass,'public.matchday_actions'::regclass,'public.matchday_delegations'::regclass,'public.matchday_deliveries'::regclass,'public.matchday_device_receipts'::regclass])),
 'all new human, frozen, delegation and device receipt relations have default-deny RLS');
select ok(not has_function_privilege('authenticated','public.get_ledscores_player_bootstrap_v1(text)','execute')
 and not has_function_privilege('authenticated','public.get_ledscores_match_player_bootstrap_v1(text)','execute'),
 'both guarded existing LED delivery reads retain service-only access');
-- A real immutable composition identity is frozen and required in frame receipts.
set local role authenticated;
select public.close_matchday_publication_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000022','publicationId',(select value->'publicationId'from facts where key='led-published-again'),
 'expectedRevision',0,'requestId',gen_random_uuid(),'operation','close','reason','LEDproef beëindigen'));
insert into facts values('composition-input',jsonb_build_object('schemaVersion',1,'orientation','landscape','layout','full','mainWidthPercent',70,'bottomHeightPercent',20,
 'zones',jsonb_build_array(jsonb_build_object('id','main','playlistId',(select playlist_id from public.playlist_releases where id=(select(value#>>'{}')::uuid from facts where key='ordinary'))))));
select public.save_screen_composition_draft_v1('e3000000-0000-4000-8000-000000000007',0,(select value from facts where key='composition-input'),gen_random_uuid());
select public.publish_screen_composition_v1('e3000000-0000-4000-8000-000000000007',1,gen_random_uuid());
select public.mutate_matchday_draft_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000025','expectedRevision',0,'requestId',gen_random_uuid(),
 'configuration',jsonb_set(jsonb_set(pg_temp.configuration(),'{roles}',jsonb_build_array(pg_temp.configuration()#>'{roles,0}')),'{phaseWindows}','[]')));
insert into facts values('composition-preflight',public.preview_matchday_publication_s300_v1(pg_temp.tenant(),'e3000000-0000-4000-8000-000000000025',1));
reset role;
update public.player_devices set capabilities='{}'where id='e3000000-0000-4000-8000-000000000011';
set local role authenticated;
select is(public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000025','expectedRevision',1,'requestId',gen_random_uuid(),
 'preflightId',(select value->'id'from facts where key='composition-preflight')))->>'outcome','blocked','a changed Player capability after preflight is rechecked before any publication write');
reset role;
update public.player_devices set capabilities='{"matchdayExpiry":"matchday-expiry-v1"}'where id='e3000000-0000-4000-8000-000000000011';
set local role authenticated;
insert into facts values('composition-published',public.publish_matchday_runbook_s300_v1(pg_temp.tenant(),jsonb_build_object('runbookId','e3000000-0000-4000-8000-000000000025','expectedRevision',1,'requestId',gen_random_uuid(),
 'preflightId',(select value->'id'from facts where key='composition-preflight'))));
select is((select value->>'outcome'from facts where key='composition-published'),'applied','restored exact verified profile and immutable composition can publish after the bounded recheck');
reset role;
insert into facts values('composition-bootstrap',public.get_player_effective_target_v1(repeat('d',64)));
select ok((select value#>>'{matchday_window,composition_hash}'~'^[a-f0-9]{64}$'from facts where key='composition-bootstrap'),'current composition has an exact canonical hash independent of observation times');
select set_config('request.jwt.claim.role','service_role',true);
select is(public.record_player_matchday_window_offer_s300_v1(repeat('d',64),(select pg_temp.offer_input(value)from facts where key='composition-bootstrap')),true,'server archives the exact nonrecursive composed fallback identity');
create function pg_temp.composition_report(at_time timestamptz,hash_override text default null)returns jsonb language sql stable as $$select jsonb_build_object('schemaVersion',1,
 'publicationId',value#>'{matchday_window,publication_id}','targetId',value#>'{matchday_window,target_id}','windowId',value#>'{matchday_window,window_id}',
 'contentHash',value#>'{matchday_window,content_hash}','releaseId',value->'desired_release_id','phase','rendered','reportedAt',at_time,
 'compositionId',value#>'{composition,id}','compositionRevision',value#>'{composition,revision}',
 'compositionHash',coalesce(to_jsonb(hash_override),value#>'{matchday_window,composition_hash}'))from facts where key='composition-bootstrap'$$;
with stamp as(select clock_timestamp()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 active_release_id=(select(value->>'desired_release_id')::uuid from facts where key='composition-bootstrap'),
 active_composition_id=(select(value#>>'{composition,id}')::uuid from facts where key='composition-bootstrap'),
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',(select value->'desired_release_id'from facts where key='composition-bootstrap'),'firstFrameAt',stamp.at_time),
 'matchdayWindow',pg_temp.composition_report(stamp.at_time,repeat('0',64)))from stamp where id='e3000000-0000-4000-8000-000000000011';
select ok((select rendered_at is null from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='composition-bootstrap')),'same release and composition UUID with a wrong composition hash never proves a frame');
with stamp as(select clock_timestamp()at_time)update public.player_devices set last_seen_at=stamp.at_time,
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',(select value->'desired_release_id'from facts where key='composition-bootstrap'),'firstFrameAt',stamp.at_time),
 'matchdayWindow',pg_temp.composition_report(stamp.at_time))from stamp where id='e3000000-0000-4000-8000-000000000011';
select ok((select rendered_at is not null from public.matchday_deliveries where schedule_id=(select(value#>>'{matchday_window,window_id}')::uuid from facts where key='composition-bootstrap')),'exact immutable composition UUID/revision/hash plus actual release frame confirms composed temporal rendering');
select set_config('request.jwt.claim.role','authenticated',true);

select *from finish();
rollback;
