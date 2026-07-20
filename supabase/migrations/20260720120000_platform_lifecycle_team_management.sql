alter table public.tenants
  add column locale text not null default 'nl-NL'
    check (locale in ('nl-NL', 'en-GB')),
  add column timezone text not null default 'Europe/Amsterdam'
    check (length(timezone) between 3 and 64),
  add column provisioning_status text not null default 'ready'
    check (provisioning_status in ('mail_pending', 'mail_failed', 'ready'));

alter table public.tenant_invitations
  drop constraint if exists tenant_invitations_pending_unique_email_role_uq,
  add column delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  add column send_attempt_count integer not null default 0
    check (send_attempt_count >= 0),
  add column last_sent_at timestamptz,
  add column last_delivery_error_code text
    check (last_delivery_error_code is null or last_delivery_error_code ~ '^[a-z0-9_]{2,64}$'),
  add column supersedes_invitation_id uuid references public.tenant_invitations(id) on delete set null;

create unique index tenant_invitations_one_pending_email_uq
  on public.tenant_invitations(tenant_id, email)
  where status = 'pending'::public.invitation_status;

create table public.platform_tenant_provisioning_commands (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null check (
    length(idempotency_key) between 16 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  request_id text not null check (length(request_id) between 8 and 128),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  tenant_id uuid references public.tenants(id) on delete restrict,
  owner_invitation_id uuid references public.tenant_invitations(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_user_id, idempotency_key)
);

alter table public.platform_tenant_provisioning_commands enable row level security;

grant select on public.platform_tenant_provisioning_commands to authenticated;

create policy "platform_provisioning_commands_select_by_platform_admin"
on public.platform_tenant_provisioning_commands
for select
to authenticated
using (
  actor_user_id = private.current_user_id()
  or private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[])
);

create or replace function private.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(auth_user.email)
  from auth.users auth_user
  where auth_user.id = private.current_user_id();
$$;

create or replace function private.require_platform_owner_aal2()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null
    or not private.is_platform_member(array['platform_owner']::public.platform_role[])
  then
    raise exception 'platform owner capability required' using errcode = '42501';
  end if;

  if private.current_aal() <> 'aal2' then
    raise exception 'sensitive platform mutations require aal2' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_platform_lifecycle_aal2()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null
    or not private.is_platform_member(array[
      'platform_owner',
      'platform_admin'
    ]::public.platform_role[])
  then
    raise exception 'platform lifecycle capability required' using errcode = '42501';
  end if;

  if private.current_aal() <> 'aal2' then
    raise exception 'sensitive platform mutations require aal2' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.tenant_team_actor_role(p_tenant_id uuid)
returns public.tenant_role
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id
    and membership.user_id = private.current_user_id();
$$;

create or replace function private.enforce_tenant_screen_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_may_create boolean;
  allowed_screens integer;
  current_screens integer;
begin
  -- Laat RLS eerst de generieke autorisatiefout geven aan onbevoegde actors.
  -- De SECURITY DEFINER-trigger mag geen tenantbestaan of limiet lekken.
  if actor_id is not null then
    select
      exists (
        select 1
        from public.tenant_memberships membership
        where membership.tenant_id = new.tenant_id
          and membership.user_id = actor_id
          and membership.role in ('tenant_owner', 'tenant_admin')
      )
      or exists (
        select 1
        from public.platform_memberships membership
        where membership.user_id = actor_id
          and membership.role in ('platform_owner', 'platform_admin')
      )
    into actor_may_create;

    if not coalesce(actor_may_create, false) then
      return new;
    end if;
  end if;

  select tenant.screen_limit into allowed_screens
  from public.tenants tenant
  where tenant.id = new.tenant_id
  for update;

  if allowed_screens is null then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select count(*) into current_screens
  from public.screens screen
  where screen.tenant_id = new.tenant_id;

  if current_screens >= allowed_screens then
    raise exception 'tenant screen limit reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists screens_enforce_tenant_limit on public.screens;
create trigger screens_enforce_tenant_limit
before insert on public.screens
for each row execute function private.enforce_tenant_screen_limit();

