-- S90: selectable Sportlink standings context, retained seasons, a trusted
-- standings HTML/CSS template, and an opt-in five-minute sync cadence.

alter table public.sportlink_sync_policies
  drop constraint sportlink_sync_policies_frequency_check;
alter table public.sportlink_sync_policies
  add constraint sportlink_sync_policies_frequency_check
  check (
    frequency in (
      'five_minutes',
      'hourly',
      'daily',
      'weekly',
      'monthly'
    )
  );

create or replace function private.sportlink_next_sync_at(
  p_frequency text,
  p_from timestamptz default now()
) returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'five_minutes' then p_from + interval '5 minutes'
    when 'hourly' then p_from + interval '1 hour'
    when 'daily' then p_from + interval '1 day'
    when 'weekly' then p_from + interval '7 days'
    when 'monthly' then p_from + interval '1 month'
    else p_from + interval '1 day'
  end
$$;

create or replace function public.update_sportlink_sync_policy_v1(
  p_connection_id uuid,
  p_dataset_group text,
  p_frequency text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select *
  into connection
  from public.sportlink_connections
  where id = p_connection_id;

  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id,
    'tenant.data_source.manage'
  ) and not private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'sportlink_policy_manage_required' using errcode = '42501';
  end if;
  if p_frequency not in (
    'five_minutes',
    'hourly',
    'daily',
    'weekly',
    'monthly'
  ) then
    raise exception 'sportlink_frequency_invalid' using errcode = '22023';
  end if;
  if p_dataset_group not in (
    'club_profile',
    'teams',
    'competitions',
    'matches',
    'match_details',
    'activities',
    'public_people',
    'volunteers'
  ) then
    raise exception 'sportlink_dataset_group_invalid' using errcode = '22023';
  end if;
  if p_enabled
    and p_dataset_group in ('public_people', 'volunteers')
    and not connection.privacy_people_enabled
  then
    raise exception 'sportlink_privacy_opt_in_required' using errcode = '42501';
  end if;

  update public.sportlink_sync_policies
  set frequency = p_frequency,
      enabled = p_enabled,
      next_sync_at = case
        when p_enabled then least(next_sync_at, now())
        else next_sync_at
      end
  where connection_id = connection.id
    and dataset_group = p_dataset_group;

  perform private.audit_event(
    connection.tenant_id,
    'sportlink.sync_policy.updated',
    'sportlink_connections',
    connection.id,
    'success',
    jsonb_build_object(
      'datasetGroup', p_dataset_group,
      'frequency', p_frequency,
      'enabled', p_enabled
    )
  );
end
$$;

alter table public.sports_standings
  add column season_key text not null default 'unknown';

alter table public.sports_standings
  drop constraint sports_standings_tenant_id_source_connection_id_external_id_key;

alter table public.sports_standings
  add constraint sports_standings_source_external_season_key
  unique (
    tenant_id,
    source_connection_id,
    external_id,
    season_key
  );

create index sports_standings_context_idx
  on public.sports_standings(
    tenant_id,
    source_connection_id,
    season_key,
    last_synced_at desc
  )
  where active;

alter function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
)
rename to complete_sportlink_sync_before_standing_history_v1;

