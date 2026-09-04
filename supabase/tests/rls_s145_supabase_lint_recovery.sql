begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

select ok(
  not has_function_privilege(
    'anon',
    'private.require_platform_owner_aal2()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.require_platform_owner_aal2()',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'private.require_platform_owner_aal2()',
    'execute'
  ),
  'the private platform-owner guard is unavailable to Data API roles'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.review_data_deletion_v1(uuid,text,text,timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.review_data_deletion_v1(uuid,text,text,timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.review_data_deletion_v1(uuid,text,text,timestamptz)',
    'execute'
  ),
  'deletion review keeps its authenticated command surface'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_platform_support_role_v1(text,text,text[])',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.assign_platform_support_role_v1(uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.create_platform_support_role_v1(text,text,text[])',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.assign_platform_support_role_v1(uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.create_platform_support_role_v1(text,text,text[])',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.assign_platform_support_role_v1(uuid,uuid)',
    'execute'
  ),
  'support-role commands remain authenticated-only entrypoints'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.run_retention_maintenance_v1(boolean)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.run_retention_maintenance_v1(boolean)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.run_retention_maintenance_v1(boolean)',
    'execute'
  ),
  'retention maintenance remains service-role-only'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_scheduled_rss_sync_v1(uuid,text,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.complete_scheduled_rss_sync_v1(uuid,text,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.complete_scheduled_rss_sync_v1(uuid,text,jsonb)',
    'execute'
  ),
  'legacy RSS completion remains service-role-only'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.complete_sportlink_sync_before_standing_history_v1(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.complete_sportlink_sync_before_standing_history_v1(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.complete_sportlink_sync_before_standing_history_v1(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'the historical Sportlink helper stays internal-only'
);

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
    '00000000-0000-4000-8000-000000001451',
    'authenticated',
    'authenticated',
    's145-platform-owner@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001452',
    'authenticated',
    'authenticated',
    's145-platform-admin@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001453',
    'authenticated',
    'authenticated',
    's145-platform-support@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001454',
    'authenticated',
    'authenticated',
    's145-tenant-owner@veyocast.test',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001451', 'S145 platform owner'),
  ('00000000-0000-4000-8000-000000001452', 'S145 platform admin'),
  ('00000000-0000-4000-8000-000000001453', 'S145 platform support'),
  ('00000000-0000-4000-8000-000000001454', 'S145 tenant owner');

insert into public.platform_memberships (user_id, role) values
  ('00000000-0000-4000-8000-000000001451', 'platform_owner'),
  ('00000000-0000-4000-8000-000000001452', 'platform_admin'),
  ('00000000-0000-4000-8000-000000001453', 'platform_support');

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001451',
  'S145 lint recovery tenant',
  's145-lint-recovery'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001451'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001451',
  '00000000-0000-4000-8000-000000001454',
  'tenant_owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001452',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);

select throws_ok(
  $$select public.create_platform_support_role_v1(
    'S145 admin poging',
    'Platform admins mogen geen owner-only rollen beheren.',
    array['platform.ticket.read']::text[]
  )$$,
  '42501',
  'platform owner capability required',
  'a platform admin cannot cross the owner-only support-role boundary'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001451',
  true
);
select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$select public.create_platform_support_role_v1(
    'S145 AAL1 poging',
    'Een owner zonder AAL2 blijft uitgesloten.',
    array['platform.ticket.read']::text[]
  )$$,
  '42501',
  'sensitive platform mutations require aal2',
  'a platform owner still needs AAL2 for support-role management'
);

select set_config('request.jwt.claim.aal', 'aal2', true);

select ok(
  set_config(
    'test.s145_support_role_id',
    public.create_platform_support_role_v1(
      'S145 herstelrol',
      'Regressierol voor de gerepareerde owner-opdracht.',
      array['platform.ticket.read', 'platform.ticket.write']::text[]
    )::text,
    true
  )::uuid is not null,
  'an AAL2 platform owner can create a support role'
);

select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$select public.assign_platform_support_role_v1(
    '00000000-0000-4000-8000-000000001453',
    current_setting('test.s145_support_role_id')::uuid
  )$$,
  '42501',
  'sensitive platform mutations require aal2',
  'a platform owner cannot assign a support role without AAL2'
);

select set_config('request.jwt.claim.aal', 'aal2', true);

select lives_ok(
  $$select public.assign_platform_support_role_v1(
    '00000000-0000-4000-8000-000000001453',
    current_setting('test.s145_support_role_id')::uuid
  )$$,
  'an AAL2 platform owner can assign the support role'
);

reset role;

select ok(
  exists (
    select 1
    from public.platform_custom_role_assignments assignment
    where assignment.user_id = '00000000-0000-4000-8000-000000001453'
      and assignment.role_id =
        current_setting('test.s145_support_role_id')::uuid
      and assignment.assigned_by =
        '00000000-0000-4000-8000-000000001451'
  ),
  'the support-role assignment records its owner actor'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001454',
  true
);
select set_config('request.jwt.claim.aal', 'aal2', true);

select ok(
  set_config(
    'test.s145_deletion_request_id',
    public.request_data_deletion_v1(
      'tenant',
      '10000000-0000-4000-8000-000000001451',
      'De tenant vraagt verwijdering aan voor de S145-regressietest.'
    ) ->> 'requestId',
    true
  )::uuid is not null,
  'a tenant owner can create the deletion request used by the review test'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001451',
  true
);

select set_config('request.jwt.claim.aal', 'aal1', true);

select throws_ok(
  $$select public.review_data_deletion_v1(
    current_setting('test.s145_deletion_request_id')::uuid,
    'approved',
    'Deze poging mist de vereiste tweede authenticatiefactor.',
    null
  )$$,
  '42501',
  'sensitive platform mutations require aal2',
  'a platform owner cannot review a deletion request without AAL2'
);

select set_config('request.jwt.claim.aal', 'aal2', true);

select is(
  public.review_data_deletion_v1(
    current_setting('test.s145_deletion_request_id')::uuid,
    'approved',
    'Goedgekeurd na controle van de wettelijke bewaartermijnen.',
    null
  ) ->> 'outcome',
  'approved',
  'an AAL2 platform owner can review a deletion request'
);

reset role;

select ok(
  exists (
    select 1
    from public.data_deletion_requests request
    where request.id =
      current_setting('test.s145_deletion_request_id')::uuid
      and request.status = 'approved'
      and request.reviewed_by =
        '00000000-0000-4000-8000-000000001451'
  ),
  'deletion review persists the decision and reviewing owner'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$select public.run_retention_maintenance_v1(false)$$,
  '42501',
  null,
  'an authenticated session cannot spoof service-role retention access'
);

reset role;

update public.retention_policies
set retention_days = 1,
    enforcement = 'automatic',
    approved_at = now(),
    approved_by = '00000000-0000-4000-8000-000000001451'
where data_class = 'audit_events';

insert into public.audit_events (
  id,
  tenant_id,
  action,
  target_type,
  result,
  metadata,
  created_at
) values (
  '50000000-0000-4000-8000-000000001451',
  '10000000-0000-4000-8000-000000001451',
  's145.retention.fixture',
  'retention_fixture',
  'success',
  '{}'::jsonb,
  now() - interval '2 days'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  set_config(
    'test.s145_retention_result',
    public.run_retention_maintenance_v1(false)::text,
    true
  )::jsonb ->> 'applied',
  'false',
  'the service worker can execute a retention dry run'
);

select cmp_ok(
  (
    current_setting('test.s145_retention_result')::jsonb
      #>> '{eligible,auditEvents}'
  )::bigint,
  '>=',
  1::bigint,
  'the retention dry run identifies an actually eligible old audit event'
);

reset role;

select ok(
  exists (
    select 1
    from public.audit_events event
    where event.id = '50000000-0000-4000-8000-000000001451'
  ),
  'the retention dry run preserves the eligible audit event'
);

select is(
  (
    select initiated_by
    from public.retention_runs
    order by created_at desc, id desc
    limit 1
  ),
  'scheduled_worker',
  'retention records the actual scheduled-worker actor'
);

insert into public.dynamic_data_sources (
  id,
  tenant_id,
  name,
  kind,
  status,
  provider_status,
  config_json,
  next_sync_at,
  sync_locked_at,
  sync_locked_by
) values (
  '20000000-0000-4000-8000-000000001451',
  '10000000-0000-4000-8000-000000001451',
  'S145 legacy RSS',
  'rss',
  'active',
  'syncing',
  '{"url":"https://example.test/feed.xml","refreshMinutes":15}'::jsonb,
  now(),
  now(),
  'worker:s145-rss'
);

insert into public.dynamic_sync_runs (
  id,
  tenant_id,
  data_source_id,
  status
) values (
  '30000000-0000-4000-8000-000000001451',
  '10000000-0000-4000-8000-000000001451',
  '20000000-0000-4000-8000-000000001451',
  'running'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.complete_scheduled_rss_sync_v1(
    '30000000-0000-4000-8000-000000001451',
    'worker:s145-rss',
    '[{
      "externalId":"legacy-article-1",
      "title":"Legacy nieuws blijft werken",
      "intro":"Een oude workerpayload zonder canonicalLink.",
      "author":"VeyoCast",
      "sourceName":"S145 testfeed",
      "link":"https://example.test/nieuws#fragment",
      "publishedAt":"2026-09-04T10:00:00Z"
    }]'::jsonb
  ),
  1,
  'legacy RSS completion accepts the pre-v2 article contract'
);

