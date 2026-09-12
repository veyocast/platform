begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

-- Keep today's fixtures genuinely before/after kickoff at any test execution time.
create function pg_temp.match_time_today(p_time time, p_finished boolean)
returns timestamptz language sql stable as $$
  select case when p_finished
    then day_start + (now() - day_start) * (extract(epoch from p_time) / 86400)::double precision
    else now() + (day_end - now()) * (extract(epoch from p_time) / 86400)::double precision
  end
  from (select
    (now() at time zone 'Europe/Amsterdam')::date::timestamp at time zone 'Europe/Amsterdam' as day_start,
    ((now() at time zone 'Europe/Amsterdam')::date + 1)::timestamp at time zone 'Europe/Amsterdam' as day_end
  ) bounds
$$;


select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001781',
  'authenticated',
  'authenticated',
  's178-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000001781',
  'S178 owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001781',
  'S178 tenant',
  's178-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001781'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001781',
  '00000000-0000-4000-8000-000000001781',
  'tenant_owner'
);

create temporary table s178_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s178_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001781', true);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001781',
  'Sportlink · S178',
  'S178',
  '1581',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s178_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001781'
  and source.name = 'Sportlink · S178';


insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,connection_id,team.id,team.name,jsonb_build_object('competitionOptions',team.options)
from s178_source cross join (values
 ('senior','Senioren 1','[{"externalId":"cup","poolExternalId":"cup-pool","period":"bekerfase","season":"2026"},{"externalId":"league","poolExternalId":"league-pool","period":"competitie","season":"2026"}]'::jsonb),
 ('youth','Jeugd O16-1','[{"externalId":"youth","poolExternalId":"youth-pool","period":"fase 1","season":"2026"}]'::jsonb)
) team(id,name,options);

insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select tenant_id,connection_id,f.id,case when f.id='league-next' then now()+interval '10 days'
  else pg_temp.match_time_today(time '12:00',f.id in ('cup-played','youth-played')) end,
  case when f.id in ('cup-played','youth-played') then 'finished' else 'scheduled' end,
  jsonb_build_object('externalId',f.home,'name',f.home),jsonb_build_object('externalId',f.away,'name',f.away),
  jsonb_build_object('externalId','fixture-label-hash-'||f.comp,'name',f.comp,'period',f.phase,'season','2026'),
  jsonb_build_object('externalId',f.pool,'competitionExternalId',f.comp),true,true
from s178_source cross join (values
 ('cup-played','senior','opponent','cup','cup-pool','bekerfase'),
 ('cup-next','senior','opponent','cup','cup-pool','bekerfase'),
 ('league-next','opponent','senior','league','league-pool','competitie'),
 ('youth-played','opponent','youth','youth','youth-pool','fase 1'),
 ('youth-next','youth','opponent','youth','youth-pool','fase 1'),
 ('cup-foreign','opponent','other','cup','cup-pool','bekerfase'),
 ('wrong-phase','senior','opponent','cup','cup-pool','andere fase')
) f(id,home,away,comp,pool,phase);

insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,rows_json,metadata,scores_published,active,last_synced_at)
select tenant_id,connection_id,st.comp,st.pool,'2026',jsonb_build_array(
  jsonb_build_object('externalId',st.team,'teamName',st.team,'position',1,'played',st.played,'points',3)),
  jsonb_build_object('competition',jsonb_build_object('externalId',st.comp,'name',st.comp,'period',st.phase,'season','2026'),
    'pool',jsonb_build_object('externalId',st.pool)),true,true,now()+case when st.comp='league' then interval '1 hour' else interval '0 hours' end
from s178_source cross join (values
 ('cup','cup-pool','bekerfase','senior',2),('league','league-pool','competitie','senior',0),
 ('youth','youth-pool','fase 1','youth',2)
) st(comp,pool,phase,team,played);

create function pg_temp.context(p_team text) returns jsonb language sql immutable as $$
 select jsonb_build_object('providerTeamId',p_team,'competitionSelectionMode','auto_current',
 'competitionId',null,'poolId',null,'phaseId',null,'seasonId',null)
$$;
create function pg_temp.snapshot(p_team text,p_blueprint text default 'sportlink.pool_standings')
returns jsonb language sql stable as $$
 select private.build_dynamic_snapshot_data(jsonb_populate_record(null::public.dynamic_slides,
  jsonb_build_object('id','20000000-0000-4000-8000-000000001781','tenant_id',s.tenant_id,
    'data_source_id',s.data_source_id,'name','Actuele selectie','slide_type',t.slide_type,
    'orientation','landscape','selection_mode','latest','template_id',t.id,'template_version_id',t.current_published_version_id,
    'configuration_json',jsonb_build_object('blueprintKey',p_blueprint,'title','Actuele selectie','context',pg_temp.context(p_team)))))
 from s178_source s cross join lateral (select * from public.dynamic_templates
   where slide_type=case when p_blueprint like '%standings' then 'sport_standing' when p_blueprint like '%results%' then 'sport_results' else 'sport_program' end
   and status='published' and orientation='landscape' order by slug limit 1) t
