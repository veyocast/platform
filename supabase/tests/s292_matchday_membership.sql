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

-- Team B shares the selected pool, and has newer results and earlier fixtures.
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,is_home_match)
select source.tenant_id,source.id,f.id,now()+make_interval(hours=>f.hours),f.status,
 jsonb_build_object('externalId','own-team-2','name','Own team 2','score',7),jsonb_build_object('externalId','opponent-b','name','Opponent B','score',0),
 '{"externalId":"league","period":"phase","season":null}',
 jsonb_build_object('externalId',encode(extensions.digest(convert_to('pool-context','UTF8')||decode('00','hex')||convert_to('league|C','UTF8'),'sha256'),'hex'),'name','C','competitionExternalId','league'),true,true
from own_source source cross join(values('b-recent',-1,'finished'),('b-upcoming',1,'scheduled'))f(id,hours,status);
update public.sports_standings set rows_json=rows_json||'[{"externalId":"own-team-2","teamName":"Own team 2","position":2,"played":1,"points":0}]'::jsonb where tenant_id='10000000-0000-4000-8000-000000000291';
create temporary table actual(direction text,data jsonb);
insert into actual select direction,private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day',direction))from(values('both'),('home'),('away'))d(direction);
select is((select count(*)from jsonb_array_elements(actual.data#>'{sport,matchday,results,items}')item where item->>'homeTeamId'<>'own-team'and item->>'awayTeamId'<>'own-team'),0::bigint,'results never leak team B for '||direction)from actual;
select is((select count(*)from jsonb_array_elements(actual.data#>'{sport,matchday,fixtures,items}')item where item->>'homeTeamId'<>'own-team'and item->>'awayTeamId'<>'own-team'),0::bigint,'fixtures never leak team B for '||direction)from actual;
select is(jsonb_array_length(data#>'{sport,matchday,standings,items}'),2,'full pool standings remain for '||direction)from actual;
select ok((select bool_and(item->>'homeTeamId'='own-team')from jsonb_array_elements(data#>'{sport,matchday,fixtures,items}')item),'home is an extra direction filter')from actual where direction='home';
select ok((select bool_and(item->>'awayTeamId'='own-team')from jsonb_array_elements(data#>'{sport,matchday,fixtures,items}')item),'away is an extra direction filter')from actual where direction='away';
select is(data#>>'{sport,matchday,fixtures,items,0,id}','home','a sooner B fixture cannot replace A')from actual where direction='both';
select isnt(data#>>'{sport,matchday,results,items,0,id}','b-recent','a newer B result cannot replace A')from actual where direction='both';
-- An empty A selection must stay empty even while B has valid matches.
-- Pin the intended league: without A matches the fixture's league/cup auto
-- selection is correctly ambiguous, and must not silently pick either one.
create or replace function pg_temp.context() returns jsonb language sql immutable as $$select '{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"league","phaseId":"phase","poolId":"701","seasonId":null}'::jsonb$$;
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day','home'))#>'{sport,matchday,fixtures,items}'),4,'pinned league direction uses the already resolved canonical pool for synthetic stored pool IDs');
delete from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and (home_team->>'externalId'='own-team'or away_team->>'externalId'='own-team');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,results,items}'),0,'missing A result never falls back to B');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day'))#>'{sport,matchday,fixtures,items}'),0,'missing A fixture never falls back to B');
select *from finish();rollback;
