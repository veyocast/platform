begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(67);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
  (
    '00000000-0000-4000-8000-000000001391',
    'authenticated',
    'authenticated',
    'feature-platform-admin@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001392',
    'authenticated',
    'authenticated',
    'feature-tenant-a-owner@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001393',
    'authenticated',
    'authenticated',
    'feature-tenant-b-owner@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001394',
    'authenticated',
    'authenticated',
    'feature-platform-viewer@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000001391', 'Feature platform admin'),
  ('00000000-0000-4000-8000-000000001392', 'Feature tenant A owner'),
  ('00000000-0000-4000-8000-000000001393', 'Feature tenant B owner'),
  ('00000000-0000-4000-8000-000000001394', 'Feature platform viewer');

insert into public.platform_memberships(user_id, role) values
  ('00000000-0000-4000-8000-000000001391', 'platform_admin'),
  ('00000000-0000-4000-8000-000000001394', 'platform_viewer');

insert into public.tenants(id, name, slug, status) values
  (
    '10000000-0000-4000-8000-000000001391',
    'Feature tenant A',
    's139-feature-tenant-a',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000001392',
    'Feature tenant B',
    's139-feature-tenant-b',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000001393',
    'Feature tenant paused',
    's139-feature-tenant-paused',
    'paused'
  ),
  (
    '10000000-0000-4000-8000-000000001394',
    'S139 Vector compatibility',
    's139-vector-compatibility',
    'active'
  );

insert into public.tenant_memberships(tenant_id, user_id, role) values
  (
    '10000000-0000-4000-8000-000000001391',
    '00000000-0000-4000-8000-000000001392',
    'tenant_owner'
  ),
  (
    '10000000-0000-4000-8000-000000001392',
    '00000000-0000-4000-8000-000000001393',
    'tenant_owner'
  );

create temporary table s139_feature_results (
  name text primary key,
  payload jsonb not null
);
grant select, insert on s139_feature_results to authenticated;

select is(
  (select count(*) from private.tenant_feature_flag_definitions),
  25::bigint,
  'every existing tenant feature key has a canonical definition'
);
select ok(
  not exists (
    select 1
    from private.tenant_feature_flag_definitions
    where kill_switch_active
  ),
  'all global feature kill switches are off by default'
);
select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_catalog.pg_class
    where oid = any(array[
      'private.tenant_feature_flag_definitions'::regclass,
      'private.tenant_feature_flag_command_receipts'::regclass
    ])
  ),
  'private feature policy and receipts force default-deny RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.tenant_feature_flag_definitions',
    'SELECT'
  ),
  'authenticated clients cannot read private feature policy directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.tenant_feature_flag_command_receipts',
    'SELECT'
  ),
  'authenticated clients cannot read private idempotency receipts directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.set_tenant_feature_flag_v2(uuid,text,boolean,text,bigint,uuid)',
    'execute'
  ),
  'anonymous clients cannot execute the rollout command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.set_tenant_feature_flag_v2(uuid,text,boolean,text,bigint,uuid)',
    'execute'
  ),
  'authenticated platform actors can reach the guarded rollout command'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.set_tenant_feature_flag_v2(uuid,text,boolean,text,bigint,uuid)',
    'execute'
  ),
  'service workers cannot impersonate a human cohort decision'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.set_tenant_feature_flag_v1(uuid,text,boolean,text)',
    'execute'
  ) and not has_function_privilege(
    'anon',
    'public.set_tenant_feature_flag_v1(uuid,text,boolean,text)',
    'execute'
  ) and not has_function_privilege(
    'service_role',
    'public.set_tenant_feature_flag_v1(uuid,text,boolean,text)',
    'execute'
  ),
  'legacy v1 remains authenticated-compatible but cannot be called by workers'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_ledscores_feature_effective_state_v1(uuid)',
    'execute'
  ) and not has_function_privilege(
    'anon',
    'public.get_ledscores_feature_effective_state_v1(uuid)',
    'execute'
  ) and not has_function_privilege(
    'service_role',
    'public.get_ledscores_feature_effective_state_v1(uuid)',
    'execute'
  ),
  'only authenticated actors can reach the guarded effective-state read model'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.ledscores_feature_enabled(uuid)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'private.ledscores_feature_enabled(uuid)',
    'execute'
  ),
  'the unrestricted LED Scores resolver remains service-role only'
);
select is(
  (
    select count(*)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'ledscores_realtime'
  ),
  0::bigint,
  'LED Scores remains off when no tenant decision exists'
);
select is(
  private.ledscores_feature_enabled_for_actor(
    '10000000-0000-4000-8000-000000001391'
  ),
  false,
  'the tenant-scoped LED Scores resolver defaults to off'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001391',
  true
);
select ok(
  public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001391'
  ) @> '{
      "flagKey":"ledscores_realtime",
      "definitionAvailable":true,
      "killSwitchActive":false,
      "configuredEnabled":false,
      "enabled":false,
      "revision":0
    }'::jsonb,
  'the platform read model reports the canonical default as effectively off'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001394',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);
