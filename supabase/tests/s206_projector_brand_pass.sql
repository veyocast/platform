begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Exact pre-change S178 and canonical S122 bodies, copied into this rollback
-- fixture. Only function names and the S122 first callee are redirected.
-- Both sides execute in one statement: now()/statement_timestamp() are equal.
create or replace function pg_temp.s206_original_typed(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  blueprint text := p_slide.configuration_json ->> 'blueprintKey';
  context jsonb := p_slide.configuration_json -> 'context';
  arrival jsonb := coalesce(p_slide.configuration_json -> 'arrival', '{}'::jsonb);
  result jsonb;
  resolved_context jsonb;
  standing_team_identity jsonb;
  title text := coalesce(nullif(p_slide.configuration_json ->> 'title', ''), p_slide.name);
  before_minutes integer := private.sportlink_arrival_window_minutes(
    arrival,
    'minutesBefore',
    90
  );
  after_minutes integer := private.sportlink_arrival_window_minutes(
    arrival,
    'minutesAfter',
    30
  );
begin
  if blueprint is null then
    return private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide);
  end if;

  if blueprint = 'sportlink.pool_standings' then
    resolved_context := private.resolve_sportlink_pool_context_v1(
      p_slide.tenant_id, p_slide.data_source_id, context, blueprint);
    if resolved_context is null then
      return jsonb_build_object('type','sport_standing','sport',jsonb_build_object(
        'title',title,'generatedAt',now(),'items','[]'::jsonb,
        'poolContext',null,'emptyStateCode','COMPETITION_CONTEXT_UNRESOLVED'));
    end if;
    standing_team_identity := private.resolve_sportlink_standing_team_identity_v1(
      p_slide.tenant_id, (resolved_context ->> 'sourceConnectionId')::uuid, context ->> 'providerTeamId');
    select jsonb_build_object(
      'type', 'sport_standing',
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'poolContext', resolved_context,
        'competition', standing.metadata -> 'competition',
        'pool', standing.metadata -> 'pool',
        'season', standing.season_key,
        'items', coalesce((
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', row ->> 'externalId',
            'position', nullif(row ->> 'position', '')::integer,
            'teamName', row ->> 'teamName',
            'played', nullif(row ->> 'played', '')::integer,
            'won', nullif(row ->> 'won', '')::integer,
            'drawn', nullif(row ->> 'drawn', '')::integer,
            'lost', nullif(row ->> 'lost', '')::integer,
            'goalsFor', nullif(row ->> 'goalsFor', '')::integer,
            'goalsAgainst', nullif(row ->> 'goalsAgainst', '')::integer,
            'goalDifference', nullif(row ->> 'goalDifference', '')::integer,
            'points', nullif(row ->> 'points', '')::integer,
            'selected', private.sportlink_standing_row_matches_team_v1(row, standing_team_identity)
          )) order by nullif(row ->> 'position', '')::integer nulls last)
          from jsonb_array_elements(standing.rows_json) row
        ), '[]'::jsonb),
        'emptyStateCode', case when standing.id is null then 'STANDINGS_NOT_PUBLISHED' end
      )
    ) into result
    from public.sports_standings standing
    join public.sportlink_connections connection
      on connection.id = standing.source_connection_id
      and connection.tenant_id = standing.tenant_id
    where standing.tenant_id = p_slide.tenant_id
      and connection.data_source_id = p_slide.data_source_id
      and standing.active
      and standing.source_connection_id = (resolved_context ->> 'sourceConnectionId')::uuid
      and coalesce(standing.metadata #>> '{pool,externalId}',
        standing.metadata #>> '{pool,poolExternalId}',standing.pool_external_id) = resolved_context ->> 'poolId'
      and (private.sportlink_competition_identity_v1(standing.metadata -> 'competition',standing.metadata -> 'pool') is null
        or private.sportlink_competition_identity_v1(standing.metadata -> 'competition',standing.metadata -> 'pool') = resolved_context ->> 'competitionId')
      and (resolved_context ->> 'phaseId' is null or
        standing.metadata #>> '{competition,period}' = resolved_context ->> 'phaseId')
      and (resolved_context ->> 'seasonId' is null or standing.season_key = resolved_context ->> 'seasonId')
      and standing.scores_published
      and exists (select 1 from jsonb_array_elements(standing.rows_json) team_row
        where private.sportlink_standing_row_matches_team_v1(team_row, standing_team_identity))
    order by standing.last_synced_at desc, standing.id
    limit 1;
    if result is null then
      return jsonb_build_object('type','sport_standing','sport',jsonb_build_object(
        'title',title,'generatedAt',now(),'items','[]'::jsonb,
        'poolContext',resolved_context,'emptyStateCode','STANDINGS_NOT_PUBLISHED'));
    end if;
  elsif blueprint in (
    'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  ) then
    with matches as (
      select match.*, connection.timezone
      from public.sports_matches match
      join public.sportlink_connections connection
        on connection.id = match.source_connection_id
        and connection.tenant_id = match.tenant_id
      where match.tenant_id = p_slide.tenant_id
        and connection.data_source_id = p_slide.data_source_id
        and match.active
        and match.is_home_match
        and match.status in ('scheduled', 'postponed')
        and match.starts_at between
          now() - make_interval(mins => after_minutes)
          and now() + make_interval(mins => before_minutes)
      order by match.starts_at
      limit 40
    ), cards as (
      select
        match.external_id id,
        match.starts_at,
        match.away_team ->> 'name' card_name,
        match.dressing_rooms ->> 'away' room,
        match.venue ->> 'field' field,
        match.competition ->> 'name' competition,
        0 person_index
      from matches match
      where blueprint = 'sportlink.visitor_arrivals'
      union all
      select
        match.external_id || ':' || official.ordinality,
        match.starts_at,
        coalesce(official.value ->> 'displayName', official.value ->> 'name'),
        match.dressing_rooms ->> 'official',
        match.venue ->> 'field',
        match.competition ->> 'name',
        official.ordinality::integer
      from matches match
      cross join lateral jsonb_array_elements(match.officials)
        with ordinality official(value, ordinality)
      where blueprint = 'sportlink.referee_arrivals'
    )
    select jsonb_build_object(
      'type', case blueprint
        when 'sportlink.visitor_arrivals' then 'sport_visitor_arrivals'
        else 'sport_referee_arrivals'
      end,
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'arrivalConfig', arrival,
        'pageDurationSeconds', coalesce((arrival ->> 'pageDurationSeconds')::integer, 12),
        'items', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'primary', card_name,
          'secondary', concat_ws(' · ',
            case when coalesce((arrival ->> 'showArrivalTime')::boolean, true)
              then 'Aankomst ' || to_char(
                (starts_at - make_interval(mins => before_minutes))
                  at time zone 'Europe/Amsterdam',
                'HH24:MI'
              )
            end,
            case when coalesce((arrival ->> 'showKickoffTime')::boolean, true)
              then 'Aanvang ' || to_char(
                starts_at at time zone 'Europe/Amsterdam',
                'HH24:MI'
              )
            end
          ),
          'meta', concat_ws(' · ',
            case when coalesce((arrival ->> 'showDressingRoom')::boolean, true)
              and coalesce(room, '') <> '' then 'Kleedkamer ' || room end,
            case when coalesce((arrival ->> 'showField')::boolean, true)
              and coalesce(field, '') <> '' then 'Veld ' || field end,
            case when coalesce((arrival ->> 'showCompetition')::boolean, false)
              then nullif(competition, '') end,
            nullif(arrival ->> 'dutyDeskText', '')
          ),
          'status', case when coalesce((arrival ->> 'showWelcome')::boolean, true)
            then coalesce(nullif(arrival ->> 'welcomeText', ''), 'Welkom bij {{club}}')
            else ''
          end,
          'arrivalAt', starts_at - make_interval(mins => before_minutes),
          'kickoffAt', starts_at,
          'name', card_name,
          'dressingRoom', room,
          'field', field,
          'competition', competition,
          'recent', (starts_at - make_interval(mins => before_minutes)) between
            now() - make_interval(
              mins => coalesce((arrival ->> 'highlightRecentMinutes')::integer, 15)
            ) and now()
        )) order by starts_at, person_index), '[]'::jsonb),
        'emptyStateCode', case when count(*) = 0 then 'NO_ARRIVALS_IN_WINDOW' end
      )
    ) into result
    from cards;
  else
    with filtered as (
      select match.*, connection.timezone
      from public.sports_matches match
      join public.sportlink_connections connection
        on connection.id = match.source_connection_id
        and connection.tenant_id = match.tenant_id
      where match.tenant_id = p_slide.tenant_id
        and connection.data_source_id = p_slide.data_source_id
        and match.active
        and case when blueprint like '%results%'
          then match.status = 'finished' and match.scores_published
          else match.status in ('scheduled', 'postponed')
        end
        and case
          when blueprint like '%today' then
            (match.starts_at at time zone connection.timezone)::date =
              (now() at time zone connection.timezone)::date
          when blueprint like '%next_7_days' then
            (match.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date
            and (match.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date + 7
          else
            (match.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date - 7
            and (match.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date
        end
        and (
          blueprint not like 'sportlink.pool_%'
          or context ->> 'poolId' is null
          or match.pool ->> 'externalId' = context ->> 'poolId'
          or match.pool ->> 'poolExternalId' = context ->> 'poolId'
        )
      order by case when blueprint like '%results%'
        then -extract(epoch from match.starts_at)
        else extract(epoch from match.starts_at)
      end
      limit 40
    )
    select jsonb_build_object(
      'type', p_slide.slide_type,
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'items', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', external_id,
          'primary', (home_team ->> 'name') || ' – ' || (away_team ->> 'name'),
          'secondary', to_char(
            starts_at at time zone timezone,
            'DD-MM-YYYY HH24:MI'
          ),
          'date', to_char(starts_at at time zone timezone, 'DD-MM-YYYY'),
          'time', to_char(starts_at at time zone timezone, 'HH24:MI'),
          'homeTeam', home_team ->> 'name',
          'awayTeam', away_team ->> 'name',
          'homeScore', case when home_team ->> 'score' ~ '^\d+$'
            then (home_team ->> 'score')::integer end,
          'awayScore', case when away_team ->> 'score' ~ '^\d+$'
            then (away_team ->> 'score')::integer end,
          'competition', competition ->> 'name',
          'venue', coalesce(venue ->> 'field', venue ->> 'name', ''),
          'meta', coalesce(venue ->> 'field', venue ->> 'name', ''),
          'status', status
        )) order by starts_at), '[]'::jsonb),
        'emptyStateCode', case when count(*) = 0 then
          case when blueprint like '%results%'
            then 'RESULTS_NOT_PUBLISHED'
            else 'NO_ITEMS_IN_PERIOD'
          end
        end
      )
    ) into result
    from filtered;
  end if;

  return coalesce(
    result,
    jsonb_build_object(
      'type', p_slide.slide_type,
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'items', '[]'::jsonb,
        'emptyStateCode', 'NO_ITEMS_IN_PERIOD'
      )
    )
  ) || jsonb_build_object(
    'brand', coalesce(
      private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide) -> 'brand',
      '{}'::jsonb
    )
  );
