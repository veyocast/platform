begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

create temporary table s159_expected (
  name text primary key,
  value jsonb not null
);

insert into s159_expected (name, value) values
  (
    'selection',
    '{
      "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
      "modePolicy":{"kind":"fixed","mode":"dark"},
      "accent":"#4169E1",
      "support":"#7A5CE6",
      "categoryOverrides":[]
    }'::jsonb
  ),
  (
    'appearance',
    '{
      "schemaVersion":1,
      "surfaces":{
        "clubLogoBackground":"#FFFFFF",
        "homeLogoBackground":"#FFFFFF"
      },
      "typography":{
        "baseScale":1.05,
        "bodyFontRef":"vc-inter-v1",
        "displayFontRef":"vc-manrope-v1",
        "sportScale":1.4
      }
    }'::jsonb
  ),
  (
    'colors',
    '{
      "fieldflow":{
        "dark":{
          "accent":"#4169E1",
          "accentSoft":"rgba(65, 105, 225, 0.24)",
          "border":"rgba(255, 255, 255, 0.22)",
          "borderSoft":"rgba(255, 255, 255, 0.12)",
          "canvas":"#071538",
          "danger":"#FF8580",
          "divider":"rgba(255, 255, 255, 0.18)",
          "imageOverlayEnd":"rgba(3, 8, 24, 0.10)",
          "imageOverlayMid":"rgba(3, 8, 24, 0.72)",
          "imageOverlayStart":"rgba(3, 8, 24, 0.96)",
          "neutral":"#8697C2",
          "panel":"#10265D",
          "qrInk":"#071538",
          "qrSurface":"#FFFFFF",
          "row":"#0C2257",
          "rowSelected":"#2447C7",
          "shadow":"rgba(0, 0, 0, 0.42)",
          "success":"#58D99A",
          "surface":"#3154D4",
          "surfaceRaised":"#2447A8",
          "text":"#FFFFFF",
          "textFaint":"rgba(255, 255, 255, 0.82)",
          "textMuted":"#E5EBFF",
          "textOnAccent":"#FFFFFF",
          "textOnSelected":"#FFFFFF",
          "warning":"#FFD078"
        },
        "light":{
          "accent":"#4169E1",
          "accentSoft":"rgba(65, 105, 225, 0.22)",
          "border":"rgba(255, 255, 255, 0.28)",
          "borderSoft":"rgba(255, 255, 255, 0.16)",
          "canvas":"#17327A",
          "danger":"#FF8F88",
          "divider":"rgba(255, 255, 255, 0.22)",
          "imageOverlayEnd":"rgba(4, 12, 36, 0.12)",
          "imageOverlayMid":"rgba(4, 12, 36, 0.68)",
          "imageOverlayStart":"rgba(4, 12, 36, 0.94)",
          "neutral":"#AAB9E3",
          "panel":"#234AAE",
          "qrInk":"#071538",
          "qrSurface":"#FFFFFF",
          "row":"#1E429C",
          "rowSelected":"#3154D4",
          "shadow":"rgba(4, 15, 52, 0.32)",
          "success":"#67D99F",
          "surface":"#365CCB",
          "surfaceRaised":"#2A50B8",
          "text":"#FFFFFF",
          "textFaint":"rgba(255, 255, 255, 0.82)",
          "textMuted":"#F4F7FF",
          "textOnAccent":"#FFFFFF",
          "textOnSelected":"#FFFFFF",
          "warning":"#FFD27A"
        },
        "mode":"dark"
      }
    }'::jsonb
  );

select ok(
  has_function_privilege(
    current_user,
    'private.reset_tenant_fieldflow_royal_v1(text,text,text,text)',
    'EXECUTE'
  ),
  'the database owner can execute the guarded reset'
);

