-- S154: club programme/result slides must only expose fixtures involving a
-- tenant-owned Sportlink team. The selected team also defines whether home,
-- away or both fixture directions are eligible. Pool slides intentionally
-- retain their wider pool context.

create or replace function private.sportlink_team_selection_is_valid_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_team_selection jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  contexts jsonb;
  mode_name text;
begin
  if pg_catalog.jsonb_typeof(p_team_selection) is distinct from 'object'
    or not (p_team_selection ?& array['mode', 'teamContexts'])
    or exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_team_selection) as keys(key_name)
      where keys.key_name not in ('matchLocation', 'mode', 'teamContexts')
    )
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'mode'
    ) is distinct from 'string'
    or p_team_selection ->> 'mode' not in ('all', 'selected')
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'teamContexts'
    ) is distinct from 'array'
    or pg_catalog.jsonb_array_length(
      p_team_selection -> 'teamContexts'
    ) > 500
    or (
      p_team_selection ? 'matchLocation'
      and (
        pg_catalog.jsonb_typeof(
          p_team_selection -> 'matchLocation'
        ) is distinct from 'string'
        or p_team_selection ->> 'matchLocation' not in (
          'both', 'home', 'away'
        )
      )
    )
  then
    return false;
  end if;

  contexts := p_team_selection -> 'teamContexts';
  mode_name := p_team_selection ->> 'mode';
  if mode_name = 'selected' and pg_catalog.jsonb_array_length(contexts) = 0 then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(contexts) > 0
    and not private.sportlink_team_contexts_are_valid_v2(
      p_tenant_id,
      p_data_source_id,
      contexts
    )
  then
    return false;
  end if;
  if mode_name = 'all' and exists (
    select 1
    from pg_catalog.jsonb_array_elements(contexts) context
    where context ->> 'competitionSelectionMode' <> 'pinned'
  ) then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.sportlink_team_selection_is_valid_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

-- Match direction is resolved against the selected tenant-owned team ID. The
-- provider's is_home_match flag is deliberately not trusted for pool/results
-- payloads, where that flag does not reliably identify the selected team.
create or replace function private.sportlink_match_matches_team_selection_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_match public.sports_matches,
  p_team_selection jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  match_location text := coalesce(
    p_team_selection ->> 'matchLocation',
    'both'
  );
begin
  if p_match.tenant_id is distinct from p_tenant_id
    or pg_catalog.jsonb_typeof(p_team_selection) is distinct from 'object'
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'mode'
    ) is distinct from 'string'
    or p_team_selection ->> 'mode' not in ('all', 'selected')
    or pg_catalog.jsonb_typeof(
      p_team_selection -> 'teamContexts'
    ) is distinct from 'array'
    or (
      p_team_selection ? 'matchLocation'
      and pg_catalog.jsonb_typeof(
        p_team_selection -> 'matchLocation'
      ) is distinct from 'string'
    )
    or not exists (
      select 1
      from public.sportlink_connections connection
      where connection.tenant_id = p_tenant_id
        and connection.id = p_match.source_connection_id
        and connection.data_source_id = p_data_source_id
    )
    or match_location not in ('both', 'home', 'away')
  then
    return false;
  end if;

  if p_team_selection ->> 'mode' = 'selected' then
    return exists (
      select 1
      from pg_catalog.jsonb_array_elements(
        p_team_selection -> 'teamContexts'
      ) selected_context
      join public.sports_teams club_team
        on club_team.tenant_id = p_tenant_id
       and club_team.source_connection_id = p_match.source_connection_id
       and club_team.external_id = selected_context ->> 'providerTeamId'
       and club_team.active
      where case match_location
          when 'home' then selected_context ->> 'providerTeamId' =
            p_match.home_team ->> 'externalId'
          when 'away' then selected_context ->> 'providerTeamId' =
            p_match.away_team ->> 'externalId'
          else selected_context ->> 'providerTeamId' in (
            p_match.home_team ->> 'externalId',
            p_match.away_team ->> 'externalId'
          )
        end
        and (
          selected_context ->> 'competitionSelectionMode' = 'auto_current'
          or (
            p_match.competition ->> 'externalId'
              is not distinct from selected_context ->> 'competitionId'
            and (
              selected_context ->> 'phaseId' is null
              or p_match.competition ->> 'period' =
                selected_context ->> 'phaseId'
            )
            and (
              selected_context ->> 'poolId' is null
              or p_match.pool ->> 'externalId' =
                selected_context ->> 'poolId'
              or p_match.pool ->> 'poolExternalId' =
                selected_context ->> 'poolId'
            )
            and (
              selected_context ->> 'seasonId' is null
              or p_match.competition ->> 'season' =
                selected_context ->> 'seasonId'
            )
          )
        )
    );
  end if;

  if p_team_selection ->> 'mode' = 'all' then
    return exists (
      select 1
      from public.sports_teams club_team
      where club_team.tenant_id = p_tenant_id
        and club_team.source_connection_id = p_match.source_connection_id
        and club_team.active
        and case match_location
          when 'home' then club_team.external_id =
            p_match.home_team ->> 'externalId'
          when 'away' then club_team.external_id =
            p_match.away_team ->> 'externalId'
          else club_team.external_id in (
            p_match.home_team ->> 'externalId',
            p_match.away_team ->> 'externalId'
          )
        end
        and (
          not exists (
            select 1
            from pg_catalog.jsonb_array_elements(
              p_team_selection -> 'teamContexts'
            ) team_override
            where team_override ->> 'providerTeamId' = club_team.external_id
          )
          or exists (
            select 1
            from pg_catalog.jsonb_array_elements(
              p_team_selection -> 'teamContexts'
            ) team_override
            where team_override ->> 'providerTeamId' = club_team.external_id
              and p_match.competition ->> 'externalId'
                is not distinct from team_override ->> 'competitionId'
              and (
                team_override ->> 'phaseId' is null
                or p_match.competition ->> 'period' =
                  team_override ->> 'phaseId'
              )
              and (
                team_override ->> 'poolId' is null
                or p_match.pool ->> 'externalId' =
                  team_override ->> 'poolId'
                or p_match.pool ->> 'poolExternalId' =
                  team_override ->> 'poolId'
              )
              and (
                team_override ->> 'seasonId' is null
                or p_match.competition ->> 'season' =
                  team_override ->> 'seasonId'
              )
          )
        )
    );
  end if;
  return false;
