begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(55);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000841',
    'authenticated', 'authenticated', 'studio-editor@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000842',
    'authenticated', 'authenticated', 'studio-viewer@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000843',
    'authenticated', 'authenticated', 'studio-other@veyocast.test',
    'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000841', 'Studio editor'),
  ('00000000-0000-4000-8000-000000000842', 'Studio viewer'),
  ('00000000-0000-4000-8000-000000000843', 'Studio other tenant');

insert into public.tenants (id, name, slug)
values
  (
    '10000000-0000-4000-8000-000000000841',
    'Studio tenant',
    'studio-tenant'
  ),
  (
    '10000000-0000-4000-8000-000000000842',
    'Other Studio tenant',
    'other-studio-tenant'
  );

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000841'),
  ('10000000-0000-4000-8000-000000000842');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000841',
    '00000000-0000-4000-8000-000000000841',
    'tenant_editor'
  ),
  (
    '10000000-0000-4000-8000-000000000841',
    '00000000-0000-4000-8000-000000000842',
    'tenant_viewer'
  ),
  (
    '10000000-0000-4000-8000-000000000842',
    '00000000-0000-4000-8000-000000000843',
    'tenant_owner'
  );

insert into public.media_assets (
  id,
  tenant_id,
  created_by,
  kind,
  title,
  original_file_name,
  mime_type,
  status,
  storage_path,
  file_size_bytes,
  checksum_sha256,
  width,
  height,
  processed_at
)
values
  (
    '20000000-0000-4000-8000-000000000841',
    '10000000-0000-4000-8000-000000000841',
    '00000000-0000-4000-8000-000000000841',
    'image',
    'Studio bronbeeld',
    'studio-source.png',
    'image/png',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000841/assets/20000000-0000-4000-8000-000000000841/original/studio-source.png',
    2048,
    repeat('a', 64),
    1920,
    1080,
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000842',
    '10000000-0000-4000-8000-000000000842',
    '00000000-0000-4000-8000-000000000843',
    'image',
    'Andere tenant bron',
    'other-source.png',
    'image/png',
    'ready',
    'tenants/10000000-0000-4000-8000-000000000842/assets/20000000-0000-4000-8000-000000000842/original/other-source.png',
    1024,
    repeat('b', 64),
    1920,
    1080,
    now()
  );

insert into public.media_variants (
  tenant_id,
  asset_id,
  variant_type,
  storage_path,
  mime_type,
  file_size_bytes,
  checksum_sha256,
  width,
  height
)
values
  (
    '10000000-0000-4000-8000-000000000841',
    '20000000-0000-4000-8000-000000000841',
    'original',
    'tenants/10000000-0000-4000-8000-000000000841/assets/20000000-0000-4000-8000-000000000841/original/studio-source.png',
    'image/png',
    2048,
    repeat('a', 64),
    1920,
    1080
  ),
  (
    '10000000-0000-4000-8000-000000000842',
    '20000000-0000-4000-8000-000000000842',
    'original',
    'tenants/10000000-0000-4000-8000-000000000842/assets/20000000-0000-4000-8000-000000000842/original/other-source.png',
    'image/png',
    1024,
    repeat('b', 64),
    1920,
    1080
  );

create temporary table studio_test_documents (
  name text primary key,
  document jsonb not null,
  asset_ids uuid[] not null
);