select ok(
  not has_function_privilege(
    'public',
    'private.reset_tenant_fieldflow_royal_v1(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.reset_tenant_fieldflow_royal_v1(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.reset_tenant_fieldflow_royal_v1(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.reset_tenant_fieldflow_royal_v1(text,text,text,text)',
    'EXECUTE'
  ),
  'public API roles cannot execute the owner-only reset'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid)',
    'EXECUTE'
  ),
  'the runtime wrappers remain private implementation details'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    ' padded tenant ', 'A sufficiently long reason', 'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15901'
  )$$,
  '22023',
  null,
  'tenant names must be exact and free of surrounding whitespace'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'Missing tenant', 'short', 'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15902'
  )$$,
  '22023',
  null,
  'the audited reset requires a strict reason'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'Missing tenant', 'A sufficiently long reason', 'local:operator',
    'https://github.com/veyocast/platform/actions/runs/15903'
  )$$,
  '22023',
  null,
  'the audited reset requires a GitHub operator'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'Missing tenant', 'A sufficiently long reason', 'github:test-operator',
    'https://example.test/not-a-workflow'
  )$$,
  '22023',
  null,
  'the audited reset requires an exact repository workflow URL'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'Missing tenant', 'A sufficiently long reason', 'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15904'
  )$$,
  'P0002',
  null,
  'an unknown tenant fails closed'
);

insert into public.tenants (id, name, slug, status) values
  (
    '10000000-0000-4000-8000-000000001591',
    'S159 Royal club',
    's159-royal-club',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000001592',
    'S159 Paused club',
    's159-paused-club',
    'paused'
  ),
  (
    '10000000-0000-4000-8000-000000001593',
    'S159 Duplicate club',
    's159-duplicate-a',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000001594',
    'S159 Duplicate club',
    's159-duplicate-b',
    'active'
  );

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001591'),
  ('10000000-0000-4000-8000-000000001592');

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'S159 Paused club', 'A sufficiently long paused reason',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15905'
  )$$,
  '55000',
  null,
  'paused tenants cannot be reset'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'S159 Duplicate club', 'A sufficiently long duplicate reason',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15906'
  )$$,
  '21000',
  null,
  'duplicate tenant names fail closed'
);

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, config_json
) values (
  '30000000-0000-4000-8000-000000001591',
  '10000000-0000-4000-8000-000000001591',
  'S159 RSS source',
  'rss',
  'active',
  'ready',
  '{}'::jsonb
);

insert into public.dynamic_templates (
  id, slug, name, description, category, slide_type, orientation, status
) values (
  '40000000-0000-4000-8000-000000001591',
  's159-runtime-news',
  'S159 runtime news',
  'S159 wrapper fixture',
  'news',
  'news',
  'landscape',
  'draft'
);

insert into public.dynamic_template_versions (
  id, template_id, version, status, markup, css, manifest_json,
  sample_data_json, source_checksum_sha256, published_at
) values (
  '41000000-0000-4000-8000-000000001591',
  '40000000-0000-4000-8000-000000001591',
  1,
  'published',
  '<main>S159</main>',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  repeat('a', 64),
  now()
);

update public.dynamic_templates
set status = 'published',
    current_published_version_id =
      '41000000-0000-4000-8000-000000001591'
where id = '40000000-0000-4000-8000-000000001591';

insert into public.dynamic_slides (
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
) values (
  '50000000-0000-4000-8000-000000001591',
  '10000000-0000-4000-8000-000000001591',
  'S159 publishing slide',
  'news',
  'landscape',
  '40000000-0000-4000-8000-000000001591',
  '41000000-0000-4000-8000-000000001591',
  '30000000-0000-4000-8000-000000001591',
  'latest',
  'draft',
  '{}'::jsonb
);

update public.dynamic_slide_versions
set status = 'publishing'
where dynamic_slide_id = '50000000-0000-4000-8000-000000001591'
  and status = 'draft';

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v1(
    'S159 Royal club', 'A sufficiently long publishing reason',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/15907'
  )$$,
  '55000',
  null,
  'theme reset waits for an active slide publication'
);

update public.dynamic_slide_versions
set status = 'draft'
where dynamic_slide_id = '50000000-0000-4000-8000-000000001591'
  and status = 'publishing';

select lives_ok(
  $$select set_config(
    'test.s159_reset_result',
    private.reset_tenant_fieldflow_royal_v1(
      'S159 Royal club',
      'Apply the approved Royal blue tenant presentation',
      'github:test-operator',
      'https://github.com/veyocast/platform/actions/runs/15908'
    )::text,
    true
  )$$,
  'the owner command applies the guarded Royal blue reset'
);

