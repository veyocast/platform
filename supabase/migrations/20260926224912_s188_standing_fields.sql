-- S178 rebuilt the pool-standing projection for exact team identity, but that
-- historical layer no longer carried the existing row-logo and form
-- enrichment. Repair the final immutable snapshot contract without replacing
-- any of the newer theme, publication, or match-selection wrappers.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s188_standing_fields;

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
  expected_competition_id text;
  expected_phase_id text;
  expected_pool_id text;
  expected_season_id text;
  expected_source_connection_id text;
  items jsonb;
  result jsonb;
  standing_rows jsonb;
  standing_source_connection_id uuid;
begin
  result := private.build_dynamic_snapshot_data_before_s188_standing_fields(
    p_slide
  );

  if p_slide.slide_type not in ('sport_standing', 'sport_period_standing')
    or pg_catalog.jsonb_typeof(result #> '{sport,items}') is distinct from 'array'
    or pg_catalog.jsonb_array_length(result #> '{sport,items}') = 0
  then
    return result;
  end if;

  expected_source_connection_id := nullif(
    result #>> '{sport,poolContext,sourceConnectionId}',
    ''
  );
  expected_competition_id := coalesce(
    nullif(result #>> '{sport,poolContext,competitionId}', ''),
    private.sportlink_competition_identity_v1(
      result #> '{sport,competition}',
      result #> '{sport,pool}'
    )
  );
  expected_phase_id := nullif(
    result #>> '{sport,poolContext,phaseId}',
    ''
  );
  expected_pool_id := coalesce(
    nullif(result #>> '{sport,poolContext,poolId}', ''),
    nullif(result #>> '{sport,pool,externalId}', ''),
    nullif(result #>> '{sport,pool,poolExternalId}', '')
  );
  expected_season_id := coalesce(
    nullif(result #>> '{sport,poolContext,seasonId}', ''),
    nullif(result #>> '{sport,season}', '')
  );

  select standing.source_connection_id, standing.rows_json
  into standing_source_connection_id, standing_rows
  from public.sports_standings standing
  join public.sportlink_connections connection
    on connection.tenant_id = standing.tenant_id
   and connection.id = standing.source_connection_id
   and connection.data_source_id = p_slide.data_source_id
  where standing.tenant_id = p_slide.tenant_id
    and standing.active
    and standing.scores_published
    and (
      expected_source_connection_id is null
      or standing.source_connection_id::text = expected_source_connection_id
    )
    and (
      expected_pool_id is null
      or coalesce(
        standing.metadata #>> '{pool,externalId}',
        standing.metadata #>> '{pool,poolExternalId}',
        standing.pool_external_id
      ) = expected_pool_id
    )
    and (
      expected_competition_id is null
      or private.sportlink_competition_identity_v1(
        standing.metadata -> 'competition',
        standing.metadata -> 'pool'
      ) is null
      or private.sportlink_competition_identity_v1(
        standing.metadata -> 'competition',
        standing.metadata -> 'pool'
      ) = expected_competition_id
    )
    and (
      expected_phase_id is null
      or standing.metadata #>> '{competition,period}' = expected_phase_id
    )
    and (
      expected_season_id is null
      or standing.season_key = expected_season_id
    )
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(standing.rows_json) source_row
      join pg_catalog.jsonb_array_elements(result #> '{sport,items}') item
        on item ->> 'id' = source_row ->> 'externalId'
    )
  order by standing.last_synced_at desc, standing.id
  limit 1;

  if standing_rows is null then
    return result;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      item.value || pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'logoMediaAssetId', coalesce(
            nullif(item.value ->> 'logoMediaAssetId', ''),
            nullif(source.row ->> 'logoMediaAssetId', ''),
            (
              select cache.current_version_id::text
              from public.provider_asset_cache cache
              where cache.provider = 'sportlink'
                and cache.entity_type = 'team'
                and cache.asset_role = 'team_logo'
                and cache.external_entity_id = coalesce(
                  nullif(source.row ->> 'externalId', ''),
                  item.value ->> 'id'
                )
                and cache.current_version_id is not null
              limit 1
            )
          ),
          'played', coalesce(
            case when item.value ->> 'played' ~ '^[0-9]+$'
              then (item.value ->> 'played')::integer end,
            case when source.row ->> 'played' ~ '^[0-9]+$'
              then (source.row ->> 'played')::integer end,
            case when
              coalesce(item.value ->> 'won', source.row ->> 'won') ~ '^[0-9]+$'
              and coalesce(item.value ->> 'drawn', source.row ->> 'drawn') ~ '^[0-9]+$'
              and coalesce(item.value ->> 'lost', source.row ->> 'lost') ~ '^[0-9]+$'
            then
              coalesce(item.value ->> 'won', source.row ->> 'won')::integer
              + coalesce(item.value ->> 'drawn', source.row ->> 'drawn')::integer
              + coalesce(item.value ->> 'lost', source.row ->> 'lost')::integer
            end
          ),
          'form', coalesce(
            case
              when pg_catalog.jsonb_typeof(item.value -> 'form') = 'array'
                and pg_catalog.jsonb_array_length(item.value -> 'form') > 0
              then item.value -> 'form'
            end,
            case
              when pg_catalog.jsonb_typeof(source.row -> 'form') = 'array'
                and pg_catalog.jsonb_array_length(source.row -> 'form') > 0
              then source.row -> 'form'
            end,
            (
              select pg_catalog.jsonb_agg(
                recent_match.result
                order by recent_match.starts_at
              )
              from (
                select
                  fixture.starts_at,
                  case
                    when (fixture.home_team ->> 'score')::integer =
                      (fixture.away_team ->> 'score')::integer
                    then 'draw'
                    when (
                      fixture.home_team ->> 'externalId' =
                        source.row ->> 'externalId'
                      or (
                        nullif(fixture.home_team ->> 'externalId', '') is null
                        and pg_catalog.lower(fixture.home_team ->> 'name') =
                          pg_catalog.lower(source.row ->> 'teamName')
                      )
                    )
                    then case
                      when (fixture.home_team ->> 'score')::integer >
                        (fixture.away_team ->> 'score')::integer
                      then 'win'
                      else 'loss'
                    end
                    else case
                      when (fixture.away_team ->> 'score')::integer >
                        (fixture.home_team ->> 'score')::integer
                      then 'win'
                      else 'loss'
                    end
                  end as result
                from public.sports_matches fixture
                where fixture.tenant_id = p_slide.tenant_id
                  and fixture.source_connection_id =
                    standing_source_connection_id
                  and fixture.active
                  and fixture.status = 'finished'
                  and fixture.scores_published
                  and fixture.home_team ->> 'score' ~ '^[0-9]+$'
                  and fixture.away_team ->> 'score' ~ '^[0-9]+$'
                  and (
                    fixture.home_team ->> 'externalId' =
                      source.row ->> 'externalId'
                    or fixture.away_team ->> 'externalId' =
                      source.row ->> 'externalId'
                    or (
                      nullif(fixture.home_team ->> 'externalId', '') is null
                      and pg_catalog.lower(fixture.home_team ->> 'name') =
                        pg_catalog.lower(source.row ->> 'teamName')
                    )
                    or (
                      nullif(fixture.away_team ->> 'externalId', '') is null
                      and pg_catalog.lower(fixture.away_team ->> 'name') =
                        pg_catalog.lower(source.row ->> 'teamName')
                    )
                  )
                  and (
                    expected_competition_id is null
                    or private.sportlink_competition_identity_v1(
                      fixture.competition,
                      fixture.pool
                    ) = expected_competition_id
                  )
                  and (
                    expected_pool_id is null
                    or coalesce(
                      fixture.pool ->> 'externalId',
                      fixture.pool ->> 'poolExternalId'
                    ) = expected_pool_id
                  )
                order by fixture.starts_at desc, fixture.external_id
                limit 3
              ) recent_match
            ),
            '[]'::jsonb
          )
        )
      )
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  into items
  from pg_catalog.jsonb_array_elements(result #> '{sport,items}')
    with ordinality item(value, ordinality)
  left join lateral (
    select candidate as row
    from pg_catalog.jsonb_array_elements(standing_rows) candidate
    where candidate ->> 'externalId' = item.value ->> 'id'
    limit 1
  ) source on true;

  return pg_catalog.jsonb_set(result, '{sport,items}', items, true);
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s188_standing_fields(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- Published `latest` slides receive immutable successor snapshots; open drafts
-- and existing releases remain untouched.
do $$
declare
  source_record record;
begin
  for source_record in
    select distinct version.tenant_id, version.data_source_id
    from public.dynamic_slide_versions version
    join public.dynamic_slides slide
      on slide.tenant_id = version.tenant_id
     and slide.id = version.dynamic_slide_id
     and slide.current_published_version_id = version.id
    where slide.status <> 'archived'
      and version.status = 'published'
      and version.selection_mode = 'latest'
      and version.data_source_id is not null
      and version.configuration_json ->> 'blueprintKey' =
        'sportlink.pool_standings'
  loop
    perform private.queue_match_row_snapshots_v1(
      source_record.tenant_id,
      source_record.data_source_id
    );
  end loop;
end;
$$;

update public.sportlink_sync_policies
set next_sync_at = least(next_sync_at, now())
where enabled
  and dataset_group in ('matches', 'competitions');
