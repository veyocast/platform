-- S132: LED Scores realtime goal alerts.
--
-- Provider traffic is read-only and worker-owned. Published alert versions are
-- immutable, targets remain many-to-many through screen_group_memberships and
-- Players receive short-lived, screen-scoped deliveries through Realtime.

alter table public.tenant_feature_flags
  drop constraint tenant_feature_flags_flag_key_check;
alter table public.tenant_feature_flags
  add constraint tenant_feature_flags_flag_key_check check (flag_key in (
    'vector_v2_design_system', 'vector_v2_marketing',
    'vector_v2_control_shell', 'vector_v2_mobile_shell',
    'vector_v2_player_shell', 'unified_resource_picker',
    'unified_filter_dock', 'venue_twin', 'screen_health_view',
    'engage', 'youtube_integration', 'sportlink_birthdays',
    'ledscores_realtime',
    'billing_engine_enabled', 'billing_collect_recurring',
    'billing_proration_enabled', 'billing_dunning_worker',
    'billing_enforce_entitlements', 'billing_player_warning_chip',
    'billing_player_restriction_splash', 'billing_mollie_nextgen_webhooks',
    'billing_mollie_sales_invoices', 'billing_reconciliation_worker',
    'billing_support_overrides', 'billing_mollie_fixed_subscription_adapter'
  ));

create or replace function public.set_tenant_feature_flag_v1(
  p_tenant_id uuid,
  p_flag_key text,
  p_enabled boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  previous_value boolean := false;
  normalized_reason text := btrim(p_reason);
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'platform feature rollout permission required' using errcode = '42501';
  end if;
  perform private.require_aal2_command();
  if p_flag_key not in (
    'vector_v2_design_system', 'vector_v2_marketing',
    'vector_v2_control_shell', 'vector_v2_mobile_shell',
    'vector_v2_player_shell', 'unified_resource_picker',
    'unified_filter_dock', 'venue_twin', 'screen_health_view',
    'engage', 'youtube_integration', 'sportlink_birthdays',
    'ledscores_realtime',
    'billing_engine_enabled', 'billing_collect_recurring',
    'billing_proration_enabled', 'billing_dunning_worker',
    'billing_enforce_entitlements', 'billing_player_warning_chip',
    'billing_player_restriction_splash', 'billing_mollie_nextgen_webhooks',
    'billing_mollie_sales_invoices', 'billing_reconciliation_worker',
    'billing_support_overrides', 'billing_mollie_fixed_subscription_adapter'
  ) or normalized_reason is null or length(normalized_reason) not between 8 and 500 then
    raise exception 'feature rollout input is invalid' using errcode = '23514';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;
  select enabled into previous_value from public.tenant_feature_flags
  where tenant_id = p_tenant_id and flag_key = p_flag_key;
  previous_value := coalesce(previous_value, false);
  insert into public.tenant_feature_flags(
    tenant_id, flag_key, enabled, rollout_reason, changed_by
  ) values (
    p_tenant_id, p_flag_key, p_enabled, normalized_reason, actor_id
  ) on conflict (tenant_id, flag_key) do update set
    enabled = excluded.enabled,
    rollout_reason = excluded.rollout_reason,
    changed_by = excluded.changed_by;
  perform private.audit_event(
    p_tenant_id, 'tenant.feature_flag.changed', 'tenant_feature_flags', null,
    'success', jsonb_build_object(
      'flagKey', p_flag_key,
      'environment', coalesce(current_setting('app.environment', true), 'unknown'),
      'subject', p_tenant_id, 'oldValue', previous_value,
      'newValue', p_enabled, 'actor', actor_id,
      'reason', normalized_reason, 'changedAt', now()
    )
  );
end;
$$;
revoke all on function public.set_tenant_feature_flag_v1(uuid,text,boolean,text)
  from public, anon;
grant execute on function public.set_tenant_feature_flag_v1(uuid,text,boolean,text)
  to authenticated, service_role;

create or replace function private.ledscores_feature_enabled(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_feature_flags flag
    join public.tenants tenant on tenant.id = flag.tenant_id
    where flag.tenant_id = p_tenant_id
      and flag.flag_key = 'ledscores_realtime'
      and flag.enabled
      and tenant.status = 'active'
  );
$$;
revoke all on function private.ledscores_feature_enabled(uuid)
  from public, anon, authenticated;
grant execute on function private.ledscores_feature_enabled(uuid)
  to service_role;

create table public.ledscores_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  club_slug text not null check (
    club_slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'
  ),
  endpoint_host text not null default 'wss.ledscores.score.tel'
    check (endpoint_host = 'wss.ledscores.score.tel'),
  status text not null default 'active'
    check (status in ('active', 'paused', 'error')),
  health_status text not null default 'pending'
    check (health_status in ('pending', 'connected', 'reconnecting', 'disconnected', 'error')),
  health_detail text check (health_detail is null or length(health_detail) <= 500),
  revision integer not null default 1 check (revision > 0),
  lease_owner text check (lease_owner is null or length(lease_owner) between 1 and 128),
  lease_expires_at timestamptz,
  baseline_json jsonb check (
    baseline_json is null or (
      jsonb_typeof(baseline_json) = 'object' and pg_column_size(baseline_json) <= 16384
    )
  ),
  last_source_message_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  reconnect_count bigint not null default 0 check (reconnect_count >= 0),
  invalid_message_count bigint not null default 0 check (invalid_message_count >= 0),
  last_test_reserved_at timestamptz,
  last_test_at timestamptz,
  last_test_status text check (last_test_status is null or last_test_status in ('success', 'failed')),
  last_test_detail text check (last_test_detail is null or length(last_test_detail) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, club_slug),
  check ((lease_owner is null) = (lease_expires_at is null))
);
create index ledscores_connections_worker_idx
  on public.ledscores_connections(status, lease_expires_at, updated_at)
  where status = 'active';

create table public.ledscores_team_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  provider_team_key text not null check (length(provider_team_key) between 1 and 200),
  provider_team_name text not null check (length(btrim(provider_team_name)) between 1 and 160),
  sports_team_id uuid,
  scoring_side text not null check (scoring_side in ('own', 'opponent')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete cascade,
  foreign key (tenant_id, sports_team_id)
    references public.sports_teams(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, connection_id, provider_team_key)
);
create index ledscores_team_mappings_connection_idx
  on public.ledscores_team_mappings(tenant_id, connection_id);

create table public.ledscores_goal_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'archived')),
  priority integer not null default 100 check (priority between 0 and 1000),
  duration_ms integer not null default 8000 check (duration_ms between 2000 and 30000),
  underlay_policy text not null default 'continue'
    check (underlay_policy in ('continue', 'pause')),
  draft_config jsonb not null check (
    jsonb_typeof(draft_config) = 'object'
    and pg_column_size(draft_config) <= 65536
    and draft_config ->> 'schemaVersion' = '1'
    and jsonb_typeof(draft_config -> 'ownDesign') = 'object'
    and jsonb_typeof(draft_config -> 'opponentDesign') = 'object'
    and jsonb_typeof(draft_config -> 'unknownDesign') = 'object'
  ),
  revision integer not null default 1 check (revision > 0),
  current_published_version_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, name)
);
create index ledscores_goal_alerts_connection_idx
  on public.ledscores_goal_alerts(tenant_id, connection_id, status);

create table public.ledscores_goal_alert_draft_groups (
  tenant_id uuid not null,
  alert_id uuid not null,
  screen_group_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, alert_id, screen_group_id),
  foreign key (tenant_id, alert_id)
    references public.ledscores_goal_alerts(tenant_id, id) on delete cascade,
  foreign key (tenant_id, screen_group_id)
    references public.screen_groups(tenant_id, id) on delete restrict
);
create index ledscores_goal_alert_draft_groups_group_idx
  on public.ledscores_goal_alert_draft_groups(tenant_id, screen_group_id, alert_id);

create table public.ledscores_goal_alert_draft_assets (
  tenant_id uuid not null,
  alert_id uuid not null,
  media_asset_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, alert_id, media_asset_id),
  foreign key (tenant_id, alert_id)
    references public.ledscores_goal_alerts(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict
);

create table public.ledscores_goal_alert_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  alert_id uuid not null,
  connection_id uuid not null,
  version integer not null check (version > 0),
  priority integer not null check (priority between 0 and 1000),
  duration_ms integer not null check (duration_ms between 2000 and 30000),
  underlay_policy text not null check (underlay_policy in ('continue', 'pause')),
  config_snapshot jsonb not null check (
    jsonb_typeof(config_snapshot) = 'object'
    and pg_column_size(config_snapshot) <= 65536
  ),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, alert_id, version),
  foreign key (tenant_id, alert_id)
    references public.ledscores_goal_alerts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict
);
create index ledscores_goal_alert_versions_connection_idx
  on public.ledscores_goal_alert_versions(tenant_id, connection_id, published_at desc);

alter table public.ledscores_goal_alerts
  add foreign key (tenant_id, current_published_version_id)
  references public.ledscores_goal_alert_versions(tenant_id, id) on delete restrict;

