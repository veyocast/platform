-- S191: create a screen and its optional group membership in one acknowledged command.
-- The original release validator, screen limit and physical-device pairing remain authoritative.
create function public.create_screen_onboarding_v2(
  p_tenant_id uuid,
  p_name text,
  p_location text,
  p_orientation text,
  p_resolution_width integer,
  p_resolution_height integer,
  p_initial_release_id uuid default null,
  p_group_id uuid default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request jsonb;
  replay jsonb;
  screen_id uuid;
begin
  if private.current_user_id() is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'screen management required' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or p_orientation is null or p_orientation not in ('landscape', 'portrait')
    or p_resolution_width is null or p_resolution_height is null
  then
    raise exception 'screen onboarding input invalid' using errcode = '23514';
  end if;
  request := jsonb_build_object(
    'name', p_name, 'location', p_location, 'orientation', p_orientation,
    'width', p_resolution_width, 'height', p_resolution_height,
    'initialReleaseId', p_initial_release_id, 'groupId', p_group_id
  );
  replay := private.begin_publisher_command(p_tenant_id, 'screen.onboarding.v2', p_idempotency_key, request);
  if replay is not null then
    return (replay ->> 'screenId')::uuid;
  end if;
  if p_group_id is not null then
    perform id from public.screen_groups
    where tenant_id = p_tenant_id and id = p_group_id and status = 'active'
    for update;
    if not found then
      raise exception 'screen group unavailable in tenant' using errcode = '42501';
    end if;
  end if;
  screen_id := public.create_screen_from_current_release_v1(
    p_tenant_id, p_name, p_location, p_orientation,
    p_resolution_width, p_resolution_height, p_initial_release_id
  );
  if p_group_id is not null then
    insert into public.screen_group_memberships(tenant_id, screen_group_id, screen_id, created_by)
    values(p_tenant_id, p_group_id, screen_id, private.current_user_id());
    -- Invalidate a concurrently reviewed group editor without changing its default release.
    update public.screen_groups set revision = revision + 1,
      updated_by = private.current_user_id(), updated_at = now()
    where tenant_id = p_tenant_id and id = p_group_id;
  end if;
  perform private.complete_publisher_command(
    p_tenant_id, 'screen.onboarding.v2', p_idempotency_key, request, 'screens', screen_id,
    jsonb_build_object('outcome', 'created', 'screenId', screen_id, 'groupId', p_group_id),
    'publisher.screen.onboarding.created', 'success'
  );
  return screen_id;
end;
$$;
revoke all on function public.create_screen_onboarding_v2(uuid,text,text,text,integer,integer,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_screen_onboarding_v2(uuid,text,text,text,integer,integer,uuid,uuid,uuid)
  to authenticated;
select pg_catalog.pg_notify('pgrst', 'reload schema');
