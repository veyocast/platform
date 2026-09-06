-- S153: theme-scoped presentation settings, immutable forced rollouts,
-- club-wide Sportlink team filters, and guarded slide resource mutations.
-- Historical snapshots and playlist releases remain immutable.

create function private.theme_appearance_settings_is_valid_v1(
  p_appearance jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  font_ref text;
begin
  if pg_catalog.jsonb_typeof(p_appearance) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance)) <> 3
    or not (p_appearance ?& array['schemaVersion', 'surfaces', 'typography'])
    or pg_catalog.jsonb_typeof(
      p_appearance -> 'schemaVersion'
    ) is distinct from 'number'
    or p_appearance ->> 'schemaVersion' <> '1'
    or pg_catalog.jsonb_typeof(p_appearance -> 'surfaces') is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(
      p_appearance -> 'surfaces'
    )) <> 2
    or not ((p_appearance -> 'surfaces') ?& array[
      'clubLogoBackground', 'homeLogoBackground'
    ])
    or coalesce(
      p_appearance #>> '{surfaces,clubLogoBackground}',
      ''
    ) !~* '^#[0-9a-f]{6}$'
    or coalesce(
      p_appearance #>> '{surfaces,homeLogoBackground}',
      ''
    ) !~* '^#[0-9a-f]{6}$'
    or pg_catalog.jsonb_typeof(p_appearance -> 'typography') is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(
      p_appearance -> 'typography'
    )) <> 4
    or not ((p_appearance -> 'typography') ?& array[
      'baseScale', 'bodyFontRef', 'displayFontRef', 'sportScale'
    ])
    or pg_catalog.jsonb_typeof(
      p_appearance #> '{typography,baseScale}'
    ) is distinct from 'number'
    or pg_catalog.jsonb_typeof(
      p_appearance #> '{typography,sportScale}'
    ) is distinct from 'number'
    or (p_appearance #>> '{typography,baseScale}')::numeric not between 0.85 and 1.25
    or (p_appearance #>> '{typography,sportScale}')::numeric not between 0.9 and 1.4
  then
    return false;
  end if;

  foreach font_ref in array array[
    p_appearance #>> '{typography,bodyFontRef}',
    p_appearance #>> '{typography,displayFontRef}'
  ]
  loop
    if font_ref is null or font_ref <> all(array[
      'vc-inter-v1',
      'vc-newsreader-v1',
      'vc-space-grotesk-v1',
      'vc-fraunces-v1',
      'vc-barlow-condensed-v1',
      'vc-source-serif-4-v1',
      'vc-manrope-v1',
      'vc-cormorant-garamond-v1',
      'vc-ibm-plex-mono-v1',
      'vc-anton-v1'
    ]) then
      return false;
    end if;
  end loop;
  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke all on function private.theme_appearance_settings_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;

create table public.tenant_theme_profiles (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  theme_id text not null check (length(btrim(theme_id)) between 2 and 80),
  theme_version text not null check (
    theme_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  selection_json jsonb not null check (
    private.theme_selection_is_valid_v1(selection_json)
  ),
  color_overrides jsonb not null default '{}'::jsonb check (
    color_overrides = '{}'::jsonb
    or private.tenant_theme_color_overrides_is_valid_v1(color_overrides)
  ),
  appearance_config jsonb not null check (
    private.theme_appearance_settings_is_valid_v1(appearance_config)
  ),
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, theme_id),
  check (selection_json #>> '{ref,id}' = theme_id),
  check (selection_json #>> '{ref,version}' = theme_version)
);

create index tenant_theme_profiles_updated_idx
  on public.tenant_theme_profiles(tenant_id, updated_at desc);

create trigger tenant_theme_profiles_set_updated_at
before update on public.tenant_theme_profiles
for each row execute function private.set_updated_at();

create table public.tenant_theme_rollouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  theme_id text not null,
  settings_revision bigint not null check (settings_revision >= 0),
  status text not null default 'queued' check (
    status in ('queued', 'rendering', 'ready', 'failed')
  ),
  snapshot_count integer not null default 0 check (snapshot_count >= 0),
  ready_snapshot_count integer not null default 0 check (
    ready_snapshot_count >= 0 and ready_snapshot_count <= snapshot_count
  ),
  release_count integer not null default 0 check (release_count >= 0),
  release_target_count integer not null default 0 check (
    release_target_count >= 0 and release_count <= release_target_count
  ),
  error_code text check (
    error_code is null or length(error_code) between 1 and 120
  ),
  created_by uuid references public.profiles(id) on delete set null,
  retry_of_rollout_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, theme_id)
    references public.tenant_theme_profiles(tenant_id, theme_id)
    on delete restrict,
  foreign key (tenant_id, retry_of_rollout_id)
    references public.tenant_theme_rollouts(tenant_id, id)
    on delete restrict
);

create index tenant_theme_rollouts_status_idx
  on public.tenant_theme_rollouts(
    tenant_id, theme_id, created_at desc
  );

create unique index tenant_theme_rollouts_retry_once_idx
  on public.tenant_theme_rollouts(tenant_id, retry_of_rollout_id)
  where retry_of_rollout_id is not null;

create table private.tenant_theme_rollout_snapshots (
  tenant_id uuid not null,
  rollout_id uuid not null,
  dynamic_slide_id uuid not null,
  old_snapshot_id uuid not null,
  new_snapshot_id uuid not null,
  advance_current boolean not null default false,
  primary key (tenant_id, rollout_id, old_snapshot_id),
  foreign key (tenant_id, rollout_id)
    references public.tenant_theme_rollouts(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, dynamic_slide_id)
    references public.dynamic_slides(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, old_snapshot_id)
    references public.dynamic_slide_snapshots(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, new_snapshot_id)
    references public.dynamic_slide_snapshots(tenant_id, id)
    on delete restrict
);

create index tenant_theme_rollout_snapshots_slide_idx
  on private.tenant_theme_rollout_snapshots(
    tenant_id, rollout_id, dynamic_slide_id
  );

create table private.tenant_theme_rollout_release_branches (
  tenant_id uuid not null,
  rollout_id uuid not null,
  source_release_id uuid not null,
  replacement_release_id uuid,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'ready', 'failed', 'superseded')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  not_before timestamptz not null default now(),
  error_code text check (
    error_code is null or length(error_code) between 1 and 120
  ),
  error_detail text check (
    error_detail is null or length(error_detail) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (tenant_id, rollout_id, source_release_id),
  foreign key (tenant_id, rollout_id)
    references public.tenant_theme_rollouts(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, source_release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, replacement_release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict
);

create index tenant_theme_rollout_release_due_idx
  on private.tenant_theme_rollout_release_branches(
    status, not_before, tenant_id, rollout_id
  ) where status in ('queued', 'processing');

create table private.tenant_theme_rollout_releases (
  tenant_id uuid not null,
  rollout_id uuid not null,
  release_id uuid not null,
  primary key (tenant_id, rollout_id, release_id),
  foreign key (tenant_id, rollout_id)
    references public.tenant_theme_rollouts(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, release_id)
    references public.playlist_releases(tenant_id, id)
    on delete restrict
);

revoke all on private.tenant_theme_rollout_snapshots
  from public, anon, authenticated, service_role;
revoke all on private.tenant_theme_rollout_releases
  from public, anon, authenticated, service_role;
revoke all on private.tenant_theme_rollout_release_branches
  from public, anon, authenticated, service_role;

insert into public.tenant_theme_profiles (
  tenant_id,
  theme_id,
  theme_version,
  selection_json,
  color_overrides,
  appearance_config,
  revision,
  updated_by,
  created_at,
  updated_at
)
select
  settings.tenant_id,
  'fieldflow',
  '1.0.0',
  jsonb_build_object(
    'ref', jsonb_build_object(
      'catalog', 'v2',
      'id', 'fieldflow',
      'version', '1.0.0'
    ),
    'modePolicy', settings.theme_mode_policy,
    'accent', case
      when settings.theme_accent is null then 'null'::jsonb
      else to_jsonb(settings.theme_accent)
    end,
    'support', case
      when settings.theme_support is null then 'null'::jsonb
      else to_jsonb(settings.theme_support)
    end,
    'categoryOverrides', '[]'::jsonb
  ),
  settings.theme_color_overrides,
  jsonb_build_object(
    'schemaVersion', 1,
    'surfaces', jsonb_build_object(
      'clubLogoBackground', '#E7F5EE',
      'homeLogoBackground', '#FFFFFF'
    ),
    'typography', jsonb_build_object(
      'baseScale', 1,
      'bodyFontRef', 'vc-inter-v1',
      'displayFontRef', 'vc-manrope-v1',
      'sportScale', 1.12
    )
  ),
  settings.theme_settings_revision,
  settings.updated_by,
  settings.created_at,
  settings.updated_at
from public.tenant_settings settings
on conflict (tenant_id, theme_id) do nothing;

-- Theme profiles are tenant resources. Provision them at the same boundary as
-- tenant_settings so every future tenant has a writable FieldFlow profile,
-- regardless of which guarded onboarding command created the tenant.
alter table public.tenant_settings
  alter column default_theme_id set default 'fieldflow',
  alter column default_theme_version set default '1.0.0';

create function private.ensure_tenant_theme_profile_v1(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_theme_profiles (
    tenant_id,
    theme_id,
    theme_version,
    selection_json,
    color_overrides,
    appearance_config,
    revision,
    updated_by,
    created_at,
    updated_at
  )
  select
    settings.tenant_id,
    'fieldflow',
    '1.0.0',
    pg_catalog.jsonb_build_object(
      'ref', pg_catalog.jsonb_build_object(
        'catalog', 'v2',
        'id', 'fieldflow',
        'version', '1.0.0'
      ),
      'modePolicy', settings.theme_mode_policy,
      'accent', case
        when settings.theme_accent is null then 'null'::jsonb
        else pg_catalog.to_jsonb(settings.theme_accent)
      end,
      'support', case
        when settings.theme_support is null then 'null'::jsonb
        else pg_catalog.to_jsonb(settings.theme_support)
      end,
      'categoryOverrides', '[]'::jsonb
    ),
    settings.theme_color_overrides,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'surfaces', pg_catalog.jsonb_build_object(
        'clubLogoBackground', '#E7F5EE',
        'homeLogoBackground', '#FFFFFF'
      ),
      'typography', pg_catalog.jsonb_build_object(
        'baseScale', 1,
        'bodyFontRef', 'vc-inter-v1',
        'displayFontRef', 'vc-manrope-v1',
        'sportScale', 1.12
      )
    ),
    settings.theme_settings_revision,
    settings.updated_by,
    settings.created_at,
    settings.updated_at
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  on conflict (tenant_id, theme_id) do nothing;
end;
$$;

revoke all on function private.ensure_tenant_theme_profile_v1(uuid)
  from public, anon, authenticated, service_role;

create function private.provision_tenant_theme_profile_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_tenant_theme_profile_v1(new.tenant_id);
  return new;
end;
$$;

revoke all on function private.provision_tenant_theme_profile_v1()
  from public, anon, authenticated, service_role;

create trigger tenant_settings_provision_theme_profile
after insert on public.tenant_settings
for each row execute function private.provision_tenant_theme_profile_v1();

alter table public.tenant_theme_profiles enable row level security;
alter table public.tenant_theme_profiles force row level security;
alter table public.tenant_theme_rollouts enable row level security;
alter table public.tenant_theme_rollouts force row level security;

revoke all on public.tenant_theme_profiles
  from public, anon, authenticated;
revoke all on public.tenant_theme_rollouts
  from public, anon, authenticated;
grant select on public.tenant_theme_profiles to authenticated;
grant select on public.tenant_theme_rollouts to authenticated;
grant select, insert, update, delete on public.tenant_theme_profiles
  to service_role;
grant select, insert, update, delete on public.tenant_theme_rollouts
  to service_role;

create policy tenant_theme_profiles_read
on public.tenant_theme_profiles
for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.settings.read')
);

create policy tenant_theme_rollouts_read
on public.tenant_theme_rollouts
for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.settings.read')
);


create function private.sportlink_display_config_is_valid_v2(
  p_display jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return pg_catalog.jsonb_typeof(p_display) = 'object'
    and (select count(*) from pg_catalog.jsonb_object_keys(p_display)) = 6
    and p_display ?& array[
      'columns', 'showDressingRoom', 'showField', 'showHomeAway',
      'showLogo', 'showReferee'
    ]
    and p_display ->> 'columns' in ('one', 'two')
    and pg_catalog.jsonb_typeof(p_display -> 'showDressingRoom') = 'boolean'
    and pg_catalog.jsonb_typeof(p_display -> 'showField') = 'boolean'
    and pg_catalog.jsonb_typeof(p_display -> 'showHomeAway') = 'boolean'
    and pg_catalog.jsonb_typeof(p_display -> 'showLogo') = 'boolean'
    and pg_catalog.jsonb_typeof(p_display -> 'showReferee') = 'boolean';
end;
$$;

create function private.sportlink_team_contexts_are_valid_v2(
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
begin
  if pg_catalog.jsonb_typeof(p_team_contexts) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_team_contexts) not between 1 and 500
    or (
      select count(*) <> count(distinct context ->> 'providerTeamId')
      from pg_catalog.jsonb_array_elements(p_team_contexts) context
    )
  then
    return false;
  end if;

  for context_record in
    select value from pg_catalog.jsonb_array_elements(p_team_contexts)
  loop
    if not private.sportlink_team_contexts_are_valid_v1(
      p_tenant_id,
      p_data_source_id,
      jsonb_build_array(context_record)
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function private.sportlink_team_selection_is_valid_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_team_selection jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  contexts jsonb;
  mode_name text;
begin
  if pg_catalog.jsonb_typeof(p_team_selection) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(
      p_team_selection
    )) <> 2
    or not (p_team_selection ?& array['mode', 'teamContexts'])
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'mode'
    ) is distinct from 'string'
    or p_team_selection ->> 'mode' not in ('all', 'selected')
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'teamContexts'
    ) is distinct from 'array'
    or pg_catalog.jsonb_array_length(
      p_team_selection -> 'teamContexts'
    ) > 500
  then
    return false;
  end if;

  contexts := p_team_selection -> 'teamContexts';
  mode_name := p_team_selection ->> 'mode';
  if mode_name = 'selected' and pg_catalog.jsonb_array_length(contexts) = 0 then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(contexts) > 0
    and not private.sportlink_team_contexts_are_valid_v2(
      p_tenant_id,
      p_data_source_id,
      contexts
    )
  then
    return false;
  end if;
  if mode_name = 'all' and exists (
    select 1
    from pg_catalog.jsonb_array_elements(contexts) context
    where context ->> 'competitionSelectionMode' <> 'pinned'
  ) then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.sportlink_display_config_is_valid_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.sportlink_team_contexts_are_valid_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.sportlink_team_selection_is_valid_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s153_theme_and_club_filter;

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
  appearance jsonb;
  blueprint text := p_slide.configuration_json ->> 'blueprintKey';
  color_overrides jsonb;
  editorial jsonb;
  mode_policy jsonb;
  palette jsonb;
  profile record;
  resolved_at timestamptz := statement_timestamp();
  resolved_mode text;
  result jsonb;
  selected_items jsonb;
  selected_team_count integer;
  selection jsonb;
  settings record;
  team_selection jsonb := p_slide.configuration_json -> 'teamSelection';