end;
$$;

revoke all on function private.sportlink_match_matches_team_selection_v1(
  uuid, uuid, public.sports_matches, jsonb
) from public, anon, authenticated, service_role;

-- S153 already owns the canonical 100-item refill and logo projection. Wrap
-- it instead of duplicating that logic: legacy club slides become an explicit
-- all-own-teams selection and every missing direction remains compatible as
-- both. No persisted version or historical snapshot is rewritten.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s154_club_match_scope;

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
  match_location text;
  normalized_slide public.dynamic_slides := p_slide;
  team_selection jsonb;
  result jsonb;
begin
  if blueprint is null or blueprint not in (
    'sportlink.club_schedule_today',
    'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today',
    'sportlink.club_results_previous_7_days'
  ) then
    return private.build_dynamic_snapshot_data_before_s154_club_match_scope(
      p_slide
    );
  end if;

  team_selection := p_slide.configuration_json -> 'teamSelection';
  if pg_catalog.jsonb_typeof(team_selection) is distinct from 'object' then
    team_selection := pg_catalog.jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'all',
      'teamContexts', '[]'::jsonb
    );
  elsif not private.sportlink_team_selection_is_valid_v1(
    p_slide.tenant_id,
    p_slide.data_source_id,
    team_selection
  ) then
    -- Historical hand-written configurations must never crash a refresh or
    -- reopen the pre-S153 broad club feed. An invalid explicit selection is
    -- therefore normalized to an empty, fail-closed selection for runtime
    -- only; the persisted immutable version remains untouched.
    team_selection := pg_catalog.jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', '[]'::jsonb
    );
  else
    match_location := coalesce(team_selection ->> 'matchLocation', 'both');
    team_selection := team_selection || pg_catalog.jsonb_build_object(
      'matchLocation', match_location
    );
  end if;
  match_location := team_selection ->> 'matchLocation';

  normalized_slide.configuration_json := pg_catalog.jsonb_set(
    p_slide.configuration_json,
    '{teamSelection}',
    team_selection,
    true
  );
  result := private.build_dynamic_snapshot_data_before_s154_club_match_scope(
    normalized_slide
  );
  return pg_catalog.jsonb_set(
    result,
    '{sport,matchLocation}',
    pg_catalog.to_jsonb(match_location),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s154_club_match_scope(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

-- The generic provider queue deliberately pauses whenever an author has an
-- unpublished draft because dynamic_slides mirrors that editable draft. This
-- repair queue instead materializes the exact immutable published version, so
-- a harmless open authoring draft cannot keep already-published club content
-- on the unsafe pre-S154 match scope.
create function private.queue_club_match_scope_snapshots_v1(
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
      and version.selection_mode = 'latest'
      and version.configuration_json ->> 'blueprintKey' in (
        'sportlink.club_schedule_today',
        'sportlink.club_schedule_next_7_days',
        'sportlink.club_results_today',
        'sportlink.club_results_previous_7_days'
      )
    order by slide.id
    for update of slide
  loop
    -- Never render fields mirrored from an open authoring draft. The current
    -- published version is the sole runtime source for this corrective pass.
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
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      p_tenant_id,
      'dynamic.snapshot.auto_queued',
      'dynamic_data_sources',
      p_data_source_id,
      'success',
      pg_catalog.jsonb_build_object(
        'systemExecuted', true,
        'reason', 's154_club_own_team_match_scope',
        'queuedCount', queued_count,
        'publishedVersionOnly', true
      )
    );
  end if;
  return queued_count;
end;
$$;

revoke all on function private.queue_club_match_scope_snapshots_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;

-- Re-evaluate existing latest-mode club slides immediately. Content hashes
-- keep this idempotent; the S146 worker promotes only completed replacement
-- renders through a new immutable release, preserving every current Player LKG
-- until verification succeeds. An open authoring draft remains untouched while
-- its already-published version is corrected independently.
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
end;
$$;
