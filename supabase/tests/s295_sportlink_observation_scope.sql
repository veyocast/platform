begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000291','Source recovery A','consistency-a'),
 ('10000000-0000-4000-8000-000000000292','Source recovery B','consistency-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('consistency-a','consistency-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000291','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000292','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000293','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000291','Owner A'),('00000000-0000-4000-8000-000000000292','Owner B'),('00000000-0000-4000-8000-000000000293','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000291','tenant_owner'),
 ('10000000-0000-4000-8000-000000000292','00000000-0000-4000-8000-000000000292','tenant_owner'),
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000291','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000292','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000292');

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
create function pg_temp.context() returns jsonb language sql immutable as $$select '{"providerTeamId":"own-team","competitionSelectionMode":"auto_current","competitionId":null,"phaseId":null,"poolId":null,"seasonId":null}'::jsonb$$;
create function pg_temp.config(family text,kind text,direction text default 'both',days integer default 7)returns jsonb language sql stable as $$
 select jsonb_build_object('schemaVersion',1,'maxItems',200,'context',pg_temp.context(),
 'teamSelection',jsonb_build_object('mode','selected','teamContexts',jsonb_build_array(pg_temp.context()),'matchLocation',direction),
 'syncConfiguration',jsonb_build_object('schemaVersion',1,'kind','dynamic','rendererVersion','sync-onzetrots-v9','sourceRevision','5ba52a657d6d16ad103ba2fb43b8db18aa83715a','slideType',kind,'secondsPerPage',5,'seed',jsonb_set(pg_temp.seed(),'{family}',to_jsonb(family))))
 ||case when kind='sport_program'then jsonb_build_object('blueprintKey',case when family='pool-program'then'sportlink.pool_schedule_next_7_days'else'sportlink.club_schedule_next_7_days'end)
 when kind='sport_results'then jsonb_build_object('blueprintKey',case when family='pool-results'then'sportlink.pool_results_previous_7_days'else'sportlink.club_results_previous_7_days'end)
 when kind='sport_visitor_arrivals'then jsonb_build_object('blueprintKey','sportlink.visitor_arrivals','teamContexts',jsonb_build_array(pg_temp.context()),'arrival',jsonb_build_object('minutesBefore',days*1440,'minutesAfter',0,'emptyBehavior','skip')) else '{}'::jsonb end
$$;
create function pg_temp.dynamic(family text,kind text,direction text default 'both',days integer default 7)returns public.dynamic_slides language sql stable as $$
 select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','60000000-0000-4000-8000-000000000291','tenant_id',tenant_id,'name','Controlled source','slide_type',kind,'orientation','landscape','data_source_id',data_source_id,'configuration_json',pg_temp.config(family,kind,direction,days)))from own_source where tenant_id='10000000-0000-4000-8000-000000000291'
$$;


-- A separate pool-wide result block never broadens the selected team's blocks.
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,expires_at)
select tenant_id,id,'pool-other',now()-interval '1 hour','finished','{"externalId":"foreign-a","name":"Foreign A","score":0}','{"externalId":"foreign-b","name":"Foreign B","score":0}',
 '{"externalId":"league","period":"phase"}','{"externalId":"701","competitionExternalId":"league"}',true,now()-interval '1 minute'
