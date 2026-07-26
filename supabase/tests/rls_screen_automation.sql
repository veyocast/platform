begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000571', 'authenticated', 'authenticated', 'automation-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000572', 'authenticated', 'authenticated', 'automation-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000573', 'authenticated', 'authenticated', 'automation-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000571', 'Automation admin'),
  ('00000000-0000-4000-8000-000000000572', 'Automation viewer'),
  ('00000000-0000-4000-8000-000000000573', 'Other automation admin');

insert into public.tenants (id, name, slug, screen_limit)
values
  ('10000000-0000-4000-8000-000000000571', 'Automation tenant', 'automation-tenant', 4),
  ('10000000-0000-4000-8000-000000000572', 'Other automation tenant', 'other-automation-tenant', 4);

insert into public.tenant_settings (tenant_id, timezone_name)
values
  ('10000000-0000-4000-8000-000000000571', 'Europe/Amsterdam'),
  ('10000000-0000-4000-8000-000000000572', 'Europe/Amsterdam');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000571', '00000000-0000-4000-8000-000000000571', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000000571', '00000000-0000-4000-8000-000000000572', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000572', '00000000-0000-4000-8000-000000000573', 'tenant_admin');

insert into public.screens (id, tenant_id, name, status)
values
  ('30000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571', 'Kantine automation', 'active'),
  ('30000000-0000-4000-8000-000000000572', '10000000-0000-4000-8000-000000000572', 'Andere automation', 'active');

insert into public.player_devices (
  id, tenant_id, screen_id, device_name, token_hash, status,
  app_version, platform, capabilities, last_seen_at
)
values
  (
    '40000000-0000-4000-8000-000000000571',
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    'Google TV kantine', repeat('a', 64), 'paired', '1.1.0',
    'Android TV',
    '{"supportsScheduledWake":true,"supportsLocalSchedule":true}'::jsonb,
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000572',
    '10000000-0000-4000-8000-000000000572',
    '30000000-0000-4000-8000-000000000572',
    'Andere Google TV', repeat('b', 64), 'paired', '1.1.0',
    'Android TV',
    '{"supportsScheduledWake":true,"supportsLocalSchedule":true}'::jsonb,
    now()
  );

select ok(
  bool_and(relrowsecurity and relforcerowsecurity),
  'all automation tables enable and force RLS'
)
from pg_catalog.pg_class
where relname in (
  'screen_automation_settings',
  'screen_automation_periods',
  'screen_automation_exceptions',
  'screen_automation_commands',
  'screen_automation_events'
);

select ok(
  not has_table_privilege('authenticated', 'public.screen_automation_settings', 'INSERT'),
  'browser roles cannot bypass guarded settings RPCs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000571', true);

select is(
  (
    public.save_screen_automation_v1(
      '10000000-0000-4000-8000-000000000571',
      '30000000-0000-4000-8000-000000000571',
      0,
      '{
        "enabled":true,
        "timezone":"Europe/Amsterdam",
        "scheduleMode":"weekly",
        "startupEnabled":true,
        "localWakeEnabled":true,
        "hdmiCecEnabled":false,
        "keepAwakeEnabled":true,
        "wakeLeadMinutes":5,
        "restoreAfterReboot":true,
        "offlineExecutionEnabled":true,
        "temporaryOverride":"none",
        "temporaryOverrideUntil":null,
        "periods":[
          {"weekday":1,"startLocalTime":"07:30","endLocalTime":"23:00","enabled":true},
          {"weekday":5,"startLocalTime":"19:00","endLocalTime":"00:30","enabled":true}
        ],
        "exceptions":[]
      }'::jsonb
    ) ->> 'revision'
  ),
  '1',
  'screen manager saves a versioned weekly automation configuration'
);
select is(
  (select count(*) from public.screen_automation_periods where tenant_id = '10000000-0000-4000-8000-000000000571'),
  2::bigint,
  'weekly periods are replaced atomically'
);
select is(
  (select count(*) from public.audit_events where action = 'screen.automation_updated'),
  1::bigint,
  'settings mutation is audited once'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000572', true);
select is(
  (select count(*) from public.screen_automation_settings),
  1::bigint,
  'tenant viewer can read own automation settings'
);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{"timezone":"Europe/Amsterdam","periods":[],"exceptions":[]}'::jsonb
  )$$,
  '42501',
  'screen automation requires tenant.screen.manage',
  'tenant viewer cannot mutate automation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000573', true);