create or replace function public.provision_platform_tenant(
  p_name text,
  p_slug text,
  p_screen_limit integer,
  p_owner_email text,
  p_locale text,
  p_timezone text,
  p_actor_becomes_owner boolean,
  p_invitation_token text,
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
  normalized_email text := lower(btrim(p_owner_email));
  command_hash text;
  command_record public.platform_tenant_provisioning_commands%rowtype;
  new_tenant_id uuid;
  new_invitation_id uuid;
begin
  perform private.require_platform_lifecycle_aal2();

  if normalized_name is null or length(normalized_name) not between 2 and 120 then
    raise exception 'tenant name must contain 2 to 120 characters' using errcode = '23514';
  end if;
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'tenant slug must contain 3 to 64 lowercase characters' using errcode = '23514';
  end if;
  if p_screen_limit is null or p_screen_limit not between 1 and 10000 then
    raise exception 'tenant screen limit must be between 1 and 10000' using errcode = '23514';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'owner email is invalid' using errcode = '23514';
  end if;
  if p_locale not in ('nl-NL', 'en-GB') then
    raise exception 'tenant locale is unsupported' using errcode = '23514';
  end if;
  if p_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
  then
    raise exception 'tenant timezone is unsupported' using errcode = '23514';
  end if;
  if p_invitation_token is null or p_invitation_token !~ '^[a-f0-9]{64}$' then
    raise exception 'invitation token is invalid' using errcode = '23514';
  end if;
  if p_idempotency_key is null
    or length(p_idempotency_key) not between 16 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'idempotency key is invalid' using errcode = '23514';
  end if;
  if p_request_id is null or length(p_request_id) not between 8 and 128 then
    raise exception 'request id is invalid' using errcode = '23514';
  end if;

  command_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'actorBecomesOwner', coalesce(p_actor_becomes_owner, false),
          'locale', p_locale,
          'name', normalized_name,
          'ownerEmail', normalized_email,
          'screenLimit', p_screen_limit,
          'slug', normalized_slug,
          'timezone', p_timezone
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.platform_tenant_provisioning_commands (
    actor_user_id,
    idempotency_key,
    request_id,
    payload_hash
  ) values (
    actor_id,
    p_idempotency_key,
    p_request_id,
    command_hash
  )
  on conflict (actor_user_id, idempotency_key) do nothing;

  select command.*
  into command_record
  from public.platform_tenant_provisioning_commands command
  where command.actor_user_id = actor_id
    and command.idempotency_key = p_idempotency_key
  for update;

  if command_record.payload_hash <> command_hash then
    raise exception 'idempotency key was reused with a different payload' using errcode = '22023';
  end if;

  if command_record.tenant_id is not null then
    return jsonb_build_object(
      'created', false,
      'invitationId', command_record.owner_invitation_id,
      'tenantId', command_record.tenant_id
    );
  end if;

  insert into public.tenants (
    name,
    slug,
    status,
    screen_limit,
    locale,
    timezone,
    provisioning_status
  ) values (
    normalized_name,
    normalized_slug,
    'active'::public.tenant_status,
    p_screen_limit,
    p_locale,
    p_timezone,
    'mail_pending'
  )
  returning id into new_tenant_id;

  insert into public.tenant_settings (tenant_id, updated_by)
  values (new_tenant_id, actor_id);

  insert into public.tenant_invitations (
    tenant_id,
    email,
    role,
    token_hash,
    expires_at,
    created_by
  ) values (
    new_tenant_id,
    normalized_email,
    'tenant_owner'::public.tenant_role,
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_invitation_token, 'UTF8'), 'sha256'),
      'hex'
    ),
    now() + interval '7 days',
    actor_id
  )
  returning id into new_invitation_id;

  if coalesce(p_actor_becomes_owner, false) then
    insert into public.tenant_memberships (tenant_id, user_id, role, created_by)
    values (new_tenant_id, actor_id, 'tenant_owner', actor_id);
  end if;

  perform private.audit_event(
    new_tenant_id,
    'tenant.provisioned',
    'tenants',
    new_tenant_id,
    'success',
    jsonb_build_object(
      'actorBecameOwner', coalesce(p_actor_becomes_owner, false),
      'locale', p_locale,
      'ownerInvitationId', new_invitation_id,
      'requestId', p_request_id,
      'screenLimit', p_screen_limit,
      'timezone', p_timezone
    )
  );

  update public.platform_tenant_provisioning_commands
  set
    tenant_id = new_tenant_id,
    owner_invitation_id = new_invitation_id,
    completed_at = now()
  where id = command_record.id;

  return jsonb_build_object(
    'created', true,
    'invitationId', new_invitation_id,
    'tenantId', new_tenant_id
  );