reset role;

select is(
  (
    select run.status || ':' || source.provider_status || ':' ||
      coalesce(source.sync_locked_by, 'released')
    from public.dynamic_sync_runs run
    join public.dynamic_data_sources source
      on source.id = run.data_source_id
    where run.id = '30000000-0000-4000-8000-000000001451'
  ),
  'succeeded:ready:released',
  'legacy RSS completion closes the run and releases the source lease'
);

select is(
  (
    select canonical_link
    from public.dynamic_news_articles
    where data_source_id = '20000000-0000-4000-8000-000000001451'
      and external_id = 'legacy-article-1'
  ),
  'https://example.test/nieuws',
  'the canonical-link trigger still normalizes a legacy article link'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001454',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select ok(
  set_config(
    'test.s145_rss_slide_id',
    (
      select public.create_dynamic_slide_v1(
        '10000000-0000-4000-8000-000000001451',
        'S145 legacy RSS-slide',
        version.id,
        '20000000-0000-4000-8000-000000001451',
        'latest',
        '{"title":"Clubnieuws","maxItems":4}'::jsonb
      ) ->> 'slideId'
      from public.dynamic_template_versions version
      join public.dynamic_templates template
        on template.id = version.template_id
      where template.slug = 'editorial-arena-nieuws-dark-landscape'
        and version.status = 'published'
      limit 1
    ),
    true
  )::uuid is not null,
  'a tenant owner can bind a versioned latest slide to the legacy RSS source'
);

