begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000000901', 'Worker tenant', 'worker-tenant');

insert into public.media_assets (
  id,
  tenant_id,
  kind,
  title,
  original_file_name,
  mime_type,
  status,
  storage_path,
  file_size_bytes
)
values
  (
    '20000000-0000-4000-8000-000000000901',
    '10000000-0000-4000-8000-000000000901',
    'video',
    'Worker video complete',
    'complete.mp4',
    'video/mp4',
    'uploading',
    'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000901/original/complete.mp4',
    1024
  ),
  (
    '20000000-0000-4000-8000-000000000902',
    '10000000-0000-4000-8000-000000000901',
    'video',
    'Worker video fail',
    'fail.mp4',
    'video/mp4',
    'uploading',
    'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000902/original/fail.mp4',
    2048
  ),
  (
    '20000000-0000-4000-8000-000000000903',
    '10000000-0000-4000-8000-000000000901',
    'video',
    'Pre-daemon processing video',
    'legacy.mp4',
    'video/mp4',
    'processing',
    'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000903/original/legacy.mp4',
    3072
  );

insert into public.media_processing_jobs (id, tenant_id, asset_id, status)
values
  (
    '40000000-0000-4000-8000-000000000901',
    '10000000-0000-4000-8000-000000000901',
    '20000000-0000-4000-8000-000000000901',
    'queued'
  ),
  (
    '40000000-0000-4000-8000-000000000902',
    '10000000-0000-4000-8000-000000000901',
    '20000000-0000-4000-8000-000000000902',
    'queued'
  ),
  (
    '40000000-0000-4000-8000-000000000903',
    '10000000-0000-4000-8000-000000000901',
    '20000000-0000-4000-8000-000000000903',
    'processing'
  );

select ok(
  not has_function_privilege('anon', 'public.claim_media_processing_job(text,integer,integer)', 'EXECUTE'),
  'anonymous cannot claim media jobs'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_media_processing_job(text,integer,integer)', 'EXECUTE'),
  'authenticated users cannot claim media jobs'
);
select ok(
  has_function_privilege('service_role', 'public.claim_media_processing_job(text,integer,integer)', 'EXECUTE'),
  'service role can claim media jobs'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_media_processing_job(uuid,text,text,text,text,bigint,integer,integer,numeric)', 'EXECUTE'),
  'authenticated users cannot complete media jobs'
);
select ok(
  has_function_privilege('service_role', 'public.complete_media_processing_job(uuid,text,text,text,text,bigint,integer,integer,numeric)', 'EXECUTE'),
  'service role can complete media jobs'
);
select ok(
  has_function_privilege('service_role', 'public.fail_media_processing_job(uuid,text,text,text,boolean,integer)', 'EXECUTE'),
  'service role can report media job failures'
);

create temporary table claimed_worker_job as
select * from public.claim_media_processing_job('worker:test-1', 900, 3) with no data;
grant select, insert, delete on claimed_worker_job to service_role;

set local role service_role;
insert into claimed_worker_job
select * from public.claim_media_processing_job('worker:test-1', 900, 3);
reset role;

select is(
  (select job_id from claimed_worker_job),
  '40000000-0000-4000-8000-000000000901'::uuid,
  'oldest queued video job is claimed first'
);
select is(
  (select status::text from public.media_processing_jobs where id = '40000000-0000-4000-8000-000000000901'),
  'processing',
  'claim moves job to processing'
);
select is(
  (select attempt_count from public.media_processing_jobs where id = '40000000-0000-4000-8000-000000000901'),
  1,
  'claim increments attempt count exactly once'
);
select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000901'),
  'processing',
  'claim moves asset to processing'
);

set local role service_role;
select throws_ok(
  $$
    select public.complete_media_processing_job(
      '40000000-0000-4000-8000-000000000901',
      'worker:wrong',
      repeat('a', 64),
      'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000901/variants/player-1080p.mp4',
      repeat('b', 64),
      900,
      1280,
      720,
      30
    )
  $$,
  '42501',
  'processing job is not owned by this worker',
  'a different worker cannot complete the claimed job'
);

select throws_ok(
  $$
    select public.complete_media_processing_job(
      '40000000-0000-4000-8000-000000000901',
      'worker:test-1',
      repeat('a', 64),
      'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000901/variants/player-1080p.mp4',
      repeat('b', 64),
      900,
      1920,
      1920,
      30
    )
  $$,
  '23514',
  'processed variant metadata is invalid',
  'completion rejects a variant whose short edge exceeds 1080'
);

select public.complete_media_processing_job(
  '40000000-0000-4000-8000-000000000901',
  'worker:test-1',
  repeat('a', 64),
  'tenants/10000000-0000-4000-8000-000000000901/assets/20000000-0000-4000-8000-000000000901/variants/player-1080p.mp4',
  repeat('b', 64),
  900,
  1080,
  1920,
  30
);
reset role;

select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000901'),
  'ready',
  'completion makes the verified video asset ready'
);
select is(
  (select count(*) from public.media_variants where asset_id = '20000000-0000-4000-8000-000000000901'),
  2::bigint,
  'completion registers original and player variants atomically'
);
select is(
  (
    select format('%sx%s', width, height)
    from public.media_variants
    where asset_id = '20000000-0000-4000-8000-000000000901'
      and variant_type = 'player_1080p'
  ),
  '1080x1920',
  'completion preserves a portrait player variant within the long-edge contract'
);
select is(
  (select status::text from public.media_processing_jobs where id = '40000000-0000-4000-8000-000000000901'),
  'completed',
  'completion closes the processing job'
);

delete from claimed_worker_job;
set local role service_role;
insert into claimed_worker_job
select * from public.claim_media_processing_job('worker:test-2', 900, 3);
select public.fail_media_processing_job(
  '40000000-0000-4000-8000-000000000902',
  'worker:test-2',
  'storage_timeout',
  'tijdelijke storage timeout',
  true,
  3
);
reset role;

select is(
  (select status::text from public.media_processing_jobs where id = '40000000-0000-4000-8000-000000000902'),
  'queued',
  'retryable first failure returns the job to the queue'
);
select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000902'),
  'processing',
  'retryable failure keeps the asset unavailable but processing'
);

delete from claimed_worker_job;
set local role service_role;
insert into claimed_worker_job
select * from public.claim_media_processing_job('worker:test-3', 900, 3);
select public.fail_media_processing_job(
  '40000000-0000-4000-8000-000000000902',
  'worker:test-3',
  'unsupported_input',
  E'ongeldige\nvideo',
  false,
  3
);
reset role;

select is(
  (select status::text from public.media_processing_jobs where id = '40000000-0000-4000-8000-000000000902'),
  'failed',
  'non-retryable validation failure closes the job'
);
select is(
  (select status::text from public.media_assets where id = '20000000-0000-4000-8000-000000000902'),
  'quarantined',
  'non-retryable content failure quarantines the asset outside playlists'
);

delete from claimed_worker_job;
set local role service_role;
insert into claimed_worker_job
select * from public.claim_media_processing_job('worker:test-legacy', 900, 3);
reset role;

select is(
  (select job_id from claimed_worker_job),
  '40000000-0000-4000-8000-000000000903'::uuid,
  'a pre-daemon processing job without lock metadata is reclaimable'
);
select is(
  (select attempt_count from claimed_worker_job),
  1,
  'reclaiming a lockless job starts its bounded attempt count'
);

select * from finish();
rollback;
