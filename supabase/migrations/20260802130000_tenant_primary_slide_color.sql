-- S86: one tenant-owned primary content colour for trusted dynamic news
-- templates. Immutable releases keep their frozen snapshot; mutable latest
-- slides receive a newly rendered snapshot when the colour changes.

alter table public.tenant_settings
  add column primary_color text not null default '#FF5C20'
    check (primary_color ~ '^#[0-9A-F]{6}$');

update public.tenant_settings settings
set primary_color = upper(brand.primary_color)
from public.studio_tenant_brand_kits brand
where brand.tenant_id = settings.tenant_id
  and brand.primary_color ~ '^#[0-9A-Fa-f]{6}$'
  and settings.primary_color is distinct from upper(brand.primary_color);

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_tenant_primary_color;

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
  tenant_primary_color text;
begin
  result :=
    private.build_dynamic_snapshot_data_before_tenant_primary_color(p_slide);

  if p_slide.slide_type <> 'news' then
    return result;
  end if;

  select settings.primary_color
  into tenant_primary_color
  from public.tenant_settings settings
  where settings.tenant_id = p_slide.tenant_id;

  tenant_primary_color := coalesce(tenant_primary_color, '#FF5C20');

  return result || jsonb_build_object(
    'brand',
    coalesce(result -> 'brand', '{}'::jsonb) || jsonb_build_object(
      'primaryColor',
      tenant_primary_color
    )
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function private.refresh_news_slides_after_primary_color()
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
    and source.kind = 'rss'
    and source.status = 'active'
    and exists (
      select 1
      from public.dynamic_slides slide
      where slide.tenant_id = source.tenant_id
        and slide.data_source_id = source.id
        and slide.slide_type = 'news'
        and slide.selection_mode = 'latest'
        and slide.status <> 'archived'
    );

  return new;
end;
$$;

revoke all on function private.refresh_news_slides_after_primary_color()
  from public, anon, authenticated;

create trigger tenant_primary_color_refreshes_news_slides
after insert or update of primary_color on public.tenant_settings
for each row execute function private.refresh_news_slides_after_primary_color();

create or replace function public.update_tenant_control_settings_v3(
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
  p_default_background_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_primary_color text :=
    upper(btrim(coalesce(p_primary_color, '')));
  normalized_timezone text := btrim(coalesce(p_timezone_name, ''));
  normalized_background text :=
    nullif(btrim(coalesce(p_default_background_color, '')), '');
begin
  if actor_id is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot update tenant settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if length(normalized_name) not between 2 and 120
    or normalized_primary_color !~ '^#[0-9A-F]{6}$'
    or p_default_image_duration_seconds not between 5 and 3600
    or p_default_fit_mode not in ('contain', 'cover')
    or p_default_screen_orientation not in ('landscape', 'portrait')
    or p_default_resolution_width not between 320 and 7680
    or p_default_resolution_height not between 240 and 4320
    or p_default_transition not in ('cut', 'crossfade', 'wipe')
    or (
      normalized_background is not null
      and normalized_background !~ '^#[0-9A-Fa-f]{6}$'
    )
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone
      where timezone.name = normalized_timezone
    )
  then
    raise exception 'one or more settings are outside the supported range'
      using errcode = '23514';
  end if;

  update public.tenants
  set name = normalized_name
  where id = p_tenant_id;
  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    primary_color,
    default_image_duration_seconds,
    default_fit_mode,
    default_video_muted,
    default_screen_orientation,
    default_resolution_width,
    default_resolution_height,
    timezone_name,
    default_transition,
    default_background_color,
    updated_by
  )
  values (
    p_tenant_id,
    normalized_primary_color,
    p_default_image_duration_seconds,
    p_default_fit_mode,
    p_default_video_muted,
    p_default_screen_orientation,
    p_default_resolution_width,
    p_default_resolution_height,
    normalized_timezone,
    p_default_transition,
    normalized_background,
    actor_id
  )
  on conflict (tenant_id) do update
  set primary_color = excluded.primary_color,
      default_image_duration_seconds =
        excluded.default_image_duration_seconds,
      default_fit_mode = excluded.default_fit_mode,
      default_video_muted = excluded.default_video_muted,
      default_screen_orientation = excluded.default_screen_orientation,
      default_resolution_width = excluded.default_resolution_width,
      default_resolution_height = excluded.default_resolution_height,
      timezone_name = excluded.timezone_name,
      default_transition = excluded.default_transition,
      default_background_color = excluded.default_background_color,
      updated_by = actor_id,
      updated_at = now();

  perform private.audit_event(
    p_tenant_id,
    'tenant.settings.updated',
    'tenant_settings',
    p_tenant_id,
    'success',
    jsonb_build_object(
      'primaryColor', normalized_primary_color,
      'defaultImageDurationSeconds', p_default_image_duration_seconds,
      'defaultFitMode', p_default_fit_mode,
      'defaultVideoMuted', p_default_video_muted,
      'defaultScreenOrientation', p_default_screen_orientation,
      'defaultResolutionWidth', p_default_resolution_width,
      'defaultResolutionHeight', p_default_resolution_height,
      'timezoneName', normalized_timezone,
      'defaultTransition', p_default_transition,
      'defaultBackgroundColor', normalized_background
    )
  );
end;
$$;

revoke all on function public.update_tenant_control_settings_v3(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text
) from public, anon, authenticated;

grant execute on function public.update_tenant_control_settings_v3(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text
) to authenticated;

-- Existing mutable RSS slides should immediately receive a snapshot carrying
-- the canonical tenant setting after this migration. The normal revision
-- trigger performs the immutable queueing and leaves published releases alone.
update public.dynamic_data_sources source
set revision = source.revision + 1
where source.kind = 'rss'
  and source.status = 'active'
  and exists (
    select 1
    from public.dynamic_slides slide
    where slide.tenant_id = source.tenant_id
      and slide.data_source_id = source.id
      and slide.slide_type = 'news'
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
  );
