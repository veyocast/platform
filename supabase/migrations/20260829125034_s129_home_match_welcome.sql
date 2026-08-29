-- S129: visitor arrival slides are exclusively for opponents visiting a
-- home-playing club team. Historical `eigenteam` interpretation marked every
-- club fixture as home; repair those rows from exact normalized club-team IDs.
update public.sports_matches as fixture
set is_home_match = exists (
  select 1
  from public.sports_teams as home_team
  where home_team.tenant_id = fixture.tenant_id
    and home_team.source_connection_id = fixture.source_connection_id
    and home_team.external_id = fixture.home_team ->> 'externalId'
    and home_team.active
)
where fixture.is_home_match is distinct from exists (
  select 1
  from public.sports_teams as home_team
  where home_team.tenant_id = fixture.tenant_id
    and home_team.source_connection_id = fixture.source_connection_id
    and home_team.external_id = fixture.home_team ->> 'externalId'
    and home_team.active
);

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s129_home_arrivals;

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
  result jsonb;
  safe_items jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s129_home_arrivals(
    p_slide
  );

  if p_slide.slide_type <> 'sport_visitor_arrivals' then
    return result;
  end if;

  select coalesce(
    jsonb_agg(
      arrival.value || jsonb_strip_nulls(jsonb_build_object(
        'homeMatch', true,
        'logoMediaAssetId', provider_logo.current_version_id
      ))
      order by arrival.ordinality
    ),
    '[]'::jsonb
  )
  into safe_items
  from jsonb_array_elements(
    coalesce(result #> '{sport,items}', '[]'::jsonb)
  ) with ordinality as arrival(value, ordinality)
  join public.sports_matches as fixture
    on fixture.tenant_id = p_slide.tenant_id
   and fixture.external_id = arrival.value ->> 'id'
   and fixture.active
   and fixture.is_home_match
   and fixture.status in ('scheduled', 'postponed')
  join public.sportlink_connections as connection
    on connection.id = fixture.source_connection_id
   and connection.tenant_id = fixture.tenant_id
   and connection.data_source_id = p_slide.data_source_id
  left join public.provider_asset_cache as provider_logo
    on provider_logo.provider = 'sportlink'
   and provider_logo.entity_type = 'team'
   and provider_logo.asset_role = 'team_logo'
   and provider_logo.external_entity_id = fixture.away_team ->> 'externalId'
   and provider_logo.current_version_id is not null;

  result := jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{sport,items}',
    safe_items,
    true
  );

  if jsonb_array_length(safe_items) = 0 then
    result := jsonb_set(
      result,
      '{sport,emptyStateCode}',
      to_jsonb('NO_ARRIVALS_IN_WINDOW'::text),
      true
    );
  end if;

  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_s129_home_arrivals(
  public.dynamic_slides
) from public, anon, authenticated;

-- Rebuild published latest-arrival snapshots immediately. Immutable releases
-- stay immutable; the established queue creates a new snapshot/release only
-- where the corrected content hash differs.
do $$
declare
  source_record record;
begin
  for source_record in
    select distinct slide.tenant_id, slide.data_source_id
    from public.dynamic_slides as slide
    where slide.slide_type = 'sport_visitor_arrivals'
      and slide.status <> 'archived'
      and slide.data_source_id is not null
  loop
    perform private.queue_latest_dynamic_snapshots_v2(
      source_record.tenant_id,
      source_record.data_source_id,
      array['sport_visitor_arrivals']::text[],
      'home_arrivals_corrected'
    );
  end loop;
end;
$$;
