create or replace function public.create_platform_tenant(
  p_name text,
  p_slug text,
  p_screen_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
  tenant_id uuid;
begin
  if actor_id is null then
    raise exception 'tenant creation requires an authenticated user' using errcode = '42501';
  end if;

  if not private.is_platform_member(array[
    'platform_owner',
    'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot create tenants' using errcode = '42501';
  end if;

  if normalized_name is null
    or length(normalized_name) < 2
    or length(normalized_name) > 120
  then
    raise exception 'tenant name must contain 2 to 120 characters' using errcode = '23514';
  end if;

  if normalized_slug is null
    or length(normalized_slug) > 64
    or normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
  then
    raise exception 'tenant slug must contain 3 to 64 lowercase characters' using errcode = '23514';
  end if;

  if p_screen_limit is null or p_screen_limit < 1 or p_screen_limit > 10000 then
    raise exception 'tenant screen limit must be between 1 and 10000' using errcode = '23514';
  end if;

  insert into public.tenants (
    name,
    slug,
    status,
    screen_limit
  )
  values (
    normalized_name,
    normalized_slug,
    'active'::public.tenant_status,
    p_screen_limit
  )
  returning id into tenant_id;

  insert into public.tenant_settings (
    tenant_id,
    updated_by
  )
  values (
    tenant_id,
    actor_id
  );

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    created_by
  )
  values (
    tenant_id,
    actor_id,
    'tenant_owner'::public.tenant_role,
    actor_id
  );

  perform private.audit_event(
    tenant_id,
    'tenant.created',
    'tenants',
    tenant_id,
    'success',
    jsonb_build_object(
      'screenLimit', p_screen_limit
    )
  );

  return tenant_id;
exception
  when unique_violation then
    raise exception 'tenant slug already exists' using errcode = '23505';
end;
$$;

revoke all on function public.create_platform_tenant(text, text, integer) from public, anon;
grant execute on function public.create_platform_tenant(text, text, integer) to authenticated;
