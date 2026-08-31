-- S139: canonical, audited and idempotent tenant feature rollouts.
--
-- Feature definitions are private operational policy. V2 is the canonical
-- tenant decision command and legacy v1 delegates to it. Protected S124 and
-- direct legacy writers remain compatible: the revision trigger advances rows
-- whenever those writers omit an explicit revision increment.

create table private.tenant_feature_flag_definitions (
  flag_key text primary key
    check (
      length(btrim(flag_key)) between 3 and 80
      and flag_key = btrim(flag_key)
      and flag_key ~ '^[a-z0-9][a-z0-9_]*$'
    ),
  kill_switch_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.tenant_feature_flag_definitions(flag_key)
values
  ('vector_v2_design_system'),
  ('vector_v2_marketing'),
  ('vector_v2_control_shell'),
  ('vector_v2_mobile_shell'),
  ('vector_v2_player_shell'),
  ('unified_resource_picker'),
  ('unified_filter_dock'),
  ('venue_twin'),
  ('screen_health_view'),
  ('engage'),
  ('youtube_integration'),
  ('sportlink_birthdays'),
  ('ledscores_realtime'),
  ('billing_engine_enabled'),
  ('billing_collect_recurring'),
  ('billing_proration_enabled'),
  ('billing_dunning_worker'),
  ('billing_enforce_entitlements'),
  ('billing_player_warning_chip'),
  ('billing_player_restriction_splash'),
  ('billing_mollie_nextgen_webhooks'),
  ('billing_mollie_sales_invoices'),
  ('billing_reconciliation_worker'),
  ('billing_support_overrides'),
  ('billing_mollie_fixed_subscription_adapter');

create trigger tenant_feature_flag_definitions_set_updated_at
before update on private.tenant_feature_flag_definitions
for each row execute function private.set_updated_at();

alter table private.tenant_feature_flag_definitions enable row level security;
alter table private.tenant_feature_flag_definitions force row level security;
revoke all on private.tenant_feature_flag_definitions
  from public, anon, authenticated, service_role;

alter table public.tenant_feature_flags
  add column revision bigint not null default 1
    check (revision > 0);

create or replace function private.bump_tenant_feature_flag_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.tenant_id,
    new.flag_key,
    new.enabled,
    new.rollout_reason,
    new.changed_by
  ) is distinct from row(
    old.tenant_id,
    old.flag_key,
    old.enabled,
    old.rollout_reason,
    old.changed_by
  ) and new.revision = old.revision then
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

revoke all on function private.bump_tenant_feature_flag_revision()
  from public, anon, authenticated, service_role;

create trigger tenant_feature_flags_bump_revision
before update on public.tenant_feature_flags
for each row execute function private.bump_tenant_feature_flag_revision();

create table private.tenant_feature_flag_command_receipts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  flag_key text not null
    references private.tenant_feature_flag_definitions(flag_key) on delete restrict,
  requested_enabled boolean not null,
  normalized_reason text not null
    check (length(normalized_reason) between 8 and 500),
  expected_revision bigint not null check (expected_revision >= 0),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  audit_event_id uuid references public.audit_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id)
);

create index tenant_feature_flag_command_receipts_tenant_created_idx
  on private.tenant_feature_flag_command_receipts(tenant_id, created_at desc);

alter table private.tenant_feature_flag_command_receipts enable row level security;
alter table private.tenant_feature_flag_command_receipts force row level security;
revoke all on private.tenant_feature_flag_command_receipts
  from public, anon, authenticated, service_role;