insert into studio_test_documents (name, document, asset_ids)
values
  (
    'static',
    '{
      "schemaVersion":1,
      "artboard":{
        "width":1920,
        "height":1080,
        "orientation":"landscape",
        "background":{"kind":"solid","color":"#0A0A0A"},
        "safeArea":{"top":64,"right":64,"bottom":64,"left":64}
      },
      "motion":{"enabled":false,"durationMs":10000,"fps":30},
      "elements":[{
        "id":"source-image",
        "name":"Bronbeeld",
        "type":"image",
        "mediaAssetId":"20000000-0000-4000-8000-000000000841"
      }],
      "metadata":{
        "fontRegistryVersion":"2026-07-24.1",
        "tenantBrandApplied":false
      }
    }'::jsonb,
    array['20000000-0000-4000-8000-000000000841'::uuid]
  ),
  (
    'motion',
    '{
      "schemaVersion":1,
      "artboard":{
        "width":1920,
        "height":1080,
        "orientation":"landscape",
        "background":{"kind":"solid","color":"#0A0A0A"},
        "safeArea":{"top":64,"right":64,"bottom":64,"left":64}
      },
      "motion":{"enabled":true,"durationMs":10000,"fps":30},
      "elements":[],
      "metadata":{
        "fontRegistryVersion":"2026-07-24.1",
        "tenantBrandApplied":false
      }
    }'::jsonb,
    '{}'::uuid[]
  );

create temporary table studio_test_results (
  name text primary key,
  result jsonb not null
);

create temporary table studio_claims as
select *
from public.claim_studio_render_job_v1('worker:schema', 900, 3)
with no data;

grant select on studio_test_documents to authenticated;
grant select, insert, update, delete on studio_test_results
  to authenticated, service_role;
grant select, insert, update, delete on studio_claims
  to authenticated, service_role;

select ok(
  (
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.studio_projects'::regclass
  ),
  'Studio projects force RLS even for table owners'
);

select ok(
  (
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.studio_render_jobs'::regclass
  ),
  'Studio render jobs force RLS'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_studio_render_job_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated users cannot claim Studio render jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_studio_render_job_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'service role can claim Studio render jobs'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);

select ok(
  public.get_my_tenant_capabilities_v1(
    '10000000-0000-4000-8000-000000000841'
  ) @> array[
    'tenant.studio.read',
    'tenant.studio.create',
    'tenant.studio.edit_own',
    'tenant.studio.render'
  ]::text[],
  'built-in tenant editors receive bounded Studio authoring capabilities'
);

insert into studio_test_results (name, result)
select
  'create',
  public.create_studio_project_v1(
    '10000000-0000-4000-8000-000000000841',
    'Wedstrijddag',
    'landscape',
    document,
    asset_ids,
    'design',
    '90000000-0000-4000-8000-000000000841'
  )
from studio_test_documents
where name = 'static';

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'create'),
  'created',
  'Studio project creation returns a typed created outcome'
);

select is(
  (
    select public.create_studio_project_v1(
      '10000000-0000-4000-8000-000000000841',
      'Wedstrijddag',
      'landscape',
      document,
      asset_ids,
      'design',
      '90000000-0000-4000-8000-000000000841'
    ) ->> 'projectId'
    from studio_test_documents
    where name = 'static'
  ),
  (select result ->> 'projectId' from studio_test_results where name = 'create'),
  'an identical create replay returns the original project'
);

select is(
  (
    select count(*)
    from public.studio_projects
    where tenant_id = '10000000-0000-4000-8000-000000000841'
  ),
  1::bigint,
  'idempotent project creation inserts only one row'
);

select throws_ok(
  $$insert into public.studio_projects (
    tenant_id, name, orientation, width, height
  ) values (
    '10000000-0000-4000-8000-000000000841',
    'Onveilige directe insert', 'landscape', 1920, 1080
  )$$,
  '42501',
  'permission denied for table studio_projects',
  'authenticated users cannot bypass Studio command RPCs'
);

select throws_ok(
  $$select public.create_studio_project_v1(
    '10000000-0000-4000-8000-000000000841',
    'Manifest omzeilen',
    'landscape',
    (select document from studio_test_documents where name = 'static'),
    '{}'::uuid[],
    'design',
    '90000000-0000-4000-8000-000000000842'
  )$$,
  '23514',
  'Studio document media manifest does not match its image elements',
  'every image element must be represented in the guarded media manifest'
);

