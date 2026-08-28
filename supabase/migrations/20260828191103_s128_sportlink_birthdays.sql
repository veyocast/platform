-- S128: dynamic Sportlink birthdays. Provider credentials stay in the existing
-- encrypted connection, workers own provider I/O and Players receive only the
-- minimum calculated display payload (never a birth year or member code).

alter table public.tenant_feature_flags
  drop constraint tenant_feature_flags_flag_key_check;
alter table public.tenant_feature_flags
  add constraint tenant_feature_flags_flag_key_check check (flag_key in (
    'vector_v2_design_system', 'vector_v2_marketing',
    'vector_v2_control_shell', 'vector_v2_mobile_shell',
    'vector_v2_player_shell', 'unified_resource_picker',
    'unified_filter_dock', 'venue_twin', 'screen_health_view',
    'engage', 'youtube_integration', 'sportlink_birthdays',
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

create or replace function private.enable_sportlink_birthdays_flag_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    insert into public.tenant_feature_flags(
      tenant_id, flag_key, enabled, rollout_reason, changed_by
    ) values (
      new.tenant_id, 'sportlink_birthdays', true,
      'Beschikbaar binnen de actieve Sportlink-integratie.', new.updated_by
    ) on conflict (tenant_id, flag_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enable_sportlink_birthdays_flag_v1()
  from public, anon, authenticated;
create trigger sportlink_connections_enable_birthdays_flag
after insert or update of status on public.sportlink_connections
for each row execute function private.enable_sportlink_birthdays_flag_v1();

insert into public.tenant_feature_flags(
  tenant_id, flag_key, enabled, rollout_reason, changed_by
)
select distinct connection.tenant_id, 'sportlink_birthdays', true,
  'Beschikbaar binnen de actieve Sportlink-integratie.', connection.updated_by
from public.sportlink_connections connection
where connection.status = 'active'
on conflict (tenant_id, flag_key) do nothing;

create table public.sportlink_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  identity_key text not null check (identity_key ~ '^[a-f0-9]{40}$'),
  external_member_code text check (
    external_member_code is null or length(external_member_code) between 1 and 120
  ),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  normalized_name text not null check (length(normalized_name) between 1 and 200),
  role text check (role is null or length(role) <= 80),
  team_assignments jsonb not null default '[]'::jsonb check (
    jsonb_typeof(team_assignments) = 'array' and jsonb_array_length(team_assignments) <= 20
  ),
  photo_provider_asset_version_id uuid references public.provider_asset_versions(id) on delete restrict,
  source_fetched_at timestamptz not null,
  active boolean not null default true,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  unique (tenant_id, connection_id, identity_key),
  unique (tenant_id, id)
);
create index sportlink_team_members_match_idx
  on public.sportlink_team_members(tenant_id, connection_id, normalized_name)
  where active;
create index sportlink_team_members_code_idx
  on public.sportlink_team_members(tenant_id, connection_id, external_member_code)
  where active and external_member_code is not null;

create table public.sportlink_birthdays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  external_id text not null check (external_id ~ '^[a-f0-9]{40}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  normalized_name text not null check (length(normalized_name) between 1 and 200),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_day smallint not null check (
    birth_day between 1 and extract(day from (
      make_date(2000, birth_month, 1) + interval '1 month - 1 day'
    ))::integer
  ),
  next_occurrence date not null,
  match_status text not null default 'unmatched'
    check (match_status in ('matched','ambiguous','unmatched','manual')),
  matched_team_member_id uuid,
  role text check (role is null or length(role) <= 80),
  team_assignments jsonb not null default '[]'::jsonb check (
    jsonb_typeof(team_assignments) = 'array' and jsonb_array_length(team_assignments) <= 20
  ),
  photo_provider_asset_version_id uuid references public.provider_asset_versions(id) on delete restrict,
  source_fetched_at timestamptz not null,
  active boolean not null default true,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  foreign key (tenant_id, matched_team_member_id)
    references public.sportlink_team_members(tenant_id, id) on delete set null,
  unique (tenant_id, connection_id, external_id),
  unique (tenant_id, id)
);
create index sportlink_birthdays_window_idx
  on public.sportlink_birthdays(tenant_id, connection_id, next_occurrence, display_name)
  where active;
create index sportlink_birthdays_conflicts_idx
  on public.sportlink_birthdays(tenant_id, connection_id, match_status)
  where active and match_status = 'ambiguous';

create table public.sportlink_birthday_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  idempotency_key uuid not null,
  source_file_name text not null check (length(source_file_name) between 1 and 180),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'applied' check (status in ('applied','partial','rolled_back','failed')),
  valid_count integer not null default 0 check (valid_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  rolled_back_by uuid references public.profiles(id) on delete set null,
  rolled_back_at timestamptz,
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);
create index sportlink_birthday_imports_tenant_idx
  on public.sportlink_birthday_imports(tenant_id, created_at desc);

create table public.sportlink_birthday_enrichments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  identity_key text not null check (identity_key ~ '^[a-f0-9]{40}$'),
  external_member_code text check (
    external_member_code is null or length(external_member_code) between 1 and 120
  ),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  normalized_name text not null check (length(normalized_name) between 1 and 200),
  birth_year smallint not null check (birth_year between 1901 and 2200),
  birth_month smallint check (birth_month is null or birth_month between 1 and 12),
  birth_day smallint check (birth_day is null or birth_day between 1 and 31),
  team text check (team is null or length(team) <= 120),
  role text check (role is null or length(role) <= 80),
  source_kind text not null check (source_kind in ('import','manual','existing_register')),
  source_import_id uuid,
  provenance_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, connection_id)
    references public.sportlink_connections(tenant_id, id) on delete cascade,
  foreign key (tenant_id, source_import_id)
    references public.sportlink_birthday_imports(tenant_id, id) on delete set null,
  unique (tenant_id, connection_id, identity_key),
  unique (tenant_id, id)
);
create index sportlink_birthday_enrichments_name_idx
  on public.sportlink_birthday_enrichments(tenant_id, connection_id, normalized_name);
create index sportlink_birthday_enrichments_code_idx
  on public.sportlink_birthday_enrichments(tenant_id, connection_id, external_member_code)
  where external_member_code is not null;
create trigger sportlink_birthday_enrichments_set_updated_at
before update on public.sportlink_birthday_enrichments
for each row execute function private.set_updated_at();

create table public.sportlink_birthday_import_changes (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  import_id uuid not null,
  enrichment_id uuid not null,
  previous_value jsonb,
  applied_value jsonb not null check (jsonb_typeof(applied_value) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, import_id)
    references public.sportlink_birthday_imports(tenant_id, id) on delete cascade,
  foreign key (tenant_id, enrichment_id)
    references public.sportlink_birthday_enrichments(tenant_id, id) on delete cascade,
  unique (tenant_id, import_id, enrichment_id)
);
create index sportlink_birthday_import_changes_import_idx
  on public.sportlink_birthday_import_changes(tenant_id, import_id);

create table public.sportlink_birthday_manual_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  birthday_id uuid not null,
  team_member_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, birthday_id)
    references public.sportlink_birthdays(tenant_id, id) on delete cascade,
  foreign key (tenant_id, team_member_id)
    references public.sportlink_team_members(tenant_id, id) on delete cascade,
  unique (tenant_id, birthday_id),
  unique (tenant_id, id)
);
create index sportlink_birthday_manual_links_member_idx
  on public.sportlink_birthday_manual_links(tenant_id, team_member_id);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'sportlink_team_members','sportlink_birthdays',
    'sportlink_birthday_imports','sportlink_birthday_enrichments',
    'sportlink_birthday_import_changes','sportlink_birthday_manual_links'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

