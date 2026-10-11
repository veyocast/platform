-- One authoring boundary for guarded commands and direct RLS table writes.
-- Existing null configurations retain their legacy playback behavior.
alter function private.sites_configuration_is_valid_v1(jsonb)
  rename to sites_configuration_valid_before_placement_guard_v1;
create function private.sites_configuration_is_valid_v1(p_sites jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare background jsonb:=p_sites->'background';
begin
  if p_sites->'schemaVersion' is distinct from '1'::jsonb
    or not private.sites_configuration_valid_before_placement_guard_v1(p_sites)
    then return false;end if;
  if p_sites?'background' then
    if jsonb_typeof(background)is distinct from 'object' then return false;end if;
    if jsonb_typeof(background->'kind')is distinct from 'string'
      or coalesce(background->>'kind','')not in('tenant','system')
      or jsonb_typeof(background->'checksumSha256')is distinct from 'string'
      or(select count(*)from jsonb_object_keys(background))<>3
      then return false;end if;
    if background->>'kind'='tenant' then
      if jsonb_typeof(background->'mediaAssetId')is distinct from 'string' then return false;end if;
    elsif jsonb_typeof(background->'path')is distinct from 'string' then return false;end if;
  end if;
  return true;
end $$;
revoke all on function private.sites_configuration_is_valid_v1(jsonb),
  private.sites_configuration_valid_before_placement_guard_v1(jsonb)
  from public,anon,authenticated,service_role;

create function private.enforce_playlist_sites_configuration_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.sites_configuration_json is null then return new;end if;
  if tg_op='UPDATE' then
    if new.sites_configuration_json is not distinct from old.sites_configuration_json
      and new.tenant_id is not distinct from old.tenant_id then return new;end if;
  end if;
  if not private.sites_configuration_is_valid_v1(new.sites_configuration_json)then
    raise exception 'placement configuration invalid'using errcode='23514';
  end if;
  perform private.assert_sites_assets_v1(new.tenant_id,new.sites_configuration_json);
  return new;
end $$;
revoke all on function private.enforce_playlist_sites_configuration_v1()
  from public,anon,authenticated,service_role;
create trigger playlist_items_sites_configuration_guard
  before insert or update of sites_configuration_json,tenant_id on public.playlist_items
  for each row execute function private.enforce_playlist_sites_configuration_v1();
-- Freeze runs as zz_release_item_sites_configuration; validate its actual result.
create trigger zzz_release_item_sites_configuration_guard
  before insert on public.playlist_release_items
  for each row execute function private.enforce_playlist_sites_configuration_v1();