select throws_ok(
  $$select public.create_studio_project_v1(
    '10000000-0000-4000-8000-000000000841',
    'Andere tenant omzeilen',
    'landscape',
    jsonb_set(
      (select document from studio_test_documents where name = 'static'),
      '{elements,0,mediaAssetId}',
      '"20000000-0000-4000-8000-000000000842"'::jsonb
    ),
    array['20000000-0000-4000-8000-000000000842'::uuid],
    'design',
    '90000000-0000-4000-8000-000000000843'
  )$$,
  '23514',
  'Studio document references unavailable tenant media',
  'cross-tenant image assets cannot enter a Studio document'
);

insert into studio_test_results (name, result)
select
  'save',
  public.save_studio_draft_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    0,
    document,
    asset_ids,
    '90000000-0000-4000-8000-000000000844'
  )
from studio_test_documents
where name = 'static';

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'save'),
  'saved',
  'draft save returns a typed saved outcome'
);

select is(
  (
    select draft_revision
    from public.studio_project_drafts
    where project_id = (
      select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'
    )
  ),
  1::bigint,
  'draft save advances the draft revision exactly once'
);

select is(
  (
    select public.save_studio_draft_v1(
      (select (result ->> 'projectId')::uuid
        from studio_test_results where name = 'create'),
      0,
      document,
      asset_ids,
      '90000000-0000-4000-8000-000000000845'
    ) ->> 'outcome'
    from studio_test_documents
    where name = 'static'
  ),
  'conflict',
  'stale draft saves return a typed conflict without overwriting'
);

insert into studio_test_results (name, result)
select
  'rename',
  public.mutate_studio_project_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    'rename',
    '{"name":"Wedstrijddag vernieuwd"}'::jsonb,
    '90000000-0000-4000-8000-000000000846'
  );

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'rename'),
  'applied',
  'project metadata mutation is guarded by project revision'
);

select is(
  (
    select revision
    from public.studio_projects
    where id = (
      select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'
    )
  ),
  2::bigint,
  'draft save and rename share the project concurrency revision'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000842',
  true
);

select is(
  (
    select count(*)
    from public.studio_projects
    where tenant_id = '10000000-0000-4000-8000-000000000841'
  ),
  1::bigint,
  'tenant viewers can read Studio projects'
);

select throws_ok(
  $$select public.create_studio_project_v1(
    '10000000-0000-4000-8000-000000000841',
    'Viewerproject',
    'landscape',
    (select document from studio_test_documents where name = 'motion'),
    '{}'::uuid[],
    'design',
    '90000000-0000-4000-8000-000000000847'
  )$$,
  '42501',
  'actor cannot create Studio projects',
  'tenant viewers cannot create Studio projects'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000843',
  true
);

select is(
  (select count(*) from public.studio_projects),
  0::bigint,
  'Studio project rows are isolated from another tenant'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);

insert into studio_test_results (name, result)
select
  'render-one',
  public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    'png',
    '90000000-0000-4000-8000-000000000848'
  );

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'render-one'),
  'queued',
  'render request returns a typed queued outcome'
);

select is(
  (
    select count(*)
    from public.studio_revisions
    where id = (
      select (result ->> 'revisionId')::uuid
      from studio_test_results where name = 'render-one'
    )
  ),
  1::bigint,
  'render request freezes one immutable Studio revision'
);

select is(
  (
    select count(*)
    from public.studio_revision_assets
    where revision_id = (
      select (result ->> 'revisionId')::uuid
      from studio_test_results where name = 'render-one'
    )
  ),
  1::bigint,
  'render revision materializes its exact source asset set'
);

reset role;
set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:cancel', 900, 3);
reset role;

select is(
  (select job_id from studio_claims),
  (
    select (result ->> 'renderJobId')::uuid
    from studio_test_results where name = 'render-one'
  ),
  'service worker claims the oldest eligible Studio render'
);

select is(
  (select jsonb_array_length(assets_json) from studio_claims),
  1,
  'worker claim returns the immutable source asset manifest'
);

select is(
  (
    select format('%s|%s', status, attempt_count)
    from public.studio_render_jobs
    where id = (select job_id from studio_claims)
  ),
  'preparing|1',
  'claim creates a bounded preparing lease and increments the attempt'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);