create table public.ledscores_goal_alert_version_groups (
  tenant_id uuid not null,
  alert_version_id uuid not null,
  screen_group_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, alert_version_id, screen_group_id),
  foreign key (tenant_id, alert_version_id)
    references public.ledscores_goal_alert_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, screen_group_id)
    references public.screen_groups(tenant_id, id) on delete restrict
);
create index ledscores_goal_alert_version_groups_target_idx
  on public.ledscores_goal_alert_version_groups(tenant_id, screen_group_id, alert_version_id);

create table public.ledscores_goal_alert_version_assets (
  tenant_id uuid not null,
  alert_version_id uuid not null,
  media_asset_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, alert_version_id, media_asset_id),
  foreign key (tenant_id, alert_version_id)
    references public.ledscores_goal_alert_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict,
  check (storage_path like ('tenants/' || tenant_id::text || '/assets/' || media_asset_id::text || '/%'))
);

create table public.ledscores_goal_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  canonical_key text not null check (canonical_key ~ '^[a-f0-9]{64}$'),
  source_update_id text check (source_update_id is null or length(source_update_id) <= 200),
  match_identity text not null check (length(match_identity) between 1 and 300),
  home_team text not null check (length(btrim(home_team)) between 1 and 160),
  away_team text not null check (length(btrim(away_team)) between 1 and 160),
  previous_home_score integer not null check (previous_home_score between 0 and 999),
  previous_away_score integer not null check (previous_away_score between 0 and 999),
  home_score integer not null check (home_score between 0 and 999),
  away_score integer not null check (away_score between 0 and 999),
  scoreboard_side text not null check (scoreboard_side in ('home', 'away')),
  scoring_team_key text not null check (length(scoring_team_key) between 1 and 200),
  scoring_side text not null check (scoring_side in ('own', 'opponent', 'unknown')),
  scorer_name text check (scorer_name is null or length(scorer_name) <= 160),
  match_clock text check (match_clock is null or length(match_clock) <= 40),
  source_observed_at timestamptz not null,
  detected_at timestamptz not null default clock_timestamp(),
  event_kind text not null default 'live' check (event_kind in ('live', 'synthetic_test')),
  dispatch_status text not null check (
    dispatch_status in ('dispatched', 'no_targets', 'suppressed_unknown_side')
  ),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, connection_id, canonical_key),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict
);
create index ledscores_goal_events_connection_time_idx
  on public.ledscores_goal_events(tenant_id, connection_id, detected_at desc);

create table public.ledscores_player_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  screen_id uuid not null,
  message_kind text not null check (message_kind in ('goal', 'configuration')),
  goal_event_id uuid,
  alert_version_id uuid,
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536
  ),
  execute_at timestamptz not null,
  expires_at timestamptz not null,
  dispatched_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'rendered', 'skipped', 'failed')),
  received_at timestamptz,
  rendered_at timestamptz,
  skipped_at timestamptz,
  failed_at timestamptz,
  outcome_detail text check (outcome_detail is null or length(outcome_detail) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id) on delete restrict,
  foreign key (tenant_id, goal_event_id)
    references public.ledscores_goal_events(tenant_id, id) on delete restrict,
  foreign key (tenant_id, alert_version_id)
    references public.ledscores_goal_alert_versions(tenant_id, id) on delete restrict,
  check (expires_at > execute_at),
  check (
    (message_kind = 'goal' and goal_event_id is not null and alert_version_id is not null)
    or (message_kind = 'configuration' and goal_event_id is null)
  )
);
create unique index ledscores_player_deliveries_goal_screen_uq
  on public.ledscores_player_deliveries(tenant_id, goal_event_id, screen_id)
  where message_kind = 'goal';
create index ledscores_player_deliveries_realtime_idx
  on public.ledscores_player_deliveries(screen_id, created_at desc);
create index ledscores_player_deliveries_cleanup_idx
  on public.ledscores_player_deliveries(expires_at);

create table public.ledscores_connector_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  event_type text not null check (length(event_type) between 2 and 80),
  severity text not null check (severity in ('info', 'warning', 'error')),
  detail jsonb not null default '{}'::jsonb check (
    jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 16384
  ),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict
);
create index ledscores_connector_events_connection_idx
  on public.ledscores_connector_events(tenant_id, connection_id, occurred_at desc);

create or replace function private.reject_ledscores_published_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'published LED Scores alert versions are immutable' using errcode = '55000';
end;
$$;
revoke all on function private.reject_ledscores_published_version_mutation()
  from public, anon, authenticated;

create trigger ledscores_goal_alert_versions_immutable
before update or delete on public.ledscores_goal_alert_versions
for each row execute function private.reject_ledscores_published_version_mutation();
create trigger ledscores_goal_alert_version_groups_immutable
before update or delete on public.ledscores_goal_alert_version_groups
for each row execute function private.reject_ledscores_published_version_mutation();
create trigger ledscores_goal_alert_version_assets_immutable
before update or delete on public.ledscores_goal_alert_version_assets
for each row execute function private.reject_ledscores_published_version_mutation();

alter table public.ledscores_connections enable row level security;
alter table public.ledscores_team_mappings enable row level security;
alter table public.ledscores_goal_alerts enable row level security;
alter table public.ledscores_goal_alert_draft_groups enable row level security;
alter table public.ledscores_goal_alert_draft_assets enable row level security;
alter table public.ledscores_goal_alert_versions enable row level security;
alter table public.ledscores_goal_alert_version_groups enable row level security;
alter table public.ledscores_goal_alert_version_assets enable row level security;
alter table public.ledscores_goal_events enable row level security;
alter table public.ledscores_player_deliveries enable row level security;
alter table public.ledscores_connector_events enable row level security;

create policy ledscores_connections_read on public.ledscores_connections
for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
create policy ledscores_team_mappings_read on public.ledscores_team_mappings
for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);

create policy ledscores_goal_alerts_read on public.ledscores_goal_alerts
for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy ledscores_goal_alert_draft_groups_read
on public.ledscores_goal_alert_draft_groups for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy ledscores_goal_alert_draft_assets_read
on public.ledscores_goal_alert_draft_assets for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy ledscores_goal_alert_versions_read
on public.ledscores_goal_alert_versions for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy ledscores_goal_alert_version_groups_read
on public.ledscores_goal_alert_version_groups for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy ledscores_goal_alert_version_assets_read
on public.ledscores_goal_alert_version_assets for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);

create policy ledscores_goal_events_read on public.ledscores_goal_events
for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);
create policy ledscores_player_deliveries_read
on public.ledscores_player_deliveries for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);
create policy ledscores_connector_events_read
on public.ledscores_connector_events for select to authenticated
using (
  private.ledscores_feature_enabled(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);

grant select on
  public.ledscores_connections,
  public.ledscores_team_mappings,
  public.ledscores_goal_alerts,
  public.ledscores_goal_alert_draft_groups,
  public.ledscores_goal_alert_draft_assets,
  public.ledscores_goal_alert_versions,
  public.ledscores_goal_alert_version_groups,
  public.ledscores_goal_alert_version_assets,
  public.ledscores_goal_events,
  public.ledscores_player_deliveries,
  public.ledscores_connector_events
to authenticated;

grant select, insert, update, delete on
  public.ledscores_connections,
  public.ledscores_team_mappings,
  public.ledscores_goal_alerts,
  public.ledscores_goal_alert_draft_groups,
  public.ledscores_goal_alert_draft_assets,
  public.ledscores_goal_alert_versions,
  public.ledscores_goal_alert_version_groups,
  public.ledscores_goal_alert_version_assets,
  public.ledscores_goal_events,
  public.ledscores_player_deliveries,
  public.ledscores_connector_events
to service_role;
grant usage, select on sequence public.ledscores_connector_events_id_seq
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ledscores_player_deliveries'
  ) then
    alter publication supabase_realtime
      add table public.ledscores_player_deliveries;
  end if;
end $$;

create or replace function private.require_ledscores_capability(
  p_tenant_id uuid,
  p_capability text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
begin
  if actor_id is null
    or not private.ledscores_feature_enabled(p_tenant_id)
    or not private.has_tenant_capability(p_tenant_id, p_capability) then
    raise exception 'LED Scores capability required' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;
revoke all on function private.require_ledscores_capability(uuid,text)
  from public, anon, authenticated;

create or replace function public.save_ledscores_connection_v1(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_name text,
  p_club_slug text,
  p_status text,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.data_source.manage'
  );
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_club_slug));
  connection_record public.ledscores_connections%rowtype;
