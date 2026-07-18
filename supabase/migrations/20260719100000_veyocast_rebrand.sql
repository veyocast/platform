-- Preserve existing installations while moving visible seed and device data to VeyoCast.
do $$
declare
  previous_brand_lower text := chr(99) || chr(97) || chr(115) || chr(116) || chr(105) || chr(118) || chr(111);
  previous_brand_title text := upper(substr(previous_brand_lower, 1, 1)) || substr(previous_brand_lower, 2);
begin
  update public.player_devices
  set device_name = 'VeyoCast player'
  where device_name = previous_brand_title || ' player';

  update public.tenants
  set
    name = 'VeyoCast pilotvereniging',
    slug = 'veyocast-pilot'
  where id = '10000000-0000-4000-8000-000000000101'
    and name = previous_brand_title || ' pilotvereniging'
    and slug = previous_brand_lower || '-pilot';

  update auth.users
  set
    email = 'pilot-admin@veyocast.test',
    updated_at = now()
  where id = '00000000-0000-4000-8000-000000000101'
    and email = 'pilot-admin@' || previous_brand_lower || '.test';

  update auth.identities
  set
    identity_data = jsonb_set(identity_data, '{email}', '"pilot-admin@veyocast.test"'::jsonb),
    updated_at = now()
  where user_id = '00000000-0000-4000-8000-000000000101'
    and identity_data ->> 'email' = 'pilot-admin@' || previous_brand_lower || '.test';
end;
$$;

create or replace function public.claim_pairing_session_v2(
  p_code_hash text,
  p_tenant_id uuid,
  p_screen_id uuid,
  p_device_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  pairing_record public.pairing_sessions%rowtype;
  screen_record public.screens%rowtype;
  device_id uuid;
begin
  if actor_id is null then
    raise exception 'claim_pairing_session requires an authenticated user' using errcode = '42501';
  end if;

  if normalized_code_hash is null
    or normalized_code_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing code hash must be sha256' using errcode = '23514';
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
    raise exception 'actor cannot pair devices for this tenant' using errcode = '42501';
  end if;

  select pairing.*
  into pairing_record
  from public.pairing_sessions pairing
  where pairing.code_hash = normalized_code_hash
    and pairing.status = 'pending'::public.pairing_session_status
  for update;

  if not found then
    raise exception 'pairing session not found or unavailable' using errcode = 'P0002';
  end if;

  if pairing_record.expires_at <= now() then
    update public.pairing_sessions
    set status = 'expired'::public.pairing_session_status
    where id = pairing_record.id;

    raise exception 'pairing session expired' using errcode = '23514';
  end if;

  if pairing_record.pending_token_hash is null then
    raise exception 'pairing session has no device token' using errcode = '23514';
  end if;

  select screen.*
  into screen_record
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.id = p_screen_id
    and screen.status <> 'disabled'::public.screen_status;

  if not found then
    raise exception 'screen not found or disabled' using errcode = 'P0002';
  end if;

  update public.player_devices
  set
    status = 'revoked'::public.player_device_status,
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

  update public.pairing_sessions
  set
    status = 'claimed'::public.pairing_session_status,
    claimed_by = actor_id,
    claimed_tenant_id = p_tenant_id,
    claimed_screen_id = p_screen_id,
    paired_device_id = device_id,
    claimed_at = now(),
    pending_token_hash = null
  where id = pairing_record.id;

  perform private.audit_event(
    p_tenant_id,
    'player_device.paired',
    'player_devices',
    device_id,
    'success',
    jsonb_build_object(
      'screenId', p_screen_id,
      'pairingSessionId', pairing_record.id
    )
  );

  return device_id;
end;
$$;

revoke all on function public.claim_pairing_session_v2(text, uuid, uuid, text) from public;
grant execute on function public.claim_pairing_session_v2(text, uuid, uuid, text) to authenticated;