create policy sportlink_birthdays_read on public.sportlink_birthdays
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
create policy sportlink_team_members_manage_read on public.sportlink_team_members
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.manage')
);
create policy sportlink_birthday_imports_manage_read on public.sportlink_birthday_imports
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.manage')
);
create policy sportlink_birthday_enrichments_manage_read on public.sportlink_birthday_enrichments
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.manage')
);
create policy sportlink_birthday_import_changes_manage_read on public.sportlink_birthday_import_changes
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.manage')
);
create policy sportlink_birthday_manual_links_manage_read on public.sportlink_birthday_manual_links
for select to authenticated using (
  private.has_tenant_capability(tenant_id, 'tenant.data_source.manage')
);

grant select on public.sportlink_birthdays to authenticated;
grant select on public.sportlink_team_members,
  public.sportlink_birthday_imports,
  public.sportlink_birthday_enrichments,
  public.sportlink_birthday_import_changes,
  public.sportlink_birthday_manual_links to authenticated;

create or replace function public.activate_sportlink_birthdays_v1(
  p_connection_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select * into connection from public.sportlink_connections
  where id = p_connection_id for update;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_manage_required' using errcode = '42501';
  end if;
  if not private.tenant_feature_enabled_v1(
    connection.tenant_id, 'sportlink_birthdays'
  ) or connection.status <> 'active' then
    raise exception 'sportlink_birthdays_feature_unavailable' using errcode = '55000';
  end if;
  update public.sportlink_connections
  set privacy_birthdays_enabled = p_enabled,
      updated_by = private.current_user_id()
  where id = connection.id;
  update public.sportlink_sync_policies
  set enabled = p_enabled,
      frequency = 'daily',
      next_sync_at = case when p_enabled then now() else next_sync_at end
  where connection_id = connection.id and dataset_group = 'public_people';
  insert into public.sportlink_capabilities(
    tenant_id, connection_id, article_key, capability, sensitivity,
    available, enabled, last_checked_at, last_status_code
  ) values (
    connection.tenant_id, connection.id, 'verjaardagen', 'birthdays',
    'public_people_minimized', true, p_enabled, now(), null
  ) on conflict (tenant_id, connection_id, article_key) do update set
    available = true, enabled = excluded.enabled,
    last_checked_at = now();
  perform private.audit_event(
    connection.tenant_id,
    case when p_enabled then 'sportlink.birthdays.activated'
      else 'sportlink.birthdays.deactivated' end,
    'sportlink_connections', connection.id, 'success',
    jsonb_build_object('enabled', p_enabled)
  );
end;
$$;
revoke all on function public.activate_sportlink_birthdays_v1(uuid,boolean)
  from public, anon;
grant execute on function public.activate_sportlink_birthdays_v1(uuid,boolean)
  to authenticated;

create or replace function public.request_sportlink_birthday_sync_v1(
  p_connection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select * into connection from public.sportlink_connections
  where id = p_connection_id for update;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_manage_required' using errcode = '42501';
  end if;
  if connection.status <> 'active' or not connection.privacy_birthdays_enabled
    or not private.tenant_feature_enabled_v1(
      connection.tenant_id, 'sportlink_birthdays'
    ) then
    raise exception 'sportlink_birthdays_not_active' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.sportlink_sync_policies
    where connection_id = connection.id and dataset_group = 'public_people'
      and manual_cooldown_until > now()
  ) then
    raise exception 'sportlink_manual_sync_cooldown' using errcode = '55000';
  end if;
  update public.sportlink_sync_policies
  set enabled = true, frequency = 'daily', next_sync_at = now(),
      manual_cooldown_until = now() + interval '15 minutes'
  where connection_id = connection.id and dataset_group = 'public_people';
  perform private.audit_event(
    connection.tenant_id, 'sportlink.birthdays.sync_requested',
    'sportlink_connections', connection.id, 'success',
    jsonb_build_object('source', 'manual')
  );
end;
$$;
revoke all on function public.request_sportlink_birthday_sync_v1(uuid)
  from public, anon;
grant execute on function public.request_sportlink_birthday_sync_v1(uuid)
  to authenticated;

create or replace function public.update_sportlink_sync_policy_v1(
  p_connection_id uuid,
  p_dataset_group text,
  p_frequency text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare connection public.sportlink_connections%rowtype;
begin
  select * into connection from public.sportlink_connections
  where id = p_connection_id;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id, 'tenant.data_source.manage'
  ) and not private.is_platform_member(array[
    'platform_owner','platform_admin'
  ]::public.platform_role[]) then
    raise exception 'sportlink_policy_manage_required' using errcode = '42501';
  end if;
  if p_frequency not in ('five_minutes','hourly','daily','weekly','monthly')
    or p_dataset_group not in (
      'club_profile','teams','competitions','matches','match_details',
      'activities','public_people','volunteers'
    ) then
    raise exception 'sportlink_policy_invalid' using errcode = '22023';
  end if;
  if p_enabled and p_dataset_group = 'public_people'
    and not (connection.privacy_people_enabled or connection.privacy_birthdays_enabled) then
    raise exception 'sportlink_privacy_opt_in_required' using errcode = '42501';
  end if;
  if p_enabled and p_dataset_group = 'volunteers'
    and not connection.privacy_people_enabled then
    raise exception 'sportlink_privacy_opt_in_required' using errcode = '42501';
  end if;
  update public.sportlink_sync_policies
  set frequency = case when p_dataset_group = 'public_people'
      and connection.privacy_birthdays_enabled then 'daily' else p_frequency end,
      enabled = p_enabled,
      next_sync_at = case when p_enabled then least(next_sync_at, now()) else next_sync_at end
  where connection_id = connection.id and dataset_group = p_dataset_group;
  perform private.audit_event(
    connection.tenant_id, 'sportlink.sync_policy.updated',
    'sportlink_connections', connection.id, 'success', jsonb_build_object(
      'datasetGroup', p_dataset_group, 'frequency', p_frequency,
      'enabled', p_enabled
    )
  );
end;
$$;
revoke all on function public.update_sportlink_sync_policy_v1(uuid,text,text,boolean)
  from public, anon;
grant execute on function public.update_sportlink_sync_policy_v1(uuid,text,text,boolean)
  to authenticated;

create or replace function public.get_sportlink_birthday_status_v1(
  p_connection_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
  birthday_last_success timestamptz;
begin
  select * into connection from public.sportlink_connections
  where id = p_connection_id;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id, 'tenant.data_source.read'
  ) then
    raise exception 'sportlink_birthdays_read_required' using errcode = '42501';
  end if;
  select policy.last_success_at into birthday_last_success
  from public.sportlink_sync_policies policy
  where policy.connection_id = connection.id
    and policy.dataset_group = 'public_people';
  return jsonb_build_object(
    'active', connection.status = 'active' and connection.privacy_birthdays_enabled,
    'featureEnabled', private.tenant_feature_enabled_v1(
      connection.tenant_id, 'sportlink_birthdays'
    ),
    'lastSuccessAt', birthday_last_success,
    'nextSyncAt', (
      select policy.next_sync_at from public.sportlink_sync_policies policy
      where policy.connection_id = connection.id
        and policy.dataset_group = 'public_people'
    ),
    'freshness', case
      when birthday_last_success is null then 'never'
      when birthday_last_success < now() - interval '21 days' then 'expired'
      when birthday_last_success < now() - interval '36 hours' then 'stale'
      else 'fresh' end,
    'counts', jsonb_build_object(
      'birthdays', (select count(*) from public.sportlink_birthdays birthday
        where birthday.connection_id = connection.id and birthday.active
          and birthday.next_occurrence <= current_date + 21),
      'knownAge', (select count(*) from public.sportlink_birthdays birthday
        where birthday.connection_id = connection.id and birthday.active and exists(
          select 1 from public.sportlink_birthday_enrichments enrichment
          where enrichment.connection_id = connection.id
            and (enrichment.external_member_code is not null and exists(
              select 1 from public.sportlink_team_members member
              where member.id = birthday.matched_team_member_id
                and member.external_member_code = enrichment.external_member_code
            ) or enrichment.normalized_name = birthday.normalized_name)
        )),
      'matched', (select count(*) from public.sportlink_birthdays birthday
        where birthday.connection_id = connection.id and birthday.active
          and birthday.match_status in ('matched','manual')),
      'withPhoto', (select count(*) from public.sportlink_birthdays birthday
        where birthday.connection_id = connection.id and birthday.active
          and birthday.photo_provider_asset_version_id is not null),
      'ambiguous', (select count(*) from public.sportlink_birthdays birthday
        where birthday.connection_id = connection.id and birthday.active
          and birthday.match_status = 'ambiguous')
    ),
    'lastErrorCode', (
      select run.error_code from public.sportlink_sync_runs run
      where run.connection_id = connection.id and run.dataset_group = 'public_people'
      order by run.started_at desc limit 1
    )
  );
end;
$$;
revoke all on function public.get_sportlink_birthday_status_v1(uuid)
  from public, anon;
grant execute on function public.get_sportlink_birthday_status_v1(uuid)
  to authenticated;

create or replace function public.get_sportlink_birthday_preview_v1(
  p_connection_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
begin
  select * into connection from public.sportlink_connections
  where id = p_connection_id;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode = 'P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id, 'tenant.data_source.read'
  ) then
    raise exception 'sportlink_birthdays_read_required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',birthday.id,
      'displayName',birthday.display_name,
      'month',birthday.birth_month,
      'day',birthday.birth_day,
      'nextOccurrence',birthday.next_occurrence,
      'matchStatus',birthday.match_status,
      'role',birthday.role,
      'teamAssignments',birthday.team_assignments,
      'photoAvailable',birthday.photo_provider_asset_version_id is not null,
      'sourceFetchedAt',birthday.source_fetched_at,
      'age',case when enrichment.birth_year is null then null else
        extract(year from birthday.next_occurrence)::integer - enrichment.birth_year
      end
    ) order by birthday.next_occurrence,birthday.display_name)
    from public.sportlink_birthdays birthday
    left join public.sportlink_team_members member
      on member.tenant_id=birthday.tenant_id
      and member.id=birthday.matched_team_member_id
    left join lateral (
      select candidate.birth_year
      from public.sportlink_birthday_enrichments candidate
      where candidate.tenant_id=birthday.tenant_id
        and candidate.connection_id=birthday.connection_id
        and (
          candidate.identity_key=member.identity_key
          or (member.external_member_code is not null
            and candidate.external_member_code=member.external_member_code)
          or (member.id is null
            and candidate.external_member_code is null
            and candidate.normalized_name=birthday.normalized_name)
        )
      order by (candidate.identity_key=member.identity_key) desc,
        candidate.provenance_at desc
      limit 1
    ) enrichment on true
    where birthday.tenant_id=connection.tenant_id
      and birthday.connection_id=connection.id and birthday.active
      and birthday.next_occurrence <= current_date + 21
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.get_sportlink_birthday_preview_v1(uuid)
  from public, anon;
