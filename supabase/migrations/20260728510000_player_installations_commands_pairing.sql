-- S48: durable anonymous Player installations, one active pairing attempt per
-- installation and an idempotent remote command channel.

create table public.player_installations (
  id uuid primary key default gen_random_uuid(),
  public_identifier_hash text not null unique
    check (public_identifier_hash ~ '^[a-f0-9]{64}$'),
  credential_hash text not null unique
    check (credential_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  bound_device_id uuid unique
    references public.player_devices(id)
    on delete set null,
  last_seen_at timestamptz,
  credential_rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'revoked' or revoked_at is not null)
);

create index player_installations_status_last_seen_idx
  on public.player_installations(status, last_seen_at desc);

create trigger player_installations_set_updated_at
before update on public.player_installations
for each row execute function private.set_updated_at();

alter table public.player_installations enable row level security;
revoke all on public.player_installations from public, anon, authenticated;

alter table public.pairing_sessions
  add column installation_id uuid
    references public.player_installations(id)
    on delete set null,
  add column request_nonce_hash text
    check (
      request_nonce_hash is null
      or request_nonce_hash ~ '^[a-f0-9]{64}$'
    );

create unique index pairing_sessions_one_pending_per_installation_uq
  on public.pairing_sessions(installation_id)
  where installation_id is not null
    and status = 'pending'::public.pairing_session_status;

create index pairing_sessions_installation_time_idx
  on public.pairing_sessions(installation_id, created_at desc)
  where installation_id is not null;

create table private.player_pairing_events (
  id bigint generated always as identity primary key,
  installation_id uuid
    references public.player_installations(id)
    on delete set null,
  pairing_session_id uuid
    references public.pairing_sessions(id)
    on delete set null,
  tenant_id uuid
    references public.tenants(id)
    on delete set null,
  screen_id uuid
    references public.screens(id)
    on delete set null,
  event_type text not null
    check (event_type in ('create', 'claim', 'expire', 'cancel', 'recover')),
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);

create index player_pairing_events_installation_time_idx
  on private.player_pairing_events(installation_id, created_at desc);
create index player_pairing_events_session_time_idx
  on private.player_pairing_events(pairing_session_id, created_at desc);

revoke all on private.player_pairing_events
from public, anon, authenticated;

create table public.player_commands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,
  installation_id uuid not null
    references public.player_installations(id)
    on delete cascade,
  screen_id uuid,
  device_id uuid,
  command_type text not null
    check (
      command_type in (
        'RELOAD_PLAYER',
        'RECOVER_PAIRING',
        'FORCE_UNPAIR',
        'CLEAR_PLAYER_CACHE'
      )
    ),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  nonce uuid not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  unique (tenant_id, id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete set null (screen_id),
  foreign key (tenant_id, device_id)
    references public.player_devices(tenant_id, id)
    on delete set null (device_id),
  check (expires_at > created_at),
  check (completed_at is null or failed_at is null),
  check (failure_code is null or failed_at is not null)
);

create index player_commands_installation_open_idx
  on public.player_commands(installation_id, created_at)
  where completed_at is null and failed_at is null;
create index player_commands_tenant_screen_time_idx
  on public.player_commands(tenant_id, screen_id, created_at desc);

alter table public.player_commands enable row level security;

create policy "player_commands_select_by_screen_manager"
on public.player_commands
for select
to authenticated
using (private.can_manage_screens(tenant_id));

revoke all on public.player_commands from public, anon;
grant select on public.player_commands to authenticated;

