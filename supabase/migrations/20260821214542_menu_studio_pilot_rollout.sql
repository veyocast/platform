-- S113 Menu Studio pilot rollout. Binary deployment and tenant activation stay
-- separate. This owner-only command is called by the protected GitHub
-- environment workflow and records the GitHub operator and reason in audit.

create or replace function private.set_menu_studio_pilot_flag_v1(
  p_tenant_name text,
  p_flag text,
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
  settings public.tenant_settings%rowtype;
  previous_value boolean;
begin
  if p_tenant_name is null
    or length(btrim(p_tenant_name)) not between 2 and 120
  then
    raise exception 'pilot tenant name is invalid' using errcode = '22023';
  end if;
  if p_flag not in (
    'read', 'authoring', 'linked_groups', 'media', 'publish', 'player'
  ) then
    raise exception 'Menu Studio pilot flag is invalid' using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'Menu Studio pilot flag value is required' using errcode = '22023';
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

  insert into public.tenant_settings (tenant_id)
  values (matched_tenant_id)
  on conflict (tenant_id) do nothing;

  select * into settings
  from public.tenant_settings tenant_settings
  where tenant_settings.tenant_id = matched_tenant_id
  for update;

  previous_value := case p_flag
    when 'read' then settings.menu_document_v2_read_enabled
    when 'authoring' then settings.menu_studio_v2_authoring_enabled
    when 'linked_groups' then settings.menu_studio_v2_linked_groups_enabled
    when 'media' then settings.menu_studio_v2_media_enabled
    when 'publish' then settings.menu_studio_v2_publish_enabled
    when 'player' then settings.menu_studio_v2_player_enabled
  end;

  if previous_value = p_enabled then
    return jsonb_build_object(
      'changed', false,
      'enabled', p_enabled,
      'flag', p_flag
    );
  end if;

  if p_enabled then
    if p_flag <> 'read' and not settings.menu_document_v2_read_enabled then
      raise exception 'enable MenuDocument.v2 read first' using errcode = '55000';
    end if;
    if p_flag in ('linked_groups', 'media', 'publish', 'player')
      and not settings.menu_studio_v2_authoring_enabled
    then
      raise exception 'enable Menu Studio authoring first' using errcode = '55000';
    end if;
    if p_flag = 'player' and not settings.menu_studio_v2_publish_enabled then
      raise exception 'enable Menu Studio publish first' using errcode = '55000';
    end if;
  else
    if p_flag = 'read' and (
      settings.menu_studio_v2_authoring_enabled
      or settings.menu_studio_v2_linked_groups_enabled
      or settings.menu_studio_v2_media_enabled
      or settings.menu_studio_v2_publish_enabled
      or settings.menu_studio_v2_player_enabled
    ) then
      raise exception 'disable dependent Menu Studio flags first' using errcode = '55000';
    end if;
    if p_flag = 'authoring' and (
      settings.menu_studio_v2_linked_groups_enabled
      or settings.menu_studio_v2_media_enabled
      or settings.menu_studio_v2_publish_enabled
      or settings.menu_studio_v2_player_enabled
    ) then
      raise exception 'disable dependent Menu Studio capabilities first' using errcode = '55000';
    end if;
    if p_flag = 'publish' and settings.menu_studio_v2_player_enabled then
      raise exception 'disable Menu Studio player first' using errcode = '55000';
    end if;
  end if;

  update public.tenant_settings tenant_settings
  set
    menu_document_v2_read_enabled = case
      when p_flag = 'read' then p_enabled
      else tenant_settings.menu_document_v2_read_enabled
    end,
    menu_studio_v2_authoring_enabled = case
      when p_flag = 'authoring' then p_enabled
      else tenant_settings.menu_studio_v2_authoring_enabled
    end,
    menu_studio_v2_linked_groups_enabled = case
      when p_flag = 'linked_groups' then p_enabled
      else tenant_settings.menu_studio_v2_linked_groups_enabled
    end,
    menu_studio_v2_media_enabled = case
      when p_flag = 'media' then p_enabled
      else tenant_settings.menu_studio_v2_media_enabled
    end,
    menu_studio_v2_publish_enabled = case
      when p_flag = 'publish' then p_enabled
      else tenant_settings.menu_studio_v2_publish_enabled
    end,
    menu_studio_v2_player_enabled = case
      when p_flag = 'player' then p_enabled
      else tenant_settings.menu_studio_v2_player_enabled
    end,
    updated_at = now()
  where tenant_settings.tenant_id = matched_tenant_id;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) values (
    matched_tenant_id,
    null,
    'menu_studio.pilot_flag.updated',
    'tenant_settings',
    matched_tenant_id,
    'success',
    jsonb_build_object(
      'enabled', p_enabled,
      'flag', p_flag,
      'from', previous_value,
      'operator', p_operator,
      'reason', btrim(p_reason),
      'workflowRun', p_workflow_run_url
    )
  );

  return jsonb_build_object(
    'changed', true,
    'enabled', p_enabled,
    'flag', p_flag
  );
end;
$$;

revoke all on function private.set_menu_studio_pilot_flag_v1(
  text, text, boolean, text, text, text
) from public, anon, authenticated, service_role;
