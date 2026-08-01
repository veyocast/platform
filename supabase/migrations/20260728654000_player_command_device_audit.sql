create or replace function private.audit_event(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_result text default 'success',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  actor_device_id uuid;
  command_id uuid;
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  event_id uuid;
begin
  if actor_id is null then
    if p_action in (
      'player_command.delivered',
      'player_command.expired',
      'player_command.failed',
      'player_command.completed'
    ) then
      if p_target_type <> 'screens'
        or coalesce(normalized_metadata ->> 'commandId', '') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'device audit command context is invalid'
          using errcode = '42501';
      end if;
      command_id := (normalized_metadata ->> 'commandId')::uuid;
      select command.device_id
      into actor_device_id
      from public.player_commands command
      where command.id = command_id
        and command.tenant_id = p_tenant_id
        and command.screen_id is not distinct from p_target_id;
    elsif p_action = 'player_device.self_unpaired'
      and p_target_type = 'player_devices'
      and p_target_id is not null
    then
      select device.id
      into actor_device_id
      from public.player_devices device
      where device.id = p_target_id
        and device.tenant_id = p_tenant_id;
    else
      raise exception 'audit_event requires an authenticated actor'
        using errcode = '42501';
    end if;

    if actor_device_id is null then
      raise exception 'device audit actor could not be verified'
        using errcode = '42501';
    end if;
  elsif p_tenant_id is not null
    and not (
      private.is_tenant_member(p_tenant_id)
      or private.is_platform_member(array[
        'platform_owner',
        'platform_admin',
        'platform_support'
      ]::public.platform_role[])
    )
  then
    raise exception 'actor cannot audit this tenant' using errcode = '42501';
  end if;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    actor_device_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  )
  values (
    p_tenant_id,
    actor_id,
    actor_device_id,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_result, 'success'),
    normalized_metadata
  )
  returning id into event_id;

  return event_id;
end;
$$;

comment on function private.audit_event(uuid, text, text, uuid, text, jsonb)
is 'Writes user audits and strictly verified Player-device command audits without granting devices direct audit access.';