$$;


-- Actual mapper contract: these source rows have no teamcode; externalId is
-- the exact hash emitted by mapSportlinkStandings, not the own team's ID.
update public.sports_standings set rows_json='[
 {"externalId":"e9b786e5abe910e340fe1403ff82217246ce41f76605c3e4f6b5d2b1a005e341","teamName":"Senioren 1","position":1,"played":2,"points":6},
 {"externalId":"opponent","teamName":"Opponent","position":2,"played":2,"points":3}]'
where tenant_id='10000000-0000-4000-8000-000000001781' and external_id in ('cup','league');
update public.sports_standings set rows_json='[
 {"externalId":"bfcf35946c849398d5bbd4485d768631482dcbcf4fe5f94ae7b753365b79fc3c","teamName":"Jeugd O16-1","position":1,"played":2,"points":6}]'
where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='youth';
select is(pg_temp.snapshot('senior')#>>'{sport,poolContext,poolId}','cup-pool','cup is current even when rows lack teamcode');
select is(jsonb_array_length(pg_temp.snapshot('senior')#>'{sport,items}'),2,'actual mapper rows show the complete cup table');
select is(pg_temp.snapshot('senior')#>>'{sport,items,0,selected}','true','hashed own row is highlighted');
select is(pg_temp.snapshot('senior')#>>'{sport,items,1,selected}','false','opponent is not highlighted');
select is(pg_temp.snapshot('youth')#>>'{sport,items,0,teamName}','Jeugd O16-1','youth source row without a teamcode is visible');
select is(pg_temp.snapshot('youth')#>>'{sport,items,0,selected}','true','youth own row is highlighted');

create function pg_temp.standing_identity(p_tenant uuid default '10000000-0000-4000-8000-000000001781',p_connection uuid default null)
returns jsonb language sql stable as $$
 select private.resolve_sportlink_standing_team_identity_v1(p_tenant,coalesce(p_connection,connection_id),'senior') from s178_source
$$;
select is(pg_temp.standing_identity()->>'syntheticId','e9b786e5abe910e340fe1403ff82217246ce41f76605c3e4f6b5d2b1a005e341','SQL and provider mapper share the exact UTF8/NUL identity contract');
select ok(not private.sportlink_standing_row_matches_team_v1('{"externalId":"different-provider-team","teamName":"Senioren 1"}',pg_temp.standing_identity()),'explicit different provider ID is never overridden by a name');
select ok(not private.sportlink_standing_row_matches_team_v1('{"externalId":"e9b786e5abe910e340fe1403ff82217246ce41f76605c3e4f6b5d2b1a005e341","teamName":"Other name"}',pg_temp.standing_identity()),'hash alone cannot substitute a different row name');
select ok(not private.sportlink_standing_row_matches_team_v1('{"teamName":"Senioren 1"}',pg_temp.standing_identity()),'unidentified unmapped row is not linked by name alone');
select is(pg_temp.standing_identity('10000000-0000-4000-8000-000000009999'),null::jsonb,'foreign tenant has no selected identity');
select is(pg_temp.standing_identity(p_connection=>'20000000-0000-4000-8000-000000009999'),null::jsonb,'foreign source has no selected identity');

insert into public.sports_teams(tenant_id,source_connection_id,external_id,name)
select tenant_id,connection_id,'same-name','Senioren 1' from s178_source;
select is(pg_temp.standing_identity()->>'syntheticId',null::text,'ambiguous active own names disable synthetic identity');
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','STANDINGS_NOT_PUBLISHED','ambiguous source row remains hidden');
select ok(private.sportlink_standing_row_matches_team_v1('{"externalId":"senior","teamName":"Old provider label"}',pg_temp.standing_identity()),'real ID remains authoritative with duplicate names and changed label');
update public.sports_teams set active=false where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='same-name';
select is(jsonb_array_length(pg_temp.snapshot('senior')#>'{sport,items}'),2,'inactive duplicate does not make current team ambiguous');

-- With no current fixtures the resolver can still use a single matching
-- standing, while multiple matching phases remain unresolved.
update public.sports_matches set active=false where tenant_id='10000000-0000-4000-8000-000000001781' and external_id like 'cup-%' or (tenant_id='10000000-0000-4000-8000-000000001781' and external_id in ('league-next','wrong-phase'));
update public.sports_standings set active=false where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='league';
select is(pg_temp.snapshot('senior')#>>'{sport,poolContext,poolId}','cup-pool','standing fallback also recognises mapped identity');
update public.sports_standings set active=true where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='league';
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','COMPETITION_CONTEXT_UNRESOLVED','synthetic identity does not decide between two plausible competitions');
update public.sports_matches set active=true where tenant_id='10000000-0000-4000-8000-000000001781';
update public.sports_standings set metadata=jsonb_set(metadata,'{competition,period}','"wrong phase"') where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='cup';
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','STANDINGS_NOT_PUBLISHED','name fallback cannot relax the chosen phase');
update public.sports_standings set metadata=jsonb_set(metadata,'{competition,period}','"bekerfase"'), scores_published=false where tenant_id='10000000-0000-4000-8000-000000001781' and external_id='cup';
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','STANDINGS_NOT_PUBLISHED','non-public scores remain hidden');

-- The optimised in-memory row predicate must equal the existing database
-- predicate for every selection, location, phase, side and unknown source.
create temporary table selections(value jsonb);
insert into selections(value)
select jsonb_build_object('mode',mode,'matchLocation',location,'teamContexts',contexts)
from (values ('all'),('selected')) modes(mode)
cross join (values ('both'),('home'),('away')) locations(location)
cross join (values ('[]'::jsonb),
 (jsonb_build_array(pg_temp.context('senior'))),
 (jsonb_build_array(pg_temp.context('senior') || '{"competitionSelectionMode":"pinned","competitionId":"cup","poolId":"cup-pool","phaseId":"bekerfase","seasonId":"2026"}'::jsonb)),
 (jsonb_build_array(pg_temp.context('youth'),pg_temp.context('senior'))),
 (jsonb_build_array(pg_temp.context('unknown'))),
 (jsonb_build_array(pg_temp.context('senior') || '{"competitionSelectionMode":"pinned","competitionId":"league","poolId":"league-pool"}'::jsonb))
) contexts(contexts);
insert into selections values ('{}'), ('{"mode":"all","teamContexts":[],"matchLocation":"invalid"}'), ('{"mode":"selected","teamContexts":null}');
select is((select count(*) from selections c cross join s178_source s
 join public.sports_matches m on m.tenant_id=s.tenant_id
 where private.sportlink_match_matches_team_selection_v1(s.tenant_id,s.data_source_id,m,c.value)
 is distinct from private.sportlink_match_matches_resolved_selection_v1(m,
   private.resolve_sportlink_match_selection_v1(s.tenant_id,s.data_source_id,c.value))),0::bigint,
 'resolved selection preserves all 273 existing match decisions');
select ok(not (select private.sportlink_match_matches_resolved_selection_v1(m,
  private.resolve_sportlink_match_selection_v1('10000000-0000-4000-8000-000000009999',s.data_source_id,'{"mode":"all","teamContexts":[]}'))
  from s178_source s join public.sports_matches m on m.tenant_id=s.tenant_id limit 1),'resolved selector rejects foreign tenant');
select ok(not (select private.sportlink_match_matches_resolved_selection_v1(m,
  private.resolve_sportlink_match_selection_v1(s.tenant_id,'20000000-0000-4000-8000-000000009999','{"mode":"all","teamContexts":[]}'))
  from s178_source s join public.sports_matches m on m.tenant_id=s.tenant_id limit 1),'resolved selector rejects foreign source');

-- A production-sized candidate set still produces the same bounded, sorted
-- immutable contract. Timing is profiled separately, not a flaky CI threshold.
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select tenant_id,connection_id,'load-'||n,now()+interval '1 hour'*(n%150+1),'scheduled',
 '{"externalId":"senior","name":"Senioren 1"}','{"externalId":"opponent","name":"Opponent"}',
 '{"externalId":"cup","period":"bekerfase","season":"2026"}',
 '{"externalId":"cup-pool","competitionExternalId":"cup"}',true,true
from s178_source cross join generate_series(1,1000) n;
select is(jsonb_array_length(pg_temp.snapshot('senior','sportlink.club_schedule_next_7_days')#>'{sport,items}'),100,'1000 candidate matches preserve the 100-row club bound');
select ok((select bool_and((r->>'kickoffAt')::timestamptz>now()) from jsonb_array_elements(pg_temp.snapshot('senior','sportlink.club_schedule_next_7_days')#>'{sport,items}') r),'optimised programme still excludes every started match');
select ok(not has_function_privilege('anon','private.resolve_sportlink_match_selection_v1(uuid,uuid,jsonb)','execute'),'anonymous users cannot resolve tenant matches directly');
select ok(not has_function_privilege('authenticated','private.resolve_sportlink_standing_team_identity_v1(uuid,uuid,text)','execute'),'Studio users cannot bypass the standing boundary');
select ok(not has_function_privilege('service_role','private.sportlink_match_matches_resolved_selection_v1(public.sports_matches,jsonb)','execute'),'internal predicate does not create a new service RPC');
select * from finish();
rollback;
