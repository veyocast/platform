-- S155: enrich the immutable visitor-welcome payload with the complete
-- tenant-owned home fixture. Historical snapshots and playlist releases stay
-- untouched; the corrective queue at the end creates replacement snapshots
-- for the exact currently published latest-mode version only.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s155_welcome_news_layout;

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
  normalized_items jsonb;
  result jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s155_welcome_news_layout(
    p_slide
  );

  if p_slide.slide_type <> 'sport_visitor_arrivals' then
    return result;
  end if;

  -- The existing arrival builder already selects home matches for the chosen
  -- teams. Resolve every projected item once more against the exact tenant and
  -- Sportlink source before adding accommodation and home/away details. An
  -- unmatched, inactive, away or foreign item is deliberately dropped rather
  -- than allowed to leak stale provider data into a replacement snapshot.
  with source_items as (
    select item.value as item, item.ordinality
    from pg_catalog.jsonb_array_elements(
      coalesce(result #> '{sport,items}', '[]'::jsonb)
    ) with ordinality item(value, ordinality)
  ), matched_items as (
    select
      source_items.item,
      source_items.ordinality,
      fixture.away_team,
      fixture.dressing_rooms,
      fixture.home_team,
      fixture.starts_at,
      fixture.venue,
      fixture.source_timezone
    from source_items
    join lateral (
      select
        candidate.away_team,
        candidate.dressing_rooms,
        candidate.home_team,
        candidate.starts_at,
        candidate.venue,
        coalesce(connection.timezone, 'Europe/Amsterdam') as source_timezone
      from public.sports_matches candidate
      join public.sportlink_connections connection
        on connection.tenant_id = candidate.tenant_id
       and connection.id = candidate.source_connection_id
       and connection.data_source_id = p_slide.data_source_id
      join public.sports_teams tenant_home_team
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
  ), normalized as (
    select
      matched_items.*,
      nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
        coalesce(matched_items.dressing_rooms ->> 'home', ''),
        '^[[:space:]]*Kleedkamer[[:space:]]*:?[[:space:]]*',
        '',
        'i'
      )), '') as home_room,
      nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
        coalesce(matched_items.dressing_rooms ->> 'away', ''),
        '^[[:space:]]*Kleedkamer[[:space:]]*:?[[:space:]]*',
        '',
        'i'
      )), '') as away_room,
      nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
        coalesce(matched_items.venue ->> 'field', ''),
        '^[[:space:]]*Veld[[:space:]]*:?[[:space:]]*',
        '',
        'i'
      )), '') as field_name,
      nullif(pg_catalog.btrim(matched_items.venue ->> 'name'), '')
        as venue_name
    from matched_items
  ), labeled as (
    select
      normalized.*,
      pg_catalog.to_char(
        normalized.starts_at at time zone normalized.source_timezone,
        'DD-MM-YYYY'
      ) as fixture_date,
      pg_catalog.to_char(
        normalized.starts_at at time zone normalized.source_timezone,
        'HH24:MI'
      ) as kickoff_time
    from normalized
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_strip_nulls(
        labeled.item || pg_catalog.jsonb_build_object(
          -- Keep the three legacy fields available for old renderers while
          -- exposing the structured contract used by both current Players.
          'primary', coalesce(
            nullif(labeled.item ->> 'primary', ''),
            labeled.away_team ->> 'name',
            ''
          ),
          'secondary', pg_catalog.format(
            'Aanvang: %s | Veld %s',
            coalesce(labeled.kickoff_time, 'volgt'),
            coalesce(labeled.field_name, 'volgt')
          ),
          'meta', pg_catalog.format(
            'Kleedkamer: %s',
            coalesce(labeled.away_room, 'volgt')
          ),
          'date', labeled.fixture_date,
          'kickoffTime', labeled.kickoff_time,
          'homeTeam', coalesce(labeled.home_team ->> 'name', ''),
          'awayTeam', coalesce(labeled.away_team ->> 'name', ''),
          'homeRoom', coalesce(labeled.home_room, ''),
          'awayRoom', coalesce(labeled.away_room, ''),
          'dressingRoom', coalesce(labeled.away_room, ''),
          'field', coalesce(labeled.field_name, ''),
          'venueName', coalesce(labeled.venue_name, ''),
          'kickoffAt', labeled.starts_at,
          'homeMatch', true
        )
      )
      order by labeled.ordinality
    ),
    '[]'::jsonb
  )
  into normalized_items
  from labeled;

  return pg_catalog.jsonb_set(
    result,
    '{sport,items}',
    normalized_items,
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s155_welcome_news_layout(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- The generic provider refresh intentionally defers when an unpublished draft
-- exists. This repair path mirrors S154 and renders the exact immutable current
-- published version, so a draft cannot block the safe layout/data correction.
create function private.queue_visitor_welcome_snapshots_v1(
  p_tenant_id uuid,
  p_data_source_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_hash text;
  new_snapshot_id uuid;
  queued_count integer := 0;
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
begin
  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.dynamic_slide_id = slide.id
     and version.id = slide.current_published_version_id
     and version.status = 'published'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
      and version.data_source_id = p_data_source_id
      and version.slide_type = 'sport_visitor_arrivals'
      and version.selection_mode = 'latest'
      and version.configuration_json ->> 'blueprintKey' =
        'sportlink.visitor_arrivals'
    order by slide.id
    for update of slide
  loop
    -- Only fields from the immutable published version are copied into the
    -- transient record. Editable dynamic_slides fields can mirror a newer
    -- authoring draft and must not enter this corrective runtime snapshot.
    select
      version.name,
      version.slide_type,
      version.orientation,
      version.template_id,
      version.template_version_id,
      version.data_source_id,
      version.selection_mode,
      version.configuration_json
    into
      slide_record.name,
      slide_record.slide_type,
      slide_record.orientation,
      slide_record.template_id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      slide_record.selection_mode,
      slide_record.configuration_json
    from public.dynamic_slide_versions version
    where version.tenant_id = slide_record.tenant_id
      and version.dynamic_slide_id = slide_record.id
      and version.id = slide_record.current_published_version_id
      and version.status = 'published';
    if not found then
      continue;
    end if;

    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(
      slide_record,
      snapshot_data
    );
    new_snapshot_id := null;

    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.current_published_version_id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      content_hash,
      snapshot_data
    )
    on conflict (
      dynamic_slide_id,
      dynamic_slide_version_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is null then
      continue;
    end if;

    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    values (slide_record.tenant_id, new_snapshot_id)
    on conflict (snapshot_id) do nothing;

    update public.dynamic_slides slide
    set status = 'rendering',
        last_error_code = null
    where slide.tenant_id = slide_record.tenant_id
      and slide.id = slide_record.id;
    queued_count := queued_count + 1;
  end loop;

  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id,
      action,
      target_type,
      target_id,
      result,
      metadata
    ) values (
      p_tenant_id,
      'dynamic.snapshot.auto_queued',
      'dynamic_data_sources',
      p_data_source_id,
      'success',
      pg_catalog.jsonb_build_object(
        'systemExecuted', true,
        'reason', 's155_visitor_welcome_structured_layout',
        'queuedCount', queued_count,
        'publishedVersionOnly', true
      )
    );
  end if;

  return queued_count;
end;
$$;

revoke all on function private.queue_visitor_welcome_snapshots_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

-- Queue a new immutable snapshot for every affected published latest slide.
-- The existing S146 render/release pipeline promotes only a complete artifact;
-- active Player last-known-good releases are never changed by this migration.
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
      and version.slide_type = 'sport_visitor_arrivals'
      and version.selection_mode = 'latest'
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
