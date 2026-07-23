-- S31-B: tenant-owned custom work roles with server-authoritative capabilities.
-- Tenant visibility remains shared; custom roles configure mutation, publication
-- and sensitive operational permissions. Ownership stays a protected built-in role.

create table public.tenant_custom_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 240),
  capabilities text[] not null default '{}'::text[]
    check (
      capabilities <@ array[
        'tenant.media.write',
        'tenant.playlist.write',
        'tenant.playlist.publish',
        'tenant.screen.manage',
        'tenant.settings.manage',
        'tenant.audit.read',
        'tenant.support.export'
      ]::text[]
      and (
        ('tenant.media.write' = any(capabilities))
        = ('tenant.playlist.write' = any(capabilities))
      )
    ),
  status text not null default 'active' check (status in ('active', 'archived')),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, id),
  check (
    (status = 'archived' and archived_at is not null)
    or (status = 'active' and archived_at is null)
  )
);

create unique index tenant_custom_roles_active_name_uq
  on public.tenant_custom_roles(tenant_id, lower(name))
  where status = 'active';
create index tenant_custom_roles_tenant_status_idx
  on public.tenant_custom_roles(tenant_id, status, name);

alter table public.tenant_memberships
  add column custom_role_id uuid,
  add constraint tenant_memberships_custom_role_fkey
    foreign key (tenant_id, custom_role_id)
    references public.tenant_custom_roles(tenant_id, id)
    on delete restrict,
  add constraint tenant_memberships_custom_role_baseline_check
    check (
      custom_role_id is null
      or role in ('tenant_viewer', 'tenant_editor')
    );

alter table public.tenant_invitations
  add column custom_role_id uuid,
  add constraint tenant_invitations_custom_role_fkey
    foreign key (tenant_id, custom_role_id)
    references public.tenant_custom_roles(tenant_id, id)
    on delete restrict,
  add constraint tenant_invitations_custom_role_baseline_check
    check (
      custom_role_id is null
      or role in ('tenant_viewer', 'tenant_editor')
    );

create index tenant_memberships_custom_role_idx
  on public.tenant_memberships(tenant_id, custom_role_id)
  where custom_role_id is not null;
create index tenant_invitations_custom_role_idx
  on public.tenant_invitations(tenant_id, custom_role_id)
  where custom_role_id is not null;

create trigger tenant_custom_roles_set_updated_at
before update on public.tenant_custom_roles
for each row execute function private.set_updated_at();

alter table public.tenant_custom_roles enable row level security;
alter table public.tenant_custom_roles force row level security;
revoke all on public.tenant_custom_roles from public, anon, authenticated;
grant select on public.tenant_custom_roles to authenticated;

create policy "tenant_custom_roles_select_by_scope"
on public.tenant_custom_roles for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function private.builtin_tenant_capabilities(
  p_role public.tenant_role
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'tenant_owner'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.playlist.archive',
      'tenant.playlist.publish', 'tenant.release.read', 'tenant.screen.read',
      'tenant.screen.manage', 'tenant.team.read', 'tenant.team.manage',
      'tenant.settings.read', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export'
    ]::text[]
    when 'tenant_admin'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.playlist.archive',
      'tenant.playlist.publish', 'tenant.release.read', 'tenant.screen.read',
      'tenant.screen.manage', 'tenant.team.read', 'tenant.team.manage',
      'tenant.settings.read', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export'
    ]::text[]
    when 'tenant_editor'::public.tenant_role then array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.media.write',
      'tenant.playlist.read', 'tenant.playlist.write', 'tenant.release.read',
      'tenant.screen.read', 'tenant.team.read', 'tenant.settings.read'
    ]::text[]
    else array[
      'tenant.overview.read', 'tenant.media.read', 'tenant.playlist.read',
      'tenant.release.read', 'tenant.screen.read', 'tenant.team.read',
      'tenant.settings.read'
    ]::text[]
  end;
$$;

create or replace function private.tenant_baseline_capabilities()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'tenant.overview.read', 'tenant.media.read', 'tenant.playlist.read',
    'tenant.release.read', 'tenant.screen.read', 'tenant.team.read',
    'tenant.settings.read'
  ]::text[];
$$;

