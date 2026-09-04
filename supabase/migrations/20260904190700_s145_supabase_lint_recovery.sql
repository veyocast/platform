-- S145: repair six stale PL/pgSQL references detected by `supabase db lint`.
--
-- The affected functions predate later authorization helpers and unique-key
-- migrations. Keep their public signatures stable, reassert the intended ACLs,
-- and route legacy RSS snapshot generation through the current revision queue.

create or replace function public.review_data_deletion_v1(
  p_request_id uuid,
  p_decision text,
  p_legal_basis_notes text,
  p_retain_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  request_record public.data_deletion_requests%rowtype;
begin
  perform private.require_platform_owner_aal2();

  select request.*
  into request_record
  from public.data_deletion_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'deletion request not found' using errcode = 'P0002';
  end if;
  if request_record.status not in ('requested', 'legal_review')
    or p_decision not in ('approved', 'blocked', 'cancelled')
    or length(btrim(coalesce(p_legal_basis_notes, ''))) < 10
  then
    raise exception 'deletion review is invalid' using errcode = '23514';
  end if;

  update public.data_deletion_requests
  set
    status = p_decision,
    legal_basis_notes = btrim(p_legal_basis_notes),
    retain_until = p_retain_until,
    reviewed_at = now(),
    reviewed_by = actor_id
  where id = request_record.id;

  perform private.audit_event(
    request_record.tenant_id,
    'data_deletion.reviewed',
    'data_deletion_requests',
    request_record.id,
    'success',
    jsonb_build_object('decision', p_decision)
  );

  return jsonb_build_object('outcome', p_decision);
end;
$$;

create or replace function public.run_retention_maintenance_v1(
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('role', true), 'none'),
    ''
  );
  heartbeat_days integer := private.retention_days('player_heartbeats');
  sync_days integer := private.retention_days('player_sync_events');
  audit_days integer := private.retention_days('audit_events');
  upload_days integer := private.retention_days('abandoned_uploads');
  heartbeat_count bigint := 0;
  sync_count bigint := 0;
  audit_count bigint := 0;
  upload_count bigint := 0;
  result jsonb;
begin
  if caller_role <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if heartbeat_days is not null then
    select count(*)
    into heartbeat_count
    from public.player_heartbeats
    where created_at < now() - make_interval(days => heartbeat_days);
  end if;
  if sync_days is not null then
    select count(*)
    into sync_count
    from public.player_sync_events
    where created_at < now() - make_interval(days => sync_days);
  end if;
  if audit_days is not null then
    select count(*)
    into audit_count
    from public.audit_events
    where created_at < now() - make_interval(days => audit_days);
  end if;
  if upload_days is not null then
    select count(*)
    into upload_count
    from public.media_upload_sessions
    where status in ('pending', 'expired', 'cancelled')
      and expires_at < now() - make_interval(days => upload_days);
  end if;

  if p_apply then
    if heartbeat_days is not null then
      delete from public.player_heartbeats
      where created_at < now() - make_interval(days => heartbeat_days);
    end if;
    if sync_days is not null then
      delete from public.player_sync_events
      where created_at < now() - make_interval(days => sync_days);
    end if;
    if audit_days is not null then
      delete from public.audit_events
      where created_at < now() - make_interval(days => audit_days);
    end if;
    if upload_days is not null then
      delete from public.media_upload_sessions
      where status in ('pending', 'expired', 'cancelled')
        and expires_at < now() - make_interval(days => upload_days);
    end if;
  end if;

  result := jsonb_build_object(
    'applied', p_apply,
    'eligible', jsonb_build_object(
      'playerHeartbeats', heartbeat_count,
      'playerSyncEvents', sync_count,
      'auditEvents', audit_count,
      'abandonedUploads', upload_count
    ),
    'blockedPendingLegalPolicy', jsonb_build_array(
      'deleted_media', 'support_tickets'
    )
  );

  insert into public.retention_runs (apply_changes, initiated_by, result)
  values (p_apply, 'scheduled_worker', result);

  return result;
end;
$$;

