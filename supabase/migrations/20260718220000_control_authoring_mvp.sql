create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  default_image_duration_seconds integer not null default 10 check (
    default_image_duration_seconds between 5 and 3600
  ),
  default_fit_mode text not null default 'contain' check (
    default_fit_mode in ('contain', 'cover')
  ),
  default_video_muted boolean not null default true,
  default_screen_orientation text not null default 'landscape' check (
    default_screen_orientation in ('landscape', 'portrait')
  ),
  default_resolution_width integer not null default 1920 check (
    default_resolution_width between 320 and 7680
  ),
  default_resolution_height integer not null default 1080 check (
    default_resolution_height between 240 and 4320
  ),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_settings enable row level security;

grant select on public.tenant_settings to authenticated;

create policy "tenant_settings_select_by_scope"
on public.tenant_settings
for select
to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
);

create or replace function public.update_tenant_control_settings(
  p_tenant_id uuid,
  p_name text,
  p_default_image_duration_seconds integer,
  p_default_fit_mode text,
  p_default_video_muted boolean,
  p_default_screen_orientation text,
  p_default_resolution_width integer,
  p_default_resolution_height integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := btrim(p_name);
begin
  if actor_id is null then
    raise exception 'settings update requires an authenticated user' using errcode = '42501';
  end if;

  if not (
    private.has_tenant_role(p_tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot update tenant settings' using errcode = '42501';
  end if;

  if normalized_name is null or length(normalized_name) < 2 or length(normalized_name) > 120 then
    raise exception 'tenant name must contain 2 to 120 characters' using errcode = '23514';
  end if;

  if p_default_image_duration_seconds not between 5 and 3600
    or p_default_fit_mode not in ('contain', 'cover')
    or p_default_screen_orientation not in ('landscape', 'portrait')
    or p_default_resolution_width not between 320 and 7680
    or p_default_resolution_height not between 240 and 4320
  then
    raise exception 'one or more settings are outside the supported range' using errcode = '23514';
  end if;

  update public.tenants
  set
    name = normalized_name,
    updated_at = now()
  where id = p_tenant_id;

  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    default_image_duration_seconds,
    default_fit_mode,
    default_video_muted,
    default_screen_orientation,
    default_resolution_width,
    default_resolution_height,
    updated_by
  )
  values (
    p_tenant_id,
    p_default_image_duration_seconds,
    p_default_fit_mode,
    p_default_video_muted,
    p_default_screen_orientation,
    p_default_resolution_width,
    p_default_resolution_height,
    actor_id
  )
  on conflict (tenant_id) do update
  set
    default_image_duration_seconds = excluded.default_image_duration_seconds,
    default_fit_mode = excluded.default_fit_mode,
    default_video_muted = excluded.default_video_muted,
    default_screen_orientation = excluded.default_screen_orientation,
    default_resolution_width = excluded.default_resolution_width,
    default_resolution_height = excluded.default_resolution_height,
    updated_by = actor_id,
    updated_at = now();

  perform private.audit_event(
    p_tenant_id,
    'tenant.settings.updated',
    'tenant_settings',
    p_tenant_id,
    'success',
    jsonb_build_object(
      'defaultImageDurationSeconds', p_default_image_duration_seconds,
      'defaultFitMode', p_default_fit_mode,
      'defaultVideoMuted', p_default_video_muted,
      'defaultScreenOrientation', p_default_screen_orientation,
      'defaultResolutionWidth', p_default_resolution_width,
      'defaultResolutionHeight', p_default_resolution_height
    )
  );
end;
$$;

revoke all on function public.update_tenant_control_settings(
  uuid, text, integer, text, boolean, text, integer, integer
) from public, anon;
grant execute on function public.update_tenant_control_settings(
  uuid, text, integer, text, boolean, text, integer, integer
) to authenticated;

create or replace function public.reorder_playlist_item(
  p_item_id uuid,
  p_direction integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_record public.playlist_items%rowtype;
  target_record public.playlist_items%rowtype;
  temporary_sort_order integer;
begin
  if p_direction not in (-1, 1) then
    raise exception 'direction must be -1 or 1' using errcode = '23514';
  end if;

  select item.*
  into item_record
  from public.playlist_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'playlist item not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_tenant_role(item_record.tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot reorder this playlist' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.playlists playlist
    where playlist.tenant_id = item_record.tenant_id
      and playlist.id = item_record.playlist_id
      and playlist.status = 'archived'::public.playlist_status
  ) then
    raise exception 'archived playlists cannot be reordered' using errcode = '23514';
  end if;

  select item.*
  into target_record
  from public.playlist_items item
  where item.tenant_id = item_record.tenant_id
    and item.playlist_id = item_record.playlist_id
    and (
      (p_direction = -1 and item.sort_order < item_record.sort_order)
      or (p_direction = 1 and item.sort_order > item_record.sort_order)
    )
  order by
    case when p_direction = -1 then item.sort_order end desc,
    case when p_direction = 1 then item.sort_order end asc
  limit 1
  for update;

  if not found then
    return;
  end if;

  select coalesce(max(item.sort_order), 0) + 1
  into temporary_sort_order
  from public.playlist_items item
  where item.tenant_id = item_record.tenant_id
    and item.playlist_id = item_record.playlist_id;

  update public.playlist_items
  set sort_order = temporary_sort_order, updated_at = now()
  where id = target_record.id;

  update public.playlist_items
  set sort_order = target_record.sort_order, updated_at = now()
  where id = item_record.id;

  update public.playlist_items
  set sort_order = item_record.sort_order, updated_at = now()
  where id = target_record.id;

  update public.playlists
  set status = 'draft'::public.playlist_status, updated_at = now()
  where id = item_record.playlist_id;
end;
$$;

revoke all on function public.reorder_playlist_item(uuid, integer) from public, anon;
grant execute on function public.reorder_playlist_item(uuid, integer) to authenticated;

create or replace function public.retry_media_processing(
  p_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_record public.media_assets%rowtype;
  job_record public.media_processing_jobs%rowtype;
begin
  select asset.*
  into asset_record
  from public.media_assets asset
  where asset.id = p_asset_id
  for update;

  if not found then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_tenant_role(asset_record.tenant_id, array[
      'tenant_owner',
      'tenant_admin',
      'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot retry this media asset' using errcode = '42501';
  end if;

  if asset_record.kind <> 'video'::public.media_asset_kind
    or asset_record.status <> 'validation_failed'::public.media_asset_status
    or asset_record.deleted_at is not null
  then
    raise exception 'only failed active videos can be retried' using errcode = '23514';
  end if;

  select job.*
  into job_record
  from public.media_processing_jobs job
  where job.tenant_id = asset_record.tenant_id
    and job.asset_id = asset_record.id
  order by job.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'media processing job not found' using errcode = 'P0002';
  end if;

  update public.media_processing_jobs
  set
    status = 'queued'::public.media_processing_job_status,
    attempt_count = 0,
    locked_at = null,
    locked_by = null,
    started_at = null,
    finished_at = null,
    error_code = null,
    error_message = null,
    updated_at = now()
  where id = job_record.id;

  update public.media_assets
  set
    status = 'processing'::public.media_asset_status,
    validation_error = null,
    processed_at = null,
    updated_at = now()
  where id = asset_record.id;

  perform private.audit_event(
    asset_record.tenant_id,
    'media.processing.retried',
    'media_assets',
    asset_record.id,
    'success',
    jsonb_build_object('jobId', job_record.id)
  );
end;
$$;

revoke all on function public.retry_media_processing(uuid) from public, anon;
grant execute on function public.retry_media_processing(uuid) to authenticated;
