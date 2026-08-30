-- S138: make the birthday team selection explicit without mutating published
-- releases. The previous snapshot builder removed teamIds together with the
-- visible team label, so the shared Player resolver could filter an already
-- server-filtered item a second time. New snapshots keep private-free team IDs
-- as filter metadata and can include people without an exact team assignment.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s138_birthday_team_selection;

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
  config jsonb := coalesce(
    p_slide.configuration_json -> 'birthday',
    '{}'::jsonb
  );
  include_without_team boolean;
  result jsonb;
  safe_items jsonb;
  selected_team_ids text[] := array(
    select jsonb_array_elements_text(
      coalesce(config #> '{selection,selectedTeamIds}', '[]'::jsonb)
    )
  );
  show_team boolean := coalesce(
    (config #>> '{selection,showTeam}')::boolean,
    true
  );
  source_config jsonb;
  source_slide public.dynamic_slides := p_slide;
  team_selection_mode text;
begin
  if p_slide.slide_type <> 'sport_birthdays'
    or p_slide.configuration_json ->> 'blueprintKey'
      is distinct from 'sportlink.birthdays' then
    return private.build_dynamic_snapshot_data_before_s138_birthday_team_selection(
      p_slide
    );
  end if;

  team_selection_mode := config #>> '{selection,teamSelectionMode}';
  if team_selection_mode is null
    or team_selection_mode not in ('all', 'selected') then
    team_selection_mode := case
      when cardinality(selected_team_ids) = 0 then 'all'
      else 'selected'
    end;
  end if;
  include_without_team := case config #>> '{selection,includeWithoutTeam}'
    when 'true' then true
    when 'false' then false
    else team_selection_mode = 'all'
  end;

  -- Ask the established builder for the complete, safely enriched birthday
  -- set. This wrapper then applies the explicit team/without-team selection
  -- once and restores the exact author configuration in the snapshot.
  source_config := jsonb_set(
    config,
    '{selection}',
    coalesce(config -> 'selection', '{}'::jsonb) || jsonb_build_object(
      'selectedTeamIds', '[]'::jsonb,
      'showTeam', true
    ),
    true
  );
  source_slide.configuration_json := jsonb_set(
    p_slide.configuration_json,
    '{birthday}',
    source_config,
    true
  );
  result := private.build_dynamic_snapshot_data_before_s138_birthday_team_selection(
    source_slide
  );

  select coalesce(
    jsonb_agg(
      case
        when show_team then birthday.value
        else jsonb_set(
          jsonb_set(
            jsonb_set(
              birthday.value,
              '{teams}',
              '[]'::jsonb,
              true
            ),
            '{teamIds}',
            coalesce(birthday.value -> 'teamIds', '[]'::jsonb),
            true
          ),
          '{meta}',
          to_jsonb(coalesce(birthday.value ->> 'role', '')),
          true
        )
      end
      order by birthday.ordinality
    ),
    '[]'::jsonb
  )
  into safe_items
  from jsonb_array_elements(
    coalesce(result #> '{sport,birthdays}', '[]'::jsonb)
  ) with ordinality as birthday(value, ordinality)
  where case
    when team_selection_mode = 'all' then
      include_without_team
      or jsonb_array_length(
        coalesce(birthday.value -> 'teamIds', '[]'::jsonb)
      ) > 0
    else
      (
        include_without_team
        and jsonb_array_length(
          coalesce(birthday.value -> 'teamIds', '[]'::jsonb)
        ) = 0
      )
      or exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(birthday.value -> 'teamIds', '[]'::jsonb)
        ) as team_id(value)
        where team_id.value = any(selected_team_ids)
      )
  end;

  result := jsonb_set(result, '{sport,items}', safe_items, true);
  result := jsonb_set(result, '{sport,birthdays}', safe_items, true);
  result := jsonb_set(result, '{sport,configuration}', config, true);
  if jsonb_array_length(safe_items) = 0 then
    result := jsonb_set(
      result,
      '{sport,emptyStateCode}',
      to_jsonb('NO_BIRTHDAYS_IN_PERIOD'::text),
      true
    );
  end if;
  return result;
end;
$$;

-- Readiness is a server-side invariant as well as wizard guidance. A direct
-- RPC call may not create a living slide before public_people has established
-- its first Last Known Good synchronization.
alter function public.create_sportlink_birthday_slide_v1(
  uuid, uuid, text, uuid, jsonb
) rename to create_sportlink_birthday_slide_before_s138_readiness;
alter function public.create_sportlink_birthday_slide_before_s138_readiness(
  uuid, uuid, text, uuid, jsonb
) set schema private;

create or replace function public.create_sportlink_birthday_slide_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_configuration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  if not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'sportlink_birthday_slide_write_required'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  select * into connection
  from public.sportlink_connections candidate
  where candidate.tenant_id = p_tenant_id
    and candidate.data_source_id = p_data_source_id
    and candidate.status = 'active';
  if connection.id is null
    or not connection.privacy_birthdays_enabled
    or not private.tenant_feature_enabled_v1(
      p_tenant_id,
      'sportlink_birthdays'
    ) then
    raise exception 'sportlink_birthdays_not_active' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.sportlink_sync_policies policy
    where policy.tenant_id = p_tenant_id
      and policy.connection_id = connection.id
      and policy.dataset_group = 'public_people'
      and policy.last_success_at is not null
  ) or not exists (
    select 1
    from public.sportlink_capabilities capability
    where capability.tenant_id = p_tenant_id
      and capability.connection_id = connection.id
      and capability.article_key = 'verjaardagen'
      and capability.capability = 'birthdays'
      and capability.available
      and capability.last_status_code = 200
  ) then
    raise exception 'sportlink_birthdays_sync_required' using errcode = '55000';
  end if;

  return private.create_sportlink_birthday_slide_before_s138_readiness(
    p_tenant_id,
    p_data_source_id,
    p_name,
    p_template_version_id,
    p_configuration
  );
