-- S31-B: server-authoritative Publisher commands, idempotency receipts,
-- authoring snapshots, restore-to-draft and paginated media-library queries.

alter table public.media_folders
  add column revision bigint not null default 0 check (revision >= 0);
alter table public.media_tags
  add column revision bigint not null default 0 check (revision >= 0);

alter table public.screens
  add column default_playlist_id uuid,
  add column default_release_id uuid,
  add column active_assignment_source text not null default 'default'
    check (active_assignment_source in ('default', 'schedule', 'override')),
  add column active_schedule_id uuid,
  add column active_target_snapshot_id uuid;

update public.screens
set default_playlist_id = assigned_playlist_id,
    default_release_id = assigned_release_id;

alter table public.screens
  add constraint screens_tenant_default_playlist_fkey
    foreign key (tenant_id, default_playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict,
  add constraint screens_tenant_default_release_fkey
    foreign key (tenant_id, default_playlist_id, default_release_id)
    references public.playlist_releases(tenant_id, playlist_id, id)
    on delete restrict,
  add constraint screens_tenant_active_schedule_fkey
    foreign key (tenant_id, active_schedule_id)
    references public.content_schedules(tenant_id, id)
    on delete set null (active_schedule_id),
  add constraint screens_tenant_active_target_snapshot_fkey
    foreign key (tenant_id, active_target_snapshot_id)
    references public.publisher_target_snapshots(tenant_id, id)
    on delete restrict,
  add constraint screens_default_assignment_pair_check check (
    (default_playlist_id is null and default_release_id is null)
    or (default_playlist_id is not null and default_release_id is not null)
  );

alter table public.release_screen_assignments
  drop constraint release_screen_assignments_assignment_kind_check,
  add constraint release_screen_assignments_assignment_kind_check
    check (assignment_kind in ('published', 'reassigned', 'scheduled', 'fallback'));

alter table public.playlist_release_items
  add column display_title text
    check (
      display_title is null
      or length(btrim(display_title)) between 2 and 120
    ),
  add column transition text not null default 'cut'
    check (transition in ('cut', 'crossfade', 'wipe')),
  add column crop_focus_x numeric(6, 5) not null default 0.5
    check (crop_focus_x between 0 and 1),
  add column crop_focus_y numeric(6, 5) not null default 0.5
    check (crop_focus_y between 0 and 1),
  add column background_color text
    check (
      background_color is null
      or background_color ~ '^#[0-9A-Fa-f]{6}$'
    ),
  add column volume_percent smallint not null default 100
    check (volume_percent between 0 and 100),
  add column trim_start_seconds numeric(10, 3) not null default 0
    check (trim_start_seconds >= 0 and trim_start_seconds <= 3600),
  add column trim_end_seconds numeric(10, 3)
    check (trim_end_seconds is null or trim_end_seconds > 0),
  add column visible_from timestamptz,
  add column visible_until timestamptz,
  add column enabled boolean not null default true,
  add column accessibility_name text
    check (
      accessibility_name is null
      or length(btrim(accessibility_name)) between 2 and 160
    ),
  add column section_source_id uuid,
  add column section_name text
    check (section_name is null or length(btrim(section_name)) between 2 and 120),
  add column section_position_key numeric(30, 10),
  add constraint playlist_release_items_trim_window_check check (
    trim_end_seconds is null or trim_end_seconds > trim_start_seconds
  ),
  add constraint playlist_release_items_visibility_window_check check (
    visible_until is null
    or visible_from is null
    or visible_until > visible_from
  );

create or replace function private.materialize_publisher_release_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_item public.playlist_items%rowtype;
  source_section public.playlist_sections%rowtype;
begin
  if new.source_item_id is null then
    return new;
  end if;
  select item.* into source_item
  from public.playlist_items item
  where item.tenant_id = new.tenant_id
    and item.playlist_id = new.playlist_id
    and item.id = new.source_item_id;
  if not found then
    raise exception 'release item source is unavailable' using errcode = '23503';
  end if;
  if source_item.section_id is not null then
    select section.* into source_section
    from public.playlist_sections section
    where section.tenant_id = source_item.tenant_id
      and section.playlist_id = source_item.playlist_id
      and section.id = source_item.section_id;
  end if;

  new.display_title := source_item.display_title;
  new.transition := source_item.transition;
  new.crop_focus_x := source_item.crop_focus_x;
  new.crop_focus_y := source_item.crop_focus_y;
  new.background_color := source_item.background_color;
  new.volume_percent := source_item.volume_percent;
  new.trim_start_seconds := source_item.trim_start_seconds;
  new.trim_end_seconds := source_item.trim_end_seconds;
  new.visible_from := source_item.visible_from;
  new.visible_until := source_item.visible_until;
  new.enabled := source_item.enabled;
  new.accessibility_name := source_item.accessibility_name;
  new.section_source_id := source_section.id;
  new.section_name := source_section.name;
  new.section_position_key := source_section.position_key;
  return new;
end;
$$;

create trigger playlist_release_items_materialize_publisher_fields
before insert on public.playlist_release_items
for each row execute function private.materialize_publisher_release_item();

create table public.publisher_command_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  command_type text not null check (length(btrim(command_type)) between 3 and 120),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  target_type text not null check (length(btrim(target_type)) between 2 and 120),
  target_id uuid,
  outcome_json jsonb not null check (jsonb_typeof(outcome_json) = 'object'),
  audit_event_id uuid not null references public.audit_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, actor_user_id, idempotency_key)
);

create index publisher_command_receipts_actor_created_idx
  on public.publisher_command_receipts(actor_user_id, created_at desc);
create index publisher_command_receipts_tenant_target_idx
  on public.publisher_command_receipts(tenant_id, target_type, target_id, created_at desc);

create table public.playlist_release_authoring_snapshots (
  tenant_id uuid not null,
  playlist_id uuid not null,
  release_id uuid not null,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, release_id),
  foreign key (tenant_id, playlist_id, release_id)
    references public.playlist_releases(tenant_id, playlist_id, id)
    on delete restrict
);

create index playlist_release_authoring_snapshots_playlist_idx
  on public.playlist_release_authoring_snapshots(tenant_id, playlist_id, created_at desc);

create trigger playlist_release_authoring_snapshots_reject_update
before update on public.playlist_release_authoring_snapshots
for each row execute function private.reject_publisher_target_snapshot_mutation();
create trigger playlist_release_authoring_snapshots_reject_delete
before delete on public.playlist_release_authoring_snapshots
for each row execute function private.reject_publisher_target_snapshot_mutation();

alter table public.publisher_command_receipts enable row level security;
alter table public.publisher_command_receipts force row level security;
alter table public.playlist_release_authoring_snapshots enable row level security;
alter table public.playlist_release_authoring_snapshots force row level security;

revoke all on
  public.publisher_command_receipts,
  public.playlist_release_authoring_snapshots
from public, anon, authenticated;
grant select on
  public.publisher_command_receipts,
  public.playlist_release_authoring_snapshots
to authenticated;

create policy "publisher_command_receipts_select_own"
on public.publisher_command_receipts for select to authenticated
using (
  actor_user_id = private.current_user_id()
  and (
    private.is_tenant_member(tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  )
);

create policy "playlist_release_authoring_snapshots_select_by_scope"
on public.playlist_release_authoring_snapshots for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function private.build_playlist_authoring_snapshot(
  p_playlist_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'playlistId', playlist.id,
    'tenantId', playlist.tenant_id,
    'playlist', jsonb_build_object(
      'name', playlist.name,
      'description', playlist.description,
      'defaultImageDurationSeconds', playlist.default_image_duration_seconds,
      'defaultTransition', playlist.default_transition,
      'defaultFitMode', playlist.default_fit_mode,
      'defaultBackgroundColor', playlist.default_background_color,
      'defaultVideoMuted', playlist.default_video_muted,
      'loopEnabled', playlist.loop_enabled
    ),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sourceSectionId', section.id,
          'name', section.name,
          'positionKey', section.position_key,
          'enabled', section.enabled,
          'defaultDurationSeconds', section.default_duration_seconds,
          'defaultTransition', section.default_transition
        )
        order by section.position_key, section.id
      )
      from public.playlist_sections section
      where section.tenant_id = playlist.tenant_id
        and section.playlist_id = playlist.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sourceItemId', item.id,
          'mediaAssetId', item.media_asset_id,
          'sectionPositionKey', section.position_key,
          'sortOrder', item.sort_order,
          'positionKey', item.position_key,
          'durationSeconds', item.duration_seconds,
          'fitMode', item.fit_mode,
          'muted', item.muted,
          'displayTitle', item.display_title,
          'transition', item.transition,
          'cropFocusX', item.crop_focus_x,
          'cropFocusY', item.crop_focus_y,
          'backgroundColor', item.background_color,
          'volumePercent', item.volume_percent,
          'trimStartSeconds', item.trim_start_seconds,
          'trimEndSeconds', item.trim_end_seconds,
          'visibleFrom', item.visible_from,
          'visibleUntil', item.visible_until,
          'enabled', item.enabled,
          'accessibilityName', item.accessibility_name
        )
        order by item.position_key, item.id
      )
      from public.playlist_items item
      left join public.playlist_sections section
        on section.tenant_id = item.tenant_id
        and section.playlist_id = item.playlist_id
        and section.id = item.section_id
      where item.tenant_id = playlist.tenant_id
        and item.playlist_id = playlist.id
    ), '[]'::jsonb)
  )
  from public.playlists playlist
  where playlist.id = p_playlist_id;
$$;

