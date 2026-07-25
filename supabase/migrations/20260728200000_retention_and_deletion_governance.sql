-- S41-B: explicit retention registry and two-person deletion preparation.
-- Destructive tenant deletion intentionally remains blocked until legal review.

create table public.retention_policies (
  data_class text primary key check (data_class in (
    'player_heartbeats',
    'player_sync_events',
    'audit_events',
    'server_logs',
    'deleted_media',
    'abandoned_uploads',
    'support_tickets',
    'database_backups',
    'storage_backups'
  )),
  retention_days integer not null check (retention_days between 1 and 3650),
  enforcement text not null check (enforcement in (
    'automatic',
    'external',
    'legal_review_required'
  )),
  rationale text not null check (length(btrim(rationale)) between 10 and 500),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    (enforcement = 'automatic' and approved_at is not null and approved_by is not null)
    or enforcement <> 'automatic'
  )
);

insert into public.retention_policies (
  data_class, retention_days, enforcement, rationale
)
values
  ('player_heartbeats', 30, 'legal_review_required', 'Voorgestelde operationele termijn voor beschikbaarheidsdiagnose.'),
  ('player_sync_events', 90, 'legal_review_required', 'Voorgestelde termijn voor onderzoek naar release- en synchronisatiefouten.'),
  ('audit_events', 365, 'legal_review_required', 'Concepttermijn; fiscale, contractuele en beveiligingsbelangen moeten juridisch worden bevestigd.'),
  ('server_logs', 5, 'external', 'Docker roteert maximaal vijf bestanden van tien MB; tijdsduur hangt af van verkeersvolume.'),
  ('deleted_media', 30, 'legal_review_required', 'Media wordt pas fysiek verwijderd na referentiecontrole en bevestigde back-upstrategie.'),
  ('abandoned_uploads', 7, 'legal_review_required', 'Onvoltooide uploads kunnen na een korte herstelperiode worden opgeruimd.'),
  ('support_tickets', 730, 'legal_review_required', 'Concepttermijn voor dienstverlening en geschilafhandeling.'),
  ('database_backups', 35, 'external', 'Dagelijkse back-ups met vijf wekelijkse herstelpunten is het voorgestelde minimum.'),
  ('storage_backups', 35, 'external', 'Objectback-ups volgen dezelfde dagelijkse en wekelijkse herstelvensters als de database.');

create trigger retention_policies_set_updated_at
before update on public.retention_policies
for each row execute function private.set_updated_at();

create table public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  apply_changes boolean not null,
  initiated_by text not null check (initiated_by in ('scheduled_worker', 'platform_owner')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now()
);

create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  tenant_id uuid references public.tenants(id) on delete restrict,
  requested_user_id uuid references public.profiles(id) on delete set null,
  scope text not null check (scope in ('tenant', 'account')),
  status text not null default 'requested' check (status in (
    'requested',
    'legal_review',
    'approved',
    'blocked',
    'executed',
    'cancelled'
  )),
  reason text check (reason is null or length(reason) <= 1000),
  legal_basis_notes text check (
    legal_basis_notes is null or length(legal_basis_notes) <= 4000
  ),
  retain_until timestamptz,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope <> 'tenant' or tenant_id is not null),
  check (
    status not in ('approved', 'blocked', 'executed')
    or reviewed_at is not null and reviewed_by is not null
  )
);

create index data_deletion_requests_tenant_status_idx
  on public.data_deletion_requests(tenant_id, status, requested_at desc);
create trigger data_deletion_requests_set_updated_at
before update on public.data_deletion_requests
for each row execute function private.set_updated_at();

alter table public.retention_policies enable row level security;
alter table public.retention_policies force row level security;
alter table public.retention_runs enable row level security;
alter table public.retention_runs force row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.data_deletion_requests force row level security;

create or replace function private.require_aal2_command()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_aal() <> 'aal2' then
    raise exception 'sensitive command requires aal2' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_aal2_command()
  from public, anon, authenticated;

revoke all on
  public.retention_policies,
  public.retention_runs,
  public.data_deletion_requests
from public, anon, authenticated;
grant select on
  public.retention_policies,
  public.retention_runs
to authenticated;
grant select on public.data_deletion_requests to authenticated;

create policy "retention_policies_platform_read"
on public.retention_policies for select to authenticated
using (private.is_platform_member(array[
  'platform_owner', 'platform_admin', 'platform_support'
]::public.platform_role[]));
create policy "retention_runs_platform_read"
on public.retention_runs for select to authenticated
using (private.is_platform_member(array[
  'platform_owner', 'platform_admin', 'platform_support'
]::public.platform_role[]));
create policy "deletion_requests_read_by_scope"
on public.data_deletion_requests for select to authenticated
using (
  private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
  or requested_user_id = private.current_user_id()
  or tenant_id is not null and private.has_tenant_capability(
    tenant_id,
    'tenant.settings.manage'
  )
);