begin
  if length(normalized_name) not between 2 and 120
    or normalized_slug !~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'
    or p_status not in ('active', 'paused') then
    raise exception 'invalid LED Scores connection input' using errcode = '23514';
  end if;

  if p_connection_id is null then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'invalid create revision' using errcode = '23514';
    end if;
    insert into public.ledscores_connections(
      tenant_id, name, club_slug, status, created_by, updated_by
    ) values (
      p_tenant_id, normalized_name, normalized_slug, p_status, actor_id, actor_id
    ) returning * into connection_record;
  else
    select * into connection_record
    from public.ledscores_connections connection
    where connection.tenant_id = p_tenant_id
      and connection.id = p_connection_id
    for update;
    if not found then
      raise exception 'LED Scores connection not found' using errcode = 'P0002';
    end if;
    if connection_record.revision <> p_expected_revision then
      return jsonb_build_object(
        'outcome', 'conflict', 'actualRevision', connection_record.revision,
        'connectionId', connection_record.id
      );
    end if;
    update public.ledscores_connections set
      name = normalized_name,
      club_slug = normalized_slug,
      status = p_status,
      health_status = case when p_status = 'paused' then 'disconnected' else health_status end,
      lease_owner = case when p_status = 'paused' then null else lease_owner end,
      lease_expires_at = case when p_status = 'paused' then null else lease_expires_at end,
      revision = revision + 1,
      updated_by = actor_id,
      updated_at = now()
    where tenant_id = p_tenant_id and id = p_connection_id
    returning * into connection_record;
  end if;

  perform private.audit_event(
    p_tenant_id, 'ledscores.connection.saved', 'ledscores_connections',
    connection_record.id, 'success', jsonb_build_object(
      'clubSlug', connection_record.club_slug,
      'endpointHost', connection_record.endpoint_host,
      'status', connection_record.status,
      'revision', connection_record.revision
    )
  );
  return jsonb_build_object(
    'outcome', 'saved', 'actualRevision', connection_record.revision,
    'connectionId', connection_record.id
  );
end;
$$;

create or replace function public.save_ledscores_team_mappings_v1(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_mappings jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.data_source.manage'
  );
  mapping jsonb;
  mapping_count integer := 0;
  resolved_team_name text;
  sports_team_id uuid;
begin
  if jsonb_typeof(p_mappings) <> 'array'
    or jsonb_array_length(p_mappings) > 50 then
    raise exception 'invalid LED Scores team mappings' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.ledscores_connections
    where tenant_id = p_tenant_id and id = p_connection_id
  ) then
    raise exception 'LED Scores connection not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_mappings) item
    group by lower(btrim(item ->> 'teamKey'))
    having count(*) > 1
  ) then
    raise exception 'duplicate LED Scores team mapping' using errcode = '23505';
  end if;

  delete from public.ledscores_team_mappings
  where tenant_id = p_tenant_id and connection_id = p_connection_id;
  for mapping in select value from jsonb_array_elements(p_mappings) loop
    sports_team_id := nullif(mapping ->> 'sportsTeamId', '')::uuid;
    resolved_team_name := nullif(btrim(mapping ->> 'teamName'), '');
    if sports_team_id is not null then
      select team.name into resolved_team_name
      from public.sports_teams team
      where team.tenant_id = p_tenant_id
        and team.id = sports_team_id
        and team.active;
      if not found then
        raise exception 'linked Sportlink team unavailable' using errcode = '23514';
      end if;
    end if;
    if length(btrim(mapping ->> 'teamKey')) not between 1 and 200
      or coalesce(length(resolved_team_name), 0) not between 1 and 160
      or mapping ->> 'side' not in ('own', 'opponent') then
      raise exception 'invalid LED Scores team mapping' using errcode = '23514';
    end if;
    insert into public.ledscores_team_mappings(
      tenant_id, connection_id, provider_team_key, provider_team_name,
      sports_team_id, scoring_side, created_by
    ) values (
      p_tenant_id, p_connection_id, lower(btrim(mapping ->> 'teamKey')),
      resolved_team_name, sports_team_id, mapping ->> 'side', actor_id
    );
    mapping_count := mapping_count + 1;
  end loop;
  update public.ledscores_connections set
    revision = revision + 1, updated_by = actor_id, updated_at = now()
  where tenant_id = p_tenant_id and id = p_connection_id;
  perform private.audit_event(
    p_tenant_id, 'ledscores.team_mappings.replaced', 'ledscores_connections',
    p_connection_id, 'success', jsonb_build_object('mappingCount', mapping_count)
  );
  return mapping_count;
end;
$$;

create or replace function public.reserve_ledscores_connection_test_v1(
  p_tenant_id uuid,
  p_connection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.data_source.manage'
  );
  reserved boolean := false;
begin
  update public.ledscores_connections set
    last_test_reserved_at = clock_timestamp(),
    updated_by = actor_id,
    updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_connection_id
    and (
      last_test_reserved_at is null
      or last_test_reserved_at < clock_timestamp() - interval '30 seconds'
    )
  returning true into reserved;
  if not found and not exists (
    select 1 from public.ledscores_connections
    where tenant_id = p_tenant_id and id = p_connection_id
  ) then
    raise exception 'LED Scores connection not found' using errcode = 'P0002';
  end if;
  return coalesce(reserved, false);
end;
$$;

create or replace function public.finish_ledscores_connection_test_v1(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_status text,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.data_source.manage'
  );
  normalized_detail text := regexp_replace(btrim(p_detail), '[\r\n]+', ' ', 'g');
begin
  if p_status not in ('success', 'failed') or length(normalized_detail) > 500 then
    raise exception 'invalid connection test result' using errcode = '23514';
  end if;
  update public.ledscores_connections set
    last_test_at = clock_timestamp(),
    last_test_status = p_status,
    last_test_detail = normalized_detail,
    updated_by = actor_id,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_connection_id;
  if not found then
    raise exception 'LED Scores connection not found' using errcode = 'P0002';
  end if;
  perform private.audit_event(
    p_tenant_id, 'ledscores.connection.tested', 'ledscores_connections',
    p_connection_id, p_status, jsonb_build_object('detail', normalized_detail)
  );
end;
$$;

revoke all on function public.save_ledscores_connection_v1(uuid,uuid,text,text,text,integer)
  from public, anon;
revoke all on function public.save_ledscores_team_mappings_v1(uuid,uuid,jsonb)
  from public, anon;
revoke all on function public.reserve_ledscores_connection_test_v1(uuid,uuid)
  from public, anon;
revoke all on function public.finish_ledscores_connection_test_v1(uuid,uuid,text,text)
  from public, anon;
grant execute on function public.save_ledscores_connection_v1(uuid,uuid,text,text,text,integer)
  to authenticated, service_role;
grant execute on function public.save_ledscores_team_mappings_v1(uuid,uuid,jsonb)
  to authenticated, service_role;
grant execute on function public.reserve_ledscores_connection_test_v1(uuid,uuid)
  to authenticated, service_role;
grant execute on function public.finish_ledscores_connection_test_v1(uuid,uuid,text,text)
  to authenticated, service_role;

create or replace function public.save_ledscores_goal_alert_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_connection_id uuid,
  p_name text,
  p_priority integer,
  p_duration_ms integer,
  p_underlay_policy text,
  p_config jsonb,
  p_target_group_ids uuid[],
  p_asset_ids uuid[],
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  );
  normalized_name text := btrim(p_name);
  normalized_groups uuid[] := array(
    select distinct value from unnest(coalesce(p_target_group_ids, '{}'::uuid[])) value
    order by value
  );
  normalized_assets uuid[] := array(
    select distinct value from unnest(coalesce(p_asset_ids, '{}'::uuid[])) value
    order by value
  );
  alert_record public.ledscores_goal_alerts%rowtype;