exception
  when unique_violation then
    raise exception 'tenant slug or pending owner invitation already exists' using errcode = '23505';
end;
$$;

create or replace function public.create_tenant_invitation(
  p_tenant_id uuid,
  p_email text,
  p_role public.tenant_role,
  p_invitation_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_role public.tenant_role := private.tenant_team_actor_role(p_tenant_id);
  normalized_email text := lower(btrim(p_email));
  existing_user_id uuid;
  invitation_id uuid;
begin
  if actor_id is null or not coalesce((
    actor_role in ('tenant_owner', 'tenant_admin')
    or private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[])
  ), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;

  if p_role = 'tenant_owner' and actor_role <> 'tenant_owner'
    and not private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[])
  then
    raise exception 'only tenant owners can invite another owner' using errcode = '42501';
  end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invitation email is invalid' using errcode = '23514';
  end if;
  if p_invitation_token is null or p_invitation_token !~ '^[a-f0-9]{64}$' then
    raise exception 'invitation token is invalid' using errcode = '23514';
  end if;

  select auth_user.id into existing_user_id
  from auth.users auth_user
  where lower(auth_user.email) = normalized_email;

  if existing_user_id is not null and exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.user_id = existing_user_id
  ) then
    raise exception 'user is already a tenant member' using errcode = '23505';
  end if;

  insert into public.tenant_invitations (
    tenant_id, email, role, token_hash, expires_at, created_by
  ) values (
    p_tenant_id,
    normalized_email,
    p_role,
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_invitation_token, 'UTF8'), 'sha256'),
      'hex'
    ),
    now() + interval '7 days',
    actor_id
  ) returning id into invitation_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.invitation.created',
    'tenant_invitations',
    invitation_id,
    'success',
    jsonb_build_object('role', p_role)
  );

  return invitation_id;
exception
  when unique_violation then
    raise exception 'a pending invitation already exists for this email' using errcode = '23505';
end;
$$;

create or replace function public.rotate_tenant_invitation(
  p_invitation_id uuid,
  p_invitation_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_role public.tenant_role;
  previous_invitation public.tenant_invitations%rowtype;
  invitation_id uuid;
begin
  select invitation.* into previous_invitation
  from public.tenant_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  actor_role := private.tenant_team_actor_role(previous_invitation.tenant_id);
  if actor_id is null or not coalesce((
    actor_role in ('tenant_owner', 'tenant_admin')
    or private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[])
  ), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;
  if previous_invitation.status <> 'pending' then
    raise exception 'only pending invitations can be resent' using errcode = '23514';
  end if;
  if p_invitation_token is null or p_invitation_token !~ '^[a-f0-9]{64}$' then
    raise exception 'invitation token is invalid' using errcode = '23514';
  end if;

  update public.tenant_invitations
  set status = 'revoked', revoked_at = now()
  where id = previous_invitation.id;

  insert into public.tenant_invitations (
    tenant_id, email, role, token_hash, expires_at, created_by,
    supersedes_invitation_id
  ) values (
    previous_invitation.tenant_id,
    previous_invitation.email,
    previous_invitation.role,
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_invitation_token, 'UTF8'), 'sha256'),
      'hex'
    ),
    now() + interval '7 days',
    actor_id,
    previous_invitation.id
  ) returning id into invitation_id;

  perform private.audit_event(
    previous_invitation.tenant_id,
    'tenant.invitation.resent',
    'tenant_invitations',
    invitation_id,
    'success',
    jsonb_build_object('previousInvitationId', previous_invitation.id, 'role', previous_invitation.role)
  );

  return invitation_id;