select is(
  (select count(*) from public.screen_automation_settings),
  0::bigint,
  'another tenant cannot view automation settings'
);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{"timezone":"Europe/Amsterdam","periods":[],"exceptions":[]}'::jsonb
  )$$,
  '42501',
  'screen automation requires tenant.screen.manage',
  'another tenant cannot mutate automation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000571', true);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{
      "enabled":true,"timezone":"Mars/Clubhouse","scheduleMode":"weekly",
      "startupEnabled":true,"localWakeEnabled":true,"hdmiCecEnabled":false,
      "periods":[],"exceptions":[]
    }'::jsonb
  )$$,
  '22023',
  'screen automation timezone is unsupported',
  'unknown timezone is rejected server-side'
);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{
      "enabled":true,"timezone":"Europe/Amsterdam","scheduleMode":"weekly",
      "startupEnabled":true,"localWakeEnabled":true,"hdmiCecEnabled":false,
      "periods":[
        {"weekday":1,"startLocalTime":"07:30","endLocalTime":"12:00"},
        {"weekday":1,"startLocalTime":"11:00","endLocalTime":"13:00"}
      ],"exceptions":[]
    }'::jsonb
  )$$,
  '23514',
  'screen automation periods overlap',
  'overlapping periods are rejected server-side'
);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{
      "enabled":true,"timezone":"Europe/Amsterdam","scheduleMode":"weekly",
      "startupEnabled":true,"localWakeEnabled":true,"hdmiCecEnabled":false,
      "periods":[],"exceptions":[
        {"date":"2026-07-27","mode":"closed"},
        {"date":"2026-07-27","mode":"open","startLocalTime":"10:00","endLocalTime":"12:00"}
      ]
    }'::jsonb
  )$$,
  '23514',
  'screen automation exceptions overlap',
  'closure and opening on one date are rejected'
);
select throws_ok(
  $$select public.save_screen_automation_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571',
    1,
    '{
      "enabled":true,"timezone":"Europe/Amsterdam","scheduleMode":"weekly",
      "startupEnabled":true,"localWakeEnabled":true,"hdmiCecEnabled":true,
      "periods":[],"exceptions":[]
    }'::jsonb,
    false
  )$$,
  '23514',
  'HDMI-CEC disclaimer acceptance is required',
  'HDMI-CEC cannot be enabled without explicit acceptance'
);

select is(
  (
    public.save_screen_automation_v1(
      '10000000-0000-4000-8000-000000000571',
      '30000000-0000-4000-8000-000000000571',
      1,
      '{
        "enabled":true,"timezone":"Europe/Amsterdam","scheduleMode":"always",
        "startupEnabled":true,"localWakeEnabled":true,"hdmiCecEnabled":true,
        "keepAwakeEnabled":true,"wakeLeadMinutes":5,
        "restoreAfterReboot":true,"offlineExecutionEnabled":true,
        "temporaryOverride":"none","temporaryOverrideUntil":null,
        "periods":[],"exceptions":[]
      }'::jsonb,
      true
    ) ->> 'revision'
  ),
  '2',
  'always-active mode and first disclaimer acceptance save atomically'
);
select ok(
  (select accepted_hdmi_cec_disclaimer_at is not null and accepted_hdmi_cec_disclaimer_by = '00000000-0000-4000-8000-000000000571'
   from public.screen_automation_settings
   where screen_id = '30000000-0000-4000-8000-000000000571'),
  'disclaimer actor and timestamp are retained'
);
select is(
  (select count(*) from public.audit_events where action = 'screen.automation_hdmi_cec_disclaimer_accepted'),
  1::bigint,
  'first disclaimer acceptance is audited exactly once'
);

