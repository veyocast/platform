-- Sportlink Club.Dataservice: tenant connections, normalized sport data and
-- immutable dynamic-snapshot integration. Credentials stay encrypted and are
-- never readable through table RLS.

alter table public.dynamic_data_sources drop constraint dynamic_data_sources_kind_check;
alter table public.dynamic_data_sources add constraint dynamic_data_sources_kind_check
  check (kind in ('manual_products', 'twelve_excel', 'rss', 'sportlink'));

alter table public.dynamic_templates drop constraint dynamic_templates_category_check;
alter table public.dynamic_templates add constraint dynamic_templates_category_check
  check (category in ('menu', 'news', 'sports'));
alter table public.dynamic_templates drop constraint dynamic_templates_slide_type_check;
alter table public.dynamic_templates add constraint dynamic_templates_slide_type_check check (
  slide_type in (
    'menu','news','sport_program','sport_results','sport_standing',
    'sport_period_standing','sport_match_of_the_day','sport_next_match',
    'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
    'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
    'sport_birthdays'
  )
);
alter table public.dynamic_slides drop constraint dynamic_slides_slide_type_check;
alter table public.dynamic_slides add constraint dynamic_slides_slide_type_check check (
  slide_type in (
    'menu','news','sport_program','sport_results','sport_standing',
    'sport_period_standing','sport_match_of_the_day','sport_next_match',
    'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
    'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
    'sport_birthdays'
  )
);

create table public.sportlink_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  data_source_id uuid not null,
  status text not null default 'active'
    check (status in ('active','paused','error','revoked')),
  detected_club_name text check (detected_club_name is null or length(detected_club_name) <= 200),
  client_id_suffix text not null check (client_id_suffix ~ '^[A-Za-z0-9_-]{1,8}$'),
  encrypted_client_id text not null check (length(encrypted_client_id) between 8 and 2048),
  encryption_iv text not null check (length(encryption_iv) between 8 and 128),
  encryption_tag text not null check (length(encryption_tag) between 8 and 128),
  timezone text not null default 'Europe/Amsterdam',
  privacy_people_enabled boolean not null default false,
  privacy_birthdays_enabled boolean not null default false,
  last_tested_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_sync_at timestamptz not null default now(),
  stale_after timestamptz,
  last_error_code text,
  last_duration_ms integer check (last_duration_ms is null or last_duration_ms >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, data_source_id)
);
create index sportlink_connections_due_idx on public.sportlink_connections(next_sync_at)
  where status = 'active';
create index sportlink_connections_tenant_idx on public.sportlink_connections(tenant_id, status);
create trigger sportlink_connections_set_updated_at before update
  on public.sportlink_connections for each row execute function private.set_updated_at();

create table public.sportlink_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  article_key text not null check (article_key ~ '^[a-z0-9-]{2,100}$'),
  capability text not null check (capability ~ '^[a-z0-9_]{2,100}$'),
  sensitivity text not null check (sensitivity in ('public','public_people_minimized')),
  available boolean not null default false,
  enabled boolean not null default false,
  last_checked_at timestamptz,
  last_status_code integer,
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  unique (tenant_id, connection_id, article_key)
);
create index sportlink_capabilities_connection_idx
  on public.sportlink_capabilities(tenant_id, connection_id, enabled);

create table public.sportlink_sync_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  dataset_group text not null check (dataset_group in (
    'club_profile','teams','competitions','matches','match_details',
    'activities','public_people','volunteers'
  )),
  frequency text not null check (frequency in ('hourly','daily','weekly','monthly')),
  enabled boolean not null default true,
  next_sync_at timestamptz not null default now(),
  manual_cooldown_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  unique (tenant_id, connection_id, dataset_group)
);
create index sportlink_sync_policies_due_idx on public.sportlink_sync_policies(next_sync_at)
  where enabled;

create table public.sportlink_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  dataset_group text not null,
  status text not null check (status in ('queued','running','partial','succeeded','failed')),
  requested_by uuid references public.profiles(id) on delete set null,
  worker_id text,
  locked_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  read_count integer not null default 0,
  added_count integer not null default 0,
  changed_count integer not null default 0,
  skipped_count integer not null default 0,
  deactivated_count integer not null default 0,
  error_code text,
  error_detail text check (error_detail is null or length(error_detail) <= 500),
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade
);
create unique index sportlink_one_running_group_idx
  on public.sportlink_sync_runs(connection_id, dataset_group)
  where status = 'running';
