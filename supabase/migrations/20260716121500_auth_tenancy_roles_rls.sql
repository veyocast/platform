create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

do $$
begin
  create type public.platform_role as enum (
    'platform_owner',
    'platform_admin',
    'platform_support',
    'platform_viewer'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tenant_role as enum (
    'tenant_owner',
    'tenant_admin',
    'tenant_editor',
    'tenant_viewer'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tenant_status as enum (
    'active',
    'paused',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.invitation_status as enum (
    'pending',
    'accepted',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) >= 2),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  status public.tenant_status not null default 'active',
  screen_limit integer not null default 1 check (screen_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, role)
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (tenant_id, user_id)
);

create index tenant_memberships_tenant_id_idx on public.tenant_memberships(tenant_id);
create index tenant_memberships_user_id_idx on public.tenant_memberships(user_id);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role public.tenant_role not null,
  status public.invitation_status not null default 'pending',
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_invitations_pending_token_hash_uq unique (token_hash),
  constraint tenant_invitations_pending_unique_email_role_uq unique (tenant_id, email, role, status)
);

create index tenant_invitations_tenant_id_idx on public.tenant_invitations(tenant_id);
create index tenant_invitations_email_idx on public.tenant_invitations(email);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_device_id uuid,
  action text not null check (length(btrim(action)) > 0),
  target_type text not null check (length(btrim(target_type)) > 0),
  target_id uuid,
  result text not null default 'success' check (result in ('success', 'denied', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_tenant_id_created_at_idx on public.audit_events(tenant_id, created_at desc);
create index audit_events_actor_user_id_created_at_idx on public.audit_events(actor_user_id, created_at desc);

create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function private.is_platform_member(required_roles public.platform_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_memberships membership
    where membership.user_id = private.current_user_id()
      and (
        required_roles is null
        or membership.role = any(required_roles)
      )
  );
$$;

create or replace function private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = private.current_user_id()
  );
$$;

create or replace function private.has_tenant_role(
  target_tenant_id uuid,
  required_roles public.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = private.current_user_id()
      and membership.role = any(required_roles)
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function private.set_updated_at();

create or replace function private.audit_event(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_result text default 'success',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  event_id uuid;
begin
  if actor_id is null then
    raise exception 'audit_event requires an authenticated user' using errcode = '42501';
  end if;

  if p_tenant_id is not null
    and not (
      private.is_tenant_member(p_tenant_id)
      or private.is_platform_member(array[
        'platform_owner',
        'platform_admin',
        'platform_support'
      ]::public.platform_role[])
    )
  then
    raise exception 'actor cannot audit this tenant' using errcode = '42501';
  end if;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  values (
    p_tenant_id,
    actor_id,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_result, 'success'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.platform_memberships enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.audit_events enable row level security;

grant usage on schema public to anon, authenticated;

grant select on
  public.profiles,
  public.tenants,
  public.platform_memberships,
  public.tenant_memberships,
  public.tenant_invitations,
  public.audit_events
to anon, authenticated;

grant insert, update, delete on
  public.profiles,
  public.tenants,
  public.platform_memberships,
  public.tenant_memberships,
  public.tenant_invitations,
  public.audit_events
to authenticated;

grant execute on function private.current_user_id() to anon, authenticated, service_role;
grant execute on function private.is_platform_member(public.platform_role[]) to authenticated, service_role;
grant execute on function private.is_tenant_member(uuid) to authenticated, service_role;
grant execute on function private.has_tenant_role(uuid, public.tenant_role[]) to authenticated, service_role;
grant execute on function private.audit_event(uuid, text, text, uuid, text, jsonb) to authenticated, service_role;

create policy "profiles_select_self_or_platform"
on public.profiles
for select
to authenticated
using (
  id = private.current_user_id()
  or private.is_platform_member(null)
);

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = private.current_user_id());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = private.current_user_id())
with check (id = private.current_user_id());

create policy "tenants_select_by_membership"
on public.tenants
for select
to authenticated
using (
  private.is_tenant_member(id)
  or private.is_platform_member(null)
);

create policy "tenants_insert_by_platform_admin"
on public.tenants
for insert
to authenticated
with check (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "tenants_update_by_platform_admin"
on public.tenants
for update
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
)
with check (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create policy "tenants_delete_by_platform_owner"
on public.tenants
for delete
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner'
  ]::public.platform_role[])
);

create policy "platform_memberships_select_self_or_platform"
on public.platform_memberships
for select
to authenticated
using (
  user_id = private.current_user_id()
  or private.is_platform_member(null)
);

create policy "platform_memberships_insert_by_platform_owner"
on public.platform_memberships
for insert
to authenticated
with check (
  private.is_platform_member(array[
    'platform_owner'
  ]::public.platform_role[])
);

create policy "platform_memberships_update_by_platform_owner"
on public.platform_memberships
for update
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner'
  ]::public.platform_role[])
)
with check (
  private.is_platform_member(array[
    'platform_owner'
  ]::public.platform_role[])
);

create policy "platform_memberships_delete_by_platform_owner"
on public.platform_memberships
for delete
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner'
  ]::public.platform_role[])
);

create policy "tenant_memberships_select_by_tenant"
on public.tenant_memberships
for select
to authenticated
using (
  user_id = private.current_user_id()
  or private.is_tenant_member(tenant_id)
  or private.is_platform_member(null)
);

create policy "tenant_memberships_insert_by_tenant_admin"
on public.tenant_memberships
for insert
to authenticated
with check (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
);

create policy "tenant_memberships_update_by_tenant_admin"
on public.tenant_memberships
for update
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
)
with check (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
);

create policy "tenant_memberships_delete_by_tenant_owner"
on public.tenant_memberships
for delete
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner'
  ]::public.tenant_role[])
);

create policy "tenant_invitations_select_by_tenant_admin"
on public.tenant_invitations
for select
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
);

create policy "tenant_invitations_insert_by_tenant_admin"
on public.tenant_invitations
for insert
to authenticated
with check (
  (
    private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
    or private.has_tenant_role(tenant_id, array[
      'tenant_owner',
      'tenant_admin'
    ]::public.tenant_role[])
  )
  and (
    role <> 'tenant_owner'::public.tenant_role
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
    or private.has_tenant_role(tenant_id, array[
      'tenant_owner'
    ]::public.tenant_role[])
  )
);

create policy "tenant_invitations_update_by_tenant_admin"
on public.tenant_invitations
for update
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
)
with check (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner',
    'tenant_admin'
  ]::public.tenant_role[])
);

create policy "tenant_invitations_delete_by_tenant_owner"
on public.tenant_invitations
for delete
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
  or private.has_tenant_role(tenant_id, array[
    'tenant_owner'
  ]::public.tenant_role[])
);

create policy "audit_events_select_by_scope"
on public.audit_events
for select
to authenticated
using (
  actor_user_id = private.current_user_id()
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support'
  ]::public.platform_role[])
  or (
    tenant_id is not null
    and private.is_tenant_member(tenant_id)
  )
);

create policy "audit_events_insert_by_actor"
on public.audit_events
for insert
to authenticated
with check (
  actor_user_id = private.current_user_id()
  and (
    tenant_id is null
    or private.is_tenant_member(tenant_id)
    or private.is_platform_member(array[
      'platform_owner',
      'platform_admin',
      'platform_support'
    ]::public.platform_role[])
  )
);