insert into studio_test_results (name, result)
select
  'cancel-active',
  public.cancel_studio_render_v1(
    (select job_id from studio_claims),
    '90000000-0000-4000-8000-000000000849'
  );

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'cancel-active'
  ),
  'cancel_requested',
  'active render cancellation records a cooperative cancellation request'
);

reset role;
set local role service_role;
insert into studio_test_results (name, result)
select
  'cancel-observed',
  public.update_studio_render_job_v1(
    (select job_id from studio_claims),
    'worker:cancel',
    'preparing',
    5
  );

select is(
  (
    select result ->> 'cancelRequested'
    from studio_test_results
    where name = 'cancel-observed'
  ),
  'true',
  'worker heartbeat observes an active cancellation request'
);

insert into studio_test_results (name, result)
select
  'cancel-finished',
  public.fail_studio_render_job_v1(
    (select job_id from studio_claims),
    'worker:cancel',
    'render_cancelled',
    'Render veilig geannuleerd.',
    false
  );
reset role;

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'cancel-finished'
  ),
  'cancelled',
  'worker acknowledges cancellation as a terminal cancelled outcome'
);

select is(
  (
    select status
    from public.studio_render_jobs
    where id = (select job_id from studio_claims)
  ),
  'cancelled',
  'cancelled render releases its worker lease'
);

delete from studio_claims;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);
insert into studio_test_results (name, result)
select
  'render-two',
  public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    'png',
    '90000000-0000-4000-8000-000000000850'
  );
reset role;

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'render-two'),
  'queued',
  'a second idempotent request creates a separate immutable render'
);

set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:complete-png', 900, 3);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-png',
  'rendering',
  20
);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-png',
  'uploading',
  85
);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-png',
  'creating_media',
  95
);
reset role;

select is(
  (select status from public.studio_render_jobs where id = (select job_id from studio_claims)),
  'creating_media',
  'worker status transitions reach media creation monotonically'
);

insert into storage.objects (bucket_id, name, owner, metadata)
select
  'tenant-media',
  'tenants/' || tenant_id::text ||
    '/assets/' || planned_media_asset_id::text ||
    '/original/studio-output.png',
  '00000000-0000-4000-8000-000000000841'::uuid,
  '{"size":1000,"mimetype":"image/png"}'::jsonb
from public.studio_render_jobs
where id = (select job_id from studio_claims)
union all
select
  'tenant-media',
  'tenants/' || tenant_id::text ||
    '/assets/' || planned_media_asset_id::text ||
    '/variants/studio-poster.png',
  '00000000-0000-4000-8000-000000000841'::uuid,
  '{"size":500,"mimetype":"image/png"}'::jsonb
from public.studio_render_jobs
where id = (select job_id from studio_claims);

set local role service_role;
insert into studio_test_results (name, result)
select
  'complete-png',
  public.complete_studio_render_job_v1(
    job_id,
    'worker:complete-png',
    'tenants/' || tenant_id::text ||
      '/assets/' || planned_media_asset_id::text ||
      '/original/studio-output.png',
    'tenants/' || tenant_id::text ||
      '/assets/' || planned_media_asset_id::text ||
      '/variants/studio-poster.png',
    'image/png',
    1000,
    repeat('c', 64),
    500,
    repeat('d', 64),
    1920,
    1080,
    null
  )
from studio_claims;
reset role;

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'complete-png'),
  'completed',
  'verified PNG completion atomically closes the render'
);

select is(
  (
    select status::text
    from public.media_assets
    where id = (
      select (result ->> 'mediaAssetId')::uuid
      from studio_test_results where name = 'complete-png'
    )
  ),
  'ready',
  'Studio output enters the normal media library as ready media'
);

select is(
  (
    select count(*)
    from public.media_variants
    where asset_id = (
      select (result ->> 'mediaAssetId')::uuid
      from studio_test_results where name = 'complete-png'
    )
  ),
  2::bigint,
  'PNG completion creates original and thumbnail variants'
);

select is(
  (
    select count(*)
    from public.studio_exports
    where render_job_id = (select job_id from studio_claims)
  ),
  1::bigint,
  'completed render creates one immutable Studio export'
);

