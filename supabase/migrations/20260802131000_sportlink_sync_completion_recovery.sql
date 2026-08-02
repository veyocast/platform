-- S86: complete valid Sportlink imports without the PL/pgSQL
-- variable/column ambiguity that previously flattened every successful
-- provider run into SPORTLINK_SYNC_INTERNAL_ERROR.

create or replace function public.complete_sportlink_sync_v1(
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
  standing_item jsonb;
  standing_read_count integer := 0;
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
    if standing_item ->> 'externalId' is null
      or standing_item -> 'pool' ->> 'externalId' is null
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
    )
    values (
      sync_run.tenant_id,
      sync_run.connection_id,
      standing_item ->> 'externalId',
      standing_item -> 'pool' ->> 'externalId',
      nullif(standing_item ->> 'periodNumber', '')::integer,
      coalesce(standing_item -> 'rows', '[]'::jsonb),
      coalesce(
        (standing_item ->> 'scoresPublished')::boolean,
        false
      ),
      now(),
      true
    )
    on conflict (tenant_id, source_connection_id, external_id) do update
    set pool_external_id = excluded.pool_external_id,
        period_number = excluded.period_number,
        rows_json = excluded.rows_json,
        scores_published = excluded.scores_published,
        last_synced_at = now(),
        active = true;

    standing_read_count := standing_read_count + 1;
  end loop;

  update public.sportlink_sync_runs run
  set status = 'succeeded',
      finished_at = now(),
      read_count =
        coalesce((sync_result ->> 'readCount')::integer, 0)
        + standing_read_count
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
      + standing_read_count
  );
end;
$$;

revoke all on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.complete_sportlink_sync_v1(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

-- Requeue only dataset groups that were affected by either fixed defect.
-- Last-known-good normalized data and immutable Player releases are retained.
update public.sportlink_sync_policies policy
set next_sync_at = least(policy.next_sync_at, now())
where policy.enabled
  and exists (
    select 1
    from public.sportlink_sync_runs run
    where run.connection_id = policy.connection_id
      and run.dataset_group = policy.dataset_group
      and run.status = 'failed'
      and run.error_code in (
        'SPORTLINK_SYNC_INTERNAL_ERROR',
        'SPORTLINK_REQUIRED_ARGUMENT_MISSING'
      )
  );
