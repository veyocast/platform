-- S123 Vector v2 billing foundation. Collection and enforcement remain default-off
-- tenant cohorts; financial history is append-only and provider mode is immutable.

alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write','tenant.product.write','tenant.playlist.write',
      'tenant.playlist.publish','tenant.screen.manage','tenant.settings.manage',
      'tenant.audit.read','tenant.support.export','tenant.ticket.write',
      'tenant.studio.read','tenant.studio.create','tenant.studio.edit_own',
      'tenant.studio.edit_all','tenant.studio.archive','tenant.studio.template.manage',
      'tenant.studio.motion.edit','tenant.studio.render','tenant.studio.job.manage',
      'tenant.dynamic_slide.read','tenant.dynamic_slide.write','tenant.data_source.read',
      'tenant.data_source.manage','tenant.sponsor.read','tenant.sponsor.write',
      'tenant.sponsor.approve','tenant.sponsor.publish','tenant.sponsor.report',
      'tenant.billing.read','tenant.billing.manage'
    ]::text[]
    and ('tenant.media.write'=any(capabilities))=('tenant.playlist.write'=any(capabilities))
  );

alter function private.builtin_tenant_capabilities(public.tenant_role)
  rename to builtin_tenant_capabilities_before_s123_billing;
create function private.builtin_tenant_capabilities(p_role public.tenant_role)
returns text[] language sql stable security definer set search_path=''
as $$
  select private.builtin_tenant_capabilities_before_s123_billing(p_role) ||
    case when p_role in ('tenant_owner','tenant_admin')
      then array['tenant.billing.read','tenant.billing.manage']::text[]
      else array['tenant.billing.read']::text[] end;
$$;
revoke all on function private.builtin_tenant_capabilities(public.tenant_role) from public,anon,authenticated;

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[a-z][a-z0-9_]{2,63}$'),
  name text not null check(length(btrim(name)) between 2 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.billing_price_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  version integer not null check(version>0),
  currency text not null default 'EUR' check(currency='EUR'),
  gross_unit_cents integer not null check(gross_unit_cents>0),
  vat_basis_points integer not null check(vat_basis_points between 0 and 10000),
  interval_unit text not null default 'month' check(interval_unit='month'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique(plan_id,version), check(effective_to is null or effective_to>effective_from)
);

insert into public.billing_plans(id,code,name) values('b1000000-0000-4000-8000-000000000001','screen_monthly','VeyoCast per actief scherm');
insert into public.billing_price_versions(id,plan_id,version,gross_unit_cents,vat_basis_points,effective_from)
values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',1,595,2100,'2026-08-24T00:00:00Z');

create function private.tenant_feature_enabled_system_v1(p_tenant_id uuid,p_flag_key text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select flag.enabled from public.tenant_feature_flags flag where flag.tenant_id=p_tenant_id and flag.flag_key=p_flag_key),false);
$$;
revoke all on function private.tenant_feature_enabled_system_v1(uuid,text) from public,anon,authenticated;

create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  legal_name text not null check(length(btrim(legal_name)) between 2 and 180),
  invoice_email text not null check(position('@' in invoice_email)>1),
  address_line text, postal_code text, city text,
  country_code text not null default 'NL' check(country_code ~ '^[A-Z]{2}$'),
  organization_number text, vat_number text,
  provider_mode text not null default 'test' check(provider_mode in ('test','live')),
  mollie_customer_id text,
  credit_balance_cents bigint not null default 0 check(credit_balance_cents>=0),
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  terms_accepted_by uuid not null references public.profiles(id) on delete restrict,
  row_version bigint not null default 1 check(row_version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  check(mollie_customer_id is null or mollie_customer_id ~ '^cst_[A-Za-z0-9]+$'),
  unique(provider_mode,mollie_customer_id)
);
create index billing_accounts_tenant_idx on public.billing_accounts(tenant_id);

create table public.billing_mandates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  billing_account_id uuid not null, provider_mode text not null check(provider_mode in ('test','live')),
  mollie_mandate_id text not null check(mollie_mandate_id ~ '^mdt_[A-Za-z0-9]+$'),
  method text not null, status text not null check(status in ('pending','valid','invalid','revoked')),
  is_primary boolean not null default false, last_synced_at timestamptz not null default now(),
  revoked_at timestamptz, created_at timestamptz not null default now(),
  unique(tenant_id,id), unique(provider_mode,mollie_mandate_id),
  foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict
);
create unique index billing_mandates_one_primary_uq on public.billing_mandates(billing_account_id) where is_primary and status='valid';
create index billing_mandates_tenant_account_idx on public.billing_mandates(tenant_id,billing_account_id);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  billing_account_id uuid not null, plan_id uuid not null references public.billing_plans(id) on delete restrict,
  price_version_id uuid not null references public.billing_price_versions(id) on delete restrict,
  status text not null default 'draft' check(status in ('draft','trialing','active','grace','restricted','suspended','ended')),
  status_reason text, trial_started_at timestamptz, trial_ends_at timestamptz,
  current_period_start timestamptz, current_period_end timestamptz,
  billing_anchor_day smallint check(billing_anchor_day between 1 and 31),
  grace_started_at timestamptz, grace_ends_at timestamptz, paid_through timestamptz,
  cancel_at_period_end boolean not null default false, ended_at timestamptz,
  row_version bigint not null default 1 check(row_version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,id), foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  check((trial_started_at is null)=(trial_ends_at is null)),
  check(trial_ends_at is null or trial_ends_at=trial_started_at+interval '336 hours'),
  check((grace_started_at is null)=(grace_ends_at is null)),
  check(grace_ends_at is null or grace_ends_at=grace_started_at+interval '168 hours'),
  check(current_period_end is null or current_period_end>current_period_start)
);
create unique index billing_subscriptions_one_open_uq on public.billing_subscriptions(billing_account_id) where status<>'ended';
create index billing_subscriptions_tenant_status_idx on public.billing_subscriptions(tenant_id,status);

create table public.screen_billing_intervals (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, screen_id uuid not null,
  subscription_id uuid not null, started_at timestamptz not null, ended_at timestamptz,
  start_reason text not null, end_reason text, replacement_group_id uuid, source_command_id uuid not null,
  created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,source_command_id),
  foreign key(tenant_id,screen_id) references public.screens(tenant_id,id) on delete restrict,
  foreign key(tenant_id,subscription_id) references public.billing_subscriptions(tenant_id,id) on delete restrict,
  check(ended_at is null or ended_at>started_at)
);
create unique index screen_billing_intervals_one_open_uq on public.screen_billing_intervals(tenant_id,screen_id) where ended_at is null;
create index screen_billing_intervals_tenant_period_idx on public.screen_billing_intervals(tenant_id,started_at,ended_at);