create or replace function private.begin_publisher_command(
  p_tenant_id uuid,
  p_command_type text,
  p_idempotency_key uuid,
  p_request_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_command text := btrim(coalesce(p_command_type, ''));
  request_hash text;
  receipt public.publisher_command_receipts%rowtype;
begin
  if actor_id is null or p_idempotency_key is null then
    raise exception 'authenticated idempotent command required' using errcode = '42501';
  end if;
  if length(normalized_command) not between 3 and 120
    or p_request_json is null
    or jsonb_typeof(p_request_json) <> 'object'
  then
    raise exception 'publisher command is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 31)
  );

  request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(p_request_json::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select command_receipt.*
  into receipt
  from public.publisher_command_receipts command_receipt
  where command_receipt.tenant_id = p_tenant_id
    and command_receipt.actor_user_id = actor_id
    and command_receipt.idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;

  if receipt.command_type is distinct from normalized_command
    or receipt.request_hash is distinct from request_hash
  then
    raise exception 'idempotency key belongs to another publisher command'
      using errcode = '23505';
  end if;

  return receipt.outcome_json;
end;
$$;

create or replace function private.complete_publisher_command(
  p_tenant_id uuid,
  p_command_type text,
  p_idempotency_key uuid,
  p_request_json jsonb,
  p_target_type text,
  p_target_id uuid,
  p_outcome_json jsonb,
  p_audit_action text,
  p_audit_result text default 'success'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  request_hash text;
  audit_id uuid;
begin
  if actor_id is null
    or p_idempotency_key is null
    or p_outcome_json is null
    or jsonb_typeof(p_outcome_json) <> 'object'
  then
    raise exception 'publisher command completion is invalid' using errcode = '22023';
  end if;

  request_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(p_request_json::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  audit_id := private.audit_event(
    p_tenant_id,
    p_audit_action,
    p_target_type,
    p_target_id,
    p_audit_result,
    jsonb_build_object(
      'commandType', p_command_type,
      'idempotencyKey', p_idempotency_key,
      'outcome', p_outcome_json
    )
  );

  insert into public.publisher_command_receipts (
    tenant_id,
    actor_user_id,
    idempotency_key,
    command_type,
    request_hash,
    target_type,
    target_id,
    outcome_json,
    audit_event_id
  )
  values (
    p_tenant_id,
    actor_id,
    p_idempotency_key,
    btrim(p_command_type),
    request_hash,
    btrim(p_target_type),
    p_target_id,
    p_outcome_json,
    audit_id
  );

  return p_outcome_json;
end;
$$;

create or replace function private.create_publisher_target_snapshot(
  p_tenant_id uuid,
  p_release_id uuid,
  p_schedule_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_screen_ids uuid[],
  p_resolved_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_screen_ids uuid[];
  target_document jsonb;
  snapshot_hash text;
  snapshot_id uuid;
  target_count integer;
begin
  select array_agg(screen_id order by screen_id)
  into normalized_screen_ids
  from (
    select distinct unnest(p_screen_ids) as screen_id
  ) targets;

  target_count := coalesce(array_length(normalized_screen_ids, 1), 0);
  if target_count = 0 then
    raise exception 'at least one target screen is required' using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.id = any(normalized_screen_ids)
      and screen.status <> 'disabled'::public.screen_status
  ) <> target_count then
    raise exception 'one or more target screens are unavailable' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.id = p_release_id
  ) then
    raise exception 'target release is unavailable' using errcode = '23514';
  end if;

  target_document := to_jsonb(normalized_screen_ids);
  snapshot_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(target_document::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.publisher_target_snapshots (
    tenant_id,
    release_id,
    schedule_id,
    source_kind,
    source_id,
    target_count,
    targets_json,
    snapshot_hash,
    resolved_by
  )
  values (
    p_tenant_id,
    p_release_id,
    p_schedule_id,
    p_source_kind,
    p_source_id,
    target_count,
    target_document,
    snapshot_hash,
    p_resolved_by
  )
  returning id into snapshot_id;

  insert into public.publisher_target_snapshot_screens (
    tenant_id,
    snapshot_id,
    screen_id,
    provenance_kind,
    provenance_id
  )
  select
    p_tenant_id,
    snapshot_id,
    screen_id,
    case
      when p_source_kind = 'screen_group' then 'screen_group'
      when p_source_kind = 'schedule' then 'schedule'
      when p_source_kind = 'screen' then 'screen'
      else 'direct'
    end,
    p_source_id
  from unnest(normalized_screen_ids) as screen_id;

  return snapshot_id;
end;
$$;

create or replace function public.create_tenant_playlist_template_v1(
  p_playlist_id uuid,
  p_name text,
  p_description text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  request_json jsonb;
  replay jsonb;
  snapshot jsonb;
  snapshot_hash text;
  template_id uuid;
  outcome jsonb;
begin
  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot create tenant templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if normalized_name is null or length(normalized_name) not between 2 and 120
    or (normalized_description is not null and length(normalized_description) > 500)
  then
    raise exception 'template details are invalid' using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'name', normalized_name,
    'description', normalized_description
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'tenant_template.create',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  snapshot := private.build_playlist_authoring_snapshot(playlist_record.id);
  snapshot_hash := encode(
    extensions.digest(pg_catalog.convert_to(snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.tenant_playlist_templates (
    tenant_id,
    source_playlist_id,
    name,
    description,
    snapshot_json,
    snapshot_hash,
    created_by,
    updated_by
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    normalized_name,
    normalized_description,
    snapshot,
    snapshot_hash,
    actor_id,
    actor_id
  )
  returning id into template_id;

  outcome := jsonb_build_object(
    'outcome', 'created',
    'templateId', template_id,
    'revision', 0
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'tenant_template.create',
    p_idempotency_key,
    request_json,
    'tenant_playlist_templates',
    template_id,
    outcome,
    'publisher.template.created'
  );
end;
$$;

create or replace function public.instantiate_tenant_playlist_template_v1(
  p_template_id uuid,
  p_name text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record public.tenant_playlist_templates%rowtype;
  normalized_name text := nullif(btrim(p_name), '');
  request_json jsonb;
  replay jsonb;
  playlist_document jsonb;
  new_playlist_id uuid;
  unavailable_asset_count integer;
  inserted_item_count integer;
  outcome jsonb;
begin
  select template.* into template_record
  from public.tenant_playlist_templates template
  where template.id = p_template_id
    and template.status = 'active';

  if not found then
    raise exception 'tenant template not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.can_write_playlist(template_record.tenant_id) then
    raise exception 'actor cannot instantiate tenant templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(template_record.tenant_id);
  if normalized_name is null or length(normalized_name) not between 2 and 120 then
    raise exception 'playlist name must contain 2 through 120 characters'
      using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'templateId', p_template_id,
    'name', normalized_name
  );
  replay := private.begin_publisher_command(
    template_record.tenant_id,
    'tenant_template.instantiate',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  playlist_document := template_record.snapshot_json -> 'playlist';
  if jsonb_typeof(playlist_document) <> 'object'
    or jsonb_typeof(template_record.snapshot_json -> 'sections') <> 'array'
    or jsonb_typeof(template_record.snapshot_json -> 'items') <> 'array'
  then
    raise exception 'tenant template snapshot is invalid' using errcode = '23514';
  end if;

  select count(*)::integer into unavailable_asset_count
  from jsonb_array_elements(template_record.snapshot_json -> 'items') item_document
  left join public.media_assets asset
    on asset.tenant_id = template_record.tenant_id
    and asset.id = (item_document ->> 'mediaAssetId')::uuid
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  where asset.id is null;

  if unavailable_asset_count > 0 then
    raise exception 'tenant template contains unavailable media' using errcode = '23514';
  end if;

  insert into public.playlists (
    tenant_id,
    name,
    description,
    status,
    revision,
    default_image_duration_seconds,
    default_transition,
    default_fit_mode,
    default_background_color,
    default_video_muted,
    loop_enabled,
    created_by,
    updated_by
  )
  values (
    template_record.tenant_id,
    normalized_name,
    nullif(playlist_document ->> 'description', ''),
    'draft'::public.playlist_status,
    0,
    coalesce((playlist_document ->> 'defaultImageDurationSeconds')::integer, 10),
    coalesce(playlist_document ->> 'defaultTransition', 'cut'),
    coalesce(playlist_document ->> 'defaultFitMode', 'contain'),
    nullif(playlist_document ->> 'defaultBackgroundColor', ''),
    coalesce((playlist_document ->> 'defaultVideoMuted')::boolean, true),
    coalesce((playlist_document ->> 'loopEnabled')::boolean, true),
    actor_id,
    actor_id
  )
  returning id into new_playlist_id;

  insert into public.playlist_sections (
    tenant_id,
    playlist_id,
    name,
    position_key,
    enabled,
    default_duration_seconds,
    default_transition,
    created_by,
    updated_by
  )
  select
    template_record.tenant_id,
    new_playlist_id,
    section_document ->> 'name',
    (section_document ->> 'positionKey')::numeric,
    coalesce((section_document ->> 'enabled')::boolean, true),
    nullif(section_document ->> 'defaultDurationSeconds', '')::integer,
    nullif(section_document ->> 'defaultTransition', ''),
    actor_id,
    actor_id
  from jsonb_array_elements(template_record.snapshot_json -> 'sections') section_document;

  insert into public.playlist_items (
    tenant_id,
    playlist_id,
    section_id,
    media_asset_id,
    sort_order,
    position_key,
    duration_seconds,
    fit_mode,
    muted,
    display_title,
    transition,
    crop_focus_x,
    crop_focus_y,
    background_color,
    volume_percent,
    trim_start_seconds,
    trim_end_seconds,
    visible_from,
    visible_until,
    enabled,
    accessibility_name,
    created_by
  )
  select
    template_record.tenant_id,
    new_playlist_id,
    section.id,
    (item_document ->> 'mediaAssetId')::uuid,
    (item_document ->> 'sortOrder')::integer,
    (item_document ->> 'positionKey')::numeric,
    (item_document ->> 'durationSeconds')::integer,
    item_document ->> 'fitMode',
    (item_document ->> 'muted')::boolean,
    nullif(item_document ->> 'displayTitle', ''),
    coalesce(item_document ->> 'transition', 'cut'),
    coalesce((item_document ->> 'cropFocusX')::numeric, 0.5),
    coalesce((item_document ->> 'cropFocusY')::numeric, 0.5),
    nullif(item_document ->> 'backgroundColor', ''),
    coalesce((item_document ->> 'volumePercent')::smallint, 100),
    coalesce((item_document ->> 'trimStartSeconds')::numeric, 0),
    nullif(item_document ->> 'trimEndSeconds', '')::numeric,
    nullif(item_document ->> 'visibleFrom', '')::timestamptz,
    nullif(item_document ->> 'visibleUntil', '')::timestamptz,
    coalesce((item_document ->> 'enabled')::boolean, true),
    nullif(item_document ->> 'accessibilityName', ''),
    actor_id
  from jsonb_array_elements(template_record.snapshot_json -> 'items') item_document
  left join public.playlist_sections section
    on section.tenant_id = template_record.tenant_id
    and section.playlist_id = new_playlist_id
    and section.position_key = nullif(item_document ->> 'sectionPositionKey', '')::numeric;

  get diagnostics inserted_item_count = row_count;

  outcome := jsonb_build_object(
    'outcome', 'created',
    'playlistId', new_playlist_id,
    'revision', 0,
    'itemCount', inserted_item_count
  );
  return private.complete_publisher_command(
    template_record.tenant_id,
    'tenant_template.instantiate',
    p_idempotency_key,
    request_json,
    'playlists',
    new_playlist_id,
    outcome,
    'publisher.template.instantiated'
  );
end;
$$;

create or replace function public.mutate_playlist_draft_v2(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  item_record public.playlist_items%rowtype;
  section_record public.playlist_sections%rowtype;
  media_record public.media_assets%rowtype;
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  item_id uuid;
  target_section_id uuid;
  target_position integer;
  item_count integer;
  offset_value integer;
  new_position_key numeric(30, 10);
  previous_position_key numeric(30, 10);
  next_position_key numeric(30, 10);
  actual_revision bigint;
  trim_start numeric(10, 3);
  trim_end numeric(10, 3);
  desired_visible_from timestamptz;
  desired_visible_until timestamptz;
begin
  if p_expected_revision is null or p_expected_revision < 0
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in (
      'update_playlist_defaults',
      'update_item_presentation',
      'move_item',
      'create_section',
      'update_section',
      'move_section',
      'delete_section',
      'assign_item_section'
    )
  then
    raise exception 'publisher draft mutation is invalid' using errcode = '22023';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot mutate this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be changed' using errcode = '23514';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.draft.v2.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.draft.v2.' || normalized_operation,
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.conflict',
      'failed'
    );
  end if;

  if normalized_operation = 'update_playlist_defaults' then
    if (p_payload ->> 'defaultImageDurationSeconds')::integer not between 5 and 3600
      or p_payload ->> 'defaultTransition' not in ('cut', 'crossfade', 'wipe')
      or p_payload ->> 'defaultFitMode' not in ('contain', 'cover')
      or (
        nullif(p_payload ->> 'defaultBackgroundColor', '') is not null
        and p_payload ->> 'defaultBackgroundColor' !~ '^#[0-9A-Fa-f]{6}$'
      )
    then
      raise exception 'playlist defaults are invalid' using errcode = '23514';
    end if;

    update public.playlists
    set default_image_duration_seconds = (p_payload ->> 'defaultImageDurationSeconds')::integer,
        default_transition = p_payload ->> 'defaultTransition',
        default_fit_mode = p_payload ->> 'defaultFitMode',
        default_background_color = nullif(p_payload ->> 'defaultBackgroundColor', ''),
        default_video_muted = coalesce((p_payload ->> 'defaultVideoMuted')::boolean, true),
        loop_enabled = coalesce((p_payload ->> 'loopEnabled')::boolean, true)
    where id = playlist_record.id;

  elsif normalized_operation = 'update_item_presentation' then
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      trim_start := coalesce((p_payload ->> 'trimStartSeconds')::numeric, 0);
      trim_end := nullif(p_payload ->> 'trimEndSeconds', '')::numeric;
      desired_visible_from := nullif(p_payload ->> 'visibleFrom', '')::timestamptz;
      desired_visible_until := nullif(p_payload ->> 'visibleUntil', '')::timestamptz;
    exception when invalid_text_representation then
      raise exception 'playlist item presentation is invalid' using errcode = '23514';
    end;

    select item.*
    into item_record
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id
    for update of item;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;
    select asset.* into media_record
    from public.media_assets asset
    where asset.tenant_id = item_record.tenant_id
      and asset.id = item_record.media_asset_id;

    if (p_payload ->> 'durationSeconds')::integer not between 5 and 3600
      or p_payload ->> 'fitMode' not in ('contain', 'cover')
      or p_payload ->> 'transition' not in ('cut', 'crossfade', 'wipe')
      or (p_payload ->> 'cropFocusX')::numeric not between 0 and 1
      or (p_payload ->> 'cropFocusY')::numeric not between 0 and 1
      or (p_payload ->> 'volumePercent')::integer not between 0 and 100
      or trim_start < 0
      or (trim_end is not null and trim_end <= trim_start)
      or (
        media_record.kind = 'video'::public.media_asset_kind
        and media_record.duration_seconds is not null
        and trim_end is not null
        and trim_end > media_record.duration_seconds
      )
      or (
        desired_visible_until is not null
        and desired_visible_from is not null
        and desired_visible_until <= desired_visible_from
      )
      or (
        nullif(p_payload ->> 'displayTitle', '') is not null
        and length(btrim(p_payload ->> 'displayTitle')) not between 2 and 120
      )
      or (
        nullif(p_payload ->> 'backgroundColor', '') is not null
        and p_payload ->> 'backgroundColor' !~ '^#[0-9A-Fa-f]{6}$'
      )
    then
      raise exception 'playlist item presentation is invalid' using errcode = '23514';
    end if;

    update public.playlist_items item
    set duration_seconds = (p_payload ->> 'durationSeconds')::integer,
        fit_mode = p_payload ->> 'fitMode',
        muted = coalesce((p_payload ->> 'muted')::boolean, true),
        display_title = nullif(btrim(p_payload ->> 'displayTitle'), ''),
        transition = p_payload ->> 'transition',
        crop_focus_x = (p_payload ->> 'cropFocusX')::numeric,
        crop_focus_y = (p_payload ->> 'cropFocusY')::numeric,
        background_color = nullif(p_payload ->> 'backgroundColor', ''),
        volume_percent = (p_payload ->> 'volumePercent')::smallint,
        trim_start_seconds = trim_start,
        trim_end_seconds = trim_end,
        visible_from = desired_visible_from,
        visible_until = desired_visible_until,
        enabled = coalesce((p_payload ->> 'enabled')::boolean, true),
        accessibility_name = nullif(btrim(p_payload ->> 'accessibilityName'), '')
    where item.id = item_record.id;

  elsif normalized_operation = 'move_item' then
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      target_position := (p_payload ->> 'targetPosition')::integer;
    exception when invalid_text_representation then
      raise exception 'playlist target position is invalid' using errcode = '23514';
    end;

    select item.* into item_record
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id
    for update;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

    select count(*)::integer into item_count
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;
    if target_position < 0 or target_position >= item_count then
      raise exception 'playlist target position is invalid' using errcode = '23514';
    end if;

    select ordered.position_key into previous_position_key
    from (
      select item.position_key,
             row_number() over (order by item.position_key, item.id) - 1 as position
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
        and item.id <> item_record.id
    ) ordered
    where ordered.position = target_position - 1;

    select ordered.position_key into next_position_key
    from (
      select item.position_key,
             row_number() over (order by item.position_key, item.id) - 1 as position
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
        and item.id <> item_record.id
    ) ordered
    where ordered.position = target_position;

    new_position_key := case
      when previous_position_key is null and next_position_key is null then 1024
      when previous_position_key is null then next_position_key / 2
      when next_position_key is null then previous_position_key + 1024
      else (previous_position_key + next_position_key) / 2
    end;

    set constraints playlist_items_tenant_playlist_position_key_uq deferred;
    update public.playlist_items
    set position_key = new_position_key
    where id = item_record.id;

    offset_value := item_count + 1;
    update public.playlist_items item
    set sort_order = item.sort_order + offset_value
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;
    with ordered as (
      select item.id, row_number() over (order by item.position_key, item.id) - 1 as new_order
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
    )
    update public.playlist_items item
    set sort_order = ordered.new_order
    from ordered
    where item.id = ordered.id;
    set constraints playlist_items_tenant_playlist_position_key_uq immediate;

  elsif normalized_operation = 'create_section' then
    if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120 then
      raise exception 'playlist section name is invalid' using errcode = '23514';
    end if;
    select coalesce(max(section.position_key) + 1024, 1024)
    into new_position_key
    from public.playlist_sections section
    where section.tenant_id = playlist_record.tenant_id
      and section.playlist_id = playlist_record.id;
    insert into public.playlist_sections (
      tenant_id, playlist_id, name, position_key, enabled,
      default_duration_seconds, default_transition, created_by, updated_by
    )
    values (
      playlist_record.tenant_id,
      playlist_record.id,
      btrim(p_payload ->> 'name'),
      new_position_key,
      coalesce((p_payload ->> 'enabled')::boolean, true),
      nullif(p_payload ->> 'defaultDurationSeconds', '')::integer,
      nullif(p_payload ->> 'defaultTransition', ''),
      actor_id,
      actor_id
    )
    returning id into target_section_id;

  elsif normalized_operation in ('update_section', 'move_section', 'delete_section') then
    begin
      target_section_id := (p_payload ->> 'sectionId')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist section id is invalid' using errcode = '23514';
    end;
    select section.* into section_record
    from public.playlist_sections section
    where section.tenant_id = playlist_record.tenant_id
      and section.playlist_id = playlist_record.id
      and section.id = target_section_id
    for update;
    if not found then
      raise exception 'playlist section not found' using errcode = 'P0002';
    end if;

    if normalized_operation = 'update_section' then
      if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120
        or (
          nullif(p_payload ->> 'defaultDurationSeconds', '') is not null
          and (p_payload ->> 'defaultDurationSeconds')::integer not between 5 and 3600
        )
        or (
          nullif(p_payload ->> 'defaultTransition', '') is not null
          and p_payload ->> 'defaultTransition' not in ('cut', 'crossfade', 'wipe')
        )
      then
        raise exception 'playlist section settings are invalid' using errcode = '23514';
      end if;
      update public.playlist_sections
      set name = btrim(p_payload ->> 'name'),
          enabled = coalesce((p_payload ->> 'enabled')::boolean, true),
          default_duration_seconds = nullif(p_payload ->> 'defaultDurationSeconds', '')::integer,
          default_transition = nullif(p_payload ->> 'defaultTransition', ''),
          updated_by = actor_id
      where id = section_record.id;
    elsif normalized_operation = 'move_section' then
      target_position := (p_payload ->> 'targetPosition')::integer;
      select count(*)::integer into item_count
      from public.playlist_sections section
      where section.tenant_id = playlist_record.tenant_id
        and section.playlist_id = playlist_record.id;
      if target_position < 0 or target_position >= item_count then
        raise exception 'playlist section target position is invalid' using errcode = '23514';
      end if;
      select ordered.position_key into previous_position_key
      from (
        select section.position_key,
               row_number() over (order by section.position_key, section.id) - 1 as position
        from public.playlist_sections section
        where section.tenant_id = playlist_record.tenant_id
          and section.playlist_id = playlist_record.id
          and section.id <> section_record.id
      ) ordered
      where ordered.position = target_position - 1;
      select ordered.position_key into next_position_key
      from (
        select section.position_key,
               row_number() over (order by section.position_key, section.id) - 1 as position
        from public.playlist_sections section
        where section.tenant_id = playlist_record.tenant_id
          and section.playlist_id = playlist_record.id
          and section.id <> section_record.id
      ) ordered
      where ordered.position = target_position;
      new_position_key := case
        when previous_position_key is null and next_position_key is null then 1024
        when previous_position_key is null then next_position_key / 2
        when next_position_key is null then previous_position_key + 1024
        else (previous_position_key + next_position_key) / 2
      end;
      set constraints all deferred;
      update public.playlist_sections
      set position_key = new_position_key, updated_by = actor_id
      where id = section_record.id;
      set constraints all immediate;
    else
      delete from public.playlist_sections where id = section_record.id;
    end if;

  else
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      target_section_id := nullif(p_payload ->> 'sectionId', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist item section assignment is invalid' using errcode = '23514';
    end;
    if target_section_id is not null and not exists (
      select 1 from public.playlist_sections section
      where section.tenant_id = playlist_record.tenant_id
        and section.playlist_id = playlist_record.id
        and section.id = target_section_id
    ) then
      raise exception 'playlist section not found' using errcode = 'P0002';
    end if;
    update public.playlist_items item
    set section_id = target_section_id
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;
  end if;

  update public.playlists
  set revision = revision + 1,
      status = 'draft'::public.playlist_status,
      updated_by = actor_id,
      updated_at = now()
  where id = playlist_record.id
  returning revision into actual_revision;

  outcome := jsonb_strip_nulls(jsonb_build_object(
    'outcome', 'applied',
    'actualRevision', actual_revision,
    'itemId', item_id,
    'sectionId', target_section_id
  ));
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.draft.v2.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'playlists',
    playlist_record.id,
    outcome,
    'publisher.playlist.' || normalized_operation
  );
end;
$$;

create or replace function public.mutate_media_organization_v1(
  p_tenant_id uuid,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  target_id uuid;
  folder_record public.media_folders%rowtype;
  tag_record public.media_tags%rowtype;
  asset_record public.media_assets%rowtype;
  target_folder_id uuid;
  target_tag_id uuid;
  asset_id uuid;
  new_parent_folder_id uuid;
  expected_revision bigint;
  actual_revision bigint;
begin
  if actor_id is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in (
      'create_folder',
      'update_folder',
      'delete_folder',
      'move_asset',
      'create_tag',
      'update_tag',
      'delete_tag',
      'assign_tag',
      'remove_tag',
      'set_favorite'
    )
  then
    raise exception 'media organization command is invalid' using errcode = '22023';
  end if;

  if normalized_operation = 'set_favorite' then
    if not private.is_tenant_member(p_tenant_id) then
      raise exception 'actor cannot manage favorites for this tenant' using errcode = '42501';
    end if;
  elsif not private.can_write_playlist(p_tenant_id) then
    raise exception 'actor cannot organize media for this tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'media.organization.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if normalized_operation in ('create_folder', 'update_folder') then
    new_parent_folder_id := nullif(p_payload ->> 'parentFolderId', '')::uuid;
    if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 1 and 120 then
      raise exception 'media folder name is invalid' using errcode = '23514';
    end if;
    if new_parent_folder_id is not null and not exists (
      select 1 from public.media_folders parent
      where parent.tenant_id = p_tenant_id and parent.id = new_parent_folder_id
    ) then
      raise exception 'parent media folder is unavailable' using errcode = '23514';
    end if;
  end if;

  if normalized_operation = 'create_folder' then
    insert into public.media_folders (
      tenant_id, parent_folder_id, name, position_key, created_by, updated_by
    )
    values (
      p_tenant_id,
      new_parent_folder_id,
      btrim(p_payload ->> 'name'),
      coalesce((
        select max(folder.position_key) + 1024
        from public.media_folders folder
        where folder.tenant_id = p_tenant_id
          and folder.parent_folder_id is not distinct from new_parent_folder_id
      ), 1024),
      actor_id,
      actor_id
    )
    returning id, revision into target_id, actual_revision;

  elsif normalized_operation in ('update_folder', 'delete_folder') then
    target_folder_id := (p_payload ->> 'folderId')::uuid;
    expected_revision := (p_payload ->> 'expectedRevision')::bigint;
    select folder.* into folder_record
    from public.media_folders folder
    where folder.tenant_id = p_tenant_id and folder.id = target_folder_id
    for update;
    if not found then
      raise exception 'media folder not found' using errcode = 'P0002';
    end if;
    target_id := folder_record.id;
    if folder_record.revision <> expected_revision then
      outcome := jsonb_build_object(
        'outcome', 'conflict',
        'actualRevision', folder_record.revision,
        'folderId', folder_record.id
      );
      return private.complete_publisher_command(
        p_tenant_id,
        'media.organization.' || normalized_operation,
        p_idempotency_key,
        request_json,
        'media_folders',
        folder_record.id,
        outcome,
        'publisher.media_folder.conflict',
        'failed'
      );
    end if;

    if normalized_operation = 'update_folder' then
      if new_parent_folder_id = folder_record.id or exists (
        with recursive descendants as (
          select child.id
          from public.media_folders child
          where child.tenant_id = p_tenant_id
            and child.parent_folder_id = folder_record.id
          union all
          select child.id
          from public.media_folders child
          join descendants parent on parent.id = child.parent_folder_id
          where child.tenant_id = p_tenant_id
        )
        select 1 from descendants where id = new_parent_folder_id
      ) then
        raise exception 'media folder hierarchy cannot contain a cycle' using errcode = '23514';
      end if;
      update public.media_folders
      set name = btrim(p_payload ->> 'name'),
          parent_folder_id = new_parent_folder_id,
          revision = revision + 1,
          updated_by = actor_id
      where id = folder_record.id
      returning revision into actual_revision;
    else
      if exists (
        select 1 from public.media_assets asset
        where asset.tenant_id = p_tenant_id and asset.folder_id = folder_record.id
      ) or exists (
        select 1 from public.media_folders child
        where child.tenant_id = p_tenant_id
          and child.parent_folder_id = folder_record.id
      ) then
        raise exception 'non-empty media folders cannot be deleted' using errcode = '23514';
      end if;
      delete from public.media_folders where id = folder_record.id;
      actual_revision := folder_record.revision;
    end if;

  elsif normalized_operation = 'move_asset' then
    asset_id := (p_payload ->> 'assetId')::uuid;
    target_folder_id := nullif(p_payload ->> 'folderId', '')::uuid;
    select asset.* into asset_record
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = asset_id
      and asset.deleted_at is null
    for update;
    if not found then
      raise exception 'media asset not found' using errcode = 'P0002';
    end if;
    if target_folder_id is not null and not exists (
      select 1 from public.media_folders folder
      where folder.tenant_id = p_tenant_id and folder.id = target_folder_id
    ) then
      raise exception 'media folder is unavailable' using errcode = '23514';
    end if;
    update public.media_assets
    set folder_id = target_folder_id
    where id = asset_record.id;
    target_id := asset_record.id;
    actual_revision := 0;

  elsif normalized_operation in ('create_tag', 'update_tag') then
    if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 1 and 48
      or (
        nullif(p_payload ->> 'color', '') is not null
        and p_payload ->> 'color' !~ '^#[0-9A-Fa-f]{6}$'
      )
    then
      raise exception 'media tag is invalid' using errcode = '23514';
    end if;
    if normalized_operation = 'create_tag' then
      insert into public.media_tags (
        tenant_id, name, color, created_by
      )
      values (
        p_tenant_id,
        btrim(p_payload ->> 'name'),
        nullif(p_payload ->> 'color', ''),
        actor_id
      )
      returning id, revision into target_id, actual_revision;
    else
      target_tag_id := (p_payload ->> 'tagId')::uuid;
      expected_revision := (p_payload ->> 'expectedRevision')::bigint;
      select tag.* into tag_record
      from public.media_tags tag
      where tag.tenant_id = p_tenant_id and tag.id = target_tag_id
      for update;
      if not found then
        raise exception 'media tag not found' using errcode = 'P0002';
      end if;
      target_id := tag_record.id;
      if tag_record.revision <> expected_revision then
        outcome := jsonb_build_object(
          'outcome', 'conflict',
          'actualRevision', tag_record.revision,
          'tagId', tag_record.id
        );
        return private.complete_publisher_command(
          p_tenant_id,
          'media.organization.' || normalized_operation,
          p_idempotency_key,
          request_json,
          'media_tags',
          tag_record.id,
          outcome,
          'publisher.media_tag.conflict',
          'failed'
        );
      end if;
      update public.media_tags
      set name = btrim(p_payload ->> 'name'),
          color = nullif(p_payload ->> 'color', ''),
          revision = revision + 1
      where id = tag_record.id
      returning revision into actual_revision;
    end if;

  elsif normalized_operation = 'delete_tag' then
    target_tag_id := (p_payload ->> 'tagId')::uuid;
    expected_revision := (p_payload ->> 'expectedRevision')::bigint;
    select tag.* into tag_record
    from public.media_tags tag
    where tag.tenant_id = p_tenant_id and tag.id = target_tag_id
    for update;
    if not found then
      raise exception 'media tag not found' using errcode = 'P0002';
    end if;
    if tag_record.revision <> expected_revision then
      outcome := jsonb_build_object(
        'outcome', 'conflict',
        'actualRevision', tag_record.revision,
        'tagId', tag_record.id
      );
      return private.complete_publisher_command(
        p_tenant_id,
        'media.organization.delete_tag',
        p_idempotency_key,
        request_json,
        'media_tags',
        tag_record.id,
        outcome,
        'publisher.media_tag.conflict',
        'failed'
      );
    end if;
    delete from public.media_tags where id = tag_record.id;
    target_id := tag_record.id;
    actual_revision := tag_record.revision;

  else
    asset_id := (p_payload ->> 'assetId')::uuid;
    select asset.* into asset_record
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = asset_id
      and asset.deleted_at is null;
    if not found then
      raise exception 'media asset not found' using errcode = 'P0002';
    end if;
    target_id := asset_record.id;
    actual_revision := 0;

    if normalized_operation in ('assign_tag', 'remove_tag') then
      target_tag_id := (p_payload ->> 'tagId')::uuid;
      if not exists (
        select 1 from public.media_tags tag
        where tag.tenant_id = p_tenant_id and tag.id = target_tag_id
      ) then
        raise exception 'media tag not found' using errcode = 'P0002';
      end if;
      if normalized_operation = 'assign_tag' then
        insert into public.media_asset_tags (
          tenant_id, media_asset_id, tag_id, created_by
        )
        values (p_tenant_id, asset_record.id, target_tag_id, actor_id)
        on conflict do nothing;
      else
        delete from public.media_asset_tags asset_tag
        where asset_tag.tenant_id = p_tenant_id
          and asset_tag.media_asset_id = asset_record.id
          and asset_tag.tag_id = target_tag_id;
      end if;
    else
      if coalesce((p_payload ->> 'favorite')::boolean, false) then
        insert into public.media_asset_favorites (
          tenant_id, media_asset_id, user_id
        )
        values (p_tenant_id, asset_record.id, actor_id)
        on conflict do nothing;
      else
        delete from public.media_asset_favorites favorite
        where favorite.tenant_id = p_tenant_id
          and favorite.media_asset_id = asset_record.id
          and favorite.user_id = actor_id;
      end if;
    end if;
  end if;

  outcome := jsonb_strip_nulls(jsonb_build_object(
    'outcome', 'applied',
    'targetId', target_id,
    'actualRevision', actual_revision
  ));
  return private.complete_publisher_command(
    p_tenant_id,
    'media.organization.' || normalized_operation,
    p_idempotency_key,
    request_json,
    case
      when normalized_operation like '%folder%' then 'media_folders'
      when normalized_operation like '%tag%' then 'media_tags'
      else 'media_assets'
    end,
    target_id,
    outcome,
    'publisher.media.' || normalized_operation
  );
end;
$$;

create or replace function public.list_publisher_media_assets_v1(
  p_tenant_id uuid,
  p_page_size integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_kind public.media_asset_kind default null,
  p_status public.media_asset_status default null,
  p_folder_id uuid default null,
  p_root_only boolean default false,
  p_tag_id uuid default null,
  p_favorites_only boolean default false,
  p_sort text default 'newest',
  p_created_from timestamptz default null,
  p_created_until timestamptz default null,
  p_usage text default 'all'
)
returns table (
  asset_id uuid,
  title text,
  original_file_name text,
  kind public.media_asset_kind,
  mime_type text,
  status public.media_asset_status,
  storage_path text,
  checksum_sha256 text,
  validation_error text,
  file_size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  folder_id uuid,
  is_favorite boolean,
  tags jsonb,
  draft_usage_count bigint,
  release_usage_count bigint,
  screen_usage_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_search text := nullif(btrim(p_search), '');
begin
  if actor_id is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot list media for this tenant' using errcode = '42501';
  end if;
  if p_page_size not between 1 and 100
    or p_offset < 0
    or p_sort not in ('newest', 'oldest', 'name', 'size')
    or p_usage not in ('all', 'used', 'unused')
    or (p_root_only and p_folder_id is not null)
    or (
      p_created_from is not null
      and p_created_until is not null
      and p_created_until <= p_created_from
    )
  then
    raise exception 'media library query is invalid' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      asset.id,
      asset.title,
      asset.original_file_name,
      asset.kind,
      asset.mime_type,
      asset.status,
      asset.storage_path,
      asset.checksum_sha256,
      asset.validation_error,
      asset.file_size_bytes,
      asset.duration_seconds,
      asset.width,
      asset.height,
      asset.folder_id,
      exists (
        select 1
        from public.media_asset_favorites favorite
        where favorite.tenant_id = asset.tenant_id
          and favorite.media_asset_id = asset.id
          and favorite.user_id = actor_id
      ) as is_favorite,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', tag.id,
            'name', tag.name,
            'color', tag.color
          )
          order by lower(tag.name), tag.id
        )
        from public.media_asset_tags asset_tag
        join public.media_tags tag
          on tag.tenant_id = asset_tag.tenant_id
          and tag.id = asset_tag.tag_id
        where asset_tag.tenant_id = asset.tenant_id
          and asset_tag.media_asset_id = asset.id
      ), '[]'::jsonb) as tags,
      (
        select count(distinct item.playlist_id)
        from public.playlist_items item
        where item.tenant_id = asset.tenant_id
          and item.media_asset_id = asset.id
      ) as draft_usage_count,
      (
        select count(distinct release_item.release_id)
        from public.playlist_release_items release_item
        where release_item.tenant_id = asset.tenant_id
          and release_item.media_asset_id = asset.id
      ) as release_usage_count,
      (
        select count(distinct screen.id)
        from public.screens screen
        join public.playlist_release_items release_item
          on release_item.tenant_id = screen.tenant_id
          and release_item.release_id = screen.assigned_release_id
          and release_item.media_asset_id = asset.id
        where screen.tenant_id = asset.tenant_id
          and screen.status <> 'disabled'::public.screen_status
      ) as screen_usage_count,
      asset.created_at,
      asset.updated_at
    from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.deleted_at is null
      and (normalized_search is null or asset.title ilike '%' || normalized_search || '%')
      and (p_kind is null or asset.kind = p_kind)
      and (p_status is null or asset.status = p_status)
      and (p_created_from is null or asset.created_at >= p_created_from)
      and (p_created_until is null or asset.created_at < p_created_until)
      and (p_folder_id is null or asset.folder_id = p_folder_id)
      and (not p_root_only or asset.folder_id is null)
      and (
        p_tag_id is null
        or exists (
          select 1 from public.media_asset_tags asset_tag
          where asset_tag.tenant_id = asset.tenant_id
            and asset_tag.media_asset_id = asset.id
            and asset_tag.tag_id = p_tag_id
        )
      )
      and (
        not p_favorites_only
        or exists (
          select 1 from public.media_asset_favorites favorite
          where favorite.tenant_id = asset.tenant_id
            and favorite.media_asset_id = asset.id
          and favorite.user_id = actor_id
        )
      )
      and (
        p_usage = 'all'
        or (
          p_usage = 'used'
          and (
            exists (
              select 1 from public.playlist_items item
              where item.tenant_id = asset.tenant_id
                and item.media_asset_id = asset.id
            )
            or exists (
              select 1 from public.playlist_release_items release_item
              where release_item.tenant_id = asset.tenant_id
                and release_item.media_asset_id = asset.id
            )
          )
        )
        or (
          p_usage = 'unused'
          and not exists (
            select 1 from public.playlist_items item
            where item.tenant_id = asset.tenant_id
              and item.media_asset_id = asset.id
          )
          and not exists (
            select 1 from public.playlist_release_items release_item
            where release_item.tenant_id = asset.tenant_id
              and release_item.media_asset_id = asset.id
          )
        )
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.title,
    counted.original_file_name,
    counted.kind,
    counted.mime_type,
    counted.status,
    counted.storage_path,
    counted.checksum_sha256,
    counted.validation_error,
    counted.file_size_bytes,
    counted.duration_seconds,
    counted.width,
    counted.height,
    counted.folder_id,
    counted.is_favorite,
    counted.tags,
    counted.draft_usage_count,
    counted.release_usage_count,
    counted.screen_usage_count,
    counted.created_at,
    counted.updated_at,
    counted.total_count
  from counted
  order by
    case when p_sort = 'newest' then counted.created_at end desc,
    case when p_sort = 'oldest' then counted.created_at end asc,
    case when p_sort = 'name' then lower(counted.title) end asc,
    case when p_sort = 'size' then counted.file_size_bytes end desc,
    counted.id
  limit p_page_size
  offset p_offset;
end;
$$;

create or replace function public.mutate_screen_group_v1(
  p_tenant_id uuid,
  p_group_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  group_record public.screen_groups%rowtype;
  group_id uuid;
  actual_revision bigint;
  requested_screen_ids uuid[];
  requested_count integer;
  valid_count integer;
  desired_default_release_id uuid;
  desired_default_playlist_id uuid;
begin
  if actor_id is null
    or not private.can_manage_screens(p_tenant_id)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in ('create', 'update', 'set_members', 'archive')
  then
    raise exception 'actor cannot mutate screen groups for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'groupId', p_group_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'screen_group.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if normalized_operation = 'create' then
    if p_group_id is not null or coalesce(p_expected_revision, 0) <> 0
      or length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120
    then
      raise exception 'screen group details are invalid' using errcode = '22023';
    end if;
    if p_payload ? 'screenIds' then
      if jsonb_typeof(p_payload -> 'screenIds') <> 'array' then
        raise exception 'screen group members are invalid' using errcode = '22023';
      end if;
      begin
        select array_agg(distinct value::uuid order by value::uuid)
        into requested_screen_ids
        from jsonb_array_elements_text(p_payload -> 'screenIds') value;
      exception when invalid_text_representation then
        raise exception 'screen group members are invalid' using errcode = '22023';
      end;
    else
      requested_screen_ids := array[]::uuid[];
    end if;
    requested_count := coalesce(array_length(requested_screen_ids, 1), 0);
    select count(*)::integer into valid_count
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.id = any(coalesce(requested_screen_ids, array[]::uuid[]))
      and screen.status <> 'disabled'::public.screen_status;
    if valid_count <> requested_count then
      raise exception 'one or more group screens are unavailable' using errcode = '23514';
    end if;

    desired_default_release_id := nullif(p_payload ->> 'defaultReleaseId', '')::uuid;
    if desired_default_release_id is not null then
      select release.playlist_id
      into desired_default_playlist_id
      from public.playlist_releases release
      where release.tenant_id = p_tenant_id
        and release.id = desired_default_release_id;
      if not found then
        raise exception 'screen group default release is unavailable' using errcode = '23514';
      end if;
    end if;

    insert into public.screen_groups (
      tenant_id,
      name,
      description,
      default_playlist_id,
      default_release_id,
      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      btrim(p_payload ->> 'name'),
      nullif(btrim(p_payload ->> 'description'), ''),
      desired_default_playlist_id,
      desired_default_release_id,
      actor_id,
      actor_id
    )
    returning id, revision into group_id, actual_revision;

    insert into public.screen_group_memberships (
      tenant_id, screen_group_id, screen_id, created_by
    )
    select p_tenant_id, group_id, requested_screen_id, actor_id
    from unnest(coalesce(requested_screen_ids, array[]::uuid[])) requested_screen_id;
  else
    select screen_group.* into group_record
    from public.screen_groups screen_group
    where screen_group.tenant_id = p_tenant_id
      and screen_group.id = p_group_id
    for update;
    if not found then
      raise exception 'screen group not found' using errcode = 'P0002';
    end if;
    group_id := group_record.id;
    if group_record.revision <> p_expected_revision then
      outcome := jsonb_build_object(
        'outcome', 'conflict',
        'groupId', group_record.id,
        'actualRevision', group_record.revision
      );
      return private.complete_publisher_command(
        p_tenant_id,
        'screen_group.' || normalized_operation,
        p_idempotency_key,
        request_json,
        'screen_groups',
        group_record.id,
        outcome,
        'publisher.screen_group.conflict',
        'failed'
      );
    end if;

    if normalized_operation = 'update' then
      if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120 then
        raise exception 'screen group details are invalid' using errcode = '22023';
      end if;
      if p_payload ? 'screenIds' then
        if jsonb_typeof(p_payload -> 'screenIds') <> 'array' then
          raise exception 'screen group members are invalid' using errcode = '22023';
        end if;
        begin
          select array_agg(distinct value::uuid order by value::uuid)
          into requested_screen_ids
          from jsonb_array_elements_text(p_payload -> 'screenIds') value;
        exception when invalid_text_representation then
          raise exception 'screen group members are invalid' using errcode = '22023';
        end;
        requested_count := coalesce(array_length(requested_screen_ids, 1), 0);
        select count(*)::integer into valid_count
        from public.screens screen
        where screen.tenant_id = p_tenant_id
          and screen.id = any(coalesce(requested_screen_ids, array[]::uuid[]))
          and screen.status <> 'disabled'::public.screen_status;
        if valid_count <> requested_count then
          raise exception 'one or more group screens are unavailable' using errcode = '23514';
        end if;
      end if;
      desired_default_release_id := nullif(p_payload ->> 'defaultReleaseId', '')::uuid;
      if desired_default_release_id is not null then
        select release.playlist_id
        into desired_default_playlist_id
        from public.playlist_releases release
        where release.tenant_id = p_tenant_id
          and release.id = desired_default_release_id;
        if not found then
          raise exception 'screen group default release is unavailable' using errcode = '23514';
        end if;
      end if;
      update public.screen_groups
      set name = btrim(p_payload ->> 'name'),
          description = nullif(btrim(p_payload ->> 'description'), ''),
          default_playlist_id = desired_default_playlist_id,
          default_release_id = desired_default_release_id,
          revision = revision + 1,
          updated_by = actor_id
      where id = group_record.id
      returning revision into actual_revision;
      if p_payload ? 'screenIds' then
        delete from public.screen_group_memberships membership
        where membership.tenant_id = p_tenant_id
          and membership.screen_group_id = group_record.id;
        insert into public.screen_group_memberships (
          tenant_id, screen_group_id, screen_id, created_by
        )
        select p_tenant_id, group_record.id, requested_screen_id, actor_id
        from unnest(
          coalesce(requested_screen_ids, array[]::uuid[])
        ) requested_screen_id;
      end if;

    elsif normalized_operation = 'set_members' then
      if jsonb_typeof(p_payload -> 'screenIds') <> 'array' then
        raise exception 'screen group members are invalid' using errcode = '22023';
      end if;
      begin
        select array_agg(distinct value::uuid order by value::uuid)
        into requested_screen_ids
        from jsonb_array_elements_text(p_payload -> 'screenIds') value;
      exception when invalid_text_representation then
        raise exception 'screen group members are invalid' using errcode = '22023';
      end;
      requested_count := coalesce(array_length(requested_screen_ids, 1), 0);
      select count(*)::integer into valid_count
      from public.screens screen
      where screen.tenant_id = p_tenant_id
        and screen.id = any(coalesce(requested_screen_ids, array[]::uuid[]))
        and screen.status <> 'disabled'::public.screen_status;
      if valid_count <> requested_count then
        raise exception 'one or more group screens are unavailable' using errcode = '23514';
      end if;

      delete from public.screen_group_memberships membership
      where membership.tenant_id = p_tenant_id
        and membership.screen_group_id = group_record.id;
      insert into public.screen_group_memberships (
        tenant_id, screen_group_id, screen_id, created_by
      )
      select p_tenant_id, group_record.id, screen_id, actor_id
      from unnest(coalesce(requested_screen_ids, array[]::uuid[])) screen_id;
      update public.screen_groups
      set revision = revision + 1, updated_by = actor_id
      where id = group_record.id
      returning revision into actual_revision;
    else
      if exists (
        select 1 from public.content_schedules schedule
        where schedule.tenant_id = p_tenant_id
          and schedule.target_screen_group_id = group_record.id
          and schedule.enabled
      ) then
        raise exception 'screen group has active schedules' using errcode = '23514';
      end if;
      update public.screen_groups
      set status = 'archived',
          archived_at = now(),
          revision = revision + 1,
          updated_by = actor_id
      where id = group_record.id
      returning revision into actual_revision;
    end if;
  end if;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'groupId', group_id,
    'actualRevision', actual_revision
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'screen_group.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'screen_groups',
    group_id,
    outcome,
    'publisher.screen_group.' || normalized_operation
  );
end;
$$;

create or replace function public.check_content_schedule_conflicts_v1(
  p_tenant_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_schedule_id uuid default null
)
returns table (
  schedule_id uuid,
  schedule_name text,
  screen_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer,
  source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot inspect schedules for this tenant' using errcode = '42501';
  end if;
  if p_target_kind not in ('screen', 'screen_group')
    or p_target_id is null
    or p_starts_at is null
    or (p_ends_at is not null and p_ends_at <= p_starts_at)
  then
    raise exception 'schedule conflict query is invalid' using errcode = '22023';
  end if;

  return query
  with proposed_screens as (
    select screen.id
    from public.screens screen
    where p_target_kind = 'screen'
      and screen.tenant_id = p_tenant_id
      and screen.id = p_target_id
      and screen.status <> 'disabled'::public.screen_status
    union
    select membership.screen_id
    from public.screen_group_memberships membership
    join public.screens screen
      on screen.tenant_id = membership.tenant_id
      and screen.id = membership.screen_id
      and screen.status <> 'disabled'::public.screen_status
    where p_target_kind = 'screen_group'
      and membership.tenant_id = p_tenant_id
      and membership.screen_group_id = p_target_id
  )
  select
    schedule.id,
    schedule.name,
    snapshot_screen.screen_id,
    schedule.starts_at,
    schedule.ends_at,
    schedule.priority,
    schedule.source
  from public.content_schedules schedule
  join public.publisher_target_snapshot_screens snapshot_screen
    on snapshot_screen.tenant_id = schedule.tenant_id
    and snapshot_screen.snapshot_id = schedule.target_snapshot_id
  join proposed_screens proposed on proposed.id = snapshot_screen.screen_id
  where schedule.tenant_id = p_tenant_id
    and schedule.enabled
    and schedule.id is distinct from p_exclude_schedule_id
    and tstzrange(
      schedule.starts_at,
      coalesce(schedule.ends_at, 'infinity'::timestamptz),
      '[)'
    ) && tstzrange(
      p_starts_at,
      coalesce(p_ends_at, 'infinity'::timestamptz),
      '[)'
    )
  order by schedule.starts_at, schedule.id, snapshot_screen.screen_id;
end;
$$;

create or replace function public.mutate_content_schedule_v1(
  p_tenant_id uuid,
  p_schedule_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  schedule_record public.content_schedules%rowtype;
  release_record public.playlist_releases%rowtype;
  schedule_id uuid;
  desired_target_id uuid;
  desired_target_kind text;
  desired_target_screen_id uuid;
  desired_target_group_id uuid;
  desired_release_id uuid;
  desired_timezone text;
  desired_schedule_kind text;
  desired_starts_at timestamptz;
  desired_ends_at timestamptz;
  desired_recurrence jsonb;
  desired_priority integer;
  desired_source text;
  target_screen_ids uuid[];
  snapshot_id uuid;
  actual_revision bigint;
begin
  if actor_id is null
    or not private.can_write_playlist(p_tenant_id)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in ('create', 'update', 'enable', 'disable')
  then
    raise exception 'actor cannot mutate schedules for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  request_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'scheduleId', p_schedule_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    p_tenant_id,
    'content_schedule.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if normalized_operation <> 'create' then
    select schedule.* into schedule_record
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and schedule.id = p_schedule_id
    for update;
    if not found then
      raise exception 'content schedule not found' using errcode = 'P0002';
    end if;
    schedule_id := schedule_record.id;
    if schedule_record.revision <> p_expected_revision then
      outcome := jsonb_build_object(
        'outcome', 'conflict',
        'scheduleId', schedule_record.id,
        'actualRevision', schedule_record.revision
      );
      return private.complete_publisher_command(
        p_tenant_id,
        'content_schedule.' || normalized_operation,
        p_idempotency_key,
        request_json,
        'content_schedules',
        schedule_record.id,
        outcome,
        'publisher.content_schedule.conflict',
        'failed'
      );
    end if;
  elsif p_schedule_id is not null or coalesce(p_expected_revision, 0) <> 0 then
    raise exception 'new content schedule identity is invalid' using errcode = '22023';
  end if;

  if normalized_operation in ('create', 'update') then
    begin
      desired_target_kind := p_payload ->> 'targetKind';
      desired_target_id := (p_payload ->> 'targetId')::uuid;
      desired_release_id := (p_payload ->> 'releaseId')::uuid;
      desired_starts_at := (p_payload ->> 'startsAt')::timestamptz;
      desired_ends_at := nullif(p_payload ->> 'endsAt', '')::timestamptz;
      desired_priority := coalesce((p_payload ->> 'priority')::integer, 100);
    exception when invalid_text_representation then
      raise exception 'content schedule details are invalid' using errcode = '22023';
    end;
    desired_timezone := p_payload ->> 'timezoneName';
    desired_schedule_kind := coalesce(p_payload ->> 'scheduleKind', 'once');
    desired_recurrence := coalesce(p_payload -> 'recurrence', '{}'::jsonb);
    desired_source := coalesce(p_payload ->> 'source', 'publisher');

    if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120
      or desired_target_kind not in ('screen', 'screen_group')
      or desired_starts_at is null
      or (desired_ends_at is not null and desired_ends_at <= desired_starts_at)
      or desired_schedule_kind not in ('once', 'daily', 'weekly', 'custom')
      or jsonb_typeof(desired_recurrence) <> 'object'
      or (desired_schedule_kind = 'once' and desired_recurrence <> '{}'::jsonb)
      or desired_priority not between 0 and 1000
      or desired_source not in ('publisher', 'override', 'fallback')
      or not exists (
        select 1 from pg_catalog.pg_timezone_names timezone
        where timezone.name = desired_timezone
      )
    then
      raise exception 'content schedule details are invalid' using errcode = '22023';
    end if;

    select release.* into release_record
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.id = desired_release_id;
    if not found then
      raise exception 'schedule release is unavailable' using errcode = '23514';
    end if;

    if desired_target_kind = 'screen' then
      desired_target_screen_id := desired_target_id;
      desired_target_group_id := null;
      select array_agg(screen.id order by screen.id)
      into target_screen_ids
      from public.screens screen
      where screen.tenant_id = p_tenant_id
        and screen.id = desired_target_id
        and screen.status <> 'disabled'::public.screen_status;
    else
      desired_target_screen_id := null;
      desired_target_group_id := desired_target_id;
      if not exists (
        select 1 from public.screen_groups screen_group
        where screen_group.tenant_id = p_tenant_id
          and screen_group.id = desired_target_id
          and screen_group.status = 'active'
      ) then
        raise exception 'schedule screen group is unavailable' using errcode = '23514';
      end if;
      select array_agg(membership.screen_id order by membership.screen_id)
      into target_screen_ids
      from public.screen_group_memberships membership
      join public.screens screen
        on screen.tenant_id = membership.tenant_id
        and screen.id = membership.screen_id
        and screen.status <> 'disabled'::public.screen_status
      where membership.tenant_id = p_tenant_id
        and membership.screen_group_id = desired_target_id;
    end if;
    if coalesce(array_length(target_screen_ids, 1), 0) = 0 then
      raise exception 'schedule target has no available screens' using errcode = '23514';
    end if;

    if normalized_operation = 'create' then
      insert into public.content_schedules (
        tenant_id,
        name,
        target_kind,
        target_screen_id,
        target_screen_group_id,
        playlist_id,
        release_id,
        timezone_name,
        schedule_kind,
        starts_at,
        ends_at,
        recurrence_json,
        priority,
        source,
        enabled,
        created_by,
        updated_by
      )
      values (
        p_tenant_id,
        btrim(p_payload ->> 'name'),
        desired_target_kind,
        desired_target_screen_id,
        desired_target_group_id,
        release_record.playlist_id,
        release_record.id,
        desired_timezone,
        desired_schedule_kind,
        desired_starts_at,
        desired_ends_at,
        desired_recurrence,
        desired_priority,
        desired_source,
        coalesce((p_payload ->> 'enabled')::boolean, true),
        actor_id,
        actor_id
      )
      returning id into schedule_id;
    else
      update public.content_schedules
      set name = btrim(p_payload ->> 'name'),
          target_kind = desired_target_kind,
          target_screen_id = desired_target_screen_id,
          target_screen_group_id = desired_target_group_id,
          playlist_id = release_record.playlist_id,
          release_id = release_record.id,
          timezone_name = desired_timezone,
          schedule_kind = desired_schedule_kind,
          starts_at = desired_starts_at,
          ends_at = desired_ends_at,
          recurrence_json = desired_recurrence,
          priority = desired_priority,
          source = desired_source,
          enabled = coalesce((p_payload ->> 'enabled')::boolean, schedule_record.enabled),
          updated_by = actor_id
      where id = schedule_record.id;
    end if;

    snapshot_id := private.create_publisher_target_snapshot(
      p_tenant_id,
      release_record.id,
      schedule_id,
      desired_target_kind,
      desired_target_id,
      target_screen_ids,
      actor_id
    );
    update public.content_schedules
    set target_snapshot_id = snapshot_id,
        revision = case when normalized_operation = 'create' then 0 else revision + 1 end,
        updated_by = actor_id
    where id = schedule_id
    returning revision into actual_revision;

  elsif normalized_operation = 'enable' then
    desired_target_kind := schedule_record.target_kind;
    desired_target_id := coalesce(
      schedule_record.target_screen_id,
      schedule_record.target_screen_group_id
    );
    if desired_target_kind = 'screen' then
      select array_agg(screen.id order by screen.id) into target_screen_ids
      from public.screens screen
      where screen.tenant_id = p_tenant_id
        and screen.id = desired_target_id
        and screen.status <> 'disabled'::public.screen_status;
    else
      select array_agg(membership.screen_id order by membership.screen_id)
      into target_screen_ids
      from public.screen_group_memberships membership
      join public.screens screen
        on screen.tenant_id = membership.tenant_id
        and screen.id = membership.screen_id
        and screen.status <> 'disabled'::public.screen_status
      where membership.tenant_id = p_tenant_id
        and membership.screen_group_id = desired_target_id;
    end if;
    snapshot_id := private.create_publisher_target_snapshot(
      p_tenant_id,
      schedule_record.release_id,
      schedule_record.id,
      desired_target_kind,
      desired_target_id,
      target_screen_ids,
      actor_id
    );
    update public.content_schedules
    set enabled = true,
        target_snapshot_id = snapshot_id,
        revision = revision + 1,
        updated_by = actor_id
    where id = schedule_record.id
    returning revision into actual_revision;
  else
    update public.content_schedules
    set enabled = false,
        revision = revision + 1,
        updated_by = actor_id
    where id = schedule_record.id
    returning revision into actual_revision;
  end if;

  outcome := jsonb_build_object(
    'outcome', 'applied',
    'scheduleId', schedule_id,
    'actualRevision', actual_revision,
    'targetSnapshotId', snapshot_id
  );
  return private.complete_publisher_command(
    p_tenant_id,
    'content_schedule.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'content_schedules',
    schedule_id,
    outcome,
    'publisher.content_schedule.' || normalized_operation
  );
end;
$$;

create or replace function private.content_schedule_is_due(
  p_schedule public.content_schedules,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_timestamp timestamp;
  local_time time;
  window_start time;
  window_end time;
  weekday integer;
begin
  if not p_schedule.enabled
    or p_at < p_schedule.starts_at
    or (p_schedule.ends_at is not null and p_at >= p_schedule.ends_at)
  then
    return false;
  end if;
  if p_schedule.schedule_kind = 'once' then
    return true;
  end if;

  local_timestamp := p_at at time zone p_schedule.timezone_name;
  local_time := local_timestamp::time;
  weekday := extract(isodow from local_timestamp)::integer;

  if p_schedule.schedule_kind in ('weekly', 'custom')
    and p_schedule.recurrence_json ? 'weekdays'
    and not exists (
      select 1
      from jsonb_array_elements_text(p_schedule.recurrence_json -> 'weekdays') day_value
      where day_value::integer = weekday
    )
  then
    return false;
  end if;

  if p_schedule.recurrence_json ? 'startTime'
    and p_schedule.recurrence_json ? 'endTime'
  then
    begin
      window_start := (p_schedule.recurrence_json ->> 'startTime')::time;
      window_end := (p_schedule.recurrence_json ->> 'endTime')::time;
    exception when invalid_datetime_format then
      return false;
    end;
    if window_start = window_end then
      return true;
    elsif window_start < window_end then
      return local_time >= window_start and local_time < window_end;
    else
      return local_time >= window_start or local_time < window_end;
    end if;
  end if;

  return true;
exception
  when invalid_text_representation then return false;
  when invalid_parameter_value then return false;
end;
$$;

create or replace function private.sync_screen_default_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active_assignment_source = 'default'
    and new.active_schedule_id is null
  then
    new.default_playlist_id := new.assigned_playlist_id;
    new.default_release_id := new.assigned_release_id;
  end if;
  return new;
end;
$$;

create trigger screens_sync_default_assignment
before insert or update of assigned_playlist_id, assigned_release_id on public.screens
for each row execute function private.sync_screen_default_assignment();

create or replace function public.apply_due_content_schedules_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  applied_count integer := 0;
  assignment_kind text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'schedule application requires service role' using errcode = '42501';
  end if;
  if p_now is null then
    raise exception 'schedule evaluation time is required' using errcode = '22023';
  end if;

  for target in
    select
      screen.id as screen_id,
      screen.tenant_id,
      screen.default_playlist_id,
      screen.default_release_id,
      screen.assigned_playlist_id,
      screen.assigned_release_id,
      screen.active_assignment_source,
      screen.active_schedule_id,
      screen.active_target_snapshot_id,
      winner.id as schedule_id,
      winner.playlist_id as schedule_playlist_id,
      winner.release_id as schedule_release_id,
      winner.source as schedule_source,
      winner.target_snapshot_id
    from public.screens screen
    left join lateral (
      select schedule.*
      from public.content_schedules schedule
      join public.publisher_target_snapshot_screens snapshot_screen
        on snapshot_screen.tenant_id = schedule.tenant_id
        and snapshot_screen.snapshot_id = schedule.target_snapshot_id
        and snapshot_screen.screen_id = screen.id
      where schedule.tenant_id = screen.tenant_id
        and private.content_schedule_is_due(schedule, p_now)
      order by
        case schedule.source
          when 'override' then 3
          when 'publisher' then 2
          else 1
        end desc,
        case schedule.target_kind when 'screen' then 2 else 1 end desc,
        schedule.priority desc,
        schedule.starts_at desc,
        schedule.id
      limit 1
    ) winner on true
    where screen.status <> 'disabled'::public.screen_status
      and exists (
        select 1 from public.tenants tenant
        where tenant.id = screen.tenant_id
          and tenant.status in (
            'active'::public.tenant_status,
            'paused'::public.tenant_status
          )
      )
  loop
    if target.schedule_id is not null then
      assignment_kind := 'scheduled';
      if target.assigned_release_id is not distinct from target.schedule_release_id
        and target.active_schedule_id is not distinct from target.schedule_id
        and target.active_target_snapshot_id is not distinct from target.target_snapshot_id
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.schedule_playlist_id,
          assigned_release_id = target.schedule_release_id,
          active_assignment_source = case
            when target.schedule_source = 'override' then 'override'
            else 'schedule'
          end,
          active_schedule_id = target.schedule_id,
          active_target_snapshot_id = target.target_snapshot_id
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    else
      assignment_kind := 'fallback';
      if target.assigned_release_id is not distinct from target.default_release_id
        and target.active_assignment_source = 'default'
        and target.active_schedule_id is null
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.default_playlist_id,
          assigned_release_id = target.default_release_id,
          active_assignment_source = 'default',
          active_schedule_id = null,
          active_target_snapshot_id = null
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    end if;

    update public.player_devices
    set desired_release_id = coalesce(
          target.schedule_release_id,
          target.default_release_id
        )
    where tenant_id = target.tenant_id
      and screen_id = target.screen_id
      and status = 'paired'::public.player_device_status;

    if coalesce(target.schedule_release_id, target.default_release_id) is not null then
      insert into public.release_screen_assignments (
        tenant_id,
        release_id,
        screen_id,
        assignment_kind,
        assigned_by,
        target_snapshot_id
      )
      values (
        target.tenant_id,
        coalesce(target.schedule_release_id, target.default_release_id),
        target.screen_id,
        assignment_kind,
        null,
        target.target_snapshot_id
      );
    end if;

    perform private.audit_event(
      target.tenant_id,
      case
        when target.schedule_id is null then 'publisher.schedule.fallback_applied'
        else 'publisher.schedule.applied'
      end,
      'screens',
      target.screen_id,
      'success',
      jsonb_strip_nulls(jsonb_build_object(
        'scheduleId', target.schedule_id,
        'targetSnapshotId', target.target_snapshot_id,
        'releaseId', coalesce(target.schedule_release_id, target.default_release_id),
        'evaluatedAt', p_now,
        'assignmentKind', assignment_kind
      ))
    );
    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;

create or replace function public.publish_playlist(
  p_playlist_id uuid,
  p_release_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  draft_item_count integer;
  publishable_item_count integer;
  next_version integer;
  release_id uuid;
  release_published_at timestamptz := now();
  manifest_items jsonb;
  manifest_document jsonb;
  manifest_hash text;
  total_duration integer;
  total_bytes bigint;
begin
  if actor_id is null then
    raise exception 'publish_playlist requires an authenticated user'
      using errcode = '42501';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be published' using errcode = '23514';
  end if;
  if not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);

  select count(*)::integer into draft_item_count
  from public.playlist_items item
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true);
  if draft_item_count = 0 then
    raise exception 'playlist has no enabled items to publish' using errcode = '23514';
  end if;

  select
    count(*)::integer,
    coalesce(sum(item.duration_seconds), 0)::integer,
    coalesce(sum(variant.file_size_bytes), 0)::bigint,
    jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'mediaAssetId', asset.id,
        'mediaVariantId', variant.id,
        'kind', asset.kind,
        'title', asset.title,
        'durationSeconds', item.duration_seconds,
        'fitMode', item.fit_mode,
        'muted', item.muted,
        'storage', jsonb_build_object(
          'bucket', variant.storage_bucket,
          'path', variant.storage_path,
          'mimeType', variant.mime_type,
          'bytes', variant.file_size_bytes,
          'checksumSha256', variant.checksum_sha256
        ),
        'metadata', jsonb_build_object(
          'width', variant.width,
          'height', variant.height,
          'durationSeconds', variant.duration_seconds
        )
      )
      || jsonb_strip_nulls(jsonb_build_object(
        'displayTitle', item.display_title,
        'transition', item.transition,
        'cropFocus', jsonb_build_object(
          'x', item.crop_focus_x,
          'y', item.crop_focus_y
        ),
        'backgroundColor', item.background_color,
        'volumePercent', item.volume_percent,
        'trim', jsonb_strip_nulls(jsonb_build_object(
          'startSeconds', item.trim_start_seconds,
          'endSeconds', item.trim_end_seconds
        )),
        'visibility', jsonb_strip_nulls(jsonb_build_object(
          'from', item.visible_from,
          'until', item.visible_until
        )),
        'enabled', item.enabled,
        'accessibilityName', item.accessibility_name,
        'section', case
          when section.id is null then null
          else jsonb_build_object(
            'sourceSectionId', section.id,
            'name', section.name,
            'positionKey', section.position_key
          )
        end
      ))
      order by
        case when section.id is null then 0 else 1 end,
        section.position_key,
        item.position_key,
        item.id
    )
  into
    publishable_item_count,
    total_duration,
    total_bytes,
    manifest_items
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true);

  if publishable_item_count <> draft_item_count then
    raise exception 'playlist contains items without ready player variants'
      using errcode = '23514';
  end if;

  select coalesce(max(release.version), 0) + 1 into next_version
  from public.playlist_releases release
  where release.tenant_id = playlist_record.tenant_id
    and release.playlist_id = playlist_record.id;

  manifest_document := jsonb_build_object(
    'schemaVersion', 1,
    'playlistId', playlist_record.id,
    'tenantId', playlist_record.tenant_id,
    'version', next_version,
    'publishedAt', release_published_at,
    'totalDurationSeconds', total_duration,
    'totalBytes', total_bytes,
    'presentationDefaults', jsonb_strip_nulls(jsonb_build_object(
      'imageDurationSeconds', playlist_record.default_image_duration_seconds,
      'transition', playlist_record.default_transition,
      'fitMode', playlist_record.default_fit_mode,
      'backgroundColor', playlist_record.default_background_color,
      'videoMuted', playlist_record.default_video_muted,
      'loopEnabled', playlist_record.loop_enabled
    )),
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
    tenant_id,
    playlist_id,
    version,
    release_notes,
    manifest_hash,
    manifest_json,
    item_count,
    total_duration_seconds,
    total_bytes,
    published_by,
    published_at
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    next_version,
    nullif(btrim(p_release_notes), ''),
    manifest_hash,
    manifest_document,
    publishable_item_count,
    total_duration,
    total_bytes,
    actor_id,
    release_published_at
  )
  returning id into release_id;

  insert into public.playlist_release_items (
    tenant_id,
    playlist_id,
    release_id,
    source_item_id,
    media_asset_id,
    media_variant_id,
    sort_order,
    duration_seconds,
    fit_mode,
    muted,
    asset_kind,
    asset_title,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    width,
    height,
    asset_duration_seconds
  )
  select
    playlist_record.tenant_id,
    playlist_record.id,
    release_id,
    item.id,
    asset.id,
    variant.id,
    (
      row_number() over (
        order by
          case when section.id is null then 0 else 1 end,
          section.position_key,
          item.position_key,
          item.id
      ) - 1
    )::integer,
    item.duration_seconds,
    item.fit_mode,
    item.muted,
    asset.kind,
    asset.title,
    variant.storage_bucket,
    variant.storage_path,
    variant.mime_type,
    variant.file_size_bytes,
    variant.checksum_sha256,
    variant.width,
    variant.height,
    variant.duration_seconds
  from public.playlist_items item
  join public.media_assets asset
    on asset.tenant_id = item.tenant_id
    and asset.id = item.media_asset_id
    and asset.status = 'ready'::public.media_asset_status
    and asset.deleted_at is null
  join public.media_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.asset_id = item.media_asset_id
    and variant.variant_type = case
      when asset.kind = 'video'::public.media_asset_kind
        then 'player_1080p'::public.media_variant_type
      else 'original'::public.media_variant_type
    end
  left join public.playlist_sections section
    on section.tenant_id = item.tenant_id
    and section.playlist_id = item.playlist_id
    and section.id = item.section_id
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id
    and item.enabled
    and coalesce(section.enabled, true)
  order by
    case when section.id is null then 0 else 1 end,
    section.position_key,
    item.position_key,
    item.id;

  update public.playlists
  set status = 'published'::public.playlist_status
  where id = playlist_record.id;

  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.release.published',
    'playlist_releases',
    release_id,
    'success',
    jsonb_build_object(
      'playlistId', playlist_record.id,
      'version', next_version,
      'itemCount', publishable_item_count,
      'manifestHash', manifest_hash
    )
  );
  return release_id;
end;
$$;

create or replace function public.update_tenant_control_settings_v2(
  p_tenant_id uuid,
  p_name text,
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
  normalized_timezone text := btrim(coalesce(p_timezone_name, ''));
  normalized_background text := nullif(btrim(coalesce(p_default_background_color, '')), '');
begin
  if actor_id is null or not (
    private.has_tenant_role(p_tenant_id, array[
      'tenant_owner', 'tenant_admin'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'actor cannot update tenant settings' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if length(normalized_name) not between 2 and 120
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
      select 1 from pg_catalog.pg_timezone_names timezone
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
  set default_image_duration_seconds = excluded.default_image_duration_seconds,
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

create or replace function public.publish_playlist_to_targets_v3(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_screen_ids uuid[],
  p_release_notes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  request_json jsonb;
  replay jsonb;
  publish_outcome text;
  publish_revision bigint;
  new_release_id uuid;
  authoring_snapshot jsonb;
  authoring_hash text;
  target_snapshot_id uuid;
  outcome jsonb;
begin
  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if private.current_user_id() is null
    or not private.can_write_playlist(playlist_record.tenant_id)
  then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0
    or coalesce(array_length(p_screen_ids, 1), 0) = 0
  then
    raise exception 'publish targets are invalid' using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedRevision', p_expected_revision,
    'screenIds', to_jsonb(p_screen_ids),
    'releaseNotes', p_release_notes
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.publish.v3',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.publish.v3',
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.publish_conflict',
      'failed'
    );
  end if;

  authoring_snapshot := private.build_playlist_authoring_snapshot(playlist_record.id);
  authoring_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(authoring_snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select result.outcome, result.actual_revision, result.release_id
  into publish_outcome, publish_revision, new_release_id
  from public.publish_playlist_to_screens_v2(
    p_playlist_id,
    p_expected_revision,
    p_screen_ids,
    p_release_notes
  ) result;

  if publish_outcome <> 'published' or new_release_id is null then
    raise exception 'playlist publication did not create a release'
      using errcode = 'P0001';
  end if;

  insert into public.playlist_release_authoring_snapshots (
    tenant_id,
    playlist_id,
    release_id,
    snapshot_json,
    snapshot_hash
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    new_release_id,
    authoring_snapshot,
    authoring_hash
  );

  target_snapshot_id := private.create_publisher_target_snapshot(
    playlist_record.tenant_id,
    new_release_id,
    null,
    'direct',
    null,
    p_screen_ids,
    private.current_user_id()
  );

  update public.screens
  set active_assignment_source = 'default',
      active_schedule_id = null,
      active_target_snapshot_id = target_snapshot_id,
      default_playlist_id = playlist_record.id,
      default_release_id = new_release_id
  where tenant_id = playlist_record.tenant_id
    and id = any(p_screen_ids);

  outcome := jsonb_build_object(
    'outcome', 'published',
    'actualRevision', publish_revision,
    'releaseId', new_release_id,
    'targetSnapshotId', target_snapshot_id
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.publish.v3',
    p_idempotency_key,
    request_json,
    'playlist_releases',
    new_release_id,
    outcome,
    'publisher.playlist.published'
  );
end;
$$;

create or replace function public.restore_playlist_release_to_draft_v1(
  p_release_id uuid,
  p_expected_revision bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  release_record public.playlist_releases%rowtype;
  playlist_record public.playlists%rowtype;
  request_json jsonb;
  replay jsonb;
  authoring_snapshot jsonb;
  playlist_document jsonb;
  restored_item_count integer;
  actual_revision bigint;
  outcome jsonb;
begin
  select release.* into release_record
  from public.playlist_releases release
  where release.id = p_release_id;
  if not found then
    raise exception 'playlist release not found' using errcode = 'P0002';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.tenant_id = release_record.tenant_id
    and playlist.id = release_record.playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot restore this release' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected revision is required' using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'releaseId', p_release_id,
    'expectedRevision', p_expected_revision
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.release.restore_to_draft',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.release.restore_to_draft',
      p_idempotency_key,
      request_json,
      'playlist_releases',
      release_record.id,
      outcome,
      'publisher.playlist.restore_conflict',
      'failed'
    );
  end if;

  select snapshot.snapshot_json into authoring_snapshot
  from public.playlist_release_authoring_snapshots snapshot
  where snapshot.tenant_id = release_record.tenant_id
    and snapshot.release_id = release_record.id;

  if authoring_snapshot is null then
    authoring_snapshot := jsonb_build_object(
      'schemaVersion', 1,
      'playlistId', playlist_record.id,
      'tenantId', playlist_record.tenant_id,
      'playlist', jsonb_build_object(
        'name', playlist_record.name,
        'description', playlist_record.description,
        'defaultImageDurationSeconds', playlist_record.default_image_duration_seconds,
        'defaultTransition', playlist_record.default_transition,
        'defaultFitMode', playlist_record.default_fit_mode,
        'defaultBackgroundColor', playlist_record.default_background_color,
        'defaultVideoMuted', playlist_record.default_video_muted,
        'loopEnabled', playlist_record.loop_enabled
      ),
      'sections', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sourceSectionId', release_section.section_source_id,
            'name', release_section.section_name,
            'positionKey', release_section.section_position_key,
            'enabled', true,
            'defaultDurationSeconds', null,
            'defaultTransition', null
          )
          order by release_section.section_position_key,
                   release_section.section_source_id
        )
        from (
          select distinct
            release_item.section_source_id,
            release_item.section_name,
            release_item.section_position_key
          from public.playlist_release_items release_item
          where release_item.tenant_id = release_record.tenant_id
            and release_item.release_id = release_record.id
            and release_item.section_source_id is not null
        ) release_section
      ), '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sourceItemId', release_item.source_item_id,
            'mediaAssetId', release_item.media_asset_id,
            'sectionPositionKey', release_item.section_position_key,
            'sortOrder', release_item.sort_order,
            'positionKey', (release_item.sort_order::numeric + 1) * 1024,
            'durationSeconds', release_item.duration_seconds,
            'fitMode', release_item.fit_mode,
            'muted', release_item.muted,
            'displayTitle', release_item.display_title,
            'transition', release_item.transition,
            'cropFocusX', release_item.crop_focus_x,
            'cropFocusY', release_item.crop_focus_y,
            'backgroundColor', release_item.background_color,
            'volumePercent', release_item.volume_percent,
            'trimStartSeconds', release_item.trim_start_seconds,
            'trimEndSeconds', release_item.trim_end_seconds,
            'visibleFrom', release_item.visible_from,
            'visibleUntil', release_item.visible_until,
            'enabled', release_item.enabled,
            'accessibilityName', release_item.accessibility_name
          )
          order by release_item.sort_order
        )
        from public.playlist_release_items release_item
        where release_item.tenant_id = release_record.tenant_id
          and release_item.release_id = release_record.id
      ), '[]'::jsonb)
    );
  end if;

  playlist_document := authoring_snapshot -> 'playlist';
  if jsonb_typeof(playlist_document) <> 'object'
    or jsonb_typeof(authoring_snapshot -> 'sections') <> 'array'
    or jsonb_typeof(authoring_snapshot -> 'items') <> 'array'
  then
    raise exception 'release authoring snapshot is invalid' using errcode = '23514';
  end if;

  delete from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;
  delete from public.playlist_sections section
  where section.tenant_id = playlist_record.tenant_id
    and section.playlist_id = playlist_record.id;

  insert into public.playlist_sections (
    tenant_id,
    playlist_id,
    name,
    position_key,
    enabled,
    default_duration_seconds,
    default_transition,
    created_by,
    updated_by
  )
  select
    playlist_record.tenant_id,
    playlist_record.id,
    section_document ->> 'name',
    (section_document ->> 'positionKey')::numeric,
    coalesce((section_document ->> 'enabled')::boolean, true),
    nullif(section_document ->> 'defaultDurationSeconds', '')::integer,
    nullif(section_document ->> 'defaultTransition', ''),
    actor_id,
    actor_id
  from jsonb_array_elements(authoring_snapshot -> 'sections') section_document;

  insert into public.playlist_items (
    tenant_id,
    playlist_id,
    section_id,
    media_asset_id,
    sort_order,
    position_key,
    duration_seconds,
    fit_mode,
    muted,
    display_title,
    transition,
    crop_focus_x,
    crop_focus_y,
    background_color,
    volume_percent,
    trim_start_seconds,
    trim_end_seconds,
    visible_from,
    visible_until,
    enabled,
    accessibility_name,
    created_by
  )
  select
    playlist_record.tenant_id,
    playlist_record.id,
    section.id,
    (item_document ->> 'mediaAssetId')::uuid,
    (item_document ->> 'sortOrder')::integer,
    (item_document ->> 'positionKey')::numeric,
    (item_document ->> 'durationSeconds')::integer,
    item_document ->> 'fitMode',
    coalesce((item_document ->> 'muted')::boolean, true),
    nullif(item_document ->> 'displayTitle', ''),
    coalesce(item_document ->> 'transition', 'cut'),
    coalesce((item_document ->> 'cropFocusX')::numeric, 0.5),
    coalesce((item_document ->> 'cropFocusY')::numeric, 0.5),
    nullif(item_document ->> 'backgroundColor', ''),
    coalesce((item_document ->> 'volumePercent')::smallint, 100),
    coalesce((item_document ->> 'trimStartSeconds')::numeric, 0),
    nullif(item_document ->> 'trimEndSeconds', '')::numeric,
    nullif(item_document ->> 'visibleFrom', '')::timestamptz,
    nullif(item_document ->> 'visibleUntil', '')::timestamptz,
    coalesce((item_document ->> 'enabled')::boolean, true),
    nullif(item_document ->> 'accessibilityName', ''),
    actor_id
  from jsonb_array_elements(authoring_snapshot -> 'items') item_document
  left join public.playlist_sections section
    on section.tenant_id = playlist_record.tenant_id
    and section.playlist_id = playlist_record.id
    and section.position_key = nullif(item_document ->> 'sectionPositionKey', '')::numeric;
  get diagnostics restored_item_count = row_count;

  if restored_item_count = 0 then
    raise exception 'release has no restorable playlist items' using errcode = '23514';
  end if;

  update public.playlists
  set name = coalesce(nullif(playlist_document ->> 'name', ''), name),
      description = nullif(playlist_document ->> 'description', ''),
      status = 'draft'::public.playlist_status,
      archived_at = null,
      default_image_duration_seconds = coalesce(
        (playlist_document ->> 'defaultImageDurationSeconds')::integer,
        default_image_duration_seconds
      ),
      default_transition = coalesce(
        playlist_document ->> 'defaultTransition',
        default_transition
      ),
      default_fit_mode = coalesce(
        playlist_document ->> 'defaultFitMode',
        default_fit_mode
      ),
      default_background_color = nullif(
        playlist_document ->> 'defaultBackgroundColor',
        ''
      ),
      default_video_muted = coalesce(
        (playlist_document ->> 'defaultVideoMuted')::boolean,
        default_video_muted
      ),
      loop_enabled = coalesce(
        (playlist_document ->> 'loopEnabled')::boolean,
        loop_enabled
      ),
      revision = revision + 1,
      updated_by = actor_id
  where id = playlist_record.id
  returning revision into actual_revision;

  outcome := jsonb_build_object(
    'outcome', 'restored',
    'playlistId', playlist_record.id,
    'sourceReleaseId', release_record.id,
    'actualRevision', actual_revision,
    'itemCount', restored_item_count
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.release.restore_to_draft',
    p_idempotency_key,
    request_json,
    'playlists',
    playlist_record.id,
    outcome,
    'publisher.playlist.release_restored_to_draft'
  );
end;
$$;

revoke all on function private.build_playlist_authoring_snapshot(uuid)
from public, anon, authenticated;
revoke all on function private.materialize_publisher_release_item()
from public, anon, authenticated;
revoke all on function private.begin_publisher_command(uuid, text, uuid, jsonb)
from public, anon, authenticated;
revoke all on function private.complete_publisher_command(
  uuid, text, uuid, jsonb, text, uuid, jsonb, text, text
) from public, anon, authenticated;
revoke all on function private.create_publisher_target_snapshot(
  uuid, uuid, uuid, text, uuid, uuid[], uuid
) from public, anon, authenticated;
revoke all on function private.content_schedule_is_due(
  public.content_schedules, timestamptz
) from public, anon, authenticated;
revoke all on function private.sync_screen_default_assignment()
from public, anon, authenticated;

revoke all on function public.create_tenant_playlist_template_v1(
  uuid, text, text, uuid
) from public, anon;
revoke all on function public.instantiate_tenant_playlist_template_v1(
  uuid, text, uuid
) from public, anon;
revoke all on function public.mutate_playlist_draft_v2(
  uuid, bigint, text, jsonb, uuid
) from public, anon;
revoke all on function public.mutate_media_organization_v1(
  uuid, text, jsonb, uuid
) from public, anon;
revoke all on function public.list_publisher_media_assets_v1(
  uuid, integer, integer, text, public.media_asset_kind,
  public.media_asset_status, uuid, boolean, uuid, boolean, text,
  timestamptz, timestamptz, text
) from public, anon;
revoke all on function public.mutate_screen_group_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) from public, anon;
revoke all on function public.check_content_schedule_conflicts_v1(
  uuid, text, uuid, timestamptz, timestamptz, uuid
) from public, anon;
revoke all on function public.mutate_content_schedule_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) from public, anon;
revoke all on function public.update_tenant_control_settings_v2(
  uuid, text, integer, text, boolean, text, integer, integer,
  text, text, text
) from public, anon;
revoke all on function public.publish_playlist_to_targets_v3(
  uuid, bigint, uuid[], text, uuid
) from public, anon;
revoke all on function public.restore_playlist_release_to_draft_v1(
  uuid, bigint, uuid
) from public, anon;
revoke all on function public.apply_due_content_schedules_v1(timestamptz)
from public, anon, authenticated;

grant execute on function public.create_tenant_playlist_template_v1(
  uuid, text, text, uuid
) to authenticated;
grant execute on function public.instantiate_tenant_playlist_template_v1(
  uuid, text, uuid
) to authenticated;
grant execute on function public.mutate_playlist_draft_v2(
  uuid, bigint, text, jsonb, uuid
) to authenticated;
grant execute on function public.mutate_media_organization_v1(
  uuid, text, jsonb, uuid
) to authenticated;
grant execute on function public.list_publisher_media_assets_v1(
  uuid, integer, integer, text, public.media_asset_kind,
  public.media_asset_status, uuid, boolean, uuid, boolean, text,
  timestamptz, timestamptz, text
) to authenticated;
grant execute on function public.mutate_screen_group_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) to authenticated;
grant execute on function public.check_content_schedule_conflicts_v1(
  uuid, text, uuid, timestamptz, timestamptz, uuid
) to authenticated;
grant execute on function public.mutate_content_schedule_v1(
  uuid, uuid, bigint, text, jsonb, uuid
) to authenticated;
grant execute on function public.update_tenant_control_settings_v2(
  uuid, text, integer, text, boolean, text, integer, integer,
  text, text, text
) to authenticated;
grant execute on function public.publish_playlist_to_targets_v3(
  uuid, bigint, uuid[], text, uuid
) to authenticated;
grant execute on function public.restore_playlist_release_to_draft_v1(
  uuid, bigint, uuid
) to authenticated;
grant execute on function public.apply_due_content_schedules_v1(timestamptz)
to service_role;
