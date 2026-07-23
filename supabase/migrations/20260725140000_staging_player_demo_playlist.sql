create table public.platform_player_demo_playlists (
  environment text primary key check (environment = 'staging'),
  tenant_id uuid not null,
  playlist_id uuid not null,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, playlist_id)
    references public.playlists(tenant_id, id)
    on delete restrict
);

create index platform_player_demo_playlists_tenant_playlist_idx
  on public.platform_player_demo_playlists(tenant_id, playlist_id);

create trigger platform_player_demo_playlists_set_updated_at
before update on public.platform_player_demo_playlists
for each row execute function private.set_updated_at();

alter table public.platform_player_demo_playlists enable row level security;
alter table public.platform_player_demo_playlists force row level security;

revoke all on public.platform_player_demo_playlists from public, anon, authenticated;
grant select on public.platform_player_demo_playlists to authenticated;

create policy "platform_player_demo_playlists_select_by_owner"
on public.platform_player_demo_playlists
for select
to authenticated
using (
  private.is_platform_member(array['platform_owner']::public.platform_role[])
);

create or replace function public.set_staging_player_demo_playlist(
  p_tenant_id uuid,
  p_playlist_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_name text;
begin
  perform private.require_platform_owner_aal2();

  select playlist.name
  into playlist_name
  from public.playlists playlist
  join public.tenants tenant
    on tenant.id = playlist.tenant_id
  where playlist.tenant_id = p_tenant_id
    and playlist.id = p_playlist_id
    and playlist.status <> 'archived'::public.playlist_status
    and tenant.status = 'active'::public.tenant_status;

  if playlist_name is null then
    raise exception 'demo playlist is unavailable'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.playlist_releases release
    where release.tenant_id = p_tenant_id
      and release.playlist_id = p_playlist_id
  ) then
    raise exception 'demo playlist requires a published release'
      using errcode = '23514';
  end if;

  insert into public.platform_player_demo_playlists (
    environment,
    tenant_id,
    playlist_id,
    updated_by
  )
  values (
    'staging',
    p_tenant_id,
    p_playlist_id,
    actor_id
  )
  on conflict (environment)
  do update set
    tenant_id = excluded.tenant_id,
    playlist_id = excluded.playlist_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform private.audit_event(
    p_tenant_id,
    'platform.player_demo_playlist.configured',
    'playlists',
    p_playlist_id,
    'success',
    jsonb_build_object(
      'environment', 'staging',
      'playlistName', playlist_name
    )
  );
end;
$$;

revoke all on function public.set_staging_player_demo_playlist(uuid, uuid)
  from public, anon;
grant execute on function public.set_staging_player_demo_playlist(uuid, uuid)
  to authenticated;