begin
  if length(normalized_name) not between 2 and 120
    or p_priority not between 0 and 1000
    or p_duration_ms not between 2000 and 30000
    or p_underlay_policy not in ('continue', 'pause')
    or jsonb_typeof(p_config) <> 'object'
    or pg_column_size(p_config) > 65536
    or p_config ->> 'schemaVersion' <> '1'
    or jsonb_typeof(p_config -> 'ownDesign') <> 'object'
    or jsonb_typeof(p_config -> 'opponentDesign') <> 'object'
    or coalesce(jsonb_typeof(p_config -> 'unknownDesign'), 'missing') <> 'object'
    or coalesce(jsonb_typeof(p_config -> 'triggerOwn'), 'missing') <> 'boolean'
    or coalesce(jsonb_typeof(p_config -> 'triggerOpponent'), 'missing') <> 'boolean'
    or coalesce(p_config ->> 'unknownPolicy', '') not in ('generic', 'suppress')
    or coalesce(jsonb_typeof(p_config -> 'ownTeamKeys'), 'missing') <> 'array'
    or jsonb_array_length(p_config -> 'ownTeamKeys') > 50
    or exists (
      select 1 from jsonb_array_elements_text(p_config -> 'ownTeamKeys') team_key
      where length(btrim(team_key)) not between 1 and 200
    )
    or coalesce(jsonb_typeof(p_config -> 'ownSoundVolume'), 'missing') <> 'number'
    or (p_config ->> 'ownSoundVolume')::integer not between 0 and 100
    or coalesce(jsonb_typeof(p_config -> 'opponentSoundVolume'), 'missing') <> 'number'
    or (p_config ->> 'opponentSoundVolume')::integer not between 0 and 100
    or coalesce(jsonb_typeof(p_config -> 'sponsorOnlyOwn'), 'missing') <> 'boolean'
    or coalesce(jsonb_typeof(p_config -> 'activeFrom'), 'missing') not in ('null', 'string')
    or coalesce(jsonb_typeof(p_config -> 'activeUntil'), 'missing') not in ('null', 'string')
    or exists (
      select 1
      from jsonb_array_elements(jsonb_build_array(
        p_config -> 'ownDesign', p_config -> 'opponentDesign', p_config -> 'unknownDesign'
      )) design
      where coalesce(jsonb_typeof(design), 'missing') <> 'object'
        or length(btrim(design ->> 'headline')) not between 1 and 80
        or coalesce(design ->> 'palette', '') not in (
          'electric-orange', 'ink-black', 'signal-red', 'white'
        )
        or coalesce(design ->> 'animation', '') not in ('impact', 'pulse', 'slide', 'none')
    )
    or cardinality(normalized_groups) not between 1 and 50
    or cardinality(normalized_assets) > 10 then
    raise exception 'invalid LED Scores goal alert input' using errcode = '23514';
  end if;
  if (p_config ->> 'activeFrom') is not null
  then perform (p_config ->> 'activeFrom')::timestamptz;
  end if;
  if (p_config ->> 'activeUntil') is not null
  then perform (p_config ->> 'activeUntil')::timestamptz;
  end if;
  if (p_config ->> 'activeFrom') is not null
    and (p_config ->> 'activeUntil') is not null
    and (p_config ->> 'activeFrom')::timestamptz >= (p_config ->> 'activeUntil')::timestamptz then
    raise exception 'invalid LED Scores active window' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.ledscores_connections
    where tenant_id = p_tenant_id and id = p_connection_id and status <> 'error'
  ) then
    raise exception 'LED Scores connection not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_config -> 'ownTeamKeys') configured(team_key)
    left join public.ledscores_team_mappings mapping
      on mapping.tenant_id = p_tenant_id
      and mapping.connection_id = p_connection_id
      and lower(mapping.provider_team_key) = lower(btrim(configured.team_key))
      and mapping.scoring_side = 'own'
    where mapping.id is null
  ) then
    raise exception 'LED Scores own-team filter is unavailable' using errcode = '23514';
  end if;
  if (
    select count(*) from public.screen_groups group_record
    where group_record.tenant_id = p_tenant_id
      and group_record.id = any(normalized_groups)
      and group_record.status = 'active'
  ) <> cardinality(normalized_groups) then
    raise exception 'LED Scores target group is unavailable' using errcode = '23514';
  end if;
  if (
    select count(*) from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = any(normalized_assets)
      and asset.status = 'ready'
      and asset.deleted_at is null
      and asset.checksum_sha256 is not null
      and (
        asset.kind::text = 'image'
        or exists (
          select 1 from public.media_variants variant
          where variant.tenant_id = asset.tenant_id
            and variant.asset_id = asset.id
            and variant.variant_type::text = 'player'
        )
      )
  ) <> cardinality(normalized_assets) then
    raise exception 'LED Scores media is not player-ready' using errcode = '23514';
  end if;
  if exists (
    select 1
    from unnest(array[
      'logoMediaAssetId','ownMediaAssetId','opponentMediaAssetId','unknownMediaAssetId',
      'ownSoundMediaAssetId','opponentSoundMediaAssetId','sponsorMediaAssetId'
    ]) config_key
    where (p_config ->> config_key) is not null
      and (p_config ->> config_key)::uuid <> all(normalized_assets)
  ) then
    raise exception 'LED Scores config references unpublished media' using errcode = '23514';
  end if;

  if p_alert_id is null then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'invalid create revision' using errcode = '23514';
    end if;
    insert into public.ledscores_goal_alerts(
      tenant_id, connection_id, name, priority, duration_ms,
      underlay_policy, draft_config, created_by, updated_by
    ) values (
      p_tenant_id, p_connection_id, normalized_name, p_priority,
      p_duration_ms, p_underlay_policy, p_config, actor_id, actor_id
    ) returning * into alert_record;
  else
    select * into alert_record
    from public.ledscores_goal_alerts alert
    where alert.tenant_id = p_tenant_id and alert.id = p_alert_id
    for update;
    if not found then
      raise exception 'LED Scores goal alert not found' using errcode = 'P0002';
    end if;
    if alert_record.revision <> p_expected_revision then
      return jsonb_build_object(
        'outcome', 'conflict', 'actualRevision', alert_record.revision,
        'alertId', alert_record.id
      );
    end if;
    if alert_record.status = 'archived' then
      raise exception 'archived LED Scores goal alert cannot be edited' using errcode = '55000';
    end if;
    update public.ledscores_goal_alerts set
      connection_id = p_connection_id,
      name = normalized_name,
      priority = p_priority,
      duration_ms = p_duration_ms,
      underlay_policy = p_underlay_policy,
      draft_config = p_config,
      revision = revision + 1,
      updated_by = actor_id,
      updated_at = now()
    where tenant_id = p_tenant_id and id = p_alert_id
    returning * into alert_record;
  end if;

  delete from public.ledscores_goal_alert_draft_groups
  where tenant_id = p_tenant_id and alert_id = alert_record.id;
  insert into public.ledscores_goal_alert_draft_groups(
    tenant_id, alert_id, screen_group_id
  ) select p_tenant_id, alert_record.id, value from unnest(normalized_groups) value;

  delete from public.ledscores_goal_alert_draft_assets
  where tenant_id = p_tenant_id and alert_id = alert_record.id;
  insert into public.ledscores_goal_alert_draft_assets(
    tenant_id, alert_id, media_asset_id
  ) select p_tenant_id, alert_record.id, value from unnest(normalized_assets) value;

  perform private.audit_event(
    p_tenant_id, 'ledscores.goal_alert.draft_saved', 'ledscores_goal_alerts',
    alert_record.id, 'success', jsonb_build_object(
      'revision', alert_record.revision,
      'targetGroupCount', cardinality(normalized_groups),
      'assetCount', cardinality(normalized_assets),
      'priority', alert_record.priority
    )
  );
  return jsonb_build_object(
    'outcome', 'saved', 'actualRevision', alert_record.revision,
    'alertId', alert_record.id
  );
end;
$$;

create or replace function public.publish_ledscores_goal_alert_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_expected_revision integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  );
  alert_record public.ledscores_goal_alerts%rowtype;
  next_version integer;
  version_id uuid := gen_random_uuid();
  version_snapshot jsonb;
  version_checksum text;
  target_count integer;
  asset_count integer;