end
$$;

create or replace function pg_temp.s206_original_wrapper(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  themed_base jsonb;
begin
  result := pg_temp.s206_original_typed(p_slide);
  if p_slide.configuration_json ->> 'blueprintKey' is null then return result; end if;
  themed_base := private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide);
  return result
    || jsonb_build_object(
      'brand', coalesce(themed_base -> 'brand', '{}'::jsonb),
      'themePresentation', themed_base -> 'themePresentation'
    );
end;
$$;

-- Fail if any remaining installed application function starts consuming the
-- intermediate brand directly instead of the canonical overwrite wrapper.
select is((select array_agg(p.proname::text order by p.proname)
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('private','public')
    and position('private.build_dynamic_snapshot_data_before_s122_theme_restore(' in p.prosrc)>0),
  array['build_dynamic_snapshot_data_before_s128_birthdays']::text[],
  'the intermediate typed alias has exactly its canonical application caller');
select ok((select p.provolatile='s' and p.prosecdef and p.proconfig=array['search_path=""']::text[]
  from pg_catalog.pg_proc p where p.oid='private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)'::regprocedure),
  'stable private definer and empty search_path are retained');
select ok(not has_function_privilege('anon','private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)','execute')
  and not has_function_privilege('authenticated','private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)','execute')
  and not has_function_privilege('service_role','private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)','execute')
  and not exists(select 1 from pg_catalog.pg_proc p,
    lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    where p.oid='private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)'::regprocedure
      and a.grantee=0 and a.privilege_type='EXECUTE'),
  'PUBLIC and every Data API role remain unable to call the intermediate alias');