create or replace function public.set_tenant_feature_flag_v2(
  p_tenant_id uuid,
  p_flag_key text,
  p_enabled boolean,
  p_reason text,
  p_expected_revision bigint,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_flag_key text := btrim(coalesce(p_flag_key, ''));
  normalized_reason text := btrim(coalesce(p_reason, ''));
  tenant_status public.tenant_status;
  definition_kill_switch_active boolean;
  existing_receipt private.tenant_feature_flag_command_receipts%rowtype;
  current_enabled boolean := false;
  current_revision bigint := 0;
  next_revision bigint;
  outcome text := 'applied';
  audit_id uuid;
  result_json jsonb;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'platform feature rollout permission required'
      using errcode = '42501';
  end if;

  perform private.require_aal2_command();

  if p_tenant_id is null
    or p_enabled is null
    or p_request_id is null
    or p_expected_revision is null
    or p_expected_revision < 0
    or length(normalized_flag_key) not between 3 and 80
    or normalized_flag_key !~ '^[a-z0-9][a-z0-9_]*$'
    or length(normalized_reason) not between 8 and 500
  then
    raise exception 'feature rollout input is invalid' using errcode = '23514';
  end if;

  -- A tenant-scoped request lock makes concurrent retries deterministic before
  -- either request can observe or write a receipt.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || p_request_id::text,
      139
    )
  );

  select receipt.*
  into existing_receipt
  from private.tenant_feature_flag_command_receipts receipt
  where receipt.tenant_id = p_tenant_id
    and receipt.request_id = p_request_id
  for update;

  if found then
    if existing_receipt.actor_user_id is distinct from actor_id
      or existing_receipt.flag_key is distinct from normalized_flag_key
      or existing_receipt.requested_enabled is distinct from p_enabled
      or existing_receipt.normalized_reason is distinct from normalized_reason
      or existing_receipt.expected_revision is distinct from p_expected_revision
    then
      raise exception 'request id belongs to another feature rollout command'
        using errcode = '23514';
    end if;

    return existing_receipt.result;
  end if;

  -- Lock the tenant before any definition or flag mutation. This both validates
  -- the lifecycle and serializes all feature decisions for this tenant.
  select tenant.status
  into tenant_status
  from public.tenants tenant
  where tenant.id = p_tenant_id
  for update;

  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;
  if tenant_status <> 'active'::public.tenant_status then
    raise exception 'tenant is not active' using errcode = 'PT409';
  end if;

  select definition.kill_switch_active
  into definition_kill_switch_active
  from private.tenant_feature_flag_definitions definition
  where definition.flag_key = normalized_flag_key
  for share;

  if not found then
    raise exception 'feature definition is unavailable' using errcode = '42704';
  end if;
  if p_enabled and definition_kill_switch_active then
    raise exception 'feature is blocked by the global kill switch'
      using errcode = '55000';
  end if;

  select flag.enabled, flag.revision
  into current_enabled, current_revision
  from public.tenant_feature_flags flag
  where flag.tenant_id = p_tenant_id
    and flag.flag_key = normalized_flag_key
  for update;

  if not found then
    current_enabled := false;
    current_revision := 0;
  end if;

  if current_revision <> p_expected_revision then
    raise exception 'feature rollout revision conflict' using errcode = 'PT409';
  end if;

  next_revision := current_revision;
  if current_enabled is not distinct from p_enabled then
    outcome := 'unchanged';
  else
    next_revision := current_revision + 1;

    insert into public.tenant_feature_flags(
      tenant_id,
      flag_key,
      enabled,
      rollout_reason,
      changed_by,
      revision
    ) values (
      p_tenant_id,
      normalized_flag_key,
      p_enabled,
      normalized_reason,
      actor_id,
      next_revision
    )
    on conflict (tenant_id, flag_key) do update set
      enabled = excluded.enabled,
      rollout_reason = excluded.rollout_reason,
      changed_by = excluded.changed_by,
      revision = excluded.revision;

    begin
      audit_id := private.audit_event(
        p_tenant_id,
        'tenant.feature_flag.changed',
        'tenant_feature_flags',
        p_tenant_id,
        'success',
        jsonb_build_object(
          'flagKey', normalized_flag_key,
          'environment', coalesce(
            current_setting('app.environment', true),
            'unknown'
          ),
          'subject', p_tenant_id,
          'tenantId', p_tenant_id,
          'oldValue', current_enabled,
          'newValue', p_enabled,
          'oldRevision', current_revision,
          'newRevision', next_revision,
          'requestId', p_request_id,
          'actor', actor_id,
          'reason', normalized_reason,
          'changedAt', now()
        )
      );
    exception
      when others then
        raise exception 'feature rollout audit could not be stored'
          using errcode = 'PT500';
    end;
  end if;

  result_json := jsonb_build_object(
    'tenantId', p_tenant_id,
    'flagKey', normalized_flag_key,
    'enabled', p_enabled,
    'revision', next_revision,
    'requestId', p_request_id,
    'outcome', outcome,
    'auditEventId', audit_id
  );

  insert into private.tenant_feature_flag_command_receipts(
    tenant_id,
    request_id,
    actor_user_id,
    flag_key,
    requested_enabled,
    normalized_reason,
    expected_revision,
    result,
    audit_event_id
  ) values (
    p_tenant_id,
    p_request_id,
    actor_id,
    normalized_flag_key,
    p_enabled,
    normalized_reason,
    p_expected_revision,
    result_json,
    audit_id
  );

  return result_json;
end;
$$;

revoke all on function public.set_tenant_feature_flag_v2(
  uuid, text, boolean, text, bigint, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.set_tenant_feature_flag_v2(
  uuid, text, boolean, text, bigint, uuid
) to authenticated;

-- Keep the legacy RPC signature for older Control clients, but route every
-- decision through v2. The generated request lock is acquired before the
-- tenant lock, matching v2's lock order; the tenant lock then protects the
-- revision read until the nested command completes.
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
  request_id uuid;
  current_revision bigint := 0;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'platform feature rollout permission required'
      using errcode = '42501';
  end if;

  perform private.require_aal2_command();
  request_id := pg_catalog.gen_random_uuid();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || request_id::text,
      139
    )
  );

  perform 1
  from public.tenants tenant
  where tenant.id = p_tenant_id
  for update;

  select flag.revision
  into current_revision
  from public.tenant_feature_flags flag
  where flag.tenant_id = p_tenant_id
    and flag.flag_key = btrim(coalesce(p_flag_key, ''))
  for update;

  current_revision := coalesce(current_revision, 0);

  perform public.set_tenant_feature_flag_v2(
    p_tenant_id,
    p_flag_key,
    p_enabled,
    p_reason,
    current_revision,
    request_id
  );
