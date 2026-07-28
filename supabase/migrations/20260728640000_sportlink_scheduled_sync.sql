-- Lease-based Sportlink dispatcher for the existing media-worker. Provider
-- failures never delete the last successfully normalized tenant dataset.

create or replace function private.sportlink_next_sync_at(
  p_frequency text,
  p_from timestamptz default now()
) returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'hourly' then p_from + interval '1 hour'
    when 'daily' then p_from + interval '1 day'
    when 'weekly' then p_from + interval '7 days'
    when 'monthly' then p_from + interval '1 month'
    else p_from + interval '1 day'
  end
$$;

-- Person and volunteer feeds require a separate, explicit privacy opt-in.
-- They are present in the provider registry, but are not scheduled by default.
update public.sportlink_sync_policies
set enabled = false
where dataset_group in ('public_people', 'volunteers');

create policy sportlink_connections_platform_read
on public.sportlink_connections
for select
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support',
    'platform_viewer'
  ]::public.platform_role[])
);

create policy sportlink_sync_policies_platform_read
on public.sportlink_sync_policies
for select
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support',
    'platform_viewer'
  ]::public.platform_role[])
);

create policy sportlink_sync_runs_platform_read
on public.sportlink_sync_runs
for select
to authenticated
using (
  private.is_platform_member(array[
    'platform_owner',
    'platform_admin',
    'platform_support',
    'platform_viewer'
  ]::public.platform_role[])
);

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

  update public.sportlink_sync_runs
  set status = 'failed',
      finished_at = now(),
      error_code = 'SPORTLINK_WORKER_LEASE_EXPIRED',
      error_detail = 'De vorige synchronisatielease is verlopen.'
  where status = 'running'
    and locked_at < now() - make_interval(secs => p_lock_timeout_seconds);

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