reset role;

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
  ),
  1::bigint,
  'creating the RSS slide queues its first immutable versioned snapshot'
);

select set_config(
  'test.s145_initial_snapshot_id',
  (
    select snapshot.id::text
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
    order by snapshot.created_at, snapshot.id
    limit 1
  ),
  true
);

update public.dynamic_slide_snapshots
set status = 'ready',
    completed_at = now()
where id = current_setting('test.s145_initial_snapshot_id')::uuid;

update public.dynamic_slides
set current_snapshot_id =
      current_setting('test.s145_initial_snapshot_id')::uuid,
    status = 'ready'
where id = current_setting('test.s145_rss_slide_id')::uuid;

update public.dynamic_data_sources
set provider_status = 'syncing',
    sync_locked_at = now(),
    sync_locked_by = 'worker:s145-rss-empty'
where id = '20000000-0000-4000-8000-000000001451';

insert into public.dynamic_sync_runs (
  id,
  tenant_id,
  data_source_id,
  status
) values (
  '30000000-0000-4000-8000-000000001452',
  '10000000-0000-4000-8000-000000001451',
  '20000000-0000-4000-8000-000000001451',
  'running'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.complete_scheduled_rss_sync_v1(
    '30000000-0000-4000-8000-000000001452',
    'worker:s145-rss-empty',
    '[]'::jsonb
  ),
  0,
  'an empty legacy RSS batch remains a successful no-op'
);

reset role;

select is(
  (
    select count(*)
    from public.dynamic_news_articles
    where data_source_id = '20000000-0000-4000-8000-000000001451'
  ),
  1::bigint,
  'an empty legacy batch does not delete previously normalized articles'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
  ),
  1::bigint,
  'an unchanged empty legacy batch does not duplicate the immutable snapshot'
);

update public.dynamic_data_sources
set provider_status = 'syncing',
    sync_locked_at = now(),
    sync_locked_by = 'worker:s145-rss-change'
where id = '20000000-0000-4000-8000-000000001451';

insert into public.dynamic_sync_runs (
  id,
  tenant_id,
  data_source_id,
  status
) values (
  '30000000-0000-4000-8000-000000001453',
  '10000000-0000-4000-8000-000000001451',
  '20000000-0000-4000-8000-000000001451',
  'running'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.complete_scheduled_rss_sync_v1(
    '30000000-0000-4000-8000-000000001453',
    'worker:s145-rss-change',
    '[{
      "externalId":"legacy-article-1",
      "title":"Legacy nieuws is bijgewerkt",
      "intro":"Een zichtbare inhoudswijziging voor de actuele snapshotqueue.",
      "author":"VeyoCast",
      "sourceName":"S145 testfeed",
      "link":"https://example.test/nieuws#fragment",
      "publishedAt":"2026-09-04T10:00:00Z"
    }]'::jsonb
  ),
  1,
  'changed legacy RSS content completes through the current revision queue'
);

reset role;

select is(
  (
    select count(*)::text || ':' ||
      count(snapshot.dynamic_slide_version_id)::text || ':' ||
      count(distinct snapshot.dynamic_slide_version_id)::text
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
  ),
  '2:2:1',
  'changed legacy RSS content creates one snapshot for the same runtime version'
);