select is((select encode(extensions.digest(p.prosrc,'sha256'),'hex') from pg_catalog.pg_proc p
  where p.oid='pg_temp.s206_original_typed(public.dynamic_slides)'::regprocedure),
  '74709e28499403cb823cf9babedfacd2ded4187e69c7404d15a339a523c2de7c',
  'native reference body is the exact original S178 body');
select is((select encode(extensions.digest(replace(p.prosrc,
  'pg_temp.s206_original_typed(p_slide)',
  'private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide)'),'sha256'),'hex')
  from pg_catalog.pg_proc p where p.oid='pg_temp.s206_original_wrapper(public.dynamic_slides)'::regprocedure),
  'c8e244297719458ed96aff2b3686bceb87a84cda1608f6a69856ee26e8bb1a89',
  'native reference wrapper is the exact unchanged S122 body');
select is((select p.prosrc from pg_catalog.pg_proc p
  where p.oid='private.build_dynamic_snapshot_data_before_s128_birthdays(public.dynamic_slides)'::regprocedure),
  (select replace(p.prosrc,'pg_temp.s206_original_typed(p_slide)',
    'private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide)')
   from pg_catalog.pg_proc p where p.oid='pg_temp.s206_original_wrapper(public.dynamic_slides)'::regprocedure),
  'the canonical S122 overwrite wrapper is unchanged');
