-- S109: additive premium theme catalog settings. Existing snapshots and
-- immutable releases are intentionally untouched. Legacy slides remain
-- legacy until the explicit conversion command is called.

alter table public.tenant_settings
  add column default_theme_id text not null default 'editorial'
    check (default_theme_id in (
      'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
      'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
    )),
  add column default_theme_version text not null default '1.0.0'
    check (default_theme_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  add column theme_mode_policy jsonb not null default
    '{"kind":"fixed","mode":"light"}'::jsonb
    check (
      jsonb_typeof(theme_mode_policy) = 'object'
      and theme_mode_policy ->> 'kind' in ('fixed', 'schedule', 'auto')
    ),
  add column theme_accent text
    check (theme_accent is null or theme_accent ~ '^#[0-9A-F]{6}$'),
  add column theme_support text
    check (theme_support is null or theme_support ~ '^#[0-9A-F]{6}$'),
  add column theme_settings_revision bigint not null default 0
    check (theme_settings_revision >= 0);

alter table public.tenant_products
  add column source_category_id text;

update public.tenant_products product
set source_category_id = coalesce(
  nullif(product.custom_fields ->> 'source_category_id', ''),
  nullif(product.custom_fields ->> 'category_id', ''),
  encode(
    extensions.digest(
      pg_catalog.convert_to(
        product.tenant_id::text || chr(31) ||
        coalesce(product.data_source_id::text, 'manual') || chr(31) ||
        coalesce(nullif(btrim(product.category), ''), 'Overig'),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
)
where product.source_category_id is null;

alter table public.tenant_products
  alter column source_category_id set not null,
  add constraint tenant_products_source_category_id_check
    check (length(btrim(source_category_id)) between 1 and 200);

create index tenant_products_source_category_identity_idx
  on public.tenant_products(tenant_id, data_source_id, source_category_id);

create or replace function private.set_product_source_category_id_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  matching_category_id text;
begin
  if tg_op = 'UPDATE' then
    new.source_category_id := old.source_category_id;
    return new;
  end if;

  new.source_category_id := coalesce(
    nullif(btrim(new.source_category_id), ''),
    nullif(btrim(new.custom_fields ->> 'source_category_id'), ''),
    nullif(btrim(new.custom_fields ->> 'category_id'), '')
  );
  if new.source_category_id is not null then return new; end if;

  select product.source_category_id into matching_category_id
  from public.tenant_products product
  where product.tenant_id = new.tenant_id
    and product.data_source_id is not distinct from new.data_source_id
    and coalesce(nullif(btrim(product.category), ''), 'Overig') =
      coalesce(nullif(btrim(new.category), ''), 'Overig')
  order by product.created_at, product.id
  limit 1;

  new.source_category_id := coalesce(
    matching_category_id,
    encode(
      extensions.digest(
        pg_catalog.convert_to(
          new.tenant_id::text || chr(31) ||
          coalesce(new.data_source_id::text, 'manual') || chr(31) ||
          coalesce(nullif(btrim(new.category), ''), 'Overig'),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  );
  return new;
end;
$$;

revoke all on function private.set_product_source_category_id_v1()
  from public, anon, authenticated;

create trigger tenant_products_set_source_category_id_v1
before insert or update of category, custom_fields, data_source_id,
  source_category_id
on public.tenant_products
for each row execute function private.set_product_source_category_id_v1();

create table public.tenant_theme_category_overrides (
  tenant_id uuid not null,
  data_source_id uuid not null,
  source_category_id text not null
    check (length(btrim(source_category_id)) between 1 and 200),
  display_label text check (
    display_label is null
    or length(btrim(display_label)) between 1 and 28
  ),
  placement_column text check (placement_column in ('left', 'right')),
  placement_order integer check (
    placement_order is null or placement_order between 0 and 100000
  ),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, data_source_id, source_category_id),
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete cascade,
  check (
    (placement_column is null and placement_order is null)
    or (placement_column is not null and placement_order is not null)
  )
);

create index tenant_theme_category_overrides_source_idx
  on public.tenant_theme_category_overrides(
    tenant_id, data_source_id, placement_column, placement_order
  );

create trigger tenant_theme_category_overrides_set_updated_at
before update on public.tenant_theme_category_overrides
for each row execute function private.set_updated_at();

alter table public.tenant_theme_category_overrides enable row level security;
alter table public.tenant_theme_category_overrides force row level security;

revoke all on public.tenant_theme_category_overrides
  from public, anon, authenticated;
grant select on public.tenant_theme_category_overrides to authenticated;

create policy "tenant_theme_category_overrides_select_by_scope"
on public.tenant_theme_category_overrides
for select
to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function private.theme_selection_is_valid_v1(
  p_selection jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_selection) = 'object'
    and p_selection -> 'ref' ->> 'catalog' = 'v2'
    and p_selection -> 'ref' ->> 'id' in (
      'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
      'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
    )
    and p_selection -> 'ref' ->> 'version' ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
    and p_selection -> 'modePolicy' ->> 'kind' in (
      'fixed', 'schedule', 'auto'
    )
    and (
      not (p_selection ? 'accent')
      or p_selection -> 'accent' = 'null'::jsonb
      or p_selection ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
    )
    and (
      not (p_selection ? 'support')
      or p_selection -> 'support' = 'null'::jsonb
      or p_selection ->> 'support' ~ '^#[0-9A-Fa-f]{6}$'
    );
$$;

revoke all on function private.theme_selection_is_valid_v1(jsonb)
  from public, anon, authenticated;

create or replace function private.resolve_theme_mode_v1(
  p_policy jsonb,
  p_timezone text,
  p_instant timestamptz
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  local_instant timestamp;
  local_day integer;
  local_clock time;
  entry jsonb;
  start_clock time;
  end_clock time;
begin
  if coalesce(p_policy ->> 'kind', 'fixed') = 'fixed' then
    return case when p_policy ->> 'mode' = 'dark' then 'dark' else 'light' end;
  end if;

  local_instant := p_instant at time zone p_timezone;
  local_day := extract(dow from local_instant)::integer;
  local_clock := local_instant::time;

  if p_policy ->> 'kind' = 'schedule'
    and jsonb_typeof(p_policy -> 'entries') = 'array'
  then
    for entry in select value from jsonb_array_elements(p_policy -> 'entries')
    loop
      if jsonb_typeof(entry -> 'days') <> 'array'
        or not exists (
          select 1
          from jsonb_array_elements_text(entry -> 'days') day_value
          where day_value::integer = local_day
        )
      then
        continue;
      end if;
      begin
        start_clock := (entry ->> 'start')::time;
        end_clock := (entry ->> 'end')::time;
      exception when others then
        continue;
      end;
      if (
        start_clock <= end_clock
        and local_clock >= start_clock
        and local_clock < end_clock
      ) or (
        start_clock > end_clock
        and (local_clock >= start_clock or local_clock < end_clock)
      ) then
        return case when entry ->> 'mode' = 'dark' then 'dark' else 'light' end;
      end if;
    end loop;
    return case when p_policy ->> 'fallback' = 'dark' then 'dark' else 'light' end;
  end if;

  -- Auto is resolved and frozen server-side; Player playback never consults
  -- a mutable clock or browser preference.
  return case when local_clock >= time '18:00' or local_clock < time '07:00'
    then 'dark' else 'light' end;
end;
$$;

revoke all on function private.resolve_theme_mode_v1(jsonb, text, timestamptz)
  from public, anon, authenticated;

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
  actor_id uuid := private.current_user_id();
  next_revision bigint;
  selection jsonb;
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
    'accent', case when p_accent is null then 'null'::jsonb else to_jsonb(upper(p_accent)) end,
    'support', case when p_support is null then 'null'::jsonb else to_jsonb(upper(p_support)) end,
    'categoryOverrides', '[]'::jsonb
  );
  if not private.theme_selection_is_valid_v1(selection)
    or p_theme_version <> '1.0.0'
  then
    raise exception 'theme settings are invalid' using errcode = '23514';
  end if;

  update public.tenant_settings settings
  set default_theme_id = p_theme_id,
      default_theme_version = p_theme_version,
      theme_mode_policy = p_mode_policy,
      theme_accent = case when p_accent is null then null else upper(p_accent) end,
      theme_support = case when p_support is null then null else upper(p_support) end,
      theme_settings_revision = settings.theme_settings_revision + 1,
      updated_by = actor_id,
      updated_at = now()
  where settings.tenant_id = p_tenant_id
    and settings.theme_settings_revision = p_expected_revision
  returning settings.theme_settings_revision into next_revision;

  if next_revision is null then
    if not exists (
      select 1 from public.tenant_settings where tenant_id = p_tenant_id
    ) then
      raise exception 'tenant settings not found' using errcode = 'P0002';
    end if;
    return jsonb_build_object('outcome', 'conflict');
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
      'revision', next_revision
    )
  );
  return jsonb_build_object('outcome', 'applied', 'revision', next_revision);
end;
$$;

revoke all on function public.update_tenant_theme_settings_v1(
  uuid, bigint, text, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.update_tenant_theme_settings_v1(
  uuid, bigint, text, text, jsonb, text, text
) to authenticated;

create or replace function public.update_tenant_control_settings_v4(
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
  theme_result := public.update_tenant_theme_settings_v1(
    p_tenant_id,
    p_theme_expected_revision,
    p_theme_id,
    p_theme_version,
    p_theme_mode_policy,
    p_theme_accent,
    p_theme_support
  );
  if theme_result ->> 'outcome' <> 'applied' then
    raise exception 'theme settings changed concurrently'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_tenant_control_settings_v4(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text, bigint, text, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.update_tenant_control_settings_v4(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text, bigint, text, text, jsonb, text, text
) to authenticated;

create or replace function public.upsert_tenant_theme_category_override_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_source_category_id text,
  p_expected_revision bigint,
  p_display_label text default null,
  p_placement_column text default null,
  p_placement_order integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_revision bigint;
  next_revision bigint;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot update theme category overrides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1 from public.dynamic_data_sources source
    where source.id = p_data_source_id
      and source.tenant_id = p_tenant_id
      and source.kind in ('manual_products', 'twelve_excel')
      and source.status <> 'archived'
  ) or length(btrim(coalesce(p_source_category_id, ''))) not between 1 and 200
    or (
      p_display_label is not null
      and length(btrim(p_display_label)) not between 1 and 28
    )
    or ((p_placement_column is null) <> (p_placement_order is null))
    or (p_placement_column is not null and p_placement_column not in ('left', 'right'))
    or (p_placement_order is not null and p_placement_order not between 0 and 100000)
  then
    raise exception 'theme category override is invalid' using errcode = '23514';
  end if;

  select override.revision into current_revision
  from public.tenant_theme_category_overrides override
  where override.tenant_id = p_tenant_id
    and override.data_source_id = p_data_source_id
    and override.source_category_id = btrim(p_source_category_id)
  for update;

  if coalesce(current_revision, 0) <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict');
  end if;
  next_revision := coalesce(current_revision, 0) + 1;

  insert into public.tenant_theme_category_overrides (
    tenant_id, data_source_id, source_category_id, display_label,
    placement_column, placement_order, revision, created_by, updated_by
  ) values (
    p_tenant_id, p_data_source_id, btrim(p_source_category_id),
    nullif(btrim(p_display_label), ''), p_placement_column, p_placement_order,
    next_revision, actor_id, actor_id
  )
  on conflict (tenant_id, data_source_id, source_category_id) do update
  set display_label = excluded.display_label,
      placement_column = excluded.placement_column,
      placement_order = excluded.placement_order,
      revision = excluded.revision,
      updated_by = actor_id,
      updated_at = now();

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.category_override.updated',
    'tenant_theme_category_overrides',
    p_data_source_id,
    'success',
    jsonb_build_object(
      'sourceCategoryId', btrim(p_source_category_id),
      'revision', next_revision
    )
  );
  return jsonb_build_object('outcome', 'applied', 'revision', next_revision);
end;
$$;

revoke all on function public.upsert_tenant_theme_category_override_v1(
  uuid, uuid, text, bigint, text, text, integer
) from public, anon, authenticated;
grant execute on function public.upsert_tenant_theme_category_override_v1(
  uuid, uuid, text, bigint, text, text, integer
) to authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_theme_engine_v2;

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
  selection jsonb;
  policy jsonb;
  resolved_mode text;
  timezone_name text;
  resolved_at timestamptz := statement_timestamp();
  legacy_mode text;
begin
  result := private.build_dynamic_snapshot_data_before_theme_engine_v2(p_slide);
  selection := p_slide.configuration_json #> '{editorial,themeSelection}';

  if selection is null then
    legacy_mode := case
      when p_slide.configuration_json #>> '{editorial,theme,mode}' = 'dark'
        then 'dark'
      else 'light'
    end;
    selection := jsonb_build_object(
      'ref', jsonb_build_object(
        'catalog', 'legacy',
        'legacyThemeId', 'editorial-arena',
        'version', 1
      ),
      'modePolicy', jsonb_build_object('kind', 'fixed', 'mode', legacy_mode),
      'accent', 'null'::jsonb,
      'support', 'null'::jsonb,
      'categoryOverrides', '[]'::jsonb
    );
    resolved_mode := legacy_mode;
    timezone_name := 'UTC';
  else
    if not private.theme_selection_is_valid_v1(selection)
      or selection -> 'ref' ->> 'version' <> '1.0.0'
    then
      raise exception 'theme selection is invalid' using errcode = '23514';
    end if;
    select settings.timezone_name into timezone_name
    from public.tenant_settings settings
    where settings.tenant_id = p_slide.tenant_id;
    timezone_name := coalesce(timezone_name, 'Europe/Amsterdam');
    policy := selection -> 'modePolicy';
    if policy ->> 'kind' = 'schedule' then
      timezone_name := coalesce(nullif(policy ->> 'timezone', ''), timezone_name);
    end if;
    resolved_mode := private.resolve_theme_mode_v1(
      policy, timezone_name, resolved_at
    );
  end if;

  if jsonb_typeof(result -> 'editorial' -> 'theme') = 'object' then
    result := jsonb_set(
      result,
      '{editorial,theme,mode}',
      to_jsonb(resolved_mode),
      true
    );
  end if;

  return result || jsonb_build_object(
    'themePresentation', jsonb_build_object(
      'catalogVersion', '1.0.0',
      'snapshotVersion', 1,
      'selection', selection,
      'resolvedMode', jsonb_build_object(
        'mode', resolved_mode,
        'policy', selection -> 'modePolicy',
        'resolvedAt', to_char(resolved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'timezone', timezone_name
      )
    )
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;

-- The resolution timestamp is audit metadata, not render content. Keeping it
-- out of the canonical hash preserves immutable snapshot deduplication while
-- `resolvedMode.mode` still creates a new snapshot at an actual mode switch.
create or replace function private.dynamic_snapshot_content_hash_v1(
  p_slide public.dynamic_slides,
  p_snapshot_data jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'templateVersionId', p_slide.template_version_id,
          'configuration', p_slide.configuration_json,
          'data',
            coalesce(p_snapshot_data, '{}'::jsonb)
              #- '{menu,generatedAt}'
              #- '{news,generatedAt}'
              #- '{sport,generatedAt}'
              #- '{priceList,generatedAt}'
              #- '{themePresentation,resolvedMode,resolvedAt}'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function private.dynamic_snapshot_content_hash_v1(
  public.dynamic_slides,
  jsonb
) from public, anon, authenticated;

create or replace function public.convert_dynamic_slide_theme_v2(
  p_slide_id uuid,
  p_expected_revision bigint,
  p_selection jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
begin
  select * into slide from public.dynamic_slides where id = p_slide_id for update;
  if slide.id is null then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot convert dynamic slide theme'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if slide.revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict');
  end if;
  if not private.theme_selection_is_valid_v1(p_selection)
    or p_selection -> 'ref' ->> 'version' <> '1.0.0'
  then
    raise exception 'theme selection is invalid' using errcode = '23514';
  end if;

  update public.dynamic_slides
  set configuration_json = jsonb_set(
        case
          when jsonb_typeof(configuration_json -> 'editorial') = 'object'
            then configuration_json
          else jsonb_set(configuration_json, '{editorial}', '{}'::jsonb, true)
        end,
        '{editorial,themeSelection}',
        p_selection,
        true
      ),
      revision = revision + 1,
      updated_by = actor_id,
      updated_at = now()
  where id = slide.id;

  perform private.audit_event(
    slide.tenant_id,
    'dynamic_slide.theme.converted',
    'dynamic_slides',
    slide.id,
    'success',
    jsonb_build_object(
      'from', 'editorial-arena',
      'to', p_selection -> 'ref',
      'revision', slide.revision + 1
    )
  );
  return jsonb_build_object(
    'outcome', 'applied',
    'revision', slide.revision + 1
  );
end;
$$;

revoke all on function public.convert_dynamic_slide_theme_v2(
  uuid, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.convert_dynamic_slide_theme_v2(
  uuid, bigint, jsonb
) to authenticated;