create or replace function public.register_player_installation_v1(
  p_public_identifier_hash text,
  p_new_credential_hash text,
  p_existing_credential_hash text default null,
  p_device_or_pending_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identifier_hash text :=
    lower(nullif(btrim(p_public_identifier_hash), ''));
  normalized_new_credential_hash text :=
    lower(nullif(btrim(p_new_credential_hash), ''));
  normalized_existing_credential_hash text :=
    lower(nullif(btrim(p_existing_credential_hash), ''));
  normalized_device_token_hash text :=
    lower(nullif(btrim(p_device_or_pending_token_hash), ''));
  installation_record public.player_installations%rowtype;
  proven_device_id uuid;
  pending_proof boolean := false;
  credential_rotated boolean := false;
begin
  if normalized_identifier_hash is null
    or normalized_identifier_hash !~ '^[a-f0-9]{64}$'
    or normalized_new_credential_hash is null
    or normalized_new_credential_hash !~ '^[a-f0-9]{64}$'
    or (
      normalized_existing_credential_hash is not null
      and normalized_existing_credential_hash !~ '^[a-f0-9]{64}$'
    )
    or (
      normalized_device_token_hash is not null
      and normalized_device_token_hash !~ '^[a-f0-9]{64}$'
    )
  then
    raise exception 'invalid installation hashes' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_identifier_hash, 48)
  );

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.public_identifier_hash = normalized_identifier_hash
  for update;

  if not found then
    if normalized_existing_credential_hash is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'INSTALLATION_NOT_FOUND'
      );
    end if;

    select device.id
    into proven_device_id
    from public.player_devices device
    where normalized_device_token_hash is not null
      and device.token_hash = normalized_device_token_hash
      and device.status = 'paired'::public.player_device_status
    limit 1;

    insert into public.player_installations (
      public_identifier_hash,
      credential_hash,
      bound_device_id,
      last_seen_at
    )
    values (
      normalized_identifier_hash,
      normalized_new_credential_hash,
      proven_device_id,
      now()
    )
    returning * into installation_record;

    return jsonb_build_object(
      'ok', true,
      'created', true,
      'credentialRotated', false,
      'installationId', installation_record.id,
      'boundDeviceId', installation_record.bound_device_id
    );
  end if;

  if installation_record.status <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSTALLATION_REVOKED'
    );
  end if;

  if normalized_existing_credential_hash = installation_record.credential_hash then
    null;
  elsif normalized_device_token_hash is not null then
    select device.id
    into proven_device_id
    from public.player_devices device
    where device.token_hash = normalized_device_token_hash
      and device.status = 'paired'::public.player_device_status
      and (
        installation_record.bound_device_id is null
        or installation_record.bound_device_id = device.id
      )
    limit 1;

    if proven_device_id is null then
      select exists (
        select 1
        from public.pairing_sessions pairing
        where pairing.installation_id = installation_record.id
          and pairing.pending_token_hash = normalized_device_token_hash
          and pairing.status = 'pending'::public.pairing_session_status
          and pairing.expires_at > now()
      )
      into pending_proof;
    end if;

    if proven_device_id is null and not pending_proof then
      return jsonb_build_object(
        'ok', false,
        'code', 'INSTALLATION_CREDENTIAL_REQUIRED'
      );
    end if;

    update public.player_installations
    set credential_hash = normalized_new_credential_hash,
        credential_rotated_at = now(),
        bound_device_id = coalesce(proven_device_id, bound_device_id),
        last_seen_at = now()
    where id = installation_record.id
    returning * into installation_record;
    credential_rotated := true;
  else
    return jsonb_build_object(
      'ok', false,
      'code', 'INSTALLATION_CREDENTIAL_REQUIRED'
    );
  end if;

  if proven_device_id is null and normalized_device_token_hash is not null then
    select device.id
    into proven_device_id
    from public.player_devices device
    where device.token_hash = normalized_device_token_hash
      and device.status = 'paired'::public.player_device_status
    limit 1;
  end if;

  update public.player_installations
  set bound_device_id = coalesce(proven_device_id, bound_device_id),
      last_seen_at = now()
  where id = installation_record.id
  returning * into installation_record;

  return jsonb_build_object(
    'ok', true,
    'created', false,
    'credentialRotated', credential_rotated,
    'installationId', installation_record.id,
    'boundDeviceId', installation_record.bound_device_id
  );
end;
$$;