create or replace function public.request_data_deletion_v1(
  p_scope text,
  p_tenant_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  request_id uuid;
  request_number bigint;
begin
  if actor_id is null then
    raise exception 'authenticated actor required' using errcode = '42501';
  end if;
  if p_scope not in ('tenant', 'account') then
    raise exception 'unsupported deletion scope' using errcode = '23514';
  end if;
  if p_scope = 'tenant' and (
    p_tenant_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.settings.manage')
  ) then
    raise exception 'tenant settings capability required' using errcode = '42501';
  end if;
  if p_scope = 'tenant' then
    perform private.require_aal2_command();
  end if;
  insert into public.data_deletion_requests (
    tenant_id, requested_user_id, scope, reason
  )
  values (
    case when p_scope = 'tenant' then p_tenant_id else null end,
    actor_id,
    p_scope,
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id, data_deletion_requests.request_number
  into request_id, request_number;
  perform private.audit_event(
    p_tenant_id,
    'data_deletion.requested',
    'data_deletion_requests',
    request_id,
    'success',
    jsonb_build_object('scope', p_scope, 'requestNumber', request_number)
  );
  return jsonb_build_object(
    'outcome', 'requested',
    'requestId', request_id,
    'requestNumber', request_number
  );
end;
$$;

create or replace function public.review_data_deletion_v1(
  p_request_id uuid,
  p_decision text,
  p_legal_basis_notes text,
  p_retain_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  request_record public.data_deletion_requests%rowtype;
begin
  perform private.require_platform_roles(array[
    'platform_owner'::public.platform_role
  ]);
  perform private.require_aal2_command();
  select request.* into request_record
  from public.data_deletion_requests request
  where request.id = p_request_id
  for update;
  if not found then raise exception 'deletion request not found' using errcode = 'P0002'; end if;
  if request_record.status not in ('requested', 'legal_review')
    or p_decision not in ('approved', 'blocked', 'cancelled')
    or length(btrim(coalesce(p_legal_basis_notes, ''))) < 10
  then
    raise exception 'deletion review is invalid' using errcode = '23514';
  end if;
  update public.data_deletion_requests
  set
    status = p_decision,
    legal_basis_notes = btrim(p_legal_basis_notes),
    retain_until = p_retain_until,
    reviewed_at = now(),
    reviewed_by = actor_id
  where id = request_record.id;
  perform private.audit_event(
    request_record.tenant_id,
    'data_deletion.reviewed',
    'data_deletion_requests',
    request_record.id,
    'success',
    jsonb_build_object('decision', p_decision)
  );
  return jsonb_build_object('outcome', p_decision);
end;
$$;

create or replace function private.retention_days(p_data_class text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select policy.retention_days
  from public.retention_policies policy
  where policy.data_class = p_data_class
    and policy.enforcement = 'automatic'
    and policy.approved_at is not null;
$$;

create or replace function public.run_retention_maintenance_v1(
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  heartbeat_days integer := private.retention_days('player_heartbeats');
  sync_days integer := private.retention_days('player_sync_events');
  audit_days integer := private.retention_days('audit_events');
  upload_days integer := private.retention_days('abandoned_uploads');
  heartbeat_count bigint := 0;
  sync_count bigint := 0;
  audit_count bigint := 0;
  upload_count bigint := 0;
  result jsonb;
begin
  if current_user <> 'service_role' then
    perform private.require_platform_roles(array[
      'platform_owner'::public.platform_role
    ]);
    perform private.require_aal2_command();
  end if;

  if heartbeat_days is not null then
    select count(*) into heartbeat_count from public.player_heartbeats
    where created_at < now() - make_interval(days => heartbeat_days);
  end if;
  if sync_days is not null then
    select count(*) into sync_count from public.player_sync_events
    where created_at < now() - make_interval(days => sync_days);
  end if;
  if audit_days is not null then
    select count(*) into audit_count from public.audit_events
    where created_at < now() - make_interval(days => audit_days);
  end if;
  if upload_days is not null then
    select count(*) into upload_count from public.media_upload_sessions
    where status in ('pending', 'expired', 'cancelled')
      and expires_at < now() - make_interval(days => upload_days);
  end if;

  if p_apply then
    if heartbeat_days is not null then
      delete from public.player_heartbeats
      where created_at < now() - make_interval(days => heartbeat_days);
    end if;
    if sync_days is not null then
      delete from public.player_sync_events
      where created_at < now() - make_interval(days => sync_days);
    end if;
    if audit_days is not null then
      delete from public.audit_events
      where created_at < now() - make_interval(days => audit_days);
    end if;
    if upload_days is not null then
      delete from public.media_upload_sessions
      where status in ('pending', 'expired', 'cancelled')
        and expires_at < now() - make_interval(days => upload_days);
    end if;
  end if;

  result := jsonb_build_object(
    'applied', p_apply,
    'eligible', jsonb_build_object(
      'playerHeartbeats', heartbeat_count,
      'playerSyncEvents', sync_count,
      'auditEvents', audit_count,
      'abandonedUploads', upload_count
    ),
    'blockedPendingLegalPolicy', jsonb_build_array(
      'deleted_media', 'support_tickets'
    )
  );
  insert into public.retention_runs (apply_changes, initiated_by, result)
  values (
    p_apply,
    case when current_user = 'service_role'
      then 'scheduled_worker'
      else 'platform_owner'
    end,
    result
  );
  return result;
end;
$$;

revoke all on function public.request_data_deletion_v1(text, uuid, text)
  from public, anon;
revoke all on function public.review_data_deletion_v1(
  uuid, text, text, timestamptz
) from public, anon;
revoke all on function public.run_retention_maintenance_v1(boolean)
  from public, anon, authenticated;
grant execute on function public.request_data_deletion_v1(text, uuid, text)
  to authenticated;
grant execute on function public.review_data_deletion_v1(
  uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.run_retention_maintenance_v1(boolean)
  to service_role;
