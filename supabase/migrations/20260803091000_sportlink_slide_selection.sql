-- Match-driven Sportlink slides can be scoped to a canonical team and/or
-- competition context. The selected identities are validated server-side and
-- frozen into every immutable snapshot.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_sport_selection;

create or replace function private.build_dynamic_snapshot_data(
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
  filtered_sport jsonb;
  max_items integer := least(greatest(
    coalesce((p_slide.configuration_json ->> 'maxItems')::integer, 8),
    1
  ), 40);
  title text := coalesce(
    nullif(p_slide.configuration_json ->> 'title', ''),
    p_slide.name
  );
  selected_team_external_id text := nullif(
    p_slide.configuration_json ->> 'sportTeamExternalId',
    ''
  );
  selected_competition_external_id text := nullif(
    p_slide.configuration_json ->> 'sportCompetitionExternalId',
    ''
  );
  selected_team_name text;
  selected_competition jsonb;
  selected_pool jsonb;
begin
  result :=
    private.build_dynamic_snapshot_data_before_sport_selection(p_slide);

  if p_slide.slide_type not in (
    'sport_program',
    'sport_results',
    'sport_match_of_the_day',
    'sport_next_match',
    'sport_cancellations',
    'sport_dressing_rooms',
    'sport_officials'
  ) or (
    selected_team_external_id is null
    and selected_competition_external_id is null
  ) then
    return result;
  end if;

  if selected_team_external_id is not null then
    select team.name
    into selected_team_name
    from public.sports_teams team
    join public.sportlink_connections connection
      on connection.id = team.source_connection_id
     and connection.tenant_id = team.tenant_id
    where team.tenant_id = p_slide.tenant_id
      and connection.data_source_id = p_slide.data_source_id
      and team.external_id = selected_team_external_id
    order by team.last_synced_at desc
    limit 1;
  end if;

  if selected_competition_external_id is not null then
    select match.competition, match.pool
    into selected_competition, selected_pool
    from public.sports_matches match
    join public.sportlink_connections connection
      on connection.id = match.source_connection_id
     and connection.tenant_id = match.tenant_id
    where match.tenant_id = p_slide.tenant_id
      and connection.data_source_id = p_slide.data_source_id
      and match.competition ->> 'externalId' =
        selected_competition_external_id
    order by match.last_synced_at desc
    limit 1;
  end if;

  select jsonb_build_object(
    'title',
    title,
    'generatedAt',
    now(),
    'selection',
    jsonb_strip_nulls(jsonb_build_object(
      'team',
      case
        when selected_team_external_id is not null then
          jsonb_build_object(
            'externalId',
            selected_team_external_id,
            'name',
            coalesce(selected_team_name, selected_team_external_id)
          )
        else null
      end,
      'competition',
      case
        when selected_competition_external_id is not null then
          jsonb_strip_nulls(jsonb_build_object(
            'externalId',
            selected_competition_external_id,
            'name',
            coalesce(
              selected_competition ->> 'name',
              selected_competition_external_id
            ),
            'type',
            selected_competition ->> 'type',
            'period',
            selected_competition ->> 'period',
            'poolName',
            selected_pool ->> 'name'
          ))
        else null
      end
    )),
    'items',
    coalesce(jsonb_agg(jsonb_build_object(
      'id',
      selected_match.external_id,
      'primary',
      (selected_match.home_team ->> 'name')
        || ' – '
        || (selected_match.away_team ->> 'name'),
      'secondary',
      to_char(
        selected_match.starts_at
          at time zone selected_match.source_timezone,
        'DD-MM-YYYY HH24:MI'
      ),
      'meta',
      case
        when p_slide.slide_type = 'sport_dressing_rooms' then concat_ws(
          ' · ',
          nullif(
            'Thuis '
              || coalesce(selected_match.dressing_rooms ->> 'home', ''),
            'Thuis '
          ),
          nullif(
            'Uit '
              || coalesce(selected_match.dressing_rooms ->> 'away', ''),
            'Uit '
          ),
          nullif(
            'Official '
              || coalesce(selected_match.dressing_rooms ->> 'official', ''),
            'Official '
          )
        )
        when p_slide.slide_type = 'sport_officials' then coalesce(
          (
            select string_agg(person ->> 'displayName', ' · ')
            from jsonb_array_elements(selected_match.officials) person
          ),
          'Nog niet bekend'
        )
        else coalesce(
          selected_match.venue ->> 'field',
          selected_match.venue ->> 'name',
          ''
        )
      end,
      'status',
      case
        when selected_match.status = 'cancelled' then coalesce(
          selected_match.cancellation_reason,
          'Afgelast'
        )
        else selected_match.status
      end
    ) order by selected_match.starts_at), '[]'::jsonb),
    'emptyStateCode',
    case
      when count(*) = 0 then
        case
          when p_slide.slide_type = 'sport_results'
            then 'RESULTS_NOT_PUBLISHED'
          else 'NO_ITEMS_IN_PERIOD'
        end
      else null
    end,
    'expiresAt',
    max(selected_match.expires_at)
  )
  into filtered_sport
  from (
    select match.*, connection.timezone as source_timezone
    from public.sports_matches match
    join public.sportlink_connections connection
      on connection.id = match.source_connection_id
     and connection.tenant_id = match.tenant_id
    where match.tenant_id = p_slide.tenant_id
      and connection.data_source_id = p_slide.data_source_id
      and match.active
      and (
        match.expires_at is null
        or match.expires_at > now()
      )
      and (
        selected_team_external_id is null
        or match.home_team ->> 'externalId' =
          selected_team_external_id
        or match.away_team ->> 'externalId' =
          selected_team_external_id
        or (
          selected_team_name is not null
          and lower(btrim(match.home_team ->> 'name')) =
            lower(btrim(selected_team_name))
        )
        or (
          selected_team_name is not null
          and lower(btrim(match.away_team ->> 'name')) =
            lower(btrim(selected_team_name))
        )
      )
      and (
        selected_competition_external_id is null
        or match.competition ->> 'externalId' =
          selected_competition_external_id
      )
      and case
        when p_slide.slide_type = 'sport_results'
          then match.status = 'finished'
        when p_slide.slide_type = 'sport_cancellations'
          then match.status = 'cancelled'
        when p_slide.slide_type = 'sport_match_of_the_day' then
          match.status in ('scheduled', 'postponed')
          and (
            match.starts_at at time zone connection.timezone
          )::date = (
            now() at time zone connection.timezone
          )::date
        when p_slide.slide_type = 'sport_next_match' then
          match.status in ('scheduled', 'postponed')
          and match.starts_at >= now()
        else
          match.status in ('scheduled', 'postponed')
          and match.starts_at >= (
            date_trunc(
              'day',
              now() at time zone connection.timezone
            ) at time zone connection.timezone
          )
      end
    order by case
      when p_slide.slide_type = 'sport_results'
        then -extract(epoch from match.starts_at)
      else extract(epoch from match.starts_at)
    end
    limit case
      when p_slide.slide_type in (
        'sport_match_of_the_day',
        'sport_next_match'
      ) then 1
      else max_items
    end
  ) selected_match;

  return jsonb_set(
    result,
    '{sport}',
    coalesce(filtered_sport, '{}'::jsonb),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_sport_selection(
  public.dynamic_slides
) from public, anon, authenticated;

alter function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
)
rename to create_dynamic_slide_before_sport_selection_v1;

create or replace function public.create_dynamic_slide_v1(
  p_tenant_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_selection_mode text default 'latest',
  p_configuration_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  selected_slide_type text;
  selected_source_kind text;
  selected_team_external_id text := nullif(
    p_configuration_json ->> 'sportTeamExternalId',
    ''
  );
  selected_competition_external_id text := nullif(
    p_configuration_json ->> 'sportCompetitionExternalId',
    ''
  );
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create dynamic slides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select template.slide_type
  into selected_slide_type
  from public.dynamic_template_versions version
  join public.dynamic_templates template
    on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published';

  select source.kind
  into selected_source_kind
  from public.dynamic_data_sources source
  where source.id = p_data_source_id
    and source.tenant_id = p_tenant_id
    and source.status <> 'archived';

  if selected_slide_type like 'sport\_%' escape '\'
    and selected_source_kind is distinct from 'sportlink'
  then
    raise exception 'sport slide requires Sportlink source'
      using errcode = '23514';
  end if;

  if (
    selected_team_external_id is not null
    or selected_competition_external_id is not null
  ) and selected_slide_type not in (
    'sport_program',
    'sport_results',
    'sport_match_of_the_day',
    'sport_next_match',
    'sport_cancellations',
    'sport_dressing_rooms',
    'sport_officials'
  ) then
    raise exception 'Sportlink selection does not match slide type'
      using errcode = '23514';
  end if;

  if length(selected_team_external_id) > 240
    or length(selected_competition_external_id) > 240
  then
    raise exception 'Sportlink selection is invalid'
      using errcode = '22023';
  end if;

  if selected_team_external_id is not null
    and not exists (
      select 1
      from public.sports_teams team
      join public.sportlink_connections connection
        on connection.id = team.source_connection_id
       and connection.tenant_id = team.tenant_id
      where team.tenant_id = p_tenant_id
        and connection.data_source_id = p_data_source_id
        and team.external_id = selected_team_external_id
        and team.active
    )
  then
    raise exception 'Sportlink team is unavailable'
      using errcode = '23514';
  end if;

  if selected_competition_external_id is not null
    and not exists (
      select 1
      from public.sports_matches match
      join public.sportlink_connections connection
        on connection.id = match.source_connection_id
       and connection.tenant_id = match.tenant_id
      where match.tenant_id = p_tenant_id
        and connection.data_source_id = p_data_source_id
        and match.active
        and match.competition ->> 'externalId' =
          selected_competition_external_id
      union all
      select 1
      from public.sports_teams team
      join public.sportlink_connections connection
        on connection.id = team.source_connection_id
       and connection.tenant_id = team.tenant_id
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(
            team.metadata -> 'competitionOptions'
          ) = 'array'
            then team.metadata -> 'competitionOptions'
          else '[]'::jsonb
        end
      ) competition
      where team.tenant_id = p_tenant_id
        and connection.data_source_id = p_data_source_id
        and team.active
        and competition ->> 'externalId' =
          selected_competition_external_id
    )
  then
    raise exception 'Sportlink competition is unavailable'
      using errcode = '23514';
  end if;

  return public.create_dynamic_slide_before_sport_selection_v1(
    p_tenant_id,
    p_name,
    p_template_version_id,
    p_data_source_id,
    p_selection_mode,
    p_configuration_json
  );
end;
$$;

revoke all on function public.create_dynamic_slide_before_sport_selection_v1(
  uuid, text, uuid, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) from public, anon;

grant execute on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) to authenticated, service_role;
