begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into public.tenants (id, name, slug, status)
values
  ('10000000-0000-4000-8000-000000001241', 'S124 Pilotvereniging', 's124-vector-pilot', 'active'),
  ('10000000-0000-4000-8000-000000001242', 'S124 Gepauzeerd', 's124-vector-paused', 'paused');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000001241'),
  ('10000000-0000-4000-8000-000000001242');

select ok(
  not has_function_privilege(
    'anon',
    'private.set_vector_pilot_profile_v1(text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the Vector pilot command'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.set_vector_pilot_profile_v1(text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'tenant users cannot execute the Vector pilot command'
);

select ok(
  not has_function_privilege(
    'service_role',
    'private.set_vector_pilot_profile_v1(text,boolean,text,text,text)',
    'EXECUTE'
  ),
  'the Data API service role cannot execute the Vector pilot command'
);

select throws_ok(
  $$select private.set_vector_pilot_profile_v1(
    'S124 Pilotvereniging', true, 'te kort', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12401'
  )$$,
  '22023',
  'pilot rollout reason is invalid',
  'an attributable rollout reason is required'
);

select throws_ok(
  $$select private.set_vector_pilot_profile_v1(
    'S124 Pilotvereniging', true, 'S124 gecontroleerde Vector pilot', 'handmatig',
    'https://github.com/veyocast/platform/actions/runs/12402'
  )$$,
  '22023',
  'pilot rollout operator is invalid',
  'only the protected GitHub workflow actor shape is accepted'
);

select throws_ok(
  $$select private.set_vector_pilot_profile_v1(
    'Onbekende vereniging', true, 'S124 gecontroleerde Vector pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12403'
  )$$,
  'P0002',
  'pilot tenant not found',
  'an unknown tenant fails closed'
);

select throws_ok(
  $$select private.set_vector_pilot_profile_v1(
    'S124 Gepauzeerd', true, 'S124 gecontroleerde Vector pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12404'
  )$$,
  '55000',
  'pilot tenant is not active',
  'a paused tenant cannot enter the pilot'
);

select lives_ok(
  $$select private.set_vector_pilot_profile_v1(
    'S124 Pilotvereniging', true, 'S124 gecontroleerde Vector pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12405'
  )$$,
  'the protected operator can enable the complete pilot profile atomically'
);

select is(
  (
    select count(*)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001241'
  ),
  7::bigint,
  'the pilot profile contains exactly the seven production-ready flags'
);

select ok(
  (
    select bool_and(enabled)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001241'
  ),
  'all core pilot flags are enabled together'
);

select is(
  (
    select count(*)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001241'
      and flag_key = 'youtube_integration'
  ),
  0::bigint,
  'the gated YouTube integration is not silently enabled'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001241'
      and action = 'vector.pilot_profile.updated'
  ),
  1::bigint,
  'the atomic pilot change creates one audit event'
);

select ok(
  (
    select actor_user_id is null
      and metadata ->> 'operator' = 'github:codex'
      and metadata ->> 'reason' = 'S124 gecontroleerde Vector pilot'
      and (metadata ->> 'changedCount')::integer = 7
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001241'
      and action = 'vector.pilot_profile.updated'
  ),
  'the audit record preserves operator, reason and changed flag count'
);

select is(
  private.set_vector_pilot_profile_v1(
    'S124 Pilotvereniging', true, 'S124 gecontroleerde Vector pilot', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12406'
  ) ->> 'changedCount',
  '0',
  'retrying the same desired profile is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001241'
      and action = 'vector.pilot_profile.updated'
  ),
  1::bigint,
  'an idempotent retry does not create a misleading audit event'
);

select lives_ok(
  $$select private.set_vector_pilot_profile_v1(
    'S124 Pilotvereniging', false, 'S124 gecontroleerde Vector rollback', 'github:codex',
    'https://github.com/veyocast/platform/actions/runs/12407'
  )$$,
  'the same command provides an atomic tenant kill switch'
);

select ok(
  (
    select count(*) = 7 and not bool_or(enabled)
    from public.tenant_feature_flags
    where tenant_id = '10000000-0000-4000-8000-000000001241'
  ),
  'rollback keeps explicit profile rows but disables every core flag'
);

select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001241'
      and action = 'vector.pilot_profile.updated'
  ),
  2::bigint,
  'enable and rollback are both auditable'
);

select * from finish();
rollback;
