-- Additive saved menu style; existing configurations retain their output.
begin;
alter function private.sites_configuration_is_valid_v1(jsonb)
 rename to sites_configuration_before_approved_menu_v1;
create function private.sites_configuration_is_valid_v1(p_sites jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select case when p_sites?'onzeTrotsStyle' then coalesce(
  p_sites->>'provider'='menu' and p_sites->'menuWidgets'='true'::jsonb
  and jsonb_typeof(p_sites->'onzeTrotsStyle')='string'
  and p_sites->>'onzeTrotsStyle' in('v9-marker-light','v9-marker-dark')
  and private.sites_configuration_before_approved_menu_v1(p_sites-'onzeTrotsStyle'),false)
 else private.sites_configuration_before_approved_menu_v1(p_sites) end
$$;
revoke all on function private.sites_configuration_is_valid_v1(jsonb),
 private.sites_configuration_before_approved_menu_v1(jsonb)
 from public,anon,authenticated,service_role;
commit;
