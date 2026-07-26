-- S47: tenant-safe per-screen operating schedules and Android automation.
-- Content schedules remain separate and continue to select immutable releases.

alter table public.player_devices
  add constraint player_devices_tenant_screen_device_uq
  unique (tenant_id, screen_id, id);

create table public.screen_automation_settings (
  screen_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  schema_version integer not null default 1 check (schema_version = 1),
  enabled boolean not null default false,
  timezone_name text not null check (length(timezone_name) between 3 and 64),
  schedule_mode text not null default 'weekly'
    check (schedule_mode in ('always', 'weekly')),
  startup_enabled boolean not null default false,
  local_wake_enabled boolean not null default false,
  hdmi_cec_enabled boolean not null default false,
  keep_awake_enabled boolean not null default true,
  wake_lead_minutes integer not null default 5 check (wake_lead_minutes between 0 and 60),
  restore_after_reboot boolean not null default true,
  offline_execution_enabled boolean not null default true,
  temporary_override text not null default 'none'
    check (temporary_override in ('none', 'active', 'paused')),
  temporary_override_until timestamptz,
  accepted_hdmi_cec_disclaimer_at timestamptz,
  accepted_hdmi_cec_disclaimer_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, screen_id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  check (not hdmi_cec_enabled or local_wake_enabled),
  check (not local_wake_enabled or startup_enabled),
  check (
    (temporary_override = 'none' and temporary_override_until is null)
    or (
      temporary_override <> 'none'
      and temporary_override_until is not null
      and temporary_override_until > updated_at
    )
  ),
  check (
    not hdmi_cec_enabled
    or (
      accepted_hdmi_cec_disclaimer_at is not null
      and accepted_hdmi_cec_disclaimer_by is not null
    )
  )
);

create index screen_automation_settings_tenant_enabled_idx
  on public.screen_automation_settings(tenant_id, enabled, updated_at desc);

create table public.screen_automation_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_local_time time not null,
  end_local_time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, screen_id)
    references public.screen_automation_settings(tenant_id, screen_id)
    on delete cascade,
  check (start_local_time <> end_local_time)
);

create index screen_automation_periods_screen_day_idx
  on public.screen_automation_periods(tenant_id, screen_id, weekday, start_local_time);

create table public.screen_automation_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  local_date date not null,
  mode text not null check (mode in ('closed', 'open')),
  start_local_time time,
  end_local_time time,
  reason text check (reason is null or length(reason) <= 160),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, screen_id)
    references public.screen_automation_settings(tenant_id, screen_id)
    on delete cascade,
  check (
    (mode = 'closed' and start_local_time is null and end_local_time is null)
    or (
      mode = 'open'
      and start_local_time is not null
      and end_local_time is not null
      and start_local_time <> end_local_time
    )
  )
);

create index screen_automation_exceptions_screen_date_idx
  on public.screen_automation_exceptions(tenant_id, screen_id, local_date);

create table public.screen_automation_commands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  device_id uuid not null,
  command_type text not null check (command_type = 'wake_test'),
  status text not null default 'requested' check (
    status in (
      'requested', 'received', 'wake_requested', 'player_started',
      'heartbeat_received', 'expired', 'failed'
    )
  ),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  received_at timestamptz,
  wake_requested_at timestamptz,
  player_started_at timestamptz,
  completed_at timestamptz,
  result_code text check (
    result_code is null or result_code ~ '^[A-Z0-9_]{1,100}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, screen_id, device_id, id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id, device_id)
    references public.player_devices(tenant_id, screen_id, id)
    on delete cascade,
  check (expires_at > requested_at)
);

create index screen_automation_commands_device_open_idx
  on public.screen_automation_commands(tenant_id, device_id, requested_at)
  where status in ('requested', 'received', 'wake_requested', 'player_started');
create index screen_automation_commands_screen_history_idx
  on public.screen_automation_commands(tenant_id, screen_id, requested_at desc);

