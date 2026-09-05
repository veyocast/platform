-- S149: make FieldFlow colors a tenant-owned setting instead of a slide-owned
-- override. Historical snapshots and published releases remain immutable;
-- changed tenant colors only queue fresh snapshots for latest-following slides.

alter table public.tenant_settings
  add column theme_color_overrides jsonb not null default '{}'::jsonb;

create function private.editorial_color_tokens_is_valid_v1(
  p_tokens jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  token record;
  allowed_keys constant text[] := array[
    'accent', 'accentSoft', 'border', 'borderSoft', 'canvas', 'danger',
    'divider', 'imageOverlayEnd', 'imageOverlayMid', 'imageOverlayStart',
    'neutral', 'panel', 'qrInk', 'qrSurface', 'row', 'rowSelected',
    'shadow', 'success', 'surface', 'surfaceRaised', 'text', 'textFaint',
    'textMuted', 'textOnAccent', 'textOnSelected', 'warning'
  ];
begin
  if pg_catalog.jsonb_typeof(p_tokens) is distinct from 'object' then
    return false;
  end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(p_tokens)) <> 26 then
    return false;
  end if;
  for token in select key, value from pg_catalog.jsonb_each_text(p_tokens)
  loop
    if not token.key = any(allowed_keys)
      or length(token.value) not between 1 and 64
      or token.value !~* '^(#[0-9a-f]{6}|rgba?\([0-9.,%[:space:]]+\)|hsla?\([0-9.,%[:space:]]+\))$'
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function private.editorial_theme_config_is_valid_v1(
  p_theme jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_theme) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_theme)) <> 3
    or not (p_theme ?& array['dark', 'light', 'mode'])
    or p_theme ->> 'mode' not in ('light', 'dark')
  then
    return false;
  end if;
  return private.editorial_color_tokens_is_valid_v1(p_theme -> 'dark')
    and private.editorial_color_tokens_is_valid_v1(p_theme -> 'light');
end;
$$;

create function private.tenant_theme_color_overrides_is_valid_v1(
  p_overrides jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_overrides) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_overrides)) <> 1
    or not (p_overrides ? 'fieldflow')
  then
    return false;
  end if;
  return private.editorial_theme_config_is_valid_v1(
    p_overrides -> 'fieldflow'
  );
end;
$$;

alter table public.tenant_settings
  add constraint tenant_settings_theme_color_overrides_check
  check (
    theme_color_overrides = '{}'::jsonb
    or private.tenant_theme_color_overrides_is_valid_v1(
      theme_color_overrides
    )
  );

revoke all on function private.editorial_color_tokens_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.editorial_theme_config_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.tenant_theme_color_overrides_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;

create function public.update_tenant_theme_settings_v2(
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
  actor_id uuid := private.current_user_id();
  current_settings public.tenant_settings%rowtype;
  data_source record;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else upper(p_support)
  end;
  queued_count integer := 0;
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

  selection := jsonb_build_object(
    'ref', jsonb_build_object(
      'catalog', 'v2', 'id', p_theme_id, 'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case
      when normalized_accent is null then 'null'::jsonb
      else to_jsonb(normalized_accent)
    end,
    'support', case
      when normalized_support is null then 'null'::jsonb
      else to_jsonb(normalized_support)
    end,
    'categoryOverrides', '[]'::jsonb
  );
  if p_theme_id is distinct from 'fieldflow'
    or p_theme_version is distinct from '1.0.0'
    or not private.theme_selection_is_valid_v1(selection)
    or not private.tenant_theme_color_overrides_is_valid_v1(
      p_color_overrides
    )
  then
    raise exception 'tenant theme colors are invalid' using errcode = '23514';
  end if;

  select settings.* into current_settings
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant settings not found' using errcode = 'P0002';
  end if;
  if current_settings.theme_settings_revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  theme_changed := current_settings.default_theme_id is distinct from p_theme_id
    or current_settings.default_theme_version is distinct from p_theme_version
    or current_settings.theme_mode_policy is distinct from p_mode_policy
    or current_settings.theme_accent is distinct from normalized_accent
    or current_settings.theme_support is distinct from normalized_support
    or current_settings.theme_color_overrides is distinct from p_color_overrides;

  update public.tenant_settings settings
  set default_theme_id = p_theme_id,
      default_theme_version = p_theme_version,
      theme_mode_policy = p_mode_policy,
      theme_accent = normalized_accent,
      theme_support = normalized_support,
      theme_color_overrides = p_color_overrides,
      theme_settings_revision = settings.theme_settings_revision + 1,
      updated_by = actor_id,
      updated_at = now()
  where settings.tenant_id = p_tenant_id
  returning settings.theme_settings_revision into next_revision;

  if theme_changed then
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
  end if;

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.updated',
    'tenant_settings',
    p_tenant_id,
    'success',
    jsonb_build_object(
      'themeId', p_theme_id,
      'themeVersion', p_theme_version,
      'modePolicy', p_mode_policy,
      'paletteConfigured', true,
      'queuedSnapshotCount', queued_count,
      'revision', next_revision
    )
  );
  return jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', queued_count,
    'revision', next_revision
  );