create or replace function public.complete_sportlink_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_activities jsonb default '[]'::jsonb,
  p_standings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  sync_result jsonb;
  standing_item jsonb;
  standing_read_count integer := 0;
  standing_season text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select *
  into sync_run
  from public.sportlink_sync_runs
  where id = p_run_id
  for update;

  if sync_run.id is null then
    raise exception 'sportlink_sync_run_not_found' using errcode = 'P0002';
  end if;
  if sync_run.status <> 'running'
    or sync_run.worker_id is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'sportlink_sync_lease_not_owned' using errcode = '42501';
  end if;

  for standing_item in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_standings) = 'array' then p_standings
        else '[]'::jsonb
      end
    )
  loop
    if nullif(standing_item ->> 'externalId', '') is null
      or nullif(standing_item -> 'pool' ->> 'externalId', '') is null
    then
      continue;
    end if;

    standing_season := coalesce(
      nullif(standing_item -> 'competition' ->> 'season', ''),
      'unknown'
    );

    insert into public.sports_standings (
      tenant_id,
      source_connection_id,
      external_id,
      pool_external_id,
      period_number,
      rows_json,
      scores_published,
      last_synced_at,
      active,
      metadata,
      season_key
    ) values (
      sync_run.tenant_id,
      sync_run.connection_id,
      standing_item ->> 'externalId',
      standing_item -> 'pool' ->> 'externalId',
      nullif(standing_item ->> 'periodNumber', '')::integer,
      coalesce(standing_item -> 'rows', '[]'::jsonb),
      coalesce(
        (standing_item ->> 'scoresPublished')::boolean,
        false
      ),
      now(),
      true,
      jsonb_strip_nulls(jsonb_build_object(
        'competition', standing_item -> 'competition',
        'pool', standing_item -> 'pool',
        'season', nullif(standing_season, 'unknown')
      )),
      standing_season
    )
    on conflict (
      tenant_id,
      source_connection_id,
      external_id,
      season_key
    ) do update
    set pool_external_id = excluded.pool_external_id,
        period_number = excluded.period_number,
        rows_json = excluded.rows_json,
        scores_published = excluded.scores_published,
        last_synced_at = now(),
        active = true,
        metadata = excluded.metadata;

    standing_read_count := standing_read_count + 1;
  end loop;

  sync_result :=
    public.complete_sportlink_sync_before_standing_history_v1(
      p_run_id,
      p_worker_id,
      p_club,
      p_teams,
      p_matches,
      p_activities,
      '[]'::jsonb
    );

  update public.sportlink_sync_runs
  set read_count = coalesce(read_count, 0) + standing_read_count
  where id = p_run_id;

  return sync_result || jsonb_build_object(
    'readCount',
    coalesce((sync_result ->> 'readCount')::integer, 0)
      + standing_read_count
  );
end
$$;

revoke all on function public.complete_sportlink_sync_before_standing_history_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_standing_context;

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
  selected_standing public.sports_standings%rowtype;
  selected_team_external_id text := nullif(
    p_slide.configuration_json ->> 'sportTeamExternalId',
    ''
  );
  selected_competition_external_id text := nullif(
    p_slide.configuration_json ->> 'sportCompetitionExternalId',
    ''
  );
  selected_season text := nullif(
    p_slide.configuration_json ->> 'sportSeason',
    ''
  );
  max_items integer := least(greatest(
    coalesce((p_slide.configuration_json ->> 'maxItems')::integer, 40),
    1
  ), 40);
  title text := coalesce(
    nullif(p_slide.configuration_json ->> 'title', ''),
    p_slide.name
  );
  primary_color text;