create table public.screen_automation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  screen_id uuid not null,
  device_id uuid not null,
  command_id uuid,
  client_event_id uuid not null,
  event_type text not null check (
    event_type in (
      'automation-config-received',
      'automation-config-stored',
      'command-received',
      'schedule-evaluated',
      'wake-scheduled',
      'wake-triggered',
      'activity-start-requested',
      'player-visible',
      'keep-awake-enabled',
      'keep-awake-disabled',
      'heartbeat-sent',
      'execution-failed'
    )
  ),
  scheduled_for timestamptz,
  occurred_at timestamptz not null,
  status text not null check (status in ('success', 'warning', 'failed')),
  diagnostic_code text check (
    diagnostic_code is null or diagnostic_code ~ '^[A-Z0-9_]{1,100}$'
  ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, device_id, client_event_id),
  foreign key (tenant_id, screen_id)
    references public.screens(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id, device_id)
    references public.player_devices(tenant_id, screen_id, id)
    on delete cascade,
  foreign key (tenant_id, screen_id, device_id, command_id)
    references public.screen_automation_commands(tenant_id, screen_id, device_id, id)
    on delete set null (command_id)
);

create index screen_automation_events_screen_history_idx
  on public.screen_automation_events(tenant_id, screen_id, occurred_at desc);
create index screen_automation_events_device_history_idx
  on public.screen_automation_events(tenant_id, device_id, occurred_at desc)
  where device_id is not null;

create trigger screen_automation_settings_set_updated_at
before update on public.screen_automation_settings
for each row execute function private.set_updated_at();
create trigger screen_automation_commands_set_updated_at
before update on public.screen_automation_commands
for each row execute function private.set_updated_at();

alter table public.screen_automation_settings enable row level security;
alter table public.screen_automation_settings force row level security;
alter table public.screen_automation_periods enable row level security;
alter table public.screen_automation_periods force row level security;
alter table public.screen_automation_exceptions enable row level security;
alter table public.screen_automation_exceptions force row level security;
alter table public.screen_automation_commands enable row level security;
alter table public.screen_automation_commands force row level security;
alter table public.screen_automation_events enable row level security;
alter table public.screen_automation_events force row level security;

revoke all on
  public.screen_automation_settings,
  public.screen_automation_periods,
  public.screen_automation_exceptions,
  public.screen_automation_commands,
  public.screen_automation_events
from public, anon, authenticated;

grant select on
  public.screen_automation_settings,
  public.screen_automation_periods,
  public.screen_automation_exceptions,
  public.screen_automation_commands,
  public.screen_automation_events
to authenticated;

create policy "screen_automation_settings_select_by_scope"
on public.screen_automation_settings for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_automation_settings_insert_by_manager"
on public.screen_automation_settings for insert to authenticated
with check (false);
create policy "screen_automation_settings_update_by_manager"
on public.screen_automation_settings for update to authenticated
using (false)
with check (false);
create policy "screen_automation_settings_delete_by_manager"
on public.screen_automation_settings for delete to authenticated
using (false);

create policy "screen_automation_periods_select_by_scope"
on public.screen_automation_periods for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_automation_periods_insert_by_manager"
on public.screen_automation_periods for insert to authenticated
with check (false);
create policy "screen_automation_periods_update_by_manager"
on public.screen_automation_periods for update to authenticated
using (false)
with check (false);
create policy "screen_automation_periods_delete_by_manager"
on public.screen_automation_periods for delete to authenticated
using (false);

create policy "screen_automation_exceptions_select_by_scope"
on public.screen_automation_exceptions for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_automation_exceptions_insert_by_manager"
on public.screen_automation_exceptions for insert to authenticated
with check (false);
create policy "screen_automation_exceptions_update_by_manager"
on public.screen_automation_exceptions for update to authenticated
using (false)
with check (false);
create policy "screen_automation_exceptions_delete_by_manager"
on public.screen_automation_exceptions for delete to authenticated
using (false);