select ok(
  current_setting('test.s159_reset_result')::jsonb ->> 'outcome' = 'applied'
  and (current_setting('test.s159_reset_result')::jsonb ->> 'verified')::boolean
  and coalesce(
    current_setting('test.s159_reset_result')::jsonb ->> 'auditId',
    ''
  ) ~* '^[0-9a-f-]{36}$'
  and current_setting('test.s159_reset_result')::jsonb ->> 'tenantName' =
    'S159 Royal club'
  and current_setting('test.s159_reset_result')::jsonb ->> 'status' = 'ready'
  and (
    current_setting('test.s159_reset_result')::jsonb ->> 'snapshotCount'
  )::integer = 0,
  'the reset reports its exact tenant and completed zero-snapshot rollout'
);

select ok(
  (
    select profile.color_overrides = expected.value
      and (
        select count(*)
        from jsonb_object_keys(
          profile.color_overrides #> '{fieldflow,dark}'
        )
      ) = 26
      and (
        select count(*)
        from jsonb_object_keys(
          profile.color_overrides #> '{fieldflow,light}'
        )
      ) = 26
    from public.tenant_theme_profiles profile
    cross join s159_expected expected
    where profile.tenant_id = '10000000-0000-4000-8000-000000001591'
      and profile.theme_id = 'fieldflow'
      and expected.name = 'colors'
  ),
  'the canonical profile stores the exact complete 26 plus 26 token maps'
);

select ok(
  (
    select profile.selection_json = expected.value
    from public.tenant_theme_profiles profile
    cross join s159_expected expected
    where profile.tenant_id = '10000000-0000-4000-8000-000000001591'
      and profile.theme_id = 'fieldflow'
      and expected.name = 'selection'
  ),
  'the canonical profile is fixed dark with exact accent and support colors'
);

select ok(
  (
    select profile.appearance_config = expected.value
    from public.tenant_theme_profiles profile
    cross join s159_expected expected
    where profile.tenant_id = '10000000-0000-4000-8000-000000001591'
      and profile.theme_id = 'fieldflow'
      and expected.name = 'appearance'
  ),
  'the canonical profile stores exact white surfaces, fonts and larger scales'
);

select ok(
  (
    select settings.default_theme_id = 'fieldflow'
      and settings.default_theme_version = '1.0.0'
      and settings.theme_mode_policy = '{"kind":"fixed","mode":"dark"}'::jsonb
      and settings.theme_accent = '#4169E1'
      and settings.theme_support = '#7A5CE6'
      and settings.theme_color_overrides = expected.value
      and settings.theme_settings_revision = profile.revision
    from public.tenant_settings settings
    join public.tenant_theme_profiles profile
      on profile.tenant_id = settings.tenant_id
     and profile.theme_id = 'fieldflow'
    cross join s159_expected expected
    where settings.tenant_id = '10000000-0000-4000-8000-000000001591'
      and expected.name = 'colors'
  ),
  'the compatibility settings mirror exactly matches the canonical profile'
);