create table public.billing_usage_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, subscription_id uuid not null,
  period_start timestamptz not null, period_end timestamptz not null, captured_at timestamptz not null default now(),
  screen_count_at_anchor integer not null check(screen_count_at_anchor>=0), checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
  finalized_at timestamptz, created_at timestamptz not null default now(), unique(tenant_id,id),
  unique(subscription_id,period_start,period_end),
  foreign key(tenant_id,subscription_id) references public.billing_subscriptions(tenant_id,id) on delete restrict,
  check(period_end>period_start)
);
create index billing_usage_snapshots_tenant_period_idx on public.billing_usage_snapshots(tenant_id,period_start,period_end);

create table public.billing_usage_snapshot_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, snapshot_id uuid not null, screen_id uuid not null,
  active_seconds bigint not null check(active_seconds>=0), period_seconds bigint not null check(period_seconds>0 and active_seconds<=period_seconds),
  unit_gross_cents integer not null check(unit_gross_cents>0), gross_cents integer not null,
  line_type text not null check(line_type in ('recurring','proration','credit')),
  source_interval_ids uuid[] not null default '{}', created_at timestamptz not null default now(), unique(tenant_id,id),
  foreign key(tenant_id,snapshot_id) references public.billing_usage_snapshots(tenant_id,id) on delete restrict,
  foreign key(tenant_id,screen_id) references public.screens(tenant_id,id) on delete restrict
);
create index billing_usage_lines_tenant_snapshot_idx on public.billing_usage_snapshot_lines(tenant_id,snapshot_id);

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, billing_account_id uuid not null,
  subscription_id uuid not null, usage_snapshot_id uuid not null,
  invoice_number text not null unique, period_start timestamptz not null, period_end timestamptz not null,
  currency text not null default 'EUR' check(currency='EUR'), net_cents bigint not null, vat_cents bigint not null,
  gross_cents bigint not null, applied_credit_cents bigint not null default 0 check(applied_credit_cents>=0),
  status text not null default 'draft' check(status in ('draft','issued','payment_pending','paid','failed','payment_reversed','credited','void')),
  due_at timestamptz, issued_at timestamptz, paid_at timestamptz,
  snapshot_hash text not null check(snapshot_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
  unique(tenant_id,id), unique(subscription_id,period_start,period_end),
  foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  foreign key(tenant_id,subscription_id) references public.billing_subscriptions(tenant_id,id) on delete restrict,
  foreign key(tenant_id,usage_snapshot_id) references public.billing_usage_snapshots(tenant_id,id) on delete restrict,
  check(period_end>period_start), check(net_cents+vat_cents=gross_cents), check(applied_credit_cents<=greatest(gross_cents,0))
);
create index billing_invoices_tenant_status_idx on public.billing_invoices(tenant_id,status,period_start desc);

create table public.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, invoice_id uuid not null, screen_id uuid,
  line_type text not null check(line_type in ('screen','proration','credit','setup_credit','adjustment')),
  description text not null, quantity_numerator bigint not null, quantity_denominator bigint not null check(quantity_denominator>0),
  unit_gross_cents bigint not null, net_cents bigint not null, vat_cents bigint not null, gross_cents bigint not null,
  source_interval_ids uuid[] not null default '{}', created_at timestamptz not null default now(), unique(tenant_id,id),
  foreign key(tenant_id,invoice_id) references public.billing_invoices(tenant_id,id) on delete restrict,
  foreign key(tenant_id,screen_id) references public.screens(tenant_id,id) on delete restrict,
  check(net_cents+vat_cents=gross_cents)
);
create index billing_invoice_lines_tenant_invoice_idx on public.billing_invoice_lines(tenant_id,invoice_id);

create table public.billing_credit_ledger (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, billing_account_id uuid not null,
  invoice_id uuid, entry_type text not null check(entry_type in ('setup_credit','credit','debit','refund','reversal','adjustment')),
  amount_cents bigint not null check(amount_cents<>0), semantic_key text not null, reason text not null,
  created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,semantic_key),
  foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  foreign key(tenant_id,invoice_id) references public.billing_invoices(tenant_id,id) on delete restrict
);
create index billing_credit_ledger_tenant_account_idx on public.billing_credit_ledger(tenant_id,billing_account_id,created_at);

create table public.billing_payment_attempts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, billing_account_id uuid not null, invoice_id uuid,
  attempt_no integer not null check(attempt_no>0), semantic_key text not null, provider_mode text not null check(provider_mode in ('test','live')),
  mollie_payment_id text, expected_amount_cents bigint not null check(expected_amount_cents>=0), expected_currency text not null default 'EUR' check(expected_currency='EUR'),
  expected_customer_id text not null, expected_mandate_id text, provider_status text not null default 'created' check(provider_status in ('created','open','pending','authorized','paid','failed','canceled','expired','refunded','charged_back')),
  sequence_type text not null check(sequence_type in ('first','recurring')), checkout_url text,
  failure_reason text, finalized_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,id), unique(tenant_id,semantic_key), unique(invoice_id,attempt_no), unique(provider_mode,mollie_payment_id),
  foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  foreign key(tenant_id,invoice_id) references public.billing_invoices(tenant_id,id) on delete restrict,
  check((sequence_type='first' and invoice_id is null) or (sequence_type='recurring' and invoice_id is not null)),
  check(mollie_payment_id is null or mollie_payment_id ~ '^tr_[A-Za-z0-9]+$')
);
create index billing_attempts_tenant_status_idx on public.billing_payment_attempts(tenant_id,provider_status,created_at);

create table public.billing_provider_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, payment_attempt_id uuid,
  channel text not null check(channel in ('classic','nextgen','reconcile','return')),
  provider_event_id text, provider_resource_id text not null, body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'),
  request_id text not null, result text not null default 'received', received_at timestamptz not null default now(), processed_at timestamptz,
  unique(tenant_id,id), foreign key(tenant_id,payment_attempt_id) references public.billing_payment_attempts(tenant_id,id) on delete restrict
);
create unique index billing_provider_nextgen_event_uq on public.billing_provider_events(provider_event_id) where channel='nextgen';
create index billing_provider_events_tenant_resource_idx on public.billing_provider_events(tenant_id,provider_resource_id,received_at);

create table public.billing_outbox (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, aggregate_type text not null, aggregate_id uuid not null,
  operation text not null, semantic_key text not null, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  payload_json jsonb not null check(jsonb_typeof(payload_json)='object'), state text not null default 'pending' check(state in ('pending','processing','completed','failed','uncertain')),
  attempts integer not null default 0 check(attempts>=0), next_attempt_at timestamptz not null default now(), provider_result_id text,
  last_error_code text, created_at timestamptz not null default now(), completed_at timestamptz,
  unique(tenant_id,id), unique(tenant_id,semantic_key)
);
create index billing_outbox_due_idx on public.billing_outbox(state,next_attempt_at) where state in ('pending','failed','uncertain');
create index billing_outbox_tenant_idx on public.billing_outbox(tenant_id,created_at);

