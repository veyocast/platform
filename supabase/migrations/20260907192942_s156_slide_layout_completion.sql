-- S156: complete the structured match payload used by the two-line match rows
-- and visitor welcome cards. Historical snapshots and releases remain
-- immutable; the existing audited corrective queues create successors for the
-- exact currently published latest-mode versions.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s156_slide_layout_completion;

create function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  blueprint text := p_slide.configuration_json ->> 'blueprintKey';
  enriched_items jsonb;
  result jsonb;
begin
  result :=
    private.build_dynamic_snapshot_data_before_s156_slide_layout_completion(
      p_slide
    );

  if p_slide.slide_type = 'sport_visitor_arrivals' then
    with source_items as (
      select item.value as item, item.ordinality
      from pg_catalog.jsonb_array_elements(
        coalesce(result #> '{sport,items}', '[]'::jsonb)
      ) with ordinality item(value, ordinality)
    ), matched_items as (
      select
        source_items.item,
        source_items.ordinality,
        coalesce(
          fixture.home_team_name,
          source_items.item ->> 'homeTeam'
        ) as home_team_name,
        coalesce(
          fixture.officials,
          source_items.item -> 'officials',
          '[]'::jsonb
        ) as officials
      from source_items
      left join lateral (
        select
          coalesce(
            nullif(pg_catalog.btrim(tenant_home_team.name), ''),
            candidate.home_team ->> 'name',
            ''
          ) as home_team_name,
          coalesce(candidate.officials, '[]'::jsonb) as officials
        from public.sports_matches candidate
        join public.sportlink_connections connection
          on connection.tenant_id = candidate.tenant_id
         and connection.id = candidate.source_connection_id
         and connection.data_source_id = p_slide.data_source_id
        left join public.sports_teams tenant_home_team
          on tenant_home_team.tenant_id = candidate.tenant_id
         and tenant_home_team.source_connection_id =
           candidate.source_connection_id
         and tenant_home_team.external_id =
           candidate.home_team ->> 'externalId'
         and tenant_home_team.active
        where candidate.tenant_id = p_slide.tenant_id
          and candidate.external_id = source_items.item ->> 'id'
          and candidate.active
          and candidate.is_home_match
          and candidate.status in ('scheduled', 'postponed')
        order by candidate.starts_at desc, candidate.id
        limit 1
      ) fixture on true
    )
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_strip_nulls(
          matched_items.item || pg_catalog.jsonb_build_object(
            'homeTeam', matched_items.home_team_name,
            'officials', matched_items.officials
          )
        )
        order by matched_items.ordinality
      ),
      '[]'::jsonb
    )
    into enriched_items
    from matched_items;

    return pg_catalog.jsonb_set(
      result,
      '{sport,items}',
      enriched_items,
      true
    );
  end if;

  if blueprint in (
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days'
  ) then
    with source_items as (
      select item.value as item, item.ordinality
      from pg_catalog.jsonb_array_elements(
        coalesce(result #> '{sport,items}', '[]'::jsonb)
      ) with ordinality item(value, ordinality)
    ), matched_items as (
      select
        source_items.item,
        source_items.ordinality,
        coalesce(
          fixture.away_team_name,
          source_items.item ->> 'awayTeam'
        ) as away_team_name,
        coalesce(
          fixture.field_name,
          source_items.item ->> 'field'
        ) as field_name,
        coalesce(
          fixture.home_team_name,
          source_items.item ->> 'homeTeam'
        ) as home_team_name,
        coalesce(
          fixture.venue_name,
          source_items.item ->> 'venueName'
        ) as venue_name
      from source_items
      left join lateral (
        select
          coalesce(
            nullif(pg_catalog.btrim(away_team.name), ''),
            candidate.away_team ->> 'name',
            ''
          ) as away_team_name,
          nullif(pg_catalog.btrim(candidate.venue ->> 'field'), '')
            as field_name,
          coalesce(
            nullif(pg_catalog.btrim(home_team.name), ''),
            candidate.home_team ->> 'name',
            ''
          ) as home_team_name,
          nullif(pg_catalog.btrim(candidate.venue ->> 'name'), '')
            as venue_name
        from public.sports_matches candidate
        join public.sportlink_connections connection
          on connection.tenant_id = candidate.tenant_id
         and connection.id = candidate.source_connection_id
         and connection.data_source_id = p_slide.data_source_id
        left join public.sports_teams home_team
          on home_team.tenant_id = candidate.tenant_id
         and home_team.source_connection_id = candidate.source_connection_id
         and home_team.external_id = candidate.home_team ->> 'externalId'
         and home_team.active
        left join public.sports_teams away_team
          on away_team.tenant_id = candidate.tenant_id
         and away_team.source_connection_id = candidate.source_connection_id
         and away_team.external_id = candidate.away_team ->> 'externalId'
         and away_team.active
        where candidate.tenant_id = p_slide.tenant_id
          and candidate.external_id = source_items.item ->> 'id'
          and candidate.active
        order by candidate.starts_at desc, candidate.id
        limit 1
      ) fixture on true
    )
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_strip_nulls(
          matched_items.item || pg_catalog.jsonb_build_object(
            'awayTeam', matched_items.away_team_name,
            'field', case
              when coalesce(
                (p_slide.configuration_json #>> '{display,showField}')::boolean,
                true
              ) then matched_items.field_name
            end,
            'homeTeam', matched_items.home_team_name,
            'venueName', matched_items.venue_name
          )
        )
        order by matched_items.ordinality
      ),
      '[]'::jsonb
    )
    into enriched_items
    from matched_items;

    return pg_catalog.jsonb_set(
      result,
      '{sport,items}',
      enriched_items,
      true
    );
  end if;

  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s156_slide_layout_completion(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- Keep the established v4 command signature while permitting one clubwide
-- draft per distinct home/away/both direction. Ordinary requests still take
-- the original single-batch path. Variant fan-out is split into deterministic
-- sub-batches inside the same database transaction, so validation failure
-- cannot leave a partially created set and retries remain idempotent.
alter function public.create_sportlink_slide_batch_v4(
  uuid, uuid, jsonb, uuid
) rename to create_sportlink_slide_batch_v4_before_s156;
alter function public.create_sportlink_slide_batch_v4_before_s156(
  uuid, uuid, jsonb, uuid
) set schema private;

revoke all on function private.create_sportlink_slide_batch_v4_before_s156(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

create function public.create_sportlink_slide_batch_v4(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_drafts jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  batch_id uuid;
  current_draft jsonb;
  current_result jsonb;
  derived_hash text;
  derived_idempotency_key uuid;
  draft_index bigint;
  existing_data_source_id uuid;
  existing_request_hash text;
  has_duplicate_club_blueprint boolean;
  request_hash text;
  result jsonb;
  results jsonb := '[]'::jsonb;
begin
  select exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(p_drafts) = 'array' then p_drafts
        else '[]'::jsonb
      end
    ) draft(value)
    where draft.value ->> 'blueprintKey' in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    )
    group by draft.value ->> 'blueprintKey'
    having count(*) > 1
  ) into has_duplicate_club_blueprint;

  if not has_duplicate_club_blueprint then
    return private.create_sportlink_slide_batch_v4_before_s156(
      p_tenant_id,
      p_data_source_id,
      p_drafts,
      p_idempotency_key
    );
  end if;

  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create Sportlink slides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if p_idempotency_key is null
    or not exists (
      select 1
      from public.dynamic_data_sources source
      where source.id = p_data_source_id
        and source.tenant_id = p_tenant_id
        and source.kind = 'sportlink'
        and source.status = 'active'
    )
  then
    raise exception 'Sportlink source unavailable' using errcode = '23514';
  end if;
  if pg_catalog.jsonb_typeof(p_drafts) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_drafts) not between 1 and 25
  then
    raise exception 'invalid Sportlink batch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_drafts) draft(value)
    where draft.value ->> 'blueprintKey' in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    )
    group by
      draft.value ->> 'blueprintKey',
      coalesce(
        draft.value #>> '{teamSelection,matchLocation}',
        'both'
      )
    having count(*) > 1
  ) then
    raise exception 'duplicate club-wide Sportlink variant'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_drafts) draft(value)
    where draft.value ->> 'blueprintKey' in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    )
    group by draft.value ->> 'blueprintKey'
    having count(*) > 1
  ) then
    raise exception 'duplicate Sportlink arrival component'
      using errcode = '22023';
  end if;

  request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'dataSourceId', p_data_source_id,
          'drafts', p_drafts,
          'schemaVersion', '4-s156-variant-fanout'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.sportlink_slide_batches(
    tenant_id,
    data_source_id,
    idempotency_key,
    request_hash_sha256,
    created_by
  ) values (
    p_tenant_id,
    p_data_source_id,
    p_idempotency_key,
    request_hash,
    actor_id
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id, result_json into batch_id, result;

  if batch_id is null then
    select
      existing.id,
      existing.data_source_id,
      existing.request_hash_sha256,
      existing.result_json
    into
      batch_id,
      existing_data_source_id,
      existing_request_hash,
      result
    from public.sportlink_slide_batches existing
    where existing.tenant_id = p_tenant_id
      and existing.idempotency_key = p_idempotency_key;

    if batch_id is null
      or existing_data_source_id is distinct from p_data_source_id
      or existing_request_hash is distinct from request_hash
    then
      raise exception 'idempotency key belongs to a different Sportlink request'
        using errcode = '22023';
    end if;
    if result is not null then
      return result;
    end if;
  end if;

  for current_draft, draft_index in
    select draft.value, draft.ordinality
    from pg_catalog.jsonb_array_elements(p_drafts)
      with ordinality draft(value, ordinality)
    order by draft.ordinality
  loop
    derived_hash := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          p_idempotency_key::text || ':' || request_hash || ':' ||
            draft_index::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    derived_idempotency_key := (
      pg_catalog.substr(derived_hash, 1, 8) || '-' ||
      pg_catalog.substr(derived_hash, 9, 4) || '-' ||
      pg_catalog.substr(derived_hash, 13, 4) || '-' ||
      pg_catalog.substr(derived_hash, 17, 4) || '-' ||
      pg_catalog.substr(derived_hash, 21, 12)
    )::uuid;

    current_result := private.create_sportlink_slide_batch_v4_before_s156(
      p_tenant_id,
      p_data_source_id,
      pg_catalog.jsonb_build_array(current_draft),
      derived_idempotency_key
    );
    results := results || coalesce(
      current_result -> 'slides',
      '[]'::jsonb
    );
  end loop;

  result := pg_catalog.jsonb_build_object(
    'batchId', batch_id,
    'slides', results,
    'count', pg_catalog.jsonb_array_length(results)
  );
  update public.sportlink_slide_batches batch
  set result_json = result
  where batch.id = batch_id;

  perform private.audit_event(
    p_tenant_id,
    'sportlink.slide_batch.created',
    'sportlink_slide_batches',
    batch_id,
    'success',
    pg_catalog.jsonb_build_object(
      'count', pg_catalog.jsonb_array_length(results),
      'dataSourceId', p_data_source_id,
      'fanOut', true,
      'schemaVersion', 4,
      'variantCount', pg_catalog.jsonb_array_length(p_drafts)
    )
  );

  return result;
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v4(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_sportlink_slide_batch_v4(
  uuid, uuid, jsonb, uuid
) to authenticated;

-- Reuse the previously audited published-version queues. They resolve the
-- current builder dynamically, deduplicate by content hash and hand each new
-- immutable snapshot to the complete-render-only S146 release pipeline.
do $$
declare
  source_record record;
begin
  for source_record in
    select distinct version.tenant_id, version.data_source_id
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.dynamic_slide_id = slide.id
     and version.id = slide.current_published_version_id
     and version.status = 'published'
    where slide.status <> 'archived'
      and version.selection_mode = 'latest'
      and version.configuration_json ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days'
      )
    order by version.tenant_id, version.data_source_id
  loop
    perform private.queue_club_match_scope_snapshots_v1(
      source_record.tenant_id,
      source_record.data_source_id
    );
  end loop;

  for source_record in
    select distinct version.tenant_id, version.data_source_id
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.dynamic_slide_id = slide.id
     and version.id = slide.current_published_version_id
     and version.status = 'published'
    where slide.status <> 'archived'
      and version.selection_mode = 'latest'
      and version.slide_type = 'sport_visitor_arrivals'
      and version.configuration_json ->> 'blueprintKey' =
        'sportlink.visitor_arrivals'
    order by version.tenant_id, version.data_source_id
  loop
    perform private.queue_visitor_welcome_snapshots_v1(
      source_record.tenant_id,
      source_record.data_source_id
    );
  end loop;
end;
$$;
