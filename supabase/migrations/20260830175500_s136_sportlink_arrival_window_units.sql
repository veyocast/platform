-- S136: retain minute-based snapshot compatibility while allowing operators
-- to enter the arrival horizon in minutes, hours or days up to the existing
-- 42-day provider schedule horizon.

create or replace function private.sportlink_arrival_window_minutes(
  p_arrival jsonb,
  p_key text,
  p_default integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(
    greatest(
      coalesce(nullif(p_arrival ->> p_key, '')::integer, p_default),
      0
    ),
    60480
  )
$$;

revoke all on function private.sportlink_arrival_window_minutes(jsonb,text,integer)
  from public, anon, authenticated;

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
    select jsonb_build_object(
      'type', 'sport_standing',
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
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
            'selected', row ->> 'externalId' = context ->> 'providerTeamId'
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
      and (
        context ->> 'poolId' is null
        or standing.metadata #>> '{pool,externalId}' = context ->> 'poolId'
        or standing.metadata #>> '{pool,poolExternalId}' = context ->> 'poolId'
      )
      and (
        context ->> 'competitionId' is null
        or standing.metadata #>> '{competition,externalId}' = context ->> 'competitionId'
      )
      and (
        context ->> 'seasonId' is null
        or standing.season_key = context ->> 'seasonId'
      )
    order by standing.last_synced_at desc
    limit 1;
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

revoke all on function private.build_dynamic_snapshot_data_before_s122_theme_restore(
  public.dynamic_slides
)
  from public, anon, authenticated;
