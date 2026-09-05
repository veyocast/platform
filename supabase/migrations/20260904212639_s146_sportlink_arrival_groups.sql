-- S146: one linked visitor/referee welcome component can safely follow many
-- tenant teams. Historical slides without teamContexts retain their existing
-- club-wide behaviour; immutable snapshots and playlist releases are never
-- rewritten.

alter table public.sportlink_slide_batches
  add column request_hash_sha256 text;

alter table public.sportlink_slide_batches
  add constraint sportlink_slide_batches_request_hash_check
  check (
    request_hash_sha256 is null
    or request_hash_sha256 ~ '^[a-f0-9]{64}$'
  );

create function private.sportlink_display_config_is_valid_v1(
  p_display jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key_name text;
begin
  if jsonb_typeof(p_display) is distinct from 'object'
    or not (p_display ?& array[
      'columns', 'showDressingRoom', 'showField', 'showHomeAway',
      'showReferee'
    ])
  then
    return false;
  end if;
  for key_name in select jsonb_object_keys(p_display)
  loop
    if key_name <> all(array[
      'columns', 'showDressingRoom', 'showField', 'showHomeAway',
      'showReferee'
    ]) then
      return false;
    end if;
  end loop;
  if coalesce(p_display ->> 'columns', '') not in ('one', 'two') then
    return false;
  end if;
  if jsonb_typeof(p_display -> 'showDressingRoom') is distinct from 'boolean'
    or jsonb_typeof(p_display -> 'showField') is distinct from 'boolean'
    or jsonb_typeof(p_display -> 'showHomeAway') is distinct from 'boolean'
    or jsonb_typeof(p_display -> 'showReferee') is distinct from 'boolean'
  then
    return false;
  end if;
  return true;
end;
$$;

create function private.sportlink_arrival_config_is_valid_v1(
  p_arrival jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key_name text;
  numeric_key text;
  boolean_key text;
  numeric_value integer;
begin
  if jsonb_typeof(p_arrival) is distinct from 'object'
    or not (p_arrival ?& array[
      'cardCount', 'dutyDeskText', 'emptyBehavior',
      'highlightRecentMinutes', 'minutesAfter', 'minutesBefore',
      'motionPreset', 'pageDurationSeconds', 'placeholderText',
      'showArrivalTime', 'showClubLogo', 'showCompetition',
      'showDressingRoom', 'showField', 'showKickoffTime', 'showSponsor',
      'showWelcome', 'sponsorMediaAssetId', 'welcomeText'
    ])
  then
    return false;
  end if;
  for key_name in select jsonb_object_keys(p_arrival)
  loop
    if key_name <> all(array[
      'cardCount', 'dutyDeskText', 'emptyBehavior',
      'highlightRecentMinutes', 'minutesAfter', 'minutesBefore',
      'motionPreset', 'pageDurationSeconds', 'placeholderText',
      'showArrivalTime', 'showClubLogo', 'showCompetition',
      'showDressingRoom', 'showField', 'showKickoffTime', 'showSponsor',
      'showWelcome', 'sponsorMediaAssetId', 'welcomeText'
    ]) then
      return false;
    end if;
  end loop;

  foreach numeric_key in array array[
    'cardCount', 'highlightRecentMinutes', 'minutesAfter', 'minutesBefore',
    'pageDurationSeconds'
  ]
  loop
    if jsonb_typeof(p_arrival -> numeric_key) is distinct from 'number'
      or coalesce(p_arrival ->> numeric_key, '') !~ '^[0-9]+$'
      or length(coalesce(p_arrival ->> numeric_key, '')) > 9
    then
      return false;
    end if;
    numeric_value := (p_arrival ->> numeric_key)::integer;
    if (numeric_key = 'cardCount' and numeric_value not between 1 and 4)
      or (numeric_key = 'highlightRecentMinutes'
        and numeric_value not between 0 and 180)
      or (numeric_key in ('minutesAfter', 'minutesBefore')
        and numeric_value not between 0 and 60480)
      or (numeric_key = 'pageDurationSeconds'
        and numeric_value not between 5 and 120)
    then
      return false;
    end if;
  end loop;

  foreach boolean_key in array array[
    'showArrivalTime', 'showClubLogo', 'showCompetition',
    'showDressingRoom', 'showField', 'showKickoffTime', 'showSponsor',
    'showWelcome'
  ]
  loop
    if jsonb_typeof(p_arrival -> boolean_key) is distinct from 'boolean' then
      return false;
    end if;
  end loop;

  if coalesce(p_arrival ->> 'emptyBehavior', '') not in ('skip', 'placeholder')
    or coalesce(p_arrival ->> 'motionPreset', '') not in (
      'auto', 'aurora-rise', 'spotlight-bloom', 'kinetic-split',
      'prism-swipe', 'grand-flip'
    )
  then
    return false;
  end if;
  if jsonb_typeof(p_arrival -> 'placeholderText') is distinct from 'string'
    or length(btrim(p_arrival ->> 'placeholderText')) not between 1 and 160
    or jsonb_typeof(p_arrival -> 'welcomeText') is distinct from 'string'
    or length(btrim(p_arrival ->> 'welcomeText')) not between 1 and 80
  then
    return false;
  end if;
  if jsonb_typeof(p_arrival -> 'dutyDeskText') not in ('null', 'string')
    or (
      jsonb_typeof(p_arrival -> 'dutyDeskText') = 'string'
      and length(btrim(p_arrival ->> 'dutyDeskText')) > 120
    )
  then
    return false;
  end if;
  if jsonb_typeof(p_arrival -> 'sponsorMediaAssetId') not in ('null', 'string')
    or (
      jsonb_typeof(p_arrival -> 'sponsorMediaAssetId') = 'string'
      and coalesce(p_arrival ->> 'sponsorMediaAssetId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.sportlink_display_config_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.sportlink_arrival_config_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;

create function private.sportlink_team_contexts_are_valid_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_team_contexts jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context_record jsonb;
  competition_options jsonb;
  context_key text;
  selection_mode text;
begin
  if jsonb_typeof(p_team_contexts) is distinct from 'array' then
    return false;
  end if;

  if jsonb_array_length(p_team_contexts) not between 1 and 100 then
    return false;
  end if;

  if (
    select count(*) <> count(distinct context ->> 'providerTeamId')
    from jsonb_array_elements(p_team_contexts) context
  ) then
    return false;
  end if;

  for context_record in
    select value from jsonb_array_elements(p_team_contexts)
  loop
    if jsonb_typeof(context_record) <> 'object'
      or not (context_record ?& array[
        'competitionId', 'competitionSelectionMode', 'phaseId', 'poolId',
        'providerTeamId', 'seasonId'
      ])
      or length(coalesce(context_record ->> 'providerTeamId', '')) not between 1 and 200
      or coalesce(context_record ->> 'competitionSelectionMode', '')
        not in ('auto_current', 'pinned')
    then
      return false;
    end if;

    for context_key in select jsonb_object_keys(context_record)
    loop
      if context_key <> all(array[
        'competitionId', 'competitionSelectionMode', 'phaseId', 'poolId',
        'providerTeamId', 'seasonId'
      ]) then
        return false;
      end if;
    end loop;

    if jsonb_typeof(context_record -> 'providerTeamId') is distinct from 'string'
      or jsonb_typeof(context_record -> 'competitionSelectionMode')
        is distinct from 'string'
      or jsonb_typeof(context_record -> 'competitionId') not in ('null', 'string')
      or jsonb_typeof(context_record -> 'phaseId') not in ('null', 'string')
      or jsonb_typeof(context_record -> 'poolId') not in ('null', 'string')
      or jsonb_typeof(context_record -> 'seasonId') not in ('null', 'string')
      or (
        jsonb_typeof(context_record -> 'competitionId') = 'string'
        and length(btrim(context_record ->> 'competitionId')) not between 1 and 200
      )
      or (
        jsonb_typeof(context_record -> 'phaseId') = 'string'
        and length(btrim(context_record ->> 'phaseId')) not between 1 and 200
      )
      or (
        jsonb_typeof(context_record -> 'poolId') = 'string'
        and length(btrim(context_record ->> 'poolId')) not between 1 and 200
      )
      or (
        jsonb_typeof(context_record -> 'seasonId') = 'string'
        and length(btrim(context_record ->> 'seasonId')) not between 1 and 80
      )
    then
      return false;
    end if;

    selection_mode := context_record ->> 'competitionSelectionMode';
    if selection_mode = 'auto_current' and (
      context_record -> 'competitionId' <> 'null'::jsonb
      or context_record -> 'phaseId' <> 'null'::jsonb
      or context_record -> 'poolId' <> 'null'::jsonb
      or context_record -> 'seasonId' <> 'null'::jsonb
    ) then
      return false;
    end if;

    select case
      when jsonb_typeof(team.metadata -> 'competitionOptions') = 'array'
        then team.metadata -> 'competitionOptions'
      else '[]'::jsonb
    end
    into competition_options
    from public.sports_teams team
    join public.sportlink_connections connection
      on connection.id = team.source_connection_id
     and connection.tenant_id = team.tenant_id
    where team.tenant_id = p_tenant_id
      and connection.data_source_id = p_data_source_id
      and team.external_id = context_record ->> 'providerTeamId'
      and team.active
    order by team.last_synced_at desc
    limit 1;

    if not found then
      return false;
    end if;

    if selection_mode = 'pinned' and (
      nullif(context_record ->> 'competitionId', '') is null
      or not exists (
        select 1
        from jsonb_array_elements(competition_options) option_record
        where option_record ->> 'externalId' = context_record ->> 'competitionId'
          and (
            nullif(context_record ->> 'phaseId', '') is null
            or option_record ->> 'period' = context_record ->> 'phaseId'
          )
          and (
            nullif(context_record ->> 'poolId', '') is null
            or option_record ->> 'poolExternalId' = context_record ->> 'poolId'
          )
          and (
            nullif(context_record ->> 'seasonId', '') is null
            or option_record ->> 'season' = context_record ->> 'seasonId'
          )
      )
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function private.sportlink_team_contexts_are_valid_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

create function private.enforce_sportlink_arrival_team_contexts_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publishing'
    and new.configuration_json ->> 'blueprintKey' in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    )
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection must be saved before publishing'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.configuration_json ? 'teamContexts'
    and new.configuration_json ->> 'blueprintKey' in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    )
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection cannot be removed'
      using errcode = '23514';
  end if;

  if new.configuration_json ? 'teamContexts'
    and not coalesce(
      new.configuration_json ->> 'blueprintKey' in (
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      ),
      false
    )
  then
    raise exception 'Sportlink team selection is only valid for arrival slides'
      using errcode = '23514';
  end if;

  if new.configuration_json ->> 'blueprintKey' in (
    'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  )
    and new.configuration_json ? 'teamContexts'
    and not private.sportlink_team_contexts_are_valid_v1(
      new.tenant_id,
      new.data_source_id,
      new.configuration_json -> 'teamContexts'
    )
  then
    raise exception 'Sportlink team selection is invalid'
      using errcode = '23514';
  end if;

  if new.configuration_json ? 'teamContexts'
    and (
      jsonb_typeof(new.configuration_json -> 'context')
        is distinct from 'object'
      or new.configuration_json -> 'context'
        is distinct from new.configuration_json #> '{teamContexts,0}'
    )
  then
    raise exception 'Sportlink primary context must match the first selected team'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_sportlink_arrival_team_contexts_v1()
  from public, anon, authenticated, service_role;

create trigger dynamic_slide_versions_validate_arrival_team_contexts
before insert or update of configuration_json, data_source_id, status
on public.dynamic_slide_versions
for each row execute function private.enforce_sportlink_arrival_team_contexts_v1();

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s146_arrival_groups;

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
  arrival jsonb := coalesce(p_slide.configuration_json -> 'arrival', '{}'::jsonb);
  before_minutes integer;
  after_minutes integer;
  blueprint text := p_slide.configuration_json ->> 'blueprintKey';
  result jsonb;
  selected_items jsonb;
  selected_team_count integer;
  show_club_logo boolean;
  team_contexts jsonb := p_slide.configuration_json -> 'teamContexts';
begin
  result := private.build_dynamic_snapshot_data_before_s146_arrival_groups(
    p_slide
  );

  if blueprint is null or blueprint not in (
    'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  ) or jsonb_typeof(team_contexts) is distinct from 'array'
  then
    return result;
  end if;

  before_minutes := private.sportlink_arrival_window_minutes(
    arrival,
    'minutesBefore',
    90
  );
  after_minutes := private.sportlink_arrival_window_minutes(
    arrival,
    'minutesAfter',
    30
  );
  show_club_logo := coalesce(
    (arrival ->> 'showClubLogo')::boolean,
    true
  );
  selected_team_count := jsonb_array_length(team_contexts);

  with requested_contexts as (
    select selected_context.value as context
    from jsonb_array_elements(team_contexts) selected_context
  ), resolved_contexts as (
    select
      requested.context,
      case
        when requested.context ->> 'competitionSelectionMode' = 'auto_current'
          then current_fixture.competition_id
        else requested.context ->> 'competitionId'
      end as competition_id,
      case
        when requested.context ->> 'competitionSelectionMode' = 'auto_current'
          then current_fixture.phase_id
        else requested.context ->> 'phaseId'
      end as phase_id,
      case
        when requested.context ->> 'competitionSelectionMode' = 'auto_current'
          then current_fixture.pool_id
        else requested.context ->> 'poolId'
      end as pool_id,
      case
        when requested.context ->> 'competitionSelectionMode' = 'auto_current'
          then current_fixture.season_id
        else requested.context ->> 'seasonId'
      end as season_id
    from requested_contexts requested
    left join lateral (
      select
        fixture.competition ->> 'externalId' as competition_id,
        fixture.competition ->> 'period' as phase_id,
        coalesce(
          fixture.pool ->> 'externalId',
          fixture.pool ->> 'poolExternalId'
        ) as pool_id,
        fixture.competition ->> 'season' as season_id
      from public.sports_matches fixture
      join public.sportlink_connections connection
        on connection.id = fixture.source_connection_id
       and connection.tenant_id = fixture.tenant_id
      where fixture.tenant_id = p_slide.tenant_id
        and connection.data_source_id = p_slide.data_source_id
        and fixture.active
        and fixture.is_home_match
        and fixture.status in ('scheduled', 'postponed')
        and fixture.home_team ->> 'externalId' =
          requested.context ->> 'providerTeamId'
        and fixture.starts_at between
          now() - make_interval(mins => after_minutes)
          and now() + make_interval(mins => before_minutes)
      order by fixture.starts_at, fixture.external_id
      limit 1
    ) current_fixture
      on requested.context ->> 'competitionSelectionMode' = 'auto_current'
  ), selected_matches as (
    select
      fixture.*,
      connection.timezone as source_timezone
    from public.sports_matches fixture
    join public.sportlink_connections connection
      on connection.id = fixture.source_connection_id
     and connection.tenant_id = fixture.tenant_id
    where fixture.tenant_id = p_slide.tenant_id
      and connection.data_source_id = p_slide.data_source_id
      and fixture.active
      and fixture.is_home_match
      and fixture.status in ('scheduled', 'postponed')
      and fixture.starts_at between
        now() - make_interval(mins => after_minutes)
        and now() + make_interval(mins => before_minutes)
      and exists (
        select 1
        from resolved_contexts selected_context
        where fixture.home_team ->> 'externalId' =
            selected_context.context ->> 'providerTeamId'
          and fixture.competition ->> 'externalId'
            is not distinct from selected_context.competition_id
          and (
            selected_context.phase_id is null
            or fixture.competition ->> 'period' = selected_context.phase_id
          )
          and (
            selected_context.pool_id is null
            or fixture.pool ->> 'externalId' = selected_context.pool_id
            or fixture.pool ->> 'poolExternalId' = selected_context.pool_id
          )
          and (
            selected_context.season_id is null
            or fixture.competition ->> 'season' = selected_context.season_id
          )
      )
    order by fixture.starts_at, fixture.external_id
    limit 40
  ), cards as (
    select
      fixture.away_team ->> 'name' as card_name,
      fixture.competition ->> 'name' as competition_name,
      fixture.dressing_rooms ->> 'away' as dressing_room,
      fixture.venue ->> 'field' as field_name,
      fixture.external_id as id,
      fixture.away_team ->> 'externalId' as logo_external_id,
      0 as person_index,
      fixture.source_timezone,
      fixture.starts_at
    from selected_matches fixture
    where blueprint = 'sportlink.visitor_arrivals'
      and nullif(btrim(fixture.away_team ->> 'name'), '') is not null
    union all
    select
      coalesce(official.value ->> 'displayName', official.value ->> 'name'),
      fixture.competition ->> 'name',
      fixture.dressing_rooms ->> 'official',
      fixture.venue ->> 'field',
      fixture.external_id || ':' || official.ordinality,
      null,
      official.ordinality::integer,
      fixture.source_timezone,
      fixture.starts_at
    from selected_matches fixture
    cross join lateral jsonb_array_elements(fixture.officials)
      with ordinality official(value, ordinality)
    where blueprint = 'sportlink.referee_arrivals'
      and nullif(btrim(coalesce(
        official.value ->> 'displayName',
        official.value ->> 'name'
      )), '') is not null
  ), bounded_cards as (
    select cards.*
    from cards
    order by cards.starts_at, cards.id, cards.person_index
    limit 40
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', cards.id,
        'primary', cards.card_name,
        'secondary', concat_ws(' · ',
          case when coalesce((arrival ->> 'showArrivalTime')::boolean, true)
            then 'Aankomst ' || to_char(
              (
                cards.starts_at - make_interval(mins => before_minutes)
              ) at time zone coalesce(cards.source_timezone, 'Europe/Amsterdam'),
              'HH24:MI'
            )
          end,
          case when coalesce((arrival ->> 'showKickoffTime')::boolean, true)
            then 'Aanvang ' || to_char(
              cards.starts_at at time zone coalesce(
                cards.source_timezone,
                'Europe/Amsterdam'
              ),
              'HH24:MI'
            )
          end
        ),
        'meta', concat_ws(' · ',
          case when coalesce((arrival ->> 'showDressingRoom')::boolean, true)
            and coalesce(cards.dressing_room, '') <> ''
            then 'Kleedkamer ' || cards.dressing_room
          end,
          case when coalesce((arrival ->> 'showField')::boolean, true)
            and coalesce(cards.field_name, '') <> ''
            then 'Veld ' || cards.field_name
          end,
          case when coalesce((arrival ->> 'showCompetition')::boolean, false)
            then nullif(cards.competition_name, '')
          end,
          nullif(arrival ->> 'dutyDeskText', '')
        ),
        'status', case
          when coalesce((arrival ->> 'showWelcome')::boolean, true)
            then coalesce(
              nullif(arrival ->> 'welcomeText', ''),
              'Welkom bij {{club}}'
            )
          else ''
        end,
        'arrivalAt', cards.starts_at - make_interval(mins => before_minutes),
        'kickoffAt', cards.starts_at,
        'name', cards.card_name,
        'dressingRoom', cards.dressing_room,
        'field', cards.field_name,
        'competition', cards.competition_name,
        'recent', (
          cards.starts_at - make_interval(mins => before_minutes)
        ) between now() - make_interval(
          mins => coalesce((arrival ->> 'highlightRecentMinutes')::integer, 15)
        ) and now(),
        'homeMatch', true,
        'logoMediaAssetId', case
          when not show_club_logo then null
          when blueprint = 'sportlink.visitor_arrivals'
            then visitor_logo.current_version_id::text
          else nullif(result #>> '{brand,logoMediaAssetId}', '')
        end
      ))
      order by cards.starts_at, cards.id, cards.person_index
    ),
    '[]'::jsonb
  )
  into selected_items
  from bounded_cards cards
  left join public.provider_asset_cache visitor_logo
    on blueprint = 'sportlink.visitor_arrivals'
   and visitor_logo.provider = 'sportlink'
   and visitor_logo.entity_type = 'team'
   and visitor_logo.asset_role = 'team_logo'
   and visitor_logo.external_entity_id = cards.logo_external_id
   and visitor_logo.current_version_id is not null;

  result := jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{sport,items}',
    selected_items,
    true
  );
  result := jsonb_set(
    result,
    '{sport,selectedTeamCount}',
    to_jsonb(selected_team_count),
    true
  );
  result := jsonb_set(
    result,
    '{sport,emptyStateCode}',
    case when jsonb_array_length(selected_items) = 0
      then to_jsonb('NO_ARRIVALS_IN_WINDOW'::text)
      else 'null'::jsonb
    end,
    true
  );
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s146_arrival_groups(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- Keep ordinary stale-client batches compatible, but close the legacy route
-- that used to fan one welcome purpose out into one slide per team.
alter function public.create_sportlink_slide_batch_v1(uuid, uuid, jsonb, uuid)
  rename to create_sportlink_slide_batch_legacy_v1;
alter function public.create_sportlink_slide_batch_legacy_v1(uuid, uuid, jsonb, uuid)
  set schema private;
alter function public.create_sportlink_slide_batch_v2(uuid, uuid, jsonb, uuid)
  rename to create_sportlink_slide_batch_legacy_v2;
alter function public.create_sportlink_slide_batch_legacy_v2(uuid, uuid, jsonb, uuid)
  set schema private;

revoke all on function private.create_sportlink_slide_batch_legacy_v1(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.create_sportlink_slide_batch_legacy_v2(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

create function public.create_sportlink_slide_batch_v1(
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
begin
  if private.current_user_id() is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.dynamic_slide.write'
    )
  then
    raise exception 'actor cannot create Sportlink slides' using errcode = '42501';
  end if;
  if jsonb_typeof(p_drafts) = 'array' then
    if exists (
      select 1
      from jsonb_array_elements(p_drafts) draft
      where draft ->> 'blueprintKey' in (
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      )
    ) then
      raise exception 'linked arrival components require Sportlink batch v3'
        using errcode = '22023';
    end if;
  end if;
  return private.create_sportlink_slide_batch_legacy_v1(
    p_tenant_id,
    p_data_source_id,
    p_drafts,
    p_idempotency_key
  );
end;
$$;

create function public.create_sportlink_slide_batch_v2(
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
begin
  if private.current_user_id() is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.dynamic_slide.write'
    )
  then
    raise exception 'actor cannot create Sportlink slides' using errcode = '42501';
  end if;
  if jsonb_typeof(p_drafts) = 'array' then
    if exists (
      select 1
      from jsonb_array_elements(p_drafts) draft
      where draft ->> 'blueprintKey' in (
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      )
    ) then
      raise exception 'linked arrival components require Sportlink batch v3'
        using errcode = '22023';
    end if;
  end if;
  return private.create_sportlink_slide_batch_legacy_v2(
    p_tenant_id,
    p_data_source_id,
    p_drafts,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v1(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v1(
  uuid, uuid, jsonb, uuid
) to authenticated;
revoke all on function public.create_sportlink_slide_batch_v2(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v2(
  uuid, uuid, jsonb, uuid
) to authenticated;

create function public.create_sportlink_slide_batch_v3(
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
  batch_id uuid;
  draft jsonb;
  expected_type text;
  actual_type text;
  arrival_config jsonb;
  display_config jsonb;
  existing_data_source_id uuid;
  existing_request_hash text;
  result jsonb;
  results jsonb := '[]'::jsonb;
  request_hash text;
  selection jsonb;
  team_contexts jsonb;
  seen_arrival_keys text[] := array[]::text[];
  is_arrival boolean;
  allowed_keys constant text[] := array[
    'sportlink.club_schedule_today', 'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today', 'sportlink.club_results_previous_7_days',
    'sportlink.pool_schedule_next_7_days', 'sportlink.pool_results_previous_7_days',
    'sportlink.pool_standings', 'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  ];
  allowed_draft_fields constant text[] := array[
    'arrival', 'blueprintKey', 'context', 'display', 'name', 'orientation',
    'teamContexts', 'templateVersionId', 'themeSelection', 'title'
  ];
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create Sportlink slides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1
    from public.dynamic_data_sources
    where id = p_data_source_id
      and tenant_id = p_tenant_id
      and kind = 'sportlink'
      and status = 'active'
  ) then
    raise exception 'Sportlink source unavailable' using errcode = '23514';
  end if;
  if jsonb_typeof(p_drafts) is distinct from 'array' then
    raise exception 'invalid Sportlink batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_drafts) not between 1 and 25 then
    raise exception 'invalid Sportlink batch' using errcode = '22023';
  end if;

  request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'dataSourceId', p_data_source_id,
          'drafts', p_drafts
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
    return result;
  end if;

  for draft in select value from jsonb_array_elements(p_drafts)
  loop
    selection := draft -> 'themeSelection';
    is_arrival := coalesce(
      draft ->> 'blueprintKey' in (
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      ),
      false
    );
    team_contexts := case
      when is_arrival then coalesce(
        draft -> 'teamContexts',
        jsonb_build_array(draft -> 'context')
      )
      else jsonb_build_array(draft -> 'context')
    end;
    display_config := jsonb_build_object(
      'columns', 'two',
      'showDressingRoom', false,
      'showField', true,
      'showHomeAway', true,
      'showReferee', false
    ) || coalesce(draft -> 'display', '{}'::jsonb);
    arrival_config := jsonb_build_object(
      'cardCount', 4,
      'dutyDeskText', null,
      'emptyBehavior', 'skip',
      'highlightRecentMinutes', 15,
      'minutesAfter', 30,
      'minutesBefore', 90,
      'motionPreset', 'auto',
      'pageDurationSeconds', 12,
      'placeholderText', 'Er worden nu geen teams verwacht.',
      'showArrivalTime', true,
      'showClubLogo', true,
      'showCompetition', false,
      'showDressingRoom', true,
      'showField', true,
      'showKickoffTime', true,
      'showSponsor', false,
      'showWelcome', true,
      'sponsorMediaAssetId', null,
      'welcomeText', 'Welkom bij {{club}}'
    ) || coalesce(draft -> 'arrival', '{}'::jsonb);

    if jsonb_typeof(draft) is distinct from 'object'
      or not (draft ?& array[
        'blueprintKey', 'context', 'name', 'orientation',
        'templateVersionId', 'themeSelection', 'title'
      ])
      or exists (
        select 1
        from jsonb_object_keys(draft) as keys(key_name)
        where keys.key_name <> all(allowed_draft_fields)
      )
      or not coalesce(draft ->> 'blueprintKey' = any(allowed_keys), false)
      or jsonb_typeof(draft -> 'name') is distinct from 'string'
      or length(btrim(coalesce(draft ->> 'name', ''))) not between 2 and 120
      or jsonb_typeof(draft -> 'title') is distinct from 'string'
      or length(btrim(coalesce(draft ->> 'title', ''))) not between 1 and 160
      or jsonb_typeof(draft -> 'orientation') is distinct from 'string'
      or coalesce(draft ->> 'orientation', '') not in ('landscape', 'portrait')
      or jsonb_typeof(draft -> 'templateVersionId') is distinct from 'string'
      or coalesce(draft ->> 'templateVersionId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(draft -> 'context') is distinct from 'object'
      or (not is_arrival and draft ? 'teamContexts')
      or (
        is_arrival
        and team_contexts -> 0 is distinct from draft -> 'context'
      )
      or not private.sportlink_team_contexts_are_valid_v1(
        p_tenant_id,
        p_data_source_id,
        team_contexts
      )
      or not private.sportlink_display_config_is_valid_v1(display_config)
      or (
        draft ? 'arrival'
        and not private.sportlink_arrival_config_is_valid_v1(arrival_config)
      )
      or not private.theme_selection_is_valid_v1(selection)
      or selection #>> '{ref,version}' is distinct from '1.0.0'
    then
      raise exception 'invalid Sportlink draft' using errcode = '22023';
    end if;

    if is_arrival then
      if draft ->> 'blueprintKey' = any(seen_arrival_keys) then
        raise exception 'duplicate Sportlink arrival component'
          using errcode = '22023';
      end if;
      seen_arrival_keys := array_append(
        seen_arrival_keys,
        draft ->> 'blueprintKey'
      );
    end if;

    expected_type := case
      when draft ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.pool_schedule_next_7_days'
      ) then 'sport_program'
      when draft ->> 'blueprintKey' in (
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days',
        'sportlink.pool_results_previous_7_days'
      ) then 'sport_results'
      when draft ->> 'blueprintKey' = 'sportlink.pool_standings'
        then 'sport_standing'
      when draft ->> 'blueprintKey' = 'sportlink.visitor_arrivals'
        then 'sport_visitor_arrivals'
      else 'sport_referee_arrivals'
    end;
    select template.slide_type
    into actual_type
    from public.dynamic_template_versions version
    join public.dynamic_templates template
      on template.id = version.template_id
    where version.id = (draft ->> 'templateVersionId')::uuid
      and version.status = 'published'
      and template.status = 'published'
      and template.orientation = draft ->> 'orientation';
    if actual_type is distinct from expected_type then
      raise exception 'template does not match Sportlink blueprint'
        using errcode = '23514';
    end if;

    result := public.create_dynamic_slide_v1(
      p_tenant_id,
      draft ->> 'name',
      (draft ->> 'templateVersionId')::uuid,
      p_data_source_id,
      'latest',
      jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion', 1,
        'blueprintKey', draft ->> 'blueprintKey',
        'title', draft ->> 'title',
        'context', case when is_arrival
          then team_contexts -> 0
          else draft -> 'context'
        end,
        'teamContexts', case when is_arrival then team_contexts end,
        'arrival', case when is_arrival then arrival_config end,
        'display', display_config,
        'editorial', jsonb_build_object(
          'schemaVersion', 2,
          'themeSelection', selection
        ),
        'maxItems', 40
      )) || case
        when is_arrival then jsonb_build_object(
          'context', team_contexts -> 0,
          'teamContexts', team_contexts
        )
        else '{}'::jsonb
      end
    );
    results := results || jsonb_build_array(jsonb_build_object(
      'slideId', result ->> 'slideId',
      'snapshotId', result ->> 'snapshotId',
      'name', draft ->> 'name',
      'blueprintKey', draft ->> 'blueprintKey',
      'teamCount', jsonb_array_length(team_contexts)
    ));
  end loop;

  result := jsonb_build_object(
    'batchId', batch_id,
    'slides', results,
    'count', jsonb_array_length(results)
  );
  update public.sportlink_slide_batches
  set result_json = result
  where id = batch_id;
  perform private.audit_event(
    p_tenant_id,
    'sportlink.slide_batch.created',
    'sportlink_slide_batches',
    batch_id,
    'success',
    jsonb_build_object(
      'count', jsonb_array_length(results),
      'dataSourceId', p_data_source_id,
      'themeId', p_drafts #>> '{0,themeSelection,ref,id}',
      'aggregateArrivals', cardinality(seen_arrival_keys)
    )
  );
  return result;
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v3(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v3(
  uuid, uuid, jsonb, uuid
) to authenticated;

-- The screen fleet only needs the newest assignable release per live playlist
-- plus immutable releases that are still referenced. Selecting the entire
-- release history can otherwise exhaust PostgREST's row cap for long-running
-- dynamic playlists before another playlist is represented.
create function public.list_screen_fleet_releases_v1(
  p_tenant_id uuid
)
returns table (
  id uuid,
  playlist_id uuid,
  version integer,
  published_at timestamptz,
  release_notes text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest_release as (
    select distinct on (release.playlist_id)
      release.id,
      release.playlist_id,
      release.version,
      release.published_at,
      release.release_notes
    from public.playlist_releases release
    join public.playlists playlist
      on playlist.tenant_id = release.tenant_id
     and playlist.id = release.playlist_id
     and playlist.status <> 'archived'
    where release.tenant_id = p_tenant_id
    order by
      release.playlist_id,
      release.version desc,
      release.published_at desc,
      release.id desc
  ), referenced_release_id as (
    select screen.assigned_release_id as id
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.deleted_at is null
      and screen.assigned_release_id is not null
    union
    select screen.default_release_id
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.deleted_at is null
      and screen.default_release_id is not null
    union
    select device.active_release_id
    from public.player_devices device
    where device.tenant_id = p_tenant_id
      and device.status = 'paired'
      and device.active_release_id is not null
    union
    select device.desired_release_id
    from public.player_devices device
    where device.tenant_id = p_tenant_id
      and device.status = 'paired'
      and device.desired_release_id is not null
    union
    select screen_group.default_release_id
    from public.screen_groups screen_group
    where screen_group.tenant_id = p_tenant_id
      and screen_group.status = 'active'
      and screen_group.default_release_id is not null
    union
    select schedule.release_id
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and schedule.enabled
      and (schedule.ends_at is null or schedule.ends_at >= now())
  ), referenced_release as (
    select
      release.id,
      release.playlist_id,
      release.version,
      release.published_at,
      release.release_notes
    from referenced_release_id referenced
    join public.playlist_releases release
      on release.tenant_id = p_tenant_id
     and release.id = referenced.id
  )
  select projection.id,
         projection.playlist_id,
         projection.version,
         projection.published_at,
         projection.release_notes
  from (
    select * from latest_release
    union
    select * from referenced_release
  ) projection
  order by projection.published_at desc, projection.id desc
$$;

revoke all on function public.list_screen_fleet_releases_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_screen_fleet_releases_v1(uuid)
  to authenticated;

-- Dynamic content used to publish synchronously for every completed render.
-- A durable per-playlist queue coalesces bursts, bounds automatic publication
-- to one batch per five minutes and keeps the most recent request from being
-- lost when several renders finish concurrently.
create table private.dynamic_release_refresh_queue (
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  playlist_id uuid not null,
  pending boolean not null default true,
  first_requested_at timestamptz,
  last_requested_at timestamptz,
  not_before timestamptz,
  last_published_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, playlist_id),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id) on delete cascade,
  check (
    (pending and first_requested_at is not null
      and last_requested_at is not null and not_before is not null)
    or (not pending and first_requested_at is null
      and last_requested_at is null and not_before is null)
  )
);

create index dynamic_release_refresh_queue_due_idx
  on private.dynamic_release_refresh_queue(not_before, tenant_id, playlist_id)
  where pending;

revoke all on table private.dynamic_release_refresh_queue
  from public, anon, authenticated, service_role;

create index if not exists screens_dynamic_default_release_idx
  on public.screens(tenant_id, default_playlist_id, default_release_id, id)
  where status <> 'disabled' and default_release_id is not null;

drop trigger if exists dynamic_slide_auto_publishes_latest
  on public.dynamic_slides;

create function private.enqueue_dynamic_release_refresh_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_at timestamptz := clock_timestamp();
  target record;
begin
  if new.selection_mode <> 'latest'
    or new.current_snapshot_id is null
    or new.current_snapshot_id is not distinct from old.current_snapshot_id
    or not exists (
      select 1
      from public.dynamic_slide_snapshots snapshot
      where snapshot.tenant_id = new.tenant_id
        and snapshot.id = new.current_snapshot_id
        and snapshot.status = 'ready'
        and snapshot.output_media_asset_id is not null
    )
  then
    return new;
  end if;

  for target in
    select distinct release.playlist_id
    from public.screens screen
    join public.playlist_releases release
      on release.tenant_id = screen.tenant_id
     and release.id = screen.default_release_id
    join public.playlist_release_items release_item
      on release_item.tenant_id = release.tenant_id
     and release_item.release_id = release.id
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.playlists playlist
      on playlist.tenant_id = release.tenant_id
     and playlist.id = release.playlist_id
     and playlist.status <> 'archived'
    join public.tenants tenant
      on tenant.id = release.tenant_id
     and tenant.status = 'active'
    where screen.tenant_id = new.tenant_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and released_snapshot.dynamic_slide_id = new.id
    order by release.playlist_id
  loop
    insert into private.dynamic_release_refresh_queue (
      tenant_id,
      playlist_id,
      pending,
      first_requested_at,
      last_requested_at,
      not_before,
      last_published_at,
      attempt_count,
      last_error_code,
      updated_at
    )
    select
      new.tenant_id,
      target.playlist_id,
      true,
      requested_at,
      requested_at,
      greatest(
        coalesce(max(release.published_at) + interval '5 minutes',
          '-infinity'::timestamptz),
        requested_at + interval '30 seconds'
      ),
      max(release.published_at),
      0,
      null,
      requested_at
    from public.playlist_releases release
    where release.tenant_id = new.tenant_id
      and release.playlist_id = target.playlist_id
    on conflict (tenant_id, playlist_id) do update
    set
      pending = true,
      first_requested_at = case
        when private.dynamic_release_refresh_queue.pending
          then private.dynamic_release_refresh_queue.first_requested_at
        else requested_at
      end,
      last_requested_at = requested_at,
      not_before = greatest(
        case
          when private.dynamic_release_refresh_queue.pending
            and private.dynamic_release_refresh_queue.attempt_count > 0
          then private.dynamic_release_refresh_queue.not_before
          else '-infinity'::timestamptz
        end,
        coalesce(
          private.dynamic_release_refresh_queue.last_published_at
            + interval '5 minutes',
          '-infinity'::timestamptz
        ),
        least(
          requested_at + interval '30 seconds',
          case
            when private.dynamic_release_refresh_queue.pending
              then private.dynamic_release_refresh_queue.first_requested_at
            else requested_at
          end + interval '5 minutes'
        )
      ),
      attempt_count = case
        when private.dynamic_release_refresh_queue.pending
          then private.dynamic_release_refresh_queue.attempt_count
        else 0
      end,
      last_error_code = case
        when private.dynamic_release_refresh_queue.pending
          then private.dynamic_release_refresh_queue.last_error_code
        else null
      end,
      updated_at = requested_at;
  end loop;
  return new;
end;
$$;

revoke all on function private.enqueue_dynamic_release_refresh_v1()
  from public, anon, authenticated, service_role;

create trigger dynamic_slide_auto_publishes_latest
after update of current_snapshot_id on public.dynamic_slides
for each row execute function private.enqueue_dynamic_release_refresh_v1();

-- An automatic release clones an exact immutable branch. Provider bindings
-- therefore arrive as a complete frozen tuple with no mutable source item.
-- Manual publication still resolves the tuple from its source item, while a
-- clone must never search a different historical branch or re-read provider
-- metadata that may have changed since the target branch was published.
create or replace function private.materialize_youtube_release_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_item_id is null then
    return new;
  end if;

  select item.youtube_source_id into new.youtube_source_id
  from public.playlist_items item
  where item.tenant_id = new.tenant_id
    and item.playlist_id = new.playlist_id
    and item.id = new.source_item_id;

  if new.youtube_source_id is not null then
    select source.video_id, source.title, source.online_only
    into new.youtube_video_id, new.youtube_title, new.youtube_online_only
    from public.youtube_sources source
    where source.tenant_id = new.tenant_id
      and source.id = new.youtube_source_id
      and source.status = 'active'
      and source.validation_status = 'verified'
      and source.embeddable is true;
    if not found then
      raise exception 'youtube source is not verified for playback'
        using errcode = '23514';
    end if;
  else
    new.youtube_video_id := null;
    new.youtube_title := null;
    new.youtube_online_only := null;
  end if;
  return new;
end;
$$;

create or replace function private.materialize_engage_release_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_item_id is null then
    return new;
  end if;

  select item.engage_campaign_id into new.engage_campaign_id
  from public.playlist_items item
  where item.tenant_id = new.tenant_id
    and item.playlist_id = new.playlist_id
    and item.id = new.source_item_id;

  if new.engage_campaign_id is not null then
    select campaign.public_id, campaign.title, campaign.question
    into new.engage_public_id, new.engage_title, new.engage_question
    from public.engage_campaigns campaign
    where campaign.tenant_id = new.tenant_id
      and campaign.id = new.engage_campaign_id
      and campaign.status in ('scheduled', 'live', 'closed');
    if not found then
      raise exception 'engage campaign is not publishable'
        using errcode = '23514';
    end if;
  else
    new.engage_public_id := null;
    new.engage_title := null;
    new.engage_question := null;
  end if;
  return new;
end;
$$;

-- `now()` is transaction-stable, so multiple snapshots created by one sync can
-- share an identical timestamp. A database-owned sequence records the real
-- insertion order for snapshots created after this migration. Existing
-- snapshots stay byte-for-byte untouched and use the created_at/id fallback
-- below; immutable history must never be rewritten for an ordering backfill.
alter table public.dynamic_slide_snapshots
  add column snapshot_sequence bigint;

create sequence private.dynamic_slide_snapshot_sequence_v1
  as bigint
  minvalue 1
  start with 1
  increment by 1
  no cycle;

revoke all on sequence private.dynamic_slide_snapshot_sequence_v1
  from public, anon, authenticated, service_role;

create or replace function private.assign_dynamic_snapshot_sequence_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.snapshot_sequence is not null then
    raise exception 'dynamic snapshot sequence is database-owned'
      using errcode = '23514';
  end if;
  new.snapshot_sequence := pg_catalog.nextval(
    'private.dynamic_slide_snapshot_sequence_v1'::pg_catalog.regclass
  );
  return new;
end;
$$;

revoke all on function private.assign_dynamic_snapshot_sequence_v1()
  from public, anon, authenticated, service_role;

create trigger dynamic_snapshots_assign_sequence
before insert on public.dynamic_slide_snapshots
for each row execute function private.assign_dynamic_snapshot_sequence_v1();

-- Queued/rendering snapshots may update their lifecycle fields, but their
-- insertion order is immutable from the moment the row exists.
create trigger dynamic_snapshots_reject_sequence_update
before update of snapshot_sequence on public.dynamic_slide_snapshots
for each row when (
  new.snapshot_sequence is distinct from old.snapshot_sequence
)
execute function private.reject_dynamic_immutable_mutation();

create unique index dynamic_slide_snapshots_sequence_key
  on public.dynamic_slide_snapshots(snapshot_sequence)
  where snapshot_sequence is not null;

-- Content-addressed fallback assets may legitimately be shared by multiple
-- slides. Preserve explicitly supplied or existing provenance before falling
-- back to another matching ready snapshot, otherwise one slide can silently
-- stop following its own updates.
create or replace function private.resolve_dynamic_playlist_item_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_snapshot_id uuid;
  resolved_slide_id uuid;
  resolved_selection_mode text;
  has_complete_provenance boolean :=
    new.dynamic_slide_id is not null
    and new.dynamic_snapshot_id is not null
    and new.dynamic_selection_mode is not null;
  has_any_provenance boolean :=
    new.dynamic_slide_id is not null
    or new.dynamic_snapshot_id is not null
    or new.dynamic_selection_mode is not null;
begin
  if has_any_provenance and not has_complete_provenance then
    raise exception 'dynamic playlist provenance is incomplete'
      using errcode = '23514';
  end if;

  if has_complete_provenance then
    if not exists (
      select 1
      from public.dynamic_slide_snapshots snapshot
      join public.dynamic_slides slide
        on slide.tenant_id = snapshot.tenant_id
       and slide.id = snapshot.dynamic_slide_id
      where snapshot.tenant_id = new.tenant_id
        and snapshot.id = new.dynamic_snapshot_id
        and snapshot.dynamic_slide_id = new.dynamic_slide_id
        and snapshot.status = 'ready'
        and snapshot.output_media_asset_id = new.media_asset_id
        and slide.selection_mode = new.dynamic_selection_mode
    ) then
      raise exception 'dynamic playlist provenance does not match media'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.media_asset_id is not distinct from old.media_asset_id
    and old.dynamic_slide_id is not null
    and old.dynamic_snapshot_id is not null
    and old.dynamic_selection_mode is not null
  then
    new.dynamic_slide_id := old.dynamic_slide_id;
    new.dynamic_snapshot_id := old.dynamic_snapshot_id;
    new.dynamic_selection_mode := old.dynamic_selection_mode;
    return new;
  end if;

  -- Legacy image-only selections have no logical identity to preserve. Resolve
  -- those deterministically, but never use this ambiguous path for an explicit
  -- or already established dynamic tuple.
  select
    snapshot.id,
    snapshot.dynamic_slide_id,
    slide.selection_mode
  into
    resolved_snapshot_id,
    resolved_slide_id,
    resolved_selection_mode
  from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slides slide
    on slide.tenant_id = snapshot.tenant_id
   and slide.id = snapshot.dynamic_slide_id
  where snapshot.tenant_id = new.tenant_id
    and snapshot.output_media_asset_id = new.media_asset_id
    and snapshot.status = 'ready'
  order by
    exists (
      select 1
      from public.playlist_items established_item
      where established_item.tenant_id = new.tenant_id
        and established_item.playlist_id = new.playlist_id
        and established_item.media_asset_id = new.media_asset_id
        and established_item.dynamic_slide_id = snapshot.dynamic_slide_id
        and (
          tg_op <> 'UPDATE'
          or established_item.id <> old.id
        )
    ) desc,
    (slide.current_snapshot_id = snapshot.id) desc,
    snapshot.snapshot_sequence desc nulls last,
    snapshot.created_at desc,
    snapshot.id desc
  limit 1;

  if resolved_snapshot_id is not null then
    new.dynamic_slide_id := resolved_slide_id;
    new.dynamic_snapshot_id := resolved_snapshot_id;
    new.dynamic_selection_mode := resolved_selection_mode;
  else
    new.dynamic_slide_id := null;
    new.dynamic_snapshot_id := null;
    new.dynamic_selection_mode := null;
  end if;
  return new;
end;
$$;

revoke all on function private.resolve_dynamic_playlist_item_provenance()
  from public, anon, authenticated, service_role;

-- Render workers can finish snapshots out of order. Only promote a completed
-- snapshot when it is still the newest ready snapshot for a slide that follows
-- latest content; an older slow render must never move the live pointer back.
create or replace function public.complete_dynamic_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.dynamic_render_jobs%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  slide_record public.dynamic_slides%rowtype;
  expected_path text;
begin
  select * into job_record
  from public.dynamic_render_jobs
  where id = p_job_id
    and status = 'rendering'
    and locked_by = left(p_worker_id, 120)
  for update;
  if not found then
    raise exception 'dynamic render lease lost' using errcode = '55000';
  end if;
  select * into snapshot_record
  from public.dynamic_slide_snapshots
  where id = job_record.snapshot_id;
  select * into slide_record
  from public.dynamic_slides
  where id = snapshot_record.dynamic_slide_id;

  expected_path := 'tenants/' || job_record.tenant_id::text || '/assets/' ||
    job_record.output_media_asset_id::text || '/dynamic-slide.png';
  if p_storage_path <> expected_path
    or p_file_size_bytes not between 1 and 524288000
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_width not between 360 and 7680
    or p_height not between 360 and 4320
  then
    raise exception 'invalid dynamic render artifact' using errcode = '22023';
  end if;

  insert into public.media_assets(
    id,
    tenant_id,
    created_by,
    kind,
    title,
    original_file_name,
    mime_type,
    status,
    storage_bucket,
    storage_path,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    processed_at
  ) values (
    job_record.output_media_asset_id,
    job_record.tenant_id,
    snapshot_record.created_by,
    'image',
    slide_record.name,
    'dynamic-slide.png',
    'image/png',
    'ready',
    'tenant-media',
    p_storage_path,
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height,
    now()
  ) on conflict (id) do nothing;

  if not exists (
    select 1
    from public.media_assets asset
    where asset.id = job_record.output_media_asset_id
      and asset.tenant_id = job_record.tenant_id
      and asset.kind = 'image'
      and asset.status = 'ready'
      and asset.storage_bucket = 'tenant-media'
      and asset.storage_path = p_storage_path
      and asset.mime_type = 'image/png'
      and asset.file_size_bytes = p_file_size_bytes
      and asset.checksum_sha256 = p_checksum_sha256
      and asset.width = p_width
      and asset.height = p_height
  ) then
    raise exception 'dynamic fallback identity collision' using errcode = '23514';
  end if;

  insert into public.media_variants(
    tenant_id,
    asset_id,
    variant_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height
  ) values (
    job_record.tenant_id,
    job_record.output_media_asset_id,
    'original',
    'tenant-media',
    p_storage_path,
    'image/png',
    p_file_size_bytes,
    p_checksum_sha256,
    p_width,
    p_height
  ) on conflict (tenant_id, asset_id, variant_type) do nothing;

  if not exists (
    select 1
    from public.media_variants variant
    where variant.tenant_id = job_record.tenant_id
      and variant.asset_id = job_record.output_media_asset_id
      and variant.variant_type = 'original'
      and variant.storage_bucket = 'tenant-media'
      and variant.storage_path = p_storage_path
      and variant.mime_type = 'image/png'
      and variant.file_size_bytes = p_file_size_bytes
      and variant.checksum_sha256 = p_checksum_sha256
      and variant.width = p_width
      and variant.height = p_height
  ) then
    raise exception 'dynamic fallback variant collision' using errcode = '23514';
  end if;

  update public.dynamic_slide_snapshots
  set status = 'ready',
      output_media_asset_id = job_record.output_media_asset_id,
      completed_at = now()
  where id = snapshot_record.id;
  update public.dynamic_render_jobs
  set status = 'completed',
      finished_at = now(),
      locked_at = null,
      locked_by = null
  where id = job_record.id;
  update public.dynamic_slides slide
  set status = 'ready',
      current_snapshot_id = snapshot_record.id,
      last_error_code = null
  where slide.id = slide_record.id
    and (
      slide.current_snapshot_id is null
      or slide.current_snapshot_id = snapshot_record.id
      or (
        slide.selection_mode = 'latest'
        and not exists (
          select 1
          from public.dynamic_slide_snapshots current_snapshot
          where current_snapshot.tenant_id = slide.tenant_id
            and current_snapshot.id = slide.current_snapshot_id
            and current_snapshot.status = 'ready'
            and current_snapshot.output_media_asset_id is not null
            and (
              (
                current_snapshot.snapshot_sequence is not null
                and snapshot_record.snapshot_sequence is not null
                and current_snapshot.snapshot_sequence >
                  snapshot_record.snapshot_sequence
              )
              or (
                current_snapshot.snapshot_sequence is not null
                and snapshot_record.snapshot_sequence is null
              )
              or (
                current_snapshot.snapshot_sequence is null
                and snapshot_record.snapshot_sequence is null
                and (current_snapshot.created_at, current_snapshot.id) >
                  (snapshot_record.created_at, snapshot_record.id)
              )
            )
        )
      )
    );
  insert into public.audit_events(
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) values (
    job_record.tenant_id,
    snapshot_record.created_by,
    'dynamic.render.completed',
    'dynamic_slide_snapshots',
    snapshot_record.id,
    'success',
    jsonb_build_object(
      'systemExecuted', true,
      'jobId', job_record.id,
      'mediaAssetId', job_record.output_media_asset_id,
      'checksum', p_checksum_sha256,
      'contentAddressed', true
    )
  );
  return job_record.output_media_asset_id;
end;
$$;

revoke all on function public.complete_dynamic_render_job_v1(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.complete_dynamic_render_job_v1(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer
) to service_role;

-- The regular fleet screens intentionally show only a playlist's current
-- release. These commands lock that playlist and verify the exact release
-- that was preflighted, while Release Center keeps using the historical
-- reassignment command for explicit rollback.
create function public.assign_current_playlist_release_v1(
  p_playlist_id uuid,
  p_expected_release_id uuid,
  p_screen_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  current_release_id uuid;
  normalized_screen_ids uuid[];
  request_json jsonb;
  replay jsonb;
  target_count integer;
  target_snapshot_id uuid;
  outcome jsonb;
begin
  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'current playlist is unavailable' using errcode = '23514';
  end if;
  if private.current_user_id() is null
    or not private.can_publish_playlist(playlist_record.tenant_id)
  then
    raise exception 'actor cannot assign this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);

  select array_agg(screen_id order by screen_id)
  into normalized_screen_ids
  from (select distinct unnest(p_screen_ids) as screen_id) targets;
  if coalesce(array_length(normalized_screen_ids, 1), 0) = 0
    or array_length(normalized_screen_ids, 1) > 250
  then
    raise exception 'bulk screen target count is invalid' using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedReleaseId', p_expected_release_id,
    'screenIds', to_jsonb(normalized_screen_ids)
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'screens.current_playlist.assign.v1',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.status = 'archived' then
    raise exception 'current playlist is unavailable' using errcode = '23514';
  end if;
  select release.id into current_release_id
  from public.playlist_releases release
  where release.tenant_id = playlist_record.tenant_id
    and release.playlist_id = playlist_record.id
  order by release.version desc, release.id desc
  limit 1;
  if current_release_id is null then
    raise exception 'current playlist has no release' using errcode = '23514';
  end if;
  if current_release_id is distinct from p_expected_release_id then
    raise exception 'current playlist release changed' using errcode = '40001';
  end if;

  perform 1
  from public.screens screen
  where screen.tenant_id = playlist_record.tenant_id
    and screen.id = any(normalized_screen_ids)
  order by screen.id
  for update;
  select count(*)::integer into target_count
  from public.screens screen
  where screen.tenant_id = playlist_record.tenant_id
    and screen.id = any(normalized_screen_ids)
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  if target_count <> array_length(normalized_screen_ids, 1) then
    raise exception 'one or more target screens are unavailable'
      using errcode = '23514';
  end if;

  target_snapshot_id := private.create_publisher_target_snapshot(
    playlist_record.tenant_id,
    current_release_id,
    null,
    'direct',
    null,
    normalized_screen_ids,
    private.current_user_id()
  );
  update public.screens screen
  set active_assignment_source = 'default',
      active_schedule_id = null,
      active_target_snapshot_id = target_snapshot_id,
      default_playlist_id = playlist_record.id,
      default_release_id = current_release_id,
      assigned_playlist_id = playlist_record.id,
      assigned_release_id = current_release_id
  where screen.tenant_id = playlist_record.tenant_id
    and screen.id = any(normalized_screen_ids);
  update public.player_devices device
  set desired_release_id = current_release_id
  where device.tenant_id = playlist_record.tenant_id
    and device.screen_id = any(normalized_screen_ids)
    and device.status = 'paired';
  insert into public.release_screen_assignments (
    tenant_id, release_id, screen_id, assignment_kind,
    assigned_by, target_snapshot_id
  )
  select
    playlist_record.tenant_id,
    current_release_id,
    screen_id,
    'reassigned',
    private.current_user_id(),
    target_snapshot_id
  from unnest(normalized_screen_ids) screen_id;

  outcome := jsonb_build_object(
    'outcome', 'reassigned',
    'releaseId', current_release_id,
    'targetCount', target_count,
    'targetSnapshotId', target_snapshot_id
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'screens.current_playlist.assign.v1',
    p_idempotency_key,
    request_json,
    'playlist_releases',
    current_release_id,
    outcome,
    'publisher.screens.current_playlist_assigned'
  );
end;
$$;

create function public.create_screen_from_current_release_v1(
  p_tenant_id uuid,
  p_name text,
  p_location text,
  p_orientation text,
  p_resolution_width integer,
  p_resolution_height integer,
  p_initial_release_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  release_playlist_id uuid;
  current_release_id uuid;
begin
  if private.current_user_id() is null
    or not private.can_manage_screens(p_tenant_id)
  then
    raise exception 'actor cannot manage screens for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if p_initial_release_id is not null then
    select release.playlist_id into release_playlist_id
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.id = p_initial_release_id;
    if not found then
      raise exception 'initial release is unavailable' using errcode = '23514';
    end if;

    select playlist.* into playlist_record
    from public.playlists playlist
    where playlist.tenant_id = p_tenant_id
      and playlist.id = release_playlist_id
    for update;
    if not found or playlist_record.status = 'archived' then
      raise exception 'initial release is unavailable' using errcode = '23514';
    end if;

    select release.id into current_release_id
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.playlist_id = release_playlist_id
    order by release.version desc, release.id desc
    limit 1;
    if current_release_id is distinct from p_initial_release_id then
      raise exception 'initial release is not current' using errcode = '40001';
    end if;
  end if;

  return public.create_screen_v1(
    p_tenant_id,
    p_name,
    p_location,
    p_orientation,
    p_resolution_width,
    p_resolution_height,
    p_initial_release_id
  );
end;
$$;

revoke all on function public.assign_current_playlist_release_v1(
  uuid, uuid, uuid[], uuid
) from public, anon, authenticated, service_role;
grant execute on function public.assign_current_playlist_release_v1(
  uuid, uuid, uuid[], uuid
) to authenticated;
revoke all on function public.create_screen_from_current_release_v1(
  uuid, text, text, text, integer, integer, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_screen_from_current_release_v1(
  uuid, text, text, text, integer, integer, uuid
) to authenticated;

create function private.publish_queued_dynamic_release_v1(
  p_tenant_id uuid,
  p_playlist_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  playlist_record public.playlists%rowtype;
  next_version integer;
  new_release_id uuid;
  release_published_at timestamptz;
  manifest_items jsonb;
  manifest_document jsonb;
  manifest_hash text;
  total_bytes bigint;
  active_screen_ids uuid[];
  target_snapshot_id uuid;
  replaced_item_count integer;
  published_count integer := 0;
  resolved_snapshot_by_sort_order jsonb;
begin
  -- Serialize against manual publication before resolving any default release
  -- branch. Under READ COMMITTED the following SELECT then sees the branch
  -- committed by a publisher that held this playlist lock first.
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.tenant_id = p_tenant_id
    and playlist.id = p_playlist_id
    and playlist.status <> 'archived'
  for update;
  if not found then
    return 0;
  end if;

  -- Release reassignment updates screen defaults without taking the playlist
  -- lock. Lock the existing playlist topology in the same deterministic order
  -- used by the publisher before opening the branch cursor below.
  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = p_playlist_id
    and screen.deleted_at is null
  order by screen.id
  for update;

  perform 1
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
   and screen.id = device.screen_id
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = p_playlist_id
    and screen.active_assignment_source = 'default'
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and device.status = 'paired'
    and exists (
      select 1
      from public.playlist_release_items release_item
      join public.dynamic_slide_snapshots released_snapshot
        on released_snapshot.tenant_id = release_item.tenant_id
       and released_snapshot.id = release_item.dynamic_snapshot_id
      join public.dynamic_slides slide
        on slide.tenant_id = released_snapshot.tenant_id
       and slide.id = released_snapshot.dynamic_slide_id
       and slide.selection_mode = 'latest'
      where release_item.tenant_id = screen.tenant_id
        and release_item.release_id = screen.default_release_id
    )
  order by device.id
  for update of device;

  for target in
    select distinct
      release.id,
      release.tenant_id,
      release.playlist_id,
      release.version,
      release.manifest_json,
      release.item_count,
      release.total_duration_seconds
    from public.screens screen
    join public.playlist_releases release
      on release.tenant_id = screen.tenant_id
     and release.id = screen.default_release_id
    join public.playlist_release_items release_item
      on release_item.tenant_id = release.tenant_id
     and release_item.release_id = release.id
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
     and slide.id = released_snapshot.dynamic_slide_id
     and slide.selection_mode = 'latest'
    join public.tenants tenant
      on tenant.id = release.tenant_id
     and tenant.status = 'active'
    where screen.tenant_id = p_tenant_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and release.playlist_id = p_playlist_id
      and exists (
        select 1
        from public.screens paired_screen
        join public.player_devices paired_device
          on paired_device.tenant_id = paired_screen.tenant_id
         and paired_device.screen_id = paired_screen.id
         and paired_device.status = 'paired'
        where paired_screen.tenant_id = release.tenant_id
          and paired_screen.default_playlist_id = release.playlist_id
          and paired_screen.default_release_id = release.id
          and paired_screen.active_assignment_source = 'default'
          and paired_screen.status <> 'disabled'
          and paired_screen.deleted_at is null
          and paired_device.active_release_id = paired_screen.default_release_id
      )
    order by release.version, release.id
  loop
    -- Stabilize the exact default-screen branch before checking and replacing
    -- it, so a concurrent manual assignment is never overwritten.
    perform 1
    from public.screens screen
    where screen.tenant_id = target.tenant_id
      and screen.default_playlist_id = target.playlist_id
      and screen.default_release_id = target.id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
    order by screen.id
    for update;

    if not exists (
      select 1
      from public.screens screen
      where screen.tenant_id = target.tenant_id
        and screen.default_playlist_id = target.playlist_id
        and screen.default_release_id = target.id
        and screen.status <> 'disabled'
        and screen.deleted_at is null
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.playlist_release_items release_item
      join public.dynamic_slide_snapshots released_snapshot
        on released_snapshot.tenant_id = release_item.tenant_id
       and released_snapshot.id = release_item.dynamic_snapshot_id
      join public.dynamic_slides slide
        on slide.tenant_id = released_snapshot.tenant_id
       and slide.id = released_snapshot.dynamic_slide_id
       and slide.selection_mode = 'latest'
      join public.dynamic_slide_snapshots candidate_snapshot
        on candidate_snapshot.tenant_id = slide.tenant_id
       and candidate_snapshot.dynamic_slide_id = slide.id
      join public.dynamic_render_jobs render_job
        on render_job.tenant_id = candidate_snapshot.tenant_id
       and render_job.snapshot_id = candidate_snapshot.id
       and render_job.status in ('queued', 'rendering')
      where release_item.tenant_id = target.tenant_id
        and release_item.release_id = target.id
    ) then
      continue;
    end if;

    -- Freeze the complete latest-snapshot choice once. A later render may
    -- update a slide while this immutable release is being materialized; its
    -- queue upsert then waits and schedules a subsequent coalesced batch.
    select coalesce(
      jsonb_object_agg(
        release_item.sort_order::text,
        to_jsonb(current_snapshot.id)
      ) filter (where current_snapshot.id is not null),
      '{}'::jsonb
    )
    into resolved_snapshot_by_sort_order
    from public.playlist_release_items release_item
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
     and slide.id = released_snapshot.dynamic_slide_id
     and slide.selection_mode = 'latest'
    join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = slide.tenant_id
     and current_snapshot.id = slide.current_snapshot_id
     and current_snapshot.status = 'ready'
     and current_snapshot.output_media_asset_id is not null
    where release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id;

    select count(*)::integer
    into replaced_item_count
    from public.playlist_release_items release_item
    where release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id
      and resolved_snapshot_by_sort_order ? release_item.sort_order::text
      and (resolved_snapshot_by_sort_order ->> release_item.sort_order::text)::uuid
        is distinct from release_item.dynamic_snapshot_id;
    if replaced_item_count = 0 then
      continue;
    end if;

    select
      jsonb_agg(
        case
          when current_snapshot.id is not null
            and current_snapshot.id <> released_snapshot.id
          then manifest_item.value || jsonb_build_object(
            'mediaAssetId', current_asset.id,
            'mediaVariantId', current_variant.id,
            'kind', current_asset.kind,
            'title', current_asset.title,
            'storage', jsonb_build_object(
              'bucket', current_variant.storage_bucket,
              'path', current_variant.storage_path,
              'mimeType', current_variant.mime_type,
              'bytes', current_variant.file_size_bytes,
              'checksumSha256', current_variant.checksum_sha256
            ),
            'metadata', coalesce(
              manifest_item.value -> 'metadata',
              '{}'::jsonb
            ) || jsonb_strip_nulls(jsonb_build_object(
              'width', current_variant.width,
              'height', current_variant.height,
              'durationSeconds', current_variant.duration_seconds
            ))
          )
          else manifest_item.value
        end
        order by manifest_item.ordinality
      ),
      sum(
        case
          when current_snapshot.id is not null
            and current_snapshot.id <> released_snapshot.id
          then current_variant.file_size_bytes
          else release_item.file_size_bytes
        end
      )::bigint
    into manifest_items, total_bytes
    from jsonb_array_elements(target.manifest_json -> 'items')
      with ordinality as manifest_item(value, ordinality)
    join public.playlist_release_items release_item
      on release_item.tenant_id = target.tenant_id
     and release_item.release_id = target.id
     and release_item.sort_order = manifest_item.ordinality - 1
    left join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    left join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = release_item.tenant_id
     and current_snapshot.id = (
       resolved_snapshot_by_sort_order ->> release_item.sort_order::text
     )::uuid
     and current_snapshot.status = 'ready'
     and current_snapshot.output_media_asset_id is not null
    left join public.media_assets current_asset
      on current_asset.tenant_id = current_snapshot.tenant_id
     and current_asset.id = current_snapshot.output_media_asset_id
     and current_asset.status = 'ready'
     and current_asset.deleted_at is null
    left join public.media_variants current_variant
      on current_variant.tenant_id = current_asset.tenant_id
     and current_variant.asset_id = current_asset.id
     and current_variant.variant_type = 'original';

    if manifest_items is null or total_bytes is null then
      continue;
    end if;

    select coalesce(max(release.version), 0) + 1
    into next_version
    from public.playlist_releases release
    where release.tenant_id = target.tenant_id
      and release.playlist_id = target.playlist_id;
    release_published_at := clock_timestamp();
    manifest_document := target.manifest_json || jsonb_build_object(
      'version', next_version,
      'publishedAt', release_published_at,
      'totalBytes', total_bytes,
      'items', manifest_items
    );
    manifest_hash := encode(
      extensions.digest(
        pg_catalog.convert_to(manifest_document::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    insert into public.playlist_releases (
      tenant_id, playlist_id, version, release_notes, manifest_hash,
      manifest_json, item_count, total_duration_seconds, total_bytes,
      published_by, published_at
    ) values (
      target.tenant_id, target.playlist_id, next_version,
      'Automatische dynamische vernieuwing', manifest_hash,
      manifest_document, target.item_count, target.total_duration_seconds,
      total_bytes, null, release_published_at
    ) returning id into new_release_id;

    insert into public.playlist_release_items (
      tenant_id, playlist_id, release_id, source_item_id,
      media_asset_id, media_variant_id, sort_order, duration_seconds,
      fit_mode, muted, asset_kind, asset_title, storage_bucket, storage_path,
      mime_type, file_size_bytes, checksum_sha256, width, height,
      asset_duration_seconds, dynamic_snapshot_id,
      youtube_source_id, youtube_video_id, youtube_title, youtube_online_only,
      engage_campaign_id, engage_public_id, engage_title, engage_question,
      display_title, transition,
      crop_focus_x, crop_focus_y, background_color, volume_percent,
      trim_start_seconds, trim_end_seconds, visible_from, visible_until,
      enabled, accessibility_name, section_source_id, section_name,
      section_position_key
    )
    select
      release_item.tenant_id,
      release_item.playlist_id,
      new_release_id,
      null,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.id else release_item.media_asset_id end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.id else release_item.media_variant_id end,
      release_item.sort_order,
      release_item.duration_seconds,
      release_item.fit_mode,
      release_item.muted,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.kind else release_item.asset_kind end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_asset.title else release_item.asset_title end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.storage_bucket else release_item.storage_bucket end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.storage_path else release_item.storage_path end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.mime_type else release_item.mime_type end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.file_size_bytes else release_item.file_size_bytes end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.checksum_sha256 else release_item.checksum_sha256 end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.width else release_item.width end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.height else release_item.height end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_variant.duration_seconds
        else release_item.asset_duration_seconds end,
      case when current_snapshot.id is not null
        and current_snapshot.id <> released_snapshot.id
        then current_snapshot.id else release_item.dynamic_snapshot_id end,
      release_item.youtube_source_id,
      release_item.youtube_video_id,
      release_item.youtube_title,
      release_item.youtube_online_only,
      release_item.engage_campaign_id,
      release_item.engage_public_id,
      release_item.engage_title,
      release_item.engage_question,
      release_item.display_title,
      release_item.transition,
      release_item.crop_focus_x,
      release_item.crop_focus_y,
      release_item.background_color,
      release_item.volume_percent,
      release_item.trim_start_seconds,
      release_item.trim_end_seconds,
      release_item.visible_from,
      release_item.visible_until,
      release_item.enabled,
      release_item.accessibility_name,
      release_item.section_source_id,
      release_item.section_name,
      release_item.section_position_key
    from public.playlist_release_items release_item
    left join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    left join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.tenant_id = release_item.tenant_id
     and current_snapshot.id = (
       resolved_snapshot_by_sort_order ->> release_item.sort_order::text
     )::uuid
     and current_snapshot.status = 'ready'
     and current_snapshot.output_media_asset_id is not null
    left join public.media_assets current_asset
      on current_asset.tenant_id = current_snapshot.tenant_id
     and current_asset.id = current_snapshot.output_media_asset_id
     and current_asset.status = 'ready'
     and current_asset.deleted_at is null
    left join public.media_variants current_variant
      on current_variant.tenant_id = current_asset.tenant_id
     and current_variant.asset_id = current_asset.id
     and current_variant.variant_type = 'original'
    where release_item.tenant_id = target.tenant_id
      and release_item.release_id = target.id
    order by release_item.sort_order;

    insert into public.playlist_release_authoring_snapshots (
      tenant_id, playlist_id, release_id, snapshot_json, snapshot_hash
    )
    select
      snapshot.tenant_id, snapshot.playlist_id, new_release_id,
      snapshot.snapshot_json, snapshot.snapshot_hash
    from public.playlist_release_authoring_snapshots snapshot
    where snapshot.tenant_id = target.tenant_id
      and snapshot.release_id = target.id
    on conflict do nothing;

    select array_agg(screen.id order by screen.id)
    into active_screen_ids
    from public.screens screen
    where screen.tenant_id = target.tenant_id
      and screen.default_playlist_id = target.playlist_id
      and screen.default_release_id = target.id
      and screen.active_assignment_source = 'default'
      and screen.status <> 'disabled'
      and screen.deleted_at is null;

    update public.screens screen
    set default_release_id = new_release_id
    where screen.tenant_id = target.tenant_id
      and screen.default_playlist_id = target.playlist_id
      and screen.default_release_id = target.id
      and screen.status <> 'disabled'
      and screen.deleted_at is null;

    target_snapshot_id := null;
    if coalesce(array_length(active_screen_ids, 1), 0) > 0 then
      target_snapshot_id := private.create_publisher_target_snapshot(
        target.tenant_id,
        new_release_id,
        null,
        'direct',
        null,
        active_screen_ids,
        null
      );
      update public.screens screen
      set
        assigned_playlist_id = target.playlist_id,
        assigned_release_id = new_release_id,
        active_target_snapshot_id = target_snapshot_id
      where screen.tenant_id = target.tenant_id
        and screen.id = any(active_screen_ids);
      update public.player_devices device
      set desired_release_id = new_release_id
      where device.tenant_id = target.tenant_id
        and device.screen_id = any(active_screen_ids)
        and device.status = 'paired';
      insert into public.release_screen_assignments (
        tenant_id, release_id, screen_id, assignment_kind,
        assigned_by, target_snapshot_id
      )
      select
        target.tenant_id, new_release_id, screen_id, 'reassigned',
        null, target_snapshot_id
      from unnest(active_screen_ids) screen_id;
    end if;

    insert into public.audit_events (
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      target.tenant_id,
      'dynamic.release.auto_published',
      'playlist_releases',
      new_release_id,
      'success',
      jsonb_build_object(
        'systemExecuted', true,
        'playlistId', target.playlist_id,
        'baseReleaseId', target.id,
        'version', next_version,
        'replacedItemCount', replaced_item_count,
        'activeScreenCount',
          coalesce(array_length(active_screen_ids, 1), 0),
        'coalesced', true
      )
    );
    published_count := published_count + 1;
  end loop;
  return published_count;
end;
$$;

revoke all on function private.publish_queued_dynamic_release_v1(uuid, uuid)
  from public, anon, authenticated, service_role;

create function private.process_dynamic_release_refresh_v1(
  p_tenant_id uuid,
  p_playlist_id uuid,
  p_worker_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queue_record private.dynamic_release_refresh_queue%rowtype;
  published_count integer := 0;
  failure_code text;
  retry_seconds integer;
  latest_release_published_at timestamptz;
begin
  select queue.*
  into queue_record
  from private.dynamic_release_refresh_queue queue
  where queue.tenant_id = p_tenant_id
    and queue.playlist_id = p_playlist_id
    and queue.pending
    and queue.not_before <= clock_timestamp()
  for update skip locked;
  if not found then
    return 0;
  end if;

  -- Keep every lock, topology and materialization failure inside the durable
  -- queue state machine. The renderer invokes this function with a short lock
  -- timeout; contention before publication must therefore receive the same
  -- bounded retry/backoff as a materialization failure instead of being
  -- swallowed by the render-claim isolation boundary.
  begin

  -- Match the publisher lock order. Once held, pairing, revocation,
  -- heartbeats and default-screen reassignment cannot invalidate the
  -- acknowledgement decision between this check and branch materialization.
  perform 1
  from public.playlists playlist
  where playlist.tenant_id = p_tenant_id
    and playlist.id = p_playlist_id
  for update;
  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = p_playlist_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
  order by screen.id
  for update;
  perform 1
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
   and screen.id = device.screen_id
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = p_playlist_id
    and screen.active_assignment_source = 'default'
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and device.status = 'paired'
    and exists (
      select 1
      from public.playlist_release_items release_item
      join public.dynamic_slide_snapshots released_snapshot
        on released_snapshot.tenant_id = release_item.tenant_id
       and released_snapshot.id = release_item.dynamic_snapshot_id
      join public.dynamic_slides slide
        on slide.tenant_id = released_snapshot.tenant_id
       and slide.id = released_snapshot.dynamic_slide_id
       and slide.selection_mode = 'latest'
      where release_item.tenant_id = screen.tenant_id
        and release_item.release_id = screen.default_release_id
    )
  order by device.id
  for update of device;

  if not exists (
    select 1
    from public.screens screen
    join public.playlists playlist
      on playlist.tenant_id = screen.tenant_id
     and playlist.id = screen.default_playlist_id
     and playlist.status <> 'archived'
    join public.tenants tenant
      on tenant.id = screen.tenant_id
     and tenant.status = 'active'
    join public.playlist_release_items release_item
      on release_item.tenant_id = screen.tenant_id
     and release_item.release_id = screen.default_release_id
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
     and slide.id = released_snapshot.dynamic_slide_id
     and slide.selection_mode = 'latest'
    where screen.tenant_id = p_tenant_id
      and screen.default_playlist_id = p_playlist_id
      and screen.default_release_id is not null
      and screen.status <> 'disabled'
      and screen.deleted_at is null
  ) then
    update private.dynamic_release_refresh_queue
    set pending = false,
        first_requested_at = null,
        last_requested_at = null,
        not_before = null,
        attempt_count = 0,
        last_error_code = null,
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    return 0;
  end if;

  select max(release.published_at)
  into latest_release_published_at
  from public.playlist_releases release
  where release.tenant_id = p_tenant_id
    and release.playlist_id = p_playlist_id;
  if latest_release_published_at is not null
    and latest_release_published_at > coalesce(
      queue_record.last_published_at,
      '-infinity'::timestamptz
    )
    and latest_release_published_at + interval '5 minutes'
      > clock_timestamp()
  then
    update private.dynamic_release_refresh_queue
    set last_published_at = latest_release_published_at,
        not_before = latest_release_published_at + interval '5 minutes',
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    return 0;
  end if;

  -- Never create an endless immutable backlog for an unused/offline screen.
  -- Keep exactly one pending request until at least one default-source Player
  -- is paired and every such Player has acknowledged the previous release.
  if not exists (
    select 1
    from public.screens screen
    join public.player_devices device
      on device.tenant_id = screen.tenant_id
     and device.screen_id = screen.id
     and device.status = 'paired'
    where screen.tenant_id = p_tenant_id
      and screen.default_playlist_id = p_playlist_id
      and screen.active_assignment_source = 'default'
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and exists (
        select 1
        from public.playlist_release_items release_item
        join public.dynamic_slide_snapshots released_snapshot
          on released_snapshot.tenant_id = release_item.tenant_id
         and released_snapshot.id = release_item.dynamic_snapshot_id
        join public.dynamic_slides slide
          on slide.tenant_id = released_snapshot.tenant_id
         and slide.id = released_snapshot.dynamic_slide_id
         and slide.selection_mode = 'latest'
        where release_item.tenant_id = screen.tenant_id
          and release_item.release_id = screen.default_release_id
      )
  ) or exists (
    select 1
    from public.screens screen
    join public.player_devices device
      on device.tenant_id = screen.tenant_id
     and device.screen_id = screen.id
     and device.status = 'paired'
    where screen.tenant_id = p_tenant_id
      and screen.default_playlist_id = p_playlist_id
      and screen.active_assignment_source = 'default'
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and exists (
        select 1
        from public.playlist_release_items release_item
        join public.dynamic_slide_snapshots released_snapshot
          on released_snapshot.tenant_id = release_item.tenant_id
         and released_snapshot.id = release_item.dynamic_snapshot_id
        join public.dynamic_slides slide
          on slide.tenant_id = released_snapshot.tenant_id
         and slide.id = released_snapshot.dynamic_slide_id
         and slide.selection_mode = 'latest'
        where release_item.tenant_id = screen.tenant_id
          and release_item.release_id = screen.default_release_id
      )
      and device.active_release_id is distinct from screen.default_release_id
  ) then
    update private.dynamic_release_refresh_queue
    set not_before = clock_timestamp() + interval '30 seconds',
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    return 0;
  end if;

  if exists (
    select 1
    from public.screens screen
    join public.playlist_releases release
      on release.tenant_id = screen.tenant_id
     and release.id = screen.default_release_id
    join public.playlist_release_items release_item
      on release_item.tenant_id = release.tenant_id
     and release_item.release_id = release.id
    join public.dynamic_slide_snapshots released_snapshot
      on released_snapshot.tenant_id = release_item.tenant_id
     and released_snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slides slide
      on slide.tenant_id = released_snapshot.tenant_id
     and slide.id = released_snapshot.dynamic_slide_id
     and slide.selection_mode = 'latest'
    join public.dynamic_slide_snapshots candidate_snapshot
      on candidate_snapshot.tenant_id = slide.tenant_id
     and candidate_snapshot.dynamic_slide_id = slide.id
    join public.dynamic_render_jobs render_job
      on render_job.tenant_id = candidate_snapshot.tenant_id
     and render_job.snapshot_id = candidate_snapshot.id
     and render_job.status in ('queued', 'rendering')
    where screen.tenant_id = p_tenant_id
      and screen.default_playlist_id = p_playlist_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and exists (
        select 1
        from public.screens paired_screen
        join public.player_devices paired_device
          on paired_device.tenant_id = paired_screen.tenant_id
         and paired_device.screen_id = paired_screen.id
         and paired_device.status = 'paired'
        where paired_screen.tenant_id = screen.tenant_id
          and paired_screen.default_playlist_id = screen.default_playlist_id
          and paired_screen.default_release_id = screen.default_release_id
          and paired_screen.active_assignment_source = 'default'
          and paired_screen.status <> 'disabled'
          and paired_screen.deleted_at is null
          and paired_device.active_release_id = paired_screen.default_release_id
      )
  ) then
    update private.dynamic_release_refresh_queue
    set not_before = clock_timestamp() + interval '30 seconds',
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    return 0;
  end if;

  begin
    published_count := private.publish_queued_dynamic_release_v1(
      p_tenant_id,
      p_playlist_id
    );
  exception when others then
    get stacked diagnostics failure_code = returned_sqlstate;
    retry_seconds := least(
      900,
      30 * (2 ^ least(queue_record.attempt_count, 5))::integer
    );
    update private.dynamic_release_refresh_queue
    set attempt_count = attempt_count + 1,
        last_error_code = left(coalesce(failure_code, 'P0001'), 32),
        not_before = clock_timestamp() + make_interval(secs => retry_seconds),
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    insert into public.audit_events (
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      p_tenant_id,
      'dynamic.release.refresh_failed',
      'playlists',
      p_playlist_id,
      'failed',
      jsonb_build_object(
        'systemExecuted', true,
        'workerId', left(coalesce(p_worker_id, 'dynamic-worker'), 120),
        'errorCode', left(coalesce(failure_code, 'P0001'), 32),
        'retrySeconds', retry_seconds
      )
    );
    return 0;
  end;

  update private.dynamic_release_refresh_queue
  set pending = false,
      first_requested_at = null,
      last_requested_at = null,
      not_before = null,
      last_published_at = case
        when published_count > 0 then clock_timestamp()
        else last_published_at
      end,
      attempt_count = 0,
      last_error_code = null,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and playlist_id = p_playlist_id;
  return published_count;
  exception when others then
    get stacked diagnostics failure_code = returned_sqlstate;
    retry_seconds := least(
      900,
      30 * (2 ^ least(queue_record.attempt_count, 5))::integer
    );
    update private.dynamic_release_refresh_queue
    set attempt_count = attempt_count + 1,
        last_error_code = left(coalesce(failure_code, 'P0001'), 32),
        not_before = clock_timestamp() + make_interval(secs => retry_seconds),
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and playlist_id = p_playlist_id;
    insert into public.audit_events (
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      p_tenant_id,
      'dynamic.release.refresh_failed',
      'playlists',
      p_playlist_id,
      'failed',
      jsonb_build_object(
        'systemExecuted', true,
        'workerId', left(coalesce(p_worker_id, 'dynamic-worker'), 120),
        'errorCode', left(coalesce(failure_code, 'P0001'), 32),
        'retrySeconds', retry_seconds
      )
    );
    return 0;
  end;
end;
$$;

revoke all on function private.process_dynamic_release_refresh_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create function private.process_due_dynamic_release_refresh_v1(
  p_worker_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_tenant_id uuid;
  candidate_playlist_id uuid;
begin
  select queue.tenant_id, queue.playlist_id
  into candidate_tenant_id, candidate_playlist_id
  from private.dynamic_release_refresh_queue queue
  where queue.pending
    and queue.not_before <= clock_timestamp()
  order by queue.not_before, queue.tenant_id, queue.playlist_id
  for update skip locked
  limit 1;
  if not found then
    return 0;
  end if;

  return private.process_dynamic_release_refresh_v1(
    candidate_tenant_id,
    candidate_playlist_id,
    p_worker_id
  );
end;
$$;

revoke all on function private.process_due_dynamic_release_refresh_v1(text)
  from public, anon, authenticated, service_role;

-- The dynamic renderer already polls this service-role-only command while
-- idle. Drain at most one due playlist first. Queue errors and lock waits are
-- isolated so release maintenance can never take render claiming down.
create or replace function public.claim_dynamic_render_job_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 120,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  tenant_id uuid,
  snapshot_id uuid,
  output_media_asset_id uuid,
  slide_name text,
  orientation text,
  markup text,
  css text,
  manifest_json jsonb,
  snapshot_data_json jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_lock_timeout text := current_setting('lock_timeout');
  expired_snapshot_ids uuid[];
begin
  begin
    perform set_config('lock_timeout', '1s', true);
    perform private.process_due_dynamic_release_refresh_v1(p_worker_id);
    perform set_config('lock_timeout', previous_lock_timeout, true);
  exception when others then
    perform set_config('lock_timeout', previous_lock_timeout, true);
  end;

  -- A worker crash on the last allowed attempt must not leave a permanent
  -- `rendering` blocker in the automatic release queue. Preserve any existing
  -- ready snapshot while terminalizing only leases owned by this reaper pass.
  with expired as (
    update public.dynamic_render_jobs job
    set status = 'failed',
        finished_at = clock_timestamp(),
        locked_at = null,
        locked_by = null,
        error_code = 'render_lease_expired',
        error_detail = 'Render worker lease expired after the final attempt.'
    where job.status = 'rendering'
      and job.locked_at < clock_timestamp() - make_interval(
        secs => least(greatest(p_lock_timeout_seconds, 30), 600)
      )
      and job.attempt_count >= least(
        greatest(p_max_attempts, 1),
        job.max_attempts
      )
    returning job.snapshot_id
  )
  select array_agg(expired.snapshot_id order by expired.snapshot_id)
  into expired_snapshot_ids
  from expired;

  update public.dynamic_slide_snapshots snapshot
  set status = 'failed',
      error_code = 'render_lease_expired',
      error_detail = 'Render worker lease expired after the final attempt.'
  where snapshot.id = any(expired_snapshot_ids)
    and snapshot.status = 'rendering';

  update public.dynamic_slides slide
  set status = case
        when slide.current_snapshot_id is null then 'error'
        else 'ready'
      end,
      last_error_code = 'render_lease_expired'
  where exists (
    select 1
    from public.dynamic_slide_snapshots failed_snapshot
    where failed_snapshot.id = any(expired_snapshot_ids)
      and failed_snapshot.tenant_id = slide.tenant_id
      and failed_snapshot.dynamic_slide_id = slide.id
  );

  update public.dynamic_render_jobs job
  set status = 'queued',
      locked_at = null,
      locked_by = null
  where job.status = 'rendering'
    and job.locked_at < now() - make_interval(
      secs => least(greatest(p_lock_timeout_seconds, 30), 600)
    )
    and job.attempt_count < least(
      greatest(p_max_attempts, 1),
      job.max_attempts
    );

  return query
  with candidate as (
    select job.id
    from public.dynamic_render_jobs job
    where job.status = 'queued'
      and job.attempt_count < least(
        greatest(p_max_attempts, 1),
        job.max_attempts
      )
    order by job.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.dynamic_render_jobs job
    set status = 'rendering',
        attempt_count = attempt_count + 1,
        locked_at = now(),
        locked_by = left(p_worker_id, 120),
        started_at = coalesce(started_at, now()),
        error_code = null,
        error_detail = null
    from candidate
    where job.id = candidate.id
    returning job.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    snapshot.id,
    claimed.output_media_asset_id,
    slide.name,
    slide.orientation,
    version.markup,
    version.css,
    version.manifest_json,
    snapshot.snapshot_data_json
  from claimed
  join public.dynamic_slide_snapshots snapshot
    on snapshot.id = claimed.snapshot_id
  join public.dynamic_slides slide
    on slide.id = snapshot.dynamic_slide_id
  join public.dynamic_template_versions version
    on version.id = snapshot.template_version_id;

  update public.dynamic_slide_snapshots snapshot
  set status = 'rendering'
  where snapshot.id in (
    select job.snapshot_id
    from public.dynamic_render_jobs job
    where job.status = 'rendering'
      and job.locked_by = left(p_worker_id, 120)
  )
    and snapshot.status = 'queued';
end;
$$;

revoke all on function public.claim_dynamic_render_job_v1(
  text, integer, integer
) from public, anon, authenticated, service_role;

grant execute on function public.claim_dynamic_render_job_v1(
  text, integer, integer
) to service_role;

drop function private.publish_latest_dynamic_snapshot_v1();
