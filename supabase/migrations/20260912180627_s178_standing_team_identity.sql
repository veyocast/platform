-- Resolve the selected team's exact row identity once per standing selection.
-- Legacy mapper IDs are sha256(UTF8('standing-team') || NUL || UTF8(name)).
-- A duplicate active name disables only that fallback; real provider IDs win.
create function private.resolve_sportlink_standing_team_identity_v1(
  p_tenant_id uuid, p_connection_id uuid, p_team_id text
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'providerTeamId', team.external_id,
    'teamName', team.name,
    'syntheticId', case when not exists (
      select 1 from public.sports_teams other
      where other.tenant_id = team.tenant_id
        and other.source_connection_id = team.source_connection_id
        and other.active and other.name = team.name and other.id <> team.id
    ) then pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to('standing-team', 'UTF8') || pg_catalog.decode('00','hex') ||
      pg_catalog.convert_to(team.name, 'UTF8'), 'sha256'), 'hex') end
  )
  from public.sports_teams team
  where team.tenant_id = p_tenant_id and team.source_connection_id = p_connection_id
    and team.external_id = p_team_id and team.active
$$;
create function private.sportlink_standing_row_matches_team_v1(p_row jsonb, p_identity jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(p_row ->> 'externalId' = p_identity ->> 'providerTeamId'
    or (p_row ->> 'externalId' = p_identity ->> 'syntheticId'
      and p_row ->> 'teamName' = p_identity ->> 'teamName'), false)
$$;
revoke all on function private.resolve_sportlink_standing_team_identity_v1(uuid,uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function private.sportlink_standing_row_matches_team_v1(jsonb,jsonb)
  from public,anon,authenticated,service_role;

-- Resolve tenant/source/active-team membership once, rather than querying
-- those tables for every candidate match in each historical projection layer.
-- The transient JSON is a query result, never a persisted relationship model.
create function private.resolve_sportlink_match_selection_v1(
  p_tenant_id uuid, p_data_source_id uuid, p_selection jsonb
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare resolved_sources jsonb; location text := coalesce(p_selection ->> 'matchLocation','both');
begin
  if pg_catalog.jsonb_typeof(p_selection) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_selection -> 'mode') is distinct from 'string'
    or p_selection ->> 'mode' not in ('all','selected')
    or pg_catalog.jsonb_typeof(p_selection -> 'teamContexts') is distinct from 'array'
    or (p_selection ? 'matchLocation' and pg_catalog.jsonb_typeof(p_selection -> 'matchLocation') is distinct from 'string')
    or location not in ('both','home','away') then return null; end if;

  with team_contexts as (
    select team.source_connection_id, team.external_id,
      coalesce((select pg_catalog.jsonb_agg(context)
        from pg_catalog.jsonb_array_elements(p_selection -> 'teamContexts') context
        where context ->> 'providerTeamId' = team.external_id),'[]'::jsonb) as contexts
    from public.sports_teams team
    join public.sportlink_connections connection
      on connection.tenant_id = team.tenant_id and connection.id = team.source_connection_id
      and connection.data_source_id = p_data_source_id
    where team.tenant_id = p_tenant_id and team.active
  ), source_teams as (
    select source_connection_id,
      pg_catalog.jsonb_object_agg(external_id, pg_catalog.jsonb_build_object(
        'allCompetitions', case when p_selection ->> 'mode' = 'all' then contexts = '[]'::jsonb
          else exists (select 1 from pg_catalog.jsonb_array_elements(contexts) c
            where c ->> 'competitionSelectionMode' = 'auto_current') end,
        'contexts', contexts)) as teams
    from team_contexts
    where p_selection ->> 'mode' = 'all' or contexts <> '[]'::jsonb
    group by source_connection_id
  )
  select pg_catalog.jsonb_object_agg(source_connection_id::text, teams)
  into resolved_sources from source_teams;
  return pg_catalog.jsonb_build_object('tenantId',p_tenant_id,'matchLocation',location,
    'sources',coalesce(resolved_sources,'{}'::jsonb));
end;
$$;

create function private.sportlink_match_matches_resolved_selection_v1(
  p_match public.sports_matches, p_selection jsonb
) returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  team_id text; team_selection jsonb; context jsonb;
  location text := p_selection ->> 'matchLocation';
  competition_id text := private.sportlink_competition_identity_v1(p_match.competition,p_match.pool);
begin
  if p_selection is null or p_match.tenant_id::text is distinct from p_selection ->> 'tenantId'
    or location is null or location not in ('both','home','away') then return false; end if;
  foreach team_id in array case location
    when 'home' then array[p_match.home_team ->> 'externalId']
    when 'away' then array[p_match.away_team ->> 'externalId']
    else array[p_match.home_team ->> 'externalId',p_match.away_team ->> 'externalId'] end
  loop
    if team_id is null then continue; end if;
    team_selection := p_selection #> array['sources',p_match.source_connection_id::text,team_id];
    if team_selection is null then continue; end if;
    if team_selection -> 'allCompetitions' = 'true'::jsonb then return true; end if;
    for context in select value from pg_catalog.jsonb_array_elements(team_selection -> 'contexts')
    loop
      if competition_id is not distinct from context ->> 'competitionId'
        and (context ->> 'phaseId' is null or p_match.competition ->> 'period' = context ->> 'phaseId')
        and (context ->> 'poolId' is null or context ->> 'poolId' in
          (p_match.pool ->> 'externalId',p_match.pool ->> 'poolExternalId'))
        and (context ->> 'seasonId' is null or p_match.competition ->> 'season' = context ->> 'seasonId')
      then return true; end if;
    end loop;
  end loop;
  return false;
end;
$$;
revoke all on function private.resolve_sportlink_match_selection_v1(uuid,uuid,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.sportlink_match_matches_resolved_selection_v1(public.sports_matches,jsonb)
  from public,anon,authenticated,service_role;

create or replace function private.resolve_sportlink_pool_context_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_context jsonb,
  p_blueprint text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_count integer := 0;
  competition_options jsonb;
  standing_team_identity jsonb;
  resolved jsonb;
  resolved_source_connection_id uuid;
  source_timezone text;
  team_external_id text := p_context ->> 'providerTeamId';
begin
  if pg_catalog.jsonb_typeof(p_context) is distinct from 'object'
    or p_blueprint not in (
      'sportlink.pool_standings',
      'sportlink.pool_schedule_today',
      'sportlink.pool_schedule_next_7_days',
      'sportlink.pool_results_today',
      'sportlink.pool_results_previous_7_days'
    )
  then
    return null;
  end if;

  select
    team.source_connection_id,
    coalesce(connection.timezone, 'Europe/Amsterdam'),
    case
      when pg_catalog.jsonb_typeof(
        team.metadata -> 'competitionOptions'
      ) = 'array'
        then team.metadata -> 'competitionOptions'
      else '[]'::jsonb
    end
  into resolved_source_connection_id, source_timezone, competition_options
  from public.sports_teams team
  join public.sportlink_connections connection
    on connection.tenant_id = team.tenant_id
   and connection.id = team.source_connection_id
   and connection.data_source_id = p_data_source_id
  where team.tenant_id = p_tenant_id
    and team.external_id = team_external_id
    and team.active
  order by team.last_synced_at desc, team.id
  limit 1;

  if resolved_source_connection_id is null then
    return null;
  end if;

  standing_team_identity := private.resolve_sportlink_standing_team_identity_v1(
    p_tenant_id, resolved_source_connection_id, team_external_id);

  if p_context ->> 'competitionSelectionMode' = 'pinned' then
    if nullif(pg_catalog.btrim(p_context ->> 'competitionId'), '') is null
      or nullif(pg_catalog.btrim(p_context ->> 'poolId'), '') is null
    then
      return null;
    end if;
    with matching_options as (
      select distinct
        option_record ->> 'externalId' as competition_id,
        nullif(option_record ->> 'period', '') as phase_id,
        option_record ->> 'poolExternalId' as pool_id,
        nullif(option_record ->> 'season', '') as season_id
      from pg_catalog.jsonb_array_elements(competition_options) option_record
      where option_record ->> 'externalId' = p_context ->> 'competitionId'
        and option_record ->> 'poolExternalId' = p_context ->> 'poolId'
        and (
          nullif(p_context ->> 'phaseId', '') is null
          or option_record ->> 'period' = p_context ->> 'phaseId'
        )
        and (
          nullif(p_context ->> 'seasonId', '') is null
          or option_record ->> 'season' = p_context ->> 'seasonId'
        )
    )
    select
      count(*)::integer,
      case when count(*) = 1 then pg_catalog.jsonb_build_object(
        'competitionId', min(matching_options.competition_id),
        'phaseId', min(matching_options.phase_id),
        'poolId', min(matching_options.pool_id),
        'seasonId', min(matching_options.season_id),
        'sourceConnectionId', resolved_source_connection_id,
        'timezone', source_timezone
      ) end
    into candidate_count, resolved
    from matching_options;
    return resolved;
  end if;

  if p_context ->> 'competitionSelectionMode' <> 'auto_current'
    or p_context -> 'competitionId' <> 'null'::jsonb
    or p_context -> 'phaseId' <> 'null'::jsonb
    or p_context -> 'poolId' <> 'null'::jsonb
    or p_context -> 'seasonId' <> 'null'::jsonb
  then
    return null;
  end if;

  with options as (
    select distinct
      option_record ->> 'externalId' as competition_id,
      nullif(option_record ->> 'period', '') as phase_id,
      option_record ->> 'poolExternalId' as pool_id,
      nullif(option_record ->> 'season', '') as season_id
    from pg_catalog.jsonb_array_elements(competition_options) option_record
    where nullif(pg_catalog.btrim(option_record ->> 'externalId'), '')
        is not null
      and nullif(pg_catalog.btrim(option_record ->> 'poolExternalId'), '')
        is not null
  ), fixture_evidence as (
    select
      options.*,
      fixture.external_id,
      fixture.starts_at,
      (fixture.starts_at at time zone source_timezone)::date as evidence_day,
      case
        when p_blueprint = 'sportlink.pool_standings' then case
          when (fixture.starts_at at time zone source_timezone)::date =
            (now() at time zone source_timezone)::date then 0
          when fixture.starts_at <= now() then 1 else 2 end
        when (
          p_blueprint like '%today'
          and (
            fixture.starts_at at time zone source_timezone
          )::date = (now() at time zone source_timezone)::date
        ) or (
          p_blueprint like '%next_7_days'
          and (fixture.starts_at at time zone source_timezone)::date >=
            (now() at time zone source_timezone)::date
          and (fixture.starts_at at time zone source_timezone)::date <
            (now() at time zone source_timezone)::date + 7
        ) or (
          p_blueprint like '%previous_7_days'
          and (fixture.starts_at at time zone source_timezone)::date >=
            (now() at time zone source_timezone)::date - 7
          and (fixture.starts_at at time zone source_timezone)::date <
            (now() at time zone source_timezone)::date
        ) then 0
        else 1
      end as evidence_priority
    from options
    join public.sports_matches fixture
      on fixture.tenant_id = p_tenant_id
     and fixture.source_connection_id = resolved_source_connection_id
     and fixture.active
     and private.sportlink_competition_identity_v1(fixture.competition, fixture.pool) = options.competition_id
     and coalesce(
       fixture.pool ->> 'externalId',
       fixture.pool ->> 'poolExternalId'
     ) = options.pool_id
     and (options.phase_id is null
       or fixture.competition ->> 'period' = options.phase_id)
     and (options.season_id is null
       or fixture.competition ->> 'season' = options.season_id)
     and team_external_id in (
       fixture.home_team ->> 'externalId',
       fixture.away_team ->> 'externalId'
     )
    where case
      when p_blueprint = 'sportlink.pool_standings' then
        fixture.status in ('scheduled','postponed','in_progress','finished')
        and fixture.starts_at between now() - interval '14 days' and now() + interval '42 days'
      when p_blueprint like '%results%'
        then private.sportlink_match_phase_v1(fixture.status, fixture.starts_at) = 'results'
          and (fixture.starts_at at time zone source_timezone)::date >=
            (now() at time zone source_timezone)::date - 14
          and (fixture.starts_at at time zone source_timezone)::date <=
            (now() at time zone source_timezone)::date
      else fixture.status in ('scheduled', 'postponed')
        and (fixture.starts_at at time zone source_timezone)::date >=
          (now() at time zone source_timezone)::date
        and (fixture.starts_at at time zone source_timezone)::date <
          (now() at time zone source_timezone)::date + 42
      end
  ), winning_priority as (
    select min(evidence.evidence_priority) as evidence_priority
    from fixture_evidence evidence
  ), candidate_contexts as (
    select distinct
      evidence.competition_id,
      evidence.phase_id,
      evidence.pool_id,
      evidence.season_id
    from fixture_evidence evidence
    where evidence.evidence_priority = (
      select priority.evidence_priority from winning_priority priority
    )
    and (p_blueprint <> 'sportlink.pool_standings' or evidence.evidence_day = (
      select case when evidence.evidence_priority = 1 then max(other.evidence_day)
        else min(other.evidence_day) end
      from fixture_evidence other where other.evidence_priority = evidence.evidence_priority
    ))
  )
  select
    count(*)::integer,
    case when count(*) = 1 then pg_catalog.jsonb_build_object(
      'competitionId', min(candidate.competition_id),
      'phaseId', min(candidate.phase_id),
      'poolId', min(candidate.pool_id),
      'seasonId', min(candidate.season_id),
      'sourceConnectionId', resolved_source_connection_id,
      'timezone', source_timezone
    ) end
  into candidate_count, resolved
  from candidate_contexts candidate;

  if candidate_count > 0 then
    return resolved;
  end if;

  with options as (
    select distinct
      option_record ->> 'externalId' as competition_id,
      nullif(option_record ->> 'period', '') as phase_id,
      option_record ->> 'poolExternalId' as pool_id,
      nullif(option_record ->> 'season', '') as season_id
    from pg_catalog.jsonb_array_elements(competition_options) option_record
    where nullif(pg_catalog.btrim(option_record ->> 'externalId'), '')
        is not null
      and nullif(pg_catalog.btrim(option_record ->> 'poolExternalId'), '')
        is not null
  ), standing_evidence as (
    select options.*
    from options
    join public.sports_standings standing
      on standing.tenant_id = p_tenant_id
     and standing.source_connection_id = resolved_source_connection_id
     and standing.active
     and coalesce(
       standing.metadata #>> '{pool,externalId}',
       standing.metadata #>> '{pool,poolExternalId}',
       standing.pool_external_id
     ) = options.pool_id
     and (
       standing.metadata #>> '{competition,externalId}' is null
       or standing.metadata #>> '{competition,externalId}' =
         options.competition_id
     )
     and (options.phase_id is null or standing.metadata #>> '{competition,period}' = options.phase_id)
     and (options.season_id is null or standing.season_key = options.season_id)
    where exists (
      select 1
      from pg_catalog.jsonb_array_elements(standing.rows_json) standing_row
      where private.sportlink_standing_row_matches_team_v1(standing_row, standing_team_identity)
    )
  ), candidate_contexts as (
    select distinct
      evidence.competition_id,
      evidence.phase_id,
      evidence.pool_id,
      evidence.season_id
    from standing_evidence evidence
  )
  select
    count(*)::integer,
    case when count(*) = 1 then pg_catalog.jsonb_build_object(
      'competitionId', min(candidate.competition_id),
      'phaseId', min(candidate.phase_id),
      'poolId', min(candidate.pool_id),
      'seasonId', min(candidate.season_id),
      'sourceConnectionId', resolved_source_connection_id,
      'timezone', source_timezone
    ) end
  into candidate_count, resolved
  from candidate_contexts candidate;

  if candidate_count > 0 then
    return resolved;
  end if;

  with options as (
    select distinct
      option_record ->> 'externalId' as competition_id,
      nullif(option_record ->> 'period', '') as phase_id,
      option_record ->> 'poolExternalId' as pool_id,
      nullif(option_record ->> 'season', '') as season_id
    from pg_catalog.jsonb_array_elements(competition_options) option_record
    where nullif(pg_catalog.btrim(option_record ->> 'externalId'), '')
        is not null
      and nullif(pg_catalog.btrim(option_record ->> 'poolExternalId'), '')
        is not null
  )
  select case when count(*) = 1 then pg_catalog.jsonb_build_object(
    'competitionId', min(options.competition_id),
    'phaseId', min(options.phase_id),
    'poolId', min(options.pool_id),
    'seasonId', min(options.season_id),
    'sourceConnectionId', resolved_source_connection_id,
    'timezone', source_timezone
  ) end
  into resolved
  from options;
  return resolved;
end;
$$;

create or replace function private.build_dynamic_snapshot_data_before_s122_theme_restore(
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

create or replace function private.build_dynamic_snapshot_data_before_s154_club_match_scope(
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
  display_config jsonb;
  result jsonb;
  selected_items jsonb;
  resolved_team_selection jsonb;
  selected_team_count integer;
  team_selection jsonb := p_slide.configuration_json -> 'teamSelection';
begin
  result := private.build_dynamic_snapshot_data_before_s153_club_refill(
    p_slide
  );
  if blueprint not in (
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days'
  ) or pg_catalog.jsonb_typeof(team_selection) is distinct from 'object'
  then
    return result;
  end if;

  display_config := jsonb_build_object(
    'columns', case p_slide.configuration_json #>> '{display,columns}'
      when 'two' then 'two' else 'one' end,
    'showDressingRoom', coalesce(
      (p_slide.configuration_json #>> '{display,showDressingRoom}')::boolean,
      false
    ),
    'showField', coalesce(
      (p_slide.configuration_json #>> '{display,showField}')::boolean,
      true
    ),
    'showHomeAway', coalesce(
      (p_slide.configuration_json #>> '{display,showHomeAway}')::boolean,
      true
    ),
    'showLogo', coalesce(
      (p_slide.configuration_json #>> '{display,showLogo}')::boolean,
      true
    ),
    'showReferee', coalesce(
      (p_slide.configuration_json #>> '{display,showReferee}')::boolean,
      false
    )
  );

  resolved_team_selection := private.resolve_sportlink_match_selection_v1(
    p_slide.tenant_id, p_slide.data_source_id, team_selection);

  with eligible_matches as (
    select fixture.*, connection.timezone
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.tenant_id = fixture.tenant_id
     and connection.id = fixture.source_connection_id
     and connection.data_source_id = p_slide.data_source_id
    where fixture.tenant_id = p_slide.tenant_id
      and fixture.active
      and case when blueprint like '%results%'
        then fixture.status = 'finished' and fixture.scores_published
        else fixture.status in ('scheduled', 'postponed')
      end
      and case
        when blueprint like '%today'
          then (fixture.starts_at at time zone connection.timezone)::date =
            (now() at time zone connection.timezone)::date
        when blueprint like '%next_7_days'
          then (fixture.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date
            and (fixture.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date + 7
        else (fixture.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date - 7
          and (fixture.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date
      end
      and private.sportlink_match_matches_resolved_selection_v1(
          fixture, resolved_team_selection)
  ), bounded_matches as (
    select eligible.*
    from eligible_matches eligible
    order by
      case when blueprint like '%results%' then eligible.starts_at end desc,
      case when blueprint not like '%results%' then eligible.starts_at end,
      eligible.external_id
    limit 100
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', fixture.external_id,
        'primary', (fixture.home_team ->> 'name') || ' – ' ||
          (fixture.away_team ->> 'name'),
        'secondary', to_char(
          fixture.starts_at at time zone fixture.timezone,
          'DD-MM-YYYY HH24:MI'
        ),
        'date', to_char(
          fixture.starts_at at time zone fixture.timezone,
          'DD-MM-YYYY'
        ),
        'time', to_char(
          fixture.starts_at at time zone fixture.timezone,
          'HH24:MI'
        ),
        'homeTeam', fixture.home_team ->> 'name',
        'awayTeam', fixture.away_team ->> 'name',
        'homeScore', case when fixture.home_team ->> 'score' ~ '^[0-9]+$'
          then (fixture.home_team ->> 'score')::integer end,
        'awayScore', case when fixture.away_team ->> 'score' ~ '^[0-9]+$'
          then (fixture.away_team ->> 'score')::integer end,
        'competition', fixture.competition ->> 'name',
        'venue', case when (display_config ->> 'showField')::boolean
          then coalesce(
            fixture.venue ->> 'field',
            fixture.venue ->> 'name',
            ''
          ) end,
        'meta', case when (display_config ->> 'showField')::boolean
          then coalesce(
            fixture.venue ->> 'field',
            fixture.venue ->> 'name',
            ''
          ) end,
        'status', fixture.status,
        'homeRoom', case
          when (display_config ->> 'showDressingRoom')::boolean
          then fixture.dressing_rooms ->> 'home' end,
        'awayRoom', case
          when (display_config ->> 'showDressingRoom')::boolean
          then fixture.dressing_rooms ->> 'away' end,
        'officials', case
          when (display_config ->> 'showReferee')::boolean
          then fixture.officials end,
        'homeMatch', case
          when (display_config ->> 'showHomeAway')::boolean
          then fixture.is_home_match end,
        'homeLogoMediaAssetId', case
          when not (display_config ->> 'showLogo')::boolean then null
          else coalesce(
            home_logo.current_version_id,
            case when home_club.id is not null
              and coalesce(result #>> '{brand,logoMediaAssetId}', '') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (result #>> '{brand,logoMediaAssetId}')::uuid end
          )
        end,
        'awayLogoMediaAssetId', case
          when not (display_config ->> 'showLogo')::boolean then null
          else coalesce(
            away_logo.current_version_id,
            case when away_club.id is not null
              and coalesce(result #>> '{brand,logoMediaAssetId}', '') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (result #>> '{brand,logoMediaAssetId}')::uuid end
          )
        end
      ))
      order by
        case when blueprint like '%results%' then fixture.starts_at end desc,
        case when blueprint not like '%results%' then fixture.starts_at end,
        fixture.external_id
    ),
    '[]'::jsonb
  )
  into selected_items
  from bounded_matches fixture
  left join public.provider_asset_cache home_logo
    on home_logo.provider = 'sportlink'
   and home_logo.entity_type = 'team'
   and home_logo.asset_role = 'team_logo'
   and home_logo.external_entity_id =
     fixture.home_team ->> 'externalId'
   and home_logo.current_version_id is not null
  left join public.provider_asset_cache away_logo
    on away_logo.provider = 'sportlink'
   and away_logo.entity_type = 'team'
   and away_logo.asset_role = 'team_logo'
   and away_logo.external_entity_id =
     fixture.away_team ->> 'externalId'
   and away_logo.current_version_id is not null
  left join public.sports_teams home_club
    on home_club.tenant_id = fixture.tenant_id
   and home_club.source_connection_id = fixture.source_connection_id
   and home_club.external_id = fixture.home_team ->> 'externalId'
   and home_club.active
  left join public.sports_teams away_club
    on away_club.tenant_id = fixture.tenant_id
   and away_club.source_connection_id = fixture.source_connection_id
   and away_club.external_id = fixture.away_team ->> 'externalId'
   and away_club.active;

  if team_selection ->> 'mode' = 'all' then
    select count(distinct team.external_id)::integer
    into selected_team_count
    from public.sports_teams team
    join public.sportlink_connections connection
      on connection.tenant_id = team.tenant_id
     and connection.id = team.source_connection_id
     and connection.data_source_id = p_slide.data_source_id
    where team.tenant_id = p_slide.tenant_id
      and team.active;
  else
    selected_team_count := jsonb_array_length(
      team_selection -> 'teamContexts'
    );
  end if;

  result := jsonb_set(result, '{sport,items}', selected_items, true);
  result := jsonb_set(
    result,
    '{sport,emptyStateCode}',
    case when jsonb_array_length(selected_items) = 0
      then to_jsonb(case when blueprint like '%results%'
        then 'RESULTS_NOT_PUBLISHED' else 'NO_ITEMS_IN_PERIOD' end)
      else 'null'::jsonb
    end,
    true
  );
  result := jsonb_set(
    result,
    '{sport,selectedTeamCount}',
    to_jsonb(coalesce(selected_team_count, 0)),
    true
  );
  result := jsonb_set(
    result,
    '{sport,teamSelectionMode}',
    to_jsonb(team_selection ->> 'mode'),
    true
  );
  return jsonb_set(
    result,
    '{sport,displayConfig}',
    display_config,
    true
  );
end;
$$;

create or replace function private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(
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
  display_config jsonb;
  is_club boolean;
  legacy_show_dressing_room boolean;
  legacy_show_logo boolean;
  resolved_pool_context jsonb;
  result jsonb;
  selected_items jsonb;
  resolved_team_selection jsonb;
  show_away_dressing_room boolean;
  show_away_logo boolean;
  show_home_dressing_room boolean;
  show_home_logo boolean;
  team_selection jsonb := p_slide.configuration_json -> 'teamSelection';
begin
  result := private.build_dynamic_snapshot_data_before_s158_match_row_layout(
    p_slide
  );
  if blueprint is null or blueprint not in (
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days',
    'sportlink.pool_schedule_today',
    'sportlink.pool_schedule_next_7_days',
    'sportlink.pool_results_today',
    'sportlink.pool_results_previous_7_days'
  ) then
    return result;
  end if;

  is_club := blueprint like 'sportlink.club_%';
  if is_club then
    if pg_catalog.jsonb_typeof(team_selection) is distinct from 'object' then
      team_selection := pg_catalog.jsonb_build_object(
        'matchLocation', 'both',
        'mode', 'all',
        'teamContexts', '[]'::jsonb
      );
    elsif not private.sportlink_team_selection_is_valid_v1(
      p_slide.tenant_id,
      p_slide.data_source_id,
      team_selection
    ) then
      team_selection := pg_catalog.jsonb_build_object(
        'matchLocation', 'both',
        'mode', 'selected',
        'teamContexts', '[]'::jsonb
      );
    else
      team_selection := team_selection || pg_catalog.jsonb_build_object(
        'matchLocation', coalesce(
          team_selection ->> 'matchLocation',
          'both'
        )
      );
    end if;
  end if;
  legacy_show_dressing_room := coalesce(
    (p_slide.configuration_json #>> '{display,showDressingRoom}')::boolean,
    false
  );
  legacy_show_logo := coalesce(
    (p_slide.configuration_json #>> '{display,showLogo}')::boolean,
    true
  );
  show_away_dressing_room := coalesce(
    (p_slide.configuration_json #>> '{display,showAwayDressingRoom}')::boolean,
    legacy_show_dressing_room
  );
  show_away_logo := coalesce(
    (p_slide.configuration_json #>> '{display,showAwayLogo}')::boolean,
    legacy_show_logo
  );
  show_home_dressing_room := coalesce(
    (p_slide.configuration_json #>> '{display,showHomeDressingRoom}')::boolean,
    legacy_show_dressing_room
  );
  show_home_logo := coalesce(
    (p_slide.configuration_json #>> '{display,showHomeLogo}')::boolean,
    legacy_show_logo
  );
  display_config := pg_catalog.jsonb_build_object(
    'columns', case p_slide.configuration_json #>> '{display,columns}'
      when 'two' then 'two' else 'one' end,
    'showAwayDressingRoom', show_away_dressing_room,
    'showAwayLogo', show_away_logo,
    'showDate', coalesce(
      (p_slide.configuration_json #>> '{display,showDate}')::boolean,
      true
    ),
    'showDressingRoom', show_home_dressing_room or show_away_dressing_room,
    'showField', coalesce(
      (p_slide.configuration_json #>> '{display,showField}')::boolean,
      true
    ),
    'showHomeAway', coalesce(
      (p_slide.configuration_json #>> '{display,showHomeAway}')::boolean,
      true
    ),
    'showHomeDressingRoom', show_home_dressing_room,
    'showHomeLogo', show_home_logo,
    'showLogo', show_home_logo or show_away_logo,
    'showReferee', coalesce(
      (p_slide.configuration_json #>> '{display,showReferee}')::boolean,
      false
    ),
    'showSportpark', coalesce(
      (p_slide.configuration_json #>> '{display,showSportpark}')::boolean,
      true
    ),
    'showTime', coalesce(
      (p_slide.configuration_json #>> '{display,showTime}')::boolean,
      true
    )
  );

  if not is_club then
    resolved_pool_context := private.resolve_sportlink_pool_context_v1(
      p_slide.tenant_id,
      p_slide.data_source_id,
      p_slide.configuration_json -> 'context',
      blueprint
    );
  end if;

  resolved_team_selection := private.resolve_sportlink_match_selection_v1(
    p_slide.tenant_id, p_slide.data_source_id, team_selection);

  with eligible_matches as (
    select fixture.*, connection.timezone
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.tenant_id = fixture.tenant_id
     and connection.id = fixture.source_connection_id
     and connection.data_source_id = p_slide.data_source_id
    where fixture.tenant_id = p_slide.tenant_id
      and fixture.active
      and private.sportlink_match_phase_v1(fixture.status, fixture.starts_at) =
        case when blueprint like '%results%' then 'results' else 'program' end
      and case
        when blueprint like '%today'
          then (fixture.starts_at at time zone connection.timezone)::date =
            (now() at time zone connection.timezone)::date
        when blueprint like '%next_7_days'
          then (fixture.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date
            and (fixture.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date + 7
        else (fixture.starts_at at time zone connection.timezone)::date >=
              (now() at time zone connection.timezone)::date - 7
          and (fixture.starts_at at time zone connection.timezone)::date <
              (now() at time zone connection.timezone)::date
      end
      and case when is_club then
        private.sportlink_match_matches_resolved_selection_v1(
          fixture, resolved_team_selection)
      else resolved_pool_context is not null
        and fixture.source_connection_id =
          (resolved_pool_context ->> 'sourceConnectionId')::uuid
        and private.sportlink_competition_identity_v1(fixture.competition, fixture.pool) =
          resolved_pool_context ->> 'competitionId'
        and coalesce(
          fixture.pool ->> 'externalId',
          fixture.pool ->> 'poolExternalId'
        ) = resolved_pool_context ->> 'poolId'
        and (
          resolved_pool_context ->> 'phaseId' is null
          or fixture.competition ->> 'period' =
            resolved_pool_context ->> 'phaseId'
        )
        and (
          resolved_pool_context ->> 'seasonId' is null
          or fixture.competition ->> 'season' =
            resolved_pool_context ->> 'seasonId'
        )
      end
  ), bounded_matches as (
    select eligible.*
    from eligible_matches eligible
    order by
      case when blueprint like '%results%' then eligible.starts_at end desc,
      case when blueprint not like '%results%' then eligible.starts_at end,
      eligible.external_id
    limit case when is_club then 100 else 40 end
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'id', fixture.external_id,
        'kickoffAt', fixture.starts_at,
        'primary', coalesce(nullif(pg_catalog.btrim(home_team.name), ''),
          fixture.home_team ->> 'name', '') || ' – ' ||
          coalesce(nullif(pg_catalog.btrim(away_team.name), ''),
            fixture.away_team ->> 'name', ''),
        'secondary', pg_catalog.to_char(
          fixture.starts_at at time zone fixture.timezone,
          'DD-MM-YYYY HH24:MI'
        ),
        'date', pg_catalog.to_char(
          fixture.starts_at at time zone fixture.timezone,
          'DD-MM-YYYY'
        ),
        'time', pg_catalog.to_char(
          fixture.starts_at at time zone fixture.timezone,
          'HH24:MI'
        ),
        'homeTeam', coalesce(nullif(pg_catalog.btrim(home_team.name), ''),
          fixture.home_team ->> 'name', ''),
        'awayTeam', coalesce(nullif(pg_catalog.btrim(away_team.name), ''),
          fixture.away_team ->> 'name', ''),
        'homeScore', case
          when fixture.scores_published
            and fixture.home_team ->> 'score' ~ '^[0-9]+$'
          then (fixture.home_team ->> 'score')::integer
        end,
        'awayScore', case
          when fixture.scores_published
            and fixture.away_team ->> 'score' ~ '^[0-9]+$'
          then (fixture.away_team ->> 'score')::integer
        end,
        'competition', fixture.competition ->> 'name',
        'venue', case
          when (display_config ->> 'showField')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'field'), '')
          when (display_config ->> 'showSportpark')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'name'), '')
        end,
        'meta', case
          when (display_config ->> 'showField')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'field'), '')
          when (display_config ->> 'showSportpark')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'name'), '')
        end,
        'field', case
          when (display_config ->> 'showField')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'field'), '')
        end,
        'venueName', case
          when (display_config ->> 'showSportpark')::boolean
            then nullif(pg_catalog.btrim(fixture.venue ->> 'name'), '')
        end,
        'status', fixture.status,
        'homeRoom', case
          when (display_config ->> 'showHomeDressingRoom')::boolean
            then nullif(pg_catalog.btrim(fixture.dressing_rooms ->> 'home'), '')
        end,
        'awayRoom', case
          when (display_config ->> 'showAwayDressingRoom')::boolean
            then nullif(pg_catalog.btrim(fixture.dressing_rooms ->> 'away'), '')
        end,
        'officials', case
          when (display_config ->> 'showReferee')::boolean
            then fixture.officials
        end,
        'homeMatch', fixture.is_home_match,
        'homeLogoMediaAssetId', case
          when not (display_config ->> 'showHomeLogo')::boolean then null
          else coalesce(
            home_logo.current_version_id,
            case when home_team.id is not null
              and coalesce(result #>> '{brand,logoMediaAssetId}', '') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (result #>> '{brand,logoMediaAssetId}')::uuid end
          )
        end,
        'awayLogoMediaAssetId', case
          when not (display_config ->> 'showAwayLogo')::boolean then null
          else coalesce(
            away_logo.current_version_id,
            case when away_team.id is not null
              and coalesce(result #>> '{brand,logoMediaAssetId}', '') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (result #>> '{brand,logoMediaAssetId}')::uuid end
          )
        end
      ))
      order by
        case when blueprint like '%results%' then fixture.starts_at end desc,
        case when blueprint not like '%results%' then fixture.starts_at end,
        fixture.external_id
    ),
    '[]'::jsonb
  )
  into selected_items
  from bounded_matches fixture
  left join public.sports_teams home_team
    on home_team.tenant_id = fixture.tenant_id
   and home_team.source_connection_id = fixture.source_connection_id
   and home_team.external_id = fixture.home_team ->> 'externalId'
   and home_team.active
  left join public.sports_teams away_team
    on away_team.tenant_id = fixture.tenant_id
   and away_team.source_connection_id = fixture.source_connection_id
   and away_team.external_id = fixture.away_team ->> 'externalId'
   and away_team.active
  left join public.provider_asset_cache home_logo
    on home_logo.provider = 'sportlink'
   and home_logo.entity_type = 'team'
   and home_logo.asset_role = 'team_logo'
   and home_logo.external_entity_id = fixture.home_team ->> 'externalId'
   and home_logo.current_version_id is not null
  left join public.provider_asset_cache away_logo
    on away_logo.provider = 'sportlink'
   and away_logo.entity_type = 'team'
   and away_logo.asset_role = 'team_logo'
   and away_logo.external_entity_id = fixture.away_team ->> 'externalId'
   and away_logo.current_version_id is not null;

  result := pg_catalog.jsonb_set(
    result,
    '{sport,items}',
    selected_items,
    true
  );
  result := pg_catalog.jsonb_set(
    result,
    '{sport,displayConfig}',
    display_config,
    true
  );
  result := pg_catalog.jsonb_set(
    result,
    '{sport,emptyStateCode}',
    case when pg_catalog.jsonb_array_length(selected_items) = 0
      then pg_catalog.to_jsonb(case when not is_club and resolved_pool_context is null
        then 'COMPETITION_CONTEXT_UNRESOLVED' when blueprint like '%results%'
        then 'RESULTS_NOT_PUBLISHED' else 'NO_ITEMS_IN_PERIOD' end)
      else 'null'::jsonb
    end,
    true
  );
  if not is_club then
    result := pg_catalog.jsonb_set(
      result,
      '{sport,poolContext}',
      coalesce(resolved_pool_context, 'null'::jsonb),
      true
    );
  end if;
  return result;
end;
$$;

-- Existing function ACLs remain closed. Explicitly restate all changed boundaries.
revoke all on function private.resolve_sportlink_pool_context_v1(uuid,uuid,jsonb,text),
  private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides),
  private.build_dynamic_snapshot_data_before_s154_club_match_scope(public.dynamic_slides),
  private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(public.dynamic_slides)
  from public,anon,authenticated,service_role;

-- Refresh only immutable published latest-version successors; preserve open drafts.
do $$
declare source_record record;
begin
  for source_record in select distinct version.tenant_id,version.data_source_id
    from public.dynamic_slide_versions version join public.dynamic_slides slide
      on slide.tenant_id=version.tenant_id and slide.id=version.dynamic_slide_id
      and slide.current_published_version_id=version.id
    where slide.status <> 'archived' and version.status='published'
      and version.selection_mode='latest' and version.data_source_id is not null
      and version.configuration_json ->> 'blueprintKey' = 'sportlink.pool_standings'
  loop
    perform private.queue_match_row_snapshots_v1(source_record.tenant_id,source_record.data_source_id);
  end loop;
end;
$$;
update public.sportlink_sync_policies set next_sync_at=least(next_sync_at,now())
where enabled and dataset_group in ('matches','competitions');