begin
  if p_slide.slide_type not in (
    'sport_standing',
    'sport_period_standing'
  ) then
    return private.build_dynamic_snapshot_data_before_standing_context(
      p_slide
    );
  end if;

  select standing.*
  into selected_standing
  from public.sports_standings standing
  join public.sportlink_connections connection
    on connection.id = standing.source_connection_id
   and connection.tenant_id = standing.tenant_id
  where standing.tenant_id = p_slide.tenant_id
    and connection.data_source_id = p_slide.data_source_id
    and standing.active
    and (
      p_slide.slide_type <> 'sport_period_standing'
      or standing.period_number is not null
    )
    and (
      selected_team_external_id is null
      or exists (
        select 1
        from jsonb_array_elements(standing.rows_json) row
        where row ->> 'externalId' = selected_team_external_id
      )
    )
    and (
      selected_competition_external_id is null
      or standing.metadata -> 'competition' ->> 'externalId' =
        selected_competition_external_id
      or standing.metadata -> 'pool' ->> 'competitionExternalId' =
        selected_competition_external_id
    )
    and (
      selected_season is null
      or standing.season_key = selected_season
    )
  order by
    case when selected_season is null then
      coalesce(
        nullif(
          regexp_replace(standing.season_key, '[^0-9]', '', 'g'),
          ''
        )::numeric,
        0
      )
    end desc,
    standing.last_synced_at desc
  limit 1;

  select settings.primary_color
  into primary_color
  from public.tenant_settings settings
  where settings.tenant_id = p_slide.tenant_id;

  result := jsonb_build_object(
    'type', p_slide.slide_type,
    'sport', jsonb_strip_nulls(jsonb_build_object(
      'title', title,
      'generatedAt', now(),
      'selectedTeamExternalId', selected_team_external_id,
      'season', nullif(selected_standing.season_key, 'unknown'),
      'competition', selected_standing.metadata -> 'competition',
      'pool', selected_standing.metadata -> 'pool',
      'items', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', row ->> 'externalId',
          'position', nullif(row ->> 'position', '')::integer,
          'teamName', row ->> 'teamName',
          'played', nullif(row ->> 'played', '')::integer,
          'won', nullif(row ->> 'won', '')::integer,
          'drawn', nullif(row ->> 'drawn', '')::integer,
          'lost', nullif(row ->> 'lost', '')::integer,
          'form', coalesce(
            nullif(
              case
                when jsonb_typeof(row -> 'form') = 'array'
                  then row -> 'form'
                else '[]'::jsonb
              end,
              '[]'::jsonb
            ),
            (
              select jsonb_agg(
                recent_match.result
                order by recent_match.starts_at
              )
              from (
                select
                  match.starts_at,
                  case
                    when
                      (match.home_team ->> 'score')::integer =
                      (match.away_team ->> 'score')::integer
                      then 'draw'
                    when
                      (
                        match.home_team ->> 'externalId' =
                          row ->> 'externalId'
                        or (
                          nullif(match.home_team ->> 'externalId', '') is null
                          and lower(match.home_team ->> 'name') =
                            lower(row ->> 'teamName')
                        )
                      )
                      then case
                        when
                          (match.home_team ->> 'score')::integer >
                          (match.away_team ->> 'score')::integer
                          then 'win'
                        else 'loss'
                      end
                    else case
                      when
                        (match.away_team ->> 'score')::integer >
                        (match.home_team ->> 'score')::integer
                        then 'win'
                      else 'loss'
                    end
                  end as result
                from public.sports_matches match
                where match.tenant_id = p_slide.tenant_id
                  and match.source_connection_id =
                    selected_standing.source_connection_id
                  and match.active
                  and match.status = 'finished'
                  and match.scores_published
                  and nullif(match.home_team ->> 'score', '') is not null
                  and nullif(match.away_team ->> 'score', '') is not null
                  and (
                    match.home_team ->> 'externalId' =
                      row ->> 'externalId'
                    or match.away_team ->> 'externalId' =
                      row ->> 'externalId'
                    or (
                      nullif(match.home_team ->> 'externalId', '') is null
                      and lower(match.home_team ->> 'name') =
                        lower(row ->> 'teamName')
                    )
                    or (
                      nullif(match.away_team ->> 'externalId', '') is null
                      and lower(match.away_team ->> 'name') =
                        lower(row ->> 'teamName')
                    )
                  )
                  and (
                    match.competition ->> 'externalId' =
                      selected_standing.metadata
                        -> 'competition' ->> 'externalId'
                    or match.pool ->> 'externalId' =
                      selected_standing.pool_external_id
                  )
                order by match.starts_at desc
                limit 3
              ) recent_match
            ),
            '[]'::jsonb
          ),
          'goalsFor', nullif(row ->> 'goalsFor', '')::integer,
          'goalsAgainst', nullif(row ->> 'goalsAgainst', '')::integer,
          'goalDifference',
            coalesce(nullif(row ->> 'goalsFor', '')::integer, 0)
            - coalesce(nullif(row ->> 'goalsAgainst', '')::integer, 0),
          'points', nullif(row ->> 'points', '')::integer,
          'selected',
            row ->> 'externalId' = selected_team_external_id,
          'primary', concat_ws(
            '. ',
            nullif(row ->> 'position', ''),
            row ->> 'teamName'
          ),
          'secondary', coalesce(row ->> 'played', '0') || ' gespeeld',
          'meta', coalesce(row ->> 'points', '0') || ' pt',
          'status', 'published'
        )) order by coalesce((row ->> 'position')::integer, 999))
        from (
          select row
          from jsonb_array_elements(
            coalesce(selected_standing.rows_json, '[]'::jsonb)
          ) row
          order by coalesce((row ->> 'position')::integer, 999)
          limit max_items
        ) bounded_rows
      ), '[]'::jsonb),
      'emptyStateCode', case
        when selected_standing.id is null
          or not selected_standing.scores_published
          then 'STANDINGS_NOT_PUBLISHED'
        else null
      end,
      'expiresAt', null
    )),
    'brand', jsonb_build_object(
      'primaryColor', coalesce(primary_color, '#FF5C20')
    )
  );

  return result;
