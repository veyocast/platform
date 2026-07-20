create or replace function private.current_aal()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
    'aal1'
  );
$$;

create or replace function private.require_aal2_for_platform_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is not null
    and private.current_aal() <> 'aal2'
    and (
      tg_table_name = 'platform_memberships'
      or tg_op <> 'UPDATE'
      or (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status')
    )
  then
    raise exception 'sensitive platform mutations require aal2' using errcode = '42501';
  end if;

  if private.current_user_id() is not null
    and tg_table_name = 'tenants'
    and tg_op = 'UPDATE'
    and (to_jsonb(old) ->> 'status') is not distinct from (to_jsonb(new) ->> 'status')
    and (to_jsonb(old) ->> 'status') <> 'active'
  then
    raise exception 'tenant mutations require an active tenant' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.require_active_tenant_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
  target_status public.tenant_status;
begin
  if private.current_user_id() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  target_tenant_id := coalesce(
    nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid,
    nullif(to_jsonb(old) ->> tg_argv[0], '')::uuid
  );

  if target_tenant_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select tenant.status
  into target_status
  from public.tenants tenant
  where tenant.id = target_tenant_id;

  if target_status is distinct from 'active'::public.tenant_status then
    raise exception 'tenant mutations require an active tenant' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.current_aal() from public, anon;
revoke all on function private.require_aal2_for_platform_mutation() from public, anon, authenticated;
revoke all on function private.require_active_tenant_mutation() from public, anon, authenticated;
grant execute on function private.current_aal() to authenticated, service_role;

drop trigger if exists tenants_require_aal2 on public.tenants;
create trigger tenants_require_aal2
before insert or update or delete on public.tenants
for each row execute function private.require_aal2_for_platform_mutation();

drop trigger if exists platform_memberships_require_aal2 on public.platform_memberships;
create trigger platform_memberships_require_aal2
before insert or update or delete on public.platform_memberships
for each row execute function private.require_aal2_for_platform_mutation();

drop trigger if exists tenant_memberships_require_active_tenant on public.tenant_memberships;
create trigger tenant_memberships_require_active_tenant
before insert or update or delete on public.tenant_memberships
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists tenant_invitations_require_active_tenant on public.tenant_invitations;
create trigger tenant_invitations_require_active_tenant
before insert or update or delete on public.tenant_invitations
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists tenant_settings_require_active_tenant on public.tenant_settings;
create trigger tenant_settings_require_active_tenant
before insert or update or delete on public.tenant_settings
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists media_assets_require_active_tenant on public.media_assets;
create trigger media_assets_require_active_tenant
before insert or update or delete on public.media_assets
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists media_upload_sessions_require_active_tenant on public.media_upload_sessions;
create trigger media_upload_sessions_require_active_tenant
before insert or update or delete on public.media_upload_sessions
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists media_variants_require_active_tenant on public.media_variants;
create trigger media_variants_require_active_tenant
before insert or update or delete on public.media_variants
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists media_processing_jobs_require_active_tenant on public.media_processing_jobs;
create trigger media_processing_jobs_require_active_tenant
before insert or update or delete on public.media_processing_jobs
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists playlists_require_active_tenant on public.playlists;
create trigger playlists_require_active_tenant
before insert or update or delete on public.playlists
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists playlist_items_require_active_tenant on public.playlist_items;
create trigger playlist_items_require_active_tenant
before insert or update or delete on public.playlist_items
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists playlist_releases_require_active_tenant on public.playlist_releases;
create trigger playlist_releases_require_active_tenant
before insert or update or delete on public.playlist_releases
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists playlist_release_items_require_active_tenant on public.playlist_release_items;
create trigger playlist_release_items_require_active_tenant
before insert or update or delete on public.playlist_release_items
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists screens_require_active_tenant on public.screens;
create trigger screens_require_active_tenant
before insert or update or delete on public.screens
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists player_devices_require_active_tenant on public.player_devices;
create trigger player_devices_require_active_tenant
before insert or update or delete on public.player_devices
for each row execute function private.require_active_tenant_mutation('tenant_id');

drop trigger if exists pairing_sessions_require_active_tenant on public.pairing_sessions;
create trigger pairing_sessions_require_active_tenant
before insert or update or delete on public.pairing_sessions
for each row execute function private.require_active_tenant_mutation('claimed_tenant_id');
