-- S111: keep user-owned Media separate from immutable, globally reused
-- provider assets. Provider tables are deliberately not exposed to human
-- Data API roles; the media worker and Player envelope use service_role.

alter table public.media_assets
  add column source_kind text not null default 'user'
  constraint media_assets_source_kind_check
  check (source_kind in ('user', 'generated', 'provider_legacy'));

create index media_assets_tenant_library_created_idx
  on public.media_assets (tenant_id, created_at desc, id)
  where deleted_at is null and source_kind = 'user';

update public.media_assets
set source_kind = case
  when original_file_name in (
    'sportlink-club-logo.webp',
    'sportlink-team-logo.webp'
  ) then 'provider_legacy'
  else 'generated'
end
where source_kind = 'user'
  and (
    original_file_name in (
      'dynamic-slide.png',
      'sportlink-club-logo.webp',
      'sportlink-team-logo.webp'
    )
    or original_file_name like 'rss-%-logo.webp'
    or original_file_name like 'rss-article-%'
    or original_file_name in ('rss-article_hero.webp', 'rss-article_qr.webp')
  );

create or replace function private.classify_technical_media_asset_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_kind = 'user' then
    if new.original_file_name in (
      'sportlink-club-logo.webp',
      'sportlink-team-logo.webp'
    ) then
      new.source_kind := 'provider_legacy';
    elsif new.original_file_name = 'dynamic-slide.png'
      or new.original_file_name like 'rss-%'
    then
      new.source_kind := 'generated';
    end if;
  end if;
  return new;
end;
$$;

create trigger classify_technical_media_asset_v1
before insert or update of original_file_name, source_kind
on public.media_assets
for each row execute function private.classify_technical_media_asset_v1();

-- Patch the guarded Media RPC in place so every existing caller receives the
-- same product boundary, while preserving its signature and grants.
do $$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.list_publisher_media_assets_v1(uuid,integer,integer,text,public.media_asset_kind,public.media_asset_status,uuid,boolean,uuid,boolean,text,timestamptz,timestamptz,text)'::regprocedure
  ) into function_definition;
  patched_definition := replace(
    function_definition,
    'and asset.deleted_at is null',
    'and asset.deleted_at is null' || chr(10) || '      and asset.source_kind = ''user'''
  );
  patched_definition := replace(
    patched_definition,
    '(normalized_search is null or asset.title ilike ''%'' || normalized_search || ''%'')',
    '(normalized_search is null or asset.title ilike ''%'' || normalized_search || ''%'' or asset.original_file_name ilike ''%'' || normalized_search || ''%'' or exists (select 1 from public.media_asset_tags search_asset_tag join public.media_tags search_tag on search_tag.tenant_id = search_asset_tag.tenant_id and search_tag.id = search_asset_tag.tag_id where search_asset_tag.tenant_id = asset.tenant_id and search_asset_tag.media_asset_id = asset.id and search_tag.name ilike ''%'' || normalized_search || ''%''))'
  );
  if patched_definition = function_definition then
    raise exception 'publisher media RPC patch anchor missing';
  end if;
  execute patched_definition;
end;
$$;