create table public.billing_notifications (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, billing_account_id uuid not null,
  subscription_id uuid not null, stage text not null check(stage in ('d0','d1','d3','d6','paid','recovered')),
  channel text not null check(channel in ('in_app','email')),
  state text not null default 'pending' check(state in ('pending','processing','delivered','failed')),
  semantic_key text not null, scheduled_at timestamptz not null, delivered_at timestamptz,
  attempts integer not null default 0 check(attempts>=0), next_attempt_at timestamptz not null default now(),
  last_error_code text, created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,semantic_key),
  foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  foreign key(tenant_id,subscription_id) references public.billing_subscriptions(tenant_id,id) on delete restrict
);
create index billing_notifications_delivery_idx on public.billing_notifications(channel,state,next_attempt_at) where state in ('pending','failed');
create index billing_notifications_tenant_idx on public.billing_notifications(tenant_id,created_at desc);

create table public.billing_reconciliation_runs (
  id uuid primary key default gen_random_uuid(), provider_mode text not null check(provider_mode in ('test','live')),
  window_start timestamptz not null, window_end timestamptz not null, status text not null default 'running' check(status in ('running','healthy','diverged','failed')),
  checked_count integer not null default 0, mismatch_count integer not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz, check(window_end>window_start)
);
create table public.billing_reconciliation_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, run_id uuid not null references public.billing_reconciliation_runs(id) on delete restrict,
  payment_attempt_id uuid, mismatch_type text not null, expected_hash text, actual_hash text, resolution text,
  resolved_by uuid references public.profiles(id) on delete restrict, resolved_at timestamptz, created_at timestamptz not null default now(),
  unique(tenant_id,id), foreign key(tenant_id,payment_attempt_id) references public.billing_payment_attempts(tenant_id,id) on delete restrict
);
create index billing_reconciliation_items_tenant_idx on public.billing_reconciliation_items(tenant_id,created_at);

create table public.billing_overrides (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, billing_account_id uuid not null,
  override_type text not null check(override_type in ('trial_extension','temporary_entitlement','collection_pause')),
  reason text not null check(length(btrim(reason)) between 8 and 1000), starts_at timestamptz not null default now(), expires_at timestamptz not null,
  approved_by uuid not null references public.profiles(id) on delete restrict, request_id text not null, created_at timestamptz not null default now(),
  unique(tenant_id,id), foreign key(tenant_id,billing_account_id) references public.billing_accounts(tenant_id,id) on delete restrict,
  check(expires_at>starts_at and expires_at<=starts_at+interval '31 days')
);
create index billing_overrides_tenant_active_idx on public.billing_overrides(tenant_id,expires_at);

create table public.billing_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, actor_id uuid references public.profiles(id) on delete restrict,
  action text not null, target_type text not null, target_id uuid, before_hash text, after_hash text,
  reason text not null, request_id text not null, created_at timestamptz not null default now(), unique(tenant_id,id)
);
create index billing_audit_tenant_created_idx on public.billing_audit_log(tenant_id,created_at desc);

create table public.tenant_entitlement_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  revision bigint not null check(revision>0), billing_state text not null check(billing_state in ('draft','trialing','active','grace','restricted','suspended','ended')),
  reason text not null, playback_mode text not null check(playback_mode in ('tenant_content','tenant_content_with_warning','veyocast_billing_splash','system_suspended')),
  capabilities_json jsonb not null check(jsonb_typeof(capabilities_json)='object'), issued_at timestamptz not null default now(),
  valid_until timestamptz not null, hard_stop_at timestamptz, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'), signature text,
  created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,revision),
  check(valid_until>issued_at)
);
create index tenant_entitlement_snapshots_latest_idx on public.tenant_entitlement_snapshots(tenant_id,revision desc);

create table private.billing_unmatched_provider_events (
  id uuid primary key default gen_random_uuid(), provider_mode text not null check(provider_mode in ('test','live')),
  channel text not null, provider_resource_id text not null, body_hash text not null, request_id text not null,
  received_at timestamptz not null default now(), result text not null
);
revoke all on private.billing_unmatched_provider_events from public,anon,authenticated;

-- Catalog is readable; all tenant rows use capability-scoped RLS and mutation goes through guarded commands/service workers.
alter table public.billing_plans enable row level security;
alter table public.billing_price_versions enable row level security;
grant select on public.billing_plans,public.billing_price_versions to authenticated;
grant select,insert,update on public.billing_plans,public.billing_price_versions to service_role;
create policy billing_plans_read on public.billing_plans for select to authenticated using(true);
create policy billing_prices_read on public.billing_price_versions for select to authenticated using(true);