end;
$$;

create or replace function public.mark_tenant_invitation_delivery(
  p_invitation_id uuid,
  p_delivered boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record public.tenant_invitations%rowtype;
  actor_role public.tenant_role;
begin
  select invitation.* into invitation_record
  from public.tenant_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  actor_role := private.tenant_team_actor_role(invitation_record.tenant_id);
  if private.current_user_id() is null or not coalesce((
    actor_role in ('tenant_owner', 'tenant_admin')
    or private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[])
  ), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;
  if not p_delivered and (p_error_code is null or p_error_code !~ '^[a-z0-9_]{2,64}$') then
    raise exception 'safe delivery error code required' using errcode = '23514';
  end if;

  update public.tenant_invitations
  set
    delivery_status = case when p_delivered then 'sent' else 'failed' end,
    last_delivery_error_code = case when p_delivered then null else p_error_code end,
    last_sent_at = case when p_delivered then now() else last_sent_at end,
    send_attempt_count = send_attempt_count + 1
  where id = p_invitation_id;

  update public.tenants tenant
  set provisioning_status = case when p_delivered then 'ready' else 'mail_failed' end
  where tenant.id = invitation_record.tenant_id
    and exists (
      select 1
      from public.platform_tenant_provisioning_commands command
      where command.owner_invitation_id = p_invitation_id
    );

  perform private.audit_event(
    invitation_record.tenant_id,
    case when p_delivered then 'tenant.invitation.delivered' else 'tenant.invitation.delivery_failed' end,
    'tenant_invitations',
    p_invitation_id,
    case when p_delivered then 'success' else 'failed' end,
    jsonb_build_object('errorCode', case when p_delivered then null else p_error_code end)
  );
end;
$$;

create or replace function public.revoke_tenant_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record public.tenant_invitations%rowtype;
  actor_role public.tenant_role;
begin
  select invitation.* into invitation_record
  from public.tenant_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  actor_role := private.tenant_team_actor_role(invitation_record.tenant_id);
  if private.current_user_id() is null or not coalesce((
    actor_role in ('tenant_owner', 'tenant_admin')
    or private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[])
  ), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;
  if invitation_record.status <> 'pending' then
    raise exception 'only pending invitations can be revoked' using errcode = '23514';
  end if;

  update public.tenant_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id;

  perform private.audit_event(
    invitation_record.tenant_id,
    'tenant.invitation.revoked',
    'tenant_invitations',
    p_invitation_id,
    'success',
    jsonb_build_object('role', invitation_record.role)
  );
end;
$$;

create or replace function public.accept_tenant_invitation(
  p_invitation_id uuid,
  p_tenant_id uuid,
  p_invitation_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_email text := private.current_user_email();
  invitation_record public.tenant_invitations%rowtype;
begin
  if actor_id is null or actor_email is null then
    raise exception 'invitation acceptance requires an authenticated email' using errcode = '42501';
  end if;

  select invitation.* into invitation_record
  from public.tenant_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found or invitation_record.tenant_id <> p_tenant_id then
    raise exception 'invitation does not match tenant' using errcode = '42501';
  end if;
  if invitation_record.status <> 'pending' then
    raise exception 'invitation is no longer pending' using errcode = '23514';
  end if;
  if invitation_record.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = '22023';
  end if;
  if invitation_record.email <> actor_email then
    raise exception 'invitation email does not match authenticated user' using errcode = '42501';
  end if;
  if invitation_record.token_hash <> pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_invitation_token, 'UTF8'), 'sha256'),
    'hex'
  ) then
    raise exception 'invitation token is invalid' using errcode = '42501';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, created_by)
  values (p_tenant_id, actor_id, invitation_record.role, invitation_record.created_by);

  update public.tenant_invitations
  set status = 'accepted', accepted_at = now()
  where id = p_invitation_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.invitation.accepted',
    'tenant_memberships',
    actor_id,
    'success',
    jsonb_build_object('invitationId', p_invitation_id, 'role', invitation_record.role)
  );

  return p_tenant_id;