create index sportlink_sync_runs_connection_idx
  on public.sportlink_sync_runs(tenant_id, connection_id, started_at desc);

create table public.sportlink_sync_errors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sync_run_id uuid not null references public.sportlink_sync_runs(id) on delete cascade,
  article_key text not null,
  error_code text not null,
  safe_message text not null check (length(safe_message) <= 500),
  created_at timestamptz not null default now()
);
create index sportlink_sync_errors_run_idx on public.sportlink_sync_errors(tenant_id, sync_run_id);

create table public.sportlink_article_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  article_key text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  sanitized_payload jsonb not null check (jsonb_typeof(sanitized_payload) in ('array','object')),
  record_count integer not null check (record_count >= 0),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  unique (tenant_id, connection_id, article_key, content_hash)
);
create index sportlink_article_snapshots_latest_idx
  on public.sportlink_article_snapshots(tenant_id, connection_id, article_key, created_at desc);

create table public.sports_clubs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null, name text not null,
  logo_media_asset_id uuid, city text, information text, colors jsonb not null default '{}',
  source_updated_at timestamptz, first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(), active boolean not null default true,
  metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  foreign key (tenant_id, logo_media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);
create table public.sports_teams (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null, local_external_id text,
  name text not null, competition_name text, category text, gender text, team_type text,
  logo_media_asset_id uuid, photo_media_asset_id uuid, missing_sync_count integer not null default 0,
  source_updated_at timestamptz, first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(), active boolean not null default true,
  metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);
create index sports_teams_tenant_idx on public.sports_teams(tenant_id, source_connection_id, active);

create table public.sports_matches (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null,
  starts_at timestamptz not null, status text not null, home_team jsonb not null,
  away_team jsonb not null, competition jsonb, pool jsonb, venue jsonb not null default '{}',
  dressing_rooms jsonb not null default '{}', officials jsonb not null default '[]',
  is_home_match boolean not null default false, cancellation_reason text,
  scores_published boolean not null default true, expires_at timestamptz,
  missing_sync_count integer not null default 0, source_updated_at timestamptz,
  first_synced_at timestamptz not null default now(), last_synced_at timestamptz not null default now(),
  active boolean not null default true, metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);
create index sports_matches_start_idx
  on public.sports_matches(tenant_id, source_connection_id, starts_at, status) where active;

create table public.sports_standings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null, pool_external_id text not null,
  period_number integer, rows_json jsonb not null default '[]', scores_published boolean not null,
  source_updated_at timestamptz, first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(), active boolean not null default true,
  metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);
create table public.sports_activities (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null, name text not null,
  starts_at timestamptz not null, ends_at timestamptz, all_day boolean not null default false,
  location text, public_url text, expires_at timestamptz, source_updated_at timestamptz,
  first_synced_at timestamptz not null default now(), last_synced_at timestamptz not null default now(),
  active boolean not null default true, metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);
create index sports_activities_start_idx
  on public.sports_activities(tenant_id, source_connection_id, starts_at) where active;

create table public.sports_public_people (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  source_connection_id uuid not null, external_id text not null, display_name text not null,
  role text, photo_media_asset_id uuid, visibility_scope text not null default 'public',
  expires_at timestamptz, source_updated_at timestamptz,
  first_synced_at timestamptz not null default now(), last_synced_at timestamptz not null default now(),
  active boolean not null default true, metadata jsonb not null default '{}',
  foreign key (tenant_id, source_connection_id)
    references public.sportlink_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, source_connection_id, external_id), unique (tenant_id, id)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'sportlink_connections','sportlink_capabilities','sportlink_sync_policies',
    'sportlink_sync_runs','sportlink_sync_errors','sportlink_article_snapshots',
    'sports_clubs','sports_teams','sports_matches','sports_standings',
    'sports_activities','sports_public_people'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_tenant_capability(tenant_id, %L))',
      table_name || '_tenant_read', table_name, 'tenant.data_source.read'
    );
  end loop;
end $$;

