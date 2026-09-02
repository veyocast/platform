-- S144: freeze both Sportlink team emblems into match snapshots. Provider
-- versions are content addressed and therefore remain safe in immutable
-- releases even after the upstream provider changes an emblem.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s144_dual_team_logos;

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
  enriched_items jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s144_dual_team_logos(
    p_slide
  );

  if p_slide.slide_type not in (
    'sport_program',
    'sport_results',
    'sport_next_match',
    'sport_cancellations',
    'sport_dressing_rooms',
    'sport_officials'
  ) then
    return result;
  end if;

  select coalesce(
    jsonb_agg(
      source.value || jsonb_strip_nulls(jsonb_build_object(
        'homeLogoMediaAssetId', coalesce(
          home_logo.current_version_id,
          case when home_club.id is not null
            then nullif(result #>> '{brand,logoMediaAssetId}', '')::uuid end
        ),
        'awayLogoMediaAssetId', coalesce(
          away_logo.current_version_id,
          case when away_club.id is not null
            then nullif(result #>> '{brand,logoMediaAssetId}', '')::uuid end
        )
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
   and connection.data_source_id = p_slide.data_source_id
  left join public.provider_asset_cache as home_logo
    on connection.id is not null
   and home_logo.provider = 'sportlink'
   and home_logo.entity_type = 'team'
   and home_logo.asset_role = 'team_logo'
   and home_logo.external_entity_id = fixture.home_team ->> 'externalId'
   and home_logo.current_version_id is not null
  left join public.provider_asset_cache as away_logo
    on connection.id is not null
   and away_logo.provider = 'sportlink'
   and away_logo.entity_type = 'team'
   and away_logo.asset_role = 'team_logo'
   and away_logo.external_entity_id = fixture.away_team ->> 'externalId'
   and away_logo.current_version_id is not null
  left join public.sports_teams as home_club
    on connection.id is not null
   and home_club.tenant_id = fixture.tenant_id
   and home_club.source_connection_id = fixture.source_connection_id
   and home_club.external_id = fixture.home_team ->> 'externalId'
   and home_club.active
  left join public.sports_teams as away_club
    on connection.id is not null
   and away_club.tenant_id = fixture.tenant_id
   and away_club.source_connection_id = fixture.source_connection_id
   and away_club.external_id = fixture.away_team ->> 'externalId'
   and away_club.active;

  return jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{sport,items}',
    enriched_items,
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;

revoke all on function private.build_dynamic_snapshot_data_before_s144_dual_team_logos(
  public.dynamic_slides
) from public, anon, authenticated;