select is((select replace(p.prosrc,$new$'brand', '{}'::jsonb$new$,
  $old$'brand', coalesce(
      private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide) -> 'brand',
      '{}'::jsonb
    )$old$) from pg_catalog.pg_proc p
  where p.oid='private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)'::regprocedure),
  (select p.prosrc from pg_catalog.pg_proc p where p.oid='pg_temp.s206_original_typed(public.dynamic_slides)'::regprocedure),
  'the entire installed typed body differs only by the final discarded brand expression');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000002061','authenticated','authenticated','s206-a@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000002062','authenticated','authenticated','s206-b@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000002061','S206 owner A'),
('00000000-0000-4000-8000-000000002062','S206 owner B');
insert into public.tenants(id,name,slug) values
('10000000-0000-4000-8000-000000002061','S206 own club','s206-own'),
('10000000-0000-4000-8000-000000002062','S206 foreign club','s206-foreign');
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000002061'),('10000000-0000-4000-8000-000000002062');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000002061','00000000-0000-4000-8000-000000002061','tenant_owner'),
('10000000-0000-4000-8000-000000002062','00000000-0000-4000-8000-000000002062','tenant_owner');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002061',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002061','S206 primary','Own SV','2061','encrypted-value','initialization-vector','authentication-tag');
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002061','S206 secondary','Other source SV','2062','encrypted-value','initialization-vector','authentication-tag');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002062',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000002062','S206 foreign','Foreign SV','2063','encrypted-value','initialization-vector','authentication-tag');
reset role;
create temporary table s206_sources as
select case source.name when 'S206 primary' then 'primary' when 'S206 secondary' then 'secondary' else 'foreign' end name,
  c.tenant_id,c.id connection_id,c.data_source_id
from public.sportlink_connections c join public.dynamic_data_sources source
  on source.tenant_id=c.tenant_id and source.id=c.data_source_id
where c.tenant_id in ('10000000-0000-4000-8000-000000002061','10000000-0000-4000-8000-000000002062');
select is((select count(*) from s206_sources),3::bigint,'three independent tenant/source fixtures exist');
update public.tenant_settings set timezone_name='Pacific/Auckland',primary_color='#315CFF'
where tenant_id='10000000-0000-4000-8000-000000002061';

insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select s.tenant_id,s.connection_id,'senior',case when s.name='primary' then 'Senioren 1' else s.name||' private team' end,
  '{"competitionOptions":[{"externalId":"cup","poolExternalId":"cup-pool","period":"bekerfase","season":"2026"}]}'::jsonb
from s206_sources s;
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active,is_home_match,officials,venue,dressing_rooms)
select s.tenant_id,s.connection_id,s.name||'-'||f.id,now()+f.offset_time,f.status,
  jsonb_build_object('externalId','senior','name',case when s.name='primary' then 'Senioren 1' else s.name||' private team' end,'score',case when f.status='finished' then '2' end),
  jsonb_build_object('externalId','opponent','name','Opponent','score',case when f.status='finished' then '1' end),
  '{"externalId":"cup","name":"Cup","period":"bekerfase","season":"2026"}',
  '{"externalId":"cup-pool","competitionExternalId":"cup"}',true,true,true,
  '[{"displayName":"Official fixture"}]','{"field":"1"}','{"away":"4","official":"5"}'
from s206_sources s cross join (values
  ('played',interval '-1 day','finished'),('next',interval '10 minutes','scheduled'),('future',interval '1 day','scheduled')) f(id,offset_time,status);
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select s.tenant_id,s.connection_id,'load-'||n,now()+interval '1 hour'*(n%150+1),'scheduled',
  '{"externalId":"senior","name":"Senioren 1"}','{"externalId":"opponent","name":"Opponent"}',
  '{"externalId":"cup","period":"bekerfase","season":"2026"}',
  '{"externalId":"cup-pool","competitionExternalId":"cup"}',true,true
from s206_sources s cross join generate_series(1,1000) n where s.name='primary';
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,rows_json,metadata,scores_published,active,last_synced_at)
select s.tenant_id,s.connection_id,'cup','cup-pool','2026',jsonb_build_array(
  jsonb_build_object('externalId','senior','teamName',case when s.name='primary' then 'Senioren 1' else s.name||' private team' end,'position',1,'played',2,'points',6),
  jsonb_build_object('externalId','opponent','teamName','Opponent','position',2,'played',2,'points',3)),
  '{"competition":{"externalId":"cup","period":"bekerfase","season":"2026"},"pool":{"externalId":"cup-pool"}}',true,true,now()
from s206_sources s;