create or replace function public.upsert_sportlink_connection_v1(
  p_tenant_id uuid, p_data_source_name text, p_detected_club_name text,
  p_client_id_suffix text, p_encrypted_client_id text, p_encryption_iv text,
  p_encryption_tag text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare source_id uuid; new_connection_id uuid; actor uuid := private.current_user_id();
begin
  if not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage') then
    raise exception using errcode='42501',message='tenant_capability_required';
  end if;
  insert into public.dynamic_data_sources(
    tenant_id,name,kind,status,provider_status,secret_reference,created_by,updated_by
  ) values (
    p_tenant_id,p_data_source_name,'sportlink','active','ready',
    'sportlink/' || p_tenant_id::text,actor,actor
  ) on conflict (tenant_id,name) do update set status='active',provider_status='ready',
    updated_by=actor returning id into source_id;
  insert into public.sportlink_connections(
    tenant_id,data_source_id,detected_club_name,client_id_suffix,
    encrypted_client_id,encryption_iv,encryption_tag,last_tested_at,created_by,updated_by
  ) values (
    p_tenant_id,source_id,p_detected_club_name,p_client_id_suffix,
    p_encrypted_client_id,p_encryption_iv,p_encryption_tag,now(),actor,actor
  ) on conflict (tenant_id,data_source_id) do update set
    status='active',detected_club_name=excluded.detected_club_name,
    client_id_suffix=excluded.client_id_suffix,
    encrypted_client_id=excluded.encrypted_client_id,
    encryption_iv=excluded.encryption_iv,encryption_tag=excluded.encryption_tag,
    last_tested_at=now(),updated_by=actor returning id into new_connection_id;
  insert into public.sportlink_sync_policies(
    tenant_id,connection_id,dataset_group,frequency,enabled
  )
  select p_tenant_id,new_connection_id,group_name,
    case when group_name in ('matches','match_details') then 'hourly'
      when group_name='club_profile' then 'weekly' else 'daily' end,
    group_name not in ('public_people','volunteers')
  from unnest(array['club_profile','teams','competitions','matches','match_details',
    'activities','public_people','volunteers']) group_name
  on conflict (tenant_id,connection_id,dataset_group) do nothing;
  insert into public.sportlink_capabilities(
    tenant_id,connection_id,article_key,capability,sensitivity,
    available,enabled,last_checked_at,last_status_code
  ) values
    (p_tenant_id,new_connection_id,'clubgegevens','club','public',true,true,now(),200),
    (p_tenant_id,new_connection_id,'clublogo','club_logo','public',true,true,now(),200),
    (p_tenant_id,new_connection_id,'teams','teams','public',true,true,now(),200)
  on conflict (tenant_id,connection_id,article_key) do update set
    available=true,enabled=true,last_checked_at=now(),last_status_code=200;
  perform private.audit_event(p_tenant_id,'sportlink.connection.saved',
    'sportlink_connections',new_connection_id,'success',jsonb_build_object(
      'club',p_detected_club_name,'clientIdSuffix',p_client_id_suffix));
  return new_connection_id;
end $$;

grant execute on function public.upsert_sportlink_connection_v1(
  uuid,text,text,text,text,text,text) to authenticated;
grant select on public.sportlink_capabilities,public.sportlink_sync_policies,
  public.sportlink_sync_runs,public.sportlink_sync_errors,
  public.sportlink_article_snapshots,public.sports_clubs,public.sports_teams,
  public.sports_matches,public.sports_standings,public.sports_activities,
  public.sports_public_people to authenticated;
grant select (
  id,tenant_id,data_source_id,status,detected_club_name,client_id_suffix,
  timezone,privacy_people_enabled,privacy_birthdays_enabled,last_tested_at,
  last_attempt_at,last_success_at,next_sync_at,stale_after,last_error_code,
  last_duration_ms,created_at,updated_at
) on public.sportlink_connections to authenticated;
grant select on public.sportlink_capabilities,public.sportlink_sync_policies,
  public.sportlink_sync_runs,public.sportlink_sync_errors,
  public.sportlink_article_snapshots,public.sports_clubs,public.sports_teams,
  public.sports_matches,public.sports_standings,public.sports_activities,
  public.sports_public_people to anon;
grant select (
  id,tenant_id,data_source_id,status,detected_club_name,client_id_suffix,
  timezone,privacy_people_enabled,privacy_birthdays_enabled,last_tested_at,
  last_attempt_at,last_success_at,next_sync_at,stale_after,last_error_code,
  last_duration_ms,created_at,updated_at
) on public.sportlink_connections to anon;
