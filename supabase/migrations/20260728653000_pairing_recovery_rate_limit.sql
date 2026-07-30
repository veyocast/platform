-- S60: let a credential-authenticated recovery escape a self-inflicted
-- per-installation pairing limit exactly once, while global abuse protection
-- continues to count every created pairing session.

create table private.pairing_recovery_grants (
  id bigint generated always as identity primary key,
  installation_id uuid not null
    references public.player_installations(id)
    on delete cascade,
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  check (consumed_at is null or consumed_at >= granted_at)
);

create unique index pairing_recovery_grants_one_open_uq
  on private.pairing_recovery_grants(installation_id)
  where consumed_at is null;
create index pairing_recovery_grants_time_idx
  on private.pairing_recovery_grants(granted_at desc);

revoke all on private.pairing_recovery_grants
from public, anon, authenticated;

create or replace function public.recover_player_pairing_v3(
  p_installation_id_hash text,
  p_pending_token_hash text default null,
  p_installation_credential_hash text default null,
  p_recovery_mode text default 'soft'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_installation_hash text :=
    lower(nullif(btrim(p_installation_id_hash), ''));
  normalized_pending_hash text :=
    lower(nullif(btrim(p_pending_token_hash), ''));
  normalized_credential_hash text :=
    lower(nullif(btrim(p_installation_credential_hash), ''));
  normalized_mode text := lower(nullif(btrim(p_recovery_mode), ''));
  installation_record public.player_installations%rowtype;
  pairing_record public.pairing_sessions%rowtype;
  device_record public.player_devices%rowtype;
  credential_proven boolean := false;
  pending_proven boolean := false;
  cancelled_count integer := 0;
  retry_grant_count integer := 0;
begin
  if normalized_installation_hash is null
    or normalized_installation_hash !~ '^[a-f0-9]{64}$'
    or (
      normalized_pending_hash is not null
      and normalized_pending_hash !~ '^[a-f0-9]{64}$'
    )
    or (
      normalized_credential_hash is not null
      and normalized_credential_hash !~ '^[a-f0-9]{64}$'
    )
    or (
      normalized_pending_hash is null
      and normalized_credential_hash is null
    )
    or normalized_mode not in ('soft', 'hard')
  then
    raise exception 'invalid pairing recovery input' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_installation_hash, 53)
  );

  if normalized_credential_hash is not null then
    select installation.*
    into installation_record
    from public.player_installations installation
    where installation.public_identifier_hash = normalized_installation_hash
      and installation.credential_hash = normalized_credential_hash
      and installation.status = 'active'
    for update;
    credential_proven := found;
  end if;

  if not credential_proven and normalized_pending_hash is not null then
    select installation.*
    into installation_record
    from public.player_installations installation
    join public.pairing_sessions pairing
      on pairing.installation_id = installation.id
    where installation.public_identifier_hash = normalized_installation_hash
      and installation.status = 'active'
      and pairing.pending_token_hash = normalized_pending_hash
      and pairing.status = 'pending'::public.pairing_session_status
    limit 1
    for update of installation;
    pending_proven := found;
  end if;

  if not credential_proven and not pending_proven then
    return jsonb_build_object(
      'ok', false,
      'code', 'RECOVERY_CREDENTIAL_INVALID'
    );
  end if;

  for pairing_record in
    update public.pairing_sessions pairing
    set status = 'cancelled'::public.pairing_session_status
    where pairing.installation_id = installation_record.id
      and pairing.status = 'pending'::public.pairing_session_status
      and (
        credential_proven
        or pairing.pending_token_hash = normalized_pending_hash
      )
    returning pairing.*
  loop
    cancelled_count := cancelled_count + 1;
    insert into private.player_pairing_events (
      installation_id,
      pairing_session_id,
      event_type,
      detail
    )
    values (
      installation_record.id,
      pairing_record.id,
      'recover',
      jsonb_build_object(
        'mode', normalized_mode,
        'proof', case
          when credential_proven then 'installation_credential'
          else 'pending_credential'
        end
      )
    );
  end loop;

  if cancelled_count > 0 then
    insert into private.player_pairing_recovery_events (
      installation_id_hash,
      recovery_mode,
      event_type
    )
    values (
      normalized_installation_hash,
      normalized_mode,
      'pending_pairing.cancelled'
    );
  end if;

  delete from private.pairing_recovery_grants
  where granted_at < now() - interval '1 day'
    or (
      consumed_at is null
      and granted_at < now() - interval '10 minutes'
    );

  insert into private.pairing_recovery_grants(installation_id)
  select installation_record.id
  where not exists (
    select 1
    from private.pairing_recovery_grants recovery_grant
    where recovery_grant.installation_id = installation_record.id
      and recovery_grant.granted_at >= now() - interval '10 minutes'
  );
  get diagnostics retry_grant_count = row_count;

  if retry_grant_count > 0 then
    insert into private.player_pairing_events (
      installation_id,
      event_type,
      detail
    )
    values (
      installation_record.id,
      'recover',
      jsonb_build_object(
        'mode', normalized_mode,
        'proof', case
          when credential_proven then 'installation_credential'
          else 'pending_credential'
        end,
        'reason', 'pairing_rate_limit_relief'
      )
    );
  end if;

  select device.*
  into device_record
  from public.player_devices device
  where device.id = installation_record.bound_device_id
    and device.status = 'paired'::public.player_device_status;

  update public.player_installations
  set last_seen_at = now()
  where id = installation_record.id;

  return jsonb_build_object(
    'ok', true,
    'cancelledPendingPairing', cancelled_count > 0,
    'retryGrantCreated', retry_grant_count > 0,
    'bindingState', case
      when device_record.id is not null then 'PAIRED'
      else 'UNPAIRED'
    end
  );
end;
$$;

revoke all on function public.recover_player_pairing_v3(
  text,
  text,
  text,
  text
) from public;
grant execute on function public.recover_player_pairing_v3(
  text,
  text,
  text,
  text
) to anon, authenticated;

create or replace function public.create_pairing_session_v5(
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
  recovery_grant_id bigint;
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
  delete from private.pairing_recovery_grants
  where granted_at < now() - interval '1 day'
    or (
      consumed_at is null
      and granted_at < now() - interval '10 minutes'
    );

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

  if installation_attempts >= 5 and global_attempts < 300 then
    select recovery_grant.id
    into recovery_grant_id
    from private.pairing_recovery_grants recovery_grant
    where recovery_grant.installation_id = installation_record.id
      and recovery_grant.consumed_at is null
      and recovery_grant.granted_at >= now() - interval '10 minutes'
    order by recovery_grant.granted_at
    limit 1
    for update;
  end if;

  if (
    installation_attempts >= 5
    and recovery_grant_id is null
  ) or global_attempts >= 300 then
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

  if recovery_grant_id is not null then
    update private.pairing_recovery_grants
    set consumed_at = now()
    where id = recovery_grant_id;
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
    'recoveryReliefUsed', recovery_grant_id is not null,
    'pairingSessionId', pairing_record.id,
    'expiresAt', pairing_record.expires_at
  );
end;
$$;

revoke all on function public.create_pairing_session_v5(
  text,
  text,
  text,
  text
) from public;
grant execute on function public.create_pairing_session_v5(
  text,
  text,
  text,
  text
) to anon, authenticated;