create temporary table automation_test_command as
select public.request_screen_automation_test_v1(
  '10000000-0000-4000-8000-000000000571',
  '30000000-0000-4000-8000-000000000571'
) as id;
grant select on automation_test_command to anon;

select is(
  (select status from public.screen_automation_commands where id = (select id from automation_test_command)),
  'requested',
  'online supported device receives a bounded test command'
);
select is(
  (select count(*) from public.audit_events where action = 'screen.automation_test_requested'),
  1::bigint,
  'test command is audited once'
);

reset role;
set local role anon;
select is(
  (
    public.sync_player_automation_v1(repeat('a', 64), null)
    #>> '{settings,scheduleMode}'
  ),
  'always',
  'paired device receives only its versioned automation configuration'
);
select is(
  (
    public.sync_player_automation_v1(repeat('a', 64), null)
    #>> '{command,status}'
  ),
  'received',
  'heartbeat polling acknowledges command delivery'
);

select lives_ok(
  format(
    $$select public.sync_player_automation_v1(
      repeat('a', 64),
      '{"eventId":"50000000-0000-4000-8000-000000000571","commandId":"%s","eventType":"player-visible","occurredAt":"2026-07-26T19:00:00Z","scheduledFor":null,"status":"success","diagnosticCode":"ACTIVITY_RESUMED","metadata":{}}'::jsonb
    )$$,
    (select id from automation_test_command)
  ),
  'device reports Player visibility with a safe idempotency key'
);
select lives_ok(
  format(
    $$select public.sync_player_automation_v1(
      repeat('a', 64),
      '{"eventId":"50000000-0000-4000-8000-000000000571","commandId":"%s","eventType":"player-visible","occurredAt":"2026-07-26T19:00:00Z","scheduledFor":null,"status":"success","diagnosticCode":"ACTIVITY_RESUMED","metadata":{}}'::jsonb
    )$$,
    (select id from automation_test_command)
  ),
  'duplicate device report is idempotent'
);
reset role;
select is(
  (select count(*) from public.screen_automation_events where client_event_id = '50000000-0000-4000-8000-000000000571'),
  1::bigint,
  'idempotency key writes exactly one execution event'
);
set local role anon;
select lives_ok(
  format(
    $$select public.sync_player_automation_v1(
      repeat('a', 64),
      '{"eventId":"50000000-0000-4000-8000-000000000572","commandId":"%s","eventType":"heartbeat-sent","occurredAt":"2026-07-26T19:00:30Z","scheduledFor":null,"status":"success","diagnosticCode":"PLAYER_HEARTBEAT_CONFIRMED","metadata":{}}'::jsonb
    )$$,
    (select id from automation_test_command)
  ),
  'subsequent heartbeat confirms only the Player runtime'
);
reset role;
select is(
  (select status from public.screen_automation_commands where id = (select id from automation_test_command)),
  'heartbeat_received',
  'command ends in heartbeat received without a physical-TV success claim'
);
set local role anon;
select throws_ok(
  $$select public.sync_player_automation_v1(repeat('c', 64), null)$$,
  '42501',
  'screen automation device is unauthorized',
  'unknown or revoked token receives no automation data'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000571', true);
update public.player_devices
set last_seen_at = now() - interval '10 minutes'
where id = '40000000-0000-4000-8000-000000000571';
select throws_ok(
  $$select public.request_screen_automation_test_v1(
    '10000000-0000-4000-8000-000000000571',
    '30000000-0000-4000-8000-000000000571'
  )$$,
  '55000',
  'screen automation device is offline',
  'offline device cannot be presented as remotely wakeable'
);

select * from finish();
rollback;
