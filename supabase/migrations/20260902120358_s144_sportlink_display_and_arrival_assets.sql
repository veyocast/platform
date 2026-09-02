-- S144: close the Sportlink authoring-to-playback trace. The batch wizard has
-- always persisted display and arrival controls in configuration_json, but the
-- snapshot builder historically projected only part of them. This wrapper is
-- additive: historical snapshots/releases stay immutable, while new snapshots
-- freeze the normalized display configuration and arrival artwork references.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s144_sportlink_display;

create or replace function private.build_dynamic_snapshot_data(
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
  display_config jsonb;
  enriched_items jsonb;
  result jsonb;
  show_club_logo boolean;
begin
  result := private.build_dynamic_snapshot_data_before_s144_sportlink_display(
    p_slide
  );

  if coalesce(p_slide.configuration_json ->> 'blueprintKey', '')
    not like 'sportlink.%' then
    return result;
  end if;

  display_config := jsonb_build_object(
    'columns', case p_slide.configuration_json #>> '{display,columns}'
      when 'one' then 'one'
      else 'two'
    end,
    'showDressingRoom', coalesce(
      (p_slide.configuration_json #>> '{display,showDressingRoom}')::boolean,
      false
    ),
    'showField', coalesce(
      (p_slide.configuration_json #>> '{display,showField}')::boolean,
      true
    ),
    'showHomeAway', coalesce(
      (p_slide.configuration_json #>> '{display,showHomeAway}')::boolean,
      true
    ),
    'showReferee', coalesce(
      (p_slide.configuration_json #>> '{display,showReferee}')::boolean,
      false
    )
  );
  result := jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{sport,displayConfig}',
    display_config,
    true
  );

  if p_slide.slide_type in ('sport_program', 'sport_results') then
    select coalesce(
      jsonb_agg(
        (
          source.value
          - 'venue'
          - 'meta'
          - 'homeRoom'
          - 'awayRoom'
          - 'officials'
          - 'homeMatch'
        ) || jsonb_strip_nulls(jsonb_build_object(
          'venue', case when (display_config ->> 'showField')::boolean
            then source.value ->> 'venue' end,
          'meta', case when (display_config ->> 'showField')::boolean
            then source.value ->> 'meta' end,
          'homeRoom', case when (display_config ->> 'showDressingRoom')::boolean
            then fixture.dressing_rooms ->> 'home' end,
          'awayRoom', case when (display_config ->> 'showDressingRoom')::boolean
            then fixture.dressing_rooms ->> 'away' end,
          'officials', case when (display_config ->> 'showReferee')::boolean
            then fixture.officials end,
          'homeMatch', case when (display_config ->> 'showHomeAway')::boolean
            then fixture.is_home_match end
        ))
        order by source.ordinality
      ),
      '[]'::jsonb
    )
    into enriched_items
    from jsonb_array_elements(
      coalesce(result #> '{sport,items}', '[]'::jsonb)
    ) with ordinality as source(value, ordinality)
    left join public.sports_matches as fixture
      on fixture.tenant_id = p_slide.tenant_id
     and fixture.external_id = source.value ->> 'id'
     and fixture.active
    left join public.sportlink_connections as connection
      on connection.id = fixture.source_connection_id
     and connection.tenant_id = fixture.tenant_id
     and connection.data_source_id = p_slide.data_source_id;

    result := jsonb_set(result, '{sport,items}', enriched_items, true);
  end if;

  if p_slide.slide_type not in (
    'sport_visitor_arrivals',
    'sport_referee_arrivals'
  ) then
    return result;
  end if;

  arrival_config := coalesce(
    result #> '{sport,arrivalConfig}',
    p_slide.configuration_json -> 'arrival',
    '{}'::jsonb
  );
  show_club_logo := coalesce(
    (arrival_config ->> 'showClubLogo')::boolean,
    true
  );

  select coalesce(
    jsonb_agg(
      (source.value - 'logoMediaAssetId') ||
      case
        when not show_club_logo then '{}'::jsonb
        when p_slide.slide_type = 'sport_visitor_arrivals' then
          jsonb_strip_nulls(jsonb_build_object(
            'logoMediaAssetId', away_logo.current_version_id
          ))
        else jsonb_strip_nulls(jsonb_build_object(
          'logoMediaAssetId', case
            when coalesce(result #>> '{brand,logoMediaAssetId}', '') ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (result #>> '{brand,logoMediaAssetId}')::uuid
          end
        ))
      end
      order by source.ordinality
    ),
    '[]'::jsonb
  )
  into enriched_items
  from jsonb_array_elements(
    coalesce(result #> '{sport,items}', '[]'::jsonb)
  ) with ordinality as source(value, ordinality)
  left join public.sports_matches as fixture
    on fixture.tenant_id = p_slide.tenant_id
   and fixture.external_id = split_part(source.value ->> 'id', ':', 1)
   and fixture.active
  left join public.sportlink_connections as connection
    on connection.id = fixture.source_connection_id
   and connection.tenant_id = fixture.tenant_id
   and connection.data_source_id = p_slide.data_source_id
  left join public.provider_asset_cache as away_logo
    on connection.id is not null
   and away_logo.provider = 'sportlink'
   and away_logo.entity_type = 'team'
   and away_logo.asset_role = 'team_logo'
   and away_logo.external_entity_id = fixture.away_team ->> 'externalId'
   and away_logo.current_version_id is not null;

  result := jsonb_set(result, '{sport,items}', enriched_items, true);
  result := jsonb_set(result, '{sport,arrivalConfig}', arrival_config, true);
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;

revoke all on function private.build_dynamic_snapshot_data_before_s144_sportlink_display(
  public.dynamic_slides
) from public, anon, authenticated;

-- Existing latest-following slides get a fresh immutable snapshot. Published
-- release rows are deliberately untouched.
do $$
declare
  source_record record;
begin
  for source_record in
    select
      slide.tenant_id,
      slide.data_source_id,
      array_agg(distinct slide.slide_type)::text[] as slide_types
    from public.dynamic_slides as slide
    where slide.status <> 'archived'
      and slide.data_source_id is not null
      and coalesce(slide.configuration_json ->> 'blueprintKey', '')
        like 'sportlink.%'
    group by slide.tenant_id, slide.data_source_id
  loop
    perform private.queue_latest_dynamic_snapshots_v2(
      source_record.tenant_id,
      source_record.data_source_id,
      source_record.slide_types,
      'fieldflow_sportlink_display_v1'
    );
  end loop;
end;
$$;