select ok(
  exists (
    select 1
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id =
      current_setting('test.s145_initial_snapshot_id')::uuid
      and snapshot.snapshot_data_json #>> '{news,articles,0,title}' =
        'Legacy nieuws blijft werken'
  )
  and exists (
    select 1
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
      and snapshot.id <>
        current_setting('test.s145_initial_snapshot_id')::uuid
      and snapshot.snapshot_data_json #>> '{news,articles,0,title}' =
        'Legacy nieuws is bijgewerkt'
  ),
  'the revision queue preserves the old snapshot and freezes the new content'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001454',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.aal', 'aal2', true);

select is(
  public.create_or_resume_dynamic_slide_version_v1(
    current_setting('test.s145_rss_slide_id')::uuid,
    null
  ) ->> 'outcome',
  'created',
  'the tenant owner opens a v2 draft after the published RSS snapshot'
);

reset role;

update public.dynamic_data_sources
set provider_status = 'syncing',
    sync_locked_at = now(),
    sync_locked_by = 'worker:s145-rss-draft-open'
where id = '20000000-0000-4000-8000-000000001451';

insert into public.dynamic_sync_runs (
  id,
  tenant_id,
  data_source_id,
  status
) values (
  '30000000-0000-4000-8000-000000001455',
  '10000000-0000-4000-8000-000000001451',
  '20000000-0000-4000-8000-000000001451',
  'running'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.complete_scheduled_rss_sync_v1(
    '30000000-0000-4000-8000-000000001455',
    'worker:s145-rss-draft-open',
    '[{
      "externalId":"legacy-article-1",
      "title":"Bronnieuws wijzigt tijdens een open concept",
      "intro":"De bron mag wijzigen zonder het ongepubliceerde ontwerp te renderen.",
      "author":"VeyoCast",
      "sourceName":"S145 testfeed",
      "link":"https://example.test/nieuws#fragment",
      "publishedAt":"2026-09-04T10:00:00Z"
    }]'::jsonb
  ),
  1,
  'legacy RSS completion still accepts source content while v2 is a draft'
);

reset role;

select is(
  (
    select count(*)::text
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id =
      current_setting('test.s145_rss_slide_id')::uuid
  ) || ':' || (
    select version.status
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.id = slide.active_draft_version_id
    where slide.id = current_setting('test.s145_rss_slide_id')::uuid
  ) || ':' || (
    select count(*)::text
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_slides slide
      on slide.id = snapshot.dynamic_slide_id
    where slide.id = current_setting('test.s145_rss_slide_id')::uuid
      and snapshot.dynamic_slide_version_id = slide.active_draft_version_id
  ) || ':' || (
    select article.title
    from public.dynamic_news_articles article
    where article.data_source_id =
        '20000000-0000-4000-8000-000000001451'
      and article.external_id = 'legacy-article-1'
  ),
  '2:draft:0:Bronnieuws wijzigt tijdens een open concept',
  'an open v2 draft stays unrendered while the source update is retained'
);

update public.dynamic_data_sources
set provider_status = 'syncing',
    sync_locked_at = now(),
    sync_locked_by = 'worker:s145-rss-owner'
where id = '20000000-0000-4000-8000-000000001451';

insert into public.dynamic_sync_runs (
  id,
  tenant_id,
  data_source_id,
  status
) values (
  '30000000-0000-4000-8000-000000001454',
  '10000000-0000-4000-8000-000000001451',
  '20000000-0000-4000-8000-000000001451',
  'running'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$select public.complete_scheduled_rss_sync_v1(
    '30000000-0000-4000-8000-000000001454',
    'worker:s145-rss-wrong',
    '[]'::jsonb
  )$$,
  '55000',
  'RSS sync lease lost',
  'legacy RSS completion rejects a mismatched worker lease'
);

reset role;

select is(
  (
    select run.status || ':' || source.provider_status || ':' ||
      coalesce(source.sync_locked_by, 'released')
    from public.dynamic_sync_runs run
    join public.dynamic_data_sources source
      on source.id = run.data_source_id
    where run.id = '30000000-0000-4000-8000-000000001454'
  ),
  'running:syncing:worker:s145-rss-owner',
  'a rejected RSS worker cannot mutate the run or source lease'
);

select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$select public.complete_sportlink_sync_before_standing_history_v1(
    '40000000-0000-4000-8000-000000001451',
    'worker:s145-sportlink',
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[{"externalId":"legacy-standing"}]'::jsonb
  )$$,
  '22023',
  'legacy_sportlink_completion_requires_empty_standings',
  'the historical Sportlink helper rejects obsolete standing writes'
);

select * from finish();
rollback;