do $$ declare t text; begin
  foreach t in array array[
    'billing_accounts','billing_mandates','billing_subscriptions','screen_billing_intervals',
    'billing_usage_snapshots','billing_usage_snapshot_lines','billing_invoices','billing_invoice_lines',
    'billing_credit_ledger','billing_payment_attempts','billing_provider_events','billing_outbox',
    'billing_notifications','billing_reconciliation_items','billing_overrides','billing_audit_log','tenant_entitlement_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
    execute format('create policy %I on public.%I for select to authenticated using(private.has_tenant_capability(tenant_id,%L))',t||'_read',t,'tenant.billing.read');
  end loop;
end $$;
alter table public.billing_reconciliation_runs enable row level security;
alter table public.billing_reconciliation_runs force row level security;
revoke all on public.billing_reconciliation_runs from public,anon,authenticated;
grant select,insert,update on public.billing_reconciliation_runs to service_role;
grant select,insert,update on private.billing_unmatched_provider_events to service_role;

create or replace function private.billing_reject_mutation_v1() returns trigger
language plpgsql security definer set search_path='' as $$ begin raise exception using errcode='55000',message='billing history is append-only'; end $$;
revoke all on function private.billing_reject_mutation_v1() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['billing_price_versions','billing_usage_snapshot_lines','billing_invoice_lines','billing_credit_ledger','billing_provider_events','billing_audit_log','tenant_entitlement_snapshots'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function private.billing_reject_mutation_v1()',t||'_immutable',t);
  end loop;
end $$;

create function public.ensure_billing_account_v1(
  p_tenant_id uuid,p_legal_name text,p_invoice_email text,p_country_code text,p_terms_version text,p_expected_absent boolean default true
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id(); account_id uuid; plan_id uuid:='b1000000-0000-4000-8000-000000000001'; price_id uuid:='b2000000-0000-4000-8000-000000000001';
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.billing.manage') then raise exception using errcode='42501',message='billing manage permission required'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if private.current_aal()<>'aal2' then raise exception using errcode='42501',message='aal2 required'; end if;
  select id into account_id from public.billing_accounts where tenant_id=p_tenant_id;
  if account_id is not null then
    if p_expected_absent then return account_id; end if;
    raise exception using errcode='40001',message='billing account revision conflict';
  end if;
  insert into public.billing_accounts(tenant_id,legal_name,invoice_email,country_code,provider_mode,terms_version,terms_accepted_at,terms_accepted_by)
  values(p_tenant_id,btrim(p_legal_name),lower(btrim(p_invoice_email)),upper(p_country_code),'test',p_terms_version,clock_timestamp(),actor) returning id into account_id;
  insert into public.billing_subscriptions(tenant_id,billing_account_id,plan_id,price_version_id,status,status_reason)
  values(p_tenant_id,account_id,plan_id,price_id,'draft','awaiting_first_billable_activation');
  insert into public.billing_outbox(tenant_id,aggregate_type,aggregate_id,operation,semantic_key,payload_hash,payload_json)
  values(p_tenant_id,'billing_account',account_id,'create_mollie_customer','billing-account:'||account_id||':customer:v1',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(account_id::text||':customer:v1','UTF8'),'sha256'),'hex'),jsonb_build_object('billingAccountId',account_id,'providerMode','test'));
  insert into public.billing_audit_log(tenant_id,actor_id,action,target_type,target_id,reason,request_id)
  values(p_tenant_id,actor,'billing.account.created','billing_account',account_id,'Prijs en voorwaarden geaccepteerd','account-create:'||account_id);
  return account_id;
end $$;

create function private.rebuild_tenant_entitlement_v1(p_tenant_id uuid,p_reason text) returns bigint
language plpgsql security definer set search_path='' as $$
declare sub public.billing_subscriptions%rowtype; rev bigint; mode text; issued timestamptz:=clock_timestamp(); valid_until timestamptz:=issued+interval '168 hours'; override_until timestamptz; payload jsonb;
begin
  select * into sub from public.billing_subscriptions where tenant_id=p_tenant_id and status<>'ended' order by created_at desc limit 1;
  if sub.id is null then return null; end if;
  select coalesce(max(revision),0)+1 into rev from public.tenant_entitlement_snapshots where tenant_id=p_tenant_id;
  select max(expires_at) into override_until from public.billing_overrides where tenant_id=p_tenant_id and override_type in('trial_extension','temporary_entitlement') and starts_at<=issued and expires_at>issued;
  mode:=case when sub.status='grace' then 'tenant_content_with_warning' when sub.status in('restricted','ended') then 'veyocast_billing_splash' when sub.status='suspended' then 'system_suspended' else 'tenant_content' end;
  if override_until is not null and sub.status in('grace','restricted') then mode:='tenant_content'; valid_until:=least(valid_until,override_until); end if;
  payload:=jsonb_build_object('revision',rev,'billingState',sub.status,'reason',case when override_until is null then p_reason else 'time_bounded_support_override' end,'playbackMode',mode,'canPublish',sub.status not in('suspended','ended'),'canManageBilling',true,'canRecoverPlayer',true,'canPairReplacement',true,'canActivateNetNewScreen',sub.status in('draft','trialing','active'),'issuedAt',issued,'validUntil',valid_until,'hardStopAt',case when override_until is not null then override_until else sub.grace_ends_at end);
  insert into public.tenant_entitlement_snapshots(tenant_id,revision,billing_state,reason,playback_mode,capabilities_json,issued_at,valid_until,hard_stop_at,payload_hash)
  values(p_tenant_id,rev,sub.status,p_reason,mode,payload,issued,valid_until,sub.grace_ends_at,pg_catalog.encode(extensions.digest(pg_catalog.convert_to(payload::text,'UTF8'),'sha256'),'hex'));
  return rev;
end $$;
revoke all on function private.rebuild_tenant_entitlement_v1(uuid,text) from public,anon,authenticated;

create function private.enqueue_billing_notification_v1(p_subscription_id uuid,p_stage text,p_scheduled_at timestamptz)
returns integer language plpgsql security definer set search_path='' as $$
declare sub public.billing_subscriptions%rowtype; inserted_count integer:=0; affected integer;
begin
  if p_stage not in ('d0','d1','d3','d6','paid','recovered') then raise exception using errcode='22023',message='invalid billing notification stage'; end if;
  select * into sub from public.billing_subscriptions where id=p_subscription_id;
  if sub.id is null then return 0; end if;
  insert into public.billing_notifications(tenant_id,billing_account_id,subscription_id,stage,channel,state,semantic_key,scheduled_at,delivered_at,next_attempt_at)
  values(sub.tenant_id,sub.billing_account_id,sub.id,p_stage,'in_app','delivered','subscription:'||sub.id||':'||p_stage||':in_app',p_scheduled_at,clock_timestamp(),p_scheduled_at)
  on conflict(tenant_id,semantic_key) do nothing;
  get diagnostics affected=row_count; inserted_count:=inserted_count+affected;
  insert into public.billing_notifications(tenant_id,billing_account_id,subscription_id,stage,channel,state,semantic_key,scheduled_at,next_attempt_at)
  values(sub.tenant_id,sub.billing_account_id,sub.id,p_stage,'email','pending','subscription:'||sub.id||':'||p_stage||':email',p_scheduled_at,p_scheduled_at)
  on conflict(tenant_id,semantic_key) do nothing;
  get diagnostics affected=row_count; inserted_count:=inserted_count+affected;
  return inserted_count;
end $$;
revoke all on function private.enqueue_billing_notification_v1(uuid,text,timestamptz) from public,anon,authenticated;

create function public.create_billing_override_v1(p_tenant_id uuid,p_override_type text,p_duration_hours integer,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id(); account_id uuid; override_id uuid;
begin
  if actor is null or not exists(select 1 from public.platform_memberships membership where membership.user_id=actor and membership.role in('platform_owner','platform_admin')) then raise exception using errcode='42501',message='platform billing override permission required'; end if;
  if private.current_aal()<>'aal2' then raise exception using errcode='42501',message='aal2 required'; end if;
  if p_override_type not in('trial_extension','temporary_entitlement','collection_pause') or p_duration_hours<1 or p_duration_hours>744 or length(btrim(p_reason))<8 or length(btrim(p_request_id))<8 then raise exception using errcode='22023',message='invalid billing override'; end if;
  select id into account_id from public.billing_accounts where tenant_id=p_tenant_id;
  if account_id is null then raise exception using errcode='P0002',message='billing account not found'; end if;
  insert into public.billing_overrides(tenant_id,billing_account_id,override_type,reason,starts_at,expires_at,approved_by,request_id)
  values(p_tenant_id,account_id,p_override_type,btrim(p_reason),clock_timestamp(),clock_timestamp()+make_interval(hours=>p_duration_hours),actor,p_request_id) returning id into override_id;
  insert into public.billing_audit_log(tenant_id,actor_id,action,target_type,target_id,reason,request_id)
  values(p_tenant_id,actor,'billing.override.created','billing_override',override_id,btrim(p_reason),p_request_id);
  perform private.rebuild_tenant_entitlement_v1(p_tenant_id,'support_override_created');
  return override_id;
end $$;
revoke all on function public.create_billing_override_v1(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_billing_override_v1(uuid,text,integer,text,text) to authenticated;

create function public.promote_billing_account_live_v1(p_tenant_id uuid,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id(); account public.billing_accounts%rowtype;
begin
  if actor is null or not exists(select 1 from public.platform_memberships membership where membership.user_id=actor and membership.role='platform_owner') then raise exception using errcode='42501',message='platform owner billing promotion required'; end if;
  if private.current_aal()<>'aal2' then raise exception using errcode='42501',message='aal2 required'; end if;
  if length(btrim(p_reason))<8 or length(btrim(p_request_id))<8 then raise exception using errcode='22023',message='billing promotion reason required'; end if;
  select * into account from public.billing_accounts where tenant_id=p_tenant_id for update;
  if account.id is null then raise exception using errcode='P0002',message='billing account not found'; end if;
  if account.provider_mode='live' then return account.id; end if;
  update public.billing_mandates set is_primary=false where billing_account_id=account.id and provider_mode='test';
  update public.billing_accounts set provider_mode='live',mollie_customer_id=null,row_version=row_version+1,updated_at=clock_timestamp() where id=account.id;
  insert into public.billing_outbox(tenant_id,aggregate_type,aggregate_id,operation,semantic_key,payload_hash,payload_json)
  values(p_tenant_id,'billing_account',account.id,'create_mollie_customer','billing-account:'||account.id||':customer:live:v1',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(account.id::text||':customer:live:v1','UTF8'),'sha256'),'hex'),jsonb_build_object('billingAccountId',account.id,'providerMode','live'));
  insert into public.billing_audit_log(tenant_id,actor_id,action,target_type,target_id,reason,request_id)
  values(p_tenant_id,actor,'billing.account.promoted_live','billing_account',account.id,btrim(p_reason),p_request_id);
  return account.id;
end $$;
revoke all on function public.promote_billing_account_live_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.promote_billing_account_live_v1(uuid,text,text) to authenticated;

create function public.enqueue_first_payment_v1(p_tenant_id uuid,p_expected_row_version bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id(); account public.billing_accounts%rowtype; attempt_id uuid; attempt_number integer;
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.billing.manage') then raise exception using errcode='42501',message='billing manage permission required'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if private.current_aal()<>'aal2' then raise exception using errcode='42501',message='aal2 required'; end if;
  select * into account from public.billing_accounts where tenant_id=p_tenant_id for update;
  if account.id is null or account.row_version<>p_expected_row_version then raise exception using errcode='40001',message='billing account revision conflict'; end if;
  if account.mollie_customer_id is null then raise exception using errcode='55000',message='payment provider customer is not ready'; end if;
  select coalesce(max(attempt_no),0)+1 into attempt_number from public.billing_payment_attempts where billing_account_id=account.id and sequence_type='first';
  insert into public.billing_payment_attempts(tenant_id,billing_account_id,attempt_no,semantic_key,provider_mode,expected_amount_cents,expected_customer_id,sequence_type)
  values(p_tenant_id,account.id,attempt_number,'billing-account:'||account.id||':first:'||attempt_number,account.provider_mode,1,account.mollie_customer_id,'first') returning id into attempt_id;
  insert into public.billing_outbox(tenant_id,aggregate_type,aggregate_id,operation,semantic_key,payload_hash,payload_json)
  values(p_tenant_id,'payment_attempt',attempt_id,'create_first_payment','payment-attempt:'||attempt_id||':create',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(attempt_id::text||':create','UTF8'),'sha256'),'hex'),jsonb_build_object('attemptId',attempt_id,'providerMode',account.provider_mode));
  insert into public.billing_audit_log(tenant_id,actor_id,action,target_type,target_id,reason,request_id)
  values(p_tenant_id,actor,'billing.first_payment.enqueued','payment_attempt',attempt_id,'Betaalmethode koppelen gestart','first-payment:'||attempt_id);
  return attempt_id;
end $$;

create function public.apply_verified_billing_payment_v1(
  p_attempt_id uuid,p_provider_mode text,p_payment_id text,p_status text,p_amount_cents bigint,p_currency text,p_customer_id text,p_mandate_id text,p_body_hash text,p_request_id text,p_channel text
) returns text language plpgsql security definer set search_path='' as $$
declare attempt public.billing_payment_attempts%rowtype; sub public.billing_subscriptions%rowtype; effect_key text; now_at timestamptz:=clock_timestamp();
begin
  if current_user not in('service_role','postgres') then raise exception using errcode='42501',message='service role required'; end if;
  select * into attempt from public.billing_payment_attempts where id=p_attempt_id for update;
  if attempt.id is null then raise exception using errcode='P0002',message='payment attempt not found'; end if;
  if attempt.provider_mode<>p_provider_mode or attempt.expected_amount_cents<>p_amount_cents or attempt.expected_currency<>p_currency or attempt.expected_customer_id<>p_customer_id or (attempt.expected_mandate_id is not null and attempt.expected_mandate_id<>p_mandate_id) then raise exception using errcode='23514',message='verified provider payment does not match expected billing identity'; end if;
  insert into public.billing_provider_events(tenant_id,payment_attempt_id,channel,provider_resource_id,body_hash,request_id,result,processed_at)
  values(attempt.tenant_id,attempt.id,p_channel,p_payment_id,p_body_hash,p_request_id,'verified',now_at);
  update public.billing_payment_attempts set mollie_payment_id=coalesce(mollie_payment_id,p_payment_id),provider_status=p_status,finalized_at=case when p_status in('paid','failed','canceled','expired','refunded','charged_back') then now_at else null end,updated_at=now_at where id=attempt.id;
  if p_status='paid' then
    effect_key:='payment:'||p_payment_id||':paid';
    insert into public.billing_credit_ledger(tenant_id,billing_account_id,invoice_id,entry_type,amount_cents,semantic_key,reason)
    values(attempt.tenant_id,attempt.billing_account_id,attempt.invoice_id,case when attempt.sequence_type='first' then 'setup_credit' else 'debit' end,case when attempt.sequence_type='first' then 1 else -p_amount_cents end,effect_key,'Providerbetaling geverifieerd') on conflict(tenant_id,semantic_key) do nothing;
    if attempt.invoice_id is not null then update public.billing_invoices set status='paid',paid_at=now_at where id=attempt.invoice_id and status<>'paid'; end if;
    update public.billing_accounts set credit_balance_cents=credit_balance_cents+case when attempt.sequence_type='first' then 1 else 0 end,row_version=row_version+1,updated_at=now_at where id=attempt.billing_account_id and attempt.sequence_type='first';
    select * into sub from public.billing_subscriptions where billing_account_id=attempt.billing_account_id and status<>'ended' for update;
    if sub.id is not null and sub.status in('trialing','grace','restricted') then update public.billing_subscriptions set status='active',status_reason='invoice_paid',grace_started_at=null,grace_ends_at=null,row_version=row_version+1,updated_at=now_at where id=sub.id; perform private.rebuild_tenant_entitlement_v1(attempt.tenant_id,case when sub.status='trialing' then 'trial_invoice_paid' else 'payment_recovered' end); if private.tenant_feature_enabled_system_v1(attempt.tenant_id,'billing_dunning_worker') then perform private.enqueue_billing_notification_v1(sub.id,case when sub.status in('grace','restricted') then 'recovered' else 'paid' end,now_at); end if; end if;
  elsif p_status='charged_back' and attempt.sequence_type='recurring' then
    insert into public.billing_credit_ledger(tenant_id,billing_account_id,invoice_id,entry_type,amount_cents,semantic_key,reason)
    values(attempt.tenant_id,attempt.billing_account_id,attempt.invoice_id,'reversal',p_amount_cents,'payment:'||p_payment_id||':chargeback','Provider chargeback geverifieerd') on conflict(tenant_id,semantic_key) do nothing;
    update public.billing_invoices set status='payment_reversed',paid_at=null where id=attempt.invoice_id and status<>'payment_reversed';
    select * into sub from public.billing_subscriptions where billing_account_id=attempt.billing_account_id and status<>'ended' for update;
    if sub.id is not null and sub.status in('active','trialing') then update public.billing_subscriptions set status='grace',status_reason='payment_reversed',grace_started_at=now_at,grace_ends_at=now_at+interval '168 hours',row_version=row_version+1,updated_at=now_at where id=sub.id; perform private.rebuild_tenant_entitlement_v1(attempt.tenant_id,'payment_reversed'); if private.tenant_feature_enabled_system_v1(attempt.tenant_id,'billing_dunning_worker') then perform private.enqueue_billing_notification_v1(sub.id,'d0',now_at); end if; end if;
  elsif p_status in('failed','canceled','expired') and attempt.sequence_type='recurring' then
    select * into sub from public.billing_subscriptions where billing_account_id=attempt.billing_account_id and status<>'ended' for update;
    if sub.id is not null and sub.status in('active','trialing') then update public.billing_subscriptions set status='grace',status_reason='invoice_payment_failed',grace_started_at=now_at,grace_ends_at=now_at+interval '168 hours',row_version=row_version+1,updated_at=now_at where id=sub.id; perform private.rebuild_tenant_entitlement_v1(attempt.tenant_id,'invoice_payment_failed'); if private.tenant_feature_enabled_system_v1(attempt.tenant_id,'billing_dunning_worker') then perform private.enqueue_billing_notification_v1(sub.id,'d0',now_at); end if; end if;
  end if;
  return p_status;
end $$;

revoke all on function public.apply_verified_billing_payment_v1(uuid,text,text,text,bigint,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_verified_billing_payment_v1(uuid,text,text,text,bigint,text,text,text,text,text,text) to service_role;

create function private.guard_net_new_player_activation_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare subscription_status text;
begin
  if new.status <> 'paired'::public.player_device_status
    or not private.tenant_feature_enabled_system_v1(new.tenant_id,'billing_engine_enabled')
  then
    return new;
  end if;
  select subscription.status into subscription_status
  from public.billing_subscriptions subscription
  where subscription.tenant_id=new.tenant_id and subscription.status<>'ended'
  order by subscription.created_at desc limit 1;
  if subscription_status in ('restricted','suspended')
    and not exists(
      select 1 from public.screen_billing_intervals billing_interval
      where billing_interval.tenant_id=new.tenant_id
        and billing_interval.screen_id=new.screen_id
        and billing_interval.ended_at is null
    )
  then
    raise exception using errcode='55000',message='billing entitlement blocks activation of a new screen';
  end if;
  return new;
end $$;
create trigger player_devices_guard_net_new_activation
before insert or update of status on public.player_devices
for each row execute function private.guard_net_new_player_activation_v1();
revoke all on function private.guard_net_new_player_activation_v1() from public,anon,authenticated;

create function private.open_screen_billing_interval_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare sub public.billing_subscriptions%rowtype; command_id uuid; now_at timestamptz:=clock_timestamp();
begin
  if new.status<>'paired'::public.player_device_status or (tg_op='UPDATE' and old.status='paired'::public.player_device_status) then return new; end if;
  if not private.tenant_feature_enabled_system_v1(new.tenant_id,'billing_engine_enabled') then return new; end if;
  select * into sub from public.billing_subscriptions where tenant_id=new.tenant_id and status<>'ended' for update;
  if sub.id is null or sub.status in('restricted','suspended') then return new; end if;
  if exists(select 1 from public.screen_billing_intervals interval where interval.tenant_id=new.tenant_id and interval.screen_id=new.screen_id and interval.ended_at is null) then return new; end if;
  command_id:=new.id;
  insert into public.screen_billing_intervals(tenant_id,screen_id,subscription_id,started_at,start_reason,source_command_id)
  values(new.tenant_id,new.screen_id,sub.id,now_at,'first_player_activation',command_id) on conflict(tenant_id,source_command_id) do nothing;
  if sub.status='draft' then
    update public.billing_subscriptions set status='trialing',status_reason='first_billable_activation',trial_started_at=now_at,trial_ends_at=now_at+interval '336 hours',billing_anchor_day=extract(day from now_at)::smallint,row_version=row_version+1,updated_at=now_at where id=sub.id;
    perform private.rebuild_tenant_entitlement_v1(new.tenant_id,'trial_started');
  end if;
  return new;
end $$;
create trigger player_devices_open_billing_interval after insert or update of status on public.player_devices for each row execute function private.open_screen_billing_interval_v1();
revoke all on function private.open_screen_billing_interval_v1() from public,anon,authenticated;

create function private.close_screen_billing_interval_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='disabled'::public.screen_status and old.status<>'disabled'::public.screen_status then
    update public.screen_billing_intervals
    set ended_at=clock_timestamp(),end_reason='screen_disabled'
    where tenant_id=new.tenant_id and screen_id=new.id and ended_at is null;
  end if;
  return new;
end $$;
create trigger screens_close_billing_interval
after update of status on public.screens
for each row execute function private.close_screen_billing_interval_v1();
revoke all on function private.close_screen_billing_interval_v1() from public,anon,authenticated;

create function public.get_player_entitlement_v1(p_token_hash text)
returns table(tenant_id uuid,screen_id uuid,device_id uuid,revision bigint,billing_state text,reason text,playback_mode text,capabilities_json jsonb,issued_at timestamptz,valid_until timestamptz,hard_stop_at timestamptz)
language sql stable security definer set search_path='' as $$
  select device.tenant_id,device.screen_id,device.id,snapshot.revision,snapshot.billing_state,snapshot.reason,
    case
      when not private.tenant_feature_enabled_system_v1(device.tenant_id,'billing_enforce_entitlements') then 'tenant_content'
      when snapshot.playback_mode='tenant_content_with_warning' and not private.tenant_feature_enabled_system_v1(device.tenant_id,'billing_player_warning_chip') then 'tenant_content'
      when snapshot.playback_mode='veyocast_billing_splash' and not private.tenant_feature_enabled_system_v1(device.tenant_id,'billing_player_restriction_splash') then 'tenant_content'
      else snapshot.playback_mode end,
    snapshot.capabilities_json,snapshot.issued_at,snapshot.valid_until,snapshot.hard_stop_at
  from public.player_devices device
  join lateral(select * from public.tenant_entitlement_snapshots s where s.tenant_id=device.tenant_id order by s.revision desc limit 1) snapshot on true
  where device.token_hash=p_token_hash and device.status='paired'::public.player_device_status;
$$;
revoke all on function public.get_player_entitlement_v1(text) from public,authenticated;
grant execute on function public.get_player_entitlement_v1(text) to anon,service_role;

create function public.generate_billing_cycle_v1(p_subscription_id uuid,p_period_start timestamptz,p_period_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare sub public.billing_subscriptions%rowtype; account public.billing_accounts%rowtype; price public.billing_price_versions%rowtype; v_snapshot_id uuid; v_invoice_id uuid; invoice_gross bigint; invoice_net bigint; invoice_vat bigint; credit bigint; mandate public.billing_mandates%rowtype; attempt_id uuid; v_invoice_number text;
begin
  if current_user not in('service_role','postgres') then raise exception using errcode='42501',message='service role required'; end if;
  if p_period_end<=p_period_start then raise exception using errcode='22023',message='invalid billing period'; end if;
  select * into sub from public.billing_subscriptions where id=p_subscription_id for update;
  if sub.id is null or sub.status not in('trialing','active','grace') then raise exception using errcode='55000',message='subscription is not billable'; end if;
  if not private.tenant_feature_enabled_system_v1(sub.tenant_id,'billing_engine_enabled') then raise exception using errcode='55000',message='billing engine is not enabled for tenant'; end if;
  select * into account from public.billing_accounts where id=sub.billing_account_id;
  select * into price from public.billing_price_versions where id=sub.price_version_id;
  select invoice.id into v_invoice_id from public.billing_invoices invoice where invoice.subscription_id=sub.id and invoice.period_start=p_period_start and invoice.period_end=p_period_end;
  if v_invoice_id is not null then return v_invoice_id; end if;
  insert into public.billing_usage_snapshots(tenant_id,subscription_id,period_start,period_end,screen_count_at_anchor,checksum)
  values(sub.tenant_id,sub.id,p_period_start,p_period_end,(select count(*) from public.screen_billing_intervals i where i.subscription_id=sub.id and i.started_at<p_period_end and coalesce(i.ended_at,p_period_end)>p_period_start),repeat('0',64)) returning id into v_snapshot_id;
  insert into public.billing_usage_snapshot_lines(tenant_id,snapshot_id,screen_id,active_seconds,period_seconds,unit_gross_cents,gross_cents,line_type,source_interval_ids)
  select sub.tenant_id,v_snapshot_id,i.screen_id,
    extract(epoch from(least(coalesce(i.ended_at,p_period_end),p_period_end)-greatest(i.started_at,p_period_start)))::bigint,
    extract(epoch from(p_period_end-p_period_start))::bigint,price.gross_unit_cents,
    round(price.gross_unit_cents*extract(epoch from(least(coalesce(i.ended_at,p_period_end),p_period_end)-greatest(i.started_at,p_period_start)))/extract(epoch from(p_period_end-p_period_start)))::integer,
    case when greatest(i.started_at,p_period_start)=p_period_start and least(coalesce(i.ended_at,p_period_end),p_period_end)=p_period_end then 'recurring' else 'proration' end,
    array[i.id]
  from public.screen_billing_intervals i where i.subscription_id=sub.id and i.started_at<p_period_end and coalesce(i.ended_at,p_period_end)>p_period_start;
  select coalesce(sum(usage_line.gross_cents),0) into invoice_gross from public.billing_usage_snapshot_lines usage_line where usage_line.snapshot_id=v_snapshot_id;
  credit:=least(account.credit_balance_cents,invoice_gross);
  invoice_gross:=invoice_gross-credit;
  invoice_net:=round(invoice_gross*100.0/121.0); invoice_vat:=invoice_gross-invoice_net;
  v_invoice_number:='VC-'||to_char(p_period_start,'YYYYMM')||'-'||upper(substr(replace(sub.id::text,'-',''),1,8));
  insert into public.billing_invoices(tenant_id,billing_account_id,subscription_id,usage_snapshot_id,invoice_number,period_start,period_end,net_cents,vat_cents,gross_cents,applied_credit_cents,status,due_at,issued_at,snapshot_hash)
  values(sub.tenant_id,account.id,sub.id,v_snapshot_id,v_invoice_number,p_period_start,p_period_end,invoice_net,invoice_vat,invoice_gross,credit,'issued',p_period_start,p_period_start,pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_snapshot_id::text||':'||invoice_gross,'UTF8'),'sha256'),'hex')) returning id into v_invoice_id;
  insert into public.billing_invoice_lines(tenant_id,invoice_id,screen_id,line_type,description,quantity_numerator,quantity_denominator,unit_gross_cents,net_cents,vat_cents,gross_cents,source_interval_ids)
  select line.tenant_id,v_invoice_id,line.screen_id,case when line.line_type='recurring' then 'screen' else 'proration' end,'Actief VeyoCast-scherm',line.active_seconds,line.period_seconds,line.unit_gross_cents,round(line.gross_cents*100.0/121.0),line.gross_cents-round(line.gross_cents*100.0/121.0),line.gross_cents,line.source_interval_ids from public.billing_usage_snapshot_lines line where line.snapshot_id=v_snapshot_id;
  if credit>0 then
    insert into public.billing_invoice_lines(tenant_id,invoice_id,line_type,description,quantity_numerator,quantity_denominator,unit_gross_cents,net_cents,vat_cents,gross_cents)
    values(sub.tenant_id,v_invoice_id,'setup_credit','Beschikbaar krediet',1,1,-credit,-credit,0,-credit);
    update public.billing_accounts set credit_balance_cents=credit_balance_cents-credit,row_version=row_version+1,updated_at=clock_timestamp() where id=account.id;
    insert into public.billing_credit_ledger(tenant_id,billing_account_id,invoice_id,entry_type,amount_cents,semantic_key,reason) values(sub.tenant_id,account.id,v_invoice_id,'debit',-credit,'invoice:'||v_invoice_id||':credit','Krediet toegepast');
  end if;
  update public.billing_usage_snapshots set checksum=pg_catalog.encode(extensions.digest(pg_catalog.convert_to((select coalesce(jsonb_agg(to_jsonb(l) order by l.screen_id),'[]')::text from public.billing_usage_snapshot_lines l where l.snapshot_id=v_snapshot_id),'UTF8'),'sha256'),'hex'),finalized_at=clock_timestamp() where id=v_snapshot_id;
  if invoice_gross=0 then update public.billing_invoices set status='paid',paid_at=clock_timestamp() where id=v_invoice_id;
  elsif private.tenant_feature_enabled_system_v1(sub.tenant_id,'billing_collect_recurring') and not exists(select 1 from public.billing_overrides ov where ov.tenant_id=sub.tenant_id and ov.override_type='collection_pause' and ov.starts_at<=clock_timestamp() and ov.expires_at>clock_timestamp()) then
    select * into mandate from public.billing_mandates where billing_account_id=account.id and is_primary and status='valid';
    if mandate.id is not null then
      insert into public.billing_payment_attempts(tenant_id,billing_account_id,invoice_id,attempt_no,semantic_key,provider_mode,expected_amount_cents,expected_customer_id,expected_mandate_id,sequence_type)
      values(sub.tenant_id,account.id,v_invoice_id,1,'invoice:'||v_invoice_id||':attempt:1',account.provider_mode,invoice_gross,account.mollie_customer_id,mandate.mollie_mandate_id,'recurring') returning id into attempt_id;
      insert into public.billing_outbox(tenant_id,aggregate_type,aggregate_id,operation,semantic_key,payload_hash,payload_json)
      values(sub.tenant_id,'payment_attempt',attempt_id,'create_recurring_payment','payment-attempt:'||attempt_id||':create',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(attempt_id::text||':create','UTF8'),'sha256'),'hex'),jsonb_build_object('attemptId',attempt_id,'providerMode',account.provider_mode));
      update public.billing_invoices set status='payment_pending' where id=v_invoice_id;
    end if;
  end if;
  update public.billing_subscriptions set current_period_start=p_period_start,current_period_end=p_period_end,row_version=row_version+1,updated_at=clock_timestamp() where id=sub.id;
  return v_invoice_id;