create or replace function public.create_pairing_session_v4(
  p_code_hash text,
  p_token_hash text,
  p_installation_credential_hash text,
  p_request_nonce_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  normalized_request_nonce_hash text :=
    lower(nullif(btrim(p_request_nonce_hash), ''));
  installation_record public.player_installations%rowtype;
  pairing_record public.pairing_sessions%rowtype;
  pairing_expires_at timestamptz := now() + interval '10 minutes';
  installation_attempts integer;
  global_attempts integer;
  oldest_installation_attempt timestamptz;
  oldest_global_attempt timestamptz;
  retry_after_seconds integer := 1;
begin
  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
    or normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
    or normalized_credential_hash is null
    or normalized_credential_hash !~ '^[a-f0-9]{64}$'
    or normalized_request_nonce_hash is null
    or normalized_request_nonce_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid pairing hashes' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_credential_hash, 48)
  );

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.credential_hash = normalized_credential_hash
    and installation.status = 'active'
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  update public.player_installations
  set last_seen_at = now()
  where id = installation_record.id;

  for pairing_record in
    update public.pairing_sessions
    set status = 'expired'::public.pairing_session_status
    where installation_id = installation_record.id
      and status = 'pending'::public.pairing_session_status
      and expires_at <= now()
    returning *
  loop
    insert into private.player_pairing_events (
      installation_id,
      pairing_session_id,
      event_type
    )
    values (installation_record.id, pairing_record.id, 'expire');
  end loop;

  select pairing.*
  into pairing_record
  from public.pairing_sessions pairing
  where pairing.installation_id = installation_record.id
    and pairing.status = 'pending'::public.pairing_session_status
  for update;

  if found and pairing_record.request_nonce_hash = normalized_request_nonce_hash then
    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'pairingSessionId', pairing_record.id,
      'expiresAt', pairing_record.expires_at
    );
  end if;

  delete from private.pairing_creation_attempts
  where attempted_at < now() - interval '1 day';

  select count(*)::integer, min(attempted_at)
  into installation_attempts, oldest_installation_attempt
  from private.pairing_creation_attempts
  where fingerprint_hash = installation_record.public_identifier_hash
    and outcome = 'created'
    and attempted_at >= now() - interval '10 minutes';

  select count(*)::integer, min(attempted_at)
  into global_attempts, oldest_global_attempt
  from private.pairing_creation_attempts
  where outcome = 'created'
    and attempted_at >= now() - interval '1 minute';

  if installation_attempts >= 5 or global_attempts >= 300 then
    if installation_attempts >= 5
      and oldest_installation_attempt is not null
    then
      retry_after_seconds := greatest(
        retry_after_seconds,
        ceil(extract(epoch from (
          oldest_installation_attempt + interval '10 minutes' - now()
        )))::integer
      );
    end if;
    if global_attempts >= 300 and oldest_global_attempt is not null then
      retry_after_seconds := greatest(
        retry_after_seconds,
        ceil(extract(epoch from (
          oldest_global_attempt + interval '1 minute' - now()
        )))::integer
      );
    end if;

    insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
    values (installation_record.public_identifier_hash, 'rate_limited');
    return jsonb_build_object(
      'ok', false,
      'code', 'RATE_LIMITED',
      'retryAfterSeconds', retry_after_seconds
    );
  end if;

  if pairing_record.id is not null then
    update public.pairing_sessions
    set status = 'cancelled'::public.pairing_session_status
    where id = pairing_record.id;
    insert into private.player_pairing_events (
      installation_id,
      pairing_session_id,
      event_type
    )
    values (installation_record.id, pairing_record.id, 'cancel');
  end if;

  insert into public.pairing_sessions (
    code_hash,
    pending_token_hash,
    device_fingerprint_hash,
    installation_id,
    request_nonce_hash,
    expires_at
  )
  values (
    normalized_code_hash,
    normalized_token_hash,
    installation_record.public_identifier_hash,
    installation_record.id,
    normalized_request_nonce_hash,
    pairing_expires_at
  )
  returning * into pairing_record;

  insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
  values (installation_record.public_identifier_hash, 'created');
  insert into private.player_pairing_events (
    installation_id,
    pairing_session_id,
    event_type
  )
  values (installation_record.id, pairing_record.id, 'create');

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'pairingSessionId', pairing_record.id,
    'expiresAt', pairing_record.expires_at
  );
end;
$$;