exception
  when unique_violation then
    raise exception 'user already has tenant access' using errcode = '23505';
end;
$$;

create or replace function public.get_tenant_invitation_preview(
  p_invitation_id uuid,
  p_tenant_id uuid,
  p_invitation_token text
)
returns table (
  tenant_name text,
  invitation_role public.tenant_role,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_email text := private.current_user_email();
begin
  if private.current_user_id() is null or actor_email is null then
    raise exception 'invitation preview requires an authenticated email' using errcode = '42501';
  end if;

  return query
  select tenant.name, invitation.role, invitation.expires_at
  from public.tenant_invitations invitation
  join public.tenants tenant on tenant.id = invitation.tenant_id
  where invitation.id = p_invitation_id
    and invitation.tenant_id = p_tenant_id
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and invitation.email = actor_email
    and invitation.token_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_invitation_token, 'UTF8'), 'sha256'),
      'hex'
    );
end;
$$;

create or replace function public.set_tenant_member_role(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role public.tenant_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_role public.tenant_role := private.tenant_team_actor_role(p_tenant_id);
  target_role public.tenant_role;
  owner_count integer;
  actor_is_platform boolean := private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[]);
begin
  if actor_id is null or not coalesce((actor_role in ('tenant_owner', 'tenant_admin') or actor_is_platform), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;
  if actor_id = p_user_id then
    raise exception 'self lockout is not allowed' using errcode = '42501';
  end if;

  perform 1 from public.tenants tenant
  where tenant.id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select membership.role into target_role
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id and membership.user_id = p_user_id
  for update;
  if not found then
    raise exception 'tenant member not found' using errcode = 'P0002';
  end if;
  if target_role = p_role then return; end if;
  if not actor_is_platform and actor_role = 'tenant_admin'
    and (target_role = 'tenant_owner' or p_role = 'tenant_owner')
  then
    raise exception 'tenant admins cannot manage owners' using errcode = '42501';
  end if;

  select count(*) into owner_count
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id and membership.role = 'tenant_owner';
  if target_role = 'tenant_owner' and p_role <> 'tenant_owner' and owner_count <= 1 then
    raise exception 'last tenant owner cannot be changed' using errcode = '23514';
  end if;

  update public.tenant_memberships set role = p_role
  where tenant_id = p_tenant_id and user_id = p_user_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.member.role_changed',
    'tenant_memberships',
    p_user_id,
    'success',
    jsonb_build_object('fromRole', target_role, 'toRole', p_role)
  );
end;
$$;

create or replace function public.remove_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_role public.tenant_role := private.tenant_team_actor_role(p_tenant_id);
  target_role public.tenant_role;
  owner_count integer;
  actor_is_platform boolean := private.is_platform_member(array['platform_owner', 'platform_admin']::public.platform_role[]);
begin
  if actor_id is null or not coalesce((actor_role in ('tenant_owner', 'tenant_admin') or actor_is_platform), false) then
    raise exception 'tenant team capability required' using errcode = '42501';
  end if;
  if actor_id = p_user_id then
    raise exception 'self lockout is not allowed' using errcode = '42501';
  end if;

  perform 1 from public.tenants tenant
  where tenant.id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select membership.role into target_role
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id and membership.user_id = p_user_id
  for update;
  if not found then
    raise exception 'tenant member not found' using errcode = 'P0002';
  end if;
  if not actor_is_platform and actor_role = 'tenant_admin' and target_role = 'tenant_owner' then
    raise exception 'tenant admins cannot manage owners' using errcode = '42501';
  end if;

  select count(*) into owner_count
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id and membership.role = 'tenant_owner';
  if target_role = 'tenant_owner' and owner_count <= 1 then
    raise exception 'last tenant owner cannot be removed' using errcode = '23514';
  end if;

  delete from public.tenant_memberships
  where tenant_id = p_tenant_id and user_id = p_user_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.member.removed',
    'tenant_memberships',
    p_user_id,
    'success',
    jsonb_build_object('role', target_role)
  );