create function pg_temp.s206_slide(p_blueprint text,p_source text default 'primary',p_extra jsonb default '{}',p_type text default null)
returns public.dynamic_slides language sql stable as $$
  select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object(
    'id','20000000-0000-4000-8000-000000002061','tenant_id',s.tenant_id,'data_source_id',s.data_source_id,
    'name','S206 native differential','slide_type',t.slide_type,'orientation','landscape','selection_mode','latest',
    'template_id',t.id,'template_version_id',t.current_published_version_id,
    'configuration_json',jsonb_strip_nulls(jsonb_build_object('blueprintKey',p_blueprint,'title','S206 native differential',
      'context',jsonb_build_object('providerTeamId','senior','competitionSelectionMode','pinned',
        'competitionId','cup','poolId','cup-pool','phaseId','bekerfase','seasonId','2026'))) || p_extra))
  from s206_sources s cross join lateral(select * from public.dynamic_templates
    where slide_type=coalesce(p_type,case when p_blueprint like '%standings' then 'sport_standing'
      when p_blueprint like '%results%' then 'sport_results' when p_blueprint='sportlink.birthdays' then 'sport_birthdays'
      when p_blueprint='sportlink.visitor_arrivals' then 'sport_visitor_arrivals'
      when p_blueprint='sportlink.referee_arrivals' then 'sport_referee_arrivals' else 'sport_program' end)
      and orientation='landscape' and status='published' order by slug,id limit 1) t
  where s.name=p_source
$$;
create function pg_temp.s206_equal(p_slide public.dynamic_slides)
returns boolean language sql stable as $$
  select pg_temp.s206_original_wrapper(p_slide)::text =
    private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide)::text
$$;

-- Each assertion actually executes both full wrappers with native PostgreSQL;
-- the 1000-row fixture rules out a vacuous empty-content comparison.
select ok(pg_temp.s206_equal(pg_temp.s206_slide(blueprint)),blueprint||' native payload bytes match')
from (values ('sportlink.pool_standings'),('sportlink.club_schedule_today'),('sportlink.club_schedule_next_7_days'),
  ('sportlink.pool_schedule_today'),('sportlink.pool_schedule_next_7_days'),('sportlink.club_results_today'),
  ('sportlink.club_results_previous_7_days'),('sportlink.pool_results_previous_7_days'),
  ('sportlink.visitor_arrivals'),('sportlink.referee_arrivals'),('sportlink.birthdays')) b(blueprint);
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide('sportlink.pool_standings'))#>'{sport,items}'),2,'resolved standing fixture is non-empty');
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide('sportlink.club_schedule_next_7_days'))#>'{sport,items}'),40,'typed boundary retains its 40-row bound over 1000 candidates');
select ok(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide('sportlink.club_results_previous_7_days'))#>'{sport,items}')>0,'published result fixture is non-empty');
select ok(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide('sportlink.visitor_arrivals'))#>'{sport,items}')>0,'arrival fixture is non-empty');
select ok(pg_temp.s206_equal(pg_temp.s206_slide('sportlink.pool_standings','primary','{"context":{"providerTeamId":"missing","competitionSelectionMode":"auto_current"}}')),
  'unresolved automatic context early return retains identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide(
  'sportlink.pool_standings','primary','{"context":{"providerTeamId":"missing","competitionSelectionMode":"auto_current"}}'))#>>'{sport,emptyStateCode}',
  'COMPETITION_CONTEXT_UNRESOLVED','unresolved context stays fail-closed');
update public.sports_standings set scores_published=false where tenant_id='10000000-0000-4000-8000-000000002061' and source_connection_id=(select connection_id from s206_sources where name='primary');
select ok(pg_temp.s206_equal(pg_temp.s206_slide('sportlink.pool_standings')),'unpublished standing early return matches');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide('sportlink.pool_standings'))#>>'{sport,emptyStateCode}',
  'STANDINGS_NOT_PUBLISHED','unpublished data remains hidden');
update public.sports_standings set scores_published=true where tenant_id='10000000-0000-4000-8000-000000002061';
select ok(pg_temp.s206_equal(pg_temp.s206_slide(null,'primary',jsonb_build_object('maxItems',n))),
  'null blueprint legacy fallback and maxItems='||n||' match') from (values(0),(1),(8),(40),(100)) bounds(n);
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide(null,'primary','{"maxItems":1}'))#>'{sport,items}'),1,'legacy maxItems lower bound is exercised');
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  pg_temp.s206_slide(null,'primary','{"maxItems":100}'))#>'{sport,items}'),40,'legacy maxItems upper bound is exercised');
select ok(pg_temp.s206_equal(pg_temp.s206_slide('sportlink.club_schedule_next_7_days','secondary')),'same-tenant second source bytes match');
select ok(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide(
  'sportlink.club_schedule_next_7_days','primary'))::text not like '%secondary private team%'
  and private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide(
  'sportlink.club_schedule_next_7_days','primary'))::text not like '%foreign private team%',
  'source and foreign tenant data never enter the primary payload');