select ok(
  public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001391'
  ) @> '{
      "flagKey":"ledscores_realtime",
      "definitionAvailable":true,
      "configuredEnabled":false,
      "enabled":false,
      "revision":0
    }'::jsonb,
  'a platform viewer can read the LED Scores effective-state model'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Platform viewer mag legacy featurevrijgave nooit uitvoeren'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'a platform viewer cannot mutate through legacy v1'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Platform viewer mag featurevrijgave v2 nooit uitvoeren',
    0,
    '20000000-0000-4000-8000-000000001407'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'a platform viewer cannot mutate through v2'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001392',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Tenant owner probeert zichzelf aan de pilot toe te voegen',
    0,
    '20000000-0000-4000-8000-000000001391'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'a tenant owner cannot self-enable LED Scores'
);
select ok(
  public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001391'
  ) @> '{
      "flagKey":"ledscores_realtime",
      "definitionAvailable":true,
      "configuredEnabled":false,
      "enabled":false,
      "revision":0
    }'::jsonb,
  'a tenant owner can read the own tenant effective LED Scores state'
);
select throws_ok(
  $$select public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001392'
  )$$,
  '42501',
  'feature rollout read permission required',
  'a tenant owner cannot read another tenant effective LED Scores state'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Legacy tenant owner mag voor de tenantlock niet worden toegelaten'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'legacy v1 authorizes before acquiring tenant locks'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001391',
  true
);
select set_config('request.jwt.claim.aal', 'aal1', true);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Gecontroleerde LED Scores pilot met verificatiepad',
    0,
    '20000000-0000-4000-8000-000000001392'
  )$$,
  '42501',
  'sensitive command requires aal2',
  'a platform admin must use AAL2'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Legacy platformwijziging vereist eveneens recente AAL2'
  )$$,
  '42501',
  'sensitive command requires aal2',
  'legacy v1 enforces AAL2 before acquiring tenant locks'
);

select set_config('request.jwt.claim.aal', 'aal2', true);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'kort',
    0,
    '20000000-0000-4000-8000-000000001393'
  )$$,
  '23514',
  'feature rollout input is invalid',
  'a short rollout reason is rejected safely'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'unknown_feature',
    true,
    'Onbekende feature hoort geen tenantbesluit te krijgen',
    0,
    '20000000-0000-4000-8000-000000001394'
  )$$,
  '42704',
  'feature definition is unavailable',
  'an unknown feature key is rejected as a missing definition'
);

reset role;
delete from private.tenant_feature_flag_definitions
where flag_key = 'screen_health_view';
set local role authenticated;
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'screen_health_view',
    true,
    'Ontbrekende seed moet herkenbaar en fail-closed blijven',
    0,
    '20000000-0000-4000-8000-000000001395'
  )$$,
  '42704',
  'feature definition is unavailable',
  'a missing canonical feature seed is detected'
);
reset role;
insert into private.tenant_feature_flag_definitions(flag_key)
values ('screen_health_view');

set local role authenticated;
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001393',
    'ledscores_realtime',
    true,
    'Een gepauzeerde tenant mag geen nieuwe vrijgave krijgen',
    0,
    '20000000-0000-4000-8000-000000001396'
  )$$,
  'PT409',
  'tenant is not active',
  'an inactive tenant is locked and rejected'
);