create or replace function public.create_platform_support_role_v1(
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
  role_id uuid;
begin
  perform private.require_platform_owner_aal2();

  if length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or not coalesce(p_capabilities, '{}'::text[]) <@ array[
      'platform.ticket.read',
      'platform.ticket.write',
      'platform.ticket.sensitive',
      'platform.ticket.admin'
    ]::text[]
  then
    raise exception 'platform support role is invalid' using errcode = '23514';
  end if;

  insert into public.platform_custom_roles (
    name,
    description,
    capabilities,
    created_by
  ) values (
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    array(select distinct unnest(coalesce(p_capabilities, '{}'::text[]))),
    private.current_user_id()
  )
  returning id into role_id;

  return role_id;
end;
$$;

create or replace function public.assign_platform_support_role_v1(
  p_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_owner_aal2();

  if not exists (
    select 1
    from public.platform_memberships
    where user_id = p_user_id
  ) or not exists (
    select 1
    from public.platform_custom_roles
    where id = p_role_id
      and active
  ) then
    raise exception 'support role assignment is invalid' using errcode = '23514';
  end if;

  insert into public.platform_custom_role_assignments (
    user_id,
    role_id,
    assigned_by
  ) values (
    p_user_id,
    p_role_id,
    private.current_user_id()
  )
  on conflict (user_id) do update
  set role_id = excluded.role_id,
      assigned_by = excluded.assigned_by,
      assigned_at = now();
end;
$$;

create or replace function public.complete_scheduled_rss_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_articles jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record public.dynamic_sync_runs%rowtype;
  source_record public.dynamic_data_sources%rowtype;
  article jsonb;
  imported_count integer := 0;
begin
  select *
  into run_record
  from public.dynamic_sync_runs
  where id = p_run_id
    and status = 'running'
  for update;

  if not found then
    raise exception 'RSS sync run not found' using errcode = 'P0002';
  end if;

  select *
  into source_record
  from public.dynamic_data_sources
  where id = run_record.data_source_id
    and provider_status = 'syncing'
    and sync_locked_by = left(p_worker_id, 120)
  for update;

  if not found then
    raise exception 'RSS sync lease lost' using errcode = '55000';
  end if;

  if coalesce(jsonb_typeof(p_articles), 'null') <> 'array'
    or jsonb_array_length(p_articles) > 50
  then
    raise exception 'invalid RSS payload' using errcode = '22023';
  end if;

  for article in
    select value
    from jsonb_array_elements(p_articles)
  loop
    if length(btrim(article ->> 'title')) not between 1 and 160
      or length(coalesce(article ->> 'externalId', '')) not between 1 and 512
      or coalesce(article ->> 'link', '') !~ '^https?://'
    then
      raise exception 'invalid normalized RSS article' using errcode = '22023';
    end if;

    insert into public.dynamic_news_articles(
      tenant_id,
      data_source_id,
      external_id,
      title,
      intro,
      author,
      source_name,
      link,
      published_at,
      content_hash,
      raw_reference
    ) values (
      source_record.tenant_id,
      source_record.id,
      article ->> 'externalId',
      btrim(article ->> 'title'),
      nullif(left(article ->> 'intro', 4000), ''),
      nullif(left(article ->> 'author', 160), ''),
      left(article ->> 'sourceName', 160),
      article ->> 'link',
      nullif(article ->> 'publishedAt', '')::timestamptz,
      encode(
        extensions.digest(
          pg_catalog.convert_to(article::text, 'UTF8'),
          'sha256'
        ),
        'hex'
      ),
      jsonb_build_object(
        'syncRunId', run_record.id,
        'scheduled', true
      )
    )
    on conflict (tenant_id, data_source_id, external_id) do update
    set title = excluded.title,
        intro = excluded.intro,
        author = excluded.author,
        source_name = excluded.source_name,
        link = excluded.link,
        published_at = excluded.published_at,
        content_hash = excluded.content_hash,
        raw_reference = excluded.raw_reference;

    imported_count := imported_count + 1;
  end loop;

  update public.dynamic_sync_runs
  set status = 'succeeded',
      item_count = imported_count,
      finished_at = now()
  where id = run_record.id;

  update public.dynamic_data_sources
  set provider_status = 'ready',
      last_successful_sync_at = now(),
      last_error_code = null,
      last_error_detail = null,
      next_sync_at = now() + make_interval(
        mins => least(
          greatest(
            coalesce((config_json ->> 'refreshMinutes')::integer, 15),
            5
          ),
          1440
        )
      ),
      sync_locked_at = null,
      sync_locked_by = null,
      revision = revision + 1
  where id = source_record.id;

  -- Advancing the source revision invokes the current version-aware snapshot
  -- queue. The stale inline snapshot loop that used the retired three-column
  -- conflict target is intentionally not repeated here.
  insert into public.audit_events(
    tenant_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) values (
    source_record.tenant_id,
    'dynamic.data_source.scheduled_sync',
    'dynamic_data_sources',
    source_record.id,
    'success',
    jsonb_build_object(
      'systemExecuted', true,
      'syncRunId', run_record.id,
      'itemCount', imported_count
    )
  );

  return imported_count;
end;
$$;

create or replace function public.complete_sportlink_sync_before_standing_history_v1(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_activities jsonb default '[]'::jsonb,
  p_standings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  sync_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_standings), 'null') <> 'array'
    or jsonb_array_length(p_standings) <> 0
  then
    raise exception 'legacy_sportlink_completion_requires_empty_standings'
      using errcode = '22023';
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

  update public.sportlink_sync_runs run
  set status = 'succeeded',
      finished_at = now(),
      read_count = coalesce((sync_result ->> 'readCount')::integer, 0)
  where run.id = sync_run.id;

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
    ('club_profile', 'clubgegevens', 'club'),
    ('club_profile', 'clublogo', 'club_logo'),
    ('teams', 'teams', 'teams'),
    ('matches', 'programma', 'program'),
    ('matches', 'uitslagen', 'results'),
    ('matches', 'afgelastingen', 'cancellations'),
    ('match_details', 'wedstrijd-informatie', 'match_information'),
    ('competitions', 'poulestand', 'standings'),
    ('activities', 'verenigingsactiviteiten', 'activities')
  ) as detected(dataset_group, article_key, capability)
  where detected.dataset_group = sync_run.dataset_group
  on conflict (tenant_id, connection_id, article_key) do update
  set available = true,
      enabled = true,
      last_checked_at = now(),
      last_status_code = 200;

  update public.sportlink_sync_policies policy
  set last_success_at = now()
  where policy.connection_id = sync_run.connection_id
    and policy.dataset_group = sync_run.dataset_group;

  update public.sportlink_connections connection
  set last_duration_ms = greatest(
    0,
    floor(
      extract(epoch from (now() - sync_run.started_at)) * 1000
    )::integer
  )
  where connection.id = sync_run.connection_id;

  perform private.audit_event(
    sync_run.tenant_id,
    'sportlink.sync.succeeded',
    'sportlink_sync_runs',
    sync_run.id,
    'success',
    jsonb_build_object('datasetGroup', sync_run.dataset_group)
  );

  return jsonb_build_object(
    'outcome',
    'succeeded',
    'readCount',
    coalesce((sync_result ->> 'readCount')::integer, 0)
  );
end;
$$;

revoke all on function public.review_data_deletion_v1(
  uuid,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.review_data_deletion_v1(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

revoke all on function public.run_retention_maintenance_v1(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.run_retention_maintenance_v1(boolean)
  to service_role;

revoke all on function public.create_platform_support_role_v1(
  text,
  text,
  text[]
) from public, anon, authenticated, service_role;
grant execute on function public.create_platform_support_role_v1(
  text,
  text,
  text[]
) to authenticated;

revoke all on function public.assign_platform_support_role_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.assign_platform_support_role_v1(uuid, uuid)
  to authenticated;

revoke all on function public.complete_scheduled_rss_sync_v1(
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.complete_scheduled_rss_sync_v1(
  uuid,
  text,
  jsonb
) to service_role;

revoke all on function public.complete_sportlink_sync_before_standing_history_v1(
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
