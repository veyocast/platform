begin;

-- Keep any stricter session limit and fail this replacement atomically if
-- its catalog lock or execution exceeds the existing migration budget.
do $$
begin
  if current_setting('lock_timeout')::interval = interval '0'
     or current_setting('lock_timeout')::interval > interval '1 second' then
    perform set_config('lock_timeout', '1s', true);
  end if;
  if current_setting('statement_timeout')::interval = interval '0'
     or current_setting('statement_timeout')::interval > interval '30 seconds' then
    perform set_config('statement_timeout', '30s', true);
  end if;
end;
$$;

-- The next canonical S122 wrapper unconditionally supplies brand and theme
-- for every typed blueprint. Keep its full legacy projection and all early
-- returns; omit only the first brand value that wrapper immediately replaces.
-- The body below is the concrete S178 definition, with only that expression
-- changed. Existing snapshots, versions, releases and source data are untouched.
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
    'brand', '{}'::jsonb
  );
end
$$;

-- Retain the existing private-only ACL explicitly.
revoke all on function private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)
  from public, anon, authenticated, service_role;

commit;
