-- Keep long-running Sportlink imports alive and immediately recover a dataset
-- after a worker process really disappeared. Last-known-good provider data is
-- never removed by lease recovery.

create or replace function public.renew_sportlink_sync_lease_v1(
  p_run_id uuid,
  p_worker_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  renewed boolean := false;
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if normalized_worker_id is null
    or normalized_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$'
  then
    raise exception 'sportlink_worker_arguments_invalid' using errcode = '22023';
  end if;

  update public.sportlink_sync_runs
  set locked_at = now()
  where id = p_run_id
    and status = 'running'
    and worker_id = normalized_worker_id;

  renewed := found;
  return renewed;
end
$$;

create or replace function public.claim_due_sportlink_sync_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 900
) returns table (
  run_id uuid,
  tenant_id uuid,
  connection_id uuid,
  data_source_id uuid,
  dataset_group text,
  encrypted_client_id text,
  encryption_iv text,
  encryption_tag text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_policy public.sportlink_sync_policies%rowtype;
  claimed_connection public.sportlink_connections%rowtype;
  claimed_run_id uuid;
  expired_run public.sportlink_sync_runs%rowtype;
  normalized_worker_id text := nullif(btrim(p_worker_id), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if normalized_worker_id is null
    or normalized_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$'
    or p_lock_timeout_seconds not between 60 and 3600
  then
    raise exception 'sportlink_worker_arguments_invalid' using errcode = '22023';
  end if;

  for expired_run in
    select run.*
    from public.sportlink_sync_runs run
    where run.status = 'running'
      and run.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
    order by run.locked_at
    for update skip locked
  loop
    update public.sportlink_sync_runs
    set status = 'failed',
        finished_at = now(),
        error_code = 'SPORTLINK_WORKER_LEASE_EXPIRED',
        error_detail = 'De vorige synchronisatielease is verlopen; de dataset is opnieuw ingepland.'
    where id = expired_run.id;

    insert into public.sportlink_sync_errors (
      tenant_id,
      sync_run_id,
      article_key,
      error_code,
      safe_message
    ) values (
      expired_run.tenant_id,
      expired_run.id,
      expired_run.dataset_group,
      'SPORTLINK_WORKER_LEASE_EXPIRED',
      'De synchronisatieworker is onderbroken. De dataset wordt automatisch opnieuw geprobeerd.'
    );

    update public.sportlink_connections
    set last_error_code = 'SPORTLINK_WORKER_LEASE_EXPIRED',
        stale_after = coalesce(stale_after, now() + interval '24 hours')
    where id = expired_run.connection_id;

    update public.dynamic_data_sources
    set provider_status = 'error',
        last_attempt_at = now(),
        last_error_code = 'sportlink_worker_lease_expired'
    where id = (
      select connection.data_source_id
      from public.sportlink_connections connection
      where connection.id = expired_run.connection_id
    );

    update public.sportlink_sync_policies policy
    set next_sync_at = least(next_sync_at, now())
    where policy.connection_id = expired_run.connection_id
      and policy.dataset_group = expired_run.dataset_group;

    perform private.audit_event(
      expired_run.tenant_id,
      'sportlink.sync.lease_expired',
      'sportlink_sync_runs',
      expired_run.id,
      'failed',
      jsonb_build_object(
        'datasetGroup', expired_run.dataset_group,
        'errorCode', 'SPORTLINK_WORKER_LEASE_EXPIRED',
        'retryScheduled', true
      )
    );
  end loop;

  select policy.*
  into claimed_policy
  from public.sportlink_sync_policies policy
  join public.sportlink_connections connection
    on connection.id = policy.connection_id
   and connection.tenant_id = policy.tenant_id
  where policy.enabled
    and policy.next_sync_at <= now()
    and connection.status = 'active'
    and not exists (
      select 1
      from public.sportlink_sync_runs running
      where running.connection_id = policy.connection_id
        and running.dataset_group = policy.dataset_group
        and running.status = 'running'
    )
  order by policy.next_sync_at, policy.id
  for update of policy skip locked
  limit 1;

  if claimed_policy.id is null then
    return;
  end if;

  select *
  into claimed_connection
  from public.sportlink_connections
  where id = claimed_policy.connection_id
  for update;

  insert into public.sportlink_sync_runs (
    tenant_id,
    connection_id,
    dataset_group,
    status,
    worker_id,
    locked_at,
    started_at
  ) values (
    claimed_policy.tenant_id,
    claimed_policy.connection_id,
    claimed_policy.dataset_group,
    'running',
    normalized_worker_id,
    now(),
    now()
  )
  returning id into claimed_run_id;

  update public.sportlink_sync_policies
  set last_attempt_at = now(),
      next_sync_at = private.sportlink_next_sync_at(frequency, now())
  where id = claimed_policy.id;

  update public.sportlink_connections
  set last_attempt_at = now()
  where id = claimed_connection.id;

  return query
  select
    claimed_run_id,
    claimed_connection.tenant_id,
    claimed_connection.id,
    claimed_connection.data_source_id,
    claimed_policy.dataset_group,
    claimed_connection.encrypted_client_id,
    claimed_connection.encryption_iv,
    claimed_connection.encryption_tag;
end
$$;

create or replace function public.fail_sportlink_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_detail text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  safe_error_code text := left(
    coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'),
    80
  );
  safe_error_detail text := left(
    regexp_replace(
      coalesce(nullif(p_error_detail, ''), 'Sportlink is tijdelijk niet beschikbaar.'),
      E'[\\r\\n]+',
      ' ',
      'g'
    ),
    500
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select *
  into sync_run
  from public.sportlink_sync_runs
  where id = p_run_id
  for update;

  if sync_run.id is null then
    raise exception 'sportlink_sync_run_not_found' using errcode = 'P0002';
  end if;
  if sync_run.status <> 'running'
    or sync_run.worker_id is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'sportlink_sync_lease_not_owned' using errcode = '42501';
  end if;

  update public.sportlink_sync_runs
  set status = 'failed',
      finished_at = now(),
      error_code = safe_error_code,
      error_detail = safe_error_detail
  where id = sync_run.id;

  insert into public.sportlink_sync_errors (
    tenant_id,
    sync_run_id,
    article_key,
    error_code,
    safe_message
  ) values (
    sync_run.tenant_id,
    sync_run.id,
    sync_run.dataset_group,
    safe_error_code,
    safe_error_detail
  );

  update public.sportlink_connections
  set last_error_code = safe_error_code,
      stale_after = coalesce(stale_after, now() + interval '24 hours')
  where id = sync_run.connection_id;

  update public.dynamic_data_sources
  set provider_status = 'error',
      last_attempt_at = now(),
      last_error_code = lower(safe_error_code)
  where id = (
    select data_source_id
    from public.sportlink_connections
    where id = sync_run.connection_id
  );

  update public.sportlink_sync_policies
  set next_sync_at = least(next_sync_at, now() + interval '15 minutes')
  where connection_id = sync_run.connection_id
    and dataset_group = sync_run.dataset_group;

  perform private.audit_event(
    sync_run.tenant_id,
    'sportlink.sync.failed',
    'sportlink_sync_runs',
    sync_run.id,
    'failed',
    jsonb_build_object(
      'datasetGroup', sync_run.dataset_group,
      'errorCode', safe_error_code
    )
  );
end
$$;

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
  actor_device_id uuid;
  command_id uuid;
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  event_id uuid;
begin
  if coalesce(auth.role(), '') = 'service_role'
    and (
      (
        p_action in (
          'sportlink.sync.completed',
          'sportlink.sync.succeeded'
        )
        and p_result = 'success'
      )
      or (
        p_action in (
          'sportlink.sync.failed',
          'sportlink.sync.lease_expired'
        )
        and p_result = 'failed'
      )
    )
    and (
      (p_action = 'sportlink.sync.completed'
        and p_target_type = 'sportlink_connections')
      or (p_action <> 'sportlink.sync.completed'
        and p_target_type = 'sportlink_sync_runs')
    )
    and p_tenant_id is not null
    and p_target_id is not null
  then
    actor_id := null;
    actor_device_id := null;
  elsif actor_id is null then
    if p_action in (
      'player_command.delivered',
      'player_command.expired',
      'player_command.failed',
      'player_command.completed'
    ) then
      if p_target_type <> 'screens'
        or coalesce(normalized_metadata ->> 'commandId', '') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'device audit command context is invalid'
          using errcode = '42501';
      end if;
      command_id := (normalized_metadata ->> 'commandId')::uuid;
      select command.device_id
      into actor_device_id
      from public.player_commands command
      where command.id = command_id
        and command.tenant_id = p_tenant_id
        and command.screen_id is not distinct from p_target_id;
    elsif p_action = 'player_device.self_unpaired'
      and p_target_type = 'player_devices'
      and p_target_id is not null
    then
      select device.id
      into actor_device_id
      from public.player_devices device
      where device.id = p_target_id
        and device.tenant_id = p_tenant_id;
    else
      raise exception 'audit_event requires an authenticated actor'
        using errcode = '42501';
    end if;

    if actor_device_id is null then
      raise exception 'device audit actor could not be verified'
        using errcode = '42501';
    end if;
  elsif p_tenant_id is not null
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
    actor_device_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  values (
    p_tenant_id,
    actor_id,
    actor_device_id,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_result, 'success'),
    normalized_metadata
  )
  returning id into event_id;

  return event_id;
end
$$;

revoke all on function public.renew_sportlink_sync_lease_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.renew_sportlink_sync_lease_v1(uuid, text)
  to service_role;