begin
  result := private.build_dynamic_snapshot_data_before_s153_theme_and_club_filter(
    p_slide
  );

  if blueprint in (
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days'
  ) and pg_catalog.jsonb_typeof(team_selection) = 'object'
  then
    with source_items as (
      select item.value, item.ordinality
      from pg_catalog.jsonb_array_elements(
        coalesce(result #> '{sport,items}', '[]'::jsonb)
      ) with ordinality item(value, ordinality)
    ), matched_items as (
      select source_items.*
      from source_items
      join public.sports_matches fixture
        on fixture.tenant_id = p_slide.tenant_id
       and fixture.external_id = source_items.value ->> 'id'
       and fixture.active
      join public.sportlink_connections connection
        on connection.tenant_id = fixture.tenant_id
       and connection.id = fixture.source_connection_id
       and connection.data_source_id = p_slide.data_source_id
      where (
        team_selection ->> 'mode' = 'selected'
        and exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            team_selection -> 'teamContexts'
          ) selected_context
          where selected_context ->> 'providerTeamId' in (
              fixture.home_team ->> 'externalId',
              fixture.away_team ->> 'externalId'
            )
            and (
              selected_context ->> 'competitionSelectionMode' = 'auto_current'
              or (
                fixture.competition ->> 'externalId'
                  is not distinct from selected_context ->> 'competitionId'
                and (
                  selected_context ->> 'phaseId' is null
                  or fixture.competition ->> 'period' =
                    selected_context ->> 'phaseId'
                )
                and (
                  selected_context ->> 'poolId' is null
                  or fixture.pool ->> 'externalId' =
                    selected_context ->> 'poolId'
                  or fixture.pool ->> 'poolExternalId' =
                    selected_context ->> 'poolId'
                )
                and (
                  selected_context ->> 'seasonId' is null
                  or fixture.competition ->> 'season' =
                    selected_context ->> 'seasonId'
                )
              )
            )
        )
      ) or (
        team_selection ->> 'mode' = 'all'
        and exists (
          select 1
          from public.sports_teams club_team
          join public.sportlink_connections team_connection
            on team_connection.tenant_id = club_team.tenant_id
           and team_connection.id = club_team.source_connection_id
           and team_connection.data_source_id = p_slide.data_source_id
          where club_team.tenant_id = p_slide.tenant_id
            and club_team.active
            and club_team.external_id in (
              fixture.home_team ->> 'externalId',
              fixture.away_team ->> 'externalId'
            )
            and (
              not exists (
                select 1
                from pg_catalog.jsonb_array_elements(
                  team_selection -> 'teamContexts'
                ) team_override
                where team_override ->> 'providerTeamId' =
                  club_team.external_id
              )
              or exists (
                select 1
                from pg_catalog.jsonb_array_elements(
                  team_selection -> 'teamContexts'
                ) team_override
                where team_override ->> 'providerTeamId' =
                    club_team.external_id
                  and fixture.competition ->> 'externalId'
                    is not distinct from team_override ->> 'competitionId'
                  and (
                    team_override ->> 'phaseId' is null
                    or fixture.competition ->> 'period' =
                      team_override ->> 'phaseId'
                  )
                  and (
                    team_override ->> 'poolId' is null
                    or fixture.pool ->> 'externalId' =
                      team_override ->> 'poolId'
                    or fixture.pool ->> 'poolExternalId' =
                      team_override ->> 'poolId'
                  )
                  and (
                    team_override ->> 'seasonId' is null
                    or fixture.competition ->> 'season' =
                      team_override ->> 'seasonId'
                  )
              )
            )
        )
      )
    )
    select coalesce(
      jsonb_agg(value order by ordinality),
      '[]'::jsonb
    )
    into selected_items
    from matched_items;

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
      selected_team_count := pg_catalog.jsonb_array_length(
        team_selection -> 'teamContexts'
      );
    end if;

    result := pg_catalog.jsonb_set(
      result,
      '{sport,items}',
      selected_items,
      true
    );
    result := pg_catalog.jsonb_set(
      result,
      '{sport,selectedTeamCount}',
      to_jsonb(coalesce(selected_team_count, 0)),
      true
    );
    result := pg_catalog.jsonb_set(
      result,
      '{sport,teamSelectionMode}',
      to_jsonb(team_selection ->> 'mode'),
      true
    );
  end if;

  if coalesce(
    result #>> '{themePresentation,selection,ref,id}',
    p_slide.configuration_json #>> '{editorial,themeSelection,ref,id}',
    p_slide.configuration_json #>> '{theme,themeId}'
  ) is distinct from 'fieldflow' then
    return result;
  end if;

  select
    tenant_settings.theme_color_overrides,
    tenant_settings.theme_mode_policy,
    tenant_settings.theme_accent,
    tenant_settings.theme_support,
    tenant_settings.theme_settings_revision,
    tenant_settings.timezone_name
  into settings
  from public.tenant_settings tenant_settings
  where tenant_settings.tenant_id = p_slide.tenant_id;

  select
    theme_profile.appearance_config,
    theme_profile.color_overrides,
    theme_profile.revision,
    theme_profile.selection_json
  into profile
  from public.tenant_theme_profiles theme_profile
  where theme_profile.tenant_id = p_slide.tenant_id
    and theme_profile.theme_id = 'fieldflow';

  selection := case
    when private.theme_selection_is_valid_v1(profile.selection_json)
      then profile.selection_json
    else jsonb_build_object(
      'ref', jsonb_build_object(
        'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
      ),
      'modePolicy', settings.theme_mode_policy,
      'accent', case when settings.theme_accent is null
        then 'null'::jsonb else to_jsonb(settings.theme_accent) end,
      'support', case when settings.theme_support is null
        then 'null'::jsonb else to_jsonb(settings.theme_support) end,
      'categoryOverrides', '[]'::jsonb
    )
  end;
  appearance := case
    when private.theme_appearance_settings_is_valid_v1(
      profile.appearance_config
    ) then profile.appearance_config
    else jsonb_build_object(
      'schemaVersion', 1,
      'surfaces', jsonb_build_object(
        'clubLogoBackground', '#E7F5EE',
        'homeLogoBackground', '#FFFFFF'
      ),
      'typography', jsonb_build_object(
        'baseScale', 1,
        'bodyFontRef', 'vc-inter-v1',
        'displayFontRef', 'vc-manrope-v1',
        'sportScale', 1.12
      )
    )
  end;
  color_overrides := case
    when private.tenant_theme_color_overrides_is_valid_v1(
      profile.color_overrides
    ) then profile.color_overrides
    else settings.theme_color_overrides
  end;
  mode_policy := selection -> 'modePolicy';
  resolved_mode := private.resolve_theme_mode_v1(
    mode_policy,
    coalesce(settings.timezone_name, 'Europe/Amsterdam'),
    resolved_at
  );

  if private.tenant_theme_color_overrides_is_valid_v1(color_overrides) then
    palette := jsonb_set(
      color_overrides -> 'fieldflow',
      '{mode}',
      to_jsonb(resolved_mode),
      true
    );
    editorial := coalesce(result -> 'editorial', '{}'::jsonb)
      || jsonb_build_object(
        'schemaVersion', 2,
        'theme', palette,
        'themeSelection', selection
      );
    result := jsonb_set(result, '{editorial}', editorial, true);
  end if;

  return jsonb_set(
    result,
    '{themePresentation}',
    jsonb_build_object(
      'appearance', appearance,
      'catalogVersion', '1.0.0',
      'settingsRevision', coalesce(
        profile.revision,
        settings.theme_settings_revision,
        0
      ),
      'snapshotVersion', 2,
      'selection', selection,
      'resolvedMode', jsonb_build_object(
        'mode', resolved_mode,
        'policy', mode_policy,
        'resolvedAt', to_char(
          resolved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'timezone', coalesce(
          settings.timezone_name,
          'Europe/Amsterdam'
        )
      )
    ),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s153_theme_and_club_filter(
  public.dynamic_slides
) from public, anon, authenticated, service_role;


create function private.finalize_theme_rollout_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_record private.tenant_theme_rollout_snapshots%rowtype;
  ready_count integer;
  total_count integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select mapping.*
  into mapping_record
  from private.tenant_theme_rollout_snapshots mapping
  where mapping.tenant_id = new.tenant_id
    and mapping.new_snapshot_id = new.id;

  if not found then
    return new;
  end if;

  if new.status = 'failed' then
    update public.tenant_theme_rollouts rollout
    set status = 'failed',
        error_code = coalesce(new.error_code, 'THEME_RENDER_FAILED'),
        completed_at = now()
    where rollout.tenant_id = mapping_record.tenant_id
      and rollout.id = mapping_record.rollout_id;
    return new;
  end if;
  if new.status <> 'ready' then
    return new;
  end if;

  update public.dynamic_slides slide
  set current_snapshot_id = new.id,
      status = 'ready',
      last_error_code = null
  where slide.tenant_id = mapping_record.tenant_id
    and slide.id = mapping_record.dynamic_slide_id
    and slide.status <> 'archived'
    and (
      slide.current_snapshot_id is not distinct from
        mapping_record.old_snapshot_id
      or slide.current_snapshot_id = new.id
    );

  select
    count(*)::integer,
    count(*) filter (where snapshot.status = 'ready')::integer
  into total_count, ready_count
  from private.tenant_theme_rollout_snapshots mapping
  join public.dynamic_slide_snapshots snapshot
    on snapshot.tenant_id = mapping.tenant_id
   and snapshot.id = mapping.new_snapshot_id
  where mapping.tenant_id = mapping_record.tenant_id
    and mapping.rollout_id = mapping_record.rollout_id;

  update public.tenant_theme_rollouts rollout
  set ready_snapshot_count = ready_count,
      status = case
        when ready_count = total_count then 'ready'
        else 'rendering'
      end,
      completed_at = case
        when ready_count = total_count then now()
        else null
      end
  where rollout.tenant_id = mapping_record.tenant_id
    and rollout.id = mapping_record.rollout_id
    and rollout.status <> 'failed';

  return new;
end;
$$;

revoke all on function private.finalize_theme_rollout_snapshot_v1()
  from public, anon, authenticated, service_role;

create trigger dynamic_snapshots_finalize_theme_rollout
after update of status on public.dynamic_slide_snapshots
for each row execute function private.finalize_theme_rollout_snapshot_v1();

create function private.track_theme_rollout_release_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_rollout record;
begin
  if new.dynamic_snapshot_id is null then
    return new;
  end if;
  for linked_rollout in
    select mapping.tenant_id, mapping.rollout_id
    from private.tenant_theme_rollout_snapshots mapping
    where mapping.tenant_id = new.tenant_id
      and mapping.new_snapshot_id = new.dynamic_snapshot_id
  loop
    insert into private.tenant_theme_rollout_releases(
      tenant_id,
      rollout_id,
      release_id
    ) values (
      linked_rollout.tenant_id,
      linked_rollout.rollout_id,
      new.release_id
    )
    on conflict do nothing;

    update public.tenant_theme_rollouts rollout
    set release_count = (
      select count(*)::integer
      from private.tenant_theme_rollout_releases release_link
      where release_link.tenant_id = linked_rollout.tenant_id
        and release_link.rollout_id = linked_rollout.rollout_id
    )
    where rollout.tenant_id = linked_rollout.tenant_id
      and rollout.id = linked_rollout.rollout_id;
  end loop;
  return new;
end;
$$;

revoke all on function private.track_theme_rollout_release_v1()
  from public, anon, authenticated, service_role;

create trigger playlist_release_items_track_theme_rollout
after insert on public.playlist_release_items
for each row execute function private.track_theme_rollout_release_v1();

create function public.update_tenant_theme_settings_v3(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_color_overrides jsonb,
  p_appearance jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  content_hash text;
  current_profile public.tenant_theme_profiles%rowtype;
  current_settings public.tenant_settings%rowtype;
  existing_snapshot_id uuid;
  existing_snapshot_status text;
  new_snapshot_id uuid;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else upper(p_support)
  end;
  ready_snapshot_total integer := 0;
  rollout_id uuid;
  selection jsonb;
  slide_record public.dynamic_slides%rowtype;
  queued_snapshot_count integer := 0;
  snapshot_data jsonb;
  theme_changed boolean;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.settings.manage'
  ) then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  selection := jsonb_build_object(
    'ref', jsonb_build_object(
      'catalog', 'v2',
      'id', p_theme_id,
      'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case when normalized_accent is null
      then 'null'::jsonb else to_jsonb(normalized_accent) end,
    'support', case when normalized_support is null
      then 'null'::jsonb else to_jsonb(normalized_support) end,
    'categoryOverrides', '[]'::jsonb
  );

  if p_theme_id is distinct from 'fieldflow'
    or p_theme_version is distinct from '1.0.0'
    or not private.theme_selection_is_valid_v1(selection)
    or not private.tenant_theme_color_overrides_is_valid_v1(
      p_color_overrides
    )
    or not private.theme_appearance_settings_is_valid_v1(p_appearance)
  then
    raise exception 'tenant theme settings are invalid'
      using errcode = '23514';
  end if;

  select settings.*
  into current_settings
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant settings not found' using errcode = 'P0002';
  end if;

  select profile.*
  into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
  for update;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  if current_profile.revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  theme_changed :=
    current_profile.theme_version is distinct from p_theme_version
    or current_profile.selection_json is distinct from selection
    or current_profile.color_overrides is distinct from p_color_overrides
    or current_profile.appearance_config is distinct from p_appearance;

  if not theme_changed then
    return jsonb_build_object(
      'outcome', 'applied',
      'queuedSnapshotCount', 0,
      'revision', current_profile.revision
    );
  end if;

  -- Lock the rollout set before changing the profile. A snapshot that is
  -- already publishing was built with the previous theme; mixing two theme
  -- revisions into that version would make the eventual winner ambiguous.
  perform slide.id
  from public.dynamic_slides slide
  where slide.tenant_id = p_tenant_id
    and slide.status <> 'archived'
    and slide.current_published_version_id is not null
  order by slide.id
  for update;
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
  ) then
    raise exception 'wait for active slide publication before theme rollout'
      using errcode = '55000';
  end if;

  next_revision := current_profile.revision + 1;
  update public.tenant_theme_profiles profile
  set theme_version = p_theme_version,
      selection_json = selection,
      color_overrides = p_color_overrides,
      appearance_config = p_appearance,
      revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id;

  update public.tenant_settings settings
  set default_theme_id = p_theme_id,
      default_theme_version = p_theme_version,
      theme_mode_policy = p_mode_policy,
      theme_accent = normalized_accent,
      theme_support = normalized_support,
      theme_color_overrides = p_color_overrides,
      theme_settings_revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where settings.tenant_id = p_tenant_id;

  insert into public.tenant_theme_rollouts(
    tenant_id,
    theme_id,
    settings_revision,
    status,
    created_by
  ) values (
    p_tenant_id,
    p_theme_id,
    next_revision,
    'queued',
    actor_id
  )
  returning id into rollout_id;

  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
      and slide.current_published_version_id is not null
    order by slide.id
    for update
  loop
    -- dynamic_slides mirrors an editable draft when one exists. A tenant theme
    -- rollout must instead materialise the immutable published configuration.
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
      raise exception 'published slide version not found' using errcode = 'P0002';
    end if;
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot_data
    );
    new_snapshot_id := null;
    existing_snapshot_id := null;
    existing_snapshot_status := null;

    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      created_by
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      content_hash,
      snapshot_data,
      actor_id
    )
    on conflict (
      dynamic_slide_id,
      dynamic_slide_version_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id, status into new_snapshot_id, existing_snapshot_status;

    if new_snapshot_id is null then
      select snapshot.id, snapshot.status
      into existing_snapshot_id, existing_snapshot_status
      from public.dynamic_slide_snapshots snapshot
      where snapshot.dynamic_slide_id = slide_record.id
        and snapshot.dynamic_slide_version_id =
          slide_record.current_published_version_id
        and snapshot.source_revision_hash = content_hash
        and snapshot.template_version_id =
          slide_record.template_version_id;
      new_snapshot_id := existing_snapshot_id;
    end if;

    if new_snapshot_id is null
      or new_snapshot_id is not distinct from slide_record.current_snapshot_id
    then
      continue;
    end if;

    insert into private.tenant_theme_rollout_snapshots(
      tenant_id,
      rollout_id,
      dynamic_slide_id,
      old_snapshot_id,
      new_snapshot_id
    ) values (
      p_tenant_id,
      rollout_id,
      slide_record.id,
      slide_record.current_snapshot_id,
      new_snapshot_id
    );

    if existing_snapshot_status = 'ready' then
      update public.dynamic_slides slide
      set current_snapshot_id = new_snapshot_id,
          status = 'ready',
          last_error_code = null
      where slide.tenant_id = p_tenant_id
        and slide.id = slide_record.id
        and slide.current_snapshot_id is not distinct from
          slide_record.current_snapshot_id;
      ready_snapshot_total := ready_snapshot_total + 1;
    else
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (p_tenant_id, new_snapshot_id)
      on conflict (snapshot_id) do nothing;
      update public.dynamic_slides slide
      set status = 'rendering',
          last_error_code = null
      where slide.tenant_id = p_tenant_id
        and slide.id = slide_record.id;
    end if;
    queued_snapshot_count := queued_snapshot_count + 1;
  end loop;

  update public.tenant_theme_rollouts rollout
  set snapshot_count = queued_snapshot_count,
      ready_snapshot_count = ready_snapshot_total,
      status = case
        when queued_snapshot_count = ready_snapshot_total then 'ready'
        else 'rendering'
      end,
      completed_at = case
        when queued_snapshot_count = ready_snapshot_total then now()
        else null
      end
  where rollout.tenant_id = p_tenant_id
    and rollout.id = rollout_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.updated',
    'tenant_theme_profiles',
    p_tenant_id,
    'success',
    jsonb_build_object(
      'themeId', p_theme_id,
      'themeVersion', p_theme_version,
      'settingsRevision', next_revision,
      'rolloutId', rollout_id,
      'queuedSnapshotCount', queued_snapshot_count,
      'immutable', true
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', queued_snapshot_count,
    'revision', next_revision,
    'rolloutId', rollout_id
  );
end;
$$;

revoke all on function public.update_tenant_theme_settings_v3(
  uuid, bigint, text, text, jsonb, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_theme_settings_v3(
  uuid, bigint, text, text, jsonb, jsonb, jsonb, text, text
) to authenticated;

-- A forced theme rollout clones the exact immutable payload already used by a
-- slide or release. It must therefore preserve the historical design version
-- explicitly instead of silently binding the clone to today's published one.
create or replace function private.assign_dynamic_snapshot_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  version_record public.dynamic_slide_versions%rowtype;
  draft_status text;
begin
  select * into slide_record
  from public.dynamic_slides slide
  where slide.id = new.dynamic_slide_id;
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;

  if new.dynamic_slide_version_id is not null then
    select * into version_record
    from public.dynamic_slide_versions version
    where version.tenant_id = new.tenant_id
      and version.dynamic_slide_id = new.dynamic_slide_id
      and version.id = new.dynamic_slide_version_id
      and version.status in ('published', 'archived');
    if found
      and version_record.template_version_id is not distinct from
        new.template_version_id
      and version_record.data_source_id is not distinct from new.data_source_id
    then
      return new;
    end if;

    -- Before immutable theme rollouts existed, this database-owned column was
    -- always overwritten by the runtime version. Keep that contract for stale
    -- service fixtures while allowing a rollout to preserve a valid historical
    -- published version from the same slide.
    new.dynamic_slide_version_id := null;
  end if;

  if slide_record.active_draft_version_id is not null then
    select status into draft_status
    from public.dynamic_slide_versions
    where id = slide_record.active_draft_version_id;
  end if;
  if draft_status = 'publishing' then
    new.dynamic_slide_version_id := slide_record.active_draft_version_id;
  elsif slide_record.current_published_version_id is not null then
    new.dynamic_slide_version_id := slide_record.current_published_version_id;
  elsif draft_status = 'draft' then
    update public.dynamic_slide_versions
    set status = 'publishing'
    where id = slide_record.active_draft_version_id;
    new.dynamic_slide_version_id := slide_record.active_draft_version_id;
  else
    raise exception 'dynamic slide has no runtime version' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.assign_dynamic_snapshot_version_v1()
  from public, anon, authenticated, service_role;

create function private.apply_tenant_theme_to_snapshot_v1(
  p_tenant_id uuid,
  p_snapshot_data jsonb,
  p_rollout_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  appearance jsonb;
  color_overrides jsonb;
  editorial jsonb;
  mode_policy jsonb;
  palette jsonb;
  profile public.tenant_theme_profiles%rowtype;
  resolved_at timestamptz := statement_timestamp();
  resolved_mode text;
  result jsonb := coalesce(p_snapshot_data, '{}'::jsonb);
  selection jsonb;
  settings public.tenant_settings%rowtype;
begin
  select * into settings
  from public.tenant_settings
  where tenant_id = p_tenant_id;
  select * into profile
  from public.tenant_theme_profiles
  where tenant_id = p_tenant_id
    and theme_id = 'fieldflow';
  if settings.tenant_id is null or profile.tenant_id is null then
    raise exception 'tenant theme profile is unavailable' using errcode = 'P0002';
  end if;

  selection := profile.selection_json;
  appearance := profile.appearance_config;
  color_overrides := profile.color_overrides;
  mode_policy := selection -> 'modePolicy';
  resolved_mode := private.resolve_theme_mode_v1(
    mode_policy,
    coalesce(settings.timezone_name, 'Europe/Amsterdam'),
    resolved_at
  );

  if private.tenant_theme_color_overrides_is_valid_v1(color_overrides) then
    palette := pg_catalog.jsonb_set(
      color_overrides -> 'fieldflow',
      '{mode}',
      pg_catalog.to_jsonb(resolved_mode),
      true
    );
    editorial := coalesce(result -> 'editorial', '{}'::jsonb)
      || pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'theme', palette,
        'themeSelection', selection
      );
    result := pg_catalog.jsonb_set(result, '{editorial}', editorial, true);
  end if;

  result := pg_catalog.jsonb_set(
    result,
    '{themePresentation}',
    pg_catalog.jsonb_build_object(
      'appearance', appearance,
      'catalogVersion', '1.0.0',
      'settingsRevision', profile.revision,
      'snapshotVersion', 2,
      'selection', selection,
      'resolvedMode', pg_catalog.jsonb_build_object(
        'mode', resolved_mode,
        'policy', mode_policy,
        'resolvedAt', pg_catalog.to_char(
          resolved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'timezone', coalesce(settings.timezone_name, 'Europe/Amsterdam')
      )
    ),
    true
  );

  -- This namespaced top-level record is intentionally outside the strict
  -- themePresentation contract. It gives a retry a fresh content identity
  -- while retaining every provider-owned field from the source snapshot.
  return pg_catalog.jsonb_set(
    result,
    '{_veyocastThemeRollout}',
    pg_catalog.jsonb_build_object(
      'id', p_rollout_id,
      'settingsRevision', profile.revision
    ),
    true
  );
end;
$$;

revoke all on function private.apply_tenant_theme_to_snapshot_v1(
  uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

create function private.theme_rollout_active_release_ids_v1(
  p_tenant_id uuid
)
returns table (release_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct referenced.release_id
  from (
    select screen.assigned_release_id as release_id
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and screen.assigned_release_id is not null
    union all
    select screen.default_release_id
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
      and screen.default_release_id is not null
    union all
    select screen_group.default_release_id
    from public.screen_groups screen_group
    where screen_group.tenant_id = p_tenant_id
      and screen_group.status = 'active'
      and screen_group.default_release_id is not null
    union all
    select schedule.release_id
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and (
        (
          schedule.enabled
          and (
            schedule.ends_at is null
            or schedule.ends_at >= statement_timestamp()
          )
        )
        or exists (
          select 1
          from public.screens active_screen
          where active_screen.tenant_id = schedule.tenant_id
            and active_screen.active_schedule_id = schedule.id
            and active_screen.status <> 'disabled'
            and active_screen.deleted_at is null
        )
      )
  ) referenced
  where referenced.release_id is not null
$$;

revoke all on function private.theme_rollout_active_release_ids_v1(uuid)
  from public, anon, authenticated, service_role;

-- Locking the current profile in SHARE mode gives pointer writers a common
-- serialization boundary with update_tenant_theme_settings_v3 (FOR UPDATE).
-- A writer that wins is visible to the planner; a writer that loses observes
-- the new revision and cannot make a stale immutable release active.
create function private.assert_theme_release_pointer_current_v1(
  p_tenant_id uuid,
  p_release_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  if p_release_id is null then
    return;
  end if;

  select profile.revision into current_revision
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = 'fieldflow'
  for share;
  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.playlist_release_items release_item
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = release_item.tenant_id
     and snapshot.id = release_item.dynamic_snapshot_id
    join public.dynamic_slide_versions version
      on version.tenant_id = snapshot.tenant_id
     and version.dynamic_slide_id = snapshot.dynamic_slide_id
     and version.id = snapshot.dynamic_slide_version_id
    where release_item.tenant_id = p_tenant_id
      and release_item.release_id = p_release_id
      and coalesce(
        snapshot.snapshot_data_json
          #>> '{themePresentation,selection,ref,id}',
        version.theme_selection_json #>> '{ref,id}',
        version.configuration_json
          #>> '{editorial,themeSelection,ref,id}',
        version.configuration_json #>> '{theme,themeId}'
      ) = 'fieldflow'
      and snapshot.snapshot_data_json
        #>> '{themePresentation,settingsRevision}'
        is distinct from current_revision::text
  ) then
    raise exception 'release contains a stale FieldFlow theme snapshot'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function private.assert_theme_release_pointer_current_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

create function private.guard_theme_release_pointers_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activation_transition boolean := tg_op = 'INSERT';
  new_release_id uuid;
  old_release_id uuid;
  old_row jsonb := '{}'::jsonb;
  pointer_index integer;
  pointer_name text;
  new_row jsonb := pg_catalog.to_jsonb(new);
begin
  if tg_nargs = 0 then
    raise exception 'theme release pointer guard is misconfigured'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' then
    old_row := pg_catalog.to_jsonb(old);
    activation_transition := case tg_table_name
      when 'screens' then
        not (
          coalesce(old_row ->> 'status', 'disabled') <> 'disabled'
          and old_row ->> 'deleted_at' is null
        )
        and coalesce(new_row ->> 'status', 'disabled') <> 'disabled'
        and new_row ->> 'deleted_at' is null
      when 'screen_groups' then
        coalesce(old_row ->> 'status', '') <> 'active'
        and new_row ->> 'status' = 'active'
      when 'content_schedules' then
        not (
          coalesce((old_row ->> 'enabled')::boolean, false)
          and (
            old_row ->> 'ends_at' is null
            or (old_row ->> 'ends_at')::timestamptz >= statement_timestamp()
          )
        )
        and coalesce((new_row ->> 'enabled')::boolean, false)
        and (
          new_row ->> 'ends_at' is null
          or (new_row ->> 'ends_at')::timestamptz >= statement_timestamp()
        )
      when 'player_devices' then
        coalesce(old_row ->> 'status', '') <> 'paired'
        and new_row ->> 'status' = 'paired'
      else false
    end;
  end if;

  for pointer_index in 0..tg_nargs - 1
  loop
    pointer_name := tg_argv[pointer_index];
    new_release_id := nullif(new_row ->> pointer_name, '')::uuid;
    old_release_id := nullif(old_row ->> pointer_name, '')::uuid;
    -- Pointer changes are validated individually so rollout materialization
    -- can atomically advance multi-pointer rows in deterministic steps. When
    -- a dormant resource becomes live again, every surviving pointer is
    -- revalidated, including an unchanged one.
    if new_release_id is not null
      and (
        activation_transition
        or new_release_id is distinct from old_release_id
      )
    then
      perform private.assert_theme_release_pointer_current_v1(
        new.tenant_id,
        new_release_id
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.guard_theme_release_pointers_v1()
  from public, anon, authenticated, service_role;

create trigger screens_guard_current_theme_releases
before insert or update on public.screens
for each row execute function private.guard_theme_release_pointers_v1(
  'assigned_release_id', 'default_release_id'
);

create trigger screen_groups_guard_current_theme_releases
before insert or update on public.screen_groups
for each row execute function private.guard_theme_release_pointers_v1(
  'default_release_id'
);

create trigger content_schedules_guard_current_theme_releases
before insert or update on public.content_schedules
for each row execute function private.guard_theme_release_pointers_v1(
  'release_id'
);

create trigger player_devices_guard_current_theme_releases
before insert or update on public.player_devices
for each row execute function private.guard_theme_release_pointers_v1(
  'desired_release_id'
);

create function private.assert_theme_snapshot_rollout_idle_v1(
  p_tenant_id uuid,
  p_snapshot_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  snapshot_theme_id text;
begin
  select coalesce(
    snapshot.snapshot_data_json
      #>> '{themePresentation,selection,ref,id}',
    version.theme_selection_json #>> '{ref,id}',
    version.configuration_json #>> '{editorial,themeSelection,ref,id}',
    version.configuration_json #>> '{theme,themeId}'
  ) into snapshot_theme_id
  from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slide_versions version
    on version.tenant_id = snapshot.tenant_id
   and version.dynamic_slide_id = snapshot.dynamic_slide_id
   and version.id = snapshot.dynamic_slide_version_id
  where snapshot.tenant_id = p_tenant_id
    and snapshot.id = p_snapshot_id;
  if snapshot_theme_id is null then
    return;
  end if;

  select profile.revision into current_revision
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = snapshot_theme_id
  for share;
  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.tenant_theme_rollouts rollout
    where rollout.tenant_id = p_tenant_id
      and rollout.theme_id = snapshot_theme_id
      and rollout.settings_revision = current_revision
      and rollout.status in ('queued', 'rendering')
  ) then
    raise exception 'theme rollout is still updating this slide'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function private.assert_theme_snapshot_rollout_idle_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

-- Release-only clones are newer rows by definition. Without this guard the
-- generic render completer would promote a historical pinned payload to the
-- logical slide's current pointer purely because its snapshot_sequence is new.
create function private.guard_theme_rollout_snapshot_promotion_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_snapshot_id is not distinct from old.current_snapshot_id
    or not exists (
      select 1
      from private.tenant_theme_rollout_snapshots mapping
      where mapping.tenant_id = new.tenant_id
        and mapping.new_snapshot_id = new.current_snapshot_id
    )
  then
    return new;
  end if;

  if not exists (
    select 1
    from private.tenant_theme_rollout_snapshots mapping
    join public.tenant_theme_rollouts rollout
      on rollout.tenant_id = mapping.tenant_id
     and rollout.id = mapping.rollout_id
    join public.tenant_theme_profiles profile
      on profile.tenant_id = rollout.tenant_id
     and profile.theme_id = rollout.theme_id
     and profile.revision = rollout.settings_revision
    where mapping.tenant_id = new.tenant_id
      and mapping.new_snapshot_id = new.current_snapshot_id
      and mapping.advance_current
      and rollout.status in ('queued', 'rendering')
  ) then
    new.current_snapshot_id := old.current_snapshot_id;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_theme_rollout_snapshot_promotion_v1()
  from public, anon, authenticated, service_role;

create trigger dynamic_slides_guard_theme_rollout_promotion
before update of current_snapshot_id on public.dynamic_slides
for each row execute function private.guard_theme_rollout_snapshot_promotion_v1();

create or replace function private.follow_latest_dynamic_snapshot_in_drafts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer := 0;
  resolved_duration integer;
  page_count integer;
  seconds_per_slide integer;
  rollout_snapshot_allowed boolean;
begin
  select case
    when not exists (
      select 1
      from private.tenant_theme_rollout_snapshots mapping
      where mapping.tenant_id = new.tenant_id
        and mapping.new_snapshot_id = new.id
    ) then true
    else exists (
      select 1
      from private.tenant_theme_rollout_snapshots mapping
      join public.tenant_theme_rollouts rollout
        on rollout.tenant_id = mapping.tenant_id
       and rollout.id = mapping.rollout_id
      join public.tenant_theme_profiles profile
        on profile.tenant_id = rollout.tenant_id
       and profile.theme_id = rollout.theme_id
       and profile.revision = rollout.settings_revision
      where mapping.tenant_id = new.tenant_id
        and mapping.new_snapshot_id = new.id
        and mapping.advance_current
        and rollout.status in ('queued', 'rendering')
    )
  end into rollout_snapshot_allowed;

  if old.status is distinct from 'ready'
    and new.status = 'ready'
    and new.output_media_asset_id is not null
    and rollout_snapshot_allowed
  then
    resolved_duration := null;
    if new.snapshot_data_json ->> 'type' = 'news' then
      page_count := greatest(pg_catalog.jsonb_array_length(coalesce(
        new.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )), 1);
      seconds_per_slide := least(greatest(
        case
          when coalesce(
            new.snapshot_data_json #>> '{news,secondsPerSlide}', ''
          ) ~ '^[0-9]{1,3}$'
          then (new.snapshot_data_json #>> '{news,secondsPerSlide}')::integer
          else 5
        end,
        5
      ), 120);
      resolved_duration := least(page_count * seconds_per_slide, 3600);
    elsif new.snapshot_data_json ->> 'type' = 'sport_birthdays' then
      resolved_duration := private.sportlink_birthday_minimum_duration_v1(
        new.snapshot_data_json
      );
    end if;

    with changed_items as (
      update public.playlist_items item
      set dynamic_snapshot_id = new.id,
          media_asset_id = new.output_media_asset_id,
          duration_seconds = coalesce(resolved_duration, item.duration_seconds),
          updated_at = now()
      where item.tenant_id = new.tenant_id
        and item.dynamic_slide_id = new.dynamic_slide_id
        and item.dynamic_selection_mode = 'latest'
      returning item.playlist_id
    ), changed_playlists as (
      select distinct playlist_id from changed_items
    )
    update public.playlists playlist
    set revision = playlist.revision + 1,
        updated_at = now()
    where playlist.tenant_id = new.tenant_id
      and playlist.id in (
        select changed.playlist_id from changed_playlists changed
      );
    get diagnostics affected_count = row_count;

    if affected_count > 0 then
      insert into public.audit_events(
        tenant_id, action, target_type, target_id, result, metadata
      ) values (
        new.tenant_id,
        'dynamic.draft_snapshot.followed',
        'dynamic_slide_snapshots',
        new.id,
        'success',
        pg_catalog.jsonb_build_object(
          'systemExecuted', true,
          'playlistCount', affected_count,
          'dynamicSlideId', new.dynamic_slide_id,
          'durationSeconds', resolved_duration
        )
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.follow_latest_dynamic_snapshot_in_drafts()
  from public, anon, authenticated, service_role;

create function private.refresh_theme_rollout_progress_v1(
  p_tenant_id uuid,
  p_rollout_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failed_branch_count integer;
  v_failed_snapshot_count integer;
  v_ready_branch_count integer;
  v_ready_snapshot_count integer;
  rollout public.tenant_theme_rollouts%rowtype;
  v_terminal_branch_count integer;
  v_total_branch_count integer;
  v_total_snapshot_count integer;
begin
  select * into rollout
  from public.tenant_theme_rollouts
  where tenant_id = p_tenant_id
    and id = p_rollout_id
  for update;
  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.tenant_theme_profiles profile
    where profile.tenant_id = rollout.tenant_id
      and profile.theme_id = rollout.theme_id
      and profile.revision = rollout.settings_revision
  ) then
    update public.tenant_theme_rollouts
    set status = 'failed',
        error_code = 'THEME_ROLLOUT_SUPERSEDED',
        completed_at = now()
    where tenant_id = rollout.tenant_id and id = rollout.id;
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where snapshot.status = 'ready')::integer,
    count(*) filter (where snapshot.status = 'failed')::integer
  into v_total_snapshot_count, v_ready_snapshot_count, v_failed_snapshot_count
  from (
    select distinct mapped.tenant_id, mapped.new_snapshot_id
    from private.tenant_theme_rollout_snapshots mapped
    where mapped.tenant_id = rollout.tenant_id
      and mapped.rollout_id = rollout.id
  ) mapping
  join public.dynamic_slide_snapshots snapshot
    on snapshot.tenant_id = mapping.tenant_id
   and snapshot.id = mapping.new_snapshot_id
  ;

  if v_failed_snapshot_count > 0 then
    update public.tenant_theme_rollouts
    set snapshot_count = v_total_snapshot_count,
        ready_snapshot_count = v_ready_snapshot_count,
        status = 'failed',
        error_code = coalesce(error_code, 'THEME_RENDER_FAILED'),
        completed_at = now()
    where tenant_id = rollout.tenant_id and id = rollout.id;
    return;
  end if;

  if v_ready_snapshot_count = v_total_snapshot_count then
    update public.dynamic_slides slide
    set current_snapshot_id = mapping.new_snapshot_id,
        status = 'ready',
        last_error_code = null
    from private.tenant_theme_rollout_snapshots mapping
    where mapping.tenant_id = rollout.tenant_id
      and mapping.rollout_id = rollout.id
      and mapping.advance_current
      and slide.tenant_id = mapping.tenant_id
      and slide.id = mapping.dynamic_slide_id
      and slide.current_snapshot_id = mapping.old_snapshot_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where branch.status = 'ready')::integer,
    count(*) filter (
      where branch.status in ('ready', 'superseded')
    )::integer,
    count(*) filter (where branch.status = 'failed')::integer
  into v_total_branch_count, v_ready_branch_count,
       v_terminal_branch_count, v_failed_branch_count
  from private.tenant_theme_rollout_release_branches branch
  where branch.tenant_id = rollout.tenant_id
    and branch.rollout_id = rollout.id;

  update public.tenant_theme_rollouts target
  set snapshot_count = v_total_snapshot_count,
      ready_snapshot_count = v_ready_snapshot_count,
      release_target_count = v_total_branch_count,
      release_count = v_ready_branch_count,
      status = case
        when v_failed_branch_count > 0 then 'failed'
        when v_ready_snapshot_count = v_total_snapshot_count
          and v_terminal_branch_count = v_total_branch_count
          then 'ready'
        else 'rendering'
      end,
      error_code = case
        when v_failed_branch_count > 0
          then coalesce(target.error_code, 'THEME_RELEASE_FAILED')
        else null
      end,
      completed_at = case
        when v_failed_branch_count > 0
          or (
            v_ready_snapshot_count = v_total_snapshot_count
            and v_terminal_branch_count = v_total_branch_count
          )
        then now()
        else null
      end
  where target.tenant_id = rollout.tenant_id
    and target.id = rollout.id;
end;
$$;

revoke all on function private.refresh_theme_rollout_progress_v1(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.finalize_theme_rollout_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_rollout record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  for linked_rollout in
    select distinct mapping.tenant_id, mapping.rollout_id
    from private.tenant_theme_rollout_snapshots mapping
    where mapping.tenant_id = new.tenant_id
      and mapping.new_snapshot_id = new.id
  loop
    if new.status = 'failed' then
      update public.tenant_theme_rollouts rollout
      set status = 'failed',
          error_code = coalesce(new.error_code, 'THEME_RENDER_FAILED'),
          completed_at = now()
      where rollout.tenant_id = linked_rollout.tenant_id
        and rollout.id = linked_rollout.rollout_id
        and rollout.status in ('queued', 'rendering');
    else
      perform private.refresh_theme_rollout_progress_v1(
        linked_rollout.tenant_id,
        linked_rollout.rollout_id
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.finalize_theme_rollout_snapshot_v1()
  from public, anon, authenticated, service_role;

drop trigger playlist_release_items_track_theme_rollout
  on public.playlist_release_items;

create function private.start_tenant_theme_rollout_v2(
  p_tenant_id uuid,
  p_theme_id text,
  p_settings_revision bigint,
  p_created_by uuid,
  p_retry_of_rollout_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_release_count integer := 0;
  content_hash text;
  v_new_snapshot_id uuid;
  v_rollout_id uuid;
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  snapshot_already_mapped boolean;
  snapshot_total integer := 0;
  source_snapshot record;
begin
  if not exists (
    select 1
    from public.tenant_theme_profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.theme_id = p_theme_id
      and profile.revision = p_settings_revision
  ) then
    raise exception 'tenant theme revision is unavailable' using errcode = '40001';
  end if;

  insert into public.tenant_theme_rollouts(
    tenant_id, theme_id, settings_revision, status, created_by,
    retry_of_rollout_id
  ) values (
    p_tenant_id, p_theme_id, p_settings_revision, 'queued', p_created_by,
    p_retry_of_rollout_id
  ) returning id into v_rollout_id;

  for source_snapshot in
    with active_releases as (
      select release_id
      from private.theme_rollout_active_release_ids_v1(p_tenant_id)
    ), source_ids as (
      select slide.current_snapshot_id as old_snapshot_id, true as advance_current
      from public.dynamic_slides slide
      where slide.tenant_id = p_tenant_id
        and slide.status <> 'archived'
        and slide.current_published_version_id is not null
        and slide.current_snapshot_id is not null
      union all
      select release_item.dynamic_snapshot_id, false
      from active_releases active_release
      join public.playlist_release_items release_item
        on release_item.tenant_id = p_tenant_id
       and release_item.release_id = active_release.release_id
      where release_item.dynamic_snapshot_id is not null
    ), collapsed as (
      select old_snapshot_id, bool_or(advance_current) as advance_current
      from source_ids
      where old_snapshot_id is not null
      group by old_snapshot_id
    )
    select snapshot.*, collapsed.advance_current
    from collapsed
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = p_tenant_id
     and snapshot.id = collapsed.old_snapshot_id
     and snapshot.status = 'ready'
     and snapshot.output_media_asset_id is not null
    join public.dynamic_slide_versions version
      on version.tenant_id = snapshot.tenant_id
     and version.dynamic_slide_id = snapshot.dynamic_slide_id
     and version.id = snapshot.dynamic_slide_version_id
    where coalesce(
      snapshot.snapshot_data_json #>> '{themePresentation,selection,ref,id}',
      version.theme_selection_json #>> '{ref,id}',
      version.configuration_json #>> '{editorial,themeSelection,ref,id}',
      version.configuration_json #>> '{theme,themeId}'
    ) = p_theme_id
    order by snapshot.dynamic_slide_id, snapshot.id
  loop
    select * into slide_record
    from public.dynamic_slides slide
    where slide.tenant_id = source_snapshot.tenant_id
      and slide.id = source_snapshot.dynamic_slide_id;
    if not found then
      raise exception 'rollout source slide is unavailable' using errcode = 'P0002';
    end if;

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
    where version.tenant_id = source_snapshot.tenant_id
      and version.dynamic_slide_id = source_snapshot.dynamic_slide_id
      and version.id = source_snapshot.dynamic_slide_version_id;
    if not found then
      raise exception 'rollout source version is unavailable' using errcode = 'P0002';
    end if;

    snapshot_data := private.apply_tenant_theme_to_snapshot_v1(
      p_tenant_id,
      source_snapshot.snapshot_data_json,
      v_rollout_id
    );
    content_hash := private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot_data
    );

    v_new_snapshot_id := null;
    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      created_by
    ) values (
      source_snapshot.tenant_id,
      source_snapshot.dynamic_slide_id,
      source_snapshot.dynamic_slide_version_id,
      source_snapshot.template_version_id,
      source_snapshot.data_source_id,
      content_hash,
      snapshot_data,
      p_created_by
    )
    on conflict (
      dynamic_slide_id,
      dynamic_slide_version_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id into v_new_snapshot_id;

    if v_new_snapshot_id is null then
      select snapshot.id into v_new_snapshot_id
      from public.dynamic_slide_snapshots snapshot
      where snapshot.tenant_id = source_snapshot.tenant_id
        and snapshot.dynamic_slide_id = source_snapshot.dynamic_slide_id
        and snapshot.dynamic_slide_version_id =
          source_snapshot.dynamic_slide_version_id
        and snapshot.source_revision_hash = content_hash
        and snapshot.template_version_id = source_snapshot.template_version_id;
    end if;
    if v_new_snapshot_id is null then
      raise exception 'theme rollout snapshot could not be resolved'
        using errcode = '55000';
    end if;

    select exists (
      select 1
      from private.tenant_theme_rollout_snapshots mapping
      where mapping.tenant_id = p_tenant_id
        and mapping.rollout_id = v_rollout_id
        and mapping.new_snapshot_id = v_new_snapshot_id
    ) into snapshot_already_mapped;

    insert into private.tenant_theme_rollout_snapshots(
      tenant_id,
      rollout_id,
      dynamic_slide_id,
      old_snapshot_id,
      new_snapshot_id,
      advance_current
    ) values (
      p_tenant_id,
      v_rollout_id,
      source_snapshot.dynamic_slide_id,
      source_snapshot.id,
      v_new_snapshot_id,
      source_snapshot.advance_current
    );

    if not snapshot_already_mapped then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (p_tenant_id, v_new_snapshot_id)
      on conflict (snapshot_id) do nothing;
      snapshot_total := snapshot_total + 1;
    end if;
  end loop;

  insert into private.tenant_theme_rollout_release_branches(
    tenant_id, rollout_id, source_release_id
  )
  select distinct p_tenant_id, v_rollout_id, active_release.release_id
  from private.theme_rollout_active_release_ids_v1(p_tenant_id) active_release
  join public.playlist_release_items release_item
    on release_item.tenant_id = p_tenant_id
   and release_item.release_id = active_release.release_id
  join private.tenant_theme_rollout_snapshots mapping
    on mapping.tenant_id = release_item.tenant_id
   and mapping.rollout_id = v_rollout_id
   and mapping.old_snapshot_id = release_item.dynamic_snapshot_id;
  get diagnostics active_release_count = row_count;

  update public.tenant_theme_rollouts rollout
  set snapshot_count = snapshot_total,
      ready_snapshot_count = 0,
      release_target_count = active_release_count,
      release_count = 0,
      status = case when snapshot_total = 0 then 'ready' else 'rendering' end,
      completed_at = case when snapshot_total = 0 then now() else null end
  where rollout.tenant_id = p_tenant_id
    and rollout.id = v_rollout_id;

  return v_rollout_id;
end;
$$;

revoke all on function private.start_tenant_theme_rollout_v2(
  uuid, text, bigint, uuid, uuid
) from public, anon, authenticated, service_role;

create function private.clone_theme_target_snapshot_v1(
  p_tenant_id uuid,
  p_source_snapshot_id uuid,
  p_replacement_release_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_snapshot_id uuid;
  source_snapshot public.publisher_target_snapshots%rowtype;
begin
  select * into source_snapshot
  from public.publisher_target_snapshots snapshot
  where snapshot.tenant_id = p_tenant_id
    and snapshot.id = p_source_snapshot_id;
  if not found then
    raise exception 'publisher target snapshot is unavailable'
      using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.id = p_replacement_release_id
  ) then
    raise exception 'replacement target release is unavailable'
      using errcode = '23514';
  end if;

  insert into public.publisher_target_snapshots(
    tenant_id,
    release_id,
    schedule_id,
    source_kind,
    source_id,
    target_count,
    targets_json,
    snapshot_hash,
    resolved_by,
    resolved_at
  ) values (
    source_snapshot.tenant_id,
    p_replacement_release_id,
    source_snapshot.schedule_id,
    source_snapshot.source_kind,
    source_snapshot.source_id,
    source_snapshot.target_count,
    source_snapshot.targets_json,
    source_snapshot.snapshot_hash,
    null,
    now()
  ) returning id into replacement_snapshot_id;

  insert into public.publisher_target_snapshot_screens(
    tenant_id,
    snapshot_id,
    screen_id,
    provenance_kind,
    provenance_id,
    created_at
  )
  select
    target.tenant_id,
    replacement_snapshot_id,
    target.screen_id,
    target.provenance_kind,
    target.provenance_id,
    now()
  from public.publisher_target_snapshot_screens target
  where target.tenant_id = p_tenant_id
    and target.snapshot_id = p_source_snapshot_id
  order by target.screen_id;

  return replacement_snapshot_id;
end;
$$;

revoke all on function private.clone_theme_target_snapshot_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create function private.clone_theme_release_branch_v1(
  p_tenant_id uuid,
  p_rollout_id uuid,
  p_source_release_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_default_screen_ids uuid[];
  manifest_document jsonb;
  manifest_hash text;
  manifest_items jsonb;
  new_release_id uuid;
  next_version integer;
  new_target_snapshot_id uuid;
  release_published_at timestamptz := clock_timestamp();
  replaced_item_count integer;
  resolved_snapshot_by_sort_order jsonb;
  schedule_record public.content_schedules%rowtype;
  source_release public.playlist_releases%rowtype;
  switched_schedule_screen_ids uuid[];
  total_bytes bigint;
begin
  select * into source_release
  from public.playlist_releases release
  where release.tenant_id = p_tenant_id
    and release.id = p_source_release_id;
  if not found then
    raise exception 'theme source release is unavailable' using errcode = 'P0002';
  end if;

  -- Match manual Publisher ordering before deriving the next immutable version.
  perform 1
  from public.playlists playlist
  where playlist.tenant_id = source_release.tenant_id
    and playlist.id = source_release.playlist_id
    and playlist.status <> 'archived'
  for update;
  if not found then
    return null;
  end if;

  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and (
      screen.assigned_release_id = p_source_release_id
      or screen.default_release_id = p_source_release_id
    )
  order by screen.id
  for update;
  perform 1
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
   and screen.id = device.screen_id
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and screen.assigned_release_id = p_source_release_id
    and device.status = 'paired'
  order by device.id
  for update of device;
  perform 1
  from public.screen_groups screen_group
  where screen_group.tenant_id = p_tenant_id
    and screen_group.status = 'active'
    and screen_group.default_release_id = p_source_release_id
  order by screen_group.id
  for update;
  perform 1
  from public.content_schedules schedule
  where schedule.tenant_id = p_tenant_id
    and schedule.release_id = p_source_release_id
    and (
      (
        schedule.enabled
        and (
          schedule.ends_at is null
          or schedule.ends_at >= statement_timestamp()
        )
      )
      or exists (
        select 1
        from public.screens active_screen
        where active_screen.tenant_id = schedule.tenant_id
          and active_screen.active_schedule_id = schedule.id
          and active_screen.status <> 'disabled'
          and active_screen.deleted_at is null
      )
    )
  order by schedule.id
  for update;

  if not exists (
    select 1
    from private.theme_rollout_active_release_ids_v1(p_tenant_id) active_release
    where active_release.release_id = p_source_release_id
  ) then
    return null;
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      release_item.sort_order::text,
      pg_catalog.to_jsonb(mapping.new_snapshot_id)
    ),
    '{}'::jsonb
  )
  into resolved_snapshot_by_sort_order
  from public.playlist_release_items release_item
  join private.tenant_theme_rollout_snapshots mapping
    on mapping.tenant_id = release_item.tenant_id
   and mapping.rollout_id = p_rollout_id
   and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id;

  select count(*)::integer
  into replaced_item_count
  from public.playlist_release_items release_item
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id
    and resolved_snapshot_by_sort_order ? release_item.sort_order::text;
  if replaced_item_count = 0 then
    return null;
  end if;

  if exists (
    select 1
    from public.playlist_release_items release_item
    join private.tenant_theme_rollout_snapshots mapping
      on mapping.tenant_id = release_item.tenant_id
     and mapping.rollout_id = p_rollout_id
     and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
    left join public.dynamic_slide_snapshots replacement_snapshot
      on replacement_snapshot.tenant_id = mapping.tenant_id
     and replacement_snapshot.id = mapping.new_snapshot_id
     and replacement_snapshot.status = 'ready'
     and replacement_snapshot.output_media_asset_id is not null
    left join public.media_assets replacement_asset
      on replacement_asset.tenant_id = replacement_snapshot.tenant_id
     and replacement_asset.id = replacement_snapshot.output_media_asset_id
     and replacement_asset.status = 'ready'
     and replacement_asset.deleted_at is null
    left join public.media_variants replacement_variant
      on replacement_variant.tenant_id = replacement_asset.tenant_id
     and replacement_variant.asset_id = replacement_asset.id
     and replacement_variant.variant_type = 'original'
    where release_item.tenant_id = p_tenant_id
      and release_item.release_id = p_source_release_id
      and (
        replacement_snapshot.id is null
        or replacement_asset.id is null
        or replacement_variant.id is null
      )
  ) then
    raise exception 'theme release replacement render is incomplete'
      using errcode = '55000';
  end if;

  select
    pg_catalog.jsonb_agg(
      case
        when replacement_snapshot.id is not null
        then manifest_item.value || pg_catalog.jsonb_build_object(
          'mediaAssetId', replacement_asset.id,
          'mediaVariantId', replacement_variant.id,
          'kind', replacement_asset.kind,
          'title', replacement_asset.title,
          'storage', pg_catalog.jsonb_build_object(
            'bucket', replacement_variant.storage_bucket,
            'path', replacement_variant.storage_path,
            'mimeType', replacement_variant.mime_type,
            'bytes', replacement_variant.file_size_bytes,
            'checksumSha256', replacement_variant.checksum_sha256
          ),
          'metadata', coalesce(
            manifest_item.value -> 'metadata', '{}'::jsonb
          ) || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'width', replacement_variant.width,
            'height', replacement_variant.height,
            'durationSeconds', replacement_variant.duration_seconds
          ))
        )
        else manifest_item.value
      end
      order by manifest_item.ordinality
    ),
    sum(
      case when replacement_snapshot.id is not null
        then replacement_variant.file_size_bytes
        else release_item.file_size_bytes
      end
    )::bigint
  into manifest_items, total_bytes
  from pg_catalog.jsonb_array_elements(source_release.manifest_json -> 'items')
    with ordinality as manifest_item(value, ordinality)
  join public.playlist_release_items release_item
    on release_item.tenant_id = source_release.tenant_id
   and release_item.release_id = source_release.id
   and release_item.sort_order = manifest_item.ordinality - 1
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original';
  if manifest_items is null or total_bytes is null then
    raise exception 'theme release manifest could not be materialized'
      using errcode = '55000';
  end if;

  select coalesce(max(release.version), 0) + 1
  into next_version
  from public.playlist_releases release
  where release.tenant_id = source_release.tenant_id
    and release.playlist_id = source_release.playlist_id;
  manifest_document := source_release.manifest_json || pg_catalog.jsonb_build_object(
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

  insert into public.playlist_releases(
    tenant_id, playlist_id, version, release_notes, manifest_hash,
    manifest_json, item_count, total_duration_seconds, total_bytes,
    published_by, published_at
  ) values (
    source_release.tenant_id,
    source_release.playlist_id,
    next_version,
    'Geforceerde FieldFlow-thema-uitrol',
    manifest_hash,
    manifest_document,
    source_release.item_count,
    source_release.total_duration_seconds,
    total_bytes,
    null,
    release_published_at
  ) returning id into new_release_id;

  insert into public.playlist_release_items(
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
    coalesce(replacement_asset.id, release_item.media_asset_id),
    coalesce(replacement_variant.id, release_item.media_variant_id),
    release_item.sort_order,
    release_item.duration_seconds,
    release_item.fit_mode,
    release_item.muted,
    coalesce(replacement_asset.kind, release_item.asset_kind),
    coalesce(replacement_asset.title, release_item.asset_title),
    coalesce(replacement_variant.storage_bucket, release_item.storage_bucket),
    coalesce(replacement_variant.storage_path, release_item.storage_path),
    coalesce(replacement_variant.mime_type, release_item.mime_type),
    coalesce(replacement_variant.file_size_bytes, release_item.file_size_bytes),
    coalesce(replacement_variant.checksum_sha256, release_item.checksum_sha256),
    coalesce(replacement_variant.width, release_item.width),
    coalesce(replacement_variant.height, release_item.height),
    coalesce(
      replacement_variant.duration_seconds,
      release_item.asset_duration_seconds
    ),
    coalesce(replacement_snapshot.id, release_item.dynamic_snapshot_id),
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
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original'
  where release_item.tenant_id = source_release.tenant_id
    and release_item.release_id = source_release.id
  order by release_item.sort_order;

  insert into public.playlist_release_authoring_snapshots(
    tenant_id, playlist_id, release_id, snapshot_json, snapshot_hash
  )
  select
    snapshot.tenant_id,
    snapshot.playlist_id,
    new_release_id,
    snapshot.snapshot_json,
    snapshot.snapshot_hash
  from public.playlist_release_authoring_snapshots snapshot
  where snapshot.tenant_id = source_release.tenant_id
    and snapshot.release_id = source_release.id
  on conflict do nothing;

  -- Defaults are independent from a currently active schedule assignment.
  update public.screens screen
  set default_release_id = new_release_id
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = source_release.playlist_id
    and screen.default_release_id = source_release.id
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  update public.screen_groups screen_group
  set default_release_id = new_release_id,
      revision = screen_group.revision + 1,
      updated_at = now()
  where screen_group.tenant_id = p_tenant_id
    and screen_group.default_playlist_id = source_release.playlist_id
    and screen_group.default_release_id = source_release.id
    and screen_group.status = 'active';

  -- A schedule keeps its exact immutable target set and provenance. Only its
  -- immutable release pointer and target snapshot are superseded.
  for schedule_record in
    select schedule.*
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and schedule.release_id = source_release.id
      and (
        (
          schedule.enabled
          and (
            schedule.ends_at is null
            or schedule.ends_at >= statement_timestamp()
          )
        )
        or exists (
          select 1
          from public.screens active_screen
          where active_screen.tenant_id = schedule.tenant_id
            and active_screen.active_schedule_id = schedule.id
            and active_screen.status <> 'disabled'
            and active_screen.deleted_at is null
        )
      )
    order by schedule.id
    for update
  loop
    if schedule_record.target_snapshot_id is null then
      raise exception 'active schedule target snapshot is unavailable'
        using errcode = '55000';
    end if;
    new_target_snapshot_id := private.clone_theme_target_snapshot_v1(
      p_tenant_id,
      schedule_record.target_snapshot_id,
      new_release_id
    );
    update public.content_schedules schedule
    set playlist_id = source_release.playlist_id,
        release_id = new_release_id,
        target_snapshot_id = new_target_snapshot_id,
        revision = schedule.revision + 1,
        updated_at = now()
    where schedule.tenant_id = p_tenant_id
      and schedule.id = schedule_record.id
      and schedule.release_id = source_release.id
      and schedule.target_snapshot_id = schedule_record.target_snapshot_id;

    select pg_catalog.array_agg(screen.id order by screen.id)
    into switched_schedule_screen_ids
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.active_schedule_id = schedule_record.id
      and screen.assigned_release_id = source_release.id
      and screen.status <> 'disabled'
      and screen.deleted_at is null;
    if coalesce(pg_catalog.array_length(switched_schedule_screen_ids, 1), 0) > 0
    then
      update public.screens screen
      set assigned_playlist_id = source_release.playlist_id,
          assigned_release_id = new_release_id,
          active_target_snapshot_id = new_target_snapshot_id
      where screen.tenant_id = p_tenant_id
        and screen.id = any(switched_schedule_screen_ids)
        and screen.active_schedule_id = schedule_record.id
        and screen.assigned_release_id = source_release.id;
      update public.player_devices device
      set desired_release_id = new_release_id
      where device.tenant_id = p_tenant_id
        and device.screen_id = any(switched_schedule_screen_ids)
        and device.status = 'paired'
        and device.desired_release_id = source_release.id;
      insert into public.release_screen_assignments(
        tenant_id, release_id, screen_id, assignment_kind,
        assigned_by, target_snapshot_id
      )
      select
        p_tenant_id,
        new_release_id,
        screen_id,
        'scheduled',
        null,
        new_target_snapshot_id
      from unnest(switched_schedule_screen_ids) screen_id;
    end if;
  end loop;

  select pg_catalog.array_agg(screen.id order by screen.id)
  into active_default_screen_ids
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.assigned_release_id = source_release.id
    and screen.active_assignment_source = 'default'
    and screen.active_schedule_id is null
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  if coalesce(pg_catalog.array_length(active_default_screen_ids, 1), 0) > 0 then
    new_target_snapshot_id := private.create_publisher_target_snapshot(
      p_tenant_id,
      new_release_id,
      null,
      'direct',
      null,
      active_default_screen_ids,
      null
    );
    update public.screens screen
    set assigned_playlist_id = source_release.playlist_id,
        assigned_release_id = new_release_id,
        active_target_snapshot_id = new_target_snapshot_id
    where screen.tenant_id = p_tenant_id
      and screen.id = any(active_default_screen_ids)
      and screen.assigned_release_id = source_release.id
      and screen.active_assignment_source = 'default'
      and screen.active_schedule_id is null;
    update public.player_devices device
    set desired_release_id = new_release_id
    where device.tenant_id = p_tenant_id
      and device.screen_id = any(active_default_screen_ids)
      and device.status = 'paired'
      and device.desired_release_id = source_release.id;
    insert into public.release_screen_assignments(
      tenant_id, release_id, screen_id, assignment_kind,
      assigned_by, target_snapshot_id
    )
    select
      p_tenant_id,
      new_release_id,
      screen_id,
      'reassigned',
      null,
      new_target_snapshot_id
    from unnest(active_default_screen_ids) screen_id;
  end if;

  insert into private.tenant_theme_rollout_releases(
    tenant_id, rollout_id, release_id
  ) values (p_tenant_id, p_rollout_id, new_release_id)
  on conflict do nothing;

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.release_cloned',
    'playlist_releases',
    new_release_id,
    'success',
    pg_catalog.jsonb_build_object(
      'systemExecuted', true,
      'rolloutId', p_rollout_id,
      'sourceReleaseId', source_release.id,
      'playlistId', source_release.playlist_id,
      'version', next_version,
      'replacedItemCount', replaced_item_count,
      'activeReleasePreserved', true
    )
  );
  return new_release_id;
end;
$$;

revoke all on function private.clone_theme_release_branch_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create function private.process_theme_rollout_release_branches_v1(
  p_tenant_id uuid,
  p_rollout_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch private.tenant_theme_rollout_release_branches%rowtype;
  failure_code text;
  failure_detail text;
  processed_count integer := 0;
  v_replacement_release_id uuid;
begin
  if not exists (
    select 1
    from public.tenant_theme_rollouts rollout
    join public.tenant_theme_profiles profile
      on profile.tenant_id = rollout.tenant_id
     and profile.theme_id = rollout.theme_id
     and profile.revision = rollout.settings_revision
    where rollout.tenant_id = p_tenant_id
      and rollout.id = p_rollout_id
      and rollout.status in ('queued', 'rendering')
  ) then
    perform private.refresh_theme_rollout_progress_v1(
      p_tenant_id,
      p_rollout_id
    );
    return 0;
  end if;

  for branch in
    select candidate.*
    from private.tenant_theme_rollout_release_branches candidate
    where candidate.tenant_id = p_tenant_id
      and candidate.rollout_id = p_rollout_id
      and candidate.status = 'queued'
      and candidate.not_before <= clock_timestamp()
    order by candidate.source_release_id
    for update skip locked
  loop
    if exists (
      select 1
      from public.playlist_release_items release_item
      join private.tenant_theme_rollout_snapshots mapping
        on mapping.tenant_id = release_item.tenant_id
       and mapping.rollout_id = p_rollout_id
       and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
      join public.dynamic_slide_snapshots replacement_snapshot
        on replacement_snapshot.tenant_id = mapping.tenant_id
       and replacement_snapshot.id = mapping.new_snapshot_id
      where release_item.tenant_id = p_tenant_id
        and release_item.release_id = branch.source_release_id
        and replacement_snapshot.status <> 'ready'
    ) then
      continue;
    end if;

    update private.tenant_theme_rollout_release_branches candidate
    set status = 'processing',
        attempt_count = candidate.attempt_count + 1,
        error_code = null,
        error_detail = null
    where candidate.tenant_id = branch.tenant_id
      and candidate.rollout_id = branch.rollout_id
      and candidate.source_release_id = branch.source_release_id;

    begin
      v_replacement_release_id := private.clone_theme_release_branch_v1(
        branch.tenant_id,
        branch.rollout_id,
        branch.source_release_id
      );
      update private.tenant_theme_rollout_release_branches candidate
      set status = case
            when v_replacement_release_id is null then 'superseded'
            else 'ready'
          end,
          replacement_release_id = v_replacement_release_id,
          completed_at = now()
      where candidate.tenant_id = branch.tenant_id
        and candidate.rollout_id = branch.rollout_id
        and candidate.source_release_id = branch.source_release_id;
      processed_count := processed_count + 1;
    exception when others then
      get stacked diagnostics
        failure_code = returned_sqlstate,
        failure_detail = message_text;
      update private.tenant_theme_rollout_release_branches candidate
      set status = 'failed',
          error_code = left(coalesce(failure_code, 'P0001'), 120),
          error_detail = left(coalesce(failure_detail, 'unknown failure'), 500),
          completed_at = now()
      where candidate.tenant_id = branch.tenant_id
        and candidate.rollout_id = branch.rollout_id
        and candidate.source_release_id = branch.source_release_id;
    end;
  end loop;

  perform private.refresh_theme_rollout_progress_v1(
    p_tenant_id,
    p_rollout_id
  );
  return processed_count;
end;
$$;

revoke all on function private.process_theme_rollout_release_branches_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

-- Replace the earlier trigger body now that the release materializer exists.
create or replace function private.finalize_theme_rollout_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_rollout record;
  ready_count integer;
  total_count integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  for linked_rollout in
    select distinct mapping.tenant_id, mapping.rollout_id
    from private.tenant_theme_rollout_snapshots mapping
    where mapping.tenant_id = new.tenant_id
      and mapping.new_snapshot_id = new.id
  loop
    if new.status = 'failed' then
      update public.tenant_theme_rollouts rollout
      set status = 'failed',
          error_code = coalesce(new.error_code, 'THEME_RENDER_FAILED'),
          completed_at = now()
      where rollout.tenant_id = linked_rollout.tenant_id
        and rollout.id = linked_rollout.rollout_id
        and rollout.status in ('queued', 'rendering');
      continue;
    end if;

    perform private.refresh_theme_rollout_progress_v1(
      linked_rollout.tenant_id,
      linked_rollout.rollout_id
    );
    select
      count(*)::integer,
      count(*) filter (where snapshot.status = 'ready')::integer
    into total_count, ready_count
    from private.tenant_theme_rollout_snapshots mapping
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = mapping.tenant_id
     and snapshot.id = mapping.new_snapshot_id
    where mapping.tenant_id = linked_rollout.tenant_id
      and mapping.rollout_id = linked_rollout.rollout_id;
    if total_count = ready_count and exists (
      select 1
      from public.tenant_theme_rollouts rollout
      join public.tenant_theme_profiles profile
        on profile.tenant_id = rollout.tenant_id
       and profile.theme_id = rollout.theme_id
       and profile.revision = rollout.settings_revision
      where rollout.tenant_id = linked_rollout.tenant_id
        and rollout.id = linked_rollout.rollout_id
        and rollout.status in ('queued', 'rendering')
    ) then
      perform private.process_theme_rollout_release_branches_v1(
        linked_rollout.tenant_id,
        linked_rollout.rollout_id
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.finalize_theme_rollout_snapshot_v1()
  from public, anon, authenticated, service_role;

-- The public save contract is replaced after all rollout primitives exist.
-- Provider payloads are never rebuilt here: both a normal save and a retry
-- enter the same immutable v2 planner above.
create or replace function public.update_tenant_theme_settings_v3(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_color_overrides jsonb,
  p_appearance jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_profile public.tenant_theme_profiles%rowtype;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else pg_catalog.upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else pg_catalog.upper(p_support)
  end;
  rollout public.tenant_theme_rollouts%rowtype;
  rollout_id uuid;
  selection jsonb;
  theme_changed boolean;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.settings.manage'
  ) then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  selection := pg_catalog.jsonb_build_object(
    'ref', pg_catalog.jsonb_build_object(
      'catalog', 'v2',
      'id', p_theme_id,
      'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case when normalized_accent is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_accent) end,
    'support', case when normalized_support is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_support) end,
    'categoryOverrides', '[]'::jsonb
  );

  if p_theme_id is distinct from 'fieldflow'
    or p_theme_version is distinct from '1.0.0'
    or not private.theme_selection_is_valid_v1(selection)
    or p_color_overrides is null
    or (
      p_color_overrides <> '{}'::jsonb
      and not private.tenant_theme_color_overrides_is_valid_v1(
        p_color_overrides
      )
    )
    or not private.theme_appearance_settings_is_valid_v1(p_appearance)
  then
    raise exception 'tenant theme settings are invalid'
      using errcode = '23514';
  end if;

  perform settings.tenant_id
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant settings not found' using errcode = 'P0002';
  end if;

  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
  for update;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  if current_profile.revision <> p_expected_revision then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  theme_changed :=
    current_profile.theme_version is distinct from p_theme_version
    or current_profile.selection_json is distinct from selection
    or current_profile.color_overrides is distinct from p_color_overrides
    or current_profile.appearance_config is distinct from p_appearance;
  if not theme_changed then
    return pg_catalog.jsonb_build_object(
      'outcome', 'noop',
      'queuedSnapshotCount', 0,
      'snapshotCount', 0,
      'releaseTargetCount', 0,
      'revision', current_profile.revision
    );
  end if;

  -- A design version that is still publishing has no stable immutable source
  -- snapshot yet. Wait instead of mixing two theme revisions in one version.
  perform slide.id
  from public.dynamic_slides slide
  where slide.tenant_id = p_tenant_id
    and slide.status <> 'archived'
    and slide.current_published_version_id is not null
  order by slide.id
  for update;
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
  ) then
    raise exception 'wait for active slide publication before theme rollout'
      using errcode = '55000';
  end if;

  next_revision := current_profile.revision + 1;
  update public.tenant_theme_profiles profile
  set theme_version = p_theme_version,
      selection_json = selection,
      color_overrides = p_color_overrides,
      appearance_config = p_appearance,
      revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id;

  -- tenant_settings remains a compatibility mirror for old readers only.
  update public.tenant_settings settings
  set default_theme_id = p_theme_id,
      default_theme_version = p_theme_version,
      theme_mode_policy = p_mode_policy,
      theme_accent = normalized_accent,
      theme_support = normalized_support,
      theme_color_overrides = p_color_overrides,
      theme_settings_revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where settings.tenant_id = p_tenant_id;

  rollout_id := private.start_tenant_theme_rollout_v2(
    p_tenant_id,
    p_theme_id,
    next_revision,
    actor_id,
    null
  );
  select candidate.* into rollout
  from public.tenant_theme_rollouts candidate
  where candidate.tenant_id = p_tenant_id
    and candidate.id = rollout_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.updated',
    'tenant_theme_profiles',
    p_tenant_id,
    'success',
    pg_catalog.jsonb_build_object(
      'themeId', p_theme_id,
      'themeVersion', p_theme_version,
      'settingsRevision', next_revision,
      'rolloutId', rollout_id,
      'snapshotCount', rollout.snapshot_count,
      'releaseTargetCount', rollout.release_target_count,
      'immutable', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', rollout.snapshot_count,
    'snapshotCount', rollout.snapshot_count,
    'releaseTargetCount', rollout.release_target_count,
    'revision', next_revision,
    'rolloutId', rollout_id,
    'status', rollout.status
  );
end;
$$;

revoke all on function public.update_tenant_theme_settings_v3(
  uuid, bigint, text, text, jsonb, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_theme_settings_v3(
  uuid, bigint, text, text, jsonb, jsonb, jsonb, text, text
) to authenticated;

-- Backwards-compatible routes preserve settings introduced after their API
-- version. Normal saves delegate to v3; the v2 in-flight publishing edge keeps
-- the historical compare-and-swap contract while refreshing that same draft.
create or replace function public.update_tenant_theme_settings_v1(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preserved_appearance jsonb;
  preserved_colors jsonb;
  result jsonb;
  next_revision bigint;
begin
  if private.current_user_id() is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_theme_id is distinct from 'fieldflow'
    or p_theme_version is distinct from '1.0.0'
  then
    raise exception 'new tenant theme settings must use FieldFlow 1.0.0'
      using errcode = '23514';
  end if;
  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.appearance_config, profile.color_overrides
  into preserved_appearance, preserved_colors
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  result := public.update_tenant_theme_settings_v3(
    p_tenant_id,
    p_expected_revision,
    p_theme_id,
    p_theme_version,
    p_mode_policy,
    preserved_colors,
    preserved_appearance,
    p_accent,
    p_support
  );
  if result ->> 'outcome' <> 'noop' then
    return result;
  end if;

  -- v1 historically treated a successful compare-and-swap as applied even
  -- when its visible values matched the defaults. Preserve that revision
  -- contract without claiming a rollout for unchanged presentation settings.
  update public.tenant_theme_profiles profile
  set revision = profile.revision + 1,
      updated_by = private.current_user_id(),
      updated_at = pg_catalog.now()
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
    and profile.revision = p_expected_revision
  returning profile.revision into next_revision;
  if next_revision is null then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;
  update public.tenant_settings settings
  set theme_settings_revision = next_revision,
      updated_by = private.current_user_id(),
      updated_at = pg_catalog.now()
  where settings.tenant_id = p_tenant_id;
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', 0,
    'snapshotCount', 0,
    'releaseTargetCount', 0,
    'revision', next_revision
  );
end;
$$;

revoke all on function public.update_tenant_theme_settings_v1(
  uuid, bigint, text, text, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_theme_settings_v1(
  uuid, bigint, text, text, jsonb, text, text
) to authenticated;

create or replace function public.update_tenant_theme_settings_v2(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_color_overrides jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preserved_appearance jsonb;
  actor_id uuid := private.current_user_id();
  current_profile public.tenant_theme_profiles%rowtype;
  data_source record;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else pg_catalog.upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else pg_catalog.upper(p_support)
  end;
  queued_count integer := 0;
  selection jsonb;
begin
  if actor_id is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  selection := pg_catalog.jsonb_build_object(
    'ref', pg_catalog.jsonb_build_object(
      'catalog', 'v2',
      'id', p_theme_id,
      'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case when normalized_accent is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_accent) end,
    'support', case when normalized_support is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_support) end,
    'categoryOverrides', '[]'::jsonb
  );
  if p_theme_id is distinct from 'fieldflow'
    or p_theme_version is distinct from '1.0.0'
    or not private.theme_selection_is_valid_v1(selection)
    or p_color_overrides is null
    or (
      p_color_overrides <> '{}'::jsonb
      and not private.tenant_theme_color_overrides_is_valid_v1(
        p_color_overrides
      )
    )
  then
    raise exception 'tenant theme colors are invalid' using errcode = '23514';
  end if;
  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
  for update;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  preserved_appearance := current_profile.appearance_config;

  -- A legacy v2 caller may already have started publishing a new design
  -- version. Refresh that exact publishing version with the new theme instead
  -- of aborting it; the current v3 UI intentionally remains stricter.
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
  ) then
    if current_profile.revision <> p_expected_revision then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    next_revision := current_profile.revision + 1;
    update public.tenant_theme_profiles profile
    set theme_version = p_theme_version,
        selection_json = selection,
        color_overrides = p_color_overrides,
        revision = next_revision,
        updated_by = actor_id,
        updated_at = pg_catalog.now()
    where profile.tenant_id = p_tenant_id
      and profile.theme_id = p_theme_id;
    update public.tenant_settings settings
    set default_theme_id = p_theme_id,
        default_theme_version = p_theme_version,
        theme_mode_policy = p_mode_policy,
        theme_accent = normalized_accent,
        theme_support = normalized_support,
        theme_color_overrides = p_color_overrides,
        theme_settings_revision = next_revision,
        updated_by = actor_id,
        updated_at = pg_catalog.now()
    where settings.tenant_id = p_tenant_id;

    for data_source in
      select distinct slide.data_source_id
      from public.dynamic_slides slide
      where slide.tenant_id = p_tenant_id
        and slide.data_source_id is not null
        and slide.selection_mode = 'latest'
        and slide.status <> 'archived'
      order by slide.data_source_id
    loop
      queued_count := queued_count + private.queue_latest_dynamic_snapshots_v2(
        p_tenant_id,
        data_source.data_source_id,
        null,
        'tenant_theme_colors_changed'
      );
    end loop;

    perform private.audit_event(
      p_tenant_id,
      'tenant.theme.updated',
      'tenant_theme_profiles',
      p_tenant_id,
      'success',
      pg_catalog.jsonb_build_object(
        'themeId', p_theme_id,
        'themeVersion', p_theme_version,
        'revision', next_revision,
        'queuedSnapshotCount', queued_count,
        'legacyPublishingCompatibility', true
      )
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'applied',
      'queuedSnapshotCount', queued_count,
      'revision', next_revision
    );
  end if;

  return public.update_tenant_theme_settings_v3(
    p_tenant_id,
    p_expected_revision,
    p_theme_id,
    p_theme_version,
    p_mode_policy,
    p_color_overrides,
    preserved_appearance,
    p_accent,
    p_support
  );
end;
$$;

revoke all on function public.update_tenant_theme_settings_v2(
  uuid, bigint, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_theme_settings_v2(
  uuid, bigint, text, text, jsonb, jsonb, text, text
) to authenticated;

create function public.retry_tenant_theme_rollout_v1(
  p_tenant_id uuid,
  p_rollout_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_profile public.tenant_theme_profiles%rowtype;
  existing_retry public.tenant_theme_rollouts%rowtype;
  latest_rollout_id uuid;
  new_rollout public.tenant_theme_rollouts%rowtype;
  new_rollout_id uuid;
  outcome jsonb;
  replay jsonb;
  request_json jsonb;
  source_rollout public.tenant_theme_rollouts%rowtype;
begin
  if actor_id is null
    or p_idempotency_key is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot retry tenant theme rollout'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  request_json := pg_catalog.jsonb_build_object(
    'tenantId', p_tenant_id,
    'rolloutId', p_rollout_id
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'tenant.theme.rollout.retry.v1',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select rollout.* into source_rollout
  from public.tenant_theme_rollouts rollout
  where rollout.tenant_id = p_tenant_id
    and rollout.id = p_rollout_id
  for update;
  if not found then
    raise exception 'tenant theme rollout not found' using errcode = 'P0002';
  end if;

  -- A different idempotency key still resolves to the single immutable retry
  -- child instead of creating parallel descendants.
  select rollout.* into existing_retry
  from public.tenant_theme_rollouts rollout
  where rollout.tenant_id = p_tenant_id
    and rollout.retry_of_rollout_id = p_rollout_id;
  if found then
    outcome := pg_catalog.jsonb_build_object(
      'outcome', 'applied',
      'rolloutId', existing_retry.id,
      'retryOfRolloutId', p_rollout_id,
      'status', existing_retry.status,
      'settingsRevision', existing_retry.settings_revision,
      'snapshotCount', existing_retry.snapshot_count,
      'releaseTargetCount', existing_retry.release_target_count
    );
    return private.complete_publisher_command(
      p_tenant_id,
      'tenant.theme.rollout.retry.v1',
      p_idempotency_key,
      request_json,
      'tenant_theme_rollouts',
      existing_retry.id,
      outcome,
      'tenant.theme.rollout.retry_replayed'
    );
  end if;

  if source_rollout.status <> 'failed' then
    raise exception 'only a failed tenant theme rollout can be retried'
      using errcode = '55000';
  end if;
  select rollout.id into latest_rollout_id
  from public.tenant_theme_rollouts rollout
  where rollout.tenant_id = p_tenant_id
    and rollout.theme_id = source_rollout.theme_id
  order by
    rollout.settings_revision desc,
    rollout.created_at desc,
    rollout.id desc
  limit 1;
  if latest_rollout_id is distinct from source_rollout.id then
    raise exception 'only the latest tenant theme rollout can be retried'
      using errcode = '40001';
  end if;

  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = source_rollout.theme_id
  for update;
  if not found
    or current_profile.revision <> source_rollout.settings_revision
  then
    raise exception 'tenant theme rollout revision is no longer current'
      using errcode = '40001';
  end if;

  new_rollout_id := private.start_tenant_theme_rollout_v2(
    p_tenant_id,
    source_rollout.theme_id,
    source_rollout.settings_revision,
    actor_id,
    source_rollout.id
  );
  select rollout.* into new_rollout
  from public.tenant_theme_rollouts rollout
  where rollout.tenant_id = p_tenant_id
    and rollout.id = new_rollout_id;
  outcome := pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'rolloutId', new_rollout.id,
    'retryOfRolloutId', source_rollout.id,
    'status', new_rollout.status,
    'settingsRevision', new_rollout.settings_revision,
    'snapshotCount', new_rollout.snapshot_count,
    'releaseTargetCount', new_rollout.release_target_count
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'tenant.theme.rollout.retry.v1',
    p_idempotency_key,
    request_json,
    'tenant_theme_rollouts',
    new_rollout.id,
    outcome,
    'tenant.theme.rollout.retried'
  );
end;
$$;

revoke all on function public.retry_tenant_theme_rollout_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.retry_tenant_theme_rollout_v1(
  uuid, uuid, uuid
) to authenticated;

-- A rollout is staged beside the current ready snapshot. Control may keep
-- working with that last-known-good snapshot even when an older status mirror
-- still says rendering/error; archived or unpublished slides remain blocked.
create or replace function public.add_dynamic_slide_to_playlist_v2(
  p_playlist_id uuid,
  p_dynamic_slide_id uuid,
  p_expected_revision bigint,
  p_duration_seconds integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actual_revision bigint;
  item_id uuid;
  news_page_count integer;
  next_sort integer;
  outcome jsonb;
  playlist_record public.playlists%rowtype;
  replay jsonb;
  request_json jsonb;
  resolved_duration integer;
  seconds_per_slide integer;
  slide_record public.dynamic_slides%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
begin
  if p_expected_revision is null
    or p_expected_revision < 0
    or p_duration_seconds is null
    or p_duration_seconds not between 5 and 3600
    or p_idempotency_key is null
  then
    raise exception 'dynamic playlist command is invalid'
      using errcode = '22023';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_write_playlist(playlist_record.tenant_id)
  then
    raise exception 'actor cannot change playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be changed'
      using errcode = '23514';
  end if;

  -- Serialize with a concurrent theme save before taking the slide lock. If
  -- this command wins, the later planner sees the draft; if the theme save
  -- wins, the active-rollout check below rejects a stale new draft binding.
  perform profile.tenant_id
  from public.tenant_theme_profiles profile
  where profile.tenant_id = playlist_record.tenant_id
    and profile.theme_id = 'fieldflow'
  for share;

  select slide.* into slide_record
  from public.dynamic_slides slide
  where slide.id = p_dynamic_slide_id
    and slide.tenant_id = playlist_record.tenant_id
    and slide.status <> 'archived'
    and slide.current_published_version_id is not null
    and slide.current_snapshot_id is not null
  for share;
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;

  select snapshot.* into snapshot_record
  from public.dynamic_slide_snapshots snapshot
  join public.media_assets asset
    on asset.tenant_id = snapshot.tenant_id
   and asset.id = snapshot.output_media_asset_id
  where snapshot.id = slide_record.current_snapshot_id
    and snapshot.tenant_id = playlist_record.tenant_id
    and snapshot.dynamic_slide_id = slide_record.id
    and snapshot.dynamic_slide_version_id =
      slide_record.current_published_version_id
    and snapshot.status = 'ready'
    and snapshot.output_media_asset_id is not null
    and asset.status = 'ready'
    and asset.deleted_at is null;
  if not found then
    raise exception 'dynamic slide has no ready published snapshot'
      using errcode = '23514';
  end if;

  request_json := pg_catalog.jsonb_build_object(
    'playlistId', playlist_record.id,
    'dynamicSlideId', slide_record.id,
    'dynamicSnapshotId', snapshot_record.id,
    'expectedRevision', p_expected_revision,
    'durationSeconds', p_duration_seconds
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.dynamic_slide.add',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  perform private.assert_theme_snapshot_rollout_idle_v1(
    playlist_record.tenant_id,
    snapshot_record.id
  );

  if playlist_record.revision <> p_expected_revision then
    outcome := pg_catalog.jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.dynamic_slide.add',
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.conflict',
      'failed'
    );
  end if;

  resolved_duration := least(
    greatest(p_duration_seconds, 5),
    3600
  );
  if slide_record.slide_type = 'news' then
    news_page_count := greatest(
      pg_catalog.jsonb_array_length(coalesce(
        snapshot_record.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )),
      1
    );
    seconds_per_slide := least(greatest(
      case
        when coalesce(
          snapshot_record.snapshot_data_json #>> '{news,secondsPerSlide}',
          ''
        ) ~ '^[0-9]{1,3}$'
          then (
            snapshot_record.snapshot_data_json #>>
              '{news,secondsPerSlide}'
          )::integer
        else 5
      end,
      5
    ), 120);
    resolved_duration := least(
      news_page_count * seconds_per_slide,
      3600
    );
  end if;

  select coalesce(pg_catalog.max(item.sort_order), -1) + 1
  into next_sort
  from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;

  insert into public.playlist_items(
    tenant_id,
    playlist_id,
    media_asset_id,
    sort_order,
    duration_seconds,
    fit_mode,
    muted,
    created_by,
    dynamic_slide_id,
    dynamic_snapshot_id,
    dynamic_selection_mode
  ) values (
    playlist_record.tenant_id,
    playlist_record.id,
    snapshot_record.output_media_asset_id,
    next_sort,
    resolved_duration,
    'contain',
    true,
    actor_id,
    slide_record.id,
    snapshot_record.id,
    slide_record.selection_mode
  ) returning id into item_id;

  update public.playlists playlist
  set revision = playlist.revision + 1,
      status = 'draft'::public.playlist_status,
      updated_by = actor_id,
      updated_at = now()
  where playlist.id = playlist_record.id
  returning playlist.revision into actual_revision;

  outcome := pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'actualRevision', actual_revision,
    'itemId', item_id,
    'dynamicSlideId', slide_record.id,
    'dynamicSnapshotId', snapshot_record.id,
    'durationSeconds', resolved_duration,
    'renderMode', 'html_css'
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.dynamic_slide.add',
    p_idempotency_key,
    request_json,
    'playlist_items',
    item_id,
    outcome,
    'dynamic.slide.added_to_playlist'
  );
end;
$$;

revoke all on function public.add_dynamic_slide_to_playlist_v2(
  uuid, uuid, bigint, integer, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.add_dynamic_slide_to_playlist_v2(
  uuid, uuid, bigint, integer, uuid
) to authenticated;


create function private.sportlink_match_matches_team_selection_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_match public.sports_matches,
  p_team_selection jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_selection ->> 'mode' = 'selected' then
    return exists (
      select 1
      from pg_catalog.jsonb_array_elements(
        p_team_selection -> 'teamContexts'
      ) selected_context
      where selected_context ->> 'providerTeamId' in (
          p_match.home_team ->> 'externalId',
          p_match.away_team ->> 'externalId'
        )
        and (
          selected_context ->> 'competitionSelectionMode' = 'auto_current'
          or (
            p_match.competition ->> 'externalId'
              is not distinct from selected_context ->> 'competitionId'
            and (
              selected_context ->> 'phaseId' is null
              or p_match.competition ->> 'period' =
                selected_context ->> 'phaseId'
            )
            and (
              selected_context ->> 'poolId' is null
              or p_match.pool ->> 'externalId' =
                selected_context ->> 'poolId'
              or p_match.pool ->> 'poolExternalId' =
                selected_context ->> 'poolId'
            )
            and (
              selected_context ->> 'seasonId' is null
              or p_match.competition ->> 'season' =
                selected_context ->> 'seasonId'
            )
          )
        )
    );
  end if;

  if p_team_selection ->> 'mode' = 'all' then
    return exists (
      select 1
      from public.sports_teams club_team
      join public.sportlink_connections connection
        on connection.tenant_id = club_team.tenant_id
       and connection.id = club_team.source_connection_id
       and connection.data_source_id = p_data_source_id
      where club_team.tenant_id = p_tenant_id
        and club_team.active
        and club_team.external_id in (
          p_match.home_team ->> 'externalId',
          p_match.away_team ->> 'externalId'
        )
        and (
          not exists (
            select 1
            from pg_catalog.jsonb_array_elements(
              p_team_selection -> 'teamContexts'
            ) team_override
            where team_override ->> 'providerTeamId' =
              club_team.external_id
          )
          or exists (
            select 1
            from pg_catalog.jsonb_array_elements(
              p_team_selection -> 'teamContexts'
            ) team_override
            where team_override ->> 'providerTeamId' =
                club_team.external_id
              and p_match.competition ->> 'externalId'
                is not distinct from team_override ->> 'competitionId'
              and (
                team_override ->> 'phaseId' is null
                or p_match.competition ->> 'period' =
                  team_override ->> 'phaseId'
              )
              and (
                team_override ->> 'poolId' is null
                or p_match.pool ->> 'externalId' =
                  team_override ->> 'poolId'
                or p_match.pool ->> 'poolExternalId' =
                  team_override ->> 'poolId'
              )
              and (
                team_override ->> 'seasonId' is null
                or p_match.competition ->> 'season' =
                  team_override ->> 'seasonId'
              )
          )
        )
    );
  end if;
  return false;
end;
$$;

revoke all on function private.sportlink_match_matches_team_selection_v1(
  uuid, uuid, public.sports_matches, jsonb
) from public, anon, authenticated, service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s153_club_refill;

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
  result jsonb;
  selected_items jsonb;
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
      and private.sportlink_match_matches_team_selection_v1(
        p_slide.tenant_id,
        p_slide.data_source_id,
        fixture,
        team_selection
      )
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

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s153_club_refill(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
-- Club-wide programme and result blueprints are one aggregate slide. Team
-- selection is presentation configuration, never a reason to fan out slides.
create function public.create_sportlink_slide_batch_v4(
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
  allowed_draft_fields constant text[] := array[
    'arrival', 'blueprintKey', 'context', 'display', 'name', 'orientation',
    'teamContexts', 'teamSelection', 'templateVersionId', 'themeSelection',
    'title'
  ];
  allowed_keys constant text[] := array[
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days',
    'sportlink.pool_schedule_next_7_days',
    'sportlink.pool_results_previous_7_days',
    'sportlink.pool_standings',
    'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  ];
  arrival_config jsonb;
  batch_id uuid;
  display_config jsonb;
  draft jsonb;
  existing_data_source_id uuid;
  existing_request_hash text;
  expected_type text;
  is_arrival boolean;
  is_club_aggregate boolean;
  request_hash text;
  result jsonb;
  results jsonb := '[]'::jsonb;
  seen_arrival_keys text[] := array[]::text[];
  seen_club_keys text[] := array[]::text[];
  selection jsonb;
  team_contexts jsonb;
  team_count integer;
  team_selection jsonb;
begin
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

  request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'dataSourceId', p_data_source_id,
          'drafts', p_drafts,
          'schemaVersion', 4
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

  for draft in
    select value from pg_catalog.jsonb_array_elements(p_drafts)
  loop
    is_arrival := coalesce(
      draft ->> 'blueprintKey' in (
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      ),
      false
    );
    is_club_aggregate := coalesce(
      draft ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days'
      ),
      false
    );
    selection := draft -> 'themeSelection';
    team_selection := draft -> 'teamSelection';
    team_contexts := case
      when is_arrival then coalesce(
        draft -> 'teamContexts',
        jsonb_build_array(draft -> 'context')
      )
      else jsonb_build_array(draft -> 'context')
    end;
    display_config := jsonb_build_object(
      'columns', 'one',
      'showDressingRoom', false,
      'showField', true,
      'showHomeAway', true,
      'showLogo', true,
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

    if pg_catalog.jsonb_typeof(draft) is distinct from 'object'
      or not (draft ?& array[
        'blueprintKey', 'context', 'name', 'orientation',
        'templateVersionId', 'themeSelection', 'title'
      ])
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(draft) as keys(key_name)
        where keys.key_name <> all(allowed_draft_fields)
      )
      or not coalesce(draft ->> 'blueprintKey' = any(allowed_keys), false)
      or pg_catalog.jsonb_typeof(draft -> 'name') is distinct from 'string'
      or length(btrim(coalesce(draft ->> 'name', ''))) not between 2 and 120
      or pg_catalog.jsonb_typeof(draft -> 'title') is distinct from 'string'
      or length(btrim(coalesce(draft ->> 'title', ''))) not between 1 and 160
      or pg_catalog.jsonb_typeof(draft -> 'orientation') is distinct from 'string'
      or coalesce(draft ->> 'orientation', '') not in (
        'landscape', 'portrait'
      )
      or pg_catalog.jsonb_typeof(
        draft -> 'templateVersionId'
      ) is distinct from 'string'
      or coalesce(draft ->> 'templateVersionId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or pg_catalog.jsonb_typeof(draft -> 'context') is distinct from 'object'
      or not private.sportlink_team_contexts_are_valid_v2(
        p_tenant_id,
        p_data_source_id,
        jsonb_build_array(draft -> 'context')
      )
      or not private.sportlink_display_config_is_valid_v2(display_config)
      or (
        draft ? 'arrival'
        and (
          not is_arrival
          or not private.sportlink_arrival_config_is_valid_v1(arrival_config)
        )
      )
      or not private.theme_selection_is_valid_v1(selection)
      or selection #>> '{ref,version}' is distinct from '1.0.0'
    then
      raise exception 'invalid Sportlink draft' using errcode = '22023';
    end if;

    if is_club_aggregate then
      if not (draft ? 'teamSelection')
        or draft ? 'teamContexts'
        or not private.sportlink_team_selection_is_valid_v1(
          p_tenant_id,
          p_data_source_id,
          team_selection
        )
        or (
          team_selection ->> 'mode' = 'selected'
          and team_selection #> '{teamContexts,0}'
            is distinct from draft -> 'context'
        )
      then
        raise exception 'invalid club-wide team selection'
          using errcode = '22023';
      end if;
      if draft ->> 'blueprintKey' = any(seen_club_keys) then
        raise exception 'duplicate club-wide Sportlink component'
          using errcode = '22023';
      end if;
      seen_club_keys := pg_catalog.array_append(
        seen_club_keys,
        draft ->> 'blueprintKey'
      );
      if team_selection ->> 'mode' = 'all' then
        select count(distinct team.external_id)::integer
        into team_count
        from public.sports_teams team
        join public.sportlink_connections connection
          on connection.tenant_id = team.tenant_id
         and connection.id = team.source_connection_id
         and connection.data_source_id = p_data_source_id
        where team.tenant_id = p_tenant_id
          and team.active;
      else
        team_count := pg_catalog.jsonb_array_length(
          team_selection -> 'teamContexts'
        );
      end if;
    elsif is_arrival then
      if draft ? 'teamSelection'
        or team_contexts #> '{0}' is distinct from draft -> 'context'
        or not private.sportlink_team_contexts_are_valid_v2(
          p_tenant_id,
          p_data_source_id,
          team_contexts
        )
      then
        raise exception 'invalid arrival team selection'
          using errcode = '22023';
      end if;
      if draft ->> 'blueprintKey' = any(seen_arrival_keys) then
        raise exception 'duplicate Sportlink arrival component'
          using errcode = '22023';
      end if;
      seen_arrival_keys := pg_catalog.array_append(
        seen_arrival_keys,
        draft ->> 'blueprintKey'
      );
      team_count := pg_catalog.jsonb_array_length(team_contexts);
    else
      if draft ? 'teamSelection' or draft ? 'teamContexts' then
        raise exception 'team aggregation is not supported for this blueprint'
          using errcode = '22023';
      end if;
      team_count := 1;
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
        'teamContexts', case
          when is_arrival then team_contexts
        end,
        'teamSelection', case
          when is_club_aggregate then team_selection
        end,
        'arrival', case
          when is_arrival then arrival_config
        end,
        'display', display_config,
        'editorial', jsonb_build_object(
          'schemaVersion', 2,
          'themeSelection', selection
        ),
        'maxItems', case when is_club_aggregate then 100 else 40 end
      )) || jsonb_build_object(
        'context', draft -> 'context'
      ) || case
        when is_arrival then jsonb_build_object(
          'context', team_contexts -> 0,
          'teamContexts', team_contexts
        )
        when is_club_aggregate then jsonb_build_object(
          'teamSelection', team_selection
        )
        else '{}'::jsonb
      end
    );
    results := results || jsonb_build_array(jsonb_build_object(
      'slideId', result ->> 'slideId',
      'snapshotId', result ->> 'snapshotId',
      'name', draft ->> 'name',
      'blueprintKey', draft ->> 'blueprintKey',
      'teamCount', team_count
    ));
  end loop;

  result := jsonb_build_object(
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
    jsonb_build_object(
      'aggregateClubSlides', cardinality(seen_club_keys),
      'aggregateArrivals', cardinality(seen_arrival_keys),
      'count', pg_catalog.jsonb_array_length(results),
      'dataSourceId', p_data_source_id,
      'schemaVersion', 4,
      'themeId', p_drafts #>> '{0,themeSelection,ref,id}'
    )
  );
  return result;
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v4(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v4(
  uuid, uuid, jsonb, uuid
) to authenticated;

-- A cached v3 client may still send one club-wide blueprint per selected team.
-- Canonicalise that request before creation so it cannot recreate the fan-out.
alter function public.create_sportlink_slide_batch_v3(
  uuid, uuid, jsonb, uuid
) rename to create_sportlink_slide_batch_legacy_v3;
alter function public.create_sportlink_slide_batch_legacy_v3(
  uuid, uuid, jsonb, uuid
) set schema private;

revoke all on function private.create_sportlink_slide_batch_legacy_v3(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

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
  canonical_drafts jsonb := '[]'::jsonb;
  contexts jsonb;
  draft jsonb;
  key_name text;
  seen_club_keys text[] := array[]::text[];
begin
  if pg_catalog.jsonb_typeof(p_drafts) is distinct from 'array' then
    return public.create_sportlink_slide_batch_v4(
      p_tenant_id,
      p_data_source_id,
      p_drafts,
      p_idempotency_key
    );
  end if;

  for draft in
    select value from pg_catalog.jsonb_array_elements(p_drafts)
  loop
    key_name := draft ->> 'blueprintKey';
    if key_name in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    ) then
      if key_name = any(seen_club_keys) then
        continue;
      end if;
      seen_club_keys := pg_catalog.array_append(seen_club_keys, key_name);
      if draft ? 'teamSelection' then
        canonical_drafts := canonical_drafts || jsonb_build_array(draft);
        continue;
      end if;

      select coalesce(
        jsonb_agg(
          distinct_context.context_json
          order by distinct_context.first_ordinality
        ),
        '[]'::jsonb
      )
      into contexts
      from (
        select distinct on (
          candidate.value #>> '{context,providerTeamId}'
        )
          candidate.value -> 'context' as context_json,
          candidate.ordinality as first_ordinality
        from pg_catalog.jsonb_array_elements(p_drafts)
          with ordinality candidate(value, ordinality)
        where candidate.value ->> 'blueprintKey' = key_name
        order by
          candidate.value #>> '{context,providerTeamId}',
          candidate.ordinality
      ) distinct_context;

      canonical_drafts := canonical_drafts || jsonb_build_array(
        draft || jsonb_build_object(
          'context', contexts -> 0,
          'teamSelection', jsonb_build_object(
            'mode', 'selected',
            'teamContexts', contexts
          )
        )
      );
    else
      canonical_drafts := canonical_drafts || jsonb_build_array(draft);
    end if;
  end loop;

  return public.create_sportlink_slide_batch_v4(
    p_tenant_id,
    p_data_source_id,
    canonical_drafts,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v3(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v3(
  uuid, uuid, jsonb, uuid
) to authenticated;

-- Very old v1/v2 callers cannot express aggregate selection. Reject aggregate
-- blueprints rather than silently creating a slide per team.
create or replace function public.create_sportlink_slide_batch_v1(
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
    raise exception 'actor cannot create Sportlink slides'
      using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_drafts) = 'array'
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_drafts) draft
      where draft ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days',
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      )
    )
  then
    raise exception 'linked arrival components require Sportlink batch v3'
      using errcode = '22023';
  end if;
  return private.create_sportlink_slide_batch_legacy_v1(
    p_tenant_id,
    p_data_source_id,
    p_drafts,
    p_idempotency_key
  );
end;
$$;

create or replace function public.create_sportlink_slide_batch_v2(
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
    raise exception 'actor cannot create Sportlink slides'
      using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_drafts) = 'array'
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_drafts) draft
      where draft ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days',
        'sportlink.visitor_arrivals',
        'sportlink.referee_arrivals'
      )
    )
  then
    raise exception 'linked arrival components require Sportlink batch v3'
      using errcode = '22023';
  end if;
  return private.create_sportlink_slide_batch_legacy_v2(
    p_tenant_id,
    p_data_source_id,
    p_drafts,
    p_idempotency_key
  );
end;
$$;

-- A completed render may arrive after an operator archived its logical slide.
-- Keep the archived lifecycle state terminal while still allowing the immutable
-- render artifact to finish for diagnostics and already published releases.
create function private.preserve_dynamic_slide_archive_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'archived' and new.status <> 'archived' then
    new.status := 'archived';
    new.archived_at := old.archived_at;
    new.active_draft_version_id := null;
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_dynamic_slide_archive_v1()
  from public, anon, authenticated, service_role;

create trigger zz_dynamic_slides_preserve_archive
before update on public.dynamic_slides
for each row execute function private.preserve_dynamic_slide_archive_v1();

create function public.mutate_dynamic_slides_v1(
  p_tenant_id uuid,
  p_slide_ids uuid[],
  p_operation text,
  p_override boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_slide_ids uuid[] := array[]::uuid[];
  actor_id uuid := private.current_user_id();
  affected_playlist_id uuid;
  affected_playlist_ids uuid[] := array[]::uuid[];
  archived_count integer := 0;
  blocked_slide_ids uuid[] := array[]::uuid[];
  draft_reference_count integer := 0;
  found_count integer := 0;
  normalized_operation text := btrim(coalesce(p_operation, ''));
  outcome jsonb;
  replay jsonb;
  request_json jsonb;
  sorted_slide_ids uuid[];
begin
  if actor_id is null
    or p_idempotency_key is null
    or p_override is null
    or normalized_operation <> 'archive'
    or p_slide_ids is null
    or cardinality(p_slide_ids) not between 1 and 100
    or (
      select count(distinct slide_id)
      from unnest(p_slide_ids) slide_id
    ) <> cardinality(p_slide_ids)
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.dynamic_slide.write'
    )
    or (
      p_override
      and not private.can_write_playlist(p_tenant_id)
    )
  then
    raise exception 'dynamic slide mutation is invalid'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select array_agg(slide_id order by slide_id)
  into sorted_slide_ids
  from unnest(p_slide_ids) slide_id;

  request_json := jsonb_build_object(
    'operation', normalized_operation,
    'override', p_override,
    'slideIds', to_jsonb(sorted_slide_ids),
    'tenantId', p_tenant_id
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'dynamic_slides.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  perform slide.id
  from public.dynamic_slides slide
  where slide.tenant_id = p_tenant_id
    and slide.id = any(sorted_slide_ids)
  order by slide.id
  for update;

  select
    count(*)::integer,
    coalesce(
      array_agg(slide.id order by slide.id)
        filter (where slide.status <> 'archived'),
      array[]::uuid[]
    )
  into found_count, active_slide_ids
  from public.dynamic_slides slide
  where slide.tenant_id = p_tenant_id
    and slide.id = any(sorted_slide_ids);

  if found_count <> cardinality(sorted_slide_ids) then
    raise exception 'dynamic slide selection changed'
      using errcode = 'P0002';
  end if;

  select
    coalesce(
      array_agg(distinct item.dynamic_slide_id order by item.dynamic_slide_id),
      array[]::uuid[]
    ),
    coalesce(
      array_agg(distinct item.playlist_id order by item.playlist_id),
      array[]::uuid[]
    ),
    count(*)::integer
  into
    blocked_slide_ids,
    affected_playlist_ids,
    draft_reference_count
  from public.playlist_items item
  where item.tenant_id = p_tenant_id
    and item.dynamic_slide_id = any(active_slide_ids);

  if draft_reference_count > 0 then
    perform playlist.id
    from public.playlists playlist
    where playlist.tenant_id = p_tenant_id
      and playlist.id = any(affected_playlist_ids)
    order by playlist.id
    for update;

    select
      coalesce(
        array_agg(
          distinct item.dynamic_slide_id
          order by item.dynamic_slide_id
        ),
        array[]::uuid[]
      ),
      coalesce(
        array_agg(distinct item.playlist_id order by item.playlist_id),
        array[]::uuid[]
      ),
      count(*)::integer
    into
      blocked_slide_ids,
      affected_playlist_ids,
      draft_reference_count
    from public.playlist_items item
    where item.tenant_id = p_tenant_id
      and item.dynamic_slide_id = any(active_slide_ids);
  end if;

  if draft_reference_count > 0 and not p_override then
    outcome := jsonb_build_object(
      'archivedCount', 0,
      'blockedSlideIds', to_jsonb(blocked_slide_ids),
      'draftReferenceCount', draft_reference_count,
      'immutableReleasesChanged', false,
      'outcome', 'blocked'
    );
    return private.complete_publisher_command(
      p_tenant_id,
      'dynamic_slides.' || normalized_operation,
      p_idempotency_key,
      request_json,
      'dynamic_slides',
      sorted_slide_ids[1],
      outcome,
      'publisher.dynamic_slides.archive_blocked',
      'failed'
    );
  end if;

  if draft_reference_count > 0 then
    delete from public.playlist_items item
    where item.tenant_id = p_tenant_id
      and item.dynamic_slide_id = any(active_slide_ids);

    update public.playlists playlist
    set revision = playlist.revision + 1,
        status = case
          when playlist.status = 'archived'::public.playlist_status
            then playlist.status
          else 'draft'::public.playlist_status
        end,
        updated_by = actor_id,
        updated_at = now()
    where playlist.tenant_id = p_tenant_id
      and playlist.id = any(affected_playlist_ids);

    foreach affected_playlist_id in array affected_playlist_ids
    loop
      perform private.audit_event(
        p_tenant_id,
        'publisher.playlist.dynamic_slides_removed',
        'playlists',
        affected_playlist_id,
        'success',
        jsonb_build_object(
          'dynamicSlideIds', to_jsonb(active_slide_ids),
          'immutableReleasesChanged', false
        )
      );
    end loop;
  end if;

  update public.dynamic_slide_versions version
  set status = 'archived'
  where version.tenant_id = p_tenant_id
    and version.id in (
      select slide.active_draft_version_id
      from public.dynamic_slides slide
      where slide.tenant_id = p_tenant_id
        and slide.id = any(active_slide_ids)
        and slide.active_draft_version_id is not null
    )
    and version.status in ('draft', 'publishing');

  update public.dynamic_slides slide
  set status = 'archived',
      active_draft_version_id = null,
      archived_at = coalesce(slide.archived_at, now()),
      revision = slide.revision + 1,
      updated_by = actor_id,
      updated_at = now()
  where slide.tenant_id = p_tenant_id
    and slide.id = any(active_slide_ids)
    and slide.status <> 'archived';
  get diagnostics archived_count = row_count;

  outcome := jsonb_build_object(
    'archivedCount', archived_count,
    'blockedSlideIds', '[]'::jsonb,
    'draftReferenceCount', draft_reference_count,
    'immutableReleasesChanged', false,
    'outcome', 'applied'
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'dynamic_slides.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'dynamic_slides',
    sorted_slide_ids[1],
    outcome,
    'publisher.dynamic_slides.archived'
  );
end;
$$;

revoke all on function public.mutate_dynamic_slides_v1(
  uuid, uuid[], text, boolean, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.mutate_dynamic_slides_v1(
  uuid, uuid[], text, boolean, uuid
) to authenticated;

-- The version boundary validates both arrival groups and club-wide match
-- selections, so edits cannot bypass the same invariant enforced at creation.
create or replace function private.enforce_sportlink_arrival_team_contexts_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  blueprint text := new.configuration_json ->> 'blueprintKey';
  is_arrival boolean := coalesce(
    blueprint in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    ),
    false
  );
  is_club_aggregate boolean := coalesce(
    blueprint in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    ),
    false
  );
begin
  if new.status = 'publishing'
    and is_arrival
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection must be saved before publishing'
      using errcode = '23514';
  end if;
  if new.status = 'publishing'
    and is_club_aggregate
    and not new.configuration_json ? 'teamSelection'
  then
    raise exception 'Sportlink club-wide team selection must be saved before publishing'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.configuration_json ? 'teamContexts'
    and is_arrival
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection cannot be removed'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE'
    and old.configuration_json ? 'teamSelection'
    and is_club_aggregate
    and not new.configuration_json ? 'teamSelection'
  then
    raise exception 'Sportlink club-wide team selection cannot be removed'
      using errcode = '23514';
  end if;

  if new.configuration_json ? 'teamContexts' and not is_arrival then
    raise exception 'Sportlink linked team selection is only valid for arrival slides'
      using errcode = '23514';
  end if;
  if new.configuration_json ? 'teamSelection' and not is_club_aggregate then
    raise exception 'Sportlink club-wide team selection is only valid for club match slides'
      using errcode = '23514';
  end if;

  if is_arrival and new.configuration_json ? 'teamContexts' then
    if not private.sportlink_team_contexts_are_valid_v2(
      new.tenant_id,
      new.data_source_id,
      new.configuration_json -> 'teamContexts'
    ) then
      raise exception 'Sportlink linked team selection is invalid'
        using errcode = '23514';
    end if;
    if pg_catalog.jsonb_typeof(
      new.configuration_json -> 'context'
    ) is distinct from 'object'
      or new.configuration_json -> 'context'
        is distinct from new.configuration_json #> '{teamContexts,0}'
    then
      raise exception 'Sportlink primary context must match the first selected team'
        using errcode = '23514';
    end if;
  end if;

  if is_club_aggregate and new.configuration_json ? 'teamSelection' then
    if not private.sportlink_team_selection_is_valid_v1(
      new.tenant_id,
      new.data_source_id,
      new.configuration_json -> 'teamSelection'
    )
      or not private.sportlink_team_contexts_are_valid_v2(
        new.tenant_id,
        new.data_source_id,
        jsonb_build_array(new.configuration_json -> 'context')
      )
    then
      raise exception 'Sportlink club-wide team selection is invalid'
        using errcode = '23514';
    end if;
    if new.configuration_json #>> '{teamSelection,mode}' = 'selected'
      and new.configuration_json -> 'context'
        is distinct from new.configuration_json #> '{teamSelection,teamContexts,0}'
    then
      raise exception 'Sportlink primary context must match the first selected team'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- A render queued before a theme save can finish after the rollout. Do not let
-- that late, stale artifact replace a newer theme revision on the logical slide.
create function private.require_current_theme_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_revision bigint;
  snapshot_revision bigint;
  snapshot_theme_id text;
begin
  if new.current_snapshot_id is null
    or new.current_snapshot_id is not distinct from old.current_snapshot_id
  then
    return new;
  end if;

  select
    snapshot.snapshot_data_json #>> '{themePresentation,selection,ref,id}',
    case
      when snapshot.snapshot_data_json #>> '{themePresentation,settingsRevision}'
        ~ '^[0-9]+$'
      then (
        snapshot.snapshot_data_json #>> '{themePresentation,settingsRevision}'
      )::bigint
      else -1
    end
  into snapshot_theme_id, snapshot_revision
  from public.dynamic_slide_snapshots snapshot
  where snapshot.tenant_id = new.tenant_id
    and snapshot.id = new.current_snapshot_id;

  if snapshot_theme_id is distinct from 'fieldflow' then
    return new;
  end if;

  select profile.revision
  into profile_revision
  from public.tenant_theme_profiles profile
  where profile.tenant_id = new.tenant_id
    and profile.theme_id = 'fieldflow';

  if profile_revision is not null
    and coalesce(snapshot_revision, -1) < profile_revision
  then
    new.current_snapshot_id := old.current_snapshot_id;
    new.status := case
      when old.status = 'archived' then 'archived'
      when old.current_snapshot_id is not null then 'ready'
      else old.status
    end;
    new.last_error_code := 'STALE_THEME_SNAPSHOT_IGNORED';
  end if;
  return new;
end;
$$;

revoke all on function private.require_current_theme_snapshot_v1()
  from public, anon, authenticated, service_role;

create trigger zy_dynamic_slides_require_current_theme
before update of current_snapshot_id on public.dynamic_slides
for each row execute function private.require_current_theme_snapshot_v1();