grant execute on function public.get_sportlink_birthday_preview_v1(uuid)
  to authenticated;

create or replace function public.claim_due_sportlink_sync_v2(
  p_worker_id text,
  p_lock_timeout_seconds integer default 900
)
returns table(
  run_id uuid,
  tenant_id uuid,
  connection_id uuid,
  data_source_id uuid,
  dataset_group text,
  encrypted_client_id text,
  encryption_iv text,
  encryption_tag text,
  timezone text
)
language sql
security definer
set search_path = ''
as $$
  select claim.run_id,claim.tenant_id,claim.connection_id,
    claim.data_source_id,claim.dataset_group,claim.encrypted_client_id,
    claim.encryption_iv,claim.encryption_tag,connection.timezone
  from public.claim_due_sportlink_sync_v1(
    p_worker_id,p_lock_timeout_seconds
  ) claim
  join public.sportlink_connections connection
    on connection.id=claim.connection_id and connection.tenant_id=claim.tenant_id
$$;
revoke all on function public.claim_due_sportlink_sync_v2(text,integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_sportlink_sync_v2(text,integer)
  to service_role;

create or replace function public.complete_sportlink_birthdays_v1(
  p_run_id uuid,
  p_worker_id text,
  p_birthdays jsonb,
  p_team_members jsonb,
  p_person_photos jsonb,
  p_fetched_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_run public.sportlink_sync_runs%rowtype;
  connection public.sportlink_connections%rowtype;
  item jsonb;
  matched_member_id uuid;
  birthday_read_count integer := 0;
  normalized_birthdays jsonb := coalesce(p_birthdays, '[]'::jsonb);
  normalized_members jsonb := coalesce(p_team_members, '[]'::jsonb);
  normalized_photos jsonb := coalesce(p_person_photos, '[]'::jsonb);
  v_cache_id uuid;
  version_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into sync_run from public.sportlink_sync_runs
  where id = p_run_id for update;
  if sync_run.id is null then
    raise exception 'sportlink_sync_run_not_found' using errcode = 'P0002';
  end if;
  if sync_run.status <> 'running'
    or sync_run.dataset_group <> 'public_people'
    or sync_run.worker_id is distinct from nullif(btrim(p_worker_id), '') then
    raise exception 'sportlink_sync_lease_not_owned' using errcode = '42501';
  end if;
  select * into connection from public.sportlink_connections
  where id = sync_run.connection_id and tenant_id = sync_run.tenant_id;
  if connection.id is null or connection.status <> 'active'
    or not connection.privacy_birthdays_enabled
    or not exists (
      select 1 from public.tenant_feature_flags flag
      where flag.tenant_id = connection.tenant_id
        and flag.flag_key = 'sportlink_birthdays' and flag.enabled
    ) then
    raise exception 'sportlink_birthdays_not_active' using errcode = '55000';
  end if;
  if jsonb_typeof(normalized_birthdays) <> 'array'
    or jsonb_array_length(normalized_birthdays) > 250
    or jsonb_typeof(normalized_members) <> 'array'
    or jsonb_array_length(normalized_members) > 1000
    or jsonb_typeof(normalized_photos) <> 'array'
    or jsonb_array_length(normalized_photos) > 250
    or p_fetched_at is null or p_fetched_at > now() + interval '5 minutes'
    or p_fetched_at < now() - interval '1 day' then
    raise exception 'sportlink_birthdays_payload_invalid' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(normalized_photos) loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item->>'assetId','') !~ '^[0-9a-f-]{36}$'
      or coalesce(item->>'checksumSha256','') !~ '^[a-f0-9]{64}$'
      or item->>'mimeType' is distinct from 'image/webp'
      or item->>'role' is distinct from 'person_photo'
      or coalesce(item->>'externalId','') !~ '^[a-f0-9]{40}$'
      or coalesce(item->>'storagePath','') !~
        '^providers/sportlink/person_photo/[a-f0-9]{64}\.webp$'
      or coalesce(item->>'fileSizeBytes','') !~ '^[0-9]{1,8}$'
      or coalesce(item->>'width','') !~ '^[0-9]{1,4}$'
      or coalesce(item->>'height','') !~ '^[0-9]{1,4}$' then
      raise exception 'sportlink_person_photo_payload_invalid' using errcode='22023';
    end if;
    insert into public.provider_asset_cache(
      provider,entity_type,external_entity_id,asset_role,source_url,
      last_checked_at,last_success_at,last_error_code,updated_at
    ) values (
      'sportlink','person',item->>'externalId','person_photo',
      nullif(item->>'sourceUrl',''),now(),now(),null,now()
    ) on conflict (provider,entity_type,external_entity_id,asset_role)
    do update set source_url=coalesce(excluded.source_url,provider_asset_cache.source_url),
      last_checked_at=now(),last_success_at=now(),last_error_code=null,updated_at=now()
    returning id into v_cache_id;
    version_id := (item->>'assetId')::uuid;
    insert into public.provider_asset_versions(
      id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,
      file_size_bytes,width,height
    ) values (
      version_id,v_cache_id,item->>'checksumSha256','provider-assets',
      item->>'storagePath','image/webp',(item->>'fileSizeBytes')::bigint,
      (item->>'width')::integer,(item->>'height')::integer
    ) on conflict (cache_id,checksum_sha256) do update
      set checksum_sha256=excluded.checksum_sha256
    returning id into version_id;
    update public.provider_asset_cache set current_version_id=version_id,updated_at=now()
    where id=v_cache_id;
  end loop;

  -- Validate the complete bounded batch before changing the Last Known Good.
  for item in select value from jsonb_array_elements(normalized_members) loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item->>'identityKey','') !~ '^[a-f0-9]{40}$'
      or length(btrim(coalesce(item->>'displayName',''))) not between 1 and 160
      or length(coalesce(item->>'normalizedName','')) not between 1 and 200
      or (item->>'externalMemberCode' is not null
        and length(item->>'externalMemberCode') not between 1 and 120)
      or (item->>'role' is not null and length(item->>'role') > 80)
      or (item->>'photoProviderAssetVersionId' is not null
        and item->>'photoProviderAssetVersionId' !~ '^[0-9a-f-]{36}$')
      or (item->>'photoProviderAssetVersionId' is not null and not exists(
        select 1 from public.provider_asset_versions photo_version
        join public.provider_asset_cache photo_cache
          on photo_cache.id=photo_version.cache_id
        where photo_version.id=(item->>'photoProviderAssetVersionId')::uuid
          and photo_cache.provider='sportlink'
          and photo_cache.entity_type='person'
          and photo_cache.external_entity_id=item->>'identityKey'
          and photo_cache.asset_role='person_photo'
      ))
      or jsonb_typeof(coalesce(item->'teamAssignments','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(item->'teamAssignments','[]'::jsonb)) > 20 then
      raise exception 'sportlink_team_member_payload_invalid' using errcode = '22023';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(normalized_birthdays) loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item->>'externalId','') !~ '^[a-f0-9]{40}$'
      or length(btrim(coalesce(item->>'displayName',''))) not between 1 and 160
      or length(coalesce(item->>'normalizedName','')) not between 1 and 200
      or coalesce(item->>'month','') !~ '^([1-9]|1[0-2])$'
      or coalesce(item->>'day','') !~ '^([1-9]|[12][0-9]|3[01])$'
      or coalesce(item->>'nextOccurrence','') !~ '^\d{4}-\d{2}-\d{2}$'
      or item->>'matchStatus' not in ('matched','ambiguous','unmatched')
      or (item->>'memberIdentityKey' is not null
        and item->>'memberIdentityKey' !~ '^[a-f0-9]{40}$')
      or jsonb_typeof(coalesce(item->'teamAssignments','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(item->'teamAssignments','[]'::jsonb)) > 20 then
      raise exception 'sportlink_birthday_payload_invalid' using errcode = '22023';
    end if;
  end loop;

  update public.sportlink_team_members set active = false
  where tenant_id = sync_run.tenant_id and connection_id = connection.id;
  for item in select value from jsonb_array_elements(normalized_members) loop
    insert into public.sportlink_team_members(
      tenant_id, connection_id, identity_key, external_member_code,
      display_name, normalized_name, role, team_assignments,
      photo_provider_asset_version_id,source_fetched_at, active, last_synced_at
    ) values (
      sync_run.tenant_id, connection.id, item->>'identityKey',
      nullif(item->>'externalMemberCode',''), item->>'displayName',
      item->>'normalizedName', nullif(item->>'role',''),
      coalesce(item->'teamAssignments','[]'::jsonb),
      nullif(item->>'photoProviderAssetVersionId','')::uuid,
      p_fetched_at, true, now()
    ) on conflict (tenant_id, connection_id, identity_key) do update set
      external_member_code = excluded.external_member_code,
      display_name = excluded.display_name,
      normalized_name = excluded.normalized_name,
      role = excluded.role,
      team_assignments = excluded.team_assignments,
      photo_provider_asset_version_id = excluded.photo_provider_asset_version_id,
      source_fetched_at = excluded.source_fetched_at,
      active = true,
      last_synced_at = now();
    birthday_read_count := birthday_read_count + 1;
  end loop;

  update public.sportlink_birthdays set active = false
  where tenant_id = sync_run.tenant_id and connection_id = connection.id;
  for item in select value from jsonb_array_elements(normalized_birthdays) loop
    matched_member_id := null;
    if item->>'memberIdentityKey' is not null then
      select member.id into matched_member_id
      from public.sportlink_team_members member
      where member.tenant_id = sync_run.tenant_id
        and member.connection_id = connection.id
        and member.identity_key = item->>'memberIdentityKey'
        and member.active;
    end if;
    insert into public.sportlink_birthdays(
      tenant_id, connection_id, external_id, display_name, normalized_name,
      birth_month, birth_day, next_occurrence, match_status,
      matched_team_member_id, role, team_assignments, source_fetched_at,
      active, last_synced_at
    ) values (
      sync_run.tenant_id, connection.id, item->>'externalId',
      item->>'displayName', item->>'normalizedName',
      (item->>'month')::smallint, (item->>'day')::smallint,
      (item->>'nextOccurrence')::date, item->>'matchStatus',
      matched_member_id, nullif(item->>'role',''),
      coalesce(item->'teamAssignments','[]'::jsonb), p_fetched_at,
      true, now()
    ) on conflict (tenant_id, connection_id, external_id) do update set
      display_name = excluded.display_name,
      normalized_name = excluded.normalized_name,
      birth_month = excluded.birth_month,
      birth_day = excluded.birth_day,
      next_occurrence = excluded.next_occurrence,
      match_status = excluded.match_status,
      matched_team_member_id = excluded.matched_team_member_id,
      role = excluded.role,
      team_assignments = excluded.team_assignments,
      source_fetched_at = excluded.source_fetched_at,
      active = true,
      last_synced_at = now();
    birthday_read_count := birthday_read_count + 1;
  end loop;

  -- Explicit tenant decisions win over subsequent exact-match observations.
  update public.sportlink_birthdays birthday
  set matched_team_member_id = member.id,
      match_status = 'manual',
      role = member.role,
      team_assignments = member.team_assignments,
      photo_provider_asset_version_id = member.photo_provider_asset_version_id
  from public.sportlink_birthday_manual_links link
  join public.sportlink_team_members member
    on member.tenant_id = link.tenant_id and member.id = link.team_member_id
  where birthday.tenant_id = link.tenant_id
    and birthday.id = link.birthday_id
    and birthday.tenant_id = sync_run.tenant_id
    and birthday.connection_id = connection.id
    and member.connection_id = connection.id and member.active;

  -- Reuse the canonical source revision, provider status and LKG metadata path.
  perform public.record_sportlink_sync_v1(
    connection.id, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
  );
  update public.sportlink_sync_runs
  set status = 'succeeded', finished_at = now(),
      read_count = birthday_read_count,
      error_code = null, error_detail = null
  where id = sync_run.id;
  update public.sportlink_sync_policies
  set last_success_at = now(), frequency = 'daily'
  where connection_id = connection.id and dataset_group = 'public_people';
  update public.sportlink_connections
  set last_success_at = now(), last_error_code = null,
      stale_after = p_fetched_at + interval '21 days',
      last_duration_ms = greatest(0, floor(extract(epoch from (
        now() - sync_run.started_at
      )) * 1000)::integer)
  where id = connection.id;
  insert into public.sportlink_capabilities(
    tenant_id, connection_id, article_key, capability, sensitivity,
    available, enabled, last_checked_at, last_status_code
  ) values (
    sync_run.tenant_id, connection.id, 'verjaardagen', 'birthdays',
    'public_people_minimized', true, true, now(), 200
  ) on conflict (tenant_id, connection_id, article_key) do update set
    available = true, enabled = true, last_checked_at = now(), last_status_code = 200;
  perform private.queue_latest_dynamic_snapshots_v2(
    sync_run.tenant_id, connection.data_source_id,
    array['sport_birthdays'], 'sportlink_birthdays_changed'
  );
  perform private.audit_event(
    sync_run.tenant_id, 'sportlink.sync.succeeded',
    'sportlink_sync_runs', sync_run.id, 'success',
    jsonb_build_object(
      'birthdayCount', jsonb_array_length(normalized_birthdays),
      'teamMemberCount', jsonb_array_length(normalized_members)
    )
  );
  return jsonb_build_object(
    'outcome','succeeded','readCount',birthday_read_count
  );
end;
$$;
revoke all on function public.complete_sportlink_birthdays_v1(
  uuid,text,jsonb,jsonb,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_sportlink_birthdays_v1(
  uuid,text,jsonb,jsonb,jsonb,timestamptz
) to service_role;

create or replace function public.apply_sportlink_birthday_import_v1(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_idempotency_key uuid,
  p_source_file_name text,
  p_source_checksum_sha256 text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  v_import_id uuid;
  existing_import public.sportlink_birthday_imports%rowtype;
  item jsonb;
  enrichment public.sportlink_birthday_enrichments%rowtype;
  v_identity_key text;
  v_normalized_name text;
  member_code text;
  birth_year integer;
  v_valid_count integer := 0;
  v_invalid_count integer := 0;
  v_duplicate_count integer := 0;
  v_conflict_count integer := 0;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_import_required' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1 from public.sportlink_connections connection
    join public.tenant_feature_flags flag
      on flag.tenant_id = connection.tenant_id
      and flag.flag_key = 'sportlink_birthdays' and flag.enabled
    where connection.id = p_connection_id
      and connection.tenant_id = p_tenant_id
      and connection.status = 'active'
      and connection.privacy_birthdays_enabled
  ) then
    raise exception 'sportlink_birthdays_not_active' using errcode = '55000';
  end if;
  if length(btrim(p_source_file_name)) not between 1 and 180
    or p_source_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(coalesce(p_rows,'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_rows) > 10000 then
    raise exception 'sportlink_birthday_import_invalid' using errcode = '22023';
  end if;
  select * into existing_import from public.sportlink_birthday_imports
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if existing_import.id is not null then
    return jsonb_build_object(
      'importId',existing_import.id,'status',existing_import.status,
      'valid',existing_import.valid_count,'invalid',existing_import.invalid_count,
      'duplicates',existing_import.duplicate_count,
      'conflicts',existing_import.conflict_count,'idempotent',true
    );
  end if;
  insert into public.sportlink_birthday_imports(
    tenant_id,connection_id,idempotency_key,source_file_name,
    source_checksum_sha256,created_by
  ) values (
    p_tenant_id,p_connection_id,p_idempotency_key,
    btrim(p_source_file_name),p_source_checksum_sha256,actor_id
  ) returning id into v_import_id;

  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) <> 'object' or item->>'status' <> 'valid' then
      if item->>'status' = 'duplicate' then
        v_duplicate_count := v_duplicate_count + 1;
      elsif item->>'status' = 'conflict' then
        v_conflict_count := v_conflict_count + 1;
      else
        v_invalid_count := v_invalid_count + 1;
      end if;
      continue;
    end if;
    v_normalized_name := nullif(btrim(item#>>'{normalized,normalizedName}'),'');
    member_code := nullif(btrim(item#>>'{normalized,externalMemberCode}'),'');
    if coalesce(item#>>'{normalized,birthYear}','') !~ '^\d{4}$' then
      v_invalid_count := v_invalid_count + 1;
      continue;
    end if;
    birth_year := (item#>>'{normalized,birthYear}')::integer;
    if v_normalized_name is null or length(v_normalized_name) > 200
      or member_code is not null and length(member_code) > 120
      or birth_year < 1901 or birth_year > extract(year from current_date)::integer
      or length(btrim(coalesce(item#>>'{normalized,displayName}',''))) not between 1 and 160
      or coalesce(item#>>'{normalized,displayName}','') ~ '^[-=+@]'
      or coalesce(member_code,'') ~ '^[-=+@]'
      or coalesce(item#>>'{normalized,team}','') ~ '^[-=+@]'
      or coalesce(item#>>'{normalized,role}','') ~ '^[-=+@]' then
      v_invalid_count := v_invalid_count + 1;
      continue;
    end if;
    if member_code is null and (
      select count(distinct member.identity_key)
      from public.sportlink_team_members member
      where member.tenant_id = p_tenant_id
        and member.connection_id = p_connection_id
        and member.normalized_name = v_normalized_name and member.active
    ) > 1 then
      v_conflict_count := v_conflict_count + 1;
      continue;
    end if;
    v_identity_key := left(encode(extensions.digest(
      case when member_code is not null then 'code:' || member_code
        else 'name:' || v_normalized_name end,
      'sha256'
    ),'hex'),40);
    if exists (
      select 1 from public.sportlink_birthday_import_changes change
      where change.tenant_id = p_tenant_id and change.import_id = v_import_id
        and change.applied_value->>'identityKey' = v_identity_key
    ) then
      v_duplicate_count := v_duplicate_count + 1;
      continue;
    end if;
    select * into enrichment from public.sportlink_birthday_enrichments
    where tenant_id = p_tenant_id and connection_id = p_connection_id
      and sportlink_birthday_enrichments.identity_key = v_identity_key
    for update;
    if enrichment.id is not null and enrichment.birth_year <> birth_year then
      v_conflict_count := v_conflict_count + 1;
      continue;
    end if;
    if enrichment.id is not null then
      v_duplicate_count := v_duplicate_count + 1;
      continue;
    end if;
    insert into public.sportlink_birthday_enrichments(
      tenant_id,connection_id,identity_key,external_member_code,
      display_name,normalized_name,birth_year,birth_month,birth_day,
      team,role,source_kind,source_import_id,provenance_at,
      created_by,updated_by
    ) values (
      p_tenant_id,p_connection_id,v_identity_key,member_code,
      btrim(item#>>'{normalized,displayName}'),v_normalized_name,birth_year,
      nullif(item#>>'{normalized,birthMonth}','')::smallint,
      nullif(item#>>'{normalized,birthDay}','')::smallint,
      nullif(btrim(item#>>'{normalized,team}'),''),
      nullif(btrim(item#>>'{normalized,role}'),''),
      'import',v_import_id,now(),actor_id,actor_id
    ) returning * into enrichment;
    insert into public.sportlink_birthday_import_changes(
      tenant_id,import_id,enrichment_id,previous_value,applied_value
    ) values (
      p_tenant_id,v_import_id,enrichment.id,null,
      jsonb_build_object(
        'identityKey',v_identity_key,'birthYear',birth_year,'source','import'
      )
    );
    v_valid_count := v_valid_count + 1;
  end loop;
  update public.sportlink_birthday_imports set
    status = case when v_conflict_count + v_invalid_count > 0 then 'partial' else 'applied' end,
    valid_count = v_valid_count, invalid_count = v_invalid_count,
    duplicate_count = v_duplicate_count, conflict_count = v_conflict_count
  where id = v_import_id;
  perform private.queue_latest_dynamic_snapshots_v2(
    p_tenant_id,
    (select data_source_id from public.sportlink_connections where id=p_connection_id),
    array['sport_birthdays'],'sportlink_birthday_age_import'
  );
  perform private.audit_event(
    p_tenant_id,'sportlink.birthdays.import_applied',
    'sportlink_birthday_imports',v_import_id,'success',jsonb_build_object(
      'valid',v_valid_count,'invalid',v_invalid_count,
      'duplicates',v_duplicate_count,'conflicts',v_conflict_count
    )
  );
  return jsonb_build_object(
    'importId',v_import_id,
    'status',case when v_conflict_count + v_invalid_count > 0 then 'partial' else 'applied' end,
    'valid',v_valid_count,'invalid',v_invalid_count,
    'duplicates',v_duplicate_count,'conflicts',v_conflict_count,
    'idempotent',false
  );
end;
$$;
revoke all on function public.apply_sportlink_birthday_import_v1(
  uuid,uuid,uuid,text,text,jsonb
) from public, anon;
grant execute on function public.apply_sportlink_birthday_import_v1(
  uuid,uuid,uuid,text,text,jsonb
) to authenticated;

create or replace function public.rollback_sportlink_birthday_import_v1(
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  imported public.sportlink_birthday_imports%rowtype;
  change_record public.sportlink_birthday_import_changes%rowtype;
  v_data_source_id uuid;
begin
  select * into imported from public.sportlink_birthday_imports
  where id = p_import_id for update;
  if imported.id is null then
    raise exception 'sportlink_birthday_import_not_found' using errcode='P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    imported.tenant_id,'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_import_required' using errcode='42501';
  end if;
  if imported.status = 'rolled_back' then return; end if;
  for change_record in
    select * from public.sportlink_birthday_import_changes
    where tenant_id=imported.tenant_id and import_id=imported.id
    order by id desc
  loop
    if change_record.previous_value is null then
      delete from public.sportlink_birthday_enrichments
      where tenant_id=imported.tenant_id and id=change_record.enrichment_id
        and source_import_id=imported.id;
    else
      update public.sportlink_birthday_enrichments set
        birth_year=(change_record.previous_value->>'birthYear')::smallint,
        source_kind=change_record.previous_value->>'sourceKind',
        source_import_id=nullif(change_record.previous_value->>'sourceImportId','')::uuid,
        updated_by=actor_id
      where tenant_id=imported.tenant_id and id=change_record.enrichment_id;
    end if;
  end loop;
  update public.sportlink_birthday_imports set
    status='rolled_back',rolled_back_by=actor_id,rolled_back_at=now()
  where id=imported.id;
  select connection.data_source_id into v_data_source_id
  from public.sportlink_connections connection
  where id=imported.connection_id;
  perform private.queue_latest_dynamic_snapshots_v2(
    imported.tenant_id,v_data_source_id,array['sport_birthdays'],
    'sportlink_birthday_import_rollback'
  );
  perform private.audit_event(
    imported.tenant_id,'sportlink.birthdays.import_rolled_back',
    'sportlink_birthday_imports',imported.id,'success',
    jsonb_build_object('changed',imported.valid_count)
  );
end;
$$;
revoke all on function public.rollback_sportlink_birthday_import_v1(uuid)
  from public, anon;
grant execute on function public.rollback_sportlink_birthday_import_v1(uuid)
  to authenticated;

create or replace function public.resolve_sportlink_birthday_match_v1(
  p_birthday_id uuid,
  p_team_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  birthday public.sportlink_birthdays%rowtype;
  member public.sportlink_team_members%rowtype;
  actor_id uuid := private.current_user_id();
  v_data_source_id uuid;
begin
  select * into birthday from public.sportlink_birthdays
  where id=p_birthday_id and active for update;
  select * into member from public.sportlink_team_members
  where id=p_team_member_id and active;
  if birthday.id is null or member.id is null
    or birthday.tenant_id <> member.tenant_id
    or birthday.connection_id <> member.connection_id then
    raise exception 'sportlink_birthday_match_invalid' using errcode='23514';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    birthday.tenant_id,'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_manage_required' using errcode='42501';
  end if;
  insert into public.sportlink_birthday_manual_links(
    tenant_id,birthday_id,team_member_id,created_by
  ) values (
    birthday.tenant_id,birthday.id,member.id,actor_id
  ) on conflict (tenant_id,birthday_id) do update set
    team_member_id=excluded.team_member_id,created_by=actor_id,created_at=now();
  update public.sportlink_birthdays set
    matched_team_member_id=member.id,match_status='manual',
    role=member.role,team_assignments=member.team_assignments,
    photo_provider_asset_version_id=member.photo_provider_asset_version_id
  where id=birthday.id;
  select connection.data_source_id into v_data_source_id
  from public.sportlink_connections connection
  where id=birthday.connection_id;
  perform private.queue_latest_dynamic_snapshots_v2(
    birthday.tenant_id,v_data_source_id,array['sport_birthdays'],
    'sportlink_birthday_manual_match'
  );
  perform private.audit_event(
    birthday.tenant_id,'sportlink.birthdays.match_resolved',
    'sportlink_birthdays',birthday.id,'success',
    jsonb_build_object('teamMemberId',member.id)
  );
end;
$$;
revoke all on function public.resolve_sportlink_birthday_match_v1(uuid,uuid)
  from public, anon;
grant execute on function public.resolve_sportlink_birthday_match_v1(uuid,uuid)
  to authenticated;

create or replace function public.delete_sportlink_birthday_enrichments_v1(
  p_connection_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
  deleted_count integer;
begin
  select * into connection from public.sportlink_connections
  where id=p_connection_id;
  if connection.id is null then
    raise exception 'sportlink_connection_not_found' using errcode='P0002';
  end if;
  if not private.has_tenant_capability(
    connection.tenant_id,'tenant.data_source.manage'
  ) then
    raise exception 'sportlink_birthdays_manage_required' using errcode='42501';
  end if;
  select count(*) into deleted_count from public.sportlink_birthday_enrichments
  where tenant_id=connection.tenant_id and connection_id=connection.id;
  delete from public.sportlink_birthday_manual_links link
  using public.sportlink_birthdays birthday
  where link.tenant_id=connection.tenant_id
    and birthday.id=link.birthday_id and birthday.connection_id=connection.id;
  delete from public.sportlink_birthday_enrichments
  where tenant_id=connection.tenant_id and connection_id=connection.id;
  update public.sportlink_birthdays set
    matched_team_member_id=null,match_status='unmatched',role=null,
    team_assignments='[]'::jsonb,photo_provider_asset_version_id=null
  where tenant_id=connection.tenant_id and connection_id=connection.id
    and match_status='manual';
  perform private.queue_latest_dynamic_snapshots_v2(
    connection.tenant_id,connection.data_source_id,array['sport_birthdays'],
    'sportlink_birthday_enrichments_deleted'
  );
  perform private.audit_event(
    connection.tenant_id,'sportlink.birthdays.enrichments_deleted',
    'sportlink_connections',connection.id,'success',
    jsonb_build_object('deleted',deleted_count)
  );
  return deleted_count;
end;
$$;
revoke all on function public.delete_sportlink_birthday_enrichments_v1(uuid)
  from public, anon;
grant execute on function public.delete_sportlink_birthday_enrichments_v1(uuid)
  to authenticated;

create or replace function public.create_sportlink_birthday_slide_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_configuration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.sportlink_connections%rowtype;
  template_type text;
  template_orientation text;
  config jsonb := coalesce(p_configuration,'{}'::jsonb);
  result jsonb;
begin
  if not private.has_tenant_capability(
    p_tenant_id,'tenant.dynamic_slide.write'
  ) then
    raise exception 'sportlink_birthday_slide_write_required' using errcode='42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select * into connection from public.sportlink_connections
  where tenant_id=p_tenant_id and data_source_id=p_data_source_id
    and status='active';
  if connection.id is null or not connection.privacy_birthdays_enabled
    or not private.tenant_feature_enabled_v1(p_tenant_id,'sportlink_birthdays') then
    raise exception 'sportlink_birthdays_not_active' using errcode='55000';
  end if;
  select template.slide_type,template.orientation
  into template_type,template_orientation
  from public.dynamic_template_versions version
  join public.dynamic_templates template on template.id=version.template_id
  where version.id=p_template_version_id and version.status='published'
    and template.status='published';
  if template_type is distinct from 'sport_birthdays'
    or template_orientation not in ('landscape','portrait') then
    raise exception 'sportlink_birthday_template_invalid' using errcode='23514';
  end if;
  if jsonb_typeof(config)<>'object'
    or coalesce(config->>'schemaVersion','') <> '1'
    or config->>'emptyBehavior' not in ('skip','today_only','neutral')
    or config#>>'{period,days}' !~ '^([1-9]|1[0-9]|2[01])$'
    or config#>>'{presentation,pageDurationSeconds}' !~ '^([6-9]|1[0-9]|20)$'
    or config#>>'{presentation,maxPerLandscapePage}' !~ '^[1-8]$'
    or config#>>'{presentation,maxPerPortraitPage}' !~ '^[1-8]$'
    or config#>>'{presentation,layout}' not in (
      'auto','spotlight','celebration_grid','birthday_roll'
    ) then
    raise exception 'sportlink_birthday_configuration_invalid' using errcode='22023';
  end if;
  if nullif(config#>>'{presentation,backgroundMediaAssetId}','') is not null
    and not exists (
      select 1 from public.media_assets asset
      where asset.tenant_id=p_tenant_id
        and asset.id=(config#>>'{presentation,backgroundMediaAssetId}')::uuid
        and asset.status='ready' and asset.kind='image'
    ) then
    raise exception 'sportlink_birthday_background_invalid' using errcode='23514';
  end if;
  result := public.create_dynamic_slide_v1(
    p_tenant_id,btrim(p_name),p_template_version_id,p_data_source_id,'latest',
    jsonb_build_object(
      'schemaVersion',1,'blueprintKey','sportlink.birthdays',
      'title',coalesce(nullif(config->>'title',''),'Verjaardagen'),
      'birthday',config,'maxItems',250
    )
  );
  perform private.audit_event(
    p_tenant_id,'sportlink.birthdays.slide_created','dynamic_slides',
    (result->>'slideId')::uuid,'success',jsonb_build_object(
      'orientation',template_orientation,
      'periodDays',(config#>>'{period,days}')::integer,
      'emptyBehavior',config->>'emptyBehavior'
    )
  );
  return result;
end;
$$;
revoke all on function public.create_sportlink_birthday_slide_v1(
  uuid,uuid,text,uuid,jsonb
) from public, anon;
grant execute on function public.create_sportlink_birthday_slide_v1(
  uuid,uuid,text,uuid,jsonb
) to authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s128_birthdays;

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
  base jsonb;
  config jsonb := coalesce(
    p_slide.configuration_json->'birthday','{}'::jsonb
  );
  connection public.sportlink_connections%rowtype;
  birthday_items jsonb;
  fetched_at timestamptz;
  selected_team_ids text[] := array(
    select jsonb_array_elements_text(
      coalesce(config#>'{selection,selectedTeamIds}','[]'::jsonb)
    )
  );
  selected_roles text[] := array(
    select lower(jsonb_array_elements_text(
      coalesce(config#>'{selection,selectedRoles}','[]'::jsonb)
    ))
  );
begin
  if p_slide.slide_type <> 'sport_birthdays'
    or p_slide.configuration_json->>'blueprintKey' is distinct from 'sportlink.birthdays' then
    return private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide);
  end if;
  select * into connection from public.sportlink_connections
  where tenant_id=p_slide.tenant_id and data_source_id=p_slide.data_source_id
    and status='active';
  if connection.id is null or not connection.privacy_birthdays_enabled then
    return jsonb_build_object(
      'type','sport_birthdays','sport',jsonb_build_object(
        'title',coalesce(nullif(config->>'title',''),'Verjaardagen'),
        'items','[]'::jsonb,'birthdays','[]'::jsonb,
        'emptyStateCode','SPORTLINK_NOT_CONNECTED',
        'configuration',config,'timezone','Europe/Amsterdam'
      )
    );
  end if;
  select max(source_fetched_at) into fetched_at
  from public.sportlink_birthdays birthday
  where birthday.tenant_id=p_slide.tenant_id
    and birthday.connection_id=connection.id and birthday.active;

  with candidates as (
    select birthday.*,member.external_member_code,
      enrichment.birth_year,
      case when enrichment.birth_year is not null then
        extract(year from birthday.next_occurrence)::integer-enrichment.birth_year
      end calculated_age,
      coalesce(member.role,birthday.role,enrichment.role) resolved_role,
      case when jsonb_array_length(birthday.team_assignments)>0
        then birthday.team_assignments
        when nullif(enrichment.team,'') is not null then
          jsonb_build_array(jsonb_build_object(
            'externalId','import:'||left(encode(extensions.digest(
              enrichment.team,'sha256'
            ),'hex'),20),'name',enrichment.team
          ))
        else '[]'::jsonb end resolved_teams
    from public.sportlink_birthdays birthday
    left join public.sportlink_team_members member
      on member.tenant_id=birthday.tenant_id
      and member.id=birthday.matched_team_member_id and member.active
    left join lateral (
      select candidate.* from public.sportlink_birthday_enrichments candidate
      where candidate.tenant_id=birthday.tenant_id
        and candidate.connection_id=birthday.connection_id
        and (
          member.external_member_code is not null
            and candidate.external_member_code=member.external_member_code
          or member.external_member_code is null
            and candidate.external_member_code is null
            and candidate.normalized_name=birthday.normalized_name
            and (select count(*) from public.sportlink_birthdays duplicate
              where duplicate.connection_id=birthday.connection_id
                and duplicate.active
                and duplicate.normalized_name=birthday.normalized_name)=1
        )
      order by case when candidate.external_member_code is not null then 0 else 1 end,
        candidate.provenance_at desc
      limit 1
    ) enrichment on true
    where birthday.tenant_id=p_slide.tenant_id
      and birthday.connection_id=connection.id and birthday.active
      and birthday.source_fetched_at >= now()-interval '21 days'
  ), filtered as (
    select * from candidates candidate where
      (cardinality(selected_team_ids)=0 or exists (
        select 1 from jsonb_array_elements(candidate.resolved_teams) team
        where team->>'externalId'=any(selected_team_ids)
      ))
      and (
        coalesce(config#>>'{selection,roleFilter}','all')='all'
        or coalesce(config#>>'{selection,roleFilter}','all')='players'
          and lower(coalesce(candidate.resolved_role,'')) in ('speler','player')
        or coalesce(config#>>'{selection,roleFilter}','all')='staff'
          and lower(coalesce(candidate.resolved_role,'')) in (
            'trainer','coach','leider','staf','staff','verzorger','teammanager'
          )
        or coalesce(config#>>'{selection,roleFilter}','all')='selected'
          and lower(coalesce(candidate.resolved_role,''))=any(selected_roles)
        or candidate.resolved_role is null
          and coalesce((config#>>'{selection,includeUnknownRoles}')::boolean,true)
      )
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',external_id,'externalId',external_id,
    'displayName',display_name,'normalizedName',normalized_name,
    'primary',display_name,'month',birth_month,'day',birth_day,
    'displayDate',next_occurrence,
    'date',to_char(next_occurrence,'DD-MM-YYYY'),
    'age',case when coalesce((config#>>'{selection,showAge}')::boolean,true)
      and calculated_age between 1 and 120 then calculated_age end,
    'secondary',case when coalesce((config#>>'{selection,showAge}')::boolean,true)
      and calculated_age between 1 and 120
      then display_name||' wordt '
        ||calculated_age::text||' jaar'
      else display_name||' is jarig' end,
    'role',case when coalesce((config#>>'{selection,showRole}')::boolean,true)
      then resolved_role end,
    'teams',case when coalesce((config#>>'{selection,showTeam}')::boolean,true)
      then resolved_teams else '[]'::jsonb end,
    'teamIds',case when coalesce((config#>>'{selection,showTeam}')::boolean,true)
      then coalesce((select jsonb_agg(team->>'externalId')
        from jsonb_array_elements(resolved_teams) team),'[]'::jsonb)
      else '[]'::jsonb end,
    'meta',concat_ws(' · ',
      case when coalesce((config#>>'{selection,showRole}')::boolean,true)
        then nullif(resolved_role,'') end,
      case when coalesce((config#>>'{selection,showTeam}')::boolean,true)
        then nullif((select string_agg(team->>'name',', ')
          from jsonb_array_elements(resolved_teams) team),'') end
    ),
    'photoMediaAssetId',case when coalesce(
      (config#>>'{selection,showPhoto}')::boolean,true
    ) then photo_provider_asset_version_id end,
    'matchStatus',match_status
  )) order by next_occurrence,display_name),'[]'::jsonb)
  into birthday_items from filtered;

  base := private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide);
  return jsonb_build_object(
    'type','sport_birthdays',
    'sport',jsonb_build_object(
      'title',coalesce(nullif(config->>'title',''),p_slide.name,'Verjaardagen'),
      'items',birthday_items,'birthdays',birthday_items,
      'configuration',config,
      'timezone',coalesce(connection.timezone,'Europe/Amsterdam'),
      'fetchedAt',fetched_at,
      'snapshotExpiresAt',fetched_at+interval '21 days',
      'pageDurationSeconds',coalesce(
        (config#>>'{presentation,pageDurationSeconds}')::integer,8
      ),
      'emptyStateCode',case when jsonb_array_length(birthday_items)=0
        then 'NO_BIRTHDAYS_IN_PERIOD' end
    ),
    'brand',coalesce(base->'brand','{}'::jsonb),
    'editorial',coalesce(base->'editorial','{}'::jsonb)
  );
end;
$$;
revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides)
  from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_s128_birthdays(
  public.dynamic_slides
) from public, anon, authenticated;

-- Birthday pagination has one immutable timing rule across Studio, release
-- preflight and Player. Use the stricter of landscape and portrait page sizes
-- so every internal page is guaranteed one complete turn on either target.
create or replace function private.sportlink_birthday_minimum_duration_v1(
  p_snapshot_data jsonb
)
returns integer
language plpgsql immutable
set search_path = ''
as $$
declare
  birthday_count integer := jsonb_array_length(coalesce(
    p_snapshot_data #> '{sport,birthdays}',
    p_snapshot_data #> '{sport,items}',
    '[]'::jsonb
  ));
  config jsonb := coalesce(
    p_snapshot_data #> '{sport,configuration,presentation}',
    '{}'::jsonb
  );
  landscape_size integer;
  portrait_size integer;
  page_duration integer;
  page_size integer;
  page_count integer;
begin
  landscape_size := case
    when coalesce(config->>'maxPerLandscapePage','') ~ '^[1-8]$'
      then (config->>'maxPerLandscapePage')::integer
    else 4
  end;
  portrait_size := case
    when coalesce(config->>'maxPerPortraitPage','') ~ '^[1-8]$'
      then (config->>'maxPerPortraitPage')::integer
    else 3
  end;
  page_duration := case
    when coalesce(config->>'pageDurationSeconds','') ~ '^([6-9]|1[0-9]|20)$'
      then (config->>'pageDurationSeconds')::integer
    else 8
  end;
  page_size := least(landscape_size, portrait_size);
  page_count := greatest(ceil(birthday_count::numeric / page_size)::integer, 1);
  return least(page_count * page_duration, 3600);
end;
$$;
revoke all on function private.sportlink_birthday_minimum_duration_v1(jsonb)
  from public, anon, authenticated;

create or replace function private.enforce_sportlink_birthday_duration_v1()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  slide_type text;
  snapshot_data jsonb;
begin
  if new.dynamic_slide_id is null or new.dynamic_snapshot_id is null then
    return new;
  end if;
  select slide.slide_type,snapshot.snapshot_data_json
  into slide_type,snapshot_data
  from public.dynamic_slides slide
  join public.dynamic_slide_snapshots snapshot
    on snapshot.tenant_id=slide.tenant_id
    and snapshot.dynamic_slide_id=slide.id
    and snapshot.id=new.dynamic_snapshot_id
  where slide.tenant_id=new.tenant_id and slide.id=new.dynamic_slide_id;
  if slide_type='sport_birthdays' then
    new.duration_seconds := greatest(
      new.duration_seconds,
      private.sportlink_birthday_minimum_duration_v1(snapshot_data)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_sportlink_birthday_duration_v1()
  from public, anon, authenticated;
drop trigger if exists playlist_items_enforce_birthday_duration
  on public.playlist_items;
create trigger playlist_items_enforce_birthday_duration
before insert or update of duration_seconds,dynamic_slide_id,dynamic_snapshot_id
on public.playlist_items for each row
execute function private.enforce_sportlink_birthday_duration_v1();

create or replace function private.follow_latest_dynamic_snapshot_in_drafts()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected_count integer := 0;
  resolved_duration integer;
  page_count integer;
  seconds_per_slide integer;
begin
  if old.status is distinct from 'ready'
    and new.status = 'ready'
    and new.output_media_asset_id is not null
  then
    resolved_duration := null;
    if new.snapshot_data_json ->> 'type' = 'news' then
      page_count := greatest(jsonb_array_length(coalesce(
        new.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )), 1);
      seconds_per_slide := least(greatest(
        case
          when coalesce(
            new.snapshot_data_json #>> '{news,secondsPerSlide}',
            ''
          ) ~ '^[0-9]{1,3}$'
            then (
              new.snapshot_data_json #>> '{news,secondsPerSlide}'
            )::integer
          else 5
        end,
        5
      ), 120);
      resolved_duration := least(page_count * seconds_per_slide, 3600);
    elsif new.snapshot_data_json ->> 'type' = 'sport_birthdays' then
      resolved_duration := private.sportlink_birthday_minimum_duration_v1(
        new.snapshot_data_json
      );
    end if;

    with changed_items as (
      update public.playlist_items item
      set
        dynamic_snapshot_id = new.id,
        media_asset_id = new.output_media_asset_id,
        duration_seconds = coalesce(resolved_duration, item.duration_seconds),
        updated_at = now()
      where item.tenant_id = new.tenant_id
        and item.dynamic_slide_id = new.dynamic_slide_id
        and item.dynamic_selection_mode = 'latest'
      returning item.playlist_id
    ),
    changed_playlists as (
      select distinct playlist_id from changed_items
    )
    update public.playlists playlist
    set revision = playlist.revision + 1,updated_at = now()
    where playlist.tenant_id = new.tenant_id
      and playlist.id in (
        select changed.playlist_id from changed_playlists changed
      );
    get diagnostics affected_count = row_count;

    if affected_count > 0 then
      insert into public.audit_events(
        tenant_id, action, target_type, target_id, result, metadata
      ) values (
        new.tenant_id,'dynamic.draft_snapshot.followed',
        'dynamic_slide_snapshots',new.id,'success',
        jsonb_build_object(
          'systemExecuted',true,'playlistCount',affected_count,
          'dynamicSlideId',new.dynamic_slide_id,
          'durationSeconds',resolved_duration
        )
      );
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.follow_latest_dynamic_snapshot_in_drafts()
  from public, anon, authenticated;

-- Normalize any draft item created earlier in a rolling deployment. Future
-- inserts, edits and snapshot refreshes are protected by the trigger above.
update public.playlist_items item
set duration_seconds=greatest(
  item.duration_seconds,
  private.sportlink_birthday_minimum_duration_v1(snapshot.snapshot_data_json)
)
from public.dynamic_slides slide,public.dynamic_slide_snapshots snapshot
where item.tenant_id=slide.tenant_id
  and item.dynamic_slide_id=slide.id
  and slide.slide_type='sport_birthdays'
  and snapshot.tenant_id=item.tenant_id
  and snapshot.id=item.dynamic_snapshot_id
  and item.duration_seconds<private.sportlink_birthday_minimum_duration_v1(
    snapshot.snapshot_data_json
  );

comment on table public.sportlink_birthdays is
  'Tenant-bound normalized 21-day Sportlink birthday Last Known Good; no birth year.';
comment on table public.sportlink_birthday_enrichments is
  'Minimal tenant-private age provenance. Player snapshots receive only calculated age.';
comment on table public.sportlink_birthday_imports is
  'Import result metadata only. Raw CSV/XLSX bytes are never stored.';

-- React is the canonical renderer; retain one published fallback template per
-- orientation for immutable snapshot and PNG-render compatibility.
update public.dynamic_template_versions version
set status='published',published_at=coalesce(version.published_at,now())
from public.dynamic_templates template
where template.id=version.template_id
  and template.slide_type='sport_birthdays'
  and template.slug like '%-dark-%'
  and version.id=template.current_published_version_id;

update public.dynamic_templates
set status=case when slug like '%-dark-%' then 'published' else 'archived' end
where slide_type='sport_birthdays';