select ok(pg_temp.s206_equal(jsonb_populate_record(pg_temp.s206_slide('sportlink.club_schedule_next_7_days','foreign'),
  '{"tenant_id":"10000000-0000-4000-8000-000000002061"}')),'foreign-source/own-tenant mismatch remains byte-equal');
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s128_birthdays(
  jsonb_populate_record(pg_temp.s206_slide('sportlink.club_schedule_next_7_days','foreign'),
    '{"tenant_id":"10000000-0000-4000-8000-000000002061"}'))#>'{sport,items}'),0,'cross-tenant source cannot reveal matches');

-- Canonical theme selection, timezone, legacy mode and invalid selection.
select ok(pg_temp.s206_equal(pg_temp.s206_slide('sportlink.club_schedule_next_7_days','primary',
  jsonb_build_object('editorial',jsonb_build_object('theme',jsonb_build_object('mode',mode))))),
  'legacy mode '||mode||' keeps byte-identical canonical theme') from (values('light'),('dark')) modes(mode);
create function pg_temp.s206_selection(p_mode jsonb,p_id text default 'fieldflow') returns jsonb language sql immutable as $$
  select jsonb_build_object('ref',jsonb_build_object('catalog','v2','id',p_id,'version','1.0.0'),
    'modePolicy',p_mode,'accent',null,'support',null,'categoryOverrides','[]'::jsonb)
$$;
select ok(pg_temp.s206_equal(pg_temp.s206_slide('sportlink.pool_standings','primary',jsonb_build_object('editorial',
  jsonb_build_object('themeSelection',pg_temp.s206_selection(policy))))),'canonical policy '||label||' bytes match')
from (values('fixed dark','{"kind":"fixed","mode":"dark"}'::jsonb),
  ('schedule override','{"kind":"schedule","timezone":"America/New_York","fallback":"light","entries":[{"days":[1,2,3,4,5,6,7],"start":"00:00","end":"23:59","mode":"dark"}]}'::jsonb),
  ('auto','{"kind":"auto","fallback":"light"}'::jsonb)) policies(label,policy);
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide('sportlink.pool_standings','primary',
  jsonb_build_object('editorial',jsonb_build_object('themeSelection',pg_temp.s206_selection('{"kind":"fixed","mode":"dark"}')))))
  #>>'{themePresentation,resolvedMode,timezone}','Pacific/Auckland','canonical tenant timezone is observed');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide('sportlink.pool_standings','primary',
  jsonb_build_object('editorial',jsonb_build_object('themeSelection',pg_temp.s206_selection(
    '{"kind":"schedule","timezone":"America/New_York","fallback":"light","entries":[]}'::jsonb)))))
  #>>'{themePresentation,resolvedMode,timezone}','America/New_York','canonical schedule timezone override is observed');
select throws_ok($$select pg_temp.s206_original_wrapper(pg_temp.s206_slide('sportlink.pool_standings','primary',
  '{"editorial":{"themeSelection":{"ref":{"catalog":"v2","id":"invalid","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"}}}}'))$$,
  '23514','theme selection is invalid','original wrapper rejects invalid theme');
select throws_ok($$select private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_slide('sportlink.pool_standings','primary',
  '{"editorial":{"themeSelection":{"ref":{"catalog":"v2","id":"invalid","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"}}}}'))$$,
  '23514','theme selection is invalid','new wrapper retains the same invalid-theme SQLSTATE and message');
-- Brand precedence is deliberately exercised independently of mere parity:
-- Studio -> source club -> tenant club -> selected standing team -> provider.
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,
  storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '10000000-0000-4000-8000-000000002061','image','S206 fixture '||n,'logo.webp','image/webp','ready',
  'tenant-media','tenants/10000000-0000-4000-8000-000000002061/assets/30000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/original/logo.webp',
  100,repeat('a',64),100,100,now()
from generate_series(2061,2064) n;
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name,logo_media_asset_id,last_synced_at)
select s.tenant_id,s.connection_id,'club',s.name||' club',
  case s.name when 'primary' then '30000000-0000-4000-8000-000000002062'::uuid
    when 'secondary' then '30000000-0000-4000-8000-000000002063'::uuid end,
  now()+case when s.name='secondary' then interval '1 hour' else interval '0 hours' end