end $$;

create function public.advance_billing_entitlements_v1(p_now timestamptz default clock_timestamp()) returns integer
language plpgsql security definer set search_path='' as $$
declare sub record; changed integer:=0;
begin
  if current_user not in('service_role','postgres') then raise exception using errcode='42501',message='service role required'; end if;
  for sub in select id,tenant_id from public.billing_subscriptions where status='grace' and grace_ends_at<=p_now for update skip locked loop
    update public.billing_subscriptions set status='restricted',status_reason='grace_expired',row_version=row_version+1,updated_at=p_now where id=sub.id;
    perform private.rebuild_tenant_entitlement_v1(sub.tenant_id,'grace_expired'); changed:=changed+1;
  end loop;
  return changed;
end $$;

create function public.schedule_billing_dunning_v1(p_now timestamptz default clock_timestamp()) returns integer
language plpgsql security definer set search_path='' as $$
declare sub record; milestone record; changed integer:=0;
begin
  if current_user not in('service_role','postgres') then raise exception using errcode='42501',message='service role required'; end if;
  for sub in select id,grace_started_at from public.billing_subscriptions where status='grace' and grace_started_at is not null and private.tenant_feature_enabled_system_v1(tenant_id,'billing_dunning_worker') loop
    for milestone in select * from (values ('d1',interval '1 day'),('d3',interval '3 days'),('d6',interval '6 days')) as due(stage,offset_value) loop
      if sub.grace_started_at+milestone.offset_value<=p_now then
        changed:=changed+private.enqueue_billing_notification_v1(sub.id,milestone.stage,sub.grace_started_at+milestone.offset_value);
      end if;
    end loop;
  end loop;
  return changed;