begin
  if not private.has_tenant_capability(p_tenant_id, 'tenant.playlist.publish') then
    raise exception 'playlist publish capability required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '23514';
  end if;
  select * into alert_record
  from public.ledscores_goal_alerts alert
  where alert.tenant_id = p_tenant_id and alert.id = p_alert_id
  for update;
  if not found then
    raise exception 'LED Scores goal alert not found' using errcode = 'P0002';
  end if;
  if alert_record.revision <> p_expected_revision then
    return jsonb_build_object(
      'outcome', 'conflict', 'actualRevision', alert_record.revision,
      'alertId', alert_record.id
    );
  end if;
  if alert_record.status = 'archived' then
    raise exception 'archived LED Scores goal alert cannot be published' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.ledscores_connections connection
    where connection.tenant_id = p_tenant_id
      and connection.id = alert_record.connection_id
      and connection.status = 'active'
  ) then
    raise exception 'active LED Scores connection required' using errcode = '23514';
  end if;
  select count(*) into target_count
  from public.ledscores_goal_alert_draft_groups
  where tenant_id = p_tenant_id and alert_id = p_alert_id;
  if target_count not between 1 and 50 then
    raise exception 'at least one target group is required' using errcode = '23514';
  end if;
  select count(*) into asset_count
  from public.ledscores_goal_alert_draft_assets
  where tenant_id = p_tenant_id and alert_id = p_alert_id;
  if exists (
    select 1
    from public.ledscores_goal_alert_draft_assets draft_asset
    left join public.media_assets asset
      on asset.tenant_id = draft_asset.tenant_id
      and asset.id = draft_asset.media_asset_id
      and asset.status = 'ready'
      and asset.deleted_at is null
      and asset.checksum_sha256 is not null
    where draft_asset.tenant_id = p_tenant_id
      and draft_asset.alert_id = p_alert_id
      and asset.id is null
  ) then
    raise exception 'referenced LED Scores media is unavailable' using errcode = '23514';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.ledscores_goal_alert_versions
  where tenant_id = p_tenant_id and alert_id = p_alert_id;
  version_snapshot := alert_record.draft_config || jsonb_build_object(
    'alertId', alert_record.id,
    'connectionId', alert_record.connection_id,
    'durationMs', alert_record.duration_ms,
    'priority', alert_record.priority,
    'underlayPolicy', alert_record.underlay_policy,
    'version', next_version
  );
  version_checksum := encode(
    extensions.digest(pg_catalog.convert_to(version_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into public.ledscores_goal_alert_versions(
    id, tenant_id, alert_id, connection_id, version, priority, duration_ms,
    underlay_policy, config_snapshot, checksum_sha256, published_by
  ) values (
    version_id, p_tenant_id, p_alert_id, alert_record.connection_id,
    next_version, alert_record.priority, alert_record.duration_ms,
    alert_record.underlay_policy, version_snapshot, version_checksum, actor_id
  );
  insert into public.ledscores_goal_alert_version_groups(
    tenant_id, alert_version_id, screen_group_id
  )
  select tenant_id, version_id, screen_group_id
  from public.ledscores_goal_alert_draft_groups
  where tenant_id = p_tenant_id and alert_id = p_alert_id;
  insert into public.ledscores_goal_alert_version_assets(
    tenant_id, alert_version_id, media_asset_id, storage_bucket,
    storage_path, mime_type, checksum_sha256
  )
  select
    draft_asset.tenant_id,
    version_id,
    draft_asset.media_asset_id,
    coalesce(player_variant.storage_bucket, asset.storage_bucket),
    coalesce(player_variant.storage_path, asset.storage_path),
    coalesce(player_variant.mime_type, asset.mime_type),
    coalesce(player_variant.checksum_sha256, asset.checksum_sha256)
  from public.ledscores_goal_alert_draft_assets draft_asset
  join public.media_assets asset
    on asset.tenant_id = draft_asset.tenant_id
    and asset.id = draft_asset.media_asset_id
  left join public.media_variants player_variant
    on player_variant.tenant_id = asset.tenant_id
    and player_variant.asset_id = asset.id
    and player_variant.variant_type::text = 'player'
  where draft_asset.tenant_id = p_tenant_id
    and draft_asset.alert_id = p_alert_id;

  update public.ledscores_goal_alerts set
    status = 'published',
    current_published_version_id = version_id,
    revision = revision + 1,
    updated_by = actor_id,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_alert_id
  returning * into alert_record;

  insert into public.ledscores_player_deliveries(
    tenant_id, screen_id, message_kind, alert_version_id, payload,
    execute_at, expires_at
  )
  select
    p_tenant_id,
    target_screen.screen_id,
    'configuration',
    version_id,
    jsonb_build_object(
      'reason', 'alert_published', 'alertVersionId', version_id,
      'idempotencyKey', p_idempotency_key
    ),
    clock_timestamp(),
    clock_timestamp() + interval '1 day'
  from (
    select distinct membership.screen_id
    from public.ledscores_goal_alert_version_groups target
    join public.screen_group_memberships membership
      on membership.tenant_id = target.tenant_id
      and membership.screen_group_id = target.screen_group_id
    where target.tenant_id = p_tenant_id
      and target.alert_version_id = version_id
  ) target_screen;

  perform private.audit_event(
    p_tenant_id, 'ledscores.goal_alert.published', 'ledscores_goal_alerts',
    p_alert_id, 'success', jsonb_build_object(
      'versionId', version_id, 'version', next_version,
      'checksum', version_checksum, 'targetGroupCount', target_count,
      'assetCount', asset_count, 'idempotencyKey', p_idempotency_key
    )
  );
  return jsonb_build_object(
    'outcome', 'published', 'actualRevision', alert_record.revision,
    'alertId', p_alert_id, 'versionId', version_id,
    'version', next_version, 'checksum', version_checksum
  );
end;
$$;

revoke all on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) from public, anon;
revoke all on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)
  from public, anon;
grant execute on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) to authenticated, service_role;
grant execute on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)
  to authenticated, service_role;

create or replace function public.claim_ledscores_connections_v1(
  p_worker_id text,
  p_lease_seconds integer default 45,
  p_limit integer default 10
)
returns table (
  connection_id uuid,
  tenant_id uuid,
  club_slug text,
  endpoint_url text,
  mappings jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$'
    or p_lease_seconds not between 15 and 120
    or p_limit not between 1 and 50 then
    raise exception 'invalid LED Scores lease request' using errcode = '23514';
  end if;
  return query
  with candidates as (
    select connection.id
    from public.ledscores_connections connection
    where connection.status = 'active'
      and private.ledscores_feature_enabled(connection.tenant_id)
      and (
        connection.lease_expires_at is null
        or connection.lease_expires_at <= clock_timestamp()
        or connection.lease_owner = p_worker_id
      )
    order by connection.last_source_message_at nulls first, connection.updated_at, connection.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.ledscores_connections connection set
      lease_owner = p_worker_id,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      health_status = case
        when connection.health_status = 'connected' then 'connected'
        else 'reconnecting'
      end,
      updated_at = now()
    from candidates
    where connection.id = candidates.id
    returning connection.id, connection.tenant_id, connection.club_slug
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.club_slug,
    'wss://wss.ledscores.score.tel/clubs/' || claimed.club_slug || '/scores/',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamKey', mapping.provider_team_key,
        'teamName', mapping.provider_team_name,
        'side', mapping.scoring_side
      ) order by mapping.provider_team_key)
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = claimed.tenant_id
        and mapping.connection_id = claimed.id
    ), '[]'::jsonb)
  from claimed;
end;
$$;

create or replace function public.renew_ledscores_connection_lease_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 45
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  renewed boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_lease_seconds not between 15 and 120 then
    raise exception 'invalid LED Scores lease duration' using errcode = '23514';
  end if;
  update public.ledscores_connections set
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  where id = p_connection_id
    and lease_owner = p_worker_id
    and lease_expires_at > clock_timestamp() - interval '5 seconds'
    and status = 'active'
    and private.ledscores_feature_enabled(tenant_id)
  returning true into renewed;
  return coalesce(renewed, false);
end;
$$;

create or replace function public.record_ledscores_connector_state_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_health_status text,
  p_event_type text,
  p_severity text,
  p_detail jsonb,
  p_baseline jsonb default null,
  p_source_message_at timestamptz default null,
  p_invalid_message boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_health_status not in ('pending', 'connected', 'reconnecting', 'disconnected', 'error')
    or p_severity not in ('info', 'warning', 'error')
    or length(p_event_type) not between 2 and 80
    or jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_detail, '{}'::jsonb)) > 16384
    or (p_baseline is not null and (
      jsonb_typeof(p_baseline) <> 'object' or pg_column_size(p_baseline) > 16384
    )) then
    raise exception 'invalid LED Scores connector state' using errcode = '23514';
  end if;
  update public.ledscores_connections set
    health_status = p_health_status,
    health_detail = left(coalesce(p_detail ->> 'message', p_event_type), 500),
    baseline_json = coalesce(p_baseline, baseline_json),
    last_source_message_at = coalesce(p_source_message_at, last_source_message_at),
    last_connected_at = case when p_event_type in ('connected', 'reconnected')
      then clock_timestamp() else last_connected_at end,
    last_disconnected_at = case when p_health_status in ('disconnected', 'error')
      then clock_timestamp() else last_disconnected_at end,
    reconnect_count = reconnect_count + case when p_event_type = 'reconnected' then 1 else 0 end,
    invalid_message_count = invalid_message_count + case when p_invalid_message then 1 else 0 end,
    updated_at = now()
  where id = p_connection_id
    and lease_owner = p_worker_id
    and lease_expires_at > clock_timestamp() - interval '5 seconds'
  returning * into connection_record;
  if not found then return false; end if;
  insert into public.ledscores_connector_events(
    tenant_id, connection_id, event_type, severity, detail
  ) values (
    connection_record.tenant_id, p_connection_id, p_event_type,
    p_severity, coalesce(p_detail, '{}'::jsonb)
  );
  return true;
end;
$$;

create or replace function public.touch_ledscores_connection_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_baseline jsonb,
  p_source_message_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_baseline) <> 'object'
    or pg_column_size(p_baseline) > 16384
    or p_source_message_at > clock_timestamp() + interval '2 minutes'
    or p_source_message_at < clock_timestamp() - interval '10 minutes' then
    raise exception 'invalid LED Scores source observation' using errcode = '23514';
  end if;
  update public.ledscores_connections set
    baseline_json = p_baseline,
    last_source_message_at = p_source_message_at,
    health_status = 'connected',
    health_detail = 'Geldig scorebericht ontvangen.',
    updated_at = now()
  where id = p_connection_id
    and lease_owner = p_worker_id
    and lease_expires_at > clock_timestamp() - interval '5 seconds'
  returning true into touched;
  return coalesce(touched, false);
end;
$$;

create or replace function public.release_ledscores_connection_lease_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_reason text default 'worker_shutdown'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.ledscores_connections set
    lease_owner = null,
    lease_expires_at = null,
    health_status = 'disconnected',
    health_detail = left(regexp_replace(btrim(p_reason), '[\r\n]+', ' ', 'g'), 500),
    last_disconnected_at = clock_timestamp(),
    updated_at = now()
  where id = p_connection_id and lease_owner = p_worker_id
  returning * into connection_record;
  if not found then return false; end if;
  insert into public.ledscores_connector_events(
    tenant_id, connection_id, event_type, severity, detail
  ) values (
    connection_record.tenant_id, p_connection_id, 'lease_released', 'info',
    jsonb_build_object('message', left(p_reason, 500))
  );
  return true;
end;
$$;