from s206_sources s;
insert into public.studio_tenant_brand_kits(tenant_id,primary_color,secondary_color,logo_media_asset_id)
values('10000000-0000-4000-8000-000000002061','#315CFF','#111111','30000000-0000-4000-8000-000000002061');
update public.sports_standings set rows_json=jsonb_set(rows_json,'{0,logoMediaAssetId}',
  '"30000000-0000-4000-8000-000000002064"')
where tenant_id='10000000-0000-4000-8000-000000002061' and source_connection_id=(select connection_id from s206_sources where name='primary');
create function pg_temp.s206_logo_slide() returns public.dynamic_slides language sql stable as $$
  select pg_temp.s206_slide('sportlink.pool_standings','primary',
    '{"sportTeamExternalId":"senior","sportCompetitionExternalId":"cup","sportSeason":"2026"}')
$$;
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'Studio brand precedence keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  '30000000-0000-4000-8000-000000002061','Studio logo is authoritative');
delete from public.studio_tenant_brand_kits where tenant_id='10000000-0000-4000-8000-000000002061';
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'source-specific club logo fallback keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  '30000000-0000-4000-8000-000000002062','source club wins over newer other-source club');
update public.sports_clubs set logo_media_asset_id=null where source_connection_id=(select connection_id from s206_sources where name='primary');
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'tenant-wide club logo fallback keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  '30000000-0000-4000-8000-000000002063','same tenant latest active club is the next fallback');
update public.sports_clubs set logo_media_asset_id=null where tenant_id='10000000-0000-4000-8000-000000002061';
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'selected standing team fallback keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  '30000000-0000-4000-8000-000000002064','selected legacy standing item is the next fallback');
update public.sports_standings set rows_json=rows_json#-'{0,logoMediaAssetId}'
where tenant_id='10000000-0000-4000-8000-000000002061';
insert into public.provider_asset_cache(id,provider,entity_type,external_entity_id,asset_role)
values('40000000-0000-4000-8000-000000002061','sportlink','club','s206-fixture-club','club_logo');
insert into public.provider_asset_versions(id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,file_size_bytes,width,height)
values('50000000-0000-4000-8000-000000002061','40000000-0000-4000-8000-000000002061',repeat('b',64),
  'provider-assets','providers/sportlink/club_logo/'||repeat('b',64)||'.webp','image/webp',100,100,100);
update public.provider_asset_cache set current_version_id='50000000-0000-4000-8000-000000002061'
where id='40000000-0000-4000-8000-000000002061';
update public.sports_clubs set logo_provider_asset_version_id='50000000-0000-4000-8000-000000002061'
where source_connection_id=(select connection_id from s206_sources where name='primary');
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'provider-version logo fallback keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  '50000000-0000-4000-8000-000000002061','canonical immutable provider version is the final fallback');
update public.sports_clubs set active=false where tenant_id='10000000-0000-4000-8000-000000002061';
select ok(pg_temp.s206_equal(pg_temp.s206_logo_slide()),'no active club or selected logo keeps identical bytes');
select is(private.build_dynamic_snapshot_data_before_s128_birthdays(pg_temp.s206_logo_slide())#>>'{brand,logoMediaAssetId}',
  null::text,'inactive clubs never supply a logo');

-- The downstream S128 birthday wrapper still discards its old theme field;
-- copy its native body and redirect only the canonical S122 input for parity.
do $$
declare definition text;
begin
  definition:=pg_catalog.pg_get_functiondef('private.build_dynamic_snapshot_data_before_s129_home_arrivals(public.dynamic_slides)'::regprocedure);
  definition:=replace(definition,'FUNCTION private.build_dynamic_snapshot_data_before_s129_home_arrivals(',
    'FUNCTION pg_temp.s206_original_birthdays(');
  definition:=replace(definition,'private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide)',
    'pg_temp.s206_original_wrapper(p_slide)');
  execute definition;
end;
$$;
update public.sportlink_connections set privacy_birthdays_enabled=true
where id=(select connection_id from s206_sources where name='primary');
insert into public.sportlink_birthdays(tenant_id,connection_id,external_id,display_name,normalized_name,birth_month,birth_day,next_occurrence,source_fetched_at,team_assignments)
select s.tenant_id,s.connection_id,repeat('c',40),'Native birthday fixture','native birthday fixture',
  extract(month from current_date+1)::integer,extract(day from current_date+1)::integer,current_date+1,now(),
  '[{"externalId":"senior","name":"Senioren 1"}]'
from s206_sources s where s.name='primary';
select is(pg_temp.s206_original_birthdays(pg_temp.s206_slide('sportlink.birthdays'))::text,
  private.build_dynamic_snapshot_data_before_s129_home_arrivals(pg_temp.s206_slide('sportlink.birthdays'))::text,
  'non-empty downstream birthday payload is byte-identical in one statement');
