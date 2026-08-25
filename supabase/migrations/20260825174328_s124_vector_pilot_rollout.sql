-- S124: make the already deployed Vector tenant experience an actual audited
-- cohort. Binary deployment and tenant activation remain separate. The existing
-- platform-admin feature command remains unchanged for backward compatibility.

create or replace function private.set_vector_pilot_profile_v1(
  p_tenant_name text,
  p_enabled boolean,
  p_reason text,
  p_operator text,
  p_workflow_run_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_tenant_id uuid;
  matched_tenant_status public.tenant_status;
  changed_count integer := 0;
  core_flags constant text[] := array[
    'vector_v2_design_system',
    'vector_v2_control_shell',
    'unified_resource_picker',
    'unified_filter_dock',
    'venue_twin',
    'screen_health_view',
    'engage'
  ];
begin
  if p_tenant_name is null
    or length(btrim(p_tenant_name)) not between 2 and 120
  then
    raise exception 'pilot tenant name is invalid' using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'Vector pilot value is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 240 then
    raise exception 'pilot rollout reason is invalid' using errcode = '22023';
  end if;
  if p_operator is null or p_operator !~ '^github:[A-Za-z0-9-]{1,39}$' then
    raise exception 'pilot rollout operator is invalid' using errcode = '22023';
  end if;
  if p_workflow_run_url is null
    or p_workflow_run_url !~ '^https://github[.]com/veyocast/platform/actions/runs/[0-9]+$'
  then
    raise exception 'pilot rollout workflow run is invalid' using errcode = '22023';
  end if;

  begin
    select tenant.id, tenant.status
    into strict matched_tenant_id, matched_tenant_status
    from public.tenants tenant
    where lower(btrim(tenant.name)) = lower(btrim(p_tenant_name))
    for update;
  exception
    when no_data_found then
      raise exception 'pilot tenant not found' using errcode = 'P0002';
    when too_many_rows then
      raise exception 'pilot tenant name is not unique' using errcode = '21000';
  end;
  if matched_tenant_status <> 'active'::public.tenant_status then
    raise exception 'pilot tenant is not active' using errcode = '55000';
  end if;

  with requested as (
    select unnest(core_flags) as flag_key
  ), previous as (
    select requested.flag_key,
           coalesce(flag.enabled, false) as enabled
    from requested
    left join public.tenant_feature_flags flag
      on flag.tenant_id = matched_tenant_id
     and flag.flag_key = requested.flag_key
  ), changed as (
    insert into public.tenant_feature_flags (
      tenant_id, flag_key, enabled, rollout_reason, changed_by
    )
    select matched_tenant_id, previous.flag_key, p_enabled, btrim(p_reason), null
    from previous
    where previous.enabled is distinct from p_enabled
    on conflict (tenant_id, flag_key) do update
    set enabled = excluded.enabled,
        rollout_reason = excluded.rollout_reason,
        changed_by = null,
        updated_at = now()
    returning 1
  )
  select count(*) into changed_count from changed;

  if changed_count > 0 then
    insert into public.audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, result, metadata
    ) values (
      matched_tenant_id,
      null,
      'vector.pilot_profile.updated',
      'tenant_feature_flags',
      matched_tenant_id,
      'success',
      jsonb_build_object(
        'enabled', p_enabled,
        'flags', to_jsonb(core_flags),
        'operator', p_operator,
        'reason', btrim(p_reason),
        'workflowRun', p_workflow_run_url,
        'changedCount', changed_count
      )
    );
  end if;

  return jsonb_build_object(
    'changedCount', changed_count,
    'enabled', p_enabled,
    'flagCount', cardinality(core_flags),
    'tenantId', matched_tenant_id
  );
end;
$$;

revoke all on function private.set_vector_pilot_profile_v1(
  text, boolean, text, text, text
) from public, anon, authenticated, service_role;

comment on function private.set_vector_pilot_profile_v1(
  text, boolean, text, text, text
) is 'Owner-only Vector pilot cohort command for the protected GitHub environment workflow.';