create policy "screen_automation_commands_select_by_scope"
on public.screen_automation_commands for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_automation_commands_insert_by_manager"
on public.screen_automation_commands for insert to authenticated
with check (false);
create policy "screen_automation_commands_update_by_manager"
on public.screen_automation_commands for update to authenticated
using (false)
with check (false);
create policy "screen_automation_commands_delete_by_manager"
on public.screen_automation_commands for delete to authenticated
using (false);

create policy "screen_automation_events_select_by_scope"
on public.screen_automation_events for select to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "screen_automation_events_insert_by_manager"
on public.screen_automation_events for insert to authenticated
with check (false);
create policy "screen_automation_events_update_by_manager"
on public.screen_automation_events for update to authenticated
using (false)
with check (false);
create policy "screen_automation_events_delete_by_manager"
on public.screen_automation_events for delete to authenticated
using (false);

create or replace function private.screen_automation_periods_overlap(
  p_tenant_id uuid,
  p_screen_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      period.id,
      ((period.weekday - 1) * 1440
        + extract(hour from period.start_local_time)::integer * 60
        + extract(minute from period.start_local_time)::integer) as starts,
      ((period.weekday - 1) * 1440
        + extract(hour from period.end_local_time)::integer * 60
        + extract(minute from period.end_local_time)::integer) as raw_ends
    from public.screen_automation_periods period
    where period.tenant_id = p_tenant_id
      and period.screen_id = p_screen_id
      and period.enabled
  ),
  expanded as (
    select id, starts, case when raw_ends <= starts then raw_ends + 1440 else raw_ends end as ends
    from normalized
  ),
  segments as (
    select id, int4range(starts, least(ends, 10080), '[)') as span
    from expanded
    union all
    select id, int4range(0, ends - 10080, '[)') as span
    from expanded where ends > 10080
  )
  select exists (
    select 1
    from segments first_period
    join segments second_period
      on first_period.id < second_period.id
     and first_period.span && second_period.span
  );
$$;

