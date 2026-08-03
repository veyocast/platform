-- One Sportlink team can occur once per competition, cup or phase in the
-- provider response. Normalize those rows before the set-based upsert so one
-- external team never targets the same unique row twice in one statement.

create or replace function private.normalize_sportlink_records_v1(
  p_records jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with records as (
    select
      item,
      item ->> 'externalId' as external_id,
      ordinal
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_records) = 'array' then p_records
        else '[]'::jsonb
      end
    ) with ordinality as source(item, ordinal)
    where nullif(item ->> 'externalId', '') is not null
  ),
  deduplicated as (
    select distinct on (external_id)
      item,
      ordinal
    from records
    order by external_id, ordinal desc
  )
  select coalesce(
    jsonb_agg(item order by ordinal),
    '[]'::jsonb
  )
  from deduplicated
$$;

create or replace function private.normalize_sportlink_teams_v1(
  p_teams jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  team_item jsonb;
  existing_team jsonb;
  normalized_teams jsonb := '{}'::jsonb;
  external_id text;
  competition_options jsonb;
begin
  if jsonb_typeof(p_teams) is distinct from 'array' then
    return '[]'::jsonb;
  end if;

  for team_item in
    select item
    from jsonb_array_elements(p_teams) as source(item)
  loop
    external_id := nullif(team_item ->> 'externalId', '');
    if external_id is null or nullif(team_item ->> 'name', '') is null then
      continue;
    end if;

    existing_team := coalesce(
      normalized_teams -> external_id,
      '{}'::jsonb
    );

    select coalesce(
      jsonb_agg(option_item order by option_item ->> 'externalId'),
      '[]'::jsonb
    )
    into competition_options
    from (
      select distinct on (candidate ->> 'externalId')
        candidate as option_item
      from (
        select value as candidate
        from jsonb_array_elements(
          case
            when jsonb_typeof(existing_team -> 'competitionOptions') = 'array'
              then existing_team -> 'competitionOptions'
            else '[]'::jsonb
          end
        )
        union all
        select value as candidate
        from jsonb_array_elements(
          case
            when jsonb_typeof(team_item -> 'competitionOptions') = 'array'
              then team_item -> 'competitionOptions'
            else '[]'::jsonb
          end
        )
      ) options
      where nullif(candidate ->> 'externalId', '') is not null
      order by candidate ->> 'externalId'
      limit 40
    ) deduplicated_options;

    normalized_teams := jsonb_set(
      normalized_teams,
      array[external_id],
      existing_team
        || team_item
        || jsonb_build_object(
          'competitionOptions',
          competition_options
        ),
      true
    );
  end loop;

  return coalesce(
    (
      select jsonb_agg(value order by key)
      from jsonb_each(normalized_teams)
    ),
    '[]'::jsonb
  );
end;
$$;

alter function public.record_sportlink_sync_v1(
  uuid, jsonb, jsonb, jsonb, jsonb
)
rename to record_sportlink_sync_pre_context_v1;

create or replace function public.record_sportlink_sync_v1(
  p_connection_id uuid,
  p_club jsonb,
  p_teams jsonb,
  p_matches jsonb,
  p_activities jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_teams jsonb;
  normalized_matches jsonb;
  normalized_activities jsonb;
  sync_result jsonb;
begin
  normalized_teams := private.normalize_sportlink_teams_v1(p_teams);
  normalized_matches :=
    private.normalize_sportlink_records_v1(p_matches);
  normalized_activities :=
    private.normalize_sportlink_records_v1(p_activities);

  sync_result := public.record_sportlink_sync_pre_context_v1(
    p_connection_id,
    coalesce(p_club, '{}'::jsonb),
    normalized_teams,
    normalized_matches,
    normalized_activities
  );

  update public.sports_teams team
  set local_external_id = nullif(item ->> 'localExternalId', ''),
      metadata = coalesce(team.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'competitionOptions',
          coalesce(item -> 'competitionOptions', '[]'::jsonb)
        )
  from jsonb_array_elements(normalized_teams) as source(item)
  where team.source_connection_id = p_connection_id
    and team.external_id = item ->> 'externalId';

  return sync_result;
end;
$$;

revoke all on function private.normalize_sportlink_records_v1(jsonb)
  from public, anon, authenticated;
revoke all on function private.normalize_sportlink_teams_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.record_sportlink_sync_pre_context_v1(
  uuid, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.record_sportlink_sync_v1(
  uuid, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.record_sportlink_sync_v1(
  uuid, jsonb, jsonb, jsonb, jsonb
) to authenticated, service_role;

-- Retry only the affected Teams dataset. Failed attempts never removed the
-- normalized last-known-good rows or immutable Player releases.
update public.sportlink_sync_policies policy
set next_sync_at = least(policy.next_sync_at, now())
where policy.enabled
  and policy.dataset_group = 'teams'
  and exists (
    select 1
    from public.sportlink_sync_runs run
    where run.connection_id = policy.connection_id
      and run.dataset_group = 'teams'
      and run.status = 'failed'
      and run.error_code = 'SPORTLINK_SYNC_INTERNAL_ERROR'
  );
