-- VeyoCast Control Mobile: idempotent pairing and privacy-scoped push devices.

create table public.mobile_control_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  platform text not null check (platform = 'android'),
  app_version text not null check (length(btrim(app_version)) between 1 and 80),
  locale text check (locale is null or length(locale) <= 32),
  timezone_name text check (
    timezone_name is null or length(timezone_name) <= 120
  ),
  notifications_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token_hash)
);

create index mobile_control_devices_user_active_idx
on public.mobile_control_devices(user_id, last_seen_at desc)
where revoked_at is null;

create trigger mobile_control_devices_set_updated_at
before update on public.mobile_control_devices
for each row execute function private.set_updated_at();

create table private.mobile_control_push_tokens (
  device_id uuid primary key references public.mobile_control_devices(id)
    on delete cascade,
  encrypted_token bytea not null check (octet_length(encrypted_token) between 32 and 8192),
  encryption_key_version integer not null default 1 check (encryption_key_version > 0),
  rotated_at timestamptz not null default now()
);

create table public.mobile_notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  screen_offline boolean not null default true,
  player_error boolean not null default true,
  publication_completed boolean not null default true,
  media_failed boolean not null default true,
  approval_requested boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create index mobile_notification_preferences_tenant_idx
on public.mobile_notification_preferences(tenant_id, user_id);

create trigger mobile_notification_preferences_set_updated_at
before update on public.mobile_notification_preferences
for each row execute function private.set_updated_at();

alter table public.mobile_control_devices enable row level security;
alter table public.mobile_control_devices force row level security;
alter table public.mobile_notification_preferences enable row level security;
alter table public.mobile_notification_preferences force row level security;

revoke all on public.mobile_control_devices from public, anon, authenticated;
revoke all on public.mobile_notification_preferences from public, anon, authenticated;
grant select on public.mobile_control_devices to authenticated;
grant select, insert, update, delete
on public.mobile_notification_preferences to authenticated;

create policy "mobile_devices_read_own"
on public.mobile_control_devices
for select to authenticated
using (user_id = private.current_user_id());

create policy "mobile_preferences_read_own_tenant"
on public.mobile_notification_preferences
for select to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create policy "mobile_preferences_insert_own_tenant"
on public.mobile_notification_preferences
for insert to authenticated
with check (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create policy "mobile_preferences_update_own_tenant"
on public.mobile_notification_preferences
for update to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
)
with check (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create policy "mobile_preferences_delete_own_tenant"
on public.mobile_notification_preferences
for delete to authenticated
using (
  user_id = private.current_user_id()
  and private.is_tenant_member(tenant_id)
);

create or replace function public.register_mobile_control_device_v1(
  p_token_hash text,
  p_encrypted_token bytea,
  p_app_version text,
  p_locale text default null,
  p_timezone_name text default null,
  p_encryption_key_version integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  registered_device_id uuid;
begin
  if actor_id is null then
    raise exception 'authenticated actor required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_encrypted_token is null
    or octet_length(p_encrypted_token) not between 32 and 8192
    or length(btrim(coalesce(p_app_version, ''))) not between 1 and 80
    or coalesce(p_encryption_key_version, 0) < 1
  then
    raise exception 'invalid mobile device registration' using errcode = '23514';
  end if;

  insert into public.mobile_control_devices (
    user_id,
    token_hash,
    platform,
    app_version,
    locale,
    timezone_name,
    notifications_enabled,
    last_seen_at,
    revoked_at
  )
  values (
    actor_id,
    lower(p_token_hash),
    'android',
    btrim(p_app_version),
    nullif(btrim(coalesce(p_locale, '')), ''),
    nullif(btrim(coalesce(p_timezone_name, '')), ''),
    true,
    now(),
    null
  )
  on conflict (user_id, token_hash) do update
  set app_version = excluded.app_version,
      locale = excluded.locale,
      timezone_name = excluded.timezone_name,
      notifications_enabled = true,
      last_seen_at = now(),
      revoked_at = null
  returning id into registered_device_id;

  insert into private.mobile_control_push_tokens (
    device_id,
    encrypted_token,
    encryption_key_version,
    rotated_at
  )
  values (
    registered_device_id,
    p_encrypted_token,
    p_encryption_key_version,
    now()
  )
  on conflict on constraint mobile_control_push_tokens_pkey do update
  set encrypted_token = excluded.encrypted_token,
      encryption_key_version = excluded.encryption_key_version,
      rotated_at = now();

  perform private.audit_event(
    null,
    'mobile_control.device_registered',
    'mobile_control_devices',
    registered_device_id,
    'success',
    jsonb_build_object('platform', 'android')
  );
  return registered_device_id;
end;
$$;

create or replace function public.revoke_mobile_control_device_v1(
  p_device_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  changed boolean;
begin
  if actor_id is null then
    raise exception 'authenticated actor required' using errcode = '42501';
  end if;
  update public.mobile_control_devices
  set notifications_enabled = false,
      revoked_at = now()
  where id = p_device_id
    and user_id = actor_id
    and revoked_at is null;
  changed := found;
  if changed then
    delete from private.mobile_control_push_tokens
    where device_id = p_device_id;
    perform private.audit_event(
      null,
      'mobile_control.device_revoked',
      'mobile_control_devices',
      p_device_id,
      'success',
      '{}'::jsonb
    );
  end if;
  return changed;
end;
$$;

create table private.mobile_pairing_claim_idempotency (
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  tenant_id uuid not null,
  screen_id uuid not null,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  primary key (actor_user_id, idempotency_key)
);

create index mobile_pairing_claim_idempotency_expiry_idx
on private.mobile_pairing_claim_idempotency(expires_at);

create or replace function public.claim_pairing_session_mobile_v1(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  existing private.mobile_pairing_claim_idempotency%rowtype;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'authenticated actor required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 65)
  );
  delete from private.mobile_pairing_claim_idempotency
  where expires_at <= now();

  select *
  into existing
  from private.mobile_pairing_claim_idempotency
  where actor_user_id = actor_id
    and idempotency_key = p_idempotency_key;
  if found then
    if existing.tenant_id <> p_tenant_id
      or existing.screen_id <> p_screen_id
      or existing.code_hash <> lower(p_code_hash)
    then
      raise exception 'idempotency key reused for another pairing claim'
        using errcode = '23505';
    end if;
    return existing.response;
  end if;

  result := public.claim_pairing_session_v4(
    p_code_hash,
    p_tenant_id,
    p_screen_id,
    p_device_name
  );
  insert into private.mobile_pairing_claim_idempotency (
    actor_user_id,
    idempotency_key,
    tenant_id,
    screen_id,
    code_hash,
    response
  )
  values (
    actor_id,
    p_idempotency_key,
    p_tenant_id,
    p_screen_id,
    lower(p_code_hash),
    result
  );
  return result;
end;
$$;

revoke all on function public.register_mobile_control_device_v1(
  text, bytea, text, text, text, integer
) from public, anon;
revoke all on function public.revoke_mobile_control_device_v1(uuid)
from public, anon;
revoke all on function public.claim_pairing_session_mobile_v1(
  text, uuid, uuid, text, uuid
) from public, anon;
grant execute on function public.register_mobile_control_device_v1(
  text, bytea, text, text, text, integer
) to authenticated;
grant execute on function public.revoke_mobile_control_device_v1(uuid)
to authenticated;
grant execute on function public.claim_pairing_session_mobile_v1(
  text, uuid, uuid, text, uuid
) to authenticated;