end;
$$;

revoke all on function public.update_tenant_theme_settings_v2(
  uuid, bigint, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_theme_settings_v2(
  uuid, bigint, text, text, jsonb, jsonb, text, text
) to authenticated;

create function public.update_tenant_control_settings_v5(
  p_tenant_id uuid,
  p_name text,
  p_primary_color text,
  p_default_image_duration_seconds integer,
  p_default_fit_mode text,
  p_default_video_muted boolean,
  p_default_screen_orientation text,
  p_default_resolution_width integer,
  p_default_resolution_height integer,
  p_timezone_name text,
  p_default_transition text,
  p_default_background_color text,
  p_theme_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_theme_mode_policy jsonb,
  p_theme_color_overrides jsonb,
  p_theme_accent text default null,
  p_theme_support text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  theme_result jsonb;
begin
  perform public.update_tenant_control_settings_v3(
    p_tenant_id,
    p_name,
    p_primary_color,
    p_default_image_duration_seconds,
    p_default_fit_mode,
    p_default_video_muted,
    p_default_screen_orientation,
    p_default_resolution_width,
    p_default_resolution_height,
    p_timezone_name,
    p_default_transition,
    p_default_background_color
  );
  theme_result := public.update_tenant_theme_settings_v2(
    p_tenant_id,
    p_theme_expected_revision,
    p_theme_id,
    p_theme_version,
    p_theme_mode_policy,
    p_theme_color_overrides,
    p_theme_accent,
    p_theme_support
  );
  if theme_result ->> 'outcome' <> 'applied' then
    raise exception 'theme settings changed concurrently'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_tenant_control_settings_v5(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text, bigint, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_tenant_control_settings_v5(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text, bigint, text, text, jsonb, jsonb, text, text
) to authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s149_tenant_theme_colors;

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
  color_overrides jsonb;
  editorial jsonb;
  mode_policy jsonb;
  palette jsonb;
  resolved_at timestamptz := statement_timestamp();
  resolved_mode text;
  result jsonb;
  selection jsonb;
  settings record;
begin
  result := private.build_dynamic_snapshot_data_before_s149_tenant_theme_colors(
    p_slide
  );
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
    tenant_settings.timezone_name
  into settings
  from public.tenant_settings tenant_settings
  where tenant_settings.tenant_id = p_slide.tenant_id;

  color_overrides := settings.theme_color_overrides;
  if not private.tenant_theme_color_overrides_is_valid_v1(color_overrides) then
    return result;
  end if;
  mode_policy := settings.theme_mode_policy;
  resolved_mode := private.resolve_theme_mode_v1(
    mode_policy,
    coalesce(settings.timezone_name, 'Europe/Amsterdam'),
    resolved_at
  );
  palette := jsonb_set(
    color_overrides -> 'fieldflow',
    '{mode}',
    to_jsonb(resolved_mode),
    true
  );
  selection := jsonb_build_object(
    'ref', jsonb_build_object(
      'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
    ),
    'modePolicy', mode_policy,
    'accent', case
      when settings.theme_accent is null then 'null'::jsonb
      else to_jsonb(settings.theme_accent)
    end,
    'support', case
      when settings.theme_support is null then 'null'::jsonb
      else to_jsonb(settings.theme_support)
    end,
    'categoryOverrides', '[]'::jsonb
  );
  editorial := coalesce(result -> 'editorial', '{}'::jsonb)
    || jsonb_build_object(
      'schemaVersion', 2,
      'theme', palette,
      'themeSelection', selection
    );
  result := jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{editorial}',
    editorial,
    true
  );
  return jsonb_set(
    result,
    '{themePresentation}',
    jsonb_build_object(
      'catalogVersion', '1.0.0',
      'snapshotVersion', 1,
      'selection', selection,
      'resolvedMode', jsonb_build_object(
        'mode', resolved_mode,
        'policy', mode_policy,
        'resolvedAt', to_char(
          resolved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'timezone', coalesce(settings.timezone_name, 'Europe/Amsterdam')
      )
    ),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s149_tenant_theme_colors(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