from own_source;
update public.sports_matches set scores_published=false,home_team=home_team-'score',away_team=away_team-'score'where external_id='home';
create temporary table actual as select private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day','home'))data;
select is((select count(*)from jsonb_array_elements(data#>'{sport,matchday,results,items}')item where item->>'homeTeamId'<>'own-team'),0::bigint,'own results keep exact selected team and home direction')from actual;
select is((select count(*)from jsonb_array_elements(data#>'{sport,matchday,poolResults,items}')item where item->>'id'='pool-other'),1::bigint,'other pool result is selected independently of home direction and storage expiry')from actual;
select ok((select count(*)from jsonb_array_elements(data#>'{sport,matchday,fixtures,items}')item where item->>'id'='home')=1,'programme does not require published result scores')from actual;
select is(data#>>'{sport,matchday,poolResults,sourceConnectionId}',(select id::text from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),'pool block proves the exact connection')from actual;
update public.sports_matches set competition='{"externalId":"league","period":"other-phase"}'where external_id='pool-other';
select is((select count(*)from jsonb_array_elements(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,poolResults,items}')item where item->>'id'='pool-other'),0::bigint,'other phase does not enter the result block');
update public.sports_matches set competition='{"externalId":"league","period":"phase"}'where external_id='pool-other';
update public.sports_matches set pool='{"externalId":"999","competitionExternalId":"league"}'where external_id='neutral';

-- Exercise the real leased completion wrappers, without storing raw provider data.
create function pg_temp.complete_matches(kind text,records jsonb,observation jsonb default '{}'::jsonb)returns jsonb language plpgsql as $$
declare run_id uuid;source record;result jsonb;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 values(source.tenant_id,source.id,kind,'running','worker:s295',now())returning id into run_id;
 result:=public.complete_sportlink_sync_v5(run_id,'worker:s295','{}','{}','[]','[]',records,'[]','[]',observation);
 return result;
end;$$;
create function pg_temp.scope(complete boolean default true)returns jsonb language sql stable as $$
 select jsonb_build_object('schemaVersion',1,'kind','full','scopes',jsonb_build_array(jsonb_build_object(
 'scope','pool','poolExternalId','701','competitionExternalId','league','phase','phase',
 'fromDate',(now()at time zone'Europe/Amsterdam')::date-7,'throughDate',(now()at time zone'Europe/Amsterdam')::date+7,
 'complete',complete,'resultExternalIds','[]'::jsonb,'programExternalIds','[]'::jsonb)))
$$;
create function pg_temp.program_record()returns jsonb language sql stable as $$
 select jsonb_build_array(jsonb_build_object('externalId','pool-other','startsAt',now()-interval '1 hour','status','scheduled',
 'homeTeam',jsonb_build_object('externalId','foreign-a','name','Foreign A','score',null),
 'awayTeam',jsonb_build_object('externalId','foreign-b','name','Foreign B','score',null),
 'competition',jsonb_build_object('externalId','league','period','phase'),'pool',jsonb_build_object('externalId','701','competitionExternalId','league')))
$$;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($$select pg_temp.complete_matches('match_details',pg_temp.program_record())$$,'first detail run completes');
select lives_ok($$select pg_temp.complete_matches('match_details',pg_temp.program_record())$$,'second detail run completes');
select lives_ok($$select pg_temp.complete_matches('match_details',pg_temp.program_record())$$,'third detail run completes');
select is((select missing_sync_count from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),0,'three detail runs never count a missing unrelated result');
select ok((select active and status='finished'and scores_published and home_team->>'score'='0'and away_team->>'score'='0'from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='pool-other'),'detail programme row preserves final 0-0 result');
select lives_ok($$select pg_temp.complete_matches('matches',pg_temp.program_record())$$,'legacy unscoped programme completes safely');
select is((select status from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='pool-other'),'finished','later programme cannot undo official final result');
select pg_temp.complete_matches('matches','[]',pg_temp.scope()||jsonb_build_object('scopes',jsonb_build_array(
 (pg_temp.scope()->'scopes'->0)||'{"scope":"club"}'::jsonb,
 jsonb_set(pg_temp.scope()->'scopes'->0,'{resultExternalIds}','["result-home","pool-other"]')),
 'sourceObservations',jsonb_build_array(jsonb_build_object('articleKey','pouleuitslagen','poolExternalId','701','correlationId','s295-observed-result','recordCount',2,'normalizedCount',2,'durationMs',7,'complete',true,'raw','must-not-persist'))));
select is((select missing_sync_count from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),0,'observed presence in a pool wins over overlapping full club absence');
select ok((select private.sportlink_match_is_visible_s295_v1(match)from public.sports_matches match where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'latest complete scope membership unions overlapping presence');
select ok((select bool_and(source_observations::text not like '%must-not-persist%')and bool_or(source_observations::text like '%s295-observed-result%')from private.sportlink_match_observations_s295 where tenant_id='10000000-0000-4000-8000-000000000291'),'safe source correlation and timing persist without unrecognized raw data');
select pg_temp.complete_matches('matches','[]',pg_temp.scope()||jsonb_build_object('scopes',jsonb_build_array(
 (pg_temp.scope()->'scopes'->0)||'{"scope":"club"}'::jsonb,
 jsonb_set((pg_temp.scope()->'scopes'->0)||'{"complete":false}'::jsonb,'{resultExternalIds}','["result-home","pool-other"]'))));
select ok((select private.sportlink_match_is_visible_s295_v1(match)from public.sports_matches match where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'positive partial pool observation wins over complete overlapping club absence');
select pg_temp.complete_matches('matches','[]',pg_temp.scope()||jsonb_build_object('scopes',jsonb_build_array(
 jsonb_set((pg_temp.scope()->'scopes'->0)||'{"scope":"club","complete":false}'::jsonb,'{resultExternalIds}','["result-home"]'),
 pg_temp.scope()->'scopes'->0)));
select ok((select private.sportlink_match_is_visible_s295_v1(match)from public.sports_matches match where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'positive partial club observation wins over complete overlapping pool absence');
-- A second partial response cannot erase positive rows from the first one.
select pg_temp.complete_matches('matches','[]',jsonb_set(pg_temp.scope(),'{scopes,0,resultExternalIds}','[]'));
select pg_temp.complete_matches('matches','[]',jsonb_set(pg_temp.scope(false),'{scopes,0,resultExternalIds}','["result-home"]'));
select pg_temp.complete_matches('matches','[]',jsonb_set(pg_temp.scope(false),'{scopes,0,resultExternalIds}','["result-away"]'));
select ok((select private.sportlink_match_is_visible_s295_v1(match)from public.sports_matches match where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'partial A then partial B retains observed A');
select pg_temp.complete_matches('matches','[]',pg_temp.scope());
select pg_temp.complete_matches('matches','[]',jsonb_set(pg_temp.scope(false),'{scopes,0,resultExternalIds}','["result-away"]'));
select ok((select not private.sportlink_match_is_visible_s295_v1(match)from public.sports_matches match where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'new complete absence wins over old partial A when only partial B reappears');
-- Reset only the explicit history fixture before testing its three-run guard.
update public.sports_matches set active=true,missing_sync_count=0 where tenant_id='10000000-0000-4000-8000-000000000291'and external_id in('pool-other','result-home');
select pg_temp.complete_matches('matches','[]',pg_temp.scope(false));
select is((select missing_sync_count from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),0,'partial coverage never counts absence');
select pg_temp.complete_matches('matches','[]',pg_temp.scope());
select is((select missing_sync_count from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),1,'valid complete empty scope counts its own missing result');
select pg_temp.complete_matches('matches','[]',pg_temp.scope());
select pg_temp.complete_matches('matches','[]',pg_temp.scope());
select ok((select not active and missing_sync_count=3 from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='result-home'),'three full empty observations confirm withdrawal while keeping history');
select ok((select active from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000292'and external_id='pool-other'),'tenant B match cannot be deactivated by tenant A observation');
select ok((select active from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='neutral'),'different stored pool record remains outside official pool absence scope');
select ok(not has_function_privilege('authenticated','public.complete_sportlink_sync_v5(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)','execute')and not has_function_privilege('anon','public.complete_sportlink_sync_v5(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'),'new provenance completion is service-role only');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('club-results','sport_results'))#>'{sport,items}'),0,'complete empty authority also clears the ordinary Sportlink results blueprint');
select throws_ok($$select pg_temp.complete_matches('matches','[]','{"schemaVersion":1,"scopes":[]}')$$,'22023','invalid_match_observation','missing observation kind fails closed');
select throws_ok($$select pg_temp.complete_matches('matches','[]',jsonb_set(pg_temp.scope(),'{scopes,0,resultsComplete}','"false"'))$$,'22023','invalid_match_observation_scope','nonboolean independent coverage fails closed');

-- A confirmed unpublished official standing is authoritative even when an
-- older provider identity remains in the same exact competition/pool context.
create temporary table before_standing_failure as
 select private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,standings,items}'items;
create function pg_temp.fail_standing()returns void language plpgsql as $$
declare run_id uuid;source record;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 values(source.tenant_id,source.id,'competitions','running','worker:s295-standing',now())returning id into run_id;
 perform public.fail_sportlink_sync_v1(run_id,'worker:s295-standing','SPORTLINK_HTTP_429','controlled technical failure');
end;$$;
select lives_ok($$select pg_temp.fail_standing()$$,'a technical standing failure uses the leased failure route');
select is(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,standings,items}',(select items from before_standing_failure),'technical standing failure preserves the last valid official block');
update public.sports_standings set external_id='older-provider-identity',last_synced_at=now()-interval '1 hour'
 where tenant_id='10000000-0000-4000-8000-000000000291'and pool_external_id='701';
create function pg_temp.complete_standing(published boolean)returns jsonb language plpgsql as $$
declare run_id uuid;source record;standing jsonb;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 select jsonb_build_array(jsonb_build_object('externalId','new-provider-identity','competition',metadata->'competition','pool',metadata->'pool',
  'scoresPublished',published,'rows',case when published then rows_json else '[]'::jsonb end))into standing
 from public.sports_standings where tenant_id=source.tenant_id and source_connection_id=source.id and pool_external_id='701'and external_id='older-provider-identity';
 insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 values(source.tenant_id,source.id,'competitions','running','worker:s295-standing',now())returning id into run_id;
 return public.complete_sportlink_sync_v4(run_id,'worker:s295-standing','{}','{}','[]','[]','[]','[]',standing);
end;$$;
select pg_temp.complete_standing(false);
select is((select count(*)from public.sports_standings where tenant_id='10000000-0000-4000-8000-000000000291'and pool_external_id='701'and active),2::bigint,'fixture retains distinct old and new official standing identities in the same exact context');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,standings,items}'),0,'newer confirmed unpublished standing never falls back to an older published row');
select pg_temp.complete_standing(true);
select is(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,standings,items}',(select items from before_standing_failure),'a later valid official standing recovers the same block');
select *from finish();rollback;
