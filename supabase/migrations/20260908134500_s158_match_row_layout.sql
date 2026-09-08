-- S158: freeze the complete, column-aligned match-row contract for club and
-- pool programme/results. Existing snapshots and releases remain immutable;
-- the corrective queue at the end only creates successor snapshots for the
-- exact current published latest-mode version.

create or replace function private.sportlink_display_config_is_valid_v2(
  p_display jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  legacy_keys constant text[] := array[
    'columns', 'showDressingRoom', 'showField', 'showHomeAway',
    'showLogo', 'showReferee'
  ];
  complete_keys constant text[] := array[
    'columns', 'showAwayDressingRoom', 'showAwayLogo', 'showDate',
    'showDressingRoom', 'showField', 'showHomeAway',
    'showHomeDressingRoom', 'showHomeLogo', 'showLogo', 'showReferee',
    'showSportpark', 'showTime'
  ];
  key_name text;
  key_count integer;
begin
  if pg_catalog.jsonb_typeof(p_display) is distinct from 'object' then
    return false;
  end if;
  select count(*) into key_count
  from pg_catalog.jsonb_object_keys(p_display);
  if key_count not in (6, 13)
    or not (p_display ?& legacy_keys)
    or (key_count = 13 and not (p_display ?& complete_keys))
    or p_display ->> 'columns' not in ('one', 'two')
  then
    return false;
  end if;
  for key_name in
    select key_values.key_name
    from pg_catalog.unnest(case
      when key_count = 13 then complete_keys
      else legacy_keys
    end) as key_values(key_name)
    where key_values.key_name <> 'columns'
  loop
    if pg_catalog.jsonb_typeof(p_display -> key_name) is distinct from 'boolean'
    then
      return false;
    end if;
  end loop;
  if key_count = 13 and (
    (p_display ->> 'showLogo')::boolean is distinct from (
      (p_display ->> 'showHomeLogo')::boolean
      or (p_display ->> 'showAwayLogo')::boolean
    )
    or (p_display ->> 'showDressingRoom')::boolean is distinct from (
      (p_display ->> 'showHomeDressingRoom')::boolean
      or (p_display ->> 'showAwayDressingRoom')::boolean
    )
  ) then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.sportlink_display_config_is_valid_v2(jsonb)
  from public, anon, authenticated, service_role;

-- Resolve an auto-current team context to one exact pool. The resolver may use
-- a relevant team fixture, a current standing, or a single unambiguous team
-- option. It never broadens a null context to the entire data source.
create function private.resolve_sportlink_pool_context_v1(
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
  resolved jsonb;
  resolved_source_connection_id uuid;
  source_timezone text;
  team_external_id text := p_context ->> 'providerTeamId';
begin
  if pg_catalog.jsonb_typeof(p_context) is distinct from 'object'
    or p_blueprint not in (
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
      case
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
     and fixture.competition ->> 'externalId' = options.competition_id
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
      when p_blueprint like '%results%'
        then fixture.status = 'finished'
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
    where exists (
      select 1
      from pg_catalog.jsonb_array_elements(standing.rows_json) standing_row
      where standing_row ->> 'externalId' = team_external_id
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

revoke all on function private.resolve_sportlink_pool_context_v1(
  uuid, uuid, jsonb, text
) from public, anon, authenticated, service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s158_match_row_layout;

create function private.build_dynamic_snapshot_data(
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
        then fixture.status = 'finished'
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
      and case when is_club then
        private.sportlink_match_matches_team_selection_v1(
          p_slide.tenant_id,
          p_slide.data_source_id,
          fixture,
          team_selection
        )
      else resolved_pool_context is not null
        and fixture.source_connection_id =
          (resolved_pool_context ->> 'sourceConnectionId')::uuid
        and fixture.competition ->> 'externalId' =
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
      then pg_catalog.to_jsonb(case when blueprint like '%results%'
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

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s158_match_row_layout(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- V5 adds the two pool-today blueprints while delegating all established
-- blueprints to the audited V4 implementation. Mixed batches remain atomic:
-- every nested call runs in this transaction and uses a deterministic derived
-- idempotency key.
create function public.create_sportlink_slide_batch_v5(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_drafts jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actual_type text;
  batch_id uuid;
  current_draft jsonb;
  current_result jsonb;
  derived_hash text;
  derived_idempotency_key uuid;
  display_config jsonb;
  draft_index bigint;
  expected_type text;
  existing_data_source_id uuid;
  existing_request_hash text;
  request_hash text;
  result jsonb;
  results jsonb := '[]'::jsonb;
  raw_display jsonb;
  seen_pool_variants text[] := array[]::text[];
  selection jsonb;
  show_away_dressing_room boolean;
  show_away_logo boolean;
  show_home_dressing_room boolean;
  show_home_logo boolean;
  variant_key text;
begin
  if pg_catalog.jsonb_typeof(p_drafts) = 'array'
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_drafts) draft(value)
      where draft.value ->> 'blueprintKey' in (
        'sportlink.pool_schedule_today',
        'sportlink.pool_results_today'
      )
    )
  then
    return public.create_sportlink_slide_batch_v4(
      p_tenant_id,
      p_data_source_id,
      p_drafts,
      p_idempotency_key
    );
  end if;

  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create Sportlink slides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if p_idempotency_key is null
    or not exists (
      select 1
      from public.dynamic_data_sources source
      where source.id = p_data_source_id
        and source.tenant_id = p_tenant_id
        and source.kind = 'sportlink'
        and source.status = 'active'
    )
  then
    raise exception 'Sportlink source unavailable' using errcode = '23514';
  end if;
  if pg_catalog.jsonb_typeof(p_drafts) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_drafts) not between 1 and 25
  then
    raise exception 'invalid Sportlink batch' using errcode = '22023';
  end if;

  -- V5 may contain both established and pool-today drafts. Preserve V4's
  -- whole-batch duplicate invariants before delegating established drafts.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_drafts) draft(value)
    where draft.value ->> 'blueprintKey' in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    )
    group by
      draft.value ->> 'blueprintKey',
      coalesce(draft.value #>> '{teamSelection,matchLocation}', 'both')
    having count(*) > 1
  ) then
    raise exception 'duplicate club-wide Sportlink variant'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_drafts) draft(value)
    where draft.value ->> 'blueprintKey' in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    )
    group by draft.value ->> 'blueprintKey'
    having count(*) > 1
  ) then
    raise exception 'duplicate Sportlink arrival component'
      using errcode = '22023';
  end if;

  request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'dataSourceId', p_data_source_id,
          'drafts', p_drafts,
          'schemaVersion', 5
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.sportlink_slide_batches(
    tenant_id,
    data_source_id,
    idempotency_key,
    request_hash_sha256,
    created_by
  ) values (
    p_tenant_id,
    p_data_source_id,
    p_idempotency_key,
    request_hash,
    actor_id
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id, result_json into batch_id, result;

  if batch_id is null then
    select
      existing.id,
      existing.data_source_id,
      existing.request_hash_sha256,
      existing.result_json
    into
      batch_id,
      existing_data_source_id,
      existing_request_hash,
      result
    from public.sportlink_slide_batches existing
    where existing.tenant_id = p_tenant_id
      and existing.idempotency_key = p_idempotency_key;

    if batch_id is null
      or existing_data_source_id is distinct from p_data_source_id
      or existing_request_hash is distinct from request_hash
    then
      raise exception 'idempotency key belongs to a different Sportlink request'
        using errcode = '22023';
    end if;
    if result is not null then
      return result;
    end if;
  end if;

  for current_draft, draft_index in
    select draft.value, draft.ordinality
    from pg_catalog.jsonb_array_elements(p_drafts)
      with ordinality draft(value, ordinality)
    order by draft.ordinality
  loop
    derived_hash := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          p_idempotency_key::text || ':' || request_hash || ':' ||
            draft_index::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    derived_idempotency_key := (
      pg_catalog.substr(derived_hash, 1, 8) || '-' ||
      pg_catalog.substr(derived_hash, 9, 4) || '-' ||
      pg_catalog.substr(derived_hash, 13, 4) || '-' ||
      pg_catalog.substr(derived_hash, 17, 4) || '-' ||
      pg_catalog.substr(derived_hash, 21, 12)
    )::uuid;

    if current_draft ->> 'blueprintKey' not in (
      'sportlink.pool_schedule_today',
      'sportlink.pool_results_today'
    ) then
      current_result := public.create_sportlink_slide_batch_v4(
        p_tenant_id,
        p_data_source_id,
        pg_catalog.jsonb_build_array(current_draft),
        derived_idempotency_key
      );
      results := results || coalesce(
        current_result -> 'slides',
        '[]'::jsonb
      );
      continue;
    end if;

    selection := current_draft -> 'themeSelection';
    raw_display := coalesce(current_draft -> 'display', '{}'::jsonb);
    if pg_catalog.jsonb_typeof(raw_display) is distinct from 'object'
      or (
        raw_display <> '{}'::jsonb
        and not private.sportlink_display_config_is_valid_v2(raw_display)
      )
    then
      raise exception 'invalid Sportlink pool-today display configuration'
        using errcode = '22023';
    end if;
    show_away_dressing_room := coalesce(
      (raw_display ->> 'showAwayDressingRoom')::boolean,
      (raw_display ->> 'showDressingRoom')::boolean,
      false
    );
    show_home_dressing_room := coalesce(
      (raw_display ->> 'showHomeDressingRoom')::boolean,
      (raw_display ->> 'showDressingRoom')::boolean,
      false
    );
    show_away_logo := coalesce(
      (raw_display ->> 'showAwayLogo')::boolean,
      (raw_display ->> 'showLogo')::boolean,
      true
    );
    show_home_logo := coalesce(
      (raw_display ->> 'showHomeLogo')::boolean,
      (raw_display ->> 'showLogo')::boolean,
      true
    );
    display_config := pg_catalog.jsonb_build_object(
      'columns', case raw_display ->> 'columns'
        when 'two' then 'two' else 'one' end,
      'showAwayDressingRoom', show_away_dressing_room,
      'showAwayLogo', show_away_logo,
      'showDate', coalesce((raw_display ->> 'showDate')::boolean, true),
      'showDressingRoom',
        show_home_dressing_room or show_away_dressing_room,
      'showField', coalesce((raw_display ->> 'showField')::boolean, true),
      'showHomeAway', coalesce(
        (raw_display ->> 'showHomeAway')::boolean,
        true
      ),
      'showHomeDressingRoom', show_home_dressing_room,
      'showHomeLogo', show_home_logo,
      'showLogo', show_home_logo or show_away_logo,
      'showReferee', coalesce(
        (raw_display ->> 'showReferee')::boolean,
        false
      ),
      'showSportpark', coalesce(
        (raw_display ->> 'showSportpark')::boolean,
        true
      ),
      'showTime', coalesce((raw_display ->> 'showTime')::boolean, true)
    );

    if pg_catalog.jsonb_typeof(current_draft) is distinct from 'object'
      or not (current_draft ?& array[
        'blueprintKey', 'context', 'name', 'orientation',
        'templateVersionId', 'themeSelection', 'title'
      ])
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(current_draft) keys(key_name)
        where keys.key_name not in (
          'blueprintKey', 'context', 'display', 'name', 'orientation',
          'templateVersionId', 'themeSelection', 'title'
        )
      )
      or pg_catalog.jsonb_typeof(current_draft -> 'name')
        is distinct from 'string'
      or length(pg_catalog.btrim(coalesce(
        current_draft ->> 'name', ''
      ))) not between 2 and 120
      or pg_catalog.jsonb_typeof(current_draft -> 'title')
        is distinct from 'string'
      or length(pg_catalog.btrim(coalesce(
        current_draft ->> 'title', ''
      ))) not between 1 and 160
      or current_draft ->> 'orientation' not in ('landscape', 'portrait')
      or coalesce(current_draft ->> 'templateVersionId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or not private.sportlink_team_contexts_are_valid_v2(
        p_tenant_id,
        p_data_source_id,
        pg_catalog.jsonb_build_array(current_draft -> 'context')
      )
      or (
        current_draft #>> '{context,competitionSelectionMode}' = 'pinned'
        and nullif(pg_catalog.btrim(
          current_draft #>> '{context,poolId}'
        ), '') is null
      )
      or not private.sportlink_display_config_is_valid_v2(display_config)
      or not private.theme_selection_is_valid_v1(selection)
      or selection #>> '{ref,version}' is distinct from '1.0.0'
    then
      raise exception 'invalid Sportlink pool-today draft'
        using errcode = '22023';
    end if;

    actual_type := null;
    select template.slide_type
    into actual_type
    from public.dynamic_template_versions version
    join public.dynamic_templates template
      on template.id = version.template_id
    where version.id = (
        current_draft ->> 'templateVersionId'
      )::uuid
      and version.status = 'published'
      and template.status = 'published'
      and template.orientation = current_draft ->> 'orientation';
    expected_type := case
      when current_draft ->> 'blueprintKey' =
        'sportlink.pool_schedule_today' then 'sport_program'
      else 'sport_results'
    end;
    if actual_type is distinct from expected_type then
      raise exception 'template does not match Sportlink blueprint'
        using errcode = '23514';
    end if;

    variant_key := (current_draft ->> 'blueprintKey') || ':' ||
      (current_draft #>> '{context,providerTeamId}');
    if variant_key = any(seen_pool_variants) then
      raise exception 'duplicate Sportlink pool-today variant'
        using errcode = '22023';
    end if;
    seen_pool_variants := pg_catalog.array_append(
      seen_pool_variants,
      variant_key
    );

    current_result := public.create_dynamic_slide_v1(
      p_tenant_id,
      current_draft ->> 'name',
      (current_draft ->> 'templateVersionId')::uuid,
      p_data_source_id,
      'latest',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 1,
        'blueprintKey', current_draft ->> 'blueprintKey',
        'title', current_draft ->> 'title',
        'context', current_draft -> 'context',
        'display', display_config,
        'editorial', pg_catalog.jsonb_build_object(
          'schemaVersion', 2,
          'themeSelection', selection
        ),
        'maxItems', 40
      )
    );
    results := results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'slideId', current_result ->> 'slideId',
        'snapshotId', current_result ->> 'snapshotId',
        'name', current_draft ->> 'name',
        'blueprintKey', current_draft ->> 'blueprintKey',
        'teamCount', 1
      )
    );
  end loop;

  result := pg_catalog.jsonb_build_object(
    'batchId', batch_id,
    'slides', results,
    'count', pg_catalog.jsonb_array_length(results)
  );
  update public.sportlink_slide_batches batch
  set result_json = result
  where batch.id = batch_id;

  perform private.audit_event(
    p_tenant_id,
    'sportlink.slide_batch.created',
    'sportlink_slide_batches',
    batch_id,
    'success',
    pg_catalog.jsonb_build_object(
      'count', pg_catalog.jsonb_array_length(results),
      'dataSourceId', p_data_source_id,
      'schemaVersion', 5
    )
  );
  return result;
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v5(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v5(
  uuid, uuid, jsonb, uuid
) to authenticated;

-- Materialize the exact published version even when an author has an open
-- draft. The completed-render pipeline promotes a successor release; this
-- function never mutates an existing snapshot, release, or Player LKG.
create function private.queue_match_row_snapshots_v1(
  p_tenant_id uuid,
  p_data_source_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_hash text;
  new_snapshot_id uuid;
  queued_count integer := 0;
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
begin
  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.dynamic_slide_id = slide.id
     and version.id = slide.current_published_version_id
     and version.status = 'published'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
      and version.data_source_id = p_data_source_id
      and version.selection_mode = 'latest'
      and version.configuration_json ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days',
        'sportlink.pool_schedule_today',
        'sportlink.pool_schedule_next_7_days',
        'sportlink.pool_results_today',
        'sportlink.pool_results_previous_7_days'
      )
    order by slide.id
    for update of slide
  loop
    select
      version.name,
      version.slide_type,
      version.orientation,
      version.template_id,
      version.template_version_id,
      version.data_source_id,
      version.selection_mode,
      version.configuration_json
    into
      slide_record.name,
      slide_record.slide_type,
      slide_record.orientation,
      slide_record.template_id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      slide_record.selection_mode,
      slide_record.configuration_json
    from public.dynamic_slide_versions version
    where version.tenant_id = slide_record.tenant_id
      and version.dynamic_slide_id = slide_record.id
      and version.id = slide_record.current_published_version_id
      and version.status = 'published';
    if not found then
      continue;
    end if;

    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot_data
    );
    new_snapshot_id := null;
    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.current_published_version_id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      content_hash,
      snapshot_data
    )
    on conflict (
      dynamic_slide_id,
      dynamic_slide_version_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is null then
      continue;
    end if;
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    values (slide_record.tenant_id, new_snapshot_id)
    on conflict (snapshot_id) do nothing;
    update public.dynamic_slides slide
    set status = 'rendering',
        last_error_code = null
    where slide.tenant_id = slide_record.tenant_id
      and slide.id = slide_record.id;
    queued_count := queued_count + 1;
  end loop;

  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id,
      action,
      target_type,
      target_id,
      result,
      metadata
    ) values (
      p_tenant_id,
      'dynamic.snapshot.auto_queued',
      'dynamic_data_sources',
      p_data_source_id,
      'success',
      pg_catalog.jsonb_build_object(
        'systemExecuted', true,
        'reason', 's158_match_row_layout',
        'queuedCount', queued_count,
        'publishedVersionOnly', true
      )
    );
  end if;
  return queued_count;
end;
$$;

revoke all on function private.queue_match_row_snapshots_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

do $$
declare
  source_record record;
begin
  for source_record in
    select distinct version.tenant_id, version.data_source_id
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.dynamic_slide_id = slide.id
     and version.id = slide.current_published_version_id
     and version.status = 'published'
    where slide.status <> 'archived'
      and version.selection_mode = 'latest'
      and version.configuration_json ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days',
        'sportlink.pool_schedule_today',
        'sportlink.pool_schedule_next_7_days',
        'sportlink.pool_results_today',
        'sportlink.pool_results_previous_7_days'
      )
    order by version.tenant_id, version.data_source_id
  loop
    perform private.queue_match_row_snapshots_v1(
      source_record.tenant_id,
      source_record.data_source_id
    );
  end loop;
end;
$$;