create or replace function private.screen_automation_exceptions_overlap(
  p_tenant_id uuid,
  p_screen_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with invalid_day as (
    select local_date
    from public.screen_automation_exceptions
    where tenant_id = p_tenant_id and screen_id = p_screen_id
    group by local_date
    having bool_or(mode = 'closed') and count(*) > 1
  ),
  normalized as (
    select
      exception.id,
      ((exception.local_date - date '2000-01-01') * 1440
        + extract(hour from exception.start_local_time)::integer * 60
        + extract(minute from exception.start_local_time)::integer) as starts,
      ((exception.local_date - date '2000-01-01') * 1440
        + extract(hour from exception.end_local_time)::integer * 60
        + extract(minute from exception.end_local_time)::integer) as raw_ends
    from public.screen_automation_exceptions exception
    where exception.tenant_id = p_tenant_id
      and exception.screen_id = p_screen_id
      and exception.mode = 'open'
  ),
  expanded as (
    select id, starts, case when raw_ends <= starts then raw_ends + 1440 else raw_ends end as ends
    from normalized
  )
  select exists (select 1 from invalid_day)
    or exists (
      select 1 from expanded first_exception
      join expanded second_exception
        on first_exception.id < second_exception.id
       and int8range(first_exception.starts, first_exception.ends, '[)')
           && int8range(second_exception.starts, second_exception.ends, '[)')
    );
$$;

create or replace function public.save_screen_automation_v1(
  p_tenant_id uuid,
  p_screen_id uuid,
  p_expected_revision bigint,
  p_settings jsonb,
  p_accept_hdmi_cec_disclaimer boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_settings public.screen_automation_settings%rowtype;
  next_revision bigint;
  desired_timezone text := btrim(coalesce(p_settings ->> 'timezone', ''));
  desired_hdmi boolean := coalesce((p_settings ->> 'hdmiCecEnabled')::boolean, false);
  desired_local_wake boolean := coalesce((p_settings ->> 'localWakeEnabled')::boolean, false);
  period jsonb;
  exception jsonb;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'screen automation requires tenant.screen.manage' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1 from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.id = p_screen_id
      and screen.status <> 'disabled'
      and screen.deleted_at is null
  ) then
    raise exception 'screen automation screen relation is invalid' using errcode = '23503';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'screen automation settings must be an object' using errcode = '23514';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names timezone
    where timezone.name = desired_timezone
  ) then
    raise exception 'screen automation timezone is unsupported' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_settings -> 'periods', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_settings -> 'periods', '[]'::jsonb)) > 56
    or jsonb_typeof(coalesce(p_settings -> 'exceptions', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_settings -> 'exceptions', '[]'::jsonb)) > 366
  then
    raise exception 'screen automation schedule collection is invalid' using errcode = '23514';
  end if;
  if desired_hdmi and not desired_local_wake then
    raise exception 'HDMI-CEC requires local wake' using errcode = '23514';
  end if;
  if desired_local_wake
    and not coalesce((p_settings ->> 'startupEnabled')::boolean, false)
  then
    raise exception 'local wake requires automatic startup' using errcode = '23514';
  end if;

  select settings.* into current_settings
  from public.screen_automation_settings settings
  where settings.tenant_id = p_tenant_id and settings.screen_id = p_screen_id
  for update;

  if current_settings.screen_id is not null
    and coalesce(p_expected_revision, 0) <> current_settings.revision
  then
    raise exception 'screen automation revision conflict' using errcode = '40001';
  end if;
  if current_settings.screen_id is null and coalesce(p_expected_revision, 0) <> 0 then
    raise exception 'screen automation revision conflict' using errcode = '40001';
  end if;
  if desired_hdmi
    and current_settings.accepted_hdmi_cec_disclaimer_at is null
    and not coalesce(p_accept_hdmi_cec_disclaimer, false)
  then
    raise exception 'HDMI-CEC disclaimer acceptance is required' using errcode = '23514';
  end if;

  next_revision := coalesce(current_settings.revision, 0) + 1;
  insert into public.screen_automation_settings (
    tenant_id, screen_id, revision, enabled, timezone_name, schedule_mode,
    startup_enabled, local_wake_enabled, hdmi_cec_enabled,
    keep_awake_enabled, wake_lead_minutes, restore_after_reboot,
    offline_execution_enabled, temporary_override, temporary_override_until,
    accepted_hdmi_cec_disclaimer_at, accepted_hdmi_cec_disclaimer_by,
    created_by, updated_by
  ) values (
    p_tenant_id, p_screen_id, next_revision,
    coalesce((p_settings ->> 'enabled')::boolean, false),
    desired_timezone,
    coalesce(nullif(p_settings ->> 'scheduleMode', ''), 'weekly'),
    coalesce((p_settings ->> 'startupEnabled')::boolean, false),
    desired_local_wake,
    desired_hdmi,
    coalesce((p_settings ->> 'keepAwakeEnabled')::boolean, true),
    coalesce((p_settings ->> 'wakeLeadMinutes')::integer, 5),
    coalesce((p_settings ->> 'restoreAfterReboot')::boolean, true),
    coalesce((p_settings ->> 'offlineExecutionEnabled')::boolean, true),
    coalesce(nullif(p_settings ->> 'temporaryOverride', ''), 'none'),
    nullif(p_settings ->> 'temporaryOverrideUntil', '')::timestamptz,
    case
      when current_settings.accepted_hdmi_cec_disclaimer_at is not null
        then current_settings.accepted_hdmi_cec_disclaimer_at
      when desired_hdmi and p_accept_hdmi_cec_disclaimer then now()
      else null
    end,
    case
      when current_settings.accepted_hdmi_cec_disclaimer_by is not null
        then current_settings.accepted_hdmi_cec_disclaimer_by
      when desired_hdmi and p_accept_hdmi_cec_disclaimer then actor_id
      else null
    end,
    coalesce(current_settings.created_by, actor_id),
    actor_id
  )
  on conflict (screen_id) do update set
    revision = excluded.revision,
    enabled = excluded.enabled,
    timezone_name = excluded.timezone_name,
    schedule_mode = excluded.schedule_mode,
    startup_enabled = excluded.startup_enabled,
    local_wake_enabled = excluded.local_wake_enabled,
    hdmi_cec_enabled = excluded.hdmi_cec_enabled,
    keep_awake_enabled = excluded.keep_awake_enabled,
    wake_lead_minutes = excluded.wake_lead_minutes,
    restore_after_reboot = excluded.restore_after_reboot,
    offline_execution_enabled = excluded.offline_execution_enabled,
    temporary_override = excluded.temporary_override,
    temporary_override_until = excluded.temporary_override_until,
    accepted_hdmi_cec_disclaimer_at = excluded.accepted_hdmi_cec_disclaimer_at,
    accepted_hdmi_cec_disclaimer_by = excluded.accepted_hdmi_cec_disclaimer_by,
    updated_by = actor_id;

  delete from public.screen_automation_periods
  where tenant_id = p_tenant_id and screen_id = p_screen_id;
  for period in
    select value from jsonb_array_elements(coalesce(p_settings -> 'periods', '[]'::jsonb))
  loop
    if jsonb_typeof(period) <> 'object'
      or coalesce((period ->> 'weekday')::integer, 0) not between 1 and 7
      or coalesce(period ->> 'startLocalTime', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(period ->> 'endLocalTime', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      or period ->> 'startLocalTime' = period ->> 'endLocalTime'
    then
      raise exception 'screen automation period is invalid' using errcode = '23514';
    end if;
    insert into public.screen_automation_periods (
      tenant_id, screen_id, weekday, start_local_time, end_local_time, enabled
    ) values (
      p_tenant_id, p_screen_id, (period ->> 'weekday')::smallint,
      (period ->> 'startLocalTime')::time,
      (period ->> 'endLocalTime')::time,
      coalesce((period ->> 'enabled')::boolean, true)
    );
  end loop;
  if private.screen_automation_periods_overlap(p_tenant_id, p_screen_id) then
    raise exception 'screen automation periods overlap' using errcode = '23514';
  end if;

  delete from public.screen_automation_exceptions
  where tenant_id = p_tenant_id and screen_id = p_screen_id;
  for exception in
    select value from jsonb_array_elements(coalesce(p_settings -> 'exceptions', '[]'::jsonb))
  loop
    if jsonb_typeof(exception) <> 'object'
      or coalesce(exception ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(exception ->> 'mode', '') not in ('closed', 'open')
      or (
        exception ->> 'mode' = 'open'
        and (
          coalesce(exception ->> 'startLocalTime', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or coalesce(exception ->> 'endLocalTime', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or exception ->> 'startLocalTime' = exception ->> 'endLocalTime'
        )
      )
      or (
        exception ->> 'mode' = 'closed'
        and (
          nullif(exception ->> 'startLocalTime', '') is not null
          or nullif(exception ->> 'endLocalTime', '') is not null
        )
      )
      or length(coalesce(exception ->> 'reason', '')) > 160
    then
      raise exception 'screen automation exception is invalid' using errcode = '23514';
    end if;
    insert into public.screen_automation_exceptions (
      tenant_id, screen_id, local_date, mode,
      start_local_time, end_local_time, reason
    ) values (
      p_tenant_id, p_screen_id, (exception ->> 'date')::date,
      exception ->> 'mode',
      nullif(exception ->> 'startLocalTime', '')::time,
      nullif(exception ->> 'endLocalTime', '')::time,
      nullif(btrim(exception ->> 'reason'), '')
    );
  end loop;
  if private.screen_automation_exceptions_overlap(p_tenant_id, p_screen_id) then
    raise exception 'screen automation exceptions overlap' using errcode = '23514';
  end if;

  perform private.audit_event(
    p_tenant_id,
    'screen.automation_updated',
    'screen_automation_settings',
    p_screen_id,
    'success',
    jsonb_build_object(
      'revision', next_revision,
      'enabled', coalesce((p_settings ->> 'enabled')::boolean, false),
      'hdmiCecEnabled', desired_hdmi
    )
  );
  if desired_hdmi
    and current_settings.accepted_hdmi_cec_disclaimer_at is null
    and p_accept_hdmi_cec_disclaimer
  then
    perform private.audit_event(
      p_tenant_id,
      'screen.automation_hdmi_cec_disclaimer_accepted',
      'screen_automation_settings',
      p_screen_id,
      'success',
      jsonb_build_object('revision', next_revision)
    );
  end if;
  return jsonb_build_object('ok', true, 'revision', next_revision);
end;
$$;

create or replace function public.request_screen_automation_test_v1(
  p_tenant_id uuid,
  p_screen_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  device_record public.player_devices%rowtype;
  command_id uuid;
begin
  if actor_id is null or not private.can_manage_screens(p_tenant_id) then
    raise exception 'screen automation test requires tenant.screen.manage' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select device.* into device_record
  from public.player_devices device
  where device.tenant_id = p_tenant_id
    and device.screen_id = p_screen_id
    and device.status = 'paired'
  order by device.paired_at desc
  limit 1;
  if device_record.id is null then
    raise exception 'screen automation device is not paired' using errcode = '23503';
  end if;
  if not coalesce((device_record.capabilities ->> 'supportsScheduledWake')::boolean, false) then
    raise exception 'screen automation device is unsupported or stale' using errcode = '0A000';
  end if;
  if device_record.last_seen_at is null or device_record.last_seen_at < now() - interval '2 minutes' then
    raise exception 'screen automation device is offline' using errcode = '55000';
  end if;
  update public.screen_automation_commands
  set status = 'expired', completed_at = now(), result_code = 'SUPERSEDED'
  where tenant_id = p_tenant_id
    and screen_id = p_screen_id
    and status in ('requested', 'received', 'wake_requested', 'player_started');
  insert into public.screen_automation_commands (
    tenant_id, screen_id, device_id, command_type,
    requested_by, expires_at
  ) values (
    p_tenant_id, p_screen_id, device_record.id, 'wake_test',
    actor_id, now() + interval '5 minutes'
  ) returning id into command_id;
  perform private.audit_event(
    p_tenant_id,
    'screen.automation_test_requested',
    'screen_automation_commands',
    command_id,
    'success',
    jsonb_build_object('screenId', p_screen_id, 'expiresInSeconds', 300)
  );
  return command_id;
end;
$$;

create or replace function public.sync_player_automation_v1(
  p_token_hash text,
  p_report jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
  settings_record public.screen_automation_settings%rowtype;
  command_record public.screen_automation_commands%rowtype;
  report_command_id uuid;
  report_event_type text;
  report_status text;
  report_diagnostic_code text;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'device token hash must be sha256' using errcode = '23514';
  end if;
  select device.* into device_record
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id and screen.id = device.screen_id
  where device.token_hash = p_token_hash
    and device.status = 'paired'
    and screen.status <> 'disabled'
    and screen.deleted_at is null
  for update of device;
  if device_record.id is null then
    raise exception 'screen automation device is unauthorized' using errcode = '42501';
  end if;

  update public.screen_automation_commands
  set status = 'expired', completed_at = now(), result_code = 'COMMAND_EXPIRED'
  where tenant_id = device_record.tenant_id
    and device_id = device_record.id
    and expires_at <= now()
    and status in ('requested', 'received', 'wake_requested', 'player_started');

  if p_report is not null then
    if jsonb_typeof(p_report) <> 'object'
      or octet_length(p_report::text) > 8192
    then
      raise exception 'screen automation report is invalid' using errcode = '23514';
    end if;
    report_event_type := p_report ->> 'eventType';
    report_status := p_report ->> 'status';
    report_diagnostic_code := nullif(p_report ->> 'diagnosticCode', '');
    report_command_id := nullif(p_report ->> 'commandId', '')::uuid;
    if nullif(p_report ->> 'eventId', '') is null
      or (p_report ->> 'eventId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or report_event_type not in (
      'automation-config-received', 'automation-config-stored', 'command-received',
      'schedule-evaluated', 'wake-scheduled', 'wake-triggered',
      'activity-start-requested', 'player-visible', 'keep-awake-enabled',
      'keep-awake-disabled', 'heartbeat-sent', 'execution-failed'
    )
      or report_status not in ('success', 'warning', 'failed')
      or (
        report_diagnostic_code is not null
        and report_diagnostic_code !~ '^[A-Z0-9_]{1,100}$'
      )
      or jsonb_typeof(coalesce(p_report -> 'metadata', '{}'::jsonb)) <> 'object'
    then
      raise exception 'screen automation report fields are invalid' using errcode = '23514';
    end if;
    if report_command_id is not null and not exists (
      select 1 from public.screen_automation_commands command
      where command.tenant_id = device_record.tenant_id
        and command.device_id = device_record.id
        and command.id = report_command_id
    ) then
      raise exception 'screen automation command relation is invalid' using errcode = '23503';
    end if;
    insert into public.screen_automation_events (
      tenant_id, screen_id, device_id, command_id, client_event_id, event_type,
      scheduled_for, occurred_at, status, diagnostic_code, metadata
    ) values (
      device_record.tenant_id, device_record.screen_id, device_record.id,
      report_command_id, (p_report ->> 'eventId')::uuid, report_event_type,
      nullif(p_report ->> 'scheduledFor', '')::timestamptz,
      coalesce(nullif(p_report ->> 'occurredAt', '')::timestamptz, now()),
      report_status, report_diagnostic_code,
      coalesce(p_report -> 'metadata', '{}'::jsonb)
    )
    on conflict (tenant_id, device_id, client_event_id) do nothing;
    if report_command_id is not null then
      update public.screen_automation_commands
      set
        status = case
          when report_event_type = 'execution-failed' then 'failed'
          when report_event_type = 'heartbeat-sent' then 'heartbeat_received'
          when report_event_type = 'player-visible' then 'player_started'
          when report_event_type in ('wake-triggered', 'activity-start-requested')
            then 'wake_requested'
          else status
        end,
        wake_requested_at = case
          when report_event_type in ('wake-triggered', 'activity-start-requested')
            then now()
          else wake_requested_at
        end,
        player_started_at = case
          when report_event_type = 'player-visible' then now()
          else player_started_at
        end,
        completed_at = case
          when report_event_type in ('heartbeat-sent', 'execution-failed') then now()
          else completed_at
        end,
        result_code = case
          when report_event_type = 'execution-failed'
            then coalesce(report_diagnostic_code, 'EXECUTION_FAILED')
          when report_event_type = 'heartbeat-sent'
            then coalesce(report_diagnostic_code, 'PLAYER_HEARTBEAT_CONFIRMED')
          else result_code
        end
      where tenant_id = device_record.tenant_id
        and device_id = device_record.id
        and id = report_command_id
        and status not in ('heartbeat_received', 'expired', 'failed');
    end if;
  end if;

  select settings.* into settings_record
  from public.screen_automation_settings settings
  where settings.tenant_id = device_record.tenant_id
    and settings.screen_id = device_record.screen_id;

  select command.* into command_record
  from public.screen_automation_commands command
  where command.tenant_id = device_record.tenant_id
    and command.device_id = device_record.id
    and command.expires_at > now()
    and command.status in ('requested', 'received')
  order by command.requested_at
  limit 1
  for update;
  if command_record.id is not null and command_record.status = 'requested' then
    update public.screen_automation_commands
    set status = 'received', received_at = now()
    where id = command_record.id;
    command_record.status := 'received';
    command_record.received_at := now();
  end if;

  return jsonb_build_object(
    'settings',
    case when settings_record.screen_id is null then null else jsonb_build_object(
      'schemaVersion', settings_record.schema_version,
      'screenId', settings_record.screen_id,
      'revision', settings_record.revision,
      'enabled', settings_record.enabled,
      'timezone', settings_record.timezone_name,
      'scheduleMode', settings_record.schedule_mode,
      'startupEnabled', settings_record.startup_enabled,
      'localWakeEnabled', settings_record.local_wake_enabled,
      'hdmiCecEnabled', settings_record.hdmi_cec_enabled,
      'keepAwakeEnabled', settings_record.keep_awake_enabled,
      'wakeLeadMinutes', settings_record.wake_lead_minutes,
      'restoreAfterReboot', settings_record.restore_after_reboot,
      'offlineExecutionEnabled', settings_record.offline_execution_enabled,
      'temporaryOverride', settings_record.temporary_override,
      'temporaryOverrideUntil', settings_record.temporary_override_until,
      'acceptedHdmiCecDisclaimerAt', settings_record.accepted_hdmi_cec_disclaimer_at,
      'acceptedHdmiCecDisclaimerBy', settings_record.accepted_hdmi_cec_disclaimer_by,
      'periods', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', period.id,
          'weekday', period.weekday,
          'startLocalTime', to_char(period.start_local_time, 'HH24:MI'),
          'endLocalTime', to_char(period.end_local_time, 'HH24:MI'),
          'enabled', period.enabled
        ) order by period.weekday, period.start_local_time), '[]'::jsonb)
        from public.screen_automation_periods period
        where period.tenant_id = settings_record.tenant_id
          and period.screen_id = settings_record.screen_id
      ),
      'exceptions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', exception.id,
          'date', exception.local_date,
          'mode', exception.mode,
          'startLocalTime', case when exception.start_local_time is null
            then null else to_char(exception.start_local_time, 'HH24:MI') end,
          'endLocalTime', case when exception.end_local_time is null
            then null else to_char(exception.end_local_time, 'HH24:MI') end,
          'reason', exception.reason
        ) order by exception.local_date, exception.start_local_time), '[]'::jsonb)
        from public.screen_automation_exceptions exception
        where exception.tenant_id = settings_record.tenant_id
          and exception.screen_id = settings_record.screen_id
      ),
      'syncedAt', now(),
      'cacheValidUntil', now() + interval '7 days'
    ) end,
    'command',
    case when command_record.id is null then null else jsonb_build_object(
      'id', command_record.id,
      'commandType', command_record.command_type,
      'status', command_record.status,
      'requestedAt', command_record.requested_at,
      'expiresAt', command_record.expires_at
    ) end
  );
end;
$$;

revoke all on function private.screen_automation_periods_overlap(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.screen_automation_exceptions_overlap(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.save_screen_automation_v1(uuid, uuid, bigint, jsonb, boolean)
from public, anon;
revoke all on function public.request_screen_automation_test_v1(uuid, uuid)
from public, anon;
revoke all on function public.sync_player_automation_v1(text, jsonb)
from public;

grant execute on function public.save_screen_automation_v1(uuid, uuid, bigint, jsonb, boolean)
to authenticated;
grant execute on function public.request_screen_automation_test_v1(uuid, uuid)
to authenticated;
grant execute on function public.sync_player_automation_v1(text, jsonb)
to anon, authenticated;