create or replace function public.dispatch_ledscores_goal_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_canonical_key text,
  p_source_update_id text,
  p_match_identity text,
  p_home_team text,
  p_away_team text,
  p_previous_home_score integer,
  p_previous_away_score integer,
  p_home_score integer,
  p_away_score integer,
  p_scoring_side text,
  p_scorer_name text,
  p_match_clock text,
  p_source_observed_at timestamptz,
  p_event_kind text default 'live',
  p_alert_id uuid default null,
  p_scoreboard_side text default null,
  p_scoring_team_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
  created_event_id uuid;
  existing_event public.ledscores_goal_events%rowtype;
  delivery_count integer := 0;
  event_status text := 'no_targets';
  detected_time timestamptz := clock_timestamp();
  resolved_scoreboard_side text := coalesce(
    p_scoreboard_side,
    case when p_home_score > p_previous_home_score then 'home' else 'away' end
  );
  resolved_scoring_team_key text := coalesce(
    nullif(btrim(p_scoring_team_key), ''),
    case when p_home_score > p_previous_home_score then btrim(p_home_team) else btrim(p_away_team) end
  );
begin
  select * into connection_record
  from public.ledscores_connections connection
  where connection.id = p_connection_id;
  if not found or not private.ledscores_feature_enabled(connection_record.tenant_id) then
    raise exception 'active LED Scores connection not found' using errcode = 'P0002';
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    if p_event_kind <> 'live'
      or connection_record.lease_owner <> p_worker_id
      or connection_record.lease_expires_at <= clock_timestamp() - interval '5 seconds' then
      raise exception 'active LED Scores lease required' using errcode = '42501';
    end if;
  elsif p_event_kind = 'synthetic_test' then
    perform private.require_ledscores_capability(
      connection_record.tenant_id, 'tenant.dynamic_slide.write'
    );
    if not private.has_tenant_capability(
      connection_record.tenant_id, 'tenant.playlist.publish'
    ) then
      raise exception 'playlist publish capability required' using errcode = '42501';
    end if;
  else
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_canonical_key !~ '^[a-f0-9]{64}$'
    or length(p_match_identity) not between 1 and 300
    or length(btrim(p_home_team)) not between 1 and 160
    or length(btrim(p_away_team)) not between 1 and 160
    or p_previous_home_score not between 0 and 999
    or p_previous_away_score not between 0 and 999
    or p_home_score not between 0 and 999
    or p_away_score not between 0 and 999
    or resolved_scoreboard_side not in ('home', 'away')
    or length(resolved_scoring_team_key) not between 1 and 200
    or p_scoring_side not in ('own', 'opponent', 'unknown')
    or p_source_observed_at > clock_timestamp() + interval '2 minutes'
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_event_kind not in ('live', 'synthetic_test') then
    raise exception 'invalid LED Scores goal event' using errcode = '23514';
  end if;
  if p_event_kind = 'synthetic_test' and exists (
    select 1 from public.ledscores_goal_events event
    where event.tenant_id = connection_record.tenant_id
      and event.event_kind = 'synthetic_test'
      and event.created_at > clock_timestamp() - interval '15 seconds'
  ) then
    raise exception 'synthetic LED Scores test rate limited' using errcode = 'P0004';
  end if;
  if p_event_kind = 'live' and p_scoring_side in ('own', 'opponent') and not exists (
    select 1 from public.ledscores_team_mappings mapping
    where mapping.tenant_id = connection_record.tenant_id
      and mapping.connection_id = p_connection_id
      and lower(mapping.provider_team_key) = lower(resolved_scoring_team_key)
      and mapping.scoring_side = p_scoring_side
  ) then
    raise exception 'LED Scores team classification mismatch' using errcode = '23514';
  end if;

  event_status := case when p_scoring_side = 'unknown'
    then 'suppressed_unknown_side' else 'no_targets' end;
  insert into public.ledscores_goal_events(
    tenant_id, connection_id, canonical_key, source_update_id,
    match_identity, home_team, away_team, previous_home_score,
    previous_away_score, home_score, away_score, scoreboard_side,
    scoring_team_key, scoring_side,
    scorer_name, match_clock, source_observed_at, detected_at,
    event_kind, dispatch_status
  ) values (
    connection_record.tenant_id, p_connection_id, p_canonical_key,
    left(p_source_update_id, 200), left(p_match_identity, 300),
    btrim(p_home_team), btrim(p_away_team), p_previous_home_score,
    p_previous_away_score, p_home_score, p_away_score, resolved_scoreboard_side,
    resolved_scoring_team_key, p_scoring_side,
    nullif(left(btrim(p_scorer_name), 160), ''),
    nullif(left(btrim(p_match_clock), 40), ''), p_source_observed_at,
    detected_time, p_event_kind, event_status
  ) on conflict (tenant_id, connection_id, canonical_key) do nothing
  returning id into created_event_id;
  if created_event_id is null then
    select * into existing_event
    from public.ledscores_goal_events event
    where event.tenant_id = connection_record.tenant_id
      and event.connection_id = p_connection_id
      and event.canonical_key = p_canonical_key;
    return jsonb_build_object(
      'outcome', 'duplicate', 'eventId', existing_event.id,
      'dispatchStatus', existing_event.dispatch_status, 'deliveryCount', 0
    );
  end if;

  if p_scoring_side in ('own', 'opponent', 'unknown') then
    with candidates as (
      select
        membership.screen_id,
        version.id as alert_version_id,
        version.config_snapshot,
        version.priority,
        version.duration_ms,
        version.underlay_policy,
        version.published_at,
        row_number() over (
          partition by membership.screen_id
          order by version.priority desc, version.published_at desc, version.id
        ) as target_rank
      from public.ledscores_goal_alerts alert
      join public.ledscores_goal_alert_versions version
        on version.tenant_id = alert.tenant_id
        and version.id = alert.current_published_version_id
      join public.ledscores_goal_alert_version_groups target
        on target.tenant_id = version.tenant_id
        and target.alert_version_id = version.id
      join public.screen_group_memberships membership
        on membership.tenant_id = target.tenant_id
        and membership.screen_group_id = target.screen_group_id
      join public.screens screen
        on screen.tenant_id = membership.tenant_id
        and screen.id = membership.screen_id
        and screen.status = 'active'
        and screen.deleted_at is null
      where alert.tenant_id = connection_record.tenant_id
        and alert.connection_id = p_connection_id
        and alert.status = 'published'
        and (p_alert_id is null or alert.id = p_alert_id)
        and (
          (p_scoring_side = 'own'
            and coalesce((version.config_snapshot ->> 'triggerOwn')::boolean, true)
            and (
              coalesce(jsonb_array_length(version.config_snapshot -> 'ownTeamKeys'), 0) = 0
              or (version.config_snapshot -> 'ownTeamKeys') ? resolved_scoring_team_key
            ))
          or (p_scoring_side = 'opponent'
            and coalesce((version.config_snapshot ->> 'triggerOpponent')::boolean, true))
          or (p_scoring_side = 'unknown'
            and coalesce(version.config_snapshot ->> 'unknownPolicy', 'suppress') = 'generic')
        )
        and (
          (version.config_snapshot ->> 'activeFrom') is null
          or (version.config_snapshot ->> 'activeFrom')::timestamptz <= detected_time
        )
        and (
          (version.config_snapshot ->> 'activeUntil') is null
          or (version.config_snapshot ->> 'activeUntil')::timestamptz > detected_time
        )
    ), inserted as (
      insert into public.ledscores_player_deliveries(
        tenant_id, screen_id, message_kind, goal_event_id,
        alert_version_id, payload, execute_at, expires_at
      )
      select
        connection_record.tenant_id,
        candidate.screen_id,
        'goal',
        created_event_id,
        candidate.alert_version_id,
        jsonb_build_object(
          'schemaVersion', 1,
          'deliveryKind', 'goal',
          'eventId', created_event_id,
          'alertVersionId', candidate.alert_version_id,
          'canonicalKey', p_canonical_key,
          'eventKind', p_event_kind,
          'scoringSide', p_scoring_side,
          'scoreboardSide', resolved_scoreboard_side,
          'homeTeam', btrim(p_home_team),
          'awayTeam', btrim(p_away_team),
          'previousHomeScore', p_previous_home_score,
          'previousAwayScore', p_previous_away_score,
          'homeScore', p_home_score,
          'awayScore', p_away_score,
          'scorerName', nullif(left(btrim(p_scorer_name), 160), ''),
          'matchClock', nullif(left(btrim(p_match_clock), 40), ''),
          'sourceObservedAt', p_source_observed_at,
          'detectedAt', detected_time,
          'durationMs', candidate.duration_ms,
          'underlayPolicy', candidate.underlay_policy,
          'logoMediaAssetId', case when p_scoring_side = 'unknown'
            then null else candidate.config_snapshot ->> 'logoMediaAssetId' end,
          'mediaAssetId', candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownMediaAssetId'
            when p_scoring_side = 'opponent' then 'opponentMediaAssetId'
            else 'unknownMediaAssetId' end,
          'soundMediaAssetId', candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownSoundMediaAssetId'
            when p_scoring_side = 'opponent' then 'opponentSoundMediaAssetId'
            else 'unknownSoundMediaAssetId' end,
          'soundVolume', coalesce((candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownSoundVolume'
            else 'opponentSoundVolume' end)::integer, 70),
          'sponsorMediaAssetId', case
            when coalesce((candidate.config_snapshot ->> 'sponsorOnlyOwn')::boolean, false)
              and p_scoring_side <> 'own' then null
            else candidate.config_snapshot ->> 'sponsorMediaAssetId' end,
          'design', candidate.config_snapshot -> case
            when p_scoring_side = 'own' then 'ownDesign'
            when p_scoring_side = 'opponent' then 'opponentDesign'
            else 'unknownDesign' end
        ),
        detected_time + interval '750 milliseconds',
        detected_time + make_interval(secs => candidate.duration_ms::double precision / 1000.0)
          + interval '2750 milliseconds'
      from candidates candidate
      where candidate.target_rank = 1
      on conflict (tenant_id, goal_event_id, screen_id)
        where message_kind = 'goal' do nothing
      returning id
    )
    select count(*) into delivery_count from inserted;
    if delivery_count > 0 then event_status := 'dispatched'; end if;
    update public.ledscores_goal_events set dispatch_status = event_status
    where tenant_id = connection_record.tenant_id and id = created_event_id;
  end if;

  insert into public.ledscores_connector_events(
    tenant_id, connection_id, event_type, severity, detail
  ) values (
    connection_record.tenant_id, p_connection_id,
    case when p_event_kind = 'synthetic_test' then 'synthetic_goal_test' else 'goal_detected' end,
    case when event_status = 'dispatched' then 'info' else 'warning' end,
    jsonb_build_object(
      'eventId', created_event_id, 'dispatchStatus', event_status,
      'deliveryCount', delivery_count, 'scoringSide', p_scoring_side
    )
  );
  return jsonb_build_object(
    'outcome', 'created', 'eventId', created_event_id,
    'dispatchStatus', event_status, 'deliveryCount', delivery_count,
    'detectedAt', detected_time
  );