select throws_ok(
  $$update public.studio_revisions
    set document_hash = repeat('f', 64)
    where id = (
      select (result ->> 'revisionId')::uuid
      from studio_test_results where name = 'render-two'
    )$$,
  '55000',
  'immutable Studio record cannot be changed',
  'frozen Studio revisions reject mutation even for the migration owner'
);

select ok(
  exists (
    select 1
    from public.audit_events
    where action = 'studio.render.completed'
      and target_id = (select job_id from studio_claims)
      and metadata ->> 'systemExecuted' = 'true'
  ),
  'worker completion emits a bounded system audit event'
);

delete from studio_claims;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);
insert into studio_test_results (name, result)
select
  'render-retry',
  public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    'png',
    '90000000-0000-4000-8000-000000000851'
  );
reset role;

set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:retry-one', 900, 3);
insert into studio_test_results (name, result)
select
  'retry-failure',
  public.fail_studio_render_job_v1(
    job_id,
    'worker:retry-one',
    'storage_timeout',
    'Tijdelijke storagefout.',
    true
  )
from studio_claims;
reset role;

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'retry-failure'),
  'queued',
  'retryable worker failure returns the job to the queue'
);

select ok(
  (
    select next_attempt_at > now()
    from public.studio_render_jobs
    where id = (
      select (result ->> 'renderJobId')::uuid
      from studio_test_results where name = 'retry-failure'
    )
  ),
  'retryable failure applies database-controlled exponential backoff'
);

delete from studio_claims;
set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:too-early', 900, 3);
reset role;

select is(
  (select count(*) from studio_claims),
  0::bigint,
  'backoff prevents an immediate render reclaim loop'
);

update public.studio_render_jobs
set next_attempt_at = now() - interval '1 second'
where id = (
  select (result ->> 'renderJobId')::uuid
  from studio_test_results where name = 'retry-failure'
);

set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:retry-two', 900, 3);
insert into studio_test_results (name, result)
select
  'terminal-failure',
  public.fail_studio_render_job_v1(
    job_id,
    'worker:retry-two',
    'invalid_output',
    'Uitvoer ongeldig.',
    false
  )
from studio_claims;
reset role;

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'terminal-failure'
  ),
  'failed',
  'non-retryable render failures become terminal'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000841',
  true
);
insert into studio_test_results (name, result)
select
  'manual-retry',
  public.retry_studio_render_v1(
    (select (result ->> 'renderJobId')::uuid
      from studio_test_results where name = 'terminal-failure'),
    '90000000-0000-4000-8000-000000000852'
  );

select is(
  (select result ->> 'outcome' from studio_test_results where name = 'manual-retry'),
  'queued',
  'authorized human can explicitly retry a terminal failed render'
);

insert into studio_test_results (name, result)
select
  'cancel-queued',
  public.cancel_studio_render_v1(
    (select (result ->> 'renderJobId')::uuid
      from studio_test_results where name = 'terminal-failure'),
    '90000000-0000-4000-8000-000000000853'
  );

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'cancel-queued'
  ),
  'cancelled',
  'queued render cancellation is immediate and terminal'
);

select throws_ok(
  $$select public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    'png',
    '90000000-0000-4000-8000-000000000841'
  )$$,
  '23505',
  'idempotency key belongs to another Studio command',
  'Studio idempotency keys cannot be reused across command types'
);

select ok(
  (
    select count(*)
    from public.studio_command_receipts
    where actor_user_id = '00000000-0000-4000-8000-000000000841'
  ) >= 10,
  'authenticated actor can inspect only their own Studio command receipts'
);

insert into studio_test_results (name, result)
select
  'save-motion',
  public.save_studio_draft_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    1,
    document,
    asset_ids,
    '90000000-0000-4000-8000-000000000854'
  )
from studio_test_documents
where name = 'motion';

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'save-motion'
  ),
  'saved',
  'motion-capable editor can convert a draft to the bounded motion mode'
);