end;
$$;

create or replace function public.update_platform_tenant_lifecycle(
  p_tenant_id uuid,
  p_status public.tenant_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status public.tenant_status;
begin
  perform private.require_platform_lifecycle_aal2();
  select tenant.status into previous_status from public.tenants tenant where tenant.id = p_tenant_id for update;
  if not found then raise exception 'tenant not found' using errcode = 'P0002'; end if;
  if previous_status = p_status then return; end if;

  update public.tenants set status = p_status where id = p_tenant_id;
  perform private.audit_event(
    p_tenant_id,
    'tenant.lifecycle.changed',
    'tenants',
    p_tenant_id,
    'success',
    jsonb_build_object('fromStatus', previous_status, 'toStatus', p_status)
  );
end;
$$;

create or replace function public.update_platform_tenant_screen_limit(
  p_tenant_id uuid,
  p_screen_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_limit integer;
  current_screen_count integer;
begin
  perform private.require_platform_lifecycle_aal2();
  if p_screen_limit is null or p_screen_limit not between 1 and 10000 then
    raise exception 'tenant screen limit must be between 1 and 10000' using errcode = '23514';
  end if;

  select tenant.screen_limit into current_limit
  from public.tenants tenant where tenant.id = p_tenant_id for update;
  if not found then raise exception 'tenant not found' using errcode = 'P0002'; end if;

  select count(*) into current_screen_count
  from public.screens screen where screen.tenant_id = p_tenant_id;
  if p_screen_limit < current_screen_count then
    raise exception 'screen limit cannot be lower than current screen usage' using errcode = '23514';
  end if;
  if current_limit = p_screen_limit then return; end if;

  update public.tenants set screen_limit = p_screen_limit where id = p_tenant_id;
  perform private.audit_event(
    p_tenant_id,
    'tenant.screen_limit.changed',
    'tenants',
    p_tenant_id,
    'success',
    jsonb_build_object('fromLimit', current_limit, 'toLimit', p_screen_limit)
  );
end;
$$;

create or replace function public.set_platform_user_role(
  p_email text,
  p_role public.platform_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target_user_id uuid;
  target_role public.platform_role;
  owner_count integer;
begin
  perform private.require_platform_owner_aal2();
  perform pg_catalog.pg_advisory_xact_lock(220022);
  select auth_user.id into target_user_id
  from auth.users auth_user where lower(auth_user.email) = lower(btrim(p_email));
  if not found then raise exception 'platform user not found' using errcode = 'P0002'; end if;
  if target_user_id = actor_id then raise exception 'self lockout is not allowed' using errcode = '42501'; end if;

  select membership.role into target_role
  from public.platform_memberships membership
  where membership.user_id = target_user_id
  order by case membership.role when 'platform_owner' then 1 when 'platform_admin' then 2 when 'platform_support' then 3 else 4 end
  limit 1;

  select count(distinct membership.user_id) into owner_count
  from public.platform_memberships membership where membership.role = 'platform_owner';
  if target_role = 'platform_owner' and p_role <> 'platform_owner' and owner_count <= 1 then
    raise exception 'last platform owner cannot be changed' using errcode = '23514';
  end if;

  insert into public.profiles (id, display_name)
  select target_user_id, nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
  from auth.users auth_user where auth_user.id = target_user_id
  on conflict (id) do nothing;

  delete from public.platform_memberships where user_id = target_user_id;
  insert into public.platform_memberships (user_id, role, created_by)
  values (target_user_id, p_role, actor_id);

  perform private.audit_event(
    null,
    'platform.member.role_set',
    'platform_memberships',
    target_user_id,
    'success',
    jsonb_build_object('fromRole', target_role, 'toRole', p_role)
  );
  return target_user_id;
end;
$$;

create or replace function public.remove_platform_user_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target_role public.platform_role;
  owner_count integer;
begin
  perform private.require_platform_owner_aal2();
  perform pg_catalog.pg_advisory_xact_lock(220022);
  if p_user_id = actor_id then raise exception 'self lockout is not allowed' using errcode = '42501'; end if;

  select membership.role into target_role
  from public.platform_memberships membership
  where membership.user_id = p_user_id
  order by case membership.role when 'platform_owner' then 1 when 'platform_admin' then 2 when 'platform_support' then 3 else 4 end
  limit 1;
  if not found then raise exception 'platform membership not found' using errcode = 'P0002'; end if;

  select count(distinct membership.user_id) into owner_count
  from public.platform_memberships membership where membership.role = 'platform_owner';
  if target_role = 'platform_owner' and owner_count <= 1 then
    raise exception 'last platform owner cannot be removed' using errcode = '23514';
  end if;

  delete from public.platform_memberships where user_id = p_user_id;
  perform private.audit_event(
    null,
    'platform.member.removed',
    'platform_memberships',
    p_user_id,
    'success',
    jsonb_build_object('role', target_role)
  );
end;
$$;

revoke all on function private.current_user_email() from public, anon, authenticated;
revoke all on function private.require_platform_owner_aal2() from public, anon, authenticated;
revoke all on function private.require_platform_lifecycle_aal2() from public, anon, authenticated;
revoke all on function private.tenant_team_actor_role(uuid) from public, anon, authenticated;
revoke all on function private.enforce_tenant_screen_limit() from public, anon, authenticated;

revoke execute on function public.create_platform_tenant(text, text, integer) from authenticated;
revoke insert, update, delete on public.platform_memberships from authenticated;
revoke insert, update, delete on public.tenant_memberships from authenticated;
revoke insert, update, delete on public.tenant_invitations from authenticated;

revoke all on function public.provision_platform_tenant(text, text, integer, text, text, text, boolean, text, text, text) from public, anon;
revoke all on function public.create_tenant_invitation(uuid, text, public.tenant_role, text) from public, anon;
revoke all on function public.rotate_tenant_invitation(uuid, text) from public, anon;
revoke all on function public.mark_tenant_invitation_delivery(uuid, boolean, text) from public, anon;
revoke all on function public.revoke_tenant_invitation(uuid) from public, anon;
revoke all on function public.accept_tenant_invitation(uuid, uuid, text) from public, anon;
revoke all on function public.get_tenant_invitation_preview(uuid, uuid, text) from public, anon;
revoke all on function public.set_tenant_member_role(uuid, uuid, public.tenant_role) from public, anon;
revoke all on function public.remove_tenant_member(uuid, uuid) from public, anon;
revoke all on function public.update_platform_tenant_lifecycle(uuid, public.tenant_status) from public, anon;
revoke all on function public.update_platform_tenant_screen_limit(uuid, integer) from public, anon;
revoke all on function public.set_platform_user_role(text, public.platform_role) from public, anon;
revoke all on function public.remove_platform_user_access(uuid) from public, anon;

grant execute on function public.provision_platform_tenant(text, text, integer, text, text, text, boolean, text, text, text) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, public.tenant_role, text) to authenticated;
grant execute on function public.rotate_tenant_invitation(uuid, text) to authenticated;
grant execute on function public.mark_tenant_invitation_delivery(uuid, boolean, text) to authenticated;
grant execute on function public.revoke_tenant_invitation(uuid) to authenticated;
grant execute on function public.accept_tenant_invitation(uuid, uuid, text) to authenticated;
grant execute on function public.get_tenant_invitation_preview(uuid, uuid, text) to authenticated;
grant execute on function public.set_tenant_member_role(uuid, uuid, public.tenant_role) to authenticated;
grant execute on function public.remove_tenant_member(uuid, uuid) to authenticated;
grant execute on function public.update_platform_tenant_lifecycle(uuid, public.tenant_status) to authenticated;
grant execute on function public.update_platform_tenant_screen_limit(uuid, integer) to authenticated;
grant execute on function public.set_platform_user_role(text, public.platform_role) to authenticated;
grant execute on function public.remove_platform_user_access(uuid) to authenticated;