end;
$$;

revoke all on function public.claim_ledscores_connections_v1(text,integer,integer)
  from public, anon, authenticated;
revoke all on function public.renew_ledscores_connection_lease_v1(uuid,text,integer)
  from public, anon, authenticated;
revoke all on function public.record_ledscores_connector_state_v1(
  uuid,text,text,text,text,jsonb,jsonb,timestamptz,boolean
) from public, anon, authenticated;
revoke all on function public.touch_ledscores_connection_v1(uuid,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_ledscores_connection_lease_v1(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.dispatch_ledscores_goal_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) from public, anon;
grant execute on function public.claim_ledscores_connections_v1(text,integer,integer)
  to service_role;
grant execute on function public.renew_ledscores_connection_lease_v1(uuid,text,integer)
  to service_role;
grant execute on function public.record_ledscores_connector_state_v1(
  uuid,text,text,text,text,jsonb,jsonb,timestamptz,boolean
) to service_role;
grant execute on function public.touch_ledscores_connection_v1(uuid,text,jsonb,timestamptz)
  to service_role;
grant execute on function public.release_ledscores_connection_lease_v1(uuid,text,text)
  to service_role;
grant execute on function public.dispatch_ledscores_goal_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) to authenticated, service_role;

create or replace function private.enqueue_ledscores_configuration_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.ledscores_feature_enabled(p_tenant_id) then
    insert into public.ledscores_player_deliveries(
      tenant_id, screen_id, message_kind, payload, execute_at, expires_at
    ) values (
      p_tenant_id, p_screen_id, 'configuration',
      jsonb_build_object('reason', left(p_reason, 80)),
      clock_timestamp(), clock_timestamp() + interval '1 day'
    );
  end if;
end;
$$;
revoke all on function private.enqueue_ledscores_configuration_v1(uuid,uuid,text)
  from public, anon, authenticated;

create or replace function private.notify_ledscores_membership_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_ledscores_configuration_v1(
    coalesce(new.tenant_id, old.tenant_id),
    coalesce(new.screen_id, old.screen_id),
    'screen_group_membership_changed'
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.notify_ledscores_membership_change_v1()
  from public, anon, authenticated;
create trigger screen_group_memberships_notify_ledscores
after insert or delete on public.screen_group_memberships
for each row execute function private.notify_ledscores_membership_change_v1();

create or replace function public.set_screen_group_memberships_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_group_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_groups uuid[] := array(
    select distinct value from unnest(coalesce(p_group_ids, '{}'::uuid[])) value
    order by value
  );
begin
  if actor_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.screen.manage') then
    raise exception 'screen manage capability required' using errcode = '42501';
  end if;
  if cardinality(normalized_groups) > 100 then
    raise exception 'too many screen groups' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.screens
    where tenant_id = p_tenant_id and id = p_screen_id and deleted_at is null
  ) then
    raise exception 'screen not found' using errcode = 'P0002';
  end if;
  if (
    select count(*) from public.screen_groups group_record
    where group_record.tenant_id = p_tenant_id
      and group_record.id = any(normalized_groups)
      and group_record.status = 'active'
  ) <> cardinality(normalized_groups) then
    raise exception 'screen group unavailable' using errcode = '23514';
  end if;
  delete from public.screen_group_memberships membership
  where membership.tenant_id = p_tenant_id
    and membership.screen_id = p_screen_id
    and not (membership.screen_group_id = any(normalized_groups));
  insert into public.screen_group_memberships(
    tenant_id, screen_group_id, screen_id
  )
  select p_tenant_id, value, p_screen_id
  from unnest(normalized_groups) value
  on conflict (tenant_id, screen_group_id, screen_id) do nothing;
  perform private.audit_event(
    p_tenant_id, 'screen.group_memberships.replaced', 'screens', p_screen_id,
    'success', jsonb_build_object('groupIds', to_jsonb(normalized_groups))
  );
  return cardinality(normalized_groups);
end;
$$;

create or replace function public.set_ledscores_goal_alert_status_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_status text,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  );
  alert_record public.ledscores_goal_alerts%rowtype;
begin
  if p_status not in ('published', 'paused', 'archived') then
    raise exception 'invalid LED Scores alert status' using errcode = '23514';
  end if;
  select * into alert_record
  from public.ledscores_goal_alerts alert
  where alert.tenant_id = p_tenant_id and alert.id = p_alert_id
  for update;
  if not found then
    raise exception 'LED Scores goal alert not found' using errcode = 'P0002';
  end if;
  if alert_record.revision <> p_expected_revision then
    return jsonb_build_object(
      'outcome', 'conflict', 'actualRevision', alert_record.revision,
      'alertId', alert_record.id
    );
  end if;
  if p_status = 'published' and alert_record.current_published_version_id is null then
    raise exception 'publish a version before activating this alert' using errcode = '23514';
  end if;
  if alert_record.status = 'archived' then
    raise exception 'archived LED Scores goal alert cannot be activated' using errcode = '55000';
  end if;
  update public.ledscores_goal_alerts set
    status = p_status,
    revision = revision + 1,
    updated_by = actor_id,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_alert_id
  returning * into alert_record;
  insert into public.ledscores_player_deliveries(
    tenant_id, screen_id, message_kind, alert_version_id, payload,
    execute_at, expires_at
  )
  select
    p_tenant_id, target_screen.screen_id, 'configuration',
    alert_record.current_published_version_id,
    jsonb_build_object('reason', 'alert_status_changed'),
    clock_timestamp(), clock_timestamp() + interval '1 day'
  from (
    select distinct membership.screen_id
    from public.ledscores_goal_alert_version_groups target
    join public.screen_group_memberships membership
      on membership.tenant_id = target.tenant_id
      and membership.screen_group_id = target.screen_group_id
    where target.tenant_id = p_tenant_id
      and target.alert_version_id = alert_record.current_published_version_id
  ) target_screen;
  perform private.audit_event(
    p_tenant_id, 'ledscores.goal_alert.status_changed', 'ledscores_goal_alerts',
    p_alert_id, 'success', jsonb_build_object('status', p_status)
  );
  return jsonb_build_object(
    'outcome', 'saved', 'actualRevision', alert_record.revision,
    'alertId', alert_record.id, 'status', alert_record.status
  );
end;
$$;

create or replace function public.run_ledscores_synthetic_goal_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_scoring_side text,
  p_home_score integer default 4,
  p_away_score integer default 2,
  p_scorer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_ledscores_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  );
  alert_record public.ledscores_goal_alerts%rowtype;
  canonical_key text;
  published_config jsonb;
  result jsonb;