end
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_standing_context(
  public.dynamic_slides
) from public, anon, authenticated;

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
  selected_season text := nullif(
    p_configuration_json ->> 'sportSeason',
    ''
  );
  supports_match_context boolean;
  supports_standing_context boolean;
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

  supports_match_context := selected_slide_type in (
    'sport_program',
    'sport_results',
    'sport_match_of_the_day',
    'sport_next_match',
    'sport_cancellations',
    'sport_dressing_rooms',
    'sport_officials'
  );
  supports_standing_context := selected_slide_type in (
    'sport_standing',
    'sport_period_standing'
  );

  if (
    selected_team_external_id is not null
    or selected_competition_external_id is not null
    or selected_season is not null
  ) and not (supports_match_context or supports_standing_context) then
    raise exception 'Sportlink selection does not match slide type'
      using errcode = '23514';
  end if;
  if selected_season is not null and not supports_standing_context then
    raise exception 'Sportlink season does not match slide type'
      using errcode = '23514';
  end if;
  if length(selected_team_external_id) > 240
    or length(selected_competition_external_id) > 240
    or length(selected_season) > 240
  then
    raise exception 'Sportlink selection is invalid'
      using errcode = '22023';
  end if;

  if supports_match_context
    and selected_team_external_id is not null
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

  if supports_standing_context and not exists (
    select 1
    from public.sports_standings standing
    join public.sportlink_connections connection
      on connection.id = standing.source_connection_id
     and connection.tenant_id = standing.tenant_id
    where standing.tenant_id = p_tenant_id
      and connection.data_source_id = p_data_source_id
      and standing.active
      and (
        selected_team_external_id is null
        or exists (
          select 1
          from jsonb_array_elements(standing.rows_json) row
          where row ->> 'externalId' = selected_team_external_id
        )
      )
      and (
        selected_competition_external_id is null
        or standing.metadata -> 'competition' ->> 'externalId' =
          selected_competition_external_id
        or standing.metadata -> 'pool' ->> 'competitionExternalId' =
          selected_competition_external_id
      )
      and (
        selected_season is null
        or standing.season_key = selected_season
      )
  ) then
    raise exception 'Sportlink standing selection is unavailable'
      using errcode = '23514';
  end if;

  if supports_match_context
    and selected_competition_external_id is not null
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
end
$$;

revoke all on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) from public, anon;
revoke all on function public.create_dynamic_slide_before_sport_selection_v1(
  uuid, text, uuid, uuid, text, jsonb
) from service_role;
grant execute on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) to authenticated, service_role;

create or replace function private.refresh_standing_slides_after_primary_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.primary_color is not distinct from old.primary_color
  then
    return new;
  end if;

  update public.dynamic_data_sources source
  set revision = source.revision + 1
  where source.tenant_id = new.tenant_id
    and source.kind = 'sportlink'
    and source.status = 'active'
    and exists (
      select 1
      from public.dynamic_slides slide
      where slide.tenant_id = source.tenant_id
        and slide.data_source_id = source.id
        and slide.slide_type in (
          'sport_standing',
          'sport_period_standing'
        )
        and slide.selection_mode = 'latest'
        and slide.status <> 'archived'
    );
  return new;
end
$$;

revoke all on function private.refresh_standing_slides_after_primary_color()
  from public, anon, authenticated;

create trigger tenant_primary_color_refreshes_standing_slides
after insert or update of primary_color on public.tenant_settings
for each row execute function
  private.refresh_standing_slides_after_primary_color();

do $$
declare
  shape record;
  template_id uuid;
  version_id uuid;
  source_markup text;
  source_css text;
  source_manifest jsonb;
  sample_data jsonb;