insert into s139_feature_results(name, payload)
select
  'initial',
  public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Pilotcohort Duindorp SV met eigenaar en gecontroleerd verificatiepad',
    0,
    '20000000-0000-4000-8000-000000001397'
  );
select is(
  (select payload ->> 'outcome' from s139_feature_results where name = 'initial'),
  'applied',
  'an AAL2 platform admin can enable LED Scores'
);
select is(
  (select (payload ->> 'revision')::bigint from s139_feature_results where name = 'initial'),
  1::bigint,
  'the first tenant decision starts at revision one'
);
select ok(
  (
    select enabled and revision = 1
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'ledscores_realtime'
  ),
  'the enabled state and revision persist after the command'
);
select is(
  private.ledscores_feature_enabled_for_actor(
    '10000000-0000-4000-8000-000000001391'
  ),
  true,
  'the LED Scores connector resolver becomes available for tenant A'
);
select is(
  (
    select count(*)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001392'
      and flag_key = 'ledscores_realtime'
  ),
  0::bigint,
  'tenant B remains on the canonical off default'
);
select is(
  private.ledscores_feature_enabled_for_actor(
    '10000000-0000-4000-8000-000000001392'
  ),
  false,
  'the resolver remains off for tenant B'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and action = 'tenant.feature_flag.changed'
      and metadata ->> 'flagKey' = 'ledscores_realtime'
  ),
  1::bigint,
  'the first decision creates exactly one audit event'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and actor_user_id = '00000000-0000-4000-8000-000000001391'
      and action = 'tenant.feature_flag.changed'
      and target_type = 'tenant_feature_flags'
      and target_id = '10000000-0000-4000-8000-000000001391'
      and metadata ->> 'flagKey' = 'ledscores_realtime'
      and (metadata ->> 'oldValue')::boolean = false
      and (metadata ->> 'newValue')::boolean = true
      and (metadata ->> 'oldRevision')::bigint = 0
      and (metadata ->> 'newRevision')::bigint = 1
      and metadata ->> 'requestId' = '20000000-0000-4000-8000-000000001397'
      and metadata ->> 'reason' =
        'Pilotcohort Duindorp SV met eigenaar en gecontroleerd verificatiepad'
      and metadata ? 'changedAt'
  ),
  'the audit captures actor, tenant, feature, values, revisions, reason and timestamp'
);

set local role authenticated;
insert into s139_feature_results(name, payload)
select
  'replay',
  public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    true,
    'Pilotcohort Duindorp SV met eigenaar en gecontroleerd verificatiepad',
    0,
    '20000000-0000-4000-8000-000000001397'
  );
select is(
  (select payload from s139_feature_results where name = 'replay'),
  (select payload from s139_feature_results where name = 'initial'),
  'an exact retry returns the byte-equivalent stored result'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and action = 'tenant.feature_flag.changed'
      and metadata ->> 'flagKey' = 'ledscores_realtime'
  ),
  1::bigint,
  'an exact retry creates no duplicate audit event'
);
select is(
  (
    select count(*)
    from private.tenant_feature_flag_command_receipts
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and request_id = '20000000-0000-4000-8000-000000001397'
  ),
  1::bigint,
  'an exact retry keeps one immutable receipt'
);

set local role authenticated;
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    false,
    'Pilotcohort Duindorp SV met eigenaar en gecontroleerd verificatiepad',
    0,
    '20000000-0000-4000-8000-000000001397'
  )$$,
  '23514',
  'request id belongs to another feature rollout command',
  'a request ID reused with different input is rejected'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    false,
    'Uitschakelen met bewust verouderde revisie voor conflicttest',
    0,
    '20000000-0000-4000-8000-000000001398'
  )$$,
  'PT409',
  'feature rollout revision conflict',
  'a stale optimistic-lock revision is rejected'
);