create or replace function public.inspect_player_device_credential_v1(
  p_token_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  device_status public.player_device_status;
begin
  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
  then
    return 'INVALID_DEVICE_TOKEN';
  end if;

  select device.status
  into device_status
  from public.player_devices device
  where device.token_hash = normalized_token_hash
  limit 1;
  if found then
    return case
      when device_status = 'paired'::public.player_device_status
        then 'PAIRED'
      else 'DEVICE_REVOKED'
    end;
  end if;

  if exists (
    select 1
    from public.pairing_sessions pairing
    where pairing.pending_token_hash = normalized_token_hash
      and pairing.status = 'pending'::public.pairing_session_status
      and pairing.expires_at > now()
  ) then
    return 'PAIRING_PENDING';
  end if;

  return 'INVALID_DEVICE_TOKEN';
end;
$$;

create or replace function public.unpair_player_installation_v1(
  p_installation_credential_hash text,
  p_device_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_installation_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  normalized_device_token_hash text :=
    lower(nullif(btrim(p_device_token_hash), ''));
  installation_record public.player_installations%rowtype;
  device_record public.player_devices%rowtype;
begin
  if normalized_installation_credential_hash is null
    or normalized_installation_credential_hash !~ '^[a-f0-9]{64}$'
    or normalized_device_token_hash is null
    or normalized_device_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid unpair hashes' using errcode = '23514';
  end if;

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.credential_hash =
      normalized_installation_credential_hash
    and installation.status = 'active'
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  select device.*
  into device_record
  from public.player_devices device
  where device.id = installation_record.bound_device_id
    and device.token_hash = normalized_device_token_hash
    and device.status = 'paired'::public.player_device_status
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_DEVICE_TOKEN'
    );
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status,
      revoked_at = now()
  where id = device_record.id;
  update public.player_installations
  set bound_device_id = null,
      last_seen_at = now()
  where id = installation_record.id;
  update public.pairing_sessions
  set status = 'cancelled'::public.pairing_session_status
  where installation_id = installation_record.id
    and status = 'pending'::public.pairing_session_status;

  insert into private.player_pairing_events (
    installation_id,
    tenant_id,
    screen_id,
    event_type,
    detail
  )
  values (
    installation_record.id,
    device_record.tenant_id,
    device_record.screen_id,
    'recover',
    jsonb_build_object('source', 'local_recovery_menu')
  );
  perform private.audit_event(
    device_record.tenant_id,
    'player_device.self_unpaired',
    'player_devices',
    device_record.id,
    'success',
    jsonb_build_object(
      'installationId', installation_record.id,
      'screenId', device_record.screen_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'screenId', device_record.screen_id
  );
end;
$$;

create or replace function public.claim_pairing_session_v4(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  pairing_record public.pairing_sessions%rowtype;
  screen_record public.screens%rowtype;
  recent_attempts integer;
  device_id uuid;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot pair devices for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 48)
  );
  delete from private.pairing_claim_attempts
  where attempted_at < now() - interval '1 day';
  select count(*)::integer
  into recent_attempts
  from private.pairing_claim_attempts
  where actor_user_id = actor_id
    and attempted_at >= now() - interval '5 minutes';
  if recent_attempts >= 10 then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'rate_limited');
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;

  select pairing.*
  into pairing_record
  from public.pairing_sessions pairing
  where pairing.code_hash = normalized_code_hash
    and pairing.status = 'pending'::public.pairing_session_status
  for update;

  if not found then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID_OR_REPLAYED');
  end if;
  if pairing_record.expires_at <= now() then
    update public.pairing_sessions
    set status = 'expired'::public.pairing_session_status
    where id = pairing_record.id;
    insert into private.player_pairing_events (
      installation_id,
      pairing_session_id,
      event_type
    )
    values (pairing_record.installation_id, pairing_record.id, 'expire');
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'expired');
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;
  if pairing_record.pending_token_hash is null
    or pairing_record.installation_id is null
  then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID_OR_REPLAYED');
  end if;

  select screen.*
  into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status = 'active'::public.screen_status
  for update;
  if not found then
    insert into private.pairing_claim_attempts(actor_user_id, outcome)
    values (actor_id, 'screen_unavailable');
    return jsonb_build_object('ok', false, 'code', 'SCREEN_UNAVAILABLE');
  end if;

  update public.player_devices
  set status = 'revoked'::public.player_device_status,
      revoked_at = now()
  where tenant_id = p_tenant_id
    and screen_id = p_screen_id
    and status = 'paired'::public.player_device_status;

  insert into public.player_devices (
    tenant_id,
    screen_id,
    device_name,
    token_hash,
    desired_release_id
  )
  values (
    p_tenant_id,
    p_screen_id,
    coalesce(nullif(btrim(p_device_name), ''), 'VeyoCast player'),
    pairing_record.pending_token_hash,
    screen_record.assigned_release_id
  )
  returning id into device_id;

  update public.player_installations
  set bound_device_id = device_id,
      last_seen_at = now()
  where id = pairing_record.installation_id
    and status = 'active';

  update public.pairing_sessions
  set status = 'claimed'::public.pairing_session_status,
      claimed_by = actor_id,
      claimed_tenant_id = p_tenant_id,
      claimed_screen_id = p_screen_id,
      paired_device_id = device_id,
      claimed_at = now(),
      pending_token_hash = null
  where id = pairing_record.id;

  insert into private.pairing_claim_attempts(actor_user_id, outcome)
  values (actor_id, 'paired');
  insert into private.player_pairing_events (
    installation_id,
    pairing_session_id,
    tenant_id,
    screen_id,
    event_type
  )
  values (
    pairing_record.installation_id,
    pairing_record.id,
    p_tenant_id,
    p_screen_id,
    'claim'
  );
  perform private.audit_event(
    p_tenant_id,
    'player_device.paired',
    'player_devices',
    device_id,
    'success',
    jsonb_build_object(
      'screenId', p_screen_id,
      'pairingSessionId', pairing_record.id,
      'installationId', pairing_record.installation_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'deviceId', device_id,
    'installationId', pairing_record.installation_id
  );
end;
$$;

create or replace function public.queue_player_command_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_command_type text,
  p_nonce uuid,
  p_ttl_seconds integer default 900,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_command_type text := upper(nullif(btrim(p_command_type), ''));
  normalized_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  device_record public.player_devices%rowtype;
  installation_record public.player_installations%rowtype;
  command_record public.player_commands%rowtype;
  bounded_ttl integer := least(86400, greatest(30, coalesce(p_ttl_seconds, 900)));
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'actor cannot command devices for this tenant'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if normalized_command_type not in (
    'RELOAD_PLAYER',
    'RECOVER_PAIRING',
    'FORCE_UNPAIR',
    'CLEAR_PLAYER_CACHE'
  ) or jsonb_typeof(normalized_payload) <> 'object'
  then
    raise exception 'invalid player command' using errcode = '23514';
  end if;

  select command.*
  into command_record
  from public.player_commands command
  where command.nonce = p_nonce
  for update;
  if found then
    if command_record.tenant_id <> p_tenant_id
      or command_record.screen_id is distinct from p_screen_id
      or command_record.command_type <> normalized_command_type
    then
      raise exception 'command nonce was reused for another target'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'commandId', command_record.id
    );
  end if;

  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status <> 'disabled'::public.screen_status
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'SCREEN_UNAVAILABLE');
  end if;

  select device.*
  into device_record
  from public.player_devices device
  where device.tenant_id = p_tenant_id
    and device.screen_id = p_screen_id
    and device.status = 'paired'::public.player_device_status
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'PLAYER_UNPAIRED');
  end if;

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.bound_device_id = device_record.id
    and installation.status = 'active'
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'PLAYER_INSTALLATION_UNAVAILABLE'
    );
  end if;

  insert into public.player_commands (
    tenant_id,
    installation_id,
    screen_id,
    device_id,
    command_type,
    payload,
    nonce,
    expires_at
  )
  values (
    p_tenant_id,
    installation_record.id,
    p_screen_id,
    device_record.id,
    normalized_command_type,
    normalized_payload,
    p_nonce,
    now() + make_interval(secs => bounded_ttl)
  )
  returning * into command_record;

  perform private.audit_event(
    p_tenant_id,
    'player_command.queued',
    'screens',
    p_screen_id,
    'success',
    jsonb_build_object(
      'commandId', command_record.id,
      'commandType', normalized_command_type,
      'expiresAt', command_record.expires_at
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'commandId', command_record.id,
    'expiresAt', command_record.expires_at
  );
end;
$$;

create or replace function public.poll_player_commands_v1(
  p_installation_credential_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  installation_record public.player_installations%rowtype;
  command_record public.player_commands%rowtype;
  command_list jsonb := '[]'::jsonb;
begin
  if normalized_credential_hash is null
    or normalized_credential_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid installation credential hash'
      using errcode = '23514';
  end if;

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.credential_hash = normalized_credential_hash
    and installation.status = 'active'
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  update public.player_installations
  set last_seen_at = now()
  where id = installation_record.id;

  for command_record in
    update public.player_commands
    set failed_at = now(),
        failure_code = 'COMMAND_EXPIRED'
    where installation_id = installation_record.id
      and completed_at is null
      and failed_at is null
      and expires_at <= now()
    returning *
  loop
    perform private.audit_event(
      command_record.tenant_id,
      'player_command.expired',
      'screens',
      command_record.screen_id,
      'failed',
      jsonb_build_object(
        'commandId', command_record.id,
        'commandType', command_record.command_type
      )
    );
  end loop;

  for command_record in
    select command.*
    from public.player_commands command
    where command.installation_id = installation_record.id
      and command.completed_at is null
      and command.failed_at is null
      and command.expires_at > now()
    order by command.created_at
    limit 10
    for update skip locked
  loop
    if command_record.delivered_at is null then
      update public.player_commands
      set delivered_at = now()
      where id = command_record.id
      returning * into command_record;
      perform private.audit_event(
        command_record.tenant_id,
        'player_command.delivered',
        'screens',
        command_record.screen_id,
        'success',
        jsonb_build_object(
          'commandId', command_record.id,
          'commandType', command_record.command_type
        )
      );
    end if;

    command_list := command_list || jsonb_build_array(
      jsonb_build_object(
        'id', command_record.id,
        'nonce', command_record.nonce,
        'commandType', command_record.command_type,
        'payload', command_record.payload,
        'createdAt', command_record.created_at,
        'expiresAt', command_record.expires_at
      )
    );
  end loop;

  return jsonb_build_object('ok', true, 'commands', command_list);
end;
$$;

create or replace function public.complete_player_command_v1(
  p_installation_credential_hash text,
  p_command_id uuid,
  p_new_device_token_hash text default null,
  p_failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  normalized_new_device_token_hash text :=
    lower(nullif(btrim(p_new_device_token_hash), ''));
  normalized_failure_code text :=
    upper(nullif(btrim(p_failure_code), ''));
  installation_record public.player_installations%rowtype;
  command_record public.player_commands%rowtype;
begin
  if normalized_credential_hash is null
    or normalized_credential_hash !~ '^[a-f0-9]{64}$'
    or (
      normalized_new_device_token_hash is not null
      and normalized_new_device_token_hash !~ '^[a-f0-9]{64}$'
    )
  then
    raise exception 'invalid command completion hashes'
      using errcode = '23514';
  end if;

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.credential_hash = normalized_credential_hash
    and installation.status = 'active'
  for update;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  select command.*
  into command_record
  from public.player_commands command
  where command.id = p_command_id
    and command.installation_id = installation_record.id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMAND_NOT_FOUND');
  end if;

  if command_record.completed_at is not null then
    return jsonb_build_object(
      'ok', true,
      'alreadyCompleted', true,
      'commandType', command_record.command_type
    );
  end if;
  if command_record.failed_at is not null then
    return jsonb_build_object(
      'ok', false,
      'code', coalesce(command_record.failure_code, 'COMMAND_FAILED')
    );
  end if;
  if command_record.expires_at <= now() then
    update public.player_commands
    set acknowledged_at = coalesce(acknowledged_at, now()),
        failed_at = now(),
        failure_code = 'COMMAND_EXPIRED'
    where id = command_record.id;
    return jsonb_build_object('ok', false, 'code', 'COMMAND_EXPIRED');
  end if;

  update public.player_commands
  set acknowledged_at = coalesce(acknowledged_at, now())
  where id = command_record.id;

  if normalized_failure_code is not null then
    update public.player_commands
    set failed_at = now(),
        failure_code = left(normalized_failure_code, 80)
    where id = command_record.id;
    perform private.audit_event(
      command_record.tenant_id,
      'player_command.failed',
      'screens',
      command_record.screen_id,
      'failed',
      jsonb_build_object(
        'commandId', command_record.id,
        'commandType', command_record.command_type,
        'failureCode', left(normalized_failure_code, 80)
      )
    );
    return jsonb_build_object(
      'ok', false,
      'code', left(normalized_failure_code, 80)
    );
  end if;

  if command_record.command_type = 'RECOVER_PAIRING' then
    if normalized_new_device_token_hash is null
      or installation_record.bound_device_id is null
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'RECOVERY_CREDENTIAL_REQUIRED'
      );
    end if;
    update public.player_devices
    set token_hash = normalized_new_device_token_hash,
        status = 'paired'::public.player_device_status,
        revoked_at = null
    where id = installation_record.bound_device_id
      and tenant_id = command_record.tenant_id
      and screen_id = command_record.screen_id;
    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'BOUND_DEVICE_NOT_FOUND'
      );
    end if;
  elsif command_record.command_type = 'FORCE_UNPAIR' then
    update public.player_devices
    set status = 'revoked'::public.player_device_status,
        revoked_at = now()
    where id = installation_record.bound_device_id
      and tenant_id = command_record.tenant_id;
    update public.player_installations
    set bound_device_id = null
    where id = installation_record.id;
  end if;

  update public.player_commands
  set completed_at = now(),
      failure_code = null
  where id = command_record.id;

  perform private.audit_event(
    command_record.tenant_id,
    'player_command.completed',
    'screens',
    command_record.screen_id,
    'success',
    jsonb_build_object(
      'commandId', command_record.id,
      'commandType', command_record.command_type
    )
  );

  return jsonb_build_object(
    'ok', true,
    'alreadyCompleted', false,
    'commandType', command_record.command_type,
    'deviceCredentialRotated',
      command_record.command_type = 'RECOVER_PAIRING'
  );
end;
$$;

create or replace function public.acknowledge_player_command_v1(
  p_installation_credential_hash text,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  authenticated_installation_id uuid;
  command_record public.player_commands%rowtype;
begin
  if normalized_credential_hash is null
    or normalized_credential_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid installation credential hash'
      using errcode = '23514';
  end if;

  select installation.id
  into authenticated_installation_id
  from public.player_installations installation
  where installation.credential_hash = normalized_credential_hash
    and installation.status = 'active';
  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INSTALLATION_CREDENTIAL'
    );
  end if;

  select command.*
  into command_record
  from public.player_commands command
  where command.id = p_command_id
    and command.installation_id = authenticated_installation_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMAND_NOT_FOUND');
  end if;
  if command_record.completed_at is not null then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true);
  end if;
  if command_record.failed_at is not null
    or command_record.expires_at <= now()
  then
    return jsonb_build_object('ok', false, 'code', 'COMMAND_EXPIRED');
  end if;

  update public.player_commands
  set delivered_at = coalesce(delivered_at, now()),
      acknowledged_at = coalesce(acknowledged_at, now())
  where id = command_record.id;

  return jsonb_build_object('ok', true, 'alreadyCompleted', false);