begin
  if not private.has_tenant_capability(p_tenant_id, 'tenant.playlist.publish') then
    raise exception 'playlist publish capability required' using errcode = '42501';
  end if;
  if p_scoring_side not in ('own', 'opponent') then
    raise exception 'invalid synthetic scoring side' using errcode = '23514';
  end if;
  if p_home_score not between 0 and 999
    or p_away_score not between 0 and 999
    or (p_scoring_side = 'own' and p_home_score < 1)
    or (p_scoring_side = 'opponent' and p_away_score < 1)
    or length(coalesce(p_scorer_name, '')) > 160 then
    raise exception 'invalid synthetic score example' using errcode = '23514';
  end if;
  select * into alert_record
  from public.ledscores_goal_alerts alert
  where alert.tenant_id = p_tenant_id
    and alert.id = p_alert_id
    and alert.status = 'published';
  if not found then
    raise exception 'published LED Scores alert not found' using errcode = 'P0002';
  end if;
  select version.config_snapshot into published_config
  from public.ledscores_goal_alert_versions version
  where version.tenant_id = p_tenant_id
    and version.id = alert_record.current_published_version_id;
  canonical_key := encode(extensions.digest(
    pg_catalog.convert_to(
      p_tenant_id::text || ':' || p_alert_id::text || ':' || gen_random_uuid()::text,
      'UTF8'
    ), 'sha256'
  ), 'hex');
  select public.dispatch_ledscores_goal_v1(
    alert_record.connection_id,
    'control:' || actor_id::text,
    canonical_key,
    'synthetic-' || canonical_key,
    'synthetic-test-' || p_alert_id::text,
    'VeyoCast thuis',
    'VeyoCast uit',
    p_home_score - case when p_scoring_side = 'own' then 1 else 0 end,
    p_away_score - case when p_scoring_side = 'opponent' then 1 else 0 end,
    p_home_score,
    p_away_score,
    p_scoring_side,
    nullif(btrim(p_scorer_name), ''),
    '12:34',
    clock_timestamp(),
    'synthetic_test',
    p_alert_id,
    case when p_scoring_side = 'own' then 'home' else 'away' end,
    case when p_scoring_side = 'own'
      then coalesce(published_config -> 'ownTeamKeys' ->> 0, 'synthetic-own')
      else 'synthetic-opponent' end
  ) into result;
  perform private.audit_event(
    p_tenant_id, 'ledscores.goal_alert.synthetic_test', 'ledscores_goal_alerts',
    p_alert_id, 'success', result
  );
  return result;
end;
$$;

create or replace function public.get_ledscores_player_bootstrap_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
  configs jsonb;
  pending_deliveries jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid player credential' using errcode = '22023';
  end if;
  select * into device_record
  from public.player_devices device
  where device.token_hash = p_token_hash and device.status = 'paired';
  if not found then
    return jsonb_build_object('authorized', false);
  end if;
  if not private.ledscores_feature_enabled(device_record.tenant_id) then
    return jsonb_build_object(
      'authorized', true, 'enabled', false,
      'tenantId', device_record.tenant_id,
      'screenId', device_record.screen_id,
      'deviceId', device_record.id,
      'configs', '[]'::jsonb
    );
  end if;
  select coalesce(jsonb_agg(config order by (config ->> 'priority')::integer desc), '[]'::jsonb)
  into configs
  from (
    select distinct on (version.id)
      jsonb_build_object(
        'alertId', alert.id,
        'alertVersionId', version.id,
        'checksum', version.checksum_sha256,
        'priority', version.priority,
        'durationMs', version.duration_ms,
        'underlayPolicy', version.underlay_policy,
        'config', version.config_snapshot,
        'assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'mediaAssetId', asset.media_asset_id,
            'bucket', asset.storage_bucket,
            'path', asset.storage_path,
            'mimeType', asset.mime_type,
            'checksum', asset.checksum_sha256
          ) order by asset.media_asset_id)
          from public.ledscores_goal_alert_version_assets asset
          where asset.tenant_id = version.tenant_id
            and asset.alert_version_id = version.id
        ), '[]'::jsonb)
      ) as config
    from public.ledscores_goal_alerts alert
    join public.ledscores_goal_alert_versions version
      on version.tenant_id = alert.tenant_id
      and version.id = alert.current_published_version_id
    join public.ledscores_goal_alert_version_groups target
      on target.tenant_id = version.tenant_id
      and target.alert_version_id = version.id
    join public.screen_group_memberships membership
      on membership.tenant_id = target.tenant_id
      and membership.screen_group_id = target.screen_group_id
      and membership.screen_id = device_record.screen_id
    where alert.tenant_id = device_record.tenant_id
      and alert.status = 'published'
    order by version.id
  ) active_configs;
  select coalesce(jsonb_agg(delivery_payload order by execute_at), '[]'::jsonb)
  into pending_deliveries
  from (
    select
      delivery.execute_at,
      jsonb_build_object(
        'id', delivery.id,
        'screen_id', delivery.screen_id,
        'message_kind', delivery.message_kind,
        'alert_version_id', delivery.alert_version_id,
        'payload', delivery.payload,
        'execute_at', delivery.execute_at,
        'expires_at', delivery.expires_at
      ) as delivery_payload
    from public.ledscores_player_deliveries delivery
    where delivery.tenant_id = device_record.tenant_id
      and delivery.screen_id = device_record.screen_id
      and delivery.message_kind = 'goal'
      and delivery.status in ('pending', 'received')
      and delivery.expires_at > clock_timestamp()
    order by delivery.execute_at desc
    limit 1
  ) latest_delivery;
  return jsonb_build_object(
    'authorized', true,
    'enabled', true,
    'tenantId', device_record.tenant_id,
    'screenId', device_record.screen_id,
    'deviceId', device_record.id,
    'configs', configs,
    'pendingDeliveries', pending_deliveries
  );
end;
$$;

create or replace function public.ack_ledscores_player_delivery_v1(
  p_token_hash text,
  p_delivery_id uuid,
  p_status text,
  p_detail text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
  changed boolean := false;
  normalized_detail text := nullif(left(regexp_replace(btrim(p_detail), '[\r\n]+', ' ', 'g'), 300), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or p_status not in ('received', 'rendered', 'skipped', 'failed') then
    raise exception 'invalid delivery acknowledgement' using errcode = '22023';
  end if;
  select * into device_record from public.player_devices device
  where device.token_hash = p_token_hash and device.status = 'paired';
  if not found then return false; end if;
  update public.ledscores_player_deliveries delivery set
    status = case
      when delivery.status in ('rendered', 'skipped', 'failed') then delivery.status
      else p_status
    end,
    received_at = case when p_status = 'received'
      then coalesce(delivery.received_at, clock_timestamp()) else delivery.received_at end,
    rendered_at = case when p_status = 'rendered'
      then coalesce(delivery.rendered_at, clock_timestamp()) else delivery.rendered_at end,
    skipped_at = case when p_status = 'skipped'
      then coalesce(delivery.skipped_at, clock_timestamp()) else delivery.skipped_at end,
    failed_at = case when p_status = 'failed'
      then coalesce(delivery.failed_at, clock_timestamp()) else delivery.failed_at end,
    outcome_detail = coalesce(normalized_detail, delivery.outcome_detail),
    updated_at = now()
  where delivery.tenant_id = device_record.tenant_id
    and delivery.screen_id = device_record.screen_id
    and delivery.id = p_delivery_id
    and (
      delivery.status in ('pending', 'received')
      or delivery.status = p_status
    )
  returning true into changed;
  return coalesce(changed, false);
end;
$$;

create or replace function public.cleanup_ledscores_runtime_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_count integer;
  goal_count integer;
  connector_event_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  delete from public.ledscores_player_deliveries
  where expires_at < clock_timestamp() - interval '7 days';
  get diagnostics delivery_count = row_count;
  delete from public.ledscores_goal_events
  where created_at < clock_timestamp() - interval '30 days';
  get diagnostics goal_count = row_count;
  delete from public.ledscores_connector_events
  where occurred_at < clock_timestamp() - interval '30 days';
  get diagnostics connector_event_count = row_count;
  return jsonb_build_object(
    'deliveriesDeleted', delivery_count,
    'goalEventsDeleted', goal_count,
    'connectorEventsDeleted', connector_event_count
  );
end;
$$;

revoke all on function public.set_screen_group_memberships_v1(uuid,uuid,uuid[])
  from public, anon;
revoke all on function public.set_ledscores_goal_alert_status_v1(uuid,uuid,text,integer)
  from public, anon;
revoke all on function public.run_ledscores_synthetic_goal_v1(uuid,uuid,text,integer,integer,text)
  from public, anon;
revoke all on function public.get_ledscores_player_bootstrap_v1(text)
  from public, anon, authenticated;
revoke all on function public.ack_ledscores_player_delivery_v1(text,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.cleanup_ledscores_runtime_v1()
  from public, anon, authenticated;
grant execute on function public.set_screen_group_memberships_v1(uuid,uuid,uuid[])
  to authenticated, service_role;
grant execute on function public.set_ledscores_goal_alert_status_v1(uuid,uuid,text,integer)
  to authenticated, service_role;
grant execute on function public.run_ledscores_synthetic_goal_v1(uuid,uuid,text,integer,integer,text)
  to authenticated, service_role;
grant execute on function public.get_ledscores_player_bootstrap_v1(text)
  to service_role;
grant execute on function public.ack_ledscores_player_delivery_v1(text,uuid,text,text)
  to service_role;
grant execute on function public.cleanup_ledscores_runtime_v1()
  to service_role;

grant execute on function private.ledscores_feature_enabled(uuid)
  to authenticated, service_role;