select is(jsonb_array_length(private.build_dynamic_snapshot_data_before_s129_home_arrivals(
  pg_temp.s206_slide('sportlink.birthdays'))#>'{sport,birthdays}'),1,'birthday comparison is genuinely non-empty');
select ok(not (private.build_dynamic_snapshot_data_before_s129_home_arrivals(
  pg_temp.s206_slide('sportlink.birthdays'))?'themePresentation'),'historical S128 presentation shape remains untouched');
update public.sportlink_birthdays set active=false where tenant_id='10000000-0000-4000-8000-000000002061';
select is(pg_temp.s206_original_birthdays(pg_temp.s206_slide('sportlink.birthdays'))::text,
  private.build_dynamic_snapshot_data_before_s129_home_arrivals(pg_temp.s206_slide('sportlink.birthdays'))::text,
  'empty downstream birthday payload is also byte-identical');

-- Instrument only temporary copies of the exact bodies. Native content still
-- comes from the real unchanged legacy projector; counters are not timings.
create temporary table s206_calls(n integer not null);
insert into s206_calls values(0);
create function pg_temp.s206_count_legacy(p_slide public.dynamic_slides)
returns jsonb language plpgsql volatile set search_path='' as $$
begin
  update pg_temp.s206_calls set n=n+1;
  return private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide);
end;
$$;
do $$
declare definition text;
begin
  definition:=pg_catalog.pg_get_functiondef('pg_temp.s206_original_typed(public.dynamic_slides)'::regprocedure);
  definition:=replace(definition,'FUNCTION pg_temp.s206_original_typed(', 'FUNCTION pg_temp.s206_count_old_typed(');
  -- pg_get_functiondef qualifies the temporary schema by its real name.
  definition:=replace(definition,'FUNCTION '||pg_catalog.quote_ident(pg_catalog.pg_my_temp_schema()::regnamespace::text)||'.s206_original_typed(',
    'FUNCTION pg_temp.s206_count_old_typed(');
  definition:=replace(definition,'private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide)',
    'pg_temp.s206_count_legacy(p_slide)');
  execute definition;
  definition:=pg_catalog.pg_get_functiondef('private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)'::regprocedure);
  definition:=replace(definition,'FUNCTION private.build_dynamic_snapshot_data_before_s122_theme_restore(', 'FUNCTION pg_temp.s206_count_new_typed(');
  definition:=replace(definition,'private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide)',
    'pg_temp.s206_count_legacy(p_slide)');
  execute definition;
  definition:=pg_catalog.pg_get_functiondef('private.build_dynamic_snapshot_data_before_s128_birthdays(public.dynamic_slides)'::regprocedure);
  definition:=replace(definition,'FUNCTION private.build_dynamic_snapshot_data_before_s128_birthdays(', 'FUNCTION pg_temp.s206_count_old_wrapper(');
  definition:=replace(definition,'private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide)', 'pg_temp.s206_count_old_typed(p_slide)');
  definition:=replace(definition,'private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide)', 'pg_temp.s206_count_legacy(p_slide)');
  execute definition;
  definition:=replace(definition,'FUNCTION pg_temp.s206_count_old_wrapper(', 'FUNCTION pg_temp.s206_count_new_wrapper(');
  definition:=replace(definition,'pg_temp.s206_count_old_typed(p_slide)', 'pg_temp.s206_count_new_typed(p_slide)');
  execute definition;
end;
$$;
create function pg_temp.s206_call_count(p_slide public.dynamic_slides,p_original boolean)
returns integer language plpgsql volatile set search_path='' as $$
declare result integer;
begin
  update pg_temp.s206_calls set n=0;
  if p_original then perform pg_temp.s206_count_old_wrapper(p_slide);
  else perform pg_temp.s206_count_new_wrapper(p_slide); end if;
  select n into result from pg_temp.s206_calls;
  return result;
end;
$$;
select is(pg_temp.s206_call_count(pg_temp.s206_slide('sportlink.club_schedule_next_7_days'),true),2,
  'old non-empty typed wrapper executes the full legacy content projector twice');
select is(pg_temp.s206_call_count(pg_temp.s206_slide('sportlink.club_schedule_next_7_days'),false),1,
  'new non-empty typed wrapper executes the full legacy content projector once');
select is(pg_temp.s206_call_count(pg_temp.s206_slide(null),true),1,'old null blueprint delegates once');
select is(pg_temp.s206_call_count(pg_temp.s206_slide(null),false),1,'new null blueprint still delegates once');
select is(pg_temp.s206_call_count(pg_temp.s206_slide('sportlink.pool_standings','primary',
  '{"context":{"providerTeamId":"missing","competitionSelectionMode":"auto_current"}}'),false),1,
  'unresolved early return still receives exactly the canonical legacy presentation');

select * from finish();
rollback;