end $$;

create function public.expire_billing_overrides_v1(p_now timestamptz default clock_timestamp()) returns integer
language plpgsql security definer set search_path='' as $$
declare tenant record; changed integer:=0;
begin
  if current_user not in('service_role','postgres') then raise exception using errcode='42501',message='service role required'; end if;
  for tenant in select distinct ov.tenant_id from public.billing_overrides ov where ov.expires_at<=p_now and not exists(select 1 from public.billing_audit_log audit where audit.target_id=ov.id and audit.action='billing.override.expired') loop
    insert into public.billing_audit_log(tenant_id,action,target_type,target_id,reason,request_id)
    select ov.tenant_id,'billing.override.expired','billing_override',ov.id,'Tijdgebonden billingoverride verlopen','override-expired:'||ov.id from public.billing_overrides ov where ov.tenant_id=tenant.tenant_id and ov.expires_at<=p_now and not exists(select 1 from public.billing_audit_log audit where audit.target_id=ov.id and audit.action='billing.override.expired');
    perform private.rebuild_tenant_entitlement_v1(tenant.tenant_id,'support_override_expired'); changed:=changed+1;
  end loop;
  return changed;
end $$;

revoke all on function public.generate_billing_cycle_v1(uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.advance_billing_entitlements_v1(timestamptz) from public,anon,authenticated;
revoke all on function public.schedule_billing_dunning_v1(timestamptz) from public,anon,authenticated;
revoke all on function public.expire_billing_overrides_v1(timestamptz) from public,anon,authenticated;
grant execute on function public.generate_billing_cycle_v1(uuid,timestamptz,timestamptz) to service_role;
grant execute on function public.advance_billing_entitlements_v1(timestamptz) to service_role;
grant execute on function public.schedule_billing_dunning_v1(timestamptz) to service_role;
grant execute on function public.expire_billing_overrides_v1(timestamptz) to service_role;

revoke all on function public.ensure_billing_account_v1(uuid,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.enqueue_first_payment_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.ensure_billing_account_v1(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.enqueue_first_payment_v1(uuid,bigint) to authenticated;

comment on table public.billing_accounts is 'Tenant legal billing identity; provider IDs are mode-separated and secrets never stored.';
comment on table public.billing_outbox is 'Permanent local semantic idempotency boundary; Mollie one-hour idempotency is only an extra provider guard.';
comment on table public.tenant_entitlement_snapshots is 'Append-only monotonic server entitlement source. Device-bound signatures are added by the Player API boundary.';