end;
$$;

revoke all on function public.register_player_installation_v1(text, text, text, text)
from public;
revoke all on function public.create_pairing_session_v4(text, text, text, text)
from public;
revoke all on function public.inspect_player_device_credential_v1(text)
from public;
revoke all on function public.unpair_player_installation_v1(text, text)
from public;
revoke all on function public.claim_pairing_session_v4(text, uuid, uuid, text)
from public;
revoke all on function public.queue_player_command_v1(uuid, uuid, text, uuid, integer, jsonb)
from public;
revoke all on function public.poll_player_commands_v1(text)
from public;
revoke all on function public.complete_player_command_v1(text, uuid, text, text)
from public;
revoke all on function public.acknowledge_player_command_v1(text, uuid)
from public;

grant execute on function public.register_player_installation_v1(text, text, text, text)
to anon, authenticated;
grant execute on function public.create_pairing_session_v4(text, text, text, text)
to anon, authenticated;
grant execute on function public.inspect_player_device_credential_v1(text)
to anon, authenticated;
grant execute on function public.unpair_player_installation_v1(text, text)
to anon, authenticated;
grant execute on function public.claim_pairing_session_v4(text, uuid, uuid, text)
to authenticated;
grant execute on function public.queue_player_command_v1(uuid, uuid, text, uuid, integer, jsonb)
to authenticated;
grant execute on function public.poll_player_commands_v1(text)
to anon, authenticated;
grant execute on function public.complete_player_command_v1(text, uuid, text, text)
to anon, authenticated;
grant execute on function public.acknowledge_player_command_v1(text, uuid)
to anon, authenticated;