create or replace function public.complete_sportlink_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_activities jsonb default '[]'::jsonb,
  p_standings jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  sync_result jsonb;
  standing_item jsonb;
  read_count integer := 0;
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

  sync_result := public.record_sportlink_sync_v1(
    sync_run.connection_id,
    coalesce(p_club, '{}'::jsonb),
    coalesce(p_teams, '[]'::jsonb),
    coalesce(p_matches, '[]'::jsonb),
    coalesce(p_activities, '[]'::jsonb)
  );

  for standing_item in
    select value
    from jsonb_array_elements(coalesce(p_standings, '[]'::jsonb))
  loop
    if standing_item->>'externalId' is null
      or standing_item->'pool'->>'externalId' is null
    then
      continue;
    end if;
    insert into public.sports_standings (
      tenant_id,
      source_connection_id,
      external_id,
      pool_external_id,
      period_number,
      rows_json,
      scores_published,
      last_synced_at,
      active
    ) values (
      sync_run.tenant_id,
      sync_run.connection_id,
      standing_item->>'externalId',
      standing_item->'pool'->>'externalId',
      nullif(standing_item->>'periodNumber', '')::integer,
      coalesce(standing_item->'rows', '[]'::jsonb),
      coalesce((standing_item->>'scoresPublished')::boolean, false),
      now(),
      true
    )
    on conflict (tenant_id, source_connection_id, external_id) do update set
      pool_external_id = excluded.pool_external_id,
      period_number = excluded.period_number,
      rows_json = excluded.rows_json,
      scores_published = excluded.scores_published,
      last_synced_at = now(),
      active = true;
    read_count := read_count + 1;
  end loop;

  update public.sportlink_sync_runs
  set status = 'succeeded',
      finished_at = now(),
      read_count = coalesce((sync_result->>'readCount')::integer, 0) + read_count
  where id = sync_run.id;

  insert into public.sportlink_capabilities (
    tenant_id,
    connection_id,
    article_key,
    capability,
    sensitivity,
    available,
    enabled,
    last_checked_at,
    last_status_code
  )
  select
    sync_run.tenant_id,
    sync_run.connection_id,
    detected.article_key,
    detected.capability,
    'public',
    true,
    true,
    now(),
    200
  from (values
    ('club_profile','clubgegevens','club'),
    ('club_profile','clublogo','club_logo'),
    ('teams','teams','teams'),
    ('matches','programma','program'),
    ('matches','uitslagen','results'),
    ('matches','afgelastingen','cancellations'),
    ('match_details','wedstrijd-informatie','match_information'),
    ('competitions','poulestand','standings'),
    ('activities','verenigingsactiviteiten','activities')
  ) as detected(dataset_group,article_key,capability)
  where detected.dataset_group=sync_run.dataset_group
  on conflict (tenant_id,connection_id,article_key) do update set
    available=true,
    enabled=true,
    last_checked_at=now(),
    last_status_code=200;

  update public.sportlink_sync_policies
  set last_success_at = now()
  where connection_id = sync_run.connection_id
    and dataset_group = sync_run.dataset_group;

  update public.sportlink_connections
  set last_duration_ms=greatest(
    0,
    floor(extract(epoch from (now()-sync_run.started_at))*1000)::integer
  )
  where id=sync_run.connection_id;

  perform private.audit_event(
    sync_run.tenant_id,
    'sportlink.sync.succeeded',
    'sportlink_sync_runs',
    sync_run.id,
    'success',
    jsonb_build_object('datasetGroup', sync_run.dataset_group)
  );

  return jsonb_build_object(
    'outcome', 'succeeded',
    'readCount', coalesce((sync_result->>'readCount')::integer, 0) + read_count
  );
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
      error_code = left(coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'), 80),
      error_detail = left(
        regexp_replace(
          coalesce(nullif(p_error_detail, ''), 'Sportlink is tijdelijk niet beschikbaar.'),
          E'[\\r\\n]+',
          ' ',
          'g'
        ),
        500
      )
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
    left(coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'), 80),
    left(
      regexp_replace(
        coalesce(nullif(p_error_detail, ''), 'Sportlink is tijdelijk niet beschikbaar.'),
        E'[\\r\\n]+',
        ' ',
        'g'
      ),
      500
    )
  );

  update public.sportlink_connections
  set last_error_code = left(coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'), 80),
      stale_after = coalesce(stale_after, now() + interval '24 hours')
  where id = sync_run.connection_id;

  update public.dynamic_data_sources
  set provider_status = 'error',
      last_attempt_at = now(),
      last_error_code = left(coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'), 80)
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
    'failure',
    jsonb_build_object(
      'datasetGroup', sync_run.dataset_group,
      'errorCode', left(coalesce(nullif(p_error_code, ''), 'SPORTLINK_SYNC_FAILED'), 80)
    )
  );
end
$$;

revoke all on function public.claim_due_sportlink_sync_v1(text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.fail_sportlink_sync_v1(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_due_sportlink_sync_v1(text, integer)
  to service_role;
grant execute on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.fail_sportlink_sync_v1(uuid, text, text, text)
  to service_role;

grant execute on function public.record_sportlink_sync_v1(
  uuid, jsonb, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.update_sportlink_sync_policy_v1(
  p_connection_id uuid,
  p_dataset_group text,
  p_frequency text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select *
  into connection
  from public.sportlink_connections
  where id = p_connection_id;

  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id,
    'tenant.data_source.manage'
  ) and not private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'sportlink_policy_manage_required' using errcode = '42501';
  end if;
  if p_frequency not in ('hourly', 'daily', 'weekly', 'monthly') then
    raise exception 'sportlink_frequency_invalid' using errcode = '22023';
  end if;
  if p_dataset_group not in (
    'club_profile',
    'teams',
    'competitions',
    'matches',
    'match_details',
    'activities',
    'public_people',
    'volunteers'
  ) then
    raise exception 'sportlink_dataset_group_invalid' using errcode = '22023';
  end if;
  if p_enabled
    and p_dataset_group = 'public_people'
    and not connection.privacy_people_enabled
  then
    raise exception 'sportlink_privacy_opt_in_required' using errcode = '42501';
  end if;
  if p_enabled
    and p_dataset_group = 'volunteers'
    and not connection.privacy_people_enabled
  then
    raise exception 'sportlink_privacy_opt_in_required' using errcode = '42501';
  end if;

  update public.sportlink_sync_policies
  set frequency = p_frequency,
      enabled = p_enabled,
      next_sync_at = case
        when p_enabled then least(next_sync_at, now())
        else next_sync_at
      end
  where connection_id = connection.id
    and dataset_group = p_dataset_group;

  perform private.audit_event(
    connection.tenant_id,
    'sportlink.sync_policy.updated',
    'sportlink_connections',
    connection.id,
    'success',
    jsonb_build_object(
      'datasetGroup',
      p_dataset_group,
      'frequency',
      p_frequency,
      'enabled',
      p_enabled
    )
  );
end
$$;

create or replace function public.request_sportlink_sync_v1(
  p_connection_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select *
  into connection
  from public.sportlink_connections
  where id = p_connection_id;

  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id,
    'tenant.data_source.manage'
  ) and not private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'sportlink_sync_manage_required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.sportlink_sync_policies
    where connection_id = connection.id
      and manual_cooldown_until > now()
  ) then
    raise exception 'sportlink_manual_sync_cooldown' using errcode = '55000';
  end if;

  update public.sportlink_sync_policies
  set next_sync_at = now(),
      manual_cooldown_until = now() + interval '15 minutes'
  where connection_id = connection.id
    and enabled;

  update public.sportlink_connections
  set next_sync_at = now()
  where id = connection.id;

  perform private.audit_event(
    connection.tenant_id,
    'sportlink.sync.requested',
    'sportlink_connections',
    connection.id,
    'success',
    jsonb_build_object('source', 'manual')
  );
end
$$;

revoke all on function public.update_sportlink_sync_policy_v1(
  uuid, text, text, boolean
) from public, anon;
revoke all on function public.request_sportlink_sync_v1(uuid)
  from public, anon;
grant execute on function public.update_sportlink_sync_policy_v1(
  uuid, text, text, boolean
) to authenticated;
grant execute on function public.request_sportlink_sync_v1(uuid)
  to authenticated;
