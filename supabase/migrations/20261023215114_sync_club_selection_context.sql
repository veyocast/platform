-- S287: align guarded Sync writes with the canonical Sportlink preview.
-- No stored configuration, publication, snapshot or receipt is rewritten.
begin;
CREATE OR REPLACE FUNCTION private.enforce_sportlink_arrival_team_contexts_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  blueprint text := new.configuration_json ->> 'blueprintKey';
  is_sync boolean := new.configuration_json ? 'syncConfiguration';
  -- Sync uses a typed selection for these single-context/birthday families.
  -- Legacy configurations keep their existing blueprint-only contract.
  is_sync_context_selection boolean := is_sync and new.slide_type in (
    'sport_period_standing', 'sport_match_of_the_day', 'sport_next_match',
    'sport_cancellations', 'sport_dressing_rooms', 'sport_officials',
    'sport_birthdays'
  );
  is_arrival boolean := coalesce(
    blueprint in (
      'sportlink.visitor_arrivals',
      'sportlink.referee_arrivals'
    ),
    false
  );
  is_club_aggregate boolean := coalesce(
    blueprint in (
      'sportlink.club_schedule_today',
      'sportlink.club_schedule_next_7_days',
      'sportlink.club_results_today',
      'sportlink.club_results_previous_7_days'
    ),
    false
  );
begin
  if is_sync and new.configuration_json ? 'teamSelection' then
    -- The new branch is available only to a strictly validated Sync seed;
    -- presence of a client-supplied marker alone never bypasses the old guard.
    perform private.assert_sync_dynamic_configuration_v1(
      new.tenant_id, new.slide_type, new.orientation,
      new.configuration_json -> 'syncConfiguration'
    );
  end if;
  if new.status = 'publishing'
    and is_arrival
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection must be saved before publishing'
      using errcode = '23514';
  end if;
  if new.status = 'publishing'
    and is_club_aggregate
    and not new.configuration_json ? 'teamSelection'
  then
    raise exception 'Sportlink club-wide team selection must be saved before publishing'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.configuration_json ? 'teamContexts'
    and is_arrival
    and not new.configuration_json ? 'teamContexts'
  then
    raise exception 'Sportlink linked team selection cannot be removed'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE'
    and old.configuration_json ? 'teamSelection'
    and is_club_aggregate
    and not new.configuration_json ? 'teamSelection'
  then
    raise exception 'Sportlink club-wide team selection cannot be removed'
      using errcode = '23514';
  end if;

  if new.configuration_json ? 'teamContexts' and not is_arrival then
    raise exception 'Sportlink linked team selection is only valid for arrival slides'
      using errcode = '23514';
  end if;
  if new.configuration_json ? 'teamSelection'
    and not is_club_aggregate and not is_sync_context_selection then
    raise exception 'Sportlink club-wide team selection is only valid for club match slides'
      using errcode = '23514';
  end if;

  if is_arrival and new.configuration_json ? 'teamContexts' then
    if not private.sportlink_team_contexts_are_valid_v2(
      new.tenant_id,
      new.data_source_id,
      new.configuration_json -> 'teamContexts'
    ) then
      raise exception 'Sportlink linked team selection is invalid'
        using errcode = '23514';
    end if;
    if pg_catalog.jsonb_typeof(
      new.configuration_json -> 'context'
    ) is distinct from 'object'
      or new.configuration_json -> 'context'
        is distinct from new.configuration_json #> '{teamContexts,0}'
    then
      raise exception 'Sportlink primary context must match the first selected team'
        using errcode = '23514';
    end if;
  end if;

  if (is_club_aggregate or is_sync_context_selection)
    and new.configuration_json ? 'teamSelection' then
    if not private.sportlink_team_selection_is_valid_v1(
      new.tenant_id,
      new.data_source_id,
      new.configuration_json -> 'teamSelection'
    )
      or (
        -- All teams has no primary team. Preview already follows this rule.
        -- Selected teams and any explicit context still require source-bound
        -- validation; historical non-Sync authoring retains its old contract.
        (not is_sync
          or new.configuration_json #>> '{teamSelection,mode}' = 'selected'
          or new.configuration_json ? 'context')
        and not private.sportlink_team_contexts_are_valid_v2(
          new.tenant_id,
          new.data_source_id,
          jsonb_build_array(new.configuration_json -> 'context')
        )
      )
    then
      raise exception 'Sportlink club-wide team selection is invalid'
        using errcode = '23514';
    end if;
    if new.configuration_json #>> '{teamSelection,mode}' = 'selected'
      and new.configuration_json -> 'context'
        is distinct from new.configuration_json #> '{teamSelection,teamContexts,0}'
    then
      raise exception 'Sportlink primary context must match the first selected team'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;


revoke all on function private.enforce_sportlink_arrival_team_contexts_v1()
  from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
