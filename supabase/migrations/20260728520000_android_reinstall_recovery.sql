-- S53: recover an official Android Player after app data was removed without
-- turning a public hardware identifier into a screen credential.

alter table public.player_installations
  add column native_recovery_credential_hash text
    check (
      native_recovery_credential_hash is null
      or native_recovery_credential_hash ~ '^[a-f0-9]{64}$'
    ),
  add column native_recovery_platform text
    check (
      native_recovery_platform is null
      or native_recovery_platform = 'android'
    ),
  add column native_recovery_bound_at timestamptz;

create unique index player_installations_native_recovery_credential_uq
  on public.player_installations(native_recovery_credential_hash)
  where native_recovery_credential_hash is not null;

create or replace function public.register_player_installation_v2(
  p_public_identifier_hash text,
  p_new_credential_hash text,
  p_existing_credential_hash text default null,
  p_device_or_pending_token_hash text default null,
  p_native_recovery_credential_hash text default null,
  p_new_device_credential_hash text default null
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
  normalized_native_recovery_hash text :=
    lower(nullif(btrim(p_native_recovery_credential_hash), ''));
  normalized_new_device_hash text :=
    lower(nullif(btrim(p_new_device_credential_hash), ''));
  installation_record public.player_installations%rowtype;
  device_record public.player_devices%rowtype;
  proven_device_id uuid;
  pending_proof boolean := false;
  found_by_native_recovery boolean := false;
  native_recovery_proven boolean := false;
  credential_rotated boolean := false;
  device_credential_rotated boolean := false;
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
    or (
      normalized_native_recovery_hash is not null
      and normalized_native_recovery_hash !~ '^[a-f0-9]{64}$'
    )
    or (
      normalized_new_device_hash is not null
      and normalized_new_device_hash !~ '^[a-f0-9]{64}$'
    )
  then
    raise exception 'invalid installation hashes' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      coalesce(normalized_native_recovery_hash, normalized_identifier_hash),
      53
    )
  );

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.public_identifier_hash = normalized_identifier_hash
  for update;

  if not found and normalized_native_recovery_hash is not null then
    select installation.*
    into installation_record
    from public.player_installations installation
    where installation.native_recovery_credential_hash =
      normalized_native_recovery_hash
    for update;
    found_by_native_recovery := found;
  end if;

  if not found then
    if normalized_existing_credential_hash is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'INSTALLATION_NOT_FOUND'
      );
    end if;

    select device.*
    into device_record
    from public.player_devices device
    where normalized_device_token_hash is not null
      and device.token_hash = normalized_device_token_hash
      and device.status = 'paired'::public.player_device_status
    limit 1;

    insert into public.player_installations (
      public_identifier_hash,
      credential_hash,
      bound_device_id,
      last_seen_at,
      native_recovery_credential_hash,
      native_recovery_platform,
      native_recovery_bound_at
    )
    values (
      normalized_identifier_hash,
      normalized_new_credential_hash,
      device_record.id,
      now(),
      normalized_native_recovery_hash,
      case
        when normalized_native_recovery_hash is not null then 'android'
        else null
      end,
      case
        when normalized_native_recovery_hash is not null then now()
        else null
      end
    )
    returning * into installation_record;

    return jsonb_build_object(
      'ok', true,
      'created', true,
      'credentialRotated', false,
      'deviceCredentialRotated', false,
      'nativeRecovered', false,
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
    select device.*
    into device_record
    from public.player_devices device
    where device.token_hash = normalized_device_token_hash
      and device.status = 'paired'::public.player_device_status
      and (
        installation_record.bound_device_id is null
        or installation_record.bound_device_id = device.id
      )
    limit 1;

    if device_record.id is null then
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

    if device_record.id is null and not pending_proof then
      if normalized_native_recovery_hash is null
        or installation_record.native_recovery_credential_hash
          is distinct from normalized_native_recovery_hash
      then
        return jsonb_build_object(
          'ok', false,
          'code', 'INSTALLATION_CREDENTIAL_REQUIRED'
        );
      end if;
      native_recovery_proven := true;
    else
      proven_device_id := device_record.id;
    end if;
  elsif normalized_native_recovery_hash is not null
    and installation_record.native_recovery_credential_hash =
      normalized_native_recovery_hash
  then
    native_recovery_proven := true;
  else
    return jsonb_build_object(
      'ok', false,
      'code', 'INSTALLATION_CREDENTIAL_REQUIRED'
    );
  end if;

  if normalized_native_recovery_hash is not null
    and (
      installation_record.native_recovery_credential_hash is null
      or normalized_existing_credential_hash = installation_record.credential_hash
      or proven_device_id is not null
    )
  then
    update public.player_installations
    set native_recovery_credential_hash = normalized_native_recovery_hash,
        native_recovery_platform = 'android',
        native_recovery_bound_at = case
          when native_recovery_credential_hash is distinct from
            normalized_native_recovery_hash
          then now()
          else native_recovery_bound_at
        end
    where id = installation_record.id
    returning * into installation_record;
  end if;

  if found_by_native_recovery
    and installation_record.public_identifier_hash <> normalized_identifier_hash
  then
    update public.player_installations
    set public_identifier_hash = normalized_identifier_hash
    where id = installation_record.id
    returning * into installation_record;
  end if;

  if normalized_existing_credential_hash is distinct from
    installation_record.credential_hash
    or native_recovery_proven
  then
    update public.player_installations
    set credential_hash = normalized_new_credential_hash,
        credential_rotated_at = now(),
        bound_device_id = coalesce(proven_device_id, bound_device_id),
        last_seen_at = now()
    where id = installation_record.id
    returning * into installation_record;
    credential_rotated := true;
  end if;

  if native_recovery_proven
    and normalized_new_device_hash is not null
    and installation_record.bound_device_id is not null
  then
    select device.*
    into device_record
    from public.player_devices device
    where device.id = installation_record.bound_device_id
      and device.status = 'paired'::public.player_device_status
    for update;

    if found then
      update public.player_devices
      set token_hash = normalized_new_device_hash
      where id = device_record.id
      returning * into device_record;
      device_credential_rotated := true;

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
        jsonb_build_object(
          'method', 'android_native_reinstall',
          'deviceCredentialRotated', true
        )
      );
      insert into public.audit_events (
        tenant_id,
        actor_device_id,
        action,
        target_type,
        target_id,
        result,
        metadata
      )
      values (
        device_record.tenant_id,
        device_record.id,
        'player_device.native_reinstall_recovered',
        'player_devices',
        device_record.id,
        'success',
        jsonb_build_object(
          'screenId', device_record.screen_id,
          'installationId', installation_record.id
        )
      );
    end if;
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
    'deviceCredentialRotated', device_credential_rotated,
    'nativeRecovered', native_recovery_proven,
    'installationId', installation_record.id,
    'boundDeviceId', case
      when device_credential_rotated or proven_device_id is not null
      then installation_record.bound_device_id
      else null
    end
  );
end;
$$;

revoke all on function public.register_player_installation_v2(
  text,
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.register_player_installation_v2(
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;

-- Recovery can be authenticated with the durable anonymous installation
-- credential as well as with the short-lived pending token. This keeps soft
-- recovery usable after the browser already discarded a corrupt pending
-- pairing token, without exposing installation secrets or screen data.
create or replace function public.recover_player_pairing_v2(
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
    'bindingState', case
      when device_record.id is not null then 'PAIRED'
      else 'UNPAIRED'
    end
  );
end;
$$;

revoke all on function public.recover_player_pairing_v2(
  text,
  text,
  text,
  text
) from public;
grant execute on function public.recover_player_pairing_v2(
  text,
  text,
  text,
  text
) to anon, authenticated;