end;
$$;

revoke all on function public.set_tenant_feature_flag_v1(
  uuid, text, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.set_tenant_feature_flag_v1(
  uuid, text, boolean, text
) to authenticated;

create or replace function public.get_ledscores_feature_effective_state_v1(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  tenant_status public.tenant_status;
  definition_available boolean := false;
  kill_switch_active boolean := false;
  configured_enabled boolean := false;
  current_revision bigint := 0;
begin
  if actor_id is null or not (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin', 'platform_support', 'platform_viewer'
    ]::public.platform_role[])
  ) then
    raise exception 'feature rollout read permission required'
      using errcode = '42501';
  end if;

  if p_tenant_id is null then
    raise exception 'feature rollout read input is invalid'
      using errcode = '23514';
  end if;

  select
    tenant.status,
    definition.flag_key is not null,
    coalesce(definition.kill_switch_active, false),
    coalesce(flag.enabled, false),
    coalesce(flag.revision, 0)
  into
    tenant_status,
    definition_available,
    kill_switch_active,
    configured_enabled,
    current_revision
  from public.tenants tenant
  left join public.tenant_feature_flags flag
    on flag.tenant_id = tenant.id
    and flag.flag_key = 'ledscores_realtime'
  left join private.tenant_feature_flag_definitions definition
    on definition.flag_key = 'ledscores_realtime'
  where tenant.id = p_tenant_id;

  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'flagKey', 'ledscores_realtime',
    'definitionAvailable', definition_available,
    'killSwitchActive', kill_switch_active,
    'configuredEnabled', configured_enabled,
    'enabled',
      definition_available
      and not kill_switch_active
      and configured_enabled
      and tenant_status = 'active'::public.tenant_status,
    'revision', current_revision
  );
end;
$$;

revoke all on function public.get_ledscores_feature_effective_state_v1(
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.get_ledscores_feature_effective_state_v1(
  uuid
) to authenticated;

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
    join public.tenants tenant
      on tenant.id = flag.tenant_id
    join private.tenant_feature_flag_definitions definition
      on definition.flag_key = flag.flag_key
    where flag.tenant_id = p_tenant_id
      and flag.flag_key = 'ledscores_realtime'
      and flag.enabled
      and tenant.status = 'active'::public.tenant_status
      and not definition.kill_switch_active
  );
$$;

revoke all on function private.ledscores_feature_enabled(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.ledscores_feature_enabled(uuid)
  to service_role;

-- RLS must still let an authenticated tenant actor inspect LED Scores records,
-- but the unrestricted effective-state resolver itself is worker-only. This
-- wrapper first establishes tenant/platform scope and is the only helper used
-- by authenticated LED Scores read policies.
create or replace function private.ledscores_feature_enabled_for_actor(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    private.is_tenant_member(p_tenant_id)
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) and private.ledscores_feature_enabled(p_tenant_id);
$$;

revoke all on function private.ledscores_feature_enabled_for_actor(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.ledscores_feature_enabled_for_actor(uuid)
  to authenticated;

alter policy ledscores_connections_read
on public.ledscores_connections
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
alter policy ledscores_team_mappings_read
on public.ledscores_team_mappings
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
alter policy ledscores_goal_alerts_read
on public.ledscores_goal_alerts
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_alert_draft_groups_read
on public.ledscores_goal_alert_draft_groups
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_alert_draft_assets_read
on public.ledscores_goal_alert_draft_assets
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_alert_versions_read
on public.ledscores_goal_alert_versions
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_alert_version_groups_read
on public.ledscores_goal_alert_version_groups
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_alert_version_assets_read
on public.ledscores_goal_alert_version_assets
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
alter policy ledscores_goal_events_read
on public.ledscores_goal_events
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);
alter policy ledscores_player_deliveries_read
on public.ledscores_player_deliveries
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);
alter policy ledscores_connector_events_read
on public.ledscores_connector_events
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);

comment on table private.tenant_feature_flag_definitions is
  'Canonical feature keys and fail-closed global kill switches; private and default-deny.';
comment on table private.tenant_feature_flag_command_receipts is
  'Immutable tenant-scoped receipts for exact feature rollout command replay.';
comment on column public.tenant_feature_flags.revision is
  'Monotonic optimistic-lock revision for audited tenant feature decisions.';
comment on function private.bump_tenant_feature_flag_revision() is
  'Advances legacy/direct tenant feature updates while preserving explicit v2 revision increments.';
comment on function public.set_tenant_feature_flag_v2(
  uuid, text, boolean, text, bigint, uuid
) is
  'AAL2 platform-only, revision-safe and exactly idempotent tenant feature rollout command.';
comment on function public.set_tenant_feature_flag_v1(
  uuid, text, boolean, text
) is
  'Backward-compatible feature rollout wrapper; all policy, audit and revision enforcement is delegated to v2.';
comment on function public.get_ledscores_feature_effective_state_v1(
  uuid
) is
  'Platform-only read model for configured and runtime-effective LED Scores tenant state.';