reset role;
select ok(
  (
    select enabled and revision = 1
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'ledscores_realtime'
  ) and (
    select count(*) = 1
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and action = 'tenant.feature_flag.changed'
      and metadata ->> 'flagKey' = 'ledscores_realtime'
  ),
  'a revision conflict leaves state and audit history unchanged'
);

create function private.s139_reject_feature_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.action = 'tenant.feature_flag.changed'
    and new.metadata ->> 'requestId' =
      '20000000-0000-4000-8000-000000001399'
  then
    raise exception 'forced feature audit failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger s139_reject_feature_audit
before insert on public.audit_events
for each row execute function private.s139_reject_feature_audit();

set local role authenticated;
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001391',
    'ledscores_realtime',
    false,
    'Geforceerde auditfout moet de volledige wijziging terugdraaien',
    1,
    '20000000-0000-4000-8000-000000001399'
  )$$,
  'PT500',
  'feature rollout audit could not be stored',
  'an audit failure rejects the whole feature command'
);

reset role;
drop trigger s139_reject_feature_audit on public.audit_events;
drop function private.s139_reject_feature_audit();
select ok(
  (
    select enabled and revision = 1
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'ledscores_realtime'
  ),
  'an audit failure rolls the feature mutation back'
);
select is(
  (
    select count(*)
    from private.tenant_feature_flag_command_receipts
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and request_id = '20000000-0000-4000-8000-000000001399'
  ),
  0::bigint,
  'an audit failure also rolls the command receipt back'
);

update private.tenant_feature_flag_definitions
set kill_switch_active = true
where flag_key = 'ledscores_realtime';
select is(
  private.ledscores_feature_enabled_for_actor(
    '10000000-0000-4000-8000-000000001391'
  ),
  false,
  'the global kill switch makes an existing tenant decision fail closed'
);

set local role authenticated;
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001392',
    'ledscores_realtime',
    true,
    'Globale kill switch moet een nieuwe vrijgave blokkeren',
    0,
    '20000000-0000-4000-8000-000000001401'
  )$$,
  '55000',
  'feature is blocked by the global kill switch',
  'the global kill switch blocks a new enable decision'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001392',
    'ledscores_realtime',
    true,
    'Legacy clients mogen de globale kill switch niet omzeilen'
  )$$,
  '55000',
  'feature is blocked by the global kill switch',
  'legacy v1 cannot bypass the global kill switch'
);
select ok(
  public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001391'
  ) @> '{
      "definitionAvailable":true,
      "killSwitchActive":true,
      "configuredEnabled":true,
      "enabled":false,
      "revision":1
    }'::jsonb,
  'stored true is reported as effectively false while the kill switch is active'
);
select is(
  (
    public.set_tenant_feature_flag_v2(
      '10000000-0000-4000-8000-000000001391',
      'ledscores_realtime',
      false,
      'Veilige uitschakeling blijft toegestaan tijdens de kill switch',
      1,
      '20000000-0000-4000-8000-000000001402'
    ) ->> 'revision'
  )::bigint,
  2::bigint,
  'a disable decision remains possible while the kill switch is active'
);

reset role;
select ok(
  not exists (
    select 1
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001392'
      and flag_key = 'ledscores_realtime'
  ) and not (
    select enabled
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'ledscores_realtime'
  ),
  'the blocked tenant stays off and the explicit disable persists only for tenant A'
);
update private.tenant_feature_flag_definitions
set kill_switch_active = false
where flag_key = 'ledscores_realtime';
select ok(
  not (
    select kill_switch_active
    from private.tenant_feature_flag_definitions
    where flag_key = 'ledscores_realtime'
  ),
  'the test leaves the global LED Scores kill switch off'
);