end;
$$;

revoke all on function public.create_sportlink_birthday_slide_v1(
  uuid, uuid, text, uuid, jsonb
) from public, anon;
grant execute on function public.create_sportlink_birthday_slide_v1(
  uuid, uuid, text, uuid, jsonb
) to authenticated;
revoke all on function private.create_sportlink_birthday_slide_before_s138_readiness(
  uuid, uuid, text, uuid, jsonb
) from public, anon, authenticated;

-- Older generic public_people runs may already have populated the shared
-- policy timestamp. Expose lastSuccessAt only after the birthday completion
-- marker proves that the minimized birthday article itself succeeded.
alter function public.get_sportlink_birthday_status_v1(uuid)
  rename to get_sportlink_birthday_status_before_s138_readiness;
alter function public.get_sportlink_birthday_status_before_s138_readiness(uuid)
  set schema private;

create or replace function public.get_sportlink_birthday_status_v1(
  p_connection_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  birthday_sync_ready boolean;
begin
  result := private.get_sportlink_birthday_status_before_s138_readiness(
    p_connection_id
  );
  select exists (
    select 1
    from public.sportlink_capabilities capability
    where capability.connection_id = p_connection_id
      and capability.article_key = 'verjaardagen'
      and capability.capability = 'birthdays'
      and capability.available
      and capability.last_status_code = 200
  ) into birthday_sync_ready;
  if not birthday_sync_ready then
    result := jsonb_set(result, '{lastSuccessAt}', 'null'::jsonb, true);
    result := jsonb_set(result, '{freshness}', to_jsonb('never'::text), true);
  end if;
  return result;
end;
$$;

revoke all on function public.get_sportlink_birthday_status_v1(uuid)
  from public, anon;
grant execute on function public.get_sportlink_birthday_status_v1(uuid)
  to authenticated;
revoke all on function private.get_sportlink_birthday_status_before_s138_readiness(uuid)
  from public, anon, authenticated;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_s138_birthday_team_selection(
  public.dynamic_slides
) from public, anon, authenticated;

-- Existing latest-following slides receive a new immutable snapshot/release;
-- historical snapshots and releases remain byte-for-byte unchanged.
do $$
declare
  source_record record;
begin
  for source_record in
    select distinct slide.tenant_id, slide.data_source_id
    from public.dynamic_slides as slide
    where slide.slide_type = 'sport_birthdays'
      and slide.status <> 'archived'
      and slide.data_source_id is not null
  loop
    perform private.queue_latest_dynamic_snapshots_v2(
      source_record.tenant_id,
      source_record.data_source_id,
      array['sport_birthdays']::text[],
      'birthday_team_selection_v2'
    );
  end loop;
end;
$$;
