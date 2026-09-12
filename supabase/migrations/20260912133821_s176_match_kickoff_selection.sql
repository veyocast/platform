-- S176: kickoff determines programme/results membership, independently of a
-- provider publishing a final score. Existing scopes, publication and RLS remain.
create function private.sportlink_match_phase_v1(
  p_status text,
  p_starts_at timestamptz,
  p_at timestamptz default now()
) returns text language sql stable set search_path = '' as $$
  select case
    when p_status in ('scheduled', 'postponed') and p_starts_at > p_at
      then 'program'
    when p_status in ('scheduled', 'in_progress', 'finished') and p_starts_at <= p_at
      then 'results'
    else null
  end
$$;
revoke all on function private.sportlink_match_phase_v1(text,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

-- Replace the S158 projection at its current name inside the existing wrapper
-- chain. Later theme/runtime decorators still run unchanged.
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

-- Every successful observation re-evaluates the time boundary even when the
-- provider's content hash is unchanged. Reuse the exact-published-version queue
-- so an open authoring draft cannot block or enter this automatic refresh.
create or replace function public.refresh_sportlink_time_sensitive_slides_v1(p_connection_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare connection public.sportlink_connections%rowtype; queued integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  select * into connection from public.sportlink_connections where id=p_connection_id;
  if connection.id is null then raise exception 'connection not found' using errcode='P0002'; end if;
  queued := private.queue_latest_dynamic_snapshots_v2(connection.tenant_id,connection.data_source_id,
    array['sport_visitor_arrivals','sport_referee_arrivals'],'sportlink_time_window');
  return queued + private.queue_match_row_snapshots_v1(connection.tenant_id,connection.data_source_id);
end;
$$;
revoke all on function public.refresh_sportlink_time_sensitive_slides_v1(uuid) from public,anon,authenticated;
grant execute on function public.refresh_sportlink_time_sensitive_slides_v1(uuid) to service_role;

-- New immutable successors for published latest slides. No historical snapshot,
-- release, pinned selection or draft payload is rewritten.
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