set local role authenticated;
select is(
  (
    public.set_tenant_feature_flag_v2(
      '10000000-0000-4000-8000-000000001391',
      'ledscores_realtime',
      true,
      'Pilot wordt na herstel van de globale policy opnieuw vrijgegeven',
      2,
      '20000000-0000-4000-8000-000000001403'
    ) ->> 'revision'
  )::bigint,
  3::bigint,
  'tenant A can be re-enabled after the global block is removed'
);
select is(
  private.ledscores_feature_enabled_for_actor(
    '10000000-0000-4000-8000-000000001391'
  ),
  true,
  'the connector resolver is active again only for tenant A'
);
select ok(
  public.get_ledscores_feature_effective_state_v1(
    '10000000-0000-4000-8000-000000001391'
  ) @> '{
      "definitionAvailable":true,
      "killSwitchActive":false,
      "configuredEnabled":true,
      "enabled":true,
      "revision":3
    }'::jsonb,
  'the platform read model reports effective true after policy recovery'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001392',
  true
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v2(
    '10000000-0000-4000-8000-000000001392',
    'ledscores_realtime',
    true,
    'Tenant A eigenaar mag tenant B niet in een pilot plaatsen',
    0,
    '20000000-0000-4000-8000-000000001404'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'a tenant A owner cannot change tenant B feature state'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001391',
  true
);
select is(
  (
    public.set_tenant_feature_flag_v2(
      '10000000-0000-4000-8000-000000001391',
      'venue_twin',
      true,
      'Bestaande niet-LED feature blijft via hetzelfde contract werken',
      0,
      '20000000-0000-4000-8000-000000001405'
    ) ->> 'outcome'
  ),
  'applied',
  'an existing non-LED feature remains compatible with v2'
);
select ok(
  (
    select enabled and revision = 1
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'venue_twin'
  ),
  'the non-LED tenant decision is persisted safely'
);
select lives_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001391',
    'venue_twin',
    false,
    'Legacy Control client schakelt dezelfde bestaande feature veilig uit'
  )$$,
  'legacy v1 remains backward-compatible for existing features'
);
select ok(
  (
    select not enabled and revision = 2
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and flag_key = 'venue_twin'
  ),
  'legacy v1 advances the optimistic-lock revision through v2'
);
select is(
  (
    public.set_tenant_feature_flag_v2(
      '10000000-0000-4000-8000-000000001391',
      'ledscores_realtime',
      true,
      'Een nieuw gelijk besluit verandert de feature niet opnieuw',
      3,
      '20000000-0000-4000-8000-000000001406'
    ) ->> 'outcome'
  ),
  'unchanged',
  'a new no-op decision does not mutate the existing state'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001391'
      and action = 'tenant.feature_flag.changed'
      and metadata ->> 'flagKey' = 'ledscores_realtime'
  ),
  3::bigint,
  'retry, conflict, audit failure and no-op create no duplicate LED decisions'
);

select is(
  private.set_vector_pilot_profile_v1(
    'S139 Vector compatibility',
    true,
    'S139 revision compatibility enable',
    'github:codex',
    'https://github.com/veyocast/platform/actions/runs/13901'
  ) ->> 'changedCount',
  '7',
  'the S124 Vector workflow still inserts its complete pilot profile'
);
select ok(
  (
    select count(*) = 7 and bool_and(revision = 1)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001394'
  ),
  'S124 inserts retain the canonical revision-one default'
);
select is(
  private.set_vector_pilot_profile_v1(
    'S139 Vector compatibility',
    false,
    'S139 revision compatibility disable',
    'github:codex',
    'https://github.com/veyocast/platform/actions/runs/13902'
  ) ->> 'changedCount',
  '7',
  'the S124 Vector workflow still updates its complete pilot profile'
);
select ok(
  (
    select count(*) = 7 and bool_and(revision = 2)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001394'
  ),
  'legacy S124 updates advance every changed flag revision exactly once'
);

update public.tenant_feature_flags
set rollout_reason = 'Direct guarded revision compatibility update'
where tenant_id = '10000000-0000-4000-8000-000000001394'
  and flag_key = 'venue_twin';
select is(
  (
    select revision
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001394'
      and flag_key = 'venue_twin'
  ),
  3::bigint,
  'a direct relevant legacy update advances the row revision'
);

update public.tenant_feature_flags
set updated_at = now()
where tenant_id = '10000000-0000-4000-8000-000000001394'
  and flag_key = 'venue_twin';
select is(
  (
    select revision
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001394'
      and flag_key = 'venue_twin'
  ),
  3::bigint,
  'an update limited to bookkeeping fields does not create a false conflict'
);

select * from finish();
rollback;