select ok(
  (
    select rollout.status = 'ready'
      and rollout.settings_revision = profile.revision
      and rollout.snapshot_count = 0
      and rollout.ready_snapshot_count = 0
      and rollout.release_target_count = 0
      and rollout.release_count = 0
    from public.tenant_theme_rollouts rollout
    join public.tenant_theme_profiles profile
      on profile.tenant_id = rollout.tenant_id
     and profile.theme_id = rollout.theme_id
    where rollout.id = (
      current_setting('test.s159_reset_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'the reset starts and completes the immutable rollout planner atomically'
);

select ok(
  (
    select event.action = 'tenant.theme.royal_blue_reset'
      and event.actor_user_id is null
      and event.result = 'success'
      and event.metadata ->> 'operator' = 'github:test-operator'
      and event.metadata ->> 'reason' =
        'Apply the approved Royal blue tenant presentation'
      and event.metadata ->> 'workflowRun' =
        'https://github.com/veyocast/platform/actions/runs/15908'
      and event.metadata ->> 'rolloutId' =
        current_setting('test.s159_reset_result')::jsonb ->> 'rolloutId'
    from public.audit_events event
    where event.id = (
        current_setting('test.s159_reset_result')::jsonb ->> 'auditId'
      )::uuid
      and event.tenant_id = '10000000-0000-4000-8000-000000001591'
      and event.action = 'tenant.theme.royal_blue_reset'
  ),
  'the owner reset writes its direct operational audit record'
);

select lives_ok(
  $$select set_config(
    'test.s159_noop_result',
    private.reset_tenant_fieldflow_royal_v1(
      'S159 Royal club',
      'Repeat the approved Royal blue tenant presentation',
      'github:test-operator',
      'https://github.com/veyocast/platform/actions/runs/15909'
    )::text,
    true
  )$$,
  'repeating the exact reset is safe'
);

select ok(
  current_setting('test.s159_noop_result')::jsonb ->> 'outcome' = 'noop'
  and current_setting('test.s159_noop_result')::jsonb -> 'auditId' =
    'null'::jsonb
  and (current_setting('test.s159_noop_result')::jsonb ->> 'verified')::boolean
  and current_setting('test.s159_noop_result')::jsonb ->> 'rolloutId' =
    current_setting('test.s159_reset_result')::jsonb ->> 'rolloutId'
  and current_setting('test.s159_noop_result')::jsonb ->> 'status' = 'ready'
  and current_setting('test.s159_noop_result')::jsonb ->> 'revision' =
    current_setting('test.s159_reset_result')::jsonb ->> 'revision'
  and (
    select count(*) = 1
    from public.tenant_theme_rollouts
    where tenant_id = '10000000-0000-4000-8000-000000001591'
  )
  and (
    select count(*) = 1
    from public.audit_events
    where tenant_id = '10000000-0000-4000-8000-000000001591'
      and action = 'tenant.theme.royal_blue_reset'
  ),
  'an idempotent reset creates neither a second rollout nor a false audit claim'
);

select ok(
  (
    select private.build_dynamic_snapshot_data(slide)
      #>> '{_veyocastThemeRuntime,version}' = '2'
    from public.dynamic_slides slide
    where slide.id = '50000000-0000-4000-8000-000000001591'
  ),
  'newly built snapshot payloads carry runtime version two'
);

select ok(
  private.apply_tenant_theme_to_snapshot_v1(
    '10000000-0000-4000-8000-000000001591',
    '{"provider":{"preserved":true}}'::jsonb,
    '60000000-0000-4000-8000-000000001591'
  ) #>> '{_veyocastThemeRuntime,version}' = '2'
  and private.apply_tenant_theme_to_snapshot_v1(
    '10000000-0000-4000-8000-000000001591',
    '{"provider":{"preserved":true}}'::jsonb,
    '60000000-0000-4000-8000-000000001591'
  ) #>> '{provider,preserved}' = 'true',
  'theme rollout payloads add the marker without replacing provider data'
);

insert into public.dynamic_slide_snapshots (
  id, tenant_id, dynamic_slide_id, dynamic_slide_version_id,
  template_version_id, data_source_id, source_revision_hash,
  snapshot_data_json, status
) values (
  '70000000-0000-4000-8000-000000001591',
  '10000000-0000-4000-8000-000000001591',
  '50000000-0000-4000-8000-000000001591',
  (
    select active_draft_version_id
    from public.dynamic_slides
    where id = '50000000-0000-4000-8000-000000001591'
  ),
  '41000000-0000-4000-8000-000000001591',
  '30000000-0000-4000-8000-000000001591',
  repeat('b', 64),
  '{"historical":true}'::jsonb,
  'queued'
);

select ok(
  (
    select snapshot.snapshot_data_json = '{"historical":true}'::jsonb
      and not (snapshot.snapshot_data_json ? '_veyocastThemeRuntime')
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = '70000000-0000-4000-8000-000000001591'
  ),
  'the wrapper never rewrites already stored immutable snapshot payloads'
);

select * from finish();
rollback;