begin
  for shape in
    select *
    from (values
      ('landscape', 1920, 1080, 8),
      ('portrait', 1080, 1920, 6)
    ) as value(orientation, canvas_width, canvas_height, page_size)
  loop
    if exists (
      select 1
      from public.dynamic_templates
      where slug =
        'sportlink-standing-club-edition-dark-' || shape.orientation
    ) then
      continue;
    end if;

    source_markup :=
      '<rect class="bg" width="100%" height="100%"/>' ||
      '<rect class="flare" x="0" y="0" width="100%" height="100%"/>' ||
      '<rect class="accent" fill="{{brand.primaryColor}}" x="74" y="54" width="12" height="126" rx="6"/>' ||
      '<text class="eyebrow" fill="{{brand.primaryColor}}" x="122" y="92">COMPETITIE</text>' ||
      '<text class="title" x="122" y="170">{{truncate sport.title "34"}}</text>' ||
      '<text class="context" x="122" y="218">{{truncate sport.season "24"}}</text>' ||
      '<g transform="translate(92 310)">{{#each sport.items}}' ||
      '<g class="item"><text class="rank" fill="{{brand.primaryColor}}" x="0" y="0">{{position}}</text>' ||
      '<text class="primary" x="72" y="0">{{truncate teamName "34"}}</text>' ||
      '<text class="meta" x="' ||
      case when shape.orientation = 'landscape' then '1600' else '820' end ||
      '" y="0" text-anchor="end">{{points}} PNT</text></g>{{/each}}</g>';
    source_css :=
      '.bg{fill:#06090c}.flare{fill:#0d1116}' ||
      '.eyebrow{font:700 24px Arial;letter-spacing:5px}' ||
      '.title{font:700 76px Arial;fill:#fff}.context{font:700 27px Arial;fill:#bbb}' ||
      '.rank{font:700 34px Arial}.primary{font:700 38px Arial;fill:#fff}' ||
      '.meta{font:700 30px Arial;fill:#fff}' ||
      '.item:nth-child(1){transform:translateY(0)}' ||
      '.item:nth-child(2){transform:translateY(92px)}' ||
      '.item:nth-child(3){transform:translateY(184px)}' ||
      '.item:nth-child(4){transform:translateY(276px)}' ||
      '.item:nth-child(5){transform:translateY(368px)}' ||
      '.item:nth-child(6){transform:translateY(460px)}' ||
      '.item:nth-child(7){transform:translateY(552px)}' ||
      '.item:nth-child(8){transform:translateY(644px)}';
    source_manifest := jsonb_build_object(
      'schemaVersion', 1,
      'engine', 'veyocast-safe-template-v1',
      'slideType', 'sport_standing',
      'canvas', jsonb_build_object(
        'width', shape.canvas_width,
        'height', shape.canvas_height
      ),
      'maxCollectionItems', shape.page_size,
      'allowedFields', jsonb_build_array(
        jsonb_build_object(
          'path', 'brand.primaryColor',
          'type', 'string',
          'required', true
        ),
        jsonb_build_object(
          'path', 'sport.title',
          'type', 'string',
          'required', true
        ),
        jsonb_build_object(
          'path', 'sport.season',
          'type', 'string',
          'required', false
        ),
        jsonb_build_object(
          'path', 'sport.items',
          'type', 'string',
          'required', true
        ),
        jsonb_build_object(
          'path', 'sport.items.teamName',
          'type', 'string',
          'required', true
        ),
        jsonb_build_object(
          'path', 'sport.items.position',
          'type', 'number',
          'required', false
        ),
        jsonb_build_object(
          'path', 'sport.items.points',
          'type', 'number',
          'required', false
        )
      )
    );
    sample_data := jsonb_build_object(
      'brand', jsonb_build_object('primaryColor', '#FF5C20'),
      'type', 'sport_standing',
      'sport', jsonb_build_object(
        'title', 'Stand',
        'season', '2026/2027',
        'competition', jsonb_build_object(
          'name', 'Vierde klasse C'
        ),
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', 'club-1',
            'position', 1,
            'teamName', 'VeyoCast 1',
            'played', 18,
            'won', 13,
            'drawn', 3,
            'lost', 2,
            'goalsFor', 47,
            'goalsAgainst', 19,
            'goalDifference', 28,
            'points', 42,
            'selected', true
          )
        )
      )
    );

    insert into public.dynamic_templates(
      slug,
      name,
      description,
      category,
      slide_type,
      orientation,
      status
    ) values (
      'sportlink-standing-club-edition-dark-' || shape.orientation,
      'Competitiestand · clubeditie · ' ||
        case when shape.orientation = 'landscape'
          then 'liggend'
          else 'staand'
        end,
      'Donkere HTML/CSS-competitiestand met volledige statistieken en teamhighlight.',
      'sports',
      'sport_standing',
      shape.orientation,
      'published'
    )
    returning id into template_id;

    insert into public.dynamic_template_versions(
      template_id,
      version,
      status,
      markup,
      css,
      manifest_json,
      sample_data_json,
      source_checksum_sha256,
      published_at
    ) values (
      template_id,
      1,
      'published',
      source_markup,
      source_css,
      source_manifest,
      sample_data,
      encode(extensions.digest(
        pg_catalog.convert_to(
          source_markup || source_css || source_manifest::text,
          'UTF8'
        ),
        'sha256'
      ), 'hex'),
      now()
    )
    returning id into version_id;

    update public.dynamic_templates
    set current_published_version_id = version_id
    where id = template_id;
  end loop;
end
$$;