create table public.provider_asset_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  entity_type text not null,
  external_entity_id text not null,
  asset_role text not null,
  current_version_id uuid,
  source_url text,
  etag text,
  last_modified text,
  last_checked_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_asset_cache_identity_unique
    unique (provider, entity_type, external_entity_id, asset_role),
  constraint provider_asset_cache_provider_check
    check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint provider_asset_cache_entity_check
    check (entity_type ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint provider_asset_cache_role_check
    check (asset_role ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint provider_asset_cache_external_id_check
    check (length(external_entity_id) between 1 and 512)
);

create table public.provider_asset_versions (
  id uuid primary key,
  cache_id uuid not null references public.provider_asset_cache(id) on delete restrict,
  checksum_sha256 text not null,
  storage_bucket text not null default 'provider-assets',
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint provider_asset_versions_cache_checksum_unique unique (cache_id, checksum_sha256),
  constraint provider_asset_versions_checksum_check check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  constraint provider_asset_versions_mime_check check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint provider_asset_versions_size_check check (file_size_bytes between 1 and 8000000),
  constraint provider_asset_versions_dimensions_check check (
    width between 1 and 4096 and height between 1 and 4096
  )
);

create index provider_asset_versions_cache_created_idx
  on public.provider_asset_versions (cache_id, created_at desc);

alter table public.provider_asset_cache
  add constraint provider_asset_cache_current_version_fk
  foreign key (current_version_id)
  references public.provider_asset_versions(id)
  on delete restrict
  deferrable initially deferred;

create index provider_asset_cache_current_version_idx
  on public.provider_asset_cache (current_version_id)
  where current_version_id is not null;

alter table public.provider_asset_cache enable row level security;
alter table public.provider_asset_cache force row level security;
alter table public.provider_asset_versions enable row level security;
alter table public.provider_asset_versions force row level security;

revoke all on table public.provider_asset_cache from public, anon, authenticated;
revoke all on table public.provider_asset_versions from public, anon, authenticated;
grant select, insert, update, delete on table public.provider_asset_cache to service_role;
grant select, insert, update, delete on table public.provider_asset_versions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-assets',
  'provider-assets',
  false,
  8000000,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.sports_clubs
  add column logo_provider_asset_version_id uuid
  references public.provider_asset_versions(id) on delete restrict;

create index sports_clubs_provider_logo_version_idx
  on public.sports_clubs (logo_provider_asset_version_id)
  where logo_provider_asset_version_id is not null;

create or replace function public.complete_sportlink_sync_v4(
  p_run_id uuid,
  p_worker_id text,
  p_club jsonb default '{}'::jsonb,
  p_club_logo jsonb default '{}'::jsonb,
  p_team_logos jsonb default '[]'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_activities jsonb default '[]'::jsonb,
  p_standings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  logo jsonb;
  cache_id uuid;
  version_id uuid;
  club_version_id uuid;
  processed_standings jsonb := coalesce(p_standings, '[]'::jsonb);
  result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into sync_run
  from public.sportlink_sync_runs
  where id = p_run_id
  for update;
  if sync_run.id is null then
    raise exception 'sportlink_sync_run_not_found' using errcode = 'P0002';
  end if;
  if sync_run.status <> 'running'
    or sync_run.worker_id is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'sportlink_sync_lease_not_owned' using errcode = '42501';
  end if;
  if jsonb_typeof(processed_standings) <> 'array'
    or jsonb_typeof(coalesce(p_team_logos, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_team_logos, '[]'::jsonb)) > 100
  then
    raise exception 'invalid provider asset collection' using errcode = '22023';
  end if;

  for logo in
    select value
    from jsonb_array_elements(
      case when coalesce(p_club_logo, '{}'::jsonb) = '{}'::jsonb
        then '[]'::jsonb else jsonb_build_array(p_club_logo) end
      || coalesce(p_team_logos, '[]'::jsonb)
    )
  loop
    if jsonb_typeof(logo) <> 'object'
      or coalesce(logo ->> 'assetId', '') !~ '^[0-9a-f-]{36}$'
      or coalesce(logo ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
      or logo ->> 'mimeType' is distinct from 'image/webp'
      or logo ->> 'role' not in ('club_logo', 'team_logo')
      or length(coalesce(logo ->> 'externalId', '')) not between 1 and 512
      or coalesce(logo ->> 'storagePath', '') !~ '^providers/sportlink/(club_logo|team_logo)/[a-f0-9]{64}\\.webp$'
      or (logo ->> 'fileSizeBytes')::bigint not between 1 and 2000000
      or (logo ->> 'width')::integer not between 1 and 512
      or (logo ->> 'height')::integer not between 1 and 512
    then
      raise exception 'invalid Sportlink provider asset payload' using errcode = '22023';
    end if;

    insert into public.provider_asset_cache(
      provider, entity_type, external_entity_id, asset_role, source_url,
      etag, last_modified, last_checked_at, last_success_at,
      last_error_code, updated_at
    ) values (
      'sportlink',
      case when logo ->> 'role' = 'club_logo' then 'club' else 'team' end,
      logo ->> 'externalId', logo ->> 'role', nullif(logo ->> 'sourceUrl', ''),
      nullif(logo ->> 'etag', ''), nullif(logo ->> 'lastModified', ''),
      now(), now(), null, now()
    )
    on conflict (provider, entity_type, external_entity_id, asset_role)
    do update set
      source_url = coalesce(excluded.source_url, provider_asset_cache.source_url),
      etag = coalesce(excluded.etag, provider_asset_cache.etag),
      last_modified = coalesce(excluded.last_modified, provider_asset_cache.last_modified),
      last_checked_at = now(), last_success_at = now(),
      last_error_code = null, updated_at = now()
    returning id into cache_id;

    version_id := (logo ->> 'assetId')::uuid;
    insert into public.provider_asset_versions(
      id, cache_id, checksum_sha256, storage_bucket, storage_path, mime_type,
      file_size_bytes, width, height
    ) values (
      version_id, cache_id, logo ->> 'checksumSha256', 'provider-assets',
      logo ->> 'storagePath', 'image/webp',
      (logo ->> 'fileSizeBytes')::bigint,
      (logo ->> 'width')::integer, (logo ->> 'height')::integer
    )
    on conflict (cache_id, checksum_sha256) do update
      set checksum_sha256 = excluded.checksum_sha256
    returning id into version_id;

    update public.provider_asset_cache
    set current_version_id = version_id, updated_at = now()
    where id = cache_id;

    if logo ->> 'role' = 'club_logo' then
      club_version_id := version_id;
    else
      select coalesce(jsonb_agg(
        standing || jsonb_build_object('rows', coalesce((
          select jsonb_agg(
            row || case when row ->> 'logoUrl' = logo ->> 'sourceUrl'
              then jsonb_build_object('logoMediaAssetId', version_id)
              else '{}'::jsonb end
          )
          from jsonb_array_elements(coalesce(standing -> 'rows', '[]'::jsonb)) row
        ), '[]'::jsonb))
      ), '[]'::jsonb)
      into processed_standings
      from jsonb_array_elements(processed_standings) standing;
    end if;
  end loop;

  select coalesce(jsonb_agg(
    standing || jsonb_build_object('rows', coalesce((
      select jsonb_agg(row - 'logoUrl')
      from jsonb_array_elements(coalesce(standing -> 'rows', '[]'::jsonb)) row
    ), '[]'::jsonb))
  ), '[]'::jsonb)
  into processed_standings
  from jsonb_array_elements(processed_standings) standing;

  result := public.complete_sportlink_sync_v1(
    p_run_id, p_worker_id, coalesce(p_club, '{}'::jsonb),
    coalesce(p_teams, '[]'::jsonb), coalesce(p_matches, '[]'::jsonb),
    coalesce(p_activities, '[]'::jsonb), processed_standings
  );

  if club_version_id is not null then
    update public.sports_clubs
    set logo_provider_asset_version_id = club_version_id,
        last_synced_at = now()
    where tenant_id = sync_run.tenant_id
      and source_connection_id = sync_run.connection_id
      and external_id = p_club ->> 'externalId';
  end if;
  return result;
end;
$$;

revoke all on function public.complete_sportlink_sync_v4(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_sync_v4(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_provider_cache_v1;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  provider_version_id uuid;
begin
  result := private.build_dynamic_snapshot_data_before_provider_cache_v1(p_slide);
  if nullif(result #>> '{brand,logoMediaAssetId}', '') is not null then
    return result;
  end if;
  select club.logo_provider_asset_version_id
  into provider_version_id
  from public.sports_clubs club
  where club.tenant_id = p_slide.tenant_id
    and club.active
    and club.logo_provider_asset_version_id is not null
  order by club.last_synced_at desc, club.id
  limit 1;
  if provider_version_id is null then return result; end if;
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'brand', coalesce(result -> 'brand', '{}'::jsonb) ||
      jsonb_build_object('logoMediaAssetId', provider_version_id)
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_provider_cache_v1(
  public.dynamic_slides
) from public, anon, authenticated;

revoke all on function private.classify_technical_media_asset_v1()
from public, anon, authenticated;