insert into studio_test_results (name, result)
select
  'render-mp4',
  public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    2,
    'mp4',
    '90000000-0000-4000-8000-000000000855'
  );
reset role;

select is(
  (select result ->> 'outputKind' from studio_test_results where name = 'render-mp4'),
  'mp4',
  'motion project queues only its MP4 output contract'
);

delete from studio_claims;
set local role service_role;
insert into studio_claims
select * from public.claim_studio_render_job_v1('worker:complete-mp4', 900, 3);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-mp4',
  'rendering',
  20
);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-mp4',
  'encoding',
  75
);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-mp4',
  'uploading',
  85
);
select public.update_studio_render_job_v1(
  (select job_id from studio_claims),
  'worker:complete-mp4',
  'creating_media',
  95
);
reset role;

select is(
  (select output_kind from studio_claims),
  'mp4',
  'worker claims the immutable MP4 render contract'
);

insert into storage.objects (bucket_id, name, owner, metadata)
select
  'tenant-media',
  'tenants/' || tenant_id::text ||
    '/assets/' || planned_media_asset_id::text ||
    '/variants/player-1080p.mp4',
  '00000000-0000-4000-8000-000000000841'::uuid,
  '{"size":2000,"mimetype":"video/mp4"}'::jsonb
from public.studio_render_jobs
where id = (select job_id from studio_claims)
union all
select
  'tenant-media',
  'tenants/' || tenant_id::text ||
    '/assets/' || planned_media_asset_id::text ||
    '/variants/studio-poster.png',
  '00000000-0000-4000-8000-000000000841'::uuid,
  '{"size":600,"mimetype":"image/png"}'::jsonb
from public.studio_render_jobs
where id = (select job_id from studio_claims);

set local role service_role;
insert into studio_test_results (name, result)
select
  'complete-mp4',
  public.complete_studio_render_job_v1(
    job_id,
    'worker:complete-mp4',
    'tenants/' || tenant_id::text ||
      '/assets/' || planned_media_asset_id::text ||
      '/variants/player-1080p.mp4',
    'tenants/' || tenant_id::text ||
      '/assets/' || planned_media_asset_id::text ||
      '/variants/studio-poster.png',
    'video/mp4',
    2000,
    repeat('e', 64),
    600,
    repeat('f', 64),
    1920,
    1080,
    10
  )
from studio_claims;
reset role;

select is(
  (
    select result ->> 'outcome'
    from studio_test_results
    where name = 'complete-mp4'
  ),
  'completed',
  'verified MP4 completion closes the motion render'
);

select is(
  (
    select count(*)
    from public.media_variants
    where asset_id = (
      select (result ->> 'mediaAssetId')::uuid
      from studio_test_results where name = 'complete-mp4'
    )
  ),
  3::bigint,
  'MP4 completion creates original, player_1080p and thumbnail variants'
);

select is(
  (
    select duration_seconds
    from public.media_assets
    where id = (
      select (result ->> 'mediaAssetId')::uuid
      from studio_test_results where name = 'complete-mp4'
    )
  ),
  10.000::numeric,
  'MP4 media duration matches the immutable Studio motion duration'
);

select throws_ok(
  $$select public.request_studio_render_v1(
    (select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'),
    2,
    'png',
    '90000000-0000-4000-8000-000000000856'
  )$$,
  '23514',
  'Studio render request is invalid',
  'motion projects cannot request a static PNG through the guarded RPC'
);

select is(
  (
    select count(*)
    from public.studio_exports
    where project_id = (
      select (result ->> 'projectId')::uuid
      from studio_test_results where name = 'create'
    )
  ),
  2::bigint,
  'only successfully completed PNG and MP4 renders become exports'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.studio_render_jobs',
    'UPDATE'
  ),
  'authenticated users cannot directly mutate Studio render state'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_studio_render_job_v1(uuid,text,text,text,text,bigint,text,bigint,text,integer,integer,numeric)',
    'EXECUTE'
  ),
  'only the service worker contract can complete Studio media creation'
);

select * from finish();
rollback;