create or replace function private.current_tenant_capabilities(p_tenant_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when membership.custom_role_id is null
      then private.builtin_tenant_capabilities(membership.role)
    when custom_role.status = 'active'
      then (
        select array_agg(distinct capability order by capability)
        from unnest(
          private.tenant_baseline_capabilities()
          || custom_role.capabilities
          || case
            when 'tenant.playlist.write' = any(custom_role.capabilities)
              then array['tenant.playlist.archive']::text[]
            else '{}'::text[]
          end
        ) capability
      )
    else '{}'::text[]
  end
  from public.tenant_memberships membership
  left join public.tenant_custom_roles custom_role
    on custom_role.tenant_id = membership.tenant_id
    and custom_role.id = membership.custom_role_id
  where membership.tenant_id = p_tenant_id
    and membership.user_id = private.current_user_id();
$$;

create or replace function private.has_tenant_capability(
  p_tenant_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_capability = any(private.current_tenant_capabilities(p_tenant_id)), false)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[]);
$$;

create or replace function public.get_my_tenant_capabilities_v1(p_tenant_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_tenant_capabilities(p_tenant_id), '{}'::text[]);
$$;

create or replace function private.can_write_playlist(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_capability(p_tenant_id, 'tenant.playlist.write');
$$;

create or replace function private.can_publish_playlist(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_capability(p_tenant_id, 'tenant.playlist.publish');
$$;

create or replace function private.can_manage_screens(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_capability(p_tenant_id, 'tenant.screen.manage');
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
  if actor_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.settings.manage')
  then
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

create or replace function private.normalize_custom_role_capabilities(
  p_capabilities text[]
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text[];
  allowed constant text[] := array[
    'tenant.media.write',
    'tenant.playlist.write',
    'tenant.playlist.publish',
    'tenant.screen.manage',
    'tenant.settings.manage',
    'tenant.audit.read',
    'tenant.support.export'
  ]::text[];
begin
  select coalesce(array_agg(distinct capability order by capability), '{}'::text[])
  into normalized
  from unnest(coalesce(p_capabilities, '{}'::text[])) capability;

  if not normalized <@ allowed then
    raise exception 'custom role contains unsupported capabilities' using errcode = '23514';
  end if;
  if (
    ('tenant.media.write' = any(normalized))
    <> ('tenant.playlist.write' = any(normalized))
  ) then
    raise exception 'content editing requires media and playlist write together'
      using errcode = '23514';
  end if;
  return normalized;
end;
$$;

create or replace function private.custom_role_baseline_role(
  p_capabilities text[]
)
returns public.tenant_role
language sql
immutable
set search_path = ''
as $$
  select case
    when 'tenant.media.write' = any(coalesce(p_capabilities, '{}'::text[]))
      then 'tenant_editor'::public.tenant_role
    else 'tenant_viewer'::public.tenant_role
  end;
$$;

create or replace function private.require_custom_role_manager(p_tenant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    private.has_tenant_role(
      p_tenant_id,
      array['tenant_owner']::public.tenant_role[]
    )
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'tenant owner capability required' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
end;
$$;

create or replace function public.create_tenant_custom_role_v1(
  p_tenant_id uuid,
  p_name text,
  p_description text,
  p_capabilities text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := nullif(btrim(p_name), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  normalized_capabilities text[];
  role_id uuid;
begin
  perform private.require_custom_role_manager(p_tenant_id);
  if normalized_name is null or length(normalized_name) not between 2 and 60
    or (normalized_description is not null and length(normalized_description) > 240)
  then
    raise exception 'custom role details are invalid' using errcode = '23514';
  end if;
  normalized_capabilities := private.normalize_custom_role_capabilities(p_capabilities);

  insert into public.tenant_custom_roles (
    tenant_id, name, description, capabilities, created_by, updated_by
  )
  values (
    p_tenant_id, normalized_name, normalized_description,
    normalized_capabilities, actor_id, actor_id
  )
  returning id into role_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.custom_role.created',
    'tenant_custom_roles',
    role_id,
    'success',
    jsonb_build_object('capabilities', to_jsonb(normalized_capabilities))
  );
  return role_id;
exception
  when unique_violation then
    raise exception 'an active custom role with this name already exists' using errcode = '23505';
end;
$$;

create or replace function public.update_tenant_custom_role_v1(
  p_tenant_id uuid,
  p_role_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_description text,
  p_capabilities text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  role_record public.tenant_custom_roles%rowtype;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  normalized_capabilities text[];
begin
  perform private.require_custom_role_manager(p_tenant_id);
  select role.* into role_record
  from public.tenant_custom_roles role
  where role.tenant_id = p_tenant_id and role.id = p_role_id
  for update;
  if not found then
    raise exception 'custom role not found' using errcode = 'P0002';
  end if;
  if role_record.status <> 'active' then
    raise exception 'archived custom roles cannot be changed' using errcode = '23514';
  end if;
  if role_record.revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'revision', role_record.revision);
  end if;
  if normalized_name is null or length(normalized_name) not between 2 and 60
    or (normalized_description is not null and length(normalized_description) > 240)
  then
    raise exception 'custom role details are invalid' using errcode = '23514';
  end if;
  normalized_capabilities := private.normalize_custom_role_capabilities(p_capabilities);

  update public.tenant_custom_roles
  set
    name = normalized_name,
    description = normalized_description,
    capabilities = normalized_capabilities,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = p_tenant_id and id = p_role_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.custom_role.updated',
    'tenant_custom_roles',
    p_role_id,
    'success',
    jsonb_build_object(
      'fromCapabilities', to_jsonb(role_record.capabilities),
      'toCapabilities', to_jsonb(normalized_capabilities)
    )
  );
  return jsonb_build_object(
    'outcome', 'updated',
    'roleId', p_role_id,
    'revision', role_record.revision + 1
  );
exception
  when unique_violation then
    raise exception 'an active custom role with this name already exists' using errcode = '23505';
end;
$$;

create or replace function public.archive_tenant_custom_role_v1(
  p_tenant_id uuid,
  p_role_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_record public.tenant_custom_roles%rowtype;
begin
  perform private.require_custom_role_manager(p_tenant_id);
  select role.* into role_record
  from public.tenant_custom_roles role
  where role.tenant_id = p_tenant_id and role.id = p_role_id
  for update;
  if not found then
    raise exception 'custom role not found' using errcode = 'P0002';
  end if;
  if role_record.revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'revision', role_record.revision);
  end if;
  if exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.custom_role_id = p_role_id
  ) or exists (
    select 1 from public.tenant_invitations invitation
    where invitation.tenant_id = p_tenant_id
      and invitation.custom_role_id = p_role_id
      and invitation.status = 'pending'
  ) then
    raise exception 'custom role is still assigned' using errcode = '23514';
  end if;

  update public.tenant_custom_roles
  set
    status = 'archived',
    archived_at = now(),
    revision = revision + 1,
    updated_by = private.current_user_id()
  where tenant_id = p_tenant_id and id = p_role_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.custom_role.archived',
    'tenant_custom_roles',
    p_role_id,
    'success',
    '{}'::jsonb
  );
  return jsonb_build_object(
    'outcome', 'archived',
    'roleId', p_role_id,
    'revision', role_record.revision + 1
  );
end;
$$;

create or replace function public.create_tenant_custom_role_invitation_v1(
  p_tenant_id uuid,
  p_email text,
  p_custom_role_id uuid,
  p_invitation_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  role_capabilities text[];
begin
  select role.capabilities into role_capabilities
  from public.tenant_custom_roles role
    where role.tenant_id = p_tenant_id
      and role.id = p_custom_role_id
      and role.status = 'active';
  if not found then
    raise exception 'active custom role not found' using errcode = 'P0002';
  end if;

  invitation_id := public.create_tenant_invitation(
    p_tenant_id,
    p_email,
    private.custom_role_baseline_role(role_capabilities),
    p_invitation_token
  );
  update public.tenant_invitations
  set custom_role_id = p_custom_role_id
  where id = invitation_id and tenant_id = p_tenant_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.invitation.custom_role_assigned',
    'tenant_invitations',
    invitation_id,
    'success',
    jsonb_build_object('customRoleId', p_custom_role_id)
  );
  return invitation_id;
end;
$$;

create or replace function private.inherit_invitation_custom_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.custom_role_id is null and new.supersedes_invitation_id is not null then
    select invitation.custom_role_id into new.custom_role_id
    from public.tenant_invitations invitation
    where invitation.id = new.supersedes_invitation_id
      and invitation.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger tenant_invitations_inherit_custom_role
before insert on public.tenant_invitations
for each row execute function private.inherit_invitation_custom_role();

create or replace function private.apply_accepted_invitation_custom_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_user_id uuid;
begin
  if old.status = 'pending'
    and new.status = 'accepted'
    and new.custom_role_id is not null
  then
    select auth_user.id into accepted_user_id
    from auth.users auth_user
    where lower(auth_user.email) = new.email;

    update public.tenant_memberships
    set custom_role_id = new.custom_role_id
    where tenant_id = new.tenant_id
      and user_id = accepted_user_id
      and role in ('tenant_viewer', 'tenant_editor');
  end if;
  return new;
end;
$$;

create trigger tenant_invitations_apply_accepted_custom_role
after update of status on public.tenant_invitations
for each row execute function private.apply_accepted_invitation_custom_role();

create or replace function public.set_tenant_member_custom_role_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_custom_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text;
  role_capabilities text[];
begin
  select role.name, role.capabilities into role_name, role_capabilities
  from public.tenant_custom_roles role
  where role.tenant_id = p_tenant_id
    and role.id = p_custom_role_id
    and role.status = 'active';
  if not found then
    raise exception 'active custom role not found' using errcode = 'P0002';
  end if;

  perform public.set_tenant_member_role(
    p_tenant_id,
    p_user_id,
    private.custom_role_baseline_role(role_capabilities)
  );
  update public.tenant_memberships
  set custom_role_id = p_custom_role_id
  where tenant_id = p_tenant_id and user_id = p_user_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.member.custom_role_assigned',
    'tenant_memberships',
    p_user_id,
    'success',
    jsonb_build_object('customRoleId', p_custom_role_id, 'customRoleName', role_name)
  );
end;
$$;

-- Built-in role changes always clear a previous custom assignment.
create or replace function public.clear_tenant_member_custom_role_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role public.tenant_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_tenant_member_role(p_tenant_id, p_user_id, p_role);
  update public.tenant_memberships
  set custom_role_id = null
  where tenant_id = p_tenant_id and user_id = p_user_id;
end;
$$;

drop policy if exists "audit_events_select_by_scope" on public.audit_events;
create policy "audit_events_select_by_scope"
on public.audit_events for select to authenticated
using (
  actor_user_id = private.current_user_id()
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
  or (
    tenant_id is not null
    and private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);

revoke all on function private.builtin_tenant_capabilities(public.tenant_role)
from public, anon, authenticated;
revoke all on function private.tenant_baseline_capabilities()
from public, anon, authenticated;
revoke all on function private.current_tenant_capabilities(uuid)
from public, anon, authenticated;
revoke all on function private.has_tenant_capability(uuid, text)
from public, anon, authenticated;
revoke all on function private.normalize_custom_role_capabilities(text[])
from public, anon, authenticated;
revoke all on function private.custom_role_baseline_role(text[])
from public, anon, authenticated;
revoke all on function private.require_custom_role_manager(uuid)
from public, anon, authenticated;
revoke all on function private.inherit_invitation_custom_role()
from public, anon, authenticated;
revoke all on function private.apply_accepted_invitation_custom_role()
from public, anon, authenticated;

revoke all on function public.get_my_tenant_capabilities_v1(uuid)
from public, anon;
revoke all on function public.create_tenant_custom_role_v1(uuid, text, text, text[])
from public, anon;
revoke all on function public.update_tenant_custom_role_v1(
  uuid, uuid, bigint, text, text, text[]
) from public, anon;
revoke all on function public.archive_tenant_custom_role_v1(uuid, uuid, bigint)
from public, anon;
revoke all on function public.create_tenant_custom_role_invitation_v1(
  uuid, text, uuid, text
) from public, anon;
revoke all on function public.set_tenant_member_custom_role_v1(uuid, uuid, uuid)
from public, anon;
revoke all on function public.clear_tenant_member_custom_role_v1(
  uuid, uuid, public.tenant_role
) from public, anon;

grant execute on function public.get_my_tenant_capabilities_v1(uuid)
to authenticated;
grant execute on function private.has_tenant_capability(uuid, text)
to authenticated;
grant execute on function public.create_tenant_custom_role_v1(uuid, text, text, text[])
to authenticated;
grant execute on function public.update_tenant_custom_role_v1(
  uuid, uuid, bigint, text, text, text[]
) to authenticated;
grant execute on function public.archive_tenant_custom_role_v1(uuid, uuid, bigint)
to authenticated;
grant execute on function public.create_tenant_custom_role_invitation_v1(
  uuid, text, uuid, text
) to authenticated;
grant execute on function public.set_tenant_member_custom_role_v1(uuid, uuid, uuid)
to authenticated;
grant execute on function public.clear_tenant_member_custom_role_v1(
  uuid, uuid, public.tenant_role
) to authenticated;
