begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001231', 'authenticated', 'authenticated', 'self-service@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{"display_name":"Self service owner"}'::jsonb),
  ('00000000-0000-4000-8000-000000001232', 'authenticated', 'authenticated', 'unconfirmed@veyocast.test', 'test', null, now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001233', 'authenticated', 'authenticated', 'existing-member@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001234', 'authenticated', 'authenticated', 'invalid-input@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001235', 'authenticated', 'authenticated', 'other-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001233', 'Existing member'),
  ('00000000-0000-4000-8000-000000001235', 'Other owner');
insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001233', 'Existing tenant', 's123-existing-tenant'),
  ('10000000-0000-4000-8000-000000001235', 'Other tenant', 's123-other-tenant');
insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001233'),
  ('10000000-0000-4000-8000-000000001235');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001233', '00000000-0000-4000-8000-000000001233', 'tenant_editor'),
  ('10000000-0000-4000-8000-000000001235', '00000000-0000-4000-8000-000000001235', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001231', true);

select is(
  public.provision_self_service_tenant_v1(
    'Vereniging Vooruit', 'vereniging-vooruit', 'sportclub', 'club_communication',
    array['sportlink', 'own-media', 'sportlink'],
    '{"branch":"sportclub","modules":["sportlink","own-media"],"zones":[],"screenCount":2,"version":1}'::jsonb,
    'launch-terms-2026-08-24',
    '70000000-0000-4000-8000-000000001231'
  ) ->> 'created',
  'true',
  'a confirmed user can transactionally claim one tenant'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-000000001231'),
  'Self service owner',
  'provisioning creates the authenticated profile from trusted auth metadata'
);
select is(
  (select membership.role::text
   from public.tenant_memberships membership
   join public.tenants tenant on tenant.id = membership.tenant_id
   where tenant.slug = 'vereniging-vooruit'
     and membership.user_id = '00000000-0000-4000-8000-000000001231'),
  'tenant_owner',
  'the claimant becomes the tenant owner'
);
select is(
  (select count(*)
   from public.tenant_settings settings
   join public.tenants tenant on tenant.id = settings.tenant_id
   where tenant.slug = 'vereniging-vooruit'),
  1::bigint,
  'tenant defaults are created in the same transaction'
);
select is(
  (select terms_version from public.tenant_onboarding_states),
  'launch-terms-2026-08-24',
  'terms evidence is retained with the onboarding state'
);
select is(
  (select count(*) from public.audit_events where action = 'tenant.self_service.provisioned'),
  1::bigint,
  'self-service provisioning writes one attributable audit event'
);
select is(
  public.provision_self_service_tenant_v1(
    'Ignored retry', 'ignored-retry', 'organization', 'internal_communication',
    array[]::text[], '{}'::jsonb, 'different-terms-version',
    '70000000-0000-4000-8000-000000001239'
  ) ->> 'created',
  'false',
  'a retry resumes the existing onboarding instead of creating a second tenant'
);
select is(
  (select count(*) from public.tenant_onboarding_states
   where owner_user_id = '00000000-0000-4000-8000-000000001231'),
  1::bigint,
  'one self-service user owns exactly one onboarding claim'
);
select is(
  (select count(*) from public.tenant_onboarding_states),
  1::bigint,
  'the owner can read the tenant onboarding state'
);

select lives_ok(
  $$select public.update_tenant_onboarding_preferences_v1(
    (select tenant_id from public.tenant_onboarding_states),
    'sportclub', 'club_communication', array['own-media', 'sportlink', 'own-media']
  )$$,
  'the tenant owner can update onboarding preferences through the RPC'
);
select is(
  (select source_keys from public.tenant_onboarding_states),
  array['own-media', 'sportlink']::text[],
  'content source preferences are normalized and deduplicated'
);
select is(
  (select current_step from public.tenant_onboarding_states),
  'screens',
  'saving preferences advances to the screen step'
);

reset role;
insert into public.screens (tenant_id, name, created_by)
select tenant_id, 'Entree', owner_user_id from public.tenant_onboarding_states;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001231', true);
select is(
  (public.refresh_tenant_onboarding_progress_v1(
    (select tenant_id from public.tenant_onboarding_states)
  )).current_step,
  'pairing',
  'progress reconciles against a real active screen'
);

select throws_ok(
  $$insert into public.tenant_onboarding_states (
    tenant_id, owner_user_id, idempotency_key, organization_type, use_case,
    terms_version, terms_accepted_at
  ) values (
    '10000000-0000-4000-8000-000000001235',
    '00000000-0000-4000-8000-000000001235',
    '70000000-0000-4000-8000-000000001235',
    'organization', 'internal_communication', 'fake-terms-version', now()
  )$$,
  '42501',
  'permission denied for table tenant_onboarding_states',
  'authenticated clients cannot insert onboarding state directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001233', true);
select throws_ok(
  $$select public.provision_self_service_tenant_v1(
    'Second tenant', 'second-tenant', 'organization', 'internal_communication',
    array[]::text[], '{}'::jsonb, 'launch-terms-2026-08-24',
    '70000000-0000-4000-8000-000000001233'
  )$$,
  '42501',
  'existing members cannot create a self-service tenant',
  'an existing tenant member cannot claim another self-service tenant'
);
select throws_ok(
  $$select public.update_tenant_onboarding_preferences_v1(
    (select tenant_id from public.tenant_onboarding_states),
    'organization', 'internal_communication', array[]::text[]
  )$$,
  '42501',
  'tenant onboarding management capability required',
  'a cross-tenant editor cannot mutate onboarding preferences'
);
select is(
  (select count(*) from public.tenant_onboarding_states),
  0::bigint,
  'RLS hides another tenant onboarding state'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001232', true);
select throws_ok(
  $$select public.provision_self_service_tenant_v1(
    'Unconfirmed', 'unconfirmed-tenant', 'organization', 'internal_communication',
    array[]::text[], '{}'::jsonb, 'launch-terms-2026-08-24',
    '70000000-0000-4000-8000-000000001232'
  )$$,
  '42501',
  'tenant claim requires a confirmed email address',
  'an unconfirmed email cannot claim a tenant'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001234', true);
select throws_ok(
  $$select public.provision_self_service_tenant_v1(
    'Invalid input', 'invalid-input', 'organization', 'internal_communication',
    array['youtube'], '{}'::jsonb, 'launch-terms-2026-08-24',
    '70000000-0000-4000-8000-000000001234'
  )$$,
  '23514',
  'one or more content sources are unsupported',
  'unsupported content sources fail closed'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.provision_self_service_tenant_v1(
    'Anonymous', 'anonymous-tenant', 'organization', 'internal_communication',
    array[]::text[], '{}'::jsonb, 'launch-terms-2026-08-24',
    '70000000-0000-4000-8000-000000001236'
  )$$,
  '42501',
  'permission denied for function provision_self_service_tenant_v1',
  'anonymous callers cannot execute tenant provisioning'
);

select * from finish();
rollback;
