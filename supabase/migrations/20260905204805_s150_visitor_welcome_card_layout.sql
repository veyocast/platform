-- S150: visitor welcome cards use one fixed, readable three-line contract.
-- Existing snapshots and releases remain immutable; latest slides are queued
-- below so the established pipeline can publish corrected replacements.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s150_welcome_layout;

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
  arrival_config jsonb;
  normalized_items jsonb;
  result jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s150_welcome_layout(
    p_slide
  );

  if p_slide.slide_type <> 'sport_visitor_arrivals' then
    return result;
  end if;

  with source_items as (
    select arrival.value as item, arrival.ordinality
    from jsonb_array_elements(
      coalesce(result #> '{sport,items}', '[]'::jsonb)
    ) with ordinality as arrival(value, ordinality)
  ), resolved_items as (
    select
      source_items.item,
      source_items.ordinality,
      coalesce(
        fixture.starts_at,
        case
          when nullif(source_items.item ->> 'kickoffAt', '') is not null
            then (source_items.item ->> 'kickoffAt')::timestamptz
          else null
        end
      ) as kickoff_at,
      coalesce(fixture.source_timezone, 'Europe/Amsterdam') as source_timezone,
      nullif(regexp_replace(
        coalesce(
          nullif(source_items.item ->> 'field', ''),
          substring(
            coalesce(source_items.item ->> 'meta', '')
            from '[Vv]eld[[:space:]]*:?[[:space:]]*([^·|]+)'
          )
        ),
        '^[[:space:]]*Veld[[:space:]]*:?[[:space:]]*',
        '',
        'i'
      ), '') as field_name,
      nullif(regexp_replace(
        coalesce(
          nullif(source_items.item ->> 'dressingRoom', ''),
          substring(
            coalesce(source_items.item ->> 'meta', '')
            from '[Kk]leedkamer[[:space:]]*:?[[:space:]]*([^·|]+)'
          )
        ),
        '^[[:space:]]*Kleedkamer[[:space:]]*:?[[:space:]]*',
        '',
        'i'
      ), '') as dressing_room
    from source_items
    left join lateral (
      select
        fixture.starts_at,
        connection.timezone as source_timezone
      from public.sports_matches fixture
      join public.sportlink_connections connection
        on connection.id = fixture.source_connection_id
       and connection.tenant_id = fixture.tenant_id
       and connection.data_source_id = p_slide.data_source_id
      where fixture.tenant_id = p_slide.tenant_id
        and fixture.external_id = source_items.item ->> 'id'
      order by fixture.active desc, fixture.starts_at desc
      limit 1
    ) fixture on true
  ), labeled_items as (
    select
      resolved_items.*,
      coalesce(
        case when resolved_items.kickoff_at is not null then to_char(
          resolved_items.kickoff_at at time zone resolved_items.source_timezone,
          'HH24:MI'
        ) end,
        nullif(resolved_items.item ->> 'kickoffTime', ''),
        substring(
          coalesce(resolved_items.item ->> 'secondary', '')
          from '[Aa]anvang[[:space:]]*:?[[:space:]]*([0-9]{1,2}:[0-9]{2})'
        )
      ) as kickoff_time
    from resolved_items
  )
  select coalesce(
    jsonb_agg(
      labeled_items.item || jsonb_build_object(
        'secondary', format(
          'Aanvang: %s | Veld %s',
          coalesce(labeled_items.kickoff_time, 'volgt'),
          coalesce(labeled_items.field_name, 'volgt')
        ),
        'meta', format(
          'Kleedkamer: %s',
          coalesce(labeled_items.dressing_room, 'volgt')
        ),
        'kickoffTime', coalesce(labeled_items.kickoff_time, ''),
        'field', coalesce(labeled_items.field_name, ''),
        'dressingRoom', coalesce(labeled_items.dressing_room, '')
      )
      order by
        case
          when labeled_items.kickoff_at >= statement_timestamp() then 0
          when labeled_items.kickoff_at is null then 2
          else 1
        end,
        case when labeled_items.kickoff_at >= statement_timestamp()
          then labeled_items.kickoff_at end,
        case when labeled_items.kickoff_at < statement_timestamp()
          then labeled_items.kickoff_at end desc,
        labeled_items.ordinality
    ),
    '[]'::jsonb
  )
  into normalized_items
  from labeled_items;

  arrival_config := coalesce(
    result #> '{sport,arrivalConfig}',
    '{}'::jsonb
  ) || jsonb_build_object(
    'cardCount', 2,
    'showArrivalTime', false,
    'showCompetition', false,
    'showDressingRoom', true,
    'showField', true,
    'showKickoffTime', true,
    'showSponsor', false,
    'showWelcome', false
  );
  result := jsonb_set(result, '{sport,items}', normalized_items, true);
  result := jsonb_set(result, '{sport,arrivalConfig}', arrival_config, true);
  return jsonb_set(
    result,
    '{sport,title}',
    to_jsonb('Welkom bezoekende teams'::text),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s150_welcome_layout(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

do $$
declare
  source_record record;
begin
  for source_record in
    select distinct slide.tenant_id, slide.data_source_id
    from public.dynamic_slides slide
    where slide.slide_type = 'sport_visitor_arrivals'
      and slide.status <> 'archived'
      and slide.data_source_id is not null
  loop
    perform private.queue_latest_dynamic_snapshots_v2(
      source_record.tenant_id,
      source_record.data_source_id,
      array['sport_visitor_arrivals']::text[],
      'visitor_welcome_layout_v2'
    );
  end loop;
end;
$$;
